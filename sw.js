/* Cached app shell only; private journal data stays in this browser's local storage. */
const CACHE = 'yomi-shell-2026-09-29-v17';
const SHELL = ['./', './index.html', './autumn.css?v=3', './themes.css?v=2', './theme.js?v=1', './autumn-preview.css?v=2', './autumn-preview.js?v=1', './timer.js', './cloud.js?v=11', './merge.js', './features.js',
  './assets/autumn-pumpkin-real.webp', './assets/autumn-leaves-real.webp', './assets/autumn-photo-wide.webp', './assets/autumn-photo-mobile.webp', './assets/autumn-tree.svg', './assets/autumn-branch.svg', './assets/autumn-pumpkins.svg', './assets/autumn-falling.svg',
  './assets/christmas-scene.svg', './assets/ramadan-scene.svg', './assets/plant-1.webp', './assets/plant-2.webp', './assets/plant-3.webp', './assets/plant-4.webp'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('yomi-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request, url = new URL(req.url);
  const scope = new URL('./', self.registration.scope).pathname;
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(scope)) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () => await caches.match('./index.html') || await caches.match('./')));
  } else {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
  }
});
