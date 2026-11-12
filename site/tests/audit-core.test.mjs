// Master-audit regressions: reject backups that would crash the interface, keep calendar text inside
// its property, and avoid copying private schedule details into diagnostic action records.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshApp, at, plan, logOn } from './helpers.mjs';
import { buildIcs } from '../js/pengyu/ics.js';

test('restore rejects malformed appearance and runtime metadata without replacing a save', async () => {
  const S = await freshApp('2026-11-09T08:00');
  plan(S, ['2026-11-09', '2026-11-11']);
  logOn(S, '2026-11-09');
  const good = JSON.parse(S.exportData());
  const before = JSON.stringify(S.state);
  const cases = [
    { wear: { hat: 7 } }, { wear: { hat: {} } }, { wear: { hat: 'rocket' } },
    { wear: { decal: [] } }, { wear: { decal: 'hat-bobble' } },
    { wear: { scarf: 'true' } }, { wear: { outfit: {} } }, { wear: { paint: [] } },
    { createdAt: 'not a date' }, { events: [{ type: 'backup_saved', at: 7 }] },
    { fish: { balance: Number.MAX_SAFE_INTEGER + 1, lifetime: Number.MAX_SAFE_INTEGER + 1 } },
    { plans: { '2026-11-09': { ...good.plans['2026-11-09'], icsSeq: '1' } } },
    { plans: { '2026-11-09': { ...good.plans['2026-11-09'], moves: [{ from: {}, to: '2026-11-12', at: good.createdAt }] } } },
  ];
  for (const patch of cases) {
    const result = S.importData({ ...good, ...patch });
    assert.equal(result.ok, false, JSON.stringify(patch));
    assert.equal(result.error, S.BACKUP_ERRORS.damaged);
    assert.equal(JSON.stringify(S.state), before, 'failed import changes nothing');
  }
});

test('legacy saves retain real progress while invalid local hat data cannot crash drawings', async () => {
  const S = await freshApp('2026-11-09T08:00', {
    v: 1, plans: {}, log: {}, fish: { balance: 10, lifetime: 50 },
    owned: { scarf: { at: '2026-11-09T07:00:00Z', price: 40 } },
    wear: { hat: 7, scarf: true },
  });
  assert.equal(S.look().hat, null);
  assert.equal(S.state.wear.hat, null, 'old malformed appearance is repaired without discarding progress');
  assert.equal(S.look().scarf, true);
  assert.equal(S.state.fish.balance, 10);
  assert.equal(S.canWear(7), false);
  assert.equal(S.isWorn({}), false);
  const T = await freshApp('2026-11-09T08:00');
  const minimal = { v: 1, plans: {}, log: {}, fish: { balance: 10, lifetime: 50 }, wear: { paint: 'purple' } };
  assert.equal(T.importData(minimal).ok, true, 'missing optional legacy fields stay supported');
  assert.equal(T.state.wear.paint, 'navy');
  assert.equal(T.state.fish.balance, 10);
});

test('calendar text escapes CR, LF and CRLF so restored text cannot add calendar properties', () => {
  for (const newline of ['\r', '\n', '\r\n']) {
    const source = {
      target: 2, days: ['2026-11-09', '2026-11-11'], time: '18:00',
      window: `evening${newline}ATTENDEE:injected`, place: `at home${newline}BEGIN:VEVENT`, moves: [],
    };
    const file = buildIcs('2026-11-09', source);
    const unfolded = file.replace(/\r\n /g, '');
    assert.equal((unfolded.match(/^BEGIN:VEVENT$/gm) || []).length, 2);
    assert.doesNotMatch(unfolded, /(?:^|[\r\n])ATTENDEE:/);
    assert.ok(unfolded.includes('evening\\nATTENDEE:injected'));
    assert.ok(unfolded.includes('at home\\nBEGIN:VEVENT'));
    assert.equal(file.replace(/\r\n/g, '').includes('\r'), false, 'no bare carriage return survives');
    for (const line of file.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
  }
});

test('new action records omit workout schedule details while the actual plan and log retain them', async () => {
  const S = await freshApp('2026-11-09T08:00');
  plan(S, ['2026-11-09', '2026-11-11', '2026-11-13'], { place: 'at the private pool' });
  S.moveStation('2026-11-11', '2026-11-12');
  logOn(S, '2026-11-09');
  logOn(S, '2026-11-13');
  for (const event of S.state.events) {
    assert.deepEqual(Object.keys(event).sort(), event.type === 'workout_logged' || event.type === 'comeback_earned'
      ? ['at', 'fish', 'type'] : ['at', 'type']);
  }
  assert.equal(S.planFor().place, 'at the private pool');
  assert.deepEqual(S.planFor().moves.map(({ from, to }) => [from, to]), [['2026-11-11', '2026-11-12']]);
  assert.equal(S.state.log['2026-11-13'].comeback, '2026-11-12');
  assert.equal(S.state.fish.balance, 35, '10, then 10 + 15 comeback; no full-week bonus');
});

test('restoring an older action list preserves its existing history', async () => {
  const S = await freshApp('2026-11-09T08:00');
  const event = { type: 'plan_created', at: '2026-11-09T08:00:00Z', days: ['2026-11-09'], place: 'at home' };
  const input = { v: 1, plans: {}, log: {}, fish: { balance: 0, lifetime: 0 }, events: [event] };
  assert.equal(S.importData(input).ok, true);
  assert.deepEqual(S.state.events[0], event, 'no retroactive deletion of the player’s backup history');
});
