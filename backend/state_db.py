from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from .settings import settings
except ImportError:
    from settings import settings

DB_PATH = Path(settings.db_state_path)


def _conn() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_state_db() -> None:
    with _conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS app_state (
                state_key TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def get_state(key: str, default: Any = None) -> Any:
    with _conn() as conn:
        row = conn.execute(
            "SELECT payload FROM app_state WHERE state_key = ?",
            (key,),
        ).fetchone()

    if not row:
        return default

    try:
        return json.loads(row["payload"])
    except json.JSONDecodeError:
        return default


def set_state(key: str, value: Any) -> None:
    payload = json.dumps(value, separators=(",", ":"), ensure_ascii=False)
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        conn.execute(
            """
            INSERT INTO app_state (state_key, payload, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(state_key)
            DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
            """,
            (key, payload, now),
        )
        conn.commit()


def seed_state(key: str, value: Any) -> Any:
    existing = get_state(key)
    if existing is not None:
        return existing
    set_state(key, value)
    return value
