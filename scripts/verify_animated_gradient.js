const { chromium } = require('C:/Users/Deepansh Aggarwal/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');

async function main() {
    const outDir = path.resolve('artifacts/animated_gradient_integration');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const browser = await chromium.launch({
        headless: true,
        args: ['--use-gl=angle', '--use-angle=default'], // Ensure hardware-accelerated WebGL2
        executablePath: 'C:\\Users\\Deepansh Aggarwal\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
    });

    console.log('[1/4] Testing WebGL2 Context & Shader Activity on Desktop (1440x900)...');
    let context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1
    });
    let page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Verify canvas existence and WebGL2 context
    const webglInfo = await page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll('canvas[data-testid="animated-gradient-canvas"]'));
        if (canvases.length === 0) return { error: 'No animated-gradient canvas found' };

        const target = canvases[0];
        const gl = target.getContext('webgl2');
        const width = target.width;
        const height = target.height;
        const styleW = target.style.width;
        const styleH = target.style.height;

        // Sample a few pixels to verify non-empty rendering
        let hasNonZeroPixels = false;
        if (gl) {
            const pixels = new Uint8Array(4);
            gl.readPixels(Math.floor(width / 2), Math.floor(height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            hasNonZeroPixels = pixels[0] > 0 || pixels[1] > 0 || pixels[2] > 0 || pixels[3] > 0;
        }

        return {
            canvasCount: canvases.length,
            isWebGL2: !!gl,
            width,
            height,
            styleW,
            styleH,
            hasNonZeroPixels
        };
    });

    console.log('WebGL2 Status:', JSON.stringify(webglInfo, null, 2));

    const pages = [
        { name: '01_home_animated_gradient_1440', url: 'http://127.0.0.1:3000/' },
        { name: '02_cases_animated_gradient_1440', url: 'http://127.0.0.1:3000/cases' },
        { name: '03_passport_animated_gradient_1440', url: 'http://127.0.0.1:3000/passport' },
        { name: '04_intelligence_animated_gradient_1440', url: 'http://127.0.0.1:3000/intelligence' },
        { name: '05_monitoring_animated_gradient_1440', url: 'http://127.0.0.1:3000/monitoring' },
    ];

    for (const item of pages) {
        console.log(`  -> Capturing ${item.name}...`);
        await page.goto(item.url, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(800);
        const p = path.join(outDir, `${item.name}.png`);
        await page.screenshot({ path: p, fullPage: false });
        console.log(`  ✓ Saved ${p}`);
    }

    // Capture Hero canvas close-up
    console.log('  -> Capturing 07_webgl_canvas_inspection.png...');
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(500);
    const canvasEl = await page.$('canvas[data-testid="animated-gradient-canvas"]');
    if (canvasEl) {
        const p = path.join(outDir, '07_webgl_canvas_inspection.png');
        await canvasEl.screenshot({ path: p });
        console.log(`  ✓ Saved ${p}`);
    }
    await context.close();

    console.log('\n[2/4] Testing Mobile Viewport (390x844)...');
    context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
    });
    page = await context.newPage();
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    const mobilePath = path.join(outDir, '06_home_mobile_390.png');
    await page.screenshot({ path: mobilePath, fullPage: false });
    console.log(`  ✓ Saved ${mobilePath}`);
    await context.close();

    console.log('\n[3/4] Testing Fallback Behavior (WebGL2 Disabled)...');
    // Context with WebGL disabled to verify the accessible CSS fallback
    context = await browser.newContext({
        viewport: { width: 1440, height: 900 }
    });
    page = await context.newPage();
    // Override getContext to simulate lack of WebGL2
    await page.addInitScript(() => {
        HTMLCanvasElement.prototype.getContext = function(type) {
            if (type === 'webgl2') return null;
            return null;
        };
    });
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(800);

    const fallbackFound = await page.evaluate(() => {
        const fallbacks = document.querySelectorAll('[data-testid="animated-gradient-fallback"]');
        return fallbacks.length > 0;
    });
    console.log('  -> Fallback element detected when WebGL2 unavailable:', fallbackFound);
    const fallbackPath = path.join(outDir, '08_fallback_no_webgl.png');
    await page.screenshot({ path: fallbackPath, fullPage: false });
    console.log(`  ✓ Saved ${fallbackPath}`);
    await context.close();

    console.log('\n[4/4] Testing Real Application Interaction & Upload Flow...');
    context = await browser.newContext({
        viewport: { width: 1440, height: 900 }
    });
    page = await context.newPage();
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(500);

    // Create synthetic file and upload
    const testPdfPath = path.resolve('data/documents/test_upload_gradient.pdf');
    if (!fs.existsSync(testPdfPath)) {
        fs.writeFileSync(testPdfPath, '%PDF-1.4\n%TEST PDF DOCUMENT FOR GRADIENT INTERACTION TEST\n%%EOF');
    }

    await page.setInputFiles('input[type="file"]', testPdfPath);
    await page.waitForTimeout(500);

    const uploadBtn = await page.$('button:has-text("Upload Documents")');
    if (uploadBtn) {
        await uploadBtn.click();
        await page.waitForTimeout(2000);
        console.log('  -> Upload button clicked successfully. Current URL:', page.url());
    }
    await context.close();

    await browser.close();

    console.log('\n[SUMMARY]');
    console.log('- WebGL2 Validated:', webglInfo.isWebGL2);
    console.log('- Canvas Count:', webglInfo.canvasCount);
    console.log('- Fallback Verified:', fallbackFound);
    console.log('- Console Errors:', consoleErrors.length, consoleErrors);
}

main().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
