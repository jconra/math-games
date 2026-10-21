// THE DEER PHOTOGRAPHS' MATH: one question with a blank, one right deer. Each deer in the herd wears a number tag; exactly
// one of those numbers fills the blank. The kid photographs that one (src/missions/deerjob.js).
//
// The deer have their own ladder (src/levels/place/deer.js: MISSING NUMBERS AND LEFTOVERS, the agreed design): one more
// and one less, "3 + ? = 5", "8 + ? = 15", "13 − ? = 6", ten more and ten less, "? × 4 = 28", "? ÷ 3 = 6", the leftover
// of a sharing ("17 ÷ 5 = 3, ? left over"), then a simple x ("x + 7 = 12", "3x = 21", "2x + 1 = 9"). The level is the
// rider's level at the deer (src/levels/model.js levelFor: the job asks it for every photo), and this file makes the
// photo from the level's `gen`; the ladder's example() calls the same maker (deerExample), so the levels page shows
// the photos the game really deals. Within a level the numbers grow a little from photo to photo.
//
// The wrong tags are the numbers kids really land on: the number they see, adding where they should take away, the
// wrong way round ("one less" for "one more"), the divisor for the leftover, one off. A wrong pick gets one plain line,
// checked the way a teacher checks it: "That one's 8: 8 is 2 more than 6, not 1." The helper shows the two sides as a
// balance (with the wrong number put in) and the steps to the answer, one line each.
//
//   deerShot(gen, { n, rng, into, count, recent, fact }) -> a shot (fact: a times fact picked for the rider, src/math/
//                                  facts.js pickFact, for the times and sharing levels):
//     { kind, eq: '3 + ? = 5' | 'x + 7 = 12', x (the answer), values: [numbers, one per deer], right (index of x),
//       steps: [{ text, note }] (the first is the question, the last the answer), key (not repeated within `recent`),
//       words (the question in words, for the youngest, or null), say (as it is read aloud from the clips, or null),
//       young (true: a blank to fill, no x; false: an equation in x), solved (the question filled in, "3 + 2 = 5"),
//       start (an equation's line, for the engine; null for a blank), fact ({ a, b } the times fact asked, or null) }
//   makePhoto(rider, { n, rng, recent, level, into, count, fact }) -> deerShot of that level (the job passes the level
//                                  levelFor gave it), with shot.level = its id
//   deerExample(gen, rand) -> { q, a }   (the ladder's example maker)
//   whyNot(shot, v)               -> the one line for a wrong pick
//   balanceFor(shot, v)           -> { left, right, leftText, rightText, leftValue, rightValue, tip: -1 | 0 | 1 }
//   numText(v)                    -> '5', '−5' (the real minus sign)
//
// Nothing here touches the page, so the node tests load it directly (tests/deer.test.mjs).

import { generate, makeRng } from '../lockbox/generate.js';
import { lineText, keySteps, linearForm, solve, applyMove, moveNote, evalSide, xSide, line, num, xt, MINUS, F } from '../lockbox/engine.js';
import { RUNG } from '../lockbox/generate.js';

export const DEERMATH = {
  most: 99,        // no tag bigger than this
  recent: 12,      // questions not dealt again within this many
};
const TIMES = '×', DIVIDE = '÷';

export const numText = (v) => (v < 0 ? MINUS + Math.abs(v) : String(v));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// the top number for this photo: from the level before's top (gen.from) growing to the level's own across its count
function topOf(top, from, into, count) {
  const c = Math.max(1, count || 5), f = clamp((Number(into) || 0) / c, 0, 1);
  const lo = Math.min(top, from ?? top);
  return Math.max(3, Math.round(lo + (top - lo) * Math.min(1, f + 1 / c)));
}

// ---------- the questions, kind by kind ----------
// Each -> { eq, x, slips, words, say, steps, solved, check(v) -> { leftText, leftValue, rightText, rightValue, why } }
// (why: the line after a wrong pick)

function moreQ(g, rng, top) {
  const k = g.by, less = rng.chance(0.5);
  const n = less ? rng.int(k + 1, top) : rng.int(1, top - k);
  const x = less ? n - k : n + k, word = less ? 'less' : 'more';
  const kw = k === 1 ? 'one' : k === 10 ? 'ten' : String(k);
  const sum = less ? `${n} ${MINUS} ${k}` : `${n} + ${k}`;
  return {
    eq: `${k} ${word} than ${n} is ?`, x, words: `What is ${k} ${word} than ${n}?`, say: `${kw} ${word} than ${n}`,
    slips: [n, less ? n + k : n - k, x + 1, x - 1, less ? x - k : x + k],
    steps: [{ text: `${k} ${word} than ${n}`, note: '' }, { text: `${sum} = ${x}`, note: less ? `${k} less: take ${k} away` : `${k} more: add ${k}` }],
    solved: `${k} ${word} than ${n} is ${x}`,
    check: (v) => {
      const d = v - n, by = Math.abs(d);
      const what = d === 0 ? `${v} is ${n} itself` : `${v} is ${by} ${d > 0 ? 'more' : 'less'} than ${n}`;
      // (the balance takes the step back from v: 8 − 1 against 6, so it doesn't show the answer itself)
      const back = less ? v + k : v - k;
      return { leftText: less ? `${v} + ${k}` : `${v} ${MINUS} ${k}`, leftValue: back, rightText: String(n), rightValue: n, why: `${what}, not ${k} ${word}.` };
    },
  };
}
function addQ(g, rng, top) {
  const b = rng.int(Math.max(3, Math.min(top, (g.from ?? 2) + 1)), top), a = rng.int(1, b - 1), x = b - a;
  const first = rng.chance(0.4);
  const eq = first ? `? + ${a} = ${b}` : `${a} + ? = ${b}`;
  return {
    eq, x, words: g.words ? `${first ? 'What' : a} plus ${first ? a : 'what'} equals ${b}?` : null, say: `${a} and what make ${b}`,
    slips: [b + a, b, a, x + 1, x - 1],
    steps: [{ text: eq, note: '' }, { text: `? = ${b} ${MINUS} ${a}`, note: `take the ${a} away from ${b}` }, { text: `? = ${x}`, note: '' }],
    solved: eq.replace('?', x),
    check: (v) => ({ leftText: first ? `${v} + ${a}` : `${a} + ${v}`, leftValue: a + v, rightText: String(b), rightValue: b,
      why: `${first ? `${v} + ${a}` : `${a} + ${v}`} makes ${a + v}, not ${b}.` }),
  };
}
function subQ(g, rng, top) {
  const a = rng.int(Math.max(5, Math.min(top, (g.from ?? 4) + 1)), top), x = rng.int(1, a - 1), b = a - x;
  const eq = `${a} ${MINUS} ? = ${b}`;
  return {
    eq, x, words: g.words ? `${a} take away what leaves ${b}?` : null, say: `${a} take away what leaves ${b}`,
    slips: [a + b, b, a, x + 1, x - 1],
    steps: [{ text: eq, note: '' }, { text: `? = ${a} ${MINUS} ${b}`, note: `what was taken: ${a} take away the ${b} left` }, { text: `? = ${x}`, note: '' }],
    solved: eq.replace('?', x),
    check: (v) => ({ leftText: `${a} ${MINUS} ${v}`, leftValue: a - v, rightText: String(b), rightValue: b,
      why: `${a} ${MINUS} ${v} ${a - v < 0 ? `goes below zero` : `leaves ${a - v}`}, not ${b}.` }),
  };
}
function mulQ(g, rng, top, fact) {
  const x = fact ? fact.a : rng.int(2, g.upTo), b = fact ? fact.b : rng.int(2, g.upTo), c = x * b;
  const eq = `? ${TIMES} ${b} = ${c}`;
  return {
    eq, x, fact: { a: x, b }, slips: [c - b, b, c / b + 1, c / b - 1, x + 2],
    steps: [{ text: eq, note: '' }, { text: `? = ${c} ${DIVIDE} ${b}`, note: 'times backwards: divide' }, { text: `? = ${x}`, note: '' }],
    solved: eq.replace('?', x),
    check: (v) => ({ leftText: `${v} ${TIMES} ${b}`, leftValue: v * b, rightText: String(c), rightValue: c, why: `${v} ${TIMES} ${b} makes ${v * b}, not ${c}.` }),
  };
}
function divQ(g, rng, top, fact) {
  const d = fact ? fact.a : rng.int(2, g.upTo), q = fact ? fact.b : rng.int(2, g.upTo), x = d * q;
  const eq = `? ${DIVIDE} ${d} = ${q}`;
  return {
    eq, x, fact: { a: d, b: q }, slips: [q, d * (q + 1), d * (q - 1), q + d, d], tidy: (v) => v % d === 0,
    steps: [{ text: eq, note: '' }, { text: `? = ${q} ${TIMES} ${d}`, note: 'sharing backwards: times' }, { text: `? = ${x}`, note: '' }],
    solved: eq.replace('?', x),
    check: (v) => {
      const even = v % d === 0;
      return { leftText: `${v} ${DIVIDE} ${d}`, leftValue: v / d, leftShow: even ? String(v / d) : `${Math.floor(v / d)} r ${v % d}`, rightText: String(q), rightValue: q,
        why: even ? `${v} ${DIVIDE} ${d} makes ${v / d}, not ${q}.` : `${v} doesn't share into ${d}s evenly.` };
    },
  };
}
function leftQ(g, rng, top, fact) {
  const d = rng.int(g.by[0], g.by[1]), q = rng.int(2, 9), r = rng.int(1, d - 1), n = q * d + r;
  const eq = `${n} ${DIVIDE} ${d} = ${q}, ? left over`;
  return {
    eq, x: r, fact: { a: q, b: d }, words: `${n} shared into groups of ${d} makes ${q} groups. How many are left over?`,
    slips: [d, q, r + 1, r - 1, d - r, n - q * d + d],
    steps: [{ text: eq, note: '' }, { text: `${q} ${TIMES} ${d} = ${q * d}`, note: `${q} groups of ${d}` }, { text: `${n} ${MINUS} ${q * d} = ${r}`, note: 'what is left' }, { text: `? = ${r}`, note: '' }],
    solved: `${n} ${DIVIDE} ${d} = ${q}, ${r} left over`,
    check: (v) => ({ leftText: `${q} ${TIMES} ${d} + ${v}`, leftValue: q * d + v, rightText: String(n), rightValue: n,
      why: v >= d ? `${v} left over makes another group of ${d}.` : `${q} groups of ${d} and ${v} more make ${q * d + v}, not ${n}.` }),
  };
}

// a simple x: x + a = b, x − a = b, ax = b, ax + b = c (counting numbers), checked with the lock box's own engine
function xQ(g, rng, top, fact) {
  const s = rng.pick(g.shapes);
  let L, R, x, fct = null;
  if (s === 'x+a=b') { const a = rng.int(1, 12); x = rng.int(1, 15); L = rng.chance(0.25) ? [num(a), xt(1)] : [xt(1), num(a)]; R = [num(x + a)]; }
  else if (s === 'x-a=b') { const a = rng.int(1, 9); x = rng.int(a + 1, 20); L = [xt(1), num(-a)]; R = [num(x - a)]; }
  else if (s === 'ax=b') { const a = fact ? fact.a : rng.int(2, 9); x = fact ? fact.b : rng.int(2, 10); L = [xt(a)]; R = [num(a * x)]; fct = { a, b: x }; }
  else { const a = rng.int(2, 6), b = rng.int(1, 15); x = rng.int(1, 10); L = [xt(a), num(b)]; R = [num(a * x + b)]; }
  if (rng.chance(0.2)) [L, R] = [R, L];
  const start = line(L, R);
  return { start, x, fact: fct, eq: lineText(start), slips: slipsFor(start, x), steps: stepsFor(start, x), solved: null };
}

// The numbers a kid lands on by mistake, for the line a·x + b = c·x + d (worked out from both sides):
//   added instead of taking away: (d + b) / (a − c); forgot to divide: d − b; multiplied instead: (d − b) · (a − c);
//   the sign flipped; one or two off
const isWhole = (f) => f && f.d === 1 && Number.isFinite(f.n);
function slipsFor(start, x) {
  const p = linearForm(start.L), q = linearForm(start.R);
  const a = p.a.sub(q.a), top = q.b.sub(p.b), out = [];
  const add = (f) => { if (isWhole(f)) out.push(f.n); };
  if (!a.isZero()) add(q.b.add(p.b).div(a));
  if (!a.abs().isOne()) { add(top); add(top.mul(a)); }
  out.push(x + 1, x - 1, x + 2, x - 2);
  return out;
}
// the steps that solve it, one move a line, as the lock box's fewest-moves search finds them
function stepsFor(start, x) {
  const st = RUNG.R6.stage;
  const s = solve(start, st, { maxDepth: 3 });
  const steps = [{ text: lineText(start), note: '' }];
  let l = start;
  for (const m of s.path || []) {
    const next = applyMove(l, m); if (!next) break;
    l = next.out; steps.push({ text: lineText(l), note: moveNote(m) });
  }
  if (steps.length === 1) steps.push({ text: `x = ${numText(x)}`, note: '' });
  // (written the way round a kid says the answer: "16 = x" ends as "x = 16")
  const last = steps[steps.length - 1];
  if (/^[^x]+ = x$/.test(last.text)) last.text = `x = ${last.text.replace(/ = x$/, '')}`;
  return steps;
}

const KINDS = { more: moreQ, add: addQ, sub: subQ, mul: mulQ, div: divQ, left: leftQ, x: xQ };

// n tags: the answer and n − 1 slips (no repeats, counting numbers, never above DEERMATH.most); a tag whose check comes
// out tidy is taken first (a sharing that comes out even teaches more than "17 ÷ 3 is 5 r 2")
function tagValues(Q, n, rng, tidy = () => true) {
  const ok = (v) => Number.isInteger(v) && v !== Q.x && v > 0 && v <= DEERMATH.most;
  const real = rng.shuffle(Q.slips.slice(0, -2)), near = rng.shuffle(Q.slips.slice(-2));
  const picked = [];
  for (const pass of [tidy, () => true]) {
    for (const v of [...real, ...near]) if (ok(v) && pass(v) && !picked.includes(v) && picked.length < n - 1) picked.push(v);
    for (let k = 1; picked.length < n - 1 && k < 40; k++) for (const v of [Q.x + k, Q.x - k]) if (ok(v) && pass(v) && !picked.includes(v) && picked.length < n - 1) picked.push(v);
  }
  return rng.shuffle([Q.x, ...picked]);
}

export function deerShot(gen, { n = 4, rng = makeRng(), into = 0, count = 5, recent = [], fact = null } = {}) {
  n = clamp(Math.round(n), 2, 6);
  const make = KINDS[gen.kind];
  if (!make) throw new Error('deer: no maker for ' + gen.kind);
  const seen = new Set(recent);
  let Q = null, key = '';
  for (let tries = 0; tries < 40; tries++) {
    const top = topOf(gen.top ?? 20, gen.from, into, count);
    const q = make(gen, rng, top, tries < 5 ? fact : null);
    if (!q || q.x <= 0 || q.x > DEERMATH.most) continue;
    key = `${gen.kind}:${q.eq}`;
    Q = q;
    if (!seen.has(key)) break;
  }
  const young = gen.kind !== 'x';
  const tidy = Q.tidy || (gen.kind === 'x' ? (v) => [Q.start.L, Q.start.R].every((s) => { const e = evalSide(s, F(v)); return e.d === 1 && Math.abs(e.n) <= 150; })
    : () => true);
  const values = tagValues(Q, n, rng, tidy);
  return {
    kind: gen.kind, eq: Q.eq, x: Q.x, values, right: values.indexOf(Q.x), steps: Q.steps, key,
    words: gen.words || gen.kind === 'left' ? Q.words || null : null, say: gen.read ? Q.say || null : null,
    young, solved: young ? Q.solved : `${Q.eq.replace(/\s*$/, '')}`, start: Q.start || null, fact: Q.fact || null, q: Q,
  };
}

// The photo for this rider at this level (the job asks levelFor for the level and passes it).
export function makePhoto(rider, { n = 4, rng = makeRng(), recent = [], level, into = 0, count = 5, fact = null } = {}) {
  if (!level || !level.gen) throw new Error('deer: makePhoto needs a level');
  const shot = deerShot({ ...level.gen, read: !!level.read }, { n, rng, into, count, recent, fact });
  shot.level = level.id;
  return shot;
}

export function deerExample(gen, rand, { into = null, count = 5 } = {}) {
  const rng = makeRng(Math.floor(rand() * 2 ** 32));
  const s = deerShot(gen, { n: 4, rng, into: into ?? Math.floor(rand() * count), count });
  return { q: s.young ? s.eq : s.eq, a: s.young ? String(s.x) : `x = ${numText(s.x)}` };
}

// ---------- after a wrong pick ----------

// the x side first: "x + 7" is checked against "12", whichever way round the equation was written
function sides(shot) {
  const s = xSide(shot.start);
  return s === 'R' ? [shot.start.R, shot.start.L, s] : [shot.start.L, shot.start.R, s];
}

// "That one's 8: 8 is 2 more than 6, not 1."  "That one's 7: check, 7 + 7 is 14, not 12."
export function whyNot(shot, v) {
  if (shot.young) return `That one's ${numText(v)}: ${shot.q.check(v).why}`;
  const [A, B] = sides(shot);
  const a = keySteps(A, v), b = keySteps(B, v);
  return `That one's ${numText(v)}: check, ${a[0]} is ${a[a.length - 1]}, not ${b[b.length - 1]}.`;
}

// the two sides with v put in, for the balance picture (tip: which way the beam leans: −1 left pan down, 1 right)
export function balanceFor(shot, v) {
  if (shot.young) {
    const c = shot.q.check(v);
    const lv = c.leftValue, rv = c.rightValue;
    const same = (t, v) => (t === v ? '' : t);   // (a pan holding a plain number shows it once)
    return { left: lv, right: rv, leftText: same(c.leftText, c.leftShow ?? numText(lv)), rightText: same(c.rightText, numText(rv)), leftValue: c.leftShow ?? numText(lv), rightValue: numText(rv),
      tip: lv === rv ? 0 : lv > rv ? -1 : 1 };
  }
  const [A, B] = sides(shot);
  const l = evalSide(A, F(v)), r = evalSide(B, F(v));
  const a = keySteps(A, v), b = keySteps(B, v);
  const lv = l.valueOf(), rv = r.valueOf();
  return { left: lv, right: rv, leftText: a[0], rightText: b[0], leftValue: a[a.length - 1], rightValue: b[b.length - 1],
    tip: lv === rv ? 0 : lv > rv ? -1 : 1 };
}
