#!/usr/bin/env node
// rwy-oauth-flow.mjs - one-shot Railway browserless-login completer via raw CDP.
// Flow: wait for activate tab -> click Sign in -> Continue with GitHub ->
//       on github authorize tab click exact Authorize -> wait for backboard callback -> done.
import { createRequire } from 'module';
const require = createRequire('C:/Users/TONI/.config/opencode/package.json');
const WebSocket = require('ws');

const CDP = 'http://127.0.0.1:9222';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tabs() {
  try { return await (await fetch(`${CDP}/json/list`)).json(); } catch { return []; }
}
async function evalInTab(urlPart, expr, timeoutMs = 15000) {
  const list = await tabs();
  const t = list.find((x) => x.type === 'page' && (x.url || '').includes(urlPart));
  if (!t) return { __notab: true };
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  try {
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); ws.onclose = () => {}; });
    return await new Promise((res, rej) => {
      const id = Math.floor(Math.random() * 1e6);
      const timer = setTimeout(() => rej(new Error('eval-timeout')), timeoutMs);
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id === id) { clearTimeout(timer); res(m.result?.result?.value ?? m.result); }
      };
      ws.onclose = () => { clearTimeout(timer); res({ __ws_closed: true }); };
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    });
  } finally { try { ws.close(); } catch {} }
}
const click = (match) => evalInTab(match, `
  (() => {
    const el = [...document.querySelectorAll('button, a, input[type=submit]')]
      .find(b => (b.innerText || b.value || '').trim() === TARGET);
    if (el) { el.click(); return 'CLICKED:' + (el.innerText || el.value).trim().slice(0, 30); }
    return 'NO';
  })()
`.replace('TARGET', JSON.stringify(match)));

async function waitTab(urlPart, ms = 45000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const list = await tabs();
    const t = list.find((x) => x.type === 'page' && (x.url || '').includes(urlPart));
    if (t) return t;
    await sleep(1200);
  }
  return null;
}

async function main() {
  console.log('[1] waiting for railway activate tab...');
  const act = await waitTab('railway.com/activate', 40000);
  if (!act) { console.error('NO ACTIVATE TAB'); process.exit(2); }
  console.log('  activate tab found:', act.url.slice(0, 90));
  await sleep(3000);

  console.log('[2] click Sign in or create account...');
  for (let i = 0; i < 5; i++) {
    const r = await evalInTab('railway.com/activate', `
      (() => { const b = [...document.querySelectorAll('button, a')].find(x => (x.innerText||'').includes('Sign in or create account'));
        if (b) { b.click(); return 'CLICKED'; } return 'NO'; })()`);
    if (String(r).includes('CLICKED')) break;
    await sleep(2500);
  }
  await sleep(4000);

  console.log('[3] click Continue with GitHub...');
  for (let i = 0; i < 5; i++) {
    const r = await evalInTab('railway.com', `
      (() => { const b = [...document.querySelectorAll('button, a')].find(x => (x.innerText||'').includes('Continue with GitHub'));
        if (b) { b.click(); return 'CLICKED'; } return 'NO'; })()`);
    if (String(r).includes('CLICKED')) break;
    await sleep(2500);
  }

  console.log('[4] waiting for github authorize tab...');
  const gh = await waitTab('github.com/login/oauth', 40000);
  if (!gh) { console.error('NO GITHUB TAB'); process.exit(3); }
  console.log('  github tab:', gh.url.slice(0, 100));
  await sleep(3500);

  console.log('[5] click Authorize (exact)...');
  let clicked = false;
  for (let i = 0; i < 6 && !clicked; i++) {
    const r = await evalInTab('github.com/login/oauth', `
      (() => {
        const cands = [...document.querySelectorAll('input[type=submit], button')];
        const b = cands.find(x => /^(authorize)$/i.test((x.value || x.textContent || '').trim()));
        if (b) { b.click(); return 'CLICKED'; }
        return 'NO';
      })()`, 12000).catch((e) => String(e.message));
    if (String(r).includes('CLICKED')) { clicked = true; break; }
    if (String(r).includes('eval-timeout') || String(r).includes('__ws_closed')) { clicked = true; break; } // nav started
    await sleep(2500);
  }
  console.log('  authorize click:', clicked ? 'done (nav may have started)' : 'NOT clicked');

  console.log('[6] waiting for backboard callback / dashboard...');
  const end = Date.now() + 60000;
  let ok = false;
  while (Date.now() < end) {
    const list = await tabs();
    const back = list.find((x) => x.type === 'page' && /backboard\.railway\.com|railway\.com\/dashboard/.test(x.url || ''));
    if (back) { ok = true; console.log('  landed:', back.url.slice(0, 90)); break; }
    await sleep(1500);
  }
  console.log(ok ? 'FLOW-COMPLETE' : 'FLOW-UNVERIFIED (check tab manually)');
  process.exit(ok ? 0 : 4);
}
main().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });