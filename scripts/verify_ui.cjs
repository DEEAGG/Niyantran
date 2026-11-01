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

    console.log('3. Setting token and navigating to Dashboard...');
    await send('Runtime.evaluate', {
      expression: `localStorage.setItem('niyantran_token', ${JSON.stringify(AUTH_TOKEN)}); window.location.href = '/';`
    });

    // Wait for Dashboard to mount
    console.log('4. Waiting for Dashboard headline to mount...');
    let mounted = false;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 400));
      const evalRes = await send('Runtime.evaluate', {
        expression: 'Boolean(document.querySelector("h1[aria-label=\'Turn Documents into Clear Decisions\']"))',
        returnByValue: true
      });
      if (evalRes.result?.result?.value === true) {
        mounted = true;
        break;
      }
    }

    if (!mounted) {
      throw new Error('Dashboard headline failed to mount');
    }
    console.log('   Dashboard mounted successfully!');

    // 1. Initial State Check (Normal State)
    console.log('\n--- TEST 1: INITIAL PAGE LOAD (NORMAL STATE) ---');
    const scroll0Transforms = await send('Runtime.evaluate', {
      expression: `(() => {
        const h1 = document.querySelector('h1');
        const chars = Array.from(h1.querySelectorAll('span span[aria-hidden="true"]'));
        return chars.map((el) => ({
          char: el.textContent,
          isOrange: el.classList.contains('text-[#E43D12]'),
          styleTransform: el.style.transform || 'none'
        })).filter(c => ['T', 'u', 'D', 'o', 'c', 'u', 's', 'i', 'C', 's'].includes(c.char));
      })()`,
      returnByValue: true
    });
    console.log('   Characters at scrollY = 0:');
    console.log(JSON.stringify(scroll0Transforms.result.result.value, null, 2));

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'niyantran_initial_normal.png'), Buffer.from(shot1.result.data, 'base64'));
    console.log('   Screenshot saved: niyantran_initial_normal.png');

    // 2. Scroll Down Check (Dispersion State)
    console.log('\n--- TEST 2: SCROLL DOWN (DISPERSION STATE) ---');
    await send('Runtime.evaluate', {
      expression: 'window.scrollTo({ top: 350, behavior: "instant" }); window.dispatchEvent(new Event("scroll"));'
    });
    await new Promise(r => setTimeout(r, 600));

    const scroll350Transforms = await send('Runtime.evaluate', {
      expression: `(() => {
        const h1 = document.querySelector('h1');
        const chars = Array.from(h1.querySelectorAll('span span[aria-hidden="true"]'));
        return chars.map((el) => ({
          char: el.textContent,
          isOrange: el.classList.contains('text-[#E43D12]'),
          styleTransform: el.style.transform
        })).filter(c => ['T', 'u', 'D', 'o', 'c', 'u', 's', 'i', 'C', 's'].includes(c.char));
      })()`,
      returnByValue: true
    });
    console.log('   Characters at scrollY = 350 (Dispersed):');
    console.log(JSON.stringify(scroll350Transforms.result.result.value, null, 2));

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'niyantran_scrolled_dispersed.png'), Buffer.from(shot2.result.data, 'base64'));
    console.log('   Screenshot saved: niyantran_scrolled_dispersed.png');

    // 3. Scroll Up Check (Return to Normal State)
    console.log('\n--- TEST 3: SCROLL UP (RETURN TO NORMAL) ---');
    await send('Runtime.evaluate', {
      expression: 'window.scrollTo({ top: 0, behavior: "instant" }); window.dispatchEvent(new Event("scroll"));'
    });
    await new Promise(r => setTimeout(r, 600));

    const scrollBackTransforms = await send('Runtime.evaluate', {
      expression: `(() => {
        const h1 = document.querySelector('h1');
        const chars = Array.from(h1.querySelectorAll('span span[aria-hidden="true"]'));
        return chars.map((el) => ({
          char: el.textContent,
          isOrange: el.classList.contains('text-[#E43D12]'),
          styleTransform: el.style.transform || 'none'
        })).filter(c => ['T', 'u', 'D', 'o', 'c', 'u', 's', 'i', 'C', 's'].includes(c.char));
      })()`,
      returnByValue: true
    });
    console.log('   Characters after scrolling back to scrollY = 0:');
    console.log(JSON.stringify(scrollBackTransforms.result.result.value, null, 2));

    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'niyantran_returned_normal.png'), Buffer.from(shot3.result.data, 'base64'));
    console.log('   Screenshot saved: niyantran_returned_normal.png');

    // 4. Mobile Viewport Check (390px Width)
    console.log('\n--- TEST 4: MOBILE VIEWPORT TEST (390px) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 600));

    const overflowCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          windowWidth: window.innerWidth,
          bodyScrollWidth: document.body.scrollWidth,
          htmlScrollWidth: document.documentElement.scrollWidth,
          hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
        };
      })()`,
      returnByValue: true
    });
    console.log('   Mobile Overflow Evaluation:');
    console.log(JSON.stringify(overflowCheck.result.result.value, null, 2));

    const shot4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'niyantran_mobile_normal.png'), Buffer.from(shot4.result.data, 'base64'));
    console.log('   Screenshot saved: niyantran_mobile_normal.png');

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
