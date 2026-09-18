// App themes: the original purple plus one for each major American holiday. Colours live in
// themes.css (made by tools/make-themes.mjs); this file has the names, the little pictures
// (emoji, so they look right on every phone) and the dates for Automatic. Hanukkah, Kwanzaa and
// Juneteenth were taken out on 2026-09-18 at Eli's request.

const DAY = 86400000;
const at = (y, m, d) => new Date(y, m - 1, d, 12).getTime(); // noon, so DST never moves the day

// nth weekday of a month (weekday 0 = Sunday); n = -1 for the last one.
function nthWeekday(y, m, weekday, n) {
  if (n > 0) {
    const first = new Date(y, m - 1, 1).getDay();
    return at(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDay = new Date(y, m, 0).getDate();
  const last = new Date(y, m - 1, lastDay).getDay();
  return at(y, m, lastDay - ((last - weekday + 7) % 7));
}

// Easter Sunday (Western), by the anonymous Gregorian algorithm.
export function easter(y) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return at(y, month, day);
}

// lead: days before the holiday the theme starts; linger: days it stays after.
export const THEMES = [
  { id: 'curbside', name: 'Original', when: 'Purple and pink', emoji: [], icon: ['💜', '🏷️', '✨'] },
  { id: 'newyear', name: "New Year's", when: 'Jan 1', emoji: ['🎆', '🥂', '🎉', '✨', '🎊'], date: (y) => at(y, 1, 1), lead: 5, linger: 2 },
  { id: 'mlk', name: 'MLK Day', when: '3rd Mon in Jan', emoji: ['🕊️', '🤝', '💙', '✨'], date: (y) => nthWeekday(y, 1, 1, 3), lead: 6, linger: 0 },
  { id: 'valentines', name: "Valentine's Day", when: 'Feb 14', emoji: ['💕', '💌', '🌹', '💘', '🍫'], date: (y) => at(y, 2, 14), lead: 13, linger: 0 },
  { id: 'presidents', name: "Presidents' Day", when: '3rd Mon in Feb', emoji: ['🎩', '⭐', '🇺🇸', '🦅'], date: (y) => nthWeekday(y, 2, 1, 3), lead: 5, linger: 0 },
  { id: 'stpatricks', name: "St. Patrick's Day", when: 'Mar 17', emoji: ['☘️', '🌈', '🪙', '🍀'], date: (y) => at(y, 3, 17), lead: 16, linger: 0 },
  { id: 'easter', name: 'Easter', when: 'Spring Sunday', emoji: ['🐰', '🥚', '🐣', '🌷', '🧺'], date: easter, lead: 13, linger: 1 },
  { id: 'mothersday', name: "Mother's Day", when: '2nd Sun in May', emoji: ['💐', '🌸', '💗', '🌷'], date: (y) => nthWeekday(y, 5, 0, 2), lead: 7, linger: 0 },
  { id: 'memorial', name: 'Memorial Day', when: 'Last Mon in May', emoji: ['⭐', '🕊️', '🇺🇸', '🎗️'], date: (y) => nthWeekday(y, 5, 1, -1), lead: 6, linger: 0 },
  { id: 'fathersday', name: "Father's Day", when: '3rd Sun in June', emoji: ['👔', '🎣', '🛠️', '⭐'], date: (y) => nthWeekday(y, 6, 0, 3), lead: 6, linger: 0 },
  { id: 'july4', name: 'Fourth of July', when: 'July 4', emoji: ['🎆', '🇺🇸', '🎇', '⭐', '🌭'], date: (y) => at(y, 7, 4), lead: 10, linger: 1 },
  { id: 'laborday', name: 'Labor Day', when: '1st Mon in Sep', emoji: ['☀️', '🕶️', '🌭', '🏖️'], date: (y) => nthWeekday(y, 9, 1, 1), lead: 6, linger: 0 },
  { id: 'halloween', name: 'Halloween', when: 'Oct 31', emoji: ['🎃', '👻', '🦇', '🕸️', '🍬'], date: (y) => at(y, 10, 31), lead: 30, linger: 0 },
  { id: 'veterans', name: 'Veterans Day', when: 'Nov 11', emoji: ['🎖️', '⭐', '🇺🇸', '🦅'], date: (y) => at(y, 11, 11), lead: 6, linger: 0 },
  { id: 'thanksgiving', name: 'Thanksgiving', when: '4th Thu in Nov', emoji: ['🦃', '🍂', '🥧', '🌽', '🍁'], date: (y) => nthWeekday(y, 11, 4, 4), lead: 10, linger: 1 },
  { id: 'christmas', name: 'Christmas', when: 'Dec 25', emoji: ['🎄', '🎁', '❄️', '⛄', '🍪'], date: (y) => at(y, 12, 25), lead: 24, linger: 1 },
];

export const AUTO = 'auto';
export const theme = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

// Which holiday it is (or is coming up) on a given day, for Automatic. A holiday that's
// already started wins; otherwise the nearest one. Between holidays: the original purple.
export function holidayOn(now = Date.now()) {
  const today = new Date(now);
  const day = at(today.getFullYear(), today.getMonth() + 1, today.getDate());
  let best = null;
  for (const t of THEMES) {
    if (!t.date) continue;
    for (const y of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
      const date = t.date(y);
      if (date === null) continue;
      const until = Math.round((date - day) / DAY);
      if (until > t.lead || until < -t.linger) continue;
      const score = Math.max(0, until);
      if (!best || score < best.score || (score === best.score && date > best.date)) best = { id: t.id, score, date };
    }
  }
  return best ? best.id : 'curbside';
}

export const resolveTheme = (choice, now = Date.now()) => (choice === AUTO ? holidayOn(now) : theme(choice).id);
