const { chromium } = require('C:/Users/Deepansh Aggarwal/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');

async function main() {
    const outDir = path.resolve('artifacts/ui_redesign_final');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const browser = await chromium.launch({
        headless: true,
        executablePath: 'C:\\Users\\Deepansh Aggarwal\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
    });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1
    });
    const page = await context.newPage();

    const pagesToCapture = [
        { name: '01_overview', url: 'http://127.0.0.1:3000/dashboard', title: 'Overview Console', wait: 1000 },
        { name: '02_applications', url: 'http://127.0.0.1:3000/applications', title: 'Applications Registry', wait: 1000 },
        { name: '03_workspace_overview', url: 'http://127.0.0.1:3000/applications/APP-2026-003', title: 'Application Workspace (Case APP-2026-003)', wait: 1000 },
        { name: '04_workspace_entities', url: 'http://127.0.0.1:3000/applications/APP-2026-003', clickTab: 'Extracted Entities', title: 'Extracted OCR Entities Tab', wait: 1000 },
        { name: '05_workspace_findings', url: 'http://127.0.0.1:3000/applications/APP-2026-003', clickTab: 'Compliance Findings', title: 'Compliance Findings Tab', wait: 1000 },
        { name: '06_workspace_authenticity', url: 'http://127.0.0.1:3000/applications/APP-2026-003', clickTab: 'Authenticity', title: 'Authenticity & Multi-Signal Inspector', wait: 1000 },
        { name: '07_workspace_passport', url: 'http://127.0.0.1:3000/applications/APP-2026-003', clickTab: 'Evidence Passport', title: 'Case Evidence Passport Tab', wait: 1000 },
        { name: '08_evidence_explorer', url: 'http://127.0.0.1:3000/applications/APP-2026-003/evidence', title: 'Forensic Evidence Explorer', wait: 1200 },
        { name: '09_review_desk', url: 'http://127.0.0.1:3000/review', title: 'Adjudication Review Desk', wait: 1200 },
        { name: '10_rules_policy', url: 'http://127.0.0.1:3000/rules', title: 'Regulatory Rules Catalog', wait: 1000 },
        { name: '11_policy_replay', url: 'http://127.0.0.1:3000/replay', title: 'Policy Replay Backtest Engine', wait: 1200 },
        { name: '12_audit_trail', url: 'http://127.0.0.1:3000/audit', title: 'System Audit Ledger', wait: 1000 },
        { name: '13_printable_dossier', url: 'http://127.0.0.1:8000/api/applications/APP-2026-003/report', title: 'Printable Compliance Dossier', wait: 1000 },
    ];

    const results = [];
    for (const item of pagesToCapture) {
        try {
            console.log(`[CAPTURE] Navigating to ${item.name} (${item.url})...`);
            await page.goto(item.url, { waitUntil: 'networkidle', timeout: 15000 });
            await page.waitForTimeout(item.wait || 800);

            if (item.clickTab) {
                const tab = await page.$(`button:has-text("${item.clickTab}")`);
                if (tab) {
                    await tab.click();
                    await page.waitForTimeout(800);
                }
            }

            const shotPath = path.join(outDir, `${item.name}.png`);
            await page.screenshot({ path: shotPath, fullPage: false });
            console.log(`[PASS] Saved ${item.name}.png`);
            results.push({ name: item.name, status: 'PASS' });
        } catch (err) {
            console.error(`[FAIL] ${item.name}: ${err.message}`);
            results.push({ name: item.name, status: 'FAIL', error: err.message });
        }
    }

    await browser.close();
    console.log('\n--- Capture Summary ---');
    console.log(results);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
