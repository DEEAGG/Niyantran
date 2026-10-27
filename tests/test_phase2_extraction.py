import io
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
import fitz

from app.main import app
from app.db import get_connection, DOCUMENTS_DIR

client = TestClient(app)


def create_complete_synthetic_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 60), "SYNTHETIC DEMO DOCUMENT - AICTE Application Form", fontsize=14)
    page.insert_text(fitz.Point(50, 100), "Applicant Name: Apex Education Trust", fontsize=11)
    page.insert_text(fitz.Point(50, 140), "Regulatory Institution: Apex Institute of Technology", fontsize=11)
    page.insert_text(fitz.Point(50, 180), "Registration Number: REG-2026-98765", fontsize=11)
    page.insert_text(fitz.Point(50, 220), "Address: Plot 42, Tech Park, Greater Noida, UP", fontsize=11)
    page.insert_text(fitz.Point(50, 260), "Land Area: 5.2 Acres", fontsize=11)
    page.insert_text(fitz.Point(50, 300), "Issue Date: 15/01/2026", fontsize=11)
    page.insert_text(fitz.Point(50, 340), "Expiry Date: 14/01/2031", fontsize=11)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_sparse_synthetic_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 60), "SYNTHETIC DEMO DOCUMENT - Board Resolution", fontsize=14)
    page.insert_text(fitz.Point(50, 100), "Regulatory Institution: Demo Engineering Institute", fontsize=11)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_uncertain_field_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 60), "SYNTHETIC DEMO DOCUMENT - Partial Verification", fontsize=14)
    page.insert_text(fitz.Point(50, 100), "Regulatory Institution: Demo College", fontsize=11)
    page.insert_text(fitz.Point(50, 140), "Issue Date: unknown-unparseable-date", fontsize=11)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_synthetic_ocr_image() -> bytes:
    img = Image.new("RGB", (800, 350), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((30, 30), "SYNTHETIC DEMO DOCUMENT - Land Registry Certificate", fill=(0, 0, 0))
    draw.text((30, 80), "Applicant: Northern Educational Foundation", fill=(0, 0, 0))
    draw.text((30, 130), "Regulatory Institution: Northern Polytechnic Institute", fill=(0, 0, 0))
    draw.text((30, 180), "Reg No: REG-OCR-4455", fill=(0, 0, 0))
    draw.text((30, 230), "Land Area: 10000 sq ft", fill=(0, 0, 0))
    draw.text((30, 280), "Issue Date: 2026-03-15", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def helper_create_app_and_doc(file_bytes: bytes, filename: str, doc_type: str = "application_form") -> tuple[str, str]:
    app_res = client.post("/api/applications", json={"application_type": "New Institute Approval"})
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    mime = "application/pdf" if filename.endswith(".pdf") else "image/png"
    upload_res = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": doc_type},
        files={"file": (filename, file_bytes, mime)},
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]
    return app_id, doc_id


# =============================================================
# 1. Structured Field Extraction & Provenance Tests
# =============================================================

def test_extract_all_structured_fields_from_pdf():
    pdf_bytes = create_complete_synthetic_pdf()
    app_id, doc_id = helper_create_app_and_doc(pdf_bytes, "complete_demo.pdf")

    # Run extraction
    extract_res = client.post(f"/api/documents/{doc_id}/extract")
    assert extract_res.status_code == 200
    data = extract_res.json()

    assert data["status"] == "completed"
    assert data["document_id"] == doc_id
    assert data["run_number"] >= 1
    assert data["method"] == "pdf_text"
    assert data["fields_extracted"] == 7

    fields = {f["field_name"]: f for f in data["fields"]}

    # 1. applicant_name
    assert fields["applicant_name"]["field_value"] == "Apex Education Trust"
    assert fields["applicant_name"]["normalized_value"] == "Apex Education Trust"
    assert fields["applicant_name"]["confidence"] >= 0.8
    assert fields["applicant_name"]["needs_review"] is False

    # 2. institution_name
    assert fields["institution_name"]["field_value"] == "Apex Institute of Technology"
    assert fields["institution_name"]["confidence"] >= 0.8

    # 3. registration_number
    assert fields["registration_number"]["field_value"] == "REG-2026-98765"
    assert fields["registration_number"]["normalized_value"] == "REG-2026-98765"

    # 4. address
    assert "Tech Park, Greater Noida" in fields["address"]["field_value"]

    # 5. land_area
    assert fields["land_area"]["field_value"] == "5.2 Acres"
    assert fields["land_area"]["normalized_value"] == "5.2 Acres"

    # 6. issue_date
    assert fields["issue_date"]["field_value"] == "15/01/2026"
    assert fields["issue_date"]["normalized_value"] == "2026-01-15"

    # 7. expiry_date
    assert fields["expiry_date"]["field_value"] == "14/01/2031"
    assert fields["expiry_date"]["normalized_value"] == "2031-01-14"

    # Provenance assertions for every extracted field
    for name, f in fields.items():
        assert f["document_id"] == doc_id
        assert f["page_number"] == 1
        assert f["extraction_method"] == "pdf_text"
        assert f["bbox"] is not None
        assert "x0" in f["bbox"] and "y0" in f["bbox"]
        assert f["bbox"]["x1"] > f["bbox"]["x0"]
        assert f["bbox"]["y1"] > f["bbox"]["y0"]
        assert f["confirmed"] is False
        assert f["confirmed_by"] is None

    # Verify document processing_status updated
    doc_res = client.get(f"/api/documents/{doc_id}")
    assert doc_res.status_code == 200
    assert doc_res.json()["processing_status"] == "extracted"


def test_missing_fields_remain_unverified():
    pdf_bytes = create_sparse_synthetic_pdf()
    app_id, doc_id = helper_create_app_and_doc(pdf_bytes, "sparse_demo.pdf")

    extract_res = client.post(f"/api/documents/{doc_id}/extract")
    assert extract_res.status_code == 200
    data = extract_res.json()

    extracted_names = [f["field_name"] for f in data["fields"]]
    assert "institution_name" in extracted_names
    # Unmentioned fields must not be invented
    assert "applicant_name" not in extracted_names
    assert "land_area" not in extracted_names
    assert "registration_number" not in extracted_names
    assert "expiry_date" not in extracted_names


def test_uncertain_field_marked_for_manual_review():
    pdf_bytes = create_uncertain_field_pdf()
    app_id, doc_id = helper_create_app_and_doc(pdf_bytes, "uncertain_demo.pdf")

    extract_res = client.post(f"/api/documents/{doc_id}/extract")
    assert extract_res.status_code == 200
    data = extract_res.json()

    fields = {f["field_name"]: f for f in data["fields"]}
    assert "issue_date" in fields
    # Unparseable date must have confidence penalized (< 0.8) and marked for review
    assert fields["issue_date"]["confidence"] < 0.8
    assert fields["issue_date"]["needs_review"] is True
    assert fields["issue_date"]["is_uncertain"] is True


def test_extract_scanned_image_via_ocr():
    img_bytes = create_synthetic_ocr_image()
    app_id, doc_id = helper_create_app_and_doc(img_bytes, "scanned_demo.png", doc_type="land_registry")

    extract_res = client.post(f"/api/documents/{doc_id}/extract")
    assert extract_res.status_code == 200
    data = extract_res.json()

    assert data["status"] == "completed"
    assert data["method"] == "tesseract_ocr"
    assert data["fields_extracted"] >= 1

    field_names = [f["field_name"] for f in data["fields"]]
    assert "institution_name" in field_names or "applicant_name" in field_names or "land_area" in field_names
    for f in data["fields"]:
        assert f["extraction_method"] == "tesseract_ocr"
        assert f["confidence"] is not None
        assert 0.0 <= f["confidence"] <= 1.0


# =============================================================
# 2. Field Listing & Application Aggregation Tests
# =============================================================

def test_list_document_fields_and_runs():
    pdf_bytes = create_complete_synthetic_pdf()
    app_id, doc_id = helper_create_app_and_doc(pdf_bytes, "list_fields_demo.pdf")

    client.post(f"/api/documents/{doc_id}/extract")

    # List fields
    list_res = client.get(f"/api/documents/{doc_id}/fields")
    assert list_res.status_code == 200
    fields = list_res.json()
    assert len(fields) == 7
    assert any(f["field_name"] == "applicant_name" for f in fields)

    # List runs
    runs_res = client.get(f"/api/documents/{doc_id}/extraction-runs")
    assert runs_res.status_code == 200
    runs = runs_res.json()
    assert len(runs) >= 1
    assert runs[0]["status"] == "completed"


def test_list_application_fields_and_batch_extract():
    pdf1 = create_complete_synthetic_pdf()
    pdf2 = create_sparse_synthetic_pdf()

    app_res = client.post("/api/applications", json={"application_type": "Multi-Doc Approval"})
    app_id = app_res.json()["id"]

    client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "mandate_1"},
        files={"file": ("doc1.pdf", pdf1, "application/pdf")},
    )
    client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "mandate_2"},
        files={"file": ("doc2.pdf", pdf2, "application/pdf")},
    )

    # Batch extract application
    batch_res = client.post(f"/api/applications/{app_id}/extract")
    assert batch_res.status_code == 200
    assert batch_res.json()["documents_processed"] == 2

    # Query all application fields
    app_fields_res = client.get(f"/api/applications/{app_id}/fields")
    assert app_fields_res.status_code == 200
    fields = app_fields_res.json()
    assert len(fields) >= 8  # 7 from doc1 + 1 from doc2


# =============================================================
# 3. Field Confirmation & Correction Tests
# =============================================================

def test_confirm_field_without_value_change():
    pdf_bytes = create_complete_synthetic_pdf()
    app_id, doc_id = helper_create_app_and_doc(pdf_bytes, "confirm_demo.pdf")
    extract_res = client.post(f"/api/documents/{doc_id}/extract")
    field_id = extract_res.json()["fields"][0]["id"]

    # Confirm
    conf_res = client.post(f"/api/fields/{field_id}/confirm", json={"confirmed_by": "lead_inspector"})
    assert conf_res.status_code == 200
    field_data = conf_res.json()

    assert field_data["id"] == field_id
    assert field_data["confirmed"] is True
    assert field_data["confirmed_by"] == "lead_inspector"
    assert field_data["confirmed_at"] is not None
    assert field_data["needs_review"] is False

    # Verify single field retrieval
    get_res = client.get(f"/api/fields/{field_id}")
    assert get_res.status_code == 200
    assert get_res.json()["confirmed"] is True


def test_correct_field_value_and_audit():
    pdf_bytes = create_complete_synthetic_pdf()
    app_id, doc_id = helper_create_app_and_doc(pdf_bytes, "correct_demo.pdf")
    extract_res = client.post(f"/api/documents/{doc_id}/extract")
    fields = extract_res.json()["fields"]
    land_field = next(f for f in fields if f["field_name"] == "land_area")
    field_id = land_field["id"]

    # Correct land area from 5.2 Acres to 6.5 Acres
    patch_res = client.patch(
        f"/api/fields/{field_id}",
        json={"field_value": "6.5 Acres", "confirmed": True, "confirmed_by": "compliance_officer"},
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["field_value"] == "6.5 Acres"
    assert updated["normalized_value"] == "6.5 Acres"
    assert updated["confirmed"] is True
    assert updated["confirmed_by"] == "compliance_officer"

    # Verify audit log recorded FIELD_CORRECTED
    audit_res = client.get("/api/audit/log?limit=5")
    assert audit_res.status_code == 200
    latest_event = audit_res.json()[0]
    assert latest_event["event_type"] in ("FIELD_CORRECTED", "FIELD_CONFIRMED")
    assert latest_event["entity_id"] == field_id

    # Verify cryptographic audit chain integrity
    verify_res = client.get("/api/audit/verify")
    assert verify_res.status_code == 200
    assert verify_res.json()["verified"] is True


# =============================================================
# 4. Invalid Inputs & Edge Cases Tests
# =============================================================

def test_extract_nonexistent_document_returns_404():
    res = client.post("/api/documents/DOC-DOESNOTEXIST/extract")
    assert res.status_code == 404
    assert res.json()["detail"] == "Document not found"


def test_get_fields_nonexistent_document_returns_404():
    res = client.get("/api/documents/DOC-DOESNOTEXIST/fields")
    assert res.status_code == 404
    assert res.json()["detail"] == "Document not found"


def test_get_fields_nonexistent_application_returns_404():
    res = client.get("/api/applications/APP-DOESNOTEXIST/fields")
    assert res.status_code == 404
    assert res.json()["detail"] == "Application not found"


def test_get_nonexistent_field_returns_404():
    res = client.get("/api/fields/FLD-DOESNOTEXIST")
    assert res.status_code == 404
    assert res.json()["detail"] == "Extracted field not found"


def test_patch_nonexistent_field_returns_404():
    res = client.patch("/api/fields/FLD-DOESNOTEXIST", json={"confirmed": True})
    assert res.status_code == 404
    assert res.json()["detail"] == "Extracted field not found"


def test_confirm_nonexistent_field_returns_404():
    res = client.post("/api/fields/FLD-DOESNOTEXIST/confirm", json={"confirmed": True})
    assert res.status_code == 404
    assert res.json()["detail"] == "Extracted field not found"
