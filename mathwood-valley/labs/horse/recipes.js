// COAT RECIPES: what a horse's coat is made of, as a handful of plain settings (coat.js turns them into the shader's
// numbers). The presets match the game's horses (src/player.js HORSE_LOOKS, src/catalog.js) plus three pintos, and
// randomCoat(seed) makes a believable coat of its own from a seed.
//
//   base       the body colour                      points    'black' (black legs, ear tips) or 'none'
//   mane       the mane and tail                    belly     how much lighter the belly and inner legs are (0..1)
//   sooty      a darker top line (0..1)             muzzle    how dark the muzzle and eye skin are (0..1)
//   bloom      faint dapples on the hip and shoulder (0..1), for a bay or chestnut
//   grey       greying: 0 none .. 1 white           dapples   round dapples in the grey (0..1), dappleSize (m)
//   greyLegs   how much darker a grey's legs stay
//   face       'none' | 'star' | 'stripe' | 'blaze' | 'bald' | 'snip'; star: also a star; faceSize; ragged (edges)
//   legs       { FL, FR, HL, HR }: 'none' | 'coronet' | 'pastern' | 'sock' | 'stocking'
//   pinto      'none' | 'tobiano' | 'overo' | 'sabino'; white (how much, 0..1); roan (sabino roaning, 0..1)
//   maneLength, tailLength   a share of the longest the hair cards reach (the tail: about the hocks)
//   seed       which version of the pattern and the markings' edges
//   game       which of the game's horses it stands in for (the old model, to compare)

export const FACES = [['none', 'None'], ['star', 'Star'], ['stripe', 'Star and stripe'], ['blaze', 'Blaze'], ['bald', 'Bald face'], ['snip', 'Snip']];
export const LEGS = [['none', 'None'], ['coronet', 'Coronet'], ['pastern', 'Pastern'], ['sock', 'Sock'], ['stocking', 'Stocking']];
export const PINTOS = [['none', 'None'], ['tobiano', 'Tobiano'], ['overo', 'Overo'], ['sabino', 'Sabino']];
const NO_LEGS = { FL: 'none', FR: 'none', HL: 'none', HR: 'none' };

const BASE = { mane: '#16110e', points: 'none', belly: 0.6, sooty: 0.25, bloom: 0, muzzle: 0.7, grey: 0, dapples: 0, dappleSize: 0.1, greyLegs: 0.6,
  face: 'none', faceSize: 1, ragged: 0.5, star: false, legs: NO_LEGS, pinto: 'none', white: 0.5, roan: 0.6, seed: 1,
  bump: 1, streakColor: 1, sheen: 1, shine: 1, roots: 0.35, tips: 0.3, strands: 0.5, maneShine: 0.6, maneLength: 0.85, tailLength: 0.9 };

export const PRESETS = {
  bay: { label: 'Bay', game: 'bay', base: '#74361b', points: 'black', mane: '#15100d', face: 'star', faceSize: 0.7, sooty: 0.35, bloom: 0.6, seed: 3 },
  chestnut: { label: 'Chestnut', game: 'chestnut', base: '#a65a2a', mane: '#d6b47a', bloom: 0.5, face: 'blaze', legs: { FL: 'none', FR: 'none', HL: 'sock', HR: 'sock' },
    muzzle: 0.45, roots: 0.25, tips: 0.45, sooty: 0.12, seed: 11 },
  palomino: { label: 'Palomino', game: 'palomino', base: '#c99a52', mane: '#eee2c4', face: 'snip', muzzle: 0.75, belly: 0.35, sooty: 0.1, roots: 0.2, tips: 0.25, seed: 5 },
  white: { label: 'White', game: 'white', base: '#4a4544', mane: '#d9d6d2', grey: 0.88, dapples: 0.7, dappleSize: 0.09, greyLegs: 0.6,
    muzzle: 0.85, belly: 0.1, sooty: 0, face: 'none', strands: 0.9, roots: 0.45, tips: 0.25, seed: 7 },
  midnight: { label: 'Midnight', game: 'midnight', base: '#1d1918', mane: '#110e0d', points: 'none', face: 'star', faceSize: 0.6, belly: 0.25, sooty: 0,
    muzzle: 0.5, shine: 1.3, seed: 9 },
  tobiano: { label: 'Tobiano', game: 'bay', base: '#74361b', points: 'black', mane: '#15100d', pinto: 'tobiano', white: 0.3, face: 'star', faceSize: 0.8, seed: 21 },
  overo: { label: 'Overo', game: 'chestnut', base: '#8c4019', mane: '#6e3214', pinto: 'overo', white: 0.55, face: 'bald', muzzle: 0.5, seed: 4 },
  sabino: { label: 'Sabino', game: 'bay', base: '#4a2616', points: 'black', mane: '#120e0c', pinto: 'sabino', white: 0.3, roan: 0.7, face: 'blaze', faceSize: 1.15, seed: 8 },
};
export const PRESET_ORDER = ['bay', 'chestnut', 'palomino', 'white', 'midnight', 'tobiano', 'overo', 'sabino', 'random'];

export function recipe(name, seed) {
  if (name === 'random') return randomCoat(seed ?? 1);
  const p = PRESETS[name] || PRESETS.bay;
  return { ...BASE, ...p, legs: { ...NO_LEGS, ...(p.legs || {}) }, name };
}
export function fill(r) { return { ...BASE, ...r, legs: { ...NO_LEGS, ...(r.legs || {}) } }; }

// ── a believable random coat ──────────────────────────────────────────────────────────────────────────────────────────
function rng(seed) {   // (mulberry32: small, and well mixed from the first draw even for seeds 1, 2, 3...)
  let s = (seed * 2654435761) >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (R, list) => { let t = R() * list.reduce((s, x) => s + x[1], 0); for (const x of list) { if ((t -= x[1]) <= 0) return x[0]; } return list[0][0]; };
const jitter = (R, hex, amt) => {   // a shade lighter or darker, a touch warmer or cooler
  const n = parseInt(hex.slice(1), 16), k = 1 + (R() - 0.5) * amt, w = (R() - 0.5) * amt * 0.5;
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.max(0, Math.min(255, Math.round(v * k * (1 + (i === 0 ? w : i === 2 ? -w : 0))))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};
// the coat colours, how common each is (weights), and what goes with them
const COLOURS = {
  bay: { w: 30, base: '#74361b', bloom: 0.5, points: 'black', mane: '#15100d' },
  darkBay: { w: 14, base: '#4c2617', points: 'black', mane: '#120e0c', sooty: 0.3 },
  chestnut: { w: 24, base: '#a65a2a', mane: '#8a3f1a', muzzle: 0.45, bloom: 0.4 },
  flaxenChestnut: { w: 8, base: '#a65a2a', mane: '#d6b47a', muzzle: 0.45, tips: 0.45 },
  liver: { w: 5, base: '#4e2716', mane: '#3f1f12', muzzle: 0.5 },
  palomino: { w: 6, base: '#c99a52', mane: '#eee2c4', muzzle: 0.75 },
  buckskin: { w: 6, base: '#c49a5c', points: 'black', mane: '#15100d', muzzle: 0.75 },
  black: { w: 6, base: '#1d1918', mane: '#110e0d', belly: 0.25, sooty: 0 },
  grey: { w: 9, base: '#4a4544', mane: '#c9c6c2', grey: 0.7, dapples: 0.8, greyLegs: 0.7, belly: 0.1, sooty: 0, strands: 0.9 },
};
export function randomCoat(seed) {
  const R = rng(seed + 101);
  const key = pick(R, Object.entries(COLOURS).map(([k, c]) => [k, c.w]));
  const C = COLOURS[key];
  const r = { ...BASE, ...C, base: jitter(R, C.base, 0.22), mane: jitter(R, C.mane, 0.15), seed, name: 'random', label: 'Random', game: key === 'grey' ? 'white' : key === 'palomino' ? 'palomino' : key === 'black' ? 'midnight' : /chestnut|liver/.test(key) ? 'chestnut' : 'bay' };
  delete r.w;
  if (key === 'grey') { r.grey = 0.45 + R() * 0.55; r.dapples = R() < 0.8 ? 0.4 + R() * 0.5 : 0; r.dappleSize = 0.07 + R() * 0.05; }
  r.sooty = (r.sooty ?? 0.15) * (0.5 + R());
  r.belly = (r.belly ?? 0.45) * (0.6 + R() * 0.8);
  r.face = pick(R, [['none', 30], ['star', 26], ['stripe', 12], ['blaze', 18], ['snip', 6], ['bald', 4]]);
  r.star = r.face === 'snip' && R() < 0.5;
  r.faceSize = 0.7 + R() * 0.6;
  // hind legs are more often white than front legs, and a horse with a big face marking often has more white legs
  const more = r.face === 'blaze' || r.face === 'bald' ? 0.2 : 0;
  const leg = (hind) => (R() < (hind ? 0.42 : 0.28) + more ? pick(R, [['coronet', 3], ['pastern', 4], ['sock', 6], ['stocking', 3]]) : 'none');
  r.legs = { FL: leg(false), FR: leg(false), HL: leg(true), HR: leg(true) };
  if (key !== 'grey' && R() < 0.22) {
    r.pinto = pick(R, [['tobiano', 4], ['overo', 3], ['sabino', 3]]);
    r.white = 0.3 + R() * 0.5; r.roan = 0.4 + R() * 0.5;
    if (r.pinto === 'overo' && R() < 0.6) r.face = 'bald';
    if (r.pinto === 'tobiano' && (r.face === 'bald' || r.face === 'blaze')) r.face = 'star';
  }
  return r;
}
