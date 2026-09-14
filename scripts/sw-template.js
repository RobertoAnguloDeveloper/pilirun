/* Versioned production shell. User data is never stored in this HTTP cache. */
const CACHE = 'pilirun-shell-v2';
const CORE = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/screenshot-wide.png',
  '/screenshot-narrow.png',
  '/assets/rocatech/roca-tech-logo.svg',
  '/assets/rocatech/roca-tech-logo.png',
  '/workers/storage.worker.js',
  '/workers/image.worker.js',
  '/sqlite/index.mjs',
  '/sqlite/sqlite3.wasm',
  '/sqlite/sqlite3-opfs-async-proxy.js',
  // Compressed background music (64 kbps mono MP3, ~1.2 MB each)
  '/assets/bmg/A_Window_Facing_West.mp3',
  '/assets/bmg/Bounding_Through_The_Blooms.mp3',
  '/assets/bmg/Climbing_the_Spire.mp3',
  '/assets/bmg/High_Score_Sprint.mp3',
  '/assets/bmg/Marching_Toward_the_Final_Gate.mp3',
  '/assets/bmg/Showdown_at_the_Clockwork_Spire.mp3',
  '/assets/bmg/Sprint_to_the_Final_Gate.mp3',
  '/assets/bmg/Star_Collector_s_Dash.mp3',
  '/assets/bmg/The_Crown_s_Last_Round.mp3',
  '/assets/bmg/The_Grand_Leap_Upwards.mp3',
  '/assets/bmg/The_Last_Harpsichord.mp3',
  // Optimized character sprites (WebP)
  '/assets/character-sprite-1.webp',
  '/assets/character-sprite-2.webp',
  '/assets/pili-run-0.webp',
  '/assets/pili-run-1.webp',
  '/assets/pili-run-2.webp',
  '/assets/pili-run-3.webp',
  '/assets/pili-run-4.webp',
  '/assets/pili-run-5.webp',
  '/assets/pili-jump-0.webp',
  '/assets/pili-jump-1.webp',
  '/assets/pili-slide-0.webp',
  '/assets/pili-slide-1.webp',
  '/assets/pili-idle-0.webp',
];
self.addEventListener('install', (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Cache independently: a missing optional asset must not reject the entire install.
      const results = await Promise.allSettled(CORE.map((url) => cache.add(url)));
      const missing = CORE.filter((_, index) => results[index].status === 'rejected');
      if (missing.length) console.warn('PiliRun: offline assets unavailable', missing);
      // The first page is already loading before this worker controls it; cache its linked bundles too.
      const shell = await cache.match('/');
      const html = shell ? await shell.text() : '';
      const assets = [
        ...new Set(
          [...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)]
            .map((match) => match[1])
            .filter((path) => path.startsWith('/_next/')),
        ),
      ];
      await Promise.allSettled(assets.map((url) => cache.add(url)));
    })(),
  ),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith('pilirun-shell-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  // Do not mix React Server Component payloads into the document cache.
  if (url.searchParams.has('_rsc') || event.request.headers.get('RSC')) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (event.request.mode === 'navigate') {
        try {
          const response = await fetch(event.request);
          return response;
        } catch {
          return (await cache.match('/')) || Response.error();
        }
      }
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok && (url.pathname.startsWith('/_next/static/') || CORE.includes(url.pathname)))
        await cache.put(event.request, response.clone());
      return response;
    })(),
  );
});
