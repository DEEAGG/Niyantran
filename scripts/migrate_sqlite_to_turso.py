#!/usr/bin/env python3
"""
NIYANTRAN — Safe SQLite to Turso Data Migration Tool.

Transfers all records from the local SQLite database to Turso / libSQL
preserving primary keys, foreign keys, timestamps, and cryptographic audit chains.

Safety Guarantees:
- Opens data/niyantran.db in strictly READ-ONLY mode (?mode=ro).
- Default mode is --dry-run (performs ZERO remote writes).
- Real execution requires explicit --execute and --confirm flags.
- Refuses to overwrite non-empty remote tables.
- Preserves all auto-increment IDs and audit ledger hash chains.
- Never prints or commits the authentication token.

Usage:
    python scripts/migrate_sqlite_to_turso.py                 # Dry-run inspection (default)
    python scripts/migrate_sqlite_to_turso.py --dry-run       # Explicit dry-run
    python scripts/migrate_sqlite_to_turso.py --execute --confirm   # Live execution
"""

import os
import sys
import argparse
import sqlite3
import hashlib
import re
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import libsql_client
from app.db import (
    get_db_path,
    get_turso_config,
    normalize_turso_url,
    verify_audit_chain,
    compute_entry_hash,
    SCHEMA,
    TursoConnectionWrapper,
)


def sanitize_url(url: str) -> str:
    """Mask any embedded password in URL authority for display."""
    return re.sub(r":([^@/]+)@", r":***@", url)


def get_sqlite_tables_and_deps(conn: sqlite3.Connection) -> Tuple[List[str], Dict[str, Set[str]], Dict[str, List[str]]]:
    """Inspect SQLite schema to discover all tables, foreign key dependencies, and column names."""
    cur = conn.cursor()
    tables = [
        r[0] for r in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
    ]

    deps: Dict[str, Set[str]] = {}
    cols: Dict[str, List[str]] = {}

    for t in tables:
        fks = cur.execute(f"PRAGMA foreign_key_list({t})").fetchall()
        # Filter out self-referencing foreign keys (e.g. regulatory_sources)
        ref_tables = set(fk[2] for fk in fks if fk[2] != t and fk[2] in tables)
        deps[t] = ref_tables
        cols[t] = [c[1] for c in cur.execute(f"PRAGMA table_info({t})").fetchall()]

    # Topological sort (Kahn's algorithm)
    topological_order: List[str] = []
    remaining = {t: set(d) for t, d in deps.items()}

    while remaining:
        ready = [t for t, d in remaining.items() if not (d - set(topological_order))]
        if not ready:
            # Fallback if circular dependency encountered
            remaining_sorted = sorted(remaining.keys())
            topological_order.extend(remaining_sorted)
            break
        ready.sort()
        for t in ready:
            topological_order.append(t)
            del remaining[t]

    return topological_order, deps, cols


def verify_source_integrity(conn: sqlite3.Connection) -> Dict[str, any]:
    """Runs PRAGMA integrity_check and verifies audit chain on local SQLite."""
    cur = conn.cursor()
    integrity_result = cur.execute("PRAGMA integrity_check").fetchone()[0]

    # Verify audit chain
    chain_result = verify_audit_chain(conn)

    return {
        "integrity": integrity_result,
        "audit_verified": chain_result.get("verified", False),
        "audit_records": chain_result.get("total_records", 0),
        "latest_hash": chain_result.get("latest_hash", ""),
    }


def verify_documents_on_disk(conn: sqlite3.Connection, data_dir: Path) -> Dict[str, int]:
    """Verifies that document records in SQLite match authentic files on disk."""
    cur = conn.cursor()
    docs = cur.execute("SELECT id, stored_path, sha256 FROM documents").fetchall()
    matched = 0
    missing = 0

    for doc_id, path_str, expected_hash in docs:
        p = Path(path_str)
        if not p.is_absolute():
            p = data_dir / path_str if not path_str.startswith("data") else ROOT_DIR / path_str
        if not p.exists():
            p = data_dir / "documents" / Path(path_str).name
        if p.exists():
            h = hashlib.sha256(p.read_bytes()).hexdigest()
            if h == expected_hash:
                matched += 1
            else:
                missing += 1
        else:
            missing += 1

    return {"total": len(docs), "matched": matched, "missing": missing}


def inspect_remote_turso(client: libsql_client.ClientSync) -> Dict[str, any]:
    """Inspects remote Turso database state without modifying anything."""
    res = client.execute("SELECT 1 AS alive")
    alive = bool(res.rows and res.rows[0][0] == 1)

    # Check existing tables on remote
    tables_res = client.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    remote_tables = [r[0] for r in tables_res.rows]

    # Check row counts in remote tables if any
    counts: Dict[str, int] = {}
    for t in remote_tables:
        c_res = client.execute(f"SELECT COUNT(*) FROM {t}")
        counts[t] = c_res.rows[0][0] if c_res.rows else 0

    return {
        "connected": alive,
        "remote_tables": remote_tables,
        "table_counts": counts,
        "is_empty": len(remote_tables) == 0 or sum(counts.values()) == 0,
    }


def run_dry_run(sqlite_path: Path, turso_url: str, turso_token: Optional[str], batch_size: int = 150):
    """Executes a full dry-run audit: zero remote writes, validates local and remote state."""
    print("================================================================")
    print(" NIYANTRAN — SQLite to Turso Migration: DRY-RUN INSPECTION")
    print(" Mode: READ-ONLY (Zero writes to SQLite, zero writes to Turso)")
    print("================================================================")

    display_url = sanitize_url(turso_url)
    token_status = f"[CONFIGURED - {len(turso_token)} chars]" if turso_token else "[NOT SET]"
    print(f"Source SQLite DB : {sqlite_path}")
    print(f"Target Turso URL : {display_url}")
    print(f"Turso Auth Token : {token_status}")
    print(f"Batch Chunk Size : {batch_size} rows/request")
    print("----------------------------------------------------------------")

    # 1. Open SQLite read-only
    ro_uri = f"file:{sqlite_path.resolve()}?mode=ro"
    sqlite_conn = sqlite3.connect(ro_uri, uri=True)
    sqlite_conn.row_factory = sqlite3.Row

    try:
        # 2. Verify SQLite integrity and audit chain
        print("\n[STEP 1] Validating Local SQLite Source Integrity...")
        src_health = verify_source_integrity(sqlite_conn)
        print(f"  PRAGMA integrity_check : {src_health['integrity']}")
        print(f"  Audit chain verified   : {src_health['audit_verified']}")
        print(f"  Audit ledger records   : {src_health['audit_records']}")
        print(f"  Latest ledger hash     : {src_health['latest_hash'][:16]}...")
        assert src_health["integrity"] == "ok", "SQLite integrity check failed!"
        assert src_health["audit_verified"], "SQLite audit chain verification failed!"

        # 3. Verify Documents on disk
        print("\n[STEP 2] Verifying Document Storage Integrity...")
        doc_health = verify_documents_on_disk(sqlite_conn, ROOT_DIR / "data")
        print(f"  Application documents  : {doc_health['total']} registered")
        print(f"  SHA-256 match on disk  : {doc_health['matched']}/{doc_health['total']}")
        assert doc_health["missing"] == 0, f"Found {doc_health['missing']} missing/mismatched documents!"

        # 4. Derive Schema & Topological Order
        print("\n[STEP 3] Inspecting Schema & Deriving Dependency Order...")
        order, deps, cols = get_sqlite_tables_and_deps(sqlite_conn)
        print(f"  Discovered {len(order)} tables in dependency order:")

        cur = sqlite_conn.cursor()
        counts: Dict[str, int] = {}
        total_rows = 0
        total_batches = 0

        for idx, tbl in enumerate(order, 1):
            c = cur.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
            counts[tbl] = c
            total_rows += c
            batches = (c + batch_size - 1) // batch_size if c > 0 else 0
            total_batches += batches
            col_list = cols[tbl]
            dep_str = f"(depends on: {', '.join(sorted(deps[tbl]))})" if deps[tbl] else "(root / no foreign deps)"
            print(f"  {idx:2d}. {tbl:<22} : {c:6d} rows | {batches:3d} batches | {len(col_list):2d} cols {dep_str}")

        print(f"\n  Total Records to Migrate : {total_rows:,} rows across {len(order)} tables")
        print(f"  Estimated HTTP Batches   : {total_batches} requests (batch_size={batch_size})")

        # 5. Remote Turso Probe
        print("\n[STEP 4] Probing Remote Turso Database (Read-Only)...")
        turso_client = libsql_client.create_client_sync(url=turso_url, auth_token=turso_token)
        try:
            remote_info = inspect_remote_turso(turso_client)
            print("  Remote connection      : SUCCESS (SELECT 1 returned 1)")
            print(f"  Existing remote tables : {len(remote_info['remote_tables'])} tables found")
            if remote_info["remote_tables"]:
                for t, cnt in remote_info["table_counts"].items():
                    print(f"    - {t}: {cnt} rows")
            print(f"  Remote is empty / safe : {remote_info['is_empty']}")
        finally:
            turso_client.close()

        print("\n================================================================")
        print(" DRY-RUN COMPLETED SUCCESSFULLY — ZERO REMOTE WRITES PERFORMED")
        print(" All prerequisites verified. The system is ready for live migration.")
        print("================================================================")
        return True

    finally:
        sqlite_conn.close()


def verify_remote_audit_chain(client: libsql_client.ClientSync, expected_count: int, chunk_size: int = 1000) -> Dict[str, any]:
    """Verifies audit chain in chunks over HTTP to ensure memory and network safety."""
    prev_hash = "GENESIS"
    verified_count = 0

    for offset in range(0, expected_count, chunk_size):
        res = client.execute(
            f"SELECT id, event_type, actor, entity_type, entity_id, event_json, previous_hash, entry_hash, created_at "
            f"FROM audit_log ORDER BY id ASC LIMIT {chunk_size} OFFSET {offset}"
        )
        for r in res.rows:
            if r["previous_hash"] != prev_hash:
                return {
                    "verified": False,
                    "error": f"Chain broken at record ID {r['id']}: previous_hash '{r['previous_hash']}' != expected '{prev_hash}'",
                    "total_records": verified_count,
                    "failed_record_id": r["id"],
                }
            expected_hash = compute_entry_hash(
                previous_hash=r["previous_hash"],
                event_type=r["event_type"],
                actor=r["actor"],
                entity_type=r["entity_type"],
                entity_id=r["entity_id"],
                event_json=r["event_json"],
                created_at=r["created_at"],
            )
            if r["entry_hash"] != expected_hash:
                return {
                    "verified": False,
                    "error": f"Tampered record at ID {r['id']}: entry_hash '{r['entry_hash']}' != expected '{expected_hash}'",
                    "total_records": verified_count,
                    "failed_record_id": r["id"],
                }
            prev_hash = r["entry_hash"]
            verified_count += 1

    return {
        "verified": True,
        "total_records": verified_count,
        "latest_hash": prev_hash if verified_count > 0 else "GENESIS",
    }


def execute_migration(sqlite_path: Path, turso_url: str, turso_token: Optional[str], batch_size: int = 150):
    """Executes live migration with safety checks and exact post-migration validation."""
    print("================================================================")
    print(" NIYANTRAN — SQLite to Turso Migration: LIVE EXECUTION")
    print("================================================================")

    display_url = sanitize_url(turso_url)
    print(f"Target Turso Database : {display_url}")
    print(f"Source Database       : {sqlite_path} (READ-ONLY)")
    print(f"Batch Chunk Size      : {batch_size} rows/batch")
    print("----------------------------------------------------------------")

    # Connect read-only to source SQLite
    ro_uri = f"file:{sqlite_path.resolve()}?mode=ro"
    sqlite_conn = sqlite3.connect(ro_uri, uri=True)
    sqlite_conn.row_factory = sqlite3.Row

    turso_client = libsql_client.create_client_sync(url=turso_url, auth_token=turso_token)

    try:
        # Pre-check remote database
        remote_info = inspect_remote_turso(turso_client)
        if not remote_info["is_empty"]:
            print("[ABORT] Remote Turso database already contains tables with data!")
            print("Existing tables:", remote_info["table_counts"])
            print("Refusing to overwrite existing data. Clear remote database or verify configuration.")
            sys.exit(1)

        # 0. Source baseline health
        src_health = verify_source_integrity(sqlite_conn)

        # 1. Deploy Schema DDL
        print("\n[PHASE 1] Creating Schema and Indexes on Turso...")
        ddl_statements = [s.strip() for s in SCHEMA.split(";") if s.strip()]
        for stmt in ddl_statements:
            turso_client.execute(stmt)
        print(f"  Executed {len(ddl_statements)} DDL statements.")

        # 2. Derive Topological Order and Migrate Data
        order, deps, cols = get_sqlite_tables_and_deps(sqlite_conn)
        print(f"\n[PHASE 2] Migrating Data for {len(order)} Tables...")

        src_counts: Dict[str, int] = {}
        for idx, table_name in enumerate(order, 1):
            col_names = cols[table_name]
            placeholders = ", ".join(["?"] * len(col_names))
            quoted_cols = ", ".join([f'"{c}"' for c in col_names])
            insert_sql = f'INSERT INTO "{table_name}" ({quoted_cols}) VALUES ({placeholders})'

            cur = sqlite_conn.cursor()
            order_by = "id ASC" if "id" in col_names else "rowid ASC"
            rows = cur.execute(f'SELECT * FROM "{table_name}" ORDER BY {order_by}').fetchall()
            src_counts[table_name] = len(rows)

            if not rows:
                print(f"  [{idx:2d}/{len(order)}] {table_name:<22}:      0 rows (table empty, skipped)")
                continue

            batches_count = (len(rows) + batch_size - 1) // batch_size
            for b_idx in range(batches_count):
                batch_rows = rows[b_idx * batch_size : (b_idx + 1) * batch_size]
                # Prepend PRAGMA foreign_keys = OFF to handle internal self-referencing forward references
                batch_stmts = [("PRAGMA foreign_keys = OFF", [])] + [
                    (insert_sql, [row[c] for c in col_names]) for row in batch_rows
                ]
                turso_client.batch(batch_stmts)

            print(f"  [{idx:2d}/{len(order)}] {table_name:<22}: {len(rows):6d} rows migrated ({batches_count} batches)")

        # 3. Post-Migration Exact Validation
        print("\n[PHASE 3] Post-Migration Validation...")
        mismatches = []
        for table_name in order:
            res = turso_client.execute(f'SELECT COUNT(*) FROM "{table_name}"')
            remote_count = res.rows[0][0] if res.rows else 0
            expected = src_counts[table_name]
            if remote_count != expected:
                mismatches.append((table_name, expected, remote_count))
                print(f"  [ERROR] {table_name}: expected {expected}, got {remote_count}")
            else:
                print(f"  [OK] {table_name:<22}: {remote_count} rows match perfectly")

        if mismatches:
            print(f"\n[FAILED] Data migration mismatch detected in {len(mismatches)} tables!")
            sys.exit(2)

        # 3b. Verify Foreign Key Referential Integrity Across All Tables
        print("\n[PHASE 3b] Verifying Foreign Key Referential Integrity...")
        fk_check = turso_client.execute("PRAGMA foreign_key_check")
        if fk_check.rows:
            print(f"[ERROR] Foreign key violations detected on Turso: {len(fk_check.rows)}")
            for v in fk_check.rows:
                print(f"  Violation: {v}")
            sys.exit(3)
        print("  [OK] PRAGMA foreign_key_check passed: 100% of all foreign key relationships are valid.")

        # 4. Cryptographic Audit Chain Verification on Turso
        print("\n[PHASE 4] Verifying Cryptographic Audit Chain on Remote Turso...")
        turso_chain = verify_remote_audit_chain(turso_client, expected_count=src_counts["audit_log"])
        print(f"  Source ledger records  : {src_health['audit_records']}")
        print(f"  Turso ledger records   : {turso_chain['total_records']}")
        print(f"  Chain integrity        : {'VALID' if turso_chain['verified'] else 'INVALID'}")
        print(f"  Source latest hash     : {src_health['latest_hash']}")
        print(f"  Turso latest hash      : {turso_chain['latest_hash']}")

        assert turso_chain["verified"] is True, f"Remote Turso audit chain validation failed: {turso_chain.get('error')}"
        assert turso_chain["total_records"] == src_health["audit_records"], "Audit log record count mismatch!"
        assert turso_chain["latest_hash"] == src_health["latest_hash"], "Audit log cryptographic hash mismatch!"

        print("\n================================================================")
        print(" MIGRATION COMPLETED SUCCESSFULLY")
        print(f" All {sum(src_counts.values()):,} records transferred and verified on Turso.")
        print(" Cryptographic ledger chain remains 100% valid and tamper-evident.")
        print(" Source SQLite database and documents remain pristine and untouched.")
        print("================================================================")
        return True

    finally:
        sqlite_conn.close()
        turso_client.close()


def main():
    parser = argparse.ArgumentParser(description="NIYANTRAN SQLite to Turso Safe Migration")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Perform read-only pre-flight inspection (default)")
    parser.add_argument("--execute", action="store_true", help="Perform live migration to Turso")
    parser.add_argument("--confirm", action="store_true", help="Required confirmation flag to execute live migration")
    parser.add_argument("--batch-size", type=int, default=150, help="Batch chunk size (default: 150)")
    parser.add_argument("--db-path", default=None, help="Path to local SQLite database (defaults to data/niyantran.db)")

    args = parser.parse_args()

    sqlite_path = Path(args.db_path) if args.db_path else get_db_path()
    if not sqlite_path.exists():
        print(f"[ERROR] Source SQLite database not found at {sqlite_path}")
        sys.exit(1)

    turso_url, turso_token = get_turso_config()
    if not turso_url:
        print("[ERROR] TURSO_DATABASE_URL is not set.")
        sys.exit(1)

    turso_url = normalize_turso_url(turso_url)

    if args.execute:
        if not args.confirm:
            print("[ERROR] Refusing live execution without explicit --confirm flag.")
            print("To run live migration, execute:")
            print("  python scripts/migrate_sqlite_to_turso.py --execute --confirm")
            sys.exit(1)
        execute_migration(sqlite_path, turso_url, turso_token, batch_size=args.batch_size)
    else:
        run_dry_run(sqlite_path, turso_url, turso_token, batch_size=args.batch_size)


if __name__ == "__main__":
    main()
