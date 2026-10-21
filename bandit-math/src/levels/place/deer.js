// Deer photographs: MISSING NUMBERS AND LEFTOVERS (the agreed design, 2026-10-21). One question with a blank is shown,
// every deer in the herd wears a number tag, and the kid photographs the deer whose number fills the blank: one more
// and one less, "3 + ? = 5", "10 more, 10 less", then "? × 4 = 28", the leftover of a sharing, and last a simple x
// ("x + 7 = 12", "3x = 21", "2x + 1 = 9"). A travel job: no timing, so fast answers never count double here.
//
// gen (what the deer's maker reads: src/math/deermath.js deerShot, the ONE maker; example() calls it too):
//   { kind: 'more', by: 1 | 10, top }        "1 more than 6 is ?", "10 less than 47 is ?"
//   { kind: 'add', top, from } { kind: 'sub', top, from }   "3 + ? = 5", "13 − ? = 6" (sums growing from `from` to `top`)
//   { kind: 'mul', upTo } { kind: 'div', upTo }  "? × 4 = 28", "? ÷ 3 = 6" (the facts picked for the rider: facts.js)
//   { kind: 'left', by: [lo, hi] }            "17 ÷ 5 = 3, ? left over"
//   { kind: 'x', shapes: [...] }              x + a = b, x − a = b, ax = b, ax + b = c
//   words: the question in words too (for the youngest); a level with read: true is read out loud from the clips.

import { TIMES, DIVIDE } from '../kit.js';
import { deerExample } from '../../math/deermath.js';

export const PLACE = {
  id: 'deer', name: 'Deer photographs', short: 'Deer', math: 'Missing numbers', pic: 'deer', job: 'hunt', fastFrom: null,
  line: 'Photograph the deer whose number tag fills the blank.',
  levels: [
    { id: 'more1', title: 'One more, one less', line: '1 more than 6 is ? (up to 10)', grade: 4, strand: 'number', count: 5, read: true, gen: { kind: 'more', by: 1, top: 10, words: true } },
    { id: 'add10', title: '3 + ? = 5', line: 'The missing number in a sum up to 10', grade: 9, strand: 'add', count: 5, read: true, gen: { kind: 'add', top: 10, words: true } },
    { id: 'add20', title: '8 + ? = 15', line: 'The missing number in a sum past 10, up to 20', grade: 15, strand: 'add', count: 5, read: true, gen: { kind: 'add', top: 20, from: 10, words: true } },
    { id: 'sub20', title: '13 − ? = 6', line: 'The missing number in a take-away up to 20', grade: 19, strand: 'sub', count: 5, read: true, gen: { kind: 'sub', top: 20, from: 10, words: true } },
    { id: 'ten', title: '10 more, 10 less', line: '10 more than 47 is ?', grade: 24, strand: 'number', count: 5, read: true, gen: { kind: 'more', by: 10, top: 99, from: 30, words: true } },
    { id: 'mul', title: `? ${TIMES} 4 = 28`, line: 'The missing number in a times fact', grade: 40, strand: 'mul', count: 5, gen: { kind: 'mul', upTo: 10, facts: true } },
    { id: 'div', title: `? ${DIVIDE} 3 = 6`, line: 'The missing number in a sharing', grade: 41, strand: 'div', count: 5, gen: { kind: 'div', upTo: 10, facts: true } },
    { id: 'left', title: 'Leftovers', line: `17 ${DIVIDE} 5 = 3, ? left over`, grade: 45, strand: 'div', count: 5, gen: { kind: 'left', by: [2, 9] } },
    { id: 'xAdd', title: 'x + 7 = 12', line: 'A simple x: adding or taking away', grade: 20, strand: 'eq', count: 5, gen: { kind: 'x', shapes: ['x+a=b', 'x-a=b'] } },
    { id: 'xMul', title: '3x = 21', line: 'A simple x: times', grade: 32, strand: 'eq', count: 5, gen: { kind: 'x', shapes: ['ax=b'], facts: true } },
    { id: 'xTwo', title: '2x + 1 = 9', line: 'Two steps', grade: 56, strand: 'eq', count: 5, gen: { kind: 'x', shapes: ['ax+b=c'] } },
  ],
  example: (L, rand) => deerExample({ ...L.gen, read: !!L.read }, rand),
};
