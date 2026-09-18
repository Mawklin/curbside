// Pickup reminders. Two routes, because iPhone Home Screen apps can't reliably hand a calendar
// file to Apple Calendar: a Google Calendar link (works everywhere) and a standard .ics file
// (Android, computers, and iPhone when it cooperates).
import { money } from './util.js';

const pad = (n) => String(n).padStart(2, '0');

export const utcStamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
  + `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export function pickupEvent(item, settings = {}) {
  const p = item.pending;
  if (!p?.when) return null;
  const start = new Date(p.when); // "2026-09-20T14:00" from the form = her local time
  if (Number.isNaN(start.getTime())) return null;
  const name = item.title?.trim() || 'Curbside item';
  return {
    uid: `${item.id}-${p.at || 0}@curbside`,
    title: `Pickup: ${name}${p.buyer ? ` (${p.buyer})` : ''}`,
    details: [
      p.buyer && `Buyer: ${p.buyer}`,
      p.price !== null && p.price !== undefined && p.price !== '' && `Agreed price: ${money(p.price)}`,
      p.note && `Note: ${p.note}`,
      'From Curbside',
    ].filter(Boolean).join('\n'),
    location: settings.pickupArea?.trim() || '',
    start,
    end: new Date(start.getTime() + 30 * 60000),
  };
}

export function googleCalendarUrl(ev) {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${utcStamp(ev.start)}/${utcStamp(ev.end)}`,
    details: ev.details,
  });
  if (ev.location) q.set('location', ev.location);
  return `https://calendar.google.com/calendar/render?${q}`;
}

// RFC 5545 text escaping, and folding of long lines.
const icsText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

export function icsFile(ev, now = new Date()) {
  return `${[
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Curbside//Pickup//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(ev.start)}`,
    `DTEND:${utcStamp(ev.end)}`,
    `SUMMARY:${icsText(ev.title)}`,
    `DESCRIPTION:${icsText(ev.details)}`,
    ev.location && `LOCATION:${icsText(ev.location)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(ev.title)}`,
    'TRIGGER:-PT30M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).map(fold).join('\r\n')}\r\n`;
}
