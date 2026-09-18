// Reads the colour tokens out of docs/styles.css and checks every text/background pair the app
// uses against WCAG AA (4.5:1 for normal text). Run after any colour change:
//   node tools/check-contrast.mjs
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../docs/styles.css', import.meta.url), 'utf8');

const t = { white: '#ffffff' };
const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
for (const m of root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) t[m[1]] = m[2];

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [text token, background token, what it is]
const PAIRS = [
  ['ink', 'bg', 'body text, top of page'], ['ink', 'bg-2', 'body text, bottom of page'],
  ['ink', 'surface', 'card text'], ['ink', 'surface-2', 'pop-up text'], ['ink', 'field', 'typed text'],
  ['ink-2', 'surface', 'secondary text'], ['ink-2', 'bg', 'secondary text on page'],
  ['muted', 'bg', 'hints on page'], ['muted', 'bg-2', 'hints, bottom of page'], ['muted', 'surface', 'hints on cards'],
  ['muted', 'surface-2', 'hints in pop-ups'], ['muted', 'field', 'placeholders'],
  ['accent', 'surface', 'links, active tab'], ['accent', 'bg', 'links on page'], ['accent', 'surface-2', 'links in pop-ups'],
  ['accent', 'field', 'reply copy label'], ['accent-strong', 'accent-soft', 'AI button, pills'],
  ['ink', 'accent-soft', 'picked site, notices'], ['ink-2', 'accent-soft', 'install tip text'],
  ['warn', 'surface', 'warnings on cards'], ['warn', 'warn-soft', 'stale box'], ['ink', 'warn-soft', 'stale box text'],
  ['ink-2', 'pink-soft', 'backup reminder text'], ['danger', 'surface', 'delete buttons'],
  ['s-tolist', 'surface', 'to-do label'], ['s-pending', 'surface', 'pickup label'],
  ['s-listed', 'surface', 'status text'], ['s-sold', 'surface', 'status text'],
  ['white', 'grad-a', 'buttons, purple end'], ['white', 'grad-b', 'buttons, pink end'],
  ['white', 'solid', 'ticks, copied, cover tag'], ['white', 'toast', 'pop-up messages'],
];
// Status badges on photos are fixed colours with white text.
const FIXED = [...css.matchAll(/\.badge-(\w+) \{ background: (#[0-9a-f]{6}); \}/g)].map((m) => [`badge ${m[1]}`, m[2]]);

let failed = 0;
function checkPairs(name, tokens, verbose) {
  let worst = Infinity;
  for (const [fg, bg, what] of PAIRS) {
    if (!tokens[fg] || !tokens[bg]) {
      console.log(`MISSING ${name}: ${fg} or ${bg}`);
      failed++;
      continue;
    }
    const r = ratio(tokens[fg], tokens[bg]);
    worst = Math.min(worst, r);
    if (r < 4.5) failed++;
    if (verbose || r < 4.5) console.log(`${r >= 4.5 ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}  ${name}: ${fg} on ${bg} (${what})`);
  }
  return worst;
}
checkPairs('default', t, true);

// Every holiday theme in docs/themes.css, layered over the defaults like the browser does.
const themes = readFileSync(new URL('../docs/themes.css', import.meta.url), 'utf8');
for (const m of themes.matchAll(/\[data-theme="([\w-]+)"\] \{([^}]*)\}/g)) {
  const tokens = { ...t };
  for (const v of m[2].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[v[1]] = v[2];
  const worst = checkPairs(m[1], tokens, false);
  console.log(`${worst >= 4.5 ? 'ok  ' : 'FAIL'} theme ${m[1].padEnd(13)} lowest pair ${worst.toFixed(2)}`);
}
for (const [name, bg] of FIXED) {
  const r = ratio('#ffffff', bg);
  if (r < 4.5) failed++;
  console.log(`${r >= 4.5 ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}  white on ${name} ${bg}`);
}
console.log(failed ? `\n${failed} pair(s) below 4.5:1` : '\nAll pairs pass WCAG AA (4.5:1).');
process.exitCode = failed ? 1 : 0;
