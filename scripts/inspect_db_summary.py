import sqlite3

conn = sqlite3.connect('data/niyantran.db')
cur = conn.cursor()
tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table' and name!='sqlite_sequence'").fetchall()]
print("Table row counts:")
for t in tables:
    cnt = cur.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
    print(f"  {t}: {cnt}")

print("\nApplications details:")
for row in cur.execute("SELECT id, applicant_name, institution_name, status FROM applications").fetchall():
    print(" ", row)

print("\nRegulatory sources:")
for row in cur.execute("SELECT id, title, total_clauses, file_size FROM regulatory_sources").fetchall():
    print(" ", row)

conn.close()
