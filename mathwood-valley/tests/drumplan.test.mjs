// The drums' numbers and the sticks' stroke: thump to the bass drum, slap and tap to the snare, the stick on the skin at the note.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUMS, STRIKE, STROKE, handOf, strokeHeight, bassSkin, planHits, accentDue } from '../src/drumplan.js';

test('each box hit has its hand', () => {
  assert.equal(handOf('thump'), 2); assert.equal(handOf('slap'), 1); assert.equal(handOf('tap'), 0);
});
test('the strike points are on the drums', () => {
  const s = DRUMS.snare, d = Math.hypot(STRIKE.L[0] - s.at[0], STRIKE.L[2] - s.at[2]);
  assert.ok(d < s.r * 0.8); assert.ok(Math.abs(STRIKE.L[1] - s.at[1]) < 0.01);
  assert.ok(Math.hypot(STRIKE.R[0] - s.at[0], STRIKE.R[2] - s.at[2]) < s.r * 0.8);
  const c = DRUMS.cymbal; assert.ok(Math.hypot(STRIKE.cymbal[0] - c.at[0], STRIKE.cymbal[2] - c.at[2]) < c.r);
  const b = bassSkin(), P = DRUMS.pedal; assert.ok(Math.abs(b[1] - DRUMS.bass.at[1]) < 0.01);   // the beater's ball reaches the skin: about the axle's height plus the shaft
  assert.ok(Math.abs(P.axle[2] + P.shaft * 0 - (b[2] - 0.06)) < 0.05);
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
test('thump to the foot, loud ones with the cymbal; close slaps alternate sticks', () => {
  const st = {};
  assert.deepEqual(planHits({ hit: 'thump', vel: 1, at: 1 }, st), { limb: 'foot', cymbal: true });
  assert.deepEqual(planHits({ hit: 'thump', vel: 1, at: 2 }, st), { limb: 'foot', cymbal: false });   // (not every one)
  assert.equal(planHits({ hit: 'thump', vel: 0.5, at: 5 }, st).cymbal, false);
  assert.equal(planHits({ hit: 'thump', vel: 1, at: 20 }, st).cymbal, false);   // (rare: not again for half a minute)
  assert.equal(planHits({ hit: 'thump', vel: 1, at: 40 }, st).cymbal, true);
  assert.equal(planHits({ hit: 'slap', vel: 0.7, at: 6 }, st).limb, 'R');
  assert.equal(planHits({ hit: 'slap', vel: 0.7, at: 6.4 }, st).limb, 'L');
  assert.equal(planHits({ hit: 'tap', vel: 0.3, at: 6.5 }, st).limb, 'L');
});

test('the music decides the accent: what it put on the event is what his stick does', () => {
  const st = {};
  assert.deepEqual(planHits({ hit: 'thump', vel: 1, at: 1, cymbal: false }, st), { limb: 'foot', cymbal: false });
  assert.deepEqual(planHits({ hit: 'thump', vel: 0.5, at: 2, cymbal: true }, st), { limb: 'foot', cymbal: true });
  assert.equal(st.cym, undefined);
  const m = {}; assert.equal(accentDue({ hit: 'thump', vel: 1, at: 1 }, m), true); assert.equal(accentDue({ hit: 'thump', vel: 1, at: 2 }, m), false); assert.equal(accentDue({ hit: 'slap', vel: 1, at: 50 }, m), false);
});
