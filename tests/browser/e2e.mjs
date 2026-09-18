// Walks through Curbside like she would, in headless Chrome at phone size, and screenshots each step.
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { readZip } from 'file:///D:/Epic%20Games/curbside/docs/zip.js';

const SCRATCH = 'D:/Epic Games/curbside/tests/browser/out';
const SHOTS = `${SCRATCH}/shots`;
const DEMO = `${SCRATCH}/demo`;
const BASE = 'http://127.0.0.1:5174/?notour';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  permissions: ['clipboard-read', 'clipboard-write'],
  acceptDownloads: true,
});
const page = await context.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('dialog', (d) => d.accept());

const shot = (name, full = false) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full });
const text = (sel) => page.locator(sel).first().innerText();
const step = (msg) => console.log(`- ${msg}`);
const settle = () => page.waitForTimeout(250);
const toastText = async () => (await page.locator('#toast').innerText()).trim();

// Settings sections start folded: open one (if it isn't already) before using what's inside.
const openSection = async (id) => {
  const d = page.locator(`details[data-section="${id}"]`);
  if (!(await d.evaluate((el) => el.open))) await d.locator('summary').click();
};

// 1. Empty app
await page.goto(BASE);
await page.waitForSelector('.welcome');
await shot('01-empty');
step('empty state shows');

// 2. First find, straight from the camera button
await page.setInputFiles('.welcome input[data-pick="new"]', `${DEMO}/chair.jpg`);
await page.waitForURL(/#\/item\/[^/]+$/);
await page.waitForSelector('#hero img');
const itemUrl = page.url();
assert.match(await text('#status-panel'), /Add a title and a price/);
step('new item created from a photo');

await page.fill('[data-field="title"]', 'Teal accent chair');
await page.locator('[data-field="title"]').press('Tab');
await page.fill('[data-field="price"]', '60');
await page.locator('[data-field="price"]').press('Tab');
await page.selectOption('[data-field="category"]', 'Furniture');
await page.selectOption('[data-field="condition"]', 'good');
await page.fill('[data-field="description"]', 'Teal upholstered accent chair with wooden legs. Sturdy, no rips or stains.');
await page.fill('[data-field="foundWhere"]', 'Curb on Elm St');
await page.fill('[data-field="cost"]', '4');
assert.match(await text('#status-panel'), /Ready to post/);
await page.waitForTimeout(700); // autosave
await page.reload();
await page.waitForSelector('[data-field="title"]');
assert.equal(await page.inputValue('[data-field="title"]'), 'Teal accent chair');
assert.equal(await page.inputValue('[data-field="price"]'), '60');
assert.equal(await page.inputValue('[data-field="category"]'), 'Furniture');
assert.equal(await page.inputValue('[data-field="foundWhere"]'), 'Curb on Elm St');
step('details autosave and survive a reload');

// 3. Photos: add a second, rotate it, make it the cover, then delete it
await page.setInputFiles('.thumb-add input', `${DEMO}/mirror.jpg`);
await page.waitForFunction(() => document.querySelectorAll('.thumbs .thumb:not(.thumb-add)').length === 2);
await page.locator('.thumbs .thumb').nth(1).click();
await page.waitForSelector('.sheet [data-action="photo-rotate"]');
await shot('03-photo-sheet');
await page.click('[data-action="photo-rotate"]');
await page.waitForFunction(() => !document.querySelector('#busy.on'));
await page.click('[data-action="photo-cover"]');
await settle();
const coverAfter = await page.locator('.thumbs .thumb').first().locator('img').getAttribute('src');
assert.ok(coverAfter);
await page.locator('.thumbs .thumb').first().click();
await page.click('[data-action="photo-delete"]');
await page.waitForFunction(() => document.querySelectorAll('.thumbs .thumb:not(.thumb-add)').length === 1);
step('second photo added, rotated, made cover, deleted');
await page.evaluate(() => window.scrollTo(0, 0));
await shot('02-item-filled');
await shot('02b-item-full', true);

// 3b. Photo checklist and size
assert.equal(await text('#shot-count'), '0 of 6', 'Furniture adds two extra shots to the basic four');
await page.check('[data-shot="front"]');
await page.check('[data-shot="sides"]');
assert.equal(await text('#shot-count'), '2 of 6');
await page.fill('[data-field="size"]', '24" wide, 32" tall');
await page.waitForTimeout(700);
await page.reload();
await page.waitForSelector('[data-field="size"]');
assert.equal(await page.inputValue('[data-field="size"]'), '24" wide, 32" tall');
assert.equal(await page.isChecked('[data-shot="front"]'), true);
await page.selectOption('[data-field="category"]', 'Clothing & Shoes');
assert.ok(await page.locator('[data-shot="tag"]').count(), 'checklist follows the category');
await page.selectOption('[data-field="category"]', 'Furniture');
step('photo checklist ticks and size survive a reload; list follows the category');

// 4. Post to two sites in one go
await page.click('#status-panel a:has-text("Post it")');
await page.waitForURL(/\/post$/);
await page.waitForSelector('.platform-grid');
assert.equal(await page.locator('.platform-tile.picked').count(), 0, 'nothing ticked the first time');
await page.click('.platform-tile:has-text("Facebook")');
await page.click('.platform-tile:has-text("OfferUp")');
assert.match(await text('[data-action="start-run"]'), /Post on 2 sites/);
await shot('04-post-pick');
await page.click('[data-action="start-run"]');
await page.waitForURL(/\/post\/facebook$/);
await page.waitForFunction(() => !document.querySelector('#save-photos')?.disabled);
assert.match(await text('.run-bar'), /Site 1 of 2/i);
await shot('05-kit-facebook', true);
await page.click('[data-copy="title"]');
assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'Teal accent chair');
await page.click('[data-copy="description"]');
const desc = await page.evaluate(() => navigator.clipboard.readText());
assert.match(desc, /no rips or stains\.\r?\n\r?\nSize: 24" wide, 32" tall\r?\nCondition: Good/);
await page.click('[data-copy="price"]');
assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '60');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('#save-photos')]);
assert.equal(download.suggestedFilename(), 'teal-accent-chair-1.jpg');
await page.waitForTimeout(500);
step('site 1 of 2: copies title/price/description (with size), saves photos');
await page.fill('[data-kit="url"]', 'https://www.facebook.com/marketplace/item/123');
assert.match(await text('[data-action="mark-listed"]'), /next: OfferUp/);
await page.click('[data-action="mark-listed"]');
await page.waitForURL(/\/post\/offerup$/);
await page.waitForSelector('.run-bar');
assert.match(await text('.run-bar'), /Site 2 of 2/i);
assert.match(await text('.step-done'), /Photos already saved/);
assert.match(await toastText(), /Posted on Facebook\. Next: OfferUp/);
await page.waitForTimeout(300);
await shot('05b-kit-offerup');
step('moved straight on to OfferUp; photos step already done');
await page.click('[data-action="mark-listed"]');
await page.waitForURL(itemUrl);
await page.waitForSelector('.panel-listed');
assert.match(await toastText(), /Posted on 2 sites/);
assert.match(await text('#status-panel'), /Facebook and OfferUp/);
step('finished the run: listed on Facebook and OfferUp');

// Next time, the same two sites are ticked, minus the ones it's already on.
await page.click('#status-panel a:has-text("Post it somewhere else")');
await page.waitForSelector('.platform-grid');
assert.equal(await page.locator('.platform-tile.picked').count(), 0, 'both already posted, so none pre-ticked');
await page.click('[data-action="back"]');
await page.waitForSelector('#status-panel');

// Buyer replies
await page.waitForSelector('.replies[open]');
await page.click('.reply[data-reply="available"]');
assert.match(await page.evaluate(() => navigator.clipboard.readText()), /still available/);
await page.click('.reply[data-reply="details"]');
assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'It measures 24" wide, 32" tall, and it\'s in good condition.');
await page.locator('.replies').scrollIntoViewIfNeeded();
await shot('05c-replies');
step('buyer replies copy with the item filled in');

// Back button history: back from the item goes to the list, not the kit
await page.click('[data-action="back"]');
await page.waitForSelector('#grid');
assert.equal(new URL(page.url()).hash, '#/');
await page.goBack();
await page.waitForTimeout(300);
step(`browser back after that lands on: ${new URL(page.url()).hash || '(start)'}`);
await page.goto(itemUrl);
await page.waitForSelector('#status-panel');

// 5. Pending, then sold, then take it down elsewhere
await page.click('#status-panel [data-sheet="pending"]');
await page.fill('[data-sf="buyer"]', 'Alex');
await page.fill('[data-sf="when"]', '2026-09-20T14:00');
await page.fill('[data-sf="price"]', '55');
await page.fill('[data-sf="note"]', 'Bringing a truck');
await shot('06-pending-sheet');
await page.click('[data-action="save-pending"]');
await page.waitForSelector('.panel-pending');
assert.match(await text('#status-panel'), /Pending with Alex/);
assert.match(await text('#status-panel'), /\$55 agreed/);
step('pending sale saved');

// Pickup reminder: the "Marked as pending" message offers the calendar.
await page.click('#toast [data-action="toast-action"]');
await page.waitForSelector('.cal-preview');
await page.waitForTimeout(400);
await shot('06b-calendar-sheet');
const [popup] = await Promise.all([page.waitForEvent('popup'), page.click('[data-action="cal-google"]')]);
const firstUrl = popup.url();
await popup.close();
step(`Google Calendar link opened: ${firstUrl.slice(0, 110)}`);
const [icsDl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="cal-ics"]')]);
const icsPath = `${SCRATCH}/pickup.ics`;
await icsDl.saveAs(icsPath);
const icsText = readFileSync(icsPath, 'utf8');
assert.match(icsText, /SUMMARY:Pickup: Teal accent chair \(Alex\)/);
assert.match(icsText, /TRIGGER:-PT30M/);
await page.click('.sheet [data-action="close-sheet"]');
step('pickup: "Add to calendar" offered, Google link opens, .ics downloads with a reminder');


await page.click('#status-panel [data-sheet="sold"]');
assert.equal(await page.inputValue('[data-sf="price"]'), '55');
assert.equal(await page.inputValue('[data-sf="buyer"]'), 'Alex');
await page.selectOption('[data-sf="platform"]', 'facebook');
await shot('07-sold-sheet');
await page.click('[data-action="save-sold"]');
await page.waitForSelector('.panel-sold');
assert.match(await toastText(), /You made \$51/);
assert.match(await text('.takedown'), /OfferUp/);
assert.doesNotMatch(await text('.takedown'), /Facebook/);
await shot('08-sold-takedown');
await page.click('.takedown [data-action="takedown"]');
await page.waitForFunction(() => !document.querySelector('.takedown'));
step('sold: profit right, reminder to take it down from OfferUp, cleared');

// 6. AI without a key: paste a ChatGPT answer
await page.goto(BASE);
await page.waitForSelector('#grid');
await page.setInputFiles('.tabbar input[data-pick="new"]', `${DEMO}/bike.jpg`);
await page.waitForURL(/#\/item\/[^/]+$/);
await page.click('[data-action="ai"]');
await page.waitForSelector('.sheet .option');
await page.waitForFunction(() => document.querySelector('.sheet [data-action="ai-save-photos"], .sheet [data-action="ai-share"]')?.disabled === false);
await shot('09-ai-choose');
if (await page.locator('[data-action="ai-copy-prompt"]').count()) {
  await page.click('[data-action="ai-copy-prompt"]');
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /TITLE: \.\.\./);
  step('no share sheet: "Copy the question" route shown');
} else {
  // Her bug: Send to an AI app, go to Claude, come back -> frozen. Recreate it the way an
  // iPhone behaves: the clipboard refuses while the share sheet opens, the page is hidden while
  // she's in the other app, then comes back.
  await page.evaluate(() => {
    window.__shared = null;
    Object.defineProperty(navigator, 'share', { configurable: true, value: (data) => new Promise((ok) => { window.__shared = data; setTimeout(ok, 300); }) });
    Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: () => Promise.reject(new DOMException('Document is not focused.', 'NotAllowedError')) });
  });
  await page.click('[data-action="ai-share"]');
  const sent = await page.evaluate(() => ({ files: window.__shared?.files?.length, text: (window.__shared?.text || '').slice(0, 40) }));
  assert.ok(sent.files >= 1 && /help someone/.test(sent.text), 'photos and question go in the share itself');
  assert.equal(await page.evaluate(() => document.querySelectorAll('textarea.offscreen').length + (document.activeElement?.tagName === 'TEXTAREA' ? 1 : 0)), 0, 'no hidden box grabbed focus');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForSelector('.sheet [data-action="ai-paste"].btn-big');
  assert.match(await page.locator('.sheet h2').innerText(), /Now get the answer/);
  await page.waitForTimeout(300);
  await shot('09b-ai-waiting');
  await page.click('.sheet [data-action="ai-copy-prompt"]');
  assert.match(await toastText(), /Couldn't copy/, 'a refused copy says so instead of fighting the page');
  await page.evaluate(() => { delete navigator.clipboard.writeText; delete navigator.share; });
  step('Send to an AI app: no clipboard fight, back from the AI app lands on "Now get the answer"');
}
await page.evaluate((t) => navigator.clipboard.writeText(t), `**TITLE:** Red beach cruiser bike, 26"\n**PRICE:** $85\n**PRICE RANGE:** $60 - $120\n**CATEGORY:** Bikes\n**CONDITION:** Used - Good\n**DESCRIPTION:**\nClassic red beach cruiser with 26" wheels and a comfy saddle. Rides smoothly; some surface rust on the chain.`);
await page.click('[data-action="ai-paste"]');
await page.waitForSelector('.ai-field');
await shot('10-ai-result');
await page.click('[data-action="ai-apply"]');
await page.waitForFunction(() => document.querySelector('[data-field="title"]')?.value.startsWith('Red beach cruiser'));
assert.equal(await page.inputValue('[data-field="title"]'), 'Red beach cruiser bike, 26"');
assert.equal(await page.inputValue('[data-field="price"]'), '85');
assert.equal(await page.inputValue('[data-field="category"]'), 'Bikes');
step('free AI route: pasted answer fills the listing');
const [vinted] = await Promise.all([page.waitForEvent('popup'), page.click('[data-check="vinted"]')]);
assert.match(vinted.url(), /^https:\/\/www\.vinted\.com\/catalog\?search_text=Red%20beach%20cruiser/);
await vinted.close();
step('Vinted price check opens a Vinted search for the title');

// 7. AI with a key (Gemini mocked)
let geminiBody = null;
await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
  geminiBody = JSON.parse(route.request().postData());
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ what: 'Brass floor lamp', title: 'Brass floor lamp with cream shade, 5 ft', price: 35, priceLow: 25, priceHigh: 50, priceNote: 'Vintage brass lamps move fast locally.', category: 'Home Decor & Art', condition: 'Like new', description: 'Tall brass floor lamp with a cream fabric shade. Works perfectly.' }) }] } }] }),
  });
});
await page.goto(`${BASE}#/settings`);
await page.waitForSelector('details[data-section="ai"]');
assert.equal(await page.locator('details.settings-section[open]').count(), 0, 'Settings starts folded');
await openSection('ai');
await page.fill('#gemini-key', 'AIzaSyD-example-only-not-a-real-key-000');
await page.click('[data-action="save-key"]');
await page.waitForSelector('.key-on');
await page.goto(BASE);
await page.waitForSelector('#grid');
await page.setInputFiles('.tabbar input[data-pick="new"]', `${DEMO}/lamp.jpg`);
await page.waitForURL(/#\/item\/[^/]+$/);
await page.click('[data-action="ai"]');
await page.waitForSelector('.ai-field');
assert.ok(geminiBody.contents[0].parts[0].inlineData.data.length > 1000, 'photo sent');
assert.equal(geminiBody.generationConfig.responseMimeType, 'application/json');
await page.click('[data-action="ai-apply"]');
await page.waitForFunction(() => document.querySelector('[data-field="title"]')?.value.startsWith('Brass floor lamp'));
assert.equal(await page.inputValue('[data-field="condition"]'), 'likenew');
step('one-tap AI (mocked Gemini) sends the photo and fills the listing');

// 7b. Adding without a photo, the Saved note, deleting with Undo
await page.goto(BASE);
await page.waitForSelector('#grid');
const cards = () => page.locator('.grid .item-card').count();
const before = await cards();
await page.click('[data-action="add-blank"]');
await page.waitForURL(/#\/item\/[^/]+$/);
await page.click('[data-action="back"]');
await page.waitForSelector('#grid');
assert.equal(await cards(), before, 'an untouched blank item is cleared away');
step('empty "add without a photo" item is cleared when she backs out');

await page.click('[data-action="add-blank"]');
await page.waitForURL(/#\/item\/[^/]+$/);
await page.fill('[data-field="title"]', 'Garden hose reel');
await page.waitForSelector('#saved.on');
await shot('19-saved-note');
await page.click('[data-action="back"]');
await page.waitForSelector('#grid');
assert.equal(await cards(), before + 1);
step('item without a photo kept once it has a title; "Saved" shows while typing');

await page.click('.item-card:has-text("Garden hose reel")');
await page.waitForSelector('.topbar [data-action="delete-item"]');
await page.click('.topbar [data-action="delete-item"]');
await page.waitForSelector('#grid');
await page.waitForSelector('#toast.has-action');
assert.match(await toastText(), /Deleted "Garden hose reel"/);
assert.equal(await cards(), before);
await page.waitForTimeout(300); // toast fades in
await shot('20-undo-toast');
await page.click('#toast [data-action="toast-action"]');
await page.waitForFunction((n) => document.querySelectorAll('.grid .item-card').length === n, before + 1);
await page.reload();
await page.waitForSelector('#grid');
assert.equal(await cards(), before + 1, 'undo survives a reload');
step('delete from the top bar, then Undo brings it back (and it stays back)');

// 8. Restore the demo backup
await page.goto(`${BASE}#/settings`);
await page.setInputFiles('[data-pick="restore"]', `${DEMO}/demo-backup.zip`);
await page.waitForFunction(() => /Restored/.test(document.querySelector('#toast')?.textContent || ''), null, { timeout: 20000 });
step(`restore: ${await toastText()}`);
await page.goto(BASE);
await page.waitForSelector('#grid');
await page.waitForTimeout(400);
await shot('11-items');
await shot('11b-items-full', true);
const todoTiles = await page.locator('.todo').allInnerTexts();
step(`to-do strip: ${todoTiles.map((t) => t.replace(/\s+/g, ' ')).join(' | ')}`);

await page.click('.notice-backup [data-action="open-section"]');
await page.waitForSelector('details[data-section="backup"][open]');
assert.equal(await page.locator('details.settings-section[open]').count(), 1, 'only Backup is opened');
await page.waitForTimeout(300);
await shot('14a-settings-backup-open');
step('"Back up now" reminder opens Settings with just Backup unfolded');
await page.goto(BASE);
await page.waitForSelector('#grid');
await page.click('.todo:has-text("Listed 14+ days")');
assert.equal(await page.locator('.grid .item-card').count(), 1);
await page.click('.grid .item-card');
await page.waitForSelector('.stale');
await shot('12-stale-item');
await page.click('[data-action="drop"]');
await settle();
assert.match(await toastText(), /Price is now \$110/);
step('stale listing: price drop to $110 suggested and applied');

await page.goto(BASE);
await page.fill('#search', 'lamp');
await settle();
const found = await page.locator('.grid .item-card').allInnerTexts();
assert.ok(found.length >= 1 && found.every((t) => /lamp/i.test(t)));
step(`search "lamp" -> ${found.length} result(s)`);
await page.fill('#search', '');

// 9. Money
await page.goto(`${BASE}#/money`);
await page.waitForSelector('.hero-value');
await shot('13-money');
await shot('13b-money-full', true);
await page.click('[data-period="all"]');
await settle();
step(`money all-time: ${await text('.hero-value')} (${await text('.hero-sub')})`);
await page.locator('.month-chart .hit').nth(3).click();
step(`chart tap: ${await text('#month-caption')}`);

// 10. Backup, wipe, restore
await page.goto(`${BASE}#/settings`);
await openSection('backup');
await page.waitForSelector('[data-action="backup"]');
const count = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('curbside'); r.onsuccess = () => { const q = r.result.transaction('items').objectStore('items').count(); q.onsuccess = () => res(q.result); }; }));
const [backupDl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="backup"]')]);
const backupPath = `${SCRATCH}/test-backup.zip`;
await backupDl.saveAs(backupPath);
const zip = await readZip(new Blob([readFileSync(backupPath)]));
const saved = JSON.parse(await zip.text('curbside.json'));
assert.equal(saved.items.length, count);
assert.equal(saved.settings.geminiKey, undefined, 'key is not in the backup');
assert.ok(zip.names.includes('inventory.csv'));
step(`backup: ${backupDl.suggestedFilename()} with ${saved.items.length} items, ${zip.names.filter((n) => n.startsWith('photos/')).length} photos`);
await shot('14-settings', true);

await openSection('wipe');
await page.check('#wipe-ok');
await page.click('#wipe-btn');
await page.waitForSelector('.welcome');
step('wiped');
await page.goto(`${BASE}#/settings`);
await page.setInputFiles('[data-pick="restore"]', backupPath);
await page.waitForFunction(() => /Restored/.test(document.querySelector('#toast')?.textContent || ''), null, { timeout: 20000 });
const after = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('curbside'); r.onsuccess = () => { const q = r.result.transaction('items').objectStore('items').count(); q.onsuccess = () => res(q.result); }; }));
assert.equal(after, count);
step(`restored ${after} items from our own backup`);

// 11. Dark mode
await page.emulateMedia({ colorScheme: 'dark' });
await page.goto(BASE);
await page.waitForSelector('#grid');
await page.waitForTimeout(300);
await shot('15-dark-items');
await page.goto(`${BASE}#/money`);
await page.waitForSelector('.hero-value');
await shot('16-dark-money');
const listed = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('curbside'); r.onsuccess = () => { const q = r.result.transaction('items').objectStore('items').getAll(); q.onsuccess = () => res(q.result.find((i) => i.status === 'pending')?.id); }; }));
await page.goto(`${BASE}#/item/${listed}`);
await page.waitForSelector('#status-panel');
await shot('17-dark-pending-item');

// 12. iPhone wording
const ios = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1' });
const ip = await ios.newPage();
ip.on('pageerror', (e) => problems.push(`ios pageerror: ${e.message}`));
await ip.goto(BASE);
await ip.waitForSelector('.welcome');
await ip.screenshot({ path: `${SHOTS}/18-ios-first-run.png` });
step(`iPhone install tip shown: ${await ip.locator('.notice-install').count() === 1}`);

await browser.close();
console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nNo console errors.');
