import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.extractor import extract_document_fields
from app.db import get_connection

client = TestClient(app)

def test_demo_pdf_extracts_actual_structured_fields():
    demo_pdf = Path("data/documents/ffd2c438d8e646e78582658828af14aa.pdf")
    assert demo_pdf.exists(), "Demo PDF file should exist in storage"

    res = extract_document_fields(demo_pdf)
    assert res["is_regulatory_document"] is True
    assert res["classification"] == "regulatory_application"

    fields = {f["field_name"]: f for f in res["fields"]}
    assert len(fields) >= 15, f"Expected at least 15 structured fields, got {len(fields)}"

    # 1. Institution Profile
    assert "Saraswati Institute of Applied Sciences" in fields["institution_name"]["normalized_value"]
    assert fields["registration_number"]["normalized_value"] == "NIY-DEMO-2026-014"
    assert "Delhi" in fields["address"]["normalized_value"]
    assert "B.Tech" in fields["proposed_programme"]["normalized_value"]
    assert fields["intake_capacity"]["normalized_value"] == "60"
    assert "2026-10-27" in fields["issue_date"]["normalized_value"]

    # 2. Land and Building
    assert "2.4 Acres" in fields["land_area"]["normalized_value"]
    assert "4800 sq m" in fields["built_up_area"]["normalized_value"]
    assert fields["teaching_rooms"]["normalized_value"] == "12"
    assert fields["laboratories"]["normalized_value"] == "5"
    assert fields["library_seating"]["normalized_value"] == "80"

    # 3. Faculty
    assert fields["faculty_count"]["normalized_value"] == "10"
    assert fields["sanctioned_faculty"]["normalized_value"] == "12"

    # 4. Missing field must remain missing/unverified
    assert "expiry_date" not in fields, "Expiry date is not in the demo PDF and must not be fabricated"

def test_lecture_notes_non_regulatory_no_fabricated_fields():
    notes_pdf = Path("data/documents/b9fdd3a1f7fd45da9ddc53d686fac6ea.pdf")
    if notes_pdf.exists():
        res = extract_document_fields(notes_pdf)
        assert res["is_regulatory_document"] is False
        assert len(res["fields"]) == 0, "Non-regulatory lecture notes must not produce fabricated regulatory fields"
