// Service worker do Saldo Zero: deixa o jogo instalável e jogável sem internet.
// A versão muda a cada deploy (o servidor substitui a marca de versão), o que renova o cache.
const VERSION = '__VERSION__';
const CACHE = 'saldozero-' + VERSION;
const SHELL = ['/', '/manifest.webmanifest', '/fonts/Anton.woff2', '/fonts/Rubik.woff2', '/fonts/Rubik-Italic.woff2', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // A API nunca passa pelo cache: conta, loja e ranking precisam de resposta fresca.
  if (url.pathname.startsWith('/api/')) return;

  // Página do jogo: rede primeiro (para receber cartas novas), cache se estiver off-line.
  if (req.mode === 'navigate' || url.pathname === '/') {
    event.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return res; })
        .catch(() => caches.match('/'))
    );
    return;
  }
  // Fontes, ícones e manifesto: cache primeiro.
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })));
});
