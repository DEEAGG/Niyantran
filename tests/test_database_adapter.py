"""
Unit and regression tests for SQLite / PostgreSQL dual-engine database adapter
and cryptographic audit-chain integrity.
"""

import os
from unittest.mock import MagicMock
import pytest

from app.db import (
    get_connection,
    is_postgres,
    PostgresRow,
    PostgresCursorWrapper,
    PostgresConnectionWrapper,
    compute_entry_hash,
    verify_audit_chain,
)


def test_sqlite_default_connection_mode():
    """Verify that by default (no DATABASE_URL), connection uses SQLite and is_postgres is False."""
    assert is_postgres() is False
    with get_connection() as conn:
        res = conn.execute("SELECT 1 as test_col").fetchone()
        assert res["test_col"] == 1
        assert res[0] == 1


def test_postgres_row_wrapper_dual_access():
    """Verify PostgresRow supports dict-key and numeric-index access like sqlite3.Row."""
    row = PostgresRow({"id": "USR-101", "email": "officer@aicte.gov.in", "role": "reviewer"})
    assert row["id"] == "USR-101"
    assert row[0] == "USR-101"
    assert row["email"] == "officer@aicte.gov.in"
    assert row[1] == "officer@aicte.gov.in"
    assert row.get("role") == "reviewer"
    assert len(row) == 3


def test_postgres_cursor_wrapper_query_translation():
    """Verify ? parameter placeholders are translated to %s and PRAGMAs become no-ops."""
    mock_raw_cursor = MagicMock()
    wrapper = PostgresCursorWrapper(mock_raw_cursor)

    # 1. PRAGMA query -> no-op
    wrapper.execute("PRAGMA foreign_keys = ON")
    mock_raw_cursor.execute.assert_not_called()

    # 2. SQLite ? parameter query -> %s
    wrapper.execute("SELECT * FROM users WHERE email = ? AND role = ?", ("test@example.com", "reviewer"))
    mock_raw_cursor.execute.assert_called_once_with(
        "SELECT * FROM users WHERE email = %s AND role = %s",
        ("test@example.com", "reviewer"),
    )


def test_postgres_cursor_wrapper_audit_insert_lastrowid():
    """Verify that INSERT INTO audit_log automatically appends RETURNING id to capture lastrowid."""
    mock_raw_cursor = MagicMock()
    mock_raw_cursor.fetchone.return_value = (42,)
    wrapper = PostgresCursorWrapper(mock_raw_cursor)

    sql = "INSERT INTO audit_log (event_type, actor, entity_type, entity_id, event_json, previous_hash, entry_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    params = ("LOGIN", "admin", "user", "U1", "{}", "GENESIS", "abc123hash", "2026-10-27T00:00:00Z")

    wrapper.execute(sql, params)
    assert wrapper.lastrowid == 42
    args, _ = mock_raw_cursor.execute.call_args
    assert "RETURNING id" in args[0]
    assert "%s" in args[0]
    assert "?" not in args[0]


def test_audit_chain_integrity_verification():
    """Verify that existing SQLite audit chain remains valid and unbroken."""
    with get_connection() as conn:
        result = verify_audit_chain(conn)
        assert result["verified"] is True
        assert result["total_records"] > 1000
        assert "latest_hash" in result
        assert len(result["latest_hash"]) == 64  # SHA-256 length
