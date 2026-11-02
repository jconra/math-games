// WHAT THE BAND HOLDS, put in their hands: the harmonica (each frame between her hands), the fiddle and the bow on the
// fiddler's wrist bones where his clips hold them (src/fiddleplan.js HOLD), the banjo on the banjo player's lap and his
// stool under him (src/banjoplan.js PLACE). One piece of code for the stage (src/stage.js) and the Hands Lab (labs/hands).
//   makeHarmonicaModel(H), placeHarmonicaOn(P, harmonica, H)   H: STAGE.harp's sizes
//   holdFiddleOn(P) -> { fiddle, bow, mat }, holdBanjoOn(P) -> { banjo, stool, mat }, holdDrumsOn(P) -> { kit, stool, stickL, stickR, mat }
import * as THREE from 'three';
import { makeFiddleModel, makeBowModel, fiddleMaterial } from './fiddle.js';
import { holdMatrix } from './fiddleplan.js';
import { makeBanjoModel, makeStoolModel, banjoMaterial } from './banjo.js';
import { placeMatrix } from './banjoplan.js';
import { makeDrumKit, makeStick, drumMaterial } from './drums.js';
import { makeBassModel, bassMaterial } from './bass.js';
import { placeMatrix as bassPlace } from './bassplan.js';

// a little metal box with the wooden comb showing along its front, so the cupped hands read as playing one
export function makeHarmonicaModel(H) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xd4d8dc, metalness: 0.35, roughness: 0.3 });   // (the world has no reflections to show, so a fully metal surface would look black)
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4426, metalness: 0, roughness: 0.8 });
  metal.userData.indoorLit = wood.userData.indoorLit = true;   // (lit like the room: world/valley.js sunShadeAll)
  const cover = new THREE.Mesh(new THREE.BoxGeometry(H.long, H.tall, H.deep * 0.8), metal); cover.position.z = -H.deep * 0.1;
  const comb = new THREE.Mesh(new THREE.BoxGeometry(H.long * 0.96, H.tall * 0.4, H.deep), wood);
  g.add(cover, comb);
  return g;
}
const HB = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), x: new THREE.Vector3(),
  y: new THREE.Vector3(), z: new THREE.Vector3(), m: new THREE.Matrix4() };
// along the line between her hands, its front facing out
export function placeHarmonicaOn(P, harmonica, H) {
  const B = P.bones; if (!B.WristL || !B.WristR || !B.Index1L || !B.Index1R) return;
  const { a, b, c, d, x, y, z, m } = HB;
  B.WristL.getWorldPosition(a); B.WristR.getWorldPosition(b); B.Index1L.getWorldPosition(c); B.Index1R.getWorldPosition(d);
  const mid = c.add(d).add(a).add(b).multiplyScalar(0.25);
  x.subVectors(B.Index1L.getWorldPosition(a), B.Index1R.getWorldPosition(d)).normalize();   // (toward her left hand)
  z.set(Math.sin(P.root.rotation.y), 0, Math.cos(P.root.rotation.y));                        // (the way she faces)
  y.crossVectors(z, x).normalize(); z.crossVectors(x, y);
  m.makeBasis(x, y, z); harmonica.quaternion.setFromRotationMatrix(m);
  harmonica.position.copy(mid).addScaledVector(z, -H.back).addScaledVector(y, H.up);
}
// carried on his wrist bones, so they go wherever his hands go
export function holdFiddleOn(P) {
  const B = P.bones; if (!B.WristL || !B.WristR) return null;
  const mat = fiddleMaterial(), fiddle = makeFiddleModel({ material: mat }), bow = makeBowModel({ material: mat });
  mat.userData.indoorLit = true;   // (lit like the room, as the players are: world/valley.js sunShadeAll)
  for (const [m, bone, which] of [[fiddle, B.WristL, 'fiddle'], [bow, B.WristR, 'bow']]) {
    m.matrixAutoUpdate = false; m.matrix.fromArray(holdMatrix(which)); m.castShadow = false; m.receiveShadow = false;
    bone.add(m);
  }
  return { fiddle, bow, mat };
}
// the banjo rides his root where his clips have it (the clips are made round the same numbers)
export function holdBanjoOn(P) {
  const mat = banjoMaterial(), banjo = makeBanjoModel({ material: mat }), stool = makeStoolModel({ material: mat });
  mat.userData.indoorLit = true;
  banjo.matrixAutoUpdate = false; banjo.matrix.fromArray(placeMatrix());
  for (const m of [banjo, stool]) { m.castShadow = false; m.receiveShadow = false; P.root.add(m); }
  return { banjo, stool, mat };
}
// the drummer's drums (src/drums.js) ride his root, his stool under him; a stick in each hand (the file's numbers place them)
export function holdDrumsOn(P) {
  const mat = drumMaterial(), kit = makeDrumKit({ material: mat }), stool = makeStoolModel({ material: banjoMaterial() }), stickL = makeStick({ material: mat }), stickR = makeStick({ material: mat });
  stool.material.userData.indoorLit = true; stool.castShadow = stool.receiveShadow = false;
  P.root.add(kit, stool, stickL, stickR);
  return { kit, stool, stickL, stickR, mat, parts: kit.parts };
}
// the upright bass stands where his root has it, leaning back on him; he has no clips of his own yet: the fiddler's standing ones
// (his foot keeps the beat, his weight shifts) under the numbers of models/people/hands.json
export function addBassClips(folk, body = 'm') {
  const base = folk.clips[body].find((c) => c.name === 'Fiddle_Rest'); if (!base) return;
  folk.addClips(body, ['Play_Bass', 'Bass_Rest'].map((name) => { const c = base.clone(); c.name = name; return c; }));
}
export function holdBassOn(P) {
  const mat = bassMaterial(), bass = makeBassModel({ material: mat });
  bass.matrixAutoUpdate = false; bass.matrix.fromArray(bassPlace());
  P.root.add(bass);
  return { bass, mat };
}
