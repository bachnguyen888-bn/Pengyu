// Today, top to bottom: the greeting and this week from Monday to Sunday; the black "New day, fresh
// start!" card with the one action, Begin; Pengu's train on this week's route, with the week streak
// beside it; "Workouts this week: X of N"; Fish and the next unlock; and this week's workouts as sunny
// session cards. With no plan yet, the Monday plan flow takes the place of everything below the week.
// No penalties, no shame: a missed day only means fewer Fish, and the first planned workout after a
// miss earns a Comeback stamp.

import * as S from './state.js';
import { downloadIcs } from './ics.js';
import { renderPlanFlow, takeFocusRequest, resetPlanDraft } from './plan.js';
import { h, icon, weekday, monthDay, clock } from './ui.js';
import { penguFigure, trainFigure, glyph } from './art.js';
import { countTo, toast as fxToast } from '../fx.js';

const toast = (title, sub) => fxToast(title, sub, penguFigure(S.look(), { cls: 'py-toast-art', view: 'bust' }));

let moving = '';        // the workout whose "move to" picker is open
let lastTrainAt = null; // where the train was drawn last, so a log can roll it forward
let lastFish = null;    // the balance drawn last, so the counter only runs when it changes
let drawnFor = '';      // the save those were drawn for: after a reset everything starts afresh
let focusMove = false;
let rerenderRef = () => {};

export function greeting(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 12) return 'good morning.';
  if (hour >= 12 && hour < 17) return 'good afternoon.';
  return 'good evening.';
}

const SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const SAY = { done: 'done', today: 'planned for today', upcoming: 'planned', missed: 'not logged' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// "After school · 3:30 PM · at the gym", or "4:00 PM · at the pool" for a time picked by hand.
const when = (plan) => `${plan.window.startsWith('at ') ? clock(plan.time) : `${cap(plan.window)} · ${clock(plan.time)}`} · ${plan.place}`;

// 1. Monday to Sunday: today boxed; a planned day has a dot, filled when done and empty when missed.
function weekStrip(r) {
  const monday = S.thisWeek();
  const status = (d) => r && (r.stations.find((s) => s.day === d) || {}).status;
  return h('ol', { class: 'py-strip', 'aria-label': `This week, ${monthDay(S.parseKey(monday))} to ${monthDay(S.parseKey(S.addDays(monday, 6)))}` },
    S.weekDays(monday).map((d, i) => {
      const date = S.parseKey(d);
      const st = status(d);
      const now = d === S.today();
      return h('li', { class: `py-strip-day${now ? ' is-now' : ''}${st ? ` is-${st}` : ''}`, 'aria-current': now ? 'date' : false },
        h('span', { class: 'py-strip-name', 'aria-hidden': 'true' }, SHORT[i]),
        h('span', { class: 'py-strip-date', 'aria-hidden': 'true' }, String(date.getDate())),
        h('span', { class: 'py-strip-dot', 'aria-hidden': 'true' }),
        h('span', { class: 'sr-only' }, `${weekday(date)} ${monthDay(date)}${st ? `: ${SAY[st]}` : ''}`));
    }));
}

function goal(r) {
  const need = r.target - r.done;
  if (need <= 0) return { text: 'You hit your week', tone: 'hit' };
  if (r.open >= need) return { text: `${need} more to hit your week`, tone: 'goal' };
  if (r.open > 0) return { text: `Each planned workout left still pays ${S.FISH.station} Fish`, tone: 'calm' };
  return { text: 'A new route starts Monday', tone: 'calm' };
}

// 2. Begin logs today's workout: one tap, once a day, any workout of any length.
function logNow() {
  const res = S.logWorkout();
  if (!res) return;
  const got = res.extra ? ` You collected the ${res.extra.name} (looks only).` : '';
  if (res.comeback) {
    const parts = [res.fish && `${res.fish} for the workout`, `${res.comeback} for your Comeback stamp`, res.bonus && `${res.bonus} for the full week`].filter(Boolean);
    toast(`Welcome back! +${res.fish + res.comeback + res.bonus} Fish`, `${parts.join(', ')}.${got}`);
  } else if (res.kind === 'extra') toast('Extra workout logged', `Extras pay no Fish.${got || ' You’ve collected every extra, and this still counts for you.'}`);
  else if (res.bonus) toast(`You hit your week! +${res.fish + res.bonus} Fish`, `${res.fish} for the workout and ${res.bonus} for the full week. Week streak: ${S.weekStreak()}.`);
  else toast(`Workout logged. +${res.fish} Fish`, `${goal(S.route()).text}.${res.movedFrom ? ` Your ${weekday(S.parseKey(res.movedFrom))} workout moved to today.` : ''}`);
  document.querySelector('.py-count')?.focus({ preventScroll: true });
}

function beginCard(r) {
  const p = S.logPreview();
  const card = h('section', { class: 'py-begin', 'aria-labelledby': 'py-begin-title' },
    h('h2', { class: 'py-begin-title', id: 'py-begin-title' }, 'New day, fresh start!'));
  if (p.kind === 'logged') {
    const log = S.state.log[S.today()];
    card.append(
      h('p', { class: 'py-begin-note' }, log.kind === 'extra' ? 'Extra workout logged. Extras pay no Fish, just looks.' : r.hit ? 'You hit your week. Anything more this week is an extra.' : 'See you at your next workout.'),
      h('p', { class: 'py-begin-done' }, icon('i-check'), 'Logged today'));
    return card;
  }
  const comeback = p.comeback ? ` Coming back after a missed day adds ${S.FISH.comeback} more and a Comeback stamp.` : '';
  let note = `Your planned workouts are done. Begin logs an extra: no Fish${p.extra ? `, just the ${p.extra.name}` : ''}.`;
  if (p.kind === 'planned') note = `Today: ${when(r.plan)}. Begin logs it for ${S.FISH.station} Fish.${comeback}`;
  else if (p.kind === 'moved') note = `Today isn’t on your plan, so Begin moves your ${weekday(S.parseKey(p.from))} workout here, for ${S.FISH.station} Fish.${comeback}`;
  card.append(
    h('p', { class: 'py-begin-note', id: 'py-begin-note' }, note),
    h('button', { class: 'py-begin-btn', type: 'button', 'aria-describedby': 'py-begin-note', onclick: logNow }, 'Begin'));
  return card;
}

function celebrate() {
  const log = S.state.log[S.today()];
  if (!log || !log.comeback) return null;
  return h('div', { class: 'py-celebrate', role: 'status' },
    penguFigure(S.look(), { cls: 'py-celebrate-art is-cheer' }),
    h('div', {},
      h('p', { class: 'py-celebrate-title' }, 'Welcome back! Comeback stamp earned.'),
      h('p', { class: 'small' }, `That’s ${S.FISH.comeback} bonus Fish. Pengu’s glad to ride with you again.`)));
}

// 3. The train is the progress: each planned workout is a station, and Pengu's cab waits at the last one done.
function stationNode(s, i, count) {
  const date = S.parseKey(s.day);
  const stamped = Boolean(S.state.log[s.day] && S.state.log[s.day].comeback);
  const li = h('li', { class: `py-station is-${s.status}` },
    h('span', { class: 'py-stop', 'aria-hidden': 'true' }, s.status === 'done' ? icon('i-check') : null,
      stamped ? h('span', { class: `py-stamp${s.day === S.today() ? ' is-new' : ''}` }, icon('i-refresh')) : null),
    h('span', { class: 'py-stop-day', 'aria-hidden': 'true' }, s.status === 'today' ? 'Today' : weekday(date, 'short')),
    h('span', { class: 'sr-only' }, `${weekday(date)}: ${SAY[s.status]}${stamped ? ', with a Comeback stamp' : ''}`));
  li.style.setProperty('--at', String((i + 1) / count));
  return li;
}

function trainNode(r) {
  const todayLog = S.state.log[S.today()];
  const cheer = r.hit || Boolean(todayLog && todayLog.comeback);
  const train = h('div', { class: 'py-train', 'aria-hidden': 'true' }, trainFigure(S.look(), { cls: 'py-train-art', cheer }));
  const at = r.trainAt / r.stations.length;
  const from = lastTrainAt === null ? at : lastTrainAt;
  train.style.setProperty('--at', String(from));
  if (from !== at) {
    requestAnimationFrame(() => requestAnimationFrame(() => train.style.setProperty('--at', String(at))));
  }
  lastTrainAt = at;
  return train;
}

function hero(r) {
  const info = S.streakInfo();
  return h('section', { class: 'py-hero', 'aria-labelledby': 'py-hero-title' },
    h('h2', { class: 'sr-only', id: 'py-hero-title' }, 'Your route this week'),
    h('div', { class: 'py-hero-top' },
      h('p', { class: 'py-streak' }, 'Week streak', h('span', { class: 'py-streak-n' }, String(info.streak))),
      h('p', { class: 'py-cover' }, icon('i-shield'), info.coverReady ? 'Free streak cover ready this month' : 'Free streak cover used this month')),
    h('div', { class: `py-route-wrap${S.look().car ? ' has-car2' : ''}` },
      h('ol', { class: 'py-route', 'aria-label': 'Stations' },
        h('li', { class: 'py-depot', 'aria-hidden': 'true' }),
        r.stations.map((s, i) => stationNode(s, i, r.stations.length))),
      trainNode(r)));
}

// 5. Fish, and the next unlock with its fixed price: gear in its set order, then the train upgrades.
const nextUnlock = () => S.nextGear() || S.TRAIN.find((t) => !S.owns(t.id)) || null;
// Pengu shown wearing the next piece of gear, as a preview of what it unlocks.
function gearPreview(id) {
  if (id === 'scarf') return { scarf: true };
  if (id === 'cap') return { hat: 'cap', outfit: false };
  if (id === 'backpack') return { backpack: true };
  return { outfit: true, hat: 'conductor' };
}

function fishBox(onShop) {
  const fishN = h('span', { class: 'py-fish-n' });
  const box = h('section', { class: 'py-fishbox', 'aria-labelledby': 'py-fish-title' },
    h('h2', { class: 'sr-only', id: 'py-fish-title' }, 'Fish and your next unlock'),
    h('p', { class: 'py-fish' }, icon('i-fish'), fishN, h('span', {}, 'Fish')));
  const u = nextUnlock();
  if (!u) {
    box.append(h('p', { class: 'small muted' }, 'Pengu and the train have every upgrade, and they’re yours for good.'));
    return { box, fishN };
  }
  const fish = S.state.fish.balance;
  const st = S.unlockStatus(u.id);
  const fill = h('span', { class: 'py-bar-fill' });
  fill.style.setProperty('--p', `${Math.min(100, Math.round((fish / u.price) * 100))}%`);
  const gear = S.GEAR.some((g) => g.id === u.id);
  box.append(h('div', { class: 'py-next' },
    h('span', { class: 'py-next-art', 'aria-hidden': 'true' }, gear ? penguFigure({ ...S.look(), ...gearPreview(u.id) }, { view: 'bust' }) : glyph(u.id)),
    h('div', { class: 'py-next-text' },
      h('p', { class: 'stat-label' }, 'Next unlock'),
      h('p', { class: 'py-next-name' }, `${u.name} · ${u.price} Fish`),
      h('span', { class: 'py-bar', role: 'progressbar', 'aria-label': `Fish saved toward the ${u.name}`, 'aria-valuemin': '0', 'aria-valuemax': String(u.price), 'aria-valuenow': String(Math.min(fish, u.price)) }, fill),
      h('p', { class: 'small muted' }, st.state === 'ready' ? 'You can unlock it now. ' : `${st.short} more to go. `,
        h('button', { class: 'link', type: 'button', onclick: onShop }, 'See all upgrades')))));
  return { box, fishN };
}

// This week's workouts. Moving one to another free day has no penalty.
function sessionCard(s, plan) {
  const date = S.parseKey(s.day);
  const stamped = Boolean(S.state.log[s.day] && S.state.log[s.day].comeback);
  const label = { done: 'Done', today: 'Today', upcoming: 'Planned', missed: 'Not logged' }[s.status];
  return h('li', { class: `py-session is-${s.status}` },
    h('span', { class: 'py-session-day', 'aria-hidden': 'true' },
      h('span', { class: 'py-session-dow' }, weekday(date, 'short')), h('span', { class: 'py-session-date' }, String(date.getDate()))),
    h('div', { class: 'py-session-text' },
      h('p', { class: 'py-session-name' }, `${weekday(date)}, ${monthDay(date)}`),
      h('p', { class: 'py-session-when' }, when(plan))),
    h('div', { class: 'py-session-side' },
      h('p', { class: 'py-session-status' }, s.status === 'done' ? icon('i-check') : null, label, stamped ? h('span', { class: 'sr-only' }, ', with a Comeback stamp') : null),
      S.canMove(s.day) ? h('button', {
        class: 'link py-session-move', type: 'button', 'aria-expanded': String(moving === s.day), 'aria-label': `Move ${weekday(date)}’s workout`,
        onclick: () => { moving = moving === s.day ? '' : s.day; focusMove = Boolean(moving); rerenderRef(); },
      }, 'Move') : null));
}

function movePicker() {
  if (!moving || !S.canMove(moving)) { moving = ''; return null; }
  const targets = S.moveTargets(moving);
  return h('div', { class: 'py-move', role: 'group', 'aria-labelledby': 'py-move-title' },
    h('p', { class: 'py-move-title', id: 'py-move-title' }, `Move ${weekday(S.parseKey(moving))}’s workout to:`),
    targets.length ? null : h('p', { class: 'small muted' }, 'No free days are left this week.'),
    h('div', { class: 'py-choices' },
      targets.map((d) => h('button', {
        class: 'chip', type: 'button',
        onclick: () => {
          const from = moving;
          moving = '';
          if (S.moveStation(from, d)) toast(`Moved to ${weekday(S.parseKey(d))}`, 'No penalty. You can update your calendar file below.');
        },
      }, d === S.today() ? 'Today' : `${weekday(S.parseKey(d), 'short')} ${monthDay(S.parseKey(d))}`)),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { moving = ''; rerenderRef(); } }, 'Keep it')));
}

function calendarRow(plan) {
  const fresh = plan.icsSeq === undefined;
  const stale = !fresh && plan.icsSeq !== plan.moves.length;
  const get = () => { downloadIcs(); S.markCalendarSaved(); };
  return h('p', { class: 'py-cal' }, icon('i-clock'),
    h('span', {},
      fresh ? 'Want a reminder 15 minutes before each workout? ' : stale ? 'You moved a workout, so your calendar still has the old day. ' : 'Reminders are in your calendar. ',
      h('button', { class: 'link', type: 'button', onclick: get }, fresh ? 'Add to my calendar (.ics)' : stale ? 'Get the updated file (.ics)' : 'Download it again')));
}

export function renderToday(root, rerender, { onShop = () => {} } = {}) {
  rerenderRef = rerender;
  if (drawnFor !== S.state.createdAt) {
    drawnFor = S.state.createdAt;
    lastFish = null; lastTrainAt = null; moving = '';
    resetPlanDraft();
  }
  const r = S.route();
  const view = h('div', { class: 'py-today' },
    h('header', { class: 'py-head' }, h('h1', { class: 'py-greet' }, greeting()), weekStrip(r)));
  root.append(view);
  if (!r) { renderPlanFlow(view, rerender); return; }

  const focusCount = takeFocusRequest();
  const g = goal(r);
  const count = h('h2', { class: 'py-count', tabindex: '-1' }, 'Workouts this week: ', h('span', { class: 'py-count-n' }, `${r.done} of ${r.target}`));
  const { box, fishN } = fishBox(onShop);
  view.append(...[
    beginCard(r),
    celebrate(),
    hero(r),
    h('div', { class: 'py-tally' }, count, h('p', { class: `py-goal is-${g.tone}` }, g.text)),
    box,
    h('section', { class: 'py-sessions', 'aria-labelledby': 'py-sessions-title' },
      h('h2', { class: 'py-section-title', id: 'py-sessions-title' }, 'This week’s workouts'),
      h('ul', { class: 'py-session-list' }, r.stations.map((s) => sessionCard(s, r.plan))),
      movePicker(),
      calendarRow(r.plan)),
  ].filter(Boolean));
  fishN.dataset.value = String(lastFish === null ? S.state.fish.balance : lastFish);
  countTo(fishN, S.state.fish.balance);
  lastFish = S.state.fish.balance;
  if (focusCount) count.focus({ preventScroll: true });
  if (moving && focusMove) {
    focusMove = false;
    view.querySelector('.py-move .chip, .py-move .btn')?.focus({ preventScroll: true });
  }
}
