// THE GAS MASK: the game's maker's own model, the only one. (A mask built from cylinders was tried and he asked that it
// not be used, 2026-11-10: "thats not how I would have built a gas mask lens with cylinders. Please dont use that. If it
// gets rebuilt then the lens should be curved like the 3d one." So any mask built again must have a curved lens, as his
// model's visor is.)
//   hisMask(p, o)    HIS MODEL (gasmask.data.js, from his Tripo mesh): his shape, its points nearer than 1.3 cm (at a real
//                    mask's size) merged, so 1,111 triangles where he made 2,076 (rigs/medic-rooms/mask/maskdata.py, CELL
//                    0 there gives his whole mesh back), each painted one of a few flat colours read from his texture
//                    shrunk to 512 px (black and dark rubber, the greys of the straps and the filters' rims, the filters'
//                    yellow bands, the visor as dark glass), so it needs no texture or draw of its own and sits with the
//                    ship's flat-painted look. o.size: its width in metres (0.25, a real mask's).
// It faces +z, stands on its lowest point at y 0, centred across, its back at z 0 (to hang on a hook on a wall: place with
// z at the wall's face).
import * as THREE from 'three';
import { add } from '../../bevel.js';
import { Q, BOX, GROUPS, POS, NRM, TRIS } from './gasmask.data.js';

export const MASK_PAINT = {
  black: { c: '#17181a', r: 0.78, m: 0.0, w: 0.25 }, rubber: { c: '#25272a', r: 0.7, m: 0.0, w: 0.3 }, grey: { c: '#3b3e42', r: 0.6, m: 0.15, w: 0.35 },
  strap: { c: '#55585c', r: 0.6, m: 0.2, w: 0.35 }, rim: { c: '#8b8f95', r: 0.4, m: 0.6, w: 0.4 }, yellow: { c: '#e0b01c', r: 0.5, m: 0.0, w: 0.35 },
  visor: { c: '#1c2833', r: 0.08, m: 0.4, w: 0.05 },
};
const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let MESH = null;
function mesh() {
  if (MESH) return MESH;
  const pb = bytes(POS), nb = bytes(NRM), tb = bytes(TRIS);
  MESH = { pos: new Int16Array(pb.buffer, pb.byteOffset, pb.byteLength / 2), nrm: new Int8Array(nb.buffer, nb.byteOffset, nb.byteLength), tris: new Uint16Array(tb.buffer, tb.byteOffset, tb.byteLength / 2) };
  return MESH;
}
export function hisMask(p, o = {}) {
  const M = mesh(), k = (o.size ?? 0.25) / (BOX[1] - BOX[0]), zb = BOX[4];
  let t0 = 0;
  for (const [paint, n] of GROUPS) {
    // (each paint's triangles as their own small mesh, its points copied out of the whole)
    const map = new Map(), pos = [], nrm = [], idx = [];
    for (let t = t0; t < t0 + n; t++) for (let c = 0; c < 3; c++) {
      const v = M.tris[t * 3 + c];
      if (!map.has(v)) { map.set(v, pos.length / 3); pos.push(M.pos[v * 3] / Q * k, (M.pos[v * 3 + 1] / Q - BOX[2]) * k, (M.pos[v * 3 + 2] / Q - zb) * k); nrm.push(M.nrm[v * 3] / 127, M.nrm[v * 3 + 1] / 127, M.nrm[v * 3 + 2] / 127); }
      idx.push(map.get(v));
    }
    t0 += n;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
    add(p, MASK_PAINT[paint], g, o.at || [0, 0, 0], o.rot || [0, 0, 0]);
  }
  return p;
}
