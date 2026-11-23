// THE FORKLIFT LAP IN CARGO, ITS RULES AS PLAIN NUMBERS (no three.js: the tests read this, and the game times a lap by
// it: src/cargolap.js). The game's maker, 2026-11-22: "It would be cool to have the game with the forklift too where if
// you go down there an employee might say they can do a lap in 30 seconds or whatever and you can get the forklift to a
// position and it will count down and time you. Maybe there can be some waypoints at the corners that you have to hit
// to make the time official." Where the start box and the waypoints are painted: kit/places-plan.js LAP (kit/store.js
// paints them).
//
//   THE START   the forklift driven onto the start box and stopped there, behind the line and facing it: a countdown
//               (3, 2, 1, go: it is held still meanwhile) and the clock starts.
//   THE LAP     round the racks. A waypoint is painted at each of the lap's four corners; one is HIT when any part of
//               the forklift comes over its painted square. They count in order: one hit before an earlier one has been
//               is hit, and the earlier ones are MISSED (they stay missed: going back does not mend it).
//   THE FINISH  the forks' tips back over the start line, the way the lap set off, stops the clock.
//   OFFICIAL    every waypoint hit: the time is official, and it is set against Cargo's loader's (LAP.time). One
//               missed: the time is shown, not official, with which were missed.
//   (a lap left: got off the forklift, or the clock past RULES.most: called off, nothing shown)
//
//   const L = makeLap()
//   L.step(pose, v, dt, { can, carrying })   each frame the player is on the forklift: pose { x, z, h } and speed as
//                             kit/forkliftdrive.js has them; can: a lap may be started now (no supply run being loaded)
//                             -> what happened: { count (the number now showing: 3, 2, 1), go, gate (a waypoint hit:
//                             its number), missed ([numbers] passed by), finish (the result), off (called off) }
//   L.s                       { phase: 'idle' | 'count' | 'run', n (the countdown's number), clock (s), hit, missed
//                             ([bool] by waypoint), next (the waypoint to hit next, from 0; 4: the line), on (where it
//                             stands on the start box: onBox), result (the last lap's, until the next countdown) }
//   L.held                    held still (the countdown): the game lets it go nowhere
//   L.cancel()                got off: a countdown or a lap is called off
//   onBox(pose)               -> { in (its middle is in the box), on (stood right to start), why (not on: 'face',
//                             'back' (over the line), 'forward' (short of the box), 'side') }
//   result: { time (s, to a tenth), official, missed: [numbers], beat (official and under the loader's), by (s) }
import { LAP } from './places-plan.js';
import { TRUCK, outline } from './forkliftround.js';
import { aabb, boxGap } from './forkliftdrive.js';

// count: the countdown (s: a second for each of 3, 2, 1); still: stopped this long on the box before it begins (s),
// stopped being slower than `slow` (m/s); face: facing the line within this (radians); over: its forks' tips no
// further over the line than this (m); hang: its back end no further out of the back of the box than this, its sides no
// further out of the box's sides than `side` (m); away: the line ends a lap only once its forks' tips have been this far
// from it (m); most: a lap left running is called off after this long (s)
export const RULES = { count: 3, still: 0.35, slow: 0.08, face: 0.6, over: 0.15, hang: 0.6, side: 0.25, away: 8, most: 300 };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const fwd = (h) => [Math.cos(h), -Math.sin(h)], right = (h) => [Math.sin(h), Math.cos(h)];
// THE START BOX in its own frame: its middle, the way the lap sets off (f) and across it (r), half its length and width;
// the line is its edge on the side the lap sets off to
const [BX0, BX1, BZ0, BZ1] = LAP.box;
export const BOX = { c: [(BX0 + BX1) / 2, (BZ0 + BZ1) / 2], f: fwd(LAP.face), r: right(LAP.face) };
BOX.hl = Math.abs(BOX.f[0]) > 0.5 ? (BX1 - BX0) / 2 : (BZ1 - BZ0) / 2;
BOX.hw = Math.abs(BOX.f[0]) > 0.5 ? (BZ1 - BZ0) / 2 : (BX1 - BX0) / 2;
// (the line: a point on it, and how far it reaches either side of the box's middle line: across the lane, LAP.lane)
export const LINE = { at: [BOX.c[0] + BOX.f[0] * BOX.hl, BOX.c[1] + BOX.f[1] * BOX.hl] };
{ const [a, b] = LAP.lane.map((v) => (Math.abs(BOX.f[0]) > 0.5 ? (v - LINE.at[1]) * BOX.r[1] : (v - LINE.at[0]) * BOX.r[0])); LINE.reach = [Math.min(a, b), Math.max(a, b)]; }
// where the forklift stands exactly on the box: in its middle, its forks' tips a hand short of the line
export const START = { x: LINE.at[0] - BOX.f[0] * (TRUCK.tips + 0.1), z: LINE.at[1] - BOX.f[1] * (TRUCK.tips + 0.1), h: LAP.face };
// THE WAYPOINTS: each { n (its number, from 1), at: [x, z] (the corner of the lap), box: [x0, x1, z0, z1] (its painted square) }
export const GATES = LAP.corners.map((at, i) => ({ n: i + 1, at, box: [at[0] - LAP.gate / 2, at[0] + LAP.gate / 2, at[1] - LAP.gate / 2, at[1] + LAP.gate / 2] }));
const GATE_BOX = GATES.map((g) => aabb('waypoint ' + g.n, g.box));

// how far its forks' tips are past the line (m: below 0, short of it), and how far across from the box's middle line
export function nose(p) {
  const f = fwd(p.h), x = p.x + f[0] * TRUCK.tips - LINE.at[0], z = p.z + f[1] * TRUCK.tips - LINE.at[1];
  return { past: x * BOX.f[0] + z * BOX.f[1], across: x * BOX.r[0] + z * BOX.r[1] };
}
export function onBox(p) {
  const dx = p.x - BOX.c[0], dz = p.z - BOX.c[1], u = dx * BOX.f[0] + dz * BOX.f[1], v = dx * BOX.r[0] + dz * BOX.r[1], dh = wrap(p.h - LAP.face);
  const inside = Math.abs(u) <= BOX.hl && Math.abs(v) <= BOX.hw;
  // (its two ends along the lap's way, turned as it is: the tips ahead, its back end behind)
  const reach = Math.abs(Math.cos(dh)) * TRUCK.tips + Math.abs(Math.sin(dh)) * TRUCK.half;
  let why = null;
  if (Math.abs(dh) > RULES.face) why = 'face';
  else if (u + reach > BOX.hl + RULES.over) why = 'back';
  else if (u - reach < -BOX.hl - RULES.hang) why = 'forward';
  else if (Math.abs(v) + TRUCK.half > BOX.hw + RULES.side) why = 'side';
  return { in: inside, on: !why, why };
}
// a time as it is shown and judged: to a tenth of a second
export const tenth = (t) => Math.round(t * 10) / 10;
export function resultOf(clock, hit) {
  const missed = GATES.filter((g, i) => !hit[i]).map((g) => g.n), time = tenth(clock), official = !missed.length;
  return { time, official, missed, beat: official && time < LAP.time, by: +(LAP.time - time).toFixed(1), loader: LAP.time };
}

export function makeLap() {
  const s = { phase: 'idle', n: 0, clock: 0, hit: GATES.map(() => false), missed: GATES.map(() => false), next: 0, on: null, result: null };
  let still = 0, left = 0, far = 0, was = null;
  const L = { s, get held() { return s.phase === 'count'; } };
  const idle = () => { s.phase = 'idle'; s.n = 0; still = 0; };
  L.cancel = () => { const off = s.phase !== 'idle'; idle(); return off; };
  L.step = (p, v = 0, dt = 1 / 60, { can = true, carrying = false } = {}) => {
    const ev = {};
    s.on = can ? onBox(p) : null;
    if (s.phase === 'idle') {
      // stopped on the box, behind the line and facing it: the countdown
      still = can && s.on && s.on.on && Math.abs(v) < RULES.slow ? still + dt : 0;
      if (still >= RULES.still) { s.phase = 'count'; left = RULES.count; s.n = Math.ceil(left); s.result = null; s.clock = 0; s.hit.fill(false); s.missed.fill(false); s.next = 0; ev.count = s.n; }
      return ev;
    }
    if (s.phase === 'count') {
      if (!can) { idle(); ev.off = 'cannot'; return ev; }
      left -= dt;
      if (left > 0) { const n = Math.ceil(left); if (n !== s.n) { s.n = n; ev.count = n; } return ev; }
      // go: the clock starts (the part of this frame past the countdown's end is already on it)
      s.phase = 'run'; s.n = 0; s.clock = Math.max(0, -left); far = 0; was = nose(p); ev.go = true;
      return ev;
    }
    // THE LAP: the clock; the waypoints, in order; the line
    s.clock += dt;
    if (s.clock > RULES.most) { idle(); ev.off = 'left'; return ev; }
    const O = outline(p, carrying);
    for (let i = s.next; i < GATES.length; i++) {
      if (!O.some((o) => boxGap(o, GATE_BOX[i]) < 0)) continue;
      const passed = []; for (let k = s.next; k < i; k++) { s.missed[k] = true; passed.push(GATES[k].n); }
      s.hit[i] = true; s.next = i + 1; ev.gate = GATES[i].n; if (passed.length) ev.missed = passed;
      break;
    }
    const N = nose(p);
    far = Math.max(far, Math.hypot(N.past, N.across));
    if (far >= RULES.away && was.past < 0 && N.past >= 0 && N.across >= LINE.reach[0] && N.across <= LINE.reach[1]) {
      // (over the line part of the way through this frame: the clock stops at the crossing)
      const k = (N.past - 0) / Math.max(1e-9, N.past - was.past);
      s.result = resultOf(s.clock - k * dt, s.hit);
      for (let i = 0; i < GATES.length; i++) if (!s.hit[i]) s.missed[i] = true;
      idle(); ev.finish = s.result;
    }
    was = N;
    return ev;
  };
  return L;
}
