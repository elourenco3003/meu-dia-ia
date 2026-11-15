// Meu Dia IA · service worker
// 1) Guarda a "casca" do app para abrir rápido e aguentar internet instável (nunca guarda dados do usuário).
// 2) Recebe os alertas do servidor (Web Push) e mostra a notificação, mesmo com o app fechado.
const CACHE = 'meudia-v12';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/logo.svg', '/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/')))
  );
});

// alerta chegou do servidor
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'Meu Dia IA';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    wins.forEach(c => c.postMessage({ type: 'push', kind: d.kind, title, body: d.body }));
    await self.registration.showNotification(title, {
      body: d.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      vibrate: [120, 60, 120],
      data: { url: d.url || '/' },
    });
  })());
});

// toque na notificação abre o app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    if (/^https?:/.test(url)) return self.clients.openWindow(url); // notícia: abre a matéria
    const w = ws.find(c => 'focus' in c);
    if (!w) return self.clients.openWindow(url);
    if (url !== '/') w.postMessage({ type: 'open', url }); // ex.: /?rota=ID abre "Como chegar"
    return w.focus();
  }));
});
