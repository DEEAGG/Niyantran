import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

# Add project root directory to Python path so `app` package can be imported.
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import app as fastapi_app


class PreserveOriginalPath:
    """Restore the original /api/... path after Vercel rewrites to this function."""

    def __init__(self, inner_app):
        self.inner_app = inner_app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            query = scope.get("query_string", b"").decode("latin-1")
            pairs = parse_qsl(query, keep_blank_values=True)
            original_path = None
            kept = []
            for key, value in pairs:
                if key == "__niyantran_path":
                    original_path = value
                else:
                    kept.append((key, value))
            if original_path:
                scope = dict(scope)
                scope["path"] = original_path
                scope["raw_path"] = original_path.encode("utf-8")
                scope["query_string"] = urlencode(kept, doseq=True).encode("latin-1")
        await self.inner_app(scope, receive, send)


app = PreserveOriginalPath(fastapi_app)
__all__ = ["app"]
