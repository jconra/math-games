// THE BAND'S POSES, LAID OVER THE CLIPS: models/people/hands.json (the Hands Lab's, src/handplan.js) says what each bone
// turns on top of what the clip has, and where the instruments sit. One piece of code for the stage and the lab.
// The three.js mixer doesn't write what a clip didn't change, so turns laid on top would pile up frame on frame: before()
// puts the bones back as the clip had them, BEFORE mixer.update; after() lays the turns on again.
// Each joint's axis comes from the skeleton at its bind pose, not from the bones' own x, y and z: the rig's axes differ
// from skeleton to skeleton (the thumbs' most of all). Worked out so that:
//   a finger curls toward the palm, spreads away from the middle finger; the wrist tips toward the palm; the elbow bends
//   on the hinge square to the upper arm and forearm as the clip has them; a positive twist or roll turns the palm up.
// The palm's facing comes from the knuckles (Index2, Pinky2): all five palm bones (Index1 .. Pinky1, Thumb1) start at one
// point, so they can't say which way the palm faces.
// THE FOREARM'S TWIST: the rig has no twist bones, so makeHandPose gives this player five (children of the forearm, posed
// like it, appended after the 62, so the clips don't know them), and shares the forearm's skin among them by how far along
// it each vertex lies. Untwisted they sit exactly on the forearm: nothing moves until a twist is asked for.
//   loadHands(gameDir) -> Promise   reads the file once (no file: nobody's pose changes)
//   setHands(data)                  the numbers now (the lab, as its sliders move); getHands()
//   const H = makeHandPose(person, who, { props, harp })   props: { name: mesh } of handplan.js PLAYERS[who].props; harp:
//                                   STAGE.harp's sizes, for the harmonica between her hands
//   H.before(), H.after()
// A HAND'S SIZE (the file's sizes, cm): the Wrist bones scaled, so the palm and fingers shrink together round the wrist
// joint; anything the wrist carries (the fiddle, the bow) has the scale taken back off, so it stays its own size and place.
//   for the lab: H.elbow(side) -> { clip, now } degrees from straight; H.axis(bone, joint) -> its axis in the bone's frame;
//   H.captureLift() (once the clips are in: the arms as the rest and play clips have them); H.setLift(k or null): 0 at the side
//   .. 1 up at the mouth or chin, the arms worked through by src/handplan.js LIFTS with the instrument in the hand all the way;
//   H.pinShift[S] = [x, y, z]: that hand's pin moved along its prop (a fret hand going up the neck), set before after()
//   H.twistAxis(side); H.reach(side, target, clip) the wrist to a world point (writes the shoulder and the elbow's numbers);
//   H.propWorld(name) -> Matrix4; H.props; H.handLength() -> the model's hand in cm at full size; H.handScale()
// A THUMB'S LENGTH: the model's thumbs nearly reach the fingertips of their own hand. THUMB_K shortens the band's, bone scale
// on Thumb1 (a real thumb reaches about the middle of the index finger's first segment).
import * as THREE from 'three';
import { PLAYERS, LIFTS, ELBOW_MOST, FINGERS, cleanHands, jointsOf, setJoint, getJoint } from './handplan.js';
import { placeHarmonicaOn } from './bandgear.js';

let DATA = { v: 2, players: {} }, LOADING = null;
export function loadHands(dir) {
  if (!LOADING) LOADING = fetch(dir + 'models/people/hands.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) DATA = cleanHands(d); }).catch(() => {});
  return LOADING;
}
export const setHands = (d) => { DATA = d; };
export const getHands = () => DATA;

const v3 = () => new THREE.Vector3();
const TWISTS = [0.2, 0.4, 0.6, 0.8, 1];   // how much of the twist each twist bone takes, and how far along the forearm it stands
const A = v3(), B = v3(), C = v3(), D = v3(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), Q3 = new THREE.Quaternion(), M = new THREE.Matrix4(), M2 = new THREE.Matrix4(), EU = new THREE.Euler();
const F = new THREE.Vector3(0, 0, 1), U = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
const DEG = Math.PI / 180;
export const THUMB_K = 0.8, THUMB_OWN = { harpist: 1.25, fiddler: 0.95 };   // (the harmonica player's reach under the instrument from the far side of a cupped hand; the fiddler's under the bow's stick)

// the skin's share of the forearm over the twist bones (this player's own copy of the two skin attributes)
function addTwistBones(person, sides) {
  const mesh = person.mesh, sk = mesh.skeleton, old = mesh.geometry, n = old.attributes.position.count;
  const bones = sk.bones.slice(), inv = sk.boneInverses.map((m) => m.clone());
  const index = new Uint16Array(n * 4), weight = new Float32Array(n * 4), si = old.attributes.skinIndex, sw = old.attributes.skinWeight;
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { index[i * 4 + k] = si.getComponent(i, k); weight[i * 4 + k] = sw.getComponent(i, k); }
  const headOf = (b) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(sk.boneInverses[sk.bones.indexOf(b)]).invert());
  const P = v3();
  for (const s of Object.keys(sides)) {
    const a = sides[s], lo = sk.bones.indexOf(a.lo), E = headOf(a.lo), W = headOf(a.wr), along = W.clone().sub(E), len2 = along.lengthSq();
    a.twists = TWISTS.map((f, i) => {
      const b = new THREE.Bone(); b.name = `Twist${i + 1}${s}`; a.lo.add(b); bones.push(b); inv.push(sk.boneInverses[lo].clone());
      return { b, f, at: bones.length - 1 };
    });
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) {
      if (index[i * 4 + k] !== lo || weight[i * 4 + k] <= 0) continue;
      P.fromBufferAttribute(old.attributes.position, i).applyMatrix4(mesh.bindMatrix);
      const f = Math.max(0, Math.min(1, P.sub(E).dot(along) / len2)) * TWISTS.length, seg = Math.min(TWISTS.length - 1, Math.floor(f)), t = f - seg, w = weight[i * 4 + k];
      const from = seg === 0 ? lo : a.twists[seg - 1].at, to = a.twists[seg].at;
      let free = -1; for (let m = 0; m < 4; m++) if (weight[i * 4 + m] <= 0) { free = m; break; }
      if (free < 0) { index[i * 4 + k] = t < 0.5 ? from : to; continue; }   // (four bones already: the nearer one)
      index[i * 4 + k] = from; weight[i * 4 + k] = w * (1 - t);
      index[i * 4 + free] = to; weight[i * 4 + free] = w * t;
    }
  }
  // (the rest of the shape stays shared; only the two skin attributes are this player's own)
  const g = new THREE.BufferGeometry(); g.index = old.index; g.groups = old.groups; g.boundingBox = old.boundingBox; g.boundingSphere = old.boundingSphere; g.drawRange = old.drawRange;
  for (const k of Object.keys(old.attributes)) g.attributes[k] = old.attributes[k];
  g.attributes.skinIndex = new THREE.BufferAttribute(index, 4); g.attributes.skinWeight = new THREE.BufferAttribute(weight, 4);
  mesh.geometry = g;
  sk.dispose();
  mesh.skeleton = new THREE.Skeleton(bones, inv);
  // (let go: only this player's two attributes, the shared shape stays with the others)
  const dispose = person.dispose;
  person.dispose = () => { const si2 = g.attributes.skinIndex, sw2 = g.attributes.skinWeight; g.index = null; g.attributes = { skinIndex: si2, skinWeight: sw2 }; g.dispose(); dispose(); };
}

// THE ARM TO A POINT (two bones): the elbow bends to the distance, the shoulder swings it there, keeping the plane the arm
// is in. qHand: the hand's way in the world (null: as it was, turned by `yaw` of the forearm's swing about the upright). The
// bones' world matrices must be fresh; they're fresh again after. weight 0..1 of the way from where the arm was.
const sa = v3(), se = v3(), sw = v3(), sb = v3(), sc = v3(), sd = v3(), sn = v3(), sf = v3(), sg = v3(), so = v3(), sq = v3();
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion(), qu = new THREE.Quaternion(), ql = new THREE.Quaternion(), qw = new THREE.Quaternion(), qp = new THREE.Quaternion(), q0 = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
const rotOf = (mat, out) => { mat.decompose(so, out, sq); return out; };
export function solveArm(up, lo, wr, target, { qHand = null, yaw = 0, weight = 1 } = {}) {
  q0[0].copy(up.quaternion); q0[1].copy(lo.quaternion); q0[2].copy(wr.quaternion);
  sa.setFromMatrixPosition(up.matrixWorld); se.setFromMatrixPosition(lo.matrixWorld); sw.setFromMatrixPosition(wr.matrixWorld);
  rotOf(up.matrixWorld, qu); rotOf(lo.matrixWorld, ql); rotOf(wr.matrixWorld, qw); rotOf(up.parent.matrixWorld, qp);
  sb.subVectors(se, sa); sc.subVectors(sw, se);
  const la = sb.length(), lb = sc.length(); sn.crossVectors(sb, sc); const nl = sn.length();
  const dist = Math.max(Math.abs(la - lb) + 1e-3, Math.min(la + lb - 1e-3, sa.distanceTo(target)));
  const bendNow = sb.angleTo(sc), bendWant = Math.PI - Math.acos(Math.max(-1, Math.min(1, (la * la + lb * lb - dist * dist) / (2 * la * lb))));
  if (nl > 1e-6) qa.setFromAxisAngle(sn.divideScalar(nl), bendWant - bendNow); else qa.identity();
  sd.copy(sc).applyQuaternion(qa);
  sf.addVectors(sb, sd).normalize();
  qb.setFromUnitVectors(sf, sg.subVectors(target, sa).normalize());
  if (qHand) qw.copy(qHand);
  else if (yaw) {
    sf.copy(sc); sf.y = 0; sf.normalize(); sg.copy(sd).applyQuaternion(qb); sg.y = 0; sg.normalize();
    qc.setFromUnitVectors(sf, sg); qw.premultiply(q3Id.identity().slerp(qc, yaw));
  }
  qu.premultiply(qb); ql.premultiply(qa).premultiply(qb);
  up.quaternion.copy(qp).invert().multiply(qu).normalize();
  lo.quaternion.copy(qu).invert().multiply(ql).normalize();
  wr.quaternion.copy(ql).invert().multiply(qw).normalize();
  if (weight < 0.998) { up.quaternion.slerp(q0[0], 1 - weight); lo.quaternion.slerp(q0[1], 1 - weight); wr.quaternion.slerp(q0[2], 1 - weight); }
  up.updateWorldMatrix(false, true);
}
const q3Id = new THREE.Quaternion();

export function makeHandPose(person, who, { props = {}, harp = null } = {}) {
  const Bn = person.bones, root = person.root, inner = person.person, sk0 = person.mesh.skeleton;
  person.mesh.material.side = THREE.DoubleSide;   // (where a low-poly arm or hand folds, the inside shows as skin, not as a black hole)
  const invOf = (b) => sk0.boneInverses[sk0.bones.indexOf(b)];
  const head = (b) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(invOf(b)).invert());
  const dirTo = (b, c) => head(c).sub(head(b)).normalize();
  const local = (b, dir) => dir.clone().transformDirection(invOf(b));
  const axes = new Map();   // bone name -> { joint: axis in the bone's frame }
  const toward = (t, m) => new THREE.Vector3().crossVectors(t, m).normalize();   // (the axis that swings t toward m)
  const put = (n, o) => { const b = Bn[n]; if (!b) return; const e = {}; for (const [j, ax] of Object.entries(o)) e[j] = local(b, ax); axes.set(n, e); };
  for (const n of ['Body', 'Hips', 'Abdomen', 'Torso', 'Chest', 'Neck', 'Head']) put(n, { nod: X, turn: U, lean: new THREE.Vector3(0, 0, -1) });
  const arms = {};
  for (const s of ['L', 'R']) {
    const up = Bn['UpperArm' + s], lo = Bn['LowerArm' + s], wr = Bn['Wrist' + s], sign = s === 'L' ? -1 : 1;
    if (!up || !lo || !wr) continue;
    const dS = dirTo(Bn['Shoulder' + s], up), dU = dirTo(up, lo), dL = dirTo(lo, wr);
    put('Shoulder' + s, { lift: toward(dS, U), forward: toward(dS, F) });
    const roll = dU.clone().multiplyScalar(sign), fwd = toward(dU, F), raise = new THREE.Vector3().crossVectors(roll, fwd).normalize();
    fwd.crossVectors(raise, roll).normalize();
    put('UpperArm' + s, { forward: fwd, raise, roll });
    put('LowerArm' + s, { bend: toward(dL, F) });
    const w = head(wr), i2 = head(Bn['Index2' + s]), p2 = head(Bn['Pinky2' + s]), m2 = head(Bn['Middle2' + s]);
    const palm = new THREE.Vector3().subVectors(i2, w).cross(new THREE.Vector3().subVectors(p2, w)).normalize().multiplyScalar(s === 'R' ? 1 : -1);
    const thumbSide = new THREE.Vector3().subVectors(i2, p2).normalize(), dH = m2.clone().sub(w).normalize();
    put('Wrist' + s, { tip: toward(dH, palm), side: toward(dH, thumbSide) });
    for (const f of FINGERS) {
      const sprd = f === 'Index' || f === 'Middle' ? thumbSide : thumbSide.clone().negate();
      let t = dH;
      for (let i = 1; i <= 4; i++) {
        const b = Bn[f + i + s]; if (!b) continue;
        const c = Bn[f + (i + 1) + s]; if (c) t = dirTo(b, c);
        put(f + i + s, i <= 2 ? { curl: toward(t, palm), spread: toward(t, sprd) } : { curl: toward(t, palm) });
      }
    }
    let t = dH;
    for (let i = 1; i <= 3; i++) {
      const b = Bn['Thumb' + i + s]; if (!b) continue;
      const c = Bn['Thumb' + (i + 1) + s]; if (c) t = dirTo(b, c);
      const across = toward(t, palm.clone().sub(thumbSide));
      if (i === 1) { const away = new THREE.Vector3().crossVectors(across, t).normalize(); if (away.dot(palm) < 0) away.negate(); put('Thumb1' + s, { curl: across, out: toward(t, away) }); }
      else put('Thumb' + i + s, { curl: across });
    }
    put('UpperLeg' + s, { forward: toward(dirTo(Bn['UpperLeg' + s], Bn['LowerLeg' + s]), F), out: toward(dirTo(Bn['UpperLeg' + s], Bn['LowerLeg' + s]), s === 'L' ? X : X.clone().negate()), roll: dirTo(Bn['UpperLeg' + s], Bn['LowerLeg' + s]) });
    put('LowerLeg' + s, { bend: toward(new THREE.Vector3(0, -1, 0), F.clone().negate()) });
    put('Foot' + s, { tip: X.clone().negate(), turn: U });
    arms[s] = { up, lo, wr, twistAxis: local(lo, dL.clone().multiplyScalar(sign)), clipBend: 0, nowBend: 0, twists: [], hinge: local(lo, toward(dL, F)) };
  }
  addTwistBones(person, arms);
  // the bones this layer may turn: every bone with joints
  const list = [...axes.keys()].map((n) => Bn[n]).filter(Boolean), saved = list.map((b) => b.quaternion.clone());
  let have = false;
  // the props: each as its maker placed it (its parent's frame as the clip has it, then its own matrix)
  const P = {};
  for (const [name, mesh] of Object.entries(props)) {
    if (!mesh) continue;
    if (mesh.matrixAutoUpdate) mesh.updateMatrix();
    P[name] = { mesh, base: mesh.matrix.clone(), home: mesh.parent, world: new THREE.Matrix4() };
    mesh.matrixAutoUpdate = false;
  }
  const defProps = PLAYERS[who] ? PLAYERS[who].props : {};
  // the hand's length as modelled: wrist, along the middle finger, past its last bone by that bone's own length
  const handFull = (() => {
    const s = 'R', w = head(Bn['Wrist' + s]), m3 = head(Bn['Middle3' + s]), m4 = head(Bn['Middle4' + s]);
    return w.distanceTo(head(Bn['Middle1' + s])) + head(Bn['Middle1' + s]).distanceTo(head(Bn['Middle2' + s])) + head(Bn['Middle2' + s]).distanceTo(m3) + m3.distanceTo(m4) * 2;
  })();
  let handK = 1;
  const inHand = (b) => /^(Wrist|Index|Middle|Ring|Pinky|Thumb)/.test(b.name);
  const bendOf = (a) => { a.up.getWorldPosition(A); a.lo.getWorldPosition(B); a.wr.getWorldPosition(C); return 180 - new THREE.Vector3().subVectors(A, B).angleTo(D.subVectors(C, B)) / DEG; };

  // what the clips now playing ask: each clip's numbers by how much it plays (so a change of clip doesn't jump); a ramp's
  // are the two clips it goes between, shared out by how far through it is
  const def = PLAYERS[who] || { clips: [], props: {} };
  function wanted() {
    const pl = DATA.players && DATA.players[who], acts = inner.actions, out = { bones: {}, parts: {}, pins: {} };
    if (!pl) return out;
    const add = (clip, w, a) => {
      const c = pl[clip]; if (!c || w <= 0) return;
      if (c.bones) for (const n of Object.keys(c.bones)) { const o = out.bones[n] || (out.bones[n] = {}), b = c.bones[n]; for (const j of Object.keys(b)) o[j] = (o[j] || 0) + b[j] * w; }
      if (c.props) for (const n of Object.keys(c.props)) (out.parts[n] || (out.parts[n] = [])).push({ w, e: c.props[n], t: a ? a.time / a.getClip().duration : 0 });
      if (c.pins) for (const S of Object.keys(c.pins)) (out.pins[S] || (out.pins[S] = [])).push({ w, pin: c.pins[S] });
    };
    for (const clip of def.clips) { const a = acts[clip]; if (a && a.isScheduled()) add(clip, a.getEffectiveWeight(), a); }
    if (def.ramps) for (const clip of Object.keys(def.ramps)) {
      const a = acts[clip]; if (!a || !a.isScheduled()) continue;
      const w = a.getEffectiveWeight(); if (w <= 0) continue;
      const k = Math.min(1, a.time / a.getClip().duration), u = k * k * (3 - 2 * k), [from, to] = def.ramps[clip];
      add(from, w * (1 - u), acts[from]); add(to, w * u, acts[to]);
    }
    return out;
  }
  // where one clip's numbers put a prop (the world), from the frame it would have by itself
  function placePart(name, part, home, out) {
    const e = part.e;
    if (e.on && P[e.on]) {
      out.copy(P[e.on].world).multiply(M.fromArray(e.at));
      if (e.slide) out.multiply(M.makeTranslation(e.slide * Math.cos(part.t * Math.PI * 4), 0, 0));
    } else if (e.bone && Bn[e.bone]) H.holdFrame(e.bone, out).multiply(M.fromArray(e.at));
    else out.copy(home);
    if (e.rot && (e.rot[0] || e.rot[1] || e.rot[2])) out.multiply(M.makeRotationFromEuler(EU.set(e.rot[0] * DEG, e.rot[1] * DEG, e.rot[2] * DEG)));
    if (e.pos && (e.pos[0] || e.pos[1] || e.pos[2])) { const rq = root.getWorldQuaternion(Q2), rs = root.scale.x || 1; A.set(e.pos[0], e.pos[1], e.pos[2]).multiplyScalar(0.01 * rs).applyQuaternion(rq); M.makeTranslation(A.x, A.y, A.z); out.premultiply(M); }
    return out;
  }
  const PW = new THREE.Matrix4(), BP = v3(), BQ = new THREE.Quaternion(), PP = v3(), PQ = new THREE.Quaternion(), ONE = new THREE.Vector3(1, 1, 1);
  function seat(p) { const par = p.mesh.parent; if (par) { par.updateWorldMatrix(true, false); p.mesh.matrix.copy(M2.copy(par.matrixWorld).invert()).multiply(p.world); } else p.mesh.matrix.copy(p.world); p.mesh.matrixWorldNeedsUpdate = true; }
  function placeProp(name, want) {
    const p = P[name], parts = want.parts[name];
    if (name === 'harmonica' && harp && !(parts && parts.some((x) => x.e.bone))) {
      placeHarmonicaOn(person, p.mesh, harp);
      p.world.compose(p.mesh.position, p.mesh.quaternion, A.set(1, 1, 1));
    } else p.world.multiply(p.base);
    if (parts) {
      // (the share no clip spoke for stays at home; the rest blended, way and place)
      let sum = 0; for (const x of parts) sum += x.w;
      p.world.decompose(BP, BQ, A);
      // (the harmonica has no home of its own, it hangs from the scene: while her Idle clip fades out, that share took it across the room. The clips that speak for it get the whole say.)
      let got = name === 'harmonica' ? 0 : Math.max(0, 1 - sum), used = false;
      if (got > 0.001) used = true; else got = 0;
      for (const x of parts) {
        placePart(name, x, p.world, PW); PW.decompose(PP, PQ, A);
        if (!used) { BP.copy(PP); BQ.copy(PQ); got = x.w; used = true; continue; }
        got += x.w; BP.lerp(PP, x.w / got); BQ.slerp(PQ, x.w / got);
      }
      p.world.compose(BP, BQ, ONE);
    }
    seat(p);
  }
  let lastWant = null;
  const PT = v3(), PQ2 = new THREE.Quaternion(), PQ3 = new THREE.Quaternion();
  // THE LIFT: what each arm's bones are at either end, kept once; k: how far through (null: not lifting, the clips and pins as they are)
  const LIFT = LIFTS[who] || null, CHAIN = (s) => ['Shoulder', 'UpperArm', 'LowerArm', 'Wrist'].map((n) => n + s).concat(FINGERS.flatMap((f) => [1, 2, 3, 4].map((i) => f + i + s)), [1, 2, 3].map((i) => 'Thumb' + i + s)).map((n) => Bn[n]).filter(Boolean);
  const chains = {}, ends = { rest: {}, play: {}, mid: {} }; let liftK = null, liftReady = false;
  for (const s of Object.keys(arms)) chains[s] = CHAIN(s);
  const sm = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const armK = (s) => { const r = LIFT.share[s]; return Math.max(0, Math.min(1, (liftK - r[0]) / (r[1] - r[0]))); };
  const RELP = v3(), RELQ = new THREE.Quaternion(), REL2 = v3(), RELQ2 = new THREE.Quaternion();
  const fileClip = (clip) => { const pl = DATA.players && DATA.players[who]; return pl && pl[clip]; };
  // the prop's play place: on its bone, or riding the prop before it
  const playPlace = (name, out, refs) => {
    const e = fileClip(LIFT.play).props[name];
    if (e.on && refs[e.on]) { out.copy(refs[e.on]).multiply(M.fromArray(e.at)); const a = inner.actions[LIFT.play]; if (e.slide && a) out.multiply(M.makeTranslation(e.slide * Math.cos(a.time / a.getClip().duration * Math.PI * 4), 0, 0)); }
    else H.holdFrame(e.bone, out).multiply(M.fromArray(e.at));
    return out;
  };
  // an arm between its two ends, on top of the numbers just laid on: the turn from the live pose fades in and out at the ends, so a clip's own sway doesn't jump
  function liftArm(s) {
    const k = armK(s), u = k * k * (3 - 2 * k), f = Math.min(1, k * 8, (1 - k) * 8), R = ends.rest[s], Pl = ends.play[s], a = arms[s];
    const Mi = ends.mid[s];
    if (f > 0) chains[s].forEach((b, i) => { if (Mi && i < 3) { if (u < 0.5) Q.copy(R.q[i]).slerp(Mi[i], u * 2); else Q.copy(Mi[i]).slerp(Pl.q[i], u * 2 - 1); } else Q.copy(R.q[i]).slerp(Pl.q[i], u); b.quaternion.slerp(Q, f); });
    const deg = R.twist + (Pl.twist - R.twist) * u, now = (fileClip(k > 0.5 ? LIFT.play : LIFT.rest)?.bones?.['LowerArm' + s]?.twist) || 0, d = now + (deg - now) * f;
    for (const t of a.twists) t.b.quaternion.setFromAxisAngle(a.twistAxis, d * t.f * DEG);
  }
  function liftProps() {
    const refs = {}, restE = fileClip(LIFT.rest).props, pins = fileClip(LIFT.play).pins, T = LIFT.turn;
    for (const c of LIFT.carries) {
      const k = armK(c.hand), a = arms[c.hand], pin = pins[c.hand], p = P[c.prop], ref = refs[c.prop] = new THREE.Matrix4();
      playPlace(c.prop, ref, refs);
      PP.fromArray(pin.at).applyMatrix4(ref); ref.decompose(BP, PQ, A); PQ.multiply(PQ2.fromArray(pin.q));
      solveArm(a.up, a.lo, a.wr, PP, { qHand: PQ, weight: sm(0.55, 1, k) });
      // the prop in the hand: its hold at the side turning into the hold at the top (the pin's own numbers, the other way about)
      M.fromArray(restE[c.prop].at).decompose(RELP, RELQ, A);
      RELQ2.fromArray(pin.q).invert(); REL2.fromArray(pin.at).negate().applyQuaternion(RELQ2);
      const g = sm(T[0], T[1], k);
      RELP.lerp(REL2, g); RELQ.slerp(RELQ2, g);
      H.holdFrame('Wrist' + c.hand, p.world).multiply(M.compose(RELP, RELQ, ONE)); seat(p);
    }
    for (const c of LIFT.joins) {
      const k = armK(c.hand), a = arms[c.hand], pin = pins[c.hand], pw = P[c.prop].world;
      PP.fromArray(pin.at).applyMatrix4(pw); pw.decompose(BP, PQ, A); PQ.multiply(PQ2.fromArray(pin.q));
      solveArm(a.up, a.lo, a.wr, PP, { qHand: PQ, weight: sm(0.45, 1, k) });
    }
  }
  const lifting = () => liftReady && liftK != null && liftK > 0.001 && liftK < 0.999;
  const H = {
    props: P, pinShift: {},
    // (once the clips are in) the arms' bones as the rest clip has them with its numbers, and as the play clip does
    captureLift() {
      if (!LIFT || !fileClip(LIFT.rest) || !fileClip(LIFT.play) || !inner.actions[LIFT.rest] || !inner.actions[LIFT.play]) return false;
      liftK = null; const was = inner.curName;
      for (const [end, clip] of [['rest', LIFT.rest], ['play', LIFT.play]]) {
        H.before();
        for (const n of [LIFT.rest, LIFT.play]) { const a = inner.actions[n]; a.play(); a.stopFading(); a.setEffectiveWeight(n === clip ? 1 : 0); a.time = a.getClip().duration * 0.15; a.paused = false; }
        inner.mixer.update(0); H.after();
        for (const s of Object.keys(arms)) {
          ends[end][s] = { q: chains[s].map((b) => b.quaternion.clone()), twist: (fileClip(clip).bones?.['LowerArm' + s]?.twist) || 0 };
          const m = end === 'rest' && LIFT.mid && LIFT.mid[s];
          if (m) ends.mid[s] = ['UpperArm', 'LowerArm'].reduce((out, n) => { const i = n === 'UpperArm' ? 1 : 2, q = ends.rest[s].q[i].clone(), o = m[n] || {}; for (const j of Object.keys(o)) { if (!o[j]) continue; const ax = n === 'LowerArm' ? arms[s].hinge : axes.get(n + s)[j]; q.multiply(Q.setFromAxisAngle(ax, o[j] * DEG)); } out[i] = q; return out; }, [ends.rest[s].q[0].clone()]);
        }
      }
      for (const n of [LIFT.rest, LIFT.play]) { const a = inner.actions[n]; a.setEffectiveWeight(n === was ? 1 : 0); if (n !== was) a.stop(); }
      H.before(); inner.mixer.update(0);
      liftReady = true; return true;
    },
    setLift(k) { liftK = k; },
    before() { if (!have) return; for (let i = 0; i < list.length; i++) list[i].quaternion.copy(saved[i]); },
    after() {
      for (let i = 0; i < list.length; i++) saved[i].copy(list[i].quaternion);
      have = true;
      const want = wanted(), cm = DATA.sizes && DATA.sizes[who];
      handK = cm ? cm / (handFull * 100) : 1;
      for (const s of Object.keys(arms)) { arms[s].wr.scale.setScalar(handK); const t1 = Bn['Thumb1' + s]; if (t1) t1.scale.setScalar(THUMB_OWN[who] || THUMB_K); }
      root.updateMatrixWorld(true);
      for (const name of Object.keys(P)) { const p = P[name]; if (!p.home) continue; p.world.copy(p.home.matrixWorld); if (inHand(p.home)) p.world.scale(A.setScalar(1 / handK)); }
      for (const s of Object.keys(arms)) {
        const a = arms[s]; a.clipBend = a.nowBend = bendOf(a);
        // the elbow's hinge as the clip now has the arm: square to the upper arm and the forearm (a clip may roll the forearm
        // bone about its length, so the rest pose's axis can miss it); nearly straight there's no such square, so the rest one
        A.subVectors(B, A); C.sub(B);   // (bendOf's shoulder, elbow, wrist: the upper arm's way, the forearm's way)
        D.crossVectors(A, C);
        if (a.clipBend > 8 && D.lengthSq() > 1e-8) a.hinge.copy(D.normalize().applyQuaternion(a.lo.getWorldQuaternion(Q).invert()));
        // (near straight the arm's own plane says little: the hinge it last had stays. Going back to the file's axis here made the elbow leap across the arm whenever a clip's elbow crossed this line: the bass player's right arm, twice a loop)
        else if (!a.hingeSet) a.hinge.copy(axes.get('LowerArm' + s).bend);
        if (a.clipBend > 8) a.hingeSet = true;
      }
      for (const n of Object.keys(want.bones)) {
        const b = Bn[n], ax = axes.get(n); if (!b || !ax) continue;
        const v = want.bones[n];
        for (const j of jointsOf(n)) {
          const deg = v[j.id]; if (!deg || !ax[j.id]) continue;
          let d = deg;
          if (j.id === 'bend' && n.startsWith('LowerArm')) { const a = arms[n[n.length - 1]]; d = Math.max(-a.clipBend, Math.min(ELBOW_MOST - a.clipBend, deg)); a.nowBend = a.clipBend + d; }
          b.quaternion.multiply(Q.setFromAxisAngle(j.id === 'bend' && n.startsWith('LowerArm') ? arms[n[n.length - 1]].hinge : ax[j.id], d * DEG));
        }
      }
      // the twist: the whole of it at the wrist, a share of it at each twist bone along the forearm
      for (const s of Object.keys(arms)) {
        const a = arms[s], deg = (want.bones['LowerArm' + s] && want.bones['LowerArm' + s].twist) || 0;
        for (const t of a.twists) t.b.quaternion.setFromAxisAngle(a.twistAxis, deg * t.f * DEG);
        if (deg) a.wr.quaternion.premultiply(Q.setFromAxisAngle(a.twistAxis, deg * DEG));
      }
      const lift = lifting();
      if (lift) for (const s of Object.keys(arms)) liftArm(s);
      root.updateMatrixWorld(true);
      // the props: those on other props after those they ride
      const names = Object.keys(P);
      for (let pass = 0; pass < 2; pass++) for (const name of names) {
        const parts = want.parts[name], rides = !!(parts && parts.some((x) => x.e.on));
        if (rides === (pass === 1)) placeProp(name, want);
      }
      // the hands kept on their instruments
      if (lift) liftProps();
      else for (const S of Object.keys(want.pins)) {
        const a = arms[S]; if (!a) continue;
        let w = 0, got = false;
        for (const x of want.pins[S]) {
          const pr = P[x.pin.prop]; if (!pr) continue;
          const sh = H.pinShift[S];
          PW.copy(pr.world); PP.fromArray(x.pin.at); if (sh) { PP.x += sh[0]; PP.y += sh[1]; PP.z += sh[2]; } PP.applyMatrix4(PW); PW.decompose(BP, PQ, A); PQ.multiply(PQ2.fromArray(x.pin.q));
          if (!got) { PT.copy(PP); PQ3.copy(PQ); got = true; w = x.w; } else { w += x.w; PT.lerp(PP, x.w / w); PQ3.slerp(PQ, x.w / w); }
        }
        if (got) solveArm(a.up, a.lo, a.wr, PT, { qHand: PQ3, weight: Math.min(1, w) });
      }
      lastWant = want;
      if (!lift) H.placeHeld();
      // (a prop's mesh may hang from a wrist the pins just moved: it stays where the numbers put it in the world)
      for (const name of names) seat(P[name]);
    },
    // what a hand holds, placed again (it follows the hand after the pins, or a layer that moved it after them)
    placeHeld() {
      if (!lastWant) return;
      for (const name of Object.keys(P)) { const parts = lastWant.parts[name]; if (parts && parts.some((x) => x.e.bone && inHand(Bn[x.e.bone] || root))) { P[name].world.copy(P[name].home.matrixWorld); if (inHand(P[name].home)) P[name].world.scale(A.setScalar(1 / handK)); placeProp(name, lastWant); } }
    },
    // a bone's frame for holding things: a bone in the hand has its size taken off, so what it holds doesn't shrink
    holdFrame(bone, out) { const b = Bn[bone]; out.copy(b.matrixWorld); if (inHand(b)) out.scale(A.setScalar(1 / handK)); return out; },
    // this hand's wrist as it stands now, as a pin on that prop (what's kept in the file)
    pinNow(S, prop) { const a = arms[S], pr = P[prop]; if (!a || !pr) return null; root.updateMatrixWorld(true); pr.world.decompose(BP, PQ, A); PP.setFromMatrixPosition(a.wr.matrixWorld).sub(BP).applyQuaternion(PQ.clone().invert()); a.wr.matrixWorld.decompose(BP, PQ2, A); return { prop, at: PP.toArray(), q: PQ.clone().invert().multiply(PQ2).toArray() }; },
    handLength: () => handFull * 100, handScale: () => handK,
    elbow: (s) => (arms[s] ? { clip: arms[s].clipBend, now: arms[s].nowBend } : null),
    axis: (bone, joint) => { if (joint === 'bend' && bone.startsWith('LowerArm')) return arms[bone[bone.length - 1]].hinge; const e = axes.get(bone); return e && e[joint] ? e[joint] : null; },
    twistAxis: (s) => arms[s] && arms[s].twistAxis,
    hasJoints: (bone) => axes.has(bone),
    propWorld: (name) => P[name] && P[name].world,
    propNames: () => Object.keys(defProps).filter((n) => P[n]),
    // the wrist to a world point: the elbow bends to the distance needed, the shoulder swings it there; the numbers written
    // are the same shoulder and elbow numbers the sliders show. Run the pose once more afterward.
    reach(s, target, clip) {
      const a = arms[s]; if (!a) return;
      const ax = axes.get('UpperArm' + s), repose = () => { H.before(); H.after(); }, T = target.clone();
      for (let it = 0; it < 4; it++) {
        repose();
        const S = a.up.getWorldPosition(v3()), E = a.lo.getWorldPosition(v3()), W = a.wr.getWorldPosition(v3());
        const la = S.distanceTo(E), lb = E.distanceTo(W), d = Math.min(la + lb - 0.002, Math.max(Math.abs(la - lb) + 0.002, S.distanceTo(T)));
        const inside = Math.acos(Math.max(-1, Math.min(1, (la * la + lb * lb - d * d) / (2 * la * lb)))) / DEG;
        setJoint(DATA, who, clip, 'LowerArm' + s, 'bend', (180 - inside) - a.clipBend);
        repose();
        a.up.getWorldPosition(S); a.wr.getWorldPosition(W);
        Q.setFromUnitVectors(A.subVectors(W, S).normalize(), B.subVectors(T, S).normalize());
        // the upper arm's new turn in its own frame, over what the clip has, in its three named axes
        a.up.getWorldQuaternion(Q2); Q2.premultiply(Q);
        a.up.parent.getWorldQuaternion(Q3); Q3.invert().multiply(Q2);
        const clipQ = saved[list.indexOf(a.up)], off = clipQ.clone().invert().multiply(Q3);
        M.makeBasis(ax.forward, ax.raise, ax.roll); Q2.setFromRotationMatrix(M);
        EU.setFromQuaternion(Q2.clone().invert().multiply(off).multiply(Q2), 'XYZ');
        setJoint(DATA, who, clip, 'UpperArm' + s, 'forward', EU.x / DEG); setJoint(DATA, who, clip, 'UpperArm' + s, 'raise', EU.y / DEG); setJoint(DATA, who, clip, 'UpperArm' + s, 'roll', EU.z / DEG);
      }
      repose();
      return { off: a.wr.getWorldPosition(v3()).distanceTo(T), twist: getJoint(DATA, who, clip, 'LowerArm' + s, 'twist') };
    },
  };
  return H;
}
