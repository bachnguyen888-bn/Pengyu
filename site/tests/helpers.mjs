// Shared by the rule tests (not a test file itself). Each call gives a fresh copy of state.js with its
// own in-memory storage and an injected clock, so nothing leaks between tests.

let copy = 0;
export function memoryStorage(saved) {
  const m = new Map(saved ? [['pengyu.v1', JSON.stringify(saved)]] : []);
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

// A fresh app at a moment in local time ("2026-10-26T08:00"), optionally with saved data.
export async function freshApp(when, saved) {
  globalThis.localStorage = memoryStorage(saved);
  const S = await import(new URL(`../js/pengyu/state.js?copy=${++copy}`, import.meta.url));
  S.setClock(() => new Date(when));
  return S;
}

// The same browser after a reload: a new copy of state.js reading what the last one saved.
export async function reload(S, when) {
  const saved = JSON.parse(globalThis.localStorage.getItem('pengyu.v1'));
  const next = await freshApp(when, saved);
  return next;
}

export const at = (S, when) => S.setClock(() => new Date(when));

// A plan for the planning week: "after class, at the gym" on the given days.
export const plan = (S, days, extra = {}) => S.createPlan({ target: days.length, days, time: '15:30', window: 'after class', place: 'at the gym', ...extra });

// Log a workout at 5 PM on a day (or another time).
export function logOn(S, day, hm = '17:00') {
  at(S, `${day}T${hm}`);
  return S.logWorkout();
}

// Live through a week: plan it on its Monday morning, then log the given days.
export function liveWeek(S, monday, days, done = days) {
  at(S, `${monday}T07:00`);
  const made = plan(S, days);
  for (const d of done) logOn(S, d);
  return made;
}

// Saved data with Fish to spend, for the unlock rules.
export const rich = (balance) => ({ v: 1, plans: {}, log: {}, fish: { balance, lifetime: balance } });
