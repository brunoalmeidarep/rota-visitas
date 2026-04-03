// Service worker — network-first com cache offline — v20260403b
const CACHE_VERSION = 'v2';
const CACHE_NAME    = 'minharotarp-' + CACHE_VERSION;

// Arquivos a cachear para funcionar offline
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Install: skipWaiting imediato + pré-cache ──────────────────────────────
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE).catch(() => {}))
  );
});

// ── Activate: apaga caches antigos e assume controle ──────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first para arquivos do app, passthrough para externos ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin) return; // recursos externos: browser decide

  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(response => {
        // Atualiza cache com versão mais recente
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: serve do cache se disponível
        return caches.match(e.request).then(cached => cached || Response.error());
      })
  );
});

// ── Mensagens do app ──────────────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = e.data;
    e.waitUntil(
      self.registration.showNotification(title || '📋 Minha Rota RP', {
        body,
        icon: '/icons/icon-192.png',
        tag: tag || 'tarefas-lembrete',
        renotify: true,
      })
    );
  }
});

// ── Clique na notificação ─────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      const c = cls.find(w => w.url && w.url.includes('minharotarp'));
      if (c) { c.focus(); c.postMessage({ type: 'OPEN_TAREFAS' }); }
      else clients.openWindow('/');
    })
  );
});
