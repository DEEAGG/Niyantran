import sqlite3
import json

def audit():
    conn = sqlite3.connect('data/niyantran.db')
    conn.row_factory = sqlite3.Row
    clauses = conn.execute("SELECT * FROM regulatory_clauses ORDER BY source_id, page_number, clause_number").fetchall()
    print(f"Total clauses found: {len(clauses)}")
    
    # Check rules and their clause references
    rules = conn.execute("SELECT r.id, r.rule_key, r.title, rs.clause_reference, rs.page_reference, rs.official_source_name FROM rules r LEFT JOIN rule_sources rs ON r.id = rs.rule_id").fetchall()
    print(f"Total rules: {len(rules)}")
    rule_refs = {r['clause_reference']: r for r in rules if r['clause_reference']}
    
    # Inspect clauses
    issues = []
    for c in clauses:
        cid = c['id']
        cnum = c['clause_number']
        hd = c['heading']
        pg = c['page_number']
        txt = c['verbatim_text']
        src = c['source_id']
        stat = c['verification_status']
        sup = c['superseded_by_clause_id']
        
        # Check if heading has garbled characters e.g. 
        has_garble = '' in hd or '' in txt
        is_generic = 'Page ' in cnum or 'Provision' in cnum or hd.startswith('Official Regulatory')
        
        # Check if used by rule
        used_by_rule = None
        for ref_key, r_info in rule_refs.items():
            if cnum and (cnum in ref_key or ref_key in cnum):
                used_by_rule = r_info['rule_key']
                break
                
        issues.append({
            "id": cid,
            "source_id": src,
            "clause_number": cnum,
            "heading": hd,
            "page_number": pg,
            "status": stat,
            "has_garble": has_garble,
            "is_generic": is_generic,
            "used_by_rule": used_by_rule,
            "superseded_by": sup
        })
        
    print(json.dumps(issues, indent=2))
    conn.close()

if __name__ == '__main__':
    audit()
