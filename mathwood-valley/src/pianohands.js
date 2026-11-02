// THE PIANIST'S HANDS ON THE KEYS: the stage music's own notes (M.events: { at, what: 'piano', midi, len }, baked or live
// the same) say which keys, src/pianoplan.js where those keys are on the model. Laid over the clip and the set pose
// (src/handpose.js), after H.after(): each hand's wrist travels along the keys ahead of its next note, the arm following
// (two-bone IK, the elbow keeping the plane the pose gave it), the hand staying level; the finger nearest each key dips.
// Left hand the low notes, right the high. Every bone turned here is one H.before() puts back, so nothing piles up.
//   const K = makePianoHands(person, H)
//   K.update(now, dt, events, weight)   now: the clock the events' `at` are on; weight 0..1: how much of this to show (the
//                                       clip's weight, 0 when far off or on the lowest tier: then the set pose alone)
//   K.log: an array to fill (rigs): one { midi, side, finger, miss (cm along the keys), at } a note, as it lands
import * as THREE from 'three';
import { solveArm } from './handpose.js';
import { KEYBOARD, keyX, keyWidth, isBlack, handOf, fitFingers } from './pianoplan.js';

const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
export const PIANO_HANDS = {
  lead: 0.5,        // s before its next note that a hand may set off for it
  dip: 0.016,       // m a finger's tip goes down on a note
  down: 0.018, up: 0.05,   // s: how fast a finger goes down and comes up
  early: 0.035,     // s before the note that the finger starts down (so the tip is on the key as it sounds)
  most: 35, side: 25,      // degrees: the most a finger's dip and its stretch sideways may turn
  span: 13,         // semitones one hand takes at once
  yaw: 0.5,         // how much of the forearm's swing the hand takes (the rest the wrist's bend)
  leave: 0.05,      // m a held key may be from its finger's tip
  idle: 1.6,        // s with no notes coming before the hands drift home
};
const P = PIANO_HANDS, DEG = Math.PI / 180;
const v = () => new THREE.Vector3(), q = () => new THREE.Quaternion();
const a = v(), b = v(), c = v(), s = v(), w = v(), t = v(), n = v(), f0 = v(), f1 = v(), o = v();
const qa = q(), m = new THREE.Matrix4();
const rot = (mat, out) => { mat.decompose(o, out, a); return out; };

export function makePianoHands(person, H) {
  const B = person.bones, root = person.root, inv = new THREE.Matrix4(), rx = v(), ry = v();
  const K = { log: null }, turn = { curl: 0, side: 0 };
  const hands = ['L', 'R'].map((S, side) => ({
    S, side, up: B['UpperArm' + S], lo: B['LowerArm' + S], wr: B['Wrist' + S],
    fingers: FINGERS.map((F) => {
      const thumb = F === 'Thumb';
      return { F, base: B[F + (thumb ? 1 : 2) + S], mid: B[F + (thumb ? 2 : 3) + S], last: B[F + (thumb ? 3 : 4) + S], prev: B[F + (thumb ? 2 : 3) + S], thumb, env: 0, until: -1, at: 0, key: 0, midi: 0, on: false, logged: false };
    }),
    tips: [0, 0, 0, 0, 0], hx: null, go: null, goAt: -1, goT: 0, group: [], lastNote: -1e9, fit: null,
  }));
  // the dip you can see on the keys: a shadow laid over each key held (the keyboard is one drawn box, no keys to move)
  const maxDips = 10, shade = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }), maxDips);
  shade.frustumCulled = false; shade.count = 0; shade.visible = false; shade.renderOrder = 2; shade.name = 'piano keys held'; root.add(shade);
  const tip = (fg, out) => { f0.setFromMatrixPosition(fg.prev.matrixWorld); f1.setFromMatrixPosition(fg.last.matrixWorld); return out.subVectors(f1, f0).add(f1); };
  const local = (p, out) => out.copy(p).applyMatrix4(inv);

  // a finger's next dip and reach sideways, from how much a turn of each of its two base joints moves its tip, as it stands
  // (no fixed axes): the two turns that together put the tip over the key's middle, `dip` below where it rests on the key
  // (measured from the key's top, not from the tip: a stretched hand's tip starts lower, and mustn't go on through the key)
  function fingerTurn(fg, dip, out) {
    tip(fg, t);
    const bone = fg.base; f0.setFromMatrixPosition(bone.matrixWorld); n.subVectors(t, f0);
    rot(bone.matrixWorld, qa);
    a.copy(H.axis(bone.name, 'curl')).applyQuaternion(qa); b.crossVectors(a, n); const cx = b.dot(rx), cy = b.dot(ry);
    a.copy(H.axis(bone.name, fg.thumb ? 'out' : 'spread')).applyQuaternion(qa); b.crossVectors(a, n); const sx = b.dot(rx), sy = b.dot(ry);
    local(t, c);
    const ex = fg.key - c.x, ey = KEYBOARD.top + 0.006 - dip - c.y, det = cx * sy - sx * cy;
    if (Math.abs(det) < 2e-4) { out.curl = 0; out.side = 0; return out; }
    out.curl = Math.max(-P.most, Math.min(P.most, (ex * sy - sx * ey) / det / DEG));
    out.side = Math.max(-P.side, Math.min(P.side, (cx * ey - ex * cy) / det / DEG));
    return out;
  }

  K.update = (now, dt, events, weight) => {
    shade.visible = false;
    if (weight <= 0.002) { for (const h of hands) { h.hx = null; h.goAt = -1; for (const fg of h.fingers) { fg.env = 0; fg.on = false; } } return; }
    // his frame, as the root stands
    inv.copy(root.matrixWorld).invert();
    rx.setFromMatrixColumn(root.matrixWorld, 0).normalize(); ry.setFromMatrixColumn(root.matrixWorld, 1).normalize();
    // the next notes of each hand: read from the list's end (only the last few seconds of it matter)
    for (const h of hands) { h.nextAt = Infinity; h.group.length = 0; }
    if (events) {
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i]; if (ev.at < now - 0.02) break;
        if (ev.what !== 'piano') continue;
        const list = Array.isArray(ev.midi) ? ev.midi : [ev.midi];
        for (const h of hands) {
          for (const mi of list) {
            if (handOf(mi) !== h.side) continue;
            if (ev.at < h.nextAt - 0.008) { h.nextAt = ev.at; h.group.length = 0; }
            if (Math.abs(ev.at - h.nextAt) < 0.008) h.group.push({ midi: mi, len: ev.len });
          }
        }
      }
      // more than a hand can span: the left takes the right's low notes, if it has nothing sooner
      const [L, R] = hands;
      if (R.group.length > 1 && L.nextAt > R.nextAt - 0.008) {
        let top = 0; for (const x of R.group) if (x.midi > top) top = x.midi;
        const low = R.group.filter((x) => x.midi < top - P.span);
        if (low.length) {
          if (L.nextAt > R.nextAt + 0.008) L.group.length = 0;
          L.nextAt = R.nextAt; L.group.push(...low); R.group = R.group.filter((x) => x.midi >= top - P.span);
        }
      }
    }
    for (const h of hands) {
      local(s.setFromMatrixPosition(h.wr.matrixWorld), w);
      const wx = w.x, wy = w.y, wz = w.z;
      if (h.hx == null) { h.hx = wx; h.home = wx; }
      h.home = wx;
      for (let f = 0; f < 5; f++) { local(tip(h.fingers[f], t), c); h.tips[f] = c.x - wx; }
      // a new group ahead: which fingers, and where the wrist goes for them
      if (h.nextAt < Infinity && h.nextAt !== h.goAt) {
        const keys = h.group.map((x) => keyX(x.midi));
        h.fit = fitFingers(keys, h.hx, h.tips);
        h.goAt = h.nextAt; h.goT = h.fit.hx;
        h.pending = h.group.map((x, i) => ({ midi: x.midi, len: x.len, key: keys[i], finger: h.fit.fingers[i] })).filter((x) => x.finger >= 0);
        h.fired = false; h.trim = 0;
      }
      // set off for it in time; with nothing coming, home
      const ahead = h.goAt > 0 ? h.goAt - now : Infinity, coming = h.nextAt < Infinity && ahead < P.lead;
      // (a hand setting off lets go of what it was holding: no finger left stretched back to its old key)
      if (coming && Math.abs(h.goT + h.trim - h.hx) > keyWidth()) for (const fg of h.fingers) if (fg.until > now) fg.until = now;
      const holding = h.fingers.some((fg) => fg.until > now);
      if (coming || (h.nextAt < Infinity && !holding)) {
        const tau = Math.max(0.02, Math.min(0.09, ahead / 3));
        h.hx += (h.goT + h.trim - h.hx) * (1 - Math.exp(-dt / tau));
      } else if (!holding && now - h.lastNote > P.idle) h.hx += (h.home - h.hx) * (1 - Math.exp(-dt / 0.5));
      // the fingers go down
      if (h.pending && !h.fired && now >= h.goAt - P.early) {
        for (const x of h.pending) { const fg = h.fingers[x.finger]; fg.until = h.goAt + Math.max(0.1, x.len * 0.9); fg.key = x.key; fg.midi = x.midi; fg.at = h.goAt; fg.logged = false; }
        h.fired = true; h.lastNote = h.goAt;
      }

      // the arm follows, the hand staying level but for part of the forearm's swing
      solveArm(h.up, h.lo, h.wr, t.set(h.hx, wy, wz).applyMatrix4(root.matrixWorld), { yaw: P.yaw, weight });
      // (the hand turned a little with the arm, so its fingers aren't quite where the plan had them: the miss goes on the plan)
      if (coming && h.pending && h.pending.length) {
        let miss = 0; for (const x of h.pending) { local(tip(h.fingers[x.finger], t), c); miss += x.key - c.x; }
        h.trim = Math.max(-0.05, Math.min(0.05, h.trim + (miss / h.pending.length) * Math.min(1, dt * 12)));
      }
    }

    // ── the fingers ──────────────────────────────────────────────────────────────────────────────────────────────────
    let dips = 0;
    for (const h of hands) for (const fg of h.fingers) {
      const down = fg.until > now;
      fg.down = down;
      fg.env += ((down ? 1 : 0) - fg.env) * (1 - Math.exp(-dt / (down ? P.down : P.up)));
      if (fg.env < 0.01) continue;
      fingerTurn(fg, P.dip * fg.env, turn);
      // (a finger left too far from its key lifts off it, as a hand that's moved on does, rather than stay lit from across the keys)
      if (down && Math.abs(fg.key - c.x) > P.leave) { fg.until = now; fg.down = false; continue; }
      const bone = fg.base, k = Math.min(1, fg.env * 3) * weight;
      bone.quaternion.multiply(qa.setFromAxisAngle(H.axis(bone.name, 'curl'), turn.curl * k * DEG));
      bone.quaternion.multiply(qa.setFromAxisAngle(H.axis(bone.name, fg.thumb ? 'out' : 'spread'), turn.side * k * DEG));
      if (K.log && down && !fg.logged && now >= fg.at) { fg.logged = true; bone.updateWorldMatrix(false, true); local(tip(fg, t), c); K.log.push({ midi: fg.midi, side: h.side, finger: fg.F, at: +fg.at.toFixed(3), err: +((fg.key - c.x) * 100).toFixed(2), y: +(c.y - KEYBOARD.top).toFixed(3) }); }
      if (dips < maxDips && down) {
        const bl = isBlack(fg.midi);
        m.makeScale(bl ? keyWidth() * 0.62 : keyWidth() * 0.95, 1, bl ? KEYBOARD.depth * 0.6 : KEYBOARD.depth);
        m.setPosition(fg.key, KEYBOARD.top + 0.002, KEYBOARD.front + (bl ? KEYBOARD.depth * 0.7 : KEYBOARD.depth * 0.5));
        shade.setMatrixAt(dips++, m);
      }
    }
    shade.count = dips; shade.visible = dips > 0; shade.instanceMatrix.needsUpdate = dips > 0;
  };
  // (rigs) each finger down now: its key's x against its tip's, and how low the tip is against the key tops
  K.held = () => { const o = []; inv.copy(root.matrixWorld).invert(); for (const h of hands) for (const fg of h.fingers) if (fg.down) { local(tip(fg, t), c); o.push({ midi: fg.midi, f: fg.F, gap: fg.key - c.x, y: c.y - KEYBOARD.top, z: c.z - KEYBOARD.front }); } return o; };
  K.dispose = () => { shade.removeFromParent(); shade.geometry.dispose(); shade.material.dispose(); shade.dispose(); };
  return K;
}
