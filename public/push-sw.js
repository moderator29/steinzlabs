// Naka Labs Web Push service worker.
// Phase B (profile features) — receives push payloads from the
// platform's edge delivery functions and renders OS-native notifications.
//
// Payload contract (server-side, see lib/preferences/webPush.ts):
//   {
//     title: string,
//     body: string,
//     icon?: string,
//     badge?: string,
//     tag?: string,
//     data?: { url?: string }   // tap target
//   }

self.addEventListener('install', (event) => {
  // Activate immediately so the user doesn't have to refresh after the
  // first subscribe.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of any open tabs that match our scope.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Naka Labs', body: 'You have a new alert.', data: {} };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }
  const options = {
    body: payload.body,
    icon: payload.icon || '/logo.png',
    badge: payload.badge || '/logo.png',
    tag: payload.tag || 'naka',
    data: payload.data || {},
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/dashboard';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Reuse an existing tab if one is already on the target URL.
    for (const client of all) {
      if (client.url.includes(url) && 'focus' in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
