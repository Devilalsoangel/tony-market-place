// v3: enumerate textboxes, real typing, Save state inspection
import { getBrowser, newTab, shot } from './cdp-lib.mjs';
const browser = await getBrowser();
const page = await newTab(browser, 'https://console.cloud.google.com/auth/clients/587974931581-rnobfpase03ro9lu4df7grh7ueniajef.apps.googleusercontent.com?project=ultron-485605&hl=en', 'domcontentloaded', 60000);
await page.waitForTimeout(9000);
await page.getByText('OK, got it').click({ timeout: 3000 }).catch(() => {});

async function dumpBoxes(tag) {
  const boxes = page.getByRole('textbox');
  const n = await boxes.count();
  for (let i = 0; i < n; i++) {
    const b = boxes.nth(i);
    const label = await b.getAttribute('aria-label').catch(() => null);
    const val = await b.inputValue().catch(() => '?');
    console.log(`[${tag}] box${i} label=${JSON.stringify(label)} value=${JSON.stringify(val)}`);
  }
  return n;
}
const before = await dumpBoxes('before');

await page.getByRole('button', { name: 'Add URI' }).nth(1).click({ timeout: 15000 });
await page.waitForTimeout(2500);
const after = await dumpBoxes('afterAdd');
// the new empty box is index after-1
const target = page.getByRole('textbox').nth(after - 1);
await target.click({ timeout: 10000 });
// real keystrokes
await target.pressSequentially('http://localhost:9988/auth/google', { delay: 25, timeout: 20000 });
await page.waitForTimeout(1500);
await dumpBoxes('afterType');

const saves = page.getByRole('button', { name: 'Save' });
const sc = await saves.count();
for (let i = 0; i < sc; i++) {
  const dis = await saves.nth(i).getAttribute('aria-disabled').catch(() => null);
  console.log(`save[${i}] aria-disabled=${dis}`);
}
const lastDis = await saves.nth(sc - 1).getAttribute('aria-disabled').catch(() => null);
if (lastDis !== 'true') {
  await saves.nth(sc - 1).click({ timeout: 10000 });
  console.log('clicked Save');
} else {
  await target.press('Enter').catch(() => {});
  console.log('Save disabled -> pressed Enter in field');
}
await page.waitForTimeout(8000);
await shot(page, 'C:/Users/TONI/projects/social-commerce/tools/gcloud/v3-after.png');
const text = await page.locator('body').innerText({ timeout: 15000 }).catch(() => '');
console.log('URI present in page:', text.includes('localhost:9988'));
console.log('page url now:', page.url());
console.log(text.slice(0, 400));
await page.close().catch(() => {});
await browser.close();
