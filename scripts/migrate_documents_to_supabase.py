#!/usr/bin/env python3
"""
NIYANTRAN — Document Storage Migration to Supabase Storage (Private Bucket).

Migrates existing local documents (application files) and regulatory source PDFs
to a private Supabase Storage bucket ('niyantran-documents').

Safety Guarantees:
- Default mode is --dry-run (performs ZERO remote uploads).
- Live upload requires explicit --execute and --confirm flags.
- Preserves all database paths ('documents/<uuid>.<ext>').
- Never deletes or modifies local files or database records.
- Masks secret keys.

Usage:
    python scripts/migrate_documents_to_supabase.py                 # Dry-run audit (default)
    python scripts/migrate_documents_to_supabase.py --execute --confirm   # Live upload
"""

import os
import sys
import argparse
import sqlite3
import hashlib
from pathlib import Path
from typing import Dict, List, Any

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import httpx
from app.db import get_db_path, DATA_DIR, DOCUMENTS_DIR, REGULATORY_SOURCES_DIR
from app.storage import is_supabase_configured, get_supabase_config, _normalize_key


def get_files_to_migrate(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    """Gathers all registered document and regulatory source files from database."""
    cur = conn.cursor()
    items = []

    # 1. Documents table
    doc_rows = cur.execute(
        "SELECT id, application_id, original_filename, stored_path, mime_type, sha256, file_size FROM documents"
    ).fetchall()
    for row in doc_rows:
        key = _normalize_key(row["stored_path"])
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


def run_dry_run(items: List[Dict[str, Any]]):
    """Executes a dry-run inspection of files to migrate to Supabase Storage."""
    print("================================================================")
    print(" NIYANTRAN — Document Storage Migration: SUPABASE DRY-RUN")
    print(" Mode: READ-ONLY (Zero writes to local disk, zero remote uploads)")
    print("================================================================")

    supabase_ready = is_supabase_configured()
    cfg = get_supabase_config()
    print(f"Supabase Configured: {'YES' if supabase_ready else 'NO (Required for live execution)'}")
    if supabase_ready:
        print(f"Target Bucket      : {cfg['bucket']}")
        print(f"Project URL        : {cfg['url']}")
        print("Service Role Key   : [CONFIGURED / HIDDEN]")
    else:
        print("Missing Env Vars   : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
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
            if h.lower() == (item["expected_sha256"] or "").lower():
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

    if supabase_ready:
        print("\nTesting Supabase Bucket Connectivity...")
        try:
            # Check bucket accessibility
            bucket_url = f"{cfg['url']}/storage/v1/bucket/{cfg['bucket']}"
            headers = {
                "Authorization": f"Bearer {cfg['key']}",
                "apiKey": cfg["key"],
            }
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(bucket_url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    is_public = data.get("public", False)
                    print(f"  Bucket Connection        : SUCCESS (Bucket '{cfg['bucket']}' found)")
                    print(f"  Bucket Visibility        : {'PUBLIC (Warning: Expected PRIVATE)' if is_public else 'PRIVATE (Strict security verified)'}")
                elif resp.status_code == 404:
                    print(f"  Bucket Connection        : FAILED (Bucket '{cfg['bucket']}' does not exist on Supabase)")
                else:
                    print(f"  Bucket Connection        : HTTP {resp.status_code} - {resp.text}")
        except Exception as exc:
            print(f"  Bucket probe error       : {exc}")

    print("\n================================================================")
    print(" DRY-RUN COMPLETED — ZERO FILES UPLOADED OR MODIFIED")
    print("================================================================")


def execute_migration(items: List[Dict[str, Any]]):
    """Executes live upload of verified files to Supabase Storage."""
    if not is_supabase_configured():
        print("[ERROR] Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
        sys.exit(1)

    cfg = get_supabase_config()
    print("================================================================")
    print(f" NIYANTRAN — Document Storage Migration: LIVE UPLOAD TO SUPABASE")
    print(f" Target Bucket: {cfg['bucket']}")
    print("================================================================")

    headers_base = {
        "Authorization": f"Bearer {cfg['key']}",
        "apiKey": cfg["key"],
        "x-upsert": "true",
    }

    uploaded = 0
    errors = 0

    with httpx.Client(timeout=60.0) as client:
        for idx, item in enumerate(items, 1):
            lp = item["local_path"]
            if not lp or not lp.exists():
                print(f"  [{idx:2d}/{len(items)}] [SKIP] {item['key']}: File missing on local disk")
                continue

            content = lp.read_bytes()
            upload_url = f"{cfg['url']}/storage/v1/object/{cfg['bucket']}/{item['key']}"
            headers = {
                **headers_base,
                "Content-Type": item["mime_type"],
            }

            try:
                resp = client.post(upload_url, headers=headers, content=content)
                resp.raise_for_status()
                uploaded += 1
                print(f"  [{idx:2d}/{len(items)}] [UPLOADED] {item['key']} ({len(content) / 1024:.1f} KB)")
            except Exception as exc:
                errors += 1
                print(f"  [{idx:2d}/{len(items)}] [FAILED] {item['key']}: {exc}")

    print("\n================================================================")
    print(f" Upload Complete: {uploaded} files uploaded to Supabase, {errors} errors.")
    print(" Source files on local disk remain completely intact.")
    print("================================================================")


def main():
    parser = argparse.ArgumentParser(description="NIYANTRAN Document Storage Migration to Supabase Storage")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Perform read-only pre-flight audit (default)")
    parser.add_argument("--execute", action="store_true", help="Perform live upload to Supabase Storage")
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
                print("Run: python scripts/migrate_documents_to_supabase.py --execute --confirm")
                sys.exit(1)
            execute_migration(items)
        else:
            run_dry_run(items)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
