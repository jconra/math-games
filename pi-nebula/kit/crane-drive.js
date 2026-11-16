// THE CRANE BY HAND: the smelter's ceiling crane worked live, instead of from the round's timetable. Two things work it
// this way, and nothing else: FREE CONTROL at the operator's chair (src/cranedrive.js: a stick and buttons, no credits)
// and the CRANE OPERATOR JOB (src/jobs/crane.js: each right answer is a move, done here by the autopilot below). The
// game's maker, 2026-11-16: "It might be a good idea to let people free move the crane, or even pick up canisters and
// load them. But if they want to make credits then math will be involved."
//
// The same crane as the round's, at the round's speeds (crane-plan.js SPEED), eased in and out, and the same rules:
//   - ALONG THE RAIL ONLY. The trolley runs along the wall's leg or the ship's leg; it changes legs only on the
//     turntable, which turns it (and its load) a quarter turn; it crosses the turntable straight only with the
//     turntable's rail lying along its way. The carriage runs along the trolley's beam, the hoist up and down.
//   - NOTHING THROUGH ANYTHING. Every little move, points all over the cradle, its arms, its cables and the canister it
//     holds are looked up in what stands still (world.solid: the hangar's walls, the ship, the rack, the sockets'
//     collars, the floor) and against every other canister, a tray that is out and a shut iris. A move that would go
//     into any of them does not happen. A canister goes into a socket's collar only lined up with it, end on, through
//     its open iris, slowly (the round's push speed), and no deeper than seated.
//   - NOBODY UNDER A LOAD. While anyone stands under the load (or within DRIVE.margin of it), it will not come down,
//     and a low load will not be moved over them; a tray will not slide out over them.
//   - IT LETS GO ONLY WHERE A CANISTER CAN REST: seated in a socket with the collar's latch dogs shut on it, on a
//     ship's tray that is out, in a bay of the rack. Anywhere else the grab stays shut, and says why.
//   - LINING UP. Within DRIVE.capture of a place (a socket, a bay, a tray), coming down to it, the crane lines itself
//     up on it, as a good operator's last nudges would: so a stick on a phone is enough to dock a canister.
//   - BY ITSELF, AS IN THE ROUND: a mount's tray comes out when the cradle comes for its canister (or brings one) and
//     goes home when the cradle has gone up; a socket's iris opens for a canister lined up in front of it and shuts
//     when it goes; the collar's dogs shut on a seated canister and let go when the cradle takes it; a docked
//     canister with ore in it drains as the round's do.
//   - LETTING GO OF THE CONTROLS: leave() lets go of a canister that is resting, opens an empty grab, then works out
//     a way up out of wherever the crane is (straight up, the carriage home first, out from the wall first, or back
//     the way it came), and once the trays are home it is `left`: D.state is then a snapshot the round takes up again
//     from (crane-plan.js planFrom).
//
//   const D = makeDrive(site, state, world, opts)
//     site      kit/crane.js's site, with site.rail (the legs' ends, the rail's height) and site.dims (the parts' sizes)
//     state     a snapshot (crane-plan.js stateAt), changed in place from now on (kit/crane.js poses it)
//     world     { solid(x, y, z): true inside what stands still, eyes: [{ x, y, z }] where people's feet are }
//     opts      { speed (SPEED), ore(c): tonnes of ore a full canister c holds }
//   D.step(dt, cmd)     cmd = { move: [x, z] (a push in the station's plane, length up to 1), hoist: -1..1 (up +),
//                       grab: 'shut' | 'open', turn: true (turn on the turntable) }. Ignored while the autopilot has
//                       steps. D.notes: what it would not do just now and why ([{ key, text }])
//   D.go(steps)         the autopilot: [{ axis: 'along' | 'slide' | 'hoist', to, v }, { turn: true }, { grab },
//                       { wait: seconds }] one after another (D.busy while it has some; D.stop() drops them;
//                       D.failed says which could not be done and why)
//   D.read()            the readouts: { leg, mark (metres along the leg from its start), across, hook (the hoist's
//                       height), held, tonnes, place (what it is lined up with), ... }
//   D.leave() / D.left  the way up (as autopilot steps), and whether it is done
import { SPEED, moveTime, along as alongAt } from './crane-plan.js';

export const DRIVE = {
  capture: 0.32,        // metres across: how near a place the crane lines itself up on it as it comes down to it
  guide: 1.4,           // metres: how far above a place that lining up starts
  snap: 0.004,          // metres: lined up, seated, at a height, when this near
  pull: 3.2,            // how quickly it lines itself up (a share of what is left, each second)
  margin: 0.9,          // metres round a load in which a person counts as under it (the round's: src/crane.js RULES)
  head: 2.4,            // people this high over the floor (the catwalk) are not under it
  low: 4.6,             // a load whose underside is lower than this (metres) is not moved over anyone
  rated: 3,             // tonnes: what the crane may lift (the plate on its beam)
  canister: 0.4,        // tonnes: an empty canister
  turnNear: 1.6,        // metres from the turntable at which turning is offered
  step: 0.025,          // metres: the most any part moves between two looks for what is in the way
  settle: 0.9,          // metres: coming to rest within this of a place, it settles onto it
  brake: { along: 2.4, slide: 1.6, hoist: 2.2 },   // metres a second, each second: slowing down when let go of
  clearHeld: 1.25,      // metres over a mount's canister (its middle) the hook must be for a tray to move under a load,
  clearEmpty: 0.65,     // ... and under the open cradle
};
const TAU = Math.PI * 2;
const near0 = (a) => { a = ((a % TAU) + TAU) % TAU; return a > Math.PI ? a - TAU : a; };
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const approach = (v, to, dv) => (v < to ? Math.min(to, v + dv) : Math.max(to, v - dv));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

export function makeDrive(site, state, world = {}, opts = {}) {
  const S = state, sp = opts.speed || SPEED, d = site.dims, R = d.R, half = site.can.half, lift = site.can.lift || 0;
  const M = site.mounts, K = site.sockets, B = site.bays, G = d.grip, A = d.arc, armR = A.r + A.tube;
  const seat = site.can.seat, clear = site.can.clear;
  const oreOf = opts.ore || (() => 1.2);
  let held = S.cans.findIndex((q) => q.where === 'held');
  const vel = { along: 0, slide: 0, hoist: 0 };
  let action = null;            // a timed action under way: a turn, the grab shutting or opening, the dogs letting go
  const auto = [];              // the autopilot's steps
  let leaving = false, left = false, upPlanned = false;
  const want = { iris: K.map((_, k) => S.iris[k]), lit: K.map((_, k) => S.lit[k]) };
  const trail = [];             // where it has been since it was last up and home, for the way back if all else fails
  const D = { state: S, notes: [], place: null, failed: null, pulling: false,
    get held() { return held; }, get busy() { return auto.length > 0 || !!action; }, get moving() { return auto.length > 0 || !!action || Math.abs(vel.along) + Math.abs(vel.slide) + Math.abs(vel.hoist) > 1e-3; }, get left() { return left; }, get leaving() { return leaving; }, get action() { return action && action.kind; }, get steps() { return auto.length; } };
  const note = (key, text) => { if (!D.notes.some((n) => n.key === key)) D.notes.push({ key, text }); };

  // ── the rail ────────────────────────────────────────────────────────────────────────────────────────────────────
  const legOf = (yaw) => (Math.abs(Math.sin(yaw)) > 0.5 ? 'ship' : 'wall');
  const leg = () => legOf(S.yaw);
  const turnAlong = (lg) => (lg === 'wall' ? site.turn[0] : site.turn[1]);
  // (the trolley's middle keeps half its body from a buffer; the ship's leg starts at the turntable)
  const range = (lg) => (lg === 'wall' ? [site.rail.wall[0] + d.body, site.rail.wall[1] - d.body] : [site.turn[1], site.rail.ship[1] - d.body]);
  const alongOf = (c = S) => (legOf(c.yaw) === 'wall' ? c.x : c.z);
  const onTurntable = () => Math.abs(S.x - site.turn[0]) < 1e-3 && Math.abs(S.z - site.turn[1]) < 1e-3;
  const hookAt = (c) => [c.x + Math.sin(c.yaw) * c.slide, c.hoist, c.z + Math.cos(c.yaw) * c.slide];
  // (a move of the hook across the station's plane, as the rail's part of it and the beam's part)
  const railPart = (c, dx, dz) => (legOf(c.yaw) === 'wall' ? dx : dz);
  const beamPart = (c, dx, dz) => dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw);

  // ── the places a canister can rest, and where a canister is ───────────────────────────────────────────────────
  const outPos = (i) => [M[i].at[0] + M[i].out[0], M[i].at[1] + lift, M[i].at[2] + M[i].out[1]];
  const sockPos = (k, ax) => [K[k].at[0] + K[k].n[0] * ax, K[k].at[1], K[k].at[2] + K[k].n[1] * ax];
  const dockAt = (k) => sockPos(k, half - seat), waitAt = (k) => sockPos(k, half + clear);
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
  // the one over a lower mount or socket (the same place, the row above)
  const pairOf = (list, i, up) => list.findIndex((q, j) => j !== i && !!q.upper === up && Math.abs(q.at[0] - list[i].at[0]) < 0.1 && Math.abs(q.at[2] - list[i].at[2]) < 0.1);
  const mOver = M.map((m, i) => (m.upper ? -1 : pairOf(M, i, true)));

  // ── what the crane is lined up with (or nearly) ───────────────────────────────────────────────────────────────
  // -> { kind: 'socket' | 'bay' | 'mount', i, at: [x, y, z] where the hook goes (the canister's middle at rest; for a
  //    held canister at a socket, the point on the socket's middle line across from the hook), c: the canister there
  //    (-1: none), d: how far off across (metres), dy: how far above it the hook is }. Carrying: places that can take a
  //    canister; empty: places with one to take
  function lineup(c = S, carrying = held >= 0, reach = DRIVE.capture) {
    const [hx, hy, hz] = hookAt(c), lg = legOf(c.yaw);
    let best = null;
    const offer = (L) => { if (!best || L.d < best.d) best = L; };
    if (lg === 'wall') {
      K.forEach((s, k) => {
        const there = whoAt('socket', k);
        if (carrying ? there >= 0 : there < 0) return;
        if (carrying) {
          // (anywhere from seated to a little way out in front of its mouth, across and in height)
          const ax = axOf(k, hx, hz), side = latOf(k, hx, hz);
          // (of two sockets one over the other, the one nearer the load's height)
          if (ax > half - seat - 0.05 && ax < half + clear + 0.9 && side < reach) offer({ kind: 'socket', i: k, at: sockPos(k, Math.min(ax, half + clear)), c: -1, d: side + 0.1 * Math.abs(hy - s.at[1]), dy: hy - s.at[1], ax, seat: dockAt(k), wait: waitAt(k) });
        } else {
          const D0 = dockAt(k), dd = Math.hypot(hx - D0[0], hz - D0[2]);
          if (dd < reach) offer({ kind: 'socket', i: k, at: D0, c: there, d: dd, dy: hy - D0[1] });
        }
      });
      B.forEach((b, j) => {
        const there = whoAt('bay', j); if (carrying ? there >= 0 : there < 0) return;
        const dd = Math.hypot(hx - b.at[0], hz - b.at[2]); if (dd < reach) offer({ kind: 'bay', i: j, at: b.at, c: there, d: dd, dy: hy - b.at[1] });
      });
    } else {
      M.forEach((m, i) => {
        const there = whoAt('mount', i); if (carrying ? there >= 0 : there < 0) return;
        if (mOver[i] >= 0 && whoAt('mount', mOver[i]) >= 0) return;   // (under a canister: out of reach)
        // (two free mounts one over the other: the one whose tray is out, else the lower, as the round loads them)
        const o = outPos(i), dd = Math.hypot(hx - o[0], hz - o[2]); if (dd < reach) offer({ kind: 'mount', i, at: o, c: there, d: dd + (S.tray[i] > 0.01 ? 0 : 1e-3) + (m.upper ? 5e-4 : 0), dy: hy - o[1] });
      });
    }
    return best;
  }
  const tight = DRIVE.snap * 3;
  // is the held canister resting where it may be let go? (seated in a socket with the dogs shut, on a tray that is
  // out, in a bay) -> the place, or null
  function resting() {
    if (held < 0) return null;
    const L = lineup(S, true, tight);
    if (!L || Math.abs(L.dy) > tight) return null;
    if (L.kind === 'socket') return Math.abs(L.ax - (half - seat)) < tight && S.lit[L.i] > 0.999 ? L : null;
    if (L.kind === 'mount') return S.tray[L.i] > 0.999 ? L : null;
    return L;
  }
  // is the empty cradle seated on a canister it can take? -> the place, or null
  function seatedOn() {
    if (held >= 0) return null;
    const L = lineup(S, false, tight);
    if (!L || Math.abs(L.dy) > tight) return null;
    if (L.kind === 'mount' && S.tray[L.i] < 0.999) return null;
    return L;
  }
  // the lowest the hook may come where it is lined up (on a canister's crown, or a canister set down at rest; coming
  // down over a ship's tray that is not out yet, high enough for it to come out under the cradle) -> a height, or null
  function floorAt(L, carrying, down = false) {
    if (!L || L.kind === 'socket') return null;
    if (L.kind === 'mount' && S.tray[L.i] < 0.999) return down ? M[L.i].at[1] + lift + (carrying ? DRIVE.clearHeld : DRIVE.clearEmpty) : null;
    if (!carrying && L.c < 0) return null;
    return L.at[1];
  }

  // ── the shapes: points over the cradle, its arms, its cables and a held canister, in their own frames ──────────
  const CAN = [], FRAME = [], ARC = [];
  for (let k = 0; k <= 8; k++) { const z = -(half - 0.16) + 2 * (half - 0.16) * k / 8; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; CAN.push([Math.cos(a) * (R + 0.02), Math.sin(a) * (R + 0.02), z]); } }
  for (const z of [-half, half]) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; CAN.push([Math.cos(a) * 0.3, Math.sin(a) * 0.3, z]); }
  for (const x of [-G.w, 0, G.w]) for (const y of [G.under, G.top + 0.04]) for (const z of [-G.half, -G.half / 2, 0, G.half / 2, G.half]) FRAME.push([x, y, z]);
  for (let i = 0; i <= 8; i++) { const a = -A.half + 2 * A.half * i / 8; ARC.push([Math.sin(a) * armR, Math.cos(a) * armR]); }
  // every point of the crane's moving parts below the trolley, in the station's frame, for a configuration
  // c = { x, z, yaw, slide, hoist, arms }: fn(x, y, z, part) (part: 'can', 'frame', 'arm', 'cable'), stopping early on true
  function eachPoint(c, carrying, rel, fn) {
    const [hx, hy, hz] = hookAt(c), cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    const W = (lx, ly, lz, part) => fn(hx + lx * cy + lz * sy, hy + ly, hz - lx * sy + lz * cy, part);
    for (const p of FRAME) if (W(p[0], p[1], p[2], 'frame')) return true;
    const t = smooth(c.arms);
    for (const a of d.arms) {
      const th = -a.way * A.shut * t, ct = Math.cos(th), st = Math.sin(th);
      for (const [x0, y0] of ARC) if (W(x0 * ct - y0 * st, x0 * st + y0 * ct, a.z, 'arm')) return true;
    }
    // (the four cables, from the cradle's frame up to the carriage)
    const top = site.rail.y + d.cableTop - hy;
    for (const [kx, kz] of [[-d.cable.x, -d.cable.z], [d.cable.x, -d.cable.z], [-d.cable.x, d.cable.z], [d.cable.x, d.cable.z]]) for (const f of [0.15, 0.5, 0.85]) if (W(kx, G.top + (top - G.top) * f, kz, 'cable')) return true;
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
  // c: { x, z, yaw, slide, hoist, arms }. Where it is lined up with a place, what touches by design there is not in
  // the way: the collar round a canister going into it (the canister must then be through an open iris, and no
  // deeper than seated), the canister the cradle comes down onto (only to its crown), what a canister is set down on.
  function blocked(c, carrying = held >= 0, rel = carrying ? S.cans[held].rel : 0, down = false) {
    const L = lineup(c, carrying, 0.03);
    const [hx, , hz] = hookAt(c);
    const target = !carrying && L && L.c >= 0 ? L.c : -1;
    const fl = floorAt(L, carrying, down);
    if (fl != null && c.hoist < fl - 1e-4) return { what: L.kind === 'mount' && S.tray[L.i] < 0.999 ? 'trayIn' : carrying ? (L.kind === 'bay' ? 'rack' : 'tray') : 'canister' };
    // (a socket lined up with: its collar is where the canister and the cradle's near arms go)
    const inSock = L && L.kind === 'socket' && (!carrying || Math.abs(L.dy) < 0.03) ? L.i : -1;
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
  function under(c, carrying = held >= 0) {
    const eyes = world.eyes || []; if (!eyes.length) return null;
    const [hx, , hz] = hookAt(c), yaw = carrying ? c.yaw + S.cans[held].rel : c.yaw, ex = carrying ? half : G.half;
    for (const e of eyes) {
      if (e.y > DRIVE.head) continue;
      const dx = e.x - hx, dz = e.z - hz, ax = Math.abs(dx * Math.sin(yaw) + dz * Math.cos(yaw)), ac = Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw));
      if (ax < ex + DRIVE.margin && ac < armR + DRIVE.margin) return e;
    }
    return null;
  }
  const underside = (c, carrying = held >= 0) => c.hoist - (carrying ? R + 0.1 : -0.17);

  // ── moving one part, a little at a time, stopping at whatever is in the way ───────────────────────────────────
  const cfg = () => ({ x: S.x, z: S.z, yaw: S.yaw, slide: S.slide, hoist: S.hoist, arms: S.arms });
  const hitWords = (h) => (h.what === 'canister' ? 'Another canister is in the way.' : h.what === 'iris' ? 'The socket\'s iris is still shut.' : h.what === 'floor' ? 'That is the floor.'
    : h.what === 'tray' ? 'It is down on the tray.' : h.what === 'trayIn' ? 'Waiting for the ship\'s tray to come out.' : h.what === 'rack' ? 'It is down on the rack.' : h.what === 'seated' ? 'It is all the way in.'
      : h.part === 'cable' ? 'The cables would touch something.' : 'Something is in the way.');
  // try to move `axis` by dv (metres); -> how far it got
  function nudge(axis, dv) {
    if (Math.abs(dv) < 1e-9) return 0;
    const n = Math.max(1, Math.ceil(Math.abs(dv) / DRIVE.step)), each = dv / n;
    let got = 0;
    for (let s = 0; s < n; s++) {
      const c = cfg();
      if (axis === 'along') { if (leg() === 'wall') c.x += each; else c.z += each; } else c[axis] += each;
      // the rail's ends, the beam's reach, the hoist's top
      if (axis === 'along') {
        const [lo, hi] = range(leg()), p = alongOf(c);
        if (p < lo - 1e-9 || p > hi + 1e-9) { note('end', leg() === 'wall' ? 'That is the end of the rail.' : p < lo ? 'That is the turntable: turn there to go along the wall.' : 'That is the end of the ship\'s rail.'); break; }
        // (over the turntable only with its rail lying the trolley's way)
        if (leg() === 'wall' && (S.x - site.turn[0]) * (c.x - site.turn[0]) < 0 && Math.abs(Math.sin(S.disc)) > 1e-6) { note('turntable', 'The turntable lies across the rail.'); break; }
      }
      if (axis === 'slide' && Math.abs(c.slide) > d.reach + 1e-9) { note('reach', 'The carriage is at the end of its beam.'); break; }
      if (axis === 'hoist' && c.hoist > site.carry + 1e-9) break;
      // people: nothing comes down over anyone, and a low load is not moved over them
      if (axis === 'hoist' && each < 0 && under(c)) { note('people', 'Someone is under the load: it will not come down.'); break; }
      if (axis !== 'hoist' && underside(c) < DRIVE.low && under(c) && !under(cfg())) { note('people', 'Someone is under there: a load this low will not go over them.'); break; }
      const hit = blocked(c, held >= 0, held >= 0 ? S.cans[held].rel : 0, axis === 'hoist' && each < 0);
      if (hit) { note('hit:' + hit.what, hitWords(hit)); break; }
      if (axis === 'along') { if (leg() === 'wall') S.x = c.x; else S.z = c.z; } else S[axis] = c[axis];
      got += each;
    }
    return got;
  }

  // ── the timed things: a turn on the turntable, the grab shutting or opening, trays, irises, collars, draining ──
  function startTurn() {
    if (!onTurntable()) { note('turn', 'Turning happens on the turntable.'); return false; }
    if (Math.abs(S.slide) > 1e-3 || S.hoist < site.carry - 1e-3) { note('turn', 'Raise the load and bring the carriage home first.'); return false; }
    const by = leg() === 'wall' ? Math.PI / 2 : -Math.PI / 2;
    action = { kind: 'turn', t: 0, T: sp.turn, yaw0: S.yaw, disc0: S.disc, by };
    return true;
  }
  function startGrab(how) {
    if (how === 'shut') {
      if (S.arms > 0.999 && S.latch > 0.999) return false;
      action = { kind: 'shut', t: 0, T: sp.latch + sp.arms, on: seatedOn() };
      return true;
    }
    if (S.arms < 1e-3 && S.latch < 1e-3) return false;
    if (held >= 0) {
      const at = resting();
      if (!at) { note('letgo', 'It only lets go where a canister can rest: seated in a socket, on the ship\'s tray, or on the rack.'); return false; }
      // (it rests there from now, in the round's own words for where a canister is)
      const q = S.cans[held], yaw = S.yaw + q.rel;
      q.where = at.kind; q.i = at.i; q.rel = undefined;
      q.yaw = at.kind === 'mount' ? (Math.cos(yaw - M[at.i].yaw) >= 0 ? M[at.i].yaw : near0(M[at.i].yaw + Math.PI)) : near0(yaw);
      held = -1; resetTrail();
    }
    action = { kind: 'open', t: 0, T: sp.arms + sp.latch };
    return true;
  }
  function take(c) { const q = S.cans[c]; q.rel = near0(q.yaw - S.yaw); q.where = 'held'; q.i = undefined; held = c; resetTrail(); }
  function stepAction(dt) {
    if (!action) return;
    action.t += dt;
    const x = Math.min(1, action.t / action.T);
    if (action.kind === 'turn') {
      const e = alongAt(x, 0.35);
      S.yaw = action.yaw0 + action.by * e; S.disc = action.disc0 + action.by * e;
      if (x >= 1) { S.yaw = near0(S.yaw); S.disc = near0(S.disc); action = null; resetTrail(); }
    } else if (action.kind === 'shut') {
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
  function stepParts(dt) {
    const [hx, hy, hz] = hookAt(S), onShip = leg() === 'ship';
    // (the one mount the cradle is over and could use: its tray comes out; one at a time)
    const wanted = onShip ? lineup(S, held >= 0, 1.0) : null;
    M.forEach((m, i) => {
      const o = outPos(i), far = Math.hypot(hx - o[0], hz - o[2]);
      let to = wanted && wanted.kind === 'mount' && wanted.i === i ? 1 : 0;
      // (and it stays out while the cradle is down at it, whatever it holds)
      if (onShip && far < 0.1 && hy < o[1] + 1.2 && S.tray[i] > 0.5) to = 1;
      if (Math.abs(S.tray[i] - to) < 1e-9) return;
      // (it moves only with the cradle and any load clear above it, and never out over someone)
      const clearOf = hy > m.at[1] + lift + (held >= 0 ? DRIVE.clearHeld : DRIVE.clearEmpty) || Math.hypot(hx - (m.at[0] + o[0]) / 2, hz - (m.at[2] + o[2]) / 2) > half + 1.4;
      if (!clearOf) return;
      if (to > S.tray[i] && trayPeople(i)) { note('people', 'Someone is by the ship\'s tray: it stays in.'); return; }
      S.tray[i] = approach(S.tray[i], to, dt / sp.tray);
    });
    const L = held >= 0 ? lineup(S, true, DRIVE.capture) : null;
    K.forEach((s, k) => {
      const there = whoAt('socket', k), releasing = action && action.kind === 'release' && action.k === k;
      let open = there >= 0;
      // (a canister lined up in front of it, or in its mouth)
      if (L && L.kind === 'socket' && L.i === k && (Math.abs(L.dy) < 0.4 || L.ax - half < 0.1)) open = true;
      want.iris[k] = open ? 1 : 0;
      S.iris[k] = approach(S.iris[k], want.iris[k], dt / sp.iris);
      // the dogs: shut on a canister seated in it (held or let go); let go when the cradle takes it, or is drawing a
      // held one back out
      if (releasing) want.lit[k] = 0;
      else if (there >= 0) want.lit[k] = 1;
      else if (L && L.kind === 'socket' && L.i === k) want.lit[k] = Math.abs(L.ax - (half - seat)) < tight && Math.abs(L.dy) < tight && !D.pulling ? 1 : 0;
      else want.lit[k] = 0;
      S.lit[k] = approach(S.lit[k], want.lit[k], dt / sp.clamp);
    });
    S.cans.forEach((q) => { if (q.where === 'socket' && q.fill > 0 && S.lit[q.i] > 0.999) q.fill = Math.max(0, q.fill - dt / sp.drain); });
  }
  function trayPeople(i) {
    const eyes = world.eyes || [], o = outPos(i), m = M[i];
    const cx = (m.at[0] + o[0]) / 2, cz = (m.at[2] + o[2]) / 2, alongX = Math.abs(Math.sin(m.yaw)) > 0.5;
    const ex = alongX ? half + DRIVE.margin : Math.abs(o[0] - m.at[0]) / 2 + R + DRIVE.margin, ez = alongX ? Math.abs(o[2] - m.at[2]) / 2 + R + DRIVE.margin : half + DRIVE.margin;
    return eyes.some((e) => e.y < DRIVE.head && Math.abs(e.x - cx) < ex && Math.abs(e.z - cz) < ez);
  }

  // ── lining up: within reach of a place, coming down to it, the crane nudges itself onto it ────────────────────
  // -> the extra speed for each part this frame { along, slide, hoist } (metres a second)
  function lining(push) {
    const L = lineup(S, held >= 0, DRIVE.capture), out = { along: 0, slide: 0, hoist: 0 };
    D.place = L;
    const [hx, , hz] = hookAt(S), k = DRIVE.pull, still = Math.hypot(push.move[0], push.move[1]) < 0.15;
    // coming to rest near a place (the stick let go, slowing down), it settles onto it, as onto a detent: a canister
    // to take, or a free place for the one it holds (in front of a socket: onto its line along the rail)
    if (still && push.hoist === 0 && Math.abs(vel.along) < 0.9 && Math.abs(vel.slide) < 0.5) {
      const N = lineup(S, held >= 0, DRIVE.settle);
      if (N) {
        const dx = N.at[0] - hx, dz = N.at[2] - hz;
        out.along = clamp(railPart(S, dx, dz) * DRIVE.pull * 0.8, -0.5, 0.5);
        if (!(N.kind === 'socket' && held >= 0)) out.slide = clamp(beamPart(S, dx, dz) * DRIVE.pull * 0.8, -0.35, 0.35);
      }
    }
    if (!L) return out;
    if (L.kind === 'socket' && held >= 0) {
      // in front of a socket: across and in height onto its middle line, so it can be pushed in end on
      if (Math.abs(L.dy) < 0.45 && L.ax > half - seat - 0.05) {
        out.along = clamp(railPart(S, L.at[0] - hx, L.at[2] - hz) * k, -0.3, 0.3);
        if (push.hoist === 0) out.hoist = clamp(-L.dy * k, -0.25, 0.25);
      }
      return out;
    }
    // over a place: as it comes down within DRIVE.guide of it (or rests close over it), onto it
    if (L.dy < DRIVE.guide && (push.hoist < 0 || (still && L.dy < 0.6))) {
      const dx = L.at[0] - hx, dz = L.at[2] - hz;
      out.along = clamp(railPart(S, dx, dz) * k, -0.5, 0.5);
      out.slide = clamp(beamPart(S, dx, dz) * k, -0.35, 0.35);
    }
    return out;
  }

  // ── a frame ───────────────────────────────────────────────────────────────────────────────────────────────────
  function step(dt, cmd = {}) {
    D.notes = [];
    if (!(dt > 0)) return D;
    stepAction(dt);
    if (auto.length && !action) runAuto(dt);
    const quiet = auto.length > 0 || leaving || !!action;
    const push = { move: quiet ? [0, 0] : cmd.move || [0, 0], hoist: quiet ? 0 : cmd.hoist || 0 };
    if (!quiet) {
      if (cmd.grab) startGrab(cmd.grab);
      else if (cmd.turn) {
        // (near the turntable: up, the carriage home, onto it, and round)
        if (Math.abs(alongOf() - turnAlong(leg())) < DRIVE.turnNear) go([{ axis: 'hoist', to: site.carry }, { axis: 'slide', to: 0 }, { axis: 'along', to: turnAlong(leg()) }, { turn: true }]);
        else note('turn', 'Turning happens on the turntable: drive to it first.');
      }
    }
    if (!auto.length && !action && !leaving) manual(dt, push);
    stepParts(dt);
    record();
    if (leaving && !auto.length && !action) settle();
    return D;
  }
  // the stick and the hoist buttons, as speeds for each part (the push across the station's plane split into the
  // rail's way and the beam's way), eased in and out
  function manual(dt, push) {
    const [mx, mz] = push.move;
    const wantAlong = railPart(S, mx, mz) * sp.travel.v;
    let wantSlide = beamPart(S, mx, mz) * sp.slide.v, wantHoist = push.hoist * sp.hoist.v;
    // (at a socket: in its mouth, or about to be, only slowly and only end on; drawn back only once the dogs let go)
    const L = held >= 0 ? lineup(S, true, 0.03) : null;
    D.pulling = false;
    let inMouth = false;
    if (L && L.kind === 'socket') {
      inMouth = L.ax - half < 0.12;
      if (inMouth || Math.abs(L.ax - (half + clear)) < 0.25) wantSlide = clamp(wantSlide, -sp.push.v, sp.push.v);
      const outward = wantSlide * (K[L.i].n[0] * Math.sin(S.yaw) + K[L.i].n[1] * Math.cos(S.yaw)) > 0;
      if (S.lit[L.i] > 1e-3 && outward) { D.pulling = true; wantSlide = 0; note('dogs', 'The collar is letting go of it.'); }
      if (inMouth) wantHoist = 0;
    }
    // (the last of a set-down, slowly)
    const fl = floorAt(lineup(S, held >= 0, 0.03), held >= 0, true);
    if (fl != null && wantHoist < 0 && S.hoist - fl < 0.35) wantHoist = Math.max(wantHoist, -sp.set.v);
    const g = lining(push);
    const tA = clamp(wantAlong + g.along, -sp.travel.v, sp.travel.v), tS = clamp(wantSlide + g.slide, -sp.slide.v, sp.slide.v), tH = clamp(wantHoist + g.hoist, -sp.hoist.v, sp.hoist.v);
    // (speeding up gently, as the round's moves do; braking firmly when the stick is let go or turned back)
    const ease = (v, to, a, brake) => approach(v, to, (to * v < 0 || Math.abs(to) < Math.abs(v) ? brake : a) * dt);
    vel.along = ease(vel.along, inMouth ? 0 : tA, sp.travel.a, DRIVE.brake.along);
    vel.slide = ease(vel.slide, tS, sp.slide.a * 2, DRIVE.brake.slide);
    vel.hoist = ease(vel.hoist, inMouth ? 0 : tH, sp.hoist.a * 2, DRIVE.brake.hoist);
    // (coming to rest near the turntable, it stops on it)
    const off = turnAlong(leg()) - alongOf();
    if (Math.abs(wantAlong) < 0.05 && Math.abs(off) < 0.25 && Math.abs(vel.along) < 0.5) vel.along = clamp(off * 3, -0.4, 0.4);
    for (const ax of ['along', 'slide', 'hoist']) {
      if (Math.abs(vel[ax]) < 1e-6) { vel[ax] = 0; continue; }
      let dv = vel[ax] * dt;
      if (ax === 'hoist' && fl != null && S.hoist + dv < fl) dv = fl - S.hoist;
      if (ax === 'hoist' && S.hoist + dv > site.carry) dv = site.carry - S.hoist;
      const got = nudge(ax, dv);
      if (Math.abs(got - dv) > 1e-9) vel[ax] = 0;
    }
    // (onto what it is lined up with, once within a hair of it; onto the turntable likewise)
    const P = lineup(S, held >= 0, DRIVE.snap);
    if (P && P.kind !== 'socket') { const [hx, , hz] = hookAt(S), dx = P.at[0] - hx, dz = P.at[2] - hz; if (leg() === 'wall') S.x += dx; else S.z += dz; S.slide += beamPart(S, dx, dz); }
    if (P && P.kind === 'socket') { const [hx, , hz] = hookAt(S); if (leg() === 'wall') S.x += railPart(S, P.at[0] - hx, P.at[2] - hz); }
    if (fl != null && Math.abs(S.hoist - fl) < DRIVE.snap) S.hoist = fl;
    if (leg() === 'wall' && Math.abs(S.x - site.turn[0]) < 2e-4) S.x = site.turn[0];
    if (leg() === 'ship' && Math.abs(S.z - site.turn[1]) < 2e-4) S.z = site.turn[1];
  }

  // ── the autopilot ─────────────────────────────────────────────────────────────────────────────────────────────
  function go(steps) { for (const s of steps) auto.push({ ...s }); vel.along = vel.slide = vel.hoist = 0; D.failed = null; return D; }
  function stop() { auto.length = 0; vel.along = vel.slide = vel.hoist = 0; return D; }
  function runAuto(dt) {
    const s = auto[0];
    if (s.wait != null) { s.t = (s.t || 0) + dt; if (s.t >= s.wait) auto.shift(); return; }
    if (s.turn) { if (!s.started) { s.started = true; if (!startTurn()) { D.failed = { ...s, why: D.notes.map((n) => n.text).join(' ') }; auto.length = 0; } } else if (!action) auto.shift(); return; }
    if (s.grab) {
      if (!s.started) {
        s.started = true;
        const already = s.grab === 'open' ? S.arms < 1e-3 && S.latch < 1e-3 : S.arms > 0.999 && S.latch > 0.999;
        if (!startGrab(s.grab) && !already) { D.failed = { ...s, why: D.notes.map((n) => n.text).join(' ') }; auto.length = 0; }
      } else if (!action) auto.shift();
      return;
    }
    if (s.until) { if (s.until(D)) auto.shift(); return; }
    // a part to a value: planned as the round plans a move (its speed, speeding up and slowing down), and followed
    // as far as nothing is in the way (and where something is, it waits there: people walk on)
    const cur = s.axis === 'along' ? alongOf() : S[s.axis];
    if (s.from == null) {
      const kin = s.axis === 'along' ? sp.travel : s.axis === 'slide' ? sp.slide : sp.hoist;
      const v = s.v || kin.v, a = s.v ? Math.min(kin.a, Math.max(0.2, s.v * 0.9)) : kin.a;
      if (Math.abs(s.to - cur) < 1e-6) { auto.shift(); return; }
      s.from = cur; [s.T, s.k] = moveTime(Math.abs(s.to - cur), { v, a }); s.t = 0;
    }
    s.t = Math.min(s.T, s.t + dt);
    const target = s.from + (s.to - s.from) * alongAt(s.t / s.T, s.k), got = nudge(s.axis, target - cur);
    if (Math.abs(got - (target - cur)) > 1e-7) {
      s.t = Math.max(0, s.t - dt); s.stuck = (s.stuck || 0) + dt;
      // (held up by someone under the load it waits as long as they stay, as the round does; anything else, a while)
      if (!D.notes.some((n) => n.key === 'people') && s.stuck > (s.patience ?? 6)) { D.failed = { ...s, why: D.notes.map((n) => n.text).join(' ') }; auto.length = 0; }
      return;
    }
    s.stuck = 0;
    if (s.t >= s.T) { if (s.axis === 'along') { if (leg() === 'wall') S.x = s.to; else S.z = s.to; } else S[s.axis] = s.to; auto.shift(); }
  }

  // ── the way back up, for the round to take over ────────────────────────────────────────────────────────────────
  function resetTrail() { trail.length = 0; trail.push(cfg()); }
  function record() {
    const c = cfg(), l = trail[trail.length - 1];
    if (!l || Math.abs(c.x - l.x) + Math.abs(c.z - l.z) + Math.abs(c.slide - l.slide) + Math.abs(c.hoist - l.hoist) > 0.05) trail.push(c);
    if (Math.abs(S.hoist - site.carry) < 1e-3 && Math.abs(S.slide) < 1e-3 && trail.length > 1) resetTrail();
    if (trail.length > 4000) trail.splice(1, 1000);
  }
  // does a straight run of one part from configuration c0 to `to` stay clear? -> where it ends, or null
  function clearRun(c0, axis, to) {
    const c = { ...c0 }, from = axis === 'along' ? alongOf(c) : c[axis], n = Math.max(1, Math.ceil(Math.abs(to - from) / DRIVE.step));
    for (let i = 1; i <= n; i++) {
      const v = from + (to - from) * i / n;
      if (axis === 'along') { if (legOf(c.yaw) === 'wall') c.x = v; else c.z = v; } else c[axis] = v;
      if (blocked(c, held >= 0, held >= 0 ? S.cans[held].rel : 0, axis === 'hoist' && to < from)) return null;
    }
    return c;
  }
  // a way up: a few plain ones tried in turn (straight up, then the carriage home; the carriage home first; out from
  // the wall first), else back the way it came
  function wayUp() {
    let c0 = cfg();
    const out = [];
    // (a canister in a socket's mouth is drawn back out to where it waited, end on, first)
    const L = held >= 0 ? lineup(S, true, 0.03) : null;
    if (L && L.kind === 'socket' && L.ax - half < 0.12) {
      const to = S.slide + (half + clear - L.ax) * (K[L.i].n[0] * Math.sin(S.yaw) + K[L.i].n[1] * Math.cos(S.yaw)), c1 = clearRun(c0, 'slide', to);
      if (c1) { out.push({ axis: 'slide', to, v: sp.push.v }); c0 = c1; }
    }
    const tries = [[['hoist', site.carry], ['slide', 0]], [['slide', 0], ['hoist', site.carry]]];
    for (const dv of [0.5, -0.5, 1, -1]) tries.push([['slide', c0.slide + dv], ['hoist', site.carry], ['slide', 0]]);
    for (const t of tries) {
      let c = { ...c0 }, ok = true;
      for (const [ax, to] of t) { if (ax === 'slide' && Math.abs(to) > d.reach) { ok = false; break; } c = clearRun(c, ax, to); if (!c) { ok = false; break; } }
      if (ok) return [...out, ...t.map(([axis, to]) => ({ axis, to }))];
    }
    // (back the way it came: the trail undone, last first)
    const back = [];
    for (let i = trail.length - 1; i >= 0; i--) { const p = trail[i]; back.push({ axis: 'hoist', to: p.hoist }, { axis: 'slide', to: p.slide }, { axis: 'along', to: alongOf(p) }); }
    D.wentBack = true;
    return [...out, ...back, { axis: 'hoist', to: site.carry }, { axis: 'slide', to: 0 }];
  }
  function leave() {
    if (leaving) return D;
    stop(); leaving = true; upPlanned = false;
    // (a canister resting where it may be left is let go of; a shut grab with nothing in it opens)
    if (held >= 0 && resting()) go([{ grab: 'open' }]);
    else if (held < 0 && (S.arms > 1e-3 || S.latch > 1e-3) && !(action && action.kind === 'shut')) go([{ grab: 'open' }]);
    return D;
  }
  // once the grab is settled: up and the carriage home, then the trays home and the irises shut: then it is left
  function settle() {
    if (held < 0 && S.arms > 1e-3 && !upPlanned) { go([{ grab: 'open' }]); return; }
    if (!upPlanned) { upPlanned = true; go(wayUp()); return; }
    const parts = M.every((_, i) => S.tray[i] < 1e-9) && K.every((_, k) => Math.abs(S.iris[k] - want.iris[k]) < 1e-9 && Math.abs(S.lit[k] - want.lit[k]) < 1e-9);
    if (Math.abs(S.hoist - site.carry) < 1e-6 && Math.abs(S.slide) < 1e-6 && parts) { S.hoist = site.carry; S.slide = 0; left = true; }
  }

  // ── the readouts (the chair's screens, the crane operator job) ────────────────────────────────────────────────
  function read() {
    const lg = leg(), [hx, hy, hz] = hookAt(S);
    const tonnes = held >= 0 ? Math.round((DRIVE.canister + oreOf(held) * S.cans[held].fill) * 10) / 10 : 0;
    return { leg: lg, mark: lg === 'wall' ? S.x - site.rail.wall[0] : S.z - site.turn[1], across: S.slide, hook: hy, at: [hx, hy, hz], held, tonnes, place: D.place,
      onTurntable: onTurntable(), nearTurn: Math.abs(alongOf() - turnAlong(lg)) < DRIVE.turnNear, resting: !!resting(), seated: !!seatedOn(), shut: S.arms > 0.999, open: S.arms < 1e-3 };
  }

  Object.assign(D, { step, go, stop, leave, read, lineup, resting, seatedOn, blocked, under, middleOf, outPos, dockAt, waitAt, legOf, wayUp, cfg, hookAt, axOf, latOf, range });
  resetTrail();
  return D;
}
