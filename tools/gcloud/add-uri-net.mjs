// Add URI + Save with network capture to learn what fires
import { getBrowser, newTab, shot } from './cdp-lib.mjs';
const browser = await getBrowser();
const page = await newTab(browser, 'https://console.cloud.google.com/auth/clients/587974931581-rnobfpase03ro9lu4df7grh7ueniajef.apps.googleusercontent.com?project=ultron-485605', 'domcontentloaded', 60000);
await page.waitForTimeout(9000);
await page.getByText('OK, got it').click({ timeout: 3000 }).catch(() => {});

const reqs = [];
page.on('request', r => {
  const m = r.method();
  if (m !== 'GET' || r.url().includes('client')) reqs.push(m + ' ' + r.url().slice(0, 130));
});
page.on('response', r => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.request().method())) reqs.push('RESP ' + r.status() + ' ' + r.url().slice(0, 130));
});

await page.getByRole('button', { name: 'Add URI' }).nth(1).click({ timeout: 15000 });
await page.waitForTimeout(2000);
const target = page.getByRole('textbox').last();
await target.click({ timeout: 10000 });
await target.fill('http://localhost:9988/auth/google', { timeout: 10000 });
await page.waitForTimeout(1200);
// press Tab/blur to let Angular commit
await target.press('Tab').catch(() => {});
await page.waitForTimeout(600);
await shot(page, 'C:/Users/TONI/projects/social-commerce/tools/gcloud/net-step1.png');

await page.getByRole('button', { name: 'Save' }).last().click({ timeout: 15000 });
await page.waitForTimeout(3000);
await shot(page, 'C:/Users/TONI/projects/social-commerce/tools/gcloud/net-step2.png');
const t1 = await page.locator('body').innerText({ timeout: 15000 }).catch(() => '');
console.log('--- text 3s after save ---');
console.log(t1.slice(0, 800));
await page.waitForTimeout(6000);
await shot(page, 'C:/Users/TONI/projects/social-commerce/tools/gcloud/net-step3.png');
const t2 = await page.locator('body').innerText({ timeout: 15000 }).catch(() => '');
console.log('--- text 9s after save (contains uri?) ---', t2.includes('localhost:9988'));
console.log('--- network ---');
console.log(reqs.slice(-25).join('\n'));
await page.close().catch(() => {});
await browser.close();
