// Checks the running local API without creating accounts or submitting personal data.
import { puppeteer } from 'file:///C:/Users/admin/AppData/Local/npm-cache/_npx/15c61037b1978c83/node_modules/chrome-devtools-mcp/build/src/third_party/index.js';
import assert from 'node:assert/strict';

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  // The running Vite servers bind to localhost (IPv6), not IPv4 loopback.
  for (const host of ['localhost']) {
    for (const port of [5173, 5174]) {
      const origin = `http://${host}:${port}`;
      await page.goto(`${origin}/signup/student`);
      const result = await page.evaluate(async () => {
        const health = await fetch('http://127.0.0.1:8000/health');
        // An empty payload must be rejected by validation, before any database writes.
        const signup = await fetch('http://127.0.0.1:8000/auth/signup', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
        });
        return { health: health.status, signup: signup.status, readable: Boolean((await signup.json()).detail) };
      });
      assert.deepEqual(result, { health: 200, signup: 422, readable: true });
      console.log(`${origin}: API reachable; signup validation response readable in browser`);
    }
  }
} finally { await browser.close(); }
