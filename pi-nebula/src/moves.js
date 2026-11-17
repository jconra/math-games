// THE STATION PEOPLE'S OWN SMALL MOVES, laid over whatever clip they play (the crew kit has no talking clip, and turns
// only the eyes): the head turned toward whoever they look at, and, when two talk (the game's maker, 2026-11-16: "It
// would be cool if they have talking animations, not moving lips, but moving their arms and hands around a bit and
// nodding, leaning one way and then the other"), the one speaking moves their hands as they talk, now one, now both,
// palms turning up, with small beats; the one listening nods now and then; both shift their weight, leaning one way
// and then the other.
//
//   const M = addMoves(c)          (a crew kit person)
//   M.look = point | null          the head turns toward a point in the world (most of the way: the eyes do the rest)
//   M.talk = null | 'speak' | 'listen'     in a talk: speaking, or listening
//   M.sitting = true               (sitting: no arms, a smaller lean)
//   M.bed = null | { hips, feet, pole, ahead, legs, flat, hands, fingers, elbows, arms, chin } (the world's; each of
//                                  feet, hands, fingers, elbows a [left, right])
//                                  ON A BED (the scanner's patient getting on, lying, getting off: src/onbed.js says
//                                  where, people.js puts it in the world): the person moved so the middle of their hip
//                                  joints is at `hips`; each leg bent (two bones) so its foot's root is at its place,
//                                  the knee toward `pole`; each foot flat (`flat`: on what it stands on, toes `ahead`)
//                                  or following its shin; each hand reaching for its place (`arms` of the way), its
//                                  elbow toward `elbows`, laid flat, palm down, its fingers along `fingers`; the chin
//                                  brought down `chin` (rad); `legs` how much of the legs is worn over the clip's (0: the
//                                  clip's own legs)
//   M.body                         the person's own measures, taken once standing: { a thigh, b shin (hip, knee, the
//                                  foot's root, m), w half the hips' width, hs the hip joints' height, u upper arm, f
//                                  forearm }
//   M.hipAt                        where the clips put the hip joints' middle from the root (the world's measure, along
//                                  the root's own axes), taken each frame a bed pose is laid on: people.js places the
//                                  root by it
//
// HOW: each turn is laid on after the clips have set the bones and before the rest of the crew kit's frame (the feet,
// the arms out, the eyes: so the eyes aim from where the head has turned), by wrapping the person's clip player's own
// update. The crew kit's clip player puts these bones back as the clips left them before each update, so nothing builds
// up from one frame to the next. Every turn is about an axis of the person's own (x their left, y up, z ahead), so it
// means the same on every outfit's skeleton. Nothing moves the hips, nor the legs (the feet stay planted) but someone
// getting on or off a bed, or lying on it (M.bed): there the legs and the hands are aimed in the world, each bone turned
// the shortest way from where the clip has it (hip and knee bending about the leg's own hinge, as the clip's do).
import * as THREE from 'three';
import { twoBone, footWay } from './onbed.js';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _a = new THREE.Vector3(), _p = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4();
const rnd = (a, b) => a + Math.random() * (b - a);
const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
// THE SIZES (radians): the head's turn toward what it looks at, at most, and how much of it the neck takes; the lean;
// a nod; the arms' gestures (the upper arm forward and out, the elbow bent, the palm turned up); a beat
export const MOVES = { turn: 0.85, up: 0.3, neck: 0.4, lean: 0.045, nod: 0.17, beat: 0.07, rate: 5 };
// (a speaker's gestures: [upper arm forward, upper arm out, elbow bent, palm up] for the left and the right arm)
const GESTURES = [
  { L: [0, 0, 0, 0], R: [0.22, 0.05, 1.15, 1.1], w: 3 },          // the right hand explains
  { L: [0.22, 0.05, 1.15, 1.1], R: [0, 0, 0, 0], w: 2 },          // the left hand explains
  { L: [0.2, 0.18, 0.95, 1.3], R: [0.2, 0.18, 0.95, 1.3], w: 2 }, // both hands open, palms up
  { L: [0, 0, 0.2, 0], R: [0.12, 0, 0.75, 0.4], w: 2 },           // a small one
  { L: [0, 0, 0, 0], R: [0, 0, 0, 0], w: 2 },                     // hands down a moment
];
const pickGesture = () => { const s = GESTURES.reduce((a, g) => a + g.w, 0); let r = Math.random() * s; for (const g of GESTURES) { r -= g.w; if (r <= 0) return g; } return GESTURES[0]; };
// (a listener's: smaller, now and then)
const LISTEN = [
  { L: [0.05, 0, 0.55, 0.25], R: [0, 0, 0, 0] },                  // a hand up a little
  { L: [0, 0, 0, 0], R: [0.06, 0, 0.6, 0.3] },
  { L: [0.12, 0.02, 0.95, 0.05], R: [0.12, 0.02, 0.95, 0.05] },   // the hands together in front
];

// a turn of a bone about an axis of the person's own frame (rq: the person's own turn in the world)
function turn(bone, axis, angle, rq) {
  if (!bone || !bone.parent || Math.abs(angle) < 1e-5) return;
  _a.copy(axis).applyQuaternion(rq).applyQuaternion(bone.parent.getWorldQuaternion(_pq).invert()).normalize();
  bone.quaternion.premultiply(_q.setFromAxisAngle(_a, angle));
}
// a turn of a bone about an axis given in the world
function turnWorld(bone, axis, angle) {
  if (!bone || !bone.parent || Math.abs(angle) < 1e-5) return;
  _a.copy(axis).applyQuaternion(bone.parent.getWorldQuaternion(_pq).invert()).normalize();
  bone.quaternion.premultiply(_q.setFromAxisAngle(_a, angle));
}

export function addMoves(c) {
  const B = c.bones, person = c.person;
  const M = {
    look: null, talk: null, sitting: false,
    // (now: what is worn this moment; each eased toward what is wanted)
    yaw: 0, pitch: 0, sway: 0, swayT: Math.random() * 20, swayEvery: rnd(5, 8), nod: 0, nodT: rnd(1, 3), nodLeft: 0,
    arms: { L: [0, 0, 0, 0], R: [0, 0, 0, 0] }, want: { L: [0, 0, 0, 0], R: [0, 0, 0, 0] }, nextGesture: 0, beatT: 0, t: 0,
  };
  const orig = person.update.bind(person);
  person.update = (dt) => { orig(dt); lay(dt); };

  const _h = new THREE.Vector3(), _k = new THREE.Vector3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
  // the person's own measures, standing as they are made (the crew kit has just put each foot at its shin's end): the
  // thigh and the shin (the crew kit's foot rule: the foot's root along the shin's own line), the hips' width, the hip
  // joints' height, the arm's two bones (in the world's measure: a person's size is in them)
  {
    c.root.updateMatrixWorld(true);
    const at = (n, v) => (B[n] ? B[n].getWorldPosition(v) : null), d = (p, q) => (at(p, _v1) && at(q, _v2) ? _v1.distanceTo(_v2) : 0);
    const hl = at('UpperLegL', new THREE.Vector3()), hr = at('UpperLegR', new THREE.Vector3());
    M.body = { a: d('UpperLegL', 'LowerLegL') || 0.41, b: d('LowerLegL', 'FootL') || 0.47, w: hl && hr ? hl.distanceTo(hr) / 2 : 0.12,
      hs: hl && hr ? (hl.y + hr.y) / 2 - c.root.position.y : 0.87, u: d('UpperArmL', 'LowerArmL') || 0.31, f: d('LowerArmL', 'WristL') || 0.27 };
    M.hipAt = new THREE.Vector3(0, M.body.hs, 0);
    // (each hand's palm: the wrist's own axis, x or z either way, that points in toward the body standing, as the calm
    // standing pose holds the palms to the thighs; the fingers run along its +y)
    M.palm = {};
    const rq0 = c.root.getWorldQuaternion(new THREE.Quaternion()), wq = new THREE.Quaternion();
    for (const [s, sg] of [['L', 1], ['R', -1]]) {
      if (!B['Wrist' + s]) continue;
      B['Wrist' + s].getWorldQuaternion(wq);
      const inward = new THREE.Vector3(-sg, 0, 0).applyQuaternion(rq0);
      let best = null, bd = -2;
      for (const ax of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) { const d = new THREE.Vector3(...ax).applyQuaternion(wq).dot(inward); if (d > bd) { bd = d; best = ax; } }
      M.palm[s] = new THREE.Vector3(...best);
    }
  }
  const still = () => !M.look && !M.talk && !M.bed && Math.abs(M.yaw) < 0.002 && Math.abs(M.pitch) < 0.002 && Math.abs(M.sway) < 1e-4 && M.nodLeft <= 0
    && M.arms.L.every((v) => v < 0.002) && M.arms.R.every((v) => v < 0.002);

  // ── ON A BED (M.bed): the whole person moved so the hip joints' middle is where it is wanted, then the legs, the feet
  // and (last, after the body above the hips has moved) the hands, each worn over the clip's by its own amount ──
  const _iq = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _m4 = new THREE.Matrix4();
  const _tx = new THREE.Vector3(), _ty = new THREE.Vector3(), _tz = new THREE.Vector3(), _mid = new THREE.Vector3(), _pole = new THREE.Vector3();
  // (a bone turned in the world about its own joint, so `from` comes to lie along `to`: k of the way)
  function aim(bone, from, to, k) {
    if (!bone || !bone.parent || from.lengthSq() < 1e-12 || to.lengthSq() < 1e-12) return;
    _qa.setFromUnitVectors(from.normalize(), to.normalize());
    _qb.identity().slerp(_qa, Math.min(1, k));
    bone.parent.getWorldQuaternion(_pq);
    _q.copy(_pq).invert().multiply(_qb).multiply(_pq);
    bone.quaternion.premultiply(_q);
  }
  const arr = (v) => [v.x, v.y, v.z];
  function onBed(D) {
    const ul = B.UpperLegL, ur = B.UpperLegR; if (!ul || !ur) return;
    // (where the clips put the hip joints' middle: measured for people.js, then the whole person moved onto `hips`)
    _mid.addVectors(ul.getWorldPosition(_v1), ur.getWorldPosition(_v2)).multiplyScalar(0.5);
    M.hipAt.copy(_mid).sub(c.root.position).applyQuaternion(_iq.copy(_rq).invert());
    c.root.position.add(_v1.copy(D.hips).sub(_mid)); c.root.updateMatrixWorld(true);
    if (!(D.legs > 0.001)) return;
    for (const [i, s, sg] of [[0, 'L', 1], [1, 'R', -1]]) {
      const U = B['UpperLeg' + s], L = B['LowerLeg' + s], F = B['Foot' + s]; if (!U || !L) continue;
      const hip = U.getWorldPosition(_h), knee0 = L.getWorldPosition(_k);
      const ik = twoBone(arr(hip), arr(D.feet[i]), arr(D.pole), M.body.a, M.body.b);
      // the thigh, hip to knee, turned onto the knee's place
      aim(U, _v1.subVectors(knee0, hip), _v2.set(ik.mid[0] - hip.x, ik.mid[1] - hip.y, ik.mid[2] - hip.z), D.legs);
      U.updateWorldMatrix(false, true);
      // the shin along its own +y (where the crew kit puts the foot) turned onto the foot's place
      const kn = L.getWorldPosition(_k);
      L.updateWorldMatrix(true, false);
      aim(L, _v1.setFromMatrixColumn(L.matrixWorld, 1), _v2.set(ik.end[0] - kn.x, ik.end[1] - kn.y, ik.end[2] - kn.z), D.legs);
      L.updateWorldMatrix(false, true);
      // the foot (the crew's feet hang from the root, not the shins: turned here; the crew kit then puts it at the
      // shin's end): its own +y to the toes, its +z down out of the sole
      if (F && F.parent) {
        // (up on the toes, pointed, or turned out at rest: the move's own; their left, for which way is out)
        _ty.set(sg, 0, 0).applyQuaternion(_rq);
        const fw = footWay(arr(_v1.setFromMatrixColumn(L.matrixWorld, 1)), arr(D.pole), arr(D.ahead), D.flat, { point: D.point, pitch: D.pitch || 0, out: arr(_ty), roll: D.roll || 0 });
        _ty.fromArray(fw.toe); _tz.fromArray(fw.up).negate(); _tx.crossVectors(_ty, _tz);
        _qa.setFromRotationMatrix(_m4.makeBasis(_tx, _ty, _tz));
        F.getWorldQuaternion(_qb).slerp(_qa, Math.min(1, D.legs));
        F.parent.getWorldQuaternion(_pq); F.quaternion.copy(_pq.invert().multiply(_qb));
      }
    }
    c.root.updateMatrixWorld(true);
  }
  function handsOn(D) {
    // each hand onto its place on the bed, the elbow behind and out to its side, as someone leans on their hands
    c.root.updateMatrixWorld(true);
    _tx.set(1, 0, 0).applyQuaternion(_rq);      // (their left)
    for (const [i, s, sg] of [[0, 'L', 1], [1, 'R', -1]]) {
      const ua = B['UpperArm' + s], la = B['LowerArm' + s], wr = B['Wrist' + s]; if (!ua || !la || !wr) continue;
      const sh = ua.getWorldPosition(_h).clone(), el0 = la.getWorldPosition(_k);
      if (D.elbows) _pole.copy(D.elbows[i]); else _pole.copy(D.ahead).multiplyScalar(-1).addScaledVector(_tx, sg * 0.7).add(_ty.set(0, -0.25, 0));
      const ik = twoBone(arr(sh), arr(D.hands[i]), arr(_pole), M.body.u, M.body.f);
      aim(ua, _v1.subVectors(el0, sh), _v2.set(ik.mid[0] - sh.x, ik.mid[1] - sh.y, ik.mid[2] - sh.z), D.arms);
      ua.updateWorldMatrix(false, true);
      const el = la.getWorldPosition(_k).clone(), w0 = wr.getWorldPosition(_v1);
      aim(la, _v2.subVectors(w0, el), _v1.set(ik.end[0] - el.x, ik.end[1] - el.y, ik.end[2] - el.z), D.arms);
      la.updateWorldMatrix(false, true);
      // the hand flat on the bed: its palm down, the fingers ahead and a little out (pointed out past a narrow bed's
      // edge, the fingers curled down over it)
      const palm = M.palm && M.palm[s]; if (!palm) continue;
      if (D.fingers) _hf.copy(D.fingers[i]).setY(0).normalize(); else _hf.copy(D.ahead).addScaledVector(_tx, sg * 0.3).setY(0).normalize();
      _hd.set(0, -1, 0).addScaledVector(_hf, -_hf.y).normalize();
      _ma.makeBasis(_ha.set(0, 1, 0), palm, _hb.crossVectors(_ha, palm));
      _mb.makeBasis(_hf, _hd, _hc.crossVectors(_hf, _hd));
      _qa.setFromRotationMatrix(_mb.multiply(_ma.transpose()));
      wr.getWorldQuaternion(_qb).slerp(_qa, Math.min(1, D.arms));
      wr.parent.getWorldQuaternion(_pq); wr.quaternion.copy(_pq.invert().multiply(_qb));
      wr.updateWorldMatrix(false, true);
    }
  }
  const _hf = new THREE.Vector3(), _hd = new THREE.Vector3(), _ha = new THREE.Vector3(), _hb = new THREE.Vector3(), _hc = new THREE.Vector3(), _ma = new THREE.Matrix4(), _mb = new THREE.Matrix4();
  function lay(dt) {
    M.t += dt;
    if (still()) { M.yaw = M.pitch = M.sway = 0; M.lastTalk = M.talk; return; }      // (nothing to lay on: costs nothing)
    c.root.updateMatrixWorld(true);
    c.root.getWorldQuaternion(_rq);
    // (on a bed: the person put where they are, first, the legs bent to their places)
    if (M.bed) onBed(M.bed);
    // the head toward what it looks at (yaw and a little pitch, in the person's own frame), the neck taking its share
    let wy = 0, wp = 0;
    if (M.look && B.Head) {
      _w.copy(M.look); _m.copy(c.root.matrixWorld).invert(); _w.applyMatrix4(_m);
      B.Head.getWorldPosition(_p).applyMatrix4(_m);
      const dx = _w.x - _p.x, dy = _w.y - _p.y, dz = _w.z - _p.z;
      wy = Math.max(-MOVES.turn, Math.min(MOVES.turn, Math.atan2(dx, dz)));
      // (behind them: no wrenching round; the body turns instead, people.js)
      if (dz < -0.2 && Math.abs(dx) < Math.abs(dz)) wy = 0;
      wp = Math.max(-MOVES.up, Math.min(MOVES.up, -Math.atan2(dy, Math.hypot(dx, dz))));
    }
    const k = Math.min(1, dt * MOVES.rate);
    M.yaw += (wy - M.yaw) * k; M.pitch += (wp - M.pitch) * k * 0.8;
    // in a talk: a slow lean one way and then the other; nods (the listener's now and then, the speaker's on a beat)
    const talking = !!M.talk;
    M.swayT += dt;
    const swayWant = talking ? Math.sin(M.swayT / M.swayEvery * Math.PI * 2) * MOVES.lean * (M.sitting ? 0.5 : 1) : 0;
    M.sway = damp(M.sway, swayWant, 2, dt);
    M.nodT -= dt;
    if (talking && M.nodT <= 0) { M.nodLeft = 0.55; M.nodT = M.talk === 'listen' ? rnd(1.4, 3.6) : rnd(1.8, 4.5); M.nodSize = M.talk === 'listen' ? rnd(0.7, 1) : rnd(0.35, 0.6); }
    let nod = 0;
    if (M.nodLeft > 0) { M.nodLeft -= dt; const u = 1 - Math.max(0, M.nodLeft) / 0.55; nod = Math.sin(u * Math.PI) * MOVES.nod * (M.nodSize || 1); }
    // the speaker's hands: a new gesture every second or so, eased into, small beats while in it; the listener's now and
    // then a small one (a hand up a little, the hands together), back down after a moment
    const speaking = M.talk === 'speak' && !M.sitting, listening = M.talk === 'listen' && !M.sitting;
    // (the turn passing: a new speaker's hands start at once; a new listener's go down at once, a small move later.
    // Held over, a speaker's last gesture went on through the other's line and their own line began with hands down)
    if (M.talk !== M.lastTalk) {
      M.lastTalk = M.talk;
      if (speaking) M.nextGesture = M.t;
      else { M.want.L = GESTURES[4].L; M.want.R = GESTURES[4].R; M.listenG = false; M.nextGesture = M.t + rnd(1.5, 4); }
    }
    if (speaking) { if (M.t > M.nextGesture) { const g = pickGesture(); M.want.L = g.L; M.want.R = g.R; M.nextGesture = M.t + rnd(0.9, 2.0); } }
    else if (listening) {
      if (M.t > M.nextGesture) {
        const g = M.listenG ? null : LISTEN[Math.floor(Math.random() * LISTEN.length)];
        M.listenG = !!g; M.want.L = g ? g.L : GESTURES[4].L; M.want.R = g ? g.R : GESTURES[4].R;
        M.nextGesture = M.t + (g ? rnd(1.4, 2.6) : rnd(3, 7));
      }
    } else { M.want.L = GESTURES[4].L; M.want.R = GESTURES[4].R; M.listenG = false; }
    M.beatT += dt;
    const beat = speaking ? Math.max(0, Math.sin(M.beatT * 7.5)) * MOVES.beat : 0;
    for (const s of ['L', 'R']) for (let i = 0; i < 4; i++) M.arms[s][i] = damp(M.arms[s][i], M.want[s][i], 4.5, dt);
    // ── laid on: top down, so each bone turns from where its parent now is ──
    if (Math.abs(M.sway) > 1e-4) { turn(B.Abdomen, Z, M.sway * 0.5, _rq); turn(B.Chest, Z, M.sway * 0.5, _rq); }
    // (on a bed, lying back or sitting up: the upper back rounded forward, more of it in the chest)
    const curl = M.bed && M.bed.curl ? M.bed.curl : 0;
    if (curl) { turn(B.Abdomen, X, curl * 0.4, _rq); turn(B.Chest, X, curl * 0.6, _rq); }
    turn(B.Neck, Y, M.yaw * MOVES.neck, _rq); turn(B.Head, Y, M.yaw * (1 - MOVES.neck), _rq);
    // (on a bed, leaning back: the chin brought down, the neck taking half)
    const chin = M.bed && M.bed.chin ? M.bed.chin : 0;
    if (chin) turn(B.Neck, X, chin * 0.5, _rq);
    turn(B.Head, X, M.pitch + nod + chin * 0.5, _rq);
    for (const [s, sg] of [['L', 1], ['R', -1]]) {
      const [fwd, out, bend, palm] = M.arms[s];
      if (fwd + out + bend + palm < 0.003) continue;
      const ua = B['UpperArm' + s], la = B['LowerArm' + s], wr = B['Wrist' + s];
      turn(ua, X, -fwd, _rq); turn(ua, Z, out * sg, _rq);
      turn(la, X, -(bend + (s === 'R' ? beat : beat * 0.6) * Math.min(1, bend * 2)), _rq);
      // (the palm turned up, about the forearm's own line as it now lies: the turn shared, half the forearm's along its
      // length and half the wrist's, as kit/crew.js THE WRISTS A PERSON'S shares a clip's, so a sleeve's cuff, which
      // rides the forearm and the wrist together, is never twisted the whole way at the wrist (2026-11-17))
      if (la && wr && palm > 0.003) {
        la.updateWorldMatrix(true, false); wr.updateWorldMatrix(false, false);
        const a = la.getWorldPosition(_p), b = wr.getWorldPosition(_w), line = b.sub(a).normalize();
        turnWorld(la, line, -palm * sg * 0.5); la.updateWorldMatrix(false, true);
        turnWorld(wr, line, -palm * sg * 0.5);
      }
    }
    // (on a bed: the hands to their places, last, once everything above the hips is where it goes)
    if (M.bed && M.bed.hands && M.bed.arms > 0.001) handsOn(M.bed);
    c.root.updateMatrixWorld(true);
  }
  return M;
}
