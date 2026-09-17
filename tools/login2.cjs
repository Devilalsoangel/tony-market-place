const { chromium } = require("C:/Users/TONI/.config/opencode/node_modules/playwright");

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222").catch(e => { console.log(e.message); process.exit(1); });
  
  let page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes("susej-admin-panel"));
  if (!page) {
    page = await browser.contexts()[0].newPage();
    await page.goto("https://susej-admin-panel.vercel.app/login/2fa", { waitUntil: "networkidle" });
  }
  
  console.log("Current URL:", page.url());
  
  const allInputs = await page.$$("input");
  console.log("Inputs found:", allInputs.length);
  for (const inp of allInputs) {
    const type = await inp.getAttribute("type");
    const name = await inp.getAttribute("name");
    const id = await inp.getAttribute("id");
    const placeholder = await inp.getAttribute("placeholder");
    const maxlength = await inp.getAttribute("maxlength");
    console.log("  input type=" + type + " name=" + name + " id=" + id + " placeholder=" + placeholder + " maxlength=" + maxlength);
  }
  
  // Try single input - tel or text
  let filled = false;
  const singleInput = await page.$('input[type="tel"], input[inputmode="numeric"], input[name*="otp"], input[name*="code"], input[name*="token"], input:not([type="password"]):not([type="hidden"])');
  if (singleInput) {
    console.log("Found input, filling...");
    await singleInput.click();
    await singleInput.fill("123456");
    filled = true;
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  const verifyBtn = await page.$('button:has-text("Verify"), button[type="submit"], button:has-text("Continue"), button:not(:disabled)');
  if (verifyBtn) {
    console.log("Clicking Verify...");
    await verifyBtn.click();
    await new Promise(r => setTimeout(r, 8000));
  }
  
  console.log("After 2FA URL:", page.url());
  await page.screenshot({ path: "C:/Users/TONI/projects/social-commerce/tools/admin-after-2fa.png", fullPage: true });
  console.log("Screenshot: admin-after-2fa.png");
  
  const info = await page.evaluate(() => ({
    url: window.location.href,
    navLinks: Array.from(document.querySelectorAll("a")).map(a => ({ text: a.textContent.trim().slice(0, 50), href: a.href })).filter(l => l.href.includes("susej-admin-panel") || l.href.startsWith("/")).slice(0, 30),
    sellerLinks: Array.from(document.querySelectorAll("a")).filter(a => {
      const t = (a.textContent || "").toLowerCase();
      const h = a.href.toLowerCase();
      return t.includes("seller") || t.includes("verif") || t.includes("applic") || h.includes("seller") || h.includes("verif") || h.includes("applic");
    }).map(a => ({ text: a.textContent.trim().slice(0, 80), href: a.href })).slice(0, 20),
    bodyText: document.body ? document.body.innerText.slice(0, 3000) : ""
  }));
  
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });