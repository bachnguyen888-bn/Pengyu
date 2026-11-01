// Pengu & train: the fixed unlock tree. Every price is shown up front, nothing is random, and what you
// unlock is yours for good. "Wear" switches only change what shows, never what you own.

import * as S from './state.js';
import { penguFigure, sceneFigure, glyph, PAINT_COLORS } from './art.js';
import { h, icon, plural } from './ui.js';
import { toast as fxToast } from '../fx.js';

let confirming = '';   // the unlock waiting for its second tap
let refocus = '';      // the control to put focus back on after a re-render

const bust = () => penguFigure(S.look(), { cls: 'py-toast-art', view: 'bust' });

// The big preview: Pengu on the platform in front of the train, wearing everything that's switched on.
function showcase(look) {
  const hat = look.hat && look.hat !== 'conductor' ? `the ${look.hat === 'cap' ? 'cap' : (S.extraById(look.hat)?.name || '').toLowerCase()}` : null;
  const worn = [
    look.outfit ? 'the conductor outfit' : null,
    hat,
    look.scarf ? 'the scarf' : null,
    look.backpack ? 'the backpack' : null,
  ].filter(Boolean);
  const upgrades = [
    look.headlamp ? 'the headlamp' : null,
    look.paint !== 'navy' ? `${S.PAINTS.find((p) => p.id === look.paint).name.toLowerCase()} paint` : null,
    look.car ? 'the extra car' : null,
    look.decal ? `the ${S.extraById(look.decal).name.toLowerCase()}` : null,
  ].filter(Boolean);
  const label = `${worn.length ? `Pengu is wearing ${worn.join(', ')}.` : 'Pengu isn’t wearing any gear yet.'} ${upgrades.length ? `The train has ${upgrades.join(', ')}.` : 'The train is navy with no upgrades yet.'}`;
  return h('figure', { class: 'py-show' },
    h('div', { class: 'py-show-stage' }, sceneFigure(look, 'py-scene')),
    h('figcaption', { class: 'sr-only' }, label));
}

function nextGoal() {
  const g = S.nextGear();
  const fish = S.state.fish.balance;
  if (!g) {
    return h('div', { class: 'py-goalcard is-done' },
      h('p', { class: 'py-goalcard-title' }, icon('i-check'), 'Pengu’s gear is complete.'),
      h('p', { class: 'small muted' }, 'Everything you unlocked stays yours. Train upgrades are below.'));
  }
  const short = g.price - fish;
  return h('div', { class: 'py-goalcard' },
    h('p', { class: 'stat-label' }, 'Next unlock'),
    h('p', { class: 'py-goalcard-title' }, `${g.name} · ${g.price} Fish`),
    h('p', { class: 'small muted' }, short > 0 ? `${short} more Fish: about ${Math.max(1, Math.ceil(short / 10))} planned ${short > 10 ? 'workouts' : 'workout'}.` : 'Ready to unlock.'));
}

function buyNow(item, rerender) {
  // Set where focus lands before buying: the purchase re-renders this list straight away.
  confirming = '';
  refocus = `wear-${item.id}`;
  const res = S.buy(item.id);
  if (!res) { refocus = `buy-${item.id}`; rerender(); return; }
  fxToast(`New ${item.kind === 'gear' ? 'gear' : 'train upgrade'}: ${item.name}!`,
    `${item.kind === 'gear' ? 'Pengu’s wearing it now.' : 'It’s on your train now.'} −${item.price} Fish. It’s yours for good.`,
    bust());
}

function itemRow(item, rerender) {
  const st = S.unlockStatus(item.id);
  const owned = st.state === 'owned';
  let status = '';
  if (owned) status = 'Yours for good';
  else if (st.state === 'locked') status = `${item.price} Fish · unlocks after the ${st.after.name}`;
  else if (st.state === 'saving') status = `${item.price} Fish · ${st.short} more to go`;
  else status = `${item.price} Fish`;

  let action = null;
  if (owned && (item.kind === 'gear')) {
    const worn = S.isWorn(item.id);
    action = h('button', {
      class: 'btn btn-secondary btn-sm py-wear', type: 'button', id: `wear-${item.id}`, 'aria-pressed': String(worn),
      'aria-label': `${worn ? 'Take off' : 'Wear'} the ${item.name}`,
      onclick: () => { refocus = `wear-${item.id}`; S.toggleWear(item.id); },
    }, worn ? icon('i-check') : null, worn ? 'Wearing' : 'Wear');
  } else if (owned) {
    action = h('span', { class: 'py-owned', id: `wear-${item.id}`, tabindex: '-1' }, icon('i-check'), 'On your train');
  } else if (st.state === 'ready') {
    action = h('button', {
      class: 'btn btn-primary btn-sm', type: 'button', id: `buy-${item.id}`, 'aria-expanded': String(confirming === item.id),
      onclick: () => { confirming = confirming === item.id ? '' : item.id; refocus = confirming ? `confirm-${item.id}` : `buy-${item.id}`; rerender(); },
    }, `Unlock · ${item.price}`);
  } else {
    action = h('span', { class: 'py-lock' }, icon(st.state === 'locked' ? 'i-lock' : 'i-fish'), `${item.price}`);
  }

  const li = h('li', { class: `py-item is-${st.state}` },
    h('span', { class: 'py-glyph-tile' }, glyph(item.id)),
    h('div', { class: 'py-item-text' },
      h('p', { class: 'py-item-name' }, item.name),
      h('p', { class: 'small muted' }, `${item.line} `, h('span', { class: 'py-item-status' }, status))),
    h('div', { class: 'py-act' }, action));

  if (confirming === item.id && st.state === 'ready') {
    li.append(h('div', { class: 'py-confirm', role: 'group', 'aria-label': `Unlock the ${item.name}` },
      h('p', { class: 'small' }, `Spend ${item.price} of your ${S.state.fish.balance} Fish on the ${item.name}? It’s yours for good.`),
      h('div', { class: 'py-confirm-actions' },
        h('button', { class: 'btn btn-primary btn-sm', type: 'button', id: `confirm-${item.id}`, onclick: () => buyNow(item, rerender) }, `Unlock the ${item.name}`),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { confirming = ''; refocus = `buy-${item.id}`; rerender(); } }, 'Not now'))));
  }

  // Paint colours, once unlocked: switch any time, as often as you like.
  if (item.id === 'paint' && owned) {
    const look = S.look();
    li.append(h('div', { class: 'py-swatches', role: 'group', 'aria-label': 'Train colour' },
      S.PAINTS.map((p) => {
        const dot = h('span', { class: 'py-swatch-dot' });
        dot.style.setProperty('--sw', PAINT_COLORS[p.id].body);
        return h('button', {
          class: 'py-swatch', type: 'button', id: `paint-${p.id}`, 'aria-pressed': String(look.paint === p.id), 'aria-label': p.name, title: p.name,
          onclick: () => { refocus = `paint-${p.id}`; S.setPaint(p.id); },
        }, dot);
      })));
  }
  return li;
}

function extrasSection() {
  const owned = S.state.extras.map((x) => S.extraById(x.id)).filter(Boolean);
  const next = S.nextExtra();
  if (!owned.length) {
    return h('section', { class: 'py-shop-sec', 'aria-labelledby': 'py-extras-title' },
      h('h2', { class: 'py-shop-h', id: 'py-extras-title' }, 'Extras'),
      h('p', { class: 'small muted' }, `Workouts beyond your plan collect looks-only extras in a set order. ${next ? `The first is the ${next.name}.` : ''}`));
  }
  return h('section', { class: 'py-shop-sec', 'aria-labelledby': 'py-extras-title' },
    h('h2', { class: 'py-shop-h', id: 'py-extras-title' }, 'Extras'),
    h('ul', { class: 'py-items' }, owned.map((e) => {
      const worn = S.isWorn(e.id);
      return h('li', { class: 'py-item is-owned' },
        h('span', { class: 'py-glyph-tile' }, glyph(e.id)),
        h('div', { class: 'py-item-text' },
          h('p', { class: 'py-item-name' }, e.name),
          h('p', { class: 'small muted' }, `From an extra ride. Looks only.`)),
        h('div', { class: 'py-act' }, h('button', {
          class: 'btn btn-secondary btn-sm py-wear', type: 'button', id: `wear-${e.id}`, 'aria-pressed': String(worn),
          'aria-label': `${worn ? 'Take off' : (e.kind === 'hat' ? 'Wear' : 'Show')} the ${e.name}`,
          onclick: () => { refocus = `wear-${e.id}`; S.toggleWear(e.id); },
        }, worn ? icon('i-check') : null, worn ? (e.kind === 'hat' ? 'Wearing' : 'Showing') : (e.kind === 'hat' ? 'Wear' : 'Show'))));
    })),
    h('p', { class: 'small muted' }, next ? `Next extra ride: ${next.name}.` : 'You’ve collected every extra.'));
}

export function renderShop(root, rerender) {
  const look = S.look();
  root.append(h('div', { class: 'py-shop' },
    h('h1', { class: 'py-view-title' }, 'Pengu & train'),
    h('div', { class: 'py-shop-top' },
      showcase(look),
      h('div', { class: 'py-shop-side' },
        h('p', { class: 'py-wallet' }, icon('i-fish'), h('strong', {}, String(S.state.fish.balance)), ' Fish'),
        nextGoal())),
    h('section', { class: 'py-shop-sec', 'aria-labelledby': 'py-gear-title' },
      h('div', { class: 'py-shop-head' },
        h('h2', { class: 'py-shop-h', id: 'py-gear-title' }, 'Pengu’s gear'),
        h('span', { class: 'small muted' }, 'Unlocks in this order')),
      h('ol', { class: 'py-items' }, S.GEAR.map((g) => itemRow({ ...g, kind: 'gear' }, rerender)))),
    h('section', { class: 'py-shop-sec', 'aria-labelledby': 'py-train-title' },
      h('div', { class: 'py-shop-head' },
        h('h2', { class: 'py-shop-h', id: 'py-train-title' }, 'Train upgrades'),
        h('span', { class: 'small muted' }, 'Any order')),
      h('ul', { class: 'py-items' }, S.TRAIN.map((t) => itemRow({ ...t, kind: 'train' }, rerender)))),
    extrasSection(),
    h('p', { class: 'small muted py-shop-note' }, 'Prices never change, and nothing is random. Everything you unlock is yours for good. Fish only come from planned workouts.')));
  if (refocus) {
    const el = root.querySelector(`#${CSS.escape(refocus)}`);
    refocus = '';
    if (el) el.focus({ preventScroll: true });
  }
}
