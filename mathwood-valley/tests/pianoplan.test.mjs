// The piano's keys in numbers (src/pianoplan.js): each note's place on the model's drawn keyboard, which hand, which fingers.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYBOARD, keyX, keyWidth, isBlack, handOf, fitFingers } from '../src/pianoplan.js';

test('the keyboard: A0 at his far left, C8 at his far right, 52 white keys, an octave seven of them', () => {
  const half = KEYBOARD.width / 2, w = keyWidth();
  assert.ok(Math.abs(keyX(21) - (half - w / 2)) < 1e-9); assert.ok(Math.abs(keyX(108) - (-half + w / 2)) < 1e-9);
  assert.ok(Math.abs(keyX(60) - keyX(72) - 7 * w) < 1e-9);
  for (let m = 21; m < 108; m++) assert.ok(keyX(m) > keyX(m + 1), `${m} is left of the next`);
  assert.ok(isBlack(61) && !isBlack(60) && !isBlack(64) && !isBlack(65));
  assert.ok(Math.abs(keyX(61) - (keyX(60) - w / 2)) < 1e-9);   // (a black key on the line between its neighbours)
});
test('left hand the low notes, right the high', () => { assert.equal(handOf(40), 0); assert.equal(handOf(50), 0); assert.equal(handOf(62), 1); assert.equal(handOf(84), 1); });
const tips = [0.05, 0.035, 0.01, -0.012, -0.034];   // (a hand's fingertips from its wrist, thumb .. little finger)
test('a lone note: a finger lands on it exactly, the hand not moving if one is already over it', () => {
  const k = 0.1, r = fitFingers([k], 0.09, tips);
  assert.equal(r.fingers.length, 1); assert.ok(Math.abs(r.hx + tips[r.fingers[0]] - k) < 1e-9); assert.ok(Math.abs(r.hx - 0.09) < 0.015);
});
test('a chord: the fingers keep the keys\' order along the hand, each its own finger', () => {
  const keys = [0.15, 0.1, 0.05], r = fitFingers(keys, 0.1, tips), xs = keys.map((k, i) => tips[r.fingers[i]]);
  assert.equal(new Set(r.fingers).size, 3);
  assert.ok(xs[0] > xs[1] && xs[1] > xs[2]);
});
test('more notes than fingers: five get one, the rest none, no crash', () => {
  const r = fitFingers([0.3, 0.25, 0.2, 0.15, 0.1, 0.05], 0.2, tips);
  assert.equal(r.fingers.filter((f) => f >= 0).length, 5); assert.equal(r.fingers.filter((f) => f < 0).length, 1);
});
