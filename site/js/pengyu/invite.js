// Bring a friend along: the invitation to plan their own week, shown word for word before anything is
// shared. The same few words for everyone (state.js INVITE), then the Pengyu link, added automatically while
// this version is live at the owner's address. Until then no link is offered and the note says so. The player's days, time
// and place join only when switched on. Nothing is sent without a tap on Share or Copy invite, and nothing
// is counted, claimed or rewarded either way. Today's sheet (after a first plan), History and the postcard
// all use this one body.

import * as S from './state.js';
import { h, icon } from './ui.js';

// Check the complete payload the preview will send. A file alone being supported does not guarantee
// the browser accepts that file together with text. This check never opens a share sheet.
export function postcardPayload(text, file, api = navigator) {
  if (file && typeof api.canShare === 'function') {
    const data = { files: [file], text };
    try { if (api.canShare(data)) return data; } catch { /* the text-only fallback is shown first */ }
  }
  return { text };
}

// Called only from an explicit Share tap, with the already-previewed payload. No asynchronous work
// precedes the browser call, so a prepared image keeps the tap's transient activation.
export async function sharePreview(data, api = navigator) {
  if (typeof api.share !== 'function') return 'unsupported';
  try { await api.share(data); return 'shared'; }
  catch (err) { return err && err.name === 'AbortError' ? 'cancelled' : 'failed'; }
}

// `st` holds the picks and the last result ({ days, time, place, status }) and belongs to the caller;
// `refill(focusId)` redraws the body with focus on that control; `done()` closes it.
export function inviteBody({ st, plan, refill, done, ids = 'py-invite' }) {
  const text = S.inviteText(st, plan);
  const say = (msg, id = `${ids}-status`) => { st.status = msg; refill(id); };
  const toggle = (key, label) => h('button', {
    class: 'chip glass py-share-chip', type: 'button', id: `${ids}-${key}`, 'aria-pressed': String(Boolean(st[key])),
    onclick: () => { st[key] = !st[key]; st.status = ''; refill(`${ids}-${key}`); },
  }, label);
  // The box grows to show every line it will share, wrapped or not.
  const box = h('textarea', { class: 'py-share-text', id: `${ids}-text`, readonly: true, rows: String(text.split('\n').length) }, text);
  requestAnimationFrame(() => { if (box.isConnected) { box.style.height = 'auto'; box.style.height = `${box.scrollHeight + 2}px`; } });
  return [
    h('p', { class: 'py-sheet-note' }, 'Optional. Nothing is sent until you tap Share or Copy invite.'),
    plan ? h('div', { class: 'py-share-row', role: 'group', 'aria-label': 'Add your plan details' },
      toggle('days', 'Add my days'), toggle('time', 'Add my time'), toggle('place', 'Add my place')) : null,
    h('label', { class: 'py-share-label', for: `${ids}-text` }, 'What will be shared'),
    box,
    S.linkPending() ? h('p', { class: 'py-sheet-note py-link-note', id: `${ids}-link-note` }, icon('i-clock'), h('span', {}, S.LIVE_NOTE)) : null,
    h('div', { class: 'py-data-actions' },
      typeof navigator.share === 'function' ? h('button', {
        class: 'btn btn-primary btn-sm', type: 'button', id: `${ids}-share`,
        onclick: async () => {
          const result = await sharePreview({ text });
          say(result === 'shared' ? 'Shared.' : result === 'cancelled' ? 'Not shared.' : 'Sharing didn’t work here. Try Copy invite.');
        },
      }, icon('i-share'), 'Share invitation') : null,
      h('button', {
        class: 'btn btn-secondary btn-sm', type: 'button', id: `${ids}-copy`,
        onclick: async () => {
          try { await navigator.clipboard.writeText(text); say('Copied. Paste it wherever you like.'); } catch { say('Copying isn’t allowed here. Select the text above to copy it.', `${ids}-text`); }
        },
      }, 'Copy invite'),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', id: `${ids}-later`, onclick: () => done() }, 'Not now')),
    h('p', { class: 'py-share-status', id: `${ids}-status`, role: 'status', tabindex: '-1' }, st.status),
  ].filter(Boolean);
}
