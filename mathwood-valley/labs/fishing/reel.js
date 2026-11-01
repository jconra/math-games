// THE REEL: a small game of keeping the line's tension in the green, the fish's part of it worked out here with no page,
// sound or three.js (the builder draws it, the Fishing Lab's dials change it, tests/fishing-reel.test.mjs plays it). One
// held button: holding raises the tension, letting go lowers it.
//   in the green       the fish comes in
//   too slack          the fish takes a little line back out
//   too tight (red)    the fish doesn't come; stay there a while and it warns, then the line snaps. Out of the red the
//                      danger drains away. A snapped line costs only that fish: no question was asked, nothing counts.
// Now and then the fish runs: the tension climbs by itself, and a hand on the button has to ease off.
// A bigger fish narrows the green, runs harder, takes longer and snaps sooner, but never by much: the math is the point.
//
//   reelStart(lb, rnd) -> R            lb: the fish's weight in pounds
//   reelStep(R, dt, hold, rnd) -> null | 'landed' | 'snapped'    R.p (0..1 how far in), R.T (tension 0..1), R.lo, R.hi
//     (the green), R.zone ('slack' | 'green' | 'red'), R.danger (0..1, 1 snaps), R.warn, R.running

export const REEL = {
  start: 0.42,                // the tension as the reeling starts
  rise: 0.45, fall: 0.4,      // how fast the tension goes up holding, and down letting go (a share of the bar a second)
  low: 0.26, high: 0.76,       // the green, for the smallest fish
  narrow: 0.04,               // ... each of its edges this much further in for the biggest
  landSmall: 5, landBig: 7.5,   // seconds in the green to bring in the smallest and the biggest fish
  slack: 0.06,                // line taken back a second when too slack, a share of the whole way in
  snapSmall: 3, snapBig: 2.2,   // seconds in the red before the line snaps
  warnAt: 0.45,               // how far along that it warns
  surge: 0.3,                // how much a run adds to the tension a second
  surgeBig: 0.12,              // ... and this much more for the biggest fish
  surgeGap: [1.8, 3.4],       // seconds between runs
  surgeLen: [0.5, 0.9],       // seconds a run lasts
};
const between = (rnd, [a, b]) => a + rnd() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// how big the fish is, 0 (a quarter pound) .. 1 (four pounds and up); a root, as most fish are small
export const fishSize = (lb) => Math.sqrt(clamp((lb - 0.25) / 3.75, 0, 1));

export function reelStart(lb, rnd = Math.random) {
  const k = fishSize(lb);
  return { k, p: 0, T: REEL.start, lo: REEL.low + REEL.narrow * k, hi: REEL.high - REEL.narrow * k,
    land: REEL.landSmall + (REEL.landBig - REEL.landSmall) * k, snap: REEL.snapSmall + (REEL.snapBig - REEL.snapSmall) * k,
    surge: REEL.surge + REEL.surgeBig * k, red: 0, danger: 0, warn: false, zone: 'green', running: false, runLeft: 0, nextRun: between(rnd, REEL.surgeGap) * 0.6, inGreen: 0, t: 0 };
}
export function reelStep(R, dt, hold, rnd = Math.random) {
  R.t += dt;
  if (R.runLeft > 0) R.runLeft -= dt;
  else if ((R.nextRun -= dt) <= 0) { R.runLeft = between(rnd, REEL.surgeLen); R.nextRun = between(rnd, REEL.surgeGap); }
  R.running = R.runLeft > 0;
  R.T = clamp(R.T + dt * ((hold ? REEL.rise : -REEL.fall) + (R.running ? R.surge : 0)), 0, 1);
  R.zone = R.T < R.lo ? 'slack' : R.T > R.hi ? 'red' : 'green';
  if (R.zone === 'green') { R.p += dt / R.land; R.inGreen += dt; }
  else if (R.zone === 'slack') R.p -= dt * REEL.slack;
  R.red = R.zone === 'red' ? R.red + dt : Math.max(0, R.red - dt * 1.5);
  R.danger = clamp(R.red / R.snap, 0, 1);
  R.warn = R.danger >= REEL.warnAt;
  R.p = clamp(R.p, 0, 1);
  if (R.danger >= 1) return 'snapped';
  return R.p >= 1 ? 'landed' : null;
}
