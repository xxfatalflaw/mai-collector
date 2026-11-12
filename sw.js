/* Mai Collector service worker — offline app shell.
   This file lives beside the app page (repo root, next to
   mai-collector.html) so its scope covers the page — a worker under
   assets/ could only control pages inside assets/ and Chrome would
   never offer the install prompt. All paths below are relative to
   this file. Navigations are network-first so a new version shows
   up as soon as it is published; the cache is only the offline
   fallback. Card data and prices are never cached here — collection
   data lives in the page's own storage, and price/API requests pass
   straight through to the network. */
var CACHE = 'mai-collector-shell-v2';
var SHELL = [
  './',
  './index.html',
  './mai-collector.html',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Cache each shell file on its own so one missing path can't
      // fail the whole install.
      return Promise.all(SHELL.map(function (url) {
        return cache.add(url).catch(function () { /* optional entry */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE ? null : caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Page loads: freshest copy wins, cache is the offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./').then(function (root) {
            return root || caches.match('./index.html').then(function (idx) {
              return idx || caches.match('./mai-collector.html');
            });
          });
        });
      })
    );
    return;
  }

  // Same-origin files (icons, manifest): serve from cache, refresh
  // in the background. Everything cross-origin (prices, card images,
  // fonts) goes straight to the network untouched.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(function (hit) {
        var refresh = fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
          }
          return res;
        }).catch(function () { return hit; });
        return hit || refresh;
      })
    );
  }
});
