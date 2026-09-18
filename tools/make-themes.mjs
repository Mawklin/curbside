// Builds docs/themes.css: one colour set per theme, worked out from a handful of key colours.
// Every theme keeps white text; anything the text sits on is darkened until it reads clearly
// (WCAG AA, 4.5:1). tools/check-contrast.mjs then double-checks the result.
//   node tools/make-themes.mjs
import { writeFileSync } from 'node:fs';

// bg / bg2: page gradient ends. glow: the soft light in the top corner. surface: cards.
// accent: light colour for links and highlights. gradA / gradB: button gradient ends.
export const SPECS = {
  // The original look, kept exactly as it was before themes existed.
  curbside: {
    bg: '#221338', bg2: '#3a1650', glow: '#4a1f6b', surface: '#34205a', accent: '#ffa3d4', gradA: '#7a45cf', gradB: '#c43a88',
    exact: {
      'bg-mid': '#2a1545', 'surface-2': '#3e2768', field: '#29174a', sunk: '#2b1a48', line: '#4a3475', 'line-strong': '#654c93',
      solid: '#9a36a0', toast: '#4c2b80', 'accent-soft': '#4e2d7e', 'accent-strong': '#ffcbe8', 'pink-soft': '#532556',
      'warn-soft': '#52234e', muted: '#c9bbe3', 'ink-2': '#ece2fa',
    },
  },
  newyear: { bg: '#0d0f1f', bg2: '#1f1a3a', glow: '#4a3a12', surface: '#1d2140', accent: '#ffd97a', gradA: '#8a6a1f', gradB: '#4a3fb0' },
  mlk: { bg: '#0f1a33', bg2: '#1a2a4d', glow: '#2c3f73', surface: '#1c2c52', accent: '#ffd27a', gradA: '#2f5fb8', gradB: '#8a5a1e' },
  valentines: { bg: '#2a0d1c', bg2: '#4a1030', glow: '#7a1845', surface: '#45142f', accent: '#ffb3cf', gradA: '#c2185b', gradB: '#e0457b' },
  presidents: { bg: '#0d1733', bg2: '#1a2350', glow: '#2b3a7a', surface: '#1b2a55', accent: '#ffa8b4', gradA: '#b3243a', gradB: '#2a4fb0' },
  stpatricks: { bg: '#0b2016', bg2: '#123826', glow: '#23663f', surface: '#173a28', accent: '#a6f2c0', gradA: '#1f8a4c', gradB: '#9a7410' },
  easter: { bg: '#1e1838', bg2: '#262650', glow: '#3f3a80', surface: '#2e2757', accent: '#ffeaa0', gradA: '#7b5cd6', gradB: '#d65c8f' },
  mothersday: { bg: '#2a1020', bg2: '#3d1832', glow: '#6a2a4a', surface: '#42193a', accent: '#ffc2d9', gradA: '#c2417a', gradB: '#d0643c' },
  memorial: { bg: '#0c1428', bg2: '#16213f', glow: '#4a1622', surface: '#19264a', accent: '#ffb4b4', gradA: '#a3202e', gradB: '#243f8f' },
  fathersday: { bg: '#0c1a26', bg2: '#13293a', glow: '#1f4a68', surface: '#183247', accent: '#a6dcff', gradA: '#1f6fa8', gradB: '#2f8a6e' },
  juneteenth: { bg: '#1a0d0d', bg2: '#26140e', glow: '#5a1c12', surface: '#2e1a16', accent: '#ffd36b', gradA: '#b3261e', gradB: '#1f7a3d' },
  july4: { bg: '#0a1330', bg2: '#1a1540', glow: '#4a1232', surface: '#16224d', accent: '#a6ccff', gradA: '#c4213a', gradB: '#2b4fc9' },
  laborday: { bg: '#1f1410', bg2: '#2e1d12', glow: '#6a3812', surface: '#33221a', accent: '#ffc27a', gradA: '#c4541e', gradB: '#b0305a' },
  halloween: { bg: '#150c1c', bg2: '#221028', glow: '#5a2a0e', surface: '#25152e', accent: '#ffae5c', gradA: '#d0561a', gradB: '#6b2fa8' },
  veterans: { bg: '#10160f', bg2: '#1a2418', glow: '#34452a', surface: '#222e1f', accent: '#f2d27a', gradA: '#56692e', gradB: '#2a3f7a' },
  thanksgiving: { bg: '#1c120b', bg2: '#2b1a0f', glow: '#6a3410', surface: '#332114', accent: '#ffc07a', gradA: '#b5541b', gradB: '#8a3a1a' },
  hanukkah: { bg: '#0b1633', bg2: '#13224a', glow: '#2a4590', surface: '#172a55', accent: '#c4dcff', gradA: '#2f63d1', gradB: '#5a7bb8' },
  christmas: { bg: '#0b1a12', bg2: '#0f2419', glow: '#4a1218', surface: '#16301f', accent: '#ffd27a', gradA: '#c0283a', gradB: '#1f7a45' },
  kwanzaa: { bg: '#0f140c', bg2: '#1a1a10', glow: '#4a1a10', surface: '#1f2a1a', accent: '#b8f0a0', gradA: '#1f7a3d', gradB: '#b3261e' },
};

// ---------- colour maths ----------

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const lum = (c) => {
  const [r, g, b] = hex(c).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
// Darken c (towards `to`) until `text` on it reaches `min`.
const darkenFor = (c, text, min, to = '#000000') => {
  let out = c;
  for (let i = 0; i < 40 && contrast(text, out) < min; i++) out = mix(out, to, 0.06);
  return out;
};
// Lighten a text colour until it reaches `min` on every background given.
const lightenFor = (c, backs, min) => {
  let out = c;
  for (let i = 0; i < 40 && backs.some((b) => contrast(out, b) < min); i++) out = mix(out, '#ffffff', 0.08);
  return out;
};

const WHITE = '#ffffff';
const STATUS = ['#bcc8ff', '#d9c0ff', '#ffd290', '#ffadd9'];

export function build(spec) {
  const surface = darkenFor(spec.surface, WHITE, 11);
  const bg = darkenFor(spec.bg, WHITE, 13);
  const bg2 = darkenFor(spec.bg2, WHITE, 11);
  const surface2 = darkenFor(mix(surface, WHITE, 0.06), WHITE, 9);
  const t = {
    bg,
    'bg-2': bg2,
    'bg-mid': mix(bg, bg2, 0.45),
    glow: spec.glow,
    surface,
    'surface-2': surface2,
    field: mix(surface, bg, 0.55),
    sunk: mix(surface, bg, 0.7),
    line: mix(surface, WHITE, 0.12),
    'line-strong': mix(surface, WHITE, 0.24),
    'grad-a': darkenFor(spec.gradA, WHITE, 4.8),
    'grad-b': darkenFor(spec.gradB, WHITE, 4.8),
  };
  t.solid = darkenFor(mix(t['grad-a'], t['grad-b'], 0.5), WHITE, 5.2);
  t.toast = darkenFor(mix(surface, t['grad-a'], 0.45), WHITE, 8);
  t['accent-soft'] = darkenFor(mix(surface, t['grad-a'], 0.35), WHITE, 7.5, bg);
  t.accent = lightenFor(spec.accent, [surface, surface2, bg, bg2, t.field], 6);
  t['accent-strong'] = lightenFor(mix(t.accent, WHITE, 0.5), [t['accent-soft']], 6);
  t['pink-soft'] = darkenFor(mix(surface, '#ff6fa8', 0.14), WHITE, 8, bg);
  t['warn-soft'] = t['pink-soft'];
  t.warn = lightenFor('#ffb3cb', [surface, t['warn-soft']], 6);
  // Hints: a soft tint of the card colour, only as light as it needs to be to read well.
  t.muted = lightenFor(mix(mix(WHITE, spec.accent, 0.15), surface, 0.32), [surface, surface2, t.field, bg, bg2], 5.2);
  t['ink-2'] = mix(WHITE, spec.accent, 0.1);
  return { ...t, ...(spec.exact || {}) };
}

// Status labels are fixed pastels; make sure every theme's cards are dark enough for them.
function checkStatus(id, t) {
  for (const s of STATUS) if (contrast(s, t['surface-2']) < 4.5) throw new Error(`${id}: status colour ${s} too faint on ${t['surface-2']}`);
}

if (process.argv[1]?.endsWith('make-themes.mjs')) {
  const blocks = Object.entries(SPECS).map(([id, spec]) => {
    const t = build(spec);
    checkStatus(id, t);
    return `[data-theme="${id}"] {\n${Object.entries(t).map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}`;
  });
  const css = `/* Generated by tools/make-themes.mjs. Edit the key colours there, not here. */\n\n${blocks.join('\n\n')}\n`;
  writeFileSync(new URL('../docs/themes.css', import.meta.url), css);
  console.log(`wrote ${blocks.length} themes to docs/themes.css`);
}
