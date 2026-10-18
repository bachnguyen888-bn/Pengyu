// Receipt Flip cards: the claim or lesson on the front, the study on the back.
// The hidden face is inert, so keyboards and screen readers only meet the visible one.

import { RECEIPTS } from './content.js';
import { el } from './fx.js';

function face(cls) { return el('div', { class: `receipt-face ${cls}` }); }

export function renderReceipt(container, key, { onFlip, compact = false } = {}) {
  const r = RECEIPTS[key];
  if (!container || !r) return null;
  container.textContent = '';
  container.classList.add('receipt');
  container.classList.remove('is-flipped');
  const inner = el('div', { class: 'receipt-inner' });

  const front = face('receipt-front');
  front.append(el('p', { class: 'eyebrow' }, r.kind === 'claim' ? 'Facts or Cap' : '1-minute lesson'));
  front.append(el('p', { class: 'claim-text' }, r.title));
  if (r.kind === 'claim') {
    const line = el('p');
    line.append(el('span', { class: `pill pill-${r.verdict === 'cap' ? 'cap' : 'live'}` }, r.verdict === 'cap' ? 'Cap' : 'Facts'), document.createTextNode(` ${r.line}`));
    front.append(line);
  } else {
    const ul = el('ul', { class: 'bullets' });
    for (const b of r.bullets) ul.append(el('li', {}, b));
    if (!compact) front.append(ul);
    else front.append(el('p', {}, r.bullets[0]));
  }
  const flip = el('button', { class: 'btn btn-secondary btn-sm receipt-flip', type: 'button' }, 'Flip for the receipt');
  front.append(flip);

  const back = face('receipt-back');
  const heading = el('p', { class: 'eyebrow', tabindex: '-1' }, 'The receipt');
  back.append(heading);
  const dl = el('dl');
  const row = (label, value) => {
    const div = el('div');
    const dd = el('dd');
    if (value instanceof Node) dd.append(value); else dd.textContent = value;
    div.append(el('dt', {}, label), dd);
    dl.append(div);
  };
  const link = el('a', { href: r.source.href }, r.source.host);
  const src = document.createDocumentFragment();
  src.append(document.createTextNode(`${r.source.text} `), link);
  row('Source', src);
  row('Study type', r.type);
  row('Sample', r.sample);
  row('Takeaway', r.takeaway);
  back.append(dl);
  back.append(el('p', { class: 'receipt-note' }, 'For education only. Not medical advice.'));
  const flipBack = el('button', { class: 'btn btn-ghost btn-sm receipt-flip', type: 'button' }, 'Flip back');
  back.append(flipBack);

  inner.append(front, back);
  container.append(inner);

  const set = (flipped) => {
    container.classList.toggle('is-flipped', flipped);
    front.inert = flipped;
    back.inert = !flipped;
    front.setAttribute('aria-hidden', String(flipped));
    back.setAttribute('aria-hidden', String(!flipped));
    (flipped ? heading : flip).focus({ preventScroll: true });
  };
  back.inert = true;
  back.setAttribute('aria-hidden', 'true');
  flip.addEventListener('click', () => { set(true); if (onFlip) onFlip(); });
  flipBack.addEventListener('click', () => set(false));
  return { flip: () => set(true) };
}

// Finds a reviewed receipt for a pasted claim by keyword. Returns null when there isn't one.
export function matchReceipt(text) {
  const t = ` ${text.toLowerCase()} `;
  let best = null;
  let bestHits = 0;
  for (const [key, r] of Object.entries(RECEIPTS)) {
    const hits = r.keywords.filter((k) => t.includes(k)).length;
    if (hits > bestHits) { best = key; bestHits = hits; }
  }
  return best;
}
