// Pengyu on the page: the splash once per session, then Today, Pengu, History and Settings,
// plus the full-screen plan view behind "Plan my week". Everything is saved only in this
// browser (js/pengyu/state.js).

import * as S from './state.js';
import { renderToday } from './route.js';
import { renderShop } from './shop.js';
import { renderHistory } from './history.js';
import { renderSettings } from './settings.js';
import { renderPlanFlow, takeFocusRequest, resetPlanDraft } from './plan.js';
import { penguFigure } from './art.js';
import { reducedMotion } from './motion.js';
import { h, icon } from './ui.js';
import { toast } from '../fx.js';

const TABS = [
  { id: 'today', label: 'Today', icon: 'i-today' },
  { id: 'pengu', label: 'Pengu', icon: 'i-pengu' },
  { id: 'history', label: 'History', icon: 'i-history' },
  { id: 'settings', label: 'Settings', icon: 'i-shield' },
];

// The PENGYU splash: shown at once by boot.js on a session's first visit, gone after about 900ms
// (300ms with reduced motion), or at the first tap or key.
function splash() {
  const root = document.documentElement;
  const el = document.getElementById('py-splash');
  try { sessionStorage.setItem('pengyu.splash', '1'); } catch { /* storage blocked */ }
  if (!el || !root.classList.contains('is-splash')) { if (el) el.remove(); return; }
  let gone = false;
  const leave = () => {
    if (gone) return;
    gone = true;
    el.classList.add('is-leaving');
    setTimeout(() => { root.classList.remove('is-splash'); el.remove(); }, reducedMotion() ? 150 : 280);
  };
  el.addEventListener('pointerdown', leave);
  window.addEventListener('keydown', leave, { once: true });
  setTimeout(leave, reducedMotion() ? 300 : 900);
}

export function initPengyu() {
  const root = document.getElementById('py-app');
  const main = document.getElementById('main');
  if (!root) return;
  splash();
  let tab = 'today';
  let planning = false;
  let day = S.today();
  let greet = S.greeting();
  const bust = () => penguFigure(S.look(), { cls: 'py-toast-art', pose: 'bust' });

  function go(id) {
    if (tab === id && !planning) return;
    tab = id;
    planning = false;
    render();
    window.scrollTo(0, 0);
  }
  function openPlan() {
    planning = true;
    render();
    window.scrollTo(0, 0);
    document.getElementById('py-step-title')?.focus({ preventScroll: true });
  }

  // The tab bar is built once, so focus stays on the tab that was pressed.
  const navButtons = {};
  const nav = document.getElementById('py-nav');
  if (nav) {
    nav.append(h('ul', { class: 'tabbar-list' }, TABS.map((t) => {
      navButtons[t.id] = h('button', { class: 'tabbar-btn', type: 'button', onclick: () => go(t.id) }, icon(t.icon), h('span', {}, t.label));
      return h('li', {}, navButtons[t.id]);
    })));
  }

  function onReset() {
    tab = 'today';
    planning = false;
    resetPlanDraft();
    render();
    window.scrollTo(0, 0);
    toast('Pengyu is reset', 'Plan a new week whenever you’re ready.', bust());
  }
  // A restored backup shows its Today straight away.
  function onRestore(summary) {
    tab = 'today';
    planning = false;
    resetPlanDraft();
    render();
    window.scrollTo(0, 0);
    toast('Backup restored.', `${summary.weeks === 1 ? '1 week' : `${summary.weeks} weeks`}, ${summary.fish} Fish.`, bust());
  }

  function render() {
    if (planning && S.planFor(S.planningWeek())) planning = false;   // the plan was made: back to Today
    const showPlan = planning && tab === 'today';
    if (main) main.classList.toggle('is-planning', showPlan);
    root.textContent = '';
    if (!S.storageOk()) {
      root.append(h('div', { class: 'banner', role: 'alert' },
        h('span', { class: 'banner-icon' }, icon('i-alert')),
        h('p', {}, 'This browser isn’t saving right now, so your week resets when you leave. A regular (not private) window, or allowing site data, fixes it.')));
    }
    const view = h('div', { class: `py-view py-view-${showPlan ? 'plan' : tab}` });
    root.append(view);
    if (showPlan) renderPlanFlow(view, render, { onExit: () => go('today') });
    else if (tab === 'pengu') renderShop(view, render);
    else if (tab === 'history') renderHistory(view, render, { onReset, onRestore });
    else if (tab === 'settings') renderSettings(view, render, { onReset, onRestore });
    else renderToday(view, render, { onShop: () => go('pengu'), onPlan: openPlan, focus: takeFocusRequest() });
    for (const t of TABS) {
      if (t.id === tab) navButtons[t.id]?.setAttribute('aria-current', 'page');
      else navButtons[t.id]?.removeAttribute('aria-current');
    }
  }

  // When a free streak cover kicks in, Pengu says so once, kindly.
  function covers() {
    const weeks = S.announceCovers();
    if (!weeks.length) return;
    toast('Your week streak is safe.', 'Pengu used this month’s free cover.', bust());
  }

  S.subscribe(render);
  render();
  S.noteAppOpened();
  // After the splash, if it is showing, so the note is seen.
  setTimeout(covers, document.documentElement.classList.contains('is-splash') ? 1100 : 0);

  // A new day or week can change everything on screen; the greeting follows the hour.
  const refresh = () => {
    if (S.today() !== day) { day = S.today(); greet = S.greeting(); render(); covers(); return; }
    if (S.greeting() !== greet) {
      greet = S.greeting();
      const el = root.querySelector('.py-greet');
      if (el) el.textContent = greet;
    }
  };
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { S.noteAppOpened(); refresh(); } });
}
