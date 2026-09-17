// Open OAuth credentials page in ultron project, read state
import { getBrowser, newTab, shot } from './cdp-lib.mjs';
const browser = await getBrowser();
const page = await newTab(browser, 'https://console.cloud.google.com/apis/credentials?project=ultron-485605', 'domcontentloaded', 60000);
await page.waitForTimeout(9000);
const text = await page.locator('body').innerText({ timeout: 25000 }).catch(() => '');
await shot(page, 'C:/Users/TONI/projects/social-commerce/tools/gcloud/creds-1.png');
console.log('URL:', page.url());
console.log(text.slice(0, 1600));
await page.close().catch(() => {});
await browser.close();
