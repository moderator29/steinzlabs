/* Steinz Labs Service Worker — Push Notifications + PWA */

// Bump SW_VERSION on a deploy that must evict stale clients. This SW
// intentionally precaches NOTHING (no fetch handler), so any Cache Storage
// present is a leftover from an older build — on activate we delete all of it,
// which busts any stale app-shell a previous workbox/PWA setup may have cached.
// Changing this constant changes the SW bytes, so browsers detect the update,
// install the new SW, and re-run activate.
const SW_VERSION = '2026-06-28-1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) { /* Cache Storage unavailable — nothing to purge */ }
    await self.clients.claim();
  })());
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Steinz Labs', {
      body: data.body ?? '',
      icon: data.icon ?? '/steinz-logo-192.png',
      badge: '/steinz-logo-64.png',
      image: data.image,
      data: { url: data.url ?? '/dashboard' },
      vibrate: [200, 100, 200],
      tag: data.tag ?? 'steinz-default',
      renotify: data.renotify ?? false,
      requireInteraction: data.requireInteraction ?? false,
      actions: data.actions ?? [],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      clients.openWindow(url);
    })
  );
});
