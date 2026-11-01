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

    console.log('3. Injecting authentication token into localStorage & navigating to / ...');
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

    // Check typography: verify font sizes are identical
    console.log('5. Checking Typography & Orange Highlighting (Strict Requirement)...');
    const typoCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const h1 = document.querySelector('h1');
        const h1Chars = Array.from(h1.querySelectorAll('span span[aria-hidden="true"]'));
        const normalChar = h1Chars.find(el => !el.classList.contains('text-[#E43D12]'));
        const orangeChar = h1Chars.find(el => el.classList.contains('text-[#E43D12]'));

        const normalFontSize = normalChar ? window.getComputedStyle(normalChar).fontSize : null;
        const orangeFontSize = orangeChar ? window.getComputedStyle(orangeChar).fontSize : null;
        const normalLineHeight = normalChar ? window.getComputedStyle(normalChar).lineHeight : null;
        const orangeLineHeight = orangeChar ? window.getComputedStyle(orangeChar).lineHeight : null;

        // Check subtext paragraph inline highlight
        const subtextP = Array.from(document.querySelectorAll('p')).find(p => p.textContent.includes('Review filings'));
        const subtextNormal = subtextP ? window.getComputedStyle(subtextP).fontSize : null;
        const subtextOrange = subtextP ? subtextP.querySelector('span.text-accent') : null;
        const subtextOrangeFontSize = subtextOrange ? window.getComputedStyle(subtextOrange).fontSize : null;
        const subtextOrangeColor = subtextOrange ? window.getComputedStyle(subtextOrange).color : null;

        return {
          totalHeadlineCharacters: h1Chars.length,
          normalCharLetter: normalChar?.textContent,
          normalFontSize,
          orangeCharLetter: orangeChar?.textContent,
          orangeFontSize,
          h1FontSizeMatch: normalFontSize === orangeFontSize,
          normalLineHeight,
          orangeLineHeight,
          h1LineHeightMatch: normalLineHeight === orangeLineHeight,
          subtextNormalFontSize: subtextNormal,
          subtextOrangeWord: subtextOrange?.textContent,
          subtextOrangeFontSize,
          subtextMatch: subtextNormal === subtextOrangeFontSize,
          subtextOrangeColor
        };
      })()`,
      returnByValue: true
    });

    console.log('   Typography Evaluation Results:');
    console.log(JSON.stringify(typoCheck.result.result.value, null, 2));

    // Check CharacterV1 animation at scroll 0 vs scroll 350
    console.log('6. Evaluating CharacterV1 Scroll-Linked Convergence Animation...');
    const scroll0Transforms = await send('Runtime.evaluate', {
      expression: `(() => {
        const h1 = document.querySelector('h1');
        const chars = Array.from(h1.querySelectorAll('span span[aria-hidden="true"]'));
        return chars.map((el) => ({
          char: el.textContent,
          isOrange: el.classList.contains('text-[#E43D12]'),
          styleTransform: el.style.transform
        })).filter(c => ['T', 'u', 'D', 'o', 'c', 'i', 'C', 's'].includes(c.char));
      })()`,
      returnByValue: true
    });
    console.log('   Transforms at scrollY = 0 (Dispersed):');
    console.log(JSON.stringify(scroll0Transforms.result.result.value, null, 2));

    // Scroll down to 350px
    await send('Runtime.evaluate', {
      expression: 'window.scrollTo({ top: 350, behavior: "instant" }); window.dispatchEvent(new Event("scroll"));'
    });
    await new Promise(r => setTimeout(r, 600));

    console.log('7. Capturing visual screenshot of converged state at scroll 350px...');
    const shotRes2 = await send('Page.captureScreenshot', { format: 'png' });
    const screenshotConvergedPath = path.join(artifactDir, 'niyantran_converged_scroll.png');
    fs.writeFileSync(screenshotConvergedPath, Buffer.from(shotRes2.result.data, 'base64'));
    console.log('   Converged screenshot saved to:', screenshotConvergedPath);

    const scroll350Transforms = await send('Runtime.evaluate', {
      expression: `(() => {
        const h1 = document.querySelector('h1');
        const chars = Array.from(h1.querySelectorAll('span span[aria-hidden="true"]'));
        return chars.map((el) => ({
          char: el.textContent,
          isOrange: el.classList.contains('text-[#E43D12]'),
          styleTransform: el.style.transform
        })).filter(c => ['T', 'u', 'D', 'o', 'c', 'i', 'C', 's'].includes(c.char));
      })()`,
      returnByValue: true
    });
    console.log('   Transforms at scrollY = 350 (Converged):');
    console.log(JSON.stringify(scroll350Transforms.result.result.value, null, 2));

    // Capture screenshot at top
    await send('Runtime.evaluate', {
      expression: 'window.scrollTo({ top: 0, behavior: "instant" });'
    });
    await new Promise(r => setTimeout(r, 500));

    console.log('8. Capturing visual screenshot of Dashboard with CharacterV1 headline and orange highlighting...');
    const shotRes = await send('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.join(artifactDir, 'niyantran_verified_dashboard.png');
    fs.writeFileSync(screenshotPath, Buffer.from(shotRes.result.data, 'base64'));
    console.log('   Screenshot saved to:', screenshotPath);

    ws.close();
  } finally {
    chrome.kill();
    console.log('8. Headless Chrome terminated cleanly.');
  }
}

run().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
