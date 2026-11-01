// Small DOM helpers for the week planner. Pages keep no inline script or style (see _headers),
// so everything is built here and positioned with CSS custom properties.

const SVG = 'http://www.w3.org/2000/svg';

// h('p', { class: 'x', onclick: fn }, 'text', node, …)
export function h(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) node.append(kid);
  return node;
}

export function icon(name, cls = 'icon') {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG, 'use');
  use.setAttribute('href', `#${name}`);
  svg.append(use);
  return svg;
}

export const weekday = (d, style = 'long') => d.toLocaleDateString('en-US', { weekday: style });
export const monthDay = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export function clock(hhmm) {
  const [hr, m] = hhmm.split(':').map(Number);
  const d = new Date(2000, 0, 1, hr, m);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Hands a file to the browser to save (a backup, a calendar file). Nothing leaves the device.
export function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
