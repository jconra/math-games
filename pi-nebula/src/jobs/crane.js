// THE CRANE GAME at the operator's chair: the crane system reports a fault and asks the crew member to verify crane
// operations, one move at a time, credits for each right answer. The game's maker, 2026-11-16: "if the player goes to
// the chair then it could say the system is having a malfunction, please verify crane operations. Then it could ask
// basically any math questions like identifying the coordinates of the pods with a overhead camera and a overlaid
// grid. And/or doing math to figure out how much further the crane needs to travel to get into the correct position
// ... With each math question answered they could get paid some credits ... I wonder if it might be better to have a
// single option to get into the seat and then when the crane operator UI comes up then you can select a toggle button
// for 'Free Control', but otherwise it will guide you through problems to calculate the measurements for picking up
// and dropping off the containers ... we just want to make sure there are no big jumps in difficulty."
//
// THE ANSWERS ARE THE MOVES. The crane does the round's own trips (planned from where everything is: kit/crane-plan.js
// planFrom's next), one canister at a time: over the canister (x and y at once), down to it, the grab, up, the turn,
// over the place it goes to, down to it, in (a socket), let go, up. Five of those moves are asked about in each trip:
// over the canister, down to it, the turn (where a level asks about turns; else the crane turns by itself), over the
// place, down to it. A right answer and the crane makes that move, by exactly the answer (src/jobs/cranelink.js works
// the live crane, kit/crane-drive.js), and a short film of it shows it go. Five answers are one check; some of the
// round's other canisters "magically" take their places as the check goes on (his words: "the crane game should last
// a couple minutes (maybe 5 questions) and maybe some of the canisters should magically appear in the sockets during
// the game"), so a check moves a whole part of the round along.
// The numbers are the hangar's GRID (the station file's place 'crane' grid: metres from the hangar's south-west corner,
// x along the hangar, y across it, on the screen from above with x to the right and y up), the height the hoist's (on
// the trolley's screen and the operator's), the turn in degrees. Before an asked move the crane lines itself up on the
// level's marks (a whole metre, a tenth, a hundredth) and after it onto the place itself, so "x = 12 to x = 22" is
// exactly 10 m.
//
// The ladder, easiest first (Mathwood's school guide in brackets: 0 starting kindergarten ... 80 eighth grade), each a
// small step from the last: which quadrant (2); counting squares (6); reading the grid (10); how far along x or y (18);
// coordinates (24); turns in degrees (32); up is plus, down is minus (36); time from speed (40); tenths (48); hundredths
// (56); time with tenths (62); both ways at once (70); straight across (78).
//
//   tripFrom(site, S) -> { c, from, to, phase }    the round's next trip from a state (a test lift when it is done)
//   makeGame(site, { state, hurry }) -> Q            the trip's moves held for the questions (Q.ask, Q.before, Q.right)
//   the makers read `live` (src/jobs/cranelink.js now()): live.ask(kind, opts) reserves the next asked move of that kind
//   and gives its numbers on the level's marks; without it (node, the levels page) a maker's numbers are its own
import { dec } from '../../../mathwood-valley/src/math/counterkit.js';
import { makeCard, classify as signSlip } from '../../../mathwood-valley/src/math/negatives.js';
import { ownOrder } from './engine.js';
import { planFrom, alongNear, near0, SPEED } from '../../kit/crane-plan.js';
import { picture } from './cranepics.js';

export const GAME = { questions: 5 };
// the speeds the questions give (the crane's own: kit/crane-plan.js SPEED): the bridge along x, the trolley along y,
// the hoist up and down (metres a second)
export const SPEEDS = { x: SPEED.bridge.v, y: SPEED.trolley.v, h: SPEED.hoist.v };
export const CHANGE_AT = 1000;   // (a plus-or-minus answer's button value: the change plus this, so it is above zero)
const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
const METRE = ['metre', 'metres'], SEC = ['second', 'seconds'], DEG = ['degree', 'degrees'], SQUARE = ['square', 'squares'];
const r2 = (x) => Math.round(x * 100) / 100;
const t2 = (x) => dec(Math.round(x * 100), 2, { trim: true });          // 13.95 -> "13.95", 12 -> "12"
const kit = (rand) => ({ int: (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)), pick: (a) => a[Math.floor(rand() * a.length)], chance: (p) => rand() < p });
// an answer: its value, the number big, the unit small
const F = (v, unit, { sign = false } = {}) => { const n = r2(v), big = (sign && n > 0 ? '+' : '') + (n < 0 ? '−' : '') + t2(Math.abs(n)); return { v: n, big, small: Math.abs(n) === 1 ? unit[0] : unit[1], label: `${big} ${Math.abs(n) === 1 ? unit[0] : unit[1]}` }; };
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const ROMAN = ['I', 'II', 'III', 'IV'];

// ── the grid ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const gridOf = (site) => ({ origin: site.grid?.origin || [0, 0], size: site.grid?.size || [40, 28] });
export const toGrid = (site, X, Z) => { const g = gridOf(site); return [r2(X - g.origin[0]), r2(g.origin[1] - Z)]; };
export const fromGrid = (site, gx, gy) => { const g = gridOf(site); return [gx + g.origin[0], g.origin[1] - gy]; };
// which quadrant a point of the grid is in (the grid's middle lines; I top right, II top left, III bottom left, IV
// bottom right, as a coordinate plane's), or 0 on a middle line
export function quadrantOf(site, gx, gy) {
  const [w, h] = gridOf(site).size, cx = w / 2, cy = h / 2;
  if (Math.abs(gx - cx) < 0.3 || Math.abs(gy - cy) < 0.3) return 0;
  return gx > cx ? (gy > cy ? 1 : 4) : (gy > cy ? 2 : 3);
}

// ── the places ───────────────────────────────────────────────────────────────────────────────────────────────────
// the Miner's places by name (the game's maker: "Upper-Forward-Starboard ... I wouldn't make the player depend on that
// knowledge. You can just use it in the questions though"): its row, its end (its nose is the way +x of the hangar
// when parked nose +x), its side (port is its left, looking forward)
export function mountName(site, i) {
  const M = site.mounts, m = M[i], mx = M.reduce((q, a) => q + a.at[0], 0) / M.length, mz = M.reduce((q, a) => q + a.at[2], 0) / M.length;
  const nose = site.nose || 1;
  return `${m.upper ? 'Upper' : 'Lower'}-${(m.at[0] - mx) * nose > 0 ? 'Forward' : 'Aft'}-${(m.at[2] - mz) * nose < 0 ? 'Port' : 'Starboard'}`;
}
// a place, where the crane goes for it: the hook's point there (a canister's middle at rest; a mount's tray slid out),
// the way a canister lies there, and in words
export function placeOf(site, kind, i) {
  if (kind === 'mount') { const m = site.mounts[i]; return { kind, i, at: [m.at[0] + m.out[0], m.at[1] + site.can.lift, m.at[2] + m.out[1]], axis: m.yaw, name: `the ${mountName(site, i)} tray`, short: 'the ship\'s tray' }; }
  if (kind === 'socket') {
    const k = site.sockets[i], n = k.n, h = site.can.half, D = [k.at[0] + n[0] * (h - site.can.seat), k.at[1], k.at[2] + n[1] * (h - site.can.seat)], W = [k.at[0] + n[0] * (h + site.can.clear), k.at[2] + n[1] * (h + site.can.clear)];
    return { kind, i, at: D, wait: W, axis: Math.atan2(n[0], n[1]), name: `socket ${k.number || i + 1}`, short: `socket ${k.number || i + 1}`, number: k.number || i + 1 };
  }
  const b = site.bays[i]; return { kind: 'bay', i, at: [...b.at], axis: b.yaw ?? 0, name: `bay ${i + 1} of the rack`, short: 'the rack' };
}

// ── the next trip ────────────────────────────────────────────────────────────────────────────────────────────────
const plainState = (S) => ({ x: S.x, z: S.z, yaw: S.yaw, hoist: S.hoist, arms: S.arms, latch: S.latch, tray: [...S.tray], iris: [...S.iris], lit: [...S.lit], cans: S.cans.map((q) => ({ ...q })) });
// the round's next trip from a state: the first canister planFrom moves, where from (null: in the cradle now) and to;
// with nothing left to do, a test lift: an empty canister from the rack to a free socket, or back
export function tripFrom(site, S) {
  let plan = null;
  try { plan = planFrom(site, plainState(S)); } catch (e) { plan = null; }
  if (plan) {
    let best = null;
    plan.cans.forEach((can, c) => { const k = can.spans.findIndex((s) => s.where === 'held'); if (k < 0) return; if (!best || can.spans[k].t0 < best.t0) best = { c, k, t0: can.spans[k].t0 }; });
    if (best) {
      const sp = plan.cans[best.c].spans, a = best.k > 0 ? sp[best.k - 1] : null, b = sp[best.k + 1];
      if (b) {
        const full = S.cans[best.c].fill > 0.01;
        const phase = b.where === 'socket' && full ? 'unload' : b.where === 'mount' ? 'load' : a && a.where === 'socket' ? 'clear' : 'move';
        return { c: best.c, from: a && a.where !== 'held' ? { kind: a.where, i: a.i } : null, to: { kind: b.where, i: b.i }, phase };
      }
    }
  }
  // (the round is done: a test lift)
  const held = S.cans.findIndex((q) => q.where === 'held');
  const freeSock = site.sockets.map((_, k) => k).filter((k) => !S.cans.some((q) => q.where === 'socket' && q.i === k));
  const lowerFree = freeSock.filter((k) => !site.sockets[k].upper);
  const freeBay = site.bays.map((_, j) => j).filter((j) => !S.cans.some((q) => q.where === 'bay' && q.i === j));
  if (held >= 0) return freeBay.length ? { c: held, from: null, to: { kind: 'bay', i: freeBay[0] }, phase: 'test' } : null;
  const inSock = S.cans.findIndex((q) => q.where === 'socket' && q.fill <= 0.01 && !(site.sockets[q.i].upper === false && S.cans.some((r) => r.where === 'socket' && site.sockets[r.i].upper && Math.abs(site.sockets[r.i].at[0] - site.sockets[q.i].at[0]) < 0.1)));
  if (inSock >= 0 && freeBay.length) return { c: inSock, from: { kind: 'socket', i: S.cans[inSock].i }, to: { kind: 'bay', i: freeBay[0] }, phase: 'test' };
  const onRack = S.cans.findIndex((q) => q.where === 'bay');
  const k = lowerFree[0] ?? freeSock[0];
  if (onRack >= 0 && k != null) return { c: onRack, from: { kind: 'bay', i: S.cans[onRack].i }, to: { kind: 'socket', i: k }, phase: 'test' };
  return null;
}

// ── a trip's moves ─────────────────────────────────────────────────────────────────────────────────────────────────
// each: an autopilot step for the live crane (kit/crane-drive.js go), and, for the five a trip asks about, `ask`:
// 'over' (x and y to a place), 'lower' (down to it), 'turn' (the cradle turning the canister)
function movesOf(site, S, trip) {
  const out = [], carry = site.carry, rise = site.can.rise, push = SPEED.push.v;
  let yaw = S.yaw;
  const c = trip.c, rel = trip.from ? 0 : (S.cans[c].rel || 0);
  if (trip.from) {
    const P = placeOf(site, trip.from.kind, trip.from.i), yawP = alongNear(S.cans[c].yaw, yaw);
    yaw = yawP;
    if (P.kind === 'socket') {
      out.push({ ask: 'over', what: 'pick', place: P, c, to: { x: P.wait[0], z: P.wait[1], yaw: yawP }, aim: [P.at[0], P.at[2]] });
      out.push({ ask: 'lower', what: 'pick', place: P, c, from: carry, to: { hoist: P.at[1] }, via: [{ to: { hoist: P.at[1] + rise } }, { to: { x: P.at[0], z: P.at[2] } }] });
      out.push({ grab: 'shut' }, { until: 'held', c });
      out.push({ to: { x: P.wait[0], z: P.wait[1] }, v: { x: push, z: push }, even: true });
    } else {
      out.push({ ask: 'over', what: 'pick', place: P, c, to: { x: P.at[0], z: P.at[2], yaw: yawP } });
      if (P.kind === 'mount') out.push({ until: 'tray', i: P.i });
      out.push({ ask: 'lower', what: 'pick', place: P, c, from: carry, to: { hoist: P.at[1] } });
      out.push({ grab: 'shut' }, { until: 'held', c });
    }
    out.push({ to: { hoist: carry } });
  }
  const D = placeOf(site, trip.to.kind, trip.to.i), canYaw = yaw + (trip.from ? 0 : rel);
  // (the canister's own turn in the cradle when it was taken: 0 or a half turn; the cradle turns it to lie the place's way)
  const relNow = trip.from ? near0(S.cans[c].yaw - yaw) : rel, yawD = alongNear(D.axis - relNow, yaw), deg = Math.round(Math.abs(yawD - yaw) * 180 / Math.PI);
  out.push({ ask: deg === 90 ? 'turn' : null, what: 'turn', place: D, c, to: { yaw: yawD }, deg, fromAxis: Math.abs(Math.sin(canYaw)) > 0.5 ? 'x' : 'y', toAxis: Math.abs(Math.sin(D.axis)) > 0.5 ? 'x' : 'y' });
  if (D.kind === 'socket') {
    out.push({ ask: 'over', what: 'drop', place: D, c, to: { x: D.wait[0], z: D.wait[1] }, aim: [D.at[0], D.at[2]] });
    out.push({ ask: 'lower', what: 'drop', place: D, c, from: carry, to: { hoist: D.at[1] } });
    out.push({ to: { x: D.at[0], z: D.at[2] }, v: { x: push, z: push }, even: true }, { until: 'lit', k: D.i }, { grab: 'open' });
    out.push({ to: { hoist: D.at[1] + rise } }, { to: { x: D.wait[0], z: D.wait[1] } }, { to: { hoist: carry } });
  } else {
    out.push({ ask: 'over', what: 'drop', place: D, c, to: { x: D.at[0], z: D.at[2] } });
    if (D.kind === 'mount') out.push({ until: 'tray', i: D.i });
    out.push({ ask: 'lower', what: 'drop', place: D, c, from: carry, to: { hoist: D.at[1] } });
    out.push({ grab: 'open' }, { to: { hoist: carry } });
  }
  return out;
}

// ── the game's queue: the trip's moves, held for the questions ─────────────────────────────────────────────────────
// Q.peek()                  the kind the next asked move is ('over', 'lower', 'turn'), or null (no trip)
// Q.ask(kind, opts)         that move, reserved for a card, its numbers on the level's marks (opts.prec, opts.axis,
//                           opts.most: no further than this, the crane getting nearer by itself first): { id, kind,
//                           axis, from, to, target, what, place, c, ... } in the grid's numbers; null if it is not next
// Q.before()                the autopilot steps up to the asked move (the crane makes them as the card comes)
// Q.right(value)            the asked move by exactly that value, then onto the place itself: the steps
// Q.skip()                  a card that asked about no move: the next asked move made by itself
// Q.restart()               planned again from the crane as it is
export function makeGame(site, { state }) {
  const Q = { trip: null, moves: [], reserved: null, n: 0 };
  function plan() {
    const S = state(); Q.trip = tripFrom(site, S); Q.moves = Q.trip ? movesOf(site, S, Q.trip) : []; Q.reserved = null;
    return Q.trip;
  }
  const stepsOf = (m) => (m.until ? [{ until: m.until, i: m.i, k: m.k, c: m.c }] : m.grab ? [{ grab: m.grab }] : [...(m.via || []), { to: m.to, v: m.v, even: m.even }]);
  Q.peek = () => { if (!Q.moves.length) plan(); const m = Q.moves.find((q) => q.ask); return m ? m.ask : null; };
  Q.restart = () => { plan(); return Q; };
  // the asked move's numbers on the level's marks: where the crane starts it, where the answer takes it
  Q.ask = (kind, opts2 = {}) => {
    const { prec = 1, axis = 'auto', most = Infinity, least = 0, rand = Math.random, round = 'near' } = opts2;
    if (!Q.moves.length && !plan()) return null;
    const k = Q.moves.findIndex((q) => q.ask);
    if (k < 0 || Q.moves[k].ask !== kind) return null;
    const m = Q.moves[k], S = state(), pre = [];
    const onMark = (v, how = round) => r2((how === 'up' ? Math.ceil(v / prec - 1e-9) : how === 'down' ? Math.floor(v / prec + 1e-9) : Math.round(v / prec)) * prec);
    let R;
    if (kind === 'over') {
      // where the crane is now (after the moves before this one), and the place, in the grid's numbers
      const hereW = endOf(Q.moves.slice(0, k), S), here = toGrid(site, hereW.x, hereW.z), there = toGrid(site, m.to.x, m.to.z);
      const aim = m.aim ? toGrid(site, m.aim[0], m.aim[1]) : there;
      // (one axis, or both: an axis of its own is asked with the other already lined up by itself)
      const ax = axis === 'auto' ? (Math.abs(there[0] - here[0]) >= Math.abs(there[1] - here[1]) ? 'x' : 'y') : axis;
      // (toward a socket's line, y is taken to the mark short of the wall)
      const toMark = (v, a) => onMark(v, m.place.kind === 'socket' && a === 'y' ? 'down' : round);
      const target = [toMark(there[0], 'x'), toMark(there[1], 'y')];
      // (where the hook can go, in the grid's numbers, a mark inside it at each end)
      const g0 = gridOf(site).origin, reach = [[site.rail.x[0] - g0[0], site.rail.x[1] - g0[0]], [g0[1] - site.rail.z[1], g0[1] - site.rail.z[0]]];
      const inside = (v, i) => Math.min(onMark(reach[i][1], 'down'), Math.max(onMark(reach[i][0], 'up'), v));
      let start = [inside(onMark(here[0]), 0), inside(onMark(here[1]), 1)];
      if (ax === 'x' || ax === 'y') {
        const i = ax === 'x' ? 0 : 1, j = 1 - i;
        start[j] = target[j];
        // (no further than `most`, no nearer than `least`: the crane gets there by itself first)
        let d = target[i] - start[i];
        if (Math.abs(d) > most) start[i] = r2(target[i] - Math.sign(d) * most);
        d = target[i] - start[i];
        if (Math.abs(d) < least) { const w = d >= 0 ? 1 : -1, s1 = r2(target[i] - w * least); start[i] = s1 >= reach[i][0] && s1 <= reach[i][1] ? s1 : r2(target[i] + w * least); }
      } else if (opts2.straight || opts2.both) {
        // (two moves at once: from a start that makes the numbers come out whole, inside the crane's reach)
        const shapes = opts2.straight ? [[3, 4], [4, 3], [6, 8], [8, 6], [5, 12], [12, 5], [9, 12], [12, 9], [8, 15], [12, 16], [16, 12]] : [];
        if (opts2.both) for (let a = 2; a <= 9; a++) for (let b = 1; b <= 6; b++) if (a !== b * 1.5) shapes.push([a * SPEEDS.x, b * 2 * SPEEDS.y]);
        const fits = [];
        for (const [dx, dy] of shapes) for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const p = [r2(target[0] - sx * dx), r2(target[1] - sy * dy)]; if (p[0] >= reach[0][0] && p[0] <= reach[0][1] && p[1] >= reach[1][0] && p[1] <= reach[1][1]) fits.push(p); }
        if (fits.length) start = fits[Math.floor(rand() * fits.length)];
      }
      const sw = fromGrid(site, start[0], start[1]);
      pre.push({ to: { x: sw[0], z: sw[1], yaw: m.to.yaw } });
      R = { kind, axis: ax, from: start, to: target, there, aim, quad: quadrantOf(site, aim[0], aim[1]) };
    } else if (kind === 'lower') {
      // (from a mark at or under the top, to the mark at or above the place: it never goes below it on an answer)
      const from = onMark(site.carry, 'down'), to = onMark(m.to.hoist, 'up');
      pre.push({ to: { hoist: from } });
      R = { kind, from, to, there: m.to.hoist };
    } else {
      R = { kind, deg: m.deg, fromAxis: m.fromAxis, toAxis: m.toAxis };
    }
    Q.reserved = { ...R, id: ++Q.n, k, what: m.what, place: m.place, c: m.c, pre };
    return Q.reserved;
  };
  // the steps up to the reserved move: the moves before it, and onto its starting marks
  Q.before = () => {
    const R = Q.reserved; if (!R) return [];
    const steps = Q.moves.slice(0, R.k).flatMap(stepsOf).concat(R.pre);
    Q.moves.splice(0, R.k); R.k = 0;
    return steps;
  };
  // the reserved move by exactly the answer, then onto the place itself
  Q.right = (value = null, { even = false, v = null } = {}) => {
    const R = Q.reserved; if (!R) return Q.skip();
    const m = Q.moves[R.k]; Q.moves.splice(0, R.k + 1); Q.reserved = null;
    if (R.kind === 'over') {
      const to = value && Array.isArray(value) ? value : R.to, w = fromGrid(site, to[0], to[1]);
      return [{ to: { x: w[0], z: w[1] }, v, even, asked: true }, { to: m.to }];
    }
    if (R.kind === 'lower') {
      // (all the way down by the answer: for a socket's canister, down to clear over it, in over it, and down)
      const v2 = value ?? R.to, steps = [];
      for (const st of m.via || []) steps.push(st.to.hoist != null ? { to: { hoist: Math.max(v2, st.to.hoist) }, v, even, asked: true } : { ...st, asked: true });
      steps.push({ to: { hoist: v2 }, v, even, asked: true }, { to: m.to });
      return steps;
    }
    return [{ to: m.to, v, even, asked: true }];
  };
  // a card that asked about no move: the next asked move, made by itself
  Q.skip = () => { const k = Q.moves.findIndex((q) => q.ask); if (k < 0) return []; const steps = Q.moves.slice(0, k + 1).flatMap(stepsOf); Q.moves.splice(0, k + 1); Q.reserved = null; return steps; };
  // the rest of the trip, made by itself (the check is over; or a move could not be made)
  Q.rest = () => { const steps = Q.moves.flatMap(stepsOf); Q.moves = []; Q.reserved = null; return steps; };
  Q.left = () => Q.moves.filter((m) => m.ask).length;
  return Q;
}
// where a list of moves leaves the crane (its x and z), from a state
function endOf(moves, S) { let x = S.x, z = S.z; for (const m of moves) { if (m.to && m.to.x != null) x = m.to.x; if (m.to && m.to.z != null) z = m.to.z; } return { x, z }; }

// ── THE MAGIC (src/jobs/cranelink.js): the round's next move of a part of it, made at once, for the canisters a check is
// not about (the game's maker: "maybe some of the canisters should magically appear in the sockets during the game")
// (the same rules as the round's: the ship's upper ones off first, lower sockets filled first, empties onto the lower
// mounts first, the upper sockets cleared first; never the canister of the trip under way, nor the place it goes to)
export function magicMoves(site, S, phase, keep = -1, keepPlace = null) {
  const M = site.mounts, K = site.sockets, B = site.bays, who = (w, i) => S.cans.findIndex((q) => q.where === w && q.i === i);
  const twin = (list, i, up) => list.findIndex((q, j) => j !== i && !!q.upper === up && Math.abs(q.at[0] - list[i].at[0]) < 0.1 && Math.abs(q.at[2] - list[i].at[2]) < 0.1);
  const free = (w, i) => who(w, i) < 0 && !(keepPlace && keepPlace.kind === w && keepPlace.i === i);
  const sockFree = () => K.map((_, k) => k).filter((k) => free('socket', k) && (K[k].upper ? twin(K, k, false) < 0 || who('socket', twin(K, k, false)) >= 0 : true)).sort((a, b) => K[a].upper - K[b].upper);
  const mountFree = () => M.map((_, i) => i).filter((i) => free('mount', i) && (M[i].upper ? twin(M, i, false) < 0 || who('mount', twin(M, i, false)) >= 0 : who('mount', twin(M, i, true)) < 0)).sort((a, b) => M[a].upper - M[b].upper);
  const out = [];
  if (phase === 'unload') {
    const full = M.map((_, i) => i).filter((i) => { const c = who('mount', i); return c >= 0 && c !== keep && S.cans[c].fill > 0.5 && (M[i].upper || twin(M, i, true) < 0 || who('mount', twin(M, i, true)) < 0); }).sort((a, b) => M[b].upper - M[a].upper);
    const k = sockFree()[0]; if (full.length && k != null) out.push({ c: who('mount', full[0]), to: { where: 'socket', i: k } });
  } else if (phase === 'load') {
    const empt = B.map((_, j) => j).filter((j) => { const c = who('bay', j); return c >= 0 && c !== keep && S.cans[c].fill <= 0.01; });
    const i = mountFree()[0]; if (empt.length && i != null && !M.some((_, q) => { const c = who('mount', q); return c >= 0 && S.cans[c].fill > 0.5; })) out.push({ c: who('bay', empt[0]), to: { where: 'mount', i } });
  } else if (phase === 'clear') {
    const dr = K.map((_, k) => k).filter((k) => { const c = who('socket', k); return c >= 0 && c !== keep && S.cans[c].fill <= 0.01 && (K[k].upper || twin(K, k, true) < 0 || who('socket', twin(K, k, true)) < 0); }).sort((a, b) => K[b].upper - K[a].upper);
    const j = B.map((_, q) => q).find((q) => free('bay', q)); if (dr.length && j != null) out.push({ c: who('socket', dr[0]), to: { where: 'bay', i: j } });
  }
  return out;
}

// ── the makers ───────────────────────────────────────────────────────────────────────────────────────────────────
// each: { strand, at(step), make(step, { rand, live }) }. live.ask(kind, opts) -> the next asked move of that kind,
// reserved for this card, its numbers on the level's marks (src/jobs/cranelink.js), or null: the card's numbers are
// then made up ("from the log")
const fromLive = (live, kind, opts) => (live && live.ask ? live.ask(kind, opts) : null);
const AX = { x: 'the x-axis', y: 'the y-axis' }, PART = { x: 'the bridge', y: 'the trolley' };
const targetWords = (s) => (s && s.what === 'drop' ? (s.place.kind === 'socket' ? `${cap(s.place.name)}` : cap(s.place.name)) : 'The blinking canister');
const madeOver = (t, prec, most = 30) => {
  const a = t.int(2, 36), b0 = t.int(2, 26), b = Math.max(1, Math.min(38, a + (t.chance(0.5) ? 1 : -1) * t.int(Math.max(2, prec === 1 ? 3 : 1), Math.min(most, 20))));
  const k = prec === 1 ? 0 : prec === 0.1 ? 1 : 2, p = 10 ** k, f = (v) => Math.round((v + t.int(0, p - 1) / p) * p) / p;
  return { kind: 'over', axis: 'x', from: [f(a), b0], to: [f(b), b0], what: 'pick', place: { kind: 'bay', name: 'the canister on the work order' }, made: true };
};
const madeLower = (t, prec) => { const p = prec, from = prec === 1 ? 6 : prec === 0.1 ? 6.3 : 6.28, to = prec === 1 ? t.int(1, 4) : prec === 0.1 ? t.pick([0.7, 2.3, 3.7, 2.2]) : t.pick([0.75, 2.34, 3.73, 2.2]); void p; return { kind: 'lower', from, to, what: 'pick', place: { name: 'the canister on the work order' }, made: true }; };
const facts = (s, extra = {}) => ({ kind: s ? s.kind : null, step: s && !s.made ? s.id : null, live: !!(s && !s.made), ...extra });
// the card's picture of the grid from above, for a move over the hangar
const gridPic = (s, opts) => ({ kind: 'grid', crane: s.from, target: s.aim || s.to, ...opts });

export const MAKERS = {
  // ── which quadrant (the youngest): the blinking canister, or the place it goes to ──
  quad: {
    strand: 'number', at: () => 2,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'over', { prec: 1, axis: 'both' });
      const q = s && s.quad ? s.quad : t.int(1, 4), what = targetWords(s);
      const slips = ROMAN.map((r, i) => ({ v: i + 1, big: r, small: 'quadrant', label: `quadrant ${r}`, why: i + 1 === q ? '' : `${r} is the other ${(i + 1 + q) % 2 ? 'side' : 'corner'}: find the blinking one, then read the big number in that part of the grid.` })).filter((c) => c.v !== q);
      return ownOrder({
        key: 'quad', story: `${what === 'The blinking canister' ? 'The blinking canister is where the crane goes next.' : `The canister goes to ${what.toLowerCase()} next.`} The grid's two middle lines cut the hangar into four quadrants.`, ask: `Which quadrant is ${what === 'The blinking canister' ? 'the blinking canister' : what.toLowerCase()} in?`,
        right: { v: q, big: ROMAN[q - 1], small: 'quadrant', label: `quadrant ${ROMAN[q - 1]}` }, slips,
        rightWhy: `Quadrant ${ROMAN[q - 1]}: the crane goes there`,
        picFirst: false, help: { title: 'The four quadrants', svg: picture(gridPic(s || { from: [8, 6], to: [[30, 22], [10, 22], [10, 6], [30, 6]][q - 1] }, { quads: true })), line: 'The middle lines cut the grid into four. Find the blinking canister and read the big number in its part.' },
        own: { strand: 'number', at: 2 }, facts: facts(s, { quad: q, axis: 'both' }),
      }, rand, 4);
    },
  },
  // ── counting squares along one axis: step 1 up to 5, step 2 up to 10 ──
  count: {
    strand: 'number', at: (step) => (step <= 1 ? 4 : 6),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), most = step <= 1 ? 5 : 10, s = fromLive(live, 'over', { prec: 1, most, least: 2 }) || madeOver(t, 1, most);
      const i = s.axis === 'y' ? 1 : 0, n = Math.round(Math.abs(s.to[i] - s.from[i])), way = s.axis === 'y' ? (s.to[1] > s.from[1] ? 'up' : 'down') : (s.to[0] > s.from[0] ? 'right' : 'left');
      return ownOrder({
        key: 'count:' + step, story: `The crane is ${n} squares from ${targetWords(s) === 'The blinking canister' ? 'the blinking canister' : targetWords(s).toLowerCase()}, along ${AX[s.axis]}. Each square of the grid is one metre.`, ask: `How many squares ${way} must the crane go?`,
        right: F(n, SQUARE), slips: [{ ...F(n + 1, SQUARE), why: 'One too many: count the squares between, not the lines.' }, { ...F(n - 1, SQUARE), why: 'One short: count every square, the last one too.' }, { ...F(n + 2, SQUARE), why: 'Too many. Touch each square once as you count.' }],
        rightWhy: `${u(n, SQUARE)}: ${n} metres along ${AX[s.axis]}`,
        help: { title: 'Count the squares', svg: picture({ kind: 'line', axis: s.axis, from: s.from[i], to: s.to[i], count: true }), line: 'Each square is one metre. Count them from the crane to the place: 1, 2, 3 ...' },
        own: { strand: 'number', at: step <= 1 ? 4 : 6 }, facts: facts(s, { n, axis: s.axis }),
      }, rand, 3);
    },
  },
  // ── reading the grid: the place's x (or y), a whole metre ──
  read: {
    strand: 'number', at: () => 10,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'over', { prec: 1, least: 2 }) || madeOver(t, 1);
      const i = s.axis === 'y' ? 1 : 0, v = Math.round(s.to[i]), here = Math.round(s.from[i]);
      const flip = v >= 10 && v % 10 !== Math.floor(v / 10) % 10 ? Number(String(v).split('').reverse().join('')) : null;
      return ownOrder({
        key: 'read', story: `${targetWords(s)} ${s.what === 'drop' ? 'is where the canister goes' : 'is where the crane goes'}. The numbers along the grid's edge count the metres from the hangar's corner.`, ask: `What is its ${s.axis}, to the nearest metre?`,
        right: { v, big: String(v), small: `on ${s.axis}`, label: `${s.axis} = ${v}` },
        slips: [{ v: v + 1, big: String(v + 1), small: `on ${s.axis}`, label: `${s.axis} = ${v + 1}`, why: 'One too far. Follow the line from it to the edge, and read the number there.' },
          { v: Math.max(1, v - 1), big: String(Math.max(1, v - 1)), small: `on ${s.axis}`, label: `${s.axis} = ${v - 1}`, why: 'One short. Follow the line from it to the edge.' },
          ...(here !== v && here > 0 ? [{ v: here, big: String(here), small: `on ${s.axis}`, label: `${s.axis} = ${here}`, why: `${here} is where the crane is now.` }] : []),
          ...(flip != null && flip !== v && flip > 0 ? [{ v: flip, big: String(flip), small: `on ${s.axis}`, label: `${s.axis} = ${flip}`, why: `The digits are the other way round: it is ${v}.` }] : [])],
        rightWhy: `${s.axis} = ${v}: the crane goes to ${s.axis} = ${v}`,
        help: { title: 'Read the grid', svg: picture(gridPic(s, { numbers: true })), line: `Follow the grid line from it down to the edge (for x) or across to the side (for y), and read the number.` },
        own: { strand: 'number', at: 10 }, facts: facts(s, { to: v, axis: s.axis }),
      }, rand);
    },
  },
  // ── how far along one axis: step 1 whole metres, step 2 tenths, step 3 hundredths ──
  dist: {
    strand: 'words', at: (step) => (step <= 1 ? 18 : step === 2 ? 48 : 56),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), prec = step <= 1 ? 1 : step === 2 ? 0.1 : 0.01, s = fromLive(live, 'over', { prec, least: prec === 1 ? 2 : 0.5 }) || madeOver(t, prec);
      const i = s.axis === 'y' ? 1 : 0, a = s.from[i], b = s.to[i], d = r2(Math.abs(b - a)), sum = r2(a + b);
      const lost = prec < 1 && Math.round(d * 100) % 100 !== 0;
      return ownOrder({
        key: `dist:${step}`, story: `${cap(PART[s.axis])} is at ${s.axis} = ${t2(a)}. ${targetWords(s)} is at ${s.axis} = ${t2(b)}.`, ask: `How much further must the crane move along ${AX[s.axis]}?`,
        right: F(d, METRE),
        slips: [{ ...F(sum, METRE), why: `That adds the two. The way between is the bigger take away the smaller: ${t2(Math.max(a, b))} − ${t2(Math.min(a, b))}.` },
          { ...F(b, METRE), why: `${t2(b)} is where it goes. How far is that from ${t2(a)}?` },
          { ...F(a, METRE), why: `${t2(a)} is where the crane is now. How far to ${t2(b)}?` },
          { ...F(d + prec, METRE), why: prec === 1 ? 'One metre too far: count on from the smaller number.' : 'Too far by the last place. Line the points up and take away.' },
          { ...F(Math.max(prec, d - prec), METRE), why: prec === 1 ? 'One metre short: count on from the smaller number.' : 'Short by the last place. Line the points up and take away.' },
          ...(lost ? [{ ...F(r2(Math.round(d * 100)), METRE), why: `The point went missing: ${t2(d)}, not ${t2(Math.round(d * 100))}.` }] : [])],
        rightWhy: `${t2(Math.max(a, b))} − ${t2(Math.min(a, b))} = ${u(d, METRE)}`, sum: { op: 'sub', a: Math.max(a, b), b: Math.min(a, b) },
        help: { title: `Along ${AX[s.axis]}`, svg: picture({ kind: 'line', axis: s.axis, from: a, to: b }), line: 'Where it goes take away where it is: the bigger number minus the smaller.', steps: [`${t2(Math.max(a, b))} − ${t2(Math.min(a, b))} = ?`] },
        own: { strand: prec === 1 ? 'words' : 'dec', at: prec === 1 ? 18 : prec === 0.1 ? 48 : 56 }, credit: [{ strand: 'sub', at: prec === 1 ? 14 : 45, weight: 0.5 }], facts: facts(s, { d, axis: s.axis }),
      }, rand);
    },
  },
  // ── the coordinates of a place: (x, y) ──
  pair: {
    strand: 'number', at: () => 24,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'over', { prec: 1, axis: 'both' }) || (() => { const m = madeOver(t, 1); m.to = [m.to[0], t.int(2, 26)]; m.axis = 'both'; return m; })();
      const [x, y] = s.to.map((v) => Math.round(v)), P = (a, b) => ({ v: a * 100 + b, big: `(${a}, ${b})`, small: '', label: `x ${a}, y ${b}` });
      const slips = [{ ...P(y, x), why: 'Those are the other way round: x comes first (along), then y (up).' }, { ...P(x, y + 1), why: `y is one too many: read the line ${y} it is on.` }, { ...P(x + 1, y), why: `x is one too many: read the line ${x} it is on.` }, { ...P(x - 1, y), why: 'x is one short.' }].filter((c) => c.v !== x * 100 + y && c.v > 0);
      return ownOrder({
        key: 'pair', story: `${targetWords(s)} is ${s.what === 'drop' ? 'where the canister goes' : 'the next one to move'}. On the grid, x goes along the hangar and y goes up the screen.`, ask: `What are its coordinates (x, y)?`,
        right: P(x, y), slips,
        rightWhy: `(${x}, ${y}): ${x} along, ${y} up`,
        help: { title: 'Coordinates', svg: picture(gridPic(s, { numbers: true })), line: 'Along first, then up: read x on the bottom edge, then y on the side.' },
        own: { strand: 'number', at: 24 }, facts: facts(s, { to: [x, y], axis: 'both' }),
      }, rand);
    },
  },
  // ── the turn: words (a quarter turn), then degrees ──
  turn: {
    strand: 'number', at: (step) => (step <= 1 ? 22 : 32),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'turn') || { kind: 'turn', deg: 90, fromAxis: t.pick(['x', 'y']), made: true, place: { name: t.pick(['socket 3', 'the rack']) } };
      const to = s.toAxis || (s.fromAxis === 'x' ? 'y' : 'x'), where = s.place ? s.place.name : 'its place';
      const story = `The canister lies along ${AX[s.fromAxis]}. In ${where} it must lie along ${AX[to]}. The grab turns it.`;
      if (step <= 1) {
        const W = (v, big, why = '') => ({ v, big, small: '', label: big, why });
        return ownOrder({
          key: 'turn:1', story, ask: 'How far round must the grab turn it?',
          right: W(1, 'a quarter turn'), slips: [W(2, 'a half turn', 'A half turn leaves it lying the same way, end for end.'), W(4, 'a whole turn', 'A whole turn brings it back to where it started.'), W(3, 'no turn', 'It lies the wrong way for its place now: it must turn.')],
          rightWhy: 'A quarter turn: from along one axis to along the other',
          help: { title: 'Turning', svg: picture({ kind: 'turn', from: s.fromAxis === 'x' ? 90 : 0, to: to === 'x' ? 90 : 0 }), line: 'Along x to along y is a quarter of the way round.' },
          own: { strand: 'number', at: 22 }, facts: facts(s, { deg: 90 }),
        }, rand, 4);
      }
      return ownOrder({
        key: 'turn:2', story, ask: 'How many degrees must the grab turn it?',
        right: F(90, DEG), slips: [{ ...F(180, DEG), why: '180 degrees is a half turn: it would lie the same way, end for end.' }, { ...F(360, DEG), why: '360 degrees is a whole turn, back to where it started.' }, { ...F(45, DEG), why: '45 degrees is half of a quarter turn: it would lie across the corner.' }, { ...F(270, DEG), why: '270 degrees is three quarters of the way round: the long way.' }],
        rightWhy: 'A quarter turn: 90 degrees',
        help: { title: 'Degrees', svg: picture({ kind: 'turn', from: s.fromAxis === 'x' ? 90 : 0, to: to === 'x' ? 90 : 0 }), line: 'A whole turn is 360 degrees, so a quarter turn is 360 ÷ 4.', steps: ['360 ÷ 4 = ?'] },
        sum: { op: 'div', a: 360, b: 4 },
        own: { strand: 'number', at: 32 }, facts: facts(s, { deg: 90 }),
      }, rand);
    },
  },
  // ── the hook down to a place: step 1 counting (up to 5), step 2 whole metres, step 3 tenths, step 4 hundredths ──
  lower: {
    strand: 'words', at: (step) => [0, 4, 16, 48, 56][Math.min(4, step)],
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), prec = step <= 2 ? 1 : step === 3 ? 0.1 : 0.01, s = fromLive(live, 'lower', { prec }) || madeLower(t, prec);
      const a = s.from, b = s.to, d = r2(Math.abs(a - b)), sum = r2(a + b), where = s.place && s.place.name ? (s.what === 'drop' ? s.place.name : 'the canister') : 'the canister';
      if (step <= 1) {
        const n = Math.round(d);
        return ownOrder({
          key: 'lower:1', story: `The grab is at the ${Math.round(a)} m mark. ${cap(where)} is at the ${Math.round(b)} m mark.`, ask: 'How many metres down must the grab go? Count the marks.',
          right: F(n, METRE), slips: [{ ...F(n + 1, METRE), why: 'That counts the marks, not the metres between them.' }, { ...F(Math.max(1, n - 1), METRE), why: 'One short: count every metre down.' }, { ...F(n + 2, METRE), why: 'Too many: count one metre at a time.' }],
          rightWhy: `${u(n, METRE)} down`,
          help: { title: 'Count down the scale', svg: picture({ kind: 'height', from: a, to: b, count: true }), line: 'Count the metres from the grab down to the canister: 1, 2, 3 ...' },
          own: { strand: 'number', at: 4 }, facts: facts(s, { d: n }),
        }, rand, 3);
      }
      return ownOrder({
        key: `lower:${step}`, story: `The grab is ${t2(a)} m up. ${cap(where)} is ${t2(b)} m up.`, ask: 'How far must the grab come down?',
        right: F(d, METRE),
        slips: [{ ...F(sum, METRE), why: `That adds the two heights. The way down is the higher take away the lower: ${t2(a)} − ${t2(b)}.` },
          { ...F(b, METRE), why: `${t2(b)} m is the height it goes to, not how far it goes.` }, { ...F(a, METRE), why: `${t2(a)} m is how high it is now.` },
          { ...F(d + prec, METRE), why: 'Too far by the last place: line up the points and take away.' }, { ...F(Math.max(prec, d - prec), METRE), why: 'Short by the last place.' }],
        rightWhy: `${t2(a)} − ${t2(b)} = ${u(d, METRE)} down`, sum: { op: 'sub', a, b },
        help: { title: 'The hoist\'s scale', svg: picture({ kind: 'height', from: a, to: b }), line: 'How far it comes down is the higher height take away the lower.', steps: [`${t2(a)} − ${t2(b)} = ?`] },
        own: { strand: prec === 1 ? 'words' : 'dec', at: prec === 1 ? 16 : prec === 0.1 ? 48 : 56 }, credit: [{ strand: 'sub', at: prec === 1 ? 14 : 45, weight: 0.5 }], facts: facts(s, { d }),
      }, rand);
    },
  },
  // ── up and down as plus and minus: Mathwood's negatives card on the hook's real move ──
  change: {
    strand: 'number', at: () => 36,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'lower', { prec: 1 }) || madeLower(t, 1);
      const a = Math.round(s.from), b = Math.round(s.to), c = b - a, where = s.what === 'drop' && s.place ? s.place.name : 'the canister';
      const card = makeCard(b, '-', a, { size: 4, rand });
      const WHY = { way: 'That adds the heights. The change is where it ends take away where it starts.', sign: `Right size, wrong way: going down makes it minus.`, drop: 'That adds the sizes and drops the signs. Ends minus starts.', start: 'That starts on the wrong side. Ends minus starts.', near: 'One off: count the metres on the scale again.' };
      const coins = card.targets.map((x) => ({ ...F(x.n, METRE, { sign: true }), v: CHANGE_AT + x.n, good: x.good, why: x.good ? '' : WHY[x.trap] || WHY[signSlip(b, '-', a, x.n)] || 'Count the metres from where the grab is to where it goes, and say which way.' }));
      const right = coins.find((x) => x.good);
      return ownOrder({
        key: 'change', story: `On the hoist's scale, up is plus and down is minus. The grab is at ${a} m; ${where} is at ${b} m.`, ask: 'What is the change in the grab\'s height?',
        right, slips: coins.filter((x) => !x.good),
        rightWhy: `${b} − ${a} = ${c > 0 ? '+' : '−'}${Math.abs(c)}: ${Math.abs(c)} m ${c < 0 ? 'down' : 'up'}`,
        help: { title: 'Up is plus, down is minus', svg: picture({ kind: 'height', from: a, to: b, signed: true }), line: 'Where it ends take away where it starts. Going down makes it minus.', steps: [`${b} − ${a} = ?`] },
        own: { strand: 'number', at: 36 }, credit: [{ strand: 'sub', at: 20, weight: 0.5 }], facts: facts(s, { change: c, offset: CHANGE_AT }),
      }, rand);
    },
  },
  // ── time from speed along one axis: step 1 whole seconds, step 2 with tenths ──
  time: {
    strand: 'words', at: (step) => (step <= 1 ? 40 : 62),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), prec = step <= 1 ? 1 : 0.1;
      // (whole seconds: along x, an even number of metres at 2 m a second)
      const s = fromLive(live, 'over', { prec: step <= 1 ? 2 : 0.1, axis: step <= 1 ? 'x' : 'auto', least: 2 }) || madeOver(t, step <= 1 ? 1 : 0.1);
      const i = s.axis === 'y' ? 1 : 0, v = SPEEDS[s.axis === 'y' ? 'y' : 'x'], d = r2(Math.abs(s.to[i] - s.from[i])), T = r2(d / v);
      const ok = Math.abs(T * 10 - Math.round(T * 10)) < 1e-6 ? T : r2(Math.round(T * 10) / 10);
      return ownOrder({
        key: `time:${step}`, story: `${cap(PART[s.axis])} moves ${t2(v)} m every second. It must go ${t2(d)} m along ${AX[s.axis]}, from ${t2(s.from[i])} to ${t2(s.to[i])}.`, ask: 'How many seconds will that take?',
        right: F(ok, SEC),
        slips: [{ ...F(r2(d * v), SEC), why: `That multiplies. Seconds are metres shared out ${t2(v)} at a time: ${t2(d)} ÷ ${t2(v)}.` }, { ...F(d, SEC), why: `${t2(d)} is the metres. Each second it goes ${t2(v)} m.` }, { ...F(r2(ok + 1), SEC), why: 'One second too many.' }, { ...F(Math.max(0.5, r2(ok - 1)), SEC), why: 'One second short.' }],
        rightWhy: `${t2(d)} ÷ ${t2(v)} = ${u(ok, SEC)}`, sum: { op: 'div', a: d, b: v },
        help: { title: 'Metres a second', svg: picture({ kind: 'speed', d, v, axis: s.axis }), line: `Each second it goes ${t2(v)} m. How many of those make ${t2(d)} m?`, steps: [`${t2(d)} ÷ ${t2(v)} = ?`] },
        own: { strand: step <= 1 ? 'words' : 'dec', at: step <= 1 ? 40 : 62 }, credit: [{ strand: 'div', at: 38, weight: 0.5 }], facts: facts(s, { T: ok, axis: s.axis, speed: v, even: true }),
      }, rand);
    },
  },
  // ── the hook's time down at the hoist's speed ──
  htime: {
    strand: 'words', at: () => 40,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'lower', { prec: 1 }) || madeLower(t, 1), v = SPEEDS.h, d = r2(Math.abs(s.from - s.to)), T = r2(d / v);
      return ownOrder({
        key: 'htime', story: `The hoist lowers the grab ${t2(v)} m every second. It goes from ${t2(s.from)} m down to ${t2(s.to)} m.`, ask: 'How many seconds will that take?',
        right: F(T, SEC), slips: [{ ...F(s.from, SEC), why: `${t2(s.from)} is where it starts, not how far it goes.` }, { ...F(r2(T + 1), SEC), why: 'One second too many.' }, { ...F(Math.max(1, r2(T - 1)), SEC), why: 'One second short.' }, { ...F(r2(s.from + s.to), SEC), why: 'That adds the heights: take away instead.' }],
        rightWhy: `${t2(d)} m at ${t2(v)} m a second: ${u(T, SEC)}`, sum: { op: 'sub', a: s.from, b: s.to },
        help: { title: 'Down a metre each second', svg: picture({ kind: 'height', from: s.from, to: s.to }), line: 'How far down, then a second for every metre.', steps: [`${t2(s.from)} − ${t2(s.to)} = ?`] },
        own: { strand: 'words', at: 40 }, facts: facts(s, { T, speed: v, even: true }),
      }, rand);
    },
  },
  // ── both ways at once: the longer of the two times ──
  both: {
    strand: 'words', at: () => 70,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'over', { prec: 1, axis: 'both', both: true }) || (() => { const m = madeOver(t, 1); m.axis = 'both'; m.from = [10, 6]; m.to = [10 + 2 * t.int(2, 8), 6 + 3 * t.int(1, 5)]; return m; })();
      const dx = r2(Math.abs(s.to[0] - s.from[0])), dy = r2(Math.abs(s.to[1] - s.from[1])), tx = r2(dx / SPEEDS.x), ty = r2(dy / SPEEDS.y), T = Math.max(tx, ty);
      return ownOrder({
        key: 'both', story: `The bridge goes ${t2(dx)} m along x at ${t2(SPEEDS.x)} m a second, and at the same time the trolley goes ${t2(dy)} m along y at ${t2(SPEEDS.y)} m a second.`, ask: 'How many seconds until the crane is over its place?',
        right: F(T, SEC), slips: [{ ...F(r2(tx + ty), SEC), why: 'That adds the two times, but they move at the same time: it is there when the longer one is done.' }, { ...F(Math.min(tx, ty), SEC), why: 'That is the shorter one: the other is still moving then.' }, { ...F(r2((dx + dy) / SPEEDS.x), SEC), why: 'Each part has its own speed: work each one out.' }, { ...F(r2(T + 1), SEC), why: 'One second too many.' }].filter((c) => Math.abs(c.v - T) > 1e-6),
        rightWhy: `x takes ${t2(tx)} s, y ${t2(ty)} s: there in ${u(T, SEC)}`,
        help: { title: 'Both at once', svg: picture({ kind: 'both', dx, vx: SPEEDS.x, dy, vy: SPEEDS.y }), line: 'Work out each one\'s time. Moving together, it is there when the longer one is done.', steps: [`${t2(dx)} ÷ ${t2(SPEEDS.x)} = ?`, `${t2(dy)} ÷ ${t2(SPEEDS.y)} = ?`, 'the longer of the two'] },
        own: { strand: 'words', at: 70 }, credit: [{ strand: 'div', at: 45, weight: 0.5 }], facts: facts(s, { T, axis: 'both', both: true }),
      }, rand);
    },
  },
  // ── straight across: the move along x and along y at once, and the straight line between (Pythagoras) ──
  straight: {
    strand: 'number', at: () => 78,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'over', { prec: 1, axis: 'both', straight: true }) || (() => { const [a, b] = t.pick([[3, 4], [6, 8], [5, 12], [9, 12], [8, 15], [12, 16]]); const m = madeOver(t, 1); m.axis = 'both'; m.from = [6, 4]; m.to = [6 + a, 4 + b]; return m; })();
      const dx = r2(Math.abs(s.to[0] - s.from[0])), dy = r2(Math.abs(s.to[1] - s.from[1])), d = r2(Math.hypot(dx, dy));
      return ownOrder({
        key: 'straight', story: `The bridge moves ${t2(dx)} m along x and the trolley ${t2(dy)} m along y, at the same time, so the canister goes in a straight line.`, ask: 'How far does the canister go?',
        right: F(d, METRE), slips: [{ ...F(r2(dx + dy), METRE), why: 'That goes along and then up. Straight across is shorter: x × x + y × y is the long side times itself.' }, { ...F(Math.max(dx, dy), METRE), why: 'That is only the longer side. The straight line is longer still.' }, { ...F(r2(dx * dx + dy * dy), METRE), why: `${t2(dx * dx + dy * dy)} is the long side times itself: which number times itself makes it?` }, { ...F(r2(d + 1), METRE), why: 'One metre too far.' }],
        rightWhy: `${t2(dx)}² + ${t2(dy)}² = ${t2(d * d)} = ${t2(d)}²: ${u(d, METRE)}`,
        help: { title: 'Straight across', svg: picture({ kind: 'straight', dx, dy }), line: 'The two moves are the short sides of a right triangle; the straight line is its long side.', steps: [`${t2(dx)} × ${t2(dx)} + ${t2(dy)} × ${t2(dy)} = ?`, '? × ? = that'] },
        own: { strand: 'number', at: 78 }, facts: facts(s, { d, axis: 'both', straight: true }),
      }, rand);
    },
  },
};

// ── the ladder ───────────────────────────────────────────────────────────────────────────────────────────────────
const M = (maker, step, w = 1) => ({ maker, step, w });
export const PLACE = {
  id: 'crane', name: 'The crane check', short: 'Crane', math: 'A crane over a grid: quadrants, coordinates, distances, heights, turns, speeds', pic: 'crane', job: null,
  line: 'The crane reports a fault: verify each move, from which quadrant to straight-line distances.',
  levels: [
    { id: 'quad', title: 'Which quadrant', line: 'Which quadrant is the blinking canister in? Count the metres down', grade: 2, gen: { mix: [M('quad', 1, 2), M('lower', 1), M('turn', 1, 0.5)] } },
    { id: 'count', title: 'Counting squares', line: 'Up to 10 squares along the grid; up to 10 metres down', grade: 6, gen: { mix: [M('count', 2, 2), M('lower', 1), M('turn', 1, 0.5)] } },
    { id: 'read', title: 'Reading the grid', line: 'What is the x of the blinking canister?', grade: 10, gen: { mix: [M('read', 1, 2), M('lower', 2), M('turn', 1, 0.5)] } },
    { id: 'dist', title: 'How far along', line: 'From x = 12 to x = 22; the grab from 6 m to 2 m', grade: 18, gen: { mix: [M('dist', 1, 2), M('lower', 2), M('turn', 1, 0.5)] } },
    { id: 'pair', title: 'Coordinates', line: 'The blinking canister is at (22, 16)', grade: 24, gen: { mix: [M('pair', 1, 2), M('dist', 1), M('lower', 2), M('turn', 1, 0.5)] } },
    { id: 'degrees', title: 'Turns in degrees', line: 'A quarter turn is 90 degrees', grade: 32, gen: { mix: [M('turn', 2, 2), M('dist', 1), M('lower', 2)] } },
    { id: 'change', title: 'Up is plus, down is minus', line: 'From 6 m to 2 m is a change of −4', grade: 36, gen: { mix: [M('change', 1, 2), M('dist', 1), M('turn', 2)] } },
    { id: 'time', title: 'Time from speed', line: '14 m at 2 m a second; 4 m down at 1 m a second', grade: 40, gen: { mix: [M('time', 1, 2), M('htime', 1, 1), M('turn', 2)] } },
    { id: 'tenths', title: 'Tenths', line: 'From x = 12.4 to x = 21.6; the grab from 6.3 m to 2.3 m', grade: 48, gen: { mix: [M('dist', 2, 2), M('lower', 3), M('turn', 2)] } },
    { id: 'hundredths', title: 'Hundredths', line: 'The crane at x = 5.78, the canister at x = 22.08', grade: 56, gen: { mix: [M('dist', 3, 2), M('lower', 4), M('turn', 2)] } },
    { id: 'timeTenths', title: 'Time with tenths', line: '9.4 m at 2 m a second; 6.3 m at 1.5 m a second', grade: 62, gen: { mix: [M('time', 2, 2), M('lower', 4), M('turn', 2)] } },
    { id: 'both', title: 'Both ways at once', line: 'x 12 m at 2 m a second and y 9 m at 1.5 m a second, together', grade: 70, gen: { mix: [M('both', 1, 2), M('lower', 4), M('turn', 2)] } },
    { id: 'straight', title: 'Straight across', line: '6 m along x and 8 m along y at once: 10 m in a straight line', grade: 78, gen: { mix: [M('straight', 1, 2), M('lower', 4), M('turn', 2)] } },
  ],
};

// which of the job's makers can ask about which kind of move
const SUITS = { quad: 'over', count: 'over', read: 'over', dist: 'over', pair: 'over', time: 'over', both: 'over', straight: 'over', lower: 'lower', change: 'lower', htime: 'lower', turn: 'turn' };
// the level's makers that suit the crane's next asked move, one of them by weight; none: null (Mathwood's own pick)
function pickAsk(mix, { rand = Math.random, live = null } = {}) {
  const next = live && live.peek ? live.peek() : null;
  if (!next) return null;
  const fits = mix.filter((a) => SUITS[a.maker] === next);
  if (!fits.length) {
    // (a level with nothing for this move: the crane makes it by itself, and the card is about the next one)
    if (live.pass) live.pass();
    const again = live.peek ? live.peek() : null;
    const f2 = mix.filter((a) => SUITS[a.maker] === again);
    if (!f2.length) return null;
    return f2[Math.floor(rand() * f2.length)];
  }
  let r = rand() * fits.reduce((q, a) => q + (a.w ?? 1), 0);
  for (const a of fits) if ((r -= a.w ?? 1) <= 0) return a;
  return fits[fits.length - 1];
}

// THE OPERATOR'S CHAIR in the smelter's control room: one seat (the game's maker: "a single option to get into the
// seat"); the crane game comes up, with free control a switch on its screen (src/cranedrive.js)
export const OPERATOR = { piece: 'opChair', local: [0, 0, -0.95], face: [0, 1] };
export const JOB = {
  id: 'crane', name: 'Crane system', short: 'Crane', open: true, pickAsk,
  spot: OPERATOR, near: 2.3, seated: true,
  sign: 'Crane operator', hint: 'Verify the crane\'s moves: credits for each right answer',
  // (`check`, not `game`: a job's `game` is a game that runs itself, the arena's Mathball, src/jobs/index.js)
  place: PLACE, makers: MAKERS, card: 'crane', check: GAME,
};
