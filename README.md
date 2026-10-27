# NIYANTRAN — Intelligent Regulatory Verification Platform

> **Powered by ReguTrace** | *Every Decision. Backed by Evidence.*  
> Developed for regulatory scrutiny, statutory compliance automation, and evidence-backed verification.

---

## Overview

**NIYANTRAN** is an enterprise-grade regulatory verification platform designed to streamline and automate compliance evaluation for technical education institutions. It bridges the gap between complex statutory regulations (such as AICTE Approval Process Handbooks) and institutional application documents through deterministic rule checking, tamper-evident audit ledgers, and spatial evidence verification.

### Core Capabilities

- **Statutory Regulatory Ingestion**: Ingests official gazettes, circulars, and handbooks with clause-level granularity, page-level citation, and automatic supersession tracking.
- **Precision Document Extraction**: Multi-stage parsing utilizing high-fidelity PyMuPDF rasterization, native digital text extraction, and Tesseract OCR fallback with spatial bounding-box coordinates.
- **Evidence-Based Rule Engine**: Deterministic compliance rules mapped to official statutory clauses, preventing unverified or hallucinated decisions.
- **Cryptographic Audit Ledger**: Append-only SHA-256 chained transaction log ensuring tamper-evident provenance across all review decisions and status transitions.
- **Institutional Data Isolation & RBAC**: Strict role-based access control supporting Institution Users, Scrutiny Reviewers, Administrative Officers, and Independent Auditors.
- **Automated Evidence Dossier**: Printable Jinja2 compliance passports summarizing all findings, clause citations, and cryptographic signatures.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite 5, React Router 6, Tailwind CSS, Lucide Icons, Recharts, Framer Motion |
| **Backend** | FastAPI, Python 3.12 / 3.14, Uvicorn, Pydantic v2 |
| **Document Processing** | PyMuPDF (fitz), pypdf, Pillow, Tesseract OCR |
| **Database & Ledger** | SQLite with WAL mode, SHA-256 cryptographic hash chains |
| **Deployment Target** | Vercel (Edge SPA Frontend + Serverless FastAPI Backend) |

---

## Repository Structure

```
Niyantran/
├── api/
│   └── index.py             # Vercel Serverless Function entry point
├── app/
│   ├── auth.py              # JWT authentication, password hashing, and RBAC
│   ├── authenticity.py      # Document tampering & authenticity signals
│   ├── db.py                # Database connection, schema migrations, and audit chain
│   ├── extractor.py         # Multi-format document parser & field extractor
│   ├── main.py              # FastAPI application routes and lifecycle
│   ├── regulatory_ingestion.py # Clause parser, hierarchy, and supersession
│   ├── replay.py            # Historical decision diff and replay engine
│   ├── report.py            # Standalone Jinja2 compliance dossier generator
│   └── rules_engine.py      # Deterministic compliance rule validator
├── frontend/
│   ├── src/                 # React components, pages, context, and services
│   ├── public/              # Static SVG and branding assets
│   ├── package.json         # Frontend dependencies and Vite scripts
│   ├── vite.config.js       # Vite configuration with local proxy
│   └── vercel.json          # Frontend-specific Vercel configuration
├── scripts/                 # Ingestion, inspection, and verification scripts
├── tests/                   # Pytest automated test suite (98+ test cases)
├── data/                    # Local database and document storage (gitignored)
├── Dockerfile               # Production container definition
├── requirements.txt         # Backend Python dependencies
├── vercel.json              # Monorepo root Vercel configuration
├── DEPLOYMENT_GUIDE.md      # Detailed Vercel production deployment guide
└── .env.example             # Environment configuration template
```

---

## Local Development Setup

### 1. Prerequisites
- Python 3.12 or later
- Node.js 18 or later (npm 9+)
- *(Optional)* Tesseract OCR for scanned document processing

### 2. Backend Setup

```bash
# Clone the repository
git clone https://github.com/DEEAGG/Niyantran.git
cd Niyantran

# Create and activate a Python virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be live at `http://127.0.0.1:8000`  
Interactive Swagger documentation: `http://127.0.0.1:8000/docs`

### 3. Frontend Setup

In a separate terminal:

```bash
# Navigate to the frontend directory
cd frontend

# Install frontend dependencies
npm install

# Start Vite development server
npm run dev
```

The frontend will be available at `http://localhost:3000`.  
API requests to `/api` are automatically proxied to `http://127.0.0.1:8000`.

---

## Default User Accounts (Development & Evaluation)

| Role | Email | Password | Scope |
|---|---|---|---|
| **Reviewer** | `officer@aicte.gov.in` | `Officer@2026` | Full scrutiny & regulatory verification |
| **Institution** | `adgips@institution.edu.in` | `Adgips@2026` | Institutional submission & document upload |
| **Administrator** | `admin@niyantran.local` | `Admin@2026` | System configuration & clause ingestion |

---

## Testing

Run the full automated backend test suite:

```bash
# From the repository root with virtual environment activated:
pytest
```

Run the frontend production build verification:

```bash
cd frontend
npm run build
```

---

## Deployment to Vercel

The repository is configured for a fresh monorepo deployment on **Vercel**:
- Root `vercel.json` coordinates building the Vite frontend and routing `/api/(.*)` requests to the Serverless FastAPI backend at `api/index.py`.
- For complete deployment instructions, environment variable setup, and serverless database considerations, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

---

## License

Proprietary & Confidential — Smart India Hackathon (SIH 26261).
