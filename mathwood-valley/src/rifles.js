// THE TWO RIFLES OF THE 1880s (src/gun.js GUNS), made in code in the frame the six-shooter uses (src/revolver.js: forward
// is +z, the grip round the origin), so the rider's hand, the store's counter and the cabin's rack all take them alike:
//   lever    a lever-action repeater: an octagon barrel with the magazine tube under it, an open receiver, a short wood
//            fore-end and a looped lever under the wrist of the stock
//   single   a heavy long-range single-shot: a long thick octagon barrel, a square falling-block action with an S lever,
//            a tall ladder sight on the wrist, a long fore-end with a pewter tip
// Dark browned steel, oiled walnut and a little brass: no sling swivels, pistol grips, pump slides or box magazines.
//   makeRifleModel(kind) -> { gun (a Group), metal, matte, brass (its materials), muzzle (an Object3D at the muzzle) }
//   RIFLE_SHAPES         overall length and where the barrel ends (m)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const RIFLE_SHAPES = { lever: { barrel: 0.62, length: 1.08 }, single: { barrel: 0.82, length: 1.28 } };

const plain = (g) => { const o = g.index ? g.toNonIndexed() : g; o.deleteAttribute('uv'); o.computeVertexNormals(); return o; };
const box = (w, h, d, x, y, z, rx = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); g.translate(x, y, z); return plain(g); };
// a rod along z: sides 8 is an octagon barrel, more is round
const rod = (r, len, x, y, z0, sides = 10, r2 = r) => { const g = new THREE.CylinderGeometry(r2, r, len, sides); g.rotateX(Math.PI / 2); if (sides === 8) g.rotateZ(Math.PI / 8); g.translate(x, y, z0 + len / 2); return plain(g); };
// the butt stock's side outline, [z, y] going round, extruded across x
function stock(points, w) {
  const sh = new THREE.Shape(); points.forEach(([z, y], i) => (i ? sh.lineTo(z, y) : sh.moveTo(z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1 });
  g.translate(0, 0, -w / 2); g.rotateY(-Math.PI / 2);   // (the shape's x runs along +z)
  return plain(g);
}
function loop(r, tube, x, y, z, arc = Math.PI * 2) { const g = new THREE.TorusGeometry(r, tube, 6, 14, arc); g.rotateY(Math.PI / 2); g.translate(x, y, z); return plain(g); }

export function makeRifleModel(kind = 'lever') {
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, metalness: 0.55, roughness: 0.42, flatShading: true });
  const matte = new THREE.MeshStandardMaterial({ color: 0x5a3820, metalness: 0, roughness: 0.62, flatShading: true });
  const brass = new THREE.MeshStandardMaterial({ color: 0xa8863c, metalness: 0.65, roughness: 0.4, flatShading: true });
  const gun = new THREE.Group(), steel = [], wood = [], gold = [];
  const S = RIFLE_SHAPES[kind] || RIFLE_SHAPES.lever;
  const boreY = 0.05, rx = 0.02;   // (the bore's height over the grip; half the receiver's width)
  if (kind === 'single') {
    const br0 = 0.085;
    steel.push(rod(0.0165, S.barrel, 0, boreY, br0, 8, 0.0145));                       // the heavy octagon barrel
    steel.push(box(0.042, 0.066, 0.13, 0, boreY - 0.012, 0.03));                       // the square falling-block action
    steel.push(box(0.012, 0.03, 0.035, 0, boreY + 0.02, 0.0));                         // the side hammer
    steel.push(box(0.03, 0.006, 0.09, 0, boreY - 0.05, -0.012));                       // the guard's strap
    steel.push(loop(0.024, 0.0035, 0, boreY - 0.066, 0.0, Math.PI * 1.25));            // the S lever
    steel.push(box(0.004, 0.06, 0.012, 0, boreY - 0.005, -0.055));                     // the ladder sight's frame, up on the wrist
    steel.push(box(0.01, 0.005, 0.006, 0, boreY + 0.026, -0.055));
    steel.push(box(0.003, 0.016, 0.01, 0, boreY + 0.022, br0 + S.barrel - 0.03));      // the front blade
    wood.push(box(0.036, 0.03, 0.46, 0, boreY - 0.032, br0 + 0.23));                   // the long fore-end
    gold.push(box(0.037, 0.031, 0.022, 0, boreY - 0.032, br0 + 0.47));                 // its pewter-pale tip
    wood.push(stock([[-0.03, 0.028], [-0.09, 0.016], [-0.16, 0.008], [-0.44, -0.012], [-0.425, -0.122], [-0.33, -0.095], [-0.17, -0.044], [-0.08, -0.03], [-0.03, -0.012]], 0.034));
    gold.push(box(0.038, 0.114, 0.007, 0, -0.067, -0.436, 0.14));                             // the butt plate
    gold.push(box(0.0025, 0.022, 0.08, 0.018, -0.042, -0.29));                             // the patch box's lid
  } else {
    const br0 = 0.085;
    steel.push(rod(0.012, S.barrel, 0, boreY, br0, 8));                                // the octagon barrel
    steel.push(rod(0.0085, S.barrel - 0.04, 0, boreY - 0.023, br0, 10));               // the magazine tube under it
    steel.push(box(rx * 2, 0.06, 0.15, 0, boreY - 0.012, 0.01));                       // the receiver
    gold.push(box(rx * 2 + 0.001, 0.014, 0.05, 0, boreY - 0.03, 0.04));                // its loading gate and side plate
    steel.push(box(0.008, 0.028, 0.03, 0, boreY + 0.022, -0.05));                      // the hammer
    steel.push(box(0.025, 0.006, 0.09, 0, boreY - 0.044, -0.015));                     // the guard's strap
    steel.push(loop(0.03, 0.0035, 0, boreY - 0.076, -0.04));                           // the looped lever
    steel.push(box(0.004, 0.014, 0.03, 0, boreY + 0.018, 0.2));                        // the rear sight
    steel.push(box(0.003, 0.014, 0.008, 0, boreY + 0.018, br0 + S.barrel - 0.02));     // the front blade
    for (const z of [br0 + 0.21, br0 + S.barrel - 0.05]) steel.push(rod(0.0165, 0.012, 0, boreY - 0.011, z, 10));   // the barrel bands
    wood.push(box(0.03, 0.03, 0.2, 0, boreY - 0.03, br0 + 0.11));                      // the short fore-end
    wood.push(stock([[-0.05, 0.026], [-0.1, 0.014], [-0.17, 0.006], [-0.41, -0.012], [-0.395, -0.118], [-0.3, -0.09], [-0.16, -0.042], [-0.08, -0.028], [-0.05, -0.012]], 0.03));
    steel.push(box(0.034, 0.11, 0.007, 0, -0.065, -0.407, 0.14));                             // the crescent butt plate
  }
  const add = (list, mat) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = true; gun.add(m); for (const g of list) g.dispose(); };
  add(steel, metal); add(wood, matte); add(gold, brass);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, boreY, 0.085 + S.barrel); gun.add(muzzle);
  return { gun, metal, matte, brass, muzzle };
}
