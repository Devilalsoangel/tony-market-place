// Probe: open Google Cloud Console in CDP Chrome, report login state
import { getBrowser, newTab, shot } from './cdp-lib.mjs';
const browser = await getBrowser();
const page = await newTab(browser, 'https://console.cloud.google.com/', 'domcontentloaded', 60000);
await page.waitForTimeout(8000);
const url = page.url();
const text = (await page.locator('body').innerText({ timeout: 20000 }).catch(() => ''));
await shot(page, 'C:/Users/TONI/projects/social-commerce/tools/gcloud/probe-1.png');
console.log('URL:', url);
console.log('---TEXT-SNIPPET---');
console.log(text.slice(0, 1200));
await page.close().catch(() => {});
await browser.close();
