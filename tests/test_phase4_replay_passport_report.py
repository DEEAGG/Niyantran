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


# -------------------------------------------------------------
# Synthetic Document Helpers (SYNTHETIC DEMO DOCUMENT)
# -------------------------------------------------------------

def make_clean_pdf(land_area: str = "5.5 Acres", reg_no: str = "REG-2026-98765") -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 50), "SYNTHETIC DEMO DOCUMENT - AICTE Application Form", fontsize=14)
    page.insert_text(fitz.Point(50, 90), "Applicant Name: Apex Education Trust", fontsize=11)
    page.insert_text(fitz.Point(50, 130), "Regulatory Institution: Apex Institute of Technology", fontsize=11)
    page.insert_text(fitz.Point(50, 170), f"Registration Number: {reg_no}", fontsize=11)
    page.insert_text(fitz.Point(50, 210), "Address: Plot 42, Tech Park, Greater Noida, UP", fontsize=11)
    page.insert_text(fitz.Point(50, 250), f"Land Area: {land_area}", fontsize=11)
    page.insert_text(fitz.Point(50, 290), "Issue Date: 15/01/2026", fontsize=11)
    page.insert_text(fitz.Point(50, 330), "Expiry Date: 14/01/2031", fontsize=11)
    b = doc.tobytes()
    doc.close()
    return b


def make_clean_image() -> bytes:
    img = Image.new("RGB", (600, 300), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 30), "SYNTHETIC DEMO DOCUMENT - Board Resolution", fill=(0, 0, 0))
    draw.text((20, 80), "Regulatory Institution: Apex Institute of Technology", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def helper_setup_app(land_area: str = "5.5 Acres", reg_no: str = "REG-2026-98765") -> tuple[str, str]:
    app_res = client.post("/api/applications", json={"application_type": "New Technical Institution", "institution_name": "Apex Institute of Technology"})
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    pdf_bytes = make_clean_pdf(land_area=land_area, reg_no=reg_no)
    upload_res = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "application_form"},
        files={"file": ("app_form.pdf", pdf_bytes, "application/pdf")},
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    ext_res = client.post(f"/api/documents/{doc_id}/extract")
    assert ext_res.status_code == 200

    return app_id, doc_id


# =============================================================
# 1. Document Page Evidence Viewer Tests
# =============================================================

def test_page_viewer_valid_pdf_and_highlight():
    app_id, doc_id = helper_setup_app()

    # Normal page image fetch
    res = client.get(f"/api/documents/{doc_id}/page/1.png")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert len(res.content) > 1000

    # With bounding box highlight parameter
    res_bbox = client.get(f"/api/documents/{doc_id}/page/1.png?bbox=50,100,250,150")
    assert res_bbox.status_code == 200
    assert res_bbox.headers["content-type"] == "image/png"

    # Alias without .png extension
    res_alias = client.get(f"/api/documents/{doc_id}/page/1")
    assert res_alias.status_code == 200
    assert res_alias.headers["content-type"] == "image/png"


def test_page_viewer_image_document():
    app_id = client.post("/api/applications", json={"application_type": "New Institution"}).json()["id"]
    img_bytes = make_clean_image()
    upload_res = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "board_resolution"},
        files={"file": ("resolution.png", img_bytes, "image/png")},
    )
    doc_id = upload_res.json()["id"]

    res = client.get(f"/api/documents/{doc_id}/page/1.png?bbox=20,30,300,70")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert len(res.content) > 500


def test_page_viewer_access_controls_and_errors():
    app_id, doc_id = helper_setup_app()

    # Page 0 (out of range)
    res_zero = client.get(f"/api/documents/{doc_id}/page/0.png")
    assert res_zero.status_code == 400

    # Page 99 (exceeds page count)
    res_exceed = client.get(f"/api/documents/{doc_id}/page/99.png")
    assert res_exceed.status_code == 400
    assert "out of range" in res_exceed.json()["detail"].lower()

    # Non-existent document
    res_nonexistent = client.get("/api/documents/DOC-NONEXISTENT-999/page/1.png")
    assert res_nonexistent.status_code == 404


# =============================================================
# 2. Validation Replay & Diff Engine Tests
# =============================================================

def test_validation_replay_lifecycle_and_diffs():
    # 1. Setup app with 5.5 Acres land
    app_id, doc_id = helper_setup_app(land_area="5.5 Acres")

    # Get baseline ruleset (Ruleset v1: requires 5.0 Acres)
    v1_rs = client.get("/api/rulesets/active").json()
    v1_id = v1_rs["id"]

    # Validate under v1
    val1 = client.post(f"/api/applications/{app_id}/validate", json={"ruleset_id": v1_id}).json()
    val1_id = val1["id"]
    val1_findings = {f["rule_key"]: f for f in val1["findings"]}
    assert val1_findings["R-LAND-AREA"]["status"] == "pass"

    # 2. Create Ruleset v2 with higher threshold (6.0 Acres)
    suffix = uuid.uuid4().hex[:6].upper()
    r_land_v2 = client.post(
        "/api/rules",
        json={
            "rule_key": f"R-LAND-AREA-V2-{suffix}",
            "version": 1,
            "title": "Strict Land Area Threshold",
            "description": "Requires minimum 6.0 Acres",
            "rule_type": "numeric_threshold",
            "parameters": {"field_key": "land_area", "operator": "gte", "value": 6.0, "unit": "Acres"},
            "severity": "high",
            "source_status": "DEMO-ILLUSTRATIVE",
        },
    ).json()

    # Include other existing rules plus the stricter land rule
    v2_rule_ids = [r["id"] for r in v1_rs["rules"] if r["rule_key"] != "R-LAND-AREA"] + [r_land_v2["id"]]
    v2_rs = client.post(
        "/api/rulesets",
        json={"name": f"Ruleset v2 Strict {suffix}", "version": 2, "status": "approved", "rule_ids": v2_rule_ids},
    ).json()
    v2_id = v2_rs["id"]

    # 3. Execute Replay against Ruleset v2
    replay_res = client.post(
        f"/api/applications/{app_id}/replay",
        json={"to_ruleset_id": v2_id, "from_ruleset_id": v1_id, "actor": "regulatory_auditor"},
    )
    assert replay_res.status_code == 200
    replay_data = replay_res.json()

    assert replay_data["status"] == "completed"
    assert replay_data["application_id"] == app_id
    assert replay_data["previous_validation_run_id"] == val1_id
    assert replay_data["new_validation_run_id"] != val1_id
    assert replay_data["has_changes"] is True
    assert len(replay_data["diffs"]) > 0

    # 4. Verify historical run was preserved (not overwritten)
    all_runs = client.get(f"/api/applications/{app_id}/validation-runs").json()
    assert len(all_runs) >= 2
    assert any(r["id"] == val1_id for r in all_runs)
    assert any(r["id"] == replay_data["new_validation_run_id"] for r in all_runs)

    # 5. Check replay diff details and explanation
    diffs = replay_data["diffs"]
    new_issue_diff = next((d for d in diffs if d["diff_type"] in ("new_issue", "outcome_changed")), None)
    assert new_issue_diff is not None
    assert new_issue_diff["needs_attention"] is True
    assert "explanation" in new_issue_diff

    # 6. Verify single replay retrieval API
    rep_get = client.get(f"/api/replays/{replay_data['id']}")
    assert rep_get.status_code == 200
    assert rep_get.json()["id"] == replay_data["id"]

    # 7. Verify application replays listing
    app_reps = client.get(f"/api/applications/{app_id}/replays")
    assert app_reps.status_code == 200
    assert any(r["id"] == replay_data["id"] for r in app_reps.json())


def test_batch_replay_endpoint():
    app_id1, _ = helper_setup_app(land_area="5.5 Acres")
    app_id2, _ = helper_setup_app(land_area="7.0 Acres")

    # Validate both under active ruleset
    v1_id = client.get("/api/rulesets/active").json()["id"]
    client.post(f"/api/applications/{app_id1}/validate", json={"ruleset_id": v1_id})
    client.post(f"/api/applications/{app_id2}/validate", json={"ruleset_id": v1_id})

    # Batch replay
    batch_res = client.post(
        "/api/replay",
        json={"to_ruleset_id": v1_id, "application_ids": [app_id1, app_id2]},
    )
    assert batch_res.status_code == 200
    data = batch_res.json()
    assert data["applications_processed"] == 2
    assert "replays" in data


# =============================================================
# 3. Evidence Passport Tests
# =============================================================

def test_evidence_passport_completeness():
    app_id, doc_id = helper_setup_app(land_area="5.5 Acres")

    # Validate and record a reviewer decision
    val_res = client.post(f"/api/applications/{app_id}/validate").json()
    finding_id = val_res["findings"][0]["id"]
    client.post(f"/api/findings/{finding_id}/decision", json={"decision": "resolved", "reason": "Verified on site"})

    # Fetch Evidence Passport
    passport_res = client.get(f"/api/applications/{app_id}/passport")
    assert passport_res.status_code == 200
    passport = passport_res.json()

    # 1. Application metadata
    assert passport["application"]["id"] == app_id
    assert "application_type" in passport["application"]

    # 2. Evidence summary
    summary = passport["evidence_summary"]
    assert summary["total_documents_registered"] >= 1
    assert summary["total_fields_extracted"] >= 5
    assert summary["audit_chain_verified"] is True

    # 3. Documents list with sha256
    docs = passport["documents"]
    assert len(docs) >= 1
    assert docs[0]["id"] == doc_id
    assert len(docs[0]["sha256"]) == 64

    # 4. Extracted fields with provenance
    fields = passport["extracted_fields"]
    assert len(fields) >= 5
    first_field = fields[0]
    assert "field_name" in first_field
    assert "confidence" in first_field
    assert "page_number" in first_field
    assert "extraction_method" in first_field

    # 5. Validation history & current findings
    assert len(passport["validation_history"]) >= 1
    assert len(passport["current_findings"]) >= 1

    # 6. Decisions
    assert len(passport["decisions"]) >= 1
    assert passport["decisions"][0]["decision"] == "resolved"

    # 7. Audit verification
    assert passport["audit_verification"]["verified"] is True

    # 8. Regulatory disclaimer
    assert "Official AICTE Statutory Verification" in passport["disclaimer"] or "DEMO-ILLUSTRATIVE" in passport["disclaimer"]


def test_evidence_passport_nonexistent_application():
    res = client.get("/api/applications/APP-NONEXISTENT-999/passport")
    assert res.status_code == 404
    assert res.json()["detail"] == "Application not found"


# =============================================================
# 4. Standalone Printable Report Tests
# =============================================================

def test_html_report_generation():
    app_id, doc_id = helper_setup_app()
    client.post(f"/api/applications/{app_id}/validate")

    report_res = client.get(f"/api/applications/{app_id}/report")
    assert report_res.status_code == 200
    assert "text/html" in report_res.headers["content-type"]
    html = report_res.text

    # Verify key sections and regulatory labels in report
    assert "NIYANTRAN COMPLIANCE VERIFICATION REPORT" in html
    assert "STATUTORY AUDIT DOSSIER" in html or "SYNTHETIC DEMO DOCUMENT" in html
    assert app_id in html
    assert "Document Checklist & Cryptographic Provenance" in html
    assert "Structured Fields & Extraction Provenance" in html
    assert "Regulatory Compliance Validation Findings" in html
    assert "Clause:" in html
    assert "Cryptographic Tamper-Evident Audit Verification" in html
    assert "Official Regulatory" in html


def test_html_report_nonexistent_application():
    res = client.get("/api/applications/APP-NONEXISTENT-999/report")
    assert res.status_code == 404
    assert res.json()["detail"] == "Application not found"
