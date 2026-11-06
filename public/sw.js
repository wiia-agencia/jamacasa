// Service worker de la Jamacasa: la app abre aunque no haya cobertura
// (los datos se actualizan al volver la conexión).
const CACHE = 'jamacasa-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // la base de datos va siempre por red
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put('/', copia)); return r; })
        .catch(() => caches.match('/')),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) => hit || fetch(req).then((r) => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); } return r; }),
    ),
  );
});
