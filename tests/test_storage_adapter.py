"""
Unit and regression tests for Unified Document Storage Adapter (app/storage.py).
Tests local filesystem fallback, Supabase Storage REST integration, Cloudflare R2,
and robust error handling.
"""

import os
from pathlib import Path
from unittest.mock import MagicMock
import httpx
import pytest

from app.storage import (
    is_supabase_configured,
    get_supabase_config,
    is_r2_configured,
    get_r2_config,
    is_remote_storage_configured,
    save_file,
    get_file_path,
    get_file_bytes,
    file_exists,
    _normalize_key,
    CACHE_DIR,
)


def test_storage_r2_detection_default(monkeypatch):
    """Verify that R2 is not detected when credentials are not configured."""
    monkeypatch.delenv("R2_BUCKET_NAME", raising=False)
    monkeypatch.delenv("S3_BUCKET_NAME", raising=False)
    assert is_r2_configured() is False


def test_storage_r2_detection_when_configured(monkeypatch):
    """Verify that R2 is detected when bucket and credentials are set."""
    monkeypatch.setenv("R2_BUCKET_NAME", "niyantran-docs")
    monkeypatch.setenv("R2_ACCESS_KEY_ID", "mock_access_key_123")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "mock_secret_key_456")
    monkeypatch.setenv("R2_ACCOUNT_ID", "mock_account_id_789")

    assert is_r2_configured() is True
    cfg = get_r2_config()
    assert cfg["bucket"] == "niyantran-docs"
    assert cfg["access_key"] == "mock_access_key_123"
    assert cfg["secret_key"] == "mock_secret_key_456"
    assert "https://mock_account_id_789.r2.cloudflarestorage.com" in cfg["endpoint_url"]


def test_supabase_storage_detection_default(monkeypatch):
    """Verify Supabase Storage is not detected when env vars are missing."""
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    assert is_supabase_configured() is False
    assert is_remote_storage_configured() is False


def test_supabase_storage_detection_when_configured(monkeypatch):
    """Verify Supabase Storage detection and config resolution."""
    monkeypatch.setenv("SUPABASE_URL", "https://xyzcompany.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-secret-key-12345")
    monkeypatch.delenv("SUPABASE_STORAGE_BUCKET", raising=False)

    assert is_supabase_configured() is True
    assert is_remote_storage_configured() is True

    cfg = get_supabase_config()
    assert cfg["url"] == "https://xyzcompany.supabase.co"
    assert cfg["key"] == "mock-service-role-secret-key-12345"
    assert cfg["bucket"] == "niyantran-documents"  # Default bucket name


def test_normalize_key():
    """Verify that keys with backslashes or data/ prefixes are normalized cleanly."""
    assert _normalize_key(r"documents\abc.pdf") == "documents/abc.pdf"
    assert _normalize_key("data/documents/abc.pdf") == "documents/abc.pdf"
    assert _normalize_key("./data/documents/abc.pdf") == "documents/abc.pdf"
    assert _normalize_key("documents/abc.pdf") == "documents/abc.pdf"


def test_local_storage_crud_lifecycle(tmp_path, monkeypatch):
    """Verify local file save, path resolution, bytes read, and existence checks."""
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.delenv("R2_BUCKET_NAME", raising=False)
    monkeypatch.delenv("S3_BUCKET_NAME", raising=False)

    test_content = b"%PDF-1.4 Mock Document Content for Storage Test"
    relative_path = "documents/test_storage_doc.pdf"

    # Save
    saved_path = save_file(relative_path, test_content, mime_type="application/pdf")
    assert saved_path.exists()
    assert saved_path.read_bytes() == test_content

    # Path resolution
    resolved_path = get_file_path(relative_path)
    assert resolved_path.exists()
    assert resolved_path == saved_path

    # Bytes read
    bytes_data = get_file_bytes(relative_path)
    assert bytes_data == test_content

    # Existence check
    assert file_exists(relative_path) is True
    assert file_exists("documents/non_existent_file_9999.pdf") is False

    # Cleanup test file
    try:
        saved_path.unlink()
    except Exception:
        pass


def test_supabase_upload_mock(monkeypatch):
    """Verify save_file uploads to Supabase Storage endpoint with proper headers and payload."""
    monkeypatch.setenv("SUPABASE_URL", "https://mockproject.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key-999")
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "niyantran-documents")

    captured_requests = []

    def mock_post(self, url, *args, **kwargs):
        req = httpx.Request("POST", str(url), headers=kwargs.get("headers"), content=kwargs.get("content"))
        captured_requests.append({
            "url": str(url),
            "headers": kwargs.get("headers", {}),
            "content": kwargs.get("content", b""),
        })
        return httpx.Response(status_code=200, json={"Key": "mock/key"}, request=req)

    monkeypatch.setattr(httpx.Client, "post", mock_post)

    test_content = b"Mock PDF bytes for upload test"
    relative_path = "documents/supabase_mock_upload_test.pdf"

    saved_path = save_file(relative_path, test_content, mime_type="application/pdf")

    assert len(captured_requests) == 1
    req = captured_requests[0]
    expected_url = "https://mockproject.supabase.co/storage/v1/object/niyantran-documents/documents/supabase_mock_upload_test.pdf"
    assert req["url"] == expected_url
    assert req["headers"]["Authorization"] == "Bearer mock-service-role-key-999"
    assert req["headers"]["apiKey"] == "mock-service-role-key-999"
    assert req["headers"]["Content-Type"] == "application/pdf"
    assert req["headers"]["x-upsert"] == "true"
    assert req["content"] == test_content

    try:
        saved_path.unlink()
    except Exception:
        pass


def test_supabase_download_mock(monkeypatch, tmp_path):
    """Verify get_file_bytes and get_file_path download from Supabase Storage into cache when local file is absent."""
    monkeypatch.setenv("SUPABASE_URL", "https://mockproject.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key-999")
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "niyantran-documents")

    test_cache_dir = tmp_path / "cache"
    monkeypatch.setattr("app.storage.CACHE_DIR", test_cache_dir)

    remote_file_content = b"%PDF-1.4 Mock Remote Document Downloaded from Supabase Storage"
    relative_key = "documents/remote_only_file_xyz.pdf"

    def mock_get(self, url, *args, **kwargs):
        url_str = str(url)
        req = httpx.Request("GET", url_str)
        if "authenticated" in url_str and "remote_only_file_xyz.pdf" in url_str:
            return httpx.Response(status_code=200, content=remote_file_content, request=req)
        return httpx.Response(status_code=404, request=req)

    monkeypatch.setattr(httpx.Client, "get", mock_get)

    # 1. get_file_bytes downloads and returns bytes
    data = get_file_bytes(relative_key)
    assert data == remote_file_content

    # 2. get_file_path caches the file locally in CACHE_DIR
    cached_path = get_file_path(relative_key)
    assert cached_path.exists()
    assert cached_path.read_bytes() == remote_file_content


def test_supabase_exists_and_error_handling(monkeypatch):
    """Verify file_exists handles Supabase 200, 404, and network errors gracefully."""
    monkeypatch.setenv("SUPABASE_URL", "https://mockproject.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key-999")
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "niyantran-documents")

    def mock_get(self, url, *args, **kwargs):
        url_str = str(url)
        req = httpx.Request("GET", url_str)
        if "existing_file" in url_str:
            return httpx.Response(status_code=200, request=req)
        elif "missing_file" in url_str:
            return httpx.Response(status_code=404, request=req)
        elif "server_error" in url_str:
            return httpx.Response(status_code=500, request=req)
        raise httpx.ConnectError("Network connection unreachable")

    monkeypatch.setattr(httpx.Client, "get", mock_get)

    assert file_exists("documents/existing_file.pdf") is True
    assert file_exists("documents/missing_file.pdf") is False
    assert file_exists("documents/server_error.pdf") is False
    assert file_exists("documents/network_timeout_file.pdf") is False
