// THE CRANE BY HAND: the smelter's bridge crane worked live, instead of from the round's timetable. Two things work it
// this way: FREE CONTROL (src/cranedrive.js: a stick and buttons, no credits) and the CRANE GAME (src/jobs/crane.js:
// each right answer is a move, made here by the autopilot below). Both start from the operator's chair.
//
// The same crane as the round's, at the round's speeds (crane-plan.js SPEED), eased in and out:
//   - THREE WAYS AT ONCE, AND THE TURN. The bridge along the hangar (x), the trolley along the bridge (z), the hoist
//     (up and down), the cradle's turn: any of them at the same time.
//   - NOTHING THROUGH ANYTHING. Every little move, points all over the cradle, its arms, its cables and the canister
//     it holds are looked up in what stands still (world.solid: the hangar's walls, the ship, the rack, the sockets'
//     collars, the floor) and against every other canister, a tray that is out and a shut iris. A move that would go
//     into any of them does not happen.
//   - DOCKING IS NOT HARD (the game's maker, 2026-11-16: "I think some lights should turn green or something when it
//     is close enough to dock successfully. And it shouldn't be really difficult to do" and "when the crane is in the
//     right position then the pod should automatically attach or detach the pod"): near a place (a canister to take,
//     or a free place for the one it holds) the crane lines itself up on it and turns the cradle to it; lowered onto
//     a canister it takes it by itself; lowered into a free place it lets go by itself; in front of a free socket at
//     its height it pushes the canister in by itself. Each way has a light (read().aids: off, near, on).
//   - PEOPLE. Free control is free (the game's maker: "let the crane do whatever and make it entertaining"): it never
//     stops for anyone (src/crane.js makes them run, and a notice says so). The autopilot (the crane game) keeps the
//     round's rule: it will not come down over anyone, and waits (D.rules.people).
//   - BY ITSELF, AS IN THE ROUND: a mount's tray comes out when the cradle comes for its canister (or brings one) and
//     goes home when the cradle has gone up; a socket's iris opens for a canister in front of it; the collar's dogs
//     shut on a seated canister and let go when the cradle takes it; a docked canister with ore in it drains.
//   - LETTING GO OF THE CONTROLS: leave() lets go of a canister that is resting, opens an empty grab, then works out
//     a way up out of wherever the crane is, and once the trays are home it is `left`: D.state is then a snapshot the
//     round takes up again from (crane-plan.js planFrom).
//
//   const D = makeDrive(site, state, world, opts)
//     site      kit/crane.js's site (site.rail: where the hook may go; site.dims: the parts' sizes)
//     state     a snapshot (crane-plan.js stateAt), changed in place from now on (kit/crane.js poses it)
//     world     { solid(x, y, z): true inside what stands still, eyes: [{ x, y, z }] where people's feet are }
//     opts      { speed (SPEED), ore(c): tonnes of ore a full canister c holds, people: the autopilot's rule }
//   D.step(dt, cmd)     cmd = { move: [x, z] (a push in the station's plane, length up to 1), hoist: -1..1 (up +),
//                       turn: -1..1 (the cradle, + turns it from +z toward +x) }. Ignored while the autopilot has
//                       steps. D.notes: what it would not do just now and why ([{ key, text }])
//   D.go(steps)         the autopilot: [{ to: { x, z, hoist, yaw }, v: { x, z, hoist, yaw }, asked }, { grab:
//                       'shut' | 'open' }, { wait: seconds }, { until(D) }] one after another (D.busy while it has
//                       some; D.stop() drops them; D.failed says which could not be done and why)
//   D.read()            the readouts: { x, z, hook, yaw, held, place, resting, seated, aids }
//   D.leave() / D.left  the way up (as autopilot steps), and whether it is done
import { SPEED, moveTime, along as alongAt, near0, alongNear } from './crane-plan.js';

export const DRIVE = {
  capture: 0.6,         // metres across: how near a place the crane lines itself up on it
  guide: 6.5,           // metres: how far above a place that lining up starts (all the way up: let go of the stick over a place and it settles over it)
  snap: 0.004,          // metres: lined up, seated, at a height, when this near
  pull: 3.0,            // how quickly it lines itself up (a share of what is left, each second)
  turnPull: 2.0,        // how quickly the cradle turns itself to a place (radians a second at most)
  margin: 0.9,          // metres round a load in which a person counts as under it (the round's: src/crane.js RULES)
  head: 2.4,            // people this high over the floor (the catwalk) are not under it
  low: 3.2,             // a load whose underside is lower than this (metres) is "low over" someone (the notice)
  canister: 0.4,        // tonnes: an empty canister (the job's sums do not use it: no weights on the crane)
  step: 0.025,          // metres: the most any part moves between two looks for what is in the way
  aid: { on: 0.05, near: 0.6, hOn: 0.03, hNear: 0.6 },   // the docking lights: within this (m) green, within this amber
  rearm: 0.3,           // metres: after letting go, how far the cradle must rise before it takes a canister again
  brake: { x: 2.4, z: 2.2, hoist: 2.2, yaw: 2.0 },        // slowing down when let go of (a second's worth)
  clearHeld: 1.25,      // metres over a mount's canister (its middle) the hook must be for a tray to move under a load,
  clearEmpty: 0.65,     // ... and under the open cradle
};
const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const approach = (v, to, dv) => (v < to ? Math.min(to, v + dv) : Math.max(to, v - dv));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const AXES = ['x', 'z', 'hoist', 'yaw'];

export function makeDrive(site, state, world = {}, opts = {}) {
  const S = state, sp = opts.speed || SPEED, d = site.dims, R = d.R, half = site.can.half, lift = site.can.lift || 0;
  const M = site.mounts, K = site.sockets, B = site.bays, G = d.grip, A = d.arc, armR = A.r + A.tube;
  const seat = site.can.seat, clear = site.can.clear;
  const oreOf = opts.ore || (() => 1.2);
  const KIN = { x: sp.bridge, z: sp.trolley, hoist: sp.hoist, yaw: sp.turn };
  let held = S.cans.findIndex((q) => q.where === 'held');
  const vel = { x: 0, z: 0, hoist: 0, yaw: 0 };
  let action = null;            // a timed action under way: the grab shutting or opening, the dogs letting go
  const auto = [];              // the autopilot's steps
  let leaving = false, left = false, upPlanned = false, armedAt = -Infinity, liftArm = -Infinity;
  const want = { iris: K.map((_, k) => S.iris[k]), lit: K.map((_, k) => S.lit[k]) };
  const trail = [];             // where it has been since it was last up, for the way back if all else fails
  // (hurry: the game's moves the crane makes by itself, while the next card waits, are made this many times as quick;
  // never the move a card asked about. byHand: worked by the stick, so it lines itself up, takes and lets go, and
  // docks by itself; the game's autopilot makes its moves exactly as asked)
  const D = { state: S, notes: [], place: null, failed: null, pulling: false, hurry: 1, byHand: true, rules: { people: opts.people ?? false }, aimAt: null,
    get held() { return held; }, get busy() { return auto.length > 0 || !!action; }, get moving() { return auto.length > 0 || !!action || Math.abs(vel.x) + Math.abs(vel.z) + Math.abs(vel.hoist) + Math.abs(vel.yaw) > 1e-3; }, get left() { return left; }, get leaving() { return leaving; }, get action() { return action && action.kind; }, get steps() { return auto.length; }, vel };
  const note = (key, text) => { if (!D.notes.some((n) => n.key === key)) D.notes.push({ key, text }); };

  // ── where things are ────────────────────────────────────────────────────────────────────────────────────────────
  const hookAt = (c) => [c.x, c.hoist, c.z];
  const outPos = (i) => [M[i].at[0] + M[i].out[0], M[i].at[1] + lift, M[i].at[2] + M[i].out[1]];
  const sockPos = (k, ax) => [K[k].at[0] + K[k].n[0] * ax, K[k].at[1], K[k].at[2] + K[k].n[1] * ax];
  const dockAt = (k) => sockPos(k, half - seat), waitAt = (k) => sockPos(k, half + clear);
  const axisOf = (k) => Math.atan2(K[k].n[0], K[k].n[1]);
  // (a point's distance out from a socket's mouth along its facing, and across it, in the station's plane)
  const axOf = (k, x, z) => (x - K[k].at[0]) * K[k].n[0] + (z - K[k].at[2]) * K[k].n[1];
  const latOf = (k, x, z) => Math.abs((x - K[k].at[0]) * K[k].n[1] - (z - K[k].at[2]) * K[k].n[0]);
  const whoAt = (where, i) => S.cans.findIndex((q) => q.where === where && q.i === i);
  // the middle of canister c where it rests (riding its tray out of the ship, lifted off the saddles first)
  function middleOf(c) {
    const q = S.cans[c];
    if (!q) return null;
    if (q.where === 'mount') { const m = M[q.i], v = S.tray[q.i], up = smooth(v / d.trayShare) * lift, out = Math.max(0, (v - d.trayShare) / (1 - d.trayShare)); return [m.at[0] + m.out[0] * out, m.at[1] + up, m.at[2] + m.out[1] * out]; }
    if (q.where === 'socket') return dockAt(q.i);
    if (q.where === 'bay') return B[q.i].at;
    return null;
  }
  // the one over a lower mount (the same place, the row above)
  const pairOf = (list, i, up) => list.findIndex((q, j) => j !== i && !!q.upper === up && Math.abs(q.at[0] - list[i].at[0]) < 0.1 && Math.abs(q.at[2] - list[i].at[2]) < 0.1);
  const mOver = M.map((m, i) => (m.upper ? -1 : pairOf(M, i, true)));
  const heldYaw = () => (held >= 0 ? S.yaw + (S.cans[held].rel || 0) : S.yaw);

  // ── what the crane is lined up with (or nearly) ───────────────────────────────────────────────────────────────
  // -> { kind: 'socket' | 'bay' | 'mount', i, at: [x, y, z] where the hook goes (the canister's middle at rest; for a
  //    held canister at a socket, the point on the socket's middle line in front of it, or as far in as it is),
  //    axis: the way a canister lies there, c: the canister there (-1: none), d: how far off across (metres), dy: how
  //    far above it the hook is }. Carrying: places that can take a canister; empty: places with one to take
  function lineup(c = S, carrying = held >= 0, reach = DRIVE.capture) {
    const [hx, hy, hz] = hookAt(c);
    let best = null;
    const offer = (L) => { if (!best || L.d < best.d) best = L; };
    K.forEach((s, k) => {
      const there = whoAt('socket', k);
      if (carrying ? there >= 0 : there < 0) return;
      if (carrying) {
        // (anywhere from seated to a little way out in front of its mouth, across; of two one over the other, the
        // one nearer the load's height)
        const ax = axOf(k, hx, hz), side = latOf(k, hx, hz);
        if (ax > half - seat - 0.05 && ax < half + clear + 1.0 && side < reach) offer({ kind: 'socket', i: k, at: sockPos(k, Math.min(ax, half + clear)), axis: axisOf(k), c: -1, d: side + 0.15 * Math.abs(hy - s.at[1]), dy: hy - s.at[1], ax, seat: dockAt(k), wait: waitAt(k) });
      } else {
        const D0 = dockAt(k), dd = Math.hypot(hx - D0[0], hz - D0[2]);
        if (dd < reach) offer({ kind: 'socket', i: k, at: D0, axis: axisOf(k), c: there, d: dd, dy: hy - D0[1] });
      }
    });
    B.forEach((b, j) => {
      const there = whoAt('bay', j); if (carrying ? there >= 0 : there < 0) return;
      const dd = Math.hypot(hx - b.at[0], hz - b.at[2]); if (dd < reach) offer({ kind: 'bay', i: j, at: b.at, axis: there >= 0 ? S.cans[there].yaw : (b.yaw ?? 0), c: there, d: dd, dy: hy - b.at[1] });
    });
    M.forEach((m, i) => {
      const there = whoAt('mount', i); if (carrying ? there >= 0 : there < 0) return;
      if (mOver[i] >= 0 && whoAt('mount', mOver[i]) >= 0) return;   // (under a canister: out of reach)
      // (two free mounts one over the other: the one whose tray is out, else the lower, as the round loads them)
      const o = outPos(i), dd = Math.hypot(hx - o[0], hz - o[2]); if (dd < reach) offer({ kind: 'mount', i, at: o, axis: there >= 0 ? S.cans[there].yaw : m.yaw, c: there, d: dd + (S.tray[i] > 0.01 ? 0 : 1e-3) + (m.upper ? 5e-4 : 0), dy: hy - o[1] });
    });
    return best;
  }
  const tight = DRIVE.snap * 3;
  const squareTo = (L, yaw) => Math.abs(Math.sin(yaw - L.axis)) < 0.02;
  // is the held canister resting where it may be let go? (seated in a socket with the dogs shut, on a tray that is
  // out, in a bay; lying the place's way) -> the place, or null
  function resting() {
    if (held < 0) return null;
    const L = lineup(S, true, tight + 0.01);
    if (!L || Math.abs(L.dy) > tight || !squareTo(L, heldYaw())) return null;
    if (L.kind === 'socket') return Math.abs(L.ax - (half - seat)) < tight && S.lit[L.i] > 0.999 ? L : null;
    if (L.kind === 'mount') return S.tray[L.i] > 0.999 ? L : null;
    return L;
  }
  // is the empty cradle seated on a canister it can take? -> the place, or null
  function seatedOn() {
    if (held >= 0) return null;
    const L = lineup(S, false, tight + 0.01);
    if (!L || Math.abs(L.dy) > tight || !squareTo(L, S.yaw)) return null;
    if (L.kind === 'mount' && S.tray[L.i] < 0.999) return null;
    return L;
  }
  // the lowest the hook may come where it is lined up (on a canister's crown, or a canister set down at rest; coming
  // down over a ship's tray that is not out yet, high enough for it to come out under the cradle) -> a height, or null
  function floorAt(L, carrying, down = false) {
    if (!L || (L.kind === 'socket' && carrying)) return null;
    if (L.d > 0.03) return null;
    if (L.kind === 'mount' && S.tray[L.i] < 0.999) return down ? M[L.i].at[1] + lift + (carrying ? DRIVE.clearHeld : DRIVE.clearEmpty) : null;
    if (!carrying && L.c < 0) return null;
    return L.at[1];
  }

  // ── the shapes: points over the cradle, its arms, its cables, its block and a held canister, in their frames ──────
  const CAN = [], FRAME = [], ARC = [], BLOCK = [];
  for (let k = 0; k <= 8; k++) { const z = -(half - 0.16) + 2 * (half - 0.16) * k / 8; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; CAN.push([Math.cos(a) * (R + 0.02), Math.sin(a) * (R + 0.02), z]); } }
  for (const z of [-half, half]) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; CAN.push([Math.cos(a) * 0.3, Math.sin(a) * 0.3, z]); }
  for (const x of [-G.w, 0, G.w]) for (const y of [G.under, G.top]) for (const z of [-G.half, -G.half / 2, 0, G.half / 2, G.half]) FRAME.push([x, y, z]);
  for (let i = 0; i <= 8; i++) { const a = -A.half + 2 * A.half * i / 8; ARC.push([Math.sin(a) * armR, Math.cos(a) * armR]); }
  { const b = d.block, y0 = G.top + b.rotH, y1 = y0 + b.h; for (const x of [-b.half, 0, b.half]) for (const z of [-b.half, 0, b.half]) for (const y of [y0, y1]) BLOCK.push([x, y, z]); }
  // every point of the crane's moving parts below the trolley, in the station's frame, for a configuration
  // c = { x, z, yaw, hoist, arms }: fn(x, y, z, part) (part: 'can', 'frame', 'arm', 'block', 'cable'), stopping early on true
  function eachPoint(c, carrying, rel, fn) {
    const [hx, hy, hz] = hookAt(c), cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    const W = (lx, ly, lz, part) => fn(hx + lx * cy + lz * sy, hy + ly, hz - lx * sy + lz * cy, part);
    for (const p of FRAME) if (W(p[0], p[1], p[2], 'frame')) return true;
    for (const p of BLOCK) if (fn(hx + p[0], hy + p[1], hz + p[2], 'block')) return true;   // (the block does not turn)
    const t = smooth(c.arms);
    for (const a of d.arms) {
      const th = -a.way * A.shut * t, ct = Math.cos(th), st = Math.sin(th);
      for (const [x0, y0] of ARC) if (W(x0 * ct - y0 * st, x0 * st + y0 * ct, a.z, 'arm')) return true;
    }
    // (the four cables, from the block's top up to the trolley)
    const y0 = hy + d.hookTop, top = site.rail.y + d.cableTop;
    for (const [kx, kz] of [[-d.cable.x, -d.cable.z], [d.cable.x, -d.cable.z], [-d.cable.x, d.cable.z], [d.cable.x, d.cable.z]]) for (const f of [0.15, 0.5, 0.85]) if (fn(hx + kx, y0 + (top - y0) * f, hz + kz, 'cable')) return true;
    if (carrying) {
      const cr = Math.cos(rel), sr = Math.sin(rel);
      for (const p of CAN) if (W(p[0] * cr + p[2] * sr, p[1], -p[0] * sr + p[2] * cr, 'can')) return true;
    }
    return false;
  }
  // is a point inside canister c (as it rests)? (a cylinder a little wider than the straps; its rounded ends thinner)
  function insideCan(c, x, y, z) {
    const m = middleOf(c); if (!m) return false;
    const yaw = S.cans[c].yaw, dx = x - m[0], dz = z - m[2], ax = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    if (Math.abs(ax) > half + 0.02) return false;
    const ac = dx * Math.cos(yaw) - dz * Math.sin(yaw), r = Math.hypot(ac, y - m[1]);
    return r < (Math.abs(ax) < half - 0.1 ? R + 0.04 : R - 0.05);
  }

  // ── is a configuration clear? -> null, or what it would go into ──────────────────────────────────────────────────
  // c: { x, z, yaw, hoist, arms }. Where it is lined up with a place, what touches by design there is not in the way:
  // the collar round a canister going into it (the canister must then be through an open iris, and no deeper than
  // seated), the canister the cradle comes down onto (only to its crown), what a canister is set down on.
  function blocked(c, carrying = held >= 0, rel = carrying ? (S.cans[held].rel || 0) : 0, down = false) {
    if (c.x < site.rail.x[0] - 1e-9 || c.x > site.rail.x[1] + 1e-9) return { what: 'end', axis: 'x' };
    if (c.z < site.rail.z[0] - 1e-9 || c.z > site.rail.z[1] + 1e-9) return { what: 'end', axis: 'z' };
    if (c.hoist > site.carry + 1e-9) return { what: 'top' };
    const L = lineup(c, carrying, 0.03);
    const [hx, , hz] = hookAt(c);
    const target = !carrying && L && L.c >= 0 && squareTo(L, c.yaw) ? L.c : -1;
    const fl = floorAt(L, carrying, down);
    if (fl != null && c.hoist < fl - 1e-4 && (carrying || target >= 0)) return { what: L.kind === 'mount' && S.tray[L.i] < 0.999 ? 'trayIn' : carrying ? (L.kind === 'bay' ? 'rack' : 'tray') : 'canister' };
    // (a socket lined up with: its collar is where the canister and the cradle's near arms go)
    const inSock = L && L.kind === 'socket' && (!carrying || (Math.abs(L.dy) < 0.03 && squareTo(L, c.yaw + rel))) ? L.i : -1;
    if (inSock >= 0 && carrying && L.ax < half - seat - 1e-4) return { what: 'seated' };
    const sk = inSock >= 0 ? K[inSock] : null;
    const inCollar = (x, y, z) => {
      if (!sk) return false;
      const ax = axOf(inSock, x, z), r = Math.hypot(latOf(inSock, x, z), y - sk.at[1]);
      return ax > -d.sock.deep - 0.05 && ax < 0.16 && r < d.sock.out + 0.14;
    };
    const nearCans = [];
    S.cans.forEach((q, k) => { if (k === held || k === target || q.where === 'held') return; const m = middleOf(k); if (m && Math.hypot(m[0] - hx, m[2] - hz) < half + 2.6) nearCans.push(k); });
    // (an empty tray that is out, but not the one under the held canister it is lined up with: that one is its rest)
    const outTrays = M.map((m, i) => i).filter((i) => S.tray[i] > 0.01 && whoAt('mount', i) < 0 && !(carrying && L && L.kind === 'mount' && L.i === i));
    let hit = null;
    eachPoint(c, carrying, rel, (x, y, z, part) => {
      if (y < 0.02) { hit = { what: 'floor', at: [x, y, z] }; return true; }
      for (const k of nearCans) if (insideCan(k, x, y, z)) { hit = { what: 'canister', c: k, at: [x, y, z] }; return true; }
      if (inCollar(x, y, z)) {
        // (in the collar's mouth, the canister only through its iris once it is open)
        if (part === 'can' && axOf(inSock, x, z) < 0.02 && S.iris[inSock] < 0.98) { hit = { what: 'iris', k: inSock, at: [x, y, z] }; return true; }
        return false;
      }
      // (an empty tray that is out: its bars just under where a canister would sit on it)
      if (part === 'can') for (const i of outTrays) { const o = outPos(i); if (Math.abs(x - o[0]) < 0.48 && Math.abs(z - o[2]) < 0.48 && y < o[1] - R + 0.005 && y > o[1] - R - 0.08) { hit = { what: 'tray', at: [x, y, z] }; return true; } }
      if (world.solid && world.solid(x, y, z)) { hit = { what: 'solid', part, at: [x, y, z] }; return true; }
      return false;
    });
    return hit;
  }

  // ── people under the load ──────────────────────────────────────────────────────────────────────────────────────
  // anyone on the patch of floor under the load (the canister held, or the cradle), DRIVE.margin more all round
  function under(c, carrying = held >= 0, margin = DRIVE.margin) {
    const eyes = world.eyes || []; if (!eyes.length) return null;
    const [hx, , hz] = hookAt(c), yaw = carrying ? c.yaw + (S.cans[held].rel || 0) : c.yaw, ex = carrying ? half : G.half;
    for (const e of eyes) {
      if (e.y > DRIVE.head) continue;
      const dx = e.x - hx, dz = e.z - hz, ax = Math.abs(dx * Math.sin(yaw) + dz * Math.cos(yaw)), ac = Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw));
      if (ax < ex + margin && ac < armR + margin) return e;
    }
    return null;
  }
  const underside = (c, carrying = held >= 0) => c.hoist - (carrying ? R + 0.1 : -0.17);

  // ── moving one part, a little at a time, stopping at whatever is in the way ───────────────────────────────────
  const cfg = () => ({ x: S.x, z: S.z, yaw: S.yaw, hoist: S.hoist, arms: S.arms });
  const hitWords = (h) => (h.what === 'canister' ? 'Another canister is in the way.' : h.what === 'iris' ? 'The socket\'s iris is still shut.' : h.what === 'floor' ? 'That is the floor.'
    : h.what === 'tray' ? 'It is down on the tray.' : h.what === 'trayIn' ? 'Waiting for the ship\'s tray to come out.' : h.what === 'rack' ? 'It is down on the rack.' : h.what === 'seated' ? 'It is all the way in.'
      : h.what === 'end' ? (h.axis === 'x' ? 'That is the end of the runway.' : 'That is the end of the bridge.') : h.what === 'top' ? 'That is as high as it goes.'
        : h.part === 'cable' ? 'The cables would touch something.' : h.over ? 'Something is in the way above.' : h.under ? 'Something is in the way below.' : 'Something is in the way.');
  // try to move `axis` by dv (metres, or radians for the turn); -> how far it got
  function nudge(axis, dv) {
    if (Math.abs(dv) < 1e-9) return 0;
    const unit = axis === 'yaw' ? DRIVE.step / (half + 0.2) : DRIVE.step;
    const n = Math.max(1, Math.ceil(Math.abs(dv) / unit)), each = dv / n;
    let got = 0;
    for (let s = 0; s < n; s++) {
      const c = cfg(); c[axis] += each;
      // people: the autopilot will not come down over anyone, nor take a low load over them
      if (D.rules.people) {
        if (axis === 'hoist' && each < 0 && under(c)) { note('people', held >= 0 ? 'Someone is under the load: it will not come down.' : 'Someone is under the grab: it will not come down.'); break; }
        if (axis !== 'hoist' && axis !== 'yaw' && underside(c) < DRIVE.low && under(c) && !under(cfg())) { note('people', 'Someone is under there: it waits for them.'); break; }
      }
      const hit = blocked(c, held >= 0, held >= 0 ? (S.cans[held].rel || 0) : 0, axis === 'hoist' && each < 0);
      if (hit) {
        if (hit.what === 'solid' && axis === 'hoist') { if (each > 0) hit.over = true; else hit.under = true; }
        note('hit:' + hit.what, hitWords(hit)); break;
      }
      S[axis] = c[axis];
      got += each;
    }
    return got;
  }

  // ── the timed things: the grab shutting or opening, the dogs letting go, trays, irises, draining ──────────────
  function startGrab(how) {
    if (how === 'shut') {
      if (S.arms > 0.999 && S.latch > 0.999) return false;
      action = { kind: 'shut', t: 0, T: sp.latch + sp.arms, on: seatedOn() };
      return true;
    }
    if (S.arms < 1e-3 && S.latch < 1e-3) return false;
    if (held >= 0) {
      const at = resting();
      if (!at) { note('letgo', 'It only lets go where a canister can rest: in a socket, on the ship\'s tray, or on the rack.'); return false; }
      // (it rests there from now, in the round's own words for where a canister is)
      const q = S.cans[held], yaw = heldYaw();
      q.where = at.kind; q.i = at.i; q.rel = undefined;
      q.yaw = at.kind === 'mount' ? (Math.cos(yaw - M[at.i].yaw) >= 0 ? M[at.i].yaw : near0(M[at.i].yaw + Math.PI)) : near0(yaw);
      held = -1; resetTrail(); armedAt = S.hoist;
      D.let = { kind: at.kind, i: at.i };
    }
    action = { kind: 'open', t: 0, T: sp.arms + sp.latch };
    return true;
  }
  function take(c) { const q = S.cans[c]; q.rel = near0(q.yaw - S.yaw); q.where = 'held'; q.i = undefined; held = c; resetTrail(); D.got = { c }; liftArm = S.hoist + DRIVE.rearm; }
  function stepAction(dt) {
    if (!action) return;
    action.t += dt;
    const x = Math.min(1, action.t / action.T);
    if (action.kind === 'shut') {
      const tl = sp.latch / action.T;
      S.latch = Math.min(1, x / tl); S.arms = x <= tl ? 0 : (x - tl) / (1 - tl);
      if (x >= 1) {
        S.latch = 1; S.arms = 1;
        const on = action.on; action = null;
        if (on && on.c >= 0) {
          // (out of a socket, the collar's dogs let go first)
          if (on.kind === 'socket') { want.lit[on.i] = 0; action = { kind: 'release', t: 0, T: sp.clamp, c: on.c, k: on.i }; }
          else take(on.c);
        }
      }
    } else if (action.kind === 'open') {
      const ta = sp.arms / action.T;
      S.arms = Math.max(0, 1 - x / ta); S.latch = x <= ta ? 1 : Math.max(0, 1 - (x - ta) / (1 - ta));
      if (x >= 1) { S.arms = 0; S.latch = 0; action = null; }
    } else if (action.kind === 'release') {
      if (S.lit[action.k] < 1e-3) { take(action.c); action = null; }
    }
  }
  // the trays, the irises, the collars' dogs, the draining: each frame, whoever is working the crane
  function stepParts(dt, k = 1) {
    const [hx, hy, hz] = hookAt(S);
    // (the one mount the cradle is over and could use: its tray comes out; one at a time)
    const wanted = lineup(S, held >= 0, 1.2);
    M.forEach((m, i) => {
      const o = outPos(i), far = Math.hypot(hx - o[0], hz - o[2]);
      let to = wanted && wanted.kind === 'mount' && wanted.i === i && !leaving ? 1 : 0;
      // (and it stays out while the cradle is down at it, whatever it holds)
      if (far < 0.15 && hy < o[1] + 1.2 && S.tray[i] > 0.5) to = 1;
      if (Math.abs(S.tray[i] - to) < 1e-9) return;
      // (it moves only with the cradle and any load clear above it, and never out over someone; "clear" is the very
      // height the hook is held at while a tray comes out under it, so a hook waiting there never stops the tray)
      const clearOf = hy > m.at[1] + lift + (held >= 0 ? DRIVE.clearHeld : DRIVE.clearEmpty) - 0.02 || Math.hypot(hx - (m.at[0] + o[0]) / 2, hz - (m.at[2] + o[2]) / 2) > half + 1.4;
      if (!clearOf) return;
      if (to > S.tray[i] && trayPeople(i)) { note('people', 'Someone is by the ship\'s tray: it stays in.'); return; }
      S.tray[i] = approach(S.tray[i], to, dt * k / sp.tray);
    });
    const L = held >= 0 ? lineup(S, true, DRIVE.capture) : null, hk = k;
    K.forEach((s, k2) => {
      const there = whoAt('socket', k2), releasing = action && action.kind === 'release' && action.k === k2;
      let open = there >= 0;
      // (a canister lined up in front of it, or in its mouth)
      if (L && L.kind === 'socket' && L.i === k2 && (Math.abs(L.dy) < 0.6 || L.ax - half < 0.1)) open = true;
      want.iris[k2] = open ? 1 : 0;
      S.iris[k2] = approach(S.iris[k2], want.iris[k2], dt * hk / sp.iris);
      // the dogs: shut on a canister seated in it (held or let go); let go when the cradle takes it, or is drawing a
      // held one back out
      if (releasing) want.lit[k2] = 0;
      else if (there >= 0) want.lit[k2] = 1;
      else if (L && L.kind === 'socket' && L.i === k2) want.lit[k2] = Math.abs(L.ax - (half - seat)) < tight && Math.abs(L.dy) < tight && !D.pulling ? 1 : 0;
      else want.lit[k2] = 0;
      S.lit[k2] = approach(S.lit[k2], want.lit[k2], dt * hk / sp.clamp);
    });
    S.cans.forEach((q) => { if (q.where === 'socket' && q.fill > 0 && S.lit[q.i] > 0.999) q.fill = Math.max(0, q.fill - dt / sp.drain); });
  }
  function trayPeople(i) {
    if (!D.rules.people) return false;
    const eyes = world.eyes || [], o = outPos(i), m = M[i];
    const cx = (m.at[0] + o[0]) / 2, cz = (m.at[2] + o[2]) / 2, alongX = Math.abs(Math.sin(m.yaw)) > 0.5;
    const ex = alongX ? half + DRIVE.margin : Math.abs(o[0] - m.at[0]) / 2 + R + DRIVE.margin, ez = alongX ? Math.abs(o[2] - m.at[2]) / 2 + R + DRIVE.margin : half + DRIVE.margin;
    return eyes.some((e) => e.y < DRIVE.head && Math.abs(e.x - cx) < ex && Math.abs(e.z - cz) < ez);
  }

  // ── lining up: near a place, the crane nudges itself onto it, turns to it, and docks ──────────────────────────
  // -> the extra speed for each part this frame { x, z, hoist, yaw }
  function lining(push) {
    const L = lineup(S, held >= 0, DRIVE.capture), out = { x: 0, z: 0, hoist: 0, yaw: 0 };
    D.place = L;
    if (!L) return out;
    const [hx, , hz] = hookAt(S), k = DRIVE.pull, still = Math.hypot(push.move[0], push.move[1]) < 0.15;
    // (turned to lie the place's way, whichever end first: the nearest)
    const yawTo = alongNear(L.axis - (held >= 0 ? (S.cans[held].rel || 0) : 0), S.yaw);
    if (push.turn === 0) out.yaw = clamp((yawTo - S.yaw) * 2.5, -DRIVE.turnPull, DRIVE.turnPull);
    if (L.kind === 'socket' && held >= 0) {
      // in front of a socket: across onto its middle line and to its height, and in once it is there
      const sx = -K[L.i].n[1], sz = K[L.i].n[0], lat = (L.at[0] - hx) * sx + (L.at[2] - hz) * sz;
      out.x += clamp(lat * sx * k, -0.4, 0.4); out.z += clamp(lat * sz * k, -0.4, 0.4);
      if (push.hoist === 0 && Math.abs(L.dy) < 1.2) out.hoist = clamp(-L.dy * k, -0.4, 0.4);
      // (lined up and at its height: in it goes, slowly, unless pushed back out)
      const ready = Math.abs(L.dy) < 0.02 && Math.abs(lat) < 0.02 && squareTo(L, heldYaw()) && S.iris[L.i] > 0.98;
      const outward = (push.move[0] * K[L.i].n[0] + push.move[1] * K[L.i].n[1]) > 0.3;
      if (ready && !outward && L.ax > half - seat + tight) { out.x -= K[L.i].n[0] * sp.push.v; out.z -= K[L.i].n[1] * sp.push.v; }
      return out;
    }
    // over a place: as it comes down within DRIVE.guide of it (or rests close over it), onto it
    if (L.dy < DRIVE.guide && (push.hoist < 0 || still)) {
      out.x += clamp((L.at[0] - hx) * k, -0.6, 0.6);
      out.z += clamp((L.at[2] - hz) * k, -0.6, 0.6);
    }
    return out;
  }

  // ── the docking lights: each way off, near or on, for the place the crane is lined up with (or D.aimAt) ────────
  function aids() {
    const P = D.aimAt || (D.byHand ? lineup(S, held >= 0, 1.6) : null);
    if (!P) return { x: 'off', y: 'off', h: 'off' };
    const [hx, hy, hz] = hookAt(S), A2 = DRIVE.aid;
    const look = (e, on, nr) => (e < on ? 'on' : e < nr ? 'near' : 'off');
    let ex = Math.abs(hx - P.at[0]), ez = Math.abs(hz - P.at[2]);
    // (in front of a socket with a canister: across it must be right; along its line, anywhere from where it waits
    // to seated is right; the height its middle line's)
    if (P.kind === 'socket' && held >= 0) {
      const lat = latOf(P.i, hx, hz), ax = axOf(P.i, hx, hz), out = Math.max(0, ax - (half + clear + 0.15), (half - seat) - ax);
      if (Math.abs(K[P.i].n[1]) > 0.5) { ex = lat; ez = out; } else { ex = out; ez = lat; }
    }
    return { x: look(ex, A2.on, A2.near), y: look(ez, A2.on, A2.near), h: look(Math.abs(hy - P.at[1]), A2.hOn, A2.hNear) };
  }

  // ── a frame ───────────────────────────────────────────────────────────────────────────────────────────────────
  function step(dt, cmd = {}) {
    D.notes = []; D.got = null; D.let = null;
    if (!(dt > 0)) return D;
    const k = auto.length && D.hurry > 1 && !auto[0].asked ? D.hurry : 1;
    stepAction(dt * k);
    if (auto.length && !action) runAuto(dt * k);
    const quiet = auto.length > 0 || leaving || !!action;
    const push = { move: quiet ? [0, 0] : cmd.move || [0, 0], hoist: quiet ? 0 : cmd.hoist || 0, turn: quiet ? 0 : cmd.turn || 0 };
    if (!auto.length && !action && !leaving) manual(dt, push);
    // (by hand: on a canister it takes it, resting in a place it lets go; the grab takes again only once it has
    // risen a little from where it let go)
    if (D.byHand && !auto.length && !action && !leaving) {
      if (held < 0 && S.hoist > armedAt + DRIVE.rearm) armedAt = -Infinity;
      if (held >= 0 && S.hoist > liftArm) liftArm = -Infinity;
      if (held < 0 && armedAt === -Infinity && seatedOn()) startGrab('shut');
      else if (held >= 0 && liftArm === -Infinity && resting()) startGrab('open');
      else if (held < 0 && S.arms > 0.5 && !seatedOn()) startGrab('open');
    }
    stepParts(dt, k);
    record();
    if (leaving && !auto.length && !action) settle();
    D.aid = aids();
    return D;
  }
  // the stick, the hoist and turn buttons, as speeds for each part, eased in and out
  function manual(dt, push) {
    const [mx, mz] = push.move;
    const wantV = { x: mx * KIN.x.v, z: mz * KIN.z.v, hoist: push.hoist * KIN.hoist.v, yaw: push.turn * KIN.yaw.v };
    // (at a socket: in its mouth, only slowly and only end on; drawn back only once the dogs let go)
    const L = held >= 0 ? lineup(S, true, 0.05) : null;
    D.pulling = false;
    let inMouth = false;
    if (L && L.kind === 'socket') {
      inMouth = L.ax - half < 0.12;
      const n = K[L.i].n, inward = -(wantV.x * n[0] + wantV.z * n[1]);
      if (inMouth || Math.abs(L.ax - (half + clear)) < 0.25) { const lim = clamp(inward, -sp.push.v, sp.push.v); wantV.x += (inward - lim) * n[0]; wantV.z += (inward - lim) * n[1]; }
      if (S.lit[L.i] > 1e-3 && inward < 0) { D.pulling = true; wantV.x = 0; wantV.z = 0; note('dogs', 'The collar is letting go of it.'); }
      if (inMouth) { wantV.hoist = 0; wantV.yaw = 0; const along = wantV.x * n[0] + wantV.z * n[1]; wantV.x = along * n[0]; wantV.z = along * n[1]; }
    }
    // (the last of a set-down, slowly; and over a ship's tray that is not out yet, high enough for it to come out under
    // the cradle, wherever near it the cradle is)
    let fl = floorAt(lineup(S, held >= 0, 0.03), held >= 0, true);
    const Lt = lineup(S, held >= 0, DRIVE.capture);
    if (Lt && Lt.kind === 'mount' && S.tray[Lt.i] < 0.999) { const f2 = M[Lt.i].at[1] + lift + (held >= 0 ? DRIVE.clearHeld : DRIVE.clearEmpty); fl = fl == null ? f2 : Math.max(fl, f2); }
    if (fl != null && wantV.hoist < 0 && S.hoist - fl < 0.35) wantV.hoist = Math.max(wantV.hoist, -sp.set.v);
    const g = D.byHand ? lining(push) : ((D.place = lineup(S, held >= 0, DRIVE.capture)), { x: 0, z: 0, hoist: 0, yaw: 0 });
    // (speeding up gently, as the round's moves do; braking firmly when the stick is let go or turned back)
    const ease = (v, to, a, brake) => approach(v, to, (to * v < 0 || Math.abs(to) < Math.abs(v) ? brake : a) * dt);
    for (const ax of AXES) {
      const lim = KIN[ax].v, to = clamp(wantV[ax] + g[ax], -lim, lim);
      vel[ax] = ease(vel[ax], (inMouth && (ax === 'hoist' || ax === 'yaw')) ? 0 : to, KIN[ax].a * 2, DRIVE.brake[ax]);
    }
    for (const ax of AXES) {
      if (Math.abs(vel[ax]) < 1e-6) { vel[ax] = 0; continue; }
      let dv = vel[ax] * dt;
      if (ax === 'hoist' && fl != null && S.hoist + dv < fl) dv = fl - S.hoist;
      if (ax === 'hoist' && S.hoist + dv > site.carry) dv = site.carry - S.hoist;
      const got = nudge(ax, dv);
      if (Math.abs(got - dv) > 1e-9) vel[ax] = 0;
    }
    // (onto what it is lined up with, once within a hair of it)
    const P = lineup(S, held >= 0, DRIVE.snap * 2);
    if (P && P.kind !== 'socket' && D.byHand) { const c = cfg(); c.x = P.at[0]; c.z = P.at[2]; if (!blocked(c)) { S.x = c.x; S.z = c.z; } }
    if (fl != null && Math.abs(S.hoist - fl) < DRIVE.snap) S.hoist = fl;
    if (D.byHand && D.place) { const yawTo = alongNear(D.place.axis - (held >= 0 ? (S.cans[held].rel || 0) : 0), S.yaw); if (Math.abs(yawTo - S.yaw) < 0.004) { const c = cfg(); c.yaw = yawTo; if (!blocked(c)) S.yaw = yawTo; } }
    if (Math.abs(S.yaw) > Math.PI * 4) S.yaw = near0(S.yaw);
  }

  // ── the autopilot ─────────────────────────────────────────────────────────────────────────────────────────────
  function go(steps) { for (const s of steps) auto.push({ ...s }); for (const ax of AXES) vel[ax] = 0; D.failed = null; return D; }
  function stop() { auto.length = 0; for (const ax of AXES) vel[ax] = 0; return D; }
  function runAuto(dt) {
    const s = auto[0];
    if (s.wait != null) { s.t = (s.t || 0) + dt; if (s.t >= s.wait) auto.shift(); return; }
    if (s.grab) {
      if (!s.started) {
        s.started = true;
        const already = s.grab === 'open' ? S.arms < 1e-3 && S.latch < 1e-3 : S.arms > 0.999 && S.latch > 0.999;
        if (!startGrab(s.grab) && !already) { D.failed = { ...s, why: D.notes.map((n) => n.text).join(' ') }; auto.length = 0; }
      } else if (!action) auto.shift();
      return;
    }
    if (s.until) { if (s.until(D)) auto.shift(); return; }
    if (!s.to) { auto.shift(); return; }
    // the parts to their values together: each planned as the round plans a move (its speed, speeding up and slowing
    // down), and followed as far as nothing is in the way (and where something is, it waits there: people walk on)
    if (!s.plan) {
      s.plan = {}; s.t = 0; s.T = 0;
      for (const ax of AXES) {
        if (s.to[ax] == null) continue;
        const from = S[ax], to = s.to[ax];
        if (Math.abs(to - from) < 1e-6) continue;
        const kin = KIN[ax], v = (s.v && s.v[ax]) || kin.v, a = s.v && s.v[ax] ? (s.even ? 50 : Math.min(kin.a, Math.max(0.2, v * 0.9))) : kin.a;
        const [T, k] = moveTime(Math.abs(to - from), { v, a });
        s.plan[ax] = { from, to, T, k }; s.T = Math.max(s.T, T);
      }
      if (!Object.keys(s.plan).length) { auto.shift(); return; }
    }
    s.t = Math.min(s.T, s.t + dt);
    let stuck = false;
    for (const ax of Object.keys(s.plan)) {
      const p = s.plan[ax], target = p.from + (p.to - p.from) * alongAt(Math.min(1, s.t / p.T), p.k), cur = S[ax];
      const got = nudge(ax, target - cur);
      if (Math.abs(got - (target - cur)) > 1e-7) stuck = true;
    }
    if (stuck) {
      s.t = Math.max(0, s.t - dt); s.stuck = (s.stuck || 0) + dt;
      // (held up by someone under the load it waits as long as they stay, as the round does; anything else, a while)
      if (!D.notes.some((n) => n.key === 'people') && s.stuck > (s.patience ?? 6)) { D.failed = { ...s, why: D.notes.map((n) => n.text).join(' ') }; auto.length = 0; }
      return;
    }
    s.stuck = 0;
    if (s.t >= s.T) { for (const ax of Object.keys(s.plan)) { const c = cfg(); c[ax] = s.plan[ax].to; if (!blocked(c)) S[ax] = s.plan[ax].to; } auto.shift(); }
  }

  // ── the way back up, for the round to take over ────────────────────────────────────────────────────────────────
  function resetTrail() { trail.length = 0; trail.push(cfg()); }
  function record() {
    const c = cfg(), l = trail[trail.length - 1];
    if (!l || Math.abs(c.x - l.x) + Math.abs(c.z - l.z) + Math.abs(c.hoist - l.hoist) + Math.abs(c.yaw - l.yaw) > 0.05) trail.push(c);
    if (Math.abs(S.hoist - site.carry) < 1e-3 && trail.length > 1) resetTrail();
    if (trail.length > 4000) trail.splice(1, 1000);
  }
  // does a straight run of the parts from configuration c0 to `to` stay clear? -> where it ends, or null
  function clearRun(c0, to) {
    const c = { ...c0 }, from = { ...c0 }, n = Math.max(1, Math.ceil(Math.max(...Object.keys(to).map((ax) => Math.abs(to[ax] - from[ax]) / (ax === 'yaw' ? 0.03 : DRIVE.step)))));
    for (let i = 1; i <= n; i++) {
      for (const ax of Object.keys(to)) c[ax] = from[ax] + (to[ax] - from[ax]) * i / n;
      if (blocked(c, held >= 0, held >= 0 ? (S.cans[held].rel || 0) : 0, to.hoist != null && to.hoist < from.hoist)) return null;
    }
    return c;
  }
  // a way up: straight up; back out from a wall first; else back the way it came
  function wayUp() {
    let c0 = cfg();
    const out = [];
    // (a canister in a socket's mouth is drawn back out to where it waited, end on, first)
    const L = held >= 0 ? lineup(S, true, 0.05) : null;
    if (L && L.kind === 'socket' && L.ax - half < clear + 0.1) {
      const W = waitAt(L.i), to = { x: W[0], z: W[2] }, c1 = clearRun(c0, to);
      if (c1) { out.push({ to, v: { x: sp.push.v, z: sp.push.v } }); c0 = c1; }
    }
    const tries = [[{ hoist: site.carry }]];
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) tries.push([{ x: c0.x + dx * 0.9, z: c0.z + dz * 0.9 }, { hoist: site.carry }]);
    for (const t of tries) {
      let c = { ...c0 }, ok = true;
      for (const to of t) { c = clearRun(c, to); if (!c) { ok = false; break; } }
      if (ok) return [...out, ...t.map((to) => ({ to }))];
    }
    // (back the way it came: the trail undone, last first)
    const back = [];
    for (let i = trail.length - 1; i >= 0; i--) { const p = trail[i]; back.push({ to: { x: p.x, z: p.z, hoist: p.hoist, yaw: p.yaw } }); }
    D.wentBack = true;
    return [...out, ...back, { to: { hoist: site.carry } }];
  }
  function leave() {
    if (leaving) return D;
    stop(); leaving = true; upPlanned = false;
    // (a canister resting where it may be left is let go of; a shut grab with nothing in it opens)
    if (held >= 0 && resting()) go([{ grab: 'open' }]);
    else if (held < 0 && (S.arms > 1e-3 || S.latch > 1e-3) && !(action && action.kind === 'shut')) go([{ grab: 'open' }]);
    return D;
  }
  // once the grab is settled: up, then the trays home and the irises shut: then it is left
  function settle() {
    if (held < 0 && S.arms > 1e-3 && !upPlanned) { go([{ grab: 'open' }]); return; }
    if (!upPlanned) { upPlanned = true; go(wayUp()); return; }
    const parts = M.every((_, i) => S.tray[i] < 1e-9) && K.every((_, k) => Math.abs(S.iris[k] - want.iris[k]) < 1e-9 && Math.abs(S.lit[k] - want.lit[k]) < 1e-9);
    if (Math.abs(S.hoist - site.carry) < 1e-6 && parts) { S.hoist = site.carry; left = true; }
  }

  // ── the readouts (the chair's screens, the crane game) ──────────────────────────────────────────────────────────
  function read() {
    const tonnes = held >= 0 ? Math.round((DRIVE.canister + oreOf(held) * S.cans[held].fill) * 10) / 10 : 0;
    return { x: S.x, z: S.z, hook: S.hoist, yaw: S.yaw, at: hookAt(S), held, tonnes, place: D.place,
      resting: !!resting(), seated: !!seatedOn(), shut: S.arms > 0.999, open: S.arms < 1e-3, aids: D.aid || { x: 'off', y: 'off', h: 'off' } };
  }

  Object.assign(D, { step, go, stop, leave, read, lineup, resting, seatedOn, blocked, under, underside, middleOf, outPos, dockAt, waitAt, wayUp, cfg, hookAt, axOf, latOf, startGrab });
  resetTrail();
  return D;
}
