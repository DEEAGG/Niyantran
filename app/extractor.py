import io
import json
import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from PIL import Image
import pymupdf as fitz
import pytesseract


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

FIELD_NAMES = [
    "applicant_name",
    "institution_name",
    "registration_number",
    "address",
    "land_area",
    "intake_capacity",
    "built_up_area",
    "proposed_programme",
    "academic_year",
    "teaching_rooms",
    "laboratories",
    "library_seating",
    "faculty_count",
    "sanctioned_faculty",
    "land_ownership",
    "fire_safety_noc",
    "building_stability_certificate",
    "institution_type",
    "issue_date",
    "expiry_date",
]

# Robust delimiter supporting inline separators (colons, dashes) and table cell newlines
DELIM = r"(?:[\t :–-]+|[\t :–-]*\s*\n+\s*)"

# High-precision statutory regulatory patterns with strict boundaries and required delimiters
STATUTORY_PATTERNS = {
    "applicant_name": [
        r"\b(?:Applicant\s+Name|Name\s+of\s+(?:the\s+)?Applicant|Applied\s+by|Trust\s*/\s*Society|Society\s+Name|Trust\s+Name|Promoting\s+Body|Department\s+Head|Author|Principal|Director)" + DELIM + r"([^\n\r;]{3,100})",
    ],
    "institution_name": [
        r"\b(?:Name\s+of\s+(?:the\s+)?(?:Institution|College|Institute)|Regulatory\s+Institution|Proposed\s+Institution|Institute\s+Name|College\s+Name|Institution\s+Name)" + DELIM + r"([^\n\r;]{4,100})",
        r"\b(?:Institution)" + DELIM + r"([A-Za-z0-9\s,\.\(\)\&'-]{4,100})",
    ],
    "registration_number": [
        r"\b(?:Registration\s*(?:No\.?|Number)|Society\s+Reg(?:istration)?\s*(?:No\.?|Number)|Trust\s+Registration\s*(?:No\.?|Number)|Application\s*(?:No\.?|Number|Reference|ID)|Approval\s*(?:No\.?|Number)|Permanent\s+Institute\s+ID|Institution\s+ID)" + DELIM + r"([A-Za-z0-9\/\-_\.]{3,35})\b",
    ],
    "address": [
        r"\b(?:Premises\s+Address|Campus\s+Address|Site\s+Address|Registered\s+Office\s+Address|Location\s+Address|Institutional\s+Address|Address)" + DELIM + r"([^\n\r;]{4,150})",
        r"\b(?:Campus\s+Location|Location|State\s*/\s*UT)" + DELIM + r"([^\n\r;]{3,150})",
    ],
    "land_area": [
        r"\b(?:Land\s+Area(?:\s*\(as\s+declared\))?|Total\s+Land\s+Area|Area\s+of\s+Land|Plot\s+Area|Campus\s+Site\s+Area)" + DELIM + r"([0-9]+(?:\.[0-9]+)?\s*(?:Acres?|Acre|Hectares?|Ha|sq\.?\s*(?:ft|feet|meters?|metres?|m|yard|yards)|Square\s*(?:Feet|Meters|Metres|Yards)))\b",
    ],
    "intake_capacity": [
        r"\b(?:Proposed\s+Intake|Programme\s+Intake|Sanctioned\s+Intake|Intake\s+Capacity|Intake)" + DELIM + r"([0-9]{1,5}(?:\s*students(?:\s+per\s+academic\s+year)?)?)\b",
    ],
    "built_up_area": [
        r"\b(?:Built-up\s+Area(?:\s*\(as\s+declared\))?|Total\s+Built-up\s+Area|Carpet\s+Area|Instructional\s+Area)" + DELIM + r"([0-9,\.]+\s*(?:square\s*(?:metres|meters|feet)|sq\.?\s*(?:m|ft)))\b",
    ],
    "proposed_programme": [
        r"\b(?:Proposed\s+Programme|Degree\s+Programme|Programme|Course)" + DELIM + r"([^\n\r;]{4,100})",
    ],
    "academic_year": [
        r"\b(?:Academic\s+Year|Academic\s+Session)" + DELIM + r"([0-9]{4}[\s\-–\/\.][0-9]{2,4})",
    ],
    "teaching_rooms": [
        r"\b(?:Teaching\s+Rooms|Number\s+of\s+Classrooms|Classrooms)" + DELIM + r"([0-9]{1,4})\b",
    ],
    "laboratories": [
        r"\b(?:Laboratories|Number\s+of\s+Laboratories|Labs)" + DELIM + r"([0-9]{1,4})\b",
    ],
    "library_seating": [
        r"\b(?:Library\s+Seating(?:\s+Capacity)?|Reading\s+Room\s+Capacity)" + DELIM + r"([0-9]{1,5})\b",
    ],
    "faculty_count": [
        r"\b(?:Faculty\s+Members\s+Listed|Total\s+Faculty|Faculty\s+Count|Faculty\s+Members)" + DELIM + r"([0-9]{1,4})\b",
    ],
    "sanctioned_faculty": [
        r"\b(?:Sanctioned\s+Faculty\s+Positions(?:\s*\(declared\))?|Required\s+Faculty|Sanctioned\s+Faculty)" + DELIM + r"([0-9]{1,4})\b",
    ],
    "land_ownership": [
        r"\b(?:Land\s+Ownership(?:\s+Status)?)" + DELIM + r"([^\n\r;]{3,80})",
    ],
    "fire_safety_noc": [
        r"\b(?:Fire\s+Safety\s+NOC(?:\s+Status)?)" + DELIM + r"([^\n\r;]{3,80})",
    ],
    "building_stability_certificate": [
        r"\b(?:Building\s+Stability\s+Certificate)" + DELIM + r"([^\n\r;]{3,80})",
    ],
    "institution_type": [
        r"\b(?:Institution\s+Type|Type\s+of\s+Institution)" + DELIM + r"([^\n\r;]{3,80})",
    ],
    "issue_date": [
        r"\b(?:Submission\s+Date|Issue\s+Date|Date\s+of\s+Issue|Issued\s+on|Date\s+of\s+Issuance|Dated)" + DELIM + r"([0-9]{1,4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,4}|[A-Za-z]+\s+[0-9]{1,2},\s*[0-9]{4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}|[a-zA-Z0-9\-_]{5,35})\b",
    ],
    "expiry_date": [
        r"\b(?:Expiry\s+Date|Date\s+of\s+Expiry|Valid\s+Till|Valid\s+Until|Validity\s+Period|Valid\s+Upto|Expires\s+on|Validity\s+End\s+Date)" + DELIM + r"([0-9]{1,4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,4}|[A-Za-z]+\s+[0-9]{1,2},\s*[0-9]{4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})\b",
    ],
}


def classify_document(text: str, filename: str = "", total_pages: int = 1) -> Dict[str, Any]:
    """
    Context-aware document classifier:
    Distinguishes educational/coursework materials, presentations, and genuine AICTE regulatory applications.
    """
    sample = (filename + " " + text[:6000]).lower()

    # 1. Academic notes / educational indicators
    academic_keywords = [
        "lecture notes", "syllabus", "oops in java", "unit 1", "unit 2", "unit 3", "unit 4", "unit 5",
        "data structures", "algorithms", "object oriented", "jdk", "jvm", "jre", "course objectives",
        "semester", "assignment", "department of computer science", "textbook", "procedural vs",
        "control structures", "polymorphism", "inheritance", "encapsulation",
    ]
    academic_score = sum(1 for kw in academic_keywords if kw in sample)

    # 2. Presentation / hackathon pitch indicators
    deck_keywords = [
        "pitch deck", "hackathon", "prototype demo", "business approach",
        "future scope & sustainability", "personalized rag", "technocrats",
    ]
    deck_score = sum(1 for kw in deck_keywords if kw in sample)

    # 3. Statutory regulatory approval indicators
    statutory_keywords = [
        "aicte", "approval process handbook", "council for technical education", "all india council",
        "land title deed", "sale deed", "khasra", "extension of approval", "society registration",
        "trust deed", "affiliating university", "fire safety certificate", "structural stability",
        "affidavit", "dte maharashtra", "aktu", "land area", "intake capacity",
    ]
    statutory_score = sum(1 for kw in statutory_keywords if kw in sample)

    if academic_score >= 2 and statutory_score == 0:
        # Extract educational title/topic
        subject_match = re.search(r"\b(OOPS\s+IN\s+JAVA|[A-Z\s]{4,30}\s+(?:NOTES|SYLLABUS|COURSE))\b", text, re.IGNORECASE)
        instructor_match = re.search(r"(?:Instructor|Faculty|By|Author)\s*[:\-–]?\s*([A-Za-z\s\.]{3,40})", text[:1000], re.IGNORECASE)
        subject_val = subject_match.group(1).strip() if subject_match else "OOPS in Java Course Notes"
        instructor_val = instructor_match.group(1).strip() if instructor_match else "Academic Instructor"

        return {
            "is_regulatory": False,
            "document_type": "academic_lecture_notes",
            "document_type_display": "Academic Coursework / Lecture Notes",
            "educational_metadata": {
                "subject": subject_val,
                "instructor": instructor_val,
                "pages": total_pages,
            },
            "message": f"Document identified as Academic Lecture Notes / Coursework ('{subject_val}'). Not an AICTE statutory application filing.",
        }

    if deck_score >= 2 and statutory_score == 0:
        return {
            "is_regulatory": False,
            "document_type": "presentation_deck",
            "document_type_display": "Presentation / Hackathon Project Deck",
            "educational_metadata": {"type": "Project Presentation"},
            "message": "Document identified as a Project Presentation / Hackathon Deck. Not an AICTE statutory application filing.",
        }

    # Default to statutory regulatory inspection
    return {
        "is_regulatory": True,
        "document_type": "regulatory_application",
        "document_type_display": "Statutory AICTE Application Document",
        "message": "Document identified as a Technical Institution Regulatory Filing.",
    }


def normalize_date(date_str: str) -> Optional[str]:
    clean = date_str.strip().strip(".,;:-")
    formats = [
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d.%m.%Y",
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%m/%d/%Y",
        "%m-%d-%Y",
        "%d %B %Y",
        "%d %b %Y",
        "%B %d, %Y",
        "%b %d, %Y",
        "%B %d %Y",
        "%b %d %Y",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(clean, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    parts = re.split(r"[\/\-\.]", clean)
    if len(parts) == 3:
        try:
            p1, p2, p3 = int(parts[0]), int(parts[1]), int(parts[2])
            if p3 > 1900 and p2 <= 12 and p1 <= 31:
                return f"{p3:04d}-{p2:02d}-{p1:02d}"
            elif p1 > 1900 and p2 <= 12 and p3 <= 31:
                return f"{p1:04d}-{p2:02d}-{p3:02d}"
        except Exception:
            pass
    return None


def normalize_land_area(area_str: str) -> Optional[str]:
    clean = area_str.strip().strip(".,;:-")
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(acres?|hectares?|ha|sq\.?\s*ft|sq\.?\s*m|square\s*feet|square\s*meters?)", clean, re.IGNORECASE)
    if not match:
        return None
    val, unit = match.groups()
    unit_lower = unit.lower().replace(".", "").replace(" ", "")
    if "acre" in unit_lower:
        canonical_unit = "Acres"
    elif "hectare" in unit_lower or unit_lower == "ha":
        canonical_unit = "Hectares"
    elif "sqft" in unit_lower or "squarefeet" in unit_lower:
        canonical_unit = "sq ft"
    elif "sqm" in unit_lower or "squaremeter" in unit_lower:
        canonical_unit = "sq m"
    else:
        canonical_unit = unit.title()
    return f"{float(val):g} {canonical_unit}"


def normalize_registration_number(reg_str: str) -> Optional[str]:
    clean = reg_str.strip().strip(".,;:-")
    clean = re.sub(r"\s+", "", clean)
    # Must contain at least one digit or hyphen
    if not re.search(r"[0-9\-]", clean):
        return None
    return clean.upper() if len(clean) >= 3 else None


def validate_and_normalize_field(field_name: str, raw_val: str) -> Tuple[Optional[str], float]:
    clean = raw_val.strip().strip(".,;:-")
    if not clean or len(clean) < 1:
        return None, 0.0

    # 1. Institution Name Validation
    if field_name == "institution_name":
        # Disallow 1-3 letter abbreviations or program instruction words
        if len(clean) < 4:
            return None, 0.0
        # Check against false word matches like "AL", "UNIT", "INTELLIGENCE"
        bad_words = {"al", "institutional", "unit", "chapter", "lecture", "algorithm", "operating", "syllabus"}
        if clean.lower() in bad_words:
            return None, 0.0
        norm = re.sub(r"\s*\(DEMO\)\s*$", "", clean, flags=re.IGNORECASE).strip()
        norm = re.sub(r"\s+", " ", norm)
        return (norm if len(norm) >= 4 else clean), 0.95

    # 2. Registration Number Validation
    if field_name == "registration_number":
        norm = normalize_registration_number(clean)
        if not norm:
            return None, 0.0
        return norm, 0.95

    # 3. Address Validation
    if field_name == "address":
        # Reject instruction fragments like "of current instruction being executed."
        if any(bad in clean.lower() for bad in ["instruction", "register", "operand", "opcode", "execution", "algorithm"]):
            return None, 0.0
        # Require plausible address words or reasonable length
        addr_signals = [
            "sector", "plot", "road", "street", "nagar", "campus", "district", "city",
            "state", "pradesh", "delhi", "mumbai", "pune", "noida", "karnataka", "tamil",
            "bengaluru", "corridor", "pin", "area", "india", "up", "tech park", "park",
            "greater noida", "maharashtra", "haryana",
        ]
        has_signal = any(sig in clean.lower() for sig in addr_signals) or bool(re.search(r"\b[1-9][0-9]{5}\b", clean))
        if not has_signal and len(clean) < 4:
            return None, 0.0
        norm = re.sub(r"\s+", " ", clean)
        return norm, 0.92

    # 4. Land Area Validation
    if field_name == "land_area":
        norm = normalize_land_area(clean)
        if not norm:
            return None, 0.0
        return norm, 0.95

    # 5. Intake Capacity Validation
    if field_name == "intake_capacity":
        m = re.search(r"([0-9]{1,5})", clean)
        if m:
            return str(int(m.group(1))), 0.95
        return None, 0.0

    # 6. Built-up Area Validation
    if field_name == "built_up_area":
        clean_num = clean.replace(",", "").strip()
        m = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(square\s*(?:metres|meters|feet)|sq\.?\s*(?:m|ft))", clean_num, re.IGNORECASE)
        if m:
            num, unit = m.group(1), m.group(2).lower()
            canonical = "sq m" if "m" in unit else "sq ft"
            return f"{float(num):g} {canonical}", 0.92
        return clean, 0.88

    # 7. Structural Numeric Counters
    if field_name in ("teaching_rooms", "laboratories", "library_seating", "faculty_count", "sanctioned_faculty"):
        m = re.search(r"([0-9]{1,5})", clean)
        if m:
            return str(int(m.group(1))), 0.95
        return None, 0.0

    # 8. Dates (Issue / Expiry)
    if field_name in ("issue_date", "expiry_date"):
        norm = normalize_date(clean)
        if norm:
            return norm, 0.95
        # Uncertain / unparseable dates preserved with penalized confidence (< 0.8) so they are kept and marked for review
        return clean, 0.50

    # 9. Applicant Name
    if field_name == "applicant_name":
        clean_name = re.sub(r"\s*\(fictional\s+demo\s+identity\)\s*", "", clean, flags=re.IGNORECASE).strip()
        clean_name = re.sub(r"\s+", " ", clean_name)
        if len(clean_name) < 3:
            return None, 0.0
        return clean_name, 0.92

    # 10. Academic Year
    if field_name == "academic_year":
        norm = clean.replace("–", "-")
        return norm, 0.95

    # 11. Proposed Programme
    if field_name == "proposed_programme":
        if clean.lower() in ("intake", "duration", "head", "code", "reference", "status"):
            return None, 0.0
        norm = re.sub(r"\s+", " ", clean)
        return norm, 0.92

    # 12. Certificates & Regulatory Status
    if field_name in ("fire_safety_noc", "building_stability_certificate", "land_ownership", "institution_type"):
        if clean.lower() in ("reference", "status", "details", "check", "source"):
            return None, 0.0
        norm = re.sub(r"\s+", " ", clean)
        return norm, 0.90

    return clean, 0.85


def extract_fields_from_text(
    text: str,
    page_num: int,
    base_confidence: float = 0.95,
    extraction_method: str = "pdf_text",
) -> List[Dict[str, Any]]:
    extracted = []
    found_fields = set()

    for field_name in FIELD_NAMES:
        patterns = STATUTORY_PATTERNS.get(field_name, [])
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                raw_val = match.group(1).strip()
                normalized, conf_factor = validate_and_normalize_field(field_name, raw_val)
                if not normalized or conf_factor <= 0.0:
                    continue
                if field_name in found_fields:
                    break

                field_conf = round(min(0.99, max(0.10, base_confidence * conf_factor)), 2)

                extracted.append({
                    "field_name": field_name,
                    "field_value": raw_val,
                    "normalized_value": normalized,
                    "confidence": field_conf,
                    "page_number": page_num,
                    "extraction_method": extraction_method,
                    "match_str": raw_val,
                    "verification_status": "Needs Review",
                })
                found_fields.add(field_name)
                break

    return extracted


def extract_from_pdf_page(page, page_num: int) -> Tuple[List[Dict[str, Any]], str]:
    text = page.get_text().strip()
    if len(text) >= 20:
        method = "pdf_text"
        fields = extract_fields_from_text(text, page_num=page_num, base_confidence=0.95, extraction_method=method)
        for f in fields:
            match_str = f.pop("match_str", None)
            bbox = None
            if match_str:
                rects = page.search_for(match_str)
                if not rects:
                    words = match_str.split()[:3]
                    if words:
                        rects = page.search_for(" ".join(words))
                if rects:
                    r = rects[0]
                    bbox = {
                        "x0": round(r.x0, 2),
                        "y0": round(r.y0, 2),
                        "x1": round(r.x1, 2),
                        "y1": round(r.y1, 2),
                        "width": round(r.width, 2),
                        "height": round(r.height, 2),
                    }
            f["bbox"] = bbox
            f["bbox_json"] = json.dumps(bbox) if bbox else None
        return fields, method
    else:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        fields, method = extract_from_image(img, page_num=page_num)
        return fields, method


def extract_from_image(image: Image.Image, page_num: int = 1) -> Tuple[List[Dict[str, Any]], str]:
    method = "tesseract_ocr"
    scale_factor = 1.0
    processed_img = image

    if image.width < 1200:
        scale_factor = 2.0
        new_size = (int(image.width * scale_factor), int(image.height * scale_factor))
        processed_img = image.resize(new_size, Image.Resampling.LANCZOS)

    try:
        ocr_data = pytesseract.image_to_data(processed_img, output_type=pytesseract.Output.DICT)
        words_list = [w for w in ocr_data.get("text", []) if w and w.strip()]
        text = " ".join(words_list)
        if not text:
            text = pytesseract.image_to_string(processed_img).strip()
    except Exception:
        return [], method

    valid_confs = [float(c) for c in ocr_data.get("conf", []) if float(c) > 0]
    avg_conf = (sum(valid_confs) / len(valid_confs)) if valid_confs else 75.0
    base_conf = round(avg_conf / 100.0, 2)
    base_conf = min(0.92, max(0.50, base_conf))

    fields = extract_fields_from_text(text, page_num=page_num, base_confidence=base_conf, extraction_method=method)

    ocr_words = ocr_data.get("text", [])
    lefts = ocr_data.get("left", [])
    tops = ocr_data.get("top", [])
    widths = ocr_data.get("width", [])
    heights = ocr_data.get("height", [])

    for f in fields:
        match_str = f.pop("match_str", None)
        bbox = None
        if match_str:
            tokens = [t.strip().lower() for t in re.findall(r"\w+", match_str) if t.strip()]
            matched_indices = []
            if tokens:
                for idx, word in enumerate(ocr_words):
                    clean_w = re.sub(r"\W+", "", word).lower()
                    if clean_w and clean_w in tokens:
                        matched_indices.append(idx)
            if matched_indices:
                x0 = round(min(lefts[i] for i in matched_indices) / scale_factor, 2)
                y0 = round(min(tops[i] for i in matched_indices) / scale_factor, 2)
                x1 = round(max(lefts[i] + widths[i] for i in matched_indices) / scale_factor, 2)
                y1 = round(max(tops[i] + heights[i] for i in matched_indices) / scale_factor, 2)
                bbox = {
                    "x0": x0,
                    "y0": y0,
                    "x1": x1,
                    "y1": y1,
                    "width": round(x1 - x0, 2),
                    "height": round(y1 - y0, 2),
                }
        f["bbox"] = bbox
        f["bbox_json"] = json.dumps(bbox) if bbox else None

    return fields, method


def extract_document_fields(file_path: Path, mime_type: Optional[str] = None) -> Dict[str, Any]:
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = file_path.suffix.lower()
    all_fields: List[Dict[str, Any]] = []
    methods_used = set()

    if ext == ".pdf":
        doc = fitz.open(file_path)
        try:
            total_pages = len(doc)
            # Sample text from up to first 5 pages for classification
            sample_text = ""
            for p_idx in range(min(5, total_pages)):
                sample_text += doc[p_idx].get_text() + "\n"

            # 1. Context-Aware Document Classification
            classification = classify_document(sample_text, filename=file_path.name, total_pages=total_pages)

            # If document is non-regulatory (e.g. academic notes or presentation deck), do not fabricate regulatory fields
            if not classification.get("is_regulatory", True):
                return {
                    "method": "document_classifier",
                    "classification": classification.get("document_type"),
                    "document_type_display": classification.get("document_type_display"),
                    "is_regulatory_document": False,
                    "educational_metadata": classification.get("educational_metadata", {}),
                    "message": classification.get("message"),
                    "fields": [],
                }

            # 2. Extract fields for regulatory documents
            max_pages = min(total_pages, 25)
            for page_idx in range(1, max_pages + 1):
                page = doc[page_idx - 1]
                page_fields, page_method = extract_from_pdf_page(page, page_num=page_idx)
                methods_used.add(page_method)
                for f in page_fields:
                    existing = next((ef for ef in all_fields if ef["field_name"] == f["field_name"]), None)
                    if existing is None:
                        all_fields.append(f)
                    elif f["confidence"] > existing["confidence"]:
                        all_fields.remove(existing)
                        all_fields.append(f)

                if len(all_fields) >= len(FIELD_NAMES) and all(f["confidence"] >= 0.85 for f in all_fields):
                    break
        finally:
            doc.close()
    else:  # Image (.png, .jpg, .jpeg)
        img = Image.open(file_path)
        img_fields, img_method = extract_from_image(img, page_num=1)
        methods_used.add(img_method)
        all_fields.extend(img_fields)
        classification = {
            "is_regulatory": True,
            "document_type": "scanned_image",
            "document_type_display": "Scanned Document Image",
        }

    overall_method = "+".join(sorted(methods_used)) if methods_used else "none"

    return {
        "method": overall_method,
        "classification": classification.get("document_type"),
        "document_type_display": classification.get("document_type_display"),
        "is_regulatory_document": classification.get("is_regulatory", True),
        "fields": all_fields,
    }


def normalize_field(field_name: str, raw_value: str) -> Tuple[Optional[str], float]:
    return validate_and_normalize_field(field_name, raw_value)
