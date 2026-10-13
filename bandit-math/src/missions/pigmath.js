// The math behind the loose-pigs job (missions/pigs.js): a batch of pigs loose in the farm's pig yard, each carrying a
// positive & negative sum ("−3 + 8"), and three pens whose signs say which answers go where. Herding a pig into the pen
// with its answer is the kid's answer.
//
// The pens read like a number line, left to right as you face them from the yard: the lowest on the left.
//   signs   on the first steps of the positive & negative ladder: NEGATIVE / ZERO / POSITIVE. The kid only has to see
//           which side of zero the hop lands (the first thing the topic teaches), not the exact number
//   values  higher up: three real numbers. They are one sum's answer and the two slips kids make most on it (the wrong
//           side of zero, and going the wrong way along the line), so the pens themselves are the traps: −3 + 8 has the
//           pens −11, −5 and 5. Every other pig in the batch lands on one of the three too
// How hard follows the kid's own step in the positive & negative topic (rider.topics.negatives.step, read here, never
// changed: the round-up's trainer moves it). Every pen gets at least one pig, so the kid uses all three signs.
//
//   PIG_MATH                                   the dials
//   pigLevel(rider)                            the kid's positive & negative step (1 = the first)
//   makePigBatch(rider, { size, rand, level }) -> { level, mode: 'signs' | 'values', pens: [pen x 3], pigs: [pig, ...] }
//     pen = { label (what the sign says: 'NEGATIVE', '−5'), sub (a small line under it: 'below zero', or ''), value
//             (the number, or the side: -1 / 0 / 1 for the signs) }
//     pig = { text ('−3 + 8'), say, parts: { start, change, op, term }, answer, pen (the index of its pen) }
//   penFor(batch, answer)                      the index of the pen an answer belongs in
//   judge(batch, pig, penIndex) -> { right, line, picked }
//     line: one plain line: why the pig doesn't go there (the hop, and where it really lands), or why it does
//     picked: the pen's number (for the number line's "your pick" mark), or null on the signs
import { explainPick, problemText, problemWords, numText, LADDER as NEG_LADDER } from '../math/negatives.js';

export const PIG_MATH = {
  size: 5,               // pigs in a batch
  signsUpTo: 3,          // the pens say NEGATIVE / ZERO / POSITIVE up to this positive & negative step; real values after
  zeroShare: 0.2,        // on the signs, the share of pigs past the one each pen gets that land right on zero
};

const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
const int = (lo, hi, rand) => (hi < lo ? lo : lo + Math.floor(rand() * (hi - lo + 1)));
function shuffle(a, rand) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function pigLevel(rider) {
  const T = (rider && rider.topics) || {};
  const st = T.negatives && Number.isFinite(+T.negatives.step) ? Math.round(+T.negatives.step) : 1;
  return Math.max(1, Math.min(NEG_LADDER.length, st));
}

// ── THE SUMS ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The ways a sum can be written (a and b are sizes, 1 and up), with the answer each gives:
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
  if (level <= 1) return ['negUp'];
  if (level === 2) return ['negUp'];
  if (level === 3) return ['negUp', 'negDown', 'take'];
  if (level === 4) return ['negUp', 'negDown', 'take'];
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

// ── A BATCH ──────────────────────────────────────────────────────────────────────────────────────────────────────
const SIGN_PENS = [
  { label: 'NEGATIVE', sub: 'below zero', value: -1 },
  { label: 'ZERO', sub: 'right on zero', value: 0 },
  { label: 'POSITIVE', sub: 'above zero', value: 1 },
];

export function makePigBatch(rider, { size = PIG_MATH.size, rand = Math.random, level = null } = {}) {
  const lv = level != null ? Math.max(1, Math.min(NEG_LADDER.length, Math.round(level))) : pigLevel(rider);
  const max = (NEG_LADDER[lv - 1] || NEG_LADDER[0]).max;
  const forms = formsAt(lv), used = new Set();
  size = Math.max(3, Math.round(size));

  if (lv <= PIG_MATH.signsUpTo) {
    // each pen gets a pig, the rest land below or above zero (now and then right on it)
    const want = [0, 1, 2];
    while (want.length < size) want.push(rand() < PIG_MATH.zeroShare ? 1 : rand() < 0.5 ? 0 : 2);
    const pigs = shuffle(want, rand).map((pen) => {
      let p = null;
      for (let k = 0; k < 40 && !p; k++) {
        // a zero pair (−6 + 6, and from step 3 on 6 − 6) or an answer on the pen's side of zero, from 1 up to max
        const v = pen === 1 ? 0 : (pen === 0 ? -1 : 1) * int(1, Math.max(2, max - 1), rand);
        // (step 3 is a negative going further down, −4 − 5, with 8 − 3 now and then: a minus whose answer is above zero)
        const f = lv >= 3 ? (v < 0 ? ['negDown', 'negDown', 'negUp'] : ['take', 'negUp']) : forms;
        p = v === 0 ? zeroPair(max, lv, rand, used) : sumFor(v, f, max, rand, used);
      }
      if (!p) p = pen === 1 ? { s: -2, op: '+', t: 2 } : pen === 0 ? { s: -5, op: '+', t: 2 } : { s: -2, op: '+', t: 5 };
      return { ...pigOf(p), pen };
    });
    return { level: lv, mode: 'signs', pens: SIGN_PENS.map((x) => ({ ...x })), pigs };
  }

  // real values: one sum's answer and its two commonest slips, sorted low to high
  let base = null, values = null;
  for (let k = 0; k < 60 && !values; k++) {
    const v = pick([-1, 1], rand) * int(1, max, rand);
    const p = sumFor(v, forms, max, rand, new Set());
    if (!p) continue;
    const c = p.op === '-' ? -p.t : p.t, way = p.s - c, sign = -v;
    const vals = [v, sign, way];
    if (new Set(vals).size === 3) { base = p; values = vals; }
  }
  if (!values) { base = { s: -3, op: '+', t: 8 }; values = [5, -5, -11]; }
  const sorted = [...values].sort((x, y) => x - y);
  const pens = sorted.map((v) => ({ label: numText(v), sub: '', value: v }));
  used.add(problemText(base.s, base.op, base.t));
  const want = [0, 1, 2];
  while (want.length < size) want.push(int(0, 2, rand));
  const order = shuffle(want, rand);
  const baseAt = order.indexOf(sorted.indexOf(values[0]));
  const pigs = order.map((pen, i) => {
    if (i === baseAt) return { ...pigOf(base), pen };
    const v = sorted[pen];
    // the value's own sizes may be bigger than the step's (going the wrong way doubles a hop): look wider if need be
    const p = sumFor(v, forms, max, rand, used) || sumFor(v, Object.keys(FORMS), Math.max(max, Math.abs(v) + 6), rand, used)
      || (v >= 0 ? { s: -1, op: '+', t: v + 1 } : { s: -1, op: '-', t: -v - 1 });
    return { ...pigOf(p), pen };
  });
  return { level: lv, mode: 'values', pens, pigs };
}
// a sum that lands right on zero: −a + a, and from step 3 a − a
function zeroPair(max, lv, rand, used) {
  for (let k = 0; k < 30; k++) {
    const a = int(2, Math.max(2, max), rand), p = lv >= 3 && rand() < 0.4 ? { s: a, op: '-', t: a } : { s: -a, op: '+', t: a };
    const text = problemText(p.s, p.op, p.t);
    if (!used.has(text)) { used.add(text); return p; }
  }
  return null;
}

export function penFor(batch, answer) {
  if (batch.mode === 'signs') return answer < 0 ? 0 : answer === 0 ? 1 : 2;
  return batch.pens.findIndex((p) => p.value === answer);
}

// ── WRONG PEN, RIGHT PEN: one plain line ─────────────────────────────────────────────────────────────────────────
const SIDE = (r) => (r < 0 ? 'Below zero, so it goes in NEGATIVE.' : r === 0 ? 'So it goes in ZERO.' : 'Above zero, so it goes in POSITIVE.');
export function judge(batch, pig, penIndex) {
  const right = penFor(batch, pig.answer) === penIndex;
  const card = { text: pig.text, parts: pig.parts };
  const how = explainPick(card, pig.answer).line;   // '−3 + 8 = 5: 3 steps to zero, 5 more.'
  if (batch.mode === 'signs') {
    const pen = batch.pens[penIndex];
    const line = right ? `${how} ${SIDE(pig.answer)}` : `Not ${pen ? pen.label : 'that pen'}. ${how} ${SIDE(pig.answer)}`;
    return { right, line, picked: null };
  }
  const v = batch.pens[penIndex] ? batch.pens[penIndex].value : null;
  if (right) return { right, line: how, picked: null };
  // the slip the pen's number would be, told as the topic tells it ("You went down 8. Adding 8 goes UP the line: ...")
  const ex = explainPick(card, v);
  // (a number that is none of the topic's named slips gets "isn't that": the topic's own "Not quite" line says less)
  let line = /^Not quite/.test(ex.line) ? `${pig.text} isn't ${numText(v)}. ${how}` : ex.line;
  // (the hop told in steps, "2 steps to zero, 10 more", doesn't always name where it lands: then the line does)
  if (!new RegExp(`(^|[^\\d−])${numText(pig.answer)}(?!\\d)`).test(line)) line += ` So ${pig.text} = ${numText(pig.answer)}.`;
  return { right, line, picked: v };
}
