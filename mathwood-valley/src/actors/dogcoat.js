// DOG COATS: a dog's coat painted in code (plain data and arithmetic, no three.js: the tests read it as it is).
//
// The game's dogs carry their colours in their corners (vertex colours: no picture, one draw a dog). A coat is a
// recipe (COAT: colours and amounts), and every face of the dog is painted from it by where that face sits on the dog
// standing at rest (before any morph, so a marking stays on the same faces however the breed is reshaped), what part
// of the dog it is (from the bones that move it: head, ear, neck, chest, body, legs, paws, tail) and which way it faces.
// Face by face, so a marking's edge follows the model's own facets, the low-poly look the game's animals have.
//
// What a face can be, in the order they're laid on: the BASE colour; TAN points (eyebrows, cheeks, the lower legs,
// under the tail); a dark SADDLE over the back; PATCHES (big blobs of the dark colour, from smooth noise); the WHITE
// markings (blaze, muzzle, chest bib, collar, belly, socks, tail tip); a dark MASK over the muzzle and round the eyes;
// and the model's own eyes and nose (kept, the nose in the recipe's nose colour).
//
// FINE PATTERNS (spots, ticking, brindle, merle) are smaller than the faces (a dalmatian's spot is 2 to 3 cm, a face
// on these dogs 4 to 8), so painting faces would give a confetti of dark triangles. They come from a small pattern
// picture (256 x 256, made here as plain pixels, shared by every dog with the same pattern) laid over the faces by
// UVs worked out per face (each face's own flat projection, sized to the dog); the picture only darkens, multiplied
// over the face's colour, and a face it shouldn't touch (a Boston's white blaze, not brindled) points at a plain white
// spot of it. Still one draw a dog.
//
//   COAT / COAT_KEYS / fillCoat(c)          the recipe's fields, ranges and defaults
//   paintFace(f, coat) -> { rgb: [r, g, b] (linear 0..1), layer: 'base'|'tan'|'dark'|'white'|'mask'|'eye'|'nose'|'shine', pattern: bool }
//        f: one face, as dogkind.js measures it (see FACE below)
//   patternPixels(kind, { size, scale, colour, seed }) -> { data: Uint8Array RGBA, size, white: [u, v] }
//   hexToLinear('#rrggbb') -> [r, g, b] linear; linearToHex
//
// FACE (what paintFace reads): part ('head'|'ear'|'neck'|'chest'|'body'|'legF'|'legB'|'pawF'|'pawB'|'tail'),
//   h (height over the ground, withers = 1), u (along the body: rump 0, chest front 1), s (out to the side: middle 0,
//   flank 1), n: [x, y, z] (which way it faces), side (+1 the dog's left, -1 its right), feature (0, 1 eye/nose, 2 shine),
//   head: { u (back of the skull 0 .. nose 1), v (chin 0 .. top 1), x (middle 0 .. side 1), eyeU, eyeV, eyeX, stopU,
//   nose (0..1: how close to the nose's tip) }, along (tail and ears: root 0 .. tip 1), noise (0..1, smooth, for
//   patches), rand (0..1, this face's own), noseRule (the base has no nose of its own: paint one at the muzzle's front)

export const PATTERNS = [['none', 'None'], ['spots', 'Spots (dalmatian)'], ['ticking', 'Ticking (heeler)'], ['brindle', 'Brindle'], ['merle', 'Merle']];
export const PATTERN_ON = [['base', 'The base colour'], ['all', 'All of the coat'], ['white', 'The white only']];
export const EAR_COLOURS = [['coat', 'As the coat'], ['base', 'Base'], ['dark', 'Dark'], ['tan', 'Tan']];
// [kind, default, min, max, step, label, group]
export const COAT = {
  base:     ['color', '#1b1714', 0, 0, 0, 'Base', 'colours'],
  white:    ['color', '#f1ede4', 0, 0, 0, 'White', 'colours'],
  tan:      ['color', '#a5642c', 0, 0, 0, 'Tan', 'colours'],
  dark:     ['color', '#171311', 0, 0, 0, 'Dark (saddle, mask, patches)', 'colours'],
  nose:     ['color', '#121010', 0, 0, 0, 'Nose', 'colours'],
  shade:    ['range', 0.12, 0, 0.5, 0.01, 'Face to face shading', 'colours'],
  blaze:    ['range', 0, 0, 1, 0.01, 'Blaze (width)', 'white'],
  blazeTop: ['range', 0.6, 0, 1, 0.01, 'Blaze reaches up', 'white'],
  muzzle:   ['range', 0, 0, 1, 0.01, 'White muzzle', 'white'],
  chest:    ['range', 0, 0, 1, 0.01, 'Chest and throat', 'white'],
  collar:   ['range', 0, 0, 1, 0.01, 'Collar (round the neck)', 'white'],
  belly:    ['range', 0, 0, 1, 0.01, 'Belly', 'white'],
  socksF:   ['range', 0, 0, 1, 0.01, 'Front socks', 'white'],
  socksB:   ['range', 0, 0, 1, 0.01, 'Back socks', 'white'],
  tailTip:  ['range', 0, 0, 1, 0.01, 'Tail tip', 'white'],
  points:   ['range', 0, 0, 1, 0.01, 'Tan points', 'marks'],
  saddle:   ['range', 0, 0, 1, 0.01, 'Saddle (dark back)', 'marks'],
  mask:     ['range', 0, 0, 1, 0.01, 'Dark mask', 'marks'],
  eyePatch: ['range', 0, 0, 1, 0.01, 'Dark eye patches', 'marks'],
  patches:  ['range', 0, 0, 1, 0.01, 'Patches', 'marks'],
  patchSize:['range', 0.5, 0, 1, 0.01, 'Patch size', 'marks'],
  ears:     ['select', 'coat', 0, 0, 0, 'Ears', 'marks'],
  pattern:  ['select', 'none', 0, 0, 0, 'Fine pattern', 'pattern'],
  patternOn:['select', 'base', 0, 0, 0, 'Pattern over', 'pattern'],
  patternColour: ['color', '#141210', 0, 0, 0, 'Pattern colour', 'pattern'],
  patternAmount: ['range', 0.8, 0, 1, 0.01, 'Pattern strength', 'pattern'],
  patternScale:  ['range', 0.5, 0, 1, 0.01, 'Pattern size', 'pattern'],
  seed:     ['range', 7, 1, 99, 1, 'Seed', 'pattern'],
};
export const COAT_KEYS = Object.keys(COAT);
export const COAT_GROUPS = { colours: 'Colours', white: 'White markings', marks: 'Points, saddle, mask, patches', pattern: 'Fine pattern' };
const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function fillCoat(c = {}) {
  const out = {};
  for (const [k, [kind, def, lo, hi]] of Object.entries(COAT)) {
    const v = c[k];
    if (kind === 'color') out[k] = typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : def;
    else if (kind === 'select') {
      const opts = k === 'pattern' ? PATTERNS : k === 'patternOn' ? PATTERN_ON : EAR_COLOURS;
      out[k] = opts.some(([o]) => o === v) ? v : def;
    } else { const n = v === undefined || v === null || v === '' ? def : +v; out[k] = Number.isFinite(n) ? clamp(n, lo, hi) : def; }
  }
  return out;
}

// colours: the recipe's are as seen (sRGB hex); the corners hold linear light
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export function hexToLinear(hex) { const n = parseInt(String(hex).slice(1), 16); return [toLin((n >> 16 & 255) / 255), toLin((n >> 8 & 255) / 255), toLin((n & 255) / 255)]; }
export function linearToHex(rgb) { return '#' + rgb.map((c) => Math.round(clamp(toSrgb(c), 0, 1) * 255).toString(16).padStart(2, '0')).join(''); }

const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const LEGS = new Set(['legF', 'legB', 'pawF', 'pawB']);

// the white markings, each a yes or no for this face
function isWhite(f, c) {
  const H = f.head, n = f.n;
  // the blaze over the back of the skull (the neck's faces there)
  if (f.part === 'neck' && H && c.blaze > 0 && c.blazeTop > 0.5 && n[1] > 0.3) {
    const w = (0.14 + 0.3 * c.blaze) * (1 - 0.4 * ss(H.eyeU, H.eyeU - 0.8, H.u));
    if (Math.abs(H.x) < w && H.u > H.eyeU - (0.05 + 0.75 * c.blazeTop) * Math.max(0.3, H.eyeU + 0.4)) return true;
  }
  if (f.part === 'head' && H) {
    // the blaze: a stripe up the middle of the face, from the muzzle between the eyes, up over the forehead (blazeTop:
    // as far as between the ears); only on the front and the top of the head, not under it
    if (c.blaze > 0) {
      const w = 0.14 + 0.3 * c.blaze;                                   // (its half-width, a share of the head's half-width: at
                                                                        // least the faces on the middle line)
      const back = H.eyeU - (0.05 + 0.5 * c.blazeTop) * H.eyeU;         // (how far back over the skull it runs)
      // (it widens a little toward the muzzle)
      const wHere = w * (1 + 0.6 * ss(H.eyeU, H.stopU + 0.05, H.u));
      if (Math.abs(H.x) < wHere && H.u > back && H.v > H.eyeV - 0.12 && n[1] > -0.25) return true;
    }
    // the muzzle: everything in front of the stop (the lower jaw too), less of it the smaller the number
    if (c.muzzle > 0) {
      // (in front of the stop, below the eyes; the bridge of the nose up to the eyes only near the middle)
      const from = H.stopU + 0.02 + (1 - c.muzzle) * (1 - H.stopU) * 0.85;
      if (H.u > from && (H.v < H.eyeV - 0.1 || Math.abs(H.x) < H.eyeX * 0.5)) return true;
      // (the lower jaw and the chin, back under the head; the cheeks beside the mouth)
      if (c.muzzle > 0.5 && H.v < 0.3 && H.u > H.stopU - 0.4 * (c.muzzle - 0.5) * 2 && n[1] < 0.3) return true;
    }
    // the throat under the head
    if (c.chest > 0.6 && H.v < 0.2 && n[1] < -0.4 && H.u < H.stopU) return true;
  }
  if (f.part === 'neck') {
    if (c.collar > 0 && f.along > 0.55 - 0.5 * c.collar) return true;
    // the throat: the neck's front and underside, a band up its sides with a bigger chest
    if (c.chest > 0 && (n[1] < -0.15 || n[2] > 0.35) && Math.abs(n[0]) < 0.35 + 0.6 * c.chest) return true;
  }
  if (f.part === 'chest' || f.part === 'body') {
    // the bib: the front of the chest (facing forward), broad at the chest with a big number, and down between the
    // front legs (facing down, near the middle); not round the chest's sides
    if (c.chest > 0 && f.u > 0.8 - 0.25 * c.chest && n[2] > 0.3 - 0.2 * c.chest && f.s < 0.3 + 0.5 * c.chest && f.h < 1.02) return true;
    if (c.chest > 0.4 && n[1] < -0.6 && f.u > 0.78 - 0.3 * (c.chest - 0.4) && f.s < 0.12 + 0.25 * c.chest) return true;
    if (c.belly > 0 && n[1] < -0.45 + 0.3 * (1 - c.belly) && f.u > 0.45 - 0.4 * c.belly && f.s < 0.25 + 0.6 * c.belly) return true;
    if (c.collar > 0.7 && f.part === 'chest' && f.u > 0.92 && f.h > 0.75) return true;
  }
  if (LEGS.has(f.part)) {
    const front = f.part === 'legF' || f.part === 'pawF', k = front ? c.socksF : c.socksB;
    if (k > 0 && f.h < 0.02 + 0.9 * k * k + 0.2 * k) return true;

  }
  if (f.part === 'tail' && c.tailTip > 0 && f.along > 1 - c.tailTip) return true;
  return false;
}
// tan points: a spot over each eye, the cheeks and the sides of the muzzle, the lower legs, under the tail
function isTan(f, c) {
  const p = c.points; if (p <= 0) return false;
  const H = f.head;
  if (f.part === 'head' && H) {
    const dx = Math.abs(H.x) - H.eyeX, dv = H.v - (H.eyeV + 0.17), du = H.u - H.eyeU;
    if (Math.hypot(dx * 1.3, dv * 1.6, du * 1.4) < 0.07 + 0.08 * p) return true;   // (the eyebrow spots)
    if (H.u > H.stopU - 0.2 * p && H.v < H.eyeV - 0.05 && Math.abs(H.x) > 0.25) return true;   // (the cheeks, the muzzle's sides)
    if (p > 0.6 && H.u > H.stopU) return true;
  }
  if (LEGS.has(f.part) && f.h < 0.12 + 0.5 * p) return true;
  if (f.part === 'tail' && f.along < 0.25 && f.n[1] < -0.2) return true;
  if ((f.part === 'chest' || f.part === 'neck') && p > 0.5 && f.u > 0.85 && (f.n[2] > 0.3 || f.n[1] < -0.3)) return true;
  if (f.part === 'body' && p > 0.5 && f.u < 0.12 && f.n[1] < 0) return true;
  return false;
}
// the saddle: a dark blanket over the back, from the withers to the tail's root, down the sides with a bigger number
function isSaddle(f, c) {
  if (c.saddle <= 0) return false;
  if (f.part === 'body' || f.part === 'chest') return f.n[1] > 0.55 - 0.9 * c.saddle && f.h > 0.95 - 0.55 * c.saddle && f.u < 0.95 - 0.15 * c.saddle;
  if (f.part === 'neck') return c.saddle > 0.55 && f.n[1] > 0.4 && f.along < 0.4;
  if (f.part === 'tail') return c.saddle > 0.4 && f.along < 0.8 && f.n[1] > -0.3;
  return false;
}
function isMask(f, c) {
  const H = f.head; if (!H || f.part !== 'head') return false;
  if (c.mask > 0 && H.u > H.stopU - 0.12 - 0.25 * c.mask && (H.v < H.eyeV + 0.1 * c.mask || H.u > H.stopU)) return true;
  if (c.eyePatch > 0 && Math.hypot(Math.abs(H.x) - H.eyeX, (H.v - H.eyeV) * 1.2, (H.u - H.eyeU) * 1.2) < 0.1 + 0.2 * c.eyePatch && Math.abs(H.x) > 0.12) return true;
  return false;
}

export function paintFace(f, c) {
  // (a base without features of its own, the pug: the nose is the front of the muzzle's upper half)
  if (f.noseRule && f.part === 'head' && f.head && f.head.u > 0.93 && Math.abs(f.head.x) < 0.42 && f.head.v > 0.32 && f.n[2] > 0.3) return { rgb: hexToLinear(c.nose), layer: 'nose', pattern: false };
  if (f.feature === 1) {
    // the model's own dark bits: the nose (at the front of the head) takes the nose colour, the eyes stay as they are
    if (f.part === 'head' && f.head && f.head.nose > 0.8) return { rgb: hexToLinear(c.nose), layer: 'nose', pattern: false };
    return { rgb: null, layer: 'eye', pattern: false };
  }
  if (f.feature === 2) return { rgb: null, layer: 'shine', pattern: false };
  let layer = 'base';
  if (f.part === 'ear' && c.ears !== 'coat') layer = c.ears;
  else {
    if (isTan(f, c)) layer = 'tan';
    if (isSaddle(f, c)) layer = 'dark';
    if (c.patches > 0 && f.noise > 1 - 0.55 * c.patches && f.part !== 'pawF' && f.part !== 'pawB') layer = 'dark';
    if (isWhite(f, c)) layer = 'white';
    if (isMask(f, c)) layer = 'dark';
    if (f.part === 'ear' && isMask(f, c)) layer = 'dark';
  }
  const rgb = hexToLinear(layer === 'white' ? c.white : layer === 'tan' ? c.tan : layer === 'dark' ? c.dark : c.base);
  // a little light and dark from face to face (the facets catch it as fur would)
  const j = 1 + (f.rand - 0.5) * 2 * c.shade * (layer === 'white' ? 0.5 : 1);
  for (let i = 0; i < 3; i++) rgb[i] = clamp(rgb[i] * j, 0, 1);
  const on = c.pattern !== 'none' && c.patternAmount > 0 && (c.patternOn === 'all' ? true : c.patternOn === 'white' ? layer === 'white' : layer === 'base' || layer === 'tan');
  return { rgb, layer, pattern: on };
}

// ── the pattern picture ───────────────────────────────────────────────────────────────────────────────────────────
// (a small seeded random number maker, so a breed's pattern is the same every time)
export function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// tiling value noise on a size x size grid of cells
function tileNoise(R, cells) {
  const g = new Float32Array(cells * cells); for (let i = 0; i < g.length; i++) g[i] = R();
  return (x, y) => {   // x, y in 0..1 (wraps)
    const u = (((x % 1) + 1) % 1) * cells, v = (((y % 1) + 1) % 1) * cells, i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), at = (a, b) => g[((b % cells) + cells) % cells * cells + ((a % cells) + cells) % cells];
    return (at(i, j) * (1 - sx) + at(i + 1, j) * sx) * (1 - sy) + (at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx) * sy;
  };
}
// kind: spots | ticking | brindle | merle; the picture covers `scale` of the dog (see dogkind.js: one tile is this many
// withers-heights across); dark: how dark the pattern goes (0..1); colour: what it darkens toward
export function patternPixels(kind, { size = 256, colour = '#141210', amount = 0.8, seed = 7 } = {}) {
  const R = rng(seed + kind.length * 101), S = size, k = new Float32Array(S * S);   // k: how much pattern at each pixel (0..1)
  const n1 = tileNoise(R, 8), n2 = tileNoise(R, 32), n3 = tileNoise(R, 4);
  if (kind === 'spots') {
    // round spots of a few sizes, scattered so they rarely touch (a dart throw), soft by a pixel at the edge
    const spots = [];
    for (let t = 0; t < 4000 && spots.length < 70; t++) {
      const x = R() * S, y = R() * S, r = S * (0.022 + 0.03 * R() * R());
      if (spots.some((s) => { const dx = Math.min(Math.abs(s.x - x), S - Math.abs(s.x - x)), dy = Math.min(Math.abs(s.y - y), S - Math.abs(s.y - y)); return Math.hypot(dx, dy) < s.r + r + S * 0.03; })) continue;
      spots.push({ x, y, r, sq: 0.8 + 0.4 * R(), a: R() * Math.PI });
    }
    for (const s of spots) for (let dy = -Math.ceil(s.r * 1.4) - 1; dy <= s.r * 1.4 + 1; dy++) for (let dx = -Math.ceil(s.r * 1.4) - 1; dx <= s.r * 1.4 + 1; dx++) {
      const ca = Math.cos(s.a), sa = Math.sin(s.a), lx = (dx * ca + dy * sa) * s.sq, ly = (-dx * sa + dy * ca) / s.sq;
      const x = ((Math.round(s.x + dx) % S) + S) % S, y = ((Math.round(s.y + dy) % S) + S) % S;
      const d = Math.hypot(lx, ly) - s.r * (0.9 + 0.2 * n2(x / S, y / S));
      k[y * S + x] = Math.max(k[y * S + x], clamp(0.5 - d, 0, 1));
    }
  } else if (kind === 'ticking') {
    // flecks: many tiny dark hairs, thicker in places (a heeler's blue is black and white hairs mixed)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const m = n1(x / S, y / S); k[y * S + x] = R() < 0.18 + 0.4 * m ? 0.55 + 0.45 * R() : 0; }
    for (let t = 0; t < 40; t++) { const cx = R() * S, cy = R() * S, r = 2 + R() * 4; for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (Math.hypot(dx, dy) < r) { const x = ((Math.round(cx + dx) % S) + S) % S, y = ((Math.round(cy + dy) % S) + S) % S; k[y * S + x] = Math.max(k[y * S + x], 0.8); } }
  } else if (kind === 'brindle') {
    // dark stripes running up and down (v), wavy and broken, of varying width
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S, w = n1(u, v) * 0.6 + n3(u, v) * 0.5;
      const st = Math.sin((u * 14 + w * 1.6) * Math.PI * 2) * 0.5 + 0.5;
      const cut = 0.45 + 0.2 * n2(u, v);
      k[y * S + x] = ss(cut, cut + 0.12, st) * (0.7 + 0.3 * n2(u * 2, v * 2));
    }
  } else if (kind === 'merle') {
    // ragged dark patches of every size on the lighter coat
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S, m = n3(u, v) * 0.5 + n1(u, v) * 0.35 + n2(u, v) * 0.15;
      k[y * S + x] = ss(0.58, 0.62, m);
    }
  }
  // a plain white corner kept clear (a face the pattern mustn't touch points there)
  let wx = 0, wy = 0, best = -1;
  for (let y = 4; y < S - 4; y += 4) for (let x = 4; x < S - 4; x += 4) {
    let mx = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) mx = Math.max(mx, k[(y + dy) * S + x + dx]);
    if (mx === 0) { wx = x; wy = y; best = 0; break; }
    if (best < 0 || mx < best) { best = mx; wx = x; wy = y; }
  }
  if (best !== 0) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) k[(wy + dy) * S + wx + dx] = 0;
  const col = parseInt(colour.slice(1), 16), cr = col >> 16 & 255, cg = col >> 8 & 255, cb = col & 255;
  const data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    const a = k[i] * amount;
    data[i * 4] = Math.round(255 + (cr - 255) * a); data[i * 4 + 1] = Math.round(255 + (cg - 255) * a); data[i * 4 + 2] = Math.round(255 + (cb - 255) * a); data[i * 4 + 3] = 255;
  }
  return { data, size: S, white: [(wx + 0.5) / S, (wy + 0.5) / S], cover: k.reduce((s, x) => s + x, 0) / (S * S) };
}
