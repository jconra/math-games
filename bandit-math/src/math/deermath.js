// THE DEER PHOTOGRAPHS' MATH: one equation, one right deer. Each deer in the herd wears a number tag; exactly one of
// those numbers makes the equation true. The kid photographs that one (src/missions/deerjob.js).
//
// The equation comes from the lock boxes' own recipes (src/lockbox/generate.js), but a photo is a quick pick made in
// the head with no solver (the lock box has its moves to work with), so it is asked WELL BELOW the rider's level in
// equations (the skill model, src/math/skill.js, asked through src/math/asking.js): DEERMATH.below points under it,
// never past DEERMATH.top (two steps at their smallest, "2x + 5 = 17"), a roll's first picture, and every one after a
// miss in that roll, never past one step (DEERMATH.firstTop, "x/4 = 3"), no negative numbers (a one-step rung with negatives is swapped for one without), and
// never under the add-on rung for a rider above it. The
// kindergarten boxes' "2 + x = 4" (2 plus what equals 4?) stay for the youngest. A missed photo makes the next ones
// easier still (`ease`, kept by the job: DEERMATH.ease). Each first try at a photo goes back to the model at the point
// it was really made at (a travel job: no time).

// The wrong tags are the numbers kids really land on: adding where they should take away, forgetting to divide,
// multiplying instead, the sign of the answer flipped, one off. A wrong pick gets one plain line, checked the way a
// teacher checks a key: "That one's 7: check, 7 + 7 is 14, not 12." The helper shows the two sides as a balance (14
// against 12, tipped) and the steps that solve it, one move per line ("−7 both sides").
//
//   rungFor(rider, rng, { ease, oneStep })  -> { rung, size, frac, from: 'skill', q, at, map } (q: asking.js askFor's answer; at:
//                                    the point the equation really sits at: lowered, capped, a swapped rung's own)
//   makePhoto(rider, { n, rng, recent, ease, oneStep, rung })   -> a shot (oneStep: one step at
//                                    most (DEERMATH.firstTop); rung: deal that rung as it is, for the tests):
//     { rung, size, eq: '3x − 4 = 11', x: 5, values: [numbers, one per deer], right: index of x in values,
//       start (the line, for the engine), steps: [{ text, note }] (the first is the equation, the last is x = 5),
//       key: a short id (not repeated within `recent`), at (the point for the skill model), words, say (the
//       kindergarten boxes' question written out, "2 plus what equals 4?", and as it is read aloud; else null);
//       a kindergarten box's also young: true, eq written with a box to fill ("4 + ? = 5") and solved ("4 + 1 = 5") }
//   whyNot(shot, v)               -> the one line for a wrong pick
//   balanceFor(shot, v)           -> { left, right, leftText, rightText, tip: -1 | 0 | 1 } the two sides with v put in
//   numText(v)                    -> '5', '−5' (the real minus sign)
//
// Nothing here touches the page, so the node tests load it directly (tests/deermath.test.mjs).

import { generate, makeRng, RUNG } from '../lockbox/generate.js';
import { K_RUNG } from '../lockbox/kbox.js';
import { MAPS, pctAt, stepAt, fits, readAloud } from './skill.js';
import { chooseFor, askFor } from './asking.js';
import { youngMost } from '../lockbox/strand.js';
import { lineText, keySteps, linearForm, solve, applyMove, moveNote, evalSide, xSide, MINUS, F } from '../lockbox/engine.js';

export const DEERMATH = {
  maps: ['lockboxK', 'lockbox'],   // the skill model's makers the deer ask (the kindergarten boxes, the lock box ladder)
  // a rung the deer can't use as it is: the two warm-up rungs have no x to solve (balance, try a key) and the
  // legendary vault's answer can be "every key" or "none": the nearest real one-answer rung stands in
  // (and the inequality rungs, past the vault: a deer number is one value, so the hardest equation rung stands in)
  // (and "one step with negatives": a photo keeps to counting numbers below two steps, so the one-step "x/4 = 3" stands in)
  swap: { R0a: 'R1', R0b: 'R1', R5: 'R4', R15: 'R14', I1: 'R14', I2: 'R14', I3: 'R14', I4: 'R14' },
  sizeOf: { 2: 1, 3: 2, 4: 2, 5: 2 },   // the lock boxes' level on a rung -> how big the numbers are (as algebra.js)
  below: 20,                 // points under the rider's equations level a photo is asked at (a quick pick, no solver)
  top: 'R6', topFrac: 0,     // ... and never harder than this rung, at its smallest numbers (two steps: 2x + 5 = 17)
  firstTop: 'R4', firstFrac: 0.67,   // a roll's first picture (and the rest of a roll with a miss in it): one step at most
                                     // ("x/4 = 3", "3x = 12"); two steps only after a clean one
  ease: { miss: 8, right: 3, most: 24 },   // points easier after a missed photo (first try), back by `right` a clean one
  most: 99,                  // no tag bigger than this either way
  recent: 12,                // equations not dealt again within this many
};

export const numText = (v) => (v < 0 ? MINUS + Math.abs(v) : String(v));

// which rung the deer use for this rider now, and how big the numbers are: the skill model's step (a rung of the lock
// box ladder, or a kindergarten box), with the rungs the deer can't use swapped (DEERMATH.swap). Within a rung the
// numbers grow as the lock boxes' do: a third of the way to the next rung is the box's level 3, two thirds level 4.
export function rungFor(rider, rng = makeRng(), { ease = 0, oneStep = false } = {}) {
  // (the picture boxes only for a rider who is read to, unless the ladder doesn't fit yet)
  const maps = DEERMATH.maps.filter((m) => MAPS[m] && (m !== 'lockboxK' || readAloud(rider) || !fits(rider, 'lockbox', DEERMATH.maps)));
  let map = chooseFor(rider, maps.length ? maps : ['lockbox'], { rand: () => rng.next() }) || 'lockbox';
  // (the ladder's two warm-up rungs stand in as R1, two school years up: while the kindergarten boxes still fit, they
  // are the nearer)
  // (a rider whose questions are read out: no further than the lock box goes for them, R1, which can be said aloud)
  const most = youngMost(rider);
  if (map === 'lockbox' && maps.includes('lockboxK') && fits(rider, 'lockboxK', maps) && DEERMATH.swap[askFor(rider, 'lockbox', { most }).id] === 'R1') map = 'lockboxK';
  const q = askFor(rider, map, { most });
  // the point the photo is made at: well below the level, eased after misses, held under the top rung; never under
  // the add-on rung for a rider at or above it (the warm-up rungs below have no x), the kindergarten boxes' own floor
  const e = Math.max(0, Math.min(DEERMATH.ease.most, Number(ease) || 0));
  let pt;
  if (map === 'lockbox') {
    const floor = Math.min(q.at, pctAt('lockbox', 'R1'));
    const cap = oneStep ? pctAt('lockbox', DEERMATH.firstTop, DEERMATH.firstFrac) : pctAt('lockbox', DEERMATH.top, DEERMATH.topFrac);
    pt = Math.max(floor, Math.min(cap, q.at - DEERMATH.below - e));
  } else pt = Math.max(MAPS[map].anchors[0], q.at - e);
  const st = stepAt(map, pt);
  const id = st.id || 'R1';
  const rung = DEERMATH.swap[id] || (RUNG[id] || K_RUNG[id] ? id : 'R1');
  const frac = st.frac || 0, level = 2 + Math.min(2, Math.floor(frac * 3));
  const at = rung === id ? Math.round(pt * 10) / 10 : pctAt('lockbox', rung);
  return { rung, size: rung === id ? DEERMATH.sizeOf[level] || 2 : 1, frac, from: 'skill', q, at, map };
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
  const st = RUNG[shot.rung] ? RUNG[shot.rung].stage : { sign: 'pos' }, plusOnly = st.sign !== 'any';   // (a kindergarten box: counting numbers)
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
function stepsFor(start, rung, x, p = {}) {
  const r = RUNG[rung];
  if (!r) {
    // a kindergarten box: one look, said the way the box says it ("2 and 2 make 4")
    const note = p.op === '+' ? `${p.a} and ${x} make ${p.b}` : p.a != null ? `${p.a} take away ${x} leaves ${p.b}` : 'count them';
    return [{ text: lineText(start), note: '' }, { text: `x = ${numText(x)}`, note }];
  }
  const s = solve(start, r.stage, { maxDepth: Math.max(2, r.maxPar || 2) });
  const steps = [{ text: lineText(start), note: '' }];
  let l = start;
  for (const m of s.path || []) {
    const next = applyMove(l, m); if (!next) break;
    l = next.out; steps.push({ text: lineText(l), note: moveNote(m) });
  }
  return steps;
}

export function makePhoto(rider, { n = 4, rng = makeRng(), recent = [], ease = 0, oneStep = false, rung: only = null } = {}) {
  n = Math.max(2, Math.min(6, Math.round(n)));
  const { rung, size, from, frac, at } = only ? { rung: DEERMATH.swap[only] || only, size: 2, from: 'test', frac: 0, at: pctAt(RUNG[only] ? 'lockbox' : 'lockboxK', DEERMATH.swap[only] || only) } : rungFor(rider, rng, { ease, oneStep });
  let p = null;
  for (let i = 0; i < 6 && !p; i++) {
    const g = generate(rung, { rng, size, recent, frac });
    if (g && g.kind === 'one' && Number.isInteger(g.x)) p = g;
  }
  if (!p) p = generate('R1', { rng, size: 1 });
  const shot = { rung: p.rung, size, from, eq: lineText(p.start), x: p.x, start: p.start, key: p.key,
    at: p.rung === rung ? at : pctAt('lockbox', p.rung), words: p.words || null, say: p.say || null };
  shot.values = tagValues(shot, n, rng);
  shot.right = shot.values.indexOf(shot.x);
  shot.steps = stepsFor(p.start, p.rung, p.x, p);
  // (the kindergarten boxes' own way of writing it: a box to fill, "4 + ? = 5", not a letter; and the print shows it
  // filled in, "4 + 1 = 5")
  if (K_RUNG[shot.rung]) {
    shot.young = true;
    const box = (t) => t.replace(/x/g, '?');
    shot.eq = box(shot.eq);
    shot.steps = shot.steps.map((st) => ({ ...st, text: box(st.text) }));
    shot.solved = shot.eq.replace('?', numText(shot.x));
  }
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
