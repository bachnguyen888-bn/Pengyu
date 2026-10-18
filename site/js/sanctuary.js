// Pengu's Vitality Sanctuary: garden plots drawn over the station art. Plants are SVG built here,
// so their colours are attributes (the CSP allows no inline styles in markup).

import * as store from './store.js';
import { SPECIES, PLOT_SPOTS } from './content.js';
import { toast, setOrigin, formatDuration } from './fx.js';

const NS = 'http://www.w3.org/2000/svg';
const STAGE_NAMES = ['Seed', 'Sprout', 'Growing', 'Bud', 'Bloom'];
const COLORS = {
  chamomile: { petal: '#FFFFFF', center: '#F59E0B', bud: '#FDE68A', leaf: '#22C55E' },
  mint: { petal: '#C4B5FD', center: '#A78BFA', bud: '#DDD6FE', leaf: '#10B981' },
  lotus: { petal: '#F9A8D4', center: '#FBCFE8', bud: '#FBCFE8', leaf: '#16A34A' },
};
const MUTANT = {
  golden: { petal: '#FCD34D', center: '#B45309', leaf: '#22C55E', glow: '#FDE68A' },
  mint: { petal: '#99F6E4', center: '#2DD4BF', leaf: '#5EEAD4', glow: '#34D399' },
  frost: { petal: '#E0F2FE', center: '#BAE6FD', leaf: '#7DD3FC', glow: '#93C5FD' },
};

function s(tag, attrs) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
function leaf(g, x, y, angle, size, color) {
  g.append(s('path', { d: 'M0 0 C6 -6 14 -6 18 0 C14 6 6 6 0 0 Z', fill: color, transform: `translate(${x} ${y}) rotate(${angle}) scale(${size})` }));
}

function plantSvg(plot) {
  const svg = s('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(s('ellipse', { cx: 50, cy: 90, rx: 30, ry: 8, fill: '#4C3570' }));
  svg.append(s('ellipse', { cx: 50, cy: 88, rx: 26, ry: 5.5, fill: '#6B4F92' }));
  if (!plot) {
    svg.append(s('ellipse', { cx: 50, cy: 80, rx: 22, ry: 8, fill: 'none', stroke: '#FFFFFF', 'stroke-width': 2.5, 'stroke-dasharray': '5 5' }));
    svg.append(s('path', { d: 'M50 64 V78 M43 71 H57', stroke: '#FFFFFF', 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
    return svg;
  }
  const stage = store.stageOf(plot);
  const base = COLORS[plot.species];
  const c = plot.mutation ? { ...base, ...MUTANT[plot.mutation] } : base;
  const g = s('g', { class: 'plant' });
  if (stage === 0) {
    g.append(s('ellipse', { cx: 50, cy: 85, rx: 5, ry: 3.5, fill: '#A16207' }));
    g.append(s('path', { d: 'M50 82 q2 -5 6 -6', stroke: '#22C55E', 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round' }));
    svg.append(g);
    return svg;
  }
  const h = [0, 20, 34, 46, 54][stage];
  const top = 88 - h;
  if (stage === 4 && plot.mutation) {
    g.append(s('circle', { class: 'glow', cx: 50, cy: top, r: 22, fill: c.glow, opacity: 0.6, filter: 'url(#mb-m)' }));
  }
  g.append(s('path', { d: `M50 88 C48 ${88 - h * 0.4} 52 ${88 - h * 0.7} 50 ${top}`, stroke: '#15803D', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }));
  leaf(g, 50, top + 6, -150, 0.9, c.leaf);
  leaf(g, 50, top + 6, -30, 0.9, c.leaf);
  if (stage >= 2) { leaf(g, 50, 88 - h * 0.35, -165, 1.1, c.leaf); leaf(g, 50, 88 - h * 0.5, -15, 1.1, c.leaf); }
  if (stage === 3) g.append(s('ellipse', { cx: 50, cy: top - 4, rx: 6, ry: 8, fill: c.bud, stroke: '#FFFFFF', 'stroke-width': 1 }));
  if (stage === 4) {
    if (plot.species === 'chamomile') {
      for (let i = 0; i < 10; i++) g.append(s('ellipse', { cx: 50, cy: top - 10, rx: 3.2, ry: 8, fill: c.petal, stroke: '#E5E7EB', 'stroke-width': 0.6, transform: `rotate(${i * 36} 50 ${top})` }));
      g.append(s('circle', { cx: 50, cy: top, r: 5.5, fill: c.center }));
    } else if (plot.species === 'mint') {
      for (const [dx, dy, a] of [[-10, 4, -140], [10, 4, -40], [-6, -6, -110], [6, -6, -70]]) leaf(g, 50 + dx, top + dy, a, 1.2, c.leaf);
      for (const [dx, dy] of [[0, -14], [-6, -10], [6, -10]]) g.append(s('circle', { cx: 50 + dx, cy: top + dy, r: 3.4, fill: c.petal }));
    } else {
      for (let i = -2; i <= 2; i++) g.append(s('path', { d: `M50 ${top + 2} C${44 + i * 3} ${top - 6} ${46 + i * 4} ${top - 16} 50 ${top - 20} C${54 + i * 4} ${top - 16} ${56 + i * 3} ${top - 6} 50 ${top + 2} Z`, fill: c.petal, stroke: '#FFFFFF', 'stroke-width': 0.8, transform: `rotate(${i * 28} 50 ${top + 2})` }));
      g.append(s('circle', { cx: 50, cy: top - 2, r: 3.5, fill: c.center }));
      if (plot.mutation === 'frost') for (const [dx, dy] of [[-16, -18], [16, -14], [0, -28]]) g.append(s('path', { d: `M${50 + dx} ${top + dy - 3} V${top + dy + 3} M${50 + dx - 3} ${top + dy} H${50 + dx + 3}`, stroke: '#FFFFFF', 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
    }
  }
  svg.append(g);
  return svg;
}

function describe(plot, index) {
  const n = index + 1;
  if (!plot) return store.state.seeds > 0 ? `Plot ${n}: empty. Plant a seed (${store.state.seeds} left).` : `Plot ${n}: empty. Earn a seed with a Trifecta day, a harvest or a Seed Pack.`;
  const sp = SPECIES[plot.species];
  const stage = store.stageOf(plot);
  if (stage === 4) return `Plot ${n}: ${plot.mutation ? sp.mutantName : sp.name} in bloom. Harvest for 2 Stars and a seed.`;
  return `Plot ${n}: ${sp.name}, ${STAGE_NAMES[stage].toLowerCase()}. Next stage in ${formatDuration(store.msToNextStage(plot))}, sooner if you check in.`;
}

export function initSanctuary() {
  const layer = document.getElementById('plots');
  const empty = document.getElementById('sanctuary-empty');
  if (!layer) return { render() {} };
  const cache = [];

  function render() {
    const st = store.state;
    for (let i = 0; i < PLOT_SPOTS.length; i++) {
      const open = i < st.plotsOpen;
      let btn = cache[i];
      if (!open) { if (btn) { btn.remove(); cache[i] = null; } continue; }
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'plot';
        btn.style.setProperty('left', `${PLOT_SPOTS[i].x}%`);
        btn.style.setProperty('top', `${PLOT_SPOTS[i].y}%`);
        btn.addEventListener('click', () => onPlot(i, btn));
        layer.append(btn);
        cache[i] = btn;
      }
      const plot = st.plots[i];
      const stage = plot ? store.stageOf(plot) : -1;
      const sig = plot ? `${plot.species}|${stage}|${plot.mutation}` : `empty|${st.seeds > 0}`;
      if (btn.dataset.sig !== sig) {
        const grew = btn.dataset.sig && plot && btn.dataset.sig.startsWith(plot.species);
        btn.dataset.sig = sig;
        btn.textContent = '';
        btn.append(plantSvg(plot));
        const label = document.createElement('span');
        label.className = 'plot-label';
        label.textContent = plot ? (stage === 4 && plot.mutation ? SPECIES[plot.species].mutantName : STAGE_NAMES[stage]) : (st.seeds > 0 ? 'Plant' : 'Empty');
        btn.append(label);
        btn.classList.toggle('is-mutant', Boolean(plot && plot.mutation));
        btn.classList.toggle('is-empty', !plot);
        if (grew) { btn.classList.remove('is-growing'); void btn.offsetWidth; btn.classList.add('is-growing'); }
      }
      btn.setAttribute('aria-label', describe(plot, i));
    }

    const planted = st.plots.filter(Boolean);
    const blooms = planted.filter((p) => store.stageOf(p) === 4).length;
    const growing = planted.length - blooms;
    const waits = planted.map((p) => store.msToNextStage(p)).filter((ms) => ms > 0);
    setText('g-growing', growing);
    setText('g-blooms', blooms);
    setText('g-next', waits.length ? formatDuration(Math.min(...waits)) : (blooms ? 'Harvest' : 'None'));
    setText('g-seeds', st.seeds);
    setText('g-plots', st.plotsOpen);
    setText('g-water', st.lastWatered ? ago(st.lastWatered) : 'Never');
    for (const li of document.querySelectorAll('#mutations .mutation')) {
      const found = st.mutationsFound.includes(li.dataset.m);
      li.classList.toggle('found', found);
      li.setAttribute('aria-label', `${li.textContent.trim()}: ${found ? 'discovered' : 'not yet discovered'}`);
    }
    if (empty) empty.hidden = Boolean(st.firsts.plant || planted.length);
  }

  function onPlot(i, btn) {
    const plot = store.state.plots[i];
    setOrigin(btn);
    if (!plot) {
      if (store.state.seeds > 0) store.plant(i);
      else toast('No seeds yet', 'A Trifecta day, a harvest or a Seed Pack gives you one.', 'lab');
      return;
    }
    if (store.stageOf(plot) === 4) { store.harvest(i); return; }
    toast(describe(plot, i).replace(/^Plot \d+: /, ''), 'Move, learn or play to water it.', 'idle');
  }

  return { render };
}

function setText(id, value) { const n = document.getElementById(id); if (n) n.textContent = String(value); }
function ago(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
