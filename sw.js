/* Service worker: l'app resta utilizzabile offline dopo la prima visita. */
const CACHE = 'frasi-v25';

/*
 * L'audio inciso sta in una cache SUA, e il numero di versione non la tocca.
 *
 * Sono 16 MB: buttarli a ogni pubblicazione vorrebbe dire riscaricarli, e chi
 * studia in giro li riscaricherebbe col telefono. Il guscio dell'app cambia
 * spesso, le frasi incise quasi mai — sono due cicli di vita diversi e vogliono
 * due cache diverse. Non entrano nemmeno nell'elenco qui sotto: precaricarne
 * 863 all'installazione bloccherebbe il primo avvio per minuti, mentre servono
 * una alla volta e restano dopo il primo ascolto.
 */
const CACHE_AUDIO = 'frasi-audio';
const isAudio = (url) => url.pathname.includes('/assets/audio/');

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
  'assets/js/incisa.js',
  'assets/js/pronuncia.js',
  'assets/js/sync.js',
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
      .then((keys) => Promise.all(keys
        .filter((k) => k !== CACHE && k !== CACHE_AUDIO)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  /*
    * L'API NON PASSA DI QUI. Il gestore qui sotto e' «prima la cache, poi la
    * rete»: sul deposito dei progressi vorrebbe dire rispondere con un mazzo
    * vecchio a chi sta chiedendo qual e' quello nuovo, che e' esattamente la
    * domanda a cui non si puo' rispondere male.
    */
   if (url.pathname.startsWith('/api/')) return;

  const dove = isAudio(url) ? CACHE_AUDIO : CACHE;

  event.respondWith(
    caches.match(request).then((cached) => {
      /* Una frase incisa non cambia mai senza cambiare anche la frase: quando
       * c'è, si serve e basta. Chiedere ogni volta al server se è cambiata
       * costerebbe una richiesta per ogni ascolto, che è il contrario del
       * motivo per cui l'audio sta qui. */
      if (cached && isAudio(url)) return cached;

      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(dove).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || (isAudio(url) ? undefined : caches.match('index.html')));
      return cached || network;
    }),
  );
});
