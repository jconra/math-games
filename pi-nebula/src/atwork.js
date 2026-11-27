// HANDS ON THE WORK (four blind critics, 2026-11-26: desk workers with both hands flat on their knees in front of a
// screen, the forklift's driver not holding its wheel, the cook wiping the air beside his counter, the furnace worker
// wringing his hands with his back to the furnace). Where a person's hands go while they work, worked out from the very
// surface in front of them (the walls' own floors: a desk's top, a counter's, a console's), so the hands land on it as
// the reach to the lockers lands on the handle. people.js finds the surface once as they come to their work, and hands
// the points to moves.js M.hold each frame; the forklift's driver's are its wheel's (src/cargoforklift.js, cargodrive.js).
// Plain sums on [x, y, z] arrays (the tests run them).
//
//   surfaceAhead(floorAt, at, heading, o)   the first surface ahead of a point, between o.lo and o.hi over its floor
//                     (m), looked for from o.from to o.to metres along `heading`: { d (how far ahead its near edge is),
//                     y (its top, the world's) } or null. floorAt(x, z, top, drop): the walls' own (src/walls.js)
//   handsAt(kind, S, t, seed)   -> { hands: [[left], [right]], lean } where the wrists go this moment, and how far the
//                     body leans in (radians). S: { at: [x, y, z] the surface's near edge in front of them, its top's
//                     height; heading } (the way they face); t: seconds at it; seed: their own (so no two keep in step)
//     'desk'    sitting at a desk or console: both hands on its top just past the edge, typing now and then (a hand's
//               small taps), now and then one hand along to another place on it and back
//     'panel'   standing at a console: both hands on it, now and then one along to press something and back
//     'wipe'    standing at a counter: the left hand flat on it, the right wiping round in small circles
//     (S.apart, S.lean: the work's own, in place of WORK's: a narrow top, one reached across to)
//   wheelLocal(chair, t, seed)   the two wrists on Cargo's forklift's steering wheel, in the driver's own frame
export const WORK = {
  desk: { in: 0.04, apart: 0.36, lean: 0.45, tap: 0.012, along: 0.12 },
  panel: { in: 0.06, apart: 0.38, lean: 0.24, along: 0.16 },
  wipe: { in: 0.05, left: [-0.2, 0.02], right: [0.12, 0.1], r: 0.055, round: 1.5, lean: 0.32 },
  // (how often a hand goes along to another place and back: every [least, most] seconds, taking `secs`)
  move: { every: [2.5, 6], secs: 1.4 },
};

export function surfaceAhead(floorAt, at, heading, { from = 0.2, to = 1.3, lo = 0.55, hi = 1.3, step = 0.05 } = {}) {
  const sx = Math.sin(heading), sz = Math.cos(heading);
  for (let d = from; d <= to + 1e-9; d += step) {
    const x = at[0] + sx * d, z = at[2] + sz * d, f = floorAt(x, z, at[1] + hi, hi - lo);
    if (f != null && f >= at[1] + lo - 1e-6 && f <= at[1] + hi + 1e-6) return { d, y: f };
  }
  return null;
}

// (a smooth number between -1 and 1 that wanders: a few sines, each person's own)
const wander = (t, seed, k = 1) => (Math.sin(t * 0.9 * k + seed) + Math.sin(t * 1.7 * k + seed * 2.3) * 0.5) / 1.5;
const ease = (u) => u * u * (3 - 2 * u);
// (now and then one hand goes along to another place on the work and back: how far along this moment, 0 at rest, for
// the hand `side` (-1 left, 1 right) only)
function along(t, seed) {
  const M = WORK.move, span = (M.every[0] + M.every[1]) / 2, k = Math.floor((t + seed * 3.1) / span), into = (t + seed * 3.1) - k * span;
  const r = Math.abs(Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453) % 1, side = r < 0.5 ? -1 : 1, dir = (r * 7) % 1 < 0.5 ? -1 : 1;
  if (into > M.secs) return { side, u: 0 };
  return { side, u: Math.sin(ease(into / M.secs) * Math.PI) * dir };
}

export function handsAt(kind, S, t, seed = 0) {
  const K = WORK[kind] || WORK.panel, h = S.heading, f = [Math.sin(h), 0, Math.cos(h)], r = [-Math.cos(h), 0, Math.sin(h)];
  // (a point on the work: `a` across (their right +), `b` in from its near edge, a little over its top)
  const on = (a, b, up = 0.012) => [S.at[0] + r[0] * a + f[0] * b, S.at[1] + up, S.at[2] + r[2] * a + f[2] * b];
  if (kind === 'wipe') {
    const w = (t / K.round + seed) * Math.PI * 2, c = K.right;
    return { hands: [on(K.left[0], K.left[1] + K.in), on(c[0] + Math.cos(w) * K.r, c[1] + K.in + Math.sin(w) * K.r * 0.7, 0.015)], lean: K.lean };
  }
  const g = along(t, seed), half = (S.apart || K.apart) / 2;
  const tapL = kind === 'desk' ? Math.max(0, Math.sin(t * 9 + seed)) * K.tap : 0, tapR = kind === 'desk' ? Math.max(0, Math.sin(t * 8.3 + seed * 1.7)) * K.tap : 0;
  const L = on(-half + (g.side < 0 ? g.u * K.along : 0) + wander(t, seed) * 0.01, K.in + wander(t, seed + 1) * 0.01, 0.012 + tapL);
  const R = on(half + (g.side > 0 ? g.u * K.along : 0) + wander(t, seed + 2) * 0.01, K.in + wander(t, seed + 3) * 0.01, 0.012 + tapR);
  return { hands: [L, R], lean: S.lean || K.lean };
}

// CARGO'S FORKLIFT'S STEERING WHEEL, read off the game's maker's own file (assets/cargo/forklift.glb, its points over
// and in front of the seat): its middle this far ahead of the seat's middle and up over the seat's cushion (m), its
// rim's radius (m), its top tipped forward from straight up (radians: the wheel lies back toward the driver)
export const FORKLIFT_WHEEL = { ahead: 0.505, up: 0.242, r: 0.147, tilt: 0.96, lean: 0.24 };
// the two wrists on it, in the driver's own frame (x their left, y up, z ahead; from their root, where the forklift
// seats them: `chair` m under the cushion's top), [left, right], a little forward of a quarter past nine and a quarter
// to three, easing round a little as they steer
export function wheelLocal(chair, t = 0, seed = 0) {
  const W = FORKLIFT_WHEEL, c = [0, chair + W.up, W.ahead], top = [0, Math.cos(W.tilt), Math.sin(W.tilt)], axis = [0, Math.sin(W.tilt), -Math.cos(W.tilt)];
  const a = 1.25 + wander(t, seed, 0.4) * 0.15;
  // (the wrist a little back from the rim, toward the driver, the hand round it)
  const at = (s) => [0, 1, 2].map((i) => c[i] + top[i] * Math.cos(a) * W.r + (i === 0 ? s * Math.sin(a) * W.r : 0) + axis[i] * 0.03);
  return [at(1), at(-1)];
}
