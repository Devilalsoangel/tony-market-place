const { chromium } = require("C:/Users/TONI/.config/opencode/node_modules/playwright");

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222").catch(e => { console.log(e.message); process.exit(1); });
  
  let page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes("susej-admin-panel"));
  if (!page) {
    page = await browser.contexts()[0].newPage();
    await page.goto("https://susej-admin-panel.vercel.app", { waitUntil: "networkidle" });
  }
  
  if (page.url().includes("/login")) {
    console.log("On login page");
    await page.screenshot({ path: "C:/Users/TONI/projects/social-commerce/tools/admin-login.png", fullPage: true });
    console.log("Screenshot saved: admin-login.png");
    
    // List all buttons
    const btns = await page.$$("button");
    for (const b of btns) {
      const t = await b.textContent();
      console.log("Button:", t.trim().slice(0, 80));
    }
    
    // Check for Clerk embed
    const clerkFrames = await page.$$("iframe[src*='clerk'], iframe[id*='clerk']");
    console.log("Clerk iframes:", clerkFrames.length);
    
    // Try clicking Sign In
    for (const b of btns) {
      const t = await b.textContent();
      if (t && t.toLowerCase().includes("sign in")) {
        console.log("Clicking 'Sign In' button...");
        await b.click({ timeout: 10000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 5000));
        break;
      }
    }
    
    console.log("URL after click:", page.url());
    await page.screenshot({ path: "C:/Users/TONI/projects/social-commerce/tools/admin-after-click.png", fullPage: true });
    console.log("Screenshot saved: admin-after-click.png");
    
    // Check for Google popup
    const allPages = browser.contexts().flatMap(c => c.pages());
    for (const p of allPages) {
      if (p.url().includes("google") || p.url().includes("accounts")) {
        console.log("Found Google auth page:", p.url());
        await p.screenshot({ path: "C:/Users/TONI/projects/social-commerce/tools/google-auth.png", fullPage: true });
      }
    }
  } else {
    console.log("Already logged in! URL:", page.url());
    await page.screenshot({ path: "C:/Users/TONI/projects/social-commerce/tools/admin-dashboard.png", fullPage: true });
    console.log("Screenshot saved: admin-dashboard.png");
    
    // List nav links
    const links = await page.$$("a");
    for (const l of links) {
      const href = await l.getAttribute("href");
      const text = await l.textContent();
      if (href && (text || "").toLowerCase().includes("seller") || (href || "").toLowerCase().includes("seller")) {
        console.log("Seller link:", text.trim().slice(0, 80), href);
      }
    }
  }
  
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
