// Drawn "phone photos" of curb finds + a demo Curbside backup built from them.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { makeZip } from 'file:///D:/Epic%20Games/curbside/docs/zip.js';
import { newItem, markListed, setPending, markSold, markDone, toCsv } from 'file:///D:/Epic%20Games/curbside/docs/model.js';

const require = createRequire('file:///D:/Epic%20Games/lesson-notes/worker/package.json');
const sharp = require('sharp');
const OUT = 'D:/Epic Games/curbside/tests/browser/out/demo';
mkdirSync(OUT, { recursive: true });

const scene = (inner, ground = '#b9b3a6', wall = '#dcd3c3') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600">
  <defs>
    <linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wall}"/><stop offset="1" stop-color="#c9bfae"/></linearGradient>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ground}"/><stop offset="1" stop-color="#8f897d"/></linearGradient>
    <radialGradient id="sh"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a5a33"/><stop offset=".5" stop-color="#a06b3e"/><stop offset="1" stop-color="#7a4d2a"/></linearGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9c7a2e"/><stop offset=".5" stop-color="#e3c46b"/><stop offset="1" stop-color="#8d6a22"/></linearGradient>
  </defs>
  <rect width="1200" height="1000" fill="url(#w)"/>
  <rect y="1000" width="1200" height="600" fill="url(#g)"/>
  <rect y="990" width="1200" height="20" fill="#a39c8f"/>
  ${inner}
</svg>`;

const PHOTOS = {
  dresser: scene(`<ellipse cx="600" cy="1330" rx="470" ry="60" fill="url(#sh)"/>
    <rect x="180" y="520" width="840" height="780" rx="14" fill="url(#wood)"/>
    <rect x="160" y="500" width="880" height="44" rx="10" fill="#6d4424"/>
    ${[0, 1, 2].map((r) => [0, 1].map((c) => `<rect x="${215 + c * 395}" y="${580 + r * 235}" width="375" height="205" rx="10" fill="#94613a" stroke="#6d4424" stroke-width="6"/><circle cx="${402 + c * 395}" cy="${682 + r * 235}" r="16" fill="#e3c46b"/>`).join('')).join('')}
    <rect x="200" y="1290" width="40" height="50" fill="#5c381d"/><rect x="960" y="1290" width="40" height="50" fill="#5c381d"/>`),
  dresser2: scene(`<ellipse cx="600" cy="1300" rx="420" ry="50" fill="url(#sh)"/>
    <polygon points="250,560 950,500 1010,1270 190,1290" fill="url(#wood)"/>
    ${[0, 1, 2].map((r) => `<polygon points="${290},${620 + r * 215} ${910},${570 + r * 215} ${925},${745 + r * 215} ${280},${790 + r * 215}" fill="#94613a" stroke="#6d4424" stroke-width="6"/>`).join('')}`, '#9aa38f'),
  lamp: scene(`<ellipse cx="600" cy="1400" rx="220" ry="40" fill="url(#sh)"/>
    <ellipse cx="600" cy="1380" rx="170" ry="34" fill="url(#brass)"/>
    <rect x="585" y="520" width="30" height="860" fill="url(#brass)"/>
    <polygon points="400,560 800,560 720,300 480,300" fill="#f3ead2" stroke="#d9c89b" stroke-width="8"/>
    <ellipse cx="600" cy="560" rx="200" ry="26" fill="#e9dcb8"/>`, '#b0a998', '#e7dfcf'),
  bike: scene(`<ellipse cx="600" cy="1330" rx="520" ry="50" fill="url(#sh)"/>
    <circle cx="330" cy="1080" r="230" fill="none" stroke="#222" stroke-width="26"/><circle cx="330" cy="1080" r="200" fill="none" stroke="#999" stroke-width="4"/>
    <circle cx="880" cy="1080" r="230" fill="none" stroke="#222" stroke-width="26"/><circle cx="880" cy="1080" r="200" fill="none" stroke="#999" stroke-width="4"/>
    <path d="M330 1080 L520 760 L800 760 L880 1080 M520 760 L600 1080 L330 1080 M600 1080 L800 760" stroke="#c0282d" stroke-width="30" fill="none" stroke-linejoin="round"/>
    <path d="M800 760 L770 640 L700 620" stroke="#c0282d" stroke-width="26" fill="none" stroke-linecap="round"/>
    <rect x="460" y="700" width="130" height="36" rx="18" fill="#3a2a1f"/>`, '#8e9486'),
  chair: scene(`<ellipse cx="600" cy="1320" rx="360" ry="50" fill="url(#sh)"/>
    <path d="M360 1300 L420 980 M840 1300 L780 980 M430 1300 L470 990 M770 1300 L730 990" stroke="#6d4424" stroke-width="26" stroke-linecap="round"/>
    <rect x="360" y="900" width="480" height="110" rx="40" fill="#2f7a74"/>
    <path d="M400 910 Q380 620 470 560 L730 560 Q820 620 800 910 Z" fill="#358a83"/>`, '#b5ad9c', '#ece4d4'),
  mirror: scene(`<ellipse cx="600" cy="1350" rx="330" ry="50" fill="url(#sh)"/>
    <rect x="330" y="300" width="540" height="1040" rx="270" fill="#d9c089"/>
    <rect x="370" y="340" width="460" height="960" rx="230" fill="#c8d6db"/>
    <path d="M430 520 L560 400 M440 640 L640 450" stroke="#fff" stroke-width="20" opacity=".6" stroke-linecap="round"/>`),
  wagon: scene(`<ellipse cx="600" cy="1340" rx="450" ry="50" fill="url(#sh)"/>
    <rect x="240" y="900" width="720" height="260" rx="20" fill="#d62f2f"/><rect x="240" y="900" width="720" height="40" fill="#b32424"/>
    <circle cx="360" cy="1230" r="90" fill="#222"/><circle cx="840" cy="1230" r="90" fill="#222"/>
    <path d="M960 1000 L1120 700" stroke="#333" stroke-width="20" stroke-linecap="round"/>`),
  fan: scene(`<ellipse cx="600" cy="1340" rx="300" ry="40" fill="url(#sh)"/>
    <rect x="330" y="560" width="540" height="760" rx="40" fill="#e8e8e2"/>
    <circle cx="600" cy="900" r="230" fill="#cfd2cc"/>
    ${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="600" cy="780" rx="60" ry="120" fill="#9aa39a" transform="rotate(${a} 600 900)"/>`).join('')}
    <circle cx="600" cy="900" r="40" fill="#777"/>`),
};

for (const [name, svg] of Object.entries(PHOTOS)) {
  await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(`${OUT}/${name}.jpg`);
}

// ---------- a demo backup with items at every stage ----------
const DAY = 86400000;
const now = Date.now();
const items = [];
const photoFiles = [];
const photoInfo = [];
async function addPhotos(item, names) {
  for (const [n, name] of names.entries()) {
    const id = `${item.id}-p${n}`;
    const full = await sharp(Buffer.from(PHOTOS[name])).resize(1200, 1600).jpeg({ quality: 85 }).toBuffer();
    const thumb = await sharp(Buffer.from(PHOTOS[name])).resize(360, 480).jpeg({ quality: 80 }).toBuffer();
    photoFiles.push({ name: `photos/${id}.jpg`, data: new Uint8Array(full) }, { name: `thumbs/${id}.jpg`, data: new Uint8Array(thumb) });
    photoInfo.push({ id, itemId: item.id, w: 1200, h: 1600, at: item.createdAt });
    item.photos.push(id);
  }
}
const make = (daysAgo, fields) => ({ ...newItem(now - daysAgo * DAY), ...fields });

const dresser = make(18, { title: 'Solid wood dresser, 6 drawers', price: 120, floor: 90, category: 'Furniture', condition: 'good', description: 'Heavy solid wood dresser with six deep drawers and brass pulls. All drawers slide smoothly. A few light scratches on top.', foundWhere: 'Curb on Maple Ave', storedAt: 'Garage, back wall' });
await addPhotos(dresser, ['dresser', 'dresser2']);
markListed(dresser, 'facebook', '', now - 17 * DAY);
markListed(dresser, 'offerup', '', now - 16 * DAY);
dresser.status = 'listed';

const lamp = make(9, { title: 'Brass floor lamp, 5 ft', price: 35, category: 'Home Decor & Art', condition: 'likenew', description: 'Tall brass floor lamp with a cream shade. Works great.', foundWhere: 'Free pile on 3rd St' });
await addPhotos(lamp, ['lamp']);
markListed(lamp, 'facebook', '', now - 8 * DAY);
const tomorrow = new Date(now + DAY);
setPending(lamp, { buyer: 'Jordan', when: `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}T14:00`, price: 30, note: 'Paying Venmo' }, now - DAY);

const chair = make(2, { title: 'Mid-century accent chair, teal', price: 60, category: 'Furniture', condition: 'good', description: 'Teal upholstered accent chair with wooden legs. Sturdy, no rips.', foundWhere: 'Alley behind Oak St' });
await addPhotos(chair, ['chair']);

const mirror = make(0, { foundWhere: 'Curb on Birch Rd' });
await addPhotos(mirror, ['mirror']);

const bike = make(40, { title: 'Red cruiser bike, 26"', price: 90, cost: 12, category: 'Bikes', condition: 'good', description: 'Red beach cruiser, 26" wheels. New tubes.', notes: 'Bought tubes $12' });
await addPhotos(bike, ['bike']);
markListed(bike, 'offerup', '', now - 38 * DAY);
markListed(bike, 'facebook', '', now - 38 * DAY);
markSold(bike, { price: 85, platform: 'offerup', date: now - 30 * DAY, buyer: 'Chris' }, now - 30 * DAY);
bike.listings.offerup.removedAt = now - 30 * DAY; // facebook left up on purpose: shows the take-down reminder

const wagon = make(70, { title: 'Kids pull wagon, red', price: 30, category: 'Baby & Kids', condition: 'fair' });
await addPhotos(wagon, ['wagon']);
markListed(wagon, 'facebook', '', now - 68 * DAY);
markSold(wagon, { price: 30, platform: 'facebook', date: now - 60 * DAY }, now - 60 * DAY);
wagon.listings.facebook.removedAt = now - 60 * DAY;

const fan = make(25, { title: 'Box fan', price: 10, category: 'Appliances', condition: 'fair' });
await addPhotos(fan, ['fan']);
markDone(fan, 'donated', now - 5 * DAY);

// A few older sales for the chart, no photos.
const older = [[95, 'craigslist', 100], [45, 'facebook', 130], [140, 'ebay', 150], [25, 'offerup', 12]];
for (const [price, platform, ago] of older) {
  const i = make(ago + 5, { title: ['Oak side table', 'Vintage Pyrex bowls', 'Craftsman tool chest', 'Kids scooter'][older.findIndex((o) => o[2] === ago)], price, category: 'Other', condition: 'good' });
  markListed(i, platform, '', now - (ago + 3) * DAY);
  markSold(i, { price, platform, date: now - ago * DAY, fees: platform === 'ebay' ? 18 : 0 }, now - ago * DAY);
  i.listings[platform].removedAt = now - ago * DAY;
  items.push(i);
}

items.push(dresser, lamp, chair, mirror, bike, wagon, fan);
const data = { app: 'curbside', format: 1, version: 'demo', exportedAt: now, settings: { pickupArea: 'Near Main St & 5th Ave', footer: "Cash or Venmo. Porch pickup. If it's still posted, it's still available!" }, items, photos: photoInfo };
const zip = await makeZip([{ name: 'curbside.json', data: JSON.stringify(data) }, { name: 'inventory.csv', data: toCsv(items) }, ...photoFiles]);
writeFileSync(`${OUT}/demo-backup.zip`, Buffer.from(await zip.arrayBuffer()));
console.log('demo photos + backup written:', items.length, 'items');
