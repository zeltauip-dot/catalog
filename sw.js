```javascript
const CACHE_NAME = 'zheltau-shell-v2';
const IMAGE_CACHE_NAME = 'zheltau-images-v1';

const APP_FILES = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key =>
            key !== CACHE_NAME &&
            key !== IMAGE_CACHE_NAME
          )
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Не кешируем ответы API каталога.
  if (
    url.hostname === 'script.google.com' ||
    url.hostname === 'script.googleusercontent.com'
  ) {
    return;
  }

  // Кешируем фотографии Google Диска.
  if (
    req.destination === 'image' &&
    url.hostname === 'drive.google.com'
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async cache => {
        const cached = await cache.match(req);

        if (cached) return cached;

        try {
          const response = await fetch(req);

          if (response.ok) {
            await cache.put(req, response.clone());
          }

          return response;
        } catch (error) {
          return new Response('', {
            status: 503,
            statusText: 'Фотография недоступна офлайн'
          });
        }
      })
    );

    return;
  }

  // Обычное кеширование файлов приложения.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached =>
        cached || fetch(req).then(response => {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => cache.put(req, copy));
          }

          return response;
        }).catch(() => caches.match('./index.html'))
      )
    );
  }
});
```

