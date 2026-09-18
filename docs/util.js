// Small helpers shared by every screen. No DOM access here, so these can be tested in Node.

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export const uid = () => (globalThis.crypto?.randomUUID
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

const wholeDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const withCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function money(value) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '';
  const n = Number(value);
  return Number.isInteger(n) ? wholeDollars.format(n) : withCents.format(n);
}

// "$45", "45.50", "1,200" -> number. Anything without a number -> null.
export function parseMoney(text) {
  if (text === null || text === undefined) return null;
  if (typeof text === 'number') return Number.isFinite(text) ? Math.round(text * 100) / 100 : null;
  const match = String(text).replace(/[,\s]/g, '').match(/\d+(\.\d+)?/);
  return match ? Math.round(parseFloat(match[0]) * 100) / 100 : null;
}

// Plain number for an input box: 45, 45.5 -> "45", "45.50".
export const moneyInput = (value) => (value === null || value === undefined || value === ''
  ? ''
  : (Number.isInteger(Number(value)) ? String(value) : Number(value).toFixed(2)));

export const DAY = 86400000;

export function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const daysSince = (t, now = Date.now()) => Math.round((startOfDay(now) - startOfDay(t)) / DAY);

export function ago(t, now = Date.now()) {
  const d = daysSince(t, now);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.floor(d / 7)} weeks ago`;
  if (d < 365) return `${Math.floor(d / 30)} months ago`;
  const y = Math.floor(d / 365);
  return y === 1 ? 'a year ago' : `${y} years ago`;
}

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export const shortDate = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const longDate = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Local calendar day for <input type="date">.
export function isoDay(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "2026-09-17" -> noon that day, local time (noon keeps it on the right day across DST).
export function fromIsoDay(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime();
}

// Pickup times come from <input type="datetime-local"> ("2026-09-18T14:00").
export function pickupLabel(text, now = Date.now()) {
  if (!text) return '';
  const t = new Date(text);
  if (Number.isNaN(t.getTime())) return text;
  const time = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  const d = Math.round((startOfDay(t) - startOfDay(now)) / DAY);
  if (d === 0) return `today ${time}`;
  if (d === 1) return `tomorrow ${time}`;
  if (d === -1) return `yesterday ${time}`;
  if (d > 1 && d < 7) return `${t.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
  return `${shortDate(t)} ${time}`;
}

export function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
