self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = String(payload.title || 'Mais Trilha Menos Estresse').slice(0, 80);
  const body = String(payload.body || 'Tem novidade esperando por você no app.').slice(0, 240);
  const url = safeAppUrl(payload.url);
  const options = {
    body,
    icon: '/api/pwa/icon/192',
    badge: '/api/pwa/icon/192?purpose=badge',
    tag: String(payload.tag || 'mais-trilha').slice(0, 100),
    renotify: true,
    data: { url },
    actions: [{ action: 'open', title: 'Abrir app' }],
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    if (self.navigator && 'setAppBadge' in self.navigator) {
      await self.navigator.setAppBadge(Math.max(1, Math.min(99, Number(payload.badgeCount || 1))));
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = safeAppUrl(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.navigate(url);
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});

function safeAppUrl(value) {
  try {
    const url = new URL(String(value || '/app'), self.location.origin);
    if (url.origin === self.location.origin && url.pathname.startsWith('/app')) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    // Usa o destino seguro abaixo.
  }
  return '/app';
}
