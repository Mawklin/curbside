// Every screen as an HTML string. Anything she typed goes through esc(). No inline style
// attributes anywhere: the page's security policy blocks them, so sizes are set in app.js.
import { esc, money, moneyInput, ago, shortDate, longDate, isoDay, plural, pickupLabel, daysSince } from './util.js';
import { PLATFORMS, PRICE_CHECKS, IN_PERSON, platform, platformName } from './platforms.js';
import { CATEGORIES, CONDITIONS, conditionLabel, conditionFor, titleWarning } from './listing.js';
import {
  STATUSES, DONE_REASONS, doneLabel, activeListings, isListedOn, needsDetails, readyToPost, isStale,
  todo, summarize, monthly, inventory, profit, daysToSell, priceDrops, freshAt,
} from './model.js';
import { thumbUrl, fullUrl } from './photos.js';

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
export const ICON = {
  tag: svg('<path d="M3 12.2V4.5A1.5 1.5 0 0 1 4.5 3h7.7a1.5 1.5 0 0 1 1.06.44l7.3 7.3a1.5 1.5 0 0 1 0 2.12l-7.7 7.7a1.5 1.5 0 0 1-2.12 0l-7.3-7.3A1.5 1.5 0 0 1 3 12.2Z"/><circle cx="8" cy="8" r="1.6"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.54V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.54 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.54-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.54V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.54 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.54 1Z"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  camera: svg('<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.1l1.3-2h6.2l1.3 2h2.1A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"/><circle cx="12" cy="13" r="3.4"/>'),
  box: svg('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  chart: svg('<path d="M4 20h16"/><path d="M7 16v-4M12 16V8M17 16v-7"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  external: svg('<path d="M14 5h5v5M19 5l-8 8M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10"/>'),
  sparkle: svg('<path d="M12 3.5l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9Z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>'),
  rotate: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>'),
  image: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8.5 8.5"/>'),
  share: svg('<path d="M12 15V3.5M8 7.5l4-4 4 4"/><path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5H16"/>'),
  left: svg('<path d="M14 7l-5 5 5 5"/>'),
  right: svg('<path d="M10 7l5 5-5 5"/>'),
  star: svg('<path d="M12 4l2.4 5 5.4.7-4 3.7 1 5.4L12 16.2 7.2 18.8l1-5.4-4-3.7 5.4-.7Z"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
};

const pdot = (id, big = false) => {
  const p = platform(id);
  return `<span class="pdot p-${esc(id)}${big ? ' big' : ''}" aria-hidden="true">${esc(p?.abbr || '•')}</span>`;
};

const photoPicker = (pick, inner, cls) => `<label class="${cls}">${inner}<input type="file" accept="image/*" multiple class="file-hidden" data-pick="${pick}"></label>`;

function listJoin(words) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

const missingBits = (item) => [
  !item.photos.length && 'a photo',
  !item.title?.trim() && 'a title',
  (item.price === null || item.price === '') && 'a price',
].filter(Boolean);

// ---------- shared chrome ----------

export function tabbar(active) {
  return `<nav class="tabbar" aria-label="Main">
    <a class="tab${active === 'items' ? ' on' : ''}" href="#/">${ICON.box}<span>Items</span></a>
    ${photoPicker('new', `<span class="snap-circle">${ICON.camera}</span><span>Add a find</span>`, 'tab tab-snap')}
    <a class="tab${active === 'money' ? ' on' : ''}" href="#/money">${ICON.chart}<span>Money</span></a>
  </nav>`;
}

const subbar = (title, extra = '') => `<header class="topbar sub">
  <button class="icon-btn" data-action="back" aria-label="Back">${ICON.back}</button>
  <div class="topbar-title">${title}</div>
  <div class="topbar-end">${extra}</div>
</header>`;

// ---------- Items ----------

export const FILTERS = [
  { id: 'active', label: 'Active', test: (i) => ['tolist', 'listed', 'pending'].includes(i.status) },
  { id: 'tolist', label: 'To list', test: (i) => i.status === 'tolist' },
  { id: 'listed', label: 'Listed', test: (i) => i.status === 'listed' },
  { id: 'pending', label: 'Pending', test: (i) => i.status === 'pending' },
  { id: 'sold', label: 'Sold', test: (i) => i.status === 'sold' },
  { id: 'done', label: 'Not selling', test: (i) => i.status === 'done' },
];

const SPECIAL = {
  needs: { label: 'Needs details', test: needsDetails },
  ready: { label: 'Ready to post', test: readyToPost },
  stale: { label: 'Listed a while', test: (i, s) => isStale(i, s.settings.staleDays) },
  cleanup: { label: 'Sold, still posted', test: (i) => i.status === 'sold' && activeListings(i).length > 0 },
};

const ORDER = { pending: 0, tolist: 1, listed: 2 };

function matches(item, query) {
  if (!query) return true;
  const hay = [item.title, item.description, item.category, item.foundWhere, item.storedAt, item.notes,
    item.pending?.buyer, item.sale?.buyer, conditionLabel(item.condition)].join(' ').toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export function visibleItems(s) {
  const filter = SPECIAL[s.filter] || FILTERS.find((f) => f.id === s.filter) || FILTERS[0];
  const list = s.items.filter((i) => filter.test(i, s) && matches(i, s.query.trim()));
  if (s.filter === 'sold' || s.filter === 'cleanup') return list.sort((a, b) => b.sale.date - a.sale.date);
  if (s.filter === 'done') return list.sort((a, b) => (b.done?.date || 0) - (a.done?.date || 0));
  return list.sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3)
    || (a.status === 'pending' ? (a.pending?.when || '9').localeCompare(b.pending?.when || '9') : 0)
    || b.createdAt - a.createdAt);
}

function cardMeta(item, s) {
  switch (item.status) {
    case 'tolist': {
      const missing = missingBits(item);
      return missing.length
        ? `<span class="meta-warn">Needs ${esc(missing.map((m) => m.replace(/^an? /, '')).join(', '))}</span>`
        : '<span class="meta-good">Ready to post</span>';
    }
    case 'listed': {
      const active = activeListings(item);
      const days = daysSince(Math.min(...active.map((l) => l.listedAt)));
      const stale = isStale(item, s.settings.staleDays);
      return `<span class="pdots">${active.map((l) => pdot(l.platform)).join('')}</span><span class="${stale ? 'meta-warn' : ''}">${days ? `${days}d` : 'today'}</span>`;
    }
    case 'pending':
      return `<span class="meta-pending">${item.pending?.when ? `Pickup ${esc(pickupLabel(item.pending.when))}` : esc(item.pending?.buyer || 'Pending')}</span>`;
    case 'sold':
      return `<span>${esc(platformName(item.sale?.platform))} · ${esc(shortDate(item.sale?.date))}</span>${activeListings(item).length ? '<span class="meta-warn">Still posted</span>' : ''}`;
    default:
      return `<span>${esc(doneLabel(item.done?.reason))}</span>`;
  }
}

function itemCard(item, s) {
  const cover = item.photos[0] ? thumbUrl(item.photos[0]) : '';
  const shownPrice = item.status === 'sold' ? item.sale?.price : item.price;
  return `<a class="item-card" href="#/item/${esc(item.id)}">
    <div class="item-thumb">
      ${cover ? `<img src="${cover}" alt="" loading="lazy" decoding="async">` : `<div class="no-photo">${ICON.image}</div>`}
      <span class="badge badge-${item.status}">${STATUSES[item.status].short}</span>
      ${shownPrice !== null && shownPrice !== undefined && shownPrice !== '' ? `<span class="price-tag">${esc(money(shownPrice))}</span>` : ''}
    </div>
    <div class="item-body">
      <div class="item-title">${item.title?.trim() ? esc(item.title) : '<span class="muted">Untitled find</span>'}</div>
      <div class="item-meta">${cardMeta(item, s)}</div>
    </div>
  </a>`;
}

export function gridHtml(s) {
  if (!s.items.length) {
    return `<section class="welcome">
      <div class="welcome-art" aria-hidden="true">${ICON.tag}</div>
      <h2>Found something good?</h2>
      <p>Snap it and Curbside keeps the photos, price and where it's posted together, then gets everything ready to paste into Marketplace, OfferUp and the rest.</p>
      ${photoPicker('new', `${ICON.camera}<span>Add your first find</span>`, 'btn btn-primary btn-big')}
      <p><button class="link" data-action="add-blank">or add one without a photo</button></p>
    </section>`;
  }
  const addBlank = `<button class="btn btn-block btn-dashed" data-action="add-blank">${ICON.plus} Add an item without a photo</button>`;
  const list = visibleItems(s);
  if (!list.length) {
    const msg = s.query.trim() ? `Nothing matches "${esc(s.query.trim())}".` : 'Nothing here right now.';
    return `<p class="empty">${msg}</p>${addBlank}`;
  }
  return `<div class="grid">${list.map((i) => itemCard(i, s)).join('')}</div>${addBlank}`;
}

function todoStrip(s) {
  const t = todo(s.items, s.settings);
  const tiles = [];
  for (const item of t.pickups.slice(0, 2)) {
    tiles.push(`<a class="todo todo-pending" href="#/item/${esc(item.id)}"><span class="todo-k">${item.pending?.when ? `Pickup ${esc(pickupLabel(item.pending.when))}` : 'Sale pending'}</span><span class="todo-v">${esc(item.title || 'Untitled find')}</span></a>`);
  }
  const tile = (filter, k, v, cls) => `<button class="todo ${cls}${s.filter === filter ? ' on' : ''}" data-action="filter" data-filter="${filter}"><span class="todo-k">${k}</span><span class="todo-v">${v}</span></button>`;
  if (t.cleanup.length) tiles.push(tile('cleanup', 'Take these down', `${plural(t.cleanup.length, 'sold item')} still posted`, 'todo-warn'));
  if (t.ready.length) tiles.push(tile('ready', 'Ready to post', plural(t.ready.length, 'item'), 'todo-go'));
  if (t.needs.length) tiles.push(tile('needs', 'Needs details', plural(t.needs.length, 'item'), 'todo-plain'));
  if (t.stale.length) tiles.push(tile('stale', `Listed ${s.settings.staleDays}+ days`, 'Drop the price?', 'todo-warn'));
  return tiles.length ? `<div class="todo-strip" aria-label="To do">${tiles.join('')}</div>` : '';
}

function installCard(s) {
  if (s.standalone || s.settings.hideInstall) return '';
  if (s.isIOS) {
    return `<section class="notice notice-install">
      <div><strong>Put Curbside on your Home Screen</strong>
      <p>In Safari tap ${ICON.share} Share, then <b>Add to Home Screen</b>. It opens like an app, and Home Screen apps keep their data (Safari can clear websites you haven't opened in a while).</p></div>
      <button class="icon-btn" data-action="dismiss-install" aria-label="Hide">${ICON.close}</button>
    </section>`;
  }
  if (s.installEvent) {
    return `<section class="notice notice-install">
      <div><strong>Install Curbside</strong><p>Opens like an app and works with no signal.</p>
      <button class="btn btn-small btn-primary" data-action="install">Install</button></div>
      <button class="icon-btn" data-action="dismiss-install" aria-label="Hide">${ICON.close}</button>
    </section>`;
  }
  return '';
}

function backupNudge(s) {
  if (s.items.length < 3 || Date.now() < (s.backupSnooze || 0)) return '';
  if (s.lastBackup && daysSince(s.lastBackup) < 14) return '';
  return `<section class="notice notice-backup">
    <div><strong>Back up your finds</strong>
    <p>${s.lastBackup ? `Last backup ${ago(s.lastBackup)}.` : 'No backup yet.'} Everything lives only on this phone, so a backup is your only copy if it's lost or reset.</p>
    <div class="notice-actions"><a class="btn btn-small btn-primary" href="#/settings">Back up now</a><button class="btn btn-small btn-ghost" data-action="snooze-backup">Later</button></div></div>
  </section>`;
}

export function chipsHtml(s) {
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, s.items.filter((i) => f.test(i, s)).length]));
  const special = SPECIAL[s.filter];
  return `<div class="chips" role="tablist">
    ${special ? `<button class="chip on" data-action="filter" data-filter="active" aria-label="Clear filter">${esc(special.label)} ${ICON.close}</button>` : ''}
    ${FILTERS.map((f) => `<button class="chip${s.filter === f.id ? ' on' : ''}" role="tab" aria-selected="${s.filter === f.id}" data-action="filter" data-filter="${f.id}">${f.label}<span class="chip-n">${counts[f.id]}</span></button>`).join('')}
  </div>`;
}

export function itemsView(s) {
  return `<header class="topbar">
    <div class="brand"><span class="brand-mark">${ICON.tag}</span><h1>Curbside</h1></div>
    <a class="icon-btn" href="#/settings" aria-label="Settings">${ICON.gear}</a>
  </header>
  <main class="page page-items">
    ${installCard(s)}
    ${backupNudge(s)}
    ${s.items.length ? todoStrip(s) : ''}
    ${s.items.length ? `<div class="search">${ICON.search}<input id="search" type="search" placeholder="Search your finds" value="${esc(s.query)}" autocomplete="off" enterkeyhint="search" aria-label="Search"></div>
    <div id="chips">${chipsHtml(s)}</div>` : ''}
    <div id="grid">${gridHtml(s)}</div>
  </main>
  ${tabbar('items')}`;
}

// ---------- One item ----------

function gallery(item) {
  if (!item.photos.length) {
    return `<section class="gallery gallery-empty">
      ${photoPicker('item', `${ICON.camera}<span>Add photos</span>`, 'add-first')}
    </section>`;
  }
  const many = item.photos.length > 1;
  return `<section class="gallery">
    <div class="hero" id="hero">${item.photos.map((id, n) => `<img src="${fullUrl(id)}" alt="Photo ${n + 1}" data-action="photo" data-n="${n}">`).join('')}</div>
    ${many ? `<div class="hero-count" id="hero-count">1 / ${item.photos.length}</div>` : ''}
    <div class="thumbs">
      ${item.photos.map((id, n) => `<button class="thumb${n === 0 ? ' cover' : ''}" data-action="photo" data-n="${n}" aria-label="Photo ${n + 1} options"><img src="${thumbUrl(id)}" alt="">${n === 0 && many ? '<span class="cover-tag">Cover</span>' : ''}</button>`).join('')}
      ${photoPicker('item', `${ICON.plus}<span>Add</span>`, 'thumb thumb-add')}
    </div>
  </section>`;
}

function takedownList(item) {
  const left = activeListings(item);
  if (!left.length) return '';
  return `<div class="takedown">
    <strong>Take it down so buyers stop messaging</strong>
    ${left.map((l) => {
      const p = platform(l.platform);
      return `<div class="takedown-row">${pdot(l.platform)}<span class="grow">${esc(p?.short || l.platform)}</span>
        <button class="btn btn-small" data-action="listing-open" data-platform="${esc(l.platform)}">Open ${ICON.external}</button>
        <button class="btn btn-small" data-action="takedown" data-platform="${esc(l.platform)}">${ICON.check} Done</button></div>`;
    }).join('')}
  </div>`;
}

export function statusPanel(s, item) {
  const id = esc(item.id);
  switch (item.status) {
    case 'tolist': {
      const missing = missingBits(item);
      return `<section class="panel panel-tolist" id="status-panel">
        <div class="panel-text"><strong>${missing.length ? `Add ${listJoin(missing)}` : 'Ready to post'}</strong>
        <span>${missing.length ? 'Then post it. Or post it now and fill in the rest there.' : 'Pick a site and everything will be ready to paste.'}</span></div>
        <a class="btn btn-primary btn-big" href="#/item/${id}/post">${ICON.share} Post it</a>
        <div class="panel-links"><button class="link" data-action="sheet" data-sheet="pending">Someone's buying it</button><button class="link" data-action="sheet" data-sheet="sold">Already sold</button><button class="link" data-action="sheet" data-sheet="done">Not selling it</button></div>
      </section>`;
    }
    case 'listed': {
      const active = activeListings(item);
      const since = daysSince(Math.min(...active.map((l) => l.listedAt)));
      const stale = isStale(item, s.settings.staleDays);
      const drops = stale ? priceDrops(item.price) : [];
      return `<section class="panel panel-listed" id="status-panel">
        <div class="panel-text"><strong>Listed on ${esc(listJoin(active.map((l) => platformName(l.platform))))}</strong>
        <span>${since ? `${plural(since, 'day')} so far` : 'Posted today'}${item.floor ? ` · lowest you'd take ${esc(money(item.floor))}` : ''}</span></div>
        ${stale ? `<div class="stale"><span>No sale after ${plural(daysSince(freshAt(item)), 'day')}. Drop the price, or renew it so it shows up again?</span>
          <div class="drop-row">${drops.map((v) => `<button class="btn btn-small" data-action="drop" data-price="${v}">Drop to ${esc(money(v))}</button>`).join('')}<button class="btn btn-small btn-ghost" data-action="renew-all">I renewed it</button></div></div>` : ''}
        <div class="panel-actions"><button class="btn btn-primary" data-action="sheet" data-sheet="sold">Sold it!</button><button class="btn" data-action="sheet" data-sheet="pending">Mark pending</button></div>
        <div class="panel-links"><a class="link" href="#/item/${id}/post">Post it somewhere else</a><button class="link" data-action="sheet" data-sheet="done">Not selling it</button></div>
      </section>`;
    }
    case 'pending': {
      const p = item.pending || {};
      const bits = [p.when && `Pickup ${pickupLabel(p.when)}`, p.price !== null && p.price !== undefined && `${money(p.price)} agreed`].filter(Boolean);
      return `<section class="panel panel-pending" id="status-panel">
        <div class="panel-text"><strong>${p.buyer ? `Pending with ${esc(p.buyer)}` : 'Sale pending'}</strong>
        <span>${esc(bits.join(' · ') || 'No pickup time yet')}</span>
        ${p.note ? `<span class="panel-note">${esc(p.note)}</span>` : ''}</div>
        <div class="panel-actions"><button class="btn btn-primary" data-action="sheet" data-sheet="sold">Sold it!</button><button class="btn" data-action="fell-through">Fell through</button></div>
        <div class="panel-links"><button class="link" data-action="sheet" data-sheet="pending">Change details</button></div>
      </section>`;
    }
    case 'sold': {
      const sale = item.sale || {};
      const days = daysToSell(item);
      return `<section class="panel panel-sold" id="status-panel">
        <div class="panel-text"><strong>Sold for ${esc(money(sale.price))}</strong>
        <span>${esc(platformName(sale.platform))} · ${esc(longDate(sale.date))}${sale.buyer ? ` · ${esc(sale.buyer)}` : ''}</span>
        <span>You made <b>${esc(money(profit(item)))}</b>${days === 0 ? ', sold the same day' : days !== null ? ` in ${plural(days, 'day')}` : ''}</span></div>
        ${takedownList(item)}
        <div class="panel-links"><button class="link" data-action="sheet" data-sheet="sold">Change sale</button><button class="link" data-action="undo-sale">Undo sale</button></div>
      </section>`;
    }
    default:
      return `<section class="panel panel-done" id="status-panel">
        <div class="panel-text"><strong>${esc(doneLabel(item.done?.reason))}</strong><span>${item.done?.date ? esc(longDate(item.done.date)) : ''}</span></div>
        <div class="panel-actions"><button class="btn" data-action="bring-back">Put it back up for sale</button></div>
      </section>`;
  }
}

const options = (list, current, blank) => `${blank ? `<option value="">${blank}</option>` : ''}${list
  .map(([value, label]) => `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`).join('')}`;

function detailsCard(item) {
  return `<section class="card">
    <div class="card-head"><h2>Listing</h2><button class="btn btn-small btn-ai" data-action="ai">${ICON.sparkle} Write it for me</button></div>
    <p class="hint save-hint">Tap any box to change it. Everything saves as you type.</p>
    <label class="field"><span class="field-label">Title</span>
      <input data-field="title" value="${esc(item.title)}" placeholder="e.g. Solid wood dresser, 6 drawers" maxlength="120" autocapitalize="sentences" enterkeyhint="next"></label>
    <div class="field-row">
      <label class="field"><span class="field-label">Price</span>
        <span class="money-wrap"><span>$</span><input data-field="price" value="${esc(moneyInput(item.price))}" inputmode="decimal" enterkeyhint="next"></span></label>
      <label class="field"><span class="field-label">Lowest I'd take</span>
        <span class="money-wrap"><span>$</span><input data-field="floor" value="${esc(moneyInput(item.floor))}" inputmode="decimal" placeholder="optional" enterkeyhint="next"></span></label>
    </div>
    <div class="field-row">
      <label class="field"><span class="field-label">Category</span>
        <select data-field="category">${options(CATEGORIES.map((c) => [c, c]), item.category, 'Pick one')}</select></label>
      <label class="field"><span class="field-label">Condition</span>
        <select data-field="condition">${options(CONDITIONS.map((c) => [c.id, c.label]), item.condition, 'Pick one')}</select></label>
    </div>
    <label class="field"><span class="field-label">Description</span>
      <textarea data-field="description" rows="5" placeholder="What it is, size, brand, any wear. Your pickup line gets added when you post.">${esc(item.description)}</textarea></label>
  </section>`;
}

const priceCheckCard = () => `<section class="card">
  <h2>What's it worth?</h2>
  <p class="hint">Searches your title on each site. eBay shows what things actually sold for.</p>
  <div class="link-grid">${PRICE_CHECKS.map((c) => `<button class="btn btn-small" data-action="price-check" data-check="${c.id}">${esc(c.label)} ${ICON.external}</button>`).join('')}</div>
</section>`;

function postedCard(item) {
  const rows = Object.entries(item.listings || {}).filter(([, l]) => l?.listedAt);
  const active = activeListings(item).length;
  const canPost = ['tolist', 'listed', 'pending'].includes(item.status);
  return `<section class="card">
    <h2>Where it's posted</h2>
    ${rows.length ? rows.map(([pid, l]) => `<div class="posted-row${l.removedAt ? ' removed' : ''}">
        ${pdot(pid)}
        <div class="grow"><div>${esc(platformName(pid))}</div>
        <div class="small muted">${l.removedAt ? `Taken down ${esc(ago(l.removedAt))}` : `Posted ${esc(ago(l.listedAt))}${l.renewedAt ? ` · renewed ${esc(ago(l.renewedAt))}` : ''}`}</div></div>
        <button class="btn btn-small" data-action="sheet" data-sheet="listing" data-platform="${esc(pid)}">Manage</button>
      </div>`).join('') : '<p class="muted">Not posted anywhere yet.</p>'}
    ${canPost ? `<a class="btn btn-block" href="#/item/${esc(item.id)}/post">${ICON.share} Post it ${active ? 'somewhere else' : 'somewhere'}</a>` : ''}
  </section>`;
}

const privateCard = (item) => `<section class="card">
  <h2>Just for you</h2>
  <p class="hint">Never goes in a listing.</p>
  <div class="field-row">
    <label class="field"><span class="field-label">Found on</span><input type="date" data-field="foundOn" value="${esc(isoDay(item.foundOn || item.createdAt))}"></label>
    <label class="field"><span class="field-label">Spent on it</span>
      <span class="money-wrap"><span>$</span><input data-field="cost" value="${esc(moneyInput(item.cost))}" inputmode="decimal" placeholder="0"></span></label>
  </div>
  <label class="field"><span class="field-label">Where you found it</span><input data-field="foundWhere" value="${esc(item.foundWhere)}" placeholder="e.g. Curb on Elm St"></label>
  <label class="field"><span class="field-label">Where it's stored</span><input data-field="storedAt" value="${esc(item.storedAt)}" placeholder="e.g. Garage, left shelf"></label>
  <label class="field"><span class="field-label">Notes</span><textarea data-field="notes" rows="3" placeholder="Cleaned it, missing a knob, repairs, anything">${esc(item.notes)}</textarea></label>
</section>`;

const historyCard = (item) => `<details class="card history">
  <summary><h2>History</h2></summary>
  <ol>${[...(item.history || [])].reverse().map((h) => `<li><span>${esc(h.text)}</span><time>${esc(longDate(h.t))}</time></li>`).join('')}</ol>
</details>`;

export function itemView(s, item) {
  return `${subbar(`<span class="badge badge-${item.status}">${STATUSES[item.status].label}</span><span class="saved" id="saved" aria-live="polite"></span>`,
    `<button class="icon-btn" data-action="delete-item" aria-label="Delete this item">${ICON.trash}</button>`)}
  <main class="page page-item">
    ${gallery(item)}
    ${statusPanel(s, item)}
    ${detailsCard(item)}
    ${priceCheckCard()}
    ${postedCard(item)}
    ${privateCard(item)}
    ${historyCard(item)}
    <div class="danger-row"><button class="btn btn-ghost btn-danger" data-action="delete-item">${ICON.trash} Delete this item</button></div>
  </main>`;
}

// ---------- Posting ----------

function readiness(item) {
  const missing = missingBits(item);
  if (!missing.length) return '';
  return `<div class="notice notice-warn"><div><strong>Missing ${esc(listJoin(missing))}</strong>
    <p>Most sites need a photo, a title and a price. <a href="#/item/${esc(item.id)}">Add them</a></p></div></div>`;
}

const enabledPlatforms = (s) => PLATFORMS.filter((p) => s.settings.platforms.includes(p.id));

export function postPickView(s, item) {
  const cover = item.photos[0] ? thumbUrl(item.photos[0]) : '';
  return `${subbar('Post it')}
  <main class="page page-post">
    <div class="post-preview">
      ${cover ? `<img src="${cover}" alt="">` : `<div class="no-photo">${ICON.image}</div>`}
      <div><div class="item-title">${item.title?.trim() ? esc(item.title) : '<span class="muted">Untitled find</span>'}</div>
      <div class="muted">${item.price !== null && item.price !== '' ? esc(money(item.price)) : 'No price yet'} · ${plural(item.photos.length, 'photo')}</div></div>
    </div>
    ${readiness(item)}
    <h2 class="section-title">Where to?</h2>
    <div class="platform-grid">
      ${enabledPlatforms(s).map((p) => `<a class="platform-tile${isListedOn(item, p.id) ? ' posted' : ''}" href="#/item/${esc(item.id)}/post/${p.id}">
        ${pdot(p.id, true)}<span class="pt-name">${esc(p.short)}</span>
        <span class="pt-sub">${isListedOn(item, p.id) ? `${ICON.check} Posted` : p.local ? 'Local pickup' : 'Ships'}</span></a>`).join('')}
    </div>
    <section class="card">
      <h2>Anywhere else</h2>
      <p class="hint">A Facebook group, a text to a friend, anything your phone can share to.</p>
      <button class="btn btn-block" data-action="share-all" ${s.kit?.files ? '' : 'disabled'}>${ICON.share} Share photos and description</button>
    </section>
    <p class="hint center">Missing a site? <a href="#/settings">Choose which sites show here</a></p>
  </main>`;
}

function copyRow(key, label, text, note = '') {
  return `<div class="copy-row${key === 'description' ? ' multi' : ''}" data-row="${key}">
    <div class="copy-main"><div class="copy-label">${label}${note ? ` <span class="copy-note">${esc(note)}</span>` : ''}</div>
    <div class="copy-text">${text ? esc(text) : '<span class="muted">Empty</span>'}</div></div>
    <button class="btn btn-small btn-copy" data-action="copy" data-copy="${key}" ${text ? '' : 'disabled'}>${ICON.copy}<span>Copy</span></button>
  </div>`;
}

export function kitView(s, item, p) {
  const n = item.photos.length;
  const texts = s.kit?.texts || {};
  const listed = isListedOn(item, p.id);
  const l = item.listings?.[p.id];
  const savePhotosHint = s.isIOS
    ? `Tap below, then <b>Save ${n === 1 ? 'Image' : `${n} Images`}</b>. They'll be the newest in your Photos.`
    : 'They go to your Downloads, ready to pick when you add photos.';
  const condition = item.condition ? conditionFor(p.id, item.condition) : '';
  return `${subbar(esc(p.name))}
  <main class="page page-kit">
    ${readiness(item)}
    <ol class="steps">
      <li class="step"><div class="step-n">1</div><div class="step-body">
        <h3>Save the photos</h3>
        <p class="hint">${savePhotosHint}</p>
        <button class="btn btn-block" data-action="save-photos" id="save-photos" ${n && s.kit?.files ? '' : 'disabled'}>${ICON.image} ${n ? `Save ${plural(n, 'photo')}` : 'No photos yet'}</button>
      </div></li>
      <li class="step"><div class="step-n">2</div><div class="step-body">
        <h3>Open ${esc(p.short)}</h3>
        <p class="hint">${esc(p.howTo)} If the link opens a web page instead of the app, just open the app yourself.</p>
        <a class="btn btn-block btn-platform p-${p.id}" href="${esc(p.post)}" target="_blank" rel="noopener">Open ${esc(p.name)} ${ICON.external}</a>
      </div></li>
      <li class="step"><div class="step-n">3</div><div class="step-body">
        <h3>Copy each part in</h3>
        <p class="hint">Tap Copy, switch back to ${esc(p.short)}, then press and hold in the box and tap Paste.</p>
        ${copyRow('title', 'Title', texts.title, titleWarning(texts.title, p.id))}
        ${copyRow('price', 'Price', texts.price)}
        ${copyRow('description', 'Description', texts.description)}
        ${item.category || condition ? `<div class="pick-row">
          ${item.category ? `<div><span class="copy-label">Category</span><b>${esc(item.category)}</b><span class="muted small">or the closest one</span></div>` : ''}
          ${condition ? `<div><span class="copy-label">Condition</span><b>${esc(condition)}</b><span class="muted small">pick this</span></div>` : ''}
        </div>` : ''}
        <button class="btn btn-block btn-ghost" data-action="copy" data-copy="all">${ICON.copy} Copy everything at once</button>
      </div></li>
      <li class="step"><div class="step-n">4</div><div class="step-body">
        ${listed
    ? `<h3>${ICON.check} Posted ${esc(ago(l.listedAt))}</h3><p class="hint">It's on your list as posted on ${esc(p.short)}.</p>
           <button class="btn btn-block" data-action="go-item">Back to the item</button>`
    : `<h3>Posted it?</h3>
           <label class="field"><span class="field-label">Link to your listing (optional)</span>
             <input data-kit="url" type="url" inputmode="url" placeholder="Paste the link" autocomplete="off"></label>
           <button class="btn btn-primary btn-block btn-big" data-action="mark-listed">${ICON.check} I posted it</button>`}
      </div></li>
    </ol>
  </main>`;
}

// ---------- Money ----------

export const PERIODS = [
  { id: 'month', label: 'This month', from: () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); } },
  { id: 'year', label: 'This year', from: () => new Date(new Date().getFullYear(), 0, 1).getTime() },
  { id: 'all', label: 'All time', from: () => -Infinity },
];

export function monthCaption(months, n) {
  const m = months[n];
  if (!m) return '';
  const name = new Date(m.start).toLocaleDateString('en-US', { month: 'long' });
  return `<b>${esc(name)}</b> ${esc(money(Math.round(m.profit)))} <span class="muted">from ${plural(m.count, 'sale')}</span>`;
}

// One series (profit per month): single hue, 24px columns rounded at the top only, one hairline
// baseline, and only the picked month's value is written on the chart.
export function monthChart(months, pick) {
  const W = 330;
  const H = 150;
  const base = 124;
  const top = 18;
  const slot = W / months.length;
  const barW = 24;
  const max = Math.max(1, ...months.map((m) => m.profit));
  const bars = months.map((m, n) => {
    const x = slot * n + (slot - barW) / 2;
    const h = m.profit > 0 ? Math.max(4, ((base - top) * m.profit) / max) : 0;
    const y = base - h;
    const r = Math.min(4, h);
    const path = h ? `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + barW - r}Q${x + barW},${y} ${x + barW},${y + r}V${base}Z` : '';
    return `<g class="col${n === pick ? ' picked' : ''}">
      ${path ? `<path class="bar" d="${path}"/>` : `<rect class="bar-zero" x="${x}" y="${base - 2}" width="${barW}" height="2" rx="1"/>`}
      ${n === pick ? `<text class="bar-value" x="${x + barW / 2}" y="${Math.max(12, y - 6)}" text-anchor="middle">${esc(money(Math.round(m.profit)))}</text>` : ''}
      <text class="bar-label" x="${x + barW / 2}" y="${base + 18}" text-anchor="middle">${esc(m.label)}</text>
      <rect class="hit" x="${slot * n}" y="0" width="${slot}" height="${H}" data-action="month" data-n="${n}"/>
    </g>`;
  }).join('');
  return `<svg class="month-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Profit per month, last ${months.length} months">
    <line class="baseline" x1="0" y1="${base + 0.5}" x2="${W}" y2="${base + 0.5}"/>${bars}</svg>`;
}

function platformBars(sum) {
  const rows = Object.entries(sum.byPlatform).sort((a, b) => b[1].profit - a[1].profit);
  if (!rows.length) return '<p class="muted">Sales will show up here.</p>';
  const max = Math.max(1, ...rows.map(([, v]) => v.profit));
  return `<div class="pbars">${rows.map(([pid, v]) => `<div class="pbar">
    <div class="pbar-head"><span>${pdot(pid)} ${esc(platformName(pid))}</span><span><b>${esc(money(Math.round(v.profit)))}</b> <span class="muted">· ${plural(v.count, 'sale')}</span></span></div>
    <div class="pbar-track"><div class="pbar-fill" data-w="${Math.max(2, (100 * Math.max(0, v.profit)) / max).toFixed(1)}"></div></div>
  </div>`).join('')}</div>`;
}

export function moneyView(s) {
  const period = PERIODS.find((p) => p.id === s.period) || PERIODS[0];
  const sum = summarize(s.items, period.from(), Infinity);
  const inv = inventory(s.items);
  const months = monthly(s.items, 6);
  const pick = s.monthPick ?? months.length - 1;
  const recent = sum.sold.slice(0, s.showAllSales ? undefined : 8);
  return `<header class="topbar"><h1 class="page-title">Money</h1></header>
  <main class="page page-money">
    <div class="seg" role="tablist">${PERIODS.map((p) => `<button role="tab" aria-selected="${p.id === period.id}" class="${p.id === period.id ? 'on' : ''}" data-action="period" data-period="${p.id}">${p.label}</button>`).join('')}</div>
    <section class="hero-stat">
      <div class="hero-label">You made</div>
      <div class="hero-value">${esc(money(Math.round(sum.profit)))}</div>
      <div class="hero-sub">${sum.count ? `from ${plural(sum.count, 'sale')}${sum.spent ? `, after ${esc(money(Math.round(sum.spent)))} in costs and fees` : ''}` : 'No sales yet in this stretch'}</div>
    </section>
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">Items sold</div><div class="stat-value">${sum.count}</div></div>
      <div class="stat"><div class="stat-label">Average sale</div><div class="stat-value">${sum.count ? esc(money(Math.round(sum.avgSale))) : '–'}</div></div>
      <div class="stat"><div class="stat-label">Days to sell</div><div class="stat-value">${sum.avgDays !== null ? Math.round(sum.avgDays) : '–'}</div><div class="stat-sub">on average</div></div>
      <div class="stat"><div class="stat-label">Waiting to sell</div><div class="stat-value">${inv.count}</div><div class="stat-sub">${esc(money(inv.value))} asking</div></div>
    </div>
    <section class="card">
      <h2>Profit, last 6 months</h2>
      <div class="chart-caption" id="month-caption">${monthCaption(months, pick)}</div>
      <div id="month-chart">${monthChart(months, pick)}</div>
    </section>
    <section class="card"><h2>Where it sells</h2>${platformBars(sum)}</section>
    <section class="card">
      <h2>Sales</h2>
      ${recent.length ? `<div class="sales">${recent.map((i) => `<a class="sale-row" href="#/item/${esc(i.id)}">
        ${i.photos[0] ? `<img src="${thumbUrl(i.photos[0])}" alt="">` : `<div class="no-photo">${ICON.image}</div>`}
        <div class="grow"><div class="sale-title">${esc(i.title || 'Untitled find')}</div><div class="small muted">${esc(shortDate(i.sale.date))} · ${esc(platformName(i.sale.platform))}</div></div>
        <div class="sale-money"><b>${esc(money(profit(i)))}</b>${profit(i) !== i.sale.price ? `<span class="small muted">sold ${esc(money(i.sale.price))}</span>` : ''}</div>
      </a>`).join('')}</div>
      ${sum.sold.length > recent.length ? `<button class="btn btn-block btn-ghost" data-action="all-sales">Show all ${sum.sold.length}</button>` : ''}` : '<p class="muted">Nothing sold in this stretch yet.</p>'}
    </section>
    <button class="btn btn-block" data-action="export-csv">Download everything as a spreadsheet</button>
  </main>
  ${tabbar('money')}`;
}

// ---------- Settings ----------

export function settingsView(s) {
  const st = s.settings;
  const used = s.storage?.usage;
  return `${subbar('Settings')}
  <main class="page page-settings">
    <section class="card">
      <h2>Added to your listings</h2>
      <label class="field"><span class="field-label">Pickup area</span>
        <input data-setting="pickupArea" value="${esc(st.pickupArea)}" placeholder="e.g. Near Main St & 5th Ave" autocomplete="off"></label>
      <label class="field"><span class="field-label">Add to the end of every local listing</span>
        <textarea data-setting="footer" rows="3" placeholder="e.g. Cash or Venmo. Porch pickup. If it's still posted, it's still available!">${esc(st.footer)}</textarea></label>
      <label class="check"><input type="checkbox" data-setting="addCondition" ${st.addCondition !== false ? 'checked' : ''}> Add a "Condition:" line</label>
      <p class="hint">Mercari, eBay and Poshmark ship, so they don't get the pickup lines.</p>
      <label class="field"><span class="field-label">Nudge me to drop the price after</span>
        <select data-setting="staleDays">${options([7, 10, 14, 21, 30].map((d) => [String(d), `${d} days`]), String(st.staleDays))}</select></label>
    </section>

    <section class="card">
      <h2>Where you sell</h2>
      ${PLATFORMS.map((p) => `<label class="check platform-check"><input type="checkbox" data-platform-toggle="${p.id}" ${st.platforms.includes(p.id) ? 'checked' : ''}>${pdot(p.id)} ${esc(p.name)}<span class="muted small">${p.local ? 'local' : 'ships'}</span></label>`).join('')}
    </section>

    <section class="card" id="ai-settings">
      <h2>${ICON.sparkle} AI listing writer <span class="pill">optional · free</span></h2>
      <p>Tap <b>Write it for me</b> on an item and AI works out what it is from the photos, writes the title and description, and suggests a price.</p>
      ${st.geminiKey
    ? `<div class="key-on">${ICON.check} One-tap AI is on <span class="muted">(key ending ${esc(st.geminiKey.slice(-4))})</span></div>
         <div class="btn-row"><button class="btn btn-small" data-action="test-key">Test it</button><button class="btn btn-small btn-ghost btn-danger" data-action="remove-key">Remove key</button></div>`
    : `<p class="hint">Without a key it still works for free: it hands the photos to ChatGPT (or any AI app) and you paste the answer back. A free Google key makes it one tap:</p>
         <ol class="mini-steps">
           <li>Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> and sign in with any Google account.</li>
           <li>Tap <b>Create API key</b>, then copy it.</li>
           <li>Paste it here. Never add billing there and it can't cost anything.</li>
         </ol>
         <div class="key-row"><input id="gemini-key" type="password" placeholder="Paste your key" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn btn-primary" data-action="save-key">Save</button></div>`}
      <p class="hint">Photos you send to AI go to Google (or whichever app you pick). Google may use free-tier requests to improve its products, so don't snap anything personal.</p>
    </section>

    <section class="card" id="backup">
      <h2>Backup</h2>
      <p>Your finds live only on this phone. A backup is a .zip of every item and photo; save it to Files, Google Drive or email it to yourself.</p>
      <p class="hint">${s.lastBackup ? `Last backup ${esc(ago(s.lastBackup))} (${esc(longDate(s.lastBackup))}).` : 'No backup yet.'}</p>
      ${s.backupFile
    ? `<button class="btn btn-primary btn-block" data-action="backup-save">${ICON.share} Save backup (${(s.backupFile.size / 1048576).toFixed(1)} MB)</button>`
    : `<button class="btn btn-primary btn-block" data-action="backup" ${s.items.length ? '' : 'disabled'}>Back up now</button>`}
      <label class="btn btn-block btn-ghost">Restore from a backup<input type="file" accept=".zip,application/zip,application/x-zip-compressed" class="file-hidden" data-pick="restore"></label>
      <p class="hint">Restoring adds the backup's items to what's here. Items in both keep whichever copy was changed last.</p>
    </section>

    <section class="card">
      <h2>This phone</h2>
      <p>${plural(s.items.length, 'item')}${used !== undefined ? ` · using ${(used / 1048576).toFixed(1)} MB` : ''}</p>
      ${s.persisted === true ? `<p class="hint">${ICON.check} The browser has agreed not to clear Curbside's data.</p>` : ''}
      ${s.persisted === false && !s.isIOS ? '<button class="btn btn-small" data-action="persist">Ask the browser to keep my data</button>' : ''}
      ${!s.standalone ? `<p class="hint">${s.isIOS ? 'Tip: add Curbside to your Home Screen (Share, then Add to Home Screen) so Safari never clears it.' : 'Tip: install Curbside from your browser menu so it opens like an app.'}</p>` : ''}
      ${s.settings.hideInstall && !s.standalone ? '<button class="btn btn-small btn-ghost" data-action="show-install">Show the install tip again</button>' : ''}
    </section>

    <section class="card card-danger">
      <h2>Wipe app</h2>
      <p>Deletes every item, photo and setting in Curbside on this phone. Nothing else on the phone is touched. Back up first if you might want them.</p>
      <label class="check"><input type="checkbox" id="wipe-ok"> I understand</label>
      <button class="btn btn-danger btn-block" data-action="wipe" id="wipe-btn" disabled>Wipe Curbside</button>
    </section>
    <p class="version">Curbside ${esc(s.version)}</p>
  </main>`;
}

// ---------- Sheets (pop-ups from the bottom) ----------

function soldSheet(s, item) {
  const active = activeListings(item).map((l) => l.platform);
  const sale = item.sale;
  const others = s.settings.platforms.filter((id) => !active.includes(id));
  const current = sale?.platform || (active.length === 1 ? active[0] : active[0]) || IN_PERSON.id;
  const choices = [...active, ...others, IN_PERSON.id].filter((v, i, a) => a.indexOf(v) === i);
  const price = sale?.price ?? item.pending?.price ?? item.price;
  return `<h2>${sale ? 'Change the sale' : 'Sold it!'}</h2>
    <div class="field-row">
      <label class="field"><span class="field-label">Sold for</span><span class="money-wrap"><span>$</span><input data-sf="price" inputmode="decimal" value="${esc(moneyInput(price))}"></span></label>
      <label class="field"><span class="field-label">Date</span><input type="date" data-sf="date" value="${esc(isoDay(sale?.date || Date.now()))}"></label>
    </div>
    <label class="field"><span class="field-label">Sold on</span><select data-sf="platform">${options(choices.map((id) => [id, platform(id)?.name || id]), current)}</select></label>
    <label class="field"><span class="field-label">Buyer (optional)</span><input data-sf="buyer" value="${esc(sale?.buyer || item.pending?.buyer || '')}"></label>
    <label class="field"><span class="field-label">Fees or shipping (optional)</span><span class="money-wrap"><span>$</span><input data-sf="fees" inputmode="decimal" value="${esc(moneyInput(sale?.fees || ''))}" placeholder="0"></span></label>
    <div class="sheet-actions"><button class="btn" data-action="close-sheet">Cancel</button><button class="btn btn-primary" data-action="save-sold">Save sale</button></div>`;
}

function pendingSheet(item) {
  const p = item.pending || {};
  return `<h2>Someone's buying it</h2>
    <label class="field"><span class="field-label">Buyer</span><input data-sf="buyer" value="${esc(p.buyer || '')}" placeholder="Their name on the app" autocomplete="off"></label>
    <div class="field-row">
      <label class="field"><span class="field-label">Pickup</span><input type="datetime-local" data-sf="when" value="${esc(p.when || '')}"></label>
      <label class="field"><span class="field-label">Agreed price</span><span class="money-wrap"><span>$</span><input data-sf="price" inputmode="decimal" value="${esc(moneyInput(p.price ?? item.price))}"></span></label>
    </div>
    <label class="field"><span class="field-label">Note</span><input data-sf="note" value="${esc(p.note || '')}" placeholder="e.g. Bringing a truck, paying Venmo"></label>
    <div class="sheet-actions"><button class="btn" data-action="close-sheet">Cancel</button><button class="btn btn-primary" data-action="save-pending">Save</button></div>`;
}

const doneSheet = () => `<h2>Not selling it?</h2>
  <p class="hint">It moves to "Not selling". You can put it back any time.</p>
  <div class="choice-grid">${DONE_REASONS.map((r) => `<button class="btn" data-action="done" data-reason="${r.id}">${esc(r.label)}</button>`).join('')}</div>
  <div class="sheet-actions"><button class="btn btn-ghost" data-action="close-sheet">Cancel</button></div>`;

function photoSheet(item, n) {
  const id = item.photos[n];
  const last = item.photos.length - 1;
  return `<div class="sheet-photo"><img src="${fullUrl(id)}" alt="Photo ${n + 1}"></div>
    <div class="choice-grid">
      ${n > 0 ? `<button class="btn" data-action="photo-cover">${ICON.star} Make it the cover</button>` : ''}
      <button class="btn" data-action="photo-rotate">${ICON.rotate} Rotate</button>
      ${n > 0 ? `<button class="btn" data-action="photo-move" data-dir="-1">${ICON.left} Move left</button>` : ''}
      ${n < last ? `<button class="btn" data-action="photo-move" data-dir="1">Move right ${ICON.right}</button>` : ''}
      <button class="btn btn-danger" data-action="photo-delete">${ICON.trash} Delete photo</button>
    </div>
    <div class="sheet-actions"><button class="btn btn-ghost" data-action="close-sheet">Done</button></div>`;
}

function listingSheet(item, pid) {
  const l = item.listings?.[pid] || {};
  const p = platform(pid);
  return `<h2>${pdot(pid)} ${esc(p?.name || pid)}</h2>
    <p class="hint">${l.removedAt ? `Taken down ${esc(ago(l.removedAt))}.` : `Posted ${esc(ago(l.listedAt))}${l.renewedAt ? `, renewed ${esc(ago(l.renewedAt))}` : ''}.`}</p>
    <label class="field"><span class="field-label">Link to the listing</span>
      <input data-sf="url" type="url" inputmode="url" value="${esc(l.url || '')}" placeholder="Paste the link (optional)" autocomplete="off"></label>
    <div class="choice-grid">
      <button class="btn" data-action="listing-open" data-platform="${esc(pid)}">${ICON.external} Open it</button>
      ${l.removedAt
    ? `<button class="btn" data-action="listing-again" data-platform="${esc(pid)}">Posted it again</button>`
    : `<button class="btn" data-action="listing-renew" data-platform="${esc(pid)}">I renewed it today</button>
         <button class="btn" data-action="takedown" data-platform="${esc(pid)}">I took it down</button>`}
      <button class="btn btn-ghost btn-danger" data-action="listing-remove" data-platform="${esc(pid)}">Remove from list</button>
    </div>
    <div class="sheet-actions"><button class="btn" data-action="close-sheet">Cancel</button><button class="btn btn-primary" data-action="listing-save" data-platform="${esc(pid)}">Save</button></div>`;
}

function aiSheet(s, item) {
  const ai = s.ai || {};
  if (ai.phase === 'busy') {
    return `<div class="ai-busy"><div class="spinner" aria-hidden="true"></div><h2>Looking at your photos…</h2>
      <p class="hint">Usually takes 5 to 15 seconds.</p>
      <button class="btn" data-action="ai-cancel">Cancel</button></div>`;
  }
  if (ai.phase === 'error') {
    return `<h2>That didn't work</h2><p>${esc(ai.error)}</p>
      <div class="sheet-actions"><button class="btn" data-action="close-sheet">Close</button><button class="btn btn-primary" data-action="ai">Try again</button></div>`;
  }
  if (ai.phase === 'paste') {
    return `<h2>Paste the AI's answer</h2>
      <p class="hint">Press and hold in the box, tap Paste, then Use this.</p>
      <textarea data-sf="reply" rows="8" placeholder="TITLE: …"></textarea>
      ${ai.error ? `<p class="error">${esc(ai.error)}</p>` : ''}
      <div class="sheet-actions"><button class="btn" data-action="close-sheet">Cancel</button><button class="btn btn-primary" data-action="ai-parse">Use this</button></div>`;
  }
  if (ai.phase === 'result') {
    const sug = ai.suggestion;
    const fields = [
      ['title', 'Title', sug.title, item.title],
      ['price', 'Price', sug.price !== null ? money(sug.price) : '', item.price !== null && item.price !== '' ? money(item.price) : ''],
      ['category', 'Category', sug.category, item.category],
      ['condition', 'Condition', conditionLabel(sug.condition), conditionLabel(item.condition)],
      ['description', 'Description', sug.description, item.description],
    ].filter(([, , value]) => value);
    return `<h2>${ICON.sparkle} Here's a listing</h2>
      ${sug.what ? `<p class="ai-what">Looks like: <b>${esc(sug.what)}</b></p>` : ''}
      ${sug.price !== null ? `<div class="ai-price"><div class="ai-price-v">${esc(money(sug.price))}</div><div class="small">
        ${sug.priceLow !== null && sug.priceHigh !== null ? `Used ones go for about ${esc(money(sug.priceLow))} to ${esc(money(sug.priceHigh))}.` : 'Suggested asking price.'}
        ${sug.priceNote ? `<br><span class="muted">${esc(sug.priceNote)}</span>` : ''}</div></div>` : ''}
      <p class="hint">Tick what you want to use.</p>
      ${fields.map(([key, label, value, current]) => `<label class="ai-field">
        <input type="checkbox" data-use="${key}" ${current ? '' : 'checked'}>
        <div><div class="ai-k">${label}${current && current !== value ? ' <span class="muted small">replaces yours</span>' : ''}</div><div class="ai-v">${esc(value)}</div></div>
      </label>`).join('')}
      <p class="hint">AI can be wrong. Check the details, and use "What's it worth?" to check the price.</p>
      <div class="sheet-actions"><button class="btn" data-action="close-sheet">Cancel</button><button class="btn btn-primary" data-action="ai-apply">Use these</button></div>`;
  }
  // No key: the free route through an AI app she already has.
  const canShare = s.canShareFiles;
  return `<h2>${ICON.sparkle} Write it for me</h2>
    <p>AI looks at your photos, works out what it is, writes the listing and suggests a price.</p>
    <div class="option">
      <h3>Free, with ChatGPT</h3>
      <ol class="mini-steps">
        ${canShare
    ? '<li>Tap <b>Send to ChatGPT</b> and pick ChatGPT from the list (Gemini or Claude work too).</li><li>Send it. If only the photos show up, paste: the question is already copied.</li>'
    : '<li>Tap <b>Copy the question</b> and <b>Save photos</b>, then open ChatGPT, add the photos and paste.</li>'}
        <li>Copy ChatGPT's whole answer, come back here and tap <b>Paste answer</b>.</li>
      </ol>
      <div class="btn-row">
        ${canShare
    ? `<button class="btn btn-primary" data-action="ai-share" ${ai.files ? '' : 'disabled'}>${ICON.share} Send to ChatGPT</button>`
    : `<button class="btn" data-action="ai-copy-prompt">${ICON.copy} Copy the question</button><button class="btn" data-action="ai-save-photos" ${ai.files ? '' : 'disabled'}>${ICON.image} Save photos</button>`}
        <button class="btn" data-action="ai-paste">Paste answer</button>
      </div>
    </div>
    <div class="option">
      <h3>One tap, also free</h3>
      <p class="hint">Add a free Google AI key once, and this button does the whole thing by itself.</p>
      <button class="btn btn-small" data-action="ai-setup">Set it up</button>
    </div>`;
}

export function sheetView(s, item) {
  const sh = s.sheet;
  if (!sh || !item) return '';
  let body = '';
  let label = '';
  switch (sh.type) {
    case 'sold': body = soldSheet(s, item); label = 'Sold'; break;
    case 'pending': body = pendingSheet(item); label = 'Pending sale'; break;
    case 'done': body = doneSheet(); label = 'Not selling'; break;
    case 'photo': body = photoSheet(item, sh.n); label = 'Photo'; break;
    case 'listing': body = listingSheet(item, sh.platform); label = 'Listing'; break;
    case 'ai': body = aiSheet(s, item); label = 'AI listing writer'; break;
    default: return '';
  }
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="sheet-grab" aria-hidden="true"></div>${body}</div>`;
}
