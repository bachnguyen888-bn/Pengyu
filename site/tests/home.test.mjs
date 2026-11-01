// Home screen milestone: the greeting hours and every Begin state (logPreview), on an injected clock.
// Run with: node --test "site/tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Each test gets its own copy of state.js and its own in-memory storage, so nothing leaks between tests.
let copy = 0;
function memoryStorage(saved) {
  const m = new Map(saved ? [['pengyu.v1', JSON.stringify(saved)]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}
async function app(at, saved) {
  globalThis.localStorage = memoryStorage(saved);
  const S = await import(new URL(`../js/pengyu/state.js?copy=${++copy}`, import.meta.url));
  S.setClock(() => new Date(at));
  return S;
}
const at = (S, when) => S.setClock(() => new Date(when));
// Week of Monday Oct 26, 2026: Tuesday, Thursday and Saturday planned.
const plan3 = (S) => S.createPlan({ target: 3, days: ['2026-10-27', '2026-10-29', '2026-10-31'], time: '15:30', window: 'after class', place: 'at the gym' });

test('greeting: morning from 5:00, afternoon from 12:00, evening from 17:00 until 4:59', async () => {
  const S = await app('2026-10-26T08:00');
  const cases = [['00:00', 'good evening.'], ['04:59', 'good evening.'], ['05:00', 'good morning.'], ['11:59', 'good morning.'],
    ['12:00', 'good afternoon.'], ['16:59', 'good afternoon.'], ['17:00', 'good evening.'], ['23:30', 'good evening.']];
  for (const [hm, want] of cases) assert.equal(S.greeting(new Date(`2026-10-26T${hm}`)), want, hm);
  at(S, '2026-10-26T09:15');
  assert.equal(S.greeting(), 'good morning.', 'with no argument it reads the injected clock');
});

test('Begin with no plan this week: Plan my week', async () => {
  const S = await app('2026-10-26T08:00');
  assert.deepEqual(S.logPreview(), { kind: 'no-plan' });
});

test('Begin on a planned day: +10 Fish, then Logged today, one a day', async () => {
  const S = await app('2026-10-26T08:00');
  assert.ok(plan3(S));
  at(S, '2026-10-27T17:00');
  assert.deepEqual(S.logPreview(), { kind: 'planned', fish: 10, comeback: '' });
  const res = S.logWorkout();
  assert.equal(res.fish, 10);
  assert.equal(S.state.fish.balance, 10);
  assert.deepEqual(S.logPreview(), { kind: 'logged' });
  assert.equal(S.logWorkout(), null, 'a second log the same day does nothing');
  assert.equal(S.state.fish.balance, 10);
});

test('Begin on an unplanned day with a station ahead: counts for that station', async () => {
  const S = await app('2026-10-26T08:00');
  plan3(S);
  at(S, '2026-10-26T18:00');                       // Monday is not planned; Tuesday is next
  assert.deepEqual(S.logPreview(), { kind: 'moved', from: '2026-10-27', fish: 10, comeback: '' });
});

test('Begin after a missed planned day: Comeback stamp, +15 more', async () => {
  const S = await app('2026-10-26T08:00');
  plan3(S);
  at(S, '2026-10-27T17:00'); S.logWorkout();       // Tuesday done, Thursday then missed
  at(S, '2026-10-31T10:00');                       // Saturday, planned
  assert.deepEqual(S.logPreview(), { kind: 'planned', fish: 25, comeback: '2026-10-29' });
  at(S, '2026-10-30T10:00');                       // or Friday, which moves Saturday's station here
  assert.deepEqual(S.logPreview(), { kind: 'moved', from: '2026-10-31', fish: 25, comeback: '2026-10-29' });
});

test('Begin with no stations left: extra ride, no Fish, the next looks-only extra', async () => {
  const S = await app('2026-10-26T08:00');
  plan3(S);
  for (const d of ['2026-10-27', '2026-10-29', '2026-10-31']) { at(S, `${d}T17:00`); S.logWorkout(); }
  at(S, '2026-11-01T10:00');
  const p = S.logPreview();
  assert.equal(p.kind, 'extra');
  assert.equal(p.fish, 0);
  assert.equal(p.comeback, '');
  assert.equal(p.extra.name, 'Star decal');
});

test('an extra ride while a comeback is due still pays 0 and keeps the comeback', async () => {
  const S = await app('2026-10-26T08:00');
  S.createPlan({ target: 2, days: ['2026-10-28', '2026-10-29'], time: '18:00', window: 'in the evening', place: 'at home' });
  at(S, '2026-10-30T18:00');                       // Wednesday and Thursday not logged, nothing left
  assert.equal(S.logPreview().kind, 'extra');
  assert.equal(S.logPreview().fish, 0);
  S.logWorkout();
  assert.equal(S.state.fish.balance, 0);
  at(S, '2026-11-02T08:00');
  S.createPlan({ target: 2, days: ['2026-11-03', '2026-11-05'], time: '18:00', window: 'in the evening', place: 'at home' });
  at(S, '2026-11-03T18:00');
  assert.equal(S.logPreview().comeback, '2026-10-29', 'the first planned workout still earns it');
});

test('retired paints (mint, purple) load as navy', async () => {
  for (const old of ['mint', 'purple']) {
    const S = await app('2026-10-26T08:00', { v: 1, plans: {}, log: {}, fish: { balance: 0, lifetime: 80 }, owned: { paint: { at: 'x', price: 80 } }, wear: { paint: old } });
    assert.equal(S.state.wear.paint, 'navy', old);
    assert.equal(S.look().paint, 'navy', old);
  }
  const S = await app('2026-10-26T08:00');
  assert.deepEqual(S.PAINTS.map((p) => p.id), ['navy', 'coral', 'sunny', 'pink', 'charcoal']);
});
