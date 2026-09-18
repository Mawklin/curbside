// Service worker check: first visit caches the app, then it must load with the network off.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5174/?sw');
await page.evaluate(() => navigator.serviceWorker.ready);
const cached = await page.evaluate(async () => {
  const keys = await caches.keys();
  const cache = await caches.open(keys.find((k) => k.startsWith('curbside-')));
  return { name: keys.join(','), count: (await cache.keys()).length };
});
console.log('cache:', cached);
await context.setOffline(true);
await page.reload();
await page.waitForSelector('.welcome, #grid', { timeout: 10000 });
console.log('offline reload rendered:', (await page.locator('h1').first().innerText()));
await page.goto('http://127.0.0.1:5174/#/money');
await page.waitForSelector('.hero-value');
console.log('offline money page:', await page.locator('.hero-value').innerText());
console.log(errors.length ? `errors: ${errors.join(' | ')}` : 'no page errors');
await browser.close();
