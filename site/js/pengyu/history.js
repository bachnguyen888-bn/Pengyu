// History: every week since the first plan, newest first ("Oct 26 – Nov 1"). Each week says how many
// planned workouts were done, the Fish it paid, its Comeback stamps, the free cover if one was used, and
// the extras collected: words and small tags only, no charts, no ranking, only this player's own weeks.
// "Your data" holds Save a backup (also the data export), Restore from a backup and Reset everything.

import * as S from './state.js';
import { saveBackup } from './backup.js';
import { h, icon, monthDay, plural, appFooter } from './ui.js';
import { toast, reducedMotion } from '../fx.js';

let resetStep = 0;        // Reset everything: 0 closed, 1 "start over?", 2 "save a backup first?"
let resetSaved = false;   // a backup was saved from the second step
let restore = null;       // a checked backup waiting for the player's yes ({ text, summary }), or { error }
let refocus = '';

// Mondays from the first planned (or logged) week up to this one, newest first. A week planned ahead
// (on Sunday) is not history yet.
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

const range = (monday) => `${monthDay(S.parseKey(monday))} – ${monthDay(S.parseKey(S.addDays(monday, 6)))}`;
const tag = (cls, name, text) => h('li', { class: `py-tag${cls ? ` ${cls}` : ''}` }, name ? icon(name) : null, text);

function weekCard(monday, covered) {
  const current = monday === S.thisWeek();
  const days = S.weekDays(monday);
  const r = S.planFor(monday) ? S.route(monday) : null;
  const stamps = days.filter((d) => S.state.log[d] && S.state.log[d].comeback).length;
  const extras = S.state.extras.filter((x) => days.includes(x.earnedOn)).map((x) => S.extraById(x.id)).filter(Boolean);
  let line = 'No plan';
  if (r) line = `${r.done} of ${r.target}${current && !r.hit ? ' so far' : ''}`;
  const tags = [
    r && r.hit ? tag('is-hit', 'i-check', 'Week hit') : null,
    stamps ? tag('is-stamp', 'i-stamp', plural(stamps, 'Comeback stamp')) : null,
    covered ? tag('', 'i-shield', 'Free cover used') : null,
    ...extras.map((e) => tag('is-extra', '', e.name)),
  ].filter(Boolean);
  return h('li', { class: 'py-week' },
    h('div', { class: 'py-week-top' },
      h('h3', { class: 'py-week-title' }, range(monday), current ? h('span', { class: 'py-week-now' }, 'This week') : null),
      h('p', { class: 'py-week-fish' }, `+${weekFish(monday)} Fish`)),
    h('p', { class: 'py-week-line' }, line),
    tags.length ? h('ul', { class: 'py-week-tags', 'aria-label': 'That week' }, tags) : null);
}

// What a reset would delete, in a few words: "4 weeks of history, 120 Fish, 3 unlocks and 2 extras".
function losses() {
  const weeks = Object.keys(S.state.plans).length;
  const unlocks = Object.keys(S.state.owned).length;
  const parts = [
    weeks ? `${plural(weeks, 'week')} of history` : null,
    S.state.fish.balance ? `${S.state.fish.balance} Fish` : null,
    unlocks ? plural(unlocks, 'unlock') : null,
    S.state.extras.length ? plural(S.state.extras.length, 'extra') : null,
  ].filter(Boolean);
  if (!parts.length) return 'Nothing is saved yet, so nothing will be lost.';
  const said = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `This deletes ${said}.`;
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
  resetStep = 0;
  resetSaved = false;
  refocus = checked.ok ? 'py-restore-yes' : 'py-restore';
  rerender();
}

function dataCard(rerender, onReset, onRestore) {
  const file = h('input', { class: 'sr-only', type: 'file', accept: 'application/json,.json', tabindex: '-1', 'aria-hidden': 'true', onchange: (e) => readPicked(e, rerender) });
  const closeReset = () => { resetStep = 0; resetSaved = false; refocus = 'py-reset'; rerender(); };
  const card = h('section', { class: 'py-data', 'aria-labelledby': 'py-data-title' },
    h('h2', { class: 'py-section-title', id: 'py-data-title' }, 'Your data'),
    h('p', { class: 'small muted' }, 'Everything is saved only in this browser. A backup file keeps Pengu safe.'),
    h('p', { class: 'py-data-privacy' }, h('a', { href: 'privacy.html' }, 'How Pengyu handles your data')),
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
        class: 'btn btn-ghost btn-sm', type: 'button', id: 'py-reset', 'aria-expanded': String(resetStep > 0),
        onclick: () => { if (resetStep) { closeReset(); return; } resetStep = 1; restore = null; refocus = 'py-reset-next'; rerender(); },
      }, 'Reset everything')),
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
  // Reset, step one: the intent. Step two: save a backup first, and exactly what will be lost.
  if (resetStep === 1) {
    card.append(h('div', { class: 'py-reset-confirm', role: 'group', 'aria-labelledby': 'py-reset-q' },
      h('p', { id: 'py-reset-q' }, h('strong', {}, 'Start Pengyu over?'), ' Your plan, weeks, Fish and gear leave this browser.'),
      h('div', { class: 'py-data-actions' },
        h('button', { class: 'btn btn-secondary btn-sm', type: 'button', id: 'py-reset-next', onclick: () => { resetStep = 2; refocus = 'py-reset-backup'; rerender(); } }, 'Continue'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: closeReset }, 'Keep my data'))));
  } else if (resetStep === 2) {
    card.append(h('div', { class: 'py-reset-confirm is-last', role: 'group', 'aria-labelledby': 'py-reset-q2' },
      h('p', { id: 'py-reset-q2' }, h('strong', {}, 'Save a backup first?'), ` ${losses()} It can’t be undone.`),
      h('div', { class: 'py-data-actions' },
        h('button', { class: 'btn btn-secondary btn-sm', type: 'button', id: 'py-reset-backup', onclick: () => { saveBackup(); resetSaved = true; refocus = 'py-reset-yes'; rerender(); } }, resetSaved ? 'Save another backup' : 'Save a backup'),
        h('button', { class: 'btn btn-danger btn-sm', type: 'button', id: 'py-reset-yes', onclick: () => { resetStep = 0; resetSaved = false; S.reset(); onReset(); } }, 'Reset everything'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: closeReset }, 'Keep my data')),
      resetSaved ? h('p', { class: 'py-reset-saved', role: 'status' }, icon('i-check'), 'Backup saved.') : null));
  }
  return card;
}

export function renderHistory(root, rerender, { onReset = () => {}, onRestore = () => {} } = {}) {
  const info = S.streakInfo();
  const weeks = mondays();
  const view = h('div', { class: 'py-view' },
    h('h1', { class: 'py-view-title' }, 'History'),
    h('section', { class: 'py-weeks-sec', 'aria-labelledby': 'py-weeks-title' },
      h('h2', { class: 'py-section-title', id: 'py-weeks-title' }, 'Your weeks'),
      weeks.length
        ? h('ol', { class: 'py-weeks' }, weeks.map((m) => weekCard(m, info.covered.includes(m))))
        : h('p', { class: 'muted' }, 'Your weeks show up here once you plan your first one.')),
    dataCard(rerender, onReset, onRestore),
    appFooter());
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
