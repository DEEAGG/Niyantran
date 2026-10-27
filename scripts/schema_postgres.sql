-- NIYANTRAN — Canonical PostgreSQL Schema (Neon PostgreSQL Compatible)
-- Preserves complete table structure, foreign keys, and indexes from SQLite

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'institution_user',
    institution_name TEXT,
    institution_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    application_type TEXT NOT NULL,
    applicant_name TEXT,
    institution_name TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    user_id TEXT,
    institution_id TEXT
);

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES applications(id),
    document_type TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    mime_type TEXT,
    sha256 TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    page_count INTEGER,
    uploaded_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    processing_status TEXT NOT NULL DEFAULT 'uploaded'
);

CREATE TABLE IF NOT EXISTS extraction_runs (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    run_number INTEGER NOT NULL,
    method TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS extracted_fields (
    id TEXT PRIMARY KEY,
    extraction_run_id TEXT NOT NULL REFERENCES extraction_runs(id),
    field_name TEXT NOT NULL,
    field_value TEXT,
    normalized_value TEXT,
    confidence REAL,
    page_number INTEGER,
    bbox_json TEXT,
    extraction_method TEXT,
    confirmed INTEGER NOT NULL DEFAULT 0,
    confirmed_by TEXT,
    confirmed_at TEXT
);

CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    rule_key TEXT NOT NULL,
    version INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    parameters_json TEXT NOT NULL,
    application_type TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    source_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
    created_at TEXT NOT NULL,
    UNIQUE(rule_key, version)
);

CREATE TABLE IF NOT EXISTS rule_sources (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL REFERENCES rules(id),
    official_source_name TEXT,
    official_source_url TEXT,
    clause_reference TEXT,
    page_reference TEXT,
    application_type TEXT,
    effective_date TEXT,
    verification_status TEXT NOT NULL DEFAULT 'unverified',
    reviewer_name TEXT,
    reviewed_at TEXT,
    review_notes TEXT,
    test_cases_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rulesets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    activated_at TEXT,
    UNIQUE(name, version)
);

CREATE TABLE IF NOT EXISTS ruleset_rules (
    ruleset_id TEXT NOT NULL REFERENCES rulesets(id),
    rule_id TEXT NOT NULL REFERENCES rules(id),
    PRIMARY KEY(ruleset_id, rule_id)
);

CREATE TABLE IF NOT EXISTS rule_proposals (
    id TEXT PRIMARY KEY,
    proposed_rule_json TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    proposed_by TEXT,
    reviewed_by TEXT,
    created_at TEXT NOT NULL,
    reviewed_at TEXT,
    review_notes TEXT
);

CREATE TABLE IF NOT EXISTS validation_runs (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES applications(id),
    ruleset_id TEXT REFERENCES rulesets(id),
    status TEXT NOT NULL,
    input_fingerprint TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    summary_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY,
    validation_run_id TEXT NOT NULL REFERENCES validation_runs(id),
    rule_id TEXT REFERENCES rules(id),
    code TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    evidence_json TEXT NOT NULL DEFAULT '{}',
    recommendation TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL REFERENCES findings(id),
    decision TEXT NOT NULL,
    reason TEXT,
    actor TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS authenticity_signals (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    signal_type TEXT NOT NULL,
    result TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manual_verifications (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    verification_type TEXT NOT NULL,
    result TEXT NOT NULL,
    verifier TEXT NOT NULL,
    evidence_reference TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS replays (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES applications(id),
    previous_validation_run_id TEXT REFERENCES validation_runs(id),
    new_validation_run_id TEXT REFERENCES validation_runs(id),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS replay_diffs (
    id TEXT PRIMARY KEY,
    replay_id TEXT NOT NULL REFERENCES replays(id),
    finding_id TEXT REFERENCES findings(id),
    diff_type TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    explanation TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    event_json TEXT NOT NULL DEFAULT '{}',
    previous_hash TEXT,
    entry_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
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

-- Performance and Scrutiny Indexes
CREATE INDEX IF NOT EXISTS idx_documents_application ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_fields_run ON extracted_fields(extraction_run_id);
CREATE INDEX IF NOT EXISTS idx_validation_application ON validation_runs(application_id);
CREATE INDEX IF NOT EXISTS idx_findings_run ON findings(validation_run_id);
CREATE INDEX IF NOT EXISTS idx_rule_sources_rule ON rule_sources(rule_id);
CREATE INDEX IF NOT EXISTS idx_reg_clauses_source ON regulatory_clauses(source_id);
CREATE INDEX IF NOT EXISTS idx_reg_clauses_page ON regulatory_clauses(source_id, page_number);
CREATE INDEX IF NOT EXISTS idx_reg_sources_status ON regulatory_sources(processing_status, verification_status);
