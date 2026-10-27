"""
NIYANTRAN — Unified Document Storage Adapter.

Provides seamless local-disk storage for development and testing, and
persistent remote object storage for production (Supabase Storage or Cloudflare R2 / S3-compatible).

Architecture:
- Preserves exact database paths ("documents/<uuid>.<ext>") as object keys in remote storage.
- Storage Priority:
    1. Supabase Storage (if SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY are configured)
    2. Cloudflare R2 / S3 (if R2_BUCKET_NAME & credentials are configured)
    3. Local filesystem (data/documents/ or /tmp cache in serverless)
- When remote storage is enabled, reads act as a read-through cache to /tmp for fast rendering with PyMuPDF/Pillow.
- When remote storage is unconfigured, falls back completely to local disk storage with zero external dependencies.
- Kept strictly private on server-side; credentials are never passed to the frontend.
"""

import os
import io
import shutil
from pathlib import Path
from typing import Optional, Dict, Any, Union

import httpx

from app.db import DATA_DIR, DOCUMENTS_DIR, REGULATORY_SOURCES_DIR

# Temporary cache directory for serverless environments
CACHE_DIR = Path(os.getenv("NIYANTRAN_CACHE_DIR", "/tmp/niyantran_cache" if os.name != "nt" else DATA_DIR / ".cache"))
try:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
except (PermissionError, OSError):
    pass

_s3_client = None


# --- Supabase Storage Integration ---

def is_supabase_configured() -> bool:
    """Returns True if Supabase Storage credentials are set."""
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")).strip()
    return bool(url and key)


def get_supabase_config() -> Dict[str, str]:
    """Resolves Supabase Storage configuration settings."""
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")).strip()
    bucket = (os.getenv("SUPABASE_STORAGE_BUCKET") or os.getenv("SUPABASE_BUCKET", "niyantran-documents")).strip()
    return {
        "url": url,
        "key": key,
        "bucket": bucket,
    }


def _supabase_upload(key: str, content: bytes, mime_type: Optional[str] = None) -> None:
    """Uploads file content to a private Supabase Storage bucket using service role credentials."""
    cfg = get_supabase_config()
    upload_url = f"{cfg['url']}/storage/v1/object/{cfg['bucket']}/{key}"
    headers = {
        "Authorization": f"Bearer {cfg['key']}",
        "apiKey": cfg["key"],
        "Content-Type": mime_type or "application/octet-stream",
        "x-upsert": "true",
    }
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(upload_url, headers=headers, content=content)
        resp.raise_for_status()


def _supabase_download(key: str) -> Optional[bytes]:
    """Downloads file bytes from a private Supabase Storage bucket using service role credentials."""
    cfg = get_supabase_config()
    download_url = f"{cfg['url']}/storage/v1/object/authenticated/{cfg['bucket']}/{key}"
    headers = {
        "Authorization": f"Bearer {cfg['key']}",
        "apiKey": cfg["key"],
    }
    with httpx.Client(timeout=30.0) as client:
        resp = client.get(download_url, headers=headers)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.content


def _supabase_exists(key: str) -> bool:
    """Checks whether an object exists in a private Supabase Storage bucket."""
    cfg = get_supabase_config()
    info_url = f"{cfg['url']}/storage/v1/object/info/authenticated/{cfg['bucket']}/{key}"
    headers = {
        "Authorization": f"Bearer {cfg['key']}",
        "apiKey": cfg["key"],
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(info_url, headers=headers)
            return resp.status_code == 200
    except Exception:
        return False


# --- Cloudflare R2 / S3 Integration ---

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


def is_remote_storage_configured() -> bool:
    """Returns True if any remote object storage (Supabase or R2/S3) is configured."""
    return is_supabase_configured() or is_r2_configured()


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
    """Saves file content to local storage and remote object storage (Supabase or R2) if configured."""
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

    # 2. Upload to remote storage if configured (Priority: Supabase > R2)
    if is_supabase_configured():
        _supabase_upload(key, content, mime_type=mime_type)
    elif is_r2_configured():
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
    If not found locally and remote storage is configured, downloads object from Supabase/R2 into cache.
    """
    key = _normalize_key(relative_path_or_key)

    # Check local candidates first
    for candidate in _get_local_candidate_paths(key):
        if candidate.exists() and candidate.is_file():
            return candidate

    # Download from remote storage into local cache if missing
    cache_path = CACHE_DIR / key
    if is_supabase_configured():
        try:
            content = _supabase_download(key)
            if content is not None:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_bytes(content)
                return cache_path
        except Exception:
            pass
    elif is_r2_configured():
        s3 = get_s3_client()
        cfg = get_r2_config()
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            s3.download_file(cfg["bucket"], key, str(cache_path))
            return cache_path
        except Exception:
            pass

    # Return default local path (caller handles .exists() == False)
    return DATA_DIR / key


def get_file_bytes(relative_path_or_key: Union[str, Path]) -> Optional[bytes]:
    """Reads and returns file bytes from local disk, Supabase, or R2."""
    local_path = get_file_path(relative_path_or_key)
    if local_path.exists() and local_path.is_file():
        return local_path.read_bytes()

    key = _normalize_key(relative_path_or_key)
    if is_supabase_configured():
        try:
            return _supabase_download(key)
        except Exception:
            return None
    elif is_r2_configured():
        s3 = get_s3_client()
        cfg = get_r2_config()
        try:
            resp = s3.get_object(Bucket=cfg["bucket"], Key=key)
            return resp["Body"].read()
        except Exception:
            return None

    return None


def file_exists(relative_path_or_key: Union[str, Path]) -> bool:
    """Checks whether a file exists locally or in remote storage."""
    key = _normalize_key(relative_path_or_key)
    for candidate in _get_local_candidate_paths(key):
        if candidate.exists() and candidate.is_file():
            return True

    if is_supabase_configured():
        return _supabase_exists(key)
    elif is_r2_configured():
        s3 = get_s3_client()
        cfg = get_r2_config()
        try:
            s3.head_object(Bucket=cfg["bucket"], Key=key)
            return True
        except Exception:
            return False

    return False
