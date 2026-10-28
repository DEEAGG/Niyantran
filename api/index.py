import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

# Add project root directory to Python path so `app` package can be imported.
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import app as fastapi_app


class PreserveOriginalPath:
    """
    ASGI middleware for Vercel Serverless Functions.
    Ensures that FastAPI routes receive the true API path and query parameters,
    regardless of how Vercel rewrites the request (direct /api/(.*), cross-project proxy,
    or __niyantran_path query parameter injection).
    Preserves request body streams (multipart/form-data POST uploads) and all headers.
    """
    def __init__(self, inner_app):
        self.inner_app = inner_app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            query_string = scope.get("query_string", b"").decode("latin-1")
            
            # Check for __niyantran_path in query params
            if "__niyantran_path" in query_string:
                pairs = parse_qsl(query_string, keep_blank_values=True)
                original_path = None
                kept = []
                for key, value in pairs:
                    if key == "__niyantran_path":
                        original_path = value
                    else:
                        kept.append((key, value))
                if original_path:
                    target_path = "/" + original_path.lstrip("/")
                    if not target_path.startswith("/api"):
                        target_path = "/api" + target_path
                    scope = dict(scope)
                    scope["path"] = target_path
                    scope["raw_path"] = target_path.encode("utf-8")
                    scope["query_string"] = urlencode(kept, doseq=True).encode("latin-1")

            # Check if path was collapsed to /api/index.py or /index.py without __niyantran_path
            path = scope.get("path", "")
            if path in ("/api/index.py", "/index.py", "/api/index", "/index"):
                headers = dict(scope.get("headers", []))
                matched = headers.get(b"x-matched-path", headers.get(b"x-forwarded-uri", b"")).decode("latin-1")
                if matched and matched not in ("/api/index.py", "/index.py"):
                    matched_path = "/" + matched.lstrip("/")
                    if not matched_path.startswith("/api"):
                        matched_path = "/api" + matched_path
                    scope = dict(scope)
                    scope["path"] = matched_path
                    scope["raw_path"] = matched_path.encode("utf-8")

        await self.inner_app(scope, receive, send)


# Expose app for Vercel Serverless Functions (@vercel/python runtime)
app = PreserveOriginalPath(fastapi_app)

__all__ = ["app", "PreserveOriginalPath"]
