// Draws the Curbside icon (a white price tag with a pink sparkle on purple-to-pink) and writes the PNG sizes the app needs.
// Uses sharp from the Lessons app's worker folder, since this project has no node_modules.
//   node tools/make-icons.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire('file:///D:/Epic%20Games/lesson-notes/worker/package.json');
const sharp = require('sharp');

const OUT = new URL('../docs/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// scale < 1 shrinks the artwork toward the centre (maskable icons get cropped to a circle).
const art = (scale, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#8c5ad8"/><stop offset="1" stop-color="#d0488f"/>
    </linearGradient>
    <linearGradient id="tag" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f3eafc"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#bg)"/>
  <g transform="translate(256 262) scale(${scale}) rotate(-32)">
    <path d="M-168 0 L-98 -86 H118 Q148 -86 148 -56 V56 Q148 86 118 86 H-98 Z"
      fill="#3d1560" opacity="0.28" transform="translate(10 14)"/>
    <path d="M-168 0 L-98 -86 H118 Q148 -86 148 -56 V56 Q148 86 118 86 H-98 Z"
      fill="url(#tag)" stroke="#ffffff" stroke-width="18" stroke-linejoin="round"/>
    <circle cx="-92" cy="0" r="21" fill="#7446c2"/>
    <path d="M-10 -34 H92 M-10 0 H70 M-10 34 H92" stroke="#7446c2" stroke-width="16" stroke-linecap="round" opacity="0.9"/>
  </g>
  <g transform="translate(372 136) scale(${scale})">
    <path d="M0 -58 L14 -14 L58 0 L14 14 L0 58 L-14 14 L-58 0 L-14 -14 Z" fill="#ffd6ea"/>
  </g>
</svg>`;

const write = (svg, size, name) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(fileURLToPath(new URL(name, OUT)));

await write(art(1, true), 192, 'icon-192.png');
await write(art(1, true), 512, 'icon-512.png');
await write(art(0.78, false), 512, 'icon-maskable.png');
await write(art(1, false), 180, 'apple-touch-icon.png'); // iPhone rounds the corners itself
await write(art(1, true), 64, 'favicon-64.png');
console.log('icons written');
