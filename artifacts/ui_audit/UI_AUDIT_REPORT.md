# NIYANTRAN — UI/UX Audit & Redesign Specification
**Smart India Hackathon 2026 | PS SIH 26261**

## 1. Visual & Architectural Audit of Existing UI

| Screen / Component | Current State | Issues Identified | Redesign Target (Linear / Vercel Aesthetic) |
|---|---|---|---|
| **Design System & Theme** | Blue `#83B8E0` accent on `#0D1117` base with multiple border colors | Feels like a standard dashboard template; lacks authoritative regulatory presence | Deep charcoal surfaces (`#0A0D12`, `#12161F`, `#1A202C`), restrained emerald/teal accents (`#10B981`, `#059669`), subtle 1px borders (`#232B38`), clean typography (Inter / JetBrains Mono) |
| **Navbar / Command Header** | Multi-dropdown header with heavy badges | Excessive dropdowns clutter navigation during live judging | Minimalist 52px command header with crisp logo, active view switcher, real backend health indicator, and keyboard shortcuts |
| **Dashboard** | Fragmented cards, small charts, crowded KPI blocks | Missing single strong call-to-action; hard for judges to scan in 30 seconds | Single confident headline, prominent "Open Active Case" action, 3 key metrics (Total Filings, Compliance Rate, Pending Reviews), clean recent-cases table |
| **Applications Registry** | Default table with dense borders and repetitive text | Status colors compete for attention; action buttons look cramped | Modern enterprise data list with badge hierarchy, search filter, and 1-click case inspection |
| **Application Workspace** | 5 buttons with competing styles at top; crowded metadata strip | Too many primary actions competing; tabs feel heavy | Unified Case Header with persistent status pill, 1 primary action ("Run Regulatory Validation"), clean tab bar (Overview & Docs, OCR Entities, Findings, Evidence Passport, Dossier Report) |
| **Evidence Explorer** | Disconnected viewer cards with simulated coordinate boxes | Canvas feels like a mockup rather than high-precision spatial OCR tool | Dual-panel forensic inspection desk: left panel findings navigator, center/right high-res document page with coordinate highlighter and side-by-side discrepancy comparison |
| **Validation Center** | Large banners and repetitive cards | Explanatory text repeats on every finding; action buttons buried | Streamlined finding accordion with rule citation, clause reference, severity badge, and 1-click disposition |
| **ReguTrace Replay** | Dense multi-column comparisons | Hard to immediately see what changed between policy versions | Visual Diff cards with explicit "Newly Failing", "Newly Passing", and "Unchanged" impact counters and parameter changes |
| **Evidence Passport** | Generic timeline cards | Does not feel like a cryptographic dossier | Formal Case Passport card with SHA-256 fingerprints, cryptographic audit-chain badge, and direct links to inspected evidence |
| **Audit Ledger** | Dense table with repeated hashes | Difficult to scan quickly | Streamlined chronological event stream with cryptographic block links |
