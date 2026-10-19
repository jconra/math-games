// Lock-box problems, one recipe per rung of the ladder (R0a .. R15, then the inequalities I1 .. I4).
// Below R0a sit the kindergarten boxes K1 .. K3 (kbox.js: "2 + x = 4" with pictures, read aloud); generate() makes
// those too, and the "Work it out" boxes O1 .. O5, P1 .. P5 (workout.js), but they are not in RUNGS (the deer and the
// sheep read this ladder by its index).
//
// The inequality rungs come after the equations and open the same way (ineq.js has their recipes):
//   I1 Less or more (2x + 3 < 11), I2 The flip (−3x ≥ 12), I3 Three rooms (3x − 9 < 6x < 3x + 12),
//   I4 Either or (x + 2 < 0 or 2x > 8). Their answers are whole numbers within ±20, given on a number line.
//
// Every recipe picks x first and builds the equation around it, so the answer is always a whole number.
// Then the filters throw out anything unfair or dull:
//   - x is not a number already printed in the equation (no "x = 4" in 4x − 6 = …);
//   - every number stays within ±99, on the start line and along the shortest route;
//   - plain numbers are never 0, and the number stuck to x is not 0 (or 1 unless the rung wants a lone x);
//   - the fewest-moves search finds a finish (the par);
//   - not one of the last 20 problems.

import {
  F, num, xt, br, line, makeStage, lineFits, lineText, solve, trueAnswer, printedNumbers, moveLabel, verdictFinishMoves,
} from './engine.js';
import { INEQ_RECIPES, makeIneqProblem } from './ineq.js';
import { K_RUNG, kProblem } from './kbox.js';
import { WORK_RUNG, workProblem } from './workout.js';

// ---------- a small seeded random number source (the same seed gives the same boxes) ----------

export function makeRng(seed = (Math.random() * 2 ** 32) >>> 0) {
  let a = seed >>> 0;
  const next = () => {   // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    // a whole number from lo..hi with a random sign; pNeg is the chance it is negative
    signed: (lo, hi, pNeg = 0.5) => (next() < pNeg ? -1 : 1) * (lo + Math.floor(next() * (hi - lo + 1))),
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    },
  };
  return r;
}

// ---------- the ladder ----------
// stage: which moves exist and which lines are allowed (see makeStage in engine.js).
// sign 'plus' = no minus at all, 'sub' = taking away is fine but no number stands alone as negative, 'any' = anything.

const S = (o) => makeStage(o);
export const RUNGS = [
  { id: 'R0a', name: 'Balance the wagon', mode: 'balance', note: '“=” means “the same as”' },
  { id: 'R0b', name: 'Which key fits', mode: 'key', note: 'try a key in the lock' },
  { id: 'R1', name: 'Add-on', stage: S({ sign: 'plus' }), maxPar: 1, pictures: true, note: 'x + 4 = 9' },
  { id: 'R2', name: 'Take-away', stage: S({ sign: 'sub' }), maxPar: 1, note: 'x − 3 = 5' },
  { id: 'R3', name: 'Times', stage: S({ mul: true, div: true, sign: 'sub' }), maxPar: 1, pictures: true, note: '3x = 12' },
  { id: 'R4', name: 'Divided by', stage: S({ mul: true, div: true, sign: 'sub', frac: true }), maxPar: 1, pictures: true, note: 'x/4 = 3' },
  { id: 'R5', name: 'One step with negatives', stage: S({ mul: true, div: true }), maxPar: 1, note: 'x + 7 = 3, −4x = 20' },
  { id: 'R6', name: 'Two steps', stage: S({ mul: true, div: true, sign: 'sub' }), maxPar: 2, note: '2x + 5 = 17' },
  { id: 'R7', name: 'Two steps with negatives', stage: S({ mul: true, div: true }), maxPar: 2, note: '5x − 4 = −19' },
  { id: 'R8', name: 'The opposite of x', stage: S({ mul: true, div: true, flip: true }), maxPar: 2, note: '5 − x = 12' },
  { id: 'R9', name: 'Divided plus a number', stage: S({ mul: true, div: true, flip: true, frac: true }), maxPar: 2, note: 'x/3 + 4 = 11' },
  { id: 'R9b', name: 'The whole side divided', stage: S({ mul: true, div: true, flip: true, over: true }), maxPar: 3, note: '(5x − 10)/2 = 10' },
  { id: 'R10', name: 'Brackets', stage: S({ mul: true, div: true, flip: true, dist: true }), maxPar: 3, note: '3(x + 2) = 18' },
  { id: 'R11', name: 'Like terms', stage: S({ mul: true, div: true, flip: true, comb: true }), maxPar: 3, note: '3x + 2 + 2x = 17' },
  { id: 'R12', name: 'x on both sides', stage: S({ addx: true, mul: true, div: true, comb: true, sign: 'sub' }), maxPar: 3, note: '5x + 3 = 2x + 15' },
  { id: 'R13', name: 'Both sides with negatives', stage: S({ addx: true, mul: true, div: true, flip: true, comb: true }), maxPar: 4, note: '4x − 6 = −8x + 18' },
  { id: 'R14', name: 'Brackets on both sides', stage: S({ addx: true, mul: true, div: true, flip: true, dist: true, comb: true }), maxPar: 5, note: '2(x + 3) = 5x − 9' },
  { id: 'R15', name: 'Legendary vault', stage: S({ addx: true, mul: true, div: true, flip: true, dist: true, comb: true }), maxPar: 5, verdicts: true, note: 'infinitely many solutions, no solution' },
  // inequalities (ineq.js): every move is done to every room; the answer is picked on a number line
  { id: 'I1', name: 'Less or more', ineq: 'one', stage: S({ mul: true, div: true }), maxPar: 2, note: '2x + 3 < 11' },
  { id: 'I2', name: 'The flip', ineq: 'one', stage: S({ mul: true, div: true, flip: true }), maxPar: 2, note: '−3x ≥ 12' },
  { id: 'I3', name: 'Three rooms', ineq: 'three', stage: S({ addx: true, mul: true, div: true }), maxPar: 3, note: '3x − 9 < 6x < 3x + 12' },
  { id: 'I4', name: 'Either or', ineq: 'or', stage: S({ mul: true, div: true, flip: true }), maxPar: 4, note: 'x + 2 < 0 or 2x > 8' },
];
export const RUNG = Object.fromEntries(RUNGS.map((r) => [r.id, r]));
export const RUNG_IDS = RUNGS.map((r) => r.id);
export const rungIndex = (id) => RUNG_IDS.indexOf(id);

// ---------- recipes ----------
// Each takes (rng, size) with size 1 (small numbers) .. 3 (bigger) and returns { L, R, x } or null to retry.
// x is the chosen answer; for R15 it can be { kind: 'all' } or { kind: 'none' }.

const S3 = (size, a, b, c) => [a, b, c][Math.max(1, Math.min(3, size)) - 1];

// put x's side on the right now and then ("9 = x + 4"): "=" works both ways
function maybeSwap(rng, L, R, p = 0.25) { return rng.chance(p) ? { L: R, R: L } : { L, R }; }

const RECIPES = {
  R1(rng, size) {
    const x = rng.int(1, S3(size, 6, 10, 15)), a = rng.int(1, S3(size, 6, 10, 15));
    const b = x + a;
    const L = rng.chance(0.2) ? [num(a), xt(1)] : [xt(1), num(a)];
    return { ...maybeSwap(rng, L, [num(b)]), x };
  },
  R2(rng, size) {
    const x = rng.int(3, S3(size, 10, 15, 20)), a = rng.int(1, x - 1);
    return { ...maybeSwap(rng, [xt(1), num(-a)], [num(x - a)]), x };
  },
  R3(rng, size) {
    const a = rng.int(2, S3(size, 5, 9, 12)), x = rng.int(2, S3(size, 6, 10, 12));
    return { ...maybeSwap(rng, [xt(a)], [num(a * x)]), x };
  },
  R4(rng, size) {
    const a = rng.int(2, S3(size, 5, 9, 10)), b = rng.int(2, S3(size, 6, 10, 12));
    return { ...maybeSwap(rng, [xt(F(1, a))], [num(b)]), x: a * b };
  },
  R5(rng, size) {
    const top = S3(size, 9, 10, 12);
    const x = rng.signed(1, top, 0.6);
    if (rng.chance(0.5)) {   // add or take away, with a negative somewhere
      const a = rng.signed(1, S3(size, 9, 12, 15), 0.5);
      const b = x + a;
      if (b === 0 || (x > 0 && a > 0)) return null;
      const L = rng.chance(0.2) ? [num(a), xt(1)] : [xt(1), num(a)];
      return { ...maybeSwap(rng, L, [num(b)]), x };
    }
    const a = rng.signed(2, S3(size, 6, 9, 9), 0.5);
    if (x > 0 && a > 0) return null;
    return { ...maybeSwap(rng, [xt(a)], [num(a * x)]), x };
  },
  R6(rng, size) {
    const a = rng.int(2, S3(size, 5, 9, 9)), x = rng.int(1, S3(size, 6, 10, 12)), b = rng.int(1, S3(size, 10, 15, 20));
    const c = a * x + b;
    const L = rng.chance(0.2) ? [num(b), xt(a)] : [xt(a), num(b)];
    return { ...maybeSwap(rng, L, [num(c)]), x };
  },
  R7(rng, size) {
    const x = rng.signed(1, S3(size, 6, 10, 10), 0.5);
    const a = rng.signed(2, S3(size, 6, 9, 9), 0.4), b = rng.signed(1, S3(size, 12, 20, 20), 0.5);
    const c = a * x + b;
    if (c === 0 || (x > 0 && a > 0 && b > 0)) return null;
    const L = rng.chance(0.3) ? [num(b), xt(a)] : [xt(a), num(b)];
    return { ...maybeSwap(rng, L, [num(c)]), x };
  },
  R8(rng, size) {
    const x = rng.signed(1, S3(size, 9, 12, 12), 0.5);
    if (rng.chance(0.15)) return { ...maybeSwap(rng, [xt(-1)], [num(-x)]), x };   // −x = 7 on its own
    const b = rng.signed(1, S3(size, 9, 15, 15), 0.2);
    const c = b - x;
    if (c === 0) return null;
    const L = rng.chance(0.6) ? [num(b), xt(-1)] : [xt(-1), num(b)];
    return { ...maybeSwap(rng, L, [num(c)]), x };
  },
  R9(rng, size) {
    const a = rng.int(2, S3(size, 4, 6, 8));
    const k = size >= 2 ? rng.signed(1, S3(size, 6, 10, 12), 0.3) : rng.int(1, 6);
    const b = size >= 2 ? rng.signed(1, 12, 0.3) : rng.int(1, 9);
    const c = k + b;
    if (c === 0) return null;
    // the steps card clears the division first (·a on both sides), so those numbers must stay within ±99 too
    if (Math.abs(b * a) > 99 || Math.abs(c * a) > 99) return null;
    const L = rng.chance(0.2) ? [num(b), xt(F(1, a))] : [xt(F(1, a)), num(b)];
    return { ...maybeSwap(rng, L, [num(c)]), x: a * k };
  },
  // (5x − 10)/2 = 10: the whole group over a number; multiplying both sides by 2 clears it
  R9b(rng, size) {
    const d = rng.int(2, S3(size, 3, 4, 5));
    const a = rng.int(2, S3(size, 5, 6, 8));
    const x = size >= 2 ? rng.signed(1, S3(size, 8, 9, 10), 0.3) : rng.int(1, 8);
    const b = rng.signed(1, S3(size, 12, 15, 20), 0.5);
    const top = a * x + b;
    if (top === 0 || top % d !== 0) return null;
    return { ...maybeSwap(rng, [br(F(1, d), [xt(a), num(b)])], [num(top / d)], 0.3), x };
  },
  R10(rng, size) {
    const p = rng.int(2, S3(size, 4, 6, 8));
    const q = size >= 2 ? rng.signed(1, 9, 0.35) : rng.int(1, 6);
    const x = size >= 2 ? rng.signed(1, 10, 0.3) : rng.int(1, 8);
    const r = p * (x + q);
    if (r === 0) return null;
    return { ...maybeSwap(rng, [br(p, [xt(1), num(q)])], [num(r)]), x };
  },
  R11(rng, size) {
    const a1 = rng.int(2, S3(size, 5, 6, 7));
    const a2 = size >= 2 && rng.chance(0.3) ? -rng.int(1, a1 - 1) : rng.int(1, S3(size, 4, 5, 6));
    const b = size >= 3 ? rng.signed(1, 12, 0.3) : rng.int(1, 12);
    const x = size >= 3 ? rng.signed(1, 9, 0.3) : rng.int(1, S3(size, 6, 9, 9));
    const c = (a1 + a2) * x + b;
    if (c === 0 || a1 + a2 === 0) return null;
    const order = rng.int(0, 2);
    const L = order === 0 ? [xt(a1), num(b), xt(a2)] : order === 1 ? [xt(a1), xt(a2), num(b)] : [num(b), xt(a1), xt(a2)];
    return { ...maybeSwap(rng, L, [num(c)]), x };
  },
  R12(rng, size) {
    const x = rng.int(1, S3(size, 6, 10, 12));
    const a = rng.int(3, S3(size, 6, 9, 9)), c = rng.int(1, a - 1);
    if (size === 1 && rng.chance(0.5)) {   // 5x = 2x + 12
      const d = (a - c) * x;
      return { ...maybeSwap(rng, [xt(a)], [xt(c), num(d)]), x };
    }
    const b = rng.int(1, S3(size, 9, 15, 20));
    const d = (a - c) * x + b;
    return { ...maybeSwap(rng, [xt(a), num(b)], [xt(c), num(d)], 0.4), x };
  },
  R13(rng, size) {
    const x = rng.signed(1, S3(size, 6, 10, 10), 0.4);
    const a = rng.signed(1, 9, 0.35), c = rng.signed(1, 9, 0.45);
    if (a === c || (Math.abs(a) === 1 && Math.abs(c) === 1)) return null;
    const b = rng.signed(1, S3(size, 12, 20, 20), 0.5);
    const d = (a - c) * x + b;
    if (d === 0) return null;
    if (a > 0 && c > 0 && b > 0 && d > 0 && x > 0) return null;   // that is R12
    const R = rng.chance(0.3) ? [num(d), xt(c)] : [xt(c), num(d)];
    return { ...maybeSwap(rng, [xt(a), num(b)], R, 0.3), x };
  },
  R14(rng, size) {
    const x = rng.signed(1, S3(size, 6, 9, 10), 0.35);
    const p = rng.signed(2, 5, size >= 3 ? 0.25 : 0), q = rng.signed(1, 9, 0.4);
    const r = rng.signed(1, 7, 0.3);
    if (r === p) return null;
    const s = p * (x + q) - r * x;
    if (s === 0) return null;
    return { ...maybeSwap(rng, [br(p, [xt(1), num(q)])], [xt(r), num(s)], 0.3), x };
  },
  // kind: 'all' | 'none' | 'one' (the ladder decides; see generate's verdict option)
  R15(rng, size, kind = rng.pick(['all', 'none'])) {
    const k = rng.int(2, 6), m = rng.signed(1, 9, 0.35);
    if (kind === 'all') {
      if (rng.chance(0.5)) return { ...maybeSwap(rng, [br(k, [xt(1), num(m)])], [xt(k), num(k * m)], 0.5), x: { kind } };
      const a = rng.int(2, 6), c = rng.int(1, 5), b = rng.signed(1, 12, 0.3);
      return { ...maybeSwap(rng, [xt(a), num(b), xt(c)], [xt(a + c), num(b)], 0.5), x: { kind } };
    }
    if (kind === 'none') {
      if (rng.chance(0.5)) {
        let n = k * m + rng.signed(1, 6, 0.5);
        if (n === 0) n = k * m + 7;
        return { ...maybeSwap(rng, [br(k, [xt(1), num(m)])], [xt(k), num(n)], 0.5), x: { kind } };
      }
      const a = rng.signed(2, 8, 0.3), b = rng.signed(1, 15, 0.4);
      let c = rng.signed(1, 15, 0.4);
      if (c === b) c = b + 3;
      return { ...maybeSwap(rng, [xt(a), num(b)], [xt(a), num(c)], 0.5), x: { kind } };
    }
    // a real solve-for-x box: mostly brackets on one side and x on both (R14's kind), now and then the odd one
    if (rng.chance(0.85)) return RECIPES.R14(rng, Math.max(2, size));
    // the odd one: x = 0 (4x + 5 = 2x + 5)
    const a = rng.int(3, 9), c = rng.int(1, a - 1), b = rng.signed(1, 15, 0.4);
    return { ...maybeSwap(rng, [xt(a), num(b)], [xt(c), num(b)], 0.5), x: 0 };
  },
};

// ---------- the two warm-up rungs (no x moves) ----------

function balanceProblem(rng, size) {
  const top = S3(size, 5, 12, 15);   // (the small numbers keep both sides within 10: it follows the kindergarten boxes)
  const a = rng.int(2, top), b = rng.int(2, top);
  const form = rng.int(0, 2);
  // say: the line read out loud from the clips (readaloud.js), for a rider who doesn't read yet
  if (form === 2) {   // 15 = 9 + ?
    const t = a + b;
    const answer = b;
    const choices = [answer, t, t + a];
    return { L: [num(t)], R: [num(a), { t: 'q' }], answer, choices, say: `${a} and what make ${t}` };
  }
  const c = rng.int(1, a + b - 1);
  const answer = a + b - c;
  const choices = [answer, a + b, a + b + c];
  const left = [num(a), num(b)], right = [{ t: 'q' }, num(c)];
  const say = `${c} and what make ${a} plus ${b}`;   // (? + 2 = 4 + 3)
  return form === 0 ? { L: left, R: right, answer, choices, say } : { L: right, R: left, answer, choices, say };
}

function keyProblem(rng, size) {
  const x = rng.int(2, S3(size, 9, 12, 15)), a = rng.int(1, S3(size, 9, 12, 15));
  // say: the line read out loud from the clips (readaloud.js), for a rider who doesn't read yet
  return { L: [xt(1), num(a)], R: [num(x + a)], answer: x, choices: [x - 1, x, x + 1], x, say: `${a} and what make ${x + a}` };
}

// ---------- the filters ----------

export function checkProblem(rungId, L, R, x) {
  const rung = RUNG[rungId];
  const l = line(L, R);
  if (!lineFits(l, rung.stage)) return 'does not fit the rung';
  for (const t of [...L, ...R]) {
    if (t.t === 'n' && t.v.isZero()) return 'a zero';
    if (t.t === 'x' && t.v.isZero()) return 'a zero x';
  }
  const truth = trueAnswer(l);
  if (typeof x === 'object') {
    if (truth.kind !== x.kind) return 'wrong kind';
  } else {
    if (truth.kind !== 'one' || !truth.x.eq(F(x))) return `answer is not ${x}`;
    if (x !== 0 && printedNumbers(l).has(Math.abs(x))) return 'x is printed';
  }
  return null;
}

// What a finished R15 line looks like: "infinitely many solutions" when both sides match, "no solution" when x is gone and the
// numbers differ. Used as the goal instead of x = N.
export function verdictOf(l) {
  const same = (a, b) => a.length === b.length && lineText({ L: a, R: [] }) === lineText({ L: b, R: [] });
  const hasX = (s) => s.some((t) => t.t !== 'n');
  if (same(l.L, l.R) || (!hasX(l.L) && !hasX(l.R) && trueAnswer(l).kind === 'all')) return 'all';
  if (!hasX(l.L) && !hasX(l.R) && trueAnswer(l).kind === 'none') return 'none';
  return null;
}

// ---------- the public maker ----------
// generate(rungId, { rng, size = 2, recent = [], frac }) -> a problem (K1 .. K3: kbox.js kProblem, sized by frac):
//   { rung, mode: 'moves'|'balance'|'key', key, start: line, x, kind: 'one'|'all'|'none', par, route: [labels],
//     choices? (warm-up rungs), answer? }
//   an inequality rung: { rung, mode: 'ineq', kind: 'ineq', form, key, start: { form, chains, active }, x: null, par,
//     route, set } (ineq.js makeIneqProblem)
// Returns null only if 400 tries all failed the filters (the tests make sure that never happens).

// On the vault rung, verdict: true asks for an "infinitely many solutions / no solution" box, false for a real
// x = N box; left out, one box in VERDICT_SHARE is a verdict box (the ladder in algebra.js decides it itself).
export const VERDICT_SHARE = 0.1;

export function generate(rungId, { rng = makeRng(), size = 2, recent = [], verdict, frac } = {}) {
  // the kindergarten boxes (kbox.js): their numbers grow with frac (or with size, 1 .. 3, when no frac is given)
  if (K_RUNG[rungId]) return kProblem(rungId, { rng, frac: frac ?? (Math.max(1, Math.min(3, size)) - 1) / 2, recent });
  // the "Work it out" boxes (workout.js: order of operations O1..O5, exponents P1..P5), sized the same way
  if (WORK_RUNG[rungId]) return workProblem(rungId, { rng, frac: frac ?? (Math.max(1, Math.min(3, size)) - 1) / 2, recent });
  const rung = RUNG[rungId];
  if (!rung) throw new Error(`no rung ${rungId}`);
  const wantVerdict = rung.verdicts ? (verdict ?? rng.chance(VERDICT_SHARE)) : false;
  const verdictKind = wantVerdict ? rng.pick(['all', 'none']) : 'one';
  const seen = new Set(recent);
  for (let tries = 0; tries < 400; tries++) {
    if (rung.ineq) {
      const made = INEQ_RECIPES[rungId](rng, size);
      const p = made ? makeIneqProblem(rungId, made, rung.stage, { maxPar: rung.maxPar }) : null;
      if (!p || (seen.has(p.key) && tries < 300)) continue;
      return p;
    }
    if (rung.mode === 'balance' || rung.mode === 'key') {
      const p = rung.mode === 'balance' ? balanceProblem(rng, size) : keyProblem(rng, size);
      const start = line(p.L, p.R);
      const key = `${rungId}:${lineText(start)}`;
      if (seen.has(key) && tries < 300) continue;
      if (new Set(p.choices).size !== p.choices.length || p.choices.some((c) => c < 0)) continue;
      // the answer must not be sitting in the line already (6 + 7 = ? + 7 gives itself away)
      if (printedNumbers(start).has(p.answer) && tries < 300) continue;
      return { rung: rungId, mode: rung.mode, key, start, x: p.answer, kind: 'one', par: 1, route: [],
        answer: p.answer, choices: rng.shuffle([...p.choices]), ...(p.say ? { say: p.say } : {}) };
    }
    const made = rung.verdicts ? RECIPES[rungId](rng, size, verdictKind) : RECIPES[rungId](rng, size);
    if (!made) continue;
    const why = checkProblem(rungId, made.L, made.R, made.x);
    if (why) continue;
    const start = line(made.L, made.R);
    const key = `${rungId}:${lineText(start)}`;
    if (seen.has(key) && tries < 300) continue;
    const kind = typeof made.x === 'object' ? made.x.kind : 'one';
    let par, route;
    if (kind === 'one') {
      // a start further than the rung's longest par is thrown out, so the search need not look past it
      const s = solve(start, rung.stage, { maxDepth: rung.maxPar });
      if (!Number.isFinite(s.d) || s.d > rung.maxPar || s.approx) continue;   // par must be exact
      par = s.d; route = s.path.map(moveLabel);
    } else {
      const s = solveVerdict(start, rung.stage);
      if (!Number.isFinite(s.d) || s.d > rung.maxPar || s.approx) continue;
      par = s.d; route = s.path.map(moveLabel);
    }
    // (x + 4 = 9 is read out loud for a rider who doesn't read yet, from the clips: "4 and what make 9")
    let say = null;
    if (rungId === 'R1') {
      const withX = made.L.some((t) => t.t === 'x') ? made.L : made.R, other = withX === made.L ? made.R : made.L;
      const a = withX.find((t) => t.t === 'n'), b = other.length === 1 && other[0].t === 'n' ? other[0] : null;
      if (a && b) say = `${a.v.n} and what make ${b.v.n}`;
    }
    return { rung: rungId, mode: 'moves', key, start, x: kind === 'one' ? made.x : null, kind, par, route, ...(say ? { say } : {}) };
  }
  return null;
}

// Fewest moves until an R15 line shows its verdict (sides match, or x is gone and the numbers differ).
export function solveVerdict(start, st, maxDepth = 6) {
  return solve(start, st, { ...VERDICT, maxDepth });
}
// what solve needs to search for a verdict instead of x = N
export const VERDICT = { goal: (l) => verdictOf(l), goalId: 'verdict', finish: verdictFinishMoves };
