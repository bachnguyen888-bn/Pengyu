// Character upgrades (M2): fixed prices, the gear order, unlocks needing their full price, upgrades kept
// for good across reloads and restores, Fish never below zero, the wear rules, and a true first run
// after a reset. Run with: node --test "site/tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshApp, reload, at, plan, logOn, rich } from './helpers.mjs';

test('fixed prices: scarf 40, cap 90, backpack 150, conductor outfit 240; headlamp 50, colors 80, extra car 130', async () => {
  const S = await freshApp('2026-10-26T08:00');
  assert.deepEqual(S.GEAR.map((g) => [g.id, g.price]), [['scarf', 40], ['cap', 90], ['backpack', 150], ['conductor', 240]]);
  assert.deepEqual(S.TRAIN.map((t) => [t.id, t.name, t.price]), [['headlamp', 'Headlamp', 50], ['paint', 'Colors', 80], ['car', 'Extra car', 130]]);
  // Prices stay the same however much or little Fish there is, and after buying.
  const T = await freshApp('2026-10-26T08:00', rich(1000));
  T.buy('scarf');
  T.buy('headlamp');
  assert.deepEqual([...T.GEAR, ...T.TRAIN].map((u) => u.price), [40, 90, 150, 240, 50, 80, 130]);
  assert.deepEqual(T.state.owned.scarf.price, 40);
  assert.equal(T.state.fish.balance, 1000 - 40 - 50);
});

test('the gear order is enforced: no skipping, whatever the balance', async () => {
  const S = await freshApp('2026-10-26T08:00', rich(5000));
  for (const id of ['cap', 'backpack', 'conductor']) assert.equal(S.buy(id), null, `${id} before the scarf`);
  assert.ok(S.buy('scarf'));
  assert.equal(S.buy('backpack'), null, 'backpack before the cap');
  assert.equal(S.unlockStatus('backpack').state, 'locked');
  assert.equal(S.unlockStatus('backpack').after.id, 'cap');
  assert.ok(S.buy('cap'));
  assert.ok(S.buy('backpack'));
  assert.ok(S.buy('conductor'));
  assert.equal(S.buy('scarf'), null, 'nothing is bought twice');
  assert.equal(S.state.fish.balance, 5000 - 520);
});

test('an unlock needs a balance at least equal to its price', async () => {
  for (const [id, price] of [['scarf', 40], ['headlamp', 50], ['paint', 80], ['car', 130]]) {
    const short = await freshApp('2026-10-26T08:00', rich(price - 1));
    assert.deepEqual(short.unlockStatus(id), { state: 'saving', short: 1 }, id);
    assert.equal(short.buy(id), null, `${id} at ${price - 1}`);
    const exact = await freshApp('2026-10-26T08:00', rich(price));
    assert.equal(exact.unlockStatus(id).state, 'ready', id);
    assert.ok(exact.buy(id), `${id} at ${price}`);
    assert.equal(exact.state.fish.balance, 0);
  }
});

test('Fish never go negative, whatever is tapped', async () => {
  const S = await freshApp('2026-10-26T08:00', rich(95));
  const ids = ['car', 'scarf', 'paint', 'cap', 'headlamp', 'backpack', 'conductor', 'paint', 'car', 'scarf'];
  for (let round = 0; round < 3; round += 1) {
    for (const id of ids) {
      S.buy(id);
      assert.ok(S.state.fish.balance >= 0, `after ${id}`);
    }
  }
  assert.ok(S.owns('scarf') && S.owns('headlamp'));
  assert.equal(S.state.fish.balance, 95 - 40 - 50);
  assert.equal(S.importData({ v: 1, plans: {}, log: {}, fish: { balance: -10, lifetime: 0 } }).ok, false, 'a backup cannot bring negative Fish');
});

test('upgrades stay for good across reloads and restores, and wearing never changes ownership', async () => {
  const S = await freshApp('2026-10-26T08:00', rich(400));
  for (const id of ['scarf', 'cap', 'headlamp', 'paint']) S.buy(id);
  S.setPaint('sunny');
  S.toggleWear('scarf');                                     // take the scarf off: still owned
  assert.ok(S.owns('scarf'));
  assert.equal(S.look().scarf, false);
  const R = await reload(S, '2027-02-01T08:00');             // months later, nothing logged since
  for (const id of ['scarf', 'cap', 'headlamp', 'paint']) assert.ok(R.owns(id), `${id} after a reload`);
  assert.equal(R.look().paint, 'sunny');
  assert.equal(R.look().scarf, false, 'what shows is kept too');
  const file = R.exportData();
  const T = await freshApp('2027-02-01T09:00');
  assert.equal(T.importData(file).ok, true);
  for (const id of ['scarf', 'cap', 'headlamp', 'paint']) assert.ok(T.owns(id), `${id} after a restore`);
  assert.deepEqual(T.look(), R.look());
  assert.equal(T.state.fish.balance, R.state.fish.balance);
});

test('wear rules: one hat at a time, and the conductor outfit replaces the hat', async () => {
  const S = await freshApp('2026-10-26T08:00', rich(1000));
  for (const id of ['scarf', 'cap', 'backpack', 'conductor']) S.buy(id);
  assert.equal(S.look().hat, 'conductor', 'the outfit brings its own cap');
  assert.equal(S.isWorn('cap'), false);
  S.toggleWear('cap');                                       // the cap goes on, so the outfit comes off
  assert.deepEqual([S.look().hat, S.look().outfit], ['cap', false]);
  S.toggleWear('conductor');
  assert.deepEqual([S.look().hat, S.look().outfit], ['conductor', true]);
  S.toggleWear('conductor');                                 // outfit off: the cap comes back
  assert.equal(S.look().hat, 'cap');
  assert.equal(S.toggleWear('hat-bobble'), null, 'an extra not earned yet cannot be worn');
  assert.equal(S.setPaint('pink'), null, 'paint needs Colors first');
  assert.equal(S.look().paint, 'navy');
});

test('extra hats and decals: earned in order, the first of each goes on, one hat at a time', async () => {
  const S = await freshApp('2026-10-26T08:00');
  plan(S, ['2026-10-26', '2026-10-27']);
  for (const d of ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']) logOn(S, d);
  assert.deepEqual(S.state.extras.map((x) => x.id), ['decal-star', 'hat-bobble', 'decal-wave']);
  assert.deepEqual([S.look().hat, S.look().decal], ['hat-bobble', 'decal-star']);
  S.toggleWear('decal-wave');
  assert.equal(S.look().decal, 'decal-wave', 'one decal at a time');
  logOn(S, '2026-10-31');                                    // the sun hat: earned, not swapped in
  assert.equal(S.look().hat, 'hat-bobble');
  S.toggleWear('hat-sun');
  assert.equal(S.look().hat, 'hat-sun');
  assert.equal(S.isWorn('hat-bobble'), false);
});

test('a fresh start owns the scarf within one hit week of 2, 3 or 4 workouts', async () => {
  for (const n of [2, 3, 4]) {
    const S = await freshApp('2026-10-26T07:00');
    const days = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'].slice(0, n);
    assert.ok(plan(S, days));
    for (const d of days) logOn(S, d);
    assert.equal(S.state.fish.balance, n * 10 + 25, `${n} workouts and the week bonus`);
    assert.equal(S.unlockStatus('scarf').state, 'ready', `${n} workouts`);
    assert.ok(S.buy('scarf'));
    assert.equal(S.look().scarf, true);
  }
});

test('reset returns a true first run, and forgets the old preview\'s leftovers too', async () => {
  const S = await freshApp('2026-10-26T07:00', rich(300));
  globalThis.localStorage.setItem('pengu.preview.v1', '{"stars":12}');
  globalThis.localStorage.setItem('pengu.theme', 'dark');
  plan(S, ['2026-10-27', '2026-10-29']);
  logOn(S, '2026-10-27');
  S.buy('scarf');
  S.markTipSeen();
  S.markBackupSaved();
  assert.equal(S.reset(), true);
  for (const key of ['pengyu.v1', 'pengu.preview.v1', 'pengu.theme']) assert.equal(globalThis.localStorage.getItem(key), null, key);
  const { createdAt, ...rest } = S.state;
  assert.deepEqual(rest, {
    v: 1, plans: {}, log: {}, fish: { balance: 0, lifetime: 0 }, weekBonusPaid: [], extras: [], coversAnnounced: [],
    owned: {}, wear: { hat: null, scarf: false, backpack: false, outfit: false, decal: null, paint: 'navy' }, events: [], tipSeen: false,
  });
  assert.equal(S.route(), null);
  assert.equal(S.logPreview().kind, 'no-plan');
  assert.equal(S.weekStreak(), 0);
  const R = await reload(S, '2026-10-26T09:00');            // nothing was saved since, so it starts fresh too
  assert.deepEqual([R.state.fish.balance, Object.keys(R.state.plans).length, Object.keys(R.state.owned).length], [0, 0, 0]);
  at(S, '2026-10-27T08:00');
  assert.ok(plan(S, ['2026-10-28', '2026-10-29']), 'a new plan works straight away');
});
