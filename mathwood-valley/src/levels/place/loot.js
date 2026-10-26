// Loot the gang: SHARING (division), the agreed design, 2026-10-21. The gang's stolen goods go back to the families,
// each bundle a sharing problem on the sheriff's slip: small fair shares first (6 apples, 2 families), then bigger
// ones, remainders, what to do with the leftover, and shares by a rule.
//
// gen (what the loot slips' maker reads: src/math/shares.js shareAt, the ONE maker for the job and these examples):
//   { kind: 'even' | 'rem' | 'leftover' | 'rule' | 'rule3', size (1 small .. 3), coins (on the slip),
//     range?: { g: [lo, hi] families, q: [lo, hi] each },  young?: kid-sized goods and slips,  drawn?: the goods drawn
//     on the slip from the start (the youngest: they share by counting) }
// Every level is one kind of share (no reviews mixed in), so a level's answers all say the same thing.

import { shareAt } from '../../math/shares.js';

const L = (id, title, line, grade, gen, more = {}) => ({ id, title, line, grade, strand: 'div', count: 5, also: [{ strand: 'words', grade: Math.max(grade, 16), weight: 0.5 }], gen, ...more });

export const PLACE = {
  id: 'loot', name: 'Loot the gang', short: 'Loot', math: 'Sharing', pic: 'sack', job: 'loot', fastFrom: null,
  line: 'Give the stolen goods back fairly: every family gets the same.',
  levels: [
    L('two', 'Share between 2', '6 apples, 2 families: how many each? (the apples drawn)', 8, { kind: 'even', range: { g: [2, 2], q: [2, 5] }, young: true, drawn: true, coins: 3 }, { read: true }),
    L('three', 'Share among 2 or 3', '12 eggs, 3 families (drawn)', 12, { kind: 'even', range: { g: [2, 3], q: [2, 5] }, young: true, drawn: true, coins: 3 }, { read: true }),
    L('five', 'Share among up to 5', '20 carrots, 4 families (drawn)', 16, { kind: 'even', range: { g: [3, 5], q: [2, 5] }, young: true, drawn: true, coins: 3 }, { read: true }),
    L('even', 'Fair shares', '30 cans of peaches, five families: nothing left over', 22, { kind: 'even', size: 1, coins: 3 }),
    L('even2', 'Fair shares, bigger numbers', '56 sacks, 7 homesteads', 32, { kind: 'even', size: 2, coins: 4 }),
    L('remSmall', 'One or two left over', '7 apples, 2 families: 3 each and 1 left over (drawn)', 38, { kind: 'rem', range: { g: [2, 3], q: [2, 4] }, young: true, drawn: true, coins: 3 }),
    L('rem', 'Shares and a leftover', '14 blankets, 3 families: 4 each and 2 left over', 45, { kind: 'rem', size: 1, coins: 4 }),
    L('rem2', 'Leftovers, bigger numbers', '49 silver dollars, 6 families', 50, { kind: 'rem', size: 2, coins: 4 }),
    L('left', 'What to do with the leftover', "The orphans' home's part, the mule's trips, the full boxes", 55, { kind: 'leftover', size: 2, coins: 4 }),
    L('rule', 'Shares by a rule', 'Three for the Abernathys for every two for the Turners', 65, { kind: 'rule', size: 2, coins: 4 }, { also: [{ strand: 'words', grade: 48, weight: 0.5 }, { strand: 'ratio', grade: 65, weight: 0.5 }] }),
    L('rule3', 'A rule among three families', '1 : 2 : 3 among the Malones, the Bells and the Lindqvists', 72, { kind: 'rule3', size: 3, coins: 4 }, { also: [{ strand: 'words', grade: 55, weight: 0.5 }, { strand: 'ratio', grade: 65, weight: 0.5 }] }),
  ],
  example: (lv, rand) => lootExample(lv.gen, rand),
};

export function lootExample(g, rand) {
  const p = shareAt(g, { rand });
  return { q: `${p.story} ${p.ask}`, a: p.answer };
}
