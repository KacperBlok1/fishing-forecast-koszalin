/*
 * Service worker aplikacji "Czy warto iść na ryby?".
 *
 * Zasada: cache'ujemy WYŁĄCZNIE powłokę interfejsu (HTML, JS, CSS, ikony,
 * obrazy). Dane pogodowe z Open-Meteo nigdy nie trafiają do cache SW —
 * prognoza zmienia się co godzinę, a pokazanie starej pod postacią świeżej
 * byłoby wprowadzaniem użytkownika w błąd. Za pamiętanie ostatniej poprawnej
 * odpowiedzi odpowiada localStorage aplikacji, który jawnie oznacza jej wiek.
 */

const CACHE_VERSION = 'v2';
const SHELL_CACHE = `fishing-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `fishing-assets-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Wszystko spoza własnego origin (w tym Open-Meteo) idzie prosto do sieci.
  if (url.origin !== self.location.origin) return;

  // Nawigacja: najpierw sieć, w razie braku — powłoka z cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Zasoby statyczne: najpierw cache, w tle odświeżenie.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
