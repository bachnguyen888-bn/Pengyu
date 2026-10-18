// Pengu's companion: contextual check-ins with one-tap replies, a box for pasting a viral claim,
// and the personal health vault. The replies are scripted. Pengu only shows receipts from
// content.js, and says so plainly when it has none.

import * as store from './store.js';
import { ACTIVITIES, TOPICS } from './content.js';
import { el, react, toast, penguSvg } from './fx.js';
import { renderReceipt, matchReceipt } from './receipts.js';

const YESTERDAY = {
  Gym: 'You hit the gym yesterday', Walk: 'You went for a walk yesterday', Run: 'You went for a run yesterday',
  Sports: 'You played sports yesterday', Yoga: 'You did yoga yesterday', Dance: 'You danced yesterday',
  'Home workout': 'You did a home workout yesterday', Bike: 'You went for a ride yesterday', Swim: 'You went for a swim yesterday',
};
const CHIPS = {
  play: { label: 'Play today’s claim', act: 'play' },
  move: { label: 'Quick move check-in', act: 'move' },
  learn: { label: '1-minute lesson', act: 'learn' },
  sleep: { label: '1-minute sleep fact', act: 'sleep' },
  rest: { label: 'Log a rest day', act: 'rest' },
  vault: { label: 'Tell Pengu how I move', act: 'vault' },
  glide: { label: 'Try Sleep Sprint', act: 'glide' },
};

function minutes(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function nearWinddown(hhmm) {
  if (!hhmm) return false;
  const now = new Date();
  const diff = minutes(hhmm) - (now.getHours() * 60 + now.getMinutes());
  return diff <= 90 && diff >= -30;
}
function clock(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// What Pengu says first, from today's progress and the vault.
export function suggestion() {
  const st = store.state;
  const d = store.dayOf();
  const s = store.streak();
  const last = store.lastActivity();
  const likesSleep = st.vault.topics.includes('Sleep');
  if (!st.firsts.claim) return { text: 'Hey, I’m Pengu. Want to try today’s claim? Pull back the orb and launch it at FACTS or CAP.', chips: [CHIPS.play, CHIPS.move, CHIPS.vault] };
  if (nearWinddown(st.vault.winddown) && !d.learn) return { text: `Wind-down is at ${clock(st.vault.winddown)}. Want the receipt on late caffeine and sleep?`, chips: [CHIPS.sleep, CHIPS.rest] };
  if (last && last.daysAgo === 1 && !store.doneToday()) {
    return { text: `${YESTERDAY[last.activity] || `You logged ${last.activity.toLowerCase()} yesterday`}. Ready for a 1-minute sleep fact, or logging a rest day today?`, chips: [CHIPS.sleep, CHIPS.rest, CHIPS.play] };
  }
  if (store.doneToday()) {
    const missing = ['move', 'learn', 'play'].filter((n) => !d[n]);
    if (missing.length) {
      return {
        text: `Your streak is safe today${s > 1 ? `: ${s} days` : ''}. ${missing.length === 1 ? 'One more' : 'Do the rest'} for the Trifecta Crown?`,
        chips: missing.map((n) => (n === 'learn' && likesSleep ? CHIPS.sleep : CHIPS[n])),
      };
    }
    return { text: 'Trifecta Crown earned today. Your plants are loving this.', chips: [CHIPS.glide, CHIPS.vault] };
  }
  if (s > 0) return { text: `Your ${s}-day streak is waiting. Any one thing keeps it.`, chips: [CHIPS.move, CHIPS.sleep, CHIPS.rest] };
  return { text: 'Welcome back. Any one thing starts a new streak.', chips: [CHIPS.move, likesSleep ? CHIPS.sleep : CHIPS.learn, CHIPS.play] };
}

export function initCompanion({ actions }) {
  const dialog = document.getElementById('companion');
  const thread = document.getElementById('thread');
  const chipsBox = document.getElementById('companion-chips');
  const dockChips = document.getElementById('dock-chips');
  if (!dialog || !thread) return { open() {}, render() {} };

  // ---------- Chips ----------
  function renderChips(box, chips) {
    if (!box) return;
    box.textContent = '';
    for (const c of chips) {
      const b = el('button', { class: 'chip', type: 'button' }, c.label);
      b.addEventListener('click', () => act(c.act, box === dockChips));
      box.append(b);
    }
  }

  // ---------- Thread ----------
  function scrollThread() { const body = thread.parentElement; body.scrollTop = body.scrollHeight; }
  function say(text, extra) {
    const m = el('div', { class: 'msg msg-pengu' });
    m.append(el('p', {}, text));
    if (extra) m.append(extra);
    thread.append(m);
    scrollThread();
    return m;
  }
  function you(text) { thread.append(el('div', { class: 'msg msg-you' }, text)); scrollThread(); }
  function greet() {
    const sug = suggestion();
    say(sug.text);
    renderChips(chipsBox, sug.chips);
  }

  // ---------- Open and close ----------
  function open({ claim, tab } = {}) {
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    }
    selectTab(tab || 'chat');
    if (!thread.childElementCount) greet();
    if (claim) ask(claim);
  }
  function close() { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); }
  dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target.closest('[data-close], a[href^="#"]')) close(); });

  // ---------- Actions ----------
  function act(name, fromDock) {
    if (name === 'play') { close(); actions.play(); return; }
    if (name === 'move') { close(); actions.node('move'); return; }
    if (name === 'learn') { close(); actions.node('learn'); return; }
    if (name === 'glide') { close(); actions.glide(); return; }
    if (name === 'vault') { open({ tab: 'vault' }); return; }
    if (fromDock) open();
    if (name === 'sleep') {
      you('1-minute sleep fact');
      const card = el('div', { class: 'receipt' });
      say('Here’s today’s lesson. Flip the card for the study behind it.', card);
      renderReceipt(card, 'caffeine', { compact: true, onFlip: () => store.checkIn('learn') });
      renderChips(chipsBox, suggestion().chips);
      return;
    }
    if (name === 'rest') {
      you('Log a rest day');
      store.setRest(true);
      say('Rest day logged. Your streak is safe, and your plants got a cozy rain. Rest days count.');
      renderChips(chipsBox, suggestion().chips);
    }
  }

  function ask(text) {
    const claim = text.trim().slice(0, 280);
    if (!claim) return;
    selectTab('chat');
    you(claim);
    react('lab', 1600);
    const loading = el('div', { class: 'msg msg-pengu is-loading', role: 'status' });
    loading.append(el('p', {}, 'Pengu is checking the receipts on file…'), el('span', { class: 'line skeleton' }), el('span', { class: 'line skeleton' }));
    thread.append(loading);
    scrollThread();
    setTimeout(() => {
      loading.remove();
      const key = matchReceipt(claim);
      if (key) {
        const card = el('div', { class: 'receipt' });
        say('Here’s the closest reviewed receipt I have. Check that it matches what you asked.', card);
        renderReceipt(card, key, { compact: true, onFlip: () => { if (key === 'caffeine') store.checkIn('learn'); } });
      } else {
        const row = el('div', { class: 'actions' });
        const mail = el('a', { class: 'btn btn-secondary btn-sm', href: `mailto:hello@bachnguyenclearhealth.com?subject=${encodeURIComponent('A claim for Facts or Cap')}&body=${encodeURIComponent(`Could Pengu check this claim?\r\n\r\n${claim}`)}` }, 'Suggest it to the team');
        const keep = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Save to my vault');
        keep.addEventListener('click', () => { store.saveClaim(claim); keep.disabled = true; keep.textContent = 'Saved in your vault'; });
        row.append(mail, keep);
        say('I don’t have a reviewed receipt for that one yet. I only share studies a person has checked, so I won’t guess.', row);
      }
      renderChips(chipsBox, suggestion().chips);
    }, 700);
  }

  for (const id of ['companion-ask', 'dock-ask']) {
    const form = document.getElementById(id);
    if (!form) continue;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      input.value = '';
      if (id === 'dock-ask') open({ claim: text }); else ask(text);
    });
  }

  // ---------- Tabs ----------
  const tabs = [document.getElementById('tab-chat'), document.getElementById('tab-vault')];
  function selectTab(name) {
    for (const t of tabs) {
      const on = t.id === `tab-${name}`;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    }
    if (name === 'vault') renderVault();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t.id.replace('tab-', '')));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + 1) % 2];
      selectTab(next.id.replace('tab-', ''));
      next.focus();
    });
  });

  // ---------- Vault ----------
  let forgetArmed = false;
  function toggles(box, all, chosen, key) {
    box.textContent = '';
    for (const label of all) {
      const on = chosen.includes(label);
      const b = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(on) }, label);
      b.addEventListener('click', () => {
        const list = store.state.vault[key];
        store.setVault({ [key]: list.includes(label) ? list.filter((x) => x !== label) : [...list, label] });
        renderVault();
      });
      box.append(b);
    }
  }
  function renderVault() {
    const v = store.state.vault;
    toggles(document.getElementById('vault-moves'), ACTIVITIES, v.moves, 'moves');
    toggles(document.getElementById('vault-topics'), TOPICS, v.topics, 'topics');
    const wd = document.getElementById('vault-winddown');
    if (document.activeElement !== wd) wd.value = v.winddown || '';
    const list = document.getElementById('vault-saved');
    list.textContent = '';
    if (!v.saved.length) list.append(el('li', {}, 'Nothing saved yet. Claims you paste and save show up here.'));
    for (const c of v.saved) {
      const li = el('li');
      const rm = el('button', { class: 'link-btn', type: 'button', 'aria-label': `Remove “${c}”` }, 'Remove');
      rm.addEventListener('click', () => { store.removeClaim(c); renderVault(); });
      li.append(el('span', {}, `“${c}” `), rm);
      list.append(li);
    }
  }
  document.getElementById('vault-winddown').addEventListener('change', (e) => store.setVault({ winddown: e.target.value }));
  const forget = document.getElementById('vault-forget');
  forget.addEventListener('click', () => {
    if (!forgetArmed) {
      forgetArmed = true;
      forget.textContent = 'Tap again to erase everything';
      forget.classList.add('btn-secondary');
      setTimeout(() => { forgetArmed = false; forget.textContent = 'Forget everything'; forget.classList.remove('btn-secondary'); }, 4000);
      return;
    }
    forgetArmed = false;
    forget.textContent = 'Forget everything';
    forget.classList.remove('btn-secondary');
    store.reset();
    thread.textContent = '';
    renderVault();
    toast('Everything is forgotten', 'Your streak, Stars, garden and vault were erased from this browser.', 'rest');
  });
  document.getElementById('vault').addEventListener('submit', (e) => e.preventDefault());

  function render() {
    const sug = suggestion();
    renderChips(dockChips, sug.chips);
    if (dialog.open && !document.getElementById('panel-vault').hidden) renderVault();
    return sug;
  }

  return { open, close, render, ask, penguSvg };
}
