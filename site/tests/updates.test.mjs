// Offline updates are all or nothing: sw.js runs here against in-memory Cache Storage and a fake
// network, built from the real files in site/. A failed file or a dropped connection changes nothing;
// a complete update waits for the next page; an open page keeps the set it started with; offline,
// every page and file comes from one kept set. Run with: node --test "site/tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SITE = new URL('../', import.meta.url);
const BASE = 'https://pengyu.test/';
const SOURCE = readFileSync(new URL('sw.js', SITE), 'utf8');
const SHELL = [...SOURCE.slice(SOURCE.indexOf('const SHELL'), SOURCE.indexOf('];', SOURCE.indexOf('const SHELL'))).matchAll(/'([^']+)'/g)].map((m) => m[1]);
const url = (input) => new URL(typeof input === 'string' ? input : input.url, BASE).href;

class FakeCache {
  entries = new Map();
  async match(req) {
    const e = this.entries.get(url(req));
    return e && new Response(e.body.slice(0), { status: e.status, headers: e.headers });
  }
  async put(req, res) { this.entries.set(url(req), { body: await res.arrayBuffer(), status: res.status, headers: [...res.headers] }); }
  async keys() { return [...this.entries.keys()].map((u) => new Request(u)); }
}
class FakeStorage {
  map = new Map();
  async open(name) { if (!this.map.has(name)) this.map.set(name, new FakeCache()); return this.map.get(name); }
  async has(name) { return this.map.has(name); }
  async delete(name) { return this.map.delete(name); }
  async keys() { return [...this.map.keys()]; }
}

// The site's own files, with per-test changes: edits (path → new text), broken (path → status) and
// down (no connection at all, or for listed paths only).
function network() {
  const net = { edits: new Map(), broken: new Map(), down: false, downFor: new Set(), hits: 0 };
  net.fetch = async (req) => {
    const path = new URL(url(req)).pathname.slice(1) || 'clearhealth-pengu.html';
    net.hits++;
    if (net.down || net.downFor.has(path)) throw new TypeError('Failed to fetch');
    if (net.broken.has(path)) return new Response('unavailable', { status: net.broken.get(path) });
    const file = path === 'privacy' ? 'privacy.html' : path;
    let body;
    try { body = net.edits.get(file) ?? readFileSync(new URL(file, SITE)); } catch { return new Response('not found', { status: 404 }); }
    return new Response(body, { status: 200, headers: { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html' } });
  };
  return net;
}

// Loads sw.js as a worker would: its own self, caches and fetch.
function worker(caches, net, live = new Set()) {
  const on = {};
  const self = {
    location: new URL('sw.js', BASE),
    addEventListener: (type, fn) => { on[type] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {}, get: async (id) => (live.has(id) ? { id } : undefined) },
  };
  class SwRequest extends Request { constructor(input, init) { super(typeof input === 'string' ? new URL(input, BASE).href : input, init); } }
  vm.runInContext(SOURCE, vm.createContext({ self, caches, fetch: (r) => net.fetch(r), Request: SwRequest, Response, Headers, URL, Uint8Array, console }));
  const run = async (type) => { let p; on[type]({ waitUntil: (x) => { p = x; } }); await p; };
  // A request through the worker: the response, after any background work it started has finished.
  const get = async (path, { navigate = false, client = '', opens = '' } = {}) => {
    const later = [];
    let answer;
    on.fetch({
      request: { method: 'GET', url: new URL(path, BASE).href, mode: navigate ? 'navigate' : 'cors' },
      clientId: client, resultingClientId: opens,
      respondWith: (p) => { answer = p; }, waitUntil: (p) => { later.push(p); },
    });
    const res = await answer;
    const text = await res.text();
    await Promise.all(later);
    return { status: res.status, text };
  };
  return { install: () => run('install'), activate: () => run('activate'), get, live };
}

const sets = async (caches) => (await caches.keys()).filter((k) => k.startsWith('pengyu-set-')).sort();
const state = async (caches) => JSON.parse(await (await (await caches.open('pengyu-state')).match('/__pengyu-state__')).text());
const APP_JS = 'js/pengyu/app.js';
const original = readFileSync(new URL(APP_JS, SITE), 'utf8');

async function installed() {
  const caches = new FakeStorage();
  (await caches.open('pengyu-v2')).put(BASE, new Response('an older worker\'s copy'));
  const net = network();
  const sw = worker(caches, net, new Set(['a', 'b', 'c']));
  await sw.install();
  await sw.activate();
  return { caches, net, sw };
}

test('install keeps one complete set of every file, and the older worker\'s copy goes', async () => {
  const { caches } = await installed();
  const ids = await sets(caches);
  assert.equal(ids.length, 1);
  assert.equal((await (await caches.open(ids[0])).keys()).length, SHELL.length);
  assert.deepEqual(await state(caches), { current: ids[0].slice('pengyu-set-'.length) });
  assert.ok(!(await caches.has('pengyu-v2')), 'the old copy was removed');
});

test('one failed file changes nothing: no new set, the kept set untouched', async () => {
  const { caches, net, sw } = await installed();
  const before = { ids: await sets(caches), state: await state(caches) };
  net.edits.set(APP_JS, `${original}\n// changed`);
  for (const status of [503, 404, 500]) {
    net.broken.set('js/pengyu/history.js', status);
    await sw.get('/', { navigate: true, opens: 'a' });
    assert.deepEqual(await sets(caches), before.ids, `status ${status}`);
    assert.deepEqual(await state(caches), before.state);
  }
  assert.equal((await sw.get(APP_JS, { client: 'a' })).text, original, 'the page still gets the kept files');
});

test('a connection that drops mid-update changes nothing', async () => {
  const { caches, net, sw } = await installed();
  const before = { ids: await sets(caches), state: await state(caches) };
  net.edits.set(APP_JS, `${original}\n// changed`);
  for (const path of SHELL.slice(SHELL.length / 2)) net.downFor.add(path === './' ? 'clearhealth-pengu.html' : path);
  await sw.get('/', { navigate: true, opens: 'a' });
  assert.deepEqual(await sets(caches), before.ids);
  assert.deepEqual(await state(caches), before.state);
  assert.equal((await sw.get(APP_JS, { client: 'a' })).text, original, 'app.js arrived, but the kept set did not change');
  net.downFor.clear();
  net.down = true;
  await sw.get('/', { navigate: true, opens: 'b' });
  assert.deepEqual(await sets(caches), before.ids);
});

test('a complete update waits for the next page; an open page keeps the set it started with', async () => {
  const { caches, net, sw } = await installed();
  const [first] = await sets(caches);
  net.edits.set(APP_JS, `${original}\n// version 2`);
  const pageA = await sw.get('/', { navigate: true, opens: 'a' });
  assert.match(pageA.text, /PENGYU/, 'the page opened from the kept set');
  const ids = await sets(caches);
  assert.equal(ids.length, 2, 'the new set was made in the background');
  const s = await state(caches);
  assert.equal(`pengyu-set-${s.current}`, first, 'and waits: the current set is unchanged');
  assert.ok(s.next);
  assert.equal((await (await caches.open(`pengyu-set-${s.next}`)).keys()).length, SHELL.length, 'the next set is complete');
  assert.equal((await sw.get(APP_JS, { client: 'a' })).text, original, 'page A still gets its own files');

  await sw.get('/', { navigate: true, opens: 'b' });
  const s2 = await state(caches);
  assert.equal(s2.current, s.next, 'the next page took the new set');
  assert.equal(`pengyu-set-${s2.previous}`, first);
  assert.match((await sw.get(APP_JS, { client: 'b' })).text, /version 2$/, 'page B gets the new files');
  assert.equal((await sw.get(APP_JS, { client: 'a' })).text, original, 'page A, still open, keeps its set');

  net.edits.set(APP_JS, `${original}\n// version 3`);
  await sw.get('/', { navigate: true, opens: 'c' });   // makes version 3
  await sw.get('/', { navigate: true, opens: 'c' });   // takes it over
  assert.equal((await sets(caches)).length, 2, 'only the current set and the one before are kept');
  assert.ok(!(await sets(caches)).includes(first));
});

test('nothing new: nothing is written', async () => {
  const { caches, sw } = await installed();
  const before = await sets(caches);
  await sw.get('/', { navigate: true, opens: 'a' });
  await sw.get('/privacy', { navigate: true, opens: 'b' });
  assert.deepEqual(await sets(caches), before);
  assert.equal((await state(caches)).next, undefined);
});

test('offline, pages and files all come from the kept set', async () => {
  const { net, sw } = await installed();
  net.down = true;
  const hits = net.hits;
  const app = await sw.get('/', { navigate: true, opens: 'a' });
  assert.equal(app.status, 200);
  assert.match(app.text, /<main id="main"/);
  assert.match((await sw.get('/privacy', { navigate: true, opens: 'b' })).text, /<h1>Privacy<\/h1>/);
  assert.match((await sw.get('/no-such-page', { navigate: true, opens: 'c' })).text, /This page isn’t on the route\./, 'the kept not-found page');
  for (const path of SHELL.filter((p) => p.endsWith('.js'))) assert.equal((await sw.get(path, { client: 'a' })).status, 200, path);
  assert.ok(net.hits > hits, 'it did try the network in the background, and that failure changed nothing');
});
