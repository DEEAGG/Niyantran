# NIYANTRAN — Frontend Architecture & Feature Guide
## Smart India Hackathon 2026 | SIH 26261

This document explains what every frontend view does, how users interact with it, which service layer calls power it, and what backend logic it connects to.

---

## 1. Executive Summary & Design System

NIYANTRAN (**"Every Decision. Backed by Evidence."**) is an enterprise compliance platform designed for regulatory reviewers, compliance inspectors, and institutional administrators.

### Core Architecture
- **Framework:** React 18, Vite 5, Tailwind CSS, React Router v6
- **Navigation:** Command-Center Top Navigation Bar with global search modal (`⌘K`), contextual dropdowns, and mobile drawer.
- **Theme Engine:** CSS-variable driven design system with two available presets:
  - 🎨 **Earth Modern (Experimental Default):** `#020300` (Black canvas), `#2E2C26` (Graphite navigation & elevated surfaces), `#59544B` (Stone brown secondary), `#7D8CA3` (Lavender grey highlights), `#79A9D1` (Sky reflection primary interactive accent).
  - 🌌 **Obsidian Command (Original):** `#090D14`, `#111722`, `#182130`, `#273244`, `#5B8CFF`.
- **State Management:** Centralized Service Layer (`src/services/`) with reactive Mock State Store (`src/mocks/store.js`).
- **API Switcher:** Driven by `VITE_USE_MOCK_API`. Zero UI changes needed when toggling to FastAPI.

---

## 2. Page & Feature Catalog

| Route | Feature Name | Core Functionality | Primary Service Called |
|---|---|---|---|
| `/dashboard` | Executive Dashboard | Overview KPIs, status breakdown donut chart, findings by severity bar chart, recent applications table with row navigation, and live audit activity feed | `dashboardService.getDashboardSummary()` |
| `/applications` | Applications Registry | Searchable, filterable, sortable list of institutional filings with status badges, KPI strips, progress meters, and working pagination | `applicationService.getApplications()` |
| `/applications/new` | Create Application | Multi-field validation form registering new academic year filings with immediate store persistence | `applicationService.createApplication()` |
| `/applications/:id` | Application Workspace | 360-degree institutional profile, mandatory document checklist (5 categories), extracted entities table with confidence metrics, and compliance findings summary | `applicationService.getApplicationById()`, `documentService.getDocuments()` |
| `/upload` | Document Ingestion | Drag-and-drop PDF upload pipeline, document category tagger, and stepper workflow | `documentService.uploadDocuments()` |
| `/validation` | Validation Center | Interactive application selector, rule-set summary, "Run Validation" button, progress indicators, passed/failed metrics, severity filters, expandable finding explanations, and evidence links | `validationService.validateApplication()`, `validationService.getFindings()` |
| `/applications/:id/evidence` | **Evidence Explorer (Innovation 1)** | 3-panel workbench: Findings List, Document Bounding Box Viewer, and Regulatory Clause Explanation | `evidenceService.getFindingEvidence()` |
| `/rules` | Rulebook Registry | Master directory of AICTE technical norms and thresholds | `ruleService.getRules()` |
| `/rules/:id/versions` | Version Comparison | Side-by-side diff comparing policy revisions (e.g. intake capacity 30 vs 60) | `ruleService.getRuleVersions()` |
| `/replay` | **ReguTrace Replay (Innovation 2)** | Retrospective backtesting simulator analyzing impact of regulatory rule amendments on institutions | `replayService.runReplay()` |
| `/review` | Review Center | Officer adjudication station for approving findings, requesting clarification, or marking false positives | `reviewService.submitReview()` |
| `/reports` | Compliance Reports | Print-friendly audit dossier with institutional findings and verification status | `reportService.getApplicationReport()` |
| `/audit` | Audit History | Chronological compliance trail recording all ingestion, validation, and human decisions | `auditService.getAuditEvents()` |
| `/settings` | Settings & API Gateway | FastAPI endpoint configuration, Mock Mode toggle, reviewer profile customization, and theme switcher | `mockApi.store` / environment |
