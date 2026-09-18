// Guided tours. The screen dims and one thing at a time stays lit, with a note saying what it's
// for. Each screen has its own short tour, shown the first time she lands there. The app can't be
// tapped while a tour is up (a clear layer sits over it), so nothing changes by accident.

let tour = null;

export const tourActive = () => Boolean(tour);

const target = (step) => (step?.target ? document.querySelector(step.target) : null);

export function runTour(steps, onEnd) {
  stopTour();
  const list = steps.filter((step) => !step.target || target(step));
  if (!list.length) return false;
  const root = document.createElement('div');
  root.id = 'tour';
  root.innerHTML = `<div class="tour-shade"></div><div class="tour-hole"></div>
    <div class="tour-card" role="dialog" aria-modal="true" aria-live="polite"><div class="tour-arrow" hidden></div><div class="tour-body"></div></div>`;
  document.body.append(root);
  document.documentElement.classList.add('touring');
  tour = { root, list, n: 0, onEnd };
  root.addEventListener('click', onClick);
  window.addEventListener('resize', place);
  document.addEventListener('keydown', onKey, true);
  show(0);
  return true;
}

export function stopTour(how = null) {
  if (!tour) return;
  const { root, onEnd } = tour;
  tour = null;
  root.remove();
  document.documentElement.classList.remove('touring');
  window.removeEventListener('resize', place);
  document.removeEventListener('keydown', onKey, true);
  if (how) onEnd?.(how);
}

function show(n) {
  const { list, root } = tour;
  tour.n = n;
  const step = list[n];
  const last = n === list.length - 1;
  // Titles and texts are written in tours below, never typed by her, so they can hold <b>.
  root.querySelector('.tour-body').innerHTML = `
    ${list.length > 1 ? `<div class="tour-count">${n + 1} of ${list.length}</div>` : ''}
    <h3>${step.title}</h3>
    <p>${step.text}</p>
    <div class="tour-actions">
      ${last ? '' : '<button class="tour-skip" data-tour="skip">Skip tour</button>'}
      <span class="tour-gap"></span>
      ${n > 0 ? '<button class="tour-btn tour-back" data-tour="back">Back</button>' : ''}
      <button class="tour-btn tour-next" data-tour="next">${last ? step.done || 'Got it' : 'Next'}</button>
    </div>`;
  const el = target(step);
  if (el) bringIntoView(el);
  place();
  root.querySelector('.tour-next').focus({ preventScroll: true });
}

function pinned(el) {
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    const pos = getComputedStyle(e).position;
    if (pos === 'fixed' || pos === 'sticky') return true;
  }
  return false;
}

// Scroll so the lit thing sits in the upper part of the screen, leaving room for the note.
function bringIntoView(el) {
  if (pinned(el)) return;
  const r = el.getBoundingClientRect();
  const want = r.height > window.innerHeight * 0.45 ? 80 : Math.max(80, window.innerHeight * 0.28 - r.height / 2);
  window.scrollTo(0, Math.max(0, window.scrollY + r.top - want));
}

// Sizes are set through el.style (the page's security policy blocks inline style attributes).
function place() {
  if (!tour) return;
  const { root, list, n } = tour;
  const hole = root.querySelector('.tour-hole');
  const card = root.querySelector('.tour-card');
  const arrow = root.querySelector('.tour-arrow');
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(360, vw - 32);
  card.style.width = `${cardW}px`;
  const el = target(list[n]);

  if (!el) {
    hole.classList.add('none');
    Object.assign(hole.style, { top: `${vh / 2}px`, left: `${vw / 2}px`, width: '0px', height: '0px' });
    card.style.left = `${(vw - cardW) / 2}px`;
    card.style.top = `${Math.max(16, (vh - card.offsetHeight) / 2)}px`;
    arrow.hidden = true;
    return;
  }

  hole.classList.remove('none');
  const r = el.getBoundingClientRect();
  const pad = 8;
  const top = Math.max(4, r.top - pad);
  const left = Math.max(4, r.left - pad);
  const bottom = Math.min(vh - 4, r.bottom + pad);
  const right = Math.min(vw - 4, r.right + pad);
  Object.assign(hole.style, { top: `${top}px`, left: `${left}px`, width: `${right - left}px`, height: `${bottom - top}px` });

  const ch = card.offsetHeight;
  const gap = 16;
  let cardTop;
  let side = null; // which way the arrow points
  if (bottom + gap + ch <= vh - 12) {
    cardTop = bottom + gap;
    side = 'up';
  } else if (top - gap - ch >= 12) {
    cardTop = top - gap - ch;
    side = 'down';
  } else {
    cardTop = Math.max(12, vh - ch - 12); // a tall thing: the note sits over its lower part
  }
  const cx = (left + right) / 2;
  const cardLeft = Math.min(Math.max(16, cx - cardW / 2), vw - 16 - cardW);
  card.style.left = `${cardLeft}px`;
  card.style.top = `${cardTop}px`;
  arrow.hidden = !side;
  arrow.className = `tour-arrow ${side || ''}`;
  arrow.style.left = `${Math.min(Math.max(18, cx - cardLeft - 9), cardW - 36)}px`;
}

function onClick(e) {
  const button = e.target.closest('[data-tour]');
  if (!button || !tour) return;
  const action = button.dataset.tour;
  if (action === 'next') {
    if (tour.n === tour.list.length - 1) stopTour('done');
    else show(tour.n + 1);
  } else if (action === 'back') show(Math.max(0, tour.n - 1));
  else if (action === 'skip') stopTour('skip');
}

function onKey(e) {
  if (!tour) return;
  if (e.key === 'Escape') stopTour('skip');
  else if (e.key === 'ArrowRight') tour.n === tour.list.length - 1 ? stopTour('done') : show(tour.n + 1);
  else if (e.key === 'ArrowLeft') show(Math.max(0, tour.n - 1));
  else return;
  e.preventDefault();
  e.stopPropagation();
}

// ---------- what each tour says ----------

export const TOURS = {
  // On iPhone in Safari: the Home Screen app keeps separate data, so the only job is to install.
  safari: () => [{
    target: '.notice-install',
    title: 'First, put Curbside on your Home Screen',
    text: 'Tap <b>Share</b> at the bottom of Safari, then <b>Add to Home Screen</b>, and open Curbside from there from now on. The Home Screen app keeps its own copy of your finds, separate from Safari, and a quick tour will show you around.',
    done: 'Got it',
  }],

  home: () => [
    { title: 'Welcome to Curbside 💜', text: "Here's a one-minute tour of the app. You can skip it any time, and replay it from Settings." },
    { target: '.tab-snap', title: 'Add a find', text: "Found something good? Tap the camera to take a photo or pick one from your camera roll. It's saved straight away, so you can fill in the details whenever you like." },
    { target: '[data-action="add-blank"]', title: 'No photo yet?', text: 'Add it without one and put the photos in later.' },
    { target: '.todo-strip', title: 'Your to-do list', text: 'Pickups coming up, finds ready to post, and listings that need a price drop show up here.' },
    { target: '#chips', title: 'Filters', text: "Show what's To list, Listed, Pending or Sold. The search box finds anything by name, notes or where it's stored." },
    { target: '.tabbar .tab[href="#/"]', title: 'Items', text: "Everything you've found lives here. Tap a find to see it, change it, post it or mark it sold." },
    { target: '.tabbar .tab[href="#/money"]', title: 'Money', text: "What you've made this month and all time, which site sells best, and a spreadsheet download." },
    { target: '.topbar a[href="#/settings"]', title: 'Settings', text: 'Holiday themes, your pickup area and the line added to every listing, which sites you use, the free AI helper, and backups.' },
    { target: '.notice-install', title: 'Install it', text: 'Tap <b>Install</b> so Curbside opens like an app and works with no signal.' },
    { target: '.notice-backup', title: 'Back up now and then', text: 'Your finds live only on this phone. A backup keeps a copy you can bring back if the phone is lost or reset.' },
    { title: "You're all set!", text: 'Tap the camera to add your first find. The first time you open a find, post one or check your money, a quick tour shows you what\'s there.', done: "Let's go" },
  ],

  item: () => [
    { target: '.gallery .thumbs, .gallery-empty .add-first', title: 'Your photos', text: 'Swipe the big photo to see them all. Tap a small one to rotate it, make it the cover or delete it. The <b>+</b> adds more.' },
    { target: '.shot-list', title: 'Photo checklist', text: 'The shots buyers want to see for this kind of item. Tick them off as you take them.' },
    { target: '#status-panel', title: 'What to do next', text: 'This box changes as your find moves along: <b>Post it</b>, then <b>Mark pending</b> when someone is coming, then <b>Sold it!</b>' },
    { target: '.btn-ai', title: 'Write it for me', text: 'Free AI looks at your photos, names the item, writes the listing and suggests a price.' },
    { target: '[data-field="title"]', title: 'Just type', text: "Tap any box to change it. Everything saves by itself, so there's no Save button to look for." },
    { target: '#worth-card', title: "What's it worth?", text: 'Looks up what similar things sell for on eBay, Marketplace, OfferUp and Vinted.' },
    { target: '.replies summary', title: 'Reply to buyers', text: 'Ready-made answers to "Is this still available?" and the rest. Tap one to copy it into the chat.' },
    { target: '#private-card', title: 'Just for you', text: "Where you found it, where it's stored and what you spent on it. None of this goes in a listing." },
    { target: '.topbar [data-action="delete-item"]', title: 'Delete', text: 'Removes this find. Tapped it by mistake? Tap <b>Undo</b> on the message that pops up.', done: 'Got it' },
  ],

  post: () => [
    { target: '.platform-grid', title: 'Pick your sites', text: 'Tick every site you want to post on. Next time, the same ones are ticked for you.' },
    { target: '.start-bar', title: 'Post them all', text: 'Curbside takes you through each site in turn. You save the photos once, then copy and paste for each one.' },
    { target: '[data-action="share-all"]', title: 'Anywhere else', text: 'Sends the photos and description to a Facebook group, a text, or any app on your phone.', done: 'Got it' },
  ],

  kit: () => [
    { target: '.run-bar', title: "Where you're up to", text: 'Shows which site you\'re on. Each <b>I posted it</b> moves you on to the next one.' },
    { target: '.steps .step:nth-child(1)', title: '1. Save the photos', text: 'Puts them in your camera roll, ready to pick in the other app.' },
    { target: '.btn-platform', title: '2. Open the app', text: "Opens the site's sell page. Add the photos you just saved." },
    { target: '.steps .step:nth-child(3) .copy-row', title: '3. Copy, then paste', text: 'Tap <b>Copy</b>, switch to the other app, press and hold in the box and tap <b>Paste</b>. Do the same for the title, price and description.' },
    { target: '[data-action="mark-listed"]', title: '4. Tell Curbside', text: "Once it's up, tap here so Curbside knows where it's posted.", done: 'Got it' },
  ],

  money: () => [
    { target: '.hero-stat', title: "What you've made", text: 'Your profit, after anything you spent on the items and any fees.' },
    { target: '.seg', title: 'Pick a time', text: 'This month, this year or all time.' },
    { target: '#chart-card', title: 'Month by month', text: 'Tap a bar to see that month.' },
    { target: '#sites-card', title: 'Where it sells', text: 'Which site brings in the most.' },
    { target: '[data-action="export-csv"]', title: 'Spreadsheet', text: 'Downloads everything for Excel or Google Sheets. Handy at tax time.', done: 'Got it' },
  ],
};
