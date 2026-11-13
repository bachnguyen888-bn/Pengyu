// The November 14 release, as rules: every logging state still pays exactly what the game says (planned,
// moved, comeback, full week, beyond the plan, a second log the same day, not enough Fish, gear already
// owned); the first scarf is honestly close (a full plan of 2, 3 or 4 pays 45, 55 or 65 against 40, and
// nothing is promised when a workout is missed); goals read as distances in words; Pengu's window is a
// finite, fixed story that pays nothing and saves nothing; and the sharing and local-data promises hold
// in the page's own source (the exact handoff words with the backup controls directly under them, the
// postcard's link off by default, the verified address only, no emoji anywhere in the interface).
// Run with: node --test "site/tests/*.test.mjs"
// Weeks used: Monday Nov 9 to Sunday Nov 15, 2026, then Monday Nov 16.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { freshApp, at, plan, logOn, rich } from './helpers.mjs';
import { windowStory, WINDOW_TITLE } from '../js/pengyu/story.js';

const MON = '2026-11-09';
const NEXT = '2026-11-16';
const SITE = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, SITE), 'utf8');
const snapshot = (S) => JSON.stringify(S.state);

// ---------- Every logging state, with exact Fish ----------
test('logging states: planned 10, moved 10, comeback +15, full week +25, beyond the plan 0, once a day', async () => {
  const S = await freshApp(`${MON}T07:00`);
  assert.ok(plan(S, ['2026-11-09', '2026-11-11', '2026-11-13']));   // Mon, Wed, Fri
  // Planned: Monday.
  let r = logOn(S, '2026-11-09');
  assert.deepEqual([r.kind, r.fish, r.bonus, r.comeback, r.movedFrom], ['planned', 10, 0, 0, null]);
  // Duplicate: a second log the same day changes nothing.
  const before = snapshot(S);
  assert.equal(logOn(S, '2026-11-09', '20:00'), null);
  assert.equal(snapshot(S), before, 'a second log the same day saves nothing');
  // Moved: Tuesday is not planned, so Wednesday's station moves to today and pays as planned.
  r = logOn(S, '2026-11-10');
  assert.deepEqual([r.kind, r.fish, r.movedFrom], ['planned', 10, '2026-11-11']);
  assert.deepEqual(S.planFor(MON).days.sort(), ['2026-11-09', '2026-11-10', '2026-11-13']);
  // Full week: Friday fills the last station: 10 + 25.
  r = logOn(S, '2026-11-13');
  assert.deepEqual([r.fish, r.bonus, r.hit], [10, 25, true]);
  // Beyond the plan: Saturday earns 0 Fish and the first looks-only extra.
  r = logOn(S, '2026-11-14');
  assert.deepEqual([r.kind, r.fish, r.bonus, r.comeback], ['extra', 0, 0, 0]);
  assert.equal(r.extra.id, 'decal-star');
  assert.equal(S.state.fish.balance, 55);
  // Comeback: next week, Monday passes unlogged; Wednesday's planned workout pays 10 + 15.
  at(S, `${NEXT}T07:00`);
  assert.ok(plan(S, ['2026-11-16', '2026-11-18']));
  r = logOn(S, '2026-11-18');
  assert.deepEqual([r.fish, r.comeback, r.bonus], [10, 15, 0]);
  assert.equal(S.state.fish.balance, 80);
  assert.equal(S.weekGoal(NEXT).kind, 'over', 'the missed Monday reads as over, never as a failure');
});

test('unlocks: not enough Fish is refused, gear goes in order, an owned piece can’t be bought twice, Fish never go negative', async () => {
  const S = await freshApp(`${MON}T07:00`, rich(39));
  assert.deepEqual(S.unlockStatus('scarf'), { state: 'saving', short: 1 });
  assert.equal(S.buy('scarf'), null, 'one Fish short: refused');
  assert.equal(S.buy('cap'), null, 'the cap waits for the scarf');
  assert.equal(S.state.fish.balance, 39);
  const S2 = await freshApp(`${MON}T07:00`, rich(100));
  assert.ok(S2.buy('scarf'));
  assert.equal(S2.state.fish.balance, 60);
  assert.deepEqual(S2.unlockStatus('scarf'), { state: 'owned' });
  assert.equal(S2.buy('scarf'), null, 'already owned');
  assert.equal(S2.state.fish.balance, 60, 'nothing taken twice');
  assert.deepEqual(S2.unlockStatus('cap'), { state: 'saving', short: 30 });
  assert.ok(S2.state.fish.balance >= 0);
});

// ---------- The first scarf, honestly close ----------
test('the first scarf: a full plan of 2, 3 or 4 pays 45, 55 or 65 against its 40, and "it’s yours" only while true', async () => {
  for (const [days, pays] of [[['2026-11-09', '2026-11-11'], 45], [['2026-11-09', '2026-11-11', '2026-11-13'], 55], [['2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13'], 65]]) {
    const S = await freshApp(`${MON}T07:00`);
    assert.ok(plan(S, days));
    assert.equal(S.goalWords(), '40 more Fish');
    logOn(S, days[0]);
    assert.equal(S.goalWords(), '30 more Fish', 'one planned workout: 10 closer');
    assert.equal(S.reach().inWeek, true, `finishing the plan of ${days.length} covers the scarf`);
    for (const d of days.slice(1)) logOn(S, d);
    assert.equal(S.state.fish.balance, pays);
    assert.equal(S.goalWords(), 'ready to unlock', 'never "55 / 40"');
  }
  // A missed workout: nothing is promised.
  const S = await freshApp(`${MON}T07:00`);
  plan(S, ['2026-11-09', '2026-11-11']);
  at(S, '2026-11-12T09:00');   // both planned days passed unlogged
  assert.equal(S.reach().inWeek, false);
  assert.equal(S.goalWords(), '40 more Fish');
});

// ---------- Pengu's window ----------
test('Pengu’s window: three fixed scenes, short lines, nothing to earn, nothing saved, the same every time', async () => {
  const S = await freshApp(`${MON}T12:00`);
  plan(S, ['2026-11-09', '2026-11-11', '2026-11-13']);
  logOn(S, '2026-11-09');
  at(S, '2026-11-10T12:30');   // Tuesday: a rest day
  const before = snapshot(S);
  const story = windowStory(S);
  assert.equal(snapshot(S), before, 'reading the story saves nothing');
  assert.equal(story.length, 3, 'a finite three-moment visit');
  assert.deepEqual(story.map((s) => s.id), ['pines', 'tunnel', 'hills'], 'a fixed order, the same for everyone');
  assert.deepEqual(windowStory(S), story, 'deterministic: no randomness');
  assert.equal(WINDOW_TITLE, 'Pengu’s window');
  for (const { line } of story) {
    for (const sentence of line.split(/(?<=[.!?])\s+/)) assert.ok(sentence.split(/\s+/).length < 15, `short: ${sentence}`);
    assert.ok(!/Fish|streak|score|calorie|step|should|must|eat|don’t miss|log /i.test(line), `no reward, score or instruction: ${line}`);
  }
  assert.ok(story.map((s) => s.line).join(' ').split('!').length - 1 <= 1, 'at most one exclamation mark');
  assert.equal(story[2].line, 'Out of the tunnel, the hills glow. Next stop: Wednesday.', 'the real next stop, nothing more');
});

test('Pengu’s window: the tunnel uses the player’s own headlamp; the last line stays true in every week state', async () => {
  const S = await freshApp(`${MON}T07:00`, rich(60));
  assert.equal(windowStory(S)[1].line, 'Into the tunnel. Lamps glow by: one, two, three.');
  assert.ok(S.buy('headlamp'));
  assert.equal(windowStory(S)[1].line, 'Into the tunnel. Your headlamp lights the way.');
  // No plan this week.
  assert.equal(windowStory(S)[2].line, 'Out of the tunnel, the hills glow. A new route starts Monday.');
  // The week hit.
  plan(S, ['2026-11-09', '2026-11-10']);
  logOn(S, '2026-11-09'); logOn(S, '2026-11-10');
  assert.equal(windowStory(S)[2].line, 'Out of the tunnel, the hills glow. Your week is complete.');
  // Sunday, next week planned too: Today still shows the hit week, and so does the window.
  at(S, '2026-11-15T10:00');
  assert.ok(plan(S, ['2026-11-16', '2026-11-18'], { week: NEXT }));
  assert.equal(S.shownWeek(), MON);
  assert.equal(windowStory(S)[2].line, 'Out of the tunnel, the hills glow. Your week is complete.');
  // A planned day not logged yet: today, said plainly.
  at(S, '2026-11-16T09:00');
  assert.equal(windowStory(S)[2].line, 'Out of the tunnel, the hills glow. Next stop: today.');
  // No plan this week, next week planned on Sunday: Today shows next week's route, and the window says so.
  const T = await freshApp('2026-11-15T10:00');
  assert.ok(plan(T, ['2026-11-16', '2026-11-18'], { week: NEXT }));
  assert.equal(T.shownWeek(), NEXT);
  assert.equal(windowStory(T)[2].line, 'Out of the tunnel, the hills glow. Your route starts Monday.');
});

// ---------- Promises kept in the page's own source ----------
const HANDOFF = 'Progress is saved in this browser. Another browser or Home Screen app may have a separate save.';
test('local data: the exact words, with Save a backup and Restore from a backup directly under them (Settings, History, the tip)', () => {
  for (const [file, saveId] of [['js/pengyu/history.js', 'py-backup'], ['js/pengyu/route.js', 'py-tip-backup']]) {
    const src = read(file);
    const at = src.indexOf(HANDOFF);
    assert.ok(at > 0, `${file} says it word for word`);
    const between = src.slice(at, src.indexOf(`id: '${saveId}'`, at));
    assert.ok(between.length > 0 && !/h\('p'/.test(between), `${file}: nothing between the words and Save a backup`);
    const after = src.slice(at, at + 1600);
    assert.ok(after.indexOf('Save a backup') < after.indexOf('Restore from a backup'), `${file}: Restore follows Save`);
  }
  assert.ok(!/cloud sync[^,]/i.test(read('js/pengyu/history.js')), 'no cloud sync is promised');
});

test('sharing promises: the postcard’s link starts off, the only address is the verified one, and no emoji appear anywhere', () => {
  assert.match(read('js/pengyu/history.js'), /let share = \{[^}]*\blink: false\b/, 'the link is off by default');
  assert.doesNotMatch(read('js/pengyu/history.js'), /invite: true/, 'no line is on by default');
  const page = read('clearhealth-pengu.html');
  assert.match(page, /<meta name="pengyu-share-url" content="https:\/\/bachnguyenclearhealth\.com">/);
  const urls = new Set();
  for (const file of readdirSync(new URL('js/pengyu/', SITE))) {
    const src = read(`js/pengyu/${file}`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(src.replace(/[©®™]/g, '')), `no emoji in ${file}`);
    for (const m of src.matchAll(/https?:\/\/[a-z0-9.-]+/gi)) if (!m[0].includes('www.w3.org')) urls.add(m[0]);
  }
  assert.deepEqual([...urls], [], 'no address is written into the app code: the link comes only from the page’s meta tag');
});

test('Pengu’s window, the invitation and the token save nothing and track nothing', () => {
  for (const file of ['js/pengyu/window.js', 'js/pengyu/story.js', 'js/pengyu/invite.js']) {
    const src = read(file);
    assert.doesNotMatch(src, /localStorage|sessionStorage|logEvent|fetch\(|sendBeacon|XMLHttpRequest|Math\.random/, `${file} keeps and sends nothing, and draws nothing at random`);
  }
});

test('review copy, word for word: the spec goal line, the first heading, the first goal, the comeback captions', () => {
  const src = read('js/pengyu/route.js');
  for (const words of [
    '`Every planned workout left still pays ${S.FISH.station} Fish.`',
    '\'Your planned workouts move Pengu’s train.\'',
    '`${f.price} Fish. A full week of ${f.smallest} planned workouts earns ${f.earns}.`',
    '`Welcome back: +${S.FISH.comeback} Fish for your comeback.`',
    '`Finished exercising? Log it now. Welcome back: +${S.FISH.comeback} Fish for your comeback.`',
  ]) assert.ok(src.includes(words), words);
});

test('the invitation carries the live link automatically with no link chip; the postcard link stays opt-in', () => {
  assert.doesNotMatch(read('js/pengyu/invite.js'), /Include Pengyu link|-link`/);
  assert.match(read('js/pengyu/history.js'), /chip\('link', 'Include Pengyu link'/);
  assert.match(read('privacy.html'), /the same short message for everyone, then the Pengyu link when it’s available\. Your days, time or place are added only if you switch them on\./);
});

test('"Today" stays whole wherever it fits; only the tightest widths in em shorten it', () => {
  const css = read('pengu.css').replace(/\s+/g, ' ');
  assert.match(css, /@container \(min-width: 13\.5em\) and \(max-width: 18em\) \{ \.py-station\.is-today \.py-stop-long \{ display: inline; \} \.py-station\.is-today \.py-stop-short \{ display: none; \} \}/);
  assert.match(css, /\.py-reward-art \{[^}]*overflow: clip;/, 'the sunk face never makes the reward sheet scroll');
});
