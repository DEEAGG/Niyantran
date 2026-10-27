async function(page) {
    try {
        await page.goto('http://127.0.0.1:3000/applications/APP-2026-003/evidence', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'artifacts/ui_audit/after_evidence_explorer.png', fullPage: false });
        console.log('Saved after_evidence_explorer.png');
    } catch (e) {
        console.error('Error:', e.message);
    }
    return { ok: true };
}
