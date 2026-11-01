// Today, exactly: the Fish pill and Pengu's avatar; "good evening."; the stage, with Pengu's train on this
// week's route, "Workouts this week: X of N" and one big Begin. Begin logs in one tap: the train rolls to
// its station, the ring fills, the count and Fish update, Pengu celebrates and the sunny reward sheet
// rises. Tapping the route opens the week sheet (sessions, moves, the calendar file and the cover).
// Planned ahead on Sunday, the stage shows next week's route: "Your route starts Monday."
// No penalties and no shame: a day without a workout just reads "not logged".

import * as S from './state.js';
import { downloadIcs } from './ics.js';
import { h, icon, weekday, monthDay, clock } from './ui.js';
import { penguFigure, trainFigure, faceFigure } from './art.js';
import { bindPengu, rollTrain, fillStation, sheetIn, sheetOut, rise, reducedMotion } from './motion.js';
import { wobblyLine, ring, check, softRect } from './ink.js';
import { countTo, toast as fxToast } from '../fx.js';
import { tipWanted, saveBackup } from './backup.js';

const NS = 'http://www.w3.org/2000/svg';
let pending = null;   // a log in flight: what the screen showed before Begin, then what it paid
let lastAt = null;    // where the train stood when Today was last drawn (0 = depot, 1 = last station)
let drawnFor = '';    // the save those were drawn for: after a reset everything starts afresh
let bound = [];       // the Pengu drawings brought to life on this screen
let moving = '';      // the session whose "move to" chips are open in the week sheet
let refs = { onShop() {}, onPlan() {} };

const SAY = { done: 'done', today: 'planned for today', upcoming: 'planned', missed: 'not logged' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// "After class · 3:30 PM · at the gym", or "4:00 PM · at the pool" for a time picked by hand.
const when = (plan) => `${plan.window.startsWith('at ') ? clock(plan.time) : `${cap(plan.window)} · ${clock(plan.time)}`} · ${plan.place}`;
const ifThen = (plan) => `${cap(plan.window)} · ${plan.place}`;
const toast = (title, sub) => fxToast(title, sub, penguFigure(S.look(), { cls: 'py-toast-art', pose: 'bust' }));
const night = () => { const hr = S.now().getHours(); return hr >= 19 || hr < 6; };
const nextUnlock = () => S.nextGear() || S.TRAIN.find((t) => !S.owns(t.id)) || null;

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

function goal(r) {
  const need = r.target - r.done;
  if (need <= 0) return { text: 'You hit your week.', calm: false };
  if (r.open >= need) return { text: `${need} more to hit your week`, calm: false };
  if (r.open > 0) return { text: `Every planned workout left still pays ${S.FISH.station} Fish.`, calm: true };
  return { text: 'A new route starts Monday.', calm: true };
}

// What Begin says, and the quiet caption under it.
function beginState(r, ahead) {
  if (!r) return { label: 'Plan my week', caption: 'Takes about 30 seconds.', plan: true };
  if (ahead) return { label: `First stop: ${weekday(S.parseKey(r.stations[0].day))}`, waiting: true, caption: ifThen(r.plan) };
  const p = S.logPreview();
  if (p.kind === 'logged') {
    const next = r.stations.find((s) => s.status === 'upcoming');
    return { label: 'Logged today', logged: true, caption: r.hit ? 'You hit your week.' : next ? `See you ${weekday(S.parseKey(next.day))}.` : 'See you Monday.' };
  }
  if (p.comeback) return { label: 'Begin', caption: 'Welcome back. This one earns a Comeback stamp.' };
  if (p.kind === 'planned') return { label: 'Begin', caption: ifThen(r.plan) };
  if (p.kind === 'moved') return { label: 'Begin', caption: `Counts for ${weekday(S.parseKey(p.from))}’s station.` };
  return { label: 'Begin', caption: 'Extra ride: looks only, no Fish.' };
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
    h('span', { class: 'py-stop-day', 'aria-hidden': 'true' }, s.status === 'today' ? 'Today' : weekday(date, 'short')),
    stamped ? h('span', { class: `py-stamp${arriving ? ' is-new' : ''}`, 'aria-hidden': 'true' }, icon('i-stamp')) : null,
    h('span', { class: 'sr-only' }, `${weekday(date)}: ${SAY[s.status]}${stamped ? ', with a Comeback stamp' : ''}`));
  li.style.setProperty('--at', String((i + 1) / count));
  return li;
}

function routeBlock(r, look, arriving, ahead) {
  const ties = Array.from({ length: 30 }, (_, i) => `M${18 + i * 33.5 + (i % 3) * 1.4} ${1.4 + (i % 2) * 0.5}V${6.6 - (i % 4) * 0.4}`).join('');
  const wrap = h('div', { class: `py-route-wrap${look.car ? ' has-car2' : ''}` },
    lineArt('py-rail', '0 0 1000 8', `<path d="${wobblyLine(0, 1000, 4, { seed: 5, amp: 0.7, step: 64 })}"/><path d="${ties}"/>`, true),
    lineArt('py-route-line', '0 0 1000 6', `<path d="${wobblyLine(0, 1000, 3, { seed: 9, amp: 0.9, step: 72 })}"/>`, true),
    h('ol', { class: 'py-route', 'aria-label': !r ? 'No stations yet' : ahead ? 'Stations next week' : 'Stations this week' },
      h('li', { class: 'py-depot', 'aria-hidden': 'true' }, lineArt('py-depot-art', '0 0 14 14', `<path d="${softRect(1, 1, 12, 12, 3, { seed: 4, amp: 0.5 })}"/>`)),
      r ? r.stations.map((s, i) => stationNode(s, i, r.stations.length, arriving === s.day)) : null));
  wrap.querySelector('.py-depot').style.setProperty('--at', '0');
  const train = h('div', { class: 'py-train', 'aria-hidden': 'true' }, trainFigure(look, { cls: 'py-train-svg', night: night() }));
  train.style.setProperty('--at', String(r ? r.trainAt / r.stations.length : 0));
  wrap.append(train);
  if (r) wrap.append(h('button', { class: 'py-route-open', type: 'button', 'aria-label': 'This week’s workouts: move a day or add reminders', onclick: openWeek }));
  return wrap;
}

// ---------- Begin ----------
function begin() {
  const r0 = S.route();
  const p = S.logPreview();
  pending = { before: { fish: S.state.fish.balance, count: r0 ? r0.done : 0, goal: r0 ? goal(r0) : null }, arriving: p.kind === 'planned' || p.kind === 'moved' };
  try { if (navigator.vibrate) navigator.vibrate(10); } catch { /* no haptics here */ }
  const res = S.logWorkout();   // Today re-renders right away and rolls the train in from where it stood
  if (!res) { pending = null; return; }
  pending.res = res;
}

function arrive(view) {
  const p = pending;
  pending = null;
  if (!p || !p.res || !view.isConnected) return;
  const r = S.route();
  const st = view.querySelector('.py-station.is-arriving');
  if (st) { st.classList.remove('is-arriving'); fillStation(st); }
  if (r) {
    view.querySelector('.py-count-n').textContent = `${r.done} of ${r.target}`;
    const g = goal(r);
    const line = view.querySelector('.py-goal');
    line.textContent = g.text;
    line.classList.toggle('is-calm', g.calm);
  }
  const fishN = view.querySelector('.py-fish-n');
  countTo(fishN, S.state.fish.balance);
  view.querySelector('.py-fishpill').setAttribute('aria-label', `${S.state.fish.balance} Fish`);
  // Pengu celebrates on the next frame. The sheet's art is usually drawn already (at idle time); if
  // Begin came first, it is drawn in the quiet moment after arrival.
  requestAnimationFrame(() => { if (bound[0]) bound[0].celebrate(); });
  setTimeout(primeRewardArt, 320);
  const res = p.res;
  const total = res.fish + res.bonus + res.comeback;
  announce(res.kind === 'extra'
    ? `Extra ride logged. No Fish.${res.extra ? ` You collected the ${res.extra.name}.` : ''}`
    : `Workout logged. ${r.done} of ${r.target}.${res.comeback ? ' Comeback stamp.' : ''}${r.hit ? ' You hit your week.' : ''} Plus ${total} Fish.`);
  setTimeout(() => openReward(res), reducedMotion() ? 0 : 600);
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
  const close = () => closeSheet();
  build(panel, close);
  document.body.append(dlg);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  // Keep Tab inside the sheet: from the last control back to the first, and the other way round.
  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...panel.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])')];
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
  panel.addEventListener('pointerdown', (e) => { if (e.target.closest('button, a, input') || panel.scrollTop > 0) return; startY = e.clientY; dy = 0; });
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
  let title = 'Station filled.';
  const moved = res.movedFrom ? `${weekday(S.parseKey(res.movedFrom))}’s station moved to today.` : '';
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
    title = 'Extra ride logged.';
    lines.push(res.extra ? `No Fish. You collected the ${res.extra.name} (looks only).` : 'No Fish. You have every extra, and it still counts.');
  } else {
    lines.push(moved ? `${moved} +${res.fish} Fish` : `+${res.fish} Fish`);
  }
  const u = nextUnlock();
  const st = u && S.unlockStatus(u.id);
  return { title, lines, stamp: Boolean(res.comeback), next: !u ? 'Pengu has every upgrade.' : st.state === 'ready' ? `${u.name} is ready to unlock` : `${u.name} · ${st.short} more Fish`, link: Boolean(u) };
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

function openReward(res) {
  const copy = rewardCopy(res);
  openSheet('py-reward', 'py-reward-title', (panel, close) => {
    panel.append(...[
      h('h2', { class: 'py-reward-title', id: 'py-reward-title' }, copy.title),
      copy.stamp ? stampArt() : null,
      h('ul', { class: 'py-reward-lines' }, copy.lines.map((l) => h('li', { class: 'num' }, l))),
      h('p', { class: 'py-reward-next' }, copy.next, copy.link ? ' · ' : '', copy.link ? h('button', { class: 'link', type: 'button', onclick: () => { close(); refs.onShop(); } }, 'See Pengu') : null),
      h('button', { class: 'btn glass-coral py-reward-ok', type: 'button', autofocus: true, onclick: close }, 'Nice'),
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
    panel.append(
      h('div', { class: 'py-tip-head' },
        h('h2', { class: 'py-tip-title', id: 'py-tip-title' }, 'Keep Pengu safe: add Pengyu to your Home Screen.'),
        penguFigure(S.look(), { cls: 'py-tip-art', pose: 'bust' })),
      h('ol', { class: 'py-tip-steps' },
        h('li', {}, h('span', { class: 'py-tip-n', 'aria-hidden': 'true' }, '1'), h('span', {}, 'Tap ', icon('i-share', 'icon py-tip-share'), h('strong', {}, 'Share'), ' in Safari.')),
        h('li', {}, h('span', { class: 'py-tip-n', 'aria-hidden': 'true' }, '2'), h('span', {}, 'Choose ', h('strong', {}, 'Add to Home Screen'), '.'))),
      h('p', { class: 'py-tip-note' }, 'Already have progress here? Save a backup, then restore it in the Home Screen app.'),
      h('div', { class: 'py-tip-actions' },
        h('button', { class: 'btn glass-coral', type: 'button', onclick: () => { saveBackup(); status.textContent = 'Backup saved. Keep the file somewhere safe.'; } }, 'Save a backup'),
        h('button', { class: 'btn btn-ghost', type: 'button', autofocus: true, onclick: close }, 'Got it')),
      status);
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
          if (S.moveStation(from, d)) toast(`Moved to ${weekday(S.parseKey(d))}. No penalty.`, '');
          refill();
        },
      }, d === S.today() ? 'Today' : `${weekday(S.parseKey(d), 'short')} ${monthDay(S.parseKey(d))}`)),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { moving = ''; refill(); } }, 'Keep it')));
}

function calendarNote(plan, monday, refill) {
  const fresh = plan.icsSeq === undefined;
  const stale = !fresh && plan.icsSeq !== plan.moves.length;
  const get = () => { downloadIcs(monday); S.markCalendarSaved(monday); refill(); };
  return h('p', { class: 'py-sheet-note' }, icon('i-calendar'),
    h('button', { class: 'link', type: 'button', onclick: get },
      fresh ? 'Add reminders to my calendar (.ics)' : stale ? 'You moved a workout. Get the updated file (.ics).' : 'Download again'));
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
        h('button', { class: 'py-sheet-close glass', type: 'button', 'aria-label': 'Close', onclick: close }, icon('i-close'))),
      h('ul', { class: 'py-session-list' }, r.stations.map((s) => sessionCard(s, r.plan, refill))),
      movePicker(refill),
      calendarNote(r.plan, monday, refill),
      h('p', { class: 'py-sheet-note' }, icon('i-shield'), info.coverReady ? 'Free cover ready this month.' : 'Free cover used this month.'),
    ].filter(Boolean));
  }, () => document.querySelector('.py-route-open'));
}

// ---------- The screen ----------
export function renderToday(root, rerender, { onShop = () => {}, onPlan = () => {}, focus = false } = {}) {
  refs = { onShop, onPlan };
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
  const g = r && !ahead ? (before && before.goal ? before.goal : goal(r)) : null;
  let countText = 'No stations yet this week.';
  if (r && ahead) countText = 'Your route starts Monday.';
  else if (r) countText = ['Workouts this week: ', h('span', { class: 'py-count-n' }, `${before ? before.count : r.done} of ${r.target}`)];
  const count = h('h2', { class: 'py-count', id: 'py-count', tabindex: '-1' }, countText);
  const streak = S.weekStreak();

  const view = h('div', { class: 'py-today' },
    h('div', { class: 'py-topbar' },
      h('p', { class: 'py-fishpill glass', 'aria-label': `${shownFish} Fish` }, icon('i-fish'), fishN),
      h('button', { class: 'py-avatar-btn glass-pink', type: 'button', 'aria-label': 'Open Pengu', onclick: onShop }, penguFigure(look, { pose: 'bust' }))),
    h('h1', { class: 'py-greet' }, S.greeting()),
    h('section', { class: 'py-stage', 'aria-labelledby': 'py-count' },
      streak >= 1 ? h('p', { class: 'py-streak-chip' }, 'Week streak ', h('strong', {}, String(streak))) : null,
      routeBlock(r, look, before && pending.arriving ? S.today() : '', ahead),
      h('div', {}, count, g ? h('p', { class: `py-goal${g.calm ? ' is-calm' : ''}` }, g.text) : null),
      b.logged || b.waiting
        ? h('button', { class: 'py-begin-btn is-logged', type: 'button', 'aria-disabled': 'true' }, icon(b.logged ? 'i-check' : 'i-calendar'), b.label)
        : h('button', { class: 'py-begin-btn glass-coral', type: 'button', onclick: b.plan ? onPlan : begin }, b.label),
      h('p', { class: 'py-caption' }, b.caption)));
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
  if (focus) count.focus({ preventScroll: true });
  if (!faceNodes.has(faceKey())) whenIdle(primeRewardArt);
}
