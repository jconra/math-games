// "Protect the wagon" in plain numbers (src/missions/wagonplan.js): the road loop the wagon rolls round, the riders'
// places round the wagon, the sacks a roped bandit drops, the wording, and the wagon's speed dial (never raised in the
// same wave as the math). Whether the road is clear on the real land is checked by ~/pw/bandit-math/rigs/bandits/
// road_check.cjs; how the job plays, by the rigs in ~/pw/bandit-math/rigs/bandits/.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROAD_POINTS, makeRoad, SLOTS, gangLine, sacksFor, nextSpeed } from '../src/missions/wagonplan.js';

const road = makeRoad(ROAD_POINTS);

test('the road is a smooth closed loop a few hundred metres round', () => {
  assert.ok(road.length > 300 && road.length < 480, `length ${road.length}`);
  const a = road.at(0), b = road.at(road.length);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6, 'it closes on itself');
  // it passes through every point it was given
  for (const [x, z] of ROAD_POINTS) {
    const s = road.nearest(x, z), q = road.at(s);
    assert.ok(Math.hypot(q.x - x, q.z - z) < 0.8, `passes near ${x}, ${z}`);
  }
  // no kinks: the heading turns gently metre by metre, and the steps are a metre apart
  for (let s = 0; s < road.length; s += 1) {
    const p = road.at(s), q = road.at(s + 1);
    assert.ok(Math.abs(Math.hypot(q.x - p.x, q.z - p.z) - 1) < 0.05, `step at ${s}`);
    const dh = Math.atan2(Math.sin(q.h - p.h), Math.cos(q.h - p.h));
    assert.ok(Math.abs(dh) < 0.05, `turn at ${s}: ${dh} (a bend tighter than 20 m)`);
  }
});

test('the heading points along the road and the side is to its left', () => {
  for (const s of [0, 50, 123, 250]) {
    const p = road.at(s), a = road.at(s - 1), q = road.at(s + 1);
    const dir = Math.atan2(q.x - a.x, q.z - a.z);
    assert.ok(Math.abs(Math.atan2(Math.sin(dir - p.h), Math.cos(dir - p.h))) < 0.05);
    assert.ok(Math.abs(Math.hypot(p.nx, p.nz) - 1) < 1e-9);
    // left of a heading h (facing (sin h, cos h)) is (cos h, -sin h): a quarter turn the other way from the right
    assert.ok(Math.abs(p.nx * Math.sin(p.h) + p.nz * Math.cos(p.h)) < 1e-9, 'square to the road');
  }
});

test('places along the road wrap round, and the gap between two is the short way round', () => {
  const L = road.length;
  const a = road.at(-10), b = road.at(L - 10);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6);
  assert.equal(Math.round(road.gap(10, 30)), 20);
  assert.equal(Math.round(road.gap(30, 10)), -20);
  assert.equal(Math.round(road.gap(L - 5, 5)), 10);
  assert.ok(Math.abs(road.gap(0, L / 2 + 1)) <= L / 2);
});

test('tracking a rider finds its place along the road from where it was', () => {
  for (const s of [3, 77, 200, road.length - 4]) {
    const q = road.at(s), x = q.x + q.nx * 8, z = q.z + q.nz * 8;   // (8 m out to the side)
    const t = road.track(x, z, s + 12);
    assert.ok(Math.abs(road.gap(s, t)) < 1.5, `${s} -> ${t}`);
  }
});

test('the riders\' places keep clear of the wagon and of each other', () => {
  assert.ok(SLOTS.length >= 10, 'room for a wave of 8 and a couple riding back in');
  for (const [side, out] of SLOTS) { assert.ok(side === 1 || side === -1); assert.ok(out >= 5.5 && out <= 12.5, 'out from the wagon, inside the checked 12 m'); }
  for (let i = 0; i < SLOTS.length; i++) for (let j = i + 1; j < SLOTS.length; j++) {
    const [a, b] = [SLOTS[i], SLOTS[j]];
    const d = Math.hypot(a[0] * a[1] - b[0] * b[1], a[2] - b[2]);
    assert.ok(d >= 4, `slots ${i} and ${j} are ${d.toFixed(1)} m apart`);
  }
  // the first eight are spread over both sides
  const first = SLOTS.slice(0, 8);
  assert.equal(first.filter((s) => s[0] === 1).length, 4);
});

test('a roped bandit drops his number as sacks of the table', () => {
  assert.deepEqual(sacksFor(24, 6), { sacks: 4, per: 6 });
  assert.deepEqual(sacksFor(56, 7), { sacks: 8, per: 7 });
  assert.deepEqual(sacksFor(10, 10), { sacks: 1, per: 10 });
  assert.deepEqual(sacksFor(27, 6), { sacks: 0, per: 6 }, 'not in the gang: no sacks');
  assert.deepEqual(sacksFor(8, 7, 'missing'), { sacks: 8, per: 7 }, '7 × ? = 56: the 8 drops 8 sacks of 7');
  assert.deepEqual(sacksFor(5, 0), { sacks: 0, per: 0 });
});

test('the trainer\'s herd wording reads as the gang', () => {
  assert.equal(gangLine('Three past 24, not in the 6-herd'), 'Three past 24, not in the 6-Gang');
  assert.equal(gangLine('Two short of 12, not in the 12-herd'), 'Two short of 12, not in the 12-Gang');
  assert.equal(gangLine(null), '');
});

test('the wagon\'s speed and the math are never raised together', () => {
  // a clean wave on the same step: a notch faster (up to the top)
  assert.equal(nextSpeed(0, { misses: 0 }), 1);
  assert.equal(nextSpeed(3, { misses: 0, top: 3 }), 3);
  // a clean wave that climbed a step: the speed stays
  assert.equal(nextSpeed(1, { misses: 0, stepUp: true }), 1);
  // a new table: back to a walk, whatever else happened
  assert.equal(nextSpeed(3, { misses: 0, stepUp: true, newTable: true }), 0);
  // one slip: the same; a rough wave: a notch slower
  assert.equal(nextSpeed(2, { misses: 1 }), 2);
  assert.equal(nextSpeed(2, { misses: 2 }), 1);
  assert.equal(nextSpeed(0, { misses: 4 }), 0);
  // over many made-up waves the two never go up together
  let lv = 0, step = 5;
  for (let i = 0; i < 400; i++) {
    const misses = [0, 0, 0, 1, 2][i % 5], up = i % 7 === 0, newTable = i % 23 === 0;
    const next = nextSpeed(lv, { misses, stepUp: up || newTable, newTable });
    if (up || newTable) assert.ok(next <= lv, 'the speed never rises in a wave where the math went up');
    lv = next; step += up ? 1 : 0;
  }
});

test('the job module wires the plan, the riders and the music together', () => {
  const src = fs.readFileSync(new URL('../src/missions/wagonjob.js', import.meta.url), 'utf8');
  for (const name of ['makeRoad', 'sacksFor', 'nextSpeed', 'gangLine', 'makeRider', 'makeActionMusic', "countJob(rider, 'bandits'"]) assert.ok(src.includes(name), name);
  // the job counts bandits brought in, which the save file's buckle table must know
  const save = fs.readFileSync(new URL('../src/save.js', import.meta.url), 'utf8');
  assert.match(save, /id: 'bandits'[^\n]*ready: true/);
  assert.match(save, /id: 'wagon'[^\n]*ready: true/);
});

// ── the trip (A to B), the open road and the hold-ups on the long roads ──────────────────────────────────────────
import { TRIP, tripLeft, makeOpenRoad, AMBUSH, gangSize, outOnRoad, ambushPick } from '../src/missions/wagonplan.js';

test('a trip runs from one end of the loop to the other, never shorter than its least', () => {
  const L = road.length;
  // from where the wagon first waits (the west end, 0): on to the east end, half way round
  assert.ok(Math.abs(tripLeft(0, L) - L / 2) < 1e-6, `${tripLeft(0, L)}`);
  // from the east end: back round to the west end
  assert.ok(Math.abs(tripLeft(L / 2, L) - L / 2) < 1e-6);
  // a little short of a mark: that mark is too near, so the next one
  assert.ok(Math.abs(tripLeft(L / 2 - 20, L) - (L / 2 + 20)) < 1e-6);
  // s past the loop's length (the job's wagon keeps counting): the same as wrapped round
  assert.ok(Math.abs(tripLeft(L + 30, L) - tripLeft(30, L)) < 1e-6);
  for (let s0 = 0; s0 < L * 2; s0 += 7) { const d = tripLeft(s0, L); assert.ok(d >= TRIP.least && d <= L / 2 + TRIP.least + 1e-6, `${s0}: ${d}`); }
  assert.ok(TRIP.quiet < TRIP.least && TRIP.pay > 0);
});

test('an open road follows its points, runs straight on past its ends, and does not wrap', () => {
  // a quarter circle of radius 50, then straight on: points a metre apart
  const pts = [];
  for (let a = 0; a <= Math.PI / 2; a += 1 / 50) pts.push([50 - 50 * Math.cos(a), 50 * Math.sin(a)]);
  const r = makeOpenRoad(pts);
  assert.ok(Math.abs(r.length - Math.PI * 25) < 1.5, `${r.length}`);
  const a = r.at(0), b = r.at(r.length);
  assert.ok(Math.hypot(a.x - pts[0][0], a.z - pts[0][1]) < 1e-6);
  assert.ok(Math.hypot(b.x - pts[pts.length - 1][0], b.z - pts[pts.length - 1][1]) < 0.5);
  // past the start: straight back along the first heading (facing +z there)
  const c = r.at(-10); assert.ok(Math.abs(c.x - a.x) < 0.5 && Math.abs(c.z - (a.z - 10)) < 0.5, JSON.stringify(c));
  assert.equal(r.gap(30, 10), -20);
  assert.equal(r.gap(10, 30), 20);
  // the side is to the left of the heading, a metre long
  for (const s0 of [5, 30, 60]) { const q = r.at(s0); assert.ok(Math.abs(Math.hypot(q.nx, q.nz) - 1) < 1e-9); assert.ok(Math.abs(q.nx * Math.sin(q.h) + q.nz * Math.cos(q.h)) < 1e-9); }
  // tracking a rider 8 m out to the side finds its place along the road
  for (const s0 of [4, 33, 70]) { const q = r.at(s0), t = r.track(q.x + q.nx * 8, q.z + q.nz * 8, s0 + 10); assert.ok(Math.abs(t - s0) < 1.5, `${s0} -> ${t}`); }
  assert.ok(Math.abs(r.nearest(r.at(42).x, r.at(42).z) - 42) < 1.1);
});

test('a hold-up only out on the long roads, on a travelling wagon near enough to see, with room round it', () => {
  const square = 500;
  assert.equal(outOnRoad({ pu: square + 20, off: 3, square }), false, 'in town');
  assert.equal(outOnRoad({ pu: square - AMBUSH.player - 5, off: 10, square }), true, 'out on the west road');
  assert.equal(outOnRoad({ pu: square + 300, off: AMBUSH.roadNear + 5, square }), false, 'well off the road');
  const base = { made: true, onRoad: true, held: false, ended: false, plan: false, seen: true, open: 1 };
  const far = { ...base, u: square - 300, dist: 100 };
  assert.equal(ambushPick([far], { square }), far);
  assert.equal(ambushPick([{ ...far, u: square - 60 }], { square }), null, 'in town');
  assert.equal(ambushPick([{ ...far, dist: AMBUSH.from - 5 }], { square }), null, 'on top of the player');
  assert.equal(ambushPick([{ ...far, dist: AMBUSH.to + 5 }], { square }), null, 'too far to see');
  assert.equal(ambushPick([{ ...far, made: false }], { square }), null, 'not drawn');
  assert.equal(ambushPick([{ ...far, onRoad: false }], { square }), null, 'pulling off or standing at a spot');
  assert.equal(ambushPick([{ ...far, held: true }], { square }), null, 'already held up');
  assert.equal(ambushPick([{ ...far, open: 0.3 }], { square }), null, 'thick trees round it');
  assert.equal(ambushPick([{ ...far, mist: 0.5 }], { square }), null, 'in the mist at the valley\'s end');
  assert.equal(ambushPick([{ ...far, mist: 0 }], { square }).u, far.u, 'clear air');
  assert.equal(ambushPick([{ ...far, atJob: true }], { square }), null, 'by the pasture or the corral (the round-up asks there)');
  // one in view first, then the one nearest a middling distance
  const unseen = { ...far, seen: false, dist: 100 }, seen = { ...far, seen: true, dist: 160 };
  assert.equal(ambushPick([unseen, seen], { square }), seen);
  const a = { ...far, dist: 60 }, b = { ...far, dist: 105 };
  assert.equal(ambushPick([a, b], { square }), b);
});

test('a hold-up asks 3 to 5 questions: the bunch', () => {
  for (const r of [0, 0.3, 0.6, 0.99]) {
    const n = gangSize(() => r), goods = Math.round(n / 2);   // (the times trainer: about half the bunch is the gang)
    assert.ok(n >= AMBUSH.riders[0] && n <= AMBUSH.riders[1], `${n}`);
    assert.ok(goods >= 3 && goods <= 5, `${n} riders: ${goods} bandits`);
  }
  assert.ok(AMBUSH.most >= 3 && AMBUSH.most <= 5);
  // the driver's shout, and a place for a recorded one
  assert.equal(AMBUSH.words.help, 'Help!');
  assert.ok(Array.isArray(AMBUSH.helpClips));
  assert.ok(AMBUSH.words.thanks.length >= 2 && AMBUSH.bonus > 0);
});

test('the job holds up the traffic\'s wagons and lets them go, and thanks the player at the end of a trip', () => {
  const src = fs.readFileSync(new URL('../src/missions/wagonjob.js', import.meta.url), 'utf8');
  for (const name of ['T.holdUp(t)', 'A.T.letGo(A.t)', 'ambushPick(', 'makeOpenRoad(', "howdy(d, AMBUSH.words.help", 'tripLeft(', 'function arrive()']) assert.ok(src.includes(name), name);
  // the driver's thank-you ('banditsDone', heard by the job folk) comes at the end of a trip, not after every gang
  const arrive = src.slice(src.indexOf('function arrive()'), src.indexOf('function giveUp()'));
  assert.ok(arrive.includes("hob.event('banditsDone'"));
  const done = src.slice(src.indexOf('function waveDone()'), src.indexOf('function arrive()'));
  assert.ok(!/hob\.event\('banditsDone', \{ n: w\.caught \}\)/.test(done.split('if (ambush)')[0]), 'not before the hold-up branch');
  const traffic = fs.readFileSync(new URL('../src/traffic.js', import.meta.url), 'utf8');
  for (const name of ['T.holdUp = ', 'T.letGo = ', "t.why = 'held up'", 'makeRoadFolk(', 'howdy(t.wg.driver']) assert.ok(traffic.includes(name), name);
});
