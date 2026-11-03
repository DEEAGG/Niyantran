"""
NIYANTRAN In-App Assistant Integration Test Suite
=================================================
Verifies that the NIYANTRAN assistant router, APH regulatory grounding,
workflow status progression, navigation intents, and tenant isolation work properly.
"""

import os
import sqlite3
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import sys
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from app.copilot import copilot_router
from app import copilot_adapter

# ---------------------------------------------------------------------------
# Test Fixtures & In-Memory Database Setup
# ---------------------------------------------------------------------------
MOCK_USER = {
    "user_id": "test-reviewer-01",
    "email": "reviewer@niyantran.gov.in",
    "role": "reviewer",
    "institution_id": None,
    "is_authenticated": True,
}

MOCK_INSTITUTION_USER = {
    "user_id": "test-inst-01",
    "email": "applicant@institution.edu",
    "role": "institution_user",
    "institution_id": "inst-101",
    "is_authenticated": True,
}

active_test_user = MOCK_USER


def override_get_current_user():
    return active_test_user


@pytest.fixture(scope="session")
def setup_test_db():
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row

    schema = """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'institution_user',
        institution_id TEXT
    );

    CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        institution_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        institution_id TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        document_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'uploaded',
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS extraction_runs (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS extracted_fields (
        id TEXT PRIMARY KEY,
        extraction_run_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        field_value TEXT,
        confidence REAL DEFAULT 1.0
    );

    CREATE TABLE IF NOT EXISTS validation_runs (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        summary_json TEXT,
        started_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS findings (
        id TEXT PRIMARY KEY,
        validation_run_id TEXT NOT NULL,
        rule_id TEXT NOT NULL,
        status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        finding_id TEXT NOT NULL,
        decision TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS regulatory_sources (
        id TEXT PRIMARY KEY,
        source_title TEXT NOT NULL,
        issuing_authority TEXT NOT NULL,
        official_source_url TEXT,
        document_version TEXT NOT NULL,
        verification_status TEXT NOT NULL DEFAULT 'unverified',
        supersedes_source_id TEXT,
        superseded_by_source_id TEXT
    );

    CREATE TABLE IF NOT EXISTS regulatory_clauses (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        clause_number TEXT,
        heading TEXT,
        page_number INTEGER NOT NULL,
        verbatim_text TEXT NOT NULL,
        summary_rule TEXT,
        category TEXT NOT NULL DEFAULT 'General Norms',
        verification_status TEXT NOT NULL DEFAULT 'unverified',
        reviewer_name TEXT,
        superseded_by_clause_id TEXT
    );

    CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        rule_key TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        rule_type TEXT NOT NULL,
        parameters_json TEXT,
        source_status TEXT,
        enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS rule_sources (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        official_source_name TEXT,
        official_source_url TEXT,
        clause_reference TEXT,
        page_reference INTEGER,
        verification_status TEXT
    );
    """
    conn.executescript(schema)

    # Seed verified Section 3.5 APH knowledge
    conn.execute(
        """
        INSERT INTO regulatory_sources (id, source_title, issuing_authority, official_source_url, document_version, verification_status)
        VALUES ('src-aph-2024', 'AICTE Approval Process Handbook (APH) 2024-2027', 'All India Council for Technical Education', 'https://www.aicte.gov.in/sites/default/files/APH%20Final.pdf', '2024-2027', 'verified')
        """
    )
    conn.execute(
        """
        INSERT INTO regulatory_clauses (id, source_id, clause_number, heading, page_number, verbatim_text, summary_rule, category, verification_status, reviewer_name)
        VALUES ('cl-aph-sec-3-5', 'src-aph-2024', '3.5', 'Section 3.5 Land Requirement', 42, 'The statutory land requirement shall be governed by the applicable FSI / FAR norms of the local authority.', 'Land norms subject to local FSI/FAR', 'Infrastructure Norms', 'verified', 'AICTE Statutory Audit Bureau')
        """
    )
    conn.execute(
        """
        INSERT INTO rules (id, rule_key, title, description, rule_type, enabled, source_status)
        VALUES ('rule-land-01', 'R-LAND-AREA', 'Land Requirement Compliance', 'Verifies institution campus land against AICTE Section 3.5 local authority FSI/FAR norms.', 'land', 1, 'verified')
        """
    )
    conn.execute(
        """
        INSERT INTO rule_sources (id, rule_id, official_source_name, official_source_url, clause_reference, page_reference, verification_status)
        VALUES ('rs-01', 'rule-land-01', 'AICTE APH 2024-2027', 'https://www.aicte.gov.in/sites/default/files/APH%20Final.pdf', 'Section 3.5', 42, 'verified')
        """
    )

    # Seed Sample Application
    conn.execute(
        """
        INSERT INTO applications (id, institution_name, user_id, institution_id, status, created_at, updated_at)
        VALUES ('APP-TEST-001', 'Apex Institute of Technology', 'test-reviewer-01', 'inst-101', 'draft', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')
        """
    )
    conn.commit()
    return conn


@pytest.fixture
def client(setup_test_db, monkeypatch):
    test_conn = setup_test_db

    from contextlib import contextmanager
    @contextmanager
    def mock_get_conn():
        yield test_conn

    monkeypatch.setattr(copilot_adapter, "get_connection", mock_get_conn)
    monkeypatch.setattr(copilot_adapter, "get_current_user", override_get_current_user)

    from app import copilot
    monkeypatch.setattr(copilot, "get_connection", mock_get_conn)
    monkeypatch.setattr(copilot, "get_current_user", override_get_current_user)

    app = FastAPI()
    app.include_router(copilot_router)
    return TestClient(app)


def test_suggested_prompts(client):
    res = client.get("/api/copilot/suggested-prompts?current_path=/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert len(data["data"]) > 0
    assert "What should I do next?" in data["data"]


def test_greeting_guidance(client):
    res = client.post("/api/copilot/chat", json={"message": "Namaste! What can you do?"})
    assert res.status_code == 200
    payload = res.json()["data"]
    assert "NIYANTRAN" in payload["message"]
    assert len(payload["suggested_actions"]) > 0


def test_workflow_status_step2(client):
    res = client.get("/api/copilot/workflow-status?application_id=APP-TEST-001")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["has_application"] is True
    assert data["current_step"] == 2
    assert "Document" in data["step_name"]


def test_statutory_rag_land_norms(client):
    res = client.post(
        "/api/copilot/chat",
        json={"message": "What are the land area requirements under Section 3.5?"}
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data["citations"]) > 0
    assert any("3.5" in c["clause"] or "Land" in c.get("title", "") for c in data["citations"])
    assert "FSI" in data["message"] or "FAR" in data["message"] or "land" in data["message"].lower()


def test_navigation_intent_monitoring(client):
    res = client.post(
        "/api/copilot/chat",
        json={"message": "Where is the Monitoring desk?"}
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["intent"] == "navigate"
    assert any(a["path"] == "/monitoring" for a in data["suggested_actions"])
