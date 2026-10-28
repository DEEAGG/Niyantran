"""
Comprehensive Production Readiness and Security Test Suite for NIYANTRAN.

Validates:
1. Standards-based OAuth2 / OIDC token issuance, /api/auth/me, and OIDC discovery config.
2. Production mode identity spoofing prevention (disabling development headers in production).
3. Role-Based Access Control (RBAC) enforcement across sensitive endpoints.
4. Missing regulatory source audit (verifying authentic ingested sources and access blocker documentation).
5. Regulatory review queue activation guards (unreviewed clauses cannot be activated without human review).
6. Document privacy and upload validation.
7. Cryptographic SHA-256 audit ledger chain integrity.
"""

import os
import io
import fitz
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import get_connection, verify_audit_chain
from app.auth import create_access_token, decode_access_token, ROLE_PERMISSIONS
import app.auth as auth_module

client = TestClient(app)


def test_oauth2_token_issuance_and_auth_profile():
    """Validates standards-based OAuth2 institutional token issuance and profile retrieval."""
    # 1. Request access token for an authorized reviewer
    login_res = client.post(
        "/api/auth/token",
        json={
            "username": "compliance.officer@aicte-india.org",
            "role": "reviewer",
            "institution_id": "AICTE-RO-NORTH",
        },
    )
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "reviewer"
    assert "clauses:review" in data["permissions"]

    token = data["access_token"]

    # 2. Inspect authenticated user profile via /api/auth/me
    me_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    profile = me_res.json()
    assert profile["email"] == "compliance.officer@aicte-india.org"
    assert profile["role"] == "reviewer"
    assert profile["is_authenticated"] is True

    # 3. Check OIDC institutional discovery configuration
    oidc_res = client.get("/api/auth/oidc/config")
    assert oidc_res.status_code == 200
    oidc_data = oidc_res.json()
    assert "issuer" in oidc_data
    assert "authorization_endpoint" in oidc_data
    assert "admin" in oidc_data["supported_roles"]


def test_production_header_spoofing_prevention():
    """
    Validates that when ALLOW_DEV_HEADERS is False (production mode),
    development-header identity spoofing is strictly rejected with HTTP 401.
    """
    orig_allow = auth_module.ALLOW_DEV_HEADERS
    orig_prod = auth_module.IS_PRODUCTION
    try:
        # Simulate production mode
        auth_module.ALLOW_DEV_HEADERS = False
        auth_module.IS_PRODUCTION = True

        # Header spoofing attempt without Bearer token must fail with 401 Unauthorized
        spoof_res = client.get(
            "/api/auth/me",
            headers={"X-Actor-Role": "admin", "X-Actor-Email": "fake.admin@spoofed.gov"},
        )
        assert spoof_res.status_code == 401
        assert "Development header spoofing is disabled in production" in spoof_res.json()["detail"]

        # Valid signed JWT token must succeed in production mode
        valid_token = create_access_token("USR-PROD-01", "genuine.officer@aicte.gov.in", "reviewer")
        prod_res = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        assert prod_res.status_code == 200
        assert prod_res.json()["email"] == "genuine.officer@aicte.gov.in"

    finally:
        auth_module.ALLOW_DEV_HEADERS = orig_allow
        auth_module.IS_PRODUCTION = orig_prod


def test_rbac_and_unauthorized_access_enforcement():
    """
    Validates that unauthorized and guest access is rejected with HTTP 403 Forbidden
    across sensitive operational endpoints.
    """
    # 1. Document download endpoint
    doc_res = client.get(
        "/api/documents/DOC-TEST-NONEXISTENT",
        headers={"X-Actor-Role": "guest"},
    )
    assert doc_res.status_code == 403

    # 2. Document authenticity endpoint
    auth_res = client.get(
        "/api/documents/DOC-TEST-NONEXISTENT/authenticity",
        headers={"Authorization": "Bearer unauthorized"},
    )
    assert auth_res.status_code == 403

    # 3. Ruleset activation
    act_res = client.post(
        "/api/rulesets/RSET-TEST-NONEXISTENT/activate",
        headers={"X-Actor-Role": "guest"},
    )
    assert act_res.status_code == 403

    # 4. Source supersession
    sup_res = client.post(
        "/api/regulatory/sources/SRC-NONEXISTENT/supersede",
        json={"superseded_by_id": "SRC-NEW"},
        headers={"X-Actor-Role": "unauthorized"},
    )
    assert sup_res.status_code == 403


def test_missing_regulatory_source_audit_and_blockers():
    """
    Validates that the 5 missing regulatory sources have been audited:
    - 3 legitimately accessible instruments are imported with verbatim clauses and verified SHA-256.
    - 2 restricted sources (NBC 2016 Part 4 and State Fire Service Acts) document their exact legal/access blockers.
    """
    with get_connection() as conn:
        # Source 1: AICTE Faculty Cadre Norms (1:2:6 Ratio & 7th CPC)
        cadre_src = conn.execute("SELECT * FROM regulatory_sources WHERE id = 'SRC-AICTE-REG-2019-CADRE'").fetchone()
        assert cadre_src is not None
        assert cadre_src["processing_status"] == "processed"
        assert "7th CPC" in cadre_src["source_title"] or "Cadre Ratio" in cadre_src["source_title"]

        # Check cadre clauses
        cadre_clauses = conn.execute(
            "SELECT * FROM regulatory_clauses WHERE source_id = 'SRC-AICTE-REG-2019-CADRE'"
        ).fetchall()
        assert len(cadre_clauses) > 0
        clause_texts = " ".join([c["verbatim_text"] for c in cadre_clauses])
        assert "1 : 2 : 6" in clause_texts or "1:2:6" in clause_texts
        assert "7th CPC" in clause_texts or "Level 10" in clause_texts

        # Source 2: AICTE ODL & Online Learning Regulations 2024-25
        odl_src = conn.execute("SELECT * FROM regulatory_sources WHERE id = 'SRC-AICTE-REG-2024-ODL'").fetchone()
        assert odl_src is not None
        assert odl_src["processing_status"] == "processed"
        odl_clauses = conn.execute(
            "SELECT * FROM regulatory_clauses WHERE source_id = 'SRC-AICTE-REG-2024-ODL'"
        ).fetchall()
        assert len(odl_clauses) > 0
        odl_texts = " ".join([c["verbatim_text"] for c in odl_clauses])
        assert "Open and Distance Learning" in odl_texts or "ODL" in odl_texts
        assert "Prohibition" in odl_texts or "prohibited" in odl_texts.lower()

        # Source 3: National Fee Committee Guidelines (Justice B.N. Srikrishna Report)
        fee_src = conn.execute("SELECT * FROM regulatory_sources WHERE id = 'SRC-AICTE-GUD-2022-FEE'").fetchone()
        assert fee_src is not None
        assert fee_src["processing_status"] == "processed"
        fee_clauses = conn.execute(
            "SELECT * FROM regulatory_clauses WHERE source_id = 'SRC-AICTE-GUD-2022-FEE'"
        ).fetchall()
        assert len(fee_clauses) > 0
        fee_texts = " ".join([c["verbatim_text"] for c in fee_clauses])
        assert "1,89,800" in fee_texts
        assert "79,600" in fee_texts

        # Source 4: National Building Code 2016 Part 4 (Restricted Standard Record)
        nbc_src = conn.execute("SELECT * FROM regulatory_sources WHERE id = 'SRC-BIS-NBC-2016-PART4'").fetchone()
        assert nbc_src is not None
        assert nbc_src["processing_status"] == "manual_import_required"
        assert "Bureau of Indian Standards" in nbc_src["issuing_authority"]
        assert "ACCESS BLOCKER" in nbc_src["review_notes"]
        assert "Copyright Act" in nbc_src["review_notes"]

        # Source 5: State Fire Service Acts (Decentralized Regional Jurisdiction Record)
        state_fire = conn.execute("SELECT * FROM regulatory_sources WHERE id = 'SRC-STATE-FIRE-ACTS'").fetchone()
        assert state_fire is not None
        assert state_fire["processing_status"] == "manual_import_required"
        assert "ACCESS BLOCKER" in state_fire["review_notes"]
        assert "decentralized" in state_fire["review_notes"].lower()


def test_unreviewed_clause_activation_guard():
    """
    Validates that an unreviewed clause CANNOT be activated for the compliance engine,
    and that formal authorized human review is strictly required before activation.
    """
    with get_connection() as conn:
        # Find an unverified clause
        unver_row = conn.execute(
            "SELECT * FROM regulatory_clauses WHERE verification_status = 'unverified' LIMIT 1"
        ).fetchone()
        assert unver_row is not None
        target_clause_id = unver_row["id"]

    # 1. Attempt to activate unreviewed clause -> Must fail with HTTP 400 Bad Request
    fail_act = client.post(
        f"/api/regulatory/clauses/{target_clause_id}/activate",
        headers={"X-Actor-Role": "reviewer"},
    )
    assert fail_act.status_code == 400
    assert "Formal human review and 'verified' status required" in fail_act.json()["detail"]

    # 2. Review and verify the clause using an authorized reviewer
    review_res = client.post(
        f"/api/regulatory/clauses/{target_clause_id}/review",
        json={
            "status": "verified",
            "reviewer_name": "Dr. S. K. Verma (AICTE Legal Cell)",
            "notes": "Verified against Gazette of India Extraordinary Notification. Clause text authenticated.",
        },
        headers={"X-Actor-Role": "reviewer"},
    )
    assert review_res.status_code == 200
    assert review_res.json()["verification_status"] == "verified"

    # 3. Now activate the verified clause -> Must succeed with HTTP 200
    success_act = client.post(
        f"/api/regulatory/clauses/{target_clause_id}/activate",
        headers={"X-Actor-Role": "reviewer"},
    )
    assert success_act.status_code == 200
    act_data = success_act.json()
    assert act_data["status"] == "activated"
    assert act_data["id"] == target_clause_id


def test_cryptographic_audit_ledger_integrity():
    """Validates that the SQLite cryptographic SHA-256 audit ledger is unbroken and tamper-evident."""
    audit_res = client.get("/api/audit/verify")
    assert audit_res.status_code == 200
    data = audit_res.json()
    assert data["verified"] is True
    assert data["total_records"] > 1000

    # Also directly verify via db function
    with get_connection() as conn:
        chain_res = verify_audit_chain(conn)
        assert chain_res["verified"] is True
        assert chain_res["total_records"] > 1000


def test_production_jwt_secret_required():
    """Validates that production mode fails safely with RuntimeError if JWT_SECRET_KEY is missing or placeholder."""
    orig_env = os.environ.get("NIYANTRAN_ENV")
    orig_key = os.environ.get("JWT_SECRET_KEY")
    try:
        os.environ["NIYANTRAN_ENV"] = "production"
        if "JWT_SECRET_KEY" in os.environ:
            del os.environ["JWT_SECRET_KEY"]

        with pytest.raises(RuntimeError, match="JWT_SECRET_KEY environment variable is required in production mode"):
            import importlib
            importlib.reload(auth_module)
    finally:
        if orig_env is not None:
            os.environ["NIYANTRAN_ENV"] = orig_env
        else:
            os.environ.pop("NIYANTRAN_ENV", None)
        if orig_key is not None:
            os.environ["JWT_SECRET_KEY"] = orig_key
        else:
            os.environ.pop("JWT_SECRET_KEY", None)
        import importlib
        importlib.reload(auth_module)


def test_scanned_pdf_ocr_failure_reported_explicitly(monkeypatch, tmp_path):
    """
    Validates that if a scanned PDF (no digital text) undergoes extraction when
    the OCR engine (Tesseract) is unavailable, an explicit failure is raised
    and never reported as a successful extraction with 0 fields.
    """
    from app.extractor import extract_document_fields

    scanned_pdf_path = tmp_path / "scanned_doc.pdf"
    doc = fitz.open()
    doc.new_page(width=595, height=842)
    doc.save(str(scanned_pdf_path))
    doc.close()

    def mock_extract_from_image(img, page_num=1):
        raise RuntimeError("Tesseract binary not found in PATH")

    monkeypatch.setattr("app.extractor.extract_from_image", mock_extract_from_image)

    with pytest.raises(RuntimeError) as exc_info:
        extract_document_fields(scanned_pdf_path)

    assert "OCR engine (Tesseract) is unavailable" in str(exc_info.value)


def test_direct_extract_scanned_pdf_ocr_unavailable(monkeypatch):
    """Verifies that POST /api/documents/extract returns HTTP 503 when a scanned PDF requires OCR but Tesseract fails."""
    doc = fitz.open()
    doc.new_page(width=595, height=842)
    pdf_bytes = doc.tobytes()
    doc.close()

    def mock_ocr(image):
        raise RuntimeError("tesseract binary missing")

    monkeypatch.setattr("pytesseract.image_to_string", mock_ocr)

    res = client.post(
        "/api/documents/extract",
        files={"file": ("scanned_blank.pdf", pdf_bytes, "application/pdf")},
    )
    assert res.status_code == 503
    assert "OCR engine (Tesseract) is unavailable" in res.json()["detail"]


def test_vercel_configuration_routing():
    """Validates that vercel.json and frontend/vercel.json route API requests to FastAPI and SPA routes to index.html."""
    import json
    from pathlib import Path

    root_dir = Path(__file__).resolve().parent.parent

    # 1. Backend Vercel project configuration
    backend_vercel = root_dir / "vercel.json"
    assert backend_vercel.exists(), "vercel.json must exist in project root"
    with open(backend_vercel, "r", encoding="utf-8") as f:
        backend_config = json.load(f)
    assert backend_config.get("version") == 2

    # Verify serverless entrypoint exists and exports app
    api_entry = root_dir / "api" / "index.py"
    assert api_entry.exists(), "api/index.py must exist"
    from api.index import app as vercel_app
    assert vercel_app is not None

    # 2. Frontend Vercel project configuration
    frontend_vercel = root_dir / "frontend" / "vercel.json"
    assert frontend_vercel.exists(), "frontend/vercel.json must exist"
    with open(frontend_vercel, "r", encoding="utf-8") as f:
        frontend_config = json.load(f)

    assert frontend_config.get("outputDirectory") == "dist"
    rewrites = frontend_config.get("rewrites", [])
    rewrite_map = {r["source"]: r["destination"] for r in rewrites}

    assert "/api" in rewrite_map, "/api rewrite must exist in frontend/vercel.json"
    assert "/api/(.*)" in rewrite_map, "/api/(.*) rewrite must exist in frontend/vercel.json"
    assert rewrite_map.get("/(.*)") == "/index.html", "/(.*) must rewrite to /index.html for SPA"



