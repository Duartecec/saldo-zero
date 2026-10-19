// Service worker do Saldo Zero: deixa o jogo instalável e jogável sem internet.
// A versão muda a cada deploy (o servidor substitui a marca de versão), o que renova o cache.
// Regras: só a navegação para "/" é guardada (e só com resposta ok); /admin, /privacidade, /suporte e qualquer
// outra página passam direto pela rede. A API nunca passa pelo cache.
const VERSION = '__VERSION__';
const CACHE = 'saldozero-' + VERSION;
const SHELL = ['/', '/manifest.webmanifest', '/fonts/Anton.woff2', '/fonts/Rubik.woff2', '/fonts/Rubik-Italic.woff2', '/icon-192.png', '/icon-512.png', '/scenes/home-scenes.js', '/scenes/scene-jato.svg', '/scenes/scene-charutos.svg', '/scenes/scene-resort.svg', '/scenes/scene-fachada.svg'];
const STATIC = /\.(?:woff2|png|svg|webp|jpg|webmanifest)$/;
const NET_TIMEOUT = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Rede primeiro, com 3 s de paciência; se a rede falhar ou demorar, usa a cópia de "/" (se houver).
function gameShell(req) {
  const net = fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); }
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NET_TIMEOUT)).then(() => caches.match('/'));
  return Promise.race([net.catch(() => caches.match('/')), timeout.then((hit) => hit || net)])
    .then((res) => res || net)
    .catch(() => caches.match('/'));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    // Só a página do jogo usa o cache; as demais páginas (admin, privacidade, suporte...) vão sempre à rede.
    if (url.pathname === '/') event.respondWith(gameShell(req));
    return;
  }
  // Fontes, ícones e manifesto: cache primeiro (o cache é por versão e renovado a cada deploy).
  if (STATIC.test(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
  }
});
