// Offline and launch files: the service worker keeps every file the app loads, the headers let the
// worker fetch them, the manifest's icons exist at their stated sizes, and the privacy page stays a
// plain, script-free page at a stable address. Run with: node --test "site/tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const SITE = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, SITE), 'utf8');
const exists = (path) => existsSync(new URL(path, SITE));

const sw = read('sw.js');
const SHELL = [...sw.slice(sw.indexOf('const SHELL'), sw.indexOf('];', sw.indexOf('const SHELL'))).matchAll(/'([^']+)'/g)].map((m) => m[1]);

// Every module the app loads, by following static imports from the page's scripts.
function modules() {
  const seen = new Set();
  const visit = (path) => {
    if (seen.has(path)) return;
    seen.add(path);
    const src = read(path);
    for (const m of src.matchAll(/import\s+(?:[^'"]*?from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g)) {
      visit(new URL(m[1], new URL(path, SITE)).pathname.replace(new URL(SITE).pathname, ''));
    }
  };
  visit('js/main.js');
  return [...seen];
}

test('every file in the offline list exists', () => {
  assert.ok(SHELL.length > 10, 'the list was read');
  for (const path of SHELL) assert.ok(exists(path === './' ? 'clearhealth-pengu.html' : path), path);
});

test('the offline list holds every script, style and font the app loads', () => {
  const html = read('clearhealth-pengu.html');
  const page = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|woff2|svg|webmanifest))"/g)].map((m) => m[1]);
  const css = [...read('pengu.css').matchAll(/url\("?((?:fonts|icons)\/[^")]+)"?\)/g)].map((m) => m[1]);
  for (const path of new Set([...modules(), ...page, ...css])) assert.ok(SHELL.includes(path), `${path} is kept for offline`);
  for (const path of ['./', 'privacy.html', '404.html']) assert.ok(SHELL.includes(path), path);
});

test('the worker may fetch the app\'s own files, and nothing else is allowed', () => {
  const csp = /Content-Security-Policy: (.+)/.exec(read('_headers'))[1];
  assert.match(csp, /connect-src 'self';/, 'the service worker takes its policy from _headers');
  assert.match(csp, /default-src 'none'/);
  assert.doesNotMatch(csp, /https?:|\*/, 'no outside hosts anywhere in the policy');
  assert.match(read('js/main.js'), /serviceWorker\.register\('\/sw\.js'\)/);
});

test('the manifest is complete and its icons exist at the stated sizes', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.name, 'Pengyu');
  assert.equal(m.short_name, 'Pengyu');
  assert.equal(m.id, '/');
  assert.equal(m.start_url, '/');
  assert.equal(m.scope, '/');
  assert.equal(m.display, 'standalone');
  assert.equal(m.background_color, '#FAF6F0');
  assert.equal(m.theme_color, '#FAF6F0');
  for (const icon of m.icons) {
    const png = readFileSync(new URL(icon.src, SITE));
    const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.equal(`${w}x${h}`, icon.sizes, icon.src);
  }
  const purposes = m.icons.map((i) => `${i.sizes} ${i.purpose}`);
  for (const want of ['192x192 any', '512x512 any', '512x512 maskable', '512x512 monochrome']) assert.ok(purposes.includes(want), want);
  assert.ok(exists('apple-touch-icon.png'));
});

test('the privacy page: a stable address, linked from the app, and no scripts or outside files', () => {
  const page = read('privacy.html');
  assert.match(read('_redirects'), /^\/privacy\s+\/privacy\.html\s+200$/m);
  assert.doesNotMatch(page, /<script/i, 'nothing on the privacy page can run or track');
  // Files the page loads are all its own (a canonical link names an address; nothing is fetched).
  for (const m of page.matchAll(/<(?:link|img|script|iframe)(?![^>]*rel="canonical")[^>]+(?:src|href)="([^"]+)"/g)) assert.doesNotMatch(m[1], /^https?:/, m[1]);
  assert.match(page, /Save a backup \(JSON\)/);
  assert.match(page, /Reset everything/);
  assert.match(page, /pengyu\.v1/);
  assert.match(read('js/pengyu/history.js'), /href: 'privacy\.html'/, 'linked from Your data');
  assert.match(read('js/pengyu/ui.js'), /href: 'privacy\.html'/, 'linked from the footer');
});

test('the privacy page names exactly the storage the code uses', () => {
  const code = ['js/boot.js', 'js/pengyu/app.js', 'js/pengyu/state.js'].map(read).join('\n');
  const keys = new Set([...code.matchAll(/(?:local|session)Storage\.(?:get|set|remove)Item\('([^']+)'/g)].map((m) => m[1]));
  // Named in code: the splash flag (session) and a check value written and removed at once; the record
  // itself is state.js's KEY. The page describes all three.
  assert.deepEqual([...keys].sort(), ['pengyu.probe', 'pengyu.splash']);
  assert.match(read('js/pengyu/state.js'), /const KEY = 'pengyu\.v1';/);
  assert.match(read('privacy.html'), /splash/);
  const everywhere = ['js/fx.js', 'js/pengyu/art.js', 'js/pengyu/backup.js', 'js/pengyu/history.js', 'js/pengyu/ics.js', 'js/pengyu/ink.js', 'js/pengyu/motion.js', 'js/pengyu/plan.js', 'js/pengyu/route.js', 'js/pengyu/shop.js', 'js/pengyu/ui.js', 'js/main.js'].map(read).join('\n');
  for (const api of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'document.cookie', 'geolocation', 'getUserMedia', 'WebSocket', 'indexedDB']) {
    assert.equal(everywhere.includes(api) || code.includes(api), false, `the app never uses ${api}`);
  }
});
