// History: every week since the first plan, newest first ("Oct 26 – Nov 1"). Each week says how many
// planned workouts were done, the Fish it paid, its Comeback stamps, the free cover if one was used, and
// the extras collected: words and small tags only, no charts, no ranking, only this player's own weeks.
// At the top, the first postcard: a keepsake for the first week with every planned workout logged (its
// condition is shown until then), with an optional "Preview your postcard": the image (Pengu in their gear,
// beside their train, with a drawn prop) and the text, exactly as they would be shared, then Share, Copy
// text or Save image. Nothing is shared without a tap. Then "Bring a friend along": the invitation to plan
// their own week, any time (invite.js).
// "Your data" holds the local-data note with Save a backup (also the data export) and Restore from a
// backup directly under it, then Reset everything.

import * as S from './state.js';
import { saveBackup } from './backup.js';
import { h, icon, monthDay, plural, appFooter } from './ui.js';
import { toast, reducedMotion } from '../fx.js';
import { penguFigure, sceneFigure, propFigure } from './art.js';
import { bindPengu } from './motion.js';
import { inviteBody } from './invite.js';

let resetStep = 0;        // Reset everything: 0 closed, 1 "start over?", 2 "save a backup first?"
let resetSaved = false;   // a backup was saved from the second step
let restore = null;       // a checked backup waiting for the player's yes ({ text, summary }), or { error }
let refocus = '';
// Sharing the postcard: what the player picked (nothing is saved), and the last result to say.
// Dates, the workout count and the Pengyu link are all off until the player adds them.
let share = { open: false, caption: 0, prop: '', dates: false, workouts: false, link: false, status: '' };
// The invitation in History: open or not, and the picks (nothing is saved).
let friend = { open: false, days: false, time: false, place: false, status: '' };
let picture = { key: '', url: '', file: null, failed: false, job: null };   // the postcard image, made on this device
let cheered = false;      // Pengu cheers for the postcard once each time the app is opened
let bound = [];           // the postcard's Pengu, brought to life

// Mondays from the first planned (or logged) week up to this one, newest first. A week planned ahead
// (on Sunday) is not history yet.
function mondays() {
  const seen = new Set(Object.keys(S.state.plans));
  for (const d of Object.keys(S.state.log)) seen.add(S.weekStart(d));
  const first = [...seen].sort()[0];
  const out = [];
  if (!first) return out;
  for (let m = S.thisWeek(); m >= first; m = S.addDays(m, -7)) out.push(m);
  return out;
}

// What a week paid: 10 per planned workout, 15 per comeback, 25 for the full week. Extras pay nothing.
function weekFish(monday) {
  let fish = 0;
  for (const d of S.weekDays(monday)) {
    const log = S.state.log[d];
    if (!log) continue;
    if (log.kind === 'planned') fish += S.FISH.station;
    if (log.comeback) fish += S.FISH.comeback;
  }
  if (S.state.weekBonusPaid.includes(monday)) fish += S.FISH.weekBonus;
  return fish;
}

const range = (monday) => `${monthDay(S.parseKey(monday))} – ${monthDay(S.parseKey(S.addDays(monday, 6)))}`;
const tag = (cls, name, text) => h('li', { class: `py-tag${cls ? ` ${cls}` : ''}` }, name ? icon(name) : null, text);

function weekCard(monday, covered) {
  const current = monday === S.thisWeek();
  const days = S.weekDays(monday);
  const r = S.planFor(monday) ? S.route(monday) : null;
  const stamps = days.filter((d) => S.state.log[d] && S.state.log[d].comeback).length;
  const extras = S.state.extras.filter((x) => days.includes(x.earnedOn)).map((x) => S.extraById(x.id)).filter(Boolean);
  let line = 'No plan';
  if (r) line = `${r.done} of ${r.target}${current && !r.hit ? ' so far' : ''}`;
  const tags = [
    r && r.hit ? tag('is-hit', 'i-check', 'Week hit') : null,
    stamps ? tag('is-stamp', 'i-stamp', plural(stamps, 'Comeback stamp')) : null,
    covered ? tag('', 'i-shield', 'Free cover used') : null,
    ...extras.map((e) => tag('is-extra', '', e.name)),
  ].filter(Boolean);
  return h('li', { class: 'py-week' },
    h('div', { class: 'py-week-top' },
      h('h3', { class: 'py-week-title' }, range(monday), current ? h('span', { class: 'py-week-now' }, 'This week') : null),
      h('p', { class: 'py-week-fish' }, `+${weekFish(monday)} Fish`)),
    h('p', { class: 'py-week-line' }, line),
    tags.length ? h('ul', { class: 'py-week-tags', 'aria-label': 'That week' }, tags) : null);
}

// What a reset would delete, in a few words: "4 weeks of history, 120 Fish, 3 unlocks and 2 extras".
function losses() {
  const weeks = Object.keys(S.state.plans).length;
  const unlocks = Object.keys(S.state.owned).length;
  const parts = [
    weeks ? `${plural(weeks, 'week')} of history` : null,
    S.state.fish.balance ? `${S.state.fish.balance} Fish` : null,
    unlocks ? plural(unlocks, 'unlock') : null,
    S.state.extras.length ? plural(S.state.extras.length, 'extra') : null,
  ].filter(Boolean);
  if (!parts.length) return 'Nothing is saved yet, so nothing will be lost.';
  const said = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `This deletes ${said}.`;
}

// Restore: pick a file, see what it holds ("4 weeks, 230 Fish"), say yes, and only then replace.
async function readPicked(e, rerender) {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  await checkRestoreFile(f);
  rerender();
}
// A picked file, checked: the Restore question (or what is wrong with the file) waits in "Your data".
// The Home Screen tip uses this too, then opens Settings, where the same question asks first.
export async function checkRestoreFile(f) {
  let text = '';
  try { text = await f.text(); } catch { text = ''; }
  const checked = S.checkBackup(text);
  restore = checked.ok ? { text, summary: checked.summary } : { error: checked.error };
  resetStep = 0;
  resetSaved = false;
  refocus = checked.ok ? 'py-restore-yes' : 'py-restore';
  return true;
}

// "Last backup saved Nov 4." from the save's own record, or "No backup saved yet."
function lastBackupLine() {
  const at = S.lastBackupAt ? S.lastBackupAt() : '';
  if (!at) return 'No backup saved yet.';
  return `Last backup saved ${new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`;
}
function dataCard(rerender, onReset, onRestore) {
  const file = h('input', { class: 'sr-only', type: 'file', accept: 'application/json,.json', tabindex: '-1', 'aria-hidden': 'true', onchange: (e) => readPicked(e, rerender) });
  const closeReset = () => { resetStep = 0; resetSaved = false; refocus = 'py-reset'; rerender(); };
  // The local-data note first, with Save a backup and Restore from a backup directly under it.
  const card = h('section', { class: 'py-data', 'aria-labelledby': 'py-data-title' },
    h('h2', { class: 'py-section-title', id: 'py-data-title' }, 'Your data'),
    h('p', { class: 'py-handoff' }, 'Progress is saved in this browser. Another browser or Home Screen app may have a separate save.'),
    h('div', { class: 'py-data-actions py-handoff-actions' },
      h('button', {
        class: 'btn btn-secondary btn-sm', type: 'button', id: 'py-backup',
        onclick: () => {
          saveBackup();
          toast('Backup saved.', 'Keep the file somewhere safe.');
          const when = document.getElementById('py-backup-when');
          if (when) when.textContent = lastBackupLine();
        },
      }, 'Save a backup'),
      h('button', {
        class: 'btn btn-secondary btn-sm', type: 'button', id: 'py-restore',
        onclick: () => file.click(),
      }, 'Restore from a backup')),
    file,
    h('p', { class: 'small muted py-backup-when', id: 'py-backup-when' }, lastBackupLine()),
    h('p', { class: 'small muted' }, 'Save a backup downloads your data. Restore from a backup brings it into this browser.'),
    h('p', { class: 'py-data-privacy' }, h('a', { href: 'privacy.html' }, 'How Pengyu handles your data')),
    h('div', { class: 'py-data-actions' },
      h('button', {
        class: 'btn btn-ghost btn-sm', type: 'button', id: 'py-reset', 'aria-expanded': String(resetStep > 0),
        onclick: () => { if (resetStep) { closeReset(); return; } resetStep = 1; restore = null; refocus = 'py-reset-next'; rerender(); },
      }, 'Reset everything')));
  if (restore && restore.error) {
    card.append(h('p', { class: 'py-data-error', role: 'alert' }, icon('i-alert'), h('span', {}, restore.error)));
  } else if (restore) {
    const { weeks, fish } = restore.summary;
    card.append(h('div', { class: 'py-restore-confirm', role: 'group', 'aria-labelledby': 'py-restore-q' },
      h('p', { id: 'py-restore-q' }, h('strong', {}, `This backup has ${plural(weeks, 'week')}, ${fish} Fish.`), ' Restoring replaces what’s saved here now.'),
      h('div', { class: 'py-data-actions' },
        h('button', {
          class: 'btn btn-primary btn-sm', type: 'button', id: 'py-restore-yes',
          onclick: () => {
            const text = restore.text;
            restore = null;
            const res = S.importData(text);
            if (res.ok) onRestore(res.summary);
            else { restore = { error: res.error }; refocus = 'py-restore'; rerender(); }
          },
        }, 'Restore'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { restore = null; refocus = 'py-restore'; rerender(); } }, 'Cancel'))));
  }
  // Reset, step one: the intent. Step two: save a backup first, and exactly what will be lost.
  if (resetStep === 1) {
    card.append(h('div', { class: 'py-reset-confirm', role: 'group', 'aria-labelledby': 'py-reset-q' },
      h('p', { id: 'py-reset-q' }, h('strong', {}, 'Start Pengyu over?'), ' Your plan, weeks, Fish and gear leave this browser.'),
      h('div', { class: 'py-data-actions' },
        h('button', { class: 'btn btn-secondary btn-sm', type: 'button', id: 'py-reset-next', onclick: () => { resetStep = 2; refocus = 'py-reset-backup'; rerender(); } }, 'Continue'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: closeReset }, 'Keep my data'))));
  } else if (resetStep === 2) {
    card.append(h('div', { class: 'py-reset-confirm is-last', role: 'group', 'aria-labelledby': 'py-reset-q2' },
      h('p', { id: 'py-reset-q2' }, h('strong', {}, 'Save a backup first?'), ` ${losses()} It can’t be undone.`),
      h('div', { class: 'py-data-actions' },
        h('button', { class: 'btn btn-secondary btn-sm', type: 'button', id: 'py-reset-backup', onclick: () => { saveBackup(); resetSaved = true; refocus = 'py-reset-yes'; rerender(); } }, resetSaved ? 'Save another backup' : 'Save a backup'),
        h('button', { class: 'btn btn-danger btn-sm', type: 'button', id: 'py-reset-yes', onclick: () => { resetStep = 0; resetSaved = false; S.reset(); onReset(); } }, 'Reset everything'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: closeReset }, 'Keep my data')),
      resetSaved ? h('p', { class: 'py-reset-saved', role: 'status' }, icon('i-check'), 'Backup saved.') : null));
  }
  return card;
}

// ---------- The first postcard ----------
// A choice chip; after a re-render, focus comes back to the chip that was pressed.
function chip(key, label, pressed, onclick, { disabled = false, describedBy = null } = {}) {
  return h('button', {
    class: 'chip glass py-share-chip', type: 'button', id: `py-share-${key}`, 'aria-pressed': String(pressed), disabled, 'aria-describedby': describedBy,
    onclick: () => { refocus = `py-share-${key}`; onclick(); },
  }, label);
}

// ---------- The postcard image ----------
// Drawn on this device from the same choices as the text: the sunny card, the caption, Pengu as they look
// now beside their own train (its paint and upgrades), the drawn prop, and the dates or workout count only
// when added. Never a name, a place or the link.
const FONT = '"Rubik", system-ui, sans-serif';
const pictureKey = (card) => JSON.stringify([share.caption, share.prop, share.dates, share.workouts, S.look(), card.monday]);

function svgImage(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Pengu image'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  });
}
function wrapLines(ctx, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > width) { lines.push(line); line = word; } else line = test;
  }
  return line ? [...lines, line] : lines;
}
async function drawPostcard(card) {
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  try { if (document.fonts) await Promise.all([document.fonts.load(`700 84px ${FONT}`), document.fonts.load(`500 44px ${FONT}`)]); } catch { /* a system font, then */ }
  ctx.fillStyle = '#FFCE3A';
  ctx.fillRect(0, 0, size, size);
  // Two soft sunny bands at the foot of the card, the reward sheet's colors, for the train to ride on.
  ctx.fillStyle = '#FFE07A';
  ctx.beginPath(); ctx.moveTo(0, 820); ctx.bezierCurveTo(300, 760, 780, 760, size, 820); ctx.lineTo(size, size); ctx.lineTo(0, size); ctx.fill();
  ctx.fillStyle = '#FF9A52';
  ctx.beginPath(); ctx.moveTo(0, 960); ctx.bezierCurveTo(320, 920, 760, 924, size, 960); ctx.lineTo(size, size); ctx.lineTo(0, size); ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 24;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(36, 36, size - 72, size - 72, 56); else ctx.rect(36, 36, size - 72, size - 72);
  ctx.stroke();
  const prop = S.POSTCARD.props.find((x) => x.id === share.prop);
  // The words, top left: the caption, then the dates and the workout count only when added.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#2B2628';
  ctx.font = `700 84px ${FONT}`;
  let y = 200;
  for (const line of wrapLines(ctx, S.POSTCARD.captions[share.caption] || S.POSTCARD.captions[0], prop ? 700 : 870)) { ctx.fillText(line, 96, y); y += 100; }
  ctx.font = `500 44px ${FONT}`;
  if (share.dates) { ctx.fillText(range(card.monday), 96, y + 6); y += 62; }
  if (share.workouts) { ctx.fillText(`${card.done} of ${card.target} planned workouts`, 96, y + 6); y += 62; }
  // Pengu, in their gear and lamp base, beside their own train: as large as the space under the words allows.
  const look = S.look();
  const scene = sceneFigure(look);
  const [, , vw, vh] = scene.getAttribute('viewBox').split(' ').map(Number);
  const top = Math.max(y + 10, 470);
  const height = Math.min(470, 930 - top);
  const width = Math.min(880, height * (vw / vh));
  const sh = width * (vh / vw);
  scene.setAttribute('width', String(Math.round(width)));
  scene.setAttribute('height', String(Math.round(sh)));
  ctx.drawImage(await svgImage(scene), (size - width) / 2, 930 - sh, width, sh);
  if (prop) {
    const art = propFigure(prop.id);
    art.setAttribute('width', '210');
    art.setAttribute('height', '210');
    ctx.drawImage(await svgImage(art), size - 96 - 210, 84, 210, 210);
  }
  ctx.font = `800 52px ${FONT}`;
  ctx.fillStyle = '#C2391F';
  ctx.fillText('Pengyu', 96, size - 82);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No image');
  const url = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });
  return { file: new File([blob], 'pengyu-postcard.png', { type: 'image/png' }), url };
}
// One image per set of choices; a newer choice replaces an older drawing still in progress.
function postcardPicture(card) {
  const key = pictureKey(card);
  if (picture.key === key) return picture.job;
  const job = drawPostcard(card).then(
    (made) => { if (picture.key === key) Object.assign(picture, made); return picture; },
    () => { if (picture.key === key) picture.failed = true; return picture; });
  picture = { key, url: '', file: null, failed: false, job };
  return job;
}
// Whether this browser's share sheet takes an image file (checked with a tiny stand-in, nothing shared).
function sharesImages() {
  try {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [new File([new Uint8Array([137, 80, 78, 71])], 'pengyu-postcard.png', { type: 'image/png' })] });
  } catch { return false; }
}

// ---------- Sharing: only from a tap, and only what the preview shows ----------
async function shareNow(text, rerender, card) {
  const wanted = sharesImages() && !picture.failed;
  let data = { text };
  if (wanted) {
    const made = picture.file ? picture : await postcardPicture(card);
    if (made.file && navigator.canShare({ files: [made.file] })) data = { files: [made.file], text };
  }
  try {
    await navigator.share(data);
    share.status = data.files ? 'Shared the postcard.' : wanted ? 'Shared the text. The image couldn’t be added.' : 'Shared the text.';
  } catch (err) {
    share.status = err && err.name === 'AbortError' ? 'Not shared.' : 'Sharing didn’t work here. Try Copy text.';
  }
  refocus = 'py-share-status';
  rerender();
}
async function copyNow(text, rerender) {
  try {
    await navigator.clipboard.writeText(text);
    share.status = 'Copied the text. Paste it wherever you like.';
    refocus = 'py-share-status';
  } catch {
    share.status = 'Copying isn’t allowed here. Select the text above to copy it.';
    refocus = 'py-share-text';
  }
  rerender();
}

// Save image: the postcard file, to this device only, for posting by hand (a story, a chat).
function saveImage(rerender) {
  if (!picture.file) return;
  const url = URL.createObjectURL(picture.file);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pengyu-postcard.png';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  share.status = 'Saved the image to this device.';
  refocus = 'py-share-status';
  rerender();
}

// Preview your postcard: pick the words, see the image and the text exactly as they would go, then share,
// copy or save. The Pengyu link is off until the player adds it, and is offered only while this version is
// live at the owner's address; until then the chip waits and says so.
function sharePanel(rerender, card) {
  const set = (patch) => { Object.assign(share, patch, { status: '' }); rerender(); };
  const live = S.appLink();
  const text = S.postcardText({ ...share });
  const canShare = typeof navigator.share === 'function';
  const job = postcardPicture(card);
  const images = sharesImages();
  const prop = S.POSTCARD.props.find((p) => p.id === share.prop);
  const alt = `Postcard image: ${S.POSTCARD.captions[share.caption]}${prop ? ` With ${prop.name.toLowerCase()}.` : ''}${share.dates ? ' With the dates.' : ''}${share.workouts ? ' With the workout count.' : ''} Pengu beside the train on a sunny card.`;
  // What Share does, said plainly; if the image turns out not to be possible here, the words follow.
  const howText = (failed) => (failed ? (canShare ? 'Share sends the text above.' : 'This browser can’t open a share sheet. Copy the text instead.')
    : images ? 'Share sends this image and the text above.'
      : canShare ? 'This browser shares the text only. Save image keeps the picture.'
        : 'This browser can’t open a share sheet. Save the image or copy the text instead.');
  const goText = (failed) => (images && !failed ? 'Share postcard' : 'Share text');
  const NO_IMAGE = 'The image couldn’t be made in this browser. The text can still be shared.';
  const img = h('img', { class: 'py-share-img', alt, width: '1080', height: '1080', src: picture.url || null, hidden: !picture.url });
  const making = h('p', { class: 'py-share-making' }, picture.failed ? NO_IMAGE : 'Making the image…');
  if (picture.url) making.hidden = true;
  const how = h('p', { class: 'small muted py-share-how' }, howText(picture.failed));
  const goLabel = h('span', {}, goText(picture.failed));
  const save = picture.failed ? null : h('button', { class: 'btn btn-secondary btn-sm', type: 'button', id: 'py-share-save', disabled: !picture.file, onclick: () => saveImage(rerender) }, 'Save image');
  if (!picture.url && !picture.failed) {
    job.then((made) => {
      if (!img.isConnected) return;
      if (made.url) { img.src = made.url; img.hidden = false; making.hidden = true; if (save) save.disabled = false; return; }
      making.textContent = NO_IMAGE;
      how.textContent = howText(true);
      goLabel.textContent = goText(true);
      if (save) save.remove();
    });
  }
  // The text box grows to show every line it will share, wrapped or not.
  const box = h('textarea', { class: 'py-share-text', id: 'py-share-text', readonly: true, rows: String(text.split('\n').length) }, text);
  requestAnimationFrame(() => { if (box.isConnected) { box.style.height = 'auto'; box.style.height = `${box.scrollHeight + 2}px`; } });
  return h('div', { class: 'py-share', role: 'group', 'aria-labelledby': 'py-share-title' },
    h('h3', { class: 'py-share-h', id: 'py-share-title', tabindex: '-1' }, 'Preview your postcard'),
    h('p', { class: 'small muted' }, 'Pick a caption and a prop. Dates, the workout count and the link stay out unless you add them.'),
    h('div', { class: 'py-share-row', role: 'group', 'aria-label': 'Caption' },
      S.POSTCARD.captions.map((c, i) => chip(`cap${i}`, c, share.caption === i, () => set({ caption: i })))),
    h('div', { class: 'py-share-row', role: 'group', 'aria-label': 'Prop' },
      chip('prop-none', 'No prop', !share.prop, () => set({ prop: '' })),
      S.POSTCARD.props.map((p) => chip(`prop-${p.id}`, p.name, share.prop === p.id, () => set({ prop: p.id })))),
    h('div', { class: 'py-share-row', role: 'group', 'aria-label': 'Add details' },
      chip('dates', 'Add the dates', share.dates, () => set({ dates: !share.dates })),
      chip('workouts', 'Add the workout count', share.workouts, () => set({ workouts: !share.workouts })),
      chip('link', 'Include Pengyu link', Boolean(live && share.link), () => set({ link: !share.link }), { disabled: !live, describedBy: live ? null : 'py-share-linknote' })),
    live ? null : h('p', { class: 'small muted py-link-note', id: 'py-share-linknote' }, icon('i-clock'), h('span', {}, S.LIVE_NOTE)),
    h('p', { class: 'py-share-label' }, 'What will be shared'),
    h('figure', { class: 'py-share-figure' }, img, making),
    h('label', { class: 'py-share-label', for: 'py-share-text' }, 'Text'),
    box,
    how,
    h('div', { class: 'py-data-actions' },
      canShare ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', id: 'py-share-go', onclick: () => shareNow(text, rerender, card) }, icon('i-share'), goLabel) : null,
      h('button', { class: 'btn btn-secondary btn-sm', type: 'button', id: 'py-share-copy', onclick: () => copyNow(text, rerender) }, 'Copy text'),
      save,
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { share.open = false; share.status = ''; refocus = 'py-share-open'; rerender(); } }, 'Done')),
    h('p', { class: 'py-share-status', id: 'py-share-status', role: 'status', tabindex: '-1' }, share.status),
    h('p', { class: 'py-share-friend' }, h('button', {
      class: 'link', type: 'button', id: 'py-share-friend',
      onclick: () => { friend = { ...friend, open: true, status: '' }; refocus = 'py-friend-h'; rerender(); },
    }, 'Invite a friend to plan their own week')));
}

// Bring a friend along: the invitation, any time, without waiting for a full week.
function friendSection(rerender) {
  const plan = S.planFor(S.shownWeek());
  const close = () => { friend = { ...friend, open: false, status: '' }; refocus = 'py-friend-open'; rerender(); };
  return h('section', { class: 'py-friend', 'aria-labelledby': 'py-friend-title' },
    h('h2', { class: 'py-section-title', id: 'py-friend-title' }, 'Bring a friend along'),
    friend.open
      ? h('div', { class: 'py-share', role: 'group', 'aria-labelledby': 'py-friend-h' },
        h('h3', { class: 'py-share-h', id: 'py-friend-h', tabindex: '-1' }, 'Invite a friend to plan their own week'),
        ...inviteBody({ st: friend, plan, refill: (id) => { refocus = id; rerender(); }, done: close, ids: 'py-friend' }))
      : [h('p', { class: 'small muted' }, 'They plan their own week, with their own Pengu, saved on their own phone. You see every word first.'),
        h('div', { class: 'py-data-actions' },
          h('button', { class: 'btn btn-secondary btn-sm', type: 'button', id: 'py-friend-open', 'aria-expanded': 'false', onclick: () => { friend = { ...friend, open: true, status: '' }; refocus = 'py-friend-h'; rerender(); } }, icon('i-share'), 'Invite a friend'))]);
}

function postcardSection(rerender) {
  const card = S.firstFullWeek();
  if (!card) {
    // The exact condition, in advance. It pays no Fish: it is a keepsake.
    return h('section', { class: 'py-postcard is-locked', 'aria-labelledby': 'py-postcard-title' },
      h('span', { class: 'py-postcard-slot', 'aria-hidden': 'true' }, icon('i-stamp')),
      h('div', { class: 'py-postcard-text' },
        h('h2', { class: 'py-section-title', id: 'py-postcard-title' }, 'Your first postcard'),
        h('p', { class: 'small muted' }, 'Log every planned workout in one week, Monday to Sunday, to get it. It’s a keepsake, not Fish.')));
  }
  const prop = S.POSTCARD.props.find((p) => p.id === share.prop);
  const pengu = penguFigure(S.look(), { cls: 'py-postcard-pengu', pose: 'bust' });
  return h('section', { class: 'py-postcard', 'aria-labelledby': 'py-postcard-title' },
    h('h2', { class: 'py-section-title', id: 'py-postcard-title' }, 'Your first postcard'),
    h('div', { class: 'py-postcard-card' },
      h('div', { class: 'py-postcard-words' },
        h('p', { class: 'py-postcard-caption' }, S.POSTCARD.captions[share.caption]),
        h('p', { class: 'py-postcard-meta' }, `First full week · ${range(card.monday)}`),
        h('p', { class: 'py-postcard-meta' }, `${card.done} of ${card.target} planned workouts`)),
      h('div', { class: 'py-postcard-art', 'aria-hidden': 'true' }, pengu),
      prop ? propFigure(prop.id, 'py-postcard-prop') : null),
    share.open ? sharePanel(rerender, card) : h('div', { class: 'py-data-actions' },
      h('button', { class: 'btn btn-secondary btn-sm', type: 'button', id: 'py-share-open', 'aria-expanded': 'false', onclick: () => { share.open = true; refocus = 'py-share-title'; rerender(); } }, icon('i-share'), 'Preview your postcard')));
}

export function renderHistory(root, rerender, { onReset = () => {}, onRestore = () => {}, fresh = false, postcard = false } = {}) {
  for (const b of bound) if (b) b.stop();
  bound = [];
  if (fresh) { share = { ...share, open: false, status: '' }; friend = { ...friend, open: false, status: '' }; }
  // From the reward sheet's "Preview your postcard": the preview opens at once, with focus on it.
  const opening = postcard && Boolean(S.firstFullWeek());
  if (opening) share = { ...share, open: true, status: '' };
  const info = S.streakInfo();
  const weeks = mondays();
  const toFriend = refocus === 'py-friend-h';
  const view = h('div', { class: 'py-view' },
    h('h1', { class: 'py-view-title' }, 'History'),
    postcardSection(rerender),
    friendSection(rerender),
    h('section', { class: 'py-weeks-sec', 'aria-labelledby': 'py-weeks-title' },
      h('h2', { class: 'py-section-title', id: 'py-weeks-title' }, 'Your weeks'),
      weeks.length
        ? h('ol', { class: 'py-weeks' }, weeks.map((m) => weekCard(m, info.covered.includes(m))))
        : h('p', { class: 'muted' }, 'Your weeks show up here once you plan your first one.')));
  root.append(view);
  // Pengu cheers for the postcard, once each time the app is opened.
  const art = view.querySelector('.py-postcard-pengu');
  if (art) {
    const pengu = bindPengu(art, { follow: true, hop: true });
    bound.push(pengu);
    if (!cheered && pengu) { cheered = true; setTimeout(() => pengu.celebrate(), reducedMotion() ? 0 : 350); }
  }
  renderData(view, rerender, { onReset, onRestore, fresh });
  view.append(appFooter());
  if (opening) {
    view.querySelector('#py-share-title')?.focus({ preventScroll: true });
    view.querySelector('.py-share')?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
  // The invitation just opened (from its own button or the postcard): bring it into view.
  if (toFriend) view.querySelector('.py-friend')?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

// Both Settings and History use these same controls and confirmation steps. `fresh` means the tab was
// just opened: a reset or restore step left open elsewhere starts closed here.
export function renderData(root, rerender, { onReset = () => {}, onRestore = () => {}, fresh = false } = {}) {
  if (fresh) { resetStep = 0; resetSaved = false; restore = null; refocus = ''; }
  root.append(dataCard(rerender, onReset, onRestore));
  if (refocus) {
    const el = root.querySelector(`#${refocus}`);
    refocus = '';
    if (el) el.focus({ preventScroll: true });
    // A panel that just opened (restore, reset or a wrong file) comes fully into view, above the
    // floating tab bar, without pushing its own first line off the top.
    const panel = root.querySelector('.py-restore-confirm, .py-reset-confirm, .py-data-error');
    if (panel) {
      const r = panel.getBoundingClientRect();
      const bar = document.getElementById('py-nav');
      const limit = (bar ? bar.getBoundingClientRect().top : window.innerHeight) - 16;
      const by = Math.min(r.bottom - limit, r.top - 16);
      if (by > 0) window.scrollBy({ top: by, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }
}
