// Feedback: toasts and counters. Every motion effect checks prefers-reduced-motion and falls back
// to an instant change.

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => motionQuery.matches;

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

// A short note that slides in and leaves by itself; `art` is Pengu's drawing from js/pengyu/art.js.
// While a sheet is open it shows inside the sheet, which sits above everything else on the page.
export function toast(title, sub = '', art = null) {
  const box = document.querySelector('dialog[open] .toasts') || document.getElementById('toasts');
  if (!box) return;
  const t = el('div', { class: 'toast' });
  const copy = el('div');
  copy.append(document.createTextNode(title));
  if (sub) copy.append(el('small', {}, sub));
  if (art) t.append(art);
  t.append(copy);
  box.append(t);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => {
    t.classList.add('is-leaving');
    setTimeout(() => t.remove(), 250);
  }, 3400);
}

// Counts a number up in place, e.g. the Fish balance.
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
