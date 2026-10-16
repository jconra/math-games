// THE TOWER AS DATA: what has been built, and where every board sits in the world. No drawing here and no three.js, so
// node can load it for the tests (rigs) as well as the page.
//
//   tower = { W, D, boards: [board, ...] }
//   board = { id, a: { X, Y, Z }, b: { X, Y, Z }, len, n }
//
// Distances are in FEET (the boards are 8-foot boards and the math talks in feet); the page turns feet into metres only
// when it draws. The tower's middle is at X = Z = 0, the ground at Y = 0; the front wall faces +Z, the right side +X.
// The four footing stones sit at (±W/2, ±D/2): W across the front, D along the sides. The base is the first thing a
// builder settles (drag a stone in or out); it stays with the tower, so every function here reads it from the tower.
//
// a, b: the middles of a board's two ends. n: which way its wide (3½ in) face looks. 'Z': it lies flat in a plane of
// constant Z (parallel to the front and back walls); 'X': flat in a plane of constant X (parallel to the sides). Every
// board lies in such an upright plane, at any offset over the stones: a 6 × 4 base, a 2 × 3 tier on beams above it, a
// 1 × 1 on top. (Only 'X' and 'Z' so far. Code that assumes it says so: PLANES ARE X OR Z, below.)
//
// A board standing straight up is a POST: it lies in both upright planes through its line, so boards in either can be
// nailed to it. It is one 2x4: its n is the plane it was put up in (its wide face looks that way). A post on a stone
// (±W/2, ±D/2) is a corner post.
//
// Planes have keys: 'Z:1.5' is the plane Z = 1.5, 'X:-1' the plane X = -1. On a plane, a point is (u, y): in a Z-plane
// u = X, in an X-plane u = -Z, so seen from the +Z (or +X) side u runs to the right. (A view from the back or the left
// sees u run to its left: the view flips it, never the data.)
import { touchesAny } from './touch.js';

export const START_W = 6;           // a new lab starts with the stones 6 feet apart each way
export const MIN_W = 0.5, MAX_W = 8; // how close and how far apart the stones can be set (either way)
export const BOARD_FT = 8;          // a fresh board from the stack
export const BOARDS = 28;           // full boards in a fresh stack (every board on the tower comes out of it: a 16 ft
                                    // tower braced corner to corner on a 6 ft base takes 24, so a few to spare)
export const SNAP = 0.5;            // cuts and positions snap to half a foot
// the outward direction of face k (0 front, 1 right side, 2 back, 3 left side), [X, Z]: the camera uses it
export const FACE_NORMAL = [[0, 1], [1, 0], [0, -1], [-1, 0]];

const r6 = (v) => { const r = Math.round(v * 1e6) / 1e6; return r === 0 ? 0 : r; };
const r3 = (v) => { const r = Math.round(v * 1e3) / 1e3; return r === 0 ? 0 : r; };
export const roundPt = (p) => ({ X: r6(p.X), Y: r6(p.Y), Z: r6(p.Z) });

export function newTower(W = START_W, D = W) { return { W, D, boards: [] }; }

// a post: standing straight up
export const isPost = (b) => Math.abs(b.a.X - b.b.X) < 1e-6 && Math.abs(b.a.Z - b.b.Z) < 1e-6;
// a corner post: a post on a stone
export const isCornerPost = (t, b) => isPost(b) && Math.abs(Math.abs(b.a.X) - t.W / 2) < 1e-6 && Math.abs(Math.abs(b.a.Z) - t.D / 2) < 1e-6;

// ── planes (PLANES ARE X OR Z: these few functions are where that is assumed) ────────────────────────────────────────
export const planeKey = (axis, off) => axis + ':' + r3(off);
export function parseKey(key) { const i = key.indexOf(':'); return { axis: key.slice(0, i), off: +key.slice(i + 1) }; }
// the plane a board was put up in (by n), and every plane it lies in (a post: two, its own first)
export const planeKeyOf = (b) => (b.n === 'X' ? planeKey('X', b.a.X) : planeKey('Z', b.a.Z));
export function planesOf(b) {
  if (!isPost(b)) return [planeKeyOf(b)];
  const other = b.n === 'X' ? planeKey('Z', b.a.Z) : planeKey('X', b.a.X);
  return [planeKeyOf(b), other];
}
// world <-> a plane's own (u, y)
export function toPlane(key, p) { return key[0] === 'Z' ? { u: p.X, y: p.Y } : { u: -p.Z, y: p.Y }; }
export function fromPlane(key, u, y) { const { axis, off } = parseKey(key); return axis === 'Z' ? { X: u, Y: y, Z: off } : { X: off, Y: y, Z: -u }; }
// the plane's outward normal (away from the tower's middle; a plane through the middle: toward +), [X, Z]
export function planeNormal(key) { const { axis, off } = parseKey(key), s = off < 0 ? -1 : 1; return axis === 'Z' ? [0, s] : [s, 0]; }
// how far the footprint reaches along a plane: u from -half to +half
export const planeHalf = (t, key) => (key[0] === 'Z' ? t.W / 2 : t.D / 2);
// the plane at right angles to `key` through a world point (the plane an end moves in when its board is pushed in or out)
export const crossKey = (key, p) => (key[0] === 'Z' ? planeKey('X', p.X) : planeKey('Z', p.Z));
// the outer plane of face k
export function facePlane(t, k) { return [planeKey('Z', t.D / 2), planeKey('X', t.W / 2), planeKey('Z', -t.D / 2), planeKey('X', -t.W / 2)][k]; }
// which face an outer plane is (or -1 for an inner plane)
export function faceOfPlane(t, key) { for (let k = 0; k < 4; k++) if (facePlane(t, k) === key) return k; return -1; }
// is a plane inside the footprint (its offset within the stones)?
export function planeInside(t, key) { const { axis, off } = parseKey(key); return Math.abs(off) <= (axis === 'Z' ? t.D : t.W) / 2 + 1e-6; }

// a plane in words: "the front wall", "the right side", ..., or for an inner plane "the inside wall 1½ ft in from the
// front" (short: "1½ ft in from the front")
export function planeName(t, key, short = false) {
  const k = faceOfPlane(t, key);
  if (k >= 0) return short ? ['front wall', 'right side', 'back wall', 'left side'][k] : ['the front wall', 'the right side', 'the back wall', 'the left side'][k];
  const { axis, off } = parseKey(key), half = axis === 'Z' ? t.D / 2 : t.W / 2;
  const from = axis === 'Z' ? (off >= 0 ? 'front' : 'back') : (off >= 0 ? 'right side' : 'left side');
  const words = Math.abs(off) < 1e-6 ? `halfway between the ${axis === 'Z' ? 'front and back' : 'two sides'}` : `${feet(half - Math.abs(off))} in from the ${from}`;
  return short ? words : 'the inside wall ' + words;
}
// feet the way a carpenter says them ("1½ ft", "2 ft", "1 ft 3 in")
function feet(ft) {
  const inches = Math.round(ft * 12), f = Math.floor(inches / 12), i = inches % 12;
  if (i === 0) return f + ' ft';
  if (i === 6) return (f || '') + '½ ft';
  return (f ? f + ' ft ' : '') + i + ' in';
}

// every board lying in a plane (posts in it included), in that plane's own coordinates:
// [{ id, ax, ay, bx, by, len, post, src }]
export function planeSegments(t, key) {
  const out = [];
  for (const b of t.boards) {
    if (!planesOf(b).includes(key)) continue;
    const A = toPlane(key, b.a), B = toPlane(key, b.b);
    out.push({ id: b.id, ax: A.u, ay: A.y, bx: B.u, by: B.y, len: b.len, post: isPost(b), corner: isCornerPost(t, b), src: b });
  }
  return out;
}
// How wide the wall is that a board on plane `key` stands in, at its height: the span between the posts standing in
// that plane either side of its middle, over the height it spans (a 2 × 3 tier's front wall is 2 ft wide even though
// its plane crosses the whole 6 ft base; a 1 × 1 top's walls are 1 ft). The plane's full width if no posts bracket it.
// s: the board on the plane, { ax, ay, bx, by }.
export function wallSpan(t, key, s) {
  const lo = Math.min(s.ay, s.by), hi = Math.max(s.ay, s.by), m = (s.ax + s.bx) / 2;
  let L = -Infinity, R = Infinity;
  for (const p of planeSegments(t, key)) {
    if (!p.post || Math.min(p.ay, p.by) > hi - 0.1 || Math.max(p.ay, p.by) < lo + 0.1) continue;
    if (p.ax <= m) L = Math.max(L, p.ax);
    if (p.ax >= m) R = Math.min(R, p.ax);
  }
  return Number.isFinite(L) && Number.isFinite(R) && R - L > 0.25 ? R - L : planeHalf(t, key) * 2;
}
// where boards that cross a plane pass through it (a beam running in from the front crosspiece crosses every plane of
// the other kind it spans): [{ u, y, t (feet along that board from its a end), src }]. Boards lying in the plane, and
// boards parallel to it (posts, and boards in planes of its own kind), don't cross it. (PLANES ARE X OR Z)
export function crossings(t, key) {
  const out = [], { axis, off } = parseKey(key), c = (p) => (axis === 'Z' ? p.Z : p.X);
  for (const b of t.boards) {
    if (isPost(b) || planesOf(b).includes(key)) continue;
    const ca = c(b.a), cb = c(b.b);
    if (Math.abs(ca - cb) < 1e-6) continue;
    const s = (off - ca) / (cb - ca);
    if (s < -1e-6 || s > 1 + 1e-6) continue;
    const q = toPlane(key, { X: b.a.X + (b.b.X - b.a.X) * s, Y: b.a.Y + (b.b.Y - b.a.Y) * s, Z: b.a.Z + (b.b.Z - b.a.Z) * s });
    out.push({ u: q.u, y: q.y, t: s * b.len, src: b });
  }
  return out;
}
// The floor a plane's boards stand on where no board of its own lies there: level boards crossing the plane at one
// height (the two beams a tier stands on cross its front wall right at its posts' feet) make a level line on the plane
// between the outermost of them, which closes a triangle with a brace and a post just as a crosspiece would.
// [{ id, ax, ay, bx, by, len, floor: true }]
export function floorsAcross(t, key) {
  const at = new Map();
  for (const c of crossings(t, key)) {
    if (Math.abs(c.src.a.Y - c.src.b.Y) > 0.05) continue;
    const y = Math.round(c.y * 20) / 20; (at.get(y) || at.set(y, []).get(y)).push(c.u);
  }
  const out = [];
  for (const [y, us] of at) {
    const lo = Math.min(...us), hi = Math.max(...us);
    if (us.length >= 2 && hi - lo >= 0.5) out.push({ id: 'floor:' + y, ax: lo, ay: y, bx: hi, by: y, len: hi - lo, floor: true });
  }
  return out;
}
// a board lying on a plane, from its a end at (u, y) on it, at angle ang (radians, 0 = level toward +u, PI/2 = straight
// up) and len feet long -> { a, b, len, n } in the world (n: the plane's kind, so its wide face lies flat on the plane)
export function boardOnPlane(key, u, y, ang, len) {
  const a = roundPt(fromPlane(key, u, y)), b = roundPt(fromPlane(key, u + Math.cos(ang) * len, y + Math.sin(ang) * len));
  return { a, b, len, n: key[0] };
}
// every plane any board lies in
export function planesInUse(t) { const s = new Set(); for (const b of t.boards) for (const k of planesOf(b)) s.add(k); return [...s]; }

// the boards in the world, each with its `key` (its id: the drawing and the crash look boards up by it)
export const worldBoards = (t) => t.boards.map((b) => ({ ...b, key: b.id, src: b }));
export const boardCount = (t) => t.boards.length;
// all the wood in the tower, feet (its weight is this times the wood's weight per foot)
export const woodFeet = (t) => t.boards.reduce((n, b) => n + b.len, 0);
// how tall the tower is: the top of its highest board
export const towerHeight = (t) => t.boards.reduce((h, b) => Math.max(h, b.a.Y, b.b.Y), 0);
// a copy keeping only the boards whose top is at or under the given height
export function trimTower(t, top) {
  return { W: t.W, D: t.D, boards: t.boards.filter((b) => Math.max(b.a.Y, b.b.Y) <= top + 0.05).map((b) => ({ ...b, a: { ...b.a }, b: { ...b.b } })) };
}
export function cloneTower(t) { return JSON.parse(JSON.stringify(t)); }
// a board from its two ends (rounded so equal planes compare equal)
export function makeBoard(id, a, b, n, len) {
  const A = roundPt(a), B = roundPt(b);
  return { id, a: A, b: B, len: len ?? Math.hypot(B.X - A.X, B.Y - A.Y, B.Z - A.Z), n };
}

// ── twins: where a board just nailed would be matched round the tower ────────────────────────────────────────────────
// The wind comes from every side, so a builder wants the same board on every wall. The twins are the board's images under
// the footprint's own symmetries about the tower's middle (as v2's were, now in world coordinates):
//   a wall board  -> the opposite wall: its mirror image ((X, Y, Z) -> (X, Y, -Z) for a Z-plane board, (-X, Y, Z) for an
//                    X-plane one), and on a square base also the two walls round the corner: a quarter turn and the
//                    mirror across the diagonal (n swaps X <-> Z), the ones v2 offered (front and right side carry the
//                    board as it is, seen from outside; back and left side its mirror image)
//   a post        -> its three mirror images (mirror X, mirror Z, both): the diagonally opposite one faces the same way,
//                    the two beside it are turned a quarter (as the four would be if the tower were turned round), so a
//                    tower built from twins is about equally stiff both ways
// An image that leaves the footprint, lands on itself, or touches nothing is not offered.
// Returns [{ a, b, len, n }], the opposite one first, not yet checked for wood.
const swapN = (n) => (n === 'X' ? 'Z' : 'X');
export function twinsOf(t, board, touches = (g) => touchesAny(g, t.boards)) {
  const out = [], square = Math.abs(t.W - t.D) < 1e-6;
  const img = (f, n) => ({ a: roundPt(f(board.a)), b: roundPt(f(board.b)), len: board.len, n });
  const mX = (p) => ({ X: -p.X, Y: p.Y, Z: p.Z }), mZ = (p) => ({ X: p.X, Y: p.Y, Z: -p.Z });
  if (isPost(board)) {
    out.push(img((p) => mZ(mX(p)), board.n), img(mX, swapN(board.n)), img(mZ, swapN(board.n)));
  } else {
    const R = (p) => ({ X: p.Z, Y: p.Y, Z: -p.X }), Ri = (p) => ({ X: -p.Z, Y: p.Y, Z: p.X }), Rd = (p) => ({ X: -p.Z, Y: p.Y, Z: -p.X });
    if (board.n === 'Z') { out.push(img(mZ, 'Z')); if (square) out.push(img(R, 'X'), img(Rd, 'X')); }
    else { out.push(img(mX, 'X')); if (square) out.push(img(Ri, 'Z'), img(Rd, 'Z')); }
  }
  const same = (g, b) => (near(g.a, b.a) && near(g.b, b.b)) || (near(g.a, b.b) && near(g.b, b.a));
  const kept = [];
  for (const g of out) {
    if (same(g, board) || kept.some((k) => same(k, g))) continue;
    if (!inFootprint(t, g.a) || !inFootprint(t, g.b)) continue;
    if (touches && !touches(g)) continue;
    kept.push(g);
  }
  return kept;
}
const near = (p, q) => Math.abs(p.X - q.X) < 1e-4 && Math.abs(p.Y - q.Y) < 1e-4 && Math.abs(p.Z - q.Z) < 1e-4;
export const inFootprint = (t, p) => Math.abs(p.X) <= t.W / 2 + 1e-4 && Math.abs(p.Z) <= t.D / 2 + 1e-4;

// is a spot already taken? (a board lying along the same line, in the same plane, overlapping it by more than a hair)
export function spotTaken(t, g) {
  const dx = (g.b.X - g.a.X) / g.len, dy = (g.b.Y - g.a.Y) / g.len, dz = (g.b.Z - g.a.Z) / g.len;
  return t.boards.some((b) => {
    // (both ends of b within a fifth of a foot of g's line)
    for (const p of [b.a, b.b]) {
      const vx = p.X - g.a.X, vy = p.Y - g.a.Y, vz = p.Z - g.a.Z, s = vx * dx + vy * dy + vz * dz;
      if (Math.hypot(vx - s * dx, vy - s * dy, vz - s * dz) > 0.2) return false;
    }
    const s0 = (b.a.X - g.a.X) * dx + (b.a.Y - g.a.Y) * dy + (b.a.Z - g.a.Z) * dz, s1 = (b.b.X - g.a.X) * dx + (b.b.Y - g.a.Y) * dy + (b.b.Z - g.a.Z) * dz;
    return Math.min(g.len, Math.max(s0, s1)) - Math.max(0, Math.min(s0, s1)) > 0.3;
  });
}
