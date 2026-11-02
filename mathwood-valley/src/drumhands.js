// THE DRUMMER IN STEP WITH THE MUSIC: the stage music's own box hits (M.events: { at, what: 'box', hit, vel }, baked or live the
// same): thump on the bass drum with his right foot on the pedal (the felt beater swings to the skin, the plate and his foot go
// down), slap and tap on the snare with his sticks, and on a loud thump his right stick strikes the cymbal too. The set pose in
// models/people/hands.json (the Hands Lab's) is the stick on the skin; each frame, after H.after(), this takes the hand back and
// turns the wrist off it by how far the stroke has got (src/drumplan.js strokeHeight), the arm following by two-bone IK. Every
// bone turned here is one H.before() puts back, so nothing piles up. Far off or on the lowest tier: held still at the ready.
//   const D = makeDrumHands(person, H, parts); D.update(now, events, weight);  parts: the kit's beater, plate, cymbal; D.log: an array to fill (rigs)
import * as THREE from 'three';
import { solveArm } from './handpose.js';
import { planHits, strokeHeight, STROKE, DRUMS, STRIKE } from './drumplan.js';

const DEG = Math.PI / 180;
const SX = new THREE.Vector3(), N = new THREE.Vector3(), RQ = new THREE.Quaternion(), CO = new THREE.Vector3(), FT = new THREE.Vector3();
const PE = DRUMS.pedal, PLATE_SLOPE = Math.atan2(DRUMS.pedal.toe[1] - DRUMS.pedal.heel[1], DRUMS.pedal.toe[2] - DRUMS.pedal.heel[2]) / DEG;   // (his sole lies along the plate)
const CD = new THREE.Vector3(), CT = new THREE.Vector3(), CQ = new THREE.Quaternion(), CQ2 = new THREE.Quaternion();
const WP = new THREE.Vector3(), WQ = new THREE.Quaternion(), SC = new THREE.Vector3(), UPV = new THREE.Vector3(), TQ = new THREE.Quaternion(), T = new THREE.Vector3(), AX = new THREE.Vector3();

export function makeDrumHands(person, H, parts = null) {
  const B = person.bones, root = person.root, D = { log: null }, plans = new WeakMap(), st = {}; let lastSeen = -1e9, cymAt = -1e9, cymK = 0;
  const foot = { last: -1e9, next: 1e9 }, cym = { last: -1e9, next: 1e9 };
  const hands = ['L', 'R'].map((S, side) => ({ S, side, up: B['UpperArm' + S], lo: B['LowerArm' + S], wr: B['Wrist' + S], last: -1e9, next: 1e9, logged: -1, h: STROKE.ready, wp: new THREE.Vector3(), wq: new THREE.Quaternion() }));
  // his head's nod at half what the clip has: each frame the spine's bones up to the head half way back to the clip's average way (the world's nod is theirs added up; the hands stay where the pose has them)
  // (the clip's nod read more than his sticks did). H.before() puts them back, so this doesn't pile up.
  const clip = person.person.actions.Play_Box && person.person.actions.Play_Box.getClip();
  const calm = ['Abdomen', 'Torso', 'Chest', 'Neck', 'Head'].map((n) => { const b = B[n], tr = clip && clip.tracks.find((t) => t.name === n + '.quaternion'); if (!b || !tr) return null;
    const v = tr.values, q = new THREE.Quaternion(), mean = new THREE.Quaternion(v[0], v[1], v[2], v[3]);
    for (let i = 4, k = 1; i < v.length; i += 4, k++) { q.set(v[i], v[i + 1], v[i + 2], v[i + 3]); if (q.dot(mean) < 0) q.set(-q.x, -q.y, -q.z, -q.w); mean.slerp(q, 1 / (k + 1)); }
    return { b, mean }; }).filter(Boolean);
  D.update = (now, events, weight, still = false, dt = 1 / 60) => {
    if (weight <= 0.002) return;
    for (const h of hands) { h.wr.matrixWorld.decompose(WP, WQ, SC); h.wp.copy(WP); h.wq.copy(WQ); }
    if (calm.length) { for (const c of calm) c.b.quaternion.slerp(c.mean, STROKE.calmHead * weight); calm[0].b.updateWorldMatrix(false, true); }
    for (const h of hands) { h.next = 1e9; h.last = -1e9; }
    foot.next = cym.next = 1e9; foot.last = cym.last = -1e9;
    if (events && !still) {
      // (each new hit given its limb, in order)
      let i = events.length - 1; while (i >= 0 && events[i].at > lastSeen) i--;
      for (let j = i + 1; j < events.length; j++) { const e = events[j]; if (e.what === 'box') { plans.set(e, planHits(e, st)); lastSeen = e.at; } }
      for (let k = events.length - 1; k >= 0; k--) {
        const ev = events[k]; if (ev.at < now - 1.5) break;
        const p = plans.get(ev); if (!p) continue;
        const put = (o) => { if (ev.at > now) { if (ev.at < o.next) o.next = ev.at; } else if (ev.at > o.last) o.last = ev.at; };
        if (p.limb === 'foot') { put(foot); if (p.cymbal) { put(cym); put(hands[1]); } } else put(hands[p.limb === 'L' ? 0 : 1]);
      }
    }
    UPV.setFromMatrixColumn(root.matrixWorld, 1).normalize();
    const k = root.scale.x || 1;
    // how far his right hand has gone over to the cymbal, by the hit it's on or coming to
    const over = Math.max(cym.next - now < STROKE.toCymbal + 0.05 ? 1 - Math.max(0, (cym.next - now - 0.05) / STROKE.toCymbal) : 0, now - cym.last < STROKE.toCymbal ? 1 - (now - cym.last) / STROKE.toCymbal : 0), oe = over * over * (3 - 2 * over);
    for (const h of hands) {
      const hgt = still ? STROKE.ready : strokeHeight(now, h.next, h.last); h.h = hgt;
      WP.copy(h.wp); WQ.copy(h.wq);
      N.copy(UPV);
      T.copy(WP).addScaledVector(N, STROKE.lift[h.S] * hgt * k);
      SX.setFromMatrixColumn(H.props['stick' + h.S].world, 0).normalize();
      AX.crossVectors(SX, N).normalize();
      TQ.setFromAxisAngle(AX, STROKE.turn * hgt * DEG).multiply(WQ);
      // (on a cymbal hit: the stick turned out onto the rim and the hand placed so its tip lands there)
      if (h.S === 'R' && oe > 0) {
        root.getWorldQuaternion(RQ); CD.fromArray(STROKE.cymbalWay).normalize().applyQuaternion(RQ);
        CQ.setFromUnitVectors(SX, CD);
        CO.setFromMatrixPosition(H.props.stickR.world).addScaledVector(SX, DRUMS.stick.long * k).sub(WP).applyQuaternion(CQ);
        CT.fromArray(STRIKE.cymbal).applyMatrix4(root.matrixWorld).addScaledVector(N, STROKE.lift.R * hgt * k).sub(CO);
        T.lerp(CT, oe); TQ.premultiply(CQ2.identity().slerp(CQ, oe));
      }
      solveArm(h.up, h.lo, h.wr, T, { qHand: TQ, weight });
      if (D.log && h.last > h.logged && now - h.last < 0.05) { h.logged = h.last; D.log.push({ side: h.side, at: +h.last.toFixed(3), now: +now.toFixed(3), h: +hgt.toFixed(3) }); }
    }
    H.placeHeld();
    // the foot on the pedal: the foot and the plate tip with the stroke, the beater swings
    D.foot(now, still, weight);
    if (parts) {
      if (cym.last > cymAt) { cymAt = cym.last; cymK = 1; }
      cymK *= Math.exp(-dt / 0.45);
      const t = now - cymAt, a = cymK * 7 * DEG * Math.cos(t * 26);
      parts.cymbal.rotation.set(a, 0, a * 0.5);
    }
  };
  D.foot = (now, still = true, weight = 1) => {
    const fh = still ? STROKE.foot.ready : strokeHeight(now, foot.next, foot.last, STROKE.foot);
    // (the foot is its own bone under the root, and the pedal sits where his clip has it: it only tips, toes down on the note)
    if (B.FootR) { const ax = H.axis('FootR', 'tip'); if (ax) { B.FootR.quaternion.multiply(RQ.setFromAxisAngle(ax, ((fh - 0.5) * 2 * 8 + PLATE_SLOPE) * weight * DEG)); B.FootR.updateWorldMatrix(false, true); } }
    if (parts) {
      parts.beater.rotation.x = -PE.rest * fh * DEG;
      const base = -Math.atan2(PE.toe[1] - PE.heel[1], PE.toe[2] - PE.heel[2]);
      parts.plate.rotation.x = base + PE.tip * (1 - fh) * DEG * 0.8;
    }
  };
  return D;
}
