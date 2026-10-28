"""
Production-critical persistence, durable storage, authentication, and routing regression tests.

Verifies:
A. Registration & persistent database storage
B. Login persistence across new connections and instances
C. JWT signing/validation consistency with production secrets
D. Document upload, checksums, durable storage, and retrieval
E. Persistence after simulated application restart
F. Multi-tenant security, unauthenticated upload rejection, oversized upload rejection
G. Vercel routing, PreserveOriginalPath ASGI wrapper, and error handling
"""

import io
import os
import secrets
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
import pymupdf as fitz

from app.db import (
    get_connection,
    init_db,
    DatabaseRow,
    TursoCursorWrapper,
    is_turso,
)
from app.auth import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
    JWT_SECRET_KEY,
)
from app.storage import (
    save_file,
    get_file_path,
    get_file_bytes,
    file_exists,
    is_remote_storage_configured,
)
from app.main import app
from api.index import app as vercel_asgi_app, PreserveOriginalPath


@pytest.fixture(autouse=True)
def ensure_test_db(tmp_path, monkeypatch):
    """Ensure a clean, isolated database for each test unless testing remote database."""
    test_db = tmp_path / "test_persistence.db"
    monkeypatch.setenv("NIYANTRAN_DB_PATH", str(test_db))
    monkeypatch.setenv("ALLOW_EPHEMERAL_DB", "true")
    init_db(test_db)
    yield


def create_sample_pdf(title="Production Persistence Test Document") -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 72), title, fontsize=14)
    page.insert_text(fitz.Point(50, 110), "Statutory compliance proof for AICTE verification.", fontsize=10)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


# ---------------------------------------------------------------------------
# A. Registration & Persistent Database Storage
# ---------------------------------------------------------------------------

def test_registration_and_db_persistence():
    client = TestClient(app)
    email = f"officer_{secrets.token_hex(4)}@institution.edu.in"
    password = "StrongPassword@2026"
    full_name = "Dr. Test Director"
    institution = "Apex Institute of Tech"

    res = client.post(
        "/api/auth/register",
        json={
            "email": email.upper(),  # test case-insensitivity on registration
            "password": password,
            "full_name": full_name,
            "institution_name": institution,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == email.lower()
    assert data["user_id"].startswith("USR-")
    assert "access_token" in data

    # Verify user is genuinely stored in database
    with get_connection() as conn:
        user_row = conn.execute(
            "SELECT id, email, full_name, role FROM users WHERE LOWER(email) = ?",
            (email.lower(),),
        ).fetchone()
        assert user_row is not None
        assert user_row["email"] == email.lower()
        assert user_row["full_name"] == full_name
        assert user_row["role"] == "institution_user"


# ---------------------------------------------------------------------------
# B. Login Persistence across New Connections / Instances
# ---------------------------------------------------------------------------

def test_login_persistence_across_new_connections():
    client = TestClient(app)
    email = f"persist_{secrets.token_hex(4)}@institution.edu.in"
    password = "PersistPassword@2026"

    # Register
    reg_res = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "full_name": "Persist User"},
    )
    assert reg_res.status_code == 200
    user_id = reg_res.json()["user_id"]

    # Reconnect with a fresh application client instance (simulating separate request)
    fresh_client = TestClient(app)
    login_res = fresh_client.post(
        "/api/auth/login",
        json={"email": email.upper(), "password": password},  # Case-insensitive login
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["user_id"] == user_id
    assert "access_token" in login_data

    # Verify /api/auth/me with the issued token
    me_res = fresh_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {login_data['access_token']}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["user_id"] == user_id


# ---------------------------------------------------------------------------
# C. JWT Signing and Validation Consistency
# ---------------------------------------------------------------------------

def test_jwt_persistence_and_signing():
    user_id = f"USR-{secrets.token_hex(4)}"
    email = "jwt_test@institution.edu.in"
    role = "institution_user"

    token = create_access_token(user_id=user_id, email=email, role=role)
    assert isinstance(token, str)

    # Validate from another simulated instance
    payload = decode_access_token(token)
    assert payload["sub"] == user_id
    assert payload["email"] == email
    assert payload["role"] == role
    assert payload["iss"] == "niyantran-regulatory-platform"


# ---------------------------------------------------------------------------
# D. Document Upload, Checksum, Durable Storage, and Retrieval
# ---------------------------------------------------------------------------

def test_document_upload_and_retrieval_flow():
    client = TestClient(app)
    email = f"uploader_{secrets.token_hex(4)}@institution.edu.in"
    password = "UploadPassword@2026"

    # Register institution user
    reg = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "full_name": "Uploader User"},
    )
    token = reg.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Create application
    app_res = client.post(
        "/api/applications",
        json={
            "application_type": "New Technical Institution",
            "institution_name": "Test Engineering College",
            "applicant_name": "Director Sharma",
        },
        headers=auth_headers,
    )
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    # Upload valid PDF document
    pdf_content = create_sample_pdf("AICTE Approval Letter 2026")
    upload_res = client.post(
        f"/api/applications/{app_id}/documents",
        files={"file": ("aicte_approval.pdf", pdf_content, "application/pdf")},
        data={"document_type": "Approval Document"},
        headers=auth_headers,
    )
    assert upload_res.status_code == 201
    doc_data = upload_res.json()
    assert doc_data["application_id"] == app_id
    assert doc_data["document_type"] == "Approval Document"
    assert doc_data["original_filename"] == "aicte_approval.pdf"
    assert doc_data["file_size"] == len(pdf_content)
    assert len(doc_data["sha256"]) == 64
    doc_id = doc_data["id"]

    # Verify document retrieval through API
    get_doc = client.get(f"/api/documents/{doc_id}", headers=auth_headers)
    assert get_doc.status_code == 200
    assert get_doc.json()["id"] == doc_id

    # Verify document page viewer rendering
    page_res = client.get(f"/api/documents/{doc_id}/page/1", headers=auth_headers)
    assert page_res.status_code == 200
    assert page_res.headers["content-type"] in ("image/png", "image/jpeg")


# ---------------------------------------------------------------------------
# E. Persistence After Restart (Simulated Fresh Instance)
# ---------------------------------------------------------------------------

def test_persistence_after_instance_restart():
    client1 = TestClient(app)
    email = f"restart_{secrets.token_hex(4)}@institution.edu.in"
    password = "RestartPassword@2026"

    # Instance 1: Register and create application
    reg = client1.post(
        "/api/auth/register",
        json={"email": email, "password": password, "full_name": "Restart Officer"},
    )
    token = reg.json()["access_token"]
    user_id = reg.json()["user_id"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    app_res = client1.post(
        "/api/applications",
        json={
            "application_type": "Extension of Approval (EoA)",
            "institution_name": "Restart Polytech",
        },
        headers=auth_headers,
    )
    app_id = app_res.json()["id"]

    pdf_bytes = create_sample_pdf("Trust Deed 2026")
    up_res = client1.post(
        f"/api/applications/{app_id}/documents",
        files={"file": ("trust_deed.pdf", pdf_bytes, "application/pdf")},
        data={"document_type": "Institution Registration Document"},
        headers=auth_headers,
    )
    doc_id = up_res.json()["id"]

    # Simulate Instance 2: Fresh client with same token and credentials
    client2 = TestClient(app)
    login = client2.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200
    fresh_token = login.json()["access_token"]
    fresh_headers = {"Authorization": f"Bearer {fresh_token}"}

    # Verify application remains accessible
    get_app = client2.get(f"/api/applications/{app_id}", headers=fresh_headers)
    assert get_app.status_code == 200
    assert get_app.json()["institution_name"] == "Restart Polytech"

    # Verify document remains accessible
    get_doc = client2.get(f"/api/documents/{doc_id}", headers=fresh_headers)
    assert get_doc.status_code == 200
    assert get_doc.json()["original_filename"] == "trust_deed.pdf"


# ---------------------------------------------------------------------------
# F. Security & Access Control
# ---------------------------------------------------------------------------

def test_security_access_control_and_validation(monkeypatch):
    client = TestClient(app)
    pdf_bytes = create_sample_pdf()

    # Register User A and create Application A
    reg_a = client.post(
        "/api/auth/register",
        json={"email": f"usera_{secrets.token_hex(4)}@test.edu", "password": "PasswordA@123", "full_name": "User A"},
    )
    token_a = reg_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    app_a = client.post(
        "/api/applications",
        json={"application_type": "New Technical Institution", "institution_name": "College A"},
        headers=headers_a,
    ).json()

    # 1. Unauthenticated / forbidden upload rejected
    unauth = client.post(
        f"/api/applications/{app_a['id']}/documents",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
        headers={"Authorization": "Bearer unauthorized"},
    )
    assert unauth.status_code in (401, 403)

    # 2. Upload valid doc under Application A
    up_a = client.post(
        f"/api/applications/{app_a['id']}/documents",
        files={"file": ("doc_a.pdf", pdf_bytes, "application/pdf")},
        data={"document_type": "Application Form"},
        headers=headers_a,
    ).json()

    # 3. Register User B and verify User B CANNOT access User A's document
    reg_b = client.post(
        "/api/auth/register",
        json={"email": f"userb_{secrets.token_hex(4)}@test.edu", "password": "PasswordB@123", "full_name": "User B"},
    )
    token_b = reg_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    forbidden_doc = client.get(f"/api/documents/{up_a['id']}", headers=headers_b)
    assert forbidden_doc.status_code == 403

    # 4. Reject oversized uploads (exceeding 15 MB)
    oversized = b"%PDF-1.4\n" + b"A" * (16 * 1024 * 1024)
    too_big = client.post(
        f"/api/applications/{app_a['id']}/documents",
        files={"file": ("big.pdf", oversized, "application/pdf")},
        data={"document_type": "Application Form"},
        headers=headers_a,
    )
    assert too_big.status_code == 413


# ---------------------------------------------------------------------------
# G. PreserveOriginalPath ASGI Middleware & Vercel Routing
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_preserve_original_path_middleware():
    """Verifies PreserveOriginalPath extracts __niyantran_path and reconstructs scope path."""
    received_scope = {}

    async def mock_inner(scope, receive, send):
        received_scope.update(scope)

    middleware = PreserveOriginalPath(mock_inner)

    # Case 1: Rewrite with __niyantran_path query param
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/index.py",
        "raw_path": b"/api/index.py",
        "query_string": b"__niyantran_path=applications%2FAPP-101%2Fdocuments&param=value",
        "headers": [(b"content-type", b"multipart/form-data")],
    }
    await middleware(scope, None, None)

    assert received_scope["path"] == "/api/applications/APP-101/documents"
    assert received_scope["raw_path"] == b"/api/applications/APP-101/documents"
    assert b"__niyantran_path" not in received_scope["query_string"]
    assert b"param=value" in received_scope["query_string"]

    # Case 2: Direct call /api/health
    scope2 = {
        "type": "http",
        "method": "GET",
        "path": "/api/health",
        "raw_path": b"/api/health",
        "query_string": b"",
        "headers": [],
    }
    await middleware(scope2, None, None)
    assert received_scope["path"] == "/api/health"


# ---------------------------------------------------------------------------
# H. DatabaseRow Dual-Access and dict(row) Support
# ---------------------------------------------------------------------------

def test_database_row_dict_and_index_compatibility():
    data = {"id": "DOC-99", "name": "sample.pdf", "size": 1024}
    row = DatabaseRow(data)

    assert row["id"] == "DOC-99"
    assert row[0] == "DOC-99"
    assert row["name"] == "sample.pdf"
    assert row[1] == "sample.pdf"
    assert row[2] == 1024

    # Crucial: dict(row) must succeed without TypeError
    as_dict = dict(row)
    assert isinstance(as_dict, dict)
    assert as_dict["id"] == "DOC-99"
    assert len(as_dict) == 3
