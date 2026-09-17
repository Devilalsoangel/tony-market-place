#!/usr/bin/env node
// cdp-eval-any.mjs - evaluate JS in ANY existing page matching a URL pattern, or new tab to url.
// Usage: node cdp-eval-any.mjs <urlContains> <jsfile> [--out file]
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/TONI/.config/opencode/node_modules/playwright');

const CDP = 'http://127.0.0.1:9222';
const [match, jsPath] = process.argv.slice(2);
const outIdx = process.argv.indexOf('--out');
const outFile = outIdx > 0 ? process.argv[outIdx + 1] : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!match || !jsPath) { console.error('usage: cdp-eval-any.mjs <urlContains> <jsfile> [--out file]'); process.exit(4); }
  const browser = await chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0];
  let page = null;
  if (ctx) {
    for (const p of ctx.pages()) {
      if (p.url().includes(match)) { page = p; break; }
    }
  }
  const fresh = !page;
  if (!page) {
    if (!ctx) { console.error('no context'); process.exit(4); }
    page = await ctx.newPage();
    await page.goto(match, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
  }
  try {
    await sleep(2500);
    const js = fs.readFileSync(jsPath, 'utf8');
    const res = await page.evaluate(js).catch((e) => ({ __error: String(e).slice(0, 300) }));
    if (outFile) fs.writeFileSync(outFile, JSON.stringify(res, null, 2));
    console.log(JSON.stringify(res).slice(0, 3000));
  } finally {
    if (fresh) await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
main().catch((e) => { console.error('FATAL: ' + e.message.slice(0, 300)); process.exit(1); });