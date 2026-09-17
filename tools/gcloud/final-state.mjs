// Final state check: input values only (innerText misses input fields!)
import { getBrowser, newTab } from './cdp-lib.mjs';
const browser = await getBrowser();
const page = await newTab(browser, 'https://console.cloud.google.com/auth/clients/587974931581-rnobfpase03ro9lu4df7grh7ueniajef.apps.googleusercontent.com?project=ultron-485605&hl=en', 'domcontentloaded', 60000);
await page.waitForTimeout(9000);
const boxes = page.getByRole('textbox');
const n = await boxes.count();
for (let i = 0; i < n; i++) {
  const val = await boxes.nth(i).inputValue().catch(() => '?');
  console.log(`box${i}: ${JSON.stringify(val)}`);
}
await page.close().catch(() => {});
await browser.close();
