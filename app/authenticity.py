import hashlib
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

from PIL import Image
import pymupdf as fitz

from app.db import DOCUMENTS_DIR, add_audit_entry

SUSPICIOUS_PRODUCERS = [
    "ilovepdf",
    "smallpdf",
    "sejda",
    "pdfedit",
    "photoshop",
    "canva",
    "gimp",
    "nitro",
    "foxit phantom",
]


def compute_file_hash_signal(file_path: Path, expected_sha256: str) -> Dict[str, Any]:
    if not file_path.exists():
        return {
            "signal_type": "file_hash",
            "result": "warning",
            "details": {
                "algorithm": "SHA-256",
                "error": "Physical document file missing from disk",
                "intact": False,
                "disclaimer": "Cryptographic checksum confirms post-upload file integrity; it does not verify origin or legal authenticity of the document.",
            },
        }

    content = file_path.read_bytes()
    actual_hash = hashlib.sha256(content).hexdigest()
    intact = (actual_hash.lower() == expected_sha256.lower())

    return {
        "signal_type": "file_hash",
        "result": "ok" if intact else "warning",
        "details": {
            "algorithm": "SHA-256",
            "stored_sha256": expected_sha256,
            "computed_sha256": actual_hash,
            "intact": intact,
            "disclaimer": "Cryptographic checksum confirms post-upload file integrity; it does not verify origin or legal authenticity of the document.",
        },
    }


def compute_duplicate_signal(conn, document_id: str, sha256: str, application_id: str) -> Dict[str, Any]:
    rows = conn.execute(
        """
        SELECT id, application_id, original_filename, document_type, uploaded_at
        FROM documents
        WHERE sha256 = ? AND id != ?
        """,
        (sha256, document_id),
    ).fetchall()

    matches = [dict(r) for r in rows]
    cross_app = [m for m in matches if m["application_id"] != application_id]
    same_app = [m for m in matches if m["application_id"] == application_id]

    if cross_app:
        result = "warning"
        note = f"Identical file SHA-256 detected in {len(cross_app)} other application(s)."
    elif same_app:
        result = "notice"
        note = f"Duplicate upload detected within the same application ({len(same_app)} duplicate file(s))."
    else:
        result = "ok"
        note = "File is unique within the document repository."

    return {
        "signal_type": "duplicate_check",
        "result": result,
        "details": {
            "duplicate_detected": len(matches) > 0,
            "total_duplicates": len(matches),
            "cross_application_duplicates": len(cross_app),
            "same_application_duplicates": len(same_app),
            "matches": matches,
            "note": note,
            "disclaimer": "Duplicate detection flags shared files across applications; duplicate files may represent valid shared documentation or potential submission reuse requiring reviewer verification.",
        },
    }


def compute_metadata_anomaly_signal(file_path: Path) -> Dict[str, Any]:
    ext = file_path.suffix.lower()
    if ext != ".pdf":
        return {
            "signal_type": "metadata_anomaly",
            "result": "ok",
            "details": {
                "file_type": ext,
                "anomalies_detected": [],
                "disclaimer": "Raster images do not possess standard PDF document metadata dictionaries.",
            },
        }

    try:
        doc = fitz.open(file_path)
    except Exception as exc:
        return {
            "signal_type": "metadata_anomaly",
            "result": "warning",
            "details": {
                "error": f"Could not parse PDF metadata: {exc}",
                "anomalies_detected": ["unreadable_metadata"],
                "disclaimer": "Metadata inspection failed due to document format errors.",
            },
        }

    anomalies = []
    meta = doc.metadata or {}
    doc.close()

    producer = (meta.get("producer") or "").lower()
    creator = (meta.get("creator") or "").lower()
    creation_date = meta.get("creationDate") or ""
    mod_date = meta.get("modDate") or ""

    # Check for known online/virtual PDF tools
    for sp in SUSPICIOUS_PRODUCERS:
        if sp in producer or sp in creator:
            anomalies.append(f"Document produced or modified using generic editing utility: '{sp}'")

    # Check date timeline anomaly
    if creation_date and mod_date:
        c_clean = re.sub(r"[^\d]", "", creation_date)[:14]
        m_clean = re.sub(r"[^\d]", "", mod_date)[:14]
        if c_clean and m_clean and len(c_clean) >= 8 and len(m_clean) >= 8:
            if m_clean < c_clean:
                anomalies.append("Modification timestamp is chronologically earlier than creation timestamp")
    elif mod_date and not creation_date:
        anomalies.append("Document has modification timestamp but creation timestamp is missing")

    result = "notice" if anomalies else "ok"

    return {
        "signal_type": "metadata_anomaly",
        "result": result,
        "details": {
            "metadata": {
                "format": meta.get("format"),
                "creator": meta.get("creator"),
                "producer": meta.get("producer"),
                "creationDate": meta.get("creationDate"),
                "modDate": meta.get("modDate"),
            },
            "anomalies_detected": anomalies,
            "has_anomalies": len(anomalies) > 0,
            "disclaimer": "Metadata flags potential digital manipulation or post-processing; absence of anomalies does not guarantee authenticity.",
        },
    }


def compute_digital_signature_signal(file_path: Path) -> Dict[str, Any]:
    ext = file_path.suffix.lower()
    if ext != ".pdf":
        return {
            "signal_type": "digital_signature",
            "result": "not_available",
            "details": {
                "signatures_count": 0,
                "disclaimer": "Raster image documents do not support cryptographic signature structures.",
            },
        }

    try:
        doc = fitz.open(file_path)
    except Exception:
        return {
            "signal_type": "digital_signature",
            "result": "not_available",
            "details": {
                "signatures_count": 0,
                "disclaimer": "Could not inspect document for digital signatures.",
            },
        }

    signatures = []
    try:
        for page_idx, page in enumerate(doc, start=1):
            for widget in page.widgets():
                if widget.field_type == fitz.PDF_WIDGET_TYPE_SIGNATURE or getattr(widget, "is_signed", False):
                    signatures.append({
                        "field_name": widget.field_name,
                        "page_number": page_idx,
                        "rect": list(widget.rect),
                    })
    finally:
        doc.close()

    if signatures:
        return {
            "signal_type": "digital_signature",
            "result": "present_unverified",
            "details": {
                "signatures_count": len(signatures),
                "signatures": signatures,
                "signer_identity_verified": False,
                "trust_anchor": "None configured (local prototype)",
                "disclaimer": "Digital signature structure detected, but signer certificate cannot be authenticated without an authorized Root CA trust store.",
            },
        }
    else:
        return {
            "signal_type": "digital_signature",
            "result": "not_available",
            "details": {
                "signatures_count": 0,
                "disclaimer": "No digital signature widget detected in PDF document.",
            },
        }


def evaluate_document_authenticity(conn, document_id: str) -> List[Dict[str, Any]]:
    doc = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
    if not doc:
        raise ValueError(f"Document {document_id} not found")

    filename = Path(doc["stored_path"]).name
    file_path = DOCUMENTS_DIR / filename
    expected_sha256 = doc["sha256"]
    application_id = doc["application_id"]

    signals = [
        compute_file_hash_signal(file_path, expected_sha256),
        compute_duplicate_signal(conn, document_id, expected_sha256, application_id),
        compute_metadata_anomaly_signal(file_path),
        compute_digital_signature_signal(file_path),
    ]

    # Delete existing signals for this document to refresh
    conn.execute("DELETE FROM authenticity_signals WHERE document_id = ?", (document_id,))

    now = datetime.now(timezone.utc).isoformat()
    saved_records = []

    for s in signals:
        sig_id = f"SIG-{uuid.uuid4().hex[:12].upper()}"
        details_json = json.dumps(s["details"])
        conn.execute(
            """
            INSERT INTO authenticity_signals (id, document_id, signal_type, result, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (sig_id, document_id, s["signal_type"], s["result"], details_json, now),
        )
        saved_records.append({
            "id": sig_id,
            "document_id": document_id,
            "signal_type": s["signal_type"],
            "result": s["result"],
            "details": s["details"],
            "created_at": now,
        })

    return saved_records
