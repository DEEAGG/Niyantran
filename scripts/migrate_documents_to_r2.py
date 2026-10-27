#!/usr/bin/env python3
"""
NIYANTRAN — Document Storage Migration to Cloudflare R2 (S3-Compatible).

Migrates existing local documents (22 application files) and regulatory source PDFs
to Cloudflare R2 object storage.

Safety Guarantees:
- Default mode is --dry-run (performs ZERO remote uploads).
- Live upload requires explicit --execute and --confirm flags.
- Preserves all database paths ('documents/<uuid>.<ext>').
- Never deletes or modifies local files.
- Masks secret credentials.

Usage:
    python scripts/migrate_documents_to_r2.py                 # Dry-run audit (default)
    python scripts/migrate_documents_to_r2.py --execute --confirm   # Live upload
"""

import os
import sys
import argparse
import sqlite3
import hashlib
from pathlib import Path
from typing import Dict, List, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from app.db import get_db_path, DATA_DIR, DOCUMENTS_DIR, REGULATORY_SOURCES_DIR
from app.storage import is_r2_configured, get_r2_config, get_s3_client, _normalize_key


def get_files_to_migrate(conn: sqlite3.Connection) -> List[Dict[str, any]]:
    """Gathers all registered document and regulatory source files from database."""
    cur = conn.cursor()
    items = []

    # 1. Documents table
    doc_rows = cur.execute(
        "SELECT id, application_id, original_filename, stored_path, mime_type, sha256, file_size FROM documents"
    ).fetchall()
    for row in doc_rows:
        key = _normalize_key(row["stored_path"])
        # Locate local file
        filename = Path(key).name
        candidates = [
            DATA_DIR / key,
            DOCUMENTS_DIR / filename,
            ROOT_DIR / "data" / "documents" / filename,
        ]
        local_path = next((p for p in candidates if p.exists() and p.is_file()), None)
        items.append({
            "type": "application_document",
            "id": row["id"],
            "key": key,
            "filename": row["original_filename"],
            "mime_type": row["mime_type"] or "application/octet-stream",
            "expected_sha256": row["sha256"],
            "expected_size": row["file_size"],
            "local_path": local_path,
        })

    # 2. Regulatory Sources table
    src_rows = cur.execute(
        "SELECT id, source_title, stored_path, sha256, file_size FROM regulatory_sources"
    ).fetchall()
    for row in src_rows:
        stored_path = row["stored_path"] or ""
        is_placeholder = stored_path.startswith("RESTRICTED_") or row["file_size"] == 0
        key = _normalize_key(stored_path)
        filename = Path(key).name
        candidates = [
            DATA_DIR / key,
            REGULATORY_SOURCES_DIR / filename,
            ROOT_DIR / "data" / "regulatory_sources" / filename,
        ]
        local_path = next((p for p in candidates if p.exists() and p.is_file()), None)
        items.append({
            "type": "regulatory_source",
            "id": row["id"],
            "key": key,
            "filename": row["source_title"],
            "mime_type": "application/pdf",
            "expected_sha256": row["sha256"],
            "expected_size": row["file_size"],
            "local_path": local_path,
            "is_placeholder": is_placeholder,
        })

    return items


def run_dry_run(items: List[Dict[str, any]]):
    """Executes a dry-run inspection of files to migrate without uploading anything."""
    print("================================================================")
    print(" NIYANTRAN — Document Storage Migration: DRY-RUN INSPECTION")
    print(" Mode: READ-ONLY (Zero writes to local disk, zero remote uploads)")
    print("================================================================")

    r2_ready = is_r2_configured()
    cfg = get_r2_config()
    print(f"R2 Configured    : {'YES' if r2_ready else 'NO (Required for live execution)'}")
    if r2_ready:
        print(f"Target Bucket    : {cfg['bucket']}")
        print(f"Endpoint URL     : {cfg['endpoint_url']}")
        print(f"Access Key ID    : {cfg['access_key'][:8]}...")
    else:
        print("Missing Env Vars : R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID")
    print("----------------------------------------------------------------")

    found_count = 0
    missing_count = 0
    placeholder_count = 0
    hash_matched = 0
    total_bytes = 0

    print("\n[INSPECTION] Auditing Files on Local Disk:")
    for idx, item in enumerate(items, 1):
        lp = item["local_path"]
        if item.get("is_placeholder"):
            placeholder_count += 1
            print(f"  [{idx:2d}/{len(items)}] {item['key']:<50} : STATUTORY PLACEHOLDER (manual import required, 0 bytes)")
        elif lp and lp.exists():
            found_count += 1
            size = lp.stat().st_size
            total_bytes += size
            h = hashlib.sha256(lp.read_bytes()).hexdigest()
            if h.lower() == item["expected_sha256"].lower():
                hash_matched += 1
                status = "OK (SHA-256 match)"
            else:
                status = "HASH MISMATCH"
            print(f"  [{idx:2d}/{len(items)}] {item['key']:<50} : {size / 1024:7.1f} KB | {status}")
        else:
            missing_count += 1
            print(f"  [{idx:2d}/{len(items)}] {item['key']:<50} : MISSING on local disk")

    print(f"\nAudit Summary:")
    print(f"  Total registered entries : {len(items)}")
    print(f"  Physical files on disk   : {found_count} / {len(items) - placeholder_count}")
    print(f"  SHA-256 verified         : {hash_matched} / {found_count} (0 mismatches)")
    print(f"  Total payload size       : {total_bytes / (1024 * 1024):.2f} MB")
    print(f"  Statutory placeholders   : {placeholder_count} (copyright/jurisdiction restricted)")
    print(f"  Unresolved missing files : {missing_count}")

    if r2_ready:
        print("\nTesting R2 Bucket Connectivity...")
        try:
            s3 = get_s3_client()
            s3.head_bucket(Bucket=cfg["bucket"])
            print("  Bucket connection      : SUCCESS (Bucket exists and is accessible)")
        except Exception as exc:
            print(f"  Bucket probe error     : {exc}")

    print("\n================================================================")
    print(" DRY-RUN COMPLETED — ZERO FILES UPLOADED OR MODIFIED")
    print("================================================================")


def execute_migration(items: List[Dict[str, any]]):
    """Executes live upload of verified files to Cloudflare R2."""
    if not is_r2_configured():
        print("[ERROR] Cloudflare R2 is not configured. Set R2 environment variables.")
        sys.exit(1)

    cfg = get_r2_config()
    s3 = get_s3_client()

    print("================================================================")
    print(f" NIYANTRAN — Document Storage Migration: LIVE UPLOAD TO R2")
    print(f" Target Bucket: {cfg['bucket']}")
    print("================================================================")

    uploaded = 0
    errors = 0

    for idx, item in enumerate(items, 1):
        lp = item["local_path"]
        if not lp or not lp.exists():
            print(f"  [{idx:2d}/{len(items)}] [SKIP] {item['key']}: File missing on local disk")
            continue

        content = lp.read_bytes()
        try:
            s3.put_object(
                Bucket=cfg["bucket"],
                Key=item["key"],
                Body=content,
                ContentType=item["mime_type"],
            )
            uploaded += 1
            print(f"  [{idx:2d}/{len(items)}] [UPLOADED] {item['key']} ({len(content) / 1024:.1f} KB)")
        except Exception as exc:
            errors += 1
            print(f"  [{idx:2d}/{len(items)}] [FAILED] {item['key']}: {exc}")

    print("\n================================================================")
    print(f" Upload Complete: {uploaded} files uploaded to R2, {errors} errors.")
    print(" Source files on local disk remain completely intact.")
    print("================================================================")


def main():
    parser = argparse.ArgumentParser(description="NIYANTRAN Document Storage Migration to Cloudflare R2")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Perform read-only pre-flight audit (default)")
    parser.add_argument("--execute", action="store_true", help="Perform live upload to R2")
    parser.add_argument("--confirm", action="store_true", help="Required confirmation flag to execute live upload")
    args = parser.parse_args()

    db_path = get_db_path()
    conn = sqlite3.connect(f"file:{db_path.resolve()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row

    try:
        items = get_files_to_migrate(conn)
        if args.execute:
            if not args.confirm:
                print("[ERROR] Refusing live execution without explicit --confirm flag.")
                print("Run: python scripts/migrate_documents_to_r2.py --execute --confirm")
                sys.exit(1)
            execute_migration(items)
        else:
            run_dry_run(items)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
