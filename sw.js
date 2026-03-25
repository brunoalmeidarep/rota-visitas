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
