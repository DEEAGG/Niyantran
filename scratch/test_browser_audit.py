import sys
import json
from playwright.sync_api import sync_playwright

def run_audit():
    results = {
        "pages_inspected": [],
        "console_errors": [],
        "workflow_results": {},
        "ux_issues": []
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Listen for console logs & errors
        page.on("console", lambda msg: results["console_errors"].append(f"[{msg.type}] {msg.text}") if msg.type in ["error", "warning"] else None)
        page.on("pageerror", lambda err: results["console_errors"].append(f"[pageerror] {str(err)}"))

        # 1. Dashboard
        print("Auditing Dashboard...")
        page.goto("http://localhost:3000/dashboard", wait_until="networkidle")
        results["pages_inspected"].append({
            "route": "/dashboard",
            "title": page.title(),
            "url": page.url,
            "heading": page.locator("h1, h2").first.text_content() if page.locator("h1, h2").count() > 0 else "None",
            "nav_items": page.locator("nav a").all_text_contents()
        })

        # 2. Applications
        print("Auditing Applications...")
        page.goto("http://localhost:3000/applications", wait_until="networkidle")
        apps_count = page.locator("table tbody tr").count()
        heading = page.locator("h1").first.text_content() if page.locator("h1").count() > 0 else "None"
        results["pages_inspected"].append({
            "route": "/applications",
            "title": page.title(),
            "url": page.url,
            "heading": heading,
            "table_rows": apps_count,
            "buttons": [b.strip() for b in page.locator("button, a.btn, a[href*='applications']").all_text_contents() if b.strip()]
        })

        # 3. Application Details (APP-2026-001)
        print("Auditing Application Details...")
        page.goto("http://localhost:3000/applications/APP-2026-001", wait_until="networkidle")
        details_h1 = page.locator("h1").first.text_content() if page.locator("h1").count() > 0 else "None"
        journey_steps = page.locator("[class*='step'], [class*='Journey'], div:has-text('Filing Intake')").all_text_contents()
        results["pages_inspected"].append({
            "route": "/applications/APP-2026-001",
            "title": page.title(),
            "url": page.url,
            "heading": details_h1,
            "has_journey": len(journey_steps) > 0,
            "tabs_or_links": page.locator("a[href*='APP-2026-001'], button").all_text_contents()[:10]
        })

        # 4. Verification & Compliance Hub
        print("Auditing Verification Hub...")
        page.goto("http://localhost:3000/verification", wait_until="networkidle")
        v_h1 = page.locator("h1").first.text_content() if page.locator("h1").count() > 0 else "None"
        v_tabs = page.locator("button[role='tab'], div.flex.border-b button").all_text_contents()
        results["pages_inspected"].append({
            "route": "/verification",
            "title": page.title(),
            "url": page.url,
            "heading": v_h1,
            "sub_tabs": v_tabs
        })

        # Test clicking sub-tabs in Verification
        for tab_name in ["OCR & Fields", "Completeness", "Spatial"]:
            try:
                tab_btn = page.locator(f"button:has-text('{tab_name}')").first
                if tab_btn.is_visible():
                    tab_btn.click()
                    page.wait_for_timeout(500)
            except Exception as e:
                results["ux_issues"].append(f"Failed to click verification tab {tab_name}: {e}")

        # 5. Regulatory Intelligence
        print("Auditing Regulatory Intelligence...")
        page.goto("http://localhost:3000/intelligence", wait_until="networkidle")
        intel_h1 = page.locator("h1").first.text_content() if page.locator("h1").count() > 0 else "None"
        intel_tabs = page.locator("button:has-text('Registry'), button:has-text('Clauses'), button:has-text('Findings')").all_text_contents()
        results["pages_inspected"].append({
            "route": "/intelligence",
            "title": page.title(),
            "url": page.url,
            "heading": intel_h1,
            "sub_tabs": intel_tabs
        })

        # 6. Review Center
        print("Auditing Review Center...")
        page.goto("http://localhost:3000/review", wait_until="networkidle")
        rev_h1 = page.locator("h1").first.text_content() if page.locator("h1").count() > 0 else "None"
        rev_cards = page.locator("div:has-text('Finding'), div:has-text('VIOLATION'), div:has-text('DISCREPANCY')").count()
        results["pages_inspected"].append({
            "route": "/review",
            "title": page.title(),
            "url": page.url,
            "heading": rev_h1,
            "cards_detected": rev_cards
        })

        # 7. Audit & Reports Hub
        print("Auditing Audit & Reports Hub...")
        page.goto("http://localhost:3000/audit", wait_until="networkidle")
        audit_h1 = page.locator("h1").first.text_content() if page.locator("h1").count() > 0 else "None"
        audit_tabs = page.locator("button:has-text('Cryptographic'), button:has-text('Verification'), button:has-text('Passport'), button:has-text('Dossier')").all_text_contents()
        results["pages_inspected"].append({
            "route": "/audit",
            "title": page.title(),
            "url": page.url,
            "heading": audit_h1,
            "sub_tabs": audit_tabs
        })

        # Test verification button click
        try:
            verif_tab = page.locator("button:has-text('1-Click Chain Verification')").first
            if verif_tab.is_visible():
                verif_tab.click()
                page.wait_for_timeout(500)
                btn = page.locator("button:has-text('Run Cryptographic Verification')").first
                if btn.is_visible():
                    btn.click()
                    page.wait_for_timeout(1000)
        except Exception as e:
            results["ux_issues"].append(f"Audit verification click error: {e}")

        # Check passport tab
        try:
            pass_tab = page.locator("button:has-text('Case Evidence Passports')").first
            if pass_tab.is_visible():
                pass_tab.click()
                page.wait_for_timeout(500)
        except Exception as e:
            results["ux_issues"].append(f"Passport tab click error: {e}")

        browser.close()

    print(json.dumps(results, indent=2))
    with open("scratch/audit_results.json", "w") as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    run_audit()
