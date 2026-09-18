// Keeps Curbside working with no signal (out on the road, in a garage). Bump CACHE together with
// VERSION in app.js on every release so phones pick up the new files.
const CACHE = 'curbside-1.3.1';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'views.js',
  'model.js',
  'listing.js',
  'platforms.js',
  'photos.js',
  'db.js',
  'ai.js',
  'zip.js',
  'util.js',
  'replies.js',
  'calendar.js',
  'tour.js',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('curbside-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok && new URL(request.url).pathname.startsWith(new URL(self.registration.scope).pathname)) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => (request.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
