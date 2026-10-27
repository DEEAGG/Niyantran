# NIYANTRAN — Vercel Deployment Guide

## Architecture Overview

NIYANTRAN is an intelligent regulatory compliance and document verification platform built with:
- **Frontend**: React 18 + Vite 5 Single Page Application (SPA), styled with Tailwind CSS and Lucide icons.
- **Backend**: FastAPI (Python 3.12/3.14) providing statutory compliance verification, cryptographic audit trails, document extraction, and RBAC authentication.

```
                      +----------------------------------------+
                      |              Vercel Edge               |
                      |   Frontend (React 18 + Vite 5 SPA)     |
                      |     https://niyantran.vercel.app       |
                      +-------------------+--------------------+
                                          |
                                   Rewrites & Proxy
                                          |
                                          v
                      +----------------------------------------+
                      |         Vercel Serverless / Edge       |
                      |      Backend (FastAPI on Python)       |
                      |        Entry: api/index.py             |
                      |                                        |
                      |  - Native PDF Parsing (PyMuPDF / pypdf)|
                      |  - Regulatory Clause Engine            |
                      |  - SHA-256 Cryptographic Audit Ledger  |
                      |  - Role-Based Access Control (RBAC)    |
                      +----------------------------------------+
```

---

## 1. Vercel Monorepo Deployment Steps

1. Log in to [vercel.com](https://vercel.com) and click **Add New Project**.
2. Import the canonical GitHub repository: **`DEEAGG/Niyantran`**.
3. In the project setup configuration:
   - **Framework Preset**: `Vite` (or `Other`)
   - **Root Directory**: `.` (leave at repository root so root `vercel.json` routes both frontend and backend)
   - **Build Command**: `cd frontend && npm install && npm run build` (handled automatically by `vercel.json`)
   - **Output Directory**: `frontend/dist` (configured in `vercel.json`)

4. Configure the required **Environment Variables**:
   | Variable | Recommended Production Value | Description |
   |---|---|---|
   | `VITE_API_BASE_URL` | `/api` | Relative API path (avoids CORS issues on same domain) |
   | `VITE_USE_MOCK_API` | `false` | Enables live FastAPI backend integration |
   | `VITE_APP_ENV` | `production` | Production environment flag |
   | `VITE_APP_NAME` | `NIYANTRAN` | Platform Branding |
   | `VITE_APP_ENGINE` | `ReguTrace` | Regulatory Verification Engine |
   | `JWT_SECRET_KEY` | *(Generate a 32+ char secret)* | Cryptographic JWT signing key |
   | `CORS_ORIGINS` | `https://niyantran.vercel.app,https://*.vercel.app` | Allowed CORS origins |

5. Click **Deploy**.

---

## 2. Serverless Runtime & Storage Architecture Notice

When hosting on Vercel Serverless Functions, review these architectural differences from persistent servers:

### A. Ephemeral Storage vs. Persistent Database
* **Local Development**: Uses local SQLite at `data/niyantran.db` with full persistence.
* **Vercel Serverless Runtime**: Serverless function instances run in ephemeral microVMs where the root filesystem is read-only.
* **Production Recommendation**:
  * For state persistence across cold starts and concurrent invocations, connect a serverless external database:
    * **Turso (libSQL)**: Zero-config serverless SQLite drop-in with free tier.
    * **Neon Postgres / Supabase**: Serverless PostgreSQL with managed connection pooling.
  * For uploaded document storage, configure an S3-compatible bucket (e.g., Cloudflare R2 with 10 GB free tier and zero egress fees, or AWS S3).

### B. PDF Text Extraction vs. Scanned OCR
* **Native Digital PDFs**: Processed with full spatial precision and speed using PyMuPDF and pypdf without external binary dependencies.
* **Scanned Image OCR (Tesseract)**: Tesseract requires system-level C++ binaries. In serverless environments lacking the Tesseract binary, the application falls back safely to native text parsing.
* For heavy scanned document OCR in serverless environments, connect a dedicated cloud OCR endpoint or worker.

---

## 3. Post-Deployment Verification Checklist

Once the Vercel deployment is active:

1. **API Health Check**:
   - Navigate to `https://<YOUR-VERCEL-DOMAIN>/api/health`
   - Expected response: `{"status": "healthy", "database": "connected"}`

2. **OCR Engine Status**:
   - Navigate to `https://<YOUR-VERCEL-DOMAIN>/api/ocr/status`
   - Expected response: `{"available": <bool>, "version": "...", "pdf_ocr": true}`

3. **Frontend SPA Routing**:
   - Navigate to `https://<YOUR-VERCEL-DOMAIN>/login`
   - Test authorized roles:
     - Reviewer: `officer@aicte.gov.in` / `Officer@2026`
     - Institution: `adgips@institution.edu.in` / `Adgips@2026`
     - Administrator: `admin@niyantran.local` / `Admin@2026`
   - Direct-refresh any route (e.g. `/cases`, `/evidence`) to verify that the SPA fallback rewrite serves `index.html` without 404 errors.

4. **Compliance Workflows**:
   - Verify application listings with institutional data isolation.
   - Run statutory compliance checks against official regulatory clauses.
   - Inspect evidence extraction and SHA-256 audit ledger verification.
