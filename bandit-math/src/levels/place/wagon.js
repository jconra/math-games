// Protect the wagon (and the hold-ups on the road): ODDS AND EVENS, then THE TIMES TABLES, then MISSING FACTORS (the
// agreed design, 2026-10-21). A gang rides alongside the wagon and every bandit wears a number that fits the card
// ("Rope the evens", "The 7-Gang"); the townsfolk riding with them wear numbers that don't. Then the missing-number
// cards ("7 × ? = 56": one rider wears the answer). Each gang level brings one new table in the difficulty order
// (src/math/series.js TABLE_ORDER, the same as the round-up's series); once a level is placed, every third gang is an
// earlier table (picked by src/math/facts.js pickTable: the weak ones more), recorded at that table's own level.
// The evens up to 100 lead straight into the 2-Gang (the evens up to 24): no big jump between the two halves.
// A gang level counts 8 ropes: two gangs of its own (a gang has 4 bandits), with an earlier table's gang between.
//
// gen (what the wagon's makers read):
//   { kind: 'parity', want: 'even' | 'odd' | 'either', top }   rope the evens (or odds) among numbers up to top
//                                                               (src/math/parity.js)
//   { kind: 'gang', table, open: [tables met so far] }          the table-Gang: its multiples up to x12 (the times
//                                                               trainer, src/math/times.js; table null: any open one)
//   { kind: 'missing', upTo: 10 | 12 }                          "7 × ? = 56": the fact from pickFact (red ones first)

import { TIMES } from '../kit.js';
import { TABLE_ORDER } from '../../math/series.js';
import { parityExample } from '../../math/parity.js';
import { makeTimes } from '../../math/times.js';

const GRADE = { 2: 20, 10: 21, 5: 22, 3: 24, 4: 26, 9: 32, 6: 35, 8: 37, 7: 41, 11: 43, 12: 45 };
const gang = (t) => ({
  id: `g${t}`, title: `The ${t}-Gang`, line: `Rope the bandits wearing the ${t}s (up to ${t} ${TIMES} 12); the townsfolk wear other numbers`,
  grade: GRADE[t], strand: 'mul', count: 8, gen: { kind: 'gang', table: t, open: TABLE_ORDER.slice(0, TABLE_ORDER.indexOf(t) + 1) },
});

export const PLACE = {
  id: 'wagon', name: 'Protect the wagon', short: 'Wagon', math: 'Odds & evens, times tables', pic: 'wagon', job: 'wagon', fastFrom: null,
  line: 'A gang rides at the wagon: rope the riders whose numbers fit the card.',
  levels: [
    { id: 'even10', title: 'Rope the evens', line: 'The gang wears the even numbers up to 10 (2, 4, 6, 8, 10)', grade: 8, strand: 'number', count: 8, read: true,
      gen: { kind: 'parity', want: 'even', top: 10 } },
    { id: 'odd10', title: 'Rope the odds', line: 'The gang wears the odd numbers up to 10 (1, 3, 5, 7, 9)', grade: 9, strand: 'number', count: 8, read: true,
      gen: { kind: 'parity', want: 'odd', top: 10 } },
    { id: 'eo20', title: 'Evens or odds up to 20', line: 'Either card, numbers up to 20', grade: 12, strand: 'number', count: 8, read: true,
      gen: { kind: 'parity', want: 'either', top: 20 } },
    { id: 'eo100', title: 'Evens or odds up to 100', line: 'Look at the last digit: 47 is odd, 86 is even', grade: 18, strand: 'number', count: 8,
      gen: { kind: 'parity', want: 'either', top: 100 } },
    ...TABLE_ORDER.map(gang),
    { id: 'gmix', title: 'Any gang', line: 'Every table up to 12, the ones you miss more often', grade: 50, strand: 'mul', count: 8,
      gen: { kind: 'gang', table: null, open: TABLE_ORDER } },
    { id: 'miss10', title: `7 ${TIMES} ? = 56`, line: 'One rider wears the missing number, tables up to 10', grade: 52, strand: 'mul', count: 5,
      gen: { kind: 'missing', upTo: 10 } },
    { id: 'miss12', title: `? ${TIMES} 12 = 96`, line: 'The missing number on either side, tables up to 12', grade: 54, strand: 'mul', count: 5,
      gen: { kind: 'missing', upTo: 12 } },
  ],
  example: (L, rand) => wagonExample(L.gen, rand),
};

// The example for the levels page, from the job's own makers (the job picks tables and facts by the rider's weak ones;
// here at random). A missing-number gang shows its card and the riders' numbers.
export function wagonExample(g, rand) {
  if (g.kind === 'parity') return parityExample(g, rand);
  const T = makeTimes({}, { rand, now: () => 0 });
  if (g.kind === 'gang') {
    const t = g.table || g.open[Math.floor(rand() * g.open.length)];
    const w = T.wave({ count: 8, table: t, reach: 12 });
    return { q: `The ${t}-Gang: ${w.targets.map((x) => x.n).join(' · ')}`, a: w.targets.filter((x) => x.good).map((x) => x.n).sort((a, b) => a - b).join(', ') };
  }
  if (g.kind === 'missing') {
    const t = TABLE_ORDER[Math.floor(rand() * TABLE_ORDER.length)], a = 2 + Math.floor(rand() * (g.upTo - 1));
    const w = T.wave({ count: 6, fact: { t: Math.min(t, g.upTo), a, upTo: g.upTo } });
    return { q: `${w.rule}  (riders: ${w.targets.map((x) => x.n).join(' · ')})`, a: String(w.targets.find((x) => x.good).n) };
  }
  throw new Error('wagon: no maker for ' + g.kind);
}
