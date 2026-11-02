// THE DRUMS, made in code (numbers: src/drumplan.js): a rope-tuned bass drum with a small brass cymbal on a post, a snare on
// a folding stand, each stick by itself. Plain colours on the vertices, one mesh and one shared material for the drums,
// about 900 triangles; a stick 24.
//   makeDrumKit({ material }) -> Mesh in the player's frame, makeStick({ material }) -> Mesh along +x from its butt
//   drumMaterial()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DRUMS as D } from './drumplan.js';

const C = { shell: '#7a4a26', hoop: '#4b2c17', skin: '#d9c9a4', rope: '#b9a884', ear: '#3a2616', brass: '#a98a3c', iron: '#2c2a28', stick: '#a9803f' };
const col = new THREE.Color();
function ready(g, hex, m) {
  if (m) g.applyMatrix4(m);
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv');
  col.set(hex); const c = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < c.length; i += 3) c.set([col.r, col.g, col.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
const UP = new THREE.Vector3(0, 1, 0), v0 = new THREE.Vector3(), v1 = new THREE.Vector3();
const at = (p, q) => new THREE.Matrix4().compose(new THREE.Vector3(...p), q, new THREE.Vector3(1, 1, 1));
// a thin round bar from a to b
function bar(a, b, r, hex, n = 5) {
  v0.set(...a); v1.set(...b); const d = v1.clone().sub(v0), q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
  return ready(new THREE.CylinderGeometry(r, r, d.length(), n), hex, at(v0.clone().addScaledVector(d, 0.5).toArray(), q));
}
// a drum: its axis along `axis` through `mid`; hoops at both ends, skins, the ropes zigzag between the hoops with their leather ears
function drum(out, mid, axis, r, depth, ropes) {
  const ax = new THREE.Vector3(...axis).normalize(), q = new THREE.Quaternion().setFromUnitVectors(UP, ax), m = (k) => at(new THREE.Vector3(...mid).addScaledVector(ax, k).toArray(), q);
  out.push(ready(new THREE.CylinderGeometry(r, r, depth, 18, 1, true), C.shell, m(0)));
  for (const s of [-1, 1]) {
    out.push(ready(new THREE.CylinderGeometry(r * 1.025, r * 1.025, depth * 0.14 + 0.01, 18, 1, true), C.hoop, m(s * depth * 0.45)));
    out.push(ready(new THREE.RingGeometry(r * 0.96, r * 1.025, 18).rotateX(s > 0 ? -Math.PI / 2 : Math.PI / 2), C.hoop, m(s * depth * 0.52)));
    out.push(ready(new THREE.CircleGeometry(r * 0.97, 18).rotateX(s > 0 ? -Math.PI / 2 : Math.PI / 2), C.skin, m(s * depth * 0.505)));
  }
  const side = new THREE.Vector3(1, 0, 0).applyQuaternion(q), other = new THREE.Vector3(0, 0, 1).applyQuaternion(q), M = new THREE.Vector3(...mid);
  const rim = (a, k) => M.clone().addScaledVector(side, Math.cos(a) * r * 1.03).addScaledVector(other, Math.sin(a) * r * 1.03).addScaledVector(ax, k).toArray();
  for (let i = 0; i < ropes; i++) {
    const a = i / ropes * Math.PI * 2, b = (i + 0.5) / ropes * Math.PI * 2, c = (i + 1) / ropes * Math.PI * 2, k = depth * 0.42;
    out.push(bar(rim(a, k), rim(b, -k), 0.0032, C.rope, 3), bar(rim(b, -k), rim(c, k), 0.0032, C.rope, 3));
  }
}
export function drumGeometry() {
  const P = [], B = D.bass, S = D.snare;
  drum(P, B.at, B.face, B.r, B.depth, 8);
  // the bass drum's two feet, so it stands, and the cymbal on its post
  const f = new THREE.Vector3(...B.face), side = new THREE.Vector3().crossVectors(f, UP).normalize(), base = new THREE.Vector3(...B.at);
  for (const s of [-1, 1]) { const top = base.clone().addScaledVector(side, s * B.r * 0.5).setY(B.at[1] - B.r * 0.75); P.push(bar(top.toArray(), top.clone().addScaledVector(side, s * 0.1).setY(0.01).toArray(), 0.008, C.iron, 4)); }
  const cy = B.at[1] + B.r, post = D.cymbal.post;
  P.push(bar([B.at[0], cy - 0.01, B.at[2]], [B.at[0], cy + post + 0.012, B.at[2]], 0.005, C.iron, 5));
  const dish = new THREE.ConeGeometry(D.cymbal.r, 0.018, 16, 1, true);
  P.push(ready(dish, C.brass, at([B.at[0], cy + post, B.at[2]], new THREE.Quaternion())));
  const under = new THREE.ConeGeometry(D.cymbal.r, 0.018, 16, 1, true).rotateX(Math.PI);
  P.push(ready(under, '#7b6429', at([B.at[0], cy + post - 0.019, B.at[2]], new THREE.Quaternion())));
  // the snare: its axis upright, its top skin at S.at, a little tipped toward him; three folding legs
  const mid = [S.at[0], S.at[1] - S.depth / 2, S.at[2]];
  drum(P, mid, [0, 1, 0], S.r, S.depth, 6);
  const low = mid[1] - S.depth / 2 - 0.005;
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5, x = Math.cos(a), z = Math.sin(a); P.push(bar([S.at[0] + x * S.r * 0.75, low, S.at[2] + z * S.r * 0.75], [S.at[0] - x * 0.2, 0.01, S.at[2] - z * 0.2], 0.006, C.iron, 4)); }
  const g = mergeGeometries(P); for (const p of P) p.dispose();
  return g;
}
export function drumMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
  m.userData.indoorLit = true;   // (lit like the room: world/valley.js sunShadeAll)
  return m;
}
export function makeDrumKit({ material }) { const m = new THREE.Mesh(drumGeometry(), material); m.castShadow = false; m.receiveShadow = false; m.name = 'drums'; return m; }
export function makeStick({ material }) {
  const s = D.stick, g = new THREE.CylinderGeometry(s.r1, s.r0, s.long, 6, 1, false).rotateZ(-Math.PI / 2).translate(s.long / 2, 0, 0);
  const m = new THREE.Mesh(ready(g, C.stick), material); m.castShadow = false; m.receiveShadow = false; m.name = 'drumstick'; return m;
}
