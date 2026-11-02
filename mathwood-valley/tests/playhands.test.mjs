// The playing hands' numbers: the harmonica's cup opens and closes, the banjo's strike lands on the note.
import test from 'node:test';
import assert from 'node:assert/strict';
import { harpOpen, strike, PLAY } from '../src/playplan.js';

test('the cupped hands are closed on the bar line and wide between', () => {
  assert.ok(harpOpen(0) < 0.01); assert.ok(harpOpen(1) > 0.99); assert.ok(harpOpen(PLAY.harp.beats) < 0.01);
});
test('the picking hand is down on each note, up between', () => {
  for (const n of PLAY.banjo.notes) assert.ok(strike(n, 0.5) > 0.99, `note at ${n}`);
  assert.ok(strike(0.6, 0.5) < 0.01);
});
