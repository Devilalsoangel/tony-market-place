import sqlite3

for f in [r"C:/Users/TONI/projects/social-commerce/backend/unihub_auth.db"]:
    con = sqlite3.connect(f)
    cur = con.cursor()
    print("=" * 60)
    print(f)
    cur.execute("SELECT id, full_name, username, email, provider, created_at FROM users")
    for r in cur.fetchall():
        print("  USER:", r)
    cur.execute("SELECT count(*) FROM refresh_tokens")
    print("  refresh_tokens:", cur.fetchone()[0])
    con.close()