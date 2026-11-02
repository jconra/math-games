// THE FRET HAND GOES WHERE THE SONG'S NOTES ARE, and the bass player's fingers pluck them. Each note of the part (M.events) gets a
// string and a stop from its pitch (src/fretplan.js planNote, the instrument's own tuning); the hand slides along the neck to that
// position (its pin on the instrument moved: src/handpose.js H.pinShift, set before H.after), the one finger that stops the note
// reaches for that exact spot on that string (after H.after, on bones H.before() puts back, so nothing piles up).
// Far off or on the lowest tier: nothing moves, the hand at its set place.
//   const F = makeFretHands(person, H, kind);  kind: 'bass', 'fiddle', 'banjo'
//   F.before(now, dt, events, weight)   before H.after: where the hand goes
//   F.after(now, dt)                    after H.after (and the play layer): the fingers
//   F.now                               { pos, string, fret, finger, open, midi } the note it's on (rigs and the lab); F.log: an array to fill
import * as THREE from 'three';
import { planNote, fretDistance, FRETTED } from './fretplan.js';
import { bassNote, stopX, stringAt as bassString, PLUCK } from './bassplan.js';
import { FIDDLE, stringAt as fiddleString } from './fiddleplan.js';
import { BANJO, fret as banjoFret } from './banjoplan.js';

const v = () => new THREE.Vector3();
const TIP = v(), BASE = v(), TO = v(), W = v(), LA = v(), LB = v(), QI = new THREE.Quaternion(), QT = new THREE.Quaternion(), M0 = new THREE.Matrix4();
// strings per kind, in the instrument's frame
const BANJO_Z = [-0.0075, -0.0025, 0.0025, 0.0075];
const NECKS = {
  bass: { note: bassNote, prop: 'bass', side: 'L', clip: 'Play_Bass', stop: stopX, point: (k, x) => bassString(k, x), to: -0.012, slide: 0.085, across: 0, lean: 0.75 },
  fiddle: { note: (e) => (e.what === 'fiddle' ? Math.min(...[].concat(e.midi)) : null), prop: 'fiddle', side: 'L', clip: 'Play_Fiddle', stop: (n) => FIDDLE.nut - fretDistance(n, 0.325), point: (k, x) => fiddleString(k, x), to: -0.004, slide: 0.06, across: 0 },
  banjo: { note: (e) => (e.what === 'banjo' && !e.strum ? Math.min(...[].concat(e.midi)) : null), prop: 'banjo', side: 'L', clip: 'Play_Banjo', stop: banjoFret, point: (k, x) => [x, 0.017, BANJO_Z[k]], to: -0.005, slide: 0.06, across: 0 },
};
const tipOf = (B3, B4, out) => { B3.getWorldPosition(LA); B4.getWorldPosition(LB); return out.copy(LB).sub(LA).multiplyScalar(0.8).add(LB); };
// a hinge's turn that brings the tip nearest the target
function hinge(b, axis, tip, target, most) {
  b.getWorldPosition(BASE); b.getWorldQuaternion(QI).invert();
  LA.copy(tip).sub(BASE).applyQuaternion(QI); LB.copy(target).sub(BASE).applyQuaternion(QI);
  LA.addScaledVector(axis, -LA.dot(axis)); LB.addScaledVector(axis, -LB.dot(axis));
  if (LA.lengthSq() < 1e-9 || LB.lengthSq() < 1e-9) return;
  const a = Math.atan2(TO.crossVectors(LA, LB).dot(axis), LA.dot(LB));
  b.quaternion.multiply(QT.setFromAxisAngle(axis, Math.max(-most, Math.min(most, a))));
  b.updateWorldMatrix(false, true);
}
// a finger's tip to a world point: its base swings and spreads, its knuckles curl (a few rounds of the three hinges)
export function aimFinger(H, B, f, s, target, weight = 1) {
  const b2 = B[f + '2' + s], b3 = B[f + '3' + s], b4 = B[f + '4' + s]; if (!b2 || !b3 || !b4) return Infinity;
  const q2 = b2.quaternion.clone(), q3 = b3.quaternion.clone(), q4 = b4.quaternion.clone();
  const c2 = H.axis(f + '2' + s, 'curl'), sp = H.axis(f + '2' + s, 'spread'), c3 = H.axis(f + '3' + s, 'curl'), c4 = H.axis(f + '4' + s, 'curl');
  const most = 0.6;
  for (let i = 0; i < 3; i++) {
    hinge(b4, c4, tipOf(b3, b4, TIP), target, most * 0.6);
    hinge(b3, c3, tipOf(b3, b4, TIP), target, most);
    hinge(b2, c2, tipOf(b3, b4, TIP), target, most);
    hinge(b2, sp, tipOf(b3, b4, TIP), target, 0.15);
  }
  const miss = tipOf(b3, b4, TIP).distanceTo(target);
  if (weight < 0.999) { b2.quaternion.slerp(q2, 1 - weight); b3.quaternion.slerp(q3, 1 - weight); b4.quaternion.slerp(q4, 1 - weight); b2.updateWorldMatrix(false, true); }
  return miss;
}
export function makeFretHands(person, H, kind) {
  const N = NECKS[kind], I = FRETTED[kind], B = person.bones, plans = new WeakMap();
  let pos = I.home, lastAt = -1e9, x = null, home = null, wNow = 0, ws = 0, cur = null, next = null;
  const F = { now: null, log: null, miss: 0 };
  const inProp = (world, out) => out.copy(world).applyMatrix4(M0.copy(H.propWorld(N.prop)).invert());
  F.planOf = (ev) => plans.get(ev);
  F.before = (now, dt, events, weight) => {
    wNow = weight;
    cur = next = null;
    if (events && weight > 0.01) {
      // (each new note planned, in order: a position leads on from the one before)
      let i = events.length - 1;
      while (i >= 0 && events[i].at > lastAt) i--;
      for (let j = i + 1; j < events.length; j++) {
        const e = events[j], midi = N.note(e); if (midi == null || e.at - lastAt < 0.02) continue;   // (one note a moment; of a chord its lowest)
        const p = planNote(midi, pos, kind); p.midi = midi; plans.set(e, p); pos = p.pos; lastAt = e.at;
      }
      for (let k = events.length - 1; k >= 0; k--) {
        const e = events[k]; if (e.at < now - 2.5) break; const p = plans.get(e); if (!p) continue;
        if (e.at > now) next = e; else { cur = e; break; }
      }
    }
    if (home == null) return;
    const lead = next && next.at - now < 0.15 ? next : null, on = lead || (cur && now - cur.at < 2.2 ? cur : null);
    // (lean: a hand that can't span the stops on this long a neck pivots toward the one it's stopping, as a bassist does)
    const pl = on && plans.get(on), want = pl ? N.stop(pl.pos) + (pl.open || !N.lean ? 0 : (N.stop(pl.fret) - N.stop(pl.pos)) * N.lean) : home;
    if (x == null) x = home;
    x += (want - x) * (1 - Math.exp(-dt / N.slide));
    const sh = H.pinShift[N.side] || (H.pinShift[N.side] = [0, 0, 0]);
    ws += ((weight > 0.99 ? 1 : 0) - ws) * (1 - Math.exp(-dt / 0.08));
    sh[0] = (x - home) * ws;
  };
  F.after = (now) => {
    // (where the set pose has the first finger: the hand's place on the neck, read once)
    if (home == null) { if (wNow > 0.99) { home = inProp(B['Index3' + N.side].getWorldPosition(W), W).x; x = home; } return; }
    F.now = cur ? plans.get(cur) : null;
    if (wNow < 0.9) return;
    const c = cur && now - cur.at < Math.max(0.2, cur.len || 0.4) ? cur : null, go = next && next.at - now < 0.07 ? next : null, e = go || c; if (!e) return;
    const p = plans.get(e); if (p.open) return;
    const pt = N.point(p.string, N.stop(p.fret) + N.to);
    TO.set(pt[0], pt[1], pt[2]).applyMatrix4(H.propWorld(N.prop));
    W.copy(TO);
    F.miss = aimFinger(H, B, p.finger, N.side, W, 1);
    if (F.log) F.log.push({ at: e.at, now, string: p.string, fret: p.fret, pos: p.pos, finger: p.finger, miss: +F.miss.toFixed(4) });
  };
  return F;
}
// THE BASS PLAYER'S RIGHT HAND: index and middle take turns, one a note, on that note's string: the finger comes to rest on the string a
// moment before, pulls it across toward him at the note, lets go and comes back. The hand itself drifts over to that string.
export function makeBassPluck(person, H, fret) {
  const B = person.bones, S = 'R', fingers = ['Index', 'Middle'], who = new WeakMap(); let turn = 0, zs = 0, lastAt = -1e9, wNow = 0;
  const P = { log: null };
  const list = [];
  P.before = (now, dt, events, weight) => {
    wNow = weight; list.length = 0; if (!events || weight <= 0.01) return;
    let i = events.length - 1;
    while (i >= 0 && events[i].at > lastAt) i--;
    for (let j = i + 1; j < events.length; j++) { const e = events[j]; if (!fret.planOf(e)) continue; who.set(e, fingers[turn++ % 2]); lastAt = e.at; }
    for (let k = events.length - 1; k >= 0; k--) { const e = events[k]; if (e.at < now - 0.5) break; if (fret.planOf(e) && e.at < now + 0.2) list.push(e); }
    const near = list.length ? list[list[0].at > now && list.length > 1 && list[0].at - now > 0.12 ? 1 : 0] : null, p = near && fret.planOf(near);
    if (p) { const z = bassString(p.string, PLUCK)[2]; zs += (z - zs) * (1 - Math.exp(-dt / 0.05)); }
    const sh = H.pinShift[S] || (H.pinShift[S] = [0, 0, 0]); sh[2] = zs * Math.min(1, weight);
  };
  P.after = (now) => {
    if (wNow < 0.9) return;
    const done = {};
    for (const e of list) {
      const f = who.get(e), p = fret.planOf(e); if (!f || !p || done[f]) continue;
      const t = now - e.at; let pull = null, w = 0;
      if (t < 0 && t > -0.16) { pull = 0; w = 1 + t / 0.16; }
      else if (t >= 0 && t < 0.07) { pull = t / 0.07; w = 1; }
      else if (t >= 0.07 && t < 0.3) { pull = 1; w = 1 - (t - 0.07) / 0.23; }
      if (pull == null) continue; done[f] = true;
      const pt = bassString(p.string, PLUCK);
      TO.set(pt[0] + (f === 'Index' ? 0.01 : -0.012), pt[1] + 0.002 + pull * 0.012, pt[2] - pull * 0.016).applyMatrix4(H.propWorld('bass'));
      W.copy(TO); const miss = aimFinger(H, B, f, S, W, w);
      if (P.log && t >= 0 && t < 0.03) P.log.push({ at: e.at, finger: f, string: p.string, miss: +miss.toFixed(4) });
    }
  };
  return P;
}
