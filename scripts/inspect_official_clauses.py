import sqlite3
import json

def run():
    conn = sqlite3.connect('data/niyantran.db')
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT id, source_id, clause_number, heading, page_number, verification_status, superseded_by_clause_id FROM regulatory_clauses WHERE source_id LIKE 'SRC-AICTE%' ORDER BY source_id, page_number, clause_number").fetchall()
    print(f"Total official clauses: {len(rows)}")
    for r in rows:
        print(f"[{r['source_id']}] Page {r['page_number']} | {r['clause_number']} - {r['heading']} (Status: {r['verification_status']}) Sup: {r['superseded_by_clause_id']}")
    conn.close()

if __name__ == '__main__':
    run()
