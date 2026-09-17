from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


def _conn():
    return psycopg2.connect(DATABASE_URL, connect_timeout=15)


def _rows(cur):
    cols = [d[0] for d in cur.description] if cur.description else []
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def init_state_db() -> None:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS app_state (
                    state_key TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.commit()
    finally:
        conn.close()


def get_state(key: str, default: Any = None) -> Any:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT payload FROM app_state WHERE state_key = %s", (key,))
            rows = _rows(cur)
        if not rows:
            return default
        try:
            return json.loads(rows[0]["payload"])
        except json.JSONDecodeError:
            return default
    finally:
        conn.close()


def set_state(key: str, value: Any) -> None:
    payload = json.dumps(value, separators=(",", ":"), ensure_ascii=False)
    now = datetime.now(timezone.utc).isoformat()
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_state (state_key, payload, updated_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (state_key) DO UPDATE SET
                    payload = EXCLUDED.payload,
                    updated_at = EXCLUDED.updated_at
                """,
                (key, payload, now),
            )
            conn.commit()
    finally:
        conn.close()


def seed_state(key: str, value: Any) -> Any:
    existing = get_state(key)
    if existing is not None:
        return existing
    set_state(key, value)
    return value