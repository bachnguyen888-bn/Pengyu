// Boundaries around a player's own files, shared choices and literal text. Run the shipped code;
// replace only browser/state dependencies, never the implementations being checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { freshApp, plan } from './helpers.mjs';

const read = (file) => readFileSync(new URL(`../js/pengyu/${file}`, import.meta.url), 'utf8');
function module(file, globals, expose) {
  const source = read(file).replace(/^import[^\n]*\r?\n/gm, '').replace(/^export /gm, '');
  const context = vm.createContext(globals);
  vm.runInContext(`${source}\n${expose}`, context, { filename: file });
  return context.__api;
}
function history() {
  let notify;
  let checks = 0;
  const saved = { private: 'untouched' };
  const S = {
    state: saved,
    subscribe: (fn) => { notify = fn; },
    checkBackup: (text) => { checks++; return { ok: true, summary: { weeks: text.length, fish: 10 } }; },
  };
  const api = module('history.js', { S }, `globalThis.__api = {
    checkRestoreFile,
    picks: () => ({ share, friend, picture, restore, resetStep, resetSaved }),
    picked: () => {
      share = { open: true, caption: 2, prop: 'snow', dates: true, workouts: true, link: true, status: 'old' };
      friend = { open: true, days: true, time: true, place: true, link: true, status: 'old' };
      picture = { file: 'old image' };
    },
  };`);
  return { ...api, notify: (type) => notify({ type }), checks: () => checks, saved };
}

test('reset and restore clear all postcard/invitation details and old image choices', () => {
  for (const type of ['reset', 'restore']) {
    const H = history(); H.picked(); H.notify(type);
    const picks = H.picks();
    for (const key of ['dates', 'workouts', 'link']) assert.equal(picks.share[key], false, key);
    for (const key of ['days', 'time', 'place', 'link']) assert.equal(picks.friend[key], false, key);
    assert.equal(picks.share.caption, 0);
    assert.equal(picks.share.prop, '');
    assert.equal(picks.share.open, false);
    assert.equal(picks.friend.open, false);
    assert.equal(picks.picture.file, null);
    assert.equal(picks.restore, null);
  }
});

test('a backup over 10 MiB is refused before reading or parsing and cannot mutate the save', async () => {
  const H = history(); let reads = 0;
  assert.equal(await H.checkRestoreFile({ size: 10 * 1024 * 1024 + 1, text() { reads++; throw new Error('must not read'); } }), true);
  assert.equal(reads, 0);
  assert.equal(H.checks(), 0);
  assert.match(H.picks().restore.error, /too large.*Nothing was changed/);
  assert.deepEqual(H.saved, { private: 'untouched' });
});

test('the most recently picked backup wins; reset cancels an outstanding read', async () => {
  const H = history(); let resolveOld;
  const old = H.checkRestoreFile({ size: 3, text: () => new Promise((resolve) => { resolveOld = resolve; }) });
  await H.checkRestoreFile({ size: 3, text: async () => 'new' });
  resolveOld('old');
  assert.equal(await old, false);
  assert.equal(H.picks().restore.text, 'new');
  let finish;
  const late = H.checkRestoreFile({ size: 1, text: () => new Promise((resolve) => { finish = resolve; }) });
  H.notify('reset'); finish('old');
  assert.equal(await late, false);
  assert.equal(H.picks().restore, null);
});

test('user-entered markup is appended as literal text and never parsed as HTML', () => {
  const nodes = [];
  const document = { createElement(tag) {
    const n = { tag, children: [], attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {}, append(v) { this.children.push(v); } };
    Object.defineProperty(n, 'innerHTML', { set() { throw new Error('user text must not be parsed'); } });
    nodes.push(n); return n;
  } };
  const U = module('ui.js', { document }, 'globalThis.__api = { h };');
  const entered = '</textarea><svg onload=alert(1)>pool</svg>';
  const area = U.h('textarea', { readonly: true }, entered);
  assert.equal(area.children[0], entered);
  assert.equal(nodes.length, 1, 'no child tags or event handlers are created from text');
  const label = U.h('p', {}, entered);
  assert.equal(label.children[0], entered);
});

test('the live invitation starts private and its explicit link choice shares exactly the preview', async () => {
  const S = await freshApp('2026-11-09T08:00');
  plan(S, ['2026-11-09', '2026-11-11']);
  const url = 'https://bachnguyenclearhealth.com/';
  const sent = [];
  const h = (tag, attrs, ...children) => ({ tag, attrs, children: children.flat().filter(Boolean) });
  const I = module('invite.js', {
    S: { appLink: () => url, inviteText: (choices, p) => S.inviteText(choices, p, url) },
    h, icon: () => null, navigator: { share: async (payload) => { sent.push(payload); } }, requestAnimationFrame() {},
  }, 'globalThis.__api = { inviteBody };');
  const st = { days: false, time: false, place: false, link: false, status: '' };
  const render = () => I.inviteBody({ st, plan: S.planFor(), refill() {}, done() {} });
  const all = (nodes) => nodes.flatMap((n) => typeof n === 'object' ? [n, ...all(n.children)] : []);
  let controls = all(render());
  const preview = () => controls.find((n) => n.tag === 'textarea').children[0];
  assert.equal(preview(), S.INVITE.join('\n'));
  assert.equal(controls.find((n) => n.attrs.id === 'py-invite-link').attrs['aria-pressed'], 'false');
  assert.equal(sent.length, 0);
  controls.find((n) => n.attrs.id === 'py-invite-link').attrs.onclick();
  controls = all(render());
  assert.equal(preview(), `${S.INVITE.join('\n')}\n${url}`);
  assert.doesNotMatch(preview(), /Monday|Wednesday|gym|3:30/);
  await controls.find((n) => n.attrs.id === 'py-invite-share').attrs.onclick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].text, preview());
});
