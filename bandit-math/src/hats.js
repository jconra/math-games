// THE HATS: the period hats a rider can wear, sold at the general store (src/shop.js; prices in its PRICES.hat), worn on
// foot and in the saddle (the shapes: src/actors/hatshapes.js), and drawn on the rider's card (hatSVG, used by the title
// screen's faceSVG and the store's rows). No three.js here, so the title screen can draw them without it.
//
// A rider's hat is saved with their look: rider.look.hatStyle (one of the ids below; an older save without one wears the
// cowboy hat, as before) and look.hat (on or off, the title screen's switch). The hats bought: rider.owned.hats.
//
//   HATS          [{ id, name, line, colour }]   colour: the hat's own colour (sRGB), or null for the outfit's own hat
//                 colour (the cowboy hat, as every rider started with)
//   hatOf(look)   the id of the hat a look wears (a known one; 'cowboy' when unset), or null with the hat off
//   hatColour(look, fallback)   the colour that hat is drawn in
//   hatSVG(id, colour)   the hat as SVG pieces for the title screen's 64 x 64 face picture (drawn over the head)
//   hatIcon(id, colour)  a small picture of the hat alone (a whole <svg>), for the store's rows
export const HATS = [
  { id: 'cowboy', name: 'Your old hat', line: 'The felt hat you rode in with. Free.', colour: null },
  { id: 'white', name: 'White hat', line: 'A cowboy hat in cream felt. Only the good guys wear white.', colour: '#e4dccb' },
  { id: 'straw', name: 'Straw hat', line: 'Woven straw with a flat brim. Cool in the summer sun.', colour: '#d9b86a' },
  { id: 'bowler', name: 'Bowler', line: 'A round city hat with a short brim, like the railroad men wear.', colour: '#4a3a2e' },
  { id: 'ranger', name: 'Ranger hat', line: 'A stiff flat brim and a crown pinched to a peak.', colour: '#9a8058' },
  { id: 'cattleman', name: 'Cattleman', line: 'A tall crown with a crease down the top. A cattle baron\'s hat.', colour: '#b7aa92' },
  { id: 'sombrero', name: 'Sombrero', line: 'The widest brim in the valley. Shade for you and your horse.', colour: '#c9a35e' },
];
const BY_ID = Object.fromEntries(HATS.map((h) => [h.id, h]));
export const hatById = (id) => BY_ID[id] || null;

export function hatOf(look) {
  if (!look || look.hat === false) return null;
  return BY_ID[look.hatStyle] ? look.hatStyle : 'cowboy';
}
export function hatColour(look, fallback = '#5b4630') {
  const h = BY_ID[hatOf(look) || 'cowboy'];
  return (h && h.colour) || fallback;
}

// colour helpers (sRGB hex strings)
function mix(a, b, t) {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
const okHex = (c, d) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : d);

// The hats on the face picture: the head is an oval centred at (32, 34), 10.3 wide and 11.8 tall each way, so its top
// is at about y = 22; every hat sits with its band at about y = 28 and its brim across the forehead.
export function hatSVG(id, colour) {
  const c = okHex(colour, '#5b4630');
  const band = mix(c, '#120c08', 0.55), lit = mix(c, '#fff3dc', 0.18), under = mix(c, '#120c08', 0.25);
  const s = [];
  switch (id) {
    case 'straw':   // a flat-topped crown and a wide flat brim, with a few woven lines
      s.push(`<path d="M21.5 28.5L22.4 16.5Q32 14.6 41.6 16.5L42.5 28.5Z" fill="${c}"/>`);
      s.push(`<path d="M22.2 19.5Q32 17.8 41.8 19.5M22 23Q32 21.4 42 23" stroke="${under}" stroke-width="0.7" fill="none" opacity="0.55"/>`);
      s.push(`<path d="M21.6 25.2H42.4L42.5 28.5H21.5Z" fill="${band}"/>`);
      s.push(`<path d="M3.5 29.2C8 31.6 19 32.4 32 32.4S56 31.6 60.5 29.2C59 31.8 50 33.8 32 33.8S5 31.8 3.5 29.2Z" fill="${under}"/>`);
      s.push(`<path d="M3.5 29.2C8 27.6 19 27.2 32 27.2S56 27.6 60.5 29.2C56 31 47 31.6 32 31.6S8 31 3.5 29.2Z" fill="${lit}"/>`);
      break;
    case 'bowler':  // a round dome and a short brim rolled up at the sides
      s.push(`<path d="M21.4 28.6C20.6 18.6 25 13.6 32 13.6S43.4 18.6 42.6 28.6Z" fill="${c}"/>`);
      s.push(`<path d="M25 17.5Q28 15.2 32 15" stroke="${lit}" stroke-width="1.1" fill="none" opacity="0.7"/>`);
      s.push(`<path d="M21.3 25.6H42.7L42.6 28.6H21.4Z" fill="${band}"/>`);
      s.push(`<path d="M16 26.6C18 30.6 24 32 32 32S46 30.6 48 26.6C46.5 28.6 41 29.6 32 29.6S17.5 28.6 16 26.6Z" fill="${under}"/>`);
      break;
    case 'ranger':  // a peaked crown with four dents and a stiff flat brim
      s.push(`<path d="M21.6 28.4L24.6 17.6Q28.5 15.4 30.6 10.6Q32 9.8 33.4 10.6Q35.5 15.4 39.4 17.6L42.4 28.4Z" fill="${c}"/>`);
      s.push(`<path d="M32 11.4V26M27 17.2L29.6 26M37 17.2L34.4 26" stroke="${under}" stroke-width="0.9" fill="none" opacity="0.6"/>`);
      s.push(`<path d="M21.8 25.4H42.2L42.4 28.4H21.6Z" fill="${band}"/>`);
      s.push(`<path d="M5.5 28.4H58.5L57.6 30.8C50 32 42 32.4 32 32.4S14 32 6.4 30.8Z" fill="${lit}"/>`);
      s.push(`<path d="M6.4 30.8C14 32 22 32.4 32 32.4S50 32 57.6 30.8L57 32.2C50 33.4 42 33.8 32 33.8S14 33.4 7 32.2Z" fill="${under}"/>`);
      break;
    case 'cattleman':   // a tall crown with a crease down the middle and a brim curled at the sides
      s.push(`<path d="M20.8 28C20.2 18.5 22.4 10.6 27.4 10.4Q32 13.4 36.6 10.4C41.6 10.6 43.8 18.5 43.2 28Z" fill="${c}"/>`);
      s.push(`<path d="M32 12.8C30.4 16 30 20.6 30.6 24.6" stroke="${band}" stroke-width="1.1" fill="none" opacity="0.55"/>`);
      s.push(`<path d="M21 24.2H43L43.2 28.2H20.8Z" fill="${band}"/>`);
      s.push(`<path d="M7 24.6C9.4 30.2 20 32.2 32 32.2S54.6 30.2 57 24.6C55 27.2 47 28.2 32 28.2S9 27.2 7 24.6Z" fill="${lit}"/>`);
      s.push(`<path d="M7 24.6C9.4 30.2 20 32.2 32 32.2S54.6 30.2 57 24.6C56.6 28.4 50 33.4 32 33.4S7.4 28.4 7 24.6Z" fill="${under}"/>`);
      break;
    case 'sombrero':   // a tall rounded cone and a very wide brim turned up all round its edge
      s.push(`<path d="M22.4 28.4C22 18 26 8.4 32 8.4S42 18 41.6 28.4Z" fill="${c}"/>`);
      s.push(`<path d="M22.3 24.4H41.7L41.6 28.4H22.4Z" fill="${band}"/>`);
      s.push(`<path d="M0.5 24.5C2 31 15 33.4 32 33.4S62 31 63.5 24.5C61 28.4 50 30.4 32 30.4S3 28.4 0.5 24.5Z" fill="${lit}"/>`);
      s.push(`<path d="M0.5 24.5C1 30 14 34.6 32 34.6S63 30 63.5 24.5L63.5 26.4C62 32 50 35.8 32 35.8S2 32 0.5 26.4Z" fill="${under}"/>`);
      s.push(`<path d="M3 26.5C8 30.6 18 31.6 32 31.6S56 30.6 61 26.5" stroke="${band}" stroke-width="0.9" fill="none" opacity="0.6"/>`);
      break;
    default: {   // the cowboy hat (and the white hat): a crown with a pinch, a band, and a wide brim curled up at the sides
      s.push(`<path d="M20.6 28C20 19.8 23 13.4 27.6 13.4Q32 16 36.4 13.4C41 13.4 44 19.8 43.4 28Z" fill="${c}"/>`);
      s.push(`<path d="M32 15.2C30 17.8 29.6 21.8 30.4 24.8" stroke="${band}" stroke-width="1.1" fill="none" opacity="0.6"/>`);
      s.push(`<path d="M20.9 24.2H43.1L43.4 28.2H20.6Z" fill="${band}"/>`);
      s.push(`<path d="M6.5 25C9 30.4 20 32.4 32 32.4S55 30.4 57.5 25C55.5 27.4 47 28.4 32 28.4S8.5 27.4 6.5 25Z" fill="${lit}"/>`);
      s.push(`<path d="M6.5 25C9 30.4 20 32.4 32 32.4S55 30.4 57.5 25C57 28.6 50 33.6 32 33.6S7 28.6 6.5 25Z" fill="${under}"/>`);
    }
  }
  return s.join('');
}
// the hat alone, a little picture for the store (the face picture's hat area, cropped)
export function hatIcon(id, colour) {
  const h = hatById(id);
  // (on a soft pale oval, so a dark hat still shows on the store's dark panel)
  return `<svg viewBox="0 6 64 32" width="56" height="28" aria-hidden="true" style="flex:none;display:block"><ellipse cx="32" cy="24" rx="31" ry="13" fill="#f3e6c8" opacity="0.16"/>${hatSVG(id, colour || (h && h.colour) || '#5b4630')}</svg>`;
}
