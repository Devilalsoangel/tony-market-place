// admin-audit.cjs - walk EVERY admin page, capture console errors + broken UI
const { chromium } = require("C:/Users/TONI/.config/opencode/node_modules/playwright");

const BASE = "https://susej-admin-panel.vercel.app";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const PAGES = [
  "/dashboard", "/dashboard/home",
  "/dashboard/products", "/dashboard/categories", "/dashboard/orders", "/dashboard/auctions",
  "/dashboard/bundles", "/dashboard/food-hub", "/dashboard/bookings", "/dashboard/offers-coupons",
  "/dashboard/shipping", "/dashboard/users", "/dashboard/sellers", "/dashboard/sellers/pending",
  "/dashboard/blocked", "/dashboard/address-book", "/dashboard/payments", "/dashboard/promotions",
  "/dashboard/commission", "/dashboard/wallet", "/dashboard/refunds", "/dashboard/disputes",
  "/dashboard/loyalty", "/dashboard/payment-methods", "/dashboard/reviews", "/dashboard/posts",
  "/dashboard/stories", "/dashboard/communities", "/dashboard/hashtags", "/dashboard/reported",
  "/dashboard/tickets", "/dashboard/settings", "/dashboard/analytics", "/dashboard/system",
];

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222").catch(e => { console.error("CDP:", e.message); process.exit(1); });
  let page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes("susej-admin-panel"));
  if (!page) { page = await browser.contexts()[0].newPage(); }

  // Ensure logged in
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 45000 }).catch(()=>{});
  await sleep(4000);
  if (page.url().includes("/login")) {
    console.log("LOGIN REQUIRED - authenticating...");
    await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 45000 });
    await sleep(2000);
    const li = await page.$("#loginId"); const pw = await page.$("#password");
    if (li && pw) {
      await li.fill("alexrivera"); await pw.fill("Admin@123");
      const sb = await page.$('button[type="submit"]'); if (sb) { await sb.click(); await sleep(6000); }
    }
    if (page.url().includes("/2fa")) {
      await sleep(2000);
      const boxes = await page.$$('input[maxlength="1"]');
      if (boxes.length >= 6) {
        const code = "123456";
        for (let i = 0; i < 6; i++) { await boxes[i].click(); await boxes[i].fill(code[i]); }
        await sleep(3000);
        const vb = await page.$('button:has-text("Verify")'); if (vb) { await vb.click(); await sleep(8000); }
      }
    }
    console.log("AFTER LOGIN:", page.url());
  }

  // Collect console errors throughout
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type === "error") consoleErrors.push(msg.text.slice(0, 300)); });
  page.on("pageerror", (err) => consoleErrors.push("PAGE: " + String(err).slice(0, 300)));

  for (const p of PAGES) {
    const start = Date.now();
    try {
      await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 25000 });
      await sleep(2500);
      const info = await page.evaluate(() => {
        const body = document.body ? document.body.innerText : "";
        return {
          status: !body.includes("404") ? (body.includes("Error") || body.includes("Something went wrong") ? "ERROR" : "OK") : "404",
          title: document.title.slice(0, 60),
          hasTable: !!document.querySelector("table"),
          hasData: body.length > 200 && !/No .* yet\.|empty|No data/i.test(body),
          rowCount: document.querySelectorAll("tr").length,
          firstLines: body.split("\n").filter(l => l.trim()).slice(0, 12).join(" | ").slice(0, 250),
          buttons: document.querySelectorAll("button").length,
        };
      });
      console.log(`[${info.status}] ${p} (${Date.now()-start}ms) rows=${info.rowCount} btns=${info.buttons} :: ${info.firstLines}`);
    } catch (e) {
      console.log(`[FAIL] ${p} :: ${e.message.slice(0,80)}`);
    }
  }

  console.log("\n=== CONSOLE ERRORS (" + consoleErrors.length + ") ===");
  for (const e of [...new Set(consoleErrors)].slice(0, 30)) console.log("  ERR:", e);

  await page.screenshot({ path: "C:/Users/TONI/projects/social-commerce/tools/admin-audit-final.png", fullPage: true });
  process.exit(0);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });