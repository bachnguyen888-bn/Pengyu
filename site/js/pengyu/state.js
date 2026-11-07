// Pengu's week planner: its memory and rules. One object in this browser's localStorage under its
// own key, and it is never sent anywhere.
// Workouts are the currency: a planned workout pays Fish, a full week pays a bonus, and the first
// planned workout after a missed planned day pays a Comeback stamp. Workouts beyond the plan pay no
// Fish at all; they collect looks-only extras in a fixed order. Nothing here is random, and nothing
// is ever sold.

const KEY = 'pengyu.v1';
export const TARGETS = [2, 3, 4];
export const FISH = { station: 10, weekBonus: 25, comeback: 15 };

// Extras for workouts beyond the plan: looks only, they never change how Fish are earned, always in this order.
export const EXTRAS = [
  { id: 'decal-star', name: 'Star decal', kind: 'train decal' },
  { id: 'hat-bobble', name: 'Bobble hat', kind: 'hat' },
  { id: 'decal-wave', name: 'Wave decal', kind: 'train decal' },
  { id: 'hat-sun', name: 'Sun hat', kind: 'hat' },
  { id: 'decal-bolt', name: 'Lightning decal', kind: 'train decal' },
  { id: 'hat-party', name: 'Party hat', kind: 'hat' },
];

// Train paint, once Colors is unlocked. Navy is the default; wheels stay red and trim stays brass.
export const PAINTS = [
  { id: 'navy', name: 'Night navy' },
  { id: 'coral', name: 'Coral' },
  { id: 'sunny', name: 'Sunny' },
  { id: 'pink', name: 'Pink' },
  { id: 'charcoal', name: 'Charcoal' },
];

// ---------- Clock ----------
// Every date in Pengyu comes from now(). Tests swap the clock with setClock(); on localhost, and only
// there, ?now=YYYY-MM-DDTHH:MM starts it at that moment (it keeps ticking), for screenshots.
let clock = () => new Date();
export const now = () => clock();
export function setClock(fn) { clock = typeof fn === 'function' ? fn : () => new Date(); }
(function devClock() {
  if (typeof location === 'undefined' || !['localhost', '127.0.0.1'].includes(location.hostname)) return;
  const m = /[?&]now=(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/.exec(location.search);
  const offset = m ? new Date(m[1]).getTime() - Date.now() : NaN;
  if (Number.isFinite(offset)) clock = () => new Date(Date.now() + offset);
})();

// "good morning." from 5:00 to 11:59, "good afternoon." from 12:00 to 16:59, "good evening." otherwise.
export function greeting(d = now()) {
  const hour = d.getHours();
  if (hour >= 5 && hour < 12) return 'good morning.';
  if (hour >= 12 && hour < 17) return 'good afternoon.';
  return 'good evening.';
}

// ---------- Dates (local time, as YYYY-MM-DD keys; weeks start on Monday) ----------
export function dayKey(d = now()) {
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
    createdAt: now().toISOString(),
    plans: {},            // monday -> { target, days, time, window, place, createdAt, moves: [{ from, to, at }] }
    log: {},              // day -> { at, kind: 'planned' | 'extra', comeback?: missedDay, extra?: id }; one a day
    fish: { balance: 0, lifetime: 0 },
    weekBonusPaid: [],    // mondays whose full-week bonus has been paid
    extras: [],           // [{ id, earnedOn }] in EXTRAS order
    coversAnnounced: [],  // mondays whose free streak cover has been shown to the player
    owned: {},            // unlock id -> { at, price }; kept for good
    wear: { hat: null, scarf: false, backpack: false, outfit: false, decal: null, paint: 'navy' },
    events: [],           // { type, at, ...details }; part of every backup
    tipSeen: false,       // the one-time "add Pengyu to your Home Screen" card has been shown
  };
}

let canSave = true;
function probe() {
  try { localStorage.setItem('pengyu.probe', '1'); localStorage.removeItem('pengyu.probe'); return true; } catch { return false; }
}
const isObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
// Saved data (or a backup) laid over a fresh state: known keys only, every list a list, retired paints
// (mint and purple) back to navy.
function normalize(saved) {
  const base = fresh();
  const out = {};
  for (const k of Object.keys(base)) out[k] = k in saved ? saved[k] : base[k];
  out.fish = { ...base.fish, ...(isObj(saved.fish) ? saved.fish : {}) };
  out.wear = { ...base.wear, ...(isObj(saved.wear) ? saved.wear : {}) };
  for (const k of ['plans', 'log', 'owned']) if (!isObj(out[k])) out[k] = {};
  for (const k of ['weekBonusPaid', 'extras', 'coversAnnounced', 'events']) if (!Array.isArray(out[k])) out[k] = [];
  for (const plan of Object.values(out.plans)) if (isObj(plan) && !Array.isArray(plan.moves)) plan.moves = [];
  if (!PAINTS.some((x) => x.id === out.wear.paint)) out.wear.paint = 'navy';
  out.tipSeen = out.tipSeen === true;
  return out;
}
function load() {
  canSave = probe();
  if (!canSave) return fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!isObj(saved) || saved.v !== 1) return fresh();
    return normalize(saved);
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
  state.events.push({ type, at: now().toISOString(), ...details });
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
// The missed planned day a planned workout today comes back from, if none has been logged since.
// Extra rides never pay Fish, so they neither earn the comeback nor use it up.
export function comebackDue(t = today()) {
  const missed = lastMissedBefore(t);
  const lastPlanned = Object.keys(state.log).filter((d) => d < t && state.log[d].kind === 'planned').sort().pop() || '';
  return missed && lastPlanned < missed ? missed : '';
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
  return { kind: 'extra', fish: 0, comeback: '', extra: nextExtra() };
}

// ---------- Planning ----------
// The days of a week that can still be planned, or moved to: today and later.
export const openDays = (monday = thisWeek()) => weekDays(monday).filter((d) => d >= today());
// A new plan is for this week, or for next week once fewer days are left than the smallest plan
// (two workouts), which is Sunday. That is how a Sunday player starts the next route.
export function planningWeek() {
  const monday = thisWeek();
  return openDays(monday).length < TARGETS[0] ? addDays(monday, 7) : monday;
}
// The week Today shows: this week, or next week once it was planned ahead on Sunday.
export function shownWeek() {
  const monday = thisWeek();
  const next = addDays(monday, 7);
  return !planFor(monday) && planFor(next) ? next : monday;
}
// The most recent plan before a week, so the next plan can start from it.
export function lastPlanBefore(monday) {
  const prev = Object.keys(state.plans).filter((m) => m < monday).sort().pop();
  return prev ? state.plans[prev] : null;
}

// ---------- Changes ----------
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const isText = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
// `calendar: true` when the player already saved this plan's calendar file from the summary.
export function createPlan({ week = planningWeek(), target, days, time, window, place, calendar = false } = {}) {
  if (week !== planningWeek() || planFor(week)) return null;
  const open = openDays(week);
  const picked = [...new Set(Array.isArray(days) ? days : [])].sort();
  if (!TARGETS.includes(target) || picked.length !== target || picked.some((d) => !open.includes(d))) return null;
  if (!TIME.test(String(time)) || !isText(window, 40) || !isText(place, 60)) return null;
  state.plans[week] = { target, days: picked, time, window: window.trim(), place: place.trim(), createdAt: now().toISOString(), moves: [] };
  if (calendar) state.plans[week].icsSeq = 0;
  logEvent('plan_created', { week, target, days: picked, time, window: window.trim(), place: place.trim() });
  return commit({ type: 'plan', week });
}

// Move an unfinished station that is today or later to another free day of its week. No penalty, and
// never once its day has passed.
export function canMove(day) {
  const plan = planFor(weekStart(day));
  return Boolean(plan && plan.days.includes(day) && !isDone(day) && day >= today());
}
export function moveTargets(day) {
  if (!canMove(day)) return [];
  const monday = weekStart(day);
  const plan = planFor(monday);
  return openDays(monday).filter((d) => !plan.days.includes(d) && !state.log[d]);
}
export function moveStation(from, to) {
  if (!moveTargets(from).includes(to)) return null;
  const monday = weekStart(from);
  const plan = planFor(monday);
  plan.days[plan.days.indexOf(from)] = to;   // same slot, so a re-exported calendar updates that event
  plan.moves.push({ from, to, at: now().toISOString() });
  logEvent('plan_moved', { week: monday, from, to });
  return commit({ type: 'move', from, to });
}

// One tap, once a day, any workout of any length. A planned day punches its station; another day
// moves the next upcoming station here; with no station left it is an extra ride: no Fish, and the
// next looks-only extra. The first planned workout after a missed planned day also earns a Comeback
// stamp.
export function logWorkout() {
  const preview = logPreview();
  if (preview.kind === 'logged' || preview.kind === 'no-plan') return null;
  const t = today();
  const monday = thisWeek();
  const plan = planFor(monday);
  if (preview.kind === 'moved') {
    plan.days[plan.days.indexOf(preview.from)] = t;
    plan.moves.push({ from: preview.from, to: t, at: now().toISOString(), reason: 'logged' });
  }
  const kind = preview.kind === 'extra' ? 'extra' : 'planned';
  state.log[t] = { at: now().toISOString(), kind };
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
    if (extra.kind === 'hat' && !state.wear.hat) state.wear.hat = extra.id;
    if (extra.kind === 'train decal' && !state.wear.decal) state.wear.decal = extra.id;
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

// The calendar file now matches the plan (the week sheet stops asking until a day moves).
export function markCalendarSaved(monday = shownWeek()) {
  const plan = planFor(monday);
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

// ---------- The unlock tree (M2) ----------
// Pengu's gear comes in a fixed order; train upgrades can be bought in any order. Every price is fixed
// and shown up front, nothing is random, and everything bought is kept for good: nothing decays,
// rusts or rolls back. Upgrades are looks only; they never change how Fish are earned.
export const GEAR = [
  { id: 'scarf', name: 'Scarf', price: 40, line: 'A cosy coral scarf.' },
  { id: 'cap', name: 'Cap', price: 90, line: 'A sunny yellow cap.' },
  { id: 'backpack', name: 'Backpack', price: 150, line: 'A warm brown backpack for the long route.' },
  { id: 'conductor', name: 'Conductor outfit', price: 240, line: 'Navy jacket, gold buttons and a conductor’s cap.' },
];
export const TRAIN = [
  { id: 'headlamp', name: 'Headlamp', price: 50, line: 'Lights the way on early starts.' },
  { id: 'paint', name: 'Colors', price: 80, line: 'Repaint the engine coral, sunny, pink or charcoal, or keep it navy.' },
  { id: 'car', name: 'Extra car', price: 130, line: 'A second car to carry the cargo.' },
];
const UNLOCKS = [...GEAR.map((g) => ({ ...g, kind: 'gear' })), ...TRAIN.map((t) => ({ ...t, kind: 'train' }))];
export const unlockById = (id) => UNLOCKS.find((u) => u.id === id) || null;
export const owns = (id) => Boolean(state.owned[id]);
const hasExtra = (id) => state.extras.some((x) => x.id === id);

// owned | locked (the gear before it comes first) | saving (needs more Fish) | ready
export function unlockStatus(id) {
  const u = unlockById(id);
  if (!u) return null;
  if (owns(id)) return { state: 'owned' };
  if (u.kind === 'gear') {
    const i = GEAR.findIndex((g) => g.id === id);
    if (i > 0 && !owns(GEAR[i - 1].id)) return { state: 'locked', after: GEAR[i - 1] };
  }
  const short = u.price - state.fish.balance;
  return short > 0 ? { state: 'saving', short } : { state: 'ready' };
}
export const nextGear = () => GEAR.find((g) => !owns(g.id)) || null;

export function buy(id) {
  const u = unlockById(id);
  const st = unlockStatus(id);
  if (!u || !st || st.state !== 'ready') return null;
  state.fish.balance -= u.price;
  state.owned[id] = { at: now().toISOString(), price: u.price };
  if (id === 'scarf') state.wear.scarf = true;
  if (id === 'cap') state.wear.hat = 'cap';
  if (id === 'backpack') state.wear.backpack = true;
  if (id === 'conductor') state.wear.outfit = true;
  logEvent('upgrade_purchased', { id, kind: u.kind, price: u.price, balance: state.fish.balance });
  return commit({ type: 'buy', id, item: u });
}

// Wearing changes only what shows. One hat at a time; the conductor outfit brings its own cap.
export function canWear(id) {
  if (['scarf', 'cap', 'backpack', 'conductor'].includes(id)) return owns(id);
  return hasExtra(id);
}
export function isWorn(id) {
  const w = state.wear;
  if (id === 'scarf') return w.scarf;
  if (id === 'backpack') return w.backpack;
  if (id === 'conductor') return w.outfit;
  if (id === 'cap' || id.startsWith('hat-')) return w.hat === id && !w.outfit;
  if (id.startsWith('decal-')) return w.decal === id;
  return false;
}
export function toggleWear(id) {
  if (!canWear(id)) return null;
  const w = state.wear;
  const on = !isWorn(id);
  if (id === 'scarf') w.scarf = on;
  else if (id === 'backpack') w.backpack = on;
  else if (id === 'conductor') w.outfit = on;
  else if (id === 'cap' || id.startsWith('hat-')) { w.hat = on ? id : null; if (on) w.outfit = false; }
  else if (id.startsWith('decal-')) w.decal = on ? id : null;
  return commit({ type: 'wear', id, on });
}
export function setPaint(id) {
  if (!PAINTS.some((p) => p.id === id) || (id !== 'navy' && !owns('paint'))) return null;
  state.wear.paint = id;
  return commit({ type: 'wear', id: `paint-${id}`, on: true });
}

// Everything Pengu and the train show right now, for the drawings.
export function look() {
  const w = state.wear;
  const hat = w.outfit && owns('conductor') ? 'conductor' : (w.hat && canWear(w.hat) ? w.hat : null);
  return {
    hat,
    scarf: w.scarf && owns('scarf'),
    backpack: w.backpack && owns('backpack'),
    outfit: w.outfit && owns('conductor'),
    decal: w.decal && hasExtra(w.decal) ? w.decal : null,
    paint: owns('paint') && PAINTS.some((p) => p.id === w.paint) ? w.paint : 'navy',
    headlamp: owns('headlamp'),
    car: owns('car'),
  };
}

// What Pengu and the train would show with one more unlock, for previews. Nothing is bought or saved.
export function lookWith(id, base = look()) {
  if (id === 'scarf') return { ...base, scarf: true };
  if (id === 'cap') return { ...base, hat: 'cap', outfit: false };
  if (id === 'backpack') return { ...base, backpack: true };
  if (id === 'conductor') return { ...base, outfit: true, hat: 'conductor' };
  if (id === 'headlamp') return { ...base, headlamp: true };
  if (id === 'car') return { ...base, car: true };
  if (id === 'paint') return { ...base, paint: base.paint === 'navy' ? 'coral' : base.paint };
  return base;
}

// ---------- Progress, as the screens show it (reads only; nothing here changes the save) ----------
// The goal Today and the reward sheet show: the next gear piece in its order, or the first train upgrade
// not owned yet, against the Fish in hand ("Scarf: 10 / 40 Fish"). Null once everything is owned.
export function nextGoal() {
  const item = nextGear() || TRAIN.find((t) => !owns(t.id)) || null;
  if (!item) return null;
  const balance = state.fish.balance;
  return { item, balance, price: item.price, ready: balance >= item.price };
}

// The first goal, as the first screen states it: the scarf's price, and what the smallest full week pays
// (2 planned workouts, both logged: 2 × 10 + the 25 week bonus = 45). True only if the plan is completed.
export function firstGoal() {
  const item = GEAR[0];
  const smallest = TARGETS[0];
  return { item, price: item.price, smallest, earns: smallest * FISH.station + FISH.weekBonus };
}

// How close the next unlock is if the player finishes this week's plan: the Fish in hand, plus 10 for each
// planned workout still open this week, plus the week bonus while it can still be earned. Comebacks and
// extra workouts are never counted. `inWeek`: finishing the plan reaches the price (not yet in hand).
export function reach(goal = nextGoal()) {
  if (!goal) return null;
  const r = route(thisWeek());
  const left = r ? r.open : 0;
  const need = r ? r.target - r.done : 0;
  const bonus = r && need > 0 && r.open >= need && !state.weekBonusPaid.includes(thisWeek()) ? FISH.weekBonus : 0;
  const potential = goal.balance + left * FISH.station + bonus;
  return { ...goal, left, bonus, potential, inWeek: !goal.ready && left > 0 && potential >= goal.price };
}

// The week's goal line. "one-left" and "more" only while every planned workout still open can hit the
// week (so the +25 is still in reach); "out-of-reach" once a planned day passed unlogged.
export function weekGoal(monday = thisWeek()) {
  const r = route(monday);
  if (!r) return null;
  const need = r.target - r.done;
  if (need <= 0) return { kind: 'hit' };
  if (r.open >= need) return { kind: need === 1 ? 'one-left' : 'more', need };
  if (r.open > 0) return { kind: 'out-of-reach', open: r.open };
  return { kind: 'over' };
}

// The next planned workout from today (from tomorrow once today is logged): this week's next open
// station, or the first one of next week once that week is planned. What it pays if it is logged as
// planned: 10, plus 15 if a comeback is due by then. `completes`: it would hit its week (+25).
export function nextStop() {
  const t = today();
  const from = state.log[t] ? addDays(t, 1) : t;
  for (const monday of [thisWeek(), addDays(thisWeek(), 7)]) {
    const plan = planFor(monday);
    const day = plan && stations(plan).find((d) => d >= from && !isDone(d));
    if (!day) continue;
    const r = route(monday);
    return { day, week: monday, fish: FISH.station, comeback: comebackDue(day) ? FISH.comeback : 0, completes: r.target - r.done === 1 };
  }
  return null;
}
// Next week can be planned now (the planning rules allow it from Sunday) and is not planned yet.
export const canPlanNextWeek = () => planningWeek() !== thisWeek() && !planFor(planningWeek());

// The first postcard: the first week whose every planned workout was logged. Worked out from the save
// each time, so it needs no record of its own and changes no Fish or counts.
export function firstFullWeek() {
  const monday = Object.keys(state.plans).sort().find((m) => weekHit(m));
  if (!monday) return null;
  const plan = planFor(monday);
  return { monday, done: plan.days.length, target: plan.target };
}

// ---------- Sharing: only what the player picks, and only from a tap ----------
// The Pengyu link is the address the site's owner wrote into the app page's
// <meta name="pengyu-share-url"> after opening it and seeing Pengyu load. Until then it is empty and no
// link is ever offered: Pengyu never guesses an address. Only a plain https address is accepted, with no
// login, query or fragment, so it cannot carry a tracking code.
export function shareLink(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return '';
  let url;
  try { url = new URL(text); } catch { return ''; }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || text.includes('?') || text.includes('#')) return '';
  if (!url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname)) return '';
  return url.href;
}
export function appLink() {
  const el = typeof document !== 'undefined' ? document.querySelector('meta[name="pengyu-share-url"]') : null;
  return shareLink(el ? el.getAttribute('content') : '');
}

const dayName = (key) => parseKey(key).toLocaleDateString('en-US', { weekday: 'long' });
const andList = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || '');
const clockText = (hhmm) => { const [hr, m] = hhmm.split(':').map(Number); return new Date(2000, 0, 1, hr, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };

// How a friend can try Pengyu: the owner's link when there is one; until then, an honest "ask me".
export const inviteLine = (url = appLink()) => (url ? `Plan your own week with Pengyu: ${url}` : 'Plan your own week with Pengyu. Ask me for the link.');

// The postcard: captions and props are chosen, never from anyone else; the dates and the workout count
// are added only when switched on, and so is the invitation line (on unless the player turns it off). No
// name or place, ever.
export const POSTCARD = {
  captions: ['Week complete with Pengu.', 'Every stop, start to finish.', 'Pengu and I reached the last station.'],
  props: [{ id: 'confetti', name: 'Confetti', mark: '🎉' }, { id: 'sun', name: 'Sunshine', mark: '☀️' }, { id: 'train', name: 'Train', mark: '🚂' }],
};
export function postcardText({ caption = 0, prop = '', dates = false, workouts = false, invite = false } = {}, card = firstFullWeek(), url = appLink()) {
  if (!card) return '';
  const p = POSTCARD.props.find((x) => x.id === prop);
  const lines = [`${POSTCARD.captions[caption] || POSTCARD.captions[0]}${p ? ` ${p.mark}` : ''}`];
  if (dates) {
    const fmt = (key) => parseKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    lines.push(`${fmt(card.monday)} – ${fmt(addDays(card.monday, 6))}`);
  }
  if (workouts) lines.push(`${card.done} of ${card.target} planned workouts`);
  if (invite) lines.push(inviteLine(url));
  return lines.join('\n');
}

// The invitation after a first plan: the same few words for everyone, then the Pengyu link when the
// owner set one, or "Ask me for the link." until then. The player's days, time and place appear only if
// they switch each one on. It claims nothing about the friend and pays nothing.
export const INVITE = [
  'I’m planning my workouts for the week with Pengyu.',
  'You pick 2 to 4 workouts, and Pengu’s train moves as you log them.',
  'Want to plan your own week?',
];
export function inviteText({ days = false, time = false, place = false } = {}, plan = planFor(shownWeek()), url = appLink()) {
  const lines = [...INVITE];
  if (plan && days) lines.push(`My days: ${andList(stations(plan).map(dayName))}.`);
  if (plan && time) lines.push(`My time: ${plan.window.startsWith('at ') ? clockText(plan.time) : `${plan.window}, ${clockText(plan.time)}`}.`);
  if (plan && place) lines.push(`My place: ${plan.place}.`);
  lines.push(url || 'Ask me for the link.');
  return lines.join('\n');
}

// ---------- A returning plan ----------
// Last plan, set on the week being planned: the same weekdays, time and place. A weekday that has
// passed this week is listed in `missing`, never swapped for another day; when fewer days are open than
// the last count, `target` is 0 so the player picks a number. Nothing is saved here.
export function planReview(week = planningWeek()) {
  if (planFor(week)) return null;
  const from = Object.keys(state.plans).filter((m) => m < week).sort().pop();
  if (!from) return null;
  const last = state.plans[from];
  const open = openDays(week);
  const onWeek = stations(last).map((d) => addDays(week, (parseKey(d).getDay() + 6) % 7));
  return {
    from, week, open,
    target: last.target <= open.length ? last.target : 0,
    days: onWeek.filter((d) => open.includes(d)),
    missing: onWeek.filter((d) => !open.includes(d)),
    time: last.time, window: last.window, place: last.place,
  };
}
// One tap to the same plan again: allowed only when last plan fits the week exactly as it is (every
// weekday still open, the same number). Otherwise the review asks the player to choose.
export function canRepeat(week = planningWeek()) {
  const rv = planReview(week);
  return Boolean(rv && rv.target && !rv.missing.length && rv.days.length === rv.target);
}
export function repeatLastPlan(week = planningWeek()) {
  if (!canRepeat(week)) return null;
  const rv = planReview(week);
  return createPlan({ week, target: rv.target, days: rv.days, time: rv.time, window: rv.window, place: rv.place });
}

// What Today and the review call it: "Review last week's plan" when it is last week's, and words that
// stay true on Sunday (planning next week from this one) or after a week without a plan.
export function reviewLabel(review = planReview()) {
  if (!review) return '';
  if (review.week === thisWeek() && review.from === addDays(review.week, -7)) return 'Review last week’s plan';
  if (review.week !== thisWeek() && review.from === thisWeek()) return 'Review this week’s plan for next week';
  return 'Review your last plan';
}

// ---------- Backups: export, check and import ----------
// A backup is the saved state itself, as JSON with v: 1. It is also the data export. Importing checks
// the whole file first and changes nothing unless every part of it is good.
export function exportData() {
  return JSON.stringify({ exportedAt: now().toISOString(), storageKey: KEY, ...state }, null, 2);
}

export const BACKUP_ERRORS = {
  notBackup: 'This file isn’t a Pengyu backup.',
  version: 'This backup is from a different version of Pengyu.',
  damaged: 'This backup looks damaged, so nothing was changed.',
};
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && dayKey(parseKey(s)) === s;
const isMonday = (s) => isDay(s) && weekStart(s) === s;
const isCount = (n) => Number.isInteger(n) && n >= 0;
const listOf = (a, ok) => a === undefined || (Array.isArray(a) && a.every(ok));
function shapeOk(d) {
  if (!isObj(d.plans) || !isObj(d.log) || !isObj(d.fish)) return false;
  if (!isCount(d.fish.balance) || !isCount(d.fish.lifetime) || d.fish.balance > d.fish.lifetime) return false;
  for (const [monday, p] of Object.entries(d.plans)) {
    if (!isMonday(monday) || !isObj(p) || !TARGETS.includes(p.target) || !Array.isArray(p.days)) return false;
    const week = weekDays(monday);
    if (p.days.length !== p.target || new Set(p.days).size !== p.days.length || !p.days.every((x) => week.includes(x))) return false;
    if (!TIME.test(String(p.time)) || !isText(p.window, 40) || !isText(p.place, 60) || !listOf(p.moves, isObj)) return false;
  }
  for (const [day, l] of Object.entries(d.log)) {
    if (!isDay(day) || !isObj(l) || !['planned', 'extra'].includes(l.kind)) return false;
    if ((l.comeback !== undefined && !isDay(l.comeback)) || (l.extra !== undefined && !extraById(l.extra))) return false;
  }
  if (!listOf(d.weekBonusPaid, isMonday) || !listOf(d.coversAnnounced, isMonday) || !listOf(d.events, isObj)) return false;
  if (!listOf(d.extras, (x) => isObj(x) && extraById(x.id) && isDay(x.earnedOn))) return false;
  if (d.owned !== undefined && (!isObj(d.owned) || !Object.keys(d.owned).every((id) => unlockById(id)))) return false;
  return d.wear === undefined || isObj(d.wear);
}

// Reads a backup without changing anything: { ok, summary: { weeks, fish } } or { ok: false, error }.
export function checkBackup(input) {
  let d;
  try { d = JSON.parse(typeof input === 'string' ? input : JSON.stringify(input)); } catch { return { ok: false, error: BACKUP_ERRORS.notBackup }; }
  if (!isObj(d) || !('v' in d)) return { ok: false, error: BACKUP_ERRORS.notBackup };
  if (d.v !== 1) return { ok: false, error: BACKUP_ERRORS.version };
  if (!shapeOk(d)) return { ok: false, error: BACKUP_ERRORS.damaged };
  return { ok: true, data: normalize(d), summary: { weeks: Object.keys(d.plans).length, fish: d.fish.balance } };
}

// Replaces everything saved here with a good backup.
export function importData(input) {
  const checked = checkBackup(input);
  if (!checked.ok) return checked;
  state = checked.data;
  logEvent('backup_restored', { ...checked.summary });
  commit({ type: 'restore' });
  return { ok: true, summary: checked.summary };
}

// These only add a line to the saved events, so the screen does not need to redraw.
function note(type, details) { logEvent(type, details); save(); }
export function markBackupSaved() { note('backup_saved', {}); }
// When a backup of this progress was last saved (from its own record of events), or '' if never.
export function lastBackupAt() {
  const e = [...state.events].reverse().find((x) => x.type === 'backup_saved' && typeof x.at === 'string');
  return e ? e.at : '';
}
// At most once a day.
export function noteAppOpened() {
  const t = today();
  const last = [...state.events].reverse().find((e) => e.type === 'app_opened');
  if (last && last.day === t) return false;
  note('app_opened', { day: t });
  return true;
}
export function markTipSeen() { state.tipSeen = true; save(); }

// Start over: forget everything Pengyu saved in this browser, and the old preview's leftovers too.
const OLD_KEYS = ['pengu.preview.v1', 'pengu.theme'];
export function reset() {
  for (const key of [KEY, ...OLD_KEYS]) {
    try { localStorage.removeItem(key); } catch { /* storage blocked: there is nothing saved to forget */ }
  }
  state = fresh();
  for (const fn of listeners) fn({ type: 'reset', saved: canSave });
  return true;
}
