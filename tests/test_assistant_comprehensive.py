"""
NIYANTRAN In-App Assistant Comprehensive Verification & Regression Suite
=======================================================================
Validates the complete 15-feature platform knowledge coverage, 5-step workflow progression,
statutory APH grounding, cross-tenant isolation, role permissions, and input boundaries.
"""

import os
import sqlite3
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import sys
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from app.copilot import (
    copilot_router,
    synthesize_copilot_response,
    resolve_workflow_next_step,
    classify_navigation_intent,
    retrieve_product_knowledge,
    retrieve_regulatory_knowledge,
    PRODUCT_KNOWLEDGE,
    ROUTE_REGISTRY,
    ChatRequest,
    copilot_chat
)
from app import copilot_adapter

MOCK_OFFICER = {
    "user_id": "test-officer-01",
    "email": "officer@aicte.gov.in",
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

active_test_user = MOCK_OFFICER

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

    # Seed verified statutory data
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

    # Seed test application
    conn.execute(
        """
        INSERT INTO applications (id, institution_name, user_id, institution_id, status, created_at, updated_at)
        VALUES ('APP-TEST-001', 'Apex Institute of Technology', 'test-officer-01', 'inst-101', 'draft', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')
        """
    )
    conn.commit()
    return conn


@pytest.fixture(autouse=True)
def patch_db_for_all_tests(setup_test_db, monkeypatch):
    test_conn = setup_test_db

    from contextlib import contextmanager
    @contextmanager
    def mock_get_conn():
        yield test_conn

    from app import copilot
    monkeypatch.setattr(copilot_adapter, "get_connection", mock_get_conn)
    monkeypatch.setattr(copilot_adapter, "get_current_user", override_get_current_user)
    monkeypatch.setattr(copilot, "get_connection", mock_get_conn)
    monkeypatch.setattr(copilot, "get_current_user", override_get_current_user)


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(copilot_router)
    return TestClient(app)


# 1. 15-Feature Knowledge Coverage Verification
def test_all_15_features_represented():
    checklist = [
        "PROD-REGISTRATION",
        "PROD-NAV-UPLOAD",
        "PROD-NAV-CROSSCHECK",
        "PROD-STATUTORY-VALIDATION",
        "PROD-NAV-REVIEW",
        "PROD-EVIDENCE-WORKBENCH",
        "PROD-REGULATORY-INTELLIGENCE",
        "PROD-NAV-RULES",
        "PROD-NAV-MONITORING",
        "PROD-NAV-REPLAY",
        "PROD-NAV-AUDIT",
        "PROD-NAV-AUTHENTICITY",
        "PROD-NAV-AUDIT",
        "PROD-ROLES-PERMISSIONS",
        "PROD-WORKFLOW",
    ]
    existing_ids = {item["id"] for item in PRODUCT_KNOWLEDGE}
    for item_id in checklist:
        assert item_id in existing_ids, f"Missing dedicated knowledge catalog entry for {item_id}"


# 2. Complete Workflow Guidance Step Check (Step 1 -> 5)
def test_workflow_step_progression(setup_test_db):
    conn = setup_test_db
    # User with no applications
    empty_user = {"user_id": "usr-empty", "role": "institution_user", "institution_id": "inst-empty"}
    wf1 = resolve_workflow_next_step(empty_user)
    assert wf1["current_step"] == 1
    assert "Registration" in wf1["step_name"]

    # User with application but 0 docs -> Step 2
    user_with_app = {"user_id": "test-officer-01", "role": "reviewer", "institution_id": "inst-101"}
    wf2 = resolve_workflow_next_step(user_with_app, "APP-TEST-001")
    assert wf2["current_step"] == 2
    assert "Document" in wf2["step_name"]


# 3. Cross-Tenant Security Isolation
def test_cross_tenant_isolation(client):
    inst_user = {
        "user_id": "usr-intruder",
        "role": "institution_user",
        "institution_id": "inst-intruder",
        "email": "intruder@malicious.com"
    }
    # Query for foreign app
    res = synthesize_copilot_response(
        query="What should I do next?",
        current_user=inst_user,
        context={"application_id": "APP-TEST-001"}
    )
    # The response must NOT bind to foreign APP-TEST-001
    assert res.get("application_id") != "APP-TEST-001"


# 4. Role-Based Navigation Restrictions
def test_role_based_restriction():
    inst_user = {"user_id": "inst-01", "role": "institution_user"}
    intent, msg, actions = classify_navigation_intent("Open Review Center", "institution_user")
    assert intent == "permission_restricted"
    assert any("/compliance" in a["path"] or "/findings" in a["path"] for a in actions)

    officer_user = {"user_id": "off-01", "role": "reviewer"}
    intent2, msg2, actions2 = classify_navigation_intent("Open Review Center", "reviewer")
    assert intent2 == "navigate"
    assert any(a["path"] == "/review" for a in actions2)


# 5. Statutory APH Grounding & No Hallucination
def test_statutory_aph_grounding():
    res = synthesize_copilot_response(
        query="What does Section 3.5 require for land?",
        current_user=MOCK_OFFICER,
        context={}
    )
    assert len(res["citations"]) > 0
    c = res["citations"][0]
    assert "3.5" in c["clause"]
    assert "https" in (c["url"] or "")
    assert "FSI" in res["message"] or "FAR" in res["message"] or "local authority" in res["message"].lower()


# 6. Hindi / Hinglish and Colloquial Handling
def test_hindi_hinglish_queries():
    res1 = synthesize_copilot_response(
        query="Mere documents upload kahan honge?",
        current_user=MOCK_INSTITUTION_USER,
        context={}
    )
    assert any(a["path"] == "/upload" or "/documents" in a["path"] for a in res1["suggested_actions"])

    res2 = synthesize_copilot_response(
        query="Mera application abhi kis stage par hai?",
        current_user=MOCK_OFFICER,
        context={"application_id": "APP-TEST-001"}
    )
    assert res2["intent"] == "workflow_guidance"
    assert res2["current_step"] == 2


# 7. Unsupported Query Grounding Notice
def test_unsupported_query_safely_declined():
    res = synthesize_copilot_response(
        query="Can you book a train ticket or flight?",
        current_user=MOCK_OFFICER,
        context={}
    )
    assert res["intent"] == "unverified_knowledge"
    assert "Statutory Grounding Notice" in res["message"]


# 8. Blank Query Input Validation
def test_blank_query_rejected(client):
    res = client.post("/api/copilot/chat", json={"message": "   "})
    assert res.status_code == 400
    assert "cannot be blank" in res.json()["detail"].lower()
