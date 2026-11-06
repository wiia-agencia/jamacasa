// Service worker de la Jamacasa: la app abre aunque no haya cobertura
// (los datos se actualizan al volver la conexión).
// Todo va primero por red y, si no hay, sale lo guardado. Solo los archivos de /assets/
// (llevan una huella en el nombre y nunca cambian) salen directamente de lo guardado.
// Así el manifiesto y los iconos nuevos llegan siempre: Chrome los lee para actualizar
// la app instalada (por ejemplo, el color de la barra de gestos).
const CACHE = 'jamacasa-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(['/', '/manifest.webmanifest'].map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

const guardar = (clave, r) => {
  if (r.ok) {
    const copia = r.clone();
    caches.open(CACHE).then((c) => c.put(clave, copia));
  }
  return r;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // la base de datos va siempre por red
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => guardar('/', r)).catch(() => caches.match('/')));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => guardar(req, r))));
    return;
  }
  e.respondWith(fetch(req).then((r) => guardar(req, r)).catch(() => caches.match(req)));
});
