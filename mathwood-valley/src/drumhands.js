// THE DRUMMER'S STICKS IN STEP WITH THE MUSIC: the stage music's own box hits (M.events: { at, what: 'box', hit, vel }, baked
// or live the same): thump on the bass drum (his right), slap and tap on the snare (his left). The set pose in
// models/people/hands.json (the Hands Lab's) is the stick on the skin; each frame, after H.after(), this takes the hand back and
// turns the wrist off it by how far the stroke has got (src/drumplan.js strokeHeight), the arm following by two-bone IK. Every
// bone turned here is one H.before() puts back, so nothing piles up. Far off or on the lowest tier: held still at the ready.
//   const D = makeDrumHands(person, H); D.update(now, events, weight);  D.log: an array to fill (rigs)
import * as THREE from 'three';
import { solveArm } from './handpose.js';
import { handOf, strokeHeight, STROKE, DRUMS } from './drumplan.js';

const DEG = Math.PI / 180;
const FACE = new THREE.Vector3(...DRUMS.bass.face).normalize(), SX = new THREE.Vector3(), N = new THREE.Vector3(), RQ = new THREE.Quaternion();
const WP = new THREE.Vector3(), WQ = new THREE.Quaternion(), SC = new THREE.Vector3(), UPV = new THREE.Vector3(), TQ = new THREE.Quaternion(), T = new THREE.Vector3(), AX = new THREE.Vector3();

export function makeDrumHands(person, H) {
  const B = person.bones, root = person.root, D = { log: null };
  const hands = ['L', 'R'].map((S, side) => ({ S, side, up: B['UpperArm' + S], lo: B['LowerArm' + S], wr: B['Wrist' + S], last: -1e9, next: 1e9, logged: -1, h: STROKE.ready, wp: new THREE.Vector3(), wq: new THREE.Quaternion() }));
  // his head's nod at half what the clip has: each frame the spine's bones up to the head half way back to the clip's average way (the world's nod is theirs added up; the hands stay where the pose has them)
  // (the clip's nod read more than his sticks did). H.before() puts them back, so this doesn't pile up.
  const clip = person.person.actions.Play_Box && person.person.actions.Play_Box.getClip();
  const calm = ['Abdomen', 'Torso', 'Chest', 'Neck', 'Head'].map((n) => { const b = B[n], tr = clip && clip.tracks.find((t) => t.name === n + '.quaternion'); if (!b || !tr) return null;
    const v = tr.values, q = new THREE.Quaternion(), mean = new THREE.Quaternion(v[0], v[1], v[2], v[3]);
    for (let i = 4, k = 1; i < v.length; i += 4, k++) { q.set(v[i], v[i + 1], v[i + 2], v[i + 3]); if (q.dot(mean) < 0) q.set(-q.x, -q.y, -q.z, -q.w); mean.slerp(q, 1 / (k + 1)); }
    return { b, mean }; }).filter(Boolean);
  D.update = (now, events, weight, still = false) => {
    if (weight <= 0.002) return;
    for (const h of hands) { h.wr.matrixWorld.decompose(WP, WQ, SC); h.wp.copy(WP); h.wq.copy(WQ); }
    if (calm.length) { for (const c of calm) c.b.quaternion.slerp(c.mean, STROKE.calmHead * weight); calm[0].b.updateWorldMatrix(false, true); }
    for (const h of hands) { h.next = 1e9; h.last = -1e9; }
    if (events && !still) for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i]; if (ev.at < now - 1.5) break;
      if (ev.what !== 'box') continue;
      const h = hands[handOf(ev.hit)];
      if (ev.at > now) { if (ev.at < h.next) h.next = ev.at; } else if (ev.at > h.last) h.last = ev.at;
    }
    UPV.setFromMatrixColumn(root.matrixWorld, 1).normalize();
    const k = root.scale.x || 1;
    for (const h of hands) {
      const hgt = still ? STROKE.ready : strokeHeight(now, h.next, h.last); h.h = hgt;
      WP.copy(h.wp); WQ.copy(h.wq);
      // (off the skin: the snare's looks up, the bass drum's stands on its rim and looks at him, so that stick comes back toward him, not up along it)
      if (h.S === 'R') N.copy(FACE).applyQuaternion(root.getWorldQuaternion(RQ)); else N.copy(UPV);
      T.copy(WP).addScaledVector(N, STROKE.lift[h.S] * hgt * k);
            SX.setFromMatrixColumn(H.props['stick' + h.S].world, 0).normalize();
      AX.crossVectors(SX, N).normalize();
      TQ.setFromAxisAngle(AX, STROKE.turn * hgt * DEG).multiply(WQ);
      solveArm(h.up, h.lo, h.wr, T, { qHand: TQ, weight });
      if (D.log && h.last > h.logged && now - h.last < 0.05) { h.logged = h.last; D.log.push({ side: h.side, at: +h.last.toFixed(3), now: +now.toFixed(3), h: +hgt.toFixed(3) }); }
    }
    H.placeHeld();
  };
  return D;
}
