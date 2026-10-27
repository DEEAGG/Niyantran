const { chromium } = require('C:/Users/Deepansh Aggarwal/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');

async function runQA() {
    const outDir = path.resolve('artifacts/ui_redesign_editorial');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const browser = await chromium.launch({
        headless: true,
        executablePath: 'C:\\Users\\Deepansh Aggarwal\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
    });

    const results = [];

    // 1. Desktop Test (1440 x 900)
    const desktopContext = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1
    });
    const page = await desktopContext.newPage();

    const desktopScreens = [
        { name: '01_home_editorial', url: 'http://127.0.0.1:3000/', wait: 1200 },
        { name: '02_cases_registry', url: 'http://127.0.0.1:3000/cases', wait: 1000 },
        { name: '03_evidence_passport', url: 'http://127.0.0.1:3000/passport?app=APP-2026-003', wait: 1200 },
        { name: '04_intelligence_workspace', url: 'http://127.0.0.1:3000/intelligence?app=APP-2026-003', wait: 1200 },
        { name: '05_monitoring_cockpit', url: 'http://127.0.0.1:3000/monitoring', wait: 1200 },
        { name: '06_case_workspace', url: 'http://127.0.0.1:3000/applications/APP-2026-003', wait: 1000 },
        { name: '07_evidence_explorer', url: 'http://127.0.0.1:3000/applications/APP-2026-003/evidence', wait: 1200 },
        { name: '08_policy_replay', url: 'http://127.0.0.1:3000/replay', wait: 1200 },
        { name: '09_audit_trail', url: 'http://127.0.0.1:3000/audit', wait: 1000 },
    ];

    for (const item of desktopScreens) {
        try {
            console.log(`[DESKTOP] Navigating to ${item.name} (${item.url})...`);
            await page.goto(item.url, { waitUntil: 'networkidle', timeout: 15000 });
            await page.waitForTimeout(item.wait || 800);

            const shotPath = path.join(outDir, `${item.name}.png`);
            await page.screenshot({ path: shotPath, fullPage: false });
            console.log(`[PASS] Saved ${item.name}.png`);
            results.push({ name: item.name, viewport: '1440x900', status: 'PASS' });
        } catch (err) {
            console.error(`[FAIL] ${item.name}: ${err.message}`);
            results.push({ name: item.name, viewport: '1440x900', status: 'FAIL', error: err.message });
        }
    }

    // 2. Mobile Test (390 x 844)
    const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true
    });
    const mobilePage = await mobileContext.newPage();

    const mobileScreens = [
        { name: '10_home_mobile', url: 'http://127.0.0.1:3000/', wait: 1200 },
        { name: '11_cases_mobile', url: 'http://127.0.0.1:3000/cases', wait: 1000 },
        { name: '12_passport_mobile', url: 'http://127.0.0.1:3000/passport?app=APP-2026-003', wait: 1000 },
    ];

    for (const item of mobileScreens) {
        try {
            console.log(`[MOBILE] Navigating to ${item.name} (${item.url})...`);
            await mobilePage.goto(item.url, { waitUntil: 'networkidle', timeout: 15000 });
            await mobilePage.waitForTimeout(item.wait || 800);

            const shotPath = path.join(outDir, `${item.name}.png`);
            await mobilePage.screenshot({ path: shotPath, fullPage: false });
            console.log(`[PASS] Saved ${item.name}.png`);
            results.push({ name: item.name, viewport: '390x844', status: 'PASS' });
        } catch (err) {
            console.error(`[FAIL] ${item.name}: ${err.message}`);
            results.push({ name: item.name, viewport: '390x844', status: 'FAIL', error: err.message });
        }
    }

    await browser.close();
    console.log('\n=== VISUAL QA CAPTURE COMPLETE ===');
    console.log(JSON.stringify(results, null, 2));
}

runQA().catch(err => {
    console.error('Fatal error during QA:', err);
    process.exit(1);
});
