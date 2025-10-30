const SW_VERSION = 'v10';
const STATIC_CACHE = `static-${SW_VERSION}`;

self.addEventListener('install', event => {
  console.log(`[SW] Installing ${SW_VERSION}...`);
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(['/']))
  );
});

self.addEventListener('activate', event => {
  console.log(`[SW] Activating ${SW_VERSION}...`);
  event.waitUntil((async () => {
    const names = await caches.keys();
    console.log(`[SW] Deleting old caches:`, names.filter(n => !n.includes(SW_VERSION)));
    await Promise.all(
      names.filter(n => !n.includes(SW_VERSION)).map(n => caches.delete(n))
    );
    await self.clients.claim();
    console.log(`[SW] ${SW_VERSION} is now active`);
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          
          return fetch(event.request).then(response => {
            if (!response || response.status !== 200) {
              return response;
            }
            
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(event.request, responseClone);
            });
            
            return response;
          });
        })
        .catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'gps-sync') {
    event.waitUntil(syncGPSData());
  }
});

async function syncGPSData() {
  console.log('[SW] Syncing GPS data in background');
}
