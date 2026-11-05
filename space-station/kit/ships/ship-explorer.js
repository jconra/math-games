// EXPLORER C's OWN PARTS: the few things only this ship needs, each the ship parts (kit/shipparts/*) called with this
// ship's sizes and placed with place.js, or a plain plate where the cabin meets the hull. The ship itself is the layout
// file kit/rooms/ship-explorer.json (written by ~/pw/space-math/rigs/ships/ship-explorer/make.mjs); these are the
// catalog pieces it names that the families' catalogs haven't (group 'Ships': not on the Kit Lab's part tabs).
// Frames are the parts' own: nose +z, the ship's left (port) +x, the deck y = 0.
//
// THE OUTSIDE is not the grid's hull plates but a shell of its own, after the game's maker's word that the first one
// "looks like a school bus": one lofted skin whose cross-section changes along the ship (a big dark shroud swelling
// round the engines, the body round the cabin, a step down behind the canopy to a narrower, lower nose, the canopy
// rising out of it to a low point), with plates, blocks and housings layered on it at different depths. Every outside
// part is drawn in the ship's own metres: m_x (port +x) from the middle line, h up from the deck, m_z forward from the
// old hull's tail line (engineering's aft wall is at 0.5, the cockpit's bulkhead at 11.0); the layout places each at
// (m_x 0, m_z 0), level 0.
//   exShell     'hull': the shell (shellSection() gives its cross-section anywhere along it): its canopy smoked panes
//               in heavy dark frames (the windscreen split down the middle, three panes along each side, panes over
//               the top); the side door's opening in its port side (its lining, sill and frame)
//   exArmour    'port' / 'starboard': the plates and housings on a flank: the lower forward cheek with its blue strip,
//               the plates over the side, the door's deep dark frame (port), the wing glove (a bulky dark housing at the
//               wing's root, a blue lamp in its front), the shroud's ribs and the amber lamp on the pod
//   exRoof      'modules': the stacked roof modules stepping down toward the tail (white blocks, dark vents and
//               intakes), the dark shroud's top
//   exEngines   'three': the main engine (2.8 m across) high in the middle of the shroud's back and a side engine (1.9
//               m) low each side, nearly filling it
//   exFin       'port' / 'starboard': a tail fin on a dark root housing on the pod, leaning out
//   exWing      'port' / 'starboard': his swept wing (4.5 m root, 1.0 m tip, 3.15 m out, its tip 4.4 m back), drooped
//               8 degrees, a dark fairing along its root; red light on the port tip, green on the starboard
//   exNoseLamps 'lamps': his nose lamps: a pair on the nose's dark point, a pair low on its cheeks, blue lights either
//               side of the canopy on the body's front
//   exCockpit   'three seats': the sample cockpit's three seats abreast (the engineer in the middle), its dashboard's
//               deck run on to this ship's windscreen (45 degrees, 1.2 m up 1.55 m ahead of the seats); its side
//               consoles, pedals and locker; no overhead panels (the canopy is the roof over the seats)
//   exCockpitDeck 'deck': the cockpit's floor following the shell's sides, a lamp along the bulkhead's top, a dark
//               cover from the dash's front to the windscreen's foot, the plate closing the bulkhead over the cabin's
//               walls up to the canopy
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
//   exPorch     'porch': the plates closing the airlock's outer doorway between the cabin's wall line and the hull
import * as THREE from 'three';
import { part, placeInto } from '../shipparts/place.js';
import { wing, tailFin } from '../shipparts/outside/wings.js';
import { mainEngine } from '../shipparts/outside/engines.js';
import { floodlight } from '../shipparts/outside/details.js';
import { Acc, facet, lining, orient, THICK } from '../shipparts/outside/facet.js';
import { box, bar, latheZ } from '../shipparts/outside/shapes.js';
import { SHIP, GLOW_SHIP } from '../shipparts/palette.js';
import { cockpitPlan, BUILDS } from '../shipparts/cockpit/set.js';
import { bunkBed } from '../shipparts/cabin/quarters.js';
import { onWall, doorway, ceilingRun, floorRun, wallRun } from '../shipparts/cabin.js';
import { FACE } from '../shipparts/cabin/ship.js';
import { breaker, jbox, extinguisher, wallScreen, pipe } from '../wallkit.js';

const PI = Math.PI;
// the sizes this ship's parts are drawn at
export const EXPLORER = {
  wing: { root: 4.5, tip: 1.0, span: 3.0, sweep: 4.3, thick: 0.6, stripe: 'yellow' }, droop: 0.22,
  fin: { root: 2.5, tip: 0.85, span: 2.05, sweep: 2.0, thick: 0.5, stripe: 'yellow', light: 'white' }, cant: 0.16,
  // the three engines, each in a round housing standing out behind the hull (his ribbed shroud, its blue band): the
  // main one high in the middle, a side one low each side; their fronts just inside the shroud's back
  engine: { r: 1.3, len: 2.0, sides: 24, glow: 0.5 }, side: { r: 0.95, len: 1.6, sides: 24, glow: 0.5 }, engineZ: 0.45, lip: [0.4, 0.35],
  engineAt: [0, 1.5], sideAt: [2.25, 0.8],
  // the canopy's glass: this many of the kit's faint panes deep (smoked, the lit seats still showing through; the
  // station's own windows are six), in heavy frames this wide (a dark band flat on the facet, a raised frame inside it)
  smoke: 12, pillar: 0.03, frame: 0.045, frameLook: { c: '#4a4f57', r: 0.38, m: 0.5, w: 0.35 },
  // (the windscreen's lower row falls 1 m in 1.5 m: it is 1.2 m over the deck 1.45 m ahead of the seats; a 2.6 m dash,
  // as the windscreen narrows to its foot, its deck 0.6 m deep so its corners stay under the glass, bowed 0.12 m so its
  // ends keep the three-seat dash's distance from the outer seats and their pedals)
  cockpit: { seats: 3, canopy: { y: 1.2, z: 1.45, slope: Math.atan2(2, 3) }, wallX: 1.75, dash: { w: 2.6, depth: 0.6, bow: 0.12 } },
  // where the cockpit's seats stand (m_z) and the side door (m_z of its middle; the door 1 m wide, 2 m tall)
  seatsZ: 12.25, doorZ: 9.5,
};

// ── THE SHELL ──
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
// A SECTION is the port half of a cross-section (m_x, h), from the keel up to the top's middle, ten points: K the keel,
// B the belly's edge, C the lower chamfer's top, L0 the side's foot, L1 its top, S the sill (the canopy's foot; on the
// body a crease), P1, P2, P3 up and over the shoulder (the canopy's side, shoulder and crown; on the body the upper side
// leaning in and the roof's two edges), T the top's middle. So nine bands round each half:
export const BAND = { belly: 0, chamfer: 1, lower: 2, side: 3, ledge: 4, upper: 5, shoulder: 6, crown: 7, top: 8 };
const SEC = {
  // the shroud's back, drawn in round the three engines it hugs (the main one 1.3 m round at h 1.5; the side ones
  // 0.95 m round at m_x 2.45, h 0.55): a lobed outline, the body flowing into them
  back: [[0, -0.1], [1.1, -0.2], [2.25, -0.27], [3.0, 0.05], [3.32, 0.8], [3.0, 1.56], [2.0, 2.05], [1.2, 2.55], [0.55, 2.86], [0, 2.92]],
  // the stern: its lower sides rounded out into lobes round the side engines (their housings, the pods), a waist over
  // them, the upper side and a domed top round the main engine; its top falling toward the engines
  stern: [[0, -0.42], [1.1, -0.42], [2.55, -0.38], [3.2, -0.1], [3.42, 0.8], [3.15, 1.5], [2.75, 2.75], [2.3, 2.96], [1.4, 3.03], [0, 3.06]],
  stern2: [[0, -0.3], [1.1, -0.3], [2.55, -0.3], [3.2, -0.06], [3.42, 0.8], [3.15, 1.5], [2.75, 2.75], [2.45, 2.88], [1.3, 2.9], [0, 2.92]],
  // the body round the cabin (its rooms reach 2.55 m out and 2.75 m up): a dark chamfer under a side wall, a crease,
  // the upper side leaning in, the roof's two edges (eight-sided)
  body: [[0, -0.5], [1.0, -0.5], [2.5, -0.32], [3.0, 0.0], [3.0, 2.12], [2.97, 2.2], [2.62, 2.85], [2.2, 3.08], [1.45, 3.16], [0, 3.18]],
};
// THE COCKPIT AND NOSE: the lower hull narrower than the body (its side, a ledge in to the sill), the canopy a faceted
// dome on it (side, shoulder, crown, top) whose top line curves down from the roof's height to the windscreen's foot
// at the nose; the sill rising a little toward the rear. Each station: [m_z, the lower hull (K..L1), the canopy (S..T)]
const NOSE = [
  [11.45, [[0, -0.5], [0.9, -0.5], [2.15, -0.28], [2.7, 0.12], [2.7, 1.0]], [[1.5, 1.48], [1.48, 2.05], [1.3, 2.7], [0.8, 3.18], [0, 3.32]]],
  [12.25, [[0, -0.47], [0.85, -0.47], [2.05, -0.24], [2.6, 0.13], [2.6, 0.98]], [[1.5, 1.34], [1.47, 1.92], [1.28, 2.56], [0.78, 3.0], [0, 3.14]]],
  [13.0, [[0, -0.38], [0.78, -0.38], [1.9, -0.16], [2.4, 0.16], [2.4, 0.95]], [[1.62, 1.2], [1.57, 1.66], [1.32, 2.16], [0.78, 2.5], [0, 2.6]]],
  [13.8, [[0, -0.28], [0.68, -0.28], [1.62, -0.1], [2.08, 0.22], [2.08, 0.9]], [[1.48, 1.06], [1.42, 1.4], [1.18, 1.72], [0.7, 1.88], [0, 1.95]]],
  // the canopy's foot: the glass comes down to the nose's top
  [14.8, [[0, 0.0], [0.5, 0.0], [1.05, 0.1], [1.3, 0.3], [1.3, 0.86]], [[0.9, 0.98], [0.86, 1.0], [0.72, 1.02], [0.44, 1.04], [0, 1.05]]],
  // the nose: a faceted wedge, its chin rising to a deep flat face (lamps at its lower corners, a dark jaw under it)
  [15.65, [[0, 0.04], [0.48, 0.04], [0.64, 0.12], [0.74, 0.26], [0.74, 0.74]], [[0.64, 0.84], [0.54, 0.88], [0.38, 0.9], [0.2, 0.91], [0, 0.92]]],
];
const mix = (a, b, t) => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]);
// the canopy: its glass from the collar (11.45) to its foot (15.0); full frames at its ribs (rear panes, the big middle
// ones, the front-quarter ones narrowing to the foot), soft creases between at the other stations; the windscreen and
// the roof panes over the top, a frame down the middle. The collar: the body's section at the bulkhead's face (11.035)
// running forward and in to the canopy's rear edge, its white armour wrapped round it
export const CANOPY = { z: [10.4, 12.25, 13.8, 14.8], soft: [11.035, 11.45, 13.0], top: [10.4, 12.25, 14.8], collar: [11.035, 11.45], foot: 14.8, back: 10.4 };
// the stations, tail to nose: the shroud's back, the stern, the body (stations at the door's edges, so its opening
// and inside faces fall on them), the collar to the cockpit's section, the canopy, the nose's point
export const SHELL = [
  [0.0, SEC.back], [0.44, SEC.stern2], [0.55, SEC.stern2], [3.0, SEC.stern], [3.6, mix(SEC.stern, SEC.body, 0.5)], [4.2, SEC.body],
  [7.8, SEC.body], [9.0, SEC.body], [10.0, SEC.body], [10.4, SEC.body], [CANOPY.collar[0], SEC.body],
  ...NOSE.map(([z, lo, up]) => [z, [...lo, ...up]]),
].map(([z, pts]) => ({ z, pts }));
export const SHELL_Z = [SHELL[0].z, SHELL[SHELL.length - 1].z];
// the port half-section at m_z (between two stations, each point on the straight run between them, as the facets are)
export function shellSection(z) {
  if (z <= SHELL[0].z) return SHELL[0].pts;
  for (let i = 1; i < SHELL.length; i++) if (z <= SHELL[i].z) { const A = SHELL[i - 1], B = SHELL[i], t = (z - A.z) / (B.z - A.z || 1); return mix(A.pts, B.pts, t); }
  return SHELL[SHELL.length - 1].pts;
}
// the whole cross-section at m_z as a loop (m_x, h), counter-clockwise seen from the nose
export function shellLoop(z) { const h = shellSection(z); return [...h.slice(0, -1), ...h.slice(1).reverse().map(([x, y]) => [-x, y])]; }

// a polygon (counter-clockwise seen from n) moved in from each edge by its own distance ds[i] (edge i: P[i] to P[i + 1])
function insetBy(P, n, ds) {
  const L = P.length, out = [];
  for (let i = 0; i < L; i++) {
    const i0 = (i - 1 + L) % L, p1 = P[i], e0 = p1.clone().sub(P[i0]).normalize(), e1 = P[(i + 1) % L].clone().sub(p1).normalize();
    const A = p1.clone().addScaledVector(n.clone().cross(e0), ds[i0]), B = p1.clone().addScaledVector(n.clone().cross(e1), ds[i]), den = e0.clone().cross(e1).dot(n);
    out.push(Math.abs(den) < 1e-6 ? A.add(B).multiplyScalar(0.5) : A.addScaledVector(e0, B.clone().sub(A).cross(e1).dot(n) / den));
  }
  return out;
}
// A PANE of the canopy: glass in a heavy dark frame (a dark band flat on the facet, a raised frame inside it), the glass
// sunk a little, `smoke` panes deep; seen from inside too (the frame's back dark, the glass both ways). o.soft: pairs
// of points; an edge between such a pair has no frame (the glass runs on into the next facet: one pane over a crease)
function pane(acc, pts, out, o = {}) {
  const oo = orient(pts, out); if (!oo) return; const { n } = oo, P = oo.pts, F = EXPLORER.frameLook, L = P.length;
  const pil = o.pillar ?? EXPLORER.pillar, fw = o.frame ?? EXPLORER.frame, layers = o.smoke ?? EXPLORER.smoke;
  const same = (a, b) => a.distanceTo(b) < 1e-5, soft = P.map((q, i) => (o.soft || []).some(([a, b]) => (same(a, q) && same(b, P[(i + 1) % L])) || (same(b, q) && same(a, P[(i + 1) % L]))));
  // (at a soft crease the frames stop square on the crease, an end cap closing each; the glass alone runs on a little past
  // it, so two bent facets' glass overlaps: no crack)
  const mid = insetBy(P, n, soft.map((t) => (t ? 0 : pil))), inner = insetBy(mid, n, soft.map((t) => (t ? 0 : fw))), glassAt = insetBy(P, n, soft.map((t) => (t ? -0.008 : pil + fw)));
  // (a facet too small or thin for glass in its frame is all frame)
  for (let i = 0; i < L; i++) { const j = (i + 1) % L; if (!soft[i] && inner[j].clone().sub(inner[i]).dot(P[j].clone().sub(P[i])) <= 1e-6) return facet(acc, P, n, { paint: F, inner: o.inner !== false }); }
  const lift = 0.025, sink = -0.02, back = sink - 0.006 * layers - 0.004, bn = n.clone().negate(), at = (q, d) => q.clone().addScaledVector(n, d);
  for (let i = 0; i < L; i++) {
    if (soft[i]) continue;
    const j = (i + 1) % L, so = n.clone().cross(P[j].clone().sub(P[i])).normalize().negate();   // (outward from the pane, across this edge)
    acc.poly([P[i], P[j], mid[j], mid[i]], n, F);                                                   // the dark band on the facet
    if (o.inner !== false) { acc.poly([P[i], mid[i], mid[j], P[j]].map((q) => at(q, -THICK)), bn, F); acc.poly([P[i], P[j], at(P[j], -THICK), at(P[i], -THICK)], so, F); }
    acc.poly([at(mid[i], lift), at(mid[j], lift), at(inner[j], lift), at(inner[i], lift)], n, F);  // the raised frame
    acc.poly([mid[i], mid[j], at(mid[j], lift), at(mid[i], lift)], so, F);
    acc.poly([at(inner[i], lift), at(inner[j], lift), at(inner[j], back), at(inner[i], back)], so.clone().negate(), F);
    acc.poly([mid[i], inner[i], inner[j], mid[j]].map((q) => at(q, back)), bn, F);                  // (its back, seen from inside)
    acc.poly([at(mid[i], 0), at(mid[j], 0), at(mid[j], back), at(mid[i], back)], so, F);
  }
  for (let i = 0; i < L; i++) {
    // (a frame's end where it meets a soft crease: its pillar's end and its raised frame's end, both ways)
    const prev = (i - 1 + L) % L, capAt = (v) => { const quads = [[P[v], mid[v], at(mid[v], -THICK), at(P[v], -THICK)], [at(mid[v], lift), at(inner[v], lift), at(inner[v], back), at(mid[v], back)]];
      for (const q of quads) { const o2 = orient(q, newell(q)); if (o2) { acc.poly(o2.pts, o2.n, F); acc.poly(o2.pts.slice().reverse(), o2.n.clone().negate(), F); } } };
    if (!soft[i] && soft[prev]) capAt(i);
    if (!soft[i] && soft[(i + 1) % L]) capAt((i + 1) % L);
  }
  for (let k = 0; k < layers; k++) { const g = glassAt.map((q) => at(q, sink - 0.006 * k)); acc.poly(g, n, null, 'glass', 9); acc.poly(g.slice().reverse(), bn, null, 'glass', 9); }
}
// the Newell normal of a polygon (its corners in order)
function newell(q) { const n = V3(0, 0, 0); for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y); } return n; }
// a polygon cut by a level plane: the part over h (above true) or under it
function cutY(pts, h, above) {
  const out = [], f = (p) => (above ? p.y - h : h - p.y);
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], fa = f(a), fb = f(b); if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) out.push(a.clone().lerp(b, fa / (fa - fb))); }
  return out;
}
// LOFT: stations [{ z, pts }] joined facet by facet, both halves; look(k, i, s) the look of band k between stations i
// and i + 1 on side s (+1 port, -1 starboard): a facet's look ({ paint, seams, inner, ... }), { glass: true, soft } for
// a pane (soft(k, i, edge) true where its edge 'a' (station i), 'b' (station i + 1), 'lo' (point k) or 'hi' (point
// k + 1) has no frame), { above: h } to draw only the part over h (a door's opening under it), or null for none
function loft(acc, st, look) {
  for (let i = 0; i < st.length - 1; i++) {
    const A = st[i], B = st[i + 1];
    for (let k = 0; k < A.pts.length - 1; k++) for (const s of [1, -1]) {
      const lk = look(k, i, s); if (!lk) continue;
      const P = (pt, z) => V3(s * pt[0], pt[1], z);
      const a0 = P(A.pts[k], A.z), a1 = P(A.pts[k + 1], A.z), b1 = P(B.pts[k + 1], B.z), b0 = P(B.pts[k], B.z);
      let q = [a0, a1, b1, b0];
      const out = newell(q).multiplyScalar(s); if (out.lengthSq() < 1e-10) continue;
      if (lk.above != null) { q = cutY(q, lk.above, true); if (q.length < 3) continue; }
      if (!lk.glass) { facet(acc, q, out, lk); continue; }
      const soft = [['a', a0, a1], ['b', b0, b1], ['lo', a0, b0], ['hi', a1, b1]].filter(([e]) => lk.soft?.(e)).map(([, p, r]) => [p, r]);
      pane(acc, q, out, { ...lk, soft });
      if (lk.backing) {
        const n = out.clone().normalize(), bq = q.map((p) => p.clone().addScaledVector(n, -0.11));
        facet(acc, bq, out, { paint: SHIP.frame, inner: false }); facet(acc, bq, out.clone().negate(), { paint: SHIP.frame, inner: false });
        // (its rear edge closed to the shell: a strip across from the glass's frame to the backing, facing forward)
        if (Math.abs(A.z - CANOPY.back) < 1e-6) facet(acc, [a0, a1, a1.clone().addScaledVector(n, -0.11), a0.clone().addScaledVector(n, -0.11)], V3(0, 0, 1), { paint: SHIP.frame, inner: false });
      }
    }
  }
}

// the shell's paint, band by band along it (his: off-white panels over a dark lower chamfer and a grey belly; the
// stern's shroud dark, ribbed; dark frames round the canopy; the nose's point and its chin band dark)
const W = SHIP.hull, W2 = SHIP.hull2, D = SHIP.trim, G = SHIP.grey;
const isAt = (z, list) => list.some((q) => Math.abs(q - z) < 1e-6);
function shellLook(k, i, s) {
  const za = SHELL[i].z, zb = SHELL[i + 1].z, zm = (za + zb) / 2, { belly, chamfer, lower, side, ledge, upper, shoulder, crown, top } = BAND;
  // (inside faces: round the side door, where the airlock's porch and the door leaf's pocket look out at the hull, and
  // the collar, which the cockpit looks back into)
  const doorSeg = s > 0 && za >= 7.8 - 1e-6 && zb <= 10.4 + 1e-6, door = s > 0 && Math.abs(za - 9.0) < 1e-6, collar = Math.abs(za - CANOPY.collar[0]) < 1e-6;
  const canopy = za >= CANOPY.z[0] - 1e-6 && zb <= CANOPY.foot + 1e-6, cockpit = za >= CANOPY.collar[0] - 1e-6 && zb <= CANOPY.foot + 1e-6, overCabin = canopy && zb <= CANOPY.collar[0] + 1e-6;
  // (glass: the side panes are one pane up over the shoulder to the crown, framed at the ribs, over the cockpit; the
  // windscreen and the roof glass over the top, the roof glass running back over the collar and the cabin to the door
  // (a dark backing under it over the cabin); framed down the middle; a frame wherever glass meets plating)
  const glassBands = overCabin ? [crown, top] : collar ? [shoulder, crown, top] : [upper, shoulder, crown, top];
  if (canopy && glassBands.includes(k)) {
    const ribs = { [top]: [10.4, 12.25, 14.8], [crown]: [10.4, 14.8], [shoulder]: [11.035, 14.8], [upper]: [11.45, 14.8] }[k];
    return { glass: true, backing: overCabin, soft: (e) => (e === 'a' ? !isAt(za, ribs) : e === 'b' ? !isAt(zb, ribs) : e === 'lo' ? (k === shoulder || k === crown) && glassBands.includes(k - 1) : e === 'hi' ? (k === upper || k === shoulder) && glassBands.includes(k + 1) : false) };
  }
  // (and the body under the canopy's rear panes, seen from the cockpit through the collar's glass)
  const inner = (cockpit && k >= chamfer && k <= ledge) || (collar && k > ledge) || (doorSeg && k >= lower && k <= upper) || (overCabin && k >= side && k <= shoulder);
  const look = (paint, more = {}) => ({ paint, inner, seams: null, ...more });
  if (collar) return look(k <= lower ? D : k === ledge || k === upper ? W : W2, { seams: k >= side ? 'all' : null });   // the collar's sides: white armour round the canopy's rear
  if (zm < 3.6) return look(k === belly || k === side ? G : D, { seams: 'all' });            // the shroud (the pods' sides grey, so their ribs read)
  if (zm > CANOPY.foot) return look(k === side || k === ledge || k === upper || k === shoulder ? W : D, { seams: k === side ? 'all' : null, inner: k >= side });   // the nose's point: white cheeks, a dark band down its middle (seen from inside past the cover)
  switch (k) {
    case belly: return look(G);
    case chamfer: case lower: return look(D);
    case side: return door ? look(W, { above: 2.0, seams: 'all' }) : look(W2, { seams: 'all' });
    case ledge: return look(cockpit ? W : D, { seams: cockpit ? 'all' : null });   // (beside the canopy, his white armour cheeks)
    case upper: return look(W2, { seams: 'all' });
    case shoulder: return look(W);
    case crown: return look(W2);
    default: return look(W, { seams: 'all' });
  }
}
// THE CANOPY'S PILLARS (his raked frames): a bar on the side glass from the sill (S) at m_z z0 up and back over the
// side, shoulder and crown to their top (P3) at z1, standing a little off the glass; on side s
function pillar(acc, s, z0, z1, w = 0.11) {
  const N = 8, pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, z = z0 + (z1 - z0) * t, sec = shellSection(z), u = t * 3, k = Math.min(2, Math.floor(u)), f = u - k, a = sec[BAND.upper + k], b = sec[BAND.upper + k + 1];
    const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, n = V3(s * (b[1] - a[1]), -(b[0] - a[0]), 0).normalize();
    pts.push(V3(s * x, y, z).addScaledVector(n, 0.035));
  }
  for (let i = 0; i < N; i++) bar(acc, EXPLORER.frameLook, pts[i].toArray(), pts[i + 1].toArray(), w, 0.07);
}
// a flat face over a loop (convex outline) with round holes, both drawn from the side n faces
function faceHoles(acc, outline, holes, n, paint) {
  const t = V3(1, 0, 0), r = n.clone().cross(t), to2 = (q) => new THREE.Vector2(q.dot(t), q.dot(r));
  const o = orient(outline, n), hs = holes.map((h) => orient(h, n).pts.slice().reverse()), all = [...o.pts, ...hs.flat()];
  const tri = THREE.ShapeUtils.triangulateShape(o.pts.map(to2), hs.map((h) => h.map(to2)));
  acc.tris(tri.map((tr) => tr.map((i) => all[i])), n, paint);
}
const circle = (cx, cy, z, r, n = 24) => Array.from({ length: n }, (_, i) => V3(cx + Math.cos(i / n * PI * 2) * r, cy + Math.sin(i / n * PI * 2) * r, z));
// THE SHELL: the loft, the shroud's back face round the engines (their collars cover the holes), the nose's dark point,
// the side door's opening (port, its middle at m_z 9.5: 1.0 x 2.0 m from the deck) lined 0.3 m deep, a grey sill (its
// deep dark frame is the flank's armour)
function exShell(p) {
  const acc = new Acc();
  loft(acc, SHELL, shellLook);
  const back = shellLoop(SHELL[0].z).map(([x, y]) => V3(x, y, SHELL[0].z)), [ex, ey] = EXPLORER.engineAt, [sx, sy] = EXPLORER.sideAt;
  const bz = SHELL[0].z; faceHoles(acc, back, [circle(ex, ey, bz, EXPLORER.engine.r * 0.97), circle(sx, sy, bz, EXPLORER.side.r * 0.97), circle(-sx, sy, bz, EXPLORER.side.r * 0.97)], V3(0, 0, -1), D);
  // the canopy's raked pillars: the front-quarter pane's (the A-pillar), between the big middle pane and the rear one
  for (const s of [1, -1]) for (const [z0, z1] of [[14.05, 13.15], [12.55, 11.75]]) pillar(acc, s, z0, z1);
  const tip = SHELL[SHELL.length - 1], face = shellLoop(tip.z).map(([x, y]) => V3(x, y, tip.z));
  facet(acc, face, V3(0, 0, 1), { paint: D, inner: true });   // (its inside too: seen past the cockpit's cover)
  // the door's opening: the lining through the hull, a grey sill along its foot, a raised dark frame round it
  const dz = EXPLORER.doorZ, hole = [V3(3.0, 0, dz - 0.5), V3(3.0, 0, dz + 0.5), V3(3.0, 2.0, dz + 0.5), V3(3.0, 2.0, dz - 0.5)], nx = V3(1, 0, 0), ho = orient(hole, nx).pts;
  lining(acc, ho, nx, 0.3, D, true);
  acc.poly([V3(3.035, 0.004, dz - 0.5), V3(3.035, 0.004, dz + 0.5), V3(2.7, 0.004, dz + 0.5), V3(2.7, 0.004, dz - 0.5)], V3(0, 1, 0), G);
  return acc.flush(p);
}

// ── PLATES, BLOCKS AND HOUSINGS ON THE SHELL ──
// a plate laid on band k of the shell from m_z z0 to z1, from f0 to f1 across the band (0 its lower edge, 1 its
// upper), standing d out from it (o.off: from that far out, a plate on a plate), its edges chamfered: o.cz0 / o.cz1 at
// its aft and fore ends, o.cf0 / o.cf1 along its lower and upper edges (or o.c for all); look its face's ({ paint,
// seams, slash, ... }), o.edge its sides' paint; on side s (+1 port, -1 starboard). d may run from o.d0 at z0 to d at z1.
function plateOn(acc, s, k, z0, z1, f0, f1, d, look, o = {}) {
  const zs = [z0, ...SHELL.map((q) => q.z).filter((z) => z > z0 + 1e-6 && z < z1 - 1e-6), z1], c = o.c ?? 0.04, off = o.off ?? 0;
  const F0 = Array.isArray(f0) ? f0 : [f0, f0], F1 = Array.isArray(f1) ? f1 : [f1, f1], at = (V, z) => V[0] + (V[1] - V[0]) * (z - z0) / (z1 - z0);
  const cz0 = o.cz0 ?? c, cz1 = o.cz1 ?? c, cf0 = o.cf0 ?? c, cf1 = o.cf1 ?? c, E = o.edge ?? look.paint;
  const frame = (z) => { const sec = shellSection(z), a = sec[k], b = sec[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    return { nrm: V3(s * dy / L, -dx / L, 0), dir: V3(s * dx / L, dy / L, 0), pt: (f) => V3(s * (a[0] + dx * f), a[1] + dy * f, z).addScaledVector(V3(s * dy / L, -dx / L, 0), off) }; };
  const ring = zs.map((z, i) => {
    // (at the ends the top's edge stands back by the chamfer, on the shell's section there)
    const tz = i === 0 ? cz0 : i === zs.length - 1 ? -cz1 : 0, B = frame(z), T = frame(z + tz), dd = o.d0 == null ? d : o.d0 + (d - o.d0) * (z + tz - z0) / (z1 - z0);
    const top = (f, along) => T.pt(f).addScaledVector(T.nrm, dd).addScaledVector(T.dir, along), zt = z + tz;
    const r = { b0: B.pt(at(F0, z)), b1: B.pt(at(F1, z)), t0: top(at(F0, zt), cf0), t1: top(at(F1, zt), -cf1), nrm: B.nrm, dir: B.dir };
    // (a slanted end: its upper edge's end moved along the ship, so the end's seam runs on a diagonal)
    const sl = i === 0 ? o.slant0 : i === zs.length - 1 ? o.slant1 : 0; if (sl) { r.b1.z += sl; r.t1.z += sl; }
    return r;
  });
  const F = (pts, out, lk) => facet(acc, pts, out, { inner: false, ...lk });
  for (let i = 0; i < ring.length - 1; i++) {
    const A = ring[i], B = ring[i + 1], n = A.nrm.clone().add(B.nrm).normalize(), dr = A.dir.clone().add(B.dir).normalize();
    F([A.t0, A.t1, B.t1, B.t0], n, o.slashZ == null || (o.slashZ >= zs[i] && o.slashZ < zs[i + 1]) ? look : { ...look, slash: null });
    if (!o.open?.includes('f0')) F([A.b0, A.t0, B.t0, B.b0], dr.clone().negate().addScaledVector(n, 0.3), { paint: E });
    if (!o.open?.includes('f1')) F([A.b1, B.b1, B.t1, A.t1], dr.clone().addScaledVector(n, 0.3), { paint: E });
  }
  const A = ring[0], B = ring[ring.length - 1];
  if (!o.open?.includes('z0')) F([A.b0, A.b1, A.t1, A.t0], V3(0, 0, -1).addScaledVector(A.nrm, 0.3), { paint: E });
  if (!o.open?.includes('z1')) F([B.b0, B.t0, B.t1, B.b1], V3(0, 0, 1).addScaledVector(B.nrm, 0.3), { paint: E });
  return ring;
}
// a point on band k of the shell (m_z z, f across it), standing d out, on side s; and the band's outward normal there
function onBand(s, k, z, f, d = 0) {
  const sec = shellSection(z), a = sec[k], b = sec[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nrm = V3(s * dy / L, -dx / L, 0);
  return { at: V3(s * (a[0] + dx * f), a[1] + dy * f, z).addScaledVector(nrm, d), n: nrm };
}
// the rot [rx, ry, rz] that turns a part's +z to face n (and keeps its up as near up as it can)
function faceRot(n) { const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), n.clone().normalize()), e = new THREE.Euler().setFromQuaternion(q); return [e.x, e.y, e.z]; }
// a glowing strip on a plate's face: from (z0, f0) to (z1, f1) on band k, d out (a piece between each two stations, so
// it follows the shell)
function glowOn(acc, s, k, z0, z1, f0, f1, d, glow) {
  const P = (z, f) => onBand(s, k, z, f, d).at, zs = [z0, ...SHELL.map((q) => q.z).filter((z) => z > z0 + 1e-6 && z < z1 - 1e-6), z1];
  for (let i = 0; i < zs.length - 1; i++) {
    const a = zs[i], b = zs[i + 1], n = onBand(s, k, (a + b) / 2, (f0 + f1) / 2).n, q = orient([P(a, f0), P(b, f0), P(b, f1), P(a, f1)], n);
    if (q) acc.poly(q.pts, q.n, glow, 'glow', 9);
  }
}
// A FLANK'S ARMOUR (drawn for side s): the lower forward cheek on the nose with the blue strip in a dark recess along
// it, carried on past the step behind the canopy to the door's frame; the door's deep dark frame (port); the plates
// over the body's side at two depths; the wing glove (a bulky dark housing from the door back into the pod, a blue lamp
// in its front); the shoulder plates under the crease; the shroud's ribs; the amber lamp on the pod
function exArmour(p, side) {
  const s = side === 'starboard' ? -1 : 1, acc = new Acc(), { side: SIDE, upper: UP, lower: LO, ledge: LEDGE } = BAND, dz = EXPLORER.doorZ;
  // the cheek: on the body's side from the door's frame to the collar, across the collar, and on along the nose's side
  // (its front tapering into the nose, its foot sloping up into the belly), the blue strip in a dark recess along it
  const [c0, c1] = CANOPY.collar;
  plateOn(acc, s, SIDE, 10.3, c0, 0.0, 0.4, 0.3, { paint: W, seams: 'all' }, { cz0: 0.08, cf1: 0.08, cf0: 0.12, edge: D, open: ['z1'] });
  plateOn(acc, s, SIDE, c0, c1, [0.0, 0.05], [0.4, 0.9], 0.3, { paint: W, seams: 'all' }, { cf1: 0.08, cf0: 0.12, edge: D, open: ['z0', 'z1'] });
  plateOn(acc, s, SIDE, c1, 14.9, 0.05, 0.9, 0.22, { paint: W, seams: 'all' }, { d0: 0.3, cz1: 0.5, cf0: 0.16, cf1: 0.06, edge: D, open: ['z0'] });
  plateOn(acc, s, SIDE, 11.9, 14.0, 0.3, 0.6, 0.03, { paint: D }, { off: 0.25, c: 0.015, d0: 0.03 });
  glowOn(acc, s, SIDE, 12.05, 13.85, 0.38, 0.52, 0.29, GLOW_SHIP.strip.map((c) => c * 1.3));
  plateOn(acc, s, SIDE, 10.45, c0 - 0.05, 0.12, 0.26, 0.03, { paint: D }, { off: 0.3, c: 0.015 });
  glowOn(acc, s, SIDE, 10.5, c0 - 0.1, 0.15, 0.23, 0.335, GLOW_SHIP.strip.map((c) => c * 1.3));
  if (s > 0) {
    // the door's deep dark frame: jambs either side and a head over it, standing out 0.22 m (the door's lining runs
    // on 0.3 m into the hull behind it)
    for (const [z0, z1] of [[dz - 0.88, dz - 0.5], [dz + 0.5, dz + 0.88]]) plateOn(acc, s, SIDE, z0, z1, 0, 1, 0.38, { paint: D }, { c: 0.05, cf0: 0, cf1: 0, open: ['f1'] });
    plateOn(acc, s, UP, dz - 0.88, dz + 0.88, 0, 0.26, 0.38, { paint: D }, { c: 0.05, cf0: 0, cz0: 0.3, cz1: 0.3 });
    // (the door's screen beside it: a small panel, his blue display)
    plateOn(acc, s, SIDE, dz - 1.25, dz - 0.95, 0.5, 0.62, 0.05, { paint: D }, { c: 0.01 });
    glowOn(acc, s, SIDE, dz - 1.22, dz - 0.98, 0.52, 0.6, 0.055, GLOW_SHIP.strip.map((c) => c * 0.6));
  }
  // the plates over the body's side: a big one aft of the door (his "Explorer-3" panel, the yellow slashes on it), one
  // forward of the door over the cheek, a small one at the stern's end
  plateOn(acc, s, SIDE, 4.9, dz - 1.32, 0.42, 0.68, 0.13, { paint: W, seams: 'all', slash: SHIP.yellow }, { c: 0.05, edge: D, slashZ: 8.0, slant0: 0.4, slant1: 0 });
  if (s < 0) plateOn(acc, s, SIDE, 8.85, 10.2, 0.42, 0.68, 0.13, { paint: W, seams: 'all' }, { c: 0.05, edge: D, slant0: 0.3 });
  plateOn(acc, s, SIDE, s > 0 ? 10.46 : 10.3, c0 - 0.02, 0.42, 0.68, 0.1, { paint: W2, seams: 'all' }, { c: 0.04, edge: D, slant1: -0.3 });
  plateOn(acc, s, SIDE, 3.7, 4.75, 0.42, 0.68, 0.08, { paint: W2, seams: 'all' }, { c: 0.03, edge: D, slant1: -0.35 });
  // the shoulders: bulky armour along the crease, standing a third of a metre proud, white over a dark underside,
  // sloping in at each end (broken by the door's frame on the port side)
  for (const [z0, z1] of s > 0 ? [[3.1, dz - 1.0]] : [[3.1, CANOPY.back - 0.05]]) sponson(acc, s, z0, z1);
  // white armour carried back over the front of the dark engine section (the colour break not one vertical cut)
  plateOn(acc, s, UP, 2.7, 4.3, 0.08, 0.92, 0.07, { paint: W, seams: 'all' }, { c: 0.04, edge: D, slant0: -0.5 });
  // the wing glove: a bulky dark housing at the wing's root, from just aft of the door's frame back into the pod, its
  // front sloping, a blue lamp in its front
  const g = plateOn(acc, s, SIDE, 3.6, 8.62, -0.05, 0.38, 0.55, { paint: D, seams: 'all' }, { d0: 0.33, c: 0.09, cz1: 0.8, cz0: 0, cf0: 0.16, edge: D });
  plateOn(acc, s, SIDE, 4.2, 7.5, 0.08, 0.3, 0.05, { paint: G, seams: 'all' }, { off: 0.55, c: 0.03 });
  { const f = g[g.length - 1], a = f.t0.clone().lerp(f.t1, 0.25), b = f.t0.clone().lerp(f.t1, 0.75), mid = a.clone().lerp(b, 0.5).add(V3(0, 0, 0.37)), n = V3(0, 0, 1).addScaledVector(f.nrm, 0.75).normalize();
    // (a blue lamp low in its sloping front, facing forward and out)
    placeInto(p, part(lampBar, { w: 0.5, h: 0.09, glow: 'blue' }), { at: mid.toArray(), rot: faceRot(n) }); }
  // a dark keel along the belly, in two steps (deeper aft)
  plateOn(acc, s, BAND.belly, 4.2, 10.4, 0, 0.55, 0.14, { paint: SHIP.frame, seams: 'all' }, { c: 0.04, cz0: 0.3, open: ['f0'] });
  plateOn(acc, s, BAND.belly, 10.4, 13.9, 0, 0.45, 0.08, { paint: SHIP.frame }, { c: 0.03, cz1: 0.3, open: ['f0'] });
  // the shroud's ribs: raised dark bands round it, and the amber lamp on the pod's side
  for (const z of [0.95, 1.75, 2.55]) for (let k = 0; k < 9; k++) plateOn(acc, s, k, z, z + 0.1, 0, 1, 0.04, { paint: SHIP.grey }, { c: 0.01, open: ['f0', 'f1'] });
  { const L = onBand(s, SIDE, 2.15, 0.62, 0.0); placeInto(p, part(floodlight, { w: 0.42, h: 0.13, warm: true }), { at: L.at.toArray(), rot: faceRot(L.n) }); }
  // a light strip along the pod under the fin, blue, and one along the ledge of the cheek forward
  glowOn(acc, s, SIDE, 1.2, 2.9, 0.86, 0.9, 0.004, GLOW_SHIP.strip);
  return acc.flush(p);
}
// A SHOULDER (his bulky armour along the crease): a small loft along the side from z0 to z1 on side s, its section
// (m_x, h) from the side below the crease, out and up over it onto the upper side; its ends sloping in to the hull
// (his coffin shoulders: a hard edge at the widest point, the armour over it sloping steeply up to the roof's edge)
const SPONSON = { full: [[2.99, 1.55], [3.26, 1.68], [3.4, 2.02], [3.3, 2.22], [2.58, 2.87]], foot: [[2.99, 1.55], [3.0, 1.7], [3.0, 2.0], [2.97, 2.2], [2.58, 2.87]] };
function sponson(acc, s, z0, z1) {
  const L = z1 - z0, ea = Math.min(0.45, L * 0.35), eb = Math.min(0.6, L * 0.4);   // (its sloping ends, shorter on a short run)
  // (its line rising toward the bow: the edge and the underside up to 0.16 m higher at the front, the top's foot fixed)
  const lift = (pts, z) => pts.map(([x, y], i) => [x, i < 4 ? y + 0.16 * (z - 3.1) / 6.3 : y]);
  const st = [[z0, SPONSON.foot], [z0 + ea, SPONSON.full], [z1 - eb, SPONSON.full], [z1, SPONSON.foot]].map(([z, pts]) => ({ z, pts: lift(pts, z) }));
  const looks = [{ paint: W2, seams: null }, { paint: W, seams: 'all' }, { paint: D, seams: null }, { paint: W, seams: 'all' }];
  for (let i = 0; i < st.length - 1; i++) for (let k = 0; k < 4; k++) {
    const A = st[i], B = st[i + 1], P = (pt, z) => V3(s * pt[0], pt[1], z), q = [P(A.pts[k], A.z), P(A.pts[k + 1], A.z), P(B.pts[k + 1], B.z), P(B.pts[k], B.z)];
    const out = newell(q).multiplyScalar(s); if (out.lengthSq() < 1e-10) continue;
    facet(acc, q, out, { ...looks[k], paint: i === 1 ? looks[k].paint : k === 0 ? D : W2, inner: false });
  }
}
// a lamp bar: a dark bezel with a glowing face (blue or warm), facing +z
function lampBar(p, o) {
  const a = new Acc(), w = o.w, h = o.h, col = o.glow === 'blue' ? GLOW_SHIP.strip.map((c) => c * 1.3) : GLOW_SHIP.warm;
  box(a, SHIP.frame, [-w / 2 - 0.03, w / 2 + 0.03], [-h / 2 - 0.03, h / 2 + 0.03], [0, 0.04]);
  box(a, col, [-w / 2, w / 2], [-h / 2, h / 2], [0.04, 0.046], 'glow');
  a.flush(p);
  p.light([0, 0, 0.4], 0.35, o.glow === 'blue' ? [0.3, 0.7, 1] : [1, 0.75, 0.4], [0, 0, 1], 2.5);
  return p;
}
// A BLOCK standing on the roof: x0..x1 across, from y0 (its foot, a little into the roof) up to y1, z0..z1 along; its
// top's long edges chamfered c, its front sloping back over `front` metres and its back over `back`; look its top's,
// o.side its sides' paint; o.vents dark vents along its sides' slopes
function block(acc, [x0, x1], [y0, y1], [z0, z1], o = {}) {
  const c = o.c ?? 0.12, fr = o.front ?? 0.3, bk = o.back ?? 0.2, T = o.top ?? W, Sd = o.side ?? W2, E = o.ends ?? D;
  const ln = o.lean ?? 0, sec = (z, k) => [V3(x0, y0, z), V3(x1, y0, z), V3(x1 - ln - k, y1 - c, z), V3(x1 - ln - c - k, y1, z), V3(x0 + ln + c + k, y1, z), V3(x0 + ln + k, y1 - c, z)];
  // (four sections: the foot of the back slope, its top, the top of the front slope, its foot)
  const S = [[z0, sec(z0, 0).map((q, i) => (i < 2 ? q : V3(q.x, y0, z0)))], [z0 + bk, sec(z0 + bk, 0)], [z1 - fr, sec(z1 - fr, 0)], [z1, sec(z1, 0).map((q, i) => (i < 2 ? q : V3(q.x, y0, z1)))]];
  for (let i = 0; i < 3; i++) {
    const A = S[i][1], B = S[i + 1][1];
    for (let k = 1; k < 6; k++) {
      const k1 = (k + 1) % 6, q = [A[k], A[k1], B[k1], B[k]], out = newell(q); if (out.lengthSq() < 1e-10) continue;
      const paint = i === 1 ? (k === 3 ? T : k === 2 || k === 4 ? (o.chamfer ?? T) : Sd) : E;
      facet(acc, q, out, { paint, inner: false, seams: i === 1 && k === 3 && o.seams ? 'all' : null });
    }
  }
  // its ends (if not sloped to nothing): flat
  if (bk < 1e-6) facet(acc, S[0][1], V3(0, 0, -1), { paint: E, inner: false });
  if (fr < 1e-6) facet(acc, S[3][1], V3(0, 0, 1), { paint: E, inner: false });
  // vents: dark slots along the side faces
  // (one long louvred intake along each side's slope: a dark recess, grey louvres across it)
  if (o.vents) for (const sx of [-1, 1]) {
    const yb = Math.max(y0, 3.12), yt = y1 - c, ym = (yb + yt) / 2, h = Math.min(0.12, (yt - yb) * 0.32), xs = (y) => (sx > 0 ? x1 - ln * (y - y0) / (yt - y0) : x0 + ln * (y - y0) / (yt - y0));
    const n = V3(sx * (yt - y0), ln, 0).normalize(), q = (y, z, d = 0.006) => V3(xs(y), y, z).addScaledVector(n, d), za = z0 + bk + 0.2, zb = z1 - fr - 0.25;
    if (h <= 0.03 || zb - za < 0.4) continue;
    acc.poly(orient([q(ym - h, za), q(ym - h, zb), q(ym + h, zb), q(ym + h, za)], n).pts, n, SHIP.frame);
    for (const f of [-0.5, 0, 0.5]) { const y = ym + f * h; acc.poly(orient([q(y - 0.012, za + 0.05, 0.012), q(y - 0.012, zb - 0.05, 0.012), q(y + 0.012, zb - 0.05, 0.012), q(y + 0.012, za + 0.05, 0.012)], n).pts, n, SHIP.grey); }
  }
}
// THE ROOF: his stacked modules from behind the canopy toward the tail, each lower and narrower than the one before:
// the first stepping up behind the canopy (its front sloping toward it, dark vents along its sides, a dark hood with a
// lamp over the canopy), then a white one with dark covers, then the dark shroud's top over the engines
// its section (port half, m_x and h over the roof's foot y0): its foot, the lower layer's side and top, a ledge, the
// dark recess along the upper layer's side, the upper layer's top; at its ends drawn in to its foot
const SPINE = (y0, t1, t2) => [[0, y0], [1.15, y0], [1.02, t1 - 0.06], [0.92, t1], [0.68, t1], [0.6, t2 - 0.05], [0.48, t2], [0, t2 + 0.02]];
function exRoof(p) {
  const acc = new Acc(), z1 = CANOPY.back - 0.05, roof = (z) => shellSection(z)[BAND.top][1] - 0.04;
  const at = (z, t1, t2) => ({ z, pts: SPINE(roof(z), roof(z) + t1, roof(z) + t2) }), foot = (z) => ({ z, pts: SPINE(roof(z), roof(z), roof(z)).map(([x, y], i) => [i < 2 ? x : x * 0.9, y]) });
  const st = [foot(z1), at(z1 - 0.55, 0.22, 0.3), at(9.0, 0.32, 0.5), at(7.2, 0.38, 0.62), at(5.6, 0.36, 0.56), at(4.2, 0.3, 0.42), at(3.1, 0.22, 0.28), foot(2.5)].reverse();
  const D2 = SHIP.frame;
  loft(acc, st, (k) => (k === 0 ? null : { paint: k === 4 ? D2 : k === 2 || k === 5 ? W2 : k === 1 ? W2 : W, inner: false, seams: k === 3 || k === 6 ? 'all' : null }));
  // (a dark intake either side, low on the roof's edge by its front)
  for (const sx of [-1, 1]) block(acc, sx > 0 ? [1.45, 1.9] : [-1.9, -1.45], [3.08, 3.3], [8.6, 10.0], { front: 0.3, back: 0.1, c: 0.05, top: D, side: D });
  // the shroud's top: dark, ribbed, falling to the main engine
  block(acc, [-0.85, 0.85], [2.86, 3.15], [0.9, 3.3], { front: 0.45, back: 0.4, c: 0.1, lean: 0.12, top: D, side: D, chamfer: SHIP.frame, vents: true });
  return acc.flush(p);
}
// THE ENGINES: the main one high in the shroud's back, a side one low each side (his three, nearly filling the rear)
function exEngines(p) {
  const [ex, ey] = EXPLORER.engineAt, [sx, sy] = EXPLORER.sideAt;
  const z = EXPLORER.engineZ, acc = new Acc();
  placeInto(p, part(mainEngine, EXPLORER.engine), { at: [ex, ey, z] });
  for (const s of [1, -1]) placeInto(p, part(mainEngine, EXPLORER.side), { at: [s * sx, sy, z] });
  // (heavy dark rings round each housing: his ribbed shroud)
  for (const [x, y, R, L] of [[ex, ey, EXPLORER.engine.r, EXPLORER.engine.len], [sx, sy, EXPLORER.side.r, EXPLORER.side.len], [-sx, sy, EXPLORER.side.r, EXPLORER.side.len]])
    for (const f of [0.3, 0.5]) { const zc = z - L * f; latheZ(acc, [[R * 0.99, zc + 0.07], [R * 1.05, zc + 0.05], [R * 1.05, zc - 0.05], [R * 0.99, zc - 0.07]], 24, () => SHIP.frame, { at: [x, y, 0] }); }
  // (rings across each nozzle's glowing face, as his)
  for (const [x, y, R, L] of [[ex, ey, EXPLORER.engine.r, EXPLORER.engine.len], [sx, sy, EXPLORER.side.r, EXPLORER.side.len], [-sx, sy, EXPLORER.side.r, EXPLORER.side.len]])
    for (const rr of [0.2, 0.31]) { const zf = z - L + 0.22; latheZ(acc, [[R * (rr - 0.02), zf], [R * (rr + 0.02), zf], [R * (rr + 0.02), zf - 0.03], [R * (rr - 0.02), zf - 0.03], [R * (rr - 0.02), zf]], 24, () => SHIP.frame, { at: [x, y, 0] }); }
  // (a dark lip standing out behind each nozzle, so its face sits sunk in it)
  for (const [x, y, R, L, lp] of [[ex, ey, EXPLORER.engine.r, EXPLORER.engine.len, EXPLORER.lip[0]], [sx, sy, EXPLORER.side.r, EXPLORER.side.len, EXPLORER.lip[1]], [-sx, sy, EXPLORER.side.r, EXPLORER.side.len, EXPLORER.lip[1]]]) {
    const zb = z - L; latheZ(acc, [[R * 0.97, zb - lp], [R * 1.05, zb - lp], [R * 1.05, zb + 0.02], [R * 0.97, zb + 0.02], [R * 0.97, zb - lp]], 24, (i) => (i === 3 ? SHIP.trim : SHIP.frame), { at: [x, y, 0] });
  }
  return acc.flush(p);
}
// A TAIL FIN on the pod (his: the fins stand on the side pods, leaning out): a dark root housing on the pod's top and
// the fin on it; drawn for the port side and mirrored
function exFin(p, side) {
  const s = side === 'starboard' ? -1 : 1, q = new p.constructor(), acc = new Acc(), F = EXPLORER.fin, zc = 1.75;
  // (the housing: a block along the pod's top, its foot on the band's slope, its top level)
  const at = onBand(1, BAND.ledge, zc, 0.85, 0).at, top = at.y + 0.22;
  block(acc, [at.x - 0.24, at.x + 0.24], [at.y - 0.3, top], [zc - F.root / 2 - 0.1, zc + F.root / 2 + 0.25], { front: 0.45, back: 0.12, c: 0.06, top: D, side: D });
  acc.flush(q);
  placeInto(q, part(tailFin, F), { at: [at.x, top - 0.02, zc], rot: [0, 0, -EXPLORER.cant] });
  return placeInto(p, q, { scale: s > 0 ? 1 : [-1, 1, 1] });
}
// THE WING: drawn for the port side, a dark fairing along its root (on the glove's face); the starboard one mirrored,
// its light green
function exWing(p, side) {
  const s = side === 'starboard' ? -1 : 1, q = new p.constructor(), c0 = EXPLORER.wing.root;
  placeInto(q, part(wing, { ...EXPLORER.wing, light: s > 0 ? 'red' : 'green' }), { rot: [0, 0, -EXPLORER.droop] });
  const f = new Acc(); fairing(f, 0.3, 0.62, c0 + 0.3); const g = new p.constructor(); f.flush(g);
  placeInto(q, g, { at: [0, -0.12, c0 / 2 + 0.2] });
  return placeInto(p, q, { scale: s > 0 ? 1 : [-1, 1, 1] });
}
// a dark fairing against a face: a block chamfered top and bottom, `out` m out, `h` tall, `len` long back from z 0, its
// back face at x 0; drawn for the +x side
function fairing(acc, out, h, len) {
  const P = (x, y, z) => V3(x, y, z), c = Math.min(0.18, h * 0.3);
  const sec = (z) => [P(-0.02, 0, z), P(out - c, 0, z), P(out, c, z), P(out, h - c, z), P(out - c, h, z), P(-0.02, h, z)];
  const A = sec(0), B = sec(-len);
  for (let i = 0; i < 5; i++) { const n = A[i + 1].clone().sub(A[i]).cross(P(0, 0, 1)).normalize().negate(); facet(acc, [A[i], A[i + 1], B[i + 1], B[i]], n, { paint: D, inner: false, seams: 'all' }); }
  for (const [S, n] of [[A, P(0, 0, 1)], [B, P(0, 0, -1)]]) facet(acc, S, n, { paint: D, inner: false });
}
// THE NOSE'S LAMPS, as his: a pair on the nose's dark point, a pair low on its cheeks (facing forward and out), and
// blue lights either side of the canopy on the dark step of the body's front
function exNoseLamps(p) {
  const tip = SHELL[SHELL.length - 1];
  for (const s of [-1, 1]) {
    // (two levels: a pair high on the face, a pair low at the chin's corners)
    for (const [x, y, w] of [[0.44, 0.3, 0.2], [0.44, 0.5, 0.2]]) placeInto(p, part(floodlight, { w, h: 0.1, warm: true }), { at: [s * x, y, tip.z + 0.002], rot: [0, 0, 0] });
    // (the angled facets back from the point: a pair high on its cheeks, a pair low on its chin)
    for (const [k, z, f, w] of [[BAND.side, 15.15, 0.55, 0.26]]) {
      const L = onBand(s, k, z, f, 0.01), n = L.n.clone().add(V3(0, 0, 0.9)).normalize();
      placeInto(p, part(floodlight, { w, h: 0.1, warm: true }), { at: L.at.toArray(), rot: faceRot(n) });
    }
  }
  // (a dark jaw plate under the face's lamps)
  const acc = new Acc(); for (const s of [-1, 1]) plateOn(acc, s, BAND.chamfer, 14.0, 15.4, 0.0, 1.0, 0.07, { paint: SHIP.frame }, { c: 0.02, cz1: 0.2 });
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
// the shell's inside face at the deck (h 0): how far out it is at m_z
function insideAtDeck(z, h = -0.035) {
  const sec = shellSection(z);
  for (let k = 0; k < sec.length - 1; k++) { const [x0, y0] = sec[k], [x1, y1] = sec[k + 1]; if (y0 <= h && y1 >= h) { const t = (h - y0) / (y1 - y0 || 1), nx = (y1 - y0) / Math.hypot(x1 - x0, y1 - y0); return x0 + (x1 - x0) * t - (THICK + 0.015) / Math.max(0.3, nx); } }
  return sec[3][0] - THICK;
}
// THE COCKPIT'S DECK: one plate from the bulkhead to the dash's front, its sides on the shell's inside, seams across
// it; a lamp along the bulkhead's top; a dark cover from the dash's front to the windscreen's foot, at the sill (so
// nobody looks down into the nose); the plate closing the bulkhead over the cabin's walls up to the canopy. Frame: the
// shell's own (m_x, h, m_z), placed at (0, 0).
function exCockpitDeck(p) {
  const z0 = 11.0, z1 = 13.75, zs = [z0, ...SHELL.map((q) => q.z).filter((z) => z > z0 + 1e-6 && z < z1), z1], half = zs.map((z) => [insideAtDeck(Math.max(z, CANOPY.collar[0])), z]);
  const outline = [...half.map(([x, z]) => [x, z]), ...half.slice().reverse().map(([x, z]) => [-x, z])];
  const g = p.extrude('grey', outline.map(([x, z]) => [x, -z]), 0.03, 0.004); g.rotateX(-PI / 2); g.translate(0, -0.03, 0);
  const at = (z) => { for (let i = 1; i < half.length; i++) if (z <= half[i][1]) { const t = (z - half[i - 1][1]) / (half[i][1] - half[i - 1][1]); return half[i - 1][0] + (half[i][0] - half[i - 1][0]) * t; } return half[half.length - 1][0]; };
  for (let z = z0 + 0.5; z < z1 - 0.1; z += 0.5) { const hw = at(z); p.slab('black', -hw + 0.04, hw - 0.04, 0, 0.003, z - 0.006, z + 0.006, { r: 0, cell: 0.8 }); }
  // a cabin lamp along the top of the bulkhead behind the seats (the cockpit has no ceiling to carry one), on its plate
  const zb = z0 + FACE + 0.005;
  p.slab('black', -1.45, 1.45, 2.22, 2.34, zb, zb + 0.09, { r: 0.01, cell: 0.8 }); p.glowSlab('soft', -1.4, 1.4, 2.22, 2.225, zb + 0.02, zb + 0.08);
  for (const x of [-1.0, 0, 1.0]) p.light([x, 2.2, z0 + 0.4], 1.0, [1, 0.95, 0.88], [0, -0.6, 0.8], 4.5);
  for (const x of [-1.1, 0, 1.1]) p.light([x, 2.1, 12.8], 1.3, [1.3, 0.8, 0.42], [0, -1, -0.4], 3.5);   // (warm, over the seats)
  // the cover forward of the dash: an apron down the dash's front, then a dark plate at the sill out to the glass
  const acc = new Acc(), zd = EXPLORER.seatsZ + EXPLORER.cockpit.canopy.z + 0.01, y1 = EXPLORER.cockpit.canopy.y - 0.02, zf = CANOPY.foot - 0.1;
  const sillIn = (z) => { const S = shellSection(z)[BAND.upper]; return [S[0] - THICK - 0.05, S[1] - 0.005]; };
  const [w0, ys0] = sillIn(zd), [wm, ysm] = sillIn(14.3), [w1, ys1] = sillIn(zf);
  // (the apron a wall from the deck up to the dash's height, so nothing shows under the cover into the nose; seen past the
  // dash's edge from the seats, and through the windscreen from outside)
  const wd = insideAtDeck(zd), ap = [V3(-wd, 0, zd), V3(wd, 0, zd), V3(w0, ys0, zd), V3(w0, y1, zd), V3(-w0, y1, zd), V3(-w0, ys0, zd)];
  for (const dir of [1, -1]) facet(acc, ap, V3(0, 0, dir), { paint: SHIP.frame, inner: false });
  facet(acc, [V3(-w0, ys0, zd), V3(w0, ys0, zd), V3(wm, ysm, 14.3), V3(-wm, ysm, 14.3)], V3(0, 1, 0), { paint: SHIP.frame, inner: false });
  facet(acc, [V3(-wm, ysm, 14.3), V3(wm, ysm, 14.3), V3(w1, ys1, zf), V3(-w1, ys1, zf)], V3(0, 1, 0), { paint: SHIP.frame, inner: false });
  // the bulkhead round the cabin's walls (which stand 2.5 m tall to m_x 2.5, the cockpit's door between them): the
  // body's section on the walls' faces, less those walls: its top over 2.35 m and a strip each side beyond m_x 2.45
  // (the hull's short ring from here to the canopy's step has its inside faces)
  const o0 = orient(shellLoop(zb).map(([x, y]) => V3(x, y, zb)), V3(0, 0, 1)), loop = insetBy(o0.pts, o0.n, o0.pts.map(() => THICK + 0.012)), lo = -0.05;
  const up = cutY(loop, 2.35, true); if (up.length > 2) facet(acc, up, V3(0, 0, 1), { paint: SHIP.trim, inner: false });
  for (const sx of [-1, 1]) {
    const mid = cutY(cutY(loop, 2.4, false), lo, true), cut = []; for (let i = 0; i < mid.length; i++) { const a = mid[i], b = mid[(i + 1) % mid.length], fa = sx * a.x - 2.45, fb = sx * b.x - 2.45; if (fa >= 0) cut.push(a); if ((fa >= 0) !== (fb >= 0)) cut.push(a.clone().lerp(b, fa / (fa - fb))); }
    if (cut.length > 2) facet(acc, cut, V3(0, 0, 1), { paint: SHIP.trim, inner: false });
  }
  acc.flush(p);
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
// the aft one leaving the side door's leaf its slot (0.20 to 0.23 m in from the hull, up to the leaf's top, 2.06 m); a
// ceiling plate at 2.44 m; a dark sill plate with hazard stripes, under the hull door's own sill. Frame: on the cabin's
// wall line (x 0) at the doorway's middle (z 0), the hull toward +x, the deck y 0; the door 1.0 m along z.
function exPorch(p) {
  const hw = 0.5, T = 0.03, slot = 0.19, leafTop = 2.06, top = 2.44;
  // (its outer edge on the shell's inside: straight up to the crease at 2.12 m, then leaning in with the upper side)
  const full = [[0, 0], [0.35, 0], [0.42, 0.06], [0.42, 2.12], [0.24, top], [0, top]];
  const aft = [[0, 0], [slot, 0], [slot, leafTop], [0.42, leafTop], [0.42, 2.12], [0.24, top], [0, top]];
  // (plates in the x-y plane, a little thick along z: the aft one at the door's aft edge, the fore one at its fore edge)
  p.extrude('white', aft, T, 0.004).translate(0, 0, -hw);
  p.extrude('white', full, T, 0.004).translate(0, 0, hw - T);
  p.slab('white2', 0, 0.23, top - 0.01, top, -hw, hw, { r: 0, cell: 0.6 });
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
const GR = 'Ships';
export const SHIP_EXPLORER = {
  exShell: { name: 'Explorer C: shell and canopy', group: GR, at: 'free', foot: [7, 3.8, 16], variants: ['hull'], build: exShell },
  exArmour: { name: 'Explorer C: a flank\'s plates and housings', group: GR, at: 'free', foot: [1, 3, 12], variants: ['port', 'starboard'], build: exArmour },
  exRoof: { name: 'Explorer C: roof modules', group: GR, at: 'free', foot: [3.4, 0.5, 10], variants: ['modules'], build: exRoof },
  exEngines: { name: 'Explorer C: the three engines', group: GR, at: 'free', foot: [6.8, 2.8, 1.8], variants: ['three'], build: exEngines },
  exFin: { name: 'Explorer C: tail fin', group: GR, at: 'free', foot: [0.6, 2.5, 3], variants: ['port', 'starboard'], build: exFin },
  exWing: { name: 'Explorer C: wing', group: GR, at: 'free', foot: [3.6, 0.8, 5], variants: ['port', 'starboard'], build: exWing },
  exNoseLamps: { name: 'Explorer C: nose lamps', group: GR, at: 'free', foot: [5, 1, 5], variants: ['lamps'], build: exNoseLamps },
  exCockpit: { name: 'Explorer C: cockpit', group: GR, at: 'free', foot: [4, 1.4, 3], variants: ['three seats'], build: exCockpit },
  exCockpitDeck: { name: 'Explorer C: cockpit deck', group: GR, at: 'free', foot: [5, 0.1, 3], variants: ['deck'], build: exCockpitDeck },
  exDoor: { name: 'Explorer C: doorway in a 2 m panel', group: GR, at: 'free', foot: [2, 2.5, 0.3], variants: ['2 m'], build: (p) => doorway(p, { w: 2 }) },
  exCeiling: { name: 'Explorer C: ceiling run', group: GR, at: 'free', foot: [2, 0.3, 2], variants: ['2 x 2', 'lit 2 x 2', 'unlit 2 x 2'], accepts: (v) => !!runOf(v.replace(/^(un)?lit /, '')),
    build: (p, v) => ceilingRun(p, { ...(runOf(v.replace(/^(un)?lit /, '')) || { len: 2, wid: 2 }), tile: 2, lights: /^lit /.test(v) ? 1 : /^unlit /.test(v) ? 0 : 2 }) },
  exWalk: { name: 'Explorer C: corridor floor', group: GR, at: 'free', foot: [2, 0.1, 1], variants: ['2 x 1'], accepts: (v) => !!runOf(v), build: (p, v) => floorRun(p, { ...(runOf(v) || { len: 2, wid: 1 }), v: 'walk', tile: 2 }) },
  exWall: { name: 'Explorer C: wall run', group: GR, at: 'free', foot: [2, 2.5, 0.3], variants: ['2.5 m', 'bare 2.5 m', 'flat 2 m'], accepts: (v) => !!lenOf(v.replace(/^(bare|flat) /, '')), build: (p, v) => exWall(p, v) },
  exPorch: { name: 'Explorer C: the airlock\'s porch', group: GR, at: 'free', foot: [0.5, 2.5, 1], variants: ['porch'], build: exPorch },
  exBunk: { name: 'Explorer C: bunk bed', group: GR, at: 'free', foot: [2.4, 2.5, 1], variants: ['set in'], build: (p) => bunkBed(p, { len: 2.4 }) },
  exWallKit: { name: 'Explorer C: wall kit', group: GR, at: 'free', foot: [0.5, 1, 0.3], variants: Object.keys(KIT), build: exWallKit },
  exTanks: { name: 'Explorer C: tanks', group: GR, at: 'free', foot: [2, 2, 0.7], variants: ['pair'], build: exTanks },
  exShelves: { name: 'Explorer C: shelves', group: GR, at: 'free', foot: [2, 2, 0.5], variants: ['1.5 m', '2 m'], accepts: (v) => !!lenOf(v), build: (p, v) => exShelves(p, lenOf(v) || 2) },
  exMark: { name: 'Explorer C: floor edge', group: GR, at: 'free', foot: [2, 0.1, 0.1], variants: ['2 m'], accepts: (v) => !!lenOf(v), build: (p, v) => exMark(p, lenOf(v) || 2) },
};
