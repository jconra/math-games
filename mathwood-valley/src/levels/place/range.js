// The bottle range: NUMBER SENSE (the agreed design, 2026-10-21: "biggest/smallest -> order -> rounding, place value ->
// estimating -> negatives on a number line"). Bottles and tin cans stand on a shelf wearing numbers, and a card says
// which to shoot. The youngest pick the bigger of two numbers (read out to a rider who is read to); then biggest and
// smallest of a few, a dot on a number line, putting numbers in order, place value, rounding, estimating, and then
// below zero: the dot on a line through zero, biggest and smallest, between, in order.
//
// gen (what the range's maker reads: src/math/numbersense.js cardAt, the ONE maker for the job and these examples):
//   { step: an id in numbersense.js STEPS }  the range's own cards as they were
//   { kind: 'compare', lo, hi, n }           biggest or smallest of n (n 2: "the bigger number")
//   { kind: 'order', lo, hi, n }             shot in order, smallest first (or largest, past 1,000)
//   { kind: 'dot', lo, hi, n, neg? }         a number line drawn on the card with a dot: shoot its number
//   { kind: 'place', digits, n }             "Shoot the bottle with a 4 in the tens place"
// Decimals are the store's (the mixed place); the range stays with whole numbers.

import { cardAt, numText } from '../../math/numbersense.js';
import { makeRng } from '../../lockbox/generate.js';

const L = (id, title, line, grade, gen, more = {}) => ({ id, title, line, grade, strand: 'number', count: 5, gen, ...more });

export const PLACE = {
  id: 'range', name: 'The bottle range', short: 'Range', math: 'Number sense', pic: 'bottle', job: 'range', fastFrom: null,
  line: 'Shoot the bottles the card asks for: biggest, in order, rounded, estimated.',
  levels: [
    L('two10', 'The bigger of two', 'Two bottles up to 10: shoot the bigger (or smaller) number', 2, { kind: 'compare', lo: 1, hi: 10, n: 2 }, { read: true }),
    L('big10', 'Biggest and smallest, up to 10', 'Three bottles: shoot the biggest (or smallest)', 5, { kind: 'compare', lo: 1, hi: 10, n: 3 }, { read: true }),
    L('big20', 'Biggest and smallest, up to 20', '19, 13, 18, 14: shoot the smallest', 12, { kind: 'compare', lo: 1, hi: 20, n: 4 }, { read: true }),
    L('dot20', 'A dot on the number line', 'A line from 0 to 20 with a dot: shoot its number', 15, { kind: 'dot', lo: 0, hi: 20, n: 4 }, { read: true }),
    L('order20', 'Smallest to largest, up to 20', 'Three bottles, shot in order', 17, { kind: 'order', lo: 1, hi: 20, n: 3 }),
    L('order50', 'Smallest to largest, up to 50', 'Three bottles, shot in order', 21, { step: 'order50' }),
    L('place2', 'Tens and ones', 'Shoot the number with a 4 in the tens place', 24, { kind: 'place', digits: 2, n: 4 }),
    L('order100', 'Four in order, up to 100', '38, 83, 35, 58', 26, { kind: 'order', lo: 10, hi: 99, n: 4 }),
    L('round10', 'Rounding to the nearest ten', 'Shoot every bottle that rounds to 40', 30, { step: 'round10' }),
    L('place3', 'Hundreds, tens and ones', 'Shoot the number with a 4 in the hundreds place', 32, { kind: 'place', digits: 3, n: 4 }),
    L('estAdd', 'Estimating a sum', 'Shoot the bottle closest to 53 + 39', 34, { step: 'estAdd' }),
    L('order1000', 'Smallest to largest, up to 1,000', '946, 469, 496, 964', 38, { step: 'order1000' }),
    L('round100', 'Rounding to the nearest hundred', 'Shoot every bottle that rounds to 400', 44, { step: 'round100' }),
    L('estMore', 'Estimating differences and products', 'Shoot the bottle closest to 46 − 18', 50, { step: 'estMore' }),
    L('dotNeg', 'Below zero on the number line', 'A line from −10 to 10 with a dot: shoot its number', 58, { kind: 'dot', lo: -10, hi: 10, n: 4, neg: true }),
    L('bigNeg', 'Biggest and smallest, with negatives', '−8, −1, −10, 6', 62, { step: 'bigNeg' }),
    L('between', 'Between two numbers', 'Shoot every bottle between −7 and 3', 68, { step: 'between' }),
    L('orderNeg', 'In order, with negatives', '−2, −11, 13, 4', 76, { step: 'orderNeg' }),
    L('orderNeg5', 'Five in order, bigger negatives', '21, −21, 26, −12, 12', 86, { step: 'orderNeg5' }),
  ],
  example: (lv, rand) => rangeExample(lv.gen, rand),
};

export function rangeExample(g, rand) {
  const c = cardAt(g, { rng: makeRng(Math.floor(rand() * 2 ** 32)), what: rand() < 0.5 ? 'can' : 'bottle' });
  const shelf = c.targets.map((t) => numText(t.n)).join(' · ');
  const good = c.targets.filter((t) => t.good).map((t) => t.n);
  if (c.kind === 'order') good.sort((a, b) => (c.ask.dir === 'down' ? b - a : a - b));
  const pic = c.kind === 'dot' ? ` (a line from ${numText(c.ask.lo)} to ${numText(c.ask.hi)}, the dot at ${numText(c.ask.v)})` : '';
  return { q: `${c.rule}${pic}: ${shelf}`, a: good.map(numText).join(', ') };
}
