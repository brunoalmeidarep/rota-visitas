const CACHE_NAME = 'mundo-rep-v6';
const ASSETS = [
  '/rota-visitas/',
  '/rota-visitas/index.html'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Ignora requisições não-GET
  if (e.request.method !== 'GET') return;
  // Ignora supabase e googleapis
  if (e.request.url.includes('supabase') || 
      e.request.url.includes('googleapis') ||
      e.request.url.includes('jsdelivr')) return;
  
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
