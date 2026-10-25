// Segna Ore – service worker: l'app funziona anche senza rete.
// Quando pubblichi una nuova versione di index.html cambia CACHE (es. 'segna-ore-v1.5') per forzare l'aggiornamento.
const CACHE = 'segna-ore-v1.5';
const FILE_LOCALI = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const LIBRERIE = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(FILE_LOCALI);
    // Le librerie PDF: se non si scaricano ora, verranno messe in cache al primo uso
    await Promise.all(LIBRERIE.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    const chiavi = await caches.keys();
    await Promise.all(chiavi.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pagina: prima la rete (per ricevere gli aggiornamenti), se offline la copia salvata
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('/index.html'))) {
    ev.respondWith((async () => {
      try {
        const r = await fetch(req);
        const c = await caches.open(CACHE); c.put('./index.html', r.clone());
        return r;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Altri file e librerie: prima la cache, poi la rete
  ev.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const r = await fetch(req);
      const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
      if ((r.ok || r.type === 'opaque') && (url.origin === location.origin || LIBRERIE.includes(req.url) || font)) {
        const c = await caches.open(CACHE); c.put(req, r.clone());
      }
      return r;
    } catch (e) { return Response.error(); }
  })());
});
