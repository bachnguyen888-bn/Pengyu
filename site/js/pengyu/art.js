// Pengu and the train, drawn with whatever they have on. Flat shapes only (no gradients): Pengu is the
// soft pink penguin from the Pengyu home prototype, the train is a dark navy steam engine with red
// wheels. Decorative: screen readers skip it, and the text around it says what Pengu is wearing.

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

// ---------- Pengu, in its own coordinates: body centred at (60, 84), 120 wide ----------
const INK = { body: '#F7BFDF', edge: '#D9779F', flipper: '#F0AAD3', belly: '#FFF4FA', cheek: '#F27FA8', eye: '#6E3424', beak: '#A8622F', feet: '#E39A57' };

const FLIPPERS = `
  <path d="M27 92C17 98 12 111 12.6 123C12.8 127.5 17.2 128.4 19.6 125C24.6 118 28.6 109 31.6 100Z" fill="${INK.flipper}" stroke="${INK.edge}" stroke-width="1.6"/>
  <path d="M90 90C98 80 105 69 110 58C112 53.6 117.6 55 116.4 60C113.4 72 106 85 96 98Z" fill="${INK.flipper}" stroke="${INK.edge}" stroke-width="1.6"/>`;
const FEET = `<ellipse cx="47" cy="132.5" rx="10" ry="5" fill="${INK.feet}"/><ellipse cx="73" cy="132.5" rx="10" ry="5" fill="${INK.feet}"/>`;
const BODY = `
  <ellipse cx="60" cy="84" rx="38.8" ry="48" fill="${INK.body}" stroke="${INK.edge}" stroke-width="1.8"/>
  <ellipse cx="44.5" cy="53" rx="10.8" ry="6.2" fill="#FFFFFF" opacity="0.55" transform="rotate(-24 44.5 53)"/>
  <ellipse cx="60" cy="101" rx="24.8" ry="26.4" fill="${INK.belly}"/>`;
const FACE = `
  <circle cx="37.5" cy="78.6" r="5" fill="${INK.cheek}" opacity="0.45"/><circle cx="82.5" cy="78.6" r="5" fill="${INK.cheek}" opacity="0.45"/>
  <circle cx="47.6" cy="68.5" r="5.2" fill="${INK.eye}"/><circle cx="72.4" cy="68.5" r="5.2" fill="${INK.eye}"/>
  <circle cx="49.4" cy="66.7" r="1.7" fill="#FFFFFF"/><circle cx="74.2" cy="66.7" r="1.7" fill="#FFFFFF"/>
  <path d="M53.8 76.2Q60 74.4 66.2 76.2Q63.4 84 60 85.4Q56.6 84 53.8 76.2Z" fill="${INK.beak}"/>`;

// Gear: the backpack sits behind Pengu with its straps in front; the conductor's coat is open over the belly.
const BACKPACK_BEHIND = `
  <rect x="15" y="58" width="90" height="62" rx="18" fill="#23A08D"/>
  <rect x="19" y="58" width="82" height="13" rx="6.5" fill="#2BB5A0"/>`;
const STRAPS = `
  <path d="M27 64C31 76 33.5 86 37 96C39 102 40.5 108 40.5 116L47 116C47 107 45.5 99 43 93C40 85 37.5 74 33.5 61.5Z" fill="#2BB5A0"/>
  <path d="M93 64C89 76 86.5 86 83 96C81 102 79.5 108 79.5 116L73 116C73 107 74.5 99 77 93C80 85 82.5 74 86.5 61.5Z" fill="#2BB5A0"/>
  <path d="M40.5 116h6.5v4.5a3.25 3.25 0 0 1-6.5 0ZM73 116h6.5v4.5a3.25 3.25 0 0 1-6.5 0Z" fill="#23A08D"/>
  <rect x="42" y="104" width="36" height="4.4" rx="2.2" fill="#23A08D"/>
  <rect x="56" y="102.4" width="8" height="7.6" rx="1.6" fill="#F2C94C"/><rect x="58" y="104.4" width="4" height="3.6" rx="0.8" fill="#23A08D"/>`;
const JACKET = `
  <g clip-path="CLIP">
    <path d="M16 86L45 92L49.5 106L45 118L43 136L16 136Z" fill="#2D3850"/>
    <path d="M104 86L75 92L70.5 106L75 118L77 136L104 136Z" fill="#2D3850"/>
    <path d="M45 92L49.5 106L45 118L43 136M75 92L70.5 106L75 118L77 136" fill="none" stroke="#E9A825" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M24 90Q35 93.5 45 92M96 90Q85 93.5 75 92" fill="none" stroke="#45547A" stroke-width="2.4" stroke-linecap="round"/>
  </g>
  <circle cx="41.5" cy="102" r="3" fill="#E9A825"/><circle cx="41.5" cy="102" r="1.2" fill="#C98A12"/>
  <circle cx="40.5" cy="116" r="3" fill="#E9A825"/><circle cx="40.5" cy="116" r="1.2" fill="#C98A12"/>
  <circle cx="78.5" cy="102" r="3" fill="#E9A825"/><circle cx="78.5" cy="102" r="1.2" fill="#C98A12"/>
  <circle cx="79.5" cy="116" r="3" fill="#E9A825"/><circle cx="79.5" cy="116" r="1.2" fill="#C98A12"/>`;
const SCARF_BAND = `
  <path d="M20.4 87.5Q60 98.5 99.6 87.5L99.4 98.8Q60 109.8 20.6 98.8Z" fill="#FF6B4A"/>
  <path d="M32 91.6l-.8 9M45 94.5l-.5 9.4M75 94.5l.5 9.4M88 91.6l.8 9" stroke="#E04F33" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M27 90.6Q60 100.8 93 90.6" fill="none" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="2.2" stroke-linecap="round"/>`;
// Hanging in front when Pengu stands; streaming back in the wind when Pengu rides.
const SCARF_TAIL = `
  <path d="M68 99C70.5 111 69 121 73.5 133L84.5 129.6C80.5 118.6 81.6 108.6 78.6 96.8Z" fill="#FF6B4A"/>
  <path d="M75 133.4l-.7 4.6M79 132.2l-.2 4.8M83 130.8l.4 4.6" stroke="#E04F33" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="72.5" cy="99.6" rx="7" ry="6" fill="#F25A3A"/>`;
const SCARF_WIND = `
  <path d="M30 90C18 84 6 92-16 80L-12 98C2 105 16 100 31 102Z" fill="#FF6B4A"/>
  <path d="M14 88.6L11.6 100.6M0 87.8L-2.2 100" stroke="#E04F33" stroke-width="2.4" stroke-linecap="round"/>
  <ellipse cx="31" cy="96" rx="6.5" ry="6" fill="#F25A3A"/>`;

const HATS = {
  cap: `
    <path d="M31.5 53A28.5 28 0 0 1 88.5 53Q60 60.5 31.5 53Z" fill="#FFC93C"/>
    <path d="M60 25.4Q48.6 33 45.6 54.6M60 25.4Q71.4 33 74.4 54.6" fill="none" stroke="#E3A21A" stroke-width="1.8" stroke-linecap="round"/>
    <ellipse cx="47" cy="35" rx="6.5" ry="3" fill="#FFFFFF" opacity="0.45" transform="rotate(-32 47 35)"/>
    <circle cx="60" cy="25.6" r="2.8" fill="#E3A21A"/>
    <path d="M38 54.5Q60 67 82 54.5Q60 61 38 54.5Z" fill="#F0A818"/>`,
  conductor: `
    <path d="M34.5 55L31 30Q60 21 89 30L85.5 55Q60 61.5 34.5 55Z" fill="#2D3850"/>
    <path d="M31 30Q60 21 89 30Q60 37.5 31 30Z" fill="#45547A"/>
    <path d="M33.5 47Q60 53.5 86.5 47L85.5 55Q60 61.5 34.5 55Z" fill="#E9A825"/>
    <circle cx="60" cy="38.5" r="4.6" fill="#E9A825"/><circle cx="60" cy="38.5" r="2" fill="#2D3850"/>
    <path d="M37 55Q60 67.5 83 55Q60 61.5 37 55Z" fill="#161C2A"/>`,
  'hat-bobble': `
    <path d="M30.5 55A29.5 29 0 0 1 89.5 55Q60 62 30.5 55Z" fill="#E8553A"/>
    <path d="M36.5 39Q60 46 83.5 39" fill="none" stroke="#C93E26" stroke-width="3" stroke-linecap="round"/>
    <path d="M29.6 46.5Q60 54.5 90.4 46.5L89.5 56Q60 64 30.5 56Z" fill="#F7EBD8"/>
    <path d="M38 50v7.4M46 52v7.8M53.5 53v7.8M60 53.4v7.8M66.5 53v7.8M74 52v7.8M82 50v7.4" stroke="#E2D2B8" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="60" cy="23" r="8" fill="#F7EBD8"/><circle cx="57.4" cy="20.4" r="2.4" fill="#FFFFFF" opacity="0.7"/>`,
  'hat-sun': `
    <path d="M12 52Q60 39 108 52Q60 67 12 52Z" fill="#EBC45E" stroke="#D9AE45" stroke-width="1.4"/>
    <path d="M38 50.5C38 33 46 26 60 26C74 26 82 33 82 50.5Q60 56 38 50.5Z" fill="#F2D27A"/>
    <path d="M38.3 44Q60 49.5 81.7 44L82 50.5Q60 56 38 50.5Z" fill="#FF6B4A"/>
    <ellipse cx="48" cy="34" rx="5.4" ry="2.6" fill="#FFFFFF" opacity="0.45" transform="rotate(-30 48 34)"/>`,
  'hat-party': `
    <path d="M46 48L60 6L74 48Q60 53.5 46 48Z" fill="#FFC93C"/>
    <path d="M53.2 26.5H66.8L68.9 33H51.1ZM49 39H71L72.8 44.4H47.2Z" fill="#FF6B4A"/>
    <path d="M46 48Q60 53.5 74 48" fill="none" stroke="#E3A21A" stroke-width="2" stroke-linecap="round"/>
    <circle cx="60" cy="6" r="5" fill="#FF6B4A"/><circle cx="58.4" cy="4.4" r="1.6" fill="#FFFFFF" opacity="0.7"/>`,
};

// Pengu wearing `look` (from state.look()), as markup in Pengu's own coordinates.
function penguMarkup(look, { wind = false, feet = true } = {}) {
  const clip = `py-art-${++uid}`;
  return `
    <defs><clipPath id="${clip}"><ellipse cx="60" cy="84" rx="38.8" ry="48"/></clipPath></defs>
    ${look.backpack ? BACKPACK_BEHIND : ''}
    ${FLIPPERS}${feet ? FEET : ''}${BODY}
    ${look.outfit ? JACKET.replace('CLIP', `url(#${clip})`) : ''}
    ${look.backpack ? STRAPS : ''}
    ${FACE}
    ${look.scarf ? SCARF_BAND + (wind ? SCARF_WIND : SCARF_TAIL) : ''}
    ${look.hat ? HATS[look.hat] || '' : ''}`;
}

function svgEl(viewBox, cls) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}

// view: 'full' (Pengu standing, room above for hats) or 'bust' (head and shoulders, for avatars and toasts).
export function penguFigure(look, { cls = '', view = 'full' } = {}) {
  const svg = svgEl(view === 'bust' ? '10 -2 100 100' : '4 -2 116 144', `py-art ${cls}`.trim());
  svg.innerHTML = penguMarkup(look, { feet: view !== 'bust' });
  return svg;
}

// ---------- The train: a steam engine facing right, in its own coordinates (300 × 168) ----------
export const PAINT_COLORS = {
  navy: { body: '#2F3A52', dark: '#1D2537', light: '#4A5876', trim: '#5C6B8A', ink: '#FFFFFF' },
  coral: { body: '#E8553A', dark: '#B93F27', light: '#F27A5E', trim: '#FFB199', ink: '#FFFFFF' },
  sunny: { body: '#F2B92E', dark: '#C48A10', light: '#F7CD5E', trim: '#FFE6A0', ink: '#2B2628' },
  mint: { body: '#1F9C89', dark: '#14705F', light: '#38B8A3', trim: '#A5E8DD', ink: '#FFFFFF' },
  purple: { body: '#6C5CE7', dark: '#4B3CC4', light: '#8F84F0', trim: '#C9C2F5', ink: '#FFFFFF' },
};

// Looks-only extras on the boiler side, between the first two bands.
const DECALS = {
  'decal-star': (ink) => `<path d="M152 75l3.3 6.8 7.5 1.1-5.4 5.2 1.3 7.4-6.7-3.5-6.7 3.5 1.3-7.4-5.4-5.2 7.5-1.1Z" fill="${ink}"/>`,
  'decal-wave': (ink) => `<path d="M138 86q3.5-5 7 0t7 0 7 0 7 0" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>`,
  'decal-bolt': () => '<path d="M156 74L145 88H152L148.5 98L160 83H153L156.5 74Z" fill="#FFD66B"/>',
};

const wheel = (cx, cy, r, trim) => `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#232C40" stroke="${trim}" stroke-width="2.5"/>
  <path d="M${cx} ${cy - r + 3}V${cy + r - 3}M${cx - r + 3} ${cy}H${cx + r - 3}${r > 12 ? `M${cx - r * 0.6} ${cy - r * 0.6}L${cx + r * 0.6} ${cy + r * 0.6}M${cx + r * 0.6} ${cy - r * 0.6}L${cx - r * 0.6} ${cy + r * 0.6}` : ''}" stroke="#D9472C" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy}" r="${Math.max(3, r * 0.21)}" fill="${trim}"/>`;

// The extra car rides behind the cab, carrying two crates.
const extraCar = (p) => `
  <rect x="-14" y="99" width="30" height="5" rx="2.5" fill="#161C2A"/>
  <rect x="-98" y="30" width="32" height="26" rx="3" fill="#F2D27A"/><path d="M-98 43H-66M-82 30V56" stroke="#D9AE45" stroke-width="2"/>
  <rect x="-62" y="38" width="28" height="18" rx="3" fill="#F7EBD8"/><path d="M-62 47H-34M-48 38V56" stroke="#E2D2B8" stroke-width="2"/>
  <rect x="-106" y="54" width="96" height="52" rx="8" fill="${p.body}"/>
  <rect x="-110" y="50" width="104" height="9" rx="4.5" fill="${p.light}"/>
  <rect x="-98" y="66" width="80" height="30" rx="4" fill="${p.dark}"/>
  <rect x="-102" y="104" width="88" height="10" rx="3" fill="#161C2A"/>
  ${wheel(-82, 124, 15, p.trim)}${wheel(-34, 124, 15, p.trim)}`;

// rider: Pengu in the cab window (scarf blowing back); cheer: Pengu hops (after a full week or a comeback).
function trainMarkup(look, { rider = true, cheer = false } = {}) {
  const p = PAINT_COLORS[look.paint] || PAINT_COLORS.navy;
  const lamp = look.headlamp
    ? `<path d="M262 42L300 28V56Z" fill="#FFE08A" opacity="0.28"/>
       <circle cx="256" cy="42" r="17" fill="#FFE08A" opacity="0.22"/><circle cx="256" cy="42" r="10" fill="#FFE08A" opacity="0.4"/>
       <rect x="236" y="34" width="20" height="16" rx="4" fill="${p.light}"/><circle cx="256" cy="42" r="6" fill="#FFE08A"/>`
    : `<rect x="236" y="34" width="20" height="16" rx="4" fill="${p.light}"/><circle cx="256" cy="42" r="6" fill="#8A97B0" stroke="#5C6B8A" stroke-width="1.6"/>`;
  return `
    <g class="py-smoke" fill="#E8E2E6"><circle cx="214" cy="2" r="6"/><circle cx="200" cy="-2" r="4.6"/><circle cx="188" cy="-5" r="3.4"/></g>
    ${look.car ? extraCar(p) : ''}
    <rect x="38" y="104" width="222" height="12" rx="3" fill="#161C2A"/>
    <rect x="94" y="97" width="158" height="9" rx="3" fill="${p.light}"/>
    <rect x="96" y="52" width="150" height="48" rx="22" fill="${p.body}"/>
    <rect x="108" y="58" width="124" height="5" rx="2.5" fill="${p.light}"/>
    <rect x="128" y="52" width="6" height="48" fill="${p.dark}"/><rect x="170" y="52" width="6" height="48" fill="${p.dark}"/><rect x="212" y="52" width="6" height="48" fill="${p.dark}"/>
    <path d="M104 70H238" stroke="#E9A825" stroke-width="2.4" stroke-linecap="round"/>
    ${look.decal && DECALS[look.decal] ? DECALS[look.decal](p.ink) : ''}
    <rect x="236" y="50" width="20" height="52" rx="9" fill="${p.dark}"/>
    <rect x="206" y="28" width="18" height="28" fill="${p.body}"/><path d="M196 16H234L225 32H205Z" fill="${p.light}"/><rect x="193" y="10" width="44" height="8" rx="4" fill="${p.trim}"/>
    <rect x="160" y="36" width="26" height="20" rx="12" fill="${p.light}"/><circle cx="173" cy="36" r="3.5" fill="${p.trim}"/>
    <path d="M133 46h18M134 46v12M150 46v12" stroke="${p.trim}" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <path d="M136 59C136 51 139 48 142 48C145 48 148 51 148 59Z" fill="#E9A825"/><circle cx="142" cy="46" r="1.8" fill="#E9A825"/>
    ${lamp}
    <path d="M250 106L288 140H250Z" fill="${p.dark}"/>
    <path d="M256 112V140M264 119V140M272 126V140M280 133V140" stroke="${p.trim}" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="12" y="4" width="92" height="102" rx="7" fill="${p.body}"/>
    <rect x="22" y="12" width="72" height="70" rx="10" fill="#0F131C"/>
    ${rider ? `<g class="py-rider${cheer ? ' is-cheer' : ''}"><g transform="translate(22 17.6) scale(0.6)">${penguMarkup(look, { wind: true, feet: false })}</g></g>` : ''}
    <rect x="12" y="80" width="92" height="26" rx="5" fill="${p.dark}"/><rect x="21" y="86" width="74" height="14" rx="3" fill="${p.body}"/>
    <rect x="4" y="-4" width="108" height="12" rx="6" fill="${p.trim}"/>
    <path d="M60 128H202" stroke="${p.trim}" stroke-width="4" stroke-linecap="round"/>
    ${wheel(60, 128, 14, p.trim)}${wheel(118, 124, 19, p.trim)}${wheel(160, 124, 19, p.trim)}${wheel(202, 124, 19, p.trim)}${wheel(242, 131, 11, p.trim)}
    <path d="M118 124L202 124" stroke="#AEB8CC" stroke-width="3" stroke-linecap="round" opacity="0.9"/>`;
}

// Width ÷ height, and where Pengu's cab sits across the width: the route lines Pengu up with a station.
export const TRAIN_SHAPE = { plain: { ratio: 300 / 168, cab: 58 / 300 }, car: { ratio: 412 / 168, cab: 170 / 412 } };

export function trainFigure(look, { cls = '', rider = true, cheer = false } = {}) {
  const svg = svgEl(look.car ? '-112 -8 412 168' : '0 -8 300 168', `py-art ${cls}`.trim());
  svg.innerHTML = trainMarkup(look, { rider, cheer });
  return svg;
}

// The Pengu tab's showcase: Pengu stands on the platform in front of the train, so every piece of gear
// and every train upgrade shows at once.
export function sceneFigure(look, cls = '') {
  const x0 = look.car ? -118 : -8;
  const svg = svgEl(`${x0} -12 ${304 - x0} 166`, `py-art ${cls}`.trim());
  svg.innerHTML = `
    <rect x="${x0}" y="146" width="${304 - x0}" height="4" rx="2" fill="#D8CFC6"/>
    ${trainMarkup(look, { rider: false })}
    <g transform="translate(1 15.4) scale(0.95)">${penguMarkup(look)}</g>`;
  return svg;
}

// Small tiles for the upgrade list: the item on its own.
const GLYPHS = {
  scarf: '<path d="M6 15Q20 20 34 15L34.5 22Q20 27 5.5 22Z" fill="#FF6B4A"/><path d="M24 21.5c1 5 .5 9 2 13.5l5-1.5c-1.5-4.5-1-8.5-2.5-13Z" fill="#FF6B4A"/><path d="M12 17.2l-.6 6M28 17.2l.6 6" stroke="#E04F33" stroke-width="2" stroke-linecap="round"/>',
  cap: '<path d="M7 24A14 13 0 0 1 33 24Q20 28 7 24Z" fill="#FFC93C"/><circle cx="20" cy="11" r="1.8" fill="#E3A21A"/><path d="M11 25Q20 33 29 25Q20 27.5 11 25Z" fill="#F0A818"/>',
  backpack: '<rect x="9" y="8" width="22" height="26" rx="7" fill="#2BB5A0"/><rect x="13" y="20" width="14" height="10" rx="3" fill="#23A08D"/><path d="M15 8a5 5 0 0 1 10 0" fill="none" stroke="#1E8C7C" stroke-width="2.4"/><rect x="18" y="22" width="4" height="3" rx="1" fill="#F2C94C"/>',
  conductor: '<path d="M10 27L8 14Q20 10 32 14L30 27Q20 30 10 27Z" fill="#2D3850"/><path d="M9.6 23.5Q20 26.5 30.4 23.5L30 27Q20 30 10 27Z" fill="#E9A825"/><circle cx="20" cy="18" r="2.6" fill="#E9A825"/><path d="M11 27Q20 34 29 27Q20 30 11 27Z" fill="#161C2A"/>',
  headlamp: '<circle cx="24" cy="20" r="12" fill="#FFE08A" opacity="0.35"/><rect x="9" y="13" width="14" height="14" rx="4" fill="#2F3A52"/><circle cx="21" cy="20" r="4.5" fill="#FFE08A"/>',
  paint: '<circle cx="12" cy="15" r="5.5" fill="#E8553A"/><circle cx="24" cy="12" r="5.5" fill="#F2B92E"/><circle cx="29" cy="24" r="5.5" fill="#1F9C89"/><circle cx="16" cy="27" r="5.5" fill="#2F3A52"/>',
  car: '<rect x="5" y="10" width="12" height="10" rx="2" fill="#F2D27A"/><rect x="19" y="13" width="11" height="7" rx="2" fill="#F7EBD8"/><rect x="3" y="20" width="34" height="10" rx="4" fill="#2F3A52"/><circle cx="11" cy="31" r="3.5" fill="#232C40" stroke="#D9472C" stroke-width="1.4"/><circle cx="29" cy="31" r="3.5" fill="#232C40" stroke="#D9472C" stroke-width="1.4"/>',
  'hat-bobble': '<path d="M8 27A13 15 0 0 1 32 27Q20 30 8 27Z" fill="#E8553A"/><path d="M8 23Q20 27 32 23L32 27Q20 31 8 27Z" fill="#F7EBD8"/><circle cx="20" cy="9" r="4" fill="#F7EBD8"/>',
  'hat-sun': '<path d="M4 25Q20 20 36 25Q20 31 4 25Z" fill="#EBC45E"/><path d="M12 24C12 16 15 12 20 12C25 12 28 16 28 24Q20 26 12 24Z" fill="#F2D27A"/><path d="M12 21Q20 23 28 21L28 24Q20 26 12 24Z" fill="#FF6B4A"/>',
  'hat-party': '<path d="M13 30L20 8L27 30Q20 32 13 30Z" fill="#FFC93C"/><path d="M15.2 23.5H24.8L26 27H14ZM17.6 16H22.4L23.4 19H16.6Z" fill="#FF6B4A"/><circle cx="20" cy="8" r="2.8" fill="#FF6B4A"/>',
  'decal-star': '<rect x="4" y="12" width="32" height="18" rx="6" fill="#2F3A52"/><path d="M20 14.5l1.6 3.4 3.7.5-2.7 2.5.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.5 3.7-.5Z" fill="#FFFFFF"/>',
  'decal-wave': '<rect x="4" y="12" width="32" height="18" rx="6" fill="#2F3A52"/><path d="M9 21q2.75-3.5 5.5 0t5.5 0 5.5 0 5.5 0" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>',
  'decal-bolt': '<rect x="4" y="12" width="32" height="18" rx="6" fill="#2F3A52"/><path d="M22 14L16 22.5H20L18 28L25 19.5H21L23 14Z" fill="#FFD66B"/>',
};
export function glyph(id) {
  const svg = svgEl('0 0 40 40', 'py-glyph');
  svg.innerHTML = GLYPHS[id] || '';
  return svg;
}
