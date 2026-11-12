// Exercise the shipped functions with a controlled browser clock and animation/DOM boundaries.
// Imports are supplied by the harness; no reward, timing or counter implementation is copied here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
function load(file, globals, expose) {
  const source = read(file).replace(/^import[^\n]*\r?\n/gm, '').replace(/^export /gm, '');
  const context = vm.createContext(globals);
  vm.runInContext(`${source}\n${expose}`, context, { filename: file });
  return context.__api;
}

function clock() {
  let now = 0;
  let id = 0;
  const timers = new Map();
  const frames = new Map();
  const api = {
    now: () => now,
    setTimeout(fn, delay = 0) { const n = ++id; timers.set(n, { at: now + Math.max(0, delay), fn }); return n; },
    clearTimeout(n) { timers.delete(n); },
    requestAnimationFrame(fn) { const n = ++id; frames.set(n, fn); return n; },
    cancelAnimationFrame(n) { frames.delete(n); },
    advance(to) {
      assert.ok(to >= now, 'clock only moves forward');
      while (true) {
        const due = [...timers].filter(([, t]) => t.at <= to).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        timers.delete(due[0]); now = due[1].at; due[1].fn();
      }
      now = to;
    },
    frame(to) {
      api.advance(to);
      const ready = [...frames]; frames.clear();
      for (const [, fn] of ready) fn(now);
    },
    timers: () => timers.size,
    frames: () => frames.size,
  };
  return api;
}

class Node {
  constructor(children = []) {
    this.children = children;
    this.dataset = {};
    this.attrs = {};
    this.isConnected = true;
    this.props = {};
    this.style = { setProperty: (key, value) => { this.props[key] = value; } };
    const classes = new Set();
    this.classList = {
      add: (name) => classes.add(name), remove: (name) => classes.delete(name),
      toggle: (name, on) => { if (on) classes.add(name); else classes.delete(name); },
      contains: (name) => classes.has(name),
    };
  }
  setAttribute(key, value) { this.attrs[key] = value; }
  append(...children) { this.children.push(...children.flat(Infinity)); }
  addEventListener() {}
  showModal() { this.open = true; }
  get textContent() { return this.children.map((c) => c instanceof Node ? c.textContent : String(c)).join(''); }
  set textContent(text) { this.children = [String(text)]; }
}
const h = (_tag, attrs, ...children) => {
  const node = new Node(children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, value);
  return node;
};
function browserClock(time, reduced) {
  return {
    setTimeout: time.setTimeout, clearTimeout: time.clearTimeout,
    requestAnimationFrame: time.requestAnimationFrame, cancelAnimationFrame: time.cancelAnimationFrame,
    performance: { now: time.now },
    window: { matchMedia: () => ({ get matches() { return reduced.value; } }) },
  };
}

function motion(time = clock(), reduced = { value: false }) {
  const animations = [];
  const sets = [];
  const api = load('js/pengyu/motion.js', {
    ...browserClock(time, reduced), document: { hidden: false, addEventListener() {} },
    spring: () => ({}), stagger: (n) => n,
    animate: (target, options) => { animations.push({ at: time.now(), target, options }); },
    utils: { set: (target, options) => sets.push({ target, options }) },
  }, 'globalThis.__api = { rollTrain, fillStation };');
  return { ...api, time, animations, sets };
}

function effects(time = clock(), reduced = { value: false }) {
  return load('js/fx.js', { ...browserClock(time, reduced) }, 'globalThis.__api = { countTo };');
}

function route(time = clock(), reduced = { value: false }) {
  let day = '2026-11-09';
  const events = [];
  const live = new Node();
  const nodes = Object.fromEntries(['.py-station.is-arriving', '.py-count-n', '.py-goal', '.py-fish-n', '.py-fishpill'].map((q) => [q, new Node()]));
  nodes['.py-fish-n'].dataset.value = '0';
  const view = { isConnected: true, querySelector: (q) => nodes[q] };
  const res = { kind: 'planned', fish: 10, bonus: 0, comeback: 0 };
  const resultRoute = { done: 0, target: 3, hit: false };
  const S = {
    state: { fish: { balance: 0 } }, route: () => resultRoute,
    today: () => day, thisWeek: () => '2026-11-09', weekGoal: () => ({ kind: 'more', need: 2 }),
    nextGoal: () => ({ item: { id: 'scarf', name: 'Scarf' }, balance: 0, price: 40 }),
    logPreview: () => ({ kind: 'planned' }),
    logWorkout: () => { S.state.fish.balance = 10; resultRoute.done = 1; return res; },
  };
  const token = {
    drop: () => events.push(['drop', time.now()]),
    land: (pill) => events.push(['land', time.now(), pill]),
  };
  const fx = effects(time, reduced);
  const api = load('js/pengyu/route.js', {
    ...browserClock(time, reduced), S, h,
    navigator: { vibrate: (ms) => events.push(['vibrate', time.now(), ms]) },
    document: { getElementById: () => live, querySelector: (q) => nodes[q], body: new Node() },
    reducedMotion: () => reduced.value,
    fishToken: (_station, text) => { events.push(['token', time.now(), text]); return token; },
    fillStation: (station) => events.push(['fill', time.now(), station]),
    sheetIn: (panel) => events.push(['sheet', time.now(), panel]),
    countTo: (node, to) => { events.push(['count', time.now(), to]); fx.countTo(node, to); },
    __reward: (result, before) => events.push(['reward', time.now(), result, before]),
  }, `
    primeRewardArt = () => {};
    openReward = __reward;
    globalThis.__api = {
      begin, arrive, leaveToday, fishOf, openSheet, openTip,
      state: () => ({ pending, token, rewardTimer, inviteTimer, bound, lastAt, sheet }),
      seed: (x) => {
        if ('pending' in x) pending = x.pending;
        if ('token' in x) token = x.token;
        if ('bound' in x) bound = x.bound;
        if ('lastAt' in x) lastAt = x.lastAt;
        if ('sheet' in x) sheet = x.sheet;
        if ('inviteTimer' in x) inviteTimer = x.inviteTimer;
      },
    };
  `);
  return { ...api, time, reduced, events, live, view, nodes, S, token, res, setDay: (value) => { day = value; } };
}

test('train reaches its station at 1250ms, before the 1480ms settle; reduced motion and no movement arrive immediately', () => {
  const m = motion();
  const train = { querySelectorAll: (q) => [q], querySelector: () => null };
  const arrivals = [];
  m.rollTrain(train, -180, { onArrive: () => arrivals.push(m.time.now()) });
  assert.equal(m.animations[0].options.translateX[0].duration, 1250);
  assert.equal(m.animations[1].options.duration, 1480);
  m.time.advance(1249); assert.equal(arrivals.length, 0);
  m.time.advance(1250); assert.deepEqual(arrivals, [1250]);
  m.time.advance(2000); assert.deepEqual(arrivals, [1250], 'only one arrival');
  const reduced = motion(clock(), { value: true });
  reduced.rollTrain(train, -180, { onArrive: () => arrivals.push('reduced') });
  assert.equal(reduced.animations.length, 0);
  assert.equal(reduced.time.timers(), 0);
  assert.equal(arrivals.at(-1), 'reduced');
  const still = motion();
  still.rollTrain(train, 0, { onArrive: () => arrivals.push('still') });
  assert.equal(still.animations.length, 0);
  assert.equal(arrivals.at(-1), 'still');
});

test('station check fills on arrival and has an instant reduced-motion fallback', () => {
  const disc = new Node(); const tick = new Node();
  const station = { querySelector: (q) => q === '.py-ring-fill' ? disc : tick };
  const m = motion(); m.fillStation(station);
  assert.equal(m.animations[0].options.duration, 220);
  assert.equal(m.animations[1].options.duration, 300);
  assert.equal(m.animations[1].options.delay, 90);
  const r = motion(clock(), { value: true }); r.fillStation(station);
  assert.equal(r.animations.length, 0);
  assert.equal(r.sets[0].options.opacity, 1);
  assert.equal(tick.props['stroke-dashoffset'], '0');
});

test('Fish counter finishes in 650ms; reduced motion cancels an in-flight count and updates instantly', () => {
  const time = clock(); const reduced = { value: false }; const fx = effects(time, reduced);
  const n = new Node(['0']); n.dataset.value = '0';
  fx.countTo(n, 10);
  assert.equal(n.dataset.value, '10');
  time.frame(325); assert.equal(n.textContent, '9');
  time.frame(650); assert.equal(n.textContent, '10');
  assert.equal(time.frames(), 0);
  fx.countTo(n, 25);
  assert.equal(time.frames(), 1);
  reduced.value = true; fx.countTo(n, 40, (value) => `${value} Fish`);
  assert.equal(n.textContent, '40 Fish');
  assert.equal(time.frames(), 0, 'no old frame can overwrite the instant result');
  time.frame(1400); assert.equal(n.textContent, '40 Fish');
});

test('a log acknowledges immediately, arrives at 1250ms and opens its exact reward at 1850ms', () => {
  const r = route();
  r.seed({ bound: [{ celebrate: () => r.events.push(['celebrate', r.time.now()]) }] });
  r.begin();
  const pending = r.state().pending;
  assert.equal(pending.res, r.res);
  assert.equal(r.events.find(([kind]) => kind === 'token')[2], '+10');
  assert.equal(r.events.find(([kind]) => kind === 'vibrate')[2], 10);
  const m = motion(r.time);
  m.rollTrain({ querySelectorAll: () => [], querySelector: () => null }, -180, { onArrive: () => r.arrive(r.view, pending) });
  r.time.advance(60); assert.equal(r.live.textContent, 'Workout logged.', 'acknowledged before train arrival');
  r.time.advance(1249); assert.equal(r.events.some(([kind]) => kind === 'fill'), false);
  r.time.advance(1250);
  assert.equal(r.nodes['.py-count-n'].textContent, '1 of 3');
  assert.equal(r.nodes['.py-fishpill'].attrs['aria-label'], '10 Fish');
  assert.equal(r.events.find(([kind]) => kind === 'count')[2], 10);
  assert.equal(r.events.find(([kind]) => kind === 'land')[1], 1250);
  r.time.frame(1266); assert.equal(r.events.filter(([kind]) => kind === 'celebrate').length, 1);
  r.time.advance(1849); assert.equal(r.events.some(([kind]) => kind === 'reward'), false);
  r.time.advance(1850);
  const reward = r.events.find(([kind]) => kind === 'reward');
  assert.equal(reward[1], 1850);
  assert.equal(reward[2], r.res);
  assert.equal(reward[3], pending.before.next);
  assert.ok(reward[1] < 3000, 'within three seconds of the log');
});

test('reduced-motion arrival updates the real count immediately and opens the reward without a motion delay', () => {
  const r = route(clock(), { value: true });
  r.begin(); const pending = r.state().pending;
  const m = motion(r.time, r.reduced);
  m.rollTrain({ querySelectorAll: () => [], querySelector: () => null }, -180, { onArrive: () => r.arrive(r.view, pending) });
  assert.equal(r.nodes['.py-fish-n'].textContent, '10');
  assert.equal(r.state().rewardTimer > 0, true);
  r.time.advance(0);
  assert.equal(r.events.find(([kind]) => kind === 'reward')[1], 0);
  assert.equal(m.animations.length, 0);
});

test('an old or disconnected arrival cannot consume the active log, token or reward', () => {
  const r = route(); r.begin();
  const active = r.state().pending;
  r.arrive({ isConnected: false }, active);
  assert.equal(r.state().pending, active, 'a detached view leaves the current pending untouched');
  assert.equal(r.state().token, r.token);
  r.arrive(r.view, { res: r.res });
  assert.equal(r.state().pending, active, 'an older callback cannot consume a newer pending');
  assert.equal(r.state().token, r.token);
  assert.equal(r.events.some(([kind]) => ['drop', 'land', 'reward', 'count'].includes(kind)), false);
  r.arrive(r.view, active); r.time.advance(600);
  assert.equal(r.events.filter(([kind]) => kind === 'reward').length, 1);
});

test('leaving Today cancels reward/invite timers, drops the token, stops bindings and closes the sheet synchronously', () => {
  const r = route(); r.begin(); const old = r.state().pending;
  r.arrive(r.view, old); // reward waits 600ms
  const calls = [];
  r.seed({
    pending: { res: r.res }, token: r.token, lastAt: 0.5,
    inviteTimer: r.time.setTimeout(() => calls.push('invite'), 350),
    bound: [{ stop: () => calls.push('stop1') }, { stop: () => calls.push('stop2') }],
    sheet: {
      cleanup: () => calls.push('cleanup'),
      dlg: { close: () => calls.push('close'), remove: () => calls.push('remove') },
      returnFocus: () => ({ focus: () => calls.push('focus') }),
      onClosed: () => calls.push('onClosed'),
    },
  });
  r.leaveToday();
  const state = r.state();
  assert.equal(state.pending, null); assert.equal(state.token, null);
  assert.equal(state.rewardTimer, 0); assert.equal(state.inviteTimer, 0);
  assert.equal(state.lastAt, null); assert.equal(state.bound.length, 0); assert.equal(state.sheet, null);
  assert.deepEqual(calls, ['stop1', 'stop2', 'cleanup', 'close', 'remove', 'focus']);
  assert.equal(r.events.filter(([kind]) => kind === 'drop').length, 1);
  r.arrive(r.view, old); // the outstanding roll callback must now be harmless
  r.time.advance(3000);
  assert.equal(calls.includes('invite'), false);
  assert.equal(calls.includes('onClosed'), false, 'navigation cannot trigger the after-reward Home Screen tip');
  assert.equal(r.events.some(([kind]) => kind === 'reward'), false);
});

test('midnight preserves the logged Fish but discards yesterday’s in-flight arrival and delayed reward', () => {
  const beforeArrival = route(); beforeArrival.begin();
  const old = beforeArrival.state().pending;
  beforeArrival.setDay('2026-11-10');
  beforeArrival.arrive(beforeArrival.view, old);
  assert.equal(beforeArrival.state().pending, null);
  assert.equal(beforeArrival.state().token, null);
  assert.equal(beforeArrival.events.filter(([kind]) => kind === 'drop').length, 1);
  beforeArrival.time.advance(3000);
  assert.equal(beforeArrival.events.some(([kind]) => ['fill', 'count', 'reward'].includes(kind)), false);
  assert.equal(beforeArrival.S.state.fish.balance, 10, 'UI cancellation does not reverse a saved workout');

  const beforeReward = route(); beforeReward.begin();
  beforeReward.arrive(beforeReward.view, beforeReward.state().pending);
  beforeReward.setDay('2026-11-10');
  beforeReward.time.advance(600);
  assert.equal(beforeReward.events.some(([kind]) => kind === 'reward'), false);
  assert.equal(beforeReward.S.state.fish.balance, 10);
});

test('a player-chosen sheet cancels the first-plan invitation and suppresses late reward and Home Screen tip overlays', () => {
  const r = route(); r.begin();
  let invited = false;
  r.seed({ inviteTimer: r.time.setTimeout(() => { invited = true; }, 350) });
  r.openSheet('py-weeksheet', 'week-title', (panel) => panel.append(new Node(['My week'])));
  const chosen = r.state().sheet;
  assert.equal(chosen.dlg.open, true);
  assert.equal(r.state().inviteTimer, 0);
  assert.equal(r.state().pending.suppressReward, true);
  r.arrive(r.view, r.state().pending);
  assert.equal(r.state().rewardTimer, 0);
  r.openTip(); // a delayed tip must return before doing any work while this sheet is open
  r.time.advance(3000);
  assert.equal(invited, false);
  assert.equal(r.state().sheet, chosen);
  assert.equal(r.events.filter(([kind]) => kind === 'sheet').length, 1);
  assert.equal(r.events.some(([kind]) => kind === 'reward'), false);
});

test('the next-gear display counts saved balance toward its price and never shows an overfilled unlock', () => {
  const r = route();
  const goal = { item: { id: 'scarf', name: 'Scarf' }, balance: 10, price: 40, ready: false };
  const before = { ...goal, balance: 0 };
  const words = r.fishOf(goal, before);
  const display = words[1];
  assert.equal(display.textContent, '0 / 40 Fish');
  assert.equal(words[2].textContent, '10 of 40 Fish', 'assistive text announces only the final balance');
  r.time.advance(150); r.time.frame(800);
  assert.equal(display.textContent, '10 / 40 Fish');
  assert.equal(r.fishOf({ ...goal, balance: 55, ready: true }, before)[0], 'Scarf: ready to unlock');
});
