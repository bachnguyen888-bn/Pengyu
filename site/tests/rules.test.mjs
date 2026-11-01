// Every game rule in section 2 of docs/build-spec.md, on an injected clock: planning, logging and Fish,
// moving, the missed-week cover, the week streak, unlocks, and the hard rules.
// Run with: node --test "site/tests/*.test.mjs"
// Weeks used: Monday Oct 5, 12, 19 and 26, 2026, then Monday Nov 2 (Sunday Nov 1 ends October's last week).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshApp, reload, at, plan, logOn, liveWeek, rich } from './helpers.mjs';

const TUE_THU_SAT = ['2026-10-27', '2026-10-29', '2026-10-31'];

// ---------- A first run ----------
test('a first run starts at 0 Fish, with no plan, nothing logged and nothing owned', async () => {
  const S = await freshApp('2026-10-26T08:00');
  assert.deepEqual(S.state.fish, { balance: 0, lifetime: 0 });
  assert.deepEqual(S.state.plans, {});
  assert.deepEqual(S.state.log, {});
  assert.deepEqual(S.state.owned, {});
  assert.deepEqual(S.state.extras, []);
  assert.equal(S.route(), null);
  assert.equal(S.weekStreak(), 0);
  assert.equal(S.logWorkout(), null, 'nothing to log before a plan');
});

// ---------- Planning ----------
test('a plan is 2, 3 or 4 workouts on exactly that many open days, with a time and a place', async () => {
  const S = await freshApp('2026-10-28T08:00');   // Wednesday
  const base = { time: '15:30', window: 'after class', place: 'at the gym' };
  assert.equal(S.createPlan({ ...base, target: 1, days: ['2026-10-29'] }), null, 'one is not a plan');
  assert.equal(S.createPlan({ ...base, target: 5, days: ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'] }), null, 'five is too many');
  assert.equal(S.createPlan({ ...base, target: 3, days: ['2026-10-29', '2026-10-30'] }), null, 'exactly N days');
  assert.equal(S.createPlan({ ...base, target: 2, days: ['2026-10-29', '2026-10-29'] }), null, 'the same day twice is one day');
  assert.equal(S.createPlan({ ...base, target: 2, days: ['2026-10-27', '2026-10-29'] }), null, 'Tuesday has passed');
  assert.equal(S.createPlan({ ...base, target: 2, days: ['2026-10-31', '2026-11-02'] }), null, 'Monday Nov 2 is next week');
  assert.equal(S.createPlan({ ...base, time: '3pm', target: 2, days: ['2026-10-29', '2026-10-30'] }), null, 'a real time');
  assert.equal(S.createPlan({ ...base, place: '  ', target: 2, days: ['2026-10-29', '2026-10-30'] }), null, 'a place');
  for (const n of [2, 3, 4]) {
    const T = await freshApp('2026-10-26T08:00');
    const days = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'].slice(0, n);
    assert.ok(T.createPlan({ ...base, target: n, days }), `${n} workouts`);
    assert.deepEqual(T.planFor().days, days);
  }
  assert.ok(S.createPlan({ ...base, target: 2, days: ['2026-10-30', '2026-10-28'] }), 'today counts as open');
  assert.deepEqual(S.planFor().days, ['2026-10-28', '2026-10-30'], 'kept in date order');
  assert.equal(S.createPlan({ ...base, target: 2, days: ['2026-10-29', '2026-10-31'] }), null, 'one plan a week');
});

test('late in the week (fewer than two days left) the plan is for next week: "Your route starts Monday"', async () => {
  const S = await freshApp('2026-10-31T10:00');   // Saturday: Saturday and Sunday are left
  assert.equal(S.planningWeek(), '2026-10-26');
  at(S, '2026-11-01T10:00');                      // Sunday: one day left
  assert.equal(S.planningWeek(), '2026-11-02');
  assert.equal(S.createPlan({ week: '2026-10-26', target: 2, days: ['2026-11-01', '2026-10-31'], time: '18:00', window: 'in the evening', place: 'at home' }), null);
  assert.ok(plan(S, ['2026-11-03', '2026-11-05']), 'next week, planned on Sunday');
  assert.ok(S.planFor('2026-11-02'));
  assert.equal(S.planFor(), null, 'this week stays unplanned');
  assert.equal(S.shownWeek(), '2026-11-02', 'Today shows next week\'s route');
  const r = S.route(S.shownWeek());
  assert.deepEqual(r.stations.map((s) => s.status), ['upcoming', 'upcoming']);
  assert.equal(r.trainAt, 0, 'the train waits at the depot');
  assert.ok(S.canMove('2026-11-03'), 'next week\'s days can move too');
  assert.ok(S.moveTargets('2026-11-03').includes('2026-11-02'));
  at(S, '2026-11-02T07:00');
  assert.equal(S.thisWeek(), '2026-11-02');
  assert.equal(S.route().plan.days.length, 2, 'on Monday it is simply this week');
  assert.equal(S.logPreview().kind, 'moved', 'Monday is not planned, so it counts for Tuesday');
});

test('next week cannot be planned mid-week', async () => {
  const S = await freshApp('2026-10-28T10:00');
  assert.equal(S.planningWeek(), '2026-10-26');
  assert.equal(S.createPlan({ week: '2026-11-02', target: 2, days: ['2026-11-03', '2026-11-05'], time: '18:00', window: 'in the evening', place: 'at home' }), null);
});

test('the next plan starts from the most recent one', async () => {
  const S = await freshApp('2026-10-12T08:00');
  liveWeek(S, '2026-10-12', ['2026-10-13', '2026-10-15'], []);
  at(S, '2026-10-28T08:00');
  assert.deepEqual(S.lastPlanBefore('2026-10-26').days, ['2026-10-13', '2026-10-15']);
  assert.equal(S.lastPlanBefore('2026-10-12'), null);
});

// ---------- Logging and Fish ----------
test('10 Fish per planned workout, and +25 the moment the last station fills, once', async () => {
  const S = await freshApp('2026-10-26T08:00');
  plan(S, TUE_THU_SAT);
  assert.deepEqual([logOn(S, '2026-10-27').fish, S.state.fish.balance], [10, 10]);
  const second = logOn(S, '2026-10-29');
  assert.deepEqual([second.fish, second.bonus, second.hit], [10, 0, false]);
  const last = logOn(S, '2026-10-31');
  assert.deepEqual([last.fish, last.bonus, last.hit], [10, 25, true]);
  assert.equal(S.state.fish.balance, 55);
  assert.equal(S.state.fish.lifetime, 55);
  const extra = logOn(S, '2026-11-01');
  assert.deepEqual([extra.kind, extra.fish, extra.bonus, extra.comeback], ['extra', 0, 0, 0]);
  assert.equal(S.state.fish.balance, 55, 'the bonus is never paid twice');
  assert.deepEqual(S.state.weekBonusPaid, ['2026-10-26']);
});

test('one workout a day counts: a second log the same day changes nothing', async () => {
  const S = await freshApp('2026-10-26T08:00');
  plan(S, TUE_THU_SAT);
  logOn(S, '2026-10-27', '07:00');
  const before = JSON.stringify(S.state);
  assert.equal(logOn(S, '2026-10-27', '21:00'), null);
  assert.equal(S.logPreview().kind, 'logged');
  assert.equal(JSON.stringify(S.state), before);
  assert.equal(logOn(S, '2026-10-28').kind, 'planned', 'the next day counts again');
});

test('a log on an unplanned day moves the next upcoming station to today and pays as planned', async () => {
  const S = await freshApp('2026-10-26T08:00');
  plan(S, TUE_THU_SAT);
  const res = logOn(S, '2026-10-26');             // Monday
  assert.deepEqual([res.kind, res.fish, res.movedFrom], ['planned', 10, '2026-10-27']);
  assert.deepEqual(S.stations(S.planFor()), ['2026-10-26', '2026-10-29', '2026-10-31']);
  assert.deepEqual(S.route().stations.map((s) => s.status), ['done', 'upcoming', 'upcoming']);
  at(S, '2026-10-27T17:00');
  assert.deepEqual(S.logPreview(), { kind: 'moved', from: '2026-10-29', fish: 10, comeback: '' }, 'Tuesday now counts for Thursday');
});

test('with no stations left a workout is an extra: no Fish, looks-only extras in a fixed order', async () => {
  const S = await freshApp('2026-10-26T08:00');
  plan(S, ['2026-10-26', '2026-10-27']);
  logOn(S, '2026-10-26');
  logOn(S, '2026-10-27');
  const balance = S.state.fish.balance;
  const got = [];
  for (const d of ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']) {
    const r = logOn(S, d);
    assert.deepEqual([r.kind, r.fish, r.comeback], ['extra', 0, 0], d);
    got.push(r.extra.id);
  }
  assert.deepEqual(got, S.EXTRAS.slice(0, 5).map((e) => e.id));
  assert.equal(S.state.fish.balance, balance, 'extras never pay Fish');
  assert.equal(S.look().decal, 'decal-star', 'the first decal goes on the train');
  assert.equal(S.look().hat, 'hat-bobble', 'the first hat goes on Pengu');
  assert.ok(S.EXTRAS.every((e) => ['hat', 'train decal'].includes(e.kind)), 'looks only: hats and decals');
});

test('+15 and a Comeback stamp for the first planned workout after a missed planned day, and only the first', async () => {
  const S = await freshApp('2026-10-26T08:00');
  plan(S, TUE_THU_SAT);
  logOn(S, '2026-10-27');
  at(S, '2026-10-30T09:00');
  assert.equal(S.route().stations[1].status, 'missed', 'Thursday reads as not logged');
  const back = logOn(S, '2026-10-31');
  assert.deepEqual([back.fish, back.comeback], [10, 15]);
  assert.equal(S.state.log['2026-10-31'].comeback, '2026-10-29', 'the stamp sits on Saturday\'s station');
  assert.equal(S.state.fish.balance, 35);
  assert.equal(S.comebackStamps(), 1);
  at(S, '2026-11-02T07:00');
  plan(S, ['2026-11-03', '2026-11-05']);
  assert.equal(logOn(S, '2026-11-03').comeback, 0, 'already came back');
});

test('extras pay 0 and never trigger or use up a comeback', async () => {
  const S = await freshApp('2026-10-26T08:00');
  plan(S, ['2026-10-27', '2026-10-28']);
  const extra = logOn(S, '2026-10-30');           // both stations missed, none left: an extra
  assert.deepEqual([extra.kind, extra.fish, extra.comeback], ['extra', 0, 0]);
  assert.equal(S.state.log['2026-10-30'].comeback, undefined);
  at(S, '2026-11-02T07:00');
  plan(S, ['2026-11-03', '2026-11-05']);
  const planned = logOn(S, '2026-11-03');
  assert.deepEqual([planned.fish, planned.comeback], [10, 15], 'the first planned workout still earns it');
});

// ---------- Moving ----------
test('moving costs nothing: to today or a later free day of the same week, never a past or missed day', async () => {
  const S = await freshApp('2026-10-26T08:00');
  plan(S, TUE_THU_SAT);
  at(S, '2026-10-28T10:00');                      // Wednesday: Tuesday was not logged
  assert.equal(S.canMove('2026-10-27'), false, 'a missed day stays where it was');
  assert.deepEqual(S.moveTargets('2026-10-27'), []);
  assert.equal(S.moveStation('2026-10-27', '2026-10-28'), null);
  assert.deepEqual(S.moveTargets('2026-10-29'), ['2026-10-28', '2026-10-30', '2026-11-01'], 'today, Friday or Sunday');
  const fish = S.state.fish.balance;
  assert.ok(S.moveStation('2026-10-29', '2026-10-30'));
  assert.deepEqual(S.stations(S.planFor()), ['2026-10-27', '2026-10-30', '2026-10-31']);
  assert.equal(S.state.fish.balance, fish, 'no penalty');
  assert.equal(S.moveStation('2026-10-30', '2026-10-27'), null, 'not to a past day');
  assert.equal(S.moveStation('2026-10-30', '2026-10-31'), null, 'not onto another station');
  assert.equal(S.moveStation('2026-10-30', '2026-11-02'), null, 'not into next week');
  logOn(S, '2026-10-31');
  assert.equal(S.canMove('2026-10-31'), false, 'a done station stays');
  at(S, '2026-10-31T20:00');
  assert.equal(S.moveTargets('2026-10-30').length, 0, 'Friday has passed: it cannot move');
  assert.equal(S.state.events.filter((e) => e.type === 'plan_moved').length, 1);
});

test('a station cannot move onto a day that already has a workout', async () => {
  // Saved data with a workout on Thursday, a free day, while Saturday's station is still open.
  const S = await freshApp('2026-10-29T20:00', {
    v: 1, fish: { balance: 10, lifetime: 10 },
    plans: { '2026-10-26': { target: 2, days: ['2026-10-27', '2026-10-31'], time: '15:30', window: 'after class', place: 'at the gym', moves: [] } },
    log: { '2026-10-27': { at: '2026-10-27T17:00:00.000Z', kind: 'planned' }, '2026-10-29': { at: '2026-10-29T17:00:00.000Z', kind: 'extra' } },
  });
  assert.ok(S.canMove('2026-10-31'));
  assert.deepEqual(S.moveTargets('2026-10-31'), ['2026-10-30', '2026-11-01'], 'Thursday already has a workout');
  assert.equal(S.moveStation('2026-10-31', '2026-10-29'), null);
});

// ---------- The week streak and the missed-week cover ----------
test('week streak only: consecutive weeks where the plan was hit; this week adds once it is hit', async () => {
  const S = await freshApp('2026-10-05T07:00');
  liveWeek(S, '2026-10-05', ['2026-10-06', '2026-10-08']);
  liveWeek(S, '2026-10-12', ['2026-10-13', '2026-10-15']);
  at(S, '2026-10-19T07:00');
  assert.equal(S.weekStreak(), 2);
  plan(S, ['2026-10-20', '2026-10-22']);
  logOn(S, '2026-10-20');
  assert.equal(S.weekStreak(), 2, 'half a week adds nothing yet');
  logOn(S, '2026-10-22');
  assert.equal(S.weekStreak(), 3);
  assert.equal(Object.keys(S.state).some((k) => /daily|dayStreak/i.test(k)), false, 'no daily streak');
});

test('the free cover: one missed week per calendar month keeps the streak alive without adding to it', async () => {
  const S = await freshApp('2026-10-05T07:00');
  liveWeek(S, '2026-10-05', ['2026-10-06', '2026-10-08']);
  liveWeek(S, '2026-10-12', ['2026-10-13', '2026-10-15']);
  liveWeek(S, '2026-10-19', ['2026-10-20', '2026-10-22'], []);   // missed
  liveWeek(S, '2026-10-26', ['2026-10-27', '2026-10-29']);
  at(S, '2026-11-02T07:00');
  const info = S.streakInfo();
  assert.equal(info.streak, 3, 'two hit, one covered (adds nothing), one hit');
  assert.deepEqual(info.covered, ['2026-10-19']);
  assert.equal(info.coverReady, true, 'November has its own cover');
  const fish = S.state.fish.balance;
  assert.deepEqual(S.announceCovers(), ['2026-10-19'], 'automatic, and said once');
  assert.deepEqual(S.announceCovers(), []);
  assert.equal(S.state.events.filter((e) => e.type === 'streak_cover_used').length, 1);
  assert.equal(S.state.fish.balance, fish, 'covers cost nothing');
});

test('a second missed week in the same month ends the streak', async () => {
  const S = await freshApp('2026-10-05T07:00');
  liveWeek(S, '2026-10-05', ['2026-10-06', '2026-10-08']);
  liveWeek(S, '2026-10-12', ['2026-10-13', '2026-10-15'], []);
  liveWeek(S, '2026-10-19', ['2026-10-20', '2026-10-22'], []);
  at(S, '2026-10-26T07:00');
  const info = S.streakInfo();
  assert.equal(info.streak, 0);
  assert.deepEqual(info.covered, ['2026-10-12']);
  assert.equal(info.coverReady, false, 'October\'s cover is used');
});

test('the cover month is counted by the week\'s Monday, and a streak of 0 has nothing to cover', async () => {
  const S = await freshApp('2026-09-21T07:00');
  liveWeek(S, '2026-09-21', ['2026-09-22', '2026-09-24']);
  liveWeek(S, '2026-09-28', ['2026-09-29', '2026-10-01'], []);   // Monday in September
  liveWeek(S, '2026-10-05', ['2026-10-06', '2026-10-08'], []);   // October's cover
  liveWeek(S, '2026-10-12', ['2026-10-13', '2026-10-15']);
  at(S, '2026-10-19T07:00');
  assert.deepEqual(S.streakInfo().covered, ['2026-09-28', '2026-10-05']);
  assert.equal(S.weekStreak(), 2);
  const T = await freshApp('2026-10-05T07:00');
  liveWeek(T, '2026-10-05', ['2026-10-06', '2026-10-08'], []);
  at(T, '2026-10-12T07:00');
  assert.deepEqual(T.streakInfo().covered, [], 'no running streak, so no cover is spent');
});

test('covers and repairs are never sold', async () => {
  const S = await freshApp('2026-10-26T08:00', rich(1000));
  assert.equal(S.buy('cover'), null);
  assert.equal(S.buy('freeze'), null);
  assert.equal(S.unlockById('cover'), null);
  assert.deepEqual(Object.keys(S).filter((k) => /repair|freeze|buyCover|sellCover/i.test(k)), []);
  assert.equal(S.state.fish.balance, 1000);
});

// ---------- Unlocks ----------
test('gear unlocks in a fixed order at fixed prices: scarf 40, cap 90, backpack 150, conductor outfit 240', async () => {
  assert.deepEqual((await freshApp('2026-10-26T08:00')).GEAR.map((g) => [g.id, g.price]), [['scarf', 40], ['cap', 90], ['backpack', 150], ['conductor', 240]]);
  const S = await freshApp('2026-10-26T08:00', rich(520));
  assert.equal(S.unlockStatus('cap').state, 'locked');
  assert.equal(S.unlockStatus('cap').after.id, 'scarf');
  assert.equal(S.buy('cap'), null, 'no skipping ahead');
  assert.equal(S.buy('conductor'), null);
  for (const id of ['scarf', 'cap', 'backpack', 'conductor']) assert.ok(S.buy(id), id);
  assert.equal(S.state.fish.balance, 0);
  assert.equal(S.nextGear(), null);
});

test('train upgrades in any order at fixed prices: headlamp 50, colors 80, extra car 130', async () => {
  assert.deepEqual((await freshApp('2026-10-26T08:00')).TRAIN.map((t) => [t.id, t.price]), [['headlamp', 50], ['paint', 80], ['car', 130]]);
  const S = await freshApp('2026-10-26T08:00', rich(260));
  for (const id of ['car', 'headlamp', 'paint']) assert.ok(S.buy(id), id);
  assert.equal(S.state.fish.balance, 0);
  assert.deepEqual([S.look().car, S.look().headlamp], [true, true]);
  assert.ok(S.setPaint('pink'));
  assert.equal(S.look().paint, 'pink');
});

test('an unlock needs a balance of at least its price; Fish never go negative', async () => {
  const S = await freshApp('2026-10-26T08:00', rich(39));
  assert.deepEqual(S.unlockStatus('scarf'), { state: 'saving', short: 1 });
  assert.equal(S.buy('scarf'), null);
  assert.equal(S.state.fish.balance, 39);
  const T = await freshApp('2026-10-26T08:00', rich(40));
  assert.equal(T.unlockStatus('scarf').state, 'ready');
  assert.ok(T.buy('scarf'));
  assert.equal(T.state.fish.balance, 0);
  assert.equal(T.buy('headlamp'), null);
  assert.ok(T.state.fish.balance >= 0);
});

test('upgrades are permanent: nothing decays, rusts or rolls back, across weeks and reloads', async () => {
  const S = await freshApp('2026-10-26T08:00', rich(130));
  S.buy('scarf');
  S.buy('cap');
  const R = await reload(S, '2027-03-01T08:00');   // months later, nothing logged since
  assert.ok(R.owns('scarf') && R.owns('cap'));
  assert.equal(R.state.fish.balance, 0);
  assert.equal(R.look().scarf, true);
  assert.equal(R.look().hat, 'cap');
});

// ---------- Hard rules ----------
test('Fish is the only currency, and no body or activity numbers are kept', async () => {
  const S = await freshApp('2026-10-26T08:00');
  plan(S, TUE_THU_SAT, { minutes: 45, calories: 300 });
  at(S, '2026-10-27T17:00');
  S.logWorkout({ minutes: 30, steps: 4000, distance: 5 });
  const text = JSON.stringify(S.state).toLowerCase();
  for (const word of ['shard', 'xp', 'power', 'stamina', 'agility', 'star"', 'calorie', 'weight', 'steps', 'minutes', 'distance', 'pace', 'rank', 'leaderboard']) {
    assert.equal(text.includes(`"${word}`), false, word);
  }
  assert.deepEqual(Object.keys(S.state.log['2026-10-27']).sort(), ['at', 'kind']);
  assert.deepEqual(Object.keys(S.planFor()).sort(), ['createdAt', 'days', 'moves', 'place', 'target', 'time', 'window']);
});

test('no random rewards: the rules never use Math.random', async () => {
  const S = await freshApp('2026-10-26T08:00', rich(600));
  const real = Math.random;
  Math.random = () => { throw new Error('Math.random was called'); };
  try {
    plan(S, ['2026-10-26', '2026-10-27']);
    for (const d of ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']) logOn(S, d);
    for (const id of ['scarf', 'cap', 'headlamp', 'paint', 'car']) S.buy(id);
    S.streakInfo();
    S.look();
  } finally {
    Math.random = real;
  }
  assert.deepEqual(S.state.extras.map((x) => x.id), ['decal-star', 'hat-bobble']);
});
