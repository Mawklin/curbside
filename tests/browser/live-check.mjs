// Checks the published site: loads without errors, installs its offline cache, and shows the
// inventory/sold views with the demo backup restored (in a throwaway browser profile).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL_ = process.argv[2] || 'https://mawklin.github.io/curbside/';
const OUT = 'D:/Epic Games/curbside/tests/browser/out';
mkdirSync(`${OUT}/live`, { recursive: true });

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
});
const page = await context.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
page.on('pageerror', (e) => problems.push(e.message));
page.on('requestfailed', (r) => problems.push(`failed: ${r.url()}`));
page.on('dialog', (d) => d.accept());
const shot = (n) => page.screenshot({ path: `${OUT}/live/${n}.png` });

await page.goto(URL_);
await page.waitForSelector('.welcome');
const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return reg.active?.scriptURL;
});
console.log('service worker:', sw);
const manifest = await page.evaluate(async () => (await fetch('manifest.webmanifest')).ok);
console.log('manifest ok:', manifest);

await page.goto(`${URL_}#/settings`);
await page.setInputFiles('[data-pick="restore"]', `${OUT}/demo/demo-backup.zip`);
await page.waitForFunction(() => /Restored/.test(document.querySelector('#toast')?.textContent || ''), null, { timeout: 30000 });

await page.goto(URL_);
await page.waitForSelector('#grid');
await page.click('.chip[data-filter="sold"]');
await page.waitForTimeout(300);
await shot('sold-list');
console.log('sold list:', (await page.locator('.item-card .item-title').allInnerTexts()).join(' | '));

// Check one off: open a listed item and mark it sold.
await page.click('.chip[data-filter="listed"]');
await page.click('.grid .item-card');
await page.waitForSelector('#status-panel');
await page.click('#status-panel [data-sheet="sold"]');
await page.waitForSelector('[data-action="save-sold"]');
await page.waitForTimeout(500); // sheet slides in
await shot('check-off-sheet');
await page.click('[data-action="save-sold"]');
await page.waitForSelector('.panel-sold');
await page.evaluate(() => window.scrollTo(0, document.querySelector('#status-panel').offsetTop - 70));
await page.waitForTimeout(2800); // let the toast fade
await shot('checked-off');

await page.goto(`${URL_}#/money`);
await page.waitForSelector('.hero-value');
await page.click('[data-period="all"]');
await page.evaluate(() => document.querySelector('.sales').scrollIntoView({ block: 'center' }));
await page.waitForTimeout(300);
await shot('sales-history');

await context.setOffline(true);
await page.reload();
await page.waitForSelector('.hero-value', { timeout: 10000 });
console.log('offline reload: ok');

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'no errors');
