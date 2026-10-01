// Offline support and instant start: app files are served from the cache. Each release changes
// this file, and the new worker downloads every app file fresh before it takes over (the newest
// version is used from the next launch). Encrypted photos never change once written, so they're
// cached as-is.

const CACHE = 'tile-match-v31';
const BUILD = 31;
const PHOTOS = 'tile-match-photos'; // kept across app updates so photos never download twice
// The painted rider sheets are kept across updates too. Their names change with their pictures
// (tools/riders.mjs writes this list), so a changed sheet is a new file and the old one is let go.
const RIDERS = 'tile-match-riders';
const RIDER_FILES = ['riders/bunny.c9491fa8.webp', 'riders/capy.d5c6c0d8.webp', 'riders/kitty.595d7031.webp', 'riders/panda.46010c28.webp', 'riders/penguin.85409fe2.webp', 'riders/unicorn.dc846968.webp'];
const APP = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/main.js', 'js/game.js', 'js/board.js', 'js/art.js', 'js/ui.js',
  'js/sound.js', 'js/sfx.js', 'js/i18n.js', 'js/store.js', 'js/photos.js', 'js/version.js',
  'js/report.js', 'js/backup.js', 'js/splash.js', 'js/levels.js', 'js/puzzle.js', 'js/puzzlefx.js',
  'js/shop.js', 'js/riders.js', 'js/icons.js', 'js/hud.js',
  'js/animals.js', 'js/svgrider.js', 'js/shoprider.js', 'js/painted.js', 'js/lib/gsap.min.js',
  'js/hats.js', 'js/dates.js', 'js/notes.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

/** Downloads every app file fresh: a unique query string gets past the CDN, 'reload' past the
 *  phone's own HTTP cache. Files are stored under their plain names. */
async function fetchApp(cacheName, tag) {
  const cache = await caches.open(cacheName);
  await Promise.all(APP.map(async u => {
    const res = await fetch(new Request(`${u}${u.includes('?') ? '&' : '?'}b=${tag}`, { cache: 'reload' }));
    if (!res.ok) throw new Error(`${u}: ${res.status}`);
    await cache.put(u, res);
  }));
}

self.addEventListener('install', e => {
  e.waitUntil(fetchApp(CACHE, BUILD).then(() => self.skipWaiting()));
});

// "Check for updates" in Settings: re-download everything now, even if this build is current.
self.addEventListener('message', e => {
  if (e.data !== 'refresh') return;
  const port = e.ports[0];
  e.waitUntil(fetchApp(CACHE, Date.now()).then(
    () => port && port.postMessage('ok'),
    err => port && port.postMessage('error: ' + err.message),
  ));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== PHOTOS && k !== RIDERS).map(k => caches.delete(k))))
      .then(() => caches.open(RIDERS))
      .then(cache => cache.keys().then(reqs => Promise.all(reqs
        .filter(r => !RIDER_FILES.some(f => new URL(r.url).pathname.endsWith('/' + f)))
        .map(r => cache.delete(r)))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);

  // the version check must always ask the server
  if (url.pathname.endsWith('/version.json')) return;

  // the photo list (and his notes) should be fresh so new ones show up, but never wait long for them
  if (url.pathname.endsWith('/photos/index.json') || url.pathname.endsWith('/notes/notes.bin')) {
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

  // painted rider sheets never change under their name: download once, keep across updates
  if (url.pathname.includes('/riders/') && url.pathname.endsWith('.webp')) {
    e.respondWith(
      caches.open(RIDERS).then(async cache => {
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // everything else: from this version's cache, or fetched once and kept. No refreshing in the
  // background: GitHub Pages lets the phone and its CDN keep a file for ten minutes, so a refresh
  // right after a release could store the previous version's file here, and the phone would run
  // a mix of two versions.
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }),
  );
});
