// Sharing and returning plans, as rules: the Pengyu link is only ever the owner's https address (never
// a guess, never with a query or fragment that could track); the postcard and the invitation say only
// what the player switched on; and reviewing last week's plan never fills in a passed day, never
// assumes a number the week can't hold, and saves nothing on its own.
// Run with: node --test "site/tests/*.test.mjs"
// Weeks used: Monday Nov 2 to Sunday Nov 8, 2026, then Monday Nov 9 and Monday Nov 16.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshApp, at, plan, logOn } from './helpers.mjs';

const MON = '2026-11-02';
const NEXT = '2026-11-09';
const MWF = ['2026-11-02', '2026-11-04', '2026-11-06'];
const snapshot = (S) => JSON.stringify(S.state);

// ---------- The Pengyu link ----------
test('the Pengyu link: only a plain https address the owner wrote; nothing else is ever offered', async () => {
  const S = await freshApp(`${MON}T07:00`);
  assert.equal(S.shareLink(''), '');
  assert.equal(S.shareLink('   '), '');
  assert.equal(S.shareLink(undefined), '');
  assert.equal(S.shareLink(42), '');
  assert.equal(S.shareLink('pengyu.example'), '', 'not an address');
  assert.equal(S.shareLink('http://pengyu.example'), '', 'https only');
  assert.equal(S.shareLink('https://pengyu.example/?utm_source=invite'), '', 'no query: nothing to track with');
  assert.equal(S.shareLink('https://pengyu.example/?'), '', 'not even an empty one');
  assert.equal(S.shareLink('https://pengyu.example/#ref'), '', 'no fragment');
  assert.equal(S.shareLink('https://me:secret@pengyu.example/'), '', 'no login');
  assert.equal(S.shareLink('https://localhost/'), '', 'not a local address');
  assert.equal(S.shareLink('https://127.0.0.1/'), '', 'not an IP address');
  assert.equal(S.shareLink('javascript:alert(1)'), '');
  assert.equal(S.shareLink(' https://pengyu.example '), 'https://pengyu.example/');
  assert.equal(S.shareLink('https://example.com/pengyu'), 'https://example.com/pengyu');
  // In this test there is no page, so no owner-set address: no link.
  assert.equal(S.appLink(), '');
});

// ---------- The postcard ----------
test('postcard text: the caption alone by default; the link only when chosen and only if the owner set one', async () => {
  const S = await freshApp(`${MON}T07:00`);
  plan(S, MWF);
  for (const d of MWF) logOn(S, d);
  const card = S.firstFullWeek();
  const url = 'https://pengyu.example/';
  assert.equal(S.postcardText({}, card, url), 'Week complete with Pengu.', 'no dates, count or link unless chosen');
  assert.equal(S.postcardText({ link: true }, card, ''), 'Week complete with Pengu.', 'no owner link: none is invented');
  assert.equal(S.postcardText({ link: true }, card), 'Week complete with Pengu.', 'and none without a page either');
  assert.equal(S.postcardText({ link: true }, card, url), `Week complete with Pengu.\n${url}`);
  assert.equal(S.postcardText({ caption: 2, prop: 'train', dates: true, workouts: true, link: true }, card, url),
    `Pengu and I reached the last station. 🚂\nNov 2 – Nov 8\n3 of 3 planned workouts\n${url}`);
  for (const opts of [{}, { dates: true, workouts: true, link: true }]) {
    const t = S.postcardText(opts, card, url);
    assert.ok(!/gym|after class|3:30|15:30|at the/i.test(t), `never the place or time: ${t}`);
  }
});

// ---------- The invitation ----------
test('invitation: the same words for everyone; days, time and place only when each is switched on', async () => {
  const S = await freshApp(`${MON}T07:00`);
  plan(S, MWF);
  const p = S.planFor(MON);
  const base = S.INVITE.join('\n');
  assert.equal(S.inviteText({}, p, ''), base, 'generic, and no link when none is set');
  assert.equal(S.inviteText({}, p), base, 'no page: no owner link');
  assert.equal(S.inviteText({}, p, 'https://pengyu.example/'), `${base}\nhttps://pengyu.example/`);
  assert.equal(S.inviteText({ days: true }, p, ''), `${base}\nMy days: Monday, Wednesday and Friday.`);
  assert.equal(S.inviteText({ time: true }, p, ''), `${base}\nMy time: after class, 3:30 PM.`);
  assert.equal(S.inviteText({ place: true }, p, ''), `${base}\nMy place: at the gym.`);
  assert.equal(S.inviteText({ days: true, time: true, place: true }, p, 'https://pengyu.example/'),
    `${base}\nMy days: Monday, Wednesday and Friday.\nMy time: after class, 3:30 PM.\nMy place: at the gym.\nhttps://pengyu.example/`);
  // The default words carry nothing personal and claim nothing.
  assert.ok(!/Monday|Wednesday|Friday|3:30|gym|after class/.test(base));
  assert.ok(!/joined|is in|reward|bonus|Fish|friends? (are|have)/i.test(base), base);
  for (const line of S.INVITE) assert.ok(line.split(/\s+/).length < 15, `short: ${line}`);
});

test('invitation: a typed time reads as a clock time', async () => {
  const S = await freshApp(`${MON}T07:00`);
  S.createPlan({ target: 2, days: ['2026-11-03', '2026-11-05'], time: '16:00', window: 'at 4:00 PM', place: 'at the pool' });
  assert.equal(S.inviteText({ time: true, place: true }, S.planFor(MON), '').split('\n').slice(-2).join(' | '), 'My time: 4:00 PM. | My place: at the pool.');
});

// ---------- Reviewing last week's plan ----------
test('review: none for a first plan, none once the week is planned', async () => {
  const S = await freshApp(`${MON}T07:00`);
  assert.equal(S.planReview(), null);
  assert.equal(S.reviewLabel(), '');
  plan(S, MWF);
  assert.equal(S.planReview(MON), null, 'this week is planned');
});

test('review: on Monday, last week’s days, time and place, set on this week, all still open', async () => {
  const S = await freshApp(`${MON}T07:00`);
  plan(S, MWF);
  at(S, `${NEXT}T07:00`);
  const before = snapshot(S);
  const r = S.planReview();
  assert.deepEqual(r, {
    from: MON, week: NEXT, open: ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'],
    target: 3, days: ['2026-11-09', '2026-11-11', '2026-11-13'], missing: [], time: '15:30', window: 'after class', place: 'at the gym',
  });
  assert.equal(S.reviewLabel(r), 'Review last week’s plan');
  assert.equal(snapshot(S), before, 'reviewing saves nothing');
  assert.ok(S.createPlan({ week: r.week, target: r.target, days: r.days, time: r.time, window: r.window, place: r.place }), 'Start this week: the same plan, saved for this week');
  assert.deepEqual(S.planFor(NEXT).days, r.days);
  assert.deepEqual(S.state.log, {}, 'nothing is logged by planning');
});

test('review: a weekday that has passed is listed, never swapped, and Start needs a real choice', async () => {
  const S = await freshApp(`${MON}T07:00`);
  plan(S, MWF);
  at(S, '2026-11-11T07:00');   // Wednesday of the next week: Monday has passed
  const r = S.planReview();
  assert.equal(r.week, NEXT);
  assert.equal(r.target, 3);
  assert.deepEqual(r.days, ['2026-11-11', '2026-11-13']);
  assert.deepEqual(r.missing, ['2026-11-09']);
  assert.equal(S.createPlan({ week: NEXT, target: 3, days: r.days, time: r.time, window: r.window, place: r.place }), null, 'two days for three workouts: refused');
  assert.equal(S.createPlan({ week: NEXT, target: 3, days: [...r.missing, ...r.days], time: r.time, window: r.window, place: r.place }), null, 'a passed day: refused');
  assert.ok(S.createPlan({ week: NEXT, target: 3, days: [...r.days, '2026-11-12'], time: r.time, window: r.window, place: r.place }), 'with Thursday picked: saved');
});

test('review: fewer days left than last week’s number asks for a number instead of shrinking it', async () => {
  const S = await freshApp(`${MON}T07:00`);
  plan(S, ['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06']);
  at(S, '2026-11-13T07:00');   // Friday: Friday, Saturday and Sunday are left, three days for a four-workout plan
  const r = S.planReview();
  assert.equal(r.target, 0, 'no number is assumed');
  assert.deepEqual(r.open, ['2026-11-13', '2026-11-14', '2026-11-15']);
  assert.deepEqual(r.days, ['2026-11-13']);
  assert.deepEqual(r.missing, ['2026-11-09', '2026-11-10', '2026-11-12']);
});

test('review: on Sunday it plans next week from this week; after a week off it says "your last plan"', async () => {
  const S = await freshApp(`${MON}T07:00`);
  plan(S, MWF);
  at(S, '2026-11-08T10:00');   // Sunday: next week is the one to plan
  const r = S.planReview();
  assert.equal(r.week, NEXT);
  assert.equal(r.from, MON);
  assert.deepEqual(r.days, ['2026-11-09', '2026-11-11', '2026-11-13']);
  assert.equal(S.reviewLabel(r), 'Review this week’s plan for next week');
  at(S, '2026-11-16T07:00');   // a week with no plan in between
  assert.equal(S.reviewLabel(), 'Review your last plan');
  assert.deepEqual(S.planReview().days, ['2026-11-16', '2026-11-18', '2026-11-20']);
});

test('review: a moved workout comes back on the day it was moved to', async () => {
  const S = await freshApp(`${MON}T07:00`);
  plan(S, MWF);
  assert.ok(S.moveStation('2026-11-04', '2026-11-05'));   // Wednesday moved to Thursday
  at(S, `${NEXT}T07:00`);
  assert.deepEqual(S.planReview().days, ['2026-11-09', '2026-11-12', '2026-11-13']);
});

test('the Fish rules are untouched: 10 a planned workout, +25 for the week, +15 comeback, 0 beyond, one a day', async () => {
  const S = await freshApp(`${MON}T07:00`);
  plan(S, MWF);
  assert.equal(logOn(S, '2026-11-02').fish, 10);
  assert.equal(logOn(S, '2026-11-02', '19:00'), null, 'one a day');
  const moved = logOn(S, '2026-11-03');   // an unplanned day pulls Wednesday to today
  assert.equal(moved.fish, 10);
  assert.equal(moved.movedFrom, '2026-11-04');
  const last = logOn(S, '2026-11-06');
  assert.equal(last.fish, 10);
  assert.equal(last.bonus, 25);
  assert.equal(logOn(S, '2026-11-07').fish, 0, 'beyond the plan');
  assert.equal(S.state.fish.balance, 55);
});
