// Progress as the screens show it: the first-week Fish math, the next stop and what it pays, the week's
// goal line, the next gear goal, previews that buy nothing, next-week planning, the first postcard and
// what sharing it may contain. Reads only: none of these change Fish, workouts or ownership.
// Run with: node --test "site/tests/*.test.mjs"
// Week used: Monday Nov 2 to Sunday Nov 8, 2026, then Monday Nov 9.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshApp, reload, at, plan, logOn, rich } from './helpers.mjs';

const MON = '2026-11-02';
const MWF = ['2026-11-02', '2026-11-04', '2026-11-06'];
const snapshot = (S) => JSON.stringify({ fish: S.state.fish, log: S.state.log, owned: S.state.owned, wear: S.state.wear, bonus: S.state.weekBonusPaid, plans: S.state.plans });

// ---------- The first week ----------
test('first week: 2, 3 or 4 planned workouts, all logged, earn 45, 55 or 65 Fish, and the 40-Fish scarf', async () => {
  // Only planned workouts, one a day: no comeback, no beyond-plan workout and no second log is needed.
  const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
  for (const [n, total] of [[2, 45], [3, 55], [4, 65]]) {
    const S = await freshApp(`${MON}T07:00`);
    assert.ok(plan(S, days.slice(0, n)));
    for (const d of days.slice(0, n)) logOn(S, d);
    assert.equal(S.state.fish.balance, total, `${n} workouts: ${n} × 10 + 25`);
    assert.equal(S.state.weekBonusPaid.length, 1);
    assert.equal(S.comebackStamps(), 0);
    assert.equal(S.route(MON).extras, 0);
    assert.deepEqual(S.nextGoal(), { item: S.GEAR[0], balance: total, price: 40, ready: true });
    assert.ok(S.buy('scarf'), `the scarf with ${total} Fish`);
    assert.equal(S.state.fish.balance, total - 40);
    assert.equal(S.look().scarf, true);
  }
});

test('first week: with a planned workout not logged there is no bonus, so no promise of the scarf', async () => {
  for (const [n, total] of [[2, 10], [3, 20], [4, 30]]) {
    const S = await freshApp(`${MON}T07:00`);
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].slice(0, n);
    assert.ok(plan(S, days));
    for (const d of days.slice(1)) logOn(S, d);   // the first planned day passes unlogged
    // The first logged workout after it pays the +15 comeback; take it away to see the plain math.
    assert.equal(S.state.fish.balance - S.comebackStamps() * 15, total, `${n - 1} of ${n} logged`);
    assert.equal(S.state.weekBonusPaid.length, 0, 'the week bonus needs every planned workout');
  }
});

// ---------- The next stop ----------
test('next stop: this week’s next open station, with what it pays', async () => {
  const S = await freshApp(`${MON}T07:00`);
  assert.ok(plan(S, MWF));
  at(S, `${MON}T09:00`);
  assert.deepEqual(S.nextStop(), { day: '2026-11-02', week: MON, fish: 10, comeback: 0, completes: false }, 'today, not logged yet');
  logOn(S, '2026-11-02');
  assert.deepEqual(S.nextStop(), { day: '2026-11-04', week: MON, fish: 10, comeback: 0, completes: false }, 'after a log: the next station');
  at(S, '2026-11-03T12:00');
  assert.equal(S.nextStop().day, '2026-11-04', 'a day between stations points at the next one');
  logOn(S, '2026-11-04');
  assert.deepEqual(S.nextStop(), { day: '2026-11-06', week: MON, fish: 10, comeback: 0, completes: true }, 'the last one would hit the week');
  logOn(S, '2026-11-06');
  assert.equal(S.nextStop(), null, 'week complete, next week not planned: no stop is invented');
});

test('next stop: a planned day that passed unlogged makes the next one a welcome back (+15)', async () => {
  const S = await freshApp(`${MON}T07:00`);
  assert.ok(plan(S, MWF));
  logOn(S, '2026-11-02');
  at(S, '2026-11-05T12:00');   // Wednesday passed unlogged
  assert.deepEqual(S.nextStop(), { day: '2026-11-06', week: MON, fish: 10, comeback: 15, completes: false });
  assert.deepEqual(S.weekGoal(), { kind: 'out-of-reach', open: 1 });
});

test('next stop: on Sunday it is next week’s first station once that week is planned', async () => {
  const S = await freshApp(`${MON}T07:00`);
  assert.ok(plan(S, MWF));
  for (const d of MWF) logOn(S, d);
  at(S, '2026-11-08T10:00');
  assert.equal(S.canPlanNextWeek(), true, 'Sunday: next week can be planned');
  assert.equal(S.nextStop(), null);
  assert.ok(plan(S, ['2026-11-09', '2026-11-11']));
  assert.equal(S.canPlanNextWeek(), false, 'already planned');
  assert.deepEqual(S.nextStop(), { day: '2026-11-09', week: '2026-11-09', fish: 10, comeback: 0, completes: false });
});

test('next-week planning is offered only when the planning rules allow it (Sunday)', async () => {
  const S = await freshApp(`${MON}T07:00`);
  assert.ok(plan(S, MWF));
  for (const day of ['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-07']) {
    at(S, `${day}T12:00`);
    assert.equal(S.canPlanNextWeek(), false, day);
  }
  at(S, '2026-11-08T08:00');
  assert.equal(S.canPlanNextWeek(), true);
});

// ---------- The week's goal line ----------
test('week goal: more, one left (bonus in reach), hit; out of reach once a planned day passes; over', async () => {
  const S = await freshApp(`${MON}T07:00`);
  assert.ok(plan(S, MWF));
  assert.deepEqual(S.weekGoal(), { kind: 'more', need: 3 });
  logOn(S, '2026-11-02');
  assert.deepEqual(S.weekGoal(), { kind: 'more', need: 2 });
  logOn(S, '2026-11-04');
  assert.deepEqual(S.weekGoal(), { kind: 'one-left', need: 1 });
  logOn(S, '2026-11-06');
  assert.deepEqual(S.weekGoal(), { kind: 'hit' });

  const T = await freshApp(`${MON}T07:00`);
  assert.ok(plan(T, MWF));
  logOn(T, '2026-11-02');
  at(T, '2026-11-05T09:00');
  assert.equal(T.weekGoal().kind, 'out-of-reach', 'one planned day passed: the +25 is out of reach');
  at(T, '2026-11-07T09:00');
  assert.deepEqual(T.weekGoal(), { kind: 'over' }, 'no planned workouts left this week');
});

// ---------- The next gear goal and previews ----------
test('next goal: the scarf first, against the real balance, then the next piece; train upgrades last', async () => {
  const S = await freshApp(`${MON}T07:00`, rich(10));
  assert.deepEqual(S.nextGoal(), { item: S.GEAR[0], balance: 10, price: 40, ready: false });
  const R = await freshApp(`${MON}T07:00`, rich(70));
  assert.ok(R.buy('headlamp'));   // Fish spent elsewhere
  assert.deepEqual(R.nextGoal(), { item: R.GEAR[0], balance: 20, price: 40, ready: false }, 'the goal reads what is left');
  const O = await freshApp(`${MON}T07:00`, rich(1000));
  assert.ok(O.buy('scarf'));
  assert.equal(O.nextGoal().item.id, 'cap', 'once the scarf is owned, the cap');
  for (const id of ['cap', 'backpack', 'conductor']) assert.ok(O.buy(id));
  assert.equal(O.nextGoal().item.id, 'headlamp');
  for (const id of ['headlamp', 'paint', 'car']) assert.ok(O.buy(id));
  assert.equal(O.nextGoal(), null, 'everything owned');
});

test('a preview shows the piece but buys, spends and saves nothing', async () => {
  const S = await freshApp(`${MON}T07:00`, rich(10));
  const before = snapshot(S);
  assert.equal(S.lookWith('scarf').scarf, true);
  assert.equal(S.lookWith('conductor').hat, 'conductor');
  assert.equal(S.lookWith('car').car, true);
  assert.equal(S.lookWith('paint').paint, 'coral');
  assert.equal(S.look().scarf, false, 'what shows normally is unchanged');
  assert.equal(snapshot(S), before);
  assert.equal(S.owns('scarf'), false);
});

// ---------- The first postcard and sharing it ----------
test('the first postcard: only after a week with every planned workout logged; it survives a reload and pays nothing', async () => {
  let S = await freshApp(`${MON}T07:00`);
  assert.ok(plan(S, MWF));
  logOn(S, '2026-11-02');
  logOn(S, '2026-11-04');
  assert.equal(S.firstFullWeek(), null, 'two of three: not yet');
  logOn(S, '2026-11-06');
  const fish = S.state.fish.balance;
  assert.deepEqual(S.firstFullWeek(), { monday: MON, done: 3, target: 3 });
  assert.equal(S.state.fish.balance, fish, 'no Fish for the postcard');
  S = await reload(S, '2026-11-07T09:00');
  assert.deepEqual(S.firstFullWeek(), { monday: MON, done: 3, target: 3 }, 'after a reload');
  assert.equal(S.state.fish.balance, fish);
});

test('sharing text holds only what was picked: a caption, a prop, and dates or workouts only when switched on', async () => {
  const S = await freshApp(`${MON}T07:00`);
  assert.equal(S.postcardText(), '', 'nothing to share before the first full week');
  assert.ok(plan(S, MWF));
  for (const d of MWF) logOn(S, d);
  assert.equal(S.postcardText(), 'Week complete with Pengu.');
  assert.equal(S.postcardText({ caption: 2, prop: 'train' }), 'Pengu and I reached the last station. 🚂');
  assert.equal(S.postcardText({ caption: 1, dates: true }), 'Every stop, start to finish.\nNov 2 – Nov 8');
  assert.equal(S.postcardText({ workouts: true }), 'Week complete with Pengu.\n3 of 3 planned workouts');
  const all = S.postcardText({ caption: 0, prop: 'sun', dates: true, workouts: true });
  for (const never of ['gym', 'evening', 'after class', '15:30', '3:30', 'http', 'Pengyu']) assert.equal(all.includes(never), false, `never "${never}"`);
});
