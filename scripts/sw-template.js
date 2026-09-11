/* Versioned production shell. User data is never stored in this HTTP cache. */
const CACHE = 'pilirun-shell-v1';
const CORE = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/workers/storage.worker.js', '/workers/image.worker.js', '/sqlite/index.mjs', '/sqlite/sqlite3.wasm', '/sqlite/sqlite3-opfs-async-proxy.js'];
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(CORE);
  // The first page is already loading before this worker controls it; cache its linked bundles too.
  const html = await (await cache.match('/')).text();
  const assets = [...new Set([...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)].map(match => match[1]).filter(path => path.startsWith('/_next/')))];
  await cache.addAll(assets);
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('pilirun-shell-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  // Do not mix React Server Component payloads into the document cache.
  if (url.searchParams.has('_rsc') || event.request.headers.get('RSC')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') {
      try { const response = await fetch(event.request); return response; }
      catch { return await cache.match('/') || Response.error(); }
    }
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && (url.pathname.startsWith('/_next/static/') || CORE.includes(url.pathname))) await cache.put(event.request, response.clone());
    return response;
  })());
});
