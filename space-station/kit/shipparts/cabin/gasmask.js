// THE GAS MASK, two ways (the game's maker, 2026-11-10, sending his model: "Honestly though it could probably be created
// using a few cylinders"):
//   hisMask(p, o)    HIS MODEL (gasmask.data.js, from his Tripo mesh): his shape, its points nearer than 1.3 cm (at a real
//                    mask's size) merged, so 1,111 triangles where he made 2,076 (rigs/medic-rooms/mask/maskdata.py, CELL
//                    0 there gives his whole mesh back), each
//                    painted one of a few flat colours read from his texture shrunk to 512 px (black and dark rubber, the
//                    greys of the straps and the filters' rims, the filters' yellow bands, the visor as dark glass), so
//                    it needs no texture or draw of its own and sits with the ship's flat-painted look. o.size: its width
//                    in metres (0.25, a real mask's).
//   cylMask(p, o)    THE SAME MASK FROM CYLINDERS (about 170 triangles): a rubber face piece, a dark visor, two filters
//                    on the cheeks with yellow bands, the speaking piece, a strap. o.size as above.
// Both face +z, stand on their lowest point at y 0, centred across, their back at z 0 (to hang on a hook on a wall: place
// with z at the wall's face).
import * as THREE from 'three';
import { add } from '../../bevel.js';
import { Q, BOX, GROUPS, POS, NRM, TRIS } from './gasmask.data.js';

const PI = Math.PI;
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
export function cylMask(p, o = {}) {
  const s = (o.size ?? 0.25) / 0.25, at = o.at || [0, 0, 0], R = (v) => v * s, P = MASK_PAINT;
  const part = (look, g, pos, rot) => { if (rot) g.rotateX(rot[0]).rotateY(rot[1]).rotateZ(rot[2]); g.translate(...pos.map(R)); add(p, look, g, at, o.rot || [0, 0, 0]); };
  // the face piece: a short wide cylinder on its back, flattened top to bottom (a rubber cup round the face)
  const face = new THREE.CylinderGeometry(R(0.105), R(0.085), R(0.07), 12, 1); face.scale(1, 1, 1.25);
  part(P.rubber, face, [0, 0.13, 0.035], [PI / 2, 0, 0]);
  // the visor: a dark glass disc set in the face piece's upper half, its rim
  part(P.visor, new THREE.CylinderGeometry(R(0.07), R(0.07), R(0.012), 12, 1), [0, 0.165, 0.075], [PI / 2, 0, 0]);
  part(P.grey, new THREE.TorusGeometry(R(0.072), R(0.008), 4, 12), [0, 0.165, 0.078], null);
  // the speaking piece under it, and the two filters on its cheeks, angled out and down, a yellow band round each
  part(P.grey, new THREE.CylinderGeometry(R(0.032), R(0.036), R(0.045), 10, 1), [0, 0.075, 0.08], [PI / 2, 0, 0]);
  for (const sx of [-1, 1]) {
    const rot = [PI / 2 + 0.35, 0, sx * 0.9];
    part(P.black, new THREE.CylinderGeometry(R(0.045), R(0.045), R(0.05), 10, 1), [sx * 0.085, 0.085, 0.075], rot);
    part(P.yellow, new THREE.CylinderGeometry(R(0.047), R(0.047), R(0.016), 10, 1, true), [sx * 0.089, 0.083, 0.078], rot);
    part(P.rim, new THREE.CylinderGeometry(R(0.034), R(0.034), R(0.006), 10, 1), [sx * 0.104, 0.075, 0.095], rot);
  }
  // the head strap: a band from each side round the back
  for (const sx of [-1, 1]) part(P.black, new THREE.BoxGeometry(R(0.012), R(0.02), R(0.06)), [sx * 0.11, 0.2, 0.02], null);
  return p;
}
