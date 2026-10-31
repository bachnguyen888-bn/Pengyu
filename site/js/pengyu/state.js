// Pengu's week planner: its memory and rules. One object in this browser's localStorage under its
// own key, so it never touches the preview's saved data, and it is never sent anywhere.
// Workouts are the currency: a planned workout pays Fish, a full week pays a bonus, and coming back
// after a missed day pays a Comeback stamp. Workouts beyond the plan pay no Fish; they collect
// looks-only extras in a fixed order. Nothing here is random, and nothing is ever sold.

const KEY = 'pengyu.v1';
export const TARGETS = [2, 3, 4];
export const FISH = { station: 10, weekBonus: 25, comeback: 15 };

// Extras for workouts beyond the plan: looks only, never power, always in this order.
export const EXTRAS = [
  { id: 'decal-star', name: 'Star decal', kind: 'train decal' },
  { id: 'hat-bobble', name: 'Bobble hat', kind: 'hat' },
  { id: 'decal-wave', name: 'Wave decal', kind: 'train decal' },
  { id: 'hat-sun', name: 'Sun hat', kind: 'hat' },
  { id: 'decal-bolt', name: 'Lightning decal', kind: 'train decal' },
  { id: 'hat-party', name: 'Party hat', kind: 'hat' },
];

// ---------- Dates (local time, as YYYY-MM-DD keys; weeks start on Monday) ----------
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function parseKey(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); }
export function addDays(key, n) { const d = parseKey(key); d.setDate(d.getDate() + n); return dayKey(d); }
export function weekStart(key) { const d = parseKey(key); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayKey(d); }
export function weekDays(start) { return Array.from({ length: 7 }, (_, i) => addDays(start, i)); }
export const today = () => dayKey();
export const thisWeek = () => weekStart(today());

// ---------- State ----------
function fresh() {
  return {
    v: 1,
    createdAt: new Date().toISOString(),
    plans: {},            // monday -> { target, days, time, window, place, createdAt, moves: [{ from, to, at }] }
    log: {},              // day -> { at, kind: 'planned' | 'extra', comeback?: missedDay, extra?: id }; one a day
    fish: { balance: 0, lifetime: 0 },
    weekBonusPaid: [],    // mondays whose full-week bonus has been paid
    extras: [],           // [{ id, earnedOn }] in EXTRAS order
    coversAnnounced: [],  // mondays whose free streak cover has been shown to the player
    events: [],           // { type, at, ...details }, for "Export my data"
  };
}

let canSave = true;
function probe() {
  try { localStorage.setItem('pengyu.probe', '1'); localStorage.removeItem('pengyu.probe'); return true; } catch { return false; }
}
function load() {
  canSave = probe();
  if (!canSave) return fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!saved || saved.v !== 1) return fresh();
    const base = fresh();
    const out = { ...base, ...saved, fish: { ...base.fish, ...saved.fish } };
    for (const k of ['weekBonusPaid', 'extras', 'coversAnnounced', 'events']) if (!Array.isArray(out[k])) out[k] = [];
    return out;
  } catch { return fresh(); }
}
function save() {
  if (!canSave) return false;
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { canSave = false; return false; }
}

export let state = load();
export const storageOk = () => canSave;

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Every change goes through here: it saves, then tells the screens what happened.
function commit(result) {
  const saved = save();
  for (const fn of listeners) fn({ ...result, saved });
  return result;
}

function logEvent(type, details = {}) {
  state.events.push({ type, at: new Date().toISOString(), ...details });
}

function pay(amount) {
  state.fish.balance += amount;
  state.fish.lifetime += amount;
}

// ---------- Reading the week ----------
export function planFor(monday = thisWeek()) { return state.plans[monday] || null; }
export const stations = (plan) => [...plan.days].sort();
export const isDone = (day) => Boolean(state.log[day]);

// Each planned day as a station: done, open today, upcoming, or missed (in the past and empty).
export function route(monday = thisWeek()) {
  const plan = planFor(monday);
  if (!plan) return null;
  const t = today();
  const list = stations(plan).map((day) => ({
    day,
    status: isDone(day) ? 'done' : day === t ? 'today' : day > t ? 'upcoming' : 'missed',
  }));
  const done = list.filter((s) => s.status === 'done').length;
  const open = list.filter((s) => s.status === 'today' || s.status === 'upcoming').length;
  const last = list.map((s) => s.status).lastIndexOf('done');
  const extras = weekDays(monday).filter((d) => state.log[d] && state.log[d].kind === 'extra').length;
  return { plan, stations: list, done, target: plan.target, open, trainAt: last + 1, hit: done >= plan.target, extras };
}

export function weekHit(monday) {
  const plan = planFor(monday);
  return Boolean(plan && plan.days.every(isDone));
}

// Week streak: consecutive weeks where the plan was hit, counted from the first planned week.
// This week only adds once it is hit; until then it is open and cannot break anything.
// One free streak cover per calendar month: the first missed week of a month (counted by its
// Monday) keeps a running streak alive without adding to it. It is automatic and never sold.
export function streakInfo() {
  const current = thisWeek();
  const first = Object.keys(state.plans).sort()[0];
  const usedMonths = new Set();
  const covered = [];
  let streak = 0;
  if (first) {
    for (let monday = first; monday < current; monday = addDays(monday, 7)) {
      if (weekHit(monday)) streak += 1;
      else if (streak > 0 && !usedMonths.has(monday.slice(0, 7))) { usedMonths.add(monday.slice(0, 7)); covered.push(monday); }
      else streak = 0;
    }
  }
  if (weekHit(current)) streak += 1;
  return { streak, covered, coverReady: !usedMonths.has(current.slice(0, 7)) };
}
export const weekStreak = () => streakInfo().streak;

// ---------- Comebacks and extras ----------
function lastMissedBefore(t) {
  let last = '';
  for (const plan of Object.values(state.plans)) for (const d of plan.days) if (d < t && !state.log[d] && d > last) last = d;
  return last;
}
// The missed planned day this workout comes back from, if it is the first workout since then.
export function comebackDue(t = today()) {
  const missed = lastMissedBefore(t);
  const lastWorkout = Object.keys(state.log).filter((d) => d < t).sort().pop() || '';
  return missed && lastWorkout < missed ? missed : '';
}
export const comebackStamps = () => Object.values(state.log).filter((l) => l.comeback).length;
export const nextExtra = () => EXTRAS.find((e) => !state.extras.some((x) => x.id === e.id)) || null;
export const extraById = (id) => EXTRAS.find((e) => e.id === id) || null;

// What a tap on "I worked out today" will do, so the button can say so before it is pressed.
export function logPreview() {
  const t = today();
  if (state.log[t]) return { kind: 'logged' };
  const plan = planFor();
  if (!plan) return { kind: 'no-plan' };
  const comeback = comebackDue(t);
  const bonus = comeback ? FISH.comeback : 0;
  if (plan.days.includes(t)) return { kind: 'planned', fish: FISH.station + bonus, comeback };
  const next = stations(plan).find((d) => d > t && !isDone(d));
  if (next) return { kind: 'moved', from: next, fish: FISH.station + bonus, comeback };
  return { kind: 'extra', fish: bonus, comeback, extra: nextExtra() };
}

// ---------- Changes ----------
export function createPlan({ target, days, time, window, place }) {
  const t = today();
  const monday = thisWeek();
  const week = weekDays(monday);
  const picked = [...new Set(days)].sort();
  if (planFor(monday)) return null;
  if (!TARGETS.includes(target) || picked.length !== target) return null;
  if (picked.some((d) => !week.includes(d) || d < t)) return null;
  state.plans[monday] = { target, days: picked, time, window, place, createdAt: new Date().toISOString(), moves: [] };
  logEvent('plan_created', { week: monday, target, days: picked, time, window, place });
  return commit({ type: 'plan' });
}

// Move an unfinished station that is today or later to another free day this week. No penalty.
export function canMove(day) {
  const plan = planFor();
  return Boolean(plan && plan.days.includes(day) && !isDone(day) && day >= today());
}
export function moveTargets(day) {
  const plan = planFor();
  if (!canMove(day)) return [];
  const t = today();
  return weekDays(thisWeek()).filter((d) => d >= t && !plan.days.includes(d) && !state.log[d]);
}
export function moveStation(from, to) {
  if (!moveTargets(from).includes(to)) return null;
  const plan = planFor();
  plan.days[plan.days.indexOf(from)] = to;   // same slot, so a re-exported calendar updates that event
  plan.moves.push({ from, to, at: new Date().toISOString() });
  return commit({ type: 'move', from, to });
}

// One tap, once a day, any workout of any length. A planned day punches its station; another day
// moves the next upcoming station here; with no station left it is an extra ride: no Fish, and the
// next looks-only extra. The first workout after a missed planned day also earns a Comeback stamp.
export function logWorkout() {
  const preview = logPreview();
  if (preview.kind === 'logged' || preview.kind === 'no-plan') return null;
  const t = today();
  const monday = thisWeek();
  const plan = planFor(monday);
  if (preview.kind === 'moved') {
    plan.days[plan.days.indexOf(preview.from)] = t;
    plan.moves.push({ from: preview.from, to: t, at: new Date().toISOString(), reason: 'logged' });
  }
  const kind = preview.kind === 'extra' ? 'extra' : 'planned';
  state.log[t] = { at: new Date().toISOString(), kind };
  let fish = 0;
  if (kind === 'planned') { pay(FISH.station); fish += FISH.station; }
  let comeback = 0;
  if (preview.comeback) {
    state.log[t].comeback = preview.comeback;
    pay(FISH.comeback);
    comeback = FISH.comeback;
  }
  const extra = kind === 'extra' ? nextExtra() : null;
  if (extra) {
    state.extras.push({ id: extra.id, earnedOn: t });
    state.log[t].extra = extra.id;
  }
  let bonus = 0;
  if (weekHit(monday) && !state.weekBonusPaid.includes(monday)) {
    state.weekBonusPaid.push(monday);
    pay(FISH.weekBonus);
    bonus = FISH.weekBonus;
  }
  const r = route(monday);
  logEvent('workout_logged', {
    day: t, kind, movedFrom: preview.kind === 'moved' ? preview.from : undefined,
    fish: fish + bonus + comeback, done: r.done, target: r.target, weekHit: r.hit,
  });
  if (comeback) logEvent('comeback_earned', { day: t, after: preview.comeback, fish: comeback });
  if (extra) logEvent('extra_earned', { day: t, id: extra.id });
  return commit({
    type: 'log', kind, fish, bonus, comeback, extra,
    movedFrom: preview.kind === 'moved' ? preview.from : null, hit: r.hit,
  });
}

// The calendar file now matches the plan (the Today screen stops asking until a day moves).
export function markCalendarSaved() {
  const plan = planFor();
  if (!plan) return null;
  plan.icsSeq = plan.moves.length;
  return commit({ type: 'calendar' });
}

// Covers are applied by the rules above; this records each one once, so Pengu can say so.
export function announceCovers() {
  const fresh = streakInfo().covered.filter((m) => !state.coversAnnounced.includes(m));
  if (!fresh.length) return [];
  for (const m of fresh) {
    state.coversAnnounced.push(m);
    logEvent('streak_cover_used', { week: m, month: m.slice(0, 7) });
  }
  commit({ type: 'cover', weeks: fresh });
  return fresh;
}

// ---------- Export ----------
export function exportData() {
  return JSON.stringify({ exportedAt: new Date().toISOString(), storageKey: KEY, ...state }, null, 2);
}
