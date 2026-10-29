// THE GRAPH TEACHER'S QUESTIONS (the saloon's chalkboard: src/graphteacher.js, the card src/ui/graphcard.js). Points on
// a grid first: find a point ("Find (2, 3)": tap where x and y meet), read a point ("What point is this?", x first), then
// the same in all four quarters (negatives both ways). Later rungs slot in as new kinds of `gen` (the ladder:
// src/levels/place/graphs.js): rise over run from two points drawn, slope by the numbers, point-slope form, point-slope
// to y = mx + b, a line through two points, the parallel line through another point. No page, no three.js: the tests
// run it as it is.
//
//   GRAPH                         the dials (a sitting's questions, its pay, the stuck nudge)
//   RULE                          the one-line rule under "Show me" ("x first: left or right; then y: up or down.")
//   numText(n), pointText(x, y)   "−3" (a true minus), "(2, −3)"
//   pickPoint(gen, rng, avoid)    -> { x, y } on gen's grid: x and y never equal (so swapping them is always wrong),
//                                 at least one negative on a four-quarter grid, zero now and then; avoid: a Set of 'x,y'
//   choicesFor(x, y, gen, rng)    -> 4 answers for "What point is this?" [{ x, y, label, good }]: the right one, x and y
//                                 swapped, and near misses (one off, or a sign flipped on a four-quarter grid); all on the
//                                 grid, no two the same, shuffled
//   makeQuestion(gen, rng, { i, avoid })   -> { kind: 'find' | 'read', lo, hi, x, y, text, answer, choices? }
//     gen: { kind: 'find' | 'read', lo, hi }, or { kind: 'quads', lo, hi } (find and read by turns: i even finds)
//   walk(x, y)                    -> the "Show me" steps: [{ axis: 'x' | 'y', from: [x, y], to: [x, y], n, dir, words }]
//   walkWords(x, y)               -> "right 2, then up 3"
//   wrongFind(tap, want), wrongRead(pick, want), nudge(q)   the lines after a miss, and when the rider is stuck
//   sitting(gen, rng, n)          -> n questions with no point twice (the tests; the game asks one at a time)

export const GRAPH = {
  n: 5,          // questions a sitting
  pay: 5,        // gold for a finished sitting (the store pays 3 an order: five points take about as long as two orders)
  stuck: 25,     // s without an answer: a nudge in words and the Show me button glows (the walk is still the rider's to ask for)
  zero: 0.12,    // the share of points with a 0 in them (on an axis): now and then, not often
};
export const RULE = 'x first: left or right; then y: up or down.';

const MINUS = '−';
export const numText = (n) => (n < 0 ? MINUS + Math.abs(n) : String(n));
export const pointText = (x, y) => `(${numText(x)}, ${numText(y)})`;
const key = (x, y) => `${x},${y}`;
const isFour = (gen) => gen.lo < 0;

export function pickPoint(gen, rng = Math.random, avoid = null) {
  const { lo, hi } = gen, four = isFour(gen);
  const draw = () => {
    if (rng() < GRAPH.zero) return 0;
    if (!four) return 1 + Math.floor(rng() * hi);   // (1..hi)
    const m = 1 + Math.floor(rng() * Math.max(hi, -lo));   // (a size, then a side)
    return rng() < 0.5 ? -Math.min(m, -lo) : Math.min(m, hi);
  };
  let best = null;
  for (let t = 0; t < 200; t++) {
    const x = draw(), y = draw();
    if (x === y) continue;
    if (four && !(x < 0 || y < 0)) continue;
    if (x < lo || x > hi || y < lo || y > hi) continue;
    best = { x, y };
    if (!avoid || !avoid.has(key(x, y))) return best;
  }
  return best || { x: four ? -1 : 1, y: 2 };
}

function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function choicesFor(x, y, gen, rng = Math.random) {
  const { lo, hi } = gen, inGrid = (p) => p.x >= lo && p.x <= hi && p.y >= lo && p.y <= hi;
  const seen = new Set([key(x, y)]), out = [{ x, y, good: true }];
  const take = (p) => { if (out.length >= 4 || !inGrid(p) || seen.has(key(p.x, p.y))) return false; seen.add(key(p.x, p.y)); out.push({ ...p, good: false }); return true; };
  // the swap first (the mistake the ladder is about), then a flipped sign on a four-quarter grid, then near misses
  take({ x: y, y: x });
  if (isFour(gen)) {
    const flips = shuffle([{ x: -x, y }, { x, y: -y }, { x: -x, y: -y }].filter((p) => p.x !== x || p.y !== y), rng);
    for (const p of flips) if (take(p)) break;
  }
  const near = shuffle([{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }, { x: y + 1, y: x }, { x: y, y: x + 1 }], rng);
  for (const p of near) take(p);
  for (let t = 0; out.length < 4 && t < 100; t++) take({ x: lo + Math.floor(rng() * (hi - lo + 1)), y: lo + Math.floor(rng() * (hi - lo + 1)) });
  for (const c of out) c.label = pointText(c.x, c.y);
  return shuffle(out, rng);
}

export function makeQuestion(gen, rng = Math.random, { i = 0, avoid = null } = {}) {
  const lo = gen.lo ?? 0, hi = gen.hi ?? 6, g = { ...gen, lo, hi };
  const kind = gen.kind === 'quads' ? (i % 2 === 0 ? 'find' : 'read') : gen.kind === 'read' ? 'read' : 'find';
  const { x, y } = pickPoint(g, rng, avoid);
  const q = { kind, lo, hi, x, y, answer: pointText(x, y) };
  if (kind === 'find') q.text = `Find ${pointText(x, y)}`;
  else { q.text = 'What point is this?'; q.choices = choicesFor(x, y, g, rng); }
  return q;
}

export function walk(x, y) {
  const ax = Math.abs(x), ay = Math.abs(y);
  const dx = x > 0 ? 'right' : x < 0 ? 'left' : null, dy = y > 0 ? 'up' : y < 0 ? 'down' : null;
  return [
    { axis: 'x', from: [0, 0], to: [x, 0], n: ax, dir: dx, words: dx ? `${dx} ${ax}` : 'x is 0: stay on the up-and-down line' },
    { axis: 'y', from: [x, 0], to: [x, y], n: ay, dir: dy, words: dy ? `${dy} ${ay}` : 'y is 0: stay on the x line' },
  ];
}
export function walkWords(x, y) {
  const [a, b] = walk(x, y);
  return `${a.dir ? a.words : 'no steps across'}, then ${b.dir ? b.words : 'no steps up or down'}`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function wrongFind(tap, want) {
  return `You tapped ${pointText(tap.x, tap.y)}. For ${pointText(want.x, want.y)}, start at 0: ${walkWords(want.x, want.y)}. Tap the lit one.`;
}
export function wrongRead(pick, want) {
  return `${pointText(pick.x, pick.y)} would be ${walkWords(pick.x, pick.y)}. Watch the walk to this one.`;
}
export function nudge(q) {
  if (q.kind === 'find') return `Start at 0. ${cap(walkWords(q.x, q.y))}.`;
  return 'Start at 0. How far across to get under the dot? That is x. Then how far up or down? That is y.';
}

export function sitting(gen, rng = Math.random, n = GRAPH.n) {
  const avoid = new Set(), out = [];
  for (let i = 0; i < n; i++) { const q = makeQuestion(gen, rng, { i, avoid }); avoid.add(key(q.x, q.y)); out.push(q); }
  return out;
}
