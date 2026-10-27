import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import get_connection

client = TestClient(app)

def test_adgips_genuine_compliance_not_100_percent():
    # Login as ADGIPS
    res = client.post("/api/auth/login", json={"email": "adgips@institution.edu.in", "password": "Adgips@2026"})
    assert res.status_code == 200
    token = res.json()["access_token"]

    # Dashboard summary
    dash_res = client.get("/api/dashboard/summary", headers={"Authorization": f"Bearer {token}"})
    assert dash_res.status_code == 200
    data = dash_res.json()["data"]

    # Must have exactly 1 genuine application
    assert data["kpis"]["totalApplications"] == 1
    assert len(data["recentApplications"]) == 1

    adgips_app = data["recentApplications"][0]
    assert adgips_app["id"] == "APP-E1CA4CCA9DC2"
    assert adgips_app["institutionName"] == "ADGIPS"
    assert adgips_app["status"] == "Discrepancy Detected"
    
    # Compliance score must NOT be 100%
    assert adgips_app["complianceScore"] == 0.0
    assert adgips_app["failedRules"] == 8
    assert adgips_app["unverifiedRules"] == 7

    comp = data["complianceOverview"]
    assert comp["score"] == 0.0
    assert comp["status"] == "Discrepancy Detected"
    assert comp["failedRules"] == 8
    assert comp["unverifiedRules"] == 7

def test_user_without_applications_shows_empty_state_and_not_evaluated():
    # Register fresh test user
    email = "empty_college@example.edu.in"
    reg_res = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password@2026",
        "full_name": "Dean Testing",
        "institution_name": "Isolated Campus"
    })
    assert reg_res.status_code == 200
    token = reg_res.json()["access_token"]

    try:
        dash_res = client.get("/api/dashboard/summary", headers={"Authorization": f"Bearer {token}"})
        assert dash_res.status_code == 200
        data = dash_res.json()["data"]

        # Must have 0 applications
        assert data["kpis"]["totalApplications"] == 0
        assert data["recentApplications"] == []
        
        # Must be Not Evaluated (score is None, not 100%)
        assert data["complianceOverview"]["score"] is None
        assert data["complianceOverview"]["status"] == "Not Evaluated"
        assert data["complianceOverview"]["totalRules"] == 0
    finally:
        with get_connection() as conn:
            conn.execute("DELETE FROM users WHERE email = ?", (email,))
            conn.commit()

def test_officer_compliance_overview_reflects_actual_findings():
    # Login as reviewer
    res = client.post("/api/auth/login", json={"email": "officer@aicte.gov.in", "password": "Officer@2026"})
    assert res.status_code == 200
    token = res.json()["access_token"]

    dash_res = client.get("/api/dashboard/summary", headers={"Authorization": f"Bearer {token}"})
    assert dash_res.status_code == 200
    data = dash_res.json()["data"]

    # Verify compliance is not fake 100%
    comp = data["complianceOverview"]
    assert comp["score"] != 100.0
    assert comp["status"] in ("Discrepancy Detected", "Under Review", "Not Evaluated", "Insufficient Evidence")
