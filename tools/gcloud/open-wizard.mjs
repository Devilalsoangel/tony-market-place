// Direct OAuth client creation wizard + consent screen check
import { getBrowser, newTab, shot } from './cdp-lib.mjs';
const browser = await getBrowser();
const page = await newTab(browser, 'https://console.cloud.google.com/apis/credentials/oauthclient?project=ultron-485605', 'domcontentloaded', 60000);
await page.waitForTimeout(7000);
await page.getByText('OK, got it').click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(2000);
const text = await page.locator('body').innerText({ timeout: 15000 }).catch(() => '');
await shot(page, 'C:/Users/TONI/projects/social-commerce/tools/gcloud/wizard-1.png');
console.log('URL:', page.url());
console.log(text.slice(0, 2500));
await page.close().catch(() => {});
await browser.close();
