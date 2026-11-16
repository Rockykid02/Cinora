
/* =========================================================
   CINORA — PROGRESSIVE WEB APP SERVICE WORKER
   Version: 1.0.0
   Digital Dynamo Lab
   ========================================================= */

const CACHE_VERSION = 'cinora-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSETS_CACHE = `${CACHE_VERSION}-assets`;

// Install: cache the main application page.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.add('/'))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove outdated CINORA caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) =>
              key.startsWith('cinora-') &&
              key !== APP_SHELL_CACHE &&
              key !== ASSETS_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: use network-first for pages and cache-first for static assets.
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle normal GET requests.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept external services, APIs or video streams.
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/embed/') ||
    url.pathname.includes('/video/') ||
    url.pathname.includes('/stream/')
  ) {
    return;
  }

  // HTML navigation: try the network first.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();

            caches.open(APP_SHELL_CACHE)
              .then((cache) => cache.put('/', copy));
          }

          return response;
        })
        .catch(async () => {
          return (
            await caches.match(request) ||
            await caches.match('/')
          );
        })
    );

    return;
  }

  // Cache-first for same-origin static assets.
  const isStaticAsset = [
    'script',
    'style',
    'image',
    'font'
  ].includes(request.destination);

  if (isStaticAsset) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        const cached = await cache.match(request);

        if (cached) return cached;

        try {
          const response = await fetch(request);

          if (response && response.ok && response.type === 'basic') {
            await cache.put(request, response.clone());
          }

          return response;
        } catch (error) {
          return Response.error();
        }
      })
    );
  }
});
