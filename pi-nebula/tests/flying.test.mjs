// Flying by hand (src/flymodel.js, src/flysolid.js): the plain part, checked against what the game's maker asked for.
// No browser: the ship's motion, the keys, what it bumps into, the station's area, the autopilot and the setting are
// plain numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../src/flymodel.js';
import { stationSolid, bayOf, SKIN, capsOf } from '../src/flysolid.js';
import { OUTSIDE_BOX, DOOR, HANGARS, OPENINGS } from '../kit/outside-plan.js';

const STATION = JSON.parse(readFileSync(new URL('../kit/rooms/station.json', import.meta.url), 'utf8'));
const SOLID = stationSolid({ bay: bayOf(M.MINER.pad[2]) });
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
  // straight at the wall beside the door, from outside
  const S = M.makeShip(); M.place(S, [110, 4, 10], M.facing([-1, 0, 0]));
  let least = 99; for (let t = 0; t < 8; t += DT) { M.stepShip(S, keys('forward'), DT, SOLID); least = Math.min(least, room(S)); }
  assert.ok(least > -0.12, `it never goes into the wall (${least.toFixed(2)} m)`);
  assert.ok(S.p[0] > DOOR.face + 5 && M.speedOf(S) < 0.5, `it is stopped against it (x = ${S.p[0].toFixed(1)})`);
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
  // the other hangars' doors are shut to it
  const H = M.makeShip(); M.place(H, [110, 4, HANGARS[1].z], M.facing([-1, 0, 0]));
  hold(H, 8, ['forward']);
  assert.ok(H.p[0] > DOOR.face + 5, 'it cannot fly into another ship\'s hangar');
  assert.equal(capsOf([DOOR.x + 0.02, HANGARS[0].z]).length, OPENINGS.length - 1, 'every real opening but its own door is shut');
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

test('flown in by hand: low and slow over its pad, it sets itself down where it is parked', () => {
  // in nose first by keys, as a child would: forward, down, stop over the pad
  const S = M.makeShip(); M.place(S, [DOOR.face + 40, 3, -4], M.facing([-1, 0, 0]));
  let t = 0, bumps = 0;
  // (W tapped as a child taps it: on while it is slower than the way left to go wants, off otherwise)
  while ((S.p[0] > M.MINER.pad[0] + 0.8 || M.speedOf(S) > 0.4) && t < 60) { const left = S.p[0] - M.MINER.pad[0]; M.stepShip(S, keys(...(left > 0.8 && M.speedOf(S) < Math.min(6, left * 0.7) ? ['forward'] : [])), DT, SOLID); if (S.bump) bumps++; t += DT; }
  assert.ok(Math.hypot(S.p[0] - M.MINER.pad[0], S.p[2] - M.MINER.pad[2]) < M.SETTLE.reach, `stopped over the pad, near enough (${(S.p[0] - M.MINER.pad[0]).toFixed(1)} m along, ${(S.p[2] - M.MINER.pad[2]).toFixed(1)} m across)`);
  assert.equal(S.settle, null, 'hovering at 3 m it does not land by itself');
  while (!S.landed && t < 80) { M.stepShip(S, S.settle ? M.noControls() : keys('down'), DT, SOLID); if (S.bump) bumps++; t += DT; }
  assert.ok(S.landed, 'C brings it down and it sets itself down');
  assert.deepEqual(S.p, M.MINER.pad, 'exactly on the pad');
  assert.deepEqual(S.q, [0, 0, 0, 1], 'turned nose out to the door, though it came in nose first');
  assert.equal(bumps, 0, 'touching nothing');
  // with someone standing on the pad it waits over it, and comes down once they have gone
  const W = M.makeShip(); M.place(W, [M.MINER.pad[0] + 0.5, 1.1, -5], M.facing([1, 0, 0])); W.padBusy = true;
  hold(W, 6, []);
  assert.ok(!W.landed && W.settle && W.p[1] >= M.SETTLE.hold - 0.01, `someone on the pad: it waits ${W.p[1].toFixed(2)} m over it`);
  W.padBusy = false; hold(W, 4, []);
  assert.ok(W.landed, 'the pad clear: down it comes');
  // off the pad's middle, or fast, or far, it does not
  const F = M.makeShip(); M.place(F, [M.MINER.pad[0] + 9, 0.6, -5], M.facing([1, 0, 0])); hold(F, 3, []);
  assert.ok(!F.landed && !F.settle, 'nine metres from the pad\'s middle is not over it');
  // lifting off is never caught by it
  const U = M.makeShip(); hold(U, 4, ['up']);
  assert.ok(!U.landed && !U.settle && U.p[1] > 2, 'holding Space, it goes up');
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
