// THE MINER, BUILT: the ship's own parts, on the 3,000-triangle smart mesh made from the game's maker's picture (its
// data is miner-built.hull.js, made by the rig ~/pw/space-math/rigs/miner-built/rig/makehull.mjs), with the parts the
// 8,000-triangle one has better: the one round engine at the stern, the eight ore canisters and their mounts, the
// jointed arms with their cutter wheels, and the thruster pods. Everything is painted in flat colours from a small
// palette, face by face, by the rules below (every colour line on an edge of the model), with the grime over it. The
// machinery it shares with Explorer C is built-common.js.
// The ship itself is the layout file kit/rooms/ship-miner-built.json; these are the catalog pieces it names (group
// 'Ships'). Frame: nose +z, the ship's left (port) +x; each piece is drawn standing on the cabin's deck (y 0 at DECK,
// 1.82 m off the ground), centred on the ship's middle (x 0, z 0). 18 m nose to stern.
//   mbHull       'hull'      the 3k hull painted by RULES (ZONES split the faces where a colour line must cross one:
//                            the lower band, the cheeks' hazard stripes); the 8k's engine with its nozzle (dark metal:
//                            the jet is plume.js's, jetNozzles)
//   mbMounts     'both sides'   the canisters' fixed mounts (the 8k's cradles, back plates, rails, middle clamps)
//   mbCanopy     'glass'     the canopy: the panes his picture has (a windscreen, a roof pane, three down each side) in
//                            smoked glass, one black spar part along every border and round the outline
//   mbMarks      'marks'     what is laid on the skin: the blue light strips, the amber headlamps
//   mbCanister   (8)         an ore canister on its mount: a kit door leaf (door 'canister': slid out off its cradle,
//                            the station's crane's first move; then up by the lug on its top, CANISTERS.lift)
//   mbArm        'port' / 'starboard'   a mining arm: its mount on the cheek, and the upper arm, forearm, hand and
//                            cutter wheel as leaves of one door ('arm', 1 stowed), each turning at its joint; the wheel
//                            also spins (the lab, or the game, spins it: armStep)
//   mbPod        (6)         a thruster pod on its pylon: a leaf that turns on the pylon (yaw) and about its own middle
//                            (pitch), a jet at each end (podJets; the lab, or the game, aims them: podStep)
//   mbLift       'belly'     the belly's lift: its shaft and the airlock over it; the platform (with its railings and
//                            corner rods: door 'lift', 1 down) and the hatch's two sliding doors (door 'hatch', 1 open)
//   mbGear       'port' / 'starboard'   a landing leg (strut and foot: door 'gear', 1 folded)
//   mbGearDoors  'port' / 'starboard'   its pod's doors (door 'doors', 1 shut)
//   mbWells      'pods'      the legs' pods under the lower canisters
//   mbCockpit    'two seats' two bucket seats side by side, the pedestal between them, the dash and side consoles, on
//                            a flight deck raised over the cabin's, in its tub under the canopy
import * as THREE from 'three';
import { Acc } from '../shipparts/outside/facet.js';
import { part } from '../shipparts/place.js';
import { SURF } from '../materials.js';
import * as C from './built-common.js';
import { HULL, ENGINE as ENG, ENGINE_AT, CANISTER, CANISTER_AT, MOUNT, ARM, POD, DECK as DECK0, HATCH, PARTS, Q } from './miner-built.hull.js';
export { THROTTLE, ENGINE, setThrottle } from './built-common.js';

const PI = Math.PI, V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const DECK = DECK0;   // the cabin's deck, metres off the ground
const dk = C.deckOf(DECK), { bytes, at, tnorm } = C, mesh = (d) => C.decodeMesh(d, Q);
const polyTo = (acc, pts, n, surf, mat = 'solid') => C.polyTo(acc, pts, n, surf, mat, dk);
const boxAt = (acc, c, axes, halves, surf, skip = []) => C.boxAt(acc, c, axes, halves, surf, skip, dk);
const AX = [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)];

// ── THE PALETTE (sRGB; roughness, metalness, wear): his picture's colours ──────────────────────────────────────────
const s = (c, r, m, w) => ({ c, r, m, w });
export const PAL = {
  cream: s('#cfc5ac', 0.55, 0.04, 0.55),       // the off-white panels
  creamEdge: s('#cfc5ac', 0.55, 0.04, 1.0),
  dark: s('#474c53', 0.5, 0.3, 0.6),           // the dark graphite bulk
  darkEdge: s('#474c53', 0.5, 0.3, 1.0),
  black: s('#1b1d20', 0.42, 0.3, 0.4),         // the canopy's spars, the hazard stripes' black
  blackEdge: s('#1b1d20', 0.42, 0.3, 0.9),
  yellow: s('#e2ae1c', 0.45, 0.03, 0.6),       // hazard yellow: the stripes, the canisters' bands, the clamps
  belly: s('#555a61', 0.6, 0.25, 0.8),         // the belly
  metal: s('#6d7177', 0.4, 0.6, 0.6),          // joints, rails, rods
  can: s('#cbc2a8', 0.5, 0.18, 0.85),          // the canisters' bodies
  canEnd: s('#3a3d42', 0.45, 0.4, 0.8),        // their rounded ends
  rubber: s('#202225', 0.85, 0.0, 0.5),
  inner: s(SURF.white[0], SURF.white[1], SURF.white[2], 0.35),
  deck: s('#55595f', 0.6, 0.3, 0.6),
  nozzle: s('#1f2125', 0.4, 0.75, 0.8), rim: s('#2c2f34', 0.32, 0.8, 0.7), core: s('#141619', 0.45, 0.8, 0.8),
};
// (glows kept below the point where they wash out to white: the blue stays blue, the amber amber)
export const GLOW = { strip: [0.04, 0.5, 2.1], warm: [2.1, 0.78, 0.1], cutter: [1.9, 0.5, 0.04], pod: [0.04, 0.5, 2.1] };

// ── PAINTING THE HULL ────────────────────────────────────────────────────────────────────────────────────────────────
// ZONES (built-common.js paintFaces): a |x| + b y + c z <= d inside each plane
const stripes = (zone, parts, region, lean, width, from, to) => {
  // (bands across a region, leaning: inside where the band's two lines (y + lean z) hold it; every other one yellow)
  const out = [];
  for (let k = 0, c = from; c < to; k++, c += width) out.push({ zone: k % 2 ? zone + 'Black' : zone + 'Yellow', parts, planes: [...region, [0, -1, -lean, -c], [0, 1, lean, c + width]] });
  return out;
};
export const ZONES = [
  // the dark lower band along the body and the blocks on its sides: under y 2.55 (his dark lower hull)
  { zone: 'lower', parts: ['body', 'side', 'canopy'], planes: [[0, 1, 0, 2.55]] },
  // the nose's lower face: under y 2.8 forward of z 5.6, his dark band with the headlamps in it
  { zone: 'face', parts: ['body'], planes: [[0, 1, 0, 2.8], [0, 0, -1, -5.6]] },
  // the cheeks' hazard stripes: under the canopy's front side window, his "////" in yellow and black
  ...stripes('cheek', ['body'], [[0, 0, 1, 5.55], [0, 0, -1, -3.75], [0, 1, 0, 3.2], [0, -1, 0, -2.55], [-1, 0, 0, -0.95]], 0.9, 0.34, 5.4, 9.2),
  // the scoop's lip: its front edge, yellow and black bands leaning across it (|x| + y), his picture's
  ...[...Array(14).keys()].map((k) => ({ zone: k % 2 ? 'lipBlack' : 'lipYellow', parts: ['scoop'], planes: [[0, 0, -1, -6.25], [-1, -0.8, 0, -(k * 0.22)], [1, 0.8, 0, (k + 1) * 0.22]] })),
];
const edge = (paint) => (f) => (f.thin ? paint + 'Edge' : paint);
export const RULES = [
  // (the canopy's faces no pane covers are the hood round the glass: cream, as his picture's; the spars are its frame)
  ['the canopy: glass, its hood', (f) => f.part === 'canopy', (f) => (canopyPanes().covers(f.c) ? 'glass' : f.zone === 'lower' ? edge('dark')(f) : edge('cream')(f))],
  ['under the canopy\'s glass: gone', (f) => canopyPanes().covers(f.c, 0.12), 'glass'],
  ['the cheeks\' stripes', (f) => f.zone === 'cheekYellow', 'yellow'],
  ['the cheeks\' stripes, black', (f) => f.zone === 'cheekBlack', 'black'],
  ['the scoop\'s lip: yellow and black', (f) => f.zone === 'lipYellow' || f.zone === 'lipBlack', (f) => (f.zone === 'lipYellow' ? 'yellow' : 'black')],
  ['the scoop: dark, its tines metal', (f) => f.part === 'scoop', (f) => (f.thin ? 'metal' : 'dark')],
  ['the keel: dark', (f) => f.part === 'keel', 'dark'],
  ['the belly: grey', (f) => f.n.y < -0.55, 'belly'],
  ['the roof\'s modules: dark', (f) => f.part === 'roof', edge('dark')],
  ['the roof\'s spine: a graphite strip down its middle behind the canopy', (f) => f.n.y > 0.7 && Math.abs(f.c.x) < 0.7 && f.c.z < 2.9 && f.c.y > 4.1, 'dark'],
  ['behind the canisters, and the stern\'s sides: dark', (f) => f.c.z < -0.55 && Math.abs(f.n.x) > 0.55, edge('dark')],
  ['the stern round the engine: dark (cream panels on its top)', (f) => f.c.z < -5.6 && f.n.y < 0.6, edge('dark')],
  ['the lower band: dark', (f) => f.zone === 'lower', edge('dark')],
  ['the nose\'s lower face: dark', (f) => f.zone === 'face', edge('dark')],
  ['the side blocks\' fronts and backs: dark', (f) => f.part === 'side' && Math.abs(f.n.z) > 0.6, edge('dark')],
  ['everything else: cream', () => true, edge('cream')],
];
let FACES = null;
export function hullFaces() {
  if (FACES) return FACES;
  FACES = C.paintFaces(mesh(HULL), new Uint8Array(bytes(HULL.part)), PARTS, ZONES, RULES);
  return FACES;
}
const drawn = (f) => f.paint !== 'glass' && f.paint !== 'gone';
const rayHull = (o, d) => C.rayFaces(hullFaces(), o, d, drawn);

// ── A DATA MESH (miner-built.hull.js: positions, triangles, a kind per face) as faces; moved by f, mirrored ─────────
function kindFaces(d, f = (v) => v, mirror = false) {
  const M = mesh(d), out = [];
  for (let t = 0; t < M.tris.length / 3; t++) {
    let T = [0, 1, 2].map((k) => { const v = f(at(M, M.tris[t * 3 + k])); if (mirror) v.x = -v.x; return v; });
    if (mirror) T = [T[0], T[2], T[1]];
    const n = tnorm(T); if (n.lengthSq() < 1e-14) continue;
    out.push({ T, n: n.normalize(), kind: d.kind[t] });
  }
  return out;
}
const drawKinds = (acc, faces, paint, tf = dk) => { for (const F of faces) { const sf = paint(F); if (sf) acc.tris([F.T.map(tf)], F.n, sf); } };

// ── THE HULL: the 3k painted, the 8k's engine, the canisters' mounts ────────────────────────────────────────────────
// THE ENGINE: the 8k's one round engine in its band (the band dark, a blue light ring round it, as his picture's), its
// nozzle cut into its flat back: a dark metal rim, the bowl, the core. The game's maker: "For the engine exhaust the
// model should basically always be dark. It's the jet ... that actually has color and glow": jetNozzles lays the jet
// (plume.js) in the bowl.
const ENGINE_PAINT = { o: PAL.dark, b: PAL.dark, r: PAL.rim, w: PAL.nozzle, f: PAL.core };
// (the blue ring: a band of glow round the drum's band, a hair proud of it, from the band's own faces that face out)
const RING = (() => {
  // (the band's widest, across and up, from its own vertices)
  const M = mesh(ENG); let rx = 0, ry = 0, z0 = 1e9, z1 = -1e9;
  for (let t = 0; t < M.tris.length / 3; t++) if (ENG.kind[t] === 'b') for (let k = 0; k < 3; k++) { const v = at(M, M.tris[t * 3 + k]); rx = Math.max(rx, Math.abs(v.x - ENGINE_AT.axis[0])); ry = Math.max(ry, Math.abs(v.y - ENGINE_AT.axis[1])); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); }
  const zm = (z0 + z1) / 2, hz = Math.min(0.2, (z1 - z0) / 2 - 0.03); return { r: [rx + 0.012, ry + 0.012], z: [zm - hz, zm + hz], n: 36 };
})();
// THE MOUNTS (the 8k's cradles, back plate, rails and middle clamps, port and starboard): kinds k cradle, p plate, m
// rail, y clamp
const MOUNT_PAINT = { k: PAL.dark, p: PAL.dark, m: PAL.metal, y: PAL.yellow };
function mbHull(p) {
  const acc = new Acc();
  C.drawFaces(acc, hullFaces(), { PAL, dk, backSurf: PAL.dark });
  const eng = kindFaces(ENG);
  drawKinds(acc, eng, (F) => ENGINE_PAINT[F.kind]);
  // (the ring: bars of light all round the band, a hair proud of its widest; two segments lit, one dark)
  { const [ax, ay] = ENGINE_AT.axis, n = RING.n, P = (i, z, out) => { const t = (i / n) * PI * 2, rx = RING.r[0] + out, ry = RING.r[1] + out; return V3(ax + Math.cos(t) * rx, ay + Math.sin(t) * ry, z); };
    for (let i = 0; i < n; i++) { if (i % 3 === 2) continue; const q = [P(i, RING.z[0], 0), P(i + 1, RING.z[0], 0), P(i + 1, RING.z[1], 0), P(i, RING.z[1], 0)], m = q[0].clone().add(q[2]).multiplyScalar(0.5); acc.poly(q.map(dk), V3(m.x - ax, m.y - ay, 0).normalize(), GLOW.strip, 'glow', 99); } }
  acc.flush(p);
  return p;
}
function mbMounts(p) { const acc = new Acc(); for (const m of [false, true]) drawKinds(acc, kindFaces(MOUNT, (v) => v, m), (F) => MOUNT_PAINT[F.kind]); return acc.flush(p); }
// THE JETS (plume.js): the main engine's, from the middle of its core, straight aft, as wide as the bowl's mouth
export const JET = { len: 9.0, gain: 1.0 };
export function jetNozzles() {
  const { axis, back, r } = ENGINE_AT, mouth = Math.min(r[0], r[1]) * 0.8;
  return [{ at: [axis[0], axis[1], back + 0.55], dir: [0, 0, -1], r: mouth * 0.92 }];
}

// ── THE CANOPY ───────────────────────────────────────────────────────────────────────────────────────────────────────
// The panes his picture has (hero, front and top views): the windscreen across the front, a roof pane behind it, and
// down each side three: the angled front corner, the middle, the rear. Each pane is one clean polygon through named
// corners on the 3k's canopy (the 3k's own vertices: built-common.js buildPanes), one straight black spar along each
// border between panes and a wider one round the outline.
//   the windscreen   W0 its foot's corner, W1 its top corner (where the roof pane starts)
//   the roof         R1 its back corner; T2 on its side edge where the middle and rear side panes meet
//   the sill         S1 at the front side pane's back, S2 between the middle and rear, S3 at the back
export const CANOPY = {
  corners: {
    W0: { at: [0.693, 3.366, 5.819] }, W1: { at: [0.638, 4.122, 4.712] }, R1: { at: [0.592, 4.528, 3.181] },
    S1: { at: [1.265, 3.476, 4.878] }, S2: { at: [1.265, 3.624, 4.094] }, S3: { at: [1.330, 3.735, 3.255] },
  },
  // (T2: on the roof's side edge, W1 to R1, at S2's z)
  derive: (P, k) => { const a = P['W1' + k], b = P['R1' + k], t = (P['S2' + k].z - a.z) / (b.z - a.z); P['T2' + k] = a.clone().lerp(b, t); },
  side: [['front corner', 'triangle', ['W0', 'S1', 'W1']], ['middle', 'quad', ['S1', 'S2', 'T2', 'W1']], ['rear', 'quad', ['S2', 'S3', 'R1', 'T2']]],
  top: [
    ['windscreen', 'quad', [['W0', 'W1', "W1'", "W0'"]]],
    ['roof', 'six-sided (four corners)', [['W1', 'T2', 'R1', "R1'", "T2'", "W1'"]]],
  ],
  spar: { w: 0.06, out: 0.035, in: 0.03 }, sill: { w: 0.1, out: 0.02, shift: 0.025 },
  straight: 3,
};
let PANES = null;
function canopyMesh() {
  const M = mesh(HULL), pt = new Uint8Array(bytes(HULL.part)), ci = PARTS.indexOf('canopy'), faces = [], verts = new Map();
  for (let t = 0; t < M.tris.length / 3; t++) {
    if ((pt[t] & 0x7f) !== ci) continue;
    const pts = [0, 1, 2].map((k) => at(M, M.tris[t * 3 + k]));
    if (tnorm(pts).length() < 2e-7) continue;
    faces.push(pts); for (const v of pts) verts.set([v.x, v.y, v.z].map((q) => Math.round(q * 2000)).join(), v);
  }
  return { faces, verts: [...verts.values()] };
}
// (the canopy's outside: away from a line along the ship over the flight deck)
const outward = (n, c) => (n.dot(V3(c.x, c.y - 3.0, c.z - 3.6)) < 0 ? n.negate() : n);
export function canopyPanes() { if (PANES) return PANES; PANES = C.buildPanes(CANOPY, canopyMesh(), outward); return PANES; }
export function spar(p) { return C.spar(p, { out: CANOPY.spar.out, in: CANOPY.spar.in, surf: PAL.blackEdge }); }
export const GLASS = { inset: 0.008, step: 0.6 };
function mbCanopy(p) { return C.drawCanopy(p, canopyPanes(), CANOPY, GLASS, part(spar), dk); }

// ── LIGHTS AND MARKS laid on the skin (a ray in from outside finds the face; the mark lies 1.2 cm off it) ────────────
export const MARKS = {
  // his blue strips: under the windscreen across the nose, along each side block, along the roof's sides aft
  strips: [{ side: true, z: [0.75, 1.45], y: 2.9, h: 0.07 }, { side: true, z: [-6.9, -6.35], y: 3.7, h: 0.07 }],
  noseStrip: { x: 0.34, y: 2.98, h: 0.07 },
  // his amber headlamps: one each side in the nose's dark lower face, each a housing standing out of it (the same both
  // sides: the 3k is not quite symmetric) with its glowing face at the front
  lamps: [{ x: 0.85, y: 2.5, w: 0.42, h: 0.18, rim: 0.035 }],
};
const onSide = (s, y, z, lift = 0.012) => { const h = rayHull(V3(s * 8, y, z), V3(-s, 0, 0)); return h ? h.p.addScaledVector(h.n, lift) : null; };
const onFront = (x, y, lift = 0.012) => { const h = rayHull(V3(x, y, 12), V3(0, 0, -1)); return h ? h.p.addScaledVector(h.n, lift) : null; };
function mbMarks(p) {
  const acc = new Acc();
  for (const s of [1, -1]) {
    for (const S of MARKS.strips) {
      const n = Math.max(2, Math.ceil((S.z[1] - S.z[0]) / 0.25));
      for (let i = 0; i < n; i++) {
        const za = S.z[0] + (S.z[1] - S.z[0]) * i / n, zb = S.z[0] + (S.z[1] - S.z[0]) * (i + 1) / n;
        const q = [onSide(s, S.y - S.h / 2, za), onSide(s, S.y - S.h / 2, zb), onSide(s, S.y + S.h / 2, zb), onSide(s, S.y + S.h / 2, za)];
        if (q.some((v) => !v)) continue;
        acc.poly(q.map(dk), V3(s, 0, 0), GLOW.strip, 'glow', 99);
      }
    }
    for (const Lm of MARKS.lamps) {
      // (how far forward the face is round the lamp, both sides: the housing's front stands just in front of it all)
      const zs = []; for (const ss of [1, -1]) for (const a of [-1, 1]) for (const b of [-1, 1]) { const h = onFront(ss * Lm.x + a * (Lm.w / 2 + Lm.rim), Lm.y + b * (Lm.h / 2 + Lm.rim), 0); if (h) zs.push(h.z); }
      const zf = Math.max(...zs) + 0.04, zb = Math.min(...zs) - 0.06, x = s * Lm.x;
      boxAt(acc, V3(x, Lm.y, (zf + zb) / 2), AX, [Lm.w / 2 + Lm.rim, Lm.h / 2 + Lm.rim, (zf - zb) / 2], PAL.black, ['w-']);
      acc.poly([V3(x - Lm.w / 2, Lm.y - Lm.h / 2, zf + 0.004), V3(x + Lm.w / 2, Lm.y - Lm.h / 2, zf + 0.004), V3(x + Lm.w / 2, Lm.y + Lm.h / 2, zf + 0.004), V3(x - Lm.w / 2, Lm.y + Lm.h / 2, zf + 0.004)].map(dk), V3(0, 0, 1), GLOW.warm, 'glow', 99);
      p.light([x, Lm.y - DECK, zf + 0.3], 0.6, [1.2, 0.85, 0.45], [0, -0.3, 1], 4);
    }
  }
  { const N = MARKS.noseStrip, c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => onFront(a * N.x, N.y + b * N.h / 2)); if (c.every((v) => v)) acc.poly(c.map(dk), V3(0, 0, 1), GLOW.strip, 'glow', 99); }
  // (no nav lights: his picture has none)
  acc.flush(p);
  return p;
}

// ── THE CANISTERS ───────────────────────────────────────────────────────────────────────────────────────────────────
// Eight, four a side: two rows (upper and lower), each a front and a back canister, his picture's. Each is the same
// canister (the 8k's, miner-built.hull.js CANISTER: its body and rounded ends), a kit door leaf on its mount, with two
// clean yellow straps (STRAPS: one near each end; the two at the joint between a front and a back canister make his
// middle band; the back ones are turned end for end); either end can plug into the smelter's sockets. The station's
// crane hooks the lug on its top (CANISTERS.lift: from the canister's middle). The cradle and the top rail of the row
// above stand over the inboard half of each canister, so it cannot go straight up: its first move is OUT, away from
// the hull, by CANISTERS.out (the door 'canister' slides it so: 1 m clears the canister and cradle above it, so any
// canister can come off in any order), then up.
export const CANISTERS = { lift: [0, CANISTER_AT.R + 0.12, 0], out: 1.0, spots: [] };
for (const [side, sx] of [['port', 1], ['starboard', -1]]) for (const S of CANISTER_AT.spots) CANISTERS.spots.push({ name: `${side} ${S.row} ${S.end}`, at: [sx * S.at[0], S.at[1], S.at[2]], turn: S.turn, side, row: S.row, end: S.end });
const CAN_PAINT = { c: PAL.can, e: PAL.canEnd, y: PAL.yellow };
// (a strap: a flat band round the canister, n-sided, its outer face and its edges)
export const STRAPS = { at: [CANISTER_AT.half - 0.32, -CANISTER_AT.half + 0.2], w: 0.2, out: 0.035, n: 16 };
function strap(acc, z, R) {
  const { w, out, n } = STRAPS, P = (i, zz, r) => { const t = (i / n) * PI * 2; return V3(Math.cos(t) * r, Math.sin(t) * r, zz); }, r1 = R + out;
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) / n) * PI * 2, nn = V3(Math.cos(t), Math.sin(t), 0);
    acc.poly([P(i, z - w / 2, r1), P(i + 1, z - w / 2, r1), P(i + 1, z + w / 2, r1), P(i, z + w / 2, r1)], nn, PAL.yellow, 'solid', 99);
    for (const [zz, sz] of [[z - w / 2, -1], [z + w / 2, 1]]) acc.poly([P(i, zz, R - 0.02), P(i + 1, zz, R - 0.02), P(i + 1, zz, r1), P(i, zz, r1)], V3(0, 0, sz), PAL.yellow, 'solid', 99);
  }
}
function canisterLeaf(lp) {
  const acc = new Acc(), R = CANISTER_AT.R;
  drawKinds(acc, kindFaces(CANISTER), (F) => CAN_PAINT[F.kind], (v) => v);
  for (const z of STRAPS.at) strap(acc, z, R);
  // (the lug the crane hooks: a dark block with a yellow eye on the canister's top, at its middle)
  C.boxAt(acc, V3(0, R + 0.04, 0), AX, [0.09, 0.05, 0.16], PAL.dark, ['v-'], (v) => v);
  C.boxAt(acc, V3(0, R + 0.13, 0), AX, [0.025, 0.05, 0.09], PAL.yellow, ['v-'], (v) => v);
  acc.flush(lp);
}
function mbCanister(p, name) {
  const S = CANISTERS.spots.find((q) => q.name === name), c = dk(V3(...S.at));
  p.leaf('mb:canister', canisterLeaf, { at: c.toArray(), rot: [0, S.turn ? PI : 0, 0], slide: [Math.sign(S.at[0]) * CANISTERS.out, 0, 0], door: 'canister' });
  p.door('canister', c.toArray(), 0, 0.5);
  return p;
}

// ── THE ARMS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// The 8k's starboard arm (the port one is it mirrored), in its segments between his picture's joints: the mount on the
// cheek (fixed), the upper arm (at the shoulder), the forearm (at the elbow), the hand (at the wrist), the cutter wheel
// (spinning on the hand). Each joint turns about its drum's axis, across the ship. As the 8k made it, the arm reaches
// out and down to dig (door 'arm' at 0); stowed (1) it folds up beside the cheek for flight: the shoulder lifts the
// upper arm, the elbow folds the forearm back under it, the wrist tucks the hand in. Hazard stripes run along the
// upper arm and the forearm (his picture's yellow and black).
export const ARMS = { stow: { shoulder: 0, elbow: -3.0, wrist: 2.3 }, speed: 0.45, spin: 7.0 };
const ARM_PAINT = (seg) => (F) => {
  if (F.kind === 'w') return F.n.x * F.n.x > 0.6 ? PAL.dark : PAL.metal;
  if (F.kind === 'j') return PAL.black;
  if (F.kind === 's') return PAL.black;
  if (F.band != null) return F.band % 2 ? PAL.black : PAL.yellow;
  if (seg === 'fore') return PAL.yellow;
  return PAL.dark;
};
// HAZARD STRIPES: a face cut into bands across it (where y + z (ship frame) steps by STRIPE.w), every other one
// yellow: on the upper arm's and forearm's sides, and the scoop's lip (his picture's yellow and black)
export const STRIPE = { w: 0.2, lean: 1.0 };
function bands(faces, test, g = (v) => v.y + STRIPE.lean * v.z, w = STRIPE.w) {
  const out = [];
  for (const F of faces) {
    if (!test(F)) { out.push(F); continue; }
    const vals = F.T.map(g), lo = Math.floor(Math.min(...vals) / w), hi = Math.floor(Math.max(...vals) / w);
    for (let b = lo; b <= hi; b++) {
      // (the part of the triangle between the band's two lines)
      let P = F.T;
      for (const [c, keepAbove] of [[b * w, true], [(b + 1) * w, false]]) {
        const Q = []; for (let i = 0; i < P.length; i++) { const a = P[i], e = P[(i + 1) % P.length], fa = (g(a) - c) * (keepAbove ? 1 : -1), fe = (g(e) - c) * (keepAbove ? 1 : -1); if (fa >= 0) Q.push(a); if ((fa > 0 && fe < 0) || (fa < 0 && fe > 0)) Q.push(a.clone().lerp(e, fa / (fa - fe))); }
        P = Q; if (P.length < 3) break;
      }
      if (P.length < 3) continue;
      for (let i = 1; i < P.length - 1; i++) { const T = [P[0], P[i], P[i + 1]]; if (tnorm(T).lengthSq() > 1e-12) out.push({ ...F, T, band: ((b % 2) + 2) % 2 }); }
    }
  }
  return out;
}
const sideOfArm = (F) => F.kind === 'a' && Math.abs(F.n.x) > 0.45;
// THE CUTTER WHEEL (on the hand, spinning about its axle across the ship): a drum of CUTTER.n sides with a tooth on each,
// graphite; on each face a yellow ring and the hub glowing orange. Its size the 8k's wheel's (at its teeth's tips).
export const CUTTER = { r: 0.4, tooth: 0.08, half: 0.22, n: 12, ring: [0.27, 0.36], hub: 0.17 };
function cutterWheel(a, w) {
  const { r, tooth, half, n, ring, hub } = CUTTER, P = (t, rr, x) => V3(x, w.y + Math.cos(t) * rr, w.z + Math.sin(t) * rr), ang = (i) => (i / n) * PI * 2;
  for (let i = 0; i < n; i++) {
    const t0 = ang(i), t1 = ang(i + 1), tm = (t0 + t1) / 2, out = V3(0, Math.cos(tm), Math.sin(tm));
    // the rim
    a.poly([P(t0, r, w.x - half), P(t1, r, w.x - half), P(t1, r, w.x + half), P(t0, r, w.x + half)], out, PAL.dark, 'solid', 99);
    // the tooth: a block on the rim, leaning forward the way the wheel turns
    const c = P(tm, r + tooth / 2, w.x), u = out, v = V3(0, -Math.sin(tm), Math.cos(tm));
    C.boxAt(a, c, [V3(1, 0, 0), u, v], [half * 0.85, tooth / 2, 0.06], PAL.metal, [], (q) => q);
    // its faces: the hub, the dark ring, the yellow ring, the dark edge
    for (const sx of [1, -1]) {
      const x = w.x + sx * half, nn = V3(sx, 0, 0);
      a.poly([V3(x, w.y, w.z), P(t0, hub, x), P(t1, hub, x)], nn, GLOW.cutter, 'glow', 99);
      for (const [r0, r1, col] of [[hub, ring[0], PAL.dark], [ring[0], ring[1], PAL.yellow], [ring[1], r, PAL.dark]]) a.poly([P(t0, r0, x), P(t1, r0, x), P(t1, r1, x), P(t0, r1, x)], nn, col, 'solid', 99);
    }
  }
}
function mbArm(p, side) {
  const m = side === 'port', J = ARM.joints, jp = (k) => { const v = V3(...J[k].at); if (m) v.x = -v.x; return dk(v); };
  const segFaces = (k) => { const f = kindFaces(ARM.segs[k], (v) => v, m); return k === 'upper' || k === 'fore' ? bands(f, sideOfArm) : f; };
  const acc = new Acc(); drawKinds(acc, segFaces('mount'), ARM_PAINT('mount')); acc.flush(p);
  const H = { shoulder: { at: jp('shoulder').toArray(), axis: [1, 0, 0], angle: ARMS.stow.shoulder }, elbow: { at: jp('elbow').toArray(), axis: [1, 0, 0], angle: ARMS.stow.elbow }, wrist: { at: jp('wrist').toArray(), axis: [1, 0, 0], angle: ARMS.stow.wrist } };
  const leaf = (k, hinges, extra, own) => p.leaf(`mb:arm ${k}:${side}`, (lp) => { const a = new Acc(); if (!own) drawKinds(a, segFaces(k), ARM_PAINT(k)); if (extra) extra(a); a.flush(lp); }, { door: 'arm', hinge: hinges });
  leaf('upper', [H.shoulder]);
  leaf('fore', [H.shoulder, H.elbow]);
  leaf('hand', [H.shoulder, H.elbow, H.wrist]);
  // (the wheel: its hub glowing orange, his picture's cutter, on both faces)
  const w = jp('wheel');
  leaf('cutter', [H.shoulder, H.elbow, H.wrist], (a) => cutterWheel(a, w), true);
  p.door('arm', [0, -DECK, 0], 0, ARMS.speed);
  return p;
}

// ── THE THRUSTER PODS ────────────────────────────────────────────────────────────────────────────────────────────────
// His circled corner pods, "good maneuvering thrusters that could turn to shoot jets out in different ways": six, as
// his views show them (two high at the front, by the cockpit; two high and two low at the stern's corners), each the
// 8k's pod on a pylon from the hull. Each turns on its pylon (yaw) and about its own middle (pitch); a jet fires from
// either end (podJets), aimed with the pod. At rest they face along the ship.
export const PODS = [
  { name: 'top front port', at: [1.98, 4.6, 2.3], up: 1 }, { name: 'top front starboard', at: [-1.98, 4.6, 2.3], up: 1 },
  { name: 'top rear port', at: [1.7, 4.7, -6.6], up: 1 }, { name: 'top rear starboard', at: [-1.7, 4.7, -6.6], up: 1 },
  { name: 'bottom rear port', at: [2.1, 1.27, -6.5], up: -1 }, { name: 'bottom rear starboard', at: [-2.1, 1.27, -6.5], up: -1 },
];
export const POD_SWING = { yaw: 1.2, pitch: 0.45 };
const POD_PAINT = { h: PAL.dark, n: PAL.nozzle };
const podOf = (name) => PODS.find((q) => q.name === name);
// (where its pylon meets the hull: a ray from the pod's middle toward the hull, straight down (or up))
function pylonFoot(P) { const o = V3(...P.at), h = rayHull(o, V3(0, -P.up, 0)); return h ? h.p : o.clone().add(V3(0, -P.up * 0.4, 0)); }
function mbPod(p, name) {
  const P = podOf(name), c = V3(...P.at), half = POD.size[1] / 2, foot = pylonFoot(P), top = c.clone().add(V3(0, -P.up * half, 0));
  // the pylon: a dark post from the hull to the pod's swivel collar
  const acc = new Acc(), len = Math.abs(top.y - foot.y) + 0.06, mid = V3(c.x, (top.y + foot.y) / 2, c.z);
  boxAt(acc, mid, AX, [0.09, len / 2, 0.12], PAL.dark, []);
  acc.flush(p);
  const yaw = { at: dk(top).toArray(), axis: [0, 1, 0], angle: POD_SWING.yaw }, pitch = { at: dk(c).toArray(), axis: [1, 0, 0], angle: POD_SWING.pitch };
  p.leaf('mb:pod', (lp) => {
    const a = new Acc();
    drawKinds(a, kindFaces(POD), (F) => POD_PAINT[F.kind], (v) => v);
    // (its collar on the pylon, and a blue light in each end round the nozzle: his picture's)
    C.boxAt(a, V3(0, -P.up * (half + 0.02), 0), AX, [0.13, 0.04, 0.16], PAL.metal, [], (v) => v);
    const hz = POD.size[2] / 2 + 0.004;
    for (const sz of [1, -1]) { const q = [[-0.14, -0.08], [0.14, -0.08], [0.14, 0.08], [-0.14, 0.08]].map(([x, y]) => V3(x, y, sz * hz)); a.poly(sz > 0 ? q : q.slice().reverse(), V3(0, 0, sz), GLOW.pod, 'glow', 99); }
    a.flush(lp);
  }, { at: dk(c).toArray(), door: 'pod', hinge: [yaw, pitch] });
  p.door('pod', dk(c).toArray(), 0, 1);
  return p;
}
// the pods' jets (plume.js): one at each end of each pod, at rest; the lab (podStep) aims them as the pods turn
export const POD_JET = { len: 10.0, gain: 1.2, r: 0.2, thrust: 0.85 };
export function podJets() { const out = []; for (const P of PODS) for (const sz of [1, -1]) out.push({ at: [P.at[0], P.at[1], P.at[2] + sz * (POD.size[2] / 2 + 0.01)], dir: [0, 0, sz], r: POD_JET.r, pod: P.name, end: sz }); return out; }

// ── THE LIFT ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// His picture's lift under the belly: a broad platform with railings and a hazard-striped edge that lowers to the
// ground, a dark column with amber lights standing at its back, the door opening above it. The hatch is cut through the
// belly (HATCH); over it a shaft up to the deck and the airlock (its walls, ceiling, light and inner door, shut). The
// platform plugs the hatch in flight (its underside the belly; its column up in the airlock); lowered (door 'lift'), it
// stands on the ground, its railings swung up from flat, rods at its front corners running up into the shaft's corners.
// Over it the hatch's two doors (door 'hatch') slide apart under the deck. Through the open hatch: 2.0 m and more from
// the platform up into the airlock.
export const LIFT = (() => {
  const [x0, x1] = HATCH.x, [z0, z1] = HATCH.z, belly = 1.37, top = DECK - 0.12;
  return { x: [x0, x1], z: [z0, z1], zc: (z0 + z1) / 2, hx: (x1 - x0) / 2 - 0.06, hz: (z1 - z0) / 2 - 0.06, belly, top, drop: belly, leaf: 0.04, rail: 0.9, rod: 1.5, column: { h: 1.55, t: 0.1 }, airlock: { x: (x1 - x0) / 2 + 0.1, z: [z0 - 0.25, z1 + 0.25], h: 2.1 }, speed: 0.35, hatchSpeed: 0.8 };
})();
function mbLift(p) {
  const L = LIFT, acc = new Acc(), [x0, x1] = L.x, [z0, z1] = L.z, y0 = L.belly, A = L.airlock, top = DECK + A.h;
  // the shaft: the hole's four walls from the belly to the deck
  for (const [a, b, n] of [[[x0, z0], [x1, z0], V3(0, 0, 1)], [[x1, z1], [x0, z1], V3(0, 0, -1)], [[x1, z0], [x1, z1], V3(-1, 0, 0)], [[x0, z1], [x0, z0], V3(1, 0, 0)]]) polyTo(acc, [V3(a[0], y0, a[1]), V3(b[0], y0, b[1]), V3(b[0], DECK, b[1]), V3(a[0], DECK, a[1])], n, PAL.dark);
  // the airlock over it: its floor round the hatch, walls, ceiling (off-white), a light, the inner door (forward, shut)
  const ax0 = -A.x, ax1 = A.x, [az0, az1] = A.z;
  for (const [P, n] of [[[V3(ax0, DECK, az0), V3(x0, DECK, az0), V3(x0, DECK, az1), V3(ax0, DECK, az1)], V3(0, 1, 0)], [[V3(x1, DECK, az0), V3(ax1, DECK, az0), V3(ax1, DECK, az1), V3(x1, DECK, az1)], V3(0, 1, 0)], [[V3(x0, DECK, az0), V3(x1, DECK, az0), V3(x1, DECK, z0), V3(x0, DECK, z0)], V3(0, 1, 0)], [[V3(x0, DECK, z1), V3(x1, DECK, z1), V3(x1, DECK, az1), V3(x0, DECK, az1)], V3(0, 1, 0)]]) polyTo(acc, P, n, PAL.deck);
  for (const [a, b, n] of [[[ax0, az0], [ax1, az0], V3(0, 0, 1)], [[ax1, az1], [ax0, az1], V3(0, 0, -1)], [[ax1, az0], [ax1, az1], V3(-1, 0, 0)], [[ax0, az1], [ax0, az0], V3(1, 0, 0)]]) polyTo(acc, [V3(a[0], DECK, a[1]), V3(b[0], DECK, b[1]), V3(b[0], top, b[1]), V3(a[0], top, a[1])], n, PAL.inner);
  polyTo(acc, [V3(ax0, top, az0), V3(ax1, top, az0), V3(ax1, top, az1), V3(ax0, top, az1)], V3(0, -1, 0), PAL.inner);
  acc.poly([V3(-0.45, top - 0.005, L.zc - 0.12), V3(0.45, top - 0.005, L.zc - 0.12), V3(0.45, top - 0.005, L.zc + 0.12), V3(-0.45, top - 0.005, L.zc + 0.12)].map(dk), V3(0, -1, 0), [1.5, 1.4, 1.2], 'glow', 99);
  boxAt(acc, V3(0, DECK + 1.0, az1 - 0.02), AX, [0.45, 1.0, 0.02], PAL.dark, ['w+']);
  boxAt(acc, V3(0, DECK + 1.0, az1 - 0.045), AX, [0.012, 0.96, 0.004], PAL.black, ['w+']);
  acc.poly([V3(-0.4, DECK + 2.06, az1 - 0.03), V3(0.4, DECK + 2.06, az1 - 0.03), V3(0.4, DECK + 2.1, az1 - 0.03), V3(-0.4, DECK + 2.1, az1 - 0.03)].map(dk).reverse(), V3(0, 0, -1), GLOW.strip, 'glow', 99);
  // (the hatch's rim on the belly: yellow and black, his picture's hazard edge)
  acc.flush(p);
  p.light([0, A.h - 0.2, L.zc], 1.4, [1, 0.94, 0.85], [0, -1, 0], 4.0);
  // THE PLATFORM (door 'lift'): a slab plugging the hatch, its top under the hatch's doors, its underside the belly; the
  // hazard stripes round its top edge; down, it slides LIFT.drop to the ground
  const hx = L.hx, hz = L.hz, zc = L.zc, pt = L.top, pb = L.belly;
  p.leaf('mb:lift platform', (lp) => {
    const a = new Acc();
    C.boxAt(a, V3(0, (pt + pb) / 2, zc), AX, [hx, (pt - pb) / 2, hz], PAL.dark, [], dk);
    // (its tread: a grey deck plate; a yellow and black band round its top edge and down its sides)
    a.poly([V3(-hx + 0.1, pt + 0.004, zc - hz + 0.1), V3(hx - 0.1, pt + 0.004, zc - hz + 0.1), V3(hx - 0.1, pt + 0.004, zc + hz - 0.1), V3(-hx + 0.1, pt + 0.004, zc + hz - 0.1)].map(dk), V3(0, 1, 0), PAL.deck, 'solid', 99);
    const n = 12;
    for (let i = 0; i < n; i++) for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const hu = sx ? hz : hx, u0 = -hu + (2 * hu) * i / n, u1 = -hu + (2 * hu) * (i + 1) / n, col = i % 2 ? PAL.black : PAL.yellow, e = 0.1;
      const q = sx ? [V3(sx * (hx - e), pt + 0.004, zc + u0), V3(sx * hx, pt + 0.004, zc + u0), V3(sx * hx, pt + 0.004, zc + u1), V3(sx * (hx - e), pt + 0.004, zc + u1)] : [V3(u0, pt + 0.004, zc + sz * (hz - e)), V3(u1, pt + 0.004, zc + sz * (hz - e)), V3(u1, pt + 0.004, zc + sz * hz), V3(u0, pt + 0.004, zc + sz * hz)];
      a.poly(q.map(dk), V3(0, 1, 0), col, 'solid', 99);
      // (and down the platform's side there)
      const y0 = pt - 0.12, d = sx ? [V3(sx * (hx + 0.003), y0, zc + u0), V3(sx * (hx + 0.003), y0, zc + u1), V3(sx * (hx + 0.003), pt, zc + u1), V3(sx * (hx + 0.003), pt, zc + u0)] : [V3(u0, y0, zc + sz * (hz + 0.003)), V3(u1, y0, zc + sz * (hz + 0.003)), V3(u1, pt, zc + sz * (hz + 0.003)), V3(u0, pt, zc + sz * (hz + 0.003))];
      a.poly(d.map(dk), sx ? V3(sx, 0, 0) : V3(0, 0, sz), col, 'solid', 99);
    }
    // THE COLUMN at its back: a dark panel standing on it, its door's outline and two amber light strips on its face (his
    // picture's lift tower; in flight it stands up in the airlock)
    const K = L.column, zk = zc - hz + 0.06 + K.t / 2, yk = pt + K.h / 2;
    C.boxAt(a, V3(0, yk, zk), AX, [hx - 0.12, K.h / 2, K.t / 2], PAL.dark, ['v-'], dk);
    for (const [x0b, x1b] of [[-0.46, -0.42], [0.42, 0.46]]) C.boxAt(a, V3((x0b + x1b) / 2, pt + 0.72, zk + K.t / 2 + 0.004), AX, [(x1b - x0b) / 2, 0.68, 0.004], PAL.black, ['w-'], dk);
    C.boxAt(a, V3(0, pt + 1.41, zk + K.t / 2 + 0.004), AX, [0.46, 0.02, 0.004], PAL.black, ['w-'], dk);
    for (const xs of [-0.62, 0.62]) a.poly([V3(xs - 0.03, pt + 0.2, zk + K.t / 2 + 0.006), V3(xs + 0.03, pt + 0.2, zk + K.t / 2 + 0.006), V3(xs + 0.03, pt + 1.35, zk + K.t / 2 + 0.006), V3(xs - 0.03, pt + 1.35, zk + K.t / 2 + 0.006)].map(dk), V3(0, 0, 1), GLOW.warm, 'glow', 99);
    a.flush(lp);
  }, { door: 'lift', slide: [0, -L.drop, 0] });
  // the railings (port and starboard): posts and two rails, folded flat inward over the platform in flight, swung up
  // as it lowers
  // (the railings run from the column's front to the platform's front)
  const zr0 = zc - hz + 0.06 + L.column.t + 0.08, zr1 = zc + hz - 0.06, zrm = (zr0 + zr1) / 2;
  for (const sx of [1, -1]) {
    const rx = sx * (hx - 0.04), hy = pt + 0.02 + (sx < 0 ? 0.04 : 0);
    p.leaf(`mb:lift railing:${sx > 0 ? 'port' : 'starboard'}`, (lp) => {
      const a = new Acc(), R = L.rail;
      // (drawn standing; its base turns it flat)
      for (const z of [zr0, zrm, zr1]) C.boxAt(a, V3(rx, hy + R / 2, z), AX, [0.02, R / 2, 0.02], PAL.yellow, [], dk);
      for (const y of [hy + R, hy + R * 0.55]) C.boxAt(a, V3(rx, y, zrm), AX, [0.02, 0.02, (zr1 - zr0) / 2], PAL.yellow, [], dk);
      a.flush(lp);
    }, { ...C.leafPose(C.turnAbout(dk(V3(rx, hy, zc)), V3(0, 0, 1), sx * PI / 2)), door: 'lift', slide: [0, -L.drop, 0], hinge: { at: dk(V3(rx, hy, zc)).toArray(), axis: [0, 0, 1], angle: -sx * PI / 2 } });
  }
  // the rods at its front corners: standing on it, up into the shaft's corners (into the airlock in flight)
  for (const sx of [1, -1]) p.leaf('mb:lift rod', (lp) => { const a = new Acc(); C.boxAt(a, V3(0, L.rod / 2, 0), AX, [0.03, L.rod / 2, 0.03], PAL.metal, ['v-'], (v) => v); a.flush(lp); }, { at: dk(V3(sx * (hx - 0.04), pt, zc + hz - 0.04)).toArray(), door: 'lift', slide: [0, -L.drop, 0] });
  p.door('lift', [0, -DECK, zc], 0, L.speed);
  // THE HATCH'S DOORS (door 'hatch'): two halves in the deck over the platform, sliding out under it to open
  for (const sx of [1, -1]) p.leaf(`mb:hatch:${sx > 0 ? 'port' : 'starboard'}`, (lp) => {
    const a = new Acc(), hx0 = sx > 0 ? 0.004 : x0, hx1 = sx > 0 ? x1 : -0.004;
    C.boxAt(a, V3((hx0 + hx1) / 2, DECK - L.leaf / 2, (z0 + z1) / 2), AX, [(hx1 - hx0) / 2, L.leaf / 2, (z1 - z0) / 2], PAL.deck, [], dk);
    a.poly([V3(sx * 0.004, DECK + 0.002, z0 + 0.1), V3(sx * 0.06, DECK + 0.002, z0 + 0.1), V3(sx * 0.06, DECK + 0.002, z1 - 0.1), V3(sx * 0.004, DECK + 0.002, z1 - 0.1)].map(dk), V3(0, 1, 0), PAL.yellow, 'solid', 99);
    a.flush(lp);
  }, { door: 'hatch', slide: [sx * (x1 - x0) / 2 + sx * 0.06, 0, 0] });
  p.door('hatch', [0, -DECK, zc], 0, L.hatchSpeed);
  return p;
}

// ── THE LANDING GEAR ────────────────────────────────────────────────────────────────────────────────────────────────
// His picture's two legs at the stern's corners, under the lower canisters (with the lift at the front, his three
// feet). Neither smart mesh has legs that reach the ground (they stand on the lift's platform and the cutter wheels),
// and the Explorer's 8k legs are too thick to fold under this ship's slim belly; so each leg is kept plain, his
// picture's: a square strut, a knee, a piston and a broad foot. Folding (door 'gear', 1 up), it swings back about its
// axle (across the ship) to lie along its pod under the lower canisters, its foot turning flat; the pod's bottom
// doors (door 'doors', 1 shut) close under it (built-common.js bayDoors and bayPod, as the Explorer's aft bays).
export const GEAR = { x: 2.2, z: -4.15, axle: 1.24, fold: PI / 2, foot: -PI / 2, speed: 0.42, doorSpeed: 0.9 };
const BAY = { x: [1.82, 2.58], z: [-5.95, -3.85], belly: [0.96, 0.96], wallTop: 1.5, ceil: 1.5, step: 2.58, roof: 1.5, axle: [GEAR.x, GEAR.axle] };
export const WELLS = { port: { bay: BAY }, starboard: { bay: { ...BAY, mirror: true } } };
function legLeaves(p, side) {
  const s = side === 'starboard' ? -1 : 1, x = s * GEAR.x, z = GEAR.z, ya = GEAR.axle, yk = 0.62, yf = 0.13;
  const hinge = { at: dk(V3(x, ya, z)).toArray(), axis: [1, 0, 0], angle: GEAR.fold }, ankle = { at: dk(V3(x, yf, z)).toArray(), axis: [1, 0, 0], angle: GEAR.foot };
  p.leaf('mb:leg strut:' + side, (lp) => {
    const a = new Acc();
    C.boxAt(a, V3(x, (ya + 0.12 + yk) / 2, z), AX, [0.19, (ya + 0.12 - yk) / 2, 0.17], PAL.dark, [], dk);      // the strut
    C.boxAt(a, V3(x, ya, z), AX, [0.23, 0.1, 0.1], PAL.metal, [], dk);                                           // its axle's boss
    C.boxAt(a, V3(x, yk, z), AX, [0.23, 0.13, 0.2], PAL.dark, [], dk);                                           // the knee
    C.boxAt(a, V3(x, (yk + yf) / 2, z), AX, [0.1, (yk - yf) / 2, 0.1], PAL.metal, [], dk);                      // the piston
    for (const sy of [0.2, -0.2]) C.boxAt(a, V3(x + s * 0.195, (ya + yk) / 2 + sy, z), AX, [0.005, 0.12, 0.13], PAL.yellow, ['u-'], dk);   // (yellow marks on its outer face)
    a.flush(lp);
  }, { door: 'gear', hinge });
  p.leaf('mb:leg foot:' + side, (lp) => {
    const a = new Acc();
    C.boxAt(a, V3(x, yf, z), AX, [0.13, 0.07, 0.13], PAL.metal, [], dk);
    C.boxAt(a, V3(x, 0.05, z), AX, [0.35, 0.05, 0.42], PAL.dark, [], dk);
    C.boxAt(a, V3(x, 0.115, z), AX, [0.22, 0.03, 0.28], PAL.yellow, ['v-'], dk);
    a.poly([V3(x - 0.35, 0.0, z - 0.42), V3(x + 0.35, 0.0, z - 0.42), V3(x + 0.35, 0.0, z + 0.42), V3(x - 0.35, 0.0, z + 0.42)].map(dk).reverse(), V3(0, -1, 0), PAL.rubber, 'solid', 99);
    a.flush(lp);
  }, { door: 'gear', hinge: [hinge, ankle] });
  p.door('gear', [0, -DECK, 0], 0, GEAR.speed);
  return p;
}
const podPaint = () => PAL.dark;
function mbGearDoors(p, side) { C.bayDoors(p, side, WELLS[side].bay, { key: 'mb', paint: podPaint, inner: PAL.dark, dk }); p.door('doors', [0, -DECK, 0], 0, GEAR.doorSpeed); return p; }
function mbWells(p) { const acc = new Acc(); for (const W of Object.values(WELLS)) C.bayPod(acc, W.bay, { paint: podPaint, dark: PAL.dark, metal: PAL.metal, dk }); return acc.flush(p); }

// ── THE COCKPIT ──────────────────────────────────────────────────────────────────────────────────────────────────────
// The cockpit family's parts (built-common.js builtCockpitPlan): two bucket seats in the ship's colours side by side,
// the pedestal between them, pedals, the dash and a side console each side, on a flight deck FLOOR over the cabin's
// (the canopy's sill is high on this ship: a pilot sitting on the cabin's deck would not see over it), the seats'
// middles at SEATS_Z; no overheads (the glass is the roof), no engineer, handholds or locker. The tub under the glass
// closes the cockpit off (no sky through a gap), the bulkhead behind with the cabin's door (shut) and steps down to it.
export const COCKPIT = { floor: 0.62, seatsZ: 4.25, wallX: 1.05, gap: 0.42, dash: { w: 1.5, h: 0.72, knee: 0.55, bow: 0.12, depth: 0.85 }, canopy: { y: 3.37 - DECK - 0.62, z: 5.82 - 4.25, slope: 0.6 }, tubX: 1.2 };
export const COCKPIT_DROP = /^overhead|^handhold|^engineer|^locker/;
export function builtCockpitPlan() { return C.builtCockpitPlan(COCKPIT, COCKPIT_DROP); }
function mbCockpit(p) {
  const Cp = COCKPIT;
  C.cockpitParts(p, builtCockpitPlan(), Cp);
  const acc = new Acc(), fy = DECK + Cp.floor;
  const hull2 = C.cockpitTub(acc, canopyPanes().outline, { fy, tubX: Cp.tubX, rayIn: rayHull, wallSurf: PAL.dark, floorSurf: PAL.deck, dk });
  const zb = Math.min(...hull2.map((v) => v.z)) + 0.3;
  boxAt(acc, V3(0, fy + 0.95, zb), AX, [0.42, 0.95, 0.03], PAL.dark);
  boxAt(acc, V3(0, fy + 0.95, zb + 0.035), AX, [0.012, 0.91, 0.006], PAL.black, ['w-']);
  acc.poly([V3(-0.38, fy + 1.96, zb + 0.032), V3(0.38, fy + 1.96, zb + 0.032), V3(0.38, fy + 2.0, zb + 0.032), V3(-0.38, fy + 2.0, zb + 0.032)].map(dk), V3(0, 0, 1), GLOW.strip, 'glow', 99);
  acc.flush(p);
  for (const x of [-0.5, 0.5]) p.light([x, Cp.floor + 1.9, Cp.seatsZ - 0.2], 1.0, [1.25, 0.85, 0.55], [0, -1, 0.2], 3.0);
  p.light([0, Cp.floor + 1.2, Cp.seatsZ + 0.9], 0.7, [0.35, 0.65, 1.0], [0, 0.2, -1], 2.5);
  return p;
}

// ── THE GRIME (built-common.js grimeMaterials): a miner a bit dirtier than the Explorer by default ──────────────────
export const STREAKS = [
  // [x, y, z, flow dx, dy, dz, length, width]: soot forward up the engine's drum from its rim; runs down the canister
  // cradles and the hull's sides behind them; the scoop's dust back under the nose
  [0, 2.99, -8.9, 0, 0, 1, 1.8, 1.4], [1.6, 3.9, -0.6, 0, -0.4, -1, 5.2, 0.4], [-1.6, 3.9, -0.6, 0, -0.4, -1, 5.2, 0.4],
  [0, 1.5, 6.4, 0, -0.1, -1, 3.0, 1.0], [1.3, 2.6, 5.4, 0, -0.3, -1, 2.6, 0.35], [-1.3, 2.6, 5.4, 0, -0.3, -1, 2.6, 0.35],
  [0, 4.6, -0.5, 0, -0.1, -1, 3.0, 0.5], [2.2, 1.8, -0.6, 0, -0.2, -1, 4.8, 0.35], [-2.2, 1.8, -0.6, 0, -0.2, -1, 4.8, 0.35],
];
export const GRIME = { dirt: { value: 0.85 } };
export const grimeMaterials = (mats, { dirt } = {}) => C.grimeMaterials(mats, { dirt, streaks: STREAKS, deck: DECK, grime: GRIME, key: 'mbgrime', glowKey: 'mbglow' });

// ── MOVING THE PARTS (the game, or the lab) ─────────────────────────────────────────────────────────────────────────
// the gear: up folds the legs, then shuts the pods' doors; down the reverse (built-common.js gearStep)
export const gearStep = (built, up, dt, updateDoors) => C.gearStep(built, up, dt, updateDoors, 'mbGear', 'mbGearDoors');
// the lift: open lowers the platform to the ground, then slides the hatch open over it; shut slides the hatch shut,
// then raises the platform into the belly
export function liftStep(built, open, dt, updateDoors) {
  const lift = built.doors.filter((D) => D.piece === 'mbLift' && D.leaves.some((L) => L.meshes?.[0]?.name.includes('platform') || L.meshes?.[0]?.name.includes('rod'))), hatch = built.doors.filter((D) => D.piece === 'mbLift' && !lift.includes(D)), eye = new THREE.Vector3();
  if (open) { const m = updateDoors(lift, eye, dt, 'open'); return lift.every((D) => D.t >= 1) ? updateDoors(hatch, eye, dt, 'open') || m : m; }
  const m = updateDoors(hatch, eye, dt, 'shut'); return hatch.every((D) => D.t <= 0) ? updateDoors(lift, eye, dt, 'shut') || m : m;
}
// the arms: reaching (0) or stowed (1); the cutter wheels spin while the arms reach (spin: the angle now)
const _spin = new THREE.Matrix4(), _sa = new THREE.Vector3();
export function armStep(built, stow, dt, updateDoors, spin) {
  const arms = built.doors.filter((D) => D.piece === 'mbArm');
  const moved = updateDoors(arms, new THREE.Vector3(), dt, stow ? 'open' : 'shut');
  for (const D of arms) for (const L of D.leaves) {
    if (!L.meshes?.[0]?.name.includes('cutter')) continue;
    const w = V3(...ARM.joints.wheel.at); w.x = L.hinge[0].at[0] > 0 ? Math.abs(w.x) : -Math.abs(w.x);   // (the port arm's hinges sit at +x)
    const c = dk(w), a = spin * Math.max(0, 1 - D.t * 3);
    _spin.makeTranslation(c.x, c.y, c.z).multiply(new THREE.Matrix4().makeRotationAxis(_sa.set(1, 0, 0), a)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
    C.poseLeaf(L, D.t, _spin);
  }
  return moved;
}
// the pods: at rest facing along the ship; swinging (the lab's Thrusters), each turns through its yaw and pitch on its
// own slow beat and fires the jet at its trailing end in bursts; jets: plume.js's set of podJets (role 'pods')
const _pm = new THREE.Matrix4();
export function podStep(built, on, time, jets) {
  const pods = built.doors.filter((D) => D.piece === 'mbPod');
  const swing = (i) => (on ? [0.5 + 0.5 * Math.sin(time * 0.9 + i * 1.7), 0.5 + 0.5 * Math.sin(time * 1.3 + i * 2.3)] : [0.5, 0.5]);
  pods.forEach((D, i) => {
    const [ty, tp] = swing(i);
    // (each hinge's t from -1 to 1 about rest, as a fraction of its angle: rest is the middle)
    for (const L of D.leaves) _pm.copy(C.poseLeaf(L, [2 * ty - 1, 2 * tp - 1]));
    if (!jets) return;
    // the jets: from each end, turned with the pod; the trailing end fires, in bursts
    const fire = on && Math.sin(time * 2.2 + i * 1.3) > -0.2;
    const M = _pm.clone();
    for (const [k, sz] of [[0, 1], [1, -1]]) {
      const J = jets.jets[i * 2 + k]; if (!J) continue;
      const endAt = V3(0, 0, sz * (POD.size[2] / 2 + 0.01)).applyMatrix4(M), dir = V3(0, 0, sz).transformDirection(M);
      J.aim(endAt, dir); J.on = fire && (sz < 0) === (Math.sin(time * 0.45 + i) > 0);
    }
  });
}
// the canisters on their mounts, or (off) the mounts empty
export function canisterStep(built, on) { for (const D of built.doors.filter((q) => q.piece === 'mbCanister')) for (const L of D.leaves) C.poseLeaf(L, D.t, null, !on); }

// ── IN THE SHIP LAB (labs/ships/main.js) ────────────────────────────────────────────────────────────────────────────
export const LAB = {
  controls: ['arms', 'thrusters', 'canisters', 'gear', 'door', 'dirt', 'throttle'],
  dirt: { None: 0, Some: 0.85, Lots: 1.25 },
  spots: { Canopy: { at: [5.2, 6.4, 10.5], look: [0, 3.9, 4.2] }, Lift: { at: [6.5, 1.2, 4.5], look: [0, 1.4, -0.6] }, Seats: { at: [0, 4.05, 3.75], look: [0, 3.5, 7.0] }, Arms: { at: [7.5, 3.6, 11.5], look: [0, 1.8, 5.5] } },
  doorTip: 'Lower the lift\'s platform to the ground and open the hatch over it, or close it and raise the platform',
  materials: (mats, dirt) => grimeMaterials(mats, { dirt }),
  setDirt: (v) => { GRIME.dirt.value = v; },
  jets: () => [{ role: 'main', nozzles: jetNozzles(), opts: JET }, { role: 'pods', nozzles: podJets(), opts: { len: POD_JET.len, gain: POD_JET.gain } }],
  step(B, st, dt, { updateDoors, jets, time }) {
    gearStep(B, st.gear === 'up', dt, updateDoors);
    liftStep(B, st.door === 'open', dt, updateDoors);
    armStep(B, st.arms === 'stowed', dt, updateDoors, time * ARMS.spin);
    const pj = jets?.find((J) => J.role === 'pods')?.set;
    if (pj) pj.setThrust(st.thrusters ? POD_JET.thrust : 0);
    podStep(B, st.thrusters, time, pj);
    canisterStep(B, st.canisters);
  },
  // (for pictures part way: { gear, doors, lift, hatch, arms } each 0 to 1, thrusters { time }, canisters on/off)
  pose(B, at, { updateDoors, jets }) {
    const of = { gear: 'mbGear', doors: 'mbGearDoors', arms: 'mbArm' };
    for (const [k, t] of Object.entries(at)) {
      if (of[k]) for (const D of B.doors.filter((d) => d.piece === of[k])) { D.t = t > 0 ? 0 : 1; updateDoors([D], new THREE.Vector3(), t > 0 ? t / D.speed : 2 / D.speed, t > 0 ? 'open' : 'shut'); }
    }
    if (at.lift != null || at.hatch != null) {
      for (const D of B.doors.filter((d) => d.piece === 'mbLift')) {
        const isLift = D.leaves.some((L) => L.meshes?.[0]?.name.includes('platform') || L.meshes?.[0]?.name.includes('rod')), t = isLift ? at.lift ?? 0 : at.hatch ?? 0;
        D.t = t > 0 ? 0 : 1; updateDoors([D], new THREE.Vector3(), t > 0 ? t / D.speed : 2 / D.speed, t > 0 ? 'open' : 'shut');
      }
    }
    if (at.arms != null) armStep(B, at.arms > 0.5, 0, () => false, at.spin ?? 0);
    const pj = jets?.find((J) => J.role === 'pods')?.set;
    if (at.thrusters != null) { if (pj) pj.setThrust(at.thrusters === false ? 0 : POD_JET.thrust, true); podStep(B, at.thrusters !== false, at.thrusters === false ? 0 : at.thrusters, pj); }
    if (at.canisters != null) canisterStep(B, at.canisters);
  },
};

// ── the catalog ─────────────────────────────────────────────────────────────────────────────────────────────────────
const GR = 'Ships';
export const SHIP_MINER_BUILT = {
  mbHull: { name: 'Miner (built): hull', group: GR, at: 'free', foot: [7, 5, 18], variants: ['hull'], build: mbHull },
  mbMounts: { name: 'Miner (built): canister mounts', group: GR, at: 'free', foot: [6, 3, 5], variants: ['both sides'], build: mbMounts },
  mbCanopy: { name: 'Miner (built): canopy', group: GR, at: 'free', foot: [3, 2, 3.5], variants: ['glass'], build: mbCanopy },
  mbMarks: { name: 'Miner (built): lights and marks', group: GR, at: 'free', foot: [7, 5, 18], variants: ['marks'], build: (p) => mbMarks(p) },
  mbCanister: { name: 'Miner (built): ore canister', group: GR, at: 'free', foot: [1, 1, 2.2], variants: CANISTERS.spots.map((q) => q.name), build: mbCanister },
  mbArm: { name: 'Miner (built): mining arm', group: GR, at: 'free', foot: [1.2, 3, 7], variants: ['port', 'starboard'], build: mbArm },
  mbPod: { name: 'Miner (built): thruster pod', group: GR, at: 'free', foot: [1, 1, 1.3], variants: PODS.map((q) => q.name), build: mbPod },
  mbLift: { name: 'Miner (built): belly lift', group: GR, at: 'free', foot: [2, 4, 2], variants: ['belly'], build: (p) => mbLift(p) },
  mbGear: { name: 'Miner (built): landing leg', group: GR, at: 'free', foot: [1, 1.4, 2], variants: ['port', 'starboard'], build: legLeaves },
  mbGearDoors: { name: 'Miner (built): leg pod doors', group: GR, at: 'free', foot: [1, 0.5, 2], variants: ['port', 'starboard'], build: mbGearDoors },
  mbWells: { name: 'Miner (built): leg pods', group: GR, at: 'free', foot: [5, 0.6, 2], variants: ['pods'], build: mbWells },
  mbCockpit: { name: 'Miner (built): cockpit', group: GR, at: 'free', foot: [2.5, 2, 3], variants: ['two seats'], build: (p) => mbCockpit(p) },
};
