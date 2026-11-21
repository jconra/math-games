// HIS FORKLIFT'S ROUND IN CARGO, AS PLAIN NUMBERS (kit/places-plan.js CARGO has the game's maker's words: "Now and then
// one of Cargo's people drives it to carry a pallet: from the loading floor by the containers to the shelves, then
// parks it again."). No three.js: the tests read this, and the game drives the forklift along the very ways it gives
// (src/cargoforklift.js).
//
// THE TRUCK in metres, in its own frame (TRUCK): x forward, toward its forks; z to its right; 0 at the middle of its
// foot, where it stands. A pose is { x, z, h }: its foot's middle in the station, and its turn h about straight up (as
// three.js turns it: h = 0, its forks to the east; its forks then point along (cos h, -sin h)).
//
// THE WAYS are worked out for the middle of its front axle, the point a forklift turns about (it steers by its back
// wheels): straight runs joined by arcs TURN.r metres round, forward or backing. A ROUND, parked to parked (round()):
//   out     forward out of its place, east, north up the floor past the lift's west side, west along the lane south of
//           the last racks, then north up to the pallet waiting
//   in      on, slowly, the forks low, in under the pallet; then the forks up a hand's width, the pallet on them
//   back    backing out south, its back end swinging west, till it faces east
//   over    east along the lane, north up to its place on the shelf; in, slowly; the forks down: the pallet on the floor
//           of the rack. ON THE FIRST SHELF (CARGO.up: the game's maker, FORK2-1, B): stopped close to the rack, the
//           forks up till the pallet's foot is a little over the shelf's beam (the forks' frame rising past the top of
//           the mast, as in the picture he saw); in, slowly; the forks down till the pallet stands on the shelf and the
//           forks are free of it; backing straight out, slowly, from under it; the forks down
//   home    backing out south, its back end swinging east, till it faces west; west along the lane, south past the
//           lift, round to face east just past its place, and backing into its place
// (and THE OTHER WAY, round(a shelf place, a waiting place): a pallet from the shelf back to the loading floor, the same
// runs and turns the other way about, a pallet on the first shelf taken down the same way it was set there;
// src/cargoforklift.js drives one only when the loading floor has no pallet to carry or the shelf no place free, and no
// pallet could arrive back there unseen)
// clearOf(round) measures every pose of it against the room: the tests ask that it never comes near the racks, the
// containers, the benches, the desk, the scale, the lift, the walls or the other pallets.
import { FORKLIFT, forkliftScale, STORE, RACKS, FLOOR, SLOT, STOPS, LIFT, PALLET, CARGO, baysOf, palletBox } from './places-plan.js';

const k = forkliftScale();
const [RAW_L, , RAW_W] = FORKLIFT.raw, [, , FZ0, FZ1] = FORKLIFT.forks, [[AX, AY, AR], [BX, BY, BR]] = FORKLIFT.axles;
export const TRUCK = {
  rear: -RAW_L / 2 * k, tips: RAW_L / 2 * k, half: RAW_W / 2 * k, face: FORKLIFT.face * k, forkHalf: Math.max(-FZ0, FZ1) * k,
  front: { x: AX * k, y: AY * k, r: AR * k }, back: { x: BX * k, y: BY * k, r: BR * k }, wheelZ: FORKLIFT.wheelZ * k,
  seat: { x: FORKLIFT.seat[0] * k, y: FORKLIFT.seat[1] * k }, nose: FORKLIFT.nose * k,
};
TRUCK.base = TRUCK.front.x - TRUCK.back.x;            // (between its axles)
// a pallet on its forks: its back edge this far in front of the carriage's face; its middle along the truck
export const ON_FORKS = { gap: 0.02 };
ON_FORKS.x = TRUCK.face + ON_FORKS.gap + PALLET.long / 2;
// THE FORKS' HEIGHTS, over where they rest in his file (m): low to go in under a pallet (the forks' blades then sit
// between the floor and the pallet's deck), up a hand's width to carry one (its load's top then clears the shelf's
// first beam, at 1.25 m, by a few centimetres), and where they rest; the speeds they go up and down at (m/s)
export const FORKS = { low: -0.03, carry: 0.1, rest: 0, up: 0.22, down: 0.26 };
// how high a pallet's foot is over the floor when the forks are at `lift` (its deck lies on the forks' blades: their
// top, in his file, FORKLIFT.blade), standing on `on` (the floor, or the first shelf) when the forks are lower
export const palletFoot = (lift, on = 0) => Math.max(on, FORKLIFT.blade * k + lift - PALLET.deck);
// AT THE FIRST SHELF (CARGO.upY over the floor): low, the blades between the shelf's deck and the pallet's, as low is
// on the floor (where it sets a pallet down there, and goes in under one to take it up); over, the pallet's foot this
// little over the shelf's beam as it goes in or comes out (the tallest load's top then under the second shelf's beam)
FORKS.upLow = CARGO.upY + FORKS.low;
FORKS.over = CARGO.upY + 0.02 - (FORKLIFT.blade * k - PALLET.deck);
// THE TURNS and the lanes: how far round (m, the front axle's middle); the lane east to west south of the last racks
// (z); the way north and south past the lift's west side (x); how far short of a pallet it stops before going in
// slowly (m), and of a place on the first shelf, where it lifts (m: further, so a pallet carried low then stops a
// quarter of a metre short of one on the floor level under that place); a little past its place before it backs in (m)
export const TURN = { r: 1.5, lane: 23.6, west: 9.4, short: 1.2, shortUp: 1.45, past: 0.35 };
const shortOf = (Q) => (Q.up ? TURN.shortUp : TURN.short);
// HOW IT DRIVES (m/s; m/s each second): carefully, a forklift in a room with people
export const DRIVE = { fast: 1.0, turn: 0.6, back: 0.55, slow: 0.3, speedUp: 0.45, slowDown: 0.6, pause: 0.6 };

// ── poses and the truck's outline ─────────────────────────────────────────────────────────────────────────────────
const fwd = (h) => [Math.cos(h), -Math.sin(h)], right = (h) => [Math.sin(h), Math.cos(h)];
// the front axle's middle of a pose, and back
export const axleOf = (p) => { const [fx, fz] = fwd(p.h); return [p.x + fx * TRUCK.front.x, p.z + fz * TRUCK.front.x]; };
export const poseAt = (ax, az, h) => { const [fx, fz] = fwd(h); return { x: ax - fx * TRUCK.front.x, z: az - fz * TRUCK.front.x, h }; };
// where it stands to set a pallet down (or take one up) whose middle is at [x, z], facing h
export const poseFor = ([x, z], h) => { const [fx, fz] = fwd(h); return { x: x - fx * ON_FORKS.x, z: z - fz * ON_FORKS.x, h }; };
// its outline at a pose, as boxes in its own frame turned into the station: its body (to its nose: all of it but the
// carriage), its carriage (from there to the carriage's face: low with its forks, or up at the first shelf: `up`), its
// forks (low on the floor, or up with the carriage), and the pallet on them if it has one. Each { what, c: [x, z] its
// middle, f, r (its two ways), hx, hz (half its length and width), up }
export function outline(p, carrying = false, up = false) {
  const f = fwd(p.h), r = right(p.h);
  const box = (what, x0, x1, hw) => { const m = (x0 + x1) / 2; return { what, c: [p.x + f[0] * m, p.z + f[1] * m], f, r, hx: (x1 - x0) / 2, hz: hw, up: what !== 'body' && up }; };
  const out = [box('body', TRUCK.rear, TRUCK.nose, TRUCK.half), box('carriage', TRUCK.nose, TRUCK.face, TRUCK.half)];
  if (carrying) out.push(box('pallet', ON_FORKS.x - PALLET.long / 2, ON_FORKS.x + PALLET.long / 2, PALLET.wide / 2));
  else out.push(box('forks', TRUCK.face, TRUCK.tips, TRUCK.forkHalf));
  return out;
}
// the gap between a box of the outline and a box of the room [x0, x1, z0, z1] (m; below 0: they overlap). Measured on
// the four ways that can part them: never more than the true gap, so "at least this far" is safe
export function gapTo(o, [x0, x1, z0, z1]) {
  const bx = (x0 + x1) / 2, bz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2, dx = o.c[0] - bx, dz = o.c[1] - bz;
  const ex = Math.abs(o.f[0]) * o.hx + Math.abs(o.r[0]) * o.hz, ez = Math.abs(o.f[1]) * o.hx + Math.abs(o.r[1]) * o.hz;
  let g = Math.max(Math.abs(dx) - hx - ex, Math.abs(dz) - hz - ez);
  for (const [ax, az, h] of [[o.f[0], o.f[1], o.hx], [o.r[0], o.r[1], o.hz]]) {
    const d = Math.abs(dx * ax + dz * az), e = hx * Math.abs(ax) + hz * Math.abs(az);
    g = Math.max(g, d - h - e);
  }
  return g;
}
// how far a point is outside a box of the outline (m; below 0: inside)
export function pointGap(o, x, z) {
  const dx = x - o.c[0], dz = z - o.c[1], u = Math.abs(dx * o.f[0] + dz * o.f[1]) - o.hx, v = Math.abs(dx * o.r[0] + dz * o.r[1]) - o.hz;
  return u > 0 && v > 0 ? Math.hypot(u, v) : Math.max(u, v);
}

// ── the ways: straight runs joined by arcs ──────────────────────────────────────────────────────────────────────────
// a run of corners [[x, z], ...] for the front axle's middle, each corner rounded to an arc of radius r; driven
// forward (dir 1) or backing (dir -1). -> pieces: { kind: 'line', a, b } | { kind: 'arc', c, r, a0, a1 } (angles from
// the arc's middle, in the station's x-z plane)
export function rounded(pts, r = TURN.r) {
  const out = []; let from = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i - 1], n = pts[i + 1];
    let ux = p[0] - q[0], uz = p[1] - q[1]; const lu = Math.hypot(ux, uz); ux /= lu; uz /= lu;
    let vx = n[0] - p[0], vz = n[1] - p[1]; const lv = Math.hypot(vx, vz); vx /= lv; vz /= lv;
    const cos = Math.max(-1, Math.min(1, ux * vx + uz * vz)), th = Math.acos(cos);
    if (th < 1e-6) continue;
    const t = r * Math.tan(th / 2), t1 = [p[0] - ux * t, p[1] - uz * t], t2 = [p[0] + vx * t, p[1] + vz * t];
    // (the arc's middle: from the first tangent point, toward the side the run turns to)
    let nx = vx - cos * ux, nz = vz - cos * uz; const ln = Math.hypot(nx, nz); nx /= ln; nz /= ln;
    const c = [t1[0] + nx * r, t1[1] + nz * r];
    out.push({ kind: 'line', a: from, b: t1 });
    out.push({ kind: 'arc', c, r, a0: Math.atan2(t1[1] - c[1], t1[0] - c[0]), a1: Math.atan2(t2[1] - c[1], t2[0] - c[0]) });
    from = t2;
  }
  out.push({ kind: 'line', a: from, b: pts[pts.length - 1] });
  return out.filter((s) => s.kind === 'arc' || Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > 1e-6);
}
// the poses along a way, every `ds` metres: { x, z, h (as a pose), ax, az (the front axle's middle), s (metres along),
// turn (1/m: plus when the middle of the turn is on the truck's left), arc (on an arc) }
export function walk(pieces, dir = 1, ds = 0.05) {
  const out = []; let s = 0;
  const push = (ax, az, tx, tz, turn, arc) => {
    const fx = dir > 0 ? tx : -tx, fz = dir > 0 ? tz : -tz, h = Math.atan2(-fz, fx);
    out.push({ ...poseAt(ax, az, h), ax, az, s, turn, arc });
  };
  for (const p of pieces) {
    if (p.kind === 'line') {
      const L = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]), tx = (p.b[0] - p.a[0]) / L, tz = (p.b[1] - p.a[1]) / L, n = Math.max(1, Math.ceil(L / ds));
      for (let i = out.length ? 1 : 0; i <= n; i++) { push(p.a[0] + tx * L * i / n, p.a[1] + tz * L * i / n, tx, tz, 0, false); if (i) s += L / n; out[out.length - 1].s = s; }
    } else {
      let da = p.a1 - p.a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const L = Math.abs(da) * p.r, n = Math.max(2, Math.ceil(L / ds)), sg = Math.sign(da);
      for (let i = 1; i <= n; i++) {
        const a = p.a0 + da * i / n, ax = p.c[0] + Math.cos(a) * p.r, az = p.c[1] + Math.sin(a) * p.r;
        // (going round: the way along is across the line from the middle; which side the middle lies on, for the truck)
        const tx = -Math.sin(a) * sg, tz = Math.cos(a) * sg;
        s += L / n; push(ax, az, tx, tz, 0, true);
        const q = out[out.length - 1], [rx, rz] = right(q.h), side = (p.c[0] - ax) * rx + (p.c[1] - az) * rz;
        q.turn = (side < 0 ? 1 : -1) / p.r; q.s = s;
      }
    }
  }
  return out;
}

// ── a round ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const NORTH = Math.PI / 2, EAST = 0;
// where it parks (FORKLIFT.at, facing FORKLIFT.yaw), and the front axle's middle there
export const PARKED = { x: FORKLIFT.at[0], z: FORKLIFT.at[1], h: FORKLIFT.yaw };
// the places its pallets stand: 'w<n>' waiting on the loading floor, 's<n>' on the racks' floor level, 'u<n>' on the
// first shelf; each { id, at: [x, z], y (how high its foot stands), h (the way the forklift faces to take it up or set
// it down), shelf, up (on the first shelf) }
export const PLACES = [
  ...CARGO.waiting.map((at, i) => ({ id: 'w' + i, at, y: 0, h: NORTH, shelf: false, up: false })),
  ...CARGO.shelf.map((at, i) => ({ id: 's' + i, at, y: 0, h: NORTH, shelf: true, up: false })),
  ...CARGO.up.map((at, i) => ({ id: 'u' + i, at, y: CARGO.upY, h: NORTH, shelf: true, up: true })),
];
export const placeById = (id) => PLACES.find((q) => q.id === id) || null;
// THE ROUND from a pallet waiting at `from` to the place on the shelf `to` (two places): its legs in turn, each
//   { kind: 'drive', dir, way: [poses], speed, carrying, forks, up }   (forks: where the forks are as it goes; up: at
//                                                                       the first shelf's height all the way)
//   { kind: 'forks', to, take | leave: place id }                      (the forks to a height: taking a pallet up or
//                                                                       setting it down, or on their own)
export function round(fromId, toId) {
  const A = placeById(fromId), B = placeById(toId); if (!A || !B || A.shelf === B.shelf) return null;
  const [ax] = A.at, [bx] = B.at, r = TURN.r, lane = TURN.lane, west = TURN.west;
  const P0 = axleOf(PARKED), pick = axleOf(poseFor(A.at, A.h)), drop = axleOf(poseFor(B.at, B.h));
  const legs = [];
  const drive = (dir, pts, speed, carrying, forks, up = false) => legs.push({ kind: 'drive', dir, way: walk(rounded(pts, r), dir), speed, carrying, forks, up });
  const forks = (to, more = {}) => legs.push({ kind: 'forks', to, ...more });
  // TAKING UP the pallet at place Q (the front axle at q there), from short of it: on the floor, slowly in, the forks
  // low under it, and up a hand's width; on the first shelf, the forks up to the shelf first, slowly in under it, up
  // till it is a little over the shelf's beam, slowly straight back out with it, and down to carry it. -> where the
  // forklift is then
  const take = (Q, q) => {
    const short = [q[0], q[1] + shortOf(Q)];
    if (!Q.up) { drive(1, [short, q], DRIVE.slow, false, FORKS.low); forks(FORKS.carry, { take: Q.id }); return q; }
    forks(FORKS.upLow);
    drive(1, [short, q], DRIVE.slow, false, FORKS.upLow, true);
    forks(FORKS.over, { take: Q.id });
    drive(-1, [q, short], DRIVE.slow, true, FORKS.over, true);
    forks(FORKS.carry);
    return short;
  };
  // SETTING DOWN at place Q, from short of it: on the floor, slowly in, the forks down; on the first shelf, close to
  // the rack the forks up till the pallet is a little over the shelf's beam, slowly in, down till it stands on the
  // shelf and the forks are free of it, slowly straight back out from under it, the forks down. -> where it is then
  const leave = (Q, q) => {
    const short = [q[0], q[1] + shortOf(Q)];
    if (!Q.up) { drive(1, [short, q], DRIVE.slow, true, FORKS.carry); forks(FORKS.low, { leave: Q.id }); return q; }
    forks(FORKS.over);
    drive(1, [short, q], DRIVE.slow, true, FORKS.over, true);
    forks(FORKS.upLow, { leave: Q.id });
    drive(-1, [q, short], DRIVE.slow, false, FORKS.upLow, true);
    forks(FORKS.low);
    return short;
  };
  const done = (more = {}) => ({ from: A.id, to: B.id, ...more, legs, length: legs.reduce((n, L) => n + (L.way ? L.way[L.way.length - 1].s : 0), 0) });
  if (A.shelf) {
    // THE OTHER WAY, from the shelf back to the loading floor (src/cargoforklift.js: only when nothing has arrived
    // back on the loading floor and the shelf has no place free): out and east along the lane, north to the rack, in
    // under the pallet and up; backing out, its back end swinging east; west along the lane, north to its place
    // waiting, down; backing out, its back end swinging west; east, south past the lift, and backing into its place
    drive(1, [P0, [west, P0[1]], [west, lane], [ax, lane], [ax, pick[1] + shortOf(A)]], DRIVE.fast, false, FORKS.rest);
    const a = take(A, pick);
    drive(-1, [a, [ax, lane], [ax + r + 0.01, lane]], DRIVE.back, true, FORKS.carry);
    drive(1, [[ax + r + 0.01, lane], [bx, lane], [bx, drop[1] + shortOf(B)]], DRIVE.fast, true, FORKS.carry);
    const b = leave(B, drop);
    drive(-1, [b, [bx, lane], [bx - r - 0.01, lane]], DRIVE.back, false, FORKS.low);
    drive(1, [[bx - r - 0.01, lane], [west, lane], [west, P0[1]], [west + r + TURN.past, P0[1]]], DRIVE.fast, false, FORKS.rest);
    drive(-1, [[west + r + TURN.past, P0[1]], P0], DRIVE.back, false, FORKS.rest);
    return done({ back: true });
  }
  // out: east out of its place, north past the lift's west side, west along the lane, north to the pallet
  drive(1, [P0, [west, P0[1]], [west, lane], [ax, lane], [ax, pick[1] + shortOf(A)]], DRIVE.fast, false, FORKS.rest);
  const a = take(A, pick);
  // back: backing south, its back end swinging west (so it faces east), then east along the lane and north to its place
  drive(-1, [a, [ax, lane], [ax - r - 0.01, lane]], DRIVE.back, true, FORKS.carry);
  drive(1, [[ax - r - 0.01, lane], [bx, lane], [bx, drop[1] + shortOf(B)]], DRIVE.fast, true, FORKS.carry);
  const b = leave(B, drop);
  // home: backing south, its back end swinging east (so it faces west), west along the lane, south past the lift, round
  // to face east a little past its place, and backing in
  drive(-1, [b, [bx, lane], [bx + r + 0.01, lane]], DRIVE.back, false, FORKS.low);
  drive(1, [[bx + r + 0.01, lane], [west, lane], [west, P0[1]], [west + r + TURN.past, P0[1]]], DRIVE.fast, false, FORKS.rest);
  drive(-1, [[west + r + TURN.past, P0[1]], P0], DRIVE.back, false, FORKS.rest);
  return done();
}

// ── what it must keep clear of ─────────────────────────────────────────────────────────────────────────────────────
const S = STOPS.find((s) => s.id === 'store');
// the room's fixed things, [x0, x1, z0, z1] (a rack to its face: its posts' foot guards, a little proud of it, are in
// lowBlocks)
export function roomBlocks() {
  const out = [];
  RACKS.z.forEach((z, i) => out.push({ what: 'rack ' + (i + 1), rack: i, box: [RACKS.x0[i] - 0.08, RACKS.x0[i] + baysOf(i) * RACKS.bay + 0.08, z - RACKS.deep / 2, z + RACKS.deep / 2] }));
  out.push({ what: 'the packing benches', box: FLOOR.benches.slice() }, { what: 'the shipping desk', box: FLOOR.desk.slice() }, { what: 'the scale', box: FLOOR.scale.slice() });
  SLOT.full.forEach((n) => out.push({ what: 'container 0' + (n + 1), box: [STORE.x0, SLOT.end, SLOT.z[n] - SLOT.box[0] / 2, SLOT.z[n] + SLOT.box[0] / 2] }));
  const o = LIFT.half + LIFT.wall + 0.08;
  out.push({ what: 'the lift', box: [S.at[0] - o, S.at[0] + o, S.at[2] - o, S.at[2] + o] });
  return out;
}
// how far a point is inside the room's walls (their lines; the panels and the ribs stand up to 0.4 m in from them)
export function wallGap(x, z) {
  const [[ax, az], [bx, bz]] = STORE.cut;
  const cut = -((bx - ax) * (z - az) - (bz - az) * (x - ax)) / Math.hypot(bx - ax, bz - az);
  return Math.min(x - STORE.x0, STORE.x1 - x, z - STORE.z0, STORE.z1 - z, cut);
}
// LOW DOWN IN THE RACKS, where its forks and a pallet on them go (under the first shelf's beam): each frame of posts
// (a bay's two posts and the bracing between them, their foot guards a little proud), and the room's own pallets on
// the racks' floor level (every place there but the forklift's own, CARGO.shelf, as kit/rooms/station.json has them:
// skids along the row, two to a bay)
export function lowBlocks() {
  const out = [];
  RACKS.z.forEach((z, i) => {
    const x0 = RACKS.x0[i], n = baysOf(i);
    for (let b = 0; b <= n; b++) { const px = x0 + b * RACKS.bay; out.push({ what: 'rack ' + (i + 1) + '\'s posts', post: true, box: [px - 0.08, px + 0.08, z - RACKS.deep / 2 - 0.08, z + RACKS.deep / 2 + 0.08] }); }
    for (let b = 0; b < n; b++) for (const o of [0.7, 2.02]) {
      const x = x0 + b * RACKS.bay + o; if (CARGO.shelf.some(([sx, sz]) => Math.abs(sx - x) < 0.3 && Math.abs(sz - z) < RACKS.deep)) continue;
      out.push({ what: 'rack ' + (i + 1) + '\'s pallets', box: [x - PALLET.long / 2, x + PALLET.long / 2, z - PALLET.wide / 2, z + PALLET.wide / 2] });
    }
  });
  return out;
}
// UP AT THE FIRST SHELF, where its carriage, its forks and a pallet on them go to set one there or take one down: the
// same frames of posts, and the room's own pallets on the first shelf (every place there but the forklift's own,
// CARGO.up: as on the floor level, skids along the row, two to a bay)
export function shelfBlocks() {
  const out = lowBlocks().filter((b) => b.post);
  RACKS.z.forEach((z, i) => {
    for (let b = 0; b < baysOf(i); b++) for (const o of [0.7, 2.02]) {
      const x = RACKS.x0[i] + b * RACKS.bay + o; if (CARGO.up.some(([sx, sz]) => Math.abs(sx - x) < 0.3 && Math.abs(sz - z) < RACKS.deep)) continue;
      out.push({ what: 'rack ' + (i + 1) + '\'s pallets on its first shelf', box: [x - PALLET.long / 2, x + PALLET.long / 2, z - PALLET.wide / 2, z + PALLET.wide / 2] });
    }
  });
  return out;
}
const corners = (o) => [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [o.c[0] + o.f[0] * o.hx * a + o.r[0] * o.hz * b, o.c[1] + o.f[1] * o.hx * a + o.r[1] * o.hz * b]);
// EVERY POSE OF A ROUND MEASURED against the room: for each thing, the nearest it comes (m) and where ({ gap, at, leg }).
// Its body and its carriage are kept off the racks altogether; its forks and the pallet they carry, low down, off the
// racks' posts and the pallets on their floor level, and up at the first shelf (`up` legs), off the posts and the
// pallets on the first shelf (the carriage, the forks and a pallet on them pass over the floor level's pallets there,
// and low down under the first shelf's; the rest of it, its body and its mast, reaches the height of both). The
// forklift's own pallets stand where they are at that moment (`at`: place id -> true where a pallet stands at the
// round's start; left out: every place full but the one it sets this one down in). Going in under the pallet it takes
// up, and backing out from under the one it has set down, only its forks are under that pallet (its body never comes
// to it).
export function clearOf(R, at = null) {
  const here = new Set(at ? Object.keys(at).filter((id) => at[id]) : PLACES.map((q) => q.id).filter((id) => id !== R.to));
  const near = {}, note = (what, g, p, leg) => { if (!near[what] || g < near[what].gap) near[what] = { gap: +g.toFixed(3), at: [+p.x.toFixed(2), +p.z.toFixed(2), +p.h.toFixed(2)], leg }; };
  const blocks = roomBlocks(), low = lowBlocks(), high = shelfBlocks();
  R.legs.forEach((L, li) => {
    if (L.take) here.delete(L.take);
    if (L.leave) here.add(L.leave);
    if (!L.way) return;
    // (the forks under a pallet: going in under the one it takes up, backing out from under the one it set down; and
    // the place it works at on this leg, going in to it or backing out from it)
    const under = R.legs[li + 1]?.take || R.legs[li - 1]?.leave || null;
    const work = placeById([R.legs[li + 1], R.legs[li - 1]].map((x) => x && (x.take || x.leave)).find(Boolean) || '');
    for (const p of L.way) {
      for (const o of outline(p, L.carrying, L.up)) {
        const body = o.what === 'body' || o.what === 'carriage';
        for (const b of blocks) if (body || b.rack == null) note(b.what, gapTo(o, b.box), p, li);
        for (const b of o.up ? high : low) if (!body || b.post) note(b.what, gapTo(o, b.box), p, li);
        for (const id of here) {
          const q = placeById(id);
          if (o.what !== 'body' && q.up !== o.up) continue;
          const g = gapTo(o, palletBox(q.at));
          // (the pallet it is taking up or has just set down: its carriage comes up to it, its face a hand short; the
          // one over or under that place: its body's nose, the mast's foot and top, as near as the carriage's face)
          if (id === under) { if (body) note('the pallet it takes or leaves', g - ON_FORKS.gap, p, li); }
          else if (work && q !== work && q.at[0] === work.at[0] && q.at[1] === work.at[1]) note('the pallet over or under the one it takes or leaves', g, p, li);
          else note('the pallet at ' + id, g, p, li);
        }
        for (const [x, z] of corners(o)) note('the walls', wallGap(x, z), p, li);
      }
    }
  });
  return near;
}
// how near a round comes to a person standing at [x, z] (m, from the outline's edge to their middle)
export function nearestTo(R, [x, z]) {
  let best = Infinity;
  for (const L of R.legs) if (L.way) for (const p of L.way) for (const o of outline(p, L.carrying)) best = Math.min(best, pointGap(o, x, z));
  return best;
}
