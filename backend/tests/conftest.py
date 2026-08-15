import os
import sys
from pathlib import Path

# ensure workspace root is on path so "import backend" resolves regardless
# of current working directory during pytest runs.
workspace_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(workspace_root))

# also add backend directory to path for direct imports when running from Backend/
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import pytest

try:
    from backend import auth_db, state_db
except ImportError:
    # fallback for when running from Backend directory
    import auth_db
    import state_db

@pytest.fixture(autouse=True)
def fresh_databases(tmp_path):
    """Use fresh SQLite files for auth and state data during tests.

    The fastapi app initializes the databases when imported, so we need
    to ensure the DB_PATH constants point to temporary files before the
    app is brought up.  Individual test modules can also rely on this
    fixture to reset the databases between test functions.
    """
    # monkeypatch constants to use a temporary directory
    auth_db.DB_PATH = tmp_path / "auth.db"
    state_db.DB_PATH = tmp_path / "state.db"

    # make sure directories exist and initialize schema
    auth_db.init_auth_db()
    state_db.init_state_db()

    yield

    # cleanup happens automatically when tmp_path is removed by pytest
