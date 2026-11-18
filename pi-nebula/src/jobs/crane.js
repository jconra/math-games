// THE CRANE GAME at the operator's chair: the crane system reports a fault and asks the crew member to verify crane
// operations, one move at a time, credits for each right answer. The game's maker, 2026-11-16: "if the player goes to
// the chair then it could say the system is having a malfunction, please verify crane operations. Then it could ask
// basically any math questions like identifying the coordinates of the pods with a overhead camera and a overlaid
// grid. And/or doing math to figure out how much further the crane needs to travel to get into the correct position
// ... With each math question answered they could get paid some credits ... I wonder if it might be better to have a
// single option to get into the seat and then when the crane operator UI comes up then you can select a toggle button
// for 'Free Control', but otherwise it will guide you through problems to calculate the measurements for picking up
// and dropping off the containers ... we just want to make sure there are no big jumps in difficulty."
// And 2026-11-17: "Can we keep the questions here to coordinate math and addition and subtraction problems? Just
// assume the turning move. Calculate the actual distances." So no card asks about the turn: the crane turns a
// canister by itself, and every card is about where things are on the grid and how far the crane goes.
//
// THE ANSWERS ARE THE MOVES. The crane does the round's own trips (planned from where everything is: kit/crane-plan.js
// planFrom's next), one canister at a time: over the canister (x and y at once), down to it, the grab, up, the turn,
// over the place it goes to, down to it, in (a socket), let go, up. Four of those moves can be asked about: over the
// canister, down to it, over the place, down to it; a level asks only about the kinds of move its cards are for (a
// level of grid cards leaves the ups and downs to the crane), and the crane makes the rest by itself. A right answer
// and the crane makes that move, by exactly the answer (src/jobs/cranelink.js works the live crane,
// kit/crane-drive.js), and a short film of it shows it go. Five answers are one check; some of the round's other
// canisters "magically" take their places as the check goes on (his words: "the crane game should last a couple
// minutes (maybe 5 questions) and maybe some of the canisters should magically appear in the sockets during the
// game"), so a check moves a whole part of the round along.
// The numbers are the hangar's GRID (gridOf, below: metres from the back corner on your left as you come in, y up
// the hangar toward the bay door, x across it to your right; on the screen from above, y is up and x to the right),
// the height the hoist's (on the trolley's screen and the operator's). Before an asked move the crane lines itself up
// on the level's marks (a whole metre, a tenth, a hundredth) and after it onto the place itself, so "y = 12 to
// y = 22" is exactly 10 m.
//
// The ladder, easiest first (Mathwood's school guide in brackets: 0 starting kindergarten ... 80 eighth grade), each a
// small step from the last, each named for what its cards ask: which quadrant (2); counting squares and metres (4);
// counting to 10 (7); reading the grid (10); finding a point (14); coordinates (18); how far, along and down (22);
// the legs of a trip (26); where it will be (29); how far along x and along y (32); up is plus, down is minus (36);
// tenths (46); hundredths (54); the legs in hundredths (61); plus and minus in hundredths (68); the whole trip (75).
//
//   tripFrom(site, S) -> { c, from, to, phase }    the round's next trip from a state (a test lift when it is done)
//   makeGame(site, { state }) -> Q                   the trip's moves held for the questions (Q.ask, Q.before, Q.right)
//   the makers read `live` (src/jobs/cranelink.js now()): live.ask(kind, opts) reserves the next asked move of that kind
//   and gives its numbers on the level's marks; without it (node, the levels page) a maker's numbers are its own
import { dec } from '../../../mathwood-valley/src/math/counterkit.js';
import { makeCard, classify as signSlip } from '../../../mathwood-valley/src/math/negatives.js';
import { ownOrder } from './engine.js';
import { planFrom, alongNear, near0 } from '../../kit/crane-plan.js';
import { picture } from './cranepics.js';

export const GAME = { questions: 5 };
export const CHANGE_AT = 1000;   // (a plus-or-minus answer's button value: the change plus this, so it is above zero)
const u = (n, unit) => `${t2(n)} ${n === 1 ? unit[0] : unit[1]}`;
const METRE = ['metre', 'metres'], SQUARE = ['square', 'squares'];
const r2 = (x) => Math.round(x * 100) / 100;
const t2 = (x) => dec(Math.round(x * 100), 2, { trim: true });          // 13.95 -> "13.95", 12 -> "12"
const kit = (rand) => ({ int: (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)), pick: (a) => a[Math.floor(rand() * a.length)], chance: (p) => rand() < p });
// an answer: its value, the number big, the unit small
const F = (v, unit, { sign = false } = {}) => { const n = r2(v), big = (sign && n > 0 ? '+' : '') + (n < 0 ? '−' : '') + t2(Math.abs(n)); return { v: n, big, small: Math.abs(n) === 1 ? unit[0] : unit[1], label: `${big} ${Math.abs(n) === 1 ? unit[0] : unit[1]}` }; };
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const ROMAN = ['I', 'II', 'III', 'IV'];

// ── the grid ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE GRID (the game's maker, 2026-11-17: "I want 'up' to be towards the hanger door. So the axis should be switched so
// you enter into the hanger at y = 0 and the big hanger door is y = 40. That is what makes sense to me with the way
// that you enter into the hanger.. x to your sides"): metres from the hangar's back corner on your left as you come in
// by the way in; y along the hangar toward the bay door, x across it to your right. Seen from above with the bay door
// at the top, x runs to the right and y up the screen, as a coordinate plane's. The station file gives it (the
// hangar's `craneGrid`: its 0 as [X, Z] in the station, the ways x and y run as [X, Z], its size); without one, the
// first grid's way (x along the station's X, y toward its -Z).
export function gridOf(site) {
  const g = (site && site.grid) || {}, y = g.y || [0, -1], x = g.x || [-y[1], y[0]];
  return { origin: g.origin || [0, 0], size: g.size || [40, 28], x, y };
}
export const toGrid = (site, X, Z) => { const g = gridOf(site), dx = X - g.origin[0], dz = Z - g.origin[1]; return [r2(dx * g.x[0] + dz * g.x[1]), r2(dx * g.y[0] + dz * g.y[1])]; };
export const fromGrid = (site, gx, gy) => { const g = gridOf(site); return [g.origin[0] + gx * g.x[0] + gy * g.y[0], g.origin[1] + gx * g.x[1] + gy * g.y[1]]; };
// which grid axis runs along a station axis ('X' or 'Z'): the bridge rolls along the station's X, the trolley along Z
export const gridAxisOf = (site, stationAxis) => { const g = gridOf(site), k = stationAxis === 'X' ? 0 : 1; return Math.abs(g.x[k]) > 0.5 ? 'x' : 'y'; };
// the part of the crane that moves along a grid axis: the bridge along the hangar, the trolley across it
export const partOf = (site, axis) => (gridAxisOf(site, 'X') === axis ? 'the bridge' : 'the trolley');
// where the hook can go, in the grid's numbers: [[x0, x1], [y0, y1]]
export function reachOf(site) {
  const c = [[site.rail.x[0], site.rail.z[0]], [site.rail.x[1], site.rail.z[0]], [site.rail.x[0], site.rail.z[1]], [site.rail.x[1], site.rail.z[1]]].map(([X, Z]) => toGrid(site, X, Z));
  return [0, 1].map((i) => [Math.min(...c.map((p) => p[i])), Math.max(...c.map((p) => p[i]))]);
}
// a socket's wall, on the grid: the axis across it (0 x, 1 y) and the way out of the wall into the hangar (+1 or -1)
function wallOf(site, place) {
  const k = site.sockets[place.i], g = gridOf(site), n = [k.n[0] * g.x[0] + k.n[1] * g.x[1], k.n[0] * g.y[0] + k.n[1] * g.y[1]];
  const i = Math.abs(n[0]) >= Math.abs(n[1]) ? 0 : 1;
  return { i, out: Math.sign(n[i]) || 1 };
}
// which quadrant a point of the grid is in (the grid's middle lines; I top right, II top left, III bottom left, IV
// bottom right, as a coordinate plane's), or 0 on a middle line
export function quadrantOf(site, gx, gy) {
  const [w, h] = gridOf(site).size, cx = w / 2, cy = h / 2;
  if (Math.abs(gx - cx) < 0.3 || Math.abs(gy - cy) < 0.3) return 0;
  return gx > cx ? (gy > cy ? 1 : 4) : (gy > cy ? 2 : 3);
}
// the ways along the grid in plain words, as it is seen from above with the bay door at the top
const WAY = { x: ['to the right', 'to the left'], y: ['up', 'down'] };
const wayOf = (axis, d) => WAY[axis][d >= 0 ? 0 : 1];

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
// each: an autopilot step for the live crane (kit/crane-drive.js go), and, for the four a trip may ask about, `ask`:
// 'over' (x and y to a place), 'lower' (down to it). The turn is never asked (the game's maker: "Just assume the
// turning move"): the cradle turns the canister by itself on the way.
function movesOf(site, S, trip) {
  const out = [], carry = site.carry, rise = site.can.rise, push = 0.2;
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
  } else if (S.hoist < carry - 0.01) out.push({ to: { hoist: carry } });   // (in the cradle already, but low: up first)
  const D = placeOf(site, trip.to.kind, trip.to.i);
  // (the canister's own turn in the cradle when it was taken: 0 or a half turn; the cradle turns it to lie the place's way)
  const relNow = trip.from ? near0(S.cans[c].yaw - yaw) : rel, yawD = alongNear(D.axis - relNow, yaw);
  out.push({ ask: null, what: 'turn', place: D, c, to: { yaw: yawD } });
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
// Q.only(kinds)             the kinds of move the level asks about (a Set of 'over', 'lower'); the others the crane
//                           makes by itself
// Q.peek()                  the kind the next asked move is ('over', 'lower'), or null (no trip)
// Q.preview()               the next asked move, not reserved: { kind, what, here, there } in the grid's numbers
// Q.ask(kind, opts)         that move, reserved for a card, its numbers on the level's marks (opts.prec, opts.axis,
//                           opts.most: no further than this, the crane getting nearer by itself first; opts.least: no
//                           nearer; opts.start: [x, y] a start of its own on an axis, null on the other): { id, kind,
//                           axis, from, to, target, what, place, c, ... } in the grid's numbers; null if it is not next
// Q.leg1()                  the trip's first leg, over the canister: { from, to } in the grid's numbers, or null
// Q.before()                the autopilot steps up to the asked move (the crane makes them as the card comes)
// Q.right(value)            the asked move by exactly that value, then onto the place itself: the steps
// Q.skip()                  a card that asked about no move: the next asked move made by itself
// Q.restart()               planned again from the crane as it is
export function makeGame(site, { state }) {
  const Q = { trip: null, moves: [], reserved: null, n: 0, kinds: null };
  const asks = (m) => !!m.ask && (!Q.kinds || Q.kinds.has(m.ask));
  function plan() {
    const S = state(); Q.trip = tripFrom(site, S); Q.moves = Q.trip ? movesOf(site, S, Q.trip) : []; Q.reserved = null;
    if (Q.trip) Q.trip.at0 = toGrid(site, S.x, S.z);
    return Q.trip;
  }
  const stepsOf = (m) => (m.until ? [{ until: m.until, i: m.i, k: m.k, c: m.c }] : m.grab ? [{ grab: m.grab }] : [...(m.via || []), { to: m.to, v: m.v, even: m.even }]);
  Q.only = (kinds) => { Q.kinds = kinds && kinds.size ? new Set(kinds) : null; };
  Q.peek = () => { if (!Q.moves.length) plan(); const m = Q.moves.find(asks); return m ? m.ask : null; };
  Q.preview = () => {
    if (!Q.moves.length) plan();
    const k = Q.moves.findIndex(asks); if (k < 0) return null;
    const m = Q.moves[k], S = state(), hereW = endOf(Q.moves.slice(0, k), S);
    return { kind: m.ask, what: m.what, place: m.place, here: toGrid(site, hereW.x, hereW.z), there: m.to.x != null ? toGrid(site, m.to.x, m.to.z) : null };
  };
  Q.restart = () => { plan(); return Q; };
  // the trip's first leg: as its card asked it, else from where the crane was when the trip began to the canister
  Q.leg1 = () => {
    if (!Q.trip) return null;
    if (Q.trip.leg1) return Q.trip.leg1;
    const m = Q.trip.pick; return m && Q.trip.at0 ? { from: [...Q.trip.at0], to: [...m] } : null;
  };
  // the asked move's numbers on the level's marks: where the crane starts it, where the answer takes it
  Q.ask = (kind, opts2 = {}) => {
    const { prec = 1, axis = 'auto', most = Infinity, least = 0, round = 'near', start: fixed = null } = opts2;
    if (!Q.moves.length && !plan()) return null;
    const k = Q.moves.findIndex(asks);
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
      // (toward a socket, the axis across its wall is taken to the mark short of the wall: out from it)
      const wall = m.place.kind === 'socket' ? wallOf(site, m.place) : null;
      const toMark = (v, i) => onMark(v, wall && wall.i === i ? (wall.out > 0 ? 'up' : 'down') : round);
      const target = [toMark(there[0], 0), toMark(there[1], 1)];
      // (where the hook can go, in the grid's numbers, a mark inside it at each end)
      const reach = reachOf(site), inside = (v, i) => Math.min(onMark(reach[i][1], 'down'), Math.max(onMark(reach[i][0], 'up'), v));
      const from0 = [inside(onMark(here[0]), 0), inside(onMark(here[1]), 1)];
      const start = [...from0];
      // (no further than `most`, no nearer than `least`: the crane gets there by itself first)
      const fit = (i) => {
        let d = target[i] - start[i];
        if (Math.abs(d) > most) start[i] = r2(target[i] - Math.sign(d) * most);
        d = target[i] - start[i];
        if (Math.abs(d) < least) { const w = d >= 0 ? 1 : -1, s1 = r2(target[i] - w * least); start[i] = s1 >= reach[i][0] && s1 <= reach[i][1] ? s1 : r2(target[i] + w * least); }
      };
      if (ax === 'x' || ax === 'y') { const i = ax === 'x' ? 0 : 1; start[1 - i] = target[1 - i]; if (fixed && fixed[i] != null) start[i] = inside(fixed[i], i); else fit(i); }
      else if (fixed) { for (const i of [0, 1]) if (fixed[i] != null) start[i] = inside(fixed[i], i); else fit(i); }
      else { fit(0); fit(1); }
      const sw = fromGrid(site, start[0], start[1]);
      pre.push({ to: { x: sw[0], z: sw[1], yaw: m.to.yaw } });
      // (the trip's first leg, as this card asks it: the legs of a trip add it on)
      if (m.what === 'pick' && Q.trip) Q.trip.leg1 = { from: ax === 'x' ? [start[0], from0[1]] : ax === 'y' ? [from0[0], start[1]] : [...start], to: [...target] };
      R = { kind, axis: ax, from: start, to: target, there, aim, quad: quadrantOf(site, aim[0], aim[1]) };
    } else {
      // (from a mark at or under the top, to the mark at or above the place: it never goes below it on an answer)
      const from = onMark(site.carry, 'down'), to = onMark(m.to.hoist, 'up');
      pre.push({ to: { hoist: from } });
      R = { kind, from, to, there: m.to.hoist };
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
  Q.right = (value = null) => {
    const R = Q.reserved; if (!R) return Q.skip();
    const m = Q.moves[R.k]; Q.moves.splice(0, R.k + 1); Q.reserved = null;
    if (m.what === 'pick' && m.ask === 'over' && Q.trip) Q.trip.pick = toGrid(site, m.to.x, m.to.z);
    if (R.kind === 'over') {
      const to = value && Array.isArray(value) ? value : R.to, w = fromGrid(site, to[0], to[1]);
      return [{ to: { x: w[0], z: w[1] }, asked: true }, { to: m.to }];
    }
    // (all the way down by the answer: for a socket's canister, down to clear over it, in over it, and down)
    const v2 = value ?? R.to, steps = [];
    for (const st of m.via || []) steps.push(st.to.hoist != null ? { to: { hoist: Math.max(v2, st.to.hoist) }, asked: true } : { ...st, asked: true });
    steps.push({ to: { hoist: v2 }, asked: true }, { to: m.to });
    return steps;
  };
  // a card that asked about no move: the next asked move, made by itself
  Q.skip = () => {
    const k = Q.moves.findIndex(asks); if (k < 0) return [];
    const m = Q.moves[k]; if (m.what === 'pick' && m.ask === 'over' && Q.trip) Q.trip.pick = toGrid(site, m.to.x, m.to.z);
    const steps = Q.moves.slice(0, k + 1).flatMap(stepsOf); Q.moves.splice(0, k + 1); Q.reserved = null; return steps;
  };
  // the rest of the trip, made by itself (the check is over; or a move could not be made)
  Q.rest = () => { for (const m of Q.moves) if (m.what === 'pick' && m.ask === 'over' && Q.trip && !Q.trip.pick) Q.trip.pick = toGrid(site, m.to.x, m.to.z); const steps = Q.moves.flatMap(stepsOf); Q.moves = []; Q.reserved = null; return steps; };
  Q.left = () => Q.moves.filter(asks).length;
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
// then made up ("from the log"). Each card's facts say how a wrong answer would have moved the crane (cranelink.js
// draws it on the grid): mode 'quad', 'read' (a reading on the axis), 'along' (a distance along the axis), 'legs' (a
// trip's legs in all: the move is the total less the first leg), 'pair' (a point), 'find' (a mark), 'both' (a distance
// each way), 'signed' (a change with its sign), 'down' (a distance down), 'change' (a height change with its sign)
const fromLive = (live, kind, opts) => (live && live.ask ? live.ask(kind, opts) : null);
const AX = { x: 'the x-axis', y: 'the y-axis' };
// the part of the crane that moves along a grid axis (the live hangar's, else this hangar's: y the bridge)
const partFor = (live, axis) => (live && live.site ? partOf(live.site, axis) : axis === 'y' ? 'the bridge' : 'the trolley');
const sizeFor = (live) => (live && live.site ? gridOf(live.site).size : SIZE);
const SIZE = [28, 40];
// (a card about a place itself names it; a card about how far the crane goes names where the crane stops: for a socket,
// the spot in front of it, where the canister hangs before it goes in)
const targetWords = (s, front = false) => { const name = s && s.what === 'drop' && s.place && s.place.name ? s.place.name : 'the blinking canister'; return cap(front && s && s.place && s.place.kind === 'socket' ? `the spot in front of ${name}` : name); };
const lowerWords = (s) => (s && s.what === 'drop' && s.place && s.place.name ? s.place.name : 'the canister');
const isPlace = (s) => !!(s && s.what === 'drop' && s.place && s.place.name);
// (a card from the log: made-up numbers on this hangar's grid, along one axis or both)
const madeOver = (t, prec, { most = 20, least = 2, axis = t.pick(['x', 'y']) } = {}) => {
  const i = axis === 'y' ? 1 : 0, top = SIZE[i] - 2, d = t.int(Math.max(least, 1), Math.max(least, Math.min(most, Math.floor(top / 2))));
  const a = t.int(2, top - d), up = t.chance(0.5), k = prec === 1 ? 0 : prec === 0.1 ? 1 : 2, p = 10 ** k, f = (v) => Math.round((v + t.int(0, p - 1) / p) * p) / p;
  const from = [t.int(2, SIZE[0] - 2), t.int(2, SIZE[1] - 2)], to = [...from];
  from[i] = f(up ? a : a + d); to[i] = f(up ? a + d : a);
  return { kind: 'over', axis, from, to, what: 'pick', place: { kind: 'bay', name: 'the canister on the work order' }, made: true };
};
const madeBoth = (t, least = 2) => { const from = [t.int(2, 12), t.int(4, 18)], to = [from[0] + t.int(least, 12), from[1] + t.int(least, 18)]; if (t.chance(0.5)) [from[1], to[1]] = [to[1], from[1]]; return { kind: 'over', axis: 'both', from, to, aim: to, what: 'pick', place: { kind: 'bay', name: 'the canister on the work order' }, made: true }; };
const madeLower = (t, prec) => { const from = prec === 1 ? 6 : prec === 0.1 ? 6.2 : 6.28, to = prec === 1 ? t.int(1, 4) : prec === 0.1 ? t.pick([0.7, 2.3, 3.7, 2.2]) : t.pick([0.75, 2.34, 3.73, 2.21]); return { kind: 'lower', from, to, what: 'pick', place: { name: 'the canister on the work order' }, made: true }; };
const facts = (s, extra = {}) => ({ kind: s ? s.kind : null, step: s && !s.made ? s.id : null, live: !!(s && !s.made), ...extra });
// the card's picture of the grid from above, for a move over the hangar
const gridPic = (s, live, opts) => ({ kind: 'grid', size: sizeFor(live), crane: s.from, target: s.aim || s.to, ...opts });
// a reading as a count on from the grid's numbered line under it: 23 is 20 and 3 more (no sum for 3, or for 20)
const countOn = (v, say) => { const tens = Math.floor(v / 10) * 10, ones = r2(v - tens); return tens && ones ? { op: 'add', a: tens, b: ones, say } : null; };
// two sums that do not hang together (x's and y's): Work it out would take a number of the second that happens to be
// the first one's answer for one carried from it, so they go the other way round, or the first alone; the help's steps
// say both, as they are
const ans = (q) => (q.op === 'add' ? q.a + q.b : q.a - q.b);
const apart = (list) => { const L = list.filter(Boolean); if (L.length < 2) return L[0] || null; const ok = (a) => !(Math.abs(ans(a[0]) - a[1].a) < 1e-9 || Math.abs(ans(a[0]) - a[1].b) < 1e-9); return ok(L) ? L : ok([L[1], L[0]]) ? [L[1], L[0]] : L[0]; };
const stepWords = (list) => list.filter(Boolean).map((q) => `${q.say}: ${t2(q.a)} ${q.op === 'add' ? '+' : '−'} ${t2(q.b)}`);
// a point as a button: x and y in one number (x × 100 + y), the pair big
const P = (a, b) => ({ v: a * 100 + b, big: `(${a}, ${b})`, small: '', label: `x ${a}, y ${b}` });
const okPair = (a, b, size) => a >= 0 && b >= 0 && a <= size[0] && b <= size[1];

export const MAKERS = {
  // ── which quadrant (the youngest): the blinking canister, or the place it goes to ──
  quad: {
    strand: 'number', at: () => 2,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'over', { prec: 1, axis: 'both' });
      const size = sizeFor(live), q = s && s.quad ? s.quad : t.int(1, 4), it = isPlace(s) ? s.place.name : 'the blinking canister';
      const slips = ROMAN.map((r, i) => ({ v: i + 1, big: r, small: 'quadrant', label: `quadrant ${r}`, why: i + 1 === q ? '' : `${r} is the other ${(i + 1 + q) % 2 ? 'side' : 'corner'}: find ${it === 'the blinking canister' ? 'the blinking one' : it}, then read the big number in that part of the grid.` })).filter((c) => c.v !== q);
      const mid = [size[0] / 2, size[1] / 2], made = [[mid[0] + 7, mid[1] + 10], [mid[0] - 7, mid[1] + 10], [mid[0] - 7, mid[1] - 10], [mid[0] + 7, mid[1] - 10]][q - 1];
      return ownOrder({
        key: 'quad', story: `${isPlace(s) ? `The canister goes to ${it} next.` : 'The blinking canister is where the crane goes next.'} The grid's two middle lines cut the hangar into four quadrants.`, ask: `Which quadrant is ${it} in?`,
        right: { v: q, big: ROMAN[q - 1], small: 'quadrant', label: `quadrant ${ROMAN[q - 1]}` }, slips,
        rightWhy: `Quadrant ${ROMAN[q - 1]}: the crane goes there`,
        picFirst: false, help: { title: 'The four quadrants', svg: picture(gridPic(s || { from: [mid[0] - 9, 4], to: made }, live, { quads: true })), line: 'I is the top right part of the grid, II the top left, III the bottom left and IV the bottom right. Find it, and read the big number in its part.' },
        own: { strand: 'number', at: 2 }, facts: facts(s, { quad: q, axis: 'both', mode: 'quad' }),
      }, rand, 4);
    },
  },
  // ── counting squares along one axis: step 1 up to 5, step 2 up to 10 ──
  count: {
    strand: 'number', at: (step) => (step <= 1 ? 4 : 7),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), most = step <= 1 ? 5 : 10, s = fromLive(live, 'over', { prec: 1, most, least: 2 }) || madeOver(t, 1, { most, least: 2 });
      const i = s.axis === 'y' ? 1 : 0, n = Math.round(Math.abs(s.to[i] - s.from[i])), way = wayOf(s.axis, s.to[i] - s.from[i]), it = targetWords(s, true);
      return ownOrder({
        key: 'count:' + step, story: `${it} is straight ${way} from the crane, along ${AX[s.axis]}. Each square of the grid is one metre.`, ask: `How many squares ${way} must the crane go?`,
        right: F(n, SQUARE), slips: [{ ...F(n + 1, SQUARE), why: 'One too many: count the squares between, not the lines.' }, { ...F(n - 1, SQUARE), why: 'One short: count every square, the last one too.' }, { ...F(n + 2, SQUARE), why: 'Too many. Touch each square once as you count.' }],
        rightWhy: `${u(n, SQUARE)}: ${n} metres along ${AX[s.axis]}`,
        sum: { op: 'sub', a: Math.max(s.from[i], s.to[i]), b: Math.min(s.from[i], s.to[i]), say: 'Or take the smaller number from the bigger' },
        help: { title: 'Count the squares', svg: picture({ kind: 'line', axis: s.axis, from: s.from[i], to: s.to[i], count: true }), line: 'Each square is one metre. Count them from the crane to the place: 1, 2, 3 ...' },
        own: { strand: 'number', at: step <= 1 ? 4 : 7 }, facts: facts(s, { n, axis: s.axis, mode: 'along' }),
      }, rand, 3);
    },
  },
  // ── reading the grid: the place's x (or y), a whole metre ──
  read: {
    strand: 'number', at: () => 10,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'over', { prec: 1, least: 2 }) || madeOver(t, 1);
      const i = s.axis === 'y' ? 1 : 0, v = Math.round((s.aim || s.to)[i]), here = Math.round(s.from[i]);
      const flip = v >= 10 && v % 10 !== Math.floor(v / 10) % 10 ? Number(String(v).split('').reverse().join('')) : null;
      const R = (n, why = '') => ({ v: n, big: String(n), small: `on ${s.axis}`, label: `${s.axis} = ${n}`, why });
      const sum = countOn(v, `From the line marked ${Math.floor(v / 10) * 10}, count on`);
      return ownOrder({
        key: 'read', story: `${targetWords(s)} ${s.what === 'drop' ? 'is where the canister goes' : 'is where the crane goes'}. The numbers along the grid's edges count the metres from the corner at 0: x along the bottom, y up the side.`, ask: `What is its ${s.axis}?`,
        right: R(v),
        slips: [R(v + 1, s.axis === 'x' ? 'One too far. Follow the line from it straight down to the bottom edge, and read the number there.' : 'One too far. Follow the line from it straight across to the side, and read the number there.'),
          R(Math.max(1, v - 1), s.axis === 'x' ? 'One short. Follow the line from it straight down to the bottom edge.' : 'One short. Follow the line from it straight across to the side.'),
          ...(here !== v && here > 0 ? [R(here, `${here} is where the crane is now.`)] : []),
          ...(flip != null && flip !== v && flip > 0 ? [R(flip, `The digits are the other way round: it is ${v}.`)] : [])],
        rightWhy: `${s.axis} = ${v}: the crane goes to ${s.axis} = ${v}`,
        ...(sum ? { sum } : {}),
        help: { title: 'Read the grid', svg: picture(gridPic(s, live, { numbers: true, guide: s.axis })), line: s.axis === 'x' ? 'Follow the grid line from it straight down to the numbers along the bottom, and read the number.' : 'Follow the grid line from it straight across to the numbers up the side, and read the number.' },
        own: { strand: 'number', at: 10 }, facts: facts(s, { to: v, axis: s.axis, mode: 'read' }),
      }, rand);
    },
  },
  // ── finding a point: which of four marks is at (x, y) ──
  find: {
    strand: 'number', at: () => 14,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), size = sizeFor(live), s = fromLive(live, 'over', { prec: 1, axis: 'both', least: 2 }) || madeBoth(t);
      const [x, y] = (s.aim || s.to).map((v) => Math.round(v));
      // the marks: the right one and three near it, each its own place, none on another's square
      // (x and y swapped most times, the rest near it in any direction, so the right one is any of the four letters)
      const near = [[x + 3, y], [x, y + 3], [x - 3, y], [x, y - 3], [x + 2, y - 2], [x - 2, y + 2], [x + 4, y + 4], [x - 4, y - 4], [x + 3, y + 3], [x - 3, y - 3]];
      for (let k = near.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [near[k], near[j]] = [near[j], near[k]]; }
      const cands = t.chance(0.7) ? [[y, x], ...near] : near;
      const marks = [[x, y]];
      // (each mark clear of the others and of the grid's edges, where the numbers and the labels are)
      const fits = (c) => c[0] >= 1 && c[1] >= 2 && c[0] <= size[0] - 1 && c[1] <= size[1] - 2 && !marks.some((m) => Math.hypot(m[0] - c[0], m[1] - c[1]) < 3.4);
      for (const c of cands) { if (marks.length >= 4) break; if (fits(c)) marks.push(c); }
      for (let n = 0; marks.length < 4 && n < 400; n++) { const c = [t.int(1, size[0] - 1), t.int(2, size[1] - 2)]; if (fits(c)) marks.push(c); }
      // (lettered A to D from the left of the grid, then up: the buttons in that order too)
      const order = marks.map((m, k) => ({ m, k })).sort((a, b) => a.m[0] - b.m[0] || a.m[1] - b.m[1]);
      const LET = ['A', 'B', 'C', 'D'], lettered = order.map((o, n) => ({ letter: LET[n], at: o.m, right: o.k === 0 }));
      if (s && !s.made) s.marks = lettered;
      const why = (m) => (m[0] === y && m[1] === x && x !== y ? `That mark is at (${m[0]}, ${m[1]}): x and y the other way round. x comes first, along the bottom.` : m[0] !== x && m[1] === y ? `That mark is at (${m[0]}, ${m[1]}): its x is ${m[0]}, not ${x}.` : m[0] === x ? `That mark is at (${m[0]}, ${m[1]}): its y is ${m[1]}, not ${y}.` : `That mark is at (${m[0]}, ${m[1]}).`);
      const coin = (L) => ({ v: LET.indexOf(L.letter) + 1, big: L.letter, small: 'mark', label: `mark ${L.letter}`, why: L.right ? '' : why(L.at) });
      const right = lettered.find((L) => L.right);
      const o = ownOrder({
        key: 'find', story: `The marks A, B, C and D on the grid are four places the crane could go. The work order says (${x}, ${y}).`, ask: `Which mark is at (${x}, ${y})?`,
        right: coin(right), slips: lettered.filter((L) => !L.right).map(coin),
        rightWhy: `Mark ${right.letter}: ${x} along the bottom, ${y} up the side`,
        help: { title: 'Finding a point', svg: picture({ kind: 'grid', size, crane: s.from, marks: lettered, ask: `(${x}, ${y})?`, numbers: true }), line: `Find ${x} along the bottom first. Then go straight up to ${y} on the side: the mark where the two lines meet.` },
        own: { strand: 'number', at: 14 }, facts: facts(s, { to: [x, y], axis: 'both', mode: 'find', marks: lettered }),
      }, rand, 4);
      o.coins.sort((a, b) => a.v - b.v);
      return o;
    },
  },
  // ── the coordinates of a place: (x, y) ──
  pair: {
    strand: 'number', at: () => 18,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), size = sizeFor(live), s = fromLive(live, 'over', { prec: 1, axis: 'both' }) || madeBoth(t);
      const [x, y] = (s.aim || s.to).map((v) => Math.round(v));
      const slips = [{ ...P(y, x), why: 'Those are the other way round: x comes first (along the bottom), then y (up the side).' }, { ...P(x, y + 1), why: `y is one too many: read the line ${y} it is on.` }, { ...P(x + 1, y), why: `x is one too many: read the line ${x} it is on.` }, { ...P(x - 1, y), why: 'x is one short.' }, { ...P(x, y - 1), why: 'y is one short.' }].filter((c) => c.v !== x * 100 + y && okPair(Math.floor(c.v / 100), c.v % 100, [99, 99]) && c.v > 0);
      const steps = [countOn(x, 'x: from the line marked ' + Math.floor(x / 10) * 10 + ', count on'), countOn(y, 'y: from the line marked ' + Math.floor(y / 10) * 10 + ', count on')].filter(Boolean);
      return ownOrder({
        key: 'pair', story: `${targetWords(s)} is ${s.what === 'drop' ? 'where the canister goes' : 'the next one to move'}. On the grid, x goes across the hangar, along the bottom, and y goes up the screen, toward the bay door.`, ask: 'What are its coordinates (x, y)?',
        right: P(x, y), slips,
        rightWhy: `(${x}, ${y}): ${x} across, ${y} up`,
        ...(steps.length ? { sum: apart(steps) } : {}),
        help: { title: 'Coordinates', svg: picture(gridPic(s, live, { numbers: true, guide: 'both' })), line: 'Across first, then up: read x along the bottom, then y up the side.', ...(steps.length ? { steps: stepWords(steps) } : {}) },
        own: { strand: 'number', at: 18 }, facts: facts(s, { to: [x, y], axis: 'both', mode: 'pair' }),
      }, rand);
    },
  },
  // ── how far along one axis: step 1 whole metres, step 2 tenths, step 3 hundredths ──
  dist: {
    strand: 'sub', at: (step) => (step <= 1 ? 22 : step === 2 ? 46 : 54),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), prec = step <= 1 ? 1 : step === 2 ? 0.1 : 0.01, s = fromLive(live, 'over', { prec, least: prec === 1 ? 2 : 0.5 }) || madeOver(t, prec);
      return distOrder(s, prec, rand, live, `dist:${step}`);
    },
  },
  // ── the hook down to a place: step 1 counting (up to 5), step 2 whole metres, step 3 tenths, step 4 hundredths ──
  lower: {
    strand: 'sub', at: (step) => [0, 4, 22, 46, 54][Math.min(4, step)],
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), prec = step <= 2 ? 1 : step === 3 ? 0.1 : 0.01, s = fromLive(live, 'lower', { prec }) || madeLower(t, prec);
      const a = s.from, b = s.to, d = r2(Math.abs(a - b)), sum = r2(a + b), where = lowerWords(s);
      if (step <= 1) {
        const n = Math.round(d);
        return ownOrder({
          key: 'lower:1', story: `The grab is at the ${Math.round(a)} m mark. ${cap(where)} is at the ${Math.round(b)} m mark.`, ask: 'How many metres down must the grab go? Count the marks.',
          right: F(n, METRE), slips: [{ ...F(n + 1, METRE), why: 'That counts the marks, not the metres between them.' }, { ...F(Math.max(1, n - 1), METRE), why: 'One short: count every metre down.' }, { ...F(n + 2, METRE), why: 'Too many: count one metre at a time.' }],
          rightWhy: `${u(n, METRE)} down`,
          sum: { op: 'sub', a: Math.round(a), b: Math.round(b), say: 'Or take the lower mark from the higher one' },
          help: { title: 'Count down the scale', svg: picture({ kind: 'height', from: a, to: b, count: true }), line: 'Count the metres from the grab down to the canister: 1, 2, 3 ...' },
          own: { strand: 'number', at: 4 }, facts: facts(s, { d: n, mode: 'down' }),
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
        own: { strand: prec === 1 ? 'sub' : 'dec', at: prec === 1 ? 22 : prec === 0.1 ? 46 : 54 }, credit: prec === 1 ? [] : [{ strand: 'sub', at: 30, weight: 0.5 }], facts: facts(s, { d, mode: 'down' }),
      }, rand);
    },
  },
  // ── the legs of a trip: over the canister is the first leg, over its place the second. At the first, how far it is;
  // at the second, both together. Step 1 whole metres, step 2 hundredths with the first leg given, step 3 hundredths from
  // the trip's three points (the whole trip) ──
  legs: {
    strand: 'add', at: (step) => (step <= 1 ? 26 : step === 2 ? 61 : 75),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), prec = step <= 1 ? 1 : 0.01, least = prec === 1 ? 2 : 0.5;
      const pv = live && live.preview ? live.preview() : null;
      // the first leg: how far it is, as the distance cards ask it
      if (!pv || pv.what !== 'drop') {
        const s = fromLive(live, 'over', { prec, least }) || madeOver(t, prec);
        return distOrder(s, prec, rand, live, `legs:${step}:1`, { first: true, at: MAKERS.legs.at(step) });
      }
      // the second: along the axis the first leg went furthest on (each leg at least `least`), from where it ended
      const L1 = live.leg1 ? live.leg1() : null, on = (v) => r2(Math.round(v / prec) * prec);
      let i = -1, best = -1;
      if (L1 && pv.there) for (const k of [0, 1]) { const a = Math.abs(on(L1.to[k]) - on(L1.from[k])), b = Math.abs(on(pv.there[k]) - on(L1.to[k])); if (a >= least && b >= least && Math.min(a, b) > best) { best = Math.min(a, b); i = k; } }
      if (i < 0) { const s = fromLive(live, 'over', { prec, least }) || madeOver(t, prec); return distOrder(s, prec, rand, live, `legs:${step}:d`, { second: true, at: MAKERS.legs.at(step) }); }
      const axis = i ? 'y' : 'x', fixed = i ? [null, on(L1.to[1])] : [on(L1.to[0]), null];
      const s = fromLive(live, 'over', { prec, axis, start: fixed });
      if (!s) { const m = madeOver(t, prec); return distOrder(m, prec, rand, live, `legs:${step}:d`, { second: true, at: MAKERS.legs.at(step) }); }
      const p0 = on(L1.from[i]), a = s.from[i], b = s.to[i], leg1 = r2(Math.abs(a - p0)), leg2 = r2(Math.abs(b - a)), all = r2(leg1 + leg2), part = partFor(live, axis);
      const place = s.place && s.place.name ? s.place.name : 'its place';
      const story = step >= 3
        ? `On this trip ${part} goes from ${axis} = ${t2(p0)} to the canister at ${axis} = ${t2(a)}, then on to ${place} at ${axis} = ${t2(b)}.`
        : `On the first leg of this trip ${part} went ${u(leg1, METRE)} along ${AX[axis]}, to the canister. On the second leg it goes from ${axis} = ${t2(a)} to ${axis} = ${t2(b)}, to ${place}.`;
      const ask = `How far does ${part} go on this trip, both legs together?`;
      const straight = r2(Math.abs(b - p0));
      const slips = [{ ...F(leg2, METRE), why: `That is the second leg only. Add the first leg, ${t2(leg1)} m.` },
        ...(step >= 3 ? [{ ...F(straight, METRE), why: `That is from where it started to where it ends. It went to the canister at ${t2(a)} first: work out each leg, then add them.` }, { ...F(leg1, METRE), why: 'That is the first leg only. Add the second.' }] : []),
        { ...F(r2(a + b), METRE), why: `That adds the two places. The second leg is the bigger take away the smaller: ${t2(Math.max(a, b))} − ${t2(Math.min(a, b))}.` },
        { ...F(r2(all + prec), METRE), why: prec === 1 ? 'One metre too many: check each leg.' : 'Too far by the last place: line up the points.' },
        { ...F(Math.max(prec, r2(all - prec)), METRE), why: prec === 1 ? 'One metre short: check each leg.' : 'Short by the last place: line up the points.' }];
      const sumSteps = step >= 3
        ? [{ op: 'sub', a: Math.max(a, p0), b: Math.min(a, p0), say: 'The first leg' }, { op: 'sub', a: Math.max(a, b), b: Math.min(a, b), say: 'The second leg' }, { op: 'add', a: leg1, b: leg2, say: 'Both legs together' }]
        : [{ op: 'sub', a: Math.max(a, b), b: Math.min(a, b), say: 'The second leg' }, { op: 'add', a: leg1, b: leg2, say: 'Both legs together' }];
      return ownOrder({
        key: `legs:${step}:2`, story, ask, right: F(all, METRE), slips,
        rightWhy: `${t2(leg1)} + ${t2(leg2)} = ${u(all, METRE)}`, sum: sumSteps,
        help: { title: 'The legs of a trip', svg: picture({ kind: 'legs', axis, p0, a, b, given: step < 3 ? leg1 : null }), line: step >= 3 ? 'Work out each leg on its own (the bigger take away the smaller), then add the two legs.' : 'Work out the second leg (the bigger take away the smaller), then add the first leg to it.' },
        own: { strand: step <= 1 ? 'add' : step === 2 ? 'dec' : 'words', at: MAKERS.legs.at(step) }, credit: [{ strand: 'sub', at: step <= 1 ? 24 : 50, weight: 0.5 }],
        facts: facts(s, { d: all, axis, mode: 'legs', leg1 }),
      }, rand);
    },
  },
  // ── where it will be: from (x, y), so far across and so far up or down: the coordinates it ends at ──
  where: {
    strand: 'add', at: () => 29,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), size = sizeFor(live), s = fromLive(live, 'over', { prec: 1, axis: 'both', least: 2 }) || madeBoth(t);
      const [sx, sy] = s.from.map((v) => Math.round(v)), [tx, ty] = s.to.map((v) => Math.round(v)), dx = tx - sx, dy = ty - sy;
      const it = s.place && s.place.kind === 'socket' ? targetWords(s, true) : isPlace(s) ? targetWords(s) : 'The canister the crane goes for';
      const moves = [dx ? `${Math.abs(dx)} m ${wayOf('x', dx)}` : null, dy ? `${Math.abs(dy)} m ${wayOf('y', dy)} the grid` : null].filter(Boolean).join(' and ');
      const slips = [
        { ...P(sx - dx, ty), why: dx > 0 ? `It is ${Math.abs(dx)} m to the right, so add to x.` : `It is ${Math.abs(dx)} m to the left, so take away from x.` },
        { ...P(tx, sy - dy), why: dy > 0 ? `It is ${Math.abs(dy)} m up the grid, so add to y.` : `It is ${Math.abs(dy)} m down the grid, so take away from y.` },
        { ...P(sx + Math.sign(dx || 1) * Math.abs(dy), sy + Math.sign(dy || 1) * Math.abs(dx)), why: `That moves ${Math.abs(dy)} across and ${Math.abs(dx)} up or down: the other way round.` },
        { ...P(tx + 1, ty), why: 'x is one too many.' }, { ...P(tx, ty - 1), why: 'y is one short.' }, { ...P(ty, tx), why: 'Those are the other way round: x first, then y.' },
      ].filter((c) => { const a = Math.floor(c.v / 100), b = c.v % 100; return c.v !== tx * 100 + ty && a >= 0 && b >= 0 && c.v > 0 && a <= size[0] + 5 && b <= size[1] + 9; });
      const sum = [dx ? { op: dx > 0 ? 'add' : 'sub', a: sx, b: Math.abs(dx), say: `x: ${dx > 0 ? 'to the right is adding' : 'to the left is taking away'}` } : null, dy ? { op: dy > 0 ? 'add' : 'sub', a: sy, b: Math.abs(dy), say: `y: ${dy > 0 ? 'up is adding' : 'down is taking away'}` } : null].filter(Boolean);
      return ownOrder({
        key: 'where', story: `The crane is at (${sx}, ${sy}). ${it} is ${moves} from there.`, ask: 'What are its coordinates (x, y)?',
        right: P(tx, ty), slips,
        rightWhy: `(${sx} ${dx >= 0 ? '+' : '−'} ${Math.abs(dx)}, ${sy} ${dy >= 0 ? '+' : '−'} ${Math.abs(dy)}) = (${tx}, ${ty})`,
        sum: apart(sum),
        help: { title: 'Where it will be', svg: picture({ kind: 'grid', size, crane: [sx, sy], arrows: [dx, dy], ask: '?', numbers: true }), line: 'x first: to the right is adding, to the left is taking away. Then y: up the grid is adding, down is taking away.', steps: stepWords(sum) },
        own: { strand: 'add', at: 29 }, credit: [{ strand: 'sub', at: 24, weight: 0.5 }], facts: facts(s, { to: [tx, ty], axis: 'both', mode: 'pair', hide: true }),
      }, rand);
    },
  },
  // ── how far along x and how far along y, from (x, y) to (x, y) ──
  both: {
    strand: 'sub', at: () => 32,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'over', { prec: 1, axis: 'both', least: 2 }) || madeBoth(t);
      const [sx, sy] = s.from.map((v) => Math.round(v)), [tx, ty] = (s.to).map((v) => Math.round(v)), dx = Math.abs(tx - sx), dy = Math.abs(ty - sy);
      const B = (a, b, why = '') => ({ v: a * 100 + b, big: `x ${a}, y ${b}`, small: 'metres', label: `${a} m along x, ${b} m along y`, why });
      const slips = [B(dy, dx, 'Those are the other way round: x first (across), then y (up and down).'), B(tx, ty, `(${tx}, ${ty}) is where it goes, not how far.`), B(sx + tx, sy + ty, 'That adds. How far is the bigger take away the smaller.'), B(dx + 1, dy, 'x is one too many.'), B(dx, Math.max(1, dy - 1), 'y is one short.')].filter((c) => c.v !== dx * 100 + dy && c.v > 0);
      return ownOrder({
        key: 'both', story: `The crane is at (${sx}, ${sy}). ${targetWords(s, true)} is at (${tx}, ${ty}).`, ask: 'How far must the crane go along x, and how far along y?',
        right: B(dx, dy), slips,
        rightWhy: `${Math.max(tx, sx)} − ${Math.min(tx, sx)} = ${dx} along x; ${Math.max(ty, sy)} − ${Math.min(ty, sy)} = ${dy} along y`,
        sum: apart([{ op: 'sub', a: Math.max(tx, sx), b: Math.min(tx, sx), say: 'Along x' }, { op: 'sub', a: Math.max(ty, sy), b: Math.min(ty, sy), say: 'Along y' }]),
        help: { title: 'Along x, along y', svg: picture({ kind: 'grid', size: sizeFor(live), crane: [sx, sy], target: [tx, ty], path: true, numbers: true }), line: 'Each way on its own: the bigger x take away the smaller, then the bigger y take away the smaller.', steps: stepWords([{ op: 'sub', a: Math.max(tx, sx), b: Math.min(tx, sx), say: 'Along x' }, { op: 'sub', a: Math.max(ty, sy), b: Math.min(ty, sy), say: 'Along y' }]) },
        own: { strand: 'sub', at: 32 }, facts: facts(s, { axis: 'both', mode: 'both', d: [dx, dy] }),
      }, rand);
    },
  },
  // ── up and down as plus and minus: Mathwood's negatives card on the hook's real move ──
  change: {
    strand: 'number', at: () => 36,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'lower', { prec: 1 }) || madeLower(t, 1);
      const a = Math.round(s.from), b = Math.round(s.to), c = b - a, where = lowerWords(s);
      const card = makeCard(b, '-', a, { size: 4, rand });
      const WHY = { way: 'That adds the heights. The change is where it ends take away where it starts.', sign: 'Right size, wrong way: going down makes it minus.', drop: 'That adds the sizes and drops the signs. Ends minus starts.', start: 'That starts on the wrong side. Ends minus starts.', near: 'One off: count the metres on the scale again.' };
      const coins = card.targets.map((x) => ({ ...F(x.n, METRE, { sign: true }), v: CHANGE_AT + x.n, good: x.good, why: x.good ? '' : WHY[x.trap] || WHY[signSlip(b, '-', a, x.n)] || 'Count the metres from where the grab is to where it goes, and say which way.' }));
      const right = coins.find((x) => x.good);
      return ownOrder({
        key: 'change', story: `On the hoist's scale, up is plus and down is minus. The grab is at ${a} m; ${where} is at ${b} m.`, ask: 'What is the change in the grab\'s height?',
        right, slips: coins.filter((x) => !x.good),
        rightWhy: `${b} − ${a} = ${c > 0 ? '+' : '−'}${Math.abs(c)}: ${Math.abs(c)} m ${c < 0 ? 'down' : 'up'}`,
        sum: { op: 'sub', a: Math.max(a, b), b: Math.min(a, b), say: 'The size of the change' },
        help: { title: 'Up is plus, down is minus', svg: picture({ kind: 'height', from: a, to: b, signed: true }), line: 'Where it ends take away where it starts. Going down makes it minus.', steps: [`The size: ${Math.max(a, b)} − ${Math.min(a, b)}`, `The way: ${c < 0 ? 'down, so minus' : 'up, so plus'}`] },
        own: { strand: 'number', at: 36 }, credit: [{ strand: 'sub', at: 20, weight: 0.5 }], facts: facts(s, { change: c, offset: CHANGE_AT, mode: 'change' }),
      }, rand);
    },
  },
  // ── plus and minus along the grid and up and down, in hundredths: the change with its sign ──
  signed: {
    strand: 'sub', at: () => 68,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), kind = live && live.peek ? live.peek() : t.pick(['over', 'lower']);
      let a, b, axis, story, ask, s;
      if (kind === 'lower') {
        s = fromLive(live, 'lower', { prec: 0.01 }) || madeLower(t, 0.01); a = s.from; b = s.to; axis = 'h';
        story = `Up is plus and down is minus. The grab goes from ${t2(a)} m to ${t2(b)} m, down to ${lowerWords(s)}.`; ask = 'What is the change in the grab\'s height?';
      } else {
        s = fromLive(live, 'over', { prec: 0.01, least: 0.5 }) || madeOver(t, 0.01); axis = s.axis === 'y' ? 'y' : 'x'; const i = axis === 'y' ? 1 : 0; a = s.from[i]; b = s.to[i];
        story = `On the grid, ${axis === 'y' ? 'up toward the bay door is plus and down toward the way in is minus' : 'to the right is plus and to the left is minus'}. ${cap(partFor(live, axis))} goes from ${axis} = ${t2(a)} to ${axis} = ${t2(b)}.`; ask = `What is the change in ${axis}?`;
      }
      const c = r2(b - a), size = r2(Math.abs(c)), S = (n, why = '') => ({ ...F(n, METRE, { sign: true }), v: r2(CHANGE_AT + n), why });
      const way = axis === 'h' ? (c < 0 ? 'down, so minus' : 'up, so plus') : axis === 'y' ? (c < 0 ? 'down the grid, so minus' : 'up the grid, so plus') : (c < 0 ? 'to the left, so minus' : 'to the right, so plus');
      const slips = [S(-c, `Right size, wrong way: it goes ${way}.`), S(r2(Math.sign(c) * (Math.abs(a) + Math.abs(b))), 'That adds the two. The change is where it ends take away where it starts.'), S(r2(c + 0.1 * Math.sign(c || 1)), 'Off by a tenth: line up the points and take away.'), S(r2(c - 0.01 * Math.sign(c || 1)), 'Off by the last place: line up the points.')];
      return ownOrder({
        key: `signed:${axis}`, story, ask, right: S(c), slips,
        rightWhy: `${t2(b)} − ${t2(a)} = ${c < 0 ? '−' : '+'}${t2(size)}`,
        sum: { op: 'sub', a: Math.max(a, b), b: Math.min(a, b), say: 'The size of the change' },
        help: { title: 'Plus and minus', svg: axis === 'h' ? picture({ kind: 'height', from: a, to: b, signed: true }) : picture({ kind: 'line', axis, from: a, to: b, signed: true }), line: 'The size is the bigger take away the smaller. Then the way it goes gives the sign.', steps: [`The size: ${t2(Math.max(a, b))} − ${t2(Math.min(a, b))}`, `The way: ${way}`] },
        own: { strand: 'sub', at: 68 }, credit: [{ strand: 'dec', at: 50, weight: 0.5 }], facts: facts(s, { change: c, offset: CHANGE_AT, axis: axis === 'h' ? null : axis, mode: axis === 'h' ? 'change' : 'signed' }),
      }, rand);
    },
  },
};
// a distance along one axis, taking away (the distance cards, and a trip's first leg)
function distOrder(s, prec, rand, live, key, { first = false, second = false, at = null } = {}) {
  const i = s.axis === 'y' ? 1 : 0, a = s.from[i], b = s.to[i], d = r2(Math.abs(b - a)), sum = r2(a + b), part = partFor(live, s.axis);
  const lost = prec < 1 && Math.round(d * 100) % 100 !== 0;
  const leg = first ? 'first' : second ? 'second' : null;
  const story = leg ? `The ${leg} leg of this trip: ${part} goes from ${s.axis} = ${t2(a)} to ${targetWords(s, true).replace(/^The/, 'the')} at ${s.axis} = ${t2(b)}.` : `${cap(part)} is at ${s.axis} = ${t2(a)}. ${targetWords(s, true)} is at ${s.axis} = ${t2(b)}.`;
  return ownOrder({
    key, story, ask: leg ? `How long is the ${leg} leg?` : `How far must ${part} go along ${AX[s.axis]}?`,
    right: F(d, METRE),
    slips: [{ ...F(sum, METRE), why: `That adds the two. The way between is the bigger take away the smaller: ${t2(Math.max(a, b))} − ${t2(Math.min(a, b))}.` },
      { ...F(b, METRE), why: `${t2(b)} is where it goes. How far is that from ${t2(a)}?` },
      { ...F(a, METRE), why: `${t2(a)} is where ${part} is now. How far to ${t2(b)}?` },
      { ...F(d + prec, METRE), why: prec === 1 ? 'One metre too far: count on from the smaller number.' : 'Too far by the last place. Line the points up and take away.' },
      { ...F(Math.max(prec, d - prec), METRE), why: prec === 1 ? 'One metre short: count on from the smaller number.' : 'Short by the last place. Line the points up and take away.' },
      ...(lost ? [{ ...F(r2(Math.round(d * 100)), METRE), why: `The point went missing: ${t2(d)}, not ${t2(Math.round(d * 100))}.` }] : [])],
    rightWhy: `${t2(Math.max(a, b))} − ${t2(Math.min(a, b))} = ${u(d, METRE)}`, sum: { op: 'sub', a: Math.max(a, b), b: Math.min(a, b) },
    help: { title: `Along ${AX[s.axis]}`, svg: picture({ kind: 'line', axis: s.axis, from: a, to: b }), line: 'Where it goes take away where it is: the bigger number minus the smaller.', steps: [`${t2(Math.max(a, b))} − ${t2(Math.min(a, b))} = ?`] },
    own: { strand: prec === 1 ? 'sub' : 'dec', at: at ?? (prec === 1 ? 22 : prec === 0.1 ? 46 : 54) }, credit: prec === 1 ? [] : [{ strand: 'sub', at: 30, weight: 0.5 }], facts: facts(s, { d, axis: s.axis, mode: 'along' }),
  }, rand);
}

// ── the ladder: each level named for what its cards ask (the game's maker, 2026-11-17, of a level whose name said one
// thing and whose card asked another) ──────────────────────────────────────────────────────────────────────────────
const M = (maker, step, w = 1) => ({ maker, step, w });
export const PLACE = {
  id: 'crane', name: 'The crane check', short: 'Crane', math: 'A crane over a grid: coordinates, and how far it goes by adding and taking away', pic: 'crane', job: null,
  line: 'The crane reports a fault: check each move, from which quadrant to the whole of a trip.',
  levels: [
    { id: 'quad', title: 'Which quadrant', line: 'Which quadrant is the blinking canister in?', grade: 2, gen: { mix: [M('quad', 1)] } },
    { id: 'count', title: 'Counting squares and metres', line: 'Count the squares to the canister and the metres down, up to 5', grade: 4, gen: { mix: [M('count', 1, 2), M('lower', 1)] } },
    { id: 'count10', title: 'Counting to 10: squares and metres', line: 'Up to 10 squares along the grid, and the metres down', grade: 7, gen: { mix: [M('count', 2, 2), M('lower', 1)] } },
    { id: 'read', title: 'Reading the grid', line: 'What is the y of the blinking canister?', grade: 10, gen: { mix: [M('read', 1)] } },
    { id: 'find', title: 'Finding a point', line: 'Which mark is at (12, 30)?', grade: 14, gen: { mix: [M('find', 1)] } },
    { id: 'pair', title: 'Coordinates: reading and finding', line: 'The blinking canister is at (11, 22); which mark is at (3, 15)?', grade: 18, gen: { mix: [M('pair', 1, 2), M('find', 1)] } },
    { id: 'dist', title: 'How far: along and down', line: 'From y = 12 to y = 22 is 10 m; the grab from 6 m down to 2 m', grade: 22, gen: { mix: [M('dist', 1, 2), M('lower', 2)] } },
    { id: 'legs', title: 'The legs of a trip', line: '10 m to the canister, then 16 m to the socket: 26 m in all', grade: 26, gen: { mix: [M('legs', 1)] } },
    { id: 'where', title: 'Where will it be?', line: 'From (4, 30), 6 m to the right and 9 m down: (10, 21)', grade: 29, gen: { mix: [M('where', 1)] } },
    { id: 'both', title: 'How far along x and along y', line: 'From (4, 30) to (10, 21): 6 m along x, 9 m along y', grade: 32, gen: { mix: [M('both', 1)] } },
    { id: 'change', title: 'Up is plus, down is minus', line: 'From 6 m down to 2 m is a change of −4', grade: 36, gen: { mix: [M('change', 1)] } },
    { id: 'tenths', title: 'Tenths: along and down', line: 'From y = 12.4 to y = 21.6; the grab from 6.2 m to 2.3 m', grade: 46, gen: { mix: [M('dist', 2, 2), M('lower', 3)] } },
    { id: 'hundredths', title: 'Hundredths: along and down', line: 'From y = 5.78 to y = 22.08; the grab from 6.28 m to 2.34 m', grade: 54, gen: { mix: [M('dist', 3, 2), M('lower', 4)] } },
    { id: 'legs2', title: 'The legs of a trip, in hundredths', line: '17.3 m on the first leg, then from y = 21.95 to y = 15', grade: 61, gen: { mix: [M('legs', 2)] } },
    { id: 'signed', title: 'Plus and minus, in hundredths', line: 'From y = 30.8 to y = 18.25 is a change of −12.55', grade: 68, gen: { mix: [M('signed', 1)] } },
    { id: 'trip', title: 'The whole trip', line: 'From y = 4.65 to the canister at 21.95, then on to 15: how far in all?', grade: 75, gen: { mix: [M('legs', 3)] } },
  ],
};

// which kinds of move each of the job's makers can ask about
const SUITS = { quad: ['over'], count: ['over'], read: ['over'], find: ['over'], pair: ['over'], dist: ['over'], legs: ['over'], where: ['over'], both: ['over'], lower: ['lower'], change: ['lower'], signed: ['over', 'lower'] };
export const kindsOf = (mix) => new Set(mix.flatMap((a) => SUITS[a.maker] || []));
// the level's makers that suit the crane's next asked move, one of them by weight (the crane makes the kinds of move
// the level does not ask about by itself); none: null (Mathwood's own pick)
function pickAsk(mix, { rand = Math.random, live = null } = {}) {
  if (live && live.only) live.only(kindsOf(mix));
  const next = live && live.peek ? live.peek() : null;
  if (!next) return null;
  let fits = mix.filter((a) => (SUITS[a.maker] || []).includes(next));
  if (!fits.length) {
    // (a level with nothing for this move: the crane makes it by itself, and the card is about the next one)
    if (live.pass) live.pass();
    const again = live.peek ? live.peek() : null;
    fits = mix.filter((a) => (SUITS[a.maker] || []).includes(again));
    if (!fits.length) return null;
  }
  let r = rand() * fits.reduce((q, a) => q + (a.w ?? 1), 0);
  for (const a of fits) if ((r -= a.w ?? 1) <= 0) return a;
  return fits[fits.length - 1];
}

// THE OPERATOR'S CHAIR in the smelter's control room: one seat (the game's maker: "a single option to get into the
// seat"); the crane game comes up, with free control a switch on its screen (src/cranedrive.js)
export const OPERATOR = { piece: 'opChair', local: [0, 0, -0.95], face: [0, 1] };
export const JOB = {
  dark: true,      // its pictures are drawn dark, with light lines (src/jobs/pics.js NIGHT; the game's maker: "the dark mode looks better")
  id: 'crane', name: 'Crane system', short: 'Crane', open: true, pickAsk,
  spot: OPERATOR, near: 2.3, seated: true,
  sign: 'Crane operator', hint: 'Verify the crane\'s moves: credits for each right answer',
  // (`check`, not `game`: a job's `game` is a game that runs itself, the arena's Mathball, src/jobs/index.js)
  place: PLACE, makers: MAKERS, card: 'crane', check: GAME,
};
