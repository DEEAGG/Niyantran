import io
import hashlib
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
import fitz

from app.main import app
from app.db import get_connection, DOCUMENTS_DIR

client = TestClient(app)


def create_synthetic_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(
        fitz.Point(50, 100),
        "SYNTHETIC DEMO DOCUMENT - AICTE Mandatory Disclosure",
        fontsize=16,
    )
    page.insert_text(
        fitz.Point(50, 140),
        "Regulatory Institution: Demo Engineering Institute",
        fontsize=12,
    )
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_synthetic_png() -> bytes:
    img = Image.new("RGB", (500, 200), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 80), "SYNTHETIC DEMO DOCUMENT - Board Resolution", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def create_synthetic_jpeg() -> bytes:
    img = Image.new("RGB", (500, 200), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 80), "SYNTHETIC DEMO DOCUMENT - Land Registration", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# -------------------------------------------------------------
# 1. Health and Database Availability Tests
# -------------------------------------------------------------

def test_health_check_healthy():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "healthy"
    assert data.get("database") == "connected"


def test_home_status():
    response = client.get("/")
    assert response.status_code == 200
    if "application/json" in response.headers.get("content-type", ""):
        data = response.json()
        assert data.get("project") == "Niyantran"
        assert data.get("status") == "running"
    else:
        assert "html" in response.headers.get("content-type", "")


# -------------------------------------------------------------
# 2. Application Endpoints Tests
# -------------------------------------------------------------

def test_create_application_valid():
    payload = {
        "application_type": "New Technical Institution",
        "applicant_name": "Demo Trust Society",
        "institution_name": "Apex Institute of Technology",
    }
    response = client.post("/api/applications", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"].startswith("APP-")
    assert data["application_type"] == payload["application_type"]
    assert data["applicant_name"] == payload["applicant_name"]
    assert data["institution_name"] == payload["institution_name"]
    assert data["status"] == "draft"
    assert "created_at" in data
    assert "updated_at" in data


def test_create_application_validation_error():
    # Empty application_type
    response = client.post(
        "/api/applications",
        json={"application_type": "   ", "applicant_name": "Test"},
    )
    assert response.status_code in (400, 422)

    # Missing application_type field
    response = client.post(
        "/api/applications",
        json={"applicant_name": "Test"},
    )
    assert response.status_code in (400, 422)


def test_list_applications_and_filter():
    # Create two applications with distinct statuses if possible
    res1 = client.post(
        "/api/applications",
        json={"application_type": "Type A", "applicant_name": "Applicant 1"},
    )
    assert res1.status_code == 201
    app1_id = res1.json()["id"]

    # List all
    res = client.get("/api/applications")
    assert res.status_code == 200
    apps = res.json()
    assert isinstance(apps, list)
    assert any(a["id"] == app1_id for a in apps)

    # Filter by draft status
    res_filtered = client.get("/api/applications?status=draft")
    assert res_filtered.status_code == 200
    for a in res_filtered.json():
        assert a["status"] == "draft"


def test_get_application_by_id():
    res_create = client.post(
        "/api/applications",
        json={
            "application_type": "Extension of Approval",
            "applicant_name": "Dr. A. Sharma",
            "institution_name": "State Engineering College",
        },
    )
    app_id = res_create.json()["id"]

    # Successful retrieval
    res = client.get(f"/api/applications/{app_id}")
    assert res.status_code == 200
    app_data = res.json()
    assert app_data["id"] == app_id
    assert "documents" in app_data
    assert isinstance(app_data["documents"], list)


def test_get_unknown_application_returns_404():
    response = client.get("/api/applications/APP-NONEXISTENT-999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Application not found"


# -------------------------------------------------------------
# 3. Document Upload and Metadata Tests
# -------------------------------------------------------------

def test_upload_valid_synthetic_pdf():
    # Create app first
    res_create = client.post(
        "/api/applications",
        json={"application_type": "Technical Approval", "institution_name": "Polytechnic"},
    )
    app_id = res_create.json()["id"]

    pdf_bytes = create_synthetic_pdf()
    expected_sha256 = hashlib.sha256(pdf_bytes).hexdigest()

    response = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "land_certificate"},
        files={"file": ("synthetic_land_cert.pdf", pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 201
    doc_data = response.json()

    assert doc_data["id"].startswith("DOC-")
    assert doc_data["application_id"] == app_id
    assert doc_data["document_type"] == "land_certificate"
    assert doc_data["original_filename"] == "synthetic_land_cert.pdf"
    assert doc_data["mime_type"] == "application/pdf"
    assert doc_data["sha256"] == expected_sha256
    assert doc_data["file_size"] == len(pdf_bytes)
    assert doc_data["page_count"] == 1
    assert doc_data["processing_status"] == "uploaded"
    assert not doc_data["stored_path"].startswith("D:")
    assert not doc_data["stored_path"].startswith("C:")

    # Verify physical file existence in storage dir
    stored_file = DOCUMENTS_DIR.parent / doc_data["stored_path"]
    assert stored_file.exists()


def test_upload_valid_synthetic_image():
    res_create = client.post(
        "/api/applications",
        json={"application_type": "Technical Approval", "institution_name": "Polytechnic"},
    )
    app_id = res_create.json()["id"]

    png_bytes = create_synthetic_png()
    response = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "board_resolution"},
        files={"file": ("board_resolution.png", png_bytes, "image/png")},
    )
    assert response.status_code == 201
    doc_data = response.json()
    assert doc_data["mime_type"] == "image/png"
    assert doc_data["page_count"] == 1
    assert doc_data["file_size"] == len(png_bytes)


def test_upload_valid_synthetic_jpeg():
    res_create = client.post(
        "/api/applications",
        json={"application_type": "Technical Approval", "institution_name": "Polytechnic"},
    )
    app_id = res_create.json()["id"]

    jpeg_bytes = create_synthetic_jpeg()
    response = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "land_registration"},
        files={"file": ("land_registration.jpg", jpeg_bytes, "image/jpeg")},
    )
    assert response.status_code == 201
    doc_data = response.json()
    assert doc_data["mime_type"] == "image/jpeg"
    assert doc_data["page_count"] == 1
    assert doc_data["file_size"] == len(jpeg_bytes)


def test_audit_chain_tamper_detection(monkeypatch):
    from app.db import verify_audit_chain
    # Verify current state is valid
    with get_connection() as conn:
        assert verify_audit_chain(conn)["verified"] is True
        # Temporarily tamper a record
        conn.execute("UPDATE audit_log SET actor = 'malicious-actor' WHERE id = (SELECT MAX(id) FROM audit_log)")
        tampered_result = verify_audit_chain(conn)
        assert tampered_result["verified"] is False
        assert "tampered" in tampered_result["error"].lower() or "broken" in tampered_result["error"].lower()
        # Rollback or restore
        conn.rollback()


def test_reject_empty_file():
    res_create = client.post(
        "/api/applications",
        json={"application_type": "Technical Approval"},
    )
    app_id = res_create.json()["id"]

    response = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "fire_safety"},
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_reject_unsupported_file_extension():
    res_create = client.post(
        "/api/applications",
        json={"application_type": "Technical Approval"},
    )
    app_id = res_create.json()["id"]

    response = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "executable"},
        files={"file": ("script.exe", b"MZ\x90\x00", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "unsupported" in response.json()["detail"].lower()


def test_reject_malformed_pdf():
    res_create = client.post(
        "/api/applications",
        json={"application_type": "Technical Approval"},
    )
    app_id = res_create.json()["id"]

    response = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "affidavit"},
        files={"file": ("corrupted.pdf", b"%PDF-corrupted-random-binary-not-valid-pdf", "application/pdf")},
    )
    assert response.status_code == 400
    assert "malformed" in response.json()["detail"].lower() or "unreadable" in response.json()["detail"].lower()


def test_reject_oversized_file():
    res_create = client.post(
        "/api/applications",
        json={"application_type": "Technical Approval"},
    )
    app_id = res_create.json()["id"]

    oversized_data = b"%PDF-1.4\n" + b"0" * (15 * 1024 * 1024 + 100)
    response = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "large_doc"},
        files={"file": ("too_big.pdf", oversized_data, "application/pdf")},
    )
    assert response.status_code == 413
    assert "15 mb" in response.json()["detail"].lower()


def test_upload_to_unknown_application_returns_404():
    pdf_bytes = create_synthetic_pdf()
    response = client.post(
        "/api/applications/APP-NONEXISTENT/documents",
        data={"document_type": "building_plan"},
        files={"file": ("plan.pdf", pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Application not found"


def test_list_application_documents_and_get_document():
    res_create = client.post(
        "/api/applications",
        json={"application_type": "Technical Approval"},
    )
    app_id = res_create.json()["id"]

    pdf_bytes = create_synthetic_pdf()
    upload_res = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "noc_document"},
        files={"file": ("noc.pdf", pdf_bytes, "application/pdf")},
    )
    doc_id = upload_res.json()["id"]

    # List application's documents
    res_list = client.get(f"/api/applications/{app_id}/documents")
    assert res_list.status_code == 200
    docs = res_list.json()
    assert len(docs) >= 1
    assert any(d["id"] == doc_id for d in docs)

    # Get single document
    res_doc = client.get(f"/api/documents/{doc_id}")
    assert res_doc.status_code == 200
    assert res_doc.json()["id"] == doc_id
    assert res_doc.json()["original_filename"] == "noc.pdf"


def test_get_unknown_document_returns_404():
    response = client.get("/api/documents/DOC-NONEXISTENT-999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Document not found"


# -------------------------------------------------------------
# 4. Audit Trail and Hash-Chain Verification Tests
# -------------------------------------------------------------

def test_audit_chain_verification():
    # Make sure we have created records
    res = client.get("/api/audit/verify")
    assert res.status_code == 200
    data = res.json()
    assert data["verified"] is True
    assert data["total_records"] > 0
    assert "latest_hash" in data


def test_audit_log_endpoint():
    res = client.get("/api/audit/log?limit=10")
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)
    assert len(logs) > 0
    first = logs[0]
    assert "event_type" in first
    assert "actor" in first
    assert first["actor"] in ["local-demo-user", "compliance-officer", "system-audit", "officer"]
    assert "entry_hash" in first


# -------------------------------------------------------------
# 5. Existing OCR Endpoint Regression Tests
# -------------------------------------------------------------

def test_ocr_status_endpoint():
    res = client.get("/api/ocr/status")
    assert res.status_code == 200
    data = res.json()
    assert data.get("available") is True
    assert "version" in data


def test_ocr_extract_document_regression():
    pdf_bytes = create_synthetic_pdf()
    response = client.post(
        "/api/documents/extract",
        files={"file": ("test_extract.pdf", pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["pages_processed"] >= 1
    assert "SYNTHETIC DEMO DOCUMENT" in data["text"]
