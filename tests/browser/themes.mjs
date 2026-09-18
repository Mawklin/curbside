// Switches through every theme from Settings, screenshots the item list in each, and checks the
// choice sticks (including straight after a reload, before the saved settings have loaded).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const OUT = 'D:/Epic Games/curbside/tests/browser/out';
const SHOTS = `${OUT}/themes`;
const BASE = process.argv[2] || 'http://127.0.0.1:5174/?notour';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
});
const page = await context.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
page.on('pageerror', (e) => problems.push(e.message));
page.on('dialog', (d) => d.accept());

// Some finds to look at.
await page.goto(`${BASE}#/settings`);
await page.setInputFiles('[data-pick="restore"]', `${OUT}/demo/demo-backup.zip`);
await page.waitForFunction(() => /Restored/.test(document.querySelector('#toast')?.textContent || ''), null, { timeout: 30000 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.locator('#theme-card').screenshot({ path: `${SHOTS}/settings-card.png` });

const ids = await page.$$eval('.theme-tile', (els) => els.map((e) => e.dataset.themeId));
console.log(`- ${ids.length} tiles: ${ids.join(', ')}`);
assert.equal(ids[0], 'auto');

for (const id of ids.slice(1)) {
  await page.goto(`${BASE}#/settings`);
  await page.click(`.theme-tile[data-theme-id="${id}"]`);
  await page.waitForFunction((t) => document.documentElement.dataset.theme === t, id);
  const meta = await page.$eval('meta[name="theme-color"]', (m) => m.content);
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  assert.equal(meta, bg, `${id}: status bar colour follows the theme`);
  await page.goto(BASE);
  await page.waitForSelector('#grid .item-card');
  await page.waitForTimeout(250);
  const decor = await page.locator('#decor span').count();
  assert.equal(decor, id === 'curbside' ? 0 : 7, `${id}: background pictures`);
  await page.screenshot({ path: `${SHOTS}/${id}.png` });
}
console.log('- every theme applies, colours the status bar, and gets its pictures');

// Straight after a reload the last theme is already on (no flash of purple).
await page.goto(`${BASE}#/settings`);
await page.click('.theme-tile[data-theme-id="halloween"]');
await page.waitForFunction(() => document.documentElement.dataset.theme === 'halloween');
await page.reload({ waitUntil: 'domcontentloaded' });
assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'halloween');
await page.waitForSelector('#theme-card');
assert.equal(await page.locator('.theme-tile.on').getAttribute('data-theme-id'), 'halloween');
console.log('- chosen theme survives a reload and is on before settings load');

// Automatic follows the date (September 18 has no holiday, so it shows the original).
await page.click('.theme-tile[data-theme-id="auto"]');
await page.waitForSelector('.theme-tile.on[data-theme-id="auto"]');
console.log(`- Automatic today: ${await page.locator('.theme-tile[data-theme-id="auto"] .theme-when').innerText()} -> ${await page.evaluate(() => document.documentElement.dataset.theme)}`);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOTS}/settings.png` });

await browser.close();
console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nNo problems.');
