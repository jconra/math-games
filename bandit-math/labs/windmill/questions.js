// THE MATH. The miller's questions climb a ladder of geometry steps (see THE LADDER below: name the angle, kinds of
// triangles, the missing angle, the third corner, right triangles, a mix), not tied to the board just nailed. When that
// board happens to fit the step, the page may ask about it instead, with the functions here:
// when a board just nailed up closes a triangle with two others (or with the ground), the miller
// may ask one question about that very triangle. Two kinds:
//   angle   the three corners of any triangle add up to 180 degrees: two are shown, find the third
//   length  a right-angled triangle whose sides are whole feet (3-4-5, 6-8-10, 5-12-13): two sides are shown,
//           find the third (most often where the brace lands: how far along the other board)
// And one about the tower's own size: when a horizontal board closes an opening (posts both sides, the ground or a
// horizontal board under it) whose width and height are the short sides of a whole-number right triangle, how long a
// brace reaches from corner to corner (the stones set 3 feet apart and a horizontal board 4 feet up make a 5 foot brace).
// And one about a slanting board itself (reachQuestion): how high it reaches, its top so far over from its foot.
// EVERY question is one to do in your head, no calculator: whole numbers (or a simple half) and small ones. Corners
// are shown to the nearest 5 degrees; right triangles only with whole sides from TRIPLES; a slanting board whose sides
// make no whole triple gets an easy question about its length instead (tests/windmill-questions.test.mjs checks it).
// The triangles are found in the world (any three boards, or two and the ground, that meet each other at three spots)
// and drawn flat in their own plane. Pure functions (no page, no three.js) so node can test them.
import { touch3, TOL } from './touch.js';
import { lenWords, lenLabel, isPost, isCornerPost } from './tower.js';

export const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13]];
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
// want: 'length' (only a whole right triangle's side), 'angle' (only a corner), or null (either)
export function makeQuestion(tris, newSeg, rnd = Math.random, want = null) {
  if (!tris.length) return null;
  // a whole-number right triangle first (they are rarer, and the lesson is best)
  if (want !== 'angle') for (const t of tris) { const q = lengthQuestion(t, newSeg, rnd); if (q) return q; }
  if (want === 'length') return null;
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
  // to the nearest 5 degrees, so the sum is one to do in your head (the third is worked out from the two rounded ones)
  const r = ang.map((a) => Math.round(a / 5) * 5);
  // ask for the corner NOT on the new board when it's the odd one (R), unless R is the right angle: then ask one of
  // the new board's corners and show the right angle
  let ask = 2;
  if (Math.abs(ang[2] - 90) < 1) ask = rnd() < 0.5 ? 0 : 1;
  const known = [0, 1, 2].filter((i) => i !== ask);
  const shown = known.map((i) => r[i]); const answer = 180 - shown[0] - shown[1];
  if (answer < 5) return null;
  if (shown.some((v) => v < 5)) return null;
  const about = known.some((i) => Math.abs(ang[i] - r[i]) > 0.5) ? 'about ' : '';
  const labels = ['', '', '']; known.forEach((i, k) => { labels[i] = shown[k] + '°'; }); labels[ask] = '?';
  const wrong = new Set([180 - shown[0], 180 - shown[1], answer + 10, answer - 10, 90 - answer, shown[0] + shown[1]]
    .filter((v) => v > 0 && v < 180 && v !== answer));
  const choices = shuffle([answer, ...shuffle([...wrong], rnd).slice(0, 3)], rnd);
  return {
    kind: 'angle', pts: t.pts, angleLabels: labels, sideLabels: ['', '', ''], ask,
    prompt: `Your board made a triangle. Two corners are ${about}${shown[0]}° and ${shown[1]}°. What is the third corner?`,
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
// run over the ground one short side, so its rise is √(L² − r²). Only when the three make a whole-number triple from
// TRIPLES (a 5 ft board with its top moved 3 ft over reaches 4 ft). Any other board (an 8 ft board 2 ft over reaches
// √60 ft: a calculator's sum) gets an easy question about its own length instead: half of it (a whole-foot board), or
// two of it end to end (a board on the half foot).
// Every answer is a number (inches for the reach, feet for the easy ones) with `labels` saying it the carpenter's way.
// feet and inches on a label (a choice button, a drawing): "4 ft", "4½ ft", "7 ft 9 in.", "9 in." (tower.js lenLabel)
export const ftIn = (ft) => lenLabel(ft);
// the right answer and three wrong ones, shuffled. Every wrong one is first put on the steps the answers go by (`step`),
// so no two buttons ever show the same thing, and none shows the right answer.
const choicesFrom = (answer, wrong, rnd, step = 0.5) => {
  const on = (v) => Math.round(v / step) * step;
  return shuffle([answer, ...shuffle([...new Set(wrong.map(on).filter((v) => v > 0 && Math.abs(v - answer) > 1e-6))], rnd).slice(0, 3)], rnd);
};
const onHalf = (v) => Math.abs(v * 2 - Math.round(v * 2)) < 0.02;
// a number the way it is said in a sum: "4", "7½", "½"
const halfStr = (v) => { const f = Math.floor(v + 1e-9); return v - f > 0.25 ? (f || '') + '½' : String(f); };
// are a, b, c (any order) the sides of a whole-number right triangle from TRIPLES?
export const isTriple = (a, b, c) => {
  const s = [a, b, c].sort((x, y) => x - y);
  return s.every(Number.isInteger) && TRIPLES.some((tr) => tr[0] === s[0] && tr[1] === s[1] && tr[2] === s[2]);
};
// L: the board's length, r: how far its top end stands over from its foot (feet, both on the half foot). null when it
// isn't a slant worth asking about (r on the half foot, under L, and a rise of a foot or more).
export function reachQuestion(L, r, rnd = Math.random) {
  if (!onHalf(L) || !onHalf(r)) return null;
  L = Math.round(L * 2) / 2; r = Math.round(r * 2) / 2;
  if (!(r >= 0.5 && r < L - 0.25)) return null;
  const sq = L * L - r * r, h = Math.sqrt(sq);
  if (h < 1) return null;
  if (Number.isInteger(L) && Number.isInteger(r) && Math.abs(h - Math.round(h)) < 1e-9 && isTriple(L, r, Math.round(h))) {
    const H = Math.round(h), A = H * 12;
    const wrong = [L, L - r, L + r, r, H + 1, H - 1].map((v) => v * 12);
    const choices = choicesFrom(A, wrong, rnd, 12);
    return {
      kind: 'slope', title: 'How high does it reach?', pic: { kind: 'leg', L, r }, unit: '',
      prompt: `Your board is ${lenWords(L)} long, and its top end stands ${lenWords(r)} over from its foot. How high does its top reach above its foot?`,
      choices, labels: choices.map((v) => ftIn(v / 12)), answer: A,
      why: `The board is the long side of a right triangle: ${L}×${L} − ${r}×${r} = ${L * L} − ${r * r} = ${sq}, and ${H}×${H} = ${sq}. So it reaches ${lenWords(H)}.`,
      helper: { kind: 'legsq', L, r, h: H, exact: true },
    };
  }
  return easyQuestion(L, rnd);
}
// an easy one about a board L feet long (on the half foot): half of it when that is a whole or half foot, else two of
// it end to end. Answers in feet.
export function easyQuestion(L, rnd = Math.random) {
  if (!onHalf(L) || L < 1) return null;
  L = Math.round(L * 2) / 2;
  const n = halfStr;
  if (Number.isInteger(L)) {
    const A = L / 2;
    const choices = choicesFrom(A, [L, L - 1, A + 1, A - 1, L + 2, A + 0.5], rnd);
    return {
      kind: 'easy', title: 'Half a board', unit: '',
      prompt: `Your board is ${lenWords(L)} long. Sawn in half, how long would each piece be?`,
      choices, labels: choices.map(ftIn), answer: A,
      why: `Half of ${n(L)} is ${n(A)}: ${n(A)} + ${n(A)} = ${n(L)}. Each piece would be ${lenWords(A)} long.`,
      helper: null,
    };
  }
  const A = L * 2;
  const choices = choicesFrom(A, [A - 1, A + 1, L + 1, A - 0.5, A + 2], rnd);
  return {
    kind: 'easy', title: 'Two boards end to end', unit: '',
    prompt: `Your board is ${lenWords(L)} long. Two boards this long laid end to end: how long are they together?`,
    choices, labels: choices.map(ftIn), answer: A,
    why: `${n(L)} + ${n(L)}: the two halves make one more foot, so it is ${n(Math.floor(L) * 2)} + 1 = ${n(A)}. Together they are ${lenWords(A)} long.`,
    helper: null,
  };
}

// ── THE LADDER: geometry questions from easy to hard, not tied to the board just nailed ─────────────────────────────
// Seven steps. A fresh player starts on step 1; two right in a row climb a step, a wrong answer drops one (never below
// 1). The page keeps the step in localStorage so a returning player starts where they were.
//   1  name the angle two boards make: acute, right, obtuse or straight (a picture, no numbers)
//   2  kinds of triangles: right / acute / obtuse by their corners, or equilateral / isosceles / scalene by marked sides
//   3  a square corner is 90°, a straight line 180°: one angle shown, find the other
//   4  crossing boards: an X (across from each other equal, side by side 180), and a brace across two parallel boards:
//      an F (matching angles equal), a Z (equal), a C (adding up to 180)
//   5  the corners of a triangle add up to 180°: two shown, find the third
//   6  right triangles with whole sides (3-4-5, 6-8-10, 5-12-13): the long side, a short side, or how high a board reaches
//   7  a mix of 2 to 6
// Angles are multiples of 5. Every question is one to do in your head, has tap-to-answer buttons, its own picture
// (q.svg, or q.pts drawn by the page's trianglePic, or q.pic for a slope) and a helper for a wrong answer (q.helper).
// q.geo holds the picture's geometry so tests can check it shows what the question says. q.topic names the exact kind
// (TOPICS), questionOf(topic) makes a fresh one of it, and every question carries a lesson: q.rule (the idea in one
// plain sentence) and q.steps (its own answer worked out step by step) for the "Teach me" card (teach.js).
// The miller's spare boards: a right answer earns one, at most BONUS_MAX for a tower (a fresh start resets the count;
// the player is never told about the limit: past it, a right answer just gets praise).
// questionDue: a question at a hand-nailed board once two hand nails and three boards in all (twins too) have gone up
// since the last one: about one every two hand nails when building with twins (a two-level braced tower is some 12 to
// 20 hand nails: 6 to 10 questions), one every three when every board goes up by hand.
export const questionDue = (handSince, boardsSince) => handSince >= 2 && boardsSince >= 3;
export const LADDER_TOP = 7, BONUS_MAX = 6;
export const LADDER_KEY = 'bandit-math.windmill.ladder';
export const freshLadder = () => ({ level: 1, streak: 0 });
// the ladder after an answer
export function stepLadder(s, right) {
  const level = Math.min(LADDER_TOP, Math.max(1, Math.round(+s?.level || 1)));
  if (!right) return { level: Math.max(1, level - 1), streak: 0 };
  const streak = (s?.streak || 0) + 1;
  return streak >= 2 && level < LADDER_TOP ? { level: level + 1, streak: 0 } : { level, streak: streak >= 2 ? 0 : streak };
}
// a saved ladder, read back safely (anything odd: a fresh one)
export function readLadder(text) {
  try { const s = JSON.parse(text); const l = Math.round(+s.level); if (l >= 1 && l <= LADDER_TOP) return { level: l, streak: Math.max(0, Math.min(1, Math.round(+s.streak || 0))) }; } catch (e) { /* fresh */ }
  return freshLadder();
}
// does this answer earn a board? (a right one, while the miller still has spares; a wrong one uses nothing up)
export const earnsBoard = (earned, right) => !!right && earned < BONUS_MAX;
const INK = '#2b2219', WOOD = '#8a5a32', RED = '#b0401f', GREEN = '#3f6e22', FONT = 'font-family="Bitter, Georgia, serif" font-weight="700"';
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];
const fives = (lo, hi) => { const o = []; for (let v = lo; v <= hi; v += 5) o.push(v); return o; };
const R = Math.PI / 180;
// math coordinates (y up) to a viewBox: uniform scale, centred. -> f(p) -> { x, y }
function fitter(pts, w = 320, h = 186, pad = 28, maxS = 1.6) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min((w - 2 * pad) / Math.max(1e-6, x1 - x0), (h - 2 * pad) / Math.max(1e-6, y1 - y0), maxS);
  const ox = (w - (x1 - x0) * s) / 2, oy = (h - (y1 - y0) * s) / 2;
  return (p) => ({ x: +(ox + (p.x - x0) * s).toFixed(1), y: +(h - oy - (p.y - y0) * s).toFixed(1) });
}
const board = (a, b, w = 9) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${WOOD}" stroke-width="${w}" stroke-linecap="round"/>`;
const text = (p, s, col = INK, size = 18) => `<text x="${p.x}" y="${p.y + size / 3}" text-anchor="middle" ${FONT} font-size="${size}" fill="${col}">${s}</text>`;
// an arc at V (screen coords) from math angle t0 to t1 (degrees, counterclockwise), radius r
function arc(V, t0, t1, r, fill = 'rgba(233,201,143,.7)') {
  const p = (t) => ({ x: +(V.x + Math.cos(t * R) * r).toFixed(1), y: +(V.y - Math.sin(t * R) * r).toFixed(1) });
  const a = p(t0), b = p(t1);
  return `<path d="M${V.x} ${V.y} L${a.x} ${a.y} A${r} ${r} 0 ${t1 - t0 > 180 ? 1 : 0} 0 ${b.x} ${b.y} Z" fill="${fill}" stroke="${INK}" stroke-width="1.2"/>`;
}
const squareMark = (V, t0, r = 14) => { const u = { x: Math.cos(t0 * R), y: -Math.sin(t0 * R) }, v = { x: Math.cos((t0 + 90) * R), y: -Math.sin((t0 + 90) * R) };
  return `<path d="M${V.x + u.x * r} ${V.y + u.y * r} L${V.x + (u.x + v.x) * r} ${V.y + (u.y + v.y) * r} L${V.x + v.x * r} ${V.y + v.y * r}" fill="none" stroke="${INK}" stroke-width="2"/>`; };
const at = (V, t, r) => ({ x: +(V.x + Math.cos(t * R) * r).toFixed(1), y: +(V.y - Math.sin(t * R) * r).toFixed(1) });

// ── step 1: name the angle ──
const ANGLE_NAMES = ['acute', 'right', 'obtuse', 'straight'];
const cap1 = (s) => s[0].toUpperCase() + s.slice(1);
const nameOfAngle = (d) => (d < 90 ? 'acute' : d === 90 ? 'right' : d < 180 ? 'obtuse' : 'straight');
// two boards meeting at V, one level, the other `deg` round from it (flip: the level one points left). -> svg + geo
function angleSvg(deg, flip, { w = 320, h = 186, mark = true, label = '' } = {}) {
  const L = 1, base = flip ? 180 : 0, other = flip ? 180 - deg : deg;
  const m = [{ x: 0, y: 0 }, { x: Math.cos(base * R) * L, y: Math.sin(base * R) * L }, { x: Math.cos(other * R) * L, y: Math.sin(other * R) * L }];
  const f = fitter(m, w, h, Math.min(w, h) * 0.16, 1e9), [V, A, B] = m.map(f);
  const t0 = Math.min(base, other), t1 = Math.max(base, other), r = Math.min(w, h) * 0.17;
  let s = board(V, A, w < 200 ? 6 : 9) + board(V, B, w < 200 ? 6 : 9);
  if (mark) s += deg === 90 ? squareMark(V, t0, r * 0.6) : arc(V, t0, t1, r);
  s += `<circle cx="${V.x}" cy="${V.y}" r="${w < 200 ? 3 : 5}" fill="${INK}"/>`;   // the nail where they meet
  if (label) s += text({ x: w / 2, y: h - 10 }, label, INK, w < 200 ? 13 : 16);
  return { svg: s, geo: { V, A, B } };
}
function nameAngleQ(rnd) {
  const kind = pick(ANGLE_NAMES, rnd), deg = kind === 'acute' ? pick(fives(25, 65), rnd) : kind === 'obtuse' ? pick(fives(115, 155), rnd) : kind === 'right' ? 90 : 180;
  const flip = rnd() < 0.5, { svg, geo } = angleSvg(deg, flip);
  const why = {
    acute: 'Narrower than a square corner (90°): that is an acute angle.',
    right: 'A square corner, like a post standing on the ground, is a right angle: 90°.',
    obtuse: 'Wider than a square corner, but not a straight line: that is an obtuse angle.',
    straight: 'The two boards make one straight line: that is a straight angle, 180°.',
  }[kind];
  // the helper: all four side by side, the right one shaded
  let help = '<svg class="pic" viewBox="0 0 320 110">';
  [45, 90, 135, 180].forEach((d, i) => {
    const n = nameOfAngle(d), g = angleSvg(d, false, { w: 80, h: 110, label: cap1(n) });
    help += `<svg x="${i * 80}" y="0" width="80" height="110" viewBox="0 0 80 110">${n === kind ? '<rect x="2" y="2" width="76" height="106" rx="8" fill="rgba(79,122,42,.18)"/>' : ''}${g.svg}</svg>`;
  });
  help += '</svg>';
  return {
    kind: 'name-angle', title: 'What kind of angle?', svg: `<svg class="pic" viewBox="0 0 320 186">${svg}</svg>`, geo: { ...geo, deg },
    prompt: 'Two boards meet. What kind of angle do they make?',
    choices: ANGLE_NAMES, labels: ANGLE_NAMES.map(cap1), answer: kind, unit: '', why, helper: { kind: 'svg', svg: help },
    topic: 'name-angle', rule: 'Hold it up to a square corner (90°): narrower is acute, square is right, wider is obtuse, and a flat line (180°) is straight.',
    steps: kind === 'straight' ? ['A flat line is 180°.', 'These two boards make one flat line.', 'So it is a straight angle.']
      : ['A square corner is 90°.', { acute: 'These boards open narrower than a square corner.', right: 'These boards make exactly a square corner.', obtuse: 'These boards open wider than a square corner, but not flat.' }[kind], `So it is ${kind === 'acute' ? 'an acute' : kind === 'right' ? 'a right' : 'an obtuse'} angle.`],
  };
}

// ── step 2: kinds of triangles ──
// a triangle drawn from its three points (math coords): wood edges, optional tick marks (ticks[i]: side i, from point i
// to i+1), side labels, a square-corner mark at point `square`
function triSvg(pts, { w = 320, h = 186, ticks = null, sideLabels = null, square = -1, shade = '' } = {}) {
  const f = fitter(pts, w, h, w < 200 ? 14 : 34, 1e9), P = pts.map(f);
  const cx = (P[0].x + P[1].x + P[2].x) / 3, cy = (P[0].y + P[1].y + P[2].y) / 3;
  let s = shade ? `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="8" fill="${shade}"/>` : '';
  s += `<polygon points="${P.map((p) => p.x + ',' + p.y).join(' ')}" fill="rgba(210,165,113,.35)" stroke="#6d4b2b" stroke-width="${w < 200 ? 3 : 5}" stroke-linejoin="round"/>`;
  for (let i = 0; i < 3; i++) {
    const a = P[i], b = P[(i + 1) % 3], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
    if (ticks && ticks[i]) for (let k = 0; k < ticks[i]; k++) {
      const o = (k - (ticks[i] - 1) / 2) * 6, px = mx + ux * o, py = my + uy * o, t = w < 200 ? 5 : 8;
      s += `<line x1="${(px - uy * t).toFixed(1)}" y1="${(py + ux * t).toFixed(1)}" x2="${(px + uy * t).toFixed(1)}" y2="${(py - ux * t).toFixed(1)}" stroke="${INK}" stroke-width="2.2"/>`;
    }
    if (sideLabels && sideLabels[i]) { const dx = mx - cx, dy = my - cy, dd = Math.hypot(dx, dy) || 1; s += text({ x: +(mx + dx / dd * 22).toFixed(1), y: +(my + dy / dd * 22).toFixed(1) }, sideLabels[i], INK, 16); }
  }
  if (square >= 0) {
    const p = P[square], a = P[(square + 1) % 3], b = P[(square + 2) % 3], ua = { x: a.x - p.x, y: a.y - p.y }, ub = { x: b.x - p.x, y: b.y - p.y }, la = Math.hypot(ua.x, ua.y), lb = Math.hypot(ub.x, ub.y), r = w < 200 ? 8 : 13;
    s += `<path d="M${(p.x + ua.x / la * r).toFixed(1)} ${(p.y + ua.y / la * r).toFixed(1)} l${(ub.x / lb * r).toFixed(1)} ${(ub.y / lb * r).toFixed(1)} l${(-ua.x / la * r).toFixed(1)} ${(-ua.y / la * r).toFixed(1)}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  }
  return { svg: s, P };
}
// a triangle from its corners at P and Q (degrees): P at 0,0, Q at 1,0 (flip: mirrored)
function fromAngles(A, B, flip = false) {
  const t = Math.sin(B * R) / Math.sin((A + B) * R), pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: Math.cos(A * R) * t, y: Math.sin(A * R) * t }];
  return flip ? pts.map((p) => ({ x: 1 - p.x, y: p.y })) : pts;
}
// a triangle from its sides: PQ = c, QR = a, RP = b
function fromSides(a, b, c, flip = false) {
  const x = (b * b + c * c - a * a) / (2 * c), y = Math.sqrt(Math.max(0, b * b - x * x)), pts = [{ x: 0, y: 0 }, { x: c, y: 0 }, { x, y }];
  return flip ? pts.map((p) => ({ x: c - p.x, y: p.y })) : pts;
}
const CORNER_KINDS = ['right', 'acute', 'obtuse'], SIDE_KINDS = ['equilateral', 'isosceles', 'scalene'];
function triKindQ(rnd, sub) {
  if (sub ? sub === 'tri-corners' : rnd() < 0.5) {
    // by corners: the corners (multiples of 5) at P, Q and R
    const kind = pick(CORNER_KINDS, rnd);
    let ang;
    if (kind === 'right') { const a = pick(fives(30, 60), rnd); ang = pick([[90, a, 90 - a], [a, 90, 90 - a]], rnd); }
    else if (kind === 'obtuse') { const o = pick(fives(115, 140), rnd), a = pick(fives(20, 180 - o - 20), rnd); ang = pick([[o, a, 180 - o - a], [a, o, 180 - o - a]], rnd); }
    else { for (;;) { const a = pick(fives(50, 80), rnd), b = pick(fives(50, 80), rnd), c = 180 - a - b; if (c >= 45 && c <= 80) { ang = [a, b, c]; break; } } }
    const pts = fromAngles(ang[0], ang[1], rnd() < 0.5), sq = ang.indexOf(90);
    const draw = (p, opt) => triSvg(p, opt);
    const { svg } = draw(pts, { square: sq });
    let help = '<svg class="pic" viewBox="0 0 320 120">';
    [[90, 50], [65, 60], [125, 25]].forEach(([A, B], i) => {
      const n = CORNER_KINDS[i], g = draw(fromAngles(A, B), { w: 106, h: 90, square: A === 90 ? 0 : -1, shade: n === kind ? 'rgba(79,122,42,.18)' : '' });
      help += `<svg x="${i * 107}" y="0" width="106" height="90" viewBox="0 0 106 90">${g.svg}</svg>${text({ x: i * 107 + 53, y: 106 }, cap1(n), INK, 14)}`;
    });
    help += '</svg>';
    return {
      kind: 'tri-corners', title: 'What kind of triangle?', svg: `<svg class="pic" viewBox="0 0 320 186">${svg}</svg>`, geo: { pts, ang },
      prompt: 'Look at its corners. What kind of triangle is this?',
      choices: CORNER_KINDS, labels: CORNER_KINDS.map(cap1), answer: kind, unit: '',
      why: { right: 'One corner is a square corner (90°), so it is a right triangle.', acute: 'All three corners are narrower than a square corner, so it is an acute triangle.', obtuse: 'One corner is wider than a square corner, so it is an obtuse triangle.' }[kind],
      helper: { kind: 'svg', svg: help },
      topic: 'tri-corners', rule: 'Find the widest corner: a square corner makes a right triangle, wider than square an obtuse one, and if all three are narrower it is acute.',
      steps: ['Find the widest corner.', { right: 'It is a square corner, 90°.', obtuse: 'It is wider than a square corner.', acute: 'Even the widest is narrower than a square corner.' }[kind], `So it is ${kind === 'right' ? 'a right' : kind === 'acute' ? 'an acute' : 'an obtuse'} triangle.`],
    };
  }
  // by sides: the marks show which sides match
  const kind = pick(SIDE_KINDS, rnd);
  let s;
  if (kind === 'equilateral') { const v = pick([3, 4, 5, 6], rnd); s = [v, v, v]; }
  else if (kind === 'isosceles') { for (;;) { const v = pick([4, 5, 6, 7], rnd), b = pick([3, 4, 5, 6, 8], rnd); if (b !== v && b < 2 * v - 1) { s = [b, v, v]; break; } } }
  else { for (;;) { const t = shuffle([3, 4, 5, 6, 7, 8], rnd).slice(0, 3).sort((x, y) => x - y); if (t[0] + t[1] > t[2] + 1 && !isTriple(...t)) { s = [t[2], t[1], t[0]]; break; } } }
  // s: [PQ (the bottom), QR, RP]; ticks: matching sides the same marks
  const [c, a, b] = s, pts = fromSides(a, b, c, rnd() < 0.5);
  const marks = (sd) => { const u = [...new Set(sd)]; return sd.map((v) => u.indexOf(v) + 1); };
  const ticks = marks(s), { svg } = triSvg(pts, { ticks, sideLabels: s.map((v) => v + ' ft') });
  let help = '<svg class="pic" viewBox="0 0 320 120">';
  [[4, 4, 4], [3, 5, 5], [6, 5, 3.5]].forEach((sd, i) => {
    const n = SIDE_KINDS[i], g = triSvg(fromSides(sd[1], sd[2], sd[0]), { w: 106, h: 90, ticks: marks(sd), shade: n === kind ? 'rgba(79,122,42,.18)' : '' });
    help += `<svg x="${i * 107}" y="0" width="106" height="90" viewBox="0 0 106 90">${g.svg}</svg>${text({ x: i * 107 + 53, y: 106 }, cap1(n), INK, 14)}`;
  });
  help += '</svg>';
  return {
    kind: 'tri-sides', title: 'What kind of triangle?', svg: `<svg class="pic" viewBox="0 0 320 186">${svg}</svg>`, geo: { pts, sides: s, ticks },
    prompt: 'Sides with the same marks are the same length. What kind of triangle is this?',
    choices: SIDE_KINDS, labels: SIDE_KINDS.map(cap1), answer: kind, unit: '',
    why: { equilateral: 'All three sides are the same length, so it is equilateral.', isosceles: 'Two sides are the same length and one is different, so it is isosceles.', scalene: 'No two sides are the same length, so it is scalene.' }[kind],
    helper: { kind: 'svg', svg: help },
    topic: 'tri-sides', rule: 'Count the sides that match: all three is equilateral, two is isosceles, none is scalene.',
    steps: [`The sides are ${s[0]}, ${s[1]} and ${s[2]} feet.`, { equilateral: 'All three match.', isosceles: 'Two of them match.', scalene: 'No two match.' }[kind], `So it is ${kind}.`],
  };
}

// ── step 3: the missing angle on a straight line or in a square corner ──
function missingSvg(onLine, a, flip, shown, other, otherCol) {
  // math layout: the corner V at 0,0; onLine: the line along -1..1, the brace at angle a from the right-hand side;
  // in a corner: the ground to the right, the post up, the brace at a from the ground. flip mirrors it.
  const mx = (p) => (flip ? { x: -p.x, y: p.y } : p);
  const tB = a, ends = onLine ? [{ x: 1, y: 0 }, { x: -1, y: 0 }] : [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  const m = [{ x: 0, y: 0 }, ...ends, { x: Math.cos(tB * R) * 0.95, y: Math.sin(tB * R) * 0.95 }].map(mx);
  const f = fitter(onLine ? [...m, { x: 0, y: 1 }] : m, 320, 186, 26, 1e9), [V, E1, E2, B] = m.map(f);
  const total = onLine ? 180 : 90, r = 48;
  const ang = (deg) => (flip ? 180 - deg : deg);
  const lo = (t0, t1) => [Math.min(ang(t0), ang(t1)), Math.max(ang(t0), ang(t1))];
  let s = board(V, E1) + board(V, E2) + board(V, B, 7);
  const [s0, s1] = lo(0, a), [o0, o1] = lo(a, total);
  s += arc(V, s0, s1, r, 'rgba(233,201,143,.8)') + arc(V, o0, o1, r, 'rgba(240,185,163,.6)');
  s += text(at(V, (s0 + s1) / 2, r + 24), shown + '°') + text(at(V, (o0 + o1) / 2, r + 24), other, otherCol, 20);
  return { svg: `<svg class="pic" viewBox="0 0 320 186">${s}</svg>`, geo: { V, E1, E2, B } };
}
function missingQ(rnd, sub) {
  const onLine = sub ? sub === 'line' : rnd() < 0.5, a = onLine ? pick(fives(25, 155).filter((v) => v !== 90), rnd) : pick(fives(20, 70), rnd);
  const total = onLine ? 180 : 90, answer = total - a, flip = rnd() < 0.5;
  const { svg, geo } = missingSvg(onLine, a, flip, a, '?', RED);
  const wrong = [onLine ? 90 - a : 180 - a, answer + 10, answer - 10, a, answer + 5].filter((v) => v > 0 && v < 180 && v % 5 === 0);
  const choices = choicesFrom(answer, wrong, rnd, 5);
  return {
    kind: 'missing', title: onLine ? 'A straight line' : 'A square corner', svg, geo: { ...geo, onLine, a, flip },
    prompt: onLine ? `A brace meets a horizontal board. Together the two angles make a straight line. One is ${a}°. What is the other?`
      : `A brace sits in a square corner, splitting it in two. One part is ${a}°. What is the other?`,
    choices, answer, unit: '°',
    why: onLine ? `A straight line is 180°, so the other angle is 180 − ${a} = ${answer}°.` : `A square corner is 90°, so the other part is 90 − ${a} = ${answer}°.`,
    helper: { kind: 'svg', svg: missingSvg(onLine, a, flip, a, answer + '°', GREEN).svg },
    topic: onLine ? 'line' : 'corner',
    rule: onLine ? 'A straight line is 180°, so two angles side by side on it add up to 180°.' : 'A square corner is 90°, so the two parts of it add up to 90°.',
    steps: [`Together they make ${onLine ? 'a straight line' : 'a square corner'}: ${a} + ? = ${total}.`, `${total} − ${a} = ${answer}.`, `The other angle is ${answer}°.`],
  };
}

// ── step 5: the third corner of a triangle ──
function thirdAngleQ(rnd) {
  let A, B, C;
  for (;;) { A = pick(fives(25, 110), rnd); B = pick(fives(25, 110), rnd); C = 180 - A - B; if (C >= 25) break; }
  const pts = fromAngles(A, B, rnd() < 0.5), ang = [A, B, C], ask = Math.floor(rnd() * 3) % 3;
  const known = [0, 1, 2].filter((i) => i !== ask), shown = known.map((i) => ang[i]), answer = ang[ask];
  const labels = ang.map((v, i) => (i === ask ? '?' : v + '°'));
  const wrong = [180 - shown[0], 180 - shown[1], answer + 10, answer - 10, shown[0] + shown[1], 90 - answer];
  const choices = choicesFrom(answer, wrong.filter((v) => v > 0 && v < 180), rnd, 5);
  const sq = ang.indexOf(90);
  return {
    kind: 'angle', title: 'The third corner', pts, angleLabels: labels, sideLabels: ['', '', ''], ask, ...(sq >= 0 ? { square: sq } : {}), geo: { pts, ang },
    prompt: `Two corners of this triangle are ${shown[0]}° and ${shown[1]}°. What is the third corner?`,
    choices, answer, unit: '°',
    why: `The three corners of a triangle always add up to 180°: ${shown[0]} + ${shown[1]} = ${shown[0] + shown[1]}, and 180 − ${shown[0] + shown[1]} = ${answer}.`,
    helper: { kind: 'angles', shown, answer },
    topic: 'tri-sum', rule: 'The three corners of any triangle add up to 180°.',
    steps: [`Add the two you know: ${shown[0]} + ${shown[1]} = ${shown[0] + shown[1]}.`, `Take that from 180: 180 − ${shown[0] + shown[1]} = ${answer}.`, `The third corner is ${answer}°.`],
  };
}

// ── step 6: right triangles with whole sides ──
const RIGHT_RULE = 'In a triangle with a square corner, the two short sides squared add up to the long side squared.';
const shortSteps = (c, k, ans) => [`${c}×${c} = ${c * c} and ${k}×${k} = ${k * k}.`, `${c * c} − ${k * k} = ${ans * ans}.`, `${ans}×${ans} = ${ans * ans}, so it is ${lenWords(ans)}.`];
function rightSidesQ(rnd, sub) {
  const [a, b, c] = pick(TRIPLES, rnd), how = sub ? { hyp: 0, leg: 1, reach: 2 }[sub] : Math.floor(rnd() * 3) % 3;
  if (how === 2) {
    // how high a board reaches: the board the long side, its top a short side over from its foot
    const r = rnd() < 0.5 ? a : b, q = reachQuestion(c, r, rnd);
    return { ...q, geo: { L: c, r, h: Math.sqrt(c * c - r * r) },
      prompt: `A board ${lenWords(c)} long leans so its top end stands ${lenWords(r)} over from its foot. How high does its top reach above its foot?`,
      topic: 'reach', rule: RIGHT_RULE + ' The board is the long side.', steps: shortSteps(c, r, Math.round(Math.sqrt(c * c - r * r))) };
  }
  // the triangle on the ground: the short sides along the bottom (PQ) and up the right (QR), the long side RP
  const [w, h] = rnd() < 0.5 ? [a, b] : [b, a];
  const pts = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }], s = [w, h, c];
  if (how === 0) {
    const wrong = [a + b, c + 1, c - 1, a * a + b * b];
    const choices = shuffle([c, ...shuffle([...new Set(wrong.filter((v) => v > 0 && v !== c))], rnd).slice(0, 3)], rnd);
    return {
      kind: 'length', title: 'The long side', pts, sideLabels: [w + ' ft', h + ' ft', '?'], angleLabels: ['', '', ''], ask: 2, square: 1, geo: { pts, s },
      prompt: `This triangle has a square corner. Its short sides are ${lenWords(w)} and ${lenWords(h)}. How long is the long side?`,
      choices, answer: c, unit: ' ft',
      why: `Square the two short sides and add: ${a}×${a} + ${b}×${b} = ${a * a} + ${b * b} = ${c * c}, and ${c}×${c} = ${c * c}. So the long side is ${lenWords(c)}.`,
      helper: { kind: 'squares', a, b, c },
      topic: 'hyp', rule: RIGHT_RULE,
      steps: [`${a}×${a} = ${a * a} and ${b}×${b} = ${b * b}.`, `${a * a} + ${b * b} = ${c * c}.`, `${c}×${c} = ${c * c}, so the long side is ${lenWords(c)}.`],
    };
  }
  // a short side missing
  const askI = rnd() < 0.5 ? 0 : 1, answer = s[askI], known = s[1 - askI];
  const wrong = [c - known, c + known, answer + 1, answer - 1, c];
  const choices = shuffle([answer, ...shuffle([...new Set(wrong.filter((v) => v > 0 && v !== answer))], rnd).slice(0, 3)], rnd);
  const labels = s.map((v, i) => (i === askI ? '?' : v + ' ft'));
  return {
    kind: 'length', title: 'A short side', pts, sideLabels: labels, angleLabels: ['', '', ''], ask: askI, square: 1, geo: { pts, s },
    prompt: `This triangle has a square corner. Its long side is ${lenWords(c)} and one short side is ${lenWords(known)}. How long is the other short side?`,
    choices, answer, unit: ' ft',
    why: `Long side squared minus the short side squared: ${c}×${c} − ${known}×${known} = ${c * c - known * known}, and ${answer}×${answer} = ${answer * answer}. So it is ${lenWords(answer)}.`,
    helper: { kind: 'squares', a, b, c },
    topic: 'leg', rule: RIGHT_RULE, steps: shortSteps(c, known, answer),
  };
}

// ── step 4: crossing boards ──
// x: two boards crossing; f / z / c: a brace across two parallel horizontal boards. The brace leans at `a` degrees from
// the boards (to the right, or mirrored). Each crossing has four angles: up-right a, up-left 180 − a, down-left a,
// down-right 180 − a. shown: the angle at the lower crossing, up-right; asked by the shape:
//   x  the same crossing, down-left (across, equal) or up-left (side by side, 180 − a)
//   f  the upper crossing, up-right (matching, equal)     z  the upper crossing, down-left (equal)
//   c  the upper crossing, down-right (inside on the same side: 180 − a)
// -> { svg, geo: { shown: { V, A, B }, asked: { V, A, B }, boards } } (each angle: its corner and a point on each side)
function crossSvg(topic, a, flip, variant, other, otherCol, trace) {
  const two = topic !== 'x', mx = (p) => (flip ? { x: -p.x, y: p.y } : p), dir = (t) => ({ x: Math.cos(t * R), y: Math.sin(t * R) });
  const gap = 1, ext = 0.85, k = gap / Math.sin(a * R);      // along the brace from the lower crossing to the upper
  const P1 = { x: 0, y: 0 }, P2 = { x: Math.cos(a * R) * k, y: gap };
  const add = (p, d, l) => ({ x: p.x + d.x * l, y: p.y + d.y * l });
  const ends = two ? [add(P1, dir(a), -0.5), add(P2, dir(a), 0.5)] : [add(P1, dir(a), -1), add(P1, dir(a), 1)];
  const x0 = -ext + Math.min(0, P2.x), x1 = ext + Math.max(0, P2.x);
  const boardsM = two ? [[{ x: x0, y: 0 }, { x: x1, y: 0 }], [{ x: x0, y: gap }, { x: x1, y: gap }]] : [[{ x: -1, y: 0 }, { x: 1, y: 0 }]];
  const all = [...ends, ...boardsM.flat()].map(mx), f = fitter(all, 320, 186, 24, 1e9), F = (p) => f(mx(p));
  // the angles, in math degrees before mirroring
  const ANG = { ur: [0, a], ul: [a, 180], dl: [180, 180 + a], dr: [180 + a, 360] };
  const askAt = topic === 'x' ? [P1, variant === 'beside' ? 'ul' : 'dl'] : [P2, { f: 'ur', z: 'dl', c: 'dr' }[topic]];
  const M = (t) => (flip ? 180 - t : t);
  const arcAt = (V, key, r, fill) => { const m0 = M(ANG[key][0]), m1 = M(ANG[key][1]); return arc(F(V), Math.min(m0, m1), Math.max(m0, m1), r, fill); };
  const labelAt = (V, key, str, col, size) => text(at(F(V), M((ANG[key][0] + ANG[key][1]) / 2), two ? 42 : 52), str, col, size);
  let s = '';
  if (trace) {   // the letter, traced under the boards: F / Z / C along the boards and the brace
    const seg = (p, q) => `<line x1="${F(p).x}" y1="${F(p).y}" x2="${F(q).x}" y2="${F(q).y}" stroke="rgba(63,110,34,.45)" stroke-width="16" stroke-linecap="round"/>`;
    const r1 = { x: P1.x + 0.7, y: 0 }, r2 = { x: P2.x + 0.7, y: gap }, l2 = { x: P2.x - 0.7, y: gap };
    if (topic === 'f') s += seg(add(P1, dir(a), -0.45), P2) + seg(P1, r1) + seg(P2, r2);
    if (topic === 'z') s += seg(P1, r1) + seg(P1, P2) + seg(P2, l2);
    if (topic === 'c') s += seg(P1, r1) + seg(P1, P2) + seg(P2, r2);
  }
  for (const [p, q] of boardsM) s += board(F(p), F(q));
  s += board(F(ends[0]), F(ends[1]), 7);
  s += arcAt(P1, 'ur', 26, 'rgba(233,201,143,.85)') + arcAt(askAt[0], askAt[1], 26, 'rgba(240,185,163,.75)');
  s += labelAt(P1, 'ur', a + '°', INK, 16) + labelAt(askAt[0], askAt[1], other, otherCol, 19);
  // the parallel marks: a small arrowhead on each board
  if (two) for (const y of [0, gap]) { const p = F({ x: x0 + 0.3, y }), d = flip ? -1 : 1; s += `<path d="M${p.x - 6 * d} ${p.y - 6} l${7 * d} 6 l${-7 * d} 6" fill="none" stroke="${INK}" stroke-width="2"/>`; }
  const pt = (V, t) => F(add(V, dir(t), 0.4));
  const geoOf = (V, key) => ({ V: F(V), A: pt(V, ANG[key][0]), B: pt(V, ANG[key][1]) });
  return { svg: `<svg class="pic" viewBox="0 0 320 186">${s}</svg>`, geo: { shown: geoOf(P1, 'ur'), asked: geoOf(askAt[0], askAt[1]), boards: boardsM.map((b) => b.map(F)) } };
}
const CROSS_TOPICS = ['x', 'f', 'z', 'c'];
function crossQ(rnd, sub) {
  const topic = sub || pick(CROSS_TOPICS, rnd), a = pick(fives(35, 145).filter((v) => Math.abs(v - 90) >= 15), rnd), flip = rnd() < 0.5;
  const variant = topic === 'x' ? (rnd() < 0.6 ? 'across' : 'beside') : '';
  const equal = topic === 'f' || topic === 'z' || variant === 'across', answer = equal ? a : 180 - a;
  const { svg, geo } = crossSvg(topic, a, flip, variant, '?', RED, false);
  const wrong = [equal ? 180 - a : a, 90 - a, answer + 10, answer - 10, 360 - a].filter((v) => v > 0 && v < 180);
  const choices = choicesFrom(answer, wrong, rnd, 5);
  const name = { x: 'an X', f: 'an F', z: 'a Z', c: 'a C' }[topic];
  const rule = {
    x: 'Where two boards cross in an X, the angles across from each other are equal, and the angles side by side add up to 180°.',
    f: 'A brace crosses two parallel boards at the same slant, so the matching angles in an F shape are equal.',
    z: 'Between two parallel boards, the two angles in the corners of a Z shape are equal.',
    c: 'Between two parallel boards, the two angles inside a C shape add up to 180°.',
  }[topic];
  const steps = topic === 'x'
    ? (equal ? [`The ? is across the X from ${a}°.`, 'Angles across from each other are equal.', `So it is ${a}°.`]
      : [`The ? sits beside ${a}° on one straight board.`, `Side by side they add up to 180: 180 − ${a} = ${answer}.`, `So it is ${answer}°.`])
    : equal ? [`${a}° and ? sit in ${name} shape.`, `Angles in ${name} between parallel boards are equal.`, `So it is ${a}°.`]
      : [`${a}° and ? sit inside a C shape.`, `They add up to 180: 180 − ${a} = ${answer}.`, `So it is ${answer}°.`];
  return {
    kind: 'cross', title: topic === 'x' ? 'Two boards cross' : 'Parallel boards', svg, geo: { ...geo, a, topic, variant },
    prompt: topic === 'x' ? `Two boards cross. One angle is ${a}°. What is the angle marked ?`
      : `The two horizontal boards are parallel, and a brace crosses both. One angle is ${a}°. What is the angle marked ?`,
    choices, answer, unit: '°',
    why: topic === 'x' ? (equal ? `Across an X the angles are equal, so it is ${a}°.` : `Side by side on a straight board they add up to 180°: 180 − ${a} = ${answer}°.`)
      : equal ? `The two angles make ${name} shape between parallel boards, and those are equal: ${a}°.` : `The two angles sit inside a C shape between parallel boards, and those add up to 180°: 180 − ${a} = ${answer}°.`,
    helper: { kind: 'svg', svg: crossSvg(topic, a, flip, variant, answer + '°', GREEN, true).svg },
    topic, rule, steps,
  };
}

// every topic: the step it belongs to, and how to make one
export const TOPICS = {
  'name-angle': [1, (r) => nameAngleQ(r)], 'tri-corners': [2, (r) => triKindQ(r, 'tri-corners')], 'tri-sides': [2, (r) => triKindQ(r, 'tri-sides')],
  line: [3, (r) => missingQ(r, 'line')], corner: [3, (r) => missingQ(r, 'corner')],
  x: [4, (r) => crossQ(r, 'x')], f: [4, (r) => crossQ(r, 'f')], z: [4, (r) => crossQ(r, 'z')], c: [4, (r) => crossQ(r, 'c')],
  'tri-sum': [5, (r) => thirdAngleQ(r)], hyp: [6, (r) => rightSidesQ(r, 'hyp')], leg: [6, (r) => rightSidesQ(r, 'leg')], reach: [6, (r) => rightSidesQ(r, 'reach')],
};
const MAKERS = { 1: nameAngleQ, 2: triKindQ, 3: missingQ, 4: (r) => crossQ(r, pick(['x', 'x', 'f', 'z', 'c'], r)), 5: thirdAngleQ, 6: rightSidesQ };
// a question for a step of the ladder (the top step: a mix of 2 to 6, the harder ones a bit more often)
export function ladderQuestion(level, rnd = Math.random) {
  level = Math.min(LADDER_TOP, Math.max(1, Math.round(level) || 1));
  const from = level === LADDER_TOP ? pick([2, 3, 4, 4, 5, 5, 6, 6], rnd) : level;
  return { ...MAKERS[from](rnd), level, from };
}
// a fresh question of one topic (the "Try it" after a lesson), at the player's step
export function questionOf(topic, level, rnd = Math.random) {
  const t = TOPICS[topic] || TOPICS['tri-sum'];
  return { ...t[1](rnd), level, from: t[0] };
}
// the topic of a question asked about the board just nailed (made by the older functions above)
export const topicOf = (q) => q.topic || (q.kind === 'slope' ? 'reach' : q.kind === 'length' ? 'hyp' : q.kind === 'angle' ? 'tri-sum' : 'tri-sum');
