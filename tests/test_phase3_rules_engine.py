import io
import json
from datetime import datetime, timezone
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
import fitz

from app.main import app
from app.db import get_connection, verify_audit_chain

client = TestClient(app)


# -------------------------------------------------------------
# Synthetic Document Helpers (SYNTHETIC DEMO DOCUMENT)
# -------------------------------------------------------------

def make_clean_application_form_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 50), "SYNTHETIC DEMO DOCUMENT - AICTE Application Form", fontsize=14)
    page.insert_text(fitz.Point(50, 90), "Applicant Name: Apex Education Trust", fontsize=11)
    page.insert_text(fitz.Point(50, 130), "Regulatory Institution: Apex Institute of Technology", fontsize=11)
    page.insert_text(fitz.Point(50, 170), "Registration Number: REG-2026-98765", fontsize=11)
    page.insert_text(fitz.Point(50, 210), "Address: Plot 42, Tech Park, Greater Noida, UP", fontsize=11)
    page.insert_text(fitz.Point(50, 250), "Land Area: 5.5 Acres", fontsize=11)
    page.insert_text(fitz.Point(50, 290), "Issue Date: 15/01/2026", fontsize=11)
    page.insert_text(fitz.Point(50, 330), "Expiry Date: 14/01/2031", fontsize=11)
    page.insert_text(fitz.Point(50, 370), "Intake Capacity: 60", fontsize=11)
    b = doc.tobytes()
    doc.close()
    return b


def make_clean_land_document_pdf(area_text: str = "5.5 Acres") -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 50), "SYNTHETIC DEMO DOCUMENT - Land Allotment Certificate", fontsize=14)
    page.insert_text(fitz.Point(50, 90), "Applicant Name: Apex Education Trust", fontsize=11)
    page.insert_text(fitz.Point(50, 130), "Regulatory Institution: Apex Institute of Technology", fontsize=11)
    page.insert_text(fitz.Point(50, 170), f"Land Area: {area_text}", fontsize=11)
    page.insert_text(fitz.Point(50, 210), "Address: Plot 42, Tech Park, Greater Noida, UP", fontsize=11)
    b = doc.tobytes()
    doc.close()
    return b


def make_clean_reg_certificate_pdf(reg_no: str = "REG-2026-98765", expiry: str = "14/01/2031") -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 50), "SYNTHETIC DEMO DOCUMENT - Society Registration Certificate", fontsize=14)
    page.insert_text(fitz.Point(50, 90), "Applicant Name: Apex Education Trust", fontsize=11)
    page.insert_text(fitz.Point(50, 130), "Regulatory Institution: Apex Institute of Technology", fontsize=11)
    page.insert_text(fitz.Point(50, 170), f"Registration Number: {reg_no}", fontsize=11)
    page.insert_text(fitz.Point(50, 210), f"Expiry Date: {expiry}", fontsize=11)
    b = doc.tobytes()
    doc.close()
    return b


def helper_setup_application_with_docs(docs: list[tuple[str, str, bytes]]) -> str:
    """Creates an application, uploads each doc, runs extraction on each, and returns application_id."""
    app_res = client.post("/api/applications", json={"application_type": "New Technical Institution"})
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    for doc_type, filename, content in docs:
        upload_res = client.post(
            f"/api/applications/{app_id}/documents",
            data={"document_type": doc_type},
            files={"file": (filename, content, "application/pdf")},
        )
        assert upload_res.status_code == 201
        doc_id = upload_res.json()["id"]

        ext_res = client.post(f"/api/documents/{doc_id}/extract")
        assert ext_res.status_code == 200

    return app_id


# =============================================================
# 1. Rule & Rule Source Register Management Tests
# =============================================================

def test_rule_source_register_and_seed_rules():
    # Verify default seed rules exist
    res = client.get("/api/rules")
    assert res.status_code == 200
    rules = res.json()
    assert len(rules) >= 6

    # Verify seed rules are properly registered
    for r in rules:
        assert r["source_status"] in ["DEMO-ILLUSTRATIVE", "STATUTORY_NORM", "OFFICIAL_STATUTORY_NORM", "UNVERIFIED"]

    # Verify Rule Source Register endpoint
    sources_res = client.get("/api/rule-sources")
    assert sources_res.status_code == 200
    sources = sources_res.json()
    assert len(sources) >= 6
    for s in sources:
        assert s["verification_status"] in ["unverified", "verified"]
        assert s.get("official_source_name") is not None or s.get("clause_reference") is not None


def test_create_custom_rule_and_immutability():
    import uuid
    suffix = uuid.uuid4().hex[:6].upper()
    rule_key = f"R-CUSTOM-{suffix}"
    payload = {
        "rule_key": rule_key,
        "version": 1,
        "title": "Illustrative Faculty Ratio",
        "description": "Demonstration rule for faculty cadre ratio",
        "rule_type": "numeric_threshold",
        "parameters": {"field_key": "faculty_ratio", "operator": "gte", "value": 15.0},
        "severity": "medium",
        "source_status": "DEMO-ILLUSTRATIVE",
        "clause_reference": "DEMO-ILLUSTRATIVE-7.1",
        "verification_status": "unverified",
        "review_notes": "DEMO-ILLUSTRATIVE - illustrative demo rule, not an official regulatory requirement",
    }
    create_res = client.post("/api/rules", json=payload)
    assert create_res.status_code == 201
    created_rule = create_res.json()
    assert created_rule["rule_key"] == rule_key
    assert created_rule["version"] == 1
    assert created_rule["source_status"] == "DEMO-ILLUSTRATIVE"

    # Attempt duplicate (same rule_key and version) -> should fail (immutable)
    dup_res = client.post("/api/rules", json=payload)
    assert dup_res.status_code == 400

    # Creating version 2 should succeed
    payload["version"] = 2
    v2_res = client.post("/api/rules", json=payload)
    assert v2_res.status_code == 201
    assert v2_res.json()["version"] == 2


# =============================================================
# 2. Ruleset Lifecycle & Activation Tests
# =============================================================

def test_ruleset_lifecycle_and_activation():
    import uuid
    # Active ruleset exists
    active_res = client.get("/api/rulesets/active")
    assert active_res.status_code == 200
    active_rs = active_res.json()
    assert active_rs["status"] == "active"
    assert len(active_rs["rules"]) >= 6

    # Create new draft ruleset with unique name
    rules = client.get("/api/rules").json()
    rule_ids = [r["id"] for r in rules[:3]]
    draft_name = f"Strict Pilot Ruleset {uuid.uuid4().hex[:6]}"
    draft_res = client.post(
        "/api/rulesets",
        json={"name": draft_name, "version": 2, "status": "draft", "rule_ids": rule_ids},
    )
    assert draft_res.status_code == 201
    new_rset_id = draft_res.json()["id"]
    assert draft_res.json()["status"] == "draft"

    # Activate new ruleset
    act_res = client.post(f"/api/rulesets/{new_rset_id}/activate")
    assert act_res.status_code == 200
    assert act_res.json()["status"] == "active"

    # Verify previous active ruleset was retired
    prev_rs_check = client.get(f"/api/rulesets/{active_rs['id']}")
    assert prev_rs_check.json()["status"] == "retired"

    # Restore baseline ruleset active
    client.post(f"/api/rulesets/{active_rs['id']}/activate")


# =============================================================
# 3. Synthetic Pass Scenario
# =============================================================

def test_validation_pass_scenario():
    # Application with all required docs, valid land (5.5 >= 5.0), valid format, active expiry, matching reg no
    app_id = helper_setup_application_with_docs([
        ("application_form", "app_form.pdf", make_clean_application_form_pdf()),
        ("land_document", "land_doc.pdf", make_clean_land_document_pdf("5.5 Acres")),
        ("registration_certificate", "reg_cert.pdf", make_clean_reg_certificate_pdf("REG-2026-98765", "14/01/2031")),
        ("approval_document", "approval.pdf", make_clean_application_form_pdf()),
        ("affiliation_document", "affiliation.pdf", make_clean_application_form_pdf()),
    ])

    val_res = client.post(f"/api/applications/{app_id}/validate")
    assert val_res.status_code == 200
    data = val_res.json()

    assert data["status"] == "completed"
    assert data["summary"]["fail"] == 0
    assert data["summary"]["pass"] >= 5

    # Check findings details
    findings_res = client.get(f"/api/applications/{app_id}/findings")
    assert findings_res.status_code == 200
    findings = findings_res.json()

    for f in findings:
        assert f["source_status"] in ("DEMO-ILLUSTRATIVE", "OFFICIAL_STATUTORY_NORM")
        assert f["status"] in ("pass", "unverified")
        assert "evidence" in f
        assert "fingerprint" in f

    # Check application status updated
    app_data = client.get(f"/api/applications/{app_id}").json()
    assert app_data["status"] in ("validated", "verified")


# =============================================================
# 4. Synthetic Fail Scenario: Numeric Threshold Not Met
# =============================================================

def test_validation_fail_numeric_threshold():
    # Land area is 3.5 Acres, which is below the required 5.0 Acres threshold
    app_id = helper_setup_application_with_docs([
        ("application_form", "app_form.pdf", make_clean_application_form_pdf()),
        ("land_document", "land_doc.pdf", make_clean_land_document_pdf("3.5 Acres")),
        ("registration_certificate", "reg_cert.pdf", make_clean_reg_certificate_pdf()),
    ])

    val_res = client.post(f"/api/applications/{app_id}/validate")
    assert val_res.status_code == 200
    findings = val_res.json()["findings"]

    threshold_finding = next(f for f in findings if f["code"] == "THRESHOLD_NOT_MET")
    assert threshold_finding["status"] == "fail"
    assert threshold_finding["severity"] == "high"
    assert "3.5" in threshold_finding["message"]
    assert "5.0" in threshold_finding["message"]
    assert threshold_finding["recommendation"] is not None
    assert threshold_finding["evidence"]["actual_value"] == 3.5


# =============================================================
# 5. Synthetic Fail Scenario: Expired Document
# =============================================================

def test_validation_fail_expired_document():
    # Certificate with expiry in the past: 15/01/2023
    app_id = helper_setup_application_with_docs([
        ("application_form", "app_form.pdf", make_clean_application_form_pdf()),
        ("land_document", "land_doc.pdf", make_clean_land_document_pdf("5.5 Acres")),
        ("registration_certificate", "expired_cert.pdf", make_clean_reg_certificate_pdf("REG-2026-98765", "15/01/2023")),
    ])

    val_res = client.post(f"/api/applications/{app_id}/validate")
    assert val_res.status_code == 200
    findings = val_res.json()["findings"]

    expired_finding = next(f for f in findings if f["code"] == "DOCUMENT_EXPIRED")
    assert expired_finding["status"] == "fail"
    assert expired_finding["severity"] == "high"
    assert "expired" in expired_finding["message"].lower()
    assert "renewed certificate" in expired_finding["recommendation"].lower()


# =============================================================
# 6. Synthetic Missing Evidence Scenario (Produces UNVERIFIED, not false mismatch)
# =============================================================

def test_validation_missing_evidence_unverified():
    # Only upload application form (land_document and registration_certificate are missing)
    app_id = helper_setup_application_with_docs([
        ("application_form", "app_form.pdf", make_clean_application_form_pdf()),
    ])

    val_res = client.post(f"/api/applications/{app_id}/validate")
    assert val_res.status_code == 200
    findings = val_res.json()["findings"]

    # Missing mandatory documents fail required_document
    missing_docs = [f for f in findings if f["code"] == "MISSING_DOCUMENT"]
    assert len(missing_docs) >= 1

    # Cross-document match must produce UNVERIFIED (INSUFFICIENT_EVIDENCE), NOT a false mismatch!
    cross_finding = next(f for f in findings if f["rule_key"] == "R-CROSS-REG-NO")
    assert cross_finding["status"] == "unverified"
    assert cross_finding["code"] == "INSUFFICIENT_EVIDENCE"
    assert "cross-document comparison requires at least 2 documents" in cross_finding["message"]
    assert cross_finding["status"] != "fail"


# =============================================================
# 7. Synthetic Cross-Document Mismatch Scenario
# =============================================================

def test_validation_cross_document_mismatch():
    # Form has REG-2026-98765, Certificate has REG-2026-11111 (conflicting IDs)
    app_id = helper_setup_application_with_docs([
        ("application_form", "app_form.pdf", make_clean_application_form_pdf()),
        ("land_document", "land_doc.pdf", make_clean_land_document_pdf("5.5 Acres")),
        ("registration_certificate", "mismatched_cert.pdf", make_clean_reg_certificate_pdf("REG-2026-11111")),
    ])

    val_res = client.post(f"/api/applications/{app_id}/validate")
    assert val_res.status_code == 200
    findings = val_res.json()["findings"]

    cross_mismatch = next(f for f in findings if f["code"] == "CROSS_DOC_MISMATCH")
    assert cross_mismatch["status"] == "fail"
    assert cross_mismatch["severity"] == "high"
    assert "mismatch" in cross_mismatch["message"].lower()
    assert cross_mismatch["evidence"]["comparisons"][0]["match"] is False


# =============================================================
# 8. Reviewer Decisions & Audit Trail Verification Tests
# =============================================================

def test_finding_decision_recording_and_audit():
    # Setup application and validate
    app_id = helper_setup_application_with_docs([
        ("application_form", "app_form.pdf", make_clean_application_form_pdf()),
        ("land_document", "land_doc.pdf", make_clean_land_document_pdf("3.5 Acres")),
    ])

    val_res = client.post(f"/api/applications/{app_id}/validate")
    finding_id = val_res.json()["findings"][0]["id"]

    # Record decision
    dec_res = client.post(
        f"/api/findings/{finding_id}/decision",
        json={"decision": "resolved", "reason": "Institution acquired adjacent parcel by lease deed", "actor": "senior_officer"},
    )
    assert dec_res.status_code == 200
    dec_data = dec_res.json()
    assert dec_data["decision"] == "resolved"
    assert dec_data["actor"] == "senior_officer"

    # Fetch finding and check attached decision
    f_res = client.get(f"/api/findings/{finding_id}")
    assert f_res.status_code == 200
    assert f_res.json()["decision"]["decision"] == "resolved"

    # Verify cryptographic audit chain integrity
    with get_connection() as conn:
        verify_result = verify_audit_chain(conn)
        assert verify_result["verified"] is True
        assert verify_result["total_records"] > 0


# =============================================================
# 9. Invalid Inputs & Edge Cases Tests
# =============================================================

def test_invalid_inputs_handling():
    # Validate non-existent application
    res1 = client.post("/api/applications/APP-NONEXISTENT-999/validate")
    assert res1.status_code == 404

    # Validate with non-existent ruleset
    app_res = client.post("/api/applications", json={"application_type": "New Institution"})
    app_id = app_res.json()["id"]
    res2 = client.post(f"/api/applications/{app_id}/validate", json={"ruleset_id": "RSET-NONEXISTENT"})
    assert res2.status_code == 404

    # Query non-existent finding
    res3 = client.get("/api/findings/FIND-NONEXISTENT-999")
    assert res3.status_code == 404

    # Record decision on non-existent finding
    res4 = client.post("/api/findings/FIND-NONEXISTENT/decision", json={"decision": "resolved"})
    assert res4.status_code == 404

    # Record decision with invalid decision string
    res5 = client.post("/api/findings/FIND-NONEXISTENT/decision", json={"decision": "invalid_choice"})
    assert res5.status_code in (404, 422)
