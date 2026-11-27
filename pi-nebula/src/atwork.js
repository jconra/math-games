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
//     'wipe'    standing at a counter: the left hand flat on it, the right wiping to and fro along it
//     'face'    standing at an upright face (S.points: [across, up] of its screen and buttons; S.at its foot): one hand
//               up to a point of it, tapping, then down a while; -> also share (each hand's part), palms, fingers
//     (S.apart, S.lean: the work's own, in place of WORK's: a narrow top, one reached across to; S.tilt: its top
//     rising to their right, m a metre; S.in: how far in past its edge the hands go, S.along: how far a hand goes
//     along it and back, each in place of WORK's)
//   wheelLocal(chair, t, seed)   the two wrists on Cargo's forklift's steering wheel, in the driver's own frame
export const WORK = {
  desk: { in: 0.04, apart: 0.36, lean: 0.45, tap: 0.012, along: 0.12 },
  panel: { in: 0.06, apart: 0.38, lean: 0.24, along: 0.16 },
  // (the cook's counter: wiped to and fro along its near strip, nearly upright, a little bow, his head clear of the
  // heat lamp over the counter (two critics, r3: folded over with his head up in the lamp's hood); his arms come down to
  // it nearly straight, as one wipes a counter standing)
  wipe: { in: 0.0, left: [-0.15, 0.02], right: [0.05, 0.02], stroke: 0.11, deep: 0.015, round: 1.7, lean: 0.35 },
  // (a face to work on, upright: the pump's screen; one hand goes to a point of it, taps a while, and comes down a
  // moment; a little bow the lower the point)
  face: { visit: [2.6, 4.0], rest: [0.5, 0.9], lean: [0.12, 0.3], tap: 0.012 },
  // (how often a hand goes along to another place and back: every [least, most] seconds, taking `secs`)
  move: { every: [1.4, 3.2], secs: 1.0 },
};

// WHAT EACH WORK HOLDS (people.js workOf), by the work's clip (life.js CLIPS) and by the place:
//   edge      where the work's near edge is, [m ahead, its top's height over their floor], for one the walls do not
//             know (the forge's console stands in a piece drawn apart from the walls' own floors)
//   tilt      its top rising to their right, m a metre (the forge console's band)
//   stepIn    how much nearer the work they stand while their hands are on it, m, eased in as they come to it: their
//             spot is where the walls and the others know them, a body's width off the work, and from there no arm on
//             the station reaches it with the elbow bent (the review, 2026-11-27: the cook's wipe, the furnace
//             console's and the pump's hands short in the air). Every hold is within REACH.most of the arm of each
//             body that works there: tests/reach.test.mjs; in the game, alarms.outOfReach says when one is not
// The cook at his counter (Bar_Polish): its top, wiped. The furnace's worker (Tend_Forge): the console's end, its
// band (kit/station2-options.js thermalConsole) 0.98 m up over his spot's line, east of its tall screen housing.
export const WORK_OF = {
  Bar_Polish: { kind: 'wipe', lo: 0.75, hi: 1.15, to: 0.9, stepIn: 0.25 },
  // (along: how far a hand goes along the band and back, kept short so the right hand never reaches the screen's
  // housing, 0.25 m to his right of his middle: the review, W12)
  Tend_Forge: { kind: 'panel', lo: 0.7, hi: 1.2, to: 1.0, edge: [0.5, 0.98], tilt: 0.34, lean: 0.7, apart: 0.24, along: 0.06, stepIn: 0.28 },
};
// By the place: a hangar's fuel pump (kit/hangar.js), its face 0.45 m in front of its spot (life.js SPOTS.pump):
// points of its screen (1.0 to 1.24 m up), [across, up], on his right side of it. Its three buttons at 0.7 m are under
// a standing arm's reach, and a stoop to them put his knees and head inside the cabinet (the review, W1 and W10): not
// sent there. (The lockers went back to the reach clip, as the game has them: two critics, r3, found the hand-on-the-
// handle hold too still, and the handle's place not every locker's.)
export const WORK_AT = {
  pump: { kind: 'face', face: 0.45, stepIn: 0.18, points: [[0, 1.12], [0.12, 1.16], [0.12, 1.06], [-0.04, 1.08]] },
};
// The medic at the big scanner while it runs (people.js MEDIC AT THE SCREEN): her hands on the board's end over its
// pedestal (kit/bigscanner.js: its top 0.85 m up, `back` m nearer her than the scanner's SCAN.panel point, `up` over
// it; the hands just in over its end, before the bed's pad), bowed over it: a 0.85 m top is low for a standing arm
export const SCAN_HOLD = { back: 0.1, up: 0.05, apart: 0.22, lean: 0.75, stepIn: 0.24 };

// REACH: where a shoulder joint is once the body bows `lean` (radians) over the work, the bow taken by the abdomen and
// the chest as moves.js lays it (M.bow: 0.75 and 0.25 of it, each about its own joint, low in the back so the
// shoulders come down to the work): sh, ab, ch [x, y, z] in the person's own frame (x their left, y up, z ahead, from
// their feet); most: the farthest a hold is put, of the arm's whole length (0.97: the elbow still bent by 28 degrees
// or more; the arms are 0.92 of the suits' own, the game's maker's answer, so a 0.85 to 1 m top is reached bowed)
export const REACH = { abdomen: 0.75, chest: 0.25, most: 0.97 };
const turnX = (p, c, a) => { const y = p[1] - c[1], z = p[2] - c[2], co = Math.cos(a), si = Math.sin(a); return [p[0], c[1] + y * co - z * si, c[2] + y * si + z * co]; };
export function shoulderAt(sh, ab, ch, lean) {
  // (the chest's turn first, about its joint; then the abdomen's, which carries the chest's joint and all above it)
  return turnX(turnX(sh, ch, lean * REACH.chest), ab, lean * REACH.abdomen);
}

export function surfaceAhead(floorAt, at, heading, { from = 0.2, to = 1.3, lo = 0.55, hi = 1.3, step = 0.05 } = {}) {
  const sx = Math.sin(heading), sz = Math.cos(heading);
  for (let d = from; d <= to + 1e-9; d += step) {
    const x = at[0] + sx * d, z = at[2] + sz * d, f = floorAt(x, z, at[1] + hi, hi - lo);
    if (f != null && f >= at[1] + lo - 1e-6 && f <= at[1] + hi + 1e-6) {
      // (its edge found exactly, to a centimetre, between the last step that missed it and this one: the hands go just
      // past the edge itself, not up to a step's length further in (the review, W3))
      let a = Math.max(from, d - step), b = d;
      for (let i = 0; i < 4 && d > from; i++) { const m = (a + b) / 2, g = floorAt(at[0] + sx * m, at[2] + sz * m, at[1] + hi, hi - lo); if (g != null && g >= at[1] + lo - 1e-6 && g <= at[1] + hi + 1e-6) b = m; else a = m; }
      return { d: b, y: f };
    }
  }
  return null;
}

// (a smooth number between -1 and 1 that wanders: a few sines, each person's own)
const wander = (t, seed, k = 1) => (Math.sin(t * 0.9 * k + seed) + Math.sin(t * 1.7 * k + seed * 2.3) * 0.5) / 1.5;
const ease = (u) => u * u * (3 - 2 * u);
// (now and then one hand goes along to another place on the work and back: how far along this moment, 0 at rest, for
// the hand `side` (-1 left, 1 right) only)
function along(t, seed, o = {}) {
  const M = WORK.move, span = (M.every[0] + M.every[1]) / 2, k = Math.floor((t + seed * 3.1) / span), into = (t + seed * 3.1) - k * span;
  const r = Math.abs(Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453) % 1, dir = (r * 7) % 1 < 0.5 ? -1 : 1;
  o.side = r < 0.5 ? -1 : 1; o.u = into > M.secs ? 0 : Math.sin(ease(into / M.secs) * Math.PI) * dir;
  return o;
}

// (out: a record kept per person and written into, so a hold laid each frame makes nothing new; one is made if none)
const FINGERS_UP = [null, [0, 1, 0]];
export function handsAt(kind, S, t, seed = 0, out = null) {
  const O = out || {}, K = WORK[kind] || WORK.panel, h = S.heading;
  if (!O.pair) { O.h0 = [0, 0, 0]; O.h1 = [0, 0, 0]; O.pair = [null, null]; O.f = [0, 0, 0]; O.r = [0, 0, 0]; O.sh = [0, 0]; O.pa = [null, null]; }
  const f = O.f, r = O.r; f[0] = Math.sin(h); f[2] = Math.cos(h); r[0] = -Math.cos(h); r[2] = Math.sin(h);
  // (a point on the work: `a` across (their right +), `b` in from its near edge, a little over its top)
  // (S.tilt: a top that rises to their right, m a metre across)
  const on = (a, b, up, d) => { d[0] = S.at[0] + r[0] * a + f[0] * b; d[1] = S.at[1] + up + (S.tilt || 0) * a; d[2] = S.at[2] + r[2] * a + f[2] * b; return d; };
  O.share = null; O.palms = null; O.fingers = null; O.hands = O.pair;
  if (kind === 'wipe') {
    // (to and fro along the counter, a little in and out, never quite the same twice; the other hand moves a little too)
    const w = (t / K.round + seed) * Math.PI * 2, c = K.right, sw = Math.sin(w) + 0.25 * Math.sin(w * 2.3 + seed);
    O.pair[0] = on(K.left[0] + wander(t, seed) * 0.03, K.left[1] + K.in, 0.012, O.h0);
    O.pair[1] = on(c[0] + sw * K.stroke, c[1] + K.in + Math.sin(w * 2) * K.deep, 0.015, O.h1);
    O.lean = K.lean;
    return O;
  }
  if (kind === 'face') {
    // (S.points: [across, up] on the face, from its foot in front of them; a visit: up to one, a tap or two, down)
    const F = WORK.face, span = (F.visit[0] + F.visit[1]) / 2 + (F.rest[0] + F.rest[1]) / 2, n = Math.floor((t + seed) / span), into = (t + seed) - n * span;
    const q = Math.abs(Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453) % 1, pt = S.points[Math.floor(q * S.points.length) % S.points.length], visit = F.visit[0] + q * (F.visit[1] - F.visit[0]);
    const u = into < visit ? Math.max(0, Math.min(1, Math.min(into, visit - into) / 0.35)) : 0, k = u * u * (3 - 2 * u);
    const low = Math.max(0, Math.min(1, (1.15 - pt[1]) / 0.45));
    const tap = k > 0.99 ? Math.max(0, Math.sin(into * 8 + seed)) * F.tap : 0;
    const R = O.h1; R[0] = S.at[0] + r[0] * pt[0] - f[0] * (0.04 - tap); R[1] = S.at[1] + pt[1]; R[2] = S.at[2] + r[2] * pt[0] - f[2] * (0.04 - tap);
    O.pair[0] = null; O.pair[1] = R; O.sh[0] = 0; O.sh[1] = k; O.share = O.sh; O.pa[1] = f; O.palms = O.pa; O.fingers = FINGERS_UP;
    O.lean = F.lean[0] + (F.lean[1] - F.lean[0]) * low * k;
    return O;
  }
  along(t, seed, O);
  const half = (S.apart || K.apart) / 2;
  const tp = K.tap || 0.008, tapL = Math.max(0, Math.sin(t * 9 + seed)) * tp, tapR = Math.max(0, Math.sin(t * 8.3 + seed * 1.7)) * tp;
  const IN = S.in ?? K.in, AL = S.along ?? K.along;
  O.pair[0] = on(-half + (O.side < 0 ? O.u * AL : 0) + wander(t, seed) * 0.01, IN + wander(t, seed + 1) * 0.01, 0.012 + tapL, O.h0);
  O.pair[1] = on(half + (O.side > 0 ? O.u * AL : 0) + wander(t, seed + 2) * 0.01, IN + wander(t, seed + 3) * 0.01, 0.012 + tapR, O.h1);
  O.lean = S.lean || K.lean;
  return O;
}

// CARGO'S FORKLIFT'S STEERING WHEEL, read off the game's maker's own file (assets/cargo/forklift.glb, its points over
// and in front of the seat): its middle this far ahead of the seat's middle and up over the seat's cushion (m), its
// rim's radius (m), its top tipped forward from straight up (radians: the wheel lies back toward the driver); bow: how far
// the seated driver bows to it (moves.js M.bow: measured in the game, the hands fell 5 to 7.5 cm short of the rim with
// the old lean of 0.3 taken high in the back)
export const FORKLIFT_WHEEL = { ahead: 0.505, up: 0.242, r: 0.147, tilt: 0.96, lean: 0.3, bow: 0.5, at: 1.85 };
// the two wrists on it, in the driver's own frame (x their left, y up, z ahead; from their root, where the forklift
// seats them: `chair` m under the cushion's top), [left, right], a little forward of a quarter past nine and a quarter
// to three, easing round a little as they steer
// (out: [left, right] arrays written into, kept by the caller, so a hold each frame makes nothing new)
export function wheelLocal(chair, t = 0, seed = 0, out = [[0, 0, 0], [0, 0, 0]]) {
  const W = FORKLIFT_WHEEL, ct = Math.cos(W.tilt), stl = Math.sin(W.tilt);
  // (on the rim's near half, a little toward the driver of a quarter past nine and a quarter to three: the elbows bend)
  const a = W.at + wander(t, seed, 0.4) * 0.15, ca = Math.cos(a) * W.r, sa = Math.sin(a) * W.r;
  // (the wrist just outside the rim and toward the driver, the hand round it: the middle, along the rim's top way, out
  // to the side, a little along its axis toward them)
  for (const [i, s] of [[0, 1], [1, -1]]) { const o = out[i]; o[0] = s * (sa + 0.03); o[1] = chair + W.up + ct * ca + stl * 0.02; o[2] = W.ahead + stl * ca - ct * 0.02; }
  return out;
}
// the hold of both hands round the wheel's rim, for moves.js M.hold (its own frame: local): the wrists (wheelLocal), each
// palm toward the wheel's middle, the fingers forward over the rim, the elbows down and out; `share`: each hand's part
// (getting on, the right hand reaches for it first)
const PALMS = [[-1, -0.2, 0], [1, -0.2, 0]], FINGERS = [[0, 0.45, 1], [0, 0.45, 1]], ELBOWS = [[0.6, -1, -0.4], [-0.6, -1, -0.4]];
export function wheelHold(chair, t = 0, seed = 0, share = [1, 1], out = {}) {
  out.hands = wheelLocal(chair, t, seed, out.hands); out.local = true; out.palms = PALMS; out.fingers = FINGERS; out.elbows = ELBOWS; out.share = share;
  return out;
}
