// THE SEAT: getting a rider on and off a horse, and keeping them in the saddle in between. The horse's skeleton is
// scaled a hundred times inside its model, so the rider is never made a child of it: every frame the rider is moved to
// where the horse's back bone is now, facing the way the horse faces (seatRider). The riding clips (Ride, Ride_Gallop)
// were made in Blender against the real saddle, so the person's root goes at one fixed offset from the saddle's origin
// (horse.seat(): the point resting on the back), turned with the horse: that puts the seat of the trousers in the saddle
// and the feet at the stirrups for men and women alike, at a walk or a gallop, and keeps the clips' own bob and the
// gallop's rise. (A person without the riding clips is sat by hand instead, with sitOn in animals.js holding their hips
// over the seat.)
//
// GETTING ON AND OFF (the game's maker: "make it look like the character is stepping up on a stirrup and swinging the
// leg over rather than just magically moving to the mounted position"): the clips Mount and Dismount (and Mount_R,
// Dismount_R from the horse's right side), made in Blender in the riding clips' own frame (~/pw/bandit-math/rigs/clips/
// build_clips.py), so the root stays where seatRider puts it all the way through and the clip carries the body from the
// ground into the saddle and back. Mount starts in the game's own Idle standing at the horse's left shoulder (MOUNTING.at,
// turned to MOUNTING.face: toward its side and its tail), hands on the withers and the saddle's swell, the left foot up
// into the stirrup, a spring off the right foot to stand in the stirrup folded over the saddle, the right leg swung back
// over the rump, and down into the saddle on Ride's first frame. Dismount is the same played backward (MOUNTING.back),
// ending in Idle where Mount began. The clips stand on the bay's flat ground; so while the feet are on the ground the
// root is put on the real ground (stood upright on a horse pitched by a slope), each foot on its own ground, and the
// hands and the stirrup foot held where the clip has them on the horse (MOUNTING's tables say how much, when). On a
// bigger horse that is a higher step and a longer push up; on the donkey a short one. A person without the clips, or a
// horse with no room on either side, gets the old short hop between the ground and the seat instead.
//
//   const S = makeSeat(person, { ground })    person: from makePerson (folk.js); ground(x, z): the ground's height there
//   S.mount(horse, { time, onDone })          the old hop up from where the person stands now (about half a second)
//   S.dismount(to, { time, onDone })          the old hop down to `to` (a Vector3 on the ground beside the horse)
//   S.canClip                                 true when the person has the four getting-on and -off clips
//   S.spot(horse, side, v)                    where Mount starts and Dismount ends on that side (1 the horse's left, -1
//                                             its right): v (a Vector3) set to the standing feet, on the real ground;
//                                             returns the heading they face there (radians)
//   S.mountClip(horse, { side, onDone })      Mount (or Mount_R): the person standing at S.spot(horse, side) in Idle
//   S.dismountClip({ side, onDone })          Dismount (or Dismount_R); onDone(feet, heading): where the clip left them
//   S.clip        the clip under way ({ name, side, up, t: its time, len }), else null
//   S.at          during a clip, the point the camera follows (from the feet on the ground to the horse, as they go up)
//   S.up          during a clip, true once the rider is up off the ground (the weight in the stirrup or the saddle)
//   S.shift(dx, dy, dz)                       a hop under way moved along with the rider and the horse
//   S.update(dt)                              every frame, AFTER the horse and the person have been updated (it reads the
//                                             bones as they are now)
//   S.horse      the horse being ridden (or got on or off), else null
//   S.riding     true from the start of getting on up to the start of getting off
//   S.handPosed  true when the person has no riding clips (Ride / Ride_Gallop) and is sat by hand instead (poseSit)
//   S.busy()     a hop or a clip is under way
//   seatRider(horse, person)   puts the person in the saddle this frame (call after both have been updated)
//   RIDER_FROM_SADDLE   that offset, metres in the horse's own space ([across, up, forward]) for a full-size person
//   sideOf(horse, v, side = 1, out = 1.25)   a spot on the ground beside the horse (side 1: its left, -1: its right)
//   legsOut(horse, person, amount)  on a bigger horse (the stable's ladder: actors/horses.js), the lower legs turned out at
//                             the knee and the feet moved out with them, so the feet clear its wider barrel (FEET_OUT);
//                             called after seatRider each frame (S.update does). amount: { L, R } how much of it each leg
//                             gets (default all)
//   poseSit(person, amount)   bends a person's legs into a seat by hand (0: as the clip left them, 1: sitting astride),
//                             for a person without the riding clips; called after the person's update each frame
//   MOUNTING, weightAt, smoothKeys, mountClock, MOUNT_CLIPS   the clips' numbers and how they are read (mountplan.js)
import * as THREE from 'three';
import { sitOn } from './animals.js';
import { MOUNTING, weightAt, smoothKeys, mountClock, MOUNT_CLIPS, clipName, spotAt } from './mountplan.js';

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

// THE FEET ROUND A BIGGER BARREL: the riding clips were made on the bay; on the stable's bigger horses the barrel is
// wider where the rider's feet hang (low on its side, just behind the elbow), and with the rider the same size the feet
// went into it (the knees stay clear: 3 cm or more at every size). So each lower leg is turned out at the knee, about the
// horse's forward line, as far as moves its foot out by this much, and the foot (a bone of its own, not the shin's
// child) moved out by as much. Metres by the horse's size, from the knee probe (~/pw/bandit-math/rigs/horses/sizes.cjs:
// farmer_m and adventurer_f, at a stand, walk, trot and gallop): the feet's least clearance was 0.3, 0.0, -0.9, -2.2 and
// -3.3 cm at 0.95 to 1.15, so each gets 1 cm clear and 3 mm to spare. The donkey and the pack horses: none.
export const FEET_OUT = [[0.95, 0.010], [1, 0.013], [1.05, 0.022], [1.1, 0.035], [1.15, 0.046]];
const tableAt = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1][1]; };
const _k = new THREE.Vector3(), _f = new THREE.Vector3(), _ax = new THREE.Vector3(), _out = new THREE.Vector3(), _iq = new THREE.Quaternion(), _lq = new THREE.Quaternion();
export function legsOut(horse, person, amount = null) {
  if (!horse || !horse.coat) return;
  const d0 = tableAt(FEET_OUT, horse.size || 1); if (!(d0 > 0)) return;
  horse.root.getWorldQuaternion(_hq);
  _ax.set(0, 0, 1).applyQuaternion(_hq);                          // (the horse's forward line)
  for (const [s, side] of [['L', 1], ['R', -1]]) {                // (the rider's left leg on the horse's left, its +X)
    const d = d0 * (amount ? amount[s] ?? 1 : 1); if (!(d > 1e-5)) continue;   // (getting on or off: only a leg in its stirrup)
    const lo = person.bones['LowerLeg' + s], foot = person.bones['Foot' + s]; if (!lo || !lo.parent) continue;
    _out.set(side, 0, 0).applyQuaternion(_hq);
    lo.getWorldPosition(_k);
    const drop = foot ? Math.max(0.2, _k.y - foot.getWorldPosition(_f).y) : 0.45;   // (how far the foot hangs below the knee)
    _lq.setFromAxisAngle(_ax, Math.asin(Math.min(0.5, d / drop)) * side);   // (turned about the forward line: the shin's foot end out by d)
    lo.parent.getWorldQuaternion(_pq);
    lo.quaternion.premultiply(_iq.copy(_pq).invert().multiply(_lq).multiply(_pq));
    lo.updateMatrixWorld(true);
    if (foot && foot.parent) {
      foot.getWorldPosition(_f).addScaledVector(_out, d);
      foot.parent.updateMatrixWorld(true); foot.parent.worldToLocal(_f); foot.position.copy(_f); foot.updateMatrixWorld(true);
    }
  }
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

// (the getting-on and -off clips' numbers, and how they are read: mountplan.js)
export { MOUNTING, weightAt, smoothKeys, mountClock, MOUNT_CLIPS };

// A LIMB OF TWO BONES brought to a point, in world terms: the upper bone turned so the joint (knee, elbow) lands where
// it must, as near as it can be to where it is now (so a knee or an elbow points the way the clip has it), then the
// lower bone turned so the end gets there (or as near as the limb reaches along the line). end: the end's place now (the
// wrist, a child of the lower bone; or the foot, a bone of its own on the leg, put there after). hint: the way the joint
// points as the body is made (the knee's front, the elbow's back), in world terms this frame: a nearly straight limb
// bends that way (left to the joint's own small offset alone it can flip from one frame to the next). Returns the place
// reached.
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _C = new THREE.Vector3(), _D = new THREE.Vector3(), _P = new THREE.Vector3(), _U = new THREE.Vector3(), _W = new THREE.Vector3(), _BN = new THREE.Vector3();
const _qa = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
function turnWorld(bone, q) { bone.parent.getWorldQuaternion(_qp); bone.getWorldQuaternion(_qw); _qw.premultiply(q); bone.quaternion.copy(_qp.invert().multiply(_qw)); bone.updateMatrixWorld(true); }
const BEND = 0.03;   // m: how far a joint must stand off the line from root to end before its own offset outweighs the hint
function reach(upper, lower, end, target, out, hint = null) {
  upper.getWorldPosition(_A); lower.getWorldPosition(_B); _C.copy(end);
  const la = _A.distanceTo(_B), lb = _B.distanceTo(_C);
  _D.subVectors(target, _A); let dist = _D.length(); if (dist < 1e-6 || la < 1e-6 || lb < 1e-6) return out.copy(end);
  _D.divideScalar(dist); dist = Math.max(Math.abs(la - lb) + 1e-4, Math.min(la + lb - 1e-4, dist));
  // (the way the joint bends: toward where it is now, leaning toward the hint, so it takes the place nearest its own on
  // the circle it can lie on. Measured off the old line from root to end instead, a knee whose line swung a long way, as
  // a big horse's stirrup foot's does while the hips come down past it, swung round the leg, 0.4 m in a frame)
  _P.subVectors(_B, _A);
  if (hint) _P.addScaledVector(hint, BEND);
  _P.addScaledVector(_D, -_P.dot(_D));
  if (_P.lengthSq() < 1e-10) { _P.set(0, 1, 0).addScaledVector(_D, -_D.y); if (_P.lengthSq() < 1e-10) _P.set(1, 0, 0); }
  _P.normalize();
  const ca = Math.max(-1, Math.min(1, (la * la + dist * dist - lb * lb) / (2 * la * dist))), sa = Math.sqrt(1 - ca * ca);
  _BN.copy(_A).addScaledVector(_D, la * ca).addScaledVector(_P, la * sa);
  _U.subVectors(_B, _A).normalize(); _W.subVectors(_BN, _A).normalize(); _qa.setFromUnitVectors(_U, _W); turnWorld(upper, _qa);
  _C.sub(_A).applyQuaternion(_qa).add(_A);                          // (the end, carried round with the upper bone)
  out.copy(_A).addScaledVector(_D, dist);
  _U.subVectors(_C, _BN).normalize(); _W.subVectors(out, _BN).normalize(); _qa.setFromUnitVectors(_U, _W); turnWorld(lower, _qa);
  return out;
}
function placeWorld(bone, pos, quat) {
  const par = bone.parent; par.updateMatrixWorld(true);
  if (pos) { _W.copy(pos); par.worldToLocal(_W); bone.position.copy(_W); }
  if (quat) { par.getWorldQuaternion(_qp); bone.quaternion.copy(_qp.invert().multiply(quat)); }
  bone.updateMatrixWorld(true);
}

const _Y = new THREE.Vector3(0, 1, 0), _yq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _R0 = new THREE.Vector3(), _S = new THREE.Vector3(), _Q = new THREE.Vector3(), _T = new THREE.Vector3(), _H = new THREE.Vector3(), _seat = new THREE.Vector3();
// the horse's heading (radians, as rotation.y) and its turn about the up line alone
function headingOf(horse) { horse.root.getWorldQuaternion(_hq); _f.set(0, 0, 1).applyQuaternion(_hq); return Math.atan2(_f.x, _f.z); }

export function makeSeat(person, { ground = null } = {}) {
  const S = { horse: null, riding: false, handPosed: !person.clips.includes('Ride'), sit: 0, clip: null, at: new THREE.Vector3(), up: false };
  S.canClip = !S.handPosed && MOUNT_CLIPS.every((c) => person.clips.includes(c));
  const groundAt = (x, z, y) => (ground ? ground(x, z) : y);
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
  // a hop under way moved by (dx, dy, dz), with the rider and the horse (the valley's wrap, src/player.js P.shift); a
  // clip needs nothing: it is all worked out from the horse each frame
  S.shift = (dx, dy, dz) => { S.at.x += dx; S.at.y += dy; S.at.z += dz; if (!hop) return; hop.from.x += dx; hop.from.y += dy; hop.from.z += dz; if (hop.to) { hop.to.x += dx; hop.to.y += dy; hop.to.z += dz; } };

  // where the standing person is at a clip's ground end: the riding root's place this frame (the saddle on the back as it
  // stands), then MOUNTING.at turned by the horse's heading alone and set on the real ground. Returns the heading there.
  const _rr = new THREE.Vector3(), _ro = new THREE.Vector3();
  function spotFrom(horse, side, v, s) {
    const h = headingOf(horse); _yq.setFromAxisAngle(_Y, h);                 // (_hq: the horse's turn, from headingOf)
    _ro.fromArray(RIDER_FROM_SADDLE).multiplyScalar(s).applyQuaternion(_hq);
    horse.seat(_rr).add(_ro);                                                // (the riding root)
    v.fromArray(spotAt(side, s)).applyQuaternion(_yq).add(_rr);
    v.y = groundAt(v.x, v.z, v.y);
    return h + side * MOUNTING.face;
  }
  S.spot = (horse, side = 1, v = new THREE.Vector3()) => {
    horse.root.updateWorldMatrix(true, true); person.root.getWorldScale(_ws); headingOf(horse);
    return spotFrom(horse, side, v, _ws.y);
  };
  // (Mount takes over outright: its first frame is the Idle the rider stands in, and anything still fading out under it,
  // the last of the walk up, would mix a stride into the legs. Dismount fades in from Ride: the same frame, no jump)
  const play = (name) => {
    const hard = !name.startsWith('Dismount');
    person.play(name, { fade: hard ? 0 : 0.2, once: true });
    const P2 = person.person; if (!hard || !P2 || !P2.cur) return;
    for (const x of Object.values(P2.actions)) if (x !== P2.cur) x.stop();
    P2.cur.setEffectiveWeight(1);
  };
  S.mountClip = (horse, { side = 1, onDone } = {}) => {
    S.horse = horse; S.riding = true; hop = null;
    const name = clipName(true, side);
    S.clip = { name, side: side < 0 ? -1 : 1, up: true, t: 0, len: MOUNTING.mount, onDone };
    play(name); S.up = false;
  };
  S.dismountClip = ({ side = 1, onDone } = {}) => {
    if (!S.horse) { if (onDone) onDone(null, 0); return; }
    S.riding = false; hop = null;
    const name = clipName(false, side);
    S.clip = { name, side: side < 0 ? -1 : 1, up: false, t: 0, len: MOUNTING.dismount, onDone };
    play(name); S.up = true;
  };

  // which way each knee and elbow points as the body was made (facing +Z: knees to the front, elbows to the back), in the
  // lower bone's own frame, from the skin's bind pose; S.update turns them to the world each frame (reach's hint)
  const joints = {};
  { const sk = person.mesh && person.mesh.skeleton, _bq = new THREE.Quaternion(), _bm = new THREE.Matrix4(), _bp = new THREE.Vector3(), _bs = new THREE.Vector3();
    if (sk) sk.bones.forEach((bn, i) => {
      const m = /^Lower(Leg|Arm)([LR])$/.exec(bn.name); if (!m) return;
      _bm.copy(sk.boneInverses[i]).invert().decompose(_bp, _bq, _bs);
      joints[bn.name] = new THREE.Vector3(0, 0, m[1] === 'Leg' ? 1 : -1).applyQuaternion(_bq.invert());
    }); }
  const _hint = new THREE.Vector3(), _bwq = new THREE.Quaternion();
  const hintOf = (bone) => { const j = joints[bone.name]; if (!j) return null; bone.getWorldQuaternion(_bwq); return _hint.copy(j).applyQuaternion(_bwq); };
  // the places held on the horse while the root moves for the ground (world, this frame), and the feet's turns
  const rec = { nf: new THREE.Vector3(), nh: new THREE.Vector3(), fh: new THREE.Vector3(), nfq: new THREE.Quaternion(), nhq: new THREE.Quaternion(), fhq: new THREE.Quaternion() };
  const _ft = new THREE.Vector3(), _fq = new THREE.Quaternion(), _got = new THREE.Vector3();
  function hold(bone, v, q, s) {   // (where a bone is on the horse, as the clip has it there; a child-sized person's at full size)
    bone.getWorldPosition(v); bone.getWorldQuaternion(q);
    if (s !== 1) v.sub(_seat).divideScalar(s).add(_seat);
  }
  // one frame of a getting-on or -off clip: the riding root, moved to the ground while the feet are on it, the limbs
  // brought to their places
  function stepClip(horse) {
    const C = S.clip, act = person.person && person.person.actions[C.name];
    C.t = Math.min(C.len, act ? act.time : C.t);
    const tm = C.up ? C.t : mountClock(C.t), M = MOUNTING, side = C.side;
    const near = side > 0 ? 'L' : 'R', far = side > 0 ? 'R' : 'L', b = person.bones, root = person.root;
    seatRider(horse, person);
    root.getWorldScale(_ws); const s = _ws.y;
    horse.seat(_seat);
    const G = weightAt(M.ground, tm), pNF = weightAt(M.pin.nearFoot, tm), pNH = weightAt(M.pin.nearHand, tm), pFH = weightAt(M.pin.farHand, tm);
    if (pNF > 0) hold(b['Foot' + near], rec.nf, rec.nfq, s);
    if (pNH > 0) hold(b['Wrist' + near], rec.nh, rec.nhq, s);
    if (pFH > 0) hold(b['Wrist' + far], rec.fh, rec.fhq, s);
    // the root: from the riding root toward the one that stands the clip's feet on the real ground, upright, by G
    horse.root.getWorldQuaternion(_hq);
    const heading = spotFrom(horse, side, _S, s);   // (_S: the standing feet, on the real ground; _yq: the heading's turn)
    root.getWorldPosition(_R0);
    _Q.fromArray(spotAt(side, s)).applyQuaternion(_yq).negate().add(_S);   // (the root that puts them there)
    if (G > 0) {
      _R0.lerp(_Q, G); _rq.copy(_hq).slerp(_yq, G);
      const par = root.parent;
      if (par) { par.updateWorldMatrix(true, false); par.worldToLocal(_R0); root.quaternion.copy(par.getWorldQuaternion(_pq).invert().multiply(_rq)); }
      else root.quaternion.copy(_rq);
      root.position.copy(_R0); root.updateMatrixWorld(true);
    }
    // the feet: each on its own ground while it stands there (a slope: the ground under it against the ground under the
    // standing spot, faded in and out at the clip's ground end so it meets plain standing), never under the ground while
    // the root is held to it, and the stirrup foot kept in the stirrup
    const edge = C.up ? ease(Math.min(1, C.t / 0.2)) : ease(Math.min(1, (C.len - C.t) / 0.2));
    for (const [k, g] of [[near, weightAt(M.feet.near, tm)], [far, weightAt(M.feet.far, tm)]]) {
      const foot = b['Foot' + k], up = b['UpperLeg' + k], lo = b['LowerLeg' + k]; if (!foot || !up || !lo) continue;
      foot.getWorldPosition(_ft); foot.getWorldQuaternion(_fq); _T.copy(_ft);
      if (G > 0 && g > 0 && edge > 0) _T.y += (groundAt(_T.x, _T.z, _S.y) - _S.y) * g * G * edge;
      let q = null;
      if (k === near && pNF > 0) { _T.lerp(rec.nf, pNF); q = _fq.slerp(rec.nfq, pNF); }
      if (G > 0) _T.y = Math.max(_T.y, groundAt(_T.x, _T.z, -1e9) + 0.02 * s);
      if (_T.distanceToSquared(_ft) < 1e-8) continue;
      reach(up, lo, _ft, _T, _got, hintOf(lo)); placeWorld(foot, _got, q);
    }
    // the hands on the saddle and the withers, where the clip has them on the horse
    for (const [k, p, v, q] of [[near, pNH, rec.nh, rec.nhq], [far, pFH, rec.fh, rec.fhq]]) {
      if (!(p > 0)) continue;
      const w = b['Wrist' + k], lo = b['LowerArm' + k], up = b['UpperArm' + k]; if (!w || !lo || !up) continue;
      w.getWorldPosition(_ft); w.getWorldQuaternion(_fq); _T.copy(_ft).lerp(v, p);
      if (_T.distanceToSquared(_ft) < 1e-8) continue;
      reach(up, lo, _ft, _T, _got, hintOf(lo)); placeWorld(w, null, _fq.slerp(q, p));
    }
    legsOut(horse, person, { [near]: weightAt(M.out.near, tm), [far]: weightAt(M.out.far, tm) });
    // the camera's point: from the standing feet to the horse's middle as they go up
    horse.root.getWorldPosition(_H);
    S.at.copy(_S).lerp(_H, ease(Math.max(0, Math.min(1, (tm - M.rise[0]) / (M.rise[1] - M.rise[0])))));
    S.up = G < 0.5;
    if (C.t >= C.len - 1e-6) {
      const done = C.onDone; S.clip = null;
      if (!C.up) { S.horse = null; S.sit = 0; }
      if (done) done(C.up ? null : _S.clone(), heading);
    }
  }

  S.update = (dt) => {
    const horse = S.horse; if (!horse) return;
    if (S.clip) { stepClip(horse); return; }
    if (S.handPosed) { S.sit = hop ? (hop.up ? Math.min(1, hop.t / hop.time) : 1 - Math.min(1, hop.t / hop.time)) : (S.riding ? 1 : 0); poseSit(person, S.sit); }
    const sit = () => { if (S.handPosed) sitOn(horse, person, { dt }); else seatRider(horse, person); legsOut(horse, person); };
    if (!hop) { sit(); return; }
    hop.t += dt; const f = ease(Math.min(1, hop.t / hop.time));
    const root = person.root;
    if (hop.up) {
      sit();                                                      // (where the seat puts them this frame: the hop ends there)
      _a.copy(root.position); _q.copy(root.quaternion);
      root.position.lerpVectors(hop.from, _a, f); root.position.y += Math.sin(f * Math.PI) * 0.35 * (horse.size || 1);   // (a bigger horse: a higher hop)
      root.quaternion.slerpQuaternions(hop.fromQ, _q, f);
    } else {
      root.position.lerpVectors(hop.from, hop.to, f); root.position.y += Math.sin(f * Math.PI) * 0.25 * (horse.size || 1);
      root.quaternion.copy(hop.fromQ);
    }
    root.updateWorldMatrix(false, true);
    if (hop.t >= hop.time) {
      const done = hop.onDone, up = hop.up; hop = null;
      if (!up) { S.horse = null; S.sit = 0; }
      if (done) done();
    }
  };
  S.busy = () => !!hop || !!S.clip;
  return S;
}
