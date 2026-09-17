import sqlite3

con = sqlite3.connect(r"C:/Users/TONI/projects/social-commerce/backend/unihub_state.db")
cur = con.cursor()
cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='app_state'")
print(cur.fetchone()[0])
print("---rows---")
cur.execute("SELECT * FROM app_state LIMIT 5")
cols = [d[0] for d in cur.description]
print("cols:", cols)
for r in cur.fetchall():
    print(dict(zip(cols, [str(x)[:150] for x in r])))
con.close()