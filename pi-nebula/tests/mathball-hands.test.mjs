// MATHBALL'S HANDS (src/mathball/hands.js): what a finger or the mouse on the court means. A tap on or near a ball
// picks it, a finger that wanders a few pixels is still a tap, a tap never throws by mistake, a drag never picks and is
// the only thing that turns the view (the game's maker, 2026-11-26: "no automatic rotations"). Each rule at its limit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HANDS, SPIN, makeSpin, makeHands, nearestBall, underAt, chooseTap, remember, pastOnScreen, viewTurn, turnToward, pushFor, canPick, canTap, inView, buttonDoes, mouthAt, lookRoundDue } from '../src/mathball/hands.js';

const W = 400;   // an upright phone's width (the left 42% is the walking stick's)
function press(H, { x = 300, y = 400, moveBy = 0, ms = 100, touch = true, button = 0, aimable = false, id = 1, steps = 4 } = {}) {
  const out = { turns: [], aims: 0 };
  H.down(id, { x, y, t: 0, touch, button, width: W, aimable });
  for (let i = 1; i <= steps; i++) {
    const r = H.move(id, x + moveBy * i / steps, y, ms * i / (steps + 1));
    if (r && r.turn) out.turns.push(r.turn); if (r && r.aim) out.aims++;
  }
  out.up = H.up(id, x + moveBy, y, ms);
  return out;
}
const withAim = (on, f) => { const was = HANDS.aimByRest; HANDS.aimByRest = on; try { f(); } finally { HANDS.aimByRest = was; } };

test('the tap\'s line for a finger: 12 px is a tap, past it a drag that turns the view and never taps', () => {
  for (const px of [0, 4, 9, 11, 12]) { const r = press(makeHands(), { moveBy: px }); assert.ok(r.up && r.up.tap, `${px} px: a tap`); assert.equal(r.turns.length, 0, `${px} px: no turn`); }
  for (const px of [12.01, 20, 60, -140]) {
    const r = press(makeHands(), { moveBy: px, steps: 8 });
    assert.equal(r.up, null, `${px} px: no tap`);
    if (Math.abs(px) > 13) assert.ok(r.turns.length > 0, `${px} px: it turned`);
  }
});

test('the tap\'s line for the mouse: 6 px; past it a drag; the right button drags but never clicks', () => {
  assert.ok(press(makeHands(), { touch: false, moveBy: 6 }).up.tap);
  const d = press(makeHands(), { touch: false, moveBy: 6.01 }); assert.equal(d.up, null);
  assert.ok(press(makeHands(), { touch: false, moveBy: 40 }).turns.length);
  assert.equal(press(makeHands(), { touch: false, button: 2 }).up, null);
  assert.ok(press(makeHands(), { touch: false, button: 2, moveBy: 40 }).turns.length);
});

test('a finger\'s tap lasts up to 0.8 s exactly; a mouse click has no time limit', () => {
  assert.ok(press(makeHands(), { ms: 800 }).up.tap, '0.8 s');
  assert.equal(press(makeHands(), { ms: 801 }).up, null, '0.801 s');
  assert.ok(press(makeHands(), { touch: false, ms: 60000 }).up.tap, 'a mouse held a minute');
});

test('a still press with a ball in hand is a tap, however long up to the limit: never an aim\'s throw', () => {
  for (const on of [false, true]) withAim(on, () => {
    const H = makeHands(); H.down(1, { x: 300, y: 500, t: 0, touch: true, width: W, aimable: true });
    H.tick(400);   // (with aimByRest on, a still finger begins to aim here)
    const up = H.up(1, 302, 501, 600);
    assert.ok(up.tap, `aimByRest ${on}: a tap, not { aimed }`);
  });
});

test('aiming by a rested finger is off: with a ball in hand a drag always turns the view (his question 2, A)', () => {
  assert.equal(HANDS.aimByRest, false);
  const H = makeHands(); H.down(1, { x: 300, y: 500, t: 0, touch: true, width: W, aimable: true });
  assert.deepEqual(H.tick(2000), []);
  const r = H.move(1, 360, 500, 2100); const r2 = H.move(1, 400, 500, 2150);
  assert.equal(r, null); assert.ok(r2.turn); assert.equal(H.up(1, 400, 500, 2200), null, 'and the lift throws nothing');
});

test('with aimByRest on (B): only a finger truly still for 0.28 s aims; a slow swipe turns the view', () => withAim(true, () => {
  const H = makeHands(); H.down(1, { x: 300, y: 500, t: 0, touch: true, width: W, aimable: true });
  H.move(1, 302, 501, 100); assert.equal(H.tick(HANDS.hold - 1).length, 0); assert.equal(H.tick(HANDS.hold).length, 1, 'still: it aims');
  assert.ok(H.move(1, 340, 450, 400).aim); assert.equal(H.dragging, false); assert.ok(H.aiming);
  assert.ok(H.up(1, 345, 440, 500).aimed);
  // a slow start: 5 px by 150 ms (past the 4 px of still), 10 px by 270 ms: no aim at 300 ms, and moving on turns
  const S = makeHands(); S.down(1, { x: 300, y: 500, t: 0, touch: true, width: W, aimable: true });
  S.move(1, 305, 500, 150); S.move(1, 310, 500, 270);
  assert.equal(S.tick(300).length, 0, 'not still: no aim');
  assert.equal(S.move(1, 320, 500, 320), null); assert.ok(S.move(1, 340, 500, 350).turn);
}));

test('the walking stick never turns the view; its quick tap still picks; a pinch neither turns nor taps', () => {
  const walk = press(makeHands(), { x: 60, y: 600, moveBy: 50 });
  assert.equal(walk.turns.length, 0); assert.equal(walk.up, null);
  assert.ok(press(makeHands(), { x: 60, y: 600, moveBy: 5 }).up.tap);
  const H = makeHands();
  H.down(1, { x: 250, y: 300, t: 0, touch: true, width: W }); H.down(2, { x: 350, y: 500, t: 10, touch: true, width: W });
  assert.equal(H.move(1, 200, 300, 50), null); assert.equal(H.up(1, 200, 300, 80), null); assert.equal(H.up(2, 350, 500, 90), null);
  // (a second finger ends an aim: the arc must go: nothing aims any more)
  withAim(true, () => { const A = makeHands(); A.down(1, { x: 300, y: 500, t: 0, touch: true, width: W, aimable: true }); A.tick(300); assert.ok(A.aiming); A.down(2, { x: 350, y: 300, t: 310, touch: true, width: W }); assert.equal(A.aiming, false); });
  // (the page lost the focus: every pointer let go)
  const R = makeHands(); R.down(1, { x: 300, y: 400, t: 0, touch: false, width: W }); R.move(1, 360, 400, 10); R.reset(); assert.equal(R.move(1, 400, 400, 20), null);
});

test('nearestBall: within 44 px of a ball\'s edge for a finger (22 for the mouse), exactly at the limit', () => {
  const ball = [{ id: 1, x: 100, y: 300, r: 10 }];
  assert.equal(nearestBall(154, 300, ball, HANDS.reach.touch).id, 1, '44 px from the edge');
  assert.equal(nearestBall(154.01, 300, ball, HANDS.reach.touch), null);
  assert.equal(nearestBall(132, 300, ball, HANDS.reach.mouse).id, 1, '22 px');
  assert.equal(nearestBall(132.01, 300, ball, HANDS.reach.mouse), null);
  // the nearer edge wins, of balls of two sizes
  const two = [{ id: 'far', x: 100, y: 300, r: 6 }, { id: 'near', x: 170, y: 300, r: 50 }];
  assert.equal(nearestBall(112, 300, two, 44).id, 'far', '6 px from the small one\'s edge, 8 from the big one\'s');
  // where it was as the finger came down
  assert.equal(nearestBall(190, 300, [{ id: 7, x: 260, y: 300, r: 10, x0: 190, y0: 300 }], 44).id, 7);
});

test('underAt: inside a disc, the one most nearly in the middle; in the margin, the nearest edge; inside beats margin', () => {
  assert.equal(underAt(0, 0, [{ id: 'small', x: 14, y: 0, r: 6 }, { id: 'big', x: 80, y: 0, r: 70 }], 16), 'small', '8 px from the small edge, 10 from the big');
  assert.equal(underAt(0, 0, [{ id: 'far', x: 10, y: 0, r: 6 }, { id: 'near', x: 55, y: 0, r: 40 }], 16), 'far');
  assert.equal(underAt(0, 0, [{ id: 'in', x: 30, y: 0, r: 31 }, { id: 'margin', x: 7, y: 0, r: 6 }], 16), 'in', 'inside beats a nearer margin');
  assert.equal(underAt(250, 300, [{ id: 1, x: 200, y: 300, r: 14 }, { id: 2, x: 260, y: 300, r: 30 }], 16), 2);
  const one = [{ id: 1, x: 0, y: 0, r: 10 }];
  assert.equal(underAt(26, 0, one, HANDS.onIt.touch), 1, '16 px from the edge'); assert.equal(underAt(26.01, 0, one, HANDS.onIt.touch), null);
});

test('where balls were is kept in the court: after a turn of the view, it is put through the camera as it is now', () => {
  const hist = [];
  // a camera that looks along yaw: a point on the court to the screen (x across, y fixed); yaw turns the picture
  const cam = (yaw) => (p) => { const a = Math.atan2(p[0], p[2]) - yaw; return Math.abs(a) > 1.2 ? null : [200 + a * 300, 400]; };
  remember(hist, 0, [{ id: 'A', p: [0, 0.25, 5] }], HANDS.past);
  remember(hist, 0.1, [{ id: 'A', p: [0, 0.25, 5] }], HANDS.past);
  // the view turned 0.5 rad by a swipe: ball A, never moved, now shows at 200 - 150 = 50; its past is there too
  const past = pastOnScreen(hist, cam(0.5));
  for (const s of past.get('A')) assert.ok(Math.abs(s[0] - 50) < 1e-6, 'not at the middle, where it showed before the turn');
  // a tap at the middle (where A was on the screen BEFORE the turn) is nowhere near it now
  assert.equal(nearestBall(200, 400, [{ id: 'A', x: 50, y: 400, r: 10, past: past.get('A') }], HANDS.reach.touch), null);
  // kept a third of a second
  remember(hist, 0.5, [{ id: 'A', p: [0, 0.25, 5] }], HANDS.past); assert.ok(hist.every((f) => 0.5 - f.t <= HANDS.past));
});

test('the order of a tap\'s rules (chooseTap): empty hands and a ball in hand; ball, goal, floor; on, beside, in reach', () => {
  const T = (o) => chooseTap({ touch: true, ...o });
  // empty hands
  assert.deepEqual(T({ under: 3, hitBall: 4 }), { pick: 3 }, 'the ball under the finger as it came down first');
  assert.deepEqual(T({ hitBall: 4, near: { id: 5, d: 0 } }), { pick: 4 });
  assert.deepEqual(T({ near: { id: 5, d: 44 } }), { pick: 5 }, 'in reach, 44 px');
  assert.equal(T({ near: { id: 5, d: 44.01 } }), null);
  assert.deepEqual(T({ hitGoal: 1 }), { say: 'ball first' });
  assert.equal(T({}), null, 'the floor: nothing');
  // a ball in hand
  assert.deepEqual(T({ held: true, underIn: 3, under: 3, hitGoal: 1 }), { pick: 3 }, 'a tap truly ON a ball (inside it) swaps for it');
  assert.deepEqual(T({ held: true, hitBall: 4, hitGoal: 1 }), { pick: 4 });
  assert.deepEqual(T({ held: true, near: { id: 5, d: 0 }, hitGoal: 1 }), { throw: 1 }, 'a ball that rolled through the spot a moment ago: the goal');
  assert.deepEqual(T({ held: true, under: 3, near: { id: 3, d: 9 }, hitGoal: 1 }), { throw: 1 }, 'a ball at the goal\'s foot, the tap just beside it: the goal');
  assert.deepEqual(T({ held: true, under: 3, goalBy: 2 }), { throw: 2 }, 'beside a goal too');
  // (holding a ball, only a ball the finger is inside swaps: never one within 16 px, nor where a ball was)
  assert.equal(T({ held: true, under: 3 }), null, 'a ball 10 px off: nothing');
  assert.equal(T({ held: true, near: { id: 5, d: 0 } }), null, 'a ball that crossed the spot a moment ago: nothing');
  assert.equal(T({ held: true, near: { id: 5, d: 30 } }), null, 'a ball merely in reach never drops the one in hand');
  assert.equal(T({ held: true, spot: true }), null, 'a finger on the floor: nothing (never a throw by mistake)');
  assert.deepEqual(chooseTap({ held: true, touch: false, spot: true }), { toss: true }, 'the mouse: a click on the floor throws there');
  assert.deepEqual(chooseTap({ held: true, touch: false, hitBall: 5, spot: true }), { pick: 5 }, 'the mouse on a ball: that ball');
  assert.deepEqual(chooseTap({ held: true, touch: false, near: { id: 5, d: 2 }, spot: true }), { toss: true }, 'the mouse beside a ball: the floor');
});

test('inside two overlapping discs, the nearer ball (drawn on top) is the one tapped', () => {
  const near = { id: 'near', x: 100, y: 300, r: 40, depth: 3 }, far = { id: 'far', x: 135, y: 300, r: 8, depth: 12 };
  assert.equal(underAt(134, 300, [far, near], 0), 'near', 'on the far ball\'s middle, but the near ball is in front');
  assert.equal(underAt(134, 300, [near, far], 0), 'near');
  assert.equal(underAt(142, 300, [near, far], 16), 'far', 'past the near ball\'s edge, inside only the far one');
});

// THE CAMERA (camera.js) over the reviewer's grid (every half metre inside, every quarter metre along each wall 0.45 m
// in, corners, goal mouths; turns every 30 degrees; with and without a ball): away from walls main's own lines,
// exactly; beside a wall it rises above her, never turns by itself, keeps her on the screen and stays in the court;
// through a quick swipe (the game's easing, follow) her figure stays on the screen; walking to a wall it moves smoothly
test('the camera: main\'s away from walls; beside one it rises above her; a quick swipe never loses her; it moves smoothly', async () => {
  const { target, follow, stand, onScreen } = await import('../src/mathball/camera.js');
  const { MBCAM } = await readCam();
  const { COURT, WALLS, CORNERS, GOALS, clampIn, inside } = await import('../src/mathball/court.js');
  const mainPose = (C, x, z, yaw, lift, holding) => {   // (main's own lines, 65bc920 index.js aim())
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let ax = x - fx * C.dist * (1 - lift * 0.12), az = z - fz * C.dist * (1 - lift * 0.12), ay = C.height + lift * 0.9;
    const [cx, cz] = clampIn(ax, az, 0.4), pushed = Math.hypot(cx - ax, cz - az);
    ay = Math.min(ay + pushed * 0.5, COURT.height - 0.7);
    return { eye: [cx, ay, cz], look: [x + fx * C.ahead, C.lookY + (holding ? C.holdUp : 0), z + fz * C.ahead], pushed };
  };
  const places = [];
  for (let x = -4.8; x <= 4.8 + 1e-9; x += 0.5) for (let z = -8.76; z <= 8.76 + 1e-9; z += 0.5) if (inside(x, z) >= 0.45) places.push([x, z]);
  for (const W of WALLS) for (let s = 0; s <= W.len + 1e-9; s += 0.25) places.push(clampIn(W.A[0] + W.u[0] * s + W.n[0] * 0.45, W.A[1] + W.u[1] * s + W.n[1] * 0.45, 0.45));
  for (const c of CORNERS) places.push(clampIn(c[0], c[1], 0.45));
  for (const g of GOALS) places.push(clampIn(g.mid[0], g.mid[1], 0.45));
  const screens = [['upright', 400, 860, MBCAM.tall, 133], ['side', 860, 400, MBCAM.wide, 93], ['wide', 1280, 720, MBCAM.wide, 93]];
  for (const [name, Wd, Ht, C, bar] of screens) {
    let beside = 0, goals = 0, mainGoals = 0;
    for (const [x, z] of places) for (let yd = 0; yd < 360; yd += 30) for (const held of [false, true]) {
      const yaw = yd * Math.PI / 180, P = target(C, x, z, yaw, 0, held), M = mainPose(C, x, z, yaw, 0, held);
      const dir = Math.atan2(P.look[0] - P.eye[0], P.look[2] - P.eye[2]);
      assert.ok(Math.abs(Math.atan2(Math.sin(dir - yaw), Math.cos(dir - yaw))) < 1e-9, 'it looks along the hand\'s turn exactly');
      assert.ok(inside(P.eye[0], P.eye[2]) >= 0.4 - 1e-6 && P.eye[1] <= COURT.height - 0.7 + 1e-9, 'inside the court, under the ceiling');
      if (M.pushed < 1e-9) { for (let i = 0; i < 3; i++) { assert.ok(Math.abs(P.eye[i] - M.eye[i]) < 1e-9); assert.ok(Math.abs(P.look[i] - M.look[i]) < 1e-9); } continue; }
      beside++;
      for (const h of [0, 0.9, 1.75]) { const q = onScreen([x, h, z], P, C.fov, Wd, Ht); assert.ok(q && q[0] >= 0 && q[0] <= Wd && q[1] >= 0 && q[1] <= Ht, `${name} at ${x.toFixed(2)},${z.toFixed(2)} turned ${yd}: her figure (${h} m) on the screen`); }
      if (held) for (const g of GOALS) {
        if (Math.hypot(g.mid[0] - x, g.mid[1] - z) < 4) continue;
        const ok = (Q) => { const q = onScreen(g.aim, Q, C.fov, Wd, Ht); return q && q[0] >= 0 && q[0] <= Wd && q[1] >= bar && q[1] <= Ht; };
        if (ok(P)) goals++; if (ok(M)) mainGoals++;
      }
    }
    assert.ok(beside > 1000, `${name}: beside a wall in ${beside} cases`);
    assert.ok(goals >= mainGoals * 0.85, `${name}: far goals in view beside a wall ${goals} against main's ${mainGoals}`);
  }
  // a quarter turn in a quarter second by the hand (30 and 60 frames a second, the game's easing), from the middle and
  // from beside walls, every 45 degrees, both ways, with and without a ball, the three screens: her feet, hip and head on
  // the screen and the camera inside the court at every frame
  for (const [name, Wd, Ht, C] of screens) for (const [x, z] of [[0, 0], [4.35, 0], [4.35, 5.5], [-1.5, 8.3], [0, 6.3]]) for (let y0 = 0; y0 < 8; y0++) for (const dir of [1, -1]) for (const held of [false, true]) for (const dt of [1 / 30, 1 / 60]) {
    const k = 1 - Math.exp(-MBCAM.ease * dt), S = {};
    let yaw = y0 * Math.PI / 4;
    follow(S, C, x, z, yaw, 0, held, k);
    for (let t = 0; t < 1.0; t += dt) {
      if (t < 0.25) yaw += dir * (Math.PI / 2) * dt / 0.25;
      const P = follow(S, C, x, z, yaw, 0, held, k);
      assert.ok(inside(P.eye[0], P.eye[2]) >= 0.4 - 1e-6, `${name}: never through a wall`);
      const d = Math.atan2(P.look[0] - P.eye[0], P.look[2] - P.eye[2]); assert.ok(Math.abs(Math.atan2(Math.sin(d - yaw), Math.cos(d - yaw))) < 1e-9, 'along the hand\'s turn');
      for (const h of [0, 0.9, 1.75]) { const q = onScreen([x, h, z], P, C.fov, Wd, Ht); assert.ok(q && q[0] >= 0 && q[0] <= Wd && q[1] >= 0 && q[1] <= Ht, `${name} at ${x},${z} from ${y0 * 45} turning ${dir}: her figure (${h} m) on the screen ${t.toFixed(2)} s in (${q && q.map(Math.round)})`); }
    }
  }
  // walking toward a wall a millimetre at a time, facing every 5 degrees: where it stands is solved directly, so it
  // comes in steadily, never back and forth (the old 2 cm search's wobble). (Looking nearly along the wall it comes in
  // steeply, up to about 36 cm for each cm she walks a few degrees off the wall: the cliff left as it is, eased on the
  // screen)
  let steep = 0;
  for (const C of [MBCAM.tall, MBCAM.wide]) for (let yd = 0; yd < 360; yd += 5) {
    const yaw = yd * Math.PI / 180; let prev = null, dir = 0, turns = 0;
    for (let x = 2.0; x <= 4.35; x += 0.001) {
      const s = stand(C, x, 0.3, yaw);
      if (prev) { const d = s.back - prev.back; steep = Math.max(steep, Math.abs(d) / 0.001); if (Math.abs(d) > 1e-7) { const sg = Math.sign(d); if (dir && sg !== dir) turns++; dir = sg; } }
      prev = s;
    }
    assert.ok(turns <= 1, `turned ${yd}: it went back and forth ${turns} times`);
  }
  console.log(`# beside a wall, at its steepest it comes in ${steep.toFixed(1)} cm for each cm she walks`);
});
// (index.js imports three, which node has not: its MBCAM is read from the file's text)
async function readCam() {
  const src = readFileSync(new URL('../src/mathball/index.js', import.meta.url), 'utf8');
  const m = src.match(/export const MBCAM = (\{[\s\S]*?\n\});/);
  return { MBCAM: Function('"use strict"; return (' + m[1].replace(/\/\/[^\n]*/g, '') + ')')() };
}

test('a finger\'s drag turns the view and never tilts it; the mouse\'s drag up and down as main\'s', () => {
  const cam = { yaw: 0, lift: 0 };
  viewTurn(cam, 50, 0); assert.equal(cam.lift, 0, 'a finger: index.js passes no up and down');
  viewTurn(cam, 0, 100); assert.ok(Math.abs(cam.lift - 0.6) < 1e-9, 'the mouse: 0.006 a pixel, a drag down raises it, as main');
  viewTurn(cam, 0, 1e4); assert.equal(cam.lift, 1.6); viewTurn(cam, 0, -1e5); assert.equal(cam.lift, -1, 'main\'s limits');
});

test('the view turns only by viewTurn (a drag) and turnToward (a goal button\'s one turn); walking pushes as the view looks', () => {
  const cam = { yaw: 1, lift: 0 };
  viewTurn(cam, 100); assert.ok(Math.abs(cam.yaw - (1 + 100 * HANDS.turn)) < 1e-9, 'the world follows the finger: a swipe right turns the view left');
  viewTurn(cam, 0, 50); assert.ok(cam.lift > 0); assert.ok(Math.abs(cam.yaw - (1 + 100 * HANDS.turn)) < 1e-9, 'the mouse\'s drag up or down tilts, never turns');
  const c2 = { yaw: 0 }; let n = 0; while (!turnToward(c2, Math.PI * 0.9, 6.5, 1 / 30) && n < 200) n++;
  assert.ok(n < 20); assert.ok(Math.abs(c2.yaw - Math.PI * 0.9) < 1e-3);
  const p = pushFor(0, 1, 0); assert.ok(Math.abs(p.y - 1) < 1e-9 && Math.abs(p.x) < 1e-9);
  const q = pushFor(1, 0, Math.PI / 2); assert.ok(Math.abs(q.y - 1) < 1e-9);
});

// THE SMALL RULES index.js goes by (hands.js), by what they do
test('a ball a tap can hit: one that can be picked up, not in a hand, not inside a goal\'s housing', async () => {
  const { GOALS, COURT } = await import('../src/mathball/court.js');
  for (const mode of ['air', 'roll', 'rest', 'turn']) assert.ok(canPick({ mode }), mode);
  for (const mode of ['fly', 'in', 'held', 'gone']) assert.equal(canPick({ mode }), false, mode);
  assert.equal(canPick({ mode: 'rest', fading: 1.2 }), false, 'fading');
  for (const g of GOALS) {
    const at = (front, side) => [g.mid[0] + g.n[0] * front + g.u[0] * side, 0.25, g.mid[1] + g.n[1] * front + g.u[1] * side];
    const ball = (front, side) => ({ id: 1, mode: 'rest', p: at(front, side) });
    assert.equal(canTap(ball(0.26, 0), null, GOALS, COURT.goal), false, `${g.key}: 0.26 m from the wall between the cheeks: inside the housing`);
    assert.equal(canTap(ball(0.26, 0.9), null, GOALS, COURT.goal), false, 'near a cheek, still inside');
    assert.ok(canTap(ball(0.6, 0), null, GOALS, COURT.goal), `${g.key}: 0.6 m out: in front of the goal, a ball to tap`);
    assert.ok(canTap(ball(0.26, COURT.goal.w / 2 + COURT.goal.cheek + 0.1), null, GOALS, COURT.goal), 'beside the housing, along the wall');
    const b = ball(0.6, 0); assert.equal(canTap(b, b, GOALS, COURT.goal), false, 'the ball in her hand');
    // with a ball in hand, a tap on that goal where the housed ball is drawn: the ball is never offered, so the tap is
    // a throw at the goal (the goal's box under the finger, as on main)
    const housedBall = ball(0.26, 0), offered = [housedBall].filter((x) => canTap(x, null, GOALS, COURT.goal)).map((x) => ({ id: x.id, x: 200, y: 300, r: 12 }));
    assert.deepEqual(chooseTap({ held: true, touch: true, underIn: underAt(200, 300, offered, 0), hitBall: underAt(200, 300, offered, 0), hitGoal: g.i }), { throw: g.i });
    assert.deepEqual(chooseTap({ held: false, touch: true, under: underAt(200, 300, offered, 16), hitBall: null, near: nearestBall(200, 300, offered, 44), hitGoal: g.i }), { say: 'ball first' }, 'empty hands: "a ball first", as on main');
  }
});
test('a tap where a ball was a moment before picks it (the record of where it was, through the camera as it is)', () => {
  // a ball that rolled from where the finger lands to 100 px away in the last moment: picked by where it was
  assert.equal(nearestBall(200, 400, [{ id: 'A', x: 300, y: 400, r: 10, past: [[200, 400]] }], HANDS.reach.touch).id, 'A');
  assert.equal(nearestBall(200, 400, [{ id: 'A', x: 300, y: 400, r: 10 }], HANDS.reach.touch), null, '(without the record: missed)');
  // the record round trip, the camera not turned: where it was is where it showed
  const hist = [], cam = (p) => [200 + p[0] * 40, 400 - p[2] * 10];
  remember(hist, 0, [{ id: 'A', p: [0, 0.25, 0] }]); remember(hist, 0.1, [{ id: 'A', p: [2.5, 0.25, 0] }]);
  const past = pastOnScreen(hist, cam);
  assert.deepEqual(past.get('A'), [[200, 400], [300, 400]]);
  assert.equal(nearestBall(200, 400, [{ id: 'A', x: 300, y: 400, r: 10, past: past.get('A') }], HANDS.reach.touch).id, 'A');
});
test('a goal is in view by the screen alone: its mouth on the page, under the top bar as measured', () => {
  const rect = { left: 0, top: 0, right: 400, bottom: 860 };
  assert.ok(inView([200, 300], rect, 133)); assert.ok(inView([200, 133], rect, 133), 'at the bar\'s foot');
  assert.equal(inView([200, 132.9], rect, 133), false, 'under the bar'); assert.equal(inView([401, 300], rect, 133), false, 'off a side');
  assert.equal(inView([200, 861], rect, 133), false); assert.equal(inView(null, rect, 133), false, 'behind the camera');
});
test('a goal\'s button: a goal in view is thrown at; one not in view turns the view once (A) or says where it is (B)', () => {
  assert.equal(buttonDoes(true, true), 'throw'); assert.equal(buttonDoes(true, false), 'throw');
  assert.equal(buttonDoes(false, true), 'turn'); assert.equal(buttonDoes(false, false), 'say');
});
test('the goal beside a tap at its mouth: the floor in front of the mouth, whatever ball lies there', async () => {
  const { GOALS, COURT } = await import('../src/mathball/court.js');
  for (const g of GOALS) {
    const at = (front, side) => [g.mid[0] + g.n[0] * front + g.u[0] * side, g.mid[1] + g.n[1] * front + g.u[1] * side];
    assert.equal(mouthAt(...at(0.6, 0), GOALS, COURT.goal.w), g.i);
    assert.equal(mouthAt(...at(1.29, COURT.goal.w / 2 + 0.24), GOALS, COURT.goal.w), g.i, 'its edge');
    assert.equal(mouthAt(...at(1.4, 0), GOALS, COURT.goal.w), null, 'too far out');
    assert.equal(mouthAt(...at(0.6, COURT.goal.w / 2 + 0.3), GOALS, COURT.goal.w), null, 'beside the mouth');
  }
});
test('the once-a-round line on looking round: after 2 s of every ball behind the view; it waits for a line showing', () => {
  const S = { said: false, unseenFor: 0 }, unseen = [{ mode: 'rest', seen: false }, { mode: 'roll', seen: false }];
  const go = (o) => lookRoundDue(S, { dt: 0.5, t: 10, holding: false, running: false, balls: unseen, showing: false, ...o });
  assert.equal(go({ t: 3 }), false, 'not in the first 4 s');
  for (let i = 0; i < 4; i++) assert.equal(go({}), false);
  assert.equal(go({ showing: true }), false, 'a score\'s line still showing: it waits');
  assert.equal(go({}), true, 'then it is said');
  assert.equal(go({}), false, 'once a round');
  const S2 = { said: false, unseenFor: 0 };
  for (let i = 0; i < 10; i++) assert.equal(lookRoundDue(S2, { dt: 0.5, t: 10, holding: true, running: false, balls: unseen, showing: false }), false, 'never with a ball in hand');
  assert.equal(S2.unseenFor, 0);
  for (let i = 0; i < 10; i++) assert.equal(lookRoundDue(S2, { dt: 0.5, t: 10, holding: false, running: false, balls: [{ mode: 'rest', seen: true }], showing: false }), false, 'never while a ball is in view');
});

// LOUD ALARMS on the game's controller (it needs a page, so node cannot run it; these read its text): the view's turn
// is written from the hand's drag only (onMove) and the rigs' faceTo; a finger's drag passes no tilt; a goal's button
// goes through buttonDoes; every list of balls a tap can hit goes through hands.js canTap
test('index.js: the turn written only from the drag; no tilt from a finger; the button by its rule; one rule for tap targets', () => {
  const src = readFileSync(new URL('../src/mathball/index.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.equal((src.match(/cam\.yaw\s*(=(?!=)|\+=|-=)/g) || []).length, 0, 'cam.yaw is written only by viewTurn / turnToward');
  assert.equal((src.match(/cam\.lift\s*(=(?!=)|\+=|-=)/g) || []).length, 0, 'cam.lift (the tilt) only by viewTurn');
  const turns = src.split('\n').filter((l) => /viewTurn\(/.test(l));
  assert.equal(turns.length, 3, 'viewTurn is called in three places: ' + turns.map((l) => l.trim().slice(0, 60)).join(' | '));
  assert.ok(turns.some((l) => /if \(r\.turn && !paused && !closed\) \{ const now = stamp\(e\), px = spin\.drag\(r\.turn\[0\], [^;]*\); lastDragT = now; viewTurn\(cam, px, e\.pointerType === 'mouse' \? r\.turn\[1\] : 0\);/.test(l)), 'the drag (onMove), by its speed, a finger passing no tilt');
  assert.ok(turns.some((l) => /\{ const g = paused \? 0 : spin\.step\(dt\); if \(g\) \{ viewTurn\(cam, g, 0\);/.test(l)), 'the glide after a swipe');
  assert.ok(turns.some((l) => /faceTo: \(y\) => \{ spin\.stop\(\); viewTurn\(cam, wrapA\(y - cam\.yaw\) \/ HANDS\.turn, 0\)/.test(l)), 'the rigs\' faceTo');
  assert.equal((src.match(/turnToward\(/g) || []).length, 1, 'turnToward: the goal button\'s one turn only');
  assert.ok(/const does = how === 'button' \? buttonDoes\(seen\(gi\), FRONT\.buttonTurns\) : 'throw';/.test(src), 'the goal\'s button by its rule');
  assert.ok(!/MBCAM\.(swing|after|turn)\b/.test(src) && !/turnTo\s*=/.test(src), 'the old swings are gone');
  assert.ok(!/'air', 'roll', 'rest', 'turn'/.test(src), 'no list of ball modes of its own: hands.js canTap');
  assert.equal((src.match(/canTap\(b, /g) || []).length, 3, 'the click targets, the balls on the screen and the record of where they were');
});

test('a swipe\'s speed: slow is one to one, faster turns further (up to twice); let go while moving, it glides to a stop', () => {
  const W = makeSpin();
  assert.equal(W.drag(10, 50), 10, '200 px a second: one to one');
  assert.equal(W.drag(30, 50), 30, '600 px a second: one to one');
  const f = W.drag(60, 50); assert.ok(f > 60 && f < 180, `1200 px a second: further (${f})`);
  assert.equal(makeSpin().drag(400, 50), 400 * SPIN.most, 'never more than twice');
  // the glide: let go at once after a quick move, it goes on the same way and slows to a stop
  const G = makeSpin(); G.drag(60, 16); G.release(20);
  let total = 0, n = 0, last = Infinity; while (G.gliding && n < 600) { const px = G.step(1 / 60); assert.ok(px > 0 && px <= last + 1e-9, 'the same way, slowing'); last = px; total += px; n++; }
  assert.ok(!G.gliding && total > 100 && n < 120, `it glides ${Math.round(total)} px and stops in ${(n / 60).toFixed(2)} s`);
  // a finger that stopped before lifting: no glide; a new touch stops a glide at once
  const H = makeSpin(); H.drag(60, 16); H.release(200); assert.equal(H.gliding, false); assert.equal(H.step(1 / 60), 0);
  const K = makeSpin(); K.drag(60, 16); K.release(10); assert.ok(K.gliding); K.stop(); assert.equal(K.step(1 / 60), 0);
  // a slow drag lifted while moving: hardly any glide
  const Sl = makeSpin(); Sl.drag(2, 16); Sl.release(10); let t2 = 0; for (let i = 0; i < 300; i++) t2 += Sl.step(1 / 60); assert.ok(t2 < 40, `a slow drag: ${t2.toFixed(1)} px of glide`);
});
