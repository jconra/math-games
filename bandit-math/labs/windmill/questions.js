// THE MATH, NOW AND THEN: when a board just nailed up closes a triangle with two others (or with the ground), the miller
// may ask one question about that very triangle. Two kinds:
//   angle   the three corners of any triangle add up to 180 degrees: two are shown, find the third
//   length  a right-angled triangle whose sides are whole feet (3-4-5, 6-8-10, 5-12-13, 8-15-17): two sides are shown,
//           find the third (most often where the brace lands: how far along the other board)
// And one about the tower's own size: when a crosspiece closes a bay (posts both sides, the ground, a crosspiece or
// the beams below) whose width and height are the short sides of a whole-number right triangle, how long a brace
// reaches from corner to corner (the stones set 3 feet apart and a crosspiece 4 feet up make a 5 foot brace).
// The triangles are on one plane (any plane: an outer wall or an inside one), from tower.js planeSegments.
// Pure functions (no page, no three.js) so node can test them.
import { touch } from './touch.js';

export const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17]];
const GROUND = { id: 'ground', ax: -100, ay: 0, bx: 100, by: 0, len: 200, ground: true };

// the triangles a new board makes on its face: [{ pts: [P (new & a), Q (new & b), R (a & b)], a, b }] where a, b are the
// other two sides (a board or the ground)
export function trianglesOf(segs, newId) {
  const all = [...segs, GROUND];
  const me = all.find((s) => s.id === newId); if (!me) return [];
  const hits = [];
  for (const o of all) {
    if (o === me) continue;
    for (const c of touch(me, o)) hits.push({ o, x: c.x, y: c.y });
  }
  const out = [];
  for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
    const A = hits[i], B = hits[j];
    if (A.o === B.o) continue;
    for (const c of touch(A.o, B.o)) {
      const P = { x: A.x, y: A.y }, Q = { x: B.x, y: B.y }, R = { x: c.x, y: c.y };
      const area = Math.abs((Q.x - P.x) * (R.y - P.y) - (R.x - P.x) * (Q.y - P.y)) / 2;
      const sides = [dist(P, Q), dist(Q, R), dist(R, P)];
      if (area < 0.8 || Math.min(...sides) < 0.9) continue;
      out.push({ pts: [P, Q, R], a: A.o, b: B.o });
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
const nameOf = (s) => (s.ground ? 'the ground' : s.corner ? 'the corner post' : s.post ? 'the post' : Math.abs(s.ay - s.by) < 0.05 * s.len ? 'the crosspiece' : Math.abs(s.ax - s.bx) < 0.05 * s.len ? 'the post' : 'the other board');

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
    prompt: `This bay is ${Math.round(w)} ft wide and ${Math.round(h)} ft tall. How long a brace reaches from corner to corner?`,
    choices, answer: C, unit: ' ft',
    why: `Square the two short sides and add: ${s[0]}×${s[0]} + ${s[1]}×${s[1]} = ${s[0] * s[0]} + ${s[1] * s[1]} = ${C * C}, and ${C}×${C} = ${C * C}. So the brace is ${C} ft.`,
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
    ? `This triangle has a square corner. Its short sides are ${known[0]} ft and ${known[1]} ft. How long is the long side?`
    : `Your ${s[0]} ft board is the long side, and the other short side is ${known.find((v) => v !== s[0])} ft. How far along ${nameOf(along)} does it land?`;
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

// ── the slope of a leaning wall ──────────────────────────────────────────────────────────────────────────────────────
// When a board goes up in a wall that leans, the miller may ask about the lean itself, as a rate: so many inches in for
// every foot up. Three kinds:
//   rate    "This wall leans in 2 inches for every foot up. How far in is it at 6 ft up?"  (2 × 6 = 12 in, which is 1 ft)
//   width   "6 ft across at the stones, leaning in 1½ in a foot on each side: how wide at 8 ft?"  (each side comes in
//           1½ × 8 = 12 in = 1 ft, both sides 2 ft: 4 ft)
//   leg     (now and then: the harder one) a leg L ft long whose top stands r ft in from its foot: how high does it
//           reach? By the right triangle, L² − r²: a whole-number triple where there is one (a 5 ft leg leaning 3 ft
//           reaches 4 ft), else an 8 ft leg leaning 2 ft: 8 × 8 − 2 × 2 = 60, and 7 ft 9 in times itself is about 60.
// spec: { k (inches a foot, by the half inch), dir ('in' | 'out'), base (the width across at the stones when the
// opposite wall leans the same way, else null), legLen (the board's length when it is a leg, else null) }.
// rnd: a 0..1 random function (for tests); hard: how often a leg asks the right-triangle one.
// Every answer is a number (inches for rate and leg, feet for width) with `labels` saying it the carpenter's way.
const halfStr = (v) => { const a = Math.abs(v), f = Math.floor(a + 1e-9), h = a - f > 0.25; return (v < 0 ? '−' : '') + (h ? (f || '') + '½' : String(f)); };
// feet and inches the way a carpenter says them: "4 ft", "4½ ft", "7 ft 9 in", "9 in"
export function ftIn(ft) {
  const inches = Math.round(ft * 12), f = Math.floor(inches / 12), i = inches % 12;
  if (i === 0) return f + ' ft';
  if (i === 6 && f) return f + '½ ft';
  return (f ? f + ' ft ' : '') + i + ' in';
}
const inWords = (inch) => (inch % 12 === 0 && inch >= 12 ? `${inch} in (${inch / 12} ft)` : inch > 12 && inch % 6 === 0 ? `${inch} in (${halfStr(inch / 12)} ft)` : `${halfStr(inch)} in`);
export function slopeQuestion(spec, rnd = Math.random, { hard = 0.3 } = {}) {
  const k = Math.abs(spec.k), dir = spec.dir === 'out' ? 'out' : 'in';
  if (!k) return null;
  if (spec.legLen && rnd() < hard) { const q = legQuestion(spec.legLen, k, rnd); if (q) return q; }
  if (spec.base && rnd() < 0.5) { const q = widthQuestion(spec.base, k, dir, rnd); if (q) return q; }
  return rateQuestion(k, dir, rnd);
}
const pickOf = (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];
const choicesFrom = (answer, wrong, rnd) => shuffle([answer, ...shuffle([...new Set(wrong.filter((v) => v > 0 && Math.abs(v - answer) > 1e-6))], rnd).slice(0, 3)], rnd);
export function rateQuestion(k, dir = 'in', rnd = Math.random) {
  // a height where the answer comes out a whole number of inches, 3 or more (a whole foot or two, when it can)
  const ys = [2, 3, 4, 6, 8, 10, 12].filter((y) => Number.isInteger(k * y) && k * y >= 3);
  if (!ys.length) return null;
  const feetToo = ys.filter((y) => (k * y) % 12 === 0), Y = feetToo.length && rnd() < 0.6 ? pickOf(feetToo, rnd) : pickOf(ys, rnd), A = k * Y;
  const choices = choicesFrom(A, [k + Y, k * (Y - 1), k * (Y + 1), 2 * A, Y, A + 12], rnd).map((v) => Math.round(v * 2) / 2);
  return {
    kind: 'slope', title: 'A leaning wall!', pic: { kind: 'lean', k, Y, dir }, unit: ' in',
    prompt: `This wall leans ${dir} ${halfStr(k)} ${k > 1 ? 'inches' : 'inch'} for every foot up. How far ${dir} is it at ${Y} ft up?`,
    choices, labels: choices.map(inWords), answer: A,
    why: `${halfStr(k)} inches for each foot it climbs, ${Y} feet up: ${halfStr(k)} × ${Y} = ${halfStr(A)} in${A % 12 === 0 ? `, which is ${A / 12} ft` : A > 12 && A % 6 === 0 ? `, which is ${halfStr(A / 12)} ft` : ''}.`,
    helper: { kind: 'steps', k, Y },
  };
}
export function widthQuestion(W, k, dir = 'in', rnd = Math.random) {
  // a height where each side has moved a whole number of inches and the width comes out on the half foot, 1 ft or more
  const sg = dir === 'in' ? -1 : 1;
  const ys = [2, 4, 6, 8, 10, 12, 16].filter((y) => { const d = k * y; return Number.isInteger(d) && (2 * d) % 6 === 0 && W + sg * 2 * d / 12 >= 1; });
  if (!ys.length) return null;
  const whole = ys.filter((y) => Number.isInteger(W + sg * 2 * k * y / 12)), Y = whole.length && rnd() < 0.7 ? pickOf(whole, rnd) : pickOf(ys, rnd);
  const each = k * Y, A = W + sg * 2 * each / 12, one = W + sg * each / 12;
  const choices = choicesFrom(A, [one, A - sg * 1, A + sg * 1, W, W + sg * 2 * each / 24], rnd).map((v) => Math.round(v * 2) / 2);
  return {
    kind: 'slope', title: 'How wide up there?', pic: { kind: 'taper', k, Y, W, dir }, unit: ' ft',
    prompt: `${ftIn(W)} across at the stones, both walls leaning ${dir} ${halfStr(k)} in a foot. How wide is it at ${Y} ft up?`,
    choices, labels: choices.map(ftIn), answer: A,
    why: `Each wall comes ${dir} ${halfStr(k)} × ${Y} = ${inWords(each)}. Both walls: ${inWords(2 * each)}. ${ftIn(W)} ${dir === 'in' ? '−' : '+'} ${ftIn(2 * each / 12)} = ${ftIn(A)}.`,
    helper: { kind: 'taper', k, Y, W, dir },
  };
}
export function legQuestion(L, k, rnd = Math.random) {
  // a whole-number triple with the leg as its long side, when the leg is that long; else the leg's own length leaning
  // 1 to 3 feet, "about" to the inch
  const len = Math.round(L), tri = TRIPLES.filter((t) => t[2] === len);
  let r, h, exact;
  if (Math.abs(L - len) < 0.01 && tri.length) { const t = pickOf(tri, rnd); [r, h] = rnd() < 0.5 ? [t[0], t[1]] : [t[1], t[0]]; if (r > h) [r, h] = [h, r]; exact = true; }
  else { if (Math.abs(L - len) > 0.01 || len < 4) return null; r = 1 + Math.floor(rnd() * 3); h = Math.sqrt(len * len - r * r); exact = false; }
  const A = Math.round(h * 12), wrong = [len * 12, (len - r) * 12, Math.round(Math.sqrt(len * len + r * r) * 12), A + 3, A - 3];
  const choices = choicesFrom(A, wrong, rnd);
  const sq = len * len - r * r;
  return {
    kind: 'slope', title: 'How high does it reach?', pic: { kind: 'leg', L: len, r, k }, unit: '',
    prompt: `A leg ${len} ft long leans so its top stands ${r} ft in from its foot. ${exact ? 'How high' : 'About how high (to the inch)'} does its top reach?`,
    choices, labels: choices.map((v) => ftIn(v / 12)), answer: A,
    why: exact
      ? `The leg is the long side of a right triangle: ${len}×${len} − ${r}×${r} = ${len * len} − ${r * r} = ${sq}, and ${h}×${h} = ${h * h}. So it reaches ${h} ft.`
      : `The leg is the long side of a right triangle: ${len}×${len} − ${r}×${r} = ${len * len} − ${r * r} = ${sq}. Which number times itself makes ${sq}? ${ftIn(A / 12)} is ${(A / 12).toFixed(2)} ft, and ${(A / 12).toFixed(2)} × ${(A / 12).toFixed(2)} ≈ ${sq}. A leaning leg always reaches less high than it is long.`,
    helper: { kind: 'legsq', L: len, r, h: A / 12, exact },
  };
}
