from __future__ import annotations

import base64
import hashlib
import hmac
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, List

try:
    from .settings import settings
except ImportError:
    from settings import settings

import psycopg2

DB_PATH = Path(settings.db_auth_path)
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


def _conn():
    return psycopg2.connect(DATABASE_URL, connect_timeout=15)


def _rows(cur) -> List[Dict[str, Any]]:
    cols = [d[0] for d in cur.description] if cur.description else []
    return [dict(zip(cols, r)) for r in cur.fetchall()]


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


def _public_user(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "username": row["username"],
        "email": row["email"],
        "provider": row["provider"],
        "created_at": row["created_at"],
    }
def _export_legacy_sqlite(cur) -> int:
    """One-time copy of old sqlite testing data into Postgres. Returns users copied."""
    try:
        cur.execute("SELECT count(*) FROM users")
        if cur.fetchone()[0] != 0:
            return 0
        if not Path(DB_PATH).exists():
            return 0
        import sqlite3

        sc = sqlite3.connect(DB_PATH)
        sc.row_factory = sqlite3.Row
        users = sc.execute("SELECT * FROM users").fetchall()
        tokens = sc.execute("SELECT * FROM refresh_tokens").fetchall()
        for r in users:
            cur.execute(
                "INSERT INTO users (full_name, username, email, password_hash, provider, created_at) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (r["full_name"], r["username"], r["email"], r["password_hash"], r["provider"], r["created_at"]),
            )
        for r in tokens:
            cur.execute(
                "INSERT INTO refresh_tokens (token, user_id, expires_at, created_at, revoked) "
                "VALUES (%s, %s, %s, %s, %s)",
                (r["token"], r["user_id"], r["expires_at"], r["created_at"], r["revoked"]),
            )
        print(f"[auth_db_pg] exported {len(users)} users + {len(tokens)} tokens from sqlite", flush=True)
        sc.close()
        return len(users)
    except Exception as exc:
        print(f"[auth_db_pg] legacy export skipped: {exc}", flush=True)
        return 0


def init_auth_db() -> None:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    token TEXT PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    expires_at BIGINT NOT NULL,
                    created_at TEXT NOT NULL,
                    revoked INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id BIGSERIAL PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    username TEXT NOT NULL UNIQUE,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    provider TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )
            _export_legacy_sqlite(cur)
            conn.commit()
    finally:
        conn.close()


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    normalized_email = email.strip().lower()
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE email = %s", (normalized_email,))
            rows = _rows(cur)
            return _public_user(rows[0]) if rows else None
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            rows = _rows(cur)
            return _public_user(rows[0]) if rows else None
    finally:
        conn.close()


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

    conn = _conn()
    try:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """
                    INSERT INTO users (full_name, username, email, password_hash, provider, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING *
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
                rows = _rows(cur)
                conn.commit()
                if not rows:
                    raise ValueError("Failed to create user")
                return _public_user(rows[0])
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                with conn.cursor() as c2:
                    c2.execute("SELECT email FROM users WHERE email = %s", (normalized_email,))
                    email_exists = c2.fetchone()
                    c2.execute("SELECT username FROM users WHERE username = %s", (normalized_username,))
                    user_exists = c2.fetchone()
                if email_exists:
                    raise ValueError("Email already used")
                if user_exists:
                    raise ValueError("Username unavailable")
                raise ValueError("User already exists")
    finally:
        conn.close()


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    normalized_email = email.strip().lower()
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE email = %s", (normalized_email,))
            rows = _rows(cur)
            if not rows:
                return None
            row = rows[0]
            if not verify_password(password, row["password_hash"]):
                return None
            return _public_user(row)
    finally:
        conn.close()


def get_all_users() -> List[Dict[str, Any]]:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users")
            result = []
            for row in _rows(cur):
                try:
                    result.append(_public_user(row))
                except Exception:
                    continue
            return result
    finally:
        conn.close()


def save_refresh_token(token: str, user_id: int, expires_at: int) -> None:
    created_at = datetime.now(timezone.utc).isoformat()
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO refresh_tokens (token, user_id, expires_at, created_at, revoked)
                VALUES (%s, %s, %s, %s, 0)
                ON CONFLICT (token) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    expires_at = EXCLUDED.expires_at,
                    created_at = EXCLUDED.created_at,
                    revoked = 0
                """,
                (token, user_id, expires_at, created_at),
            )
            conn.commit()
    finally:
        conn.close()


def is_refresh_token_valid(token: str) -> bool:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT revoked, expires_at FROM refresh_tokens WHERE token = %s", (token,))
            rows = _rows(cur)
            if not rows:
                return False
            row = rows[0]
            if int(row["revoked"]) == 1:
                return False
            return int(row["expires_at"]) > int(datetime.now(timezone.utc).timestamp())
    finally:
        conn.close()


def revoke_refresh_token(token: str) -> None:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE refresh_tokens SET revoked = 1 WHERE token = %s", (token,))
            conn.commit()
    finally:
        conn.close()