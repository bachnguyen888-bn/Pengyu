// Early-access form. The site has no server, so the form writes an email for the visitor to send.
// Fields validate as people type (after their first visit to a field). A draft is kept in this
// tab's sessionStorage, so a reload or a slip doesn't lose it, and it clears when the tab closes.

import * as store from './store.js';
import { progressLine } from './dashboard.js';
import { toast, burst, setOrigin, react } from './fx.js';

const DRAFT = 'pengu.ea-draft';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function initForm() {
  const form = document.getElementById('ea-form');
  const done = document.getElementById('ea-done');
  if (!form || !done) return;
  const to = form.dataset.to;
  const errors = document.getElementById('ea-errors');
  const errorsText = document.getElementById('ea-errors-text');
  const message = document.getElementById('ea-message');
  const send = document.getElementById('ea-send');
  const status = document.getElementById('ea-copy-status');
  const nomail = document.getElementById('ea-nomail');
  const touched = new Set();

  const rules = {
    name: (v) => (!v ? 'Add your name so we know who to invite.' : v.length < 2 ? 'That looks short. Add your full first name.' : ''),
    email: (v) => (!v ? 'Add your email so we can send your invite.' : !EMAIL.test(v) ? 'Check the email: it needs a name, an @ and a domain, like sam@example.com.' : ''),
    notes: (v) => (/\b(diagnos|prescri|medication|my condition|blood pressure)\w*/i.test(v) ? 'Looks like this may include personal health details. Please leave those out.' : ''),
  };

  function fieldOf(name) { return form.querySelector(`[data-field="${name}"]`); }
  function check(name, show = touched.has(name)) {
    const input = form.elements[name];
    const value = String(input.value || '').trim();
    const msg = rules[name] ? rules[name](value) : '';
    const field = fieldOf(name);
    const out = document.getElementById(`ea-${name}-msg`);
    const valid = !msg && value.length > 0;
    if (show) {
      field.classList.toggle('is-invalid', Boolean(msg));
      field.classList.toggle('is-valid', valid);
      input.setAttribute('aria-invalid', String(Boolean(msg)));
      if (out) out.textContent = msg || (valid && (name === 'name' || name === 'email') ? 'Looks good.' : '');
    }
    if (name === 'move') field.classList.toggle('is-valid', value.length > 0);
    return msg;
  }

  // Draft
  function saveDraft() {
    try {
      const data = Object.fromEntries(['name', 'email', 'move', 'game', 'notes'].map((k) => [k, form.elements[k].value]));
      sessionStorage.setItem(DRAFT, JSON.stringify(data));
    } catch { /* storage blocked: the form still works, the draft just isn't kept */ }
  }
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT) || 'null');
    if (draft) for (const [k, v] of Object.entries(draft)) if (form.elements[k] && v) form.elements[k].value = v;
  } catch { /* nothing saved */ }

  for (const name of ['name', 'email', 'move', 'notes']) {
    const input = form.elements[name];
    input.addEventListener('blur', () => { if (input.value.trim()) touched.add(name); check(name); });
    input.addEventListener('input', () => { check(name); saveDraft(); if (!errors.hidden) summarize(); });
  }
  form.elements.game.addEventListener('change', saveDraft);
  // Pengu's vault knows how this visitor likes to move; offer it when they reach the form.
  const prefillMove = () => {
    const move = form.elements.move;
    if (!move.value && store.state.vault.moves.length) { move.value = store.state.vault.moves.join(', '); check('move'); saveDraft(); }
  };
  prefillMove();
  form.addEventListener('focusin', prefillMove);

  function summarize() {
    check('notes', true);                 // a gentle warning only; it never blocks the email
    const bad = ['name', 'email'].filter((n) => check(n, true));
    errors.hidden = bad.length === 0;
    if (bad.length) errorsText.textContent = bad.length === 1 ? `One field needs a fix: ${label(bad[0])}. Your other answers are kept.` : `${bad.length} fields need a fix: ${bad.map(label).join(' and ')}. Your other answers are kept.`;
    return bad;
  }
  function label(n) { return { name: 'your name', email: 'your email' }[n]; }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    for (const n of ['name', 'email']) touched.add(n);
    const bad = summarize();
    if (bad.length) { form.elements[bad[0]].focus(); return; }
    const f = (n) => String(form.elements[n].value || '').trim();
    const subject = `Early access: ${f('name')}`;
    const lines = ['Hi ClearHealth team,', '', 'I’d like early access to Pengu.', '', `Name: ${f('name')}`, `Email: ${f('email')}`];
    if (f('move')) lines.push(`Likes to move: ${f('move')}`);
    if (f('game')) lines.push(`Most excited for: ${f('game')}`);
    const progress = progressLine();
    if (progress) lines.push(`My preview progress: ${progress}`);
    if (f('notes')) lines.push('', f('notes'));
    const body = lines.join('\n');
    message.value = `To: ${to}\nSubject: ${subject}\n\n${body}`;
    send.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, '\r\n'))}`;
    status.textContent = '';
    nomail.hidden = true;
    form.hidden = true;
    done.hidden = false;
    done.focus();
    setOrigin(done.querySelector('.done-check'));
    burst();
    react('celebrate');
    toast('Your email is ready', 'Nothing is sent until you send it yourself.', 'celebrate');
  });

  // If the email app doesn't take over within a couple of seconds, offer the copy route.
  send.addEventListener('click', () => {
    let left = false;
    const onHide = () => { left = true; };
    window.addEventListener('blur', onHide, { once: true });
    document.addEventListener('visibilitychange', onHide, { once: true });
    setTimeout(() => { if (!left) nomail.hidden = false; }, 2000);
  });

  async function copy() {
    message.select();
    try {
      await navigator.clipboard.writeText(message.value);
      status.textContent = 'Copied. Paste it into a new email.';
    } catch {
      status.textContent = 'Selected. Press Ctrl+C (or ⌘C on a Mac) to copy it.';
    }
  }
  document.getElementById('ea-copy').addEventListener('click', copy);
  document.getElementById('ea-copy-2').addEventListener('click', copy);
  document.getElementById('ea-edit').addEventListener('click', () => {
    done.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });
}
