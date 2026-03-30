// Service worker — sempre network, sem cache, auto-update imediato
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const isSameOrigin = new URL(e.request.url).origin === self.location.origin;
  if (isSameOrigin) {
    // Arquivos do app (index.html, manifest, ícones): sempre busca do servidor, nunca do cache
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
  }
  // Recursos externos (Supabase SDK, Google Maps): browser decide normalmente
});

// Mensagens do app principal
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = e.data;
    e.waitUntil(
      self.registration.showNotification(title || '📋 Mundo do Rep', {
        body,
        icon: '/icons/icon-192.png',
        tag: tag || 'tarefas-lembrete',
        renotify: true,
      })
    );
  }
});

// Ao clicar na notificação, abre o app na tela de tarefas
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      const c = cls.find(w => w.url && w.url.includes('rota-visitas'));
      if (c) { c.focus(); c.postMessage({ type: 'OPEN_TAREFAS' }); }
      else clients.openWindow('/rota-visitas/');
    })
  );
});
