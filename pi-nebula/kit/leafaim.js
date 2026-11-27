// AIMED LEAVES (no three.js here: kit/layout.js leafMatrix poses a leaf by it, and the tests by the same code).
// A door leaf may ride a LINE whose two ends each move straight as its door opens, turning as the line turns and
// keeping to it: a landing leg from its hip to its ankle, each stage of it riding one end (or a share of the way along),
// so the stages slide in and out of each other along the leg and never leave each other; a brace from its mount on the
// hull to a point on its leg, its sleeve riding the mount and its rod the leg, so the rod never leaves the sleeve and
// the brace never leaves the leg. The kit's other leaves slide and swing by amounts proportional to their eased t; a
// line's ends move so too, but the line's turn and length follow from where its ends are, which no slide or swing can.
//
// aim: { a, b: the line's ends where the leaf stands shut, in its piece's frame: each a point [x, y, z], or a point on
//          another line { on: (an aim's line), at: (metres from that line's b end toward its a end) }, riding with it
//        av, bv: how far a and b move, fully open ([x, y, z]; none if not given; a point on another line moves with it)
//        from: 'a' | 'b', at: the leaf's own point that rides, `at` metres from that end toward the other; or
//        frac: the point that share of the way from a to b (a stage riding between) }
// The leaf turns by the shortest turn that takes the line's direction shut to its direction now, about that point.
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const mul = (p, k) => [p[0] * k, p[1] * k, p[2] * k];
const len = (p) => Math.hypot(p[0], p[1], p[2]);
const unit = (p) => mul(p, 1 / (len(p) || 1));
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];

// an end of a line e of the way (e: the door's eased t)
export function endAt(P, v, e) {
  if (Array.isArray(P)) return v ? add(P, mul(v, e)) : P;
  return pointOn(P.on, P.at, e);
}
// the line's ends e of the way
export function lineAt(L, e) { return [endAt(L.a, L.av, e), endAt(L.b, L.bv, e)]; }
// the point `at` metres from a line's b end toward its a end, e of the way
export function pointOn(L, at, e) { const [a, b] = lineAt(L, e); return add(b, mul(unit(sub(a, b)), at)); }
// the point on the line that rides (the aim's from/at, or frac)
function riderAt(A, e) {
  const [a, b] = lineAt(A, e);
  if (A.frac != null) return add(a, mul(sub(b, a), A.frac));
  return A.from === 'b' ? add(b, mul(unit(sub(a, b)), A.at || 0)) : add(a, mul(unit(sub(b, a)), A.at || 0));
}
// the turn (a 3x3, rows) that takes unit d0 to unit d by the shortest way
function turnBetween(d0, d) {
  const k = cross(d0, d), s = len(k), c = dot(d0, d);
  if (s < 1e-12) return c > 0 ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]] : null;
  const [x, y, z] = mul(k, 1 / s), C = 1 - c;
  return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]];
}
// where a point p of the leaf (drawn shut) is, e of the way
export function aimPoint(A, p, e) {
  const [a0, b0] = lineAt(A, 0), [a, b] = lineAt(A, e), R = turnBetween(unit(sub(b0, a0)), unit(sub(b, a)));
  if (!R) throw new Error('kit: an aimed leaf turned right round');
  const r0 = riderAt(A, 0), r = riderAt(A, e), q = sub(p, r0);
  return add(r, [dot(R[0], q), dot(R[1], q), dot(R[2], q)]);
}
// the same as a 4x4 matrix, column-major (three.js's Matrix4 elements)
export function aimMatrix(A, e) {
  const o = aimPoint(A, [0, 0, 0], e), x = sub(aimPoint(A, [1, 0, 0], e), o), y = sub(aimPoint(A, [0, 1, 0], e), o), z = sub(aimPoint(A, [0, 0, 1], e), o);
  return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, o[0], o[1], o[2], 1];
}
