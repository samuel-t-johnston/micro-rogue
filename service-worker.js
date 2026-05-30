// TODO(M7): cache static assets for offline play. Registration only for now.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // pass-through; caching arrives in M7
});
