"""
NIYANTRAN — Unified Document Storage Adapter.

Provides seamless local-disk storage for development and testing, and
Cloudflare R2 (S3-compatible) persistent object storage for production (Vercel Serverless).

Architecture:
- Preserves exact database paths ("documents/<uuid>.<ext>") as object keys in R2.
- When R2 is enabled, reads act as a read-through cache to /tmp for fast rendering with PyMuPDF/Pillow.
- When R2 is unconfigured, falls back completely to local disk storage with zero external dependencies.
"""

import os
import io
import shutil
from pathlib import Path
from typing import Optional, Dict, Any, Union

from app.db import DATA_DIR, DOCUMENTS_DIR, REGULATORY_SOURCES_DIR

# Temporary cache directory for serverless environments
CACHE_DIR = Path(os.getenv("NIYANTRAN_CACHE_DIR", "/tmp/niyantran_cache" if os.name != "nt" else DATA_DIR / ".cache"))
try:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
except (PermissionError, OSError):
    pass

_s3_client = None


def is_r2_configured() -> bool:
    """Returns True if Cloudflare R2 (or S3-compatible) storage environment variables are set."""
    bucket = os.getenv("R2_BUCKET_NAME") or os.getenv("S3_BUCKET_NAME")
    access_key = os.getenv("R2_ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")
    return bool(bucket and access_key and secret_key)


def get_r2_config() -> Dict[str, str]:
    """Resolves R2 configuration settings."""
    bucket = os.getenv("R2_BUCKET_NAME") or os.getenv("S3_BUCKET_NAME", "")
    access_key = os.getenv("R2_ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY_ID", "")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY", "")
    account_id = os.getenv("R2_ACCOUNT_ID", "")

    endpoint_url = os.getenv("R2_ENDPOINT_URL") or os.getenv("S3_ENDPOINT_URL")
    if not endpoint_url and account_id:
        endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"

    region = os.getenv("R2_REGION", "auto")

    return {
        "bucket": bucket,
        "access_key": access_key,
        "secret_key": secret_key,
        "endpoint_url": endpoint_url or "",
        "region": region,
    }


def get_s3_client():
    """Lazily initializes and returns a boto3 S3 client for Cloudflare R2."""
    global _s3_client
    if _s3_client is not None:
        return _s3_client

    import boto3
    from botocore.config import Config

    cfg = get_r2_config()
    _s3_client = boto3.client(
        "s3",
        endpoint_url=cfg["endpoint_url"],
        aws_access_key_id=cfg["access_key"],
        aws_secret_access_key=cfg["secret_key"],
        region_name=cfg["region"],
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
            s3={"addressing_style": "path"},
        ),
    )
    return _s3_client


def _normalize_key(path_or_key: Union[str, Path]) -> str:
    """Normalizes relative path or key to forward-slash format (e.g. 'documents/xyz.pdf')."""
    s = str(path_or_key).replace("\\", "/")
    if s.startswith("./"):
        s = s[2:]
    if s.startswith("data/"):
        s = s[5:]
    return s.lstrip("/")


def _get_local_candidate_paths(key: str) -> list[Path]:
    """Returns potential local filesystem paths for a given key."""
    candidates = []
    # 1. Direct path under DATA_DIR (e.g. data/documents/xyz.pdf)
    candidates.append(DATA_DIR / key)
    # 2. Under DOCUMENTS_DIR using just filename
    filename = Path(key).name
    candidates.append(DOCUMENTS_DIR / filename)
    # 3. Under REGULATORY_SOURCES_DIR
    candidates.append(REGULATORY_SOURCES_DIR / filename)
    # 4. Under local /tmp cache directory
    candidates.append(CACHE_DIR / key)
    candidates.append(CACHE_DIR / filename)
    return candidates


def save_file(relative_path: Union[str, Path], content: bytes, mime_type: Optional[str] = None) -> Path:
    """Saves file content to local storage and R2 if configured. Returns local Path."""
    key = _normalize_key(relative_path)

    # 1. Save to local storage / cache
    local_target = DATA_DIR / key
    try:
        local_target.parent.mkdir(parents=True, exist_ok=True)
        local_target.write_bytes(content)
        saved_path = local_target
    except (PermissionError, OSError):
        # In read-only serverless container, write to CACHE_DIR (/tmp)
        cache_target = CACHE_DIR / key
        cache_target.parent.mkdir(parents=True, exist_ok=True)
        cache_target.write_bytes(content)
        saved_path = cache_target

    # 2. Upload to Cloudflare R2 if configured
    if is_r2_configured():
        s3 = get_s3_client()
        cfg = get_r2_config()
        extra_args = {}
        if mime_type:
            extra_args["ContentType"] = mime_type
        s3.put_object(
            Bucket=cfg["bucket"],
            Key=key,
            Body=content,
            **extra_args,
        )

    return saved_path


def get_file_path(relative_path_or_key: Union[str, Path]) -> Path:
    """Resolves a local filesystem Path for reading.
    
    If local file exists, returns it immediately.
    If not found locally and R2 is configured, downloads object from R2 into cache directory.
    """
    key = _normalize_key(relative_path_or_key)

    # Check local candidates first
    for candidate in _get_local_candidate_paths(key):
        if candidate.exists() and candidate.is_file():
            return candidate

    # If missing locally and R2 is configured, download from R2
    if is_r2_configured():
        s3 = get_s3_client()
        cfg = get_r2_config()
        cache_path = CACHE_DIR / key
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            s3.download_file(cfg["bucket"], key, str(cache_path))
            return cache_path
        except Exception as exc:
            pass

    # Return default local path (caller handles .exists() == False)
    return DATA_DIR / key


def get_file_bytes(relative_path_or_key: Union[str, Path]) -> Optional[bytes]:
    """Reads and returns file bytes from local disk or R2."""
    local_path = get_file_path(relative_path_or_key)
    if local_path.exists() and local_path.is_file():
        return local_path.read_bytes()

    if is_r2_configured():
        key = _normalize_key(relative_path_or_key)
        s3 = get_s3_client()
        cfg = get_r2_config()
        try:
            resp = s3.get_object(Bucket=cfg["bucket"], Key=key)
            return resp["Body"].read()
        except Exception:
            return None

    return None


def file_exists(relative_path_or_key: Union[str, Path]) -> bool:
    """Checks whether a file exists locally or in R2."""
    key = _normalize_key(relative_path_or_key)
    for candidate in _get_local_candidate_paths(key):
        if candidate.exists() and candidate.is_file():
            return True

    if is_r2_configured():
        s3 = get_s3_client()
        cfg = get_r2_config()
        try:
            s3.head_object(Bucket=cfg["bucket"], Key=key)
            return True
        except Exception:
            return False

    return False
