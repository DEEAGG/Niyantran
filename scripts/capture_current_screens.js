async function(page) {
    const list = [
        { name: 'dashboard', url: 'http://127.0.0.1:3000/dashboard' },
        { name: 'applications', url: 'http://127.0.0.1:3000/applications' },
        { name: 'workspace', url: 'http://127.0.0.1:3000/applications/APP-2026-001' },
        { name: 'validation', url: 'http://127.0.0.1:3000/validation?app=APP-2026-001' },
        { name: 'evidence_explorer', url: 'http://127.0.0.1:3000/applications/APP-2026-003/evidence' },
        { name: 'replay', url: 'http://127.0.0.1:3000/replay' },
        { name: 'passport', url: 'http://127.0.0.1:3000/applications/APP-2026-001', clickTab: 'Evidence Passport' },
        { name: 'audit', url: 'http://127.0.0.1:3000/audit' },
    ];

    for (const item of list) {
        try {
            await page.goto(item.url, { waitUntil: 'networkidle', timeout: 15000 });
            await page.waitForTimeout(600);
            if (item.clickTab) {
                const tab = await page.$(`button:has-text("${item.clickTab}")`);
                if (tab) {
                    await tab.click();
                    await page.waitForTimeout(600);
                }
            }
            await page.screenshot({ path: `artifacts/ui_audit/before_${item.name}.png`, fullPage: false });
        } catch (e) {
            console.error('Failed on ' + item.name + ':', e.message);
        }
    }
    return { ok: true };
}
