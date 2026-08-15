from __future__ import annotations

import re
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

try:
    from .auth_db import (
        authenticate_user,
        create_user,
        get_user_by_id,
        is_refresh_token_valid,
        revoke_refresh_token,
        save_refresh_token,
    )
    from .auth_tokens import (
        REFRESH_TOKEN_TTL_SECONDS,
        create_access_token,
        create_refresh_token,
        decode_token,
    )
except ImportError:
    from auth_db import (
        authenticate_user,
        create_user,
        get_user_by_id,
        is_refresh_token_valid,
        revoke_refresh_token,
        save_refresh_token,
    )
    from auth_tokens import (
        REFRESH_TOKEN_TTL_SECONDS,
        create_access_token,
        create_refresh_token,
        decode_token,
    )

router = APIRouter(prefix="/auth", tags=["auth"])

USERNAME_RE = re.compile(r"^[a-z0-9._]{3,20}$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)
    username: str = Field(min_length=3, max_length=20)
    email: str
    password: str = Field(min_length=8, max_length=128)
    provider: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=128)


class PublicUser(BaseModel):
    id: int
    full_name: str
    username: str
    email: str
    provider: Optional[str]
    created_at: datetime


class AuthResponse(BaseModel):
    message: str
    user: PublicUser
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10)


def _build_auth_response(message: str, user: dict) -> AuthResponse:
    access_token = create_access_token(user["id"], user["email"])
    refresh_token = create_refresh_token(user["id"], user["email"])
    save_refresh_token(
        token=refresh_token,
        user_id=user["id"],
        expires_at=int(time.time()) + REFRESH_TOKEN_TTL_SECONDS,
    )
    return AuthResponse(
        message=message,
        user=PublicUser(**user),
        access_token=access_token,
        refresh_token=refresh_token,
    )


def _validate_password_strength(password: str) -> bool:
    return any(ch.isalpha() for ch in password) and any(ch.isdigit() for ch in password)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest) -> AuthResponse:
    normalized_username = payload.username.strip().lower()
    normalized_email = payload.email.strip().lower()
    if not USERNAME_RE.match(normalized_username):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Username must be 3-20 chars: lowercase letters, numbers, dot, underscore.",
        )
    if not EMAIL_RE.match(normalized_email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a valid email address.",
        )

    if not _validate_password_strength(payload.password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must include letters and numbers.",
        )

    try:
        user = create_user(
            full_name=payload.full_name,
            username=normalized_username,
            email=normalized_email,
            password=payload.password,
            provider=payload.provider,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return _build_auth_response("Account created", user)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest) -> AuthResponse:
    normalized_email = payload.email.strip().lower()
    if not EMAIL_RE.match(normalized_email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a valid email address.",
        )

    user = authenticate_user(normalized_email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    return _build_auth_response("Signed in", user)


@router.post("/refresh", response_model=AuthResponse)
def refresh_token(payload: RefreshRequest) -> AuthResponse:
    refresh_token_value = payload.refresh_token.strip()
    if not is_refresh_token_valid(refresh_token_value):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")

    try:
        token_payload = decode_token(refresh_token_value)
    except ValueError as exc:
        revoke_refresh_token(refresh_token_value)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if token_payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type.")

    user_id = int(token_payload.get("sub", "0"))
    user = get_user_by_id(user_id)
    if not user:
        revoke_refresh_token(refresh_token_value)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    revoke_refresh_token(refresh_token_value)
    return _build_auth_response("Token refreshed", user)


def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type.")

    user_id = int(payload.get("sub", "0"))
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    return user


@router.get("/me", response_model=PublicUser)
def me(current_user: dict = Depends(get_current_user)) -> PublicUser:
    return PublicUser(**current_user)
