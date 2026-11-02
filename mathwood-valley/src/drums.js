// THE DRUMS, made in code (numbers: src/drumplan.js): a big rope-tuned bass drum with a skin head and a foot pedal's felt beater,
// a rope-tuned snare on a stand, a big cymbal on its own stand, each stick by itself. Plain colours on the vertices, one shared
// material: the kit one mesh and three small moving ones (kit.parts: beater, plate, cymbal), about 1800 triangles; a stick 24.
//   makeDrumKit({ material }) -> Mesh in the player's frame, makeStick({ material }) -> Mesh along +x from its butt
//   drumMaterial()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DRUMS as D } from './drumplan.js';

const C = { felt: '#d8cfb8', shell: '#7a4a26', hoop: '#4b2c17', skin: '#d9c9a4', rope: '#b9a884', ear: '#3a2616', brass: '#a98a3c', iron: '#2c2a28', stick: '#a9803f' };
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
    out.push(bar(rim(a, k), rim(b, -k), 0.0045, C.rope, 3), bar(rim(b, -k), rim(c, k), 0.0045, C.rope, 3));
    { const u = 0.62, E = (A, K, BB, L) => { const a0 = rim(A, K), b0 = rim(BB, L); return [a0[0] + (b0[0] - a0[0]) * u, a0[1] + (b0[1] - a0[1]) * u, a0[2] + (b0[2] - a0[2]) * u]; }; const p = E(a, k, b, -k), q0 = E(c, k, b, -k); out.push(bar(p, q0, r * 0.05 > 0.012 ? 0.012 : Math.max(0.007, r * 0.05), C.ear, 4)); }
  }
}
export function drumGeometry() {
  const P = [], B = D.bass, S = D.snare, Ped = D.pedal;
  // the bass drum, big, ropes and ears, on two iron feet
  drum(P, B.at, B.face, B.r, B.depth, 10);
  const f = new THREE.Vector3(...B.face), side = new THREE.Vector3().crossVectors(f, UP).normalize(), base = new THREE.Vector3(...B.at);
  for (const s of [-1, 1]) { const top = base.clone().addScaledVector(side, s * B.r * 0.55).setY(B.at[1] - B.r * 0.7); P.push(bar(top.toArray(), top.clone().addScaledVector(side, s * 0.12).setY(0.01).toArray(), 0.009, C.iron, 4)); }
  // the cymbal's stand: a post on three legs (the cymbal itself rides its own mesh, to shake)
  const Cy = D.cymbal;
  P.push(bar([Cy.at[0], 0.32, Cy.at[2]], [Cy.at[0], Cy.at[1] - 0.005, Cy.at[2]], 0.008, C.iron, 5));
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.3; P.push(bar([Cy.at[0], 0.34, Cy.at[2]], [Cy.at[0] + Math.cos(a) * 0.2, 0.01, Cy.at[2] + Math.sin(a) * 0.2], 0.006, C.iron, 4)); }
  // the snare: its axis upright, its top skin at S.at; a cradle on a post on three folding legs
  const mid = [S.at[0], S.at[1] - S.depth / 2, S.at[2]];
  drum(P, mid, [0, 1, 0], S.r, S.depth, 7);
  const low = mid[1] - S.depth / 2 - 0.005;
  P.push(bar([S.at[0], low, S.at[2]], [S.at[0], 0.26, S.at[2]], 0.01, C.iron, 5));
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5, x = Math.cos(a), z = Math.sin(a); P.push(bar([S.at[0] + x * S.r * 0.8, low + 0.005, S.at[2] + z * S.r * 0.8], [S.at[0], low - 0.1, S.at[2]], 0.005, C.iron, 4), bar([S.at[0], 0.28, S.at[2]], [S.at[0] + x * 0.2, 0.01, S.at[2] + z * 0.2], 0.006, C.iron, 4)); }
  // the pedal's frame: a base from the heel to two posts carrying the axle, brass
  const ax = Ped.axle, hl = Ped.heel, w = 0.05;
  P.push(bar([hl[0] - w, 0.012, hl[2]], [ax[0] - w, 0.012, ax[2] + 0.02], 0.007, C.brass, 4), bar([hl[0] + w, 0.012, hl[2]], [ax[0] + w, 0.012, ax[2] + 0.02], 0.007, C.brass, 4), bar([hl[0] - w, 0.012, hl[2]], [hl[0] + w, 0.012, hl[2]], 0.009, C.brass, 4));
  for (const s of [-1, 1]) P.push(bar([ax[0] + s * w, 0.012, ax[2] + 0.02], [ax[0] + s * w, ax[1], ax[2]], 0.007, C.brass, 4));
  P.push(bar([ax[0] - w, ax[1], ax[2]], [ax[0] + w, ax[1], ax[2]], 0.006, C.iron, 5));
  const g = mergeGeometries(P); for (const p of P) p.dispose();
  return g;
}
// what moves: the beater on its axle, the foot plate on its heel hinge, the cymbal on its post. Each a little mesh whose origin is its pivot
function moving(geos, at, material, name) { const g = mergeGeometries(geos); for (const p of geos) p.dispose(); const m = new THREE.Mesh(g, material); m.position.set(...at); m.name = name; m.castShadow = m.receiveShadow = false; return m; }
export function drumMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
  m.userData.indoorLit = true;   // (lit like the room: world/valley.js sunShadeAll)
  return m;
}
export function makeDrumKit({ material }) {
  const m = new THREE.Mesh(drumGeometry(), material); m.castShadow = false; m.receiveShadow = false; m.name = 'drums';
  const Ped = D.pedal, Cy = D.cymbal, hl = Ped.heel, tp = Ped.toe;
  const toZ = Math.hypot(tp[1] - hl[1], tp[2] - hl[2]), beater = moving([bar([0, 0, 0], [0, Ped.shaft, 0], 0.0065, C.iron, 5), ready(new THREE.SphereGeometry(Ped.ball, 10, 8).scale(1, 1, 0.8), C.felt, at([0, Ped.shaft, 0], new THREE.Quaternion()))], Ped.axle, material, 'beater');
  const plate = moving([ready(new THREE.BoxGeometry(0.1, 0.008, toZ).translate(0, 0, toZ / 2), C.brass)], hl, material, 'foot plate');
  plate.rotation.x = -Math.atan2(tp[1] - hl[1], tp[2] - hl[2]);
  const dish = (y, hex, flip) => { const c = new THREE.ConeGeometry(Cy.r, 0.022, 22, 1, true); if (flip) c.rotateX(Math.PI); return ready(c, hex, at([0, y, 0], new THREE.Quaternion())); };
  const cymbal = moving([dish(0.012, C.brass), dish(-0.012, '#7b6429', true), ready(new THREE.CylinderGeometry(0.03, 0.05, 0.016, 12), C.brass, at([0, 0.03, 0], new THREE.Quaternion()))], Cy.at, material, 'cymbal');
  m.add(beater, plate, cymbal); m.parts = { beater, plate, cymbal };
  return m;
}
export function makeStick({ material }) {
  const s = D.stick, g = new THREE.CylinderGeometry(s.r1, s.r0, s.long, 6, 1, false).rotateZ(-Math.PI / 2).translate(s.long / 2, 0, 0);
  const m = new THREE.Mesh(ready(g, C.stick), material); m.castShadow = false; m.receiveShadow = false; m.name = 'drumstick'; return m;
}
