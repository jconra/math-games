// THE HANDS, LAID OVER THE CLIPS: models/people/hands.json (the Hands Lab's, src/handplan.js) says where a player's hands
// should be, away from where the clip has them. After the clips each frame: the wrist moves and the arm follows (the
// shoulder stays; a two-bone reach puts the elbow where it must be, swung round if asked), the hand turns on its wrist, the
// fingers curl. What the clips are mid-way between is shared by how much each is playing, so a change of clip doesn't jump.
// The three.js mixer doesn't write what a clip didn't change, so bends laid on top would pile up frame on frame: before()
// puts the bones back as the clip had them, BEFORE mixer.update; after() lays the bends on again.
//   loadHands(gameDir) -> Promise   reads the file once (no file: nobody's hands change)
//   setHands(data)                  the numbers now (the lab, as its sliders move); getHands()
//   const H = makeHandPose(person, who, { props })   person: makePerson's; who: a player of handplan.js PLAYERS; props: the
//                                   things that stay put when a hand moves off them ({ fiddle } for the fiddler's fret hand)
//   H.before(), H.after(), H.arms() -> { L: { bend (degrees from straight) }, R } as the arms are now
import * as THREE from 'three';
import { PLAYERS, cleanHands, cleanHand } from './handplan.js';

let DATA = { v: 1, players: {} }, LOADING = null;
export function loadHands(dir) {
  if (!LOADING) LOADING = fetch(dir + 'models/people/hands.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) DATA = cleanHands(d); }).catch(() => {});
  return LOADING;
}
export const setHands = (d) => { DATA = d; };
export const getHands = () => DATA;

const AXIS = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const v = () => new THREE.Vector3(), q = () => new THREE.Quaternion();
const S = v(), E = v(), W = v(), T = v(), D = v(), P = v(), N = v(), E2 = v(), A = v(), B = v(), OFF = v();
const Q = q(), Q2 = q(), Qw = q(), Qr = q(), Qp = q(), EU = new THREE.Euler(), M0 = new THREE.Matrix4(), M1 = new THREE.Matrix4();
const worldQ = (o, out) => o.getWorldQuaternion(out);
const refresh = (o) => o.updateWorldMatrix(true, true);
// give a bone this rotation in the world
function setWorldQ(bone, world) { worldQ(bone.parent, Qp); bone.quaternion.copy(Qp.invert()).multiply(world); }
// turn a bone in the world by R
function turnWorld(bone, R) { worldQ(bone, Q2); Q2.premultiply(R); setWorldQ(bone, Q2); }

export function makeHandPose(person, who, { props = null } = {}) {
  const def = PLAYERS[who], Bn = person.bones, root = person.root, inner = person.person;
  // (both faces of the skin, lit: where a low-poly arm or hand folds in on itself, the inside shows as skin, not as a black hole)
  person.mesh.material.side = THREE.DoubleSide;
  const arm = {}, all = [];
  const fingerBones = (s) => ({ fingers: ['Index1', 'Index2', 'Index3', 'Pinky1', 'Pinky2', 'Pinky3'].map((n) => Bn[n + s]).filter(Boolean), thumb: ['Thumb1', 'Thumb2', 'Thumb3'].map((n) => Bn[n + s]).filter(Boolean) });
  // each finger joint's bend axis, in that bone's own frame, from the skeleton at its bind pose: across the finger, so it
  // folds toward the palm
  const bind = (b) => { const i = person.mesh.skeleton.bones.indexOf(b); return new THREE.Matrix4().copy(person.mesh.skeleton.boneInverses[i]).invert(); };
  const posOf = (m) => new THREE.Vector3().setFromMatrixPosition(m);
  for (const s of ['L', 'R']) {
    const up = Bn['UpperArm' + s], lo = Bn['LowerArm' + s], wr = Bn['Wrist' + s]; if (!up || !lo || !wr) continue;
    const F = fingerBones(s), wp = posOf(bind(wr)), ip = posOf(bind(Bn['Index1' + s])), pp = posOf(bind(Bn['Pinky1' + s]));
    const palm = new THREE.Vector3().subVectors(ip, wp).cross(new THREE.Vector3().subVectors(pp, wp)).normalize().multiplyScalar(s === 'R' ? 1 : -1);
    const axes = new Map();
    for (const b of [...F.fingers, ...F.thumb]) {
      const m = bind(b), child = b.children.find((c) => c.isBone), to = child ? posOf(bind(child)).sub(posOf(m)).normalize() : new THREE.Vector3(0, 1, 0);
      const ax = new THREE.Vector3().crossVectors(to, palm); if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0); ax.normalize();
      axes.set(b, ax.transformDirection(new THREE.Matrix4().copy(m).invert()));
    }
    arm[s] = { up, lo, wr, F, axes, want: cleanHand(null), bend: 0 };
    all.push(up, lo, wr, ...F.fingers, ...F.thumb);
  }
  const saved = all.map((b) => b.quaternion.clone());
  let have = false;
  const keepers = [];
  if (props && def.keep) for (const [s, name] of Object.entries(def.keep)) if (props[name]) keepers.push({ s, mesh: props[name], hold: props[name].matrix.clone() });

  // what the clips now playing ask of each hand: each clip's numbers by how much it plays
  function wanted() {
    const pl = DATA.players && DATA.players[who], acts = inner.actions, out = { L: null, R: null };
    if (!pl) return out;
    for (const clip of Object.keys(pl)) {
      const a = acts[clip]; if (!a || !a.isRunning()) continue;
      const w = a.getEffectiveWeight(); if (w <= 0) continue;
      for (const s of ['L', 'R']) {
        const h = pl[clip][s]; if (!h) continue;
        const o = out[s] || (out[s] = cleanHand(null));
        for (let i = 0; i < 3; i++) { o.off[i] += h.off[i] * w; o.rot[i] += h.rot[i] * w; }
        o.elbow += h.elbow * w; o.curl.fingers += h.curl.fingers * w; o.curl.thumb += h.curl.thumb * w;
      }
    }
    return out;
  }
  function bendOf(a) { a.up.getWorldPosition(S); a.lo.getWorldPosition(E); a.wr.getWorldPosition(W); A.subVectors(S, E).normalize(); B.subVectors(W, E).normalize(); return 180 - Math.acos(Math.max(-1, Math.min(1, A.dot(B)))) * 180 / Math.PI; }

  const H = {
    // back to the clip's pose, before the mixer runs
    before() { if (!have) return; for (let i = 0; i < all.length; i++) all[i].quaternion.copy(saved[i]); },
    after() {
      for (let i = 0; i < all.length; i++) saved[i].copy(all[i].quaternion);
      have = true;
      const want = wanted();
      if (!want.L && !want.R && !keepers.length) return;
      root.updateMatrixWorld(true);
      worldQ(root, Qr);
      for (const s of ['L', 'R']) {
        const a = arm[s], h = want[s]; if (!a) continue;
        const keep = keepers.find((k) => k.s === s);
        if (keep) M0.copy(a.wr.matrixWorld);
        if (!h) { if (keep) keep.mesh.matrix.copy(keep.hold), keep.mesh.matrixWorldNeedsUpdate = true; continue; }
        worldQ(a.wr, Qw);   // (the hand's turn in the world as the clip has it)
        a.up.getWorldPosition(S); a.lo.getWorldPosition(E); a.wr.getWorldPosition(W);
        OFF.set(h.off[0], h.off[1], h.off[2]).multiplyScalar(0.01 / (root.scale.x || 1)).applyQuaternion(Qr).multiplyScalar(root.scale.x || 1);
        T.copy(W).add(OFF);
        const la = E.distanceTo(S), lb = E.distanceTo(W);
        D.subVectors(T, S); let d = D.length();
        const most = la + lb - 0.002, least = Math.abs(la - lb) + 0.002;
        if (d > most) { T.copy(S).addScaledVector(D, most / d); d = most; } else if (d < least) { T.copy(S).addScaledVector(D, least / d); d = least; }
        D.subVectors(T, S).normalize();
        // the elbow: the way it stood off the line from shoulder to wrist, swung round if asked
        P.subVectors(E, S); P.addScaledVector(D, -P.dot(D));
        if (P.lengthSq() < 1e-8) P.set(0, -1, 0).addScaledVector(D, D.y).normalize(); else P.normalize();
        if (h.elbow) P.applyAxisAngle(D, h.elbow * Math.PI / 180);
        const along = (la * la - lb * lb + d * d) / (2 * d), off = Math.sqrt(Math.max(0, la * la - along * along));
        E2.copy(S).addScaledVector(D, along).addScaledVector(P, off);
        // the upper arm to the new elbow, then the forearm to the wrist
        A.subVectors(E, S).normalize(); B.subVectors(E2, S).normalize(); Q.setFromUnitVectors(A, B); turnWorld(a.up, Q); refresh(a.up);
        a.lo.getWorldPosition(E); a.wr.getWorldPosition(W);
        A.subVectors(W, E).normalize(); B.subVectors(T, E).normalize(); Q.setFromUnitVectors(A, B); turnWorld(a.lo, Q); refresh(a.lo);
        // the hand: as the clip held it, turned as asked
        EU.set(h.rot[0] * Math.PI / 180, h.rot[1] * Math.PI / 180, h.rot[2] * Math.PI / 180);
        setWorldQ(a.wr, Q.copy(Qw).multiply(Q2.setFromEuler(EU)));
        for (const [list, deg] of [[a.F.fingers, h.curl.fingers], [a.F.thumb, h.curl.thumb]]) {
          if (!deg) continue;
          for (const b of list) b.quaternion.multiply(Q.setFromAxisAngle(a.axes.get(b), deg / 3 * Math.PI / 180));
        }
        refresh(a.wr);
        // what the hand has let go of stays where the clip has it
        if (keep) { M1.copy(a.wr.matrixWorld).invert().multiply(M0).multiply(keep.hold); keep.mesh.matrix.copy(M1); keep.mesh.matrixWorldNeedsUpdate = true; }
      }
    },
    arms() { root.updateMatrixWorld(true); const o = {}; for (const s of ['L', 'R']) if (arm[s]) o[s] = { bend: bendOf(arm[s]) }; return o; },
  };
  return H;
}
