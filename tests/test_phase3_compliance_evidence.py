import io
import json
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
import fitz

from app.main import app
from app.db import get_connection, verify_audit_chain, add_audit_entry
from app.extractor import extract_document_fields
from app.rules_engine import evaluate_ruleset, seed_default_rules_if_empty

client = TestClient(app)


def make_synthetic_pdf(title: str, text_lines: list[str]) -> bytes:
    """Creates a clearly labelled synthetic PDF for compliance testing."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 50), "[SYNTHETIC TEST DOCUMENT - NIYANTRAN PHASE 3]", fontsize=10, color=(0.4, 0.4, 0.4))
    page.insert_text(fitz.Point(50, 85), title, fontsize=15, color=(0.1, 0.3, 0.2))

    y = 125
    for line in text_lines:
        page.insert_text(fitz.Point(50, y), line, fontsize=11, color=(0.15, 0.15, 0.15))
        y += 24

    page.insert_text(fitz.Point(50, 800), "[SYNTHETIC TEST DOCUMENT - REGULATORY COMPLIANCE VERIFICATION ONLY]", fontsize=8, color=(0.5, 0.5, 0.5))
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def helper_upload_and_extract(app_id: str, doc_type: str, filename: str, content: bytes) -> str:
    upload_res = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": doc_type},
        files={"file": (filename, content, "application/pdf")},
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    ext_res = client.post(f"/api/documents/{doc_id}/extract")
    assert ext_res.status_code == 200
    return doc_id


def test_compliant_application_full_evidence_and_citations():
    """Verify that a compliant application passes all checks and findings link to citations."""
    app_res = client.post("/api/applications", json={
        "institution_name": "[SYNTHETIC TEST] Saraswati Technical Institute",
        "application_type": "New Technical Institution",
        "applicant_name": "Saraswati Educational Trust",
    })
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    # Upload Form
    form_pdf = make_synthetic_pdf("[SYNTHETIC TEST] AICTE Application Form 2026", [
        "Applicant Name: Saraswati Educational Trust",
        "Institution Name: [SYNTHETIC TEST] Saraswati Technical Institute",
        "Registration Number: INST-9001",
        "Address: Knowledge Park V, Greater Noida, UP 201310",
        "Land Area: 6.5 Acres",
        "Issue Date: 2024-06-01",
        "Expiry Date: 2032-12-31",
    ])
    helper_upload_and_extract(app_id, "application_form", "Application_Form.pdf", form_pdf)

    # Upload Land Document
    land_pdf = make_synthetic_pdf("[SYNTHETIC TEST] Registered Land Title Deed", [
        "Institution Name: [SYNTHETIC TEST] Saraswati Technical Institute",
        "Registration Number: INST-9001",
        "Address: Knowledge Park V, Greater Noida, UP 201310",
        "Land Area: 6.5 Acres",
        "Issue Date: 2024-05-10",
    ])
    helper_upload_and_extract(app_id, "land_document", "Land_Deed.pdf", land_pdf)

    # Upload Registration Certificate
    reg_pdf = make_synthetic_pdf("[SYNTHETIC TEST] Trust Registration Certificate", [
        "Institution Name: [SYNTHETIC TEST] Saraswati Technical Institute",
        "Registration Number: INST-9001",
        "Address: Knowledge Park V, Greater Noida, UP 201310",
        "Issue Date: 2020-01-15",
        "Expiry Date: 2035-01-15",
    ])
    helper_upload_and_extract(app_id, "registration_certificate", "Registration_Certificate.pdf", reg_pdf)

    # Trigger Validation
    val_res = client.post(f"/api/applications/{app_id}/validate", json={"actor": "compliance-officer"})
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["status"] in ["passed", "validated", "completed"]

    # Check Findings for Statutory Provenance
    findings_res = client.get(f"/api/applications/{app_id}/findings")
    assert findings_res.status_code == 200
    findings = findings_res.json()
    assert len(findings) > 0

    for f in findings:
        assert "official_source_name" in f
        assert "clause_reference" in f
        assert "page_reference" in f
        assert "source_status" in f
        assert "evidence" in f
        if f["rule_key"] == "R-LAND-AREA":
            assert f["status"] == "pass"
            assert "6.5" in f["message"]


def test_missing_document_deficiency_versus_violation():
    """Verify missing document is treated as an evidentiary deficiency, not a false mismatch."""
    app_res = client.post("/api/applications", json={
        "institution_name": "[SYNTHETIC TEST] Incomplete Evidence Polytechnic",
        "application_type": "New Technical Institution",
        "applicant_name": "Incomplete Trust",
    })
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    form_pdf = make_synthetic_pdf("[SYNTHETIC TEST] Solo Form", [
        "Applicant Name: Incomplete Trust",
        "Institution Name: [SYNTHETIC TEST] Incomplete Evidence Polytechnic",
        "Registration Number: INST-3321",
        "Address: GT Road, Karnal, Haryana 132001",
        "Land Area: 5.2 Acres",
    ])
    helper_upload_and_extract(app_id, "application_form", "Form.pdf", form_pdf)

    client.post(f"/api/applications/{app_id}/validate")

    findings = client.get(f"/api/applications/{app_id}/findings").json()
    
    missing_docs = [f for f in findings if f["code"] == "MISSING_DOCUMENT"]
    assert len(missing_docs) >= 1

    cross_finding = next(f for f in findings if f["rule_key"] == "R-CROSS-REG-NO")
    assert cross_finding["status"] == "unverified"
    assert cross_finding["code"] in ["INSUFFICIENT_EVIDENCE", "FIELD_NOT_EXTRACTED"]


def test_expired_document_detection():
    """Verify expired document is accurately flagged with date and document citation."""
    app_res = client.post("/api/applications", json={
        "institution_name": "[SYNTHETIC TEST] Expired NOC Institute",
        "application_type": "New Technical Institution",
        "applicant_name": "Expired Trust",
    })
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    # Valid application form
    form_pdf = make_synthetic_pdf("[SYNTHETIC TEST] Form", [
        "Institution Name: [SYNTHETIC TEST] Expired NOC Institute",
        "Registration Number: INST-7700",
        "Address: Main Road, Rohtak, Haryana 124001",
    ])
    helper_upload_and_extract(app_id, "application_form", "Form.pdf", form_pdf)

    # Document with past expiry date
    expired_pdf = make_synthetic_pdf("[SYNTHETIC TEST] Expired Registration Document", [
        "Institution Name: [SYNTHETIC TEST] Expired NOC Institute",
        "Registration Number: INST-7700",
        "Address: Main Road, Rohtak, Haryana 124001",
        "Issue Date: 2016-01-01",
        "Expiry Date: 2021-01-01",
    ])
    helper_upload_and_extract(app_id, "registration_certificate", "Expired_Trust_Deed.pdf", expired_pdf)

    client.post(f"/api/applications/{app_id}/validate")

    findings = client.get(f"/api/applications/{app_id}/findings").json()
    expired_finding = next(f for f in findings if f["rule_key"] == "R-EXPIRY-VALID")
    assert expired_finding["status"] == "fail"
    assert expired_finding["code"] == "DOCUMENT_EXPIRED"
    assert "expired" in expired_finding["message"].lower()


def test_conflicting_documents_cross_match():
    """Verify cross-document mismatch is detected and both document values cited."""
    app_res = client.post("/api/applications", json={
        "institution_name": "[SYNTHETIC TEST] Conflicting Data College",
        "application_type": "New Technical Institution",
        "applicant_name": "Conflicting Trust",
    })
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    # Document 1 has INST-1111
    doc1 = make_synthetic_pdf("[SYNTHETIC TEST] Application Form", [
        "Institution Name: [SYNTHETIC TEST] Conflicting Data College",
        "Registration Number: INST-1111",
        "Address: Civil Lines, Jaipur, Rajasthan 302006",
    ])
    helper_upload_and_extract(app_id, "application_form", "Form.pdf", doc1)

    # Document 2 has INST-9999 (Conflicting)
    doc2 = make_synthetic_pdf("[SYNTHETIC TEST] Registration Deed", [
        "Institution Name: [SYNTHETIC TEST] Conflicting Data College",
        "Registration Number: INST-9999",
        "Address: Civil Lines, Jaipur, Rajasthan 302006",
    ])
    helper_upload_and_extract(app_id, "registration_certificate", "Deed.pdf", doc2)

    client.post(f"/api/applications/{app_id}/validate")

    findings = client.get(f"/api/applications/{app_id}/findings").json()
    cross_finding = next(f for f in findings if f["rule_key"] == "R-CROSS-REG-NO")
    assert cross_finding["status"] == "fail"
    assert cross_finding["code"] in ["IDENTIFIER_MISMATCH", "CROSS_DOC_MISMATCH"]
    assert "INST-1111" in cross_finding["message"]
    assert "INST-9999" in cross_finding["message"]


def test_unreadable_numeric_field_flags_manual_review():
    """Verify unparseable numerical evidence produces UNVERIFIED without premature violation."""
    app_res = client.post("/api/applications", json={
        "institution_name": "[SYNTHETIC TEST] Unreadable Land Area Campus",
        "application_type": "New Technical Institution",
        "applicant_name": "Unreadable Trust",
    })
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    unreadable_pdf = make_synthetic_pdf("[SYNTHETIC TEST] Land Document With Non-Numeric Value", [
        "Institution Name: [SYNTHETIC TEST] Unreadable Land Area Campus",
        "Registration Number: INST-5544",
        "Land Area: Demarcation Pending Under Tehsildar Survey",
        "Address: Survey 99, Nagpur, Maharashtra 440001",
    ])
    helper_upload_and_extract(app_id, "land_document", "Land_Deed.pdf", unreadable_pdf)

    client.post(f"/api/applications/{app_id}/validate")

    findings = client.get(f"/api/applications/{app_id}/findings").json()
    land_finding = next(f for f in findings if f["rule_key"] == "R-LAND-AREA")
    assert land_finding["status"] == "unverified"
    assert land_finding["code"] in ["MISSING_EVIDENCE", "UNPARSEABLE_NUMERIC"]


def test_superseded_regulation_guard():
    """Verify superseded regulation produces review-required finding rather than silent failure."""
    rule_superseded = {
        "id": "RULE-TEST-SUPERSEDED",
        "rule_key": "R-TEST-OBSOLETE-NORM",
        "title": "Strict Unamended Single Plot Rule",
        "rule_type": "numeric_threshold",
        "severity": "high",
        "parameters": {"field_key": "land_area", "operator": "gte", "value": 15.0, "unit": "Acres"},
        "is_superseded": True,
        "source_status": "SUPERSEDED",
    }
    app_ctx = {
        "application": {"id": "APP-TEST", "application_type": "New Technical Campus"},
        "documents": [],
        "fields": [{"field_name": "land_area", "field_value": "5.0 Acres", "normalized_value": "5.0 Acres"}]
    }
    findings = evaluate_ruleset(app_ctx["application"], [rule_superseded], app_ctx)
    assert len(findings) == 1
    f = findings[0]
    # Finding must be flagged as unverified with supersession warning
    assert f["status"] == "unverified"
    assert f["code"] == "SUPERSEDED_REQUIREMENT_REVIEW_REQUIRED"
    assert "amendment / supersession" in f["message"]


def test_regulatory_review_queue_and_audit_api():
    """Verify /api/regulatory/audit and /api/regulatory/review-queue return prioritized clauses."""
    # Audit summary
    audit_res = client.get("/api/regulatory/audit")
    assert audit_res.status_code == 200
    audit_data = audit_res.json()
    assert "stats" in audit_data
    assert audit_data["stats"]["total_clauses"] > 0
    assert "compliance_critical" in audit_data["stats"]

    # Review queue with priority filter
    crit_res = client.get("/api/regulatory/review-queue?priority=CRITICAL")
    assert crit_res.status_code == 200
    crit_data = crit_res.json()
    assert len(crit_data["data"]) > 0
    first_crit = crit_data["data"][0]
    assert first_crit["priority"] == "CRITICAL"
    assert "audit_tag" in first_crit
    assert "applicability_scope_details" in first_crit

    # Supersede clause API
    sup_clause_res = client.post(
        f"/api/regulatory/clauses/{first_crit['id']}/supersede",
        json={
            "superseded_by_clause_id": "KB-589F73F75C18",
            "reviewer_name": "Senior Compliance Officer",
            "notes": "Clause superseded under Corrigendum AY 2025-26 overpass standards."
        }
    )
    assert sup_clause_res.status_code == 200
    assert sup_clause_res.json()["status"] == "success"

    # Verify audit chain integrity remains unbroken
    with get_connection() as conn:
        chain = verify_audit_chain(conn)
        assert chain["verified"] is True
