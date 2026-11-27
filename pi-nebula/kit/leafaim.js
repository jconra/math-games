// AIMED LEAVES (no three.js here: kit/layout.js leafMatrix poses a leaf by it, and the tests by the same code).
// A door leaf may ride a LINE whose two ends each move as its door opens, turning as the line turns and keeping to it:
// a landing leg from its hip to its ankle, its cylinder riding the hip and its foot the ankle, so the foot's piston
// slides in the cylinder and never leaves it; a brace from its mount on the hull to a point on its leg, so the brace
// never leaves the leg. The game's maker: "Its fine if the landing gear is kind of magic and folds into itself": so a
// leaf may also STRETCH with its line, shortening into itself as one piece as its line shortens (a brace whose ends
// come together as it folds; a cylinder sliding up over its piston). The kit's other leaves slide and swing by amounts
// proportional to their eased t; a line's turn and length follow from where its ends are, which no slide or swing can.
//
// aim: { a, b: the line's ends where the leaf stands shut, in its piece's frame: each a point [x, y, z], or a point on
//          another line { on: (an aim's line), at: (metres from that line's b end toward its a end) }, riding with it
//        av, bv: how far a and b move, fully open: [x, y, z] (straight, in step with the eased t), or a WAY of several
//          straight legs [[e, [x, y, z]], ...] (where the end is, from where it stands shut, by each share e of the
//          eased t, in order, the last at 1: so an end can go along under the hull before it goes up into a well); none
//          if not given. A point on another line moves with it
//        from: 'a' | 'b', at: the leaf's own point that rides, `at` metres from that end toward the other; or
//        frac: the point that share of the way from a to b (a part riding between)
//        stretch: (if given) the leaf stretches along the line about the point that rides, so that what stood
//          `stretch` metres short of the far end stays that far short of it: 0, a part that reaches the far end and
//          keeps reaching it (a brace on its knuckle); more, a cylinder whose open end keeps that far over the ankle }
// The leaf turns by the shortest turn that takes the line's direction shut to its direction now, about that point.
// Nothing here makes a new array once a leaf has been posed once (a fold moves dozens of leaves every frame): what is
// worked out shut is kept on the aim, the rest in a few arrays made once.

// (scratch: a pair of points for each depth of a point riding a line riding a line; Math.sqrt, not Math.hypot, which
// may gather its arguments into a new array)
const POOL = Array.from({ length: 4 }, () => [new Float64Array(3), new Float64Array(3)]);
const _a = new Float64Array(3), _b = new Float64Array(3), _r = new Float64Array(3), _d = new Float64Array(3), _k = new Float64Array(3);
const _R = new Float64Array(9), _M = new Float64Array(9), _out = new Float64Array(16);

// the way an end has gone, e of the way, added to out
function addWay(out, v, e) {
  if (typeof v[0] === 'number') { out[0] += v[0] * e; out[1] += v[1] * e; out[2] += v[2] * e; return; }
  let e0 = 0, x = 0, y = 0, z = 0;
  for (let i = 0; i < v.length; i++) {
    const ek = v[i][0], q = v[i][1];
    if (e <= ek) { const f = ek > e0 ? (e - e0) / (ek - e0) : 1; out[0] += x + (q[0] - x) * f; out[1] += y + (q[1] - y) * f; out[2] += z + (q[2] - z) * f; return; }
    e0 = ek; x = q[0]; y = q[1]; z = q[2];
  }
  out[0] += x; out[1] += y; out[2] += z;
}
// an end of a line e of the way, into out
function endInto(out, P, v, e, depth) {
  if (Array.isArray(P)) { out[0] = P[0]; out[1] = P[1]; out[2] = P[2]; if (v) addWay(out, v, e); return out; }
  return pointOnInto(out, P.on, P.at, e, depth + 1);
}
// the point `at` metres from a line's b end toward its a end, e of the way, into out
function pointOnInto(out, L, at, e, depth = 0) {
  const a = POOL[depth][0], b = POOL[depth][1];
  endInto(a, L.a, L.av, e, depth); endInto(b, L.b, L.bv, e, depth);
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2], l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  out[0] = b[0] + dx / l * at; out[1] = b[1] + dy / l * at; out[2] = b[2] + dz / l * at;
  return out;
}
// the line's ends e of the way (new arrays: for the tests and the plan, not for every frame)
export function lineAt(L, e) { return [Array.from(endInto(new Float64Array(3), L.a, L.av, e, 0)), Array.from(endInto(new Float64Array(3), L.b, L.bv, e, 0))]; }
export function pointOn(L, at, e) { return Array.from(pointOnInto(new Float64Array(3), L, at, e)); }
// the line's ends into a and b, its unit direction a to b into d; returns its length
function lineInto(A, e, a, b, d) {
  endInto(a, A.a, A.av, e, 0); endInto(b, A.b, A.bv, e, 0);
  d[0] = b[0] - a[0]; d[1] = b[1] - a[1]; d[2] = b[2] - a[2];
  const l = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) || 1; d[0] /= l; d[1] /= l; d[2] /= l;
  return l;
}
// the point that rides, into out
function riderInto(out, A, a, b, d, l) {
  if (A.frac != null) { for (let i = 0; i < 3; i++) out[i] = a[i] + d[i] * l * A.frac; return out; }
  const s = A.at || 0;
  if (A.from === 'b') for (let i = 0; i < 3; i++) out[i] = b[i] - d[i] * s;
  else for (let i = 0; i < 3; i++) out[i] = a[i] + d[i] * s;
  return out;
}
// (what the leaf is drawn at: its line shut, kept on the aim the first time it is posed)
function shutOf(A) {
  if (A._shut) return A._shut;
  const a = new Float64Array(3), b = new Float64Array(3), d = new Float64Array(3), l = lineInto(A, 0, a, b, d);
  return (A._shut = { d, l, r: riderInto(new Float64Array(3), A, a, b, d, l) });
}
// the 4x4 matrix (column-major, three.js's Matrix4 elements) that takes the leaf as drawn to where it is e of the way,
// into out (a 16-long array; a shared one if not given)
export function aimMatrix(A, e, out = _out) {
  const S = shutOf(A), l = lineInto(A, e, _a, _b, _d), d0 = S.d;
  riderInto(_r, A, _a, _b, _d, l);
  // the turn (rows) that takes d0 to d the shortest way
  const kx = d0[1] * _d[2] - d0[2] * _d[1], ky = d0[2] * _d[0] - d0[0] * _d[2], kz = d0[0] * _d[1] - d0[1] * _d[0];
  const s = Math.sqrt(kx * kx + ky * ky + kz * kz), c = d0[0] * _d[0] + d0[1] * _d[1] + d0[2] * _d[2];
  if (s < 1e-12) {
    if (c < 0) throw new Error('kit: an aimed leaf turned right round');
    _R.fill(0); _R[0] = _R[4] = _R[8] = 1;
  } else {
    const x = kx / s, y = ky / s, z = kz / s, C = 1 - c;
    _R[0] = c + x * x * C; _R[1] = x * y * C - z * s; _R[2] = x * z * C + y * s;
    _R[3] = y * x * C + z * s; _R[4] = c + y * y * C; _R[5] = y * z * C - x * s;
    _R[6] = z * x * C - y * s; _R[7] = z * y * C + x * s; _R[8] = c + z * z * C;
  }
  // the stretch along the line shut (I + (k - 1) d0 d0'), then the turn: M = R S
  const g = A.stretch != null ? (l - A.stretch) / (S.l - A.stretch) - 1 : 0;
  for (let i = 0; i < 3; i++) {
    const rd = _R[i * 3] * d0[0] + _R[i * 3 + 1] * d0[1] + _R[i * 3 + 2] * d0[2];
    for (let j = 0; j < 3; j++) _M[i * 3 + j] = _R[i * 3 + j] + g * rd * d0[j];
  }
  // p -> r + M (p - r0): column j of M, and the move r - M r0
  const r0 = S.r;
  for (let j = 0; j < 3; j++) { out[j * 4] = _M[j]; out[j * 4 + 1] = _M[3 + j]; out[j * 4 + 2] = _M[6 + j]; out[j * 4 + 3] = 0; }
  for (let i = 0; i < 3; i++) out[12 + i] = _r[i] - (_M[i * 3] * r0[0] + _M[i * 3 + 1] * r0[1] + _M[i * 3 + 2] * r0[2]);
  out[15] = 1;
  return out;
}
// where a point p of the leaf (drawn shut) is, e of the way (a new array: for the tests)
export function aimPoint(A, p, e) {
  const m = aimMatrix(A, e, new Float64Array(16));
  return [0, 1, 2].map((i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]);
}

// A LEAF THAT FOLDS INTO A LINE (a gear well's door, by the same magic: it shrinks across a line at its frame's edge,
// into the frame, as it opens, and grows back flush as it shuts): fold { at: a point on the line, along: its unit
// direction, from, to: how much of its width across the line it keeps at t 0 and at t 1 (eased) }. The 4x4 matrix
// (column-major) into out.
export function foldMatrix(F, e, out = _out) {
  const f = F.from + (F.to - F.from) * e, u = F.along, p = F.at;
  // M = u u' + f (I - u u'); move p - M p
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) _M[i * 3 + j] = u[i] * u[j] * (1 - f) + (i === j ? f : 0);
  for (let j = 0; j < 3; j++) { out[j * 4] = _M[j]; out[j * 4 + 1] = _M[3 + j]; out[j * 4 + 2] = _M[6 + j]; out[j * 4 + 3] = 0; }
  for (let i = 0; i < 3; i++) out[12 + i] = p[i] - (_M[i * 3] * p[0] + _M[i * 3 + 1] * p[1] + _M[i * 3 + 2] * p[2]);
  out[15] = 1;
  return out;
}
export function foldPoint(F, p, e) {
  const m = foldMatrix(F, e, new Float64Array(16));
  return [0, 1, 2].map((i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]);
}
