// Development Service Worker: satisfies PWA installability with a pass-through fetch handler.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  // Pass-through fetch handler ensures Chrome identifies the PWA as installable in dev
  event.respondWith(fetch(event.request));
});
