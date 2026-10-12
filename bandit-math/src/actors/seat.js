// THE SEAT: getting a rider on and off a horse, and keeping them in the saddle in between. The horse's skeleton is
// scaled a hundred times inside its model, so the rider is never made a child of it: every frame the rider is moved to
// where the horse's back bone is now, facing the way the horse faces (seatRider). The riding clips (Ride, Ride_Gallop)
// were made in Blender against the real saddle, so the person's root goes at one fixed offset from the saddle's origin
// (horse.seat(): the point resting on the back), turned with the horse: that puts the seat of the trousers in the saddle
// and the feet at the stirrups for men and women alike, at a walk or a gallop, and keeps the clips' own bob and the
// gallop's rise. (A person without the riding clips is sat by hand instead, with sitOn in animals.js holding their hips
// over the seat.) Getting on and off is a short hop between the ground beside the horse (its left side, as riders
// mount) and the seat.
//
//   const S = makeSeat(person)                person: from makePerson (folk.js)
//   S.mount(horse, { time, onDone })          the hop up from where the person stands now (about half a second)
//   S.dismount(to, { time, onDone })          the hop down to `to` (a Vector3 on the ground beside the horse)
//   S.update(dt)                              every frame, AFTER the horse and the person have been updated (it reads the
//                                             bones as they are now)
//   S.horse      the horse being ridden (or got on or off), else null
//   S.riding     true from the start of the hop up to the start of the hop down
//   S.handPosed  true when the person has no riding clips (Ride / Ride_Gallop) and is sat by hand instead (poseSit)
//   seatRider(horse, person)   puts the person in the saddle this frame (call after both have been updated)
//   RIDER_FROM_SADDLE   that offset, metres in the horse's own space ([across, up, forward]) for a full-size person
//   sideOf(horse, v, side = 1, out = 1.25)   a spot on the ground beside the horse (side 1: its left, -1: its right)
//   poseSit(person, amount)   bends a person's legs into a seat by hand (0: as the clip left them, 1: sitting astride),
//                             for a person without the riding clips; called after the person's update each frame
import * as THREE from 'three';
import { sitOn } from './animals.js';

const ease = (t) => t * t * (3 - 2 * t);
const _a = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

// where the person's root goes from the saddle's origin (measured by the Blender clips' build, build_clips.py)
export const RIDER_FROM_SADDLE = [0, -0.610, -0.065];
const _hq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _s = new THREE.Vector3(), _ws = new THREE.Vector3();
export function seatRider(horse, person) {
  const root = person.root, parent = root.parent;
  horse.root.updateWorldMatrix(true, true);                         // (the back bone as the horse's clip left it this frame)
  horse.root.getWorldQuaternion(_hq);
  horse.seat(_s);
  root.getWorldScale(_ws);                                          // (a child-sized person: the offset shrinks with them)
  _s.add(_a.fromArray(RIDER_FROM_SADDLE).multiplyScalar(_ws.y).applyQuaternion(_hq));
  if (parent) {
    parent.updateWorldMatrix(true, false); parent.worldToLocal(_s);
    root.quaternion.copy(parent.getWorldQuaternion(_pq).invert().multiply(_hq));
  } else root.quaternion.copy(_hq);
  root.position.copy(_s);
  root.updateWorldMatrix(false, true);
}

export function sideOf(horse, v = new THREE.Vector3(), side = 1, out = 1.25) {
  const r = horse.root; r.updateWorldMatrix(true, false);
  const h = Math.atan2(r.matrixWorld.elements[8], r.matrixWorld.elements[10]);   // (the way it faces, from its +Z)
  // a horse faces +Z, so its left side is +X turned by its heading
  return v.set(r.position.x + Math.cos(h) * side * out, r.position.y, r.position.z - Math.sin(h) * side * out);
}

// SITTING BY HAND, for a person without the riding clips: the thighs forward and apart, the knees bent, the feet brought
// up under the knees (the feet are bones of their own here, not children of the legs). The angles are in each bone's own
// frame as the pack built them (turning a thigh about its +X swings it forward; the shin then turns back to hang down).
const SIT = { thigh: 1.35, spread: 0.62, knee: -1.25 };
const _m = new THREE.Matrix4(), _p = new THREE.Vector3();
export function poseSit(person, amount = 1) {
  if (amount <= 0) return;
  const b = person.bones;
  for (const [s, side] of [['L', 1], ['R', -1]]) {
    const up = b['UpperLeg' + s], lo = b['LowerLeg' + s], foot = b['Foot' + s];
    if (!up || !lo) continue;
    _q.setFromEuler(_e.set(SIT.thigh * amount, 0, SIT.spread * side * amount)); up.quaternion.multiply(_q);
    _q.setFromEuler(_e.set(SIT.knee * amount, 0, 0)); lo.quaternion.premultiply(_q);   // (about the thigh's own axis: the shin's isn't across the knee)
    if (foot) {   // the foot to the end of the shin, where the knee now puts it
      up.updateMatrixWorld(true);
      const len = Math.max(0.3, lo.position.length());
      lo.localToWorld(_p.set(0, len, 0));
      foot.parent.updateMatrixWorld(true); foot.parent.worldToLocal(_p);
      foot.position.lerp(_p, amount);
    }
  }
}

export function makeSeat(person) {
  const S = { horse: null, riding: false, handPosed: !person.clips.includes('Ride'), sit: 0 };
  let hop = null;            // { up: true/false, t, time, from: Vector3, fromQ, to: Vector3, onDone }
  S.mount = (horse, { time = 0.55, onDone } = {}) => {
    S.horse = horse; S.riding = true;
    person.root.updateWorldMatrix(true, false);
    hop = { up: true, t: 0, time, from: person.root.position.clone(), fromQ: person.root.quaternion.clone(), onDone };
  };
  S.dismount = (to, { time = 0.5, onDone } = {}) => {
    if (!S.horse) { if (onDone) onDone(); return; }
    S.riding = false;
    person.root.updateWorldMatrix(true, false);
    hop = { up: false, t: 0, time, from: person.root.position.clone(), fromQ: person.root.quaternion.clone(), to: to.clone(), onDone };
  };
  S.update = (dt) => {
    const horse = S.horse; if (!horse) return;
    if (S.handPosed) { S.sit = hop ? (hop.up ? Math.min(1, hop.t / hop.time) : 1 - Math.min(1, hop.t / hop.time)) : (S.riding ? 1 : 0); poseSit(person, S.sit); }
    const sit = () => { if (S.handPosed) sitOn(horse, person, { dt }); else seatRider(horse, person); };
    if (!hop) { sit(); return; }
    hop.t += dt; const f = ease(Math.min(1, hop.t / hop.time));
    const root = person.root;
    if (hop.up) {
      sit();                                                      // (where the seat puts them this frame: the hop ends there)
      _a.copy(root.position); _q.copy(root.quaternion);
      root.position.lerpVectors(hop.from, _a, f); root.position.y += Math.sin(f * Math.PI) * 0.35;
      root.quaternion.slerpQuaternions(hop.fromQ, _q, f);
    } else {
      root.position.lerpVectors(hop.from, hop.to, f); root.position.y += Math.sin(f * Math.PI) * 0.25;
      root.quaternion.copy(hop.fromQ);
    }
    root.updateWorldMatrix(false, true);
    if (hop.t >= hop.time) {
      const done = hop.onDone, up = hop.up; hop = null;
      if (!up) { S.horse = null; S.sit = 0; }
      if (done) done();
    }
  };
  S.busy = () => !!hop;
  return S;
}
