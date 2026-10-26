// The math behind the loose-pigs job (missions/pigs.js): a batch of pigs loose in the farm's pig yard, each carrying a
// sum, and two pens whose signs say which answers go where. Herding a pig into the pen with its answer is the kid's
// answer. The pens read like a number line, left to right as you face them from the yard: the lower one on the left.
//   signs   positive & negative sums ("−3 + 8"): NEGATIVE / POSITIVE. The kid only has to see which side of zero the
//           hop lands (the first thing the topic teaches), not the exact number. No pig lands on zero (no 7 − 7): two
//           pens are easier to sort than three, and a zero pen was mostly the zero pairs
//   sizes   for the youngest riders, adding and taking-away sums ("3 + 4", "12 − 5"): LESS THAN 10 / MORE THAN 10, the
//           number in the middle of the step's answers (a round one where it can be), and no pig lands right on it
// Which kind of sum, and how hard, come from the rider's skill model (src/math/skill.js, asked through
// src/math/asking.js: pigsFor): positive & negative once the rider's adding and taking away reach it, else the adding
// or taking-away step at the rider's level. The pigs never tell the model anything back (a running pig can bolt into a
// pen nobody meant). Every pen gets at least one pig.
//
//   PIG_MATH                                   the dials
//   pigsFor(rider, { last, rand })             -> { map, q }: the maker for the next batch and the model's answer (q.step)
//   pigLevel(rider)                            an old rider's positive & negative step (rider.topics.negatives; tests)
//   makePigBatch(rider, { size, rand, level, map, step }) -> { level, map, mode: 'signs' | 'sizes', split, pens: [pen x 2],
//                                              pigs: [pig, ...] }   (map: 'negatives' | 'adding' | 'taking'; step / level:
//                                              that maker's step, else pigLevel)
//     pen = { label (what the sign says: 'NEGATIVE', 'LESS THAN 10'), sub (a small line under it: 'below zero'), value
//             (the side: -1 below the split, 1 above it) }
//     pig = { text ('−3 + 8', '3 + 4'), say, parts: { start, change, op, term }, answer, pen (the index of its pen) }
//   batchAt(gen, { size, rand })               THE GAME'S BATCHES NOW: a batch at a level of the pigs' ladder (src/levels/
//                                              place/pigs.js: more or less than, even or odd, less or more than a half,
//                                              negative or positive); mode 'sizes' | 'parity' | 'half' | 'signs'; each
//                                              pig also has done (where it goes and why) and help (a line for the stuck)
//   penFor(batch, answer)                      the index of the pen an answer belongs in
//   judge(batch, pig, penIndex) -> { right, line, picked }
//     line: one plain line: why the pig doesn't go there (the hop, and where it really lands), or why it does
//     picked: always null (the pens are sides, not numbers: the number line marks no pick)
import { explainPick, problemText, problemWords, numText, LADDER as NEG_LADDER } from '../math/negatives.js';
import { LADDER as ADD_LADDER, problem as addProblem } from '../math/adding.js';
import { LADDER as TAKE_LADDER, problem as takeProblem } from '../math/taking.js';
import { chooseFor, askFor } from '../math/asking.js';

export const PIG_MATH = {
  size: 5,               // pigs in a batch
  maps: ['adding', 'taking', 'negatives'],   // the skill model's makers the pigs deal from (src/math/strands.js)
  splits: [10, 5, 20, 50, 100],              // round numbers the sizes pens prefer (first that sits inside the answers)
};

const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
const int = (lo, hi, rand) => (hi < lo ? lo : lo + Math.floor(rand() * (hi - lo + 1)));
function shuffle(a, rand) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function pigLevel(rider) {
  const T = (rider && rider.topics) || {};
  const st = T.negatives && Number.isFinite(+T.negatives.step) ? Math.round(+T.negatives.step) : 1;
  return Math.max(1, Math.min(NEG_LADDER.length, st));
}

// the maker for the next batch, at the rider's level (asking.js: positive & negative once the rider's adding and
// taking away reach it, else adding or taking away). It starts a strand's baseline the first time: save after.
export function pigsFor(rider, { last = null, rand = Math.random } = {}) {
  const map = chooseFor(rider, PIG_MATH.maps, { last, rand }) || 'negatives';
  return { map, q: askFor(rider, map) };
}

// ── THE SUMS ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The ways a positive & negative sum can be written (a and b are sizes, 1 and up), with the answer each gives:
//   negUp    −a + b        negDown  −a − b        take    a − b
//   takeNeg  a − (−b)      addNeg   a + (−b)
const FORMS = {
  negUp: (a, b) => ({ s: -a, op: '+', t: b }),
  negDown: (a, b) => ({ s: -a, op: '-', t: b }),
  take: (a, b) => ({ s: a, op: '-', t: b }),
  takeNeg: (a, b) => ({ s: a, op: '-', t: -b }),
  addNeg: (a, b) => ({ s: a, op: '+', t: -b }),
};
// b for a given a and answer v, in each form
const SOLVE = {
  negUp: (a, v) => v + a, negDown: (a, v) => -a - v, take: (a, v) => a - v, takeNeg: (a, v) => v - a, addNeg: (a, v) => a - v,
};
// which forms each step of the ladder writes (the step's own shapes, src/math/negatives.js LADDER)
function formsAt(level) {
  if (level <= 2) return ['negUp'];
  if (level <= 4) return ['negUp', 'negDown', 'take'];
  return ['negUp', 'negDown', 'take', 'takeNeg', 'addNeg'];
}
const answerOf = (p) => p.s + (p.op === '-' ? -p.t : p.t);
function pigOf(p) {
  const text = problemText(p.s, p.op, p.t), change = p.op === '-' ? -p.t : p.t;
  return { text, say: problemWords(p.s, p.op, p.t), parts: { start: p.s, change, op: p.op, term: p.t }, answer: p.s + change };
}

// a sum in one of the forms that comes to v, with sizes up to max (null if none was found)
function sumFor(v, forms, max, rand, used) {
  for (let tries = 0; tries < 160; tries++) {
    const f = pick(forms, rand), a = int(1, max, rand), b = SOLVE[f](a, v);
    if (!Number.isInteger(b) || b < 1 || b > max) continue;
    const p = FORMS[f](a, b);
    if (answerOf(p) !== v) continue;
    // (a sum that is just a number with nothing done to it, or the same sum twice in a batch, is no puzzle)
    const text = problemText(p.s, p.op, p.t);
    if (used.has(text)) continue;
    used.add(text);
    return p;
  }
  return null;
}

// the youngest riders' sums: a step's own adding or taking-away problems (src/math/adding.js, taking.js), written as
// plain sums ("3 + 4", "12 − 5"; their missing-number problems are left out here)
// (a step of only missing-number problems, adding's "making 10", borrows its neighbours' sums: the one below, then above)
function youngSum(map, step, rand) {
  const L = map === 'taking' ? TAKE_LADDER : ADD_LADDER, make = map === 'taking' ? takeProblem : addProblem;
  const k0 = Math.max(1, Math.min(L.length, step));
  for (const k of [k0, k0 - 1, k0 + 1, k0 - 2]) {
    const row = L[k - 1]; if (!row) continue;
    for (let n = 0; n < 12; n++) {
      const p = make(pick(row.shapes, rand), row, rand);
      if (p.shape === 'sum') return { s: p.a, op: '+', t: p.b };
      if (p.shape === 'diff' || p.shape === 'left') return { s: p.a, op: '-', t: p.b };
    }
  }
  return map === 'taking' ? { s: 9, op: '-', t: 4 } : { s: 3, op: '+', t: 4 };
}
// the number the sizes pens split at: a round one inside the middle half of the step's answers, else their middle
function splitFor(map, step, rand) {
  const vals = [];
  for (let k = 0; k < 120; k++) vals.push(answerOf(youngSum(map, step, rand)));
  vals.sort((x, y) => x - y);
  const lo = vals[Math.floor(vals.length * 0.15)], hi = vals[Math.floor(vals.length * 0.85)];
  for (const v of PIG_MATH.splits) if (v > lo && v <= hi) return v;
  for (const v of [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90]) if (v > lo && v <= hi) return v;
  return Math.max(2, vals[vals.length >> 1]);
}

// ── A BATCH ──────────────────────────────────────────────────────────────────────────────────────────────────────
const SIGN_PENS = [
  { label: 'NEGATIVE', sub: 'below zero', value: -1 },
  { label: 'POSITIVE', sub: 'above zero', value: 1 },
];
const SIZE_PENS = (n) => [
  { label: `LESS THAN ${n}`, sub: '', value: -1 },
  { label: `MORE THAN ${n}`, sub: '', value: 1 },
];

export function makePigBatch(rider, { size = PIG_MATH.size, rand = Math.random, level = null, map = 'negatives', step = null, split: at = null } = {}) {
  size = Math.max(2, Math.round(size));
  if (map === 'adding' || map === 'taking') {
    const L = map === 'taking' ? TAKE_LADDER : ADD_LADDER;
    const lv = Math.max(1, Math.min(L.length, Math.round(step ?? level ?? 1)));
    const split = at ?? splitFor(map, lv, rand), used = new Set();   // (at: a level's own number on the signs)
    const want = [0, 1];
    while (want.length < size) want.push(rand() < 0.5 ? 0 : 1);
    const pigs = shuffle(want, rand).map((pen) => {
      let p = null;
      for (let k = 0; k < 80 && !p; k++) {
        const c = youngSum(map, lv, rand), v = answerOf(c), text = problemText(c.s, c.op, c.t);
        if (v === split || (v < split ? 0 : 1) !== pen || used.has(text)) continue;
        used.add(text); p = c;
      }
      // (a step whose sums nearly all fall on one side of the split: plain sums just on this pen's side)
      for (let d = 1; d < 60 && !p; d++) {
        const v = pen === 0 ? Math.max(2, split - 1 - (d % Math.max(1, split - 2))) : split + 1 + (d % 6);
        const a = 1 + (d % Math.max(1, v - 1)), c = { s: a, op: '+', t: v - a }, text = problemText(c.s, c.op, c.t);
        if (c.t >= 1 && (v < split ? 0 : 1) === pen && !used.has(text)) { used.add(text); p = c; }
      }
      if (!p) p = pen === 0 ? { s: 1, op: '+', t: 1 } : { s: split, op: '+', t: 1 };
      return { ...pigOf(p), pen };
    });
    return { level: lv, map, mode: 'sizes', split, pens: SIZE_PENS(split), pigs };
  }
  // positive & negative: each pen gets a pig, the rest land below or above zero (never on it)
  const lv = Math.max(1, Math.min(NEG_LADDER.length, Math.round(step ?? level ?? pigLevel(rider))));
  const max = (NEG_LADDER[lv - 1] || NEG_LADDER[0]).max;
  const forms = formsAt(lv), used = new Set();
  const want = [0, 1];
  while (want.length < size) want.push(rand() < 0.5 ? 0 : 1);
  const pigs = shuffle(want, rand).map((pen) => {
    let p = null;
    for (let k = 0; k < 40 && !p; k++) {
      const v = (pen === 0 ? -1 : 1) * int(1, Math.max(2, max - 1), rand);
      // (step 3 is a negative going further down, −4 − 5, with 8 − 3 now and then: a minus whose answer is above zero)
      const f = lv === 3 || lv === 4 ? (v < 0 ? ['negDown', 'negDown', 'negUp', 'take'] : ['take', 'negUp']) : forms;
      p = sumFor(v, f, max, rand, used);
    }
    if (!p) p = pen === 0 ? { s: -5, op: '+', t: 2 } : { s: -2, op: '+', t: 5 };
    return { ...pigOf(p), pen };
  });
  return { level: lv, map: 'negatives', mode: 'signs', split: 0, pens: SIGN_PENS.map((x) => ({ ...x })), pigs };
}

// ── A BATCH AT A LEVEL OF THE PIGS' LADDER (src/levels/place/pigs.js: the ONE maker for the job and its examples) ──
// Sorting, every level two pens:
//   { pens: 'less-more', nums: [lo, hi], mid }      plain numbers: LESS THAN mid / MORE THAN mid (never mid itself)
//   { pens: 'less-more', map: 'adding' | 'taking', step }   the early sums at their step (makePigBatch above)
//   { pens: 'even-odd', top, sums? }                 EVEN / ODD: numbers up to top, or sums ('+') up to top
//   { pens: 'half', den: [...] }                     LESS THAN 1/2 / MORE THAN 1/2 (never a half itself)
//   { pens: 'neg-pos', top }                         plain numbers: NEGATIVE / POSITIVE (never 0)
//   { pens: 'neg-pos', step }                        positive & negative sums at negatives.js's step (makePigBatch)
// Each pig: { text, say, parts (a sum's, for the number line; null for a plain number or a fraction), answer (a number
// to sort: a fraction's value), pen, done (one line: where it goes and why), help (one plain line for the stuck) }
const PARITY_PENS = [
  { label: 'EVEN', sub: '2, 4, 6, 8, 10 …', value: 0 },
  { label: 'ODD', sub: '1, 3, 5, 7, 9 …', value: 1 },
];
const HALF_PENS = [
  { label: 'LESS THAN ½', sub: 'smaller than a half', value: -1 },
  { label: 'MORE THAN ½', sub: 'bigger than a half', value: 1 },
];
const halfWord = (d) => (d % 2 === 0 ? `${d / 2}/${d}` : `${d / 2} out of ${d}`);
function sidesOf(size, rand) { const want = [0, 1]; while (want.length < size) want.push(rand() < 0.5 ? 0 : 1); return shuffle(want, rand); }
const plainPig = (v, pen, done, help) => ({ text: numText(v), say: numText(v).replace('−', 'minus '), parts: null, answer: v, pen, done, help });

export function batchAt(gen, { size = PIG_MATH.size, rand = Math.random } = {}) {
  size = Math.max(2, Math.round(size));
  if (gen.pens === 'less-more' && gen.map) {
    const b = makePigBatch(null, { size, rand, map: gen.map, step: gen.step, split: gen.mid ?? null });
    for (const p of b.pigs) { p.done = `${p.text} = ${numText(p.answer)}: ${p.answer < b.split ? 'less' : 'more'} than ${b.split}.`; p.help = `Work out ${p.text} first, then see if it is less or more than ${b.split}.`; }
    return b;
  }
  const used = new Set();
  if (gen.pens === 'less-more') {
    const mid = gen.mid, pigs = sidesOf(size, rand).map((pen) => {
      let v = mid;
      for (let k = 0; k < 40 && (v === mid || used.has(v)); k++) v = pen === 0 ? int(gen.nums[0], mid - 1, rand) : int(mid + 1, gen.nums[1], rand);
      used.add(v);
      return plainPig(v, pen, `${v} is ${pen === 0 ? 'less' : 'more'} than ${mid}.`, `Count up from 1: does ${v} come before ${mid} or after it?`);
    });
    return { level: 1, map: 'numbers', mode: 'sizes', split: mid, pens: SIZE_PENS(mid), pigs };
  }
  if (gen.pens === 'even-odd') {
    const pigs = sidesOf(size, rand).map((pen) => {
      let v = 0, a = 0, b = 0, text = '';
      for (let k = 0; k < 60; k++) {
        if (gen.sums) { a = int(1, Math.floor(gen.top / 2), rand); b = int(1, gen.top - a, rand); v = a + b; text = `${a} + ${b}`; }
        else { v = int(1, gen.top, rand); text = String(v); }
        if (v % 2 === pen && !used.has(text)) break;
      }
      used.add(text);
      const word = pen === 0 ? 'even' : 'odd', last = v % 10;
      const done = gen.sums ? `${text} = ${v}, and ${v} is ${word}.` : v >= 10 ? `${v} ends in ${last}, so it is ${word}.` : `${v} is ${word}.`;
      const help = v >= 10 || gen.sums ? 'Look at the last digit: 0, 2, 4, 6 or 8 is even; 1, 3, 5, 7 or 9 is odd.' : 'Even numbers make pairs with none left over: 2, 4, 6, 8, 10.';
      return { text, say: text.replace('+', 'plus'), parts: gen.sums ? { start: a, change: b, op: '+', term: b } : null, answer: v, pen, done, help };
    });
    return { level: 1, map: 'parity', mode: 'parity', split: null, pens: PARITY_PENS.map((x) => ({ ...x })), pigs };
  }
  if (gen.pens === 'half') {
    const pigs = sidesOf(size, rand).map((pen) => {
      let d = 4, n = 1;
      for (let k = 0; k < 60; k++) {
        d = pick(gen.den, rand); n = int(1, d - 1, rand);
        if (2 * n !== d && (2 * n < d ? 0 : 1) === pen && !used.has(`${n}/${d}`)) break;
      }
      used.add(`${n}/${d}`);
      const less = 2 * n < d, h = halfWord(d);
      const done = d % 2 === 0 ? `Half of ${d} is ${d / 2}: ${n}/${d} is ${less ? 'less' : 'more'} than ${h}.` : `Half of ${d} is ${d / 2}: ${n} out of ${d} is ${less ? 'less' : 'more'} than half.`;
      return { text: `${n}/${d}`, say: `${n} over ${d}`, parts: null, answer: n / d, pen, done, help: `Half of the bottom number is half of it all. Half of ${d} is ${d / 2}: is ${n} less or more?` };
    });
    return { level: 1, map: 'half', mode: 'half', split: 0.5, pens: HALF_PENS.map((x) => ({ ...x })), pigs };
  }
  if (gen.pens === 'neg-pos' && gen.top) {
    const pigs = sidesOf(size, rand).map((pen) => {
      let v = 0;
      for (let k = 0; k < 40 && (v === 0 || used.has(v)); k++) v = (pen === 0 ? -1 : 1) * int(1, gen.top, rand);
      used.add(v);
      return plainPig(v, pen, v < 0 ? `${numText(v)} has a minus sign: below zero, NEGATIVE.` : `${v} has no minus sign: above zero, POSITIVE.`, 'A minus sign in front means below zero.');
    });
    return { level: 1, map: 'signs', mode: 'signs', split: 0, pens: SIGN_PENS.map((x) => ({ ...x })), pigs };
  }
  if (gen.pens === 'neg-pos') {
    const b = makePigBatch(null, { size, rand, map: 'negatives', step: gen.step });
    for (const p of b.pigs) { p.done = `${p.text} = ${numText(p.answer)}: ${p.answer < 0 ? 'below zero' : 'above zero'}.`; p.help = 'Start at the first number on the line, then hop: plus goes right, minus goes left.'; }
    return b;
  }
  throw new Error('pigs: no batch for ' + JSON.stringify(gen));
}

export function penFor(batch, answer) {
  if (batch.mode === 'parity') return Math.abs(answer) % 2;
  return answer < (batch.split || 0) ? 0 : 1;
}

// ── WRONG PEN, RIGHT PEN: one plain line ─────────────────────────────────────────────────────────────────────────
const SIDE = (r) => (r < 0 ? 'Below zero, so it goes in NEGATIVE.' : 'Above zero, so it goes in POSITIVE.');
export function judge(batch, pig, penIndex) {
  const right = penFor(batch, pig.answer) === penIndex;
  const pen = batch.pens[penIndex];
  if ((batch.mode === 'parity' || batch.mode === 'half' || !pig.parts) && pig.done) {
    const home = batch.pens[penFor(batch, pig.answer)];
    const how = `${pig.done} It goes in ${home.label}.`;
    return { right, line: right ? how : `Not ${pen ? pen.label : 'that pen'}. ${how}`, picked: null };
  }
  if (batch.mode === 'sizes') {
    const n = batch.split, home = batch.pens[penFor(batch, pig.answer)];
    const how = `${pig.text} = ${numText(pig.answer)}, and ${numText(pig.answer)} is ${pig.answer < n ? 'less' : 'more'} than ${n}: it goes in ${home.label}.`;
    return { right, line: right ? how : `Not ${pen ? pen.label : 'that pen'}. ${how}`, picked: null };
  }
  const card = { text: pig.text, parts: pig.parts };
  const how = explainPick(card, pig.answer).line;   // '−3 + 8 = 5: 3 steps to zero, 5 more.'
  const line = right ? `${how} ${SIDE(pig.answer)}` : `Not ${pen ? pen.label : 'that pen'}. ${how} ${SIDE(pig.answer)}`;
  return { right, line, picked: null };
}
