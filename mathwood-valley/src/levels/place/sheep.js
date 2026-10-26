// Sick sheep: ADDING AND TAKING AWAY, FIND THE MISTAKE (the agreed design, 2026-10-21: "3 + 1 = 5? -> within 20 ->
// two-digit -> three-digit (fills the 30-60 gap) -> negatives"). Each sheep in the flock wears a sum; the sick ones
// wear a wrong one (a slip kids really make), and the kid finds a sick sheep and gives the bottle with the right answer
// ("3 + 1 = 5? should be 4"). One flock is one level; each sick sheep's first bottle is one answer.
//
// The steps, easiest first: adding and taking away 1 or 2, within 10, making 10 and from 10, doubles, past 10, tens and
// ones, carrying a ten, two-digit sums; then column sums with three and four digits (no carrying first, then carrying
// and borrowing), adding prices and making change; then positive and negative sums (src/math/negatives.js's ladder).
//
// gen (what the flock's maker reads: src/missions/sheepmath.js itemAt / flockAt, the ONE maker for the job and these
// examples):
//   { maker: 'adding' | 'taking', step }        src/math/adding.js / taking.js sheep at their ladder's step (1-8)
//   { maker: 'columns', op, digits, regroup }   column sums: '+' or '-', 2 to 4 digits, with or without carrying
//   { maker: 'money', op }                      adding prices ('+'), the change from a bill ('-')
//   { maker: 'neg', step }                      positive & negative sums at negatives.js's step (1-7)

import { itemAt } from '../../missions/sheepmath.js';
import { MINUS } from '../kit.js';

const L = (id, title, line, grade, strand, gen, more = {}) => ({ id, title, line, grade, strand, count: 5, gen, ...more });
const NEG = (id, title, line, grade, strand, step, more = {}) => L(id, title, line, grade, strand, { maker: 'neg', step }, more);

export const PLACE = {
  id: 'sheep', name: 'Sick sheep', short: 'Sheep', math: 'Adding & taking away', pic: 'sheep', job: 'sheep', fastFrom: null,
  line: 'Find the sheep wearing a wrong sum and give it the bottle with the right answer.',
  levels: [
    L('add2', 'Adding 1 or 2', '3 + 1 = 5? (within 10)', 0, 'add', { maker: 'adding', step: 1 }, { read: true }),
    L('sub2', 'Taking away 1 or 2', `6 ${MINUS} 1 = 4?`, 2, 'sub', { maker: 'taking', step: 1 }, { read: true }),
    L('add10', 'Adding within 10', '4 + 5 = 8?', 5, 'add', { maker: 'adding', step: 2 }, { read: true }),
    L('sub10', 'Taking away within 10', `9 ${MINUS} 4 = 6?`, 6, 'sub', { maker: 'taking', step: 2 }, { read: true }),
    L('make10', 'Making 10', '7 + 3 = 10, and 6 + ? = 10', 9, 'add', { maker: 'adding', step: 3 }, { read: true }),
    L('from10', 'Taking from 10', `10 ${MINUS} 4 = 6, and how many are left`, 10, 'sub', { maker: 'taking', step: 3 }, { read: true }),
    L('doubles', 'Doubles and near doubles', '6 + 6, 6 + 7', 12, 'add', { maker: 'adding', step: 4 }),
    L('add20', 'Adding past 10', '8 + 5 = 12?', 15, 'add', { maker: 'adding', step: 5 }),
    L('subTeen', 'Taking away from the teens', `17 ${MINUS} 4 = 12?`, 15, 'sub', { maker: 'taking', step: 5 }),
    L('sub20', 'Taking away past 10', `13 ${MINUS} 5 = 9?`, 19, 'sub', { maker: 'taking', step: 6 }),
    L('addTens', 'Tens and ones', '23 + 5, 34 + 20', 19, 'add', { maker: 'adding', step: 6 }),
    L('subTens', 'Taking away tens and ones', `34 ${MINUS} 6, 46 ${MINUS} 20`, 24, 'sub', { maker: 'taking', step: 7 }),
    L('carry', 'Carrying a ten', '27 + 6 = 23?', 24, 'add', { maker: 'adding', step: 7 }),
    L('add2d', 'Two-digit adding', '36 + 27 = 53? (the carry forgotten)', 26, 'add', { maker: 'adding', step: 8 }),
    L('sub2d', 'Two-digit taking away', `52 ${MINUS} 27 = 35? (borrowing)`, 28, 'sub', { maker: 'taking', step: 8 }),
    L('add3', 'Three-digit adding', '342 + 125 = 467, in columns', 32, 'add', { maker: 'columns', op: '+', digits: 3, regroup: false }),
    L('sub3', 'Three-digit taking away', `768 ${MINUS} 325 = 443, in columns`, 34, 'sub', { maker: 'columns', op: '-', digits: 3, regroup: false }),
    L('add3c', 'Three-digit adding, carrying', '348 + 275 = 513? (a carry forgotten)', 36, 'add', { maker: 'columns', op: '+', digits: 3, regroup: true }),
    L('sub3b', 'Three-digit taking away, borrowing', `503 ${MINUS} 168 = 465? (the smaller from the bigger)`, 40, 'sub', { maker: 'columns', op: '-', digits: 3, regroup: true }),
    L('money', 'Adding prices', '$2.50 + $3.75 = $5.25? (the dollar in the cents forgotten)', 42, 'add', { maker: 'money', op: '+' }, { also: [{ strand: 'money', grade: 42, weight: 0.5 }] }),
    L('change', 'Making change', `$10.00 ${MINUS} $7.55 = $3.45? (the dollar broken)`, 46, 'sub', { maker: 'money', op: '-' }, { also: [{ strand: 'money', grade: 46, weight: 0.5 }] }),
    L('add4', 'Four-digit adding', '4,586 + 2,739, carrying', 48, 'add', { maker: 'columns', op: '+', digits: 4, regroup: true }),
    L('sub4', 'Four-digit taking away', `7,638 ${MINUS} 4,713, borrowing`, 52, 'sub', { maker: 'columns', op: '-', digits: 4, regroup: true }),
    NEG('negUp', 'A negative plus a positive', `${MINUS}3 + 7 = 4? (landing above zero)`, 60, 'add', 1),
    NEG('negBelow', 'Landing below zero', `${MINUS}7 + 3 = ${MINUS}4?`, 64, 'add', 2),
    NEG('negDown', 'A negative going further down', `${MINUS}4 ${MINUS} 5 = ${MINUS}9?`, 68, 'sub', 3),
    NEG('negSub', 'Taking away past zero', `3 ${MINUS} 8 = ${MINUS}5?`, 72, 'sub', 4),
    NEG('negMix', 'Taking away a negative', `5 ${MINUS} (${MINUS}3), 4 + (${MINUS}9)`, 76, 'add', 5, { also: [{ strand: 'sub', grade: 76, weight: 0.5 }] }),
    NEG('neg20', 'All of them, up to 20', `${MINUS}10 + 18, ${MINUS}10 ${MINUS} 18`, 82, 'add', 6, { also: [{ strand: 'sub', grade: 82, weight: 0.5 }] }),
    NEG('neg50', 'All of them, up to 50', `${MINUS}38 ${MINUS} 26`, 90, 'add', 7, { also: [{ strand: 'sub', grade: 90, weight: 0.5 }] }),
  ],
  example: (lv, rand) => sheepExample(lv.gen, rand),
};

// one sick sheep: her sum as written, and the bottle that cures her
export function sheepExample(g, rand) {
  const it = itemAt(g, true, rand, new Set());
  const cure = it.bottles.find((b) => b.right);
  return { q: `${it.top ? `${it.top}: ` : ''}${it.shown}`, a: cure ? cure.label : '' };
}
