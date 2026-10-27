import sys
from pathlib import Path

# Add project root directory to Python path so `app` package can be imported
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import app

# Expose app for Vercel Serverless Functions (@vercel/python runtime)
__all__ = ["app"]
