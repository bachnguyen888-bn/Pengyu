// Pengyu's service worker: after the first visit, the app works with no connection at all.
// It keeps copies of the app's own files only (pages, styles, code, fonts and icons). Your plan,
// workouts and Fish stay in localStorage on this device and are never sent anywhere.
//
// The files are kept as one complete set, and a page only ever gets files from one set:
// - App pages open from the current set straight away, online or not.
// - After a page opens, the worker downloads every file again into a new set, in the background. The
//   new set counts only once every file has arrived. One failed file, or a dropped connection, throws
//   it away, and the current set stays exactly as it was.
// - A complete new set becomes current when the next page opens, never while a page is loading: an
//   open page keeps getting files from the set it started with.
// So an update is all or nothing, an offline launch always finds a whole set, and nothing needs a new
// version number when app files change. This file changes only when the worker itself changes.
//
// The worker's own requests follow the security policy sent with this file (site/_headers), which is
// why that policy includes connect-src 'self'.

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
  'js/pengyu/invite.js',
  'js/pengyu/motion.js',
  'js/pengyu/plan.js',
  'js/pengyu/route.js',
  'js/pengyu/shop.js',
  'js/pengyu/state.js',
  'js/pengyu/story.js',
  'js/pengyu/ui.js',
  'js/pengyu/window.js',
  'js/vendor/anime.esm.min.js',
];

// Addresses that show the app, and the privacy page's two addresses.
const APP = new Set(['/', '/index.html', '/clearhealth-pengu.html']);
const PRIVACY = new Set(['/privacy', '/privacy.html']);
const pageKey = (url) => (APP.has(url.pathname) ? './' : PRIVACY.has(url.pathname) ? 'privacy.html' : null);

const SET = 'pengyu-set-';        // one cache per complete set of files
const STATE = 'pengyu-state';     // which set is current, which complete set is next, and the one before
const STATE_KEY = '/__pengyu-state__';
const pins = new Map();           // an open page (its client id) → the set it started with
const making = new Set();         // sets being written right now, which a tidy-up must leave alone
let refreshing = null;            // the background download in progress, if any

async function readState() {
  try {
    const saved = await (await caches.open(STATE)).match(STATE_KEY);
    return saved ? await saved.json() : {};
  } catch {
    return {};
  }
}
async function writeState(state) {
  await (await caches.open(STATE)).put(STATE_KEY, new Response(JSON.stringify(state), { headers: { 'content-type': 'application/json' } }));
}
async function openSet(id) {
  return id && (await caches.has(SET + id)) ? caches.open(SET + id) : null;
}

// Downloads every file. A set is written only after all of them have arrived, then marked current
// (on the very first install) or next. Resolves to the new set's id, or to null when nothing changed.
// Any failure rejects before anything is written, so the sets already kept never change.
async function download(fresh) {
  const files = await Promise.all(SHELL.map(async (path) => {
    const response = await fetch(new Request(path, { cache: fresh ? 'reload' : 'no-cache' }));
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    const headers = new Headers(response.headers);
    headers.delete('content-encoding');   // the body below is already decoded
    headers.delete('content-length');
    return { path, body: await response.arrayBuffer(), init: { status: response.status, statusText: response.statusText, headers } };
  }));
  const state = await readState();
  if (await same(state.next || state.current, files)) return null;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  making.add(id);
  try {
    const cache = await caches.open(SET + id);
    await Promise.all(files.map((f) => cache.put(f.path, new Response(f.body, f.init))));
    const now = await readState();   // read again: a page may have opened meanwhile
    if (now.current && await openSet(now.current)) now.next = id;
    else now.current = id;
    await writeState(now);
    return id;
  } catch (err) {
    await caches.delete(SET + id);
    throw err;
  } finally {
    making.delete(id);
  }
}

// True when a kept set already holds exactly these files.
async function same(id, files) {
  const cache = await openSet(id);
  if (!cache) return false;
  for (const f of files) {
    const kept = await cache.match(f.path);
    if (!kept) return false;
    const a = new Uint8Array(await kept.arrayBuffer());
    const b = new Uint8Array(f.body);
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  }
  return true;
}

// Keeps the current set, the next one and the one before (a page may still be loading from it);
// removes every other cache, including the copies an older version of this worker kept.
async function tidy(state) {
  const keep = new Set([STATE, ...[state.current, state.next, state.previous, ...making].filter(Boolean).map((id) => SET + id)]);
  for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
}

// As a page opens: a complete next set becomes current. Returns the id of the set to use.
async function takeOver() {
  const state = await readState();
  if (state.next && state.next !== state.current) {
    const cache = await openSet(state.next);
    let whole = Boolean(cache);
    for (const path of SHELL) if (whole && !(await cache.match(path))) whole = false;
    if (whole) {
      state.previous = state.current || null;
      state.current = state.next;
    }
    state.next = null;
    await writeState(state);
    await tidy(state);
  }
  for (const id of pins.keys()) if (!(await self.clients.get(id))) pins.delete(id);
  return state.current || null;
}

// Downloads in the background, one download at a time. Never fails: a failed download changes nothing.
function refresh() {
  if (!refreshing) refreshing = download(false).catch(() => null).finally(() => { refreshing = null; });
  return refreshing;
}

self.addEventListener('install', (event) => {
  // The first set, or the next one: complete, or the install fails and nothing changes.
  event.waitUntil(download(true).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await tidy(await readState());
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

async function page(event, url) {
  const id = await takeOver();
  if (id && event.resultingClientId) pins.set(event.resultingClientId, id);
  const cache = await openSet(id);
  const key = pageKey(url);
  const saved = key && cache && await cache.match(key);
  event.waitUntil(refresh());
  if (saved) return saved;
  // Any other address, or nothing kept yet: the network, else the kept "not found" page.
  try {
    return await fetch(event.request);
  } catch (err) {
    const missing = cache && await cache.match('404.html');
    if (missing) return missing;
    throw err;
  }
}

// A page's files come from the set it started with (or the current set), never mixed with another.
async function file(event) {
  const cache = await openSet(pins.get(event.clientId)) || await openSet((await readState()).current);
  const saved = cache && await cache.match(event.request);
  return saved || fetch(event.request);   // not one of the app's kept files
}
