// THE MEDIC, BUILT: the ship's own parts, on the 3,000-triangle smart mesh made from the game's maker's picture (its
// data is medic-built.hull.js, made by the rig ~/pw/space-math/rigs/medic-built/rig/makehull.mjs), with the four legs
// from the 8,000-triangle one. The 3k's own stern and its two ring engines are kept (the game's maker: they suit the
// Medic). Everything is painted in flat colours from a small palette, face by face, by the rules below, with the grime
// over it. The machinery it shares with Explorer C and the Miner is built-common.js.
// The ship itself is the layout file kit/rooms/ship-medic-built.json; these are the catalog pieces it names (group
// 'Ships'). Frame: nose +z, the ship's left (port) +x; each piece is drawn standing on the cabin's deck (y 0 at DECK,
// 1.74 m off the ground: the floor of the bay between the two side openings), centred on the ship's middle (x 0, z 0).
// 17.4 m nose to stern.
//   mdHull       'hull'      the 3k hull painted by RULES (ZONES split the faces where a colour line must cross one: the
//                            lower band, the yellow stripes, the fin's tip); its two ring engines, their recesses dark
//                            metal (the jet is plume.js's, jetNozzles), blue light bars round each drum
//   mdCanopy     'glass'     the canopy: the panes his picture has (the windscreen across the front and, each side, its
//                            corner pane and the side window behind it) in smoked glass, a black spar part along every
//                            border and round the outline
//   mdMarks      'marks'     what is laid on the skin: the blue light strips, the amber headlamps, the teal pulse line
//                            (the medical mark: no red cross, a protected symbol)
//   mdBay        'med bay'   the bay between the two side openings (Meshy's tunnel through the ship): its floor, end
//                            walls and ceiling, the lights, the inner doors fore and aft (shut), two patient beds and
//                            their monitors; the medical cabinets along the starboard opening (door 'equip': shown when
//                            the starboard ramp is sealed, the one-ramp layout)
//   mdRamp       'port' / 'starboard'   a ramp: two leaves of one door ('ramp', 1 down): the main section closes the
//                            opening standing up, hinged at the sill; the foot section, folded against its inside,
//                            swings out to carry it on to the ground
//   mdCrewDoor   'port' / 'starboard'   a crew door: the doorway's jambs and the door itself, an airstair (door 'crew',
//                            1 open) hinged at the sill, its inside a steep stair to the ground
//   mdAirlock    'port' / 'starboard'   the small airlock behind it, its inner door (shut)
//   mdGear       'port front' / 'port rear' / 'starboard front' / 'starboard rear'   a landing leg (the 8k's): its pad and
//                            drum (one leaf) and its struts and block (another) rise into a well in the belly (door
//                            'gear', 1 up), the struts sliding into the drum as they go; the pad's sole closes the well
//   mdWells      'wells'     the legs' wells: dark walls from the belly up, and their tops (the rear two stand 0.3 m
//                            over the cabin's deck: a ledge; the front two under the flight deck)
//   mdCockpit    'two seats' two bucket seats side by side, the pedestal between them, the dash and side consoles, on
//                            a flight deck raised over the cabin's, the hull's inside round it dark; the bulkhead behind
import * as THREE from 'three';
import { Acc } from '../shipparts/outside/facet.js';
import { part } from '../shipparts/place.js';
import { SURF } from '../materials.js';
import * as C from './built-common.js';
import { HULL, ENGINE_AT, LEG, LEGS, WELLS, WELL_TOP, DECK as DECK0, BAY, CREW, PARTS, Q } from './medic-built.hull.js';
export { WELL_TOP };
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
  skin: s('#d9d5ca', 0.5, 0.04, 0.5),          // the white skin
  skinEdge: s('#d9d5ca', 0.5, 0.04, 1.0),
  dark: s('#43484f', 0.5, 0.3, 0.6),           // the graphite panels and lower band
  darkEdge: s('#43484f', 0.5, 0.3, 1.0),
  black: s('#1b1d20', 0.42, 0.3, 0.4),         // the canopy's spars, the frames
  blackEdge: s('#1b1d20', 0.42, 0.3, 0.9),
  yellow: s('#e3b11c', 0.45, 0.03, 0.6),       // the yellow accents, the hazard stripes
  belly: s('#555a61', 0.6, 0.25, 0.8),         // the belly
  metal: s('#6d7177', 0.4, 0.6, 0.6),          // struts, rods, hinges
  rubber: s('#202225', 0.85, 0.0, 0.5),
  inner: s(SURF.white[0], SURF.white[1], SURF.white[2], 0.35),   // the airlocks' walls (the station's off-white)
  deck: s('#55595f', 0.6, 0.3, 0.6),
  tread: s('#62666c', 0.7, 0.35, 0.7),         // the ramps' tread plates
  bay: s('#857660', 0.6, 0.12, 0.4),           // the bay's warm wall panels (his picture's lit bay)
  bayDark: s('#4b4239', 0.6, 0.15, 0.4),
  mattress: s('#e6dec6', 0.85, 0.0, 0.25), pillow: s('#f1ede2', 0.9, 0.0, 0.2),
  drum: s('#5d636b', 0.45, 0.45, 0.6), drumEdge: s('#5d636b', 0.45, 0.45, 1.0),   // the engines' drums: lighter metal
  nozzle: s('#2a2d32', 0.4, 0.75, 0.8), rim: s('#6a7078', 0.32, 0.7, 0.7), core: s('#16181b', 0.45, 0.8, 0.8),
  screen: s('#0c1418', 0.2, 0.1, 0.2),
};
// (glows kept below the point where they wash out to white: the blue stays blue, the amber amber)
export const GLOW = { strip: [0.04, 0.5, 2.1], warm: [2.1, 0.78, 0.1], bay: [2.2, 1.45, 0.62], teal: [0.06, 1.7, 1.25], keypad: [0.1, 0.9, 2.2], white: [2.4, 2.3, 2.1] };

// ── PAINTING THE HULL ────────────────────────────────────────────────────────────────────────────────────────────────
// ZONES (built-common.js paintFaces): a |x| + b y + c z <= d inside each plane
// (a band leaning along z: inside where y - lean z lies between lo and hi, and z between z0 and z1)
const band = (zone, y0, y1, z0, z1, lean = 0, parts = ['body']) => ({ zone, parts, planes: [[0, -1, lean, -y0 + lean * 0], [0, 1, -lean, y1], [0, 0, -1, -z0], [0, 0, 1, z1]] });
export const ZONES = [
  // the dark lower band: the hull under y 2.0 (his graphite lower hull and skirts), under 2.45 on the nose's chin
  { zone: 'lower', parts: ['body', 'canopy'], planes: [[0, 1, 0, 2.0]] },
  { zone: 'lower', parts: ['body', 'canopy'], planes: [[0, 1, 0, 2.45], [0, 0, -1, -5.6]] },
  // the yellow stripe along each side of the nose (his long bar leaning back), and the short bar ahead of it
  band('noseYellow', 2.62, 2.98, 4.3, 6.0, 0.08), band('noseYellow', 2.62, 2.98, 6.15, 6.55, 0.08),
  // the three yellow bars leaning on the stern's sides, his "///"
  ...[0, 1, 2].map((k) => ({ zone: 'aftYellow', parts: ['body'], planes: [[0, -1, 0, -3.05], [0, 1, 0, 3.45], [-1, 0, 0, -2.4], [0, 0.7, 1, -4.25 - k * 0.42 + 0.7 * 3.25 + 0.28], [0, -0.7, -1, 4.25 + k * 0.42 - 0.7 * 3.25]] })),
  // the fin's tip: yellow (his)
  { zone: 'finTip', parts: ['body'], planes: [[0, -1, 0, -7.05], [1, 0, 0, 0.5]] },
];
const edge = (paint) => (f) => (f.thin ? paint + 'Edge' : paint);
// (the engines: a face's distance from its ring's axis, and which ring)
const ringOf = (c) => ENGINE_AT[c.x >= 0 ? 0 : 1], fromAxis = (c, E) => Math.hypot(c.x - E.axis[0], c.y - E.axis[1]);
export const RULES = [
  ['the canopy: glass, its hood', (f) => f.part === 'canopy', (f) => (canopyPanes().covers(f.c) ? 'glass' : f.zone === 'lower' ? edge('dark')(f) : f.zone === 'noseYellow' ? 'yellow' : edge('skin')(f))],
  ['under the canopy\'s glass: gone', (f) => canopyPanes().covers(f.c, 0.12), 'glass'],
  ['the bay (drawn by mdBay)', (f) => f.part === 'bay', 'bay'],
  // the engines: the recess dark metal (its floor the core), the rim round it, the drum graphite
  ['the engines\' recesses', (f) => f.part === 'engines' && f.c.z < ringOf(f.c).back + 0.62 && fromAxis(f.c, ringOf(f.c)) < ringOf(f.c).mouth + 0.04, (f) => (f.n.z < -0.9 && f.c.z > ringOf(f.c).floor - 0.05 ? 'core' : 'nozzle')],
  ['the engines\' rims', (f) => f.part === 'engines' && f.n.z < -0.6, 'rim'],
  ['the engines\' drums', (f) => f.part === 'engines', edge('drum')],
  ['the stripes', (f) => f.zone === 'noseYellow' || f.zone === 'aftYellow' || f.zone === 'finTip', 'yellow'],
  // (the fin: white, its trailing part graphite, his)
  ['the fin\'s trailing part: graphite', (f) => f.c.y > 5.7 && Math.abs(f.c.x) < 0.5 && f.c.z < -7.75, edge('dark')],
  ['the fin: white', (f) => f.c.y > 5.7 && Math.abs(f.c.x) < 0.5 && f.c.z < -4.0, edge('skin')],
  ['the bay openings\' frames: graphite', (f) => Math.abs(f.c.x) > 2.45 && f.c.z > BAY.ends[0] - 0.22 && f.c.z < BAY.ends[1] + 0.22 && f.c.y > 1.5 && f.c.y < 4.45 && (Math.abs(f.n.z) > 0.5 || Math.abs(f.n.y) > 0.5 || f.thin), edge('dark')],
  ['the belly: grey', (f) => f.n.y < -0.55, 'belly'],
  ['the lower band: graphite', (f) => f.zone === 'lower', edge('dark')],
  // (his panels' graphite frames: the 3k's thin strips along the edges of its plates)
  ['the plates\' edges: graphite', (f) => f.thin && f.part === 'body', 'darkEdge'],
  // (his yellow patches on the shoulders either side of the cockpit, seen from above)
  ['the shoulders\' yellow patches', (f) => f.n.y > 0.45 && Math.abs(f.c.x) > 2.0 && f.c.z > 2.9 && f.c.z < 4.6 && f.c.y > 3.6, 'yellow'],
  ['the roof\'s modules: graphite', (f) => f.c.y > 5.35 && Math.abs(f.c.x) < 1.25 && f.c.z > -6 && f.c.z < 3.4 && (f.n.y < 0.7 || Math.abs(f.c.z + 0.2) < 1.4), edge('dark')],
  ['the stern round the engines: graphite', (f) => f.c.z < -6.0 && f.c.y < 5.3, edge('dark')],
  ['everything else: white', () => true, edge('skin')],
];
let FACES = null;
export function hullFaces() {
  if (FACES) return FACES;
  FACES = C.paintFaces(mesh(HULL), new Uint8Array(bytes(HULL.part)), PARTS, ZONES, RULES);
  return FACES;
}
const drawn = (f) => f.paint !== 'glass' && f.paint !== 'gone' && f.paint !== 'bay';
const rayHull = (o, d) => C.rayFaces(hullFaces(), o, d, drawn);

// ── THE HULL ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// (inside the nose, round the cockpit, every face's back is drawn dark too: from the seats the hull's inside is a dark
// wall wherever there is no glass, never the sky through it)
export const NOSE_IN = { z: 3.55 };
// THE ENGINES' LIGHT BARS: a band of blue bars round each drum (his side view's), a hair proud of it
export const BARS = { z: [1.05, 1.35], n: 24, every: 3 };
function mdHull(p) {
  const acc = new Acc(), F = hullFaces();
  C.drawFaces(acc, F.map((f) => (f.c.z > NOSE_IN.z && f.paint !== 'bay' && !f.back ? { ...f, back: true } : f)), { PAL, dk, backSurf: PAL.dark, skip: ['glass', 'gone', 'bay'] });
  // (the bars: rays in toward each ring's axis find its drum; a bar every `every` - 1 of n, one gap)
  for (const E of ENGINE_AT) {
    const [ax, ay] = E.axis;
    for (let i = 0; i < BARS.n; i++) {
      if (i % BARS.every === BARS.every - 1) continue;
      const q = [];
      for (const [da, zz] of [[0, BARS.z[0]], [1, BARS.z[0]], [1, BARS.z[1]], [0, BARS.z[1]]]) {
        const t = ((i + da * 0.8 + 0.1) / BARS.n) * PI * 2, d = V3(Math.cos(t), Math.sin(t), 0), z = E.back + zz;
        const h = C.rayFaces(F, V3(ax, ay, z).addScaledVector(d, 3), d.clone().negate(), (f) => f.part === 'engines');
        if (!h) break; q.push(h.p.addScaledVector(h.n, 0.012));
      }
      if (q.length < 4) continue;
      const m = q[0].clone().add(q[2]).multiplyScalar(0.5);
      acc.poly(q.map(dk), V3(m.x - ax, m.y - ay, 0).normalize(), GLOW.strip, 'glow', 99);
    }
  }
  acc.flush(p);
  return p;
}
// THE JETS (plume.js): one from the floor of each ring's recess, straight aft, as wide as the recess's floor
export const JET = { len: 9.0, gain: 1.0 };
export function jetNozzles() { return ENGINE_AT.map((E) => ({ at: [E.axis[0], E.axis[1], E.floor - 0.01], dir: [0, 0, -1], r: Math.min(E.floorR, E.mouth) * 0.9 })); }

// ── THE CANOPY ───────────────────────────────────────────────────────────────────────────────────────────────────────
// The panes his picture has (hero, front and top views): the windscreen across the front (bent where the 3k's band
// bends), and each side its corner pane and the side window behind it. Each pane is one clean polygon through named
// corners on the 3k's canopy (the 3k's own vertices: built-common.js buildPanes), a black spar along each border
// between panes and a wider one round the outline.
//   the windscreen   W0 its foot's corner, W2 where it bends, W1 its top corner
//   the corner pane  C1 its lower front corner (on the nose's side), C2 its back corner (on the sill)
//   the side window  S1 its lower back corner (on the sill), U its top corner (on the roof's edge)
export const CANOPY = {
  corners: {
    W0: { at: [0.892, 3.310, 7.378] }, W2: { at: [0.998, 4.170, 6.331] }, W1: { at: [1.069, 4.774, 5.319] },
    C1: { at: [1.832, 3.301, 6.970] }, C2: { at: [1.717, 3.762, 5.328] },
    S1: { at: [1.868, 3.948, 4.317] }, U: { at: [0.936, 5.013, 4.920] },
  },
  side: [['corner', 'five-sided', ['W0', 'C1', 'C2', 'W1', 'W2']], ['side window', 'quad', ['C2', 'S1', 'U', 'W1']]],
  top: [['windscreen', 'quad, bent', [['W0', 'W2', "W2'", "W0'"], ['W2', 'W1', "W1'", "W2'"]]]],
  spar: { w: 0.07, out: 0.035, in: 0.03 }, sill: { w: 0.12, out: 0.02, shift: 0.03 },
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
// (the canopy's outside: away from a point over the flight deck)
const outward = (n, c) => (n.dot(V3(c.x, c.y - 3.3, c.z - 5.0)) < 0 ? n.negate() : n);
export function canopyPanes() { if (PANES) return PANES; PANES = C.buildPanes(CANOPY, canopyMesh(), outward); return PANES; }
export function spar(p) { return C.spar(p, { out: CANOPY.spar.out, in: CANOPY.spar.in, surf: PAL.blackEdge }); }
export const GLASS = { inset: 0.008, step: 0.6 };
function mdCanopy(p) { return C.drawCanopy(p, canopyPanes(), CANOPY, GLASS, part(spar), dk); }

// ── LIGHTS AND MARKS laid on the skin (a ray in from outside finds the face; the mark lies 1.2 cm off it) ────────────
export const MARKS = {
  // his blue strips: along each side of the nose under the yellow stripe, and aft on the stern's sides
  strips: [{ z: [4.55, 5.55], y: 2.42, h: 0.08 }, { z: [-5.5, -4.55], y: 2.75, h: 0.07 }, { z: [-3.3, -2.5], y: 4.1, h: 0.06 }],
  // under the windscreen, across the nose (his blue strip in a dark housing)
  noseStrip: { x: 0.36, y: 3.05, h: 0.07 },
  // his amber headlamps in the nose's dark chin, each a housing standing out of it with its glowing face at the front
  lamps: [{ x: 0.62, y: 2.18, w: 0.4, h: 0.15, rim: 0.035 }],
  // THE MEDICAL MARK: a teal pulse line (a heartbeat's trace) along each side, aft of the bay (a red cross is a
  // protected symbol): its points (along z, up y) from its start, metres; its width
  pulse: { z0: -2.35, y0: 3.62, w: 0.045, pts: [[0, 0], [0.32, 0], [0.4, 0.1], [0.48, 0], [0.56, 0], [0.62, -0.12], [0.7, 0.42], [0.78, -0.26], [0.86, 0], [1.0, 0], [1.08, 0.08], [1.18, 0], [1.6, 0]] },
};
const onSide = (s, y, z, lift = 0.012) => { const h = rayHull(V3(s * 8, y, z), V3(-s, 0, 0)); return h ? h.p.addScaledVector(h.n, lift) : null; };
const onFront = (x, y, lift = 0.012) => { const h = rayHull(V3(x, y, 12), V3(0, 0, -1)); return h ? h.p.addScaledVector(h.n, lift) : null; };
function mdMarks(p) {
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
      const zs = []; for (const ss of [1, -1]) for (const a of [-1, 1]) for (const b of [-1, 1]) { const h = onFront(ss * Lm.x + a * (Lm.w / 2 + Lm.rim), Lm.y + b * (Lm.h / 2 + Lm.rim), 0); if (h) zs.push(h.z); }
      const zf = Math.max(...zs) + 0.04, zb = Math.min(...zs) - 0.06, x = s * Lm.x;
      boxAt(acc, V3(x, Lm.y, (zf + zb) / 2), AX, [Lm.w / 2 + Lm.rim, Lm.h / 2 + Lm.rim, (zf - zb) / 2], PAL.black, ['w-']);
      acc.poly([V3(x - Lm.w / 2, Lm.y - Lm.h / 2, zf + 0.004), V3(x + Lm.w / 2, Lm.y - Lm.h / 2, zf + 0.004), V3(x + Lm.w / 2, Lm.y + Lm.h / 2, zf + 0.004), V3(x - Lm.w / 2, Lm.y + Lm.h / 2, zf + 0.004)].map(dk), V3(0, 0, 1), GLOW.warm, 'glow', 99);
      p.light([x, Lm.y - DECK, zf + 0.3], 0.6, [1.2, 0.85, 0.45], [0, -0.3, 1], 4);
    }
    // the pulse line: a ribbon along its points, laid on the side
    const P = MARKS.pulse, pts = P.pts.map(([u, v]) => [P.z0 + (s > 0 ? -u : -u), P.y0 + v]);
    for (let i = 0; i < pts.length - 1; i++) {
      const [za, ya] = pts[i], [zb, yb] = pts[i + 1], L = Math.hypot(zb - za, yb - ya), nz = -(yb - ya) / L * P.w / 2, ny = (zb - za) / L * P.w / 2;
      const q = [onSide(s, ya - ny, za - nz, 0.014), onSide(s, yb - ny, zb - nz, 0.014), onSide(s, yb + ny, zb + nz, 0.014), onSide(s, ya + ny, za + nz, 0.014)];
      if (q.some((v) => !v)) continue;
      polyTo(acc, q, V3(s, 0, 0), GLOW.teal, 'glow');
    }
  }
  { const N = MARKS.noseStrip, c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => onFront(a * N.x, N.y + b * N.h / 2)); if (c.every((v) => v)) acc.poly(c.map(dk), V3(0, 0, 1), GLOW.strip, 'glow', 99); }
  acc.flush(p);
  return p;
}

// ── THE MED BAY ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Meshy's bay: a tunnel through the ship between the two side openings, its floor the deck (BAY). Its own faces
// (floor, ceiling, end walls) painted as a bay: the deck, warm panels, a light ceiling; over them the warm light strips
// (his picture's lit bay), the inner doors fore and aft (shut, wide enough for a stretcher), and the two patient beds,
// one each side of the middle line in the bay's aft half, lying across the ship (as both meshes have them), each with a
// monitor on the aft wall showing the teal pulse line. The forward half is the stretcher's way from either ramp.
export const BEDS = { x: [0.55, 2.35], z: [-1.32, -0.42], h: 0.62, mattress: 0.14 };
export const INNER = { w: 1.3, h: 2.05 };
// the cabinets along the starboard opening when its ramp is sealed (the one-ramp layout): drawers, shelves, a screen
export const EQUIP = { x: [-2.58, -2.1], z: [-0.48, 1.48], h: 2.0, console: { x: [-2.0, -0.55], z: [1.0, 1.48], h: 0.9 } };
const bayPaint = (f) => (f.n.y > 0.7 ? PAL.deck : f.n.y < -0.7 ? PAL.inner : Math.abs(f.c.x) > BAY.x - 0.05 ? PAL.dark : PAL.bay);
function mdBay(p) {
  const acc = new Acc(), F = hullFaces().filter((f) => f.paint === 'bay');
  for (const f of F) acc.tris([f.pts.map(dk)], f.n, bayPaint(f));
  const [za, zf] = BAY.ends, y0 = BAY.floor, y1 = BAY.ceil, xs = BAY.x - 0.02;
  // (hazard edges along each opening's sill: yellow and black, on the deck)
  for (const sx of [1, -1]) {
    const n = 14, e = 0.12, x0 = sx * (xs - e), x1 = sx * xs;
    for (let i = 0; i < n; i++) { const z0 = za + (zf - za) * i / n, z1 = za + (zf - za) * (i + 1) / n; polyTo(acc, [V3(x0, y0 + 0.004, z0), V3(x1, y0 + 0.004, z0), V3(x1, y0 + 0.004, z1), V3(x0, y0 + 0.004, z1)], V3(0, 1, 0), i % 2 ? PAL.black : PAL.yellow); }
  }
  // the light strips: two across the ceiling, and one over each opening's head inside (his amber strip)
  for (const z of [-0.95, 0.75]) polyTo(acc, [V3(-1.9, y1 - 0.006, z - 0.06), V3(1.9, y1 - 0.006, z - 0.06), V3(1.9, y1 - 0.006, z + 0.06), V3(-1.9, y1 - 0.006, z + 0.06)], V3(0, -1, 0), GLOW.bay, 'glow');
  // the inner doors: one in each end wall, on the middle line (a dark panel with a lit strip over it and a seam)
  for (const [z, nz] of [[za, 1], [zf, -1]]) {
    boxAt(acc, V3(0, y0 + INNER.h / 2, z + nz * 0.025), AX, [INNER.w / 2, INNER.h / 2, 0.025], PAL.bayDark, [nz > 0 ? 'w-' : 'w+']);
    boxAt(acc, V3(0, y0 + INNER.h / 2, z + nz * 0.052), AX, [0.008, INNER.h / 2 - 0.04, 0.003], PAL.black, [nz > 0 ? 'w-' : 'w+']);
    const q = [V3(-0.55, y0 + INNER.h + 0.06, z + nz * 0.01), V3(0.55, y0 + INNER.h + 0.06, z + nz * 0.01), V3(0.55, y0 + INNER.h + 0.1, z + nz * 0.01), V3(-0.55, y0 + INNER.h + 0.1, z + nz * 0.01)];
    polyTo(acc, q, V3(0, 0, nz), GLOW.strip, 'glow');
    // (wall panels' seams on the end wall: dark lines)
    for (const x of [-1.9, -1.3, 1.3, 1.9]) polyTo(acc, [V3(x - 0.012, y0 + 0.1, z + nz * 0.006), V3(x + 0.012, y0 + 0.1, z + nz * 0.006), V3(x + 0.012, y1 - 0.1, z + nz * 0.006), V3(x - 0.012, y1 - 0.1, z + nz * 0.006)], V3(0, 0, nz), PAL.bayDark);
  }
  // THE BEDS: a dark frame on four legs with castors, a mattress, a pillow at the inboard end; a monitor on the aft wall
  // over each, its screen dark with the teal pulse line
  for (const sx of [1, -1]) {
    const [b0, b1] = BEDS.x, [c0, c1] = BEDS.z, xm = sx * (b0 + b1) / 2, zm = (c0 + c1) / 2, hx = (b1 - b0) / 2, hz = (c1 - c0) / 2, yt = y0 + BEDS.h;
    boxAt(acc, V3(xm, yt - 0.06, zm), AX, [hx, 0.05, hz], PAL.dark);
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      boxAt(acc, V3(xm + a * (hx - 0.08), y0 + (BEDS.h - 0.11) / 2 + 0.05, zm + b * (hz - 0.08)), AX, [0.025, (BEDS.h - 0.11) / 2, 0.025], PAL.metal, ['v-']);
      boxAt(acc, V3(xm + a * (hx - 0.08), y0 + 0.04, zm + b * (hz - 0.08)), AX, [0.04, 0.04, 0.03], PAL.rubber, ['v-']);
    }
    boxAt(acc, V3(xm, yt + BEDS.mattress / 2, zm), AX, [hx - 0.03, BEDS.mattress / 2, hz - 0.03], PAL.mattress, ['v-']);
    const xp = sx * (b0 + 0.22);
    boxAt(acc, V3(xp, yt + BEDS.mattress + 0.05, zm), AX, [0.16, 0.05, hz - 0.12], PAL.pillow, ['v-']);
    // (rails along its long sides: yellow, his)
    for (const b of [-1, 1]) boxAt(acc, V3(xm, yt + 0.12, zm + b * (hz + 0.01)), AX, [hx - 0.25, 0.015, 0.012], PAL.yellow);
    // the monitor
    const mx = sx * 1.2, my = y0 + 1.55, mz = za + 0.06;
    boxAt(acc, V3(mx, my, mz), AX, [0.32, 0.22, 0.04], PAL.dark, ['w-']);
    polyTo(acc, [V3(mx - 0.28, my - 0.18, mz + 0.042), V3(mx + 0.28, my - 0.18, mz + 0.042), V3(mx + 0.28, my + 0.18, mz + 0.042), V3(mx - 0.28, my + 0.18, mz + 0.042)], V3(0, 0, 1), PAL.screen);
    const tr = [[0, 0], [0.18, 0], [0.22, 0.05], [0.26, 0], [0.3, 0], [0.33, -0.06], [0.37, 0.13], [0.41, -0.09], [0.45, 0], [0.56, 0]];
    for (let i = 0; i < tr.length - 1; i++) {
      const [u0, v0] = tr[i], [u1, v1] = tr[i + 1], L = Math.hypot(u1 - u0, v1 - v0), ox = -(v1 - v0) / L * 0.008, oy = (u1 - u0) / L * 0.008;
      const P0 = V3(mx - 0.28 + u0, my + v0, mz + 0.045), P1 = V3(mx - 0.28 + u1, my + v1, mz + 0.045);
      polyTo(acc, [P0.clone().add(V3(-ox, -oy, 0)), P1.clone().add(V3(-ox, -oy, 0)), P1.clone().add(V3(ox, oy, 0)), P0.clone().add(V3(ox, oy, 0))], V3(0, 0, 1), GLOW.teal, 'glow');
    }
  }
  acc.flush(p);
  for (const z of [-0.95, 0.75]) p.light([0, y1 - DECK - 0.2, z], 2.6, [1.25, 0.95, 0.6], [0, -1, 0], 4.5);
  // THE CABINETS (door 'equip'; the lab shows them with the one-ramp layout): drawers below, shelves and a screen above
  p.leaf('md:cabinets', (lp) => {
    const a = new Acc(), [x0, x1] = EQUIP.x, [z0, z1] = EQUIP.z, xm = (x0 + x1) / 2, hx = (x1 - x0) / 2, zm = (z0 + z1) / 2, hz = (z1 - z0) / 2, b = y0;
    C.boxAt(a, V3(xm, b + EQUIP.h / 2, zm), AX, [hx, EQUIP.h / 2, hz], PAL.inner, [], dk);
    const xf = x1 + 0.004;
    for (let i = 0; i < 3; i++) for (const zz of [-0.5, 0.5]) C.boxAt(a, V3(xf, b + 0.2 + i * 0.27, zm + zz * hz), AX, [0.004, 0.11, hz / 2 - 0.05], PAL.metal, ['u-'], dk);
    C.boxAt(a, V3(xf, b + 1.45, zm), AX, [0.004, 0.35, hz - 0.1], PAL.screen, ['u-'], dk);
    a.poly([V3(xf + 0.004, b + 1.2, z0 + 0.25), V3(xf + 0.004, b + 1.2, z1 - 0.25), V3(xf + 0.004, b + 1.22, z1 - 0.25), V3(xf + 0.004, b + 1.22, z0 + 0.25)].map(dk), V3(1, 0, 0), GLOW.teal, 'glow', 99);
    // (the treatment console by the hall's door: a desk with its screen leaning back, the teal trace on it)
    const K = EQUIP.console, kx = (K.x[0] + K.x[1]) / 2, khx = (K.x[1] - K.x[0]) / 2, kz = (K.z[0] + K.z[1]) / 2, khz = (K.z[1] - K.z[0]) / 2;
    C.boxAt(a, V3(kx, b + K.h / 2, kz), AX, [khx, K.h / 2, khz], PAL.inner, ['v-'], dk);
    C.boxAt(a, V3(kx, b + K.h + 0.3, K.z[1] - 0.06), AX, [khx - 0.1, 0.26, 0.03], PAL.dark, [], dk);
    a.poly([V3(kx - khx + 0.14, b + K.h + 0.08, K.z[1] - 0.095), V3(kx + khx - 0.14, b + K.h + 0.08, K.z[1] - 0.095), V3(kx + khx - 0.14, b + K.h + 0.52, K.z[1] - 0.095), V3(kx - khx + 0.14, b + K.h + 0.52, K.z[1] - 0.095)].map(dk), V3(0, 0, -1), PAL.screen, 'solid', 99);
    a.poly([V3(kx - khx + 0.2, b + K.h + 0.29, K.z[1] - 0.1), V3(kx + khx - 0.2, b + K.h + 0.29, K.z[1] - 0.1), V3(kx + khx - 0.2, b + K.h + 0.31, K.z[1] - 0.1), V3(kx - khx + 0.2, b + K.h + 0.31, K.z[1] - 0.1)].map(dk), V3(0, 0, -1), GLOW.teal, 'glow', 99);
    a.flush(lp);
  }, { door: 'equip' });
  p.door('equip', [-1, 0, 0], 0, 2.0);
  return p;
}

// ── THE RAMPS ───────────────────────────────────────────────────────────────────────────────────────────────────────
// Each opening's ramp is its door. Up, the main section (A) stands in the opening on the 3k's sill lip, its outside
// (RAMP.face) white with a graphite frame, its tread facing into the bay, its top corners cut to the opening's (the 3k's
// opening has chamfered top corners); it is hinged on its outside's lower edge, on the lip (RAMP.hinge), so nothing of
// it sweeps below the lip as it turns, and down its underside rests on it. The foot section (B), a little narrower (it
// swings through the bay, past the jambs, which bulge in at the opening's ends), lies folded against A's tread, inside.
// Going down (door 'ramp', 0 up to 1 down), A swings out and down about its hinge and B unfolds about the joint at A's
// top (on the tread's side), until the two lie in one line from the lip to the ground, the foot's underside on it.
// Tread grey, hazard edges yellow and black (his).
export const RAMP = (() => {
  const face = 2.98, sill = 1.68, head = 4.13, A = head - sill, B = 1.4, T = 0.11, bevel = 0, chamfer = 0.32;
  const zA = [-1.83, 1.64], zB = [-1.7, 1.49];
  // (the slope: down, its underside runs from the hinge to the ground)
  const slope = Math.asin(sill / (A + B));
  return { face, sill, head, A, B, T, bevel, chamfer, zA, zB, slope, swing: PI / 2 + slope, speed: 0.32, hinge: [face, sill] };
})();
// (a slab along the ramp from u0 to u1, metres from the hinge (stowed: up the opening), across [z0, z1], T thick: its
// tread at x = face - T (stowed), its outside at the face (from `bevel` up, on A: under it a bevel down to the hinge
// line; its top corners cut by `chamfer`); B is drawn as A's continuation in line, then folded by its leaf's base)
function rampSection(a, s, u0, u1, isA) {
  const R = RAMP, xo = s * R.face, xt = s * (R.face - R.T), [z0, z1] = isA ? R.zA : R.zB, bv = isA ? R.bevel : 0, ch = isA ? R.chamfer : 0;
  const P = ([x, u, z]) => V3(x, R.sill + u, z), poly = (q, n, surf) => a.poly(q.map((v) => dk(P(v))), n, surf, 'solid', 99);
  // (its outline across: [u, z] round it, the chamfered corners on A's top)
  const outline = (lo, e = 0) => (ch ? [[lo, z0 + e], [u1 - ch - e * 0.4, z0 + e], [u1 - e, z0 + ch + e * 0.4], [u1 - e, z1 - ch - e * 0.4], [u1 - ch - e * 0.4, z1 - e], [lo, z1 - e]] : [[lo, z0 + e], [u1 - e, z0 + e], [u1 - e, z1 - e], [lo, z1 - e]]);
  // the tread (facing the bay when stowed: -s x), hazard edges along its sides, the plates' seams
  const e = 0.13, xr = xt - s * 0.002, ut = u1 - (ch ? ch + 0.05 : 0);
  poly(outline(u0).map(([u, z]) => [xt, u, z]), V3(-s, 0, 0), PAL.tread);
  const nB = Math.max(2, Math.round((ut - u0) / 0.2));
  for (let i = 0; i < nB; i++) {
    const ua = u0 + (ut - u0) * i / nB, ub = u0 + (ut - u0) * (i + 1) / nB, col = i % 2 ? PAL.black : PAL.yellow;
    for (const [za, zb] of [[z0, z0 + e], [z1 - e, z1]]) poly([[xr, ua, za], [xr, ub, za], [xr, ub, zb], [xr, ua, zb]], V3(-s, 0, 0), col);
  }
  for (let u = u0 + 0.6; u < ut - 0.2; u += 0.6) poly([[xr - s * 0.001, u - 0.01, z0 + e], [xr - s * 0.001, u + 0.01, z0 + e], [xr - s * 0.001, u + 0.01, z1 - e], [xr - s * 0.001, u - 0.01, z1 - e]], V3(-s, 0, 0), PAL.dark);
  // the outside: on A white with a graphite frame round it, on B graphite (the ramp's underside); A's bevel under it
  const f = 0.12, ub0 = u0 + bv;
  if (isA) {
    const O = outline(ub0), I = outline(ub0 + f, f);
    poly(I.map(([u, z]) => [xo, u, z]), V3(s, 0, 0), PAL.skin);
    for (let i = 0; i < O.length; i++) { const j = (i + 1) % O.length; poly([O[i], O[j], I[j], I[i]].map(([u, z]) => [xo, u, z]), V3(s, 0, 0), PAL.dark); }
    poly([[xt, u0, z0], [xo, ub0, z0], [xo, ub0, z1], [xt, u0, z1]], V3(s * bv, -R.T, 0).normalize(), PAL.darkEdge);
  } else poly(outline(u0).map(([u, z]) => [xo, u, z]), V3(s, 0, 0), PAL.dark);
  // its edges round the outline (on A, the bevel cuts the ends' lower corner) and, on B, its lower edge at the joint
  const O = outline(u0);
  for (let i = 0; i < O.length; i++) {
    const j = (i + 1) % O.length, [ua, za] = O[i], [ub, zb] = O[j]; if (Math.abs(ua - u0) < 1e-9 && Math.abs(ub - u0) < 1e-9) continue;
    const nn = V3(0, -(zb - za), ub - ua).normalize();
    const mid = [(ua + ub) / 2, (za + zb) / 2], toC = [mid[0] - (u0 + u1) / 2, mid[1] - (z0 + z1) / 2];
    if (nn.y * toC[0] + nn.z * toC[1] < 0) nn.negate();
    const lowA = (u) => (isA && u < ub0 ? xt + (xo - xt) * (u - u0) / bv : xo);
    const isTop = Math.abs(ua - u1) < 1e-9 && Math.abs(ub - u1) < 1e-9;
    poly([[xt, ua, za], [lowA(ua), ua, za], [lowA(ub), ub, zb], [xt, ub, zb]], nn, !isA && isTop ? PAL.yellow : PAL.darkEdge);
  }
  if (!isA) poly([[xo, u0, z0], [xo, u0, z1], [xt, u0, z1], [xt, u0, z0]], V3(0, -1, 0), PAL.darkEdge);
}
function mdRamp(p, side) {
  const s = side === 'starboard' ? -1 : 1, R = RAMP, xt = R.face - R.T;
  const h1 = { at: dk(V3(s * R.face, R.sill, 0)).toArray(), axis: [0, 0, 1], angle: -s * R.swing };
  // (the joint at A's top on the tread's side; B drawn in line above A, then folded down onto A's tread: the leaf's
  // base turns it there, and its hinge unfolds it, the turn of 180 degrees through the bay's side)
  const J = V3(s * xt, R.sill + R.A, 0), fold = C.turnAbout(dk(J), V3(0, 0, 1), s * PI);
  p.leaf('md:ramp A:' + side, (lp) => { const a = new Acc(); rampSection(a, s, 0, R.A, true); a.flush(lp); }, { door: 'ramp', hinge: h1 });
  p.leaf('md:ramp B:' + side, (lp) => { const a = new Acc(); rampSection(a, s, R.A, R.A + R.B, false); a.flush(lp); }, { ...C.leafPose(fold), door: 'ramp', hinge: [h1, { at: dk(J).toArray(), axis: [0, 0, 1], angle: -s * PI }] });
  p.door('ramp', [s * 4.5, -DECK + 1, 0], 0, R.speed);
  return p;
}

// ── THE CREW DOORS ──────────────────────────────────────────────────────────────────────────────────────────────────
// A doorway cut through the side just forward of the bay (CREW: his picture's small door with its keypad and the
// steps under it): its jambs from the skin in to the airlock, the airlock behind (its walls the station's off-white,
// a ceiling light, the inner door into the cabin, shut), and the door: an airstair hinged at the sill, white outside
// with a graphite edge, a round window and a lit keypad; open, it rests on the ground and its inside is a steep stair
// (treads level, yellow nosings, side rails).
export const CREWDOOR = { face: 2.74, inner: 1.35, top: 2.06, speed: 0.9, near: 2.6 };
export const CREWSTAIR = (() => { const L = CREW.y[1] - CREW.y[0]; return { L, angle: PI / 2 + Math.asin(DECK / L) }; })();
function crewPanel(acc, s, steps) {
  const [z0, z1] = CREW.z, e = 0.03, za = z0 + e, zb = z1 - e, L = CREWSTAIR.L - 0.008, T = 0.06, B = 0.05, xo = s * CREWDOOR.face;
  const P = (u, z, w = 0) => V3(xo - s * w, DECK + u, z);
  const out = V3(s, 0, 0), inn = V3(-s, 0, 0);
  const poly = (pts, n, surf, mat = 'solid') => acc.poly(pts.map(dk), n, surf, mat, 99);
  poly([P(B, za + B), P(B, zb - B), P(L - B, zb - B), P(L - B, za + B)], out, PAL.skin);
  for (const q of [[P(0, za), P(0, zb), P(B, zb - B), P(B, za + B)], [P(L, za), P(L - B, za + B), P(L - B, zb - B), P(L, zb)], [P(0, za), P(B, za + B), P(L - B, za + B), P(L, za)], [P(0, zb), P(L, zb), P(L - B, zb - B), P(B, zb - B)]]) poly(q, out, PAL.dark);
  // (its round window, dark glass in a black ring, and the keypad: blue)
  const wc = [(za + zb) / 2, L - 0.5], R0 = 0.16, R1 = 0.2;
  for (let i = 0; i < 16; i++) {
    const t0 = (i / 16) * PI * 2, t1 = ((i + 1) / 16) * PI * 2, A = (r, t) => P(wc[1] + Math.sin(t) * r, wc[0] + Math.cos(t) * r, -0.004);
    poly([P(wc[1], wc[0], -0.004), A(R0, t0), A(R0, t1)], out, PAL.screen);
    poly([A(R0, t0), A(R1, t0), A(R1, t1), A(R0, t1)], out, PAL.black);
  }
  const kz = s > 0 ? zb - 0.17 : za + 0.17;
  poly([P(1.02, kz - 0.06, -0.006), P(1.02, kz + 0.06, -0.006), P(1.18, kz + 0.06, -0.006), P(1.18, kz - 0.06, -0.006)], out, GLOW.keypad, 'glow');
  // its edges and inside face
  for (const [a, b, n] of [[P(0, za), P(L, za), V3(0, 0, -1)], [P(0, zb), P(L, zb), V3(0, 0, 1)], [P(L, za), P(L, zb), V3(0, 1, 0)], [P(0, za), P(0, zb), V3(0, -1, 0)]]) poly([a, b, b.clone().addScaledVector(inn, T), a.clone().addScaledVector(inn, T)], n, PAL.darkEdge);
  poly([P(0, za, T), P(L, za, T), P(L, zb, T), P(0, zb, T)], inn, steps ? PAL.deck : PAL.inner);
  if (!steps) return;
  // THE STEPS on its inside face: when open the face slopes up at the stair's angle; each tread a wedge level then,
  // a yellow nosing on its front
  const ang = Math.asin(DECK / CREWSTAIR.L), rise = 0.25, ds = rise / Math.sin(ang), run = rise / Math.tan(ang);
  const hu = Math.cos(ang), hw = Math.sin(ang), W = (u, w, z) => P(u, z, T + w);
  for (const z of [za + 0.025, zb - 0.025]) C.boxAt(acc, W(L / 2, 0.07, z), [V3(0, 1, 0), inn, V3(0, 0, 1)], [L / 2, 0.07, 0.025], PAL.black, ['v-'], dk);
  const zA = za + 0.05, zB = zb - 0.05;
  for (let u = ds * 0.5; u + ds < L - 0.02; u += ds) {
    const a = [u, 0], b = [u + hu * run * 0.92, hw * run * 0.92], c = [u + ds, 0];
    const tri = (q, z) => W(q[0], q[1], z), nTop = W(b[0], b[1], 0).sub(W(a[0], a[1], 0)).cross(V3(0, 0, 1)).normalize(), nFront = W(c[0], c[1], 0).sub(W(b[0], b[1], 0)).cross(V3(0, 0, 1)).normalize();
    const fix = (n, ref) => (n.dot(ref) < 0 ? n.negate() : n);
    poly([tri(a, zA), tri(b, zA), tri(b, zB), tri(a, zB)], fix(nTop, inn), PAL.belly);
    poly([tri(b, zA), tri(c, zA), tri(c, zB), tri(b, zB)], fix(nFront, inn), PAL.dark);
    poly([tri(a, zA), tri(c, zA), tri(b, zA)], V3(0, 0, -1), PAL.dark); poly([tri(a, zB), tri(b, zB), tri(c, zB)], V3(0, 0, 1), PAL.dark);
    const bn = [b[0] - hu * 0.06, b[1] - hw * 0.06];
    poly([W(bn[0], bn[1] + 0.002, zA), W(b[0], b[1] + 0.002, zA), W(b[0], b[1] + 0.002, zB), W(bn[0], bn[1] + 0.002, zB)], fix(nTop, inn), PAL.yellow);
  }
}
function mdCrewDoor(p, side) {
  const s = side === 'starboard' ? -1 : 1, acc = new Acc(), [z0, z1] = CREW.z, xo = s * CREWDOOR.face, y0 = DECK, y1 = CREW.y[1];
  const jamb = (pts, n, surf) => polyTo(acc, pts, n, surf);
  // the jambs: the doorway's sides, head and sill, from the skin (a hair out) in to the airlock's mouth
  const xs = s * (CREWDOOR.face + 0.12), xa = s * (CREWDOOR.face - 0.18);
  jamb([V3(xs, y0, z0), V3(xa, y0, z0), V3(xa, y1, z0), V3(xs, y1, z0)], V3(0, 0, 1), PAL.darkEdge);
  jamb([V3(xs, y0, z1), V3(xs, y1, z1), V3(xa, y1, z1), V3(xa, y0, z1)], V3(0, 0, -1), PAL.darkEdge);
  jamb([V3(xs, y1, z0), V3(xa, y1, z0), V3(xa, y1, z1), V3(xs, y1, z1)], V3(0, -1, 0), PAL.darkEdge);
  jamb([V3(xs, y0, z0), V3(xs, y0, z1), V3(xa, y0, z1), V3(xa, y0, z0)], V3(0, 1, 0), PAL.deck);
  acc.flush(p);
  // THE AIRSTAIR (door 'crew'): hinged at the sill on the skin's face, swinging out and down until its top rests on
  // the ground; it opens as someone comes within reach of its foot (or as the lab says)
  p.leaf('md:crew stair:' + side, (lp) => { const a = new Acc(); crewPanel(a, s, true); a.flush(lp); }, { door: 'crew', hinge: { at: dk(V3(xo, DECK, 0)).toArray(), axis: [0, 0, 1], angle: -s * CREWSTAIR.angle } });
  p.door('crew', [xo + s * 1.8, -DECK + 1.0, (z0 + z1) / 2], CREWDOOR.near, CREWDOOR.speed);
  return p;
}
// THE AIRLOCK behind each crew door (a piece of its own, so the measuring of the inside can leave it out): its floor,
// walls (the station's off-white), ceiling and light; the inner door in its inner wall (shut), a lit strip over it
function mdAirlock(p, side) {
  const s = side === 'starboard' ? -1 : 1, acc = new Acc(), [z0, z1] = CREW.z, xi = s * CREWDOOR.inner, y0 = DECK, y1 = CREW.y[1], top = DECK + CREWDOOR.top;
  const xa = s * (CREWDOOR.face - 0.18), jamb = (pts, n, surf) => polyTo(acc, pts, n, surf);
  // the airlock: its floor, walls, ceiling; the inner door in its inner wall (shut), a lit strip over it
  const za = z0 - 0.15, zb = z1 + 0.15;
  jamb([V3(xa, y0, za), V3(xi, y0, za), V3(xi, y0, zb), V3(xa, y0, zb)], V3(0, 1, 0), PAL.deck);
  jamb([V3(xa, top, za), V3(xi, top, za), V3(xi, top, zb), V3(xa, top, zb)], V3(0, -1, 0), PAL.inner);
  jamb([V3(xa, y1, z0), V3(xa, top, z0), V3(xa, top, z1), V3(xa, y1, z1)], V3(-s, 0, 0), PAL.inner);
  for (const [zz, zj, nz] of [[za, z0, 1], [zb, z1, -1]]) {
    jamb([V3(xa, y0, zz), V3(xi, y0, zz), V3(xi, top, zz), V3(xa, top, zz)], V3(0, 0, nz), PAL.inner);
    jamb([V3(xa, y0, zz), V3(xa, top, zz), V3(xa, top, zj), V3(xa, y0, zj)], V3(-s, 0, 0), PAL.inner);
  }
  jamb([V3(xi, y0, za), V3(xi, top, za), V3(xi, top, zb), V3(xi, y0, zb)], V3(s, 0, 0), PAL.inner);
  const zm = (z0 + z1) / 2;
  boxAt(acc, V3(xi + s * 0.02, y0 + 1.0, zm), AX, [0.02, 1.0, 0.45], PAL.dark, [s > 0 ? 'u-' : 'u+']);
  boxAt(acc, V3(xi + s * 0.045, y0 + 1.0, zm), AX, [0.004, 0.96, 0.012], PAL.black, [s > 0 ? 'u-' : 'u+']);
  polyTo(acc, [V3(xi + s * 0.03, top - 0.08, zm - 0.4), V3(xi + s * 0.03, top - 0.08, zm + 0.4), V3(xi + s * 0.03, top - 0.04, zm + 0.4), V3(xi + s * 0.03, top - 0.04, zm - 0.4)], V3(s, 0, 0), GLOW.strip, 'glow');
  polyTo(acc, [V3(xi + s * 0.3, top - 0.005, zm - 0.3), V3(xa - s * 0.2, top - 0.005, zm - 0.3), V3(xa - s * 0.2, top - 0.005, zm + 0.3), V3(xi + s * 0.3, top - 0.005, zm + 0.3)], V3(0, -1, 0), GLOW.white, 'glow');
  acc.flush(p);
  p.light([(xi + xa) / 2, CREWDOOR.top - 0.15, zm], 1.3, [1, 0.94, 0.85], [0, -1, 0], 3.5);
  return p;
}

// ── THE LANDING GEAR ────────────────────────────────────────────────────────────────────────────────────────────────
// The 8k's four legs (his picture's: a broad pad, a drum for the knee, two struts and a block up into the belly). The
// 3k's belly is 1.1 to 1.4 m up where they stand, too little under the deck for a leg to fold into, so each one
// telescopes: going up (door 'gear', 1 up) the pad and drum rise LEGS.rise, the pad's sole ending flush in the belly
// over its well, and the struts and block rise LEGS.slip less, their feet sliding up into the drum. Starboard's are
// port's mirrored.
export const GEAR = { speed: 0.42, at: { 'port front': ['front', 1], 'port rear': ['rear', 1], 'starboard front': ['front', -1], 'starboard rear': ['rear', -1] } };
const LEG_PAINT = { p: PAL.dark, d: PAL.dark, b: PAL.metal, s: PAL.metal, k: PAL.dark };
function legFaces(name, mirror) {
  const M = mesh(LEG[name]), out = [];
  for (let t = 0; t < M.tris.length / 3; t++) {
    let T = [0, 1, 2].map((k) => { const v = at(M, M.tris[t * 3 + k]); if (mirror) v.x = -v.x; return v; });
    if (mirror) T = [T[0], T[2], T[1]];
    const n = tnorm(T); if (n.lengthSq() < 1e-14) continue;
    out.push({ T, n: n.normalize(), kind: LEG[name].kind[t] });
  }
  return out;
}
function mdGear(p, which) {
  const [name, s] = GEAR.at[which], F = legFaces(name, s < 0);
  const paint = (f) => (f.kind === 'p' && f.n.y < -0.9 ? PAL.rubber : LEG_PAINT[f.kind]);
  const leaf = (key, kinds, rise) => p.leaf(`md:leg ${key}:${which}`, (lp) => { const a = new Acc(); for (const f of F) if (kinds.includes(f.kind)) a.tris([f.T.map(dk)], f.n, paint(f)); a.flush(lp); }, { door: 'gear', slide: [0, rise, 0] });
  leaf('foot', 'pdb', LEGS.rise);
  leaf('struts', 'sk', LEGS.rise - LEGS.slip);
  p.door('gear', [0, -DECK, 0], 0, GEAR.speed);
  return p;
}
// THE WELLS: over each pad's footprint (WELLS), dark walls from the belly's cut edge up to the well's top, and the top:
// the struts' block, gone up, ends just under it. The rear two stand over the cabin's deck by WELL_TOP.rear (a ledge
// 0.3 m high along the aft cabin's sides); the front two are under the flight deck.
function mdWells(p) {
  const acc = new Acc(), belly = (x, z) => { const h = rayHull(V3(x, -1, z), V3(0, 1, 0)); return h ? h.p.y : 1.1; };
  for (const [name, W] of Object.entries(WELLS)) for (const s of [1, -1]) {
    const X = (x) => s * x, [x0, x1] = W.x, [z0, z1] = W.z, top = WELL_TOP[name], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // (the belly at a point on the well's rim: sampled 3 cm outside the hole, where the skin is)
    const rim = (x, z) => belly(X(x + 0.03 * Math.sign(x - cx)), z + 0.03 * Math.sign(z - cz)) - 0.005;
    const walls = [[[x0, z0], [x1, z0], V3(0, 0, 1)], [[x1, z1], [x0, z1], V3(0, 0, -1)], [[x0, z1], [x0, z0], V3(s, 0, 0)], [[x1, z0], [x1, z1], V3(-s, 0, 0)]];
    for (const [a, b, n] of walls) {
      // (in short pieces, each from the belly where it is to the top: the belly slopes across the well)
      const k = 4;
      for (let i = 0; i < k; i++) {
        const u0 = i / k, u1 = (i + 1) / k, pa = [a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0], pb = [a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1];
        const ya = Math.min(top, rim(pa[0], pa[1])), yb = Math.min(top, rim(pb[0], pb[1]));
        polyTo(acc, [V3(X(pa[0]), ya, pa[1]), V3(X(pb[0]), yb, pb[1]), V3(X(pb[0]), top, pb[1]), V3(X(pa[0]), top, pa[1])], n, PAL.dark);
        // (and its outside, where it stands over the cabin's deck)
        if (top > DECK) polyTo(acc, [V3(X(pa[0]), DECK, pa[1]), V3(X(pa[0]), top, pa[1]), V3(X(pb[0]), top, pb[1]), V3(X(pb[0]), DECK, pb[1])], n.clone().negate(), PAL.deck);
      }
    }
    polyTo(acc, [V3(X(x0), top, z0), V3(X(x1), top, z0), V3(X(x1), top, z1), V3(X(x0), top, z1)], V3(0, -1, 0), PAL.dark);
    if (top > DECK) polyTo(acc, [V3(X(x0), top, z0), V3(X(x1), top, z0), V3(X(x1), top, z1), V3(X(x0), top, z1)], V3(0, 1, 0), PAL.deck);
  }
  return acc.flush(p);
}

// ── THE COCKPIT ──────────────────────────────────────────────────────────────────────────────────────────────────────
// The cockpit family's parts (built-common.js builtCockpitPlan): two bucket seats in the ship's colours side by side,
// the pedestal between them, pedals, the dash and a side console each side, on a flight deck FLOOR over the cabin's
// (over the front legs' wells), the seats' middles at SEATS_Z; no overheads, engineer, handholds or locker. The glass
// here is a windscreen and side windows under a solid roof, so in place of a tub the hull's inside round the cockpit
// is drawn dark (mdHull, NOSE_IN): the floor reaches out to it, and the bulkhead behind closes the cockpit off, with
// the cabin's door (shut) and steps down to it.
export const COCKPIT = { floor: 0.8, seatsZ: 5.5, wallX: 1.3, gap: 0.42, back: 4.05, dash: { w: 1.7, h: 0.72, knee: 0.55, bow: 0.12, depth: 1.0 }, canopy: { y: 3.31 - DECK - 0.8, z: 7.38 - 5.5, slope: 0.7 } };
export const COCKPIT_DROP = /^overhead|^handhold|^engineer|^locker/;
export function builtCockpitPlan() { return C.builtCockpitPlan(COCKPIT, COCKPIT_DROP); }
function mdCockpit(p) {
  const Cp = COCKPIT;
  C.cockpitParts(p, builtCockpitPlan(), Cp);
  const acc = new Acc(), fy = DECK + Cp.floor;
  // the flight deck: from the bulkhead to the nose, out to the hull's inside (less 5 cm), every 0.25 m
  const half = (z) => { const h = rayHull(V3(0, fy + 0.03, z), V3(1, 0, 0)), h2 = rayHull(V3(0, fy + 0.03, z), V3(-1, 0, 0)); return [h ? h.p.x - 0.05 : 0.5, h2 ? h2.p.x + 0.05 : -0.5]; };
  const zs = []; for (let z = Cp.back; z < 8.2; z += 0.25) zs.push(z);
  const rows = zs.map((z) => [z, ...half(z)]).filter(([, a, b]) => a - b > 0.2);
  for (let i = 0; i < rows.length - 1; i++) { const [za, pa, sa] = rows[i], [zb, pb, sb] = rows[i + 1]; polyTo(acc, [V3(sa, fy, za), V3(pa, fy, za), V3(pb, fy, zb), V3(sb, fy, zb)], V3(0, 1, 0), PAL.deck); }
  // the bulkhead behind: the hull's section there (its inside, less 3 cm, every 0.2 m up from the cabin's deck to the
  // roof), in strips; the door (shut) in it
  const zb = Cp.back, up = rayHull(V3(0, fy + 0.5, zb), V3(0, 1, 0)), yt = up ? up.p.y - 0.03 : fy + 2.2;
  const sect = []; for (let y = DECK; y < yt + 1e-6; y = Math.min(yt, y + 0.2)) { const a = rayHull(V3(0, y, zb), V3(1, 0, 0)), b = rayHull(V3(0, y, zb), V3(-1, 0, 0)); sect.push([y, a ? a.p.x - 0.03 : 0.3, b ? b.p.x + 0.03 : -0.3]); if (y >= yt) break; }
  for (let i = 0; i < sect.length - 1; i++) { const [ya, pa, sa] = sect[i], [yb, pb, sb] = sect[i + 1]; polyTo(acc, [V3(sa, ya, zb), V3(pa, ya, zb), V3(pb, yb, zb), V3(sb, yb, zb)], V3(0, 0, 1), PAL.dark); }
  boxAt(acc, V3(0, fy + 0.95, zb + 0.03), AX, [0.42, 0.95, 0.03], PAL.bayDark, ['w-']);
  boxAt(acc, V3(0, fy + 0.95, zb + 0.065), AX, [0.012, 0.91, 0.006], PAL.black, ['w-']);
  polyTo(acc, [V3(-0.38, fy + 1.96, zb + 0.062), V3(0.38, fy + 1.96, zb + 0.062), V3(0.38, fy + 2.0, zb + 0.062), V3(-0.38, fy + 2.0, zb + 0.062)], V3(0, 0, 1), GLOW.strip, 'glow');
  // (the flight deck's front edge down to the cabin's deck behind the bulkhead: the steps are in the cabin)
  acc.flush(p);
  for (const x of [-0.5, 0.5]) p.light([x, Cp.floor + 1.75, Cp.seatsZ - 0.3], 1.0, [1.25, 0.85, 0.55], [0, -1, 0.2], 3.0);
  p.light([0, Cp.floor + 1.0, Cp.seatsZ + 1.0], 0.7, [0.35, 0.65, 1.0], [0, 0.2, -1], 2.5);
  return p;
}

// ── THE GRIME (built-common.js grimeMaterials) ──────────────────────────────────────────────────────────────────────
export const STREAKS = [
  // [x, y, z, flow dx, dy, dz, length, width]: soot forward up each ring's drum from its rim; runs down from the bay
  // openings' heads and the crew doors; the roof's vents
  [1.77, 3.62, -8.7, 0, 0, 1, 1.6, 1.3], [-1.85, 3.62, -8.7, 0, 0, 1, 1.6, 1.3],
  [2.95, 4.2, -1.9, 0, -1, -0.15, 2.2, 0.3], [2.95, 4.2, 1.7, 0, -1, -0.15, 2.2, 0.3], [-2.95, 4.2, -1.9, 0, -1, -0.15, 2.2, 0.3], [-2.95, 4.2, 1.7, 0, -1, -0.15, 2.2, 0.3],
  [0, 5.6, 0.5, 0, -0.1, -1, 3.0, 0.5], [2.75, 3.75, 3.35, 0, -1, -0.2, 1.6, 0.3], [-2.75, 3.75, 3.35, 0, -1, -0.2, 1.6, 0.3],
];
export const GRIME = { dirt: { value: 0.45 } };
export const grimeMaterials = (mats, { dirt } = {}) => C.grimeMaterials(mats, { dirt, streaks: STREAKS, deck: DECK, grime: GRIME, key: 'mdgrime', glowKey: 'mdglow' });

// ── MOVING THE PARTS (the game, or the lab) ─────────────────────────────────────────────────────────────────────────
// (a built ship's doors of one piece, by side: port +x, starboard -x)
const doorsOf = (built, piece, side) => built.doors.filter((D) => D.piece === piece && (!side || Math.sign(D.sense.x) === (side === 'port' ? 1 : -1)));
// the gear: up (1) or down (0)
export const gearStep = (built, up, dt, updateDoors) => updateDoors(doorsOf(built, 'mdGear'), new THREE.Vector3(), dt, up ? 'open' : 'shut');
// the ramps: down or up; with one ramp (the starboard opening sealed) the starboard one stays up
export function rampStep(built, down, both, dt, updateDoors) {
  const eye = new THREE.Vector3(), a = updateDoors(doorsOf(built, 'mdRamp', 'port'), eye, dt, down ? 'open' : 'shut');
  return updateDoors(doorsOf(built, 'mdRamp', 'starboard'), eye, dt, down && both ? 'open' : 'shut') || a;
}
// the cabinets along the starboard opening: shown with one ramp
export function equipStep(built, show) { for (const D of doorsOf(built, 'mdBay')) for (const L of D.leaves) C.poseLeaf(L, 0, null, !show); }

// ── IN THE SHIP LAB (labs/ships/main.js) ────────────────────────────────────────────────────────────────────────────
export const LAB = {
  controls: ['ramps', 'rampCount', 'gear', 'door', 'dirt', 'throttle'],
  dirt: { None: 0, Some: 0.45, Lots: 0.9 },
  spots: { Canopy: { at: [6.0, 6.6, 12.5], look: [0, 3.9, 5.6] }, Bay: { at: [8.5, 2.6, 3.5], look: [0, 2.6, -0.2] }, Ramp: { at: [9.0, 1.6, -6.5], look: [3.5, 1.4, 0] }, Door: { at: [6.8, 1.8, 6.5], look: [2.6, 2.4, 3.3] }, Seats: { at: [0, 3.95, 4.55], look: [0, 3.4, 8.0] } },
  doorTip: 'Open the crew doors (each an airstair down to the ground), or shut them',
  gearTip: 'Raise the landing legs into their wells, or let them down',
  materials: (mats, dirt) => grimeMaterials(mats, { dirt }),
  setDirt: (v) => { GRIME.dirt.value = v; },
  jets: () => [{ role: 'main', nozzles: jetNozzles(), opts: JET }],
  step(B, st, dt, { updateDoors, person }) {
    gearStep(B, st.gear === 'up', dt, updateDoors);
    rampStep(B, st.ramps === 'down', st.rampCount !== 'one', dt, updateDoors);
    updateDoors(doorsOf(B, 'mdCrewDoor'), person.position, dt, st.door);
    equipStep(B, st.rampCount === 'one');
  },
  // (for pictures part way: { gear, ramp (port), rampS (starboard), crew } each 0 to 1, equip on/off)
  pose(B, at, { updateDoors }) {
    const of = { gear: ['mdGear'], ramp: ['mdRamp', 'port'], rampS: ['mdRamp', 'starboard'], crew: ['mdCrewDoor'] };
    for (const [k, t] of Object.entries(at)) {
      if (!of[k]) continue;
      for (const D of doorsOf(B, ...of[k])) { D.t = t > 0 ? 0 : 1; updateDoors([D], new THREE.Vector3(), t > 0 ? t / D.speed : 2 / D.speed, t > 0 ? 'open' : 'shut'); }
    }
    if (at.equip != null) equipStep(B, at.equip);
  },
};

// ── the catalog ─────────────────────────────────────────────────────────────────────────────────────────────────────
const GR = 'Ships';
export const SHIP_MEDIC_BUILT = {
  mdHull: { name: 'Medic (built): hull', group: GR, at: 'free', foot: [6.5, 7, 17.4], variants: ['hull'], build: mdHull },
  mdCanopy: { name: 'Medic (built): canopy', group: GR, at: 'free', foot: [4, 2, 3.5], variants: ['glass'], build: mdCanopy },
  mdMarks: { name: 'Medic (built): lights and marks', group: GR, at: 'free', foot: [6.5, 5, 17], variants: ['marks'], build: (p) => mdMarks(p) },
  mdBay: { name: 'Medic (built): med bay', group: GR, at: 'free', foot: [5.3, 2.5, 3.7], variants: ['med bay'], build: (p) => mdBay(p) },
  mdRamp: { name: 'Medic (built): ramp', group: GR, at: 'free', foot: [1, 2.5, 3.6], variants: ['port', 'starboard'], build: mdRamp },
  mdCrewDoor: { name: 'Medic (built): crew door', group: GR, at: 'free', foot: [0.5, 2.1, 1.0], variants: ['port', 'starboard'], build: mdCrewDoor },
  mdAirlock: { name: 'Medic (built): crew airlock', group: GR, at: 'free', foot: [1.4, 2.1, 1.3], variants: ['port', 'starboard'], build: mdAirlock },
  mdGear: { name: 'Medic (built): landing leg', group: GR, at: 'free', foot: [1.1, 1.5, 1.8], variants: Object.keys(GEAR.at), build: mdGear },
  mdWells: { name: 'Medic (built): leg wells', group: GR, at: 'free', foot: [5, 1.2, 10.5], variants: ['wells'], build: mdWells },
  mdCockpit: { name: 'Medic (built): cockpit', group: GR, at: 'free', foot: [3.5, 2, 3.5], variants: ['two seats'], build: (p) => mdCockpit(p) },
};
