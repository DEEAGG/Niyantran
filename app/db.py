import os
import sqlite3
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from contextlib import contextmanager
from typing import Optional, Dict, Any, List

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DOCUMENTS_DIR = DATA_DIR / "documents"
DOCUMENTS_DIR.mkdir(exist_ok=True)
REGULATORY_SOURCES_DIR = DATA_DIR / "regulatory_sources"
REGULATORY_SOURCES_DIR.mkdir(exist_ok=True)

def get_db_path() -> Path:
    env_override = os.getenv("NIYANTRAN_DB_PATH")
    if env_override:
        return Path(env_override)
    return DATA_DIR / "niyantran.db"

DB_PATH = get_db_path()

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL,
 password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'institution_user',
 institution_name TEXT, institution_id TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE TABLE IF NOT EXISTS applications (
 id TEXT PRIMARY KEY, application_type TEXT NOT NULL, applicant_name TEXT,
 institution_name TEXT, status TEXT NOT NULL DEFAULT 'draft',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
 id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES applications(id),
 document_type TEXT NOT NULL, original_filename TEXT NOT NULL,
 stored_path TEXT NOT NULL, mime_type TEXT, sha256 TEXT NOT NULL,
 file_size INTEGER NOT NULL, page_count INTEGER, uploaded_at TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, processing_status TEXT NOT NULL DEFAULT 'uploaded'
);
CREATE TABLE IF NOT EXISTS extraction_runs (
 id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id),
 run_number INTEGER NOT NULL, method TEXT NOT NULL, status TEXT NOT NULL,
 started_at TEXT NOT NULL, completed_at TEXT, error_message TEXT
);
CREATE TABLE IF NOT EXISTS extracted_fields (
 id TEXT PRIMARY KEY, extraction_run_id TEXT NOT NULL REFERENCES extraction_runs(id),
 field_name TEXT NOT NULL, field_value TEXT, normalized_value TEXT,
 confidence REAL, page_number INTEGER, bbox_json TEXT, extraction_method TEXT,
 confirmed INTEGER NOT NULL DEFAULT 0, confirmed_by TEXT, confirmed_at TEXT
);
CREATE TABLE IF NOT EXISTS rules (
 id TEXT PRIMARY KEY, rule_key TEXT NOT NULL, version INTEGER NOT NULL,
 title TEXT NOT NULL, description TEXT NOT NULL, rule_type TEXT NOT NULL,
 parameters_json TEXT NOT NULL, application_type TEXT, enabled INTEGER NOT NULL DEFAULT 1,
 source_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
 created_at TEXT NOT NULL, UNIQUE(rule_key, version)
);
CREATE TABLE IF NOT EXISTS rule_sources (
 id TEXT PRIMARY KEY, rule_id TEXT NOT NULL REFERENCES rules(id),
 official_source_name TEXT, official_source_url TEXT, clause_reference TEXT,
 page_reference TEXT, application_type TEXT, effective_date TEXT,
 verification_status TEXT NOT NULL DEFAULT 'unverified',
 reviewer_name TEXT, reviewed_at TEXT, review_notes TEXT,
 test_cases_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rulesets (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL,
 activated_at TEXT, UNIQUE(name, version)
);
CREATE TABLE IF NOT EXISTS ruleset_rules (
 ruleset_id TEXT NOT NULL REFERENCES rulesets(id),
 rule_id TEXT NOT NULL REFERENCES rules(id),
 PRIMARY KEY(ruleset_id, rule_id)
);
CREATE TABLE IF NOT EXISTS rule_proposals (
 id TEXT PRIMARY KEY, proposed_rule_json TEXT NOT NULL,
 reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
 proposed_by TEXT, reviewed_by TEXT, created_at TEXT NOT NULL,
 reviewed_at TEXT, review_notes TEXT
);
CREATE TABLE IF NOT EXISTS validation_runs (
 id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES applications(id),
 ruleset_id TEXT REFERENCES rulesets(id), status TEXT NOT NULL,
 input_fingerprint TEXT NOT NULL, started_at TEXT NOT NULL,
 completed_at TEXT, summary_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS findings (
 id TEXT PRIMARY KEY, validation_run_id TEXT NOT NULL REFERENCES validation_runs(id),
 rule_id TEXT REFERENCES rules(id), code TEXT NOT NULL, severity TEXT NOT NULL,
 status TEXT NOT NULL, message TEXT NOT NULL, evidence_json TEXT NOT NULL DEFAULT '{}',
 recommendation TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS decisions (
 id TEXT PRIMARY KEY, finding_id TEXT NOT NULL REFERENCES findings(id),
 decision TEXT NOT NULL, reason TEXT, actor TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS authenticity_signals (
 id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id),
 signal_type TEXT NOT NULL, result TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS manual_verifications (
 id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id),
 verification_type TEXT NOT NULL, result TEXT NOT NULL, verifier TEXT NOT NULL,
 evidence_reference TEXT, notes TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS replays (
 id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES applications(id),
 previous_validation_run_id TEXT REFERENCES validation_runs(id),
 new_validation_run_id TEXT REFERENCES validation_runs(id),
 status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS replay_diffs (
 id TEXT PRIMARY KEY, replay_id TEXT NOT NULL REFERENCES replays(id),
 finding_id TEXT REFERENCES findings(id), diff_type TEXT NOT NULL,
 previous_value TEXT, new_value TEXT, explanation TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL,
 actor TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
 event_json TEXT NOT NULL DEFAULT '{}', previous_hash TEXT,
 entry_hash TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS regulatory_sources (
 id TEXT PRIMARY KEY,
 source_title TEXT NOT NULL,
 issuing_authority TEXT NOT NULL,
 official_source_url TEXT,
 document_category TEXT NOT NULL,
 publication_date TEXT,
 effective_from TEXT,
 effective_until TEXT,
 retrieval_timestamp TEXT NOT NULL,
 document_version TEXT NOT NULL,
 sha256 TEXT NOT NULL UNIQUE,
 stored_path TEXT NOT NULL,
 file_size INTEGER NOT NULL,
 page_count INTEGER NOT NULL DEFAULT 0,
 processing_status TEXT NOT NULL DEFAULT 'pending',
 verification_status TEXT NOT NULL DEFAULT 'unverified',
 supersedes_source_id TEXT REFERENCES regulatory_sources(id),
 superseded_by_source_id TEXT REFERENCES regulatory_sources(id),
 extraction_errors TEXT,
 review_notes TEXT,
 last_checked_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS regulatory_clauses (
 id TEXT PRIMARY KEY,
 source_id TEXT NOT NULL REFERENCES regulatory_sources(id),
 clause_number TEXT,
 heading TEXT,
 page_number INTEGER NOT NULL,
 verbatim_text TEXT NOT NULL,
 summary_rule TEXT,
 category TEXT NOT NULL DEFAULT 'General Norms',
 applicability_scope TEXT NOT NULL DEFAULT 'Universal',
 verification_status TEXT NOT NULL DEFAULT 'unverified',
 reviewer_name TEXT,
 reviewed_at TEXT,
 review_notes TEXT,
 superseded_by_clause_id TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_application ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_fields_run ON extracted_fields(extraction_run_id);
CREATE INDEX IF NOT EXISTS idx_validation_application ON validation_runs(application_id);
CREATE INDEX IF NOT EXISTS idx_findings_run ON findings(validation_run_id);
CREATE INDEX IF NOT EXISTS idx_rule_sources_rule ON rule_sources(rule_id);
CREATE INDEX IF NOT EXISTS idx_reg_clauses_source ON regulatory_clauses(source_id);
CREATE INDEX IF NOT EXISTS idx_reg_clauses_page ON regulatory_clauses(source_id, page_number);
CREATE INDEX IF NOT EXISTS idx_reg_sources_status ON regulatory_sources(processing_status, verification_status);
"""

@contextmanager
def get_connection(db_path: Optional[Path] = None):
 target = db_path if db_path is not None else get_db_path()
 conn = sqlite3.connect(target)
 conn.row_factory = sqlite3.Row
 conn.execute("PRAGMA foreign_keys = ON")
 try:
  yield conn
  conn.commit()
 except Exception:
  conn.rollback()
  raise
 finally:
  conn.close()

def migrate_schema(conn: sqlite3.Connection):
    """Safely apply incremental schema migrations without data loss."""
    cols = [r[1] for r in conn.execute("PRAGMA table_info(applications)").fetchall()]
    if "user_id" not in cols:
        conn.execute("ALTER TABLE applications ADD COLUMN user_id TEXT")
    if "institution_id" not in cols:
        conn.execute("ALTER TABLE applications ADD COLUMN institution_id TEXT")
    conn.commit()

def seed_default_users(conn: sqlite3.Connection):
    """Seed initial default authorized accounts if users table is empty."""
    from app.auth import hash_password
    count = conn.execute("SELECT COUNT(*) as cnt FROM users").fetchone()["cnt"]
    now = datetime.now(timezone.utc).isoformat()
    if count == 0:
        default_users = [
            (
                "USR-ADGIPS",
                "adgips@institution.edu.in",
                "ADGIPS Officer",
                hash_password("Adgips@2026"),
                "institution_user",
                "ADGIPS",
                "INST-ADGIPS",
                now,
                now,
            ),
            (
                "USR-OFFICER",
                "officer@aicte.gov.in",
                "Dr. A. Sharma",
                hash_password("Officer@2026"),
                "reviewer",
                "AICTE Regulatory Directorate",
                "AICTE-RO-HQ",
                now,
                now,
            ),
            (
                "USR-ADMIN",
                "admin@niyantran.local",
                "System Administrator",
                hash_password("Admin@2026"),
                "admin",
                "NIYANTRAN HQ",
                "AICTE-HQ",
                now,
                now,
            ),
        ]
        conn.executemany(
            """
            INSERT INTO users (id, email, full_name, password_hash, role, institution_name, institution_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            default_users,
        )
        conn.commit()

    # Always ensure existing ADGIPS application is linked to ADGIPS user
    conn.execute(
        "UPDATE applications SET user_id = 'USR-ADGIPS', institution_id = 'INST-ADGIPS' WHERE (institution_name LIKE '%ADGIPS%' OR applicant_name LIKE '%ADGIPS%') AND (user_id IS NULL OR user_id = '')"
    )
    conn.commit()

def init_db(db_path: Optional[Path] = None):
    target = db_path if db_path is not None else get_db_path()
    with get_connection(target) as conn:
        conn.executescript(SCHEMA)
        conn.commit()
        migrate_schema(conn)
        seed_default_users(conn)
    return target

def compute_entry_hash(
    previous_hash: Optional[str],
    event_type: str,
    actor: str,
    entity_type: str,
    entity_id: Optional[str],
    event_json: str,
    created_at: str,
) -> str:
    canonical = f"{previous_hash or 'GENESIS'}|{event_type}|{actor}|{entity_type}|{entity_id or ''}|{event_json}|{created_at}"
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

def add_audit_entry(
    conn: sqlite3.Connection,
    event_type: str,
    entity_type: str,
    entity_id: Optional[str],
    event_data: Dict[str, Any],
    actor: str = "system-audit",
) -> Dict[str, Any]:
    last = conn.execute("SELECT entry_hash FROM audit_log ORDER BY id DESC LIMIT 1").fetchone()
    previous_hash = last["entry_hash"] if last and last["entry_hash"] else "GENESIS"
    created_at = datetime.now(timezone.utc).isoformat()
    event_json = json.dumps(event_data, sort_keys=True)
    entry_hash = compute_entry_hash(
        previous_hash=previous_hash,
        event_type=event_type,
        actor=actor,
        entity_type=entity_type,
        entity_id=entity_id,
        event_json=event_json,
        created_at=created_at,
    )
    cursor = conn.execute(
        """
        INSERT INTO audit_log (event_type, actor, entity_type, entity_id, event_json, previous_hash, entry_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (event_type, actor, entity_type, entity_id, event_json, previous_hash, entry_hash, created_at),
    )
    return {
        "id": cursor.lastrowid,
        "event_type": event_type,
        "actor": actor,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "event_json": event_json,
        "previous_hash": previous_hash,
        "entry_hash": entry_hash,
        "created_at": created_at,
    }

def verify_audit_chain(conn: sqlite3.Connection) -> Dict[str, Any]:
    rows = conn.execute(
        "SELECT id, event_type, actor, entity_type, entity_id, event_json, previous_hash, entry_hash, created_at FROM audit_log ORDER BY id ASC"
    ).fetchall()
    prev_hash = "GENESIS"
    for r in rows:
        if r["previous_hash"] != prev_hash:
            return {
                "verified": False,
                "error": f"Chain broken at record ID {r['id']}: previous_hash '{r['previous_hash']}' != expected '{prev_hash}'",
                "total_records": len(rows),
                "failed_record_id": r["id"],
            }
        expected_hash = compute_entry_hash(
            previous_hash=r["previous_hash"],
            event_type=r["event_type"],
            actor=r["actor"],
            entity_type=r["entity_type"],
            entity_id=r["entity_id"],
            event_json=r["event_json"],
            created_at=r["created_at"],
        )
        if r["entry_hash"] != expected_hash:
            return {
                "verified": False,
                "error": f"Tampered record at ID {r['id']}: entry_hash '{r['entry_hash']}' != expected '{expected_hash}'",
                "total_records": len(rows),
                "failed_record_id": r["id"],
            }
        prev_hash = r["entry_hash"]
    return {
        "verified": True,
        "total_records": len(rows),
        "latest_hash": prev_hash if rows else "GENESIS",
    }

if __name__ == "__main__":
 path = init_db()
 with get_connection() as conn:
  tables = [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = ? ORDER BY name", ("table",))]
 print("Database:", path)
 print("Tables created:", len(tables))
 print("\n".join(tables))
