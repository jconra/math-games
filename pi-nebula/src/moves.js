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
//   M.straight = 0..1              on a bed: the legs straightened that much, along the body (lying), or toward
//   M.legsTo = way | null          a way in the world when given (sitting up along the bed: toward its foot)
//
// HOW: each turn is laid on after the clips have set the bones and before the rest of the crew kit's frame (the feet,
// the arms out, the eyes: so the eyes aim from where the head has turned), by wrapping the person's clip player's own
// update. The crew kit's clip player puts these bones back as the clips left them before each update, so nothing builds
// up from one frame to the next. Every turn is about an axis of the person's own (x their left, y up, z ahead), so it
// means the same on every outfit's skeleton. Nothing moves the hips, nor the legs (the feet stay planted) but someone's
// lying on a bed (M.straight).
import * as THREE from 'three';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _a = new THREE.Vector3(), _p = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4();
const rnd = (a, b) => a + Math.random() * (b - a);
const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
// THE SIZES (radians): the head's turn toward what it looks at, at most, and how much of it the neck takes; the lean;
// a nod; the arms' gestures (the upper arm forward and out, the elbow bent, the palm turned up); a beat
export const MOVES = { turn: 0.85, up: 0.3, neck: 0.4, lean: 0.045, nod: 0.13, beat: 0.07, rate: 5 };
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

  const still = () => !M.look && !M.talk && !(M.straight > 0) && Math.abs(M.yaw) < 0.002 && Math.abs(M.pitch) < 0.002 && Math.abs(M.sway) < 1e-4 && M.nodLeft <= 0
    && M.arms.L.every((v) => v < 0.002) && M.arms.R.every((v) => v < 0.002);
  // (lying on a bed: both legs straight along the body, thigh and shin, as someone lies for a scan; the standing clip
  // has a knee bent, which lying down lifts a foot into the air. Done before the crew kit puts each foot at its shin's
  // end, so the feet follow)
  const _h = new THREE.Vector3(), _k = new THREE.Vector3(), _dn = new THREE.Vector3(), _ax = new THREE.Vector3();
  function straighten(rq, k) {
    // (toward M.legsTo, a way in the world, when given (sitting up along a bed: its foot); else along the body)
    if (M.legsTo) _dn.copy(M.legsTo).normalize(); else _dn.set(0, -1, 0).applyQuaternion(rq);
    for (const s of ['L', 'R']) {
      const ul = B['UpperLeg' + s], ll = B['LowerLeg' + s]; if (!ul || !ll) continue;
      // (the thigh: from the hip to the knee)
      const th = _k.copy(ll.getWorldPosition(_k)).sub(ul.getWorldPosition(_h)).normalize();
      let ang = Math.acos(Math.max(-1, Math.min(1, th.dot(_dn))));
      if (ang > 1e-3 && _ax.crossVectors(th, _dn).lengthSq() > 1e-10) turnWorld(ul, _ax.normalize(), ang * k);
      // (the shin: from the knee to the ankle, as it now lies)
      const ft = B['Foot' + s];
      const sh = ft ? _k.copy(ft.getWorldPosition(_k)).sub(ll.getWorldPosition(_h)).normalize() : (ll.updateWorldMatrix(true, false), _k.setFromMatrixColumn(ll.matrixWorld, 1).normalize());
      ang = Math.acos(Math.max(-1, Math.min(1, sh.dot(_dn))));
      if (ang > 1e-3 && _ax.crossVectors(sh, _dn).lengthSq() > 1e-10) turnWorld(ll, _ax.normalize(), ang * k);
    }
  }
  function lay(dt) {
    M.t += dt;
    if (still()) { M.yaw = M.pitch = M.sway = 0; return; }      // (nothing to lay on: costs nothing)
    c.root.updateMatrixWorld(true);
    c.root.getWorldQuaternion(_rq);
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
    if (M.straight > 0) straighten(_rq, Math.min(1, M.straight));
    if (Math.abs(M.sway) > 1e-4) { turn(B.Abdomen, Z, M.sway * 0.5, _rq); turn(B.Chest, Z, M.sway * 0.5, _rq); }
    turn(B.Neck, Y, M.yaw * MOVES.neck, _rq); turn(B.Head, Y, M.yaw * (1 - MOVES.neck), _rq);
    turn(B.Head, X, M.pitch + nod, _rq);
    for (const [s, sg] of [['L', 1], ['R', -1]]) {
      const [fwd, out, bend, palm] = M.arms[s];
      if (fwd + out + bend + palm < 0.003) continue;
      const ua = B['UpperArm' + s], la = B['LowerArm' + s], wr = B['Wrist' + s];
      turn(ua, X, -fwd, _rq); turn(ua, Z, out * sg, _rq);
      turn(la, X, -(bend + (s === 'R' ? beat : beat * 0.6) * Math.min(1, bend * 2)), _rq);
      // (the palm turned up, about the forearm's own line as it now lies)
      if (la && wr && palm > 0.003) {
        la.updateWorldMatrix(true, false); wr.updateWorldMatrix(false, false);
        const a = la.getWorldPosition(_p), b = wr.getWorldPosition(_w);
        turnWorld(wr, b.sub(a).normalize(), -palm * sg);
      }
    }
    c.root.updateMatrixWorld(true);
  }
  return M;
}
