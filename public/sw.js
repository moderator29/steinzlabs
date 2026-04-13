/* Steinz Labs Service Worker — Push Notifications + PWA */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

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
