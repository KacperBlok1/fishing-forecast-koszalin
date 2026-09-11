/*
 * Service worker aplikacji "Czy warto iść na ryby?".
 *
 * Zasada: cache'ujemy WYŁĄCZNIE powłokę interfejsu (HTML, JS, CSS, ikony,
 * obrazy). Żądania do /api — prognoza, łowiska, sesja — są zawsze sieciowe.
 * Pokazanie starej prognozy pod postacią świeżej byłoby wprowadzaniem
 * użytkownika w błąd, a dane konta nie mają czego szukać w cache przeglądarki.
 * Za pamiętanie ostatniej poprawnej odpowiedzi odpowiada serwer (Postgres)
 * oraz localStorage aplikacji, który jawnie pokazuje wiek danych.
 */

const CACHE_VERSION = 'v3';
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

  // Wszystko spoza własnego origin idzie prosto do sieci.
  if (url.origin !== self.location.origin) return;

  // API nigdy nie trafia do cache service workera: są tam dane pogodowe,
  // stan konta i sesja. Cache'owaniem prognozy zajmuje się serwer (Postgres),
  // a kopią na urządzenie — localStorage, który jawnie pokazuje wiek danych.
  if (url.pathname.startsWith('/api/')) return;

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
