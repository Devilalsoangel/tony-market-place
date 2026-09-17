const { chromium } = require("C:/Users/TONI/.config/opencode/node_modules/playwright");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222").catch(e => { console.log(e.message); process.exit(1); });
  
  let page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes("susej-admin-panel"));
  
  console.log("[1] Going to dashboard...");
  await page.goto("https://susej-admin-panel.vercel.app/dashboard", { waitUntil: "networkidle" });
  await sleep(5000);
  
  const links = await page.evaluate(() => 
    Array.from(document.querySelectorAll("a"))
      .filter(a => (a.textContent||"").toLowerCase().includes("seller"))
      .map(a => ({ text: a.textContent.trim().slice(0, 60), href: a.href }))
  );
  console.log("Seller links found:", JSON.stringify(links, null, 2));
  
  if (links.length > 0) {
    const target = links.find(l => l.text.toLowerCase().includes("verif")) || links[0];
    console.log("Navigating to:", target.href);
    await page.goto(target.href, { waitUntil: "networkidle" });
    await sleep(5000);
    console.log("URL:", page.url());
    
    const info = await page.evaluate(() => {
      const r = { url: window.location.href, title: document.title };
      r.bodyText = document.body ? document.body.innerText.slice(0, 6000) : "";
      r.buttons = Array.from(document.querySelectorAll("button")).map(b => ({ text: b.textContent.trim().slice(0, 60), disabled: b.disabled })).filter(b => b.text).slice(0, 30);
      r.tables = Array.from(document.querySelectorAll("table")).map(t => {
        const rows = Array.from(t.querySelectorAll("tr")).slice(0, 20).map(tr => 
          Array.from(tr.querySelectorAll("td, th")).map(td => td.textContent.trim().slice(0, 80)).join(" | ")
        );
        return rows;
      });
      r.docLinks = Array.from(document.querySelectorAll("a")).filter(a => (a.textContent||"").toLowerCase().includes("doc") || a.href.toLowerCase().includes("doc") || a.href.toLowerCase().includes("pdf") || a.href.toLowerCase().includes("upload")).map(a => ({text: a.textContent.trim().slice(0,50), href: a.href})).slice(0, 10);
      r.hasFileInputs = document.querySelectorAll('input[type="file"]').length;
      return r;
    });
    
    console.log(JSON.stringify(info, null, 2));
    await page.screenshot({ path: "C:/Users/TONI/projects/social-commerce/tools/seller-verification-real.png", fullPage: true });
    console.log("Screenshot saved");
  }
  
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });