from __future__ import annotations

import base64
import hashlib
import hmac
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, List

try:
    from .settings import settings
except ImportError:
    from settings import settings

DB_PATH = Path(settings.db_auth_path)


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    iterations = 120_000
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    salt_b64 = base64.b64encode(salt).decode("ascii")
    key_b64 = base64.b64encode(key).decode("ascii")
    return f"pbkdf2_sha256${iterations}${salt_b64}${key_b64}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_b64, key_b64 = password_hash.split("$")
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    iterations = int(iterations_text)
    salt = base64.b64decode(salt_b64.encode("ascii"))
    expected = base64.b64decode(key_b64.encode("ascii"))
    computed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(computed, expected)


def _public_user(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "username": row["username"],
        "email": row["email"],
        "provider": row["provider"],
        "created_at": row["created_at"],
    }


def init_auth_db() -> None:
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                revoked INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                provider TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()

    seed_default_users()


def seed_default_users() -> None:
    default_users = [
        {
            "full_name": "Demo User",
            "username": "demo",
            "email": "demo@unihub.com",
            "password": "Demo@123",
            "provider": None,
        },
        {
            "full_name": "Test User",
            "username": "testuser",
            "email": "test@unihub.com",
            "password": "Test@1234",
            "provider": None,
        },
    ]

    for user in default_users:
        if not get_user_by_email(user["email"]):
            create_user(
                full_name=user["full_name"],
                username=user["username"],
                email=user["email"],
                password=user["password"],
                provider=user["provider"],
            )


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    normalized_email = email.strip().lower()
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (normalized_email,)).fetchone()
    if not row:
        return None
    return _public_user(row)


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        return None
    return _public_user(row)


def create_user(
    full_name: str,
    username: str,
    email: str,
    password: str,
    provider: Optional[str] = None,
) -> Dict[str, Any]:
    normalized_full_name = full_name.strip()
    normalized_username = username.strip().lower()
    normalized_email = email.strip().lower()
    created_at = datetime.now(timezone.utc).isoformat()
    password_hash = hash_password(password)

    try:
        with _get_conn() as conn:
            cursor = conn.execute(
                """
                INSERT INTO users (full_name, username, email, password_hash, provider, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    normalized_full_name,
                    normalized_username,
                    normalized_email,
                    password_hash,
                    provider,
                    created_at,
                ),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    except sqlite3.IntegrityError as exc:
        msg = str(exc).lower()
        if "users.email" in msg:
            raise ValueError("Email already used") from exc
        if "users.username" in msg:
            raise ValueError("Username unavailable") from exc
        raise ValueError("User already exists") from exc

    if row is None:
        raise ValueError("Failed to create user")

    return _public_user(row)


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    normalized_email = email.strip().lower()
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (normalized_email,)).fetchone()

    if not row:
        return None

    if not verify_password(password, row["password_hash"]):
        return None

    return _public_user(row)


def get_all_users() -> List[Dict[str, Any]]:
    """Return a list of all public users stored in the auth database."""
    with _get_conn() as conn:
        rows = conn.execute("SELECT * FROM users").fetchall()

    result: List[Dict[str, Any]] = []
    for row in rows:
        try:
            result.append(_public_user(row))
        except Exception:
            continue
    return result


def save_refresh_token(token: str, user_id: int, expires_at: int) -> None:
    created_at = datetime.now(timezone.utc).isoformat()
    with _get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO refresh_tokens (token, user_id, expires_at, created_at, revoked)
            VALUES (?, ?, ?, ?, 0)
            """,
            (token, user_id, expires_at, created_at),
        )
        conn.commit()


def is_refresh_token_valid(token: str) -> bool:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT revoked, expires_at FROM refresh_tokens WHERE token = ?",
            (token,),
        ).fetchone()
    if not row:
        return False
    if int(row["revoked"]) == 1:
        return False
    return int(row["expires_at"]) > int(datetime.now(timezone.utc).timestamp())


def revoke_refresh_token(token: str) -> None:
    with _get_conn() as conn:
        conn.execute(
            "UPDATE refresh_tokens SET revoked = 1 WHERE token = ?",
            (token,),
        )
        conn.commit()
