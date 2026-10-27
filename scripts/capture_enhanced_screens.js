const { chromium } = require('C:/Users/Deepansh Aggarwal/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');

async function main() {
    const outDir = path.resolve('artifacts/ui_enhanced');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const browser = await chromium.launch({
        headless: true,
        executablePath: 'C:\\Users\\Deepansh Aggarwal\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
    });

    console.log('[1/3] Capturing Desktop Viewport (1440x900)...');
    let context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1
    });
    let page = await context.newPage();

    const desktopViews = [
        { name: '01_home_enhanced', url: 'http://127.0.0.1:3000/', wait: 1200 },
        { name: '02_cases_enhanced', url: 'http://127.0.0.1:3000/cases', wait: 1000 },
        { name: '03_passport_enhanced', url: 'http://127.0.0.1:3000/passport', wait: 1000 },
        { name: '04_intelligence_enhanced', url: 'http://127.0.0.1:3000/intelligence', wait: 1000 },
        { name: '05_monitoring_enhanced', url: 'http://127.0.0.1:3000/monitoring', wait: 1000 },
    ];

    for (const item of desktopViews) {
        console.log(`  -> Navigating to ${item.name} (${item.url})...`);
        await page.goto(item.url, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(item.wait || 800);
        const outPath = path.join(outDir, `${item.name}.png`);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log(`  ✓ Saved ${outPath}`);
    }

    // Capture focused dropzone
    console.log('  -> Capturing 06_upload_dropzone_enhanced...');
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(600);
    const dropzone = await page.$('[data-testid="document-upload-dropzone"]');
    if (dropzone) {
        await dropzone.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        const dropzonePath = path.join(outDir, '06_upload_dropzone_enhanced.png');
        await dropzone.screenshot({ path: dropzonePath });
        console.log(`  ✓ Saved ${dropzonePath}`);
    } else {
        const dropzonePath = path.join(outDir, '06_upload_dropzone_enhanced.png');
        await page.screenshot({ path: dropzonePath });
        console.log(`  ✓ Saved fallback ${dropzonePath}`);
    }
    await context.close();

    console.log('\n[2/3] Capturing Laptop Viewport (1280x800)...');
    context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1
    });
    page = await context.newPage();
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    const laptopPath = path.join(outDir, '07_home_laptop.png');
    await page.screenshot({ path: laptopPath, fullPage: false });
    console.log(`  ✓ Saved ${laptopPath}`);
    await context.close();

    console.log('\n[3/3] Capturing Mobile Viewport (390x844)...');
    context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
    });
    page = await context.newPage();

    const mobileViews = [
        { name: '08_home_mobile', url: 'http://127.0.0.1:3000/' },
        { name: '09_cases_mobile', url: 'http://127.0.0.1:3000/cases' },
        { name: '10_passport_mobile', url: 'http://127.0.0.1:3000/passport' },
    ];

    for (const item of mobileViews) {
        console.log(`  -> Navigating to ${item.name} (${item.url})...`);
        await page.goto(item.url, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1000);
        const outPath = path.join(outDir, `${item.name}.png`);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log(`  ✓ Saved ${outPath}`);
    }
    await context.close();

    await browser.close();
    console.log('\n[COMPLETE] All enhanced screenshots successfully captured in artifacts/ui_enhanced/');
}

main().catch(err => {
    console.error('Error running screenshot capture:', err);
    process.exit(1);
});
