// Loose pigs: SORTING (the agreed design, 2026-10-21: "more/less than -> even/odd -> positive/negative -> (fractions
// bigger/smaller than 1/2)"). Pigs run loose wearing numbers or sums; two pens have signs, and the kid herds each pig
// into the pen it belongs in. One batch is one level; each pig's first pen is one answer (a wrong pen only while the
// rider is herding it: a pig that bolts in on its own says nothing about the kid).
//
// The steps, easiest first: plain numbers more or less than 5, then 10; small sums more or less; even or odd up to 10,
// 20, 100, and sums; sums past 10 and two-digit sums more or less; a fraction less or more than a half (in school-year
// order, before below zero); then plain numbers negative or positive, and positive & negative sums (negatives.js's
// ladder), which side of zero they land.
//
// gen (what the yard's maker reads: src/missions/pigmath.js batchAt, the ONE maker for the job and these examples):
//   { pens: 'less-more', nums: [lo, hi], mid }  |  { pens: 'less-more', map: 'adding' | 'taking', step }
//   { pens: 'even-odd', top, sums? }  |  { pens: 'half', den: [...] }  |  { pens: 'neg-pos', top }  |  { pens: 'neg-pos', step }

import { batchAt } from '../../missions/pigmath.js';
import { MINUS } from '../kit.js';

const L = (id, title, line, grade, strand, gen, more = {}) => ({ id, title, line, grade, strand, count: 5, gen, ...more });

export const PLACE = {
  id: 'pigs', name: 'Loose pigs', short: 'Pigs', math: 'Sorting', pic: 'pig', job: 'pigs', fastFrom: null,
  line: 'Herd every pig into the pen its number belongs in.',
  levels: [
    L('lt5', 'More or less than 5', 'Pigs wear numbers up to 10', 3, 'number', { pens: 'less-more', nums: [1, 10], mid: 5 }, { read: true }),
    L('lt10', 'More or less than 10', 'Pigs wear numbers up to 20', 6, 'number', { pens: 'less-more', nums: [1, 20], mid: 10 }, { read: true }),
    L('sum10', 'Small sums: more or less?', '3 + 4, 1 + 2: more or less than 5?', 8, 'add', { pens: 'less-more', map: 'adding', step: 2, mid: 5 }, { read: true }),
    L('take10', 'Taking away: more or less?', `9 ${MINUS} 4, 6 ${MINUS} 5: which pen?`, 9, 'sub', { pens: 'less-more', map: 'taking', step: 2, mid: 5 }, { read: true }),
    L('eo10', 'Even or odd, up to 10', 'Pairs with none left over are even', 11, 'number', { pens: 'even-odd', top: 10 }, { read: true }),
    L('eo20', 'Even or odd, up to 20', '14, 17, 9: which pen?', 14, 'number', { pens: 'even-odd', top: 20 }, { read: true }),
    L('sum20', 'Sums past 10: more or less?', '8 + 5, 9 + 7', 16, 'add', { pens: 'less-more', map: 'adding', step: 5, mid: 15 }),
    L('eo100', 'Even or odd, up to 100', 'Look at the last digit', 18, 'number', { pens: 'even-odd', top: 100 }),
    L('take20', 'Taking away past 10: more or less?', `13 ${MINUS} 5, 17 ${MINUS} 9`, 19, 'sub', { pens: 'less-more', map: 'taking', step: 6 }),
    L('eoSum', 'Even or odd sums', '7 + 8, 6 + 4: add, then sort', 22, 'number', { pens: 'even-odd', top: 20, sums: true }, { also: [{ strand: 'add', grade: 15, weight: 0.5 }] }),
    L('lt50', 'Two-digit sums: more or less?', `36 + 27, 52 ${MINUS} 27`, 28, 'add', { pens: 'less-more', map: 'adding', step: 8, mid: 50 }),
    L('half', 'Less or more than a half', '3/8, 5/6, 1/4: half the bottom number is a half', 36, 'frac', { pens: 'half', den: [2, 4, 6, 8, 10] }),
    L('half2', 'Less or more than a half, any bottom number', '3/7, 5/9, 7/12', 42, 'frac', { pens: 'half', den: [3, 5, 7, 9, 12] }),
    L('pn', 'Positive or negative', `${MINUS}3, 7, ${MINUS}12: which side of zero?`, 56, 'number', { pens: 'neg-pos', top: 20 }),
    L('pnUp', 'A negative plus a positive', `${MINUS}3 + 8, ${MINUS}9 + 2: which side?`, 60, 'add', { pens: 'neg-pos', step: 1 }),
    L('pnDown', 'Going further down, or back up', `${MINUS}4 ${MINUS} 5, 8 ${MINUS} 3`, 68, 'sub', { pens: 'neg-pos', step: 3 }, { also: [{ strand: 'add', grade: 64, weight: 0.5 }] }),
    L('pnCross', 'Taking away past zero', `3 ${MINUS} 8, ${MINUS}2 + 9`, 72, 'sub', { pens: 'neg-pos', step: 4 }),
    L('pnNeg', 'Taking away a negative', `3 ${MINUS} (${MINUS}5), 2 + (${MINUS}9)`, 76, 'add', { pens: 'neg-pos', step: 5 }, { also: [{ strand: 'sub', grade: 76, weight: 0.5 }] }),
    L('pn20', 'All of them, up to 20', `${MINUS}10 + 18, 4 ${MINUS} (${MINUS}12)`, 82, 'add', { pens: 'neg-pos', step: 6 }, { also: [{ strand: 'sub', grade: 82, weight: 0.5 }] }),
  ],
  example: (lv, rand) => pigsExample(lv.gen, rand),
};

// one pig of a batch: what it wears, and its pen
export function pigsExample(g, rand) {
  const b = batchAt(g, { size: 2, rand });
  const p = b.pigs[Math.floor(rand() * b.pigs.length)];
  return { q: `${p.text}: ${b.pens[0].label} or ${b.pens[1].label}?`, a: b.pens[p.pen].label };
}
