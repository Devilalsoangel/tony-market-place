// nav-audit.cjs - extract REAL sidebar links + click-test every one
const { chromium } = require("C:/Users/TONI/.config/opencode/node_modules/playwright");
const BASE = "https://susej-admin-panel.vercel.app";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  let page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes("susej-admin-panel"));
  if (!page) { page = await browser.contexts()[0].newPage(); }
  await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(4000);

  // Real sidebar links
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="/dashboard"]')].map(a => ({ href: a.getAttribute("href"), text: a.innerText.trim().slice(0, 30) }))
  );
  const uniq = [...new Map(links.map(l => [l.href, l])).values()];
  console.log("=== SIDEBAR LINKS (" + uniq.length + ") ===");
  uniq.forEach(l => console.log(l.href + "  <- " + l.text));

  // Visit each and test buttons
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 150)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 150)); });

  for (const l of uniq) {
    try {
      await page.goto(BASE + l.href, { waitUntil: "domcontentloaded", timeout: 20000 });
      await sleep(2200);
      const is404 = await page.evaluate(() => document.body.innerText.includes("This page could not be found"));
      const info = await page.evaluate(() => ({
        rows: document.querySelectorAll("tr").length,
        btns: document.querySelectorAll("button").length,
        inputs: document.querySelectorAll("input, select, textarea").length,
        empty: /No .* found|No data|empty|Nothing here/i.test(document.body.innerText),
      }));
      console.log(`${is404 ? "404!" : "OK "} ${l.href} rows=${info.rows} btns=${info.btns} inputs=${info.inputs} ${info.empty ? "[EMPTY]" : ""}`);
    } catch (e) { console.log(`FAIL ${l.href}: ${e.message.slice(0, 60)}`); }
  }

  console.log("\n=== ERRORS (" + errors.length + ") ===");
  [...new Set(errors)].slice(0, 25).forEach(e => console.log("ERR:", e));
  process.exit(0);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });