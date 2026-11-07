// The journey's promises, as rules: the first goal's math is exactly the game's (a full week of the
// smallest plan, 45 Fish, against the 40-Fish scarf); "Finish your plan and it's yours" appears only when
// the planned workouts still open (plus a week bonus that can still be earned) really cover the price,
// never counting a comeback, an extra workout or Fish already spent; "Start this week" repeats last
// plan only when it fits the week as it is; and the last backup's date comes from the save itself.
// Run with: node --test "site/tests/*.test.mjs"
// Weeks used: Monday Nov 2 to Sunday Nov 8, 2026, then Monday Nov 9.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshApp, reload, at, plan, logOn, rich } from './helpers.mjs';

const MON = '2026-11-02';
const NEXT = '2026-11-09';
const MWF = ['2026-11-02', '2026-11-04', '2026-11-06'];

// ---------- The first goal ----------
test('first goal: the scarf, 40 Fish; a full week of 2 planned workouts earns 45 (the game’s own math)', async () => {
  const S = await freshApp(`${MON}T07:00`);
  assert.deepEqual(S.firstGoal(), { item: S.GEAR[0], price: 40, smallest: 2, earns: 45 });
  // And it is true: plan 2, log both, and the scarf can be bought.
  plan(S, ['2026-11-02', '2026-11-03']);
  logOn(S, '2026-11-02'); logOn(S, '2026-11-03');
  assert.equal(S.state.fish.balance, S.firstGoal().earns);
  assert.ok(S.buy('scarf'));
});

// ---------- "Finish your plan and it's yours" ----------
test('reach: after the first of three planned workouts, the rest plus the week bonus cover the scarf', async () => {
  const S = await freshApp(`${MON}T07:00`);
  plan(S, MWF);
  logOn(S, '2026-11-02');
  const r = S.reach();
  assert.equal(r.item.id, 'scarf');
  assert.deepEqual({ balance: r.balance, left: r.left, bonus: r.bonus, potential: r.potential, inWeek: r.inWeek }, { balance: 10, left: 2, bonus: 25, potential: 55, inWeek: true });
  logOn(S, '2026-11-04');
  assert.deepEqual([S.reach().left, S.reach().potential, S.reach().inWeek], [1, 55, true], 'one left: 20 + 10 + 25');
});

test('reach: once a planned day passes unlogged, the bonus is out and no "it’s yours" is claimed when short', async () => {
  const S = await freshApp(`${MON}T07:00`);
  plan(S, MWF);
  logOn(S, '2026-11-02');
  at(S, '2026-11-05T09:00');   // Thursday: Wednesday passed without a log
  const r = S.reach();
  assert.deepEqual({ left: r.left, bonus: r.bonus, potential: r.potential, inWeek: r.inWeek }, { left: 1, bonus: 0, potential: 20, inWeek: false });
});

test('reach: comebacks and extra workouts are never counted', async () => {
  const S = await freshApp(`${MON}T07:00`);
  plan(S, MWF);
  at(S, '2026-11-05T09:00');   // Monday and Wednesday passed: a comeback is due on Friday
  assert.ok(S.comebackDue('2026-11-06'));
  const r = S.reach();
  assert.deepEqual({ left: r.left, potential: r.potential, inWeek: r.inWeek }, { left: 1, potential: 10, inWeek: false }, 'the +15 is not counted');
});

test('reach: Fish spent elsewhere are not in the balance; an item already affordable reads ready, not "in reach"', async () => {
  const S = await freshApp(`${MON}T07:00`, rich(55));
  assert.ok(S.buy('headlamp'));   // 50 spent on the train: 5 left
  plan(S, ['2026-11-02', '2026-11-04']);
  let r = S.reach();
  assert.deepEqual({ balance: r.balance, potential: r.potential, inWeek: r.inWeek }, { balance: 5, potential: 50, inWeek: true }, '5 + 2 × 10 + 25');
  const T = await freshApp(`${MON}T07:00`, rich(45));
  plan(T, MWF);
  r = T.reach();
  assert.equal(r.ready, true);
  assert.equal(r.inWeek, false);
});

test('reach: with the week already hit, nothing is left to count', async () => {
  const S = await freshApp(`${MON}T07:00`);
  plan(S, ['2026-11-02', '2026-11-03']);
  logOn(S, '2026-11-02'); logOn(S, '2026-11-03');
  assert.ok(S.buy('scarf'));   // 45 - 40 = 5; the cap (90) is next
  const r = S.reach();
  assert.equal(r.item.id, 'cap');
  assert.deepEqual({ left: r.left, bonus: r.bonus, potential: r.potential, inWeek: r.inWeek }, { left: 0, bonus: 0, potential: 5, inWeek: false });
});

// ---------- "Start this week": one tap to the same plan ----------
test('repeat: on Monday, last week’s plan again in one tap, the same days, time and place; nothing logged', async () => {
  const S = await freshApp(`${MON}T07:00`);
  plan(S, MWF);
  for (const d of MWF) logOn(S, d);
  at(S, `${NEXT}T07:00`);
  const fish = S.state.fish.balance;
  assert.equal(S.canRepeat(), true);
  assert.ok(S.repeatLastPlan());
  const p = S.planFor(NEXT);
  assert.deepEqual([p.days, p.time, p.window, p.place, p.target], [['2026-11-09', '2026-11-11', '2026-11-13'], '15:30', 'after class', 'at the gym', 3]);
  assert.equal(S.state.fish.balance, fish, 'no Fish for planning');
  assert.equal(Object.keys(S.state.log).length, 3, 'nothing logged');
  assert.equal(S.canRepeat(), false, 'this week is planned now');
  assert.equal(S.repeatLastPlan(), null);
});

test('repeat: not offered when a weekday has passed, or for a first plan; nothing is saved', async () => {
  const S = await freshApp(`${MON}T07:00`);
  assert.equal(S.canRepeat(), false, 'no last plan');
  assert.equal(S.repeatLastPlan(), null);
  plan(S, MWF);
  at(S, '2026-11-11T07:00');   // Wednesday: last week's Monday is gone this week
  assert.equal(S.canRepeat(), false);
  assert.equal(S.repeatLastPlan(), null);
  assert.equal(S.planFor(NEXT), null);
});

test('repeat: on Sunday it starts next week from this week', async () => {
  const S = await freshApp(`${MON}T07:00`);
  plan(S, MWF);
  at(S, '2026-11-08T10:00');
  assert.equal(S.canRepeat(), true);
  assert.ok(S.repeatLastPlan());
  assert.deepEqual(S.planFor(NEXT).days, ['2026-11-09', '2026-11-11', '2026-11-13']);
});

// ---------- The last backup ----------
test('last backup: none at first; then the time it was saved, which travels with the save', async () => {
  const S = await freshApp(`${MON}T07:00`);
  assert.equal(S.lastBackupAt(), '');
  at(S, '2026-11-04T20:15');
  S.markBackupSaved();
  const at1 = S.lastBackupAt();
  assert.equal(new Date(at1).getTime(), new Date('2026-11-04T20:15').getTime());
  const R = await reload(S, '2026-11-05T08:00');
  assert.equal(R.lastBackupAt(), at1, 'kept through a reload');
  const copy = await freshApp('2026-11-06T08:00');
  assert.ok(copy.importData(R.exportData()).ok);
  assert.equal(copy.lastBackupAt(), at1, 'and in a restored backup');
});
