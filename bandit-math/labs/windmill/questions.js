// THE MATH, NOW AND THEN: when a board just nailed up closes a triangle with two others (or with the ground), the miller
// may ask one question about that very triangle. Two kinds:
//   angle   the three corners of any triangle add up to 180 degrees: two are shown, find the third
//   length  a right-angled triangle whose sides are whole feet (3-4-5, 6-8-10, 5-12-13, 8-15-17): two sides are shown,
//           find the third (most often where the brace lands: how far along the other board)
// And one about the tower's own size: when a horizontal board closes an opening (posts both sides, the ground or a
// horizontal board under it) whose width and height are the short sides of a whole-number right triangle, how long a
// brace reaches from corner to corner (the stones set 3 feet apart and a horizontal board 4 feet up make a 5 foot brace).
// And one about a slanting board itself (reachQuestion): how high it reaches, its top so far over from its foot.
// The triangles are found in the world (any three boards, or two and the ground, that meet each other at three spots)
// and drawn flat in their own plane. Pure functions (no page, no three.js) so node can test them.
import { touch3, TOL } from './touch.js';
import { lenWords, lenLabel, isPost, isCornerPost } from './tower.js';

export const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17]];
const d3 = (p, q) => Math.hypot(p.X - q.X, p.Y - q.Y, p.Z - q.Z);
const sub = (p, q) => ({ X: p.X - q.X, Y: p.Y - q.Y, Z: p.Z - q.Z });
const dot = (u, v) => u.X * v.X + u.Y * v.Y + u.Z * v.Z;
const crs = (u, v) => ({ X: u.Y * v.Z - u.Z * v.Y, Y: u.Z * v.X - u.X * v.Z, Z: u.X * v.Y - u.Y * v.X });
const unit = (u) => { const l = Math.hypot(u.X, u.Y, u.Z) || 1; return { X: u.X / l, Y: u.Y / l, Z: u.Z / l }; };
// what a side of a triangle is, for the words: { ground, post, corner, level }
const kindOf = (t, o) => (!o ? { ground: true } : { post: isPost(o), corner: isCornerPost(t, o), level: Math.abs(o.a.Y - o.b.Y) < 0.05 * (o.len || 1) });
// where two sides meet: two boards (touch3), a board and the ground (its end on the ground)
function meet(p, q) {
  if (!p && !q) return [];
  if (!p || !q) { const o = p || q; return [o.a, o.b].filter((e) => e.Y <= TOL).map((e) => ({ X: e.X, Y: 0, Z: e.Z })); }
  return touch3(p, q);
}
// the triangles a new board makes: [{ pts: [P (new & a), Q (new & b), R (a & b)] (flat, in the triangle's own plane:
// x level, y up), a, b (what the other two sides are: { ground, post, corner, level }) }]
export function trianglesOf(t, me) {
  const others = [...t.boards.filter((o) => o !== me && o.id !== me.id), null];
  const hits = [];
  for (const o of others) for (const c of meet(me, o)) hits.push({ o, P: { X: c.X, Y: c.Y, Z: c.Z } });
  const out = [];
  for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
    const A = hits[i], B = hits[j];
    if (A.o === B.o) continue;
    for (const c of meet(A.o, B.o)) {
      const P = A.P, Q = B.P, R = { X: c.X, Y: c.Y, Z: c.Z };
      const n = crs(sub(Q, P), sub(R, P)), area = Math.hypot(n.X, n.Y, n.Z) / 2;
      if (area < 0.8 || Math.min(d3(P, Q), d3(Q, R), d3(R, P)) < 0.9) continue;
      // (flat in its own plane: x along the level line in it, y up it; a triangle lying flat: x along the new board)
      const N = unit(n);
      let e1 = crs({ X: 0, Y: 1, Z: 0 }, N);
      e1 = Math.hypot(e1.X, e1.Y, e1.Z) < 0.1 ? unit(sub(Q, P)) : unit(e1);
      let e2 = crs(N, e1); if (e2.Y < 0) e2 = { X: -e2.X, Y: -e2.Y, Z: -e2.Z };
      const flat = (p) => ({ x: dot(sub(p, P), e1), y: dot(sub(p, P), e2) });
      out.push({ pts: [flat(P), flat(Q), flat(R)], a: kindOf(t, A.o), b: kindOf(t, B.o) });
    }
  }
  return out;
}
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
function angleAt(p, q, r) {   // the corner angle at p, in degrees
  const ax = q.x - p.x, ay = q.y - p.y, bx = r.x - p.x, by = r.y - p.y;
  return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by))))) * 180 / Math.PI;
}
const shuffle = (arr, rnd) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const whole = (v) => Math.abs(v - Math.round(v)) < 0.04;
const nameOf = (s) => (s.ground ? 'the ground' : s.corner ? 'the corner post' : s.post ? 'the post' : s.level ? 'the horizontal board' : 'the other board');

// pick one question for the triangles a new board made, or null. rnd: a 0..1 random function (for tests)
export function makeQuestion(tris, newSeg, rnd = Math.random) {
  if (!tris.length) return null;
  // a whole-number right triangle first (they are rarer, and the lesson is best)
  for (const t of tris) { const q = lengthQuestion(t, newSeg, rnd); if (q) return q; }
  // otherwise the angle question on the neatest triangle (the one with a right angle, if there is one)
  const scored = tris.map((t) => { const [P, Q, R] = t.pts; const ang = [angleAt(P, Q, R), angleAt(Q, R, P), angleAt(R, P, Q)]; return { t, ang, right: ang.some((a) => Math.abs(a - 90) < 1) }; });
  scored.sort((x, y) => y.right - x.right);
  return angleQuestion(scored[0].t, scored[0].ang, rnd);
}

// a bay w feet wide and h feet tall: the brace corner to corner, when it comes out whole and fits on one board
export function bayQuestion(w, h, y0, rnd = Math.random, longest = 8) {
  const a = Math.min(w, h), b = Math.max(w, h), c = Math.hypot(w, h);
  if (!whole(a) || !whole(b) || !whole(c) || c > longest + 0.01) return null;
  const s = [Math.round(a), Math.round(b), Math.round(c)];
  if (!TRIPLES.some((tr) => tr[0] === s[0] && tr[1] === s[1] && tr[2] === s[2])) return null;
  const C = s[2], wrong = [s[0] + s[1], C + 1, C - 1, s[0] * s[0] + s[1] * s[1]];
  const choices = shuffle([C, ...shuffle([...new Set(wrong.filter((v) => v > 0 && v !== C))], rnd).slice(0, 3)], rnd);
  // the triangle: the foot of the left post, the top of the right one, the foot of the right one (the square corner)
  const pts = [{ x: 0, y: y0 }, { x: w, y: y0 + h }, { x: w, y: y0 }];
  return {
    kind: 'length', pts, sideLabels: ['?', Math.round(h) + ' ft', Math.round(w) + ' ft'], angleLabels: ['', '', ''], ask: 0, square: 2,
    prompt: `This opening is ${lenWords(Math.round(w))} wide and ${lenWords(Math.round(h))} tall. How long a brace reaches from corner to corner?`,
    choices, answer: C, unit: ' ft',
    why: `Square the two short sides and add: ${s[0]}×${s[0]} + ${s[1]}×${s[1]} = ${s[0] * s[0]} + ${s[1] * s[1]} = ${C * C}, and ${C}×${C} = ${C * C}. So the brace is ${lenWords(C)} long.`,
    helper: { kind: 'squares', a: s[0], b: s[1], c: C }, bay: true,
  };
}

function angleQuestion(t, ang, rnd) {
  // whole degrees that add to 180 exactly (the third is worked out from the two rounded ones)
  const r = ang.map((a) => Math.round(a));
  // ask for the corner NOT on the new board when it's the odd one (R), unless R is the right angle: then ask one of
  // the new board's corners and show the right angle
  let ask = 2;
  if (Math.abs(ang[2] - 90) < 1) ask = rnd() < 0.5 ? 0 : 1;
  const known = [0, 1, 2].filter((i) => i !== ask);
  const shown = known.map((i) => r[i]); const answer = 180 - shown[0] - shown[1];
  if (answer < 5) return null;
  const labels = ['', '', '']; known.forEach((i, k) => { labels[i] = shown[k] + '°'; }); labels[ask] = '?';
  const wrong = new Set([180 - shown[0], 180 - shown[1], answer + 10, answer - 10, 90 - answer, shown[0] + shown[1]]
    .filter((v) => v > 0 && v < 180 && v !== answer));
  const choices = shuffle([answer, ...shuffle([...wrong], rnd).slice(0, 3)], rnd);
  return {
    kind: 'angle', pts: t.pts, angleLabels: labels, sideLabels: ['', '', ''], ask,
    prompt: `Your board made a triangle. Two corners are ${shown[0]}° and ${shown[1]}°. What is the third corner?`,
    choices, answer, unit: '°',
    why: `The three corners of a triangle always add up to 180°: ${shown[0]} + ${shown[1]} = ${shown[0] + shown[1]}, and 180 − ${shown[0] + shown[1]} = ${answer}.`,
    helper: { kind: 'angles', shown, answer },
  };
}

function lengthQuestion(t, newSeg, rnd) {
  const [P, Q, R] = t.pts;
  const sides = [dist(P, Q), dist(Q, R), dist(R, P)];      // PQ lies on the new board, QR on b, RP on a
  if (!sides.every(whole)) return null;
  const s = sides.map((v) => Math.round(v)), sorted = [...s].sort((a, b) => a - b);
  if (!TRIPLES.some((tr) => tr[0] === sorted[0] && tr[1] === sorted[1] && tr[2] === sorted[2])) return null;
  const hyp = s.indexOf(sorted[2]);
  // the new board is the long side: ask where it lands (a short side). Otherwise ask the long side.
  let ask;
  if (hyp === 0) ask = rnd() < 0.5 ? 1 : 2;
  else ask = hyp;
  const answer = s[ask], known = [0, 1, 2].filter((i) => i !== ask).map((i) => s[i]);
  const labels = s.map((v, i) => (i === ask ? '?' : v + ' ft'));
  const along = [null, t.b, t.a][ask];
  // (when the new board is the long side, the question is where along the other board it lands)
  const prompt = ask === hyp
    ? `This triangle has a square corner. Its short sides are ${lenWords(known[0])} and ${lenWords(known[1])}. How long is the long side?`
    : `Your ${s[0]}-foot board is the long side, and the other short side is ${lenWords(known.find((v) => v !== s[0]))}. How far along ${nameOf(along)} does it land?`;
  const a = sorted[0], b = sorted[1], c = sorted[2];
  const wrong = ask === hyp ? [a + b, c + 1, c - 1, a * a + b * b] : [c - known.find((v) => v !== c), c + known.find((v) => v !== c), answer + 1, answer - 1];
  const choices = shuffle([answer, ...shuffle([...new Set(wrong.filter((v) => v > 0 && v !== answer))], rnd).slice(0, 3)], rnd);
  return {
    kind: 'length', pts: t.pts, sideLabels: labels, angleLabels: ['', '', ''], ask, square: [2, 0, 1][hyp],   // (the square corner is the one across from the long side)
    prompt, choices, answer, unit: ' ft',
    why: ask === hyp
      ? `Square the two short sides and add: ${a}×${a} + ${b}×${b} = ${a * a} + ${b * b} = ${c * c}, and ${c}×${c} = ${c * c}. So the long side is ${c}.`
      : `Long side squared minus the known short side squared: ${c}×${c} − ${known.find((v) => v !== c)}×${known.find((v) => v !== c)} = ${c * c - known.find((v) => v !== c) ** 2}, and ${answer}×${answer} = ${answer * answer}.`,
    helper: { kind: 'squares', a, b, c },
  };
}

// ── how high a slanting board reaches ────────────────────────────────────────────────────────────────────────────────
// When a slanting board goes up whose top end stands a whole or half number of feet over from its foot (as the arrows
// set it: half a foot a tap), the miller may ask how high it reaches: the board is the long side of a right triangle, its
// run over the ground one short side, so its rise is √(L² − r²). A whole-number triple where there is one (a 5 ft board
// with its top moved 3 ft over reaches 4 ft); else to the inch (an 8 ft board, its top 2 ft over: 8 × 8 − 2 × 2 = 60,
// and 7 ft 9 in. times itself is about 60).
// Every answer is a number (inches) with `labels` saying it the carpenter's way.
const halfStr = (v) => { const a = Math.abs(v), f = Math.floor(a + 1e-9), h = a - f > 0.25; return (v < 0 ? '−' : '') + (h ? (f || '') + '½' : String(f)); };
// feet and inches on a label (a choice button, a drawing): "4 ft", "4½ ft", "7 ft 9 in.", "9 in." (tower.js lenLabel)
export const ftIn = (ft) => lenLabel(ft);
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
// the right answer and three wrong ones, shuffled. Every wrong one is first put on the steps the answers go by (the
// half foot, the half inch: `step`), so no two buttons ever show the same thing, and none shows the right answer.
const choicesFrom = (answer, wrong, rnd, step = 0.5) => {
  const on = (v) => Math.round(v / step) * step;
  return shuffle([answer, ...shuffle([...new Set(wrong.map(on).filter((v) => v > 0 && Math.abs(v - answer) > 1e-6))], rnd).slice(0, 3)], rnd);
};
// L: the board's length, r: how far its top end stands over from its foot (feet, both on the half foot). null when it
// isn't a slant worth asking about (r on the half foot, under L, and a rise of a foot or more).
const onHalf = (v) => Math.abs(v * 2 - Math.round(v * 2)) < 0.02;
export function reachQuestion(L, r, rnd = Math.random) {
  if (!onHalf(L) || !onHalf(r)) return null;
  L = Math.round(L * 2) / 2; r = Math.round(r * 2) / 2;
  if (!(r >= 0.5 && r < L - 0.25)) return null;
  const sq = L * L - r * r, h = Math.sqrt(sq);
  if (h < 1) return null;
  const exact = Number.isInteger(L) && Number.isInteger(r) && Math.abs(h - Math.round(h)) < 1e-9;
  const A = Math.round(h * 12), wrong = [Math.round(L * 12), Math.round((L - r) * 12), Math.round(Math.sqrt(L * L + r * r) * 12), A + 3, A - 3, A + 6];
  const choices = choicesFrom(A, wrong, rnd, 1);
  const n = (v) => halfStr(v);
  return {
    kind: 'slope', title: 'How high does it reach?', pic: { kind: 'leg', L, r }, unit: '',
    prompt: `Your board is ${lenWords(L)} long, and its top end stands ${lenWords(r)} over from its foot. ${exact ? 'How high' : 'About how high (to the inch)'} does its top reach above its foot?`,
    choices, labels: choices.map((v) => ftIn(v / 12)), answer: A,
    why: exact
      ? `The board is the long side of a right triangle: ${n(L)}×${n(L)} − ${n(r)}×${n(r)} = ${n(L * L)} − ${n(r * r)} = ${n(sq)}, and ${h}×${h} = ${h * h}. So it reaches ${lenWords(h)}.`
      : `The board is the long side of a right triangle: ${n(L)}×${n(L)} − ${n(r)}×${n(r)} = ${n(L * L)} − ${n(r * r)} = ${n(sq)}. Which number times itself makes ${n(sq)}? ${cap(lenWords(A / 12))} is ${(A / 12).toFixed(2)} feet, and ${(A / 12).toFixed(2)} × ${(A / 12).toFixed(2)} ≈ ${n(sq)}. A slanting board always reaches less high than it is long.`,
    helper: { kind: 'legsq', L, r, h: A / 12, exact },
  };
}
