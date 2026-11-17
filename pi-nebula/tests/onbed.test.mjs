// Getting on and off the big scanner's bed (src/onbed.js), every thirtieth of a second of every move, for a person of
// the patients' two builds (their thigh, shin, hips and standing height, as the game measures Tam and Oso): the legs
// worked out the way the game bends them (two bones, the knee toward the move's pole) and held against the bed's own
// boxes (kit/bigscanner.js: the board, the pad, the head rest, the keel). The game's maker (2026-11-17): "This is not
// how human legs bend". node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { MOVES_ON, MOVES_OFF, KNEE_MIN, pose, twoBone, inside, footWay } from '../src/onbed.js';
import { SCAN_BED } from '../src/life.js';

const BED = { top: SCAN_BED.top, edge: SCAN_BED.edge, pad: SCAN_BED.pad, z: SCAN_BED.z, stand: SCAN_BED.stand, hipUp: SCAN_BED.hipUp, rest: SCAN_BED.rest };
const WHO = { tam: { a: 0.412, b: 0.469, w: 0.121, hs: 0.87 }, oso: { a: 0.429, b: 0.506, w: 0.125, hs: 0.92 } };
const BOXES = [
  { n: 'board', min: [-0.3, 0.77, 0.1], max: [0.3, 0.85, 4.02] },
  { n: 'pad', min: [-0.26, 0.85, 0.4], max: [0.26, 0.915, 3.96] },
  { n: 'head rest', min: [-0.19, 0.9, 1.12], max: [0.19, 0.95, 1.44] },
  { n: 'keel', min: [-0.16, 0.68, 0.03], max: [0.16, 0.77, 3.4] },
];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]], add = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k, p[2] + q[2] * k];
const len = (p) => Math.hypot(p[0], p[1], p[2]);
// (how far a segment is from a box: minus, how deep inside it its deepest point is)
function segBox(p, q, B) {
  let best = Infinity;
  for (let i = 0; i <= 40; i++) {
    const x = add(p, sub(q, p), i / 40);
    const d = [0, 1, 2].map((k) => Math.max(B.min[k] - x[k], 0, x[k] - B.max[k])), out = Math.hypot(...d);
    best = Math.min(best, out > 0 ? out : -Math.min(...[0, 1, 2].map((k) => Math.min(x[k] - B.min[k], B.max[k] - x[k]))));
  }
  return best;
}
const leftOf = (h) => [Math.cos(h), 0, -Math.sin(h)], ahead = (h) => [Math.sin(h), 0, Math.cos(h)];
// a frame's legs: each hip, knee and foot; the deepest any part of either leg is in the bed (the thigh 7.5 cm round,
// the shin to the ankle 5 cm round, the foot as its heel, toes, ankle and instep)
function legs(move, t, who) {
  const P = pose(move, t, BED, who), L = leftOf(P.heading), out = [];
  for (const [i, s] of [[0, 1], [1, -1]]) {
    const hip = add(P.hips, L, s * who.w), ik = twoBone(hip, P.feet[i], P.pole, who.a, who.b), knee = ik.mid, foot = ik.end;
    const sd = sub(foot, knee), sl = len(sd), ankle = add(knee, sd, (sl - 0.08) / sl);
    const fw = footWay(sd, P.pole, ahead(P.heading), P.flat);
    const toe = add(foot, fw.toe, 0.2), heel = add(foot, fw.toe, -0.04), top = add(foot, fw.up, 0.09), instep = add(toe, fw.up, 0.045);
    let deep = 0, what = '';
    for (const B of BOXES) {
      const d = [[-(segBox(hip, knee, B) - 0.075), 'thigh'], [-(segBox(knee, ankle, B) - 0.05), 'shin'],
        [-(Math.min(segBox(heel, toe, B), segBox(top, instep, B), segBox(heel, top, B), segBox(toe, instep, B)) - 0.012), 'foot']];
      for (const [v, n] of d) if (v > deep) { deep = v; what = n + ' in the ' + B.n; }
    }
    out.push({ hip, knee, foot, angle: inside(hip, knee, foot), deep, what, low: Math.min(foot[1], heel[1], toe[1]) });
  }
  return { P, out };
}
const each = (fn) => { for (const [name, who] of Object.entries(WHO)) for (const [move, T] of [...MOVES_ON, ...MOVES_OFF]) for (let t = 0; t <= T + 1e-9; t += 1 / 30) fn(name, who, move, t); };

test('the knees and hips stay bent through every frame of the swing on and off the bed (no straight-leg swing)', () => {
  each((name, who, move, t) => {
    if (!/^swing/.test(move)) return;
    const { P, out } = legs(move, t, who);
    for (const l of out) {
      assert.ok(l.angle <= 180 - KNEE_MIN, `${name} ${move} ${t.toFixed(2)} s: a knee only ${(180 - l.angle).toFixed(0)} degrees bent`);
      // (the hip bent too: the thigh well off the line of the body, whichever way it leans)
      const up = [Math.sin(-P.lean) * Math.sin(P.heading), Math.cos(P.lean), Math.sin(-P.lean) * Math.cos(P.heading)];
      const th = sub(l.knee, l.hip), c = (th[0] * up[0] + th[1] * up[1] + th[2] * up[2]) / len(th);
      assert.ok(c > -Math.cos(KNEE_MIN * Math.PI / 180), `${name} ${move} ${t.toFixed(2)} s: a hip nearly straight`);
    }
  });
});

test('no leg goes through the bed: getting on and off within 1 cm of its surfaces, resting on it within 1.5 cm', () => {
  each((name, who, move, t) => {
    const { out } = legs(move, t, who), most = /^(down|up|stretch|bend)$/.test(move) ? 0.015 : 0.01;
    for (const l of out) assert.ok(l.deep <= most, `${name} ${move} ${t.toFixed(2)} s: ${l.what} by ${(l.deep * 100).toFixed(1)} cm`);
  });
});

test('the feet never go into the floor, and stand on it at the start of getting on and the end of getting off', () => {
  each((name, who, move, t) => { for (const l of legs(move, t, who).out) assert.ok(l.low > -0.005, `${name} ${move} ${t.toFixed(2)} s: a foot ${(l.low * 100).toFixed(1)} cm into the floor`); });
  for (const [name, who] of Object.entries(WHO)) {
    for (const l of legs('hop', 0, who).out) assert.ok(l.foot[1] < 0.03, name + ': standing on the floor before the hop');
    for (const l of legs('hopdown', MOVES_OFF.at(-1)[1], who).out) assert.ok(l.foot[1] < 0.03, name + ': standing on the floor after the hop down');
  }
});

test('each move starts where the one before ends (hips, feet, the way they face, their lean)', () => {
  for (const [name, who] of Object.entries(WHO)) for (const list of [MOVES_ON, MOVES_OFF, [MOVES_ON.at(-1), ['lying', 0], MOVES_OFF[0]]]) for (let i = 0; i + 1 < list.length; i++) {
    const a = pose(list[i][0], list[i][1], BED, who), b = pose(list[i + 1][0], 0, BED, who);
    assert.ok(len(sub(a.hips, b.hips)) < 0.005, `${name}: ${list[i][0]} to ${list[i + 1][0]}: the hips jump`);
    if (a.legs && b.legs) for (const k of [0, 1]) assert.ok(len(sub(a.feet[k], b.feet[k])) < 0.01, `${name}: ${list[i][0]} to ${list[i + 1][0]}: a foot jumps`);
    assert.ok(Math.abs(a.heading - b.heading) < 0.01 && Math.abs(a.lean - b.lean) < 0.01, `${name}: ${list[i][0]} to ${list[i + 1][0]}: turned at once`);
  }
});

test('lying, the head is on the head rest and the hips over the pad; sitting on the edge, the knees are past it', () => {
  for (const who of Object.values(WHO)) {
    const L = pose('lying', 0, BED, who);
    // (the head about 0.77 m from the hip joints along the body, toward the wall)
    const head = L.hips[2] - 0.77;
    assert.ok(head > BED.rest[0] && head < BED.rest[1], 'the head on the head rest: ' + head.toFixed(2));
    const E = pose('hop', 1.3, BED, who);
    assert.ok(E.hips[0] + who.a > BED.edge + 0.03, 'the knees past the edge, sitting on it');
  }
});
