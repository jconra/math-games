// PETTING, AND THE BONES THAT MOVE FOR IT (src/feeding.js says when): the rider's hand on an animal, its height set by the
// animal itself (down on a crouch for a dog or a hen, an arm raised for a horse's neck), a heart or two, and the animal's
// own answer: a dog's wagging tail and lifted head; any animal with no eating clip of its own nodding its head down to eat.
// There is no petting clip: the rider's Idle stays on and a pose is laid over it each frame, the arm reaching by a two-bone
// solve for the point on the animal, the hips and knees going down as far as that point needs and the back leaning in.
//
// Bends laid over a clip have to be taken off again before the clip runs next (the mixer doesn't write a value that hasn't
// changed, so a bend left on piles up): bender(obj, bones) wraps obj.update to do that for as long as it is on.
//
//   bender(obj, bones) -> { set(fn(dt)), stop() }   obj: anything with update(dt) (an animal, a person)
//   twoBone(a, b, c, target, pole)   turn bones a and b so that c reaches the target (world), the bend toward pole
//   worldTurn(bone, axis, angle)     turn a bone by a world-space turn
//   crouchFor(handY, shoulderY)      -> { lean, drop }  how far the rider goes down to reach that height (pure)
//   makePet({ person }) -> { start({ at(v) }, seconds), update(dt), stop(), on }   the rider's reach and stroke
//   wagTail(a, seconds), headDown(a, seconds)   an animal's answer (nothing, if it has no such bones)
import * as THREE from 'three';

export const PET = {
  reachNear: 0.55,   // m from the rider to the hand's spot (level) at which they stop stepping closer
  armReach: 0.5,     // m the arm is asked to reach (not quite straight)
  leanMost: 0.62,    // radians the back leans in at most
  dropMost: 0.5,     // m the hips go down at most
  stroke: 0.1,       // m the hand strokes either way
  strokes: 2.2,      // strokes a second, there and back counted as one: about 1 Hz is calm
  fade: 0.32,        // s to reach and to come back
};
const _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const damp01 = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

export function worldTurn(bone, q) {
  bone.parent.getWorldQuaternion(_p);
  _q.copy(_p).invert().multiply(q).multiply(_p);
  bone.quaternion.premultiply(_q);
  bone.updateWorldMatrix(false, true);
}
const _turn = new THREE.Quaternion();
export function turnAbout(bone, axis, angle) { worldTurn(bone, _turn.setFromAxisAngle(axis, angle)); }
export function twoBone(a, b, c, target, pole) {
  a.updateWorldMatrix(true, true);
  a.getWorldPosition(_a); b.getWorldPosition(_b); c.getWorldPosition(_c);
  const la = _a.distanceTo(_b), lb = _b.distanceTo(_c);
  _t.copy(target).sub(_a);
  const d = Math.max(Math.abs(la - lb) + 0.001, Math.min(la + lb - 0.001, _t.length()));
  _t.normalize();
  const cosA = (la * la + d * d - lb * lb) / (2 * la * d), ang = Math.acos(Math.max(-1, Math.min(1, cosA)));
  // (the elbow or knee goes off the line toward the pole)
  _n.copy(pole).addScaledVector(_t, -pole.dot(_t)); if (_n.lengthSq() < 1e-6) _n.set(0.01, 1, 0); _n.normalize();
  _d.copy(_t).multiplyScalar(Math.cos(ang) * la).addScaledVector(_n, Math.sin(ang) * la);   // (where the elbow goes, from a)
  _e.copy(_b).sub(_a).normalize();
  worldTurn(a, _turn.setFromUnitVectors(_e, _d.clone().normalize()));
  a.updateWorldMatrix(false, true);
  b.getWorldPosition(_b); c.getWorldPosition(_c);
  _e.copy(_c).sub(_b).normalize();
  _d.copy(_a).addScaledVector(_t, d).sub(_b).normalize();
  worldTurn(b, _turn.setFromUnitVectors(_e, _d));
}
export function bender(obj, bones) {
  const orig = obj.update, keep = bones.map((b) => ({ b, q: b.quaternion.clone(), p: b.position.clone() }));
  let fn = null;
  const restore = () => { for (const k of keep) { k.b.quaternion.copy(k.q); k.b.position.copy(k.p); } };
  const save = () => { for (const k of keep) { k.q.copy(k.b.quaternion); k.p.copy(k.b.position); } };
  obj.update = (dt) => { restore(); orig.call(obj, dt); save(); if (fn) fn(dt); };
  return { set: (f) => { fn = f; }, stop: () => { restore(); obj.update = orig; } };
}
// how the rider goes down for a hand at height handY (m over their feet), their shoulder standing at shoulderY: nothing
// while the arm reaches it, then the back leans in, then the hips go down
export function crouchFor(handY, shoulderY) {
  const need = Math.max(0, shoulderY - handY - PET.armReach * 0.72);
  const lean = Math.min(PET.leanMost, need * 1.2), drop = Math.min(PET.dropMost, Math.max(0, need - lean * 0.26));
  return { lean, drop };
}

const FWD = new THREE.Vector3(), LEAN = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), reach = new THREE.Vector3(), elbow = new THREE.Vector3();
export function makePet({ person }) {
  const B = person.bones, need = [B.Hips, B.Abdomen, B.Chest, B.UpperArmR, B.LowerArmR, B.WristR, B.UpperLegL, B.LowerLegL, B.FootL, B.UpperLegR, B.LowerLegR, B.FootR];
  if (need.some((x) => !x)) return { start() { return false; }, update() {}, stop() {}, on: false };
  let job = null, bend = null;
  const M = { on: false };
  const target = new THREE.Vector3(), footL = new THREE.Vector3(), footR = new THREE.Vector3(), qL = new THREE.Quaternion(), qR = new THREE.Quaternion(), hipV = new THREE.Vector3();
  function pose(dt) {
    if (!job) return;
    job.t += dt;
    const w = damp01(Math.min(job.t, job.len - job.t) / PET.fade);
    if (job.t >= job.len) { M.stop(); return; }
    const root = person.root; root.updateMatrixWorld(true);
    FWD.set(0, 0, 1).transformDirection(root.matrixWorld); LEAN.crossVectors(UP, FWD).normalize();   // (the rider's left: a turn about it tips the top forward)
    job.at(target);
    if (job.along) target.addScaledVector(job.along, Math.sin(job.t * PET.strokes * Math.PI) * PET.stroke);
    const feetY = root.position.y;
    B.UpperArmR.updateWorldMatrix(true, false); const sh = B.UpperArmR.getWorldPosition(_a).y - feetY;
    const c = crouchFor(target.y - feetY, sh), drop = c.drop * w, lean = c.lean * w;
    // the feet stay where they are; the hips come down over them; the back leans in
    B.FootL.getWorldPosition(footL); B.FootR.getWorldPosition(footR); B.FootL.getWorldQuaternion(qL); B.FootR.getWorldQuaternion(qR);
    if (drop > 0.001) {
      hipV.set(0, -drop, 0); const par = B.Hips.parent; par.updateWorldMatrix(true, false);
      const m = new THREE.Matrix3().setFromMatrix4(par.matrixWorld).invert(); hipV.applyMatrix3(m); B.Hips.position.add(hipV);
      B.Hips.updateWorldMatrix(false, true);
      twoBone(B.UpperLegL, B.LowerLegL, B.FootL, footL, FWD);
      twoBone(B.UpperLegR, B.LowerLegR, B.FootR, footR, FWD);
      for (const [f, q] of [[B.FootL, qL], [B.FootR, qR]]) { f.parent.getWorldQuaternion(_p); f.quaternion.copy(_p).invert().multiply(q); f.updateWorldMatrix(false, true); }
    }
    if (lean > 0.001) { turnAbout(B.Abdomen, LEAN, lean * 0.5); turnAbout(B.Chest, LEAN, lean * 0.5); }
    // the arm: its hand to the spot, the elbow out and down
    B.WristR.getWorldPosition(reach); reach.lerp(target, w);
    elbow.copy(LEAN).multiplyScalar(-0.7); elbow.y = -0.7;
    twoBone(B.UpperArmR, B.LowerArmR, B.WristR, reach, elbow);
    M.hand = reach.clone(); M.drop = drop; M.lean = lean;
    B.WristR.getWorldPosition(_b); M.gap = _b.distanceTo(target);
  }
  // at(v): writes the world point the hand strokes; along: the way it strokes (a unit vector, or null)
  M.start = ({ at, along = null }, seconds = 2.8) => {
    if (job) M.stop();
    job = { at, along, t: 0, len: seconds };
    bend = bender(person, need);
    bend.set(pose);
    M.on = true;
    return true;
  };
  M.stop = () => { job = null; if (bend) { bend.stop(); bend = null; } M.on = false; };
  return M;
}
const bonesOf = (a, names) => names.map((n) => a.bones && a.bones[n]).filter(Boolean);
// the wag: the tail swings from side to side, more at each bone along it; the head lifted a little
export function wagTail(a, seconds = 2.8) {
  const tail = bonesOf(a, ['Tail1', 'Tail2', 'Tail3', 'Tail', 'Tail_1', 'Tail_2']), head = bonesOf(a, ['Head']);
  if (!a || (!tail.length && !head.length)) return () => {};
  const b = bender(a, [...tail, ...head]);
  let t = 0;
  const axis = new THREE.Vector3(), right = new THREE.Vector3();
  b.set((dt) => {
    t += dt;
    if (t >= seconds) { b.stop(); return; }
    const w = damp01(Math.min(t, seconds - t) / 0.3), root = a.root; root.updateMatrixWorld(true);
    axis.set(0, 1, 0).transformDirection(root.matrixWorld); right.set(1, 0, 0).transformDirection(root.matrixWorld);
    for (const x of tail) turnAbout(x, axis, Math.sin(t * 15) * 0.42 * w);
    for (const x of head) turnAbout(x, right, -0.16 * w);
  });
  return () => b.stop();
}
// an animal with no eating clip: its neck and head go down to the ground and nod while it munches
export function headDown(a, seconds = 3.4) {
  const neck = bonesOf(a, ['Neck', 'Head']);
  if (!neck.length) return () => {};
  const b = bender(a, neck);
  let t = 0;
  const right = new THREE.Vector3();
  b.set((dt) => {
    t += dt;
    if (t >= seconds) { b.stop(); return; }
    const w = damp01(Math.min(t, seconds - t) / 0.4), root = a.root; root.updateMatrixWorld(true);
    right.set(1, 0, 0).transformDirection(root.matrixWorld);
    turnAbout(neck[0], right, 0.55 * w);
    if (neck[1]) turnAbout(neck[1], right, (0.25 + Math.sin(t * 9) * 0.07) * w);
  });
  return () => b.stop();
}
