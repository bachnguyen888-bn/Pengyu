// "Look out the window" (Today): Pengu's window, a tiny story in three authored scenes (story.js has the
// words), one tap at a time, then Replay or Done. The scenes are drawn here in the hand-drawn style and the
// locked palette. The frame wears the player's train paint and Pengu peeks in wearing their gear: both from
// choices already made, and nothing new. No Fish, no score, no workout asked for, nothing random and
// nothing saved: closing it leaves the save exactly as it was.

import * as S from './state.js';
import { windowStory, WINDOW_TITLE } from './story.js';
import { h, icon } from './ui.js';
import { penguFigure, PAINT_COLORS } from './art.js';
import { bindPengu, sceneIn } from './motion.js';
import { rng, wobblyLine, softRect } from './ink.js';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;
const f = (n) => Math.round(n * 10) / 10;

// A snowy pine: three tiers, each with a cap of snow, a little uneven on purpose.
function pine(x, base, size, seed) {
  const r = rng(seed);
  const j = () => (r() * 2 - 1) * size * 0.05;
  let out = `<rect x="${f(x - size * 0.06)}" y="${f(base - size * 0.16)}" width="${f(size * 0.12)}" height="${f(size * 0.18)}" rx="1" fill="#5E3414"/>`;
  for (let t = 0; t < 3; t++) {
    const w = size * (0.62 - t * 0.14);
    const top = base - size * (0.5 + t * 0.26);
    const bot = base - size * (0.12 + t * 0.26);
    out += `<path d="M${f(x + j())} ${f(top)}L${f(x + w / 2 + j())} ${f(bot)}Q${f(x)} ${f(bot + size * 0.05)} ${f(x - w / 2 + j())} ${f(bot)}Z" fill="#2F3A52"/>`;
    out += `<path d="M${f(x)} ${f(top + 0.5)}L${f(x + w * 0.2)} ${f(top + size * 0.11)}Q${f(x + w * 0.05)} ${f(top + size * 0.15)} ${f(x)} ${f(top + size * 0.1)}Q${f(x - w * 0.06)} ${f(top + size * 0.15)} ${f(x - w * 0.2)} ${f(top + size * 0.11)}Z" fill="#FFFFFF"/>`;
  }
  return out;
}

// Each scene: one 320 × 200 picture in layers (far, middle, near) that slide at their own speeds, so the
// view seems to roll past the window. Positions are seeded, so every visit draws the same picture.
const SCENES = {
  pines(id) {
    const r = rng(31);
    const flakes = Array.from({ length: 22 }, () => `<circle cx="${f(r() * 320)}" cy="${f(r() * 150)}" r="${f(1.3 + r() * 1.4)}"/>`).join('');
    const trees = [[28, 150, 64, 1], [76, 154, 48, 2], [150, 152, 72, 3], [212, 155, 54, 4], [262, 151, 66, 5], [306, 156, 44, 6]].map(([x, b, s, k]) => pine(x, b, s, 40 + k)).join('');
    return `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDE6F3"/><stop offset="1" stop-color="#FAF6F0"/></linearGradient></defs>
      <rect width="320" height="200" fill="url(#${id}-sky)"/>
      <g class="py-win-far"><path d="M-40 126C10 98 64 104 108 118S200 94 252 110S340 98 380 114V200H-40Z" fill="#F3ECE4" stroke="#E6DCD3" stroke-width="1.2"/></g>
      <g class="py-win-mid">${trees}</g>
      <g class="py-win-near"><path d="M-40 158Q60 148 160 156T380 152V200H-40Z" fill="#FFFFFF"/><path d="${wobblyLine(-40, 380, 156, { seed: 8, amp: 1.2, step: 48 })}" fill="none" stroke="#E6DCD3" stroke-width="1.4"/>
        <path d="M40 176q18-9 36 0M210 184q22-10 44 0" fill="none" stroke="#E6DCD3" stroke-width="1.4" stroke-linecap="round"/></g>
      <g class="py-win-snow" fill="#FFFFFF" stroke="#D9D2CE" stroke-width=".6">${flakes}</g>`;
  },
  tunnel(id, { headlamp = false } = {}) {
    const rings = [[10, 6, 300, 188, 0.5], [52, 32, 216, 136, 0.65], [88, 54, 144, 92, 0.8], [116, 72, 88, 56, 0.95]]
      .map(([x, y, w, hh, o], i) => `<path d="${softRect(x, y, w, hh, 18 - i * 3, { seed: 60 + i, amp: 1 })}" fill="none" stroke="#3A3436" stroke-width="${3 - i * 0.5}" opacity="${o}"/>`).join('');
    const lamps = [[160, 20, 6, 16], [160, 46, 4.2, 11], [160, 64, 2.8, 7]].map(([x, y, rr, g]) => `<circle cx="${x}" cy="${y}" r="${g}" fill="#FFE08A" opacity=".22"/><circle cx="${x}" cy="${y}" r="${rr}" fill="#FFE08A"/>`).join('');
    const ties = [196, 172, 154, 141, 132].map((y, i) => `<path d="M${f(118 + i * 8)} ${y}H${f(202 - i * 8)}"/>`).join('');
    return `<defs><radialGradient id="${id}-lift" cx="50%" cy="56%" r="70%"><stop offset="0" stop-color="#2B2829"/><stop offset="1" stop-color="#141213"/></radialGradient></defs>
      <rect width="320" height="200" fill="url(#${id}-lift)"/>
      <g class="py-win-far"><ellipse cx="160" cy="99" rx="38" ry="26" fill="#FFE08A" opacity=".18"/><rect x="141" y="87" width="38" height="24" rx="9" fill="#FFE3DA" opacity=".92"/>${rings}</g>
      <g class="py-win-mid">${lamps}</g>
      <g class="py-win-near"><path d="M70 200L152 118M250 200L168 118" fill="none" stroke="#5E5558" stroke-width="3" stroke-linecap="round"/>
        <g fill="none" stroke="#5E5558" stroke-width="2" stroke-linecap="round">${ties}</g>
        ${headlamp ? '<path d="M118 200L150 116H170L202 200Z" fill="#FFE08A" opacity=".26"/>' : ''}</g>`;
  },
  hills(id) {
    return `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF9A52"/><stop offset="1" stop-color="#FFE3DA"/></linearGradient></defs>
      <rect width="320" height="200" fill="url(#${id}-sky)"/>
      <g class="py-win-far"><circle cx="92" cy="118" r="26" fill="#FFCE3A"/><path d="M-40 128C20 104 80 112 130 124S230 100 380 122V200H-40Z" fill="#E99BCB" opacity=".6"/></g>
      <g class="py-win-mid"><path d="M-40 146C40 124 110 132 170 144S270 126 380 140V200H-40Z" fill="#FF6B4A" opacity=".85"/>
        <g transform="translate(236 118)"><path d="M2 0V36M30 0V36" stroke="#5E3414" stroke-width="3" stroke-linecap="round"/><path d="${softRect(-6, -14, 44, 18, 5, { seed: 77, amp: 0.6 })}" fill="#F7F2EE"/><path d="M0 -2H32" stroke="#FF6B4A" stroke-width="3" stroke-linecap="round"/></g></g>
      <g class="py-win-near"><path d="M-40 166Q60 150 150 162T380 158V200H-40Z" fill="#B8763A"/><path d="M-40 182Q90 170 200 180T380 178V200H-40Z" fill="#8A4E22"/>
        <path d="${wobblyLine(-40, 380, 192, { seed: 15, amp: 0.8, step: 44 })}" fill="none" stroke="#5E3414" stroke-width="2.4"/></g>`;
  },
};

function sceneSvg(id) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'py-win-scene');
  svg.setAttribute('viewBox', '0 0 320 200');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = SCENES[id](`pw${++uid}`, { headlamp: S.owns('headlamp') });
  return svg;
}

// Fills an open sheet (route.js's openSheet) with the story. `close` closes the sheet.
export function buildWindow(panel, close) {
  const story = windowStory(S);
  const look = S.look();
  let at = 0;
  const frame = h('div', { class: 'py-win-frame' });
  frame.style.setProperty('--win', (PAINT_COLORS[look.paint] || PAINT_COLORS.navy).cab);
  const view = h('div', { class: 'py-win-view' });
  // A tap on the picture shows the next view, as Next does; keyboards and screen readers use the buttons.
  const tapNext = h('button', { class: 'py-win-tap', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onclick: () => step(1) });
  const pengu = penguFigure(look, { cls: 'py-win-pengu', pose: 'bust' });
  view.append(pengu);   // at the sill, above every view (pengu.css), clipped by the window
  frame.append(view, tapNext);
  const line = h('p', { class: 'py-win-line', id: 'py-win-line', 'aria-live': 'polite' });
  const dots = h('ol', { class: 'py-dots py-win-dots', 'aria-hidden': 'true' }, story.map(() => h('li')));
  const back = h('button', { class: 'btn btn-secondary py-win-back', type: 'button', id: 'py-win-back' });
  const next = h('button', { class: 'btn glass-coral py-win-next', type: 'button', id: 'py-win-next', autofocus: true });
  const alive = bindPengu(pengu, { follow: true, hop: true });

  function show(i, dir = 0) {
    at = i;
    const last = i === story.length - 1;
    const prev = view.querySelector('.py-win-scene');
    const svg = sceneSvg(story[i].id);
    view.append(svg);
    sceneIn(svg, prev, dir);
    line.textContent = '';
    line.append(h('span', { class: 'sr-only' }, `View ${i + 1} of ${story.length}. `), story[i].line);
    [...dots.children].forEach((d, k) => d.classList.toggle('is-on', k <= i));
    back.textContent = last ? 'Replay' : 'Back';
    back.hidden = i === 0;
    next.textContent = last ? 'Done' : 'Next';
  }
  function step(d) {
    if (at + d >= story.length) return;   // the end waits for Replay or Done
    if (at + d >= 0) show(at + d, d);
  }
  back.addEventListener('click', () => { if (at === story.length - 1) { show(0, 1); next.focus({ preventScroll: true }); } else step(-1); });
  next.addEventListener('click', () => { if (at === story.length - 1) close(); else step(1); });

  panel.append(
    h('div', { class: 'py-sheet-head' },
      h('h2', { class: 'py-win-title', id: 'py-win-title' }, WINDOW_TITLE),
      h('button', { class: 'py-sheet-close glass', type: 'button', 'aria-label': 'Close', onclick: () => close() }, icon('i-close'))),
    frame,
    line,
    dots,
    h('div', { class: 'py-win-actions' }, back, next),
    h('p', { class: 'py-sheet-note py-win-note' }, 'A quiet moment. No Fish or workout needed.'));
  show(0);
  return () => alive?.stop();
}
