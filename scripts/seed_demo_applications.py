import io
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
import fitz

from app.db import get_connection, init_db, add_audit_entry, DOCUMENTS_DIR
from app.extractor import extract_document_fields
from app.storage import save_file, get_file_path
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass
from app.rules_engine import evaluate_ruleset, seed_default_rules_if_empty

def create_synthetic_pdf(title: str, text_lines: list) -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(fitz.Point(50, 60), "SYNTHETIC DEMO DOCUMENT - NIYANTRAN COMPLIANCE VERIFICATION", fontsize=11, color=(0.4, 0.4, 0.4))
    page.insert_text(fitz.Point(50, 100), title, fontsize=16, color=(0.1, 0.3, 0.2))
    
    y = 140
    for line in text_lines:
        page.insert_text(fitz.Point(50, y), line, fontsize=11, color=(0.15, 0.15, 0.15))
        y += 24
        
    page.insert_text(fitz.Point(50, 800), "SYNTHETIC DEMO DOCUMENT - PROTOTYPE VERIFICATION ONLY", fontsize=9, color=(0.5, 0.5, 0.5))
    data = doc.tobytes()
    doc.close()
    return data

def seed(force: bool = False):
    is_prod = os.getenv("NIYANTRAN_ENV", "").strip().lower() == "production"
    is_serverless = bool(
        os.getenv("VERCEL")
        or os.getenv("VERCEL_ENV")
        or os.getenv("VERCEL_URL")
        or os.getenv("VERCEL_REGION")
        or os.getenv("AWS_LAMBDA_FUNCTION_NAME")
    )
    enable_demo = os.getenv("ENABLE_DEMO_SEEDING", "false").strip().lower() in ("true", "1", "yes")

    if (is_prod or is_serverless) and not force:
        print("[SECURITY] Seeding synthetic demo data is strictly disabled in production / serverless mode.")
        return

    if not enable_demo and not force:
        print("[INFO] Demo seeding skipped. Set ENABLE_DEMO_SEEDING=true or pass --force to seed synthetic demo applications in local development.")
        return

    init_db()
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    
    with get_connection() as conn:
        active_ruleset_id = seed_default_rules_if_empty(conn)
        
        apps = [
            {
                "id": "APP-2026-001",
                "name": "[SYNTHETIC TEST] Apex Institute of Technology & Management",
                "type": "Extension of Approval (EoA)",
                "status": "validated",
                "docs": [
                    ("Application Form", "AICTE_Application_Form_2026.pdf", [
                        "Applicant Name: [SYNTHETIC TEST] Apex Institute of Technology & Management",
                        "Institution Name: [SYNTHETIC TEST] Apex Institute of Technology & Management",
                        "Registration Number: INST-1001",
                        "Address: Sector 62, Institutional Area, Noida, Uttar Pradesh 201309",
                        "Land Area: 5.5 Acres",
                        "Issue Date: 2024-05-10",
                        "Expiry Date: 2030-05-10",
                    ]),
                    ("Institution Registration Document", "Trust_Registration_Deed.pdf", [
                        "Institution: [SYNTHETIC TEST] Apex Institute of Technology & Management",
                        "Registration Number: INST-1001",
                        "Address: Sector 62, Institutional Area, Noida",
                        "Issue Date: 2020-01-15",
                    ]),
                    ("Affiliation Document", "University_Affiliation_Order.pdf", [
                        "Institution: [SYNTHETIC TEST] Apex Institute of Technology & Management",
                        "Affiliated University: AKTU Lucknow",
                        "Academic Session: 2026-2027",
                    ]),
                ]
            },
            {
                "id": "APP-2026-002",
                "name": "[SYNTHETIC TEST] Horizon College of Engineering & Research",
                "type": "New Technical Campus",
                "status": "missing_documents",
                "docs": [
                    ("Application Form", "AICTE_New_Campus_Form_2026.pdf", [
                        "Applicant Name: [SYNTHETIC TEST] Horizon College of Engineering & Research",
                        "Institution Name: [SYNTHETIC TEST] Horizon College of Engineering & Research",
                        "Registration Number: INST-1015",
                        "Address: Plot 44, Tech Corridor, Electronic City, Bengaluru, Karnataka 560100",
                        "Land Area: 4.0 Acres",
                        "Issue Date: 2024-01-10",
                        "Expiry Date: 2029-01-10",
                    ]),
                ]
            },
            {
                "id": "APP-2026-003",
                "name": "[SYNTHETIC TEST] Deccan Institute of Science & Technology",
                "type": "Extension of Approval (EoA)",
                "status": "discrepancy_detected",
                "docs": [
                    ("Application Form", "AICTE_Application_Form_2026.pdf", [
                        "Applicant Name: [SYNTHETIC TEST] Deccan Institute of Science & Technology",
                        "Institution Name: [SYNTHETIC TEST] Deccan Institute of Science & Technology",
                        "Registration Number: INST-1042",
                        "Address: Survey 88, University Road, Pune, Maharashtra 411007",
                        "Land Area: 6.2 Acres",
                        "Issue Date: 2023-06-12",
                        "Expiry Date: 2028-06-12",
                    ]),
                    ("Institution Registration Document", "Society_Registration_Certificate.pdf", [
                        "Institution: [SYNTHETIC TEST] Deccan Institute of Science & Technology",
                        "Registration Number: INST-1024",
                        "Address: Survey 88, University Road, Pune, Maharashtra 411007",
                        "Issue Date: 2018-04-10",
                    ]),
                ]
            },
            {
                "id": "APP-2026-004",
                "name": "[SYNTHETIC TEST] Vidya Jyoti Institute of Technical Education",
                "type": "Extension of Approval (EoA)",
                "status": "under_review",
                "docs": [
                    ("Application Form", "AICTE_Application_Form_2026.pdf", [
                        "Applicant Name: [SYNTHETIC TEST] Vidya Jyoti Institute of Technical Education",
                        "Institution Name: [SYNTHETIC TEST] Vidya Jyoti Institute of Technical Education",
                        "Registration Number: INST-1088",
                        "Address: Ring Road, Knowledge Park, Bhopal, MP 462003",
                        "Land Area: 3.2 Acres",
                        "Issue Date: 2025-01-10",
                        "Expiry Date: 2024-01-10",
                    ]),
                ]
            },
            {
                "id": "APP-2026-005",
                "name": "[SYNTHETIC TEST] Vidya Bharti Polytechnic Institute",
                "type": "Increase in Intake Capacity",
                "status": "under_review",
                "docs": [
                    ("Application Form", "AICTE_Intake_Application_2026.pdf", [
                        "Applicant Name: [SYNTHETIC TEST] Vidya Bharti Polytechnic Institute",
                        "Institution Name: [SYNTHETIC TEST] Vidya Bharti Polytechnic Institute",
                        "Registration Number: INST-1120",
                        "Address: GT Road, Industrial Area, Kanpur, UP 208001",
                        "Land Area: 2.5 Acres",
                        "Sanctioned Intake: 45 Seats",
                        "Issue Date: 2024-08-01",
                        "Expiry Date: 2030-08-01",
                    ]),
                ]
            },
        ]
        
        now = datetime.now(timezone.utc).isoformat()
        
        for a in apps:
            existing = conn.execute("SELECT 1 FROM applications WHERE id = ?", (a["id"],)).fetchone()
            if not existing:
                conn.execute(
                    """
                    INSERT INTO applications (id, application_type, applicant_name, institution_name, status, user_id, institution_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (a["id"], a["type"], a["name"], a["name"], a["status"], "USR-DEMO-SYNTHETIC", "INST-DEMO-SYNTHETIC", now, now)
                )
                
            for doc_type, filename, lines in a["docs"]:
                existing_doc = conn.execute(
                    "SELECT id FROM documents WHERE application_id = ? AND original_filename = ?",
                    (a["id"], filename)
                ).fetchone()
                
                if not existing_doc:
                    pdf_bytes = create_synthetic_pdf(f"{a['name']} — {doc_type}", lines)
                    sha256 = hashlib.sha256(pdf_bytes).hexdigest()
                    doc_id = f"DOC-{uuid.uuid4().hex[:12].upper()}"
                    relative_path = f"documents/{doc_id}_{filename}"
                    dest_file = save_file(relative_path, pdf_bytes, mime_type="application/pdf")
                    
                    conn.execute(
                        """
                        INSERT INTO documents (
                            id, application_id, document_type, original_filename, stored_path,
                            mime_type, sha256, file_size, page_count, uploaded_at, version, processing_status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            doc_id, a["id"], doc_type, filename, relative_path,
                            "application/pdf", sha256, len(pdf_bytes), 1, now, 1, "extracted"
                        )
                    )
                    
                    # Extract fields
                    extracted_res = extract_document_fields(dest_file, "application/pdf")
                    method = extracted_res.get("method", "pdf_text")
                    extracted_fields = extracted_res.get("fields", [])
                    run_id = f"RUN-{uuid.uuid4().hex[:12].upper()}"
                    conn.execute(
                        """
                        INSERT INTO extraction_runs (id, document_id, run_number, method, status, started_at, completed_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (run_id, doc_id, 1, method, "completed", now, now)
                    )
                    
                    for f in extracted_fields:
                        fid = f"FLD-{uuid.uuid4().hex[:12].upper()}"
                        bbox_json = json.dumps(f.get("bounding_box")) if f.get("bounding_box") else None
                        conn.execute(
                            """
                            INSERT INTO extracted_fields (
                                id, extraction_run_id, field_name, field_value, normalized_value,
                                confidence, page_number, bbox_json, extraction_method, confirmed
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                fid, run_id, f["field_name"], str(f.get("extracted_value", "")), str(f.get("extracted_value", "")),
                                f.get("confidence", 0.95), f.get("page_number", 1), bbox_json, f.get("extraction_method", method),
                                1 if a["id"] == "APP-2026-001" else 0
                            )
                        )
                        
            # Run validation for app
            val_exists = conn.execute("SELECT 1 FROM validation_runs WHERE application_id = ?", (a["id"],)).fetchone()
            if not val_exists and active_ruleset_id:
                evaluate_ruleset(conn, active_ruleset_id, a["id"], actor="demo-seeder")

    print("Synthetic demo applications seeded successfully.")

if __name__ == "__main__":
    seed()
