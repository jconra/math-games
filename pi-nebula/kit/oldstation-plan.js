// THE OTHER STATION'S OUTSIDE, AS A PLAN: the old station in distress that the story sends you to (the plan:
// ~/pw/space-math/STATION2_PLAN.md). Plain numbers (no three.js, so the tests read it); kit/oldstation.js turns it into a
// few meshes. Nothing in the game uses it yet: it is looked at in the Other Station Lab (labs/oldstation/).
//
// The game's maker, in his own words (this is the brief; nothing here goes beyond it):
//   2026-11-16  (the story) "A station in distress ... an older station, cut off and running low on supplies."; the
//               call it sends, as approved (DT-12): "... power failing ... any ship ... please ..."
//   2026-11-22  "I was thinking the other station could have fewer hangers. It might be cool if it was built in the
//               shape of a ring, or had a ring of solar panels around it. Something to make it appear different than
//               ours. It could use a red or green tint to it instead of our slightly blue."
//   2026-11-22  of the three shapes drawn for him, B (a shorter body like ours, its two hangars side by side, a ring of
//               solar panels round it on girders): "I was thinking like this, but this design has an obvious problem,
//               the frames are going right through the hangers. Can we rotate the ring 90 degrees on the x axis so
//               that the ring goes above and below the station. The tower may have to be shorter to not interfere
//               with the rings."  Red (STA2-2 A). The Explorer flies round it and looks (STA2-3 A). "Their own old
//               bridge still stands: the Hauler docks to it and you walk across" (STA2-4 A).
//
// THE SHAPE  (metres, as our station's: x east, out of the hangar doors; y up from the hangars' floor; z south)
//   the body    shape B's: our body's own cross-section (kit/outside-plan.js bodyTiers: a lower terrace and an upper
//               one, each with a band of windows, the hangars' band between, a flat roof and underside) round a
//               shorter outline, 40 m by 72 m with its corners cut; its two hangar doors side by side in the east face
//   the ring    shape B's ring of solar panels, turned upright as he asked: "the x axis" read as the picture's own,
//               across it, which is along the body's length, so the ring now stands in the plane across the body's
//               middle from end to end (x = 0): over the roof and the tower, under the underside and the keel, past
//               both ends. Its axis points the way the hangar doors face, so a ship leaving a hangar flies along it
//               and never crosses it, and no girder comes near a door
//   the arms    six girders from the body out to the ring, all in that same plane: one straight out of each end wall,
//               and four on the diagonals, two standing on the roof and two hung under the underside, each on a
//               footing; none through a hangar or in front of its door. Nothing goes straight up or down: the tower
//               and the keel stand free in the gaps
//   the tower   shape B's tower made shorter ("The tower may have to be shorter"): its top 7.4 m lower, its mast
//               shorter, so its beacon stands well clear under the ring
//   in distress (the plan's reading of "older, cut off, running low on supplies ... power failing", in the pictures he
//               chose from): the Hull Lab's "old and worn" look with its greys leaning red, as ours lean blue; few of
//               the windows lit; three solar panels gone and one hanging loose; a red beacon calling for help
//   the bridge  their own old docking bridge, the kit's own (kit/dockbridge.js), standing out from the west face (the
//               side away from the hangars, as our dock is) at the floor's level, its lights out, nothing docked:
//               where a Hauler would dock (its port side to the bridge's end, as at home: src/haulerdock.js)
import { offsetPath } from './hull-plates.js';
import { HULL_LOOKS, readLook } from './hull-look.js';
import { flatsOf, LEVELS, BODY_EDGE, DOOR, GIRDER, WIN, boxPath, bodyTiers, plates, ROW, BIG, plain, bigIf, Tris, lin, gearColour, girder, standInHangar } from './outside-plan.js';

const D2R = Math.PI / 180;

// ── ITS LOOK: the Hull Lab's "old and worn" (made for "the older, run-down station of later in the story"), its two
// greys turned to red by the same small lean ours have toward blue (ours: #555b77, #52576f) ───────────────────────────
export const OLD_TINT = { grey: '#775b55', grey2: '#6f5752' };
export const OLD_LOOK = readLook({ ...HULL_LOOKS['old and worn'], ...OLD_TINT });
// how many of its windows are lit (power failing: few; the tower's control room a few more)
export const LIT = { hull: 0.15, tower: 0.3 };

// ── THE BODY ────────────────────────────────────────────────────────────────────────────────────────────────────
const ROOF = LEVELS.roof, BELLY = LEVELS.belly;
export const BODY = { x0: -20, x1: 20, z0: -36, z1: 36, cut: 8 };
export const BODY_PATH = boxPath(BODY.x0, BODY.x1, BODY.z0, BODY.z1, BODY.cut);
// the two hangars, side by side (their doors in the east face, run 0, walked north from z = z1 - cut)
export const HANGARS = [{ id: 'north hangar', z: -14 }, { id: 'south hangar', z: 14 }];
const RUN0 = BODY.z1 - BODY.cut;
// their doors: our hangar doors' own size, the frame standing as far out of the wall as ours
export const DOORS = HANGARS.map((h) => ({ name: 'door of the ' + h.id, at: [BODY.x1, 0, h.z], w: DOOR.w, h: DOOR.h, jamb: DOOR.jamb, head: DOOR.head, proud: 0.68, out: [1, 0, 0] }));
// THE PORT their bridge stands out from: in the west face (run 4, walked south from z = z0 + cut) at its middle, its
// opening the size of our airlock's outer door (kit/outside-plan.js OPENINGS), its frame standing `proud`; the bridge's
// own frame starts at the frame's face and runs out west (kit/dockbridge.js: +z out of the port, y up from the floor)
export const PORT = { z: 0, w: 3.6, h: 2.9, y: 0, jamb: 0.35, head: 0.35, proud: 0.7, deep: 0.9 };
export const BRIDGE = { at: [BODY.x0 - PORT.proud, 0, PORT.z], out: [-1, 0, 0], across: [0, 0, 1] };

// (lit: how many of the windows are lit, { hull, tower }: LIT while its power is failing; LIT_SAVED once the supply run's
// fuel cells have come: src/oldstationsite.js)
export const LIT_SAVED = { hull: 0.72, tower: 0.85 };
function bodyPlan(seed, lit = LIT) {
  const doors = [
    ...HANGARS.map((h) => ({ tier: 1, step: 2, run: 0, at: RUN0 - h.z, w: DOOR.w, h: DOOR.h, y: 0, sill: 0, head: DOOR.head, jamb: DOOR.jamb, proud: 0.68 })),
    { tier: 1, step: 2, run: 4, at: PORT.z - (BODY.z0 + BODY.cut), w: PORT.w, h: PORT.h, y: PORT.y, sill: 0, head: PORT.head, jamb: PORT.jamb, proud: PORT.proud, shield: false },
  ];
  // (the roof's plates leave a hole where the tower stands, the underside's where the keel hangs)
  const flats = [...flatsOf(offsetPath(BODY_PATH, -BODY_EDGE.roofIn, true), [boxPath(-8.2, 8.2, -8.2, 8.2, 3.6)], ROOF, true, bigIf(7)),
    ...flatsOf(offsetPath(BODY_PATH, -BODY_EDGE.bellyIn, true), [boxPath(-6.6, 6.6, -6.6, 6.6, 3)], BELLY, false, bigIf(7))];
  return { name: 'body', closed: true, path: BODY_PATH, tiers: bodyTiers(), doors, flats, windows: { ...WIN, lit: lit.hull, seed } };
}

// ── THE TOWER AND THE KEEL (shape B's, over and under the body's middle; the tower 7.4 m shorter than B's) ─────────
const towerPath = boxPath(-5, 5, -5, 5, 2.2);
export const TOWER = { top: 36.6, mast: 9, beacon: 1.5 };
export const KEEL = { foot: -26, mast: 8, beacon: 0.7 };
function towerPlan(seed, lit = LIT) {
  const R = ROOF, T = TOWER.top;
  // (its foot, a plain stretch, the control room's band standing out with its windows, a neck, the cap)
  const profile = [[3.2, R, 'in'], [3.2, R + 2], [1.4, R + 3.4], [0, R + 3.4, 'in'], [0, T - 11.6], [3.0, T - 8.6], [3.0, T - 5.2], [2.0, T - 4.2], [-1.6, T - 4.2, 'in'], [-1.6, T - 1], [-2.6, T]];
  const parts = [plates('band'), plates('tiers'), plates('tiers'), plates('band', BIG), plates('tiers'), ROW, plates('tiers'), plates('tiers'), plates('band'), plates('tiers')];
  return { name: 'tower', closed: true, path: towerPath, tiers: [{ name: 'tower', profile, parts }],
    windows: { ...WIN, w: 2.2, h: 1.8, pitch: 2.9, lip: 0.4, sink: 0.15, cut: 0.4, lit: lit.tower, bar: 0.1, seed }, flats: flatsOf(offsetPath(towerPath, -2.6, true), [], T, true, plain) };
}
function keelPlan(seed, lit = LIT) {
  const F = KEEL.foot, profile = [[-1.4, F], [0, F + 1.4], [0, -16], [1.6, -14.4], [1.6, BELLY, 'in']];
  return { name: 'keel', closed: true, path: towerPath, tiers: [{ name: 'keel', profile, parts: [plates('tiers'), plates('band', BIG), plates('tiers'), plates('band')] }], windows: { ...WIN, lit: lit.hull, seed },
    flats: flatsOf(offsetPath(towerPath, -1.4, true), [], F, false, plain) };
}

// THE WHOLE HULL as plans for kit/hull.js buildHull.  seed: which of the windows are lit
export function oldStationPlans(opts = {}) {
  const seed = opts.seed ?? 7, lit = opts.lit || LIT;
  return [bodyPlan(seed, lit), towerPlan(seed, lit), keelPlan(seed, lit)];
}

// ── THE RING, UPRIGHT ───────────────────────────────────────────────────────────────────────────────────────────
// in the plane x = RING.x, round the body's middle (y = RING.y, z = 0): shape B's own size, 24 panels between ribs, an
// inner and an outer rim. An angle round it is measured from south (+z) toward up (+y).
export const RING = { x: 0, y: 5, r0: 60, r1: 80, panels: 24, gap: 0.9, gone: [7, 8, 19], loose: 14, swing: 50 };
export const ARMS = [0, 45, 135, 180, 225, 315];
// a point of the ring's plane at angle a (degrees) and radius r; the way out from its middle there; the way round
export const ringAt = (a, r) => [RING.x, RING.y + Math.sin(a * D2R) * r, Math.cos(a * D2R) * r];
const outAt = (a) => [0, Math.sin(a * D2R), Math.cos(a * D2R)], roundAt = (a) => [0, Math.cos(a * D2R), -Math.sin(a * D2R)];
// WHERE AN ARM MEETS THE HULL: going out from the ring's middle along angle a, the first of the body's faces in the
// ring's plane: the roof (to its edge), the underside (to its edge), or an end wall (within the hangars' band).
// -> { r: how far out, face: 'roof' | 'underside' | 'end', n: the face's way out }
export function footOf(a) {
  const [, dy, dz] = outAt(a), out = [];
  const roofZ = BODY.z1 - BODY_EDGE.roofIn, bellyZ = BODY.z1 - BODY_EDGE.bellyIn;
  if (dy > 1e-9) { const r = (ROOF - RING.y) / dy; if (Math.abs(dz * r) <= roofZ) out.push({ r, face: 'roof', n: [0, 1, 0] }); }
  if (dy < -1e-9) { const r = (BELLY - RING.y) / dy; if (Math.abs(dz * r) <= bellyZ) out.push({ r, face: 'underside', n: [0, -1, 0] }); }
  if (Math.abs(dz) > 1e-9) { const r = BODY.z1 / Math.abs(dz), y = RING.y + dy * r; if (y >= LEVELS.band.foot && y <= LEVELS.band.top) out.push({ r, face: 'end', n: [0, 0, Math.sign(dz)] }); }
  return out.sort((p, q) => p.r - q.r)[0] || null;
}
// the arms: each from 2 m inside the hull out to the ring's inner rim
export const ARM = { half: GIRDER.half, sunk: 2, footing: { half: 3.6, tall: 1.2 } };
export function armsOf() {
  return ARMS.map((a) => { const f = footOf(a), d = outAt(a); return { a, face: f.face, n: f.n, foot: ringAt(a, f.r), from: ringAt(a, f.r - ARM.sunk), to: ringAt(a, RING.r0), dir: d }; });
}

// ── THE GEAR: the ring and its arms, the masts and their beacons, the lights, and the plain rooms behind the openings
// (the hangars' and the port's: nothing is built inside yet). One list lit by the scene, one that glows by itself
// (kit/outside.js's way: each corner its colour).
// a flat four-sided slab: its outline [inner left, inner right, outer right, outer left] in its own plane, `t` thick
// each way along n (the box's own corner order, so its faces are the same as Tris.box's)
function slab(G, P, n, t, col) {
  const b = G.count;
  for (let i = 0; i < 8; i++) { const o = i & 1, s = i & 2 ? t : -t, r = i & 4; const p = P[o ? (r ? 2 : 3) : (r ? 1 : 0)]; G.vert([p[0] + n[0] * s, p[1] + n[1] * s, p[2] + n[2] * s], col); }
  for (const q of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) G.index.push(b + q[0], b + q[1], b + q[2], b + q[0], b + q[2], b + q[3]);
}
// (inside: its real dock airlock is built behind the port (the supply run: kit/rooms/oldstation.json), so the plain dark
// way in drawn there for a ship flying past is left out)
export function oldStationGear({ inside = false } = {}) {
  const G = new Tris(), L = new Tris();
  const [steel, dark, cell, frame, red] = ['steel', 'dark', 'cell', 'frame', 'red'].map(gearColour), dead = lin('#20242c');
  const R = RING, N = R.panels, span = 360 / N, X = [1, 0, 0];
  // THE PANELS, drawn the way our wings are (a thin frame, dark cells on it with the frame showing between, the cells
  // standing proud of both its faces), each a piece of the ring between two ribs
  for (let k = 0; k < N; k++) {
    // the rib before it, always there
    const b = k * span; G.rod(ringAt(b, R.r0), ringAt(b, R.r1), 0.5, steel);
    if (R.gone.includes(k)) continue;
    const a0 = k * span, a1 = (k + 1) * span, ac = (a0 + a1) / 2;
    // its corners in the ring's plane, `gap` in from the ribs each side
    // (a loose one hangs from its inner edge, swung out of the ring toward the hangars' side: its way out turned from
    // the ring's toward +x, its face turned with it)
    const o = outAt(ac), t = roundAt(ac), sw = k === R.loose ? R.swing * D2R : 0, way = [Math.sin(sw), o[1] * Math.cos(sw), o[2] * Math.cos(sw)];
    const n = [Math.cos(sw), -o[1] * Math.sin(sw), -o[2] * Math.sin(sw)], c0 = ringAt(ac, R.r0);
    const at = (r, s) => { const w = (Math.tan((span / 2) * D2R) * r - R.gap) * s, d = r - R.r0; return [0, 1, 2].map((i) => c0[i] + way[i] * d + t[i] * w); };
    slab(G, [at(R.r0, -1), at(R.r0, 1), at(R.r1, 1), at(R.r1, -1)], n, 0.14, frame);
    // four rows of cells out along it, two across
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const ra = R.r0 + (R.r1 - R.r0) * i / 4 + 0.2, rb = R.r0 + (R.r1 - R.r0) * (i + 1) / 4 - 0.2, sa = j ? 0.04 : -1 + 0.04, sb = j ? 1 - 0.04 : -0.04;
      const mix = (p, q, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u];
      const C = (r, s) => mix(at(r, -1), at(r, 1), (s + 1) / 2);
      slab(G, [C(ra, sa), C(ra, sb), C(rb, sb), C(rb, sa)], n, 0.22, (k === R.loose && i === 3) ? dead : cell);
    }
  }
  // the inner and outer rims
  for (const r of [R.r0, R.r1]) for (let k = 0; k < 48; k++) G.rod(ringAt(k * 7.5, r), ringAt((k + 1) * 7.5, r), 0.7, steel);
  // THE ARMS: our girders (kit/outside-plan.js girder), each on a footing where it meets the hull, a red light on the
  // ring's outer rim where it meets the ring
  for (const A of armsOf()) {
    girder(G, A.from, A.to, { half: ARM.half, side: X, up: roundAt(A.a) }, steel);
    const F = ARM.footing, n = A.n, c = [A.foot[0] + n[0] * F.tall / 2, A.foot[1] + n[1] * F.tall / 2, A.foot[2] + n[2] * F.tall / 2];
    if (A.face === 'end') G.box(c, [F.half, F.half, F.tall / 2], dark); else G.box(c, [F.half, F.tall / 2, F.half], dark);
    L.ball(ringAt(A.a, R.r1 + 1.2), 0.8, red, 8);
  }
  // the tower's mast and its red beacon (calling for help); the keel's mast and its light
  G.rod([0, TOWER.top, 0], [0, TOWER.top + TOWER.mast, 0], 0.8, steel); L.ball([0, TOWER.top + TOWER.mast + 1, 0], TOWER.beacon, red, 12);
  G.rod([0, KEEL.foot, 0], [0, KEEL.foot - KEEL.mast, 0], 0.7, steel); L.ball([0, KEEL.foot - KEEL.mast - 0.8, 0], KEEL.beacon, red, 8);
  // the plain rooms behind the hangar doors (our own stand-in, kit/outside-plan.js standInHangar)
  for (const h of HANGARS) standInHangar(G, BODY.x0 + 1, BODY.x1 - 0.12, h.z - 13.5, h.z + 13.5);
  // behind the port: a short dark way in, its round inner door shut
  if (!inside) {
    const x0 = BODY.x0 - 0.05, x1 = x0 + PORT.deep, z0 = PORT.z - PORT.w / 2, z1 = PORT.z + PORT.w / 2, y0 = PORT.y, y1 = PORT.y + PORT.h, wallC = lin('#24282e');
    G.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], wallC); G.quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], wallC);
    G.quad([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], wallC); G.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], wallC);
    G.quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], dark);
    const c = [x1 - 0.1, y0 + 1.42, PORT.z], seg = 20;
    for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2, b2 = (i + 1) / seg * Math.PI * 2; G.quad([[c[0], c[1] + Math.sin(a) * 1.15, c[2] + Math.cos(a) * 1.15], [c[0], c[1] + Math.sin(a) * 1.3, c[2] + Math.cos(a) * 1.3], [c[0], c[1] + Math.sin(b2) * 1.3, c[2] + Math.cos(b2) * 1.3], [c[0], c[1] + Math.sin(b2) * 1.15, c[2] + Math.cos(b2) * 1.15]], steel); }
  }
  return { lit: G.arrays(), glow: L.arrays() };
}

// the whole of it (the ring and the arms' lights included), and the places to look at it from: a ship coming in, as
// the Explorer will (STA2-3: it flies round it and looks), and nearer
export const OLD_BOX = { min: [-36, -78, -83], max: [24, 88, 83] };
export const OLD_VIEWS = {
  approach: { name: 'Coming in', at: [215, 62, -125], to: [0, 4, 0] },
  hangars: { name: 'The hangars', at: [128, 22, 44], to: [0, 6, 0] },
  bridge: { name: 'The old bridge', at: [-48, 9, 22], to: [-24, 1.5, 0] },
  side: { name: 'From the end', at: [14, 30, -235], to: [0, 6, 0] },
  above: { name: 'From above', at: [150, 190, 60], to: [0, 4, 0] },
  below: { name: 'From below', at: [160, -150, -40], to: [0, 0, 0] },
};
// the Explorer's way round it (STA2-3): a circle this far out and this high, once round in `lap` seconds
export const ROUND = { r: 250, y: 55, lap: 90, to: [0, 6, 0] };
