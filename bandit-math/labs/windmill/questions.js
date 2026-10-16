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
