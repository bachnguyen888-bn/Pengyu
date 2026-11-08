// Today, exactly: the Fish pill and Pengu's avatar; "good evening."; the stage, with Pengu's train on this
// week's route, "Workouts this week: X of N" and one big Begin. Begin logs in one tap: the Fish it paid
// appear at once on the station ahead ("+10"), the train rolls there, the ring fills, the Fish fly into the
// pill as it counts up, Pengu celebrates, and the sunny reward sheet rises with the Fish earned and Pengu's
// next goal ("Scarf: 30 more Fish", previewed on Pengu). The route, or "View or move workout days", opens
// the week sheet (sessions, moves, the calendar file, the cover).
// After a log, and on days between planned workouts, the stage names the next stop and what it pays, and
// offers "Look out the window": Pengu's window, a tiny story with nothing to earn (window.js).
// Planned ahead on Sunday, the stage shows next week's route: "Your route starts Monday." With no plan
// this week, the stage says how Pengyu works in three short steps before "Plan my week", or, for a
// returning player, "Review last week's plan". Right after a very first plan, a sheet offers an optional
// invitation for a friend to plan their own week: its words are shown before anything is shared.
// No penalties and no shame: a day without a workout just reads "not logged".

import * as S from './state.js';
import { downloadIcs } from './ics.js';
import { h, icon, weekday, monthDay, clock } from './ui.js';
import { penguFigure, trainFigure, faceFigure, glyph } from './art.js';
import { bindPengu, rollTrain, fillStation, sheetIn, sheetOut, rise, reducedMotion, fishToken } from './motion.js';
import { wobblyLine, ring, check, softRect } from './ink.js';
import { countTo, toast as fxToast } from '../fx.js';
import { tipWanted, saveBackup } from './backup.js';
import { buildWindow } from './window.js';
import { inviteBody } from './invite.js';

const NS = 'http://www.w3.org/2000/svg';
let pending = null;   // a log in flight: what the screen showed before Begin, then what it paid
let lastAt = null;    // where the train stood when Today was last drawn (0 = depot, 1 = last station)
let drawnFor = '';    // the save those were drawn for: after a reset everything starts afresh
let bound = [];       // the Pengu drawings brought to life on this screen
let moving = '';      // the session whose "move to" chips are open in the week sheet
let refs = { onShop() {}, onPlan() {}, onHistory() {}, onPostcard() {}, onRestoreFile() {} };

const SAY = { done: 'done', today: 'planned for today', upcoming: 'planned', missed: 'not logged' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// "After class · 3:30 PM · at the gym", or "4:00 PM · at the pool" for a time picked by hand.
const when = (plan) => `${plan.window.startsWith('at ') ? clock(plan.time) : `${cap(plan.window)} · ${clock(plan.time)}`} · ${plan.place}`;
const ifThen = (plan) => `${cap(plan.window)} · ${plan.place}`;
const toast = (title, sub) => fxToast(title, sub, penguFigure(S.look(), { cls: 'py-toast-art', pose: 'bust' }));
const night = () => { const hr = S.now().getHours(); return hr >= 19 || hr < 6; };

function lineArt(cls, viewBox, inner, stretch = false) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (stretch) svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = inner;
  return svg;
}

function announce(text) {
  const el = document.getElementById('py-live');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 60);
}

// The goal line under the count. The +25 is named only while every planned workout still open can hit
// the week; once a planned day has passed unlogged it says what is still true, with no blame.
function goal(monday = S.thisWeek()) {
  const g = S.weekGoal(monday);
  if (!g) return null;
  if (g.kind === 'hit') return { text: 'You hit your week.', calm: false };
  if (g.kind === 'one-left') return { text: `One planned workout left · +${S.FISH.weekBonus} Fish when your week is complete.`, calm: false };
  if (g.kind === 'more') return { text: `${g.need} more to hit your week`, calm: false };
  if (g.kind === 'out-of-reach') return { text: `Every planned workout left still pays ${S.FISH.station} Fish.`, calm: true };
  return { text: 'A new route starts Monday.', calm: true };
}

const dayName = (stop) => (stop.week === S.thisWeek() ? weekday(S.parseKey(stop.day)) : `${weekday(S.parseKey(stop.day))}, ${monthDay(S.parseKey(stop.day))}`);
// The comeback is named apart from the 10 (never summed to "+25", which could read as the week bonus);
// `said`: the caption above already says "Welcome back: +15 Fish for your comeback".
const stopLine = (stop, said = false) => `Next stop: ${dayName(stop)} · +${stop.fish} Fish${stop.comeback && !said ? `, +${stop.comeback} welcome back` : ''}`;

// Pengu's next goal, which is also the way to the Pengu tab: "Next upgrade: Scarf · 30 more Fish".
function goalRow() {
  const g = S.nextGoal();
  const words = g ? `Next upgrade: ${g.item.name} · ${S.goalWords(g)}` : 'Pengu has every upgrade.';
  return h('button', { class: 'link py-onward-goal num', type: 'button', id: 'py-see-pengu', onclick: () => refs.onShop() },
    words, h('span', { class: 'sr-only' }, g ? '. See Pengu’s next upgrade.' : '. See Pengu.'), h('span', { class: 'py-chev', 'aria-hidden': 'true' }, ' ›'));
}
// Pengu's window: a tiny story for a rest day (or any day after a log). Nothing to earn.
const windowButton = () => h('button', { class: 'link py-window-btn', type: 'button', id: 'py-window', onclick: openWindow }, icon('i-window'), 'Look out the window');
function openWindow() {
  openSheet('py-winsheet', 'py-win-title', buildWindow, () => document.getElementById('py-window'));
}

// After a log, and on a day between planned workouts: where the route goes next and what that stop
// pays, or, with nothing left this week, what is true and what comes next. It never asks for a workout.
// (The goal line above already says "You hit your week." or "A new route starts Monday.")
function onward() {
  const stop = S.nextStop();
  let first;
  const p = S.logPreview();
  if (stop) first = h('p', { class: 'py-onward-stop' }, stopLine(stop, Boolean(p.comeback && p.kind === 'moved')));
  else if (S.canPlanNextWeek()) first = h('button', { class: 'link py-plan-next', type: 'button', id: 'py-plan-next', onclick: () => refs.onPlan() }, icon('i-calendar'), (S.reviewLabel && S.reviewLabel()) || 'Plan next week');
  else first = h('p', { class: 'py-onward-stop' }, 'You can plan next week on Sunday.');
  return h('div', { class: 'py-onward' }, first, goalRow(), windowButton());
}

// A first visit (also where a friend's link lands): what the player does, in three short steps, and the
// first goal, drawn: Pengu in the scarf, with the plain math of a full week. Nothing is promised beyond it.
function howItWorks() {
  const steps = [
    ['i-calendar', 'Plan', ` ${S.TARGETS[0]} to ${S.TARGETS[S.TARGETS.length - 1]} workouts this week.`],
    ['i-check', 'Log', ' each one you finish.'],
    ['i-fish', 'Earn Fish', ' for Pengu’s gear.'],
  ];
  return h('ol', { class: 'py-how' }, steps.map(([name, lead, rest]) => h('li', {}, icon(name), h('span', {}, h('strong', {}, lead), rest))));
}
function firstGoalCard() {
  const f = S.firstGoal ? S.firstGoal() : null;
  if (!f) return null;
  return h('div', { class: 'py-first-goal' },
    h('div', { class: 'py-first-goal-pic', 'aria-hidden': 'true' }, penguFigure(S.lookWith(f.item.id), { pose: 'bust' })),
    h('p', {},
      h('strong', {}, `First goal: Pengu’s ${f.item.name.toLowerCase()}`), ' ',
      h('span', {}, `${f.price} Fish. A full week of ${f.smallest} planned workouts earns ${f.earns}.`)));
}
// A returning player with no plan yet: last plan, on one card, ready to start again in one tap.
function repeatCard(review) {
  const all = S.stations({ days: [...review.days, ...review.missing] }).map((d) => weekday(S.parseKey(d)));
  const list = all.length > 1 ? `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}` : all[0] || '';
  const when = review.window.startsWith('at ') ? clock(review.time) : `${cap(review.window)}, ${clock(review.time)}`;
  return h('div', { class: 'py-repeat' },
    h('p', { class: 'py-repeat-days' }, icon('i-calendar'), h('span', {}, list)),
    h('p', { class: 'py-repeat-when' }, `${when} · ${review.place}`));
}

// What Begin says, and the quiet caption under it.
function beginState(r, ahead) {
  if (!r) {
    const review = S.planReview && S.planReview();
    if (!review) return { label: 'Plan my week', caption: 'About 30 seconds. No account needed.', plan: true };
    if (S.canRepeat && S.canRepeat()) return { label: review.week === S.thisWeek() ? 'Start this week' : 'Start next week', repeat: true, change: true };
    const passed = review.missing.map((d) => weekday(S.parseKey(d)));
    const why = !review.target ? `Only ${review.open.length} days are left this week, so you’ll pick a number.`
      : `${passed.length > 1 ? `${passed.slice(0, -1).join(', ')} and ${passed[passed.length - 1]} have` : `${passed[0]} has`} passed this week, so you’ll pick another day.`;
    return { label: S.reviewLabel(review), caption: why, plan: true };
  }
  if (ahead) return { label: `First stop: ${weekday(S.parseKey(r.stations[0].day))}`, waiting: true, caption: ifThen(r.plan) };
  const p = S.logPreview();
  if (p.kind === 'logged') return { label: 'Logged today', logged: true, caption: '' };   // the next stop follows
  if (p.comeback && p.kind === 'moved') return { label: 'Log finished workout', caption: `Welcome back: +${S.FISH.comeback} Fish for your comeback.` };
  if (p.comeback) return { label: 'Log finished workout', caption: `Finished exercising? Log it now. Welcome back: +${S.FISH.comeback} Fish for your comeback.` };
  if (p.kind === 'planned') return { label: 'Log finished workout', caption: `Finished exercising? Log it now. ${ifThen(r.plan)}` };
  if (p.kind === 'moved') return { label: 'Log finished workout', caption: `Exercised today? It counts for ${weekday(S.parseKey(p.from))}.` };
  return { label: 'Log finished workout', caption: 'Extra workouts: looks only, no Fish.' };
}

// ---------- The route ----------
function stationNode(s, i, count, arriving) {
  const date = S.parseKey(s.day);
  const stamped = Boolean(S.state.log[s.day] && S.state.log[s.day].comeback);
  const li = h('li', { class: `py-station is-${s.status}${arriving ? ' is-arriving' : ''}` },
    lineArt('py-ring', '0 0 40 40', `
      <path class="py-ring-line" d="${ring(20, 20, 15, { seed: 11 + i * 7 })}"/>
      <circle class="py-ring-fill" cx="20" cy="20" r="15.6"/>
      <path class="py-ring-check" d="${check(20, 20.6, 17, { seed: 5 + i })}"/>`),
    // With large text the weekdays shorten to two letters ("We"), so neighbours never run together.
    h('span', { class: 'py-stop-day', 'aria-hidden': 'true' }, s.status === 'today' ? 'Today'
      : [h('span', { class: 'py-stop-long' }, weekday(date, 'short')), h('span', { class: 'py-stop-short' }, weekday(date, 'short').slice(0, 2))]),
    stamped ? h('span', { class: `py-stamp${arriving ? ' is-new' : ''}`, 'aria-hidden': 'true' }, icon('i-stamp')) : null,
    h('span', { class: 'sr-only' }, `${weekday(date)}: ${SAY[s.status]}${stamped ? ', with a Comeback stamp' : ''}`));
  li.style.setProperty('--at', String((i + 1) / count));
  return li;
}

function routeBlock(r, look, arriving, ahead) {
  const ties = Array.from({ length: 30 }, (_, i) => `M${18 + i * 33.5 + (i % 3) * 1.4} ${1.4 + (i % 2) * 0.5}V${6.6 - (i % 4) * 0.4}`).join('');
  const wrap = h('div', { class: `py-route-wrap${look.car ? ' has-car2' : ''}${r ? '' : ' is-empty'}` },
    lineArt('py-rail', '0 0 1000 8', `<path d="${wobblyLine(0, 1000, 4, { seed: 5, amp: 0.7, step: 64 })}"/><path d="${ties}"/>`, true),
    lineArt('py-route-line', '0 0 1000 6', `<path d="${wobblyLine(0, 1000, 3, { seed: 9, amp: 0.9, step: 72 })}"/>`, true),
    h('ol', { class: 'py-route', 'aria-label': !r ? 'No workouts planned yet' : ahead ? 'Workouts next week' : 'Workouts this week' },
      h('li', { class: 'py-depot', 'aria-hidden': 'true' }, lineArt('py-depot-art', '0 0 14 14', `<path d="${softRect(1, 1, 12, 12, 3, { seed: 4, amp: 0.5 })}"/>`)),
      r ? r.stations.map((s, i) => stationNode(s, i, r.stations.length, arriving === s.day)) : null));
  wrap.querySelector('.py-depot').style.setProperty('--at', '0');
  const train = h('div', { class: 'py-train', 'aria-hidden': 'true' }, trainFigure(look, { cls: 'py-train-svg', night: night() }));
  train.style.setProperty('--at', String(r ? r.trainAt / r.stations.length : 0));
  wrap.append(train);
  // A tap on the route opens the week too; keyboards and screen readers use the button below it.
  if (r) wrap.append(h('button', { class: 'py-route-open', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onclick: openWeek }));
  return wrap;
}
const daysButton = () => h('button', { class: 'py-days-btn', type: 'button', id: 'py-days-btn', onclick: openWeek }, icon('i-calendar'), 'View or move workout days');

// ---------- Begin ----------
// "Start this week": last plan again, as it was. Today redraws with the new route; Pengu says so.
function repeatPlan() {
  requestFocus = true;   // set first: saving redraws Today at once
  if (!S.repeatLastPlan || !S.repeatLastPlan()) { requestFocus = false; return; }
  toast('Your week is planned.', 'Same days, time and place as last time.');
}
let requestFocus = false;   // after the one tap, focus goes to the week's count
let token = null;           // the "+10" riding to the station, until it flies into the Fish pill
function begin() {
  const r0 = S.route();
  const p = S.logPreview();
  pending = { before: { fish: S.state.fish.balance, count: r0 ? r0.done : 0, goal: r0 ? goal() : null, next: S.nextGoal() }, arriving: p.kind === 'planned' || p.kind === 'moved' };
  try { if (navigator.vibrate) navigator.vibrate(10); } catch { /* no haptics here */ }
  const res = S.logWorkout();   // Today re-renders right away and rolls the train in from where it stood
  if (!res) { pending = null; return; }
  pending.res = res;
  // The Fish it paid show at once, on the station the train is heading for (never for an extra ride).
  const total = res.fish + res.bonus + res.comeback;
  if (token) token.drop();
  token = total > 0 ? fishToken(document.querySelector('.py-station.is-arriving'), `+${total}`) : null;
}

function arrive(view) {
  const p = pending;
  pending = null;
  const tk = token;   // the "+10" is always sent home or cleared here, never left floating
  token = null;
  if (!p || !p.res || !view.isConnected) { if (tk) tk.drop(); return; }
  const r = S.route();
  const st = view.querySelector('.py-station.is-arriving');
  if (st) { st.classList.remove('is-arriving'); fillStation(st); }
  if (r) {
    view.querySelector('.py-count-n').textContent = `${r.done} of ${r.target}`;
    const g = goal();
    const line = view.querySelector('.py-goal');
    line.textContent = g.text;
    line.classList.toggle('is-calm', g.calm);
  }
  const fishN = view.querySelector('.py-fish-n');
  if (tk) tk.land(view.querySelector('.py-fishpill'));
  countTo(fishN, S.state.fish.balance);
  view.querySelector('.py-fishpill').setAttribute('aria-label', `${S.state.fish.balance} Fish`);
  // Pengu celebrates on the next frame. The sheet's art is usually drawn already (at idle time); if
  // Begin came first, it is drawn in the quiet moment after arrival.
  requestAnimationFrame(() => { if (bound[0]) bound[0].celebrate(); });
  setTimeout(primeRewardArt, 320);
  const res = p.res;
  const total = res.fish + res.bonus + res.comeback;
  announce(res.kind === 'extra'
    ? `Extra workout logged. No Fish.${res.extra ? ` You collected the ${res.extra.name}.` : ''}`
    : `Workout logged. ${r.done} of ${r.target}.${res.comeback ? ' Comeback stamp.' : ''}${r.hit ? ' You hit your week.' : ''} Plus ${total} Fish.`);
  setTimeout(() => openReward(res, p.before.next), reducedMotion() ? 0 : 600);
}

// ---------- Sheets ----------
let sheet = null;
function closeSheet(now = false) {
  const s = sheet;
  if (!s) return;
  sheet = null;
  const done = () => {
    s.dlg.close();
    s.dlg.remove();
    const back = s.returnFocus && s.returnFocus();
    if (back) back.focus({ preventScroll: true });
    if (s.onClosed && !now) s.onClosed();
  };
  if (now) done(); else sheetOut(s.panel, done);
}
function openSheet(cls, label, build, returnFocus, onClosed) {
  closeSheet(true);
  const panel = h('div', { class: 'py-sheet-panel' }, h('div', { class: 'py-sheet-grip', 'aria-hidden': 'true' }));
  // Toasts shown while a sheet is open appear here, above the sheet's backdrop.
  const dlg = h('dialog', { class: `py-sheet ${cls}`, 'aria-labelledby': label }, panel, h('div', { class: 'toasts', 'aria-live': 'polite' }));
  sheet = { dlg, panel, returnFocus, onClosed };
  // close() slides the sheet away; close(true) ends it at once, for a link that leaves Today, so the
  // dialog hands focus back before the next tab takes it.
  const close = (now = false) => closeSheet(now);
  build(panel, close);
  document.body.append(dlg);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  // Keep Tab inside the sheet: from the last control back to the first, and the other way round.
  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...panel.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]):not([tabindex="-1"]), textarea')];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  // Swipe down to close.
  let startY = null;
  let dy = 0;
  panel.addEventListener('pointerdown', (e) => { if (e.target.closest('button, a, input, textarea') || panel.scrollTop > 0) return; startY = e.clientY; dy = 0; });
  panel.addEventListener('pointermove', (e) => { if (startY === null) return; dy = Math.max(0, e.clientY - startY); panel.style.setProperty('transform', `translateY(${dy}px)`); });
  const end = () => { if (startY === null) return; startY = null; if (dy > 90) close(); else panel.style.setProperty('transform', 'translateY(0)'); };
  panel.addEventListener('pointerup', end);
  panel.addEventListener('pointercancel', end);
  dlg.showModal();
  sheetIn(panel);
}

// The sunny reward card's lines: comeback first, then the full week, then the next unlock.
function rewardCopy(res) {
  const lines = [];
  let title = 'Workout logged.';
  const moved = res.movedFrom ? `${weekday(S.parseKey(res.movedFrom))}’s workout moved to today.` : '';
  if (res.comeback) {
    title = 'Welcome back.';
    if (moved) lines.push(moved);
    lines.push(`+${res.fish} Fish · +${res.comeback} Comeback stamp`);
    if (res.bonus) lines.push(`+${res.bonus} full-week bonus`, `Week streak ${S.weekStreak()}`);
  } else if (res.bonus) {
    title = 'You hit your week.';
    if (moved) lines.push(moved);
    lines.push(`+${res.fish} Fish · +${res.bonus} full-week bonus`, `Week streak ${S.weekStreak()}`);
  } else if (res.kind === 'extra') {
    title = 'Extra workout logged.';
    lines.push(res.extra ? `No Fish. You collected the ${res.extra.name} (looks only).` : 'No Fish. You have every extra, and it still counts.');
  } else {
    lines.push(moved ? `${moved} +${res.fish} Fish` : `+${res.fish} Fish`);
  }
  // The week that was just completed is the first full one: its postcard is now in History.
  const card = res.bonus ? S.firstFullWeek() : null;
  // Where the route goes next this week, and what that stop pays.
  const next = res.kind !== 'extra' ? S.nextStop() : null;
  const stop = next && next.week === S.thisWeek() ? stopLine(next) : '';
  return { title, lines, stamp: Boolean(res.comeback), extra: res.kind === 'extra' ? res.extra : null, postcard: Boolean(card && card.monday === S.thisWeek()), stop };
}

// "Scarf: 30 more Fish", or "Scarf: ready to unlock". When the log just brought the same goal closer, the
// distance counts down from where it stood ("40" to "30"), so the step closer is seen; screen readers
// hear only the final words.
function fishOf(g, before) {
  if (g.ready) return [`${g.item.name}: ready to unlock`];
  const short = g.price - g.balance;
  const was = before && before.item.id === g.item.id && !before.ready ? before.price - before.balance : short;
  const n = h('span', { class: 'py-goal-n' }, String(was));
  n.dataset.value = String(was);
  if (was !== short) setTimeout(() => countTo(n, short), reducedMotion() ? 0 : 520);
  return [`${g.item.name}: `, h('span', { 'aria-hidden': 'true' }, n, ' more Fish'), h('span', { class: 'sr-only' }, `${short} more Fish`)];
}

// The next goal on the reward sheet: Pengu (or the train) wearing it already, the Fish still to go (or
// "ready to unlock"), and a preview on the Pengu tab. A preview never unlocks or spends anything.
// The goal's second line. "Finish your plan and it's yours" only when it is true: the planned workouts
// still open this week, plus the week bonus if it can still be earned, cover the price. Comebacks and
// extra workouts are never counted, and Fish already spent elsewhere are not in the balance.
function goalSub(g) {
  if (g.ready) return 'Ready to unlock on Pengu.';
  const rc = S.reach ? S.reach(g) : null;
  if (rc && rc.inWeek) {
    const n = `${rc.left} more planned ${rc.left > 1 ? 'workouts' : 'workout'}`;
    const bring = rc.left > 1 || rc.bonus ? 'bring' : 'brings';   // "1 more planned workout brings…"
    return `Finish your plan and it’s yours. ${n}${rc.bonus ? ' and the week bonus' : ''} ${bring} you to ${rc.potential} Fish.`;
  }
  return `${g.price - g.balance} more Fish to unlock it.`;
}
function goalBlock(close, before = null) {
  const g = S.nextGoal();
  if (!g) return h('p', { class: 'py-reward-next' }, 'Pengu has every upgrade. ', h('button', { class: 'link', type: 'button', onclick: () => { close(true); refs.onShop(); } }, 'See Pengu'));
  const gear = S.GEAR.some((x) => x.id === g.item.id);
  const art = gear ? penguFigure(S.lookWith(g.item.id), { pose: 'bust' }) : trainFigure(S.lookWith(g.item.id), { rider: false });
  return h('div', { class: 'py-reward-goal' },
    h('div', { class: `py-reward-goal-pic${gear ? '' : ' is-train'}`, 'aria-hidden': 'true' }, art),
    h('div', { class: 'py-reward-goal-text' },
      h('p', { class: 'py-reward-goal-name num' }, ...fishOf(g, before)),
      h('p', { class: 'py-reward-goal-sub' }, goalSub(g)),
      h('button', { class: 'link', type: 'button', id: 'py-reward-preview', onclick: () => { close(true); refs.onShop(g.item.id); } }, 'Preview on Pengu')));
}

const stampArt = () => lineArt('py-reward-stamp', '0 0 80 80', `
  <path d="${ring(40, 40, 34, { seed: 41, amp: 1 })}" fill="#FFE07A" stroke="#C2391F" stroke-width="3"/>
  <path d="${ring(40, 40, 27, { seed: 42, amp: 0.8 })}" fill="none" stroke="#C2391F" stroke-width="1.6"/>
  <text x="40" y="37" text-anchor="middle" font-size="12" font-weight="800" fill="#C2391F" letter-spacing=".5">COME</text>
  <text x="40" y="51" text-anchor="middle" font-size="12" font-weight="800" fill="#C2391F" letter-spacing=".5">BACK</text>`);
// The bands never change and the face changes only with the hat Pengu wears, so each is drawn once and
// copied for every sheet.
let bandsNode = null;
const faceNodes = new Map();   // hat id ('' for none) -> drawing
const faceKey = () => S.look().hat || '';
const bandsArt = () => (bandsNode || (bandsNode = lineArt('py-reward-bands', '0 0 400 190', `
  <path d="M0 64C96 26 300 26 400 64V190H0Z" fill="#FFE07A"/>
  <path d="M0 128C116 96 286 98 400 128V190H0Z" fill="#FF9A52"/>`, true))).cloneNode(true);
function faceArt() {
  const k = faceKey();
  if (!faceNodes.has(k)) faceNodes.set(k, faceFigure('', S.look()));
  return faceNodes.get(k).cloneNode(true);
}
// Draw both once, ahead of the first Begin, so that drawing never lands in the middle of the train's roll.
function primeRewardArt() {
  if (!bandsNode) bandsArt();
  if (!faceNodes.has(faceKey())) faceArt();
}
const whenIdle = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 1200));

function openReward(res, before = null) {
  const copy = rewardCopy(res);
  openSheet('py-reward', 'py-reward-title', (panel, close) => {
    panel.append(...[
      h('h2', { class: 'py-reward-title', id: 'py-reward-title' }, copy.title),
      copy.stamp ? stampArt() : null,
      copy.extra ? h('div', { class: 'py-reward-extra', 'aria-hidden': 'true' }, glyph(copy.extra.id)) : null,
      h('ul', { class: 'py-reward-lines' }, copy.lines.map((l) => h('li', { class: 'num' }, l))),
      copy.stop ? h('p', { class: 'py-reward-stop num' }, copy.stop) : null,
      copy.postcard ? h('p', { class: 'py-reward-postcard' }, icon('i-stamp'), h('span', {}, 'Your first postcard is ready. ', h('button', { class: 'link', type: 'button', id: 'py-reward-postcard', onclick: () => { close(true); refs.onPostcard(); } }, 'Preview your postcard'))) : null,
      goalBlock(close, before),
      h('button', { class: 'btn glass-coral py-reward-ok', type: 'button', autofocus: true, onclick: () => close() }, 'Nice'),
      h('div', { class: 'py-reward-art', 'aria-hidden': 'true' }, bandsArt(), h('div', { class: 'py-reward-face' }, faceArt())),
    ].filter(Boolean));
    rise(panel.querySelector('.py-reward-face'));
  }, () => document.querySelector('.py-count'), () => { if (tipWanted()) setTimeout(openTip, reducedMotion() ? 0 : 250); });
}

// Once, after a logged workout, on iPhone Safari only: Safari can clear a site's saved data, and the
// Home Screen app keeps its own, so Pengu is safest there, with a backup to carry progress across.
function openTip() {
  if (!tipWanted() || !document.querySelector('.py-today')) return;   // only on Today; otherwise after the next log
  S.markTipSeen();
  openSheet('py-tip', 'py-tip-title', (panel, close) => {
    const status = h('p', { class: 'py-tip-status', role: 'status' });
    const file = h('input', {
      class: 'sr-only', type: 'file', accept: 'application/json,.json', tabindex: '-1', 'aria-hidden': 'true',
      onchange: (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; close(true); refs.onRestoreFile(f); },
    });
    panel.append(
      h('div', { class: 'py-tip-head' },
        h('h2', { class: 'py-tip-title', id: 'py-tip-title' }, 'Keep Pengu safe: add Pengyu to your Home Screen.'),
        penguFigure(S.look(), { cls: 'py-tip-art', pose: 'bust' })),
      h('ol', { class: 'py-tip-steps' },
        h('li', {}, h('span', { class: 'py-tip-n', 'aria-hidden': 'true' }, '1'), h('span', {}, 'Tap ', icon('i-share', 'icon py-tip-share'), h('strong', {}, 'Share'), ' in Safari.')),
        h('li', {}, h('span', { class: 'py-tip-n', 'aria-hidden': 'true' }, '2'), h('span', {}, 'Choose ', h('strong', {}, 'Add to Home Screen'), '.'))),
      // The local-data note, with Save a backup and Restore from a backup directly under it.
      h('p', { class: 'py-tip-note py-handoff' }, 'Progress is saved in this browser. Another browser or Home Screen app may have a separate save.'),
      h('div', { class: 'py-tip-actions py-handoff-actions' },
        h('button', { class: 'btn glass-coral', type: 'button', id: 'py-tip-backup', onclick: () => { saveBackup(); status.textContent = 'Backup saved. Keep the file somewhere safe.'; } }, 'Save a backup'),
        // Restore asks first, as always: the file is checked, then Settings shows what it holds and waits for Restore.
        h('button', { class: 'btn btn-secondary', type: 'button', id: 'py-tip-restore', onclick: () => file.click() }, 'Restore from a backup')),
      file,
      status,
      h('p', { class: 'py-tip-note' }, 'Already have progress here? Save a backup, then restore it in the Home Screen app.'),
      h('div', { class: 'py-tip-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', autofocus: true, onclick: () => close() }, 'Got it')));
  }, () => document.querySelector('.py-count'));
}

// ---------- The invitation, once, right after a very first plan ----------
// (History keeps the same invitation, any time after.) The words are invite.js's: the same for everyone,
// then the Pengyu link while this version is live. Nothing is shared until Share or Copy text is tapped,
// and nothing is counted or rewarded either way.
let invite = { days: false, time: false, place: false, status: '' };
function openInvite(monday) {
  const plan = S.planFor(monday);
  if (!plan || !document.querySelector('.py-today')) return;
  invite = { days: false, time: false, place: false, status: '' };
  openSheet('py-invite', 'py-invite-title', function fill(panel, close, focusId = '') {
    for (const n of [...panel.children]) if (!n.classList.contains('py-sheet-grip')) n.remove();
    panel.append(
      h('div', { class: 'py-sheet-head' },
        h('div', {},
          h('p', { class: 'eyebrow' }, 'Your week is planned'),
          h('h2', { class: 'py-invite-title', id: 'py-invite-title', tabindex: '-1', autofocus: !focusId }, 'Invite a friend to plan their own week')),
        h('button', { class: 'py-sheet-close glass', type: 'button', 'aria-label': 'Close', onclick: () => close() }, icon('i-close'))),
      ...inviteBody({ st: invite, plan, refill: (id) => fill(panel, close, id), done: () => close() }));
    if (focusId) panel.querySelector(`#${focusId}`)?.focus({ preventScroll: true });
  }, () => document.querySelector('.py-count'));
}

// The week sheet: this week's sessions as sunny cards; Move costs nothing.
function sessionCard(s, plan, refill) {
  const date = S.parseKey(s.day);
  const label = { done: 'Done', today: 'Today', upcoming: 'Planned', missed: 'Not logged' }[s.status];
  return h('li', { class: `py-session is-${s.status}` },
    h('span', { class: 'py-session-day', 'aria-hidden': 'true' }, h('span', { class: 'py-session-dow' }, weekday(date, 'short')), h('span', { class: 'py-session-date' }, String(date.getDate()))),
    h('div', { class: 'py-session-text' },
      h('p', { class: 'py-session-name' }, `${weekday(date)}, ${monthDay(date)}`),
      h('p', { class: 'py-session-when' }, when(plan))),
    h('div', { class: 'py-session-side' },
      h('p', { class: 'py-session-status' }, s.status === 'done' ? icon('i-check') : null, label),
      S.canMove(s.day) ? h('button', {
        class: 'link py-session-move', type: 'button', 'aria-expanded': String(moving === s.day), 'aria-label': `Move ${weekday(date)}’s workout`,
        onclick: () => { moving = moving === s.day ? '' : s.day; refill(); },
      }, 'Move') : null));
}

function movePicker(refill) {
  if (!moving || !S.canMove(moving)) { moving = ''; return null; }
  const targets = S.moveTargets(moving);
  return h('div', { class: 'py-move', role: 'group', 'aria-labelledby': 'py-move-title' },
    h('p', { class: 'py-move-title', id: 'py-move-title' }, `Move ${weekday(S.parseKey(moving))}’s workout to:`),
    targets.length ? null : h('p', { class: 'small muted' }, 'No free days are left this week.'),
    h('div', { class: 'py-choices' },
      targets.map((d) => h('button', {
        class: 'chip glass', type: 'button',
        onclick: () => {
          const from = moving;
          moving = '';
          const saved = S.planFor(S.weekStart(from))?.icsSeq !== undefined;   // a calendar file was downloaded before
          if (S.moveStation(from, d)) toast(`Moved to ${weekday(S.parseKey(d))}. No penalty.`, saved ? 'Download the updated reminders below.' : '');
          refill();
        },
      }, d === S.today() ? 'Today' : `${weekday(S.parseKey(d), 'short')} ${monthDay(S.parseKey(d))}`)),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { moving = ''; refill(); } }, 'Keep it')));
}

// The calendar file holds the reminders (15 minutes before); Pengyu itself never sends notifications.
function calendarNote(plan, monday, refill) {
  const fresh = plan.icsSeq === undefined;
  const stale = !fresh && plan.icsSeq !== plan.moves.length;
  const get = () => { downloadIcs(monday); S.markCalendarSaved(monday); refill(); };
  return h('div', { class: 'py-sheet-note py-cal' }, icon('i-calendar'),
    h('div', { class: 'py-cal-text' },
      h('button', { class: 'link', type: 'button', id: 'py-cal-get', onclick: get }, stale ? 'Download updated reminders' : fresh ? 'Download calendar reminders' : 'Download again'),
      h('p', {}, stale ? 'You moved a workout. Import the updated file so your calendar matches.' : 'Open the downloaded file and add it to your calendar.')));
}

function openWeek() {
  openSheet('py-weeksheet', 'py-weeksheet-title', function fill(panel, close) {
    for (const n of [...panel.children]) if (!n.classList.contains('py-sheet-grip')) n.remove();
    const monday = S.shownWeek();
    const r = S.route(monday);
    if (!r) { close(); return; }
    const info = S.streakInfo();
    const refill = () => fill(panel, close);
    panel.append(...[
      h('div', { class: 'py-sheet-head' },
        h('h2', { class: 'py-weeksheet-title', id: 'py-weeksheet-title' }, monday === S.thisWeek() ? 'This week' : 'Next week'),
        h('button', { class: 'py-sheet-close glass', type: 'button', 'aria-label': 'Close', onclick: () => close() }, icon('i-close'))),
      h('ul', { class: 'py-session-list' }, r.stations.map((s) => sessionCard(s, r.plan, refill))),
      movePicker(refill),
      calendarNote(r.plan, monday, refill),
      h('p', { class: 'py-sheet-note' }, `Weeks run Monday–Sunday. One workout a day counts. Each planned workout earns ${S.FISH.station} Fish. Hitting your week earns ${S.FISH.weekBonus} more. After a planned day that wasn’t logged, the next planned workout earns ${S.FISH.comeback} more. Extra workouts earn no Fish.`),
      h('p', { class: 'py-sheet-note' }, icon('i-shield'), info.coverReady ? 'Free cover ready this month.' : 'Free cover used this month.'),
    ].filter(Boolean));
  }, () => document.getElementById('py-days-btn'));
}

// ---------- The screen ----------
export function renderToday(root, rerender, { onShop = () => {}, onPlan = () => {}, onHistory = () => {}, onPostcard = onHistory, onRestoreFile = () => {}, focus = false } = {}) {
  refs = { onShop, onPlan, onHistory, onPostcard, onRestoreFile };
  for (const c of bound) if (c) c.stop();
  bound = [];
  if (drawnFor !== S.state.createdAt) { drawnFor = S.state.createdAt; lastAt = null; pending = null; moving = ''; }
  const monday = S.shownWeek();
  const ahead = monday !== S.thisWeek();
  const r = S.route(monday);
  const look = S.look();
  const before = pending ? pending.before : null;
  const shownFish = before ? before.fish : S.state.fish.balance;
  const fishN = h('span', { class: 'py-fish-n' }, String(shownFish));
  fishN.dataset.value = String(shownFish);
  const b = beginState(r, ahead);
  const g = r && !ahead ? (before && before.goal ? before.goal : goal(monday)) : null;
  // No plan yet: a first visit sells the journey; a returning player sees last plan, ready to repeat.
  const review = !r && S.planReview ? S.planReview() : null;
  const gap = review && review.from !== S.addDays(review.week, -7);
  let countText = review ? (b.repeat ? (gap ? 'Welcome back. Same route as last time?' : 'New week, same route?') : 'Welcome back.') : 'Your planned workouts move Pengu’s train.';
  if (r && ahead) countText = 'Your route starts Monday.';
  else if (r) countText = ['Workouts this week: ', h('span', { class: 'py-count-n' }, `${before ? before.count : r.done} of ${r.target}`)];
  const count = h('h2', { class: 'py-count', id: 'py-count', tabindex: '-1' }, countText);
  const streak = S.weekStreak();

  const view = h('div', { class: 'py-today' },
    h('div', { class: 'py-topbar' },
      h('p', { class: 'py-fishpill glass', 'aria-label': `${shownFish} Fish` }, icon('i-fish'), fishN, ' Fish'),
      h('button', { class: 'py-avatar-btn glass-pink', type: 'button', 'aria-label': 'Open Pengu', onclick: () => onShop() }, penguFigure(look, { pose: 'bust' }))),
    h('h1', { class: 'py-greet' }, S.greeting()),
    h('section', { class: `py-stage${r && !ahead && S.logPreview().kind !== 'planned' ? ' is-full' : !r && !review ? ' is-first' : ''}`, 'aria-labelledby': 'py-count' },
      streak >= 1 ? h('p', { class: 'py-streak-chip' }, 'Week streak ', h('strong', {}, String(streak))) : null,
      routeBlock(r, look, before && pending.arriving ? S.today() : '', ahead),
      r ? daysButton() : null,
      h('div', {}, count, g ? h('p', { class: `py-goal${g.calm ? ' is-calm' : ''}` }, g.text) : !r ? (review ? repeatCard(review) : [howItWorks(), firstGoalCard()]) : null),
      b.logged || b.waiting
        ? h('button', { class: `py-begin-btn is-logged${b.logged && pending ? ' is-new' : ''}`, type: 'button', 'aria-disabled': 'true' }, icon(b.logged ? 'i-check' : 'i-calendar'), b.label)
        : h('button', { class: 'py-begin-btn glass-coral', type: 'button', onclick: b.repeat ? repeatPlan : b.plan ? onPlan : begin }, b.label),
      b.change ? h('p', { class: 'py-caption' }, h('button', { class: 'link', type: 'button', id: 'py-change-plan', onclick: () => onPlan() }, 'Change days, time or place')) : null,
      b.caption ? h('p', { class: 'py-caption' }, b.caption) : null,
      // After a log or on a day between planned workouts: the next stop and Pengu's next goal.
      r && ahead ? h('div', { class: 'py-onward' }, goalRow(), windowButton()) : r && S.logPreview().kind !== 'planned' ? onward() : null));
  root.append(view);

  // Roll the train in from where it stood, if a log just happened.
  const train = view.querySelector('.py-train');
  const at = r ? r.trainAt / r.stations.length : 0;
  if (pending && lastAt !== null && lastAt !== at) {
    const toLeft = train.offsetLeft;
    train.style.setProperty('--at', String(lastAt));
    const fromLeft = train.offsetLeft;
    train.style.setProperty('--at', String(at));
    rollTrain(train, fromLeft - toLeft, { wheelPx: 19 * (train.offsetHeight / 168), onArrive: () => setTimeout(() => arrive(view), 0) });
  } else if (pending) {
    setTimeout(() => arrive(view), 0);
  }
  lastAt = at;

  bound.push(bindPengu(train.querySelector('svg'), { follow: true, hop: true, wave: true }));
  bound.push(bindPengu(view.querySelector('.py-avatar-btn svg'), { follow: true, hop: false }));
  if (focus || requestFocus) { requestFocus = false; count.focus({ preventScroll: true }); }
  if (focus === 'first-plan') setTimeout(() => openInvite(monday), reducedMotion() ? 0 : 350);
  if (!faceNodes.has(faceKey())) whenIdle(primeRewardArt);
}
