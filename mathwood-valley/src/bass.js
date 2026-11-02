// THE UPRIGHT BASS, made in code (numbers: src/bassplan.js): a violin-family body with sloped shoulders, f-holes, a pale bridge, a black
// tailpiece and fingerboard, four strings, a scroll and brass tuners. Plain colours on the vertices, one mesh, about 1100 triangles.
//   makeBassModel({ material }) -> Mesh in its own frame; bassMaterial()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BASS as B, stringAt } from './bassplan.js';

const C = { top: '#8c4f22', rib: '#6d3a18', back: '#5a3014', edge: '#b37a3e', black: '#16100c', bridge: '#d7bd8a', string: '#c9c4b4', brass: '#b8923e', wood: '#6b3a18', hole: '#0c0705', pin: '#2c2a28' };
const col = new THREE.Color();
function ready(g, hex) {
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); if (!g.attributes.normal) g.computeVertexNormals();
  col.set(hex); const c = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < c.length; i += 3) c.set([col.r, col.g, col.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function tris(pts, hex) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.computeVertexNormals(); return ready(g, hex); }
const UP = new THREE.Vector3(0, 1, 0);
function bar(a, b, r, hex, n = 5) {
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
  return ready(new THREE.CylinderGeometry(r, r, d.length(), n).applyQuaternion(q).translate(...A.addScaledVector(d, 0.5).toArray()), hex);
}
const box = (at, s, hex) => ready(new THREE.BoxGeometry(...s).translate(...at), hex);
export function bassGeometry() {
  const P = [], O = B.outline, n = O.length;
  // the top and back: lofted across the outline, arched, smooth; the ribs, thinner at the sloped shoulders
  const ribAt = (x) => B.ribs + (B.ribsTop - B.ribs) * Math.max(0, Math.min(1, (x - 0.7) / 0.4));
  const AC = 8, ST = [];
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < 3; k++) { const u = k / 3, p0 = O[Math.max(0, i - 1)], p1 = O[i], p2 = O[i + 1], p3 = O[Math.min(n - 1, i + 2)], cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u); ST.push([cr(p0[0], p1[0], p2[0], p3[0]), Math.max(0.01, cr(p0[1], p1[1], p2[1], p3[1]))]); }
  ST.push(O[n - 1]);
  const skin = (yAt, hex, flip) => {
    const pos = [], idx = [], R = AC + 1;
    ST.forEach(([x, w]) => { for (let j = 0; j <= AC; j++) { const u = j / AC * 2 - 1; pos.push(x, yAt(x, u, w), u * w); } });
    for (let i = 0; i < ST.length - 1; i++) for (let j = 0; j < AC; j++) { const a = i * R + j, b = a + 1, c = a + R, d = c + 1; if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return ready(g, hex);
  };
  const arch = (x, u, w) => 0.032 * (1 - u * u) * Math.min(1, w / 0.2);
  P.push(skin((x, u, w) => arch(x, u, w), C.top, false), skin((x, u, w) => -ribAt(x) - 0.6 * arch(x, u, w), C.back, true));
  for (const s of [-1, 1]) { const pos = [], idx = []; ST.forEach(([x, w]) => pos.push(x, 0, s * w, x, -ribAt(x), s * w)); for (let i = 0; i < ST.length - 1; i++) { const a = i * 2; if (s > 0) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); P.push(ready(g, C.rib)); }
  // the edge's pale line round the top
  for (const s of [-1, 1]) for (let i = 0; i < ST.length - 1; i += 2) { const [x0, w0] = ST[i], [x1, w1] = ST[Math.min(ST.length - 1, i + 2)]; P.push(bar([x0, 0.002, s * w0], [x1, 0.002, s * w1], 0.0055, C.edge, 4)); }
  // the f-holes: a long thin stem, a round eye at each end
  for (const s of [-1, 1]) {
    const f = (x, z) => [x, 0.027, s * z];
    P.push(bar(f(0.3, 0.135), f(0.42, 0.125), 0.011, C.hole, 4), bar(f(0.42, 0.125), f(0.56, 0.095), 0.011, C.hole, 4), bar(f(0.3, 0.135), f(0.27, 0.16), 0.006, C.hole, 4), bar(f(0.56, 0.095), f(0.585, 0.07), 0.006, C.hole, 4));
    P.push(ready(new THREE.SphereGeometry(0.021, 7, 5).scale(1, 0.25, 1).translate(0.268, 0.024, s * 0.17), C.hole), ready(new THREE.SphereGeometry(0.014, 7, 5).scale(1, 0.25, 1).translate(0.59, 0.029, s * 0.064), C.hole));
  }
  // the bridge, standing on the top between the f-holes
  const Br = B.bridge;
  P.push(box([Br.x, Br.h * 0.66, 0], [0.012, Br.h * 0.68, Br.w * 2.2], C.bridge));
  for (const s of [-1, 1]) P.push(box([Br.x, Br.h * 0.17, s * 0.075], [0.03, Br.h * 0.34, 0.05], C.bridge));
  // the tailpiece, black, on its wire from the end; the endpin
  const T = B.tail;
  { const y0 = 0.05, y1 = 0.09, a = [T.from, y0, -T.w0], b = [T.from, y0, T.w0], c = [T.to, y1, T.w1], d = [T.to, y1, -T.w1]; P.push(tris([a, b, c, a, c, d, a, c, b, a, d, c], C.black)); P.push(bar([0.0, 0.015, 0], [T.from, y0, 0], 0.005, C.black, 4)); }
  P.push(bar([-B.endpin, -0.1, 0], [0.01, -0.1, 0], 0.009, C.pin, 5));
  // the neck, the fingerboard, the heel
  const Fb = B.fingerboard, Nk = B.neck;
  { const y0 = Fb.y0, y1 = Fb.y1, t = Fb.t, q = (x, y, z) => [x, y, z], a0 = q(Fb.from, y0, -Fb.w0 / 2), b0 = q(Fb.from, y0, Fb.w0 / 2), a1 = q(Fb.to, y1, -Fb.w1 / 2), b1 = q(Fb.to, y1, Fb.w1 / 2), A0 = q(Fb.from, y0 + t, -Fb.w0 / 2), B0 = q(Fb.from, y0 + t, Fb.w0 / 2), A1 = q(Fb.to, y1 + t, -Fb.w1 / 2), B1 = q(Fb.to, y1 + t, Fb.w1 / 2);
    P.push(tris([A0, B0, B1, A0, B1, A1, a0, a1, A1, a0, A1, A0, b0, B0, B1, b0, B1, b1, a0, b0, B0, a0, B0, A0], C.black)); }
  // (round on its back, for a hand to go round: a flattened cylinder, thicker toward the body; its top under the fingerboard, so no wood shows through the black)
  P.push(ready(new THREE.CylinderGeometry(Nk.w1 / 2, Nk.w1 / 2 + 0.004, 0.46, 10).rotateZ(-Math.PI / 2).scale(1, (Nk.t / Nk.w1) * 1.05, 1).translate(1.31, Fb.y1 - (Nk.t / 2) * 1.05 - 0.0005, 0), C.wood));
  P.push(ready(new THREE.BoxGeometry(0.15, 0.1, Nk.w0).translate(1.09, 0.03, 0), C.wood));
  // the pegbox and scroll; brass plates and four tuners with their keys
  const px = B.nut;
  P.push(box([px + 0.11, Fb.y1 - 0.01, 0], [0.22, 0.05, 0.05], C.wood));
  P.push(ready(new THREE.CylinderGeometry(0.045, 0.045, 0.045, 12).rotateX(Math.PI / 2).translate(px + 0.255, Fb.y1 + 0.005, 0), C.wood), ready(new THREE.CylinderGeometry(0.028, 0.028, 0.055, 10).rotateX(Math.PI / 2).translate(px + 0.26, Fb.y1 + 0.012, 0), C.top));
  for (const s of [-1, 1]) {
    P.push(box([px + 0.11, Fb.y1 - 0.01, s * 0.028], [0.17, 0.042, 0.004], C.brass));
    for (const k of [0, 1]) { const x = px + 0.05 + k * 0.11; P.push(bar([x, Fb.y1 - 0.01, s * 0.028], [x, Fb.y1 - 0.01, s * 0.075], 0.004, C.brass, 5), box([x, Fb.y1 - 0.01, s * 0.082], [0.03, 0.005, 0.016], C.brass)); }
  }
  // the nut: a pale bar the strings cross where the fingerboard ends
  P.push(box([B.nut + 0.002, Fb.y1 + Fb.t + 0.001, 0], [0.012, 0.008, Fb.w1 + 0.002], C.bridge));
  // the strings, nut to bridge to tailpiece
  for (let k = 0; k < 4; k++) {
    const a = stringAt(k, B.nut), b = stringAt(k, B.bridge.x), r = 0.0022 - k * 0.0003;
    P.push(bar(a, b, r, C.string, 3), bar(b, [T.to, 0.088, (k - 1.5) * 0.04], r, C.string, 3));
    P.push(bar(a, [B.nut + 0.06 + (k % 2) * 0.1, Fb.y1, (k < 2 ? -1 : 1) * 0.015], r, C.string, 3));
  }
  const g = mergeGeometries(P); for (const p of P) p.dispose();
  return g;
}
export function bassMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
  m.userData.indoorLit = true;   // (lit like the room: world/valley.js sunShadeAll)
  return m;
}
export function makeBassModel({ material }) { const m = new THREE.Mesh(bassGeometry(), material); m.name = 'bass'; m.castShadow = false; m.receiveShadow = false; return m; }
