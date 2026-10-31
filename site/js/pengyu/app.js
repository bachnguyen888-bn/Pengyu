// Pengu's week planner on the page, in two tabs: "Your week" (the Monday plan, then Today's route) and
// "Pengu & train" (the fixed-price upgrades). Hidden "Settings" holds "Export my data (JSON)": the
// event log decides what gets built next.

import * as S from './state.js';
import { renderPlanFlow, takeFocusRequest } from './plan.js';
import { renderToday } from './route.js';
import { renderShop } from './shop.js';
import { penguFigure } from './art.js';
import { download } from './ics.js';
import { h, icon } from './ui.js';
import { toast } from '../fx.js';

const TABS = [{ id: 'week', label: 'Your week' }, { id: 'pengu', label: 'Pengu & train' }];

export function initPengyu() {
  const root = document.getElementById('py-app');
  if (!root) return;
  let day = S.today();
  let tab = 'week';
  let focusTab = false;

  function pick(id) { tab = id; focusTab = true; render(); }
  function tabs() {
    const list = h('div', { class: 'py-tabs', role: 'tablist', 'aria-label': 'Week planner' },
      TABS.map((t) => h('button', {
        class: 'py-tab', type: 'button', role: 'tab', id: `py-tab-${t.id}`, 'aria-controls': 'py-panel',
        'aria-selected': String(tab === t.id), tabindex: tab === t.id ? '0' : '-1', onclick: () => pick(t.id),
      }, t.label)));
    list.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const i = TABS.findIndex((t) => t.id === tab);
      pick(TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id);
    });
    return list;
  }

  // The header's Pengu wears the same gear as everywhere else.
  function avatar() {
    const old = document.querySelector('#week .py-top .py-avatar');
    if (old) old.replaceWith(penguFigure(S.look(), { cls: 'py-avatar', view: 'bust' }));
  }

  function settings() {
    return h('details', { class: 'py-settings' },
      h('summary', {}, 'Settings'),
      h('div', { class: 'py-settings-body' },
        h('p', { class: 'small muted' }, 'Your plan, workouts and Fish are saved only in this browser. Nothing is sent anywhere.'),
        h('button', {
          class: 'btn btn-ghost btn-sm', type: 'button',
          onclick: () => download(`pengu-data-${S.today()}.json`, S.exportData(), 'application/json'),
        }, 'Export my data (JSON)')));
  }

  function render() {
    const keepSettingsOpen = root.querySelector('.py-settings')?.open;
    root.textContent = '';
    if (!S.storageOk()) {
      root.append(h('div', { class: 'banner banner-error py-storage', role: 'alert' },
        h('span', { class: 'banner-icon' }, icon('i-alert')),
        h('p', {}, 'This browser isn’t saving right now, so your week resets when you leave. A regular (not private) window, or allowing site data, fixes it.')));
    }
    root.append(tabs());
    const view = h('div', { class: 'py-view', role: 'tabpanel', id: 'py-panel', 'aria-labelledby': `py-tab-${tab}` });
    root.append(view);
    if (tab === 'pengu') renderShop(view, render);
    else if (S.planFor()) renderToday(view, render, { focus: takeFocusRequest(), onShop: () => pick('pengu') });
    else renderPlanFlow(view, render);
    avatar();
    if (focusTab) { focusTab = false; document.getElementById(`py-tab-${tab}`)?.focus({ preventScroll: true }); }
    const box = settings();
    if (keepSettingsOpen) box.open = true;
    root.append(box);
  }

  // When a free streak cover kicks in, Pengu says so once, kindly.
  function covers() {
    const weeks = S.announceCovers();
    if (!weeks.length) return;
    const d = S.parseKey(weeks[weeks.length - 1]);
    toast('Your week streak is safe', `Pengu used this month’s free streak cover for the week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`, 'rest', penguFigure(S.look(), { cls: 'py-toast-art', view: 'bust' }));
  }

  S.subscribe(render);
  render();
  covers();

  // A new day or week can change everything on screen (a missed station, a fresh plan).
  const refresh = () => { if (S.today() !== day) { day = S.today(); render(); covers(); } };
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}
