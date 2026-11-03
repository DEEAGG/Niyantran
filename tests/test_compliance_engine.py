"""
Tests for NIYANTRAN Compliance Reasoning Engine (20 Scenarios)
==============================================================
Verifies numerical calculations, shortfall/surplus evaluations, multi-turn
conversational memory, cross-document discrepancy detection, and concise responses.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.copilot import copilot_router
from app import copilot_adapter, copilot
from tests.test_assistant import setup_test_db, override_get_current_user


@pytest.fixture
def client(setup_test_db, monkeypatch):
    test_conn = setup_test_db

    from contextlib import contextmanager

    @contextmanager
    def mock_get_conn():
        yield test_conn

    monkeypatch.setattr(copilot_adapter, "get_connection", mock_get_conn)
    monkeypatch.setattr(copilot_adapter, "get_current_user", override_get_current_user)
    monkeypatch.setattr(copilot, "get_connection", mock_get_conn)
    monkeypatch.setattr(copilot, "get_current_user", override_get_current_user)

    app = FastAPI()
    app.include_router(copilot_router)
    return TestClient(app)


class TestComplianceEngine20Scenarios:
    def test_scenario_01_land_shortfall_hinglish(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "Mere college ke paas 2.5 acre land hai, lekin requirement 3.5 acre hai. Kya problem hogi?",
            "context": {"current_path": "/dashboard"},
            "session_id": "test-session-01"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "shortfall" in data["message"].lower() or "kami" in data["message"].lower()
        assert data["evidence_card"] is not None
        assert data["evidence_card"]["status"] == "NON-COMPLIANT"
        assert "3.5" in str(data["evidence_card"]["parameters"])
        assert "2.5" in str(data["evidence_card"]["parameters"])
        assert len(data["suggested_actions"]) > 0

    def test_scenario_exact_land_match(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "Our land area is 3.5 acres and the requirement is 3.5 acres.",
            "context": {"current_path": "/dashboard"},
            "session_id": "test-session-exact"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "meets the required" in data["message"].lower() or "exactly" in data["message"].lower()
        assert data["evidence_card"]["status"] == "COMPLIANT"

    def test_scenario_surplus_land_area(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "Our land area is 5.0 acres while requirement is 3.5 acres. Are we compliant?",
            "context": {"current_path": "/dashboard"},
            "session_id": "test-session-surplus"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "exceeds" in data["message"].lower() or "surplus" in data["message"].lower()
        assert data["evidence_card"]["status"] == "COMPLIANT"

    def test_scenario_hindi_multiturn(self, client):
        sid = "test-session-hindi-mt"
        # Turn 1
        r1 = client.post("/api/copilot/chat", json={
            "message": "Hamare paas 2.5 acre zameen hai.",
            "session_id": sid
        })
        assert r1.status_code == 200
        assert r1.json()["data"]["evidence_card"]["status"] == "INSUFFICIENT INFORMATION"

        # Turn 2
        r2 = client.post("/api/copilot/chat", json={
            "message": "Engineering college hai hamara.",
            "session_id": sid
        })
        assert r2.status_code == 200
        assert r2.json()["data"]["evidence_card"]["status"] == "COMPLIANT"

        # Turn 3
        r3 = client.post("/api/copilot/chat", json={
            "message": "Agar hum aur aadha acre arrange karein toh?",
            "session_id": sid
        })
        assert r3.status_code == 200
        assert r3.json()["data"]["evidence_card"]["status"] == "NON-COMPLIANT"

        # Turn 4
        r4 = client.post("/api/copilot/chat", json={
            "message": "Aur aadha acre add karein toh?",
            "session_id": sid
        })
        assert r4.status_code == 200
        assert r4.json()["data"]["evidence_card"]["status"] == "COMPLIANT"

    def test_scenario_02_land_addition_multiturn(self, client):
        session_id = "test-session-multiturn-1"
        client.post("/api/copilot/chat", json={
            "message": "Mere college ke paas 2.5 acre land hai, lekin requirement 3.5 acre hai. Kya problem hogi?",
            "session_id": session_id
        })
        
        res = client.post("/api/copilot/chat", json={
            "message": "What if I arrange another half acre?",
            "session_id": session_id
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "3.0" in data["message"] or "3" in data["message"]
        assert "0.5" in data["message"]
        assert data["evidence_card"] is not None
        assert data["evidence_card"]["status"] == "NON-COMPLIANT"

    def test_scenario_03_category_clarification_multiturn(self, client):
        session_id = "test-session-multiturn-2"
        res1 = client.post("/api/copilot/chat", json={
            "message": "We have 4 acres of land.",
            "session_id": session_id
        })
        assert res1.status_code == 200
        data1 = res1.json()["data"]
        assert "category" in data1["message"].lower() or "program" in data1["message"].lower()
        assert data1["evidence_card"]["status"] == "INSUFFICIENT INFORMATION"

        res2 = client.post("/api/copilot/chat", json={
            "message": "Engineering & Technology (Undergraduate)",
            "session_id": session_id
        })
        assert res2.status_code == 200
        data2 = res2.json()["data"]
        assert "complies" in data2["message"].lower() or "satisfies" in data2["message"].lower() or "surplus" in data2["message"].lower()
        assert data2["evidence_card"] is not None
        assert data2["evidence_card"]["status"] == "COMPLIANT"

    def test_scenario_04_built_up_area_shortfall(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "Total built-up space is 3,200 sqm. Does this meet AICTE Clause 2.4 norms?",
            "context": {"current_path": "/dashboard"},
            "session_id": "test-session-04"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "800" in data["message"]
        assert data["evidence_card"] is not None
        assert data["evidence_card"]["status"] == "NON-COMPLIANT"
        assert "Clause 2.4" in data["evidence_card"]["clause"]

    def test_scenario_05_trust_name_mismatch(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "PAN card shows 'SHREE RAM TRUST' but land deed has 'SHRI RAM CHARITABLE TRUST'. Will this cause an issue?",
            "context": {"current_path": "/cross-document"},
            "session_id": "test-session-05"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "mismatch" in data["message"].lower() or "discrepancy" in data["message"].lower()
        assert data["evidence_card"]["status"] == "NON-COMPLIANT"
        assert "Rule 3.1" in data["evidence_card"]["clause"]

    def test_scenario_06_trust_registration_number_mismatch(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "Registration certificate has trust number TR-8841 but society document says TR-8847. How to fix?",
            "context": {"current_path": "/evidence"},
            "session_id": "test-session-06"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "tr-8841" in data["message"].lower() or "discrepancy" in data["message"].lower()
        assert data["evidence_card"]["status"] == "NON-COMPLIANT"

    def test_scenario_07_portal_vs_deed_land_area(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "Application portal shows 5.0 acres but uploaded sale deed specifies 4.2 acres.",
            "context": {"current_path": "/cross-document"},
            "session_id": "test-session-07"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "0.8" in data["message"] or "mismatch" in data["message"].lower()
        assert data["evidence_card"]["status"] == "NON-COMPLIANT"

    def test_scenario_08_partial_documents_uploaded(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "I uploaded 4 out of 5 required documents. Can I submit for statutory review now?",
            "context": {"current_path": "/upload"},
            "session_id": "test-session-08"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "4 out of 5" in data["message"]
        assert data["evidence_card"]["status"] == "PARTIALLY COMPLIANT"

    def test_scenario_09_expired_fire_noc(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "Our Fire Safety NOC expired last month, but renewal is applied for. Is it acceptable?",
            "context": {"current_path": "/validation"},
            "session_id": "test-session-09"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "valid" in data["message"].lower() or "not acceptable" in data["message"].lower() or "expired" in data["message"].lower()
        assert data["evidence_card"]["status"] == "NON-COMPLIANT"

    def test_scenario_10_address_discrepancy(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "Pin code on electricity bill is 110001 but college address is registered with 110002.",
            "context": {"current_path": "/cross-document"},
            "session_id": "test-session-10"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "110001" in data["message"] or "pincode" in data["message"].lower() or "discrepancy" in data["message"].lower()
        assert data["evidence_card"]["status"] == "NON-COMPLIANT"

    def test_scenario_11_non_contiguous_land_parcels(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "Our 4 acres are in two separate plots 500 meters apart. Does this comply?",
            "context": {"current_path": "/validation"},
            "session_id": "test-session-11"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "separate plots" in data["message"].lower() or "contiguous" in data["message"].lower()
        assert data["evidence_card"]["status"] == "NON-COMPLIANT"

    def test_scenario_12_unresolved_statutory_findings(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "Validation shows 2 non-compliant issues. Can our application still be approved?",
            "context": {"current_path": "/validation"},
            "session_id": "test-session-12"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "cannot be approved" in data["message"].lower() or "cannot" in data["message"].lower()
        assert data["evidence_card"]["status"] == "NON-COMPLIANT"

    def test_scenario_13_ocr_post_processing_workflow(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "OCR ke baad kya hota hai?",
            "context": {"current_path": "/upload"},
            "session_id": "test-session-13"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "cross-document" in data["message"].lower() or "extraction" in data["message"].lower()

    def test_scenario_14_pure_hindi_land_inquiry(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "हमारे कॉलेज के पास 2.5 एकड़ जमीन है।",
            "context": {"current_path": "/dashboard"},
            "session_id": "test-session-14"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "2.5" in data["message"]
        assert data["evidence_card"] is not None
        assert data["evidence_card"]["status"] == "INSUFFICIENT INFORMATION"

    def test_scenario_15_low_ocr_confidence(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "OCR confidence score is only 42% on our deed copy. Will it pass?",
            "context": {"current_path": "/extraction"},
            "session_id": "test-session-15"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "42%" in data["message"] or "70%" in data["message"] or "low" in data["message"].lower()
        assert data["evidence_card"]["status"] == "NON-COMPLIANT"

    def test_scenario_16_erroneous_15_acre_threshold_correction(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "Is 15 acres required for an engineering college in an urban area?",
            "context": {"current_path": "/dashboard"},
            "session_id": "test-session-16"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "not required" in data["message"].lower() or "incorrect" in data["message"].lower() or "2.5" in data["message"]
        assert data["evidence_card"]["status"] == "COMPLIANT"

    def test_scenario_17_ambiguous_building_inquiry(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "Is our building sufficient?",
            "context": {"current_path": "/dashboard"},
            "session_id": "test-session-17"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "built-up" in data["message"].lower() or "area" in data["message"].lower() or "sqm" in data["message"].lower()
        assert data["evidence_card"]["status"] == "INSUFFICIENT INFORMATION"

    def test_scenario_18_diploma_vs_degree_norms(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "What is the land requirement for a Polytechnic Diploma institute?",
            "context": {"current_path": "/intelligence"},
            "session_id": "test-session-18"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "polytechnic" in data["message"].lower() or "diploma" in data["message"].lower() or "1.5" in data["message"]
        assert data["evidence_card"]["status"] == "COMPLIANT"

    def test_scenario_19_rbac_officer_review_center(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "Can an institution user access the Officer Review Center?",
            "context": {"current_path": "/dashboard"},
            "session_id": "test-session-19"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "restricted" in data["message"].lower() or "officer" in data["message"].lower() or "cannot access" in data["message"].lower()

    def test_scenario_20_unsupported_out_of_domain(self, client):
        res = client.post("/api/copilot/chat", json={
            "message": "Can you book a train ticket to New Delhi?",
            "context": {"current_path": "/dashboard"},
            "session_id": "test-session-20"
        })
        assert res.status_code == 200
        data = res.json()["data"]
        assert "cannot" in data["message"].lower() or "ticket" in data["message"].lower() or "regulatory" in data["message"].lower()
