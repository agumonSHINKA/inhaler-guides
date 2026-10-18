// Minimal offline support: network-first for pages and data, cache fallback; cache-first for static assets.
const V = 'v1-f742353a46';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(V).then(c => c.addAll(['./', './css/style.css', './js/app.js', './data/app.json', './offline/']).catch(() => {}))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const isStatic = /\.(css|js|svg|png|webmanifest)$/.test(u.pathname) && !u.pathname.endsWith('sw.js');
  if (isStatic) { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cl = res.clone(); caches.open(V).then(c => c.put(e.request, cl)); return res; }))); return; }
  e.respondWith(fetch(e.request).then(res => { if (res.ok && !u.pathname.includes('/data/index/')) { const cl = res.clone(); caches.open(V).then(c => c.put(e.request, cl)); } return res; })
    .catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('./offline/') : Response.error()))));
});
