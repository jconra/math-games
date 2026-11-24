// THE FORKLIFT LAP IN CARGO (2026-11-22, the game's maker: "It would be cool to have the game with the forklift too
// where if you go down there an employee might say they can do a lap in 30 seconds or whatever and you can get the
// forklift to a position and it will count down and time you. Maybe there can be some waypoints at the corners that you
// have to hit to make the time official."), as the plain numbers say it:
//   the plan (kit/places-plan.js LAP): the start box in the south lane, its line across the lane; a waypoint at each
//   of the four corners of the way round the racks, on open floor; every lane of it wide enough for the forklift;
//   the rules (kit/forkliftlap.js): stopped on the box behind the line, the countdown, held still meanwhile; the
//   waypoints in order, one passed by is missed for good; the line ends the lap only once it has been round; official
//   only with all four; never while a supply run waits to be loaded;
//   the lap driven by the game's own forklift numbers (kit/forkliftdrive.js): clean, it clears everything and beats
//   the loader's time; carefully, it comes out at the loader's time (that is where the time is from); cut through an
//   aisle, it is quicker and not official;
//   what Cargo's loader says (src/lines.js LAP_TALK), and that they are one of Cargo's own who drives the forklift.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { LAP, STORE, RACKS, FLOOR, CARGO, SLOT, baysOf } from '../kit/places-plan.js';
import { RULES, BOX, LINE, START, GATES, makeLap, onBox, nose, tenth, resultOf } from '../kit/forkliftlap.js';
import { makeDrive, worldOf, clearance, stillBlocks, FLOOR_PLACES, HAND, aabb, boxGap } from '../kit/forkliftdrive.js';
import { TRUCK, PARKED, outline, axleOf, wallGap, roomBlocks } from '../kit/forkliftround.js';
import { makeSupplyRun, startRun } from '../src/supplyrun.js';
import { LAP_TALK } from '../src/lines.js';
import { ROOM_CREW } from '../src/life.js';

const waiting = (ids = ['w0', 'w1', 'w2', 'w3']) => CARGO.pallets.map((p, i) => ({ i, place: p.at })).filter((p) => ids.includes(p.place)).map((p) => { const q = FLOOR_PLACES.find((x) => x.id === p.place); return { i: p.i, at: q.at, y: 0, h: q.h, place: q.id }; });
const room = (ids) => worldOf({ open: [], pallets: waiting(ids), people: [] });
// (how far a box of the floor is from everything that stands in Cargo: the racks, the benches, the desk, the scale, the
// containers, the lift, the pallets waiting, the forklift's own place)
const gapOf = (b) => Math.min(...[...roomBlocks().map((x) => x.box), ...waiting().map((p) => [p.at[0] - 0.5, p.at[0] + 0.5, p.at[1] - 0.6, p.at[1] + 0.6]), FLOOR.forklift].map((x) => boxGap(aabb('', b), aabb('', x))));

test('the lap\'s plan: the start box in the south lane, a waypoint at each corner of the way round the racks, all on open floor', () => {
  const [x0, x1, z0, z1] = LAP.box, last = RACKS.z[RACKS.z.length - 1] + RACKS.deep / 2;
  assert.ok(x1 - x0 >= TRUCK.tips - TRUCK.rear + 0.5 && z1 - z0 >= TRUCK.half * 2 + 1, 'the forklift fits in its start box with room to spare');
  assert.ok(z0 > last + 1.5 && z1 < FLOOR.benches[2] && gapOf(LAP.box) > 1.5, 'the box in the lane south of the last racks, clear of everything: ' + gapOf(LAP.box).toFixed(2));
  assert.ok(Math.abs(Math.cos(LAP.face) + 1) < 1e-9, 'the lap sets off west');
  assert.ok(Math.abs(LINE.at[0] - x0) < 1e-9 && LAP.lane[0] < z0 && LAP.lane[1] > z1 && LAP.lane[0] > last + 0.3, 'the line: the box\'s west edge, on across the lane');
  assert.ok(onBox(START).on && Math.abs(nose(START).past + 0.1) < 1e-9, 'the start: on the box, its forks a hand short of the line');
  // four corners: south-west, north-west, north-east, south-east, round rows 2 to 6
  assert.equal(GATES.length, 4);
  const [sw, nw, ne, se] = LAP.corners, west = RACKS.x0[1] - 0.08, east = RACKS.x0[1] + baysOf(1) * RACKS.bay + 0.08;
  assert.ok(sw[0] < west && nw[0] < west && ne[0] > east && se[0] > east, 'west of the racks\' west ends, east of their east ends');
  assert.ok(sw[1] > last && se[1] > last && Math.abs(sw[1] - (z0 + z1) / 2) < 0.01 && Math.abs(se[1] - sw[1]) < 0.01, 'the south corners on the start box\'s own lane');
  const a = RACKS.z[0] + RACKS.deep / 2, b = RACKS.z[1] - RACKS.deep / 2;
  assert.ok(nw[1] > a + 1.5 && nw[1] < b - 1.5 && ne[1] === nw[1], 'the north corners in the middle of the first aisle (' + (b - a).toFixed(2) + ' m wide)');
  assert.ok(x0 - sw[0] > 4 && se[0] - x1 > 6, 'the first corner a little way after the line, the last a good straight before it');
  for (const G of GATES) {
    assert.ok(gapOf(G.box) > 0.1, `waypoint ${G.n} on open floor: ${gapOf(G.box).toFixed(2)}`);
    for (const [x, z] of [[G.box[0], G.box[2]], [G.box[1], G.box[2]], [G.box[0], G.box[3]], [G.box[1], G.box[3]]]) assert.ok(wallGap(x, z) > 0.6, `waypoint ${G.n} clear of the walls`);
    assert.ok(boxGap(aabb('', G.box), aabb('', LAP.box)) > 2, `waypoint ${G.n} apart from the start box`);
  }
  // EVERY LANE of it: along each straight between two corners, how wide the floor is clear (the forklift is 1.14 m
  // across; its back end swings out 0.9 m as it turns its tightest)
  const legs = [[[x0, sw[1]], sw], [sw, nw], [nw, ne], [ne, se], [se, [x1, se[1]]]], wide = [];
  for (const [p, q] of legs) {
    const along = Math.abs(q[0] - p[0]) > Math.abs(q[1] - p[1]) ? 0 : 1;
    let least = Infinity;
    for (let t = 0; t <= 1; t += 0.01) {
      const at = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      // (a strip across the lane, widened till it meets something)
      let w = 0.2; const strip = (h) => (along ? [at[0] - h, at[0] + h, at[1] - 0.05, at[1] + 0.05] : [at[0] - 0.05, at[0] + 0.05, at[1] - h, at[1] + h]);
      while (w < 6 && gapOf(strip(w)) > 0 && wallGap(...(along ? [at[0] - w, at[1]] : [at[0], at[1] - w])) > HAND.wall && wallGap(...(along ? [at[0] + w, at[1]] : [at[0], at[1] + w])) > HAND.wall) w += 0.02;
      least = Math.min(least, 2 * w);
    }
    wide.push(+least.toFixed(2));
  }
  // (the narrowest: up the racks' west ends past the pallet waiting nearest them, 1.9 m; the first aisle 3.5 m)
  assert.ok(wide.every((w) => w >= 1.85), 'every lane at least 1.85 m clear at the lap\'s own line: ' + wide.join(', '));
  assert.ok(wide[2] >= 3.4 && wide[3] >= 4 && wide[0] >= 4 && wide[4] >= 4, 'the first aisle, the east lane and the south lane roomy: ' + wide.join(', '));
});

test('the start: stopped on the box behind the line and facing it, then 3, 2, 1, go, held still meanwhile', () => {
  const f = BOX.f;
  assert.equal(onBox({ ...START, x: START.x + f[0] * 0.6, z: START.z + f[1] * 0.6 }).why, 'back', 'its forks over the line: back up');
  assert.equal(onBox({ ...START, x: START.x - f[0] * 1.6, z: START.z - f[1] * 1.6 }).why, 'forward', 'hanging out of the back of the box: further forward');
  assert.equal(onBox({ ...START, x: START.x - f[0] * 0.5, z: START.z - f[1] * 0.5, h: START.h + 1 }).why, 'face', 'turned away from the line');
  assert.equal(onBox({ ...START, x: START.x - f[0] * 0.5, z: START.z + 1.0 }).why, 'side', 'half out of the box\'s side');
  assert.ok(onBox({ ...START, x: START.x - f[0] * 0.5, z: START.z - 0.3, h: START.h + 0.2 }).on, 'a little off its middle and a little turned is on it');
  assert.equal(onBox(PARKED).in, false, 'parked in its bay is nowhere near it');
  const L = makeLap(), dt = 1 / 60;
  // rolling over the box: nothing
  for (let i = 0; i < 120; i++) assert.deepEqual(L.step(START, 0.6, dt), {});
  assert.equal(L.s.phase, 'idle'); assert.equal(L.held, false);
  // stopped: after a moment the countdown, a second a number, the forklift held
  const seen = []; let t = 0, go = null;
  for (let i = 0; i < 60 * 6 && go == null; i++) { const ev = L.step(START, 0, dt); t += dt; if (ev.count) { seen.push([ev.count, +t.toFixed(2)]); assert.ok(L.held); } if (ev.go) go = t; }
  assert.deepEqual(seen.map((x) => x[0]), [3, 2, 1]);
  assert.ok(Math.abs(seen[0][1] - RULES.still) < 0.05 && Math.abs(seen[1][1] - seen[0][1] - 1) < 0.03 && Math.abs(go - seen[0][1] - RULES.count) < 0.03, 'a second for each number: ' + JSON.stringify(seen) + ' go ' + go.toFixed(2));
  assert.equal(L.s.phase, 'run'); assert.equal(L.held, false); assert.ok(L.s.clock < dt + 1e-9, 'the clock starts at go');
  // got off: called off
  assert.equal(L.cancel(), true); assert.equal(L.s.phase, 'idle');
  // NOT WHILE A SUPPLY RUN WAITS TO BE LOADED: the box starts nothing
  const crew = { id: 'c', jobs: {} }, supply = makeSupplyRun({ crew: () => crew, forklift: { stock: null } }), can = () => !supply.hold();
  const M = makeLap();
  startRun(crew).worked = true;
  for (let i = 0; i < 300; i++) M.step(START, 0, dt, { can: can() });
  assert.equal(M.s.phase, 'idle', 'a worked-out run waiting: no countdown'); assert.equal(M.s.on, null);
  // (and one worked out during a countdown calls it off)
  crew.jobs.cargo.run.worked = false;
  for (let i = 0; i < 60; i++) M.step(START, 0, dt, { can: can() });
  assert.equal(M.s.phase, 'count');
  crew.jobs.cargo.run.worked = true;
  assert.equal(M.step(START, 0, dt, { can: can() }).off, 'cannot'); assert.equal(M.s.phase, 'idle');
});

// a lap of poses the test puts the forklift at, one a frame: -> the events, in turn
function walk(L, pts, { v = 1.5, dt = 1 / 60, h = null } = {}) {
  const evs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]], d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / (v * dt))), hh = h ?? Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    for (let k = 1; k <= n; k++) { const ev = L.step({ x: a[0] + (b[0] - a[0]) * k / n, z: a[1] + (b[1] - a[1]) * k / n, h: hh }, v, dt); if (Object.keys(ev).length) evs.push(ev); }
  }
  return evs;
}
function started() { const L = makeLap(); for (let i = 0; i < 60 * 5 && L.s.phase !== 'run'; i++) L.step(START, 0, 1 / 60); assert.equal(L.s.phase, 'run'); return L; }
const [SW, NW, NE, SE] = LAP.corners, HOME = [START.x, START.z], OVER = [LINE.at[0] - 3, START.z];

test('the waypoints in order, the line: all four hit is official; one passed by is missed for good and the time is not official', () => {
  // all the way round
  let L = started(), evs = walk(L, [HOME, SW, NW, NE, SE, [LAP.box[1] + 4, START.z], OVER]);
  assert.deepEqual(evs.filter((e) => e.gate).map((e) => e.gate), [1, 2, 3, 4]);
  let fin = evs.find((e) => e.finish).finish;
  assert.ok(fin.official && fin.missed.length === 0, 'official');
  assert.equal(L.s.phase, 'idle'); assert.equal(L.s.result, fin);
  const length = [HOME, SW, NW, NE, SE].reduce((n, p, i, a) => n + (i ? Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) : 0), 0) + (SE[0] - LINE.at[0]) + TRUCK.tips;
  assert.ok(Math.abs(fin.time - (length - TRUCK.tips * 2 + TRUCK.tips) / 1.5) < 2.5, `the clock stops as its forks cross the line: ${fin.time} s for ${length.toFixed(1)} m at 1.5 m/s`);
  assert.equal(fin.time, tenth(fin.time)); assert.equal(fin.loader, LAP.time);
  // cut through the aisle between the fourth and fifth rows: corners 2 and 3 passed by
  L = started();
  const zc = (RACKS.z[3] + RACKS.z[4]) / 2;
  evs = walk(L, [HOME, SW, [SW[0], zc], [SE[0], zc], SE, [LAP.box[1] + 4, START.z], OVER]);
  assert.deepEqual(evs.filter((e) => e.gate).map((e) => e.gate), [1, 4]);
  assert.deepEqual(evs.find((e) => e.gate === 4).missed, [2, 3]);
  fin = evs.find((e) => e.finish).finish;
  assert.ok(!fin.official && !fin.beat, 'not official'); assert.deepEqual(fin.missed, [2, 3]);
  // going back for one passed by does not mend it
  L = started();
  evs = walk(L, [HOME, SW, [SW[0], zc], [SE[0], zc], NE, NW, [NW[0], zc], [SE[0], zc], SE, [LAP.box[1] + 4, START.z], OVER]);
  assert.deepEqual(evs.find((e) => e.finish).finish.missed, [2], 'corner 2, passed by on the way to 3, stays missed');
  // off the line and straight back over it: no lap (it has not been away); the wrong way over the line: no finish
  L = started();
  evs = walk(L, [HOME, [LINE.at[0] - 4, START.z]]);
  evs.push(...walk(L, [[LINE.at[0] - 4, START.z], [LINE.at[0] + 2, START.z]], { h: LAP.face, v: -1 }));
  evs.push(...walk(L, [[LINE.at[0] + 2, START.z], [LINE.at[0] - 4, START.z]]));
  assert.ok(!evs.some((e) => e.finish) && L.s.phase === 'run', 'backed over the line and forward again close by: still running');
  evs = walk(L, [[LINE.at[0] - 4, START.z], SW, [SW[0], zc], [9, zc]]);
  evs.push(...walk(L, [[9, 21.5], [LINE.at[0] + 6, 21.5]]));
  assert.ok(!evs.some((e) => e.finish), 'eastward over the line (the wrong way): no finish');
  evs = walk(L, [[LINE.at[0] + 6, 21.5], [LINE.at[0] - 3, 21.5]]);
  assert.deepEqual(evs.find((e) => e.finish).finish.missed, [2, 3, 4], 'then the right way over it: the lap ends, three corners missed');
  // round the outside of the line's end, past the lift: no finish
  L = started();
  evs = walk(L, [HOME, SW, NW, NE, SE, [16, 23.4], [16, 31], [8, 31]]);
  assert.ok(!evs.some((e) => e.finish) && L.s.phase === 'run', 'past the line\'s end (south of the lift): the clock runs on');
  // left running: called off
  let off = null; for (let i = 0; i < 60 * (RULES.most + 2) && !off; i++) off = L.step({ x: 8, z: 31, h: 0 }, 0, 1 / 60).off;
  assert.equal(off, 'left'); assert.equal(L.s.phase, 'idle');
});

test('the time against the loader\'s: under it beats it, the same or more does not; never a beat when not official', () => {
  const all = [true, true, true, true];
  assert.deepEqual(resultOf(LAP.time - 3.26, all), { time: tenth(LAP.time - 3.26), official: true, missed: [], beat: true, by: 3.3, loader: LAP.time });
  assert.equal(resultOf(LAP.time - 0.04, all).beat, false, 'the same time to a tenth is not a beat');
  assert.equal(resultOf(LAP.time - 0.06, all).beat, true);
  assert.equal(resultOf(LAP.time + 5, all).beat, false); assert.equal(resultOf(LAP.time + 5, all).by, -5);
  const r = resultOf(20, [true, false, true, false]);
  assert.ok(!r.official && !r.beat); assert.deepEqual(r.missed, [2, 4]);
});

// ── the lap driven on the game's own forklift numbers ──────────────────────────────────────────────────────────────
// a hand of the test's own: it looks `look` metres along the way (the start, the corners, the line) and steers for
// that point, the stick full forward, eased to `ease` while the wheel is turned hard; keys: the wheel all the way or
// not at all, as the keys give it
function drive({ look = 1.8, keys = false, ease = 1, via = LAP.corners, world = room() } = {}) {
  const a0 = axleOf(START), pts = [a0, ...via, [LINE.at[0] + BOX.f[0] * 3, a0[1]]], way = []; let S = 0;
  for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]], d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 0.05); for (let k = 0; k < n; k++) way.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, S + d * k / n]); S += d; }
  way.push([...pts[pts.length - 1], S]);
  const D = makeDrive(START), s = D.s, L = makeLap(); let j = 0, worst = Infinity, what = '', stops = 0;
  for (let f = 0; f < 60 * 200; f++) {
    const [ax, az] = axleOf(s);
    while (j < way.length - 1 && Math.hypot(way[j + 1][0] - ax, way[j + 1][1] - az) <= Math.hypot(way[j][0] - ax, way[j][1] - az)) j++;
    let k = j; while (k < way.length - 1 && way[k][2] - way[j][2] < look) k++;
    const dx = way[k][0] - ax, dz = way[k][1] - az, want = Math.atan2(-dz, dx), a = Math.atan2(Math.sin(want - s.h), Math.cos(want - s.h));
    let turn = Math.max(-1, Math.min(1, -(2 * Math.sin(a) / Math.max(0.5, Math.hypot(dx, dz))) * HAND.turn));
    if (keys) turn = Math.abs(turn) > 0.33 ? Math.sign(turn) : 0;
    // (as the game: held still till the countdown is done; the rig's hand pushes the stick all the while)
    const ev = D.step({ go: L.held || L.s.phase !== 'run' ? 0 : Math.abs(turn) > 0.5 ? ease : 1, turn, forks: 0 }, 1 / 60, world);
    if (ev.blocked) stops++;
    const e2 = L.step(s, s.v, 1 / 60);
    if (L.s.phase === 'run') { const c = clearance(s, s, world); if (c.gap < worst) { worst = c.gap; what = `${c.what} at ${s.x.toFixed(1)}, ${s.z.toFixed(1)}`; } }
    if (e2.finish) return { ...e2.finish, worst, what, stops };
  }
  return { time: null, worst, what, stops };
}

test('the lap driven: clean, it is official, clears everything and beats the loader; carefully, it comes out at the loader\'s time', () => {
  // clean: the stick full forward all the way round, looking 1.4 to 2.2 m ahead
  const clean = [1.4, 1.8, 2.2].map((look) => drive({ look }));
  for (const r of clean) {
    assert.ok(r.official && r.stops === 0, 'official, never stopped: ' + JSON.stringify(r));
    assert.ok(r.worst > 0.25, `clear of everything by a hand and more: ${r.worst.toFixed(2)} m (${r.what})`);
    assert.ok(r.beat && r.by >= 4 && r.by <= 14, `beats the loader's ${LAP.time} s by a fair few seconds, not by half: ${r.time} s`);
  }
  // with fewer pallets waiting, or none: the same lap
  for (const ids of [['w0', 'w1', 'w2'], []]) { const r = drive({ world: room(ids) }); assert.ok(r.official && Math.abs(r.time - clean[1].time) < 0.5, 'the same lap whatever waits on the loading floor'); }
  // THE LOADER'S TIME is a careful hand's: the keys, the stick eased to half while the wheel is turned
  const careful = drive({ keys: true, ease: 0.5 });
  assert.ok(careful.official, 'the careful lap is official');
  assert.ok(Math.abs(careful.time - LAP.time) <= 1.5, `the loader's ${LAP.time} s is the careful lap's time: ${careful.time} s`);
  assert.equal(LAP.time, Math.round(LAP.time), 'a whole number of seconds, as it is said');
});

test('a lap cut through an aisle is quicker and not official; whatever the hand does, the forklift never goes into anything', () => {
  const zc = (RACKS.z[3] + RACKS.z[4]) / 2, cut = drive({ via: [LAP.corners[0], [LAP.corners[0][0], zc], [LAP.corners[3][0], zc], LAP.corners[3]] });
  assert.ok(cut.time && !cut.official, 'not official'); assert.deepEqual(cut.missed, [2, 3]);
  assert.ok(cut.time < drive().time - 8, 'quicker by the two corners it left out: ' + cut.time);
  assert.ok(cut.worst > -1e-6);
  // a hand looking too far or too near ahead rubs along things and is stopped, but never goes in
  for (const look of [0.7, 3.4, 4.2]) { const r = drive({ look, keys: true }); assert.ok(r.worst > -1e-6, `look ${look}: into ${r.what} by ${r.worst}`); }
});

test('Cargo\'s loader says it: one of Cargo\'s people who drives the forklift, their lines short enough for a bubble', () => {
  const who = ROOM_CREW.find((p) => p.id === LAP.who);
  assert.ok(who && who.place === 'store', 'one of Cargo\'s people');
  assert.ok(who.day.some((d) => d.do === 'drive:forklift'), 'who drives the forklift');
  const most = Math.max(...ROOM_CREW.filter((p) => p.place === 'store').map((p) => (p.day.find((d) => d.do === 'drive:forklift') || { p: 0 }).p));
  assert.equal(who.day.find((d) => d.do === 'drive:forklift').p, most, 'the one who drives it most');
  const fillIn = (s) => s.replace('{secs}', String(LAP.time)).replace('{time}', '999.9');
  for (const pair of LAP_TALK.offer) {
    assert.equal(pair.length, 2);
    assert.ok(/\{secs\} seconds/.test(pair[0]) && /lap/.test(pair[0]) && /forklift/.test(pair[0]), 'says how fast a lap they do: ' + pair[0]);
    assert.ok(/START/.test(pair[1]), 'and where to start: ' + pair[1]);
  }
  for (const k of ['beat', 'slower']) for (const s of LAP_TALK[k]) assert.ok(/\{time\}/.test(s) && /\{secs\}/.test(s), s);
  for (const s of LAP_TALK.missed) assert.ok(/corner/.test(s) && /not/.test(s), s);
  for (const s of [...LAP_TALK.offer.flat(), ...LAP_TALK.beat, ...LAP_TALK.slower, ...LAP_TALK.missed]) { const w = fillIn(s); assert.ok(w.length <= 90 && !/[{}]/.test(w), `a bubble holds it: ${w.length} letters: ${w}`); }
  // (nothing is paid: the lap's result carries no credits, and the rules keep nothing between laps but the last result
  // and how long its countdown waited for the lane; a crew member's best is kept with them: src/lapbest.js, tests/cargo2.test.mjs)
  const L = makeLap();
  assert.deepEqual(Object.keys(L.s).sort(), ['clock', 'hit', 'missed', 'n', 'next', 'on', 'phase', 'result', 'waited']);
  assert.ok(!('credits' in resultOf(50, [true, true, true, true])) && !('best' in L.s));
});
