// CARGO, ROUND TWO (2026-11-23, the game's maker's four answers), as the plain numbers say it:
//   CARGO1-1, B  "Cargo's loader walks over, gets on the forklift and drives the rest into the containers while you
//                watch (when you leave Cargo, whatever is left is loaded at once)."
//                the way (kit/forkliftway.js): from any pose to a pallet's end, a container's doorway, its bay, clear of
//                everything, driven by the stick and the wheel alone; the loader's hand (kit/forkliftloader.js): every
//                pallet wanted into the containers by the player's own forklift code, then parked; the run asks for it
//                (src/supplyrun.js);
//   LAP1-1, B    "Each crew member's own best official lap is kept and shown on the clock and on the card ('Your best:
//                56.8 s')." (src/lapbest.js)
//   LAP1-2, B    "a small board by the forklift's bay with the best lap on it and whose it is." (src/lapbest.js boardOf,
//                kit/places-plan.js LAP.board)
//   LAP1-3       "I think anyone in the area should get out of the way and watch... Id suggest getting anyone in the area
//                to watch near the finish line." (kit/forkliftlap.js: the lane, the countdown's wait; LAP.watch)
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { LAP, STORE, CARGO, LOAD, FLOOR, STOPS, LIFT, RACKS } from '../kit/places-plan.js';
import { makeDrive, worldOf, clearance, FLOOR_PLACES, BOX_PLACES, HAND, aabb, boxGap } from '../kit/forkliftdrive.js';
import { PARKED, TRUCK, axleOf, roomBlocks, wallGap } from '../kit/forkliftround.js';
import { WAY, planWay, makePlan, makeFollower, clearOf, sweep, sweepPoints, roundMap } from '../kit/forkliftway.js';
import { LOADER, makeLoader, beforePallet, beforePlace, inBay } from '../kit/forkliftloader.js';
import { RULES, BOX, LINE, START, TRACK, makeLap, lapAt, clearToGo, keepOff } from '../kit/forkliftlap.js';
import { bestOf, keepLap, boardOf, seconds } from '../src/lapbest.js';
import { makeSupplyRun, startRun, runOf } from '../src/supplyrun.js';
import { LAP_TALK } from '../src/lines.js';
import { ROOM_CREW } from '../src/life.js';
// (a wall panel's face in from the wall's line, and the wall's dark band: kit/grid.js WALL_FACE, kit/shell.js BAND,
// which draw with three.js and are not read here)
const WALL_FACE = 0.22, BAND = [1.22, 1.52];

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const placeOf = (id) => FLOOR_PLACES.find((x) => x.id === id) || BOX_PLACES.find((x) => x.id === id);
// Cargo as a run finds it: the forklift's pallets where they stand at the start (those on the loading floor; `moved`:
// place -> place, some already in the containers), both containers' doors open
function cargo({ moved = {}, people = [], without = [] } = {}) {
  const here = new Map(CARGO.pallets.map((p, i) => [p.at, i]));
  for (const [a, b] of Object.entries(moved)) { const i = here.get(a); here.delete(a); here.set(b, i); }
  for (const a of without) here.delete(a);
  const standing = () => [...here].map(([id, i]) => { const q = placeOf(id); return q ? { i, at: q.at, y: q.y, h: q.h, place: id, box: !!q.box } : null; }).filter(Boolean);
  return { here, world: () => worldOf({ open: LOAD.slots, pallets: standing(), people }) };
}
// (a seeded dice: the same poses every run)
const dice = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test('a sweep (a turn, a straight run, a turn) joins any two poses of the front axle', () => {
  const rnd = dice(11);
  for (let k = 0; k < 200; k++) {
    const a = [rnd() * 20, rnd() * 20, rnd() * 6.28 - 3.14], b = [rnd() * 20, rnd() * 20, rnd() * 6.28 - 3.14];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 4 * WAY.r) continue;      // (close together a sweep may not exist: the search has its own moves there)
    const S = sweep(...a, ...b, WAY.r);
    assert.ok(S && S.segs.length <= 3, 'a sweep there');
    const pts = sweepPoints(...a, S.segs, WAY.r), e = pts[pts.length - 1];
    assert.ok(Math.hypot(e[0] - b[0], e[1] - b[1]) < 0.02 && Math.abs(wrap(e[2] - b[2])) < 0.01, `it ends at the pose: ${e.map((v) => v.toFixed(2))} for ${b.map((v) => v.toFixed(2))}`);
    assert.ok(Math.abs(S.len - S.segs.reduce((n, g) => n + g[1], 0)) < 1e-9 && S.len >= Math.hypot(a[0] - b[0], a[1] - b[1]) - 1e-6, 'no shorter than straight there');
    for (const [kk] of S.segs) assert.ok([-1, 0, 1].includes(kk));
  }
});

// a way followed by the hand on the forklift's own numbers: -> where it ends, how near anything it came, whether it
// was ever stopped
function follow(way, from, W, s0 = {}) {
  const D = makeDrive({ ...from, ...s0 }), F = makeFollower(way); let worst = Infinity, what = '', off = 0, T = 0, stops = 0;
  for (let f = 0; f < 60 * 240 && !F.done; f++) {
    const c = F.cmd(D.s), ev = D.step({ go: c.go, turn: c.turn, forks: 0 }, 1 / 60, W); T += 1 / 60;
    if (ev.blocked) stops++;
    off = Math.max(off, c.off);
    const g = clearance(D.s, D.s, W); if (g.gap < worst) { worst = g.gap; what = g.what; }
  }
  return { s: D.s, done: F.done, worst, what, off, T, stops };
}

test('a way from its bay: to either end of every pallet waiting, to a container\'s doorway, clear of everything, and driven by the stick and the wheel alone', () => {
  const C = cargo(), W = C.world(), clear = clearOf(W, {}, WAY.margin);
  const goals = [];
  for (const p of W.pallets) for (const h of [p.h, p.h + Math.PI]) goals.push({ what: `${p.place} from ${h > 2 ? 'the north' : 'the south'}`, to: { ...beforePallet(p.at, wrap(h)), in: LOADER.in } });
  let found = 0;
  for (const G of goals) {
    const way = planWay(PARKED, G.to, clear);
    if (!way) continue;      // (an end with no room to come to it squarely is no way: the loader takes the other end)
    found++;
    // every point of it clear by the margin, each leg one direction, each point its distance along
    for (const leg of way.legs) {
      assert.ok(leg.dir === 1 || leg.dir === -1);
      for (let i = 1; i < leg.pts.length; i++) assert.ok(leg.pts[i][2] > leg.pts[i - 1][2] - 1e-9 && Math.hypot(leg.pts[i][0] - leg.pts[i - 1][0], leg.pts[i][1] - leg.pts[i - 1][1]) < 0.12, 'points a few centimetres apart, in turn');
    }
    const r = follow(way, PARKED, W);
    assert.ok(r.done && r.stops === 0, `${G.what}: driven to its end, never stopped (${r.what} ${r.worst.toFixed(2)})`);
    assert.ok(Math.hypot(r.s.x - G.to.x, r.s.z - G.to.z) < 0.08 && Math.abs(wrap(r.s.h - G.to.h)) < 0.05, `${G.what}: it ends squarely before the pallet: ${[r.s.x, r.s.z, r.s.h].map((v) => v.toFixed(2))} for ${[G.to.x, G.to.z, G.to.h].map((v) => v.toFixed(2))}`);
    assert.ok(r.worst > 0.04 && r.off < 0.3, `${G.what}: clear of everything (${r.worst.toFixed(2)} m from ${r.what}), on its way (${r.off.toFixed(2)} m off at most)`);
  }
  assert.ok(found >= W.pallets.length, `a way to an end of every pallet: ${found} of ${goals.length} ends`);
  // carrying a pallet from where one was taken up, to the place before each place inside the doors
  const C2 = cargo({ without: ['w3'] }), W2 = C2.world(), from = { x: 3.7, z: 15.6 + TRUCK.tips - 0.3, h: Math.PI / 2 };
  for (const q of BOX_PLACES) {
    const to = { ...beforePlace(q.at, q.ends[0]), in: LOADER.in }, way = planWay(from, to, clearOf(W2, { carry: 3 }, WAY.margin), { loose: clearOf(W2, { carry: 3 }, 0.005) });
    assert.ok(way, 'a way to before ' + q.id);
    const r = follow(way, from, W2, { carry: 3, lift: 0.14 });
    assert.ok(r.done && r.stops === 0 && Math.hypot(r.s.x - to.x, r.s.z - to.z) < 0.08 && Math.abs(wrap(r.s.h - Math.PI)) < 0.05, `before ${q.id}, facing its doors: ${[r.s.x, r.s.z, r.s.h].map((v) => v.toFixed(2))}`);
    assert.ok(Math.abs(r.s.z - q.at[1]) < 0.06, 'on the place\'s own line');
  }
});

test('a way home: from before any container, round to its bay and backed in as it parks', () => {
  const C = cargo({ moved: { w0: 'b0', w1: 'b1', w2: 'b2' } }), W = C.world();
  for (const q of BOX_PLACES) {
    const from = beforePlace(q.at, Math.PI), way = planWay(from, { ...PARKED, in: -LOADER.park }, clearOf(W, {}, WAY.margin));
    assert.ok(way, 'a way home from before ' + q.id);
    assert.equal(way.legs[way.legs.length - 1].dir, -1, 'its last leg backing');
    const r = follow(way, from, W);
    assert.ok(r.done && r.stops === 0 && inBay(r.s), `in its bay: ${[r.s.x, r.s.z, r.s.h].map((v) => v.toFixed(2))}`);
    assert.ok(r.worst > 0.04, `clear of everything on the way: ${r.worst.toFixed(2)} m from ${r.what}`);
    assert.ok(way.length < 60 && way.cusps <= 4, `no long way round: ${way.length.toFixed(1)} m, ${way.cusps} changes of direction`);
  }
});

test('a way is worked out a little at a time, and there is none out of a place it cannot leave', () => {
  const W = cargo().world(), clear = clearOf(W, {}, WAY.margin);
  const P = makePlan(PARKED, { ...beforePallet(placeOf('w3').at, Math.PI / 2), in: LOADER.in }, clear);
  let steps = 0; while (!P.step(0.5) && steps < 5000) steps++;
  assert.ok(P.done && P.way && steps < 5000, 'done in slices');
  // (wedged across an aisle between two racks, where it could never have been driven: no way, said at once)
  const zc = (RACKS.z[4] + RACKS.z[5]) / 2, stuck = planWay({ x: 12.4, z: zc, h: -Math.PI / 2 }, { ...PARKED, in: -LOADER.park }, clear, { loose: clearOf(W, {}, 0.005) });
  assert.equal(stuck, null);
  // (and a place something stands on is no place to go)
  assert.equal(planWay(PARKED, { x: placeOf('w1').at[0], z: placeOf('w1').at[1], h: 0 }, clear), null);
  // the map of the floor the search steers by: open floor has a distance, a rack has none, and round a rack is further than through it
  const far = roundMap(W, [22, 10]);
  assert.ok(far(22, 2) < Infinity && far(12, RACKS.z[3]) === Infinity);
  assert.ok(far(22.3, 4) > Math.hypot(0.3, 6) - 1 && far(4, 10) > 18, 'round the racks\' ends, not through them: ' + far(4, 10).toFixed(1));
});

// THE LOADER'S HAND on a forklift left at `start`: driven till it is parked or gives up. -> what happened
function load(start, want, { moved = {}, carry = null, people = [], under = false, most = 600 } = {}) {
  const C = cargo({ moved, people, without: carry ? [carry] : [] });
  const D = makeDrive({ ...start, carry: carry ? CARGO.pallets.findIndex((p) => p.at === carry) : null, lift: carry ? 0.14 : 0 }), L = makeLoader(), dt = 1 / 60;
  let T = 0, worst = Infinity, what = '', loaded = Object.values(moved).filter((b) => /^b/.test(b)).length;
  const order = [], cmds = new Set();
  for (let f = 0; f < 60 * most && !L.done && !L.failed; f++) {
    const W = C.world(), cmd = L.cmd(D, W, dt, { want: want - loaded });
    for (const k of Object.keys(cmd)) cmds.add(k);
    const ev = D.step(cmd, dt, W); L.after(ev);
    if (ev.took) C.here.delete(ev.took.place);
    if (ev.set) { C.here.set(ev.set, ev.placed.i); order.push(ev.set); if (/^b/.test(ev.set)) loaded++; }
    T += dt;
    // (how near anything it comes on its ways: going in under a pallet and in through a doorway it comes up against them)
    if (['go', 'home', 'back'].includes(L.phase)) { const g = clearance(D.s, D.s, { ...W, people: [] }); if (g.gap < worst) { worst = g.gap; what = g.what; } }
  }
  return { L, s: D.s, T, loaded, order, worst, what, here: C.here, cmds: [...cmds].sort() };
}

test('Cargo\'s loader loads the rest: every pallet wanted from the loading floor into the containers, in the order a run fills them, then parked in its bay', () => {
  for (const want of [3, 4]) for (const done of [0, 1, 2, want - 1]) {
    const moved = Object.fromEntries(['w0', 'w1', 'w2', 'w3'].slice(0, done).map((id, i) => [id, 'b' + i]));
    const r = load(PARKED, want, { moved });
    assert.ok(r.L.done && !r.L.failed, `${want - done} left of ${want}: parked (${r.L.failed || ''} ${r.L.log.join('; ')})`);
    assert.equal(r.loaded, want, 'every pallet wanted is in');
    assert.deepEqual(r.order, ['b0', 'b1', 'b2', 'b3'].slice(done, want), 'the places inside the doors, in the order a run fills them');
    assert.ok(inBay(r.s) && r.s.carry == null && r.s.under == null, 'in its bay, nothing on its forks');
    assert.equal(r.L.loaded, want - done);
    assert.ok(r.worst > -1e-6, `never into anything: ${r.worst.toFixed(3)} (${r.what})`);
    // (a watchable pace: about half a minute to three quarters a pallet, and the drive home)
    assert.ok(r.T > (want - done) * 15 && r.T < (want - done) * 60 + 90, `${want - done} pallets in ${r.T.toFixed(0)} s`);
    // (only what a player's thumbs give it: the stick, the wheel, the forks' buttons)
    assert.deepEqual(r.cmds, ['forks', 'go', 'turn']);
    assert.equal(r.L.fails, 0, 'nothing gone wrong on the way: ' + r.L.log.join('; '));
  }
});

test('the loader takes it as the player left it: anywhere, turned any way, a pallet on its forks (it goes in first), its forks in under one (it backs out first)', () => {
  const rnd = dice(2026), W0 = cargo().world();
  let tried = 0;
  for (let k = 0; tried < 14 && k < 400; k++) {
    const p = { x: -5 + rnd() * 28, z: -7 + rnd() * 42, h: rnd() * 6.28 - 3.14 }, carry = tried % 3 === 2 ? 'w3' : null;
    const W = cargo({ without: carry ? [carry] : [] }).world();
    // (a pose with a hand's room round it: one a player could have driven it to)
    if (clearance(p, { carry: carry ? 3 : null, under: null }, W).gap < 0.25) continue;
    // (not across an aisle between two racks: it could not have been driven there)
    if (p.x > RACKS.x0[1] - 1 && p.x < RACKS.x1 + 1 && p.z > RACKS.z[0] - 1 && p.z < RACKS.z[5] + 1) continue;
    tried++;
    const r = load(p, 3, { carry });
    assert.ok(r.L.done && r.loaded === 3 && inBay(r.s), `left at ${[p.x, p.z, p.h].map((v) => v.toFixed(1))}${carry ? ' carrying' : ''}: ${r.L.failed || ''} ${r.L.log.join('; ')}`);
    assert.ok(r.worst > -1e-6, 'never into anything');
    if (carry) assert.equal(r.order[0], 'b0', 'the pallet on its forks went in first');
  }
  assert.equal(tried, 14);
  // its forks left in under a pallet on the loading floor (all the way in, not lifted): out first, then on
  const q = placeOf('w1'), D0 = makeDrive({ x: q.at[0], z: q.at[1] + TRUCK.tips + 0.6 + 0.4, h: Math.PI / 2 }), W = cargo().world();
  for (let f = 0; f < 600; f++) D0.step({ go: 0.6, turn: 0, forks: 0 }, 1 / 60, W);
  assert.ok(D0.s.under != null, 'its forks in under one');
  const L = makeLoader(); let backed = false;
  for (let f = 0; f < 600 && !backed; f++) { const c = L.cmd(D0, W, 1 / 60, { want: 2 }); L.after(D0.step(c, 1 / 60, W)); if (L.phase === 'out' && c.go < 0) backed = true; }
  assert.ok(backed, 'it backs out from under it first');
  // left with a pallet on its forks in front of a container's doors, lined up: straight in and down, no way worked out first
  const b0 = placeOf('b0'), at = load({ ...beforePlace(b0.at, Math.PI, 0.9), z: b0.at[1] + 0.05 }, 3, { carry: 'w3' });
  assert.ok(at.L.done && at.loaded === 3 && at.order[0] === 'b0', 'the one on its forks into the place it was left before');
  // left lined up a little way before a pallet waiting: straight in under it
  const w2 = placeOf('w2'), near = load({ ...beforePallet(w2.at, Math.PI / 2, 0.5), x: w2.at[0] + 0.06 }, 1);
  assert.ok(near.L.done && near.loaded === 1 && !near.here.has('w2'), 'the pallet it was left before is the one it took');
});

test('someone in the loader\'s way: it waits for them, then backs off and goes round; no way at all: given up, not tried for ever', () => {
  // (someone stood on the open floor right on its way from the bay to the pallets)
  const r = load(PARKED, 1, { people: [[5.5, 26.5]] });
  assert.ok(r.L.done && r.loaded === 1, 'still loaded and parked: ' + (r.L.failed || '') + r.L.log.join('; '));
  const near = load(PARKED, 1, { people: [[7.9, 30.6]] });
  assert.ok(near.L.done && near.loaded === 1, 'someone right by its bay: ' + (near.L.failed || '') + near.L.log.join('; '));
  assert.ok(r.L.waits + near.L.waits >= 1, 'it waited behind one of them before going round');
  // (never nearer anyone's middle than the forklift's own rule: kit/forkliftdrive.js HAND.people)
  // wedged where it cannot move: given up after LOADER.tries, in a few seconds
  const zc = (RACKS.z[4] + RACKS.z[5]) / 2, stuck = load({ x: 12.4, z: zc, h: -Math.PI / 2 }, 2, { most: 120 });
  assert.ok(stuck.L.failed && !stuck.L.done && stuck.T < 30 && stuck.L.fails >= LOADER.tries, `given up in ${stuck.T.toFixed(0)} s: ${stuck.L.failed}`);
  // nothing to load and nothing on its forks: straight home
  const none = load({ x: 0, z: 22, h: 0 }, 0);
  assert.ok(none.L.done && none.order.length === 0 && inBay(none.s));
});

test('the supply run: got off before it is loaded, Cargo\'s loader is asked each frame; not come: as before; the player gone from Cargo: all at once; back on: the player\'s again', () => {
  const crew = { id: 'c1', name: 'Test', jobs: {} };
  let inBoxes = 0, asked = [], says = true, by = 0, forced = 0;
  const forklift = { hand: { on: false }, doors: null,
    stock: { count: () => inBoxes, loadOne: (feet, force) => { if (inBoxes >= 4) return false; inBoxes++; if (force) forced++; else by++; return true; }, putLoaded: () => 0, clearOf: () => true, ship: () => 0 },
    loader: { ask: (n) => { asked.push(n); return says; } } };
  const people = { list: [{ id: CARGO.loader, name: 'Otto' }] };
  const R = makeSupplyRun({ crew: () => crew, save: () => {}, forklift, people: () => people });
  const run = startRun(crew, { rand: () => 0.9 }); assert.equal(run.pallets, 4);
  R.worked();
  for (let i = 0; i < 30; i++) R.update(0.1, { inCargo: true });
  assert.equal(asked.length, 0, 'the player has not got off: nobody is asked');
  inBoxes = 1; R.update(0.1, { inCargo: true }); R.gotOff();
  assert.ok(R.handed && /Otto loads the rest/.test(R.line().title) && /other 3 pallets/.test(R.line().words) && /Otto drives/.test(R.line().words), R.line().title + ': ' + R.line().words);
  for (let i = 0; i < 60; i++) R.update(0.1, { inCargo: true });
  assert.ok(asked.length === 60 && asked.every((n) => n === 3) && by === 0, 'the loader is asked each frame for the 3 left, and nothing loads itself meanwhile');
  // (the loader drives one in)
  inBoxes = 2; R.update(0.1, { inCargo: true }); assert.equal(asked[asked.length - 1], 2);
  // back on before the loader has climbed on: the loading is the player's again
  R.gotOn(); assert.ok(!R.handed && !R.line());
  asked = []; for (let i = 0; i < 10; i++) R.update(0.1, { inCargo: true }); assert.equal(asked.length, 0);
  // off again; the loader does not come: the rest load themselves as before, a pallet at a time
  R.gotOff(); says = false;
  for (let i = 0; i < 20; i++) R.update(0.1, { inCargo: true });
  assert.ok(by >= 1 && by <= 2, 'one at a time, where nobody sees: ' + by);
  // the player gone from Cargo: whatever is left at once, the run done
  inBoxes = 2; by = 0; says = true; const b4 = asked.length;
  R.update(0.1, { inCargo: false });
  assert.ok(forced === 2 && inBoxes === 4 && asked.length === b4, 'all of the rest at once as Cargo is left');
  assert.ok(crew.jobs.cargo.run.done && runOf(crew) == null);
  // one pallet left: its words
  const c2 = { id: 'c2', name: 'T', jobs: {} }, R2 = makeSupplyRun({ crew: () => c2, save: () => {}, forklift: { ...forklift, stock: { ...forklift.stock, count: () => 2 } }, people: () => null });
  startRun(c2, { rand: () => 0 }); R2.worked(); R2.update(0.1, { inCargo: true }); R2.gotOff();
  assert.ok(/Cargo's loader loads the rest/.test(R2.line().title) && /the other pallet into/.test(R2.line().words), R2.line().words);
  // the loader is one of Cargo's own, the one who drives the forklift most (the one who tells of the lap)
  const who = ROOM_CREW.find((p) => p.id === CARGO.loader);
  assert.ok(who && who.place === 'store' && who.day.some((d) => d.do === 'drive:forklift') && CARGO.loader === LAP.who);
});

test('each crew member\'s own best official lap is kept with them; only official laps count; nothing is paid', () => {
  const crew = { id: 'a', name: 'Maya', credits: 500 };
  assert.equal(bestOf(crew), null); assert.equal(bestOf(null), null); assert.equal(bestOf({ jobs: { cargo: { lap: { best: 'x' } } } }), null);
  const off = keepLap(crew, { time: 36.7, official: false, missed: [2, 3] });
  assert.ok(off.best == null && !off.isNew && bestOf(crew) == null, 'a lap that is not official is not kept, however quick');
  const a = keepLap(crew, { time: 61.3, official: true }, 1000);
  assert.deepEqual(a, { best: 61.3, isNew: true, was: null });
  assert.deepEqual(crew.jobs.cargo.lap, { laps: 1, best: 61.3, at: 1000 });
  const slower = keepLap(crew, { time: 63.0, official: true }, 2000);
  assert.deepEqual(slower, { best: 61.3, isNew: false, was: 61.3 }); assert.equal(crew.jobs.cargo.lap.at, 1000);
  const same = keepLap(crew, { time: 61.3, official: true }, 3000);
  assert.ok(!same.isNew && crew.jobs.cargo.lap.at === 1000, 'the same to the tenth is not a new best');
  const better = keepLap(crew, { time: 56.84, official: true }, 4000);
  assert.deepEqual(better, { best: 56.8, isNew: true, was: 61.3 });
  assert.deepEqual(crew.jobs.cargo.lap, { laps: 4, best: 56.8, at: 4000 });
  assert.equal(crew.credits, 500, 'it pays nothing');
  assert.equal(seconds(56.8), '56.8'); assert.equal(seconds(65), '65.0');
  // (kept beside Cargo's other tally, the supply run's, and neither disturbs the other)
  const c2 = { id: 'b', name: 'Jo', jobs: {} }; startRun(c2); keepLap(c2, { time: 60, official: true });
  assert.ok(runOf(c2) && bestOf(c2) === 60);
  assert.ok(JSON.parse(JSON.stringify(crew)).jobs.cargo.lap.best === 56.8, 'it is plain numbers: saved as it is');
});

test('the board: the best official lap of the crew members on this device and whose it is; until someone beats him, the loader\'s', () => {
  const otto = { name: 'Otto', time: LAP.time };
  assert.deepEqual(boardOf([], otto), { name: 'Otto', time: 65, crew: false });
  assert.deepEqual(boardOf(null, otto), { name: 'Otto', time: 65, crew: false });
  const lap = (name, best, at) => ({ id: name, name, jobs: { cargo: { lap: { best, at, laps: 1 } } } });
  assert.deepEqual(boardOf([lap('Maya', 68.2, 1), { id: 'x', name: 'New' }], otto), { name: 'Otto', time: 65, crew: false }, 'nobody under his time yet');
  assert.deepEqual(boardOf([lap('Maya', 65.0, 1)], otto), { name: 'Otto', time: 65, crew: false }, 'the same as his is not a beat');
  assert.deepEqual(boardOf([lap('Maya', 64.9, 1)], otto), { name: 'Maya', time: 64.9, crew: true });
  assert.deepEqual(boardOf([lap('Maya', 58.1, 5), lap('Sam', 56.8, 9), lap('Ali', 70, 2)], otto), { name: 'Sam', time: 56.8, crew: true }, 'the best of them all');
  assert.deepEqual(boardOf([lap('Maya', 56.8, 5), lap('Sam', 56.8, 9)], otto), { name: 'Maya', time: 56.8, crew: true }, 'the same time: whoever drove it first');
  // WHERE IT IS: on the south wall behind the forklift's bay, between two of the wall's uprights, over the dark band
  const B = LAP.board, [fx0, fx1, , fz1] = FLOOR.forklift;
  assert.ok(B.x - B.w / 2 > fx0 && B.x + B.w / 2 < fx1, 'within the bay\'s width');
  assert.ok(STORE.z1 - fz1 < 3 && STORE.z1 - fz1 > 1.5, 'the wall the bay backs onto: ' + (STORE.z1 - fz1).toFixed(1) + ' m behind it');
  const n = Math.round((STORE.x1 - STORE.x0) / 2), w = (STORE.x1 - STORE.x0) / n, ups = Array.from({ length: n }, (x, i) => STORE.x0 + (i + 0.5) * w);
  for (const u of ups) assert.ok(Math.abs(u - B.x) > B.w / 2 + 0.03 + 0.055 || Math.abs(u - B.x) > 5, 'clear of the wall\'s uprights: ' + u.toFixed(2));
  assert.ok(B.y > BAND[1] + 0.05 && B.y + B.h < 3.2, 'over the dark band, under the panels\' top');
  assert.ok(B.w <= 2 && B.h <= 1.2, 'a small board');
  const [fw, fh, up] = B.face;
  assert.ok(fw < B.w - 0.1 && up - fh / 2 > 0.04 && up + fh / 2 < B.h - 0.25, 'the written panel inside it, under its title');
  assert.ok(WALL_FACE + 0.02 + B.out < 0.3, 'flat on the wall');
});

test('the lane: where the forklift comes round; the places to watch from are by the finish line, out of it', () => {
  // the lap's own line, start to start
  assert.equal(TRACK.pts.length, 6); assert.equal(TRACK.wide.length, 5);
  assert.ok(Math.abs(TRACK.length - 86.5) < 3, 'about the lap\'s measured length: ' + TRACK.length.toFixed(1));
  // in the lane: on the line, at each corner, by the racks on the last stretch, at the cold store doors
  for (const [x, z] of [[9, 22.9], [5.15, 10], [12, -3.05], [22.45, 8], [18, 22.9], ...LAP.corners, [18, 20.6], [23.4, 2], [23.4, 12]]) assert.ok(lapAt(x, z), `in the lane: ${x}, ${z}`);
  // not in it: the aisles between the racks, the loading floor by the containers and the pallets' north side, the benches, the desk, the bay, the scale
  for (const [x, z] of [[13, 1.95], [13, 16.95], [-2.3, 8], [1.5, 14.4], [-0.9, 27], [1.3, 32.6], [6.9, 32.9], [0.5, -1.7], [14.2, 30.2]]) assert.equal(lapAt(x, z), null, `not in the lane: ${x}, ${z}`);
  // how far round: the first stretch a few metres, the west ends, the first aisle, the east lane, the last stretch
  assert.ok(lapAt(9, 22.9).s < 6 && lapAt(5.15, 10).s > 15 && lapAt(5.15, 10).s < 25 && lapAt(12, -3.05).s > 35 && lapAt(22.45, 8).s > 60 && lapAt(18, 22.9).s > TRACK.length - 6);
  // THE PLACES: one for each of Cargo's people, in a row by the finish line's south end, out of the lane, a body's room
  // from the lift's wall and from each other, clear of the way from the bay up the lift's west side, facing the lane
  const crewN = ROOM_CREW.filter((p) => p.place === 'store').length, S = STOPS.find((s) => s.id === 'store'), lift = [S.at[0] - LIFT.half - LIFT.wall - 0.08, S.at[0] + LIFT.half + LIFT.wall + 0.08, S.at[2] - LIFT.half - LIFT.wall - 0.08, S.at[2] + LIFT.half + LIFT.wall + 0.08];
  assert.equal(LAP.watch.length, crewN, 'a place for each of them');
  LAP.watch.forEach(([x, z], i) => {
    assert.equal(lapAt(x, z), null, 'out of the lane');
    assert.ok(Math.hypot(x - LINE.at[0], z - LAP.lane[1]) < 2.8, 'by the finish line\'s south end: ' + Math.hypot(x - LINE.at[0], z - LAP.lane[1]).toFixed(1) + ' m');
    assert.ok(z > BOX.c[1] + 3, 'on the outside of the last stretch, well off the lap\'s own line');
    for (const b of roomBlocks()) assert.ok(boxGap(aabb('', [x - 0.01, x + 0.01, z - 0.01, z + 0.01]), aabb('', b.box)) > 0.3, 'a body\'s room from ' + b.what);
    assert.ok(lift[2] - z > 0.3 && lift[2] - z < 0.7 && x > lift[0] + 1 && x < lift[1] + 1, 'along the lift\'s north wall, a metre and more from its west corner (the forklift\'s way from its bay)');
    assert.ok(wallGap(x, z) > 2);
    if (i) assert.ok(Math.hypot(x - LAP.watch[i - 1][0], z - LAP.watch[i - 1][1]) >= 0.75 - 1e-9, 'a body\'s room apart');
  });
  assert.ok(Math.abs(Math.cos(LAP.look) + 1) < 1e-9, 'they face north, into the lane');
  // THEIR WAYS THERE keep off the lap's first two stretches (where the forklift comes first), not its last three
  for (const [x, z] of [[9, 22.9], [7, 24.5], [5.15, 18], [5.15, 2], [4, 10]]) assert.ok(keepOff(x, z), `kept off: ${x}, ${z}`);
  for (const [x, z] of [[12, -3.05], [22.45, 8], [18, 22.9], [16, 25], ...LAP.watch]) assert.ok(!keepOff(x, z), `may be walked: ${x}, ${z}`);
  // (and there is floor to walk that is in neither: from the benches' end along south of the lane to the row, and from
  // the last stretch round the start box's south side to the row)
  for (let x = -5.5; x <= 10.2; x += 0.2) assert.ok(!keepOff(x, 28.7) && !lapAt(x, 28.7), 'behind the benches, across to the lift\'s west side: ' + x.toFixed(1));
  for (let z = 26.4; z <= 28.7; z += 0.1) assert.ok(!keepOff(10.2, z), 'up the lift\'s west side to the row: ' + z.toFixed(1));
  for (let x = 13.4; x <= 17; x += 0.2) assert.ok(!keepOff(x, 25.9), 'from the last stretch to the row: ' + x.toFixed(1));
  for (let z = 2; z <= 28; z += 0.5) assert.ok(!keepOff(-2, z), 'down the loading floor, west of the pallets waiting: ' + z);
  // (the first corner taken wide, the forklift's back end swung out: the floor it sweeps is in the lane, and kept off)
  for (const [x, z] of [[6.4, 25.9], [3.0, 25.75], [2.2, 22.9], [6.9, 26.0]]) assert.ok(lapAt(x, z) && keepOff(x, z), `round the first corner: ${x}, ${z}`);
  for (const k of ['beat', 'slower', 'missed']) { assert.ok(LAP_TALK.cheer[k].length >= 2); for (const s of LAP_TALK.cheer[k]) assert.ok(s.length <= 40 && !/[{}]/.test(s), 'a short cheer: ' + s); }
});

test('the countdown waits while anyone is in the lane in the forklift\'s way, and only so long; with nobody in its way it begins at once', () => {
  const still = (x, z) => ({ at: [x, z], way: null, speed: 1.2 });
  assert.ok(clearToGo([]).clear);
  // standing in the lane: in its way, wherever on the lap
  assert.ok(!clearToGo([still(9, 22.9)]).clear && !clearToGo([still(22.45, 8)]).clear && clearToGo([still(22.45, 8)]).who === 0);
  // standing out of it: an aisle, the loading floor, the places to watch from
  assert.ok(clearToGo([still(13, 16.95), still(-2.3, 8), ...LAP.watch.map(([x, z]) => still(x, z))]).clear);
  // walking out of the lane just ahead: clear only if they are out before the forklift could be there
  const out = (from, to, speed) => ({ at: from, way: [to], speed });
  assert.ok(!clearToGo([out([9, 22.9], [9, 27.2], 0.5)]).clear, '5 m ahead, strolling out of the lane: not yet');
  assert.ok(clearToGo([out([9, 22.9], [9, 27.2], 2)]).clear, 'hurrying out of it, gone before it could come: go');
  assert.ok(clearToGo([out([9, 25.2], [9, 27.2], 1.2)]).clear, 'all but out of it already: go');
  // far round the lap, walking out of it long before the forklift could come: no wait for them
  assert.ok(clearToGo([out([22.45, 8], [19, 8], 1.2)]).clear, 'in the east lane, a few steps from an aisle: 60 m round');
  // walking toward the start along the lane, to be met head on: in its way
  assert.ok(!clearToGo([{ at: [5.15, 2], way: [[5.15, 22.9], [11, 26.25]], speed: 2 }]).clear, 'down the racks\' west ends toward the oncoming forklift');
  // crossing a lane far round, where the forklift cannot be for half a minute: clear
  assert.ok(!clearToGo([{ at: [13, -1.2], way: [[13, -3.05]], speed: 1.2 }]).clear, 'someone who stops in the first aisle is in its way');
  assert.ok(clearToGo([{ at: [20.5, 12], way: [[24.3, 12], [24.3, 30], [13.35, 26.25]], speed: 2 }]).clear, 'out of an aisle, down the east lane and round to the line, long before it comes');
  // THE LAP: stopped on the box with someone in its way: called, waiting (held), then the countdown as the lane clears
  const step = (L, clear, n = 1) => { let ev = {}; for (let i = 0; i < n; i++) { const e = L.step(START, 0, 1 / 60, { clear }); ev = { ...ev, ...e }; } return ev; };
  let L = makeLap(), ev = step(L, false, 30);
  assert.ok(ev.called && ev.wait && !ev.count && L.s.phase === 'wait' && L.held, 'called, and waiting, held still');
  ev = step(L, false, 120); assert.ok(L.s.phase === 'wait' && !ev.count && L.s.waited > 2 && L.s.waited < 2.3);
  ev = step(L, true, 1); assert.ok(ev.count === 3 && L.s.phase === 'count' && L.held, 'the lane clear: 3');
  ev = step(L, false, 60 * 3 + 2); assert.ok(ev.go && L.s.phase === 'run', 'and on to GO whatever comes after');
  // nobody in its way: no wait at all
  L = makeLap(); ev = step(L, true, 30); assert.ok(ev.called && ev.count === 3 && !ev.wait && L.s.waited === 0);
  // never longer than RULES.wait
  L = makeLap(); step(L, false, 30); ev = step(L, false, Math.round(RULES.wait * 60) + 2);
  assert.ok(ev.count === 3 && L.s.phase === 'count' && L.s.waited <= RULES.wait + 0.05 && RULES.wait <= 10, `the countdown begins after ${RULES.wait} s at most`);
  // got off while it waits: called off
  L = makeLap(); step(L, false, 30); assert.ok(L.cancel() && L.s.phase === 'idle');
  // a supply run worked out while it waits: called off
  L = makeLap(); step(L, false, 30); assert.equal(L.step(START, 0, 1 / 60, { can: false, clear: false }).off, 'cannot');
});

// the lap driven on the forklift's own numbers (tests/forklap.test.mjs's hand), with people standing in the room
function lapDriven(via, people, look = 1.8) {
  const C = cargo(), W = worldOf({ open: [], pallets: C.world().pallets, people });
  const a0 = axleOf(START), pts = [a0, ...via, [LINE.at[0] + BOX.f[0] * 3, via[via.length - 1][1]]], way = []; let S = 0;
  for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]], d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 0.05); for (let k = 0; k < n; k++) way.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, S + d * k / n]); S += d; }
  way.push([...pts[pts.length - 1], S]);
  const D = makeDrive(START), s = D.s, L = makeLap(); let j = 0, stops = 0, near = Infinity;
  for (let f = 0; f < 60 * 200; f++) {
    const [ax, az] = axleOf(s);
    while (j < way.length - 1 && Math.hypot(way[j + 1][0] - ax, way[j + 1][1] - az) <= Math.hypot(way[j][0] - ax, way[j][1] - az)) j++;
    let k = j; while (k < way.length - 1 && way[k][2] - way[j][2] < look) k++;
    const dx = way[k][0] - ax, dz = way[k][1] - az, a = wrap(Math.atan2(-dz, dx) - s.h);
    const turn = Math.max(-1, Math.min(1, -(2 * Math.sin(a) / Math.max(0.5, Math.hypot(dx, dz))) * HAND.turn));
    const ev = D.step({ go: L.held || L.s.phase !== 'run' ? 0 : 1, turn, forks: 0 }, 1 / 60, W);
    if (ev.blocked === 'someone') stops++;
    for (const [x, z] of people) near = Math.min(near, Math.hypot(x - s.x, z - s.z));
    const e2 = L.step(s, s.v, 1 / 60);
    if (e2.finish) return { ...e2.finish, stops, near };
  }
  return { time: null, stops, near };
}

test('with everyone watching from their places, nobody stops a lap: down the lane\'s middle, tight by the racks, or wide', () => {
  const z = BOX.c[1], [sw, nw, ne, se] = LAP.corners;
  const lines = {
    middle: LAP.corners,
    tight: [[9.5, 21.8], [5.25, 21.8], [5.25, -2.6], [21.2, -2.6], [21.2, 21.6], [LINE.at[0], 21.4]],
    wide: [[8.5, 24.3], [5.05, 24.3], [5.05, -3.7], [22.9, -3.7], [22.9, 24.4], [LINE.at[0], 24.6]],
  };
  for (const [name, via] of Object.entries(lines)) for (const look of [1.4, 1.8, 2.2]) {
    const r = lapDriven(via, LAP.watch, look);
    assert.ok(r.time && r.official, `${name}: a whole official lap: ${JSON.stringify(r)}`);
    assert.equal(r.stops, 0, `${name}, looking ${look} m ahead: never stopped by anyone`);
    assert.ok(r.near > 1.2, `${name}: the forklift's middle never nearer one of them than ${r.near.toFixed(2)} m`);
  }
  // (and the same lap with someone left standing in the lane IS stopped: the wait is what keeps a lap clean)
  assert.ok(lapDriven(LAP.corners, [[5.15, 10]]).stops > 0);
  assert.ok(sw && nw && ne && se && z);
});
