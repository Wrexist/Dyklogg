/* Dyklogg – service worker: gör att appen fungerar utan täckning.
 *
 * - Sidan (index.html) hämtas i första hand från nätet så att man alltid får
 *   senaste versionen – men svarar nätet inte inom 3 sekunder (dålig täckning
 *   vid kajen) används den sparade kopian direkt.
 * - Bilder m.m. tas från cachen och uppdateras i bakgrunden.
 * - Dykdata ligger i webbläsarens lagring (localStorage) och påverkas inte.
 *
 * Byt CACHE-namnet om filistan ändras, så rensas gamla cacher automatiskt. */
const CACHE = 'dyklogg-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './dawab_logo.png', './blackfisk.png',
  './dawab_yellow_logo.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function fromNetwork(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(res => {
      clearTimeout(t);
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      resolve(res);
    }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(req.url).pathname);
  if (isPage) {
    e.respondWith(fromNetwork(req, 3000).catch(() =>
      caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fromNetwork(req, 10000).catch(() => hit);
    return hit || net;
  }));
});
