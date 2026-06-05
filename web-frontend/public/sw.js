// Josephine service worker — Web Push only (NO caching, to avoid HMR/staleness).
// Registered in production only (see main.jsx); dev unregisters any SW.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// A proactive "moment" arrived → show it as a notification.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* ignore */ }
  const title = data.title || 'Josephine';
  const options = {
    body: data.body || '',
    icon: data.icon || '/josephine/portrait.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    vibrate: [120, 60, 120],
    tag: 'josephine-moment',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification → focus an open tab (or open one) at the target url.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const c of clientsArr) {
        if ('focus' in c) { try { c.navigate(url); } catch (e) { /* cross-origin */ } return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    })
  );
});
