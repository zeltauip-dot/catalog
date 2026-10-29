const CACHE_NAME = 'zheltau-shell-v3';
const IMAGE_CACHE_NAME = 'zheltau-images-v2';

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

  // Кешируем фотографии Google Диска,
  // включая непрозрачные ответы.
  if (
    req.destination === 'image' &&
    url.hostname === 'drive.google.com'
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async cache => {
        const cached = await cache.match(req);

        if (cached) {
          return cached;
        }

        try {
          const response = await fetch(req);

          if (response.ok || response.type === 'opaque') {
            try {
              await cache.put(req, response.clone());
            } catch (cacheError) {
              console.warn(
                'Не удалось сохранить фото в кеш:',
                cacheError
              );
            }
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

  // Кешируем файлы приложения.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(async cached => {
        if (cached) {
          return cached;
        }

        try {
          const response = await fetch(req);

          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => cache.put(req, copy))
              .catch(error => {
                console.warn('Ошибка кеширования:', error);
              });
          }

          return response;
        } catch (error) {
          return caches.match('./index.html');
        }
      })
    );
  }
});
