import io
import os
import uuid
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.db import get_connection, is_turso, get_turso_config
from app.auth import decode_access_token

client = TestClient(app)


def _create_minimal_pdf_bytes():
    import pymupdf as fitz
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 100), "Confidential Institutional Document", fontsize=14)
    data = doc.tobytes()
    doc.close()
    return data


def test_registration_normalizes_email_and_hashes_password():
    raw_email = "  Principal_Alpha@College-Tech.Edu.In  "
    password = "SecureAlphaPass#2026"
    full_name = "Dr. Alpha Principal"
    inst_name = "Alpha College of Engineering"

    reg_res = client.post("/api/auth/register", json={
        "email": raw_email,
        "password": password,
        "full_name": full_name,
        "institution_name": inst_name,
    })
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert reg_data["email"] == "principal_alpha@college-tech.edu.in"
    assert "access_token" in reg_data
    assert reg_data["role"] == "institution_user"

    # Verify persistent database storage
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash, role, institution_name, is_active FROM users WHERE email = ?",
            ("principal_alpha@college-tech.edu.in",),
        ).fetchone()
        assert row is not None
        assert row["email"] == "principal_alpha@college-tech.edu.in"
        assert row["role"] == "institution_user"
        assert row["is_active"] == 1
        # Password hash must not be plaintext
        assert row["password_hash"] != password
        assert row["password_hash"].startswith("pbkdf2:sha256:")


def test_duplicate_email_registration_rejected():
    email = "duplicate_check@campus.edu.in"
    reg1 = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password1#",
        "full_name": "First Registrar",
        "institution_name": "Campus Alpha",
    })
    assert reg1.status_code == 200

    # Second registration with uppercase/whitespace variant must fail
    reg2 = client.post("/api/auth/register", json={
        "email": f"  {email.upper()}  ",
        "password": "Password2#",
        "full_name": "Second Registrar",
        "institution_name": "Campus Beta",
    })
    assert reg2.status_code == 400
    assert "already exists" in reg2.json()["detail"].lower()


def test_login_persistence_and_invalid_credentials():
    email = "login_test@university.ac.in"
    password = "ValidPassword#2026"

    # Register
    reg_res = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Dean Testing",
        "institution_name": "Testing University",
    })
    assert reg_res.status_code == 200

    # Wrong password
    bad_pw = client.post("/api/auth/login", json={
        "email": email,
        "password": "WrongPassword#999",
    })
    assert bad_pw.status_code == 401

    # Nonexistent email
    bad_email = client.post("/api/auth/login", json={
        "email": "nonexistent@university.ac.in",
        "password": password,
    })
    assert bad_email.status_code == 401

    # Correct login
    login_res = client.post("/api/auth/login", json={
        "email": email.upper(),  # Casing test
        "password": password,
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # Profile retrieval with token
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == email


def test_deleted_user_token_is_rejected():
    """A valid JWT alone must not grant access if its account no longer exists in the database."""
    email = "ephemeral_user@test.gov.in"
    password = "EphemeralPass#2026"

    reg_res = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Ephemeral Officer",
    })
    assert reg_res.status_code == 200
    token = reg_res.json()["access_token"]
    user_id = reg_res.json()["user_id"]

    # Verify token works initially
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200

    # Delete user from persistent database
    with get_connection() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()

    # Even though JWT cryptographic signature is completely valid, request must be rejected
    rejected_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert rejected_res.status_code == 401
    assert "no longer exists" in rejected_res.json()["detail"].lower()


def test_deactivated_user_token_is_rejected():
    email = "deactivated_user@test.gov.in"
    password = "DeactivatedPass#2026"

    reg_res = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Deactivated Officer",
    })
    assert reg_res.status_code == 200
    token = reg_res.json()["access_token"]
    user_id = reg_res.json()["user_id"]

    # Mark user inactive
    with get_connection() as conn:
        conn.execute("UPDATE users SET is_active = 0 WHERE id = ?", (user_id,))
        conn.commit()

    # Token must be rejected
    rejected_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert rejected_res.status_code == 401
    assert "deactivated" in rejected_res.json()["detail"].lower()


def test_logout_and_token_invalidation():
    email = "logout_user@test.edu.in"
    password = "LogoutPass#2026"

    reg_res = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Logout Officer",
    })
    assert reg_res.status_code == 200
    token = reg_res.json()["access_token"]

    # Verify session active
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200

    # Call logout
    logout_res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_res.status_code == 200
    assert logout_res.json()["status"] == "success"

    # Subsequent request using that token must be rejected
    after_logout = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert after_logout.status_code == 401
    assert "revoked" in after_logout.json()["detail"].lower()


def test_cross_institution_tenant_isolation():
    """
    Strictly verifies that Institution B cannot access Institution A's
    applications, documents, page images, extracted fields, findings, reports, or audit entries.
    """
    # 1. Register Institution A
    res_a = client.post("/api/auth/register", json={
        "email": "institution_a@delhi.ac.in",
        "password": "PasswordA#2026",
        "full_name": "Registrar Delhi Tech",
        "institution_name": "Delhi Technical Institute",
    })
    assert res_a.status_code == 200
    token_a = res_a.json()["access_token"]
    inst_a_id = res_a.json()["institution_id"]

    # 2. Register Institution B
    res_b = client.post("/api/auth/register", json={
        "email": "institution_b@mumbai.ac.in",
        "password": "PasswordB#2026",
        "full_name": "Registrar Mumbai Tech",
        "institution_name": "Mumbai Institute of Technology",
    })
    assert res_b.status_code == 200
    token_b = res_b.json()["access_token"]

    # 3. Institution A creates an application
    create_res = client.post(
        "/api/applications",
        json={"application_type": "New Technical Campus", "intakeCapacity": 120},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert create_res.status_code == 201
    app_a_id = create_res.json()["id"]

    # 4. Institution A uploads a document
    pdf_bytes = _create_minimal_pdf_bytes()
    upload_res = client.post(
        f"/api/applications/{app_a_id}/documents",
        data={"document_type": "Land Title Deed"},
        files={"file": ("delhi_land_deed.pdf", pdf_bytes, "application/pdf")},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert upload_res.status_code == 201
    doc_a_id = upload_res.json()["id"]

    # 5. Institution B lists applications — must NOT contain Institution A's application
    list_b = client.get("/api/applications", headers={"Authorization": f"Bearer {token_b}"})
    assert list_b.status_code == 200
    app_ids_b = [a["id"] for a in list_b.json()]
    assert app_a_id not in app_ids_b

    # 6. Institution B attempts direct access to Institution A's application
    direct_app_b = client.get(f"/api/applications/{app_a_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert direct_app_b.status_code == 403

    # 7. Institution B attempts to upload document to Institution A's application
    bad_upload = client.post(
        f"/api/applications/{app_a_id}/documents",
        data={"document_type": "Malicious Upload"},
        files={"file": ("intruder.pdf", pdf_bytes, "application/pdf")},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert bad_upload.status_code == 403

    # 8. Institution B attempts to fetch Institution A's document metadata
    doc_meta_b = client.get(f"/api/documents/{doc_a_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert doc_meta_b.status_code == 403

    # 9. Institution B attempts to fetch Institution A's rendered page image
    page_img_b = client.get(f"/api/documents/{doc_a_id}/page/1", headers={"Authorization": f"Bearer {token_b}"})
    assert page_img_b.status_code == 403

    # 10. Institution B attempts to access page image via query token parameter
    page_query_b = client.get(f"/api/documents/{doc_a_id}/page/1?token={token_b}")
    assert page_query_b.status_code == 403

    # 11. Institution B attempts to access Institution A's findings
    findings_b = client.get(f"/api/applications/{app_a_id}/findings", headers={"Authorization": f"Bearer {token_b}"})
    assert findings_b.status_code == 403

    # 12. Institution B attempts to access Institution A's report dossier
    report_b = client.get(f"/api/applications/{app_a_id}/report", headers={"Authorization": f"Bearer {token_b}"})
    assert report_b.status_code == 403

    # 13. Institution B attempts to access Institution A's audit history
    audit_b = client.get(f"/api/audit/log?application_id={app_a_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert audit_b.status_code == 403

    # 14. Global audit log for Institution B must NOT contain Institution A's application ID
    general_audit_b = client.get("/api/audit/log", headers={"Authorization": f"Bearer {token_b}"})
    assert general_audit_b.status_code == 200
    for entry in general_audit_b.json():
        assert entry.get("entity_id") != app_a_id

    # 15. Institution A CAN access its own resources
    page_img_a = client.get(f"/api/documents/{doc_a_id}/page/1", headers={"Authorization": f"Bearer {token_a}"})
    assert page_img_a.status_code == 200
    assert page_img_a.headers["content-type"] == "image/png"

    # 16. Institution A can access page image via query token
    page_query_a = client.get(f"/api/documents/{doc_a_id}/page/1?token={token_a}")
    assert page_query_a.status_code == 200
    assert page_query_a.headers["content-type"] == "image/png"


def test_reviewer_role_can_access_cross_institution_data():
    """Explicitly authorized reviewer role can access applications across institutions for adjudication."""
    # 1. Register institution
    res_inst = client.post("/api/auth/register", json={
        "email": "regional_poly@punjab.gov.in",
        "password": "PolyPass#2026",
        "full_name": "Punjab Polytechnic",
    })
    assert res_inst.status_code == 200
    token_inst = res_inst.json()["access_token"]

    app_res = client.post(
        "/api/applications",
        json={"application_type": "Extension of Approval (EoA)"},
        headers={"Authorization": f"Bearer {token_inst}"},
    )
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    # 2. Get reviewer token
    tok_res = client.post("/api/auth/token", json={
        "username": "official.reviewer@aicte-india.org",
        "role": "reviewer",
    })
    assert tok_res.status_code == 200
    reviewer_token = tok_res.json()["access_token"]

    # 3. Reviewer can access the application
    app_view = client.get(f"/api/applications/{app_id}", headers={"Authorization": f"Bearer {reviewer_token}"})
    assert app_view.status_code == 200
    assert app_view.json()["id"] == app_id
