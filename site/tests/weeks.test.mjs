// Week math in the phone's local time, across the clock change on Sunday Nov 1, 2026 (US time zones
// fall back an hour at 2 AM), plus the calendar file's floating times.
// Run with: node --test "site/tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshApp, at, plan, logOn } from './helpers.mjs';
import { buildIcs } from '../js/pengyu/ics.js';

process.env.TZ = 'America/Los_Angeles';
const WEEK = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];

test('the clock goes back on Sunday Nov 1, 2026 in this time zone', () => {
  assert.equal(new Date('2026-10-31T12:00').getTimezoneOffset(), 420, 'Saturday is on daylight time');
  assert.equal(new Date('2026-11-01T12:00').getTimezoneOffset(), 480, 'Sunday afternoon is on standard time');
});

test('weeks still run Monday to Sunday across the clock change', async () => {
  const S = await freshApp('2026-10-26T08:00');
  for (const d of WEEK) assert.equal(S.weekStart(d), '2026-10-26', d);
  assert.equal(S.weekStart('2026-11-02'), '2026-11-02');
  assert.deepEqual(S.weekDays('2026-10-26'), WEEK, 'seven days, none skipped or doubled');
  assert.deepEqual(S.weekDays('2026-11-02').slice(0, 2), ['2026-11-02', '2026-11-03']);
  assert.equal(S.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(S.addDays('2026-11-01', 1), '2026-11-02');
  assert.equal(S.addDays('2026-11-01', -7), '2026-10-25');
  assert.equal(S.addDays('2026-10-26', 7), '2026-11-02');
});

test('Sunday is still this week at any hour, including the repeated 1 AM hour', async () => {
  const S = await freshApp('2026-11-01T00:30');
  for (const hm of ['00:30', '01:30', '02:30', '12:00', '23:59']) {
    at(S, `2026-11-01T${hm}`);
    assert.equal(S.today(), '2026-11-01', hm);
    assert.equal(S.thisWeek(), '2026-10-26', hm);
  }
  at(S, '2026-11-02T00:00');
  assert.equal(S.thisWeek(), '2026-11-02', 'midnight starts the new week');
});

test('a station on Sunday Nov 1 can be logged late that night and fills the week', async () => {
  const S = await freshApp('2026-10-26T08:00');
  assert.ok(plan(S, ['2026-10-28', '2026-11-01']));
  logOn(S, '2026-10-28');
  const res = logOn(S, '2026-11-01', '23:30');
  assert.equal(res.kind, 'planned');
  assert.equal(res.hit, true);
  assert.equal(res.bonus, 25);
  at(S, '2026-11-02T00:05');
  assert.equal(S.planFor(), null, 'Monday shows the new week');
  assert.equal(S.weekStreak(), 1);
});

test('the spring change (Sunday March 8, 2026) keeps the week too', async () => {
  const S = await freshApp('2026-03-02T08:00');
  assert.equal(S.weekStart('2026-03-08'), '2026-03-02');
  assert.equal(S.addDays('2026-03-07', 1), '2026-03-08');
  assert.equal(S.addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(S.weekDays('2026-03-02').length, 7);
});

test('other time zones agree on the same weeks', async () => {
  const S = await freshApp('2026-10-26T08:00');
  for (const zone of ['America/New_York', 'Europe/London', 'Asia/Kolkata', 'Australia/Sydney', 'Pacific/Auckland', 'America/Los_Angeles']) {
    process.env.TZ = zone;
    for (const d of WEEK) assert.equal(S.weekStart(d), '2026-10-26', `${zone} ${d}`);
    assert.equal(S.weekStart('2026-10-25'), '2026-10-19', `${zone}: Europe's change, Sunday Oct 25`);
    assert.deepEqual(S.weekDays('2026-10-26'), WEEK, zone);
  }
  process.env.TZ = 'America/Los_Angeles';
});

test('the calendar file: floating local times, a 60-minute event and an alarm 15 minutes before', () => {
  const p = { target: 2, days: ['2026-10-27', '2026-11-01'], time: '15:30', window: 'after class', place: 'at the gym', moves: [] };
  const ics = buildIcs('2026-10-26', p);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /DTSTART:20261027T153000\r\n/);
  assert.match(ics, /DTEND:20261027T163000\r\n/);
  assert.match(ics, /DTSTART:20261101T153000\r\n/, 'Sunday after the change is still 3:30 PM local');
  assert.match(ics, /DTEND:20261101T163000\r\n/);
  assert.doesNotMatch(ics, /DTSTART:[0-9T]+Z/, 'no UTC times: they ring at 3:30 wherever the phone is');
  assert.equal((ics.match(/TRIGGER:-PT15M/g) || []).length, 2);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, `folded: ${line}`);
});
