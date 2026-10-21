// The store counter: THE MIXED PLACE (the agreed design, 2026-10-21): money, word problems, the time on the store's
// grandfather clock, decimals, ratios and percent. Its ladder is ONE ladder like every place's, but each level deals a
// mix of those kinds at about the same school year, and EVERY KIND MOVES AT MOST ONE OF ITS OWN STEPS FROM ONE LEVEL TO
// THE NEXT (no level brings more than two new things, and the newest comes up most). Easy to hard: picture stories,
// the clock's hour (the clock starts at the hour, then half past ...), counting coins, prices, change from a dollar,
// equal groups and sharing, how many more, speed, dollars and cents, tenths, two steps, change from $20, recipes,
// timetables, percent of, multiplying decimals, ratio tables, tax, tips, proportions, stories told backwards, interest.
// Big orders (sums for paper) are the deliveries' (src/levels/place/deliveries.js); the store keeps its sums in the
// head, except the odd one past the times tables, which Work it out (src/ui/tools.js) is there for.
//
// gen (what the counter reads): { mix: [Ask, ...] }, one Ask picked for each customer (by its weight w, default 1):
//   Ask = { maker: 'wordsK', step }             src/math/wordproblems.js K_LADDER (the picture stories), its mix
//       | { maker: 'words', step, types }       src/math/wordproblems.js LADDER, only these kinds (types) at that step
//       | { maker: 'money' | 'time' | 'dec' | 'pct' | 'ratio', step }   src/math/counter.js counterOrder(maker, { step })
// A customer's answer moves the store's level once (place 'store', this level's id) and is recorded in its own kind's
// strand at that maker step's own point on the school guide (storeOrder's `own`), so the stats' Money, Telling time,
// Decimals, Percent, Ratios and Word problems keep counting honestly.
//
//   storeOrder(ask, { rand, who, trainer, longMost, frac }) -> an order for the slip (wordproblems.js makeOrder's shape, or
//                     counter.js counterOrder's), with order.own = { strand, at } and order.ask_ = the Ask it came from
//   pickAsk(mix, rand, last) -> one Ask, by weight, not the same as `last` when there is another
//   storeExample(gen, rand) -> { q, a }   (the levels page and the print rig: the same makers the counter uses)

import { makeOrder, LADDER as WORDS, K_LADDER as WORDS_K } from '../../math/wordproblems.js';
import { counterOrder } from '../../math/counter.js';
import { pctAt } from '../../math/skill.js';

const K = (step, w = 1) => ({ maker: 'wordsK', step, w });
const W = (step, types, w = 1) => ({ maker: 'words', step, types, w });
const M = (maker, step, w = 1) => ({ maker, step, w });

export const PLACE = {
  id: 'store', name: 'The store counter', short: 'Store', math: 'Money, time & word problems', pic: 'store', job: 'store', fastFrom: 'cents',
  line: 'Townsfolk bring orders: coins and change, the clock, stories, decimals, ratios and percent.',
  levels: [
    { id: 'kAll', title: 'Picture stories: how many in all', line: '2 apples and 1 more, up to 5 (drawn and read out)', grade: 0, strand: 'words', count: 5, read: true,
      gen: { mix: [K(1)] } },
    { id: 'kLeft', title: 'Picture stories: in all and left', line: 'Up to 10: 7 eggs, 3 sold', grade: 6, strand: 'words', count: 5, read: true,
      gen: { mix: [K(2)] } },
    { id: 'hour', title: "The clock's hour", line: "The grandfather clock at 3 o'clock; picture stories to 10", grade: 10, strand: 'time', count: 5, read: true,
      gen: { mix: [M('time', 1, 2), K(2)] } },
    { id: 'coins', title: 'Counting coins', line: '2 dimes, a nickel and 3 pennies; stories past 10', grade: 10, strand: 'money', count: 5, read: true,
      gen: { mix: [M('money', 1, 2), K(3, 1.5), M('time', 1)] } },
    { id: 'halfPast', title: 'Half past, baskets of eggs', line: 'Half past 4; 3 baskets of 2 eggs', grade: 15, strand: 'time', count: 5, read: true,
      gen: { mix: [M('time', 2, 2), K(4, 1.5), M('money', 1)] } },
    { id: 'prices', title: 'Prices to a dollar, quarter past', line: '35¢ + 28¢; quarter past 4', grade: 20, strand: 'money', count: 5,
      gen: { mix: [M('money', 2, 2), M('time', 3, 1.5), K(4)] } },
    { id: 'stories', title: 'Story slips: groups and totals', line: '4 pies, 3 pounds of berries each; 15 and 18 together', grade: 20, strand: 'words', count: 5,
      gen: { mix: [W(1, ['groups', 'parts'], 2), M('money', 2), M('time', 3)] } },
    { id: 'fives', title: 'Five minutes at a time, sharing out', line: '10:25; 24 nails into 4 kegs', grade: 24, strand: 'time', count: 5,
      gen: { mix: [M('time', 4, 2), W(2, ['share'], 1.5), M('money', 2)] } },
    { id: 'change', title: 'Change from a dollar, to the minute', line: 'A 35¢ bar of soap paid with a silver dollar; 7:43', grade: 30, strand: 'money', count: 5,
      gen: { mix: [M('money', 3, 2), M('time', 5, 1.5), W(2, ['share', 'groups', 'parts'])] } },
    { id: 'more', title: 'How many more, hours between', line: '21 pies against 18; 9 in the morning to 2 in the afternoon', grade: 30, strand: 'words', count: 5,
      gen: { mix: [W(3, ['compare'], 2), M('time', 6, 1.5), M('money', 3)] } },
    { id: 'speed', title: 'Miles, hours and speed', line: 'A wagon at 3 miles an hour for 5 hours; 24 miles in 8 hours', grade: 38, strand: 'words', count: 5,
      gen: { mix: [W(4, ['rate'], 2), W(3, ['compare', 'groups', 'share']), M('time', 6)] } },
    { id: 'cents', title: 'Dollars and cents, am and pm', line: '$3.45 + $2.80; to bed at 9:30 pm, up at 5:30 am', grade: 40, strand: 'money', count: 5,
      gen: { mix: [M('money', 4, 2), M('time', 7, 1.5), W(4, ['rate'])] } },
    { id: 'tenths', title: 'Tenths, change in dollars', line: '0.3 is three tenths; a $14 bar of soap paid with $20', grade: 40, strand: 'dec', count: 5,
      gen: { mix: [M('dec', 1, 2), W(5, ['money'], 1.5), M('money', 4), M('time', 7)] } },
    { id: 'hundredths', title: 'Hundredths', line: '45¢ is 0.45 of a dollar; which is bigger, 0.5 or 0.45?', grade: 45, strand: 'dec', count: 5,
      gen: { mix: [M('dec', 2, 2), W(5, ['money', 'rate']), M('money', 4)] } },
    { id: 'twoStep', title: 'Two steps, hours and minutes', line: 'Bake 4 pies, already have 5 pounds; in the oven for 1 hour 35 minutes', grade: 48, strand: 'words', count: 5,
      gen: { mix: [W(6, ['twostep'], 2), M('time', 8, 1.5), M('dec', 2)] } },
    { id: 'twenty', title: 'Change from $20, adding decimals', line: '3 wicks at $2.75 from a $20 note; 2.5 + 1.75', grade: 50, strand: 'money', count: 5,
      gen: { mix: [M('money', 5, 2), M('dec', 3, 1.5), M('time', 8), W(6, ['twostep'])] } },
    { id: 'recipe', title: 'Recipes, times and divided by 10', line: 'A recipe for 2 pies made for 8; 10 candles for $4.50', grade: 55, strand: 'words', count: 5,
      gen: { mix: [W(7, ['recipe', 'share'], 2), M('dec', 4, 1.5), M('money', 5)] } },
    { id: 'timetable', title: 'Timetables, across days', line: 'Leaves Tuesday 7 am, 18 hours on the road', grade: 56, strand: 'time', count: 5,
      gen: { mix: [M('time', 9, 2), W(7, ['recipe', 'share']), M('dec', 4)] } },
    { id: 'percentOf', title: 'Percent of, the price of one', line: '10% of 80 steers; 12 candles for $3.00', grade: 58, strand: 'pct', count: 5,
      gen: { mix: [M('pct', 1, 2), M('money', 6, 1.5), M('time', 9)] } },
    { id: 'multiply', title: 'Multiplying decimals, ratio tables', line: '6 pounds at $0.40; 2 scoops for every 3 horses', grade: 60, strand: 'dec', count: 5,
      gen: { mix: [M('dec', 5, 2), M('ratio', 3, 1.5), M('pct', 1), M('money', 6)] } },
    { id: 'anyPct', title: 'Any percent of', line: '30% of 60 pounds', grade: 62, strand: 'pct', count: 5,
      gen: { mix: [M('pct', 2, 2), M('dec', 5), M('ratio', 3)] } },
    { id: 'shares', title: 'Shares by a ratio, dividing decimals', line: '20 pounds of jerky split 3 to 1; $2.40 shared by 4', grade: 65, strand: 'ratio', count: 5,
      gen: { mix: [M('ratio', 4, 2), M('dec', 6, 1.5), M('pct', 2)] } },
    { id: 'tax', title: 'Tax and discounts', line: 'A $60 coat at 20% off; $50 and 8% tax', grade: 66, strand: 'pct', count: 5,
      gen: { mix: [M('pct', 3, 2), W(8, ['percent'], 1.5), M('dec', 6)] } },
    { id: 'tips', title: 'Tax and tips on money', line: 'A 15% tip on $12.00', grade: 70, strand: 'money', count: 5,
      gen: { mix: [M('money', 7, 2), M('pct', 3), M('ratio', 4)] } },
    { id: 'proportion', title: 'Proportions, percent up or down', line: '3 of every 4 steers are brown, in a herd of 20 (3/4 = x/20); flour from $4 to $5', grade: 72, strand: 'ratio', count: 5,
      gen: { mix: [M('ratio', 5, 2), M('pct', 4, 1.5), M('money', 7)] } },
    { id: 'backwards', title: 'Stories told backwards', line: 'Pick the equation that tells the story (3x + 5 = 29), then solve it', grade: 75, strand: 'words', count: 5,
      gen: { mix: [W(9, ['equation'], 2), M('pct', 4), M('ratio', 5)] } },
    { id: 'interest', title: 'Simple interest', line: '$200 in the bank at 5% a year for 3 years', grade: 76, strand: 'pct', count: 5,
      gen: { mix: [M('pct', 5, 2), W(9, ['equation']), M('pct', 4)] } },
  ],
  example: (L, rand) => storeExample(L.gen, rand),
};

// the school-guide point of an Ask's own step (what the customer's answer counts at in its own strand)
export function askAt(ask) {
  const map = ask.maker === 'words' ? 'store' : ask.maker === 'wordsK' ? 'storeK' : ask.maker;
  return pctAt(map, ask.step);
}
const ASK_STRAND = { words: 'words', wordsK: 'words', money: 'money', time: 'time', dec: 'dec', pct: 'pct', ratio: 'ratio' };
const sameAsk = (a, b) => !!(a && b && a.maker === b.maker && a.step === b.step);

// one Ask from a level's mix, by weight; not the one asked last when there's another
export function pickAsk(mix, rand = Math.random, last = null) {
  const list = mix.length > 1 && last ? mix.filter((a) => !sameAsk(a, last)) : mix;
  const use = list.length ? list : mix;
  const sum = use.reduce((s, a) => s + (a.w ?? 1), 0);
  let r = rand() * sum;
  for (const a of use) { if ((r -= a.w ?? 1) <= 0) return a; }
  return use[use.length - 1];
}

// a kind of word problem for an Ask made without the counter's trainer (the examples): by the step's own weights
function typeFor(ask, rand) {
  const row = (ask.maker === 'words' ? WORDS : WORDS_K)[ask.step - 1];
  const kinds = ask.types && ask.types.length ? ask.types : Object.keys(row.mix);
  const w = kinds.map((k) => row.mix[k] ?? 1), sum = w.reduce((a, b) => a + b, 0);
  let r = rand() * sum;
  for (let i = 0; i < kinds.length; i++) { if ((r -= w[i]) <= 0) return kinds[i]; }
  return kinds[kinds.length - 1];
}

// the order a customer brings for an Ask. trainer: the store's word-problem trainer (makeWordProblems: it keeps the
// stories from repeating and brings a missed kind back), or null; longMost: the hardest long sum (a Long work point)
// a word problem may need
// frac: how far into the level the rider is (0..1): the counter's makers grow their numbers through a step with it
export function storeOrder(ask, { rand = Math.random, who = null, trainer = null, longMost = null, frac = 0 } = {}) {
  let o;
  if (ask.maker === 'words' || ask.maker === 'wordsK') {
    const ladder = ask.maker === 'words' ? 'main' : 'K';
    o = trainer ? trainer.next({ who, step: ask.step, ladder, types: ask.types || null, longMost })
      : makeOrder(typeFor(ask, rand), { rand, step: ask.step, who, ladder, longMost });
  } else {
    o = counterOrder(ask.maker, { step: ask.step, frac, rand, who });
  }
  o.own = { strand: ASK_STRAND[ask.maker], at: askAt(ask) };
  o.ask_ = { maker: ask.maker, step: ask.step };
  return o;
}

export function storeExample(g, rand) {
  const o = storeOrder(pickAsk(g.mix, rand), { rand, longMost: 0 });
  return { q: `${o.story} ${o.ask}`, a: o.answer };
}
