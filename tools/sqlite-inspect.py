import sqlite3, sys

for f in [
    r"C:/Users/TONI/projects/social-commerce/backend/unihub_auth.db",
    r"C:/Users/TONI/projects/social-commerce/backend/unihub_state.db",
]:
    print("=" * 70)
    print(f)
    con = sqlite3.connect(f)
    cur = con.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall()]
    print("tables:", tables)
    for t in tables:
        try:
            cur.execute('SELECT COUNT(*) FROM "%s"' % t)
            print("   %-30s %d" % (t, cur.fetchone()[0]))
        except Exception as e:
            print("   %-30s ERR %s" % (t, e))
    con.close()