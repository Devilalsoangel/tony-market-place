// Click "Create credentials", dump resulting menu state
import { getBrowser, newTab, shot } from './cdp-lib.mjs';
const browser = await getBrowser();
const page = await newTab(browser, 'https://console.cloud.google.com/apis/credentials?project=ultron-485605', 'domcontentloaded', 60000);
await page.waitForTimeout(9000);
// accept cookies if present
await page.getByText('OK, got it').click({ timeout: 4000 }).catch(() => {});
// click the Create credentials button
const btn = page.getByRole('button', { name: /create credentials/i }).first();
await btn.click({ timeout: 15000 });
await page.waitForTimeout(3500);
const text = await page.locator('body').innerText({ timeout: 20000 }).catch(() => '');
await shot(page, 'C:/Users/TONI/projects/social-commerce/tools/gcloud/creds-2.png');
console.log('URL:', page.url());
console.log('--- after Create credentials click ---');
console.log(text.slice(0, 2000));
await page.close().catch(() => {});
await browser.close();
