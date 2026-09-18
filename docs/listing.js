// What goes into a listing: categories, conditions, the finished description, and reading an
// AI's answer back into those fields. No DOM here, so it can be tested in Node.
import { platform } from './platforms.js';
import { money, parseMoney } from './util.js';

export const CATEGORIES = [
  'Furniture',
  'Home & Kitchen',
  'Appliances',
  'Home Decor & Art',
  'Garden & Outdoor',
  'Tools & Garage',
  'Electronics',
  'Toys & Games',
  'Baby & Kids',
  'Sports & Fitness',
  'Bikes',
  'Clothing & Shoes',
  'Bags & Accessories',
  'Books, Movies & Music',
  'Musical Instruments',
  'Auto Parts',
  'Antiques & Collectibles',
  'Pet Supplies',
  'Office',
  'Other',
];

export const CONDITIONS = [
  { id: 'new', label: 'New' },
  { id: 'likenew', label: 'Like new' },
  { id: 'good', label: 'Good' },
  { id: 'fair', label: 'Fair' },
  { id: 'parts', label: 'Needs work / for parts' },
];

export const conditionLabel = (id) => CONDITIONS.find((c) => c.id === id)?.label || '';

// The wording to pick on a given site, when that site has its own list.
export const conditionFor = (platformId, id) => platform(platformId)?.conditions?.[id] || conditionLabel(id);

export function titleWarning(title, platformId) {
  const max = platform(platformId)?.titleMax;
  if (!max || !title || title.length <= max) return '';
  return `${platform(platformId).short} allows ${max} characters; this is ${title.length}.`;
}

// The description as it should be pasted on one site. Local sites get her pickup line;
// ship-only sites don't, since "pickup only" would be wrong there.
export function buildDescription(item, platformId, settings = {}) {
  const parts = [];
  const body = (item.description || '').trim();
  if (body) parts.push(body);
  const lines = [];
  if (settings.addCondition !== false && item.condition) {
    lines.push(`Condition: ${conditionLabel(item.condition)}`);
  }
  const local = platform(platformId)?.local !== false;
  if (local && settings.pickupArea?.trim()) lines.push(`Pickup: ${settings.pickupArea.trim()}`);
  if (lines.length) parts.push(lines.join('\n'));
  if (local && settings.footer?.trim()) parts.push(settings.footer.trim());
  return parts.join('\n\n');
}

export function copyAllText(item, platformId, settings) {
  return [
    item.title?.trim(),
    item.price !== null && item.price !== undefined && item.price !== '' ? money(item.price) : '',
    buildDescription(item, platformId, settings),
  ].filter(Boolean).join('\n\n');
}

// For sharing with Messages, a Facebook group, etc.
export const shareText = (item, settings) => copyAllText(item, 'facebook', settings);

// ---------- AI help ----------

const CONDITION_WORDS = CONDITIONS.map((c) => c.label).join(', ');

export const AI_RULES = `You help someone who picks up free things (curbside finds, giveaways, yard sales) and resells them locally on Facebook Marketplace, OfferUp and Craigslist.
Look at the photos and write the listing.
- Title: what a buyer would search for. Brand and model only if you can see them or the seller said so. Item type, then key details like material, size or color. At most 70 characters. No emojis, no ALL CAPS, no "L@@K".
- Price: a realistic asking price in whole US dollars for a quick local sale of a used item, usually well under retail. Also give a low-high range similar used ones sell for.
- Category: exactly one of: ${CATEGORIES.join(', ')}.
- Condition: exactly one of: ${CONDITION_WORDS}. Be honest about wear or damage you can see.
- Description: 2 to 5 short, friendly sentences. What it is, useful details (size, material, what's included), and honest condition. Don't mention pickup, payment or delivery; the seller adds that. No emojis or hashtags.`;

const JSON_SHAPE = `Reply with JSON only, in this shape:
{"what": "plain name of the item", "title": "...", "price": 40, "priceLow": 30, "priceHigh": 60, "priceNote": "one short sentence on the price", "category": "...", "condition": "...", "description": "..."}`;

export const AI_SYSTEM = `${AI_RULES}\n${JSON_SHAPE}`;

// For the free route: she shares the photos plus this text to ChatGPT (or any AI app),
// then pastes the answer back. Labelled lines are easy for her to read and for us to parse.
export function aiSharePrompt(item) {
  return `${AI_RULES}
${sellerNotes(item)}
Reply in exactly this format:
TITLE: ...
PRICE: $...
PRICE RANGE: $... - $...
CATEGORY: ...
CONDITION: ...
DESCRIPTION:
...`;
}

export function sellerNotes(item) {
  const notes = [];
  if (item.title?.trim()) notes.push(`Seller's title so far: ${item.title.trim()}`);
  if (item.condition) notes.push(`Seller says condition is: ${conditionLabel(item.condition)}`);
  if (item.description?.trim()) notes.push(`Seller's notes: ${item.description.trim()}`);
  if (item.notes?.trim()) notes.push(`Private notes (don't quote): ${item.notes.trim()}`);
  return notes.length ? `\n${notes.join('\n')}\n` : '';
}

const LABELS = ['TITLE', 'PRICE RANGE', 'PRICE', 'CATEGORY', 'CONDITION', 'DESCRIPTION', 'WHAT', 'NOTE'];

// Reads either JSON (Gemini) or labelled lines (pasted from ChatGPT). Returns null if it can't
// find at least a title or description.
export function parseAiReply(text) {
  if (!text || typeof text !== 'string') return null;
  const json = tryJson(text);
  if (json) return normalizeSuggestion(json);

  const clean = text.replace(/\r/g, '').replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
  const found = {};
  const labelRe = new RegExp(`^\\s*(${LABELS.join('|')})\\s*[:：-]\\s*(.*)$`, 'i');
  let current = null;
  for (const line of clean.split('\n')) {
    const m = labelRe.exec(line);
    if (m) {
      current = m[1].toUpperCase();
      found[current] = m[2].trim();
    } else if (current === 'DESCRIPTION') {
      found.DESCRIPTION = found.DESCRIPTION ? `${found.DESCRIPTION}\n${line}` : line;
    }
  }
  if (!found.TITLE && !found.DESCRIPTION) return null;
  const range = (found['PRICE RANGE'] || '').match(/\d[\d,]*(\.\d+)?/g) || [];
  return normalizeSuggestion({
    title: found.TITLE,
    price: found.PRICE,
    priceLow: range[0],
    priceHigh: range[1],
    category: found.CATEGORY,
    condition: found.CONDITION,
    description: found.DESCRIPTION,
    what: found.WHAT,
    priceNote: found.NOTE,
  });
}

function tryJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    return obj && typeof obj === 'object' && (obj.title || obj.description) ? obj : null;
  } catch {
    return null;
  }
}

export function matchCategory(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return '';
  const exact = CATEGORIES.find((c) => c.toLowerCase() === t);
  if (exact) return exact;
  const partial = CATEGORIES.find((c) => c.toLowerCase().includes(t) || t.includes(c.toLowerCase()));
  if (partial) return partial;
  // Match on any shared word ("kitchen" -> Home & Kitchen, "tools" -> Tools & Garage).
  const words = t.split(/[^a-z]+/).filter((w) => w.length > 3);
  return CATEGORIES.find((c) => words.some((w) => c.toLowerCase().includes(w))) || 'Other';
}

export function matchCondition(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return '';
  if (/part|repair|broken|needs work|not working/.test(t)) return 'parts';
  if (/like new|excellent|mint|barely/.test(t)) return 'likenew';
  if (/\bnew\b/.test(t)) return 'new';
  if (/fair|worn|used - fair|rough/.test(t)) return 'fair';
  if (/good/.test(t)) return 'good';
  return '';
}

export function normalizeSuggestion(raw) {
  const text = (v) => String(v ?? '').trim();
  const price = parseMoney(raw.price);
  let low = parseMoney(raw.priceLow);
  let high = parseMoney(raw.priceHigh);
  if (low !== null && high !== null && low > high) [low, high] = [high, low];
  const out = {
    what: text(raw.what),
    // Strip quotes only when they wrap the whole title; a trailing " is often inches (26").
    title: text(raw.title).replace(/^(["'])(.*)\1$/, '$2').slice(0, 100),
    price: price !== null ? Math.round(price) : null,
    priceLow: low !== null ? Math.round(low) : null,
    priceHigh: high !== null ? Math.round(high) : null,
    priceNote: text(raw.priceNote),
    category: matchCategory(raw.category),
    condition: matchCondition(raw.condition),
    description: text(raw.description).replace(/\n{3,}/g, '\n\n'),
  };
  if (!out.title && !out.description) return null;
  return out;
}
