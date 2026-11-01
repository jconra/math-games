// The reel's game in plain numbers (labs/fishing/reel.js): sitting in the green brings a fish in within 5 to 10 seconds or
// so, a held button snaps the line, a button never pressed lets the fish take line but never loses it, and a plain
// hold-and-let-go hand lands nearly every fish. How it FEELS is for a hand: labs/fishing's dials.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { REEL, reelStart, reelStep, fishSize } from '../labs/fishing/reel.js';

function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function play(lb, hand, seed = 1, most = 90) {
  const rnd = rng(seed), R = reelStart(lb, rnd), dt = 1 / 30;
  let hold = false, end = null, t = 0;
  while (!end && t < most) { hold = hand(R, hold, t); end = reelStep(R, dt, hold, rnd); t += dt; }
  return { end, t, R };
}
// a child's easy hand: presses when it sags low in the green, lets go when it climbs high, with a reaction time
const easyHand = (late = 0.2) => { let want = false, since = 0; return (R, hold) => {
  const w = R.T < R.lo + 0.08 ? true : R.T > R.hi - 0.08 ? false : want;
  if (w !== want) { since += 1 / 30; if (since >= late) { want = w; since = 0; } } else since = 0;
  return want; }; };

test('a steady hand brings a fish in: about 5 to 10 seconds, the bigger the longer', () => {
  for (const lb of [0.25, 1, 2, 4]) {
    const times = [];
    for (let s = 1; s <= 40; s++) { const r = play(lb, easyHand(), s); assert.equal(r.end, 'landed', `${lb} lb seed ${s}: ${r.end}`); times.push(r.t); }
    const mean = times.reduce((a, b) => a + b) / times.length;
    assert.ok(mean >= 4.5 && mean <= 12, `${lb} lb: ${mean.toFixed(1)} s`);
  }
  assert.ok(play(4, easyHand(), 3).t > play(0.25, easyHand(), 3).t);
});
test('a slower hand (half a second late) still lands nearly every fish', () => {
  let landed = 0, n = 0;
  for (const lb of [0.25, 1, 2, 4]) for (let s = 1; s <= 50; s++) { n++; if (play(lb, easyHand(0.5), s).end === 'landed') landed++; }
  assert.ok(landed / n >= 0.95, `${landed} of ${n}`);
});
test('holding the button down the whole way snaps the line, in a few seconds, after a warning', () => {
  for (const lb of [0.25, 4]) {
    let warned = false;
    const r = play(lb, (R) => { warned = warned || R.warn; return true; });
    assert.equal(r.end, 'snapped');
    assert.ok(warned, 'it warned first');
    assert.ok(r.t < 6, `${r.t.toFixed(1)} s`);
  }
});
test('never pressing: the fish takes line, the line never snaps, and it never comes in', () => {
  const r = play(1, () => false, 2, 30);
  assert.equal(r.end, null); assert.equal(r.R.p, 0);
});
test('slack loses ground: some progress, then letting go takes line back', () => {
  const rnd = rng(5), R = reelStart(1, rnd); R.p = 0.5; R.T = 0.05; R.lo = 0.3;
  reelStep(R, 0.5, false, rnd);
  assert.ok(R.p < 0.5); assert.equal(R.zone, 'slack');
});
test('out of the red the danger drains away', () => {
  const rnd = rng(5), R = reelStart(1, rnd); R.T = 0.95; R.nextRun = 99;
  reelStep(R, 0.5, true, rnd); const d = R.danger; assert.ok(d > 0);
  R.T = 0.5; reelStep(R, 0.3, false, rnd); assert.ok(R.danger < d);
});
test('a bigger fish is harder, but the green stays wide', () => {
  const a = reelStart(0.25, rng(1)), b = reelStart(4, rng(1));
  assert.ok(b.hi - b.lo < a.hi - a.lo); assert.ok(b.hi - b.lo >= 0.3); assert.ok(b.snap < a.snap); assert.ok(b.land > a.land);
  assert.equal(fishSize(0.1), 0); assert.equal(fishSize(9), 1); assert.ok(REEL.landBig <= 10);
});
