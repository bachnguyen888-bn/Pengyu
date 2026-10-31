// Pengu's week planner on the page: the Monday plan when the week has none, then Today's route.
// Hidden "Settings" holds "Export my data (JSON)": the event log decides what gets built next.

import * as S from './state.js';
import { renderPlanFlow, takeFocusRequest } from './plan.js';
import { renderToday } from './route.js';
import { download } from './ics.js';
import { h, icon, penguArt } from './ui.js';
import { toast } from '../fx.js';

export function initPengyu() {
  const root = document.getElementById('py-app');
  if (!root) return;
  let day = S.today();

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
    const view = h('div', { class: 'py-view' });
    root.append(view);
    if (S.planFor()) renderToday(view, render, { focus: takeFocusRequest() });
    else renderPlanFlow(view, render);
    const box = settings();
    if (keepSettingsOpen) box.open = true;
    root.append(box);
  }

  // When a free streak cover kicks in, Pengu says so once, kindly.
  function covers() {
    const weeks = S.announceCovers();
    if (!weeks.length) return;
    const d = S.parseKey(weeks[weeks.length - 1]);
    toast('Your week streak is safe', `Pengu used this month’s free streak cover for the week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`, 'rest', penguArt('py-toast-art'));
  }

  S.subscribe(render);
  render();
  covers();

  // A new day or week can change everything on screen (a missed station, a fresh plan).
  const refresh = () => { if (S.today() !== day) { day = S.today(); render(); covers(); } };
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}
