// Pengyu on the page: three views behind a bottom nav, Today, Pengu and History. Everything is saved
// only in this browser (js/pengyu/state.js); History holds "Export my data (JSON)" and Reset.

import * as S from './state.js';
import { renderToday, greeting } from './route.js';
import { renderShop } from './shop.js';
import { renderHistory } from './history.js';
import { penguFigure } from './art.js';
import { h, icon } from './ui.js';
import { toast } from '../fx.js';

const TABS = [
  { id: 'today', label: 'Today', icon: 'i-today' },
  { id: 'pengu', label: 'Pengu', icon: 'i-pengu' },
  { id: 'history', label: 'History', icon: 'i-history' },
];

export function initPengyu() {
  const root = document.getElementById('py-app');
  if (!root) return;
  let tab = 'today';
  let day = S.today();
  let greet = greeting();
  const bust = () => penguFigure(S.look(), { cls: 'py-toast-art', view: 'bust' });

  function go(id) {
    if (tab === id) return;
    tab = id;
    render();
    window.scrollTo(0, 0);
  }

  // The nav is built once, so focus stays on the tab that was pressed.
  const navButtons = {};
  const nav = document.getElementById('py-nav');
  if (nav) {
    nav.append(h('ul', { class: 'tabbar-list' }, TABS.map((t) => {
      navButtons[t.id] = h('button', { class: 'tabbar-btn', type: 'button', onclick: () => go(t.id) },
        h('span', { class: 'tabbar-pill', 'aria-hidden': 'true' }, icon(t.icon)), h('span', {}, t.label));
      return h('li', {}, navButtons[t.id]);
    })));
  }

  function onReset() {
    tab = 'today';
    render();
    window.scrollTo(0, 0);
    toast('Pengyu is reset', 'Plan a new week whenever you’re ready.', bust());
    document.getElementById('py-step-title')?.focus({ preventScroll: true });
  }

  function render() {
    root.textContent = '';
    if (!S.storageOk()) {
      root.append(h('div', { class: 'banner', role: 'alert' },
        h('span', { class: 'banner-icon' }, icon('i-alert')),
        h('p', {}, 'This browser isn’t saving right now, so your week resets when you leave. A regular (not private) window, or allowing site data, fixes it.')));
    }
    const view = h('div', { class: `py-view py-view-${tab}` });
    root.append(view);
    if (tab === 'pengu') renderShop(view, render);
    else if (tab === 'history') renderHistory(view, render, { onReset });
    else renderToday(view, render, { onShop: () => go('pengu') });
    for (const t of TABS) {
      if (t.id === tab) navButtons[t.id]?.setAttribute('aria-current', 'page');
      else navButtons[t.id]?.removeAttribute('aria-current');
    }
  }

  // When a free streak cover kicks in, Pengu says so once, kindly.
  function covers() {
    const weeks = S.announceCovers();
    if (!weeks.length) return;
    const d = S.parseKey(weeks[weeks.length - 1]);
    toast('Your week streak is safe', `Pengu used this month’s free streak cover for the week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`, bust());
  }

  S.subscribe(render);
  render();
  covers();

  // A new day or week can change everything on screen (a missed station, a fresh plan); the greeting
  // follows the time of day.
  const refresh = () => {
    if (S.today() !== day) { day = S.today(); greet = greeting(); render(); covers(); return; }
    if (greeting() !== greet) {
      greet = greeting();
      const el = root.querySelector('.py-greet');
      if (el) el.textContent = greet;
    }
  };
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}
