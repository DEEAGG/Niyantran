# NIYANTRAN — Production Deployment Guide

## Architecture Overview

```
                      +----------------------------------------+
                      |               Vercel Edge              |
                      |   Frontend (React 18 + Vite 5 SPA)    |
                      |     https://niyantran.vercel.app       |
                      +-------------------+--------------------+
                                          |
                        API Requests / CORS / Reverse Proxy
                                          |
                                          v
                      +----------------------------------------+
                      |         Render / Railway Cloud         |
                      |   Backend (FastAPI + Docker Container) |
                      |    https://niyantran-api.onrender.com  |
                      |                                        |
                      |  - Tesseract OCR (System Package)      |
                      |  - PyMuPDF Native Rendering Engine     |
                      |  - Persistent Disk (/app/data)         |
                      |     * SQLite (niyantran.db)            |
                      |     * Uploaded PDFs (/documents)       |
                      +----------------------------------------+
```

---

## 1. Deploy Frontend to Vercel

1. Go to [vercel.com/new](https://vercel.com/new).
2. Connect your GitHub account and select **`DEEAGG/niyantran`**.
3. In the project configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` *(or leave `.` because the root `vercel.json` will route it)*
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add the following **Environment Variables**:
   | Variable | Value | Description |
   |---|---|---|
   | `VITE_API_BASE_URL` | `https://<YOUR-RENDER-BACKEND-URL>/api` | Production FastAPI backend URL |
   | `VITE_USE_MOCK_API` | `false` | Disables mock data, enables live backend |
   | `VITE_APP_ENV` | `production` | Production environment flag |
   | `VITE_APP_NAME` | `NIYANTRAN` | Platform Branding |
   | `VITE_APP_ENGINE` | `ReguTrace` | Regulatory Verification Engine |
5. Click **Deploy**.
6. When deployment finishes, copy your live frontend URL (e.g. `https://niyantran-xxx.vercel.app`).

---

## 2. Deploy Backend to Render

1. Go to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Select **`DEEAGG/niyantran`**.
4. Configure service details:
   - **Name**: `niyantran-backend`
   - **Runtime**: `Docker` *(Render automatically picks up `Dockerfile`)*
   - **Region**: Closest to your users (e.g., Singapore or Frankfurt)
   - **Plan**: Standard or Starter
5. Under **Disks** (optional, recommended for permanent persistence across restarts):
   - **Name**: `niyantran-data`
   - **Mount Path**: `/app/data`
   - **Size**: `1 GB`
6. Add the following **Environment Variables**:
   | Variable | Value | Description |
   |---|---|---|
   | `NIYANTRAN_ENV` | `production` | Production environment |
   | `CORS_ORIGINS` | `https://*.vercel.app,https://<YOUR-VERCEL-DOMAIN>` | Allowed CORS origins |
   | `JWT_SECRET_KEY` | *(Generate a 32-character random string)* | Secure token signing |
   | `PORT` | `8000` | Render standard port |
7. Click **Create Web Service**.
8. Render will build the Docker container (installing `tesseract-ocr`, `pymupdf`, etc.), run initial migrations and synthetic demo seeding, and launch on a public HTTPS URL (e.g. `https://niyantran-backend.onrender.com`).

---

## 3. Post-Deployment Verification Checklist

Once both services are live:

1. **Backend Health Check**:
   - Open `https://<BACKEND_URL>/api/health` in browser:
     Expected response: `{"status": "healthy", "database": "connected"}`
   - Open `https://<BACKEND_URL>/api/ocr/status`:
     Expected response: `{"available": true, "version": "...", "pdf_ocr": true}`

2. **Frontend Route Verification**:
   - Open `https://<FRONTEND_URL>/login`
   - Log in using an authorized account:
     - Reviewer: `officer@aicte.gov.in` / `Officer@2026`
     - Institution: `adgips@institution.edu.in` / `Adgips@2026`
     - Admin: `admin@niyantran.local` / `Admin@2026`
   - Refresh the page on `/cases` or `/evidence` to verify SPA fallback rewrite (no 404).

3. **Core Features Verification**:
   - Check that application list loads and displays status badges.
   - Click an application to view details and evidence explorer.
   - Test PDF document upload and field extraction.
   - Run validation engine against statutory clauses.
   - Generate and download compliance dossier report.
