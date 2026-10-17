// THE TOWER AS DATA: what has been built, and where every board sits in the world. No drawing here and no three.js, so
// node can load it for the tests (rigs) as well as the page.
//
//   tower = { W, D, boards: [board, ...] }
//   board = { id, a: { X, Y, Z }, b: { X, Y, Z }, len, n, t }      (t only when its wall leans)
//
// Distances are in FEET (the boards are 8-foot boards and the math talks in feet); the page turns feet into metres only
// when it draws. The tower's middle is at X = Z = 0, the ground at Y = 0; the front wall faces +Z, the right side +X.
// The four footing stones sit at (±W/2, ±D/2): W across the front, D along the sides. The base is the first thing a
// builder settles (drag a stone in or out); it stays with the tower, so every function here reads it from the tower.
//
// a, b: the middles of a board's two ends. n: which family of wall it lies flat in: 'Z' a wall like the front and back
// (it runs across X), 'X' a wall like the sides (it runs across Z). t: how much that wall LEANS: k inches in (or out)
// for every foot up, t = k / 12, k by the half inch from -7 to 7 (7 in a foot is about 30 degrees). The wall is the
// plane Z = c + t·Y for an n: 'Z' board (X = c + t·Y for 'X'), c where it meets the ground (Y = 0), even for a wall that
// starts higher up, like a tier's. No t (or 0): an upright wall, exactly as before walls could lean. (A level board
// can't show its wall's lean from its ends, which is why t is kept.) Its wide (3½ in) face looks along the wall's
// normal, e_n - t·e_Y. A wall at any offset over the stones: a 6 × 4 base, a 2 × 3 tier on beams above it, a 1 × 1 on
// top; and with leaning walls a tower that narrows as it climbs, its corner legs leaning in two ways at once.
//
// A board standing straight up is a POST: it lies in both upright walls through its line, so boards in either can be
// nailed to it. It is one 2x4: its n is the wall it was put up in (its wide face looks that way). A post on a stone
// (±W/2, ±D/2) is a corner post. A board that is not level and leans across its own wall by a whole half inch in a foot
// (7 at most) lies in that other wall too: a LEG (posts included), the line where two walls meet. A tapered tower's
// corner legs are legs: boards in either leaning wall are nailed to them.
//
// Planes (walls) have keys: 'Z:1.5' is the upright plane Z = 1.5, 'X:-1' the plane X = -1, and a leaning one says its
// lean after a '~': 'Z:3~-2' is the plane Z = 3 - (2/12)·Y (the front wall of a 6 ft base leaning in 2 in a foot). On a
// plane, a point is (u, y), TRUE lengths (angles, board lengths and the math depend on it): u along the wall, level, as
// before (in a Z-plane u = X, in an X-plane u = -Z, so seen from the +Z (or +X) side u runs to the right), y up the
// slope of the wall from its ground line (so a point y feet up the slope stands Y = y / √(1 + t²) high). On an upright
// plane y is just the height. Anything shown as a height uses Y. (A view from the back or the left sees u run to its
// left: the view flips it, never the data.)
//
// TURNED WALLS (v5): besides 'Z' and 'X', a wall may be TURNED about the vertical, by 15 degrees at a time: family
// 'R15' ... 'R165' (never R0 or R90: those are 'Z' and 'X'), turned that many degrees from the front's direction toward
// the right side. A family's angle θ: Z = 0, X = 90, Rθ = θ; a family and its +180 are one family (θ kept in [0, 180)).
// Its normal (the horizontal part, outward-ish) e(θ) = (sin θ, 0, cos θ), the way along it (u) d(θ) = (cos θ, 0, -sin θ)
// (for Z and X exactly the u = X and u = -Z above). A point's place across the family: p·e(θ); the plane: p·e(θ) =
// c + t·Y, keyed 'R45:1.414' (or 'R45:1.414~-1.5' leaning) like the others. The Z and X paths below never go through
// sin and cos: they read p.Z and p.X, exactly as before. A turned board's lower end stands above the ground (the
// first posts or legs stand on the stones, in the front and side walls); anything above may be turned.
import { touchesAny } from './touch.js';

export const START_W = 6;           // a new lab starts with the stones 6 feet apart each way
export const MIN_W = 0.5, MAX_W = 8; // how close and how far apart the stones can be set (either way)
export const BOARD_FT = 8;          // a fresh board from the stack
export const BOARDS = 28;           // full boards in a fresh stack (every board on the tower comes out of it: a 16 ft
                                    // tower braced corner to corner on a 6 ft base takes 24, so a few to spare)
export const SNAP = 0.5;            // cuts and positions snap to half a foot
export const LEAN_MAX = 7;          // inches in a foot: the steepest a wall may lean, in or out (about 30 degrees)
export const LEAN_STEP = 0.5;       // and it goes by the half inch in a foot (a 6 ft base tapering to 2 ft at 16 ft
                                    // leans 1½ in a foot)
// the outward direction of face k (0 front, 1 right side, 2 back, 3 left side), [X, Z]: the camera uses it
export const FACE_NORMAL = [[0, 1], [1, 0], [0, -1], [-1, 0]];

const r6 = (v) => { const r = Math.round(v * 1e6) / 1e6; return r === 0 ? 0 : r; };
const r3 = (v) => { const r = Math.round(v * 1e3) / 1e3; return r === 0 ? 0 : r; };
export const roundPt = (p) => ({ X: r6(p.X), Y: r6(p.Y), Z: r6(p.Z) });

// ── leans ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// a lean in inches a foot (k) on the half inch, and back and forth to t (feet across per foot up)
export const snapK = (k) => { const r = Math.round(k / LEAN_STEP) * LEAN_STEP; return Math.max(-LEAN_MAX, Math.min(LEAN_MAX, r === 0 ? 0 : r)); };
export const tOfK = (k) => r6(k / 12);
export const kOfT = (t) => { const r = Math.round(t * 12 / LEAN_STEP) * LEAN_STEP; return r === 0 ? 0 : r; };
// is a ratio (feet across per foot up) a lean a wall can have: on the half inch a foot, 7 at most?
export const onLeanGrid = (r) => Math.abs(r) <= LEAN_MAX / 12 + 1e-6 && Math.abs(r - kOfT(r) / 12) < 1e-4;
// a lean in words: "2 in", "1½ in", "½ in"
export function leanIn(k) {
  const a = Math.abs(k), f = Math.floor(a + 1e-9), half = a - f > 0.25;
  return (half ? (f || '') + '½' : String(f)) + ' in';
}
// a lean as a rate, the way the player reads it: "1½ inches in for every foot up", "2 inches out for every foot up",
// "1 inch toward the back for every foot up" (dir: 'in', 'out', or any words for the way it leans). Never "in a foot".
export function leanRate(k, dir = 'in') {
  const a = Math.abs(k), n = leanIn(a).replace(/ in$/, '');
  return `${n} ${a > 1 ? 'inches' : 'inch'} ${dir} for every foot up`;
}

// ── lengths in words ─────────────────────────────────────────────────────────────────────────────────────────────────
// In a sentence a length is spelled out ("1 foot 7 inches", "4 feet", "1½ feet", "9 inches"); on a short label or tag
// it is "1 ft 7 in." (lenLabel), the period saying the "in" is inches.
export function lenWords(ft) {
  const inches = Math.round(ft * 12), f = Math.floor(inches / 12), i = inches % 12;
  const F = (n) => `${n} ${n === 1 ? 'foot' : 'feet'}`, I = (n) => `${n} ${n === 1 ? 'inch' : 'inches'}`;
  if (i === 0) return F(f);
  if (i === 6) return f ? `${f}½ feet` : 'half a foot';
  return f ? `${F(f)} ${I(i)}` : I(i);
}
export function lenLabel(ft) {
  const inches = Math.round(ft * 12), f = Math.floor(inches / 12), i = inches % 12;
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

// a post: standing straight up
export const isPost = (b) => Math.abs(b.a.X - b.b.X) < 1e-6 && Math.abs(b.a.Z - b.b.Z) < 1e-6;
// a corner post: a post on a stone
export const isCornerPost = (t, b) => isPost(b) && Math.abs(Math.abs(b.a.X) - t.W / 2) < 1e-6 && Math.abs(Math.abs(b.a.Z) - t.D / 2) < 1e-6;

// ── planes (Z, X and the turned families, upright or leaning: coord, along and these few functions know the families) ──
// planeKey(axis, c, k): the plane axis = c + (k/12)·Y; k = 0 (or none) is the upright plane, keyed as it always was
export const planeKey = (axis, off, k = 0) => { const kk = snapK(k); return axis + ':' + r3(off) + (kk ? '~' + kk : ''); };
// -> { axis, off (c: where it meets the ground), k (inches a foot), t (k / 12) }
export function parseKey(key) {
  const i = key.indexOf(':'), j = key.indexOf('~');
  const axis = key.slice(0, i), off = +key.slice(i + 1, j < 0 ? undefined : j), k = j < 0 ? 0 : +key.slice(j + 1);
  return { axis, off, k, t: tOfK(k) };
}
// ── wall families: Z, X, and the turned ones ─────────────────────────────────────────────────────────────────────────
export const TURN_STEP = 15;        // degrees: a wall turns by this much at a time
export const TURN_MIN_Y = 0.25;     // feet: a turned board's lower end stands at least this high (off the ground)
export const isTurnedFam = (axis) => typeof axis === 'string' && axis[0] === 'R';
// a family's angle, degrees in [0, 180)
export const famTheta = (axis) => (axis === 'Z' ? 0 : axis === 'X' ? 90 : +axis.slice(1));
// the family at an angle (degrees, any), on the 15 degree steps, normalized: 0 -> 'Z', 90 -> 'X', 225 -> 'R45'
export function famAt(deg) { const d = ((Math.round(deg / TURN_STEP) * TURN_STEP) % 180 + 180) % 180; return d === 0 ? 'Z' : d === 90 ? 'X' : 'R' + d; }
// sin and cos of a turned family's angle (45: exactly the same number both ways, so a 45 degree square's planes agree)
const SC = new Map();
function scOf(axis) {
  let v = SC.get(axis);
  if (!v) { const a = famTheta(axis) * Math.PI / 180; v = famTheta(axis) === 45 ? [Math.SQRT1_2, Math.SQRT1_2] : famTheta(axis) === 135 ? [Math.SQRT1_2, -Math.SQRT1_2] : [Math.sin(a), Math.cos(a)]; SC.set(axis, v); }
  return v;
}
// the family's horizontal normal e and its way along d, { X, Y, Z }
export function famNormal(axis) { if (axis === 'Z') return { X: 0, Y: 0, Z: 1 }; if (axis === 'X') return { X: 1, Y: 0, Z: 0 }; const [s, c] = scOf(axis); return { X: s, Y: 0, Z: c }; }
export function famAlong(axis) { if (axis === 'Z') return { X: 1, Y: 0, Z: 0 }; if (axis === 'X') return { X: 0, Y: 0, Z: -1 }; const [s, c] = scOf(axis); return { X: c, Y: 0, Z: -s }; }
// the family at right angles (where a post's or a leg's second wall is): θ + 90
export const otherFam = (axis) => (axis === 'Z' ? 'X' : axis === 'X' ? 'Z' : famAt(famTheta(axis) + 90));
// does the other family's coordinate run with this family's u (+1) or against it (-1)? (Z: X = u; X: Z = -u)
export const otherSign = (axis) => (axis === 'Z' ? 1 : axis === 'X' ? -1 : famTheta(axis) + 90 < 180 ? 1 : -1);
// a key's (or a family's) family: 'R45:1.414~-1' -> 'R45'
export const famOfKey = (key) => { const i = key.indexOf(':'); return i < 0 ? key : key.slice(0, i); };
const famOf = (b) => (b.n === 'X' ? 'X' : isTurnedFam(b.n) ? b.n : 'Z');
// a point's place across a family, and along it (u)
export const coord = (axis, p) => { if (axis === 'Z') return p.Z; if (axis === 'X') return p.X; const [s, c] = scOf(axis); return p.X * s + p.Z * c; };
const along = (axis, p) => { if (axis === 'Z') return p.X; if (axis === 'X') return -p.Z; const [s, c] = scOf(axis); return p.X * c - p.Z * s; };
// a world vector turned about the vertical by deg degrees, the way a family's angle grows (front toward the right side)
export function turnVec(v, deg) { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return { X: v.X * c + v.Z * s, Y: v.Y, Z: -v.X * s + v.Z * c }; }
// a turned board may not stand on the ground: its lower end at least TURN_MIN_Y up
export const turnedOnGround = (b) => isTurnedFam(b.n) && Math.min(b.a.Y, b.b.Y) < TURN_MIN_Y;
// a board's own lean: its stored t (a level board's), else what its own ends say
export function leanOf(b) {
  const dy = b.b.Y - b.a.Y;
  if (Math.abs(dy) < 1e-6) return b.t || 0;
  const r = (coord(famOf(b), b.b) - coord(famOf(b), b.a)) / dy;
  return onLeanGrid(r) ? tOfK(kOfT(r)) : r6(r);
}
// the plane a board lies in by its n (its own wall)
export function planeKeyOf(b) {
  const ax = famOf(b), t = leanOf(b), k = kOfT(t);
  return planeKey(ax, coord(ax, b.a) - tOfK(k) * b.a.Y, k);
}
// every plane a board lies in: its own first, and the other family's plane through its line when that plane's lean is
// allowed (the board is not level, and leans across that way by a whole half inch a foot, 7 at most). A post: two
// upright planes; a tapered tower's corner leg: two leaning ones.
export function planesOf(b) {
  const own = planeKeyOf(b), dy = b.b.Y - b.a.Y;
  if (Math.abs(dy) < 1e-6) return [own];
  const ax = otherFam(famOf(b)), r = (coord(ax, b.b) - coord(ax, b.a)) / dy;
  if (!onLeanGrid(r)) return [own];
  const k = kOfT(r);
  return [own, planeKey(ax, coord(ax, b.a) - tOfK(k) * b.a.Y, k)];
}
// a leg: a board lying in two planes (posts included)
export const isLeg = (b) => planesOf(b).length === 2;
// world <-> a plane's own (u, y) (true lengths: y up the slope)
export function toPlane(key, p) {
  const { axis, t } = parseKey(key), s = Math.sqrt(1 + t * t);
  return axis === 'Z' ? { u: p.X, y: p.Y * s } : axis === 'X' ? { u: -p.Z, y: p.Y * s } : { u: along(axis, p), y: p.Y * s };
}
export function fromPlane(key, u, y) {
  const { axis, off, t } = parseKey(key), Y = t ? y / Math.sqrt(1 + t * t) : y;
  if (axis === 'Z') return { X: u, Y, Z: off + t * Y };
  if (axis === 'X') return { X: off + t * Y, Y, Z: -u };
  const [s, c] = scOf(axis), w = off + t * Y;
  return { X: u * c + w * s, Y, Z: -u * s + w * c };
}
// where the plane stands across its family's axis at height Y (its offset there: c + t·Y)
export const offsetAt = (key, Y) => { const { off, t } = parseKey(key); return off + t * Y; };
// the plane's outward unit normal (away from the tower's middle; a plane through the middle: toward +), { X, Y, Z }.
// Which side is out is read where the plane stands at height Y (its ground line, unless told).
export function planeNormal(key, Y = 0) {
  const { axis, t } = parseKey(key), o = offsetAt(key, Y), s = o < -1e-9 ? -1 : 1, l = Math.sqrt(1 + t * t);
  if (axis === 'Z') return { X: 0, Y: -s * t / l, Z: s / l };
  if (axis === 'X') return { X: s / l, Y: -s * t / l, Z: 0 };
  const e = famNormal(axis);
  return { X: s * e.X / l, Y: -s * t / l, Z: s * e.Z / l };
}
// how far the footprint reaches along a plane: u from -half to +half (a turned plane: the base's corners seen along it)
export const planeHalf = (t, key) => {
  if (key[0] === 'Z') return t.W / 2;
  if (key[0] === 'X') return t.D / 2;
  const [s, c] = scOf(famOfKey(key)); return Math.abs(c) * t.W / 2 + Math.abs(s) * t.D / 2;
};
// the upright plane at right angles to `key` through a world point (the plane the view looks along when it sees `key`
// end on: an end moves in it when its board is pushed in or out)
export const crossKey = (key, p) => (key[0] === 'Z' ? planeKey('X', p.X) : key[0] === 'X' ? planeKey('Z', p.Z) : planeKey(otherFam(famOfKey(key)), coord(otherFam(famOfKey(key)), p)));
// the outer plane of face k (upright)
export function facePlane(t, k) { return [planeKey('Z', t.D / 2), planeKey('X', t.W / 2), planeKey('Z', -t.D / 2), planeKey('X', -t.W / 2)][k]; }
// which face an outer plane is (a plane standing on the stones' edge, upright or leaning), or -1 for an inner plane. A
// leaning plane is an outer wall only where it really stands on the stones' line: its boards come down to the ground
// there (a tier's leaning wall, standing on beams 8 ft up, may meet the stones' line only when carried on down: it is
// an inside wall). foot: the height of the foot of a board about to go in it (the board in hand), if any.
export function faceOfPlane(t, key, foot = null) {
  const { axis, off, k: lean } = parseKey(key);
  for (let k = 0; k < 4; k++) {
    const f = parseKey(facePlane(t, k));
    if (f.axis !== axis || r3(f.off) !== r3(off)) continue;
    if (lean) { const y = Math.min(footOfPlane(t, key), foot ?? Infinity); if (Number.isFinite(y) && y > 0.5) return -1; }
    return k;
  }
  return -1;
}
// the height of the lowest board's foot in a plane (Infinity: none in it)
export function footOfPlane(t, key) {
  let Y = Infinity;
  for (const b of t.boards) if (planesOf(b).includes(key)) Y = Math.min(Y, b.a.Y, b.b.Y);
  return Y;
}
// does the plane lean in (toward the tower's middle) as it climbs? +1 in, -1 out, 0 upright. (A plane through the middle
// leans toward a side: -1 there means toward -Z or -X.) Y: the height where its side of the middle is read.
export function leansIn(key, Y = 0) {
  const { k } = parseKey(key); if (!k) return 0;
  const o = offsetAt(key, Y);
  if (Math.abs(o) < 1e-6) return k > 0 ? -1 : 1;
  return Math.sign(o) * k < 0 ? 1 : -1;
}
// is a plane over the footprint? (where it stands at height Y within the stones, or as far out as a lean allows)
export function planeInside(t, key, Y = 0) {
  const { axis } = parseKey(key), half = axis === 'Z' ? t.D / 2 : axis === 'X' ? t.W / 2 : (() => { const [s, c] = scOf(axis); return Math.abs(s) * t.W / 2 + Math.abs(c) * t.D / 2; })();
  return Math.abs(offsetAt(key, Y)) <= half + (parseKey(key).k ? LEAN_MAX / 12 * Y : 0) + 1e-6;
}

// a plane in words: "the front wall", "the right side", ..., or for an inner plane "the inside wall 1½ ft in from the
// front" (short: "1½ ft in from the front"); a leaning one says so: "the front wall, leaning 2 inches in for every foot
// up". Lengths in it are a label's ("1 ft 3 in."): a sentence spells them out with spellUnits.
// An inner plane is named where it stands at its foot (the foot of its lowest board, or of the board given by atY when
// that is lower: one wall, one name, whichever of its boards is asked about), by how far it stands in from the outer
// wall nearer it there (that wall as it stands at that height, leaning or not; the stones' edge where none is built),
// or "out past" it. A leaning inner plane says which way it leans: "leaning 2 inches in for every foot up" when it leans
// with the outer wall it is named from (the two parallel), else toward which side ("leaning 2 inches toward the back
// for every foot up"), so
// the words never flip while its lean stays the same.
export function planeName(t, key, short = false, atY = null) {
  const k = faceOfPlane(t, key, atY), { axis, k: lean } = parseKey(key);
  let words;
  if (isTurnedFam(axis)) {
    // a turned wall: by the corner of the tower its outward side faces, and its turn ("the turned wall at the front
    // right, turned 45°"); one through the middle "through the middle"
    let Y = Math.min(footOfPlane(t, key), atY ?? Infinity); if (!Number.isFinite(Y)) Y = 0;
    const o = offsetAt(key, Y), th = famTheta(axis), deg = Math.min(th, 180 - th);
    const at = Math.abs(o) < 0.02 ? 'through the middle' : 'at the ' + cornerWords(o < 0 ? -1 : 1, axis);
    words = (short ? 'turned wall ' : 'the turned wall ') + at + `, turned ${deg}°`;
    return lean ? words + ', ' + leanWords(t, key, Y) : words;
  }
  if (k >= 0) {
    words = short ? ['front wall', 'right side', 'back wall', 'left side'][k] : ['the front wall', 'the right side', 'the back wall', 'the left side'][k];
    return lean ? words + ', ' + leanWords(t, key, 0) : words;
  }
  let Y = Math.min(footOfPlane(t, key), atY ?? Infinity); if (!Number.isFinite(Y)) Y = 0;
  const half = axis === 'Z' ? t.D / 2 : t.W / 2, o = offsetAt(key, Y);
  // (each side: the outer wall there, as it stands at height Y; how far in from it this plane stands)
  const sides = [1, -1].map((sg) => {
    const f = axis === 'Z' ? (sg > 0 ? 0 : 2) : (sg > 0 ? 1 : 3), ws = faceWalls(t, f);
    const there = ws.find((w) => { const lo = footOfPlane(t, w); let hi = -Infinity; for (const sgm of planeSegments(t, w)) hi = Math.max(hi, sgm.ay, sgm.by); return lo <= Y + 0.25 && hi / Math.sqrt(1 + parseKey(w).t ** 2) >= Y - 0.25; }) || ws[0] || null;
    const at = there ? offsetAt(there, Y) : sg * half;
    return { sg, wall: there, d: sg * (at - o), name: axis === 'Z' ? (sg > 0 ? 'front' : 'back') : (sg > 0 ? 'right side' : 'left side') };
  });
  const mid = Math.abs(sides[0].d - sides[1].d) < 1e-3, side = Math.abs(sides[0].d) <= Math.abs(sides[1].d) ? sides[0] : sides[1];
  // (standing right on that wall's line there, to a quarter inch: a tier's wall rising from the front crosspiece)
  const w = mid ? `halfway between the ${axis === 'Z' ? 'front and back' : 'two sides'}` : Math.abs(side.d) < 0.02 && (lean || side.wall) ? `at the ${side.name}`
    : side.d < -1e-6 ? `${spoken(-side.d)} out past the ${side.name}` : `${spoken(side.d)} in from the ${side.name}`;
  // (a plane standing out past the outer wall is no inside wall: "the wall 1½ ft out past the front")
  words = short ? w : (/ out past the /.test(w) ? 'the wall ' : 'the inside wall ') + w;
  if (!lean) return words;
  const toward = `leaning ${leanRate(lean, `toward the ${axis === 'Z' ? (lean > 0 ? 'front' : 'back') : (lean > 0 ? 'right side' : 'left side')}`)}`;
  return words + ', ' + (!mid && side.wall && parseKey(side.wall).k === lean ? leanWords(t, side.wall, 0) : toward);
}
// a length in a wall's name, the way a label writes it: "1½ ft", "2 ft", "1 ft 3 in.", and inches alone "9 inches"
// ("9 in in from the front" reads badly). A sentence spells it all out (spellUnits).
const spoken = (ft) => lenLabel(ft).replace(/^(\d+) in\.$/, (m, n) => `${n} ${n === '1' ? 'inch' : 'inches'}`);
// the lean of a plane in words: "leaning 2 inches in for every foot up", "leaning ½ inch out for every foot up", for a
// plane through the middle "leaning 1 inch toward the back for every foot up"
// which corner of the tower a turned family's normal points to, sg times e(θ): "front right", "back left", ...
export function cornerWords(sg, axis) {
  const e = famNormal(axis);
  return (sg * e.Z > 0 ? 'front' : 'back') + ' ' + (sg * e.X > 0 ? 'right' : 'left');
}
export function leanWords(t, key, Y = 0) {
  const { axis, k } = parseKey(key); if (!k) return 'upright';
  const dir = leansIn(key, Y), o = offsetAt(key, Y);
  if (isTurnedFam(axis) && Math.abs(o) < 1e-3) return `leaning ${leanRate(k, `toward the ${cornerWords(k > 0 ? 1 : -1, axis)}`)}`;
  if (Math.abs(o) < 1e-3) return `leaning ${leanRate(k, `toward the ${axis === 'Z' ? (k > 0 ? 'front' : 'back') : (k > 0 ? 'right side' : 'left side')}`)}`;
  return `leaning ${leanRate(k, dir > 0 ? 'in' : 'out')}`;
}
// every board lying in a plane (posts and legs in it included), in that plane's own coordinates:
// [{ id, ax, ay, bx, by, len, post, leg, corner, src }]
export function planeSegments(t, key) {
  const out = [];
  for (const b of t.boards) {
    const ps = planesOf(b); if (!ps.includes(key)) continue;
    const A = toPlane(key, b.a), B = toPlane(key, b.b);
    out.push({ id: b.id, ax: A.u, ay: A.y, bx: B.u, by: B.y, len: b.len, post: isPost(b), leg: ps.length === 2, corner: isCornerPost(t, b), src: b });
  }
  return out;
}
// The WALLS in use: every upright plane any board lies in (as before walls could lean), and the leaning planes that are
// some board's own wall, or the second wall of a leg whose own wall leans (a tapered tower's corner legs). A steep
// brace in an upright wall that happens to slant by a whole half inch a foot lies in a leaning plane too, but nothing
// else is built there, so it is no wall: building near it goes on as it always did. -> Set of keys
// A board in a leaning wall whose slant along that wall happens to be a lean a wall can have lies in a second leaning
// plane too: it is a corner LEG there only when that plane could be a wall at its foot. Where another LEANING plane of
// that family, with another lean, already passes through its foot with a board there going on up (a brace swung from a corner of
// a lean-out tower toward the back, where the front wall leans out), the stronger plane is the wall and the board is a
// brace in its own wall, not a leg in a wall of its own. Stronger: some board's own wall, then the one more boards lie
// in, then the more upright. (An upright wall at its foot doesn't count: a leg may lean in on top of a straight
// level's corner post.)
export function wallsInUse(t) {
  const s = new Set(), str = planeStrength(t);
  for (const b of t.boards) {
    const ps = planesOf(b), ownLeans = parseKey(ps[0]).k !== 0;
    ps.forEach((k, i) => { if (i === 0 || !parseKey(k).k || (ownLeans && !clashAtFoot(t, k, b, str))) s.add(k); });
  }
  return s;
}
// how strongly a plane is a wall: 1000 if it is some board's own wall, plus the number of boards lying in it
function planeStrength(t) {
  const own = new Set(), all = new Map();
  for (const o of t.boards) { const ps = planesOf(o); own.add(ps[0]); for (const k of ps) all.set(k, (all.get(k) || 0) + 1); }
  return (k) => (own.has(k) ? 1000 : 0) + (all.get(k) || 0);
}
// does a stronger leaning plane of `key`'s family (another lean) pass through the foot (the lower end) of board b, with
// a board there going on up past it? (A wall that only ENDS there, the level below's, is no clash: the next level's legs
// may lean another way, steeper or less, from its top.)
export function clashAtFoot(t, key, b, str = planeStrength(t)) {
  const { axis, k } = parseKey(key), f = b.a.Y <= b.b.Y ? b.a : b.b, sk = str(key);
  for (const o of t.boards) {
    if (o === b || o.id === b.id || segGap(o, f) > 0.25 || Math.max(o.a.Y, o.b.Y) < f.Y + 0.5) continue;
    for (const w of planesOf(o)) {
      const q = parseKey(w);
      if (w === key || q.axis !== axis || !q.k || q.k === k || Math.abs(offsetAt(w, f.Y) - coord(axis, f)) > 1e-3) continue;
      const sw = str(w);
      if (sw > sk || (sw === sk && Math.abs(q.k) < Math.abs(k))) return true;
    }
  }
  return false;
}
// how far a point is from a board's centre line (feet)
function segGap(o, p) {
  const dx = o.b.X - o.a.X, dy = o.b.Y - o.a.Y, dz = o.b.Z - o.a.Z, L2 = dx * dx + dy * dy + dz * dz;
  const s = L2 ? Math.max(0, Math.min(1, ((p.X - o.a.X) * dx + (p.Y - o.a.Y) * dy + (p.Z - o.a.Z) * dz) / L2)) : 0;
  return Math.hypot(o.a.X + dx * s - p.X, o.a.Y + dy * s - p.Y, o.a.Z + dz * s - p.Z);
}
// the second wall a board makes it a leg in, or null: its second plane (planesOf) when that is upright (a post), or
// when its own wall leans and no leaning wall with another lean stands at its foot (as wallsInUse counts it)
export function secondWall(t, b) {
  const ps = planesOf(b); if (ps.length < 2) return null;
  if (!parseKey(ps[1]).k) return ps[1];
  return parseKey(ps[0]).k && !clashAtFoot(t, ps[1], b) ? ps[1] : null;
}
// the planes a board lies in that are walls (its own always)
export function wallPlanesOf(t, b, walls = wallsInUse(t)) { return planesOf(b).filter((k, i) => i === 0 || walls.has(k)); }
// a board drawn and treated as a line where two walls meet: a post, or a leg whose two planes are both walls
export const isCornerLine = (t, b, walls) => isPost(b) || wallPlanesOf(t, b, walls).length === 2;
// the walls in use standing on face k's line of stones (upright or leaning), the upright one first if it is there
export function faceWalls(t, k) {
  const out = [...wallsInUse(t)].filter((key) => faceOfPlane(t, key) === k);
  return out.sort((a, b) => Math.abs(parseKey(a).k) - Math.abs(parseKey(b).k));
}
// a board's u on a plane's segment at in-plane height y (a leg's place across its wall at that height)
const uAt = (s, y) => (Math.abs(s.by - s.ay) < 1e-9 ? (s.ax + s.bx) / 2 : s.ax + (s.bx - s.ax) * (y - s.ay) / (s.by - s.ay));
// How wide the wall is that a board on plane `key` stands in, at its height: the span between the posts (or the legs
// where two walls meet) standing in that plane either side of its middle, over the height it spans (a 2 × 3 tier's
// front wall is 2 ft wide even though its plane crosses the whole 6 ft base; a 1 × 1 top's walls are 1 ft; a tapered
// wall is as wide as its legs are apart at the board's middle). The plane's full width if no posts bracket it.
// s: the board on the plane, { ax, ay, bx, by }.
export function wallSpan(t, key, s) {
  const lo = Math.min(s.ay, s.by), hi = Math.max(s.ay, s.by), m = (s.ax + s.bx) / 2, ym = (s.ay + s.by) / 2, walls = wallsInUse(t);
  let L = -Infinity, R = Infinity;
  for (const p of planeSegments(t, key)) {
    if (!(p.post || (p.leg && isCornerLine(t, p.src, walls))) || Math.min(p.ay, p.by) > hi - 0.1 || Math.max(p.ay, p.by) < lo + 0.1) continue;
    const u = p.post ? p.ax : uAt(p, Math.max(Math.min(p.ay, p.by), Math.min(Math.max(p.ay, p.by), ym)));
    if (u <= m) L = Math.max(L, u);
    if (u >= m) R = Math.min(R, u);
  }
  return Number.isFinite(L) && Number.isFinite(R) && R - L > 0.25 ? R - L : planeHalf(t, key) * 2;
}
// where boards that cross a plane pass through it (a beam running in from the front crosspiece crosses every plane of
// the other kind it spans; a post in the middle crosses a leaning wall at one height): [{ u, y, t (feet along that
// board from its a end), src }]. Boards lying in the plane, and boards parallel to it, don't cross it.
export function crossings(t, key) {
  // (g: a point's place across the plane's family, less the lean's share of its height: the plane is g = off)
  const out = [], { axis, off, t: lean } = parseKey(key), g = (p) => coord(axis, p) - lean * p.Y;
  for (const b of t.boards) {
    if (planesOf(b).includes(key)) continue;
    const ga = g(b.a), gb = g(b.b);
    if (Math.abs(ga - gb) < 1e-6) continue;
    const s = (off - ga) / (gb - ga);
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
// up the slope) and len feet long -> { a, b, len, n, t? } in the world (n: the plane's kind, so its wide face lies flat
// on the plane; t: the plane's lean, only when it leans)
export function boardOnPlane(key, u, y, ang, len) {
  const a = roundPt(fromPlane(key, u, y)), b = roundPt(fromPlane(key, u + Math.cos(ang) * len, y + Math.sin(ang) * len)), { t, axis } = parseKey(key);
  return t ? { a, b, len, n: axis, t } : { a, b, len, n: axis };
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
// a board from its two ends (rounded so equal planes compare equal). t: its wall's lean (kept only when it leans). A
// board that is not level is squared up onto its own wall (its b end's place across the wall worked out from its a end
// with the lean as stored), so a·n - t·a.Y equals b·n - t·b.Y to the millionth; a leg (leg: true) onto its other wall
// as well. (An upright wall's board is left exactly as given.)
export function makeBoard(id, a, b, n, len, t = 0, leg = false) {
  const A = roundPt(a), B = roundPt(b), ax = n === 'X' ? 'X' : isTurnedFam(n) ? n : 'Z', other = otherFam(ax), dy = B.Y - A.Y;
  let lean = t ? tOfK(kOfT(t)) : 0;
  // (squared up onto a wall: its coordinate there set to what it should be. A turned wall's is no single X or Z: the
  // end moves along that wall's normal, then rounds)
  const setC = (fam, want) => {
    if (!isTurnedFam(fam)) { B[fam] = r6(want); return; }
    const e = famNormal(fam), d = want - coord(fam, B); B.X = r6(B.X + e.X * d); B.Z = r6(B.Z + e.Z * d);
  };
  if (Math.abs(dy) > 1e-6) {
    const r = (coord(ax, B) - coord(ax, A)) / dy;
    if (onLeanGrid(r)) { lean = tOfK(kOfT(r)); if (lean) setC(ax, coord(ax, A) + lean * dy); } else lean = r6(r);
    if (leg) { const r2 = (coord(other, B) - coord(other, A)) / dy; if (onLeanGrid(r2) && kOfT(r2)) setC(other, coord(other, A) + tOfK(kOfT(r2)) * dy); }
  }
  const out = { id, a: A, b: B, len: len ?? Math.hypot(B.X - A.X, B.Y - A.Y, B.Z - A.Z), n };
  if (lean) out.t = lean;
  return out;
}

// ── twins: where a board just nailed would be matched round the tower ────────────────────────────────────────────────
// The wind comes from every side, so a builder wants the same board on every wall. The twins are the board's images under
// the footprint's own symmetries about the tower's middle (as v2's were, now in world coordinates):
//   a wall board  -> the opposite wall: its mirror image ((X, Y, Z) -> (X, Y, -Z) for a Z-plane board, (-X, Y, Z) for an
//                    X-plane one), and on a square base also the two walls round the corner: a quarter turn and the
//                    mirror across the diagonal (n swaps X <-> Z), the ones v2 offered (front and right side carry the
//                    board as it is, seen from outside; back and left side its mirror image)
//   a post or leg -> its three mirror images (mirror X, mirror Z, both): the diagonally opposite one faces the same way,
//                    the two beside it are turned a quarter (as the four would be if the tower were turned round), so a
//                    tower built from twins is about equally stiff both ways
// A wall's lean goes with it: the image of a wall leaning in leans in on the opposite wall (a mirror turns a Z-plane's
// t to -t; the quarter turns carry the lean into the other family).
//   a board in a TURNED wall (any board: wall boards, posts and legs alike) -> its images under the quarter turns about
//                    the tower's middle (a quarter, a half, three quarters) on a square base, the half turn alone on an
//                    oblong one: a turned square inside the level below is matched round by turning it, and the lean
//                    turns with it (a wall leaning in leans in on every side).
// An image that leaves the footprint, lands on itself, or touches nothing is not offered.
// Returns [{ a, b, len, n, t? }], the opposite one first, not yet checked for wood.
const swapN = (n) => (n === 'X' ? 'Z' : 'X');
export function twinsOf(t, board, touches = (g) => touchesAny(g, t.boards)) {
  // (a leg where two walls meet is matched like a post; once any wall leans, a board may stand out past the stones as
  // far as a lean allows: a crosspiece across legs leaning out reaches past them)
  const walls = wallsInUse(t), out = [], square = Math.abs(t.W - t.D) < 1e-6, leg = isCornerLine(t, board, walls), lean = leanOf(board);
  const leans = [...walls].some((k) => parseKey(k).k !== 0);
  const unit = { X: { X: 1, Y: 0, Z: 0 }, Z: { X: 0, Y: 0, Z: 1 } }, turned = isTurnedFam(board.n);
  // the image under f (a linear map of the ground), its n given; its lean: a level board's by where f sends its wall's
  // normal, any other by its own ends
  const img = (f, n) => {
    const a = roundPt(f(board.a)), b = roundPt(f(board.b)), g = { a, b, len: board.len, n };
    let tt;
    if (Math.abs(b.Y - a.Y) > 1e-6) { const r = (coord(n, b) - coord(n, a)) / (b.Y - a.Y); tt = onLeanGrid(r) ? tOfK(kOfT(r)) : r6(r); }
    else {
      const e = f(turned ? famNormal(board.n) : unit[famOf(board)]);
      if (!isTurnedFam(n)) tt = r6(lean * (n === 'X' ? e.X : e.Z));
      else { const q = famNormal(n); tt = r6(lean * (e.X * q.X + e.Z * q.Z)); }
      // (a horizontal twin lying right along a wall of its family that stands there with another lean, at its height,
      // takes that wall's lean, as one slid in by hand would: a beam's quarter-turned twin where a narrower level's
      // leaning front wall stands)
      const there = [...walls].filter((w) => famOfKey(w) === n && Math.abs(offsetAt(w, a.Y) - coord(n, a)) < 1e-3).map((w) => parseKey(w).t);
      if (there.length && !there.includes(tt)) tt = there.find((x) => x) ?? tt;
    }
    if (tt) g.t = tt;
    return g;
  };
  const mX = (p) => ({ X: -p.X, Y: p.Y, Z: p.Z }), mZ = (p) => ({ X: p.X, Y: p.Y, Z: -p.Z });
  if (turned) {
    // (the quarter turns: (X, Z) -> (Z, -X) is a quarter of the way round, as a family's angle grows by 90)
    const q1 = (p) => ({ X: p.Z, Y: p.Y, Z: -p.X }), q2 = (p) => mZ(mX(p)), q3 = (p) => ({ X: -p.Z, Y: p.Y, Z: p.X });
    const th = famTheta(board.n);
    out.push(img(q2, board.n));
    if (square) out.push(img(q1, famAt(th + 90)), img(q3, famAt(th + 270)));
  } else if (leg) {
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
    if (!inFootprint(t, g.a, leans) || !inFootprint(t, g.b, leans)) continue;
    // (an image on an outer wall's line of stones where a wall already stands with another lean is no twin: the front
    // and back walls lean out, the sides stand upright, and a side's crosspiece turned a quarter would hang in the air
    // inside the back wall)
    const own = planeKeyOf(g), f = faceOfPlane(t, own);
    if (f >= 0) { const there = [...walls].filter((k) => faceOfPlane(t, k) === f); if (there.length && !there.includes(own)) continue; }
    if (touches && !touches(g)) continue;
    kept.push(g);
  }
  return kept;
}
const near = (p, q) => Math.abs(p.X - q.X) < 1e-4 && Math.abs(p.Y - q.Y) < 1e-4 && Math.abs(p.Z - q.Z) < 1e-4;
// is a point over the stones? (on the ground: within them; higher up, as far out past them as the steepest lean allows,
// 7 in for every foot up. lean false: within the stones at any height, for a board in upright walls)
export const inFootprint = (t, p, lean = true) => {
  const more = lean ? LEAN_MAX / 12 * Math.max(0, p.Y) : 0;
  return Math.abs(p.X) <= t.W / 2 + more + 1e-4 && Math.abs(p.Z) <= t.D / 2 + more + 1e-4;
};

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
