const CACHE_NAME = 'radio-bendicion-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/css/styles.css',
  '/js/index.js',
  '/js/jquery-4.0.0.min.js',
  '/images/logo.png',
  '/manifest.json'
];

// Instalar el Service Worker y almacenar en caché los activos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Almacenando caché de activos estáticos');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activar el Service Worker y limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar peticiones
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // EXCLUIR EL STREAMING DE AUDIO Y LAS PETICIONES DE LA API DE AZURACAST
  // El streaming y la API deben ir siempre a la red directamente
  if (
    url.hostname.includes('radio.radiobendicion.cl') || 
    url.pathname.endsWith('.mp3') || 
    url.pathname.includes('api/nowplaying_static')
  ) {
    return; // No interceptar, dejar que vaya directamente a la red
  }

  // Estrategia Cache-First falling back to Network para activos locales
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Guardar en caché dinámicamente nuevas peticiones del mismo dominio (por si acaso)
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic' &&
          event.request.method === 'GET'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // En caso de estar offline y no encontrar en caché,
        // retornamos la página de inicio para peticiones de navegación HTML
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
