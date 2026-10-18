// The preview's memory: one object in this browser's localStorage, never sent anywhere.
// It holds the streak days, Health Stars, the garden and the vault. Every change goes through
// update(), which saves and then tells subscribers what happened.

import { TIERS, SPECIES, PLOT_SPECIES, REWARDS } from './content.js';

const KEY = 'pengu.preview.v1';
const HOUR = 3600 * 1000;
export const GROW_TICK_HOURS = 3;          // passive growth: one point every 3 hours, even offline
export const STAGES = [0, 1, 3, 5, 7];     // growth points for seed, sprout, leafy, bud, bloom
const MAX_FREEZES = 5;

// ---------- Dates (local time, as YYYY-MM-DD keys) ----------
export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseKey(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); }
export function addDays(key, n) { const d = parseKey(key); d.setDate(d.getDate() + n); return dayKey(d); }
export function weekStart(key) { const d = parseKey(key); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return dayKey(d); }
export const today = () => dayKey();

// ---------- State ----------
function fresh() {
  return {
    v: 1,
    createdAt: Date.now(),
    days: {},              // dayKey -> { move, learn, play, rest, freeze, crown, activity, mins, plays }
    freezes: 2,
    autoFreeze: true,
    balance: 0,            // Stars to spend
    lifetime: 0,           // every Star earned; sets the tier
    bestStreak: 0,
    seeds: 1,
    plots: [null, null, null, null, null],
    plotsOpen: 3,
    lastWatered: 0,
    mutationsFound: [],
    firsts: { claim: false, plant: false },
    bests: { glide: 0 },
    rewards: { outfit: false, habitat: false, pass: false },
    goldWeek: '',
    reconciledThrough: '',
    vault: { moves: [], topics: [], winddown: '', saved: [] },
  };
}

function merge(base, saved) {
  if (!saved || typeof saved !== 'object' || saved.v !== 1) return base;
  const out = { ...base, ...saved };
  out.firsts = { ...base.firsts, ...saved.firsts };
  out.bests = { ...base.bests, ...saved.bests };
  out.rewards = { ...base.rewards, ...saved.rewards };
  out.vault = { ...base.vault, ...saved.vault };
  if (!Array.isArray(out.plots) || out.plots.length !== 5) out.plots = base.plots;
  return out;
}

let canSave = true;
function probe() {
  try {
    localStorage.setItem('pengu.probe', '1');
    localStorage.removeItem('pengu.probe');
    return true;
  } catch { return false; }
}
function load() {
  canSave = probe();
  if (!canSave) return fresh();
  try { return merge(fresh(), JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { return fresh(); }
}
function save() {
  if (!canSave) return false;
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { canSave = false; return false; }
}

export let state = load();
export const storageOk = () => canSave;
export function retryStorage() { canSave = probe(); if (canSave) save(); emit({ type: 'storage' }); return canSave; }

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(event) { for (const fn of listeners) fn(event); }

// Apply a change, save it and report it. `events` lists what happened, for effects and toasts.
export function update(mutator) {
  const events = [];
  const before = { tier: tierOf(state.lifetime).id, streak: streak() };
  mutator(state, events);
  reconcileGarden(events);
  const s = streak();
  if (s > state.bestStreak) state.bestStreak = s;
  const tier = tierOf(state.lifetime).id;
  if (tier !== before.tier) events.push({ type: 'tier', tier });
  if (s > before.streak) events.push({ type: 'streak', streak: s });
  const saved = save();
  emit({ type: 'change', events, saved });
  return events;
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
  state = fresh();
  save();
  emit({ type: 'change', events: [{ type: 'reset' }], saved: canSave });
}

// ---------- Streaks ----------
export const counts = (d) => Boolean(d && (d.move || d.learn || d.play || d.rest || d.freeze));
export function dayOf(key = today()) { return state.days[key] || {}; }

// Consecutive counted days ending today, or ending yesterday while today is still open.
export function streak() {
  let key = today();
  if (!counts(state.days[key])) key = addDays(key, -1);
  let n = 0;
  while (counts(state.days[key])) { n += 1; key = addDays(key, -1); }
  return n;
}
export const doneToday = () => counts(state.days[today()]);

// Once a day: cover missed days with freezes (only when there are enough to save the streak),
// and give Gold and Reserve members their free weekly freeze.
export function reconcile() {
  update((s, events) => {
    const t = today();
    const yesterday = addDays(t, -1);
    const counted = Object.keys(s.days).filter((k) => k < t && counts(s.days[k])).sort();
    const last = counted[counted.length - 1];
    if (last && s.autoFreeze && last < yesterday) {
      const start = s.reconciledThrough && s.reconciledThrough > last ? addDays(s.reconciledThrough, 1) : addDays(last, 1);
      const gap = [];
      for (let k = start; k <= yesterday; k = addDays(k, 1)) gap.push(k);
      if (gap.length && start === addDays(last, 1) && gap.length <= s.freezes) {
        for (const k of gap) s.days[k] = { ...(s.days[k] || {}), freeze: true };
        s.freezes -= gap.length;
        events.push({ type: 'freeze-used', count: gap.length });
      }
    }
    s.reconciledThrough = yesterday;
    if (tierOf(s.lifetime).id !== 'green' && s.goldWeek !== weekStart(t)) {
      s.goldWeek = weekStart(t);
      if (s.freezes < MAX_FREEZES) { s.freezes += 1; events.push({ type: 'weekly-freeze' }); }
    }
  });
}

// ---------- Health Stars ----------
export function tierOf(lifetime) {
  let tier = TIERS[0];
  for (const t of TIERS) if (lifetime >= t.min) tier = t;
  return tier;
}
export function nextTier(lifetime) { return TIERS.find((t) => t.min > lifetime) || null; }
function award(s, events, amount, reason) {
  const n = Math.round(amount * 10) / 10;
  s.balance = Math.round((s.balance + n) * 10) / 10;
  s.lifetime = Math.round((s.lifetime + n) * 10) / 10;
  events.push({ type: 'stars', amount: n, reason });
}
export const whole = (n) => Math.floor(n);
export function nextReward(balance) { return REWARDS.find((r) => r.cost > balance) || null; }

function water(s) {
  let watered = false;
  for (const p of s.plots) if (p && stageOf(p) < 4) { p.water += 1; watered = true; }
  if (watered) s.lastWatered = Date.now();
}

// Move, learn or play. The first of each per day earns 1 Star times the tier multiplier.
export function checkIn(node, extra = {}) {
  return update((s, events) => {
    const key = today();
    const d = (s.days[key] = s.days[key] || {});
    if (node === 'play') d.plays = (d.plays || 0) + 1;
    if (extra.activity) { d.activity = extra.activity; d.mins = extra.mins || ''; }
    if (d[node]) return;
    d[node] = true;
    const tier = tierOf(s.lifetime);
    award(s, events, node === 'move' ? tier.moveMult : tier.mult, node);
    events.push({ type: 'checkin', node });
    water(s);
    if (d.move && d.learn && d.play && !d.crown) {
      d.crown = true;
      award(s, events, 3, 'crown');
      s.seeds += 1;
      events.push({ type: 'crown' });
    }
  });
}

export function setRest(on) {
  return update((s, events) => {
    const key = today();
    const d = (s.days[key] = s.days[key] || {});
    d.rest = on;
    if (on && !d.restAwarded) {
      d.restAwarded = true;
      award(s, events, tierOf(s.lifetime).mult, 'rest');
      water(s);
      events.push({ type: 'rest' });
    }
  });
}

export function setAutoFreeze(on) { return update((s) => { s.autoFreeze = on; }); }

// A finished mini game: counts as Play, and its stage rating adds Stars once per game per day.
export function recordGame(game, rating, score = 0) {
  const events = checkIn('play');
  return events.concat(update((s, ev) => {
    const d = s.days[today()];
    if (game === 'sling' && !s.firsts.claim) {
      s.firsts.claim = true;
      award(s, ev, 20, 'first-claim');
      s.seeds += 1;
      ev.push({ type: 'first-claim' });
    }
    if (game === 'glide' && score > s.bests.glide) { s.bests.glide = score; ev.push({ type: 'best', game, score }); }
    const flag = `${game}Rated`;
    if (rating > 0 && !d[flag]) { d[flag] = true; award(s, ev, rating, 'rating'); }
  }));
}

export function redeem(cost, option) {
  return update((s, events) => {
    if (s.balance < cost) return;
    if (option === 'outfit' && s.rewards.outfit) return;
    if (option === 'habitat' && s.rewards.habitat) return;
    if (option === 'pass' && s.rewards.pass) return;
    s.balance = Math.round((s.balance - cost) * 10) / 10;
    if (option === 'freeze') s.freezes = Math.min(MAX_FREEZES, s.freezes + 1);
    if (option === 'seeds') s.seeds += 3;
    if (option === 'outfit') s.rewards.outfit = true;
    if (option === 'habitat') { s.rewards.habitat = true; s.plotsOpen = 5; }
    if (option === 'pass') s.rewards.pass = true;
    events.push({ type: 'redeem', option, cost });
  });
}

// ---------- Garden ----------
export function growth(plot, now = Date.now()) {
  return plot.water + Math.floor((now - plot.plantedAt) / (GROW_TICK_HOURS * HOUR));
}
export function stageOf(plot, now = Date.now()) {
  const g = growth(plot, now);
  let stage = 0;
  STAGES.forEach((min, i) => { if (g >= min) stage = i; });
  return stage;
}
// Milliseconds until the next stage without any watering.
export function msToNextStage(plot, now = Date.now()) {
  const stage = stageOf(plot, now);
  if (stage >= 4) return 0;
  const need = STAGES[stage + 1] - growth(plot, now);
  const hours = (now - plot.plantedAt) / HOUR;
  const target = (Math.floor(hours / GROW_TICK_HOURS) + need) * GROW_TICK_HOURS;
  return Math.max(0, (target - hours) * HOUR);
}

// Bloom time decides a rare mutation, once per plant: streaks favour chamomile, a Trifecta day
// favours mint, and an honored rest day or freeze favours lotus.
function mutationChance(species) {
  const t = today();
  const recent = [t, addDays(t, -1), addDays(t, -2)].map((k) => state.days[k] || {});
  if (species === 'chamomile') { const s = streak(); return s >= 14 ? 1 : s >= 7 ? 0.35 : 0; }
  if (species === 'mint') return recent.slice(0, 2).some((d) => d.crown) ? 0.4 : 0;
  if (species === 'lotus') return recent.some((d) => d.rest || d.freeze) ? 0.4 : 0;
  return 0;
}
function reconcileGarden(events) {
  state.plots.forEach((p, i) => {
    if (!p || p.mutation !== undefined || stageOf(p) < 4) return;
    const sp = SPECIES[p.species];
    if (Math.random() < mutationChance(p.species)) {
      p.mutation = sp.mutant;
      if (!state.mutationsFound.includes(sp.mutant)) state.mutationsFound.push(sp.mutant);
      events.push({ type: 'mutation', plot: i, name: sp.mutantName });
    } else {
      p.mutation = null;
      events.push({ type: 'bloom', plot: i, name: sp.name });
    }
  });
}
export function tickGarden() {
  // Called on a timer so plants grow on screen; only saves when something bloomed.
  const events = [];
  reconcileGarden(events);
  if (events.length) { save(); emit({ type: 'change', events, saved: canSave }); }
  else emit({ type: 'tick' });
}

export function plant(index) {
  return update((s, events) => {
    if (s.seeds < 1 || index >= s.plotsOpen || s.plots[index]) return;
    s.plots[index] = { species: PLOT_SPECIES[index], plantedAt: Date.now(), water: 0 };
    s.seeds -= 1;
    events.push({ type: 'plant', plot: index, name: SPECIES[PLOT_SPECIES[index]].name });
    if (!s.firsts.plant) { s.firsts.plant = true; award(s, events, 10, 'first-plant'); }
  });
}
export function firstEmptyPlot() {
  for (let i = 0; i < state.plotsOpen; i++) if (!state.plots[i]) return i;
  return -1;
}
export function harvest(index) {
  return update((s, events) => {
    const p = s.plots[index];
    if (!p || stageOf(p) < 4) return;
    const sp = SPECIES[p.species];
    s.plots[index] = null;
    s.seeds += 1;
    award(s, events, 2, 'harvest');
    events.push({ type: 'harvest', plot: index, name: p.mutation ? sp.mutantName : sp.name });
  });
}

// ---------- Vault ----------
export function setVault(patch) { return update((s) => { s.vault = { ...s.vault, ...patch }; }); }
export function rememberMove(activity) {
  if (state.vault.moves.includes(activity)) return false;
  update((s) => { s.vault.moves = [activity, ...s.vault.moves].slice(0, 6); });
  return true;
}
export function saveClaim(text) {
  return update((s) => {
    if (!s.vault.saved.includes(text)) s.vault.saved = [text, ...s.vault.saved].slice(0, 20);
  });
}
export function removeClaim(text) { return update((s) => { s.vault.saved = s.vault.saved.filter((c) => c !== text); }); }

// ---------- Week summary for the league ----------
export function weekStats() {
  const t = today();
  let days = 0; let rest = 0; let games = 0;
  for (let k = weekStart(t); k <= t; k = addDays(k, 1)) {
    const d = state.days[k];
    if (counts(d)) days += 1;
    if (d && (d.rest || d.freeze)) rest += 1;
    if (d && d.plays) games += d.plays;
  }
  return { days, rest, games };
}

export function lastActivity() {
  const t = today();
  for (let i = 1; i <= 3; i++) {
    const d = state.days[addDays(t, -i)];
    if (d && d.move && d.activity) return { daysAgo: i, activity: d.activity };
  }
  return null;
}
