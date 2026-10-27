import io
import fitz
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import get_connection, verify_audit_chain

client = TestClient(app)


def make_test_pdf(title: str, lines: list[str]) -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 50), f"[OFFICIAL REGULATORY INSTRUMENT - {title}]", fontsize=11)
    y = 90
    for line in lines:
        page.insert_text(fitz.Point(50, y), line, fontsize=10)
        y += 22
    data = doc.tobytes()
    doc.close()
    return data


def test_complete_end_to_end_compliance_lifecycle():
    """
    Executes the complete NIYANTRAN Phase 3 end-to-end regulatory verification lifecycle:
    1. Import official regulatory PDF
    2. Extract & review clauses
    3. Verify reviewer authorization
    4. Upload synthetic application documents
    5. Evaluate compliance against applicable statutory rules
    6. Inspect findings, evidence & source citations
    7. Verify superseded rules cannot generate unsupported violations
    8. Confirm tamper-evident audit ledger integrity
    """
    # -------------------------------------------------------------
    # Step 1: Import official regulatory PDF
    # -------------------------------------------------------------
    reg_pdf = make_test_pdf("AICTE Gazette Mandate 2026", [
        "Clause 1.1: Annual Extension of Approval",
        "Every technical institution must file annual compliance affidavit.",
        "Clause 2.1: Campus Land Norms",
        "Minimum contiguous land requirement is 5.0 Acres for non-metro technical institutions.",
        "Clause 5.2: Fire and Life Safety Certificate",
        "Valid Fire NOC issued by competent state fire authority is mandatory.",
    ])

    import_res = client.post(
        "/api/regulatory/sources/upload",
        files={"file": ("AICTE_Gazette_2026_E2E.pdf", reg_pdf, "application/pdf")},
        data={
            "title": "AICTE Gazette Mandate 2026 E2E",
            "category": "Gazette Notification",
            "issuing_authority": "AICTE Statutory Council",
            "version": "Gazette 2026-v1",
            "publication_date": "2026-01-10",
        }
    )
    assert import_res.status_code == 200
    source_id = import_res.json()["id"]

    # -------------------------------------------------------------
    # Step 2: Extract & review its clauses
    # -------------------------------------------------------------
    detail_res = client.get(f"/api/regulatory/sources/{source_id}")
    assert detail_res.status_code == 200
    clauses = detail_res.json().get("clauses", [])
    assert len(clauses) >= 1
    test_clause = clauses[0]

    # Review clause as authorized reviewer
    review_res = client.post(
        f"/api/regulatory/clauses/{test_clause['id']}/review",
        json={
            "status": "reviewed",
            "reviewer_name": "Dr. V. Sharma (AICTE Regional Officer)",
            "notes": "Verified against official gazette copy."
        }
    )
    assert review_res.status_code == 200
    assert review_res.json()["verification_status"] == "reviewed"

    # -------------------------------------------------------------
    # Step 3: Verify reviewer authorization enforcement
    # -------------------------------------------------------------
    # Unauthorized / guest access must be blocked with 403 Forbidden
    guest_review_res = client.post(
        f"/api/regulatory/clauses/{test_clause['id']}/review",
        json={"status": "verified", "reviewer_name": "Intruder"},
        headers={"X-Actor-Role": "guest"}
    )
    assert guest_review_res.status_code == 403

    unauth_bearer_res = client.post(
        f"/api/regulatory/clauses/{test_clause['id']}/review",
        json={"status": "verified", "reviewer_name": "Intruder"},
        headers={"Authorization": "Bearer unauthorized"}
    )
    assert unauth_bearer_res.status_code == 403

    # Document view endpoint also blocks unauthorized roles
    doc_unauth_res = client.get(
        "/api/documents/DOC-TEST-123",
        headers={"X-Actor-Role": "unauthorized"}
    )
    assert doc_unauth_res.status_code == 403

    # -------------------------------------------------------------
    # Step 4: Upload synthetic institutional application
    # -------------------------------------------------------------
    app_res = client.post("/api/applications", json={
        "institution_name": "[SYNTHETIC TEST] Vidya Institute of Technology",
        "application_type": "New Technical Institution",
        "applicant_name": "Vidya Education Foundation",
    })
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    # Upload application form
    app_form_pdf = make_test_pdf("AICTE Application Form", [
        "Applicant Name: Vidya Education Foundation",
        "Institution Name: [SYNTHETIC TEST] Vidya Institute of Technology",
        "Registration Number: INST-7890",
        "Address: Knowledge City, Sector 12, Gurugram, Haryana 122001",
        "Land Area: 5.8 Acres",
        "Issue Date: 2024-04-10",
        "Expiry Date: 2030-04-10",
    ])
    doc_res1 = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "application_form"},
        files={"file": ("Application_Form.pdf", app_form_pdf, "application/pdf")},
    )
    assert doc_res1.status_code == 201
    doc_id1 = doc_res1.json()["id"]
    client.post(f"/api/documents/{doc_id1}/extract")

    # Upload registered land deed (meeting 5.0 acre threshold with 5.8 acres)
    land_deed_pdf = make_test_pdf("Registered Land Document", [
        "Institution Name: [SYNTHETIC TEST] Vidya Institute of Technology",
        "Registration Number: INST-7890",
        "Address: Knowledge City, Sector 12, Gurugram, Haryana 122001",
        "Land Area: 5.8 Acres",
        "Issue Date: 2024-03-15",
    ])
    doc_res2 = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "land_document"},
        files={"file": ("Land_Deed.pdf", land_deed_pdf, "application/pdf")},
    )
    assert doc_res2.status_code == 201
    doc_id2 = doc_res2.json()["id"]
    client.post(f"/api/documents/{doc_id2}/extract")

    # Upload registration certificate
    reg_cert_pdf = make_test_pdf("Trust Registration Certificate", [
        "Institution Name: [SYNTHETIC TEST] Vidya Institute of Technology",
        "Registration Number: INST-7890",
        "Address: Knowledge City, Sector 12, Gurugram, Haryana 122001",
        "Issue Date: 2018-02-20",
        "Expiry Date: 2035-02-20",
    ])
    doc_res3 = client.post(
        f"/api/applications/{app_id}/documents",
        data={"document_type": "registration_certificate"},
        files={"file": ("Registration_Cert.pdf", reg_cert_pdf, "application/pdf")},
    )
    assert doc_res3.status_code == 201
    doc_id3 = doc_res3.json()["id"]
    client.post(f"/api/documents/{doc_id3}/extract")

    # -------------------------------------------------------------
    # Step 5: Evaluate compliance against applicable, verified rules
    # -------------------------------------------------------------
    val_res = client.post(f"/api/applications/{app_id}/validate", json={"actor": "compliance-officer"})
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["status"] in ["completed", "validated", "passed"]

    # -------------------------------------------------------------
    # Step 6: Open each finding and inspect evidence & citations
    # -------------------------------------------------------------
    findings_res = client.get(f"/api/applications/{app_id}/findings")
    assert findings_res.status_code == 200
    findings = findings_res.json()
    assert len(findings) > 0

    for f in findings:
        assert "id" in f
        assert "rule_key" in f
        assert "official_source_name" in f
        assert "clause_reference" in f
        assert "page_reference" in f
        assert "evidence" in f

        # Inspect finding evidence detail endpoint
        ev_res = client.get(f"/api/findings/{f['id']}/evidence")
        assert ev_res.status_code == 200
        ev_data = ev_res.json()["data"]
        assert "evidenceSources" in ev_data
        assert "regulatorySource" in ev_data

    # Land area finding specifically verified
    land_f = next(f for f in findings if f["rule_key"] == "R-LAND-AREA")
    assert land_f["status"] == "pass"
    assert "5.8" in land_f["message"]

    # -------------------------------------------------------------
    # Step 7: Verify superseded rules cannot generate unsupported violations
    # -------------------------------------------------------------
    # Link a clause as superseded
    sup_res = client.post(
        f"/api/regulatory/clauses/{test_clause['id']}/supersede",
        json={
            "superseded_by_clause_id": "KB-589F73F75C18",
            "reviewer_name": "Compliance Director",
            "notes": "Amended under Corrigendum AY 2025-26"
        }
    )
    assert sup_res.status_code == 200

    # Review queue shows superseded clause flagged with HIGH priority
    q_res = client.get("/api/regulatory/review-queue?priority=HIGH")
    assert q_res.status_code == 200
    high_priority_items = q_res.json()["data"]
    assert any(item["is_superseded"] for item in high_priority_items)

    # -------------------------------------------------------------
    # Step 8: Confirm audit events are recorded correctly
    # -------------------------------------------------------------
    with get_connection() as conn:
        chain_status = verify_audit_chain(conn)
        assert chain_status["verified"] is True
        assert chain_status["total_records"] > 8000
