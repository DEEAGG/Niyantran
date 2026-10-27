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
    is_turso,
    get_turso_config,
    PostgresRow,
    PostgresCursorWrapper,
    PostgresConnectionWrapper,
    TursoCursorWrapper,
    TursoConnectionWrapper,
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


def test_turso_connection_mode_selection(monkeypatch):
    """Verify that is_turso detects TURSO_DATABASE_URL and libsql:// URLs."""
    # 1. Default -> False
    monkeypatch.delenv("TURSO_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert is_turso() is False
    assert is_postgres() is False

    # 2. TURSO_DATABASE_URL set
    monkeypatch.setenv("TURSO_DATABASE_URL", "libsql://niyantran-org.turso.io")
    monkeypatch.setenv("TURSO_AUTH_TOKEN", "mock_turso_token_123")
    assert is_turso() is True
    assert is_postgres() is False
    url, token = get_turso_config()
    assert url == "libsql://niyantran-org.turso.io"
    assert token == "mock_turso_token_123"

    # 3. DATABASE_URL with libsql://
    monkeypatch.delenv("TURSO_DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL", "libsql://niyantran-db.turso.io")
    assert is_turso() is True
    assert is_postgres() is False

    # 4. DATABASE_URL with postgresql:// -> is_postgres True, is_turso False
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@ep-xyz.neon.tech/neondb")
    assert is_postgres() is True
    assert is_turso() is False


def test_turso_wrapper_crud_and_row_access(tmp_path):
    """Verify TursoConnectionWrapper and TursoCursorWrapper using local file client."""
    import libsql_client

    db_file = tmp_path / "test_turso_adapter.db"
    raw_client = libsql_client.create_client_sync(f"file:{db_file}")
    conn = TursoConnectionWrapper(raw_client)

    try:
        # 1. Execute DDL script
        conn.executescript("""
            CREATE TABLE demo_users (id TEXT PRIMARY KEY, email TEXT, full_name TEXT);
            CREATE TABLE demo_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT);
        """)

        # 2. Executemany batch insert with ? placeholders
        users_data = [
            ("U-001", "officer@aicte.gov.in", "Dr. A. Sharma"),
            ("U-002", "adgips@institution.edu.in", "ADGIPS Officer"),
        ]
        conn.executemany("INSERT INTO demo_users (id, email, full_name) VALUES (?, ?, ?)", users_data)

        # 3. Parameterized query with ? placeholders and row dict/index access
        res = conn.execute("SELECT * FROM demo_users WHERE id = ?", ("U-001",))
        row = res.fetchone()
        assert row is not None
        assert row["id"] == "U-001"
        assert row[0] == "U-001"
        assert row["email"] == "officer@aicte.gov.in"
        assert row[1] == "officer@aicte.gov.in"
        assert row["full_name"] == "Dr. A. Sharma"

        # 4. lastrowid capture
        cur1 = conn.execute("INSERT INTO demo_audit (action) VALUES (?)", ("APPLICATION_SUBMITTED",))
        assert cur1.lastrowid == 1

        cur2 = conn.execute("INSERT INTO demo_audit (action) VALUES (?)", ("CLAUSE_VERIFIED",))
        assert cur2.lastrowid == 2

        # 5. Fetchall and iteration
        all_rows = conn.execute("SELECT * FROM demo_users ORDER BY id").fetchall()
        assert len(all_rows) == 2
        assert [r["id"] for r in all_rows] == ["U-001", "U-002"]

    finally:
        conn.close()


def test_turso_smoke_test_select_1_unit(tmp_path):
    """Smoke test probe: executes strictly SELECT 1 without writes, schema changes, or migrations."""
    import libsql_client

    db_file = tmp_path / "turso_smoke.db"
    raw_client = libsql_client.create_client_sync(f"file:{db_file}")
    conn = TursoConnectionWrapper(raw_client)

    try:
        cur = conn.execute("SELECT 1 AS alive")
        row = cur.fetchone()
        assert row is not None
        assert row[0] == 1
        assert row["alive"] == 1
    finally:
        conn.close()


def test_turso_smoke_test_live():
    """Live smoke test probe: if TURSO_DATABASE_URL is set, verifies remote connection with SELECT 1."""
    import libsql_client

    url = os.getenv("TURSO_DATABASE_URL")
    if not url:
        pytest.skip("TURSO_DATABASE_URL is not set; skipping live remote connection smoke test")

    auth_token = os.getenv("TURSO_AUTH_TOKEN")
    client = libsql_client.create_client_sync(url=url.strip(), auth_token=auth_token.strip() if auth_token else None)
    try:
        res = client.execute("SELECT 1 AS alive")
        assert len(res.rows) > 0
        assert res.rows[0][0] == 1
    finally:
        client.close()


