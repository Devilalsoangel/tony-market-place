// Reusable CDP driver over the warm logged-in Chrome (127.0.0.1:9222)
// Usage from other scripts: const { getBrowser, newTab, tabs } = await import('./cdp-lib.mjs')
import fs from 'node:fs';
const require = (await import('module')).createRequire(import.meta.url);
const { chromium } = require('C:/Users/TONI/.config/opencode/node_modules/playwright');

export async function getBrowser() {
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const b = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 20000 });
      return b;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 2500));
    }
  }
  throw lastErr;
}


export async function newTab(browser, url, waitUntil = 'domcontentloaded', timeoutMs = 45000) {
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil, timeout: timeoutMs });
  return page;
}

export async function tabs(browser) {
  const out = [];
  for (const ctx of browser.contexts()) {
    for (const p of ctx.pages()) out.push({ url: p.url(), title: await p.title().catch(() => '') });
  }
  return out;
}

export async function shot(page, file) {
  await page.screenshot({ path: file, fullPage: false });
  return fs.statSync(file).size;
}
