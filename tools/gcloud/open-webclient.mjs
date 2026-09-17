// Open "Web client 1" detail -> full client ID + redirect URIs
import { getBrowser, newTab, shot } from './cdp-lib.mjs';
const browser = await getBrowser();
const page = await newTab(browser, 'https://console.cloud.google.com/auth/clients?project=ultron-485605', 'domcontentloaded', 60000);
await page.waitForTimeout(8000);
await page.getByText('OK, got it').click({ timeout: 3000 }).catch(() => {});
const row = page.getByText('Web client 1', { exact: true }).first();
await row.click({ timeout: 15000 });
await page.waitForTimeout(6000);
const text = await page.locator('body').innerText({ timeout: 15000 }).catch(() => '');
await shot(page, 'C:/Users/TONI/projects/social-commerce/tools/gcloud/webclient-1.png');
console.log('URL:', page.url());
console.log(text.slice(0, 3000));
await page.close().catch(() => {});
await browser.close();
