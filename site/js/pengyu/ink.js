// Hand-drawn ink: lines and rings with small, deliberate wobbles. Seeded, never Math.random, so every
// visit and every screenshot draws exactly the same pencil marks.

// mulberry32: a tiny seeded generator. Same seed, same sequence.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => Math.round(n * 100) / 100;

// A gently wobbling line from (x1, y) to (x2, y), as one smooth path.
export function wobblyLine(x1, x2, y, { seed = 1, amp = 0.7, step = 40 } = {}) {
  const r = rng(seed);
  const n = Math.max(2, Math.round((x2 - x1) / step));
  const pts = Array.from({ length: n + 1 }, (_, i) => [x1 + ((x2 - x1) * i) / n, y + (i === 0 || i === n ? 0 : (r() * 2 - 1) * amp)]);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [x, yy] = pts[i];
    d += `Q${f(px + (x - px) / 2)} ${f(py + (r() * 2 - 1) * amp * 0.6)} ${f(x)} ${f(yy)}`;
  }
  return d;
}

// A closed, slightly uneven loop around (cx, cy): a station ring with a pencil feel.
export function ring(cx, cy, radius, { seed = 1, amp = 0.6, points = 9 } = {}) {
  const r = rng(seed);
  const start = r() * Math.PI * 2;
  const pts = Array.from({ length: points }, (_, i) => {
    const a = start + (i / points) * Math.PI * 2;
    const rr = radius + (r() * 2 - 1) * amp;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  // Catmull-Rom through the points, closed, as cubic Béziers.
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % points];
    const p3 = pts[(i + 2) % points];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

// A rounded rectangle whose edges bow a little and whose corners differ slightly.
export function softRect(x, y, w, h, radius, { seed = 1, amp = 0.6 } = {}) {
  const r = rng(seed);
  const j = () => (r() * 2 - 1) * amp;
  const rr = () => Math.max(0, radius + j());
  const [a, b, c, d] = [rr(), rr(), rr(), rr()];
  return `M${f(x + a)} ${f(y + j())}`
    + `Q${f(x + w / 2)} ${f(y + j())} ${f(x + w - b)} ${f(y + j())}`
    + `Q${f(x + w)} ${f(y)} ${f(x + w + j())} ${f(y + b)}`
    + `Q${f(x + w + j())} ${f(y + h / 2)} ${f(x + w + j())} ${f(y + h - c)}`
    + `Q${f(x + w)} ${f(y + h)} ${f(x + w - c)} ${f(y + h + j())}`
    + `Q${f(x + w / 2)} ${f(y + h + j())} ${f(x + d)} ${f(y + h + j())}`
    + `Q${f(x)} ${f(y + h)} ${f(x + j())} ${f(y + h - d)}`
    + `Q${f(x + j())} ${f(y + h / 2)} ${f(x + j())} ${f(y + a)}`
    + `Q${f(x)} ${f(y)} ${f(x + a)} ${f(y + j())}Z`;
}

// A check mark with a little wobble, drawn as one stroke (so it can "draw in").
export function check(cx, cy, size, { seed = 1 } = {}) {
  const r = rng(seed);
  const j = () => (r() * 2 - 1) * size * 0.04;
  return `M${f(cx - size * 0.42 + j())} ${f(cy + size * 0.02 + j())}L${f(cx - size * 0.12 + j())} ${f(cy + size * 0.32 + j())}L${f(cx + size * 0.44 + j())} ${f(cy - size * 0.34 + j())}`;
}
