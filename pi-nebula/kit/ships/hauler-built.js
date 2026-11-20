// THE HAULER (built): the container carrier, after the game maker's picture. About 16 m long and 5 m wide: a cab up
// front, a spine, eight containers (two stacked, two along, on each side) held in yellow clamp frames, and the engine
// block at the back. Built the way the Miner and the Medic were (built-common.js):
//   from the 3k smart mesh   the nose and cab (hauler-built.hull.js, parts 'body' and 'canopy'), painted by face
//   from the 8k smart mesh   the engine block (part 'engines') and the six thruster pods (POD)
//   in code                  everything between: the door section, the core and spine, the clamp frames and their jaws,
//                            the containers (cargo-container.js: one shared design), the legs, the door and its stair
// The ship's frame: nose +z, port +x, y up from the ground, metres. Its pieces sit on the deck (DECK above the ground)
// at one cell, so every piece draws through dk.
//   MOUNTS      the eight container mounts: name, side, middle (ship frame), colour, turn. The station's dock loads
//               and unloads them one at a time; hbContainer and hbClamp have one variant per mount.
//   cargoStep   moves each mount toward what is wanted of it (on / off, clamps open); cargoPose sets them outright
//   LAB         the Ship Lab's controls
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Acc } from '../shipparts/outside/facet.js';
import { part, placeInto } from '../shipparts/place.js';
import { crewSeat } from '../shipparts/cockpit/seats.js';
import { SURF } from '../materials.js';
import * as C from './built-common.js';
import { HULL, ENGINE_AT, POD, POD_HALF, DECK as DECK0, PARTS, Q } from './hauler-built.hull.js';
import { CONTAINER, LOOKS, COLOURS, containerLeaf, cargoContainer } from './cargo-container.js';
import { drawMix as drawLooks } from './cargo-mix.js';
export { THROTTLE, ENGINE, setThrottle } from './built-common.js';

const PI = Math.PI, V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const DECK = DECK0;
const dk = C.deckOf(DECK), { bytes, at, tnorm } = C, mesh = (d) => C.decodeMesh(d, Q);
const polyTo = (acc, pts, n, surf, mat = 'solid') => C.polyTo(acc, pts, n, surf, mat, dk);
const boxAt = (acc, c, axes, halves, surf, skip = []) => C.boxAt(acc, c, axes, halves, surf, skip, dk);
const AX = [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)];
const quad = (acc, pts, n, surf, mat = 'solid') => acc.poly(pts.map(dk), n, surf, mat, 99);
// a box by its two corners (ship frame)
const box = (acc, [x0, x1], [y0, y1], [z0, z1], surf, skip = []) => boxAt(acc, V3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), AX, [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2], surf, skip);
// a skin run along z: a port half-profile ([x, y], from the keel line round to the top), a face per segment each side
function skin(acc, prof, z0, z1, paint, sides = [1, -1]) {
  for (const sx of sides) for (let i = 0; i < prof.length - 1; i++) {
    const [xa, ya] = prof[i], [xb, yb] = prof[i + 1], n = V3(sx * (yb - ya), -(xb - xa), 0).normalize();
    const surf = typeof paint === 'function' ? paint((xa + xb) / 2, (ya + yb) / 2) : paint;
    quad(acc, [V3(sx * xa, ya, z0), V3(sx * xb, yb, z0), V3(sx * xb, yb, z1), V3(sx * xa, ya, z1)], n, surf);
  }
}
// a half-profile's whole outline at z (both sides), for an end face
const outline = (prof, z) => [...prof.map(([x, y]) => V3(x, y, z)), ...prof.slice().reverse().filter(([x]) => x > 1e-6).map(([x, y]) => V3(-x, y, z))];
// the face between two half-profiles at z (both from the keel line to the top): a ring, in pieces between the two,
// each sampled along rays out from a middle point. Where `outer` is the farther out the piece faces n; where `inner`
// pokes out past it (the core's shoulders above the door section's roof), the other way
function ring(acc, outer, inner, z, n, surf, mid = [0, 2.3], steps = 72) {
  const hit = (prof, ang) => {
    const d = [Math.sin(ang), -Math.cos(ang)];   // (ang 0: straight down; PI: straight up; port side +x)
    let best = null;
    for (let i = 0; i < prof.length - 1; i++) {
      const [ax, ay] = prof[i], [bx, by] = prof[i + 1], ex = bx - ax, ey = by - ay, den = d[0] * ey - d[1] * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((ax - mid[0]) * ey - (ay - mid[1]) * ex) / den, u = ((ax - mid[0]) * d[1] - (ay - mid[1]) * d[0]) / den;
      if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && (!best || t < best)) best = t;
    }
    return [mid[0] + d[0] * best, mid[1] + d[1] * best];
  };
  const far = (p) => Math.hypot(p[0] - mid[0], p[1] - mid[1]), P = (p, sx) => V3(sx * p[0], p[1], z), back = n.clone().negate();
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (const sx of [1, -1]) for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * PI, a1 = ((i + 1) / steps) * PI, o0 = hit(outer, a0), o1 = hit(outer, a1), i0 = hit(inner, a0), i1 = hit(inner, a1);
    const d0 = far(o0) - far(i0), d1 = far(o1) - far(i1);
    if (Math.abs(d0) < 1e-6 && Math.abs(d1) < 1e-6) continue;
    if (d0 * d1 >= 0) { acc.poly([P(i0, sx), P(o0, sx), P(o1, sx), P(i1, sx)].map(dk), d0 + d1 > 0 ? n : back, surf, 'solid', 99); continue; }
    // (the two cross in this step: a triangle each side of where they meet)
    const t = d0 / (d0 - d1), m = lerp(o0, o1, t);
    acc.tris([[P(i0, sx), P(o0, sx), P(m, sx)].map(dk)], d0 > 0 ? n : back, surf);
    acc.tris([[P(m, sx), P(o1, sx), P(i1, sx)].map(dk)], d1 > 0 ? n : back, surf);
  }
}

// ── the paints (sRGB; roughness, metalness, wear) ───────────────────────────────────────────────────────────────────
const s = (c, r, m, w) => ({ c, r, m, w });
export const PAL = {
  skin: s('#d6cbb2', 0.5, 0.04, 0.5), skinEdge: s('#d9d2c0', 0.5, 0.04, 1.0),
  dark: s('#3d4249', 0.5, 0.3, 0.6), darkEdge: s('#3d4249', 0.5, 0.3, 1.0),
  black: s('#1b1d20', 0.42, 0.3, 0.4), blackEdge: s('#1b1d20', 0.42, 0.3, 0.9),
  yellow: s('#e0a81a', 0.45, 0.03, 0.6), belly: s('#50555c', 0.6, 0.25, 0.8), metal: s('#6d7177', 0.4, 0.6, 0.6),
  rubber: s('#202225', 0.85, 0, 0.5), inner: s(SURF.white[0], SURF.white[1], SURF.white[2], 0.35),
  deck: s('#55595f', 0.6, 0.3, 0.6), tread: s('#62666c', 0.7, 0.35, 0.7), door: s('#4b4239', 0.6, 0.15, 0.4),
  drum: s('#5a6068', 0.55, 0.22, 0.6), drumEdge: s('#5a6068', 0.55, 0.22, 1.0),
  nozzle: s('#2a2d32', 0.4, 0.75, 0.8), rim: s('#868d95', 0.45, 0.3, 0.7), core: s('#16181b', 0.45, 0.8, 0.8),
  screen: s('#0c1418', 0.2, 0.1, 0.2), legs: s('#33373d', 0.5, 0.35, 0.6),
};
export const GLOW = { strip: [0.08, 0.85, 3.2], warm: [2.1, 0.78, 0.1], amber: [2.3, 1.05, 0.12], keypad: [0.1, 0.9, 2.2], white: [2.4, 2.3, 2.1] };

// ── THE NOSE AND THE ENGINE BLOCK: the meshes, painted by face ──────────────────────────────────────────────────────
// (his picture: a cream cab on a dark lower hull, three yellow stripes leaning back on each cheek, a dark panel under
// each side window and on the nose's front; a dark roof)
export const STRIPES = { z: [6.75, 6.4, 6.05], y: 2.05, w: 0.22, lean: 0.7, y0: 1.84, y1: 2.3, x: 0.9 };
// THE FRONT LEGS' FOLD (THE LEGS, below): the hinge's height over the ground; the turn, forward; the well each folds
// into (port side's |x| and z), its top under the cockpit's floor (DECK + COCKPIT.floor = 1.35); folded, the sole
// stands at hinge - boot = 0.85, the belly's line there. The belly's skin over each well is cut out (the zone 'well')
export const FOLD = { hinge: 1.21, turn: -PI / 2, top: 1.31, well: { x: [0.04, 0.6], z: [5.12, 6.88] } };
export const ZONES = [
  { zone: 'lower', parts: ['body', 'canopy'], planes: [[0, 1, 0, 1.78], [0, 0, -1, -4.63]] },
  { zone: 'lower', parts: ['body', 'canopy'], planes: [[0, 1, 0, 1.59], [0, 0, 1, 4.63]] },
  { zone: 'belt', parts: ['body'], planes: [[0, 0, -1, -4.8], [0, 0, 1, 5.7], [0, -1, 0, -1.72], [0, 1, 0, 2.36], [-1, 0, 0, -1.25]] },
  { zone: 'front', parts: ['body'], planes: [[1, 0, 0, 0.62], [0, 0, -1, -7.0], [0, 1, 0, 2.12]] },
  ...STRIPES.z.map((z) => { const d = STRIPES.lean * STRIPES.y + z; return { zone: 'stripe', parts: ['body'], planes: [[0, -1, 0, -STRIPES.y0], [0, 1, 0, STRIPES.y1], [-1, 0, 0, -STRIPES.x], [0, STRIPES.lean, 1, d + STRIPES.w / 2], [0, -STRIPES.lean, -1, -(d - STRIPES.w / 2)]] }; }),
  // (the front legs' wells: the belly's skin over each, cut out along its edges; FOLD.well, below)
  { zone: 'well', parts: ['body'], planes: [[-1, 0, 0, -FOLD.well.x[0]], [1, 0, 0, FOLD.well.x[1]], [0, 0, -1, -FOLD.well.z[0]], [0, 0, 1, FOLD.well.z[1]], [0, 1, 0, 1.2]] },
];
const edge = (paint) => (f) => (f.thin ? paint + 'Edge' : paint);
const ringOf = (c) => ENGINE_AT[c.x >= 0 ? 0 : 1], fromAxis = (c, E) => Math.hypot(c.x - E.axis[0], c.y - E.axis[1]);
// the engine block: its housing is what lies ahead of the drums, or well off both their axes. The 8k's housing ahead
// of the drums (z over HOUSING.z) is not drawn: in its place the collar runs back to the drums as a hollow box in code
// (hbBody), so engineering reaches into the engine block (the 8k's was solid inside, a plate and steps across it)
export const HOUSING = { z: -6.92, r: 0.93 };
const housing = (f) => f.c.z > HOUSING.z || fromAxis(f.c, ringOf(f.c)) > HOUSING.r;
export const RULES = [
  ['the front legs\' wells (open: the legs fold into them)', (f) => f.zone === 'well' && f.n.y < -0.3, 'gone'],
  ['the canopy\'s glass', (f) => f.part !== 'engines' && f.c.z > 4.3 && canopyPanes().covers(f.c, 0.12), 'glass'],
  ['the engines\' recesses', (f) => f.part === 'engines' && f.c.z < ringOf(f.c).back + 0.62 && fromAxis(f.c, ringOf(f.c)) < ringOf(f.c).mouth + 0.04, (f) => (f.n.z < -0.9 && f.c.z > ringOf(f.c).floor - 0.05 ? 'core' : 'nozzle')],
  ['the engines\' rims', (f) => f.part === 'engines' && f.n.z < -0.6 && f.c.z < -7.0 && !housing(f), 'rim'],
  ['the 8k\'s housing ahead of the drums (the code\'s box instead)', (f) => f.part === 'engines' && f.c.z > HOUSING.z + 0.02, 'gone'],
  ['the engine block\'s housing', (f) => f.part === 'engines' && housing(f), (f) => (Math.abs(f.n.x) > 0.7 && Math.abs(f.c.x) > 1.2 ? 'skin' : edge('dark')(f))],
  ['the engines\' drums', (f) => f.part === 'engines', edge('drum')],
  ['the belly', (f) => f.n.y < -0.55, 'belly'],
  ['the lower hull', (f) => f.zone === 'lower', edge('dark')],
  ['the stripes', (f) => f.zone === 'stripe' && Math.abs(f.n.x) > 0.45, 'yellow'],
  ['the panel under the side window', (f) => f.zone === 'belt' && Math.abs(f.n.x) > 0.8, 'dark'],
  ['the nose\'s front panel', (f) => f.zone === 'front' && f.n.z > 0.3, 'dark'],
  ['the roof', (f) => f.c.y > 3.3 && f.c.z < 5.25 && f.n.y > 0.3, 'dark'],
  ['the trim', (f) => f.thin, 'darkEdge'],
  ['the skin', () => true, 'skin'],
];
let FACES = null;
export function hullFaces() { if (FACES) return FACES; FACES = C.paintFaces(mesh(HULL), new Uint8Array(bytes(HULL.part)), PARTS, ZONES, RULES); return FACES; }
const drawn = (f) => f.paint !== 'glass' && f.paint !== 'gone';
const rayHull = (o, d) => C.rayFaces(hullFaces(), o, d, drawn);

// the light bars round each drum (blue, as his picture's): short strips laid on the drum's skin, found by rays in
// toward its axis. The two drums stand side by side, so a bar that would face the other drum is left out.
export const BARS = { z: [0.45, 0.62], n: 24, every: 3 };
export const NOSE_IN = { z: 3.6 };
function hbHull(p) {
  const acc = new Acc(), F = hullFaces();
  // (the nose's skin is drawn both ways: its inside, dark, is what the cockpit sees round the glass)
  C.drawFaces(acc, F.map((f) => (f.part !== 'engines' && f.c.z > NOSE_IN.z && !f.back ? { ...f, back: true } : f)), { PAL, dk, backSurf: PAL.dark, skip: ['glass', 'gone'] });
  for (const E of ENGINE_AT) {
    const [ax, ay] = E.axis, mine = (f) => f.part === 'engines' && f.c.x * ax > -0.02;
    for (let i = 0; i < BARS.n; i++) {
      if (i % BARS.every === BARS.every - 1) continue;
      const q = [];
      for (const [da, zz] of [[0, BARS.z[0]], [1, BARS.z[0]], [1, BARS.z[1]], [0, BARS.z[1]]]) {
        const t = ((i + da * 0.8 + 0.1) / BARS.n) * PI * 2, d = V3(Math.cos(t), Math.sin(t), 0), z = E.back + zz;
        if (d.x * Math.sign(ax) < -0.75) break;
        const h = C.rayFaces(F, V3(ax, ay, z).addScaledVector(d, 3), d.clone().negate(), mine);
        if (!h) break;
        const r = Math.hypot(h.p.x - ax, h.p.y - ay);
        if (V3(h.p.x - ax, h.p.y - ay, 0).dot(d) < 0.4 || r < 0.5 || r > 0.98) break;
        q.push(h.p.addScaledVector(h.n, 0.012));
      }
      if (q.length < 4) continue;
      const m = q[0].clone().add(q[2]).multiplyScalar(0.5);
      acc.poly(q.map(dk), V3(m.x - ax, m.y - ay, 0).normalize(), GLOW.strip, 'glow', 99);
    }
  }
  return acc.flush(p);
}
// the jets: one plume from each drum's floor
export const JET = { len: 9.0, gain: 1.0 };
export function jetNozzles() { return ENGINE_AT.map((E) => ({ at: [E.axis[0], E.axis[1], E.floor - 0.01], dir: [0, 0, -1], r: Math.min(E.floorR, E.mouth) * 0.9 })); }

// ── THE CANOPY: a windscreen, a quarter pane each side bent along its middle, and a side window each side ─────────────
const fx = (x, y, z) => ({ at: [x, y, z], fixed: true });
export const CANOPY = {
  corners: {
    W0: fx(0.584, 2.166, 7.787), W1: fx(0.592, 2.976, 6.967), A: fx(0.935, 2.342, 6.901), B: fx(1.250, 2.459, 6.015), Cc: fx(1.005, 2.703, 6.007), D: fx(0.627, 3.054, 6.827),
    S0: fx(1.233, 2.430, 5.737), S1: fx(1.233, 2.430, 4.752), S2: fx(1.242, 2.742, 4.761), S3: fx(1.242, 2.742, 5.728), T2: fx(1.005, 3.133, 4.720), T3: fx(0.935, 3.074, 5.687),
  },
  side: [],
  top: [
    ['windscreen', 'quad', [['W0', 'W1', "W1'", "W0'"]]],
    ['port quarter', 'two parts', [['W0', 'A', 'D', 'W1'], ['A', 'B', 'Cc', 'D']]],
    ['starboard quarter', 'two parts', [["W0'", "A'", "D'", "W1'"], ["A'", "B'", "Cc'", "D'"]]],
    ['port side window', 'two parts', [['S0', 'S1', 'S2', 'S3'], ['S3', 'S2', 'T2', 'T3']]],
    ['starboard side window', 'two parts', [["S0'", "S1'", "S2'", "S3'"], ["S3'", "S2'", "T2'", "T3'"]]],
  ],
  spar: { w: 0.07, out: 0.035, in: 0.03 }, sill: { w: 0.12, out: 0.02, shift: 0.03 }, straight: 3,
};
function canopyMesh() {
  const M = mesh(HULL), pt = new Uint8Array(bytes(HULL.part)), ci = PARTS.indexOf('canopy'), faces = [], verts = new Map();
  for (let t = 0; t < M.tris.length / 3; t++) {
    if ((pt[t] & 0x7f) !== ci) continue;
    const pts = [0, 1, 2].map((k) => at(M, M.tris[t * 3 + k]));
    if (tnorm(pts).length() < 2e-7) continue;
    faces.push(pts);
    for (const v of pts) verts.set([v.x, v.y, v.z].map((q) => Math.round(q * 2000)).join(), v);
  }
  return { faces, verts: [...verts.values()] };
}
const outward = (n, c) => (n.dot(V3(c.x, c.y - 2.6, c.z - 5.6)) < 0 ? n.negate() : n);
let PANES = null;
export function canopyPanes() { if (PANES) return PANES; PANES = C.buildPanes(CANOPY, canopyMesh(), outward); return PANES; }
export function spar(p) { return C.spar(p, { out: CANOPY.spar.out, in: CANOPY.spar.in, surf: PAL.blackEdge }); }
export const GLASS = { inset: 0.008, step: 0.6 };
// (and the PILLAR between each side window and the quarter pane ahead of it: the 3k's starboard side is open there, a
// crack the sky showed through from the seats. A dark plate 2 cm inside the skin, each side: behind the skin to port)
export const PILLAR = { inset: 0.02 };
function hbCanopy(p) {
  C.drawCanopy(p, canopyPanes(), CANOPY, GLASS, part(spar), dk);
  const acc = new Acc(), K = CANOPY.corners;
  for (const sx of [1, -1]) {
    const pt = (k) => { const [x, y, z] = K[k].at; return V3(sx * (x - PILLAR.inset), y, z); };
    const q = [pt('S0'), pt('B'), pt('Cc'), pt('T3'), pt('S3')], n = V3(sx, 0, 0);
    polyTo(acc, q, n, PAL.blackEdge); polyTo(acc, q, n.clone().negate(), PAL.blackEdge);
  }
  return acc.flush(p);
}

// ── THE MIDDLE, IN CODE: the door section behind the cab, the core the containers hang on, its spine cap, the keel, and
// the collar the engine block bolts to ──────────────────────────────────────────────────────────────────────────────
// the door section's port half (x, y), from the keel line round to the roof's middle: it carries on the nose's own
// section where the mesh was cut (z 3.72)
export const SECT = [[0, 0.64], [0.5, 0.64], [0.63, 0.75], [1.09, 0.83], [1.26, 1.23], [1.53, 1.47], [1.67, 1.59], [1.67, 2.55], [1.53, 2.72], [1.30, 2.76], [1.19, 2.92], [1.15, 3.10], [1.20, 3.27], [0.94, 3.59], [0.45, 3.66], [0, 3.71]];
export const BODY = { door: [2.72, 3.72], core: [-5.52, 2.72], collar: [-6.92, -5.52], coreX: 1.2, top: 3.75 };
const sectPaint = (x, y) => (y < 0.86 ? PAL.belly : y < 1.56 || y > 3.19 || (y > 2.5 && y < 2.73 && x > 1.5) ? PAL.dark : PAL.skin);
// the section's side at a height (between its bilge and its roof)
function sectX(y) { for (let i = 3; i < 12; i++) { const [xa, ya] = SECT[i], [xb, yb] = SECT[i + 1]; if (y >= ya && y <= yb) return xa + (xb - xa) * (y - ya) / (yb - ya); } return SECT[6][0]; }
export const CREWDOOR = { z: [2.82, 3.64], sill: DECK, head: 3.05, open: 100 * PI / 180, speed: 0.7, near: 2.6, skin: 0.05 };
const doorProf = () => [[sectX(CREWDOOR.sill), CREWDOOR.sill], ...SECT.slice(4, 11), [sectX(CREWDOOR.head), CREWDOOR.head]];
// (the core 2.4 m across, so the rooms inside it are 2 m wide, as the Miner's: his picture's spine looks nearer 1.8 m;
// its shoulders high enough that the rooms are 2.5 m tall right to their walls; the spine cap stands on its top)
const CORE = [[0, 0.80], [1.05, 0.80], [1.2, 0.95], [1.2, 3.6], [1.05, 3.75], [0, 3.75]];
const CAP = [[0.94, 3.75], [0.94, 3.82], [0.80, 3.92], [0, 3.92]];
const COLLAR = [[0, 0.80], [1.27, 0.80], [1.62, 1.15], [1.62, 3.53], [1.27, 3.88], [0, 3.88]];
// the engine block's housing's plates (his picture's): the raised cream block each side (y, z; raise: how far out),
// its handle, the dark plate under it and the band over it with its vent, the cream plate across the top
export const HOUSE = { raise: 0.09, cream: { y: [1.62, 3.0], z: [-6.7, -5.86] }, handle: { y: 2.2, z: [-6.55, -6.12] }, low: { y: [1.02, 1.5] }, band: { y: [3.08, 3.48] }, vent: { z: [-6.6, -6.0] }, top: { x: [-0.95, 0.95], z: [-6.62, -6.02] } };
// his dark inset hatch on the block's face, each side (on the port side it is the crew door's own face)
function hatchMark(acc, sx) {
  const x = sx * (SECT[6][0] + 0.006), n = V3(sx, 0, 0);
  const oct = (z0, z1, y0, y1, ch, xx) => [[z0 + ch, y0], [z1 - ch, y0], [z1, y0 + ch], [z1, y1 - ch], [z1 - ch, y1], [z0 + ch, y1], [z0, y1 - ch], [z0, y0 + ch]].map(([z, y]) => dk(V3(xx, y, z)));
  acc.poly(oct(2.95, 3.5, 1.72, 2.42, 0.08, x), n, PAL.black, 'solid', 99);
  acc.poly(oct(3.01, 3.44, 1.78, 2.36, 0.06, x + sx * 0.004), n, PAL.dark, 'solid', 99);
  for (const z of [3.08, 3.37]) boxAt(acc, V3(x + sx * 0.02, 2.07, z), AX, [0.02, 0.14, 0.015], PAL.metal, [sx > 0 ? 'u-' : 'u+']);
  quad(acc, [V3(x + sx * 0.008, 1.9, 3.2), V3(x + sx * 0.008, 1.9, 3.26), V3(x + sx * 0.008, 1.98, 3.26), V3(x + sx * 0.008, 1.98, 3.2)], n, GLOW.keypad, 'glow');
}
function hbBody(p) {
  const acc = new Acc(), [d0, d1] = BODY.door, [c0, c1] = BODY.core, [k0, k1] = BODY.collar, Dz = CREWDOOR.z;
  // the door section: whole on the starboard side; on the port side cut for the crew door (hbCrewDoor)
  skin(acc, SECT, d0, d1, sectPaint, [-1]);
  skin(acc, [...SECT.slice(0, 4), [sectX(CREWDOOR.sill), CREWDOOR.sill]], d0, d1, sectPaint, [1]);
  skin(acc, [[sectX(CREWDOOR.head), CREWDOOR.head], ...SECT.slice(11)], d0, d1, sectPaint, [1]);
  skin(acc, doorProf(), d0, Dz[0], sectPaint, [1]); skin(acc, doorProf(), Dz[1], d1, sectPaint, [1]);
  // (its back: a ring round the core, which runs on into it: the cabin is one space through both)
  ring(acc, SECT, CORE, d0, V3(0, 0, -1), PAL.dark);
  hatchMark(acc, -1);
  // the core: a dark box girder, the containers' mounts on its sides (hbFrames draws the mounts)
  skin(acc, CORE, c0, c1, (x, y) => (y < 0.81 ? PAL.belly : PAL.dark));

  // the spine cap along its top: cream, its front sloped down to the roof, dark inset panels with a blue strip each
  const cz0 = c0, cz1 = d0 - 0.25;
  skin(acc, CAP, cz0, cz1, PAL.skin);
  // (its front: sloped down from the cap's top at cz1 to the door section's roof at d0, a triangle at a time)
  const tri = (a, b, c, ref) => { const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize(); if (n.dot(ref) < 0) n.negate(); acc.tris([[a, b, c].map(dk)], n, PAL.skin); };
  const top = CORE[CORE.length - 1][1], [ra, rb, rc] = [[0.94, top], [0.45, top], [0, top]];   // (the core's top at d0)
  for (const sx of [1, -1]) {
    const up = V3(sx * 0.3, 1, 0.4);
    tri(V3(sx * CAP[0][0], CAP[0][1], cz1), V3(sx * CAP[1][0], CAP[1][1], cz1), V3(sx * ra[0], ra[1], d0), V3(sx, 0, 0.2));
    tri(V3(sx * CAP[1][0], CAP[1][1], cz1), V3(sx * CAP[2][0], CAP[2][1], cz1), V3(sx * ra[0], ra[1], d0), up);
    tri(V3(sx * CAP[2][0], CAP[2][1], cz1), V3(sx * rb[0], rb[1], d0), V3(sx * ra[0], ra[1], d0), up);
    tri(V3(sx * CAP[2][0], CAP[2][1], cz1), V3(0, CAP[3][1], cz1), V3(sx * rb[0], rb[1], d0), V3(0, 1, 0.4));
    tri(V3(0, CAP[3][1], cz1), V3(0, rc[1], d0), V3(sx * rb[0], rb[1], d0), V3(0, 1, 0.4));
  }
  polyTo(acc, outline(CAP, cz0), V3(0, 0, -1), PAL.skin);
  for (const [zc, len] of [[0.63, 1.6], [-3.57, 1.6], [-1.47, 0.5]]) {
    quad(acc, [V3(-0.36, 3.925, zc - len / 2), V3(-0.36, 3.925, zc + len / 2), V3(0.36, 3.925, zc + len / 2), V3(0.36, 3.925, zc - len / 2)], V3(0, 1, 0), PAL.dark);
    for (const sx of [1, -1]) quad(acc, [V3(sx * 0.2, 3.93, zc - len / 2 + 0.08), V3(sx * 0.2, 3.93, zc + len / 2 - 0.08), V3(sx * 0.26, 3.93, zc + len / 2 - 0.08), V3(sx * 0.26, 3.93, zc - len / 2 + 0.08)], V3(0, 1, 0), GLOW.strip, 'glow');
  }
  // the keel under it
  box(acc, [-0.75, 0.75], [0.62, 0.80], [c0 + 0.12, d0 - 0.12], PAL.belly, ['v+']);
  // the collar: a dark eight-sided frame the engine block bolts to, a cream panel on each side
  // the collar and the engine block's housing: one dark eight-sided box from the core back to the drums, hollow (the
  // core's inside runs on into it), a cream panel on each side; its front a ring round the core, its back the
  // bulkhead the drums stand on (both faces: the engine room's end wall inside, the drums' plate outside)
  skin(acc, COLLAR, k0, k1, (x, y) => (y < 0.81 ? PAL.belly : PAL.dark));
  ring(acc, COLLAR, CORE, k1, V3(0, 0, 1), PAL.dark);
  polyTo(acc, outline(COLLAR, k0), V3(0, 0, -1), PAL.dark); polyTo(acc, outline(COLLAR, k0 + 0.002).reverse(), V3(0, 0, 1), PAL.dark);
  // (its look, his picture's engine block: on each side a raised cream block of two panels with a dark handle, a dark
  // plate under it and a dark band with a vent over it; a cream plate across the top with a dark vent; cream corners
  // on the back round the drums, where his has the octagon's cream corners)
  const H = HOUSE;
  for (const sx of [1, -1]) {
    const X = (a, b) => [sx * a, sx * b], inn = sx > 0 ? 'u-' : 'u+';
    box(acc, X(1.58, 1.62 + H.raise), H.cream.y, H.cream.z, PAL.skin, [inn]);
    const xf = sx * (1.62 + H.raise + 0.003), n = V3(sx, 0, 0), zm = (H.cream.z[0] + H.cream.z[1]) / 2;
    quad(acc, [V3(xf, H.cream.y[0] + 0.02, zm - 0.012), V3(xf, H.cream.y[0] + 0.02, zm + 0.012), V3(xf, H.cream.y[1] - 0.02, zm + 0.012), V3(xf, H.cream.y[1] - 0.02, zm - 0.012)], n, PAL.black);
    box(acc, X(1.62 + H.raise, 1.62 + H.raise + 0.04), [H.handle.y - 0.03, H.handle.y + 0.03], H.handle.z, PAL.black, [inn]);
    box(acc, X(1.62 + H.raise, 1.62 + H.raise + 0.04), [H.handle.y - 0.12, H.handle.y + 0.03], [H.handle.z[0], H.handle.z[0] + 0.05], PAL.black, [inn]);
    box(acc, X(1.58, 1.62 + 0.035), H.low.y, [k0 + 0.1, k1 - 0.1], PAL.darkEdge, [inn]);
    box(acc, X(1.58, 1.62 + 0.035), H.band.y, [k0 + 0.1, k1 - 0.1], PAL.darkEdge, [inn]);
    const xv = sx * (1.62 + 0.038);
    quad(acc, [V3(xv, H.band.y[0] + 0.12, H.vent.z[0]), V3(xv, H.band.y[0] + 0.12, H.vent.z[1]), V3(xv, H.band.y[1] - 0.12, H.vent.z[1]), V3(xv, H.band.y[1] - 0.12, H.vent.z[0])], n, PAL.black);
    // (the back's cream corners: inside the outline, along its slanted edges, top and bottom)
    for (const [a, b, c, d] of [[[1.62, 3.53], [1.27, 3.88], [0.95, 3.88], [1.62, 3.21]], [[1.27, 0.80], [1.62, 1.15], [1.62, 1.47], [0.95, 0.80]]]) {
      polyTo(acc, [a, b, c, d].map(([x, y]) => V3(sx * x, y, k0 - 0.004)), V3(0, 0, -1), PAL.skin);
    }
  }
  box(acc, H.top.x, [COLLAR[4][1] - 0.02, COLLAR[4][1] + 0.05], H.top.z, PAL.skin, ['v-']);
  quad(acc, [V3(-0.45, COLLAR[4][1] + 0.053, H.top.z[0] + 0.12), V3(0.45, COLLAR[4][1] + 0.053, H.top.z[0] + 0.12), V3(0.45, COLLAR[4][1] + 0.053, H.top.z[1] - 0.12), V3(-0.45, COLLAR[4][1] + 0.053, H.top.z[1] - 0.12)], V3(0, 1, 0), PAL.black);
  // two antennas on the cab roof's rear
  for (const [x, z, top] of [[0.14, 5.38, 4.17], [-0.12, 5.10, 4.39]]) {
    const up = rayHull(V3(x, 6, z), V3(0, -1, 0)), y0 = up ? up.p.y - 0.02 : 3.4;
    box(acc, [x - 0.05, x + 0.05], [y0, y0 + 0.09], [z - 0.05, z + 0.05], PAL.black, ['v-']);
    box(acc, [x - 0.012, x + 0.012], [y0 + 0.09, top], [z - 0.012, z + 0.012], PAL.black, ['v-']);
  }
  return acc.flush(p);
}

// ── THE WAY IN: a gull-wing door on the port side behind the cab, and a stair that swings down from its sill ─────────
// The door is the hull's own skin between the sill and the head, hinged along its top: it lifts clear, then the stair
// (stowed upright just inside it) swings out and down to the ground. Shutting: the stair first, then the door.
function hbCrewDoor(p) {
  const [z0, z1] = CREWDOOR.z, P = doorProf(), T = CREWDOOR.skin, hx = sectX(CREWDOOR.head);
  p.leaf('hb:crew door', (lp) => {
    const acc = new Acc(), a = z0 + 0.01, b = z1 - 0.01, In = P.map(([x, y]) => [x - T, y]);
    skin(acc, P, a, b, sectPaint, [1]);
    for (let i = 0; i < In.length - 1; i++) {
      const [xa, ya] = In[i], [xb, yb] = In[i + 1];
      quad(acc, [V3(xa, ya, a), V3(xb, yb, a), V3(xb, yb, b), V3(xa, ya, b)], V3(-(yb - ya), xb - xa, 0).normalize(), PAL.inner);
    }
    for (const [z, nz] of [[a, -1], [b, 1]]) polyTo(acc, [...P.map(([x, y]) => V3(x, y, z)), ...In.slice().reverse().map(([x, y]) => V3(x, y, z))], V3(0, 0, nz), PAL.darkEdge);
    quad(acc, [V3(P[0][0], P[0][1], a), V3(In[0][0], In[0][1], a), V3(In[0][0], In[0][1], b), V3(P[0][0], P[0][1], b)], V3(0, -1, 0), PAL.darkEdge);
    hatchMark(acc, 1);
    acc.flush(lp);
  }, { door: 'crew', hinge: { at: dk(V3(hx, CREWDOOR.head, 0)).toArray(), axis: [0, 0, 1], angle: CREWDOOR.open } });
  p.door('crew', [hx + 1.8, 1.0 - DECK, (z0 + z1) / 2], CREWDOOR.near, CREWDOOR.speed);
  return p;
}
// the stair: a plate L long hinged a little under the sill; treads on its inner face (level when it is down)
const STAIR_Y = DECK - 0.045, STAIR_L = 1.96;
export const CREWSTAIR = { x: 1.10, y: STAIR_Y, L: STAIR_L, z: [2.86, 3.60], T: 0.05, steps: 4, angle: PI / 2 + Math.asin(STAIR_Y / STAIR_L), speed: 0.6 };
function hbStair(p) {
  const S = CREWSTAIR, [z0, z1] = S.z, L = S.L, T = S.T, ang = Math.asin(S.y / L), inn = V3(-1, 0, 0);
  // (as it stands stowed: u up the plate from the hinge, w inboard from its outer face)
  const W = (u, w, z) => V3(S.x - w, S.y + u, z);
  p.leaf('hb:crew stair', (lp) => {
    const acc = new Acc(), q = (pts, n, surf) => quad(acc, pts, n, surf);
    q([W(0, 0, z0), W(0, 0, z1), W(L, 0, z1), W(L, 0, z0)], V3(1, 0, 0), PAL.belly);
    q([W(0, T, z0), W(0, T, z1), W(L, T, z1), W(L, T, z0)], inn, PAL.deck);
    for (const [z, nz] of [[z0, -1], [z1, 1]]) q([W(0, 0, z), W(L, 0, z), W(L, T, z), W(0, T, z)], V3(0, 0, nz), PAL.darkEdge);
    q([W(L, 0, z0), W(L, 0, z1), W(L, T, z1), W(L, T, z0)], V3(0, 1, 0), PAL.darkEdge);
    q([W(0, 0, z0), W(0, 0, z1), W(0, T, z1), W(0, T, z0)], V3(0, -1, 0), PAL.darkEdge);
    for (const z of [z0 + 0.025, z1 - 0.025]) C.boxAt(acc, W(L / 2, T + 0.07, z), [V3(0, 1, 0), inn, V3(0, 0, 1)], [L / 2, 0.07, 0.025], PAL.black, ['v-'], dk);
    const rise = S.y / (S.steps + 1), ds = rise / Math.sin(ang), run = rise / Math.tan(ang), hu = Math.cos(ang), hw = Math.sin(ang);
    const zA = z0 + 0.05, zB = z1 - 0.05, fix = (n, ref) => (n.dot(ref) < 0 ? n.negate() : n);
    for (let k = 1; k <= S.steps; k++) {
      const u = k * ds, a = [u, 0], b = [u + hu * run * 0.92, hw * run * 0.92], c = [Math.min(u + ds, L - 0.01), 0];
      const tri = (v, z) => W(v[0], T + v[1], z);
      const nTop = fix(tri(b, 0).sub(tri(a, 0)).cross(V3(0, 0, 1)).normalize(), inn), nFront = fix(tri(c, 0).sub(tri(b, 0)).cross(V3(0, 0, 1)).normalize(), inn);
      q([tri(a, zA), tri(b, zA), tri(b, zB), tri(a, zB)], nTop, PAL.tread);
      q([tri(b, zA), tri(c, zA), tri(c, zB), tri(b, zB)], nFront, PAL.dark);
      for (const [z, nz] of [[zA, -1], [zB, 1]]) acc.tris([[tri(a, z), tri(b, z), tri(c, z)].map(dk)], V3(0, 0, nz), PAL.dark);
      const bn = [b[0] - hu * 0.06, b[1] - hw * 0.06], lift = nTop.clone().multiplyScalar(0.002);
      q([tri(bn, zA).add(lift), tri(b, zA).add(lift), tri(b, zB).add(lift), tri(bn, zB).add(lift)], nTop, PAL.yellow);
    }
    acc.flush(lp);
  }, { door: 'stair', hinge: { at: dk(V3(S.x, S.y, 0)).toArray(), axis: [0, 0, 1], angle: -S.angle } });
  p.door('stair', [S.x + 1.8, 1.0 - DECK, (z0 + z1) / 2], CREWDOOR.near, S.speed);
  return p;
}
// AT THE DOCK, ONCE THE BRIDGE HAS REACHED IT (src/haulerdock.js pose 'docked'; the game's maker, HAUL3-3 2026-11-20:
// "Once all nine rings are built, walk across it and in through the crew door"): the door lifted all the way, and the
// stair swung out level, lying on the docking tunnel's floor as the way in. (Stowed upright just inside the door it
// stands across the doorway; swung down its whole way it would go through the tunnel's floor.) Each a door's t: the kit
// turns a hinge by its angle times smooth(t) (kit/layout.js leafMatrix), so the stair's t is where that comes to a
// quarter turn.
const unsmooth = (k) => 0.5 - Math.sin(Math.asin(1 - 2 * k) / 3);
export const DOCKED = { crew: 1, stair: +unsmooth(PI / 2 / CREWSTAIR.angle).toFixed(5) };
// the door section's port side at a height (between its bilge, 0.83, and its roof, 3.27): where the docking tunnel's
// walls meet the hull round the door (src/haulerdock.js TUNNEL)
export const sideAt = (y) => sectX(Math.max(SECT[3][1], Math.min(SECT[11][1], y)));

// THE DOCKING LIGHTS (the game's maker, HAUL3-4 2026-11-20: "A ring of lights round the Hauler's crew door: red, then
// green when the bridge reaches it"): small lamps let into the door section's skin all round the crew door: a row over
// its head, a row under its sill, and two in the narrow strip of skin each side of it (between the door and the cab in
// front, the door and the core behind). Each a black housing and a glowing lens, flat on the skin.
//   variant 'port'            housings and red lenses (the Ship Lab, the Kit Lab: it waits for its bridge)
//   variant 'port, housings'  the housings alone: the game draws the lenses itself, in a colour it can change
//                             (src/haulerdock.js, dockLenses below: red, then green when the bridge reaches it)
export const DOCK_LIGHTS = {
  above: 3.17, below: 0.94, z: [2.93, 3.13, 3.33, 3.53], lamp: [0.11, 0.05],
  // (the side ones in the strip of skin each side of the door, clear of the docking tunnel's walls: src/haulerdock.js)
  side: { z: [2.762, 3.693], y: [1.72, 2.38] }, sideLamp: [0.026, 0.13], rim: 0.012, proud: 0.022,
  red: [1.6, 0.14, 0.1], green: [0.25, 2.2, 0.6],
};
// (the door section's profile at a height: its outward normal, in x and y)
function sectN(y) {
  for (let i = 3; i < 12; i++) { const [xa, ya] = SECT[i], [xb, yb] = SECT[i + 1]; if (y >= ya && y <= yb) { const n = V3(yb - ya, -(xb - xa), 0).normalize(); return n; } }
  return V3(1, 0, 0);
}
// every lamp: its middle on the skin, its normal, the way up its face (along the profile), its size (along z, up)
export function dockLamps() {
  const L = DOCK_LIGHTS, out = [];
  const at = (y, z, [w, h]) => { const n = sectN(y); out.push({ c: V3(sectX(y), y, z), n, up: V3(-n.y, n.x, 0), w, h }); };
  for (const z of L.z) { at(L.above, z, L.lamp); at(L.below, z, L.lamp); }
  for (const z of L.side.z) for (const y of L.side.y) at(y, z, L.sideLamp);
  return out;
}
function dockLights(acc, { housings = true, lens = null } = {}) {
  const L = DOCK_LIGHTS, Z = V3(0, 0, 1);
  for (const q of dockLamps()) {
    if (housings) boxAt(acc, q.c.clone().addScaledVector(q.n, L.proud / 2), [q.n, q.up, Z], [L.proud / 2, q.h / 2 + L.rim, q.w / 2 + L.rim], PAL.black, ['u-']);
    if (!lens) continue;
    const o = q.c.clone().addScaledVector(q.n, L.proud + 0.003), u = q.up.clone().multiplyScalar(q.h / 2), w = Z.clone().multiplyScalar(q.w / 2);
    quad(acc, [o.clone().sub(u).sub(w), o.clone().sub(u).add(w), o.clone().add(u).add(w), o.clone().add(u).sub(w)], q.n, lens, 'glow');
  }
}
function hbDockLights(p, variant) {
  const acc = new Acc();
  dockLights(acc, { lens: variant === 'port' ? DOCK_LIGHTS.red : null });
  return acc.flush(p);
}
// the lenses alone, as one geometry in the ship's own frame (its ground at y 0), for the game to draw in its own
// colour (src/haulerdock.js)
export function dockLenses() {
  const acc = new Acc(), list = [];
  dockLights(acc, { housings: false, lens: [1, 1, 1] });
  acc.flush({ add: (mat, g) => { list.push(g); } });
  const g = list.length === 1 ? list[0] : mergeGeometries(list);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  return g.translate(0, DECK, 0);
}
// the airlock just inside the door: a small lit room, a shut inner door on each end wall (forward to the cockpit,
// aft to the core), so an open door shows a room and not the empty hull
//   'port, cabin'   with the rooms built inside (LAB.cabin): the cabin's room at the door is the airlock (or the
//                   crew area), its wall at x CABIN_DOOR.x with the opening in it; this is only what lies between that
//                   wall and the hull's door: the jambs each side and the head over it (the floor is the cabin's own,
//                   run out to the sill: LAB.cabin.outer.sill)
export const CABIN_DOOR = { x: 1.0 };
function hbAirlock(p, variant) {
  if (variant === 'port, cabin') {
    const acc = new Acc(), [z0, z1] = CREWDOOR.z, y0 = CREWDOOR.sill, y1 = CREWDOOR.head, xi = CABIN_DOOR.x - 0.01, xs = sectX(y0), xh = sectX(y1);
    for (const [z, nz] of [[z0, 1], [z1, -1]]) polyTo(acc, [V3(xi, y0, z), ...doorProf().map(([x, y]) => V3(x, y, z)), V3(xi, y1, z)], V3(0, 0, nz), PAL.inner);
    quad(acc, [V3(xi, y1, z0), V3(xi, y1, z1), V3(xh, y1, z1), V3(xh, y1, z0)], V3(0, -1, 0), PAL.inner);
    quad(acc, [V3(xi, y0 - 0.002, z0), V3(xi, y0 - 0.002, z1), V3(xs, y0 - 0.002, z1), V3(xs, y0 - 0.002, z0)], V3(0, 1, 0), PAL.deck);
    quad(acc, [V3(xs - 0.1, y0 + 0.003, z0 + 0.02), V3(xs - 0.1, y0 + 0.003, z1 - 0.02), V3(xs - 0.01, y0 + 0.003, z1 - 0.02), V3(xs - 0.01, y0 + 0.003, z0 + 0.02)], V3(0, 1, 0), PAL.yellow);
    return acc.flush(p);
  }
  const acc = new Acc(), [z0, z1] = CREWDOOR.z, y0 = CREWDOOR.sill, y1 = CREWDOOR.head, xi = -1.0, xs = sectX(y0), xh = sectX(y1), zm = (z0 + z1) / 2;
  quad(acc, [V3(xi, y0, z0), V3(xi, y0, z1), V3(xs, y0, z1), V3(xs, y0, z0)], V3(0, 1, 0), PAL.deck);
  quad(acc, [V3(xi, y1, z0), V3(xi, y1, z1), V3(xh, y1, z1), V3(xh, y1, z0)], V3(0, -1, 0), PAL.inner);
  quad(acc, [V3(xi, y0, z0), V3(xi, y0, z1), V3(xi, y1, z1), V3(xi, y1, z0)], V3(1, 0, 0), PAL.inner);
  for (const [z, nz] of [[z0, 1], [z1, -1]]) {
    polyTo(acc, [V3(xi, y0, z), ...doorProf().map(([x, y]) => V3(x, y, z)), V3(xi, y1, z)], V3(0, 0, nz), PAL.inner);
    boxAt(acc, V3(0, y0 + 0.95, z + nz * 0.02), AX, [0.42, 0.95, 0.02], PAL.dark, [nz > 0 ? 'w-' : 'w+']);
    boxAt(acc, V3(0, y0 + 0.95, z + nz * 0.044), AX, [0.012, 0.91, 0.004], PAL.black, [nz > 0 ? 'w-' : 'w+']);
    quad(acc, [V3(-0.38, y0 + 1.91, z + nz * 0.004), V3(0.38, y0 + 1.91, z + nz * 0.004), V3(0.38, y0 + 1.95, z + nz * 0.004), V3(-0.38, y0 + 1.95, z + nz * 0.004)], V3(0, 0, nz), GLOW.strip, 'glow');
  }
  quad(acc, [V3(-0.35, y1 - 0.005, zm - 0.12), V3(0.35, y1 - 0.005, zm - 0.12), V3(0.35, y1 - 0.005, zm + 0.12), V3(-0.35, y1 - 0.005, zm + 0.12)], V3(0, -1, 0), GLOW.white, 'glow');
  // (a yellow edge along the sill)
  quad(acc, [V3(xs - 0.1, y0 + 0.003, z0 + 0.02), V3(xs - 0.1, y0 + 0.003, z1 - 0.02), V3(xs - 0.01, y0 + 0.003, z1 - 0.02), V3(xs - 0.01, y0 + 0.003, z0 + 0.02)], V3(0, 1, 0), PAL.yellow);
  p.light([0.3, y1 - DECK - 0.15, zm], 1.3, [1, 0.94, 0.85], [0, -1, 0], 3.5);
  return acc.flush(p);
}

// ── THE CARGO: eight mounts, a container on each, held in yellow clamp frames ────────────────────────────────────────
// A mount is a fixed place on the core's side: the container (cargo-container.js) sits on the frames' ledges with its
// middle at the mount's `at`, and four jaws swing over its outer corners. To unload one: its jaws fold back onto the
// posts, it slides straight out sideways (CARGO.out), and the dock lifts it away. Each mount is its own variant of
// hbContainer and hbClamp, so the dock can take any one of them.
export const CARGO = { x: 1.92, y: [1.55, 3.00], z: [0.63, -3.57], out: 1.6, lift: 1.4, speed: 0.5, jaw: 1.2, gap: 0.04 };
const MOUNT_COLOUR = { 'port upper front': 'blue', 'port upper rear': 'rust', 'port lower front': 'yellow', 'port lower rear': 'olive', 'starboard upper front': 'yellow', 'starboard upper rear': 'olive', 'starboard lower front': 'blue', 'starboard lower rear': 'rust' };
// THE MIX (the game's maker, HAUL-2 2026-11-20: "I think that having some A and some D would be good, since D looks like
// a liquid container, but A is recognizable"): some ribbed steel boxes, some eight-sided tanks (cargo-container.js
// LOOKS ribbed and tank), each in its mount's own colour. WHICH WHERE, AT RANDOM (HAUL3-1: "I would just do it
// randomly"): each mount a box or a tank, drawn when the Hauler is made (cargo-mix.js drawMix): drawMix() here draws a
// new one for all eight (src/haulerdock.js, once each time the game starts; the Ship Lab's Mix chip, each press).
// (the look drawn: 'mix' as above, or one look for all eight, the lab's chips: to compare)
export const CARGO_LOOK = { look: 'mix' };
export const MOUNTS = [];
for (const side of ['port', 'starboard']) for (const row of ['upper', 'lower']) for (const end of ['front', 'rear']) {
  const name = `${side} ${row} ${end}`, sx = side === 'port' ? 1 : -1;
  MOUNTS.push({ name, side, row, end, sx, at: [sx * CARGO.x, CARGO.y[row === 'upper' ? 1 : 0], CARGO.z[end === 'front' ? 0 : 1]], colour: MOUNT_COLOUR[name], look: null, turn: end === 'rear' });
}
// a new mix for all eight mounts (rand: () -> 0..1); the containers built after it show it (a container already built
// is kept by the kit's cache: forget 'hbContainer' first, kit/layout.js forgetPiece). -> { mount name: look }
export function drawMix(rand = Math.random) {
  const L = drawLooks(MOUNTS.map((m) => m.name), rand);
  for (const m of MOUNTS) m.look = L[m.name];
  return L;
}
drawMix();
const mountNamed = (name) => MOUNTS.find((m) => m.name === name) || MOUNTS[0];
const CX = CONTAINER.w / 2, CY = CONTAINER.h / 2, CZ = CONTAINER.l / 2;
// the clamp stations along each side (z, front to back) and which way each one's lips and jaws reach (to a container)
export const STATIONS = [{ z: [2.14, 2.58], to: -1 }, { z: [-1.28, -0.88], to: 1 }, { z: [-2.06, -1.66], to: -1 }, { z: [-5.48, -5.08], to: 1 }];
export const FRAME = { post: [2.45, 2.69], top: [3.66, 3.84], mid: [2.18, 2.34], low: [0.62, 0.88], reach: 0.14 };

function hbFrames(p) {
  const acc = new Acc(), F = FRAME, [px0, px1] = F.post;
  for (const sx of [1, -1]) {
    const X = (a, b) => [sx * a, sx * b], inFace = sx > 0 ? 'u-' : 'u+';
    for (const S of STATIONS) {
      const [za, zb] = S.z, face = S.to > 0 ? zb : za, lip = [face, face + S.to * (CARGO.gap + F.reach)];
      box(acc, X(px0, px1), [F.low[0], F.top[0]], [za, zb], PAL.dark, ['v+']);
      // (the top arm, yellow, from the spine out over the post; a black band; its lip over the container's top edge)
      box(acc, X(0.90, px1), F.top, [za, zb], PAL.yellow, [inFace]);
      box(acc, X(1.42, 2.02), [F.top[0] - 0.006, F.top[1] + 0.006], [za - 0.006, zb + 0.006], PAL.black, ['u+', 'u-']);
      box(acc, X(2.02, px1), F.top, lip, PAL.yellow, [S.to > 0 ? 'w-' : 'w+']);
      box(acc, X(2.12, 2.62), [F.top[0] - 0.06, F.top[0]], [face + S.to * 0.06, lip[1]], PAL.dark, ['v+']);
      // (the middle arm and the bottom arm, dark, each with a ledge the container above it sits on)
      box(acc, X(1.16, px0), F.mid, [za, zb], PAL.dark, ['u+', 'u-']);
      box(acc, X(1.22, 2.52), [F.mid[1], F.mid[1] + 0.06], [Math.min(za, lip[1]), Math.max(zb, lip[1])], PAL.belly, ['v-']);
      box(acc, X(1.0, px0), F.low, [za, zb], PAL.dark, ['u+', 'u-']);
      box(acc, X(1.22, 2.52), [F.low[1], F.low[1] + 0.07], [Math.min(za, lip[1]), Math.max(zb, lip[1])], PAL.belly, ['v-']);
      // (yellow knuckles on the post where the arms meet it)
      for (const y of [(F.mid[0] + F.mid[1]) / 2, (F.low[0] + F.low[1]) / 2]) box(acc, X(px0 - 0.02, px1 + 0.03), [y - 0.13, y + 0.13], [za - 0.012, zb + 0.012], PAL.yellow, [inFace]);
    }
    // (tie bars between the two middle stations, an amber light on each)
    const t0 = STATIONS[2].z[1], t1 = STATIONS[1].z[0];
    for (const y of [(F.mid[0] + F.mid[1]) / 2, (F.low[0] + F.low[1]) / 2]) {
      box(acc, X(px0 + 0.02, px1 - 0.02), [y - 0.08, y + 0.08], [t0, t1], PAL.dark, ['w+', 'w-']);
      const x = sx * (px1 - 0.02 + 0.004);
      quad(acc, [V3(x, y - 0.035, t0 + 0.1), V3(x, y - 0.035, t1 - 0.1), V3(x, y + 0.035, t1 - 0.1), V3(x, y + 0.035, t0 + 0.1)], V3(sx, 0, 0), GLOW.amber, 'glow');
    }
  }
  // (each mount on the core's side: a black plate, four yellow lock blocks, a small blue light)
  for (const m of MOUNTS) {
    const [, y, z] = m.at, sx = m.sx, x = sx * (BODY.coreX + 0.006), hy = CY - 0.075, hz = CZ - 0.125;
    quad(acc, [V3(x, y - hy, z - hz), V3(x, y - hy, z + hz), V3(x, y + hy, z + hz), V3(x, y + hy, z - hz)], V3(sx, 0, 0), PAL.black);
    for (const a of [1, -1]) for (const b of [1, -1]) box(acc, [sx * BODY.coreX, sx * (BODY.coreX + 0.1)], [y + a * 0.34 - 0.07, y + a * 0.34 + 0.07], [z + b * 0.95 - 0.09, z + b * 0.95 + 0.09], PAL.yellow, [sx > 0 ? 'u-' : 'u+']);
    quad(acc, [V3(x + sx * 0.004, y - 0.03, z - 0.2), V3(x + sx * 0.004, y - 0.03, z + 0.2), V3(x + sx * 0.004, y + 0.03, z + 0.2), V3(x + sx * 0.004, y + 0.03, z - 0.2)], V3(sx, 0, 0), GLOW.strip, 'glow');
  }
  return acc.flush(p);
}
// one container on its mount (variant: the mount's name): a leaf that slides straight out sideways; its look the
// mount's own in the mix, or the one look the lab asks for
export const lookOf = (m) => (CARGO_LOOK.look === 'mix' ? m.look : LOOKS[CARGO_LOOK.look] ? CARGO_LOOK.look : CONTAINER.look);
function hbContainer(p, variant) {
  const m = mountNamed(variant), c = dk(V3(...m.at)).toArray(), look = lookOf(m);
  p.leaf(`hb:container:${look}:${m.colour}`, (lp) => containerLeaf(lp, look, m.colour), { at: c, rot: [0, m.turn ? PI : 0, 0], slide: [m.sx * CARGO.out, 0, 0], door: 'container' });
  p.door('container', c, 0, CARGO.speed);
  return p;
}
// a mount's four jaws (variant: the mount's name): each a yellow arm hinged on a post's outer corner, reaching over the
// container's end at its outer face; it folds right back onto the post to let the container out
export const JAW = { len: 0.34, deep: 0.13, tall: 0.24, y: 0.39 };
function jawLeaf(lp, sx, sz) {
  const acc = new Acc(), same = (v) => v, b = (c, h, surf, skip = []) => C.boxAt(acc, c, AX, h, surf, skip, same);
  b(V3(-sx * JAW.deep / 2, 0, sz * JAW.len / 2), [JAW.deep / 2, JAW.tall / 2, JAW.len / 2], PAL.yellow);
  b(V3(-sx * (JAW.deep + 0.0125), 0, sz * (JAW.len - 0.1)), [0.0125, JAW.tall / 2 - 0.02, 0.1], PAL.dark, [sx > 0 ? 'u+' : 'u-']);
  b(V3(0, 0, 0), [0.03, JAW.tall / 2 + 0.02, 0.03], PAL.black);
  return acc.flush(lp);
}
function hbClamp(p, variant) {
  const m = mountNamed(variant), [, y, z] = m.at, sx = m.sx;
  for (const e of [1, -1]) for (const a of [1, -1]) {
    const h = dk(V3(sx * FRAME.post[1], y + a * JAW.y, z + e * (CZ + CARGO.gap))).toArray(), sz = -e;
    p.leaf(`hb:jaw:${sx}:${sz}`, (lp) => jawLeaf(lp, sx, sz), { at: h, door: 'clamp', hinge: { at: h, axis: [0, 1, 0], angle: sx * sz * PI } });
  }
  p.door('clamp', dk(V3(...m.at)).toArray(), 0, CARGO.jaw);
  return p;
}

// THE CARGO'S STATE, a number u per mount: 0 on and clamped, 1 its jaws open, 2 slid out, 3 lifted away (gone).
const clamp01 = (v) => Math.min(1, Math.max(0, v)), ease = (t) => t * t * (3 - 2 * t);
const CARGO_STATE = new WeakMap();
export function cargoOf(B) { let S = CARGO_STATE.get(B); if (!S) { S = { u: Object.fromEntries(MOUNTS.map((m) => [m.name, 0])) }; CARGO_STATE.set(B, S); } return S; }
// which mount a door record belongs to (the layout's records carry no variant: read it off where its first leaf sits)
function mountOf(D) {
  if (D.mount) return D.mount;
  const q = new THREE.Vector3().setFromMatrixPosition(D.leaves[0].base);
  D.mount = `${q.x > 0 ? 'port' : 'starboard'} ${q.y + DECK > (CARGO.y[0] + CARGO.y[1]) / 2 ? 'upper' : 'lower'} ${q.z > (CARGO.z[0] + CARGO.z[1]) / 2 ? 'front' : 'rear'}`;
  return D.mount;
}
const _up = new THREE.Matrix4();
// set every jaw and container to its mount's u (B: buildRoom's result)
export function cargoPose(B) {
  const S = cargoOf(B);
  for (const D of B.doors) {
    if (D.piece !== 'hbClamp' && D.piece !== 'hbContainer') continue;
    const u = S.u[mountOf(D)] ?? 0;
    if (D.piece === 'hbClamp') { D.t = clamp01(u); for (const L of D.leaves) C.poseLeaf(L, D.t); continue; }
    D.t = clamp01(u - 1);
    const up = ease(clamp01(u - 2)) * CARGO.lift;
    for (const L of D.leaves) C.poseLeaf(L, D.t, up > 0 ? _up.makeTranslation(0, up, 0) : null, u >= 3);
  }
}
// move every mount toward what is wanted: wants { mount name: 'on' | 'off' } (none: on), clampsOpen (the jaws of the
// loaded mounts stand open). Returns whether anything moved.
export function cargoStep(B, wants, clampsOpen, dt) {
  const S = cargoOf(B); let moved = false;
  for (const m of MOUNTS) {
    const u = S.u[m.name], target = wants?.[m.name] === 'off' ? 3 : clampsOpen ? 1 : 0;
    if (u === target) continue;
    const upw = target > u, seg = upw ? Math.floor(u + 1e-9) : Math.ceil(u - 1e-9) - 1, rate = seg < 1 ? CARGO.jaw : CARGO.speed;
    S.u[m.name] = upw ? Math.min(target, seg + 1, u + rate * dt) : Math.max(target, seg, u - rate * dt);
    moved = true;
  }
  cargoPose(B);
  return moved;
}

// ── THE PODS: the 8k mesh's own pods, all six THRUSTER PODS (the game's maker, HAUL-5 2026-11-20: "All six turn, and
// the front legs fold into the cab's belly instead"), built and moved as the Miner's are (miner-built.js PODS,
// POD_SWING, POD_JET, podJets, podStep: kit/ships/flight.js flies any ship's pods by these): four at the stern's
// corners, two high and two low, each on a short pylon out from the engine block's side; two at the front, one under
// each side of the cab (where his picture has them), each on a pylon out from the cab's lower side. Each turns on its
// pylon (yaw) and about its own middle (pitch), a jet at each end. At rest they face along the ship. They stand out far
// enough that a pod turned its whole way clears the hull (POD_SWING: less yaw than the Miner's, whose pods stand clear
// above and below): the front ones by 6.8 cm at their nearest (rigs/hauler-3/m_frontpod.js), the rear ones by 2.7 cm.
export const PODS = [
  { name: 'top rear port', at: [2.25, 3.72, -6.35], up: 1, mesh: 'rear', scale: 0.85, glow: 'amber' }, { name: 'top rear starboard', at: [-2.25, 3.72, -6.35], up: 1, mesh: 'rear', scale: 0.85, glow: 'amber' },
  { name: 'bottom rear port', at: [2.25, 1.22, -6.35], up: -1, mesh: 'rear', scale: 1.0, glow: 'strip' }, { name: 'bottom rear starboard', at: [-2.25, 1.22, -6.35], up: -1, mesh: 'rear', scale: 1.0, glow: 'strip' },
  { name: 'front port', at: [2.1, 0.92, 4.515], up: -1, mesh: 'front', scale: 1.1, glow: 'strip' }, { name: 'front starboard', at: [-2.1, 0.92, 4.515], up: -1, mesh: 'front', scale: 1.1, glow: 'strip' },
];
export const POD_SWING = { yaw: 0.25, pitch: 0.6 };
// (each pod's whole size at its scale, from the hull data's half sizes: as the Miner's POD.size)
export const POD_SIZE = Object.fromEntries(PODS.map((P) => [P.name, POD_HALF[P.mesh].map((h) => +(2 * h * P.scale).toFixed(3))]));
const podOf = (name) => PODS.find((q) => q.name === name) || PODS[0];
const POD_FACES = {};
function podFaces(name) {
  if (POD_FACES[name]) return POD_FACES[name];
  const M = mesh(POD[name]), out = [];
  for (let t = 0; t < M.tris.length / 3; t++) {
    const T = [0, 1, 2].map((k) => at(M, M.tris[t * 3 + k])), n = tnorm(T);
    if (n.lengthSq() < 1e-14) continue;
    out.push({ T, n: n.normalize(), kind: POD[name].kind[t] });
  }
  return (POD_FACES[name] = out);
}
// a pod's faces about a point o (its middle where it stands, by default), at its scale: sx -1 mirrors it to starboard
const podAt = (P, sx, o = P.at) => podFaces(P.mesh).map((f) => ({ pts: f.T.map((v) => V3(sx * (Math.abs(o[0]) + P.scale * v.x), o[1] + P.scale * v.y, o[2] + P.scale * v.z)), n: V3(sx * f.n.x, f.n.y, f.n.z), kind: f.kind }));
// a light laid on a pod: a black plate and a glowing strip on it, found by rays (from o along d; u, v across it); tf
// takes each point to where it is drawn (the deck's frame, or a leaf's own)
function podLight(acc, F, o, d, u, v, hu, hv, col, tf = dk) {
  const hit = (a, b, lift) => { const h = C.rayFaces(F, o.clone().addScaledVector(u, a).addScaledVector(v, b), d, () => true); return h ? h.p.addScaledVector(d, -lift) : null; };
  const n = d.clone().negate();
  for (const [k, lift, surf, mat] of [[1.45, 0.008, PAL.black, 'solid'], [1, 0.014, col, 'glow']]) {
    const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => hit(a * hu * (k > 1 ? 1.12 : 1), b * hv * k, lift));
    if (q.some((w) => !w)) return;
    // (flat: all four at the nearest one's depth, so the strip never dips into the pod)
    const near = Math.min(...q.map((w) => w.dot(d)));
    acc.poly(q.map((w) => tf(w.addScaledVector(d, near - w.dot(d)))), n, surf, mat, 99);
  }
}
const podPaint = (f) => (f.kind === 'b' ? PAL.yellow : f.n.y < -0.6 ? PAL.belly : PAL.dark);
function hbPods(p) {
  const acc = new Acc();
  // (the rear legs' housings: an outrigger under each side's rear containers, a beam in to the keel)
  for (const sx of [1, -1]) {
    const lz = GEAR.at['port rear'][1];
    box(acc, [sx * 1.15, sx * 1.85], [0.62, 0.92], [lz - 0.5, lz + 0.5], PAL.dark);
    box(acc, [sx * 1.13, sx * 1.87], [0.84, 0.9], [lz - 0.52, lz + 0.52], PAL.yellow, ['v+', 'v-']);
    box(acc, [sx * 0.5, sx * 1.15], [0.64, 0.86], [lz - 0.2, lz + 0.2], PAL.dark, ['u+', 'u-']);
  }
  // (the front legs' wells in the cab's belly: dark walls from the belly's cut edge up to the well's top, and the top,
  // the Medic's way (medic-built.js mdWells); the belly's skin over each is cut away: ZONES 'well', RULES)
  const belly = (x, z) => { const h = rayHull(V3(x, -1, z), V3(0, 1, 0)); return h ? h.p.y : FOLD.top; };
  const W = FOLD.well, top = FOLD.top, cx = (W.x[0] + W.x[1]) / 2, cz = (W.z[0] + W.z[1]) / 2;
  for (const s of [1, -1]) {
    const X = (x) => s * x, [x0, x1] = W.x, [z0, z1] = W.z;
    // (the belly at a point on the well's rim: sampled 3 cm outside the hole, where the skin is)
    const rim = (x, z) => belly(X(x + 0.03 * Math.sign(x - cx)), z + 0.03 * Math.sign(z - cz)) - 0.005;
    for (const [a, b, n] of [[[x0, z0], [x1, z0], V3(0, 0, 1)], [[x1, z1], [x0, z1], V3(0, 0, -1)], [[x0, z1], [x0, z0], V3(s, 0, 0)], [[x1, z0], [x1, z1], V3(-s, 0, 0)]]) {
      const k = 6;
      for (let i = 0; i < k; i++) {
        const u0 = i / k, u1 = (i + 1) / k, pa = [a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0], pb = [a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1];
        const ya = Math.min(top, rim(pa[0], pa[1])), yb = Math.min(top, rim(pb[0], pb[1]));
        polyTo(acc, [V3(X(pa[0]), ya, pa[1]), V3(X(pb[0]), yb, pb[1]), V3(X(pb[0]), top, pb[1]), V3(X(pa[0]), top, pa[1])], n, PAL.black);
      }
    }
    polyTo(acc, [V3(X(x0), top, z0), V3(X(x1), top, z0), V3(X(x1), top, z1), V3(X(x0), top, z1)], V3(0, -1, 0), PAL.black);
  }
  return acc.flush(p);
}
// a thruster pod (variant: its name): its pylon out from the hull's side (fixed: from the engine block's side at the
// stern, from the cab's lower side at the front), and the pod as a leaf turning on the pylon's end (yaw, about up) and
// about its own middle (pitch, about across): door 'pod', posed by podStep
function hbPod(p, name) {
  const P = podOf(name), sx = Math.sign(P.at[0]), c = V3(...P.at), half = POD_SIZE[P.name].map((v) => v / 2);
  const side = P.mesh === 'front' ? (() => { const h = rayHull(V3(sx * 4, c.y, c.z), V3(-sx, 0, 0)); return h ? Math.abs(h.p.x) : 1.0; })() : COLLAR[2][0];
  const acc = new Acc(), x0 = sx * (side - 0.04), x1 = sx * (Math.abs(c.x) - half[0] + 0.03);
  box(acc, [x0, x1], [c.y - 0.1, c.y + 0.1], [c.z - 0.14, c.z + 0.14], PAL.dark);
  box(acc, [x1 - sx * 0.06, x1], [c.y - 0.13, c.y + 0.13], [c.z - 0.17, c.z + 0.17], PAL.metal);
  acc.flush(p);
  const yaw = { at: dk(c).toArray(), axis: [0, 1, 0], angle: POD_SWING.yaw }, pitch = { at: dk(c).toArray(), axis: [1, 0, 0], angle: POD_SWING.pitch };
  p.leaf(`hb:pod:${P.scale}:${sx > 0 ? 'port' : 'starboard'}:${P.glow}`, (lp) => {
    const a = new Acc(), F = podAt(P, sx, [0, 0, 0]), same = (v) => v;
    for (const f of F) a.tris([f.pts], f.n, podPaint(f));
    // (its lights: on its outer side, and on its back end round the nozzle, his picture's)
    podLight(a, F, V3(sx * 3, 0.02, 0), V3(-sx, 0, 0), V3(0, 0, 1), V3(0, 1, 0), 0.2 * P.scale, 0.035 * P.scale, GLOW[P.glow], same);
    podLight(a, F, V3(0, 0.02, -3), V3(0, 0, 1), V3(1, 0, 0), V3(0, 1, 0), 0.16 * P.scale, 0.04 * P.scale, GLOW[P.glow], same);
    a.flush(lp);
  }, { at: dk(c).toArray(), door: 'pod', hinge: [yaw, pitch] });
  p.door('pod', dk(c).toArray(), 0, 1);
  return p;
}
// the pods' jets (plume.js): one at each end of each pod, at rest; podStep aims them as the pods turn (the Miner's)
export const POD_JET = { len: 10.0, gain: 1.2, r: 0.2, thrust: 0.85 };
export function podJets() { const out = []; for (const P of PODS) for (const sz of [1, -1]) out.push({ at: [P.at[0], P.at[1], P.at[2] + sz * (POD_SIZE[P.name][2] / 2 + 0.01)], dir: [0, 0, sz], r: +(POD_JET.r * P.scale).toFixed(3), pod: P.name, end: sz }); return out; }
// the pods: at rest facing along the ship; swinging (the lab's Thrusters), each turns through its yaw and pitch on its
// own slow beat and fires the jet at its trailing end in bursts; jets: plume.js's set of podJets (role 'pods'). The
// Miner's podStep, for this ship's pods.
const _pm = new THREE.Matrix4();
export function podStep(built, on, time, jets) {
  const pods = built.doors.filter((D) => D.piece === 'hbPod');
  const swing = (i) => (on ? [0.5 + 0.5 * Math.sin(time * 0.9 + i * 1.7), 0.5 + 0.5 * Math.sin(time * 1.3 + i * 2.3)] : [0.5, 0.5]);
  pods.forEach((D, i) => {
    const [ty, tp] = swing(i);
    for (const L of D.leaves) _pm.copy(C.poseLeaf(L, [2 * ty - 1, 2 * tp - 1]));
    if (!jets) return;
    const fire = on && Math.sin(time * 2.2 + i * 1.3) > -0.2, M = _pm.clone(), P = PODS[i];
    for (const [k, sz] of [[0, 1], [1, -1]]) {
      const J = jets.jets[i * 2 + k]; if (!J) continue;
      const endAt = V3(0, 0, sz * (POD_SIZE[P.name][2] / 2 + 0.01)).applyMatrix4(M), dir = V3(0, 0, sz).transformDirection(M);
      J.aim(endAt, dir); J.on = fire && (sz < 0) === (Math.sin(time * 0.45 + i) > 0);
    }
  });
}

// ── THE LEGS: four, each a long skid pad on a boot and twin rods ─────────────────────────────────────────────────────
// THE REAR TWO draw straight up into their housings (two leaves a leg, telescoping: the foot rises LEGS.rise, the rods
// less, so the rods stay inside the housing).
// THE FRONT TWO FOLD INTO THE CAB'S BELLY (the game's maker, HAUL-5 2026-11-20), each into its own well under the
// cockpit's floor, where the belly is flat (its middle, either side of the keel). The belly is too shallow under the
// cockpit (0.5 m) for a leg to rise straight up into it, so each folds, as the Explorer's and the Miner's do: its rods
// (side by side, across the ship) swing forward and up about a hinge under the cockpit's floor (FOLD.hinge), and its
// foot turns back about its ankle as they go, so it ends level, its sole in the belly's line over its well.
export const GEAR = { speed: 0.42, at: { 'port front': [0.32, 5.25], 'starboard front': [-0.32, 5.25], 'port rear': [1.5, -4.4], 'starboard rear': [-1.5, -4.4] } };
export const LEGS = { rise: 0.47, slip: 0.25, pad: [0.25, 0.75], sole: 0.03, top: 0.11, boot: [0.16, 0.22, 0.36], rod: 0.70 };
// (FOLD: with the paints at the top, as the belly's skin is cut by it)
const isFront = (which) => /front/.test(which);
const same = (v) => v;
function footLeaf(lp) {
  const acc = new Acc(), [hx, hz] = LEGS.pad, t = LEGS.top, y1 = 0.07;
  // (the pad's side profile (z, y): a flat sole, its toe and heel sloped up)
  const prof = [[-hz + 0.15, 0], [hz - 0.15, 0], [hz, y1], [hz, t], [-hz, t], [-hz, y1]];
  for (const sx of [1, -1]) acc.poly(prof.map(([z, y]) => V3(sx * hx, y, z)), V3(sx, 0, 0), PAL.legs, 'solid', 99);
  prof.forEach(([za, ya], i) => {
    const [zb, yb] = prof[(i + 1) % prof.length], n = V3(0, -(zb - za), yb - ya).normalize();
    acc.poly([V3(-hx, ya, za), V3(hx, ya, za), V3(hx, yb, zb), V3(-hx, yb, zb)], n, i === 0 ? PAL.rubber : PAL.legs, 'solid', 99);
  });
  const [bx, bz, by] = LEGS.boot;
  C.boxAt(acc, V3(0, (t + by) / 2, 0), AX, [bx, (by - t) / 2, bz], PAL.legs, ['v-'], same);
  C.boxAt(acc, V3(0, by - 0.03, 0), AX, [bx + 0.012, 0.03, bz + 0.012], PAL.yellow, ['v-', 'v+'], same);
  // (a gusset from the boot down to the pad, fore and aft)
  for (const sz of [1, -1]) {
    const a = V3(0, t, sz * bz), b = V3(0, t, sz * (hz - 0.2)), c = V3(0, by - 0.08, sz * bz), w = V3(0.05, 0, 0);
    for (const sx of [1, -1]) acc.tris([[a.clone().addScaledVector(w, sx), b.clone().addScaledVector(w, sx), c.clone().addScaledVector(w, sx)]], V3(sx, 0, 0), PAL.legs);
    acc.poly([b.clone().sub(w), b.clone().add(w), c.clone().add(w), c.clone().sub(w)], V3(0, hz - 0.2 - bz, sz * (by - 0.08 - t)).normalize(), PAL.legs, 'solid', 99);
  }
  return acc.flush(lp);
}
function strutLeaf(lp) {
  const acc = new Acc(), y0 = LEGS.boot[2], y1 = LEGS.rod;
  for (const sz of [1, -1]) C.boxAt(acc, V3(0, (y0 + y1) / 2, sz * 0.12), AX, [0.035, (y1 - y0) / 2, 0.035], PAL.metal, ['v-', 'v+'], same);
  return acc.flush(lp);
}
// (a front leg's rods: from the boot up to the hinge, side by side across the ship, so folded they lie side by side
// under the cockpit's floor; a knuckle on the hinge)
function foldStrutLeaf(lp) {
  const acc = new Acc(), y0 = LEGS.boot[2], y1 = FOLD.hinge;
  for (const sx of [1, -1]) C.boxAt(acc, V3(sx * 0.12, (y0 + y1) / 2, 0), AX, [0.035, (y1 - y0) / 2, 0.035], PAL.metal, ['v-', 'v+'], same);
  C.boxAt(acc, V3(0, y1, 0), AX, [0.17, 0.05, 0.06], PAL.legs, [], same);
  return acc.flush(lp);
}
function hbGear(p, which) {
  const [cx, cz] = GEAR.at[which] || GEAR.at['port front'], o = [cx, -DECK, cz];
  if (isFront(which)) {
    // (the rods turn about the hinge; the foot with them, and back the same about its ankle: level all the way)
    const hinge = { at: [cx, FOLD.hinge - DECK, cz], axis: [1, 0, 0], angle: FOLD.turn }, ankle = { at: [cx, LEGS.boot[2] - DECK, cz], axis: [1, 0, 0], angle: -FOLD.turn };
    p.leaf('hb:leg foot', footLeaf, { at: o, door: 'gear', hinge: [hinge, ankle] });
    p.leaf('hb:leg strut fold', foldStrutLeaf, { at: o, door: 'gear', hinge });
  } else {
    p.leaf('hb:leg foot', footLeaf, { at: o, slide: [0, LEGS.rise, 0], door: 'gear' });
    p.leaf('hb:leg strut', strutLeaf, { at: o, slide: [0, LEGS.rise - LEGS.slip, 0], door: 'gear' });
  }
  p.door('gear', o, 0, GEAR.speed);
  return p;
}

// ── THE MARKS AND LAMPS: his blue strips (under each side window, on the nose's front, on the roof behind the
// windscreen) and an amber headlamp each side of the nose ───────────────────────────────────────────────────────────
const lifted = (h, lift) => (h ? h.p.addScaledVector(h.n, lift) : null);
const onSide = (sx, y, z, lift = 0.012) => lifted(rayHull(V3(sx * 8, y, z), V3(-sx, 0, 0)), lift);
const onFront = (x, y, lift = 0.012) => lifted(rayHull(V3(x, y, 12), V3(0, 0, -1)), lift);
const onTop = (x, z, lift = 0.012) => lifted(rayHull(V3(x, 9, z), V3(0, -1, 0)), lift);
export const MARKS = {
  side: { z: [5.0, 5.55], y: 2.04, h: 0.1 }, nose: { x: 0.3, y: 1.96, h: 0.07 }, roof: { x: 0.25, z: [6.42, 6.54] },
  lamp: { x: 0.62, y: 1.38, w: 0.36, h: 0.26, rim: 0.04 },
};
function hbMarks(p) {
  const acc = new Acc(), M = MARKS;
  for (const sx of [1, -1]) {
    const { z: [z0, z1], y, h } = M.side, n = Math.max(2, Math.ceil((z1 - z0) / 0.25));
    for (let i = 0; i < n; i++) {
      const za = z0 + (z1 - z0) * i / n, zb = z0 + (z1 - z0) * (i + 1) / n;
      const q = [onSide(sx, y - h / 2, za), onSide(sx, y - h / 2, zb), onSide(sx, y + h / 2, zb), onSide(sx, y + h / 2, za)];
      if (q.some((v) => !v)) continue;
      acc.poly(q.map(dk), V3(sx, 0, 0), GLOW.strip, 'glow', 99);
    }
    // (the headlamp: a black housing let into the nose's front, its lens warm)
    const L = M.lamp, x = sx * L.x, zs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => onFront(x + a * (L.w / 2 + L.rim), L.y + b * (L.h / 2 + L.rim), 0)).filter((v) => v).map((v) => v.z);
    if (zs.length === 4) {
      const zf = Math.max(...zs) + 0.04, zb = Math.min(...zs) - 0.06;
      boxAt(acc, V3(x, L.y, (zf + zb) / 2), AX, [L.w / 2 + L.rim, L.h / 2 + L.rim, (zf - zb) / 2], PAL.black, ['w-']);
      quad(acc, [V3(x - L.w / 2, L.y - L.h / 2, zf + 0.004), V3(x + L.w / 2, L.y - L.h / 2, zf + 0.004), V3(x + L.w / 2, L.y + L.h / 2, zf + 0.004), V3(x - L.w / 2, L.y + L.h / 2, zf + 0.004)], V3(0, 0, 1), GLOW.warm, 'glow');
      p.light([x, L.y - DECK, zf + 0.3], 0.6, [1.2, 0.85, 0.45], [0, -0.3, 1], 4);
    }
  }
  const N = M.nose, c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => onFront(a * N.x, N.y + b * N.h / 2));
  if (c.every((v) => v)) acc.poly(c.map(dk), V3(0, 0, 1), GLOW.strip, 'glow', 99);
  const R = M.roof, r = [[-1, 0], [1, 0], [1, 1], [-1, 1]].map(([a, b]) => onTop(a * R.x, R.z[b]));
  if (r.every((v) => v)) acc.poly(r.map(dk), V3(0, 1, 0), GLOW.strip, 'glow', 99);
  return acc.flush(p);
}

// ── THE COCKPIT FOR FOUR (his deck plan's, the game's maker's pick, HAUL-1 2026-11-20): two bucket seats side by side
// behind the glass (the cockpit family's parts) and two crew seats behind them (COCKPIT.rear), on a floor 0.3 m over the
// cabin's deck (his plan's: one step up, as the Explorer's), its back wall at z `back` (the plan's cockpit starts
// there). Its floor runs out to the hull's inside; under the glass the nose's own skin (drawn both ways) closes it;
// between the glass's back edge and the back wall the CHEEKS, a dark wall each side from the floor to the roof (the 3k
// nose is open there, behind the side windows), and a dark roof over them (no sky through a gap from the seats:
// rigs/hauler-2/checks.cjs); the back wall:
//   'four seats'         a bulkhead out to the hull's inside, a shut door in it (the ship with no rooms built inside:
//                        waiting at the dock, src/haulerdock.js)
//   'four seats, cabin'  with the rooms built inside (LAB.cabin): the back wall is the cabin's own (the cockpit's door in
//                        it); a riser there, the step up; round the cabin's wall, a dark panel out to the hull and roof
export const COCKPIT = { floor: 0.3, seatsZ: 5.15, wallX: 1.2, gap: 0.40, back: 4.0, front: 7.6, tubX: 1.1, rear: { x: [0.72, -0.72], z: 4.4 }, cabinWall: { half: 1.0, top: 2.5 }, dash: { w: 1.5, h: 0.72, knee: 0.55, bow: 0.12, depth: 1.0 }, canopy: { y: 2.166 - DECK0 - 0.3, z: 7.787 - 5.15, slope: 0.78 } };
export const COCKPIT_DROP = /^overhead|^handhold|^engineer|^locker/;
export const builtCockpitPlan = () => C.builtCockpitPlan(COCKPIT, COCKPIT_DROP);
function hbCockpit(p, variant) {
  const Cp = COCKPIT, cabin = /, cabin$/.test(variant || ''), zb = Cp.back, fy = DECK + Cp.floor;
  C.cockpitParts(p, builtCockpitPlan(), Cp);
  // (the cockpit for four, his deck plan's: two crew seats behind the fliers, facing forward)
  for (const x of COCKPIT.rear.x) placeInto(p, part(crewSeat, { look: 'ship', badge: 'crew' }), { at: [x, Cp.floor, COCKPIT.rear.z], rot: [0, 0, 0] });
  const acc = new Acc(), out = canopyPanes().outline;
  // THE FLOOR out to the hull's inside, row by row from the back wall to the nose (under the glass the nose's own skin,
  // drawn both ways, closes the cockpit: its canopy has no roof pane, so a tub down from the glass's edges would wall
  // off the windscreen)
  const halfAt = (s, z, y = fy + 0.04) => { const h = rayHull(V3(0, y, z), V3(s, 0, 0)); return h ? Math.abs(h.p.x) - 0.03 : 0.5; };
  const rows = [];
  for (let z = zb; z <= Cp.front + 1e-6; z += 0.25) { const a = halfAt(1, z), b = halfAt(-1, z); if (a + b > 0.2) rows.push([z, a, -b]); }
  for (let i = 0; i < rows.length - 1; i++) { const [za, pa, sa] = rows[i], [zc, pb, sb] = rows[i + 1]; quad(acc, [V3(sa, fy, za), V3(pa, fy, za), V3(pb, fy, zc), V3(sb, fy, zc)], V3(0, 1, 0), PAL.deck); }
  // (the cheeks stand at the narrowest the hull's inside is between the back wall and the glass, at the floor and up a
  // seated person's height, so they never come out through the skin)
  const zg0 = Math.min(...out.flatMap((sp) => [sp.a.z, sp.b.z])), hs = [];
  for (let z = zb + 0.05; z <= zg0 + 0.02; z += 0.1) for (const y of [fy + 0.04, fy + 0.6, fy + 1.2]) hs.push(halfAt(1, z, y), halfAt(-1, z, y));
  const gx = Math.min(...hs, Cp.tubX);
  // THE CHEEKS AND THEIR ROOF, from the back wall to the glass's back edge, a little inside the skin, never through it
  // (both faces dark: drawn twice): each cheek's top under the roof at its side, a ridge under the roof's middle
  const zg = Math.min(...out.flatMap((sp) => [sp.a.z, sp.b.z])) + 0.02, both = (pts, n) => { polyTo(acc, pts, n, PAL.dark); polyTo(acc, pts, n.clone().negate(), PAL.dark); };
  const roofAt = (x, z) => { for (let k = 0; k < 6; k++) { const h = rayHull(V3(x * (1 - k * 0.12), fy + 0.5, z), V3(0, 1, 0)); if (h) return h.p.y - 0.03; } return fy + 1.9; };
  const top = (s, z) => (s ? roofAt(s * (gx - 0.05), z) : roofAt(0, z));
  for (const s of [1, -1]) {
    const x = s * gx;
    both([V3(x, fy, zb), V3(x, fy, zg), V3(x, top(s, zg), zg), V3(x, top(s, zb), zb)], V3(-s, 0, 0));
    both([V3(x, top(s, zb), zb), V3(x, top(s, zg), zg), V3(0, top(0, zg), zg), V3(0, top(0, zb), zb)], V3(-s * 0.3, -1, 0).normalize());
  }
  // THE BACK WALL's outline at zb: out to the cheeks, up to their tops and the ridge
  const back = [V3(-gx, fy, zb), V3(gx, fy, zb), V3(gx, top(1, zb), zb), V3(0, top(0, zb), zb), V3(-gx, top(-1, zb), zb)];
  const W = Cp.cabinWall, wt = DECK + W.top;
  if (cabin) {
    // (the riser, the step up, facing the room behind, its nosing striped; round the cabin's own wall (W.half each side,
    // W.top over the deck), a dark panel facing the cockpit: beside it, and over it)
    polyTo(acc, [V3(-gx, DECK, zb), V3(gx, DECK, zb), V3(gx, fy, zb), V3(-gx, fy, zb)], V3(0, 0, -1), PAL.darkEdge);
    for (let i = 0; i < 6; i++) polyTo(acc, [V3(-gx + i * gx / 3, fy - 0.004, zb - 0.004), V3(-gx + (i + 0.5) * gx / 3, fy - 0.004, zb - 0.004), V3(-gx + (i + 0.5) * gx / 3, fy - 0.07, zb - 0.004), V3(-gx + i * gx / 3, fy - 0.07, zb - 0.004)], V3(0, 0, -1), PAL.yellow);
    const lift = (P) => P.map((v) => V3(v.x, v.y, zb + 0.004));
    for (const s of [1, -1]) if (gx > W.half + 1e-3) {
      // (the part past the wall's end: under the outline's top edge from the cheek to the ridge)
      const yAt = top(0, zb) + (top(s, zb) - top(0, zb)) * W.half / gx;
      polyTo(acc, lift([V3(s * W.half, fy, 0), V3(s * gx, fy, 0), V3(s * gx, top(s, zb), 0), V3(s * W.half, yAt, 0)]), V3(0, 0, 1), PAL.dark);
    }
    const over = C.clipPlane(back, [0, -1, 0, -(wt - 0.03)])[0];   // (the part over the wall's top)
    if (over?.length >= 3) polyTo(acc, lift(over), V3(0, 0, 1), PAL.dark);
    for (const x of [-0.5, 0.5]) p.light([x, Cp.floor + 1.75, Cp.seatsZ - 0.3], 1.0, [1.25, 0.85, 0.55], [0, -1, 0.2], 3.0);
    p.light([0, Cp.floor + 1.0, Cp.seatsZ + 1.0], 0.7, [0.35, 0.65, 1.0], [0, 0.2, -1], 2.5);
    return acc.flush(p);
  }
  // (no cabin: a bulkhead across the whole outline, a shut door in it, a lit strip over it)
  polyTo(acc, back, V3(0, 0, 1), PAL.dark);
  boxAt(acc, V3(0, fy + 0.95, zb + 0.03), AX, [0.42, 0.95, 0.03], PAL.door, ['w-']);
  boxAt(acc, V3(0, fy + 0.95, zb + 0.065), AX, [0.012, 0.91, 0.006], PAL.black, ['w-']);
  quad(acc, [V3(-0.38, fy + 1.96, zb + 0.062), V3(0.38, fy + 1.96, zb + 0.062), V3(0.38, fy + 2.0, zb + 0.062), V3(-0.38, fy + 2.0, zb + 0.062)], V3(0, 0, 1), GLOW.strip, 'glow');
  for (const x of [-0.5, 0.5]) p.light([x, Cp.floor + 1.75, Cp.seatsZ - 0.3], 1.0, [1.25, 0.85, 0.55], [0, -1, 0.2], 3.0);
  p.light([0, Cp.floor + 1.0, Cp.seatsZ + 1.0], 0.7, [0.35, 0.65, 1.0], [0, 0.2, -1], 2.5);
  return acc.flush(p);
}

// ── THE GRIME (built-common.js grimeMaterials) ──────────────────────────────────────────────────────────────────────
export const STREAKS = [
  // [x, y, z, flow dx, dy, dz, length, width]: soot forward up each drum from its rim; runs down the block's sides
  // and from each clamp station's top arm; along the spine's top; down from the door's head
  [0.64, 3.2, -8.0, 0, 0, 1, 1.4, 1.2], [-0.67, 3.2, -8.0, 0, 0, 1, 1.4, 1.2],
  [1.62, 3.8, -6.6, 0, -1, -0.1, 2.0, 0.5], [-1.62, 3.8, -6.6, 0, -1, -0.1, 2.0, 0.5],
  [2.6, 3.7, 2.36, 0, -1, -0.1, 2.4, 0.3], [-2.6, 3.7, 2.36, 0, -1, -0.1, 2.4, 0.3], [2.6, 3.7, -5.28, 0, -1, -0.1, 2.4, 0.3], [-2.6, 3.7, -5.28, 0, -1, -0.1, 2.4, 0.3],
  [0, 3.95, 1.5, 0, -0.05, -1, 4.0, 0.6], [1.67, 2.6, 3.2, 0, -1, -0.15, 1.4, 0.3], [-1.67, 2.6, 3.2, 0, -1, -0.15, 1.4, 0.3],
];
export const GRIME = { dirt: { value: 0.45 } };
// (the glass: the shared smoked glass, a little bluer and darker, as his picture's)
export const GLASS_TINT = { color: 0x0e1a26, opacity: 0.5 };
export const grimeMaterials = (mats, { dirt } = {}) => {
  const M = C.grimeMaterials(mats, { dirt, streaks: STREAKS, deck: DECK, grime: GRIME, key: 'hbgrime', glowKey: 'hbglow' });
  M.glass = M.glass.clone(); M.glass.color.setHex(GLASS_TINT.color); M.glass.opacity = GLASS_TINT.opacity; M.glass.name = 'glass'; M.glassInst = M.glass;
  return M;
};

// ── MOVING THE PARTS (the game, or the lab) ─────────────────────────────────────────────────────────────────────────
const doorsOf = (built, piece) => built.doors.filter((D) => D.piece === piece);
const _eye = new THREE.Vector3();
// the gear: up (1) or down (0)
export const gearStep = (built, up, dt, updateDoors) => updateDoors(doorsOf(built, 'hbGear'), _eye.set(0, 0, 0), dt, up ? 'open' : 'shut');
// the way in: opening, the door lifts and then the stair swings down; shutting, the stair first and then the door
export function doorStep(built, open, dt, updateDoors) {
  const door = doorsOf(built, 'hbCrewDoor'), stair = doorsOf(built, 'hbStair'), eye = _eye.set(0, 0, 0);
  if (open) { const m = updateDoors(door, eye, dt, 'open'); return door.every((D) => D.t >= 1) ? updateDoors(stair, eye, dt, 'open') || m : m; }
  const m = updateDoors(stair, eye, dt, 'shut'); return stair.every((D) => D.t <= 0) ? updateDoors(door, eye, dt, 'shut') || m : m;
}
// the order the lab unloads in: the upper row first, front to back, port then starboard
export const UNLOAD = ['upper front', 'upper rear', 'lower front', 'lower rear'].flatMap((k) => [`port ${k}`, `starboard ${k}`]);

// ── IN THE SHIP LAB (labs/ships/main.js) ────────────────────────────────────────────────────────────────────────────
// (the lab's own state for this ship, kept on its st: what is wanted of each mount, and the clamps)
const labState = (st) => (st.hauler ||= { want: {}, clamps: 'shut' });
export const LAB = {
  // (the controls the other ships share, by the same names: the thruster pods, the cargo on and off (the Miner's
  // 'canisters', named for this ship by `cargo`), the gear, the way in, the dirt, the throttle)
  controls: ['thrusters', 'canisters', 'gear', 'door', 'dirt', 'throttle'],
  cargo: { name: 'Containers', tip: 'The eight containers in their clamp frames, or all unloaded: the jaws open, each container slides out and is lifted away' },
  // (the rooms built inside from the blueprint shown, kit/ships/cabin-built.js: the pieces that change with them (the
  // cockpit closed by the cabin's own wall, the airlock stub down to the door's jambs and head), and the ship's own door
  // as the cabin meets it: its head over the deck (the slope over it starts there), where the deck stops at its sill)
  cabin: { swap: { hbCockpit: { 'four seats': 'four seats, cabin' }, hbAirlock: { port: 'port, cabin' } }, outer: { head: +(CREWDOOR.head - DECK).toFixed(3), sill: +(sectX(CREWDOOR.sill) - 0.01).toFixed(3) } },
  dirt: { None: 0, Some: 0.45, Lots: 0.9 },
  spots: { Canopy: { at: [4.6, 4.3, 11.8], look: [0, 2.6, 6.2] }, Door: { at: [7.0, 2.0, 6.4], look: [1.4, 1.7, 3.2] }, Clamps: { at: [7.5, 3.4, 2.6], look: [2.0, 2.3, -1.2] }, Stern: { at: [4.0, 4.2, -15.5], look: [0, 2.4, -7] }, Seats: { at: [0, 2.6, 4.85], look: [0, 2.3, 8.0] }, Cockpit: { at: [0, 3.05, 6.25], look: [0, 1.55, 4.0] } },
  doorTip: 'Open the crew door (it lifts, then the stair swings down to the ground), or shut it',
  gearTip: 'Fold the front legs up into the cab\'s belly and draw the rear legs up into their housings, or let them down',
  materials: (mats, dirt) => grimeMaterials(mats, { dirt }),
  setDirt: (v) => { GRIME.dirt.value = v; },
  jets: () => [{ role: 'main', nozzles: jetNozzles(), opts: JET }, { role: 'pods', nozzles: podJets(), opts: { len: POD_JET.len, gain: POD_JET.gain } }],
  // this ship's own chips for the lab's menu (beside the shared Containers on / off): one container at a time, the
  // clamps, and the containers' look
  menu({ sep, lab, chip, menu, st, reload }) {
    const H = labState(st), off = (n) => H.want[n] === 'off' || (!st.canisters && H.want[n] !== 'on');
    const count = MOUNTS.filter((m) => !off(m.name)).length;
    return [
      sep(), lab(`Loaded ${count}/8`),
      chip('Unload one', false, () => { const n = UNLOAD.find((q) => !off(q)); if (n) H.want[n] = 'off'; menu(); }, true, 'Take the next container off (upper row first)'),
      chip('Load one', false, () => { const n = UNLOAD.slice().reverse().find(off); if (n) H.want[n] = 'on'; menu(); }, true, 'Put the last container back'),
      sep(), lab('Clamps'),
      chip(H.clamps === 'open' ? 'Shut clamps' : 'Open clamps', false, () => { H.clamps = H.clamps === 'open' ? 'shut' : 'open'; menu(); }, true, 'Fold the jaws back onto the posts, or swing them over the containers'),
      sep(), lab('Container'),
      // (Mix: his pick, each container a box or a tank at random; pressed again, another mix)
      ...[['mix', { name: 'Mix', about: 'His pick: each container a ribbed steel box or an eight-sided tank, at random (press again for another mix)' }], ...Object.entries(LOOKS)].map(([k, L], i) => chip(`${i + 1} ${L.name}`, CARGO_LOOK.look === k, () => { if (k === 'mix') drawMix(); else if (CARGO_LOOK.look === k) return; CARGO_LOOK.look = k; reload(['hbContainer']); }, true, k === 'mix' ? L.about : 'All eight: ' + L.about)),
    ];
  },
  step(B, st, dt, { updateDoors, person, jets, time }) {
    const H = labState(st);
    // (the shared Containers chip sets them all; Unload one / Load one, each one: the shared chip clears those)
    if (H.all !== st.canisters) { H.all = st.canisters; H.want = {}; }
    const wants = Object.fromEntries(MOUNTS.map((m) => [m.name, H.want[m.name] || (st.canisters === false ? 'off' : 'on')]));
    if (!CARGO_STATE.has(B)) { const S = cargoOf(B); for (const m of MOUNTS) S.u[m.name] = wants[m.name] === 'off' ? 3 : H.clamps === 'open' ? 1 : 0; }
    gearStep(B, st.gear === 'up', dt, updateDoors);
    const D = doorsOf(B, 'hbCrewDoor')[0];
    doorStep(B, st.door === 'open' || (st.door !== 'shut' && !!D && person.position.distanceTo(D.sense) < D.near), dt, updateDoors);
    cargoStep(B, wants, H.clamps === 'open', dt);
    const pj = jets?.find((J) => J.role === 'pods')?.set;
    if (pj) pj.setThrust(st.thrusters ? POD_JET.thrust : 0);
    podStep(B, st.thrusters, time, pj);
  },
  // (for pictures part way: { gear, crew, stair, clamps } each 0 to 1; cargo: a u for every mount (0 on, 1 jaws
  // open, 2 slid out, 3 gone) or { mount name: u }; thrusters: a time to hold the pods' swing at, or false)
  pose(B, at, { updateDoors, jets }) {
    const pj = jets?.find?.((J) => J.role === 'pods')?.set;
    if (at.thrusters != null) { if (pj) pj.setThrust(at.thrusters === false ? 0 : POD_JET.thrust, true); podStep(B, at.thrusters !== false, at.thrusters === false ? 0 : at.thrusters, pj); }
    const of = { gear: 'hbGear', crew: 'hbCrewDoor', stair: 'hbStair' }, S = cargoOf(B);
    for (const [k, t] of Object.entries(at)) {
      if (!of[k]) continue;
      for (const D of doorsOf(B, of[k])) { D.t = t > 0 ? 0 : 1; updateDoors([D], new THREE.Vector3(), t > 0 ? t / D.speed : 2 / D.speed, t > 0 ? 'open' : 'shut'); }
    }
    if (at.clamps != null) for (const m of MOUNTS) S.u[m.name] = clamp01(at.clamps);
    if (typeof at.cargo === 'number') for (const m of MOUNTS) S.u[m.name] = at.cargo;
    else if (at.cargo) for (const [n, u] of Object.entries(at.cargo)) if (n in S.u) S.u[n] = u;
    cargoPose(B);
  },
};

// ── the catalog ─────────────────────────────────────────────────────────────────────────────────────────────────────
const GR = 'Ships', MOUNT_NAMES = MOUNTS.map((m) => m.name);
export const SHIP_HAULER_BUILT = {
  hbHull: { name: 'Hauler (built): nose and engine block', group: GR, at: 'free', foot: [3.4, 4, 16], variants: ['hull'], build: hbHull },
  hbBody: { name: 'Hauler (built): door section, core and spine', group: GR, at: 'free', foot: [3.4, 4, 10], variants: ['body'], build: hbBody },
  hbCanopy: { name: 'Hauler (built): canopy', group: GR, at: 'free', foot: [2.6, 1.2, 3.2], variants: ['glass'], build: hbCanopy },
  hbMarks: { name: 'Hauler (built): lights and marks', group: GR, at: 'free', foot: [3, 2, 4], variants: ['marks'], build: (p) => hbMarks(p) },
  hbFrames: { name: 'Hauler (built): clamp frames and mounts', group: GR, at: 'free', foot: [5.2, 3.3, 8.1], variants: ['frames'], build: hbFrames },
  hbClamp: { name: 'Hauler (built): a mount\'s jaws', group: GR, at: 'free', foot: [0.3, 1.1, 3.1], variants: MOUNT_NAMES, build: hbClamp },
  hbContainer: { name: 'Hauler (built): a container on its mount', group: GR, at: 'free', foot: [CONTAINER.w, CONTAINER.h, CONTAINER.l], variants: MOUNT_NAMES, build: hbContainer },
  hbPods: { name: 'Hauler (built): the rear legs\' housings and the front legs\' wells', group: GR, at: 'free', foot: [4.6, 3.5, 12.5], variants: ['pods'], build: hbPods },
  hbPod: { name: 'Hauler (built): thruster pod', group: GR, at: 'free', foot: [1, 1, 1.5], variants: PODS.map((q) => q.name), build: hbPod },
  hbGear: { name: 'Hauler (built): landing leg', group: GR, at: 'free', foot: [0.5, 0.7, 1.5], variants: Object.keys(GEAR.at), build: hbGear },
  hbCrewDoor: { name: 'Hauler (built): crew door', group: GR, at: 'free', foot: [0.6, 2.0, 0.85], variants: ['port'], build: (p) => hbCrewDoor(p) },
  hbStair: { name: 'Hauler (built): crew stair', group: GR, at: 'free', foot: [0.3, 2.0, 0.8], variants: ['port'], build: (p) => hbStair(p) },
  hbDockLights: { name: 'Hauler (built): docking lights round the crew door', group: GR, at: 'free', foot: [0.2, 2.4, 1.0], variants: ['port', 'port, housings'], build: (p, v) => hbDockLights(p, v) },
  hbAirlock: { name: 'Hauler (built): crew airlock', group: GR, at: 'free', foot: [2.2, 2.0, 0.85], variants: ['port', 'port, cabin'], build: (p, v) => hbAirlock(p, v) },
  hbCockpit: { name: 'Hauler (built): cockpit', group: GR, at: 'free', foot: [2.4, 2, 3.4], variants: ['four seats', 'four seats, cabin'], build: (p, v) => hbCockpit(p, v) },
  cargoContainer: { name: 'Cargo container (shared)', group: GR, at: 'free', foot: [CONTAINER.w, CONTAINER.h, CONTAINER.l], variants: Object.keys(LOOKS).flatMap((k) => [k, ...Object.keys(COLOURS).slice(1, 3).map((c) => `${k}:${c}`)]), build: cargoContainer },
};
