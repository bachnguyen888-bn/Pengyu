// Motion for Pengu and the train, built on anime.js 4.5.0 (npm "animejs", published 2026-06-22), vendored
// as js/vendor/anime.esm.min.js with its MIT license. Nothing else imports anime.js.
// Rules: only transform and opacity move; loops pause while the page is hidden or Pengu is offscreen;
// with reduced motion there is no waddle, hop, eye-follow, wave, wheel spin or steam (the blink stays).
// Random numbers here only pick animation timing (when Pengu blinks), never what anything looks like.

import { animate, createTimeline, spring, stagger, utils } from '../vendor/anime.esm.min.js';
import { sparkleSpots } from './art.js';

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => motionQuery.matches;
const settle = spring({ stiffness: 320, damping: 13 });

let pageHidden = document.hidden;
document.addEventListener('visibilitychange', () => { pageHidden = document.hidden; });

// Sparkles: 10 small marks in coral, sun and white burst out of Pengu, then fade.
function sparkle(svg) {
  const box = svg.getBoundingClientRect();
  if (!box.width) return;
  const layer = document.createElement('div');
  layer.className = 'py-sparkles';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.setProperty('left', `${box.left + box.width / 2}px`);
  layer.style.setProperty('top', `${box.top + box.height * 0.45}px`);
  const spots = sparkleSpots(10, Math.round(box.left + box.top));
  const marks = spots.map((s) => {
    const m = document.createElement('span');
    m.className = `py-spark is-${['coral', 'sun', 'white'][s.kind]}`;
    m.style.setProperty('--s', `${s.size}px`);
    layer.append(m);
    return m;
  });
  document.body.append(layer);
  animate(marks, {
    translateX: (el, i) => [0, Math.cos(spots[i].angle) * spots[i].dist],
    translateY: (el, i) => [0, Math.sin(spots[i].angle) * spots[i].dist - 12],
    scale: [0.2, 1, 0.5],
    opacity: [1, 1, 0],
    rotate: (el, i) => [0, (i % 2 ? 1 : -1) * 90],
    delay: stagger(26),
    duration: 820,
    ease: 'outCubic',
    onComplete: () => layer.remove(),
  });
}

// Bring a Pengu drawing to life. Options: follow (eyes follow the pointer), hop (tap to hop), waddle
// (idle waddle every 4–7s), wave (the cab Pengu waves every 6–9s). Returns { hop, celebrate, stop }.
export function bindPengu(svg, { follow = true, hop = true, waddle = false, wave = false } = {}) {
  const root = svg && svg.querySelector('.py-pengu');
  if (!root) return null;
  const eyes = [...svg.querySelectorAll('.py-eye')];
  const tail = svg.querySelector('.py-scarf-tail');
  const flipL = svg.querySelector('.py-flipper-l');
  const flipR = svg.querySelector('.py-flipper-r');
  const glow = svg.querySelector('.py-belly-glow');
  const timers = new Set();
  let onscreen = true;
  let alive = true;
  let busy = false;
  const active = () => alive && svg.isConnected && onscreen && !pageHidden;
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!svg.isConnected) { stop(); return; } fn(); }, ms); timers.add(t); };

  // Blink: eyes squeeze shut for about 140ms every 2.5 to 6s, now and then twice.
  const blink = () => animate(eyes, { scaleY: [1, 0.1, 1], duration: 140, ease: 'inOutQuad' });
  const blinkLoop = () => later(() => {
    if (active()) { blink(); if (Math.random() < 0.2) later(blink, 230); }
    blinkLoop();
  }, 2500 + Math.random() * 3500);

  // Scarf lag: the tail follows the body a beat late, overshoots, then settles after it.
  const lagScarf = (k = 1) => {
    if (!tail || reducedMotion()) return;
    animate(tail, { rotate: [0, 10 * k, -6 * k, 2 * k, 0], delay: 100, duration: 780, ease: 'outQuad' });
  };

  // Hop: squash, rise, fall, land squash, spring settle. Origin at the feet (pengu.css).
  const doHop = () => {
    if (busy || reducedMotion() || !svg.isConnected) return;
    busy = true;
    createTimeline({ onComplete: () => { busy = false; } })
      .add(root, { scaleX: 1.08, scaleY: 0.9, duration: 90, ease: 'outQuad' })
      .add(root, { translateY: -18, scaleX: 0.95, scaleY: 1.08, duration: 180, ease: 'outQuad' })
      .add(root, { translateY: 0, scaleX: 1, scaleY: 1, duration: 160, ease: 'inQuad' })
      .add(root, { scaleX: 1.04, scaleY: 0.92, duration: 80, ease: 'outQuad' })
      .add(root, { scaleX: 1, scaleY: 1, ease: settle });
    lagScarf(1);
  };

  // Celebrate: two hops, flippers up, scarf flutter, belly glow pulse, sparkles.
  const celebrate = () => {
    if (!svg.isConnected) return;
    if (reducedMotion()) { if (glow) animate(glow, { opacity: [0.85, 1], duration: 150 }); return; }
    busy = true;
    const tl = createTimeline({ onComplete: () => { busy = false; } });
    for (const at of [0, '+=40']) {
      tl.add(root, { scaleX: 1.06, scaleY: 0.92, duration: 80, ease: 'outQuad' }, at)
        .add(root, { translateY: -16, scaleX: 0.96, scaleY: 1.06, duration: 170, ease: 'outQuad' })
        .add(root, { translateY: 0, scaleX: 1, scaleY: 1, duration: 150, ease: 'inQuad' })
        .add(root, { scaleX: 1.03, scaleY: 0.94, duration: 70, ease: 'outQuad' })
        .add(root, { scaleX: 1, scaleY: 1, duration: 130, ease: 'outQuad' });
    }
    if (flipL) animate(flipL, { rotate: [0, 30, 30, 0], duration: 1150, ease: 'inOutQuad' });
    if (flipR) animate(flipR, { rotate: [0, -30, -30, 0], duration: 1150, ease: 'inOutQuad' });
    if (glow) animate(glow, { opacity: [0.85, 1, 0.9, 1], duration: 1150, ease: 'inOutSine' });
    lagScarf(1.3);
    later(() => lagScarf(1), 520);
    // At the top of the first hop, and clear of the frame where the count and Fish change.
    later(() => sparkle(svg), 200);
  };

  // Eyes follow the pointer, up to 1.6 units in Pengu's space, smoothed each frame. After a touch they
  // drift back to the middle once the finger has been still for 1.5s.
  const eye = { x: 0, y: 0, tx: 0, ty: 0 };
  let raf = 0;
  let idle = 0;
  const tick = () => {
    raf = 0;
    eye.x += (eye.tx - eye.x) * 0.18;
    eye.y += (eye.ty - eye.y) * 0.18;
    utils.set(eyes, { translateX: eye.x, translateY: eye.y });
    if (Math.abs(eye.tx - eye.x) > 0.01 || Math.abs(eye.ty - eye.y) > 0.01) raf = requestAnimationFrame(tick);
  };
  const look = (e) => {
    if (!active() || reducedMotion()) return;
    const r = root.getBoundingClientRect();   // Pengu itself, wherever it sits in the picture
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height * 0.4);
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / 140) * 1.6;
    eye.tx = (dx / len) * k;
    eye.ty = (dy / len) * k;
    clearTimeout(idle);
    if (e.pointerType !== 'mouse') idle = setTimeout(() => { eye.tx = 0; eye.ty = 0; if (!raf) raf = requestAnimationFrame(tick); }, 1500);
    if (!raf) raf = requestAnimationFrame(tick);
  };
  if (follow) { window.addEventListener('pointermove', look, { passive: true }); window.addEventListener('pointerdown', look, { passive: true }); }
  if (hop) svg.addEventListener('click', doHop);

  // Idle loops.
  const waddleLoop = () => later(() => {
    if (active() && !busy && !reducedMotion()) {
      animate(root, { rotate: [0, -4, 4, 0], translateX: [0, -6, 6, 0], duration: 1100, ease: 'inOutSine' });
      lagScarf(0.7);
    }
    waddleLoop();
  }, 4000 + Math.random() * 3000);
  const waveLoop = () => later(() => {
    if (active() && !busy && !reducedMotion() && flipR) animate(flipR, { rotate: [0, -26, 6, -26, 0], duration: 1300, ease: 'inOutSine' });
    waveLoop();
  }, 6000 + Math.random() * 3000);

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => { onscreen = e.isIntersecting; }) : null;
  if (io) io.observe(svg);

  function stop() {
    if (!alive) return;
    alive = false;
    for (const t of timers) clearTimeout(t);
    timers.clear();
    clearTimeout(idle);
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', look);
    window.removeEventListener('pointerdown', look);
    svg.removeEventListener('click', doHop);
    if (io) io.disconnect();
  }

  blinkLoop();
  if (waddle) waddleLoop();
  if (wave) waveLoop();
  return { hop: doHop, celebrate, lagScarf, stop };
}

// The train rolls into its new station. It is already drawn at the new spot, `fromX` pixels back (from
// where it last stood); it slides in (transform only) with a small overshoot, its red spokes turning with
// the distance, three puffs of steam rising and Pengu swaying. `onArrive` runs as the front reaches the
// station. With reduced motion it is simply there.
export function rollTrain(train, fromX, { wheelPx = 7, onArrive = () => {} } = {}) {
  if (!fromX || reducedMotion()) { onArrive(); return; }
  const dir = fromX < 0 ? 1 : -1;
  const travel = Math.abs(fromX) + 3.5;
  const turn = (travel / (2 * Math.PI * wheelPx)) * 360 * dir;
  animate(train, { translateX: [{ from: fromX, to: 3.5 * dir, duration: 1250, ease: 'inOutSine' }, { to: 0, duration: 230, ease: 'outQuad' }] });
  animate(train.querySelectorAll('.py-spokes'), { rotate: [0, turn], duration: 1480, ease: 'inOutSine' });
  animate(train.querySelectorAll('.py-puff'), { translateX: [0, -12], translateY: [0, -16], scale: [0.7, 1.6], opacity: [0.9, 0], delay: stagger(260), duration: 900, ease: 'outQuad' });
  const rider = train.querySelector('.py-rider');
  if (rider) animate(rider, { rotate: [0, -3, 2.5, -1.5, 0], duration: 1450, ease: 'inOutSine' });
  setTimeout(onArrive, 1250);
}

// A station ring fills as the train arrives: the coral disc fades in and the check draws in over 300ms.
export function fillStation(station) {
  const disc = station.querySelector('.py-ring-fill');
  const tick = station.querySelector('.py-ring-check');
  if (!disc || !tick) return;
  if (reducedMotion()) { utils.set([disc, tick], { opacity: 1 }); tick.style.setProperty('stroke-dashoffset', '0'); return; }
  const len = 40;   // longer than the check, so the dash covers it whole without measuring
  tick.style.setProperty('stroke-dasharray', String(len));
  animate(disc, { opacity: [0, 1], scale: [0.6, 1], duration: 220, ease: 'outBack(1.6)' });
  animate(tick, { opacity: [1, 1], strokeDashoffset: [len, 0], duration: 300, delay: 90, ease: 'outQuad' });
}

// The unlock moment: the new piece drops onto Pengu with a little bounce; the headlamp lights up and the
// extra car rolls in behind. (Pengu's hop and sparkles come from bindPengu's celebrate.) With reduced
// motion the piece simply fades in.
const UNLOCK_PARTS = { scarf: '.py-scarf', cap: '.py-hat', backpack: '.py-backpack, .py-straps', conductor: '.py-outfit, .py-hat', headlamp: '.py-lamp', car: '.py-car' };
export function showUnlock(svg, id) {
  const sel = UNLOCK_PARTS[id];
  const parts = svg && sel ? [...svg.querySelectorAll(sel)] : [];
  if (!parts.length) return;
  if (reducedMotion()) { animate(parts, { opacity: [0, 1], duration: 150 }); return; }
  if (id === 'car') animate(parts, { translateX: [-60, 0], opacity: [0, 1], duration: 700, ease: 'outBack(1.2)' });
  else if (id === 'headlamp') animate(parts, { opacity: [0, 1], scale: [0.6, 1], duration: 600, ease: 'outQuad' });
  else animate(parts, { translateY: [-42, 0], opacity: [0, 1], duration: 620, ease: 'outBounce' });
}

// A gentle press: squash in 120ms, spring back out.
export function press(el) {
  if (!el || reducedMotion()) return;
  createTimeline().add(el, { scale: 0.97, duration: 120, ease: 'outQuad' }).add(el, { scale: 1, ease: settle });
}

// Sheets slide up from the bottom edge (or fade, with reduced motion).
export function sheetIn(panel) {
  if (reducedMotion()) { animate(panel, { opacity: [0, 1], duration: 150 }); return; }
  animate(panel, { translateY: ['100%', '0%'], duration: 420, ease: 'outQuint' });
}
export function sheetOut(panel, done) {
  if (reducedMotion()) { animate(panel, { opacity: [1, 0], duration: 150, onComplete: done }); return; }
  animate(panel, { translateY: ['0%', '100%'], duration: 260, ease: 'inQuad', onComplete: done });
}
export function rise(face) {
  if (!face || reducedMotion()) return;
  animate(face, { translateY: ['40%', '0%'], duration: 900, delay: 120, ease: 'outBack(1.2)' });
}
