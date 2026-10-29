// Guarda la app en el móvil: carga al instante aunque la conexión sea mala. Siempre intenta la versión nueva primero.
const CACHE = 'juz-v2';
const ROOT = self.registration.scope; // funciona en cualquier subcarpeta (p. ej. GitHub Pages)
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll([ROOT, ROOT + 'manifest.webmanifest']))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API y fotos: siempre red
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(ROOT, copy)); return r; }).catch(() => caches.match(ROOT)));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })));
});
