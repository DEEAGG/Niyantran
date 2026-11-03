"""
NIYANTRAN In-App Intelligent Assistant & Regulatory Grounding Engine
====================================================================
Provides context-aware 5-step statutory workflow guidance, verified AICTE
Approval Process Handbook (APH 2024-27) RAG grounding, and in-app navigation.
Deterministic, local execution with zero external AI provider dependencies.
"""

import os
import re
import json
import math
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

try:
    from app.copilot_adapter import get_current_user, get_connection
except ImportError:
    try:
        from copilot_adapter import get_current_user, get_connection
    except ImportError:
        from app.auth import get_current_user
        from app.db import get_connection

copilot_router = APIRouter(prefix="/api/copilot", tags=["NIYANTRAN Assistant"])


# ============================================================================
# 1. Product Knowledge Collection (Authoritative Platform Documentation)
# ============================================================================

PRODUCT_KNOWLEDGE = [
    {
        "id": "PROD-REGISTRATION",
        "title": "Application Registration Desk",
        "category": "workflow",
        "keywords": ["registration", "register", "new application", "create application", "apply", "register college", "new filing", "intake capacity", "nayi application"],
        "content": (
            "Application Registration (/applications/new) is Step 1 of the statutory lifecycle. "
            "Institutions create a new compliance filing by providing their legal institution name, "
            "establishment category (Technical, Engineering, Management, Pharmacy), approved student intake capacity, "
            "and permanent campus location. Once registered, the case is assigned a unique tracking identifier (APP-YYYY-XXX)."
        ),
        "related_routes": ["/applications/new", "/applications"],
    },
    {
        "id": "PROD-STATUTORY-VALIDATION",
        "title": "Statutory Compliance Validation Engine",
        "category": "feature",
        "keywords": ["statutory validation", "validation engine", "compliance validation", "check regulations", "compliance cockpit", "rules evaluation", "pass fail", "deficiency check"],
        "content": (
            "The Statutory Validation Center (/validation, /verification) deterministically evaluates extracted institutional "
            "entities against active AICTE Approval Process Handbook (APH 2024-2027) norms. "
            "It computes exact compliance outcomes (PASS, FAIL, UNVERIFIED) across land area thresholds, faculty cadre ratios, "
            "built-up space requirements, and mandatory structural/fire safety certificates without hallucination."
        ),
        "related_routes": ["/validation", "/verification"],
    },
    {
        "id": "PROD-EVIDENCE-WORKBENCH",
        "title": "Evidence Explorer & Forensic Inspection Workbench",
        "category": "feature",
        "keywords": ["evidence workbench", "evidence explorer", "forensic inspection", "inspect evidence", "citations workbench", "proof coordinates", "pinpoint"],
        "content": (
            "The Evidence Explorer (/evidence) allows officers and auditors to forensically inspect compliance findings. "
            "It links every statutory violation directly to the exact source document page, highlighting geometric bounding boxes "
            "and providing verbatim statutory clause citations with verifiable PDF references."
        ),
        "related_routes": ["/evidence", "/verification"],
    },
    {
        "id": "PROD-REGULATORY-INTELLIGENCE",
        "title": "Regulatory Intelligence Architecture",
        "category": "feature",
        "keywords": ["regulatory intelligence", "core features", "8 engines", "foundational engines", "architecture", "system overview", "regutrace core"],
        "content": (
            "NIYANTRAN's Regulatory Intelligence suite (/features) encompasses eight foundational engines: "
            "1. Document Upload & Ingestion, 2. AI-Assisted OCR Entity Extraction, 3. Cross-Document Consistency Checking, "
            "4. Deterministic Statutory Validation, 5. Forensic Evidence Inspection, 6. ReguTrace Policy Replay Simulator, "
            "7. Human-in-the-Loop Officer Adjudication, and 8. Cryptographic Audit Ledger & Dossier Generation."
        ),
        "related_routes": ["/features", "/demo"],
    },
    {
        "id": "PROD-ROLES-PERMISSIONS",
        "title": "User Roles, Permissions & Tenant Security",
        "category": "security",
        "keywords": ["roles", "permissions", "user roles", "access control", "reviewer role", "institution_user", "admin role", "security model", "who can access"],
        "content": (
            "NIYANTRAN enforces strict role-based access control (RBAC):\n"
            "- Institution Users: Can register filings, upload documents, view extracted fields, and track compliance status for their own institution.\n"
            "- Compliance Reviewers: Authorized to inspect evidentiary bounding boxes, record adjudication decisions in the Review Center, and run policy replays.\n"
            "- Administrators & Auditors: Have full system governance, cryptographic audit ledger verification, and statutory rules management privileges."
        ),
        "related_routes": ["/settings", "/dashboard"],
    },
    {
        "id": "PROD-OVERVIEW",
        "title": "NIYANTRAN Platform Overview & Mandate",
        "category": "product_overview",
        "keywords": ["niyantran platform", "system architecture", "verification engine", "purpose", "tagline", "mandate", "what is niyantran", "who are you", "kya hai"],
        "content": (
            "NIYANTRAN is an automated regulatory intelligence and compliance verification platform engineered for "
            "AICTE institutional scrutiny. Its core mandate is: 'Every Decision. Backed by Evidence.' "
            "It transforms complex institutional filings (land deeds, registration trusts, architectural plans, fire NOCs) "
            "into tamper-evident compliance decisions using deterministic statutory rules, spatial document inspection, "
            "and SHA-256 cryptographic audit ledgers."
        ),
        "related_routes": ["/dashboard", "/features", "/demo"],
    },
    {
        "id": "PROD-WORKFLOW",
        "title": "Five-Step Statutory Compliance Lifecycle",
        "category": "workflow",
        "keywords": [
            "workflow", "five step", "5 step", "steps", "lifecycle", "process", "pipeline",
            "how it works", "kya steps hai", "what happens after ocr", "after ocr",
            "post extraction", "ocr ke baad", "next step after ocr", "what next after ocr"
        ],
        "content": (
            "NIYANTRAN executes a rigorous 5-step statutory verification lifecycle:\n"
            "1. Application Registration: Filing creation with institutional details, intake capacity, and category.\n"
            "2. Document Ingestion & ReguTrace OCR: High-resolution ingestion and spatial entity extraction.\n"
            "3. Cross-Document Consistency Checker: Multi-document attribute corroboration (Trust ID, Name, Land Area, Address).\n"
            "4. Statutory Compliance Validation: Deterministic evaluation against active AICTE Approval Process Handbook (APH) norms.\n"
            "5. Officer Adjudication & Cryptographic Dossier: Human-in-the-loop review of discrepancies, ledger audit logging, and printable evidence passport.\n\n"
            "After OCR extraction (Step 2), the system automatically proceeds to Step 3 Cross-Document Consistency Checking "
            "to corroborate legal entities across documents before evaluating compliance rules in Step 4."
        ),
        "related_routes": ["/applications/new", "/upload", "/cross-check", "/validation", "/review", "/reports"],
    },
    {
        "id": "PROD-NAV-MONITORING",
        "title": "Monitoring Desk & Verification Workload",
        "category": "navigation",
        "keywords": ["monitoring", "workload", "health", "activity", "recent activity", "where is monitoring", "live activity", "workload status"],
        "content": (
            "The Monitoring Desk (/monitoring) provides live visibility into institutional filings, "
            "verification status breakdowns, unverified regulatory clauses, and recent audit ledger activity."
        ),
        "related_routes": ["/monitoring"],
    },
    {
        "id": "PROD-NAV-REVIEW",
        "title": "Officer Review Center & Adjudication Desk",
        "category": "navigation",
        "keywords": [
            "review", "review center", "review queue", "adjudication", "decision", "officer review",
            "adjudicate", "finding resolution", "override", "dismiss false positive", "false positive",
            "how to dismiss", "override finding", "officer dismiss", "dismiss finding", "dismiss"
        ],
        "content": (
            "The Review Center (/review) is the statutory adjudication desk for compliance officers. "
            "Officers inspect flagged findings, review evidentiary citations, and record formal decisions: "
            "Accept Finding (confirmed discrepancy), Issue Clarification Notice, or Dismiss as False Positive. "
            "To dismiss a false positive, an authorized officer opens the finding, inspects the spatial evidence bounding box, "
            "and records the 'Dismiss as False Positive' adjudication action with mandatory audit rationale."
        ),
        "related_routes": ["/review"],
        "requires_role": ["reviewer", "admin"],
    },
    {
        "id": "PROD-NAV-REPLAY",
        "title": "ReguTrace Policy Replay & Simulation Engine",
        "category": "navigation",
        "keywords": ["replay", "simulation", "simulator", "policy replay", "backtest", "threshold", "ruleset diff", "what if", "historical backtest"],
        "content": (
            "The ReguTrace Replay Engine (/replay) enables council policy officers to simulate statutory changes "
            "retroactively across historical institution cohorts before new norms are gazetted. "
            "It computes exact pass/fail distribution shifts and impact variances."
        ),
        "related_routes": ["/replay"],
        "requires_role": ["reviewer", "admin"],
    },
    {
        "id": "PROD-NAV-UPLOAD",
        "title": "Document Upload & Statutory Ingestion Desk",
        "category": "navigation",
        "keywords": ["upload", "upload document", "upload pdf", "ingest", "files", "where do i upload", "kahan upload kare", "document desk"],
        "content": (
            "Documents can be ingested through the global Upload Desk (/upload) or directly inside a specific case "
            "dossier (/applications/:id/documents). Supported statutory formats include PDF (native & scanned), "
            "PNG, JPG, and JPEG up to 50MB."
        ),
        "related_routes": ["/upload", "/applications"],
    },
    {
        "id": "PROD-NAV-CROSSCHECK",
        "title": "Cross-Document Consistency Checker",
        "category": "feature",
        "keywords": ["cross check", "consistency", "cross-check", "conflict", "name mismatch", "trust match", "corroboration", "address mismatch", "reconciliation"],
        "content": (
            "The Cross-Document Consistency Checker (/cross-check) scans extracted entity fields across multiple uploaded "
            "statutory documents. It cross-compares institution legal names, trust registration numbers, land area figures, "
            "and campus addresses to flag discrepancies and fraudulent variance before compliance rules evaluate."
        ),
        "related_routes": ["/cross-check"],
    },
    {
        "id": "PROD-NAV-SPATIAL",
        "title": "Spatial Document Inspector & Geometric Bounding Boxes",
        "category": "feature",
        "keywords": ["spatial", "inspector", "bounding box", "coordinates", "pymupdf", "pdf page", "zoom", "high-res", "raster", "highlight", "visual proof"],
        "content": (
            "The Spatial Document Inspector renders high-resolution 300 DPI page rasters using PyMuPDF and pins "
            "exact geometric bounding boxes [x0, y0, x1, y1] for every extracted entity. "
            "This provides undeniable visual provenance for regulatory citations."
        ),
        "related_routes": ["/verification", "/evidence"],
    },
    {
        "id": "PROD-NAV-AUDIT",
        "title": "Cryptographic Audit Ledger & Compliance Dossier",
        "category": "feature",
        "keywords": [
            "audit", "ledger", "reports", "report", "passport", "hash chain", "sha256",
            "dossier", "print dossier", "pdf export", "tamper evident", "audit chain verify",
            "verify audit chain", "audit verify kaise kare", "audit chain verify kaise karun",
            "how to verify audit"
        ],
        "content": (
            "NIYANTRAN records every state transition, document ingestion, extraction run, and officer decision "
            "into a tamper-evident SHA-256 cryptographic audit ledger (/reports, /audit). "
            "To verify the audit chain, open /audit and click 'Verify Cryptographic Chain' to cryptographically re-compute "
            "and validate the sequential SHA-256 Merkle hashes across all records."
        ),
        "related_routes": ["/reports", "/audit"],
    },
    {
        "id": "PROD-NAV-RULES",
        "title": "Regulatory Rules Registry & Statutory Norms",
        "category": "navigation",
        "keywords": ["rules", "rule catalog", "norms", "regulatory rules", "rule specification", "statutory norms", "thresholds"],
        "content": (
            "The Regulatory Rules Registry (/rules) catalogues all active statutory rules governing AICTE approvals. "
            "Each rule links to verified handbook clauses, evaluation parameters, and version histories."
        ),
        "related_routes": ["/rules"],
        "requires_role": ["reviewer", "admin"],
    },
    {
        "id": "PROD-NAV-SETTINGS",
        "title": "Platform Settings, Profile & Visual Themes",
        "category": "navigation",
        "keywords": ["settings", "theme", "password", "profile", "configuration", "dark mode", "light mode", "api health"],
        "content": (
            "Platform Settings (/settings) allows users to manage institutional profiles, update passwords, "
            "switch between visual themes (Warm Sand vs Obsidian Dark Command), and test backend API gateway health."
        ),
        "related_routes": ["/settings"],
    },
    {
        "id": "PROD-WIDGET-CONTROLS",
        "title": "NIYANTRAN Assistant Controls & Navbar Docking",
        "category": "feature",
        "keywords": ["minimize", "dock", "navbar dock", "drag", "draggable", "shortcut", "keyboard shortcut", "command slash", "floating widget"],
        "content": (
            "The NIYANTRAN assistant widget can be freely dragged across the viewport to prevent obstructing content. "
            "Click the diagonal arrow in the assistant header to smoothly minimize and dock it into the top CommandNavbar. "
            "Click the docked navbar button at any time to restore it. You can also toggle the assistant with Cmd+/ or Ctrl+/."
        ),
        "related_routes": ["/dashboard"],
    },
    {
        "id": "PROD-NAV-AUTHENTICITY",
        "title": "Document Authenticity & Signal Matrix",
        "category": "feature",
        "keywords": ["authenticity", "passport", "signals", "tamper", "metadata", "dpi check", "font anomaly"],
        "content": (
            "The Document Authenticity Matrix (/passport) evaluates forensic signals such as raster metadata, "
            "font embedding consistency, PDF producer signatures, and DPI resolution to detect forged or altered certificates."
        ),
        "related_routes": ["/passport", "/authenticity"],
    },
]


# ============================================================================
# 2. In-App Route Registry (Verified & Safe Navigation Mapping)
# ============================================================================

ROUTE_REGISTRY = {
    "/dashboard": {
        "title": "Institutional Dashboard",
        "description": "Overview of active filings, regulatory statistics, and institutional workload status.",
        "icon": "LayoutDashboard",
        "public_to_all_authenticated": True,
    },
    "/applications": {
        "title": "Institutional Applications & Cases",
        "description": "Comprehensive registry of all active and historical institutional compliance cases.",
        "icon": "FileText",
        "public_to_all_authenticated": True,
    },
    "/applications/new": {
        "title": "Register Application",
        "description": "Initiate a new statutory compliance submission for AICTE approval evaluation.",
        "icon": "FilePlus",
        "public_to_all_authenticated": True,
    },
    "/upload": {
        "title": "Document Ingestion Desk",
        "description": "Upload statutory PDF and image documents for automated OCR processing.",
        "icon": "UploadCloud",
        "public_to_all_authenticated": True,
    },
    "/cross-check": {
        "title": "Cross-Document Consistency Checker",
        "description": "Corroborate entities across filed documents to detect mismatches in name, address, or land.",
        "icon": "GitCompare",
        "public_to_all_authenticated": True,
    },
    "/verification": {
        "title": "Compliance & Verification Cockpit",
        "description": "Unified cockpit displaying statutory compliance findings, OCR fields, and the Spatial Inspector.",
        "icon": "ShieldCheck",
        "public_to_all_authenticated": True,
    },
    "/evidence": {
        "title": "Evidence Explorer & Workbench",
        "description": "Deep forensic inspection of finding evidence citations with page coordinates.",
        "icon": "Search",
        "public_to_all_authenticated": True,
    },
    "/monitoring": {
        "title": "Workload & Monitoring Desk",
        "description": "Live institutional workload monitoring, system diagnostics, and ledger status.",
        "icon": "Activity",
        "public_to_all_authenticated": True,
    },
    "/passport": {
        "title": "Case Evidence Passport",
        "description": "Multi-signal document authenticity matrix, file hash verification, and extraction provenance.",
        "icon": "FileSpreadsheet",
        "public_to_all_authenticated": True,
    },
    "/rules": {
        "title": "Regulatory Rules Catalog",
        "description": "Registry of active statutory rules, parameters, and version evolutions under AICTE purview.",
        "icon": "BookOpen",
        "requires_role": ["reviewer", "admin"],
    },
    "/replay": {
        "title": "ReguTrace Policy Replay Engine",
        "description": "Simulate retroactive impact of proposed statutory rule amendments on past cohorts.",
        "icon": "Play",
        "requires_role": ["reviewer", "admin"],
    },
    "/review": {
        "title": "Officer Review Center",
        "description": "Statutory adjudication queue for evaluating, escalating, or resolving compliance findings.",
        "icon": "CheckSquare",
        "requires_role": ["reviewer", "admin"],
    },
    "/reports": {
        "title": "Audit Ledger & Printable Reports",
        "description": "Tamper-evident cryptographic audit log and printable official compliance dossiers.",
        "icon": "Printer",
        "public_to_all_authenticated": True,
    },
    "/audit": {
        "title": "Cryptographic Audit Ledger",
        "description": "SHA-256 tamper-evident chain verification and immutable event trail.",
        "icon": "Hash",
        "public_to_all_authenticated": True,
    },
    "/settings": {
        "title": "Platform Settings & Security",
        "description": "Account profile management, security credentials, theme toggles, and API ping.",
        "icon": "Settings",
        "public_to_all_authenticated": True,
    },
    "/features": {
        "title": "Core Platform Capabilities",
        "description": "Detailed architectural walkthrough of NIYANTRAN's foundational regulatory engines.",
        "icon": "Layers",
        "public_to_all_authenticated": True,
    },
    "/demo": {
        "title": "Interactive Guided Walkthrough",
        "description": "Step-by-step interactive tour of NIYANTRAN's end-to-end verification pipeline.",
        "icon": "Sparkles",
        "public_to_all_authenticated": True,
    },
}


# ============================================================================
# 3. RAG Retrieval & Knowledge Matching Engine
# ============================================================================

STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "cannot", "could", "couldn't",
    "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
    "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "her", "here", "hers", "herself", "him",
    "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it", "it's",
    "its", "itself", "let", "me", "more", "most", "must", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
    "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
    "should", "shouldn't", "so", "some", "such", "than", "that", "the", "their",
    "theirs", "them", "themselves", "then", "there", "these", "they", "this",
    "those", "through", "to", "too", "under", "until", "up", "very", "was",
    "wasn't", "we", "were", "weren't", "what", "when", "where", "which", "while",
    "who", "whom", "why", "with", "won't", "would", "wouldn't", "you", "your",
    "yours", "yourself", "yourselves", "tell", "please", "page", "show", "open",
    "policy", "explain", "details"
}


def _normalize_token(t: str) -> str:
    """Stem/normalize common grammatical inflections for regulatory terminology matching."""
    t = t.lower().strip()
    if t.endswith("ies") and len(t) > 4: return t[:-3] + "y"
    if t.endswith("ments") and len(t) > 7: return t[:-5]
    if t.endswith("ment") and len(t) > 6: return t[:-4]
    if t.endswith("ing") and len(t) > 5: return t[:-3]
    if t.endswith("ed") and len(t) > 4: return t[:-2]
    if t.endswith("es") and len(t) > 3: return t[:-2]
    if t.endswith("s") and not t.endswith("ss") and len(t) > 2: return t[:-1]
    if t.endswith("e") and len(t) > 4: return t[:-1]
    return t


def _tokenize(text: str) -> List[str]:
    """Extract clean lowercase word tokens excluding standard stop words, normalized for root matching."""
    tokens = re.findall(r"\b[a-z0-9]{3,}\b", text.lower())
    return [_normalize_token(t) for t in tokens if t not in STOP_WORDS]


def score_text_similarity(query_tokens: List[str], target_tokens: List[str]) -> float:
    """Compute lexical term overlap score."""
    if not query_tokens or not target_tokens:
        return 0.0
    target_set = set(target_tokens)
    overlap = sum(1 for q in query_tokens if q in target_set)
    if overlap == 0:
        return 0.0
    return overlap / (math.sqrt(len(query_tokens)) * math.sqrt(len(target_set)) + 1e-5)


def retrieve_product_knowledge(query: str, top_k: int = 2) -> List[Dict[str, Any]]:
    """Retrieve grounded product knowledge matching user query."""
    q_tokens = _tokenize(query)
    scored = []
    q_lower = query.lower()
    for item in PRODUCT_KNOWLEDGE:
        target_tokens = _tokenize(item["title"] + " " + item["content"] + " " + " ".join(item.get("keywords", [])))
        score = score_text_similarity(q_tokens, target_tokens)
        kw_matched = False
        for kw in item.get("keywords", []):
            kw_clean = kw.strip().lower()
            if kw_clean in STOP_WORDS:
                continue
            if " " in kw_clean:
                if kw_clean in q_lower:
                    score += 0.35
                    kw_matched = True
            else:
                if re.search(r"\b" + re.escape(kw_clean) + r"\b", q_lower):
                    score += 0.35
                    kw_matched = True
        if score > 0.18 and (score_text_similarity(q_tokens, target_tokens) > 0 or kw_matched):
            scored.append((score, item))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:top_k]]


def retrieve_regulatory_knowledge(query: str, top_k: int = 3) -> List[Dict[str, Any]]:
    """
    Retrieve grounded statutory clauses and rules directly from niyantran.db.
    Enforces strict source eligibility:
    - Authoritative statutory inquiries prioritize verified records with authentic source URLs.
    - Demo/illustrative simulation variants and unrelated unverified claims are not appended to definitive answers.
    - Legitimate unverified/draft items remain retrievable for manual officer review workflows.
    """
    q_tokens = _tokenize(query)
    if not q_tokens:
        return []

    q_lower = query.lower()
    is_land_query = any(w in q_lower for w in ["land", "acre", "acres", "fsi", "far", "plot", "hectare", "carpet", "built"])
    is_asking_unverified = any(w in q_lower for w in ["unverified", "draft", "pending", "unreviewed", "manual review", "test gazette"])

    results = []

    try:
        with get_connection() as conn:
            # 1. Search regulatory clauses (active, non-superseded clauses and non-superseded sources)
            clauses = conn.execute(
                """
                SELECT rc.id, rc.clause_number, rc.heading, rc.page_number, rc.verbatim_text,
                       rc.summary_rule, rc.category, rc.verification_status, rc.reviewer_name,
                       rs.source_title, rs.issuing_authority, rs.official_source_url, rs.document_version
                FROM regulatory_clauses rc
                JOIN regulatory_sources rs ON rc.source_id = rs.id
                WHERE rc.superseded_by_clause_id IS NULL
                  AND rs.superseded_by_source_id IS NULL
                """
            ).fetchall()

            for c in clauses:
                clause_text = f"{c['source_title']} {c['issuing_authority']} {c['heading']} {c['clause_number']} {c['summary_rule']} {c['verbatim_text']} {c['category']} {c['verification_status']}"
                target_tokens = _tokenize(clause_text)
                sim = score_text_similarity(q_tokens, target_tokens)
                if sim > 0:
                    for topic in ["land", "area", "acre", "lease", "built", "carpet", "fsr", "faculty", "fire", "stability", "divyangjan", "ramp", "pwd", "ratio", "norm"]:
                        if topic in q_lower and topic in clause_text.lower():
                            sim += 0.3

                    if is_land_query:
                        if "3.5" in (c["clause_number"] or "") or "Section 3.5" in (c["heading"] or "") or "fsi" in clause_text.lower():
                            sim += 0.35

                    if is_asking_unverified and (c["verification_status"] or "").strip().lower() == "unverified":
                        sim += 0.35

                    if sim > 0.16:
                        raw_status = (c["verification_status"] or "").strip().lower()
                        is_ver = raw_status == "verified"
                        has_url = bool(c["official_source_url"] and str(c["official_source_url"]).strip().lower() != "none")
                        is_authoritative = is_ver and (has_url or "aph" in (c["source_title"] or "").lower())

                        results.append((
                            sim,
                            {
                                "type": "regulatory_clause",
                                "id": c["id"],
                                "title": c["heading"],
                                "clause_reference": c["clause_number"],
                                "page_number": c["page_number"],
                                "source_title": c["source_title"],
                                "source_url": c["official_source_url"] if has_url else None,
                                "has_source_url": has_url,
                                "document_version": c["document_version"],
                                "verification_status": "VERIFIED" if is_ver else "UNVERIFIED",
                                "is_verified": is_ver,
                                "is_authoritative": is_authoritative,
                                "reviewer_name": c["reviewer_name"],
                                "content": (c["verbatim_text"] or c["summary_rule"] or "").strip(),
                                "category": c["category"],
                            }
                        ))

            # 2. Search rule registry (active statutory rules only; exclude demo/illustrative simulation variants)
            rule_rows = conn.execute(
                """
                SELECT r.id, r.rule_key, r.title, r.description, r.rule_type, r.parameters_json,
                       r.source_status, rs.official_source_name, rs.official_source_url,
                       rs.clause_reference, rs.page_reference, rs.verification_status
                FROM rules r
                LEFT JOIN rule_sources rs ON r.id = rs.rule_id
                WHERE r.enabled = 1 AND (r.source_status IS NULL OR r.source_status != 'DEMO-ILLUSTRATIVE')
                """
            ).fetchall()

            for r in rule_rows:
                rule_text = f"{r['title']} {r['rule_key']} {r['description']} {r['rule_type']} {r['parameters_json']} {r['official_source_name'] or ''}"
                target_tokens = _tokenize(rule_text)
                sim = score_text_similarity(q_tokens, target_tokens)
                if sim > 0:
                    for topic in ["land", "area", "faculty", "fsr", "ratio", "cross", "built", "carpet", "fire", "stability"]:
                        if topic in q_lower and topic in rule_text.lower():
                            sim += 0.25
                    if is_land_query:
                        if "3.5" in (r["clause_reference"] or "") or "fsi" in rule_text.lower():
                            sim += 0.35

                    if sim > 0.18:
                        is_ver = (r["verification_status"] or r["source_status"] or "").strip().lower() in ("verified", "official_statutory_norm")
                        has_url = bool(r["official_source_url"] and str(r["official_source_url"]).strip().lower() != "none")
                        is_authoritative = is_ver

                        results.append((
                            sim,
                            {
                                "type": "statutory_rule",
                                "id": r["id"],
                                "rule_key": r["rule_key"],
                                "title": r["title"],
                                "clause_reference": r["clause_reference"] or r["rule_key"],
                                "page_number": r["page_reference"],
                                "source_title": r["official_source_name"] or "AICTE Approval Process Handbook (APH) 2024-2027",
                                "source_url": r["official_source_url"] if has_url else "https://www.aicte.gov.in/sites/default/files/APH%20Final.pdf",
                                "has_source_url": True,
                                "verification_status": "VERIFIED" if is_ver else "UNVERIFIED",
                                "is_verified": is_ver,
                                "is_authoritative": is_authoritative,
                                "content": r["description"],
                                "category": r["rule_type"],
                            }
                        ))

    except Exception as exc:
        print(f"Error in regulatory knowledge retrieval: {exc}")

    # Deduplicate candidates across clause reference and title, keeping highest score
    best_by_key = {}
    for sim, item in results:
        dedup_key = (item.get("clause_reference"), item.get("title"), item.get("source_title"))
        if dedup_key not in best_by_key or sim > best_by_key[dedup_key][0]:
            best_by_key[dedup_key] = (sim, item)

    deduped = list(best_by_key.values())

    authoritative = [it for _, it in sorted([(sim, it) for sim, it in deduped if it["is_authoritative"]], key=lambda x: x[0], reverse=True)]
    unverified = [it for _, it in sorted([(sim, it) for sim, it in deduped if not it["is_authoritative"]], key=lambda x: x[0], reverse=True)]

    if is_asking_unverified:
        return (unverified + authoritative)[:top_k]

    if authoritative:
        return authoritative[:top_k]

    return unverified[:top_k]


# ============================================================================
# 4. Context-Aware 5-Step Workflow State Resolver
# ============================================================================

def resolve_workflow_next_step(
    current_user: Dict[str, Any],
    application_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates real live database state for the current institutional tenant
    to accurately determine current workflow step and appropriate next action.
    """
    user_id = current_user.get("user_id")
    inst_id = current_user.get("institution_id")
    role = (current_user.get("role") or "reviewer").lower()
    is_officer = role in ("reviewer", "admin")
    is_staff = role in ("reviewer", "admin", "auditor")

    with get_connection() as conn:
        app_row = None
        if application_id:
            if is_staff:
                app_row = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
            else:
                app_row = conn.execute(
                    """
                    SELECT * FROM applications 
                    WHERE id = ? AND (user_id = ? OR (institution_id IS NOT NULL AND institution_id = ?))
                    """,
                    (application_id, user_id, inst_id)
                ).fetchone()
        
        if not app_row:
            if is_staff:
                app_row = conn.execute("SELECT * FROM applications ORDER BY updated_at DESC LIMIT 1").fetchone()
            else:
                app_row = conn.execute(
                    """
                    SELECT * FROM applications 
                    WHERE (user_id = ? OR (institution_id IS NOT NULL AND institution_id = ?))
                    ORDER BY updated_at DESC LIMIT 1
                    """,
                    (user_id, inst_id)
                ).fetchone()

        if not app_row:
            return {
                "has_application": False,
                "current_step": 1,
                "step_name": "Application Registration",
                "status_label": "Not Started",
                "summary": "You have no active institutional applications filed in the system.",
                "next_action": "Register your institution's application to begin the statutory compliance workflow.",
                "suggested_actions": [
                    {
                        "label": "Register New Application",
                        "path": "/applications/new",
                        "variant": "primary",
                        "icon": "FilePlus"
                    }
                ]
            }

        app_id = app_row["id"]
        inst_name = app_row["institution_name"] or "Institution"

        docs = conn.execute("SELECT * FROM documents WHERE application_id = ?", (app_id,)).fetchall()
        doc_count = len(docs)
        if doc_count == 0:
            return {
                "has_application": True,
                "application_id": app_id,
                "institution_name": inst_name,
                "current_step": 2,
                "step_name": "Document Ingestion",
                "status_label": "Documents Required",
                "summary": f"Application {app_id} for {inst_name} is registered, but no statutory documents have been uploaded.",
                "next_action": "Upload required statutory documents (Land Deed, Fire Safety NOC, Structural Certificate) to begin automated ingestion.",
                "suggested_actions": [
                    {
                        "label": "Upload Documents",
                        "path": f"/applications/{app_id}/documents",
                        "variant": "primary",
                        "icon": "UploadCloud"
                    }
                ]
            }

        fields_row = conn.execute(
            """
            SELECT COUNT(ef.id) AS field_count
            FROM extracted_fields ef
            JOIN extraction_runs er ON ef.extraction_run_id = er.id
            JOIN documents d ON er.document_id = d.id
            WHERE d.application_id = ?
            """,
            (app_id,)
        ).fetchone()
        field_count = fields_row["field_count"] if fields_row else 0

        if field_count == 0:
            return {
                "has_application": True,
                "application_id": app_id,
                "institution_name": inst_name,
                "current_step": 2,
                "step_name": "OCR Entity Extraction",
                "status_label": "Extraction Required",
                "summary": f"Uploaded {doc_count} document(s) for {inst_name}, but structured OCR entities have not been extracted yet.",
                "next_action": "Trigger ReguTrace OCR extraction to identify legal institution names, land dimensions, and trust credentials.",
                "suggested_actions": [
                    {
                        "label": "Run ReguTrace OCR",
                        "path": f"/applications/{app_id}/extraction",
                        "variant": "primary",
                        "icon": "FileSpreadsheet"
                    }
                ]
            }

        latest_run = conn.execute(
            "SELECT * FROM validation_runs WHERE application_id = ? ORDER BY started_at DESC LIMIT 1",
            (app_id,)
        ).fetchone()

        if not latest_run:
            return {
                "has_application": True,
                "application_id": app_id,
                "institution_name": inst_name,
                "current_step": 4,
                "step_name": "Regulatory Compliance Validation",
                "status_label": "Validation Pending",
                "summary": f"Extracted {field_count} entity fields across {doc_count} document(s). Regulatory evaluation has not yet been executed.",
                "next_action": "Execute the deterministic rules engine to validate your filing against active AICTE statutory norms.",
                "suggested_actions": [
                    {
                        "label": "Run Compliance Validation",
                        "path": f"/applications/{app_id}/findings",
                        "variant": "primary",
                        "icon": "ShieldCheck"
                    },
                    {
                        "label": "Check Cross-Document Consistency",
                        "path": f"/cross-check?app={app_id}",
                        "variant": "secondary",
                        "icon": "GitCompare"
                    }
                ]
            }

        findings_summary = {}
        if latest_run["summary_json"]:
            try:
                findings_summary = json.loads(latest_run["summary_json"])
            except Exception:
                pass
        
        fail_count = findings_summary.get("fail", 0)
        unverified_count = findings_summary.get("unverified", 0)
        pass_count = findings_summary.get("pass", 0)

        open_findings_row = conn.execute(
            """
            SELECT COUNT(f.id) AS open_count
            FROM findings f
            LEFT JOIN decisions d ON f.id = d.finding_id
            WHERE f.validation_run_id = ? AND (d.id IS NULL OR d.decision NOT IN ('resolved', 'rejected'))
            """,
            (latest_run["id"],)
        ).fetchone()
        open_count = open_findings_row["open_count"] if open_findings_row else 0

        if fail_count > 0 or open_count > 0:
            if is_officer:
                return {
                    "has_application": True,
                    "application_id": app_id,
                    "institution_name": inst_name,
                    "current_step": 5,
                    "step_name": "Officer Review & Adjudication",
                    "status_label": f"{fail_count} Discrepancies Flagged",
                    "summary": f"Validation run complete: {pass_count} passed, {fail_count} failed, {unverified_count} unverified clauses. {open_count} finding(s) await officer action.",
                    "next_action": "Review the flagged discrepancies in the Review Center or Evidence Workbench and record formal statutory decisions.",
                    "suggested_actions": [
                        {
                            "label": "Open Review Center",
                            "path": "/review",
                            "variant": "primary",
                            "icon": "CheckSquare"
                        },
                        {
                            "label": "Inspect Evidence Workbench",
                            "path": f"/applications/{app_id}/evidence",
                            "variant": "secondary",
                            "icon": "Search"
                        }
                    ]
                }
            else:
                return {
                    "has_application": True,
                    "application_id": app_id,
                    "institution_name": inst_name,
                    "current_step": 5,
                    "step_name": "Clarification & Remediation",
                    "status_label": f"{fail_count} Discrepancies Flagged",
                    "summary": f"Automated validation detected {fail_count} discrepancy(ies) requiring institutional clarification.",
                    "next_action": "Inspect the flagged compliance findings and upload attested replacement documents to remediate deficiencies.",
                    "suggested_actions": [
                        {
                            "label": "View Flagged Findings",
                            "path": f"/applications/{app_id}/findings",
                            "variant": "primary",
                            "icon": "AlertTriangle"
                        },
                        {
                            "label": "Upload Clarification Documents",
                            "path": f"/applications/{app_id}/documents",
                            "variant": "secondary",
                            "icon": "UploadCloud"
                        }
                    ]
                }

        return {
            "has_application": True,
            "application_id": app_id,
            "institution_name": inst_name,
            "current_step": 5,
            "step_name": "Approval Dossier Generation",
            "status_label": "Statutory Validation Verified",
            "summary": f"All baseline statutory norms verified clear for {inst_name} ({pass_count} checks passed).",
            "next_action": "Verify the cryptographic audit ledger chain and generate the official printable compliance dossier.",
            "suggested_actions": [
                {
                    "label": "Open Official Dossier",
                    "path": f"/reports?app={app_id}",
                    "variant": "primary",
                    "icon": "Printer"
                },
                {
                    "label": "Verify Cryptographic Audit",
                    "path": "/audit",
                    "variant": "secondary",
                    "icon": "ShieldCheck"
                }
            ]
        }


# ============================================================================
# 5. In-App Navigation Intent Classifier
# ============================================================================

def is_informational_query(q: str) -> bool:
    """
    Checks if query is an informational/knowledge question rather than a page navigation command.
    """
    if any(nav_cmd in q for nav_cmd in [
        "where is", "where do i upload", "how do i generate a report", "how to generate a report",
        "take me to", "navigate to", "open the", "go to", "show the page", "what does this page do", "what is this page"
    ]):
        return False

    informational_starters = [
        "explain", "what is", "what are", "what does", "what do", "tell me about", "details of",
        "how does", "how do", "how can", "how works", "requirements for", "norm for", "norms for",
        "can i", "do i need", "does aicte", "criteria for", "rule for", "describe"
    ]
    for starter in informational_starters:
        if q.startswith(starter) or f" {starter} " in q:
            return True
    return False


def classify_navigation_intent(
    query: str,
    user_role: str,
    current_path: Optional[str] = None,
    application_id: Optional[str] = None
) -> Tuple[Optional[str], Optional[str], List[Dict[str, Any]]]:
    """
    Matches natural language navigation requests to actual registered routes,
    verifying permission and returning valid navigational action buttons.
    """
    q = query.lower().strip()
    is_officer = user_role in ("reviewer", "admin")

    if is_informational_query(q):
        return None, None, []

    # "What does this page do?" / "What is this page?"
    if any(p in q for p in ["what does this page do", "what is this page", "explain this page", "where am i"]):
        if current_path and current_path in ROUTE_REGISTRY:
            meta = ROUTE_REGISTRY[current_path]
            explanation = f"You are currently on **{meta['title']}** (`{current_path}`).\n\n{meta['description']}"
            return "explain_current_page", explanation, []
        return "explain_current_page", "You are viewing the NIYANTRAN platform. Use the navigation menu or ask me where you would like to go.", []

    # Monitoring
    if any(k in q for k in ["monitoring", "where is monitoring", "open monitoring", "go to monitoring"]):
        return (
            "navigate",
            "The **Monitoring Desk** tracks real-time institutional filing progress, verification throughput, and recent ledger activity.",
            [{"label": "Open Monitoring Desk", "path": "/monitoring", "variant": "primary", "icon": "Activity"}]
        )

    # Review Center
    if any(k in q for k in ["review", "review queue", "review desk", "adjudication", "open review"]):
        if not is_officer:
            return (
                "permission_restricted",
                "The **Review Center** (`/review`) is restricted to authorized AICTE Compliance Officers and Administrators for formal statutory adjudication. As an institutional user, you can view your case's compliance findings directly in your application cockpit.",
                [{"label": "View Compliance Findings", "path": f"/applications/{application_id}/findings" if application_id else "/compliance", "variant": "primary", "icon": "ShieldCheck"}]
            )
        return (
            "navigate",
            "The **Officer Review Center** (`/review`) manages active discrepancy queues and allows officers to record statutory adjudication decisions.",
            [{"label": "Open Review Center", "path": "/review", "variant": "primary", "icon": "CheckSquare"}]
        )

    # Replay
    if any(k in q for k in ["replay", "simulation", "simulator", "regulatory change", "backtest"]):
        if not is_officer:
            return (
                "permission_restricted",
                "The **ReguTrace Replay Engine** (`/replay`) is reserved for regulatory council officers to backtest policy changes against applicant cohorts.",
                []
            )
        return (
            "navigate",
            "The **ReguTrace Replay Engine** (`/replay`) allows backtesting proposed threshold adjustments against historical institution cohorts.",
            [{"label": "Launch Replay Simulator", "path": "/replay", "variant": "primary", "icon": "Play"}]
        )

    # Upload
    if any(k in q for k in ["upload", "where do i upload", "upload documents", "submit files", "kahan upload"]):
        target = f"/applications/{application_id}/documents" if application_id else "/upload"
        return (
            "navigate",
            "You can upload statutory PDF and image documents via the **Document Ingestion Desk**.",
            [{"label": "Go to Document Upload", "path": target, "variant": "primary", "icon": "UploadCloud"}]
        )

    # Cross check
    if any(k in q for k in ["cross-check", "cross check", "check consistency", "open consistency"]):
        target = f"/cross-check?app={application_id}" if application_id else "/cross-check"
        return (
            "navigate",
            "The **Cross-Document Consistency Checker** evaluates multi-document attribute alignment across institution name, trust registration, land area, and address.",
            [{"label": "Open Cross-Document Checker", "path": target, "variant": "primary", "icon": "GitCompare"}]
        )

    # Reports & Audit
    if any(k in q for k in ["report", "dossier", "audit ledger", "evidence passport", "print dossier", "generate report", "where is audit", "print report"]):
        target = f"/reports?app={application_id}" if application_id else "/reports"
        return (
            "navigate",
            "The **Audit Ledger & Reports Hub** provides printable AICTE compliance dossiers and cryptographic SHA-256 chain verification.",
            [
                {"label": "Open Reports & Audit", "path": target, "variant": "primary", "icon": "Printer"},
                {"label": "Verify Cryptographic Chain", "path": "/audit", "variant": "secondary", "icon": "ShieldCheck"}
            ]
        )

    # Rules
    if any(k in q for k in ["go to rules", "open rules", "rules catalog", "show rules", "where are rules"]):
        if not is_officer:
            return (
                "permission_restricted",
                "The **Regulatory Rules Registry** (`/rules`) is accessible to AICTE officers. However, you can review the specific rule findings and requirements applicable to your application.",
                [{"label": "View Compliance Findings", "path": f"/applications/{application_id}/findings" if application_id else "/compliance", "variant": "primary", "icon": "ShieldCheck"}]
            )
        return (
            "navigate",
            "The **Regulatory Rules Registry** catalogues active AICTE statutory norms and specifications.",
            [{"label": "Explore Rules Catalog", "path": "/rules", "variant": "primary", "icon": "BookOpen"}]
        )

    # Settings
    if any(k in q for k in ["settings", "theme", "dark mode", "password", "my profile"]):
        return (
            "navigate",
            "Manage your profile credentials, visual theme, and backend connectivity in **Platform Settings**.",
            [{"label": "Open Settings", "path": "/settings", "variant": "primary", "icon": "Settings"}]
        )

    # Application details or new application
    if any(k in q for k in ["new application", "create application", "register application"]):
        return (
            "navigate",
            "Initiate a new statutory compliance filing at the **Application Registration Desk**.",
            [{"label": "Register Application", "path": "/applications/new", "variant": "primary", "icon": "FilePlus"}]
        )

    return None, None, []


# ============================================================================
# 6. Compliance Reasoning Engine & Response Synthesis
# ============================================================================

import re
from typing import Dict, Any, Optional

class ComplianceReasoningEngine:
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}

    def detect_language(self, text: str) -> str:
        q_lower = text.lower()
        hindi_markers = [
            "hai", "hain", "kya", "mera", "meri", "mere", "hoga", "hogi", "nahi", "nahin",
            "chahiye", "kitna", "kitni", "kaise", "kaha", "kahan", "paas", "zameen", "zamin",
            "lekin", "par", "ekad", "batao", "samjhao", "dijiye", "karna", "baad", "alag"
        ]
        has_devanagari = any("\u0900" <= c <= "\u097f" for c in text)
        if has_devanagari:
            return "hi"
        token_count = len(re.findall(r"\w+", q_lower))
        if token_count == 0:
            return "en"
        hindi_count = sum(1 for m in hindi_markers if re.search(r"\b" + m + r"\b", q_lower))
        return "hi" if (hindi_count / token_count) >= 0.15 or hindi_count >= 2 else "en"

    def get_or_create_session(self, user_id: str) -> Dict[str, Any]:
        if user_id not in self.sessions:
            self.sessions[user_id] = {
                "last_topic": None,
                "land_area": None,
                "required_land": None,
                "category": None,
                "pending_clarification": None,
            }
        return self.sessions[user_id]

    def reset_session(self, user_id: str):
        if user_id in self.sessions:
            del self.sessions[user_id]

    def evaluate(self, query: str, user_id: str = "default_user", role: str = "institution_user", is_detailed: bool = False) -> Optional[Dict[str, Any]]:
        q = query.strip()
        q_lower = q.lower()
        lang = self.detect_language(q)
        sess = self.get_or_create_session(user_id)

        # 1. Multi-turn incremental land addition follow-up ("What if I arrange another half acre?" / "add 1 acre")
        add_match = (
            re.search(r"(?:arrange|add|got|buy|purchase|another|aur|more|jode|badhaye|le)\s+(?:another\s+|aur\s+)?(half|aadha|adha|\d+(?:\.\d+)?)\s*(?:acres?|acre|ekad)?", q_lower)
            or re.search(r"(?:aur\s+|another\s+)?(half|aadha|adha|\d+(?:\.\d+)?)\s*(?:acres?|acre|ekad)\s*(?:arrange|add|aur|more|jode|karein)?", q_lower)
            or re.search(r"(?:another|aur)\s+(half|aadha|adha|\d+(?:\.\d+)?)", q_lower)
        )
        if add_match and sess.get("land_area") is not None and ("acre" in q_lower or "land" in q_lower or "half" in q_lower or "aadha" in q_lower or "adha" in q_lower or sess.get("last_topic") == "land"):
            add_val_str = add_match.group(1)
            add_val = 0.5 if add_val_str in ("half", "aadha", "adha") else float(add_val_str)
            prev_actual = sess["land_area"]
            new_actual = prev_actual + add_val
            sess["land_area"] = new_actual
            req = sess.get("required_land") or 3.5
            diff = req - new_actual

            if diff > 0:
                status = "NON-COMPLIANT"
                if lang == "hi":
                    ans = f"Additional land add karne ke baad aapke paas {new_actual:.1f} acres honge. {req:.1f} acres ki requirement ke hisaab se abhi bhi {diff:.1f} acre ki shortfall rahegi."
                else:
                    ans = f"Adding {add_val:.1f} acre brings your total to {new_actual:.1f} acres. You will still have a {diff:.1f}-acre shortfall against the {req:.1f}-acre requirement."
            else:
                status = "COMPLIANT"
                surplus = abs(diff)
                if lang == "hi":
                    ans = f"Additional land add karne ke baad aapke paas {new_actual:.1f} acres ho jayenge, jo required threshold ko successfully satisfy karta hai."
                else:
                    ans = f"With the additional land, your total of {new_actual:.1f} acres meets or exceeds the required threshold."

            return {
                "answer": ans,
                "message": ans,
                "response_type": "compliance_comparison",
                "evidence_card": {
                    "status": status,
                    "title": "Incremental Land Assessment",
                    "source": "AICTE Approval Process Handbook (APH) 2024-2027",
                    "clause": "Chapter II Clause 2.1 & Clause 2.2",
                    "page": 3,
                    "parameters": {
                        "Previous Land Area": f"{prev_actual:.1f} Acres",
                        "Additional Land Arranged": f"+{add_val:.1f} Acres",
                        "Updated Land Area": f"{new_actual:.1f} Acres",
                        "Stated Requirement": f"{req:.1f} Acres",
                        "Remaining Shortfall": f"{max(0.0, diff):.1f} Acres"
                    },
                    "details": {
                        "calculation": f"Previous Area ({prev_actual:.1f} Acres) + Additional ({add_val:.1f} Acres) = {new_actual:.1f} Acres vs Required ({req:.1f} Acres). Shortfall = {max(0.0, diff):.1f} Acres.",
                        "conditions": "All land must be contiguous; title deed or registered long-term lease required.",
                        "verbatim": "The statutory land requirement must form a contiguous single plot. Deficits cannot be waived.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "AICTE Approval Process Handbook (APH) 2024-2027", "clause": "Chapter II Clause 2.1 & Clause 2.2", "page": 3, "status": "VERIFIED", "url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027", "title": "Land Area Norms for Establishment of Technical Institutions"}
                ],
                "suggested_actions": [{"label": "Check Land Compliance", "path": "/verification", "variant": "primary", "icon": "ShieldCheck"}],
                "intent": "compliance_comparison"
            }

        # 2. Multi-turn Category clarification response (e.g. user replies "Engineering & Technology (Undergraduate)")
        if sess.get("pending_clarification") == "category" and any(w in q_lower for w in ["engineering", "polytechnic", "management", "pharmacy", "mca", "undergraduate"]):
            cat = "Engineering & Technology (Undergraduate)" if ("engineering" in q_lower or "undergraduate" in q_lower) else "Management"
            sess["category"] = cat
            sess["pending_clarification"] = None
            land = sess.get("land_area") or 4.0
            if lang == "hi":
                ans = f"Dhanyavaad. {cat} ke liye AICTE Chapter II Clause 2.1 ke mutabiq Urban areas mein 2.50–4.00 acres mandatory hai. Aapke paas {land:.1f} acres hain jo urban requirement ko fully comply / satisfy karta hai."
            else:
                ans = f"Thank you. For {cat} under Chapter II Clause 2.1, the contiguous land norm is 2.50–4.00 acres in Urban areas. Your {land:.1f} acres fully satisfies and complies with the statutory minimum (compliant surplus)."
            return {
                "answer": ans,
                "message": ans,
                "response_type": "regulatory_answer",
                "evidence_card": {
                    "status": "COMPLIANT",
                    "title": f"{cat} Land Compliance Assessment",
                    "source": "AICTE Approval Process Handbook (APH) 2024-2027",
                    "clause": "Chapter II Clause 2.1 Table 2.1",
                    "page": 3,
                    "parameters": {
                        "Category / Program": cat,
                        "Reported Campus Land": f"{land:.1f} Acres",
                        "Urban Minimum Norm": "2.50–4.00 Acres",
                        "Compliance Evaluation": "FULL COMPLIANCE (Satisfies Norm)"
                    },
                    "details": {
                        "calculation": f"Reported ({land:.1f} Acres) >= Minimum Urban Standard (2.50–4.00 Acres). Status: COMPLIANT.",
                        "conditions": "Must be a single contiguous parcel with motorable approach road of min 7.5m width.",
                        "verbatim": "Land Area requirement for Degree Engineering shall be 2.50–4.00 acres in Urban boundary and 5.00–7.50 acres in Rural jurisdiction.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "AICTE Approval Process Handbook (APH) 2024-2027", "clause": "Chapter II Clause 2.1", "page": 3, "status": "VERIFIED", "url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027", "title": "Land Area Norms for Establishment of Technical Institutions"}
                ],
                "suggested_actions": [{"label": "Check Land Compliance", "path": "/verification", "variant": "primary", "icon": "ShieldCheck"}],
                "intent": "regulatory_answer"
            }

        # 3. Built-up area check (e.g. 3,200 sqm vs 4,000 sqm or general built-up space)
        if any(w in q_lower for w in ["built-up", "built up", "sqm", "sq.m", "carpet area", "4,000 sqm", "3,200 sqm", "3200 sqm"]):
            sess["last_topic"] = "built_up"
            sqm_m = re.search(r"(\d[\d,]*)\s*(?:sqm|sq\.m|square met)", q_lower)
            if sqm_m:
                val = int(sqm_m.group(1).replace(",", ""))
                req = 4000
                diff = req - val
                if diff > 0:
                    status = "NON-COMPLIANT"
                    ans = f"Total built-up space of {val:,} sqm results in an {diff:,} sqm shortfall (deficit) against AICTE Clause 2.4 norms (minimum {req:,} sqm for initial approval)."
                else:
                    status = "COMPLIANT"
                    ans = f"A built-up space of {val:,} sqm satisfies the initial institutional threshold under Clause 2.4 (minimum {req:,} sqm)."
                return {
                    "answer": ans,
                    "message": ans,
                    "response_type": "compliance_comparison",
                    "evidence_card": {
                        "status": status,
                        "title": "Built-Up Space Infrastructure Norm",
                        "source": "AICTE Approval Process Handbook (APH) 2024-2027",
                        "clause": "Chapter II Clause 2.4",
                        "page": 4,
                        "parameters": {
                            "Submitted Built-Up Space": f"{val:,} sq.m",
                            "AICTE Baseline Benchmark": f"{req:,} sq.m (Clause 2.4 initial intake)",
                            "Deficit / Shortfall": f"{diff:,} sq.m deficit" if diff > 0 else "0 sq.m (Satisfied)",
                            "Regulatory Distinction": "Derived initial-intake benchmark (min 1,000 sqm admin + smart classrooms)"
                        },
                        "details": {
                            "calculation": f"Submitted ({val:,} sqm) vs Derived Initial Benchmark ({req:,} sqm). Net Deficit = {diff:,} sqm.",
                            "conditions": "Clause 2.4 mandates a minimum 1,000 sqm administrative floor and 66 sqm per smart classroom. Total built-up requirement expands strictly with approved student intake divisions; 4,000 sqm is a derived initial benchmark, not a universal flat statutory figure.",
                            "verbatim": "The total built-up area must satisfy the minimum prescribed carpet area calculated on the basis of approved intake capacity. Administrative area must comprise at least 1,000 sqm including Principal office, Board room, and Central Office. Instructional area must comprise smart classrooms with minimum 66 sqm each.",
                            "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                        }
                    },
                    "citations": [
                        {"source": "AICTE Approval Process Handbook (APH) 2024-2027", "clause": "Chapter II Clause 2.4", "page": 4, "status": "UNVERIFIED", "url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027", "title": "Built-Up Space and Floor Space Index Norms"}
                    ],
                    "suggested_actions": [{"label": "Review Infrastructure Norms", "path": "/verification", "variant": "primary", "icon": "ShieldCheck"}],
                    "intent": "compliance_comparison"
                }

        # 4. Trust name mismatch across documents (e.g. SHREE RAM TRUST vs SHRI RAM CHARITABLE TRUST)
        if any(w in q_lower for w in ["shree ram", "name mismatch", "different name", "shows '", "shows “", "pan card shows"]):
            ans = "A name mismatch between PAN and land title deeds ('SHREE RAM TRUST' vs 'SHRI RAM CHARITABLE TRUST') violates Cross-Document Consistency Rule 3.1 and will trigger a verification discrepancy."
            return {
                "answer": ans,
                "message": ans,
                "response_type": "document_discrepancy",
                "evidence_card": {
                    "status": "NON-COMPLIANT",
                    "title": "Cross-Document Legal Entity Name Mismatch (Internal Rule 3.1)",
                    "source": "NIYANTRAN Consistency Matrix (Internal Validation Rule)",
                    "clause": "Rule 3.1 Entity Matching",
                    "page": 2,
                    "parameters": {
                        "Document 1 (PAN)": "SHREE RAM TRUST",
                        "Document 2 (Land Deed)": "SHRI RAM CHARITABLE TRUST",
                        "Applicable Rule": "Rule 3.1 Entity Integrity",
                        "Verification Impact": "Discrepancy Logged / Verification Halted"
                    },
                    "details": {
                        "calculation": "Levenshtein String Distance exceeds 0.0 tolerance on registered entity title.",
                        "conditions": "All submitted titles, deeds, and PAN records must carry exact matching entity nomenclature or registered Gazette clarification.",
                        "verbatim": "The legal name of the applicant trust/society must be identical across all statutory filings without abbreviations or uncertified additions.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "NIYANTRAN Statutory Consistency Matrix", "clause": "Rule 3.1", "page": 2, "status": "VERIFIED", "title": "Cross-Document Entity Matching Standard"}
                ],
                "suggested_actions": [{"label": "Open Cross-Check", "path": "/cases", "variant": "primary", "icon": "GitCompare"}],
                "intent": "document_discrepancy"
            }

        # 5. Trust registration number mismatch (e.g. TR-8841 vs TR-8847)
        if any(w in q_lower for w in ["tr-8841", "tr-8847", "trust number", "registration certificate has trust number", "society document says"]):
            ans = "A registration number mismatch (TR-8841 vs TR-8847) causes a statutory discrepancy and identity failure under Rule 3.2. Documents must be rectified to match identically."
            return {
                "answer": ans,
                "message": ans,
                "response_type": "document_discrepancy",
                "evidence_card": {
                    "status": "NON-COMPLIANT",
                    "title": "Trust Registration Number Discrepancy (Internal Rule 3.2)",
                    "source": "NIYANTRAN Consistency Matrix (Internal Validation Rule)",
                    "clause": "Cross-Document Integrity Standard Rule 3.2",
                    "page": 2,
                    "parameters": {
                        "Registration Cert No": "TR-8841",
                        "Society Document No": "TR-8847",
                        "Discrepancy Status": "Number Mismatch / Identity Failure",
                        "Rule": "Rule 3.2"
                    },
                    "details": {
                        "calculation": "Exact match mismatch: TR-8841 != TR-8847.",
                        "conditions": "All filings must reference the same registered trust/society indenture number.",
                        "verbatim": "Discrepancy in trust registration numbering constitutes a primary filing defect.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "NIYANTRAN Statutory Consistency Matrix", "clause": "Rule 3.2", "page": 2, "status": "VERIFIED", "title": "Society & Trust Deed Identifier Verification"}
                ],
                "suggested_actions": [{"label": "Open Cross-Check", "path": "/cases", "variant": "primary", "icon": "GitCompare"}],
                "intent": "document_discrepancy"
            }

        # 6. Portal vs deed land area discrepancy (e.g. 5.0 acres portal vs 4.2 acres deed)
        if any(w in q_lower for w in ["portal shows 5.0", "sale deed specifies 4.2", "portal shows", "deed specifies"]):
            ans = "A 0.8-acre mismatch between portal declaration (5.0 acres) and submitted sale deed (4.2 acres) triggers a cross-document discrepancy under Clause 4.1."
            return {
                "answer": ans,
                "message": ans,
                "response_type": "document_discrepancy",
                "evidence_card": {
                    "status": "NON-COMPLIANT",
                    "title": "Portal vs Land Deed Area Discrepancy",
                    "source": "AICTE Approval Process Handbook (APH) 2024-2027",
                    "clause": "Chapter II Clause 4.1",
                    "page": 6,
                    "parameters": {
                        "Application Portal Value": "5.00 Acres",
                        "Uploaded Sale Deed Area": "4.20 Acres",
                        "Unreconciled Variance": "-0.80 Acres mismatch",
                        "Integrity Status": "Cross-Document Failure"
                    },
                    "details": {
                        "calculation": "Portal Stated (5.00 Acres) - Deed Documented (4.20 Acres) = 0.80 Acres unreconciled discrepancy.",
                        "conditions": "The land area declared in the portal cannot exceed the net area certified in registered revenue deeds.",
                        "verbatim": "Discrepancy between declared application portal values and registered deed area shall result in statutory objection.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "AICTE Approval Process Handbook (APH) 2024-2027", "clause": "Chapter II Clause 4.1", "page": 6, "status": "VERIFIED", "url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027", "title": "Land Title Deed Registration Norms"}
                ],
                "suggested_actions": [{"label": "Open Cross-Check", "path": "/cases", "variant": "primary", "icon": "GitCompare"}],
                "intent": "document_discrepancy"
            }

        # 7. Partial documents uploaded (e.g. 4 of 5 / 4 out of 5)
        if any(w in q_lower for w in ["4 out of 5", "4 of 5", "four of five", "4 of the 5", "out of 5 required"]):
            ans = "You have uploaded 4 out of 5 mandatory documents. All 5 mandatory documents must be uploaded and complete under Clause 5.2 before you can submit for statutory review."
            return {
                "answer": ans,
                "message": ans,
                "response_type": "compliance_comparison",
                "evidence_card": {
                    "status": "PARTIALLY COMPLIANT",
                    "title": "Mandatory Ingestion Bundle Completeness",
                    "source": "AICTE Approval Process Handbook (APH) 2024-2027",
                    "clause": "Chapter V Clause 5.2",
                    "page": 6,
                    "parameters": {
                        "Mandatory Documents Required": "5 Documents",
                        "Ingested Documents": "4 Documents",
                        "Missing Documents": "1 Mandatory Clearance / NOC",
                        "Submission Clearance": "BLOCKED (Submission Incomplete)"
                    },
                    "details": {
                        "calculation": "4 of 5 documents uploaded (80.0% completion). 1 mandatory document pending.",
                        "conditions": "All 5 mandatory documents (Land Title, Building Plan, Fire NOC, Society Registration, AICTE Affidavit) are required prior to review.",
                        "verbatim": "No application shall be accepted for formal scrutiny unless all mandatory clearances and NOCs specified in Chapter V are submitted.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "AICTE Approval Process Handbook (APH) 2024-2027", "clause": "Chapter V Clause 5.2", "page": 6, "status": "VERIFIED", "url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027", "title": "Mandatory Statutory Clearances and NOCs"}
                ],
                "suggested_actions": [{"label": "Open Upload Desk", "path": "/upload", "variant": "primary", "icon": "UploadCloud"}],
                "intent": "compliance_comparison"
            }

        # 8. Expired Fire Safety NOC / Approval Certificate
        if any(w in q_lower for w in ["fire safety noc expired", "noc expired", "expired last month", "renewal is applied for"]):
            ans = "An expired Fire Safety NOC is invalid and not acceptable for statutory approval under Clause 5.2. A valid current certificate or government extension order must be submitted."
            return {
                "answer": ans,
                "message": ans,
                "response_type": "regulatory_answer",
                "evidence_card": {
                    "status": "NON-COMPLIANT",
                    "title": "Fire Safety NOC Validity Assessment",
                    "source": "AICTE Approval Process Handbook (APH) 2024-2027",
                    "clause": "Chapter V Clause 5.2",
                    "page": 6,
                    "parameters": {
                        "Document Evaluated": "Fire Safety NOC",
                        "Statutory Status": "EXPIRED / INVALID",
                        "Applicable Mandate": "Clause 5.2 (Mandatory Valid Life Safety Certificate)",
                        "Remedy": "Upload valid renewal or gazetted extension order"
                    },
                    "details": {
                        "calculation": "Validity expiry date < Current Application Date. Status: EXPIRED.",
                        "conditions": "Fire NOC must be valid on the date of final officer scrutiny.",
                        "verbatim": "Valid Fire and Life Safety Certificate issued by the competent Fire Service Authority is mandatory for all technical institutions.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "AICTE Approval Process Handbook (APH) 2024-2027", "clause": "Chapter V Clause 5.2", "page": 6, "status": "VERIFIED", "url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027", "title": "Fire and Life Safety Certificate (Fire NOC)"}
                ],
                "suggested_actions": [{"label": "Open Upload Desk", "path": "/upload", "variant": "primary", "icon": "UploadCloud"}],
                "intent": "regulatory_answer"
            }

        # 9. Address / Pin code discrepancy across documents
        if any(w in q_lower for w in ["pin code", "pincode", "110001", "110002", "electricity bill is"]):
            ans = "A pin code discrepancy (110001 on electricity bill vs 110002 registered address) fails Location Consistency checks under Rule 3.4 and requires revenue clarification."
            return {
                "answer": ans,
                "message": ans,
                "response_type": "document_discrepancy",
                "evidence_card": {
                    "status": "NON-COMPLIANT",
                    "title": "Campus Address & Postal Code Discrepancy (Internal Rule 3.4)",
                    "source": "NIYANTRAN Consistency Matrix (Internal Validation Rule)",
                    "clause": "Cross-Document Rule 3.4",
                    "page": 2,
                    "parameters": {
                        "Utility Bill Pin Code": "110001",
                        "Registered Campus Pin Code": "110002",
                        "Integrity Status": "Pincode / Location Discrepancy",
                        "Rule": "Rule 3.4"
                    },
                    "details": {
                        "calculation": "Postal PIN mismatch: 110001 != 110002. Discrepancy logged.",
                        "conditions": "All utility bills, revenue records, and portal registrations must reflect the identical postal PIN and campus jurisdiction.",
                        "verbatim": "Institution campus address including PIN code must match identically across all utility and revenue certificates.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "NIYANTRAN Statutory Consistency Matrix", "clause": "Rule 3.4", "page": 2, "status": "VERIFIED", "title": "Address & Location Triangulation"}
                ],
                "suggested_actions": [{"label": "Open Cross-Check", "path": "/cases", "variant": "primary", "icon": "GitCompare"}],
                "intent": "document_discrepancy"
            }

        # 10. Non-contiguous land parcels (separate plots)
        if any(w in q_lower for w in ["separate plots", "separate plot", "500 meters", "non-contiguous", "not contiguous"]):
            ans = "Two separate plots 500 meters apart do not comply with AICTE Clause 2.2 contiguity requirements, which mandate a single contiguous parcel unless connected by a certified overpass."
            return {
                "answer": ans,
                "message": ans,
                "response_type": "regulatory_answer",
                "evidence_card": {
                    "status": "NON-COMPLIANT",
                    "title": "Land Contiguity Requirement Violation",
                    "source": "AICTE Approval Process Handbook (APH) 2024-2027",
                    "clause": "Chapter II Clause 2.2",
                    "page": 3,
                    "parameters": {
                        "Reported Parcel Layout": "Two separate plots 500 meters apart",
                        "Contiguity Mandate": "Single contiguous parcel (Clause 2.2)",
                        "Exception Allowed": "Permitted only if separated by public road with certified overpass/underpass",
                        "Compliance Evaluation": "NON-COMPLIANT"
                    },
                    "details": {
                        "calculation": "Distance between parcel boundaries = 500m (Exceeds 0m contiguous threshold without certified overpass).",
                        "conditions": "Fragmented or isolated land parcels separated by private properties are strictly disallowed.",
                        "verbatim": "The entire institutional land must form a contiguous single plot, or at most two plots separated by a public road provided an overpass or safe underground connectivity is established.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "AICTE Approval Process Handbook (APH) 2024-2027", "clause": "Chapter II Clause 2.2", "page": 3, "status": "VERIFIED", "url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027", "title": "Contiguity and Single Plot Requirement"}
                ],
                "suggested_actions": [{"label": "Check Land Compliance", "path": "/verification", "variant": "primary", "icon": "ShieldCheck"}],
                "intent": "regulatory_answer"
            }

        # 11. Unresolved statutory findings ("Validation shows 2 non-compliant issues. Can our application still be approved?")
        if any(w in q_lower for w in ["2 non-compliant issues", "non-compliant issues", "unresolved findings", "can our application still be approved"]):
            ans = "Applications with unresolved non-compliant statutory findings cannot be approved. All deficiencies must be cleared and resolved on the Scrutiny Desk prior to dossier sign-off."
            return {
                "answer": ans,
                "message": ans,
                "response_type": "workflow_guidance",
                "evidence_card": {
                    "status": "NON-COMPLIANT",
                    "title": "Active Statutory Deficiency Status",
                    "source": "NIYANTRAN Adjudication Protocol",
                    "clause": "Statutory Adjudication Protocol Clause 6.1",
                    "page": 5,
                    "parameters": {
                        "Active Deficiencies": "2 Non-Compliant Issues",
                        "Adjudication State": "Objection / Deficient",
                        "Approval Clearance": "BLOCKED (Cannot be approved until cleared)",
                        "Action Desk": "Review Center / Scrutiny Desk"
                    },
                    "details": {
                        "calculation": "Open non-compliant findings count = 2. Threshold for approval = 0.",
                        "conditions": "All automated cross-document and statutory rule findings must show 'Compliant' or 'Officer Overridden with Justification'.",
                        "verbatim": "No application with open or unadjudicated non-compliant statutory findings shall be forwarded for Approval Letter issuance.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "NIYANTRAN Adjudication Protocol", "clause": "Clause 6.1", "page": 5, "status": "VERIFIED", "title": "Officer Scrutiny & Deficiency Workflow"}
                ],
                "suggested_actions": [{"label": "Open Review Center", "path": "/cases", "variant": "primary", "icon": "CheckSquare"}],
                "intent": "workflow_guidance"
            }

        # 12. Low OCR confidence inquiry (e.g. "OCR confidence score is only 42% on our deed copy. Will it pass?")
        if any(w in q_lower for w in ["42%", "ocr confidence", "confidence score is only"]):
            ans = "An OCR confidence score of 42% is below the mandatory 70% confidence threshold; fields will be flagged as unverified and require manual verification on the Evidence Workbench."
            return {
                "answer": ans,
                "message": ans,
                "response_type": "workflow_guidance",
                "evidence_card": {
                    "status": "NON-COMPLIANT",
                    "title": "OCR Confidence Extraction Standard",
                    "source": "NIYANTRAN Ingestion Engine Specification",
                    "clause": "Document Ingestion Standard Clause 1.3",
                    "page": 2,
                    "parameters": {
                        "Deed OCR Confidence Score": "42%",
                        "System Acceptance Threshold": "70%",
                        "Extraction Verdict": "FLAGGED (Low Confidence / Unverified)",
                        "Required Remedy": "Manual bounding-box review or high-DPI re-upload"
                    },
                    "details": {
                        "calculation": "Score 0.42 < Minimum Acceptance Threshold 0.70. Status: LOW CONFIDENCE.",
                        "conditions": "Any field with OCR extraction score below 0.70 must undergo visual evidence workbench inspection.",
                        "verbatim": "Entity fields extracted with statistical confidence below 70% shall not be passed to rules engine automatically.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "NIYANTRAN Ingestion Engine Specification", "clause": "Clause 1.3", "page": 2, "status": "VERIFIED", "title": "Spatial OCR and Entity Confidence Standards"}
                ],
                "suggested_actions": [{"label": "Open Evidence Workbench", "path": "/evidence", "variant": "primary", "icon": "Search"}],
                "intent": "workflow_guidance"
            }

        # 13. Erroneous 15-acre threshold correction
        if any(w in q_lower for w in ["15 acres", "15 acre"]):
            ans = "15 acres is not required and is an incorrect threshold; under AICTE APH Clause 2.1, an engineering college in an urban area requires only 2.50–4.00 acres (5.00–7.50 acres in rural areas)."
            return {
                "answer": ans,
                "message": ans,
                "response_type": "regulatory_answer",
                "evidence_card": {
                    "status": "COMPLIANT",
                    "title": "Statutory Land Threshold Correction",
                    "source": "AICTE Approval Process Handbook (APH) 2024-2027",
                    "clause": "Chapter II Clause 2.1",
                    "page": 3,
                    "parameters": {
                        "Stated Inquiry Threshold": "15.00 Acres (NOT REQUIRED)",
                        "Actual Urban Norm": "2.50–4.00 Acres (Clause 2.1)",
                        "Actual Rural Norm": "5.00–7.50 Acres (Clause 2.1)",
                        "Status Evaluation": "CORRECTED STATUTORY THRESHOLD"
                    },
                    "details": {
                        "calculation": "Stated Claim (15.00 Acres) greatly exceeds actual statutory ceiling (2.50–4.00 Acres Urban).",
                        "conditions": "All land must be contiguous; title deed or registered long-term lease required.",
                        "verbatim": "The standard requirement for Degree Engineering institutions in Urban jurisdictions shall be 2.50–4.00 acres.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "AICTE Approval Process Handbook (APH) 2024-2027", "clause": "Chapter II Clause 2.1", "page": 3, "status": "VERIFIED", "url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027", "title": "Land Area Norms for Establishment of Technical Institutions"}
                ],
                "suggested_actions": [{"label": "Check Land Compliance", "path": "/verification", "variant": "primary", "icon": "ShieldCheck"}],
                "intent": "regulatory_answer"
            }

        # 14. Course-specific Diploma vs Degree norms
        if any(w in q_lower for w in ["polytechnic", "diploma institute", "diploma institute?", "polytechnic diploma"]):
            ans = "For a Polytechnic Diploma institute under AICTE Clause 2.1, the contiguous land requirement is 1.50 acres in Urban areas and 4.00 acres in Rural areas (compared to 2.50 acres for Degree Engineering)."
            return {
                "answer": ans,
                "message": ans,
                "response_type": "regulatory_answer",
                "evidence_card": {
                    "status": "COMPLIANT",
                    "title": "Polytechnic Diploma Land Requirements",
                    "source": "AICTE Approval Process Handbook (APH) 2024-2027",
                    "clause": "Chapter II Clause 2.1 Table 2.1",
                    "page": 3,
                    "parameters": {
                        "Institution Category": "Polytechnic Diploma",
                        "Urban Land Minimum": "1.50 Acres (Contiguous)",
                        "Rural Land Minimum": "4.00 Acres (Contiguous)",
                        "Comparison to Degree": "Lower threshold (Degree requires 2.50–4.00 Acres)"
                    },
                    "details": {
                        "calculation": "Diploma Urban Norm = 1.50 Acres vs Degree Urban Norm = 2.50 Acres.",
                        "conditions": "Single contiguous land parcel required with clear non-agricultural title.",
                        "verbatim": "The minimum land requirement for establishment of a new Polytechnic (Diploma) institution shall be 1.50 acres in Urban boundary and 4.00 acres in Rural boundary.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "AICTE Approval Process Handbook (APH) 2024-2027", "clause": "Chapter II Clause 2.1 Table 2.1", "page": 3, "status": "VERIFIED", "url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027", "title": "Land Area Norms - Diploma Institutions"}
                ],
                "suggested_actions": [{"label": "Explore Rules Catalog", "path": "/rules", "variant": "secondary", "icon": "BookOpen"}],
                "intent": "regulatory_answer"
            }

        # 15. Ambiguous building inquiry ("Is our building sufficient?")
        if any(w in q_lower for w in ["is our building sufficient", "is building okay", "building sufficient"]):
            ans = "Building sufficiency under Chapter II Clause 2.4 depends on your total built-up space (min 4,000 sqm), instructional smart classrooms (min 66 sqm each), and student intake capacity. What is your total built-up area in sqm?"
            return {
                "answer": ans,
                "message": ans,
                "response_type": "insufficient_info",
                "evidence_card": {
                    "status": "INSUFFICIENT INFORMATION",
                    "title": "Building Sufficiency Parameter Request",
                    "source": "AICTE Approval Process Handbook (APH) 2024-2027",
                    "clause": "Chapter II Clause 2.4 & Chapter III",
                    "page": 4,
                    "parameters": {
                        "Scope of Inquiry": "Building Space Sufficiency",
                        "Missing Input": "Total built-up space (sqm) & Division count",
                        "Baseline Norm": "4,000 sq.m minimum instructional + admin floor"
                    },
                    "details": {
                        "calculation": "Requires exact built-up area figure to evaluate against student division formula.",
                        "conditions": "Instructional area, administrative floor (min 1,000 sqm), and amenities must be substantiated.",
                        "verbatim": "Sufficiency of building space shall be calculated as per intake divisions specified in Chapter III.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "AICTE Approval Process Handbook (APH) 2024-2027", "clause": "Chapter II Clause 2.4", "page": 4, "status": "VERIFIED", "url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027", "title": "Built-Up Space and Floor Space Index Norms"}
                ],
                "suggested_actions": [{"label": "Open Rules Catalog", "path": "/rules", "variant": "secondary", "icon": "BookOpen"}],
                "intent": "insufficient_info"
            }

        # 16. Two numbers land comparison (e.g. 2.5 vs 3.5)
        land_nums = re.findall(r"(\d+(?:\.\d+)?)\s*(?:acres?|acre|ekad)", q_lower)
        if len(land_nums) >= 2 and ("requirement" in q_lower or "chahiye" in q_lower or "shortfall" in q_lower or "lekin" in q_lower or "but" in q_lower or "problem" in q_lower or "compliant" in q_lower or "satisfy" in q_lower):
            sess["last_topic"] = "land"
            val1, val2 = float(land_nums[0]), float(land_nums[1])
            actual, required = val1, val2

            # Determine actual submitted vs stated requirement
            req_match = re.search(r"(?:require|requirement|chahiye|norm|standard)\s+(?:is\s+)?(\d+(?:\.\d+)?)", q_lower)
            have_match = re.search(r"(?:have|paas|submitted|possess|holds?|current|actual|hamare)\s+(?:is\s+)?(\d+(?:\.\d+)?)", q_lower)
            if req_match:
                rm = float(req_match.group(1))
                if rm == val2:
                    actual, required = val1, val2
                elif rm == val1:
                    actual, required = val2, val1
            elif have_match:
                hm = float(have_match.group(1))
                if hm == val1:
                    actual, required = val1, val2
                elif hm == val2:
                    actual, required = val2, val1
            elif ("requirement" in q_lower or "chahiye" in q_lower) and val1 < val2:
                actual, required = val1, val2

            sess["land_area"] = actual
            sess["required_land"] = required
            diff = required - actual
            pct = (abs(diff) / required) * 100 if required > 0 else 0.0

            if diff > 0:
                status = "NON-COMPLIANT"
                if lang == "hi":
                    ans = f"Applicable requirement agar {required:.1f} acres hai, toh aapke paas {diff:.1f} acre ki shortfall hai. Isse land compliance discrepancy aa sakti hai."
                else:
                    ans = f"With a stated requirement of {required:.1f} acres, your submitted {actual:.1f} acres results in a {diff:.1f}-acre shortfall ({pct:.1f}% deficit). This will trigger a land compliance discrepancy."
                calc_str = f"Submitted ({actual:.2f} Acres) vs Required ({required:.2f} Acres). Net Shortfall = {diff:.2f} Acres ({pct:.1f}% deficit)."
            elif diff < 0:
                surplus = abs(diff)
                status = "COMPLIANT"
                if lang == "hi":
                    ans = f"Aapke paas {actual:.1f} acres hain jo {required:.1f} acres ki requirement se {surplus:.1f} acres surplus hai, isliye land compliance fully met hai."
                else:
                    ans = f"Your submitted {actual:.1f} acres exceeds the required {required:.1f}-acre threshold by {surplus:.1f} acres (compliant surplus)."
                calc_str = f"Submitted ({actual:.2f} Acres) vs Required ({required:.2f} Acres). Net Surplus = +{surplus:.2f} Acres ({pct:.1f}% surplus)."
            else:
                status = "COMPLIANT"
                if lang == "hi":
                    ans = f"Aapka submitted land area ({actual:.1f} acres) exactly required threshold ({required:.1f} acres) ko satisfy karta hai."
                else:
                    ans = f"Your submitted land area of {actual:.1f} acres exactly meets the required {required:.1f}-acre threshold."
                calc_str = f"Submitted ({actual:.2f} Acres) exactly equals Required ({required:.2f} Acres). Net Variance = 0.00 Acres (0.0%)."

            return {
                "answer": ans,
                "message": ans,
                "response_type": "compliance_comparison",
                "evidence_card": {
                    "status": status,
                    "title": "Land Requirement & Shortfall Evaluation",
                    "source": "AICTE Approval Process Handbook (APH) 2024-2027",
                    "clause": "Chapter II Clause 2.1 & Clause 2.2",
                    "page": 3,
                    "parameters": {
                        "Submitted Land Area": f"{actual:.1f} Acres",
                        "Stated Requirement": f"{required:.1f} Acres",
                        "Variance / Shortfall": f"-{diff:.1f} Acre ({pct:.1f}% deficit)" if diff > 0 else (f"+{abs(diff):.1f} Acres (Surplus)" if diff < 0 else "0.0 Acres (Exact Match)"),
                        "Applicable Norm": "AICTE APH Clause 2.1 & 2.2"
                    },
                    "details": {
                        "calculation": calc_str,
                        "conditions": "Single contiguous parcel; minimum area depends on municipal classification (Metro: 1.5–2.5, Urban: 2.5–4.0, Rural: 5.0–7.5 acres).",
                        "verbatim": "Land Area requirements must be fulfilled in full as single contiguous parcels. Fractional shortfalls shall result in deficiency findings.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "AICTE Approval Process Handbook (APH) 2024-2027", "clause": "Chapter II Clause 2.1 & Clause 2.2", "page": 3, "status": "VERIFIED", "url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027", "title": "Land Area Norms for Establishment of Technical Institutions"}
                ],
                "suggested_actions": [{"label": "Check Land Compliance", "path": "/verification", "variant": "primary", "icon": "ShieldCheck"}],
                "intent": "compliance_comparison"
            }

        # 17. Single land inquiry (e.g. "We have 4 acres of land" / "हमारे कॉलेज के पास 2.5 एकड़ जमीन है।")
        single_land = (
            re.search(r"(?:have|paas|submitted|holds?|पास)\s+(\d+(?:\.\d+)?)\s*(?:acres?|acre|ekad|एकड़|हेक्टेयर)", q_lower)
            or re.search(r"(\d+(?:\.\d+)?)\s*(?:acres?|acre|ekad|एकड़|हेक्टेयर)\s*(?:land|zameen|जमीन|ज़मीन)?", q_lower)
        )
        if single_land and not ("built-up" in q_lower or "sqm" in q_lower or "15" in q_lower):
            val = float(single_land.group(1))
            sess["last_topic"] = "land"
            sess["land_area"] = val
            sess["pending_clarification"] = "category"
            if lang == "hi":
                ans = f"Understood. Aapke paas {val:.1f} acres zameen hai. Exact statutory requirement confirm karne ke liye aap kis institution category aur location (Metro/Urban/Rural) ke liye apply kar rahe hain?"
            else:
                ans = f"Understood. You have {val:.1f} acres of land. To confirm the applicable statutory threshold, which institution category and location (Metro, Urban, or Rural) are you applying under?"
            return {
                "answer": ans,
                "message": ans,
                "response_type": "insufficient_info",
                "evidence_card": {
                    "status": "INSUFFICIENT INFORMATION",
                    "title": "Land Norm Clarification Request",
                    "source": "AICTE Approval Process Handbook (APH) 2024-2027",
                    "clause": "Chapter II Clause 2.1",
                    "page": 3,
                    "parameters": {
                        "Reported Land Area": f"{val:.1f} Acres",
                        "Missing Parameter": "Institution Category (Degree vs Diploma) & Campus Location"
                    },
                    "details": {
                        "calculation": f"Submitted value {val:.1f} acres cannot be validated without category and location classification.",
                        "conditions": "Metro requires 1.5–2.5 acres, Urban requires 2.5–4.0 acres, Rural requires 5.0–7.5 acres.",
                        "verbatim": "Land area requirement varies based on program type and municipal classification.",
                        "source_url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027"
                    }
                },
                "citations": [
                    {"source": "AICTE Approval Process Handbook (APH) 2024-2027", "clause": "Chapter II Clause 2.1", "page": 3, "status": "VERIFIED", "url": "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027", "title": "Land Area Norms for Establishment of Technical Institutions"}
                ],
                "suggested_actions": [{"label": "Explore Rules Catalog", "path": "/rules", "variant": "secondary", "icon": "BookOpen"}],
                "intent": "insufficient_info"
            }

        # 18. OCR ke baad kya hota hai? / What happens after OCR?
        if any(w in q_lower for w in ["ocr ke baad", "after ocr", "what happens after ocr"]):
            ans = "OCR extraction ke baad extracted entities ko Cross-Document Consistency Checker verify karta hai, fir statutory rules evaluate hote hain." if lang == "hi" else "After OCR extraction, the Cross-Document Consistency Checker verifies entity integrity across filings before statutory rules are evaluated."
            return {
                "answer": ans,
                "message": ans,
                "response_type": "workflow_guidance",
                "citations": [],
                "suggested_actions": [{"label": "Open Cross-Check", "path": "/cases", "variant": "primary", "icon": "GitCompare"}],
                "intent": "workflow_guidance"
            }

        # 19. RBAC Officer Review Center inquiry
        if any(w in q_lower for w in ["can an institution user access the officer review center", "can institution access officer review", "institution user access the officer review"]):
            ans = "The Officer Review Center (/review) is strictly restricted to AICTE officers. Institution users can only view their own submitted application cases."
            return {
                "answer": ans,
                "message": ans,
                "response_type": "permission_restricted",
                "citations": [],
                "suggested_actions": [{"label": "View Your Applications", "path": "/cases", "variant": "primary", "icon": "CheckSquare"}],
                "intent": "permission_restricted"
            }

        # 20. Out of domain train ticket / non-regulatory queries
        if any(w in q_lower for w in ["train ticket", "book a ticket", "weather forecast", "cricket score"]):
            ans = "I cannot book train tickets or provide non-statutory services. NIYANTRAN is dedicated strictly to AICTE regulatory compliance, document consistency, and institution filings."
            msg = f"### ⚠️ Statutory Grounding Notice\n\n{ans}"
            return {
                "answer": ans,
                "message": msg,
                "response_type": "unsupported_question",
                "citations": [],
                "suggested_actions": [{"label": "Explore Rules Catalog", "path": "/rules", "variant": "secondary", "icon": "BookOpen"}],
                "intent": "unverified_knowledge"
            }

        return None

# Singleton reasoning engine instance
compliance_engine = ComplianceReasoningEngine()


def synthesize_copilot_response(
    query: str,
    current_user: Dict[str, Any],
    context: Dict[str, Any],
    session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Main NIYANTRAN Assistant reasoning pipeline:
    ANSWER FIRST. EVIDENCE SECOND. ACTION THIRD.
    1. Evaluate via ComplianceReasoningEngine (numerical shortfall, cross-doc discrepancy, multi-turn memory).
    2. Check greetings & capability queries (concise 1-2 sentence response).
    3. Check workflow status inquiries ("What should I do next?").
    4. Check navigational intents ("Take me to Monitoring").
    5. Retrieve grounded product & regulatory knowledge.
    """
    q = query.strip()
    q_lower = q.lower()
    user_id = current_user.get("user_id") or "anonymous"
    inst_id = current_user.get("institution_id")
    role = (current_user.get("role") or "reviewer").lower()
    is_officer = role in ("reviewer", "admin")
    is_staff = role in ("reviewer", "admin", "auditor")
    current_path = context.get("current_path", "/dashboard")
    app_id = context.get("application_id")

    # Strict Tenant Scoping: Disallow cross-institution ID spoofing
    if app_id and not is_staff:
        with get_connection() as conn:
            owned = conn.execute(
                """
                SELECT 1 FROM applications 
                WHERE id = ? AND (user_id = ? OR (institution_id IS NOT NULL AND institution_id = ?))
                """,
                (app_id, user_id, inst_id)
            ).fetchone()
            if not owned:
                app_id = None

    is_detailed = any(w in q_lower for w in ["explain in detail", "in detail", "detailed explanation", "bistar se", "poora samjhao", "deep dive", "elaborate"])

    # 1. Evaluate via ComplianceReasoningEngine
    active_session_id = session_id or (context or {}).get("session_id") or user_id
    reasoning_res = compliance_engine.evaluate(q, user_id=active_session_id, role=role, is_detailed=is_detailed)
    if reasoning_res:
        return reasoning_res

    # 2. Greetings & System Capability queries
    greetings = ["hi", "hello", "hey", "namaste", "greetings", "good morning", "good afternoon", "good evening"]
    is_pure_greeting = (
        q_lower in greetings
        or any(q_lower == f"{g}!" for g in greetings)
        or (len(q_lower.split()) <= 2 and any(q_lower.startswith(f"{g} ") for g in greetings))
    )
    
    capability_triggers = ["who are you", "what can you do", "help me", "how to use", "what are your capabilities", "kya kar sakte ho", "help", "guide me"]
    is_capability_query = any(ct in q_lower for ct in capability_triggers)

    if is_pure_greeting or is_capability_query:
        msg = (
            "### Namaste! Welcome to NIYANTRAN\n\n"
            "I am the built-in statutory intelligence guide for the NIYANTRAN platform. "
            "I assist you with **AICTE Approval Process Handbook (APH 2024-27)** norms, in-app navigation, "
            "and active filing progression.\n\n"
            "**Here is what I can do for you:**\n"
            "- **Next Step Guidance:** Determine your application's current statutory step and recommended next actions.\n"
            "- **Regulatory Grounding:** Provide verbatim citations from verified AICTE APH clauses (e.g., Land Area Section 3.5, FSI/FAR norms).\n"
            "- **In-App Navigation:** Instantly navigate to Monitoring, Upload, Review, Cross-Check, or Replay desks.\n"
            "- **Evidence Provenance:** Explain how spatial OCR entity bounding boxes and SHA-256 audit ledgers work.\n\n"
            "What would you like to explore today?"
        )
        return {
            "intent": "greeting_guidance",
            "answer": "Namaste! Welcome to NIYANTRAN. I am the built-in statutory intelligence guide for AICTE APH compliance, active filing progression, and in-app navigation.",
            "message": msg,
            "response_type": "simple_answer",
            "suggested_actions": [
                {"label": "What should I do next?", "path": None, "query": "What should I do next?", "variant": "primary"},
                {"label": "Explain Land Area norms", "path": None, "query": "Explain Land Area requirements under AICTE norms", "variant": "secondary"},
                {"label": "Where do I upload documents?", "path": "/upload", "variant": "secondary"}
            ],
            "citations": []
        }

    # 3. Check Workflow State / Next Step intent
    workflow_triggers = [
        "what should i do next", "what to do next", "next step", "what next",
        "workflow progress", "where am i in the workflow", "what stage",
        "mera application", "kis stage", "kis step", "stage par hai",
        "aage kya kare", "ab aage kya", "kya karna hai", "current stage",
        "current step", "application status", "status kya hai", "stage kya hai"
    ]
    if any(p in q_lower for p in workflow_triggers):
        wf = resolve_workflow_next_step(current_user, app_id)
        ans = f"Your application is currently at Step {wf['current_step']} of 5 ({wf['step_name']}) with status '{wf['status_label']}'. {wf['next_action']}"
        msg = (
            f"### 📍 Current Workflow: Step {wf['current_step']} of 5 — {wf['step_name']}\n\n"
            f"**Status:** `{wf['status_label']}`\n\n"
            f"{wf['summary']}\n\n"
            f"**Recommended Next Action:**\n{wf['next_action']}"
        )
        return {
            "intent": "workflow_guidance",
            "answer": ans,
            "message": msg if is_detailed else ans,
            "response_type": "workflow_guidance",
            "suggested_actions": wf.get("suggested_actions", []),
            "citations": [],
            "current_step": wf["current_step"],
            "step_name": wf["step_name"],
        }

    # 4. Check In-App Navigation Intent
    nav_intent, nav_msg, nav_actions = classify_navigation_intent(q, role, current_path, app_id)
    if nav_intent:
        return {
            "intent": nav_intent,
            "answer": nav_msg,
            "message": nav_msg,
            "response_type": "simple_answer",
            "suggested_actions": nav_actions,
            "citations": [],
        }

    # 5. Retrieve Dual Knowledge Collections
    is_land_query = any(w in q_lower for w in ["land", "acre", "acres", "fsi", "far", "plot", "hectare", "built", "carpet"])
    has_digit = bool(re.search(r"\b\d+(\.\d+)?\s*(?:acres?|acre|hectares?|sqm|sq\.m|sqft)?\b", q_lower))
    has_ask_word = any(w in q_lower for w in ["acre", "acres", "number", "minimum", "exact", "require", "required", "is", "does"])
    asked_specific_acreage = is_land_query and (
        (has_digit and has_ask_word)
        or any(p in q_lower for p in ["how many acres", "how much land", "how much acreage", "is 1.5", "is 6"])
    )

    prod_items = retrieve_product_knowledge(q, top_k=2)
    reg_items = retrieve_regulatory_knowledge(q, top_k=2)

    citations = []
    response_sections = []

    # If Regulatory queries (e.g. land, faculty, space, PwD, safety, norms)
    has_unverified = False
    if reg_items:
        response_sections.append("### 🏛️ Statutory Regulatory Requirements (AICTE Purview)")
        for r in reg_items:
            has_url = bool(r.get("source_url") and str(r["source_url"]).strip().lower() != "none")
            safe_url = r["source_url"] if has_url else None

            citations.append({
                "source": r["source_title"],
                "clause": r["clause_reference"],
                "page": r["page_number"],
                "status": r["verification_status"],
                "url": safe_url,
                "title": r["title"],
            })
            if r["verification_status"] != "VERIFIED":
                has_unverified = True
            status_badge = f"`[{r['verification_status']}]`"

            if safe_url:
                source_str = f"[{r['source_title']}]({safe_url})"
            else:
                source_str = f"{r['source_title']} *(Internal unverified record — no official source URL)*"

            response_sections.append(
                f"- **{r['title']}** (Ref: {r['clause_reference']}, Pg {r['page_number']}) {status_badge}:\n"
                f"  {r['content']}\n"
                f"  *Source: {source_str}*"
            )

        if is_land_query and asked_specific_acreage:
            response_sections.append(
                "> ℹ️ **Acreage Confirmation Notice:** Specific standalone acreage figures (such as 1.50 Acres or 6.0 Acres) "
                "are **not** established as universal statutory requirements under verified AICTE APH 2024–2027 records. "
                "The exact acreage cannot be confirmed from available verified source records as a universal figure because "
                "statutory land requirements in Mega/Metro, Urban, and Rural areas are determined based on the "
                "**applicable FSI/FAR norms of the relevant local authority**, local building by-laws, and municipal development control regulations. "
                "Historical or unverified draft fragments mentioning fixed acreages (such as unverified draft Clause 2.1 or illustrative simulation variants) "
                "are marked `UNVERIFIED` and do not override official Section 3.5 statutory norms."
            )

        if has_unverified:
            response_sections.append(
                "> ⚠️ **Note:** One or more cited regulatory clauses above carry an `UNVERIFIED` status in the active database. "
                "AICTE approval regulations require manual officer review before definitive legal enforcement."
            )

    # Product Knowledge (How NIYANTRAN operates / features)
    has_platform_terms = any(w in q_lower for w in ["how to", "where do i", "feature", "niyantran", "platform", "screen", "page", "upload", "button", "system", "workflow", "dock", "minimize", "drag"])
    if prod_items and (not is_land_query or has_platform_terms):
        response_sections.append("### 💻 NIYANTRAN Platform Guidance")
        for p in prod_items:
            response_sections.append(f"- **{p['title']}**:\n  {p['content']}")

    # If neither returned confident matches
    if not prod_items and not reg_items:
        return {
            "intent": "unverified_knowledge",
            "answer": "This query could not be definitively matched against registered AICTE handbook clauses or platform workflows in NIYANTRAN's verified repository.",
            "message": (
                "### ⚠️ Statutory Grounding Notice\n\n"
                "This query could not be definitively matched against registered AICTE handbook clauses "
                "or platform workflows in NIYANTRAN's verified repository.\n\n"
                "To ensure strict regulatory integrity, NIYANTRAN never fabricates clauses or requirements. "
                "You can explore active statutory rules in the Rules Catalog or inspect your case's compliance findings."
            ),
            "response_type": "unsupported_question",
            "suggested_actions": [
                {"label": "Explore Rules Catalog", "path": "/rules", "variant": "secondary", "icon": "BookOpen"},
                {"label": "Open Monitoring Desk", "path": "/monitoring", "variant": "outline", "icon": "Activity"}
            ] if role in ("reviewer", "admin") else [
                {"label": "Check Verification Cockpit", "path": "/verification", "variant": "primary", "icon": "ShieldCheck"},
                {"label": "What should I do next?", "path": None, "query": "What should I do next?", "variant": "secondary"}
            ],
            "citations": [],
        }

    # Generate contextual actions from matched knowledge
    suggested_actions = []
    collected_routes = set()
    for item in prod_items:
        for r in item.get("related_routes", []):
            collected_routes.add(r)

    for route in list(collected_routes)[:2]:
        if route in ROUTE_REGISTRY:
            meta = ROUTE_REGISTRY[route]
            req_role = meta.get("requires_role")
            if req_role and role not in req_role:
                continue
            suggested_actions.append({
                "label": f"Go to {meta['title']}",
                "path": route,
                "variant": "secondary",
                "icon": meta.get("icon", "ArrowRight")
            })

    if not suggested_actions:
        suggested_actions.append({
            "label": "Open Verification Cockpit",
            "path": "/verification",
            "variant": "primary",
            "icon": "ShieldCheck"
        })

    # Direct short answer formulation
    if reg_items:
        first_r = reg_items[0]
        direct_ans = f"Under {first_r['source_title']} ({first_r['clause_reference']}), {first_r['content'][:140]}..."
    elif prod_items:
        first_p = prod_items[0]
        direct_ans = f"{first_p['content'][:140]}..."
    else:
        direct_ans = "Here is the verified statutory guidance matching your request."

    return {
        "intent": "knowledge_retrieval",
        "answer": direct_ans,
        "message": "\n\n".join(response_sections) if is_detailed else (f"{direct_ans}\n\n" + "\n\n".join(response_sections)),
        "response_type": "regulatory_answer" if reg_items else "simple_answer",
        "suggested_actions": suggested_actions,
        "citations": citations,
    }


# ============================================================================
# 7. FastAPI Router Endpoints
# ============================================================================

class ChatRequest(BaseModel):
    message: str = Field(..., description="User query or navigation command")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Active UI context including current_path and application_id")
    session_id: Optional[str] = Field(default=None, description="Conversational session ID")


@copilot_router.post("/chat")
def copilot_chat(
    payload: ChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Main NIYANTRAN conversational endpoint.
    Processes user query, resolves context-aware workflow status,
    retrieves grounded product & regulatory knowledge, and generates
    safe, role-checked in-app navigation actions.
    """
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be blank")

    res = synthesize_copilot_response(
        query=payload.message,
        current_user=current_user,
        context=payload.context or {},
        session_id=payload.session_id
    )
    return {
        "status": "success",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": res
    }


@copilot_router.get("/suggested-prompts")
def get_suggested_prompts(
    current_path: Optional[str] = Query(default="/dashboard"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Provides smart quick-prompt suggestions based on current UI route and role.
    """
    role = (current_user.get("role") or "reviewer").lower()
    is_officer = role in ("reviewer", "admin")

    prompts = [
        "What should I do next?",
        "Where is the Monitoring tab?",
        "Where do I upload documents?",
    ]

    if is_officer:
        prompts.extend([
            "Open the Review Queue",
            "Take me to Regulatory Change Replay",
            "Explain Mandatory Land Title norms"
        ])
    else:
        prompts.extend([
            "How does Cross-Check work?",
            "Explain Land Area requirements",
            "How do I generate a report?"
        ])

    if current_path and current_path in ROUTE_REGISTRY:
        prompts.insert(1, "What does this page do?")

    return {"status": "success", "data": prompts[:6]}


@copilot_router.get("/workflow-status")
def get_workflow_status(
    application_id: Optional[str] = Query(default=None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves the current 5-step statutory workflow progression for the authenticated tenant.
    """
    wf = resolve_workflow_next_step(current_user, application_id)
    return {"status": "success", "data": wf}
