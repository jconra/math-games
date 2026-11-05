// EXPLORER C's OWN PARTS: the few things only this ship needs, each the ship parts (kit/shipparts/*) called with this
// ship's sizes and placed with place.js, or a plain plate where the cabin meets the hull. The ship itself is the layout
// file kit/rooms/ship-explorer.json (written by ~/pw/space-math/rigs/ships/ship-explorer/make.mjs); these are the
// catalog pieces it names that the families' catalogs haven't (group 'Ships': not on the Kit Lab's part tabs).
// Frames are the parts' own: nose +z, the ship's left (port) +x, the deck y = 0.
//   exWing      'port' / 'starboard': his swept wing (sheet 2's 4.5 m root, 1.0 m tip, 3.5 m out, its tip 4.6 m back),
//               drooped 8 degrees as in his front view, a dark fairing along its root; red light on the port tip, green
//               on the starboard
//   exPod       'port' / 'starboard': an engine pod: a dark housing on the hull's flank at the stern, a side engine (1.4 m
//               across) out of its back, the tail fin (2.4 m root, 2.2 m up, leaning out 11 degrees) on its top
//   exSlot      '<len> m': a blue light slot along the hull's side, a glowing bar in a dark housing
//   exNose      'nose': the nose cap with the canopy's back row of glass carried down its sides to a sill (his side panes),
//               a dark sill trim and a blue light slot under it, its small end face dark
//   exEngine    'main': the big main engine, round, 2.9 m across and 2 m long
//   exCanopy    'bars': a charcoal glazing bar down the middle of the canopy's back row (over the crew's heads)
//   exSpine     'spine': his raised spine down the roof's middle, stepping down halfway back, grey sides with dark vents
//   exNoseLights 'lamps': his nose lamps: a pair on the small end face, a pair low on the chin's sides
//   exCockpit   'three seats': the sample cockpit's three seats abreast (the engineer in the middle), its dashboard's
//               deck run on to this ship's windscreen (45 degrees, 1.2 m up 1.55 m ahead of the seats); its side
//               consoles, pedals and locker; no overhead panels (the windscreen is the roof over the seats)
//   exDoor      '2 m': the cabin's doorway in a 2 m panel (its leaves' pockets inside it), in place of a 1 m doorway
//               between two half-metre walls on each face: the same look for half the triangles
//   exCeiling   '<len> x <wid>': the cabin's ceiling run in the station's own 2 m tiles, a light in every second
//               ('lit ...': in every tile, for a small room; 'unlit ...': none)
//   exWalk      '<len> x <wid>': the cabin's corridor floor (its grated walkway and light strips) in 2 m tiles
//   exWall      '<len> m' / 'bare <len> m': the cabin's wall run in the fewest panels that keep the look; 'bare' without
//               its pilaster, skirting and cornice, where a fitting hides it
//   exBunk      'set in': the cabin's bunk bed at this bunk room's 2.4 m (2.17 m mattresses)
//   exWallKit   'breaker', 'extinguisher', 'screen', 'junction box': the station's wall kit hung on a ship wall's face,
//               without the metre of wall the cabin catalog shows them on
//   exTanks     'pair': engineering's two upright pressure tanks with a pipe manifold (sheet 2's "tanks")
//   exShelves   '<len> m': open gear shelves along a wall with boxes of gear on them (sheet 2's "shelves")
//   exMark      '<len> m': a hazard-striped line on the floor along an open edge (the galley's, the science area's)
//   exJamb      'aft' / 'fore': the plates closing the airlock's outer doorway between the cabin's wall line and the hull
//               ('aft' leaves the side door's leaf its slot)
import * as THREE from 'three';
import { part, placeInto } from '../shipparts/place.js';
import { wing, tailFin } from '../shipparts/outside/wings.js';
import { mainEngine, enginePod } from '../shipparts/outside/engines.js';
import { SECTIONS, CAP_STYLES, capRings } from '../shipparts/outside/sections.js';
import { ring } from '../shipparts/outside/hull.js';
import { floodlight } from '../shipparts/outside/details.js';
import { Acc, facet } from '../shipparts/outside/facet.js';
import { bar } from '../shipparts/outside/shapes.js';
import { SHIP, PAINTS, GLOW_SHIP } from '../shipparts/palette.js';
import { SHIP_GRID } from '../grid.js';
import { cockpitPlan, BUILDS } from '../shipparts/cockpit/set.js';
import { bunkBed } from '../shipparts/cabin/quarters.js';
import { onWall, doorway, ceilingRun, floorRun, wallRun } from '../shipparts/cabin.js';
import { FACE } from '../shipparts/cabin/ship.js';
import { breaker, jbox, extinguisher, wallScreen, pipe } from '../wallkit.js';

const PI = Math.PI, U = SHIP_GRID.cell;
// the sizes this ship's parts are drawn at
export const EXPLORER = {
  section: 'explorerC', nose: 'longcanopy',
  wing: { root: 4.5, tip: 1.0, span: 3.5, sweep: 4.6, thick: 0.4, stripe: 'yellow' }, droop: 0.14,
  fin: { root: 2.4, tip: 0.9, span: 2.2, sweep: 2.0, thick: 0.22, stripe: 'yellow', light: 'white' }, cant: 0.2,
  pod: { r: 0.7, len: 1.6, sides: 24 },
  engine: { r: 1.45, len: 2.0, sides: 24 },
  // (the windscreen's lower row falls 1 m in 1.5 m: it is 1.2 m over the deck 1.45 m ahead of the seats; a 2.6 m dash,
  // as the windscreen narrows to its foot, its deck 0.6 m deep so its corners stay under the glass, bowed 0.12 m so its
  // ends keep the three-seat dash's distance from the outer seats and their pedals)
  cockpit: { seats: 3, canopy: { y: 1.2, z: 1.45, slope: Math.atan2(2, 3) }, wallX: 1.75, dash: { w: 2.6, depth: 0.6, bow: 0.12 } },
};

// ── outside ──
// (drawn for the port side, a dark fairing along its root; the starboard one the same mirrored, its light green)
function exWing(p, side) {
  const s = side === 'starboard' ? -1 : 1, q = new p.constructor(), acc = new Acc(), c0 = EXPLORER.wing.root;
  placeInto(q, part(wing, { ...EXPLORER.wing, light: s > 0 ? 'red' : 'green' }), { rot: [0, 0, -EXPLORER.droop] });
  const f = new Acc(); housing(f, 0.32, 0.6, c0 + 0.4); const g = new p.constructor(); f.flush(g);
  placeInto(q, g, { at: [0, -0.12, c0 / 2 + 0.3] });
  return placeInto(p, q, { scale: s > 0 ? 1 : [-1, 1, 1] });
}
// a dark housing against the hull's side: a block chamfered top and bottom, `out` m out from the hull, `h` tall, `len`
// long back from z 0, its back face at x 0 (on the hull); drawn for the +x side
function housing(acc, out, h, len) {
  const P = (x, y, z) => new THREE.Vector3(x, y, z), T = SHIP.trim, c = Math.min(0.18, h * 0.3);
  const sec = (z) => [P(-0.02, 0, z), P(out - c, 0, z), P(out, c, z), P(out, h - c, z), P(out - c, h, z), P(-0.02, h, z)];
  const A = sec(0), B = sec(-len);
  for (let i = 0; i < 5; i++) { const n = A[i + 1].clone().sub(A[i]).cross(P(0, 0, 1)).normalize().negate(); facet(acc, [A[i], A[i + 1], B[i + 1], B[i]], n, { paint: T, inner: false, seams: 'all' }); }
  // (its ends: the front sloped back a little, the back square)
  for (const [S, n] of [[A, P(0, 0, 1)], [B, P(0, 0, -1)]]) facet(acc, S, n, { paint: T, inner: false });
}
// AN ENGINE POD (his picture's): a dark housing on the hull's flank at the stern, a side engine coming out of its back,
// the tail fin standing on its top, leaning out; drawn for the port side and mirrored for starboard. Frame: the housing's
// foot on the hull's side (x 0), its front end at z 0 (its back, where the engine comes out, at -len), y 0 its bottom
const POD = { out: 1.4, h: 1.7, len: 3.5 };
function exPod(p, side) {
  const s = side === 'starboard' ? -1 : 1, q = new p.constructor(), acc = new Acc(), M = POD;
  housing(acc, M.out, M.h, M.len); acc.flush(q);
  placeInto(q, part(mainEngine, EXPLORER.pod), { at: [M.out / 2, M.h / 2, -M.len] });
  placeInto(q, part(tailFin, EXPLORER.fin), { at: [M.out / 2, M.h - 0.02, -M.len / 2], rot: [0, 0, -EXPLORER.cant] });
  return placeInto(p, q, { scale: s > 0 ? 1 : [-1, 1, 1] });
}
// THE ROOF'S SPINE (his picture's): raised blocks down the roof's middle from behind the canopy toward the tail, each
// lower than the one before, their sloped sides grey with dark vents, dark modules on top. Frame: on the roof's middle line at its front end (z 0),
// the roof's top y 0, running back along -z.
function exSpine(p) {
  const acc = new Acc(), P = (x, y, z) => new THREE.Vector3(x, y, z), W = SHIP.hull, Gr = SHIP.grey, D = SHIP.trim;
  const look = (paint) => ({ paint, inner: false, seams: 'all' });
  // (two runs: [front z, back z, half-width at the base, at the top, height])
  for (const [za, zb, b, t, h] of [[0, -3.0, 0.9, 0.6, 0.42], [-3.6, -6.0, 0.8, 0.55, 0.34], [-6.6, -8.5, 0.7, 0.45, 0.26]]) {
    // (dark modules along its top: his roof's stacked dark and white blocks)
    for (let z = za - 0.4; z > zb + 0.9; z -= 1.6) facet(acc, [P(-t + 0.08, h + 0.004, z), P(t - 0.08, h + 0.004, z), P(t - 0.08, h + 0.004, z - 0.8), P(-t + 0.08, h + 0.004, z - 0.8)], P(0, 1, 0), { paint: D, inner: false, seams: 'all' });
    const L = [P(-b, 0, za), P(-t, h, za), P(t, h, za), P(b, 0, za)], R = L.map((q) => q.clone().setZ(zb));
    facet(acc, [L[1], L[2], R[2], R[1]], P(0, 1, 0), look(W));                                   // its top
    facet(acc, [L[2], L[3], R[3], R[2]], P(h, b - t, 0).normalize(), look(Gr));                   // its sides
    facet(acc, [L[0], L[1], R[1], R[0]], P(-h, b - t, 0).normalize(), look(Gr));
    // (its front a slope up from the roof, its back end square)
    const F = L.map((q, i) => (i === 0 || i === 3 ? q.clone().setZ(za + h * 1.5) : q));
    facet(acc, [F[0], F[3], F[2], F[1]], P(0, 1.5, 1).normalize(), look(W));
    facet(acc, [F[0], F[1], L[1], L[0]].filter((q, i, a) => a.findIndex((w) => w.distanceTo(q) < 1e-6) === i), P(-1, 0, 0), look(Gr));
    facet(acc, [F[3], L[3], L[2], F[2]].filter((q, i, a) => a.findIndex((w) => w.distanceTo(q) < 1e-6) === i), P(1, 0, 0), look(Gr));
    facet(acc, [R[3], R[0], R[1], R[2]], P(0, 0, -1), look(D));
    // vents: dark slots along each side
    for (let z = za - 0.5; z > zb + 0.4; z -= 0.45) for (const s of [-1, 1]) {
      const n = P(s * h, b - t, 0).normalize(), u = 0.35, v = 0.7, q = (f, g) => P(s * (b + (t - b) * f), h * f, z + g).addScaledVector(n, 0.008);
      facet(acc, [q(u, 0), q(u, -0.3), q(v, -0.3), q(v, 0)], n, { paint: D, inner: false });
    }
  }
  return acc.flush(p);
}
// LAMPS ON THE NOSE, as his: two pairs on the chin (its dark band), on its side facets and its lower chamfers, each
// facing out of its facet
function exNoseLights(p) {
  const S = SECTIONS[EXPLORER.section], rings = capRings(S, CAP_STYLES[EXPLORER.nose]), n = rings.length;
  const B = rings[n - 2], C = rings[n - 1], rb = ring(B.S), rc = ring(C.S), V = (xy, z) => new THREE.Vector3(xy[0] * U, xy[1] * U, z * U);
  const lamp = (at, nrm, w) => {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm.clone().normalize()), e = new THREE.Euler().setFromQuaternion(q);
    placeInto(p, part(floodlight, { w, h: 0.15, warm: true }), { at: at.toArray(), rot: [e.x, e.y, e.z] });
  };
  // (the +x side facet runs from ring point 2 to 3, its lower chamfer from 1 to 2; the -x ones from 6 to 7 and 7 to 0)
  for (const s of [-1, 1]) for (const [k0, k1, w] of s > 0 ? [[2, 3, 0.36], [1, 2, 0.42]] : [[6, 7, 0.36], [7, 0, 0.42]]) {
    const quad = [V(rb[k0], B.z), V(rb[k1], B.z), V(rc[k1], C.z), V(rc[k0], C.z)], c = quad.reduce((a, q) => a.add(q), new THREE.Vector3()).multiplyScalar(0.25);
    const nrm = quad[1].clone().sub(quad[0]).cross(quad[3].clone().sub(quad[0])).normalize(); if (nrm.dot(new THREE.Vector3(s, 0, 0)) < 0) nrm.negate();
    lamp(c.addScaledVector(nrm, 0.005), nrm, w);
  }
  return p;
}
// THE NOSE: the hull's nose cap ('nose explorerC longcanopy', the same rings and facets as hull.js draws it), with the
// canopy's back row of glass carried down its sides to a sill a metre over the deck (his canopy's side panes: the crew
// see out beside them), a dark trim along the sill and a blue light slot under it; its small end face dark (his nose's
// dark lower band, where its lamps are). Frame: the cap's own: the body's end on the middle line, the deck's level.
const SILLS = { 1: [2, 2] };   // (glass stage 1 (the back row): its sides glazed from level 2 up, at both its ends)
function exNose(p) {
  const S = SECTIONS[EXPLORER.section], rings = capRings(S, CAP_STYLES[EXPLORER.nose]), acc = new Acc();
  const P = (xy, z) => new THREE.Vector3(xy[0] * U, xy[1] * U, z * U), yc = (S.b + S.r) / 2 * U, NAMES = ['belly', 'lo', 'side', 'up', 'roof', 'up', 'side', 'lo'];
  const base = { paint: SHIP.hull, stripe: null, seams: null, glass: false, inner: true };
  const outOf = (pts) => { const c = pts.reduce((s, q) => s.add(q), new THREE.Vector3()).multiplyScalar(1 / pts.length); return c.clone().sub(new THREE.Vector3(0, yc, c.z)).setZ(0).normalize().add(new THREE.Vector3(0, 0, 0.6)); };
  const strip = [], glassOf = (st) => (!st ? [] : st.glass === true ? ['roof', 'up'] : st.glass || []);
  for (let i = 1; i < rings.length; i++) {
    const A = ring(rings[i - 1].S), B = ring(rings[i].S), st = rings[i].st, za = rings[i - 1].z, zb = rings[i].z;
    const gl = glassOf(st);
    for (let k = 0; k < 8; k++) {
      const k1 = (k + 1) % 8, name = NAMES[k], quad = [P(A[k], za), P(A[k1], za), P(B[k1], zb), P(B[k], zb)];
      // (the windscreen: where the roof is glass in this stage and the next and runs on in one plane, one pane over
      // both, so no frame crosses the pilots' view)
      if (name === 'roof' && gl.includes('roof') && glassOf(rings[i - 1].st).includes('roof')) continue;
      if (name === 'roof' && gl.includes('roof') && glassOf(rings[i + 1]?.st).includes('roof')) {
        const C = ring(rings[i + 1].S), zc = rings[i + 1].z, q2 = [P(A[k], za), P(A[k1], za), P(C[k1], zc), P(C[k], zc)];
        facet(acc, q2, outOf(q2), { ...base, glass: true }); continue;
      }
      const lk = { ...base, glass: gl.includes(name), paint: st.paint?.[name] ? PAINTS[st.paint[name]] : base.paint };
      if (name === 'side' && SILLS[i]) {
        // (the side split at the sill: the part under it solid, over it glass; +x side runs bottom to top, -x top to bottom)
        const [la, lb] = SILLS[i], up = k === 2, sa = P([A[k][0], Math.min(la, Math.max(A[k][1], A[k1][1]))], za), sb = P([B[k][0], Math.min(lb, Math.max(B[k][1], B[k1][1]))], zb);
        const [lo, hi] = up ? [[quad[0], sa, sb, quad[3]], [sa, quad[1], quad[2], sb]] : [[sa, quad[1], quad[2], sb], [quad[0], sa, sb, quad[3]]];
        facet(acc, lo, outOf(lo), lk); facet(acc, hi, outOf(hi), { ...lk, glass: true });
        strip.push([sa, sb, outOf(lo)]);
        continue;
      }
      facet(acc, quad, outOf(quad), lk);
    }
  }
  // the end face, dark
  const last = rings[rings.length - 1], E = ring(last.S).map((xy) => P(xy, last.z)).filter((q, i, a) => a.findIndex((w) => w.distanceTo(q) < 1e-6) === i);
  facet(acc, E, new THREE.Vector3(0, 0, 1), { ...base, paint: SHIP.trim });
  // the sill's trim and, under it, the blue slot (his canopy's lower frame and the light strip beneath)
  for (const [a, b, n] of strip) {
    const lift = (q, d, dy = 0) => q.clone().addScaledVector(n, d).add(new THREE.Vector3(0, dy, 0)).toArray();
    bar(acc, SHIP.trim, lift(a, 0.02), lift(b, 0.02), 0.1, 0.05);
    const s0 = a.clone().lerp(b, 0.1), s1 = a.clone().lerp(b, 0.9), q = [lift(s0, 0.015, -0.42), lift(s1, 0.015, -0.42), lift(s1, 0.015, -0.34), lift(s0, 0.015, -0.34)].map((v) => new THREE.Vector3(...v));
    bar(acc, SHIP.trim, lift(s0, 0.01, -0.38), lift(s1, 0.01, -0.38), 0.14, 0.03);
    acc.poly(n.x > 0 ? q : q.slice().reverse(), n, GLOW_SHIP.strip, 'glow', 9);
    p.light(lift(a.clone().lerp(b, 0.5), 0.3, -0.38), 0.3, [0.3, 0.7, 1], n.toArray(), 2);
  }
  return acc.flush(p);
}
// a blue light slot along the hull's side (his ship's wide glowing bars): a dark housing with a glowing bar in it,
// `len` along x, facing +z from the hull's face
function exSlot(p, len) {
  p.slab('black', -len / 2, len / 2, -0.09, 0.09, 0, 0.04, { r: 0.012, cell: 0.8 });
  p.glowSlab(GLOW_SHIP.strip.map((c) => c * 1.4), -len / 2 + 0.05, len / 2 - 0.05, -0.05, 0.05, 0.04, 0.046);
  for (let x = -len / 2 + 0.5; x < len / 2; x += 1) p.light([x, 0, 0.3], 0.3, [0.3, 0.7, 1], [0, 0, 1], 2);
  return p;
}
// a glazing bar over the nose cap's glass (placed on the cap's own point: the body's end, on the middle line, the deck's
// level): down the middle of the canopy's back row, over the crew's heads, so it reads as panes either side, as his
function exCanopy(p) {
  const S = SECTIONS[EXPLORER.section], rings = capRings(S, CAP_STYLES[EXPLORER.nose]), acc = new Acc(), F = SHIP.frame;
  const P = (xy, z) => new THREE.Vector3(xy[0] * U, xy[1] * U, z * U);
  // (a bar lifted off its facet a little, along the facet's normal)
  for (let i = 1; i < rings.length; i++) {
    // (over the canopy's back row only: the windscreen before the seats stays one clear pane)
    if (!rings[i].st.glass || !(rings[i].st.glass === true || rings[i].st.glass.includes('up'))) continue;
    const A = rings[i - 1], B = rings[i], a = P([0, A.S.r], A.z), b = P([0, B.S.r], B.z);
    const n = b.clone().sub(a).cross(new THREE.Vector3(1, 0, 0)).normalize();
    if (n.y < 0) n.negate();
    bar(acc, F, a.clone().addScaledVector(n, 0.012).toArray(), b.clone().addScaledVector(n, 0.012).toArray(), 0.06, 0.04);
  }
  return acc.flush(p);
}

// ── the cockpit: the cockpit family's sample set, fitted to this nose ──
export function explorerCockpitPlan() {
  const plan = cockpitPlan(EXPLORER.cockpit);
  // (no overheads under a glass roof; the handholds had only the sample's guide walls to stand on; the locker goes
  // against the bulkhead behind the co-pilot, facing forward)
  plan.items = plan.items.filter((it) => !/^overhead|^handhold/.test(it.name));
  plan.reach = plan.reach.filter((r) => !/overhead/.test(r.name));
  const lk = plan.items.find((it) => it.name === 'locker');
  if (lk) { lk.at = [-1.75, 0, -1.25 + 0.005]; lk.rot = [0, 0, 0]; }
  return plan;
}
function exCockpit(p) {
  for (const it of explorerCockpitPlan().items) placeInto(p, part(BUILDS[it.build], it.opts), { at: it.at, rot: it.rot, scale: it.scale });
  return p;
}

// ── the cabin's ──
const KIT = {
  breaker: [(p) => breaker(p, 'switches', { conduit: 0.55 }), 1.0],
  extinguisher: [extinguisher, 0.5],
  screen: [(p) => wallScreen(p, 'status'), 1.15],
  'junction box': [(p) => jbox(p, 'plain', { conduit: 0.7 }), 1.15],
};
function exWallKit(p, item) { const [build, y] = KIT[item]; return onWall(p, part(build), { at: [0, y, 0], face: '+z' }); }

// two pressure tanks standing on a plinth against a wall, banded, a pipe manifold between them into the wall
function exTanks(p) {
  p.slab('black', -0.95, 0.95, 0, 0.08, FACE, 0.62, { r: 0.01 });
  for (const x of [-0.5, 0.5]) {
    const R = 0.3, cz = 0.33, pts = [[0.001, 0.08], [R * 0.9, 0.08], [R, 0.16], [R, 1.62], [R * 0.82, 1.78], [R * 0.4, 1.84], [0.06, 1.85], [0.001, 1.85]];
    p.lathe('grey', pts, 20, [x, 0, cz]);
    for (const y of [0.42, 1.3]) p.cyl('black', R + 0.012, 0.06, [x, y, cz], null, 20);
    p.cyl('black', 0.05, 0.12, [x, 1.9, cz], null, 10);
    p.decal('hazard', 0.36, 0.06, [x, 0.9, cz + R + 0.003], null, '#c9a032');
  }
  // the manifold: a pipe across from tank to tank, and one up into the wall
  placeInto(p, part(pipe, 'straight'), { at: [0, 1.95, 0.33], rot: [0, 0, 0], scale: [0.5, 1, 1] });
  p.cyl('rail', 0.05, 1.2, [0, 1.35, 0.12], null, 12);
  p.light([0, 1.0, 0.8], 0.12, [1, 0.6, 0.2], [0, 0, 1], 1.5);
  return p;
}

// open shelves along a wall: an off-white frame, four shelves, plain boxes of gear on them (drawn lean: small slabs
// without the extra rows of vertices a big panel keeps for the bake)
const LEAN = { r: 0.006, loops: [], cell: 0.6 };
function exShelves(p, len) {
  const d = 0.5, h = 2.0, hl = len / 2;
  for (const x of [-hl, hl]) p.slab('white', x - (x > 0 ? 0.04 : 0), x + (x < 0 ? 0.04 : 0), 0, h, FACE, d, LEAN);
  p.slab('white2', -hl, hl, 0, 0.1, FACE, d - 0.02, LEAN);
  p.slab('dark', -hl + 0.04, hl - 0.04, 0.1, h, FACE, FACE + 0.01, { ...LEAN, r: 0 });
  const shelves = [0.1, 0.62, 1.12, 1.6, 1.98];
  for (const y of shelves.slice(1)) { p.slab('white2', -hl + 0.04, hl - 0.04, y - 0.025, y, FACE, d, LEAN); p.slab('black', -hl + 0.04, hl - 0.04, y - 0.045, y - 0.025, d - 0.03, d, { ...LEAN, r: 0 }); }
  // the gear: boxes about 0.3 to 0.45 m, a few to a shelf, in the station's greys with a yellow one here and there
  const looks = ['grey2', 'white2', 'grey', 'yellow', 'grey2', 'band'];
  let k = 0;
  shelves.slice(0, 4).forEach((y, row) => {
    let x = -hl + 0.08 + (row % 2) * 0.06;
    for (;;) {
      const w = 0.3 + ((k * 7) % 4) * 0.05, hh = Math.min(0.42, 0.24 + ((k * 5) % 3) * 0.08), dz = 0.32 + (k % 2) * 0.08;
      if (x + w > hl - 0.06) break;
      if ((k + row) % 4 !== 3) { p.slab(looks[k % looks.length], x, x + w, y, y + hh, FACE + 0.04, FACE + 0.04 + dz, LEAN); p.slab('black', x + 0.03, x + w - 0.03, y + hh * 0.55, y + hh * 0.55 + 0.03, FACE + 0.04 + dz, FACE + 0.045 + dz, { ...LEAN, r: 0 }); }
      x += w + 0.06; k++;
    }
  });
  return p;
}

// a hazard-striped line on the deck along x, centred, 8 cm wide
function exMark(p, len) {
  p.decal('hazard', len, 0.08, [0, 0.004, 0], [-PI / 2, 0, 0], '#c9a032');
  return p;
}

// THE PORCH: the 0.44 m between the cabin's wall line and the hull's inside face where the airlock opens on to the side
// door, closed off so nobody sees into the space behind the cabin's walls: a plate each side (the station's off-white),
// cut under the hull's chamfers top and bottom, the aft one leaving the side door's leaf its slot (0.20 to 0.23 m in
// from the hull, up to the leaf's top, 2.06 m); a ceiling plate at the cabin's ceiling height; a dark sill plate with
// hazard stripes, under the hull door's own sill. Frame: on the cabin's wall line (x 0) at the doorway's middle (z 0),
// the hull toward +x, the deck y 0; the door 1.0 m along z.
function exPorch(p) {
  const hw = 0.5, T = 0.03, slot = 0.19, leafTop = 2.06, top = 2.44;
  // (the hull's inside face is 0.44 m out, but comes in to 0.36 m at the deck, where its lower chamfer turns; its upper
  // chamfer turns at 2.446 m, so the porch's ceiling is at 2.44, a little under the airlock's, a strip closing the step)
  const full = [[0, 0], [0.35, 0], [0.42, 0.06], [0.42, top], [0, top]];
  const aft = [[0, 0], [slot, 0], [slot, leafTop], [0.42, leafTop], [0.42, top], [0, top]];
  // (plates in the x-y plane, a little thick along z: the aft one at the door's aft edge, the fore one at its fore edge)
  p.extrude('white', aft, T, 0.004).translate(0, 0, -hw);
  p.extrude('white', full, T, 0.004).translate(0, 0, hw - T);
  p.slab('white2', 0, 0.42, top - 0.01, top, -hw, hw, { r: 0, cell: 0.6 });
  p.slab('white2', -0.03, 0, top - 0.01, 2.52, -hw, hw, { r: 0, cell: 0.6 });
  p.slab('dark', 0, 0.32, -0.02, 0, -hw + T, hw - T, { r: 0, cell: 0.6 });
  // the leaf's pocket, aft of the door behind the washroom's wall: thin plates either side of its path (0.20 to 0.23 m
  // out), its floor, top and end, so its slot shows nothing past it
  const pk = { r: 0, cell: 0.6 }, z0 = -hw - 1.12;
  p.slab('white2', 0.185, 0.195, -0.01, 2.08, z0, -hw, pk); p.slab('white2', 0.235, 0.245, -0.01, 2.08, z0, -hw, pk);
  for (const [y0, y1] of [[-0.02, -0.01], [2.08, 2.09]]) p.slab('white2', 0.185, 0.245, y0, y1, z0, -hw, pk);
  p.slab('white2', 0.185, 0.245, -0.02, 2.09, z0 - 0.01, z0, pk);
  p.decal('hazard', 0.9, 0.06, [0.05, 0.002, 0], [-PI / 2, 0, PI / 2], '#c9a032');
  return p;
}

// THE COCKPIT'S DECK: one plate under the whole canopy, its sides stepping in with the canopy's (16 cm in from the
// hull's outside at deck level, clear of its plates), seams across it, a lamp along the bulkhead's top. Frame: on
// the middle line at the bulkhead (z 0), the deck y 0, forward +z; `len` metres long.
function exCockpitDeck(p) {
  const S = SECTIONS[EXPLORER.section], rings = capRings(S, CAP_STYLES[EXPLORER.nose]), pts = [];
  // (each ring's side at deck level, where the belly is still under it: the glass stages)
  for (const r of rings) { if (r.st && !r.st.glass) break; pts.push([r.S.w * U - 0.2, r.z * U]); }
  const len = pts[pts.length - 1][1] - 0.04, outline = [...pts.map(([x, z]) => [x, Math.min(z, len)]), ...pts.slice().reverse().map(([x, z]) => [-x, Math.min(z, len)])];
  // (the outline in x and z, turned to lie flat: extruded down from the deck)
  const g = p.extrude('grey', outline.map(([x, z]) => [x, -z]), 0.03, 0.004); g.rotateX(-PI / 2); g.translate(0, -0.03, 0);
  for (let z = 0.5; z < len; z += 0.5) { const hw = pts.reduce((w, q, i) => (i && z <= q[1] && z >= pts[i - 1][1] ? pts[i - 1][0] + (q[0] - pts[i - 1][0]) * (z - pts[i - 1][1]) / (q[1] - pts[i - 1][1]) : w), pts[0][0]); p.slab('black', -hw + 0.04, hw - 0.04, 0, 0.003, z - 0.006, z + 0.006, { r: 0, cell: 0.8 }); }
  // a cabin lamp along the top of the bulkhead behind the seats (the cockpit has no ceiling to carry one), lighting the
  // seats and the dash from behind and above
  p.slab('black', -1.6, 1.6, 2.3, 2.42, 0.03, 0.12, { r: 0.01, cell: 0.8 }); p.glowSlab('soft', -1.55, 1.55, 2.3, 2.305, 0.05, 0.11);
  for (const x of [-1.0, 0, 1.0]) p.light([x, 2.2, 0.4], 1.0, [1, 0.95, 0.88], [0, -0.6, 0.8], 4.5);
  return p;
}

// a wall run in the fewest of the station's panels that keep their look (one panel up to 2.5 m; 2.5 m panels for a run
// that divides by them); 'bare': no pilaster, skirting or cornice, for wall a fitting hides (behind the bunk); 'flat':
// its panels up to the ceiling's height with no cornice, for a wall with no ceiling against it (the cockpit's bulkhead,
// under the canopy)
function exWall(p, v) {
  const kind = /^(bare|flat) /.exec(v)?.[1], len = lenOf(v.replace(/^(bare|flat) /, '')), pw = len <= 2.5 ? len : Math.abs(len / 2.5 - Math.round(len / 2.5)) < 1e-6 ? 2.5 : 2;
  return wallRun(p, { len, panel: pw, ...(kind === 'bare' ? { pilaster: false, base: false, cornice: false } : kind === 'flat' ? { top: 2.5, cornice: false } : {}) });
}
const lenOf = (v) => { const m = /^(\d+(?:\.\d+)?) m$/.exec(v); return m ? +m[1] : null; };
const runOf = (v) => { const m = /^(\d+(?:\.\d+)?) x (\d+(?:\.\d+)?)$/.exec(v); return m ? { len: +m[1], wid: +m[2] } : null; };
const G = 'Ships';
export const SHIP_EXPLORER = {
  exWing: { name: 'Explorer C: wing', group: G, at: 'free', foot: [3.6, 0.8, 5], variants: ['port', 'starboard'], build: exWing },
  exPod: { name: 'Explorer C: engine pod', group: G, at: 'free', foot: [1.4, 3.5, 5], variants: ['port', 'starboard'], build: exPod },
  exSlot: { name: 'Explorer C: light slot', group: G, at: 'free', foot: [2, 0.3, 0.1], variants: ['2 m'], accepts: (v) => !!lenOf(v), build: (p, v) => exSlot(p, lenOf(v) || 2) },
  exNose: { name: 'Explorer C: nose and canopy', group: G, at: 'free', foot: [6, 3.5, 4], variants: ['nose'], build: exNose },
  exEngine: { name: 'Explorer C: main engine', group: G, at: 'free', foot: [2.4, 2.4, 1.8], variants: ['main'], build: (p) => mainEngine(p, EXPLORER.engine) },
  exCanopy: { name: 'Explorer C: canopy bars', group: G, at: 'free', foot: [5, 2, 2.5], variants: ['bars'], build: exCanopy },
  exSpine: { name: 'Explorer C: roof spine', group: G, at: 'free', foot: [1.6, 0.4, 9], variants: ['spine'], build: exSpine },
  exNoseLights: { name: 'Explorer C: nose lamps', group: G, at: 'free', foot: [4, 1, 4.2], variants: ['lamps'], build: exNoseLights },
  exCockpit: { name: 'Explorer C: cockpit', group: G, at: 'free', foot: [4, 1.4, 3], variants: ['three seats'], build: exCockpit },
  exDoor: { name: 'Explorer C: doorway in a 2 m panel', group: G, at: 'free', foot: [2, 2.5, 0.3], variants: ['2 m'], build: (p) => doorway(p, { w: 2 }) },
  exCeiling: { name: 'Explorer C: ceiling run', group: G, at: 'free', foot: [2, 0.3, 2], variants: ['2 x 2', 'lit 2 x 2', 'unlit 2 x 2'], accepts: (v) => !!runOf(v.replace(/^(un)?lit /, '')),
    build: (p, v) => ceilingRun(p, { ...(runOf(v.replace(/^(un)?lit /, '')) || { len: 2, wid: 2 }), tile: 2, lights: /^lit /.test(v) ? 1 : /^unlit /.test(v) ? 0 : 2 }) },
  exWalk: { name: 'Explorer C: corridor floor', group: G, at: 'free', foot: [2, 0.1, 1], variants: ['2 x 1'], accepts: (v) => !!runOf(v), build: (p, v) => floorRun(p, { ...(runOf(v) || { len: 2, wid: 1 }), v: 'walk', tile: 2 }) },
  exWall: { name: 'Explorer C: wall run', group: G, at: 'free', foot: [2, 2.5, 0.3], variants: ['2.5 m', 'bare 2.5 m', 'flat 2 m'], accepts: (v) => !!lenOf(v.replace(/^(bare|flat) /, '')), build: (p, v) => exWall(p, v) },
  exPorch: { name: 'Explorer C: the airlock\'s porch', group: G, at: 'free', foot: [0.5, 2.5, 1], variants: ['porch'], build: exPorch },
  exCockpitDeck: { name: 'Explorer C: cockpit deck', group: G, at: 'free', foot: [5.8, 0.1, 3], variants: ['deck'], build: exCockpitDeck },
  exBunk: { name: 'Explorer C: bunk bed', group: G, at: 'free', foot: [2.4, 2.5, 1], variants: ['set in'], build: (p) => bunkBed(p, { len: 2.4 }) },
  exWallKit: { name: 'Explorer C: wall kit', group: G, at: 'free', foot: [0.5, 1, 0.3], variants: Object.keys(KIT), build: exWallKit },
  exTanks: { name: 'Explorer C: tanks', group: G, at: 'free', foot: [2, 2, 0.7], variants: ['pair'], build: exTanks },
  exShelves: { name: 'Explorer C: shelves', group: G, at: 'free', foot: [2, 2, 0.5], variants: ['1.5 m', '2 m'], accepts: (v) => !!lenOf(v), build: (p, v) => exShelves(p, lenOf(v) || 2) },
  exMark: { name: 'Explorer C: floor edge', group: G, at: 'free', foot: [2, 0.1, 0.1], variants: ['2 m'], accepts: (v) => !!lenOf(v), build: (p, v) => exMark(p, lenOf(v) || 2) },
};
