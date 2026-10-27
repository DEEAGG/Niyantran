const { chromium } = require('C:/Users/Deepansh Aggarwal/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core');
const path = require('path');

(async () => {
    const browser = await chromium.launch({
        headless: true,
        args: ['--use-gl=angle', '--use-angle=default'],
        executablePath: 'C:\\Users\\Deepansh Aggarwal\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/intelligence?tab=registry', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    const importBtn = await page.$('button:has-text("Import Regulatory Document")');
    if (importBtn) {
        await importBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'artifacts/phase1_verification/07_import_regulatory_modal.png', fullPage: true });
        console.log('Saved 07_import_regulatory_modal.png');
    }

    await browser.close();
})();
