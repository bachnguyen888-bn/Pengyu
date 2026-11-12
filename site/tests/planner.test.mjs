// Exercise the actual planner's controls without a browser dependency. The small DOM supplies only
// node creation, text, focus and events; all validation and navigation comes from plan.js/state.js.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage } from './helpers.mjs';

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.events = {}; this.dataset = {}; }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k === 'disabled') this.disabled = true;
    if (k === 'value') this.value = String(v);
    if (k.startsWith('data-')) this.dataset[k.slice(5)] = String(v);
  }
  addEventListener(k, fn) { this.events[k] = fn; }
  append(...children) { this.children.push(...children); }
  focus() { document.activeElement = this; }
  get textContent() { return this.children.map((c) => c instanceof Element ? c.textContent : String(c)).join(''); }
  all() { return [this, ...this.children.filter((c) => c instanceof Element).flatMap((c) => c.all())]; }
  querySelector(q) { const key = /^\[data-key="(.+)"\]$/.exec(q); return key ? this.all().find((e) => e.dataset.key === key[1]) : null; }
  click() { assert.ok(!this.disabled, `enabled: ${this.textContent}`); this.focus(); this.events.click?.({ target: this }); }
}

const originalStorage = globalThis.localStorage;
const originalDocument = globalThis.document;
const restoreGlobals = () => {
  if (originalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originalStorage;
  if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
};
globalThis.localStorage = memoryStorage();
const S = await import('../js/pengyu/state.js');
const P = await import('../js/pengyu/plan.js');
restoreGlobals();
afterEach(restoreGlobals);

function view(when = '2026-11-09T08:00') {
  globalThis.localStorage = memoryStorage();
  globalThis.document = { activeElement: null, createElement: (tag) => new Element(tag), createElementNS: (_ns, tag) => new Element(tag) };
  S.setClock(() => new Date(when)); S.reset(); P.resetPlanDraft();
  const root = new Element('main');
  const render = () => { root.children = []; P.renderPlanFlow(root, render); };
  const find = (key) => root.all().find((e) => e.dataset.key === key);
  const button = (label) => root.all().find((e) => e.tagName === 'button' && e.textContent === label);
  const input = (id) => root.all().find((e) => e.attrs.id === id);
  const click = (key) => { const node = find(key); assert.ok(node, key); node.click(); };
  return { root, render, find, button, input, click };
}
const previous = (days = ['2026-11-09', '2026-11-11', '2026-11-13']) => S.createPlan({ target: days.length, days, time: '18:00', window: 'in the evening', place: 'at home' });

test('first planner: count and days together; explicit time/place and Start are required; planning logs nothing', () => {
  const v = view(); v.render();
  assert.match(v.root.textContent, /Pick your workouts and days\./);
  assert.ok(v.button('Next').disabled);
  v.click('t3'); v.click('2026-11-09'); v.click('2026-11-11'); v.click('2026-11-13');
  assert.equal(S.planFor(), null, 'picks alone save nothing');
  v.button('Next').click();
  assert.match(v.root.textContent, /When and where\?/);
  assert.ok(v.button('Next').disabled, 'no assumed time/place');
  v.click('evening'); v.click('home'); v.button('Next').click();
  assert.equal(S.planFor(), null, 'summary is still a draft');
  v.click('start');
  assert.deepEqual(S.planFor().days, ['2026-11-09', '2026-11-11', '2026-11-13']);
  assert.equal(S.planFor().time, '18:00');
  assert.equal(S.planFor().place, 'at home');
  assert.equal(S.planFor().icsSeq, undefined, 'calendar file not created automatically');
  assert.deepEqual(S.state.log, {});
  assert.equal(S.state.fish.balance, 0);
});

test('returning review: passed weekdays need a player-picked replacement; valid time/place stay editable', () => {
  const v = view(); previous();
  S.setClock(() => new Date('2026-11-18T08:00')); v.render();
  assert.match(v.root.textContent, /Review last week’s plan/);
  assert.ok(v.find('start').disabled);
  assert.equal(v.find('2026-11-16').disabled, true, 'passed Monday cannot be picked');
  assert.equal(S.planFor(), null);
  v.click('2026-11-19');
  assert.ok(!v.find('start').disabled);
  v.click('edit'); v.button('Next').click();
  assert.equal(v.find('evening').attrs['aria-pressed'], 'true');
  assert.equal(v.find('home').attrs['aria-pressed'], 'true');
  v.click('after'); v.click('gym'); v.button('Next').click(); v.click('start');
  assert.deepEqual(S.planFor().days, ['2026-11-18', '2026-11-19', '2026-11-20']);
  assert.equal(S.planFor().time, '15:30');
  assert.equal(S.planFor().place, 'at the gym');
  assert.deepEqual(S.state.log, {});
});

test('an overnight review keeps valid choices and asks for a replacement instead of trapping a disabled selected day', () => {
  const v = view(); previous();
  S.setClock(() => new Date('2026-11-16T23:59')); v.render();
  assert.ok(!v.find('start').disabled);
  S.setClock(() => new Date('2026-11-17T00:01')); v.render();
  assert.ok(v.find('start').disabled);
  assert.match(v.root.textContent, /Monday has passed this week\. Pick 1 more day below\./);
  assert.equal(v.find('2026-11-18').attrs['aria-pressed'], 'true');
  assert.equal(v.find('2026-11-20').attrs['aria-pressed'], 'true');
  v.click('2026-11-19'); v.click('start');
  assert.deepEqual(S.planFor().days, ['2026-11-18', '2026-11-19', '2026-11-20']);
});

test('an overnight first-plan summary returns to valid day choices without losing time/place', () => {
  const v = view('2026-11-09T23:59'); v.render();
  v.click('t2'); v.click('2026-11-09'); v.click('2026-11-11'); v.button('Next').click();
  v.click('evening'); v.click('home'); v.button('Next').click();
  S.setClock(() => new Date('2026-11-10T00:01')); v.render();
  assert.match(v.root.textContent, /A chosen day has passed\. Pick a replacement day\./);
  assert.ok(v.button('Next').disabled);
  v.click('2026-11-12'); v.button('Next').click();
  assert.equal(v.find('evening').attrs['aria-pressed'], 'true');
  assert.equal(v.find('home').attrs['aria-pressed'], 'true');
  v.button('Next').click(); v.click('start');
  assert.deepEqual(S.planFor().days, ['2026-11-11', '2026-11-12']);
});

test('an overnight review with too few remaining days asks for a new count instead of shrinking the plan', () => {
  const v = view(); previous(['2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13']);
  S.setClock(() => new Date('2026-11-19T23:59')); v.render();
  S.setClock(() => new Date('2026-11-20T00:01')); v.render();
  assert.ok(v.find('start').disabled);
  assert.match(v.root.textContent, /Only 3 days are left this week, so pick a number\./);
  assert.ok(v.find('t4').disabled);
  assert.equal(v.find('t3').attrs['aria-pressed'], 'false', 'no smaller count assumed');
  v.click('t2'); v.click('2026-11-21'); v.click('start');
  assert.equal(S.planFor().target, 2);
  assert.deepEqual(S.planFor().days, ['2026-11-20', '2026-11-21']);
});

test('custom time rejects an out-of-range hour or minute before advancing', () => {
  const v = view(); v.render();
  v.click('t2'); v.click('2026-11-09'); v.click('2026-11-11'); v.button('Next').click();
  v.click('home'); v.click('custom-time');
  const input = v.input('py-time');
  for (const bad of ['', '25:00', '18:61', '99:99']) {
    input.value = bad; input.events.input({ target: input });
    assert.ok(v.button('Next').disabled, `invalid: ${bad}`);
  }
  input.value = '19:45'; input.events.input({ target: input });
  assert.ok(!v.button('Next').disabled);
});
