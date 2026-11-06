// The Monday plan: how many workouts, which days, when and where, in about 30 seconds. Four quick steps
// on a full-screen paper view, then a sunny summary with the if-then plan. Every step starts from the
// last plan, so a returning player is done in a few taps. With fewer than two days left in the week
// (Sunday), it plans next week instead: "Your route starts Monday."

import * as S from './state.js';
import { downloadIcs } from './ics.js';
import { h, icon, weekday, monthDay, clock } from './ui.js';

const TIMES = [
  { id: 'before', label: 'Before class', time: '07:00', window: 'before class' },
  { id: 'after', label: 'After class', time: '15:30', window: 'after class' },
  { id: 'evening', label: 'Evening', time: '18:00', window: 'in the evening' },
];
const PLACES = [
  { id: 'gym', label: 'Gym', place: 'at the gym' },
  { id: 'home', label: 'Home', place: 'at home' },
  { id: 'outside', label: 'Outside', place: 'outside' },
  { id: 'rec', label: 'Rec center', place: 'at the rec center' },
];
const STEPS = 4;   // then the summary

let draft = null;        // kept across re-renders (a new minute, a returning tab)
let moveFocus = false;   // the step title takes focus after a step changes
let refocusKey = '';     // the control that was just pressed, refocused after a re-render

const dow = (key) => (S.parseKey(key).getDay() + 6) % 7;   // Monday 0 … Sunday 6

// Start from the last plan: the same number, the same weekdays where they are still open, the same
// time and place.
function startDraft() {
  const week = S.planningWeek();
  const open = S.openDays(week);
  const d = { week, step: 1, target: 0, days: [], timeId: '', customTime: '16:00', placeId: '', customPlace: '', icsFor: '', fromLast: false };
  const last = S.lastPlanBefore(week);
  if (!last) return d;
  d.fromLast = true;
  d.target = Math.max(S.TARGETS[0], Math.min(last.target, open.length));
  d.days = open.filter((x) => last.days.some((y) => dow(y) === dow(x))).slice(0, d.target);
  const time = !last.window.startsWith('at ') && TIMES.find((t) => t.time === last.time);
  if (time) d.timeId = time.id; else { d.timeId = 'custom'; d.customTime = last.time; }
  const place = PLACES.find((p) => p.place === last.place);
  if (place) d.placeId = place.id; else { d.placeId = 'custom'; d.customPlace = last.place.replace(/^at\s+/i, ''); }
  return d;
}
// After a reset or a restore, the flow starts again from what is saved now.
export function resetPlanDraft() { draft = null; }

function timeChoice() {
  if (draft.timeId === 'custom') return /^\d{2}:\d{2}$/.test(draft.customTime) ? { time: draft.customTime, window: `at ${clock(draft.customTime)}` } : null;
  const t = TIMES.find((x) => x.id === draft.timeId);
  return t ? { time: t.time, window: t.window } : null;
}
function placeChoice() {
  if (draft.placeId === 'custom') {
    const text = draft.customPlace.trim().replace(/^at\s+/i, '');
    if (!text) return null;
    const same = PLACES.find((p) => p.label.toLowerCase() === text.toLowerCase());
    return same ? same.place : `at ${text}`;
  }
  const p = PLACES.find((x) => x.id === draft.placeId);
  return p ? p.place : null;
}
function ready(step = draft.step) {
  if (step === 1) return S.TARGETS.includes(draft.target);
  if (step === 2) return draft.days.length === draft.target;
  if (step === 3) return Boolean(timeChoice());
  if (step === 4) return Boolean(placeChoice());
  return [1, 2, 3, 4].every((n) => ready(n));
}
function planDraft() {
  const t = timeChoice();
  return { week: draft.week, target: draft.target, days: [...draft.days].sort(), time: t.time, window: t.window, place: placeChoice() };
}
const fileKey = (p) => JSON.stringify([p.days, p.time, p.window, p.place]);

// "If it’s Tuesday, Thursday or Saturday after class, I work out at the gym."
function sentence(p) {
  const names = p.days.map((d) => weekday(S.parseKey(d)));
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0];
  return `If it’s ${list} ${p.window}, I work out ${p.place}.`;
}

function chip(key, label, pressed, onclick, extra = {}) {
  return h('button', { class: 'chip glass py-chip', type: 'button', 'data-key': key, 'aria-pressed': String(pressed), onclick, ...extra }, label);
}

export function renderPlanFlow(root, rerender, { onExit = () => {} } = {}) {
  if (!draft || draft.week !== S.planningWeek()) draft = startDraft();
  const ahead = draft.week !== S.thisWeek();
  const open = S.openDays(draft.week);
  const go = (step) => { draft.step = step; moveFocus = true; rerender(); };
  const set = (patch) => { refocusKey = document.activeElement?.dataset?.key || ''; Object.assign(draft, patch); rerender(); };
  const onSummary = draft.step > STEPS;

  let title = '';
  let hint = '';
  let body = null;
  if (draft.step === 1) {
    title = ahead ? 'How many workouts next week?' : 'How many workouts this week?';
    hint = ahead ? 'Your route starts Monday. Any workout, any length, counts.' : 'Any workout, any length, counts. Pick a number you can keep.';
    body = h('div', { class: 'py-targets', role: 'group', 'aria-labelledby': 'py-step-title' },
      S.TARGETS.map((n) => chip(`t${n}`,
        h('span', { class: 'py-target' }, h('strong', { class: 'num' }, String(n)), ' ', h('small', {}, 'workouts')),
        draft.target === n,
        () => set({ target: n, days: draft.days.slice(0, n) }),
        { disabled: n > open.length })));
  } else if (draft.step === 2) {
    title = 'Which days?';
    hint = `Pick ${draft.target}. You can move one later, with no penalty.`;
    const full = draft.days.length >= draft.target;
    body = h('div', { class: 'py-step-body' },
      h('div', { class: 'py-days', role: 'group', 'aria-labelledby': 'py-step-title' },
        S.weekDays(draft.week).map((d) => {
          const date = S.parseKey(d);
          const picked = draft.days.includes(d);
          const isToday = d === S.today();
          return chip(d,
            h('span', { class: 'py-day-chip' }, h('span', {}, weekday(date, 'short')), ' ', h('small', {}, isToday ? 'Today' : monthDay(date))),
            picked,
            () => set({ days: picked ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort() }),
            { disabled: !open.includes(d) || (!picked && full) });
        })),
      h('p', { class: 'py-counter', 'aria-live': 'polite' }, `${draft.days.length} of ${draft.target} picked`));
  } else if (draft.step === 3) {
    title = 'When?';
    hint = 'If you add the calendar file, your calendar reminds you 15 minutes before.';
    const custom = draft.timeId === 'custom';
    body = h('div', { class: 'py-step-body' },
      h('div', { class: 'py-grid2', role: 'group', 'aria-labelledby': 'py-step-title' },
        TIMES.map((t) => chip(t.id, h('span', {}, t.label, ' ', h('small', {}, clock(t.time))), draft.timeId === t.id, () => set({ timeId: t.id }))),
        chip('custom-time', 'Pick a time', custom, () => set({ timeId: 'custom' }))),
      custom ? h('div', { class: 'field py-custom' },
        h('label', { for: 'py-time' }, 'Time'),
        h('input', { class: 'input', id: 'py-time', type: 'time', value: draft.customTime, required: true, oninput: (e) => { draft.customTime = e.target.value; next.disabled = !ready(); } })) : null);
  } else if (draft.step === 4) {
    title = 'Where?';
    hint = 'Picture the place. It makes the plan easier to keep.';
    const custom = draft.placeId === 'custom';
    body = h('div', { class: 'py-step-body' },
      h('div', { class: 'py-grid2', role: 'group', 'aria-labelledby': 'py-step-title' },
        PLACES.map((p) => chip(p.id, p.label, draft.placeId === p.id, () => set({ placeId: p.id }))),
        chip('custom-place', 'Type a place', custom, () => set({ placeId: 'custom' }))),
      custom ? h('div', { class: 'field py-custom' },
        h('label', { for: 'py-place' }, 'Place'),
        h('input', { class: 'input', id: 'py-place', type: 'text', maxlength: '40', autocomplete: 'off', placeholder: 'the pool', value: draft.customPlace, oninput: (e) => { draft.customPlace = e.target.value; next.disabled = !ready(); } })) : null);
  } else {
    title = ahead ? 'Your route starts Monday.' : 'Your week';
    const p = planDraft();
    body = h('div', { class: 'py-summary' },
      h('p', { class: 'py-summary-plan' }, sentence(p)),
      h('ul', { class: 'py-summary-days', 'aria-label': 'Your days' },
        p.days.map((d) => h('li', {}, icon('i-check'), h('span', {}, h('strong', {}, weekday(S.parseKey(d))), ` ${monthDay(S.parseKey(d))} · ${clock(p.time)}`)))),
      h('p', { class: 'py-summary-fish' }, `Each planned workout pays ${S.FISH.station} Fish, and the full week adds ${S.FISH.weekBonus}.`));
  }
  // A returning player starts from last week's choices: say so, and that Next keeps them.
  const prefilled = draft.fromLast && !onSummary ? h('p', { class: 'py-prefill' }, 'Filled in from last week. Change anything, or tap Next.') : null;

  // Next, or on the summary: Start my week, and the calendar file before the plan is even saved.
  let next;
  let actions;
  if (!onSummary) {
    next = h('button', { class: 'btn glass-coral py-next', type: 'button', disabled: !ready(), onclick: () => { if (ready()) go(draft.step + 1); } }, 'Next');
    actions = h('div', { class: 'py-plan-actions' }, next);
  } else {
    const p = planDraft();
    const saved = draft.icsFor === fileKey(p);
    next = h('button', {
      class: 'btn glass-coral py-next', type: 'button', 'data-key': 'start',
      onclick: () => {
        if (!ready()) return;
        const plan = planDraft();
        moveFocus = true;   // Today puts focus on the count once it draws
        if (S.createPlan({ ...plan, calendar: draft.icsFor === fileKey(plan) })) draft = null;
        else moveFocus = false;
      },
    }, 'Start my week');
    // The calendar file is optional and the player's own: Pengyu never sends notifications itself.
    actions = h('div', { class: 'py-plan-actions' }, next,
      h('button', {
        class: 'btn btn-secondary py-plan-ics', type: 'button', 'data-key': 'ics',
        onclick: () => { const plan = planDraft(); downloadIcs(plan.week, { ...plan, moves: [] }); refocusKey = 'ics'; draft.icsFor = fileKey(plan); rerender(); },
      }, icon('i-calendar'), saved ? 'Download again' : 'Download calendar reminders'),
      h('p', { class: 'py-ics-note' }, saved ? 'Downloaded. Open the file and add it to your calendar.' : 'Open the downloaded file and add it to your calendar.'));
  }

  const heading = h('h1', { class: 'py-step-title', id: 'py-step-title', tabindex: '-1' }, title);
  root.append(h('div', { class: 'py-plan' },
    h('div', { class: 'py-plan-top' },
      h('button', { class: 'py-back glass', type: 'button', 'aria-label': draft.step === 1 ? 'Back to Today' : 'Back', onclick: () => (draft.step === 1 ? onExit() : go(draft.step - 1)) }, icon('i-back')),
      h('ol', { class: 'py-dots', 'aria-hidden': 'true' }, Array.from({ length: STEPS }, (_, i) => h('li', { class: i < draft.step ? 'is-on' : '' })))),
    h('div', { class: 'py-plan-head' },
      onSummary ? null : h('p', { class: 'eyebrow' }, `${ahead ? 'Next week' : 'Plan your week'} · Step ${draft.step} of ${STEPS}`),
      heading,
      hint ? h('p', { class: 'py-hint' }, hint) : null,
      prefilled),
    body,
    actions));
  if (moveFocus) { moveFocus = false; refocusKey = ''; heading.focus({ preventScroll: true }); }
  if (refocusKey) {
    const again = root.querySelector(`[data-key="${refocusKey}"]`);
    refocusKey = '';
    if (again && !again.disabled) again.focus({ preventScroll: true });
  }
}

// After a plan is made, Today takes focus instead.
export function takeFocusRequest() { const f = moveFocus; moveFocus = false; return f; }
