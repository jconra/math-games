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

export function makePigBatch(rider, { size = PIG_MATH.size, rand = Math.random, level = null, map = 'negatives', step = null } = {}) {
  size = Math.max(2, Math.round(size));
  if (map === 'adding' || map === 'taking') {
    const L = map === 'taking' ? TAKE_LADDER : ADD_LADDER;
    const lv = Math.max(1, Math.min(L.length, Math.round(step ?? level ?? 1)));
    const split = splitFor(map, lv, rand), used = new Set();
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

export function penFor(batch, answer) {
  return answer < (batch.split || 0) ? 0 : 1;
}

// ── WRONG PEN, RIGHT PEN: one plain line ─────────────────────────────────────────────────────────────────────────
const SIDE = (r) => (r < 0 ? 'Below zero, so it goes in NEGATIVE.' : 'Above zero, so it goes in POSITIVE.');
export function judge(batch, pig, penIndex) {
  const right = penFor(batch, pig.answer) === penIndex;
  const pen = batch.pens[penIndex];
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
