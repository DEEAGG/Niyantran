async function(page) {
    const results = {
        screens: [],
        consoleErrors: [],
        failedRequests: [],
    };

    page.on('console', msg => {
        if (msg.type() === 'error') {
            results.consoleErrors.push(msg.text());
        }
    });

    page.on('requestfailed', req => {
        results.failedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
    });

    const pagesToCapture = [
        {
            name: '01_overview',
            url: 'http://127.0.0.1:3000/dashboard',
            title: 'Overview Console',
            wait: 800,
        },
        {
            name: '02_applications',
            url: 'http://127.0.0.1:3000/applications',
            title: 'Applications Registry',
            wait: 800,
        },
        {
            name: '03_workspace_overview',
            url: 'http://127.0.0.1:3000/applications/APP-2026-003',
            title: 'Application Workspace (Case APP-2026-003)',
            wait: 800,
        },
        {
            name: '04_workspace_entities',
            url: 'http://127.0.0.1:3000/applications/APP-2026-003',
            clickTab: 'Extracted Entities',
            title: 'Extracted OCR Entities Tab',
            wait: 800,
        },
        {
            name: '05_workspace_findings',
            url: 'http://127.0.0.1:3000/applications/APP-2026-003',
            clickTab: 'Compliance Findings',
            title: 'Compliance Findings Tab',
            wait: 800,
        },
        {
            name: '06_workspace_authenticity',
            url: 'http://127.0.0.1:3000/applications/APP-2026-003',
            clickTab: 'Authenticity',
            title: 'Authenticity & Multi-Signal Inspector',
            wait: 800,
        },
        {
            name: '07_workspace_passport',
            url: 'http://127.0.0.1:3000/applications/APP-2026-003',
            clickTab: 'Evidence Passport',
            title: 'Case Evidence Passport Tab',
            wait: 800,
        },
        {
            name: '08_evidence_explorer',
            url: 'http://127.0.0.1:3000/applications/APP-2026-003/evidence',
            title: 'Forensic Evidence Explorer',
            wait: 1000,
        },
        {
            name: '09_review_desk',
            url: 'http://127.0.0.1:3000/review',
            title: 'Adjudication Review Desk',
            wait: 800,
        },
        {
            name: '10_rules_policy',
            url: 'http://127.0.0.1:3000/rules',
            title: 'Regulatory Rules Catalog',
            wait: 800,
        },
        {
            name: '11_policy_replay',
            url: 'http://127.0.0.1:3000/replay',
            title: 'Policy Replay Backtest Engine',
            wait: 1000,
        },
        {
            name: '12_audit_trail',
            url: 'http://127.0.0.1:3000/audit',
            title: 'System Audit Ledger',
            wait: 800,
        },
        {
            name: '13_printable_dossier',
            url: 'http://127.0.0.1:8000/api/applications/APP-2026-003/report',
            title: 'Printable Compliance Dossier',
            wait: 800,
        },
    ];

    for (const item of pagesToCapture) {
        try {
            console.log(`Capturing ${item.name}: ${item.title}...`);
            await page.goto(item.url, { waitUntil: 'networkidle', timeout: 15000 });
            await page.waitForTimeout(item.wait || 600);

            if (item.clickTab) {
                const tab = await page.$(`button:has-text("${item.clickTab}")`);
                if (tab) {
                    await tab.click();
                    await page.waitForTimeout(600);
                }
            }

            await page.screenshot({ path: `artifacts/ui_redesign_final/${item.name}.png`, fullPage: false });
            results.screens.push({ name: item.name, title: item.title, status: 'PASS' });
        } catch (err) {
            console.error(`Error on ${item.name}:`, err.message);
            results.screens.push({ name: item.name, title: item.title, status: 'FAIL', error: err.message });
        }
    }

    console.log('=== REDESIGN SCREEN CAPTURE COMPLETE ===');
    console.log(JSON.stringify(results, null, 2));
    return results;
}
