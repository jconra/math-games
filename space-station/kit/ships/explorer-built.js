// EXPLORER C, BUILT: the ship's own parts, on the 3,000-triangle smart mesh made from the game's maker's picture. The
// hull is that mesh as it is (cleaned only where it had to be: its data is explorer-built.hull.js, made by the rig
// ~/pw/space-math/rigs/explorer-built/makehull.mjs); its landing legs are cut from the 8,000-triangle one. Everything
// is painted in flat colours from a small palette, face by face, by the rules below (so every colour line falls on an
// edge of the model), and a grime material (grimeMaterials, at the end) adds the dirt over that clean base.
// The ship itself is the layout file kit/rooms/ship-explorer-built.json; these are the catalog pieces it names
// (group 'Ships'). Frame: nose +z, the ship's left (port) +x; each piece is drawn standing on the cabin's deck (y 0 at
// DECK, 1.74 m off the ground: the doorway's sill), centred on the ship's middle (x 0, z 0).
//   ebHull       'hull'      the 3k hull, painted by RULES (and ZONES, which split a few faces where a colour line
//                            must cross one: the dark lower band, the wings' flaps and yellow tips, the fins' rudders
//                            and stripes, the engines' blue rings)
//   ebCanopy     'glass'     its canopy: each flat facet a pane of smoked glass (faces nearly in one plane are one
//                            pane), one black spar along every edge between panes and round the sill: all one part,
//                            the spar, placed again and again
//   ebMarks      'marks'     what is laid on the skin: the blue light strips, the nose's lamps, the yellow marks by the
//                            door, the nav lights
//   ebDoorway    'port' / 'starboard'   a doorway's sides and sill; port: the airlock behind it (its floor, walls,
//                            ceiling and inner door); starboard: the sealed hatch in it
//   ebAirstair   'port'      the airstair door: one panel hinged at its foot, its steps and side rails on its inside
//                            face; it swings out and down to the ground as someone comes near (a kit door)
//   ebGear       'nose' / 'port' / 'starboard'   a landing leg (its strut, and its foot, which turns at the ankle as it
//                            folds into its well): kit door leaves on hinges, door 'gear' (no one opens it by walking
//                            up: the game, or the lab's Gear up / down, moves it)
//   ebGearDoors  'nose' / 'port' / 'starboard'   a well's two doors: the belly skin cut out of it, hinged at its edges
//   ebWells      'wells'     the three wells' walls and ceilings
//   ebCockpit    'two seats' the cockpit: two bucket seats side by side, the throttle pedestal between them, the
//                            dashboard and side consoles, under the canopy, in its tub (floor, walls up to the sill,
//                            the bulkhead behind)
import * as THREE from 'three';
import { Acc } from '../shipparts/outside/facet.js';
import { part, placeInto } from '../shipparts/place.js';
import { GLOW_SHIP } from '../shipparts/palette.js';
import { SURF, U as KU, kitTextures } from '../materials.js';
import { HULL, GEAR, DOORS, WELLS, JAMBS, DOOR, PARTS, Q } from './explorer-built.hull.js';
import { cockpitPlan, BUILDS } from '../shipparts/cockpit/set.js';

const PI = Math.PI, V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const DECK = DOOR.sill;   // the cabin's deck, metres off the ground (the doorway's sill)

// ── THE PALETTE: flat colours (sRGB), each with its roughness, metalness and wear (wear: how much grime it takes;
// 'edge' versions of a colour take more, for the thin faces along exposed edges) ─────────────────────────────────────
const s = (c, r, m, w) => ({ c, r, m, w });
export const PAL = {
  skin: s('#dedcd5', 0.5, 0.04, 0.45),       // white skin
  skinEdge: s('#dedcd5', 0.5, 0.04, 1.0),
  black: s('#1c1e22', 0.42, 0.3, 0.35),      // window spars, flaps, rudders
  blackEdge: s('#1c1e22', 0.42, 0.3, 0.9),
  belly: s('#80858c', 0.55, 0.2, 0.7),       // the grey belly
  trim: s('#3a3e44', 0.48, 0.3, 0.55),       // dark trim: the lower sides, the roof modules' sides, the engines
  trimEdge: s('#3a3e44', 0.48, 0.3, 1.0),
  yellow: s('#e8b923', 0.45, 0.02, 0.45),    // his yellow accents
  metal: s('#6d7177', 0.4, 0.6, 0.6),        // the landing legs' struts
  rubber: s('#202225', 0.85, 0.0, 0.5),      // the feet's pads
  inner: s(SURF.white[0], SURF.white[1], SURF.white[2], 0.35),   // inside: the station's own off-white
  deck: s('#55595f', 0.6, 0.3, 0.6),         // the airlock's and cockpit's floors
};
export const GLOW = { strip: GLOW_SHIP.strip, nozzle: [0.1, 0.7, 1.8], ring: [0.4, 2.8, 6.4], warm: GLOW_SHIP.warm, red: [6.0, 0.5, 0.3], green: [0.5, 5.0, 1.4], white: [4, 4, 4] };

// ── the data, decoded once ──────────────────────────────────────────────────────────────────────────────────────────
function bytes(b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
const ints = (b64, T) => new T(bytes(b64));
function mesh(d) { const p = ints(d.pos, Int16Array), pos = new Float32Array(p.length); for (let i = 0; i < p.length; i++) pos[i] = p[i] / Q; return { pos, tris: ints(d.tris, Uint16Array) }; }
const at = (M, i) => V3(M.pos[i * 3], M.pos[i * 3 + 1], M.pos[i * 3 + 2]);
// (a point in the ship's frame to the pieces' frame: on the deck)
const dk = (v) => V3(v.x, v.y - DECK, v.z);

// ── PAINTING THE HULL ───────────────────────────────────────────────────────────────────────────────────────────────
// (the fin's edges, measured on the 3k's port fin, in its own (z, y) plane: the leading edge runs from (z -2.97, y 4.58)
// up and back to (-5.30, 6.20), the trailing edge from (-5.97, 4.60) to (-6.91, 6.25); le and te are the constants of
// the lines along them: behind the leading edge by d where 0.821 y + 0.571 z = le - d, ahead of the trailing edge by
// d where 0.495 y + 0.869 z = d - te)
const FIN = { le: 0.821 * 4.58 + 0.571 * -2.97, te: -(0.495 * 4.6 + 0.869 * -5.97) };
// ZONES first: where a colour line must cross a face, the faces of those parts are cut along the zone's planes, and
// what lies inside them all is in that zone (for the rules below). Each plane is [a, b, c, d]: inside where
// a|x| + b y + c z <= d (|x|: both sides of the ship alike). A later zone may take a piece from an earlier one.
export const ZONES = [
  // the hull's lower band: everything under a line from 2.63 m at the stern down to 2.14 m at the nose's tip, his dark
  // lower hull under the white (one straight colour line along each side)
  { zone: 'lower', parts: ['body', 'keel', 'other'], planes: [[0, 1, 0.035, 2.42]] },
  // the wings: a black flap along the trailing edge (0.85 to 1.1 m deep), a yellow tip ahead of it
  { zone: 'flap', parts: ['wing'], planes: [[0, 0, 1, -5.35]] },
  { zone: 'tip', parts: ['wing'], planes: [[-1, 0, 0, -5.75], [0, 0, -1, 5.35]] },
  // the fins: the black rudder, 0.55 m deep along the trailing edge (TE: how far ahead of it, along its normal in the
  // fin's plane); two yellow stripes along the leading edge, his "//" (LE: how far behind it), stopping short of the
  // rudder
  { zone: 'rudder', parts: ['fin'], planes: [[0, 0.495, 0.869, -FIN.te + 0.55]] },
  ...[[0.42, 0.56], [0.7, 0.84]].map(([a, b]) => ({ zone: 'stripe', parts: ['fin'], planes: [[0, 0.821, 0.571, FIN.le - a], [0, -0.821, -0.571, b - FIN.le], [0, -0.495, -0.869, FIN.te - 0.65]] })),
  // the engines: a glowing blue ring round each, a hand's width ahead of the taper
  { zone: 'ring', parts: ['engine'], planes: [[0, 0, 1, -7.58], [0, 0, -1, 7.76]] },
];
// RULES then, for every face in order: the first that matches paints it. f: { part, zone, n (unit normal), c (centre),
// area, thin (a narrow face: an edge strip) }
const edge = (paint) => (f) => (f.thin ? paint + 'Edge' : paint);
export const RULES = [
  ['the canopy: glass', (f) => f.part === 'canopy', 'glass'],
  ['engines: the dish at the back glows', (f) => f.part === 'engine' && f.c.z < -8.2 && f.n.z < -0.6, 'nozzle'],
  ['engines: the blue ring', (f) => f.zone === 'ring', 'ring'],
  ['engines and their pylons: dark', (f) => f.part === 'engine' || f.part === 'pylon', edge('trim')],
  ['wings: the flaps black', (f) => f.zone === 'flap', edge('black')],
  ['wings: the tips yellow', (f) => f.zone === 'tip', 'yellow'],
  ['wings: undersides grey', (f) => f.part === 'wing' && f.n.y < -0.35, 'belly'],
  ['wings: edges dark', (f) => f.part === 'wing' && Math.abs(f.n.y) < 0.35, 'trimEdge'],
  ['fins: the rudders black', (f) => f.zone === 'rudder', edge('black')],
  ['fins: the stripes yellow', (f) => f.zone === 'stripe', 'yellow'],
  ['fins: edges dark', (f) => f.part === 'fin' && f.thin, 'trimEdge'],
  ['the belly: grey', (f) => f.n.y < -0.55 && f.part !== 'roof', 'belly'],
  ['the lower band: dark', (f) => f.zone === 'lower', edge('trim')],
  ['the roof modules\' sides: dark', (f) => f.part === 'roof' && f.n.y < 0.55, edge('trim')],
  ['the small blocks: dark', (f) => f.part === 'keel' || f.part === 'other', 'trim'],
  ['everything else: white skin', () => true, edge('skin')],
];

// a convex polygon (Vector3s) cut by a plane (on |x|): [inside, outside]
function clipPlane(P, [a, b, c, d]) {
  const f = (p) => a * Math.abs(p.x) + b * p.y + c * p.z - d, inn = [], out = [];
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length], fp = f(p), fq = f(q);
    if (fp <= 0) inn.push(p); if (fp >= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) { const t = fp / (fp - fq), r = p.clone().lerp(q, t); inn.push(r); out.push(r.clone()); }
  }
  const clean = (Q) => Q.filter((v, i) => v.distanceTo(Q[(i + 1) % Q.length]) > 1e-7);
  return [clean(inn), clean(out)];
}
const fan = (P) => { const out = []; for (let i = 1; i < P.length - 1; i++) out.push([P[0], P[i], P[i + 1]]); return out; };
const tnorm = ([A, B, C]) => B.clone().sub(A).cross(C.clone().sub(A));
let FACES = null;
// the hull's faces, cut by the zones and painted: [{ pts: [A, B, C] (ship frame), n, c, part, zone, paint }]
export function hullFaces() {
  if (FACES) return FACES;
  const M = mesh(HULL), part = new Uint8Array(bytes(HULL.part));
  let faces = [];
  for (let t = 0; t < M.tris.length / 3; t++) {
    const pts = [0, 1, 2].map((k) => at(M, M.tris[t * 3 + k])), nn = tnorm(pts), area = nn.length() / 2;
    if (area < 1e-9) continue;
    faces.push({ pts, part: PARTS[part[t] & 0x7f], back: !!(part[t] & 0x80), zone: null });
  }
  for (const R of ZONES) {
    const next = [];
    for (const f of faces) {
      if (!R.parts.includes(f.part)) { next.push(f); continue; }
      // (peel off what lies outside each plane; what is left is inside them all)
      let rest = f.pts; const outside = [];
      for (const pl of R.planes) { const [i, o] = clipPlane(rest, pl); if (o.length > 2) outside.push(o); rest = i; if (rest.length < 3) break; }
      if (rest.length < 3) { next.push(f); continue; }
      if (!outside.length) { next.push({ ...f, zone: R.zone }); continue; }
      for (const P of outside) for (const tr of fan(P)) next.push({ ...f, pts: tr });
      for (const tr of fan(rest)) next.push({ ...f, pts: tr, zone: R.zone });
    }
    faces = next;
  }
  FACES = faces.map((f) => {
    const nn = tnorm(f.pts), area = nn.length() / 2, n = nn.normalize(), c = f.pts[0].clone().add(f.pts[1]).add(f.pts[2]).multiplyScalar(1 / 3);
    // (thin: a long narrow strip, its width under 12 cm: the faces along the edges of plates and wings)
    const longest = Math.max(f.pts[0].distanceTo(f.pts[1]), f.pts[1].distanceTo(f.pts[2]), f.pts[2].distanceTo(f.pts[0]));
    const g = { ...f, n, c, area, thin: 2 * area / longest < 0.12 };
    const rule = RULES.find(([, test]) => test(g));
    g.paint = typeof rule[2] === 'function' ? rule[2](g) : rule[2];
    return g;
  }).filter((f) => f.area > 1e-7);
  return FACES;
}
// a face's paint as a surface for the solid material, or a glow
const GLOWS = { nozzle: GLOW.nozzle, ring: GLOW.ring };
function ebHull(p) {
  const acc = new Acc();
  for (const f of hullFaces()) {
    if (f.paint === 'glass') continue;
    const tri = [f.pts.map(dk)];
    if (GLOWS[f.paint]) acc.tris(tri, f.n, GLOWS[f.paint], 'glow'); else acc.tris(tri, f.n, PAL[f.paint]);
    // (its back, dark, where a crack in the skin lets its inside be seen)
    if (f.back) acc.tris([[tri[0][0], tri[0][2], tri[0][1]]], f.n.clone().negate(), PAL.trim);
  }
  acc.flush(p);
  // (the engines light the hangar floor behind them a little, and the nozzles their own dishes)
  for (const sx of [1, -1]) p.light([sx * 2.32, 3.49 - DECK, -8.9], 0.6, [0.3, 0.6, 1.0], [0, 0, -1], 3);
  return p;
}

// ── THE CANOPY ──────────────────────────────────────────────────────────────────────────────────────────────────────
// its faces gathered into panes: neighbours (sharing an edge) whose planes are within PANE_DEG of each other are one
// pane; the spars go along every edge between two panes and along the canopy's own outline (the sill)
export const CANOPY = { paneDeg: 3, pairDeg: 24, spar: { w: 0.06, out: 0.035, in: 0.03 }, layers: 2 };
let PANES = null;
export function canopyPanes() {
  if (PANES) return PANES;
  const F = hullFaces().filter((f) => f.paint === 'glass'), key = (v) => [v.x, v.y, v.z].map((q) => Math.round(q * 2000)).join(',');
  const edges = new Map();
  F.forEach((f, i) => { for (let e = 0; e < 3; e++) { const a = key(f.pts[e]), b = key(f.pts[(e + 1) % 3]), k = a < b ? a + '|' + b : b + '|' + a; let E = edges.get(k); if (!E) edges.set(k, (E = { a: f.pts[e], b: f.pts[(e + 1) % 3], faces: [] })); E.faces.push(i); } });
  const par = F.map((_, i) => i), find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; }, cos = Math.cos(CANOPY.paneDeg * PI / 180);
  for (const E of edges.values()) if (E.faces.length === 2 && F[E.faces[0]].n.dot(F[E.faces[1]].n) > cos) par[find(E.faces[0])] = find(E.faces[1]);
  // (then the 3k's triangles paired into four-sided panes, the flattest pairs first, where the two make a convex quad
  // bent less than pairDeg along its diagonal: the frame then runs in rails and posts, as his canopy's, not a web of
  // triangles; the pane's glass keeps the two triangles)
  const size = new Map(); F.forEach((_, i) => { const r = find(i); size.set(r, (size.get(r) || 0) + 1); });
  const cand = [...edges.values()].filter((E) => E.faces.length === 2 && find(E.faces[0]) !== find(E.faces[1])).map((E) => ({ E, d: F[E.faces[0]].n.dot(F[E.faces[1]].n) })).sort((a, b) => b.d - a.d);
  const pcos = Math.cos(CANOPY.pairDeg * PI / 180);
  for (const { E, d } of cand) {
    const [i, j] = E.faces; if (d < pcos || size.get(find(i)) !== 1 || size.get(find(j)) !== 1) continue;
    // (convex: the two corners off the shared edge lie either side of it, and the quad's corners all turn one way)
    const oi = F[i].pts.find((v) => v.distanceTo(E.a) > 1e-6 && v.distanceTo(E.b) > 1e-6), oj = F[j].pts.find((v) => v.distanceTo(E.a) > 1e-6 && v.distanceTo(E.b) > 1e-6);
    const q = [E.a, oi, E.b, oj], nn = F[i].n.clone().add(F[j].n);
    const turn = (k) => Math.sign(q[(k + 1) % 4].clone().sub(q[k]).cross(q[(k + 2) % 4].clone().sub(q[(k + 1) % 4])).dot(nn));
    if (![1, 2, 3].every((k) => turn(k) === turn(0))) continue;
    const r = find(i); par[r] = find(j); size.set(find(j), 2);
  }
  const pane = F.map((_, i) => find(i));
  // the spar lines: an edge with one face (the outline) or two faces of different panes
  const spars = [];
  for (const E of edges.values()) {
    if (E.faces.length === 2 && pane[E.faces[0]] === pane[E.faces[1]]) continue;
    const n = E.faces.reduce((s2, i) => s2.add(F[i].n), V3(0, 0, 0)).normalize();
    spars.push({ a: E.a, b: E.b, n, outline: E.faces.length === 1 });
  }
  PANES = { faces: F, pane, spars, panes: new Set(pane).size };
  return PANES;
}
// THE SPAR: one part, a black bar 1 m long along z, w across (x), standing `out` out of the glass and `in` into it (y
// is out of the glass); placed along each spar line, stretched to its length (and its width more, so the bars meet
// and overlap at every joint: none stops short)
export function spar(p) {
  const { w, out, in: dep } = CANOPY.spar, acc = new Acc(), x0 = -w / 2, x1 = w / 2, y0 = -dep, y1 = out, z0 = -0.5, z1 = 0.5;
  const q = (pts, n) => acc.poly(pts.map((a) => V3(...a)), V3(...n), PAL.blackEdge, 'solid', 99);
  q([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);      // its face
  q([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);      // its sides
  q([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0]);
  q([[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], [0, -1, 0]);     // its back (seen from inside)
  return acc.flush(p);
}
const _m = new THREE.Matrix4(), _e = new THREE.Euler();
function ebCanopy(p) {
  const { faces, spars } = canopyPanes(), acc = new Acc(), L = CANOPY.layers;
  // the glass: each face, a few layers deep (smoked), each with a face each way (seen from outside and from the seats)
  for (const f of faces) for (let k = 0; k < L; k++) {
    const P = f.pts.map((v) => dk(v).addScaledVector(f.n, -0.006 - 0.008 * k));
    acc.tris([P], f.n, null, 'glass'); acc.tris([[P[0], P[2], P[1]]], f.n.clone().negate(), null, 'glass');
  }
  acc.flush(p);
  const S = part(spar), w = CANOPY.spar.w;
  for (const sp of spars) {
    const a = dk(sp.a), b = dk(sp.b), along = b.clone().sub(a), len = along.length(); if (len < 0.01) continue;
    const z = along.normalize(), y = sp.n.clone().addScaledVector(z, -sp.n.dot(z)).normalize(), x = y.clone().cross(z);
    _m.makeBasis(x, y, z); _e.setFromRotationMatrix(_m);
    placeInto(p, S, { at: a.clone().add(b).multiplyScalar(0.5).toArray(), rot: [_e.x, _e.y, _e.z], scale: [1, 1, len + w] });
  }
  return p;
}

// ── LIGHTS AND MARKS laid on the skin ─────────────────────────────────────────────────────────────────────────────
// Each is placed where it says on the ship's side (or front), then dropped onto the skin there: a ray in from outside
// finds the face, the mark lies 1 cm off it. Both sides alike unless it says.
export const MARKS = {
  // his blue light strips: the long one along each cheek under the canopy, a short one ahead of each wing's root
  strips: [{ z: [4.0, 6.7], y: 2.47, h: 0.075 }, { z: [-0.95, 0.05], y: 2.62, h: 0.06 }],
  // his nose lamps: two each side on the nose's face (warm)
  lamps: [{ x: 0.36, y: 2.33, w: 0.24, h: 0.08 }, { x: 0.78, y: 2.36, w: 0.22, h: 0.08 }],
  // his yellow "//" by the door, aft of it, on the white side (z of the bars' feet, how they lean, their height)
  slashes: { z: [-0.25, -0.02], y: [2.95, 3.45], lean: -0.22, w: 0.13 },
};
// the first face a ray meets (the hull's own, not its glass): { p, n } or null
function rayHull(o, d) {
  let best = null, bt = 1e9;
  for (const f of hullFaces()) {
    if (f.paint === 'glass') continue;
    const [A, B, C] = f.pts, e1 = B.clone().sub(A), e2 = C.clone().sub(A), pv = d.clone().cross(e2), det = e1.dot(pv);
    if (Math.abs(det) < 1e-12) continue;
    const tv = o.clone().sub(A), u = tv.dot(pv) / det; if (u < 0 || u > 1) continue;
    const qv = tv.clone().cross(e1), v = d.dot(qv) / det; if (v < 0 || u + v > 1) continue;
    const t = e2.dot(qv) / det; if (t > 1e-4 && t < bt) { bt = t; best = { p: o.clone().addScaledVector(d, t), n: f.n.clone().dot(d) > 0 ? f.n.clone().negate() : f.n.clone() }; }
  }
  return best;
}
// a point on the side s of the skin at (y, z), lifted `lift` off it
const onSide = (s, y, z, lift = 0.012) => { const h = rayHull(V3(s * 8, y, z), V3(-s, 0, 0)); return h ? h.p.addScaledVector(h.n, lift) : null; };
function ebMarks(p) {
  const acc = new Acc();
  for (const s of [1, -1]) {
    // the strips: a band between two lines along the skin, in short runs so it follows the faces
    for (const S of MARKS.strips) {
      const n = Math.max(2, Math.ceil((S.z[1] - S.z[0]) / 0.25));
      for (let i = 0; i < n; i++) {
        const za = S.z[0] + (S.z[1] - S.z[0]) * i / n, zb = S.z[0] + (S.z[1] - S.z[0]) * (i + 1) / n;
        const q = [onSide(s, S.y - S.h / 2, za), onSide(s, S.y - S.h / 2, zb), onSide(s, S.y + S.h / 2, zb), onSide(s, S.y + S.h / 2, za)];
        if (q.some((v) => !v)) continue;
        acc.poly(q.map(dk), V3(s, 0, 0), GLOW.strip, 'glow', 99);
      }
      p.light([s * 3.0, S.y - DECK, (S.z[0] + S.z[1]) / 2], 0.25, [0.3, 0.6, 1], [s, -0.3, 0], 2.0);
    }
    // the yellow slashes (two bars, leaning back)
    const L = MARKS.slashes;
    for (const z0 of L.z) {
      const q = [onSide(s, L.y[0], z0), onSide(s, L.y[0], z0 + L.w), onSide(s, L.y[1], z0 + L.w + L.lean), onSide(s, L.y[1], z0 + L.lean)];
      if (q.every((v) => v)) acc.poly(q.map(dk), V3(s, 0, 0), PAL.yellow, 'solid', 99);
    }
    // the nose lamps: on the nose's face, a ray back from in front
    for (const Lm of MARKS.lamps) {
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const h = rayHull(V3(s * Lm.x + a * Lm.w / 2, Lm.y + b * Lm.h / 2, 12), V3(0, 0, -1)); return h ? h.p.addScaledVector(h.n, 0.012) : null; });
      if (c.every((v) => v)) acc.poly(c.map(dk), V3(0, 0, 1), GLOW.warm, 'glow', 99);
    }
  }
  // nav lights: red on the port wingtip, green on the starboard, white on each fin's top (small glowing blocks)
  const nav = (at, col) => boxAtGlow(acc, at, 0.05, col);
  nav(V3(6.44, 1.33, -4.86), GLOW.red); nav(V3(-6.44, 1.33, -4.86), GLOW.green);
  for (const s of [1, -1]) nav(V3(s * 3.13, 6.27, -6.92), GLOW.white);
  acc.flush(p);
  p.light([0, 2.35 - DECK, 9.0], 0.9, [1.2, 0.95, 0.6], [0, -0.2, 1], 5);
  return p;
}
// a small glowing cube (h half its side) at a point (ship frame)
function boxAtGlow(acc, c, h, col) {
  for (const [u, v, w] of [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]]) {
    const n = V3(...u), a = V3(...v).multiplyScalar(h), b = V3(...w).multiplyScalar(h), o = c.clone().addScaledVector(n, h);
    acc.poly([o.clone().sub(a).sub(b), o.clone().add(a).sub(b), o.clone().add(a).add(b), o.clone().sub(a).add(b)].map(dk), n, col, 'glow', 99);
  }
}
// ── THE COCKPIT ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The cockpit family's parts (kit/shipparts/cockpit), as its sample cockpit puts them (cockpitPlan), fitted under this
// canopy: two bucket seats side by side in the ship's colours (the pilot on the left, port), the throttle pedestal
// between them, pedals, the dashboard, and a side console each side; no overheads (the glass is the roof), no engineer's
// seat (two seats), no handholds or locker (no walls to hang them on). Its floor stands FLOOR over the deck (as the
// blueprints have it, over the nose leg); the seats' middles at SEATS_Z. The windscreen: its foot (the lowest glass
// ahead) and how far ahead, measured on the canopy. The dash is lower than the family's own (1.0 m, its lip 0.64 m
// over the floor, 0.45 m from the seats' middles, so the switches stay in easy reach): low enough that the nose, not
// the dash, sets the look down ahead (about 9 degrees below level). Its deck runs 1.8 m forward (the family's would run
// on to the windscreen's foot, 2.6 m: its ends, which fan out, would come through the nose's sides); the tub's dark
// floor shows ahead of it, under the chin of the glass.
export const COCKPIT = { floor: 0.3, seatsZ: 4.9, wallX: 1.3, gap: 0.45, dash: { w: 2.0, h: 1.0, knee: 0.64, bow: 0.15, depth: 1.8 }, canopy: { y: 2.64 - DECK - 0.3, z: 8.0 - 4.9, slope: 0.7 }, tubX: 1.5 };
export const COCKPIT_DROP = /^overhead|^handhold|^engineer|^locker/;
export function builtCockpitPlan() {
  const C = COCKPIT, plan = cockpitPlan({ seats: 2, gap: C.gap, wallX: C.wallX, canopy: C.canopy, seat: { shape: 'bucket', look: 'ship' }, dash: { ...C.dash } });
  plan.items = plan.items.filter((it) => !COCKPIT_DROP.test(it.name));
  plan.reach = plan.reach.filter((r) => !COCKPIT_DROP.test(r.name));
  return plan;
}
function ebCockpit(p) {
  const C = COCKPIT, place = (at) => [at[0], at[1] + C.floor, at[2] + C.seatsZ];
  for (const it of builtCockpitPlan().items) placeInto(p, part(BUILDS[it.build], it.opts), { at: place(it.at), rot: it.rot, scale: it.scale });
  // THE TUB: everything under the glass closed, so no gap shows the sky from the seats (and nobody sees into the empty
  // hull through the canopy): from every edge of the canopy's outline a dark wall down and in to the floor, which
  // reaches out to them (no wider than tubX each side); the bulkhead behind with the cabin's door in it, shut
  const acc = new Acc(), fy = DECK + C.floor, out = canopyPanes().spars.filter((sp) => sp.outline);
  // (a wall's foot: under its edge, but no wider than tubX, nor than the hull there less 10 cm: a ray out from the
  // middle line at the floor's height finds the hull's inside)
  const inside = new Map(), halfAt = (s, z) => { const k = s + ':' + z.toFixed(3); if (!inside.has(k)) { const h = rayHull(V3(0, fy + 0.04, z), V3(s, 0, 0)); inside.set(k, h ? Math.abs(h.p.x) - 0.1 : 0); } return inside.get(k); };
  const foot = (v) => { const s = Math.sign(v.x) || 1; return V3(s * Math.max(0, Math.min(Math.abs(v.x), C.tubX, halfAt(s, v.z))), fy, v.z); };
  const ctr = out.reduce((s2, sp) => s2.add(sp.a).add(sp.b), V3(0, 0, 0)).multiplyScalar(1 / (2 * out.length));
  for (const sp of out) {
    const q = [sp.a, sp.b, foot(sp.b), foot(sp.a)], n = tnorm(q.slice(0, 3)).lengthSq() > 1e-10 ? tnorm(q.slice(0, 3)).normalize() : tnorm([q[0], q[2], q[3]]).normalize();
    // (facing into the cockpit)
    const mid = sp.a.clone().add(sp.b).multiplyScalar(0.5); if (n.dot(V3(ctr.x - mid.x, 0, ctr.z - mid.z)) < 0) n.negate();
    if (Math.abs(sp.a.y - fy) < 0.02 && Math.abs(sp.b.y - fy) < 0.02) continue;
    const pts = q.filter((v, i) => q.findIndex((w) => w.distanceTo(v) < 1e-6) === i);
    if (pts.length >= 3) acc.poly(pts.map(dk), n, PAL.trim, 'solid', 99);
  }
  // (the floor: the canopy's outline seen from above, as wide as the walls' feet; a dark deck)
  const fl = []; for (const sp of out) fl.push(foot(sp.a), foot(sp.b));
  const hull2 = convexHullXZ(fl);
  polyTo(acc, hull2.map((v) => V3(v.x, fy, v.z)), V3(0, 1, 0), PAL.deck);
  // (the cabin's door in the bulkhead, at the back of the floor: shut, dark, a lit strip over it)
  const zb = Math.min(...hull2.map((v) => v.z)) + 0.32;
  boxAt(acc, V3(0, fy + 1.0, zb), [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)], [0.45, 1.0, 0.03], PAL.trim);
  boxAt(acc, V3(0, fy + 1.0, zb + 0.035), [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)], [0.012, 0.96, 0.006], PAL.black, ['w-']);
  acc.poly([V3(-0.4, fy + 2.06, zb + 0.032), V3(0.4, fy + 2.06, zb + 0.032), V3(0.4, fy + 2.1, zb + 0.032), V3(-0.4, fy + 2.1, zb + 0.032)].map(dk), V3(0, 0, 1), GLOW.strip, 'glow', 99);
  acc.flush(p);
  // (warm light over the seats, a cool one from the dash, for the bake)
  for (const x of [-0.5, 0.5]) p.light([x, C.floor + 2.0, C.seatsZ - 0.2], 1.1, [1.25, 0.85, 0.55], [0, -1, 0.2], 3.2);
  p.light([0, C.floor + 1.3, C.seatsZ + 1.0], 0.8, [0.35, 0.65, 1.0], [0, 0.2, -1], 2.5);
  return p;
}
// the convex hull of points in plan (x, z), in order round it
function convexHullXZ(pts) {
  const P = pts.map((v) => [v.x, v.z]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of P.slice().reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1)).map(([x, z]) => V3(x, 0, z));
}

// ── THE DOORWAYS ────────────────────────────────────────────────────────────────────────────────────────────────────
// The door stands in a plane from its hinge line (xHinge, hinge height) up to its head line (xHead, head height), set
// into the hull's side (the 3k's side steps out over a narrower lower hull here, so the door sits in a dark alcove,
// the jambs between it and the skin). Inside, the cabin's deck is the sill: a step up from the hinge.
// (x of the door's plane at height y, in the ship frame)
const doorX = (y) => DOOR.xHinge + (DOOR.xHead - DOOR.xHinge) * (y - DOOR.hinge) / (DOOR.head - DOOR.hinge);
const DOOR_U = V3(DOOR.xHead - DOOR.xHinge, DOOR.head - DOOR.hinge, 0).normalize(), DOOR_LEN = Math.hypot(DOOR.xHead - DOOR.xHinge, DOOR.head - DOOR.hinge);
// the airlock behind the port door (its inner wall at x AIRLOCK.x, its ceiling at AIRLOCK.top over the deck), the
// step inside the doorway (its riser AIRLOCK.riser in from the hinge line)
export const AIRLOCK = { x: 0.9, top: 2.06, riser: 0.16, z: DOOR.z };
// a flat polygon (ship frame, any winding) facing n, its points in order round it, fanned (convex) or cut (concave)
function polyTo(acc, pts, n, surf, mat = 'solid') {
  const o = n.clone().normalize(), t = Math.abs(o.y) < 0.9 ? V3(0, 1, 0).cross(o).normalize() : V3(1, 0, 0).cross(o).normalize(), r = o.clone().cross(t);
  const P2 = pts.map((q) => new THREE.Vector2(q.dot(t), q.dot(r)));
  let P = pts; if (THREE.ShapeUtils.isClockWise(P2)) { P = pts.slice().reverse(); P2.reverse(); }
  const tri = THREE.ShapeUtils.triangulateShape(P2, []);
  acc.tris(tri.map((t3) => t3.map((i) => dk(P[i]))), o, surf, mat);
}
// a box from its eight corners' extents, along given axes (u, v, w unit, centred at c, half sizes h): its faces out
function boxAt(acc, c, [u, v, w], [hu, hv, hw], surf, skip = []) {
  const P = (a, b, d) => c.clone().addScaledVector(u, a * hu).addScaledVector(v, b * hv).addScaledVector(w, d * hw);
  const F = [['u+', [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], u], ['u-', [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]], u.clone().negate()], ['v+', [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], v], ['v-', [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]], v.clone().negate()], ['w+', [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], w], ['w-', [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], w.clone().negate()]];
  for (const [name, corners, n] of F) if (!skip.includes(name)) acc.poly(corners.map((q) => dk(P(...q))), n, surf, 'solid', 99);
}
function ebDoorway(p, side) {
  const s = side === 'starboard' ? -1 : 1, acc = new Acc(), [z0, z1] = DOOR.z, J = JAMBS[side];
  // the jambs: between the door's plane and the skin, at each end of the doorway, dark (the black edge round the door)
  J.forEach(({ z, profile }, i) => {
    const outer = profile.filter(([x, y]) => x > doorX(y) + 0.004).map(([x, y]) => V3(s * x, y, z));
    if (outer.length < 2) return;
    const yb = outer[0].y, yt = outer[outer.length - 1].y;
    polyTo(acc, [V3(s * doorX(yb), yb, z), ...outer, V3(s * doorX(yt), yt, z)], V3(0, 0, i === 0 ? 1 : -1), PAL.trimEdge);
  });
  // the step inside the doorway: its riser from the hinge's height up to the deck, a tread at the hinge's height out
  // to the door's plane, the deck's edge (the sill) over it
  const xr = DOOR.xHinge - AIRLOCK.riser;
  polyTo(acc, [V3(s * xr, DOOR.hinge, z0), V3(s * xr, DOOR.hinge, z1), V3(s * xr, DECK, z1), V3(s * xr, DECK, z0)], V3(s, 0, 0), PAL.trim);
  polyTo(acc, [V3(s * xr, DOOR.hinge, z0), V3(s * DOOR.xHinge, DOOR.hinge, z0), V3(s * DOOR.xHinge, DOOR.hinge, z1), V3(s * xr, DOOR.hinge, z1)], V3(0, 1, 0), PAL.deck);
  // (the step's sides, the jambs carried down to it)
  for (const [z, nz] of [[z0, 1], [z1, -1]]) polyTo(acc, [V3(s * xr, DOOR.hinge, z), V3(s * DOOR.xHinge, DOOR.hinge, z), V3(s * doorX(DECK), DECK, z), V3(s * xr, DECK, z)], V3(0, 0, nz), PAL.trimEdge);
  if (s > 0) {
    // THE AIRLOCK behind the port door: its deck, walls (the station's off-white), ceiling, and the inner door shut in its
    // inner wall (a dark panel, a lit strip over it)
    const xi = AIRLOCK.x, top = DECK + AIRLOCK.top;
    polyTo(acc, [V3(xi, DECK, z0), V3(xi, DECK, z1), V3(xr, DECK, z1), V3(xr, DECK, z0)], V3(0, 1, 0), PAL.deck);
    polyTo(acc, [V3(xi, top, z0), V3(doorX(top), top, z0), V3(doorX(top), top, z1), V3(xi, top, z1)], V3(0, -1, 0), PAL.inner);
    for (const [z, nz] of [[z0, 1], [z1, -1]]) polyTo(acc, [V3(xi, DECK, z), V3(xr, DECK, z), V3(doorX(DECK), DECK, z), V3(doorX(top), top, z), V3(xi, top, z)], V3(0, 0, nz), PAL.inner);
    polyTo(acc, [V3(xi, DECK, z0), V3(xi, DECK, z1), V3(xi, top, z1), V3(xi, top, z0)], V3(1, 0, 0), PAL.inner);
    const zm = (z0 + z1) / 2, dw = 0.5;
    boxAt(acc, V3(xi + 0.02, DECK + 1.0, zm), [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)], [0.02, 1.0, dw], PAL.trim, ['u-']);
    boxAt(acc, V3(xi + 0.045, DECK + 1.0, zm), [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)], [0.004, 0.96, 0.012], PAL.black, ['u-']);
    acc.poly([V3(xi + 0.03, top - 0.12, zm - 0.4), V3(xi + 0.03, top - 0.12, zm + 0.4), V3(xi + 0.03, top - 0.08, zm + 0.4), V3(xi + 0.03, top - 0.08, zm - 0.4)].map(dk), V3(1, 0, 0), GLOW.strip, 'glow', 99);
    acc.poly([V3(xi + 0.2, top - 0.005, zm - 0.5), V3(xi + 1.0, top - 0.005, zm - 0.5), V3(xi + 1.0, top - 0.005, zm + 0.5), V3(xi + 0.2, top - 0.005, zm + 0.5)].map(dk), V3(0, -1, 0), [2.6, 2.4, 2.0], 'glow', 99);
    p.light([xi + 0.6, top - DECK - 0.15, zm], 1.4, [1, 0.94, 0.85], [0, -1, 0], 3.5);
  } else {
    // THE SEALED HATCH (starboard): a panel in the door's plane, white with a black edge line round it, two dark
    // latch plates
    hatchPanel(acc, s, false);
  }
  return acc.flush(p);
}
// the door's panel, closed, in the door's plane: its outer face (white, a black line round its edge), its edges and
// inside face; steps: the airstair's treads and side rails on its inside face (they are horizontal when it is open)
function hatchPanel(acc, s, steps) {
  const [z0, z1] = DOOR.z, e = 0.008, za = z0 + e, zb = z1 - e, out = V3(s * DOOR_U.y, -DOOR_U.x, 0), inn = out.clone().negate(), T = 0.06, B = 0.05;
  const P = (u, z, w = 0) => V3(s * (DOOR.xHinge + DOOR_U.x * u), DOOR.hinge + DOOR_U.y * u, z).addScaledVector(inn, w);
  const D = { poly: (pts, n, surf, mat, step) => acc.poly(pts.map(dk), n, surf, mat, step) };   // (its points are the ship's: on the deck)
  const L = DOOR_LEN - e;
  // the outer face: the white middle, the black line round it
  D.poly([P(B, za + B), P(B, zb - B), P(L - B, zb - B), P(L - B, za + B)], out, PAL.skin, 'solid', 99);
  for (const q of [[P(0, za), P(0, zb), P(B, zb - B), P(B, za + B)], [P(L, za), P(L - B, za + B), P(L - B, zb - B), P(L, zb)], [P(0, za), P(B, za + B), P(L - B, za + B), P(L, za)], [P(0, zb), P(L, zb), P(L - B, zb - B), P(B, zb - B)]]) D.poly(q, out, PAL.black, 'solid', 99);
  // its edges and inside face
  for (const [a, b] of [[P(0, za), P(0, zb)], [P(0, zb), P(L, zb)], [P(L, zb), P(L, za)], [P(L, za), P(0, za)]]) { const n = b.clone().sub(a).cross(inn).normalize(); D.poly([a, b, b.clone().addScaledVector(inn, T), a.clone().addScaledVector(inn, T)], n.dot(a.clone().add(b).multiplyScalar(0.5).sub(P(L / 2, (za + zb) / 2))) < 0 ? n.negate() : n, PAL.trimEdge, 'solid', 99); }
  D.poly([P(0, za, T), P(L, za, T), P(L, zb, T), P(0, zb, T)], inn, steps ? PAL.deck : PAL.inner, 'solid', 99);
  if (!steps) { for (const u of [0.5, L - 0.5]) boxAt(acc, P(u, (za + zb) / 2, -0.012), [DOOR_U.clone().setX(s * DOOR_U.x), V3(0, 0, 1), out], [0.06, 0.18, 0.012], PAL.trim, ['w-']); return; }
  // THE STEPS: the side rails along both edges, and the treads: when the door is open its inside faces up the slope
  // at the stair's angle; each tread is a wedge whose top is level then, its front a riser, a yellow nosing on it
  const ang = Math.asin(DOOR.hinge / DOOR_LEN), rise = 0.205, ds = rise / Math.sin(ang), run = rise / Math.tan(ang);
  // (level and up when open, in the panel's own terms: along it from the hinge (u) and out of its inside face (w))
  const hu = Math.cos(ang), hw = Math.sin(ang);
  const W = (u, w, z) => P(u, z, T + w);
  for (const z of [za + 0.025, zb - 0.025]) boxAt(acc, W(L / 2, 0.08, z), [DOOR_U.clone().setX(s * DOOR_U.x), inn, V3(0, 0, 1)], [L / 2, 0.08, 0.025], PAL.black, ['v-']);
  const zA = za + 0.05, zB = zb - 0.05;
  for (let u = ds * 0.6; u + ds < L - 0.02; u += ds) {
    // (the wedge: its back on the panel at u, its nose run out level, its riser down to the panel at u + ds)
    const a = [u, 0], b = [u + hu * run, hw * run], c = [u + ds, 0];
    const tri = (q, z) => W(q[0], q[1], z), nTop = W(b[0], b[1], 0).sub(W(a[0], a[1], 0)).cross(V3(0, 0, 1)).normalize(), nFront = W(c[0], c[1], 0).sub(W(b[0], b[1], 0)).cross(V3(0, 0, 1)).normalize();
    const fix = (n, ref) => (n.dot(ref) < 0 ? n.negate() : n);
    D.poly([tri(a, zA), tri(b, zA), tri(b, zB), tri(a, zB)], fix(nTop, inn), PAL.belly, 'solid', 99);
    D.poly([tri(b, zA), tri(c, zA), tri(c, zB), tri(b, zB)], fix(nFront, inn), PAL.trim, 'solid', 99);
    const n0 = [W(...a, 0), W(...b, 0), W(...c, 0)];
    D.poly([tri(a, zA), tri(c, zA), tri(b, zA)], V3(0, 0, -1), PAL.trim, 'solid', 99); D.poly([tri(a, zB), tri(b, zB), tri(c, zB)], V3(0, 0, 1), PAL.trim, 'solid', 99);
    // (the nosing: a yellow strip along the tread's front edge, on its top)
    const bn = [b[0] - hu * 0.07, b[1] - hw * 0.07];
    D.poly([W(bn[0], bn[1] + 0.002, zA), W(b[0], b[1] + 0.002, zA), W(b[0], b[1] + 0.002, zB), W(bn[0], bn[1] + 0.002, zB)], fix(nTop, inn), PAL.yellow, 'solid', 99);
    void n0;
  }
}
// THE AIRSTAIR DOOR (port): the panel above as a kit door leaf, hinged on its foot (the hinge line along z), swinging
// out and down until its top rests on the ground; it opens as someone comes within 2.6 m of its foot
export const STAIR = { angle: -(Math.atan2(DOOR.head - DOOR.hinge, DOOR.xHead - DOOR.xHinge) + Math.asin(DOOR.hinge / DOOR_LEN)), slope: Math.asin(DOOR.hinge / DOOR_LEN) };
function ebAirstair(p) {
  p.leaf('eb:airstair', (lp) => { const acc = new Acc(); hatchPanel(acc, 1, true); acc.flush(lp); }, { door: 'stair', hinge: { at: [DOOR.xHinge, DOOR.hinge - DECK, 0], axis: [0, 0, 1], angle: STAIR.angle } });
  p.door('stair', [DOOR.xHinge + 1.8, -DECK + 1.0, (DOOR.z[0] + DOOR.z[1]) / 2], 2.6, 0.9);
  return p;
}

// ── THE LANDING GEAR ────────────────────────────────────────────────────────────────────────────────────────────────
// each leg, from the 8k: its strut and its foot as two leaves of one kit door ('gear'): as it opens (gear up), the
// strut turns a1 about its hinge, the foot a2 more about its ankle, so the leg folds into its well (the nose leg's hinge
// is only the centre of its turn, over its top: it swings up and forward). Starboard's is the
// port one mirrored. The well's doors (ebGearDoors) are another door ('gear doors'); the game, or the lab, moves the two
// in turn (gearStep)
export const GEAR_SPEED = 0.42, GEAR_DOOR_SPEED = 0.9;
function legMesh(name, mirror) {
  const M = mesh(GEAR[name]), foot = new Uint8Array(bytes(GEAR[name].foot)), F = GEAR[name].fold;
  const P = (i) => { const v = at(M, i); if (mirror) v.x = -v.x; return v; };
  const out = { strut: [], foot: [] };
  for (let t = 0; t < M.tris.length / 3; t++) {
    let tri = [0, 1, 2].map((k) => P(M.tris[t * 3 + k])); if (mirror) tri = [tri[0], tri[2], tri[1]];
    const n = tnorm(tri); if (n.lengthSq() < 1e-14) continue;
    (foot[t] ? out.foot : out.strut).push({ tri, n: n.normalize() });
  }
  const m = mirror ? -1 : 1, H = V3(m * F.hinge[0], F.hinge[1], F.hinge[2]), A = V3(m * F.ankle[0], F.ankle[1], F.ankle[2]);
  // (mirrored, a turn about z goes the other way; about x, the same)
  const sg = mirror && F.axis[2] ? -1 : 1;
  return { ...out, H, A, axis: F.axis, a1: sg * F.a1 * PI / 180, a2: sg * F.a2 * PI / 180, slide: F.slide ? [m * F.slide[0], F.slide[1], F.slide[2]] : [0, 0, 0] };
}
function ebGear(p, which) {
  const G = legMesh(which === 'nose' ? 'nose' : 'aft', which === 'starboard'), h1 = { at: dk(G.H).toArray(), axis: G.axis, angle: G.a1 };
  // (the strut light metal, its housing's flat faces dark; the foot dark, its pad's sole rubber)
  const paint = (f, isFoot) => (isFoot ? (f.n.y < -0.9 ? PAL.rubber : PAL.trim) : Math.abs(f.n.y) > 0.85 ? PAL.trim : PAL.metal);
  const draw = (list, isFoot) => (lp) => { const acc = new Acc(); for (const f of list) acc.tris([f.tri.map(dk)], f.n, paint(f, isFoot)); acc.flush(lp); };
  // (both leaves slide alike as they turn, if the leg's fold gives a slide)
  p.leaf('eb:strut:' + which, draw(G.strut, false), { door: 'gear', hinge: h1, slide: G.slide });
  p.leaf('eb:foot:' + which, draw(G.foot, true), { door: 'gear', hinge: [h1, { at: dk(G.A).toArray(), axis: G.axis, angle: G.a2 }], slide: G.slide });
  p.door('gear', [0, -DECK, 0], 0, GEAR_SPEED);
  return p;
}
// THE WELLS' DOORS: the nose's, the belly's skin cut out of its well, in two halves; each hangs open (down) while the
// gear is down and shuts flush into the belly when it is up. The aft bays' (bayDoors): the pod's bottom in fore and aft
// halves, each folding in two as it opens (and, if the bay's spec gives a `strip`, the low strip of its side, a flap
// that swings out and up). (The door 'gear doors': open = shut, here: t 1 is shut.)
const DOOR_OPEN = 1.75;   // (radians: how far they hang: past straight down, leaning out, clear of the leg as it swings)
// (a face on the hull's lower band, painted by the hull's own rules)
const lowerPaint = (P, n) => { const f = { part: 'body', zone: 'lower', n, c: P.reduce((t, v) => t.add(v), V3(0, 0, 0)).multiplyScalar(1 / P.length), thin: false }; const rule = RULES.find(([, test]) => test(f)); return PAL[typeof rule[2] === 'function' ? rule[2](f) : rule[2]] || PAL.trim; };
// (a panel: its outer face painted, its inner face dark, 3 cm in; P in the ship's frame, n its outward normal)
const panel = (acc, P, n) => { acc.poly(P.map(dk), n, lowerPaint(P, n), 'solid', 99); acc.poly(P.map((v) => dk(v.clone().addScaledVector(n, -0.03))).reverse(), n.clone().negate(), PAL.trim, 'solid', 99); };
// turning about a line (a point on it and its direction), as a matrix
const turnAbout = (a, axis, ang) => new THREE.Matrix4().makeTranslation(a.x, a.y, a.z).multiply(new THREE.Matrix4().makeRotationAxis(axis, ang)).multiply(new THREE.Matrix4().makeTranslation(-a.x, -a.y, -a.z));
const leafPose = (M) => { const q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(); M.decompose(pos, q, scl); const e = new THREE.Euler().setFromQuaternion(q); return { at: pos.toArray(), rot: [e.x, e.y, e.z] }; };
// a bay's shape: the belly's height along it, and x's sign on this side
const bayOf = (B) => ({ s: B.mirror ? -1 : 1, yb: (z) => B.belly[0] + (B.belly[1] - B.belly[0]) * (z - B.z[0]) / (B.z[1] - B.z[0]), zm: (B.z[0] + B.z[1]) / 2 });
const FLAP_OPEN = 1.75;   // (radians: the side flap swings out and up past level)
function bayDoors(p, which, B) {
  const { s, yb, zm } = bayOf(B), X = (x) => s * x, ax = V3(1, 0, 0);
  // the bottom: from each end to the middle, in two leaves: A at the end, hinged on the bay's edge, swings straight down;
  // B, its inner part, folds back up against A's outside as A swings (hinged on A's free edge, 1.5 cm out, so it lies
  // 3 cm off it), so the halves hang no lower than a quarter of the bay's length
  [[B.z[0], 1], [B.z[1], -1]].forEach(([ze, dir], h) => {
    const L = Math.abs(zm - ze), zA = ze + dir * L / 2, phi = dir * PI / 2, psi = dir * PI;
    const bottom = (z1, z2) => [V3(X(B.x[0]), yb(z1), z1), V3(X(B.x[1]), yb(z1), z1), V3(X(B.x[1]), yb(z2), z2), V3(X(B.x[0]), yb(z2), z2)];
    const nb = (() => { const P = bottom(B.z[0], B.z[1]), n = tnorm(P.slice(0, 3)).normalize(); return n.y > 0 ? n.negate() : n; })();
    const e = dk(V3(0, yb(ze), ze)), E = turnAbout(e, ax, phi);
    const f = dk(V3(0, yb(zA), zA)).applyMatrix4(E).add(V3(0, 0, -dir * 0.015)), F = turnAbout(f, ax, psi);
    const build = (z1, z2) => (lp) => { const acc = new Acc(); panel(acc, bottom(z1, z2), nb); acc.flush(lp); };
    p.leaf(`eb:bay door:${which}:${h}a`, build(ze, zA), { ...leafPose(E), door: 'doors', hinge: { at: e.toArray(), axis: ax.toArray(), angle: -phi } });
    p.leaf(`eb:bay door:${which}:${h}b`, build(zA, zm), { ...leafPose(F.clone().multiply(E)), door: 'doors', hinge: [{ at: e.toArray(), axis: ax.toArray(), angle: -phi }, { at: f.toArray(), axis: ax.toArray(), angle: -psi }] });
  });
  // the side's low strip: one flap the bay's length, hinged along its top, swinging out and up
  if (B.strip == null) return;
  const az = V3(0, 0, 1), top = dk(V3(X(B.x[1]), B.strip, 0)), th = s * FLAP_OPEN, FL = turnAbout(top, az, th);
  const strip = [V3(X(B.x[1]), yb(B.z[0]), B.z[0]), V3(X(B.x[1]), B.strip, B.z[0]), V3(X(B.x[1]), B.strip, B.z[1]), V3(X(B.x[1]), yb(B.z[1]), B.z[1])];
  p.leaf(`eb:bay flap:${which}`, (lp) => { const acc = new Acc(); panel(acc, strip, V3(s, 0, 0)); acc.flush(lp); }, { ...leafPose(FL), door: 'doors', hinge: { at: top.toArray(), axis: az.toArray(), angle: -th } });
}
function ebGearDoors(p, which) {
  if (WELLS[which].bay) { bayDoors(p, which, WELLS[which].bay); p.door('doors', [0, -DECK, 0], 0, GEAR_DOOR_SPEED); return p; }
  DOORS[which].forEach((half, i) => {
    // (all in the pieces' frame, on the deck)
    const a = dk(V3(...half.hinge[0])), b = dk(V3(...half.hinge[1])), axis = b.clone().sub(a).normalize();
    // (which way is down: turn so the half's middle drops)
    const mid = dk(half.polys.flat().reduce((t, q) => t.add(V3(...q)), V3(0, 0, 0)).multiplyScalar(1 / half.polys.flat().length));
    const R = (ang) => new THREE.Matrix4().makeTranslation(a.x, a.y, a.z).multiply(new THREE.Matrix4().makeRotationAxis(axis, ang)).multiply(new THREE.Matrix4().makeTranslation(-a.x, -a.y, -a.z));
    const open = mid.clone().applyMatrix4(R(DOOR_OPEN)).y < mid.clone().applyMatrix4(R(-DOOR_OPEN)).y ? DOOR_OPEN : -DOOR_OPEN;
    const base = R(open), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(); base.decompose(pos, q, scl);
    const e = new THREE.Euler().setFromQuaternion(q);
    p.leaf('eb:well door:' + which + ':' + i, (lp) => {
      const acc = new Acc();
      for (const poly of half.polys) {
        const P = poly.map((q2) => V3(...q2)), n = tnorm(P.slice(0, 3)).normalize(); if (n.y > 0) n.negate();
        const f = { part: 'body', zone: 'lower', n, c: P.reduce((t, v) => t.add(v), V3(0, 0, 0)).multiplyScalar(1 / P.length), thin: false };
        const rule = RULES.find(([, test]) => test(f)), paint = typeof rule[2] === 'function' ? rule[2](f) : rule[2];
        acc.poly(P.map(dk), n, PAL[paint] || PAL.belly, 'solid', 99);
        acc.poly(P.map((v) => dk(v.clone().addScaledVector(n, -0.03))).reverse(), n.clone().negate(), PAL.trim, 'solid', 99);
      }
      acc.flush(lp);
    }, { at: pos.toArray(), rot: [e.x, e.y, e.z], door: 'doors', hinge: { at: a.toArray(), axis: axis.toArray(), angle: -open } });
  });
  p.door('doors', [0, -DECK, 0], 0, GEAR_DOOR_SPEED);
  return p;
}
// THE WELLS: the nose's, dark walls standing on its rim up to its ceiling, and the ceiling. The aft bays (bayPod): the
// gear pod's outside (its side over the flap and its ends, painted as the lower hull), the bay's inside dark (the
// inner wall, the ceiling under the deck, the step and the roof over the pod) and the axle the strut turns on.
function bayPod(acc, B) {
  const { s, yb } = bayOf(B), X = (x) => s * x, [x0, x1] = B.x, wt = B.wallTop ?? B.roof;
  // (the section at z: the doors' line, out and up the pod's side to the hull, in to the step at the roof, down the
  // step, in under the deck)
  const sec = (z) => [[x0, yb(z)], [x1, yb(z)], [x1, wt], [B.step, B.roof], [B.step, B.ceil], [x0, B.ceil]].map(([x, y]) => V3(X(x), y, z));
  const [a, f] = [sec(B.z[0]), sec(B.z[1])];
  // the pod's side over the doors (or the flap) up to the hull's overhang (outside painted; inside dark), and its ends
  // (the whole section: outside painted, its part inside the hull unseen; inside dark)
  const lo = (z) => B.strip ?? yb(z);
  panel(acc, [V3(X(x1), lo(B.z[0]), B.z[0]), V3(X(x1), wt, B.z[0]), V3(X(x1), wt, B.z[1]), V3(X(x1), lo(B.z[1]), B.z[1])], V3(s, 0, 0));
  for (const [P, nz] of [[a, -1], [f, 1]]) { polyTo(acc, P, V3(0, 0, nz), lowerPaint(P, V3(0, 0, nz))); polyTo(acc, P, V3(0, 0, -nz), PAL.trim); }
  // the bay's inside: the roof, the step, the ceiling (dark both sides: the step and roof face the cabin's side behind
  // its rooms' walls) and the inner wall
  const quad = (p0, p1) => [V3(X(p0[0]), p0[1], B.z[0]), V3(X(p1[0]), p1[1], B.z[0]), V3(X(p1[0]), p1[1], B.z[1]), V3(X(p0[0]), p0[1], B.z[1])];
  for (const [P, n] of [[quad([B.step, B.roof], [x1, B.roof]), V3(0, -1, 0)], [quad([B.step, B.ceil], [B.step, B.roof]), V3(s, 0, 0)], [quad([x0, B.ceil], [B.step, B.ceil]), V3(0, -1, 0)]]) {
    acc.poly(P.map(dk), n, PAL.trim, 'solid', 99); acc.poly(P.map(dk), n.clone().negate(), PAL.trim, 'solid', 99);
  }
  { const P = [a[5], a[0], f[0], f[5]]; acc.poly(P.map(dk), V3(s, 0, 0), PAL.trim, 'solid', 99); }
  // the axle: a bar along the bay from end to end through the strut's turning point
  boxAt(acc, V3(X(B.axle[0]), B.axle[1], (B.z[0] + B.z[1]) / 2), [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)], [0.06, 0.06, (B.z[1] - B.z[0]) / 2 - 0.01], PAL.metal, ['w+', 'w-']);   // (its ends 1 cm inside the end walls, unseen)
}
function ebWells(p) {
  const acc = new Acc();
  for (const W of Object.values(WELLS)) {
    if (W.bay) { bayPod(acc, W.bay); continue; }
    // (its ceiling: the box's top, or, with `ceil`, lower (ceil.low) aft of ceil.z, a step up between them)
    const [mn, mx] = W.box, c = V3((mn[0] + mx[0]) / 2, 0, (mn[2] + mx[2]) / 2), zs = W.ceil?.z ?? -Infinity, topAt = (z) => (z < zs ? W.ceil.low : mx[1]);
    for (const [a0, b0] of W.rim) {
      const a = V3(...a0), b = V3(...b0), n = b.clone().sub(a).cross(V3(0, 1, 0)).normalize();
      // (facing into the well; only what is under its ceiling; a rim crossing the step split at it)
      if (n.dot(V3(c.x - a.x, 0, c.z - a.z)) < 0) n.negate();
      const parts = (a.z - zs) * (b.z - zs) < 0 ? (() => { const m = a.clone().lerp(b, (zs - a.z) / (b.z - a.z)); return [[a, m], [m, b]]; })() : [[a, b]];
      for (const [u, v] of parts) {
        const top = topAt((u.z + v.z) / 2), [q] = clipPlane([u, v, V3(v.x, top, v.z), V3(u.x, top, u.z)], [0, 1, 0, top]);
        if (q.length > 2) acc.poly(q.map(dk), n, PAL.trim, 'solid', 99);
      }
    }
    const roof = (z0, z1, y) => acc.poly([V3(mn[0], y, z0), V3(mx[0], y, z0), V3(mx[0], y, z1), V3(mn[0], y, z1)].map(dk), V3(0, -1, 0), PAL.trim, 'solid', 99);
    if (W.ceil) { roof(mn[2], zs, W.ceil.low); roof(zs, mx[2], mx[1]); acc.poly([V3(mn[0], W.ceil.low, zs), V3(mx[0], W.ceil.low, zs), V3(mx[0], mx[1], zs), V3(mn[0], mx[1], zs)].map(dk), V3(0, 0, 1), PAL.trim, 'solid', 99); }   // (the step faces forward, into the taller part)
    else roof(mn[2], mx[2], mx[1]);
  }
  return acc.flush(p);
}
// MOVING THE GEAR (the game, or the lab): up folds the legs, then shuts the wells' doors; down opens the doors, then
// lowers the legs. built: buildRoom's result; updateDoors: the kit's (kit/layout.js; passed in, as this file is part
// of the catalog the layout code reads). Returns whether anything moved. (The doors' t runs 0 open to 1 shut.)
export function gearStep(built, up, dt, updateDoors) {
  const legs = built.doors.filter((D) => D.piece === 'ebGear'), doors = built.doors.filter((D) => D.piece === 'ebGearDoors'), eye = new THREE.Vector3();
  if (up) { const m = updateDoors(legs, eye, dt, 'open'); return legs.every((D) => D.t >= 1) ? updateDoors(doors, eye, dt, 'open') || m : m; }
  const m = updateDoors(doors, eye, dt, 'shut'); return doors.every((D) => D.t <= 0) ? updateDoors(legs, eye, dt, 'shut') || m : m;
}

// ── THE GRIME: the kit's painted material, with dirt laid over the clean paint by one amount (uDirt, 0 clean to 1
// filthy; the clean look is the base). Cheap: a few texture reads and one short loop per pixel.
//   crevices and joins   darker where the bake's corner darkening says the sky is hidden (where parts meet)
//   blotches             big soft patches of grime from the kit's wear texture, read large over the ship
//   streaks              soot and runs trailing from STREAKS (the vents and the engines' nozzles), along their flow,
//                        widening and fading, broken into runs by the wear texture read long and thin
//   worn edges           the thin faces along exposed edges (the 'Edge' paints, which take more wear): paint chipped
//                        to bare metal in the wear texture's scuff pattern
// grimeMaterials(mats, { dirt }) returns the material set with its painted material (and the door leaves') swapped for
// these; GRIME.dirt.value changes the amount live. The streaks are where the ship's parts are, so they apply to the
// static parts (the leaves move, so they take the rest but no streaks).
export const STREAKS = [
  // [x, y, z (ship frame, metres), flow dx, dy, dz, length, width]: the roof's vents (aft), the side vents (aft and
  // down), each engine's nozzle (soot creeping forward up the nacelle from its rim)
  [0, 5.15, 1.05, 0, -0.08, -1, 3.2, 0.5], [1.55, 4.75, 1.85, 0, -0.1, -1, 2.4, 0.3], [-1.55, 4.75, 1.85, 0, -0.1, -1, 2.4, 0.3],
  [0, 4.75, -2.35, 0, -0.1, -1, 2.0, 0.6], [2.75, 4.35, -0.1, 0, -0.35, -1, 2.6, 0.25], [-2.75, 4.35, -0.1, 0, -0.35, -1, 2.6, 0.25],
  [2.32, 3.49, -8.62, 0, 0, 1, 1.6, 1.3], [-2.32, 3.49, -8.62, 0, 0, 1, 1.6, 1.3],
  [3.15, 2.6, -1.0, 0, -1, -0.25, 1.4, 0.35], [-3.15, 2.6, -1.0, 0, -1, -0.25, 1.4, 0.35],
];
export const GRIME = { dirt: { value: 0.45 } };
function grimePatch(mat, inst, wear) {
  mat.defines = { ...(mat.defines || {}), KIT_RMW: '', ...(inst ? { KIT_INST: '' } : { EB_STREAKS: '' }) };
  const src = STREAKS.map((q) => new THREE.Vector4(q[0], q[1] - DECK, q[2], q[6])), dir = STREAKS.map((q) => new THREE.Vector4(...new THREE.Vector3(q[3], q[4], q[5]).normalize().toArray(), q[7]));
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uWear: { value: wear }, uAODirect: KU.aoDirect, uBakeGain: KU.bakeGain, uAOStrength: KU.aoStrength, uDirt: GRIME.dirt, uSrc: { value: src }, uDir: { value: dir } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aAO; attribute vec3 aRMW;
#ifdef KIT_INST
attribute vec3 iBake;
#else
attribute vec3 aBake;
#endif
varying float vAO; varying vec3 vBake; varying vec2 vWearUv; varying vec3 vRMW; varying vec3 vPos;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
vAO = aAO; vWearUv = uv; vRMW = aRMW; vPos = position;
#ifdef KIT_INST
vBake = iBake;
#else
vBake = aBake;
#endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uWear; uniform float uAODirect, uBakeGain, uAOStrength, uDirt;
uniform vec4 uSrc[${src.length}]; uniform vec4 uDir[${src.length}];
varying float vAO; varying vec3 vBake; varying vec2 vWearUv; varying vec3 vRMW; varying vec3 vPos;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec3 wearT = texture2D( uWear, vWearUv * 0.5 ).rgb, blot = texture2D( uWear, vWearUv * 0.11 + 0.31 ).rgb;
  float take = vRMW.z, lum0 = dot( diffuseColor.rgb, vec3( 0.3333 ) );
  float grime = ( 1.0 - vAO ) * 1.25 + blot.r * take * 0.45;
#ifdef EB_STREAKS
  float st = 0.0;
  for ( int i = 0; i < ${src.length}; i++ ) {
    vec3 d = vPos - uSrc[ i ].xyz; float along = dot( d, uDir[ i ].xyz );
    if ( along > 0.0 && along < uSrc[ i ].w ) {
      float f = along / uSrc[ i ].w, across = length( d - along * uDir[ i ].xyz ), w = uDir[ i ].w * ( 1.0 + 0.8 * f );
      st = max( st, ( 1.0 - f ) * ( 1.0 - smoothstep( w * 0.35, w, across ) ) );
    }
  }
  float runs = texture2D( uWear, vec2( ( vPos.x + vPos.z ) * 0.9, vPos.y * 0.06 + vPos.z * 0.04 ) ).r;
  grime += st * ( 0.35 + 0.9 * runs );
#endif
  diffuseColor.rgb *= 1.0 - clamp( uDirt * grime * 0.55, 0.0, 0.7 );
  // (worn edges: chipped paint on the thin edge faces, bare metal showing through)
  float chip = uDirt * smoothstep( 0.8, 0.98, take ) * smoothstep( 0.35, 0.75, wearT.g );
  diffuseColor.rgb = mix( diffuseColor.rgb, lum0 < 0.25 ? vec3( 0.42, 0.43, 0.45 ) : vec3( 0.55, 0.56, 0.57 ), chip * 0.85 );
  diffuseColor.rgb *= 0.97 + 0.06 * wearT.b;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = clamp( vRMW.x + uDirt * ( blot.r * 0.15 + wearT.r * 0.1 ) * take, 0.04, 1.0 );`)
      .replace('#include <metalnessmap_fragment>', `float metalnessFactor = mix( vRMW.y, 0.75, chip );`)
      .replace('#include <aomap_fragment>', `
  float ambientOcclusion = mix( 1.0, vAO, uAOStrength );
  reflectedLight.indirectDiffuse *= ambientOcclusion;
  reflectedLight.directDiffuse *= mix( 1.0, ambientOcclusion, uAODirect );
  reflectedLight.directSpecular *= mix( 1.0, ambientOcclusion, uAODirect );
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    float dotNVao = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNVao, ambientOcclusion, material.roughness );
  #endif
  reflectedLight.indirectDiffuse += vBake * uBakeGain * BRDF_Lambert( material.diffuseColor ) * mix( 1.0, ambientOcclusion, 0.35 );`);
  };
  mat.customProgramCacheKey = () => 'ebgrime' + (inst ? 'i' : '');
  return mat;
}
// the kit's material set with the painted ones swapped for grime; and a darker smoked glass for the canopy
export function grimeMaterials(mats, { dirt } = {}) {
  if (dirt != null) GRIME.dirt.value = dirt;
  const wear = kitTextures().wear, M = { ...mats };
  M.solid = grimePatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 }), false, wear);
  M.solidInst = grimePatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 }), true, wear);
  M.glass = new THREE.MeshStandardMaterial({ color: 0x0d1720, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.42, depthWrite: false, envMapIntensity: 0.9 });
  M.glassInst = M.glass;
  M.solid.name = 'solid'; M.solidInst.name = 'solidInst'; M.glass.name = 'glass';
  return M;
}

// ── the catalog ─────────────────────────────────────────────────────────────────────────────────────────────────────
const GR = 'Ships';
export const SHIP_EXPLORER_BUILT = {
  ebHull: { name: 'Explorer C (built): hull', group: GR, at: 'free', foot: [13, 6.3, 17.3], variants: ['hull'], build: ebHull },
  ebCanopy: { name: 'Explorer C (built): canopy', group: GR, at: 'free', foot: [5, 2, 6], variants: ['glass'], build: ebCanopy },
  ebMarks: { name: 'Explorer C (built): lights and marks', group: GR, at: 'free', foot: [13, 6, 17], variants: ['marks'], build: (p) => ebMarks(p) },
  ebDoorway: { name: 'Explorer C (built): doorway', group: GR, at: 'free', foot: [3, 2.5, 2], variants: ['port', 'starboard'], build: ebDoorway },
  ebAirstair: { name: 'Explorer C (built): airstair door', group: GR, at: 'free', foot: [3, 2.5, 2], variants: ['port'], build: ebAirstair },
  ebGear: { name: 'Explorer C (built): landing leg', group: GR, at: 'free', foot: [2, 1.6, 2], variants: ['nose', 'port', 'starboard'], build: ebGear },
  ebGearDoors: { name: 'Explorer C (built): gear well doors', group: GR, at: 'free', foot: [2, 1, 2], variants: ['nose', 'port', 'starboard'], build: ebGearDoors },
  ebWells: { name: 'Explorer C (built): gear wells', group: GR, at: 'free', foot: [5, 1, 9], variants: ['wells'], build: ebWells },
  ebCockpit: { name: 'Explorer C (built): cockpit', group: GR, at: 'free', foot: [3, 2, 3], variants: ['two seats'], build: (p) => ebCockpit(p) },
};
