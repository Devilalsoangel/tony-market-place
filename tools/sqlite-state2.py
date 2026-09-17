import sqlite3

con = sqlite3.connect(r"C:/Users/TONI/projects/social-commerce/backend/unihub_state.db")
cur = con.cursor()
cur.execute("SELECT state_key, length(payload), updated_at FROM app_state ORDER BY updated_at")
for k, ln, u in cur.fetchall():
    print("%-22s len=%-8d %s" % (k, ln, u))
con.close()