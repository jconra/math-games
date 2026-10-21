// The find-x boxes: the lock boxes below x on both sides. x is on ONE side, so the box is opened by FINDING x: the
// kid taps one of a few keys (numbers), the key's number goes in for x, both sides are worked out, and they match or
// they don't. No moves and no rules yet: those start at x on both sides (the levels' ladder, src/levels/place/
// lockbox.js), where guessing stops being a good way in.
//
// The shapes (gen.shapes in the ladder), each asked with x somewhere a kid can see it:
//   x+a=b  a+x=b   x + 3 = 8, 7 + x = 15        x-a=b   x − 6 = 9        a-x=b   9 − x = 4
//   ax=b           3x = 12 (the times tables backwards)                  x/a=b   x/4 = 3 (x shared into 4 parts)
//   ax+b=c  ax-b=c 2x + 5 = 17, 3x − 4 = 11 (two steps, worked in the head)
// gen = { find: true, shapes, max, from (the level before's max: the numbers grow from there across the level), neg
// (some answers below zero), keys (how many keys: 3 or 4) }
//
// The wrong keys are the numbers kids really land on: adding where they should take away (x + 3 = 8 -> 11), the number
// they see on the other side, forgetting to divide (2x + 5 = 17 -> 12), the sign flipped, one off. Never the number
// printed in the line as the answer (x + 4 = 8 would give itself away), never two keys alike.
//
// Nothing here touches the page, so the node tests check it.
//   findProblem(gen, { rng, into, count, recent, fact }) -> { rung: 'R0b', mode: 'key', find (the shape), key, start
//     (the line), x, kind: 'one', par: 1, route: [], answer, choices, say (read out from the clips, or null), fact
//     ({ a, b }: the times fact it asks, or null) }
//     into / count: how far into its level the rider is (the numbers grow from gen.from to gen.max across it);
//     fact: a times fact picked for the rider (src/math/facts.js pickFact) for the ax = b and x/a = b shapes
//   findHint(problem, level) -> Ask Hob's line (1 try a key, 2 the way back from the answer, 3 the answer)
//   subText(side, v) -> a side with v put in for x, as text ("3 × 5 + 2"); termSub(term, v, first) one term of it

import { num, xt, line, lineText, F, MINUS } from './engine.js';

const TIMES = '×';   // (the times sign a kid knows from the times tables, not the algebra dot)

const nt = (v) => (v < 0 ? MINUS + Math.abs(v) : String(v));

// the top number for this box: from the level before's top, growing to this level's across its count
function topOf(g, into, count) {
  const max = g.max ?? 10, from = Math.min(max, g.from ?? max);
  const f = Math.max(0, Math.min(1, (Number(into) || 0) / Math.max(1, count || 5)));
  return Math.max(3, Math.round(from + (max - from) * Math.min(1, f + 1 / Math.max(1, count || 5))));
}

// One shape -> { L, R, x, slips: [the numbers kids land on], fact } or null to try again.
function make(shape, g, rng, top, fact) {
  const neg = !!g.neg && rng.chance(0.4);
  // the biggest number in the box is past the level before's top (x + 3 = 13 on "up to 15", not x + 3 = 8)
  const lo = g.from != null && g.from < (g.max ?? 10) ? Math.min(top, g.from + 1) : 3;
  if (shape === 'x+a=b' || shape === 'a+x=b') {
    let x, a;
    if (neg) { a = rng.int(2, Math.min(30, top)); x = -rng.int(1, Math.min(12, a + 6)); }
    else { const b = rng.int(lo, top); x = rng.int(1, b - 1); a = b - x; }
    const b = x + a;
    if (b === 0) return null;
    const L = shape === 'x+a=b' ? [xt(1), num(a)] : [num(a), xt(1)];
    return { L, R: [num(b)], x, slips: [b + a, b, a - b, -x] };
  }
  if (shape === 'x-a=b') {
    let x, a;
    if (neg) { a = rng.int(3, Math.min(30, top)); x = rng.int(1, a - 1); }
    else { x = rng.int(Math.max(2, lo), top); a = rng.int(1, x - 1); }
    const b = x - a;
    if (b === 0) return null;
    return { L: [xt(1), num(-a)], R: [num(b)], x, slips: [b - a, a - b, b, x + 2] };
  }
  if (shape === 'a-x=b') {
    const a = rng.int(lo, top), x = rng.int(1, a - 1), b = a - x;
    return { L: [num(a), xt(-1)], R: [num(b)], x, slips: [a + b, b, a] };
  }
  if (shape === 'ax=b') {
    let a, x;
    if (fact) { a = fact.a; x = fact.b; }
    else if (top > 20) { a = rng.int(2, 9); x = rng.int(11, 15); }
    else { a = rng.int(2, Math.min(10, top)); x = rng.int(2, 10); }
    if (a < 2 || x < 1) return null;
    if (neg) x = -x;
    const b = a * x;
    return { L: [xt(a)], R: [num(b)], x, slips: [b - a, b + a, a * (x + 1), a * (x - 1), -x], fact: Math.abs(x) <= 12 && a <= 12 ? { a, b: Math.abs(x) } : null };
  }
  if (shape === 'x/a=b') {
    let a, b;
    if (fact) { a = fact.a; b = fact.b; }
    else { a = rng.int(2, top > 20 ? 9 : Math.min(10, top)); b = rng.int(2, top > 20 ? 12 : 10); }
    if (a < 2 || b < 1) return null;
    const x = a * b;
    return { L: [xt(F(1, a))], R: [num(b)], x, slips: [a * (b + 1), a * (b - 1), b, a * (b + 2)], fact: a <= 12 && b <= 12 ? { a, b } : null };
  }
  if (shape === 'ax+b=c' || shape === 'ax-b=c') {
    const a = rng.int(2, top > 12 ? 9 : 5);
    let x = rng.int(1, Math.min(top, 10));
    if (neg) x = -x;
    const b = rng.int(1, top > 12 ? 20 : 12);
    const plus = shape === 'ax+b=c';
    const c = plus ? a * x + b : a * x - b;
    if (c === 0 || (!g.neg && c < 0)) return null;
    const L = plus ? (rng.chance(0.2) ? [num(b), xt(a)] : [xt(a), num(b)]) : [xt(a), num(-b)];
    const back = plus ? c - b : c + b;
    return { L, R: [num(c)], x, slips: [plus ? c + b : c - b, back, plus ? (c + b) / a : (c - b) / a, -x] };
  }
  throw new Error('findx: no shape ' + shape);
}

export function findProblem(g, { rng, into = 0, count = 5, recent = [], fact = null } = {}) {
  const top = topOf(g, into, count);
  const seen = new Set(recent);
  const keys = Math.max(3, Math.min(4, g.keys ?? 3));
  let best = null;
  for (let tries = 0; tries < 200; tries++) {
    const shape = rng.pick(g.shapes);
    const m = make(shape, g, rng, top, tries < 20 ? fact : null);
    if (!m) continue;
    const start = line(m.L, m.R);
    // the answer is never a number already printed in the line (it would give itself away)
    const printed = [...m.L, ...m.R].flatMap((t) => (t.t === 'n' ? [Math.abs(t.v.n)] : [Math.abs(t.v.n), t.v.d].filter((k) => k !== 1)));
    if (printed.includes(Math.abs(m.x)) && tries < 150) continue;
    if (Math.abs(m.x) > 99 || printed.some((n) => Math.abs(n) > 99)) continue;
    const key = `F:${lineText(start)}`;
    best = { m, start, key, shape };
    if (!seen.has(key) || tries > 120) break;
  }
  if (!best) return null;
  return keyBox(best, g, rng, keys);
}

// The keys and the read-out for a made box (findProblem above, findProblemFor below)
function keyBox({ m, start, key, shape }, g, rng, keys) {
  // the keys: the answer, then the real slips, then near ones (no repeats; no negatives where the level has none)
  const ok = (v) => Number.isInteger(v) && v !== m.x && v !== 0 && (g.neg || v > 0) && Math.abs(v) <= 199;
  const out = [m.x];
  const slips = rng.shuffle(m.slips.filter(ok));
  for (const v of slips) if (out.length < keys - 1 && !out.includes(v)) out.push(v);
  for (const d of rng.shuffle([1, -1, 2, -2]).concat([3, -3, 4, -4, 5])) {
    const v = m.x + d;
    if (out.length < keys && ok(v) && !out.includes(v)) out.push(v);
  }
  for (const v of slips) if (out.length < keys && !out.includes(v)) out.push(v);
  // read out from the clips where they can say it: "3 and what make 8", "9 take away what leaves 4"
  let say = null;
  const a = m.L.find((t) => t.t === 'n'), b = m.R[0];
  if ((shape === 'x+a=b' || shape === 'a+x=b') && m.x > 0 && a.v.n <= 109 && b.v.n <= 109) say = `${a.v.n} and what make ${b.v.n}`;
  if (shape === 'a-x=b' && a.v.n <= 109) say = `${a.v.n} take away what leaves ${b.v.n}`;
  return { rung: 'R0b', mode: 'key', find: shape, key, start, x: m.x, kind: 'one', par: 1, route: [], answer: m.x,
    choices: rng.shuffle(out), say, fact: m.fact || null };
}

// A find-x box for a two-step equation given from outside (the store's story told backwards: 3x + 5 = 29), for a rider
// still below x on both sides. eq = { a, b, c, x } for ax + b = c (b < 0: ax − |b| = c). The keys are the same slips.
export function findProblemFor(eq, { rng, keys = 4 } = {}) {
  const { a, b, c, x } = eq || {};
  if (![a, b, c, x].every(Number.isInteger) || !a || !b) return null;
  const plus = b > 0, shape = plus ? 'ax+b=c' : 'ax-b=c', bb = Math.abs(b);
  const back = plus ? c - bb : c + bb;
  const m = { L: [xt(a), num(b)], R: [num(c)], x, slips: [plus ? c + bb : c - bb, back, plus ? (c + bb) / a : (c - bb) / a, -x] };
  const start = line(m.L, m.R);
  return keyBox({ m, start, key: `F:${lineText(start)}`, shape }, { neg: x < 0 }, rng, Math.max(3, Math.min(4, keys)));
}

// ---------- what a key does, written out ----------

// One term with v put in for x: "5", "3 × 5", "15 ÷ 3", "−5"; first: it starts its side (no "+" in front)
export function termSub(t, v, first = false) {
  const val = (n) => (n < 0 ? `(${nt(n)})` : String(n));
  if (t.t === 'n') {
    const n = t.v.n;
    return first ? nt(n) : n < 0 ? ` ${MINUS} ${-n}` : ` + ${n}`;
  }
  const c = t.v, neg = c.n < 0, a = Math.abs(c.n);
  let body;
  if (c.d === 1) body = a === 1 ? (first && !neg ? nt(v) : val(v)) : `${a} ${TIMES} ${val(v)}`;
  else body = `${a === 1 ? val(v) : `${a} ${TIMES} ${val(v)}`} ÷ ${c.d}`;
  if (first) return neg ? `${MINUS}${body}` : body;
  return neg ? ` ${MINUS} ${body}` : ` + ${body}`;
}
export function subText(side, v) { return side.map((t, i) => termSub(t, v, i === 0)).join(''); }

// ---------- Ask Hob ----------

export function findHint(p, level) {
  if (level <= 1) return 'Try a key: put its number in for x, then work out each side.';
  if (level >= 3) return `x = ${nt(p.answer)} makes both sides the same.`;
  const L = p.start.L, R = p.start.R;
  const n = (t) => (t ? Math.abs(t.v.n) : 0);
  const a = L.find((t) => t.t === 'n'), xs = L.find((t) => t.t === 'x'), b = R[0];
  const c = xs ? Math.abs(xs.v.n) : 1, d = xs ? xs.v.d : 1;
  switch (p.find) {
    case 'x+a=b': case 'a+x=b': return `What plus ${n(a)} makes ${nt(b.v.n)}? Take ${n(a)} away from ${nt(b.v.n)}.`;
    case 'x-a=b': return `x take away ${n(a)} leaves ${nt(b.v.n)}. Put the ${n(a)} back: ${nt(b.v.n)} + ${n(a)}.`;
    case 'a-x=b': return `${n(a)} take away what leaves ${nt(b.v.n)}? Count up from ${nt(b.v.n)} to ${n(a)}.`;
    case 'ax=b': return `${c} times what makes ${nt(b.v.n)}? Think of the ${c} times table.`;
    case 'x/a=b': return `x shared into ${d} parts gives ${nt(b.v.n)}. So x is ${d} ${TIMES} ${nt(b.v.n)}.`;
    case 'ax+b=c': return `First take the ${n(a)} away from ${nt(b.v.n)}. Then ${c} times what makes that?`;
    case 'ax-b=c': return `First put the ${n(a)} back: ${nt(b.v.n)} + ${n(a)}. Then ${c} times what makes that?`;
    default: return 'Which number for x makes both sides the same?';
  }
}
