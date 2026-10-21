// The lock boxes' ladder: EQUATIONS, the ladder as the design wrote it (2026-10-20/21): "what + 3 = 8" x5, "7 − what = 5"
// x5, then x under 10 x5, to 15 x5, to 20, multiplication, division, bigger numbers (negatives here), two steps, then x
// on both sides at about the middle ("You've reached algebra!" once, then "The rules"), and slower after that (10 each):
// + and −, with multiplication, with division, the opposite of x and like terms, parentheses, inequalities, exponents,
// bigger numbers. Up to two steps the box is opened by FINDING x (tap one of a few keys; no moves: src/lockbox/
// findx.js); the moves and the rules start at x on both sides. Fast answers count double only from there (fastFrom).
//
// gen (what the lock box's maker reads: src/lockbox/levelbox.js levelBox, the ONE maker; example() calls it too):
//   { find: 'count', op }                       the picture boxes ("3 plus what equals 8?"), read out loud
//   { find: true, shapes, max, from, neg, keys } find x: tap the key that makes both sides the same (findx.js)
//   { rungs: [...], mix, size }                 solved with moves, rungs of src/lockbox/generate.js in order across the
//                                               level (mix: any of them each box)
//   { work: [...] }                             "Work it out" boxes (src/lockbox/workout.js), in order across the level
// Within a level the numbers grow a little from box to box (levelbox.js), so no step between two levels is a jump.

import { MINUS } from '../kit.js';
import { levelExample } from '../../lockbox/levelbox.js';

export const PLACE = {
  id: 'lockbox', name: 'Lock boxes', short: 'Lock boxes', math: 'Equations', pic: 'lockbox', job: null, fastFrom: 'both',
  line: 'Crack the box by finding the number that makes both sides the same.',
  levels: [
    { id: 'whatAdd', title: 'What plus 3 equals 8?', line: 'Find the missing number in a sum up to 10, with things to count', grade: 6, strand: 'eq', count: 5, read: true,
      gen: { find: 'count', op: '+' } },
    { id: 'whatSub', title: '7 minus what equals 5?', line: 'The missing number when taking away, up to 10, with things to count', grade: 9, strand: 'eq', count: 5, read: true,
      gen: { find: 'count', op: '−' } },
    { id: 'x10', title: 'Meet x', line: 'x is the number we are looking for: x + 3 = 8, 9 − x = 4 (up to 10). Tap the key that fits', grade: 14, strand: 'eq', count: 5,
      gen: { find: true, shapes: ['x+a=b', 'x-a=b', 'a-x=b'], max: 10, from: 10, keys: 3 } },
    { id: 'x15', title: 'Find x, up to 15', line: 'x − 6 = 9, 7 + x = 15', grade: 17, strand: 'eq', count: 5,
      gen: { find: true, shapes: ['x+a=b', 'x-a=b', 'a-x=b', 'a+x=b'], max: 15, from: 10, keys: 3 } },
    { id: 'x20', title: 'Find x, up to 20', line: '14 + x = 20, x − 8 = 11', grade: 20, strand: 'eq', count: 5,
      gen: { find: true, shapes: ['x+a=b', 'x-a=b', 'a-x=b', 'a+x=b'], max: 20, from: 15, keys: 3 } },
    { id: 'xMul', title: 'Times: 3x = 12', line: '3x means 3 times x: the times tables backwards', grade: 30, strand: 'eq', count: 5,
      gen: { find: true, shapes: ['ax=b'], max: 10, keys: 4, facts: true } },
    { id: 'xDiv', title: 'Divided by: x/4 = 3', line: 'x/4 means x divided by 4: x shared into 4 equal parts', grade: 36, strand: 'eq', count: 5,
      gen: { find: true, shapes: ['x/a=b'], max: 10, keys: 4, facts: true } },
    { id: 'xBig', title: 'Bigger numbers, and below zero', line: `x − 27 = 45, 6x = 84, x + 7 = 3 (x = ${MINUS}4)`, grade: 50, strand: 'eq', count: 5,
      gen: { find: true, shapes: ['x+a=b', 'x-a=b', 'ax=b', 'x/a=b'], max: 100, from: 20, neg: true, keys: 4 } },
    { id: 'two', title: 'Two steps: 2x + 5 = 17', line: 'x times a number, plus or minus a number', grade: 56, strand: 'eq', count: 5,
      gen: { find: true, shapes: ['ax+b=c', 'ax-b=c'], max: 10, keys: 4 } },
    { id: 'twoNeg', title: 'Two steps with negatives', line: `5x − 4 = ${MINUS}19`, grade: 62, strand: 'eq', count: 5,
      gen: { find: true, shapes: ['ax+b=c', 'ax-b=c'], max: 12, neg: true, keys: 4 } },
    { id: 'both', title: "You've reached algebra! x on both sides", line: 'x + 5 = 2x + 1: the moves and the rules start here (+ and − only)', grade: 80, strand: 'eq', count: 10,
      gen: { rungs: ['B1'] } },
    { id: 'bothMul', title: 'Both sides, with multiplication', line: '5x + 3 = 2x + 15', grade: 84, strand: 'eq', count: 10,
      gen: { rungs: ['R12'] } },
    { id: 'bothDiv', title: 'Both sides, with division', line: 'x/2 + 4 = x − 1', grade: 86, strand: 'eq', count: 10,
      gen: { rungs: ['B3'] } },
    { id: 'opp', title: 'The opposite of x, like terms', line: `5 − x = 12, then 3x + 2 + x = 18, then 4x − 6 = ${MINUS}8x + 18`, grade: 88, strand: 'eq', count: 10,
      gen: { rungs: ['R8', 'R11', 'R13'] } },
    { id: 'paren', title: 'Parentheses', line: '3(x + 2) = 18, then 2(x + 3) = 5x − 9', grade: 90, strand: 'eq', count: 10,
      gen: { rungs: ['R10', 'R14'] } },
    { id: 'ineq', title: 'Inequalities', line: '2x + 3 < 11: which numbers work? Shown on a number line', grade: 74, strand: 'ineq', count: 10,
      gen: { rungs: ['I1'] } },
    { id: 'flip', title: 'The flip', line: `${MINUS}3x ≥ 12: times or divide by a negative turns the sign round`, grade: 80, strand: 'ineq', count: 10,
      gen: { rungs: ['I2'] } },
    { id: 'pow', title: 'Exponents', line: '5² means 5 × 5, then 4³, √49, and 2 + 3² worked in order', grade: 70, strand: 'pow', count: 10,
      gen: { work: ['P1', 'P2', 'P3', 'O4'] } },
    { id: 'vault', title: 'The legendary vault', line: 'Everything, bigger numbers; now and then no solution, or every number', grade: 96, strand: 'eq', count: 10,
      gen: { rungs: ['R13', 'R14', 'R15'], mix: true, size: 3 } },
  ],
  example: (L, rand) => levelExample(L.gen, rand),
};
