// The Monday plan: a weekly target, the days, a time and a place, in about 30 seconds.
// The result is an if-then plan per day ("Tuesday, after school, at the gym").

import * as S from './state.js';
import { h, icon, weekday, monthDay, clock, plural } from './ui.js';

const TIMES = [
  { id: 'before-school', label: 'Before school', time: '07:00', window: 'before school' },
  { id: 'after-school', label: 'After school', time: '15:30', window: 'after school' },
  { id: 'evening', label: 'Evening', time: '18:00', window: 'in the evening' },
];
const PLACES = [
  { id: 'gym', label: 'Gym', place: 'at the gym' },
  { id: 'home', label: 'Home', place: 'at home' },
  { id: 'park', label: 'Park', place: 'at the park' },
  { id: 'school', label: 'School', place: 'at school' },
];
const STEPS = 5;

// The draft lives here, so a re-render (a new minute, a returning tab) keeps what was picked.
let draft = null;
let moveFocus = false;
let refocusKey = '';   // the chip that was just pressed, refocused after a re-render
function resetDraft() {
  draft = { week: S.thisWeek(), step: 1, target: 0, days: [], timeId: '', customTime: '16:00', placeId: '', customPlace: '' };
}

const openDays = () => S.weekDays(S.thisWeek()).filter((d) => d >= S.today());

function timeChoice() {
  if (draft.timeId === 'custom') return draft.customTime ? { time: draft.customTime, window: `at ${clock(draft.customTime)}` } : null;
  const t = TIMES.find((x) => x.id === draft.timeId);
  return t ? { time: t.time, window: t.window } : null;
}
function placeChoice() {
  if (draft.placeId === 'custom') {
    const text = draft.customPlace.trim().replace(/^at\s+/i, '');
    return text ? `at ${text}` : null;
  }
  const p = PLACES.find((x) => x.id === draft.placeId);
  return p ? p.place : null;
}
function stepReady() {
  if (draft.step === 1) return S.TARGETS.includes(draft.target);
  if (draft.step === 2) return draft.days.length === draft.target;
  if (draft.step === 3) return Boolean(timeChoice());
  if (draft.step === 4) return Boolean(placeChoice());
  return true;
}

function chip(key, label, pressed, onclick, extra = {}) {
  return h('button', { class: 'chip py-chip', type: 'button', 'data-key': key, 'aria-pressed': String(pressed), onclick, ...extra }, label);
}

export function renderPlanFlow(root, rerender) {
  if (!draft || draft.week !== S.thisWeek()) resetDraft();
  const days = openDays();
  const go = (step) => { draft.step = step; moveFocus = true; rerender(); };
  const set = (patch) => { refocusKey = document.activeElement?.dataset?.key || ''; Object.assign(draft, patch); rerender(); };

  // Sunday leaves one day, and the smallest plan is two workouts.
  if (days.length < S.TARGETS[0]) {
    root.append(
      h('div', { class: 'py-flow' },
        h('h3', { class: 'py-step-title' }, 'Your next week starts Monday'),
        h('p', { class: 'muted' }, 'Plans run Monday to Sunday, and the smallest one is two workouts. Come back Monday to plan your week. Any workout you do today still counts for you.')),
    );
    return;
  }

  let title = '';
  let hint = '';
  let body = null;
  if (draft.step === 1) {
    title = 'How many workouts this week?';
    hint = 'Any workout, any length, counts. Pick a number you can really do.';
    body = h('div', { class: 'py-choices py-targets', role: 'group', 'aria-labelledby': 'py-step-title' },
      S.TARGETS.map((n) => chip(`t${n}`,
        h('span', { class: 'py-target' }, h('strong', {}, String(n)), h('small', {}, 'workouts')),
        draft.target === n,
        () => set({ target: n, days: draft.days.slice(0, n) }),
        { disabled: n > days.length },
      )));
  } else if (draft.step === 2) {
    title = `Which ${draft.target} days?`;
    hint = 'Pick your days. You can move one later with no penalty.';
    const full = draft.days.length >= draft.target;
    body = h('div', {},
      h('div', { class: 'py-choices py-days', role: 'group', 'aria-labelledby': 'py-step-title' },
        S.weekDays(S.thisWeek()).map((d) => {
          const date = S.parseKey(d);
          const picked = draft.days.includes(d);
          const past = d < S.today();
          return chip(d,
            h('span', { class: 'py-day-chip' }, h('span', {}, weekday(date, 'short')), h('small', {}, d === S.today() ? 'Today' : monthDay(date))),
            picked,
            () => set({ days: picked ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort() }),
            { disabled: past || (!picked && full), 'aria-label': `${weekday(date)}${d === S.today() ? ', today' : ''}` },
          );
        })),
      h('p', { class: 'py-counter small', 'aria-live': 'polite' }, `${draft.days.length} of ${draft.target} picked`));
  } else if (draft.step === 3) {
    title = 'What time?';
    hint = 'Your calendar alarm rings 15 minutes before.';
    const custom = draft.timeId === 'custom';
    body = h('div', {},
      h('div', { class: 'py-choices', role: 'group', 'aria-labelledby': 'py-step-title' },
        TIMES.map((t) => chip(t.id, h('span', {}, t.label, h('small', {}, clock(t.time))), draft.timeId === t.id, () => set({ timeId: t.id }))),
        chip('custom-time', 'Pick a time', custom, () => set({ timeId: 'custom' }))),
      custom ? h('div', { class: 'field py-custom' },
        h('label', { for: 'py-time' }, 'Time'),
        h('input', { class: 'input', id: 'py-time', type: 'time', value: draft.customTime, required: true, oninput: (e) => { draft.customTime = e.target.value; next.disabled = !stepReady(); } })) : null);
  } else if (draft.step === 4) {
    title = 'Where?';
    hint = 'Picture the place. It makes the plan easier to keep.';
    const custom = draft.placeId === 'custom';
    body = h('div', {},
      h('div', { class: 'py-choices', role: 'group', 'aria-labelledby': 'py-step-title' },
        PLACES.map((p) => chip(p.id, p.label, draft.placeId === p.id, () => set({ placeId: p.id }))),
        chip('custom-place', 'Somewhere else', custom, () => set({ placeId: 'custom' }))),
      custom ? h('div', { class: 'field py-custom' },
        h('label', { for: 'py-place' }, 'Place'),
        h('input', { class: 'input', id: 'py-place', type: 'text', maxlength: '40', autocomplete: 'off', placeholder: 'the pool', value: draft.customPlace, oninput: (e) => { draft.customPlace = e.target.value; next.disabled = !stepReady(); } })) : null);
  } else {
    title = 'Your week';
    hint = 'One line per day. Tap a station later to move it, with no penalty.';
    const t = timeChoice();
    const preview = { window: t.window, place: placeChoice() };
    body = h('ol', { class: 'py-review' },
      draft.days.map((d) => h('li', {}, icon('i-check'), h('span', {}, `${weekday(S.parseKey(d))}, ${preview.window}, ${preview.place}`))));
  }

  const next = h('button', {
    class: 'btn btn-primary', type: 'button', disabled: !stepReady(),
    onclick: () => {
      if (!stepReady()) return;
      if (draft.step < STEPS) { go(draft.step + 1); return; }
      const t = timeChoice();
      const made = S.createPlan({ target: draft.target, days: draft.days, time: t.time, window: t.window, place: placeChoice() });
      if (made) { draft = null; moveFocus = true; }
    },
  }, draft.step < STEPS ? 'Next' : 'Start my week');

  const heading = h('h3', { class: 'py-step-title', id: 'py-step-title', tabindex: '-1' }, title);
  root.append(h('div', { class: 'py-flow' },
    h('div', { class: 'py-flow-top' },
      h('p', { class: 'eyebrow' }, `Plan your week · Step ${draft.step} of ${STEPS}`),
      h('div', { class: 'py-progress', 'aria-hidden': 'true' }, Array.from({ length: STEPS }, (_, i) => h('span', { class: i < draft.step ? 'is-on' : '' })))),
    heading,
    h('p', { class: 'muted small py-hint' }, hint),
    body,
    h('div', { class: 'py-flow-nav' },
      draft.step > 1 ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => go(draft.step - 1) }, 'Back') : h('span'),
      next),
    draft.step === STEPS ? h('p', { class: 'small muted' }, `${plural(draft.target, 'workout')} this week. Each one pays ${S.FISH.station} Fish, and the full week adds ${S.FISH.weekBonus}.`) : null,
  ));
  if (moveFocus) { moveFocus = false; refocusKey = ''; heading.focus({ preventScroll: true }); }
  if (refocusKey) {
    const again = root.querySelector(`[data-key="${refocusKey}"]`);
    refocusKey = '';
    if (again && !again.disabled) again.focus({ preventScroll: true });
  }
}

// After a plan is made, the route screen takes focus instead.
export function takeFocusRequest() { const f = moveFocus; moveFocus = false; return f; }
