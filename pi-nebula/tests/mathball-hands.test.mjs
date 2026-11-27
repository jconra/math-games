// MATHBALL'S HANDS (src/mathball/hands.js): what a finger or the mouse on the court means. A tap on or near a ball
// picks it, a finger that wanders a few pixels is still a tap, a tap never throws by mistake, a drag never picks and is
// the only thing that turns the view (the game's maker, 2026-11-26: "no automatic rotations"). Each rule at its limit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HANDS, makeHands, nearestBall, underAt, chooseTap, remember, pastOnScreen, viewTurn, turnToward, pushFor } from '../src/mathball/hands.js';

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
  assert.deepEqual(T({ held: true, under: 3, hitGoal: 1 }), { pick: 3 }, 'a tap ON a ball swaps for it');
  assert.deepEqual(T({ held: true, near: { id: 5, d: 16 }, hitGoal: 1 }), { pick: 5 }, 'on it: 16 px');
  assert.deepEqual(T({ held: true, near: { id: 5, d: 16.01 }, hitGoal: 1 }), { throw: 1 }, 'past 16 px: the goal');
  assert.deepEqual(T({ held: true, near: { id: 5, d: 30 }, goalBy: 2 }), { throw: 2 }, 'a goal just beside, a ball in reach: the throw');
  assert.equal(T({ held: true, near: { id: 5, d: 30 } }), null, 'a ball merely in reach never drops the one in hand');
  assert.equal(T({ held: true, spot: true }), null, 'a finger on the floor: nothing (never a throw by mistake)');
  assert.deepEqual(chooseTap({ held: true, touch: false, spot: true }), { toss: true }, 'the mouse: a click on the floor throws there');
  assert.deepEqual(chooseTap({ held: true, touch: false, near: { id: 5, d: 6 } }), { pick: 5 }, 'the mouse on a ball: 6 px');
  assert.equal(chooseTap({ held: true, touch: false, near: { id: 5, d: 6.01 } }), null);
});

test('the view turns only by viewTurn (a drag) and turnToward (a goal button\'s one turn); walking pushes as the view looks', () => {
  const cam = { yaw: 1, lift: 0 };
  viewTurn(cam, 100); assert.ok(Math.abs(cam.yaw - (1 - 100 * HANDS.turn)) < 1e-9);
  viewTurn(cam, 0, 50); assert.ok(cam.lift > 0); assert.ok(Math.abs(cam.yaw - (1 - 100 * HANDS.turn)) < 1e-9, 'a drag up or down tilts, never turns');
  const c2 = { yaw: 0 }; let n = 0; while (!turnToward(c2, Math.PI * 0.9, 6.5, 1 / 30) && n < 200) n++;
  assert.ok(n < 20); assert.ok(Math.abs(c2.yaw - Math.PI * 0.9) < 1e-3);
  const p = pushFor(0, 1, 0); assert.ok(Math.abs(p.y - 1) < 1e-9 && Math.abs(p.x) < 1e-9);
  const q = pushFor(1, 0, Math.PI / 2); assert.ok(Math.abs(q.y - 1) < 1e-9);
});

// LOUD ALARM: the game's controller (it needs a page, so node cannot run it) changes the view's turn and tilt nowhere
// but through hands.js; the old swings and the tilt on a pick-up are gone; the one goal-button turn is started only
// by a goal button's throw under FRONT.buttonTurns; a tap's rules are hands.js chooseTap's
test('index.js: nothing turns or tilts the view by itself', () => {
  const src = readFileSync(new URL('../src/mathball/index.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.equal((src.match(/cam\.yaw\s*(=(?!=)|\+=|-=)/g) || []).length, 0, 'cam.yaw is written only by viewTurn / turnToward');
  assert.equal((src.match(/cam\.lift\s*(=(?!=)|\+=|-=)/g) || []).length, 0, 'cam.lift (the tilt) only by viewTurn');
  assert.ok(!/MBCAM\.(swing|after|turn)\b/.test(src) && !/holdUp/.test(src), 'the swings and the tilt on a pick-up are gone');
  assert.ok(!/turnTo\s*=/.test(src));
  const turns = src.split('\n').filter((l) => /oneTurn = (?!null)/.test(l));
  assert.equal(turns.length, 1); assert.ok(/FRONT\.buttonTurns/.test(turns[0]), 'only under FRONT.buttonTurns: ' + turns[0].trim());
  assert.equal((src.match(/turnToward\(/g) || []).length, 1);
  assert.ok(/chooseTap\(/.test(src), 'a tap\'s rules are chooseTap\'s');
  assert.ok(/addEventListener\('blur'/.test(src) && /e\.buttons === 0/.test(src), 'a drag never sticks');
  assert.ok(/e\.timeStamp/.test(src), 'pointers timed by their events');
});
