// The drums' numbers and the sticks' stroke: thump to the bass drum, slap and tap to the snare, the stick on the skin at the note.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUMS, STRIKE, STROKE, handOf, strokeHeight, bassSkin } from '../src/drumplan.js';

test('each box hit has its hand', () => {
  assert.equal(handOf('thump'), 1); assert.equal(handOf('slap'), 0); assert.equal(handOf('tap'), 0);
});
test('the strike points are on the drums', () => {
  const s = DRUMS.snare, d = Math.hypot(STRIKE.L[0] - s.at[0], STRIKE.L[2] - s.at[2]);
  assert.ok(d < s.r * 0.8); assert.ok(Math.abs(STRIKE.L[1] - s.at[1]) < 0.01);
  const b = bassSkin(); assert.ok(Math.hypot(STRIKE.R[0] - b[0], STRIKE.R[1] - b[1], STRIKE.R[2] - b[2]) < DRUMS.bass.r * 0.8);
});
test('the stick is down on the note, up before and after', () => {
  const at = 10;
  assert.ok(strokeHeight(at, at, 8) < 0.01, 'on the skin at the note');
  assert.ok(strokeHeight(at - 0.1, at, 8) > 0.8, 'lifted just before');
  assert.ok(strokeHeight(at + 0.002, 12, at) < 0.05, 'still on the skin just after');
  assert.ok(Math.abs(strokeHeight(at + 0.5, 12, at) - STROKE.ready) < 0.01, 'at the ready between notes');
});
test('a stroke never leaves 0..1 and never jumps much, frame to frame at 60 a second', () => {
  const hits = [1, 1.5, 1.62, 2, 3, 3.1]; let last = null;
  for (let t = 0.5; t < 4; t += 1 / 60) {
    const next = hits.find((h) => h > t) ?? 99, prev = [...hits].reverse().find((h) => h <= t) ?? -99, h = strokeHeight(t, next, prev);
    assert.ok(h >= 0 && h <= 1); if (last != null) assert.ok(Math.abs(h - last) < 0.5, `t ${t}: ${last} -> ${h}`); last = h;
  }
});
