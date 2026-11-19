// Flying by hand (src/flymodel.js, src/flysolid.js): the plain part, checked against what the game's maker asked for.
// No browser: the ship's motion, the keys, what it bumps into, the station's area, the autopilot and the setting are
// plain numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../src/flymodel.js';
import * as W from '../src/wormplan.js';
import { stationSolid, bayOf, SKIN, capsOf } from '../src/flysolid.js';
import { OUTSIDE_BOX, DOOR, HANGARS, OPENINGS } from '../kit/outside-plan.js';
import { standElements, frameOf, into, outOf, yawOf as turnOf, isParked } from '../src/standing.js';
import { planCycle, valueAt, canAt, moveMounts } from '../kit/crane-plan.js';

const STATION = JSON.parse(readFileSync(new URL('../kit/rooms/station.json', import.meta.url), 'utf8'));
// (what the Miner bumps into, as the game makes it: its own bay, and the other two hangars' bays open to it)
const SOLID = stationSolid({ bay: bayOf(M.MINER.pad[2]), bays: M.OTHERS.map((o) => o.bay) });
const DT = 1 / 60;
const keys = (...k) => M.controlsOf(new Set(k));
const room = (S) => Math.min(...M.pointsOf(S).map((p) => SOLID.dist(p[0], p[1], p[2]))) - SKIN;      // how much room the ship has (0: touching)
const nose = (S) => M.turn(S.q, [1, 0, 0]);
// held for `secs`: the keys as a list of names, or the controls themselves
function hold(S, secs, C, solid = SOLID) { const c = Array.isArray(C) ? keys(...C) : C; for (let t = 0; t < secs - 1e-9; t += DT) M.stepShip(S, c, DT, solid); return S; }
// off its pad, hovering in the bay
function lifted() { const S = M.makeShip(); hold(S, 1.2, ['up']); hold(S, 1.5, []); return S; }
// the autopilot flown until its plan is done (or the ship is down); -> { secs, bumps, least }
function autofly(S, plan, most = 240) {
  let t = 0, bumps = 0, least = 99;
  while (t < most) {
    const C = M.fly(S, plan, DT);
    if (!C && !S.settle) break;
    M.stepShip(S, C || M.noControls(), DT, SOLID); t += DT;
    if (S.bump > 0) bumps++;
    least = Math.min(least, room(S));
    if (S.landed && t > 1 && plan.every((l) => l.down)) break;
  }
  return { secs: t, bumps, least };
}

test('the keys are the ones the game\'s maker gave', () => {
  assert.deepEqual([M.KEYS.KeyW, M.KEYS.KeyS, M.KEYS.KeyA, M.KEYS.KeyD], ['forward', 'reverse', 'left', 'right'], 'W and S forward and reverse, A and D strafe');
  assert.deepEqual([M.KEYS.Space, M.KEYS.KeyC], ['up', 'down'], 'Space up, C down');
  assert.deepEqual([M.KEYS.KeyQ, M.KEYS.KeyE], ['rollLeft', 'rollRight'], 'Q and E roll');
  assert.equal(M.KEYS.KeyF, 'mouse', 'F gives the mouse back and takes it');
  // what each does to the ship, off its pad: W goes the way the nose points, D to its right, Space up
  const go = (k) => { const S = lifted(), p0 = [...S.p]; hold(S, 1, [k]); return [S.p[0] - p0[0], S.p[1] - p0[1], S.p[2] - p0[2]].map((v) => Math.round(v * 100) / 100); };
  const w = go('forward'), s = go('reverse'), a = go('left'), d = go('right'), c = go('down');
  assert.ok(w[0] > 1 && Math.abs(w[1]) < 0.01 && Math.abs(w[2]) < 0.01, `W goes forward, out toward the bay door (${w})`);
  assert.ok(s[0] < -1 && Math.abs(s[2]) < 0.01, `S goes back (${s})`);
  assert.ok(d[2] > 1 && Math.abs(d[0]) < 0.01 && a[2] < -1, `D slides to the right and A to the left without turning (${d}, ${a})`);
  assert.ok(c[1] < -0.5, `C goes down (${c})`);
  // Q and E roll it about its nose; the nose stays where it points
  const S = lifted(); hold(S, 1, ['rollRight']);
  const up = M.turn(S.q, [0, 1, 0]);
  assert.ok(up[2] > 0.3 && Math.abs(nose(S)[0] - 1) < 1e-6, 'E rolls to the right, about the nose');
  const S2 = lifted(); hold(S2, 1, ['rollLeft']);
  assert.ok(M.turn(S2.q, [0, 1, 0])[2] < -0.3, 'Q rolls to the left');
});

test('Space lifts it off the pad and W takes it out through the bay door', () => {
  const S = M.makeShip();
  assert.ok(S.landed && !S.power, 'it starts on its pad with the power off');
  hold(S, 2, ['forward']);
  assert.deepEqual(S.p, M.MINER.pad, 'W on the pad does nothing: it has not lifted yet');
  hold(S, 1.2, ['up']);
  assert.ok(S.power && !S.landed && S.p[1] > 1, 'Space switches the power on by itself and lifts it');
  assert.ok(Math.abs(S.p[0] - M.MINER.pad[0]) < 1e-6 && Math.abs(S.p[2] - M.MINER.pad[2]) < 1e-6, 'straight up');
  hold(S, 1.2, []);
  let least = 99, bumps = 0;
  for (let t = 0; t < 6; t += DT) { M.stepShip(S, keys('forward'), DT, SOLID); least = Math.min(least, room(S)); if (S.bump) bumps++; }
  assert.ok(S.p[0] > DOOR.face + 30, `it is out of the door and on its way (x = ${S.p[0].toFixed(0)})`);
  assert.equal(bumps, 0, 'straight out of the door touches nothing');
  assert.ok(least > 0.2, `with room all round (${least.toFixed(2)} m)`);
});

test('the power is a switch on the pad, and never one in flight', () => {
  const S = M.makeShip();
  assert.equal(M.setPower(S, true), true); assert.equal(M.setPower(S, false), false);
  const F = lifted();
  assert.equal(M.setPower(F, false), true, 'in flight the power stays on: a ship never drifts off dead');
});

test('the ship steadies itself: keys let go, it slows to a stop and stays', () => {
  const S = lifted(); hold(S, 3, ['forward', 'right', 'up'], null);
  assert.ok(M.speedOf(S) > 15, 'it was moving');
  let t = 0; while (M.speedOf(S) > 0.01 && t < 20) { M.stepShip(S, M.noControls(), DT, null); t += DT; }
  assert.ok(t < 6, `it stops by itself in a few seconds (${t.toFixed(1)} s)`);
  const p = [...S.p]; hold(S, 30, [], null);
  assert.deepEqual(S.p.map((v) => +v.toFixed(4)), p.map((v) => +v.toFixed(4)), 'and does not drift');
  // at its fastest, from the top speed
  const T = lifted(); hold(T, 12, ['forward'], null);
  assert.ok(Math.abs(M.speedOf(T) - M.FEEL.speed.forward) < 0.5, 'it has a top speed');
  t = 0; while (M.speedOf(T) > 0.01 && t < 20) { M.stepShip(T, M.noControls(), DT, null); t += DT; }
  assert.ok(t < 5, `from its top speed it stops in ${t.toFixed(1)} s`);
  // its turning stops too
  const R = lifted(); hold(R, 1, { ...M.noControls(), turn: [1, 1], roll: 1 }, null); hold(R, 1.5, [], null);
  const q = [...R.q]; hold(R, 5, [], null);
  assert.ok(R.q.every((v, i) => Math.abs(v - q[i]) < 1e-4), 'let go, it holds its heading');
  assert.equal(M.speedWords(T), '0 m/s', 'the speed is shown as a plain number');
});

test('the mouse points the nose, and one setting flips up and down', () => {
  assert.ok(M.mouseTurn(0, -30)[0] > 0 && M.mouseTurn(0, 30)[0] < 0, 'the mouse pushed up the screen: nose up');
  assert.ok(M.mouseTurn(30, 0)[1] > 0, 'the mouse to the right: nose right');
  assert.ok(M.mouseTurn(0, -30, { invertY: true })[0] < 0 && M.mouseTurn(0, 30, { invertY: true })[0] > 0, 'flipped: pulled back, the nose goes up');
  assert.equal(M.mouseTurn(30, 0, { invertY: true })[1], M.mouseTurn(30, 0)[1], 'left and right are never flipped');
  assert.ok(Math.abs(M.mouseTurn(9000, 9000)[1]) <= M.FEEL.nudge, 'a wild sweep cannot spin it round in one frame');
  // the nose really goes there
  const S = lifted(); M.stepShip(S, { ...M.noControls(), nudge: M.mouseTurn(40, -40) }, DT, null);
  assert.ok(nose(S)[1] > 0.05 && nose(S)[2] > 0.05, 'up and to the right');
  // the mouse not held by the game, and the thumb sticks: from the middle
  assert.deepEqual(M.stickTurn(0.03, -0.03), [0, 0], 'a still middle');
  assert.ok(M.stickTurn(0, -0.8)[0] > 0.3 && M.stickTurn(0, -0.8, { invertY: true })[0] < -0.3, 'pushed up: nose up; flipped: nose down');
  assert.ok(M.stickTurn(0.8, 0)[1] > 0.3);
  const P = lifted(); hold(P, 1, { ...M.noControls(), turn: M.stickTurn(0.9, 0) }, null);
  assert.ok(nose(P)[2] > 0.3, 'held to the right, the nose comes round to the right');
});

test('the setting is kept with the crew member', () => {
  const crew = { id: 'p1', name: 'Maya' };
  assert.deepEqual(M.flyingOf(crew), { invertY: false }, 'off until asked for');
  M.setFlying(crew, { invertY: true });
  const back = JSON.parse(JSON.stringify(crew));
  assert.deepEqual(M.flyingOf(back), { invertY: true }, 'it comes back from the save');
  assert.deepEqual(M.flyingOf({ flying: 'nonsense' }), { invertY: false }); assert.deepEqual(M.flyingOf(null), { invertY: false });
  M.setFlying(back, { invertY: false }); assert.equal(back.flying.invertY, false);
});

test('the Miner\'s own facts match the station', () => {
  assert.deepEqual(M.MINER.pad, STATION.places.ships.miner.at, 'its pad is where the station file parks it');
  assert.equal(STATION.places.ships.miner.nose, '+x', 'parked nose out of the bay door, as the flying has it');
  assert.equal(M.MINER.pad[2], HANGARS[0].z, 'on its bay door\'s own line');
  // parked, it has room all round in its bay, its feet on the floor
  const S = M.makeShip(), pts = M.pointsOf(S), least = Math.min(...pts.map((p) => SOLID.dist(...p)));
  assert.ok(Math.abs(least - SKIN) < 0.03, `its feet are on the floor (${(least - SKIN).toFixed(3)} m)`);
  assert.ok(pts.filter((p) => p[1] > 0.1).every((p) => SOLID.dist(...p) - SKIN > 1), 'and the rest of it is clear');
  const wide = Math.max(...M.MINER.points.map((p) => Math.abs(p[2]))) * 2, tall = Math.max(...M.MINER.points.map((p) => p[1]));
  assert.ok(wide < DOOR.w - 6 && tall + M.MINER.hover < DOOR.h, 'it fits the bay door at the height it hovers');
});

test('bumping the station does no harm: it stops, or slides along', () => {
  // straight at the station's side, from outside (past the three hangar doors, where its side is a plain wall: the
  // posts between the doors are narrower than the ship, and it slips off one into a doorway)
  const S = M.makeShip(); M.place(S, [110, 4, 90], M.facing([-1, 0, 0]));
  let least = 99; for (let t = 0; t < 8; t += DT) { M.stepShip(S, keys('forward'), DT, SOLID); least = Math.min(least, room(S)); }
  assert.ok(least > -0.12, `it never goes into the wall (${least.toFixed(2)} m)`);
  assert.ok(S.p[0] > 45 && S.p[0] < 60 && M.speedOf(S) < 0.5, `it is stopped against it (x = ${S.p[0].toFixed(1)})`);
  assert.ok(S.power && !S.landed, 'and nothing else has happened to it');
  // at a slant: it slides along the wall
  const G = M.makeShip(); M.place(G, [110, 4, 10], M.facing([-1, 0, 0.45]));
  least = 99; for (let t = 0; t < 9; t += DT) { M.stepShip(G, keys('forward'), DT, SOLID); least = Math.min(least, room(G)); }
  assert.ok(least > -0.12, `at a slant it does not go in either (${least.toFixed(2)} m)`);
  // inside the bay: into the side, the roof and the floor
  for (const k of ['left', 'right', 'up', 'down', 'reverse']) {
    const B = lifted(); let l = 99; for (let t = 0; t < 6; t += DT) { M.stepShip(B, keys(k), DT, SOLID); l = Math.min(l, room(B)); }
    assert.ok(l > -0.06, `in the bay, held ${k}: it stops at the bay's edge (${l.toFixed(2)} m)`);
    assert.ok(Math.abs(B.p[2] - M.MINER.pad[2]) < DOOR.w / 2 && B.p[1] > -0.05 && B.p[1] < DOOR.h && B.p[0] > 20, `and is still in the bay (${B.p.map((v) => v.toFixed(1))})`);
  }
  // the windows are shut to it: every real opening but the three hangar doors is capped
  assert.equal(capsOf([DOOR.x + 0.02, HANGARS[0].z]).length, OPENINGS.length - 1, 'one door left open: every other opening is shut');
  assert.equal(capsOf(HANGARS.map((h) => [DOOR.x + 0.02, h.z])).length, OPENINGS.length - 3, 'the three hangar doors left open: the windows are still shut');
});

// ── THE OTHER TWO HANGARS (the game's maker, 2026-11-18: "Lol, I'm sure kids will try to do this and it will make them
// laugh, so why not. ... you would hear an alarm and red lights started spinning around in the hanger and people started
// running around and it started saying "Safety Violation" over and over in your cockpit. It would even be appropriate
// for the other ship to get moved around if they rammed it. But it would be reset the next time they entered into the
// other hanger. No need for damage or anything like that.") ──
// (the ships parked there, as things that can be shoved, and what the Miner bumps into with them in it)
const parkedOthers = () => { const L = M.OTHERS.map(M.makeOther); return { L, solid: { ...SOLID, push: (S) => M.pushOthers(S, L) } }; };
function holdWith(S, secs, C, W) { const c = Array.isArray(C) ? keys(...C) : C; for (let t = 0; t < secs - 1e-9; t += DT) { M.stepShip(S, c, DT, W.solid); for (const O of W.L) M.stepOther(O, DT); } return S; }
// every corner of a parked ship, in the station's frame
const cornersOf = (O) => { const c = Math.cos(O.yaw), s = Math.sin(O.yaw), out = []; for (const b of O.boxes) for (const x of [b.x0, b.x1]) for (const z of [-b.r, b.r]) out.push([c * x + s * z + O.p[0], -s * x + c * z + O.p[1]]); return out; };
const inItsBay = (O, slack = 0.01) => cornersOf(O).every(([x, z]) => x > O.cfg.bay.x0 - slack && x < DOOR.x + slack && z > O.cfg.bay.z0 - slack && z < O.cfg.bay.z1 + slack);

test('the ships parked in the other two hangars are where the station has them, and the size their own files say', () => {
  assert.deepEqual(M.OTHERS.map((o) => o.id), ['explorer', 'medic']);
  assert.equal(M.MINER.others, M.OTHERS, 'the Miner knows them');
  for (const o of M.OTHERS) {
    const place = STATION.places.ships[o.id];
    assert.deepEqual(o.at, place.at, `the ${o.name} is where the station file parks it`);
    assert.equal(place.nose, o.nose > 0 ? '+x' : '-x', `and its nose points the way the station file says (${place.nose})`);
    assert.ok(STATION.rooms.some((r) => r.id === o.room && r.with && r.with[0] === o.hangar), `it is the room ${o.room}, drawn with ${o.hangar}`);
    assert.equal(o.at[2], HANGARS.find((h) => h.id === o.hangar).z, 'on its own bay door\'s line');
    // its boxes cover its hull, as its own file measures it (the ship's frame there: x across, y up, z along), and no more than half a metre over
    const sp = JSON.parse(readFileSync(new URL(`../assets/ships/${o.id}-built.space.json`, import.meta.url), 'utf8'));
    const a0 = Math.min(...o.boxes.map((b) => b.a[0])), a1 = Math.max(...o.boxes.map((b) => b.a[1])), r = Math.max(...o.boxes.map((b) => b.r)), h = Math.max(...o.boxes.map((b) => b.h));
    assert.ok(a0 <= sp.min[2] + 0.1 && a0 > sp.min[2] - 0.5 && a1 >= sp.max[2] - 0.1 && a1 < sp.max[2] + 0.5, `the ${o.name}'s length (${a0} to ${a1}; its file: ${sp.min[2]} to ${sp.max[2]})`);
    assert.ok(r >= Math.max(-sp.min[0], sp.max[0]) - 0.1 && r < Math.max(-sp.min[0], sp.max[0]) + 0.5, `its half width (${r})`);
    assert.ok(h >= sp.max[1] - 0.1 && h < sp.max[1] + 0.5, `its height (${h}; its file: ${sp.max[1]})`);
    // parked, all of it is inside its bay with room to be shoved every way
    const O = M.makeOther(o);
    assert.ok(inItsBay(O, -2), 'parked, it is well inside its bay');
    assert.equal(M.otherStand(O), null); assert.equal(M.otherElements(O), null, 'and parked is no move at all');
  }
});

test('the other two bays can be flown into: their walls and the ship parked there stop the Miner, which is never down there', () => {
  for (const o of M.OTHERS) {
    const W = parkedOthers(), O = W.L.find((q) => q.cfg === o), zc = o.at[2];
    // in through the door on its middle line, slowly: it is in, and stops against the parked ship
    const S = M.makeShip(); M.place(S, [DOOR.face + 14, 2.6, zc], M.facing([-1, 0, 0]));
    let least = 99; for (let t = 0; t < 9; t += DT) { M.stepShip(S, { ...M.noControls(), move: [0.12, 0, 0] }, DT, W.solid); for (const q of W.L) M.stepOther(q, DT); least = Math.min(least, room(S)); }
    assert.ok(S.p[0] < DOOR.x - 1, `it flies in through the ${o.name}'s door (x = ${S.p[0].toFixed(1)})`);
    assert.ok(least > -0.06, `touching nothing of the hangar on the way (${least.toFixed(2)} m)`);
    assert.ok(!M.pointsOf(S).some((p) => M.insideOther(O, p, SKIN - 0.06)), 'and it is not inside the parked ship');
    assert.ok(O.moved && M.pointsOf(S).some((p) => M.insideOther(O, p, SKIN + 2.5)), 'it has come up against it');
    // a ship held still by its hangar's back wall stops it dead, as a wall does
    const W1 = parkedOthers(), O1 = W1.L.find((q) => q.cfg === o); O1.p[0] = o.at[0] - 30; O1.v = [-0.5, 0]; M.stepOther(O1, DT); O1.v = [0, 0]; O1.w = 0;      // (put past the wall and stepped once: the wall has it)
    const back = [...O1.p], P = M.makeShip(); M.place(P, [DOOR.x - 4, 2.6, zc], M.facing([-1, 0, 0]));
    for (let t = 0; t < 8; t += DT) { M.stepShip(P, keys('forward'), DT, W1.solid); for (const q of W1.L) M.stepOther(q, DT); }
    assert.ok(Math.abs(O1.p[0] - back[0]) < 0.02 && M.speedOf(P) < 0.6, `against the back wall the ${o.name} goes no further and the Miner is stopped (${M.speedOf(P).toFixed(2)} m/s)`);
    assert.ok(!M.pointsOf(P).some((p) => M.insideOther(O1, p, SKIN - 0.1)), 'outside it still');
    // the bay's side, its roof and its floor stop it as its own bay's do (the parked ship stood back out of the way)
    for (const k of ['left', 'right', 'up', 'down']) {
      const B = M.makeShip(); M.place(B, [DOOR.x - 8.5, 2.6, zc], M.facing([-1, 0, 0])); const W2 = parkedOthers(); W2.L.find((q) => q.cfg === o).p[0] -= 9.5;
      let l = 99; for (let t = 0; t < 6; t += DT) { M.stepShip(B, keys(k), DT, W2.solid); l = Math.min(l, room(B)); }
      assert.ok(l > -0.06, `in the ${o.name}'s bay, held ${k}: it stops at the bay's edge (${l.toFixed(2)} m)`);
      assert.ok(Math.abs(B.p[2] - zc) < DOOR.w / 2 && B.p[1] > -0.05 && B.p[1] < DOOR.h, `and is still in the bay (${B.p.map((v) => v.toFixed(1))})`);
      // SET DOWN THERE IT MAY REST, BUT IT IS NOT DOWN: no legs on another ship's floor, so the seat never lets the pilot out
      if (k === 'down') {
        hold(B, 2, [], W2.solid);
        assert.ok(B.p[1] < 0.05 && M.speedOf(B) < 0.01, `brought down, it rests on that floor (${B.p[1].toFixed(2)} m)`);
        assert.equal(B.landed, false, 'but it is not down');
        assert.equal(M.standing(B), null); assert.equal(M.canGetUp(B), false, 'and the seat does not let the pilot out');
        assert.equal(M.floorUnder(B), null, 'that floor is not its own');
        assert.equal(M.floorBelow(B), 0, 'though it is a floor, for whoever is under the ship');
        assert.ok(M.visiting(B) === o, 'and it is in that ship\'s hangar the while');
        assert.ok(!M.helpFor('fly', { getUp: M.canGetUp(B) }).some(([, w]) => /Get up/.test(w)), 'no "Get up" in the help corner either');
      }
    }
  }
});

test('the alarm\'s moment: in another ship\'s hangar from the first of the Miner over the door\'s line to the last of it out', () => {
  const S = M.makeShip();
  assert.equal(M.visiting(S), null, 'parked in its own hangar: no');
  const L = lifted(); assert.equal(M.visiting(L), null, 'hovering in its own bay: no');
  hold(L, 6, ['forward']); assert.equal(M.visiting(L), null, 'out through its own door: no');
  const noseAt = (x, z, f = [-1, 0, 0]) => { const T = M.makeShip(); M.place(T, [0, 2.6, z], M.facing(f)); const n = Math.min(...M.pointsOf(T).map((p) => p[0])); T.p[0] += x - n; return T; };
  for (const o of M.OTHERS) {
    const zc = o.at[2];
    assert.equal(M.visiting(noseAt(DOOR.x + 0.5, zc)), null, `nose half a metre short of the ${o.name}'s door line: no`);
    assert.equal(M.visiting(noseAt(DOOR.x - 0.5, zc)), o, 'nose half a metre over it: yes');
    assert.equal(M.visiting(noseAt(DOOR.x - 20, zc)), o, 'all the way in: yes');
    // backing out: on until the last of it is out (nose in, its nose is the last)
    const T = noseAt(DOOR.x - 8, zc); let last = null, flips = 0, was = true;
    for (let t = 0; t < 8; t += DT) { M.stepShip(T, keys('reverse'), DT, SOLID); const v = !!M.visiting(T); if (v !== was) { flips++; was = v; last = Math.min(...M.pointsOf(T).map((p) => p[0])); } }
    assert.equal(flips, 1, 'backing out it goes off once, and stays off');
    assert.ok(last > DOOR.x - 0.01 && last < DOOR.x + 1, `as the last of it crosses the line (${last.toFixed(2)})`);
    // beside the door, outside, against the hull: no
    assert.equal(M.visiting(noseAt(DOOR.face + 1.2, zc + 15)), null, 'outside, against the wall between two doors: no');
    // tail first counts just the same
    assert.equal(M.visiting(noseAt(DOOR.x - 18, zc, [1, 0, 0])), o, 'whichever way round it is');
  }
  // down on its own hangar's floor it is never in another's
  const D = M.makeShip(M.MINER, { p: [40, 0, -3], q: M.facing([0, 0, 1]) }); assert.equal(M.visiting(D), null);
});

test('a rammed ship is shoved along the floor and turned, slows by itself, stays in its hangar, and its reset puts it back', () => {
  for (const o of M.OTHERS) {
    const W = parkedOthers(), O = W.L.find((q) => q.cfg === o), zc = o.at[2];
    // straight in at a good speed, off its middle line: it is hit, slides and turns
    const S = M.makeShip(); M.place(S, [DOOR.face + 40, 2.6, zc + 3.5], M.facing([-1, 0, -0.12]));
    holdWith(S, 3.2, ['forward'], W);
    assert.ok(O.moved && O.hit > 3, `the ${o.name} was hit (at ${O.hit.toFixed(1)} m/s)`);
    const moved0 = Math.hypot(O.p[0] - o.at[0], O.p[1] - o.at[2]);
    assert.ok(moved0 > 0.5, `and shoved along the floor (${moved0.toFixed(1)} m so far)`);
    assert.ok(Math.hypot(O.v[0], O.v[1]) <= M.SHOVE.most + 1e-6 && Math.abs(O.w) <= M.SHOVE.spin + 1e-6, 'no faster than a shoved ship goes');
    // the Miner is unharmed and still flying: nothing else has happened to it
    assert.ok(S.power && !S.landed && S.p.every(Number.isFinite), 'the Miner flies on, nothing else has happened to it');
    // let go and backed off: it slows by itself and stops
    holdWith(S, 1.5, ['reverse'], W); holdWith(S, 6, [], W);
    assert.ok(M.otherStill(O), 'left alone it slows and stops by itself');
    // pushed on the side of its nose (or its tail: whichever end is toward the door), well off its middle: it turns
    M.place(S, [DOOR.x - 4, 2.6, zc + 7.5], M.facing([-1, 0, 0])); M.resetOther(O);
    // (nose in, its right is toward the hangar's middle line)
    holdWith(S, 4, ['right'], W); holdWith(S, 6, [], W);
    assert.ok(M.otherStill(O) && Math.abs(O.yaw) > 0.05, `turned by the bump (${(O.yaw * 180 / Math.PI).toFixed(1)} degrees)`);
    const E = M.otherElements(O), fr = frameOf(E);
    assert.ok(E && !isParked(E), 'where it stands is a move from where it is parked');
    assert.deepEqual([E[1], E[4], E[5], E[6], E[9], E[13]], [0, 0, 1, 0, 0, 0], 'a turn about straight up and a move across the floor: nothing tips');
    const [hx, hz] = outOf(fr, o.at[0], o.at[2]);
    assert.ok(Math.hypot(hx - O.p[0], hz - O.p[1]) < 1e-9, 'and that one move takes its pad\'s point to where it now stands');
    // shoved every way for a long time, it never leaves its bay nor passes the door's line
    for (const [from, f, secs] of [[[DOOR.face + 30, 2.6, zc], [-1, 0, 0], 12], [[DOOR.x - 6, 2.6, zc - 3], [-1, 0, 0.25], 10], [[DOOR.x - 6, 2.6, zc + 3], [-1, 0, -0.25], 10]]) {
      M.place(S, from, M.facing(f)); let worst = 99;
      for (let t = 0; t < secs; t += DT) { M.stepShip(S, keys('forward'), DT, W.solid); for (const q of W.L) M.stepOther(q, DT); worst = Math.min(worst, room(S)); assert.ok(inItsBay(O), `the ${o.name} stays in its bay (${cornersOf(O).map((c) => c.map((v) => v.toFixed(1)))})`); }
      assert.ok(worst > -0.12, `and the Miner is never squeezed into a wall by it (${worst.toFixed(2)} m)`);
      assert.ok(!M.pointsOf(S).some((p) => M.insideOther(O, p, SKIN - 0.1)), 'nor into it');
    }
    // the other hangar's ship has not been touched
    for (const q of W.L) if (q !== O) assert.ok(!q.moved && M.otherStand(q) === null, `the ${q.cfg.name} has not moved`);
    // THE RESET: back exactly where it is parked
    M.resetOther(O);
    assert.deepEqual([O.p, O.yaw, O.v, O.w, O.moved], [[o.at[0], o.at[2]], 0, [0, 0], 0, false]);
    assert.equal(M.otherElements(O), null, 'reset, it is exactly where it is parked');
  }
  // NOBODY IS HIT: it stops dead rather than come over someone standing on that floor
  {
    const W = parkedOthers(), O = W.L[0], zc = O.cfg.at[2], who = [O.cfg.at[0] - 11.5, zc + 1], S = M.makeShip(); M.place(S, [DOOR.face + 30, 2.6, zc], M.facing([-1, 0, 0]));
    for (let t = 0; t < 9; t += DT) { M.stepShip(S, keys('forward'), DT, W.solid); for (const q of W.L) M.stepOther(q, DT, q === O ? [who] : null); }
    assert.ok(O.moved && O.held > 0 && M.otherStill(O), 'rammed toward someone standing behind it, it is shoved, and stopped');
    assert.ok(O.p[0] < O.cfg.at[0] - 1 && M.insideOther(O, [who[0], 1, who[1]], M.SHOVE.person + 0.6), `just short of them (shoved ${(O.cfg.at[0] - O.p[0]).toFixed(1)} m)`);
    assert.ok(!M.insideOther(O, [who[0], 1, who[1]], M.SHOVE.person - 0.01), `never nearer than ${M.SHOVE.person} m, let alone over them`);
    assert.ok(M.speedOf(S) < 0.6 && !M.pointsOf(S).some((p) => M.insideOther(O, p, SKIN - 0.1)), 'and the Miner, pressing on, is stopped behind it');
    // they step away: it goes on to the wall
    holdWith(S, 5, ['forward'], W); assert.ok(Math.min(...cornersOf(O).map((c) => c[0])) < who[0] - 0.3, 'they gone, it can be shoved on');
    // someone standing under its wing, as people do when it is parked: it does not move at all until they have gone
    // (a wing's tip is lower than a head)
    const W2 = parkedOthers(), O2 = W2.L[0], wing = [O2.cfg.at[0] - 4, zc + 5.2]; M.place(S, [DOOR.face + 30, 2.6, zc], M.facing([-1, 0, 0]));
    assert.ok(M.insideOther(O2, [wing[0], 1, wing[1]], 0), '(they stand under its wing)');
    for (let t = 0; t < 6; t += DT) { M.stepShip(S, keys('forward'), DT, W2.solid); for (const q of W2.L) M.stepOther(q, DT, q === O2 ? [wing] : null); }
    assert.ok(O2.hits > 0 && O2.held > 0 && O2.p[0] === O2.cfg.at[0] && O2.p[1] === O2.cfg.at[2] && O2.yaw === 0, 'with someone under its wing it is hit and does not move');
    assert.ok(M.speedOf(S) < 0.6 && !M.pointsOf(S).some((p) => M.insideOther(O2, p, SKIN - 0.1)), 'the Miner stopped against it, as against a wall');
    holdWith(S, 3, ['forward'], W2); assert.ok(O2.p[0] < O2.cfg.at[0] - 1, `they gone, it is shoved (${(O2.cfg.at[0] - O2.p[0]).toFixed(1)} m)`);
  }
  // a gentle push moves it too, slowly: no ram is needed
  const W = parkedOthers(), O = W.L[0], S = M.makeShip(); M.place(S, [DOOR.x - 2, 2.6, O.cfg.at[2]], M.facing([-1, 0, 0]));
  holdWith(S, 5, { ...M.noControls(), move: [0.4, 0, 0] }, W);
  assert.ok(O.moved && O.p[0] < O.cfg.at[0] - 0.3, `pushed gently it gives way (${(O.cfg.at[0] - O.p[0]).toFixed(1)} m)`);
});

test('the autopilot never plans a way into another ship\'s hangar, and switched on in one it goes straight out', () => {
  // is a point in one of the other two bays (any of the box a ship can fly in, in from the door's line)?
  const inOther = (p) => M.OTHERS.find((o) => p[0] < DOOR.x && p[0] > o.bay.x0 - 1 && p[2] > o.bay.z0 && p[2] < o.bay.z1 && p[1] > -1 && p[1] < 12) || null;
  const along = (a, b, fn) => { const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]))); for (let i = 0; i <= n; i++) fn([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, a[2] + (b[2] - a[2]) * i / n]); };
  let rnd = 20261118; const R = () => (rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296;
  // from anywhere outside, and from its own bay: no leg of a landing or a leaving passes through either bay
  let tried = 0;
  for (let i = 0; i < 400; i++) {
    const S = M.makeShip();
    if (i % 5 === 0) M.place(S, [28 + R() * 30, 1 + R() * 2, M.MINER.pad[2] - 6 + R() * 12], M.facing([R() - 0.5, 0, R() - 0.5]));
    else M.place(S, [OUTSIDE_BOX.min[0] - 150 + R() * (OUTSIDE_BOX.max[0] - OUTSIDE_BOX.min[0] + 300), OUTSIDE_BOX.min[1] - 60 + R() * 250, OUTSIDE_BOX.min[2] - 150 + R() * (OUTSIDE_BOX.max[2] - OUTSIDE_BOX.min[2] + 300)], M.facing([R() - 0.5, R() * 0.2 - 0.1, R() - 0.5]));
    if (inOther(S.p)) continue;
    for (const plan of [M.planLand(S), M.planLeave(S)]) {
      let at = [...S.p];
      for (const leg of plan) { if (leg.down) continue; along(at, leg.to, (p) => assert.equal(inOther(p), null, `a leg from ${at.map((v) => v.toFixed(0))} to ${leg.to.map((v) => v.toFixed(0))} goes through another ship's hangar`)); at = leg.to; }
      tried++;
    }
  }
  assert.ok(tried > 700);
  // just outside each of the other doors, nose toward it: it turns away, never in
  for (const o of M.OTHERS) {
    const W = parkedOthers(), S = M.makeShip(); M.place(S, [DOOR.face + 14, 2.6, o.at[2]], M.facing([-1, 0, 0]));
    const plan = M.planLand(S, W.solid); let t = 0, seen = false;
    while (t < 200) { const C = M.fly(S, plan, DT); if (!C && !S.settle) break; M.stepShip(S, C || M.noControls(), DT, W.solid); t += DT; if (M.visiting(S)) seen = true; if (S.landed && t > 1) break; }
    assert.ok(M.onPad(S), `from the ${o.name}'s door it lands on its own pad`);
    assert.equal(seen, false, 'without ever going in');
  }
  // SWITCHED ON INSIDE ONE (flown in by hand): out through that hangar's own door, then home, touching nothing
  // (nose in through the door as far as the parked ship lets it; at a slant; tail first; and right inside, the parked
  // ship having been shoved to the back of its bay)
  for (const o of M.OTHERS) for (const [dx, dz, f, shoved] of [[0.2, 0, [-1, 0, 0], 0], [0.6, 2, [-1, 0, 0.3], 0], [2.6, -1.5, [1, 0, 0.2], 0], [-8, 1, [-1, 0, 0.1], 9.5], [-6.5, 0, [0.6, 0, 0.6], 9.5]]) {
    const W = parkedOthers(), O = W.L.find((q) => q.cfg === o), S = M.makeShip(); M.place(S, [DOOR.x + dx, 1.8, o.at[2] + dz], M.facing(f));
    O.p[0] -= shoved; const stood = [...O.p];
    assert.equal(M.visiting(S), o);
    assert.ok(!M.pointsOf(S).some((p) => M.insideOther(O, p, SKIN)), 'it starts clear of the parked ship');
    const plan = M.planLand(S, W.solid), out = M.outOfOtherBay(S);
    assert.ok(out && out.other === o && out.at[0] > DOOR.face + 12, 'it knows which hangar it is in, and where its door leaves it');
    // its first legs stay on a line through that bay's own door, and no later leg comes back into either bay
    let at = [...S.p];
    plan.forEach((leg, i) => { if (leg.down) return; along(at, leg.to, (p) => { const q = inOther(p); if (i < 2) assert.ok(q === null || q === o, 'out by its own door'); else assert.equal(q, null, 'and never back in'); }); if (i < 2) assert.ok(Math.abs(leg.to[2] - o.at[2]) < DOOR.w / 2 - 3.3, 'clear of the door\'s jambs'); at = leg.to; });
    let t = 0, bumps = 0, outAt = null, back = false;
    while (t < 240) { const C = M.fly(S, plan, DT); if (!C && !S.settle) break; M.stepShip(S, C || M.noControls(), DT, W.solid); for (const q of W.L) M.stepOther(q, DT); t += DT; if (S.bump > 0) bumps++; const v = M.visiting(S); if (!v && outAt == null) outAt = t; if (v && outAt != null) back = true; if (S.landed && t > 1 && plan.every((l) => l.down)) break; }
    assert.ok(M.onPad(S), `from inside the ${o.name}'s hangar the autopilot ends on its own pad (${S.p.map((v) => v.toFixed(1))})`);
    assert.equal(bumps, 0, 'touching nothing'); assert.ok(!O.moved && O.p[0] === stood[0] && O.p[1] === stood[1], 'the parked ship least of all');
    assert.ok(outAt != null && outAt < 12 && !back, `out of there in ${outAt && outAt.toFixed(1)} s and never back`);
  }
  // and leaving: out of that door, then clear of the station
  const W = parkedOthers(), S = M.makeShip(); M.place(S, [DOOR.x + 0.3, 2.2, M.OTHERS[1].at[2] + 1], M.facing([-1, 0, 0]));
  const plan = M.planLeave(S, W.solid); let t = 0;
  while (t < 120) { const C = M.fly(S, plan, DT); if (!C) break; M.stepShip(S, C, DT, W.solid); t += DT; }
  assert.ok(M.clearOf(S.p) && !W.L.some((q) => q.moved), `the autopilot leaves from in there too (${M.boxDist(S.p).toFixed(0)} m clear)`);
});

test('the ship\'s voice: the welcome once each sitting as the power comes on, "Safety violation" over and over in another hangar', () => {
  const run = (V, S, secs, there = null) => { const said = []; for (let t = 0; t < secs - 1e-9; t += DT) { const c = M.voiceStep(V, S, DT, there); if (c) said.push([c, +t.toFixed(2)]); } return said; };
  const S = M.makeShip(); let V = M.makeVoice();
  assert.deepEqual(run(V, S, 3), [], 'sat down, the power off: nothing is said');
  M.setPower(S, true);
  assert.deepEqual(run(V, S, 1).map((x) => x[0]), ['welcome'], 'the power comes on: the welcome, once');
  // lifting off, flying, landing and lifting off again: no more welcomes
  hold(S, 1.5, ['up']); assert.equal(S.landed, false);
  assert.deepEqual(run(V, S, 8), [], 'not at lift-off');
  M.park(S); assert.deepEqual(run(V, S, 2), []); hold(S, 1.5, ['up']); assert.deepEqual(run(V, S, 2), [], 'nor at the next one');
  // the power switched off and on again on the pad, the same sitting: still the once
  M.park(S); M.setPower(S, false); run(V, S, 1); M.setPower(S, true);
  assert.deepEqual(run(V, S, 5), [], 'once each time the pilot sits down, not every time the switch is thrown');
  assert.equal(V.said.welcome, 1);
  // the next time someone sits down: again
  V = M.makeVoice(); M.setPower(S, false); assert.deepEqual(run(V, S, 1), []); M.setPower(S, true);
  assert.deepEqual(run(V, S, 5).map((x) => x[0]), ['welcome']);
  // a crew member riding with the crew's pilot: the power comes on by itself as the autopilot lifts off, and it is said then
  const A = M.makeShip(), VA = M.makeVoice(), plan = M.planLeave(A); let first = null;
  for (let t = 0; t < 4; t += DT) { M.stepShip(A, M.fly(A, plan, DT) || M.noControls(), DT, SOLID); const c = M.voiceStep(VA, A, DT, null); if (c && first == null) first = c; }
  assert.equal(first, 'welcome'); assert.equal(VA.said.welcome, 1);
  // IN ANOTHER HANGAR: at once, then again and again with a short gap, and no more once it has left
  const o = M.OTHERS[0], period = M.VOICE.safety + M.VOICE.gap;
  const said = run(V, S, period * 4 - 0.1, o);
  assert.deepEqual(said.map((x) => x[0]), ['safety', 'safety', 'safety', 'safety'], 'over and over');
  assert.equal(said[0][1], 0, 'from the moment it is in');
  for (let i = 1; i < said.length; i++) assert.ok(Math.abs(said[i][1] - said[i - 1][1] - period) < 0.03, `one every ${period} s: the clip, then the gap`);
  assert.ok(M.VOICE.gap >= 0.8 && M.VOICE.gap <= 2.5, 'a short gap');
  assert.deepEqual(run(V, S, 20, null), [], 'out of there: no more');
  // flown in before the welcome is over: it waits for it
  const V2 = M.makeVoice(), early = run(V2, S, 5, o);
  assert.deepEqual(early.map((x) => x[0]), ['welcome', 'safety']); assert.ok(early[1][1] >= M.VOICE.welcome - 0.02, 'it does not talk over its own welcome');
});

test('the station\'s area: clear of it, the jump is offered', () => {
  assert.equal(M.clearOf(M.MINER.pad), false, 'not on the pad');
  assert.equal(M.clearOf([DOOR.face + 60, 3, -5]), false, 'not just outside the door');
  assert.equal(M.clearOf([OUTSIDE_BOX.max[0] + M.AREA.out + 1, 3, -5]), true, `${M.AREA.out} m from the station it is`);
  assert.equal(M.clearOf([40, OUTSIDE_BOX.max[1] + M.AREA.out + 1, 20]), true, 'above it too: any way out counts');
  // once offered it stays offered until the ship is well back in
  const edge = [OUTSIDE_BOX.max[0] + M.AREA.out - 5, 3, -5];
  assert.equal(M.clearOf(edge, false), false); assert.equal(M.clearOf(edge, true), true);
  assert.equal(M.clearOf([OUTSIDE_BOX.max[0] + M.AREA.back - 1, 3, -5], true), false);
  // coming home, the ship comes out in sight of the station, its nose toward its own door
  const A = M.arrival();
  assert.ok(A.p[0] > DOOR.face + 200 && A.p[0] < DOOR.face + 500 && A.p[2] === M.MINER.pad[2], 'out from its own bay door');
  assert.ok(M.turn(A.q, [1, 0, 0])[0] < -0.99, 'nose in');
  assert.equal(SOLID.clear(A.p, [DOOR.face + 2, M.MINER.hover + 2, M.MINER.pad[2]], 1), 1, 'with nothing between it and the door');
});

test('the autopilot lifts off, leaves through the door and stops clear of the station', () => {
  const S = M.makeShip(), plan = M.planLeave(S), r = autofly(S, plan);
  assert.equal(plan.length, 0, 'its plan is done');
  assert.equal(r.bumps, 0, 'it touches nothing: not the floor, not the door frame');
  assert.ok(r.least > 0.4 || r.least > -0.02, `least room on the way: ${r.least.toFixed(2)} m`);
  assert.ok(M.clearOf(S.p), `it ends clear of the station (${M.boxDist(S.p).toFixed(0)} m out)`);
  assert.ok(M.speedOf(S) < 1.5, 'and stopped there');
  assert.ok(r.secs > 6 && r.secs < 30, `in ${r.secs.toFixed(0)} s`);
  // through the door itself it is on the door's middle line, level, nose first
  const T = M.makeShip(), p2 = M.planLeave(T); let off = 0, tilt = 0;
  for (let t = 0; t < 30; t += DT) { M.stepShip(T, M.fly(T, p2, DT) || M.noControls(), DT, SOLID); if (Math.abs(T.p[0] - DOOR.x) < 6) { off = Math.max(off, Math.abs(T.p[2] - M.MINER.pad[2])); tilt = Math.max(tilt, 1 - nose(T)[0]); } }
  assert.ok(off < 0.05 && tilt < 0.002, `on the middle of the door, straight (${off.toFixed(3)} m off, ${tilt.toFixed(4)})`);
});

test('the autopilot comes in through the door and ends exactly on the pad', () => {
  const places = { 'where the jump home brings it out': M.arrival(), 'the dock side': { p: [-160, 30, 40], q: M.facing([0, 0, 1]) }, 'under the station': { p: [40, -150, 20], q: M.facing([1, 0, 0]) },
    'over the roof': { p: [40, 150, 20], q: M.facing([0, 0, -1]) }, 'beyond the far girder': { p: [45, 6, 260], q: M.facing([-1, 0, 0]) }, 'in the bay, nose in': { p: [50, 3, -5], q: M.facing([-1, 0, 0]) }, 'just outside the door': { p: [80, 5, -8], q: M.facing([0, 0, 1]) } };
  for (const [name, at] of Object.entries(places)) {
    const S = M.makeShip(); M.place(S, at.p, at.q);
    const r = autofly(S, M.planLand(S));
    assert.ok(S.landed, `from ${name}: it lands (${r.secs.toFixed(0)} s)`);
    assert.deepEqual(S.p, M.MINER.pad, `from ${name}: exactly on the pad`);
    assert.deepEqual(S.q, [0, 0, 0, 1], `from ${name}: turned nose out, as it is parked`);
    assert.equal(r.bumps, 0, `from ${name}: it touches nothing on the way`);
    assert.ok(r.secs < 120, `from ${name}: in good time (${r.secs.toFixed(0)} s)`);
  }
});

test('the autopilot can be switched on and off in flight', () => {
  // off half way out: the pilot has it; on again: it carries on from where the ship is
  const S = M.makeShip(); let plan = M.planLeave(S);
  for (let t = 0; t < 4; t += DT) M.stepShip(S, M.fly(S, plan, DT) || M.noControls(), DT, SOLID);
  assert.ok(!S.landed && S.p[0] > M.MINER.pad[0] + 3 && S.p[0] < DOOR.face + 30, 'part of the way out');
  hold(S, 2, ['left']); hold(S, 1.5, []);
  const r = autofly(S, M.planLeave(S, SOLID));
  assert.ok(M.clearOf(S.p) && r.bumps === 0, 'switched on again, it finishes the leaving without touching anything');
  // and a landing taken over by hand, then given back
  const L = M.makeShip(), A = M.arrival(); M.place(L, A.p, A.q); plan = M.planLand(L);
  for (let t = 0; t < 6; t += DT) M.stepShip(L, M.fly(L, plan, DT) || M.noControls(), DT, SOLID);
  hold(L, 3, ['up', 'right']); hold(L, 2, []);
  autofly(L, M.planLand(L, SOLID));
  assert.ok(L.landed && L.p.every((v, i) => v === M.MINER.pad[i]), 'it still ends on the pad');
});

// ── LANDING BY HAND (the game's maker, 2026-11-18: "I don't wan the ship taking over ... Even if they just come straight
// in and land it nose-in, that should be okay (as long as the ship is not upside down)") ──
const yawOf = (S) => Math.atan2(-nose(S)[2], nose(S)[0]) * 180 / Math.PI;      // (0: nose out of the door; 180: nose in)
const leaning = (deg, about = [1, 0, 0], f = [1, 0, 0]) => { const h = deg * Math.PI / 360, s = Math.sin(h); return M.qMul(M.facing(f), [about[0] * s, about[1] * s, about[2] * s, Math.cos(h)]); };
// brought down by C from where it hangs; -> seconds until it is down (or `most`)
function setDown(S, most = 12) { let t = 0; while (!S.landed && t < most) { M.stepShip(S, keys('down'), DT, SOLID); t += DT; } return t; }

test('nothing sets the ship down for a pilot flying by hand: it lands where and whichever way they put it', () => {
  // in nose first by keys, as a child would: forward, stop over the pad
  const S = M.makeShip(); M.place(S, [DOOR.face + 40, 3, -4], M.facing([-1, 0, 0]));
  let t = 0, bumps = 0;
  while ((S.p[0] > M.MINER.pad[0] + 0.8 || M.speedOf(S) > 0.4) && t < 60) { const left = S.p[0] - M.MINER.pad[0]; M.stepShip(S, keys(...(left > 0.8 && M.speedOf(S) < Math.min(6, left * 0.7) ? ['forward'] : [])), DT, SOLID); if (S.bump) bumps++; t += DT; }
  // low and slow over its own pad, level, hands off: exactly where the old self set-down took over
  // (C tapped: let go, the ship still sinks a little as it slows)
  while (S.p[1] > 0.9) M.stepShip(S, S.v[1] > -0.6 ? keys('down') : keys(), DT, SOLID);
  hold(S, 2, []);
  assert.ok(Math.hypot(S.p[0] - M.MINER.pad[0], S.p[2] - M.MINER.pad[2]) < M.SETTLE.reach && S.p[1] < M.SETTLE.low && M.speedOf(S) < 0.01, 'low, slow and level over its own pad');
  const was = { p: [...S.p], q: [...S.q] };
  hold(S, 8, []);
  assert.equal(S.settle, null, 'nothing begins to set it down');
  assert.ok(!S.landed, 'it is not down');
  assert.deepEqual(S.p.map((v) => +v.toFixed(4)), was.p.map((v) => +v.toFixed(4)), 'it has not been moved');
  assert.deepEqual(S.q.map((v) => +v.toFixed(5)), was.q.map((v) => +v.toFixed(5)), 'nor turned');
  // C brings it down onto the floor: there, as it is
  setDown(S);
  assert.ok(S.landed && S.p[1] === 0, 'C brings it down: it stands on the floor');
  assert.ok(Math.abs(S.p[0] - was.p[0]) < 1e-6 && Math.abs(S.p[2] - was.p[2]) < 1e-6, 'where the pilot put it, not on its parking place');
  assert.ok(Math.abs(Math.abs(yawOf(S)) - 180) < 0.01, 'still nose in: it has not been turned round');
  assert.ok(!M.onPad(S) && M.standing(S) === 'floor' && M.canGetUp(S), 'and the pilot may get up');
  assert.equal(bumps, 0, 'touching nothing on the way');
  // W on the floor does nothing, as on the pad; Space lifts it off again to be shuffled
  const at = [...S.p]; hold(S, 2, ['forward', 'left']);
  assert.deepEqual(S.p, at, 'down, W and A do nothing');
  hold(S, 1.2, ['up']); assert.ok(!S.landed && S.p[1] > 0.8, 'Space lifts it off again');
});

test('any heading on the hangar\'s floor counts as landed', () => {
  const F = M.MINER.floor;
  for (const [x, z, yaw] of [[42.3, -5, 37], [42.3, -5, 90], [36, -5, -135], [34, -9, 180], [45, -8, 12], [35, -4, -90]]) {
    const r = yaw * Math.PI / 180, S = M.makeShip(); M.place(S, [x, 1.2, z], M.facing([Math.cos(r), 0, -Math.sin(r)]));
    const secs = setDown(S);
    assert.ok(S.landed, `turned ${yaw} degrees at ${x}, ${z}: it is down (${secs.toFixed(1)} s)`);
    assert.ok(Math.abs(S.p[0] - x) < 1e-6 && Math.abs(S.p[2] - z) < 1e-6 && S.p[1] === 0, 'where it was put, on the floor');
    assert.ok(Math.abs(((yawOf(S) - yaw + 540) % 360) - 180) < 0.01, `still turned ${yaw} degrees (${yawOf(S).toFixed(2)})`);
    assert.equal(M.standing(S), 'floor'); assert.ok(M.canGetUp(S), 'the pilot may get up');
    assert.deepEqual(M.standOf(S), { p: S.p, q: S.q }, 'where it stands is kept');
  }
  // on its own parking place exactly, it is simply parked
  assert.equal(M.standOf(M.makeShip()), null); assert.equal(M.standing(M.makeShip()), 'pad');
  assert.ok(F.x[0] < M.MINER.pad[0] - 9 && F.x[1] > M.MINER.pad[0] + 6.8 && F.z[0] < M.MINER.pad[2] - 3.3 && F.z[1] > M.MINER.pad[2] + 3.3, 'its parking place is on that floor');
});

test('a small lean goes as its legs take the floor; rolled over too far it is not down', () => {
  // leaning 20 degrees (rolled), and nose down 15: its legs bring it level
  for (const [deg, about, words] of [[20, [1, 0, 0], 'rolled 20 degrees'], [-8, [0, 0, 1], 'its nose 8 degrees off level'], [8, [0, 0, 1], 'its nose 8 degrees off level the other way'], [M.LAND.tilt - 2, [1, 0, 0], 'just inside the limit']]) {
    const S = M.makeShip(); M.place(S, [40, 2.5, -3], leaning(deg, about, [-1, 0, 0]));
    assert.ok(Math.abs(M.tiltOf(S) - Math.abs(deg)) < 0.01);
    const secs = setDown(S);
    assert.ok(S.landed, `${words}: it is down (${secs.toFixed(1)} s)`);
    assert.ok(M.tiltOf(S) < 1e-6 && S.p[1] === 0, 'level on its legs, its feet on the floor');
    assert.ok(Math.abs(Math.abs(yawOf(S)) - 180) < 0.5, 'facing the way it was');
  }
  // rolled over too far: on the floor, but not down, and the seat keeps the pilot in
  assert.equal(M.LAND.tilt, 30, 'the number for "too much": 30 degrees from upright');
  for (const deg of [M.LAND.tilt + 3, 60, 90, 180]) {
    // (hung just clear of the floor, however it is rolled: the bay is only 8.4 m high inside)
    // (and brought onto it by whichever key now pushes it down: the keys follow the ship, however it is rolled)
    const q = leaning(deg), S = M.makeShip(); M.place(S, [40, 0.3 - Math.min(...M.MINER.points.map((pt) => M.turn(q, pt)[1])), -3], q); hold(S, 3, [deg === 90 ? 'right' : deg === 180 ? 'up' : 'down']);
    assert.ok(!S.landed && S.on, `rolled ${deg} degrees: it lies on the floor but is not down`);
    assert.ok(!M.canGetUp(S) && M.whyNot(S) === 'over', 'the seat does not let the pilot out');
    assert.ok(Math.abs(M.tiltOf(S) - deg) < 0.5, 'and nothing rights it for them: it stays as it was rolled');
    assert.ok(Math.min(...M.pointsOf(S).map((p) => p[1])) > -1e-6, 'none of it under the floor');
    // the guide lights the roll that would right it; rolled back by the pilot, it is down
    const g = M.guideOf(S); assert.ok(g.keys.rollLeft > 0.9 && g.keys.rollRight === 0, 'the guide lights Q, brightly');
    let t = 0; while (!S.landed && t < 8) { M.stepShip(S, keys('rollLeft', 'down'), DT, SOLID); t += DT; }
    assert.ok(S.landed && M.canGetUp(S), `rolled back with Q, it is down (${t.toFixed(1)} s)`);
  }
});

test('down too near the door or a wall for the crane, the seat does not let the pilot out', () => {
  // its nose still in the doorway: on the hangar's floor, but the crane's rails end short of the door
  const S = M.makeShip(); M.place(S, [52.5, 1, -5], M.facing([1, 0, 0])); setDown(S);
  assert.ok(S.landed, 'it is down on the floor');
  assert.equal(M.standing(S), 'edge'); assert.ok(!M.canGetUp(S) && M.whyNot(S) === 'edge', 'not where it can be unloaded');
  const g = M.guideOf(S);
  assert.ok(g.keys.up > 0 && g.keys.reverse > 0 && g.keys.forward === 0, 'the guide lights Space, to lift off, and S, the way to go');
  // against the wall of sockets
  const T = M.makeShip(); M.place(T, [40, 1, -11.8], M.facing([1, 0, 0])); hold(T, 4, ['left']); setDown(T);
  assert.ok(T.landed && M.standing(T) === 'edge', `hard against the bay's side (z = ${T.p[2].toFixed(1)}): too near the rack and the sockets`);
  // outside the hangar there is no floor of its own to stand on
  const O = M.makeShip(); M.place(O, [120, 2, -5], M.facing([-1, 0, 0])); hold(O, 6, ['down']);
  assert.ok(!O.landed && !O.on && M.floorUnder(O) == null && !M.canGetUp(O) && M.whyNot(O) == null, 'out in space: never down');
});

test('the floor it may be unloaded on: every tray is within the crane\'s reach, clear of the rack and the sockets', () => {
  // (the crane's places as the game finds them: tests/crane.test.mjs SITE; the mounts in the ship's own frame:
  // kit/ships/miner-built.hull.js CANISTER_AT, x to port and z to the nose, a tray sliding 1 m out sideways)
  const rail = { x: [21.1, 56.9], z: [-17.65, 7.65] }, can = { half: 1.088, arm: 0.57 };
  const rackFront = STATION.places.emptiesStack[2] + can.half, docked = STATION.places.sockets[0][2] + 2 * can.half - 0.4;
  const trays = []; for (const side of [-1, 1]) for (const a of [-1.722, -4.158]) trays.push([a, 3, side * (2.208 + 1.0)]);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let n = 0;
  for (let i = 0; i < 4000; i++) {
    const F = M.MINER.floor, yaw = rnd() * Math.PI * 2, S = M.makeShip();
    M.place(S, [F.x[0] + rnd() * (F.x[1] - F.x[0]), 0, F.z[0] + rnd() * (F.z[1] - F.z[0])], M.facing([Math.cos(yaw), 0, Math.sin(yaw)])); S.landed = true;
    if (M.standing(S) !== 'floor') continue;
    n++;
    for (const t of trays) {
      const q = M.turn(S.q, t), x = S.p[0] + q[0], z = S.p[2] + q[2];
      assert.ok(x >= rail.x[0] && x <= rail.x[1] && z >= rail.z[0] && z <= rail.z[1], `the hook reaches a tray at ${x.toFixed(1)}, ${z.toFixed(1)}`);
      // (the canister lying on it, along the ship, and the cradle's arms round it)
      for (const e of [-can.half, 0, can.half]) { const w = M.turn(S.q, [t[0] + e, t[1], t[2]]); assert.ok(S.p[2] + w[2] - can.arm > Math.max(rackFront, docked), 'clear of the rack of empties and the docked canisters'); }
    }
  }
  assert.ok(n > 400, `${n} landings tried, every way round`);
  // and the whole of that floor is inside its own bay
  const B = M.MINER.bay, F = M.MINER.floor;
  assert.ok(F.x[0] >= B.x0 && F.x[1] < DOOR.x && F.z[0] > B.z0 && F.z[1] < B.z1);
});

test('the autopilot still parks it exactly, and only while it is switched on', () => {
  const auto = { ...M.noControls(), auto: true, settle: true };
  // low over its pad with someone standing on it: it waits over it, and comes down once they have gone
  const W = M.makeShip(); M.place(W, [M.MINER.pad[0] + 0.5, 1.1, -5], M.facing([1, 0, 0])); W.padBusy = true;
  hold(W, 6, auto);
  assert.ok(!W.landed && W.settle && W.p[1] >= M.SETTLE.hold - 0.01, `someone on the pad: it waits ${W.p[1].toFixed(2)} m over it`);
  W.padBusy = false; hold(W, 4, auto);
  assert.ok(W.landed && M.onPad(W), 'the pad clear: down it comes, exactly as parked');
  // switched off half way through setting itself down: the pilot has it at once, where it is
  const X = M.makeShip(); M.place(X, [M.MINER.pad[0] + 2, 1.1, -4], M.facing([-1, 0, 0]));
  hold(X, 1.5, auto); assert.ok(X.settle && !X.landed, 'the autopilot is setting it down');
  const at = [...X.p]; hold(X, 5, []);
  assert.equal(X.settle, null); assert.ok(!X.landed, 'switched off: nothing goes on setting it down');
  assert.ok(Math.hypot(X.p[0] - at[0], X.p[2] - at[2]) < 0.3 && Math.abs(Math.abs(yawOf(X)) - 180) > 1, 'it stays where it had got to, part turned');
  // lifting off is never caught by it
  const U = M.makeShip(); hold(U, 4, ['up']);
  assert.ok(!U.landed && !U.settle && U.p[1] > 2, 'holding Space, it goes up');
  // from where a pilot left it standing crooked, the autopilot lifts it off and parks it properly
  const C = M.makeShip(); M.place(C, [38, 1, -4], M.facing([-0.6, 0, 0.8])); setDown(C);
  const stood = M.standOf(C); assert.ok(stood && !M.onPad(C) && M.standing(C) === 'floor');
  const again = M.makeShip(M.MINER, stood);
  assert.ok(again.landed && !M.onPad(again) && again.p[0] === stood.p[0] && again.p[2] === stood.p[2], 'the next flight starts from where it stands');
  const r = autofly(again, M.planLand(again));
  assert.ok(again.landed && M.onPad(again), `the autopilot parks it in its proper place (${r.secs.toFixed(0)} s)`);
  // and leaves the hangar from there, touching nothing
  const D = M.makeShip(M.MINER, stood), r2 = autofly(D, M.planLeave(D));
  assert.ok(M.clearOf(D.p) && r2.bumps === 0, `or flies it out from there (${r2.secs.toFixed(0)} s)`);
});

test('the guide: the keys that would bring the ship to its parking place, bright far off and dim close by', () => {
  const at = (p, f = [1, 0, 0], set) => { const S = M.makeShip(); M.place(S, p, M.facing(f)); return M.guideOf(S, set); };
  const lit = (g) => Object.entries(g.keys).filter(([, v]) => v > 0).map(([k]) => k).sort().join(' ');
  const P = M.MINER.pad;
  // on its parking place, nose out, a hair off the floor: nothing is lit
  assert.equal(lit(at([P[0], 0.1, P[2]])), ''); assert.ok(at([P[0], 0.1, P[2]]).done);
  // each key alone, the ship facing as it parks: the pad ahead is W, behind is S, to the left A, to the right D
  assert.equal(lit(at([P[0] - 5, 0, P[2]])), 'forward'); assert.equal(lit(at([P[0] + 5, 0, P[2]])), 'reverse');
  assert.equal(lit(at([P[0], 0, P[2] + 5])), 'left', 'the pad is to its left (toward -z, the ship facing +x)');
  assert.equal(lit(at([P[0], 0, P[2] - 5])), 'right');
  assert.equal(lit(at([P[0], 3, P[2]])), 'down', 'over it: C');
  // they follow the ship's own nose, as the keys do: turned nose in, the same place is the other key
  const g180 = at([P[0] + 5, 0, P[2]], [-1, 0, 0]);
  assert.ok(g180.keys.forward > 0 && g180.keys.reverse === 0, 'nose in, the pad ahead: W');
  assert.ok(g180.keys.noseRight > 0.99 || g180.keys.noseLeft > 0.99, 'and the heading asked for is nose out: the mouse\'s arrow is at its brightest');
  // really: holding what is lit brings it nearer
  const S = M.makeShip(); M.place(S, [P[0] + 7, 2, P[2] + 4], M.facing([-1, 0, 0.3]));
  const d0 = Math.hypot(S.p[0] - P[0], S.p[1] - P[1], S.p[2] - P[2]);
  for (let t = 0; t < 3; t += DT) { const k = M.guideOf(S).keys; M.stepShip(S, keys(...['forward', 'reverse', 'left', 'right', 'up', 'down'].filter((n) => k[n] > 0)), DT, null); }
  assert.ok(Math.hypot(S.p[0] - P[0], S.p[1] - P[1], S.p[2] - P[2]) < d0 * 0.5, 'holding the lit keys brings it toward its place');
  // and turning as the arrows say brings the nose round to the heading asked for
  const R = M.makeShip(); M.place(R, [P[0] + 1, 2, P[2]], M.facing([0.2, 0, 1]));
  for (let t = 0; t < 6; t += DT) { const k = M.guideOf(R).keys; M.stepShip(R, { ...M.noControls(), turn: [k.noseUp - k.noseDown, k.noseRight - k.noseLeft], roll: k.rollRight - k.rollLeft }, DT, null); }
  assert.ok(nose(R)[0] > 0.99, `the arrows bring the nose out toward the door (${nose(R).map((v) => v.toFixed(2))})`);
  // brightly when a lot is needed, dimly when it is close, dark when it is there
  const far = at([P[0] - 20, 0, P[2]]).keys.forward, mid = at([P[0] - 4, 0, P[2]]).keys.forward, close = at([P[0] - 0.5, 0, P[2]]).keys.forward, there = at([P[0] - 0.2, 0, P[2]]).keys.forward;
  assert.ok(far === 1 && mid < far && close < mid && close >= M.GUIDE.dim && there === 0, `W: ${far}, ${mid.toFixed(2)}, ${close.toFixed(2)}, ${there}`);
  let last = 2; for (let d = 30; d >= 0; d -= 0.5) { const v = at([P[0] - d, 0, P[2]]).keys.forward; assert.ok(v <= last + 1e-9, 'never brighter as it comes nearer'); last = v; }
  { const T = M.makeShip(); M.place(T, [P[0], 2, P[2]], leaning(25)); const k = M.guideOf(T).keys; assert.ok(k.rollLeft > 0.8 && k.rollRight === 0, 'rolled to the right: Q, brightly'); M.place(T, [P[0], 2, P[2]], leaning(5)); assert.ok(M.guideOf(T).keys.rollLeft < 0.4 && M.guideOf(T).keys.rollLeft > 0, 'nearly level: dimly'); }
  const lvl = at([P[0], 2, P[2]]); assert.equal(lvl.keys.rollLeft + lvl.keys.rollRight, 0, 'level: neither');
  // rolled over and facing the wrong way: only the roll is asked for, by the right key, until it is the right way up
  { const T = M.makeShip(); M.place(T, [P[0] + 2, 3, P[2]], leaning(70, [1, 0, 0], [-1, 0, 0])); const k = M.guideOf(T).keys;
    assert.equal(Object.entries(k).filter(([, v]) => v > 0).map(([n]) => n).join(), 'rollLeft', 'rolled over, nose in and off its place: Q alone, of all the keys'); assert.equal(k.rollLeft, 1);
    M.place(T, [P[0] + 2, 3, P[2]], leaning(-70, [1, 0, 0], [-1, 0, 0])); assert.ok(M.guideOf(T).keys.rollRight === 1 && M.guideOf(T).keys.rollLeft === 0, 'rolled the other way: E');
    M.place(T, [P[0] + 2, 3, P[2]], leaning(20, [1, 0, 0], [-1, 0, 0])); const k2 = M.guideOf(T).keys; assert.ok(k2.rollLeft > 0 && (k2.noseRight === 1 || k2.noseLeft === 1), 'nearly the right way up: the roll, and the heading too'); }
  // far out, coming home: the heading asked for is the way in (never "turn round" out there), W is bright, and off the
  // door's middle line the key that brings it back onto it is lit
  const A = M.arrival(), home = M.makeShip(); M.place(home, A.p, A.q);
  const gh = M.guideOf(home);
  assert.ok(!gh.near && gh.keys.forward === 1 && gh.keys.noseLeft === 0 && gh.keys.noseRight === 0, 'where the jump home brings it out: W, and the nose is right as it is');
  assert.ok(gh.keys.down > 0, 'a little high for the door: C');
  const off = at([DOOR.face + 60, 2, P[2] + 6], [-1, 0, 0]);
  assert.ok(off.keys.right > 0 && off.keys.left === 0, 'to one side of the door\'s middle line, flying in: D brings it back onto it');
  // "flip up and down": the mouse's arrows follow the setting; left and right never flip
  const dn = M.makeShip(); M.place(dn, [P[0] + 60, 3, P[2]], M.qMul(M.facing([-1, 0, 0]), [0, 0, Math.sin(-0.15), Math.cos(-0.15)]));
  const plain = M.guideOf(dn), flipped = M.guideOf(dn, { invertY: true });
  assert.ok(plain.keys.noseUp > 0 && plain.mouse.up > 0 && plain.mouse.down === 0, 'nose low: the mouse\'s up arrow');
  assert.ok(flipped.mouse.down > 0 && flipped.mouse.up === 0, 'flipped: its down arrow (pull back to climb)');
  // on a phone the same hint as one push of the left stick
  const st = at([P[0] - 6, 0, P[2] - 6]).stick;
  assert.ok(st.y < -0.5 && st.x > 0.5 && st.k > 0.5, 'the pad ahead and to the right: the stick pushed up and to the right');
  // the small space the model and its hologram share: true to size close by, never past its edge far off
  const m = M.makeShip(); M.place(m, [P[0] - 300, 0, P[2]], M.facing([1, 0, 0]));
  assert.ok(M.guideAt(m, P)[0] > 0.9 && M.guideAt(m, P)[0] < 1, 'far off, the goal is near the edge, ahead');
  M.place(m, [P[0] - 1, 0, P[2]], M.facing([1, 0, 0]));
  assert.ok(Math.abs(M.guideAt(m, P)[0] - 1 / (1 + M.GUIDE.space)) < 1e-9);
});

// ── EVERYTHING FOLLOWS THE SHIP AS IT LANDED (the game's maker, 2026-11-18: "if the pilot sets down and is still crooked
// then I would hope the crane can just compensate for it ... Once they leave the hanger and come back then the ship
// should be reset in it's proper parking spot") ──
// a ship set down by hand, crooked and off its parking place, as the tests above set one down
function crooked(at = [46.3, 1, -3.9], f = [-0.78, 0, 0.62]) { const S = M.makeShip(); M.place(S, at, M.facing(f)); setDown(S); assert.ok(S.landed && M.standing(S) === 'floor'); return S; }
// the crane's places in the Miner's hangar, as the game finds them from its pieces (typed as in tests/crane.test.mjs)
function craneSite() {
  const Q = Math.PI / 2, mounts = [], sockets = [], bays = [];
  for (const [z, out] of [[-7.208, -1], [-2.792, 1]]) for (const y of [3.764, 2.372]) for (const [x, yaw] of [[40.578, Q], [38.142, -Q]]) mounts.push({ at: [x, y, z], yaw, out: [0, out], upper: y > 3 });
  for (const x of [29, 31.5, 34, 36.5]) for (const y of [0.75, 2.2]) sockets.push({ at: [x, y, -18.16], n: [0, 1], upper: y > 1.5 });
  for (let j = 0; j < 8; j++) bays.push({ at: [46 + j * 1.15, 0.65, -16.8] });
  return { carry: 6.28, rail: { y: 8.52, x: [21.1, 56.9], z: [-17.65, 7.65] }, home: [21.5, -5], mounts, sockets, bays, can: { half: 1.088, seat: 0.4, clear: 0.45, rise: 0.9, lift: 0.09 } };
}

test('where a ship stands is one move from where it is parked: its hull, its cabin and its walls are all moved by it', () => {
  const S = crooked(), pad = M.MINER.pad, e = standElements(M.standOf(S), pad), fr = frameOf(e);
  assert.equal(e.length, 16); assert.ok(!isParked(e));
  // the point of it that stands on its pad's middle is where the pilot put it
  const mid = outOf(fr, pad[0], pad[2]); assert.ok(Math.abs(mid[0] - S.p[0]) < 1e-9 && Math.abs(mid[1] - S.p[2]) < 1e-9 && Math.abs(fr.y) < 1e-12, 'the middle of it');
  // every point of its hull as it is parked, moved, is that point of the ship as the flight model has it standing
  const there = M.pointsOf(S);
  M.MINER.points.forEach((pt, i) => { const w = outOf(fr, pad[0] + pt[0], pad[2] + pt[2]); assert.ok(Math.abs(w[0] - there[i][0]) < 1e-9 && Math.abs(w[1] - there[i][2]) < 1e-9, `hull point ${i}`); });
  // a person in the cabin of the ship as it stands is felt where they would be in the cabin as it is parked, and back
  for (const p of [[44.2, -4.1], [39.9, -6.6], [48, 2]]) { const q = into(fr, ...outOf(fr, ...p)); assert.ok(Math.abs(q[0] - p[0]) < 1e-9 && Math.abs(q[1] - p[1]) < 1e-9); }
  // it is turned as the ship is turned, about straight up and no other way
  assert.ok(Math.abs(turnOf(e) * 180 / Math.PI - yawOf(S)) < 1e-6, `turned ${yawOf(S).toFixed(1)} degrees`);
  assert.deepEqual([e[1], e[4], e[5], e[6], e[9]], [0, 0, 1, 0, 0], 'never tipped');
  assert.throws(() => standElements({ p: S.p, q: leaning(20) }, pad), /only turned about straight up/, 'a ship that leans is not standing');
  // parked in its proper place there is no move at all
  assert.equal(standElements(M.standOf(M.makeShip()), pad), null); assert.ok(isParked(null) && frameOf(null) === null);
  assert.deepEqual(outOf(null, 3, 4), [3, 4]); assert.deepEqual(into(null, 3, 4), [3, 4]);
  // the autopilot parks it exactly: nothing is left of the move
  const A = M.makeShip(M.MINER, M.standOf(S)); autofly(A, M.planLand(A));
  assert.equal(M.standOf(A), null, 'parked by the autopilot: its proper place again');
});

test('the crane\'s places on the ship follow it where it stands, and the whole round is worked there', () => {
  const S = crooked(), pad = M.MINER.pad, e = standElements(M.standOf(S), pad);
  const site = craneSite(), parked = site.mounts.map((m) => ({ ...m, at: [...m.at], out: [...m.out] }));
  site.mounts = moveMounts(parked, e);
  site.mounts.forEach((m, i) => {
    const b = parked[i];
    // each canister's middle and its tray slid out: the same point of the ship, as the flight model has the ship standing
    for (const k of [0, 1]) { const w = M.turn(S.q, [b.at[0] + b.out[0] * k - pad[0], b.at[1], b.at[2] + b.out[1] * k - pad[2]]), at = [m.at[0] + m.out[0] * k, m.at[1], m.at[2] + m.out[1] * k]; assert.ok(Math.hypot(at[0] - S.p[0] - w[0], at[1] - w[1], at[2] - S.p[2] - w[2]) < 1e-9, `mount ${i}${k ? ', its tray out' : ''}`); }
    // it still lies along the ship, and its tray still slides out sideways from it
    const lie = [Math.sin(m.yaw), Math.cos(m.yaw)], n = nose(S);
    assert.ok(Math.abs(Math.abs(lie[0] * n[0] + lie[1] * n[2]) - 1) < 1e-9, 'along the ship'); assert.ok(Math.abs(m.out[0] * n[0] + m.out[1] * n[2]) < 1e-9 && Math.abs(Math.hypot(...m.out) - 1) < 1e-9, 'its tray slides out sideways, as far as ever');
    assert.equal(m.upper, b.upper);
  });
  // THE ROUND, worked on the ship where it stands
  const plan = planCycle(site);
  assert.deepEqual(plan.phases.map((p) => p.name), ['unload', 'load', 'clear', 'done']);
  let off = 0;
  plan.cans.forEach((can, c) => {
    const first = can.spans.find((q) => q.where === 'held'), from = can.spans[0]; if (from.where !== 'mount') return;
    const m = site.mounts[from.i], t = first.t0, hook = [valueAt(plan.T.x, t), valueAt(plan.T.hoist, t), valueAt(plan.T.z, t)];
    // taken off its tray where the ship is, the cradle turned along it however it lies
    assert.ok(Math.hypot(hook[0] - m.at[0] - m.out[0], hook[1] - m.at[1] - site.can.lift, hook[2] - m.at[2] - m.out[1]) < 1e-6, `canister ${c}: the cradle is on its tray`);
    assert.ok(Math.abs(Math.sin(valueAt(plan.T.yaw, t) - m.yaw)) < 1e-6, 'turned along it'); assert.ok(valueAt(plan.T.tray[from.i], t) > 0.999, 'its tray out');
    off++;
  });
  assert.equal(off, 8, 'all eight come off the ship');
  // the hook never has to go where it cannot: every move of the round is inside the crane's reach
  for (let t = 0; t < plan.length; t += 0.5) { const x = valueAt(plan.T.x, t), z = valueAt(plan.T.z, t); assert.ok(x >= site.rail.x[0] - 1e-9 && x <= site.rail.x[1] + 1e-9 && z >= site.rail.z[0] - 1e-9 && z <= site.rail.z[1] + 1e-9, `the hook at ${x.toFixed(1)}, ${z.toFixed(1)}`); }
  // done: eight empties on the ship's mounts, where the ship stands, and the crane home
  const end = plan.cans.map((_, c) => canAt(plan, c, plan.length));
  assert.equal(end.filter((q) => q.where === 'mount').length, 8); assert.equal(end.filter((q) => q.where === 'bay').length, 8);
  assert.ok(Math.abs(plan.T.x.last - site.home[0]) < 1e-9 && Math.abs(plan.T.z.last - site.home[1]) < 1e-9);
  // nose in, across the bay, any way round on its floor: the same
  for (const f of [[-1, 0, 0], [0, 0, 1], [0.5, 0, -0.87]]) { const T = crooked([40, 1, -5.2], f), st = craneSite(); st.mounts = moveMounts(parked, standElements(M.standOf(T), pad)); const p2 = planCycle(st); assert.equal(p2.phases.length, 4); for (let t = 0; t < p2.length; t += 1) { const x = valueAt(p2.T.x, t), z = valueAt(p2.T.z, t); assert.ok(x >= st.rail.x[0] - 1e-9 && x <= st.rail.x[1] + 1e-9 && z >= st.rail.z[0] - 1e-9 && z <= st.rail.z[1] + 1e-9); } }
  // THE HANGAR SET OUT AFRESH (the player gone and come back): no move, and the mounts are exactly the parked ones
  assert.deepEqual(moveMounts(site.mounts.length ? parked : [], null), parked, 'back in its proper parking place');
  const again = craneSite(); again.mounts = moveMounts(parked, null);
  assert.ok(Math.abs(planCycle(again).length - planCycle(craneSite()).length) < 1e-9, 'and the round is the usual one');
});

test('the help corner changes with the mode, in plain words', () => {
  const seat = M.helpFor('seat'), fly = M.helpFor('fly'), ptr = M.helpFor('pointer'), watch = M.helpFor('watch', { auto: true }), crew = M.helpFor('watch', { pilot: false });
  const has = (rows, key) => rows.some(([k]) => k === key), says = (rows, re) => rows.some(([, w]) => re.test(w));
  assert.ok(has(seat, 'P') && has(seat, 'Space') && has(seat, 'T'), 'at the seat: the power, lift off, the autopilot');
  assert.ok(!has(seat, 'W S'), 'at the seat, not the flying keys yet');
  for (const k of ['W S', 'A D', 'Space C', 'Q E', 'T', 'V']) assert.ok(has(fly, k) && has(ptr, k), `flying: ${k}`);
  assert.ok(has(fly, 'Mouse') && says(fly, /nose/i) && says(fly, /buttons/i), 'the mouse flying: it points the nose, and F frees it for the buttons');
  assert.ok(!has(ptr, 'Mouse') && says(ptr, /Fly with the mouse/), 'the mouse as a pointer: F takes it back');
  assert.ok(says(watch, /autopilot is flying/i) && has(watch, 'T') && !has(watch, 'W S'), 'on autopilot: how to take it back');
  assert.ok(says(crew, /pilot is flying/i) && !has(crew, 'T') && has(crew, 'V'), 'riding along: only the views');
  assert.ok(has(M.helpFor('fly', { canJump: true }), 'J') && !has(fly, 'J'), 'the jump, when it is offered');
  assert.ok(has(M.helpFor('fly', { behind: true }), 'R') && !has(fly, 'R'), 'from behind: hold a key to look round');
  // a phone has no keys: the buttons and the sticks are named instead
  const tSeat = M.helpFor('seat', { touch: true }), tFly = M.helpFor('fly', { touch: true, canJump: true });
  assert.ok(has(tSeat, 'Power') && has(tSeat, 'Lift off') && has(tSeat, 'Autopilot') && !has(tSeat, 'P') && !has(tSeat, 'Space'));
  assert.ok(says(tFly, /Left stick/) && says(tFly, /Right stick/) && has(tFly, 'Jump') && !has(tFly, 'W S') && !has(tFly, 'F'));
  for (const rows of [seat, fly, ptr, watch, crew, tSeat, tFly]) for (const [, w] of rows) assert.ok(w.length <= 44 && !/pitch|yaw|strafe|throttle|toggle/i.test(w), `plain and short: "${w}"`);
});

// ── THE JUMP (src/wormplan.js) AND FLYING AT THE ROCKS ──
// The game's maker (2026-11-18): "Hopefully we can have some cool colorful plasma effect that looks like it rips open a
// wormhole in front of you and you see pretty colors until the destination scene is loaded and then appears in front
// of you." And of the rocks: "Either way, you should be able to click on an asteroid to travel over to it (If you want
// to fly and you signed up to be a pilot, you can click a button to fly manually if you want)."
// (ways out from the eye, all round: [the cosine of the angle from dead ahead, the angle round that line])
const WAYS = []; for (let i = 0; i < 400; i++) WAYS.push([1 - 2 * (i + 0.5) / 400, i * 2.399963]);
const seededRand = (n) => () => { n = (n * 1664525 + 1013904223) % 4294967296; return n / 4294967296; };

test('the jump: a tear ahead, the colours all round, the far end ahead, in that order, and never dark', () => {
  const J = W.makeJump(seededRand(3)), seen = [], events = [];
  let t = 0, coveredAt = {};
  while (J.phase !== 'done' && t < 20) {
    for (const ev of W.stepJump(J, DT, true)) events.push([ev, +t.toFixed(2)]);
    if (seen[seen.length - 1] !== J.phase) seen.push(J.phase);
    const n = WAYS.filter(([c, p]) => W.covered(J, c, p, t)).length;
    (coveredAt[J.phase] = coveredAt[J.phase] || []).push(n);
    t += DT;
  }
  assert.deepEqual(seen, ['rip', 'plunge', 'tunnel', 'open', 'done']);
  assert.deepEqual(events.map((e) => e[0]), ['shut', 'open', 'done'], 'the place is changed once, then the far end opens, then it is over');
  const all = W.JUMP.rip + W.JUMP.plunge + W.JUMP.least + W.JUMP.open;
  assert.ok(Math.abs(t - all) < 0.1 && all < 4, `with the place ahead ready a jump takes ${all} s: short`);
  // the tear starts as nothing and only grows; all through the tunnel every way out from the eye is covered
  assert.ok(coveredAt.rip[0] === 0 && coveredAt.rip[coveredAt.rip.length - 1] > 5, 'the tear opens from nothing');
  for (const ph of ['rip', 'plunge']) for (let i = 1; i < coveredAt[ph].length; i++) assert.ok(coveredAt[ph][i] >= coveredAt[ph][i - 1] - 6, `${ph}: the mouth only widens (but for its ragged edge)`);
  assert.ok(coveredAt.tunnel.every((n) => n === WAYS.length), 'in the tunnel the colours are all round: nothing of either place can be seen');
  assert.ok(coveredAt.open[coveredAt.open.length - 1] <= 2 && coveredAt.open[0] >= WAYS.length - 2, 'the far end opens from nothing until the colours are gone');
  // going in, it is dead ahead that is covered first and straight behind last; coming out, dead ahead is clear first
  const R = W.makeJump(seededRand(5)); R.t = W.JUMP.rip * 0.8;
  assert.ok(W.covered(R, 1, 0) && !W.covered(R, 0, 0) && !W.covered(R, -1, 0), 'the tear is in front of the ship');
  const O = W.makeJump(seededRand(5)); O.phase = 'open'; O.t = W.JUMP.open * 0.5;
  assert.ok(!W.covered(O, 1, 0) && W.covered(O, 0, 0) && W.covered(O, -1, 0), 'the place ahead appears in front of the ship');
  // the tear is a crack before it is a mouth: early on it is many times longer than it is wide
  const C = W.makeJump(() => 0.5); C.t = W.JUMP.rip * 0.3;
  const e = W.edgeOf(C); assert.ok(e.mode === 1 && e.slit < 0.15 && e.E > 0.05, 'a thin crack first');
  C.t = W.JUMP.rip * 0.99; assert.ok(W.edgeOf(C).slit > 0.97, 'pulled open round by the end of the rip');
});

test('the jump: the colours go on until the place ahead is made, and the place is changed only under them', () => {
  const J = W.makeJump(seededRand(9)); let ready = false, t = 0, shutAt = null, openAt = null;
  while (J.phase !== 'done' && t < 30) {
    for (const ev of W.stepJump(J, DT, ready)) { if (ev === 'shut') { shutAt = t; assert.ok(WAYS.every(([c, p]) => W.covered(J, c, p, t)), 'at the moment the place is changed every way out is covered'); } if (ev === 'open') openAt = t; }
    if (J.phase === 'tunnel') assert.ok(J.shut && WAYS.every(([c, p]) => W.covered(J, c, p, t)));
    if (t > 6) ready = true;      // (the place ahead takes six seconds to make)
    t += DT;
  }
  assert.ok(shutAt != null && openAt != null && openAt > 6 && openAt < 6.2, `the far end waited for the place ahead (opened at ${openAt && openAt.toFixed(2)} s)`);
  assert.ok(!J.shut, 'and once it is over the place is not to be changed');
  // never for ever: a place that never comes is opened on all the same
  const N = W.makeJump(seededRand(1)); let n = 0; while (N.phase !== 'done' && n < 60 * 60) { W.stepJump(N, 0.25, false); n++; }
  assert.equal(N.phase, 'done');
});

test('each jump has its own colours, swirl and slant, at no cost: a few plain numbers', () => {
  const r = seededRand(11), looks = Array.from({ length: 40 }, () => W.lookOf(r));
  for (const L of looks) assert.ok(L.hue >= 0 && L.hue < 1 && Math.abs(L.swirl) === 1 && Math.abs(L.slant) <= 0.56 && L.seed >= 0, JSON.stringify(L));
  assert.ok(new Set(looks.map((L) => L.hue.toFixed(2))).size > 25 && looks.some((L) => L.swirl > 0) && looks.some((L) => L.swirl < 0), 'they differ from jump to jump');
  // the look never changes what happens when
  const a = W.makeJump(seededRand(1)), b = W.makeJump(seededRand(2));
  for (let i = 0; i < 400; i++) { assert.deepEqual(W.stepJump(a, DT), W.stepJump(b, DT)); assert.equal(W.edgeOf(a).E, W.edgeOf(b).E); }
});

// (how near a rock's surface is to the ship's hull, taken as the box round its points; under 0: inside it)
function gapTo(S, R) {
  const l = M.unturn(S.q, [R.p[0] - S.p[0], R.p[1] - S.p[1], R.p[2] - S.p[2]]), c = [Math.max(-9, Math.min(6.8, l[0])), Math.max(0, Math.min(5.1, l[1])), Math.max(-3.3, Math.min(3.3, l[2]))];
  return Math.hypot(l[0] - c[0], l[1] - c[1], l[2] - c[2]) - R.r;
}
const fieldHold = (S, secs, k, rocks) => hold(S, secs, k, M.rockSolid(() => rocks));

test('at the rocks it is the same ship and the same keys, and there is nothing to land on', () => {
  const S = M.makeFieldShip([0, 0, 0], [0, 0, 1]);
  assert.ok(!S.landed && S.power && M.FIELD.bay === null && M.FIELD.floor === null && M.FIELD.others === null);
  assert.deepEqual(M.FIELD.points, M.MINER.points); assert.deepEqual(M.FIELD.seat, M.MINER.seat);
  fieldHold(S, 3, ['forward'], []);
  assert.ok(S.p[2] > 20 && Math.abs(S.p[0]) < 1e-6 && Math.abs(S.p[1]) < 1e-6, 'W takes it along its nose');
  fieldHold(S, 6, [], []); const at = [...S.p];
  fieldHold(S, 3, [], []); assert.deepEqual(S.p, at, 'keys let go, it stops and stays');
  fieldHold(S, 8, ['down'], []);
  assert.ok(!S.landed && S.p[1] < -30 && M.standing(S) === null && !M.canGetUp(S) && M.visiting(S) === null, 'held down for as long as you like it is never down: there is no floor out there');
  fieldHold(S, 2, M.controlsOf(new Set(['right'])), []); assert.ok(S.v[0] < -2, 'D slides it to its right');
  assert.equal(M.KEYS.KeyM, 'task');
});

test('a rock stops the ship or lets it slide round, with no damage, and is never inside its hull', () => {
  // dead ahead: it stops against it, and stays stopped for as long as W is held
  for (const r of [0.55, 1.0, 1.6]) {
    const S = M.makeFieldShip([0, 0, 0], [0, 0, 1]), rock = { id: 1, p: [0, 2.9, 60], r };
    fieldHold(S, 9, ['forward'], [rock]);
    assert.ok(gapTo(S, rock) > SKIN - 0.05 && gapTo(S, rock) < SKIN + 0.3, `a rock ${r} m across its half: held ${gapTo(S, rock).toFixed(2)} m off the hull`);
    assert.ok(M.speedOf(S) < 0.3 && S.p[2] < 60, 'stopped short of it');
  }
  // off its middle line: it slides round it and goes on
  { const S = M.makeFieldShip([0, 0, 0], [0, 0, 1]), rock = { id: 1, p: [3.6, 2.5, 40], r: 1 }; let least = 99;
    for (let t = 0; t < 9; t += DT) { M.stepShip(S, keys('forward'), DT, M.rockSolid(() => [rock])); least = Math.min(least, gapTo(S, rock)); }
    assert.ok(S.p[2] > 60 && least > SKIN - 0.06, `slid past (never nearer than ${least.toFixed(2)} m)`); }
  // a field of them, flown about for a minute any which way: no rock is ever in the hull
  const r = seededRand(21), rocks = [];
  for (let i = 0; i < 260; i++) rocks.push({ id: i, p: [(r() - 0.5) * 90, (r() - 0.5) * 36, 16 + r() * 110], r: 0.5 + r() * 1.2 });
  const S = M.makeFieldShip([0, 0, 0], [0, 0, 1]); let worst = 99, bumps = 0;
  for (let t = 0, C = keys('forward'); t < 60; t += DT) {
    if (Math.round(t / DT) % 90 === 0) { C = M.controlsOf(new Set(['forward', 'reverse', 'left', 'right', 'up', 'down', 'rollLeft'].filter(() => r() < 0.35))); C.turn = [r() * 2 - 1, r() * 2 - 1]; }
    M.stepShip(S, C, DT, M.rockSolid(() => rocks)); if (S.bump > 0) bumps++;
    for (const R of rocks) worst = Math.min(worst, gapTo(S, R));
  }
  assert.ok(worst > SKIN - 0.12, `never nearer than ${worst.toFixed(2)} m to any rock`);
  assert.ok(bumps > 0, 'and it did meet some');
  assert.ok(S.p.every(Number.isFinite) && S.q.every(Number.isFinite));
});

test('the claw takes a rock the ship has been brought up to, and not one it flies past', () => {
  const far = { id: 1, p: [0, 2.9, 60], r: 1 };
  const S = M.makeFieldShip([0, 0, 0], [0, 0, 1]);
  assert.equal(M.rockNear(S, [far]), null, 'nothing within reach');
  // flown up to it: taken, well before the hull meets it
  let took = null, t = 0;
  for (; t < 12 && !took; t += DT) { const d = far.p[2] - M.clawOf(S)[2]; M.stepShip(S, keys(...(d > 14 ? ['forward'] : [])), DT, M.rockSolid(() => [far])); took = M.rockNear(S, [far]); }
  assert.equal(took, far); assert.ok(M.speedOf(S) <= M.TAKE.slow && gapTo(S, far) > SKIN, 'slow, and not yet touching');
  const c = M.clawOf(S); assert.ok(Math.hypot(c[0] - far.p[0], c[1] - far.p[1], c[2] - far.p[2]) <= M.TAKE.reach);
  // slid past one at speed, the rock crossing just in front of the nose: not taken, however near the claw it came
  { const P = M.makeFieldShip([10, 0, 0], [0, 0, 1]), by = { id: 3, p: [0, 2.94, 9.6], r: 1 }; let any = null, least = 99;
    for (let t2 = 0; t2 < 4; t2 += DT) { M.stepShip(P, keys('right'), DT, M.rockSolid(() => [by])); const k = M.clawOf(P); least = Math.min(least, Math.hypot(k[0] - by.p[0], k[1] - by.p[1], k[2] - by.p[2])); any = any || M.rockNear(P, [by]); }
    assert.ok(least < 1.5 && P.p[0] < -8 && any === null, `passed ${least.toFixed(1)} m from the claw at speed: left alone`); }
  // pressed up against a rock of any size, nose on: it is within the claw's reach (so no rock is one the claw cannot get)
  // (anywhere on the nose: its middle, its corners)
  for (const r of [0.5, 0.8, 1.05, 1.6]) for (const y of [0.4, 2.9, 4.6]) for (const x of [0.6, -3.0]) {
    const Q = M.makeFieldShip([0, 0, 0], [0, 0, 1]), rock = { id: 2, p: [x, y, 30], r };
    fieldHold(Q, 6, ['forward'], [rock]);
    assert.equal(M.rockNear(Q, [rock]), rock, `a rock ${r} m, ${y} m up the nose, ${x} m across it`);
  }
  // but not one met by its side or its tail: the claw is at the nose
  { const Q = M.makeFieldShip([8, 0, 0], [0, 0, 1]), rock = { id: 4, p: [0, 2.5, -3], r: 1 };
    fieldHold(Q, 5, ['right'], [rock]);
    assert.ok(gapTo(Q, rock) < SKIN + 0.3 && M.rockNear(Q, [rock]) === null, 'pressed against its side: not taken'); }
  // of two in reach, the nearer to the claw's hand
  { const Q = M.makeFieldShip([0, 0, 0], [0, 0, 1]), k = M.clawOf(Q), a = { id: 'a', p: [k[0] + 2, k[1], k[2] + 1], r: 1 }, b = { id: 'b', p: [k[0] - 1, k[1], k[2] + 0.5], r: 1 };
    assert.equal(M.rockNear(Q, [a, b]), b); }
  assert.deepEqual(M.MINER.claw, [8.54, 2.94, 0]);
});

test('the help corner at the rocks: the same keys, the way back to the drill, no autopilot of its own', () => {
  const has = (rows, key) => rows.some(([k]) => k === key), says = (rows, re) => rows.some(([, w]) => re.test(w));
  const fly = M.helpFor('fly', { field: true, task: 'Back to the drill' }), ptr = M.helpFor('pointer', { field: true, task: 'Back to the drill', behind: true });
  for (const rows of [fly, ptr]) {
    for (const k of ['W S', 'A D', 'Space C', 'Q E', 'V', 'M']) assert.ok(has(rows, k), k);
    assert.ok(!has(rows, 'T') && !has(rows, 'P') && !has(rows, 'J') && !has(rows, 'Space'), 'no autopilot, power, jump or lift-off out there');
    assert.ok(says(rows, /claw takes it/) && says(rows, /Back to the drill/));
  }
  assert.ok(has(fly, 'Mouse') && has(ptr, 'F') && has(ptr, 'R'));
  const touch = M.helpFor('fly', { field: true, touch: true, task: 'Back to the drill' });
  assert.ok(says(touch, /Left stick/) && says(touch, /Right stick/) && has(touch, 'Back to the drill') && !has(touch, 'M') && !has(touch, 'Autopilot'));
  // riding (the pilot's seat left to the crew): only the views, as at the station
  const ride = M.helpFor('watch', { pilot: false, field: true });
  assert.ok(says(ride, /pilot is flying/i) && has(ride, 'V') && !has(ride, 'M'));
  for (const rows of [fly, ptr, touch]) for (const [, w] of rows) assert.ok(w.length <= 44 && !/pitch|yaw|strafe|throttle|toggle/i.test(w), `plain and short: "${w}"`);
});
