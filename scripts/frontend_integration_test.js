async function(page) {
    const results = [];
    const consoleLogs = [];
    const failedRequests = [];

    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleLogs.push({ type: msg.type(), text: msg.text() });
        }
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

    const step = async (title, action) => {
        const item = { title, passed: false };
        try {
            await action();
            item.passed = true;
        } catch (err) {
            item.error = err.message;
        }
        results.push(item);
        return item;
    };

    // 1. Dashboard Overview
    await step('01_dashboard', async () => {
        await page.goto('http://127.0.0.1:3000/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'artifacts/01_dashboard.png', fullPage: true });
    });

    // 2. Applications Registry
    await step('02_applications', async () => {
        await page.goto('http://127.0.0.1:3000/applications', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'artifacts/02_applications.png', fullPage: true });
    });

    // 3. Register New Application Form
    await step('03_application_create', async () => {
        await page.goto('http://127.0.0.1:3000/applications/new', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(600);
        
        // Fill form
        const nameInput = await page.$('input[name="institutionName"], input[placeholder*="Name"], input[id*="institutionName"]');
        if (nameInput) {
            await nameInput.fill('Apex Institute of Advanced AI & Regulatory Computing');
        }
        await page.screenshot({ path: 'artifacts/03_application_create.png', fullPage: true });
    });

    // 4. Application Workspace
    await step('04_application_workspace', async () => {
        await page.goto('http://127.0.0.1:3000/applications/APP-2026-001', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'artifacts/04_application_workspace.png', fullPage: true });
    });

    // 5. Document Upload Center
    await step('05_document_upload', async () => {
        await page.goto('http://127.0.0.1:3000/upload', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'artifacts/05_document_upload.png', fullPage: true });
    });

    // 6. Extracted Entities
    await step('06_extracted_fields', async () => {
        await page.goto('http://127.0.0.1:3000/extraction', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'artifacts/06_extracted_fields.png', fullPage: true });
    });

    // 7. Validation Center
    await step('07_validation_center', async () => {
        await page.goto('http://127.0.0.1:3000/validation', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'artifacts/07_validation_center.png', fullPage: true });
    });

    // 8. Evidence Explorer (3-Panel Layout)
    await step('08_evidence_explorer', async () => {
        await page.goto('http://127.0.0.1:3000/applications/APP-2026-003/evidence', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'artifacts/08_evidence_explorer.png', fullPage: true });
    });

    // 9. Review Center
    await step('09_review_desk', async () => {
        await page.goto('http://127.0.0.1:3000/review', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'artifacts/09_review_desk.png', fullPage: true });
    });

    // 10. ReguTrace Replay Engine
    await step('10_regutrace_replay', async () => {
        await page.goto('http://127.0.0.1:3000/replay', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'artifacts/10_regutrace_replay.png', fullPage: true });
    });

    // 11. Regulatory Rules Catalog
    await step('11_regulatory_rules', async () => {
        await page.goto('http://127.0.0.1:3000/rules', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'artifacts/11_regulatory_rules.png', fullPage: true });
    });

    // 12. Case Evidence Passport
    await step('12_evidence_passport', async () => {
        await page.goto('http://127.0.0.1:3000/applications/APP-2026-001', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(600);
        // Click on the Evidence Passport tab
        const passportTab = await page.$('button:has-text("Evidence Passport")');
        if (passportTab) {
            await passportTab.click();
            await page.waitForTimeout(800);
        }
        await page.screenshot({ path: 'artifacts/12_evidence_passport.png', fullPage: true });
    });

    // 13. Statutory Verification Dossier / Report
    await step('13_statutory_dossier_report', async () => {
        await page.goto('http://127.0.0.1:8000/api/applications/APP-2026-001/report', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(600);
        await page.screenshot({ path: 'artifacts/13_statutory_dossier_report.png', fullPage: true });
    });

    // 14. System Audit History
    await step('14_audit_ledger', async () => {
        await page.goto('http://127.0.0.1:3000/audit', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'artifacts/14_audit_ledger.png', fullPage: true });
    });

    return {
        summary: {
            total: results.length,
            passed: results.filter(r => r.passed).length,
            failed: results.filter(r => !r.passed).length,
        },
        results,
        consoleErrors: consoleLogs,
        failedRequests
    };
}
