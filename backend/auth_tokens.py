from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any, Dict

SECRET_KEY = os.getenv("UNIHUB_TOKEN_SECRET", "change-this-in-production")
ACCESS_TOKEN_TTL_SECONDS = 60 * 30
REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _sign(signing_input: str) -> str:
    digest = hmac.new(SECRET_KEY.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
    return _b64url_encode(digest)


def _encode(payload: Dict[str, Any]) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_part = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_part = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_part}.{payload_part}"
    signature = _sign(signing_input)
    return f"{signing_input}.{signature}"


def _decode(token: str) -> Dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Malformed token")

    signing_input = f"{parts[0]}.{parts[1]}"
    expected_signature = _sign(signing_input)
    if not hmac.compare_digest(expected_signature, parts[2]):
        raise ValueError("Invalid token signature")

    payload_bytes = _b64url_decode(parts[1])
    payload = json.loads(payload_bytes.decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Invalid token payload")

    exp = int(payload.get("exp", 0))
    if int(time.time()) >= exp:
        raise ValueError("Token expired")

    return payload


def create_access_token(user_id: int, email: str) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "email": email,
        "type": "access",
        "iat": now,
        "exp": now + ACCESS_TOKEN_TTL_SECONDS,
        "jti": secrets.token_hex(12),
    }
    return _encode(payload)


def create_refresh_token(user_id: int, email: str) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "email": email,
        "type": "refresh",
        "iat": now,
        "exp": now + REFRESH_TOKEN_TTL_SECONDS,
        "jti": secrets.token_hex(16),
    }
    return _encode(payload)


def decode_token(token: str) -> Dict[str, Any]:
    return _decode(token)
