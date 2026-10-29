// The saloon's barkeep in plain numbers (src/barkeepplan.js): the glass he polishes held square in his left hand (the same
// numbers his Blender clip, Bar_Polish, is made round), the cloth in his right, where he stands and how far he turns to a
// rider. How he LOOKS is for eyes: ~/pw/bandit-math/rigs/saloon_polish/bar_game.cjs.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { BARKEEP, GLASS, HOLD, CLOTH, wristFrame, glassHold, barkeepData } from '../src/barkeepplan.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

test('the glass in his hand: a square, right-handed wrist frame, and glassHold its inverse', () => {
  const W = wristFrame();
  for (const a of ['x', 'y', 'z']) assert.ok(near(Math.hypot(...W[a]), 1), a);
  assert.ok(near(dot(W.x, W.y), 0) && near(dot(W.y, W.z), 0) && near(dot(W.x, W.z), 0));
  const c = [W.x[1] * W.y[2] - W.x[2] * W.y[1], W.x[2] * W.y[0] - W.x[0] * W.y[2], W.x[0] * W.y[1] - W.x[1] * W.y[0]];
  assert.ok(near(dot(c, W.z), 1), 'right-handed, as the skeleton\'s bones are');
  const M = glassHold(), at = W.at, p = [0, 1, 2].map((r) => M[r] * at[0] + M[4 + r] * at[1] + M[8 + r] * at[2] + M[12 + r]);
  assert.ok(Math.hypot(...p) < 1e-9, 'the wrist\'s own place comes out at its origin');
  // (the wrist by the glass's foot, below and toward him: within a hand's breadth)
  assert.ok(Math.hypot(...HOLD.glass.at) < 0.1 && HOLD.glass.at[1] < 0.01);
});

test('a schooner\'s size, the cloth in his fingers, his place and turn', () => {
  assert.ok(GLASS.h > 0.07 && GLASS.h < 0.13 && GLASS.r1 > GLASS.r0 && GLASS.r1 < 0.05, 'a tumbler, wider at its mouth');
  assert.ok(CLOTH.at[1] > 0.05 && CLOTH.at[1] < 0.12, 'the cloth out along the fingers');
  assert.ok(BARKEEP.back > 0.15 && BARKEEP.back < 0.5, 'a step back from the bar\'s back face');
  assert.ok(BARKEEP.turn + BARKEEP.head > 1.2 && BARKEEP.turn < Math.PI / 2, 'he can look well round to a rider at the bar, his body turning only part of it');
  assert.equal(BARKEEP.look.hat, false, 'no hat indoors behind the bar');
  assert.ok(/_m$/.test(BARKEEP.look.outfit), 'a man: his clip is on the men\'s skeleton');
  const D = barkeepData(); assert.ok(D.wrist.glass && D.GLASS && D.CLOTH && D.HOLD);
});
