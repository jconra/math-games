// MATHBALL'S HANDS (src/mathball/hands.js): what a finger or the mouse on the court means. A tap on or near a ball
// picks it (the nearest, a rolling one too), a finger that wanders a few pixels is still a tap, a drag never picks and
// is the only thing that turns the view (the game's maker, 2026-11-26: "no automatic rotations").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HANDS, makeHands, nearestBall, viewTurn, turnToward, pushFor } from '../src/mathball/hands.js';

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

test('a finger that wanders a few pixels as it taps is still a tap, and turns nothing', () => {
  for (const px of [0, 4, 9, 11]) {
    const r = press(makeHands(), { moveBy: px });
    assert.ok(r.up && r.up.tap, `${px} px: a tap`);
    assert.equal(r.turns.length, 0, `${px} px: no turn`);
  }
  // (the shared input's own line was 6 pixels: 9 and 11 were drags of the view there, and no pick)
  assert.ok(HANDS.slop.touch >= 11);
});

test('a drag turns the view and never taps (so never picks a ball)', () => {
  for (const px of [20, 60, -140]) {
    const r = press(makeHands(), { moveBy: px, steps: 8 });
    assert.equal(r.up, null, `${px} px: no tap`);
    assert.ok(r.turns.length > 0, `${px} px: it turned`);
    const sum = r.turns.reduce((s, t) => s + t[0], 0);
    assert.ok(Math.abs(sum) <= Math.abs(px) && Math.abs(sum) > Math.abs(px) - HANDS.slop.touch - Math.abs(px) / 8 - 1, `${px} px: turned by what was dragged past the slop (less one step) (${sum})`);
  }
});

test('a slow tap still picks; a press held a long time does not', () => {
  assert.ok(press(makeHands(), { ms: 600 }).up.tap, '0.6 s');
  assert.equal(press(makeHands(), { ms: 1200 }).up, null, '1.2 s');
});

test('the mouse: a click is a press that moves under 6 pixels, the left button only; a drag turns', () => {
  assert.ok(press(makeHands(), { touch: false, moveBy: 5 }).up.tap);
  const d = press(makeHands(), { touch: false, moveBy: 40 });
  assert.equal(d.up, null); assert.ok(d.turns.length);
  assert.equal(press(makeHands(), { touch: false, button: 2 }).up, null, 'the right button never clicks');
  assert.ok(press(makeHands(), { touch: false, button: 2, moveBy: 40 }).turns.length, 'but it drags');
});

test('the walking stick (a thumb on the left part of a phone) never turns the view; its quick tap still picks', () => {
  const H = makeHands();
  assert.equal(H.down(1, { x: 60, y: 600, t: 0, touch: true, width: W }), 'stick');
  const walk = press(makeHands(), { x: 60, y: 600, moveBy: 50 });
  assert.equal(walk.turns.length, 0); assert.equal(walk.up, null);
  assert.ok(press(makeHands(), { x: 60, y: 600, moveBy: 5 }).up.tap);
  // (a second thumb on the left while the stick is down is a finger on the view: it may turn)
  const H2 = makeHands(); H2.down(1, { x: 60, y: 600, t: 0, touch: true, width: W });
  assert.equal(H2.down(2, { x: 100, y: 300, t: 0, touch: true, width: W }), 'press');
});

test('two fingers on the view (a pinch) neither turn it nor tap', () => {
  const H = makeHands();
  H.down(1, { x: 250, y: 300, t: 0, touch: true, width: W }); H.down(2, { x: 350, y: 500, t: 10, touch: true, width: W });
  assert.equal(H.move(1, 200, 300, 50), null); assert.equal(H.move(2, 390, 520, 50), null);
  assert.equal(H.up(1, 200, 300, 80), null); assert.equal(H.up(2, 390, 520, 90), null);
});

test('a ball in hand: a finger rested a moment then moved aims (the view holds); one moved at once turns the view', () => {
  const H = makeHands();
  H.down(1, { x: 300, y: 500, t: 0, touch: true, width: W, aimable: true });
  assert.deepEqual(H.tick(100), []);
  assert.equal(H.tick(HANDS.hold + 10).length, 1, 'rested: it aims');
  assert.ok(H.move(1, 320, 420, 400).aim);
  assert.equal(H.dragging, false);
  const up = H.up(1, 330, 400, 500); assert.ok(up.aimed && !up.still);
  const quick = press(makeHands(), { aimable: true, moveBy: 80, ms: 150, steps: 6 });
  assert.ok(quick.turns.length && !quick.aims, 'moved at once: turns the view');
  // (and a quick tap with a ball in hand is still a tap: a ball tapped then is picked instead)
  assert.ok(press(makeHands(), { aimable: true, ms: 120 }).up.tap);
});

test('a tap picks the nearest ball within a finger\'s reach of its edge, where it is or where it was as the finger came down', () => {
  const balls = [{ id: 1, x: 100, y: 300, r: 12 }, { id: 2, x: 150, y: 300, r: 12 }, { id: 3, x: 300, y: 600, r: 30 }];
  assert.equal(nearestBall(100, 300, balls, HANDS.reach.touch).id, 1, 'on it');
  assert.equal(nearestBall(130, 300, balls, HANDS.reach.touch).id, 2, 'between: the nearer');
  assert.equal(nearestBall(100, 345, balls, HANDS.reach.touch).id, 1, '45 px below a far ball: still it');
  assert.equal(nearestBall(300, 670, balls, HANDS.reach.touch).id, 3, 'a big near ball, beside its edge');
  assert.equal(nearestBall(220, 450, balls, HANDS.reach.touch), null, 'nothing near: nothing');
  // a rolling ball that left the finger's spot as it pressed
  const rolling = [{ id: 7, x: 260, y: 300, r: 10, x0: 190, y0: 300 }];
  assert.equal(nearestBall(190, 300, rolling, HANDS.reach.touch).id, 7);
  assert.equal(nearestBall(190, 300, [{ id: 7, x: 260, y: 300, r: 10 }], HANDS.reach.touch), null, '(without where it was: missed)');
  // the mouse is narrower
  assert.equal(nearestBall(100, 340, balls, HANDS.reach.mouse), null);
});

test('the view turns only by viewTurn (a drag) and turnToward (a goal button\'s one turn)', () => {
  const cam = { yaw: 1, lift: 0 };
  viewTurn(cam, 100); assert.ok(Math.abs(cam.yaw - (1 - 100 * HANDS.turn)) < 1e-9);
  viewTurn(cam, 0, 50); assert.ok(cam.lift > 0); assert.ok(Math.abs(cam.yaw - (1 - 100 * HANDS.turn)) < 1e-9, 'a drag up or down tilts, never turns');
  const c2 = { yaw: 0 }; let n = 0; while (!turnToward(c2, Math.PI * 0.9, 6.5, 1 / 30) && n < 200) n++;
  assert.ok(n < 20, 'the one turn is quick'); assert.ok(Math.abs(c2.yaw - Math.PI * 0.9) < 1e-3);
  // walking (keys, stick) and the run to a ball: as pushed for the view as it is (forward up the screen)
  const p = pushFor(0, 1, 0); assert.ok(Math.abs(p.y - 1) < 1e-9 && Math.abs(p.x) < 1e-9);
  const q = pushFor(1, 0, Math.PI / 2); assert.ok(Math.abs(q.y - 1) < 1e-9, 'looking along +x, a way along +x is forward');
});

// LOUD ALARM: the game's controller (it needs a page, so node cannot run it) changes the view's turn nowhere but
// through hands.js; the old swings are gone; the one goal-button turn is only ever started with FRONT.buttonTurns
test('index.js: nothing turns the view by itself', () => {
  const src = readFileSync(new URL('../src/mathball/index.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.equal((src.match(/cam\.yaw\s*(=(?!=)|\+=|-=)/g) || []).length, 0, 'cam.yaw is written only by viewTurn / turnToward');
  assert.ok(!/MBCAM\.(swing|after|turn)\b/.test(src), 'the swing to the far end or the open court is gone');
  assert.ok(!/turnTo\s*=/.test(src), 'no turn to an aim');
  const turns = src.split('\n').filter((l) => /oneTurn = (?!null)/.test(l));
  assert.ok(turns.length >= 1);
  for (const l of turns) assert.ok(/FRONT\.buttonTurns/.test(l), 'a goal button turns the view only with FRONT.buttonTurns: ' + l.trim());
  assert.equal((src.match(/turnToward\(/g) || []).length, 1, 'turnToward is called once: the goal button\'s turn');
  assert.ok(/if \(oneTurn != null\)[^\n]*turnToward/.test(src));
});
