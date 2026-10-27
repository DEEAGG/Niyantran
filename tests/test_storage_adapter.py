"""
Unit and regression tests for Unified Document Storage Adapter (app/storage.py).
"""

import os
from pathlib import Path
import pytest

from app.storage import (
    is_r2_configured,
    get_r2_config,
    save_file,
    get_file_path,
    get_file_bytes,
    file_exists,
    _normalize_key,
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


def test_normalize_key():
    """Verify that keys with backslashes or data/ prefixes are normalized cleanly."""
    assert _normalize_key(r"documents\abc.pdf") == "documents/abc.pdf"
    assert _normalize_key("data/documents/abc.pdf") == "documents/abc.pdf"
    assert _normalize_key("./data/documents/abc.pdf") == "documents/abc.pdf"
    assert _normalize_key("documents/abc.pdf") == "documents/abc.pdf"


def test_local_storage_crud_lifecycle(tmp_path, monkeypatch):
    """Verify local file save, path resolution, bytes read, and existence checks."""
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
