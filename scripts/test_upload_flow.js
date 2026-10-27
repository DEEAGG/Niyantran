const { chromium } = require('C:/Users/Deepansh Aggarwal/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');

async function testUploadFlow() {
    const outDir = path.resolve('artifacts/ui_redesign_editorial');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const browser = await chromium.launch({
        headless: true,
        executablePath: 'C:\\Users\\Deepansh Aggarwal\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
    });

    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    console.log('[UPLOAD TEST] Navigating to homepage...');
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Create a temporary valid PDF test file if needed
    const testPdfPath = path.resolve('tests/synthetic_demo.pdf');
    if (!fs.existsSync(testPdfPath)) {
        fs.writeFileSync(testPdfPath, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF');
    }

    console.log('[UPLOAD TEST] Setting input files...');
    await page.setInputFiles('input[type="file"]', testPdfPath);
    await page.waitForTimeout(800);

    // Fill optional institution name
    const instInput = await page.$('input[placeholder*="Green Valley"]');
    if (instInput) {
        await instInput.fill('National Institute of Advanced Compliance');
    }

    await page.screenshot({ path: path.join(outDir, '13_upload_prepared.png') });
    console.log('[UPLOAD TEST] Saved 13_upload_prepared.png');

    console.log('[UPLOAD TEST] Submitting upload form...');
    const submitBtn = await page.$('button[type="submit"]');
    await submitBtn.click();

    // Wait for processing and navigation
    console.log('[UPLOAD TEST] Waiting for navigation to new application...');
    await page.waitForURL(/.*\/applications\/APP-.*/, { timeout: 20000 });
    await page.waitForTimeout(1500);

    const resultingUrl = page.url();
    console.log(`[PASS] Successfully redirected to created application: ${resultingUrl}`);

    await page.screenshot({ path: path.join(outDir, '14_upload_success_workspace.png') });
    console.log('[UPLOAD TEST] Saved 14_upload_success_workspace.png');

    await browser.close();
    console.log('=== UPLOAD FLOW VERIFIED SUCCESSFULLY ===');
}

testUploadFlow().catch(err => {
    console.error('[UPLOAD TEST ERROR]:', err);
    process.exit(1);
});
