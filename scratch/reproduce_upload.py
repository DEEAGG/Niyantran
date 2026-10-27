from playwright.sync_api import sync_playwright

def main():
    network_logs = []
    console_logs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("request", lambda req: network_logs.append(f"REQ: {req.method} {req.url}"))
        page.on("response", lambda res: network_logs.append(f"RES: {res.status} {res.url}"))
        page.on("requestfailed", lambda req: network_logs.append(f"FAIL: {req.method} {req.url} {req.failure}"))

        print("Navigating to /upload...")
        page.goto("http://127.0.0.1:3000/upload", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Set file input
        file_input = page.locator('input[type="file"]')
        file_input.set_input_files("test_input.pdf")
        page.wait_for_timeout(500)

        # Click upload button
        upload_btn = page.locator('button:has-text("Upload")').first
        if upload_btn.is_visible():
            print("Clicking Upload button...")
            upload_btn.click()
            page.wait_for_timeout(2000)

        # Look for extract button
        extract_btn = page.locator('button:has-text("Extract"), button:has-text("Process OCR"), button:has-text("Trigger Extraction")').first
        if extract_btn.is_visible():
            print("Found Extract button, clicking...")
            extract_btn.click()
            page.wait_for_timeout(4000)
        else:
            print("Extract button not immediately visible, checking page text...")

        page.screenshot(path="d:/Niyantran/reproduce_upload_result.png")
        page_text = page.eval_on_selector("body", "el => el.innerText")
        print("Page text snippet:", page_text[:500])

        browser.close()

    print("\n--- Network Logs ---")
    for log in network_logs[-20:]:
        print(log)

    print("\n--- Console Logs ---")
    for log in console_logs[-20:]:
        print(log)

if __name__ == "__main__":
    main()
