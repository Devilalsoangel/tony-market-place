# state_db.py - selector: PostgreSQL (Neon) when DATABASE_URL is set, else legacy sqlite (local dev).
# LOCKED POSTGRES in production.
import os as _os

_USE_PG = bool(_os.getenv("DATABASE_URL", "").strip())

if _USE_PG:
    try:
        from .state_db_pg import (  # type: ignore # noqa: F401
            get_state,
            init_state_db,
            seed_state,
            set_state,
        )
    except ImportError:
        from state_db_pg import (  # type: ignore # noqa: F401
            get_state,
            init_state_db,
            seed_state,
            set_state,
        )
else:
    try:
        from .state_db_sqlite import (  # type: ignore # noqa: F401
            get_state,
            init_state_db,
            seed_state,
            set_state,
        )
    except ImportError:
        from state_db_sqlite import (  # type: ignore # noqa: F401
            get_state,
            init_state_db,
            seed_state,
            set_state,
        )