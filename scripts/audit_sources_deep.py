import sqlite3
import os
import hashlib
import json

def run():
    conn = sqlite3.connect('data/niyantran.db')
    conn.row_factory = sqlite3.Row
    sources = conn.execute("SELECT * FROM regulatory_sources ORDER BY created_at ASC").fetchall()
    print(f"Total regulatory sources in DB: {len(sources)}")
    
    results = []
    for s in sources:
        p = s['stored_path']
        exists = os.path.exists(p) if p else False
        sha_match = False
        actual_sha = None
        file_size = 0
        if exists:
            file_size = os.path.getsize(p)
            with open(p, 'rb') as f:
                actual_sha = hashlib.sha256(f.read()).hexdigest()
            sha_match = (actual_sha == s['sha256'])
            
        clauses = conn.execute("SELECT id, clause_number, heading, page_number, verification_status FROM regulatory_clauses WHERE source_id = ?", (s['id'],)).fetchall()
        
        info = {
            "id": s['id'],
            "title": s['source_title'],
            "category": s['document_category'],
            "official_url": s['official_source_url'],
            "stored_path": p,
            "exists_on_disk": exists,
            "file_size": file_size,
            "db_sha256": s['sha256'],
            "actual_sha256": actual_sha,
            "sha_match": sha_match,
            "verification_status": s['verification_status'],
            "superseded_by_source_id": s['superseded_by_source_id'],
            "effective_from": s['effective_from'],
            "effective_until": s['effective_until'],
            "clause_count": len(clauses),
            "verified_clauses": sum(1 for c in clauses if c['verification_status'] == 'verified'),
            "unverified_clauses": sum(1 for c in clauses if c['verification_status'] != 'verified'),
        }
        results.append(info)
        print(f"[{info['id']}] {info['title'][:45]} | Disk: {exists} | SHA Match: {sha_match} | Clauses: {len(clauses)} ({info['verified_clauses']} ver, {info['unverified_clauses']} unver) | Status: {info['verification_status']} | SupBy: {info['superseded_by_source_id']}")

    conn.close()
    return results

if __name__ == '__main__':
    run()
