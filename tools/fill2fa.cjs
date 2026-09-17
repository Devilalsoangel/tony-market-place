const { chromium } = require("C:/Users/TONI/.config/opencode/node_modules/playwright");

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222").catch(e => { console.log(e.message); process.exit(1); });
  
  let page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes("susej-admin-panel"));
  if (!page) {
    page = await browser.contexts()[0].newPage();
    await page.goto("https://susej-admin-panel.vercel.app/login/2fa", { waitUntil: "networkidle" });
  }
  
  console.log("Current URL:", page.url());
  
  // Fill all 6 OTP boxes with 123456
  const boxes = await page.$$('input[maxlength="1"]');
  console.log("OTP boxes found:", boxes.length);
  
  if (boxes.length === 6) {
    const code = "123456";
    for (let i = 0; i < 6; i++) {
      console.log("Filling box " + i + " with " + code[i]);
      await boxes[i].click();
      await boxes[i].fill(code[i]);
    }
    console.log("All 6 boxes filled");
  } else {
    console.log("Expected 6 boxes but found", boxes.length);
    // Fallback: fill all single-char inputs
    const allSingleInputs = await page.$$('input:not([type="password"])');
    console.log("All inputs:", allSingleInputs.length);
  }
  
  await new Promise(r => setTimeout(r, 3000));
  
  // Check if verify button is now enabled
  const verifyBtn = await page.$('button:has-text("Verify")');
  if (verifyBtn) {
    const disabled = await verifyBtn.getAttribute("disabled");
    console.log("Verify button disabled:", disabled);
    if (!disabled) {
      await verifyBtn.click();
      console.log("Clicked Verify");
    }
  }
  
  await new Promise(r => setTimeout(r, 8000));
  
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
    bodyText: document.body ? document.body.innerText.slice(0, 3500) : ""
  }));
  
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });