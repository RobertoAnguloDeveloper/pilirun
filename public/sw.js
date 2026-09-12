/* Versioned production shell. User data is never stored in this HTTP cache. */
const CACHE = 'pilirun-shell-is_EErJ0NIHJx68MTi970';
const CORE = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/assets/rocatech/roca-tech-logo.svg',
  '/assets/rocatech/roca-tech-logo.png',
  '/workers/storage.worker.js',
  '/workers/image.worker.js',
  '/sqlite/index.mjs',
  '/sqlite/sqlite3.wasm',
  '/sqlite/sqlite3-opfs-async-proxy.js',
];
CORE.push(...["/_next/static/is_EErJ0NIHJx68MTi970/_buildManifest.js","/_next/static/is_EErJ0NIHJx68MTi970/_clientMiddlewareManifest.js","/_next/static/is_EErJ0NIHJx68MTi970/_ssgManifest.js","/_next/static/chunks/06c7qzneowj73.js","/_next/static/chunks/093_sugt6qlro.js","/_next/static/chunks/09lgyggnhjlha.js","/_next/static/chunks/0cz1d0mv5g_q7.js","/_next/static/chunks/0deu0i4ozx66n.js","/_next/static/chunks/0pmb2a8phctk8.js","/_next/static/chunks/12siefkqc0_82.css","/_next/static/chunks/1mh6a-0e61pyc.js","/_next/static/chunks/2-nmpeeopblwh.js","/_next/static/chunks/20o58ufh_atb-.js","/_next/static/chunks/2gw_w_32tj1_y.js","/_next/static/chunks/2j7c-rteab6_6.js","/_next/static/chunks/2l_y_qqi24r7y.js","/_next/static/chunks/32pcg3v57dzn-.js","/_next/static/chunks/3fntmmi971322.js","/_next/static/chunks/3o1i_aeg09si9.js","/_next/static/chunks/3p5db865q00w_.js","/_next/static/chunks/3vej5hu5ebe0r.js","/_next/static/chunks/turbopack-3wbyi96ng71ls.js"]);
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
