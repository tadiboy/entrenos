// Service worker: guarda toda la app para que funcione sin internet.
// Cambia VERSION en cada publicación para que el teléfono baje lo nuevo.
const VERSION = 'entrenos-v2';
const FILES = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/data.js',
  './js/store.js',
  './js/signal.js',
  './fonts/big-shoulders-display-latin.woff2',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // La app es una sola página: cualquier navegación sirve index.html del caché.
    event.respondWith(
      caches.match('./index.html').then((hit) => hit || fetch(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return res;
      });
    }),
  );
});
