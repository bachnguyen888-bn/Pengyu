// The daily preview (streak, the Move, Learn, Play path, Stars, league) and the Health Stars
// section with its redeemable Star Bar. Renders from the store on every change.

import * as store from './store.js';
import { ACTIVITIES, MINUTES, FRIENDS, REWARDS, TIERS } from './content.js';
import { el, countTo, toast, setOrigin } from './fx.js';
import { renderReceipt } from './receipts.js';

const $ = (id) => document.getElementById(id);
const fmtStars = (n) => `${store.whole(n)}★`;

export function initDashboard() {
  const nodes = ['move', 'learn', 'play'];
  let openPanel = '';
  let moveChoice = '';
  let minsChoice = '';
  let learnRendered = false;

  // ---------- Node panels ----------
  function showPanel(name) {
    openPanel = openPanel === name ? '' : name;
    for (const n of nodes) {
      $(`panel-${n}`).hidden = openPanel !== n;
      $(`node-${n}`).setAttribute('aria-pressed', String(openPanel === n));
    }
    if (openPanel === 'move') renderMoveChips();
    if (openPanel === 'learn' && !learnRendered) {
      learnRendered = true;
      renderReceipt($('receipt-learn'), 'caffeine', { onFlip: () => { setOrigin($('node-learn')); store.checkIn('learn'); } });
    }
  }
  function openNode(name) {
    if (openPanel !== name) showPanel(name);
    const node = $(`node-${name}`);
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => node.focus({ preventScroll: true }), 300);
  }
  for (const n of nodes) $(`node-${n}`).addEventListener('click', () => showPanel(n));

  function renderMoveChips() {
    const liked = store.state.vault.moves;
    const order = [...liked, ...ACTIVITIES.filter((a) => !liked.includes(a))];
    const box = $('move-chips');
    box.textContent = '';
    for (const a of order) {
      const b = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(moveChoice === a) }, a);
      b.addEventListener('click', () => { moveChoice = a; renderMoveChips(); });
      box.append(b);
    }
    const mins = $('move-mins');
    mins.textContent = '';
    for (const m of MINUTES) {
      const b = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(minsChoice === m) }, m);
      b.addEventListener('click', () => { minsChoice = minsChoice === m ? '' : m; renderMoveChips(); });
      mins.append(b);
    }
    const done = store.dayOf().move;
    $('move-log').disabled = !moveChoice || done;
    $('move-log').textContent = done ? 'Checked in today' : 'Check in';
  }
  $('move-log').addEventListener('click', () => {
    if (!moveChoice) return;
    setOrigin($('node-move'));
    store.checkIn('move', { activity: moveChoice, mins: minsChoice });
    if (store.rememberMove(moveChoice)) toast(`Pengu will remember you like ${moveChoice.toLowerCase()}`, 'Change it anytime in your vault.', 'idle');
    renderMoveChips();
  });
  $('move-rest').addEventListener('click', () => { setOrigin($('node-move')); store.setRest(true); });

  // ---------- Switches ----------
  $('sw-rest').addEventListener('click', (e) => { setOrigin(e.currentTarget); store.setRest(!store.dayOf().rest); });
  $('sw-freeze').addEventListener('click', () => store.setAutoFreeze(!store.state.autoFreeze));

  // ---------- Star Bar stops ----------
  const stops = [...document.querySelectorAll('#stops .stop')];
  let openStop = 0;
  for (const s of stops) {
    const cost = Number(s.dataset.cost);
    s.style.setProperty('left', `${(cost / 400) * 100}%`);
    s.addEventListener('click', () => { openStop = openStop === cost ? 0 : cost; renderStopDetail(); });
  }
  function renderStopDetail() {
    const box = $('stop-detail');
    for (const s of stops) s.setAttribute('aria-expanded', String(Number(s.dataset.cost) === openStop));
    const reward = REWARDS.find((r) => r.cost === openStop);
    box.hidden = !reward;
    if (!reward) return;
    const bal = store.state.balance;
    box.textContent = '';
    box.append(el('p', { class: 'h3' }, `${reward.cost}★ · ${reward.title}`));
    const row = el('div', { class: 'grid cols-2' });
    for (const o of reward.options) {
      const owned = (o.id === 'outfit' && store.state.rewards.outfit) || (o.id === 'habitat' && store.state.rewards.habitat) || (o.id === 'pass' && store.state.rewards.pass);
      const card = el('div', { class: 'card card-flat card-stack' });
      card.append(el('p', {}, ''));
      card.firstChild.append(el('strong', {}, o.label));
      card.append(el('p', {}, o.desc));
      const btn = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, owned ? 'Already yours' : bal >= reward.cost ? `Redeem for ${reward.cost}★` : `${store.whole(reward.cost - bal)}★ to go`);
      btn.disabled = owned || bal < reward.cost;
      btn.addEventListener('click', () => { setOrigin(btn); store.redeem(reward.cost, o.id); renderStopDetail(); });
      card.append(el('div', { class: 'card-foot' }));
      card.lastChild.append(btn);
      row.append(card);
    }
    box.append(row);
    box.append(el('p', { class: 'stars-note' }, 'Preview rewards. Real rewards are in development and may change.'));
  }

  // ---------- Render ----------
  function render() {
    const st = store.state;
    const d = store.dayOf();
    const s = store.streak();
    const tier = store.tierOf(st.lifetime);
    const next = store.nextReward(st.balance);
    const fresh = !st.lifetime && !Object.keys(st.days).length;

    countTo($('streak-days'), s);
    $('streak-best').textContent = String(Math.max(st.bestStreak, s));
    $('streak-freezes').textContent = String(st.freezes);
    $('sw-rest').setAttribute('aria-checked', String(Boolean(d.rest)));
    $('sw-freeze').setAttribute('aria-checked', String(st.autoFreeze));

    const done = nodes.filter((n) => d[n]);
    for (const n of nodes) {
      const b = $(`node-${n}`);
      b.classList.toggle('is-done', Boolean(d[n]));
      b.querySelector('[data-node-sr]').textContent = `${n[0].toUpperCase()}${n.slice(1)}: ${d[n] ? 'done' : 'to do'}`;
    }
    $('node-move').classList.toggle('is-rest', Boolean(d.rest && !d.move));
    $('path-fill').style.setProperty('width', `${(done.length / 3) * 75}%`);
    const crown = $('crown');
    crown.classList.toggle('is-won', Boolean(d.crown));
    crown.setAttribute('aria-label', d.crown ? 'Trifecta Crown: earned today' : 'Trifecta Crown: not yet');
    $('path-note').textContent = d.crown
      ? 'Trifecta Crown earned. +3★ and a new seed.'
      : done.length || d.rest
        ? `Streak safe today. ${3 - done.length} more for the Trifecta Crown.`
        : 'Any one keeps your streak. All three earn the Trifecta Crown.';
    $('today-stars').textContent = d.crown ? 'Trifecta Crown' : `${done.length} of 3 today`;
    if (openPanel === 'move') renderMoveChips();

    // Stars HUD
    $('tier-pill').textContent = `${tier.name} tier`;
    countTo($('hud-balance'), store.whole(st.balance), (n) => `${n}★`);
    $('hud-next').textContent = next ? fmtStars(next.cost - st.balance) : 'Any';
    $('hud-mult').textContent = `${tier.mult}×`;

    // League: example friends plus your real week
    const me = store.weekStats();
    const rows = [...FRIENDS.map((f) => ({ ...f, you: false })), { name: 'You', ...me, you: true }]
      .sort((a, b) => b.days - a.days || b.rest - a.rest || b.games - a.games || (a.you ? -1 : 1));
    const box = $('league-rows');
    box.textContent = '';
    rows.slice(0, 4).forEach((r, i) => {
      const row = el('div', { class: `league-row${r.you ? ' is-you' : ''}`, role: 'row' });
      row.append(el('span', { class: 'rank', role: 'cell' }, String(i + 1)), el('span', { role: 'cell' }, r.name),
        el('span', { class: 'num', role: 'cell' }, String(r.days)), el('span', { class: 'num', role: 'cell' }, String(r.rest)),
        el('span', { class: 'num', role: 'cell' }, String(r.games)));
      box.append(row);
    });
    $('today-empty').hidden = !fresh;

    // Stars section
    countTo($('star-balance'), store.whole(st.balance));
    $('star-next').textContent = next ? `${fmtStars(next.cost - st.balance)} until your next reward` : 'You can redeem any reward on the bar';
    $('starbar-fill').style.setProperty('width', `${Math.min(100, (st.balance / 400) * 100)}%`);
    for (const s2 of stops) s2.classList.toggle('is-reached', st.balance >= Number(s2.dataset.cost));
    if (openStop) renderStopDetail();
    for (const t of TIERS) $(`tier-${t.id}`).classList.toggle('tier-current', t.id === tier.id);
    $('tier-name').textContent = tier.name;
    $('tier-lifetime').textContent = `${fmtStars(st.lifetime)} earned in total`;
    const nt = store.nextTier(st.lifetime);
    $('tier-progress').textContent = nt ? `${fmtStars(nt.min - st.lifetime)} more in total reaches ${nt.name}.` : 'You’re at the top tier.';

    // Nav star chip and the early-access nudge once Stars exist
    countTo($('star-chip-n'), store.whole(st.balance));
    const earned = st.lifetime > 0;
    const cta = $('nav-cta');
    cta.classList.toggle('btn-primary', earned);
    cta.classList.toggle('btn-secondary', !earned);
    cta.textContent = earned ? `Save your ${fmtStars(st.lifetime)}` : 'Get early access';
    const hero = $('hero-join');
    hero.textContent = earned ? `Save your ${fmtStars(st.lifetime)} · Join early access` : 'Get early access';
    $('ea-stars').hidden = !earned;
    $('ea-stars-text').textContent = `You’ve earned ${fmtStars(st.lifetime)} in the preview. Join early access, and your email will include your preview progress.`;
    document.documentElement.classList.toggle('outfit-on', Boolean(st.rewards.outfit));

    $('storage-banner').hidden = store.storageOk();
  }

  return { render, openNode };
}

// A one-line summary of preview progress, for the early-access email.
export function progressLine() {
  const st = store.state;
  if (!st.lifetime) return '';
  const tier = store.tierOf(st.lifetime).name;
  const blooms = st.plots.filter((p) => p && store.stageOf(p) === 4).length;
  const plants = st.plots.filter(Boolean).length;
  const parts = [`${store.streak()}-day streak`, `${store.whole(st.lifetime)} Stars (${tier})`, `${plants} plant${plants === 1 ? '' : 's'}${blooms ? `, ${blooms} in bloom` : ''}`];
  if (st.mutationsFound.length) parts.push(`${st.mutationsFound.length} rare mutation${st.mutationsFound.length === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
