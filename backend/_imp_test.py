import sys, os, traceback, io

sys.path.insert(0, ".")
out = io.StringIO()
err = io.StringIO()
# NEVER hardcode the prod DATABASE_URL here (a live read-write secret once
# shipped in this file to every clone). Provide it via the environment.
if not os.environ.get("DATABASE_URL"):
    print("DATABASE_URL is not set — refusing to run against an implicit database.", file=err)
    with open(os.path.join(os.path.dirname(__file__), "_imp_result.txt"), "w", encoding="utf-8") as f:
        f.write("=== OUT ===\n" + out.getvalue() + "\n=== ERR ===\n" + err.getvalue())
    raise SystemExit(2)
try:
    import main  # this imports auth_db + state_db + routers
    print("main.py import OK", file=out)
    print("fastapi app:", type(main.app).__name__, file=out)
    routes = [r.path for r in main.app.routes if hasattr(r, "path")]
    print("routes:", len(routes), file=out)
    print("sample:", [p for p in routes if p.startswith('/auth') or p.startswith('/feed') or p.startswith('/users')][:12], file=out)
except Exception:
    traceback.print_exc(file=err)
with open(os.path.join(os.path.dirname(__file__), "_imp_result.txt"), "w", encoding="utf-8") as f:
    f.write("=== OUT ===\n" + out.getvalue() + "\n=== ERR ===\n" + err.getvalue())