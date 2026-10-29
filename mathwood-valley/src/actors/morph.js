// MORPH: reshape a skinned four-legged animal (longer or shorter legs, a longer body, a deeper chest, a bigger head, a
// shorter snout, bigger ears set another way, a curled tail...) once, when a breed is made, so that every clip still
// plays on it and it costs exactly what the plain animal costs to draw: one mesh, its own skeleton, no work per frame.
// The sliders and the rigs are in morphplan.js (plain data); this file does the three.js part.
//
// HOW: each bone gets a stretch (its own stretch of the body grows along the dog's side, up or forward, or along the
// bone, and its children sit that much further off) and maybe a bend (an ear folded, a tail curled). That gives a new
// rest pose. The mesh is laid out again in it (every corner moved as its bones moved it, the snout pulled in, the eyes
// grown) and bound to it afresh (new inverse bind matrices), so each bone carries its reshaped piece of the body.
// The clips are copied for the breed and changed to match, once:
//   - the bends ride on each key of the bent bones (an ear flick still flicks the folded ear)
//   - a bone whose parent grew sits that much further off in every key (a longer upper leg's knee, in every pose)
//   - THE FEET: the paws hang on bones of their own that the clips place in the world (Quaternius' IK bones, the farm
//     pack's feet), so a longer leg would leave its paw behind. Every frame of every clip (sampled at 30 a second) the
//     leg's new end is worked out and the paw moved by however far it moved, so paw and leg stay joined.
//   - THE GROUND: a shorter leg would hold the paws in the air. Every sampled frame, whatever touched the ground in the
//     original (the paws standing, the rump sitting, the belly lying) is found, and the body is lowered or raised, and
//     tipped nose-down or up, so those same parts touch it again: one fit for the whole clip, frame by frame, smoothed.
//     Frames where nothing touches (mid-gallop) take the frames either side of them.
//   - the clip's stride (how far it carries the animal at speed 1) grows with how far the paws now swing.
//
//   analyseKind(K)               -> the kind's shape at rest (bones, parts, landmarks), worked out once and kept on K
//   morphKind(K, morph, { size }) -> { scene, clips, info, geometry, shape, report }
//        K: a loaded kind of the animal library ({ scene, clips, info }); it is left as it was.
//        scene: a copy of K's with its own skeleton, its bones in the new rest pose and the mesh bound to it (the
//        material is K's; dogkind.js gives the breed its own coat). info: animals.json's entry for the kind, measured
//        again (height, tall, length, width, the strides, the model's scale with the size). report: what the fit did
//        (per clip: the most the body moved, the frames with nothing on the ground, the stride's change)
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { planMorph, rigFor, growthOf } from './morphplan.js';

const DOG_AXES = { side: 0, up: 1, fwd: 2 };
const AXIS_V = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const RATE = 30;                    // frames a second the feet and the ground are fitted at

// ── the kind at rest ──────────────────────────────────────────────────────────────────────────────────────────────
function skinnedOf(scene) { let m = null; scene.traverse((o) => { if (o.isSkinnedMesh && (!m || o.geometry.attributes.position.count > m.geometry.attributes.position.count)) m = o; }); return m; }
// the bones in an order where a parent always comes before its children
function boneOrder(bones) {
  const set = new Set(bones), out = [], seen = new Set();
  const visit = (b) => { if (seen.has(b)) return; if (b.parent && set.has(b.parent)) visit(b.parent); seen.add(b); out.push(b); };
  bones.forEach(visit);
  return out;
}
// which of the bone's own axes is closest to each of the dog's (side, up, forward), as a permutation: local axis i is
// dog axis map[i] (the best of the six ways to pair them)
function axisMap(rot) {
  const e = rot.elements, R = (d, i) => Math.abs(e[i * 4 + d]);   // (column i: the local axis i in the dog's space)
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  let best = perms[0], bs = -1;
  for (const p of perms) { const s = R(p[0], 0) + R(p[1], 1) + R(p[2], 2); if (s > bs) { bs = s; best = p; } }
  return best;
}

export function analyseKind(K) {
  if (K.dogShape) return K.dogShape;
  const scene = K.scene, mesh = skinnedOf(scene);
  scene.updateMatrixWorld(true);
  const bones = mesh.skeleton.bones, names = bones.map((b) => b.name), idx = Object.fromEntries(names.map((n, i) => [n, i]));
  const rig = rigFor(names);
  if (!rig) throw new Error('morph: no rig for the bones ' + names.join(','));
  const meshInv = mesh.matrixWorld.clone().invert();
  const W = bones.map((b) => meshInv.clone().multiply(b.matrixWorld));      // (each bone at rest, in the mesh's space)
  const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, col = g.attributes.color;
  const n = pos.count, X = new Float32Array(n * 3), N = new Float32Array(n * 3), dom = new Uint16Array(n), feat = new Uint8Array(n);
  // the corners at rest: through the bones, as the shader moves them (in the mesh's space)
  const J = new THREE.Matrix4(), M = new THREE.Matrix4(), v = new THREE.Vector3(), nv = new THREE.Vector3();
  const BM = bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(W[i], mesh.skeleton.boneInverses[i]));
  const nm = new THREE.Matrix3();
  for (let i = 0; i < n; i++) {
    J.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0); let bw = -1;
    for (let c = 0; c < 4; c++) {
      const w = sw.getComponent ? sw.getComponent(i, c) : [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)][c];
      const b = si.getComponent ? si.getComponent(i, c) : [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)][c];
      if (w <= 0) continue;
      M.copy(BM[b]); for (let k = 0; k < 16; k++) J.elements[k] += M.elements[k] * w;
      if (w > bw) { bw = w; dom[i] = b; }
    }
    v.fromBufferAttribute(pos, i).applyMatrix4(J); X[i * 3] = v.x; X[i * 3 + 1] = v.y; X[i * 3 + 2] = v.z;
    nm.setFromMatrix4(J); nv.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); N[i * 3] = nv.x; N[i * 3 + 1] = nv.y; N[i * 3 + 2] = nv.z;
    // the model's own features, by their colour: the eyes and the nose (nearly black), the eyes' shine (nearly white)
    if (col) { const r = col.getX(i), gg = col.getY(i), bb = col.getZ(i), l = 0.2126 * r + 0.7152 * gg + 0.0722 * bb; feat[i] = l < 0.045 ? 1 : l > 0.75 ? 2 : 0; }
  }
  // landmarks, in the mesh's space (the dog stands on y = ground, nose toward +Z)
  const head = idx[rig.head];
  const box = (test) => { const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity, n: 0 };
    for (let i = 0; i < n; i++) if (test(i)) { const x = X[i * 3], y = X[i * 3 + 1], z = X[i * 3 + 2]; b.n++;
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; if (z < b.z0) b.z0 = z; if (z > b.z1) b.z1 = z; }
    return b; };
  const all = box(() => true);
  const chestSet = new Set(rig.chest.map((c) => idx[c])), headBox = box((i) => dom[i] === head);
  const chestBox = box((i) => chestSet.has(dom[i]));
  // the eyes: the dark corners on the head's sides, in its upper half (not the nose at its front)
  const eyeOf = (s) => { const b = box((i) => dom[i] === head && feat[i] === 1 && Math.sign(X[i * 3]) === s && Math.abs(X[i * 3]) > (headBox.x1 - headBox.x0) * 0.12 && X[i * 3 + 2] < headBox.z1 - (headBox.z1 - headBox.z0) * 0.18);
    return b.n ? { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2, r: Math.max(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0) / 2, n: b.n } : null; };
  // (a real eye is small: the farm pack's pug has none, only a black mask and black ear flaps, so there the dark corners
  // aren't features at all and the coat paints them like the rest, its nose found by where it is)
  const small = (e) => (e && e.r < (headBox.y1 - headBox.y0) * 0.2 ? e : null);
  const eyeL = small(eyeOf(1)), eyeR = small(eyeOf(-1));
  if (!eyeL || !eyeR) feat.fill(0);
  const L = {
    ground: all.y0, withers: chestBox.y1, tall: all.y1, zBack: all.z0, zFront: all.z1, halfWidth: Math.max(-all.x0, all.x1),
    head: headBox, chest: chestBox, eyeL, eyeR,
    // where the muzzle starts: just in front of the eyes (or a third of the head's length back from the nose)
    zStop: eyeL && eyeR ? Math.max(eyeL.z, eyeR.z) + Math.max(eyeL.r, eyeR.r) * 0.6 : headBox.z1 - (headBox.z1 - headBox.z0) * 0.38,
    yMuzzle: eyeL && eyeR ? (headBox.y0 + Math.min(eyeL.y, eyeR.y)) / 2 : headBox.y0 + (headBox.y1 - headBox.y0) * 0.38,
  };
  K.dogShape = { mesh, rig, bones, names, idx, W, X, N, dom, feat, n, L };
  return K.dogShape;
}

// ── the new rest pose ─────────────────────────────────────────────────────────────────────────────────────────────
const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
const rotOf = (m, out = new THREE.Quaternion()) => { m.decompose(_v, out, new THREE.Vector3()); return out; };
const localMat = (p, q, s, out = new THREE.Matrix4()) => out.compose(p, q, s);

export function morphKind(K, morph = {}, { size = null } = {}) {
  const t0 = performance.now();
  const S = analyseKind(K), { rig, idx, W: Wold, X, N, dom, n, L } = S;
  const plan = planMorph(morph, rig);
  const sz = size ?? plan.size;
  // the breed's own copy of the kind: its own bones (the geometry and material shared until replaced below)
  const scene = cloneSkinned(K.scene);
  const mesh = skinnedOf(scene);
  scene.updateMatrixWorld(true);
  const bones = mesh.skeleton.bones, nb = bones.length, order = boneOrder(bones).map((b) => bones.indexOf(b));
  const parent = bones.map((b) => bones.indexOf(b.parent));          // (-1: a root; its parent is the armature)
  const meshInv = mesh.matrixWorld.clone().invert();
  const P = bones.map((b, i) => (parent[i] < 0 ? meshInv.clone().multiply(b.parent.matrixWorld) : null));   // (a root's parent, in the mesh's space)
  // each bone's rest rotation in the mesh's space, its axis map, and its stretch along its own axes
  const restRot = Wold.map((w) => new THREE.Matrix4().extractRotation(w));
  const F = bones.map((b) => {
    const gr = growthOf(plan.bones[b.name]), map = axisMap(restRot[bones.indexOf(b)]);
    const f = [1, 1, 1];
    for (let i = 0; i < 3; i++) f[i] *= [gr.side, gr.up, gr.fwd][map[i]];
    f[1] *= gr.along; f[0] *= gr.across; f[2] *= gr.across;
    return f;
  });
  const S_ = F.map((f) => new THREE.Matrix4().makeScale(f[0], f[1], f[2]));
  // the old rest, local: what the clips' unkeyed bones keep
  const oldPos = bones.map((b) => b.position.clone()), oldQuat = bones.map((b) => b.quaternion.clone()), oldScl = bones.map((b) => b.scale.clone());
  // the new rest, local: children further off where their parent grew; the bends
  const newPos = oldPos.map((p, i) => (parent[i] >= 0 ? new THREE.Vector3(p.x * F[parent[i]][0], p.y * F[parent[i]][1], p.z * F[parent[i]][2]) : p.clone()));
  // (bones shifted: a direction of the dog, at rest, turned into the parent's own space; a share of the withers height)
  const moved = bones.map((b, i) => {
    const mv = (plan.bones[b.name] || {}).move || []; if (!mv.length) return null;
    const d = new THREE.Vector3(); for (const [axis, k] of mv) d.addScaledVector(AXIS_V[DOG_AXES[axis]], k * (L.withers - L.ground));
    const pr = parent[i] >= 0 ? Wold[parent[i]] : P[i], q = new THREE.Quaternion(); pr.decompose(new THREE.Vector3(), q, new THREE.Vector3());
    const sc = new THREE.Vector3().setFromMatrixScale(pr);
    d.applyQuaternion(q.invert()).divide(sc);
    newPos[i].add(d); return d;
  });
  const newQuat = oldQuat.map((q) => q.clone());
  const pre = bones.map(() => null), post = bones.map(() => null);   // (each bent bone's turn before its key and after it)
  const Wn = bones.map(() => new THREE.Matrix4());
  const wOf = (i, out) => (parent[i] >= 0 ? out.copy(Wn[parent[i]]) : out.copy(P[i]));
  const pw = new THREE.Matrix4(), pr = new THREE.Quaternion(), br = new THREE.Quaternion(), R = new THREE.Quaternion();
  for (const i of order) {
    wOf(i, pw); rotOf(pw, pr);
    const turns = (plan.bones[bones[i].name] || {}).turn || [];
    for (const [axis, a, how] of turns) {
      R.setFromAxisAngle(AXIS_V[DOG_AXES[axis]], a);
      if (how === 'pre') { const c = pr.clone().invert().multiply(R).multiply(pr); newQuat[i].premultiply(c); pre[i] = (pre[i] || new THREE.Quaternion()).premultiply(c); }
      else { br.copy(pr).multiply(newQuat[i]); const c = br.clone().invert().multiply(R).multiply(br); newQuat[i].multiply(c); post[i] = (post[i] || new THREE.Quaternion()).multiply(c); }
    }
    Wn[i].multiplyMatrices(pw, localMat(newPos[i], newQuat[i], oldScl[i], _m));
  }
  // bones that follow another's reshaping (the ears beside the head): their root put where that bone's stretch and
  // turn carry it, then everything below worked out again
  const followers = bones.map((b, i) => [i, (plan.bones[b.name] || {}).follow]).filter(([, f]) => f && idx[f] !== undefined);
  if (followers.length) {
    for (const [i, f] of followers) {
      const fi = idx[f], at = new THREE.Vector3().setFromMatrixPosition(Wold[i]).applyMatrix4(Wold[fi].clone().invert()).applyMatrix4(S_[fi]).applyMatrix4(Wn[fi]);
      const local = at.applyMatrix4((parent[i] >= 0 ? Wn[parent[i]] : P[i]).clone().invert());
      const was = parent[i] >= 0 ? new THREE.Vector3(oldPos[i].x * F[parent[i]][0], oldPos[i].y * F[parent[i]][1], oldPos[i].z * F[parent[i]][2]) : oldPos[i].clone();
      moved[i] = local.clone().sub(was);   // (as a shift, so a keyed position moves with it too)
      newPos[i].copy(local);
    }
    for (const i of order) { wOf(i, pw); Wn[i].multiplyMatrices(pw, localMat(newPos[i], newQuat[i], oldScl[i], _m)); }
  }
  // the legs: each one's end (where its paw's bone sits, in the lower leg's own space, stretched with it) and the paw
  const legs = Object.entries(rig.legs).map(([k, l]) => {
    const low = idx[l.chain[l.chain.length - 1]], paw = idx[l.paw];
    const rel = new THREE.Vector3().setFromMatrixPosition(Wold[paw]).applyMatrix4(Wold[low].clone().invert());
    const relNew = new THREE.Vector3(rel.x * F[low][0], rel.y * F[low][1], rel.z * F[low][2]);
    return { k, front: l.front, low, paw, rel, relNew };
  });
  const pawSet = new Set(legs.map((l) => l.paw)), root = idx[rig.root];
  const inPaw = bones.map((b, i) => { for (let j = i; j >= 0; j = parent[j]) if (pawSet.has(j)) return j; return -1; });   // (the paw a bone hangs from, or -1)

  // contact probes: a few hundred corners spread over the body, each on its strongest bone (old and new, in that bone's
  // own space), to find what touches the ground in every frame
  const probes = [];
  { const step = Math.max(1, Math.floor(n / 700)), seen = new Set(), inv = Wold.map((w) => w.clone().invert());
    for (let i = 0; i < n; i += step) {
      const key = Math.round(X[i * 3] * 200) + ',' + Math.round(X[i * 3 + 1] * 200) + ',' + Math.round(X[i * 3 + 2] * 200); if (seen.has(key)) continue; seen.add(key);
      const b = dom[i], p = new THREE.Vector3(X[i * 3], X[i * 3 + 1], X[i * 3 + 2]).applyMatrix4(inv[b]);
      probes.push({ b, old: p, now: new THREE.Vector3(p.x * F[b][0], p.y * F[b][1], p.z * F[b][2]) });
    } }
  const H = L.withers - L.ground, eps = H * 0.035, bodyLen = L.zFront - L.zBack;

  // FORWARD: the bones' places for one set of local transforms (paws placed by the rule above), into out[]
  const E0 = legs.map(() => new THREE.Vector3()), E1 = legs.map(() => new THREE.Vector3());
  function fk(lp, lq, ls, out, { pawOld = null, extra = null } = {}) {
    // (the body first, the paws after: a paw goes where its leg now ends, by however far that is from the old end)
    for (const i of order) {
      if (inPaw[i] >= 0) continue;
      if (parent[i] < 0) localMat(lp[i], lq[i], ls[i], out[i]).premultiply(P[i]);
      else out[i].multiplyMatrices(out[parent[i]], localMat(lp[i], lq[i], ls[i], _m));
      if (extra && i === root) out[i].premultiply(extra);
    }
    if (pawOld) legs.forEach((l, k) => {
      E1[k].copy(l.relNew).applyMatrix4(out[l.low]);
      out[l.paw].copy(pawOld[l.paw]).setPosition(_v.setFromMatrixPosition(pawOld[l.paw]).add(E1[k]).sub(E0[k]));
    });
    for (const i of order) {
      if (inPaw[i] < 0 || pawSet.has(i) && pawOld) continue;
      if (parent[i] < 0) localMat(lp[i], lq[i], ls[i], out[i]).premultiply(P[i]);
      else out[i].multiplyMatrices(out[parent[i]], localMat(lp[i], lq[i], ls[i], _m));
    }
  }
  const oldW = bones.map(() => new THREE.Matrix4()), newW = bones.map(() => new THREE.Matrix4());
  // (the inverse of where a bone's parent is: the armature's place for a root)
  const _pi = new THREE.Matrix4();
  const parentInv = (i, Wset) => _pi.copy(parent[i] >= 0 ? Wset[parent[i]] : P[i]).invert();
  const ends = (Wset, rels, out) => legs.forEach((l, k) => out[k].copy(rels[k]).applyMatrix4(Wset[l.low]));
  const relOld = legs.map((l) => l.rel), relNew = legs.map((l) => l.relNew);
  // the fit: the body lowered/raised by o and tipped by th (round the side axis through the contacts' middle) so the
  // parts that touched the ground before touch it again
  const extraOf = (o, th, zp, yp, out = new THREE.Matrix4()) => out.makeTranslation(0, yp + o, zp).multiply(_m.makeRotationX(th)).multiply(new THREE.Matrix4().makeTranslation(0, -yp, -zp));
  function fit(thDefault) {
    const c = [], pv = new THREE.Vector3();
    for (const pr of probes) {
      const y0 = pv.copy(pr.old).applyMatrix4(oldW[pr.b]).y;
      if (y0 > L.ground + eps) continue;
      const q = pv.copy(pr.now).applyMatrix4(newW[pr.b]);
      c.push([q.y, q.z, y0]);
    }
    if (!c.length) return null;
    let z0 = Infinity, z1 = -Infinity, zm = 0; for (const [, z] of c) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); zm += z; } zm /= c.length;
    let th = thDefault;
    if (z1 - z0 > bodyLen * 0.3) {
      // least squares: y_old - y_new = o - th (z - zm)
      let szz = 0, szr = 0, sr = 0; for (const [y, z, y0] of c) { const dz = z - zm, r = y0 - y; szz += dz * dz; szr += dz * r; sr += r; }
      th = szz > 1e-9 ? -szr / szz : thDefault;
      th = Math.max(-0.5, Math.min(0.5, th));
    }
    let o = 0; for (const [y, z, y0] of c) o += y0 - y + th * (z - zm); o /= c.length;
    // ... and nothing of the reshaped dog lower than the original's lowest point this frame (a deeper chest lying
    // down lifts the dog on it, rather than sinking into the ground)
    let oldLow = Infinity, newLow = Infinity;
    for (const pr of probes) {
      oldLow = Math.min(oldLow, pv.copy(pr.old).applyMatrix4(oldW[pr.b]).y);
      const q = pv.copy(pr.now).applyMatrix4(newW[pr.b]); newLow = Math.min(newLow, q.y + o - th * (q.z - zm));
    }
    if (newLow < oldLow - H * 0.008) o += oldLow - newLow;
    return { o, th, zp: zm, contacts: c.length };
  }

  // the rest pose fitted: the paws on the ground, standing
  fk(oldPos, oldQuat, oldScl, oldW);
  ends(oldW, relOld, E0);
  fk(newPos, newQuat, oldScl, newW, { pawOld: oldW });
  const rest = fit(0) || { o: 0, th: 0, zp: 0 };
  const restExtra = extraOf(rest.o, rest.th, rest.zp, L.ground);
  fk(newPos, newQuat, oldScl, newW, { pawOld: oldW, extra: restExtra });
  // the root's new rest (its fitted place) and the paws' (where the legs now end)
  { const lw = newW[root].clone().premultiply(parentInv(root, newW)); lw.decompose(newPos[root], newQuat[root], new THREE.Vector3()); }
  for (const l of legs) { const lw = newW[l.paw].clone().premultiply(parentInv(l.paw, newW)); lw.decompose(newPos[l.paw], newQuat[l.paw], new THREE.Vector3()); }
  fk(newPos, newQuat, oldScl, newW);
  const WnRest = newW.map((m) => m.clone());

  // ── the mesh laid out again in the new rest pose ────────────────────────────────────────────────────────────────
  const T = bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(WnRest[i], S_[i]).multiply(Wold[i].clone().invert()));
  const g0 = mesh.geometry, sw = g0.attributes.skinWeight, si = g0.attributes.skinIndex;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  const head = idx[rig.head], hb = L.head;
  const snoutLen = (hb.z1 - L.zStop), sn = plan.snout;
  const eyes = [L.eyeL, L.eyeR].filter(Boolean);
  // (the tucked belly: the waist's underside drawn up toward the spine, its top line left as it is)
  const waist = new Set(rig.waist.map((b) => idx[b])), spineY = rig.waist.length ? new THREE.Vector3().setFromMatrixPosition(Wold[idx[rig.waist[0]]]).y : 0;
  const A = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Vector3(), nm = new THREE.Matrix3();
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < n; i++) {
    p.set(X[i * 3], X[i * 3 + 1], X[i * 3 + 2]);
    let jx = 1, jy = 1, jz = 1;
    // the head's own reshaping, before the bones move it: the snout pulled in (or out), wider, deeper; the eyes grown
    let hw = 0; for (let c = 0; c < 4; c++) if (si.getComponent ? si.getComponent(i, c) === head : [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)][c] === head) hw += sw.getComponent ? sw.getComponent(i, c) : [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)][c];
    if (hw > 0.01) {
      // (from the stop forward: the eyes, just behind it, keep their place; the muzzle's length eases in over its first
      // third so there's no crease, its width and depth over the same)
      const z0 = L.zStop, dz = p.z - z0;
      if (dz > -snoutLen * 0.1) {
        const e = ss(-snoutLen * 0.1, snoutLen * 0.35, dz) * hw;
        const kz = 1 + (sn.length - 1) * e, kx = 1 + (sn.width - 1) * e, ky = 1 + (sn.depth - 1) * e;
        if (dz > 0) p.z = z0 + dz * kz;
        p.x *= kx; p.y = L.yMuzzle + (p.y - L.yMuzzle) * ky;
        jx = kx; jy = ky; jz = dz > 0 ? kz : 1;
      }
      if (plan.eyes !== 1) for (const e of eyes) {
        const d = Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z), r = e.r * 1.25;
        if (d < r * 1.6 && Math.sign(p.x) === Math.sign(e.x)) {
          const f = (1 - ss(r, r * 1.6, d)) * hw * (plan.eyes - 1);
          p.x = e.x + (p.x - e.x) * (1 + f); p.y = e.y + (p.y - e.y) * (1 + f); p.z = e.z + (p.z - e.z) * (1 + f);
          // (and out a touch, so a bigger eye still stands proud of the face)
          p.x += Math.sign(e.x) * e.r * 0.25 * f;
        }
      }
    }
    if (plan.tuck > 0 && p.y < spineY) {
      let ww = 0; for (let c = 0; c < 4; c++) { const b = si.getComponent ? si.getComponent(i, c) : [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)][c]; if (waist.has(b)) ww += sw.getComponent ? sw.getComponent(i, c) : [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)][c]; }
      if (ww > 0) { const k = 1 - 0.42 * plan.tuck * ww; p.y = spineY + (p.y - spineY) * k; jy *= k; }
    }
    // through the bones: each bone's piece moved as the bone moved, stretched as it stretched
    A.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    for (let c = 0; c < 4; c++) {
      const w = sw.getComponent ? sw.getComponent(i, c) : [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)][c];
      if (w <= 0) continue;
      const b = si.getComponent ? si.getComponent(i, c) : [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)][c];
      for (let k = 0; k < 16; k++) A.elements[k] += T[b].elements[k] * w;
    }
    q.copy(p).applyMatrix4(A); pos[i * 3] = q.x; pos[i * 3 + 1] = q.y; pos[i * 3 + 2] = q.z;
    // the normal: through the inverse transpose of the stretch, so a stretched side still faces the right way
    nm.setFromMatrix4(A).multiply(new THREE.Matrix3().set(jx, 0, 0, 0, jy, 0, 0, 0, jz)).invert().transpose();
    q.set(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]).applyMatrix3(nm).normalize(); nor[i * 3] = q.x; nor[i * 3 + 1] = q.y; nor[i * 3 + 2] = q.z;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  for (const k of ['skinIndex', 'skinWeight', 'color']) if (g0.attributes[k]) geometry.setAttribute(k, g0.attributes[k]);
  if (g0.index) geometry.setIndex(g0.index);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  // bound afresh: the bones at their new rest, the mesh where they put it
  for (let i = 0; i < nb; i++) { bones[i].position.copy(newPos[i]); bones[i].quaternion.copy(newQuat[i]); bones[i].scale.copy(oldScl[i]); }
  scene.updateMatrixWorld(true);
  const inverses = bones.map((b, i) => WnRest[i].clone().invert());
  mesh.geometry = geometry;
  mesh.bindMatrix.identity(); mesh.bindMatrixInverse.identity();
  mesh.skeleton = new THREE.Skeleton(bones, inverses);
  mesh.bind(mesh.skeleton, mesh.matrixWorld.clone().multiply(meshInv));   // (the mesh's space is the bind space)

  // ── the clips, for the breed ───────────────────────────────────────────────────────────────────────────────────
  const report = { rest: { lower: +(rest.o / H).toFixed(3), tip: +rest.th.toFixed(3) }, clips: {} };
  const ratio = {};
  const clips = K.clips.map((clip) => {
    const tracks = [], byBone = new Map();
    for (const tr of clip.tracks) {
      const dot = tr.name.lastIndexOf('.'), bn = tr.name.slice(0, dot), prop = tr.name.slice(dot + 1), i = idx[bn];
      if (i === undefined) { tracks.push(tr); continue; }
      (byBone.get(i) || byBone.set(i, {}).get(i))[prop] = tr;
    }
    // the bones' local transforms at a time, old and new (unkeyed bones keep their rest)
    const ev = [];
    for (const [i, t] of byBone) for (const [prop, tr] of Object.entries(t)) ev.push({ i, prop, interp: tr.createInterpolant(), tr });
    const lpO = oldPos.map((v) => v.clone()), lqO = oldQuat.map((v) => v.clone()), lsO = oldScl.map((v) => v.clone());
    const lpN = newPos.map((v) => v.clone()), lqN = newQuat.map((v) => v.clone()), lsN = oldScl.map((v) => v.clone());
    function poseAt(t) {
      for (let i = 0; i < nb; i++) { lpO[i].copy(oldPos[i]); lqO[i].copy(oldQuat[i]); lsO[i].copy(oldScl[i]); lpN[i].copy(newPos[i]); lqN[i].copy(newQuat[i]); lsN[i].copy(oldScl[i]); }
      lpN[root].copy(oldPos[root]); lqN[root].copy(oldQuat[root]);   // (the root unkeyed: as it was; the fit below moves it)
      for (const e of ev) {
        const r = e.interp.evaluate(t), i = e.i;
        if (e.prop === 'position') { lpO[i].fromArray(r); if (parent[i] >= 0) lpN[i].set(r[0] * F[parent[i]][0], r[1] * F[parent[i]][1], r[2] * F[parent[i]][2]); else lpN[i].fromArray(r); if (moved[i]) lpN[i].add(moved[i]); }
        else if (e.prop === 'quaternion') { lqO[i].fromArray(r); lqN[i].fromArray(r); if (pre[i]) lqN[i].premultiply(pre[i]); if (post[i]) lqN[i].multiply(post[i]); }
        else if (e.prop === 'scale') { lsO[i].fromArray(r); lsN[i].fromArray(r); }
      }
    }
    // keep the tracks of every bone but the root and the paws, changed for the bends and the stretches
    for (const [i, t] of byBone) {
      if (i === root || pawSet.has(i)) { if (pawSet.has(i) && t.quaternion) tracks.push(t.quaternion); if (t.scale) tracks.push(t.scale); continue; }
      for (const [prop, tr] of Object.entries(t)) {
        if (prop === 'quaternion' && (pre[i] || post[i])) {
          const vals = tr.values.slice(), qq = new THREE.Quaternion();
          for (let k = 0; k < vals.length; k += 4) { qq.fromArray(vals, k); if (pre[i]) qq.premultiply(pre[i]); if (post[i]) qq.multiply(post[i]); qq.toArray(vals, k); }
          tracks.push(new THREE.QuaternionKeyframeTrack(tr.name, tr.times, vals));
        } else if (prop === 'position' && ((parent[i] >= 0 && F[parent[i]].some((f) => f !== 1)) || moved[i])) {
          const vals = tr.values.slice(), f = parent[i] >= 0 ? F[parent[i]] : [1, 1, 1], d = moved[i] || { x: 0, y: 0, z: 0 };
          for (let k = 0; k < vals.length; k += 3) { vals[k] = vals[k] * f[0] + d.x; vals[k + 1] = vals[k + 1] * f[1] + d.y; vals[k + 2] = vals[k + 2] * f[2] + d.z; }
          tracks.push(new THREE.VectorKeyframeTrack(tr.name, tr.times, vals));
        } else tracks.push(tr);
      }
    }
    // the root and the paws, frame by frame: the feet joined to the legs, the ground fitted
    const nT = Math.max(2, Math.round(clip.duration * RATE) + 1), times = new Float32Array(nT);
    for (let k = 0; k < nT; k++) times[k] = clip.duration * k / (nT - 1);
    const fits = [], oldPaw = [], oldRoot = [];
    for (let k = 0; k < nT; k++) {
      poseAt(times[k]);
      fk(lpO, lqO, lsO, oldW); ends(oldW, relOld, E0);
      fk(lpN, lqN, lsN, newW, { pawOld: oldW });
      fits.push(fit(rest.th));
      oldPaw.push(legs.map((l) => oldW[l.paw].clone()));
    }
    // frames with nothing on the ground take the frames either side; then smoothed a little
    const known = fits.map((f, k) => (f ? k : -1)).filter((k) => k >= 0);
    const series = fits.map((f, k) => {
      if (f) return f;
      if (!known.length) return { o: rest.o, th: rest.th, zp: rest.zp };
      let a = -1, b = -1; for (const j of known) { if (j < k) a = j; if (j > k && b < 0) b = j; }
      if (a < 0) return fits[b]; if (b < 0) return fits[a];
      const u = (k - a) / (b - a), A_ = fits[a], B_ = fits[b];
      return { o: A_.o + (B_.o - A_.o) * u, th: A_.th + (B_.th - A_.th) * u, zp: A_.zp + (B_.zp - A_.zp) * u };
    });
    const sm = series.map((f, k) => { const a = series[Math.max(0, k - 1)], b = series[Math.min(nT - 1, k + 1)];
      return { o: (a.o + 2 * f.o + b.o) / 4, th: (a.th + 2 * f.th + b.th) / 4, zp: (a.zp + 2 * f.zp + b.zp) / 4 }; });
    const rootP = new Float32Array(nT * 3), rootQ = new Float32Array(nT * 4), pawP = legs.map(() => new Float32Array(nT * 3));
    const ex = new THREE.Matrix4(), lw = new THREE.Matrix4(), pp = new THREE.Vector3(), qq = new THREE.Quaternion(), sc = new THREE.Vector3();
    let most = 0, travelOld = 0, travelNew = 0; const lastO = legs.map(() => null), lastN = legs.map(() => null);
    for (let k = 0; k < nT; k++) {
      poseAt(times[k]);
      fk(lpO, lqO, lsO, oldW); ends(oldW, relOld, E0);
      extraOf(sm[k].o, sm[k].th, sm[k].zp, L.ground, ex);
      fk(lpN, lqN, lsN, newW, { pawOld: oldW, extra: ex });
      lw.copy(newW[root]).premultiply(parentInv(root, newW)); lw.decompose(pp, qq, sc);
      pp.toArray(rootP, k * 3); qq.toArray(rootQ, k * 4);
      legs.forEach((l, j) => {
        lw.copy(newW[l.paw]).premultiply(parentInv(l.paw, newW)); pp.setFromMatrixPosition(lw); pp.toArray(pawP[j], k * 3);
        const zo = oldW[l.paw].elements[14], zn = newW[l.paw].elements[14];
        if (lastO[j] !== null) { travelOld += Math.abs(zo - lastO[j]); travelNew += Math.abs(zn - lastN[j]); }
        lastO[j] = zo; lastN[j] = zn;
      });
      most = Math.max(most, Math.abs(sm[k].o - rest.o) / H);
    }
    tracks.push(new THREE.VectorKeyframeTrack(bones[root].name + '.position', times, rootP));
    tracks.push(new THREE.QuaternionKeyframeTrack(bones[root].name + '.quaternion', times, rootQ));
    legs.forEach((l, j) => tracks.push(new THREE.VectorKeyframeTrack(bones[l.paw].name + '.position', times, pawP[j])));
    ratio[clip.name] = travelOld > 1e-6 ? travelNew / travelOld : 1;
    report.clips[clip.name] = { frames: nT, touchless: nT - known.length, most: +most.toFixed(3), stride: +ratio[clip.name].toFixed(3) };
    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  });

  // ── its numbers: measured again, at its size ──────────────────────────────────────────────────────────────────
  const base = K.info, chestSet = new Set(rig.chest.map((c) => idx[c]));
  let w1 = -Infinity, t1 = -Infinity, y0 = Infinity, z0 = Infinity, z1 = -Infinity, x1 = 0;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (chestSet.has(dom[i]) && y > w1) w1 = y; if (y > t1) t1 = y; if (y < y0) y0 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; if (Math.abs(x) > x1) x1 = Math.abs(x);
  }
  const k = (now, was) => (was > 1e-6 ? now / was : 1);
  const kH = k(w1 - y0, L.withers - L.ground), kT = k(t1 - y0, L.tall - L.ground), kL = k(z1 - z0, L.zFront - L.zBack), kW = k(x1, L.halfWidth);
  const stride = Object.fromEntries(Object.entries(base.stride || {}).map(([c, s]) => [c, +(s * (ratio[c] ?? 1) * sz).toFixed(3)]));
  const info = {
    ...base, scale: base.scale * sz, size: undefined,
    height: +(base.height * kH * sz).toFixed(3), tall: +(base.tall * kT * sz).toFixed(3), length: +(base.length * kL * sz).toFixed(3), width: +(base.width * kW * sz).toFixed(3),
    stride, seat: { ...base.seat, at: base.seat.at.map((x) => +(x * sz).toFixed(3)) },
    lasso: { ...base.lasso, radius: +(base.lasso.radius * sz).toFixed(3), at: base.lasso.at.map((x) => +(x * sz).toFixed(3)) },
  };
  delete info.size;
  report.ms = Math.round(performance.now() - t0);
  report.info = { height: info.height, tall: info.tall, length: info.length, stride };
  return { scene, mesh, clips, info, geometry, shape: S, plan, report, T, restLower: rest.o, restTip: rest.th };
}
