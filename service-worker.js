// ROGµE service worker — offline caching (roadmap M7).
//
// Strategy: NETWORK-FIRST for every same-origin GET. When online we always fetch
// fresh (revalidating past the browser's HTTP cache, so a stale on-device copy can't be
// returned) and update the Cache Storage; when the network fails we serve the cached copy,
// and navigations fall back to the cached app shell. Bump CACHE_VERSION on each deploy —
// the changed bytes prompt the browser to install a new worker (important on iOS, which
// otherwise leaves an installed PWA on old code), and `activate` deletes every other cache.
//
// Why there is no exhaustive file list: on the first online load the browser fetches the
// entire static-import module graph (all of src/), both stylesheets, and the active sprite
// sheet, and network-first caches every one of them automatically. The only assets NOT
// touched in a given session are the lazily import()-ed map files and the sprite-sheet size
// that isn't in use — that small, known set is the DYNAMIC_ASSETS list below. So the only
// thing to hand-maintain is that list (add a line when you add a new data/maps/*.js file);
// there is no generator and no build step.

const CACHE_VERSION = 'rogue-v7';

// The app shell — enough to boot the game offline. Everything else self-caches at runtime.
const SHELL_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'favicon.ico',
  'styles/theme.css',
  'styles/base.css',
  'src/main.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
];

// Assets the running app loads lazily, so they may be missed by first-load runtime caching:
// the alternate sprite-sheet size and every dynamically import()-ed map layout. Precaching
// them guarantees full offline coverage after a single online load.
const DYNAMIC_ASSETS = [
  'assets/sprites/sprite-sheet-16.png',
  'assets/sprites/sprite-sheet-32.png',
  'data/maps/floor-1-a.js',
  'data/maps/maze-spiral.js',
  'data/maps/maze-zigzag.js',
  'data/maps/maze-pillars.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll([...SHELL_ASSETS, ...DYNAMIC_ASSETS])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle same-origin GETs; let everything else hit the network untouched.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }
  event.respondWith(networkFirst(request));
});

/**
 * Try the network and refresh the cache on success; fall back to the cache when offline.
 * Navigation requests fall back to the cached app shell so deep reloads work offline.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    // `cache: 'no-cache'` forces revalidation with the server (cheap 304s when unchanged),
    // so the worker never hands back a stale copy from the browser's own HTTP cache.
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    throw err;
  }
}
