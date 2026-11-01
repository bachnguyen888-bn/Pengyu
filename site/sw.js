// Pengyu's service worker: after the first visit, the app works with no connection at all.
// It keeps copies of the app's own files only (pages, styles, code, fonts and icons). Your plan,
// workouts and Fish stay in localStorage on this device and are never sent anywhere.
//
// Pages: the network first, if it answers within a few seconds; otherwise the saved copy.
// Everything else: the saved copy at once, refreshed in the background for next time.
// So online visits stay current and offline visits work, with no build step and no manual versioning.
// Change VERSION only when a file is removed or renamed, so old copies are dropped.
//
// The worker's own requests follow the security policy sent with this file (site/_headers), which is
// why that policy includes connect-src 'self'.

const VERSION = 'pengyu-v1';

// Everything the app needs to start and run offline, relative to the site root.
const SHELL = [
  './',
  'privacy.html',
  '404.html',
  'pengu.css',
  'favicon.svg',
  'manifest.webmanifest',
  'fonts/rubik-latin-wght-normal.woff2',
  'js/boot.js',
  'js/main.js',
  'js/fx.js',
  'js/pengyu/app.js',
  'js/pengyu/art.js',
  'js/pengyu/backup.js',
  'js/pengyu/history.js',
  'js/pengyu/ics.js',
  'js/pengyu/ink.js',
  'js/pengyu/motion.js',
  'js/pengyu/plan.js',
  'js/pengyu/route.js',
  'js/pengyu/shop.js',
  'js/pengyu/state.js',
  'js/pengyu/ui.js',
  'js/vendor/anime.esm.min.js',
];

// Addresses that show the app, and the privacy page's two addresses.
const APP = new Set(['/', '/index.html', '/clearhealth-pengu.html']);
const PRIVACY = new Set(['/privacy', '/privacy.html']);
const pageKey = (url) => (APP.has(url.pathname) ? './' : PRIVACY.has(url.pathname) ? 'privacy.html' : null);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL.map((path) => new Request(path, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.respondWith(page(event, url));
  else event.respondWith(file(event));
});

// A page copy must not carry a redirect, or the browser refuses it for a navigation.
async function clean(response) {
  if (!response || !response.redirected) return response;
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function page(event, url) {
  const cache = await caches.open(VERSION);
  const key = pageKey(url);
  const network = fetch(event.request).then(async (response) => {
    if (response.ok && key) await cache.put(key, (await clean(response.clone())));
    return response;
  });
  event.waitUntil(network.catch(() => {}));
  try {
    return await Promise.race([network, new Promise((_, fail) => setTimeout(() => fail(new Error('slow')), 3500))]);
  } catch {
    const saved = (key && await cache.match(key)) || (await cache.match('404.html'));
    if (saved) return clean(saved);
    return network;   // nothing saved yet: wait for the network after all
  }
}

async function file(event) {
  const cache = await caches.open(VERSION);
  const saved = await cache.match(event.request);
  const network = fetch(event.request).then((response) => {
    if (response.ok) cache.put(event.request, response.clone());
    return response;
  });
  if (saved) {
    event.waitUntil(network.catch(() => {}));
    return saved;
  }
  return network;
}
