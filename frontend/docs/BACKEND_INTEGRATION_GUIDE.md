# NIYANTRAN — Backend Developer Integration Guide
## Fast Track Guide for Python / FastAPI Teammates

Welcome, backend team! This guide explains how to connect your FastAPI backend to the NIYANTRAN frontend in minutes.

---

## 1. How the Frontend Communicates with Your Backend

The frontend uses a centralized API Service Layer (`src/services/`). All requests flow through `apiClient.js` which is powered by Axios.

### Environment Setup
In the frontend root directory (`C:\Users\Abc\.gemini\antigravity\scratch\aicte-verifyai\.env`):

```bash
# 1. Point to your FastAPI server:
VITE_API_BASE_URL=http://localhost:8000/api

# 2. Switch from Mock to Real FastAPI endpoints:
VITE_USE_MOCK_API=false
```

When `VITE_USE_MOCK_API=false`:
- All frontend components call your real FastAPI endpoints via HTTP requests.
- When `VITE_USE_MOCK_API=true`:
- The frontend operates entirely on synthetic in-memory data for independent demonstration.

---

## 2. Setting Up FastAPI CORS

Because the frontend runs on `http://localhost:3000` (or Vite's active port) and your FastAPI server runs on `http://localhost:8000`, configure CORS in your `main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="NIYANTRAN API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 3. Recommended FastAPI Project Structure

To align with the frontend contracts, organize your backend routes as follows:

```
backend/
├── app/
│   ├── main.py
│   ├── routers/
│   │   ├── dashboard.py    # GET /api/dashboard/summary
│   │   ├── applications.py # GET/POST /api/applications
│   │   ├── documents.py    # POST /api/applications/{id}/documents
│   │   ├── extraction.py   # POST /api/applications/{id}/extract
│   │   ├── validation.py   # POST /api/applications/{id}/validate
│   │   ├── rules.py        # GET/POST /api/rules
│   │   ├── replay.py       # POST /api/replays (ReguTrace Replay)
│   │   ├── review.py       # POST /api/findings/{id}/reviews
│   │   ├── reports.py      # GET /api/applications/{id}/report
│   │   └── audit.py        # GET /api/audit
│   ├── schemas/            # Pydantic schemas matching BACKEND_API_CONTRACT.md
│   └── services/           # OCR, LayoutLM, Rule Evaluator, PostgreSQL DB
```

---

## 4. Testing Endpoints Incrementally

You do not need to build all endpoints at once! You can implement one endpoint at a time:
1. Start with `GET /api/applications` and `GET /api/dashboard/summary`.
2. As each endpoint goes live, test it with your Swagger UI at `http://localhost:8000/docs`.
3. Open the NIYANTRAN frontend; the data will immediately render in the enterprise UI tables and charts!
