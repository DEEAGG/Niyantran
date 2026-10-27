import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from difflib import SequenceMatcher

FIELD_UNITS_TO_ACRES = {
    "acre": 1.0,
    "acres": 1.0,
    "hectare": 2.47105,
    "hectares": 2.47105,
    "ha": 2.47105,
    "sqm": 0.000247105,
    "sq m": 0.000247105,
    "square meters": 0.000247105,
    "sqft": 0.0000229568,
    "sq ft": 0.0000229568,
    "square feet": 0.0000229568,
}

FIELD_UNITS_TO_SQM = {
    "sqm": 1.0,
    "sq m": 1.0,
    "square meters": 1.0,
    "acre": 4046.86,
    "acres": 4046.86,
    "hectare": 10000.0,
    "hectares": 10000.0,
    "ha": 10000.0,
    "sqft": 0.092903,
    "sq ft": 0.092903,
    "square feet": 0.092903,
}


def compute_fingerprint(application_id: str, rule_key: str, subject: str) -> str:
    canonical = f"{application_id}|{rule_key}|{subject}"
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()


def string_similarity(s1: str, s2: str) -> float:
    c1 = re.sub(r"[^\w\s]", "", s1.lower()).strip()
    c2 = re.sub(r"[^\w\s]", "", s2.lower()).strip()
    return SequenceMatcher(None, c1, c2).ratio()


def token_set_overlap(s1: str, s2: str) -> float:
    t1 = set(re.findall(r"\w+", s1.lower()))
    t2 = set(re.findall(r"\w+", s2.lower()))
    if not t1 and not t2:
        return 1.0
    if not t1 or not t2:
        return 0.0
    intersection = t1 & t2
    union = t1 | t2
    return len(intersection) / len(union)


def parse_numeric_with_unit(text: Optional[str]) -> Tuple[Optional[float], Optional[str]]:
    if not text:
        return None, None
    clean = text.strip()
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z\.\s]+)?", clean)
    if not match:
        return None, None
    val_str, unit_str = match.groups()
    try:
        val = float(val_str)
    except ValueError:
        return None, None
    unit = unit_str.strip().lower() if unit_str else "units"
    return val, unit


def convert_area(value: float, from_unit: str, to_unit: str) -> Optional[float]:
    f_clean = from_unit.strip().lower().replace(".", "")
    t_clean = to_unit.strip().lower().replace(".", "")

    if "acre" in f_clean and "acre" in t_clean:
        return value
    if "sqm" in f_clean and "sqm" in t_clean:
        return value
    if "sqft" in f_clean and "sqft" in t_clean:
        return value

    if "acre" in t_clean:
        # Convert to Acres
        for k, factor in FIELD_UNITS_TO_ACRES.items():
            if k in f_clean:
                return value * factor
        return value
    elif "sqm" in t_clean:
        # Convert to SQM
        for k, factor in FIELD_UNITS_TO_SQM.items():
            if k in f_clean:
                return value * factor
        return value
    return value


def evaluate_required_document(rule: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    params = rule.get("parameters", {})
    expected_doc_type = params.get("doc_type")
    application_id = ctx["application"]["id"]
    subject = f"doc:{expected_doc_type}"
    rule_key = rule["rule_key"]
    fingerprint = compute_fingerprint(application_id, rule_key, subject)

    matching_docs = [d for d in ctx["documents"] if d.get("document_type") == expected_doc_type]
    uploaded_types = [d.get("document_type") for d in ctx["documents"]]

    if matching_docs:
        doc = matching_docs[0]
        return {
            "rule_id": rule["id"],
            "code": "REQUIRED_DOCUMENT_PRESENT",
            "severity": rule.get("severity", "high"),
            "status": "pass",
            "subject": subject,
            "message": f"Required document '{expected_doc_type}' is present in application.",
            "recommendation": "No action needed.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "document_id": doc["id"],
                "document_type": expected_doc_type,
                "filename": doc.get("original_filename"),
                "values": [{"document_id": doc["id"], "doc_type": expected_doc_type, "status": "uploaded"}],
                "not_verified": [],
            },
        }
    else:
        return {
            "rule_id": rule["id"],
            "code": "MISSING_DOCUMENT",
            "severity": rule.get("severity", "high"),
            "status": "fail",
            "subject": subject,
            "message": f"Mandatory document '{expected_doc_type}' is missing from the application.",
            "recommendation": f"Upload the required '{expected_doc_type}' document.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "expected_document_type": expected_doc_type,
                "uploaded_document_types": uploaded_types,
                "values": [],
                "not_verified": [f"Document '{expected_doc_type}' not uploaded"],
            },
        }


def evaluate_required_field(rule: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    params = rule.get("parameters", {})
    field_key = params.get("field_key")
    doc_type = params.get("doc_type")
    application_id = ctx["application"]["id"]
    subject = f"field:{field_key}" + (f":{doc_type}" if doc_type else "")
    rule_key = rule["rule_key"]
    fingerprint = compute_fingerprint(application_id, rule_key, subject)

    if doc_type:
        matching_docs = [d for d in ctx["documents"] if d.get("document_type") == doc_type]
        if not matching_docs:
            return {
                "rule_id": rule["id"],
                "code": "MISSING_EVIDENCE",
                "severity": rule.get("severity", "medium"),
                "status": "unverified",
                "subject": subject,
                "message": f"Document '{doc_type}' is not uploaded; required field '{field_key}' cannot be verified.",
                "recommendation": f"Upload '{doc_type}' document to verify field '{field_key}'.",
                "evidence": {
                    "fingerprint": fingerprint,
                    "rule_key": rule_key,
                    "subject": subject,
                    "values": [],
                    "not_verified": [f"Document '{doc_type}' missing"],
                },
            }

    # Search in extracted fields
    candidate_fields = [
        f for f in ctx["fields"]
        if f.get("field_name") == field_key and (not doc_type or f.get("document_type") == doc_type)
    ]

    if not candidate_fields:
        return {
            "rule_id": rule["id"],
            "code": "FIELD_NOT_EXTRACTED",
            "severity": rule.get("severity", "medium"),
            "status": "unverified",
            "subject": subject,
            "message": f"Required field '{field_key}' could not be extracted or verified from uploaded documents.",
            "recommendation": f"Confirm or manually enter '{field_key}' from the original document.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "values": [],
                "not_verified": [f"Field '{field_key}' not detected in extraction"],
            },
        }

    field = candidate_fields[0]
    val = field.get("normalized_value") or field.get("field_value")
    return {
        "rule_id": rule["id"],
        "code": "REQUIRED_FIELD_PRESENT",
        "severity": rule.get("severity", "medium"),
        "status": "pass",
        "subject": subject,
        "message": f"Required field '{field_key}' is present with value '{val}'.",
        "recommendation": "No action needed.",
        "evidence": {
            "fingerprint": fingerprint,
            "rule_key": rule_key,
            "subject": subject,
            "values": [{
                "document_id": field.get("document_id"),
                "doc_type": field.get("document_type"),
                "field_name": field_key,
                "value": val,
                "confidence": field.get("confidence"),
                "page_number": field.get("page_number"),
                "bbox": field.get("bbox"),
            }],
            "not_verified": [],
        },
    }


def evaluate_format_regex(rule: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    params = rule.get("parameters", {})
    field_key = params.get("field_key")
    pattern = params.get("pattern", r"^.+$")
    doc_type = params.get("doc_type")
    application_id = ctx["application"]["id"]
    subject = f"regex:{field_key}"
    rule_key = rule["rule_key"]
    fingerprint = compute_fingerprint(application_id, rule_key, subject)

    candidate_fields = [
        f for f in ctx["fields"]
        if f.get("field_name") == field_key and (not doc_type or f.get("document_type") == doc_type)
    ]

    if not candidate_fields:
        return {
            "rule_id": rule["id"],
            "code": "MISSING_EVIDENCE",
            "severity": rule.get("severity", "medium"),
            "status": "unverified",
            "subject": subject,
            "message": f"Field '{field_key}' not available to validate format.",
            "recommendation": f"Ensure '{field_key}' is present in the uploaded documents.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "values": [],
                "not_verified": [f"Field '{field_key}' not extracted"],
            },
        }

    field = candidate_fields[0]
    raw_val = field.get("field_value") or ""
    norm_val = field.get("normalized_value") or raw_val

    is_match = bool(re.search(pattern, norm_val) or re.search(pattern, raw_val))
    if is_match:
        return {
            "rule_id": rule["id"],
            "code": "FORMAT_VALID",
            "severity": rule.get("severity", "medium"),
            "status": "pass",
            "subject": subject,
            "message": f"Field '{field_key}' value '{norm_val}' matches required format.",
            "recommendation": "No action needed.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "pattern": pattern,
                "values": [{
                    "document_id": field.get("document_id"),
                    "field_name": field_key,
                    "value": norm_val,
                    "confidence": field.get("confidence"),
                    "page_number": field.get("page_number"),
                }],
                "not_verified": [],
            },
        }
    else:
        return {
            "rule_id": rule["id"],
            "code": "FORMAT_MISMATCH",
            "severity": rule.get("severity", "medium"),
            "status": "fail",
            "subject": subject,
            "message": f"Field '{field_key}' value '{norm_val}' does not match expected format pattern '{pattern}'.",
            "recommendation": "Check and correct the field format against official guidelines.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "pattern": pattern,
                "values": [{
                    "document_id": field.get("document_id"),
                    "field_name": field_key,
                    "value": norm_val,
                    "confidence": field.get("confidence"),
                    "page_number": field.get("page_number"),
                }],
                "not_verified": [],
            },
        }


def evaluate_date_not_expired(rule: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    params = rule.get("parameters", {})
    field_key = params.get("field_key", "expiry_date")
    doc_type = params.get("doc_type")
    application_id = ctx["application"]["id"]
    subject = f"expiry:{field_key}"
    rule_key = rule["rule_key"]
    fingerprint = compute_fingerprint(application_id, rule_key, subject)

    candidate_fields = [
        f for f in ctx["fields"]
        if f.get("field_name") == field_key and (not doc_type or f.get("document_type") == doc_type)
    ]

    if not candidate_fields:
        return {
            "rule_id": rule["id"],
            "code": "MISSING_EVIDENCE",
            "severity": rule.get("severity", "high"),
            "status": "unverified",
            "subject": subject,
            "message": f"Expiry date field '{field_key}' not available to verify validity.",
            "recommendation": "Provide document containing explicit expiry or validity date.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "values": [],
                "not_verified": [f"Field '{field_key}' not extracted"],
            },
        }

    ref_date = datetime.now(timezone.utc).date()
    expired_fields = []
    unparseable_fields = []
    active_fields = []

    for field in candidate_fields:
        val_str = field.get("normalized_value") or field.get("field_value") or ""
        parsed_date = None
        try:
            parsed_date = datetime.strptime(val_str[:10], "%Y-%m-%d").date()
        except Exception:
            pass

        if not parsed_date:
            unparseable_fields.append((field, val_str))
        elif parsed_date < ref_date:
            expired_fields.append((field, val_str, parsed_date))
        else:
            active_fields.append((field, val_str, parsed_date))

    if expired_fields:
        f, val_str, p_date = expired_fields[0]
        return {
            "rule_id": rule["id"],
            "code": "DOCUMENT_EXPIRED",
            "severity": rule.get("severity", "high"),
            "status": "fail",
            "subject": subject,
            "message": f"Document validity has expired on {p_date.isoformat()} (reference date: {ref_date.isoformat()}).",
            "recommendation": "Obtain renewed certificate or extension of approval.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "expiry_date": p_date.isoformat(),
                "reference_date": ref_date.isoformat(),
                "values": [
                    {
                        "document_id": ef[0].get("document_id"),
                        "doc_type": ef[0].get("document_type"),
                        "field_name": field_key,
                        "value": ef[1],
                        "page_number": ef[0].get("page_number"),
                    }
                    for ef in expired_fields
                ],
                "not_verified": [],
            },
        }
    elif unparseable_fields and not active_fields:
        f, val_str = unparseable_fields[0]
        return {
            "rule_id": rule["id"],
            "code": "UNPARSEABLE_DATE",
            "severity": rule.get("severity", "high"),
            "status": "unverified",
            "subject": subject,
            "message": f"Expiry date value '{val_str}' could not be parsed; validity cannot be verified.",
            "recommendation": "Manual verification required for document expiry date.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "values": [{"document_id": f.get("document_id"), "field_name": field_key, "value": val_str}],
                "not_verified": [f"Unparseable date: '{val_str}'"],
            },
        }
    else:
        f, val_str, p_date = active_fields[0]
        return {
            "rule_id": rule["id"],
            "code": "DOCUMENT_ACTIVE",
            "severity": rule.get("severity", "high"),
            "status": "pass",
            "subject": subject,
            "message": f"Document validity is active until {p_date.isoformat()}.",
            "recommendation": "No action needed.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "expiry_date": p_date.isoformat(),
                "reference_date": ref_date.isoformat(),
                "values": [
                    {
                        "document_id": af[0].get("document_id"),
                        "doc_type": af[0].get("document_type"),
                        "field_name": field_key,
                        "value": af[1],
                        "page_number": af[0].get("page_number"),
                    }
                    for af in active_fields
                ],
                "not_verified": [],
            },
        }


def evaluate_numeric_threshold(rule: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    params = rule.get("parameters", {})
    field_key = params.get("field_key", "land_area")
    operator = params.get("operator", "gte").lower()
    threshold = float(params.get("value", 5.0))
    expected_unit = params.get("unit", "Acres")
    doc_type = params.get("doc_type")
    application_id = ctx["application"]["id"]
    subject = f"threshold:{field_key}"
    rule_key = rule["rule_key"]
    fingerprint = compute_fingerprint(application_id, rule_key, subject)

    candidate_fields = [
        f for f in ctx["fields"]
        if f.get("field_name") == field_key and (not doc_type or f.get("document_type") == doc_type)
    ]

    if not candidate_fields:
        return {
            "rule_id": rule["id"],
            "code": "MISSING_EVIDENCE",
            "severity": rule.get("severity", "high"),
            "status": "unverified",
            "subject": subject,
            "message": f"Field '{field_key}' not available for threshold check.",
            "recommendation": f"Provide document confirming '{field_key}'.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "values": [],
                "not_verified": [f"Field '{field_key}' not extracted"],
            },
        }

    ops = {
        "gte": lambda a, b: a >= b,
        "gt": lambda a, b: a > b,
        "lte": lambda a, b: a <= b,
        "lt": lambda a, b: a < b,
        "eq": lambda a, b: abs(a - b) < 0.01,
    }
    op_func = ops.get(operator, lambda a, b: a >= b)

    failing_fields = []
    passing_fields = []
    unparseable_fields = []

    for field in candidate_fields:
        val_str = field.get("normalized_value") or field.get("field_value") or ""
        actual_num, doc_unit = parse_numeric_with_unit(val_str)
        if actual_num is None:
            unparseable_fields.append((field, val_str))
            continue
        converted_val = convert_area(actual_num, doc_unit or expected_unit, expected_unit)
        if op_func(converted_val, threshold):
            passing_fields.append((field, val_str, actual_num, doc_unit, converted_val))
        else:
            failing_fields.append((field, val_str, actual_num, doc_unit, converted_val))

    if failing_fields:
        f, val_str, actual_num, doc_unit, conv_val = failing_fields[0]
        return {
            "rule_id": rule["id"],
            "code": "THRESHOLD_NOT_MET",
            "severity": rule.get("severity", "high"),
            "status": "fail",
            "subject": subject,
            "message": f"{field_key.replace('_', ' ').title()} {actual_num} {doc_unit} does not satisfy requirement: {operator} {threshold} {expected_unit}.",
            "recommendation": f"Ensure compliance with the minimum required threshold of {threshold} {expected_unit}.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "operator": operator,
                "threshold": threshold,
                "unit": expected_unit,
                "actual_value": actual_num,
                "converted_value": conv_val,
                "values": [{
                    "document_id": f.get("document_id"),
                    "doc_type": f.get("document_type"),
                    "field_name": field_key,
                    "value": val_str,
                    "page_number": f.get("page_number"),
                }],
                "not_verified": [],
            },
        }
    elif passing_fields:
        f, val_str, actual_num, doc_unit, conv_val = passing_fields[0]
        return {
            "rule_id": rule["id"],
            "code": "THRESHOLD_MET",
            "severity": rule.get("severity", "high"),
            "status": "pass",
            "subject": subject,
            "message": f"{field_key.replace('_', ' ').title()} {actual_num} {doc_unit} meets requirement ({operator} {threshold} {expected_unit}).",
            "recommendation": "No action needed.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "operator": operator,
                "threshold": threshold,
                "unit": expected_unit,
                "actual_value": actual_num,
                "converted_value": conv_val,
                "values": [{
                    "document_id": f.get("document_id"),
                    "doc_type": f.get("document_type"),
                    "field_name": field_key,
                    "value": val_str,
                    "page_number": f.get("page_number"),
                }],
                "not_verified": [],
            },
        }
    else:
        f, val_str = unparseable_fields[0]
        return {
            "rule_id": rule["id"],
            "code": "UNPARSEABLE_NUMERIC",
            "severity": rule.get("severity", "high"),
            "status": "unverified",
            "subject": subject,
            "message": f"Value '{val_str}' could not be parsed as a numeric measurement.",
            "recommendation": "Manual verification required for threshold validation.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "values": [{"document_id": f.get("document_id"), "field_name": field_key, "value": val_str}],
                "not_verified": [f"Unparseable numeric value: '{val_str}'"],
            },
        }


def evaluate_cross_doc_match(rule: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    params = rule.get("parameters", {})
    field_key = params.get("field_key", "registration_number")
    match_type = params.get("match_type", "identifier").lower()
    threshold = float(params.get("threshold", 0.85))
    application_id = ctx["application"]["id"]
    subject = f"cross_match:{field_key}"
    rule_key = rule["rule_key"]
    fingerprint = compute_fingerprint(application_id, rule_key, subject)

    matching_fields = [f for f in ctx["fields"] if f.get("field_name") == field_key]
    distinct_docs = {f.get("document_id"): f for f in matching_fields}

    # Rule 4: Missing or unverified fields must produce UNVERIFIED results, not false mismatches.
    if len(distinct_docs) < 2:
        return {
            "rule_id": rule["id"],
            "code": "INSUFFICIENT_EVIDENCE",
            "severity": rule.get("severity", "high"),
            "status": "unverified",
            "subject": subject,
            "message": f"Field '{field_key}' is present in only {len(distinct_docs)} document(s); cross-document comparison requires at least 2 documents.",
            "recommendation": f"Upload corresponding documents containing '{field_key}' to enable cross-document verification.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "values": [
                    {
                        "document_id": f.get("document_id"),
                        "doc_type": f.get("document_type"),
                        "field_name": field_key,
                        "value": f.get("field_value"),
                    }
                    for f in distinct_docs.values()
                ],
                "not_verified": ["At least 2 documents required for cross-comparison"],
            },
        }

    fields_list = list(distinct_docs.values())
    primary_field = fields_list[0]
    p_val = primary_field.get("normalized_value") or primary_field.get("field_value") or ""

    mismatches = []
    comparisons = []

    for other_field in fields_list[1:]:
        o_val = other_field.get("normalized_value") or other_field.get("field_value") or ""

        if match_type == "identifier":
            # Strip punctuation and spaces
            c1 = re.sub(r"[\s\-_/]", "", p_val).upper()
            c2 = re.sub(r"[\s\-_/]", "", o_val).upper()
            is_match = (c1 == c2)
            score = 1.0 if is_match else 0.0
        elif match_type == "name":
            score = string_similarity(p_val, o_val)
            is_match = (score >= threshold)
        elif match_type == "address":
            score = token_set_overlap(p_val, o_val)
            is_match = (score >= threshold)
        else:
            is_match = (p_val.strip().lower() == o_val.strip().lower())
            score = 1.0 if is_match else 0.0

        comparisons.append({
            "doc1_id": primary_field.get("document_id"),
            "val1": p_val,
            "doc2_id": other_field.get("document_id"),
            "val2": o_val,
            "score": round(score, 2),
            "match": is_match,
        })

        if not is_match:
            mismatches.append(f"{primary_field.get('document_id')} ('{p_val}') vs {other_field.get('document_id')} ('{o_val}')")

    if not mismatches:
        return {
            "rule_id": rule["id"],
            "code": "CROSS_DOC_MATCH",
            "severity": rule.get("severity", "high"),
            "status": "pass",
            "subject": subject,
            "message": f"Field '{field_key}' matches consistently across all {len(distinct_docs)} uploaded documents.",
            "recommendation": "No action needed.",
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "comparisons": comparisons,
                "values": [
                    {
                        "document_id": f.get("document_id"),
                        "doc_type": f.get("document_type"),
                        "field_name": field_key,
                        "value": f.get("field_value"),
                        "normalized_value": f.get("normalized_value"),
                    }
                    for f in fields_list
                ],
                "not_verified": [],
            },
        }
    else:
        # If name variation is between 0.70 and threshold, use low severity
        severity = rule.get("severity", "high")
        if match_type == "name" and any(0.70 <= c["score"] < threshold for c in comparisons):
            severity = "low"
            code = "NAME_VARIATION_DETECTED"
            msg = f"Possible name variation for '{field_key}' across documents: {'; '.join(mismatches)}."
            rec = "Reviewer verification recommended to confirm recognized entity name variation."
        else:
            code = "CROSS_DOC_MISMATCH"
            msg = f"Cross-document mismatch detected for '{field_key}' across documents: {'; '.join(mismatches)}."
            rec = "Verify original records and reconcile conflicting values across documents."

        return {
            "rule_id": rule["id"],
            "code": code,
            "severity": severity,
            "status": "fail",
            "subject": subject,
            "message": msg,
            "recommendation": rec,
            "evidence": {
                "fingerprint": fingerprint,
                "rule_key": rule_key,
                "subject": subject,
                "comparisons": comparisons,
                "values": [
                    {
                        "document_id": f.get("document_id"),
                        "doc_type": f.get("document_type"),
                        "field_name": field_key,
                        "value": f.get("field_value"),
                        "normalized_value": f.get("normalized_value"),
                    }
                    for f in fields_list
                ],
                "not_verified": [],
            },
        }


HANDLERS = {
    "required_document": evaluate_required_document,
    "required_field": evaluate_required_field,
    "format_regex": evaluate_format_regex,
    "date_not_expired": evaluate_date_not_expired,
    "numeric_threshold": evaluate_numeric_threshold,
    "cross_doc_match": evaluate_cross_doc_match,
}


def evaluate_ruleset(application: Dict[str, Any], rules: List[Dict[str, Any]], ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    findings = []
    app_type = application.get("application_type")

    for rule in rules:
        if not rule.get("enabled", 1):
            continue
        rule_app_type = rule.get("application_type")
        if rule_app_type and rule_app_type != app_type:
            continue

        rtype = rule.get("rule_type")
        handler = HANDLERS.get(rtype)
        if handler:
            finding = handler(rule, ctx)
            
            # Regulatory Applicability & Supersession Guard
            # Prevent superseded requirements from being silently enforced as current violations
            is_superseded = rule.get("is_superseded") or rule.get("source_status") == "SUPERSEDED"
            if is_superseded and finding.get("status") == "fail":
                finding["status"] = "unverified"
                finding["code"] = "SUPERSEDED_REQUIREMENT_REVIEW_REQUIRED"
                finding["severity"] = "medium"
                finding["message"] = (
                    f"Statutory requirement '{rule.get('title')}' is subject to subsequent amendment / supersession. "
                    "Exemptions or alternative compliance paths must be verified before treating as a violation."
                )
                finding["recommendation"] = "Verify applicability of recent Corrigendum/Addendum amendments with regulatory officer."
                if "evidence" in finding and isinstance(finding["evidence"], dict):
                    finding["evidence"]["is_superseded"] = True
                    finding["evidence"]["supersession_note"] = "Rule requirement superseded by newer regulatory instrument."

            findings.append(finding)
    return findings


# ============================================================
# Statutory Baseline Rules & Rulesets (AICTE APH 2024-2027)
# ============================================================

STATUTORY_BASELINE_RULES = [
    {
        "rule_key": "R-REQ-DOC-LAND",
        "version": 1,
        "title": "Mandatory Land Title & Ownership Document",
        "description": "Valid registered sale deed, government lease deed (min 30 years), or land ownership certificate in the name of the sponsoring body is mandatory.",
        "rule_type": "required_document",
        "severity": "high",
        "parameters": {"doc_type": "land_document"},
        "clause_ref": "Chapter V Clause 4.1",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter V Clause 4.1 - Land ownership must be clear, unencumbered, and legally registered.",
    },
    {
        "rule_key": "R-REQ-DOC-REG",
        "version": 1,
        "title": "Mandatory Sponsoring Body Registration",
        "description": "Official registration certificate of Society, Public Trust, or Section 8 company under relevant Central/State Acts is mandatory.",
        "rule_type": "required_document",
        "severity": "high",
        "parameters": {"doc_type": "registration_certificate"},
        "clause_ref": "Chapter I Clause 1.1",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter I Clause 1.1 - Valid registration of promoting body is a prerequisite.",
    },
    {
        "rule_key": "R-REQ-DOC-AFFIL",
        "version": 1,
        "title": "Mandatory Affiliating University Order",
        "description": "Official affiliation or intent of affiliation order from the designated State or Central technical university is mandatory.",
        "rule_type": "required_document",
        "severity": "high",
        "parameters": {"doc_type": "affiliation_document"},
        "clause_ref": "Chapter I Clause 1.4",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter I Clause 1.4 - Technical programs must have recognized affiliating university approval.",
    },
    {
        "rule_key": "R-REQ-FIELD-ADDR",
        "version": 1,
        "title": "Required Campus Location Address",
        "description": "Application documents must explicitly specify the physical campus address including revenue survey or khasra numbers.",
        "rule_type": "required_field",
        "severity": "medium",
        "parameters": {"field_key": "address"},
        "clause_ref": "Chapter II Clause 2.1",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter II Clause 2.1 - Exact physical address and boundary coordinates must be declared.",
    },
    {
        "rule_key": "R-REG-FORMAT",
        "version": 1,
        "title": "Registration Number Standard Format",
        "description": "Registration identifier must conform to the alphanumeric statutory format REG-XXXXX or valid institutional code.",
        "rule_type": "format_regex",
        "severity": "medium",
        "parameters": {"field_key": "registration_number", "pattern": r"^[A-Z0-9\/\-_]{3,35}$"},
        "clause_ref": "Chapter I Clause 1.2",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter I Clause 1.2 - Standardized statutory application and trust registration numbers.",
    },
    {
        "rule_key": "R-EXPIRY-VALID",
        "version": 1,
        "title": "Statutory Document Validity Period",
        "description": "Document validity date must not be expired relative to current academic evaluation date.",
        "rule_type": "date_not_expired",
        "severity": "high",
        "parameters": {"field_key": "expiry_date", "reference": "today"},
        "clause_ref": "Chapter V Clause 5.2",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter V Clause 5.2 - All NOCs and certificates must remain in force during the approval cycle.",
    },
    {
        "rule_key": "R-LAND-AREA",
        "version": 1,
        "title": "Minimum Land Area Threshold",
        "description": "Technical institution land area must meet statutory threshold: min 5.0 Acres (Non-Metro) or 2.5 Acres (Metro/Urban municipal corporation).",
        "rule_type": "numeric_threshold",
        "severity": "high",
        "parameters": {"field_key": "land_area", "operator": "gte", "value": 5.0, "unit": "Acres"},
        "clause_ref": "Chapter II Clause 2.1",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter II Clause 2.1 - Minimum contiguous land area for engineering and technology institutions.",
    },
    {
        "rule_key": "R-LAND-CONTIGUITY",
        "version": 1,
        "title": "Land Contiguity & Single Plot Requirement",
        "description": "Institution land must form a contiguous single plot, or satisfy permissible urban separation norms under municipal master plan.",
        "rule_type": "required_document",
        "severity": "high",
        "parameters": {"doc_type": "land_document"},
        "clause_ref": "Chapter II Clause 2.2",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter II Clause 2.2 - Campus land must be unbroken by public highways or railway tracks.",
    },
    {
        "rule_key": "R-BUILT-UP-AREA",
        "version": 1,
        "title": "Instructional & Administrative Built-Up Space",
        "description": "Adequate instructional, administrative, and amenities area must be certified in the approved building plans.",
        "rule_type": "required_document",
        "severity": "high",
        "parameters": {"doc_type": "approval_document"},
        "clause_ref": "Chapter III Clause 2.4",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter III Clause 2.4 - Carpet area requirements for classrooms, laboratories, and workshops.",
    },
    {
        "rule_key": "R-BARRIER-FREE",
        "version": 1,
        "title": "Barrier-Free Access for Divyangjan (PwD)",
        "description": "Mandatory provision of ramps, lifts, Braille signage, and specialized restrooms for persons with disabilities.",
        "rule_type": "required_document",
        "severity": "medium",
        "parameters": {"doc_type": "approval_document"},
        "clause_ref": "Chapter III Clause 2.5",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter III Clause 2.5 - Universal accessibility compliance under RPwD Act 2016.",
    },
    {
        "rule_key": "R-FACULTY-RATIO",
        "version": 1,
        "title": "Faculty-to-Student Cadre Ratio (FSR)",
        "description": "Institution must maintain statutory Cadre Ratio of 1:2:6 (Professor : Assoc Prof : Asst Prof) and prescribed FSR (1:15 / 1:20).",
        "rule_type": "numeric_threshold",
        "severity": "high",
        "parameters": {"field_key": "intake_capacity", "operator": "gte", "value": 60, "unit": "units"},
        "clause_ref": "Chapter IV Clause 3.2",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter IV Clause 3.2 & 3.4 - Faculty staffing norms and cadre distributions.",
    },
    {
        "rule_key": "R-FIRE-SAFETY",
        "version": 1,
        "title": "Fire & Life Safety Clearance (Fire NOC)",
        "description": "Valid Fire and Life Safety Certificate issued by State Fire Services Department is mandatory.",
        "rule_type": "required_document",
        "severity": "high",
        "parameters": {"doc_type": "approval_document"},
        "clause_ref": "Chapter V Clause 5.2",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter V Clause 5.2 - Building safety and fire-fighting equipment compliance.",
    },
    {
        "rule_key": "R-STRUCT-STABILITY",
        "version": 1,
        "title": "Structural Stability & Soundness Certificate",
        "description": "Certified Structural Stability Certificate from registered Structural Engineer or CPWD/PWD certifying building soundness.",
        "rule_type": "required_document",
        "severity": "high",
        "parameters": {"doc_type": "approval_document"},
        "clause_ref": "Chapter V Clause 5.3",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter V Clause 5.3 - Disaster resilience and structural load certification.",
    },
    {
        "rule_key": "R-CROSS-REG-NO",
        "version": 1,
        "title": "Registration Number Cross-Document Consistency",
        "description": "Registration number must match identically across application form, trust deed, and statutory filings.",
        "rule_type": "cross_doc_match",
        "severity": "high",
        "parameters": {"field_key": "registration_number", "match_type": "identifier"},
        "clause_ref": "Chapter V Clause 5.1",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter V Clause 5.1 - Reconciliation of registration identifiers across documents.",
    },
    {
        "rule_key": "R-CROSS-INST-NAME",
        "version": 1,
        "title": "Institution Name Cross-Document Consistency",
        "description": "Institution name must be consistent across application form and statutory certificates without conflicting abbreviations.",
        "rule_type": "cross_doc_match",
        "severity": "medium",
        "parameters": {"field_key": "institution_name", "match_type": "name", "threshold": 0.85},
        "clause_ref": "Chapter V Clause 5.2",
        "source_status": "OFFICIAL_STATUTORY_NORM",
        "source_notes": "AICTE Approval Process Handbook (APH) 2024-2027 Chapter V Clause 5.2 - Institutional identity verification across public submissions.",
    },
]

DEFAULT_DEMO_RULES = STATUTORY_BASELINE_RULES


def seed_default_rules_if_empty(conn) -> None:
    count = conn.execute("SELECT COUNT(*) FROM rules").fetchone()[0]
    if count > 0:
        return

    import uuid
    now = datetime.now(timezone.utc).isoformat()
    rule_ids = []

    for item in STATUTORY_BASELINE_RULES:
        rule_id = f"RULE-{uuid.uuid4().hex[:12].upper()}"
        rule_ids.append(rule_id)
        params_json = json.dumps(item["parameters"])

        conn.execute(
            """
            INSERT INTO rules (id, rule_key, version, title, description, rule_type, parameters_json, application_type, enabled, source_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rule_id,
                item["rule_key"],
                item["version"],
                item["title"],
                item["description"],
                item["rule_type"],
                params_json,
                None,
                1,
                item["source_status"],
                now,
            ),
        )

        source_id = f"SRC-{uuid.uuid4().hex[:12].upper()}"
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
                "AICTE Approval Process Handbook (APH) 2024-2027",
                "https://www.aicte-india.org/bulletins/approval-process-handbook-2024-2027",
                item["clause_ref"],
                "Chapter V Statutory Norms",
                None,
                "2024-01-01",
                "verified",
                "AICTE Approval Bureau",
                now,
                item["source_notes"],
                "[]",
                now,
            ),
        )

    # Create default active ruleset v1
    ruleset_id = f"RSET-{uuid.uuid4().hex[:12].upper()}"
    conn.execute(
        """
        INSERT INTO rulesets (id, name, version, status, created_at, activated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (ruleset_id, "AICTE Statutory Baseline Ruleset", 1, "active", now, now),
    )

    for rid in rule_ids:
        conn.execute(
            "INSERT INTO ruleset_rules (ruleset_id, rule_id) VALUES (?, ?)",
            (ruleset_id, rid),
        )
