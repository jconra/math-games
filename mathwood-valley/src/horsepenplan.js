// THE PEN'S HORSES, worked out: what turns up in the pen behind the stable (src/horsepen.js draws them), how rare each
// coat is, how big and fast, what it's called, what the stable keeper says about it and what it costs. Plain data and
// plain functions, no page and no three.js, so the node tests read it.
//
// Dad (2026-10-27): "Some of the horses would be different (maybe random) ... so that you could get a surprise and keep
// coming back to check." Rarity: bay and chestnut common; palomino, buckskin and dun less so; dappled grey and black
// uncommon; the paints (tobiano, overo, sabino) rare. Buying keeps the whole coat (src/mounts.js), so a horse bought
// never changes. Prices like the stalls by size (src/catalog.js PEN), a little more for a rare coat.
//
//   POOL                 the coats, each { id, w (its weight: out of 100 in all), rarity, word, coat fields, names }
//   SIZES                [[size, weight]]: 0.95 / 1 / 1.05 / 1.10 / 1.15 at 25 / 25 / 25 / 15 / 10
//   rollPenHorse(seed, { taken }) -> { seed, coatId, rarity, recipe, size, gallop, mph, price, name, line, rare }
//                        taken: names not to use (the rider's own horses', the other pen horses')
//   penPrice(size, rarity), sizeWords(size)
//   PENPLAN              how many horses (by tier), the distances that make a new visit, how far off they sleep
import { LADDER, PEN, HORSES, mphOf } from './catalog.js';
import { fill } from './actors/horsecoats.js';

export const PENPLAN = {
  horses: { potato: 3, normal: 4, gaming: 4 },
  // a visit: the rider rides further than `away` from the pen (past every job in town: the range at the town's east end,
  // the farthest, is 121 m off since the pen went behind the stable on the main street; the store 66, the cabin and the
  // jobs board about 60, the lock boxes at the sheriff's 51), and the horses change the next time none of them can be
  // seen (src/sight.js): on the way back in, never in view
  away: 150,
  sleep: 220,          // m from the camera: past this the pen's horses stand still (not animated, not moved)
  inset: 1.7,          // m: how far inside the fence a horse's spot stays
  walk: [0.9, 1.3],    // m/s: an amble about the pen
  stand: [4, 11],      // s between one idle and the next
};

const BAY_NAMES = ['Ranger', 'Duke', 'Scout', 'Hickory'], CHESTNUT_NAMES = ['Rusty', 'Ginger', 'Cinnamon', 'Penny'], PAINT_NAMES = ['Patch', 'Domino', 'Calico', 'Freckles', 'Checkers'];
// the coats and how common each is (weights out of 100): common 60, less common 21, uncommon 13, rare 6
export const POOL = [
  { id: 'bay', w: 22, rarity: 'common', word: 'bay', base: '#7a3f20', points: 'black', mane: '#15100d', bloom: 0.5, names: BAY_NAMES },
  { id: 'darkBay', w: 10, rarity: 'common', word: 'dark bay', base: '#4c2617', points: 'black', mane: '#120e0c', sooty: 0.3, names: BAY_NAMES },
  { id: 'chestnut', w: 18, rarity: 'common', word: 'chestnut', base: '#a65a2a', mane: '#8a3f1a', muzzle: 0.45, bloom: 0.4, names: CHESTNUT_NAMES },
  { id: 'flaxen', w: 6, rarity: 'common', word: 'chestnut with a flaxen mane', base: '#a65a2a', mane: '#d6b47a', muzzle: 0.45, tips: 0.45, names: CHESTNUT_NAMES },
  { id: 'liver', w: 4, rarity: 'common', word: 'liver chestnut', base: '#4e2716', mane: '#3f1f12', muzzle: 0.5, names: CHESTNUT_NAMES },
  { id: 'palomino', w: 8, rarity: 'less', word: 'palomino', base: '#c99a52', mane: '#eee2c4', muzzle: 0.75, belly: 0.35, names: ['Sunny', 'Honey', 'Butterscotch', 'Nugget'] },
  { id: 'buckskin', w: 7, rarity: 'less', word: 'buckskin', base: '#c49a5c', points: 'black', mane: '#15100d', muzzle: 0.75, names: ['Buck', 'Dusty', 'Tumbleweed'] },
  { id: 'dun', w: 6, rarity: 'less', word: 'dun with a dark stripe down its back', base: '#b0946a', points: 'black', mane: '#1d1712', dorsal: 0.9, dorsalWidth: 0.032, barring: 0.6, muzzle: 0.8, names: ['Sandy', 'Taffy', 'Mesa'] },
  { id: 'grey', w: 7, rarity: 'uncommon', word: 'dappled grey', base: '#4a4544', mane: '#c9c6c2', grey: 0.7, dapples: 0.8, greyLegs: 0.7, belly: 0.1, sooty: 0, strands: 0.9, names: ['Smoke', 'Pearl', 'Misty', 'Silver'] },
  { id: 'black', w: 6, rarity: 'uncommon', word: 'black horse', base: '#1d1918', mane: '#110e0d', belly: 0.25, sooty: 0, shine: 1.3, names: ['Shadow', 'Raven', 'Jet'] },
  { id: 'tobiano', w: 2.5, rarity: 'rare', word: 'tobiano paint', pinto: 'tobiano', names: PAINT_NAMES },
  { id: 'overo', w: 1.5, rarity: 'rare', word: 'overo paint', pinto: 'overo', names: PAINT_NAMES },
  { id: 'sabino', w: 2, rarity: 'rare', word: 'sabino', pinto: 'sabino', names: PAINT_NAMES },
];
// a paint's colour under its white: a bay, a chestnut or a black
const UNDER = [['bay', 5], ['chestnut', 4], ['black', 2]];
export const SIZES = [[0.95, 25], [1, 25], [1.05, 25], [1.1, 15], [1.15, 10]];
const LADDER_NAMES = HORSES.map((h) => h.name.split(' ')[0]);   // (Jasper, Copper, Chester, ...: never a pen horse's)

function rng(seed) {   // (mulberry32: small, and well mixed from the first draw)
  let s = (seed * 2654435761) >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (R, list) => { let t = R() * list.reduce((a, x) => a + x[1], 0); for (const x of list) { if ((t -= x[1]) <= 0) return x[0]; } return list[list.length - 1][0]; };
const jitter = (R, hex, amt) => {   // a shade lighter or darker, a touch warmer or cooler
  const n = parseInt(hex.slice(1), 16), k = 1 + (R() - 0.5) * amt, w = (R() - 0.5) * amt * 0.5;
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.max(0, Math.min(255, Math.round(v * k * (1 + (i === 0 ? w : i === 2 ? -w : 0))))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};

export const penPrice = (size, rarity) => (PEN.bySize[size] ?? PEN.bySize[1]) + (PEN.extra[rarity] || 0);
export function sizeWords(size) {
  return size <= 0.96 ? 'On the small side' : size <= 1.01 ? 'A good everyday size' : size <= 1.06 ? 'A little bigger than most' : size <= 1.11 ? 'A big horse' : 'A very big horse';
}
const gallopAt = (size) => { const L = Object.values(LADDER).find((x) => x.kind === 'steed' && x.size === size); return L ? L.gallop : 13; };

// the white on its face and legs, in words: "a star and two white socks"
function markWords(r) {
  const face = { star: 'a star', stripe: 'a star and stripe', blaze: 'a blaze', bald: 'a bald face', snip: 'a snip' }[r.face] || (r.star ? 'a star' : '');
  const legs = Object.values(r.legs || {}).filter((l) => l !== 'none');
  const NUM = ['', 'one', 'two', 'three', 'four'];
  let leg = '';
  if (legs.length) {
    const kind = legs.includes('stocking') ? 'stocking' : legs.includes('sock') ? 'sock' : 'foot';
    leg = `${NUM[legs.length]} white ${kind === 'foot' ? (legs.length > 1 ? 'feet' : 'foot') : kind + (legs.length > 1 ? 's' : '')}`;
  }
  return [face, leg].filter(Boolean).join(' and ');
}

export function rollPenHorse(seed, { taken = [] } = {}) {
  const R = rng(seed + 7919);
  const cid = pick(R, POOL.map((c) => [c.id, c.w])), C = POOL.find((c) => c.id === cid);
  const { id, w, rarity, word, names, ...coat } = C;
  let r = fill({ ...coat });
  if (C.pinto) {   // (a paint: white over a bay, a chestnut or a black)
    const uid = pick(R, UNDER), u = POOL.find((c) => c.id === uid);
    const { id: _i, w: _w, rarity: _r, word: _wd, names: _n, ...under } = u;
    r = fill({ ...under, pinto: C.pinto, white: 0.3 + R() * 0.45, roan: 0.4 + R() * 0.5 });
    r.under = u.id;
  }
  r.base = jitter(R, r.base, 0.18); r.mane = jitter(R, r.mane, 0.12);
  r.sooty = (r.sooty ?? 0.15) * (0.5 + R()); r.belly = (r.belly ?? 0.45) * (0.6 + R() * 0.8);
  if (id === 'grey') { r.grey = 0.5 + R() * 0.45; r.dapples = 0.5 + R() * 0.45; r.dappleSize = 0.07 + R() * 0.05; }
  r.face = pick(R, [['none', 30], ['star', 26], ['stripe', 12], ['blaze', 18], ['snip', 6], ['bald', r.pinto === 'overo' ? 30 : 3]]);
  r.star = r.face === 'snip' && R() < 0.5;
  r.faceSize = 0.7 + R() * 0.6;
  const more = r.face === 'blaze' || r.face === 'bald' ? 0.2 : 0;
  const leg = (hind) => (R() < (hind ? 0.42 : 0.28) + more ? pick(R, [['coronet', 3], ['pastern', 4], ['sock', 6], ['stocking', 3]]) : 'none');
  r.legs = { FL: leg(false), FR: leg(false), HL: leg(true), HR: leg(true) };
  if (r.pinto === 'tobiano' && (r.face === 'bald' || r.face === 'blaze')) r.face = 'star';
  r.seed = 1 + Math.floor(R() * 9998);
  r.name = 'pen'; r.label = word; r.game = 'bay';
  const size = pick(R, SIZES), gallop = gallopAt(size);
  // a name for its coat that nobody here has yet (and never one of the stable's own)
  const no = new Set([...taken, ...LADDER_NAMES].map((n) => String(n).toLowerCase()));
  const free = names.filter((n) => !no.has(n.toLowerCase()));
  let name = free.length ? free[Math.floor(R() * free.length)] : names[Math.floor(R() * names.length)];
  for (let k = 2; no.has(name.toLowerCase()); k++) name = `${names[0]} ${['', '', 'II', 'III', 'IV', 'V'][k] || k}`;
  const article = /^[aeiou]/i.test(word) ? 'An' : 'A';
  const marks = markWords(r), under = r.under ? `, white over ${r.under === 'black' ? 'black' : r.under}` : '';
  const line = `${rarity === 'rare' ? 'Rare! ' : ''}${article} ${word}${under}${marks ? `${/ with /.test(word) ? ', and' : under ? ', with' : ' with'} ${marks}` : ''}. ${sizeWords(size)}.`;
  return { seed, coatId: id, rarity, recipe: r, size, gallop, mph: mphOf(gallop), price: penPrice(size, rarity), name, line, rare: rarity === 'rare' };
}
