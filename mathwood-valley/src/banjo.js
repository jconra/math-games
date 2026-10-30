// THE BANJO AND THE BANJO PLAYER'S STOOL, made in code (their numbers: src/banjoplan.js). An open-back banjo of the
// 1880s: a nickel-clad rim (walnut inside) under an aged calfskin head held by a nickel hoop and twelve hooks, the neck
// with its dark rosewood fingerboard, nickel frets, pearl dots and a bone nut, the slotted peghead with four friction
// pegs, the short fifth string's peg on the neck's side at the fifth fret, a maple bridge, a dark tailpiece, and five
// thin steel strings (the fifth ending at its peg). A plain three-legged stool for him to sit on. Each is one mesh (its
// parts merged, coloured by their vertices) and they share one material: about 880 triangles for the banjo, 150 for
// the stool.
//
//   makeBanjoModel({ material }) -> THREE.Mesh    in the banjo's own frame (src/banjoplan.js: the head's middle at the
//                                                 origin, the neck along +x, the head facing +y)
//   makeStoolModel({ material }) -> THREE.Mesh    its feet on the floor round the origin, its top at STOOL.h
//   banjoGeometry(), stoolGeometry()              their geometry alone
//   banjoMaterial()                               the shared material (a new one each call)
//   BANJO_PROPS        what a props list needs to show them: id, name, category, size, triangles
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BANJO, STOOL, fret } from './banjoplan.js';

// period colours (sRGB, as a picker shows them)
const C = {
  head: '#dccba3', hoop: '#a69f90', rim: '#7d7568', rimIn: '#4a2f1a',
  neck: '#5c3a20', board: '#2e1c13', peg: '#191411', bridge: '#d8c7a0', tail: '#2a2420', strings: '#cfcbc2',
  fret: '#b9b3a6', pearl: '#ebe4d2', hook: '#8f897d',
  stool: '#6e4b2c', stoolTop: '#7d5634',
};
export const BANJO_PROPS = [
  { id: 'banjo', name: 'Banjo', category: 'Music', size: [+BANJO.length.toFixed(3), 0.09, 0.28], tris: 880, make: 'makeBanjoModel' },
  { id: 'banjo-stool', name: 'Stool', category: 'Furniture', size: [0.4, STOOL.h, 0.4], tris: 152, make: 'makeStoolModel' },
];
const col = new THREE.Color();
// a primitive made ready to merge: no index, no uvs, one colour on every vertex
function ready(g, hex, m = null) {
  if (m) g.applyMatrix4(m);
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv');
  col.set(hex); const c = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < c.length; i += 3) c.set([col.r, col.g, col.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
// (the same, turned inside out: its faces wound the other way and its normals reversed)
function inward(g) {
  const P = g.attributes.position, N = g.attributes.normal;
  for (let i = 0; i < P.count; i += 3) for (const A of [P, N]) { const t = [A.getX(i + 1), A.getY(i + 1), A.getZ(i + 1)]; A.setXYZ(i + 1, A.getX(i + 2), A.getY(i + 2), A.getZ(i + 2)); A.setXYZ(i + 2, ...t); }
  for (let i = 0; i < N.count; i++) N.setXYZ(i, -N.getX(i), -N.getY(i), -N.getZ(i));
  return g;
}
const M = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
const box = (sx, sy, sz, hex, m) => ready(new THREE.BoxGeometry(sx, sy, sz), hex, m);
// a flat strip facing up: `long` along x round x, `wide` along z round z, at height y
const flat = (x, long, wide, y, z, hex) => ready(new THREE.PlaneGeometry(long, wide), hex, M(x, y, z, -Math.PI / 2));
// a string: a flat ribbon facing up through the points, `h` its half width
function strand(pts, h, hex) {
  const pos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]], dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), nx = -dz / L * h, nz = dx / L * h;
    pos.push(a[0] - nx, a[1], a[2] - nz, a[0] + nx, a[1], a[2] + nz, b[0] + nx, b[1], b[2] + nz, a[0] - nx, a[1], a[2] - nz, b[0] + nx, b[1], b[2] + nz, b[0] - nx, b[1], b[2] - nz);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const n = new Float32Array(pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  return ready(g, hex);
}

export function banjoGeometry() {
  const B = BANJO, P = B.pot, parts = [], seg = 20;
  // THE POT: the rim's outside and inside (open at the back), its back edge, the head and the hoop round it
  parts.push(ready(new THREE.CylinderGeometry(P.r, P.r, P.depth, seg, 1, true), C.rim, M(0, -P.depth / 2, 0)));
  parts.push(inward(ready(new THREE.CylinderGeometry(P.r - P.rim, P.r - P.rim, P.depth, seg, 1, true), C.rimIn, M(0, -P.depth / 2, 0))));
  parts.push(ready(new THREE.RingGeometry(P.r - P.rim, P.r, seg, 1), C.rimIn, M(0, -P.depth, 0, Math.PI / 2)));   // (the wood shows at the back edge)
  parts.push(ready(new THREE.CircleGeometry(P.r - 0.004, seg), C.head, M(0, B.head, 0, -Math.PI / 2)));
  parts.push(ready(new THREE.CylinderGeometry(P.r + 0.003, P.r + 0.003, 0.012, seg, 1, true), C.hoop, M(0, B.head - 0.003, 0)));
  parts.push(ready(new THREE.RingGeometry(P.r - 0.006, P.r + 0.003, seg, 1), C.hoop, M(0, B.head + 0.003, 0, -Math.PI / 2)));
  // THE NECK: from its heel on the rim to the nut, the black fingerboard on it; the peghead past the nut, a little
  // tipped back; the pegs out of its sides, the fifth string's out of the neck's upper side
  const N = B.neck, x0 = P.r - 0.012, top = 0.014, len = B.nut - x0;
  const neck = new THREE.BoxGeometry(len, N.t, (N.w0 + N.w1) / 2);
  parts.push(ready(neck, C.neck, M(x0 + len / 2, top - 0.004 - N.t / 2, 0)));
  parts.push(box(len, 0.005, (N.w0 + N.w1) / 2 + 0.002, C.board, M(x0 + len / 2, top - 0.0025, 0)));
  const PH = B.peghead, tip = -0.1;
  parts.push(box(PH.long, PH.t, PH.w, C.neck, M(B.nut + Math.cos(tip) * PH.long / 2, top - 0.006 + Math.sin(tip) * PH.long / 2, 0, 0, 0, tip)));
  parts.push(box(PH.long * 0.9, 0.003, PH.w + 0.002, C.board, M(B.nut + Math.cos(tip) * PH.long / 2, top - 0.0025 + Math.sin(tip) * PH.long / 2, 0, 0, 0, tip)));
  for (const [u, s] of [[0.35, -1], [0.7, -1], [0.35, 1], [0.7, 1]]) {
    const x = B.nut + Math.cos(tip) * PH.long * u, y = top - 0.008 + Math.sin(tip) * PH.long * u;
    parts.push(ready(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6, 1), C.peg, M(x, y, s * (PH.w / 2 + 0.015), Math.PI / 2)));
    parts.push(box(0.018, 0.006, 0.014, C.peg, M(x, y, s * (PH.w / 2 + 0.034))));
  }
  const x5 = fret(B.peg5);
  parts.push(ready(new THREE.CylinderGeometry(0.0035, 0.0035, 0.022, 6, 1), C.peg, M(x5, top - 0.012, -(N.w0 / 2 + 0.009), Math.PI / 2)));
  parts.push(box(0.013, 0.005, 0.012, C.peg, M(x5, top - 0.012, -(N.w0 / 2 + 0.024))));
  // THE FINGERBOARD'S FACE: nickel frets across it (flat lines, from the nut down to where the board meets the pot), the
  // pearl dots between the 5th, 7th, 10th, 12th, 15th and 17th frets' wires, and the bone nut
  const bw = (N.w0 + N.w1) / 2;
  for (let n = 1; fret(n) > x0 + 0.012; n++) parts.push(flat(fret(n), 0.0012, bw, top + 0.0004, 0, C.fret));
  for (const n of [5, 7, 10, 12, 15, 17]) {
    const x = (fret(n - 1) + fret(n)) / 2;
    if (x > x0 + 0.01) parts.push(ready(new THREE.CircleGeometry(0.0026, 8), C.pearl, M(x, top + 0.0003, 0, -Math.PI / 2)));
  }
  parts.push(box(0.004, 0.003, bw, C.bridge, M(B.nut - 0.002, top + 0.0015, 0)));
  // THE HOOKS round the pot: a nickel bracket every 30 degrees down the rim's outside, from the hoop (none on the neck)
  for (let i = 0; i < 12; i++) {
    const t = (i + 0.5) / 12 * Math.PI * 2;
    parts.push(box(0.003, 0.034, 0.006, C.hook, M(Math.cos(t) * (P.r + 0.004), B.head - 0.02, -Math.sin(t) * (P.r + 0.004), 0, t, 0)));
    parts.push(box(0.008, 0.006, 0.009, C.hook, M(Math.cos(t) * (P.r + 0.005), -0.036, -Math.sin(t) * (P.r + 0.005), 0, t, 0)));
  }
  // the bridge and the tailpiece
  parts.push(box(0.008, 0.013, 0.036, C.bridge, M(B.bridge, B.head + 0.0065, 0)));
  const T = B.tail; parts.push(box(T.long, 0.006, T.w, C.tail, M(-P.r + T.long / 2 + 0.006, B.head + 0.008, 0, 0, 0, -0.08)));
  // THE STRINGS: five thin steel ones (flat ribbons facing up, like the fiddle's), from the tailpiece's end over the
  // bridge; four on to the nut and the short fifth (on the -z side, by its peg) to its pip at the fifth fret
  const xT = -P.r + T.long + 0.004, yB = B.head + 0.0135;
  for (let i = 0; i < 5; i++) {
    const zB = -0.012 + i * 0.006, zT = zB * 0.6;
    const end = i ? [B.nut, top + 0.003, -0.0075 + (i - 1) * 0.005] : [fret(B.peg5), top + 0.0018, -(bw / 2 - 0.0025)];
    parts.push(strand([[xT, B.head + 0.0115, zT], [B.bridge, yB, zB], end], i ? 0.0005 : 0.00045, C.strings));
  }
  const geo = mergeGeometries(parts); for (const g of parts) g.dispose();
  geo.computeBoundingSphere();
  return geo;
}

// a plain stool: a round top on three splayed legs, a rung between two of them
export function stoolGeometry() {
  const S = STOOL, parts = [], t = 0.035;
  parts.push(ready(new THREE.CylinderGeometry(S.r, S.r, t, 14, 1), C.stoolTop, M(0, S.h - t / 2, 0)));
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + Math.PI / 6, out = 0.06, len = Math.hypot(S.h - t, out);
    const lean = Math.atan2(out, S.h - t), m = new THREE.Matrix4().makeRotationY(-a).multiply(M(0.1 + out / 2, (S.h - t) / 2, 0, 0, 0, lean));
    parts.push(ready(new THREE.CylinderGeometry(0.016, 0.019, len, 6, 1), C.stool, m));
  }
  parts.push(ready(new THREE.CylinderGeometry(0.011, 0.011, 0.24, 6, 1), C.stool, M(0, 0.15, 0.068, 0, 0, Math.PI / 2)));   // (between the legs at 30 and 150 degrees)
  const geo = mergeGeometries(parts); for (const g of parts) g.dispose();
  geo.computeBoundingSphere();
  return geo;
}

export function banjoMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 });
}
export function makeBanjoModel({ material = null } = {}) {
  const m = new THREE.Mesh(banjoGeometry(), material || banjoMaterial()); m.name = 'banjo';
  return m;
}
export function makeStoolModel({ material = null } = {}) {
  const m = new THREE.Mesh(stoolGeometry(), material || banjoMaterial()); m.name = 'banjo stool';
  return m;
}
