// Deliveries: BIG ORDERS (the agreed design, 2026-10-21): a camp foreman's order is worked out at the store a part at a
// time: how much in all, how many crates (rounded up), then what it costs. Small orders for the youngest first; each
// level brings one new thing: two numbers, then three (hands, how much a day, days), a week as 7 days, a fortnight as
// 14 (the first sums worked on paper: Work it out opens by itself), crates rounded up, the cost, then big orders.
//
// gen (what the delivery job reads): { small: true } | { step } (a row of src/math/supplies.js LADDER, made by
// makeSupplyOrder: the same maker the job's slip uses)
// The whole order is one answer here (right when every part was right first time); each part also counts in its own
// strand without moving the level (the time word in Time, the total in Multiplication or Long work, the crates in
// Division or Long work, the cost in Money), as before.
// The example shows the order and its parts' answers.

import { makeSupplyOrder } from '../../math/supplies.js';

const D = (id, title, line, grade, step) => ({ id, title, line, grade, strand: 'words', count: 5, also: [{ strand: 'mul', grade: Math.min(50, grade), weight: 0.5 }], gen: { step } });

export const PLACE = {
  id: 'deliveries', name: 'Deliveries', short: 'Deliveries', math: 'Big orders', pic: 'crate', job: 'deliveries', fastFrom: null,
  line: 'Work out a camp’s order: how much in all, how many crates, what it costs.',
  levels: [
    { id: 'small', title: 'A small order', line: '2 hands, 3 days, a loaf each a day: how many loaves? How many baskets?', grade: 18, strand: 'words', count: 5, read: true, gen: { small: true } },
    D('inAll', 'Hands times days', '6 hands, a can each a day, 4 days; the crates come out even', 30, 1),
    D('three', 'Three numbers', '4 hands, 2 loaves a day, 6 days', 38, 2),
    D('week', 'A week', 'How many days is a week? Then 3 hands, 2 cups a day, for the week', 42, 3),
    D('fortnight', 'A fortnight, worked on paper', 'How many days is a fortnight? 6 × 14 in columns', 44, 4),
    D('roundUp', 'Round up to whole crates', '192 pounds of oats in sacks of 50: 4 sacks', 50, 5),
    D('cost', 'What it costs', 'The crates, then the price', 56, 6),
    D('big', 'Big orders', 'By the dozen, the sack and the tin, up to about 560', 64, 7),
  ],
  example: (L, rand) => deliveriesExample(L.gen, rand),
};

// the order a foreman asks for at a level (the job passes the camp, the foreman's name, the words still new and longMost)
export function deliveriesOrder(g, o = {}) {
  return makeSupplyOrder(g.small ? { ...o, step: 1, small: true } : { ...o, step: g.step });
}
export function deliveriesExample(g, rand) {
  const o = deliveriesOrder(g, { rand, vocab: { week: true, fortnight: true } });
  const parts = o.parts.map((p) => `${p.ask} ${p.coins.find((c) => c.good)?.label ?? ''}`);
  return { q: o.story, a: parts.join(' · ') };
}
