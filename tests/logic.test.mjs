// Checks the parts with no screen: listing text, reading AI answers, sales maths, backups.
//   node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, money, pickupLabel, csvCell } from '../docs/util.js';
import { buildDescription, copyAllText, parseAiReply, matchCategory, matchCondition, titleWarning, conditionFor } from '../docs/listing.js';
import {
  newItem, markListed, takeDown, setPrice, setPending, fellThrough, markSold, undoSale, markDone, bringBack,
  activeListings, profit, daysToSell, summarize, monthly, todo, priceDrops, isStale, toCsv, renewListing, isBlank,
} from '../docs/model.js';
import { makeZip, readZip, crc32 } from '../docs/zip.js';

const DAY = 86400000;
const T0 = new Date(2026, 8, 1, 12).getTime(); // Sep 1 2026, noon

test('money parsing and formatting', () => {
  assert.equal(parseMoney('$45'), 45);
  assert.equal(parseMoney('1,200.50'), 1200.5);
  assert.equal(parseMoney(' 12.345 '), 12.35);
  assert.equal(parseMoney('free'), null);
  assert.equal(parseMoney(''), null);
  assert.equal(money(45), '$45');
  assert.equal(money(45.5), '$45.50');
  assert.equal(money(null), '');
});

test('pickup label reads naturally', () => {
  const now = new Date(2026, 8, 17, 9).getTime();
  assert.equal(pickupLabel('2026-09-17T14:00', now), 'today 2 PM');
  assert.equal(pickupLabel('2026-09-18T14:30', now), 'tomorrow 2:30 PM');
});

test('description: local sites get the pickup lines, shipping sites do not', () => {
  const item = { ...newItem(T0), description: 'Solid oak, 6 drawers.', condition: 'good' };
  const settings = { pickupArea: 'Near Main & 5th', footer: 'Cash or Venmo.', addCondition: true };
  assert.equal(buildDescription(item, 'facebook', settings),
    'Solid oak, 6 drawers.\n\nCondition: Good\nPickup: Near Main & 5th\n\nCash or Venmo.');
  assert.equal(buildDescription(item, 'ebay', settings), 'Solid oak, 6 drawers.\n\nCondition: Good');
  assert.equal(buildDescription(item, 'facebook', { ...settings, addCondition: false }),
    'Solid oak, 6 drawers.\n\nPickup: Near Main & 5th\n\nCash or Venmo.');
  const all = copyAllText({ ...item, title: 'Oak dresser', price: 80 }, 'offerup', settings);
  assert.ok(all.startsWith('Oak dresser\n\n$80\n\nSolid oak'));
});

test('platform extras', () => {
  assert.equal(conditionFor('facebook', 'likenew'), 'Used - Like New');
  assert.equal(conditionFor('offerup', 'likenew'), 'Like new');
  assert.equal(titleWarning('x'.repeat(75), 'craigslist'), 'Craigslist allows 70 characters; this is 75.');
  assert.equal(titleWarning('x'.repeat(75), 'facebook'), '');
});

test('reads a ChatGPT answer in the labelled format, with markdown noise', () => {
  const reply = `Sure! Here's your listing:

**TITLE:** Vintage Schwinn Cruiser Bike, 26", Red
**PRICE:** $85
**PRICE RANGE:** $60 - $120
**CATEGORY:** Bikes
**CONDITION:** Used - Good
**DESCRIPTION:**
Classic red Schwinn cruiser with 26" wheels.
Tires hold air; some surface rust on the chain.

Let me know if you want changes!`;
  const s = parseAiReply(reply);
  assert.equal(s.title, 'Vintage Schwinn Cruiser Bike, 26", Red');
  assert.equal(s.price, 85);
  assert.equal(s.priceLow, 60);
  assert.equal(s.priceHigh, 120);
  assert.equal(s.category, 'Bikes');
  assert.equal(s.condition, 'good');
  assert.match(s.description, /^Classic red Schwinn cruiser/);
  assert.match(s.description, /surface rust/);
});

test('reads Gemini JSON, even wrapped in a code fence', () => {
  const s = parseAiReply('```json\n{"what":"Floor lamp","title":"Brass Floor Lamp, 5 ft","price":"$35","priceLow":25,"priceHigh":50,"category":"home decor","condition":"Like new","description":"Works."}\n```');
  assert.equal(s.title, 'Brass Floor Lamp, 5 ft');
  assert.equal(s.price, 35);
  assert.equal(s.category, 'Home Decor & Art');
  assert.equal(s.condition, 'likenew');
  assert.equal(parseAiReply('I cannot help with that.'), null);
  assert.equal(parseAiReply('TITLE: Red cruiser bike, 26"\nPRICE: $80').title, 'Red cruiser bike, 26"', 'keeps an inches mark');
  assert.equal(parseAiReply('TITLE: "Oak desk"\nPRICE: $80').title, 'Oak desk', 'drops wrapping quotes');
});

test('category and condition matching', () => {
  assert.equal(matchCategory('kitchen stuff'), 'Home & Kitchen');
  assert.equal(matchCategory('Power tools'), 'Tools & Garage');
  assert.equal(matchCategory('spaceships'), 'Other');
  assert.equal(matchCondition('For parts or repair'), 'parts');
  assert.equal(matchCondition('Brand new in box'), 'new');
  assert.equal(matchCondition('fair, some wear'), 'fair');
});

test('an item from the curb to sold', () => {
  const item = newItem(T0);
  item.title = 'Oak dresser';
  item.price = 80;
  item.cost = 5;
  item.photos = ['p1'];
  assert.equal(item.status, 'tolist');

  markListed(item, 'facebook', '', T0 + DAY);
  markListed(item, 'offerup', 'https://offerup.com/item/1', T0 + 2 * DAY);
  assert.equal(item.status, 'listed');
  assert.equal(activeListings(item).length, 2);

  setPrice(item, 70, T0 + 5 * DAY);
  assert.equal(item.priceChangedAt, T0 + 5 * DAY);
  assert.match(item.history.at(-1).text, /\$80 → \$70/);

  setPending(item, { buyer: 'Sam', when: '2026-09-08T14:00', price: 65 }, T0 + 6 * DAY);
  assert.equal(item.status, 'pending');
  fellThrough(item, T0 + 7 * DAY);
  assert.equal(item.status, 'listed');

  markSold(item, { price: 65, fees: 0, platform: 'facebook', date: T0 + 9 * DAY }, T0 + 9 * DAY);
  assert.equal(item.status, 'sold');
  assert.equal(profit(item), 60);
  assert.equal(daysToSell(item), 8);

  const t = todo([item], {}, T0 + 9 * DAY);
  assert.equal(t.cleanup.length, 1, 'still posted on both sites');
  takeDown(item, 'facebook', T0 + 9 * DAY);
  takeDown(item, 'offerup', T0 + 9 * DAY);
  assert.equal(item.status, 'sold', 'taking listings down after a sale keeps it sold');
  assert.equal(todo([item], {}, T0 + 9 * DAY).cleanup.length, 0);

  undoSale(item, T0 + 10 * DAY);
  assert.equal(item.status, 'tolist', 'no active listings left, so back to To list');
  markDone(item, 'donated', T0 + 11 * DAY);
  assert.equal(item.status, 'done');
  bringBack(item, T0 + 12 * DAY);
  assert.equal(item.status, 'tolist');
});

test('taking down the last listing moves a listed item back to To list', () => {
  const item = newItem(T0);
  markListed(item, 'craigslist', '', T0);
  takeDown(item, 'craigslist', T0 + DAY);
  assert.equal(item.status, 'tolist');
});

test('stale listings and price drops', () => {
  const item = { ...newItem(T0), title: 'Lamp', price: 40, photos: ['p'] };
  markListed(item, 'facebook', '', T0);
  assert.equal(isStale(item, 14, T0 + 13 * DAY), false);
  assert.equal(isStale(item, 14, T0 + 14 * DAY), true);
  renewListing(item, 'facebook', T0 + 14 * DAY);
  assert.equal(isStale(item, 14, T0 + 20 * DAY), false, 'renewing resets the clock');
  assert.deepEqual(priceDrops(40), [36, 32]);
  assert.deepEqual(priceDrops(250), [225, 200]);
  assert.deepEqual(priceDrops(120), [110, 95], 'rounded by the original price, not the dropped one');
  assert.deepEqual(priceDrops(5), [4.5, 4]);
  assert.deepEqual(priceDrops(1), []);
});

test('an untouched item counts as blank, anything typed does not', () => {
  const item = newItem(T0);
  assert.equal(isBlank(item), true);
  assert.equal(isBlank({ ...item, title: 'Hose reel' }), false);
  assert.equal(isBlank({ ...item, price: 0 }), false, 'a $0 (free) price is still something she typed');
  assert.equal(isBlank({ ...item, photos: ['p'] }), false);
  assert.equal(isBlank({ ...item, notes: 'x' }), false);
});

test('to-do lists', () => {
  const blank = newItem(T0);
  const ready = { ...newItem(T0), title: 'Chair', price: 20, photos: ['a'] };
  const pending = setPending({ ...newItem(T0), title: 'Desk', price: 50, photos: ['b'] }, { when: '2026-09-02T10:00' }, T0);
  const t = todo([blank, ready, pending], {}, T0);
  assert.deepEqual(t.needs.map((i) => i.id), [blank.id]);
  assert.deepEqual(t.ready.map((i) => i.id), [ready.id]);
  assert.deepEqual(t.pickups.map((i) => i.id), [pending.id]);
});

test('money summary and months', () => {
  const mk = (price, cost, platform, date) => {
    const i = { ...newItem(date - 3 * DAY), title: 'x', price, cost };
    markListed(i, platform, '', date - 2 * DAY);
    return markSold(i, { price, fees: platform === 'ebay' ? 5 : 0, platform, date }, date);
  };
  const items = [
    mk(40, 0, 'facebook', new Date(2026, 8, 3).getTime()),
    mk(100, 10, 'ebay', new Date(2026, 8, 10).getTime()),
    mk(25, 0, 'facebook', new Date(2026, 7, 20).getTime()),
    { ...newItem(T0), price: 60 },
  ];
  const sep = summarize(items, new Date(2026, 8, 1).getTime(), Infinity);
  assert.equal(sep.count, 2);
  assert.equal(sep.gross, 140);
  assert.equal(sep.spent, 15);
  assert.equal(sep.profit, 125);
  assert.equal(sep.byPlatform.facebook.profit, 40);
  assert.equal(sep.byPlatform.ebay.profit, 85);
  assert.equal(sep.avgDays, 2);
  const months = monthly(items, 3, new Date(2026, 8, 15).getTime());
  assert.deepEqual(months.map((m) => m.profit), [0, 25, 125]);
  assert.deepEqual(months.map((m) => m.label), ['Jul', 'Aug', 'Sep']);
});

test('spreadsheet quotes awkward text', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  const item = { ...newItem(T0), title: 'Desk, oak', description: 'Line one\nLine two' };
  const csv = toCsv([item]);
  assert.ok(csv.startsWith('﻿Title,Status'));
  assert.ok(csv.includes('"Desk, oak",To list'));
  assert.ok(csv.includes('"Line one\nLine two"'));
});

test('backup zip round-trips, including photos', async () => {
  const photo = new Uint8Array(5000).map((_, i) => (i * 7) % 256);
  const zip = await makeZip([
    { name: 'curbside.json', data: JSON.stringify({ app: 'curbside', items: [{ id: 'a', title: 'Café table' }] }) },
    { name: 'photos/p1.jpg', data: new Blob([photo]) },
  ]);
  const back = await readZip(zip);
  assert.deepEqual(back.names, ['curbside.json', 'photos/p1.jpg']);
  assert.equal(JSON.parse(await back.text('curbside.json')).items[0].title, 'Café table');
  assert.deepEqual(await back.bytes('photos/p1.jpg'), photo);
  assert.equal(crc32(new TextEncoder().encode('The quick brown fox jumps over the lazy dog')), 0x414fa339);
  await assert.rejects(readZip(new Blob(['not a zip at all'])), /isn't a trash2treasure backup/);
});

// ---------- v1.2: size, photo checklist, buyer replies, pickup calendar ----------
import { photoChecklist } from '../docs/listing.js';
import { quickReplies } from '../docs/replies.js';
import { pickupEvent, googleCalendarUrl, icsFile, utcStamp } from '../docs/calendar.js';

test('size goes into every description, before condition', () => {
  const item = { ...newItem(T0), description: 'Oak dresser.', size: '30" W x 18" D', condition: 'good' };
  assert.equal(buildDescription(item, 'ebay', {}), 'Oak dresser.\n\nSize: 30" W x 18" D\nCondition: Good');
  assert.ok(toCsv([item]).includes(',"30"" W x 18"" D",'), 'size column, quotes escaped');
});

test('photo checklist adds extras by category', () => {
  assert.deepEqual(photoChecklist('').map((s) => s.id), ['front', 'sides', 'label', 'flaws']);
  assert.deepEqual(photoChecklist('Furniture').map((s) => s.id), ['front', 'sides', 'label', 'flaws', 'open', 'scale']);
  assert.ok(photoChecklist('Clothing & Shoes').some((s) => s.id === 'tag'));
});

test('buyer replies fit the item and its status', () => {
  const settings = { pickupArea: 'Main & 5th' };
  const item = { ...newItem(T0), title: 'Dresser', price: 120, floor: 90, size: '30" wide', condition: 'likenew' };
  const ids = (i) => quickReplies(i, settings, T0).map((r) => r.id);
  assert.deepEqual(ids(item), ['available', 'pickup', 'details', 'lowest', 'firm', 'first']);
  const byId = Object.fromEntries(quickReplies(item, settings, T0).map((r) => [r.id, r.text]));
  assert.equal(byId.pickup, "Pickup is near Main & 5th. I'll send the exact address once we pick a time.");
  assert.equal(byId.details, "It measures 30\" wide, and it's in like-new condition.");
  assert.equal(byId.lowest, 'The lowest I can do is $90.');
  assert.equal(quickReplies({ ...item, condition: 'parts', size: '' }, settings, T0).find((r) => r.id === 'details').text, 'It needs some work.');

  const pending = setPending({ ...item }, { buyer: 'Sam', when: '2026-09-01T15:00' }, T0);
  assert.equal(ids(pending)[0], 'confirm');
  assert.match(quickReplies(pending, settings, T0)[0].text, /^See you today 3 PM!/);
  assert.ok(!ids(pending).includes('available'));
  assert.deepEqual(ids(markSold({ ...item }, { price: 100 }, T0)), ['sold']);
  assert.ok(!ids({ ...item, floor: null }).includes('lowest'));
});

test('pickup calendar event: Google link and .ics file', () => {
  const item = setPending({ ...newItem(T0), title: 'Oak desk, solid; heavy' },
    { buyer: 'Jordan', when: '2026-09-20T14:00', price: 30, note: 'Bringing a truck' }, T0);
  const ev = pickupEvent(item, { pickupArea: 'Main & 5th' });
  assert.equal(ev.title, 'Pickup: Oak desk, solid; heavy (Jordan)');
  assert.equal(ev.end - ev.start, 30 * 60000);
  assert.equal(utcStamp(ev.start), utcStamp(new Date(2026, 8, 20, 14, 0)));
  const url = new URL(googleCalendarUrl(ev));
  assert.equal(url.hostname, 'calendar.google.com');
  assert.equal(url.searchParams.get('dates'), `${utcStamp(ev.start)}/${utcStamp(ev.end)}`);
  assert.match(url.searchParams.get('details'), /Agreed price: \$30/);
  const ics = icsFile(ev, new Date(T0));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('SUMMARY:Pickup: Oak desk\\, solid\\; heavy (Jordan)'), 'commas and semicolons escaped');
  assert.ok(unfolded.includes('DESCRIPTION:Buyer: Jordan\\nAgreed price: $30\\nNote: Bringing a truck\\nFrom trash2treasure'));
  assert.ok(ics.includes('TRIGGER:-PT30M'));
  assert.ok(ics.split('\r\n').every((line) => line.length <= 75), 'long lines folded');
  assert.equal(pickupEvent({ ...item, pending: { buyer: 'x' } }), null, 'no time, no event');
});

// ---------- v1.4: holiday themes ----------
import { easter, holidayOn, THEMES, resolveTheme } from '../docs/themes.js';

test('holiday dates', () => {
  const day = (t) => new Date(t).toDateString();
  const date = (id, y) => day(THEMES.find((t) => t.id === id).date(y));
  assert.equal(day(easter(2026)), 'Sun Apr 05 2026');
  assert.equal(day(easter(2027)), 'Sun Mar 28 2027');
  assert.equal(date('mlk', 2026), 'Mon Jan 19 2026');
  assert.equal(date('presidents', 2026), 'Mon Feb 16 2026');
  assert.equal(date('mothersday', 2026), 'Sun May 10 2026');
  assert.equal(date('memorial', 2026), 'Mon May 25 2026');
  assert.equal(date('fathersday', 2026), 'Sun Jun 21 2026');
  assert.equal(date('laborday', 2026), 'Mon Sep 07 2026');
  assert.equal(date('thanksgiving', 2026), 'Thu Nov 26 2026');
});

test('Automatic picks the holiday that is on or coming up', () => {
  const on = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return holidayOn(new Date(y, m - 1, d, 9).getTime());
  };
  assert.equal(on('2026-01-01'), 'newyear');
  assert.equal(on('2026-02-10'), 'valentines');
  assert.equal(on('2026-03-30'), 'easter');
  assert.equal(on('2026-07-01'), 'july4');
  assert.equal(on('2026-08-01'), 'curbside', 'no holiday: the original look');
  assert.equal(on('2026-10-15'), 'halloween');
  assert.equal(on('2026-11-20'), 'thanksgiving');
  assert.equal(on('2026-12-09'), 'christmas');
  assert.equal(on('2026-11-26'), 'thanksgiving', 'the holiday itself beats one coming up');
  assert.equal(on('2026-12-20'), 'christmas');
  assert.equal(on('2026-12-26'), 'christmas');
  assert.equal(on('2026-12-28'), 'newyear');
  assert.equal(on('2026-06-19'), 'fathersday');
  assert.ok(!THEMES.some((t) => ['hanukkah', 'kwanzaa', 'juneteenth'].includes(t.id)));
  assert.equal(on('2026-12-31'), 'newyear');
  assert.equal(resolveTheme('halloween'), 'halloween');
  assert.equal(resolveTheme('nonsense'), 'curbside');
});
