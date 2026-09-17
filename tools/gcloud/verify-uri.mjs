// Verify saved redirect URI
import { getBrowser, newTab } from './cdp-lib.mjs';
const browser = await getBrowser();
const page = await newTab(browser, 'https://console.cloud.google.com/auth/clients/587974931581-rnobfpase03ro9lu4df7grh7ueniajef.apps.googleusercontent.com?project=ultron-485605', 'domcontentloaded', 60000);
await page.waitForTimeout(9000);
const text = await page.locator('body').innerText({ timeout: 15000 }).catch(() => '');
console.log('localhost:9988 present:', text.includes('localhost:9988'));
const m = text.match(/Authorised redirect URIs[\s\S]{0,200}/);
console.log(m ? m[0] : '(section not found)');
await page.close().catch(() => {});
await browser.close();
