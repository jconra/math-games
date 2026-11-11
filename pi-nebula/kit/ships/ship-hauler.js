// HAULER A "MULE" (layout kit/rooms/ship-hauler.json): the few parts only this ship uses. Each is the kit's own parts
// (kit/shipparts/*) called with this ship's sizes, or put together with place.js; one is new (the pallet mover). The
// ship itself is a layout file on the ship grid (0.5 m cells, 0.5 m steps from a deck 1.26 m off the ground; nose +z,
// the ship's left +x), written by ~/pw/space-math/rigs/ships/ship-hauler/makeship.mjs.
//   haulerPod(p, { side })   a twin lateral main engine (his are big): the kit's engine pod, 2.6 m across and 3.5 m long,
//                            its drum grey with a pale band, behind a 1 m yellow cowl round a grey nose cone, a charcoal
//                            band round it; the pod's own pale strut and a deep charcoal pylon (1.1 m tall) reach in to
//                            the hull's side. side +1: the pod on the +x (port) side, its pylons toward -x; -1 the other.
//                            Frame: the pod's axis along z, the cowl's nose at z = 0, the nozzle at z = -4.5.
//   haulerRing(p)            his frame rings: a charcoal band 0.5 m long standing 0.2 m proud all round the 'mule'
//                            section, a grey seam round its middle. Frame: centred on z = 0, the deck at y = 0.
//   haulerTruss(p, { len })  X-bracing on the dark lower band of his cargo modules: grey bars on a side panel's face.
//   noseBars(p)              the nose's window bars (three panes in the windscreen, two in each side window) and a tint
//                            (two more panes of glass) inside them. Frame: the nose cap's.
//   mouthHazard(p)           yellow and black stripes round the back ramp's mouth. Frame: the tail's face.
//   haulerRamp(p)            the back cargo ramp: the kit's ramp, its outside a ribbed grey cargo door with striped
//                            edges, sized to fill the tail's 'mouth 9x5' (4.5 x 2.5 m) edge to edge, so no daylight
//                            shows round it when shut (the kit's back ramp is 4.4 x 2.45)
//   palletMover(p)           sheet 2's pallet mover: a small cargo robot that pushes a pallet along the roller lanes
//                            and up the ramp (new: the kit hasn't one). A low charcoal chassis 0.8 m wide and 0.6 m
//                            long on four small wheels, a yellow push bar across its front at the pallets' skids, a
//                            hazard-striped deck, a short mast at the back with a blue status lamp. Frame: its push
//                            face at z = 0, its body back along -z, on the deck (y = 0), centred on x = 0.
//   haulerCockpit(p)         the flight deck's seats and consoles: the cockpit family's sample cockpit (cockpitPlan)
//                            for two, without the engineer's seat and station (the hauler's engineer works in
//                            engineering), the overhead (there is no flat ceiling under the canopy), the locker and the
//                            handholds (placed with the room), and with this ship's windscreen (COCKPIT). Frame: the
//                            cockpit's (the seats' middles on z = 0, the nose toward +z).
//   haulerFit(p, v)          the cabin's fittings at this ship's sizes (FIT below): the bay's portal frames, roller
//                            lanes, tie-down rails and pallets (the station's, drawn lighter), the galley, the dinette,
//                            the bunk bed, the engineer's station, the cockpit's floor where the nose narrows, the
//                            cockpit's masts, amber lamps, the flight deck's wall lamps, the nose's blue lights, the
//                            bracing, the window bars, the mouth's stripes, the crew door's striped sill; and a wall
//                            run without its cornice ('wall 2.19 m, no cornice').
// The catalog entries (group 'Ships': the Kit Lab's coordinator adds the group) are SHIP_HAULER below.
import * as THREE from 'three';
import { enginePod } from '../shipparts/outside/engines.js';
import { ramp } from '../shipparts/outside/ways.js';
import { antenna, floodlight } from '../shipparts/outside/details.js';
import { Acc } from '../shipparts/outside/facet.js';
import { box, bar, latheZ } from '../shipparts/outside/shapes.js';
import { SECTIONS, CAP_STYLES, capRings } from '../shipparts/outside/sections.js';
import { ring } from '../shipparts/outside/hull.js';
import { SHIP } from '../shipparts/palette.js';
import { part, placeInto } from '../shipparts/place.js';
import { cockpitPlan, BUILDS } from '../shipparts/cockpit/set.js';
import { engineerStation } from '../shipparts/cockpit/consoles.js';
import { galleyCounter, dinette } from '../shipparts/cabin/galley.js';
import { bunkBed } from '../shipparts/cabin/quarters.js';
import { rollerLane, tieDown } from '../shipparts/cabin/cargo.js';
import { frame, floorRun, wallRun, lean } from '../shipparts/cabin.js';
import { crate } from '../hangar.js';
import { extrude, put } from '../geo.js';

const PI = Math.PI;
// the ship's own sizes (the generator reads the same numbers)
export const HAUL = {
  pod: { r: 1.3, cone: 1.0, len: 3.5, gap: 0.95 },   // the engine pods: radius (his are big: half the body's width across), the yellow cowl
                                                       // in front, the pod behind it, the gap from the hull's side
  inner: 2.69,                            // the hull's inside face, either side (its 5.5 m section, plates 6 cm thick)
  lane: { len: 5.25, wid: 2.0 },          // the bay's two roller lanes
};
// the windscreen as the cockpit sees it: the 'mule' nose's facet rises 1.5 m over 1 m from its foot (56 degrees), 1.0 m
// up and 1.75 m ahead of the seats; its frame and surround (0.2 m up the slope) are solid, so the glass starts 1.17 m
// up, 1.64 m ahead.
// The dash a little lower than the sample's (its face's top 1.04 m, not 1.12), so nothing stands in the glass.
const SLOPE = Math.atan2(1.5, 1);
export const COCKPIT = { seats: 2, canopy: { y: 1.0 + 0.2 * Math.sin(SLOPE), z: 1.75 - 0.2 * Math.cos(SLOPE), slope: SLOPE }, dash: { h: 1.04 } };

export function haulerPod(p, o = {}) {
  const s = o.side ?? 1, { r, cone, len, gap } = HAUL.pod, acc = new Acc();
  // the kit's engine pod, its drum off-white as his, behind a yellow cowl that narrows to the front
  const pod = new (p.constructor)(); enginePod(pod, { r, len, band: 'grey', body: 'white2', pylon: { side: -s, len: gap + 0.02 } });
  placeInto(p, pod, { at: [0, 0, -cone] });
  // (the cowl: a grey nose cone in a charcoal ring, the yellow cowl widening back to the drum)
  latheZ(acc, [[0, 0.3], [0.3 * r, 0.2], [0.48 * r, 0.03], [0.5 * r, 0], [0.7 * r, 0], [0.72 * r, -0.04], [r, -cone + 0.02], [1.01 * r, -cone + 0.06], [1.01 * r, -cone - 0.18]], 8,
    (i) => [SHIP.grey, SHIP.grey, SHIP.gun, SHIP.trim, SHIP.trim, SHIP.yellow, SHIP.trim, SHIP.trim][i]);
  // a charcoal band round the drum (his pods' panel join)
  latheZ(acc, [[r * 0.99, -cone - 1.6 + 0.16], [r * 1.025, -cone - 1.6 + 0.14], [r * 1.025, -cone - 1.6 - 0.14], [r * 0.99, -cone - 1.6 - 0.16]], 8, () => SHIP.trim);
  // (his pylons are chunky: a deep charcoal strut, 1.1 m tall, along most of the pod's inner side, from the pod to the
  // hull's side, its foot in the hull's grey; it stops short of the pod's tail, where the hull ends)
  const x0 = -s * r * 0.8, x1 = -s * (r + gap + 0.02), X = [Math.min(x0, x1), Math.max(x0, x1)], zs = [-cone - len + 0.85, -cone - 0.35];
  box(acc, SHIP.trim, X, [-0.6, 0.5], zs);
  box(acc, SHIP.grey, X, [-0.66, -0.6], [zs[0] - 0.04, zs[1] + 0.04]);
  acc.flush(p);
  return p;
}

// ── the hull's frame rings (his cargo modules held in charcoal frames): a band 0.5 m long standing 0.2 m proud all round
// the 'mule' section; frame: centred on z = 0, the deck at y = 0
const octagon = (S) => ring(S).map(([x, l]) => [x * 0.5, l * 0.5]);
function grow(P, d) {
  // (a convex polygon's edges moved out by d, met at the corners)
  let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; }
  const sg = Math.sign(a), L = P.map((p, i) => { const q = P[(i + 1) % P.length], ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey), nx = sg * ey / l, ny = -sg * ex / l; return { p: [p[0] + nx * d, p[1] + ny * d], e: [ex / l, ey / l] }; });
  return L.map((A, i) => { const B = L[(i + L.length - 1) % L.length], den = B.e[0] * A.e[1] - B.e[1] * A.e[0], t = ((A.p[0] - B.p[0]) * A.e[1] - (A.p[1] - B.p[1]) * A.e[0]) / den; return [B.p[0] + B.e[0] * t, B.p[1] + B.e[1] * t]; });
}
export const RING = { len: 0.5, proud: 0.2 };
export function haulerRing(p) {
  const I = octagon(SECTIONS.mule), O = grow(I, RING.proud), h = RING.len / 2, acc = new Acc(), V = (q, z) => new THREE.Vector3(q[0], q[1], z);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8, mid = [(O[i][0] + O[j][0]) / 2, (O[i][1] + O[j][1]) / 2], c = [(I[i][0] + I[j][0]) / 2, (I[i][1] + I[j][1]) / 2], n = new THREE.Vector3(mid[0] - c[0], mid[1] - c[1], 0).normalize();
    acc.poly([V(O[i], h), V(O[j], h), V(O[j], -h), V(O[i], -h)], n, SHIP.trim);   // (its outside)
    for (const z of [h, -h]) acc.poly([V(I[i], z), V(I[j], z), V(O[j], z), V(O[i], z)], new THREE.Vector3(0, 0, Math.sign(z)), SHIP.frame);   // (its two faces)
    // a grey seam round its middle
    const O2 = grow(I, RING.proud + 0.012);
    acc.poly([V(O2[i], 0.04), V(O2[j], 0.04), V(O2[j], -0.04), V(O2[i], -0.04)], n, SHIP.grey);
  }
  return acc.flush(p);
}

// ── X-bracing on the dark lower band between the rings (his cargo modules' lower frames): a run `len` long, 1 m tall,
// on a side panel's face (frame: facing +z, x along it, y up from its foot), standing 4 cm proud
export function haulerTruss(p, { len = 2.5 } = {}) {
  const acc = new Acc(), H = 1.0, n = Math.max(1, Math.round(len / 1.25)), w = len / n, G = SHIP.grey, z = 0.03;
  bar(acc, G, [-len / 2, 0.08, z], [len / 2, 0.08, z], 0.08, 0.04); bar(acc, G, [-len / 2, H - 0.08, z], [len / 2, H - 0.08, z], 0.08, 0.04);
  for (let k = 0; k < n; k++) {
    const x0 = -len / 2 + k * w + 0.06, x1 = x0 + w - 0.12;
    bar(acc, G, [x0, 0.12, z], [x1, H - 0.12, z], 0.06, 0.03); bar(acc, G, [x0, H - 0.12, z], [x1, 0.12, z], 0.06, 0.03);
    if (k) bar(acc, G, [x0 - 0.06, 0.08, z], [x0 - 0.06, H - 0.08, z], 0.07, 0.04);
  }
  return acc.flush(p);
}

// ── the nose's window bars: two charcoal bars down the windscreen (three panes, as his) and one across each side
// window (the second step's); frame: the nose cap's (its start at z = 0, the deck at y = 0)
export function noseBars(p) {
  const R = capRings(SECTIONS.mule, CAP_STYLES.mule).map((r) => ({ z: r.z * 0.5, P: octagon(r.S) })), acc = new Acc(), C = SHIP.frame, lift = 0.025;
  // (the octagon's corners: 3 and 4 the +x up chamfer, 4 and 5 the roof, 5 and 6 the -x up chamfer)
  const at = (r, k) => new THREE.Vector3(R[r].P[k][0], R[r].P[k][1], R[r].z), lerp = (a, b, f) => a.clone().lerp(b, f);
  const onFacet = (a, b, c, d, f0, f1, w) => {
    // a bar from f0 along a-b to f0 along d-c (a quad a b c d), lifted off its face
    const A = lerp(a, b, f0), B = lerp(d, c, f1), n = b.clone().sub(a).cross(d.clone().sub(a)).normalize();
    if (n.y < 0) n.negate();   // (a roof facet faces up)
    bar(acc, C, A.addScaledVector(n, lift).toArray(), B.addScaledVector(n, lift).toArray(), w, 0.04);
  };
  // the windscreen: the roof facet of the third step
  for (const f of [1 / 3, 2 / 3]) onFacet(lerp(at(2, 4), at(3, 4), 0.06), lerp(at(2, 5), at(3, 5), 0.06), lerp(at(2, 5), at(3, 5), 0.94), lerp(at(2, 4), at(3, 4), 0.94), f, f, 0.14);   // (within its frame)
  // the side windows: the up chamfers of the second step, a bar across each at its middle
  for (const [k0, k1] of [[3, 4], [5, 6]]) { const a = lerp(at(1, k0), at(2, k0), 0.5), b = lerp(at(1, k1), at(2, k1), 0.5), n = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 - 2.0, 0).normalize(); bar(acc, C, a.addScaledVector(n, lift).toArray(), b.addScaledVector(n, lift).toArray(), 0.12, 0.04); }
  // (his windows are tinted: two more panes of glass just inside the windscreen and the side windows, over their glass)
  const tint = (q, n) => { for (const d of [0.032, 0.04, 0.048]) { const g = q.map((v) => v.clone().addScaledVector(n, -d)); acc.poly(g, n, null, 'glass', 9); acc.poly(g.slice().reverse(), n.clone().negate(), null, 'glass', 9); } };
  const inset = (a, b, c, d, e) => [lerp(lerp(a, b, e), lerp(d, c, e), e), lerp(lerp(a, b, 1 - e), lerp(d, c, 1 - e), e), lerp(lerp(a, b, 1 - e), lerp(d, c, 1 - e), 1 - e), lerp(lerp(a, b, e), lerp(d, c, e), 1 - e)];
  const nOf = (a, b, d) => { const n = b.clone().sub(a).cross(d.clone().sub(a)).normalize(); return n.y < 0 ? n.negate() : n; };
  { const a = at(2, 4), b = at(2, 5), c = at(3, 5), d = at(3, 4); tint(inset(a, b, c, d, 0.08), nOf(a, b, d)); }
  // (the side windows of the second step and the windscreen's wrap-round corner panes of the third)
  for (const r of [1, 2]) for (const [k0, k1, sx] of [[3, 4, 1], [5, 6, -1]]) { const a = at(r, k0), b = at(r, k1), c = at(r + 1, k1), d = at(r + 1, k0), n = nOf(a, b, d); if (n.x * sx < 0) n.negate(); tint(inset(a, b, c, d, 0.12), n); }
  return acc.flush(p);
}

// ── yellow and black hazard stripes round the back ramp's mouth (frame: the tail's face, facing +z, the mouth's foot
// at the origin: 'mouth 9x5', 4.5 x 2.5 m)
export function mouthHazard(p) {
  const hw = 2.25, H = 2.5, g = 0.2, w = 0.16;
  for (const s of [-1, 1]) p.decal('hazard', w, H + g - w / 2, [s * (hw + g), (H + g - w / 2) / 2, 0.02], [0, 0, 0], '#d9a21e');
  p.decal('hazard', 2 * (hw + g) + w, w, [0, H + g, 0.021], [0, 0, 0], '#d9a21e');
  return p;
}

export function haulerRamp(p) { return ramp(p, { w: 4.5, h: 2.55, outer: 'ribbed' }); }

// ── the pallet mover ──
export const MOVER = { len: 0.6, w: 0.8 };
export function palletMover(p) {
  const L = MOVER.len, hw = MOVER.w / 2, F = { r: 0.012 };
  // the chassis, its deck and the hazard stripes along the deck's edges
  p.slab('dark', -hw, hw, 0.07, 0.34, -L, -0.04, { r: 0.03 });
  p.slab('gun', -hw + 0.03, hw - 0.03, 0.34, 0.37, -L + 0.03, -0.07, F);
  for (const z of [-L + 0.08, -0.12]) p.decal('hazard', MOVER.w - 0.12, 0.07, [0, 0.372, z], [-PI / 2, 0, 0], '#d9a21e');
  // the push bar across the front at the pallets' skids, a black pad at each end
  p.slab('yellow', -hw - 0.02, hw + 0.02, 0.06, 0.2, -0.06, -0.01, F);
  for (const x of [-hw + 0.12, hw - 0.12]) p.slab('rubber', x - 0.09, x + 0.09, 0.08, 0.18, -0.01, 0.0, { r: 0.006 });
  // four small wheels under it, and a dark skirt round them
  for (const x of [-hw + 0.1, hw - 0.1]) for (const z of [-L + 0.12, -0.16]) p.cyl('rubber', 0.07, 0.06, [x, 0.07, z], [0, 0, PI / 2], 12);
  p.slab('black', -hw + 0.01, hw - 0.01, 0.03, 0.08, -L + 0.02, -0.05, { r: 0.01 });
  // the mast at the back: a charcoal post, a small screen facing forward, a blue lamp on top
  p.slab('dark', -0.07, 0.07, 0.37, 0.95, -L + 0.02, -L + 0.14, F);
  p.slab('black', -0.06, 0.06, 0.72, 0.84, -L + 0.14, -L + 0.16, { r: 0.004 });
  p.glowSlab('blue', -0.045, 0.045, 0.74, 0.82, -L + 0.16, -L + 0.163);
  p.cyl('black', 0.05, 0.03, [0, 0.965, -L + 0.08], null, 12);
  p.cyl('rail', 0.035, 0.05, [0, 1.005, -L + 0.08], null, 12);
  p.glowSlab('blue', -0.025, 0.025, 1.03, 1.06, -L + 0.055, -L + 0.105);
  p.light([0, 1.1, -L + 0.08], 0.25, [0.4, 0.7, 1.4], null, 1.8);
  return p;
}

// ── the cockpit ──
// a wall lamp: a charcoal hood on a wall (its back on z = 0) with a soft strip under it, lighting the room ahead and below
function cockpitLamp(p) {
  p.slab('black', -0.35, 0.35, 0.0, 0.1, 0.03, 0.2, { r: 0.012 });
  p.glowSlab('soft', -0.31, 0.31, -0.006, 0.0, 0.06, 0.18);
  p.light([0, -0.1, 0.35], 3.0, [1, 0.97, 0.92], [0, -0.6, 0.8], 6);
  return p;
}
// (and the pedals: under the dash, where nobody sees them)
const NOT_HERE = new Set(['engineer', 'engineer station', 'overhead', 'locker', 'handhold port', 'handhold starboard', 'pedals0', 'pedals1']);
export const cockpitItems = () => cockpitPlan(COCKPIT).items.filter((it) => !NOT_HERE.has(it.name));
export function haulerCockpit(p) {
  for (const it of cockpitItems()) placeInto(p, part(BUILDS[it.build], it.opts), { at: it.at, rot: it.rot, scale: it.scale });
  return p;
}

// ── the fittings at this ship's sizes ──
// (the station's own pallet of crates drawn lighter, as the cabin's lean() draws its walls: the same shapes, but the
// small bars of its crates' frames with square edges (12 triangles a bar, not a bevelled 100): six pallets in a bay)
function flat(build) {
  const drawn = lean(build);
  return (p, o) => {
    const P = Object.getPrototypeOf(p), was = P.box;
    P.box = function (s, size, at, rot, opts = {}) { return was.call(this, s, size, at, rot, Math.min(...size) < 0.08 ? { ...opts, r: 0 } : opts); };
    try { return drawn(p, o); } finally { P.box = was; }
  };
}
// (the nose's floor: the cabin's deck tiles x1 each side of the middle, from the bulkhead z0 to z2 under the dash; out
// to the hull, where the nose's sides come in and its belly rises, a charcoal sill 2 cm high following the hull's
// inside edge at the deck (edge: [z, x] points). In the cockpit's frame)
export const NOSE_FLOOR = { z0: -1.25, z2: 1.25, x1: 1.62, edge: [[-1.25, 2.66], [-0.25, 2.16], [0.75, 2.14], [1.25, 1.84]] };
function noseFloor(p, o) {
  const { z0, z2, x1, edge } = o;
  placeInto(p, part(floorRun, { v: 'deck', len: 2 * x1, wid: z2 - z0 }), { at: [0, 0, (z0 + z2) / 2] });
  for (const s of [-1, 1]) {
    // (an outline in (x, -z), extruded up 2 cm and stood on the deck)
    const g = extrude([[x1, z0], ...edge, [x1, z2]].map(([a, b]) => (a === x1 ? [s * a, -b] : [s * b, -a])), 0.02, 0.004);
    put(g, [0, 0, 0], [-PI / 2, 0, 0]); p.add('solid', g, 'dark');
  }
  return p;
}
const FIT = {
  'bay frame': (p) => frame(p, { wid: 2 * (HAUL.inner + 0.03) }),
  'lane': (p) => rollerLane(p, { len: HAUL.lane.len, wid: HAUL.lane.wid, pitch: 0.35, rows: 2 }),   // (two rows of rollers under each pallet's 1.56 m)
  'pallet': flat((p) => crate(p, 'stack')),
  'tie-down': (p) => tieDown(p, { len: HAUL.lane.len }),
  'galley': (p) => galleyCounter(p, { len: 1.8, sink: 0.45, hob: -0.45, upper: false }),   // (sheet 2: the hob aft, the sink forward)
  'dinette': (p) => dinette(p, { form: 'single', bench: 1.2, table: [1.2, 0.8] }),
  'bunk': (p) => placeInto(p, part(bunkBed, { len: 1.94 }), { scale: [-1, 1, 1] }),   // (mirrored: its pillows at the aft end, as sheet 2)
  'engineer': (p) => engineerStation(p, { w: 1.5 }),
  'nose floor': (p) => noseFloor(p, NOSE_FLOOR),
  'mast': (p) => antenna(p, { h: 1.15 }),   // (his two tall masts on the cockpit's roof, 3.76 m up: their tips under the hangar's 5.3 m)
  'amber lamp': (p) => floodlight(p, { w: 0.36, h: 0.16 }),   // (his amber lamps low on the hull's frame rings)
  'cockpit lamp': (p) => cockpitLamp(p),   // (a wall lamp for the flight deck, which has no flat ceiling for light panels)
  'truss 2.5': (p) => haulerTruss(p, { len: 2.5 }),
  'truss 2': (p) => haulerTruss(p, { len: 2.0 }),
  'nose bars': (p) => noseBars(p),
  'mouth hazard': (p) => mouthHazard(p),
  'chin light': (p) => { p.slab('black', -0.13, 0.13, -0.035, 0.035, 0, 0.025, { r: 0.006 }); p.glowSlab('blue', -0.1, 0.1, -0.018, 0.018, 0.025, 0.03); return p; },   // (his small blue lights low on the nose)
  'door sill': (p) => p.decal('hazard', 1.0, 0.16, [0, 0.003, 0], [-PI / 2, 0, 0], '#d9a21e'),   // (a striped edge on the deck at the crew door's threshold, 1 m along it)
};
export const FIT_NAMES = Object.keys(FIT);
// (and a wall run without its cornice, in one panel, for under the nose's brow, whose sloping sides a cornice would
// run out into: 'wall 2.19 m, no cornice')
const WALL = /^wall (\d+(?:\.\d+)?) m, no cornice$/;   // (with a light strip along its foot: the flight deck's aft wall)
export function haulerFit(p, v) {
  const w = WALL.exec(v);
  if (w) wallRun(p, { len: +w[1], panel: +w[1] <= 2.5 ? +w[1] : 2, cornice: false, glow: true });
  else FIT[v](p);
  return p;
}

const G = 'Ships', free = (name, variants, foot, build) => ({ name, group: G, at: 'free', variants, foot, build });
export const SHIP_HAULER = {
  haulerPod: free('Hauler: engine pod', ['port', 'starboard'], [2.6, 2.1, 5.2], (p, v) => haulerPod(p, { side: v === 'starboard' ? -1 : 1 })),
  haulerRing: free('Hauler: frame ring', ['ring'], [6.0, 4.6, 0.6], (p) => haulerRing(p)),
  haulerRamp: free('Hauler: back ramp', ['back 4.5 m'], [4.6, 2.6, 4.3], (p) => haulerRamp(p)),
  haulerMover: free('Hauler: pallet mover', ['parked'], [0.9, 1.1, 0.7], (p) => palletMover(p)),
  haulerCockpit: free('Hauler: cockpit', ['two seats'], [3.0, 1.5, 2.6], (p) => haulerCockpit(p)),
  haulerFit: { ...free('Hauler: fittings', FIT_NAMES, [2, 2.5, 2], (p, v) => haulerFit(p, v)), accepts: (v) => v in FIT || WALL.test(v) },
};
