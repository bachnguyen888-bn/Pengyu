// Today: "Workouts this week: X of N", the week drawn as a train route, and the one-tap log.
// Each planned day is a station. Logging a workout punches it and Pengu's train rolls up to it.
// A missed station stays visibly empty. No penalties, no shame: missing only means fewer Fish, and
// the first planned workout after a miss earns a Comeback stamp. The week streak sits on the route.

import * as S from './state.js';
import { downloadIcs } from './ics.js';
import { h, icon, weekday, monthDay, plural } from './ui.js';
import { penguFigure, carFigure, extraCarFigure } from './art.js';
import { countTo, toast as fxToast } from '../fx.js';

const toast = (title, sub) => fxToast(title, sub, penguFigure(S.look(), { cls: 'py-toast-art', view: 'bust' }));

let moving = '';        // the station whose "move to" picker is open
let lastTrainAt = null; // where the train was drawn last, so a log can roll it forward
let lastFish = null;     // the balance drawn last, so the counter only runs when it changes
let focusMove = false;

const STATUS = { done: 'done', today: 'planned for today', upcoming: 'planned', missed: 'missed' };

function goalLine(r) {
  const need = r.target - r.done;
  if (need <= 0) return { text: 'You hit your week.', tone: 'hit' };
  if (r.open >= need) return { text: `${need} more to hit your week.`, tone: 'goal' };
  if (r.open > 0) return { text: `${plural(r.open, 'station')} left this week.`, tone: 'calm' };
  return { text: 'This week’s route is done. A new week starts Monday.', tone: 'calm' };
}

function stationNode(s, i, count) {
  const date = S.parseKey(s.day);
  const name = weekday(date);
  const label = s.status === 'today' ? 'Today' : weekday(date, 'short');
  const stamped = Boolean(S.state.log[s.day] && S.state.log[s.day].comeback);
  const stop = h('span', { class: 'py-stop' }, s.status === 'done' ? icon('i-check') : null,
    stamped ? h('span', { class: `py-stamp${s.day === S.today() ? ' is-new' : ''}` }, icon('i-refresh')) : null);
  const text = h('span', { class: 'py-stop-day' }, label);
  const movable = S.canMove(s.day);
  const inner = movable
    ? h('button', {
      class: 'py-station-btn', type: 'button', 'aria-expanded': String(moving === s.day),
      'aria-label': `${name}, ${STATUS[s.status]}. Move this station.`,
      onclick: () => { moving = moving === s.day ? '' : s.day; focusMove = Boolean(moving); rerenderRef(); },
    }, stop, text)
    : h('span', { class: 'py-station-btn' }, stop, text, h('span', { class: 'sr-only' }, `${name}, ${STATUS[s.status]}${stamped ? ', with a Comeback stamp' : ''}`));
  const li = h('li', { class: `py-station is-${s.status}` }, inner);
  li.style.setProperty('--at', String((i + 1) / count));
  if (movable) inner.querySelector('.py-stop-day').setAttribute('aria-hidden', 'true');
  else text.setAttribute('aria-hidden', 'true');
  return li;
}

function trainNode(r) {
  const look = S.look();
  const train = h('div', { class: `py-train${look.car ? ' has-car2' : ''}`, 'aria-hidden': 'true' });
  const todayLog = S.state.log[S.today()];
  const rider = penguFigure(look, { cls: `py-rider${r.hit || (todayLog && todayLog.comeback) ? ' is-cheer' : ''}` });
  train.append(look.car ? extraCarFigure(look, 'py-car2') : '', rider, carFigure(look, 'py-car'));
  const at = r.trainAt / r.stations.length;
  const from = lastTrainAt === null ? at : lastTrainAt;
  train.style.setProperty('--at', String(from));
  if (from !== at) {
    requestAnimationFrame(() => requestAnimationFrame(() => train.style.setProperty('--at', String(at))));
  }
  lastTrainAt = at;
  return train;
}

function logArea(r) {
  const p = S.logPreview();
  const wrap = h('div', { class: 'py-log' });
  if (p.kind === 'logged') {
    const log = S.state.log[S.today()];
    if (log.comeback) {
      wrap.append(h('div', { class: 'py-celebrate', role: 'status' },
        penguFigure(S.look(), { cls: 'py-celebrate-art is-cheer' }),
        h('div', {},
          h('p', { class: 'py-celebrate-title' }, 'Welcome back! Comeback stamp earned.'),
          h('p', { class: 'small' }, `That’s ${S.FISH.comeback} bonus Fish. Pengu’s glad to ride with you again.`))));
    }
    wrap.append(
      h('p', { class: 'py-logged' }, icon('i-check'), log.kind === 'extra' ? 'Logged today as an extra ride' : 'Logged today'),
      h('p', { class: 'small muted' }, r.hit ? 'Your week is hit. Anything more this week is an extra ride.' : 'See you at your next station.'),
    );
    return wrap;
  }
  const btn = h('button', {
    class: `btn ${p.kind === 'extra' ? 'btn-secondary' : 'btn-primary'} btn-block py-log-btn`, type: 'button',
    onclick: () => {
      const res = S.logWorkout();
      if (!res) return;
      const got = res.extra ? ` You collected the ${res.extra.name} (looks only).` : '';
      if (res.comeback) {
        const parts = [res.fish && `${res.fish} for the station`, `${res.comeback} for your Comeback stamp`, res.bonus && `${res.bonus} for the full week`].filter(Boolean);
        toast(`Welcome back! +${res.fish + res.comeback + res.bonus} Fish`, `${parts.join(', ')}.${got}`);
      } else if (res.kind === 'extra') toast('Extra ride logged', `Extra rides pay no Fish.${got || ' You’ve collected every extra, and this still counts for you.'}`);
      else if (res.bonus) toast(`You hit your week! +${res.fish + res.bonus} Fish`, `${res.fish} for the station and ${res.bonus} for the full week. Week streak: ${S.weekStreak()}.`);
      else {
        const nr = S.route();
        toast(`Station punched. +${res.fish} Fish`, `${goalLine(nr).text}${res.movedFrom ? ` Your ${weekday(S.parseKey(res.movedFrom))} station moved to today.` : ''}`);
      }
      const again = document.querySelector('.py-count');
      if (again) again.focus({ preventScroll: true });
    },
  }, p.kind === 'extra' ? 'Log an extra ride' : 'I worked out today',
  p.fish ? h('span', { class: 'py-fish-badge' }, `+${p.fish} Fish`) : null,
  p.kind === 'extra' && p.extra ? h('span', { class: 'py-fish-badge' }, `+ ${p.extra.name}`) : null);
  wrap.append(btn);
  const notes = [];
  if (p.kind === 'moved') notes.push(`Today isn’t on your plan, so this moves your ${weekday(S.parseKey(p.from))} station to today.`);
  else if (p.kind === 'extra') notes.push(`Your stations are done or past, so this is an extra ride. Extra rides pay no Fish${p.extra ? `; this one adds the ${p.extra.name} to your extras (looks only)` : ''}.`);
  else notes.push('Any workout, any length. One tap, once a day.');
  if (p.comeback) notes.push(`Your first planned workout after a missed day earns a Comeback stamp and ${S.FISH.comeback} bonus Fish.`);
  wrap.append(h('p', { class: 'small muted' }, notes.join(' ')));
  return wrap;
}

function movePicker() {
  if (!moving || !S.canMove(moving)) { moving = ''; return null; }
  const targets = S.moveTargets(moving);
  const name = weekday(S.parseKey(moving));
  const box = h('div', { class: 'py-move', role: 'group', 'aria-labelledby': 'py-move-title' },
    h('p', { class: 'py-move-title', id: 'py-move-title' }, `Move ${name} to:`));
  if (!targets.length) box.append(h('p', { class: 'small muted' }, 'No free days are left this week.'));
  box.append(h('div', { class: 'py-choices' },
    targets.map((d) => h('button', {
      class: 'chip py-chip', type: 'button',
      onclick: () => {
        const from = moving;
        moving = '';
        if (S.moveStation(from, d)) toast(`Moved to ${weekday(S.parseKey(d))}`, 'No penalty. Download your updated calendar file below.');
      },
    }, d === S.today() ? 'Today' : `${weekday(S.parseKey(d), 'short')} ${monthDay(S.parseKey(d))}`)),
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { moving = ''; rerenderRef(); } }, 'Keep it')));
  return box;
}

function calendarArea(plan) {
  const fresh = plan.icsSeq === undefined;
  const stale = !fresh && plan.icsSeq !== plan.moves.length;
  const get = () => { downloadIcs(); S.markCalendarSaved(); };
  if (fresh || stale) {
    return h('div', { class: 'banner py-cal' },
      h('span', { class: 'banner-icon' }, icon('i-clock')),
      h('div', {},
        h('p', {}, fresh ? 'Get a reminder on each planned day.' : 'You moved a day. Your calendar still has the old one.'),
        h('div', { class: 'actions' },
          h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: get }, fresh ? 'Add to my calendar (.ics)' : 'Download the updated file (.ics)'))));
  }
  return h('p', { class: 'small muted py-cal-quiet' }, 'Reminders are in your calendar. ',
    h('button', { class: 'py-link', type: 'button', onclick: get }, 'Download the calendar file again'));
}

// Comeback stamps and looks-only extras, with the next extra always shown: no mystery items.
function collection() {
  const stamps = S.comebackStamps();
  const owned = S.state.extras.map((x) => S.extraById(x.id)).filter(Boolean);
  if (!stamps && !owned.length) return null;
  const next = S.nextExtra();
  return h('div', { class: 'py-collection' },
    h('p', { class: 'stat-label' }, 'Stamps and extras'),
    h('ul', { class: 'tag-list' },
      stamps ? h('li', { class: 'tag py-tag-stamp' }, icon('i-refresh'), `${plural(stamps, 'Comeback stamp')}`) : null,
      owned.map((e) => h('li', { class: 'tag' }, `${e.name}`))),
    h('p', { class: 'small muted' }, next
      ? `Extras are looks only and come in a set order. Next extra ride: ${next.name}.`
      : 'You’ve collected every extra. They’re looks only.'));
}

function coverLine() {
  const info = S.streakInfo();
  return h('p', { class: 'small muted py-cover' }, icon('i-shield'),
    info.coverReady
      ? 'Free streak cover ready this month'
      : 'Free streak cover used this month');
}

// Weeks only: the streak counts weeks hit, never days, and it rides along with the route.
function streakLine() {
  return h('div', { class: 'py-route-top' },
    h('p', { class: 'py-streak' }, h('span', { class: 'stat-label' }, 'Week streak'), h('span', { class: 'stat-value live' }, String(S.weekStreak()))),
    coverLine());
}

// The next piece of gear and how far off it is, so every unlock has a visible price and a preview.
function nextUnlockLine(onShop) {
  const g = S.nextGear();
  if (!g) return null;
  const st = S.unlockStatus(g.id);
  const text = st.state === 'ready'
    ? `You can unlock the ${g.name} now (${g.price} Fish).`
    : `Next unlock: ${g.name} · ${g.price} Fish · ${st.short} more to go.`;
  return h('div', { class: 'py-next' },
    h('span', { class: 'py-glyph-chip', 'aria-hidden': 'true' }, penguFigure({ ...S.look(), ...gearPreview(g.id) }, { cls: 'py-next-art', view: 'bust' })),
    h('p', { class: 'small' }, text, ' ',
      h('button', { class: 'py-link', type: 'button', onclick: onShop }, 'See Pengu’s upgrades')));
}
// Pengu shown wearing the next piece, as a preview of what it unlocks.
function gearPreview(id) {
  if (id === 'scarf') return { scarf: true };
  if (id === 'cap') return { hat: 'cap', outfit: false };
  if (id === 'backpack') return { backpack: true };
  return { outfit: true, hat: 'conductor' };
}

let rerenderRef = () => {};

export function renderToday(root, rerender, { focus, onShop = () => {} } = {}) {
  rerenderRef = rerender;
  const r = S.route();
  const monday = S.thisWeek();
  const sunday = S.addDays(monday, 6);
  const goal = goalLine(r);
  const fishValue = h('span', { class: 'stat-value fish' }, icon('i-fish'), h('span', { class: 'py-fish-n' }));
  const heading = h('h3', { class: 'py-count', tabindex: '-1' },
    'Workouts this week: ', h('span', { class: 'py-nowrap' }, h('strong', {}, String(r.done)), ` of ${r.target}`));

  root.append(
    h('div', { class: 'py-today' },
      h('div', { class: 'py-head' },
        h('div', {},
          h('p', { class: 'eyebrow' }, `This week · ${monthDay(S.parseKey(monday))} – ${monthDay(S.parseKey(sunday))}`),
          heading),
        h('div', { class: 'py-stats' },
          h('div', { class: 'stat' }, h('span', { class: 'stat-label' }, 'Fish'), fishValue))),
      h('div', { class: 'py-route-box' },
        streakLine(),
        h('div', { class: 'py-route-wrap' },
          h('ol', { class: 'py-route', 'aria-label': 'Your route this week' },
            h('li', { class: 'py-depot', 'aria-hidden': 'true' }),
            r.stations.map((s, i) => stationNode(s, i, r.stations.length))),
          trainNode(r))),
      h('p', { class: `py-goal is-${goal.tone}`, 'aria-live': 'polite' }, goal.text,
        r.extras ? h('span', { class: 'muted' }, ` Extra rides: ${r.extras}.`) : null),
      movePicker(),
      logArea(r),
      nextUnlockLine(onShop),
      collection(),
      calendarArea(r.plan),
      h('p', { class: 'small muted py-plan-line' }, `Your plan: ${r.plan.window}, ${r.plan.place}. Tap an open station to move it.`),
    ),
  );
  const fishN = fishValue.querySelector('.py-fish-n');
  fishN.dataset.value = String(lastFish === null ? S.state.fish.balance : lastFish);
  countTo(fishN, S.state.fish.balance);
  lastFish = S.state.fish.balance;
  if (focus) heading.focus({ preventScroll: true });
  if (moving && focusMove) { focusMove = false; const first = root.querySelector('.py-move .chip, .py-move .btn'); if (first) first.focus({ preventScroll: true }); }
}
