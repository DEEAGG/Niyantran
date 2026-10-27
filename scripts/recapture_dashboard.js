async function(page) {
    await page.goto('http://127.0.0.1:3000/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'artifacts/ui_audit/final/01_dashboard.png', fullPage: false });
    await page.screenshot({ path: 'artifacts/ui_audit/after_dashboard.png', fullPage: false });
    console.log('Saved updated dashboard screenshots');
    return { ok: true };
}
