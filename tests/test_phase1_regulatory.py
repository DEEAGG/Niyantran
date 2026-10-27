import io
import hashlib
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
import fitz

from app.main import app
from app.db import get_connection, verify_audit_chain
from app.regulatory_ingestion import (
    compute_sha256,
    detect_ocr_requirement,
    extract_regulatory_clauses_from_pdf,
    ingest_regulatory_pdf
)

client = TestClient(app)


def make_test_pdf(pages_text: list[tuple[str, str]]) -> bytes:
    """Creates an in-memory PDF with specified headings and text per page."""
    doc = fitz.open()
    for heading, text in pages_text:
        page = doc.new_page(width=595, height=842)
        page.insert_text(fitz.Point(50, 70), heading, fontsize=14)
        page.insert_text(fitz.Point(50, 110), text, fontsize=10)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def make_scanned_image_pdf() -> bytes:
    """Creates a PDF containing only an embedded raster image (no text layer) to test OCR detection."""
    img = Image.new("RGB", (600, 800), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    draw.text((50, 50), "SCANNED AICTE GAZETTE NOTICE (RASTER IMAGE ONLY)", fill=(0, 0, 0))
    img_buf = io.BytesIO()
    img.save(img_buf, format="PNG")
    img_bytes = img_buf.getvalue()

    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_image(fitz.Rect(50, 50, 545, 750), stream=img_bytes)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_regulatory_stats():
    """Verify regulatory stats endpoint returns aggregated metrics."""
    res = client.get("/api/regulatory/stats")
    assert res.status_code == 200
    data = res.json()
    assert "total_sources" in data
    assert "total_clauses" in data
    assert "verified_clauses" in data
    assert data["total_sources"] >= 3
    assert data["total_clauses"] >= 30


def test_list_and_filter_sources():
    """Verify listing sources and filtering by category and verification status."""
    res = client.get("/api/regulatory/sources")
    assert res.status_code == 200
    sources = res.json()["data"]
    assert len(sources) >= 3

    # Check that initial APH 2024-2027 instrument is registered
    aph_source = next((s for s in sources if "APH" in s["id"] or "Approval Process" in s["title"]), None)
    assert aph_source is not None
    assert aph_source["issuing_authority"] == "AICTE"
    assert aph_source["processing_status"] == "processed"
    assert len(aph_source["sha256_hash"]) == 64

    # Filter by category
    handbooks_res = client.get("/api/regulatory/sources?category=Handbook")
    assert handbooks_res.status_code == 200
    for s in handbooks_res.json()["data"]:
        assert s["category"] == "Handbook"


def test_get_source_detail():
    """Verify retrieving specific source detail."""
    res = client.get("/api/regulatory/sources/SRC-AICTE-APH-2024-27")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "SRC-AICTE-APH-2024-27"
    assert "clauses" in data
    assert len(data["clauses"]) >= 20


def test_ingest_regulatory_pdf_upload():
    """Test valid PDF upload, text extraction, page citation preservation, and audit logging."""
    sample_pages = [
        ("Section 1.1 Scope of Approval", "All technical education institutions shall adhere strictly to Central Council land norms."),
        ("Clause 3.4.2 Faculty Ratios", "The minimum faculty to student ratio for engineering undergraduate programs is established at 1:20.")
    ]
    pdf_bytes = make_test_pdf(sample_pages)

    files = {"file": ("test_gazette_2026.pdf", pdf_bytes, "application/pdf")}
    data = {
        "title": "Test AICTE Gazette 2026",
        "category": "Gazette Notification",
        "issuing_authority": "AICTE",
        "version": "2026.1",
        "effective_date": "2026-05-01"
    }

    res = client.post("/api/regulatory/sources/upload", files=files, data=data)
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "Test AICTE Gazette 2026"
    assert body["processing_status"] == "processed"
    assert body["clauses_extracted"] >= 2
    assert len(body["sha256_hash"]) == 64

    # Check clauses were inserted with exact page citations
    source_id = body["id"]
    clauses_res = client.get(f"/api/regulatory/sources/{source_id}/clauses")
    assert clauses_res.status_code == 200
    clauses = clauses_res.json()["data"]
    assert len(clauses) >= 2
    assert clauses[0]["page_number"] == 1
    assert "Scope of Approval" in (clauses[0]["heading"] or "")
    assert clauses[1]["page_number"] == 2
    assert "Faculty Ratios" in (clauses[1]["heading"] or "")


def test_duplicate_sha256_prevention():
    """Verify that uploading the exact same document twice is prevented with HTTP 409 Conflict."""
    pdf_bytes = make_test_pdf([("Clause 99 Duplicate Test", "Identical bytes test string.")])

    files = {"file": ("dup_test.pdf", pdf_bytes, "application/pdf")}
    data = {"title": "Unique Original PDF", "category": "Circular", "issuing_authority": "AICTE"}

    res1 = client.post("/api/regulatory/sources/upload", files=files, data=data)
    assert res1.status_code == 200

    # Second upload with identical bytes
    files_dup = {"file": ("dup_test_renamed.pdf", pdf_bytes, "application/pdf")}
    res2 = client.post("/api/regulatory/sources/upload", files=files_dup, data=data)
    assert res2.status_code == 409
    assert "already registered" in res2.json()["detail"].lower()


def test_corrupted_pdf_handling():
    """Verify that uploading corrupt bytes returns HTTP 400 without crashing."""
    corrupt_bytes = b"%PDF-1.4 Not a real PDF byte sequence corrupted header %%EOF garbage"
    files = {"file": ("corrupt.pdf", corrupt_bytes, "application/pdf")}
    data = {"title": "Corrupted Document", "category": "Circular"}

    res = client.post("/api/regulatory/sources/upload", files=files, data=data)
    assert res.status_code in [400, 422]


def test_scanned_ocr_detection():
    """Verify that a raster-image PDF without text triggers OCR requirement detection."""
    scanned_pdf = make_scanned_image_pdf()
    files = {"file": ("scanned_instrument.pdf", scanned_pdf, "application/pdf")}
    data = {"title": "Scanned AICTE Gazette", "category": "Gazette Notification"}

    res = client.post("/api/regulatory/sources/upload", files=files, data=data)
    assert res.status_code == 200
    body = res.json()
    assert body["ocr_required"] is True
    assert body["processing_status"] == "ocr_required"


def test_page_raster_image_rendering():
    """Verify high-res page image rendering endpoint."""
    res = client.get("/api/regulatory/sources/SRC-AICTE-APH-2024-27/page/1/image")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert len(res.content) > 1000

    # Test out-of-range page
    res_invalid = client.get("/api/regulatory/sources/SRC-AICTE-APH-2024-27/page/999/image")
    assert res_invalid.status_code == 404


def test_clause_search_and_filter():
    """Verify global clause search and filtering."""
    res = client.get("/api/regulatory/clauses?search=faculty")
    assert res.status_code == 200
    clauses = res.json()["data"]
    assert len(clauses) >= 1
    for c in clauses:
        combined = (c["verbatim_text"] + (c["heading"] or "") + (c["summary_rule"] or "")).lower()
        assert "faculty" in combined or "ratio" in combined or "teacher" in combined or "cadre" in combined


def test_clause_review_workflow_and_audit():
    """Verify updating a clause verification status records reviewer and preserves audit hash chain."""
    clauses_res = client.get("/api/regulatory/clauses?limit=1")
    assert clauses_res.status_code == 200
    clause = clauses_res.json()["data"][0]
    clause_id = clause["id"]

    review_payload = {
        "status": "verified",
        "reviewed_by": "Dr. S. Sharma (AICTE Technical Committee)",
        "notes": "Verified against official Gazette of India Extraordinary Notification."
    }

    review_res = client.post(f"/api/regulatory/clauses/{clause_id}/review", json=review_payload)
    assert review_res.status_code == 200
    updated = review_res.json()
    assert updated["verification_status"] == "verified"
    assert updated["reviewed_by"] == "Dr. S. Sharma (AICTE Technical Committee)"

    # Verify audit chain integrity
    with get_connection() as conn:
        chain_status = verify_audit_chain(conn)
        assert chain_status["verified"] is True


def test_supersession_workflow():
    """Verify linking supersession between instruments updates database and logs audit entry."""
    # Create two instruments
    pdf1 = make_test_pdf([("APH 2021 Norms", "Old land requirements: 10 Acres.")])
    pdf2 = make_test_pdf([("APH 2024 Norms", "New revised land requirements: 5 Acres.")])

    res1 = client.post(
        "/api/regulatory/sources/upload",
        files={"file": ("aph_2021.pdf", pdf1, "application/pdf")},
        data={"title": "Old APH 2021", "category": "Handbook", "version": "2021"}
    )
    res2 = client.post(
        "/api/regulatory/sources/upload",
        files={"file": ("aph_2024.pdf", pdf2, "application/pdf")},
        data={"title": "New APH 2024", "category": "Handbook", "version": "2024"}
    )

    id1 = res1.json()["id"]
    id2 = res2.json()["id"]

    # Mark id1 superseded by id2
    supersede_payload = {
        "superseded_by_id": id2,
        "notes": "Superceded under AICTE Council Resolution 2024."
    }
    sup_res = client.post(f"/api/regulatory/sources/{id1}/supersede", json=supersede_payload)
    assert sup_res.status_code == 200
    sup_data = sup_res.json()
    assert sup_data["superseded_by_id"] == id2

    # Verify that fetching id1 shows supersession link
    detail_res = client.get(f"/api/regulatory/sources/{id1}")
    assert detail_res.status_code == 200
    assert detail_res.json()["superseded_by_id"] == id2

    # Verify audit chain integrity
    with get_connection() as conn:
        chain_status = verify_audit_chain(conn)
        assert chain_status["verified"] is True


def test_remote_url_fetch_error_handling():
    """Verify that fetching an unreachable or invalid URL returns a descriptive error guiding to manual upload."""
    payload = {
        "url": "https://invalid-non-existent-domain-aicte-portal.gov.in/missing.pdf",
        "title": "Invalid URL Test"
    }
    res = client.post("/api/regulatory/sources/fetch", json=payload)
    assert res.status_code in [502, 400]
    assert "manual upload" in res.json()["detail"].lower()


def test_reviewer_authorization_enforcement():
    """Verify unauthorized actors (guest/unauthorized token) receive 403 on adjudication endpoints."""
    # Attempt clause review with guest role header -> 403
    review_res = client.post(
        "/api/regulatory/clauses/CLAUSE-TEST/review",
        json={"status": "verified", "reviewer_name": "Intruder"},
        headers={"X-Actor-Role": "guest"}
    )
    assert review_res.status_code == 403
    assert "privileges required" in review_res.json()["detail"].lower()

    # Attempt supersede with unauthorized bearer token -> 403
    sup_res = client.post(
        "/api/regulatory/sources/SRC-TEST/supersede",
        json={"superseded_by_id": "SRC-NEW"},
        headers={"Authorization": "Bearer unauthorized"}
    )
    assert sup_res.status_code == 403
    assert "credentials required" in sup_res.json()["detail"].lower()


def test_findings_statutory_provenance():
    """Verify compliance engine findings link directly to statutory evidence and sources."""
    res = client.get("/api/findings")
    assert res.status_code == 200
    data = res.json()["data"]
    if data:
        sample = data[0]
        # Check regulatory provenance fields exist on finding object
        assert "official_source_name" in sample
        assert "clause_reference" in sample
        assert "page_reference" in sample
        assert "source_verification_status" in sample
        assert "source_status" in sample

        # Check evidence detail endpoint returns regulatorySource
        ev_res = client.get(f"/api/findings/{sample['id']}/evidence")
        assert ev_res.status_code == 200
        ev_data = ev_res.json()["data"]
        assert "regulatorySource" in ev_data

