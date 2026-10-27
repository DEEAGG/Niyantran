const { chromium } = require('C:/Users/Deepansh Aggarwal/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core');

(async () => {
    const browser = await chromium.launch({
        headless: true,
        executablePath: 'C:\\Users\\Deepansh Aggarwal\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
    });
    const page = await browser.newPage();
    page.on('console', m => console.log('PAGE LOG:', m.type(), m.text()));
    page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
    const hasInput = await page.$('input[type="file"]');
    console.log('hasInput found:', !!hasInput);
    if (!hasInput) {
        console.log('Current URL:', page.url());
        const bodyText = await page.innerText('body');
        console.log('Body preview:', bodyText.slice(0, 300));
    }
    await browser.close();
})();
