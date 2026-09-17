#!/usr/bin/env node
// cdp-drive.mjs - drive the logged-in Chrome (CDP :9222) via Playwright for deploy automation.
// Usage:
//   node cdp-drive.mjs shot <url> <outfile>                     -> goto URL, screenshot
//   node cdp-drive.mjs eval  <url> <jsfile>   [--out <json>]    -> goto URL, run JS file in page, print JSON result
//   node cdp-drive.mjs click <url> <jsfile>                     -> goto URL, run JS (clicks etc), screenshot, wait 2500ms
// Runs against EXISTING warm profile - no tab spam: reuses the first matching page or opens ONE tab, closes it after.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/TONI/.config/opencode/node_modules/playwright');

const CDP = 'http://127.0.0.1:9222';
const [cmd, url, jsPath] = process.argv.slice(2);
const outIdx = process.argv.indexOf('--out');
const outFile = outIdx > 0 ? process.argv[outIdx + 1] : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!cmd || !url) { console.error('usage: cdp-drive.mjs <shot|eval|click> <url> <jsfile|-> [--out file]'); process.exit(4); }
  const browser = await chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0];
  if (!ctx) { console.error('no browser context'); process.exit(4); }
  let page = ctx.pages().find((p) => !p.url().startsWith('chrome://'));
  const fresh = !page;
  if (fresh) page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await sleep(1800);
    if (cmd === 'shot') {
      const buf = await page.screenshot({ fullPage: false });
      fs.writeFileSync(jsPath && jsPath !== '-' ? jsPath : 'cdp-shot.png', buf);
      console.log('SHOT saved: ' + (jsPath || 'cdp-shot.png') + ' | ' + page.url());
    } else if (cmd === 'eval' || cmd === 'click') {
      const js = jsPath === '-' ? '1' : fs.readFileSync(jsPath, 'utf8');
      const res = await page.evaluate(js).catch((e) => ({ __error: String(e) }));
      if (cmd === 'click') {
        await sleep(2500);
        const buf = await page.screenshot({ fullPage: false });
        const shot = outFile ? outFile : 'cdp-after-click.png';
        fs.writeFileSync(shot, buf);
        console.log('CLICK-DONE shot=' + shot + ' url=' + page.url());
      }
      if (outFile) fs.writeFileSync(outFile, JSON.stringify(res, null, 2));
      console.log(JSON.stringify(res).slice(0, 1800));
    }
  } finally {
    if (fresh) await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
main().catch((e) => { console.error('FATAL: ' + e.message.slice(0, 400)); process.exit(1); });