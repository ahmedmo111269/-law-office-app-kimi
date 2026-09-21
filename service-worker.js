/* LawOffice Service Worker
   App-shell caching only.
   User data lives in IndexedDB.
*/

var CACHE = 'law-office-v1';

var FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/db.js',
  './js/app.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        return cache.addAll(FILES);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function (cached) {

        if (cached) {
          return cached;
        }

        return fetch(event.request)
          .then(function (response) {

            var copy = response.clone();

            caches.open(CACHE)
              .then(function (cache) {
                cache.put(event.request, copy);
              });

            return response;
          })
          .catch(function () {
            return cached;
          });

      })
  );
});
