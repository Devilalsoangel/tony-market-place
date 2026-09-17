const { chromium } = require("C:/Users/TONI/.config/opencode/node_modules/playwright");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222").catch(e => { console.log(e.message); process.exit(1); });
  
  let page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes("susej-admin-panel"));
  if (!page) {
    page = await browser.contexts()[0].newPage();
    await page.goto("https://susej-admin-panel.vercel.app", { waitUntil: "networkidle" });
  }
  
  // Step 1: Login
  if (page.url().includes("/login")) {
    console.log("[1] Logging in...");
    const loginId = await page.$("#loginId");
    const password = await page.$("#password");
    if (loginId && password) {
      await loginId.fill("alexrivera");
      await password.fill("Admin@123");
      const submit = await page.$('button[type="submit"]:has-text("Sign In")');
      if (submit) {
        await submit.click();
        await sleep(6000);
      }
    }
  }
  
  // If just logged in -> 2FA
  if (page.url().includes("/2fa")) {
    console.log("[2] At 2FA - filling code...");
    await sleep(2000);
    
    // Fill 6 OTP boxes
    const boxes = await page.$$('input[maxlength="1"]');
    console.log("    OTP boxes:", boxes.length);
    if (boxes.length >= 6) {
      const code = "123456";
      for (let i = 0; i < Math.min(6, boxes.length); i++) {
        await boxes[i].click();
        await boxes[i].fill(code[i]);
      }
      console.log("    Code filled");
    }
    
    await sleep(3000);
    
    // Click Verify
    const verifyBtn = await page.$('button:has-text("Verify"), button[type="submit"]');
    if (verifyBtn) {
      await verifyBtn.click();
      console.log("    Clicked Verify");
      await sleep(8000);
    }
    
    // If auth expired, retry login first
    if (page.url().includes("/2fa") && (await page.content()).includes("expired")) {
      console.log("[3] Auth expired - retrying...");
      await page.goto("https://susej-admin-panel.vercel.app/login", { waitUntil: "networkidle" });
      await sleep(2000);
      const loginId = await page.$("#loginId");
      const password = await page.$("#password");
      if (loginId && password) {
        await loginId.fill("alexrivera");
        await password.fill("Admin@123");
        const submit = await page.$('button[type="submit"]:has-text("Sign In")');
        if (submit) {
          await submit.click();
          await sleep(6000);
        }
      }
      
      if (page.url().includes("/2fa")) {
        await sleep(2000);
        const boxes2 = await page.$$('input[maxlength="1"]');
        if (boxes2.length >= 6) {
          const code = "123456";
          for (let i = 0; i < 6; i++) {
            await boxes2[i].click();
            await boxes2[i].fill(code[i]);
          }
          await sleep(3000);
          const verifyBtn2 = await page.$('button:has-text("Verify"), button[type="submit"]');
          if (verifyBtn2) {
            await verifyBtn2.click();
            await sleep(8000);
          }
        }
      }
    }
  }
  
  console.log("Final URL:", page.url());
  await page.screenshot({ path: "C:/Users/TONI/projects/social-commerce/tools/admin-dash-final.png", fullPage: true });
  console.log("Screenshot saved");
  
  // Dump dashboard state
  const info = await page.evaluate(() => ({
    url: window.location.href,
    navLinks: Array.from(document.querySelectorAll("a")).map(a => ({ text: a.textContent.trim().slice(0, 60), href: a.href })).filter(l => l.href.includes("susej-admin-panel") || l.href.startsWith("/")).slice(0, 40),
    headings: Array.from(document.querySelectorAll("h1, h2, h3")).map(h => h.textContent.trim().slice(0, 60)).filter(t => t).slice(0, 20),
    bodyText: document.body ? document.body.innerText.slice(0, 4000) : ""
  }));
  
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });