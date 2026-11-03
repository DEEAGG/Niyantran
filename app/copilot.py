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
# 6. Response Synthesis & RAG Formatter
# ============================================================================

def synthesize_copilot_response(
    query: str,
    current_user: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Main NIYANTRAN Assistant reasoning pipeline:
    1. Check for greetings or system capability questions
    2. Check for workflow status inquiries ("What should I do next?")
    3. Check for navigational intents ("Take me to Replay", "Where is Monitoring?")
    4. Retrieve grounded product & regulatory knowledge
    5. Return evidence-grounded response with citations & real navigation buttons.
    """
    q = query.strip()
    q_lower = q.lower()
    user_id = current_user.get("user_id")
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

    # 1. Greetings & System Capability queries
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
            "message": msg,
            "suggested_actions": [
                {"label": "What should I do next?", "path": None, "query": "What should I do next?", "variant": "primary"},
                {"label": "Explain Land Area norms", "path": None, "query": "Explain Land Area requirements under AICTE norms", "variant": "secondary"},
                {"label": "Where do I upload documents?", "path": "/upload", "variant": "secondary"}
            ],
            "citations": []
        }

    # 2. Check Workflow State / Next Step intent
    workflow_triggers = [
        "what should i do next", "what to do next", "next step", "what next",
        "workflow progress", "where am i in the workflow", "what stage",
        "mera application", "kis stage", "kis step", "stage par hai",
        "aage kya kare", "ab aage kya", "kya karna hai", "current stage",
        "current step", "application status", "status kya hai", "stage kya hai"
    ]
    if any(p in q_lower for p in workflow_triggers):
        wf = resolve_workflow_next_step(current_user, app_id)
        msg = (
            f"### 📍 Current Workflow: Step {wf['current_step']} of 5 — {wf['step_name']}\n\n"
            f"**Status:** `{wf['status_label']}`\n\n"
            f"{wf['summary']}\n\n"
            f"**Recommended Next Action:**\n{wf['next_action']}"
        )
        return {
            "intent": "workflow_guidance",
            "message": msg,
            "suggested_actions": wf.get("suggested_actions", []),
            "citations": [],
            "current_step": wf["current_step"],
            "step_name": wf["step_name"],
        }

    # 3. Check In-App Navigation Intent
    nav_intent, nav_msg, nav_actions = classify_navigation_intent(q, role, current_path, app_id)
    if nav_intent:
        return {
            "intent": nav_intent,
            "message": nav_msg,
            "suggested_actions": nav_actions,
            "citations": [],
        }

    # 4. Retrieve Dual Knowledge Collections
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
            "message": (
                "### ⚠️ Statutory Grounding Notice\n\n"
                "This query could not be definitively matched against registered AICTE handbook clauses "
                "or platform workflows in NIYANTRAN's verified repository.\n\n"
                "To ensure strict regulatory integrity, NIYANTRAN never fabricates clauses or requirements. "
                "You can explore active statutory rules in the Rules Catalog or inspect your case's compliance findings."
            ),
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

    return {
        "intent": "knowledge_retrieval",
        "message": "\n\n".join(response_sections),
        "suggested_actions": suggested_actions,
        "citations": citations,
    }


# ============================================================================
# 7. FastAPI Router Endpoints
# ============================================================================

class ChatRequest(BaseModel):
    message: str = Field(..., description="User query or navigation command")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Active UI context including current_path and application_id")


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
        context=payload.context or {}
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
