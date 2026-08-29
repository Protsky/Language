/* Service worker: l'app resta utilizzabile offline dopo la prima visita. */
const CACHE = 'frasi-v19';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/app.css',
  'assets/js/app.js',
  'assets/js/chart.js',
  'assets/js/check.js',
  'assets/js/exercises.js',
  'assets/js/corpus.js',
  'assets/js/corpus-de.js',
  'assets/js/corpus-en.js',
  'assets/js/corpus-es.js',
  'assets/js/corpus-gsw.js',
  'assets/js/corpus-ru.js',
  'assets/js/fsrs.js',
  'assets/js/goal.js',
  'assets/js/irt.js',
  'assets/js/optimizer.js',
  'assets/js/scheduler.js',
  'assets/js/units.js',
  'assets/js/sfx.js',
  'assets/js/speech.js',
  'assets/js/stats.js',
  'assets/js/store.js',
  'assets/js/translit.js',
  'assets/js/tts.js',
  'assets/js/voices.js',
  'assets/icons/icon-180.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
];

/*
 * NIENTE `skipWaiting()` qui dentro.
 *
 * Prendere il posto del vecchio service worker a metà sessione significa
 * servire i moduli della versione nuova a una pagina caricata con quelli della
 * vecchia. Il worker nuovo aspetta, la pagina lo dice con un avviso, e a
 * prendere il suo posto è chi studia quando ha finito la carta che ha in mano.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

/* Il via libera arriva dalla pagina, non da qui. */
self.addEventListener('message', (event) => {
  if (event.data === 'prendi-il-posto') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || caches.match('index.html'));
      return cached || network;
    }),
  );
});
