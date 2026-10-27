# NIYANTRAN — Final Visual QA & KPI Metric Specification Report
**Smart India Hackathon 2026 | PS SIH 26261**
**Date & Time**: 2026-10-25T17:06:30+05:30
**Environment**: Local Native Stack (FastAPI `127.0.0.1:8000` + Vite React `127.0.0.1:3000` + SQLite `data/niyantran.db`)

---

## 1. Executive Summary & Visual Verdict
* **Visual Verdict**: **PRODUCTION READY FOR JUDGING**
* **Aesthetic Standard**: Restrained, authoritative regulatory intelligence workspace modeled on the precision and restraint of Linear and Vercel.
* **Surface System**: Deep charcoal matte surfaces (`#0A0D12`, `#111620`, `#18202C`) with subtle 1px border tokens (`#232B38`).
* **KPI Integrity**: All dashboard metrics reflect exact, uncorrupted SQLite rows with zero double-counting. Statuses have clear, distinct definitions.

---

## 2. Actual SQL Queries & Exact KPI Definitions

### A. Raw Database Status Aggregation
SQL Query:
```sql
SELECT status, count(*) FROM applications GROUP BY status;
```
Result in `data/niyantran.db`:
* `validated`: 152 distinct applications (22.65% &rarr; **23%**)
* `draft`: 516 distinct applications (76.90% &rarr; **77%**)
* `under_review`: 2 distinct applications (0.30% &rarr; **<1%**)
* `missing_documents`: 1 distinct application (0.15% &rarr; **<1%**)
* **Total Distinct Institutional Applications**: **671** (152 + 516 + 2 + 1 = **671**, exactly 100.0%)

### B. Clarification of Review Workload & Drafts
* **Finding**: Draft applications are **NOT** in the officer review queue. In the regulatory workflow, drafts represent filings that institutional applicants have begun but not yet completed or submitted for automated compliance checking.
* **Correction Implemented**:
  * Metric 3 was renamed from "Officer Review Queue" to **"Pending Filings"** (`518`, representing `516 drafts • 2 under review`).
  * The active officer review workload is explicitly broken out as `2 under review` so judges and officers immediately see the true human-adjudication queue.
* **Clarification of Flagged Metric**:
  * Metric 4 was renamed from "Flagged Mismatches" to **"Flagged Applications"** (`1 distinct non-compliant filing`).
  * Sub-label explicitly states: `0 discrepancy • 1 missing docs`. This prevents confusing application counts with individual rule finding violations (which number in the thousands across historical runs).

---

## 3. Mathematical Consistency Verification
* **Total Intake Cohort**: 671 applications (100%)
* **Verified Compliant**: 152 / 671 = **23%**
* **Pending Filings**: 518 / 671 = **77%** (516 drafts + 2 actively under review)
* **Flagged Applications**: 1 / 671 = **0.15% &rarr; <1%** (1 missing mandatory document)
* **Mathematical Sum**: **23% + 77% + 0% = 100.0%**
* **Zero Double Counting**: Every application record in SQLite belongs to exactly one status category.

---

## 4. End-to-End Judge Demo Workflow Results
All steps of the judge walkthrough were tested and passed against live native services:

| Step | Workflow Segment | Target URL | Evidence & Data Verified | Result |
|---|---|---|---|---|
| **1** | **Dashboard Overview** | `http://127.0.0.1:3000/dashboard` | 671 Filings, 23% pass rate, 518 pending filings (516 drafts, 2 review), 1 flagged | **PASS** |
| **2** | **Judge Demo Navigation** | Click `Judge Demo: Discrepancy Case` | 1-click routed to case `APP-2026-003` forensic evidence viewer | **PASS** |
| **3** | **Discrepancy Evidence Viewer** | `http://127.0.0.1:3000/applications/APP-2026-003/evidence` | 8 Findings populated; `INST-1042` highlighted in bounding box (x:140, y:195) | **PASS** |
| **4** | **Review Desk** | `http://127.0.0.1:3000/review` | Live review queue with adjudicable findings | **PASS** |
| **5** | **Policy Replay Engine** | `http://127.0.0.1:3000/replay` | Live backtest execution on `DEMO-CAPACITY-002` (30 vs 60 seats) | **PASS** |
| **6** | **Evidence Passport** | `http://127.0.0.1:3000/applications/APP-2026-003` (Passport tab) | SHA-256 document manifest & intact cryptographic audit-chain badge | **PASS** |
| **7** | **Printable Report** | `http://127.0.0.1:8000/api/applications/APP-2026-003/report` | Standalone Jinja2 HTML report with `SYNTHETIC DEMO DOCUMENT` badge | **PASS** |

---

## 5. Console & Network Errors
* **Frontend Console Errors**: **0**
* **Failed Network Requests**: **0**
* **Backend Pytest Suite**: **65 / 65 passed** (100% passing, 12.69s)
* **Frontend Production Build**: **`vite build` exited 0**

---

## 6. Final Screenshot Artifacts
All verified workflow screen captures are stored in [`D:\Niyantran\artifacts\ui_audit\final\`](file:///D:/Niyantran/artifacts/ui_audit/final/):
* `01_dashboard.png` — Verified Dashboard with exact Pending Filings breakdown (`516 drafts • 2 under review`) and Flagged Applications
* `02_discrepancy_evidence.png` — Evidence Explorer displaying 8 findings & highlighted coordinate box
* `03_finding_selected.png` — Finding selection, regulatory diagnosis & statutory rule citation
* `04_review_desk.png` — Officer adjudication desk
* `05_policy_replay.png` — ReguTrace Replay backtester with impact delta cards & bar distribution
* `06_evidence_passport.png` — Case Evidence Passport with SHA-256 fingerprints & audit chain
* `07_printable_report.png` — Jinja2 standalone printable HTML dossier

---

## 7. Remaining Blockers
* **NONE**. All metrics are verified, exact, and mathematically validated against SQLite.
