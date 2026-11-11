// THE GROW POD: a small round window in a ship's wall into a turning hydroponic garden, a rotary garden seen end-on, built
// from real plants behind a lightly frosted pane. From the game's maker (2026-11-09 and 10): "it would be cool to put at
// least one of these plant growing pods in there. Maybe it could be a bit blurry like it has frosted glass over it, with
// green plants showing." "Maybe the plant chamber could be slowly spinning the plants." "The plants have thier roots
// around the circumference of the cylinder ... more interesting looking plants ... and for the 3d effect as you walk by."
// "The rotary garden looks awesome".
// WHAT IS IN IT: a green drum behind the glass, its axle pointing straight out of the wall, turning slowly about it. Four
// rings of seven plants, one behind another, are rooted round its inside (a pale cup, pale roots along the wall) and grow
// in toward a lamp down the middle: lettuce, frilly lettuce, basil, chard, a little vine with small white flowers. The
// lamp is a soft white-green glow. The near ring is sharp, the deeper ones paler and softer; walking past, the near
// leaves slide over the deeper ones and the glass's edge hides and shows the rings behind.
// A WALL fitting (kit/shipparts/cabin/ship.js): x along the wall, centred; z = 0 on the wall line, its back on the wall's
// face (FACE), facing +z; y = 0 the deck. The frame stands 3.4 cm out of the face and the pane sits 2 cm down inside it.
// The drum reaches back behind the glass about as far as the glass is wide (2.05 half-sizes: 31 cm for a 30 cm pod), but
// nothing is cut into the wall: kit/growglass.js draws it so the wall never hides it, and none of it shows anywhere but
// through the glass.
//   growPod(p, o)
//     o.size    the glass, metres across (0.30; 0.30 to 0.45 suits a ship's wall): a round one its diameter, an
//               eight-sided one across its flats. The frame adds 4.3 cm all round.
//     o.shape   'round' (as the game's maker picked it) or 'oct' (eight-sided: the ships' own shape)
//     o.n       how many in a row (1), o.gap between their frames (0.04); a row stands on one shallow back plate
//               (o.plate false: none; o.back its surface: dark; o.backTrim: a thin line of another surface all round
//               it, none unless asked for. back: 'white', backTrim: 'black' is a plate in the wall's own panel colour
//               with a dark trim). o.plate true gives a single pod a plate too (eight-sided): it covers a wall seam or a
//               panel's edge under the pod
//     o.frost   how frosted the pane is: 'light', 'medium', 'heavy'
//     o.move    true (the drum turns) or false (still). Only the drum and its plants move; the movement is worked out on
//               the graphics card from the kit's one clock (materials.js U.time): nothing is done for it each frame.
//     o.turn    seconds for one turn (GROW.turn: 60): anticlockwise as seen; negative turns it clockwise
//     o.sway    how far the leaves sway (0: still, the default; 1 a little)
//     o.tint    the lamp's colour, always near white: a breath of 'pink' (the default) or 'warm', or a number between
//               (0 warm .. 1 pink); o.lampGlow its glow in the frost (1)
//     o.shade   how lit the places furthest from the lamp are (0.35)
//     o.y       the height of its middle (1.33)
//     o.glow    this pod's own brightness (1), times GROW.glow (kit/growglass.js: THE number that sets how bright every
//               pod is)
//     o.light   the light it throws on what is near it (0.2: a soft green-white, baked, reaching 1.3 m; 0: none)
//     o.pool    the same light as a small real-time pool on the wall round it (0.1, reaching 1.1 m; 0: none): a wall
//               panel has too few corners for the baked light to show on it. A row has ONE pool for all its pods (a
//               room shows only its strongest few pools)
//     o.clamps  how many clamps hold the frame (4, on the diagonals; 0: none)
//     o.trim    the frame's surface (black: the satin charcoal of the ships' ribs and rims), o.clamp the clamps' (the
//               mess's gunmetal: a named surface the cabin's looks would turn into the frame's own black)
//     o.seed    which garden (1): its plants grown another way (other greens, other leaves, turned another way)
//     o.rings   how many rings of plants, from the glass back (4; 3 leaves out the deepest, about 850 triangles less,
//               the nearer three exactly as they were)
//   growPodSize(o)   [w, h, d]: the whole fitting's size on the wall (frames and back plate), and how far it stands out
// COST (counted in a built room). The frame 144 triangles round, 48 eight-sided; each clamp 38; the pane 22 round, 6
// eight-sided; a back plate 22, its trim 22 more. The inside 3,488: drum 72, 28 feet 20 each (a cup and two roots),
// plants about 2,856 (about 100 a plant; the lamp is a glow, no triangles). So 3,806 a round pod, 3,694 an eight-sided
// one. The frame, clamps and plate are the cabin's 'solid' material (no new draw); the insides of all the pods in a
// room's batch are ONE draw ('podIn') and their panes another ('podPane'), with no texture.
// THE MATERIALS 'podIn' and 'podPane' are in kit/materials.js's list.
import * as THREE from 'three';
import { shape, relief, solid, RINGS, add } from '../../bevel.js';
import { MAT_KEYS } from '../../materials.js';
import { GROW, FROST, INSIDE } from '../../growglass.js';
import { FACE } from './ship.js';
import { GUN, pool, strip } from './mess.js';

const PI = Math.PI, TAU = PI * 2, OCT = 1 - Math.SQRT1_2;   // (OCT: a regular octagon's corner cut, as a share of its width)
// the frame's section, from the wall in to the glass: the outer bevel's width, the flat top's, the inner slope's; how
// far the top stands out of the wall; the level the inner slope comes down to (where the glass is)
// (a ship wall's panels stand up to 1 cm out of its face in places: the glass is kept in front of them)
const RIM = { out: 0.007, top: 0.02, in: 0.016, proud: 0.034, glass: 0.0145 }, BAND = RIM.out + RIM.top + RIM.in;
const RINGS_RIM = [{ inset: 0, depth: RIM.proud, bevel: RIM.out }, { inset: RIM.top, depth: RIM.glass, bevel: RIM.in }];
// a back plate: how far it stands out (clear of the wall's own raised panels, which would show through a thinner one),
// how far it shows round the frames
const PLATE = 0.013, PLATE_EDGE = 0.035, PLATE_TRIM = 0.008;   // (PLATE_TRIM: how wide a trim shows round a plate)
const SHADE = 0.35;                         // how lit the places furthest from the lamp are
const SEG = 24;                             // a round pod's sides
const LIGHT = [0.72, 1.0, 0.74];            // the light a pod throws (not so green or so white that a cabin's look re-tones it)
const rand = (seed) => { let a = (Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// a round frame: the eight-sided one's section turned round a circle of radius r (smooth round, a crisp edge between
// its three bands), on z = 0 facing +z
function roundFrame(r) {
  const prof = [[r + BAND, 0], [r + BAND - RIM.out, RIM.proud], [r + RIM.in, RIM.proud], [r, RIM.glass]], pos = [], nor = [], uv = [], ix = [];
  for (let b = 0; b < prof.length - 1; b++) {
    const [r0, z0] = prof[b], [r1, z1] = prof[b + 1], l = Math.hypot(r1 - r0, z1 - z0), nr = (z1 - z0) / l, nz = (r0 - r1) / l, base = pos.length / 3;
    for (let i = 0; i < SEG; i++) {
      const a = i / SEG * TAU, c = Math.cos(a), s = Math.sin(a);
      pos.push(r0 * c, r0 * s, z0, r1 * c, r1 * s, z1); nor.push(nr * c, nr * s, nz, nr * c, nr * s, nz); uv.push(r0 * c, r0 * s, r1 * c, r1 * s);
    }
    for (let i = 0; i < SEG; i++) { const a0 = base + i * 2, a1 = base + ((i + 1) % SEG) * 2; ix.push(a0, a1, a1 + 1, a0, a1 + 1, a0 + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix); return g;
}
// the glass: a flat eight-sided or round plate on z = 0 facing +z, `over` bigger all round than its opening (it tucks
// under the frame's lip); its uv the place on the glass (-1 .. 1 across the opening of half-size hs)
function glassPlate(round, hs, over) {
  const pts = [], r = hs + over;
  if (round) for (let i = 0; i < SEG; i++) { const a = i / SEG * TAU; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  else { const t = r * Math.tan(PI / 8); pts.push([-t, -r], [t, -r], [r, -t], [r, t], [t, r], [-t, r], [-r, t], [-r, -t]); }
  const pos = [], nor = [], uv = [], ix = [];
  for (const [x, y] of pts) { pos.push(x, y, 0); nor.push(0, 0, 1); uv.push(x / hs, y / hs); }
  for (let i = 1; i < pts.length - 1; i++) ix.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix); return g;
}
const fill = (g, name, val) => { const n = g.attributes.position.count, a = new Float32Array(n * 4); for (let i = 0; i < n; i++) a.set(val, i * 4); g.setAttribute(name, new THREE.BufferAttribute(a, 4)); };

// ── a rotary's inside: REAL plants round a turning drum, seen end-on (kit/growglass.js podInside draws it) ──────────
// In the pod's own frame: x right, y up, z out of the glass, the glass's middle 0; the drum's axle is the z line through
// it. A white drum a little wider than the glass, its back about as deep as the glass is wide; four rings of plants one
// behind another, each rooted at the drum's wall (a pale cup, pale roots along the wall) and growing in toward a white
// lamp down the middle, by turns: a lettuce, a frilly lettuce, a basil, a broad-leaved chard, a little vine with white
// flowers. Green and white only. Each leaf is a folded, drooping blade of 12 triangles in one of several greens (about
// 60 to 120 triangles a plant, 28 plants).
const lin = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255].map((c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); };
const GREENS = ['#3f7a2a', '#4d8c34', '#5f9e3c', '#6aa84a', '#2f6b2e', '#7ab650', '#3a6e3a', '#86b95a'].map(lin);
const RIB = lin('#d2e6a0'), STEM = lin('#5d7f35');
const RINGS_Z = [-0.25, -0.7, -1.15, -1.6], PER = 7;   // (how deep each ring of plants is, half-sizes; plants a ring)
function insideOf(hs, R, rings = RINGS_Z.length) {
  // (u: the unit the sizes are in: the glass's half-size for the drum, more for the plants)
  const I = INSIDE, P = [], L = [], C = [], ix = [];
  let u = hs;
  // (a corner: placed by T, marked with what it is: 0 still, 1 turning with the drum, 2 the lamp; a leaf's corners
  // carry how far out along it they are)
  let T = (q) => q, kind = 0;
  const v = (q, col, leafy = 0) => { const w = T(q); P.push(w[0], w[1], w[2]); L.push(w[0], w[1], w[2], kind); C.push(col[0], col[1], col[2], leafy); return P.length / 3 - 1; };
  const tri = (a, b, c) => ix.push(a, b, c), quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  const prism = (pts, r, col, sides = 3) => { let prev = null; for (const q of pts) { const ring = []; for (let k = 0; k < sides; k++) ring.push(v([q[0] + r * Math.cos(k * TAU / sides), q[1], q[2] + r * Math.sin(k * TAU / sides)], col)); if (prev) for (let k = 0; k < sides; k++) quad(prev[k], prev[(k + 1) % sides], ring[(k + 1) % sides], ring[k]); prev = ring; } };
  const green = (lift = 0) => { const g = GREENS[Math.floor(R() * GREENS.length)], k = 0.9 + 0.3 * R() + lift; return g.map((c) => Math.min(1, c * k)); };
  // a leaf from its stem end b, pointing along yaw, `pitch` above level (level: across the plant's own up), len x wid,
  // its tip drooping, folded along its rib
  const leaf = (b, yaw, pitch, len, wid, droop, col, fold = 0.25) => {
    const dx = Math.sin(yaw), dz = Math.cos(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), rib = col.map((c, i) => c + (RIB[i] - c) * 0.18);
    const mid = (t) => [b[0] + dx * len * t * cp, b[1] + len * t * sp - droop * len * t * t, b[2] + dz * len * t * cp];
    const M = [0, 0.25, 0.5, 0.75, 1].map((t) => v(mid(t), rib, 0.05 + 0.95 * t));
    const side = (sg) => [0.25, 0.5, 0.75].map((t, k) => { const m = mid(t), w = wid * [0.8, 1.0, 0.68][k] * 0.5; return v([m[0] + dz * w * sg, m[1] - fold * w, m[2] - dx * w * sg], col, 0.05 + 0.95 * t); });
    for (const S of [side(1), side(-1)]) { tri(M[0], S[0], M[1]); tri(M[1], S[0], S[1]); tri(M[1], S[1], M[2]); tri(M[2], S[1], S[2]); tri(M[2], S[2], M[3]); tri(M[3], S[2], M[4]); }
  };
  // a small round white blossom at c, a shallow six-sided cup facing along the plant's own up, its middle cream
  const blossom = (c, r) => { const m = v(c, lin('#e9e6c6')), ring = []; for (let k = 0; k < 6; k++) { const t = k / 6 * TAU; ring.push(v([c[0] + r * Math.cos(t), c[1] + 0.3 * r, c[2] + r * Math.sin(t)], lin('#f5f7f2'))); } for (let k = 0; k < 6; k++) tri(m, ring[k], ring[(k + 1) % 6]); };
  // the plant's foot at the drum's wall: a pale cup, and two pale roots lying along the wall from it (flat strips)
  const PALE = lin('#e6e3cf'), CUP = [lin('#a9b3ac'), lin('#d3dad4')];
  const foot = () => {
    const a = [], b = []; for (let k = 0; k < 6; k++) { const t = k / 6 * TAU, c = Math.cos(t), s = Math.sin(t); a.push(v([0.045 * u * c, -0.06 * u, 0.045 * u * s], CUP[0])); b.push(v([0.065 * u * c, 0.01 * u, 0.065 * u * s], CUP[1])); }
    for (let k = 0; k < 6; k++) quad(a[k], a[(k + 1) % 6], b[(k + 1) % 6], b[k]);
    for (let k = 0; k < 2; k++) {
      const ang = R() * TAU, l = (0.14 + 0.08 * R()) * u, dx = Math.cos(ang), dz = Math.sin(ang), w = 0.008 * u;
      const pts = [[0, -0.05 * u, 0], [dx * l * 0.5, -0.07 * u, dz * l * 0.5], [dx * l + dz * 0.02 * u, -0.075 * u, dz * l - dx * 0.02 * u]];
      let prev = null; for (const p of pts) { const pair = [v([p[0] - dz * w, p[1], p[2] + dx * w], PALE), v([p[0] + dz * w, p[1], p[2] - dx * w], PALE)]; if (prev) quad(prev[0], prev[1], pair[1], pair[0]); prev = pair; }
    }
  };
  const PLANT = [
    // a lettuce: a loose head of broad leaves, the outer ones low, the young middle ones upright and paler
    () => { let yaw = R() * TAU; for (let k = 0; k < 9; k++) { const t = k / 8, l = (0.4 - 0.14 * t) * u; yaw += 2.4; leaf([0, 0, 0], yaw, 0.35 + 0.85 * t, l, l * 0.68, 0.4 * (1 - t) + 0.08, green(0.15 * t), 0.4); } },
    // a frilly lettuce: many narrow leaves, paler
    () => { let yaw = R() * TAU; for (let k = 0; k < 10; k++) { const t = k / 9, l = (0.34 - 0.1 * t) * u; yaw += 2.4; leaf([0, 0, 0], yaw, 0.5 + 0.8 * t, l, l * 0.45, 0.3, green(0.22), 0.45); } },
    // a basil: a short stem, its leaves in pairs
    () => { const H = 0.34 * u; prism([[0, 0, 0], [0, H / 2, 0], [0, H, 0]], 0.012 * u, STEM); let yaw = R() * TAU;
      for (let k = 0; k < 3; k++) { const y = (0.12 + 0.13 * k) * u, l = (0.2 - 0.03 * k) * u; yaw += PI / 2; for (const sg of [0, PI]) leaf([0, y, 0], yaw + sg, 0.45, l, l * 0.6, 0.2, green(0.1)); }
      for (const sg of [0, PI]) leaf([0, H, 0], yaw + PI / 2 + sg, 1.0, 0.1 * u, 0.06 * u, 0.05, green(0.2)); },
    // a chard: a few big broad leaves, deep green, with pale ribs
    () => { let yaw = R() * TAU; for (let k = 0; k < 5; k++) { const t = k / 4, l = (0.42 - 0.08 * t) * u; yaw += 2.4; leaf([0, 0, 0], yaw, 0.75 + 0.45 * t, l, l * 0.72, 0.28, green(-0.1), 0.3); } },
    // a little vine arching over, three-part leaves along it, small white flowers at its end
    () => { const sg = R() < 0.5 ? 1 : -1, at = (t) => [sg * 0.26 * u * t * t, 0.4 * u * Math.sin(t * 1.9), 0.04 * u * t];
      prism([0, 0.33, 0.66, 1].map(at), 0.01 * u, STEM);
      for (const t of [0.35, 0.7]) { const p0 = at(t); for (let j = 0; j < 3; j++) { const l = 0.15 * u; leaf(p0, j * 2.1 + t * 3, 0.5, l, l * 0.7, 0.2, green(0.05)); } }
      const e = at(1); for (let j = 0; j < 3; j++) blossom([e[0] + (j - 1) * 0.05 * u, e[1] + 0.02 * u * (j % 2), e[2] + 0.02 * u], 0.036 * u); },
  ];
  // (the lamp down the middle has no shape of its own: the glass draws it as a soft glow, kit/growglass.js)
  // the drum (turning): its wall green (the plants' own colour in the gaps), every fourth strip a shade darker so the
  // turning shows, and its back
  kind = 1;
  const RD = I.drum * u, Z0 = -I.back * u, Z1 = -0.002, N = 24, white = [lin('#7fb46c'), lin('#6c9f5b')];
  const back = v([0, 0, Z0], white[0]);
  for (let k = 0; k < N; k++) {
    const a0 = k / N * TAU, a1 = (k + 1) / N * TAU, c = white[k % 4 === 0 ? 1 : 0];
    const p = (a, z) => [RD * Math.cos(a), RD * Math.sin(a), z];
    quad(v(p(a0, Z1), c), v(p(a1, Z1), c), v(p(a1, Z0), c), v(p(a0, Z0), c));
    tri(back, v(p(a0, Z0), white[0]), v(p(a1, Z0), white[0]));
  }
  // the plants: four rings, each rooted at the wall and growing in toward the lamp (a little toward the glass)
  u = 1.6 * hs;
  RINGS_Z.slice(0, rings).forEach((z0, ring) => {
    for (let j = 0; j < PER; j++) {
      const a = (j + (ring % 2) * 0.5) / PER * TAU + (R() - 0.5) * 0.3, z = z0 * hs + (R() - 0.5) * 0.1 * hs;
      const base = [(RD - 0.01 * hs) * Math.cos(a), (RD - 0.01 * hs) * Math.sin(a), z];
      let d = [-Math.cos(a), -Math.sin(a), 0.25]; const dl = Math.hypot(...d); d = d.map((x) => x / dl);
      // (the plant's own across: the axle's line, and the third way; turned about its own up at random)
      const e1 = [0, 0, 1].map((x, i) => x - d[i] * d[2]), el = Math.hypot(...e1), n1 = e1.map((x) => x / el);
      const n2 = [n1[1] * d[2] - n1[2] * d[1], n1[2] * d[0] - n1[0] * d[2], n1[0] * d[1] - n1[1] * d[0]], ph = R() * TAU, cp = Math.cos(ph), sp = Math.sin(ph);
      const f1 = n1.map((x, i) => x * cp + n2[i] * sp), f2 = n1.map((x, i) => -x * sp + n2[i] * cp);
      T = (q) => [0, 1, 2].map((i) => base[i] + f1[i] * q[0] + d[i] * q[1] + f2[i] * q[2]);
      foot(); PLANT[(ring * 3 + j) % PLANT.length]();
    }
  });
  T = (q) => q;
  // (aLocal and aCol go on after the piece takes the geometry: a piece keeps only position, normal and uv)
  const g = new THREE.BufferGeometry(), nor = new Float32Array(P.length); for (let i = 2; i < nor.length; i += 3) nor[i] = 1;
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(ix); return [g, { aLocal: new THREE.Float32BufferAttribute(L, 4), aCol: new THREE.Float32BufferAttribute(C, 4) }];
}

const sizes = (o) => { const size = o.size ?? 0.30, n = Math.max(1, Math.round(o.n ?? 1)), gap = o.gap ?? 0.04, W = size + 2 * BAND, plate = o.plate ?? n > 1; return { size, n, gap, W, plate, len: n * W + (n - 1) * gap }; };
export function growPodSize(o = {}) {
  const { W, plate, len } = sizes(o), e = plate ? 2 * PLATE_EDGE + (o.backTrim ? 2 * PLATE_TRIM : 0) : 0;
  return [len + e, W + e, RIM.proud + ((o.clamps ?? 4) ? 0.008 : 0) + (plate ? PLATE : 0)];
}

export function growPod(p, o = {}) {
  if (!MAT_KEYS.includes('podIn') || !MAT_KEYS.includes('podPane')) throw new Error('kit: the grow pod needs the \'podIn\' and \'podPane\' materials in kit/materials.js (kit/growglass.js makes them)');
  const { size, n, gap, W, plate, len } = sizes(o), round = (o.shape ?? 'round') === 'round', y = o.y ?? 1.33, hs = size / 2;
  const frost = o.frost ?? 'medium', F = FROST[frost]; if (!F) throw new Error('kit: no grow pod frost "' + frost + '" (' + Object.keys(FROST).join(', ') + ')');
  const z0 = FACE + (plate ? PLATE : 0), move = o.move ?? true, turn = o.turn ?? GROW.turn, clamps = o.clamps ?? 4;
  const tint = typeof o.tint === 'number' ? o.tint : (o.tint ?? 'pink') === 'warm' ? 0 : 1, shade = o.shade ?? SHADE;
  // (one pod's plate is eight-sided, a row's a long plate with its corners cut; a trim is a second, lower plate that
  // shows as a thin line all round the first)
  if (plate) {
    const slab = (look, grow, high) => { const w = len + 2 * PLATE_EDGE + 2 * grow, h = W + 2 * PLATE_EDGE + 2 * grow; add(p, look, relief(shape(w, h, n > 1 ? 0.05 + grow * 0.6 : OCT * h, 0, y), RINGS.bevel(high, Math.min(0.006, high * 0.5))), [0, 0, FACE]); };
    slab(o.back ?? 'dark', 0, PLATE);
    if (o.backTrim) slab(o.backTrim, PLATE_TRIM, PLATE - 0.0025);   // (still clear of the wall's raised panels)
  }
  for (let k = 0; k < n; k++) {
    const cx = (k - (n - 1) / 2) * (W + gap), R = rand((o.seed ?? 1) * 97 + k * 31 + 5), glassAt = [cx, y, z0 + RIM.glass - 0.0005];
    // the frame, and the clamps across it on the diagonals
    add(p, o.trim ?? 'black', round ? roundFrame(hs) : relief(shape(W, W, OCT * W), RINGS_RIM, { hole: true }), [cx, y, z0]);
    for (let c = 0; c < clamps; c++) {
      const a = PI / 4 + c * TAU / clamps, rc = hs + BAND * 0.62;
      add(p, o.clamp ?? GUN, solid(shape(0.05, 0.04, 0.009), RIM.proud + 0.008, { edge: 0.005, back: false }), [cx + rc * Math.cos(a), y + rc * Math.sin(a), z0], [0, 0, a]);
    }
    // what is behind the glass (one draw for all the pods' insides), and the frosted pane in front (another)
    const [geo, more] = insideOf(hs, rand((o.seed ?? 1) * 7919 + k * 131), o.rings ?? RINGS_Z.length), gi = add(p, null, geo, glassAt, null, 'podIn');
    for (const [name, a] of Object.entries(more)) gi.setAttribute(name, a);
    fill(gi, 'aPod', [hs, round ? 1 : 0, move === false || !turn ? 0 : TAU / turn, R() * TAU]);
    fill(gi, 'aLamp', [tint, o.sway ?? 0, o.glow ?? 1, shade]);
    const gp = add(p, null, glassPlate(round, hs, 0.004), glassAt, null, 'podPane');
    fill(gp, 'aPod', [hs, o.glow ?? 1, round ? 1 : 0, 1]);
    fill(gp, 'aLook', [F.haze, F.grain, 1, R()]);
    fill(gp, 'aLamp', [0, o.lampGlow ?? 1, tint, shade]);
    // its light on what is near it: soft, short, baked (it follows the cabin's light strips' level)
    const i = (o.light ?? 0.2) * (size / 0.36) ** 2;
    if (i > 0) strip(p, [cx, y, z0 + 0.14], i, [0, 0, 1], 1.3, LIGHT);
  }
  // (one pool for a whole row: a room shows only its strongest few)
  const pl = (o.pool ?? 0.1) * (size / 0.36) ** 2 * Math.sqrt(n);
  if (pl > 0) pool(p, [0, y, z0 + 0.3 + 0.08 * (n - 1)], pl, 1.1 + 0.25 * (n - 1), LIGHT);
  return p;
}
