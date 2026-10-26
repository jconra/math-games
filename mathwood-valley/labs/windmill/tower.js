// THE TOWER AS DATA: what has been built, and where every board sits in the world. No drawing here and no three.js, so
// node can load it for the tests (rigs) as well as the page.
//
//   tower = { W, D, boards: [board, ...] }
//   board = { id, a: { X, Y, Z }, b: { X, Y, Z }, len }
//
// Distances are in FEET (the boards are 8-foot boards and the math talks in feet); the page turns feet into metres only
// when it draws. The tower's middle is at X = Z = 0, the ground at Y = 0; the front faces +Z, the right side +X. The
// four footing stones sit at (±W/2, ±D/2): W across the front, D along the sides. The base is the first thing a builder
// settles (drag a stone in or out); it stays with the tower, so every function here reads it from the tower.
//
// a, b: the middles of a board's two ends; len: how long it is (the length of the piece it was cut from). There are no
// walls: boards are free, anywhere over the stones. Which way a board's wide face looks is worked out from its line
// (frame.js faceOf). A tower saved by an older version may carry n and t on its boards: they are ignored (cleanTower).
//
// A board in hand goes up this way (build.js): its first end goes in a SOCKET (a point on the half foot: on the ground
// within the stones, or along a board at half-foot steps from either of its ends), and its FREE END goes wherever it
// can reach: anywhere a board's length from the socket. It CONNECTS to another board when its line passes through that
// board within its length (reachOn, connectTo): the joint is there, and a board longer than that sticks out past the
// joint (it can be sawn off: offcutOf). Moved by ½ ft across X or Z (freeEnd), its height follows from its length.
import { touchesAny, touch3, pointGap, TOL } from './touch.js';

export const START_W = 6;           // a new lab starts with the stones 6 feet apart each way
export const MIN_W = 0.5, MAX_W = 8; // how close and how far apart the stones can be set (either way)
export const BOARD_FT = 8;          // a fresh board from the stack
export const BOARDS = 28;           // full boards in a fresh stack (every board on the tower comes out of it: a 16 ft
                                    // tower braced corner to corner on a 6 ft base takes 24, so a few to spare)
export const SNAP = 0.5;            // cuts, sockets and the free end's steps go by half a foot
export const LEAN_MAX = 7;          // inches for every foot up: how far out past the stones a board may reach as it climbs
export const SCRAP = 0.5;           // an offcut shorter than this is kindling, not lumber
// the outward direction of face k (0 front, 1 right side, 2 back, 3 left side), [X, Z]: the camera uses it
export const FACE_NORMAL = [[0, 1], [1, 0], [0, -1], [-1, 0]];

const r6 = (v) => { const r = Math.round(v * 1e6) / 1e6; return r === 0 ? 0 : r; };
export const roundPt = (p) => ({ X: r6(p.X), Y: r6(p.Y), Z: r6(p.Z) });
const dist = (p, q) => Math.hypot(p.X - q.X, p.Y - q.Y, p.Z - q.Z);
const near = (p, q, e = 1e-4) => Math.abs(p.X - q.X) < e && Math.abs(p.Y - q.Y) < e && Math.abs(p.Z - q.Z) < e;

// ── lengths in words ─────────────────────────────────────────────────────────────────────────────────────────────────
// a rate in words: "1½ inches in for every foot up", "2 inches out for every foot up" (dir: any words for the way)
export function leanIn(k) {
  const a = Math.abs(k), f = Math.floor(a + 1e-9), half = a - f > 0.25;
  return (half ? (f || '') + '½' : String(f)) + ' in';
}
export function leanRate(k, dir = 'in') {
  const a = Math.abs(k), n = leanIn(a).replace(/ in$/, '');
  return `${n} ${a > 1 ? 'inches' : 'inch'} ${dir} for every foot up`;
}
// In a sentence a length is spelled out ("1 foot 7 inches", "4 feet", "1½ feet", "9 inches"); on a short label or tag
// it is "1 ft 7 in." (lenLabel), the period saying the "in" is inches.
export function lenWords(ft) {
  const inches = Math.round(ft * 12), f = Math.floor(inches / 12), i = inches % 12;
  const F = (n) => `${n} ${n === 1 ? 'foot' : 'feet'}`, I = (n) => `${n} ${n === 1 ? 'inch' : 'inches'}`;
  if (inches === 0 && ft > 0) return 'less than an inch';
  if (i === 0) return F(f);
  if (i === 6) return f ? `${f}½ feet` : 'half a foot';
  return f ? `${F(f)} ${I(i)}` : I(i);
}
export function lenLabel(ft) {
  const inches = Math.round(ft * 12), f = Math.floor(inches / 12), i = inches % 12;
  if (inches === 0 && ft > 0) return 'under 1 in.';
  if (i === 0) return f + ' ft';
  if (i === 6) return (f || '') + '½ ft';
  return (f ? f + ' ft ' : '') + i + ' in.';
}
// a label's units spelled out for a sentence: "1 ft 7 in." -> "1 foot 7 inches", "1½ ft" -> "1½ feet", "4 ft" -> "4
// feet", "9 in" -> "9 inches". (Only a number's own unit: "in" as a word, "in from the front", is left alone.)
export function spellUnits(text) {
  // (a label's "in." ending a sentence keeps the sentence's full stop: "she stood 15 ft 11 in." -> "...11 inches.")
  const stop = (str, off) => (/^\s*(?:$|[A-Z"“])/.test(str.slice(off)) ? '.' : '');
  const I = (n) => `${n} ${n === '1' || n === '½' ? 'inch' : 'inches'}`, F = (n) => (n === '1' ? '1 foot' : n === '½' ? 'half a foot' : n + ' feet');
  return String(text)
    .replace(/(\d+(?:½)?|½) ft (\d+) in(\.?)(?![a-z])/g, (m, f, i, dot, off, str) => `${F(f)} ${I(i)}${dot ? stop(str, off + m.length) : ''}`)
    .replace(/(\d+(?:½)?|½) ft\b/g, (m, f) => F(f))
    .replace(/(\d+(?:½)?|½) in\.(?![a-z])/g, (m, i, off, str) => I(i) + stop(str, off + m.length))
    .replace(/(\d+(?:½)?|½) in(?= (?:[A-Z(]|$)|[,;:)]|\.|$)/g, (m, i) => I(i));
}

export function newTower(W = START_W, D = W) { return { W, D, boards: [] }; }
// a tower as data, whatever version saved it: just { W, D, boards: [{ id, a, b, len }] } (an older tower's n and t, how
// its walls stood, are dropped)
export function cleanTower(t) {
  return { W: t.W, D: t.D ?? t.W, boards: (t.boards || []).map((b) => ({ id: b.id, a: roundPt(b.a), b: roundPt(b.b), len: b.len ?? dist(b.a, b.b) })) };
}

// a post: standing straight up
export const isPost = (b) => Math.abs(b.a.X - b.b.X) < 1e-6 && Math.abs(b.a.Z - b.b.Z) < 1e-6;
// a corner post: a post on a stone
export const isCornerPost = (t, b) => isPost(b) && Math.abs(Math.abs(b.a.X) - t.W / 2) < 1e-6 && Math.abs(Math.abs(b.a.Z) - t.D / 2) < 1e-6;
// horizontal (within about 8 degrees), and standing up (within about 8 degrees of straight up)
export const isLevelB = (b) => Math.abs(b.a.Y - b.b.Y) < 0.14 * (b.len || dist(b.a, b.b) || 1);
export const isUprightB = (b) => isPost(b) || Math.hypot(b.b.X - b.a.X, b.b.Z - b.a.Z) < 0.14 * (b.len || dist(b.a, b.b) || 1);

// ── where a board is, in words ───────────────────────────────────────────────────────────────────────────────────────
// Which side of the tower a set of boards stands on, from their middles: "back", "front left", "left", or "middle"
// (all of them near the middle), or '' (spread across it).
export function sideOf(bs, t) {
  const mid = bs.map((b) => ({ X: (b.a.X + b.b.X) / 2, Z: (b.a.Z + b.b.Z) / 2 })), all = (f) => mid.length && mid.every(f), e = 0.05;
  const fb = all((p) => p.Z > e) ? 'front' : all((p) => p.Z < -e) ? 'back' : '', lr = all((p) => p.X > e) ? 'right' : all((p) => p.X < -e) ? 'left' : '';
  if (fb || lr) return [fb, lr].filter(Boolean).join(' ');
  return all((p) => Math.abs(p.X) < t.W / 4 + e && Math.abs(p.Z) < t.D / 4 + e) ? 'middle' : '';
}
// " at the front", " on the right", " at the front right", " in the middle", or ''
export const atSide = (side) => (!side ? '' : side === 'middle' ? ' in the middle' : /^(front|back)/.test(side) ? ` at the ${side}` : ` on the ${side}`);
// The side or corner ONE board is on: a board near the middle line of the tower one way (within an eighth of the base)
// is not called left or right (or front or back) for being a hair off it. -> "front right", "front", "middle", ...
export function sideOfBoard(b, t) {
  const X = (b.a.X + b.b.X) / 2, Z = (b.a.Z + b.b.Z) / 2, ex = t.W / 8 + 0.05, ez = t.D / 8 + 0.05;
  const fb = Z > ez ? 'front' : Z < -ez ? 'back' : '', lr = X > ex ? 'right' : X < -ex ? 'left' : '';
  return [fb, lr].filter(Boolean).join(' ') || 'middle';
}
// a board named by what it is and where: "the brace at the front right, 8 ft up", "the post at the back left", "the
// horizontal board on the right, 4 ft up" (a label's lengths: a sentence spells them out with spellUnits). legs: board
// ids that are legs (posts that lean: frame.js boardShapes), if known.
export function nounOf(b, legs = null) {
  if (isUprightB(b)) return 'post';
  if (legs && legs.has(b.id)) return 'leg';
  return isLevelB(b) ? 'horizontal board' : 'brace';
}
export function placeWords(t, b, legs = null) {
  const lo = Math.min(b.a.Y, b.b.Y), up = lo > 0.3 ? `, ${lenLabel(Math.round(lo * 2) / 2)} up` : '';
  return `the ${nounOf(b, legs)}${atSide(sideOfBoard(b, t))}${up}`;
}

// ── sockets: where a board's first end can go ───────────────────────────────────────────────────────────────────────
// Every point on the half foot on the ground within the stones (the stones' corners included), and along every board at
// half-foot steps from either of its ends. -> [{ X, Y, Z, on (the board it is on, or null on the ground), s (feet along
// it from its a end) }] (a spot shared by two boards is listed once, on the first)
export function socketsOf(t) {
  const out = [], nx = Math.round(t.W / SNAP), nz = Math.round(t.D / SNAP);
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) out.push({ X: r6(-t.W / 2 + i * SNAP), Y: 0, Z: r6(-t.D / 2 + j * SNAP), on: null, s: 0 });
  for (const b of t.boards) {
    const ss = new Set();
    for (let s = 0; s <= b.len + 1e-6; s += SNAP) { ss.add(r6(s)); ss.add(r6(b.len - s)); }
    for (const s of [...ss].sort((p, q) => p - q)) {
      if (s < -1e-6 || s > b.len + 1e-6) continue;
      const p = roundPt(along(b, s));
      if (p.Y < 0.05 && out.some((q) => !q.on && near(q, p, 0.05))) continue;
      if (out.some((q) => q.on && near(q, p, 0.02))) continue;
      out.push({ ...p, on: b, s });
    }
  }
  return out;
}
// a point along a board, s feet from its a end
export function along(b, s) {
  const L = dist(b.a, b.b) || 1, k = s / L;
  return { X: b.a.X + (b.b.X - b.a.X) * k, Y: b.a.Y + (b.b.Y - b.a.Y) * k, Z: b.a.Z + (b.b.Z - b.a.Z) * k };
}

// ── the free end ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The free end of a board len feet long from its socket A, moved dx across (X) and dz along (Z) from A: its height
// follows from its length (up, or down when up = -1), never below the ground. null when it can't reach that far over.
export function freeEnd(A, len, dx, dz, up = 1) {
  const run2 = dx * dx + dz * dz;
  if (run2 > len * len + 1e-9) return null;
  const h = Math.sqrt(Math.max(0, len * len - run2));
  let Y = A.Y + (up < 0 ? -h : h);
  if (Y < -1e-6) return null;
  return roundPt({ X: A.X + dx, Y: Math.max(0, Y), Z: A.Z + dz });
}
// Where along board o a board len feet long from its socket A can reach: the stretch of o (feet from o's a end) whose
// points are no further than len from A. [lo, hi] or null (too short to reach o anywhere: it never connects there).
export function reachOn(A, len, o) {
  const L = dist(o.a, o.b) || 1, d = { X: (o.b.X - o.a.X) / L, Y: (o.b.Y - o.a.Y) / L, Z: (o.b.Z - o.a.Z) / L };
  const w = { X: A.X - o.a.X, Y: A.Y - o.a.Y, Z: A.Z - o.a.Z }, m = w.X * d.X + w.Y * d.Y + w.Z * d.Z;
  const off2 = w.X * w.X + w.Y * w.Y + w.Z * w.Z - m * m, r2 = len * len - off2;
  if (r2 < 0) return null;
  const r = Math.sqrt(r2), lo = Math.max(0, m - r), hi = Math.min(L, m + r);
  return hi >= lo - 1e-9 ? [lo, hi] : null;
}
// The board from its socket A, len feet long, its line through the point s feet along board o: { b (its free end), P
// (the joint), past (how far it sticks out past the joint) } or null when that point is out of its reach, or right at A.
export function connectTo(A, len, o, s) {
  const P = along(o, s), d = dist(A, P);
  if (d > len + 1e-6 || d < 0.4) return null;
  const k = len / d;
  return { b: roundPt({ X: A.X + (P.X - A.X) * k, Y: A.Y + (P.Y - A.Y) * k, Z: A.Z + (P.Z - A.Z) * k }), P: roundPt(P), past: Math.max(0, len - d) };
}
// Does the board from A to B (its free end) pass through another board along the way (centre lines within reach
// feet)? The one met nearest the free end, and the board squared onto it: { o, s (feet along o), b, P, past } or null.
// skip: boards it already sits on at its socket (and any board passing within 0.4 ft of the socket is skipped too).
export function connectAlong(t, A, B, len, { reach = 0.3, skip = [] } = {}) {
  const me = { a: A, b: B, len };
  let best = null;
  for (const o of t.boards) {
    if (skip.includes(o) || pointGap(A, o).d < 0.4) continue;
    const g = nearestPair(me, o);
    if (g.d > reach || g.t < 0.4) continue;
    const c = connectTo(A, len, o, g.s); if (!c) continue;
    if (!best || g.t > best.t) best = { o, s: g.s, t: g.t, ...c };
  }
  return best;
}
// the nearest points of two boards: { d (feet apart), t (along p from its a end), s (along q) }
function nearestPair(p, q) {
  const cs = touch3({ ...p, len: dist(p.a, p.b) }, { ...q, len: dist(q.a, q.b) });
  if (cs.length) { const c = cs[cs.length - 1]; return { d: 0, t: c.ti, s: c.tj }; }
  let best = { d: Infinity, t: 0, s: 0 };
  const Lp = dist(p.a, p.b), Lq = dist(q.a, q.b);
  for (let i = 0; i <= 24; i++) {
    const t = Lp * i / 24, P = along(p, t), g = pointGap(P, { ...q, len: Lq });
    if (g.d < best.d) best = { d: g.d, t, s: g.t };
  }
  return best;
}
// What a board sticking out past its joint by `past` feet gives back when the extra is sawn off: the offcut, rounded
// DOWN to the half foot (0: under half a foot, kindling).
export const offcutOf = (past) => (past < SCRAP - 1e-6 ? 0 : Math.floor((past + 1e-6) / SNAP) * SNAP);

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
// a board from its two ends (rounded to the millionth) and its length (the piece's; else from its ends)
export function makeBoard(id, a, b, len) {
  const A = roundPt(a), B = roundPt(b);
  return { id, a: A, b: B, len: len ?? dist(A, B) };
}

// ── twins: where a board just nailed would be matched round the tower ────────────────────────────────────────────────
// The wind comes from every side, so a builder wants the same board on every side. The twins are the board's images
// under the base's own symmetries about the tower's middle: mirrored front to back (Z), side to side (X), and both (a
// half turn); on a square base also the quarter turns and the mirrors across the diagonals. Tried in that order (the
// opposite side first, then round the corners), an image is offered unless it lands on the board itself or on a twin
// already offered, crosses the board (or a twin) through both their middles (a brace's mirror on its own side would
// make an X there: that is the builder's call, not a twin), leaves the footprint, or touches nothing.
// Returns [{ a, b, len }], the opposite one first, not yet checked for wood.
export function twinsOf(t, board, touches = (g) => touchesAny(g, t.boards)) {
  const square = Math.abs(t.W - t.D) < 1e-6;
  const maps = [(p) => ({ X: p.X, Y: p.Y, Z: -p.Z })];
  if (square) maps.push((p) => ({ X: p.Z, Y: p.Y, Z: -p.X }), (p) => ({ X: -p.Z, Y: p.Y, Z: p.X }));
  maps.push((p) => ({ X: -p.X, Y: p.Y, Z: p.Z }), (p) => ({ X: -p.X, Y: p.Y, Z: -p.Z }));
  if (square) maps.push((p) => ({ X: p.Z, Y: p.Y, Z: p.X }), (p) => ({ X: -p.Z, Y: p.Y, Z: -p.X }));
  const same = (g, b) => (near(g.a, b.a) && near(g.b, b.b)) || (near(g.a, b.b) && near(g.b, b.a));
  const kept = [];
  for (const f of maps) {
    const g = { a: roundPt(f(board.a)), b: roundPt(f(board.b)), len: board.len };
    if (same(g, board) || kept.some((k) => same(k, g))) continue;
    if ([board, ...kept].some((o) => crossesMid(g, o))) continue;
    if (!inFootprint(t, g.a) || !inFootprint(t, g.b)) continue;
    if (touches && !touches(g)) continue;
    kept.push(g);
  }
  return kept;
}
// do two boards cross through both their middles (not at an end of either)?
export function crossesMid(p, q) {
  const lp = p.len || dist(p.a, p.b), lq = q.len || dist(q.a, q.b), e = 0.3;
  return touch3({ ...p, len: lp }, { ...q, len: lq }).some((c) => c.ti > e && c.ti < lp - e && c.tj > e && c.tj < lq - e);
}
// is a point over the stones? (on the ground: within them; higher up, as far out past them as a board leaning 7 inches
// for every foot up reaches)
export const inFootprint = (t, p) => {
  const more = LEAN_MAX / 12 * Math.max(0, p.Y);
  return Math.abs(p.X) <= t.W / 2 + more + 1e-4 && Math.abs(p.Z) <= t.D / 2 + more + 1e-4;
};

// is a spot already taken? (a board lying along the same line, overlapping it by more than a hair)
export function spotTaken(t, g) {
  const len = g.len || dist(g.a, g.b), dx = (g.b.X - g.a.X) / len, dy = (g.b.Y - g.a.Y) / len, dz = (g.b.Z - g.a.Z) / len;
  return t.boards.some((b) => {
    // (both ends of b within a fifth of a foot of g's line)
    for (const p of [b.a, b.b]) {
      const vx = p.X - g.a.X, vy = p.Y - g.a.Y, vz = p.Z - g.a.Z, s = vx * dx + vy * dy + vz * dz;
      if (Math.hypot(vx - s * dx, vy - s * dy, vz - s * dz) > 0.2) return false;
    }
    const s0 = (b.a.X - g.a.X) * dx + (b.a.Y - g.a.Y) * dy + (b.a.Z - g.a.Z) * dz, s1 = (b.b.X - g.a.X) * dx + (b.b.Y - g.a.Y) * dy + (b.b.Z - g.a.Z) * dz;
    return Math.min(len, Math.max(s0, s1)) - Math.max(0, Math.min(s0, s1)) > 0.3;
  });
}
export { TOL };
