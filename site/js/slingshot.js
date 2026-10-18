// Facts or Cap, slingshot style: pull Pengu's Truth Orb back, watch the dotted arc, and launch it
// at the FACTS tower or the CAP tower. The tower you hit is your call. The two buttons under the
// canvas launch an aimed shot, so the game also works by keyboard and screen reader.

import { reducedMotion } from './fx.js';

const COLORS = {
  facts: { base: '#047857', sign: '#10B981', edge: '#065F46' },
  cap: { base: '#B91C1C', sign: '#EF4444', edge: '#7F1D1D' },
};

export function createSlingshot({ wrap, canvas, onShot, onResult }) {
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return null;

  let W = 0; let H = 0;
  let L = {};                         // layout
  const orb = { x: 0, y: 0, vx: 0, vy: 0, r: 10, flying: false, alive: true };
  let dragging = false;
  let towers = [];
  let debris = [];
  let particles = [];
  let skyStars = [];
  let shots = 0;
  let finished = false;
  let recoil = 0;                     // band wobble after release
  let penguHop = 0;
  let raf = 0;
  let lastT = 0;
  let missTimer = 0;

  // A grab zone over the left of the canvas takes touch drags; the rest still scrolls the page.
  const grab = document.createElement('div');
  grab.className = 'sling-grab';
  grab.setAttribute('aria-hidden', 'true');
  wrap.append(grab);

  function computeLayout() {
    const ground = H * 0.84;
    const ax = W * 0.2;
    const ay = ground - H * 0.36;
    const maxPull = Math.min(H * 0.3, W * 0.2);
    const g = H * 2.4;
    L = {
      ground, ax, ay, maxPull, g,
      k: Math.sqrt(W * 0.85 * g) / maxPull,
      tipL: { x: ax - W * 0.045, y: ay - H * 0.02 },
      tipR: { x: ax + W * 0.045, y: ay - H * 0.02 },
      forkJoin: { x: ax, y: ay + H * 0.16 },
    };
    orb.r = Math.max(8, Math.min(16, W * 0.024));
  }

  function buildTowers() {
    const bw = W * 0.105;
    const bh = H * 0.105;
    const make = (id, cx) => {
      const blocks = [];
      let y = L.ground;
      for (let i = 0; i < 2; i++) { y -= bh; blocks.push({ x: cx - bw / 2, y, w: bw, h: bh, sign: false }); }
      const sw = bw * 1.35; const sh = bh * 1.15;
      y -= sh;
      blocks.push({ x: cx - sw / 2, y, w: sw, h: sh, sign: true });
      return { id, label: id === 'facts' ? 'FACTS' : 'CAP', blocks, broken: false, cx };
    };
    towers = [make('facts', W * 0.6), make('cap', W * 0.84)];
  }

  function resetOrb() {
    orb.x = L.ax; orb.y = L.ay; orb.vx = 0; orb.vy = 0; orb.flying = false; orb.alive = true;
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = r.width; H = r.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeLayout();
    skyStars = Array.from({ length: 36 }, (_, i) => ({ x: ((i * 97) % 100) / 100 * W, y: ((i * 53) % 70) / 100 * H * 0.9, r: (i % 3) * 0.5 + 0.6 }));
    if (!finished) { buildTowers(); if (!orb.flying) resetOrb(); }
    draw();
  }

  // ---------- Physics ----------
  function circleRect(cx, cy, r, b) {
    const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
    const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }
  function hitTower(x, y, r) {
    for (const t of towers) if (!t.broken && t.blocks.some((b) => circleRect(x, y, r, b))) return t;
    return null;
  }

  function launch(vx, vy) {
    orb.vx = vx; orb.vy = vy; orb.flying = true;
    recoil = 1;
    shots += 1;
    if (onShot) onShot(shots);
    loop();
  }

  function shatter(t) {
    t.broken = true;
    const calm = reducedMotion();
    for (const b of t.blocks) {
      const pieces = calm ? 1 : 4;
      for (let i = 0; i < pieces; i++) {
        const w = b.w / (calm ? 1 : 2); const h = b.h / (calm ? 1 : 2);
        const px = b.x + (i % 2) * w; const py = b.y + Math.floor(i / 2) * h;
        debris.push({
          x: px, y: py, w, h, sign: b.sign && i === 0, label: t.label, colors: COLORS[t.id],
          vx: calm ? 0 : (orb.vx * 0.25 + (Math.random() - 0.3) * W * 0.5),
          vy: calm ? 0 : -(H * (0.4 + Math.random() * 0.9)),
          rot: 0, vr: calm ? 0 : (Math.random() - 0.5) * 8,
          life: calm ? 0.6 : 2.2, calm,
        });
      }
    }
    if (!calm) {
      for (let i = 0; i < 34; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = W * (0.2 + Math.random() * 0.6);
        particles.push({
          x: orb.x, y: orb.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - H * 0.3,
          r: 1.5 + Math.random() * 3, life: 0.6 + Math.random() * 0.5,
          color: ['#FDE68A', '#FFFFFF', COLORS[t.id].sign, '#A29BFE'][i % 4],
        });
      }
      wrap.classList.remove('is-shaking');
      void wrap.offsetWidth;
      wrap.classList.add('is-shaking');
      setTimeout(() => wrap.classList.remove('is-shaking'), 400);
    }
    orb.alive = false;
    orb.flying = false;
    finished = true;
    penguHop = 1;
    if (onResult) onResult(t.id, shots);
  }

  function miss() {
    orb.flying = false;
    orb.alive = false;
    clearTimeout(missTimer);
    // Instant retry: the orb is back on the band within a tenth of a second.
    missTimer = setTimeout(() => { resetOrb(); draw(); }, 100);
    if (onShot) onShot(shots, true);
  }

  function step(dt) {
    if (orb.flying) {
      const sub = 4;
      for (let i = 0; i < sub && orb.flying; i++) {
        const h = dt / sub;
        orb.vy += L.g * h;
        orb.x += orb.vx * h;
        orb.y += orb.vy * h;
        const t = hitTower(orb.x, orb.y, orb.r);
        if (t) { shatter(t); break; }
        if (orb.y + orb.r >= L.ground || orb.x - orb.r > W || orb.x + orb.r < 0) { miss(); break; }
      }
    }
    for (const d of debris) {
      if (d.calm) { d.life -= dt; continue; }
      d.vy += L.g * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; d.life -= dt;
      if (d.y + d.h > L.ground) { d.y = L.ground - d.h; d.vy *= -0.3; d.vx *= 0.7; d.vr *= 0.6; }
    }
    debris = debris.filter((d) => d.life > 0);
    for (const p of particles) { p.vy += L.g * 0.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    particles = particles.filter((p) => p.life > 0);
    recoil = Math.max(0, recoil - dt * 2.2);
    penguHop = Math.max(0, penguHop - dt * 1.5);
  }

  function busy() { return dragging || orb.flying || debris.length || particles.length || recoil > 0 || penguHop > 0; }

  function loop() {
    if (raf) return;
    lastT = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.033, (now - lastT) / 1000);
      lastT = now;
      step(dt);
      draw();
      raf = busy() ? requestAnimationFrame(frame) : 0;
    };
    raf = requestAnimationFrame(frame);
  }

  // ---------- Drawing ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBlock(b, colors, label) {
    const r = Math.min(8, b.w * 0.12);
    roundRect(b.x, b.y, b.w, b.h, r);
    ctx.fillStyle = b.sign ? colors.sign : colors.base;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.edge;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(b.x + 3, b.y + 3, b.w - 6, Math.max(3, b.h * 0.22), r * 0.6);
    ctx.fill();
    if (b.sign && label) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `600 ${Math.max(11, Math.min(20, b.h * 0.42))}px "Public Sans", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    }
  }

  function drawPengu() {
    const s = Math.min(W * 0.034, H * 0.06);
    const x = L.ax - W * 0.1;
    const hop = Math.sin(penguHop * Math.PI) * H * 0.06;
    const y = L.ground - s * 2.2 - hop;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath(); ctx.ellipse(-s * 0.4, s * 2.15, s * 0.42, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.4, s * 2.15, s * 0.42, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2E3A5E';
    ctx.beginPath(); ctx.ellipse(0, s * 1.05, s * 1.05, s * 1.15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.ellipse(0, s * 1.25, s * 0.68, s * 0.85, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7BD8A6';
    ctx.fillRect(-s * 0.95, s * 0.95, s * 1.9, s * 0.22);
    ctx.fillStyle = '#26262E';
    ctx.beginPath(); ctx.arc(-s * 0.3, s * 0.55, s * 0.12, 0, Math.PI * 2); ctx.arc(s * 0.3, s * 0.55, s * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath(); ctx.moveTo(-s * 0.18, s * 0.72); ctx.lineTo(s * 0.18, s * 0.72); ctx.lineTo(0, s * 0.92); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawOrb(x, y) {
    const r = orb.r;
    const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.4);
    glow.addColorStop(0, 'rgba(162,155,254,0.55)');
    glow.addColorStop(1, 'rgba(162,155,254,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
    const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    body.addColorStop(0, '#FFFFFF');
    body.addColorStop(0.45, '#C4B5FD');
    body.addColorStop(1, '#6C5CE7');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  function trajectory() {
    const vx = (L.ax - orb.x) * L.k;
    const vy = (L.ay - orb.y) * L.k;
    let x = orb.x; let y = orb.y; let svx = vx; let svy = vy;
    const dt = 1 / 30;
    for (let i = 1; i <= 34; i++) {
      for (let j = 0; j < 2; j++) { svy += L.g * dt / 2; x += svx * dt / 2; y += svy * dt / 2; }
      if (y > L.ground || x > W || hitTower(x, y, 2)) break;
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0.15, 0.9 - i * 0.025)})`;
      ctx.beginPath(); ctx.arc(x, y, Math.max(1.4, 3.2 - i * 0.05), 0, Math.PI * 2); ctx.fill();
    }
  }

  function band(from, to, width) {
    ctx.strokeStyle = '#1E1945';
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  }

  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    for (const s of skyStars) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }

    // Ground
    ctx.fillStyle = '#C9C2F5';
    roundRect(-10, L.ground, W + 20, H - L.ground + 10, 12);
    ctx.fill();
    ctx.fillStyle = '#E4DFFF';
    ctx.fillRect(0, L.ground, W, 3);

    for (const t of towers) if (!t.broken) for (const b of t.blocks) drawBlock(b, COLORS[t.id], t.label);

    // Debris
    for (const d of debris) {
      ctx.save();
      ctx.globalAlpha = d.calm ? Math.max(0, d.life / 0.6) : Math.min(1, d.life);
      ctx.translate(d.x + d.w / 2, d.y + d.h / 2);
      ctx.rotate(d.rot);
      drawBlock({ x: -d.w / 2, y: -d.h / 2, w: d.w, h: d.h, sign: d.sign }, d.colors, d.sign ? d.label : '');
      ctx.restore();
    }

    drawPengu();

    // Slingshot back arm and band
    const stretch = Math.min(1, Math.hypot(orb.x - L.ax, orb.y - L.ay) / L.maxPull);
    const resting = !orb.flying && orb.alive;
    const wob = Math.sin(recoil * 18) * recoil * H * 0.03;
    ctx.strokeStyle = '#3B3486'; ctx.lineWidth = Math.max(5, W * 0.012); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(L.ax, L.ground); ctx.lineTo(L.forkJoin.x, L.forkJoin.y); ctx.lineTo(L.tipL.x, L.tipL.y); ctx.stroke();
    if (resting) band(L.tipL, { x: orb.x - orb.r * 0.6, y: orb.y }, 6 - stretch * 3);
    else band(L.tipL, { x: L.ax, y: L.ay + wob }, 3);

    if (dragging) trajectory();
    if (orb.alive) drawOrb(orb.x, orb.y);

    // Front arm and band
    if (resting) band(L.tipR, { x: orb.x + orb.r * 0.6, y: orb.y }, 6 - stretch * 3);
    else band(L.tipR, { x: L.ax, y: L.ay + wob }, 3);
    ctx.strokeStyle = '#4B3CC4'; ctx.lineWidth = Math.max(5, W * 0.012);
    ctx.beginPath(); ctx.moveTo(L.forkJoin.x, L.forkJoin.y); ctx.lineTo(L.tipR.x, L.tipR.y); ctx.stroke();

    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Input ----------
  function point(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onDown(e) {
    if (finished || orb.flying || !orb.alive) return;
    e.preventDefault();
    dragging = true;
    grab.setPointerCapture(e.pointerId);
    onMove(e);
    loop();
  }
  function onMove(e) {
    if (!dragging) return;
    const p = point(e);
    let dx = p.x - L.ax; let dy = p.y - L.ay;
    const len = Math.hypot(dx, dy);
    if (len > L.maxPull) { dx *= L.maxPull / len; dy *= L.maxPull / len; }
    if (dx > orb.r) dx = orb.r;           // the orb can't be pushed forward through the fork
    orb.x = L.ax + dx; orb.y = L.ay + dy;
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    const dx = L.ax - orb.x; const dy = L.ay - orb.y;
    if (Math.hypot(dx, dy) < orb.r * 1.2) { resetOrb(); draw(); return; }
    launch(dx * L.k, dy * L.k);
  }
  grab.addEventListener('pointerdown', onDown);
  grab.addEventListener('pointermove', onMove);
  grab.addEventListener('pointerup', onUp);
  grab.addEventListener('pointercancel', () => { dragging = false; resetOrb(); draw(); });

  // Which tower would a launch hit first? Same physics as the real flight, which starts from
  // the pulled-back position.
  function simulate(vx, vy) {
    let x = L.ax - vx / L.k; let y = L.ay - vy / L.k; const h = 1 / 240;
    for (let i = 0; i < 2400; i++) {
      vy += L.g * h; x += vx * h; y += vy * h;
      const t = hitTower(x, y, orb.r);
      if (t) return t.id;
      if (y + orb.r >= L.ground || x - orb.r > W) return null;
    }
    return null;
  }

  // An aimed shot for the buttons: search launch angles and strengths for an arc that reaches the
  // chosen tower without clipping the other one, show the pull-back for a moment, then release.
  function aimAt(id) {
    if (finished || orb.flying) return;
    const t = towers.find((x) => x.id === id);
    if (!t) return;
    if (reducedMotion()) { shots += 1; if (onShot) onShot(shots); orb.x = t.cx; orb.y = t.blocks[2].y; shatter(t); loop(); return; }
    const vmax = L.maxPull * L.k;
    let shot = null;
    for (const deg of [52, 56, 48, 60, 64, 44, 68, 72, 40]) {
      const a = (deg * Math.PI) / 180;
      for (let f = 0.3; f <= 1.0001 && !shot; f += 0.01) {
        const vx = vmax * f * Math.cos(a); const vy = -vmax * f * Math.sin(a);
        const hit = simulate(vx, vy);
        if (hit === id) shot = { vx, vy };
        else if (hit) break;           // stronger shots at this angle only go further into towers
      }
      if (shot) break;
    }
    if (!shot) { shots += 1; if (onShot) onShot(shots); shatter(t); return; }
    orb.x = L.ax - shot.vx / L.k; orb.y = L.ay - shot.vy / L.k;
    dragging = true; loop();
    setTimeout(() => { dragging = false; launch(shot.vx, shot.vy); }, 260);
  }

  function reset() {
    finished = false; debris = []; particles = []; shots = 0; penguHop = 0;
    buildTowers(); resetOrb(); draw();
    if (onShot) onShot(0);
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();

  return { aimAt, reset, get shots() { return shots; }, get finished() { return finished; } };
}
