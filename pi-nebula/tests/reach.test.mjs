// HANDS ON THE WORK, WITHIN REACH (the review, 2026-11-27: the pump's, the scanner's, the furnace console's and the
// cook's holds were out of every arm's reach, the hand stopped short in the air). For each place a hand is sent to, and
// each body that works there, the hold's every point over a long while is within REACH.most of that body's own arm,
// measured from its own shoulder joint as its suit's bones have it (the arm ARM_LENGTH.arm of its length, its size),
// the body leaned as the hold leans it, stood in by the hold's step in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handsAt, WORK, WORK_OF, WORK_AT, SCAN_HOLD, REACH, shoulderAt } from '../src/atwork.js';
import { ROSTER, SCAN_BED } from '../src/life.js';

const ROOT = new URL('..', import.meta.url).pathname;
const ARM = +readFileSync(ROOT + 'kit/crew.js', 'utf8').match(/ARM_LENGTH = \{ arm: ([0-9.]+)/)[1];

// a suit's bones at rest, from its GLB's own nodes (each joint's place in the world of the file: x their left, y up,
// z ahead, from the feet)
function bones(suit) {
  const f = readFileSync(ROOT + `assets/crew/suit_${suit}.glb`), n = f.readUInt32LE(12), j = JSON.parse(f.subarray(20, 20 + n).toString());
  const parent = {}; j.nodes.forEach((d, i) => (d.children || []).forEach((c) => (parent[c] = i)));
  const rot = (q, v) => { const [x, y, z, w] = q, [a, b, c] = v, ix = w * a + y * c - z * b, iy = w * b + z * a - x * c, iz = w * c + x * b - y * a, iw = -x * a - y * b - z * c; return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
  const mul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const world = (i) => { const d = j.nodes[i], t = d.translation || [0, 0, 0], q = d.rotation || [0, 0, 0, 1], s = d.scale || [1, 1, 1]; if (parent[i] == null) return { p: t, q, s }; const P = world(parent[i]), v = rot(P.q, [t[0] * P.s[0], t[1] * P.s[1], t[2] * P.s[2]]); return { p: [P.p[0] + v[0], P.p[1] + v[1], P.p[2] + v[2]], q: mul(P.q, q), s: [P.s[0] * s[0], P.s[1] * s[1], P.s[2] * s[2]] }; };
  const at = (name) => { const i = j.nodes.findIndex((d) => d.name === name); assert.ok(i >= 0, suit + ': ' + name); return world(i).p; };
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const B = { R: at('UpperArm.R'), L: at('UpperArm.L'), ab: at('Abdomen'), ch: at('Chest'), head: at('Head'), knee: at('LowerLeg.R') };
  B.arm = d(B.R, at('LowerArm.R')) + d(at('LowerArm.R'), at('Wrist.R'));
  return B;
}
// each body that works at a place: its suit and size, from the roster (a named look's suit is its own name)
const who = (id) => { const R = ROSTER.find((q) => q.id === id); const L = typeof R.look === 'string' ? { suit: R.look } : R.look; return { id, suit: L.suit, size: L.size || 1 }; };
const AT = (place) => ROSTER.filter((R) => R.day.some((s) => s.do === 'stand:' + place || s.do === 'post:' + place)).map((R) => who(R.id));

// whether every point of a hold over `secs` of its moves is within reach: S the hold as workOf gives it, with the
// person at the origin facing +z (heading 0); hands found ahead of where they stand, less the step in
function worst(body, S, secs = 120) {
  const B = bones(body.suit), k = body.size, sc = (p) => p.map((v) => v * k);
  let most = 0;
  for (let t = 0; t < secs; t += 0.05) {
    const H = handsAt(S.kind, S, t, 3.7);
    H.hands.forEach((h, i) => {
      if (!h || (H.share && H.share[i] < 0.5)) return;
      const sh = shoulderAt(sc(i === 0 ? B.L : B.R), sc(B.ab), sc(B.ch), H.lean), q = [h[0], h[1], h[2] - (S.stepIn || 0)];
      most = Math.max(most, Math.hypot(q[0] - sh[0], q[1] - sh[1], q[2] - sh[2]) / (B.arm * ARM * k));
    });
  }
  return most;
}
const ahead = (d, y, o = {}) => ({ at: [0, y, d], heading: 0, ...o });

test('the bodies that work at each place are the ones the roster sends there', () => {
  assert.deepEqual(AT('pump').map((b) => b.id), ['mechanic']);
  assert.deepEqual(AT('cook').map((b) => b.id), ['cook']);
  assert.deepEqual(AT('forge').map((b) => b.id), ['smelter']);
});

test('the pump: each point of its screen within reach of the mechanic, the elbow bent', () => {
  // (no point under the screen: a stoop to the buttons put his knees and head in the cabinet)
  assert.ok(WORK_AT.pump.points.every((p) => p[1] >= 1.0), 'only the screen');
  assert.equal(WORK_AT.lockers, undefined, 'the lockers: the reach clip, as the game has them');
  for (const b of AT('pump')) { const F = WORK_AT.pump, k = worst(b, { kind: 'face', at: [0, 0, F.face], heading: 0, points: F.points, stepIn: F.stepIn }); assert.ok(k <= REACH.most, `${b.id}: ${k.toFixed(3)} of the arm`); }
});
test('the cook\'s counter (its near edge 0.43 m ahead, its top 0.94 m up, as the walls find it): his wipe within reach', () => {
  // (nearly upright, his head clear of the heat lamp: so the arms come down to the counter nearly straight, as one
  // wipes a counter standing: within the arm, not within REACH.most's bent elbow)
  for (const b of AT('cook')) { const k = worst(b, ahead(0.43, 0.94, WORK_OF.Bar_Polish)); assert.ok(k <= 1, `${b.id}: ${k.toFixed(3)} of the arm`); }
});
test('the furnace\'s console: both hands within reach of its worker', () => {
  const W = WORK_OF.Tend_Forge;
  for (const b of AT('forge')) { const k = worst(b, ahead(W.edge[0], W.edge[1], W)); assert.ok(k <= REACH.most, `${b.id}: ${k.toFixed(3)} of the arm`); }
});
test('the medic at the scanner: both hands on the board\'s end within reach', () => {
  // (her spot, life.js scanScreen, 4.42 along the bed from its head; the panel point SCAN_BED.panel)
  const d = 4.42 - SCAN_BED.panel[2] - SCAN_HOLD.back, y = SCAN_BED.panel[1] + SCAN_HOLD.up;
  for (const b of [who('medic')]) { const k = worst(b, ahead(d, y, { kind: 'panel', ...SCAN_HOLD })); assert.ok(k <= REACH.most, `${b.id}: ${k.toFixed(3)} of the arm`); }
});
test('the reach rule itself: a point at the shoulder\'s own height an arm ahead is out, one under it in', () => {
  const B = bones('crew1'), sh = B.R, arm = B.arm * ARM;
  const at = (q) => Math.hypot(q[0] - sh[0], q[1] - sh[1], q[2] - sh[2]) / arm;
  assert.ok(at([sh[0], sh[1], sh[2] + arm * 1.02]) > REACH.most);
  assert.ok(at([sh[0], sh[1] - arm * 0.6, sh[2] + arm * 0.3]) < REACH.most);
  // (leaning forward carries the shoulder forward)
  const s2 = shoulderAt(sh, B.ab, B.ch, 0.5);
  assert.ok(s2[2] > sh[2] + 0.05);
});

test('the pump: his head and his knees stay out of its cabinet through every visit (the review, W1 and W10)', () => {
  // (no stoop any more: the knees stay under him; the head, bowed as the hold bows him, stays behind the cabinet's
  // face, 0.45 m ahead of his spot less the step in, by more than a head's front)
  assert.equal(WORK.face.crouch, undefined, 'no stoop');
  const F = WORK_AT.pump, face = F.face - F.stepIn;
  for (const b of AT('pump')) {
    const B = bones(b.suit), k = b.size, sc = (p) => p.map((v) => v * k);
    for (let t = 0; t < 60; t += 0.05) {
      const H = handsAt('face', { kind: 'face', at: [0, 0, F.face], heading: 0, points: F.points }, t, 3.7);
      const head = shoulderAt(sc(B.head), sc(B.ab), sc(B.ch), H.lean);
      assert.ok(head[2] + 0.12 < face, `${b.id}: the head ${head[2].toFixed(3)} m ahead, the face ${face.toFixed(2)}`);
      assert.ok(sc(B.knee)[2] + 0.08 < face, 'the knees');
    }
  }
});

test('the cook\'s head stays clear of the heat lamp\'s canopy over his counter (two critics, r3)', () => {
  // (kit/furniture.js counter 'serve': the canopy at 1.5 m up from z -0.26 of the counter's middle; his spot at z
  // -0.85 facing it, life.js SPOTS.cook: so 0.59 m ahead of his spot, less the step in, a head's front 0.1 m ahead of its joint)
  const W = WORK_OF.Bar_Polish, lamp = 0.59 - W.stepIn;
  for (const b of AT('cook')) {
    const B = bones(b.suit), k = b.size, sc = (p) => p.map((v) => v * k);
    const head = shoulderAt(sc(B.head), sc(B.ab), sc(B.ch), WORK.wipe.lean);
    assert.ok(head[1] + 0.12 < 1.5 || head[2] + 0.1 < lamp, `the head at ${head[2].toFixed(3)} m ahead, ${head[1].toFixed(2)} up; the canopy from ${lamp.toFixed(2)} ahead`);
  }
});
