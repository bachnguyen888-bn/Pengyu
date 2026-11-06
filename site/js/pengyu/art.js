// Pengu and the train. Pengu is the pink lamp: soft glossy pink plastic, a glowing white belly, dark brown
// dot eyes, a small brown beak, small pink flippers and, on the Pengu tab, the warm brown lamp base.
// Glossy light (gradients) lives only on Pengu and the train's paint; outlines are hand-drawn (ink.js).
// Every part is its own <g>, so motion.js can blink, hop, wave and flutter it. The art is decorative:
// screen readers skip it, and the text around it says what is shown.

import { softRect, rng } from './ink.js';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

// ---------- Pengu, in its own 120-unit space: a round egg from x 16 to 105 and y 28 to 140 ----------
// Slightly wider on the right, like the lamp. HEAD: how far the top of the head sits below y 12, where the
// hats were drawn.
const HEAD = 16;
const EGG = 'M60 28C84.5 28 103.6 54 104.9 90C106.2 121.5 87.5 140 61 140C34.5 140 14.8 122.5 16 90C17.2 54.5 35.5 28 60 28Z';
const BELLY = 'M60.5 66C79.5 65 91.5 84 91 105C90.5 125 77 136.5 60 136.5C42.5 136.5 29.5 125 30 104.5C30.5 83.5 42 67 60.5 66Z';
const GLOW = 'M60 52C88 51 104 80 103 110C102 133 84 146 59 146C33 146 16 132 17 108C18 79 33 53 60 52Z';
const FLIP_L = 'M21.5 86C14.5 89.5 10.8 99 12.6 107.5C13.6 111.6 18.3 111.5 20.6 107.6C23.2 103.2 24.6 96 24 89Z';
const FLIP_R = 'M99.5 86C106.5 89.5 110.2 99 108.4 107.5C107.4 111.6 102.7 111.5 100.4 107.6C97.8 103.2 96.4 96 97 89Z';

const defs = (id) => `
  <radialGradient id="${id}-body" cx="38%" cy="26%" r="80%"><stop offset="0" stop-color="#FDE6F3"/><stop offset=".45" stop-color="#F7BFDF"/><stop offset="1" stop-color="#E99BCB"/></radialGradient>
  <radialGradient id="${id}-belly" cx="50%" cy="58%" r="56%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#FFFFFF"/><stop offset=".8" stop-color="#FFF0F8" stop-opacity=".85"/><stop offset="1" stop-color="#FFF0F8" stop-opacity="0"/></radialGradient>
  <radialGradient id="${id}-glow" cx="50%" cy="62%" r="52%"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".8"/><stop offset=".6" stop-color="#FFF0F8" stop-opacity=".35"/><stop offset="1" stop-color="#FFF0F8" stop-opacity="0"/></radialGradient>
  <linearGradient id="${id}-flip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FDE6F3"/><stop offset="1" stop-color="#F0ACD4"/></linearGradient>
  <clipPath id="${id}-egg"><path d="${EGG}"/></clipPath>`;

const FEET = '<ellipse cx="49" cy="139.5" rx="8" ry="3.6" fill="#E99BCB"/><ellipse cx="72" cy="139.5" rx="8" ry="3.6" fill="#E99BCB"/>';

const backpack = () => `
  <g class="py-backpack">
    <path d="M10 76Q10 66 20 66H101Q111 66 111 76V118Q111 128 101 128H20Q10 128 10 118Z" fill="#8A4E22"/>
    <path d="M14 66H107Q111 66 111 72V78H10V72Q10 66 14 66Z" fill="#B8763A"/>
    <circle cx="13.6" cy="104" r="3.2" fill="#FF6B4A"/>
  </g>`;
const STRAPS = `
  <g class="py-straps">
    <path d="M28 70C33 82 36 92 39 102C41 108 42 114 42 122L48.5 122C48.5 113 47 105 44.5 99C41.5 91 39 80 34.5 67.5Z" fill="#B8763A" stroke="#8A4E22" stroke-width=".8"/>
    <path d="M93 70C88 82 85 92 82 102C80 108 79 114 79 122L72.5 122C72.5 113 74 105 76.5 99C79.5 91 82 80 86.5 67.5Z" fill="#B8763A" stroke="#8A4E22" stroke-width=".8"/>
    <rect x="43" y="108" width="35" height="4.4" rx="2.2" fill="#8A4E22"/>
    <rect x="56.5" y="106.4" width="8" height="7.6" rx="1.6" fill="#E9A825"/><rect x="58.5" y="108.4" width="4" height="3.6" rx=".8" fill="#8A4E22"/>
  </g>`;
const jacket = (id) => `
  <g class="py-outfit">
    <g clip-path="url(#${id}-egg)">
      <path d="M14 96L44 100L49 114L44.5 126L43 146L14 146Z" fill="#2F3A52"/>
      <path d="M107 96L77 100L72 114L76.5 126L78 146L107 146Z" fill="#2F3A52"/>
      <path d="M44 100L49 114L44.5 126L43 146M77 100L72 114L76.5 126L78 146" fill="none" stroke="#E9A825" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M22 99Q34 102 44 100M99 99Q87 102 77 100" fill="none" stroke="#4A5876" stroke-width="2.2" stroke-linecap="round"/>
    </g>
    <circle cx="40.5" cy="112" r="2.8" fill="#E9A825"/><circle cx="40.5" cy="112" r="1.1" fill="#B8861A"/>
    <circle cx="40" cy="126" r="2.8" fill="#E9A825"/><circle cx="40" cy="126" r="1.1" fill="#B8861A"/>
    <circle cx="80.5" cy="112" r="2.8" fill="#E9A825"/><circle cx="80.5" cy="112" r="1.1" fill="#B8861A"/>
    <circle cx="81" cy="126" r="2.8" fill="#E9A825"/><circle cx="81" cy="126" r="1.1" fill="#B8861A"/>
  </g>`;

// The scarf: a coral knit band with two stripe lines, and one tail that lags behind (its own group).
const SCARF_BAND = `
  <path d="M15.5 83.5Q60 95.5 105.5 82.5L105 93Q60 106.5 16 94Z" fill="#FF6B4A"/>
  <path d="M18 88.4Q60.5 99.8 103.4 87.6M18.6 91.6Q60 103 103.6 90.8" fill="none" stroke="#FFB199" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="5.5 2.6"/>
  <path d="M16.2 93.6Q60 106 104.8 92.6" fill="none" stroke="#E5532F" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>`;
const SCARF_TAIL = `
  <g class="py-scarf-tail">
    <path d="M74 97C76 108.5 75 118.5 79.5 129L89.5 126C85.5 115.5 86.5 105.5 83.5 95Z" fill="#FF6B4A"/>
    <path d="M78 104.5Q81.5 104 84.6 102.6M79.2 114Q82.6 113.4 86 111.8" fill="none" stroke="#FFB199" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M81 129.5l-.8 4.4M84.6 128.5l-.2 4.6M88 127.2l.4 4.4" stroke="#E5532F" stroke-width="1.6" stroke-linecap="round"/>
  </g>`;
// Riding, the tail streams back out of the cab window.
const SCARF_WIND = `
  <g class="py-scarf-tail is-wind">
    <path d="M30 92C18 86 6 94-14 82L-10 99C4 106 18 101 31 102Z" fill="#FF6B4A"/>
    <path d="M14 89.6L11.8 100.4M0 88.6L-2 99.6" stroke="#E5532F" stroke-width="2" stroke-linecap="round"/>
  </g>`;

const HATS = {
  cap: `
    <g transform="rotate(-7 60 30)">
      <path d="M32.5 36C32 21 45 10 60.5 10C76 10 88.5 20 88.5 34Q60.5 42 32.5 36Z" fill="#FFCE3A"/>
      <path d="M60.5 10.5Q50 19 47.5 37M60.5 10.5Q71 19 73.5 37" fill="none" stroke="#E3A21A" stroke-width="1.6" stroke-linecap="round"/>
      <ellipse cx="47" cy="20" rx="6" ry="2.6" fill="#FFFFFF" opacity=".5" transform="rotate(-30 47 20)"/>
      <circle cx="60.5" cy="10.5" r="3" fill="#FF6B4A"/>
      <path d="M30 35Q60 44.5 92 31.5Q99 33 95.5 37.5Q62 50 29.5 40Z" fill="#F2B92E"/>
    </g>`,
  conductor: `
    <path d="M35 38L32 15Q60.5 6 89 15L86 38Q60.5 44 35 38Z" fill="#2F3A52"/>
    <path d="M32 15Q60.5 6 89 15Q60.5 22 32 15Z" fill="#4A5876"/>
    <path d="M34 30.5Q60.5 36.5 87 30.5L86 38Q60.5 44 35 38Z" fill="#E9A825"/>
    <circle cx="60.5" cy="23" r="4.4" fill="#E9A825"/><circle cx="60.5" cy="23" r="1.8" fill="#2F3A52"/>
    <path d="M37 38Q60.5 50 84 38Q60.5 44 37 38Z" fill="#141213"/>`,
  'hat-bobble': `
    <path d="M31 39C31 22 44 11 60.5 11C77 11 90 22 90 39Q60.5 46.5 31 39Z" fill="#F7BFDF"/>
    <path d="M33.6 30.5Q60.5 37.5 87.4 30.5M38.8 20.8Q60.5 26.8 82.2 20.8" fill="none" stroke="#F7EBD8" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M30 34Q60.5 42 91 34L90 43Q60.5 51 31 43Z" fill="#F7EBD8"/>
    <path d="M38 37.5v6.6M46 39.4v7M53.5 40.5v7M60.5 41v7M67.5 40.5v7M75 39.4v7M83 37.5v6.6" stroke="#E2D2B8" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="60.5" cy="8.5" r="7" fill="#E99BCB"/><circle cx="58.2" cy="6.2" r="2.2" fill="#FFFFFF" opacity=".7"/>`,
  'hat-sun': `
    <path d="M10 38Q60.5 25 111 38Q60.5 53 10 38Z" fill="#F7EBD8" stroke="#E2D2B8" stroke-width="1.2"/>
    <path d="M37 36.5C37 19 45.5 11 60.5 11C75.5 11 84 19 84 36.5Q60.5 42 37 36.5Z" fill="#F2E3C6"/>
    <path d="M37.3 30Q60.5 35.5 83.7 30L84 36.5Q60.5 42 37 36.5Z" fill="#FF6B4A"/>
    <ellipse cx="48" cy="19.5" rx="5.2" ry="2.4" fill="#FFFFFF" opacity=".55" transform="rotate(-30 48 19.5)"/>`,
  'hat-party': `
    <path d="M47 34L60.5-6L74 34Q60.5 39.5 47 34Z" fill="#FFCE3A"/>
    <circle cx="56.2" cy="20" r="2.2" fill="#FF6B4A"/><circle cx="64.6" cy="11.5" r="2" fill="#FF6B4A"/><circle cx="62.4" cy="27.4" r="2.3" fill="#FF6B4A"/><circle cx="54.6" cy="31" r="1.8" fill="#FF6B4A"/><circle cx="60.2" cy="3" r="1.5" fill="#FF6B4A"/>
    <path d="M47 34Q60.5 39.5 74 34" fill="none" stroke="#E3A21A" stroke-width="2" stroke-linecap="round"/>
    <circle cx="60.5" cy="-6" r="4.6" fill="#FF6B4A"/><circle cx="59" cy="-7.4" r="1.4" fill="#FFFFFF" opacity=".7"/>`,
};

// Pengu wearing `look` (from state.look()), as markup in its own space.
// pose: "stand", "cab" or "bust". base: sit in the lamp base (stand only).
function penguMarkup(look, { pose = 'stand', base = false } = {}) {
  const id = `pg${++uid}`;
  const lamp = pose === 'stand' && base;
  const flipR = `<g class="py-flipper-r"><path d="${FLIP_R}" fill="url(#${id}-flip)" stroke="#D9779F" stroke-opacity=".5" stroke-width="1"/></g>`;
  const markup = `
    <defs>${defs(id)}${lamp ? `
      <radialGradient id="${id}-halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset=".45" stop-color="#FDE6F3" stop-opacity=".6"/><stop offset="1" stop-color="#FDE6F3" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}-base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B8763A"/><stop offset=".55" stop-color="#8A4E22"/><stop offset="1" stop-color="#5E3414"/></linearGradient>` : ''}</defs>
    ${lamp ? `<circle class="py-halo" cx="60.5" cy="84" r="74" fill="url(#${id}-halo)"/><ellipse cx="60.5" cy="126" rx="50" ry="11" fill="#5E3414"/>` : ''}
    <g class="py-pengu">
      ${look.backpack ? backpack() : ''}
      ${pose === 'stand' && !base ? FEET : ''}
      <g class="py-body">
        <path d="${EGG}" fill="url(#${id}-body)"/>
        <path d="M34.5 49C39.5 39.5 50 34.3 59.5 34.8C52 38 44.5 45 40.5 54.5C38.8 58.3 32.6 55.5 34.5 49Z" fill="#FFFFFF" opacity=".72"/>
        <circle cx="67" cy="38" r="2.2" fill="#FFFFFF" opacity=".55"/>
      </g>
      <g class="py-belly-glow"><path d="${GLOW}" fill="url(#${id}-glow)"/></g>
      <g class="py-belly"><path d="${BELLY}" fill="url(#${id}-belly)"/></g>
      <path d="${EGG}" fill="none" stroke="#D9779F" stroke-opacity=".55" stroke-width="1.3"/>
      ${look.outfit ? jacket(id) : ''}
      ${look.backpack ? STRAPS : ''}
      <g class="py-flipper-l"><path d="${FLIP_L}" fill="url(#${id}-flip)" stroke="#D9779F" stroke-opacity=".5" stroke-width="1"/></g>
      ${pose === 'cab' ? `<g transform="rotate(-118 99 87)">${flipR}</g>` : flipR}
      <circle cx="37" cy="74" r="4.8" fill="#F27FA8" opacity=".45"/><circle cx="84.5" cy="74" r="4.8" fill="#F27FA8" opacity=".45"/>
      <g class="py-eye py-eye-l"><circle cx="46.5" cy="64" r="4.6" fill="#6E3424"/><circle cx="45.2" cy="62.4" r="1.35" fill="#FFFFFF"/></g>
      <g class="py-eye py-eye-r"><circle cx="75" cy="64" r="4.6" fill="#6E3424"/><circle cx="73.7" cy="62.4" r="1.35" fill="#FFFFFF"/></g>
      <g class="py-beak"><path d="M56.2 70.2Q60.8 68.8 65.4 70.2Q63.3 76.6 60.8 77.8Q58.3 76.6 56.2 70.2Z" fill="#A8622F"/><path d="M58.2 70.9Q60.8 70.2 63.4 70.9" fill="none" stroke="#C9844F" stroke-width=".9" stroke-linecap="round"/></g>
      ${look.scarf ? `<g class="py-scarf">${pose === 'cab' ? SCARF_WIND : SCARF_TAIL}${SCARF_BAND}<ellipse cx="78.5" cy="97.5" rx="6" ry="5" fill="#F25A3A"/></g>` : ''}
      ${look.hat && HATS[look.hat] ? `<g class="py-hat"><g transform="translate(0 ${HEAD})">${HATS[look.hat]}</g></g>` : ''}
    </g>
    ${lamp ? `
      <path d="M10.5 126Q10.5 137.5 60.5 137.5Q110.5 137.5 110.5 126V140Q110.5 152 60.5 152Q10.5 152 10.5 140Z" fill="url(#${id}-base)"/>
      <path d="M10.5 126Q10.5 137.5 60.5 137.5Q110.5 137.5 110.5 126" fill="none" stroke="#D49A5E" stroke-width="2" stroke-linecap="round"/>
      <path d="M11.5 141Q12 150.5 60.5 150.5Q109 150.5 109.5 141" fill="none" stroke="#5E3414" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>` : ''}`;
  return markup;
}

function svgEl(viewBox, cls) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}

const VIEW = { stand: '0 0 121 146', lamp: '-16 -20 153 180', bust: '8 2 105 112' };

// pose: 'stand' (full body), 'bust' (head and shoulders, for the avatar and toasts). base: the lamp base.
// (The old option name `view` still works.)
export function penguFigure(look, { cls = '', pose, view, base = false } = {}) {
  const p = pose || view || 'stand';
  const svg = svgEl(p === 'bust' ? VIEW.bust : base ? VIEW.lamp : VIEW.stand, `py-art py-pengu-art ${cls}`.trim());
  svg.innerHTML = penguMarkup(look, { pose: p === 'bust' ? 'bust' : 'stand', base });
  return svg;
}

// The big simple face that rises like a sun on the reward sheet: happy closed eyes, beak, blush. It wears
// the same hat as Pengu (the face is only the top of the head, so the scarf and pack stay out of view).
// The space above the dome is kept for hats, with or without one, so the face never shifts.
const FACE_HAT = 'translate(63 2) scale(2)';
export function faceFigure(cls = '', look = {}) {
  const id = `pf${++uid}`;
  const svg = svgEl('0 -26 360 196', `py-art py-face ${cls}`.trim());
  const hat = look.hat && HATS[look.hat] ? `<g class="py-hat"><g transform="${FACE_HAT}">${HATS[look.hat]}</g></g>` : '';
  svg.innerHTML = `
    <defs>
      <radialGradient id="${id}-body" cx="36%" cy="22%" r="85%"><stop offset="0" stop-color="#FDE6F3"/><stop offset=".5" stop-color="#F7BFDF"/><stop offset="1" stop-color="#E99BCB"/></radialGradient>
      <radialGradient id="${id}-glow" cx="50%" cy="100%" r="60%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#FFF0F8" stop-opacity=".7"/><stop offset="1" stop-color="#FFF0F8" stop-opacity="0"/></radialGradient>
    </defs>
    <g class="py-face-body">
      <path d="M6 170C6 92 86 42 181 42C276 42 354 94 354 170Z" fill="url(#${id}-body)"/>
      <path d="M40 170C48 118 108 92 180 92C252 92 312 120 320 170Z" fill="url(#${id}-glow)"/>
      <path d="M80 88C100 66 132 54 162 55C138 63 112 77 97 99C91 108 72 101 80 88Z" fill="#FFFFFF" opacity=".6"/>
      <path d="M6 170C6 92 86 42 181 42C276 42 354 94 354 170" fill="none" stroke="#D9779F" stroke-opacity=".5" stroke-width="2"/>
      <circle cx="104" cy="122" r="14" fill="#F27FA8" opacity=".45"/><circle cx="258" cy="122" r="14" fill="#F27FA8" opacity=".45"/>
      <path d="M118 104Q133 88 148 103" fill="none" stroke="#6E3424" stroke-width="7" stroke-linecap="round"/>
      <path d="M214 103Q229 88 244 104" fill="none" stroke="#6E3424" stroke-width="7" stroke-linecap="round"/>
      <path d="M168 114Q181 110 194 114Q187.5 130 181 133Q174.5 130 168 114Z" fill="#A8622F"/>
    </g>${hat}`;
  return svg;
}

// ---------- The train: a steam engine facing right, in its own space (300 × 168) ----------
// Paint covers the boiler and the cab; wheels stay red and trim stays brass.
export const PAINT_COLORS = {
  navy: { hi: '#4A5876', body: '#2F3A52', lo: '#1D2537', cab: '#3C4862', rim: '#5C6B8A', ink: '#F7F2EE' },
  coral: { hi: '#FF8E70', body: '#FF6B4A', lo: '#C2391F', cab: '#E5532F', rim: '#FFB199', ink: '#2B2628' },
  sunny: { hi: '#FFE07A', body: '#FFCE3A', lo: '#C48A10', cab: '#F2B92E', rim: '#FFE6A0', ink: '#2B2628' },
  pink: { hi: '#FBD3EA', body: '#E99BCB', lo: '#B85F8E', cab: '#D9779F', rim: '#FDE6F3', ink: '#2B2628' },
  charcoal: { hi: '#5A5254', body: '#3A3436', lo: '#1F1B1D', cab: '#2B2628', rim: '#7A7072', ink: '#F7F2EE' },
};
const NAVY = PAINT_COLORS.navy;
const INK = '#141213';

const DECALS = {
  'decal-star': '<path d="M152 74l3.4 7 7.6 1.1-5.5 5.3 1.3 7.6-6.8-3.6-6.8 3.6 1.3-7.6-5.5-5.3 7.6-1.1Z" fill="#FFCE3A" stroke="#C48A10" stroke-width=".8" stroke-linejoin="round"/>',
  'decal-wave': '<path d="M137.5 86q3.6-5.4 7.3 0t7.3 0 7.3 0 7.3 0" fill="none" stroke="#F7EBD8" stroke-width="3.6" stroke-linecap="round"/>',
  'decal-bolt': '<path d="M156.5 73L145 88.5H152.4L148.6 99L160.6 83.2H153.2L156.8 73Z" fill="#FF6B4A" stroke="#C2391F" stroke-width=".8" stroke-linejoin="round"/>',
};

// A wheel: a true circle (so it can spin) with red spokes in their own group.
const wheel = (cx, cy, r, rim) => `
  <g class="py-wheel">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#232C40" stroke="${rim}" stroke-width="2.5"/>
    <g class="py-spokes"><path d="M${cx} ${cy - r + 3}V${cy + r - 3}M${cx - r + 3} ${cy}H${cx + r - 3}${r > 12 ? `M${cx - r * 0.6} ${cy - r * 0.6}L${cx + r * 0.6} ${cy + r * 0.6}M${cx + r * 0.6} ${cy - r * 0.6}L${cx - r * 0.6} ${cy + r * 0.6}` : ''}" stroke="#D9472C" stroke-width="2.6" stroke-linecap="round"/><circle cx="${cx}" cy="${cy - r + 4.5}" r="1.4" fill="#D9472C"/></g>
    <circle cx="${cx}" cy="${cy}" r="${Math.max(3, r * 0.21)}" fill="${rim}"/>
  </g>`;

// The extra car: small and navy, carrying a wooden crate stamped with a fish.
const extraCar = (id) => `
  <g class="py-car">
    <rect x="-14" y="99" width="30" height="5" rx="2.5" fill="#161C2A"/>
    <path d="${softRect(-94, 26, 44, 30, 3, { seed: 31, amp: 0.5 })}" fill="#B8763A" stroke="#5E3414" stroke-width="1.2"/>
    <path d="M-93 36.2H-51M-93 46H-51" stroke="#8A4E22" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M-81 41c3.6-4.4 9-4.4 13 0-4 4.4-9.4 4.4-13 0Zm13 0 4.6-3.2v6.4Z" fill="none" stroke="#5E3414" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="${softRect(-106, 54, 96, 52, 8, { seed: 32, amp: 0.6 })}" fill="url(#${id}-car)" stroke="${INK}" stroke-opacity=".4" stroke-width="1.2"/>
    <path d="${softRect(-110, 50, 104, 9, 4.5, { seed: 33, amp: 0.4 })}" fill="${NAVY.rim}"/>
    <path d="${softRect(-98, 66, 80, 30, 4, { seed: 34, amp: 0.5 })}" fill="${NAVY.lo}"/>
    <rect x="-102" y="104" width="88" height="10" rx="3" fill="#161C2A"/>
    ${wheel(-82, 124, 15, NAVY.rim)}${wheel(-34, 124, 15, NAVY.rim)}
  </g>`;

// rider: Pengu in the cab window. night: the headlamp glows a little brighter (after 7pm).
function trainMarkup(look, { rider = true, night = false } = {}) {
  const id = `tr${++uid}`;
  const p = PAINT_COLORS[look.paint] || NAVY;
  const o = `stroke="${INK}" stroke-opacity=".42" stroke-width="1.2"`;
  const lamp = look.headlamp
    ? `<path d="${softRect(236, 34, 20, 16, 4, { seed: 21 })}" fill="${p.hi}" ${o}/>
       <g class="py-lamp"><path class="py-lamp-cone" d="M262 42L300 26V58Z" fill="#FFE08A" opacity="${night ? 0.42 : 0.26}"/>
       <circle cx="256" cy="42" r="17" fill="#FFE08A" opacity="${night ? 0.32 : 0.2}"/><circle cx="256" cy="42" r="10" fill="#FFE08A" opacity=".45"/>
       <circle cx="256" cy="42" r="6" fill="#FFE08A"/></g>`
    : `<path d="${softRect(236, 34, 20, 16, 4, { seed: 21 })}" fill="${p.hi}" ${o}/><circle cx="256" cy="42" r="6" fill="#8A97B0" stroke="#5C6B8A" stroke-width="1.6"/>`;
  return `
    <defs>
      <linearGradient id="${id}-boiler" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.hi}"/><stop offset=".45" stop-color="${p.body}"/><stop offset="1" stop-color="${p.lo}"/></linearGradient>
      <linearGradient id="${id}-cab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.cab}"/><stop offset="1" stop-color="${p.lo}"/></linearGradient>
      <linearGradient id="${id}-car" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NAVY.hi}"/><stop offset=".5" stop-color="${NAVY.body}"/><stop offset="1" stop-color="${NAVY.lo}"/></linearGradient>
    </defs>
    <g class="py-steam" fill="#EDE8EE"><circle class="py-puff" cx="214" cy="2" r="6"/><circle class="py-puff" cx="200" cy="-2" r="4.6"/><circle class="py-puff" cx="188" cy="-5" r="3.4"/></g>
    ${look.car ? extraCar(id) : ''}
    <rect x="38" y="104" width="222" height="12" rx="3" fill="#161C2A"/>
    <path d="${softRect(94, 97, 158, 9, 3, { seed: 2 })}" fill="${p.rim}"/>
    <path d="${softRect(96, 52, 150, 48, 22, { seed: 3, amp: 0.7 })}" fill="url(#${id}-boiler)" ${o}/>
    <path d="M110 59.5Q170 56 230 59" fill="none" stroke="#FFFFFF" stroke-opacity=".28" stroke-width="3" stroke-linecap="round"/>
    <path d="M128.4 52.6L128 99.6M170.6 52.4L170.2 99.8M212.4 52.8L212.8 99.4" stroke="${p.lo}" stroke-width="5.4"/>
    <path d="M104 70.6Q171 69.2 238 70.4" fill="none" stroke="#E9A825" stroke-width="2.4" stroke-linecap="round"/>
    ${look.decal && DECALS[look.decal] ? DECALS[look.decal] : ''}
    <path d="${softRect(236, 50, 20, 52, 9, { seed: 4 })}" fill="${p.lo}" ${o}/>
    <path d="${softRect(206, 28, 18, 28, 2, { seed: 5, amp: 0.4 })}" fill="${p.body}" ${o}/>
    <path d="M196.4 16.2H233.6L225 32.2H205.2Z" fill="${p.hi}" stroke="${INK}" stroke-opacity=".42" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="${softRect(193, 10, 44, 8, 4, { seed: 6, amp: 0.4 })}" fill="${p.rim}"/>
    <path d="${softRect(160, 36, 26, 20, 11, { seed: 7, amp: 0.4 })}" fill="${p.hi}" ${o}/><circle cx="173" cy="36" r="3.4" fill="${p.rim}"/>
    <path d="M133 46h18M134 46v12M150 46v12" stroke="${p.rim}" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <path d="M136 59C136 51 139 48 142 48C145 48 148 51 148 59Z" fill="#E9A825"/><circle cx="142" cy="46" r="1.8" fill="#E9A825"/>
    ${lamp}
    <path d="M250 106L288.4 140H250.4Z" fill="${p.lo}" stroke="${INK}" stroke-opacity=".42" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M256 112.4V139.6M264 119.2V139.6M272 126.4V139.6M280 133V139.6" stroke="${p.rim}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="${softRect(12, 4, 92, 102, 7, { seed: 8, amp: 0.7 })}" fill="url(#${id}-cab)" ${o}/>
    <path d="${softRect(22, 12, 72, 70, 10, { seed: 9, amp: 0.6 })}" fill="#0F131C"/>
    ${rider ? `<g class="py-rider"><g transform="translate(21.7 19.7) scale(0.6)">${penguMarkup(look, { pose: 'cab' })}</g></g>` : ''}
    <path d="${softRect(12, 80, 92, 26, 5, { seed: 10, amp: 0.5 })}" fill="${p.lo}" ${o}/>
    <path d="${softRect(21, 86, 74, 14, 3, { seed: 11, amp: 0.5 })}" fill="${p.body}"/>
    <path d="${softRect(4, -4, 108, 12, 6, { seed: 12, amp: 0.5 })}" fill="${p.rim}" ${o}/>
    <path d="M60 128H202" stroke="${p.rim}" stroke-width="4" stroke-linecap="round"/>
    ${wheel(60, 128, 14, p.rim)}${wheel(118, 124, 19, p.rim)}${wheel(160, 124, 19, p.rim)}${wheel(202, 124, 19, p.rim)}${wheel(242, 131, 11, p.rim)}
    <path class="py-rod" d="M118 124L202 124" stroke="#AEB8CC" stroke-width="3" stroke-linecap="round" opacity=".9"/>`;
}

// Width ÷ height, and where the front (the cowcatcher's tip) sits across the width: the route stops the
// train with its front at the last filled station.
export const TRAIN_SHAPE = { plain: { ratio: 300 / 168, front: 288 / 300 }, car: { ratio: 412 / 168, front: 400 / 412 } };

export function trainFigure(look, { cls = '', rider = true, night = false } = {}) {
  const svg = svgEl(look.car ? '-112 -8 412 168' : '0 -8 300 168', `py-art py-train-art ${cls}`.trim());
  svg.innerHTML = trainMarkup(look, { rider, night });
  return svg;
}

// The Pengu tab's showcase: Pengu glowing in the lamp base, stepped out of the cab, with the train and
// its upgrades behind on a short rail. Only Pengu moves (motion.js); the train stays put.
export function sceneFigure(look, cls = '', { night = false } = {}) {
  const x0 = look.car ? -118 : -8;
  const svg = svgEl(`${x0} -14 ${304 - x0} 168`, `py-art ${cls}`.trim());
  svg.innerHTML = `
    <path d="M${x0} 148Q${(x0 + 304) / 2} 146.6 304 148.4" fill="none" stroke="#9A8F88" stroke-width="2" stroke-linecap="round" opacity=".6"/>
    ${trainMarkup(look, { rider: false, night })}
    <g transform="translate(0.5 5.6) scale(0.95)">${penguMarkup(look, { pose: 'stand', base: true })}</g>`;
  return svg;
}

// Small tiles for the upgrade lists: the item on its own.
const GLYPHS = {
  scarf: '<path d="M6 15Q20 20 34 15L34.5 22Q20 27 5.5 22Z" fill="#FF6B4A"/><path d="M24 21.5c1 5 .5 9 2 13.5l5-1.5c-1.5-4.5-1-8.5-2.5-13Z" fill="#FF6B4A"/><path d="M8 18.4Q20 22.6 32 18.2" fill="none" stroke="#FFB199" stroke-width="1.2" stroke-dasharray="3 1.6"/>',
  cap: '<path d="M8 25A12.5 12 0 0 1 32 23Q20 28 8 25Z" fill="#FFCE3A"/><circle cx="20" cy="11.6" r="1.9" fill="#FF6B4A"/><path d="M10 25Q22 31 34 22Q36 24 34 25.5Q22 33 10 27Z" fill="#F2B92E"/>',
  backpack: '<rect x="9" y="8" width="22" height="26" rx="7" fill="#8A4E22"/><rect x="9" y="8" width="22" height="8" rx="4" fill="#B8763A"/><circle cx="20" cy="25" r="3.2" fill="#FF6B4A"/><path d="M15 8a5 5 0 0 1 10 0" fill="none" stroke="#5E3414" stroke-width="2.2"/>',
  conductor: '<path d="M10 27L8 14Q20 10 32 14L30 27Q20 30 10 27Z" fill="#2F3A52"/><path d="M9.6 23.5Q20 26.5 30.4 23.5L30 27Q20 30 10 27Z" fill="#E9A825"/><circle cx="20" cy="18" r="2.6" fill="#E9A825"/><path d="M11 27Q20 34 29 27Q20 30 11 27Z" fill="#141213"/>',
  headlamp: '<path d="M22 20L38 13V27Z" fill="#FFE08A" opacity=".55"/><rect x="7" y="13" width="14" height="14" rx="4" fill="#2F3A52"/><circle cx="19" cy="20" r="4.5" fill="#FFE08A"/>',
  paint: '<circle cx="12" cy="14" r="5" fill="#2F3A52"/><circle cx="24" cy="11" r="5" fill="#FF6B4A"/><circle cx="31" cy="22" r="5" fill="#FFCE3A"/><circle cx="23" cy="30" r="5" fill="#E99BCB"/><circle cx="11" cy="26" r="5" fill="#3A3436"/>',
  car: '<rect x="11" y="7" width="15" height="11" rx="2" fill="#B8763A"/><path d="M14.5 12.5c1.6-2 4-2 5.8 0-1.8 2-4.2 2-5.8 0Zm5.8 0 2-1.4v2.8Z" fill="none" stroke="#5E3414" stroke-width="1"/><rect x="4" y="19" width="32" height="10" rx="4" fill="#2F3A52"/><circle cx="12" cy="31" r="3.5" fill="#232C40" stroke="#D9472C" stroke-width="1.4"/><circle cx="28" cy="31" r="3.5" fill="#232C40" stroke="#D9472C" stroke-width="1.4"/>',
  'hat-bobble': '<path d="M8 27C8 18 13 12 20 12C27 12 32 18 32 27Z" fill="#F7BFDF"/><path d="M9.5 21.5Q20 24.5 30.5 21.5" fill="none" stroke="#F7EBD8" stroke-width="2.4"/><path d="M7.5 25Q20 28.5 32.5 25L32 29Q20 32.5 8 29Z" fill="#F7EBD8"/><circle cx="20" cy="9.6" r="3.6" fill="#E99BCB"/>',
  'hat-sun': '<path d="M3 26Q20 20 37 26Q20 32 3 26Z" fill="#F7EBD8" stroke="#E2D2B8" stroke-width=".8"/><path d="M12 25C12 17 15 13 20 13C25 13 28 17 28 25Q20 27 12 25Z" fill="#F2E3C6"/><path d="M12 22Q20 24 28 22L28 25Q20 27 12 25Z" fill="#FF6B4A"/>',
  'hat-party': '<path d="M13 31L20 8L27 31Q20 33 13 31Z" fill="#FFCE3A"/><circle cx="18.6" cy="22" r="1.4" fill="#FF6B4A"/><circle cx="21.6" cy="16" r="1.3" fill="#FF6B4A"/><circle cx="21" cy="27" r="1.4" fill="#FF6B4A"/><circle cx="20" cy="8" r="2.6" fill="#FF6B4A"/>',
  'decal-star': '<rect x="4" y="12" width="32" height="18" rx="6" fill="#2F3A52"/><path d="M20 14.2l1.7 3.5 3.8.5-2.8 2.6.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.6 3.8-.5Z" fill="#FFCE3A"/>',
  'decal-wave': '<rect x="4" y="12" width="32" height="18" rx="6" fill="#2F3A52"/><path d="M9 21q2.75-3.5 5.5 0t5.5 0 5.5 0 5.5 0" fill="none" stroke="#F7EBD8" stroke-width="2" stroke-linecap="round"/>',
  'decal-bolt': '<rect x="4" y="12" width="32" height="18" rx="6" fill="#2F3A52"/><path d="M22 14L16 22.5H20L18 28L25 19.5H21L23 14Z" fill="#FF6B4A"/>',
};
// outline: a soft outline only, for an extra not earned yet (pengu.css draws it as a pencil line).
export function glyph(id, { outline = false } = {}) {
  const svg = svgEl('0 0 40 40', `py-glyph${outline ? ' is-outline' : ''}`);
  svg.innerHTML = GLYPHS[id] || '';
  return svg;
}

// A tiny seeded sparkle field for celebrations: deterministic positions, so screenshots match.
export function sparkleSpots(n, seed = 7) {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => ({ angle: (i / n) * Math.PI * 2 + r() * 0.5, dist: 40 + r() * 46, size: 5 + r() * 5, kind: i % 3 }));
}
