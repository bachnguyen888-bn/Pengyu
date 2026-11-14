// The Pengu tab: Pengu glowing in the warm brown lamp base with the train behind, the next unlock, gear
// in a fixed order, train upgrades in any order, and looks-only extras. Every price is fixed and shown,
// unlocking takes a second tap, nothing is random, and what you unlock is yours for good. Wear toggles
// change only what shows. Anything not owned yet can be previewed on the showcase first: a preview is
// labelled as one and never unlocks or spends anything. Distances are written in words: no bars, no rings.

import * as S from './state.js';
import { penguFigure, trainFigure, sceneFigure, glyph, PAINT_COLORS } from './art.js';
import { bindPengu, showUnlock, reducedMotion } from './motion.js';
import { h, icon, appFooter } from './ui.js';
import { countTo, toast } from '../fx.js';
import { saveBackup } from './backup.js';

let confirming = '';   // the Unlock waiting for its second tap, as "where-id" ("next-cap", "row-headlamp")
let refocus = '';      // the control that takes focus after a re-render
let unlocked = null;   // the unlock that just happened: { id, fish } (Fish before), for its moment
let bound = [];        // the showcase Pengu, brought to life
let previewing = '';   // an unlock shown on the showcase before it is owned (looks only, nothing saved)
let previewFrom = '';  // the Preview button that started it, where Stop preview returns focus
let keep = null;       // after an unlock with no backup saved yet: { ask, id }, then { saved } (until the tab is left)
let primary = '';      // the one coral control on this tab right now (its id), worked out on each draw

// One primary action per screen: the Unlock waiting for its second tap, else the first Unlock on the page
// that is ready (the next-unlock card, then the rows). Every other Unlock is an outline button.
function primaryUnlock() {
  const cid = confirming.slice(confirming.indexOf('-') + 1);
  if (confirming && S.unlockStatus(cid)?.state === 'ready') return `yes-${confirming}`;
  const next = S.nextGear() || S.TRAIN.find((t) => !S.owns(t.id));
  if (next && S.unlockStatus(next.id).state === 'ready') return `unlock-next-${next.id}`;
  const row = [...S.GEAR, ...S.TRAIN].find((u) => S.unlockStatus(u.id).state === 'ready');
  return row ? `unlock-row-${row.id}` : '';
}

const night = () => { const hr = S.now().getHours(); return hr >= 19 || hr < 6; };
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const the = (item) => (item.id === 'paint' ? 'colors' : `the ${lower(item.name)}`);
function list(words) {
  if (words.length < 2) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

// What the showcase shows, in words, for screen readers (short sentences, like everything on screen).
function caption(look) {
  const hat = look.hat === 'cap' ? 'the cap' : look.hat && look.hat !== 'conductor' ? `the ${lower(S.extraById(look.hat).name)}` : null;
  const worn = [look.outfit ? 'the conductor outfit' : null, hat, look.scarf ? 'the scarf' : null, look.backpack ? 'the backpack' : null].filter(Boolean);
  const paint = S.PAINTS.find((p) => p.id === look.paint) || S.PAINTS[0];
  const extras = [look.headlamp ? 'the headlamp' : null, look.car ? 'the extra car' : null, look.decal ? `the ${lower(S.extraById(look.decal).name)}` : null].filter(Boolean);
  return [
    'Pengu glows in its lamp base.',
    worn.length ? `Pengu wears ${list(worn)}.` : 'Pengu has no gear yet.',
    `The train is ${lower(paint.name)}.`,
    extras.length ? `It has ${list(extras)}.` : '',
  ].filter(Boolean).join(' ');
}

// Preview: the showcase wears it, labelled as a preview; a second tap (or Stop preview) takes it off.
function previewButton(item, rerender, where = 'row') {
  const on = previewing === item.id;
  const id = where === 'next' ? `preview-next-${item.id}` : `preview-${item.id}`;
  return h('button', {
    class: 'btn btn-ghost btn-sm py-preview-btn', type: 'button', id, 'aria-pressed': String(on),
    onclick: () => {
      previewing = on ? '' : item.id;
      previewFrom = id;
      refocus = on ? id : 'py-preview-stop';
      rerender();
      if (!on) document.querySelector('.py-show')?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
    },
  }, on ? 'Previewing' : 'Preview', h('span', { class: 'sr-only' }, ` ${the(item)}`));
}

// ---------- Unlocking: a tap, then "Unlock the cap for 90 Fish?" and a second tap ----------
function unlockButton(item, where, rerender) {
  const key = `${where}-${item.id}`;
  return h('button', {
    class: `btn ${primary === `unlock-${key}` ? 'glass-coral' : 'btn-secondary'} btn-sm py-unlock`, type: 'button', id: `unlock-${key}`, 'aria-expanded': String(confirming === key),
    onclick: () => { confirming = confirming === key ? '' : key; refocus = confirming ? `yes-${key}` : `unlock-${key}`; rerender(); },
  }, 'Unlock', h('span', { class: 'sr-only' }, ` ${the(item)}`));
}
function confirmPanel(item, where, rerender) {
  const key = `${where}-${item.id}`;
  if (confirming !== key || S.unlockStatus(item.id).state !== 'ready') return null;
  return h('div', { class: 'py-confirm', role: 'group', 'aria-labelledby': `q-${key}` },
    h('p', { class: 'py-confirm-q', id: `q-${key}` }, `Unlock ${the(item)} for ${item.price} Fish?`),
    h('div', { class: 'py-confirm-actions' },
      h('button', { class: 'btn glass-coral btn-sm', type: 'button', id: `yes-${key}`, onclick: () => unlockNow(item, where) }, 'Unlock'),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { confirming = ''; refocus = `unlock-${key}`; rerender(); } }, 'Not now')));
}
function unlockNow(item, where) {
  confirming = '';
  if (previewing === item.id) previewing = '';
  unlocked = { id: item.id, fish: S.state.fish.balance, where };
  refocus = item.id === 'paint' ? 'paint-navy' : S.GEAR.some((g) => g.id === item.id) ? `wear-${item.id}` : `owned-${item.id}`;
  if (!S.buy(item.id)) { unlocked = null; refocus = ''; }   // buy() saves and this tab redraws with the moment
}

// ---------- The pieces of the tab ----------
function wearToggle(id, name, verb) {
  const on = S.isWorn(id);
  return h('button', {
    class: 'btn btn-secondary btn-sm py-wear', type: 'button', id: `wear-${id}`, 'aria-pressed': String(on),
    onclick: () => { refocus = `wear-${id}`; S.toggleWear(id); },
  }, on ? icon('i-check') : null, on ? `${verb}ing` : verb, h('span', { class: 'sr-only' }, ` ${name}`));
}

function nextCard(look, rerender) {
  const gear = S.nextGear();
  const train = gear ? null : S.TRAIN.find((t) => !S.owns(t.id));
  const item = gear || train;
  if (!item) {
    return h('section', { class: 'py-next is-done', 'aria-labelledby': 'py-next-title' },
      h('div', { class: 'py-next-text' },
        h('h2', { class: 'py-next-name', id: 'py-next-title' }, icon('i-check'), 'Pengu has every upgrade.'),
        h('p', { class: 'py-next-sub' }, 'Everything you unlocked stays yours.')));
  }
  const st = S.unlockStatus(item.id);
  const art = gear
    ? penguFigure(S.lookWith(item.id, look), { cls: 'py-next-pengu', pose: 'stand' })
    : trainFigure(S.lookWith(item.id, look), { cls: 'py-next-train', night: night() });
  return h('section', { class: `py-next is-${st.state}`, 'aria-labelledby': 'py-next-title' },
    h('div', { class: 'py-next-art', 'aria-hidden': 'true' }, art),
    h('div', { class: 'py-next-text' },
      h('p', { class: 'eyebrow' }, 'Next unlock'),
      h('h2', { class: 'py-next-name', id: 'py-next-title' }, item.name, h('span', { class: 'py-next-price' }, ` · ${item.price} Fish`)),
      h('div', { class: 'py-next-actions' },
        st.state === 'ready' ? unlockButton(item, 'next', rerender) : h('p', { class: 'py-next-short' }, `${st.short} more Fish`),
        previewButton(item, rerender, 'next'))),
    confirmPanel(item, 'next', rerender));
}

function gearRow(g, rerender) {
  const st = S.unlockStatus(g.id);
  let side;
  if (st.state === 'owned') side = wearToggle(g.id, `the ${lower(g.name)}`, 'Wear');
  else if (st.state === 'ready') side = unlockButton(g, 'row', rerender);
  else if (st.state === 'saving') side = h('p', { class: 'py-row-note' }, `${st.short} more Fish`);
  else side = h('p', { class: 'py-row-note is-locked' }, icon('i-lock'), `After the ${lower(st.after.name)}`);
  return h('li', { class: `py-row is-${st.state}${previewing === g.id ? ' is-previewing' : ''}` },
    h('span', { class: 'py-glyph-tile' }, glyph(g.id)),
    h('div', { class: 'py-row-text' },
      h('p', { class: 'py-row-name' }, g.name, st.state === 'owned' ? h('span', { class: 'py-badge' }, 'Yours') : null),
      h('p', { class: 'py-row-price' }, `${g.price} Fish`)),
    h('div', { class: 'py-row-side' }, side, st.state === 'owned' ? null : previewButton(g, rerender)),
    confirmPanel(g, 'row', rerender),
    keepAt('row', g.id, rerender));
}

function trainRow(t, rerender, look) {
  const st = S.unlockStatus(t.id);
  let side;
  if (st.state === 'owned') side = h('p', { class: 'py-row-note is-owned', id: `owned-${t.id}`, tabindex: '-1' }, icon('i-check'), 'On your train');
  else if (st.state === 'ready') side = unlockButton(t, 'row', rerender);
  else side = h('p', { class: 'py-row-note' }, `${st.short} more Fish`);
  const row = h('li', { class: `py-row is-${st.state}${previewing === t.id ? ' is-previewing' : ''}` },
    h('span', { class: 'py-glyph-tile' }, glyph(t.id)),
    h('div', { class: 'py-row-text' },
      h('p', { class: 'py-row-name' }, t.name, st.state === 'owned' ? h('span', { class: 'py-badge' }, 'Yours') : null),
      h('p', { class: 'py-row-price' }, `${t.price} Fish`)),
    h('div', { class: 'py-row-side' }, side, st.state === 'owned' ? null : previewButton(t, rerender)),
    confirmPanel(t, 'row', rerender));
  // Colors, once unlocked: switch any time, as often as you like.
  if (t.id === 'paint' && st.state === 'owned') {
    row.append(h('div', { class: 'py-swatches', role: 'group', 'aria-label': 'Train color' },
      S.PAINTS.map((p) => {
        const dot = h('span', { class: 'py-swatch-dot' });
        dot.style.setProperty('--sw', PAINT_COLORS[p.id].body);
        return h('button', {
          class: 'py-swatch', type: 'button', id: `paint-${p.id}`, 'aria-pressed': String(look.paint === p.id), 'aria-label': p.name, title: p.name,
          onclick: () => { refocus = `paint-${p.id}`; S.setPaint(p.id); },
        }, dot);
      })));
  }
  const k = keepAt('row', t.id, rerender);
  if (k) row.append(k);
  return row;
}

// Extras: hats and decals in their fixed order. Earned ones have Wear toggles; the rest are soft
// outlines with no prices (they only come from workouts beyond the plan).
function extrasShelf() {
  const next = S.nextExtra();
  return h('section', { class: 'py-shop-sec', 'aria-labelledby': 'py-extras-title' },
    h('div', { class: 'py-shop-head' },
      h('h2', { class: 'py-shop-h', id: 'py-extras-title' }, 'Extras'),
      h('p', { class: 'py-shop-sub' }, 'Earned from extra workouts. Looks only.')),
    h('ul', { class: 'py-shelf' }, S.EXTRAS.map((e) => {
      const earned = S.state.extras.some((x) => x.id === e.id);
      const hat = e.kind === 'hat';
      if (!earned) {
        return h('li', { class: 'py-shelf-item is-outline' },
          glyph(e.id, { outline: true }),
          h('p', { class: 'py-shelf-name' }, e.name),
          h('p', { class: 'py-shelf-note' }, e === next ? 'Next extra workout' : 'Not earned yet'));
      }
      return h('li', { class: 'py-shelf-item' },
        glyph(e.id),
        h('p', { class: 'py-shelf-name' }, e.name),
        wearToggle(e.id, hat ? `the ${lower(e.name)}` : `the ${lower(e.name)} on the train`, hat ? 'Wear' : 'Show'));
    })));
}

// `preview`: an unlock to show straight away (the reward sheet's "Preview on Pengu"). `fresh`: the tab
// was just opened, so an earlier preview is not kept.
// Right after an unlock, if no backup was ever saved: where progress lives, and one tap to keep it.
function keepCard(rerender) {
  if (keep && keep.saved) return h('p', { class: 'py-keep is-saved', id: 'py-keep-done', role: 'status', tabindex: '-1' }, icon('i-check'), 'Backup saved. Keep the file somewhere safe.');
  if (!keep || !keep.ask) return null;
  // Not now hands focus to the unlocked piece's own control, as the unlock itself does.
  const back = keep.id === 'paint' ? 'paint-navy' : S.GEAR.some((g) => g.id === keep.id) ? `wear-${keep.id}` : `owned-${keep.id}`;
  return h('div', { class: 'py-keep', role: 'group', 'aria-labelledby': 'py-keep-h' },
    h('p', { id: 'py-keep-h' }, h('strong', {}, 'Keep Pengu’s progress safe.'), ' It’s saved in this browser only. A backup file can bring it back.'),
    h('div', { class: 'py-data-actions' },
      h('button', { class: 'btn btn-secondary btn-sm', type: 'button', id: 'py-keep-save', onclick: () => { saveBackup(); keep = { saved: true, id: keep.id, where: keep.where }; refocus = 'py-keep-done'; rerender(); } }, 'Save a backup'),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', id: 'py-keep-later', onclick: () => { keep = null; refocus = back; rerender(); } }, 'Not now')));
}
// The card sits where the unlock was tapped, so it is seen: inside that gear or train row, right under
// the piece's own control, or above the next unlock when it came from there.
const keepAt = (where, id, rerender) => (keep && (keep.where === 'row' ? where === 'row' && keep.id === id : where === 'top') ? keepCard(rerender) : null);

export function renderShop(root, rerender, { preview = '', fresh = false } = {}) {
  for (const b of bound) if (b) b.stop();
  bound = [];
  if (fresh || preview) previewing = '';
  if (fresh) keep = null;
  if (preview && S.unlockById(preview) && !S.owns(preview)) { previewing = preview; previewFrom = `preview-next-${preview}`; refocus = 'py-preview-stop'; }
  if (previewing && S.owns(previewing)) previewing = '';
  primary = primaryUnlock();
  const look = S.look();
  const moment = unlocked;
  unlocked = null;
  // The first moment progress is worth keeping: an unlock, and no backup saved yet.
  if (moment && !(S.lastBackupAt && S.lastBackupAt())) keep = { ask: true, id: moment.id, where: moment.where };
  const balance = S.state.fish.balance;
  const shownFish = moment ? moment.fish : balance;
  const fishN = h('span', { class: 'py-fish-n' }, String(shownFish));
  fishN.dataset.value = String(shownFish);
  const shown = previewing ? S.lookWith(previewing, look) : look;
  const scene = sceneFigure(shown, 'py-scene', { night: night() });
  const item = previewing ? S.unlockById(previewing) : null;
  const previewBar = item ? h('div', { class: 'py-preview-bar', role: 'status' },
    h('p', {}, h('strong', {}, 'Preview: '), `${item.name}, not unlocked yet. Nothing is spent.`),
    h('button', { class: 'btn btn-secondary btn-sm', type: 'button', id: 'py-preview-stop', onclick: () => { refocus = previewFrom || `preview-${item.id}`; previewing = ''; rerender(); } }, 'Stop preview')) : null;

  root.append(h('div', { class: 'py-shop' },
    h('div', { class: 'py-topbar' },
      h('p', { class: 'py-fishpill glass', 'aria-label': `${balance} Fish` }, icon('i-fish'), fishN)),
    h('h1', { class: 'py-view-title' }, 'Pengu'),
    h('figure', { class: `py-show${item ? ' is-preview' : ''}` },
      h('div', { class: 'py-show-stage' }, item ? h('p', { class: 'py-preview-badge', 'aria-hidden': 'true' }, 'Preview') : null, scene),
      h('figcaption', { class: 'sr-only' }, item ? `Preview, not unlocked: ${caption(shown)}` : caption(look))),
    previewBar,
    keepAt('top', '', rerender),
    nextCard(look, rerender),
    h('section', { class: 'py-shop-sec', 'aria-labelledby': 'py-gear-title' },
      h('div', { class: 'py-shop-head' },
        h('h2', { class: 'py-shop-h', id: 'py-gear-title' }, 'Pengu’s gear'),
        h('p', { class: 'py-shop-sub' }, 'Unlocks in this order')),
      h('ol', { class: 'py-rows' }, S.GEAR.map((g) => gearRow(g, rerender)))),
    h('section', { class: 'py-shop-sec', 'aria-labelledby': 'py-train-title' },
      h('div', { class: 'py-shop-head' },
        h('h2', { class: 'py-shop-h', id: 'py-train-title' }, 'Train upgrades'),
        h('p', { class: 'py-shop-sub' }, 'Any order')),
      h('ul', { class: 'py-rows' }, S.TRAIN.map((t) => trainRow(t, rerender, look)))),
    extrasShelf(),
    h('p', { class: 'py-shop-note' }, 'Prices never change, and nothing is random. Fish only come from planned workouts.'),
    appFooter()));

  const pengu = bindPengu(scene, { follow: true, hop: true });
  bound.push(pengu);

  // The unlock moment: the piece drops onto Pengu, Pengu hops with sparkles, the Fish pill counts down.
  if (moment) {
    showUnlock(scene, moment.id);
    countTo(fishN, balance);
    if (pengu) setTimeout(() => pengu.celebrate(), reducedMotion() ? 0 : 420);
    // Then the words, once the count and the drop have played (the note sits over the Fish pill).
    const item = S.unlockById(moment.id);
    const gear = S.GEAR.some((g) => g.id === moment.id);
    setTimeout(() => toast(`${item.name} unlocked.`, `${gear ? 'Pengu is wearing it.' : moment.id === 'paint' ? 'Pick a color below.' : 'It’s on your train.'} ${balance} Fish left.`,
      penguFigure(look, { cls: 'py-toast-art', pose: 'bust' })), reducedMotion() ? 0 : 1000);
  }
  if (refocus) {
    const el = root.querySelector(`#${CSS.escape(refocus)}`);
    refocus = '';
    if (el) el.focus({ preventScroll: true });
  }
  // After an unlock: the piece's own control, which has focus, is never left under the floating tab bar,
  // and a new backup card is brought into view next to it.
  if (moment) {
    const f = document.activeElement;
    const bar = document.getElementById('py-nav');
    if (f && f !== document.body && bar && f.getBoundingClientRect().bottom > bar.getBoundingClientRect().top) f.scrollIntoView({ block: 'nearest' });
    if (keep && keep.ask) root.querySelector('.py-keep')?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
}
