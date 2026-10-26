// SOFT SHADING for the low-poly animals and people (Quaternius' packs come flat: every face lit as one plane, which sits
// oddly beside the smooth, textured Tripo buildings and saddles). softShade(geometry) gives back a copy with new normals
// (the direction each corner faces: all the lighting reads): smooth across any edge that bends less than SOFT.angle
// degrees, a hard edge where it bends more, so bodies, faces and shirts come out round while hooves, hat brims and cuffs
// stay crisp. The bones, the clips and the colours are untouched. SOFT.angle = 0: flat, as the files come. Set it before
// the animals and people are loaded (they are softened once, as they load).
import * as THREE from 'three';
import { toCreasedNormals, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const SOFT = { angle: 75 };

export function softShade(geometry, angle = SOFT.angle) {
  if (!angle || !geometry.attributes.normal) return geometry;
  const tri = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  // toCreasedNormals finds the corners that share a spot on a grid of 1/100 of a unit, and these files are packed into
  // -1..1 (about a centimetre), so it runs on a stand-in blown up until the grid is a millionth of the model (fingers,
  // eyes and hair a few millimetres apart would be lumped together otherwise); only its normals are kept
  tri.computeBoundingBox();
  const p = tri.attributes.position, k = 2e4 / tri.boundingBox.getSize(new THREE.Vector3()).length(), big = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { big[i * 3] = p.getX(i) * k; big[i * 3 + 1] = p.getY(i) * k; big[i * 3 + 2] = p.getZ(i) * k; }
  const stand = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(big, 3));
  tri.setAttribute('normal', toCreasedNormals(stand, angle * Math.PI / 180).attributes.normal);
  return mergeVertices(tri);                // (corners that now agree in everything are shared again: fewer to bend with the bones)
}
