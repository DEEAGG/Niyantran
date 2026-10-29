"""
Tests for Niyantran Regulatory Compliance Reports, PDF Dossier Generation, and Step 4 Decision Adjudication
"""
import json
import uuid
import pytest
import pymupdf as fitz
from fastapi.testclient import TestClient
from app.main import app
from app.pdf_generator import generate_dossier_pdf
from app.auth import create_access_token
from app.db import get_connection

client = TestClient(app)


def create_test_user_and_app(institution_name="Alpha Engineering Institute"):
    uid = f"USR-{uuid.uuid4().hex[:8].upper()}"
    email = f"user_{uuid.uuid4().hex[:6]}@alpha.edu"
    app_id = f"APP-{uuid.uuid4().hex[:8].upper()}"
    now = "2026-10-29T12:00:00Z"

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO users (id, email, password_hash, full_name, institution_id, role, is_active, created_at, updated_at)
            VALUES (?, ?, 'hash123', 'Dean Alpha', ?, 'institution_user', 1, ?, ?)
            """,
            (uid, email, uid, now, now),
        )
        conn.execute(
            """
            INSERT INTO applications (id, user_id, institution_name, applicant_name, application_type, status, created_at, updated_at)
            VALUES (?, ?, ?, 'Dean Alpha', 'Technical Approval', 'submitted', ?, ?)
            """,
            (app_id, uid, institution_name, now, now),
        )
        # Create a document
        doc_id = f"DOC-{uuid.uuid4().hex[:8].upper()}"
        conn.execute(
            """
            INSERT INTO documents (id, application_id, document_type, original_filename, stored_path, sha256, file_size, page_count, processing_status, uploaded_at)
            VALUES (?, ?, 'Land Ownership Deed', 'land_title_deed.pdf', 'documents/test.pdf', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 102400, 5, 'completed', ?)
            """,
            (doc_id, app_id, now),
        )
        rs_row = conn.execute("SELECT id FROM rulesets LIMIT 1").fetchone()
        ruleset_id = rs_row[0] if rs_row else None

        rule_row = conn.execute("SELECT id FROM rules LIMIT 1").fetchone()
        rule_id = rule_row[0] if rule_row else None

        # Create validation run & finding
        run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"
        conn.execute(
            """
            INSERT INTO validation_runs (id, application_id, ruleset_id, status, input_fingerprint, started_at, completed_at, summary_json)
            VALUES (?, ?, ?, 'completed', 'fp123', ?, ?, ?)
            """,
            (run_id, app_id, ruleset_id, now, now, json.dumps({"pass": 1, "fail": 1, "unverified": 0})),
        )
        finding_id = f"FND-{uuid.uuid4().hex[:8].upper()}"
        conn.execute(
            """
            INSERT INTO findings (id, validation_run_id, rule_id, code, severity, status, message, evidence_json, recommendation, created_at)
            VALUES (?, ?, ?, 'LAND_DEFICIT', 'critical', 'fail', 'Land area of 2.5 acres is below required 5.0 acres', '{}', 'Submit revenue survey plan', ?)
            """,
            (finding_id, run_id, rule_id, now),
        )

    token = create_access_token(
        user_id=uid,
        email=email,
        role="institution_user",
        full_name="Dean Alpha",
        institution_name=institution_name,
    )
    return {
        "user_id": uid,
        "email": email,
        "token": token,
        "app_id": app_id,
        "finding_id": finding_id,
        "institution_name": institution_name,
    }


def test_generate_dossier_pdf_magic_bytes_and_text():
    context = {
        "application": {
            "id": "APP-REG-999",
            "institution_name": "Indian Institute of Science & Technology",
            "application_type": "Extension of Approval (EoA)",
            "status": "submitted",
        },
        "documents": [
            {
                "document_type": "Land Title Deed",
                "original_filename": "land_deed_2026.pdf",
                "sha256": "70f3f20f0f32997e5550a6da9b5ddf9076cf2377b752fe685161cf2ba4db2ce9",
                "page_count": 8,
            }
        ],
        "findings": [
            {
                "code": "LAND_DEFICIT",
                "rule_title": "Minimum Land Area Norm",
                "severity": "Critical",
                "status": "fail",
                "rawStatus": "fail",
                "message": "Deficit of 1.2 acres against statutory requirement",
                "decision": {
                    "decision": "resolved",
                    "reason": "Exemption granted under State Industrial Policy",
                    "actor": "Dr. Sharma",
                },
            }
        ],
        "fields": [
            {
                "field_name": "Built-up Area",
                "field_value": "12,500 sq.m",
                "page_number": 2,
            }
        ],
        "audit_chain": {
            "valid": True,
            "total_records": 13147,
            "latest_hash": "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
        },
    }

    pdf_bytes = generate_dossier_pdf(context)

    # Magic Bytes & Content-Length Check
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 5000, "PDF must not be empty or trivial in size"
    assert pdf_bytes.startswith(b"%PDF-"), "Must start with standard PDF magic bytes '%PDF-'"

    # Extract text from PDF using PyMuPDF to assert real content is present
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    assert len(doc) >= 1, "Must contain at least 1 page"

    full_text = "".join(page.get_text() for page in doc)
    assert "NIYANTRAN" in full_text
    assert "APP-REG-999" in full_text
    assert "INDIAN INSTITUTE OF SCIENCE" in full_text.upper()
    assert "LAND_DEFICIT" in full_text
    assert "MINIMUM LAND AREA NORM" in full_text.upper()
    assert "RESOLVED" in full_text.upper()
    assert "13,147" in full_text
    doc.close()


def test_report_endpoint_pdf_headers_and_security():
    setup = create_test_user_and_app("St. Xavier Technical Campus")
    app_id = setup["app_id"]
    token = setup["token"]

    # 1. Invalid token must return 401
    bad_token_res = client.get(
        f"/api/applications/{app_id}/report?format=pdf",
        headers={"Authorization": "Bearer invalid_malformed_token_xyz"},
    )
    assert bad_token_res.status_code == 401

    # In production mode (ALLOW_DEV_HEADERS = False), missing token must return 401
    import app.auth as auth_mod
    orig_allow = auth_mod.ALLOW_DEV_HEADERS
    orig_prod = auth_mod.IS_PRODUCTION
    try:
        auth_mod.ALLOW_DEV_HEADERS = False
        auth_mod.IS_PRODUCTION = True
        unauth_res = client.get(f"/api/applications/{app_id}/report?format=pdf")
        assert unauth_res.status_code == 401
    finally:
        auth_mod.ALLOW_DEV_HEADERS = orig_allow
        auth_mod.IS_PRODUCTION = orig_prod

    # 2. Authenticated Bearer header request returning inline PDF
    auth_res = client.get(
        f"/api/applications/{app_id}/report?format=pdf",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert auth_res.status_code == 200
    assert auth_res.headers["content-type"] == "application/pdf"
    assert "inline" in auth_res.headers["content-disposition"]
    assert f"Niyantran_Dossier_{app_id}.pdf" in auth_res.headers["content-disposition"]
    assert "no-store" in auth_res.headers.get("cache-control", "")
    assert auth_res.content.startswith(b"%PDF-")

    # 3. Dedicated /dossier.pdf endpoint
    dossier_res = client.get(
        f"/api/applications/{app_id}/dossier.pdf",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dossier_res.status_code == 200
    assert dossier_res.headers["content-type"] == "application/pdf"
    assert dossier_res.content.startswith(b"%PDF-")

    # 4. Authenticated via token query param
    query_token_res = client.get(f"/api/applications/{app_id}/dossier.pdf?token={token}")
    assert query_token_res.status_code == 200
    assert query_token_res.content.startswith(b"%PDF-")


def test_report_endpoint_tenant_isolation():
    tenant_a = create_test_user_and_app("Institute A")
    tenant_b = create_test_user_and_app("Institute B")

    # Tenant B tries to fetch Tenant A's dossier PDF -> Must be rejected (403 Forbidden)
    res = client.get(
        f"/api/applications/{tenant_a['app_id']}/dossier.pdf",
        headers={"Authorization": f"Bearer {tenant_b['token']}"},
    )
    assert res.status_code == 403, "Cross-tenant dossier access must be blocked with HTTP 403"


def test_confirm_decision_workflow_and_persistence():
    setup = create_test_user_and_app("Apex Institute of Technology")
    finding_id = setup["finding_id"]
    token = setup["token"]

    # 1. Reject invalid decision with 422
    inv_res = client.post(
        f"/api/findings/{finding_id}/decision",
        json={"decision": "invalid_action", "reason": "Testing invalid"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert inv_res.status_code == 422

    # 2. Record valid decision: "Accepted" -> resolved
    res = client.post(
        f"/api/findings/{finding_id}/decision",
        json={
            "action": "Accepted",
            "reviewerNotes": "Verified against state approval gazette notification.",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["decision"] == "resolved"
    assert data["finding_id"] == finding_id
    assert "DEC-" in data["id"]

    # 3. Verify persistence: GET /api/findings/{finding_id} returns updated decision
    get_res = client.get(
        f"/api/findings/{finding_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 200
    finding_data = get_res.json()
    assert finding_data["decision"] is not None
    assert finding_data["decision"]["decision"] == "resolved"
    assert finding_data["decision"]["reason"] == "Verified against state approval gazette notification."

    # 4. Another tenant cannot submit decision on this finding (403)
    tenant_c = create_test_user_and_app("Institute C")
    cross_res = client.post(
        f"/api/findings/{finding_id}/decision",
        json={"action": "Accepted", "notes": "Hacker attempt"},
        headers={"Authorization": f"Bearer {tenant_c['token']}"},
    )
    assert cross_res.status_code == 403
