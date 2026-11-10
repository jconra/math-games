// THE GROW POD: a small window in a ship's wall with green plants growing behind frosted glass, under a grow lamp.
// From the game's maker's words and his picture of two big ones in a ship's galley wall (2026-11-09): "it would be cool
// to put at least one of these plant growing pods in there. Maybe it could be a bit blurry like it has frosted glass
// over it, with green plants showing." "I imagine they would be smaller than those." "Maybe the plant chamber could be
// slowly spinning the plants."
// A WALL fitting (kit/shipparts/cabin/ship.js): x along the wall, centred; z = 0 on the wall line, its back on the wall's
// face (FACE), facing +z; y = 0 the deck. Nothing of it goes into the wall: the frame stands 3.4 cm out of the face and
// the glass sits 2 cm down inside the frame; the depth behind the glass is drawn by the glass itself (kit/growglass.js:
// the plants slide behind the frame as the eye moves, and the pod's side wall shows on the side looked from).
//   growPod(p, o)
//     o.size    the glass, metres across (0.36; 0.30 to 0.45 suits a ship's wall): an eight-sided one across its flats,
//               a round one its diameter. The frame adds 4.3 cm all round.
//     o.shape   'oct' (eight-sided: the ships' own shape) or 'round'
//     o.n       how many in a row (1), o.gap between their frames (0.04); a row stands on one shallow back plate
//               (o.plate false: none; o.back its surface: dark). o.plate true gives a single pod a plate too
//               (eight-sided): it covers a wall seam or a panel's edge under the pod
//     o.frost   how frosted: 'light', 'medium', 'heavy'
//     o.plant   'ring'   a rotary garden: five potted plants on a wheel's rim, growing in toward its middle
//               'climb'  climbers out of a planter, winding up in front of a honeycomb frame
//               'herbs'  herbs in two troughs, one above the other
//               (a list gives each pod of a row its own)
//     o.lamp    where the grow lamp is: 'top' (a strip along the top) or 'rim' (a line of light round the rim). The
//               plants are brightest by it and darker away from it (o.shade: how lit the furthest are: 0.22 a ring,
//               0.3 climbers, 0.5 herbs); it never turns.
//     o.tint    the lamp's colour: 'pink' (pink-white) or 'warm' (warm white), or a number between (0 warm .. 1 pink);
//               o.lampGlow its own brightness (1)
//     o.move    true (the planting's own: a ring TURNS slowly, its plants hanging as they go round and brightening as
//               they pass the lamp; the others' leaves sway a little), 'turn', 'stir', or false (still). The glass, its
//               grain and the frame never move; the movement is worked out on the graphics card from the kit's one
//               clock (materials.js U.time): nothing is done for it each frame.
//     o.turn    a turning pod's seconds for one turn (GROW.turn: 60); negative turns it the other way
//     o.y       the height of its middle (1.33)
//     o.glow    this pod's own brightness (1), times GROW.glow (kit/growglass.js: THE number that sets how bright every
//               pod's glass is)
//     o.light   the light it throws on what is near it (0.2: a soft green-white, baked, reaching 1.3 m; 0: none)
//     o.pool    the same light as a small real-time pool on the wall round it (0.1, reaching 1.1 m; 0: none): a wall
//               panel has too few corners for the baked light to show on it. A row has ONE pool for all its pods (a
//               room shows only its strongest few pools)
//     o.clamps  how many clamps hold the frame (4, on the diagonals; 0: none)
//     o.trim    the frame's surface (black: the satin charcoal of the ships' ribs and rims), o.clamp the clamps' (the
//               mess's gunmetal: a named surface the cabin's looks would turn into the frame's own black)
//     o.seed    which painting of its planting (1): each different one is another picture on the pods' sheet
//     o.deep    how deep the pod looks, times the usual (1)
//   growPodSize(o)   [w, h, d]: the whole fitting's size on the wall (frames and back plate), and how far it stands out
// COST (counted in a built room). One pod: the eight-sided frame 48 triangles, a round one 144; each clamp 38; the glass
// 6 (round: 22); a back plate 22. So 206 an eight-sided pod, 318 a round one (54 and 166 with no clamps; 340 a round one
// on a plate), 640 a row of three eight-sided. The frame, clamps and plate are the cabin's 'solid' material (no new draw). The glass is the
// 'pod' material: every pod in a room's batch is ONE draw, with one texture (512 x 512 for three kinds of pod).
// THE 'pod' MATERIAL must be in the kit's list: three lines in kit/materials.js (kit/growglass.js gives them).
import * as THREE from 'three';
import { shape, relief, solid, RINGS, add } from '../../bevel.js';
import { MAT_KEYS } from '../../materials.js';
import { GROW, FROST, podCell } from '../../growglass.js';
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
const PLATE = 0.013, PLATE_EDGE = 0.035;
const SHADE = { ring: 0.22, climb: 0.3, herbs: 0.5 };   // how lit the plants furthest from the lamp are, by planting
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

const sizes = (o) => { const size = o.size ?? 0.36, n = Math.max(1, Math.round(o.n ?? 1)), gap = o.gap ?? 0.04, W = size + 2 * BAND, plate = o.plate ?? n > 1; return { size, n, gap, W, plate, len: n * W + (n - 1) * gap }; };
export function growPodSize(o = {}) {
  const { W, plate, len } = sizes(o), e = plate ? 2 * PLATE_EDGE : 0;
  return [len + e, W + e, RIM.proud + ((o.clamps ?? 4) ? 0.008 : 0) + (plate ? PLATE : 0)];
}

export function growPod(p, o = {}) {
  if (!MAT_KEYS.includes('pod')) throw new Error('kit: the grow pod\'s glass needs the \'pod\' material in kit/materials.js (the three lines to add are at the top of kit/growglass.js)');
  const { size, n, gap, W, plate, len } = sizes(o), round = (o.shape ?? 'oct') === 'round', y = o.y ?? 1.33, hs = size / 2;
  const frost = o.frost ?? 'medium', F = FROST[frost]; if (!F) throw new Error('kit: no grow pod frost "' + frost + '" (' + Object.keys(FROST).join(', ') + ')');
  const z0 = FACE + (plate ? PLATE : 0), move = o.move ?? true, turn = o.turn ?? GROW.turn, clamps = o.clamps ?? 4;
  // (one pod's plate is eight-sided, a row's a long plate with its corners cut)
  if (plate) add(p, o.back ?? 'dark', relief(shape(len + 2 * PLATE_EDGE, W + 2 * PLATE_EDGE, n > 1 ? 0.05 : OCT * (W + 2 * PLATE_EDGE), 0, y), RINGS.bevel(PLATE, 0.006)), [0, 0, FACE]);
  for (let k = 0; k < n; k++) {
    const cx = (k - (n - 1) / 2) * (W + gap), plant = Array.isArray(o.plant) ? o.plant[k % o.plant.length] : o.plant ?? 'ring', R = rand((o.seed ?? 1) * 97 + k * 31 + 5);
    // the frame, and the clamps across it on the diagonals
    add(p, o.trim ?? 'black', round ? roundFrame(hs) : relief(shape(W, W, OCT * W), RINGS_RIM, { hole: true }), [cx, y, z0]);
    for (let c = 0; c < clamps; c++) {
      const a = PI / 4 + c * TAU / clamps, rc = hs + BAND * 0.62;
      add(p, o.clamp ?? GUN, solid(shape(0.05, 0.04, 0.009), RIM.proud + 0.008, { edge: 0.005, back: false }), [cx + rc * Math.cos(a), y + rc * Math.sin(a), z0], [0, 0, a]);
    }
    // the glass: which pictures it shows, and how (kit/growglass.js)
    const g = add(p, null, glassPlate(round, hs, 0.004), [cx, y, z0 + RIM.glass - 0.0005], null, 'pod'), cell = podCell(plant, frost, o.seed ?? 1);
    const how = move === true ? (plant === 'ring' ? 'turn' : 'stir') : move, ring = plant === 'ring';
    fill(g, 'aCell', [...cell.near, ...cell.far]);
    fill(g, 'aPod', [hs, o.glow ?? 1, round ? 1 : 0, o.deep ?? 1]);
    fill(g, 'aLook', [F.haze, F.grain, k % 2 ? -1 : 1, R()]);
    fill(g, 'aMove', [ring ? R() * TAU : 0, how === 'turn' && turn ? TAU / turn : 0, how === 'stir' ? GROW.stir : 0, ring ? 0 : (R() - 0.5) * 0.3]);
    fill(g, 'aLamp', [(o.lamp ?? 'top') === 'rim' ? 1 : 0, o.lampGlow ?? 1, typeof o.tint === 'number' ? o.tint : (o.tint ?? 'pink') === 'warm' ? 0 : 1, o.shade ?? SHADE[plant] ?? 0.3]);
    // its light on what is near it: soft, short, baked (it follows the cabin's light strips' level)
    const i = (o.light ?? 0.2) * (size / 0.36) ** 2;
    if (i > 0) strip(p, [cx, y, z0 + 0.14], i, [0, 0, 1], 1.3, LIGHT);
  }
  // (one pool for a whole row: a room shows only its strongest few)
  const pl = (o.pool ?? 0.1) * (size / 0.36) ** 2 * Math.sqrt(n);
  if (pl > 0) pool(p, [0, y, z0 + 0.3 + 0.08 * (n - 1)], pl, 1.1 + 0.25 * (n - 1), LIGHT);
  return p;
}
