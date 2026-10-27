const { chromium } = require('C:/Users/Deepansh Aggarwal/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');

async function main() {
    const outDir = path.resolve('artifacts/phase1_verification');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const browser = await chromium.launch({
        headless: true,
        args: ['--use-gl=angle', '--use-angle=default'],
        executablePath: 'C:\\Users\\Deepansh Aggarwal\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
    });

    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1
    });
    const page = await context.newPage();

    console.log('[1/4] Navigating to Regulatory Intelligence Page...');
    await page.goto('http://localhost:3000/intelligence', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    await page.screenshot({ path: path.join(outDir, '01_regulatory_intelligence_sources.png'), fullPage: true });
    console.log('Saved 01_regulatory_intelligence_sources.png');

    console.log('[2/4] Testing Knowledge Base Clauses tab...');
    // Look for button or tab with text "Statutory Clauses" or "Clause Explorer"
    const clauseTab = await page.$('button:has-text("Statutory Clauses"), button:has-text("Clause Explorer"), button:has-text("Search Clauses")');
    if (clauseTab) {
        await clauseTab.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(outDir, '02_regulatory_clause_explorer.png'), fullPage: true });
        console.log('Saved 02_regulatory_clause_explorer.png');
    }

    console.log('[3/4] Testing Rules Page...');
    await page.goto('http://localhost:3000/rules', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(outDir, '03_regulatory_rules_page.png'), fullPage: true });
    console.log('Saved 03_regulatory_rules_page.png');

    console.log('[4/4] Testing Monitoring Dashboard...');
    await page.goto('http://localhost:3000/monitoring', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(outDir, '04_monitoring_dashboard.png'), fullPage: true });
    console.log('Saved 04_monitoring_dashboard.png');

    await browser.close();
    console.log('Phase 1 browser verification complete!');
}

main().catch(err => {
    console.error('Browser verification failed:', err);
    process.exit(1);
});
