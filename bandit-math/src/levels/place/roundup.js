// The round-up's ladder: SERIES, from "1, 2, 3, ?" to "⅔, 1⅓, ?, 2⅔" (the agreed design, 2026-10-21). Cattle
// carry numbers, a card shows a number pattern with a blank, and the steer wearing the missing number is the one to
// rope. Counting by 1s (to 10, to 20, over a ten), then by 10s, 5s and 2s; every times table to 12 as a series, in the
// difficulty order (src/math/series.js TABLE_ORDER: 2; 10, 5, 3; 4, 9; 6, 8, 7; 11, 12), each fact a blank is on fed
// to the times chart, and after each tier its multiples herd ("Rope the 7-herd": every multiple in the herd), then the
// herd of any table; then the tables going down, odd steps up and down, growing and doubling rules; then below zero,
// halves, thirds, quarters, decimals, fractions below zero. Every level a small step from the one before; every wave a
// series (one kind of math here). A wave mixes in a card (now and then a herd) from the levels just below the rider's,
// and the earlier tables with red or yellow facts on the times chart (src/math/series.js RANGE, reviewFor).
//
// gen (what the maker reads: src/math/series.js seriesCard, and the times trainer for a herd):
//   { kind: 'series', by, from: [lo, hi] (the first number), terms (4), blank: 'end' | 'any', cross?: [lo, hi] (counting
//     on over a ten: the ten's range), table? (a times table: the blank is that table's fact, picked by
//     src/math/facts.js pickFact: red facts due back first, weak ones more) }
//   { kind: 'herd', tables: [...] }   rope every multiple of one table up to x12 (the table picked by pickTable: weak
//                                     tables more); the times trainer (src/math/times.js) deals the herd
//   { kind: 'down', tables }          a table counted backwards ("48, 42, ?, 30"): the blank a fact of it
//   { kind: 'step', by: [lo, hi], from: [lo, hi], down? }   the same odd step each time (not 1, 2, 5 or 10)
//   { kind: 'rule', rules: ['grow' | 'double' | 'x3' | 'x2+1' | 'x2-1'] }   5 numbers, the 5th the blank
//   { kind: 'neg', by: [...], up? }   across zero, down (6, 3, 0, ?) or up from below (−9, −6, ?, 0)
//   { kind: 'frac', den: [...], by: [tops], steps?: [[top, den]], most?, neg? }   counting by a fraction (by 2 with
//                                     den 3: by 2/3; steps: the steps themselves, [3, 4] for 3/4)
//   { kind: 'dec', by: [...], most?, cross? }               counting by a decimal (cross: over a whole number)
// A herd level counts 6 ropes (one herd: a herd of 11 has 6 to rope); a card level 5 cards.

import { TIMES } from '../kit.js';
import { seriesCard, TABLE_ORDER } from '../../math/series.js';
import { makeTimes } from '../../math/times.js';

const MUL_GRADE = { 2: 18, 10: 19, 5: 20, 3: 23, 4: 25, 9: 31, 6: 34, 8: 36, 7: 40, 11: 42, 12: 44 };
const T = (t) => ({
  id: `x${t}`, title: `The ${t}s`, line: `${t}, ${2 * t}, ${3 * t}, ?: the ${t}s up to ${t} ${TIMES} 12, starting anywhere, the blank anywhere`,
  grade: MUL_GRADE[t], strand: 'mul', count: 5, gen: { kind: 'series', table: t, by: t, terms: 4, blank: 'any' },
});
const H = (id, tables, grade) => ({
  id, title: `Rope all the ${tables.length > 4 ? 'multiples' : tables.map((t) => `${t}s`).join(', ').replace(/, ([^,]+)$/, ' or $1')}`,
  line: tables.length > 4 ? 'A herd of any table up to 12: rope every steer in it (the tables you miss come up more)'
    : `A herd of the ${tables.map((t) => `${t}s`).join(', ').replace(/, ([^,]+)$/, ' or $1')}: rope every steer in it, up to ${TIMES} 12`,
  grade, strand: 'mul', count: 6, gen: { kind: 'herd', tables },
});

export const PLACE = {
  id: 'roundup', name: 'The round-up', short: 'Round-up', math: 'Series', pic: 'cow', job: null, fastFrom: null,
  line: 'Every card is a number pattern with a blank: rope the steer that fills it.',
  levels: [
    { id: 'c1end', title: 'What comes next', line: '1, 2, 3, ?: counting on, up to 10', grade: 4, strand: 'number', count: 5, read: true,
      gen: { kind: 'series', by: 1, from: [1, 6], terms: 4, blank: 'end' } },
    { id: 'by1', title: 'Count by 1s', line: '1, 2, ?, 4: the blank anywhere, up to 10', grade: 7, strand: 'number', count: 5, read: true,
      gen: { kind: 'series', by: 1, from: [1, 7], terms: 4, blank: 'any' } },
    { id: 'by1b', title: 'Count by 1s to 20', line: '12, 13, ?, 15', grade: 13, strand: 'number', count: 5, read: true,
      gen: { kind: 'series', by: 1, from: [8, 17], terms: 4, blank: 'any' } },
    { id: 'tens1', title: 'Over a ten', line: '28, 29, ?, 31: counting on past a ten, up to 100', grade: 16, strand: 'number', count: 5, read: true,
      gen: { kind: 'series', by: 1, cross: [2, 9], terms: 4, blank: 'any' } },
    { id: 'by10', title: 'Count by 10s', line: '10, 20, ?, 40', grade: 17, strand: 'number', count: 5, read: true,
      gen: { kind: 'series', by: 10, from: [10, 50], terms: 4, blank: 'any' } },
    { id: 'by5', title: 'Count by 5s', line: '15, 20, ?, 30', grade: 18, strand: 'number', count: 5, read: true,
      gen: { kind: 'series', by: 5, from: [5, 35], terms: 4, blank: 'any' } },
    { id: 'by2', title: 'Count by 2s', line: '6, 8, ?, 12', grade: 19, strand: 'number', count: 5, read: true,
      gen: { kind: 'series', by: 2, from: [2, 12], terms: 4, blank: 'any' } },
    // each tier's tables as series, then that tier's herd, then the next tier (not every series first and every herd
    // after: from the 12s back to "rope all the 2s" was a big step down)
    T(2), T(10), T(5), T(3),
    H('herdA', [2, 10, 5, 3], 24),
    T(4), T(9),
    H('herdB', [4, 9], 32),
    T(6), T(8), T(7),
    H('herdC', [6, 8, 7], 41),
    T(11), T(12),
    H('herdD', [11, 12], 45),
    H('herdE', TABLE_ORDER, 47),
    { id: 'downA', title: 'Going down', line: '40, 35, ?, 25: the 2s, 3s, 4s, 5s and 10s counted backwards', grade: 51, strand: 'mul', count: 5,
      gen: { kind: 'down', tables: [2, 3, 4, 5, 10] } },
    { id: 'down', title: 'Going down, the harder tables', line: '48, 42, ?, 30: the 6s to 12s counted backwards', grade: 52, strand: 'mul', count: 5,
      gen: { kind: 'down', tables: [6, 7, 8, 9, 11, 12] } },
    { id: 'odd', title: 'Odd steps', line: '4, 11, 18, ?: the same step each time (3 to 9), starting anywhere', grade: 53, strand: 'number', count: 5,
      gen: { kind: 'step', by: [3, 9], from: [1, 20] } },
    { id: 'oddDown', title: 'Odd steps going down', line: '50, 43, 36, ?: the same step each time, going down', grade: 54, strand: 'number', count: 5,
      gen: { kind: 'step', by: [3, 12], from: [1, 30], down: true } },
    { id: 'grow', title: 'Growing steps', line: '1, 2, 4, 7, ?: one more added each time', grade: 56, strand: 'number', count: 5,
      gen: { kind: 'rule', rules: ['grow'] } },
    { id: 'double', title: 'Doubling', line: '3, 6, 12, 24, ?: double it (or times 3) each time', grade: 57, strand: 'number', count: 5,
      gen: { kind: 'rule', rules: ['double', 'double', 'x3'] } },
    { id: 'rule', title: 'Two-step rules', line: '1, 3, 7, 15, ?: double it and add 1 (or take 1 away)', grade: 60, strand: 'number', count: 5,
      gen: { kind: 'rule', rules: ['x2+1', 'x2-1'] } },
    { id: 'neg1', title: 'Below zero', line: '2, 1, 0, ?: counting down past zero', grade: 61, strand: 'number', count: 5,
      gen: { kind: 'neg', by: [1] } },
    { id: 'neg', title: 'Below zero by 2s, 3s, 5s', line: '6, 3, 0, ?: bigger steps down past zero', grade: 63, strand: 'number', count: 5,
      gen: { kind: 'neg', by: [2, 3, 4, 5] } },
    { id: 'negUp', title: 'Up from below zero', line: `${'−'}9, ${'−'}6, ?, 0: counting up to zero and past it`, grade: 66, strand: 'number', count: 5,
      gen: { kind: 'neg', by: [2, 3, 4, 5, 10], up: true } },
    { id: 'half', title: 'Halves', line: '½, 1, 1½, ?: counting by halves', grade: 34, strand: 'frac', count: 5,
      gen: { kind: 'frac', den: [2], by: [1], most: 4 } },
    { id: 'thirds', title: 'Thirds', line: '⅔, 1, 1⅓, ?: counting by thirds', grade: 38, strand: 'frac', count: 5,
      gen: { kind: 'frac', den: [3], by: [1], most: 5 } },
    { id: 'quarters', title: 'Quarters', line: '¾, 1, 1¼, ?: counting by quarters', grade: 40, strand: 'frac', count: 5,
      gen: { kind: 'frac', den: [4], by: [1], most: 6 } },
    { id: 'dec5', title: 'Decimals by halves', line: '0.5, 1, 1.5, ?: counting by 0.5', grade: 40, strand: 'dec', count: 5,
      gen: { kind: 'dec', by: [0.5], most: 5 } },
    { id: 'dec', title: 'Tenths', line: '0.7, 0.8, 0.9, ?: counting by 0.1 or 0.2, over a whole number', grade: 42, strand: 'dec', count: 5,
      gen: { kind: 'dec', by: [0.1, 0.1, 0.2], cross: true } },
    { id: 'dec25', title: 'Quarters as decimals', line: '0.25, 0.5, 0.75, ?: counting by 0.25', grade: 46, strand: 'dec', count: 5,
      gen: { kind: 'dec', by: [0.25], cross: true } },
    { id: 'thirds2', title: 'Two thirds, three quarters', line: '⅔, 1⅓, ?, 2⅔: counting by ⅔, ¾ or 1½', grade: 52, strand: 'frac', count: 5,
      gen: { kind: 'frac', steps: [[2, 3], [2, 3], [3, 4], [3, 2]], most: 3 } },
    { id: 'mix', title: 'Fractions below zero', line: `${'−'}1½, ${'−'}1, ${'−'}½, ?: halves and quarters across zero`, grade: 70, strand: 'frac', count: 5,
      gen: { kind: 'frac', den: [2, 4], by: [1], neg: true } },
  ],
  example: (L, rand) => roundupExample(L.gen, rand),
};

// The example for the levels page, from the job's own makers: a series card (src/math/series.js), or a herd from the
// times trainer (src/math/times.js: the job picks the table by the rider's weak tables; here at random).
export function roundupExample(g, rand) {
  if (g.kind === 'herd') {
    const t = g.tables[Math.floor(rand() * g.tables.length)];
    const w = makeTimes({}, { rand, now: () => 0 }).wave({ count: 11, table: t, reach: 12 });
    return { q: `${w.rule}: ${w.targets.map((x) => x.n).join(' · ')}`, a: w.targets.filter((x) => x.good).map((x) => x.n).sort((a, b) => a - b).join(', ') };
  }
  const c = seriesCard(g, rand);
  return { q: c.text, a: c.answerText };
}
