"""Register and login endpoints (rate-limited)."""

from fastapi import APIRouter, HTTPException, Request

from backend.limiter import limiter
from backend.auth.security import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    create_user,
    authenticate_user,
    create_access_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
@limiter.limit("5/minute")
async def register(request: Request, req: RegisterRequest):
    user = create_user(req.username, req.password)
    token = create_access_token(user["id"], user["username"])
    return TokenResponse(access_token=token, username=user["username"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, req: LoginRequest):
    user = authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token(user["id"], user["username"])
    return TokenResponse(access_token=token, username=user["username"])
