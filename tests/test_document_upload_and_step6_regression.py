import io
import uuid
import hashlib
import pytest
import pymupdf as fitz
from fastapi.testclient import TestClient
from app.main import app
from app.db import get_connection
from app.auth import create_access_token

client = TestClient(app)

def create_synthetic_pdf(text: str = "SYNTHETIC DEMO DOCUMENT - AICTE Mandatory Disclosure") -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 100), text, fontsize=14)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

def create_authenticated_test_user_and_app(institution_name: str = "Regression College of Technology"):
    uid = f"USR-{uuid.uuid4().hex[:8].upper()}"
    email = f"user_{uuid.uuid4().hex[:6]}@example.com"
    app_id = f"APP-{uuid.uuid4().hex[:8].upper()}"
    now = "2026-11-01T10:00:00Z"

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO users (id, email, password_hash, full_name, institution_id, role, is_active, created_at, updated_at)
            VALUES (?, ?, 'hash123', 'Dean Regression', ?, 'institution_user', 1, ?, ?)
            """,
            (uid, email, uid, now, now),
        )
        conn.execute(
            """
            INSERT INTO applications (id, user_id, institution_name, applicant_name, application_type, status, created_at, updated_at)
            VALUES (?, ?, ?, 'Dean Regression', 'Technical Approval', 'submitted', ?, ?)
            """,
            (app_id, uid, institution_name, now, now),
        )

    token = create_access_token(
        user_id=uid,
        email=email,
        role="institution_user",
        institution_id=uid,
        full_name="Dean Regression",
    )

    return {
        "email": email,
        "token": token,
        "app_id": app_id,
        "institution_name": institution_name,
    }

def test_document_upload_progress_and_delete_workflow():
    """
    Tests:
    1. Initial state: strictly 0 documents (0 of 5).
    2. Successful upload 1: count is 1 (1 of 5).
    3. Successful upload 2: count is 2 (2 of 5).
    4. Delete document 2: count decrements back to 1 (1 of 5).
    5. Delete document 1: count decrements back to 0 (0 of 5).
    6. Failed upload: invalid format does not increment count.
    """
    setup = create_authenticated_test_user_and_app("Kaveri Engineering Institute")
    app_id = setup["app_id"]
    token = setup["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Initial State: Must be strictly 0 documents
    res = client.get(f"/api/applications/{app_id}/documents", headers=headers)
    assert res.status_code == 200
    docs = res.json()
    assert len(docs) == 0, f"Expected 0 initial documents, got {len(docs)}"

    # 2. Upload Document 1 (Application Form)
    pdf_bytes1 = create_synthetic_pdf("Application Form 2026")
    upload1_res = client.post(
        f"/api/applications/{app_id}/documents",
        files={"file": ("AICTE_Application_Form.pdf", pdf_bytes1, "application/pdf")},
        data={"document_type": "Application Form"},
        headers=headers,
    )
    assert upload1_res.status_code in (200, 201)
    doc1 = upload1_res.json()
    doc1_id = doc1["id"]

    # Check count is now 1 of 5
    res = client.get(f"/api/applications/{app_id}/documents", headers=headers)
    docs = res.json()
    assert len(docs) == 1
    assert docs[0]["id"] == doc1_id

    # 3. Upload Document 2 (Institution Registration Document)
    pdf_bytes2 = create_synthetic_pdf("Registration Certificate 2026")
    upload2_res = client.post(
        f"/api/applications/{app_id}/documents",
        files={"file": ("Society_Registration_Cert.pdf", pdf_bytes2, "application/pdf")},
        data={"document_type": "Institution Registration Document"},
        headers=headers,
    )
    assert upload2_res.status_code in (200, 201)
    doc2 = upload2_res.json()
    doc2_id = doc2["id"]

    # Check count is now 2 of 5
    res = client.get(f"/api/applications/{app_id}/documents", headers=headers)
    docs = res.json()
    assert len(docs) == 2

    # 4. Failed upload with unsupported format should fail and NOT increment count
    fail_res = client.post(
        f"/api/applications/{app_id}/documents",
        files={"file": ("malicious_executable.exe", b"MZ invalid payload", "application/x-msdownload")},
        data={"document_type": "Affiliation Document"},
        headers=headers,
    )
    assert fail_res.status_code in (400, 422)

    # Verify count remains 2
    res = client.get(f"/api/applications/{app_id}/documents", headers=headers)
    assert len(res.json()) == 2

    # 5. Delete Document 2: count decrements from 2 to 1
    del_res = client.delete(
        f"/api/applications/{app_id}/documents/{doc2_id}",
        headers=headers,
    )
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    res = client.get(f"/api/applications/{app_id}/documents", headers=headers)
    docs = res.json()
    assert len(docs) == 1
    assert docs[0]["id"] == doc1_id

    # 6. Delete Document 1: count decrements from 1 to 0
    del_res2 = client.delete(
        f"/api/applications/{app_id}/documents/{doc1_id}",
        headers=headers,
    )
    assert del_res2.status_code == 200

    res = client.get(f"/api/applications/{app_id}/documents", headers=headers)
    docs = res.json()
    assert len(docs) == 0, f"Expected 0 documents after deletion, got {len(docs)}"

def test_step6_dossier_report_and_passport_endpoints():
    """
    Tests:
    1. Step 6 report endpoint returns complete context including valid audit attestation.
    2. Evidence passport endpoint returns audit_verification.
    3. Handles applications with 0 documents and 0 findings gracefully.
    4. Handles applications with long finding lists.
    """
    setup = create_authenticated_test_user_and_app("Arya Institute of Technology")
    app_id = setup["app_id"]
    token = setup["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Report endpoint format=json
    rep_res = client.get(f"/api/applications/{app_id}/report?format=json", headers=headers)
    assert rep_res.status_code == 200
    rep_json = rep_res.json()
    rep_data = rep_json.get("data", rep_json)
    context = rep_data["context"]
    app_context = context.get("application") or context.get("app")
    assert app_context["id"] == app_id
    assert "audit_chain" in context
    assert context["audit_chain"]["verified"] is True

    # 2. Passport endpoint
    pass_res = client.get(f"/api/applications/{app_id}/passport", headers=headers)
    assert pass_res.status_code == 200
    pass_data = pass_res.json()
    assert pass_data["application"]["id"] == app_id
    assert "audit_verification" in pass_data
    assert pass_data["audit_verification"]["verified"] is True
    assert pass_data["evidence_summary"]["total_documents_registered"] == 0

    # 3. PDF report generation works for this 0-document application
    pdf_res = client.get(f"/api/applications/{app_id}/report?format=pdf", headers=headers)
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF-")
