import sys
import os

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from playwright.sync_api import sync_playwright

def run():
    console_errors = []
    network_errors = []
    requests_to_8000 = []
    api_requests = []

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page()

        def on_console(msg):
            if msg.type in ["error", "warning"]:
                console_errors.append(f"[{msg.type.upper()}] {msg.text}")

        def on_request(req):
            if "8000" in req.url:
                requests_to_8000.append(req.url)
            if "/api/" in req.url:
                api_requests.append(req.url)

        def on_response(res):
            if res.status >= 400:
                network_errors.append(f"HTTP {res.status}: {res.url}")

        page.on("console", on_console)
        page.on("request", on_request)
        page.on("response", on_response)

        print("Navigating to http://127.0.0.1:3000/ ...")
        page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        page.wait_for_timeout(2000)

        title = page.title()
        print(f"Page title: {title}")

        # Navigate to /applications
        print("Navigating to /applications ...")
        page.goto("http://127.0.0.1:3000/applications", wait_until="networkidle")
        page.wait_for_timeout(2000)

        # Navigate to /reports
        print("Navigating to /reports ...")
        page.goto("http://127.0.0.1:3000/reports", wait_until="networkidle")
        page.wait_for_timeout(2000)

        # Navigate to application details
        print("Navigating to /applications/APP-7261B11FDA39 ...")
        page.goto("http://127.0.0.1:3000/applications/APP-7261B11FDA39", wait_until="networkidle")
        page.wait_for_timeout(2000)

        # Navigate to /settings
        print("Navigating to /settings ...")
        page.goto("http://127.0.0.1:3000/settings", wait_until="networkidle")
        page.wait_for_timeout(2000)

        browser.close()

    print("\n=== VERIFICATION RESULTS ===")
    print(f"Total API requests proxied through port 3000: {len(api_requests)}")
    for r in api_requests[:10]:
        print(f"  API Request: {r}")

    print(f"Direct requests to port 8000 (should be 0): {len(requests_to_8000)}")
    for r in requests_to_8000:
        print(f"  UNEXPECTED 8000 request: {r}")

    print(f"Network errors (status >= 400): {len(network_errors)}")
    for err in network_errors:
        print(f"  Network error: {err}")

    print(f"Console errors/warnings: {len(console_errors)}")
    for err in console_errors:
        print(f"  Console: {err}")

if __name__ == "__main__":
    run()
