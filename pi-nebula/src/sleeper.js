// ONE OF OUR CREW ASLEEP IN A STASIS POD (the pod: kit/stasispod.js). For the Medic's rescue runs: nobody is hurt, they
// are asleep in a pod, safe until it is opened. A person of the crew kit (kit/crew.js), one of the people the title
// offers (src/looks.js: the eight, not the androids), lying on the pod's bed as the big scanner's patient lies
// (src/onbed.js 'lying': on the back, the legs straight, the feet fallen outward), the arms down by the sides, the hands
// flat on the bed beside the hips (onbed.js's own, as at the start of its 'stretch': the scanner's patient has them on
// the belly, the elbows out on the bed, which here reach through the pod's sides: his bed is 0.53 m wide); laid on by
// src/moves.js as for the scanner (people.js bedPoseOf), the head at the head rest's end, and then the whole person
// moved along the bed so the room left at the head and at the feet is the same. Posed once and left still (nothing
// plays while they sleep: no clip runs after the pose is laid on), so one costs only its drawing. The crew kit's eyes
// have no lids that close: they look straight up.
// THEIR POSITION'S COLOUR (his answer STAS1-3 C: "I like it when it looks like they are wearing certain colors for their
// position like red-Captain, purple-engineer, yellow-drill or whatever"): given a position (kit/stasispod-plan.js
// POSITIONS), the uniform's bands (the crew kit's colours.uniform: the grey uniform's chest and side panels, the dark
// one's stripes) take its colour; a look in a jacket (which has no bands) wears the crew uniform of its build instead
// (CREW_UNIFORM), so every one of a crashed crew wears their position's colour.
//
//   SLEEPERS                                    the looks a sleeper may be (src/looks.js ids)
//   const S = await makeSleeper(lib, look, pod, { far, position })   lib: the crew kit's (loadCrew); look: a looks.js
//                                               id; pod: a kit/stasispod.js pod (its bed); S.root is added to pod.body,
//                                               where it lies; far: the crew kit's far copies made ready; position: a
//                                               POSITIONS id (none: the look's own clothes)
//   S.c (the crew kit's person), S.look, S.position, S.box (its extent lying, in the pod: { min, max } [x, y, z]),
//   S.setFar(on), S.count() -> { draws, tris } (its meshes shown), S.dispose()
import * as THREE from 'three';
import { makeCrew } from '../kit/crew.js';
import { addMoves } from './moves.js';
import { pose } from './onbed.js';
import { LOOKS, recipeOf } from './looks.js';
import { STAND } from './player.js';     // (the clip under the scanner's patient lying: the standing one, people.js)
import { POSITIONS } from '../kit/stasispod-plan.js';

export const SLEEPERS = LOOKS.filter((l) => !/^android/.test(l.id)).map((l) => l.id);
// the crew uniforms (the outfits with bands), by the build of the body (the suit's skeleton: 'm', 'f')
export const CREW_UNIFORM = { m: 'atlantis1', f: 'atlantis2' };
// a look's recipe as it sleeps in a pod: in its position's colour (a look in a jacket in the crew uniform of its build)
export function sleeperRecipe(lib, look, position = null) {
  const R = recipeOf({ id: look }, lib), P = POSITIONS[position];
  if (!P) return R;
  const suit = lib.entry ? lib.entry('suit', R.suit) : null, wear = Object.values(CREW_UNIFORM).includes(R.suit) ? R.suit : CREW_UNIFORM[suit && suit.skeleton] || R.suit;
  return { ...R, suit: wear, colours: { ...(R.colours || {}), uniform: P.colour } };
}
// (the arm at rest: the wrist this share of the arm's length from the shoulder; how far the body sinks into the padded
// bed, metres; the feet at rest: pointed past square to the shin and turned outward (radians; onbed.js's own lying
// feet, 0.34 and 0.28, stand nearly upright, and under his lid, which comes down toward the pod's front, the toes came
// up through it by as much as 16 cm))
export const SLEEP = { reach: 0.98, sink: 0.015, point: 0.75, roll: 0.12 };

const _e = new THREE.Euler();
// bed (src/onbed.js's frame) -> the pod's: a point, a way
const pt = (F, v) => new THREE.Vector3(...F.toPod(v[0], v[1], v[2]));
const way = (v) => new THREE.Vector3(-v[2], v[1], v[0]);
export async function makeSleeper(lib, look, pod, { far = false, position = null } = {}) {
  const c = await makeCrew(lib, sleeperRecipe(lib, look, position), { far });
  const M = addMoves(c), who = M.body, F = pod.bed;
  // the legs, the hips and the head as the scanner's patient lies (its 'lying'); the arms as they are before the hands
  // go to the belly (its 'stretch' at its start: the hands flat on the bed beside the hips)
  const p = pose('lying', 0, F.bed, who), arms = pose('stretch', 0, F.bed, who);
  const D = {
    hips: pt(F, p.hips), feet: p.feet.map((f) => pt(F, f)), pole: way(p.pole), ahead: way([Math.sin(p.heading), 0, Math.cos(p.heading)]),
    hands: arms.hands.map((h) => pt(F, h)), fingers: arms.fingers.map(way), elbows: arms.elbows.map(way),
    legs: p.legs, flat: p.flat, arms: arms.arms, armsLR: null, chin: p.chin || 0, point: SLEEP.point, pitch: p.pitch || 0, roll: SLEEP.roll, curl: p.curl || 0, turn: 0, twist: 0, look: null,
  };
  const h = Math.atan2(D.ahead.x, D.ahead.z);
  // posed where it lies in the pod's own frame (the root by itself, so the pod's frame is the world's while the pose is
  // laid on), then put into the pod: it rides with it from then on
  c.root.quaternion.setFromEuler(_e.set(-p.lean, h, 0, 'YXZ'));
  c.root.position.copy(M.hipAt).applyQuaternion(c.root.quaternion).negate().add(D.hips);
  M.bed = D;
  c.play(STAND, { fade: 0 });
  c.lookAt(null);
  for (let k = 0; k < 3; k++) { c.root.updateMatrixWorld(true); c.update(1 / 60); }
  // (the crew kit turns the upper arms out after the moves, by its standing clip's own angle, so standing arms clear the
  // hips: lying, that carries the hands off the bed and through the pod's side. The person's own update once more, the
  // clock still, lays the bed pose on again without it: the hands where onbed.js puts them; the feet stay at the shins'
  // ends, the legs being where they were)
  // (and onbed.js's hands beside the hips are where they are put down to push from, the arms folded: at rest the arm
  // lies straight down the side. Each hand slid along the bed toward the feet, its height and its place across kept,
  // until it is SLEEP.reach of the arm's length from the shoulder)
  const toFeet = new THREE.Vector3(-1, 0, 0), sh = new THREE.Vector3(), d = new THREE.Vector3(), reach = (who.u + who.f) * SLEEP.reach;
  [['L', 0], ['R', 1]].forEach(([s, i]) => {
    const U = c.bones['UpperArm' + s]; if (!U) return;
    U.getWorldPosition(sh); d.subVectors(D.hands[i], sh);
    const b = d.dot(toFeet), cc = d.lengthSq() - reach * reach, disc = b * b - cc;
    if (disc > 0) { const t = -b + Math.sqrt(disc); if (t > 0) D.hands[i].addScaledVector(toFeet, t); }
  });
  c.root.updateMatrixWorld(true); c.person.update(0); c.root.updateMatrixWorld(true);
  // its extent lying (its meshes as the bones have them), and the whole person moved along the bed so the room at the
  // head and at the feet is the same, and sunk a little into the pad
  const extent = () => { c.root.updateMatrixWorld(true); const b = new THREE.Box3(); c.root.traverse((o) => { if (o.isSkinnedMesh && o.visible && o.geometry.attributes.skinIndex) { o.computeBoundingBox(); b.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } }); return b; };
  let b = extent();
  c.root.position.x += F.mid - (b.min.x + b.max.x) / 2; c.root.position.y -= SLEEP.sink; b = extent();
  pod.body.add(c.root);
  return {
    c, root: c.root, look, position: POSITIONS[position] ? position : null, box: { min: b.min.toArray(), max: b.max.toArray() },
    setFar(on) { if (c.setFar && !!c.far !== !!on) c.setFar(!!on); },
    // (what it draws: its meshes shown, and their triangles)
    count() {
      let draws = 0, tris = 0;
      c.root.traverse((o) => { if (o.isMesh && o.visible) { let v = true; for (let q = o; q; q = q.parent) if (!q.visible) { v = false; break; } if (!v) return; draws++; const g = o.geometry; tris += (g.index ? (g.drawRange.count !== Infinity ? Math.min(g.drawRange.count, g.index.count) : g.index.count) : g.attributes.position.count) / 3; } });
      return { draws, tris: Math.round(tris) };
    },
    dispose() { c.root.removeFromParent(); c.dispose(); },
  };
}
