// Pengu by ClearHealth: wires up the page. Optional by design. Without scripts every section
// still reads, the station and carousel still scroll, and the form falls back to the email
// address in its fine print.

import * as store from './store.js';
import * as fx from './fx.js';
import { RECEIPTS } from './content.js';
import { initDashboard } from './dashboard.js';
import { initSanctuary } from './sanctuary.js';
import { initCompanion } from './companion.js';
import { createSlingshot } from './slingshot.js';
import { createGlide } from './glide.js';
import { renderReceipt } from './receipts.js';
import { initForm } from './form.js';
import { initPengyu } from './pengyu/app.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;

// ---------- Circadian theme: auto, Daylight, Deep Space ----------
function initTheme() {
  const btn = $('theme-toggle');
  const order = ['auto', 'day', 'night'];
  const names = { auto: 'automatic', day: 'Daylight', night: 'Deep Space' };
  let mode = root.dataset.themeMode || 'auto';
  const apply = () => {
    const hour = new Date().getHours();
    const theme = mode === 'auto' ? (hour >= 19 || hour < 7 ? 'night' : 'day') : mode;
    root.dataset.theme = theme;
    root.dataset.themeMode = mode;
    btn.dataset.mode = mode;
    btn.setAttribute('aria-label', `Theme: ${names[mode]}. Switch to ${names[order[(order.indexOf(mode) + 1) % 3]]}.`);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'night' ? '#0F0C20' : '#F7F7FA');
  };
  apply();
  requestAnimationFrame(() => root.classList.add('theme-ready'));
  btn.addEventListener('click', () => {
    mode = order[(order.indexOf(mode) + 1) % 3];
    try { localStorage.setItem('pengu.theme', mode); } catch { /* the choice lasts for this visit */ }
    apply();
    fx.toast(`Theme: ${names[mode]}`, mode === 'auto' ? 'Deep Space from 7pm to 7am, Daylight otherwise.' : '', mode === 'night' ? 'rest' : 'idle');
  });
  setInterval(() => { if (mode === 'auto') apply(); }, 60000);
}

// ---------- Hero: try one claim, earn Stars, plant a seed ----------
function initTry() {
  const wrap = $('sling');
  const canvas = $('sling-canvas');
  const game = $('try-game');
  const result = $('try-result');
  const bubble = $('dock-bubble');
  const hintL = $('sling-hint-l');
  const hintR = $('sling-hint-r');
  const plantBtn = $('plant-first');
  const launchBtns = [$('launch-facts'), $('launch-cap')];
  let playing = false;

  const sling = createSlingshot({
    wrap, canvas,
    onShot(n, missed) {
      hintR.textContent = `Shots: ${n}`;
      if (missed) { hintL.textContent = 'Missed! Pull again'; bubble.textContent = 'So close. Pull back and try again.'; }
      else hintL.textContent = n ? 'Flying…' : 'Pull back the orb';
      playing = n > 0;
    },
    onResult: showResult,
  });

  if (!sling) {
    game.textContent = '';
    const b = fx.el('div', { class: 'banner banner-error', role: 'alert' });
    b.append(fx.el('p', {}, 'This game needs canvas support, which this browser doesn’t have. You can still play Facts or Cap on the app.'));
    const a = fx.el('a', { class: 'btn btn-primary btn-sm', href: '#games' }, 'Play Facts or Cap');
    b.append(a);
    game.append(b);
    return { focus() { a.focus(); } };
  }
  launchBtns[0].addEventListener('click', () => sling.aimAt('facts'));
  launchBtns[1].addEventListener('click', () => sling.aimAt('cap'));

  function showResult(choice, shots) {
    const r = RECEIPTS.knuckles;
    const correct = choice === r.verdict;
    const rating = correct ? (shots === 1 ? 3 : shots <= 3 ? 2 : 1) : 1;
    const before = store.state.lifetime;
    fx.setOrigin(wrap);
    store.recordGame('sling', rating);
    const gained = store.whole(store.state.lifetime - before);
    launchBtns.forEach((b) => { b.disabled = true; });
    const stamp = $('result-stamp');
    stamp.textContent = r.verdict.toUpperCase();
    stamp.className = `verdict-stamp ${r.verdict}`;
    const stars = $('result-rating');
    stars.textContent = '';
    for (let i = 0; i < 3; i++) stars.append(fx.el('span', i < rating ? {} : { class: 'off' }, '★'));
    stars.setAttribute('aria-label', `Stage rating: ${rating} of 3 stars`);
    const pill = $('result-stars');
    pill.hidden = !gained;
    pill.textContent = `+${gained}★`;
    renderReceipt($('receipt-try'), 'knuckles');
    hintL.textContent = `${choice === 'cap' ? 'CAP' : 'FACTS'} tower down`;
    result.hidden = false;
    bubble.textContent = correct
      ? (rating === 3 ? 'Nailed it on the first shot! It’s cap. Flip the card for the receipt.' : 'You got it: it’s cap. Flip the card for the receipt.')
      : 'Not this time: it’s cap. Flip the card to see why. You still earn a Star for learning it.';
    fx.react(correct && rating === 3 ? 'celebrate' : correct ? 'fire' : 'lab', 4000);
    renderPlant();
    playing = false;
  }

  function renderPlant() {
    const spot = store.firstEmptyPlot();
    const canPlant = store.state.seeds > 0 && spot >= 0;
    plantBtn.dataset.mode = canPlant ? 'plant' : 'view';
    plantBtn.lastChild.textContent = canPlant ? (store.state.firsts.plant ? 'Plant your seed' : 'Plant your seed (+10★)') : 'See your Sanctuary';
  }
  plantBtn.addEventListener('click', () => {
    if (plantBtn.dataset.mode === 'plant') {
      fx.setOrigin(plantBtn);
      store.plant(store.firstEmptyPlot());
      renderPlant();
      bubble.textContent = 'Seed planted! Every check-in waters it, and it keeps growing while you’re away.';
    } else {
      fx.scrollToEl($('sanctuary'));
    }
  });
  $('try-again').addEventListener('click', () => {
    sling.reset();
    result.hidden = true;
    launchBtns.forEach((b) => { b.disabled = false; });
    bubble.textContent = 'Another go, just for fun. This game’s Stars come once a day.';
    hintL.textContent = 'Pull back the orb';
  });

  return {
    focus() { fx.scrollToEl($('try'), $('claim-text')); },
    get playing() { return playing; },
    renderPlant,
  };
}

// ---------- Sleep Sprint lab prototype ----------
function initGlide() {
  const dialog = $('glide');
  const canvas = $('glide-canvas');
  const status = $('glide-status');
  let game = null;
  function open() {
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    if (!game) {
      game = createGlide({
        wrap: $('glide-wrap'), canvas,
        onScore: (n) => { $('glide-score').textContent = `${n} dodged`; },
        onTime: (t) => { $('glide-time').textContent = `${t}s`; },
        onEnd: ({ won, score }) => {
          const rating = won ? 3 : score >= 10 ? 2 : score >= 1 ? 1 : 0;
          if (rating) { fx.setOrigin(canvas); store.recordGame('glide', rating, score); }
          const best = store.state.bests.glide;
          status.textContent = won
            ? `You made it through the night with ${score} dodged. Best: ${best}.`
            : `${score} dodged. Best: ${best}. Tap to retry. Friends to beat are example scores.`;
          if (won) fx.react('celebrate');
        },
      });
      if (!game) {
        status.textContent = 'This game needs canvas support, which this browser doesn’t have.';
        return;
      }
    }
    status.textContent = `Best: ${store.state.bests.glide}. Friends to beat are example scores.`;
    setTimeout(() => canvas.focus(), 50);
  }
  dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target.closest('[data-close], a[href^="#"]')) dialog.close(); });
  dialog.addEventListener('close', () => { if (game) game.stop(); });
  return { open };
}

// ---------- Feedback for store events: one toast per burst of changes ----------
const PRIORITY = ['tier', 'crown', 'first-claim', 'mutation', 'redeem', 'harvest', 'bloom', 'plant', 'freeze-used', 'rest', 'checkin', 'weekly-freeze'];
const NODE_NAMES = { move: 'Move', learn: 'Learn', play: 'Play' };
const REDEEMED = {
  freeze: 'One more streak freeze is ready.', seeds: 'Three seeds are in your Sanctuary.',
  outfit: 'Pengu is wearing a gold star pin.', habitat: 'Two more garden plots are open.', pass: 'Your Reserve Wellness Pass badge is saved.',
};
let pending = [];
let flushTimer = 0;
function queueFeedback(events) {
  pending = pending.concat(events);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flushFeedback, 40);
}
function flushFeedback() {
  const events = pending;
  pending = [];
  const stars = store.whole(events.filter((e) => e.type === 'stars').reduce((sum, e) => sum + e.amount, 0));
  const plus = stars ? ` +${stars}★` : '';
  const top = events.filter((e) => PRIORITY.includes(e.type)).sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type))[0];
  if (stars) fx.burst();
  if (!top) return;
  const s = store.streak();
  const streakLine = `Streak: ${s} day${s === 1 ? '' : 's'}.`;
  switch (top.type) {
    case 'tier': {
      const t = store.tierOf(store.state.lifetime);
      fx.toast(`Welcome to ${t.name}!`, t.id === 'gold' ? 'Check-ins now earn 1.5× Stars, plus a free freeze each week.' : 'Move days now earn 2× Stars.', 'celebrate');
      fx.react('celebrate');
      break;
    }
    case 'crown': fx.toast(`Trifecta Crown!${plus}`, 'All three today. That includes a new seed for your Sanctuary.', 'celebrate'); fx.react('celebrate'); break;
    case 'first-claim': fx.toast(`First call made${plus}`, 'You also got a seed. Plant it in your Sanctuary.', 'celebrate'); break;
    case 'mutation': fx.toast(`Rare mutation: ${top.name}!`, 'Find it glowing in your Sanctuary.', 'celebrate'); fx.react('celebrate'); break;
    case 'redeem': fx.toast(`Reward redeemed: −${top.cost}★`, REDEEMED[top.option], 'celebrate'); break;
    case 'harvest': fx.toast(`Harvested ${top.name}${plus}`, 'You got a seed back to plant again.', 'idle'); break;
    case 'bloom': fx.toast(`${top.name} is blooming`, 'Harvest it in your Sanctuary for 2★ and a seed.', 'idle'); break;
    case 'plant': fx.toast(`${top.name} planted${plus}`, 'Every check-in waters it, and it grows while you’re away.', 'idle'); break;
    case 'freeze-used': fx.toast(`Streak saved by ${top.count} freeze${top.count === 1 ? '' : 's'}`, 'Freezes covered the days you missed.', 'rest'); break;
    case 'rest': fx.toast(`Rest day logged${plus}`, `Rest days count. ${streakLine}`, 'rest'); fx.react('rest'); break;
    case 'checkin': {
      const hype = events.some((e) => e.type === 'streak') && s >= 2;
      fx.toast(`${NODE_NAMES[top.node]} done${plus}`, streakLine, hype ? 'fire' : 'idle');
      fx.react(hype ? 'fire' : 'celebrate', 2400);
      break;
    }
    case 'weekly-freeze': fx.toast('A free streak freeze', 'Your weekly Gold perk is ready.', 'idle'); break;
    default: break;
  }
}

function baseMood() {
  const d = store.dayOf();
  fx.setBaseMood(d.rest && !d.move ? 'rest' : store.streak() >= 3 ? 'fire' : 'idle');
}

// ---------- Page chrome ----------
function initCarousel() {
  const track = $('games-track');
  const nav = $('carousel-nav');
  if (!track || !nav) return;
  const [prev, next] = nav.querySelectorAll('button');
  const step = () => {
    const card = track.querySelector('li');
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return card ? card.getBoundingClientRect().width + gap : 300;
  };
  const update = () => {
    const max = track.scrollWidth - track.clientWidth - 2;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max;
    nav.hidden = track.scrollWidth <= track.clientWidth + 2;
  };
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-dir]');
    if (btn) track.scrollBy({ left: Number(btn.dataset.dir) * step(), behavior: fx.reducedMotion() ? 'auto' : 'smooth' });
  });
  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

function initUtility() {
  const toTop = document.querySelector('.to-top');
  const utility = $('utility');
  const hero = document.querySelector('.hero');
  if (!('IntersectionObserver' in window)) return;
  // The hero already holds Pengu's dock and the game controls, so the floating button waits below it.
  if (hero) new IntersectionObserver(([e]) => {
    if (toTop) toTop.hidden = e.isIntersecting;
    if (utility) utility.classList.toggle('is-hero', e.isIntersecting);
  }).observe(hero);
  // Keep the floating buttons off the early-access form and its submit button.
  const closing = $('early-access');
  if (utility && closing) new IntersectionObserver(([e]) => { utility.classList.toggle('is-tucked', e.isIntersecting); }, { rootMargin: '0px 0px -20% 0px' }).observe(closing);
}

// ---------- Start ----------
initTheme();
const dashboard = initDashboard();
const sanctuary = initSanctuary();
const tryIt = initTry();
const glide = initGlide();
const companion = initCompanion({
  actions: {
    play: () => tryIt.focus(),
    node: (n) => dashboard.openNode(n),
    glide: () => glide.open(),
  },
});
initForm();
initCarousel();
initUtility();
initPengyu();

function renderAll() {
  dashboard.render();
  sanctuary.render();
  const sug = companion.render();
  if (!tryIt.playing && $('try-result').hidden) $('dock-bubble').textContent = sug.text;
  if (tryIt.renderPlant && !$('try-result').hidden) tryIt.renderPlant();
  baseMood();
}

store.subscribe((e) => {
  if (e.type === 'tick') { sanctuary.render(); return; }
  renderAll();
  if (e.type === 'change' && e.events) queueFeedback(e.events);
  if (e.type === 'change' && e.saved === false) $('storage-banner').hidden = false;
});

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
  if (action === 'focus-try') { e.preventDefault(); tryIt.focus(); }
  if (action === 'open-glide') { e.preventDefault(); glide.open(); }
  if (action === 'open-companion') { e.preventDefault(); companion.open(); }
  if (action === 'plant') {
    const spot = store.firstEmptyPlot();
    fx.setOrigin(t);
    if (store.state.seeds > 0 && spot >= 0) store.plant(spot);
    else fx.toast('No empty plot or seed', 'Harvest a bloom or earn a seed first.', 'lab');
  }
});
$('hero-play').addEventListener('click', (e) => { e.preventDefault(); tryIt.focus(); });
$('storage-retry').addEventListener('click', () => {
  const ok = store.retryStorage();
  fx.toast(ok ? 'Saving works again' : 'Still can’t save', ok ? 'Your progress will stay in this browser.' : 'Try a regular (not private) window, or allow site data.', ok ? 'celebrate' : 'lab');
  renderAll();
});

renderAll();
store.reconcile();
let lastDay = store.today();
setInterval(() => {
  if (store.today() !== lastDay) { lastDay = store.today(); store.reconcile(); }
  store.tickGarden();
}, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { store.tickGarden(); renderAll(); } });
requestAnimationFrame(() => root.classList.add('hydrated'));
