// Dump redirect URI section of Web client 1
import { getBrowser, newTab } from './cdp-lib.mjs';
const browser = await getBrowser();
const page = await newTab(browser, 'https://console.cloud.google.com/auth/clients/587974931581-rnobfpase03ro9lu4df7grh7ueniajef.apps.googleusercontent.com?project=ultron-485605', 'domcontentloaded', 60000);
await page.waitForTimeout(9000);
await page.getByText('OK, got it').click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(2000);
const text = await page.locator('body').innerText({ timeout: 15000 }).catch(() => '');
const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
const idx = lines.findIndex(l => /redirect/i.test(l));
console.log('--- redirect-related lines ---');
if (idx >= 0) console.log(lines.slice(idx, idx + 25).join('\n'));
else console.log('(no redirect lines found). Full tail:\n' + lines.slice(0, 80).join('\n'));
const all = lines.join('\n');
console.log('--- exp/localhost mentions ---');
console.log(all.match(/https?:\/\/[^\s]*8081[^\s]*/g)?.join('\n') || '(no 8081 uris)');
await page.close().catch(() => {});
await browser.close();
