import os
import sqlite3
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from contextlib import contextmanager
from typing import Optional, Dict, Any, List, Tuple

BASE_DIR = Path(__file__).resolve().parent.parent

# Check if data directory is explicitly overridden via environment
_env_data_dir = os.getenv("NIYANTRAN_DATA_DIR")
if _env_data_dir:
    DATA_DIR = Path(_env_data_dir)
else:
    DATA_DIR = BASE_DIR / "data"

try:
    DATA_DIR.mkdir(exist_ok=True, parents=True)
except (PermissionError, OSError):
    DATA_DIR = Path("/tmp/niyantran_data")
    DATA_DIR.mkdir(exist_ok=True, parents=True)

DOCUMENTS_DIR = Path(os.getenv("NIYANTRAN_DOCUMENTS_DIR", DATA_DIR / "documents"))
try:
    DOCUMENTS_DIR.mkdir(exist_ok=True, parents=True)
except (PermissionError, OSError):
    DOCUMENTS_DIR = Path("/tmp/niyantran_data/documents")
    DOCUMENTS_DIR.mkdir(exist_ok=True, parents=True)

REGULATORY_SOURCES_DIR = Path(os.getenv("NIYANTRAN_REGULATORY_DIR", DATA_DIR / "regulatory_sources"))
try:
    REGULATORY_SOURCES_DIR.mkdir(exist_ok=True, parents=True)
except (PermissionError, OSError):
    REGULATORY_SOURCES_DIR = Path("/tmp/niyantran_data/regulatory_sources")
    REGULATORY_SOURCES_DIR.mkdir(exist_ok=True, parents=True)

def get_db_path() -> Path:
    env_override = os.getenv("NIYANTRAN_DB_PATH")
    if env_override:
        return Path(env_override)
    
    target = DATA_DIR / "niyantran.db"
    # In serverless environments where root filesystem is read-only:
    if not os.access(DATA_DIR, os.W_OK) and os.name != 'nt':
        tmp_db = Path("/tmp/niyantran.db")
        if not tmp_db.exists() and target.exists():
            try:
                import shutil
                shutil.copyfile(target, tmp_db)
            except Exception:
                pass
        return tmp_db
    return target

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
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 user_id TEXT, institution_id TEXT
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


def is_postgres() -> bool:
    """Returns True if DATABASE_URL is configured for a PostgreSQL connection."""
    url = os.getenv("DATABASE_URL", "").strip().lower()
    return url.startswith("postgres://") or url.startswith("postgresql://")


def normalize_turso_url(url: str) -> str:
    """Normalizes Turso URLs to use https:// scheme.
    
    libsql-client converts libsql:// to wss:// (Hrana2 WebSockets). Turso's regional
    and serverless endpoints return 400 Bad Request on WebSocket protocol negotiation,
    and WebSockets do not persist in serverless runtimes. Converting libsql:// and
    wss:// to https:// engages the official HTTP pipeline (POST /v1/execute).
    """
    clean = url.strip()
    if clean.startswith("libsql://"):
        return "https://" + clean[len("libsql://"):]
    if clean.startswith("wss://") and ("turso.io" in clean or "aws" in clean):
        return "https://" + clean[len("wss://"):]
    return clean


def is_turso() -> bool:
    """Returns True if TURSO_DATABASE_URL is set or DATABASE_URL is configured for Turso / libSQL."""
    turso_url = os.getenv("TURSO_DATABASE_URL", "").strip().lower()
    db_url = os.getenv("DATABASE_URL", "").strip().lower()
    return bool(turso_url) or db_url.startswith(("libsql://", "wss://", "ws://")) or ("turso.io" in db_url)


def get_turso_config() -> Tuple[str, Optional[str]]:
    raw_url = (os.getenv("TURSO_DATABASE_URL") or os.getenv("DATABASE_URL", "")).strip()
    url = normalize_turso_url(raw_url)
    raw_token = os.getenv("TURSO_AUTH_TOKEN")
    auth_token = raw_token.strip() if raw_token and raw_token.strip() else None
    return url, auth_token


def _patch_libsql_http_client():
    """Patches libsql_client.http.HttpClient to properly handle error responses.
    
    When Turso HTTP gateway returns 200 with an error object (e.g. {'message': '...', 'code': '...'}),
    libsql_client 0.3.1 expects a 'result' key and raises an unhandled KeyError: 'result'.
    This patch raises LibsqlError appropriately.
    """
    try:
        import libsql_client.http
        from libsql_client.client import LibsqlError

        if getattr(libsql_client.http.HttpClient, "_patched_for_turso", False):
            return

        async def safe_execute(self, stmt, args=None):
            request = {"stmt": libsql_client.http._stmt_to_proto(stmt, args)}
            response = await self._send("POST", "v1/execute", request)
            if isinstance(response, dict):
                if "message" in response:
                    raise LibsqlError(response["message"], response.get("code", "UNKNOWN"))
                if "error" in response:
                    raise LibsqlError(str(response["error"]), response.get("code", "UNKNOWN"))
            proto_res = response["result"]
            return libsql_client.http._result_set_from_proto(proto_res)

        async def safe_batch(self, stmts):
            request = {"batch": libsql_client.http._batch_to_proto(stmts)}
            response = await self._send("POST", "v1/batch", request)
            if isinstance(response, dict):
                if "message" in response:
                    raise LibsqlError(response["message"], response.get("code", "UNKNOWN"))
                if "error" in response:
                    raise LibsqlError(str(response["error"]), response.get("code", "UNKNOWN"))
            proto_res = response["result"]
            return libsql_client.http._batch_results_from_proto(proto_res, len(stmts))

        libsql_client.http.HttpClient.execute = safe_execute
        libsql_client.http.HttpClient.batch = safe_batch
        libsql_client.http.HttpClient._patched_for_turso = True
    except Exception:
        pass


class TursoCursorWrapper:
    """Wraps a libsql-client ResultSet providing sqlite3 cursor-compatible fetch and lastrowid."""
    def __init__(self, result_set=None, last_insert_rowid=None):
        self._rows = list(result_set.rows) if result_set is not None else []
        self._index = 0
        if last_insert_rowid is not None:
            self.lastrowid = last_insert_rowid
        elif result_set is not None:
            self.lastrowid = result_set.last_insert_rowid
        else:
            self.lastrowid = None

    def fetchone(self):
        if self._index < len(self._rows):
            row = self._rows[self._index]
            self._index += 1
            return row
        return None

    def fetchall(self):
        remaining = self._rows[self._index:]
        self._index = len(self._rows)
        return remaining

    def __iter__(self):
        return iter(self.fetchall())


class TursoConnectionWrapper:
    """Wraps a libsql-client ClientSync providing sqlite3-compatible execute methods."""
    def __init__(self, client):
        self.client = client
        self.row_factory = None

    def execute(self, sql: str, params=None):
        try:
            if params is not None:
                args = list(params) if isinstance(params, (list, tuple)) else params
                res = self.client.execute(sql, args)
            else:
                res = self.client.execute(sql)
            return TursoCursorWrapper(res)
        except Exception as exc:
            msg = str(exc)
            if "no such table" in msg or "syntax error" in msg:
                raise sqlite3.OperationalError(msg) from exc
            raise

    def executemany(self, sql: str, params_seq):
        last_rowid = None
        for p in params_seq:
            args = list(p) if isinstance(p, (list, tuple)) else p
            res = self.client.execute(sql, args)
            if res.last_insert_rowid is not None:
                last_rowid = res.last_insert_rowid
        return TursoCursorWrapper(last_insert_rowid=last_rowid)

    def executescript(self, sql: str):
        statements = [s.strip() for s in sql.split(";") if s.strip()]
        if statements:
            self.client.batch(statements)
        return self

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        self.client.close()


class PostgresRow(dict):
    """Provides dual key and integer-index access matching sqlite3.Row behavior."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._keys = list(self.keys())

    def __getitem__(self, item):
        if isinstance(item, int):
            return super().__getitem__(self._keys[item])
        return super().__getitem__(item)


class PostgresCursorWrapper:
    """Wraps a psycopg cursor translating SQLite ? parameter syntax and PRAGMAs."""
    def __init__(self, raw_cursor):
        self.raw_cursor = raw_cursor
        self.lastrowid = None

    def _translate_query(self, sql: str) -> str:
        trimmed = sql.strip()
        # PRAGMA statements are SQLite-specific no-ops in PostgreSQL
        if trimmed.upper().startswith("PRAGMA"):
            return ""
        # Convert SQLite ? parameter placeholders to PostgreSQL %s
        return trimmed.replace("?", "%s")

    def execute(self, sql: str, params=None):
        translated = self._translate_query(sql)
        if not translated:
            return self

        # Emulate SQLite lastrowid pattern for audit_log insertion
        is_audit_insert = "INSERT INTO audit_log" in translated and "RETURNING" not in translated.upper()
        if is_audit_insert:
            translated += " RETURNING id"

        if params is not None:
            self.raw_cursor.execute(translated, tuple(params))
        else:
            self.raw_cursor.execute(translated)

        if is_audit_insert:
            row = self.raw_cursor.fetchone()
            if row:
                self.lastrowid = row[0] if isinstance(row, (tuple, list)) else row.get("id")

        return self

    def executemany(self, sql: str, params_seq):
        translated = self._translate_query(sql)
        if not translated:
            return self
        self.raw_cursor.executemany(translated, [tuple(p) for p in params_seq])
        return self

    def fetchone(self):
        if not self.raw_cursor.description:
            return None
        row = self.raw_cursor.fetchone()
        if row is None:
            return None
        colnames = [desc[0] for desc in self.raw_cursor.description]
        return PostgresRow({colnames[i]: row[i] for i in range(len(colnames))})

    def fetchall(self):
        if not self.raw_cursor.description:
            return []
        rows = self.raw_cursor.fetchall()
        colnames = [desc[0] for desc in self.raw_cursor.description]
        return [PostgresRow({colnames[i]: r[i] for i in range(len(colnames))}) for r in rows]

    def __iter__(self):
        return iter(self.fetchall())


class PostgresConnectionWrapper:
    """Wraps psycopg connection providing sqlite3-compatible interface and execute methods."""
    def __init__(self, raw_conn):
        self.raw_conn = raw_conn
        self.row_factory = None

    def execute(self, sql: str, params=None):
        cursor = PostgresCursorWrapper(self.raw_conn.cursor())
        return cursor.execute(sql, params)

    def executemany(self, sql: str, params_seq):
        cursor = PostgresCursorWrapper(self.raw_conn.cursor())
        return cursor.executemany(sql, params_seq)

    def executescript(self, sql: str):
        with self.raw_conn.cursor() as cur:
            cur.execute(sql)
        return self

    def commit(self):
        self.raw_conn.commit()

    def rollback(self):
        self.raw_conn.rollback()

    def close(self):
        self.raw_conn.close()


@contextmanager
def get_connection(db_path: Optional[Path] = None):
    if db_path is None and os.getenv("NIYANTRAN_DB_PATH"):
        db_path = Path(os.getenv("NIYANTRAN_DB_PATH"))

    if is_turso() and db_path is None:
        import libsql_client
        _patch_libsql_http_client()
        url, auth_token = get_turso_config()
        client = libsql_client.create_client_sync(url=url, auth_token=auth_token)
        conn = TursoConnectionWrapper(client)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    elif is_postgres() and db_path is None:
        import psycopg
        db_url = os.getenv("DATABASE_URL", "").strip()
        if db_url.startswith("postgres://"):
            db_url = "postgresql://" + db_url[len("postgres://"):]
        raw_conn = psycopg.connect(db_url)
        conn = PostgresConnectionWrapper(raw_conn)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
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


def migrate_schema(conn):
    """Safely apply incremental schema migrations without data loss."""
    if is_postgres():
        cols = [r[0] for r in conn.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'applications'").fetchall()]
    else:
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
    if is_turso() and db_path is None:
        with get_connection() as conn:
            conn.executescript(SCHEMA)
            conn.commit()
            migrate_schema(conn)
            seed_default_users(conn)
        return "turso"
    if is_postgres() and db_path is None:
        schema_path = BASE_DIR / "scripts" / "schema_postgres.sql"
        if schema_path.exists():
            with open(schema_path, "r", encoding="utf-8") as f:
                schema_sql = f.read()
        else:
            schema_sql = SCHEMA
        with get_connection() as conn:
            conn.executescript(schema_sql)
            conn.commit()
            migrate_schema(conn)
            seed_default_users(conn)
        return "postgresql"
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
