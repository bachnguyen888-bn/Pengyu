// The weekly plan on a full-screen paper view, in two short steps: how many workouts and which days,
// then when and where. A sunny summary with the if-then plan follows, with "Start my week". With fewer
// than two days left in the week (Sunday), it plans next week instead: "Your route starts Monday."
// A returning player first sees their last plan set on the new week ("Review last week's plan"), to
// start as it is or edit. A weekday that has passed asks for another day: nothing is filled in on the
// player's behalf, no time or place is assumed, and nothing is saved or logged before Start.

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
const STEPS = 2;    // then the summary
const REVIEW = 0;   // a returning player's first screen

let draft = null;        // kept across re-renders (a new minute, a returning tab)
let moveFocus = false;   // the step title takes focus after a step changes; Today's count after Start
let refocusKey = '';     // the control that was just pressed, refocused after a re-render

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const listOf = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || '');
const range = (monday) => `${monthDay(S.parseKey(monday))} – ${monthDay(S.parseKey(S.addDays(monday, 6)))}`;

// A saved plan's time and place, as the choices on step 2.
function choicesFrom(d, p) {
  const time = !p.window.startsWith('at ') && TIMES.find((t) => t.time === p.time);
  if (time) d.timeId = time.id; else { d.timeId = 'custom'; d.customTime = p.time; }
  const place = PLACES.find((x) => x.place === p.place);
  if (place) d.placeId = place.id; else { d.placeId = 'custom'; d.customPlace = p.place.replace(/^at\s+/i, ''); }
}

// A first plan starts empty. A returning player starts from the review of their last plan.
function startDraft() {
  const week = S.planningWeek();
  const d = { week, step: 1, target: 0, days: [], timeId: '', customTime: '16:00', placeId: '', customPlace: '', icsFor: '', review: null, expired: [], chooseCount: false };
  const review = S.planReview ? S.planReview(week) : null;
  if (!review) return d;
  d.review = review;
  d.chooseCount = review.target === 0;
  d.step = REVIEW;
  d.target = review.target;
  d.days = [...review.days];
  choicesFrom(d, review);
  return d;
}
// After a reset or a restore, the flow starts again from what is saved now.
export function resetPlanDraft() { draft = null; }

function timeChoice() {
  if (draft.timeId === 'custom') return /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.customTime) ? { time: draft.customTime, window: `at ${clock(draft.customTime)}` } : null;
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
function daysReady() {
  const open = S.openDays(draft.week);
  return S.TARGETS.includes(draft.target) && draft.days.length === draft.target && draft.days.every((d) => open.includes(d));
}
function ready(step = draft.step) {
  if (step === 1) return daysReady();
  if (step === 2) return Boolean(timeChoice() && placeChoice());
  return daysReady() && Boolean(timeChoice() && placeChoice());   // the review and the summary
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
// How the day picks stand, said plainly: "1 of 3 picked", or what is still needed.
function counter() {
  const n = draft.days.length;
  const t = draft.target;
  if (!S.TARGETS.includes(t)) return 'Choose how many workouts first.';
  if (t > S.openDays(draft.week).length) return 'Fewer days are left this week. Choose a smaller number.';
  if (n > t) return `${n} picked. Unpick ${n - t} to keep ${t}.`;
  return `${n} of ${t} picked`;
}

function chip(key, label, pressed, onclick, extra = {}) {
  return h('button', { class: 'chip glass py-chip', type: 'button', 'data-key': key, 'aria-pressed': String(pressed), onclick, ...extra }, label);
}

export function renderPlanFlow(root, rerender, { onExit = () => {} } = {}) {
  if (!draft || draft.week !== S.planningWeek()) draft = startDraft();
  const ahead = draft.week !== S.thisWeek();
  const open = S.openDays(draft.week);
  // A draft may stay open overnight. Passed selections need a replacement, never a disabled chip
  // that cannot be unpicked. Keep every choice that is still valid, including time and place.
  const expired = draft.days.filter((d) => !open.includes(d));
  if (expired.length) {
    draft.expired = [...new Set([...draft.expired, ...expired])];
    draft.days = draft.days.filter((d) => open.includes(d));
    if (draft.step > 1) draft.step = draft.review ? REVIEW : 1;
  }
  if (draft.target > open.length) draft.chooseCount = true;
  const go = (step) => { draft.step = step; moveFocus = true; rerender(); };
  const set = (patch) => { refocusKey = document.activeElement?.dataset?.key || ''; Object.assign(draft, patch); rerender(); };
  const onReview = draft.step === REVIEW;
  const onSummary = draft.step > STEPS;
  const startLabel = ahead ? 'Start next week' : 'Start this week';

  // The number of workouts: 2, 3 or 4, never more than the days still open. Changing it never drops
  // a picked day: too many picked asks the player to unpick.
  const counts = (labelId) => h('div', { class: 'py-targets', role: 'group', 'aria-labelledby': labelId },
    S.TARGETS.map((n) => chip(`t${n}`,
      h('span', { class: 'py-target' }, h('strong', { class: 'num' }, String(n)), ' ', h('small', {}, 'workouts')),
      draft.target === n,
      () => set({ target: n }),
      { disabled: n > open.length })));
  const dayChips = (labelId) => {
    const full = draft.days.length >= draft.target;
    return h('div', { class: 'py-days', role: 'group', 'aria-labelledby': labelId },
      S.weekDays(draft.week).map((d) => {
        const date = S.parseKey(d);
        const picked = draft.days.includes(d);
        const isToday = d === S.today();
        return chip(d,
          h('span', { class: 'py-day-chip' }, h('span', {}, weekday(date, 'short')), ' ', h('small', {}, isToday ? 'Today' : monthDay(date))),
          picked,
          () => set({ days: picked ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort() }),
          { disabled: !open.includes(d) || (!picked && full) });
      }));
  };
  const daysList = (p) => h('ul', { class: 'py-summary-days', 'aria-label': 'Your days' },
    p.days.map((d) => h('li', {}, icon('i-check'), h('span', {}, h('strong', {}, weekday(S.parseKey(d))), ` ${monthDay(S.parseKey(d))} · ${clock(p.time)}`))));
  // The calendar file is optional and the player's own: Pengyu never sends notifications itself.
  const calendar = () => {
    const ok = ready();
    const saved = ok && draft.icsFor === fileKey(planDraft());
    return [
      h('button', {
        class: 'btn btn-secondary py-plan-ics', type: 'button', 'data-key': 'ics', disabled: !ok,
        onclick: () => { if (!ready()) return; const plan = planDraft(); downloadIcs(plan.week, { ...plan, moves: [] }); refocusKey = 'ics'; draft.icsFor = fileKey(plan); rerender(); },
      }, icon('i-calendar'), saved ? 'Download again' : 'Download calendar reminders'),
      h('p', { class: 'py-ics-note' }, saved ? 'Downloaded. Open the file and add it to your calendar.' : 'Optional. Reminders work only after you open the file and add it to your calendar.'),
    ];
  };
  // Start: saves the plan (and whether its calendar file was already saved). Nothing is logged.
  const start = (label, why = null) => h('button', {
    class: 'btn glass-coral py-next', type: 'button', 'data-key': 'start', disabled: !ready(),
    'aria-describedby': ready() ? null : why,
    onclick: () => {
      if (!ready()) return;
      const plan = planDraft();
      // Today puts focus on its count once it draws; after a very first plan it also offers the invitation.
      moveFocus = Object.keys(S.state.plans).length === 0 ? 'first-plan' : true;
      if (S.createPlan({ ...plan, calendar: draft.icsFor === fileKey(plan) })) draft = null;
      else moveFocus = false;
    },
  }, label);

  let title = '';
  let hint = '';
  let eyebrow = '';
  let body = null;
  let actions = null;
  let next = null;
  if (onReview) {
    const rv = draft.review;
    title = S.reviewLabel(rv);
    eyebrow = `From ${range(rv.from)}`;
    hint = 'Same days, time and place. Start it as it is, or edit it.';
    // Something from last time no longer fits this week: a weekday has passed, or fewer days are left than
    // the last number. The player chooses; this part stays on screen until Start, so focus never jumps.
    const fixing = rv.missing.length > 0 || draft.expired.length > 0 || draft.chooseCount;
    const passed = [...new Set([...rv.missing, ...draft.expired])].map((d) => weekday(S.parseKey(d)));
    const counted = S.TARGETS.includes(draft.target);
    const need = counted ? draft.target - draft.days.length : 0;
    const needs = [
      draft.chooseCount ? `Only ${open.length} days are left this week, so pick a number.` : '',
      passed.length ? `${listOf(passed)} ${passed.length > 1 ? 'have' : 'has'} passed this week.` : '',
      !counted ? '' : need > 0 ? `Pick ${need} more ${need > 1 ? 'days' : 'day'} below.` : need < 0 ? counter() : 'Your days are set.',
    ].filter(Boolean).join(' ');
    const t = timeChoice();
    body = h('div', { class: 'py-step-body' },
      h('div', { class: 'py-summary py-review' },
        ready() ? h('p', { class: 'py-summary-plan' }, sentence(planDraft())) : null,
        draft.days.length ? daysList({ days: [...draft.days].sort(), time: t ? t.time : rv.time }) : null,
        h('dl', { class: 'py-review-facts' },
          h('div', {}, h('dt', {}, 'When'), h('dd', {}, t ? (t.window.startsWith('at ') ? clock(t.time) : `${cap(t.window)}, ${clock(t.time)}`) : '')),
          h('div', {}, h('dt', {}, 'Where'), h('dd', {}, cap(placeChoice() || '')))),
        h('p', { class: 'py-summary-fish' }, `Each planned workout pays ${S.FISH.station} Fish, and the full week adds ${S.FISH.weekBonus}.`)),
      fixing ? h('div', { class: 'py-review-fix' },
        h('p', { class: 'py-review-needs', id: 'py-plan-needs' }, needs),
        draft.chooseCount ? h('h2', { class: 'py-step-sub', id: 'py-plan-count-q' }, 'How many workouts?') : null,
        draft.chooseCount ? counts('py-plan-count-q') : null,
        h('h2', { class: 'py-step-sub', id: 'py-plan-days-q' }, 'Which days?'),
        dayChips('py-plan-days-q'),
        h('p', { class: 'py-counter', 'aria-live': 'polite' }, counter())) : null);
    next = start(startLabel, fixing ? 'py-plan-needs' : null);
    actions = h('div', { class: 'py-plan-actions' }, next,
      h('button', { class: 'btn btn-secondary py-review-edit', type: 'button', 'data-key': 'edit', onclick: () => go(1) }, 'Edit'),
      ...calendar());
  } else if (draft.step === 1) {
    title = 'Pick your workouts and days.';
    eyebrow = `${ahead ? 'Next week' : 'Plan your week'} · Step 1 of ${STEPS}`;
    hint = ahead ? 'Your route starts Monday. Any workout, any length, counts.' : 'Any workout, any length, counts. Pick a number you can keep.';
    body = h('div', { class: 'py-step-body' },
      h('h2', { class: 'py-step-sub', id: 'py-plan-count-q' }, 'How many workouts?'),
      counts('py-plan-count-q'),
      h('h2', { class: 'py-step-sub', id: 'py-plan-days-q' }, 'Which days?'),
      h('p', { class: 'py-hint' }, S.TARGETS.includes(draft.target) ? `Pick ${draft.target}. You can move one later, with no penalty.` : 'Pick a number first, then the days.'),
      dayChips('py-plan-days-q'),
      draft.expired.length ? h('p', { class: 'py-hint' }, 'A chosen day has passed. Pick a replacement day.') : null,
      h('p', { class: 'py-counter', 'aria-live': 'polite' }, counter()));
  } else if (draft.step === 2) {
    title = 'When and where?';
    eyebrow = `${ahead ? 'Next week' : 'Plan your week'} · Step 2 of ${STEPS}`;
    hint = 'Picture the time and the place. It makes the plan easier to keep.';
    const customTime = draft.timeId === 'custom';
    const customPlace = draft.placeId === 'custom';
    body = h('div', { class: 'py-step-body' },
      h('h2', { class: 'py-step-sub', id: 'py-plan-when-q' }, 'When?'),
      h('p', { class: 'py-hint' }, 'If you add the calendar file, your calendar reminds you 15 minutes before.'),
      h('div', { class: 'py-grid2', role: 'group', 'aria-labelledby': 'py-plan-when-q' },
        TIMES.map((t) => chip(t.id, h('span', {}, t.label, ' ', h('small', {}, clock(t.time))), draft.timeId === t.id, () => set({ timeId: t.id }))),
        chip('custom-time', 'Pick a time', customTime, () => set({ timeId: 'custom' }))),
      customTime ? h('div', { class: 'field py-custom' },
        h('label', { for: 'py-time' }, 'Time'),
        h('input', { class: 'input', id: 'py-time', type: 'time', value: draft.customTime, required: true, oninput: (e) => { draft.customTime = e.target.value; next.disabled = !ready(); } })) : null,
      h('h2', { class: 'py-step-sub', id: 'py-plan-where-q' }, 'Where?'),
      h('div', { class: 'py-grid2', role: 'group', 'aria-labelledby': 'py-plan-where-q' },
        PLACES.map((p) => chip(p.id, p.label, draft.placeId === p.id, () => set({ placeId: p.id }))),
        chip('custom-place', 'Type a place', customPlace, () => set({ placeId: 'custom' }))),
      customPlace ? h('div', { class: 'field py-custom' },
        h('label', { for: 'py-place' }, 'Place'),
        h('input', { class: 'input', id: 'py-place', type: 'text', maxlength: '40', autocomplete: 'off', placeholder: 'the pool', value: draft.customPlace, oninput: (e) => { draft.customPlace = e.target.value; next.disabled = !ready(); } })) : null);
  } else {
    title = ahead ? 'Your route starts Monday.' : 'Your week';
    const p = planDraft();
    body = h('div', { class: 'py-summary' },
      h('p', { class: 'py-summary-plan' }, sentence(p)),
      daysList(p),
      h('p', { class: 'py-summary-fish' }, `Each planned workout pays ${S.FISH.station} Fish, and the full week adds ${S.FISH.weekBonus}.`));
    next = start('Start my week');
    actions = h('div', { class: 'py-plan-actions' }, next, ...calendar());
  }
  if (!actions) {
    next = h('button', { class: 'btn glass-coral py-next', type: 'button', disabled: !ready(), onclick: () => { if (ready()) go(draft.step + 1); } }, 'Next');
    actions = h('div', { class: 'py-plan-actions' }, next);
  }
  // Editing a returning plan starts from its choices: say so, and that Next keeps them.
  const prefilled = draft.review && !onReview && !onSummary ? h('p', { class: 'py-prefill' }, 'Filled in from your last plan. Change anything, or tap Next.') : null;

  const heading = h('h1', { class: 'py-step-title', id: 'py-step-title', tabindex: '-1' }, title);
  const back = onReview ? onExit : draft.step === 1 ? (draft.review ? () => go(REVIEW) : onExit) : () => go(draft.step - 1);
  const toToday = onReview || (draft.step === 1 && !draft.review);
  root.append(h('div', { class: 'py-plan' },
    h('div', { class: 'py-plan-top' },
      h('button', { class: 'py-back glass', type: 'button', 'aria-label': toToday ? 'Back to Today' : 'Back', onclick: back }, icon('i-back')),
      onReview ? null : h('ol', { class: 'py-dots', 'aria-hidden': 'true' }, Array.from({ length: STEPS }, (_, i) => h('li', { class: i < draft.step ? 'is-on' : '' })))),
    h('div', { class: 'py-plan-head' },
      onSummary ? null : h('p', { class: 'eyebrow' }, eyebrow),
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

// After a plan is made, Today takes focus instead: true, or 'first-plan' after a very first plan.
export function takeFocusRequest() { const f = moveFocus; moveFocus = false; return f; }
