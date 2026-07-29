const DEPLOY_VERSION = new URL(self.location.href).searchParams.get('v') || 'local';
const CACHE_VERSION = `mt-pwa-v5-${DEPLOY_VERSION.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48)}`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PRIVATE_PAGE_CACHE = `${CACHE_VERSION}-pages`;
const MAP_CACHE = `${CACHE_VERSION}-maps`;
const APP_ROUTES = [
  '/app',
  '/app/trilhas',
  '/app/carrinho',
  '/app/loja',
  '/app/ranking',
  '/app/perfil',
  '/app/perfil/dados',
  '/app/beneficios',
  '/app/extratos',
  '/app/recarregar',
  '/app/membros',
  '/app/termos',
  '/app/configuracoes',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.allSettled([
      cache.add('/manifest.webmanifest'),
      cache.add('/api/pwa/icon/192'),
      cache.add('/api/pwa/icon/512'),
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith('mt-pwa-') && !name.startsWith(CACHE_VERSION))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'WARM_APP_ROUTES') {
    event.waitUntil(warmAppRoutes());
  }
  if (event.data && event.data.type === 'CACHE_APP_ROUTE') {
    event.waitUntil(warmAppRoute(event.data.path));
  }
  if (event.data && event.data.type === 'CLEAR_PRIVATE_CACHE') {
    event.waitUntil(caches.delete(PRIVATE_PAGE_CACHE));
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.origin === self.location.origin && (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/api/pwa/icon/') ||
    url.pathname === '/manifest.webmanifest'
  )) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE, 180));
    return;
  }

  if (isMapTile(url)) {
    event.respondWith(staleWhileRevalidate(request, MAP_CACHE, 450));
  }
});

async function warmAppRoutes() {
  await Promise.allSettled(APP_ROUTES.map((path) => warmAppRoute(path)));
}

async function warmAppRoute(value) {
  const path = safePrivateAppPath(value);
  if (!path) return;
  const response = await fetch(path, { credentials: 'include', cache: 'no-store' });
  if (!response.ok || response.redirected || !isHtml(response)) return;
  const cache = await caches.open(PRIVATE_PAGE_CACHE);
  await cache.put(path, response.clone());
  await warmStaticFromHtml(response);
}

async function warmStaticFromHtml(response) {
  const html = await response.text();
  const assetPaths = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((path) => path.startsWith('/_next/static/'));
  if (!assetPaths.length) return;
  const cache = await caches.open(STATIC_CACHE);
  await Promise.allSettled([...new Set(assetPaths)].map((path) => cache.add(path)));
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(PRIVATE_PAGE_CACHE);
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected && url.pathname.startsWith('/app') && isHtml(response)) {
      await cache.put(url.pathname, response.clone());
      await warmStaticFromHtml(response.clone());
    }
    return response;
  } catch {
    const exact = await cache.match(url.pathname, { ignoreSearch: true });
    if (exact) return exact;
    const shell = await cache.match('/app');
    if (shell) return shell;
    return offlineDocument();
  }
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(async (response) => {
    if (response.ok || response.type === 'opaque') {
      await cache.put(request, response.clone());
      await trimCache(cacheName, maxEntries);
    }
    return response;
  }).catch(() => cached);
  return cached || network;
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

function isMapTile(url) {
  return url.hostname.endsWith('basemaps.cartocdn.com') ||
    url.hostname === 'server.arcgisonline.com' ||
    url.hostname.endsWith('tile.opentopomap.org');
}

function isHtml(response) {
  return (response.headers.get('content-type') || '').includes('text/html');
}

function safePrivateAppPath(value) {
  try {
    const url = new URL(String(value || ''), self.location.origin);
    if (url.origin !== self.location.origin || !url.pathname.startsWith('/app')) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function offlineDocument() {
  return new Response(`<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#071829"><title>Mais Trilha offline</title><style>body{margin:0;background:#071829;color:white;font:16px system-ui;min-height:100dvh;display:grid;place-items:center;padding:24px;box-sizing:border-box}.c{max-width:420px;text-align:center;background:#fff1;border:1px solid #fff2;border-radius:28px;padding:30px}.i{font-size:42px}h1{font-size:25px;margin:14px 0 8px}p{color:#d8e5ef;line-height:1.5}button{border:0;border-radius:16px;background:#f17b37;color:white;font-weight:800;padding:14px 20px;margin-top:10px}</style><body><main class="c"><div class="i">🧭</div><h1>Você está sem internet</h1><p>A rota GPS salva continua disponível. Reconecte-se uma vez e abra as telas importantes para deixá-las prontas neste aparelho.</p><button onclick="location.reload()">Tentar novamente</button></main></body></html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

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
