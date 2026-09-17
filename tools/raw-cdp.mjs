#!/usr/bin/env node
// raw-cdp.mjs - evaluate JS in a specific tab via raw CDP websocket (no Playwright attach).
// Usage: node raw-cdp.mjs <urlContains> <jsExpressionFile> [--out file] [--click selectorText]
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire('C:/Users/TONI/.config/opencode/package.json');
const WebSocket = require('ws');

const CDP_HTTP = 'http://127.0.0.1:9222';
const [match, jsPath] = process.argv.slice(2);
const outIdx = process.argv.indexOf('--out');
const outFile = outIdx > 0 ? process.argv[outIdx + 1] : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!match || !jsPath) { console.error('usage: raw-cdp.mjs <urlContains> <jsfile> [--out file]'); process.exit(4); }
  const tabs = await (await fetch(`${CDP_HTTP}/json/list`)).json();
  const page = tabs.find((t) => t.type === 'page' && (t.url || '').includes(match));
  if (!page) { console.error('NO TAB matching: ' + match); process.exit(3); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = (e) => rej(new Error('ws error')); });
  const js = fs.readFileSync(jsPath, 'utf8');
  const result = await new Promise((res, rej) => {
    const id = 1;
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) res(msg.result);
    };
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: js, awaitPromise: true, returnByValue: true } }));
    setTimeout(() => rej(new Error('evaluate timeout')), 20000);
  });
  const value = result?.result?.value !== undefined ? result.result.value : result;
  const json = JSON.stringify(value, null, 2);
  if (outFile) fs.writeFileSync(outFile, json);
  console.log(json.slice(0, 4000));
  ws.close();
}
main().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });