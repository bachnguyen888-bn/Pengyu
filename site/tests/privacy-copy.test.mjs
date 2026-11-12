// The plain-language policy is a product surface: keep unlogged days neutral and explain all the
// browser storage and explicit export/sharing boundaries rather than implying cloud persistence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
const visible = page.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('Privacy describes unlogged days neutrally without hiding comeback or weekly cover records', () => {
  assert.doesNotMatch(visible, /\bmissed\b/i);
  assert.match(visible, /planned workout was not logged/);
  assert.match(visible, /Comeback stamps/);
  assert.match(visible, /no plan made \(free covers, once per calendar month\)/);
});

test('Privacy keeps the local-save, export and explicit-share boundaries visible', () => {
  for (const term of ['localStorage', 'sessionStorage', 'Cache Storage', 'host may keep request logs', 'Save a backup', 'Restore', 'Reset everything', 'Download calendar reminders', 'Preview your postcard', 'Download postcard', 'Copy invite']) {
    assert.ok(visible.includes(term), term);
  }
  assert.match(visible, /preview explains what Share will send before you tap it/);
  assert.match(visible, /no automatic cloud backup or sync/);
  assert.match(visible, /Nothing is sent until you pick where it goes/);
});
