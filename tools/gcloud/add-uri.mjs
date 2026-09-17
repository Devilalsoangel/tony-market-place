// Add redirect URI http://localhost:9988/auth/google to Web client 1, Save, verify
import { getBrowser, newTab, shot } from './cdp-lib.mjs';
const browser = await getBrowser();
const page = await newTab(browser, 'https://console.cloud.google.com/auth/clients/587974931581-rnobfpase03ro9lu4df7grh7ueniajef.apps.googleusercontent.com?project=ultron-485605', 'domcontentloaded', 60000);
await page.waitForTimeout(9000);
await page.getByText('OK, got it').click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(2000);

// 1) click Add URI
const addBtn = page.getByRole('button', { name: /add uri/i }).first();
await addBtn.click({ timeout: 15000 });
await page.waitForTimeout(2000);
await shot(page, 'C:/Users/TONI/projects/social-commerce/tools/gcloud/adduri-1.png');

// 2) find the newly visible text input and fill it
const input = page.locator('input[type="text"], input[type="url"]').last();
await input.fill('http://localhost:9988/auth/google', { timeout: 10000 });
await page.waitForTimeout(800);

// 3) Save (section-level save button)
const saveBtn = page.getByRole('button', { name: /^save$/i }).first();
await saveBtn.click({ timeout: 15000 });
await page.waitForTimeout(6000);
const text = await page.locator('body').innerText({ timeout: 15000 }).catch(() => '');
await shot(page, 'C:/Users/TONI/projects/social-commerce/tools/gcloud/adduri-2.png');
const ok = text.includes('localhost:9988');
console.log('URI visible after save:', ok);
console.log(text.slice(0, 600));
await page.close().catch(() => {});
await browser.close();
