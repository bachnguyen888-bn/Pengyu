// Feedback: Pengu's moods, toasts, Star bursts and counters. Every motion effect checks
// prefers-reduced-motion and falls back to an instant change.

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => motionQuery.matches;

const STATES = ['idle', 'fire', 'rest', 'lab', 'celebrate'];

export function setPengu(svg, state, react = false) {
  if (!svg || !STATES.includes(state)) return;
  const use = svg.querySelector('use:not(.outfit)');
  if (use) use.setAttribute('href', `#pg-${state}`);
  svg.dataset.state = state;
  if (react && !reducedMotion()) {
    svg.classList.remove('is-reacting');
    void svg.getBoundingClientRect();
    svg.classList.add('is-reacting');
  }
}

// The main avatars share a mood; a reaction holds for a few seconds, then returns to `rest` or `idle`.
let baseMood = 'idle';
let moodTimer = 0;
const avatars = () => ['dock-pengu', 'today-pengu', 'companion-pengu'].map((id) => document.getElementById(id)).filter(Boolean);
export function setBaseMood(mood) {
  baseMood = mood;
  if (!moodTimer) avatars().forEach((a) => setPengu(a, mood));
}
export function react(mood, ms = 3200) {
  clearTimeout(moodTimer);
  avatars().forEach((a) => setPengu(a, mood, true));
  moodTimer = setTimeout(() => { moodTimer = 0; avatars().forEach((a) => setPengu(a, baseMood)); }, ms);
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}
export { el };

export function penguSvg(state = 'idle', cls = 'pengu') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.dataset.state = state;
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#pg-${state}`);
  const pin = document.createElementNS(ns, 'use');
  pin.setAttribute('href', '#acc-pin');
  pin.setAttribute('class', 'outfit');
  svg.append(use, pin);
  return svg;
}

export function toast(title, sub = '', mood = 'idle', art = null) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = el('div', { class: 'toast' });
  const copy = el('div');
  copy.append(document.createTextNode(title));
  if (sub) copy.append(el('small', {}, sub));
  t.append(art || penguSvg(mood), copy);
  box.append(t);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => {
    t.classList.add('is-leaving');
    setTimeout(() => t.remove(), 250);
  }, 3400);
}

// Stars fly out from an element and drift up.
let origin = null;
export function setOrigin(node) { origin = node; }
export function burst(from = origin, count = 14) {
  if (reducedMotion()) return;
  const layer = document.getElementById('fx');
  const target = from && from.isConnected ? from : null;
  if (!layer || !target) return;
  const r = target.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) return;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    const star = el('span', { class: 'fx-star' }, '★');
    star.style.setProperty('left', `${cx}px`);
    star.style.setProperty('top', `${cy}px`);
    layer.append(star);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 60 + Math.random() * 70;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 40;
    const anim = star.animate([
      { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy - 30}px)) scale(0.6)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    anim.onfinish = () => star.remove();
  }
}

// Counts a number up in place, e.g. a Star balance.
const counting = new WeakMap();
export function countTo(node, to, format = (n) => String(n)) {
  if (!node) return;
  const from = Number(node.dataset.value || 0);
  node.dataset.value = String(to);
  cancelAnimationFrame(counting.get(node));
  if (reducedMotion() || from === to) { node.textContent = format(to); return; }
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / 650);
    const eased = 1 - Math.pow(1 - k, 3);
    node.textContent = format(Math.round(from + (to - from) * eased));
    if (k < 1) counting.set(node, requestAnimationFrame(step));
  };
  counting.set(node, requestAnimationFrame(step));
  if (to > from) { node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }
}

export function scrollToEl(node, focusEl) {
  if (!node) return;
  node.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  if (focusEl) setTimeout(() => focusEl.focus({ preventScroll: true }), reducedMotion() ? 0 : 400);
}

export function formatDuration(ms) {
  if (ms <= 0) return 'Now';
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
