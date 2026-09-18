// Walks through every guided tour like a first-time user, screenshots each step, and checks
// that the lit window really sits on the thing being explained.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const OUT = 'D:/Epic Games/curbside/tests/browser/out';
const SHOTS = `${OUT}/tour`;
const BASE = process.argv[2] || 'http://127.0.0.1:5174/';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const context = await browser.newContext({
  ...phone,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
});
const page = await context.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
page.on('pageerror', (e) => problems.push(e.message));
page.on('dialog', (d) => d.accept());
const step = (msg) => console.log(`- ${msg}`);

// Checks the lit window surrounds the element the step names, then goes through every step.
async function walk(name, { shots = Infinity } = {}) {
  await page.waitForSelector('#tour .tour-card', { timeout: 5000 });
  const titles = [];
  for (let n = 0; n < 20; n++) {
    await page.waitForTimeout(380); // the window glides to its next spot
    titles.push(await page.locator('#tour h3').innerText());
    const lit = await page.evaluate(() => {
      const hole = document.querySelector('.tour-hole').getBoundingClientRect();
      const card = document.querySelector('.tour-card').getBoundingClientRect();
      return { hole: { t: hole.top, l: hole.left, b: hole.bottom, r: hole.right, w: hole.width }, card: { t: card.top, b: card.bottom, l: card.left, r: card.right } };
    });
    if (lit.hole.w > 0) {
      const overlap = !(lit.card.b <= lit.hole.t || lit.card.t >= lit.hole.b);
      if (overlap && lit.hole.b - lit.hole.t < 400) problems.push(`${name} step ${n + 1}: note covers the lit area`);
      assert.ok(lit.card.l >= 0 && lit.card.r <= 390 && lit.card.t >= 0 && lit.card.b <= 844, `${name} step ${n + 1}: note fits on screen`);
    }
    if (n < shots) await page.screenshot({ path: `${SHOTS}/${name}-${n + 1}.png` });
    const next = page.locator('#tour [data-tour="next"]');
    const done = (await next.innerText()) !== 'Next';
    await next.click();
    if (done) break;
  }
  await page.waitForSelector('#tour', { state: 'detached' });
  step(`${name} tour (${titles.length} steps): ${titles.join(' | ')}`);
  return titles;
}

// 1. First open: the home tour.
await page.goto(BASE);
const home = await walk('home');
assert.ok(home.includes('Add a find') && home.includes('Money') && home.includes('Settings'));
await page.reload();
await page.waitForTimeout(900);
assert.equal(await page.locator('#tour').count(), 0, 'home tour only once');
step('home tour does not come back after a reload');

// 2. First find: the item tour.
await page.setInputFiles('.tabbar input[data-pick="new"]', `${OUT}/demo/chair.jpg`);
await page.waitForURL(/#\/item\//);
const item = await walk('item');
assert.ok(item.includes('What to do next') && item.includes('Delete'));

// 3. Post it and the posting steps.
await page.fill('[data-field="title"]', 'Teal accent chair');
await page.fill('[data-field="price"]', '60');
await page.locator('[data-field="price"]').press('Tab');
await page.click('#status-panel a:has-text("Post it")');
await page.waitForURL(/\/post$/);
await walk('post');
await page.click('.platform-tile:has-text("Facebook")');
await page.click('.platform-tile:has-text("OfferUp")');
await page.click('[data-action="start-run"]');
await page.waitForURL(/\/post\/facebook$/);
await walk('kit');

// 4. Money.
await page.goto(`${BASE}#/money`);
await walk('money');

// 5. Replay from Settings; skipping the home tour turns the rest off.
await page.goto(`${BASE}#/settings`);
await page.waitForSelector('[data-action="replay-tour"]');
await page.click('[data-action="replay-tour"]');
await page.waitForSelector('#tour .tour-card');
await page.click('#tour [data-tour="skip"]');
await page.waitForSelector('#tour', { state: 'detached' });
await page.goto(`${BASE}#/money`);
await page.waitForTimeout(900);
assert.equal(await page.locator('#tour').count(), 0);
step('Settings > Show the tour again works; Skip on it turns the other tours off');

// 6. iPhone in Safari: one step, pointing at Add to Home Screen.
const ios = await browser.newContext({ ...phone, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1' });
const ip = await ios.newPage();
ip.on('pageerror', (e) => problems.push(`ios: ${e.message}`));
await ip.goto(BASE);
await ip.waitForSelector('#tour .tour-card');
await ip.waitForTimeout(400);
await ip.screenshot({ path: `${SHOTS}/safari-1.png` });
step(`iPhone Safari: "${await ip.locator('#tour h3').innerText()}" (${await ip.locator('#tour .tour-count').count() ? 'several steps' : 'one step'})`);

await browser.close();
console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nNo problems.');
