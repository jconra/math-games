// THE DEER PHOTOGRAPHS' MATH: one equation, one right deer. Each deer in the herd wears a number tag; exactly one of
// those numbers makes the equation true. The kid photographs that one (src/missions/deerjob.js).
//
// The equation comes from the lock boxes' own recipes (src/lockbox/generate.js), at the kid's current rung of the
// solving-for-x ladder (rider.topics.algebra), so it is as hard as their lock boxes are now. A rider without "Solving
// for x" ticked gets the simplest one-step equations (x + 4 = 9, x − 3 = 5; 3x = 12 too when times tables are ticked).
// The deer never move the ladder: that stays the lock boxes' job.
//
// The wrong tags are the numbers kids really land on: adding where they should take away, forgetting to divide,
// multiplying instead, the sign of the answer flipped, one off. A wrong pick gets one plain line, checked the way a
// teacher checks a key: "That one's 7: check, 7 + 7 is 14, not 12." The helper shows the two sides as a balance (14
// against 12, tipped) and the steps that solve it, one move per line ("−7 both sides").
//
//   rungFor(rider)                -> { rung, size, from: 'algebra' | 'simple' }
//   makePhoto(rider, { n, rng, recent })   -> a shot:
//     { rung, size, eq: '3x − 4 = 11', x: 5, values: [numbers, one per deer], right: index of x in values,
//       start (the line, for the engine), steps: [{ text, note }] (the first is the equation, the last is x = 5),
//       key: a short id (not repeated within `recent`) }
//   whyNot(shot, v)               -> the one line for a wrong pick
//   balanceFor(shot, v)           -> { left, right, leftText, rightText, tip: -1 | 0 | 1 } the two sides with v put in
//   numText(v)                    -> '5', '−5' (the real minus sign)
//
// Nothing here touches the page, so the node tests load it directly (tests/deermath.test.mjs).

import { generate, makeRng, RUNG } from '../lockbox/generate.js';
import { lineText, keySteps, linearForm, solve, applyMove, moveNote, evalSide, xSide, MINUS, F } from '../lockbox/engine.js';

export const DEERMATH = {
  simple: ['R1', 'R2'],      // the rungs for a rider without "Solving for x": x + 4 = 9, x − 3 = 5 ...
  withTimes: 'R3',           // ... and 3x = 12 when times tables are ticked
  // a rung the deer can't use as it is: the two warm-up rungs have no x to solve (balance, try a key) and the
  // legendary vault's answer can be "every key" or "none": the nearest real one-answer rung stands in
  swap: { R0a: 'R1', R0b: 'R1', R15: 'R14' },
  sizeOf: { 2: 1, 3: 2, 4: 2, 5: 2 },   // the lock boxes' level on a rung -> how big the numbers are (as algebra.js)
  most: 99,                  // no tag bigger than this either way
  recent: 12,                // equations not dealt again within this many
};

export const numText = (v) => (v < 0 ? MINUS + Math.abs(v) : String(v));

// which rung of the ladder the deer use for this rider, and how big the numbers are
export function rungFor(rider, rng = makeRng()) {
  const on = (rider && rider.topicsOn) || {};
  const alg = rider && rider.topics && rider.topics.algebra;
  if (on.algebra && alg && typeof alg === 'object' && RUNG[alg.rung]) {
    const rung = DEERMATH.swap[alg.rung] || alg.rung;
    const level = alg.placing ? 3 : (alg.levels && alg.levels[rung]) || 2;
    return { rung, size: DEERMATH.sizeOf[level] || 2, from: 'algebra' };
  }
  if (on.algebra) return { rung: 'R1', size: 1, from: 'algebra' };   // (ticked, never played: the first rung)
  const pool = on.times ? [...DEERMATH.simple, DEERMATH.withTimes] : DEERMATH.simple;
  return { rung: rng.pick(pool), size: 1, from: 'simple' };
}

const isWhole = (f) => f && f.d === 1 && Number.isFinite(f.n);

// The numbers a kid lands on by mistake, for the line a·x + b = c·x + d (worked out from both sides):
//   the right answer is (d − b) / (a − c)
//   added instead of taking away: (d + b) / (a − c)
//   moved the x the wrong way: (d − b) / (a + c)
//   forgot to divide: d − b; multiplied instead of dividing: (d − b) · (a − c)
//   the sign of the answer flipped; one or two off
function slipsFor(start, x) {
  const p = linearForm(start.L), q = linearForm(start.R);
  const a = p.a.sub(q.a), top = q.b.sub(p.b), out = [];
  const add = (f) => { if (isWhole(f)) out.push(f.n); };
  const tryDiv = (n, d) => { if (!d.isZero()) add(n.div(d)); };
  tryDiv(q.b.add(p.b), a);
  tryDiv(top, p.a.add(q.a));
  if (!a.abs().isOne()) { add(top); add(top.mul(a)); }
  add(F(-x));
  out.push(x + 1, x - 1, x + 2, x - 2, x + 3, x - 3);
  return out;
}

// n tag numbers: the answer and n − 1 slips (no repeats, no negatives on the rungs that have none, never above `most`)
function tagValues(shot, n, rng) {
  const st = RUNG[shot.rung].stage, plusOnly = st.sign !== 'any';
  const ok = (v) => Number.isInteger(v) && v !== shot.x && Math.abs(v) <= DEERMATH.most && !(plusOnly && v <= 0);
  const slips = slipsFor(shot.start, shot.x);
  // the first few (the real mistakes) in a random order ahead of the one-offs, so the herd isn't always x ± 1
  const real = rng.shuffle(slips.slice(0, slips.length - 6)), near = rng.shuffle(slips.slice(-6));
  // (a tag whose check comes out tidy is taken first: both sides whole numbers, and not huge. "1/2 is 1/2, not 2" or
  // "5·81 + 2 + 4·81 is 731" teach less than "8 is 4, not 2")
  const tidy = (v) => { const f = F(v); return [shot.start.L, shot.start.R].every((s) => { const e = evalSide(s, f); return e.d === 1 && Math.abs(e.n) <= 150; }); };
  const picked = [];
  for (const pass of [tidy, () => true]) {
    for (const v of [...real, ...near]) if (ok(v) && pass(v) && !picked.includes(v) && picked.length < n - 1) picked.push(v);
    for (let k = 4; picked.length < n - 1 && k < 40; k++) for (const v of [shot.x + k, shot.x - k]) if (ok(v) && pass(v) && !picked.includes(v) && picked.length < n - 1) picked.push(v);
  }
  return rng.shuffle([shot.x, ...picked]);
}

// the steps that solve it, one move a line, as the lock box's fewest-moves search finds them
function stepsFor(start, rung) {
  const r = RUNG[rung];
  const s = solve(start, r.stage, { maxDepth: Math.max(2, r.maxPar || 2) });
  const steps = [{ text: lineText(start), note: '' }];
  let l = start;
  for (const m of s.path || []) {
    const next = applyMove(l, m); if (!next) break;
    l = next.out; steps.push({ text: lineText(l), note: moveNote(m) });
  }
  return steps;
}

export function makePhoto(rider, { n = 4, rng = makeRng(), recent = [] } = {}) {
  n = Math.max(2, Math.min(6, Math.round(n)));
  const { rung, size, from } = rungFor(rider, rng);
  let p = null;
  for (let i = 0; i < 6 && !p; i++) {
    const g = generate(rung, { rng, size, recent });
    if (g && g.kind === 'one' && Number.isInteger(g.x)) p = g;
  }
  if (!p) p = generate('R1', { rng, size: 1 });
  const shot = { rung: p.rung, size, from, eq: lineText(p.start), x: p.x, start: p.start, key: p.key };
  shot.values = tagValues(shot, n, rng);
  shot.right = shot.values.indexOf(shot.x);
  shot.steps = stepsFor(p.start, p.rung);
  return shot;
}

// the x side first: "x + 7" is checked against "12", whichever way round the equation was written
function sides(shot) {
  const s = xSide(shot.start);
  return s === 'R' ? [shot.start.R, shot.start.L, s] : [shot.start.L, shot.start.R, s];
}

// "That one's 7: check, 7 + 7 is 14, not 12."  (x on both sides: "... 5·4 + 3 makes 23, but 2·4 + 15 makes 23")
export function whyNot(shot, v) {
  const [A, B, s] = sides(shot);
  const a = keySteps(A, v), b = keySteps(B, v);
  const av = a[a.length - 1], bv = b[b.length - 1];
  if (s === 'both') return `That one's ${numText(v)}: ${a[0]} makes ${av}, but ${b[0]} makes ${bv}.`;
  return `That one's ${numText(v)}: check, ${a[0]} is ${av}, not ${bv}.`;
}

// the two sides with v put in, for the balance picture (tip: which way the beam leans: −1 left pan down, 1 right)
export function balanceFor(shot, v) {
  const [A, B] = sides(shot);
  const l = evalSide(A, F(v)), r = evalSide(B, F(v));
  const a = keySteps(A, v), b = keySteps(B, v);
  const lv = l.valueOf(), rv = r.valueOf();
  return { left: lv, right: rv, leftText: a[0], rightText: b[0], leftValue: a[a.length - 1], rightValue: b[b.length - 1],
    tip: lv === rv ? 0 : lv > rv ? -1 : 1 };
}
