// History: every week since the first plan, newest first, with how many planned workouts were done,
// the Fish each week paid, and its Comeback stamps and extras. "Your data" holds Save a backup (also
// the data export), Restore from a backup and Reset.
// No ranking and no comparison: only this player's own weeks.

import * as S from './state.js';
import { saveBackup } from './backup.js';
import { h, icon, monthDay, plural } from './ui.js';
import { toast, reducedMotion } from '../fx.js';

let confirming = false;   // Reset waits for a second, explicit tap
let restore = null;       // a checked backup waiting for the player's yes ({ text, summary }), or { error }
let refocus = '';

// Mondays from the first planned (or logged) week up to this one, newest first.
function mondays() {
  const seen = new Set(Object.keys(S.state.plans));
  for (const d of Object.keys(S.state.log)) seen.add(S.weekStart(d));
  const first = [...seen].sort()[0];
  const out = [];
  if (!first) return out;
  for (let m = S.thisWeek(); m >= first; m = S.addDays(m, -7)) out.push(m);
  return out;
}

// What a week paid: 10 per planned workout, 15 per comeback, 25 for the full week. Extras pay nothing.
function weekFish(monday) {
  let fish = 0;
  for (const d of S.weekDays(monday)) {
    const log = S.state.log[d];
    if (!log) continue;
    if (log.kind === 'planned') fish += S.FISH.station;
    if (log.comeback) fish += S.FISH.comeback;
  }
  if (S.state.weekBonusPaid.includes(monday)) fish += S.FISH.weekBonus;
  return fish;
}

function weekCard(monday, covered) {
  const current = monday === S.thisWeek();
  const days = S.weekDays(monday);
  const r = S.planFor(monday) ? S.route(monday) : null;
  const stamps = days.filter((d) => S.state.log[d] && S.state.log[d].comeback).length;
  const extras = S.state.extras.filter((x) => days.includes(x.earnedOn)).map((x) => S.extraById(x.id)).filter(Boolean);
  const fish = weekFish(monday);
  const tags = [
    r && r.hit ? h('li', { class: 'py-tag is-hit' }, icon('i-check'), 'Week hit') : null,
    covered ? h('li', { class: 'py-tag' }, icon('i-shield'), 'Free streak cover used') : null,
    stamps ? h('li', { class: 'py-tag is-stamp' }, icon('i-refresh'), plural(stamps, 'Comeback stamp')) : null,
    ...extras.map((e) => h('li', { class: 'py-tag' }, e.name)),
  ].filter(Boolean);
  let line = 'No plan that week';
  if (r) line = `${r.done} of ${r.target} planned workouts${current && !r.hit ? ' so far' : ''}`;
  else if (current) line = 'No plan yet this week';
  return h('li', { class: 'py-week' },
    h('div', { class: 'py-week-top' },
      h('h3', { class: 'py-week-title' }, current ? 'This week' : `Week of ${monthDay(S.parseKey(monday))}`),
      h('p', { class: 'py-week-fish' }, icon('i-fish'), `+${fish}`, h('span', { class: 'sr-only' }, ' Fish'))),
    r ? h('ol', { class: 'py-week-dots', 'aria-hidden': 'true' }, r.stations.map((s) => h('li', { class: `py-dot is-${s.status}` }))) : null,
    h('p', { class: 'py-week-line' }, line),
    tags.length ? h('ul', { class: 'py-week-tags' }, tags) : null);
}

// Restore: pick a file, see what it holds ("4 weeks, 230 Fish"), say yes, and only then replace.
async function readPicked(e, rerender) {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  let text = '';
  try { text = await f.text(); } catch { text = ''; }
  const checked = S.checkBackup(text);
  restore = checked.ok ? { text, summary: checked.summary } : { error: checked.error };
  confirming = false;
  refocus = checked.ok ? 'py-restore-yes' : 'py-restore';
  rerender();
}

function dataCard(rerender, onReset, onRestore) {
  const file = h('input', { class: 'sr-only', type: 'file', accept: 'application/json,.json', tabindex: '-1', 'aria-hidden': 'true', onchange: (e) => readPicked(e, rerender) });
  const card = h('section', { class: 'py-data', 'aria-labelledby': 'py-data-title' },
    h('h2', { class: 'py-section-title', id: 'py-data-title' }, 'Your data'),
    h('p', { class: 'small muted' }, 'Everything is saved only in this browser. A backup file keeps Pengu safe.'),
    h('div', { class: 'py-data-actions' },
      h('button', {
        class: 'btn btn-secondary btn-sm', type: 'button', id: 'py-backup',
        onclick: () => { saveBackup(); toast('Backup saved.', 'Keep the file somewhere safe.'); },
      }, 'Save a backup'),
      h('button', {
        class: 'btn btn-secondary btn-sm', type: 'button', id: 'py-restore',
        onclick: () => file.click(),
      }, 'Restore from a backup'),
      h('button', {
        class: 'btn btn-ghost btn-sm', type: 'button', id: 'py-reset', 'aria-expanded': String(confirming),
        onclick: () => { confirming = !confirming; restore = null; refocus = confirming ? 'py-reset-yes' : 'py-reset'; rerender(); },
      }, 'Reset')),
    file);
  if (restore && restore.error) {
    card.append(h('p', { class: 'py-data-error', role: 'alert' }, icon('i-alert'), h('span', {}, restore.error)));
  } else if (restore) {
    const { weeks, fish } = restore.summary;
    card.append(h('div', { class: 'py-restore-confirm', role: 'group', 'aria-labelledby': 'py-restore-q' },
      h('p', { id: 'py-restore-q' }, h('strong', {}, `This backup has ${plural(weeks, 'week')}, ${fish} Fish.`), ' Restoring replaces what’s saved here now.'),
      h('div', { class: 'py-data-actions' },
        h('button', {
          class: 'btn btn-primary btn-sm', type: 'button', id: 'py-restore-yes',
          onclick: () => {
            const text = restore.text;
            restore = null;
            const res = S.importData(text);
            if (res.ok) onRestore(res.summary);
            else { restore = { error: res.error }; refocus = 'py-restore'; rerender(); }
          },
        }, 'Restore'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { restore = null; refocus = 'py-restore'; rerender(); } }, 'Cancel'))));
  }
  if (confirming) {
    card.append(h('div', { class: 'py-reset-confirm', role: 'group', 'aria-labelledby': 'py-reset-q' },
      h('p', { id: 'py-reset-q' }, 'Start over? This clears your plan, workouts, Fish, gear and extras from this browser. It can’t be undone.'),
      h('div', { class: 'py-data-actions' },
        h('button', { class: 'btn btn-danger btn-sm', type: 'button', id: 'py-reset-yes', onclick: () => { confirming = false; S.reset(); onReset(); } }, 'Reset everything'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { confirming = false; refocus = 'py-reset'; rerender(); } }, 'Keep my data'))));
  }
  return card;
}

export function renderHistory(root, rerender, { onReset = () => {}, onRestore = () => {} } = {}) {
  const info = S.streakInfo();
  const weeks = mondays();
  const view = h('div', { class: 'py-view' },
    h('h1', { class: 'py-view-title' }, 'History'),
    h('ul', { class: 'py-hist-summary', 'aria-label': 'All time' },
      h('li', {}, `Week streak ${info.streak}`),
      h('li', {}, `${S.state.fish.lifetime} Fish earned`),
      h('li', {}, plural(S.comebackStamps(), 'Comeback stamp')),
      h('li', {}, plural(S.state.extras.length, 'extra'))),
    weeks.length
      ? h('ol', { class: 'py-weeks', 'aria-label': 'Your weeks, newest first' }, weeks.map((m) => weekCard(m, info.covered.includes(m))))
      : h('p', { class: 'muted' }, 'Your weeks show up here once you plan your first one.'),
    dataCard(rerender, onReset, onRestore));
  root.append(view);
  if (refocus) {
    const el = root.querySelector(`#${refocus}`);
    refocus = '';
    if (el) el.focus({ preventScroll: true });
    // A panel that just opened (restore, reset or a wrong file) comes fully into view, above the
    // floating tab bar, without pushing its own first line off the top.
    const panel = root.querySelector('.py-restore-confirm, .py-reset-confirm, .py-data-error');
    if (panel) {
      const r = panel.getBoundingClientRect();
      const bar = document.getElementById('py-nav');
      const limit = (bar ? bar.getBoundingClientRect().top : window.innerHeight) - 16;
      const by = Math.min(r.bottom - limit, r.top - 16);
      if (by > 0) window.scrollBy({ top: by, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }
}
