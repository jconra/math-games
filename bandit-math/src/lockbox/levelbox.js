// The lock box's maker for the levels (src/levels/place/lockbox.js is the ladder; this turns one level's `gen` into a
// box). The ladder's example() calls the same maker, so the levels page shows boxes the game really deals.
//
// gen, by kind of level:
//   { find: 'count', op: '+' | '−' }     the picture boxes: "3 plus what equals 8?", "7 take away what leaves 5?"
//                                        (kbox.js: things to count, read out loud), sums growing to 10 across the level
//   { find: true, shapes, max, from, neg, keys }   find x: tap the key that makes both sides the same (findx.js)
//   { rungs: ['R10', 'R14'], mix }       solved with moves (generate.js rungs). In order across the level (the first
//                                        rung for its first part, and so on), or mix: true, any of them each box
//   { work: ['P1', 'P2'] }               "Work it out" boxes (workout.js), in order across the level
// Within a level the numbers grow: size 1 for the first third of its count, 2, then 3 (gen.size: one size always).
//
//   levelBox(gen, { rng, into, count, recent, fact }) -> a problem as generate.js makes them, plus level (2..4: how
//     quiet the steps card is) and size. fact: a times fact for a find-x box (src/math/facts.js pickFact)
//   boxText(problem) -> { q, a }: the box as plain text (the levels page's examples)
//   levelExample(gen, rand) -> { q, a }   (the ladder's example maker)
//   factTables(into, count) -> the times tables a level's facts come from so far: the easy tiers first (2 3 5 10), then
//     4 and 9, then every table to 10 (the design's difficulty order), so "? × 4 = 28" doesn't open on 7 × 8

import { generate, makeRng } from './generate.js';
import { kProblem } from './kbox.js';
import { findProblem } from './findx.js';
import { lineText, MINUS } from './engine.js';
import { chainText, setText } from './ineq.js';
import { supText } from './workout.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nt = (v) => (v < 0 ? MINUS + Math.abs(v) : String(v));

export function factTables(into, count) {
  const f = partOf(into, count);
  return f < 0.34 ? [2, 3, 5, 10] : f < 0.67 ? [2, 3, 4, 5, 9, 10] : [2, 3, 4, 5, 6, 7, 8, 9, 10];
}

// how far into the level, 0..1 (the next box is the into+1-th of count)
const partOf = (into, count) => clamp((Number(into) || 0) / Math.max(1, count || 5), 0, 0.999);

export function levelBox(gen, { rng = makeRng(), into = 0, count = 5, recent = [], fact = null } = {}) {
  const f = partOf(into, count);
  const level = 2 + Math.min(2, Math.floor(f * 3));
  const size = gen.size ?? 1 + Math.min(2, Math.floor(f * 3));
  let p = null;
  if (gen.find === 'count') {
    p = kProblem(gen.op === '−' ? 'K3' : 'K2', { rng, frac: f + 1 / Math.max(1, count), recent, only: gen.op === '−' ? '−' : null });
  } else if (gen.find) {
    p = findProblem(gen, { rng, into, count, recent, fact });
  } else if (gen.work) {
    const id = gen.work[Math.min(gen.work.length - 1, Math.floor(f * gen.work.length))];
    p = generate(id, { rng, frac: f, recent });
  } else if (gen.rungs) {
    const id = gen.mix ? rng.pick(gen.rungs) : gen.rungs[Math.min(gen.rungs.length - 1, Math.floor(f * gen.rungs.length))];
    p = generate(id, { rng, size, recent }) || generate(id, { rng, size });
  }
  if (!p) throw new Error('lockbox levels: no box for ' + JSON.stringify(gen));
  return { ...p, level, size, review: false };
}

// The box as the levels page writes it: the question and its answer, plain text
export function boxText(p) {
  if (p.mode === 'count') return { q: p.words, a: String(p.answer) };
  if (p.mode === 'work') return { q: supText(p.start), a: supText(p.answer) };
  if (p.kind === 'ineq') return { q: p.start.chains.map(chainText).join(' or '), a: setText(p.set) };
  const q = lineText(p.start);
  if (p.kind === 'all') return { q, a: 'every number' };
  if (p.kind === 'none') return { q, a: 'no solution' };
  return { q, a: `x = ${nt(p.x)}` };
}

export function levelExample(gen, rand, { into = null, count = 5 } = {}) {
  const rng = makeRng(Math.floor(rand() * 2 ** 32));
  const at = into ?? Math.floor(rand() * count);
  return boxText(levelBox(gen, { rng, into: at, count }));
}
