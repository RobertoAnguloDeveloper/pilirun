/* Versioned production shell. User data is never stored in this HTTP cache. */
const CACHE = 'pilirun-shell-Tn31Vglc5_HH-KnTEFCi8';
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
  // AI-generated, optimized production environment and obstacle sprites
  '/assets/generated/obstacle-log.webp',
  '/assets/generated/obstacle-rock.webp',
  '/assets/generated/obstacle-branch.webp',
  '/assets/generated/environment-pine.webp',
  '/assets/generated/environment-oak.webp',
  '/assets/generated/environment-foliage.webp',
  '/assets/generated/environment-spire.webp',
];
CORE.push(...["/_next/static/Tn31Vglc5_HH-KnTEFCi8/_buildManifest.js","/_next/static/Tn31Vglc5_HH-KnTEFCi8/_clientMiddlewareManifest.js","/_next/static/Tn31Vglc5_HH-KnTEFCi8/_ssgManifest.js","/_next/static/chunks/093_sugt6qlro.js","/_next/static/chunks/09lgyggnhjlha.js","/_next/static/chunks/0cz1d0mv5g_q7.js","/_next/static/chunks/0twww6ruz078y.js","/_next/static/chunks/0uznozvi-ghib.js","/_next/static/chunks/0y-0_uqzo-a1c.css","/_next/static/chunks/1mh6a-0e61pyc.js","/_next/static/chunks/1pyi1y3at5j97.js","/_next/static/chunks/1zcrg4tcsxmfq.js","/_next/static/chunks/2-mp21qkr3lha.js","/_next/static/chunks/2dxpalg3ccces.js","/_next/static/chunks/2gw_w_32tj1_y.js","/_next/static/chunks/2l_y_qqi24r7y.js","/_next/static/chunks/2zkidvhhrh8ra.js","/_next/static/chunks/3-b1t-937fppi.js","/_next/static/chunks/35czrwxsvix--.js","/_next/static/chunks/3fntmmi971322.js","/_next/static/chunks/3knwsz060m3sc.js","/_next/static/chunks/4017s3df9y0oo.js","/_next/static/chunks/turbopack-3wbyi96ng71ls.js"]);
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
