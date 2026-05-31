# Multi-stage build: React bundle first, then the FastAPI image that serves it.

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build


FROM python:3.11-slim

# UID 1000 matches the unprivileged user HF Spaces runs the container as.
RUN useradd -m -u 1000 -s /bin/bash appuser
ENV HOME=/home/appuser \
    PATH=/home/appuser/.local/bin:$PATH \
    HF_HOME=/home/appuser/.cache/huggingface \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ backend/
COPY data/ data/
COPY --from=frontend-build /app/frontend/dist frontend/dist

RUN chown -R appuser:appuser /app /home/appuser
USER appuser

# Pre-download the sentence-transformers model so the first request after
# container start doesn't pay a ~1.5GB download. Cached under HF_HOME so the
# runtime container reuses it.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-m3')"

# Build the FAISS-ready embeddings.joblib from the committed chunk JSON files.
# Doing this at build time (instead of shipping the binary in git) keeps the
# repo text-only and aligns the index with the runtime embedder. The Python
# helper loops over all corpora in one process so the bge-m3 model is loaded
# once instead of per call.
WORKDIR /app/data
RUN EMBEDDER=sentence_transformers python build_all_embeddings.py
WORKDIR /app

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:7860/api/health').read()"

# HF Spaces sets PORT=7860 automatically; default kept for local `docker run`.
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
