// An item's life: found -> to list -> listed -> pending -> sold (or kept/donated/tossed).
// Everything here changes plain objects and returns; saving is the caller's job.
import { money, uid, DAY, daysSince, plural, csvCell, isoDay } from './util.js';
import { platformName } from './platforms.js';
import { conditionLabel } from './listing.js';

export const STATUSES = {
  tolist: { label: 'To list', short: 'To list' },
  listed: { label: 'Listed', short: 'Listed' },
  pending: { label: 'Pending', short: 'Pending' },
  sold: { label: 'Sold', short: 'Sold' },
  done: { label: 'Not selling', short: 'Done' },
};

export const DONE_REASONS = [
  { id: 'kept', label: 'Kept it' },
  { id: 'gave', label: 'Gave it away' },
  { id: 'donated', label: 'Donated it' },
  { id: 'tossed', label: 'Tossed it' },
];

export const doneLabel = (id) => DONE_REASONS.find((r) => r.id === id)?.label || 'Not selling';

export function newItem(now = Date.now()) {
  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    status: 'tolist',
    title: '',
    price: null,
    floor: null,
    category: '',
    condition: '',
    description: '',
    foundOn: now,
    foundWhere: '',
    storedAt: '',
    cost: null,
    notes: '',
    photos: [],
    listings: {},
    pending: null,
    sale: null,
    done: null,
    priceChangedAt: null,
    history: [{ t: now, text: 'Found it' }],
  };
}

const log = (item, text, now) => {
  item.history = [...(item.history || []), { t: now, text }];
  item.updatedAt = now;
};

export const activeListings = (item) => Object.entries(item.listings || {})
  .filter(([, l]) => l && l.listedAt && !l.removedAt)
  .map(([platform, l]) => ({ platform, ...l }));

export const isListedOn = (item, platformId) => {
  const l = item.listings?.[platformId];
  return Boolean(l && l.listedAt && !l.removedAt);
};

export function firstListedAt(item) {
  const times = Object.values(item.listings || {}).map((l) => l?.listedAt).filter(Boolean);
  return times.length ? Math.min(...times) : null;
}

// When she last did something that would get fresh eyes on it: posted, renewed or dropped the price.
export function freshAt(item) {
  const active = activeListings(item);
  if (!active.length) return null;
  const listed = Math.min(...active.map((l) => l.listedAt));
  return Math.max(listed, ...active.map((l) => l.renewedAt || 0), item.priceChangedAt || 0);
}

// Status to fall back to when a pending sale or a sale is undone.
const openStatus = (item) => (activeListings(item).length ? 'listed' : 'tolist');

export function markListed(item, platformId, url = '', now = Date.now()) {
  const was = item.listings?.[platformId];
  item.listings = { ...item.listings, [platformId]: { listedAt: now, renewedAt: null, removedAt: null, url: url.trim() || was?.url || '' } };
  if (item.status === 'tolist') item.status = 'listed';
  log(item, `Posted on ${platformName(platformId)}`, now);
  return item;
}

export function renewListing(item, platformId, now = Date.now()) {
  const l = item.listings?.[platformId];
  if (!l) return item;
  item.listings = { ...item.listings, [platformId]: { ...l, renewedAt: now } };
  log(item, `Renewed on ${platformName(platformId)}`, now);
  return item;
}

export function takeDown(item, platformId, now = Date.now()) {
  const l = item.listings?.[platformId];
  if (!l || l.removedAt) return item;
  item.listings = { ...item.listings, [platformId]: { ...l, removedAt: now } };
  if (item.status === 'listed' && !activeListings(item).length) item.status = 'tolist';
  log(item, item.status === 'sold' ? `Marked sold on ${platformName(platformId)}` : `Took it down from ${platformName(platformId)}`, now);
  return item;
}

export function setPrice(item, price, now = Date.now()) {
  const before = item.price;
  item.price = price;
  item.updatedAt = now;
  if (before !== null && before !== undefined && price !== null && price !== before) {
    log(item, `Price ${money(before)} → ${money(price)}`, now);
    if (activeListings(item).length) item.priceChangedAt = now;
  }
  return item;
}

export function setPending(item, info, now = Date.now()) {
  const first = item.status !== 'pending';
  item.pending = { ...info, at: item.pending?.at || now };
  item.status = 'pending';
  const who = info.buyer ? ` with ${info.buyer}` : '';
  log(item, first ? `Sale pending${who}` : 'Updated the pending sale', now);
  return item;
}

export function fellThrough(item, now = Date.now()) {
  item.pending = null;
  item.status = openStatus(item);
  log(item, 'Sale fell through', now);
  return item;
}

export function markSold(item, sale, now = Date.now()) {
  item.sale = { price: sale.price ?? 0, fees: sale.fees || 0, platform: sale.platform || 'person', date: sale.date || now, buyer: sale.buyer || '' };
  item.status = 'sold';
  item.pending = null;
  log(item, `Sold for ${money(item.sale.price)} on ${platformName(item.sale.platform)}`, now);
  return item;
}

export function undoSale(item, now = Date.now()) {
  item.sale = null;
  item.status = openStatus(item);
  log(item, 'Sale undone', now);
  return item;
}

export function markDone(item, reason, now = Date.now()) {
  item.done = { reason, date: now };
  item.status = 'done';
  item.pending = null;
  log(item, doneLabel(reason), now);
  return item;
}

export function bringBack(item, now = Date.now()) {
  item.done = null;
  item.sale = null;
  item.status = openStatus(item);
  log(item, 'Back in inventory', now);
  return item;
}

// ---------- money ----------

export const profit = (item) => (item.sale ? (item.sale.price || 0) - (item.sale.fees || 0) - (item.cost || 0) : 0);

export function daysToSell(item) {
  if (!item.sale) return null;
  const start = firstListedAt(item) ?? item.createdAt;
  return Math.max(0, Math.round((item.sale.date - start) / DAY));
}

export const soldBetween = (items, from = -Infinity, to = Infinity) => items
  .filter((i) => i.status === 'sold' && i.sale && i.sale.date >= from && i.sale.date < to);

export function summarize(items, from, to) {
  const sold = soldBetween(items, from, to);
  const gross = sold.reduce((n, i) => n + (i.sale.price || 0), 0);
  const spent = sold.reduce((n, i) => n + (i.sale.fees || 0) + (i.cost || 0), 0);
  const days = sold.map(daysToSell).filter((d) => d !== null);
  const byPlatform = {};
  for (const i of sold) {
    const p = i.sale.platform || 'person';
    byPlatform[p] = byPlatform[p] || { count: 0, profit: 0 };
    byPlatform[p].count += 1;
    byPlatform[p].profit += profit(i);
  }
  return {
    count: sold.length,
    gross,
    spent,
    profit: gross - spent,
    avgSale: sold.length ? gross / sold.length : 0,
    avgDays: days.length ? days.reduce((a, b) => a + b, 0) / days.length : null,
    byPlatform,
    sold: sold.sort((a, b) => b.sale.date - a.sale.date),
  };
}

// Profit per calendar month, oldest first, ending with the current month.
export function monthly(items, months = 6, now = Date.now()) {
  const out = [];
  const d = new Date(now);
  for (let k = months - 1; k >= 0; k--) {
    const start = new Date(d.getFullYear(), d.getMonth() - k, 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() - k + 1, 1).getTime();
    const s = summarize(items, start, end);
    out.push({
      start,
      label: new Date(start).toLocaleDateString('en-US', { month: 'short' }),
      profit: s.profit,
      count: s.count,
    });
  }
  return out;
}

export function inventory(items) {
  const open = items.filter((i) => ['tolist', 'listed', 'pending'].includes(i.status));
  return { count: open.length, value: open.reduce((n, i) => n + (Number(i.price) || 0), 0) };
}

// ---------- what needs doing ----------

// Nothing typed, no photo, never posted: safe to clear away when she leaves it.
export const isBlank = (i) => i.status === 'tolist' && !i.photos?.length && !i.title?.trim()
  && (i.price === null || i.price === '') && (i.cost === null || i.cost === '') && !i.floor
  && !i.description?.trim() && !i.notes?.trim() && !i.foundWhere?.trim() && !i.storedAt?.trim()
  && !i.category && !i.condition && !Object.keys(i.listings || {}).length;

export const needsDetails =(i) => i.status === 'tolist' && (!i.title?.trim() || i.price === null || i.price === '' || !i.photos?.length);
export const readyToPost = (i) => i.status === 'tolist' && !needsDetails(i);
export const isStale = (i, staleDays = 14, now = Date.now()) => i.status === 'listed'
  && freshAt(i) !== null && daysSince(freshAt(i), now) >= staleDays;

export function todo(items, settings = {}, now = Date.now()) {
  const staleDays = Number(settings.staleDays) || 14;
  const pickups = items
    .filter((i) => i.status === 'pending')
    .sort((a, b) => (a.pending?.when || '9').localeCompare(b.pending?.when || '9'));
  return {
    needs: items.filter(needsDetails),
    ready: items.filter(readyToPost),
    stale: items.filter((i) => isStale(i, staleDays, now)),
    pickups,
    // Sold, but still showing on another site: buyers will keep messaging.
    cleanup: items.filter((i) => i.status === 'sold' && activeListings(i).length),
  };
}

// A few easy price drops: 10% and 20% off, rounded to a friendly number.
export function priceDrops(price) {
  const p = Number(price);
  if (!p || p < 2) return [];
  // Rounded by the size of the original price, so $120 suggests $110 and $95 rather than $96.
  const round = (v) => (p >= 100 ? Math.round(v / 5) * 5 : p >= 20 ? Math.round(v) : Math.round(v * 2) / 2);
  const out = [];
  for (const pct of [0.1, 0.2]) {
    const v = round(p * (1 - pct));
    if (v < p && v > 0 && !out.includes(v)) out.push(v);
  }
  return out;
}

export function listedSummary(item, now = Date.now()) {
  const active = activeListings(item);
  if (!active.length) return '';
  const days = daysSince(Math.min(...active.map((l) => l.listedAt)), now);
  const age = days === 0 ? 'today' : plural(days, 'day');
  return `${active.map((l) => platformName(l.platform)).join(', ')} · ${age}`;
}

// ---------- spreadsheet ----------

export function toCsv(items) {
  const head = ['Title', 'Status', 'Category', 'Condition', 'Asking price', "Lowest I'd take", 'Spent on it',
    'Sold for', 'Fees', 'Profit', 'Sold on', 'Sale date', 'Days to sell', 'Buyer', 'Posted on',
    'Found on', 'Found where', 'Stored at', 'Notes', 'Description'];
  const rows = [...items].sort((a, b) => a.createdAt - b.createdAt).map((i) => [
    i.title,
    i.status === 'done' ? doneLabel(i.done?.reason) : STATUSES[i.status]?.label,
    i.category,
    conditionLabel(i.condition),
    i.price ?? '',
    i.floor ?? '',
    i.cost ?? '',
    i.sale?.price ?? '',
    i.sale ? i.sale.fees || 0 : '',
    i.sale ? profit(i) : '',
    i.sale ? platformName(i.sale.platform) : '',
    i.sale ? isoDay(i.sale.date) : '',
    daysToSell(i) ?? '',
    i.sale?.buyer || i.pending?.buyer || '',
    Object.entries(i.listings || {}).filter(([, l]) => l?.listedAt).map(([p]) => platformName(p)).join('; '),
    isoDay(i.foundOn || i.createdAt),
    i.foundWhere,
    i.storedAt,
    i.notes,
    i.description,
  ]);
  // The BOM makes Excel read accents and emoji correctly.
  return `﻿${[head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
