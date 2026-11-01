const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJVU1ItMUM5RDkxMEMxREU1IiwiZW1haWwiOiJvZmZpY2VyX3VpX3Rlc3RAbml5YW50cmFuLmdvdi5pbiIsInJvbGUiOiJpbnN0aXR1dGlvbl91c2VyIiwiZnVsbF9uYW1lIjoiQ2hpZWYgUmVndWxhdG9yeSBPZmZpY2VyIiwiaW5zdGl0dXRpb25fbmFtZSI6IkNlbnRyYWwgUmVndWxhdG9yeSBEaXJlY3RvcmF0ZSIsImluc3RpdHV0aW9uX2lkIjoiSU5TVC02ODE2MkE4QiIsInBlcm1pc3Npb25zIjpbInJ1bGVzOnJlYWQiLCJjbGF1c2VzOnJlYWQiLCJzb3VyY2VzOnJlYWQiLCJhcHBsaWNhdGlvbnM6cmVhZCIsImFwcGxpY2F0aW9uczp3cml0ZSIsImFwcGxpY2F0aW9uczp2YWxpZGF0ZSIsImRvY3VtZW50czpyZWFkIiwiZG9jdW1lbnRzOndyaXRlIiwiZmluZGluZ3M6cmVhZCJdLCJpc3MiOiJuaXlhbnRyYW4tcmVndWxhdG9yeS1wbGF0Zm9ybSIsImV4cCI6MTc5MzU1ODcyNSwiaWF0IjoxNzkzNTI5OTI1fQ.Gxpqyq6PlIpfEYPZD0f-DjmHEOuVxm--54WNWXJdlVE";

async function run() {
  const artifactDir = path.resolve('C:/Users/Deepansh Aggarwal/.gemini/antigravity/brain/280a8339-aea4-4300-81c5-eb9e22e646a5');
  console.log('1. Launching Headless Chrome on CDP port 9222...');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,960',
    'http://127.0.0.1:4173'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9222/json');
    const tabs = await listRes.json();
    const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('4173')) || tabs[0];
    console.log('2. Connected to tab:', pageTab.title, pageTab.url);

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    let id = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (callbacks.has(data.id)) {
        const cb = callbacks.get(data.id);
        callbacks.delete(data.id);
        cb(data);
      }
    };

    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const reqId = id++;
        callbacks.set(reqId, resolve);
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    console.log('3. Setting token and navigating to /intelligence ...');
    await send('Runtime.evaluate', {
      expression: `localStorage.setItem('niyantran_token', ${JSON.stringify(AUTH_TOKEN)}); window.location.href = '/intelligence';`
    });

    // Wait for Regulatory Intelligence heading to mount
    console.log('4. Waiting for "Regulatory Intelligence & Verification Workflow" heading to mount...');
    let mounted = false;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 400));
      const evalRes = await send('Runtime.evaluate', {
        expression: 'Boolean(document.querySelector("h1[aria-label=\'Regulatory Intelligence & Verification Workflow\']"))',
        returnByValue: true
      });
      if (evalRes.result?.result?.value === true) {
        mounted = true;
        break;
      }
    }

    if (!mounted) {
      throw new Error('Regulatory Intelligence heading failed to mount');
    }
    console.log('   Heading mounted successfully!');

    // 1. Initial State Check (Normal State & Typography Spacing)
    console.log('\n--- TEST 1: INITIAL PAGE LOAD (NORMAL STATE & LINE-HEIGHT) ---');
    const headingMetrics = await send('Runtime.evaluate', {
      expression: `(() => {
        const h1 = document.querySelector('h1[aria-label="Regulatory Intelligence & Verification Workflow"]');
        const style = window.getComputedStyle(h1);
        const chars = Array.from(h1.querySelectorAll('span span[aria-hidden="true"]'));
        const normalChar = chars.find(el => !el.classList.contains('text-[#E43D12]'));
        const orangeChar = chars.find(el => el.classList.contains('text-[#E43D12]'));

        // Measure line boxes
        const wordSpans = Array.from(h1.querySelectorAll('h1 > span'));
        const wordTops = wordSpans.map(s => s.getBoundingClientRect().top);
        const uniqueLines = Array.from(new Set(wordTops.map(t => Math.round(t))));

        return {
          totalChars: chars.length,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          fontFamily: style.fontFamily,
          normalCharLetter: normalChar?.textContent,
          normalCharFontSize: normalChar ? window.getComputedStyle(normalChar).fontSize : null,
          orangeCharLetter: orangeChar?.textContent,
          orangeCharFontSize: orangeChar ? window.getComputedStyle(orangeChar).fontSize : null,
          fontSizeIdentical: normalChar && orangeChar ? window.getComputedStyle(normalChar).fontSize === window.getComputedStyle(orangeChar).fontSize : true,
          distinctWrappedLines: uniqueLines.length,
          initialTransforms: chars.slice(0, 8).map(c => ({ char: c.textContent, transform: c.style.transform || 'none' }))
        };
      })()`,
      returnByValue: true
    });
    console.log('   Heading Metrics:');
    console.log(JSON.stringify(headingMetrics.result.result.value, null, 2));

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'niyantran_intelligence_initial.png'), Buffer.from(shot1.result.data, 'base64'));
    console.log('   Screenshot saved: niyantran_intelligence_initial.png');

    // 2. Scroll Down Check (Character Dispersion without overlap)
    console.log('\n--- TEST 2: SCROLL DOWN (DISPERSION WITHOUT MULTILINE OVERLAP) ---');
    await send('Runtime.evaluate', {
      expression: 'window.scrollTo({ top: 250, behavior: "instant" }); window.dispatchEvent(new Event("scroll"));'
    });
    await new Promise(r => setTimeout(r, 600));

    const dispersedMetrics = await send('Runtime.evaluate', {
      expression: `(() => {
        const h1 = document.querySelector('h1[aria-label="Regulatory Intelligence & Verification Workflow"]');
        const chars = Array.from(h1.querySelectorAll('span span[aria-hidden="true"]'));
        
        // Sample characters from start (left), middle, and end (right)
        const leftChars = chars.slice(0, 5).map(c => ({ char: c.textContent, transform: c.style.transform }));
        const middleChars = chars.slice(20, 24).map(c => ({ char: c.textContent, transform: c.style.transform }));
        const rightChars = chars.slice(-5).map(c => ({ char: c.textContent, transform: c.style.transform }));

        // Check vertical overlap between lines
        const wordSpans = Array.from(h1.querySelectorAll('h1 > span'));
        const rects = wordSpans.map(s => s.getBoundingClientRect());
        const line1Rects = rects.filter(r => Math.abs(r.top - rects[0].top) < 10);
        const line2Rects = rects.filter(r => r.top > rects[0].top + 10);

        let verticalGap = null;
        if (line1Rects.length > 0 && line2Rects.length > 0) {
          const maxLine1Bottom = Math.max(...line1Rects.map(r => r.bottom));
          const minLine2Top = Math.min(...line2Rects.map(r => r.top));
          verticalGap = minLine2Top - maxLine1Bottom;
        }

        return {
          leftChars,
          middleChars,
          rightChars,
          verticalGapBetweenLines: verticalGap,
          hasPositiveLineSeparation: verticalGap === null || verticalGap > 0
        };
      })()`,
      returnByValue: true
    });
    console.log('   Dispersed Metrics at scrollY = 250:');
    console.log(JSON.stringify(dispersedMetrics.result.result.value, null, 2));

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'niyantran_intelligence_dispersed.png'), Buffer.from(shot2.result.data, 'base64'));
    console.log('   Screenshot saved: niyantran_intelligence_dispersed.png');

    // 3. Scroll Up Check (Exact Restoration)
    console.log('\n--- TEST 3: SCROLL UP (EXACT RESTORATION TO NORMAL) ---');
    await send('Runtime.evaluate', {
      expression: 'window.scrollTo({ top: 0, behavior: "instant" }); window.dispatchEvent(new Event("scroll"));'
    });
    await new Promise(r => setTimeout(r, 600));

    const restoredMetrics = await send('Runtime.evaluate', {
      expression: `(() => {
        const h1 = document.querySelector('h1[aria-label="Regulatory Intelligence & Verification Workflow"]');
        const chars = Array.from(h1.querySelectorAll('span span[aria-hidden="true"]'));
        const allNone = chars.every(c => !c.style.transform || c.style.transform === 'none');
        return {
          allCharactersRestored: allNone,
          sampleTransforms: chars.slice(0, 6).map(c => ({ char: c.textContent, transform: c.style.transform || 'none' }))
        };
      })()`,
      returnByValue: true
    });
    console.log('   Restored State at scrollY = 0:');
    console.log(JSON.stringify(restoredMetrics.result.result.value, null, 2));

    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'niyantran_intelligence_returned.png'), Buffer.from(shot3.result.data, 'base64'));
    console.log('   Screenshot saved: niyantran_intelligence_returned.png');

    // 4. Mobile Viewport Check (390px Width)
    console.log('\n--- TEST 4: MOBILE VIEWPORT TEST (390px) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 600));

    const mobileMetrics = await send('Runtime.evaluate', {
      expression: `(() => {
        const h1 = document.querySelector('h1[aria-label="Regulatory Intelligence & Verification Workflow"]');
        const rect = h1 ? h1.getBoundingClientRect() : null;
        return {
          windowWidth: window.innerWidth,
          htmlScrollWidth: document.documentElement.scrollWidth,
          headingWidth: rect ? rect.width : null,
          hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
        };
      })()`,
      returnByValue: true
    });
    console.log('   Mobile Viewport Metrics:');
    console.log(JSON.stringify(mobileMetrics.result.result.value, null, 2));

    const shot4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'niyantran_intelligence_mobile.png'), Buffer.from(shot4.result.data, 'base64'));
    console.log('   Screenshot saved: niyantran_intelligence_mobile.png');

    ws.close();
  } finally {
    chrome.kill();
    console.log('5. Headless Chrome terminated cleanly.');
  }
}

run().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
