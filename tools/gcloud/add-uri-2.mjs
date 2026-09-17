// Add redirect URI via role-based selectors (v2)
import { getBrowser, newTab, shot } from './cdp-lib.mjs';
const browser = await getBrowser();
const page = await newTab(browser, 'https://console.cloud.google.com/auth/clients/587974931581-rnobfpase03ro9lu4df7grh7ueniajef.apps.googleusercontent.com?project=ultron-485605', 'domcontentloaded', 60000);
await page.waitForTimeout(9000);
await page.getByText('OK, got it').click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(2000);

const addButtons = page.getByRole('button', { name: 'Add URI' });
console.log('Add URI buttons found:', await addButtons.count());

// second Add URI = redirect URIs section (first belongs to JavaScript origins)
await addButtons.nth(1).click({ timeout: 15000 });
await page.waitForTimeout(2500);
await shot(page, 'C:/Users/TONI/projects/social-commerce/tools/gcloud/adduri2-step1.png');

const boxes = page.getByRole('textbox');
console.log('textboxes on page:', await boxes.count());
const target = boxes.last();
await target.click({ timeout: 10000 });
await target.fill('http://localhost:9988/auth/google', { timeout: 10000 });
await page.waitForTimeout(1000);
await shot(page, 'C:/Users/TONI/projects/social-commerce/tools/gcloud/adduri2-step2.png');

const saves = page.getByRole('button', { name: 'Save' });
console.log('Save buttons found:', await saves.count());
await saves.last().click({ timeout: 15000 });
await page.waitForTimeout(7000);
const text = await page.locator('body').innerText({ timeout: 15000 }).catch(() => '');
await shot(page, 'C:/Users/TONI/projects/social-commerce/tools/gcloud/adduri2-step3.png');
console.log('URI visible after save:', text.includes('localhost:9988'));
console.log('snippet:', text.slice(0, 500));
await page.close().catch(() => {});
await browser.close();
