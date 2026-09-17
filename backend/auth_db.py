# auth_db.py - selector: PostgreSQL (Neon) when DATABASE_URL is set, else legacy sqlite (local dev).
# LOCKED POSTGRES in production. The PG implementation auto-exports the old sqlite
# testing data into Postgres on first init so nothing is lost.
import os as _os

_USE_PG = bool(_os.getenv("DATABASE_URL", "").strip())

if _USE_PG:
    try:
        from .auth_db_pg import (  # type: ignore # noqa: F401
            authenticate_user,
            create_user,
            get_all_users,
            get_user_by_email,
            get_user_by_id,
            init_auth_db,
            is_refresh_token_valid,
            revoke_refresh_token,
            save_refresh_token,
        )
    except ImportError:
        from auth_db_pg import (  # type: ignore # noqa: F401
            authenticate_user,
            create_user,
            get_all_users,
            get_user_by_email,
            get_user_by_id,
            init_auth_db,
            is_refresh_token_valid,
            revoke_refresh_token,
            save_refresh_token,
        )
else:
    try:
        from .auth_db_sqlite import (  # type: ignore # noqa: F401
            authenticate_user,
            create_user,
            get_all_users,
            get_user_by_email,
            get_user_by_id,
            init_auth_db,
            is_refresh_token_valid,
            revoke_refresh_token,
            save_refresh_token,
        )
    except ImportError:
        from auth_db_sqlite import (  # type: ignore # noqa: F401
            authenticate_user,
            create_user,
            get_all_users,
            get_user_by_email,
            get_user_by_id,
            init_auth_db,
            is_refresh_token_valid,
            revoke_refresh_token,
            save_refresh_token,
        )