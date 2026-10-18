// Sleep Sprint lab prototype: one tap keeps Pengu gliding through the night past late-night
// coffee. Survive 30 seconds. A crash shows "Tap to retry", and the next tap restarts at once.
// A dashed marker shows the next example friend's score to beat.

import { reducedMotion } from './fx.js';
import { FRIENDS } from './content.js';

const RUN_SECONDS = 30;

export function createGlide({ wrap, canvas, onEnd, onScore, onTime }) {
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return null;

  let W = 0; let H = 0;
  let mode = 'ready';                 // ready | play | over | won
  let y = 0; let vy = 0;
  let pipes = [];
  let score = 0;
  let elapsed = 0;
  let raf = 0; let lastT = 0;
  let shake = 0;
  let feathers = [];
  let stars = [];
  let endedAt = 0;
  let speed = 0; let gap = 0; let pipeW = 0; let spacing = 0; let g = 0; let flap = 0; let px = 0; let pr = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = r.width; H = r.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    speed = Math.max(140, W * 0.42);
    gap = H * 0.34;
    pipeW = Math.max(44, W * 0.13);
    spacing = Math.max(200, W * 0.6);
    g = H * 2.6;
    flap = -H * 0.78;
    px = W * 0.28;
    pr = Math.max(12, Math.min(W, H) * 0.045);
    stars = Array.from({ length: 50 }, (_, i) => ({ x: ((i * 89) % 100) / 100 * W, y: ((i * 37) % 100) / 100 * H, r: (i % 3) * 0.5 + 0.5 }));
    if (mode !== 'play') { y = H * 0.45; draw(); }
  }

  function start() {
    mode = 'play';
    y = H * 0.45; vy = flap * 0.6;
    pipes = []; score = 0; elapsed = 0; feathers = []; shake = 0;
    addPipe(W + pipeW);
    if (onScore) onScore(0);
    loop();
  }

  function addPipe(x) {
    const margin = H * 0.12;
    const top = margin + Math.random() * (H - gap - margin * 2);
    pipes.push({ x, top, passed: false, index: pipes.length ? pipes[pipes.length - 1].index + 1 : 1 });
  }

  function input() {
    if (mode === 'play') { vy = flap; return; }
    if (mode === 'over' && performance.now() - endedAt < 150) return; // ignore the flap that crashed
    start();                           // ready, over or won: the next tap starts a run immediately
  }

  function end(won) {
    mode = won ? 'won' : 'over';
    endedAt = performance.now();
    if (!won && !reducedMotion()) {
      shake = 0.3;
      feathers = Array.from({ length: 10 }, () => ({ x: px, y, vx: (Math.random() - 0.5) * 240, vy: -Math.random() * 260, life: 0.8 }));
    }
    if (onEnd) onEnd({ won, score });
    loop();
  }

  function nextFriend() { return FRIENDS.map((f) => ({ name: f.name, score: f.glide })).sort((a, b) => a.score - b.score).find((f) => f.score > score) || null; }

  function step(dt) {
    if (mode === 'play') {
      elapsed += dt;
      if (onTime) onTime(Math.max(0, Math.ceil(RUN_SECONDS - elapsed)));
      vy += g * dt; y += vy * dt;
      for (const p of pipes) p.x -= speed * dt;
      const last = pipes[pipes.length - 1];
      if (last && last.x < W - spacing) addPipe(last.x + spacing);
      pipes = pipes.filter((p) => p.x + pipeW > -10);
      for (const p of pipes) {
        if (!p.passed && p.x + pipeW < px - pr) { p.passed = true; score += 1; if (onScore) onScore(score); }
        const inX = px + pr * 0.8 > p.x && px - pr * 0.8 < p.x + pipeW;
        if (inX && (y - pr * 0.8 < p.top || y + pr * 0.8 > p.top + gap)) { end(false); return; }
      }
      if (y + pr > H || y - pr < 0) { end(false); return; }
      if (elapsed >= RUN_SECONDS) { end(true); return; }
    }
    shake = Math.max(0, shake - dt);
    for (const f of feathers) { f.vy += 600 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt; }
    feathers = feathers.filter((f) => f.life > 0);
  }

  function loop() {
    if (raf) return;
    lastT = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.033, (now - lastT) / 1000);
      lastT = now;
      step(dt);
      draw();
      raf = (mode === 'play' || shake > 0 || feathers.length) ? requestAnimationFrame(frame) : 0;
    };
    raf = requestAnimationFrame(frame);
  }

  function cup(x, yTop, w, h, flip) {
    // A stack of takeaway coffee cups: brown sleeve, white lid.
    const cupH = Math.max(28, w * 0.9);
    const count = Math.ceil(h / cupH);
    for (let i = 0; i < count; i++) {
      const cy = flip ? yTop + h - (i + 1) * cupH : yTop + i * cupH;
      ctx.fillStyle = '#F3E8DA';
      ctx.fillRect(x + w * 0.08, cy, w * 0.84, cupH);
      ctx.fillStyle = '#7C4A2D';
      ctx.fillRect(x + w * 0.08, cy + cupH * 0.35, w * 0.84, cupH * 0.32);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, flip ? cy + cupH - 5 : cy, w, 5);
    }
  }

  function drawPengu() {
    const tilt = Math.max(-0.5, Math.min(0.7, vy / (H * 1.6)));
    ctx.save();
    ctx.translate(px, y);
    ctx.rotate(tilt);
    ctx.fillStyle = '#2E3A5E';
    ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.15, pr, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.ellipse(pr * 0.25, pr * 0.15, pr * 0.7, pr * 0.62, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#26262E';
    ctx.beginPath(); ctx.arc(pr * 0.45, -pr * 0.3, pr * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath(); ctx.moveTo(pr * 0.95, -pr * 0.1); ctx.lineTo(pr * 1.45, pr * 0.05); ctx.lineTo(pr * 0.95, pr * 0.22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5846E5';                         // a little nightcap
    ctx.beginPath(); ctx.moveTo(-pr * 0.6, -pr * 0.7); ctx.lineTo(pr * 0.5, -pr * 0.85); ctx.lineTo(-pr * 1.3, -pr * 1.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7BD8A6';
    ctx.beginPath(); ctx.ellipse(-pr * 0.4, pr * 0.1, pr * 0.55, pr * 0.28, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function text(str, size, yy, weight = 600) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${weight} ${size}px "Public Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, W / 2, yy);
  }

  function draw() {
    if (!W) return;
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 8 * shake / 0.3, (Math.random() - 0.5) * 8 * shake / 0.3);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0F0C20'); sky.addColorStop(1, '#2A2360');
    ctx.fillStyle = sky; ctx.fillRect(-10, -10, W + 20, H + 20);
    for (const s of stars) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#FEF3C7'; ctx.beginPath(); ctx.arc(W * 0.85, H * 0.14, Math.min(W, H) * 0.06, 0, Math.PI * 2); ctx.fill();

    for (const p of pipes) {
      cup(p.x, 0, pipeW, p.top, true);
      cup(p.x, p.top + gap, pipeW, H - p.top - gap, false);
    }

    // Next friend to beat: a dashed line just past the obstacle that would tie their score.
    const friend = mode === 'play' ? nextFriend() : null;
    if (friend) {
      const target = pipes.find((p) => p.index === friend.score);
      if (target) {
        const lx = target.x + pipeW + 6;
        ctx.strokeStyle = '#FBBF24'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#FBBF24';
        ctx.font = '600 12px "Public Sans", system-ui, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`${friend.name} · ${friend.score}`, lx + 6, H * 0.06 + 18);
      }
    }

    for (const f of feathers) { ctx.globalAlpha = f.life; ctx.fillStyle = '#C4B5FD'; ctx.beginPath(); ctx.ellipse(f.x, f.y, 5, 2.5, f.x, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    drawPengu();

    if (mode !== 'play') {
      ctx.fillStyle = 'rgba(15,12,32,0.55)'; ctx.fillRect(0, 0, W, H);
      const big = Math.max(18, Math.min(30, W * 0.06));
      if (mode === 'ready') { text('Tap to start', big, H * 0.42); text('Tap or press Space to glide up', big * 0.55, H * 0.42 + big * 1.3, 400); }
      if (mode === 'over') { text(`${score} dodged`, big, H * 0.38); text('Tap to retry', big * 0.8, H * 0.38 + big * 1.4); }
      if (mode === 'won') { text('You made it through the night!', big * 0.9, H * 0.38); text(`${score} dodged · tap to play again`, big * 0.6, H * 0.38 + big * 1.4, 400); }
    }
    ctx.restore();
  }

  const onPointer = (e) => { e.preventDefault(); input(); };
  canvas.addEventListener('pointerdown', onPointer);
  const onKey = (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') { e.preventDefault(); input(); }
  };
  canvas.addEventListener('keydown', onKey);

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();

  return {
    input,
    stop() { if (mode === 'play') { mode = 'ready'; } cancelAnimationFrame(raf); raf = 0; draw(); },
    get mode() { return mode; },
    get score() { return score; },
  };
}
