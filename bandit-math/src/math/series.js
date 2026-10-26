// series.js: THE ROUND-UP'S MATH, number patterns with a blank ("3, 6, 9, ?", "?, 36, 42, 48", "2/3, 1 1/3, ?, 2 2/3").
// One maker for the whole ladder (src/levels/place/roundup.js holds the levels as plain data; its example() calls
// seriesCard below, and so does the job: one source). A card is one series with one blank; the herd carries a few
// numbers, one of them right, the others the real slips kids make on a series:
//   byOne      counted on by 1 instead of by the step (6, 8, 10, then 11)
//   skip       one step too far or too short (two steps away from the last number)
//   same       a number already on the card
//   step       the step itself (6 for "?, 36, 42, 48")
//   neighbour  the next-door table's number (7 x 8 = 56 among the 6s: 54)
//   sign       below zero without the minus sign (−3 picked as 3)
//   place      0.7, 0.8, 0.9, then "0.10" (ten tenths make 1)
//   part       one part off (a third too far, a quarter short)
//   whole      just the part after the whole number (2/3 for 1 2/3)
//   linear     a growing rule taken as the same step each time
// Where the right one sits among the numbers is picked first, at random (how many of the wrong ones are smaller), so
// "the biggest" or "the middle one" is never a shortcut (the same rule as src/math/early.js pickTargets).
//
// Values are kept in whole UNITS of 1/D (D = 1 for whole numbers, the denominator for fractions, 100 for decimals), so
// no float dust ever reaches a card: 1 1/3 is 4 units of 1/3.
//
// THE API (pure; no page)
//   seriesCard(gen, rand, { read, pickFact, pickTable, size, avoid }) -> a card:
//     { kind, D, terms (units), blank, ans, by (units, signed; null for a rule), ruleKind, texts, text ('3, 6, 9, ?'), rule (the
//       rule card's words, the same), sub, done (the line for a right pick), say (read-aloud words, '' if none), fact
//       ({ a, b } a times fact when the blank is one: 3, 6, ?, 12 is 3 x 3), trap kinds, targets: [{ n, u, label, good,
//       trap }] (n: the steer's number id, the value itself for whole numbers) }
//     gen: the level's settings (see the ladder file); pickFact(tables) -> { a, b } and pickTable(tables) -> t let the
//     job choose the times fact (src/math/facts.js: red facts due back first, weak tables more)
//   whyNot(card, target) -> { slip, line }   the one plain line after a wrong pick
//   nudge(card) -> a line for a kid who is stuck, without the answer
//   picture(card, { reveal, picked }) -> the helper's drawing (src/ui/counthelp.js, helper 'count': the number line
//     with a hop for each step, the blank a "?" until it is shown), or { helper: 'text', reason } where a line can't
//     show it (fractions, decimals, the growing rules)
//   seriesExample(gen, rand) -> { q, a } for the levels page (the same maker)
//   makeSeriesDeck({ ask, rand, pickFact, pickTable }) -> the round-up's card topic (see below)
//   TABLE_ORDER   the times tables in the design's difficulty order (the round-up's series and the wagon's gangs)
//   RANGE, reviewFor({ levels, rider, isOn, rand }) -> review(q), herdReview({ levels, q, isOn, rand }): THE RANGE (below)

import { int, pick, shuffle, numText, frac, fracText, decText, MINUS, TIMES } from '../levels/kit.js';
import { colourOf } from './facts.js';

// The times tables, easiest first: the design's tiers (1 & 2; 3, 5, 10; 4, 9; 6, 7, 8; 11, 12), and inside a tier the
// one a kid has nearly met already first (the 10s and 5s straight after counting by 10s and 5s; the 6s next to the 5s,
// the 8s as double the 4s, the 7s last of the hard ones).
export const TABLE_ORDER = [2, 10, 5, 3, 4, 9, 6, 8, 7, 11, 12];

export const SERIES = {
  size: 5,          // numbers on a card's herd (one right)
  easySize: 4,      // ... on a read-aloud level's card (fewer to read)
  cards: 3,         // cards in a round-up wave
};

const WORD = { 2: 'half', 3: 'third', 4: 'quarter', 5: 'fifth', 6: 'sixth', 8: 'eighth', 10: 'tenth', 100: 'hundredth' };

// ---- writing values ----------------------------------------------------------------------------------------------

// Halves, thirds and quarters are written with their own characters (2¼, ⅔, −1½): on a card or over a steer "2 1/4"
// reads as "21/4". Any other fraction is written out ("1 1/5").
const GLYPH = { '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾' };
export function textOf(u, D) {
  if (D === 1) return numText(u);
  if (D === 100) return decText(u / 100);
  const t = fracText(frac(u, D));
  const m = /^(−?)(?:(\d+) )?(\d+\/\d+)$/.exec(t);
  return m && GLYPH[m[3]] ? `${m[1]}${m[2] || ''}${GLYPH[m[3]]}` : t;
}
const absText = (u, D) => textOf(Math.abs(u), D);

// ---- making a series ---------------------------------------------------------------------------------------------

const blankAt = (g, terms, rand) => (g.blank === 'end' ? terms - 1 : int(0, terms - 1, rand));

// A table's series with the blank on the fact table x b: the blank's place, then the start that puts b there (the
// series stays within table x 1 .. table x 12).
function tableSeries(t, b, terms, rand, g) {
  const places = [];
  for (let p = 0; p < terms; p++) { const k0 = b - p; if (k0 >= 1 && k0 + terms - 1 <= 12) places.push(p); }
  const p = g.blank === 'end' && places.includes(terms - 1) ? terms - 1 : pick(places.length ? places : [0], rand);
  const k0 = Math.max(1, Math.min(13 - terms, b - p));
  return { terms: Array.from({ length: terms }, (_, i) => (k0 + i) * t), blank: p };
}

// gen -> { kind, D, terms, blank, by, rule? }
function makeSeries(g, rand, { pickFact = null, pickTable = null } = {}) {
  const n = g.terms || 4;
  if (g.kind === 'series') {
    const by = g.by;
    if (g.table) {
      const f = pickFact ? pickFact([g.table]) : null;
      const b = f && f.b >= 1 && f.b <= 12 ? f.b : int(1, 12, rand);
      return { D: 1, by, ...tableSeries(g.table, b, n, rand, g) };
    }
    let start;
    if (g.cross) {
      // counting on over a ten: 27, 28, 29, ? (the ten comes in the series)
      const ten = 10 * int(g.cross[0], g.cross[1], rand);
      start = ten - int(1, n - 1, rand);
    } else {
      start = int(g.from[0], g.from[1], rand);
      if (by > 1) start = Math.max(by, Math.round(start / by) * by);
    }
    return { D: 1, by, terms: Array.from({ length: n }, (_, i) => start + i * by), blank: blankAt(g, n, rand) };
  }
  if (g.kind === 'down') {
    let t, k;
    const f = pickFact ? pickFact(g.tables) : null;
    if (f && g.tables.includes(f.a) && f.b >= 1) { t = f.a; k = f.b; } else { t = pickTable ? pickTable(g.tables) : pick(g.tables, rand); k = int(1, 12, rand); }
    // counting down from table x top: the blank on the fact t x k
    const blank = int(0, n - 1, rand);
    let top = k + blank;
    if (top > 12) top = 12;
    if (top - (n - 1) < 1) top = n;
    const terms = Array.from({ length: n }, (_, i) => (top - i) * t);
    const bi = terms.indexOf(k * t);
    return { D: 1, by: -t, terms, blank: bi >= 0 ? bi : blank };
  }
  if (g.kind === 'step') {
    // the same odd step each time (never a table a kid has just counted in, so it can't be read off the times tables
    // alone), starting anywhere; down: going down, staying at 0 or above
    const steps = []; for (let s = g.by[0]; s <= g.by[1]; s++) if (![1, 2, 5, 10].includes(s)) steps.push(s);
    const s = pick(steps, rand);
    let start = int(g.from[0], g.from[1], rand);
    if (start % s === 0) start += int(1, s - 1, rand);
    if (g.down) {
      const terms = Array.from({ length: n }, (_, i) => start + (n - 1 - i) * s);
      return { D: 1, by: -s, terms, blank: blankAt(g, n, rand) };
    }
    return { D: 1, by: s, terms: Array.from({ length: n }, (_, i) => start + i * s), blank: blankAt(g, n, rand) };
  }
  if (g.kind === 'rule') {
    const r = pick(g.rules, rand);
    let x = r === 'grow' ? int(1, 10, rand) : r === 'x3' ? int(1, 2, rand) : r === 'double' ? int(1, 6, rand) : int(1, 4, rand);
    const terms = [x];
    for (let i = 1; i <= n; i++) {
      x = r === 'x2+1' ? 2 * x + 1 : r === 'x2-1' ? 2 * x - 1 : r === 'x3' ? 3 * x : r === 'double' ? 2 * x : x + i;
      terms.push(x);
    }
    // the blank at the end: a growing rule is read from the numbers before it (5 numbers show, the 5th is the blank)
    return { D: 1, by: null, rule: r, terms, blank: terms.length - 1 };
  }
  if (g.kind === 'frac') {
    // counting by a fraction: den, and the step's top (2/3: den 3, by 2), or steps: [[top, den], ...]; start a whole
    // number of steps along; neg: the series crosses zero
    const [by, den] = g.steps ? pick(g.steps, rand) : [pick(Array.isArray(g.by) ? g.by : [g.by], rand), pick(g.den, rand)];
    let start;
    if (g.neg) start = -by * int(2, 3, rand) - (rand() < 0.5 ? 0 : by);   // (−1 1/2, −1, −1/2, 0 or one more)
    else start = by * int(1, g.most || 3, rand);
    const terms = Array.from({ length: n }, (_, i) => start + i * by);
    return { D: den, by, terms, blank: blankAt(g, n, rand) };
  }
  if (g.kind === 'dec') {
    // counting by a decimal (in hundredths); cross: the series passes a whole number (0.8, 0.9, 1, 1.1)
    const by = Math.round(pick(g.by, rand) * 100);
    let start;
    if (g.cross) { const whole = 100 * int(1, 3, rand), k = int(1, n - 1, rand); start = whole - k * by; }
    else start = by * int(1, g.most || 6, rand);
    return { D: 100, by, terms: Array.from({ length: n }, (_, i) => start + i * by), blank: blankAt(g, n, rand) };
  }
  if (g.kind === 'neg') {
    // across zero: down (6, 3, 0, ?) or up from below zero (−9, −6, ?, 0)
    const by = pick(g.by, rand);
    if (g.up) {
      const start = -by * int(n - 1, n + 1, rand);
      return { D: 1, by, terms: Array.from({ length: n }, (_, i) => start + i * by), blank: blankAt(g, n, rand) };
    }
    const start = by * int(1, n - 2, rand);
    const terms = Array.from({ length: n }, (_, i) => start - i * by);
    // the blank on the far side of zero or at zero's neighbour: crossing zero is the point of the level
    const below = terms.map((v, i) => (v <= 0 ? i : -1)).filter((i) => i > 0);
    return { D: 1, by: -by, terms, blank: below.length ? pick(below, rand) : n - 1 };
  }
  throw new Error('series: no maker for ' + g.kind);
}

// ---- the wrong numbers ---------------------------------------------------------------------------------------------

// the slips this card allows: [{ u, trap, w, label? }]
function slipsOf(c, g) {
  const { terms, blank, ans: a, by, D } = c, out = [];
  const onCard = (u) => terms.some((v, i) => i !== blank && v === u);
  const add = (u, trap, w, label) => out.push({ u, trap, w, label });
  if (by == null) {
    // a growing rule: the same step as the last one (linear), the last number's double, one off
    const last = terms[blank - 1], prev = terms[blank - 2];
    add(last + (last - prev), 'linear', 3);
    if (c.ruleKind === 'x2+1' || c.ruleKind === 'x2-1') add(2 * last, 'half', 2.5);
    if (c.ruleKind === 'double') add(last + last / 2, 'linear', 1);
    add(a + 1, 'near', 1.5); add(a - 1, 'near', 1.5); add(a + 2, 'near', 1);
    add(last, 'same', 1);
    return out;
  }
  const s = Math.sign(by) || 1, step = Math.abs(by);
  for (const k of [1, -1, 2, -2]) {
    const u = a + k * by;
    if (onCard(u)) add(u, 'same', Math.abs(k) === 1 ? 1.2 : 0.5);
    else add(u, 'skip', Math.abs(k) === 1 ? 2.5 : 1);
  }
  // counted by one (D = 1), or one piece off (a third, a tenth: a fraction or decimal's own piece)
  const unit = D === 100 ? (step % 10 === 0 ? 10 : 0) : 1;
  if (unit && step > unit) {
    if (blank > 0) add(terms[blank - 1] + s * unit, D === 1 ? 'byOne' : 'part', 2.5);
    if (blank < terms.length - 1) add(terms[blank + 1] - s * unit, D === 1 ? 'byOne' : 'part', 2);
    add(a + unit, D === 1 ? 'near' : 'part', 1.2); add(a - unit, D === 1 ? 'near' : 'part', 1.2);
  }
  if (D === 1 && blank === 0 && step > 2) add(step, 'step', 1.4);
  if (c.fact && c.fact.a >= 2) {
    // the next-door tables' number for the same fact (54 for 6 x 9 among the 7s' 63)
    for (const t2 of [c.fact.a - 1, c.fact.a + 1]) if (t2 >= 2 && t2 <= 12) add(t2 * c.fact.b, 'neighbour', 1.3);
  }
  if (terms.some((v) => v < 0) && a !== 0) add(-a, 'sign', 3);
  if (D === 100 && a % 100 === 0 && blank > 0 && by > 0) {
    // 0.8, 0.9, then "0.10" (ten tenths make 1); 0.5, 0.75, then "0.100": the pieces added up as whole numbers
    const [w, f = ''] = decText(terms[blank - 1] / 100).split('.');
    const sf = String(by % 100).padStart(2, '0').slice(0, Math.max(1, f.length)).padEnd(f.length, '0');
    if (f) add(terms[blank - 1] + 1, 'place', 3, `${w}.${Number(f) + Number(sf)}`);   // (its value only orders it among the others)
  }
  if (D > 1 && D !== 100 && Math.abs(a) > D && a % D !== 0) {
    // just the part after the whole number (2/3 for 1 2/3)
    add(Math.sign(a) * (Math.abs(a) % D), 'whole', 2);
  }
  return out;
}

// the card's herd: the answer and size - 1 slips, the answer's place among them picked first, at random
function targetsOf(c, slips, size, rand, { min, avoid = null }) {
  const { ans: a, D } = c;
  const labelOf = (s) => s.label || textOf(s.u, D);
  const seen = new Set([textOf(a, D)]);
  const ok = (s) => Number.isInteger(s.u) && s.u >= min && s.u !== a && !seen.has(labelOf(s));
  const pool = [];
  for (const s of slips) if (ok(s)) { seen.add(labelOf(s)); pool.push({ ...s, w: (s.w ?? 1) * (avoid != null && s.u === avoid ? 0.15 : 1) }); }
  const want = Math.max(1, size - 1);
  const top = (D === 1 ? 1 : Math.max(1, Math.abs(c.by || 1)));
  const belowRoom = Math.min(want, Math.floor((a - min) / top));
  const below = Math.floor(rand() * (Math.max(0, belowRoom) + 1));
  const out = [];
  const fill = (side, k) => {
    const mine = pool.filter((x) => (side < 0 ? x.u < a : x.u > a));
    let got = 0;
    while (got < k && mine.length) {
      let sum = 0; const ws = mine.map((x) => (sum += x.w));
      const r = rand() * sum; const i = ws.findIndex((v) => v > r);
      const s = mine.splice(i < 0 ? mine.length - 1 : i, 1)[0]; pool.splice(pool.indexOf(s), 1);
      out.push(s); got++;
      if (s.trap === 'same') {   // (one number from the card at most: more would be a giveaway that they're wrong)
        for (const y of [...mine]) if (y.trap === 'same') mine.splice(mine.indexOf(y), 1);
        for (const y of [...pool]) if (y.trap === 'same') pool.splice(pool.indexOf(y), 1);
      }
    }
    // topped up with numbers a few pieces away (never a slip already used)
    for (let d = 2; got < k && d <= 14; d++) {
      const s = { u: a + side * d * (D === 1 ? 1 : top), trap: 'other' };
      if (ok(s)) { seen.add(labelOf(s)); out.push(s); got++; }
    }
    return got;
  };
  const lo = fill(-1, below);
  fill(1, want - lo);
  if (out.length < want) fill(-1, want - out.length);
  const all = shuffle([{ u: a, trap: null, good: true }, ...out.map((s) => ({ ...s, good: false }))], rand);
  return all.map((s, i) => ({ n: D === 1 && !s.label ? s.u : 1000 + i, u: s.u, label: labelOf(s), good: !!s.good, trap: s.trap || null }));
}

// ---- the card's words ----------------------------------------------------------------------------------------------

function stepWords(c) {
  if (c.by == null) {
    return { double: 'double it each time', x3: 'times 3 each time', 'x2+1': 'double it and add 1', 'x2-1': 'double it and take away 1',
      grow: 'the step grows by 1 each time' }[c.ruleKind] || 'the same rule each time';
  }
  return `${c.by > 0 ? 'up' : 'down'} ${absText(c.by, c.D)} each time`;
}
// the sum that makes the blank: '42 + 6 = 48', or back from the next one '36 − 6 = 30'; a rule's own working
function working(c) {
  const T = (u) => textOf(u, c.D), { terms, blank, ans: a } = c;
  if (c.by == null) {
    const last = terms[blank - 1], prev = terms[blank - 2];
    switch (c.ruleKind) {
      case 'double': return `${T(last)} ${TIMES} 2 = ${T(a)}`;
      case 'x3': return `${T(last)} ${TIMES} 3 = ${T(a)}`;
      case 'x2+1': return `${T(last)} ${TIMES} 2 + 1 = ${T(a)}`;
      case 'x2-1': return `${T(last)} ${TIMES} 2 ${MINUS} 1 = ${T(a)}`;
      case 'grow': return `the steps go +${last - prev - 1}, +${last - prev}, then +${a - last}: ${T(last)} + ${a - last} = ${T(a)}`;
      default: return T(a);
    }
  }
  const st = absText(c.by, c.D);
  if (blank > 0) return `${T(terms[blank - 1])} ${c.by > 0 ? '+' : MINUS} ${st} = ${T(a)}`;
  return `${T(terms[1])} ${c.by > 0 ? MINUS : '+'} ${st} = ${T(a)}`;
}

function wordsOf(c, read) {
  const T = (u) => textOf(u, c.D);
  const texts = c.terms.map(T);
  const text = texts.map((t, i) => (i === c.blank ? '?' : t)).join(', ');
  const all = texts.join(', ');
  const factLine = c.fact && c.fact.a >= 2 ? ` · ${c.fact.a} ${TIMES} ${c.fact.b} = ${c.fact.a * c.fact.b}` : '';
  const done = `${all}: ${stepWords(c)}${factLine}`;
  let sub = 'Rope the missing number';
  if (c.by === 1 && c.D === 1) sub = c.blank === c.terms.length - 1 ? 'Count on: rope what comes next' : 'Count on by 1: rope the missing number';
  else if (c.by == null) sub = 'Find the rule: rope what comes next';
  // read aloud (src/audio/readaloud.js puts it together from recorded numbers and phrases): counting by 1s as "what
  // comes after 7" or "what comes before 3"; any step with the blank at the end as the numbers, then "what comes next"
  let say = '';
  if (read && c.D === 1 && c.terms.every((v) => Number.isInteger(v) && v >= 0 && v <= 109)) {
    const end = c.blank === c.terms.length - 1;
    if (end) say = `${texts.slice(0, -1).join(', ')}, what comes next`;
    else if (c.by === 1) say = c.blank > 0 ? `what comes after ${texts[c.blank - 1]}` : `what comes before ${texts[1]}`;
  }
  return { texts, text, rule: text, sub, done, say };
}

// ---- the card ------------------------------------------------------------------------------------------------------

export function seriesCard(g, rand, { read = false, pickFact = null, pickTable = null, size = null, avoid = null } = {}) {
  const s = makeSeries(g, rand, { pickFact, pickTable });
  const c = { kind: g.kind, D: s.D, terms: s.terms, blank: s.blank, ans: s.terms[s.blank], by: s.by, ruleKind: s.rule || null, fact: null };
  // the blank is a times fact when the series is a table's (3, 6, ?, 12 is 3 x 3; counting by 5s too; counting on by 1s
  // to 12 is the 1s: 5, 6, ?, 8 is 1 x 7, for the times chart only, never shown or used for a slip)
  const t = c.D === 1 && c.by != null ? Math.abs(c.by) : 0;
  if (t >= 1 && t <= 12 && c.terms.every((v) => v > 0 && v % t === 0) && c.ans / t >= 1 && c.ans / t <= 12) c.fact = { a: t, b: c.ans / t };
  Object.assign(c, wordsOf(c, read));
  const min = c.terms.some((v) => v < 0) || g.neg ? -1e9 : 0;
  c.targets = targetsOf(c, slipsOf(c, g), size || (read ? SERIES.easySize : SERIES.size), rand, { min, avoid });
  c.answer = c.targets.find((x) => x.good).n;
  c.answerText = textOf(c.ans, c.D);
  return c;
}

export function seriesExample(g, rand) {
  const c = seriesCard(g, rand);
  return { q: c.text, a: c.answerText };
}

// ---- words for the kid ---------------------------------------------------------------------------------------------

const PART = (D) => WORD[D] || 'part';
export function whyNot(c, target) {
  const x = typeof target === 'object' && target ? target : c.targets.find((y) => y.n === target) || { u: NaN, label: String(target), trap: 'other' };
  const T = (u) => textOf(u, c.D), a = c.ans, slip = x.good ? null : x.trap || 'other';
  const how = `${stepWords(c).replace(/^./, (m) => m.toUpperCase())}: ${working(c)}.`;
  let first = '';
  if (c.by != null && c.by !== 0 && Number.isFinite(x.u)) {
    const k = Math.round((x.u - a) / c.by);
    if (slip === 'same') first = `${x.label} is already on the card.`;
    else if (slip === 'byOne') first = `These go ${c.by > 0 ? 'up' : 'down'} by ${absText(c.by, c.D)}, not by 1.`;
    else if (slip === 'part') first = `One ${PART(c.D)} off.`;
    else if (slip === 'step') first = `${x.label} is the step, not the missing number.`;
    else if (slip === 'neighbour' && c.fact) first = `${x.label} is in the ${Math.round(x.u / c.fact.b)}s, not the ${c.fact.a}s.`;
    else if (slip === 'sign') first = a < 0 ? `Below zero it needs a minus sign: ${T(a)}.` : `${x.label} is below zero, but this one isn't.`;
    else if (slip === 'place') {
      const f = (decText(c.terms[c.blank - 1] / 100).split('.')[1] || ''), piece = f.length > 1 ? 'hundredths' : 'tenths';
      const m = Number(x.label.split('.')[1]);
      first = `${Number(f)} ${piece} and ${m - Number(f)} ${piece} make ${m} ${piece}: that's a whole one more, not ${x.label}.`;
    }
    else if (slip === 'whole') first = `${x.label} leaves out the whole number.`;
    else if (x.u - a === k * c.by && Math.abs(k) >= 1) first = Math.abs(k) === 1 ? 'That\'s one step too far.' : `That's ${Math.abs(k)} steps away.`;
    else first = 'Not that one.';
  } else if (slip === 'linear') first = 'The steps aren\'t the same each time here.';
  else if (slip === 'half') first = c.ruleKind === 'x2+1' ? 'Doubled, but the 1 wasn\'t added.' : 'Doubled, but the 1 wasn\'t taken away.';
  else if (slip === 'same') first = `${x.label} is already on the card.`;
  else first = 'Not that one.';
  // counting by 1s, the youngest: the counting words
  if (c.D === 1 && c.by === 1) {
    const line = c.blank > 0 ? `After ${T(c.terms[c.blank - 1])} comes ${T(a)}.` : `Before ${T(c.terms[1])} comes ${T(a)}.`;
    return { slip, line: `${first} ${line}` };
  }
  return { slip, line: `${first} ${how}` };
}

export function nudge(c) {
  const T = (u) => textOf(u, c.D);
  if (c.by == null) return `Look at how each number comes from the one before it, then do that to ${T(c.terms[c.blank - 1])}.`;
  const st = absText(c.by, c.D), up = c.by > 0;
  if (c.blank > 0) return `${up ? 'Up' : 'Down'} ${st} each time. What is ${T(c.terms[c.blank - 1])} ${up ? 'and' : 'take away'} ${st}${up ? ' more' : ''}?`;
  return `${up ? 'Up' : 'Down'} ${st} each time, so go back from ${T(c.terms[1])}: ${up ? 'take away' : 'add'} ${st}.`;
}

// The helper's picture: a stretch of the number line with a hop for each step up to the blank (src/ui/counthelp.js).
// Whole numbers only; a fraction, a decimal or a growing rule gets its plain line instead.
export function picture(c, { reveal = false, picked = null, reason = null } = {}) {
  if (c.D !== 1 || c.by == null) return { helper: 'text', reveal, reason: reason || (reveal ? `${stepWords(c).replace(/^./, (m) => m.toUpperCase())}: ${working(c)}.` : nudge(c)) };
  const { terms, blank, ans: a, by } = c, st = Math.abs(by), sign = by > 0 ? '+' : MINUS;
  const pad = Math.max(1, Math.round(st / 2));
  const lo = Math.min(...terms) - pad, hi = Math.max(...terms) + pad;
  let line;
  if (blank > 0) {
    const hops = []; for (let i = 0; i < blank; i++) hops.push({ from: terms[i], to: terms[i + 1], label: `${sign}${st}` });
    line = { lo, hi, start: terms[0], end: a, hops, stops: terms.filter((_, i) => i !== blank), known: terms[blank - 1] };
  } else {
    line = { lo, hi, start: terms[1], end: a, hops: [{ from: terms[1], to: a, label: `${by > 0 ? MINUS : '+'}${st}` }], stops: terms.slice(1), known: terms[1] };
  }
  const pv = picked && Number.isFinite(picked.u) && c.D === 1 ? picked.u : null;
  return { helper: 'count', line, reveal, picked: pv, reason: reason || (reveal ? null : nudge(c)) };
}

// ---- the range: earlier levels mixed in ---------------------------------------------------------------------------------
// The rider works in a RANGE of levels that moves up with them, not one level: most cards are at the rider's level, one
// card in most waves comes from below it (the levels just below, and the earlier times tables the times chart shows red or
// yellow, or with facts never asked yet), and now and then a whole wave is a herd from a herd level just below. So the
// whole times tables keep coming back after their own levels are passed. A card from below goes back with ITS level
// (src/levels/model.js: a right there doesn't move the rider up, a miss one level down counts in full, further down
// less), so the 80% staircase still reads the rider's own level. Nothing from below while the level is being found
// (placement climbs one level per right answer at the rider's own level), or at a level a grown-up dealt (dev).
export const RANGE = {
  back: 6,          // the range: the rider's level and this many levels below it
  cards: 1,         // cards a wave takes from below (never its first: a wave opens at the rider's own level)...
  chance: 0.75,     // ...in this share of the waves (the rest all at the rider's level)
  herd: 0.08,       // share of waves at a card level that are a herd from a herd level in the range below (its 6
                    //   ropes all from below: more would make the range mostly review)
  near: 1,          // a level in the range below: its weight
  red: 2,           // a times table's level below the rider (any distance): this for each red or yellow fact of it...
  gap: 0.12,        // ...and this for each fact of it never asked yet (the chart's gaps get filled in)
};
const tablesOf = (L) => (L.gen.table ? [L.gen.table] : L.gen.kind === 'series' && L.gen.by === 1 && !L.gen.cross && L.gen.from && L.gen.from[1] <= 9 ? [1] : []);
function weighted(list, rand) {
  let sum = 0; for (const [, w] of list) sum += w;
  if (!(sum > 0)) return null;
  let r = rand() * sum;
  for (const [x, w] of list) { r -= w; if (r < 0) return x; }
  return list[list.length - 1][0];
}
// (q: what levelFor gave for the rider's own level) -> a q for a level below it, or null (stay at the rider's level)
export function reviewFor({ levels, rider, isOn = () => true, rand = Math.random } = {}) {
  return (q) => {
    if (!q || q.placing || q.dev || !levels) return null;
    const list = [];
    for (let j = 0; j < q.i; j++) {
      const L = levels[j];
      if (!SERIES_KINDS.includes(L.gen.kind) || !isOn(L.id)) continue;
      let w = q.i - j <= RANGE.back ? RANGE.near : 0;
      for (const t of tablesOf(L)) {
        for (let b = 1; b <= 12; b++) {
          const c = colourOf(rider, t, b);
          if (c === 'red' || c === 'yellow') w += RANGE.red; else if (!c) w += RANGE.gap;
        }
      }
      if (w > 0) list.push([j, w]);
    }
    const j = weighted(list, rand);
    return j == null ? null : { ...q, level: levels[j], id: levels[j].id, i: j, review: true, own: q.id, ownI: q.i };
  };
}
// a whole wave from a herd level in the range below (RANGE.herd of the waves at a card level), or null
export function herdReview({ levels, q, isOn = () => true, rand = Math.random } = {}) {
  if (!q || q.placing || q.dev || !levels || q.level.gen.kind === 'herd' || rand() >= RANGE.herd) return null;
  const list = [];
  for (let j = Math.max(0, q.i - RANGE.back); j < q.i; j++) if (levels[j].gen.kind === 'herd' && isOn(levels[j].id)) list.push([j, 1]);
  const j = weighted(list, rand);
  return j == null ? null : { ...q, level: levels[j], id: levels[j].id, i: j, review: true, own: q.id, ownI: q.i };
}

// ---- the round-up's card topic ---------------------------------------------------------------------------------------
// A wave is a few cards, one after another (the round-up shows one at a time, its own small herd of answers, one right).
// Each card is made at the rider's level asked just before it (ask(): src/levels/model.js levelFor), or for one card a
// wave (RANGE.cards, never the first) at a level below it that review(q) picks (reviewFor above), so the level a card
// was made at goes back with its answer. Only the first try at a card is an answer (a miss leaves the card up:
// rope the right one after, with the line and the picture to help); a card answered after the help came up (8 s of
// thinking, or "Show me") is practice, not an answer. A level that has moved on to a herd ends the wave there (the job
// deals the herd next). Nothing here is saved: a reload deals a new wave.
//   const D = makeSeriesDeck({ ask, rand, pickFact, pickTable, review })
//   D.mode 'cards'; D.topic 'series'
//   D.wave({ cards }) -> { kind: 'card', card, cards, rule } (null at a herd's level)   D.card() the card up now (null
//                                                                                        when the wave is done)
//   D.answer(n, good, id) -> { right, first, helped, card (still up after a miss; null after a right: card() makes the
//                             next once the answer is recorded), waveDone, stale, level (the id the card was made at) }
//   D.explain(card, n) -> { slip, line, numberLine (the picture, shown) }   D.help(card) -> the picture, hidden
//   D.due() -> []   (the herd's comebacks: a series card's miss stays up instead)
const SERIES_KINDS = ['series', 'down', 'step', 'rule', 'frac', 'dec', 'neg'];
export function makeSeriesDeck({ ask, rand = Math.random, pickFact = null, pickTable = null, review = null } = {}) {
  let cur = null, waveN = 0, lastAns = null;
  function make() {
    const own = ask();
    if (!SERIES_KINDS.includes(own.level.gen.kind)) return null;   // (the level has moved on to a herd: this wave ends here)
    const no = cur ? cur.made + 1 : 1;
    let q = own;
    if (review && cur && cur.review.includes(no)) { const r = review(own); if (r && SERIES_KINDS.includes(r.level.gen.kind)) q = r; }
    const L = q.level;
    const c = seriesCard(L.gen, rand, { read: !!L.read, pickFact, pickTable, avoid: lastAns });
    c.id = `${waveN}.${no}`;
    c.level = q.id; c.placing = !!q.placing; c.read = !!L.read; c.rung = own.i + 1; c.review = q !== own;
    c.tried = false; c.helped = false; c.misses = 0;
    if (cur) cur.made++;
    return c;
  }
  const D = {
    mode: 'cards', topic: 'series', payEvery: 6,
    wave({ cards = SERIES.cards } = {}) {
      waveN++;
      cur = { made: 0, cards: Math.max(1, cards), at: 1, card: null, done: false, review: [] };
      // which cards come from below (not the first): RANGE.cards of the 2nd .. last
      const slots = shuffle(Array.from({ length: cur.cards - 1 }, (_, k) => k + 2), rand);
      cur.review = rand() < RANGE.chance ? slots.slice(0, RANGE.cards) : [];
      cur.card = make();
      if (!cur.card) { cur.done = true; return null; }   // (the rider's level is a herd's: the job deals that instead)
      return { kind: 'card', card: cur.card, cards: cur.cards, rule: cur.card.rule };
    },
    card() {
      if (!cur || cur.done) return null;
      if (!cur.card) { cur.card = make(); if (!cur.card) cur.done = true; }   // (null: the level has moved on to a herd)
      return cur.card;
    },
    answer(n, good, id) {
      const c = cur && cur.card;
      if (!c || cur.done || (id != null && id !== c.id)) return { right: good === true, first: false, helped: false, card: c, waveDone: !c, stale: true, level: c ? c.level : null };
      const x = c.targets.find((y) => y.n === n);
      const right = typeof good === 'boolean' ? good : !!(x && x.good);
      const first = !c.tried; c.tried = true;
      const out = { right, first, helped: c.helped, level: c.level, placing: c.placing, stale: false, fact: c.fact };
      if (!right) { c.misses++; return { ...out, card: c, waveDone: false }; }
      lastAns = c.ans;
      // the next card is made when it is asked for (card()), after the job has recorded this answer: it comes from the
      // level the answer leaves the rider on
      if (cur.at >= cur.cards) { cur.done = true; return { ...out, card: null, waveDone: true }; }
      cur.at++; cur.card = null;
      return { ...out, card: null, waveDone: false };
    },
    explain(c, n) {
      const x = c.targets.find((y) => y.n === n) || null;
      const w = whyNot(c, x || n);
      return { ...w, numberLine: picture(c, { reveal: true, picked: x, reason: w.line }) };
    },
    help(c) { if (c) c.helped = true; return c ? picture(c, { reveal: false }) : null; },
    hint(c) { return c ? nudge(c) : ''; },
    due() { return []; },
    get cur() { return cur; },
  };
  return D;
}

