import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/TONI/.config/opencode/node_modules/playwright');

const CDP = 'http://127.0.0.1:9222';

async function main() {
  const browser = await chromium.connectOverCDP(CDP, { timeout: 15000 });
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes('susej-admin-panel')) || await ctx.newPage();
  
  if (!page.url().includes('susej-admin-panel')) {
    await page.goto('https://susej-admin-panel.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
  }
  
  // Wait for page to load
  await new Promise(r => setTimeout(r, 3000));
  
  const result = await page.evaluate(async () => {
    const r = { url: window.location.href, title: document.title };
    
    // Check for login form
    const emailInputs = Array.from(document.querySelectorAll('input[type="email"]'));
    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'));
    const submitButtons = Array.from(document.querySelectorAll('button[type="submit"], button:not(:disabled)'));
    
    r.emailInputExists = emailInputs.length > 0;
    r.passwordInputExists = passwordInputs.length > 0;
    r.submitButtonExists = submitButtons.length > 0;
    
    // Check for any login-related elements
    r.loginElements = Array.from(document.querySelectorAll('input, button, a'))
      .filter(el => {
        const text = (el.textContent || '').toLowerCase();
        const ph = (el.placeholder || '').toLowerCase();
        const id = (el.id || '').toLowerCase();
        return text.includes('login') || text.includes('sign in') || text.includes('email') || 
               ph.includes('email') || ph.includes('password') || text.includes('admin') ||
               id.includes('login') || id.includes('email') || id.includes('admin');
      })
      .slice(0, 10)
      .map(el => ({ tag: el.tagName, type: el.type, text: (el.textContent || '').trim().slice(0, 50), id: el.id, placeholder: el.placeholder }));
    
    // Check for seller management routes
    const navLinks = Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h);
    r.navLinks = navLinks.slice(0, 20);
    
    // Look for any table or list that might contain seller applications
    r.tables = Array.from(document.querySelectorAll('table')).length;
    r.listItems = Array.from(document.querySelectorAll('li')).length;
    
    return r;
  });
  
  console.log(JSON.stringify(result, null, 2));
  
  // Take screenshot
  await page.screenshot({ path: 'C:/Users/TONI/projects/social-commerce/tools/admin-panel.png', fullPage: true });
  
  await browser.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
