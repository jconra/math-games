// THE WILD APPLE TREE: a planting kind of its own (world/valley.js PLANT.APPLE), put down in the Town Lab like the other
// trees (one at a time, or painted). The forest draws its tree: the oak's model, made apple-tree sized and a fresher green,
// so it costs no new picture to bake. The red apples in its crown are the game's (src/feeding.js): they are picked, and
// grow back the next morning in the game, so they are drawn apart from the forest. appleSpots below says where in the
// crown they hang: on the outside of the leaves, where they can be seen.
//
//   APPLE_TREE              the kind's numbers (its id is valley.js's PLANT.APPLE)
//   appleSpots(root, n, seed) -> [[x, y, z], ...]   n spots on the crown's outside, in the model's own units (the forest
//                           scales and turns them with the tree: see valley.js appleTrees), the same n for the same seed
import * as THREE from 'three';

export const APPLE_TREE = {
  kind: 100,                   // the planting's kind id (past the props, the gate and the rocks' brush)
  species: 'oak',              // the forest's model it is drawn with
  height: 6.2,                 // m tall at size 1 (the oak is 18)
  hsl: [0.25, 0.42, 0.52],     // the leaves' tint: a fresher green than the woods'
  apples: 22,                  // apples drawn in a full tree's crown
  appleR: 0.1,                 // m: an apple's size (drawn big, so they read from the path and in the crown's shade)
  out: 0.14,                   // m: each apple hung this far out past its leaves, so the leaves don't hide it
};

const rnd = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
// the leaf cards' middles of a tree's model, in its own units, once a model (the crown's outside: those farthest out from
// the trunk's line at their height, and those near the top)
const CROWN = new WeakMap();
function crownOf(root) {
  let c = CROWN.get(root); if (c) return c;
  root.updateMatrixWorld(true);
  const pts = [], v = new THREE.Vector3(), m = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || !(o.material.alphaTest > 0 || /lea[fv]/i.test(o.material.name || ''))) return;
    const P = o.geometry.attributes.position;
    for (let i = 0; i + 3 < P.count; i += 4) {
      m.set(0, 0, 0); for (let k = 0; k < 4; k++) m.add(v.fromBufferAttribute(P, i + k).applyMatrix4(o.matrixWorld)); m.multiplyScalar(0.25);
      pts.push([m.x, m.y, m.z]);
    }
  });
  if (!pts.length) { CROWN.set(root, c = { out: [], top: 0 }); return c; }
  let lo = Infinity, hi = -Infinity; for (const p of pts) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
  // by height bands: the cards out past most of their band's reach are the outside
  const B = 8, bands = Array.from({ length: B }, () => []);
  for (const p of pts) bands[Math.min(B - 1, Math.floor((p[1] - lo) / (hi - lo + 1e-6) * B))].push(p);
  const out = [];
  for (const band of bands) {
    if (!band.length) continue;
    const r = band.map((p) => Math.hypot(p[0], p[2])).sort((a, b) => a - b), cut = r[Math.floor(r.length * 0.72)];
    for (const p of band) if (Math.hypot(p[0], p[2]) >= cut) out.push(p);
  }
  // (not the very top, nor the lowest skirt: apples hang in the middle of the crown's sides)
  c = { out: out.filter((p) => p[1] > lo + (hi - lo) * 0.18 && p[1] < lo + (hi - lo) * 0.9), top: hi };
  CROWN.set(root, c);
  return c;
}
export function appleSpots(root, n, seed = 1) {
  const { out } = crownOf(root); if (!out.length) return [];
  const r = rnd(seed), spots = [];
  // spread round the crown: each pick the farthest of a few tries from those already picked
  for (let k = 0; k < n; k++) {
    let best = null, bd = -1;
    for (let t = 0; t < 6; t++) {
      const p = out[Math.floor(r() * out.length)];
      let d = Infinity; for (const q of spots) d = Math.min(d, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2);
      if (d > bd) { bd = d; best = p; }
    }
    spots.push(best);
  }
  return spots;
}
