// Service worker v10 — network first, auto-update via SKIP_WAITING message
const CACHE_VERSION = '20260323T120000Z';

self.addEventListener('install', () => {
  // Não ativa imediatamente — aguarda sinal do cliente
  // (skipWaiting será chamado via mensagem SKIP_WAITING)
});

self.addEventListener('activate', e => {
  // Limpa todos os caches antigos ao ativar
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Network first: sempre tenta buscar da rede, sem cache
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
