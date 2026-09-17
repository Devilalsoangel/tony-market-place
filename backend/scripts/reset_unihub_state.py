"""Reset legacy fake-economy keys in unihub_state.db to honest empty defaults.

Standalone maintenance script (no FastAPI import needed):
  1. Backs up backend/unihub_state.db -> backend/unihub_state.db.bak-YYYYMMDD
  2. Sets the 14 legacy state keys to their empty defaults ('[]' or '{}').

Run from the backend/ directory:  python scripts/reset_unihub_state.py

The `users` key is NOT wiped wholesale: only ghost demo profiles
(username demo/testuser) are pruned; real registered users are kept.
"""

from __future__ import annotations

import json
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BACKEND_DIR / "unihub_state.db"

# key -> empty default payload, matching existing value shapes in app_state.
EMPTY_DEFAULTS = {
    "reviews": [],
    "copy_traders": [],
    "wallets": [],
    "portfolios": {},
    "portfolio_holdings": {},
    "payment_intents": [],
    "analytics_data": [],
    "loyalty_points": [],
    "notifications": [],
    "chat_messages": [],
    "trades": [],
    "follows": [],
    "wishlists": [],
    "watchlists": [],
    "settings_data": [],
}

GHOST_USERNAMES = {"demo", "testuser"}


def _payload_length(raw: str | None) -> int:
    if raw is None:
        return -1  # key absent from DB
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return len(raw)
    if isinstance(value, list):
        return len(value)
    if isinstance(value, dict):
        return len(value)
    return len(raw)


def main() -> int:
    if not DB_PATH.exists():
        print(f"ERROR: state DB not found at {DB_PATH}")
        return 1

    stamp = datetime.now().strftime("%Y%m%d")
    backup_path = DB_PATH.with_name(f"{DB_PATH.name}.bak-{stamp}")
    shutil.copy2(DB_PATH, backup_path)
    print(f"Backup written: {backup_path}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        print()
        print(f"{'key':<18} {'before':>8} {'after':>8}")
        print("-" * 38)

        for key, default in EMPTY_DEFAULTS.items():
            row = conn.execute(
                "SELECT payload FROM app_state WHERE state_key = ?", (key,)
            ).fetchone()
            before = _payload_length(row["payload"] if row else None)
            payload = json.dumps(default, separators=(",", ":"))
            conn.execute(
                """
                INSERT INTO app_state (state_key, payload, updated_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(state_key)
                DO UPDATE SET payload = excluded.payload,
                              updated_at = excluded.updated_at
                """,
                (key, payload),
            )
            print(f"{key:<18} {before:>8} {len(default):>8}")

        # users: prune ghost demo profiles only, keep real registered users.
        row = conn.execute(
            "SELECT payload FROM app_state WHERE state_key = ?", ("users",)
        ).fetchone()
        before = after = -1
        removed = []
        if row:
            try:
                users = json.loads(row["payload"])
            except json.JSONDecodeError:
                users = None
            if isinstance(users, dict):
                before = len(users)
                kept = {}
                for uid, user in users.items():
                    username = str(
                        user.get("username", "") if isinstance(user, dict) else ""
                    ).lower()
                    if username in GHOST_USERNAMES:
                        removed.append(username)
                        continue
                    kept[uid] = user
                after = len(kept)
                if removed:
                    conn.execute(
                        """
                        UPDATE app_state
                        SET payload = ?, updated_at = datetime('now')
                        WHERE state_key = 'users'
                        """,
                        (json.dumps(kept, separators=(",", ":")),),
                    )
        print(
            f"{'users':<18} {before:>8} {after:>8}   "
            f"(pruned ghosts: {', '.join(removed) or 'none'})"
        )

        conn.commit()
        print()
        print("Done. Legacy fake-economy keys reset to empty defaults.")
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
