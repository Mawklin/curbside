// Phone photos are huge (12+ megapixels). Each one is shrunk to a sharp-enough listing photo
// plus a small thumbnail before it's stored, which keeps the app fast and the phone from filling up.
import { get } from './db.js';
import { uid } from './util.js';

const FULL = 1600; // plenty for Marketplace/OfferUp, which shrink photos further anyway
const THUMB = 480;

async function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img; // <img> applies the camera's rotation (EXIF) for us
  } catch {
    throw new Error("Couldn't read that photo. Try taking it again, or pick a different one.");
  } finally {
    // Safe: once decoded, the image keeps its pixels.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function draw(img, max, turn = 0) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const scale = Math.min(1, max / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const sideways = turn % 180 !== 0;
  const canvas = document.createElement('canvas');
  canvas.width = sideways ? h : w;
  canvas.height = sideways ? w : h;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.translate(canvas.width / 2, canvas.height / 2);
  g.rotate((turn * Math.PI) / 180);
  g.drawImage(img, -w / 2, -h / 2, w, h);
  return canvas;
}

const toJpeg = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    // Let iOS reclaim the canvas memory straight away.
    canvas.width = 0;
    canvas.height = 0;
    if (blob) resolve(blob);
    else reject(new Error("Couldn't save that photo. Your phone may be low on memory."));
  }, 'image/jpeg', quality);
});

export async function makePhoto(file, itemId) {
  const img = await loadImage(file);
  const full = draw(img, FULL);
  const size = { w: full.width, h: full.height };
  return {
    id: uid(),
    itemId,
    at: Date.now(),
    ...size,
    full: await toJpeg(full, 0.85),
    thumb: await toJpeg(draw(img, THUMB), 0.8),
  };
}

export async function rotated(photo) {
  const img = await loadImage(photo.full);
  const full = draw(img, FULL, 90);
  const size = { w: full.width, h: full.height };
  return {
    ...photo,
    ...size,
    full: await toJpeg(full, 0.88),
    thumb: await toJpeg(draw(img, THUMB, 90), 0.8),
  };
}

// Smaller copy for sending to an AI: quicker upload, and still plenty to recognise the item.
export async function smallJpeg(blob, max = 1024) {
  const img = await loadImage(blob);
  return toJpeg(draw(img, max), 0.8);
}

export function base64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ---------- blob: URLs for <img>, cached so each photo is only read once ----------

const urls = new Map(); // `${id}:thumb|full` -> blob: URL

export const thumbUrl = (id) => urls.get(`${id}:thumb`) || '';
export const fullUrl = (id) => urls.get(`${id}:full`) || urls.get(`${id}:thumb`) || '';

export async function loadUrls(ids, kind = 'thumb') {
  const missing = ids.filter((id) => id && !urls.has(`${id}:${kind}`));
  await Promise.all(missing.map(async (id) => {
    const photo = await get('photos', id);
    if (photo?.[kind]) urls.set(`${id}:${kind}`, URL.createObjectURL(photo[kind]));
  }));
}

export function rememberUrls(photo) {
  forgetUrls([photo.id]);
  urls.set(`${photo.id}:thumb`, URL.createObjectURL(photo.thumb));
  urls.set(`${photo.id}:full`, URL.createObjectURL(photo.full));
}

export function forgetUrls(ids) {
  for (const id of ids) {
    for (const kind of ['thumb', 'full']) {
      const url = urls.get(`${id}:${kind}`);
      if (url) URL.revokeObjectURL(url);
      urls.delete(`${id}:${kind}`);
    }
  }
}

// Full-size photos as Files, ready to hand to the share sheet or save.
export async function photoFiles(item) {
  const files = [];
  const base = (item.title || 'trash2treasure').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).toLowerCase() || 'trash2treasure';
  for (const [n, id] of item.photos.entries()) {
    const photo = await get('photos', id);
    if (photo?.full) files.push(new File([photo.full], `${base}-${n + 1}.jpg`, { type: 'image/jpeg' }));
  }
  return files;
}
