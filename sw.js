const CACHE_NAME = 'zheltau-shell-v4';
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

  // Не перехватываем запросы к Google Apps Script.
  if (
    url.hostname === 'script.google.com' ||
    url.hostname === 'script.googleusercontent.com'
  ) {
    return;
  }

  // Фотографии Google Диска:
  // сначала используем сохранённое фото,
  // а при его отсутствии загружаем из интернета.
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

          if (response.ok || response.type === 'opaque') {
            try {
              await cache.put(req, response.clone());
            } catch (error) {
              console.warn('Не удалось сохранить фото:', error);
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

  // Для открытия приложения сначала обращаемся к сети.
  // Если интернета нет, используем сохранённую страницу.
  if (url.origin === self.location.origin) {
    const isPage =
      req.mode === 'navigate' ||
      url.pathname.endsWith('/index.html') ||
      url.pathname.endsWith('/');

    if (isPage) {
      event.respondWith(
        (async () => {
          try {
            const response = await fetch(req);

            if (response.ok) {
              const cache = await caches.open(CACHE_NAME);

              await cache.put(req, response.clone());
            }

            return response;
          } catch (error) {
            return (
              await caches.match(req) ||
              await caches.match('./index.html') ||
              new Response(
                'Каталог недоступен. Откройте его с интернетом хотя бы один раз.',
                {
                  status: 503,
                  headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                  }
                }
              )
            );
          }
        })()
      );

      return;
    }

    // Остальные файлы приложения кешируем обычным способом.
    event.respondWith(
      caches.match(req).then(async cached => {
        if (cached) return cached;

        try {
          const response = await fetch(req);

          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(req, response.clone());
          }

          return response;
        } catch (error) {
          return new Response('', { status: 503 });
        }
      })
    );
  }
});
