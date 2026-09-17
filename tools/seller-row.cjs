const { chromium } = require("C:/Users/TONI/.config/opencode/node_modules/playwright");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222").catch(e => { console.log(e.message); process.exit(1); });
  
  let page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes("susej-admin-panel"));
  
  await page.goto("https://susej-admin-panel.vercel.app/dashboard/seller-verification", { waitUntil: "networkidle" });
  await sleep(3000);
  
  // Find the seller row and inspect all elements/buttons
  const info = await page.evaluate(() => {
    const r = {};
    
    // Find all rows in the seller table
    const rows = Array.from(document.querySelectorAll("tr"));
    r.rowCount = rows.length;
    r.rows = rows.map(tr => ({
      text: Array.from(tr.querySelectorAll("td, th")).map(td => td.textContent.trim().slice(0, 120)).join(" | "),
      html: Array.from(tr.querySelectorAll("td, th")).map(td => td.innerHTML.slice(0, 300))
    }));
    
    // Find the "Actions" column / buttons on the row
    r.allButtonsInRows = Array.from(document.querySelectorAll("tr button, tr a")).map(el => ({ 
      text: (el.textContent||"").trim().slice(0, 60), 
      tag: el.tagName, 
      href: (el.tagName === 'A' ? el.href : ''),
      class: (el.className||'').toString().slice(0, 80)
    })).slice(0, 20);
    
    // Check for eye/view/detail icons
    r.icons = Array.from(document.querySelectorAll("svg, [class*='eye'], [class*='view'], [class*='detail'], [class*='doc'], [class*='file']"))
      .slice(0, 10).map(el => ({ tag: el.tagName, title: el.title || '', class: (el.className||'').toString().slice(0, 80) }));
    
    return r;
  });
  
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: "C:/Users/TONI/projects/social-commerce/tools/seller-row-details.png", fullPage: true });
  
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });