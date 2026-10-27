import io
import json
import uuid
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
import fitz

from app.main import app
from app.db import get_connection, verify_audit_chain

client = TestClient(app)


def make_clean_synthetic_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 50), "SYNTHETIC DEMO DOCUMENT - AICTE Standard Form", fontsize=14)
    page.insert_text(fitz.Point(50, 90), "Institution: Demo Engineering College", fontsize=11)
    b = doc.tobytes()
    doc.close()
    return b


def make_suspicious_metadata_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 50), "SYNTHETIC DEMO DOCUMENT - Altered Certificate", fontsize=14)
    doc.set_metadata({
        "producer": "iLovePDF Online Editor Suite v4.2",
        "creator": "Photoshop PDF Export",
        "creationDate": "D:20261025120000Z",
        "modDate": "D:20261024120000Z",  # Inverted: mod date earlier than creation!
    })
    b = doc.tobytes()
    doc.close()
    return b


def make_signed_synthetic_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 50), "SYNTHETIC DEMO DOCUMENT - Digitally Signed Approval", fontsize=14)
    # Add a signature widget structure
    w = fitz.Widget()
    w.field_type = fitz.PDF_WIDGET_TYPE_SIGNATURE
    w.field_name = "DigitalSignature_Auth"
    w.rect = fitz.Rect(50, 100, 200, 150)
    page.add_widget(w)
    b = doc.tobytes()
    doc.close()
    return b


def helper_create_doc(pdf_bytes: bytes, doc_type: str = "application_form") -> tuple[str, str]:
    app_res = client.post("/api/applications", json={"application_type": "Technical Approval"})
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    upload_res = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": doc_type},
        files={"file": ("synth_doc.pdf", pdf_bytes, "application/pdf")},
    )
    assert upload_res.status_code == 201
    return app_id, upload_res.json()["id"]


# =============================================================
# 1. Duplicate-Document Detection Tests
# =============================================================

def test_duplicate_document_detection_across_applications():
    pdf_bytes = make_clean_synthetic_pdf()

    # Upload to Application 1
    app1_id, doc1_id = helper_create_doc(pdf_bytes, "land_document")

    # Initial authenticity check for doc1: unique
    auth1_res = client.get(f"/api/documents/{doc1_id}/authenticity")
    assert auth1_res.status_code == 200
    signals1 = {s["signal_type"]: s for s in auth1_res.json()["signals"]}
    assert signals1["duplicate_check"]["result"] == "ok"
    assert signals1["duplicate_check"]["details"]["duplicate_detected"] is False

    # Upload exact same physical file to Application 2
    app2_id, doc2_id = helper_create_doc(pdf_bytes, "land_document")

    # Re-evaluate doc1 authenticity: should now flag duplicate in app2
    auth1_recheck = client.post(f"/api/documents/{doc1_id}/authenticity/evaluate")
    assert auth1_recheck.status_code == 200
    signals1_updated = {s["signal_type"]: s for s in auth1_recheck.json()["signals"]}
    assert signals1_updated["duplicate_check"]["result"] == "warning"
    assert signals1_updated["duplicate_check"]["details"]["duplicate_detected"] is True
    assert signals1_updated["duplicate_check"]["details"]["cross_application_duplicates"] >= 1
    matches = signals1_updated["duplicate_check"]["details"]["matches"]
    assert any(m["application_id"] == app2_id for m in matches)

    # Check doc2 authenticity also reports duplicate
    auth2_res = client.get(f"/api/documents/{doc2_id}/authenticity")
    signals2 = {s["signal_type"]: s for s in auth2_res.json()["signals"]}
    assert signals2["duplicate_check"]["result"] == "warning"


# =============================================================
# 2. Authenticity Signals Tests (File Hash, Metadata, Signatures)
# =============================================================

def test_file_hash_integrity_signal():
    pdf_bytes = make_clean_synthetic_pdf()
    app_id, doc_id = helper_create_doc(pdf_bytes)

    res = client.get(f"/api/documents/{doc_id}/authenticity")
    assert res.status_code == 200
    signals = {s["signal_type"]: s for s in res.json()["signals"]}

    hash_sig = signals["file_hash"]
    assert hash_sig["result"] == "ok"
    assert hash_sig["details"]["intact"] is True
    assert "disclaimer" in hash_sig["details"]
    # Verify honest limitation statement
    assert "does not verify origin" in hash_sig["details"]["disclaimer"].lower()


def test_metadata_anomaly_screening():
    # Clean PDF metadata
    clean_bytes = make_clean_synthetic_pdf()
    app_id, clean_doc_id = helper_create_doc(clean_bytes)
    res_clean = client.get(f"/api/documents/{clean_doc_id}/authenticity")
    clean_sig = next(s for s in res_clean.json()["signals"] if s["signal_type"] == "metadata_anomaly")
    assert clean_sig["result"] == "ok"

    # Suspicious PDF metadata (iLovePDF, Photoshop, inverted dates)
    suspicious_bytes = make_suspicious_metadata_pdf()
    app_id2, susp_doc_id = helper_create_doc(suspicious_bytes)
    res_susp = client.get(f"/api/documents/{susp_doc_id}/authenticity")
    susp_sig = next(s for s in res_susp.json()["signals"] if s["signal_type"] == "metadata_anomaly")

    assert susp_sig["result"] == "notice"
    assert susp_sig["details"]["has_anomalies"] is True
    anomalies = " ".join(susp_sig["details"]["anomalies_detected"]).lower()
    assert "ilovepdf" in anomalies or "photoshop" in anomalies or "chronologically earlier" in anomalies


def test_digital_signature_signal():
    # Document without signatures
    clean_bytes = make_clean_synthetic_pdf()
    app_id, doc_clean_id = helper_create_doc(clean_bytes)
    res_clean = client.get(f"/api/documents/{doc_clean_id}/authenticity")
    sig_clean = next(s for s in res_clean.json()["signals"] if s["signal_type"] == "digital_signature")
    assert sig_clean["result"] == "not_available"
    assert sig_clean["details"]["signatures_count"] == 0

    # Document with digital signature widget
    signed_bytes = make_signed_synthetic_pdf()
    app_id2, doc_signed_id = helper_create_doc(signed_bytes)
    res_signed = client.get(f"/api/documents/{doc_signed_id}/authenticity")
    sig_signed = next(s for s in res_signed.json()["signals"] if s["signal_type"] == "digital_signature")

    assert sig_signed["result"] == "present_unverified"
    assert sig_signed["details"]["signatures_count"] >= 1
    assert sig_signed["details"]["signer_identity_verified"] is False
    assert "root ca" in sig_signed["details"]["disclaimer"].lower()


def test_honest_authenticity_disclaimers():
    pdf_bytes = make_clean_synthetic_pdf()
    app_id, doc_id = helper_create_doc(pdf_bytes)

    res = client.get(f"/api/documents/{doc_id}/authenticity")
    assert res.status_code == 200
    data = res.json()

    # Never declare genuine or forged based on hashes or heuristics alone
    assert "genuine or forged" in data["disclaimer"].lower()
    for s in data["signals"]:
        assert "disclaimer" in s["details"]


# =============================================================
# 3. Manual Verification Tests
# =============================================================

def test_manual_verification_lifecycle_and_audit():
    pdf_bytes = make_clean_synthetic_pdf()
    app_id, doc_id = helper_create_doc(pdf_bytes)

    # 1. Record manual verification
    payload = {
        "verification_type": "physical_inspection",
        "result": "verified",
        "verifier": "inspector_patel",
        "evidence_reference": "DEED-INSP-2026/889",
        "notes": "Verified original land registration ledger at Sub-Registrar office on 25 Oct 2026.",
    }
    post_res = client.post(f"/api/documents/{doc_id}/manual-verification", json=payload)
    assert post_res.status_code == 201
    ver_data = post_res.json()
    assert ver_data["id"].startswith("MVER-")
    assert ver_data["document_id"] == doc_id
    assert ver_data["result"] == "verified"
    assert ver_data["verifier"] == "inspector_patel"

    # 2. List document verifications
    doc_ver_res = client.get(f"/api/documents/{doc_id}/manual-verification")
    assert doc_ver_res.status_code == 200
    doc_vers = doc_ver_res.json()
    assert len(doc_vers) >= 1
    assert any(v["id"] == ver_data["id"] for v in doc_vers)

    # 3. List application-level verifications
    app_ver_res = client.get(f"/api/applications/{app_id}/manual-verifications")
    assert app_ver_res.status_code == 200
    app_vers = app_ver_res.json()
    assert len(app_vers) >= 1
    assert any(v["id"] == ver_data["id"] for v in app_vers)

    # 4. Check cryptographic audit chain integrity
    with get_connection() as conn:
        chain_status = verify_audit_chain(conn)
        assert chain_status["verified"] is True
        assert chain_status["total_records"] > 0


def test_manual_verification_validation_errors():
    pdf_bytes = make_clean_synthetic_pdf()
    app_id, doc_id = helper_create_doc(pdf_bytes)

    # Invalid result choice
    bad_res = client.post(
        f"/api/documents/{doc_id}/manual-verification",
        json={"verification_type": "registry_check", "result": "invalid_result_choice", "verifier": "auditor"},
    )
    assert bad_res.status_code == 422

    # Empty verifier
    bad_verifier = client.post(
        f"/api/documents/{doc_id}/manual-verification",
        json={"verification_type": "registry_check", "result": "verified", "verifier": "   "},
    )
    assert bad_verifier.status_code in (400, 422)

    # Non-existent document
    nonexistent = client.post(
        "/api/documents/DOC-DOESNOTEXIST-999/manual-verification",
        json={"verification_type": "registry_check", "result": "verified", "verifier": "auditor"},
    )
    assert nonexistent.status_code == 404


# =============================================================
# 4. Security, Path Safety & Upload Edge Cases Tests
# =============================================================

def test_upload_security_malformed_and_wrong_signature():
    app_res = client.post("/api/applications", json={"application_type": "Technical Approval"})
    app_id = app_res.json()["id"]

    # PDF with wrong magic bytes
    res_fake_pdf = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "form"},
        files={"file": ("fake.pdf", b"NOT_A_PDF_STREAM", "application/pdf")},
    )
    assert res_fake_pdf.status_code == 400
    assert "signature" in res_fake_pdf.json()["detail"].lower()

    # PNG with wrong magic bytes
    res_fake_png = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "form"},
        files={"file": ("fake.png", b"NOT_PNG_BYTES", "image/png")},
    )
    assert res_fake_png.status_code == 400
    assert "signature" in res_fake_png.json()["detail"].lower()


def test_path_traversal_sanitization():
    app_res = client.post("/api/applications", json={"application_type": "Technical Approval"})
    app_id = app_res.json()["id"]
    pdf_bytes = make_clean_synthetic_pdf()

    # Filename attempting directory traversal
    res = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "form"},
        files={"file": ("../../../../etc/passwd.pdf", pdf_bytes, "application/pdf")},
    )
    assert res.status_code == 201
    doc_data = res.json()
    # Must be stripped to safe basename
    assert doc_data["original_filename"] == "passwd.pdf"
    assert not doc_data["stored_path"].startswith("..")
    assert not doc_data["stored_path"].startswith("/")


def test_authenticity_nonexistent_document_returns_404():
    res = client.get("/api/documents/DOC-NONEXISTENT-999/authenticity")
    assert res.status_code == 404

    res2 = client.post("/api/documents/DOC-NONEXISTENT-999/authenticity/evaluate")
    assert res2.status_code == 404
