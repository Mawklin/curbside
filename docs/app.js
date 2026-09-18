import * as db from './db.js';
import { esc, money, parseMoney, fromIsoDay, isoDay, plural } from './util.js';
import { PLATFORMS, DEFAULT_PLATFORMS, PRICE_CHECKS, platform, platformName } from './platforms.js';
import { buildDescription, copyAllText, shareText, aiSharePrompt, parseAiReply } from './listing.js';
import { quickReplies } from './replies.js';
import { pickupEvent, googleCalendarUrl, icsFile } from './calendar.js';
import {
  newItem, markListed, renewListing, takeDown, setPrice, setPending, fellThrough, markSold, undoSale,
  markDone, bringBack, activeListings, profit, monthly, toCsv, isBlank, isListedOn,
} from './model.js';
import {
  makePhoto, rotated, smallJpeg, base64, loadUrls, rememberUrls, forgetUrls, photoFiles,
} from './photos.js';
import { suggestListing, findKey, CANCELLED, GEMINI_MODELS } from './ai.js';
import { makeZip, readZip } from './zip.js';
import { runTour, stopTour, tourActive, TOURS } from './tour.js';
import { AUTO, resolveTheme, theme } from './themes.js';
import {
  itemsView, gridHtml, chipsHtml, itemView, statusPanel, postPickView, kitView, moneyView, settingsView,
  sheetView, monthChart, monthCaption, ICON, runFor, shotList, shotCount,
} from './views.js';

// Bump together with CACHE in sw.js on every release, or installed phones keep old files.
const VERSION = '1.4.1';

const DEFAULT_SETTINGS = {
  pickupArea: '',
  footer: '',
  addCondition: true,
  staleDays: 14,
  platforms: DEFAULT_PLATFORMS,
  geminiKey: '',
  hideInstall: false,
  tours: {}, // which screens' tours she has seen
  theme: 'curbside', // a theme id, or 'auto' to follow the holidays
};

// Put the last theme on straight away, before the saved settings load, so the colours don't flash.
try {
  const last = localStorage.getItem('curbside-theme');
  if (last) document.documentElement.dataset.theme = last;
} catch { /* storage blocked: the default look shows until settings load */ }

// Tests add ?notour so the walkthrough doesn't cover the screens they're checking.
const noTour = new URLSearchParams(location.search).has('notour');

const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function canShareFiles() {
  try {
    return Boolean(navigator.canShare?.({ files: [new File(['x'], 'x.jpg', { type: 'image/jpeg' })] }));
  } catch {
    return false;
  }
}

const state = {
  version: VERSION,
  items: [],
  settings: { ...DEFAULT_SETTINGS },
  lastBackup: null,
  backupSnooze: 0,
  route: { name: 'items' },
  filter: 'active',
  query: '',
  period: 'month',
  monthPick: null,
  showAllSales: false,
  sheet: null,
  ai: null,
  kit: null,
  pick: null, // sites ticked on the "Post it" page
  pickFor: null,
  run: null, // { itemId, queue: [site ids], at, photosSaved, updatedAt } while posting to several sites
  backupFile: null,
  installEvent: null,
  standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  isIOS,
  canShareFiles: canShareFiles(),
  storage: null,
  persisted: null,
  listScroll: 0,
  themeId: 'curbside', // the theme showing now (Automatic resolves to a holiday)
};

const $ = (sel, root = document) => root.querySelector(sel);
const findItem = (id) => state.items.find((i) => i.id === id);
const currentItem = () => (state.route.id ? findItem(state.route.id) : null);

// ---------- feedback ----------

let toastTimer;
let toastAction = null;
// action: { label, run } adds a button (e.g. Undo) and keeps the message up longer.
function toast(message, bad = false, action = null) {
  const el = $('#toast');
  toastAction = action;
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button class="toast-btn" data-action="toast-action">${esc(action.label)}</button>` : ''}`;
  el.classList.toggle('bad', bad);
  el.classList.toggle('has-action', Boolean(action));
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 8000 : bad ? 4500 : 2600);
}

function hideToast() {
  $('#toast').classList.remove('show', 'has-action');
  toastAction = null;
}

// A quiet "Saved" next to the status after typing, so she knows there's no Save button to find.
let savedTimer;
function showSaved() {
  const el = $('#saved');
  if (!el) return;
  el.innerHTML = `${ICON.check}<span>Saved</span>`;
  el.classList.add('on');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => el.classList.remove('on'), 1600);
}

function setBusy(text) {
  const el = $('#busy');
  el.innerHTML = text ? `<div class="busy-box"><div class="spinner" aria-hidden="true"></div><p>${esc(text)}</p></div>` : '';
  el.classList.toggle('on', Boolean(text));
}

function fail(err) {
  console.error(err);
  setBusy('');
  toast(err?.message || 'Something went wrong. Try again.', true);
}

// ---------- saving ----------

const queued = new Map();

function saveSoon(item) {
  item.updatedAt = Date.now();
  clearTimeout(queued.get(item.id)?.timer);
  queued.set(item.id, { item, timer: setTimeout(() => flush(item.id), 350) });
}

async function flush(id) {
  const q = queued.get(id);
  if (!q) return;
  queued.delete(id);
  clearTimeout(q.timer);
  try {
    await db.saveItem(q.item);
    if (q.item.id === state.route.id) showSaved();
  } catch (err) {
    fail(err);
  }
}

const flushAll = () => Promise.all([...queued.keys()].map(flush));

async function save(item, photos = []) {
  queued.delete(item.id);
  item.updatedAt = Date.now();
  await db.saveItem(item, photos);
}

async function saveSettings() {
  await db.put('meta', state.settings, 'settings');
}

// ---------- navigation ----------
// The app keeps its own copy of the back stack so "Back" and "go to X" can step back through
// real browser history instead of piling up entries (Android's back button then behaves).

const norm = (h) => (!h || h === '#' ? '#/' : h);
const navStack = [norm(location.hash)];
let replacing = false;

function goTo(hash) {
  const h = norm(hash);
  const i = navStack.lastIndexOf(h);
  const top = navStack.length - 1;
  if (i === top) return;
  if (i >= 0) history.go(i - top);
  else location.hash = h;
}

function parentOf(r) {
  if (r.name === 'kit') return `#/item/${r.id}/post`;
  if (r.name === 'post') return `#/item/${r.id}`;
  return '#/';
}

function back() {
  const parent = parentOf(state.route);
  if (navStack.includes(parent)) goTo(parent);
  else {
    replacing = true;
    location.replace(parent);
  }
}

function onHashChange() {
  const h = norm(location.hash);
  if (replacing) {
    navStack[navStack.length - 1] = h;
    replacing = false;
  } else {
    const i = navStack.lastIndexOf(h);
    if (i >= 0 && i < navStack.length - 1) navStack.length = i + 1;
    else if (i !== navStack.length - 1) navStack.push(h);
  }
  route();
}

let routeToken = 0;

async function route() {
  const token = ++routeToken;
  stopTour();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const prev = state.route;
  if (prev.name === 'items') state.listScroll = window.scrollY;
  let r = { name: 'items' };
  if (parts[0] === 'item' && parts[1]) {
    r = { name: parts[2] === 'post' ? (parts[3] ? 'kit' : 'post') : 'item', id: parts[1], platform: parts[3] };
  } else if (parts[0] === 'money') r = { name: 'money' };
  else if (parts[0] === 'settings') r = { name: 'settings' };

  // Tapped "Add without a photo" and then left without typing anything: don't leave an empty card.
  if (prev.id && prev.id !== r.id) {
    const left = findItem(prev.id);
    if (left && isBlank(left)) {
      queued.delete(left.id);
      state.items = state.items.filter((i) => i !== left);
      db.deleteItem(left).catch(console.error);
    }
  }

  state.sheet = null;
  state.ai?.abort?.abort();
  state.ai = null;
  if (prev.name !== r.name) state.showAllSales = false;
  if (r.name !== 'settings') state.backupFile = null;

  try {
    if (r.id) {
      const item = findItem(r.id);
      if (!item || (r.name === 'kit' && !platform(r.platform))) {
        replacing = true;
        location.replace(item ? `#/item/${item.id}/post` : '#/');
        return;
      }
      await Promise.all([loadUrls(item.photos, 'thumb'), loadUrls(item.photos, 'full')]);
      if (r.name === 'kit' || r.name === 'post') prepareKit(item, r.platform || null);
      // Start with the sites she used last time, minus any it's already on. Stepping back from a
      // site mid-run keeps whatever she had ticked.
      if (r.name === 'post' && !(prev.name === 'kit' && prev.id === item.id && state.pickFor === item.id)) {
        state.pick = new Set((state.settings.usualSites || [])
          .filter((id) => state.settings.platforms.includes(id) && !isListedOn(item, id)));
        state.pickFor = item.id;
      }
      const run = r.name === 'kit' && runFor(state, item, r.platform);
      if (run) {
        run.at = run.queue.indexOf(r.platform);
        saveRun();
      }
      else state.kit = null;
    } else {
      state.kit = null;
      await loadUrls(state.items.map((i) => i.photos[0]).filter(Boolean));
    }
    if (r.name === 'settings') await readStorage();
  } catch (err) {
    console.error(err);
  }
  if (token !== routeToken) return;
  state.route = r;
  render();
  maybeTour();
  if (r.name === 'items' && prev.name !== 'items') window.scrollTo(0, state.listScroll || 0);
  else if (prev.name !== r.name || prev.id !== r.id) window.scrollTo(0, 0);
}

// ---------- drawing ----------

function render() {
  const r = state.route;
  const item = currentItem();
  let html;
  switch (r.name) {
    case 'item': html = itemView(state, item); break;
    case 'post': html = postPickView(state, item); break;
    case 'kit': html = kitView(state, item, platform(r.platform)); break;
    case 'money': html = moneyView(state); break;
    case 'settings': html = settingsView(state); break;
    default: html = itemsView(state);
  }
  $('#app').innerHTML = html;
  document.body.dataset.page = r.name;
  renderSheet();
  afterRender();
}

function renderSheet() {
  const root = $('#sheet-root');
  const wasOpen = root.childElementCount > 0;
  root.innerHTML = sheetView(state, currentItem());
  document.body.classList.toggle('sheet-open', Boolean(state.sheet));
  if (state.sheet && !wasOpen) root.querySelector('.sheet')?.classList.add('enter');
}

function afterRender() {
  // Bar widths can't be inline styles (the security policy blocks them), so set them here.
  for (const el of document.querySelectorAll('[data-w]')) el.style.width = `${el.dataset.w}%`;
  const hero = $('#hero');
  const count = $('#hero-count');
  if (hero && count) {
    hero.addEventListener('scroll', () => {
      const n = Math.round(hero.scrollLeft / hero.clientWidth);
      count.textContent = `${n + 1} / ${hero.childElementCount}`;
    }, { passive: true });
  }
}

function refreshGrid() {
  const grid = $('#grid');
  if (grid) grid.innerHTML = gridHtml(state);
  const chips = $('#chips');
  if (chips) chips.innerHTML = chipsHtml(state);
}

function refreshPanel() {
  const item = currentItem();
  const panel = $('#status-panel');
  if (item && panel) panel.outerHTML = statusPanel(state, item);
}

// ---------- theme ----------

function applyTheme() {
  const id = resolveTheme(state.settings.theme || 'curbside');
  const changed = id !== state.themeId;
  state.themeId = id;
  const root = document.documentElement;
  root.dataset.theme = id;
  // The faint pictures in the background, a few of the theme's emoji scattered round the edges.
  const pics = theme(id).emoji;
  const decor = $('#decor');
  if (decor) {
    decor.innerHTML = pics.length ? Array.from({ length: 7 }, (_, n) => `<span class="d${n + 1}">${pics[n % pics.length]}</span>`).join('') : '';
  }
  // Phone status bar matches the page.
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (bg) $('meta[name="theme-color"]')?.setAttribute('content', bg);
  try { localStorage.setItem('curbside-theme', id); } catch { /* fine without it */ }
  return changed;
}

// ---------- tours ----------

const TOUR_FOR = { items: 'home', item: 'item', post: 'post', kit: 'kit', money: 'money' };

function maybeTour() {
  let key = TOUR_FOR[state.route.name];
  if (!key || noTour) return;
  // iPhone in Safari: the Home Screen app keeps separate data, so only point her there.
  if (key === 'home' && state.isIOS && !state.standalone) key = 'safari';
  if (state.settings.tours?.[key]) return;
  const at = state.route;
  // Let the screen settle (photos load, fonts) before measuring where things are.
  setTimeout(() => {
    if (state.route !== at || state.sheet || tourActive() || $('#busy.on')) return;
    runTour(TOURS[key](), (how) => {
      state.settings.tours = { ...state.settings.tours, [key]: true };
      // Skipping the very first tour means "no tours, thanks": don't pop up the others either.
      if (key === 'home' && how === 'skip') {
        for (const k of Object.keys(TOURS)) state.settings.tours[k] = true;
      }
      saveSettings().catch(console.error);
    });
  }, 450);
}

function openSheet(type, extra = {}) {
  state.sheet = { type, ...extra };
  renderSheet();
}

function closeSheet() {
  state.ai?.abort?.abort();
  state.sheet = null;
  state.ai = null;
  renderSheet();
}

// ---------- posting kit ----------

function prepareKit(item, platformId) {
  const pid = platformId || 'facebook';
  const texts = {
    title: item.title?.trim() || '',
    price: item.price !== null && item.price !== undefined && item.price !== '' ? String(item.price) : '',
    description: buildDescription(item, pid, state.settings),
    all: copyAllText(item, pid, state.settings),
    share: shareText(item, state.settings),
  };
  state.kit = { itemId: item.id, platform: platformId, texts, files: null };
  // Files have to be ready before the tap: iPhone only opens the share sheet straight from a tap.
  photoFiles(item).then((files) => {
    if (state.kit?.itemId !== item.id) return;
    state.kit.files = files;
    for (const sel of ['#save-photos', '[data-action="share-all"]']) {
      const btn = $(sel);
      if (btn && files.length) btn.disabled = false;
    }
  }).catch(console.error);
}

function saveRun() {
  if (state.run) state.run.updatedAt = Date.now();
  db.put('meta', state.run, 'run').catch(console.error);
}

function markPhotosSaved() {
  const run = state.run;
  if (run && run.itemId === state.route.id) {
    run.photosSaved = true;
    saveRun();
  }
}

// Swap the current page for another without adding a Back step (one site to the next).
function replaceTo(hash) {
  replacing = true;
  location.replace(hash);
}

// After posting (or skipping) a site in a run: on to the next one, or finish up.
function advanceRun(item, pid, posted) {
  const run = runFor(state, item, pid);
  const pos = run ? run.queue.indexOf(pid) : -1;
  if (run && pos < run.queue.length - 1) {
    const next = run.queue[pos + 1];
    run.at = pos + 1;
    saveRun();
    replaceTo(`#/item/${item.id}/post/${next}`);
    toast(`${posted ? `Posted on ${platformName(pid)}. ` : ''}Next: ${platformName(next)}`);
    return;
  }
  const count = run ? run.queue.filter((id) => isListedOn(item, id)).length : 0;
  state.run = null;
  saveRun();
  goTo(`#/item/${item.id}`);
  if (count > 1) toast(`Posted on ${count} sites 🎉`);
  else if (posted) toast(`Marked as posted on ${platformName(pid)}`);
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function downloadAll(files) {
  for (const f of files) {
    download(f, f.name);
    await new Promise((r) => setTimeout(r, 350)); // browsers drop downloads fired all at once
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    // If the phone refuses, say so rather than falling back to the old select-a-hidden-box trick:
    // on iPhone that trick zooms and shifts the page, which is what froze the AI pop-up.
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return legacyCopy(text);
}

// Only for browsers with no clipboard API. 16px text so iPhone doesn't zoom, no scrolling, and
// focus and scroll position are put back afterwards.
function legacyCopy(text) {
  const before = document.activeElement;
  const { scrollX, scrollY } = window;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.className = 'offscreen';
  document.body.append(ta);
  ta.focus({ preventScroll: true });
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  before?.focus?.({ preventScroll: true });
  window.scrollTo(scrollX, scrollY);
  return ok;
}

function flashCopied(btn) {
  const label = btn.querySelector('span');
  btn.classList.add('copied');
  btn.closest('.copy-row')?.classList.add('done');
  if (label) label.textContent = 'Copied';
  setTimeout(() => {
    btn.classList.remove('copied');
    if (label) label.textContent = 'Copy';
  }, 1800);
}

// ---------- photos ----------

async function addPhotos(fileList, mode) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(f.name));
  if (!files.length) return;
  const item = mode === 'new' ? newItem() : currentItem();
  if (!item) return;
  const photos = [];
  let failed = 0;
  try {
    for (const [n, file] of files.entries()) {
      setBusy(files.length > 1 ? `Saving photo ${n + 1} of ${files.length}…` : 'Saving photo…');
      try {
        photos.push(await makePhoto(file, item.id));
      } catch (err) {
        console.error(err);
        failed++;
      }
    }
    if (!photos.length) throw new Error("Couldn't read that photo. Try taking it again, or pick a different one.");
    item.photos.push(...photos.map((p) => p.id));
    await save(item, photos);
    photos.forEach(rememberUrls);
    if (mode === 'new') {
      state.items.unshift(item);
      keepData();
    }
    setBusy('');
    if (failed) toast(`${plural(failed, 'photo')} couldn't be read and ${failed === 1 ? 'was' : 'were'} skipped.`, true);
    if (mode === 'new') goTo(`#/item/${item.id}`);
    else render();
  } catch (err) {
    fail(err);
  }
}

async function photoAction(action, el) {
  const item = currentItem();
  const n = state.sheet?.n ?? 0;
  const id = item?.photos[n];
  if (!id) return;
  try {
    if (action === 'photo-cover') {
      item.photos.splice(n, 1);
      item.photos.unshift(id);
      await save(item);
      state.sheet = null;
      toast('Cover photo set');
    } else if (action === 'photo-move') {
      const to = n + Number(el.dataset.dir);
      if (to < 0 || to >= item.photos.length) return;
      [item.photos[n], item.photos[to]] = [item.photos[to], item.photos[n]];
      await save(item);
      state.sheet.n = to;
    } else if (action === 'photo-rotate') {
      setBusy('Rotating…');
      const photo = await db.get('photos', id);
      const turned = await rotated(photo);
      await db.put('photos', turned);
      rememberUrls(turned);
      setBusy('');
    } else if (action === 'photo-delete') {
      if (!confirm('Delete this photo?')) return;
      item.photos.splice(n, 1);
      await save(item);
      await db.deletePhotos([id]);
      forgetUrls([id]);
      state.sheet = null;
    }
    render();
  } catch (err) {
    fail(err);
  }
}

// ---------- AI ----------

async function startAi() {
  const item = currentItem();
  if (!item) return;
  if (!item.photos.length) {
    toast('Add a photo first so the AI can see it.', true);
    return;
  }
  if (!state.settings.geminiKey) {
    state.ai = { phase: 'choose', files: null, prompt: aiSharePrompt(item) };
    openSheet('ai');
    // Smaller copies share faster and are all an AI needs.
    try {
      const files = [];
      for (const [n, id] of item.photos.slice(0, 4).entries()) {
        const photo = await db.get('photos', id);
        files.push(new File([await smallJpeg(photo.full)], `photo-${n + 1}.jpg`, { type: 'image/jpeg' }));
      }
      if (state.ai?.phase === 'choose') {
        state.ai.files = files;
        renderSheet();
      }
    } catch (err) {
      console.error(err);
    }
    return;
  }
  const abort = new AbortController();
  state.ai = { phase: 'busy', abort };
  openSheet('ai');
  try {
    const images = [];
    for (const id of item.photos.slice(0, 3)) {
      const photo = await db.get('photos', id);
      images.push({ mime: 'image/jpeg', data: await base64(await smallJpeg(photo.full)) });
    }
    const suggestion = await suggestListing({ apiKey: state.settings.geminiKey, images, item, signal: abort.signal });
    if (state.ai?.abort !== abort) return;
    state.ai = { phase: 'result', suggestion };
  } catch (err) {
    if (err.message === CANCELLED || state.ai?.abort !== abort) return;
    state.ai = { phase: 'error', error: err.message };
  }
  renderSheet();
}

function waitForAnswer() {
  const ai = state.ai;
  if (!ai || !['choose', 'waiting'].includes(ai.phase)) return;
  ai.sharing = false;
  ai.phase = 'waiting';
  if (state.sheet?.type !== 'ai') state.sheet = { type: 'ai' };
  renderSheet();
}

function showSuggestion(text) {
  const suggestion = parseAiReply(text);
  if (!suggestion) {
    state.ai = { ...state.ai, phase: 'paste', error: "Couldn't find a listing in that. Make sure you copied ChatGPT's whole answer." };
    renderSheet();
    return;
  }
  state.ai = { phase: 'result', suggestion };
  renderSheet();
}

async function applySuggestion() {
  const item = currentItem();
  const sug = state.ai?.suggestion;
  if (!item || !sug) return;
  const use = new Set([...document.querySelectorAll('[data-use]:checked')].map((el) => el.dataset.use));
  if (use.has('title')) item.title = sug.title;
  if (use.has('price') && sug.price !== null) setPrice(item, sug.price);
  if (use.has('category')) item.category = sug.category;
  if (use.has('condition')) item.condition = sug.condition;
  if (use.has('description')) item.description = sug.description;
  await save(item);
  state.sheet = null;
  state.ai = null;
  render();
  toast(use.size ? 'Listing filled in. Give it a quick check.' : 'Nothing changed.');
}

// ---------- backup ----------

const README = `This is a backup of the trash2treasure app.
To bring it back: open trash2treasure, go to Settings, tap "Restore from a backup" and pick this file.
curbside.json has every item; photos/ has the listing photos; inventory.csv opens in Excel or Google Sheets.
`;

async function buildBackup() {
  await flushAll();
  const files = [];
  const photos = [];
  let n = 0;
  const total = state.items.reduce((c, i) => c + i.photos.length, 0);
  for (const item of state.items) {
    for (const id of item.photos) {
      setBusy(`Packing photo ${++n} of ${total}…`);
      const p = await db.get('photos', id);
      if (!p) continue;
      files.push({ name: `photos/${id}.jpg`, data: p.full }, { name: `thumbs/${id}.jpg`, data: p.thumb });
      photos.push({ id, itemId: item.id, w: p.w, h: p.h, at: p.at });
    }
  }
  const { geminiKey, ...settings } = state.settings; // a key never leaves the phone in a backup
  const data = { app: 'curbside', format: 1, version: VERSION, exportedAt: Date.now(), settings, items: state.items, photos };
  const zip = await makeZip([
    { name: 'curbside.json', data: JSON.stringify(data) },
    { name: 'inventory.csv', data: toCsv(state.items) },
    { name: 'README.txt', data: README },
    ...files,
  ]);
  return new File([zip], `trash2treasure-backup-${isoDay(Date.now())}.zip`, { type: 'application/zip' });
}

async function markBackedUp() {
  state.lastBackup = Date.now();
  await db.put('meta', state.lastBackup, 'lastBackup');
}

async function backup() {
  try {
    const file = await buildBackup();
    setBusy('');
    if (state.isIOS && state.canShareFiles) {
      // iPhone only opens the share sheet straight from a tap, so hand her a second button.
      state.backupFile = file;
      render();
      $('#backup')?.scrollIntoView({ block: 'center' });
      return;
    }
    download(file, file.name);
    await markBackedUp();
    render();
    toast('Backup saved to your Downloads.');
  } catch (err) {
    fail(err);
  }
}

async function saveBackupFile() {
  const file = state.backupFile;
  if (!file) return;
  try {
    await navigator.share({ files: [file] });
    await markBackedUp();
    state.backupFile = null;
    render();
    toast('Backup saved.');
  } catch (err) {
    if (err?.name === 'AbortError') return;
    download(file, file.name);
    await markBackedUp();
    state.backupFile = null;
    render();
  }
}

function cleanItem(raw) {
  const base = newItem(Number(raw.createdAt) || Date.now());
  const item = { ...base, ...raw };
  item.id = String(raw.id);
  item.status = ['tolist', 'listed', 'pending', 'sold', 'done'].includes(raw.status) ? raw.status : 'tolist';
  item.photos = Array.isArray(raw.photos) ? raw.photos.map(String) : [];
  item.shots = Array.isArray(raw.shots) ? raw.shots.map(String) : [];
  item.history = Array.isArray(raw.history) ? raw.history : base.history;
  item.listings = raw.listings && typeof raw.listings === 'object' ? raw.listings : {};
  for (const key of ['title', 'description', 'category', 'condition', 'size', 'foundWhere', 'storedAt', 'notes']) {
    item[key] = typeof item[key] === 'string' ? item[key] : '';
  }
  return item;
}

async function restore(file) {
  if (!file) return;
  if (!confirm(`Restore from "${file.name}"? Items in the backup get added to what's here. Nothing here is deleted.`)) return;
  try {
    setBusy('Opening backup…');
    const zip = await readZip(file);
    const jsonName = zip.names.find((n) => /(^|\/)curbside\.json$/.test(n) && !n.startsWith('__MACOSX'));
    if (!jsonName) throw new Error("That file isn't a trash2treasure backup.");
    const dir = jsonName.slice(0, -'curbside.json'.length);
    const data = JSON.parse(await zip.text(jsonName));
    if (data?.app !== 'curbside' || !Array.isArray(data.items)) throw new Error("That file isn't a trash2treasure backup.");
    const photoInfo = new Map((data.photos || []).map((p) => [p.id, p]));
    let added = 0;
    let updated = 0;
    let kept = 0;
    for (const [n, raw] of data.items.entries()) {
      if (!raw?.id) continue;
      setBusy(`Restoring item ${n + 1} of ${data.items.length}…`);
      const item = cleanItem(raw);
      const existing = findItem(item.id);
      if (existing && (existing.updatedAt || 0) > (item.updatedAt || 0)) {
        kept++;
        continue;
      }
      const photos = [];
      for (const id of item.photos) {
        const full = await zip.bytes(`${dir}photos/${id}.jpg`);
        if (!full) continue;
        const thumb = await zip.bytes(`${dir}thumbs/${id}.jpg`);
        const info = photoInfo.get(id) || {};
        photos.push({
          id, itemId: item.id, at: info.at || Date.now(), w: info.w, h: info.h,
          full: new Blob([full], { type: 'image/jpeg' }),
          thumb: new Blob([thumb || full], { type: 'image/jpeg' }),
        });
      }
      item.photos = photos.map((p) => p.id);
      if (existing) {
        const gone = existing.photos.filter((id) => !item.photos.includes(id));
        if (gone.length) await db.deletePhotos(gone);
        forgetUrls(existing.photos);
      }
      await db.saveItem(item, photos);
      if (existing) updated++;
      else added++;
    }
    if (data.settings && typeof data.settings === 'object') {
      const { geminiKey, ...rest } = data.settings;
      state.settings = { ...DEFAULT_SETTINGS, ...state.settings, ...rest, geminiKey: state.settings.geminiKey };
      if (!Array.isArray(state.settings.platforms)) state.settings.platforms = DEFAULT_PLATFORMS;
      await saveSettings();
    }
    state.items = await db.getAll('items');
    setBusy('');
    await route();
    const parts = [added && `${plural(added, 'item')} added`, updated && `${updated} updated`, kept && `${kept} kept (yours were newer)`].filter(Boolean);
    toast(parts.length ? `Restored: ${parts.join(', ')}.` : 'Nothing new in that backup.');
  } catch (err) {
    fail(err instanceof SyntaxError ? new Error('That backup file is damaged.') : err);
  }
}

// ---------- phone storage ----------

async function readStorage() {
  try {
    state.storage = await navigator.storage?.estimate?.() || null;
    state.persisted = await navigator.storage?.persisted?.() ?? null;
  } catch {
    state.storage = null;
  }
}

// Ask the browser not to clear her data. Chrome decides quietly; nothing pops up on iPhone.
async function keepData() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      state.persisted = await navigator.storage.persist();
    }
  } catch { /* not supported */ }
}

// ---------- taps ----------

const actions = {
  back,
  'go-item': () => goTo(`#/item/${state.route.id}`),
  filter(el) {
    state.filter = el.dataset.filter;
    refreshGrid();
    for (const t of document.querySelectorAll('.todo')) t.classList.toggle('on', t.dataset.filter === state.filter);
  },
  'dismiss-install': async () => {
    state.settings.hideInstall = true;
    await saveSettings();
    render();
  },
  'show-install': async () => {
    state.settings.hideInstall = false;
    await saveSettings();
    render();
  },
  install: async () => {
    const ev = state.installEvent;
    if (!ev) return;
    state.installEvent = null;
    ev.prompt();
    await ev.userChoice.catch(() => null);
    render();
  },
  'snooze-backup': async () => {
    state.backupSnooze = Date.now() + 3 * 86400000;
    await db.put('meta', state.backupSnooze, 'backupSnooze');
    render();
  },

  sheet(el) {
    openSheet(el.dataset.sheet, { platform: el.dataset.platform });
  },
  'close-sheet': closeSheet,
  photo(el) {
    openSheet('photo', { n: Number(el.dataset.n) });
  },
  'photo-cover': (el) => photoAction('photo-cover', el),
  'photo-move': (el) => photoAction('photo-move', el),
  'photo-rotate': (el) => photoAction('photo-rotate', el),
  'photo-delete': (el) => photoAction('photo-delete', el),

  async 'save-pending'() {
    const item = currentItem();
    const f = sheetFields();
    setPending(item, { buyer: f.buyer.trim(), when: f.when, price: parseMoney(f.price), note: f.note.trim() });
    await save(item);
    closeSheet();
    render();
    if (item.pending.when) toast('Marked as pending', false, { label: 'Add to calendar', run: () => openSheet('calendar') });
    else toast('Marked as pending');
  },
  async 'fell-through'() {
    const item = currentItem();
    fellThrough(item);
    await save(item);
    render();
    toast(item.status === 'listed' ? 'Back to listed' : 'Back to "To list"');
  },
  async 'save-sold'() {
    const item = currentItem();
    const f = sheetFields();
    const price = parseMoney(f.price);
    if (price === null) {
      toast('Enter what it sold for.', true);
      return;
    }
    const first = item.status !== 'sold';
    markSold(item, { price, fees: parseMoney(f.fees) || 0, platform: f.platform, date: fromIsoDay(f.date) || Date.now(), buyer: f.buyer.trim() });
    // Selling on a site means that listing is done.
    if (first && item.listings?.[f.platform] && !item.listings[f.platform].removedAt) {
      item.listings[f.platform] = { ...item.listings[f.platform], removedAt: Date.now() };
    }
    await save(item);
    closeSheet();
    render();
    const left = activeListings(item).length;
    toast(first ? `Sold! You made ${money(profit(item))}.${left ? ' Now take it down from the other sites.' : ''}` : 'Sale updated');
  },
  async 'undo-sale'() {
    const item = currentItem();
    if (!confirm('Undo this sale? It goes back to your active items.')) return;
    undoSale(item);
    await save(item);
    render();
  },
  async done(el) {
    const item = currentItem();
    markDone(item, el.dataset.reason);
    await save(item);
    closeSheet();
    render();
  },
  async 'bring-back'() {
    const item = currentItem();
    bringBack(item);
    await save(item);
    render();
  },
  async drop(el) {
    const item = currentItem();
    const price = Number(el.dataset.price);
    setPrice(item, price);
    await save(item);
    render();
    const where = activeListings(item).map((l) => platformName(l.platform));
    toast(`Price is now ${money(price)}. Change it on ${where.join(' and ')} too.`);
  },
  async 'renew-all'() {
    const item = currentItem();
    for (const l of activeListings(item)) renewListing(item, l.platform);
    await save(item);
    render();
    toast('Marked as renewed');
  },
  async takedown(el) {
    const item = currentItem();
    takeDown(item, el.dataset.platform);
    await save(item);
    closeSheet();
    render();
  },
  'listing-open'(el) {
    const item = currentItem();
    const pid = el.dataset.platform;
    const typed = document.querySelector('[data-sf="url"]')?.value.trim();
    const url = typed || item?.listings?.[pid]?.url;
    const p = platform(pid);
    const fallback = { facebook: 'https://www.facebook.com/marketplace/you/selling', ebay: 'https://www.ebay.com/sh/lst/active', craigslist: 'https://accounts.craigslist.org/login/home' }[pid];
    const target = /^https?:\/\//i.test(url || '') ? url : fallback || (p?.post ? new URL(p.post).origin : '');
    if (target) window.open(target, '_blank', 'noopener');
  },
  async 'listing-save'(el) {
    const item = currentItem();
    const pid = el.dataset.platform;
    const l = item.listings?.[pid];
    if (l) item.listings[pid] = { ...l, url: sheetFields().url.trim() };
    await save(item);
    closeSheet();
    render();
  },
  async 'listing-renew'(el) {
    const item = currentItem();
    renewListing(item, el.dataset.platform);
    await save(item);
    closeSheet();
    render();
    toast('Marked as renewed');
  },
  async 'listing-again'(el) {
    const item = currentItem();
    markListed(item, el.dataset.platform, sheetFields().url || '');
    await save(item);
    closeSheet();
    render();
  },
  async 'listing-remove'(el) {
    const item = currentItem();
    const pid = el.dataset.platform;
    if (!confirm(`Remove ${platformName(pid)} from this item's list? (Use this if you marked it by mistake.)`)) return;
    const { [pid]: _gone, ...rest } = item.listings;
    item.listings = rest;
    if (item.status === 'listed' && !activeListings(item).length) item.status = 'tolist';
    await save(item);
    closeSheet();
    render();
  },

  'price-check'(el) {
    const item = currentItem();
    const title = item?.title?.trim();
    if (!title) {
      toast('Add a title first, then check prices.', true);
      $('[data-field="title"]')?.focus();
      return;
    }
    const check = PRICE_CHECKS.find((c) => c.id === el.dataset.check);
    if (check) window.open(check.url(title), '_blank', 'noopener');
  },
  // No "are you sure?": it deletes straight away and offers Undo instead, which is quicker and
  // just as safe. The photos are kept in memory until the Undo button goes away.
  async 'delete-item'() {
    const item = currentItem();
    if (!item) return;
    try {
      clearTimeout(queued.get(item.id)?.timer);
      queued.delete(item.id);
      const photos = await db.photosFor(item.id);
      await db.deleteItem(item);
      forgetUrls(item.photos);
      state.items = state.items.filter((i) => i.id !== item.id);
      goTo('#/');
      toast(`Deleted "${item.title?.trim() || 'Untitled find'}"`, false, {
        label: 'Undo',
        async run() {
          await db.saveItem(item, photos);
          state.items.push(item);
          await loadUrls(item.photos);
          if (state.route.name === 'items') refreshGrid();
          toast('Put back');
        },
      });
    } catch (err) {
      fail(err);
    }
  },
  async 'toast-action'() {
    const action = toastAction;
    hideToast();
    if (action) await action.run();
  },
  async 'add-blank'() {
    const item = newItem();
    state.items.unshift(item);
    await save(item);
    goTo(`#/item/${item.id}`);
  },

  'save-photos'() {
    const files = state.kit?.files;
    if (!files?.length) return;
    if (state.isIOS && state.canShareFiles) {
      navigator.share({ files }).then(markPhotosSaved).catch((err) => {
        if (err?.name !== 'AbortError') downloadAll(files).then(markPhotosSaved);
      });
    } else {
      downloadAll(files).then(() => {
        markPhotosSaved();
        toast(`${plural(files.length, 'photo')} saved to Downloads`);
      });
    }
  },
  'share-all'() {
    const files = state.kit?.files || [];
    const text = state.kit?.texts.share || '';
    if (navigator.share) {
      const data = files.length && navigator.canShare?.({ files, text }) ? { files, text } : { text };
      navigator.share(data).catch(() => {});
    } else {
      copyText(text).then(() => toast('Description copied'));
      downloadAll(files);
    }
  },
  async copy(el) {
    const text = state.kit?.texts[el.dataset.copy];
    if (!text) return;
    if (await copyText(text)) flashCopied(el);
    else toast("Couldn't copy. Press and hold the text to copy it instead.", true);
  },
  async 'mark-listed'() {
    const item = currentItem();
    const pid = state.route.platform;
    const url = $('[data-kit="url"]')?.value || '';
    markListed(item, pid, url);
    await save(item);
    advanceRun(item, pid, true);
  },
  'run-skip'() {
    advanceRun(currentItem(), state.route.platform, false);
  },
  'pick-site'(el) {
    const id = el.dataset.platform;
    if (!state.pick) state.pick = new Set();
    if (state.pick.has(id)) state.pick.delete(id);
    else state.pick.add(id);
    render();
  },
  async 'start-run'() {
    const item = currentItem();
    const queue = PLATFORMS.map((p) => p.id).filter((id) => state.pick?.has(id));
    if (!item || !queue.length) return;
    state.settings.usualSites = queue;
    saveSettings().catch(console.error);
    state.run = { itemId: item.id, queue, at: 0, photosSaved: false };
    saveRun();
    goTo(`#/item/${item.id}/post/${queue[0]}`);
  },
  'resume-run'() {
    const run = state.run;
    if (run) goTo(`#/item/${run.itemId}/post/${run.queue[run.at]}`);
  },
  'stop-run'() {
    state.run = null;
    saveRun();
    render();
  },
  async 'copy-reply'(el) {
    const item = currentItem();
    const reply = item && quickReplies(item, state.settings).find((r) => r.id === el.dataset.reply);
    if (!reply) return;
    if (!(await copyText(reply.text))) {
      toast("Couldn't copy. Press and hold the text to copy it instead.", true);
      return;
    }
    const label = el.querySelector('.reply-copy span');
    el.classList.add('copied');
    if (label) label.textContent = 'Copied';
    setTimeout(() => {
      el.classList.remove('copied');
      if (label) label.textContent = 'Copy';
    }, 1800);
  },
  'cal-google'() {
    const ev = pickupEvent(currentItem(), state.settings);
    if (ev) window.open(googleCalendarUrl(ev), '_blank', 'noopener');
  },
  'cal-ics'() {
    const ev = pickupEvent(currentItem(), state.settings);
    if (!ev) return;
    const file = new File([icsFile(ev)], 'pickup.ics', { type: 'text/calendar' });
    // iPhone: the share sheet (Calendar isn't always offered, so the sheet explains Mail and Google).
    if (state.isIOS && navigator.canShare?.({ files: [file] })) navigator.share({ files: [file] }).catch(() => {});
    else download(file, file.name);
  },

  ai: startAi,
  'ai-cancel': closeSheet,
  'ai-setup': () => {
    closeSheet();
    goTo('#/settings');
    setTimeout(() => $('#ai-settings')?.scrollIntoView({ block: 'start' }), 60);
  },
  'ai-share'() {
    const ai = state.ai;
    if (!ai?.files) return;
    const withText = { files: ai.files, text: ai.prompt };
    const data = navigator.canShare?.(withText) ? withText : { files: ai.files };
    ai.sharing = true;
    navigator.share(data).then(() => {
      if (state.ai === ai) waitForAnswer();
    }).catch((err) => {
      ai.sharing = false;
      if (err?.name === 'InvalidStateError') toast('The share menu is still open. Close it, then tap Send again.', true);
    });
  },
  async 'ai-copy-prompt'() {
    if (await copyText(state.ai?.prompt || '')) toast('Question copied. Paste it into the AI app with the photos.');
    else toast("Couldn't copy. Tap Send again instead.", true);
  },
  'ai-save-photos'() {
    if (state.ai?.files) downloadAll(state.ai.files);
  },
  async 'ai-paste'() {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch { /* blocked: fall back to a box she pastes into */ }
    if (text && parseAiReply(text)) {
      showSuggestion(text);
      return;
    }
    state.ai = { ...state.ai, phase: 'paste', error: '' };
    renderSheet();
    $('[data-sf="reply"]')?.focus();
  },
  'ai-parse'() {
    showSuggestion($('[data-sf="reply"]')?.value || '');
  },
  'ai-apply': applySuggestion,

  period(el) {
    state.period = el.dataset.period;
    state.showAllSales = false;
    render();
  },
  month(el) {
    state.monthPick = Number(el.dataset.n);
    const months = monthly(state.items, 6);
    $('#month-chart').innerHTML = monthChart(months, state.monthPick);
    $('#month-caption').innerHTML = monthCaption(months, state.monthPick);
  },
  'all-sales'() {
    state.showAllSales = true;
    render();
  },
  'export-csv'() {
    const file = new File([toCsv(state.items)], `trash2treasure-${isoDay(Date.now())}.csv`, { type: 'text/csv' });
    if (state.isIOS && state.canShareFiles) navigator.share({ files: [file] }).catch(() => {});
    else download(file, file.name);
  },

  async 'save-key'() {
    const key = findKey($('#gemini-key')?.value);
    if (!key) {
      toast('Paste your key first.', true);
      return;
    }
    if (!/^(AIza|AQ\.)/.test(key)) toast("That doesn't look like a Google AI key, but it's saved. Tap Test it to check.", true);
    state.settings.geminiKey = key;
    await saveSettings();
    render();
    $('#ai-settings')?.scrollIntoView({ block: 'start' });
    if (/^(AIza|AQ\.)/.test(key)) toast('Saved. "Write it for me" is now one tap.');
  },
  async 'set-theme'(el) {
    state.settings.theme = el.dataset.themeId;
    await saveSettings();
    applyTheme();
    render();
    const name = el.dataset.themeId === AUTO ? `Automatic (${theme(state.themeId).name} right now)` : theme(state.themeId).name;
    toast(`Theme: ${name}`);
  },
  async 'replay-tour'() {
    state.settings.tours = {};
    await saveSettings();
    if (state.route.name === 'items') maybeTour();
    else goTo('#/');
  },
  async 'remove-key'() {
    if (!confirm('Remove the AI key from this phone?')) return;
    state.settings.geminiKey = '';
    await saveSettings();
    render();
  },
  async 'test-key'() {
    setBusy('Checking your key…');
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODELS[0]}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': state.settings.geminiKey },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with the single word OK.' }] }] }),
      });
      setBusy('');
      if (res.ok) toast('Your key works.');
      else if (res.status === 429) toast("The key works, but you've hit Google's free limit for now.", true);
      else if ([400, 401, 403].includes(res.status)) toast("Google didn't accept that key. Make a new one and paste it again.", true);
      else toast(`Google answered with an error (${res.status}). Try again later.`, true);
    } catch {
      setBusy('');
      toast('No connection. Try again when you have signal.', true);
    }
  },
  backup,
  'backup-save': saveBackupFile,
  async persist() {
    await keepData();
    render();
  },
  async wipe() {
    if (!$('#wipe-ok')?.checked) return;
    if (!confirm('Delete everything in trash2treasure on this phone? This cannot be undone.')) return;
    try {
      await db.wipe();
      forgetUrls(state.items.flatMap((i) => i.photos));
      state.items = [];
      state.settings = { ...DEFAULT_SETTINGS };
      state.lastBackup = null;
      applyTheme();
      toast('trash2treasure is empty.');
      goTo('#/');
      render();
    } catch (err) {
      fail(err);
    }
  },
};

function sheetFields() {
  const out = {};
  for (const el of document.querySelectorAll('[data-sf]')) out[el.dataset.sf] = el.value;
  return new Proxy(out, { get: (o, k) => (k in o ? o[k] : '') });
}

function onClick(e) {
  const link = e.target.closest('a[href^="#/"]');
  if (link) {
    e.preventDefault();
    goTo(link.getAttribute('href'));
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(el, e)).catch(fail);
}

// ---------- typing ----------

// The price when she tapped into the box, so a change is logged once rather than per keystroke.
let priceAtFocus = { id: null, price: null };

function updateField(el, final) {
  const item = currentItem();
  if (!item) return;
  const field = el.dataset.field;
  const raw = el.value;
  if (['price', 'floor', 'cost'].includes(field)) {
    const value = raw.trim() === '' ? null : parseMoney(raw);
    if (field === 'price' && final) {
      if (priceAtFocus.id === item.id) item.price = priceAtFocus.price;
      setPrice(item, value);
      priceAtFocus = { id: item.id, price: value };
    } else {
      item[field] = value;
    }
  } else if (field === 'foundOn') {
    item.foundOn = fromIsoDay(raw) || item.foundOn;
  } else {
    item[field] = raw;
  }
  saveSoon(item);
  if (final && ['title', 'price'].includes(field)) refreshPanel();
}

let settingsTimer;

function onInput(e) {
  const el = e.target;
  if (el.id === 'search') {
    state.query = el.value;
    refreshGrid();
  } else if (el.dataset.field && el.type !== 'date' && el.tagName !== 'SELECT') {
    updateField(el, false);
  } else if (el.dataset.setting && el.type !== 'checkbox' && el.tagName !== 'SELECT') {
    state.settings[el.dataset.setting] = el.value;
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => saveSettings().catch(fail), 400);
  }
}

function onChange(e) {
  const el = e.target;
  if (el.dataset.pick) {
    const files = el.files;
    if (el.dataset.pick === 'restore') restore(files?.[0]);
    else if (files?.length) addPhotos(files, el.dataset.pick);
    el.value = '';
  } else if (el.dataset.shot) {
    const item = currentItem();
    if (!item) return;
    const shots = new Set(item.shots || []);
    if (el.checked) shots.add(el.dataset.shot);
    else shots.delete(el.dataset.shot);
    item.shots = [...shots];
    saveSoon(item);
    const { done, total } = shotCount(item);
    $('#shot-count').textContent = `${done} of ${total}`;
  } else if (el.dataset.field) {
    updateField(el, true);
    if (el.dataset.field === 'category') {
      const list = $('.shot-list');
      if (list) list.outerHTML = shotList(currentItem());
    }
  } else if (el.dataset.setting) {
    const key = el.dataset.setting;
    state.settings[key] = el.type === 'checkbox' ? el.checked : key === 'staleDays' ? Number(el.value) : el.value;
    saveSettings().catch(fail);
  } else if (el.dataset.platformToggle) {
    const id = el.dataset.platformToggle;
    const on = new Set(state.settings.platforms);
    if (el.checked) on.add(id);
    else on.delete(id);
    state.settings.platforms = PLATFORMS.map((p) => p.id).filter((p) => on.has(p));
    saveSettings().catch(fail);
  } else if (el.id === 'wipe-ok') {
    $('#wipe-btn').disabled = !el.checked;
  }
}

function onFocusIn(e) {
  const item = currentItem();
  if (e.target.dataset?.field === 'price' && item) priceAtFocus = { id: item.id, price: item.price ?? null };
}

// ---------- start ----------

async function start() {
  if (window.top !== window.self) {
    document.body.textContent = 'Open trash2treasure in its own tab.';
    return;
  }
  try {
    const [items, settings, lastBackup, snooze, run] = await Promise.all([
      db.getAll('items'), db.get('meta', 'settings'), db.get('meta', 'lastBackup'), db.get('meta', 'backupSnooze'),
      db.get('meta', 'run'),
    ]);
    state.run = run && Array.isArray(run.queue) ? run : null;
    state.items = items;
    state.settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    if (!Array.isArray(state.settings.platforms)) state.settings.platforms = DEFAULT_PLATFORMS;
    state.lastBackup = lastBackup || null;
    state.backupSnooze = snooze || 0;
    applyTheme();
  } catch (err) {
    console.error(err);
    $('#app').innerHTML = `<main class="page"><section class="notice notice-warn"><div><strong>trash2treasure can't save on this browser</strong>
      <p>${esc(err?.message || '')} Private browsing blocks storage. Open it in a normal Safari or Chrome tab.</p></div></section></main>`;
    return;
  }

  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushAll();
      return;
    }
    // Back from another app (the AI app, Facebook...). iPhone can leave taps landing in the
    // wrong place after a trip away with a pop-up open, so redraw it and settle the page.
    if (state.settings.theme === AUTO && applyTheme()) render();
    if (state.ai?.sharing) waitForAnswer();
    else if (state.sheet) renderSheet();
    document.activeElement?.blur?.();
    window.scrollTo(window.scrollX, window.scrollY);
  });
  window.addEventListener('pagehide', flushAll);
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.sheet) closeSheet(); });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.installEvent = e;
    if (state.route.name === 'items') render();
  });
  window.addEventListener('appinstalled', () => {
    state.installEvent = null;
    state.standalone = true;
  });

  readStorage();
  await route();

  // Local testing skips the offline cache so edits show up straight away (add ?sw to test it).
  const local = ['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('sw');
  if ('serviceWorker' in navigator && !local) navigator.serviceWorker.register('sw.js').catch(console.error);
}

start();
