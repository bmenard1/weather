const CACHE_NAME = 'clean-weather-v4';
// On a slow network, answer from the cache after this long (the network copy still refreshes the cache)
const NETWORK_GRACE_MS = 3000;
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Network first, but if the network is slow and a cached copy exists, use the cache
function networkFirstWithGrace(networkPromise, lookupCache) {
  return new Promise(resolve => {
    let done = false;
    const finish = response => { if (!done && response) { done = true; resolve(response); } };
    const timer = setTimeout(() => {
      lookupCache().then(finish);
    }, NETWORK_GRACE_MS);
    networkPromise
      .then(response => { clearTimeout(timer); finish(response); })
      .catch(() => {
        clearTimeout(timer);
        lookupCache().then(cached => {
          if (cached) finish(cached);
          else if (!done) { done = true; resolve(Response.error()); }
        });
      });
  });
}

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
    const network = fetch(event.request).then(response => {
      // Cache successful API responses
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    });
    // Falls back to the cache if offline or slow
    event.respondWith(networkFirstWithGrace(network, () => caches.match(event.request)));
    return;
  }

  // Network-first for the page itself, so a new deploy shows up on the next load;
  // the cached copy is used offline or when the network is slow
  if (event.request.mode === 'navigate') {
    const network = fetch(event.request.url, { cache: 'no-cache' }).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('./index.html', clone));
      }
      return response;
    });
    // A slow network shows the cached page after a few seconds; the new copy is saved for next time
    event.respondWith(networkFirstWithGrace(network,
      () => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
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
