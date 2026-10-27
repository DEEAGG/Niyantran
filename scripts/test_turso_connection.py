"""Safe Turso Remote Connection Smoke Test.

Executes strictly `SELECT 1` against Turso / libSQL.
Performs NO schema modifications, NO data writes, and NO data migrations.
NEVER prints or logs authentication tokens or credentials.
"""

import os
import sys
import argparse
import re
from typing import Optional, Tuple

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import libsql_client


def sanitize_url(url: str) -> str:
    """Mask any embedded password in URL authority for display."""
    return re.sub(r":([^@/]+)@", r":***@", url)


def get_credentials(cli_url: Optional[str] = None, cli_token: Optional[str] = None) -> Tuple[str, Optional[str]]:
    url = cli_url or os.getenv("TURSO_DATABASE_URL") or os.getenv("DATABASE_URL", "")
    url = url.strip()

    raw_token = cli_token or os.getenv("TURSO_AUTH_TOKEN")
    token = raw_token.strip() if raw_token and raw_token.strip() else None

    return url, token


def run_smoke_test(url: str, token: Optional[str] = None) -> bool:
    if not url:
        print("[ERROR] Database URL is empty. Provide TURSO_DATABASE_URL or --url.")
        return False

    display_url = sanitize_url(url)
    token_status = f"[CONFIGURED - {len(token)} chars]" if token else "[NOT SET]"

    print("========================================")
    print(" NIYANTRAN — Turso Connection Smoke Test")
    print("========================================")
    print(f"Target URL : {display_url}")
    print(f"Auth Token : {token_status}")
    print("Operation  : Read-only probe ('SELECT 1 AS alive')")
    print("Safety     : Zero schema changes, zero writes, zero migrations")
    print("----------------------------------------")

    client = None
    try:
        client = libsql_client.create_client_sync(url=url, auth_token=token)
        result = client.execute("SELECT 1 AS alive")
        
        if not result.rows or len(result.rows) == 0:
            print("[FAILED] Query returned empty result set.")
            return False

        row = result.rows[0]
        val = row[0]
        if val != 1:
            print(f"[FAILED] Unexpected query result: expected 1, got {val!r}")
            return False

        print("[SUCCESS] Remote connection verified. Query 'SELECT 1' returned 1.")
        return True

    except Exception as exc:
        err_msg = str(exc)
        if token and token in err_msg:
            err_msg = err_msg.replace(token, "[REDACTED]")
        print(f"[FAILED] Connection error: {err_msg}")
        return False

    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser(description="NIYANTRAN Turso Smoke Test (SELECT 1)")
    parser.add_argument("--url", default=None, help="Turso database URL (overrides TURSO_DATABASE_URL)")
    parser.add_argument("--token", default=None, help="Turso auth token (overrides TURSO_AUTH_TOKEN)")
    args = parser.parse_args()

    url, token = get_credentials(args.url, args.token)
    if not url:
        print("[ERROR] TURSO_DATABASE_URL is not set.")
        print("Set TURSO_DATABASE_URL in your environment or pass --url <turso-url>.")
        sys.exit(1)

    success = run_smoke_test(url, token)
    sys.exit(0 if success else 2)


if __name__ == "__main__":
    main()
