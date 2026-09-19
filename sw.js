// Offline support and instant start: app files are served from the cache and refreshed in the
// background (the newest version is used from the next launch). Encrypted photos never change
// once written, so they're cached as-is.

const CACHE = 'tile-match-v6';
const PHOTOS = 'tile-match-photos'; // kept across app updates so photos never download twice
const APP = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/main.js', 'js/game.js', 'js/board.js', 'js/art.js', 'js/ui.js',
  'js/sound.js', 'js/i18n.js', 'js/store.js', 'js/photos.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  // 'reload' skips the browser's HTTP cache, so a new version never installs stale files
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(APP.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== PHOTOS).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);

  // the photo list should be fresh so newly added photos show up, but never wait long for it
  if (url.pathname.endsWith('/photos/index.json')) {
    const network = fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(PHOTOS).then(c => c.put(req, copy));
      }
      return res;
    });
    const cached = () => caches.open(PHOTOS).then(c => c.match(req));
    const slow = new Promise(resolve => setTimeout(resolve, 4000)).then(cached);
    e.respondWith(Promise.race([network.catch(cached), slow.then(r => r || network)]));
    return;
  }

  // encrypted photos never change: download once, then always serve from the cache
  if (url.pathname.includes('/photos/') && url.pathname.endsWith('.bin')) {
    e.respondWith(
      caches.open(PHOTOS).then(async cache => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // everything else: cache first, refresh in the background
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const refresh = fetch(req).then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || refresh;
    }),
  );
});
