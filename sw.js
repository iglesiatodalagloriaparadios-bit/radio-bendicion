// Base de devocionales (define DEVOTIONALS_DB) para los avisos diarios
importScripts('/js/devotionals-db.js');

const CACHE_NAME = 'radio-bendicion-v37';
// Caché persistente para estado interno (no se borra al actualizar)
const STATE_CACHE = 'radio-bendicion-state';
const ASSETS_TO_CACHE = [
  '/',
  '/css/styles.css',
  '/js/devotionals-db.js',
  '/js/index.js',
  '/js/jquery-4.0.0.min.js',
  '/images/logo-192.png',
  '/images/logo-512.png',
  '/images/logo-maskable-192.png',
  '/images/logo-maskable-512.png',
  '/images/apple-touch-icon.png',
  '/images/logo-white.png',
  '/images/logo-mark.png',
  '/images/programacion-semanal.png',
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
          if (cacheName !== CACHE_NAME && cacheName !== STATE_CACHE) {
            console.log('[Service Worker] Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Guardar en caché una respuesta válida del mismo dominio
function putInCache(request, response) {
  if (
    response &&
    response.status === 200 &&
    response.type === 'basic' &&
    request.method === 'GET'
  ) {
    const responseToCache = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
  }
  return response;
}

// Red primero: siempre la versión más reciente, con la caché como respaldo sin conexión.
// Así los cambios publicados llegan sin depender de cambiar CACHE_NAME.
function networkFirst(request) {
  return fetch(request)
    .then((response) => putInCache(request, response))
    .catch(() =>
      caches.match(request, { ignoreSearch: request.mode === 'navigate' }).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        // Si es una navegación y no está en caché, retornamos la página de inicio
        if (request.mode === 'navigate') return caches.match('/');
      })
    );
}

// Caché primero: para imágenes y otros activos pesados que casi no cambian
function cacheFirst(request) {
  return caches.match(request).then((cachedResponse) => {
    if (cachedResponse) return cachedResponse;
    return fetch(request).then((response) => putInCache(request, response));
  });
}

// Interceptar peticiones
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // EXCLUIR EL STREAMING DE AUDIO Y LAS PETICIONES DE LA API DE AZURACAST
  // El streaming y la API deben ir siempre a la red directamente
  if (
    event.request.method !== 'GET' ||
    event.request.destination === 'audio' ||
    event.request.destination === 'video' ||
    event.request.headers.has('range') ||
    url.hostname.includes('radio.radiobendicion.cl') ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.includes('api/nowplaying_static')
  ) {
    return; // No interceptar, dejar que vaya directamente a la red
  }

  // Peticiones a otros dominios (Google Fonts, APIs, íconos): sin interceptar
  if (url.origin !== self.location.origin) {
    return;
  }

  const isAppCode =
    event.request.mode === 'navigate' ||
    ['document', 'script', 'style', 'manifest'].includes(event.request.destination) ||
    url.pathname.endsWith('.json');

  event.respondWith(isAppCode ? networkFirst(event.request) : cacheFirst(event.request));
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

// --- Aviso diario del devocional (Periodic Background Sync) ---
const LAST_DEVOTIONAL_KEY = '/__last-devotional-notification';

async function showDailyDevotional() {
  const now = new Date();
  const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`; // fecha local

  // Evitar mostrar el mismo devocional dos veces en un día
  const cache = await caches.open(STATE_CACHE);
  const last = await cache.match(LAST_DEVOTIONAL_KEY);
  if (last && (await last.text()) === today) return;

  const devotional = DEVOTIONALS_DB[now.getDate()];
  if (!devotional) return;

  await self.registration.showNotification(`📖 ${devotional.titulo}`, {
    body: `"${devotional.pasaje}" (${devotional.cita})`,
    icon: '/images/logo-192.png',
    badge: '/images/logo-192.png',
    vibrate: [100, 50, 100],
    tag: 'daily-devotional',
    data: { url: '/#devocional' }
  });
  await cache.put(LAST_DEVOTIONAL_KEY, new Response(today));
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-devotional') {
    event.waitUntil(showDailyDevotional());
  }
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
  // La página pregunta qué versión está instalada
  if (event.data && event.data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: CACHE_NAME.replace('radio-bendicion-', '') });
  }
});
