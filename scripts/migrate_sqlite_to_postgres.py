#!/usr/bin/env python3
"""
NIYANTRAN — SQLite to Neon PostgreSQL Safe Data Migration Script.

Transfers all records from the local SQLite database to Neon PostgreSQL
preserving primary keys, foreign keys, and cryptographic audit chains.

Usage:
    python scripts/migrate_sqlite_to_postgres.py --target-url "postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require"
"""

import os
import sys
import argparse
import sqlite3
from pathlib import Path

# Add project root to path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    import psycopg
except ImportError:
    print("Error: psycopg is required. Run 'pip install \"psycopg[binary]>=3.1.0\"'")
    sys.exit(1)

from app.db import get_db_path, compute_entry_hash

TABLE_TRANSFER_ORDER = [
    "users",
    "regulatory_sources",
    "applications",
    "documents",
    "extraction_runs",
    "extracted_fields",
    "rules",
    "rule_sources",
    "rulesets",
    "ruleset_rules",
    "rule_proposals",
    "validation_runs",
    "findings",
    "decisions",
    "authenticity_signals",
    "manual_verifications",
    "replays",
    "replay_diffs",
    "regulatory_clauses",
    "audit_log",
]


def load_postgres_schema(pg_conn):
    schema_path = ROOT_DIR / "scripts" / "schema_postgres.sql"
    with open(schema_path, "r", encoding="utf-8") as f:
        ddl = f.read()
    with pg_conn.cursor() as cur:
        cur.execute(ddl)
    pg_conn.commit()
    print("✓ PostgreSQL schema initialized.")


def migrate_data(sqlite_path: Path, target_url: str):
    if not sqlite_path.exists():
        print(f"Error: SQLite source database not found at {sqlite_path}")
        sys.exit(1)

    print(f"--- Starting Migration: {sqlite_path.name} -> Neon PostgreSQL ---")

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    pg_conn = psycopg.connect(target_url)

    try:
        load_postgres_schema(pg_conn)

        total_rows_migrated = 0

        for table in TABLE_TRANSFER_ORDER:
            # Check if source table exists in SQLite
            exists = sqlite_conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
            ).fetchone()
            if not exists:
                continue

            # Fetch columns and data
            source_cursor = sqlite_conn.execute(f"SELECT * FROM {table}")
            rows = source_cursor.fetchall()
            row_count = len(rows)

            if row_count == 0:
                print(f"• {table}: 0 rows (skipped)")
                continue

            columns = [desc[0] for desc in source_cursor.description]
            col_names = ", ".join(f'"{c}"' for c in columns)
            placeholders = ", ".join(["%s"] * len(columns))
            insert_sql = f'INSERT INTO "{table}" ({col_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'

            data = [tuple(r[c] for c in columns) for r in rows]

            with pg_conn.cursor() as pg_cur:
                pg_cur.executemany(insert_sql, data)
            pg_conn.commit()

            # Verify target count
            with pg_conn.cursor() as pg_cur:
                pg_cur.execute(f'SELECT COUNT(*) FROM "{table}"')
                target_count = pg_cur.fetchone()[0]

            print(f"✓ {table}: {row_count} rows migrated (Target DB count: {target_count})")
            total_rows_migrated += row_count

        # Reset audit_log sequence to current MAX(id)
        with pg_conn.cursor() as pg_cur:
            pg_cur.execute("SELECT setval('audit_log_id_seq', COALESCE((SELECT MAX(id) FROM audit_log), 1));")
        pg_conn.commit()

        # Audit Chain Integrity Verification on Target
        print("\n--- Verifying Audit Ledger Cryptographic Chain on PostgreSQL ---")
        with pg_conn.cursor() as pg_cur:
            pg_cur.execute(
                "SELECT id, event_type, actor, entity_type, entity_id, event_json, previous_hash, entry_hash, created_at FROM audit_log ORDER BY id ASC"
            )
            audit_rows = pg_cur.fetchall()

        prev_hash = "GENESIS"
        chain_valid = True
        for r in audit_rows:
            r_id, e_type, actor, ent_type, ent_id, e_json, p_hash, e_hash, c_at = r
            if p_hash != prev_hash:
                print(f"✗ Hash chain broken at record ID {r_id}")
                chain_valid = False
                break
            expected_hash = compute_entry_hash(
                previous_hash=p_hash,
                event_type=e_type,
                actor=actor,
                entity_type=ent_type,
                entity_id=ent_id,
                event_json=e_json,
                created_at=c_at,
            )
            if e_hash != expected_hash:
                print(f"✗ Tampered record at ID {r_id}")
                chain_valid = False
                break
            prev_hash = e_hash

        if chain_valid:
            print(f"✓ Cryptographic ledger verified: {len(audit_rows)} records intact.")
            print(f"✓ Latest SHA-256 state hash: {prev_hash}")
        else:
            print("✗ Audit chain integrity check failed on target database!")
            sys.exit(1)

        print(f"\nSUCCESS: Migration complete. Total rows processed: {total_rows_migrated}")

    finally:
        sqlite_conn.close()
        pg_conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate SQLite data to Neon PostgreSQL")
    parser.add_argument("--target-url", default=os.getenv("DATABASE_URL"), help="PostgreSQL connection string")
    parser.add_argument("--sqlite-path", default=str(get_db_path()), help="Path to source SQLite database")
    args = parser.parse_args()

    if not args.target_url:
        print("Error: Target database URL must be provided via --target-url or DATABASE_URL environment variable.")
        sys.exit(1)

    migrate_data(sqlite_path=Path(args.sqlite_path), target_url=args.target_url)
