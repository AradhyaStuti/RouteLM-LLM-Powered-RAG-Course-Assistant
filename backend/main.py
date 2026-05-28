"""FastAPI entry point."""

import os
import time
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from backend.config import (
    EMBED_MODEL,
    EMBEDDER,
    LLM_MODEL,
    LLM_PROVIDER,
    ST_EMBED_MODEL,
)
from backend.limiter import limiter
from backend.rag.embeddings import embedding_service
from backend.db.store import init_db
from backend.auth.security import init_auth_db, ensure_demo_user
from backend.routes.auth import router as auth_router
from backend.routes.chat import router as chat_router
from backend.routes.conversations import router as conv_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
request_logger = logging.getLogger("backend.requests")

def startup():
    init_db()
    init_auth_db()

    if os.getenv("SEED_DEMO_USER", "false").lower() == "true":
        demo_pw = os.getenv("DEMO_USER_PASSWORD")
        if demo_pw:
            ensure_demo_user(demo_pw)
        else:
            logger.warning("SEED_DEMO_USER=true but DEMO_USER_PASSWORD is empty — skipping seed")

    embedding_service.load()
    logger.info("Application startup complete")


@asynccontextmanager
async def lifespan(app: FastAPI):
    startup()
    yield


app = FastAPI(
    title="RouteLM",
    version="2.0.0",
    description="RAG-powered AI tutor with LangChain + LangGraph",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down."},
    )


ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    if request.url.path.startswith("/api"):
        start = time.time()
        response = await call_next(request)
        ms = round((time.time() - start) * 1000)
        request_logger.info(
            "%s %s %s %dms",
            request.method, request.url.path, response.status_code, ms,
        )
        return response
    return await call_next(request)


app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(conv_router)


@app.get("/api/health")
def health():
    from backend.rag.generator import llm_breaker
    embedding_model = ST_EMBED_MODEL if EMBEDDER == "sentence_transformers" else EMBED_MODEL
    return {
        "status": "ok",
        "chunks_loaded": len(embedding_service.df) if embedding_service.df is not None else 0,
        "llm_provider": LLM_PROVIDER,
        "llm_model": LLM_MODEL,
        "embedder": EMBEDDER,
        "embedding_model": embedding_model,
        "cache": embedding_service.cache_stats,
        "llm_circuit_open": llm_breaker.is_open,
    }


FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")

if os.path.exists(FRONTEND_DIR):
    from starlette.middleware.base import BaseHTTPMiddleware
    import mimetypes

    class SPAMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            path = request.url.path

            if path.startswith("/api"):
                return await call_next(request)

            if path.startswith("/assets/"):
                file_path = os.path.join(FRONTEND_DIR, path.lstrip("/"))
                if os.path.isfile(file_path):
                    content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
                    return FileResponse(file_path, media_type=content_type)

            if request.method == "GET":
                index_path = os.path.join(FRONTEND_DIR, "index.html")
                if os.path.isfile(index_path):
                    return FileResponse(index_path)

            return await call_next(request)

    app.add_middleware(SPAMiddleware)
