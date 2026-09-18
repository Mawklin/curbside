// Reads the colour tokens out of docs/styles.css and checks every text/background pair the app
// uses against WCAG AA (4.5:1 for normal text). Run after any colour change:
//   node tools/check-contrast.mjs
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../docs/styles.css', import.meta.url), 'utf8');

function tokens(block) {
  const out = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}
const light = { white: '#ffffff', ...tokens(css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)'))) };
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const dark = { ...light, ...tokens(css.slice(darkStart, css.indexOf('* { box-sizing'))) };

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
  ['ink', 'bg', 'body text'], ['ink', 'surface', 'card text'], ['ink-2', 'surface', 'secondary text'],
  ['ink-2', 'bg', 'secondary text on page'], ['muted', 'bg', 'hints on page'], ['muted', 'surface', 'hints on cards'],
  ['muted', 'field', 'placeholders'], ['accent', 'surface', 'links, active tab'], ['accent', 'bg', 'links on page'],
  ['accent-ink', 'accent', 'primary button'], ['accent-strong', 'accent-soft', 'AI button, pills'],
  ['ink-2', 'accent-soft', 'install tip text'], ['warn', 'surface', 'warnings on cards'], ['warn', 'warn-soft', 'stale box'],
  ['ink-2', 'warn-soft', 'backup reminder text'], ['ink', 'warn-soft', 'stale box text'], ['danger', 'surface', 'delete buttons'],
  ['s-tolist', 'surface', 'to-do label'], ['s-pending', 'surface', 'pickup label'], ['s-listed', 'surface', 'status text'],
  ['s-sold', 'surface', 'status text'], ['white', 'grad-a', 'logo/camera icon, purple end'],
  ['white', 'grad-b', 'logo/camera icon, pink end'],
];
// Badges and the price tag are fixed colours with white text in both modes.
const FIXED = [...css.matchAll(/\.badge-(\w+) \{ background: (#[0-9a-f]{6}); \}/g)].map((m) => [`badge ${m[1]}`, m[2]]);

let failed = 0;
for (const [mode, t] of [['light', light], ['dark', dark]]) {
  console.log(`\n${mode}`);
  for (const [fg, bg, what] of PAIRS) {
    if (!t[fg] || !t[bg]) continue;
    const r = ratio(t[fg], t[bg]);
    const ok = r >= 4.5;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}  ${fg} on ${bg} (${what})`);
  }
}
console.log('\nbadges (white text)');
for (const [name, bg] of FIXED) {
  const r = ratio('#ffffff', bg);
  if (r < 4.5) failed++;
  console.log(`${r >= 4.5 ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}  ${name} ${bg}`);
}
console.log(failed ? `\n${failed} pair(s) below 4.5:1` : '\nAll pairs pass WCAG AA (4.5:1).');
process.exitCode = failed ? 1 : 0;
