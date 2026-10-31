// Pengu and the train, drawn with whatever they have on. Pengu is the pink penguin lamp sprite
// (img/pengu-lamp-192.webp); gear is drawn over it in the lamp photo's own coordinates (480 × 518,
// body centred at x 238.5) and mapped onto the 192 × 260 sprite. Decorative: screen readers skip it,
// and the text around it says what Pengu is wearing.

const NS = 'http://www.w3.org/2000/svg';
const SPRITE = 'img/pengu-lamp-192.webp';
const TO_SPRITE = 'matrix(0.932 0 0 0.932 -126.75 -109.04)';   // lamp photo → sprite
let uid = 0;

// The flippers, so a scarf, straps or jacket can pass behind them.
const FLIPPER_L = 'M160.5 220.5C165.5 226 166 241 158 250.5C154 255 149.5 258.5 146 258C143.2 257.6 142.6 254.6 143.6 251C145.4 243 147.6 232 151.8 224.5C154 220.6 157.6 218.6 160.5 220.5Z';
const FLIPPER_R = 'M316.5 220.5C311.5 226 311 241 319 250.5C323 255 327.5 258.5 331 258C333.8 257.6 334.4 254.6 333.4 251C331.6 243 329.4 232 325.2 224.5C323 220.6 319.4 218.6 316.5 220.5Z';

// ---------- Gear, in lamp-photo coordinates ----------
const BACKPACK_BEHIND = `
  <rect x="146" y="172" width="185" height="118" rx="34" fill="#23A08D"/>
  <rect x="152" y="178" width="173" height="20" rx="10" fill="#2BB5A0"/>`;

// An open navy coat: panels down both sides, gold-trimmed fronts and buttons, the white belly showing
// between them. Clipped to the body that shows above the brown base.
const JACKET = `
  <g clip-path="CLIP"><g mask="MASK">
    <path d="M140 234L214 246L224 270L214 300L210 372L140 372Z" fill="#2D3850"/>
    <path d="M337 234L263 246L253 270L263 300L267 372L337 372Z" fill="#2D3850"/>
    <path d="M214 246L224 270L214 300L210 372M263 246L253 270L263 300L267 372" fill="none" stroke="#E9A825" stroke-width="3" stroke-linejoin="round"/>
    <path d="M150 238Q181 246 213 247M327 238Q296 246 264 247" fill="none" stroke="#45547A" stroke-width="3" stroke-linecap="round"/>
  </g></g>
  <circle cx="202" cy="306" r="5" fill="#E9A825"/><circle cx="202" cy="306" r="2" fill="#C98A12"/>
  <circle cx="200" cy="330" r="5" fill="#E9A825"/><circle cx="200" cy="330" r="2" fill="#C98A12"/>
  <circle cx="275" cy="306" r="5" fill="#E9A825"/><circle cx="275" cy="306" r="2" fill="#C98A12"/>
  <circle cx="277" cy="330" r="5" fill="#E9A825"/><circle cx="277" cy="330" r="2" fill="#C98A12"/>`;

const SCARF = `
  <g mask="MASK">
    <path d="M149 220Q238.5 236 328 220L329 236Q238.5 252 148 236Z" fill="#FF6B4A"/>
    <path d="M180 226.5l-1.6 16M209 230l-1.2 16.5M268 230l1.2 16.5M297 226.5l1.6 16" stroke="#E04F33" stroke-width="5" stroke-linecap="round"/>
    <path d="M160 224Q238.5 239 317 224" fill="none" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  <path d="M262 240C266.5 258 264.5 276 270.5 296L286.5 291.5C281 273.5 283 255.5 278 238Z" fill="#FF6B4A"/>
  <path d="M272 297l-1.2 6.5M277.5 295.6l-.3 6.6M283 294l.8 6.4" stroke="#E04F33" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="270" cy="241" rx="9.5" ry="7.5" fill="#F25A3A"/>`;

const STRAPS = `
  <g mask="MASK">
    <path d="M160 200C175 225 186 262 184 300L195 300C197 262 188 222 172 196Z" fill="#2BB5A0"/>
    <path d="M317 200C302 225 291 262 293 300L282 300C280 262 289 222 305 196Z" fill="#2BB5A0"/>
  </g>
  <path d="M184 300h11v6a5.5 5.5 0 0 1-11 0ZM282 300h11v6a5.5 5.5 0 0 1-11 0Z" fill="#23A08D"/>
  <rect x="186" y="261" width="105" height="7" rx="3.5" fill="#23A08D"/>
  <rect x="231" y="257.5" width="15" height="14" rx="3.5" fill="#F2C94C"/>
  <rect x="235" y="261.5" width="7" height="6" rx="1.5" fill="#23A08D"/>`;

const HATS = {
  cap: `
    <path d="M170.7 168A95 158.5 0 0 1 306.3 168Q238.5 188 170.7 168Z" fill="#FFC93C"/>
    <path d="M238.5 121Q214 135 207 178M238.5 121Q263 135 270 178" fill="none" stroke="#E3A21A" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="212" cy="140" rx="11" ry="5" fill="#FFFFFF" opacity="0.45" transform="rotate(-32 212 140)"/>
    <circle cx="238.5" cy="121" r="5" fill="#E3A21A"/>
    <path d="M194 176Q238.5 208 283 176Q238.5 189 194 176Z" fill="#F0A818"/>`,
  conductor: `
    <path d="M193 172L187 132Q238.5 118 290 132L284 172Q238.5 182 193 172Z" fill="#2D3850"/>
    <path d="M187 132Q238.5 118 290 132Q238.5 142 187 132Z" fill="#45547A"/>
    <path d="M191.5 161Q238.5 171 285.5 161L284 172Q238.5 182 193 172Z" fill="#E9A825"/>
    <circle cx="238.5" cy="148" r="7.5" fill="#E9A825"/><circle cx="238.5" cy="148" r="3.2" fill="#2D3850"/>
    <path d="M195 172Q238.5 197 282 172Q238.5 184 195 172Z" fill="#161C2A"/>`,
  'hat-bobble': `
    <path d="M164.3 176A97 160 0 0 1 312.7 176Q238.5 198 164.3 176Z" fill="#E8553A"/>
    <path d="M172 146Q238.5 166 305 146" fill="none" stroke="#C93E26" stroke-width="7" stroke-linecap="round"/>
    <path d="M164 160Q238.5 182 313 160L312.7 176Q238.5 198 164.3 176Z" fill="#F7EBD8"/>
    <path d="M182 168.5v15M200 172v15.5M219 174v15.5M238.5 175v15.5M258 174v15.5M277 172v15.5M295 168.5v15" stroke="#E2D2B8" stroke-width="3" stroke-linecap="round"/>
    <circle cx="238.5" cy="116" r="14" fill="#F7EBD8"/><circle cx="233" cy="111" r="4" fill="#FFFFFF" opacity="0.7"/>`,
  'hat-sun': `
    <path d="M146 172Q238.5 148 331 172Q238.5 202 146 172Z" fill="#EBC45E" stroke="#D9AE45" stroke-width="2"/>
    <path d="M200 168C200 140 214 126 238.5 126C263 126 277 140 277 168Q238.5 176 200 168Z" fill="#F2D27A"/>
    <path d="M200.5 158Q238.5 166 276.5 158L277 168Q238.5 176 200 168Z" fill="#FF6B4A"/>
    <ellipse cx="218" cy="140" rx="8" ry="4" fill="#FFFFFF" opacity="0.45" transform="rotate(-30 218 140)"/>`,
  'hat-party': `
    <path d="M207 150L238.5 66L270 150Q238.5 160 207 150Z" fill="#FFC93C"/>
    <path d="M226 99.5L251 99.5L256.4 114L220.6 114ZM214.8 129.5L262.2 129.5L267 142.5L210 142.5Z" fill="#FF6B4A"/>
    <path d="M207 150Q238.5 160 270 150" fill="none" stroke="#E3A21A" stroke-width="3" stroke-linecap="round"/>
    <circle cx="238.5" cy="64" r="8.5" fill="#FF6B4A"/><circle cx="236" cy="61.5" r="2.5" fill="#FFFFFF" opacity="0.7"/>`,
};

function svgEl(viewBox, cls) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}

// Pengu wearing `look` (from state.look()). view: 'full' (the whole lamp, room above for hats) or
// 'bust' (head and shoulders, for avatars and toasts).
export function penguFigure(look, { cls = '', view = 'full' } = {}) {
  const id = `py-art-${++uid}`;
  const mask = `url(#${id}-m)`;
  const svg = svgEl(view === 'bust' ? '0 -50 192 214' : '0 -60 192 320', `py-art ${cls}`.trim());
  const front = [
    look.outfit ? JACKET : '',
    look.scarf ? SCARF : '',
    look.backpack ? STRAPS : '',
    look.hat ? HATS[look.hat] || '' : '',
  ].join('').replaceAll('MASK', mask).replaceAll('CLIP', `url(#${id}-b)`);
  svg.innerHTML = `
    <defs><mask id="${id}-m" maskUnits="userSpaceOnUse" x="0" y="0" width="480" height="520">
      <rect width="480" height="520" fill="#FFFFFF"/><path d="${FLIPPER_L}" fill="#000000"/><path d="${FLIPPER_R}" fill="#000000"/>
    </mask>
    <clipPath id="${id}-b"><path d="M147.8 260A91.38 154.5 0 0 1 329.2 260L319.6 290A82.6 70 0 0 1 154.4 290Z"/></clipPath></defs>
    ${look.backpack ? `<g transform="${TO_SPRITE}">${BACKPACK_BEHIND}</g>` : ''}
    <image href="${SPRITE}" x="0" y="0" width="192" height="260"/>
    <g transform="${TO_SPRITE}">${front}</g>`;
  return svg;
}

// ---------- The train ----------
export const PAINT_COLORS = {
  purple: { body: '#6C5CE7', dark: '#4B3CC4', light: '#A29BFE', ink: '#FFFFFF' },
  coral: { body: '#FF6B4A', dark: '#D9472C', light: '#FFB199', ink: '#FFFFFF' },
  sunny: { body: '#FFC93C', dark: '#D99A12', light: '#FFE6A0', ink: '#2B2628' },
  mint: { body: '#2BB5A0', dark: '#17877A', light: '#A5E8DD', ink: '#FFFFFF' },
  navy: { body: '#2D3850', dark: '#1D2537', light: '#5C6B8A', ink: '#FFFFFF' },
};

const DECALS = {
  'decal-star': (ink) => `<path d="M48 16.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.6 5.2-.7Z" fill="${ink}"/>`,
  'decal-wave': (ink) => `<path d="M33 25q3.7-5 7.5 0t7.5 0 7.5 0 7.5 0" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`,
  'decal-bolt': (ink) => `<path d="M50.5 15.5L42.5 26.5H48L45.5 33.5L54.5 21.5H49L51.5 15.5Z" fill="${ink === '#FFFFFF' ? '#FFE08A' : ink}"/>`,
};

const WHEELS = (a, b) => `
  <circle cx="${a}" cy="40" r="7" fill="#26262E"/><circle cx="${a}" cy="40" r="2.6" fill="#C9C2F5"/>
  <circle cx="${b}" cy="40" r="7" fill="#26262E"/><circle cx="${b}" cy="40" r="2.6" fill="#C9C2F5"/>`;

// Pengu's own car: paint, an optional decal on the side and an optional headlamp at the front.
export function carFigure(look, cls = 'py-car') {
  const c = PAINT_COLORS[look.paint] || PAINT_COLORS.purple;
  const svg = svgEl('0 0 96 48', cls);
  svg.innerHTML = `
    ${look.headlamp ? `<circle cx="95" cy="19" r="17" fill="#FFE08A" opacity="0.22"/><circle cx="95" cy="19" r="10" fill="#FFE08A" opacity="0.4"/>` : ''}
    <rect x="2" y="30" width="92" height="5" rx="2.5" fill="${c.dark}"/>
    <rect x="8" y="14" width="80" height="20" rx="7" fill="${c.body}"/>
    <rect x="8" y="14" width="80" height="6" rx="3" fill="${c.dark}"/>
    ${look.decal && DECALS[look.decal] ? DECALS[look.decal](c.ink) : `<rect x="18" y="24" width="60" height="3" rx="1.5" fill="${c.light}"/>`}
    ${look.headlamp ? `<rect x="85" y="14.5" width="9" height="9" rx="2.5" fill="#2D3850"/><circle cx="91.5" cy="19" r="3.3" fill="#FFE08A"/>` : ''}
    ${WHEELS(26, 70)}`;
  return svg;
}

// The extra car, coupled behind Pengu's car, carrying two crates.
export function extraCarFigure(look, cls = 'py-car2') {
  const c = PAINT_COLORS[look.paint] || PAINT_COLORS.purple;
  const svg = svgEl('0 0 76 48', cls);
  svg.innerHTML = `
    <rect x="66" y="29" width="12" height="3" rx="1.5" fill="#26262E"/>
    <rect x="14" y="5" width="20" height="13" rx="2" fill="#F2D27A"/><path d="M14 11.5h20M24 5v13" stroke="#D9AE45" stroke-width="1.6"/>
    <rect x="36" y="8" width="18" height="10" rx="2" fill="#F7EBD8"/><path d="M36 13h18M45 8v10" stroke="#E2D2B8" stroke-width="1.6"/>
    <rect x="2" y="30" width="72" height="5" rx="2.5" fill="${c.dark}"/>
    <rect x="6" y="18" width="64" height="16" rx="6" fill="${c.body}"/>
    <rect x="6" y="18" width="64" height="5" rx="2.5" fill="${c.dark}"/>
    ${WHEELS(20, 56)}`;
  return svg;
}

// Small tiles for the upgrade list: the item on its own.
const GLYPHS = {
  scarf: '<path d="M6 15Q20 20 34 15L34.5 22Q20 27 5.5 22Z" fill="#FF6B4A"/><path d="M24 21.5c1 5 .5 9 2 13.5l5-1.5c-1.5-4.5-1-8.5-2.5-13Z" fill="#FF6B4A"/><path d="M12 17.2l-.6 6M28 17.2l.6 6" stroke="#E04F33" stroke-width="2" stroke-linecap="round"/>',
  cap: '<path d="M7 24A14 13 0 0 1 33 24Q20 28 7 24Z" fill="#FFC93C"/><circle cx="20" cy="11" r="1.8" fill="#E3A21A"/><path d="M11 25Q20 33 29 25Q20 27.5 11 25Z" fill="#F0A818"/>',
  backpack: '<rect x="9" y="8" width="22" height="26" rx="7" fill="#2BB5A0"/><rect x="13" y="20" width="14" height="10" rx="3" fill="#23A08D"/><path d="M15 8a5 5 0 0 1 10 0" fill="none" stroke="#1E8C7C" stroke-width="2.4"/><rect x="18" y="22" width="4" height="3" rx="1" fill="#F2C94C"/>',
  conductor: '<path d="M10 27L8 14Q20 10 32 14L30 27Q20 30 10 27Z" fill="#2D3850"/><path d="M9.6 23.5Q20 26.5 30.4 23.5L30 27Q20 30 10 27Z" fill="#E9A825"/><circle cx="20" cy="18" r="2.6" fill="#E9A825"/><path d="M11 27Q20 34 29 27Q20 30 11 27Z" fill="#161C2A"/>',
  headlamp: '<circle cx="24" cy="20" r="12" fill="#FFE08A" opacity="0.35"/><rect x="9" y="13" width="14" height="14" rx="4" fill="#2D3850"/><circle cx="21" cy="20" r="4.5" fill="#FFE08A"/>',
  paint: '<circle cx="12" cy="15" r="5.5" fill="#FF6B4A"/><circle cx="24" cy="12" r="5.5" fill="#FFC93C"/><circle cx="29" cy="24" r="5.5" fill="#2BB5A0"/><circle cx="16" cy="27" r="5.5" fill="#6C5CE7"/>',
  car: '<rect x="4" y="12" width="12" height="9" rx="2" fill="#F2D27A"/><rect x="18" y="14" width="11" height="7" rx="2" fill="#F7EBD8"/><rect x="3" y="20" width="34" height="10" rx="4" fill="#6C5CE7"/><circle cx="11" cy="31" r="3.5" fill="#26262E"/><circle cx="29" cy="31" r="3.5" fill="#26262E"/>',
  'hat-bobble': '<path d="M8 27A13 15 0 0 1 32 27Q20 30 8 27Z" fill="#E8553A"/><path d="M8 23Q20 27 32 23L32 27Q20 31 8 27Z" fill="#F7EBD8"/><circle cx="20" cy="9" r="4" fill="#F7EBD8"/>',
  'hat-sun': '<path d="M4 25Q20 20 36 25Q20 31 4 25Z" fill="#EBC45E"/><path d="M12 24C12 16 15 12 20 12C25 12 28 16 28 24Q20 26 12 24Z" fill="#F2D27A"/><path d="M12 21Q20 23 28 21L28 24Q20 26 12 24Z" fill="#FF6B4A"/>',
  'hat-party': '<path d="M13 30L20 8L27 30Q20 32 13 30Z" fill="#FFC93C"/><path d="M15.2 23.5H24.8L26 27H14ZM17.6 16H22.4L23.4 19H16.6Z" fill="#FF6B4A"/><circle cx="20" cy="8" r="2.8" fill="#FF6B4A"/>',
  'decal-star': '<rect x="4" y="12" width="32" height="18" rx="6" fill="#6C5CE7"/><path d="M20 14.5l1.6 3.4 3.7.5-2.7 2.5.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.5 3.7-.5Z" fill="#FFFFFF"/>',
  'decal-wave': '<rect x="4" y="12" width="32" height="18" rx="6" fill="#6C5CE7"/><path d="M9 21q2.75-3.5 5.5 0t5.5 0 5.5 0 5.5 0" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>',
  'decal-bolt': '<rect x="4" y="12" width="32" height="18" rx="6" fill="#6C5CE7"/><path d="M22 14L16 22.5H20L18 28L25 19.5H21L23 14Z" fill="#FFE08A"/>',
};
export function glyph(id) {
  const svg = svgEl('0 0 40 40', 'py-glyph');
  svg.innerHTML = GLYPHS[id] || '';
  return svg;
}
