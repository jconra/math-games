// A WAY FOR THE FORKLIFT FROM WHERE IT STANDS TO A PLACE, AS PLAIN NUMBERS (no three.js: the tests read this, and the
// game drives the forklift by it when Cargo's loader loads the rest of a supply run: kit/forkliftloader.js). The game's
// maker, 2026-11-23 (CARGO1-1, B): "Cargo's loader walks over, gets on the forklift and drives the rest into the
// containers while you watch". The player may have left it anywhere, turned any way, a pallet on its forks or not, so
// its way is worked out afresh from there each time, round whatever stands in the room just then.
//
// THE WAY is for the middle of its front axle, the point a forklift turns about (as the rounds' ways are:
// kit/forkliftround.js), in legs of one direction each, forward or backing. Across open floor it is ONE SWEEP, as a
// driver takes it: a turn, a straight run, a turn (each turn WAY.r round), taken whenever the floor between is clear
// and it is no long way round. Where a sweep will not do (the place is behind it, something stands between, it has to
// back out first) it is found by trying short moves outward from where it stands, each straight or a turn, forward or
// backing, the cheapest first (backing costs more than driving forward, a change of direction more still), steered
// toward the place by a map of how far round the room's things it is from every patch of floor, until a sweep from
// there does. Every pose of it is looked at against the room (clear(pose): kit/forkliftdrive.js clearance, kept
// WAY.margin off everything). THE LAST STRETCH is straight: to a pallet's end, a container's doorway or its own bay it
// comes squarely, from `in` metres back along the line it stands on there (forward, or backing for its bay).
//
//   planWay(from, to, clear, opts)   -> { legs: [{ dir (1 forward, -1 backing), pts: [[ax, az, s, h, curv]...] }],
//                                       length, cusps (changes of direction), tried } or null (no way found). from, to:
//                                       poses { x, z, h }; to.in: the last stretch (m; below 0: backing in);
//                                       clear(pose) -> true where it may stand; opts.loose(pose): the same, only asking
//                                       that it is into nothing (for its first moves out of a tight place)
//   makePlan(from, to, clear, opts)  the same a little at a time: .step(ms) -> true once done; .way (null: none, .why)
//   makeFollower(way)                F.cmd(s) -> { go, turn, done, off }: the stick and the wheel that keep a drive
//                                    (kit/forkliftdrive.js makeDrive: D.s) on the way, as a careful driver does: slower
//                                    round the turns, stopped to change direction
//   clearOf(world, s, margin)        -> clear(pose) for a drive's state (what is on its forks) in a world (worldOf)
//   sweep(...), sweepPoints(...)     a turn, a straight run, a turn between two poses; roundMap(world, point): how far
//                                    round the room's things every patch of floor is from a point
import { TRUCK, axleOf, poseAt, wallGap } from './forkliftround.js';
import { STORE } from './places-plan.js';
import { HAND, clearance } from './forkliftdrive.js';

// r: the turns it is worked out with (m round the front axle's middle: a little wider than its tightest, HAND.turn, so
// the hand has some wheel left to keep it on the way); step: each move tried (m); cell, turn: two poses this near each
// other (m, radians) count as one; margin: kept this clear of everything (m); body: on the map of the floor, its middle
// is this far from everything (m); back: what a metre backing costs, in metres forward; cusp: what a change of
// direction costs (m); wheel: a change of the wheel (m); bend: a metre round a turn, in metres straight; keen: how much
// it favours moves toward the place over the surest shortest way (1: the shortest; more: found sooner);
// goal: a way with no sweep at its end comes to the last stretch within this (m along it, m to its side, radians);
// most: moves tried before giving up; round: a sweep to the place is taken if it is no more than this many times as far
// as the straightest way there (and a metre and a half); backMost: a sweep backing all the way only this short (m);
// lag: the hand turns the wheel for where the way turns this long ahead (s); pull: how hard it turns back toward the way
// (radians a metre off it); swing: how hard it turns to face as the way does (1/m a radian); speed: how fast it is
// driven (m/s: forward, backing), slow: round a turn, and creep: while the wheel is still coming round; off: this far
// off the way (m) it is worked out again
export const WAY = { r: 1.8, step: 0.35, cell: 0.25, turn: Math.PI / 12, margin: 0.15, body: 0.6, back: 2.5, cusp: 1.5, wheel: 0.7, bend: 1.15, keen: 1.7,
  goal: { along: 0.35, side: 0.15, h: 0.2 }, most: 60000, round: 1.45, backMost: 4.5, lag: 0.3, pull: 1.2, swing: 2.2, speed: [1.1, 0.7], slow: 0.65, creep: 0.25, off: 0.6 };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const fwd = (h) => [Math.cos(h), -Math.sin(h)];

export function clearOf(world, s = {}, margin = WAY.margin) {
  const st = { carry: s.carry ?? null, under: null };
  const clear = (p) => clearance(p, st, world).gap >= margin;
  clear.world = world;
  return clear;
}
// HOW FAR ROUND: from every patch of open floor to a point, walking round what stands in the room (a map of the floor
// in half-metre squares, a square open where the forklift's middle could be: WAY.body from every block, pallet and
// wall; the distances spread out from the point). The search uses it to tell which moves lead toward the place, so a
// way round the racks, the benches or the row of pallets is found without trying the whole room first.
const GRID = 0.5;
export function roundMap(world, [gx, gz]) {
  const boxes = [...world.blocks.filter((b) => !b.body).map((b) => b.o), ...world.pallets.map((p) => p.o)].filter((o) => Math.abs(o.f[0]) > 0.99 || Math.abs(o.f[1]) > 0.99)
    .map((o) => { const hx = Math.abs(o.f[0]) > 0.5 ? o.hx : o.hz, hz = Math.abs(o.f[0]) > 0.5 ? o.hz : o.hx; return [o.c[0] - hx, o.c[0] + hx, o.c[1] - hz, o.c[1] + hz]; });
  const x0 = STORE.x0, z0 = STORE.z0, nx = Math.ceil((STORE.x1 - x0) / GRID), nz = Math.ceil((STORE.z1 - z0) / GRID);
  const open = new Uint8Array(nx * nz), dist = new Float32Array(nx * nz).fill(Infinity);
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    const x = x0 + (i + 0.5) * GRID, z = z0 + (k + 0.5) * GRID;
    if (wallGap(x, z) < HAND.wall + WAY.body) continue;
    let ok = true;
    for (const [a, b, c, d] of boxes) { const dx = Math.max(a - x, 0, x - b), dz = Math.max(c - z, 0, z - d); if (dx * dx + dz * dz < WAY.body * WAY.body) { ok = false; break; } }
    if (ok) open[i * nz + k] = 1;
  }
  // (spread out from the point's own square, and its neighbours: the point itself is often right by a pallet or a doorway)
  const gi = Math.floor((gx - x0) / GRID), gk = Math.floor((gz - z0) / GRID), q = [];
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const i = gi + a, k = gk + b; if (i < 0 || k < 0 || i >= nx || k >= nz) continue; const d = Math.hypot(x0 + (i + 0.5) * GRID - gx, z0 + (k + 0.5) * GRID - gz); dist[i * nz + k] = d; q.push([d, i, k]); }
  q.sort((a, b) => a[0] - b[0]);
  // (the squares in the order they are reached: a plain queue kept sorted in buckets of a quarter metre)
  const B = []; const put = (d, i, k) => { const n = Math.floor(d * 4); (B[n] || (B[n] = [])).push([d, i, k]); };
  for (const e of q) put(...e);
  for (let n = 0; n < B.length; n++) {
    const L = B[n]; if (!L) continue;
    for (let m = 0; m < L.length; m++) {
      const [d, i, k] = L[m]; if (d > dist[i * nz + k] + 1e-6) continue;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        if (!a && !b) continue; const i2 = i + a, k2 = k + b; if (i2 < 0 || k2 < 0 || i2 >= nx || k2 >= nz || !open[i2 * nz + k2]) continue;
        if (a && b && (!open[i2 * nz + k] || !open[i * nz + k2])) continue;
        const d2 = d + GRID * (a && b ? Math.SQRT2 : 1);
        if (d2 < dist[i2 * nz + k2] - 1e-6) { dist[i2 * nz + k2] = d2; put(d2, i2, k2); }
      }
    }
  }
  return (x, z) => { const i = Math.floor((x - x0) / GRID), k = Math.floor((z - z0) / GRID); return i < 0 || k < 0 || i >= nx || k >= nz ? Infinity : dist[i * nz + k]; };
}

// a small heap of moves, the cheapest on top
function heap() {
  const a = [];
  return {
    get size() { return a.length; },
    push(n) { a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } },
    pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; },
  };
}

// A SWEEP: a turn, a straight run and a turn (each turn r round), from one pose of the front axle to another, driven
// one way: the shortest of the four there are (left or right first, left or right last), as a driver takes a forklift
// across open floor. -> [[k, len], ...] (k: 1 a turn left, -1 right, 0 straight; len: metres), or null
const TAU = Math.PI * 2, mod = (a) => ((a % TAU) + TAU) % TAU;
export function sweep(x0, z0, h0, x1, z1, h1, r) {
  const dx = x1 - x0, dy = -(z1 - z0), d = Math.hypot(dx, dy) / r, phi = Math.atan2(dy, dx), a = mod(h0 - phi), b = mod(h1 - phi);
  const sa = Math.sin(a), sb = Math.sin(b), ca = Math.cos(a), cb = Math.cos(b), cab = Math.cos(a - b);
  let best = null;
  const take = (k1, t, p, k2, q) => { if (!(t >= 0 && p >= 0 && q >= 0)) return; const len = t + p + q; if (!best || len < best.len) best = { len, segs: [[k1, t * r], [0, p * r], [k2, q * r]] }; };
  { const p2 = 2 + d * d - 2 * cab + 2 * d * (sa - sb); if (p2 >= 0) { const t1 = Math.atan2(cb - ca, d + sa - sb); take(1, mod(-a + t1), Math.sqrt(p2), 1, mod(b - t1)); } }
  { const p2 = 2 + d * d - 2 * cab + 2 * d * (sb - sa); if (p2 >= 0) { const t1 = Math.atan2(ca - cb, d - sa + sb); take(-1, mod(a - t1), Math.sqrt(p2), -1, mod(-b + t1)); } }
  { const p2 = -2 + d * d + 2 * cab + 2 * d * (sa + sb); if (p2 >= 0) { const p = Math.sqrt(p2), t2 = Math.atan2(-ca - cb, d + sa + sb) - Math.atan2(-2, p); take(1, mod(-a + t2), p, -1, mod(-mod(b) + t2)); } }
  { const p2 = d * d - 2 + 2 * cab - 2 * d * (sa + sb); if (p2 >= 0) { const p = Math.sqrt(p2), t2 = Math.atan2(ca + cb, d - sa - sb) - Math.atan2(2, p); take(-1, mod(a - t2), p, 1, mod(b - t2)); } }
  return best ? { len: best.len * r, segs: best.segs.filter((g) => g[1] > 1e-6) } : null;
}
// the points of a sweep from a pose, every `ds` metres: [ax, az, h, curv]
export function sweepPoints(x0, z0, h0, segs, r, ds = 0.05) {
  const out = [[x0, z0, h0, segs.length ? segs[0][0] / r : 0]]; let x = x0, z = z0, h = h0;
  for (const [k, len] of segs) {
    const n = Math.max(1, Math.ceil(len / ds)), d = len / n, c = k / r;
    for (let i = 0; i < n; i++) { const hm = h + d * c / 2; x += Math.cos(hm) * d; z -= Math.sin(hm) * d; h += d * c; out.push([x, z, h, c]); }
  }
  return out;
}

// the pose the last stretch begins at: `in` metres back along the line it stands on at `to` (in front of it for a
// stretch backed along)
export function stretchStart(to) {
  const L = to.in || 0, f = fwd(to.h);
  return { x: to.x - f[0] * L, z: to.z - f[1] * L, h: to.h };
}

export function makePlan(from, to, clear, opts = {}) {
  const O = { ...WAY, ...opts }, G = stretchStart(to), [gx, gz] = axleOf(G), gf = fwd(G.h);
  const P = { way: null, done: false, tried: 0, ms: 0 };
  // (the last stretch itself must be clear: else there is no coming to this place this way)
  const L = Math.abs(to.in || 0), sd = Math.sign(to.in || 1);
  let open = true;
  for (let d = 0; d <= L + 1e-6 && open; d += 0.15) { const f = fwd(to.h); if (!clear({ x: G.x + f[0] * d * sd, z: G.z + f[1] * d * sd, h: G.h })) open = false; }
  if (!open || !clear(to)) { P.done = true; P.why = 'the place is not clear'; P.step = () => true; return P; }
  const H = heap(), seen = new Map();
  const key = (ax, az, h) => Math.round(ax / O.cell) * 73856093 ^ Math.round(az / O.cell) * 19349663 ^ Math.round(wrap(h) / O.turn) * 83492791;
  // (how far a pose still has to go, at least: straight to the place, or round the room where the map knows it; and
  // the turning left to do)
  const round = clear.world ? roundMap(clear.world, [gx, gz]) : null;
  const est = (ax, az, h) => { const d = Math.hypot(gx - ax, gz - az), m = round ? round(ax, az) : Infinity; return Math.max(d, m < Infinity ? m - GRID : 0, O.r * Math.abs(wrap(G.h - h)) * 0.9) * O.keen; };
  const [ax0, az0] = axleOf(from);
  H.push({ ax: ax0, az: az0, h: from.h, dir: 0, k: 0, g: 0, f: est(ax0, az0, from.h), up: null });
  const reached = (n) => { const dx = n.ax - gx, dz = n.az - gz, along = dx * gf[0] + dz * gf[1], side = -dx * gf[1] + dz * gf[0]; return Math.abs(along) <= O.goal.along && Math.abs(side) <= O.goal.side && Math.abs(wrap(n.h - G.h)) <= O.goal.h; };
  // (where it stands may already be nearer something than the margin: someone left it against a pallet. Its first
  // metre or so is then looked at by `loose`, which only asks that it goes into nothing, until it is clear)
  const loose = opts.loose || clear, tight = !clear(from);
  let end = null, shot = null;
  P.step = (ms = 2) => {
    if (P.done) return true;
    const t0 = Date.now(); let n = 0;
    while (H.size) {
      if ((++n & 63) === 0 && Date.now() - t0 >= ms) { P.ms += Date.now() - t0; return false; }
      const cur = H.pop(), kc = key(cur.ax, cur.az, cur.h);
      if (seen.has(kc) && seen.get(kc) <= cur.g) continue;
      seen.set(kc, cur.g);
      if (reached(cur)) { end = cur; break; }
      // (ONE SWEEP FROM HERE TO THE PLACE, if the floor between is open and it is no long way round: the rest of the way
      // at once, as a driver sees it; forward, or backing when the place is close behind)
      { const rd = round ? round(cur.ax, cur.az) : Infinity, far = Math.max(Math.hypot(gx - cur.ax, gz - cur.az), rd < Infinity ? rd : 0);
        if (P.tried % 3 === 0 || far < 8) {
          const shots = [[1, sweep(cur.ax, cur.az, cur.h, gx, gz, G.h, O.r)]];
          if (far < O.backMost) shots.push([-1, sweep(gx, gz, G.h, cur.ax, cur.az, cur.h, O.r)]);
          for (const [dir, S] of shots) {
            if (!S || S.len > far * O.round + 1.5 || (dir < 0 && S.len > O.backMost)) continue;
            const pts = dir > 0 ? sweepPoints(cur.ax, cur.az, cur.h, S.segs, O.r) : sweepPoints(gx, gz, G.h, S.segs, O.r).reverse();
            let ok = true; for (let i = 3; i < pts.length && ok; i += 3) if (!clear(poseAt(pts[i][0], pts[i][1], pts[i][2]))) ok = false;
            if (ok) { end = cur; shot = { dir, pts }; break; }
          }
          if (shot) break;
        }
      }
      if (++P.tried > O.most) break;
      for (const dir of [1, -1]) for (const k of [0, 1, -1]) {
        const ds = dir * O.step, curv = k / O.r, hm = cur.h + ds * curv / 2, h1 = cur.h + ds * curv;
        const ax = cur.ax + Math.cos(hm) * ds, az = cur.az - Math.sin(hm) * ds;
        const kk = key(ax, az, h1), g = cur.g + O.step * (dir < 0 ? O.back : 1) * (k ? O.bend : 1) + (cur.dir && dir !== cur.dir ? O.cusp : 0) + (k !== cur.k ? O.wheel : 0);
        if (seen.has(kk) && seen.get(kk) <= g) continue;
        // (the middle of the move and its end, each looked at)
        const hq = cur.h + ds * curv / 4, mid = poseAt(cur.ax + Math.cos(hq) * ds / 2, cur.az - Math.sin(hq) * ds / 2, cur.h + ds * curv / 2), endP = poseAt(ax, az, h1);
        const ok = tight && cur.g < 2.5 ? (p) => clear(p) || loose(p) : clear;
        if (!ok(mid) || !ok(endP)) continue;
        H.push({ ax, az, h: h1, dir, k, g, f: g + est(ax, az, h1), up: cur });
      }
    }
    P.ms += Date.now() - t0; P.done = true;
    if (!end) { P.why = P.tried > O.most ? 'too far to work out' : 'no way'; return true; }
    // THE WAY: the moves back from the end, in legs of one direction, a point every few centimetres (where the front
    // axle's middle is, how far along the leg, the way it faces there and how hard the wheel is turned: [ax, az, s, h,
    // curv]); then the last stretch, straight along the place's own line
    const nodes = []; for (let q = end; q; q = q.up) nodes.push(q); nodes.reverse();
    const legs = []; let leg = null;
    const add = (dir, ax, az, h, curv) => {
      if (!leg || leg.dir !== dir) { leg = { dir, pts: [] }; legs.push(leg); }
      const p = leg.pts[leg.pts.length - 1];
      if (p && Math.hypot(ax - p[0], az - p[1]) < 1e-4) return;
      leg.pts.push([ax, az, p ? p[2] + Math.hypot(ax - p[0], az - p[1]) : 0, h, curv]);
    };
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1], b = nodes[i], ds = b.dir * O.step, curv = b.k / O.r, m = 7;
      if (i === 1 || b.dir !== a.dir) { if (leg && b.dir !== leg.dir) leg = null; add(b.dir, a.ax, a.az, a.h, curv); }
      for (let j = 1; j <= m; j++) { const d = ds * j / m, hm = a.h + d * curv / 2; add(b.dir, a.ax + Math.cos(hm) * d, a.az - Math.sin(hm) * d, a.h + d * curv, curv); }
    }
    // (the sweep that ended it)
    let e = nodes[nodes.length - 1];
    if (shot) { if (leg && leg.dir !== shot.dir) leg = null; for (const q of shot.pts) add(shot.dir, q[0], q[1], q[2], q[3]); e = { ax: gx, az: gz, h: G.h }; }
    if (L > 0) {
      // (from where the search came to the line, on along the line itself to the place)
      const [tx, tz] = axleOf(to), f = fwd(to.h);
      const along = (e.ax - tx) * f[0] + (e.az - tz) * f[1], d = Math.abs(along), m = Math.max(1, Math.ceil(d / 0.05));
      if (leg && leg.dir !== sd) leg = null;
      for (let j = 0; j <= m; j++) { const u = along * (1 - j / m); add(sd, tx + f[0] * u, tz + f[1] * u, to.h, 0); }
    }
    const kept = legs.filter((l) => l.pts.length > 1);
    P.way = { legs: kept, length: kept.reduce((n, l) => n + l.pts[l.pts.length - 1][2], 0), tried: P.tried, cusps: Math.max(0, kept.length - 1) };
    return true;
  };
  return P;
}
export function planWay(from, to, clear, opts) { const P = makePlan(from, to, clear, opts); while (!P.step(50)); return P.way; }

// THE HAND THAT KEEPS IT ON THE WAY: the wheel as the way itself turns a little ahead of where it is (the wheel takes a
// moment to come round), and a little more or less for how far it is off the way to one side and how far it is turned
// from the way; eased off round a turn and toward a leg's end; standing still while the wheel comes round at a change
// of direction; stopped at each leg's end before the next
export function makeFollower(way, opts = {}) {
  const O = { ...WAY, ...opts }, legs = way.legs;
  const F = { i: 0, j: 0, done: !legs.length, off: 0, left: way.length };
  F.dir = () => (legs[Math.min(F.i, legs.length - 1)] || { dir: 1 }).dir;
  F.cmd = (s) => {
    if (F.done) return { go: 0, turn: 0, done: true, off: 0 };
    const leg = legs[F.i], pts = leg.pts, [ax, az] = axleOf(s), last = pts[pts.length - 1];
    // (the point of the way it is nearest: on from the last one, never back, looked for a little way ahead)
    { let best = F.j, bd = Infinity; for (let k = F.j; k < pts.length && pts[k][2] - pts[F.j][2] < 0.8; k++) { const d = Math.hypot(pts[k][0] - ax, pts[k][1] - az); if (d < bd - 1e-9) { bd = d; best = k; } } F.j = best; }
    const p = pts[F.j], rem = last[2] - p[2];
    F.off = Math.hypot(p[0] - ax, p[1] - az); F.left = rem;
    // (the leg's end: stopped there, then the next leg)
    if (rem < 0.03) {
      if (Math.abs(s.v) > 0.06) return { go: 0, turn: 0, done: false, off: F.off };
      F.i++; F.j = 0; if (F.i >= legs.length) { F.done = true; return { go: 0, turn: 0, done: true, off: F.off }; }
      return { go: 0, turn: 0, done: false, off: F.off };
    }
    // the way's own turn a little ahead (as far as it goes while the wheel comes round), and where the way is from here
    let k = F.j; const ahead = 0.08 + Math.abs(s.v) * O.lag; while (k < pts.length - 1 && pts[k][2] - p[2] < ahead) k++;
    const q = pts[k], side = (p[0] - ax) * -Math.sin(s.h) + (p[1] - az) * -Math.cos(s.h);      // (m the way lies to its left)
    const want = wrap(p[3] + leg.dir * Math.atan(O.pull * side) - s.h);
    const curv = Math.max(-1 / HAND.turn, Math.min(1 / HAND.turn, q[4] + leg.dir * O.swing * want));
    const turn = -curv * HAND.turn;
    // how fast: its own careful pace, slower the harder the wheel is turned (now, or a little further on), slowing to a
    // stop at the leg's end; a creep while the wheel is still far from where it is wanted (stood still for it from a stop)
    let k2 = k; while (k2 < pts.length - 1 && pts[k2][2] - p[2] < 0.7) k2++;
    const hard = Math.max(Math.abs(curv), Math.abs(pts[k2][4])) * HAND.turn;
    let v = leg.dir > 0 ? O.speed[0] : O.speed[1];
    v = Math.min(v, O.slow + (v - O.slow) * (1 - Math.min(1, hard)), Math.sqrt(2 * 0.9 * rem) + 0.08);
    const lag = Math.abs(curv - s.curv);
    if (lag > 0.25) v = Math.abs(s.v) < 0.08 && lag > 0.35 ? 0 : Math.min(v, O.creep);
    return { go: leg.dir * v / (leg.dir > 0 ? HAND.fast : HAND.back), turn, done: false, off: F.off };
  };
  return F;
}
export { TRUCK };
