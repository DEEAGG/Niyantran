# NIYANTRAN — Backend API Contract (FastAPI Specification)
## Smart India Hackathon 2026 | SIH 26261
### Powered by ReguTrace Engine

This document defines the formal OpenAPI/FastAPI contract expected by the NIYANTRAN frontend.
All responses follow a consistent JSON response envelope.

---

## 1. Global Standards & Conventions

### Base URL
- Development: `http://localhost:8000/api`
- Production: `https://api.niyantran.gov.in/api` (or designated hackathon domain)

### Standard Headers
```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <jwt_access_token>
```

### Standard Response Envelope
```json
{
  "data": { ... },
  "message": "Human readable status string (optional)",
  "total": 100, // Present for paginated collections
  "page": 1,
  "pageSize": 10
}
```

### Standard Error Envelope
```json
{
  "detail": "Descriptive error message",
  "errorCode": "RULE_NOT_FOUND",
  "status": 404
}
```

---

## 2. API Endpoints

### 2.1 Dashboard
#### `GET /api/dashboard/summary`
Retrieves aggregated compliance metrics, KPI counters, and recent activity logs.

**Response `200 OK`:**
```json
{
  "data": {
    "kpis": {
      "totalApplications": 5,
      "validatedApplications": 2,
      "pendingReviews": 2,
      "applicationsWithIssues": 3,
      "recentRuleChanges": 2,
      "averageProcessingTime": "1.8 Days"
    },
    "statusDistribution": [
      { "name": "Verified", "value": 2, "color": "#16A34A" },
      { "name": "Under Review", "value": 2, "color": "#F59E0B" },
      { "name": "Discrepancy", "value": 1, "color": "#DC2626" }
    ],
    "findingsBySeverity": [
      { "severity": "Critical", "count": 1 },
      { "severity": "High", "count": 2 },
      { "severity": "Medium", "count": 1 }
    ],
    "recentActivity": [ ... ],
    "recentApplications": [ ... ]
  }
}
```

---

### 2.2 Applications
#### `GET /api/applications`
Query parameters:
- `search` (string, optional): Institution name or application code
- `status` (string, optional): Filter by status enum (`Verified`, `Under Review`, `Discrepancy Detected`, `Missing Documents`)
- `page` (int, default: 1)
- `pageSize` (int, default: 10)

**Response `200 OK`:**
```json
{
  "data": [
    {
      "id": "APP-2026-003",
      "institutionName": "Deccan Institute of Science & Technology",
      "institutionCode": "INST-1042",
      "applicationType": "Extension of Approval (EoA)",
      "academicYear": "2026-2027",
      "contactEmail": "director@deccantech.edu.in",
      "contactPhone": "+91 97660 55443",
      "address": "Survey 88, University Road, Pune, Maharashtra 411007",
      "status": "Discrepancy Detected",
      "submittedAt": "2026-10-21T15:45:00Z",
      "updatedAt": "2026-10-23T16:20:00Z",
      "documentCount": 5,
      "requiredDocumentCount": 5,
      "findingsCount": 1,
      "criticalFindingsCount": 1,
      "intakeCapacity": 90,
      "complianceStatus": "Under Review"
    }
  ],
  "total": 5,
  "page": 1,
  "pageSize": 10
}
```

#### `POST /api/applications`
Registers a new institutional application.

**Request Body:**
```json
{
  "institutionName": "Apex Institute of Advanced Computing",
  "institutionCode": "INST-2099",
  "applicationType": "Extension of Approval (EoA)",
  "academicYear": "2026-2027",
  "contactEmail": "admin@apextech.edu.in",
  "contactPhone": "+91 98111 22334",
  "address": "Tech Zone 4, Greater Noida, UP",
  "intakeCapacity": 120
}
```

**Response `201 Created`:**
```json
{
  "data": {
    "id": "APP-2026-006",
    "institutionName": "Apex Institute of Advanced Computing",
    "institutionCode": "INST-2099",
    "status": "Pending Upload",
    "submittedAt": "2026-10-24T22:00:00Z"
  },
  "message": "Application registered successfully"
}
```

#### `GET /api/applications/{id}`
Returns complete application details.

---

### 2.3 Documents
#### `GET /api/applications/{id}/documents`
Returns uploaded document manifest and verification status.

**Response `200 OK`:**
```json
{
  "data": [
    {
      "id": "DOC-301",
      "name": "AICTE_Application_Form_2026.pdf",
      "category": "Application Form",
      "size": "2.8 MB",
      "uploadDate": "2026-10-21",
      "status": "Extracted",
      "pages": 14
    }
  ]
}
```

#### `POST /api/applications/{id}/documents`
Accepts `multipart/form-data` with one or more files under key `files`.

---

### 2.4 Extraction Engine
#### `POST /api/applications/{id}/extract`
Triggers LayoutLM / OCR document extraction pipeline.

#### `GET /api/applications/{id}/fields`
Retrieves structured entities extracted across documents.

**Response `200 OK`:**
```json
{
  "data": [
    {
      "id": "FLD-302",
      "fieldName": "Institution Code (Form)",
      "extractedValue": "INST-1042",
      "sourceDocument": "AICTE_Application_Form_2026.pdf",
      "pageNumber": 1,
      "extractionMethod": "OCR RegEx Matcher",
      "confidence": 0.99,
      "status": "Conflicting",
      "isConfirmed": false
    }
  ]
}
```

#### `POST /api/applications/{id}/fields/{fieldId}/confirm`
Marks an uncertain/conflicting field as manually verified.

---

### 2.5 Validation Engine & Findings
#### `POST /api/applications/{id}/validate`
Executes active regulatory rulebook rules against the application.

**Response `200 OK`:**
```json
{
  "data": {
    "applicationId": "APP-2026-003",
    "totalChecks": 14,
    "passedChecks": 13,
    "failedChecks": 1,
    "findings": [ ... ],
    "timestamp": "2026-10-24T22:15:00Z"
  }
}
```

#### `GET /api/applications/{id}/findings`
Retrieves findings with evidence references.

---

### 2.6 Evidence Explorer
#### `GET /api/findings/{findingId}/evidence`
Provides multi-source coordinates, bounding boxes, and explanation for side-by-side inspection.

**Response `200 OK`:**
```json
{
  "data": {
    "findingId": "FND-2026-001",
    "applicationId": "APP-2026-003",
    "ruleId": "DEMO-IDENTIFIER-001",
    "title": "Institution Code Mismatch",
    "explanation": "The institution codes extracted from two primary statutory documents do not match.",
    "recommendedAction": "Verify the original physical documents or request administrative clarification.",
    "evidenceSources": [
      {
        "documentType": "Application Form",
        "documentName": "AICTE_Application_Form_2026.pdf",
        "pageNumber": 1,
        "extractedValue": "INST-1042",
        "coordinates": { "x": 140, "y": 195, "width": 110, "height": 24 }
      },
      {
        "documentType": "Registration Document",
        "documentName": "Society_Registration_Certificate.pdf",
        "pageNumber": 2,
        "extractedValue": "INST-1024",
        "coordinates": { "x": 220, "y": 310, "width": 110, "height": 24 }
      }
    ]
  }
}
```

---

### 2.7 Regulatory Rules
#### `GET /api/rules`
Lists versioned regulatory rulebooks.

#### `GET /api/rules/{id}/versions`
Lists all historical revisions and parameter threshold changes.

#### `POST /api/rules/{id}/versions`
Drafts a demonstration rule revision.

---

### 2.8 ReguTrace Replay Engine
#### `POST /api/replays`
Runs retrospective backtesting of regulatory policy changes across historical filings.

**Request Body:**
```json
{
  "ruleId": "DEMO-CAPACITY-002",
  "oldVersion": "v1.0",
  "newVersion": "v2.0",
  "applicationIds": ["APP-2026-001", "APP-2026-005"]
}
```

**Response `200 OK`:**
```json
{
  "data": {
    "replayId": "REP-8041",
    "ruleId": "DEMO-CAPACITY-002",
    "oldVersion": "v1.0",
    "newVersion": "v2.0",
    "totalEvaluated": 2,
    "unchanged": 1,
    "newlyFailing": 1,
    "newlyPassing": 0,
    "results": [
      {
        "applicationId": "APP-2026-005",
        "institutionName": "Vidya Bharti Polytechnic Institute",
        "intakeCapacity": 45,
        "oldResult": "PASS",
        "newResult": "FAIL",
        "impact": "Newly Failing",
        "explanation": "Intake capacity (45) satisfied v1.0 baseline (30), but falls below v2.0 requirement (60)."
      }
    ]
  }
}
```

---

### 2.9 Review Workflow
#### `POST /api/findings/{id}/reviews`
Records officer disposition.

**Request Body:**
```json
{
  "action": "Clarification Requested", // "Accepted" | "False Positive" | "Clarification Requested"
  "reviewerNotes": "Requested ancestral trust resolution from applicant institution."
}
```

---

### 2.10 Compliance Reports
#### `GET /api/applications/{id}/report`
Returns comprehensive audit dossier for printing / PDF export.

---

### 2.11 Audit History
#### `GET /api/audit`
Returns immutable chronological events.
