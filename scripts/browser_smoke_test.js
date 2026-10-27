async function(page) {
    const results = [];
    let passedCount = 0;
    let failedCount = 0;

    // Track console & failed requests
    const consoleLogs = [];
    const failedRequests = [];

    page.on('console', msg => {
        consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    page.on('response', resp => {
        if (resp.status() >= 400 && !resp.url().includes('favicon.ico')) {
            failedRequests.push({
                url: resp.url(),
                status: resp.status(),
                statusText: resp.statusText()
            });
        }
    });

    const check = async (name, url, expectedText, screenshotPath, options = {}) => {
        const item = { name, url, screenshot: screenshotPath, passed: false };
        try {
            const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(600);
            const status = resp ? resp.status() : 0;
            item.status = status;

            if (options.expectedStatus && status !== options.expectedStatus) {
                throw new Error(`Expected status ${options.expectedStatus}, got ${status}`);
            }

            const content = await page.content();
            if (expectedText && !content.includes(expectedText)) {
                throw new Error(`Content does not contain expected text: "${expectedText}"`);
            }

            if (options.waitForSelector) {
                await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
            }

            await page.screenshot({
                path: screenshotPath,
                fullPage: !!options.fullPage
            });

            item.passed = true;
            passedCount++;
        } catch (err) {
            item.error = err.message;
            failedCount++;
            try {
                await page.screenshot({ path: 'artifacts/error_' + screenshotPath.replace(/^artifacts\//, '') });
            } catch (_) {}
        }
        results.push(item);
    };

    // 1. Home endpoint
    await check(
        'Home Page Endpoint',
        'http://127.0.0.1:8000/',
        'Niyantran',
        'artifacts/01_home_page.png',
        { expectedStatus: 200 }
    );

    // 2. Health endpoint
    await check(
        'Health Check Endpoint',
        'http://127.0.0.1:8000/api/health',
        'healthy',
        'artifacts/02_health_endpoint.png',
        { expectedStatus: 200 }
    );

    // 3. FastAPI Swagger UI Docs
    await check(
        'Swagger UI Documentation',
        'http://127.0.0.1:8000/docs',
        'Niyantran API',
        'artifacts/03_api_docs_swagger.png',
        { expectedStatus: 200, waitForSelector: '.swagger-ui', fullPage: true }
    );

    // 4. FastAPI ReDoc Docs
    await check(
        'ReDoc Documentation',
        'http://127.0.0.1:8000/redoc',
        'Niyantran API',
        'artifacts/04_api_docs_redoc.png',
        { expectedStatus: 200, waitForSelector: 'redoc', fullPage: true }
    );

    // 5. Frontend Check / Error Route
    await check(
        'Frontend Route / 404 Error State',
        'http://127.0.0.1:8000/app',
        'Not Found',
        'artifacts/05_frontend_404_error_state.png',
        { expectedStatus: 404 }
    );

    return {
        summary: { total: results.length, passed: passedCount, failed: failedCount },
        results: results,
        console_logs: consoleLogs,
        failed_network_requests: failedRequests,
        frontend_detected: false,
        note: "No React frontend detected in workspace; verified API and Swagger/ReDoc interactive UI."
    };
}
