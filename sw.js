const CACHE_NAME = 'clean-weather-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Bypass the browser HTTP cache so a fresh install never stores a stale page
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    })
  );
  self.skipWaiting();
});

// Activate - clean up old caches; if this replaced an older version,
// reload open pages once so they stop showing the previously cached page
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      const oldKeys = keys.filter(key => key !== CACHE_NAME);
      return Promise.all(oldKeys.map(key => caches.delete(key)))
        .then(() => self.clients.claim())
        .then(() => {
          if (oldKeys.length === 0) return;
          return self.clients.matchAll({ type: 'window' }).then(clients => {
            clients.forEach(client => client.navigate(client.url).catch(() => {}));
          });
        });
    })
  );
});

// Fetch - network first for API and the page, cache first for other static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-first for API requests (weather data)
  if (url.hostname.includes('open-meteo.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful API responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fall back to cache if offline
          return caches.match(event.request);
        })
    );
    return;
  }

  // Network-first for the page itself, so a new deploy shows up on the next load;
  // the cached copy is only used offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request.url, { cache: 'no-cache' })
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('./index.html', clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for other static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // Cache new static assets
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
