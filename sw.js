const CACHE_NAME = 'radio-bendicion-v29';
const ASSETS_TO_CACHE = [
  '/',
  '/css/styles.css',
  '/js/devotionals-db.js',
  '/js/index.js',
  '/js/jquery-4.0.0.min.js',
  '/images/logo.png',
  '/images/logo-192.png',
  '/images/logo-512.png',
  '/images/logo-maskable-192.png',
  '/images/logo-maskable-512.png',
  '/images/apple-touch-icon.png',
  '/manifest.json'
];

// Instalar el Service Worker y almacenar en caché los activos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Almacenando caché de activos estáticos');
      return cache.addAll(ASSETS_TO_CACHE);
    })
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
    event.request.destination === 'audio' ||
    event.request.destination === 'video' ||
    event.request.headers.has('range') ||
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

// Escuchar evento push para recibir notificaciones del servidor
self.addEventListener('push', (event) => {
  let data = { title: 'Radio Bendición', body: 'Nuevo devocional diario disponible.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Radio Bendición', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/images/logo-192.png',
    badge: '/images/logo-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/#devocional'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Escuchar clics en la notificación para abrir/enfocar la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data && event.notification.data.url 
    ? event.notification.data.url 
    : '/#devocional';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Buscar si ya hay una pestaña abierta con la app
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navegar a la URL objetivo (con el hash #devocional)
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Si no hay pestañas abiertas, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Escuchar mensajes del cliente para forzar la activación del nuevo service worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
