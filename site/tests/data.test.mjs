// Backups: export and import round-trip, bad files are turned away with clear words and change nothing,
// retired paints migrate, and the new events are recorded.
// Run with: node --test "site/tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshApp, at, plan, logOn, liveWeek, rich } from './helpers.mjs';

// A player with history: two weeks, a comeback, an extra, gear and a repaint.
async function player() {
  const S = await freshApp('2026-10-19T07:00', rich(0));
  liveWeek(S, '2026-10-19', ['2026-10-20', '2026-10-22'], ['2026-10-20']);   // Thursday not logged
  at(S, '2026-10-26T07:00');
  plan(S, ['2026-10-27', '2026-10-29', '2026-10-31']);
  logOn(S, '2026-10-27');                                                     // a comeback
  logOn(S, '2026-10-29');
  logOn(S, '2026-10-31');                                                     // the full week
  logOn(S, '2026-11-01');                                                     // an extra
  S.buy('scarf');
  return S;
}
const strip = (state) => { const { events, ...rest } = JSON.parse(JSON.stringify(state)); return rest; };

test('export then import gives back the same state', async () => {
  const S = await player();
  const file = S.exportData();
  const parsed = JSON.parse(file);
  assert.equal(parsed.v, 1);
  assert.equal(parsed.storageKey, 'pengyu.v1');
  const T = await freshApp('2026-11-01T12:00');
  const res = T.importData(file);
  assert.equal(res.ok, true);
  assert.deepEqual(res.summary, { weeks: 2, fish: S.state.fish.balance });
  assert.deepEqual(strip(T.state), strip(S.state));
  assert.equal(T.state.exportedAt, undefined, 'the file\'s own labels are not kept as data');
  assert.deepEqual(T.state.events.slice(0, -1), JSON.parse(JSON.stringify(S.state.events)), 'every event comes across');
  assert.equal(T.state.events.at(-1).type, 'backup_restored');
});

test('a restored backup shows the same Today: route, count, Begin, streak and Fish', async () => {
  const S = await player();
  at(S, '2026-11-01T18:00');
  const T = await freshApp('2026-11-01T18:00');
  T.importData(S.exportData());
  for (const [name, read] of [
    ['route', (A) => A.route()],
    ['preview', (A) => A.logPreview()],
    ['streak', (A) => A.streakInfo()],
    ['fish', (A) => A.state.fish],
    ['look', (A) => A.look()],
    ['next gear', (A) => A.nextGear()],
  ]) assert.deepEqual(read(T), read(S), name);
});

test('checkBackup reads a file without changing anything, and counts weeks and Fish', async () => {
  const S = await player();
  const file = S.exportData();
  const T = await freshApp('2026-11-01T12:00');
  const before = JSON.stringify(T.state);
  const c = T.checkBackup(file);
  assert.equal(c.ok, true);
  assert.deepEqual(c.summary, { weeks: 2, fish: S.state.fish.balance });
  assert.equal(JSON.stringify(T.state), before);
});

test('import turns bad files away with clear words, and changes nothing', async () => {
  const S = await player();
  const good = JSON.parse(S.exportData());
  const E = S.BACKUP_ERRORS;
  const bad = (patch) => JSON.stringify({ ...good, ...patch });
  const cases = [
    ['not JSON', 'Pengu says hi', E.notBackup],
    ['an empty file', '', E.notBackup],
    ['a list', '[1, 2, 3]', E.notBackup],
    ['another app\'s JSON', '{"name":"something else"}', E.notBackup],
    ['a newer version', bad({ v: 2 }), E.version],
    ['no plans', bad({ plans: undefined }), E.damaged],
    ['a plan with five days', bad({ plans: { '2026-10-26': { ...good.plans['2026-10-26'], target: 5, days: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'] } } }), E.damaged],
    ['a plan on a Tuesday key', bad({ plans: { '2026-10-27': good.plans['2026-10-26'] } }), E.damaged],
    ['a day outside its week', bad({ plans: { '2026-10-26': { ...good.plans['2026-10-26'], days: ['2026-10-27', '2026-10-29', '2026-11-03'] } } }), E.damaged],
    ['a date that does not exist', bad({ log: { '2026-02-30': { at: 'x', kind: 'planned' } } }), E.damaged],
    ['an unknown workout kind', bad({ log: { '2026-10-27': { at: 'x', kind: 'bonus' } } }), E.damaged],
    ['negative Fish', bad({ fish: { balance: -5, lifetime: 10 } }), E.damaged],
    ['more Fish than ever earned', bad({ fish: { balance: 500, lifetime: 100 } }), E.damaged],
    ['fractional Fish', bad({ fish: { balance: 1.5, lifetime: 10 } }), E.damaged],
    ['an unknown unlock', bad({ owned: { rocket: { at: 'x', price: 1 } } }), E.damaged],
    ['an unknown extra', bad({ extras: [{ id: 'hat-crown', earnedOn: '2026-11-01' }] }), E.damaged],
    ['a bad time', bad({ plans: { '2026-10-26': { ...good.plans['2026-10-26'], time: '25:00' } } }), E.damaged],
  ];
  const T = await freshApp('2026-11-01T12:00');
  const before = JSON.stringify(T.state);
  for (const [name, text, error] of cases) {
    const res = T.importData(text);
    assert.equal(res.ok, false, name);
    assert.equal(res.error, error, name);
    assert.equal(JSON.stringify(T.state), before, `${name}: nothing changed`);
  }
  for (const e of Object.values(E)) assert.ok(e.split(' ').length < 15, `short: ${e}`);
});

test('a backup can be a parsed object too, and is copied, not shared', async () => {
  const S = await player();
  const obj = JSON.parse(S.exportData());
  const T = await freshApp('2026-11-01T12:00');
  assert.equal(T.importData(obj).ok, true);
  obj.fish.balance = 9999;
  assert.notEqual(T.state.fish.balance, 9999);
});

test('retired paints (mint, purple) come back as navy from a backup', async () => {
  for (const old of ['mint', 'purple']) {
    const T = await freshApp('2026-11-01T12:00');
    const file = { v: 1, plans: {}, log: {}, fish: { balance: 0, lifetime: 80 }, owned: { paint: { at: 'x', price: 80 } }, wear: { paint: old } };
    assert.equal(T.importData(JSON.stringify(file)).ok, true, old);
    assert.equal(T.state.wear.paint, 'navy', old);
    assert.equal(T.look().paint, 'navy', old);
  }
});

test('an import keeps only what Pengyu knows, with every list a list', async () => {
  const T = await freshApp('2026-11-01T12:00');
  const res = T.importData(JSON.stringify({ v: 1, plans: {}, log: {}, fish: { balance: 0, lifetime: 0 }, hack: '<script>', storageKey: 'x' }));
  assert.equal(res.ok, true);
  assert.equal('hack' in T.state, false);
  for (const k of ['weekBonusPaid', 'extras', 'coversAnnounced', 'events']) assert.ok(Array.isArray(T.state[k]), k);
});

test('events: plan_moved, backup_saved, backup_restored, and app_opened at most once a day', async () => {
  const S = await freshApp('2026-10-26T08:00');
  plan(S, ['2026-10-27', '2026-10-29']);
  S.moveStation('2026-10-27', '2026-10-28');
  S.markBackupSaved();
  assert.equal(S.noteAppOpened(), true);
  at(S, '2026-10-26T21:00');
  assert.equal(S.noteAppOpened(), false, 'once a day');
  at(S, '2026-10-27T07:00');
  assert.equal(S.noteAppOpened(), true, 'a new day');
  const T = await freshApp('2026-10-27T08:00');
  T.importData(S.exportData());
  const types = T.state.events.map((e) => e.type);
  for (const t of ['plan_created', 'plan_moved', 'backup_saved', 'app_opened', 'backup_restored']) assert.ok(types.includes(t), t);
  assert.equal(types.filter((t) => t === 'app_opened').length, 2);
  assert.deepEqual(T.state.events.find((e) => e.type === 'plan_moved'), { type: 'plan_moved', at: T.state.events.find((e) => e.type === 'plan_moved').at, week: '2026-10-26', from: '2026-10-27', to: '2026-10-28' });
});

test('saving a backup or noting an open is saved straight away', async () => {
  const S = await freshApp('2026-10-26T08:00');
  S.markBackupSaved();
  const saved = JSON.parse(globalThis.localStorage.getItem('pengyu.v1'));
  assert.equal(saved.events.at(-1).type, 'backup_saved');
});
