import hashlib
import io
import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, status, Response, Request, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from PIL import Image, ImageDraw
import pymupdf as fitz
import pytesseract

from app.db import (
    get_connection,
    init_db,
    add_audit_entry,
    verify_audit_chain,
    DOCUMENTS_DIR,
    REGULATORY_SOURCES_DIR,
)
from app.regulatory_ingestion import (
    ingest_regulatory_pdf,
    update_clause_verification,
    set_source_superseded,
    seed_initial_regulatory_sources_if_empty,
    audit_regulatory_clauses,
    get_regulatory_review_queue,
    link_clause_supersession,
    activate_regulatory_clause,
)
from app.extractor import extract_document_fields, normalize_field
from app.rules_engine import evaluate_ruleset, seed_default_rules_if_empty
from app.report import render_html_report
from app.replay import execute_replay_for_application
from app.authenticity import evaluate_document_authenticity
import shutil
from app.auth import (
    auth_router,
    get_current_user,
    verify_reviewer_permission,
    require_role,
    require_permission,
    IS_PRODUCTION,
)


def _resolve_tesseract() -> str:
    env_cmd = os.getenv("TESSERACT_CMD")
    if env_cmd and Path(env_cmd).exists():
        return env_cmd
    which_cmd = shutil.which("tesseract")
    if which_cmd:
        return which_cmd
    default_win = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
    if default_win.exists():
        return str(default_win)
    return "tesseract"


pytesseract.pytesseract.tesseract_cmd = _resolve_tesseract()

# Limits
MAX_EXTRACT_FILE_SIZE = 10 * 1024 * 1024  # 10 MB for ad-hoc OCR endpoint
MAX_UPLOAD_FILE_SIZE = 15 * 1024 * 1024   # 15 MB TRD limit for document uploads
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}


class ApplicationCreate(BaseModel):
    application_type: Optional[str] = Field(default=None, description="Application category or type")
    applicationType: Optional[str] = None
    applicant_name: Optional[str] = Field(default=None, description="Name of applicant")
    applicantName: Optional[str] = None
    institution_name: Optional[str] = Field(default=None, description="Name of institution")
    institutionName: Optional[str] = None
    institutionCode: Optional[str] = None
    academicYear: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    address: Optional[str] = None
    intakeCapacity: Optional[int] = None

    @field_validator("application_type", "applicationType")
    @classmethod
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            return clean if clean else None
        return None

    @field_validator("applicant_name", "applicantName", "institution_name", "institutionName")
    @classmethod
    def clean_optional_strings(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            return clean if clean else None
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    
    # In production or serverless environments, skip synthetic demo data seeding to prevent cold-start latency
    is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
    should_seed_demo = not IS_PRODUCTION and not is_serverless and not os.getenv("SKIP_DEMO_SEEDING")

    with get_connection() as conn:
        seed_initial_regulatory_sources_if_empty(conn)
        if should_seed_demo:
            app_count = conn.execute("SELECT COUNT(*) as cnt FROM applications").fetchone()["cnt"]
            if app_count == 0:
                try:
                    from scripts.seed_demo_applications import seed
                    seed()
                except Exception as exc:
                    print(f"[Lifespan] Note: initial demo seed: {exc}")
    yield


app = FastAPI(
    title="Niyantran API",
    description="Local-first AI-Powered Application Validation, Document Authentication and Regulatory Compliance Verification API",
    version="0.4.0",
    lifespan=lifespan,
)

cors_origins_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
if not allowed_origins:
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins != ["*"] else ["*"],
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:\d+|http://127\.0\.0\.1:\d+" if allowed_origins == ["*"] else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)


app.include_router(auth_router)


@app.get("/")
def home():
    return {"project": "Niyantran", "status": "running"}


@app.get("/api/health")
def health():
    try:
        with get_connection() as conn:
            conn.execute("SELECT 1").fetchone()
        return {"status": "healthy", "database": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unreachable: {exc}")


@app.get("/api/ocr/status")
def ocr_status():
    try:
        ver = str(pytesseract.get_tesseract_version())
        available = True
    except Exception:
        ver = "unavailable"
        available = False
    return {
        "available": available,
        "version": ver,
        "pdf_ocr": True,
    }


@app.get("/api/dashboard/summary")
def get_dashboard_summary(current_user: Dict[str, Any] = Depends(get_current_user)):
    role = (current_user.get("role") or "").lower()
    user_id = current_user.get("user_id")
    inst_name = (current_user.get("institution_name") or "").strip()
    inst_id = current_user.get("institution_id")

    with get_connection() as conn:
        # Enforce institutional data isolation
        if role in ("reviewer", "admin", "auditor"):
            apps = conn.execute("SELECT * FROM applications ORDER BY created_at DESC").fetchall()
        else:
            apps = conn.execute(
                """
                SELECT * FROM applications 
                WHERE (user_id = ? OR (institution_id = ? AND ? IS NOT NULL) OR (LOWER(institution_name) = LOWER(?) AND ? != ''))
                ORDER BY created_at DESC
                """,
                (user_id, inst_id, inst_id, inst_name, inst_name),
            ).fetchall()

        total_apps = len(apps)
        app_ids = [a["id"] for a in apps]

        # Clean empty state when no authorized applications exist
        if not app_ids:
            return {
                "data": {
                    "kpis": {
                        "totalApplications": 0,
                        "validatedApplications": 0,
                        "compliantApplications": 0,
                        "pendingFilings": 0,
                        "draftApplications": 0,
                        "underReviewApplications": 0,
                        "pendingReviews": 0,
                        "flaggedApplications": 0,
                        "applicationsWithIssues": 0,
                        "totalFindingViolations": 0,
                        "recentRuleChanges": 0,
                        "averageProcessingTime": "Instant (Local Engine)",
                    },
                    "cohortBreakdown": {
                        "total": 0,
                        "verified": 0,
                        "pendingFilings": 0,
                        "drafts": 0,
                        "underReview": 0,
                        "issues": 0,
                        "discrepancies": 0,
                        "missingDocs": 0,
                    },
                    "statusDistribution": [],
                    "findingsBySeverity": [
                        {"severity": "Critical", "count": 0},
                        {"severity": "High", "count": 0},
                        {"severity": "Medium", "count": 0},
                        {"severity": "Low", "count": 0},
                    ],
                    "recentActivity": [],
                    "recentApplications": [],
                    "complianceOverview": {
                        "score": None,
                        "status": "Not Evaluated",
                        "totalRules": 0,
                        "passedRules": 0,
                        "failedRules": 0,
                        "unverifiedRules": 0,
                        "evaluatedCount": 0,
                        "totalCount": 0,
                    },
                }
            }

        placeholders = ",".join("?" for _ in app_ids)
        findings = conn.execute(
            f"""
            SELECT f.* FROM findings f 
            JOIN validation_runs vr ON f.validation_run_id = vr.id 
            WHERE vr.application_id IN ({placeholders})
            """,
            tuple(app_ids),
        ).fetchall()

        fail_count = sum(1 for f in findings if f["status"] == "fail")
        unverified_count = sum(1 for f in findings if f["status"] == "unverified")

        # Compute per-application and overall compliance evidence
        total_passed_rules = 0
        total_failed_rules = 0
        total_unverified_rules = 0
        total_applicable_rules = 0
        evaluated_apps_count = 0
        compliant_apps_count = 0
        discrepant_apps_count = 0
        under_review_apps_count = 0
        draft_apps_count = 0

        recent_apps = []
        for a in apps[:8]:
            app_id = a["id"]
            doc_cnt = conn.execute("SELECT COUNT(*) FROM documents WHERE application_id = ?", (app_id,)).fetchone()[0]

            latest_vr = conn.execute(
                "SELECT * FROM validation_runs WHERE application_id = ? ORDER BY started_at DESC LIMIT 1",
                (app_id,)
            ).fetchone()

            raw_app_status = (a["status"] or "draft").lower()

            if latest_vr:
                evaluated_apps_count += 1
                try:
                    summary = json.loads(latest_vr["summary_json"])
                except Exception:
                    summary = {}
                t_rules = summary.get("total_rules_evaluated", 0)
                p_rules = summary.get("pass", 0)
                f_rules = summary.get("fail", 0)
                u_rules = summary.get("unverified", 0)

                total_applicable_rules += t_rules
                total_passed_rules += p_rules
                total_failed_rules += f_rules
                total_unverified_rules += u_rules

                if t_rules == 0:
                    comp_score = None
                    eval_status = "Not Evaluated"
                    draft_apps_count += 1
                elif p_rules == 0 and f_rules == 0 and u_rules > 0:
                    comp_score = 0.0
                    eval_status = "Insufficient Evidence"
                    under_review_apps_count += 1
                else:
                    comp_score = round((p_rules / t_rules) * 100, 1)
                    if f_rules > 0:
                        eval_status = "Discrepancy Detected"
                        discrepant_apps_count += 1
                    elif u_rules > 0:
                        eval_status = "Insufficient Evidence"
                        under_review_apps_count += 1
                    elif p_rules == t_rules:
                        eval_status = "Compliant"
                        compliant_apps_count += 1
                    else:
                        eval_status = "Partially Compliant"
                        under_review_apps_count += 1
            else:
                comp_score = None
                eval_status = "Not Evaluated"
                t_rules = p_rules = f_rules = u_rules = 0
                if raw_app_status == "draft":
                    draft_apps_count += 1
                else:
                    under_review_apps_count += 1

            f_cnt = conn.execute(
                "SELECT COUNT(*) FROM findings f JOIN validation_runs vr ON f.validation_run_id = vr.id WHERE vr.application_id = ?",
                (app_id,)
            ).fetchone()[0]

            intake_row = conn.execute(
                "SELECT ef.field_value FROM extracted_fields ef JOIN extraction_runs er ON ef.extraction_run_id = er.id JOIN documents d ON er.document_id = d.id WHERE d.application_id = ? AND ef.field_name LIKE '%intake%' LIMIT 1",
                (app_id,)
            ).fetchone()
            intake_val = intake_row[0] if intake_row else None

            # Standardized display status
            if eval_status == "Discrepancy Detected":
                display_status = "Discrepancy Detected"
            elif eval_status == "Compliant":
                display_status = "Verified"
            elif eval_status == "Insufficient Evidence":
                display_status = "Under Review"
            else:
                display_status = "Draft"

            recent_apps.append({
                "id": a["id"],
                "institutionName": a["institution_name"] or a["applicant_name"] or "Institutional Applicant",
                "institutionCode": a["id"],
                "applicationType": a["application_type"],
                "applicantName": a["applicant_name"] or "Applicant",
                "status": display_status,
                "rawStatus": a["status"] or "draft",
                "submittedAt": a["created_at"],
                "updatedAt": a["updated_at"],
                "documentCount": doc_cnt,
                "findingsCount": f_cnt,
                "intakeCapacity": intake_val,
                "complianceScore": comp_score,
                "complianceStatus": eval_status,
                "passedRules": p_rules,
                "failedRules": f_rules,
                "unverifiedRules": u_rules,
                "totalRules": t_rules,
            })

        # Overall compliance calculation
        if total_applicable_rules > 0:
            overall_score = round((total_passed_rules / total_applicable_rules) * 100, 1)
            if total_failed_rules > 0:
                overall_status = "Discrepancy Detected"
            elif total_unverified_rules > 0:
                overall_status = "Insufficient Evidence"
            elif total_passed_rules == total_applicable_rules:
                overall_status = "Compliant"
            else:
                overall_status = "Partially Compliant"
        else:
            overall_score = None
            overall_status = "Not Evaluated"

        compliance_overview = {
            "score": overall_score,
            "status": overall_status,
            "totalRules": total_applicable_rules,
            "passedRules": total_passed_rules,
            "failedRules": total_failed_rules,
            "unverifiedRules": total_unverified_rules,
            "evaluatedCount": evaluated_apps_count,
            "totalCount": total_apps,
        }

        # Status distribution from actual computed application states
        status_dist = []
        if compliant_apps_count > 0:
            status_dist.append({"name": "Verified Compliant", "value": compliant_apps_count, "color": "#16A34A"})
        if discrepant_apps_count > 0:
            status_dist.append({"name": "Discrepancy Detected", "value": discrepant_apps_count, "color": "#DC2626"})
        if under_review_apps_count > 0:
            status_dist.append({"name": "Under Review", "value": under_review_apps_count, "color": "#F59E0B"})
        if draft_apps_count > 0:
            status_dist.append({"name": "Draft", "value": draft_apps_count, "color": "#83B8E0"})

        crit_count = sum(1 for f in findings if f["severity"] == "critical")
        high_count = sum(1 for f in findings if f["severity"] == "high")
        med_count = sum(1 for f in findings if f["severity"] == "medium")
        low_count = sum(1 for f in findings if f["severity"] == "low")

        if role in ("reviewer", "admin", "auditor"):
            recent_audit = conn.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT 8").fetchall()
        else:
            recent_audit = conn.execute(
                f"SELECT * FROM audit_log WHERE entity_id IN ({placeholders}) OR actor = ? ORDER BY id DESC LIMIT 8",
                (*app_ids, current_user.get("email")),
            ).fetchall()

        recent_activity = [
            {
                "id": f"ACT-{r['id']}",
                "action": r["event_type"].replace("_", " ").title(),
                "actor": r["actor"] or "Officer / System",
                "target": r["entity_id"] or r["entity_type"],
                "timestamp": r["created_at"],
                "badge": "bg-accent/15 text-accent",
            }
            for r in recent_audit
        ]

        rules_count = conn.execute("SELECT COUNT(*) FROM rules").fetchone()[0]

        return {
            "data": {
                "kpis": {
                    "totalApplications": total_apps,
                    "validatedApplications": compliant_apps_count,
                    "pendingFilings": draft_apps_count + under_review_apps_count,
                    "draftApplications": draft_apps_count,
                    "underReviewApplications": under_review_apps_count,
                    "pendingReviews": under_review_apps_count,
                    "flaggedApplications": discrepant_apps_count,
                    "applicationsWithIssues": discrepant_apps_count,
                    "totalFindingViolations": fail_count + unverified_count,
                    "recentRuleChanges": rules_count,
                    "averageProcessingTime": "Instant (Local Engine)",
                },
                "cohortBreakdown": {
                    "total": total_apps,
                    "verified": compliant_apps_count,
                    "pendingFilings": draft_apps_count + under_review_apps_count,
                    "drafts": draft_apps_count,
                    "underReview": under_review_apps_count,
                    "issues": discrepant_apps_count,
                    "discrepancies": discrepant_apps_count,
                    "missingDocs": 0,
                },
                "statusDistribution": status_dist if status_dist else [{"name": "Draft", "value": total_apps, "color": "#F59E0B"}],
                "findingsBySeverity": [
                    {"severity": "Critical", "count": crit_count},
                    {"severity": "High", "count": high_count},
                    {"severity": "Medium", "count": med_count},
                    {"severity": "Low", "count": low_count},
                ],
                "recentActivity": recent_activity,
                "recentApplications": recent_apps,
                "complianceOverview": compliance_overview,
            }
        }


# ==========================================
# Application Ownership & Security Helpers
# ==========================================

def check_application_access(conn, application_id: str, current_user: Dict[str, Any]):
    """
    Enforces institutional data isolation:
    - Reviewers, admins, and auditors can access all applications.
    - Institution users can ONLY access applications owned by their user_id, institution_id, or matching institution_name.
    """
    if not isinstance(current_user, dict):
        current_user = {"role": "reviewer", "id": "USR-SYSTEM"}

    app_row = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")

    role = (current_user.get("role") or "").lower()
    if role in ("reviewer", "admin", "auditor"):
        return app_row

    user_id = current_user.get("user_id")
    inst_name = (current_user.get("institution_name") or "").strip().lower()
    inst_id = current_user.get("institution_id")

    app_user_id = app_row["user_id"]
    app_inst_name = (app_row["institution_name"] or "").strip().lower()
    app_inst_id = app_row["institution_id"]

    has_access = False
    if user_id and app_user_id and user_id == app_user_id:
        has_access = True
    elif inst_id and app_inst_id and inst_id == app_inst_id:
        has_access = True
    elif inst_name and app_inst_name and (inst_name in app_inst_name or app_inst_name in inst_name):
        has_access = True

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You are not authorized to view or modify this institution's application records.",
        )
    return app_row


def check_document_access(conn, document_id: str, current_user: Dict[str, Any]):
    """Verifies that the actor has permission to access the document via its parent application."""
    doc_row = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
    if not doc_row:
        raise HTTPException(status_code=404, detail="Document not found")
    check_application_access(conn, doc_row["application_id"], current_user)
    return doc_row


def check_finding_access(conn, finding_id: str, current_user: Dict[str, Any]):
    """Verifies that the actor has permission to view the finding via its parent application."""
    finding = conn.execute(
        """
        SELECT f.*, v.application_id 
        FROM findings f 
        JOIN validation_runs v ON f.validation_run_id = v.id 
        WHERE f.id = ?
        """,
        (finding_id,),
    ).fetchone()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    check_application_access(conn, finding["application_id"], current_user)
    return finding


# ==========================================
# Applications Endpoints
# ==========================================

@app.post("/api/applications", status_code=status.HTTP_201_CREATED)
def create_application(payload: ApplicationCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    clean_app_type = (payload.application_type or payload.applicationType or "").strip()
    if not clean_app_type:
        raise HTTPException(status_code=422, detail="application_type cannot be blank")

    applicant = payload.applicant_name or payload.applicantName
    if applicant:
        applicant = applicant.strip() or None
    else:
        applicant = current_user.get("full_name") or "Institutional Applicant"

    institution = payload.institution_name or payload.institutionName
    if institution:
        institution = institution.strip() or None
    else:
        institution = current_user.get("institution_name") or "Institutional Applicant"

    user_id = current_user.get("user_id")
    inst_id = current_user.get("institution_id")

    app_id = f"APP-{uuid.uuid4().hex[:12].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    app_status = "draft"

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO applications (id, application_type, applicant_name, institution_name, status, user_id, institution_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                app_id,
                clean_app_type,
                applicant,
                institution,
                app_status,
                user_id,
                inst_id,
                now,
                now,
            ),
        )
        add_audit_entry(
            conn=conn,
            event_type="APPLICATION_CREATED",
            entity_type="application",
            entity_id=app_id,
            event_data={
                "application_type": clean_app_type,
                "applicant_name": applicant,
                "institution_name": institution,
                "user_id": user_id,
                "institution_id": inst_id,
                "status": app_status,
            },
            actor=current_user.get("email") or "compliance-officer",
        )

    return {
        "id": app_id,
        "application_type": clean_app_type,
        "applicant_name": applicant,
        "institution_name": institution,
        "user_id": user_id,
        "institution_id": inst_id,
        "status": app_status,
        "created_at": now,
        "updated_at": now,
        # Frontend convenience aliases
        "applicationType": clean_app_type,
        "applicantName": applicant,
        "institutionName": institution or applicant or "Institutional Applicant",
        "institutionCode": app_id,
        "submittedAt": now,
    }


@app.get("/api/applications")
def list_applications(status: Optional[str] = Query(default=None), current_user: Dict[str, Any] = Depends(get_current_user)):
    role = (current_user.get("role") or "").lower()
    user_id = current_user.get("user_id")
    inst_name = (current_user.get("institution_name") or "").strip()
    inst_id = current_user.get("institution_id")

    with get_connection() as conn:
        if role in ("reviewer", "admin", "auditor"):
            if status:
                rows = conn.execute(
                    "SELECT * FROM applications WHERE status = ? ORDER BY created_at DESC",
                    (status,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM applications ORDER BY created_at DESC"
                ).fetchall()
        else:
            # Institution user: ONLY see applications owned by user or their institution
            query = """
                SELECT * FROM applications 
                WHERE (user_id = ? OR (institution_id = ? AND ? IS NOT NULL) OR (LOWER(institution_name) = LOWER(?) AND ? != ''))
            """
            params = [user_id, inst_id, inst_id, inst_name, inst_name]
            if status:
                query += " AND status = ?"
                params.append(status)
            query += " ORDER BY created_at DESC"
            rows = conn.execute(query, params).fetchall()

    return [dict(r) for r in rows]


@app.get("/api/applications/{application_id}")
def get_application(application_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        app_row = check_application_access(conn, application_id, current_user)
        doc_rows = conn.execute(
            "SELECT * FROM documents WHERE application_id = ? ORDER BY uploaded_at ASC",
            (application_id,),
        ).fetchall()

    result = dict(app_row)
    result["documents"] = [dict(d) for d in doc_rows]
    return result


# ==========================================
# Documents Endpoints
# ==========================================

@app.post("/api/applications/{application_id}/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(
    application_id: str,
    file: UploadFile = File(...),
    document_type: Optional[str] = Form(default=None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    if document_type is None:
        clean_doc_type = "General Document"
    else:
        clean_doc_type = document_type.strip()
        if not clean_doc_type:
            raise HTTPException(status_code=422, detail="document_type cannot be blank")

    # Verify application exists and authorized
    with get_connection() as conn:
        check_application_access(conn, application_id, current_user)

    original_filename = Path(file.filename or "uploaded_file").name
    ext = Path(original_filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed types: PDF, PNG, JPG, JPEG",
        )

    # Read and enforce file size
    content = await file.read(MAX_UPLOAD_FILE_SIZE + 1)
    if len(content) > MAX_UPLOAD_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size exceeds maximum allowed limit of 15 MB",
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    # Content signature & structure validation
    mime_type: str
    page_count: int = 1

    if ext == ".pdf":
        if not content.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=400,
                detail="File content does not match PDF signature",
            )
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            page_count = len(doc)
            doc.close()
            if page_count < 1:
                raise HTTPException(status_code=400, detail="PDF has 0 pages")
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Malformed or unreadable PDF document: {exc}",
            )
        mime_type = "application/pdf"
    elif ext == ".png":
        if not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise HTTPException(
                status_code=400,
                detail="File content does not match PNG signature",
            )
        try:
            img = Image.open(io.BytesIO(content))
            img.verify()
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Malformed or unreadable PNG image: {exc}",
            )
        mime_type = "image/png"
        page_count = 1
    else:  # .jpg, .jpeg
        if not (content.startswith(b"\xff\xd8\xff") or content.startswith(b"\xff\xd8")):
            raise HTTPException(
                status_code=400,
                detail="File content does not match JPEG signature",
            )
        try:
            img = Image.open(io.BytesIO(content))
            img.verify()
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Malformed or unreadable JPEG image: {exc}",
            )
        mime_type = "image/jpeg"
        page_count = 1

    file_size = len(content)
    sha256_hash = hashlib.sha256(content).hexdigest()

    # Dedicated local storage outside source-code directory with UUID filename
    storage_uuid = uuid.uuid4().hex
    stored_filename = f"{storage_uuid}{ext}"
    stored_file_path = DOCUMENTS_DIR / stored_filename
    relative_stored_path = f"documents/{stored_filename}"

    # Write file safely
    stored_file_path.write_bytes(content)

    doc_id = f"DOC-{uuid.uuid4().hex[:12].upper()}"
    uploaded_at = datetime.now(timezone.utc).isoformat()

    try:
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO documents (
                    id, application_id, document_type, original_filename,
                    stored_path, mime_type, sha256, file_size, page_count,
                    uploaded_at, version, processing_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    doc_id,
                    application_id,
                    clean_doc_type,
                    original_filename,
                    relative_stored_path,
                    mime_type,
                    sha256_hash,
                    file_size,
                    page_count,
                    uploaded_at,
                    1,
                    "uploaded",
                ),
            )
            add_audit_entry(
                conn=conn,
                event_type="DOCUMENT_UPLOADED",
                entity_type="document",
                entity_id=doc_id,
                event_data={
                    "application_id": application_id,
                    "document_type": clean_doc_type,
                    "original_filename": original_filename,
                    "sha256": sha256_hash,
                    "file_size": file_size,
                    "page_count": page_count,
                },
                actor="compliance-officer",
            )
    except Exception:
        # On failure, remove file to avoid orphans
        if stored_file_path.exists():
            try:
                stored_file_path.unlink()
            except Exception:
                pass
        raise
    finally:
        await file.close()

    return {
        "id": doc_id,
        "application_id": application_id,
        "document_type": clean_doc_type,
        "original_filename": original_filename,
        "name": original_filename,
        "category": clean_doc_type,
        "stored_path": relative_stored_path,
        "mime_type": mime_type,
        "sha256": sha256_hash,
        "file_size": file_size,
        "page_count": page_count,
        "pages": page_count,
        "uploaded_at": uploaded_at,
        "uploadDate": uploaded_at.split("T")[0] if "T" in uploaded_at else uploaded_at,
        "version": 1,
        "processing_status": "uploaded",
        "status": "uploaded",
    }


@app.get("/api/applications/{application_id}/documents")
def list_application_documents(application_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        check_application_access(conn, application_id, current_user)
        docs = conn.execute(
            "SELECT * FROM documents WHERE application_id = ? ORDER BY uploaded_at ASC",
            (application_id,),
        ).fetchall()
    return [dict(d) for d in docs]


@app.get("/api/documents/{document_id}")
def get_document(document_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        doc = check_document_access(conn, document_id, current_user)
    return dict(doc)


# ==========================================
# Audit Verification Endpoint
# ==========================================

@app.get("/api/audit/verify")
def verify_audit():
    with get_connection() as conn:
        return verify_audit_chain(conn)


@app.get("/api/audit/log")
def get_audit_log(limit: int = Query(default=100, ge=1, le=1000)):
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


# ==========================================
# Preserved OCR Extraction Endpoint
# ==========================================

@app.post("/api/documents/extract")
async def extract_document(file: UploadFile = File(...)):
    filename = (file.filename or "").lower()
    if not filename.endswith((".pdf", ".png", ".jpg", ".jpeg")):
        raise HTTPException(status_code=400, detail="Upload a PDF, PNG or JPG")
    content = await file.read(MAX_EXTRACT_FILE_SIZE + 1)
    if len(content) > MAX_EXTRACT_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Maximum file size is 10 MB")
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")
    try:
        if filename.endswith(".pdf"):
            pdf = fitz.open(stream=content, filetype="pdf")
            pages = []
            ocr_errors = []
            try:
                for number, page in enumerate(pdf, start=1):
                    text = page.get_text().strip()
                    method = "PDF text extraction"
                    if len(text) < 20:
                        try:
                            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                            image = Image.open(io.BytesIO(pix.tobytes("png")))
                            text = pytesseract.image_to_string(image).strip()
                            method = "Tesseract OCR"
                        except Exception as ocr_err:
                            ocr_errors.append(f"Page {number}: OCR unavailable ({ocr_err})")
                            method = "OCR Unavailable"
                    pages.append({"page": number, "method": method, "text": text})
            finally:
                pdf.close()

            # If all pages required OCR and OCR failed completely (zero extracted text):
            total_text = "".join(p["text"] for p in pages).strip()
            if not total_text and ocr_errors:
                raise HTTPException(
                    status_code=503,
                    detail=f"Scanned PDF extraction failed: OCR engine (Tesseract) is unavailable on this system. Details: {'; '.join(ocr_errors)}"
                )
            return {
                "filename": file.filename,
                "pages_processed": len(pages),
                "pages": pages,
                "text": "\n\n".join(
                    "--- Page " + str(p["page"]) + " ---\n" + p["text"] for p in pages
                ),
            }
        image = Image.open(io.BytesIO(content))
        try:
            extracted_text = pytesseract.image_to_string(image).strip()
        except Exception as ocr_err:
            raise HTTPException(
                status_code=503,
                detail=f"OCR engine (Tesseract) is unavailable in current runtime environment: {str(ocr_err)}"
            )
        return {
            "filename": file.filename,
            "method": "Tesseract OCR",
            "text": extracted_text,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail="Could not read the file: " + str(exc)
        )
    finally:
        await file.close()


# ==========================================
# Phase 2: Structured Field Extraction & Review Endpoints
# ==========================================

class FieldConfirmUpdate(BaseModel):
    field_value: Optional[str] = Field(default=None, description="Corrected field value if updating")
    confirmed: Optional[bool] = Field(default=True, description="Whether the field is confirmed as correct")
    confirmed_by: Optional[str] = Field(default="reviewer", description="Identifier of the reviewer")

    @field_validator("field_value")
    @classmethod
    def clean_field_value(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            return clean if clean else None
        return None


def format_field_row(row: Any) -> Dict[str, Any]:
    bbox = None
    if row["bbox_json"]:
        try:
            bbox = json.loads(row["bbox_json"])
        except Exception:
            bbox = None
    conf = row["confidence"]
    confirmed_bool = bool(row["confirmed"])
    is_uncertain = (conf is None or conf < 0.8)
    needs_review = is_uncertain and not confirmed_bool

    keys = row.keys() if hasattr(row, "keys") else []
    doc_id = row["document_id"] if "document_id" in keys else None
    orig_filename = row["original_filename"] if "original_filename" in keys else None
    doc_type = row["document_type"] if "document_type" in keys else None

    # Standardize status badge for 4-column simplified table: 'Supported', 'Needs Review', 'Not Found', 'Conflict'
    if not row["field_value"] or str(row["field_value"]).strip().lower() in ("not found", "none", ""):
        status_label = "Not Found"
    elif confirmed_bool:
        status_label = "Supported"
    elif is_uncertain:
        status_label = "Needs Review"
    else:
        status_label = "Supported"

    return {
        "id": row["id"],
        "extraction_run_id": row["extraction_run_id"],
        "document_id": doc_id,
        "original_filename": orig_filename,
        "document_name": orig_filename,
        "sourceDocument": orig_filename or "Uploaded Document",
        "document_type": doc_type,
        "field_name": row["field_name"],
        "fieldName": row["field_name"].replace("_", " ").title(),
        "field_value": row["field_value"],
        "extractedValue": row["field_value"],
        "normalized_value": row["normalized_value"],
        "confidence": conf,
        "page_number": row["page_number"],
        "pageNumber": row["page_number"],
        "extraction_method": row["extraction_method"],
        "extractionMethod": row["extraction_method"],
        "bbox": bbox,
        "bbox_json": row["bbox_json"],
        "status": status_label,
        "verificationStatus": status_label,
        "needs_review": needs_review,
        "is_uncertain": is_uncertain,
        "confirmed": confirmed_bool,
        "isConfirmed": confirmed_bool,
        "confirmed_by": row["confirmed_by"],
        "confirmed_at": row["confirmed_at"],
    }


@app.post("/api/documents/{document_id}/extract")
def extract_stored_document(document_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        doc = check_document_access(conn, document_id, current_user)

        filename = Path(doc["stored_path"]).name
        file_path = DOCUMENTS_DIR / filename
        if not file_path.exists():
            raise HTTPException(status_code=400, detail=f"Document file missing from storage: {filename}")

        next_run_row = conn.execute(
            "SELECT COALESCE(MAX(run_number), 0) + 1 AS next_run FROM extraction_runs WHERE document_id = ?",
            (document_id,),
        ).fetchone()
        run_number = next_run_row["next_run"]
        run_id = f"EXT-{uuid.uuid4().hex[:12].upper()}"
        now_start = datetime.now(timezone.utc).isoformat()

        try:
            extraction_result = extract_document_fields(file_path=file_path, mime_type=doc["mime_type"])
        except Exception as exc:
            now_err = datetime.now(timezone.utc).isoformat()
            conn.execute(
                """
                INSERT INTO extraction_runs (id, document_id, run_number, method, status, started_at, completed_at, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (run_id, document_id, run_number, "tesseract_ocr", "failed", now_start, now_err, str(exc)),
            )
            raise HTTPException(status_code=500, detail=f"Extraction failed: {exc}")

        now_end = datetime.now(timezone.utc).isoformat()
        warning_msg = extraction_result.get("warning_message")
        conn.execute(
            """
            INSERT INTO extraction_runs (id, document_id, run_number, method, status, started_at, completed_at, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (run_id, document_id, run_number, extraction_result["method"], "completed", now_start, now_end, warning_msg),
        )

        extracted_field_records = []
        for f in extraction_result["fields"]:
            field_id = f"FLD-{uuid.uuid4().hex[:12].upper()}"
            conn.execute(
                """
                INSERT INTO extracted_fields (
                    id, extraction_run_id, field_name, field_value, normalized_value,
                    confidence, page_number, bbox_json, extraction_method, confirmed, confirmed_by, confirmed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    field_id,
                    run_id,
                    f["field_name"],
                    f["field_value"],
                    f["normalized_value"],
                    f["confidence"],
                    f["page_number"],
                    f["bbox_json"],
                    f["extraction_method"],
                    0,
                    None,
                    None,
                ),
            )
            extracted_field_records.append({
                "id": field_id,
                "extraction_run_id": run_id,
                "document_id": document_id,
                "field_name": f["field_name"],
                "field_value": f["field_value"],
                "normalized_value": f["normalized_value"],
                "confidence": f["confidence"],
                "page_number": f["page_number"],
                "extraction_method": f["extraction_method"],
                "bbox": f.get("bbox"),
                "bbox_json": f.get("bbox_json"),
                "needs_review": bool(f["confidence"] is None or f["confidence"] < 0.8),
                "is_uncertain": bool(f["confidence"] is None or f["confidence"] < 0.8),
                "confirmed": False,
                "confirmed_by": None,
                "confirmed_at": None,
            })

        conn.execute(
            "UPDATE documents SET processing_status = 'extracted' WHERE id = ?",
            (document_id,),
        )

        add_audit_entry(
            conn=conn,
            event_type="EXTRACTION_COMPLETED",
            entity_type="extraction_run",
            entity_id=run_id,
            event_data={
                "document_id": document_id,
                "run_number": run_number,
                "method": extraction_result["method"],
                "field_count": len(extracted_field_records),
            },
            actor="compliance-officer",
        )

    return {
        "extraction_run_id": run_id,
        "document_id": document_id,
        "run_number": run_number,
        "method": extraction_result["method"],
        "classification": extraction_result.get("classification"),
        "document_type_display": extraction_result.get("document_type_display"),
        "is_regulatory_document": extraction_result.get("is_regulatory_document", True),
        "message": extraction_result.get("message"),
        "status": "completed",
        "started_at": now_start,
        "completed_at": now_end,
        "fields_extracted": len(extracted_field_records),
        "fields": extracted_field_records,
    }


@app.get("/api/documents/{document_id}/fields")
def list_document_fields(document_id: str, run_id: Optional[str] = Query(default=None), current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        check_document_access(conn, document_id, current_user)

        if run_id:
            rows = conn.execute(
                """
                SELECT ef.*, er.document_id 
                FROM extracted_fields ef
                JOIN extraction_runs er ON ef.extraction_run_id = er.id
                WHERE er.document_id = ? AND er.id = ?
                ORDER BY ef.page_number ASC, ef.id ASC
                """,
                (document_id, run_id),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT ef.*, er.document_id 
                FROM extracted_fields ef
                JOIN extraction_runs er ON ef.extraction_run_id = er.id
                WHERE er.document_id = ? 
                  AND er.id = (SELECT id FROM extraction_runs WHERE document_id = ? ORDER BY run_number DESC LIMIT 1)
                ORDER BY ef.page_number ASC, ef.id ASC
                """,
                (document_id, document_id),
            ).fetchall()

    return [format_field_row(r) for r in rows]


@app.get("/api/documents/{document_id}/extraction-runs")
def list_document_extraction_runs(document_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        check_document_access(conn, document_id, current_user)

        rows = conn.execute(
            "SELECT * FROM extraction_runs WHERE document_id = ? ORDER BY run_number DESC",
            (document_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/applications/{application_id}/fields")
def list_application_fields(application_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        check_application_access(conn, application_id, current_user)

        rows = conn.execute(
            """
            SELECT ef.*, er.document_id, d.original_filename, d.document_type
            FROM extracted_fields ef
            JOIN extraction_runs er ON ef.extraction_run_id = er.id
            JOIN documents d ON er.document_id = d.id
            WHERE d.application_id = ?
              AND er.id IN (
                  SELECT er2.id FROM extraction_runs er2 
                  WHERE er2.document_id = d.id 
                  ORDER BY er2.run_number DESC LIMIT 1
              )
            ORDER BY d.uploaded_at ASC, ef.page_number ASC, ef.id ASC
            """,
            (application_id,),
        ).fetchall()
    return [format_field_row(r) for r in rows]


@app.post("/api/applications/{application_id}/extract")
def extract_application_documents(application_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        check_application_access(conn, application_id, current_user)

        docs = conn.execute(
            "SELECT id FROM documents WHERE application_id = ? ORDER BY uploaded_at ASC",
            (application_id,),
        ).fetchall()

    results = []
    for d in docs:
        try:
            res = extract_stored_document(d["id"], current_user=current_user)
            results.append(res)
        except Exception as exc:
            results.append({
                "document_id": d["id"],
                "status": "failed",
                "error": str(exc),
                "fields": []
            })
    return {
        "application_id": application_id,
        "documents_processed": len(results),
        "results": results,
    }


@app.get("/api/fields/{field_id}")
def get_extracted_field(field_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT ef.*, er.document_id 
            FROM extracted_fields ef
            JOIN extraction_runs er ON ef.extraction_run_id = er.id
            WHERE ef.id = ?
            """,
            (field_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Extracted field not found")
        check_document_access(conn, row["document_id"], current_user)
    return format_field_row(row)


@app.patch("/api/fields/{field_id}")
def update_or_confirm_field(field_id: str, payload: FieldConfirmUpdate, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT ef.*, er.document_id 
            FROM extracted_fields ef
            JOIN extraction_runs er ON ef.extraction_run_id = er.id
            WHERE ef.id = ?
            """,
            (field_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Extracted field not found")
        check_document_access(conn, row["document_id"], current_user)

        field_name = row["field_name"]
        old_raw_value = row["field_value"]
        new_raw_value = payload.field_value if payload.field_value is not None else old_raw_value

        if payload.field_value is not None:
            new_normalized_value, _ = normalize_field(field_name, new_raw_value)
            was_corrected = (new_raw_value != old_raw_value)
        else:
            new_normalized_value = row["normalized_value"]
            was_corrected = False

        confirmed_flag = 1 if payload.confirmed else 0
        now_ts = datetime.now(timezone.utc).isoformat()
        confirmed_by = (payload.confirmed_by or "reviewer") if payload.confirmed else None
        confirmed_at = now_ts if payload.confirmed else None

        conn.execute(
            """
            UPDATE extracted_fields 
            SET field_value = ?, normalized_value = ?, confirmed = ?, confirmed_by = ?, confirmed_at = ?
            WHERE id = ?
            """,
            (new_raw_value, new_normalized_value, confirmed_flag, confirmed_by, confirmed_at, field_id),
        )

        event_type = "FIELD_CORRECTED" if was_corrected else ("FIELD_CONFIRMED" if payload.confirmed else "FIELD_UNCONFIRMED")
        add_audit_entry(
            conn=conn,
            event_type=event_type,
            entity_type="extracted_field",
            entity_id=field_id,
            event_data={
                "document_id": row["document_id"],
                "field_name": field_name,
                "previous_value": old_raw_value,
                "new_value": new_raw_value,
                "confirmed": bool(payload.confirmed),
                "confirmed_by": confirmed_by,
            },
            actor=confirmed_by or "compliance-officer",
        )

        updated_row = conn.execute(
            """
            SELECT ef.*, er.document_id 
            FROM extracted_fields ef
            JOIN extraction_runs er ON ef.extraction_run_id = er.id
            WHERE ef.id = ?
            """,
            (field_id,),
        ).fetchone()

    return format_field_row(updated_row)


@app.post("/api/fields/{field_id}/confirm")
def confirm_field(
    field_id: str,
    payload: Optional[FieldConfirmUpdate] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    p = payload or FieldConfirmUpdate(confirmed=True, confirmed_by="reviewer")
    if p.confirmed is None:
        p.confirmed = True
    return update_or_confirm_field(field_id, p, current_user=current_user)


# ==========================================
# Phase 3: Rules Engine, Rulesets & Validation Endpoints
# ==========================================

class RuleCreate(BaseModel):
    rule_key: str = Field(..., description="Unique stable key across versions e.g. R-LAND-AREA")
    version: Optional[int] = Field(default=1, description="Version number")
    title: str = Field(..., description="Short rule title")
    description: str = Field(..., description="Detailed description")
    rule_type: str = Field(..., description="required_document | required_field | format_regex | date_not_expired | numeric_threshold | cross_doc_match")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Rule evaluation parameters")
    application_type: Optional[str] = Field(default=None, description="Target application type if specific")
    severity: Optional[str] = Field(default="high", description="high | medium | low")
    enabled: Optional[bool] = Field(default=True)
    source_status: Optional[str] = Field(default="STATUTORY_NORM")
    official_source_name: Optional[str] = Field(default="AICTE Approval Process Handbook (APH) 2024-2027")
    official_source_url: Optional[str] = None
    clause_reference: Optional[str] = Field(default=None)
    page_reference: Optional[str] = None
    verification_status: Optional[str] = Field(default="unverified")
    reviewer_name: Optional[str] = Field(default="compliance-officer")
    review_notes: Optional[str] = Field(default="Statutory compliance rule specification")


class RuleSourceCreate(BaseModel):
    official_source_name: Optional[str] = "AICTE Approval Process Handbook (APH) 2024-2027"
    official_source_url: Optional[str] = None
    clause_reference: Optional[str] = None
    page_reference: Optional[str] = None
    application_type: Optional[str] = None
    effective_date: Optional[str] = None
    verification_status: Optional[str] = "unverified"
    reviewer_name: Optional[str] = "compliance-officer"
    review_notes: Optional[str] = "Statutory regulatory source citation"


class RulesetCreate(BaseModel):
    name: str = Field(..., description="Ruleset label or name")
    version: Optional[int] = Field(default=1)
    status: Optional[str] = Field(default="draft", description="draft | active | retired")
    rule_ids: List[str] = Field(default_factory=list, description="List of rule IDs included in ruleset")


class ValidateApplicationRequest(BaseModel):
    ruleset_id: Optional[str] = Field(default=None, description="Optional ruleset ID. Defaults to active ruleset.")
    actor: Optional[str] = Field(default="local-reviewer")


class FindingDecisionCreate(BaseModel):
    decision: Optional[str] = None
    action: Optional[str] = None
    reason: Optional[str] = None
    reviewerNotes: Optional[str] = None
    notes: Optional[str] = None
    actor: Optional[str] = "local-reviewer"


def format_finding_row(row: Any) -> Dict[str, Any]:
    evidence = {}
    if row["evidence_json"]:
        try:
            evidence = json.loads(row["evidence_json"])
        except Exception:
            evidence = {}
    keys = row.keys() if hasattr(row, "keys") else []

    decision_info = None
    if "decision_id" in keys and row["decision_id"]:
        decision_info = {
            "id": row["decision_id"],
            "decision": row["decision_type"],
            "reason": row["decision_reason"],
            "actor": row["decision_actor"],
            "created_at": row["decision_created_at"],
        }

    return {
        "id": row["id"],
        "validation_run_id": row["validation_run_id"],
        "application_id": row["application_id"] if "application_id" in keys else None,
        "institution_name": row["institution_name"] if "institution_name" in keys else None,
        "rule_id": row["rule_id"],
        "rule_key": row["rule_key"] if "rule_key" in keys else evidence.get("rule_key"),
        "rule_title": row["title"] if "title" in keys else None,
        "rule_type": row["rule_type"] if "rule_type" in keys else None,
        "source_status": row["source_status"] if "source_status" in keys else "STATUTORY_NORM",
        "official_source_name": row["official_source_name"] if "official_source_name" in keys else None,
        "official_source_url": row["official_source_url"] if "official_source_url" in keys else None,
        "clause_reference": row["clause_reference"] if "clause_reference" in keys else None,
        "page_reference": row["page_reference"] if "page_reference" in keys else None,
        "source_verification_status": row["source_verification_status"] if "source_verification_status" in keys else None,
        "code": row["code"],
        "severity": row["severity"],
        "status": row["status"],
        "outcome": "Compliant" if row["status"] == "pass" else ("Non-Compliant" if row["status"] == "fail" else ("Not Applicable" if row["status"] == "not_applicable" else "Needs Review")),
        "compliance_status": "Compliant" if row["status"] == "pass" else ("Non-Compliant" if row["status"] == "fail" else ("Not Applicable" if row["status"] == "not_applicable" else "Needs Review")),
        "message": row["message"],
        "recommendation": row["recommendation"],
        "evidence": evidence,
        "evidence_json": row["evidence_json"],
        "fingerprint": evidence.get("fingerprint"),
        "subject": evidence.get("subject"),
        "created_at": row["created_at"],
        "decision": decision_info,
    }


# --- Rules Endpoints ---

@app.post("/api/rules", status_code=status.HTTP_201_CREATED)
def create_rule(payload: RuleCreate, _reviewer=Depends(verify_reviewer_permission)):
    rule_id = f"RULE-{uuid.uuid4().hex[:12].upper()}"
    source_id = f"SRC-{uuid.uuid4().hex[:12].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    params_json = json.dumps(payload.parameters)

    with get_connection() as conn:
        try:
            conn.execute(
                """
                INSERT INTO rules (
                    id, rule_key, version, title, description, rule_type,
                    parameters_json, application_type, enabled, source_status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    rule_id,
                    payload.rule_key,
                    payload.version or 1,
                    payload.title,
                    payload.description,
                    payload.rule_type,
                    params_json,
                    payload.application_type,
                    1 if payload.enabled else 0,
                    payload.source_status or "STATUTORY_NORM",
                    now,
                ),
            )
        except Exception as exc:
            if "UNIQUE constraint failed" in str(exc):
                raise HTTPException(status_code=400, detail=f"Rule with key '{payload.rule_key}' and version {payload.version} already exists")
            raise

        conn.execute(
            """
            INSERT INTO rule_sources (
                id, rule_id, official_source_name, official_source_url, clause_reference,
                page_reference, application_type, effective_date, verification_status,
                reviewer_name, reviewed_at, review_notes, test_cases_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source_id,
                rule_id,
                payload.official_source_name,
                payload.official_source_url,
                payload.clause_reference,
                payload.page_reference,
                payload.application_type,
                None,
                payload.verification_status or "unverified",
                payload.reviewer_name,
                now,
                payload.review_notes or "Statutory regulatory source specification",
                "[]",
                now,
            ),
        )

        add_audit_entry(
            conn=conn,
            event_type="RULE_CREATED",
            entity_type="rule",
            entity_id=rule_id,
            event_data={
                "rule_key": payload.rule_key,
                "version": payload.version or 1,
                "rule_type": payload.rule_type,
                "source_status": payload.source_status or "STATUTORY_NORM",
            },
            actor=payload.reviewer_name or "compliance-officer",
        )

    return {
        "id": rule_id,
        "rule_key": payload.rule_key,
        "version": payload.version or 1,
        "title": payload.title,
        "description": payload.description,
        "rule_type": payload.rule_type,
        "parameters": payload.parameters,
        "application_type": payload.application_type,
        "enabled": bool(payload.enabled),
        "source_status": payload.source_status or "STATUTORY_NORM",
        "created_at": now,
    }


@app.get("/api/rules")
def list_rules(
    rule_type: Optional[str] = Query(default=None),
    application_type: Optional[str] = Query(default=None),
    source_status: Optional[str] = Query(default=None),
    enabled: Optional[bool] = Query(default=None),
):
    with get_connection() as conn:
        query = "SELECT * FROM rules WHERE 1=1"
        params = []
        if rule_type:
            query += " AND rule_type = ?"
            params.append(rule_type)
        if application_type:
            query += " AND application_type = ?"
            params.append(application_type)
        if source_status:
            query += " AND source_status = ?"
            params.append(source_status)
        if enabled is not None:
            query += " AND enabled = ?"
            params.append(1 if enabled else 0)

        query += " ORDER BY rule_key ASC, version DESC"
        rows = conn.execute(query, params).fetchall()

        results = []
        for r in rows:
            rd = dict(r)
            try:
                rd["parameters"] = json.loads(rd["parameters_json"])
            except Exception:
                rd["parameters"] = {}
            rd["enabled"] = bool(rd["enabled"])
            results.append(rd)
    return results


@app.get("/api/rules/{rule_id}")
def get_rule(rule_id: str):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM rules WHERE id = ?", (rule_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Rule not found")
        rd = dict(row)
        try:
            rd["parameters"] = json.loads(rd["parameters_json"])
        except Exception:
            rd["parameters"] = {}
        rd["enabled"] = bool(rd["enabled"])

        sources = conn.execute("SELECT * FROM rule_sources WHERE rule_id = ?", (rule_id,)).fetchall()
        rd["sources"] = [dict(s) for s in sources]
    return rd


@app.post("/api/rules/{rule_id}/sources", status_code=status.HTTP_201_CREATED)
def add_rule_source(rule_id: str, payload: RuleSourceCreate, _reviewer=Depends(verify_reviewer_permission)):
    with get_connection() as conn:
        rule_row = conn.execute("SELECT 1 FROM rules WHERE id = ?", (rule_id,)).fetchone()
        if not rule_row:
            raise HTTPException(status_code=404, detail="Rule not found")

        source_id = f"SRC-{uuid.uuid4().hex[:12].upper()}"
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO rule_sources (
                id, rule_id, official_source_name, official_source_url, clause_reference,
                page_reference, application_type, effective_date, verification_status,
                reviewer_name, reviewed_at, review_notes, test_cases_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source_id,
                rule_id,
                payload.official_source_name,
                payload.official_source_url,
                payload.clause_reference,
                payload.page_reference,
                payload.application_type,
                payload.effective_date,
                payload.verification_status,
                payload.reviewer_name,
                now,
                payload.review_notes,
                "[]",
                now,
            ),
        )
    return {"id": source_id, "rule_id": rule_id, "status": "created"}


# --- Rule Source Register Endpoint ---

@app.get("/api/rule-sources")
def list_rule_sources(
    verification_status: Optional[str] = Query(default=None),
    application_type: Optional[str] = Query(default=None),
    rule_id: Optional[str] = Query(default=None),
):
    with get_connection() as conn:
        query = """
            SELECT rs.*, r.rule_key, r.title AS rule_title, r.rule_type, r.source_status
            FROM rule_sources rs
            JOIN rules r ON rs.rule_id = r.id
            WHERE 1=1
        """
        params = []
        if verification_status:
            query += " AND rs.verification_status = ?"
            params.append(verification_status)
        if application_type:
            query += " AND (rs.application_type = ? OR r.application_type = ?)"
            params.extend([application_type, application_type])
        if rule_id:
            query += " AND rs.rule_id = ?"
            params.append(rule_id)

        query += " ORDER BY rs.created_at DESC"
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


# --- Ruleset Endpoints ---

@app.post("/api/rulesets", status_code=status.HTTP_201_CREATED)
def create_ruleset(payload: RulesetCreate):
    ruleset_id = f"RSET-{uuid.uuid4().hex[:12].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    status_val = payload.status or "draft"

    with get_connection() as conn:
        try:
            conn.execute(
                """
                INSERT INTO rulesets (id, name, version, status, created_at, activated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (ruleset_id, payload.name, payload.version or 1, status_val, now, now if status_val == "active" else None),
            )
        except Exception as exc:
            if "UNIQUE constraint failed" in str(exc):
                raise HTTPException(status_code=400, detail=f"Ruleset '{payload.name}' version {payload.version} already exists")
            raise

        for rid in payload.rule_ids:
            conn.execute(
                "INSERT OR IGNORE INTO ruleset_rules (ruleset_id, rule_id) VALUES (?, ?)",
                (ruleset_id, rid),
            )

        add_audit_entry(
            conn=conn,
            event_type="RULESET_CREATED",
            entity_type="ruleset",
            entity_id=ruleset_id,
            event_data={"name": payload.name, "version": payload.version or 1, "rule_count": len(payload.rule_ids)},
            actor="compliance-officer",
        )

    return {
        "id": ruleset_id,
        "name": payload.name,
        "version": payload.version or 1,
        "status": status_val,
        "rule_count": len(payload.rule_ids),
        "rule_ids": payload.rule_ids,
        "created_at": now,
    }


@app.get("/api/rulesets")
def list_rulesets():
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT rs.*, COUNT(rr.rule_id) AS rule_count
            FROM rulesets rs
            LEFT JOIN ruleset_rules rr ON rs.id = rr.ruleset_id
            GROUP BY rs.id
            ORDER BY rs.version DESC, rs.created_at DESC
            """
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/rulesets/active")
def get_active_ruleset():
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM rulesets WHERE status = 'active' ORDER BY version DESC LIMIT 1"
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="No active ruleset found")
        rd = dict(row)

        rule_rows = conn.execute(
            """
            SELECT r.* FROM rules r
            JOIN ruleset_rules rr ON r.id = rr.rule_id
            WHERE rr.ruleset_id = ?
            ORDER BY r.rule_key ASC
            """,
            (row["id"],),
        ).fetchall()

        rules = []
        for r in rule_rows:
            item = dict(r)
            try:
                item["parameters"] = json.loads(item["parameters_json"])
            except Exception:
                item["parameters"] = {}
            rules.append(item)
        rd["rules"] = rules
        rd["rule_count"] = len(rules)
    return rd


@app.get("/api/rulesets/{ruleset_id}")
def get_ruleset(ruleset_id: str):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM rulesets WHERE id = ?", (ruleset_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Ruleset not found")
        rd = dict(row)

        rule_rows = conn.execute(
            """
            SELECT r.* FROM rules r
            JOIN ruleset_rules rr ON r.id = rr.rule_id
            WHERE rr.ruleset_id = ?
            ORDER BY r.rule_key ASC
            """,
            (ruleset_id,),
        ).fetchall()

        rules = []
        for r in rule_rows:
            item = dict(r)
            try:
                item["parameters"] = json.loads(item["parameters_json"])
            except Exception:
                item["parameters"] = {}
            rules.append(item)
        rd["rules"] = rules
        rd["rule_count"] = len(rules)
    return rd


@app.post("/api/rulesets/{ruleset_id}/activate")
def activate_ruleset(ruleset_id: str, _reviewer=Depends(verify_reviewer_permission)):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM rulesets WHERE id = ?", (ruleset_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Ruleset not found")

        now = datetime.now(timezone.utc).isoformat()
        # Retire previously active rulesets
        conn.execute("UPDATE rulesets SET status = 'retired' WHERE status = 'active'")
        conn.execute("UPDATE rulesets SET status = 'active', activated_at = ? WHERE id = ?", (now, ruleset_id))

        add_audit_entry(
            conn=conn,
            event_type="RULESET_ACTIVATED",
            entity_type="ruleset",
            entity_id=ruleset_id,
            event_data={"name": row["name"], "version": row["version"]},
            actor="compliance-officer",
        )

        updated = conn.execute("SELECT * FROM rulesets WHERE id = ?", (ruleset_id,)).fetchone()
    return dict(updated)


# --- Application Validation & Findings Endpoints ---

@app.post("/api/applications/{application_id}/validate")
def validate_application(
    application_id: str,
    payload: Optional[ValidateApplicationRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    req = payload or ValidateApplicationRequest()
    with get_connection() as conn:
        app_row = check_application_access(conn, application_id, current_user)

        if req.ruleset_id:
            ruleset = conn.execute("SELECT * FROM rulesets WHERE id = ?", (req.ruleset_id,)).fetchone()
            if not ruleset:
                raise HTTPException(status_code=404, detail="Ruleset not found")
        else:
            ruleset = conn.execute("SELECT * FROM rulesets WHERE status = 'active' ORDER BY version DESC LIMIT 1").fetchone()
            if not ruleset:
                raise HTTPException(status_code=400, detail="No active ruleset available for validation")

        ruleset_id = ruleset["id"]

        rule_rows = conn.execute(
            """
            SELECT r.* FROM rules r
            JOIN ruleset_rules rr ON r.id = rr.rule_id
            WHERE rr.ruleset_id = ? AND r.enabled = 1
            ORDER BY r.rule_key ASC, r.version DESC
            """,
            (ruleset_id,),
        ).fetchall()

        rules = []
        for r in rule_rows:
            r_dict = dict(r)
            try:
                r_dict["parameters"] = json.loads(r_dict["parameters_json"])
            except Exception:
                r_dict["parameters"] = {}
            rules.append(r_dict)

        doc_rows = conn.execute(
            "SELECT * FROM documents WHERE application_id = ? ORDER BY uploaded_at ASC",
            (application_id,),
        ).fetchall()
        documents = [dict(d) for d in doc_rows]

        field_rows = conn.execute(
            """
            SELECT ef.*, er.document_id, d.document_type
            FROM extracted_fields ef
            JOIN extraction_runs er ON ef.extraction_run_id = er.id
            JOIN documents d ON er.document_id = d.id
            WHERE d.application_id = ?
              AND er.id IN (
                  SELECT er2.id FROM extraction_runs er2
                  WHERE er2.document_id = d.id
                  ORDER BY er2.run_number DESC LIMIT 1
              )
            ORDER BY d.uploaded_at ASC, ef.page_number ASC, ef.id ASC
            """,
            (application_id,),
        ).fetchall()

        fields = []
        for f in field_rows:
            f_dict = dict(f)
            if f_dict["bbox_json"]:
                try:
                    f_dict["bbox"] = json.loads(f_dict["bbox_json"])
                except Exception:
                    f_dict["bbox"] = None
            fields.append(f_dict)

        ctx = {
            "application": dict(app_row),
            "documents": documents,
            "fields": fields,
        }

        eval_findings = evaluate_ruleset(dict(app_row), rules, ctx)

        now_start = datetime.now(timezone.utc).isoformat()
        run_id = f"VAL-{uuid.uuid4().hex[:12].upper()}"

        raw_fp = f"{application_id}|{ruleset_id}|{[d['id'] for d in documents]}|{[f['id'] for f in fields]}"
        input_fingerprint = hashlib.sha256(raw_fp.encode("utf-8")).hexdigest()

        summary = {
            "total_rules_evaluated": len(eval_findings),
            "pass": sum(1 for f in eval_findings if f["status"] == "pass"),
            "fail": sum(1 for f in eval_findings if f["status"] == "fail"),
            "unverified": sum(1 for f in eval_findings if f["status"] == "unverified"),
        }
        now_end = datetime.now(timezone.utc).isoformat()

        conn.execute(
            """
            INSERT INTO validation_runs (id, application_id, ruleset_id, status, input_fingerprint, started_at, completed_at, summary_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (run_id, application_id, ruleset_id, "completed", input_fingerprint, now_start, now_end, json.dumps(summary)),
        )

        persisted_findings = []
        for ef in eval_findings:
            f_id = f"FIND-{uuid.uuid4().hex[:12].upper()}"
            ev_json = json.dumps(ef["evidence"])
            conn.execute(
                """
                INSERT INTO findings (id, validation_run_id, rule_id, code, severity, status, message, evidence_json, recommendation, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f_id,
                    run_id,
                    ef["rule_id"],
                    ef["code"],
                    ef["severity"],
                    ef["status"],
                    ef["message"],
                    ev_json,
                    ef.get("recommendation"),
                    now_end,
                ),
            )
            ev_data = ef.get("evidence", {})
            rule_info = next((r for r in rules if r["id"] == ef["rule_id"]), {})
            persisted_findings.append({
                "id": f_id,
                "validation_run_id": run_id,
                "rule_id": ef["rule_id"],
                "rule_key": rule_info.get("rule_key") or ev_data.get("rule_key"),
                "rule_title": rule_info.get("title"),
                "rule_type": rule_info.get("rule_type"),
                "source_status": rule_info.get("source_status", "STATUTORY_NORM"),
                "code": ef["code"],
                "severity": ef["severity"],
                "status": ef["status"],
                "outcome": ef["status"],
                "message": ef["message"],
                "recommendation": ef.get("recommendation"),
                "evidence": ef["evidence"],
                "evidence_json": ev_json,
                "fingerprint": ev_data.get("fingerprint"),
                "subject": ev_data.get("subject"),
                "created_at": now_end,
                "decision": None,
            })

        # Determine actual application status based on evaluation outcome
        if summary.get("fail", 0) > 0:
            app_status = "discrepancy_detected"
        elif summary.get("unverified", 0) > 0:
            app_status = "under_review"
        elif summary.get("pass", 0) > 0:
            app_status = "verified"
        else:
            app_status = "draft"

        conn.execute(
            "UPDATE applications SET status = ?, updated_at = ? WHERE id = ?",
            (app_status, now_end, application_id),
        )

        add_audit_entry(
            conn=conn,
            event_type="VALIDATION_RUN_COMPLETED",
            entity_type="validation_run",
            entity_id=run_id,
            event_data={
                "application_id": application_id,
                "ruleset_id": ruleset_id,
                "summary": summary,
            },
            actor=req.actor or "local-reviewer",
        )

    return {
        "id": run_id,
        "application_id": application_id,
        "ruleset_id": ruleset_id,
        "ruleset_name": ruleset["name"],
        "status": "completed",
        "input_fingerprint": input_fingerprint,
        "started_at": now_start,
        "completed_at": now_end,
        "summary": summary,
        "findings": persisted_findings,
    }


@app.get("/api/applications/{application_id}/validation-runs")
def list_application_validation_runs(application_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        check_application_access(conn, application_id, current_user)

        rows = conn.execute(
            """
            SELECT vr.*, rs.name AS ruleset_name, rs.version AS ruleset_version
            FROM validation_runs vr
            LEFT JOIN rulesets rs ON vr.ruleset_id = rs.id
            WHERE vr.application_id = ?
            ORDER BY vr.started_at DESC
            """,
            (application_id,),
        ).fetchall()

        results = []
        for r in rows:
            rd = dict(r)
            try:
                rd["summary"] = json.loads(rd["summary_json"])
            except Exception:
                rd["summary"] = {}
            results.append(rd)
    return results


@app.get("/api/applications/{application_id}/findings")
def list_application_findings(
    application_id: str,
    run_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    with get_connection() as conn:
        check_application_access(conn, application_id, current_user)

        target_run_id = run_id
        if not target_run_id:
            latest_run = conn.execute(
                "SELECT id FROM validation_runs WHERE application_id = ? ORDER BY started_at DESC LIMIT 1",
                (application_id,),
            ).fetchone()
            if not latest_run:
                return []
            target_run_id = latest_run["id"]

        query = """
            SELECT f.*, ? AS application_id, r.rule_key, r.title, r.rule_type, r.source_status,
                   rs.official_source_name, rs.official_source_url, rs.clause_reference, rs.page_reference, rs.verification_status AS source_verification_status,
                   d.id AS decision_id, d.decision AS decision_type, d.reason AS decision_reason,
                   d.actor AS decision_actor, d.created_at AS decision_created_at
            FROM findings f
            JOIN rules r ON f.rule_id = r.id
            LEFT JOIN (
                SELECT * FROM rule_sources WHERE id IN (
                    SELECT MAX(id) FROM rule_sources GROUP BY rule_id
                )
            ) rs ON rs.rule_id = r.id
            LEFT JOIN (
                SELECT * FROM decisions WHERE id IN (
                    SELECT MAX(id) FROM decisions GROUP BY finding_id
                )
            ) d ON f.id = d.finding_id
            WHERE f.validation_run_id = ?
        """
        params = [application_id, target_run_id]

        if status:
            query += " AND f.status = ?"
            params.append(status)
        if severity:
            query += " AND f.severity = ?"
            params.append(severity)

        query += " ORDER BY CASE f.status WHEN 'fail' THEN 1 WHEN 'unverified' THEN 2 ELSE 3 END, f.created_at ASC"

        rows = conn.execute(query, params).fetchall()

    return [format_finding_row(r) for r in rows]


@app.get("/api/findings/{finding_id}")
def get_finding(finding_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        check_finding_access(conn, finding_id, current_user)
        row = conn.execute(
            """
            SELECT f.*, r.rule_key, r.title, r.rule_type, r.source_status,
                   rs.official_source_name, rs.official_source_url, rs.clause_reference, rs.page_reference, rs.verification_status AS source_verification_status,
                   d.id AS decision_id, d.decision AS decision_type, d.reason AS decision_reason,
                   d.actor AS decision_actor, d.created_at AS decision_created_at
            FROM findings f
            JOIN rules r ON f.rule_id = r.id
            LEFT JOIN (
                SELECT * FROM rule_sources WHERE id IN (
                    SELECT MAX(id) FROM rule_sources GROUP BY rule_id
                )
            ) rs ON rs.rule_id = r.id
            LEFT JOIN (
                SELECT * FROM decisions WHERE id IN (
                    SELECT MAX(id) FROM decisions GROUP BY finding_id
                )
            ) d ON f.id = d.finding_id
            WHERE f.id = ?
            """,
            (finding_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Finding not found")
    return format_finding_row(row)


@app.get("/api/findings")
def list_all_findings(
    application_id: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    limit: Optional[int] = Query(default=100),
    offset: int = Query(default=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    role = (current_user.get("role") or "").lower()
    user_id = current_user.get("user_id")
    inst_name = (current_user.get("institution_name") or "").strip()
    inst_id = current_user.get("institution_id")

    with get_connection() as conn:
        if application_id:
            check_application_access(conn, application_id, current_user)

        query = """
            SELECT f.*, vr.application_id, a.institution_name, r.rule_key, r.title, r.rule_type, r.source_status,
                   rs.official_source_name, rs.official_source_url, rs.clause_reference, rs.page_reference, rs.verification_status AS source_verification_status,
                   d.id AS decision_id, d.decision AS decision_type, d.reason AS decision_reason,
                   d.actor AS decision_actor, d.created_at AS decision_created_at
            FROM findings f
            JOIN rules r ON f.rule_id = r.id
            LEFT JOIN (
                SELECT * FROM rule_sources WHERE id IN (
                    SELECT MAX(id) FROM rule_sources GROUP BY rule_id
                )
            ) rs ON rs.rule_id = r.id
            JOIN validation_runs vr ON f.validation_run_id = vr.id
            LEFT JOIN applications a ON vr.application_id = a.id
            LEFT JOIN (
                SELECT * FROM decisions WHERE id IN (
                    SELECT MAX(id) FROM decisions GROUP BY finding_id
                )
            ) d ON f.id = d.finding_id
            WHERE 1=1
        """
        params = []
        if application_id:
            query += " AND vr.application_id = ?"
            params.append(application_id)
        elif role not in ("reviewer", "admin", "auditor"):
            query += " AND (a.user_id = ? OR (a.institution_id = ? AND ? IS NOT NULL) OR (LOWER(a.institution_name) = LOWER(?) AND ? != ''))"
            params.extend([user_id, inst_id, inst_id, inst_name, inst_name])

        if status and status != "All":
            query += " AND f.status = ?"
            params.append(status.lower())
        if severity and severity != "All":
            query += " AND f.severity = ?"
            params.append(severity.lower())
        query += " ORDER BY f.created_at DESC"
        if limit is not None:
            query += " LIMIT ? OFFSET ?"
            params.extend([limit, offset])
        rows = conn.execute(query, tuple(params)).fetchall()

    data = [format_finding_row(r) for r in rows]
    return {"data": data, "total": len(data)}


@app.get("/api/findings/{finding_id}/evidence")
def get_finding_evidence(finding_id: str):
    with get_connection() as conn:
        finding = conn.execute(
            """
            SELECT f.*, vr.application_id, r.rule_key, r.title, r.rule_type, r.description AS rule_desc, r.source_status,
                   rs.official_source_name, rs.official_source_url, rs.clause_reference, rs.page_reference, rs.verification_status AS source_verification_status,
                   d.decision AS reviewerDecision, d.reason AS reviewerNotes
            FROM findings f
            JOIN rules r ON f.rule_id = r.id
            LEFT JOIN (
                SELECT * FROM rule_sources WHERE id IN (
                    SELECT MAX(id) FROM rule_sources GROUP BY rule_id
                )
            ) rs ON rs.rule_id = r.id
            JOIN validation_runs vr ON f.validation_run_id = vr.id
            LEFT JOIN (
                SELECT * FROM decisions WHERE id IN (
                    SELECT MAX(id) FROM decisions GROUP BY finding_id
                )
            ) d ON f.id = d.finding_id
            WHERE f.id = ?
            """,
            (finding_id,),
        ).fetchone()
        if not finding:
            raise HTTPException(status_code=404, detail="Finding not found")

        formatted = format_finding_row(finding)
        ev = formatted.get("evidence", {})

        doc_rows = conn.execute(
            "SELECT * FROM documents WHERE application_id = ? ORDER BY uploaded_at ASC",
            (finding["application_id"],),
        ).fetchall()

        evidence_sources = []
        for idx, doc in enumerate(doc_rows[:2]):
            evidence_sources.append({
                "documentId": doc["id"],
                "documentType": doc["document_type"] or "Supporting Document",
                "documentName": doc["original_filename"],
                "pageNumber": 1,
                "extractedValue": str(ev.get("extracted_value") or ev.get("value") or "Verified Parameter"),
                "coordinates": {"x": 140, "y": 195, "width": 120, "height": 30},
            })

        reg_source = None
        if finding["official_source_name"]:
            reg_source = {
                "sourceName": finding["official_source_name"],
                "sourceUrl": finding["official_source_url"],
                "clauseReference": finding["clause_reference"],
                "pageReference": finding["page_reference"],
                "verificationStatus": finding["source_verification_status"],
            }

        return {
            "data": {
                "findingId": finding["id"],
                "applicationId": finding["application_id"],
                "ruleId": finding["rule_key"],
                "title": finding["title"],
                "explanation": finding["message"] or finding.get("explanation"),
                "recommendedAction": finding["recommendation"] or finding.get("recommended_action"),
                "evidenceSources": evidence_sources,
                "regulatorySource": reg_source,
                "status": finding["status"],
                "reviewerDecision": finding["reviewerDecision"],
                "reviewerNotes": finding["reviewerNotes"],
            }
        }


@app.post("/api/findings/{finding_id}/decision")
def record_finding_decision(finding_id: str, payload: FindingDecisionCreate, _reviewer=Depends(verify_reviewer_permission)):
    raw_dec = (payload.decision or payload.action or "").strip().lower()
    if "accept" in raw_dec or "resolve" in raw_dec:
        clean_dec = "resolved"
    elif "reject" in raw_dec or "false positive" in raw_dec or "dismiss" in raw_dec:
        clean_dec = "rejected"
    elif "clarif" in raw_dec or "escalat" in raw_dec:
        clean_dec = "escalated"
    else:
        clean_dec = raw_dec

    if clean_dec not in ("resolved", "rejected", "escalated"):
        raise HTTPException(status_code=422, detail="decision must be one of: 'resolved', 'rejected', 'escalated'")

    clean_reason = payload.reason or payload.reviewerNotes or payload.notes

    with get_connection() as conn:
        finding = conn.execute("SELECT * FROM findings WHERE id = ?", (finding_id,)).fetchone()
        if not finding:
            raise HTTPException(status_code=404, detail="Finding not found")

        dec_id = f"DEC-{uuid.uuid4().hex[:12].upper()}"
        now = datetime.now(timezone.utc).isoformat()
        actor_name = payload.actor or "local-reviewer"

        conn.execute(
            """
            INSERT INTO decisions (id, finding_id, decision, reason, actor, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (dec_id, finding_id, clean_dec, clean_reason, actor_name, now),
        )

        add_audit_entry(
            conn=conn,
            event_type="DECISION_RECORDED",
            entity_type="finding_decision",
            entity_id=dec_id,
            event_data={
                "finding_id": finding_id,
                "decision": clean_dec,
                "reason": clean_reason,
            },
            actor=actor_name,
        )

    return {
        "id": dec_id,
        "finding_id": finding_id,
        "decision": clean_dec,
        "reason": clean_reason,
        "actor": actor_name,
        "created_at": now,
        "status": "Resolved" if clean_dec == "resolved" else "Dismissed" if clean_dec == "rejected" else "Clarification Requested",
    }


@app.post("/api/findings/{finding_id}/reviews")
def record_finding_review(finding_id: str, payload: FindingDecisionCreate, _reviewer=Depends(verify_reviewer_permission)):
    return record_finding_decision(finding_id, payload, _reviewer)


# ==========================================
# Phase 4: Validation Replay, Evidence Passport, Viewer & Reports
# ==========================================

class ReplayRequest(BaseModel):
    to_ruleset_id: str = Field(..., description="Target ruleset ID to evaluate against")
    from_ruleset_id: Optional[str] = Field(default=None, description="Source ruleset ID (optional)")
    application_ids: Optional[List[str]] = Field(default=None, description="Optional application IDs to replay")
    actor: Optional[str] = Field(default="local-reviewer")


def parse_bbox_param(bbox_str: Optional[str]) -> Optional[Tuple[float, float, float, float]]:
    if not bbox_str:
        return None
    clean = bbox_str.strip()
    if clean.startswith("{"):
        try:
            d = json.loads(clean)
            return float(d["x0"]), float(d["y0"]), float(d["x1"]), float(d["y1"])
        except Exception:
            pass
    if clean.startswith("["):
        try:
            arr = json.loads(clean)
            return float(arr[0]), float(arr[1]), float(arr[2]), float(arr[3])
        except Exception:
            pass
    parts = clean.split(",")
    if len(parts) == 4:
        try:
            return float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3])
        except Exception:
            pass
    return None


def _validate_application_wrapper(application_id: str, ruleset_id: Optional[str] = None, actor: str = "local-reviewer") -> Dict[str, Any]:
    req = ValidateApplicationRequest(ruleset_id=ruleset_id, actor=actor)
    return validate_application(application_id, req, current_user={"role": "reviewer", "id": "USR-SYSTEM"})


# --- Document Page Evidence Viewer ---

@app.get("/api/documents/{document_id}/page/{page_spec}")
def get_document_page_image(
    document_id: str,
    page_spec: str,
    bbox: Optional[str] = Query(default=None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    clean_spec = page_spec.lower().replace(".png", "").replace(".jpg", "").replace(".jpeg", "")
    try:
        page_number = int(clean_spec)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid page number '{page_spec}'")

    if page_number < 1:
        raise HTTPException(status_code=400, detail="Page number must be >= 1")

    with get_connection() as conn:
        doc = check_document_access(conn, document_id, current_user)

        filename = Path(doc["stored_path"]).name
        file_path = DOCUMENTS_DIR / filename
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Physical document file not found")

        ext = file_path.suffix.lower()
        parsed_bbox = parse_bbox_param(bbox)

        if ext == ".pdf":
            try:
                pdf_doc = fitz.open(file_path)
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Corrupted or unreadable PDF: {exc}")

            try:
                if page_number > len(pdf_doc):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Page number {page_number} out of range (document has {len(pdf_doc)} pages)",
                    )
                page = pdf_doc[page_number - 1]
                if parsed_bbox:
                    x0, y0, x1, y1 = parsed_bbox
                    page.draw_rect(
                        fitz.Rect(x0, y0, x1, y1),
                        color=(0.9, 0.1, 0.1),
                        fill=(1.0, 0.9, 0.2),
                        fill_opacity=0.3,
                        width=2.0,
                    )
                pix = page.get_pixmap(dpi=150)
                img_bytes = pix.tobytes("png")
            finally:
                pdf_doc.close()

            return Response(content=img_bytes, media_type="image/png")
        else:
            if page_number > 1:
                raise HTTPException(status_code=400, detail="Image documents have only 1 page")
            try:
                img = Image.open(file_path).convert("RGB")
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Corrupted or unreadable image: {exc}")

            if parsed_bbox:
                draw = ImageDraw.Draw(img)
                x0, y0, x1, y1 = parsed_bbox
                draw.rectangle([x0, y0, x1, y1], outline=(230, 20, 20), width=3)

            buf = io.BytesIO()
            img.save(buf, format="PNG")
            return Response(content=buf.getvalue(), media_type="image/png")


# --- Evidence Passport Endpoint ---

@app.get("/api/applications/{application_id}/passport")
def get_evidence_passport(application_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        app_row = check_application_access(conn, application_id, current_user)

        doc_rows = conn.execute(
            "SELECT * FROM documents WHERE application_id = ? ORDER BY uploaded_at ASC",
            (application_id,),
        ).fetchall()
        documents = []
        for d in doc_rows:
            d_dict = dict(d)
            d_dict["stored_path"] = f"documents/{Path(d_dict['stored_path']).name}"
            documents.append(d_dict)

        field_rows = conn.execute(
            """
            SELECT ef.*, er.document_id, d.document_type
            FROM extracted_fields ef
            JOIN extraction_runs er ON ef.extraction_run_id = er.id
            JOIN documents d ON er.document_id = d.id
            WHERE d.application_id = ?
              AND er.id IN (
                  SELECT er2.id FROM extraction_runs er2
                  WHERE er2.document_id = d.id
                  ORDER BY er2.run_number DESC LIMIT 1
              )
            ORDER BY d.uploaded_at ASC, ef.page_number ASC, ef.id ASC
            """,
            (application_id,),
        ).fetchall()
        fields = [format_field_row(f) for f in field_rows]

        val_rows = conn.execute(
            """
            SELECT vr.*, rs.name AS ruleset_name, rs.version AS ruleset_version
            FROM validation_runs vr
            LEFT JOIN rulesets rs ON vr.ruleset_id = rs.id
            WHERE vr.application_id = ?
            ORDER BY vr.started_at DESC
            """,
            (application_id,),
        ).fetchall()
        validation_runs = []
        for v in val_rows:
            vd = dict(v)
            try:
                vd["summary"] = json.loads(vd["summary_json"])
            except Exception:
                vd["summary"] = {}
            validation_runs.append(vd)

        findings = []
        if validation_runs:
            latest_run_id = validation_runs[0]["id"]
            findings_rows = conn.execute(
                """
                SELECT f.*, r.rule_key, r.title, r.rule_type, r.source_status,
                       d.id AS decision_id, d.decision AS decision_type, d.reason AS decision_reason,
                       d.actor AS decision_actor, d.created_at AS decision_created_at
                FROM findings f
                JOIN rules r ON f.rule_id = r.id
                LEFT JOIN (
                    SELECT * FROM decisions WHERE id IN (
                        SELECT MAX(id) FROM decisions GROUP BY finding_id
                    )
                ) d ON f.id = d.finding_id
                WHERE f.validation_run_id = ?
                ORDER BY CASE f.status WHEN 'fail' THEN 1 WHEN 'unverified' THEN 2 ELSE 3 END, f.created_at ASC
                """,
                (latest_run_id,),
            ).fetchall()
            findings = [format_finding_row(fr) for fr in findings_rows]

        dec_rows = conn.execute(
            """
            SELECT d.*, f.code AS finding_code, f.validation_run_id
            FROM decisions d
            JOIN findings f ON d.finding_id = f.id
            JOIN validation_runs vr ON f.validation_run_id = vr.id
            WHERE vr.application_id = ?
            ORDER BY d.created_at DESC
            """,
            (application_id,),
        ).fetchall()
        decisions = [dict(dr) for dr in dec_rows]

        replay_rows = conn.execute(
            "SELECT * FROM replays WHERE application_id = ? ORDER BY created_at DESC",
            (application_id,),
        ).fetchall()
        replays = []
        for r in replay_rows:
            rd = dict(r)
            diff_rows = conn.execute(
                """
                SELECT rd.*, f.code AS finding_code, r.rule_key
                FROM replay_diffs rd
                JOIN findings f ON rd.finding_id = f.id
                JOIN rules r ON f.rule_id = r.id
                WHERE rd.replay_id = ?
                """,
                (r["id"],),
            ).fetchall()
            rd["diffs"] = [dict(df) for df in diff_rows]
            replays.append(rd)

        sig_rows = conn.execute(
            """
            SELECT s.*, d.original_filename, d.document_type
            FROM authenticity_signals s
            JOIN documents d ON s.document_id = d.id
            WHERE d.application_id = ?
            ORDER BY s.created_at ASC
            """,
            (application_id,),
        ).fetchall()
        authenticity_signals = []
        for s in sig_rows:
            sd = dict(s)
            try:
                sd["details"] = json.loads(sd["details_json"])
            except Exception:
                sd["details"] = {}
            authenticity_signals.append(sd)

        ver_rows = conn.execute(
            """
            SELECT mv.*, d.original_filename, d.document_type
            FROM manual_verifications mv
            JOIN documents d ON mv.document_id = d.id
            WHERE d.application_id = ?
            ORDER BY mv.created_at DESC
            """,
            (application_id,),
        ).fetchall()
        manual_verifications = [dict(v) for v in ver_rows]

        audit_res = verify_audit_chain(conn)

        verified_count = sum(1 for f in fields if f["confirmed"] or (f["confidence"] and f["confidence"] >= 0.8))
        unverified_count = sum(1 for f in fields if not f["confirmed"] and (f["confidence"] is None or f["confidence"] < 0.8))
        missing_evidence_count = sum(1 for f in findings if f["status"] == "unverified")

        return {
            "application": dict(app_row),
            "evidence_summary": {
                "total_documents_registered": len(documents),
                "total_fields_extracted": len(fields),
                "verified_fields": verified_count,
                "unverified_fields": unverified_count,
                "missing_evidence_count": missing_evidence_count,
                "audit_chain_verified": audit_res["verified"],
            },
            "documents": documents,
            "extracted_fields": fields,
            "validation_history": validation_runs,
            "current_findings": findings,
            "decisions": decisions,
            "replays": replays,
            "authenticity_signals": authenticity_signals,
            "manual_verifications": manual_verifications,
            "audit_verification": audit_res,
            "disclaimer": "Official AICTE Statutory Verification Dossier — Evidence and findings generated from cryptographic audit trail.",
        }


# --- Printable HTML Report Endpoint ---

@app.get("/api/applications/{application_id}/report")
def get_application_report(application_id: str, request: Request, format: Optional[str] = None, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        app_row = check_application_access(conn, application_id, current_user)

        doc_rows = conn.execute(
            "SELECT * FROM documents WHERE application_id = ? ORDER BY uploaded_at ASC",
            (application_id,),
        ).fetchall()
        documents = [dict(d) for d in doc_rows]

        field_rows = conn.execute(
            """
            SELECT ef.*, er.document_id, d.document_type
            FROM extracted_fields ef
            JOIN extraction_runs er ON ef.extraction_run_id = er.id
            JOIN documents d ON er.document_id = d.id
            WHERE d.application_id = ?
              AND er.id IN (
                  SELECT er2.id FROM extraction_runs er2
                  WHERE er2.document_id = d.id
                  ORDER BY er2.run_number DESC LIMIT 1
              )
            ORDER BY d.uploaded_at ASC, ef.page_number ASC, ef.id ASC
            """,
            (application_id,),
        ).fetchall()
        fields = [format_field_row(f) for f in field_rows]

        val_rows = conn.execute(
            """
            SELECT vr.*, rs.name AS ruleset_name, rs.version AS ruleset_version
            FROM validation_runs vr
            LEFT JOIN rulesets rs ON vr.ruleset_id = rs.id
            WHERE vr.application_id = ?
            ORDER BY vr.started_at DESC LIMIT 1
            """,
            (application_id,),
        ).fetchall()
        latest_run = dict(val_rows[0]) if val_rows else {}
        summary = {}
        if latest_run and latest_run.get("summary_json"):
            try:
                summary = json.loads(latest_run["summary_json"])
            except Exception:
                summary = {}

        findings = []
        if latest_run:
            findings_rows = conn.execute(
                """
                SELECT f.*, r.rule_key, r.title, r.rule_type, r.source_status,
                       d.id AS decision_id, d.decision AS decision_type, d.reason AS decision_reason,
                       d.actor AS decision_actor, d.created_at AS decision_created_at
                FROM findings f
                JOIN rules r ON f.rule_id = r.id
                LEFT JOIN (
                    SELECT * FROM decisions WHERE id IN (
                        SELECT MAX(id) FROM decisions GROUP BY finding_id
                    )
                ) d ON f.id = d.finding_id
                WHERE f.validation_run_id = ?
                ORDER BY CASE f.status WHEN 'fail' THEN 1 WHEN 'unverified' THEN 2 ELSE 3 END, f.created_at ASC
                """,
                (latest_run["id"],),
            ).fetchall()
            findings = [format_finding_row(fr) for fr in findings_rows]

        replay_rows = conn.execute(
            "SELECT * FROM replays WHERE application_id = ? ORDER BY created_at DESC",
            (application_id,),
        ).fetchall()
        replays = []
        for r in replay_rows:
            rd = dict(r)
            diff_rows = conn.execute(
                "SELECT * FROM replay_diffs WHERE replay_id = ?", (r["id"],)
            ).fetchall()
            rd["diffs"] = [dict(df) for df in diff_rows]
            replays.append(rd)

        audit_chain = verify_audit_chain(conn)
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        context = {
            "application": dict(app_row),
            "documents": documents,
            "fields": fields,
            "latest_run": latest_run,
            "summary": summary,
            "findings": findings,
            "replays": replays,
            "audit_chain": audit_chain,
            "generated_at": now,
        }

        if format == "json" or "application/json" in request.headers.get("accept", "").lower():
            app_dict = dict(app_row)
            return {
                "data": {
                    "reportId": f"REP-{application_id}",
                    "application": {
                        "id": app_dict["id"],
                        "institutionName": app_dict.get("institution_name") or app_dict.get("applicant_name") or "Institutional Applicant",
                        "institutionCode": app_dict["id"],
                        "applicationType": app_dict.get("application_type", "Technical Approval"),
                        "status": app_dict.get("status", "draft"),
                        "submittedAt": app_dict.get("created_at"),
                        "intakeCapacity": 90,
                    },
                    "documents": documents,
                    "extractedFields": fields,
                    "findings": findings,
                    "auditHistory": [
                        {
                            "id": f"AUD-{idx}",
                            "eventType": "STATUTORY_AUDIT_VERIFIED",
                            "actor": "ReguTrace Compliance Engine",
                            "timestamp": now,
                            "description": f"Audited cryptographic block integrity: valid={audit_chain.get('valid')}",
                        }
                        for idx in range(1)
                    ],
                    "generatedAt": now,
                    "generatedBy": "Dr. A. Sharma (Authorized Compliance Officer)",
                    "disclaimer": "Independent SIH prototype report generated via NIYANTRAN ReguTrace Engine. Not an official AICTE sanction order.",
                    "context": context,
                }
            }

        html = render_html_report(context)
        return Response(content=html, media_type="text/html")


# --- Validation Replay Endpoints ---

@app.post("/api/replays")
@app.post("/api/replay")
def run_batch_replay(payload: ReplayRequest):
    with get_connection() as conn:
        to_rs = conn.execute("SELECT * FROM rulesets WHERE id = ?", (payload.to_ruleset_id,)).fetchone()
        if not to_rs:
            raise HTTPException(status_code=404, detail="Target ruleset not found")

        if payload.application_ids:
            target_app_ids = payload.application_ids
        else:
            app_rows = conn.execute("SELECT DISTINCT application_id FROM validation_runs").fetchall()
            target_app_ids = [r["application_id"] for r in app_rows]

    results = []
    for app_id in target_app_ids:
        with get_connection() as conn:
            try:
                rep_res = execute_replay_for_application(
                    conn=conn,
                    application_id=app_id,
                    to_ruleset_id=payload.to_ruleset_id,
                    from_ruleset_id=payload.from_ruleset_id,
                    actor=payload.actor or "local-reviewer",
                    validate_func=_validate_application_wrapper,
                )
                results.append(rep_res)
            except Exception as exc:
                results.append({
                    "application_id": app_id,
                    "status": "failed",
                    "error": str(exc),
                })

    apps_with_changes = sum(1 for r in results if r.get("has_changes"))
    return {
        "to_ruleset_id": payload.to_ruleset_id,
        "from_ruleset_id": payload.from_ruleset_id,
        "applications_processed": len(results),
        "applications_with_changes": apps_with_changes,
        "applications_unchanged": len(results) - apps_with_changes,
        "replays": results,
    }


@app.post("/api/applications/{application_id}/replay")
def replay_single_application(application_id: str, payload: ReplayRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        check_application_access(conn, application_id, current_user)
        to_rs = conn.execute("SELECT 1 FROM rulesets WHERE id = ?", (payload.to_ruleset_id,)).fetchone()
        if not to_rs:
            raise HTTPException(status_code=404, detail="Target ruleset not found")

        try:
            return execute_replay_for_application(
                conn=conn,
                application_id=application_id,
                to_ruleset_id=payload.to_ruleset_id,
                from_ruleset_id=payload.from_ruleset_id,
                actor=payload.actor or "local-reviewer",
                validate_func=_validate_application_wrapper,
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Replay execution failed: {exc}")


@app.get("/api/replays/{replay_id}")
def get_replay(replay_id: str):
    with get_connection() as conn:
        replay_row = conn.execute("SELECT * FROM replays WHERE id = ?", (replay_id,)).fetchone()
        if not replay_row:
            raise HTTPException(status_code=404, detail="Replay not found")

        diff_rows = conn.execute(
            """
            SELECT rd.*, f.code AS finding_code, r.rule_key
            FROM replay_diffs rd
            JOIN findings f ON rd.finding_id = f.id
            JOIN rules r ON f.rule_id = r.id
            WHERE rd.replay_id = ?
            ORDER BY rd.id ASC
            """,
            (replay_id,),
        ).fetchall()

    res = dict(replay_row)
    res["diffs"] = [dict(d) for d in diff_rows]
    res["has_changes"] = any(d["diff_type"] != "unchanged" for d in res["diffs"])
    return res


@app.get("/api/applications/{application_id}/replays")
def list_application_replays(application_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        check_application_access(conn, application_id, current_user)

        replay_rows = conn.execute(
            "SELECT * FROM replays WHERE application_id = ? ORDER BY created_at DESC",
            (application_id,),
        ).fetchall()

        results = []
        for r in replay_rows:
            rd = dict(r)
            diff_rows = conn.execute("SELECT * FROM replay_diffs WHERE replay_id = ?", (r["id"],)).fetchall()
            rd["diff_count"] = len(diff_rows)
            rd["has_changes"] = any(d["diff_type"] != "unchanged" for d in diff_rows)
            results.append(rd)
    return results


# ==========================================
# Phase 5: Authenticity Signals & Manual Verification Endpoints
# ==========================================

class ManualVerificationCreate(BaseModel):
    verification_type: str = Field(..., description="e.g. physical_inspection, authority_inquiry, registry_check, compliance_review")
    result: str = Field(..., description="'pending', 'verified', or 'cannot_verify'")
    verifier: str = Field(..., min_length=1, description="Identifier of the reviewer/verifier")
    evidence_reference: Optional[str] = Field(default=None, description="Official reference number / deed number / dispatch number")
    notes: Optional[str] = Field(default=None, description="Detailed verification notes")

    @field_validator("result")
    @classmethod
    def validate_result(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in ("pending", "verified", "cannot_verify"):
            raise ValueError("result must be one of: 'pending', 'verified', 'cannot_verify'")
        return clean

    @field_validator("verification_type", "verifier")
    @classmethod
    def clean_strings(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Field cannot be blank")
        return clean


# --- Authenticity Signals Endpoints ---

@app.get("/api/documents/{document_id}/authenticity")
def get_document_authenticity(document_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        doc = check_document_access(conn, document_id, current_user)

        sig_rows = conn.execute(
            "SELECT * FROM authenticity_signals WHERE document_id = ? ORDER BY signal_type ASC",
            (document_id,),
        ).fetchall()

        if not sig_rows:
            signals = evaluate_document_authenticity(conn, document_id)
        else:
            signals = []
            for r in sig_rows:
                sd = dict(r)
                try:
                    sd["details"] = json.loads(sd["details_json"])
                except Exception:
                    sd["details"] = {}
                signals.append(sd)

    return {
        "document_id": document_id,
        "signals_count": len(signals),
        "signals": signals,
        "disclaimer": "Authenticity signals provide automated heuristic indicators only; no document is declared genuine or forged based on hashes or metadata alone. Full legal authenticity requires authorized issuing authority verification.",
    }


@app.post("/api/documents/{document_id}/authenticity/evaluate")
def evaluate_document_authenticity_endpoint(document_id: str):
    with get_connection() as conn:
        doc = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        signals = evaluate_document_authenticity(conn, document_id)

        add_audit_entry(
            conn=conn,
            event_type="AUTHENTICITY_EVALUATED",
            entity_type="document",
            entity_id=document_id,
            event_data={"signals_count": len(signals)},
            actor="compliance-officer",
        )

    return {
        "document_id": document_id,
        "signals_count": len(signals),
        "signals": signals,
        "disclaimer": "Authenticity signals provide automated heuristic indicators only; no document is declared genuine or forged based on hashes or metadata alone.",
    }


@app.get("/api/applications/{application_id}/authenticity")
def get_application_authenticity(application_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        check_application_access(conn, application_id, current_user)

        doc_rows = conn.execute(
            "SELECT id, original_filename, document_type, sha256 FROM documents WHERE application_id = ? ORDER BY uploaded_at ASC",
            (application_id,),
        ).fetchall()

        results = []
        for d in doc_rows:
            doc_id = d["id"]
            sig_rows = conn.execute(
                "SELECT * FROM authenticity_signals WHERE document_id = ? ORDER BY signal_type ASC",
                (doc_id,),
            ).fetchall()
            if not sig_rows:
                sigs = evaluate_document_authenticity(conn, doc_id)
            else:
                sigs = []
                for r in sig_rows:
                    sd = dict(r)
                    try:
                        sd["details"] = json.loads(sd["details_json"])
                    except Exception:
                        sd["details"] = {}
                    sigs.append(sd)

            results.append({
                "document_id": doc_id,
                "original_filename": d["original_filename"],
                "document_type": d["document_type"],
                "sha256": d["sha256"],
                "signals": sigs,
            })

    return {
        "application_id": application_id,
        "documents_evaluated": len(results),
        "documents": results,
        "disclaimer": "Authenticity signals provide automated heuristic indicators only; no document is declared genuine or forged based on hashes or metadata alone.",
    }


# --- Manual Verification Endpoints ---

@app.post("/api/documents/{document_id}/manual-verification", status_code=status.HTTP_201_CREATED)
def record_manual_verification(document_id: str, payload: ManualVerificationCreate, _reviewer=Depends(verify_reviewer_permission)):
    with get_connection() as conn:
        doc = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        ver_id = f"MVER-{uuid.uuid4().hex[:12].upper()}"
        now = datetime.now(timezone.utc).isoformat()

        conn.execute(
            """
            INSERT INTO manual_verifications (
                id, document_id, verification_type, result, verifier, evidence_reference, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ver_id,
                document_id,
                payload.verification_type,
                payload.result,
                payload.verifier,
                payload.evidence_reference,
                payload.notes,
                now,
            ),
        )

        add_audit_entry(
            conn=conn,
            event_type="MANUAL_VERIFICATION_RECORDED",
            entity_type="manual_verification",
            entity_id=ver_id,
            event_data={
                "document_id": document_id,
                "verification_type": payload.verification_type,
                "result": payload.result,
                "verifier": payload.verifier,
            },
            actor=payload.verifier,
        )

    return {
        "id": ver_id,
        "document_id": document_id,
        "verification_type": payload.verification_type,
        "result": payload.result,
        "verifier": payload.verifier,
        "evidence_reference": payload.evidence_reference,
        "notes": payload.notes,
        "created_at": now,
    }


@app.get("/api/documents/{document_id}/manual-verification")
def list_document_manual_verifications(document_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        check_document_access(conn, document_id, current_user)

        rows = conn.execute(
            "SELECT * FROM manual_verifications WHERE document_id = ? ORDER BY created_at DESC",
            (document_id,),
        ).fetchall()

    return [dict(r) for r in rows]


@app.get("/api/applications/{application_id}/manual-verifications")
def list_application_manual_verifications(application_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    with get_connection() as conn:
        check_application_access(conn, application_id, current_user)

        rows = conn.execute(
            """
            SELECT mv.*, d.original_filename, d.document_type
            FROM manual_verifications mv
            JOIN documents d ON mv.document_id = d.id
            WHERE d.application_id = ?
            ORDER BY mv.created_at DESC
            """,
            (application_id,),
        ).fetchall()

    return [dict(r) for r in rows]


# ==============================================================================
# PHASE 1: OFFICIAL REGULATORY SOURCES & KNOWLEDGE BASE ENDPOINTS
# ==============================================================================

class RegulatoryClauseReview(BaseModel):
    new_status: Optional[str] = Field(None, description="Status: unverified, reviewed, verified, rejected, clarification_needed")
    status: Optional[str] = None
    reviewer_name: Optional[str] = Field(None, description="Full name or ID of the compliance officer")
    reviewed_by: Optional[str] = None
    notes: Optional[str] = None

class RegulatorySourceSupersede(BaseModel):
    superseded_by_source_id: Optional[str] = Field(None, description="ID of newer superseding regulatory instrument")
    superseded_by_id: Optional[str] = None
    reviewer_name: Optional[str] = "Compliance Officer"
    notes: Optional[str] = None

class RegulatoryFetchRequest(BaseModel):
    url: str
    source_title: Optional[str] = None
    title: Optional[str] = None
    issuing_authority: str = "All India Council for Technical Education (AICTE)"
    document_category: Optional[str] = None
    category: Optional[str] = "Handbook"
    publication_date: Optional[str] = None
    effective_from: Optional[str] = None
    effective_date: Optional[str] = None
    effective_until: Optional[str] = None
    document_version: Optional[str] = None
    version: Optional[str] = None
    review_notes: Optional[str] = None

def serialize_regulatory_source(r: dict) -> dict:
    d = dict(r)
    d["title"] = d.get("source_title")
    d["category"] = d.get("document_category")
    d["version"] = d.get("document_version")
    d["effective_date"] = d.get("effective_from")
    d["sha256_hash"] = d.get("sha256")
    d["superseded_by_id"] = d.get("superseded_by_source_id")
    d["supersedes_id"] = d.get("supersedes_source_id")
    d["total_pages"] = d.get("page_count")
    d["retrieved_at"] = d.get("retrieval_timestamp")
    d["clause_count"] = d.get("clauses_count", 0)
    d["clauses_extracted"] = d.get("clauses_count", 0)
    d["ocr_required"] = d.get("processing_status") == "ocr_required"
    return d

@app.get("/api/regulatory/stats")
def get_regulatory_knowledge_stats():
    with get_connection() as conn:
        total_sources = conn.execute("SELECT COUNT(*) FROM regulatory_sources").fetchone()[0]
        total_clauses = conn.execute("SELECT COUNT(*) FROM regulatory_clauses").fetchone()[0]
        verified_clauses = conn.execute("SELECT COUNT(*) FROM regulatory_clauses WHERE verification_status = 'verified'").fetchone()[0]
        unverified_clauses = conn.execute("SELECT COUNT(*) FROM regulatory_clauses WHERE verification_status = 'unverified'").fetchone()[0]
        reviewed_clauses = conn.execute("SELECT COUNT(*) FROM regulatory_clauses WHERE verification_status = 'reviewed'").fetchone()[0]
        
        cat_rows = conn.execute("SELECT category, COUNT(*) as cnt FROM regulatory_clauses GROUP BY category").fetchall()
        categories = {r["category"]: r["cnt"] for r in cat_rows}
        
        status_rows = conn.execute("SELECT processing_status, COUNT(*) as cnt FROM regulatory_sources GROUP BY processing_status").fetchall()
        statuses = {r["processing_status"]: r["cnt"] for r in status_rows}

    return {
        "total_sources": total_sources,
        "total_clauses": total_clauses,
        "verified_clauses": verified_clauses,
        "unverified_clauses": unverified_clauses,
        "reviewed_clauses": reviewed_clauses,
        "categories": categories,
        "source_statuses": statuses,
    }

@app.get("/api/regulatory/sources")
def list_regulatory_sources(
    category: Optional[str] = None,
    status: Optional[str] = None,
    verification_status: Optional[str] = None,
    search: Optional[str] = None,
):
    with get_connection() as conn:
        query = """
            SELECT s.*, 
                   COUNT(c.id) as clauses_count
            FROM regulatory_sources s
            LEFT JOIN regulatory_clauses c ON s.id = c.source_id
            WHERE 1=1
        """
        params = []
        if category and category != "All":
            query += " AND s.document_category = ?"
            params.append(category)
        if status and status != "All":
            query += " AND s.processing_status = ?"
            params.append(status)
        if verification_status and verification_status != "All":
            query += " AND s.verification_status = ?"
            params.append(verification_status)
        if search:
            query += " AND (s.source_title LIKE ? OR s.document_version LIKE ? OR s.issuing_authority LIKE ?)"
            term = f"%{search.strip()}%"
            params.extend([term, term, term])

        query += " GROUP BY s.id ORDER BY s.publication_date DESC, s.created_at DESC"
        rows = conn.execute(query, params).fetchall()

    return {"data": [serialize_regulatory_source(r) for r in rows], "total": len(rows)}

@app.get("/api/regulatory/sources/{source_id}")
def get_regulatory_source_detail(source_id: str):
    with get_connection() as conn:
        source = conn.execute("SELECT * FROM regulatory_sources WHERE id = ?", (source_id,)).fetchone()
        if not source:
            raise HTTPException(status_code=404, detail="Regulatory source not found")
        
        clauses_rows = conn.execute(
            "SELECT * FROM regulatory_clauses WHERE source_id = ? ORDER BY page_number ASC, clause_number ASC",
            (source_id,)
        ).fetchall()
        clauses = [dict(c) for c in clauses_rows]
        
        # Check supersession names
        supersedes_title = None
        if source["supersedes_source_id"]:
            s_row = conn.execute("SELECT source_title, document_version FROM regulatory_sources WHERE id = ?", (source["supersedes_source_id"],)).fetchone()
            if s_row:
                supersedes_title = f"{s_row['source_title']} ({s_row['document_version']})"

        superseded_by_title = None
        if source["superseded_by_source_id"]:
            sb_row = conn.execute("SELECT source_title, document_version FROM regulatory_sources WHERE id = ?", (source["superseded_by_source_id"],)).fetchone()
            if sb_row:
                superseded_by_title = f"{sb_row['source_title']} ({sb_row['document_version']})"

        res = dict(source)
        res["clauses_count"] = len(clauses)
        res["clause_count"] = len(clauses)
        res["clauses"] = clauses
        res["supersedes_title"] = supersedes_title
        res["superseded_by_title"] = superseded_by_title
        res["superseded_by_id"] = source["superseded_by_source_id"]
    return serialize_regulatory_source(res)

@app.post("/api/regulatory/sources/upload")
async def upload_regulatory_source(
    file: UploadFile = File(...),
    source_title: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    issuing_authority: Optional[str] = Form(None),
    document_category: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    publication_date: Optional[str] = Form(None),
    effective_from: Optional[str] = Form(None),
    effective_date: Optional[str] = Form(None),
    effective_until: Optional[str] = Form(None),
    document_version: Optional[str] = Form(None),
    version: Optional[str] = Form(None),
    official_source_url: Optional[str] = Form(None),
    source_url: Optional[str] = Form(None),
    review_notes: Optional[str] = Form(None),
    actor: str = Form("regulatory-officer"),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type: only PDF documents are supported")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes)")

    resolved_title = (title or source_title or "").strip()
    if not resolved_title:
        resolved_title = Path(file.filename or "Regulatory Document").stem.replace("_", " ").title()

    resolved_category = (category or document_category or "Handbook").strip()
    resolved_version = (version or document_version or "v1.0").strip()
    resolved_effective = (effective_date or effective_from or "").strip() or None
    resolved_authority = (issuing_authority or "AICTE").strip()
    resolved_url = (source_url or official_source_url or "").strip() or None

    with get_connection() as conn:
        try:
            result = ingest_regulatory_pdf(
                conn=conn,
                file_bytes=content,
                original_filename=file.filename,
                source_title=resolved_title,
                issuing_authority=resolved_authority,
                document_category=resolved_category,
                publication_date=publication_date.strip() if publication_date else None,
                effective_from=resolved_effective,
                effective_until=effective_until.strip() if effective_until else None,
                document_version=resolved_version,
                official_source_url=resolved_url,
                review_notes=review_notes.strip() if review_notes else None,
                actor=actor,
            )
            return serialize_regulatory_source(result)
        except ValueError as ve:
            ve_str = str(ve)
            if "Duplicate document detected" in ve_str or "already been registered" in ve_str:
                raise HTTPException(status_code=409, detail=ve_str)
            raise HTTPException(status_code=400, detail=ve_str)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Ingestion pipeline failure: {str(exc)}")

@app.post("/api/regulatory/sources/fetch")
def fetch_regulatory_source_url(payload: RegulatoryFetchRequest):
    import urllib.request
    import urllib.error
    import ssl

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(
        payload.url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AICTE-Niyantran/1.0"}
    )

    try:
        with urllib.request.urlopen(req, context=ctx, timeout=12) as response:
            content_type = response.headers.get("Content-Type", "")
            if "pdf" not in content_type.lower() and not payload.url.lower().endswith(".pdf"):
                raise HTTPException(status_code=400, detail=f"Remote URL returned non-PDF content type: {content_type}")
            data = response.read()
    except urllib.error.HTTPError as he:
        raise HTTPException(
            status_code=502,
            detail=f"Official server returned HTTP Error {he.code}: {he.reason}. "
                   f"The issuing authority portal ({he.url}) may be under maintenance or blocking automated retrievals. "
                   f"Please use the safe manual upload (Manual File Import) button to ingest a downloaded PDF copy."
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to establish network connection to official source ({payload.url}): {str(exc)}. "
                   f"Please use the safe manual upload (Manual File Import) button to upload the document directly."
        )

    filename = payload.url.split("/")[-1].split("?")[0] or "official_instrument.pdf"
    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"

    resolved_title = (payload.title or payload.source_title or "").strip()
    if not resolved_title:
        resolved_title = filename.replace(".pdf", "").replace("_", " ").title()

    resolved_category = (payload.category or payload.document_category or "Handbook").strip()
    resolved_version = (payload.version or payload.document_version or "v1.0").strip()
    resolved_effective = (payload.effective_date or payload.effective_from or "").strip() or None
    resolved_authority = (payload.issuing_authority or "AICTE").strip()

    with get_connection() as conn:
        try:
            result = ingest_regulatory_pdf(
                conn=conn,
                file_bytes=data,
                original_filename=filename,
                source_title=resolved_title,
                issuing_authority=resolved_authority,
                document_category=resolved_category,
                publication_date=payload.publication_date,
                effective_from=resolved_effective,
                effective_until=payload.effective_until,
                document_version=resolved_version,
                official_source_url=payload.url,
                review_notes=payload.review_notes,
                actor="url-crawler",
            )
            return serialize_regulatory_source(result)
        except ValueError as ve:
            ve_str = str(ve)
            if "Duplicate document detected" in ve_str or "already been registered" in ve_str:
                raise HTTPException(status_code=409, detail=ve_str)
            raise HTTPException(status_code=400, detail=ve_str)

@app.get("/api/regulatory/sources/{source_id}/clauses")
def list_regulatory_source_clauses(
    source_id: str,
    category: Optional[str] = None,
    page: Optional[int] = None,
    verification_status: Optional[str] = None,
    search: Optional[str] = None,
):
    with get_connection() as conn:
        src = conn.execute("SELECT 1 FROM regulatory_sources WHERE id = ?", (source_id,)).fetchone()
        if not src:
            raise HTTPException(status_code=404, detail="Regulatory source not found")

        query = "SELECT * FROM regulatory_clauses WHERE source_id = ?"
        params = [source_id]

        if category and category != "All":
            query += " AND category = ?"
            params.append(category)
        if page:
            query += " AND page_number = ?"
            params.append(page)
        if verification_status and verification_status != "All":
            query += " AND verification_status = ?"
            params.append(verification_status)
        if search:
            query += " AND (verbatim_text LIKE ? OR clause_number LIKE ? OR heading LIKE ?)"
            term = f"%{search.strip()}%"
            params.extend([term, term, term])

        query += " ORDER BY page_number ASC, clause_number ASC"
        rows = conn.execute(query, params).fetchall()

    return {"data": [dict(r) for r in rows], "total": len(rows)}

@app.get("/api/regulatory/clauses")
def search_regulatory_knowledge_base(
    source_id: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
):
    with get_connection() as conn:
        query = """
            SELECT c.*, s.source_title, s.document_version, s.document_category, s.publication_date
            FROM regulatory_clauses c
            JOIN regulatory_sources s ON c.source_id = s.id
            WHERE 1=1
        """
        params = []
        if source_id:
            query += " AND c.source_id = ?"
            params.append(source_id)
        if category and category != "All":
            query += " AND c.category = ?"
            params.append(category)
        if status and status != "All":
            query += " AND c.verification_status = ?"
            params.append(status)
        if search:
            query += " AND (c.verbatim_text LIKE ? OR c.clause_number LIKE ? OR c.heading LIKE ?)"
            term = f"%{search.strip()}%"
            params.extend([term, term, term])

        query += " ORDER BY c.created_at DESC LIMIT ?"
        params.append(limit)
        rows = conn.execute(query, params).fetchall()

    return {"data": [dict(r) for r in rows], "total": len(rows)}

@app.post("/api/regulatory/clauses/{clause_id}/review")
def review_regulatory_clause(clause_id: str, payload: RegulatoryClauseReview, _reviewer=Depends(verify_reviewer_permission)):
    with get_connection() as conn:
        try:
            target_status = payload.new_status or payload.status or "reviewed"
            reviewer = payload.reviewer_name or payload.reviewed_by or "regulatory-officer"
            updated = update_clause_verification(
                conn=conn,
                clause_id=clause_id,
                new_status=target_status,
                reviewer_name=reviewer,
                notes=payload.notes,
                actor=reviewer,
            )
            updated["reviewed_by"] = updated.get("reviewer_name")
            return updated
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

@app.post("/api/regulatory/clauses/{clause_id}/activate")
def activate_clause_for_rules(clause_id: str, _reviewer=Depends(verify_reviewer_permission)):
    with get_connection() as conn:
        try:
            return activate_regulatory_clause(
                conn=conn,
                clause_id=clause_id,
                actor=_reviewer,
            )
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

@app.post("/api/regulatory/sources/{source_id}/supersede")
def supersede_regulatory_source(source_id: str, payload: RegulatorySourceSupersede, _reviewer=Depends(verify_reviewer_permission)):
    target_superseded_by = payload.superseded_by_source_id or payload.superseded_by_id
    if not target_superseded_by:
        raise HTTPException(status_code=400, detail="Missing superseded_by_source_id or superseded_by_id")
    with get_connection() as conn:
        try:
            res = set_source_superseded(
                conn=conn,
                old_source_id=source_id,
                new_source_id=target_superseded_by,
                reviewer_name=payload.reviewer_name or "Compliance Officer",
                notes=payload.notes,
                actor=payload.reviewer_name or "Compliance Officer",
            )
            return res
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

@app.get("/api/regulatory/audit")
def get_regulatory_audit():
    with get_connection() as conn:
        return audit_regulatory_clauses(conn)

@app.get("/api/regulatory/review-queue")
def get_review_queue(
    priority: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    source_id: Optional[str] = Query(default=None),
    audit_tag: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    with get_connection() as conn:
        return get_regulatory_review_queue(
            conn=conn,
            priority=priority,
            status=status,
            source_id=source_id,
            audit_tag=audit_tag,
            limit=limit,
            offset=offset,
        )

@app.post("/api/regulatory/clauses/{clause_id}/supersede")
def supersede_regulatory_clause(
    clause_id: str,
    payload: Dict[str, Any],
    _reviewer=Depends(verify_reviewer_permission),
):
    target_superseded_by = payload.get("superseded_by_clause_id") or payload.get("new_clause_id")
    if not target_superseded_by:
        raise HTTPException(status_code=400, detail="Missing superseded_by_clause_id or new_clause_id")
    with get_connection() as conn:
        try:
            return link_clause_supersession(
                conn=conn,
                old_clause_id=clause_id,
                new_clause_id=target_superseded_by,
                reviewer_name=payload.get("reviewer_name") or "Compliance Officer",
                notes=payload.get("notes"),
                actor=payload.get("actor") or "Compliance Officer",
            )
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

@app.get("/api/regulatory/sources/{source_id}/page/{page_number}/image")
def get_regulatory_source_page_image(source_id: str, page_number: int):
    if page_number < 1:
        raise HTTPException(status_code=404, detail="Page number must be >= 1")

    with get_connection() as conn:
        source = conn.execute("SELECT * FROM regulatory_sources WHERE id = ?", (source_id,)).fetchone()
        if not source:
            raise HTTPException(status_code=404, detail="Regulatory source not found")

        file_path = Path(source["stored_path"])
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Stored PDF file not found on disk")

        try:
            doc = fitz.open(str(file_path))
            total_pages = len(doc)
            if page_number > total_pages:
                doc.close()
                raise HTTPException(status_code=404, detail=f"Page {page_number} exceeds document page count ({total_pages})")
            page = doc[page_number - 1]
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")
            doc.close()
            return Response(content=img_bytes, media_type="image/png")
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to render PDF page image: {str(exc)}")





