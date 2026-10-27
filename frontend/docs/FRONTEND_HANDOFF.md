# NIYANTRAN — ANTIGRAVITY FRONTEND DEVELOPMENT HANDOFF
**Regulatory Intelligence Engine:** ReguTrace  
**Tagline:** Every Decision. Backed by Evidence.  
**SIH Problem Statement:** SIH 26261 (AICTE Approval Process Verification)  
**Workspace:** `C:\Users\Abc\.gemini\antigravity\scratch\aicte-verifyai`  
**Frontend Stack:** React 18, Vite 5, Tailwind CSS 3, React Router v6, Lucide React, Recharts, Axios  

---

## SECTION A — EXECUTIVE SUMMARY & DESIGN SYSTEM FOUNDATIONS

NIYANTRAN is an enterprise-grade regulatory compliance and intelligence platform engineered for AICTE technical education approval validation. 

### Key Objectives Achieved:
1. **Real Minimalism Without Repetitive Cards:** Eliminated the "identical dark rectangles" anti-pattern. Distinct UI topologies are deployed across modules:
   - **Dashboard:** Unified metrics strip with subtle column dividers and a segmented 100% cohort progress bar.
   - **Applications Registry:** High-density data-led table with click-to-filter KPI counts and search.
   - **Evidence Explorer:** Dual-pane split-screen investigation bench with interactive simulated OCR bounding boxes.
   - **ReguTrace Replay Engine:** Deterministic before-and-after backtesting laboratory with dual threshold reference lines (`v1.0` vs `v2.0`).
   - **Review Desk:** Officer adjudication bench with severity badges and triage states.
2. **Elimination of Muddy Surfaces:** Replaced muddy brown-green backgrounds with a cool, refined dark neutral graphite/slate foundation (`#0D1117` canvas, `#1C232B` primary surface, `#28323D` elevated surface).
3. **Preservation of Vibrant Regulatory Status Colors:** Ensured statutory colors remain bold, distinguishable, and unmuted:
   - `#22C55E` (Passed / Verified)
   - `#FACC15` (Under Review / Pending)
   - `#F97316` (Action Required / Warning)
   - `#EF4444` (Discrepancy / Non-Compliant)
4. **100% Solid Opaque Menus & Dialogs:** All dropdown menus (`.dropdown-menu`), modals, quick-search modals, and notifications render with opaque `#28323D` backgrounds, `border: 1px solid #34404C`, and `z-index: 1000/1101` with no transparent overlays.

---

## SECTION B — COLOR PALETTE TOKENS & TYPOGRAPHY STANDARDS

### Active Theme: Premium Dark Neutral (Default)
| Token | Variable | Hex Value | Semantic Purpose |
|---|---|---|---|
| Canvas Base | `--background` | `#0D1117` | Root application background |
| Primary Surface | `--surface` | `#1C232B` | Cards, panels, navigation bar, header |
| Elevated Surface | `--surface-elevated` | `#28323D` | Dropdowns, modals, popovers, active tabs |
| Hover State | `--surface-hover` | `#232C36` | Table rows, buttons, interactive hover |
| Secondary Recessed | `--surface-secondary` | `#222A33` | Input fields, recessed containers, search |
| Structural Border | `--border` | `#34404C` | Structural dividing borders |
| Focus & Strong Border | `--border-strong` | `#445466` | Focus outlines, active selections |
| Primary Text | `--text-primary` | `#F1F5F9` | Main headings, critical text |
| Secondary Text | `--text-secondary` | `#B0BEC9` | Body copy, secondary metadata |
| Muted Text | `--text-muted` | `#8796A5` | Timestamps, table headers, labels |
| Sky Accent | `--accent` | `#83B8E0` | Interactive links, active indicators, focus |
| Accent Hover | `--accent-hover` | `#99C9EE` | Accent button hover state |

### Unmuted Regulatory Status Palette
- **Success (Compliant / Passed):** `#22C55E`
- **Pending / In Review:** `#FACC15`
- **Warning / Non-Critical:** `#F97316`
- **Error / Critical Discrepancy:** `#EF4444`

---

## SECTION C — APPLICATION COHORT INTEGRITY & KPI METRICS

All dashboard KPIs and cohort counts are mathematically reconciled and mutually exclusive:
- **Total Cohort Tracked:** 5 applications (`APP-2026-001` to `APP-2026-005`)
- **Verified Compliant (Passed):** 2 (40%) — `APP-2026-001` (Aryabhata), `APP-2026-005` (Savitribai)
- **In Officer Review:** 1 (20%) — `APP-2026-002` (Delhi Tech)
- **Flagged Issues (Discrepancy Detected):** 2 (40%) — `APP-2026-003` (Deccan Inst), `APP-2026-004` (Nalanda)
- **Sum of Percentages:** $40\% + 20\% + 40\% = 100\%$ exactly.
- **Distinct Finding Overlap:** Mutually exclusive application cohorts are clearly distinguished from individual finding counts (`pendingReviews: 2`, `totalOpenFindings: 3`).

---

## SECTION D — COMPONENT & VIEW ARCHITECTURES

1. **Top Command Bar (`src/components/layout/CommandNavbar.jsx`):**
   - Slim, modern desktop header (no clumsy left sidebar).
   - Solid opaque dropdowns for `Verification`, `ReguTrace`, and `More`.
   - Global Quick Search shortcut (`⌘K` / `Ctrl+K`).
   - Profile popover with instant theme toggle between *Dark Neutral* and *Obsidian*.
2. **Dashboard (`src/pages/Dashboard.jsx`):**
   - Metric ribbon with 4 KPI quadrants.
   - Segmented cohort progress indicator with colored legend.
   - High-priority `Pending Actions` queue with direct link to Evidence Inspector.
   - Interactive Findings by Severity bar chart and Active Norms catalog.
3. **Application Workspace (`src/pages/ApplicationDetails.jsx`):**
   - 4-tab tabbed workspace:
     - **Overview:** Institution details, documents checklist, extraction stats.
     - **Compliance:** Rule-by-rule evaluation results.
     - **Authenticity (NEW):** SHA-256 integrity fingerprint, duplicate document signal, digital signature state, manual verification confirmation button.
     - **Evidence Passport (NEW):** Cryptographic timeline tracing submission, OCR extraction, rule version application, and officer decisions (`SYNTHETIC DEMO`).
4. **Document Ingestion (`src/pages/UploadDocuments.jsx`):**
   - Drag-and-drop zone with multi-file categorization.
   - Simulated LayoutLMv3 processing pipeline with progress stages.
5. **Evidence Explorer (`src/pages/EvidenceExplorer.jsx`):**
   - Live bounding-box document canvas.
   - Cross-document discrepancy inspector (e.g., Form `INST-1042` vs Certificate `INST-1024`).
   - Reviewer field confirmation actions.

---

## SECTION E — REGUTRACE ENGINE, RULESET, & REPLAY SIMULATION

1. **Rulebook & Version Mapping (`src/mocks/requirementMap.js`):**
   - Versioned statutory requirements by application type.
   - `New Institution` / `New Technical Campus`: 7 verified clauses mapped to AICTE APH 2026-27 (`§3.1` to `§5.1`).
   - Other types: flagged with `supported: false` and explicit notice: *"⚠ ILLUSTRATIVE / DEMO — Requirements not mapped to verified clauses"*.
2. **Deterministic Replay Simulation (`src/pages/Replay.jsx`):**
   - Simulation engine testing cohort impact of threshold revisions:
     - `DEMO-CAPACITY-002`: Minimum intake capacity increased from `v1.0 (30 seats)` to `v2.0 (60 seats)`.
   - Impact summary:
     - `APP-2026-003` (Deccan Institute: 45 seats): Transitions from **Passing** to **Newly Failing**.
     - Requires re-review flag (`requiresReReview: true`).
   - Dual threshold reference lines on Recharts bar chart (`v1.0` green @ 30, `v2.0` red @ 60).
   - In-memory simulation run history ledger and reset capability.

---

## SECTION F — DOCUMENT INGESTION, LAYOUTLMV3, & EVIDENCE VERIFICATION

- LayoutLMv3 simulated bounding box coordinates:
  - Document: `application_form.pdf`, Page 1, Bounding Box: `[120, 240, 380, 260]`, Confidence: `94.2%`.
  - Document: `registration_certificate.pdf`, Page 1, Bounding Box: `[140, 280, 410, 305]`, Confidence: `98.1%`.
- Field extraction verification:
  - Reviewers can click **Confirm Value** to lock extracted data.
  - Normalization rules sanitize strings (e.g., regex uppercase and whitespace trimming).

---

## SECTION G — VERIFICATION, ROUTING, & BUILD STATUS

- **Build Output:**
  ```bash
  > niyantran-frontend@1.2.0 build
  > vite build

  ✓ 2490 modules transformed.
  dist/index.html                   1.05 kB
  dist/assets/index-DgBp2RhT.css   48.24 kB
  dist/assets/index-BZuTBnF8.js   982.83 kB
  ✓ built in 19.87s
  ```
- **0 errors, 0 broken imports, 0 missing components.**
- **All Routes Functional:**
  - `/dashboard`
  - `/applications`
  - `/applications/new`
  - `/applications/:id`
  - `/applications/:id/evidence`
  - `/upload`
  - `/validation`
  - `/rules`
  - `/rules/:id`
  - `/rules/:id/versions`
  - `/replay`
  - `/review`
  - `/reports`
  - `/audit`
  - `/settings`

---

## SECTION H — TEAMMATE HANDOFF & FASTAPI INTEGRATION GUIDE

The frontend mock store (`src/mocks/store.js`) is decoupled via the service layer (`src/services/*`). When the Python FastAPI backend is ready:

1. **API Endpoints to Wire:**
   - `GET /api/v1/dashboard/summary` &rarr; `dashboardService.getDashboardSummary()`
   - `GET /api/v1/applications` &rarr; `applicationService.getApplications()`
   - `POST /api/v1/applications` &rarr; `applicationService.createApplication()`
   - `GET /api/v1/applications/{id}` &rarr; `applicationService.getApplicationById(id)`
   - `POST /api/v1/documents/upload` &rarr; `documentService.uploadDocument()`
   - `POST /api/v1/validation/execute` &rarr; `validationService.runValidation()`
   - `POST /api/v1/regutrace/replay` &rarr; `regutraceService.executeReplay()`
   - `POST /api/v1/review/adjudicate` &rarr; `reviewService.adjudicateFinding()`
2. **Switching from Mock Store to Real Backend:**
   - In `.env` or `src/services/api.js`, toggle `VITE_USE_MOCKS=false`.
   - Configure `VITE_API_BASE_URL=http://localhost:8000/api/v1`.
