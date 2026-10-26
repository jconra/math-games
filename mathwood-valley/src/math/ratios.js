// RATIOS AND RATES at the store counter: the Ratios & rates strand's maker (map `ratio` in src/math/strands.js,
// points 38 55 60 65 72). The kid taps one of 4 answers. src/math/counter.js turns what this makes into an order slip;
// src/ui/counterpics.js draws its pictures (src/ui/storepics.js for the first two).
//
// The steps (STEPS below):
//   1 (38) miles, hours and speed: the store's own rate stories (src/math/wordproblems.js MAKERS.rate), kept in the
//          times tables
//   2 (55) scaling a recipe: the store's recipe stories (2 pies take 3 cups, so 8 pies take 12)
//   3 (60) ratio tables: 2 scoops of oats for every 3 horses; how many for 12 horses? (the table drawn as the helper)
//   4 (65) shares by a ratio: 20 pounds of jerky split 3 to 1
//   5 (72) proportions: 3 of every 4 steers are brown; in a herd of 20? (3/4 = x/20)
// The wrong answers are the slips kids really make with ratios: adding on instead of scaling (2 scoops for 3 horses,
// so 11 scoops for 12: 9 more horses, 9 more scoops), the ratio turned round, the ratio's numbers taken as the shares
// (3 pounds), halves when it's 3 to 1, multiplying the whole by the top number.
//
//   make(t, step, f, { frac }) -> core (see src/math/counter.js); STEPS: [{ label }]
import { u } from './counterkit.js';
import { makeOrder } from './wordproblems.js';

export const STEPS = [
  { label: 'Miles, hours and speed' },
  { label: 'Scaling a recipe' },
  { label: 'Ratio tables (2 scoops for every 3 horses)' },
  { label: 'Shares by a ratio (3 to 1)' },
  { label: 'Proportions (3/4 = x/20)' },
];

// 1 and 2: the store's own rate and recipe stories, taken as they are (their coins and pictures), counted here
function fromStore(t, f, type, step, words) {
  const o = makeOrder(type, { rand: t.rand, step, who: f, coins: 4, longMost: 0 });
  const right = o.coins.find((c) => c.good);
  return {
    key: `ratio:${o.key}`, story: o.story, ask: o.ask,
    right: { v: right.v, big: right.big, small: right.small, label: right.label },
    slips: o.coins.filter((c) => !c.good).map((c) => ({ v: c.v, big: c.big, small: c.small, label: c.label, slip: c.slip, why: c.why })),
    pic: o.pic, rightWhy: o.rightWhy,
    credit: [{ strand: 'words', at: words, weight: 0.5 }, ...o.credit.filter((c) => c.strand !== 'ratio' && !c.long)],
    size: o.size, facts: { from: type },
  };
}

// 3: a ratio table: a scoops for every b horses; how many scoops for b·k horses?
const TABLES = [
  { key: 'oats', top: ['horse', 'horses'], bot: ['scoop of oats', 'scoops of oats'], botShort: ['scoop', 'scoops'], s: (a, b) => `The stable feeds ${a} scoops of oats for every ${b} horses.` },
  { key: 'nails', top: ['horseshoe', 'horseshoes'], bot: ['nail', 'nails'], botShort: ['nail', 'nails'], s: (a, b) => `The blacksmith uses ${a} nails for every ${b} horseshoes.` },
  { key: 'paint', top: ['wall', 'walls'], bot: ['can of paint', 'cans of paint'], botShort: ['can', 'cans'], s: (a, b) => `${b} barn walls take ${a} cans of whitewash.` },
  { key: 'coffee', top: ['cowhand', 'cowhands'], bot: ['pound of coffee', 'pounds of coffee'], botShort: ['pound', 'pounds'], s: (a, b) => `On the drive, Cookie brews ${a} pounds of coffee a week for every ${b} cowhands.` },
];
function table(t, f, frac) {
  for (let tries = 0; tries < 60; tries++) {
    const a = t.int(2, 7), b = t.int(2, 6), k = t.int(3, frac < 0.5 ? 5 : 8);
    if (a === b || a % b === 0 || b % a === 0) continue;   // (not a plain "twice": the table is the point)
    const ctx = t.pick(TABLES), want = b * k, ans = a * k;
    const S = ctx.botShort, C = (n) => ({ v: n, big: String(n), small: n === 1 ? S[0] : S[1], label: u(n, S) });
    return {
      key: `ratio:table:${ctx.key}`, story: ctx.s(a, b), ask: `How many ${S[1]} for ${want} ${ctx.top[1]}?`,
      right: C(ans),
      slips: [
        { ...C(a + (want - b)), slip: 'addedOn', why: `That adds ${want - b}, one for every extra ${ctx.top[0]}. A ratio grows by times: ${want} is ${k} times ${b}, so it's ${k} times ${a}.` },
        { ...C(want * a), slip: 'multipliedAll', why: `${want} × ${a} gives ${a} ${S[1]} for every one ${ctx.top[0]}. It's ${a} for every ${b}.` },
        { ...C((want * b) % a === 0 ? want * b / a : 0), slip: 'flipped', why: `That turns the ratio round. It's ${a} ${S[1]} for every ${b} ${ctx.top[1]}.` },
        { ...C(ans + a), slip: 'groupOff', why: `That's ${k + 1} lots of ${b} ${ctx.top[1]}. ${want} is ${k} lots.` },
      ].filter((s) => s.v > 0 && s.v !== ans && Number.isInteger(s.v)),
      pic: { kind: 'ratiotable', top: ctx.top[1], bot: S[1], a, b, k },
      rightWhy: `${want} ${ctx.top[1]} is ${k} lots of ${b}, so ${k} lots of ${a}: ${u(ans, S)}`,
      credit: [{ strand: 'mul', at: 30, weight: 0.5 }], facts: { a, b, k, ans },
    };
  }
  return null;
}

// 4: shares by a ratio
const NAMES = [['Jed', 'Sam'], ['Rosa', 'Mae'], ['Eli', 'Nell'], ['Tomás', 'Ike'], ['Hattie', 'Clara']];
function shares(t, f, frac) {
  for (let tries = 0; tries < 60; tries++) {
    const [a, b] = t.pick(frac < 0.5 ? [[3, 1], [2, 1], [4, 1]] : [[3, 1], [2, 1], [3, 2], [4, 1], [5, 3], [2, 3], [4, 3]]);
    const parts = a + b, k = t.int(2, 9), total = parts * k, A = a * k, B = b * k;
    const [x, y] = t.pick(NAMES), ask = t.chance(0.5) ? 0 : 1;
    const what = t.pick([['pound of jerky', 'pounds of jerky', 'pound', 'pounds'], ['acre', 'acres', 'acre', 'acres'], ['silver dollar', 'silver dollars', 'dollar', 'dollars']]);
    const who = ask === 0 ? x : y, ans = ask === 0 ? A : B, other = ask === 0 ? B : A;
    const C = (n) => ({ v: n, big: String(n), small: n === 1 ? what[2] : what[3], label: `${n} ${n === 1 ? what[2] : what[3]}` });
    return {
      key: `ratio:share:${a}${b}`, story: `${x} and ${y} split ${total} ${what[1]} in the ratio ${a} to ${b}: ${x} gets ${a} for every ${b} that ${y} gets.`,
      ask: `How many ${what[3]} does ${who} get?`,
      right: C(ans),
      slips: [
        { ...C(total / 2), slip: 'halves', why: `Halves would be ${a === b ? 'right' : `1 to 1. It's ${a} to ${b}`}: cut ${total} into ${parts} equal parts first.` },
        { ...C(other), slip: 'otherShare', why: `${other} is what ${ask === 0 ? y : x} gets.` },
        { ...C(ask === 0 ? a : b), slip: 'ratioNumber', why: `${ask === 0 ? a : b} is ${who}'s part of the ratio, not the ${what[3]}. Each part is ${total} ÷ ${parts} = ${k}.` },
        { ...C(total - (ask === 0 ? a : b)), slip: 'subtracted', why: `That takes ${ask === 0 ? a : b} away. Cut ${total} into ${parts} equal parts: ${who} gets ${ask === 0 ? a : b} of them.` },
      ].filter((s) => s.v > 0 && s.v !== ans && Number.isInteger(s.v)),
      pic: { kind: 'ratiobar', names: [x, y], a, b, total, ask },
      rightWhy: `${a} + ${b} = ${parts} parts; ${total} ÷ ${parts} = ${k} a part; ${who} gets ${ask === 0 ? a : b} × ${k} = ${ans}`,
      credit: [{ strand: 'div', at: 33, weight: 0.5 }], size: 2, facts: { a, b, total, ask, ans },
    };
  }
  return null;
}

// 5: proportions: 3 of every 4 are brown; how many in 20? (3/4 = x/20)
function proportion(t, f, frac) {
  for (let tries = 0; tries < 60; tries++) {
    const d = t.pick([3, 4, 5, 8, 10]), n = t.int(1, d - 1), k = t.int(3, frac < 0.5 ? 6 : 12), D = d * k, ans = n * k;
    if (n === 1 && d === 2) continue;
    const gcd = (x, y) => (y ? gcd(y, x % y) : x);
    if (gcd(n, d) > 1) continue;   // (in lowest terms: "2 of every 4" is said "1 of every 2")
    const ctx = t.pick([
      { key: 'steers', s: `${n} of every ${d} steers in the Bar T herd ${n === 1 ? 'is' : 'are'} brown. The herd has ${D} steers.`, ask: 'How many are brown?', unit: ['steer', 'steers'], what: 'brown' },
      { key: 'eggs', s: `${n} of every ${d} eggs from ${f.name}'s hens ${n === 1 ? 'is' : 'are'} brown. ${f.she ? 'She' : 'He'} brought in ${D} eggs.`, ask: 'How many of them are brown?', unit: ['egg', 'eggs'], what: 'brown' },
      { key: 'apples', s: `In the orchard, ${n} of every ${d} apples ${n === 1 ? 'is' : 'are'} ripe. There are ${D} apples on the trees.`, ask: 'How many are ripe?', unit: ['apple', 'apples'], what: 'ripe' },
    ]);
    const C = (m) => ({ v: m, big: String(m), small: m === 1 ? ctx.unit[0] : ctx.unit[1], label: u(m, ctx.unit) });
    return {
      key: `ratio:prop:${ctx.key}`, story: ctx.s, ask: `${ctx.ask} (${n}/${d} = x/${D})`,
      right: C(ans),
      slips: [
        { ...C(n + (D - d)), slip: 'addedOn', why: `That adds ${D - d} to the top as to the bottom. Fractions grow by times: ${D} is ${k} times ${d}, so the top is ${k} times ${n}.` },
        { ...C(n * D), slip: 'topTimesAll', why: `${n} × ${D} counts ${n} for every one ${ctx.unit[0]}. It's ${n} for every ${d}.` },
        { ...C(k), slip: 'scaleOnly', why: `${k} is how many lots of ${d} there are. Each lot has ${n}.` },
        { ...C(D - ans), slip: 'rest', why: `${D - ans} is the ones that aren't. ${n} of every ${d} are.` },
      ].filter((s) => s.v > 0 && s.v !== ans),
      pic: { kind: 'ratiotable', top: `${ctx.unit[1]} in all`, bot: ctx.what, a: n, b: d, k },
      rightWhy: `${D} is ${k} × ${d}, so x is ${k} × ${n} = ${ans}: ${n}/${d} = ${ans}/${D}`,
      credit: [{ strand: 'frac', at: 40, weight: 0.5 }], facts: { n, d, D, ans },
    };
  }
  return null;
}

export function make(t, step, f, { frac = 0 } = {}) {
  const s = Math.max(1, Math.min(STEPS.length, step));
  if (s === 1) return fromStore(t, f, 'rate', 4, 38);
  if (s === 2) return fromStore(t, f, 'recipe', 7, 55);
  if (s === 3) return table(t, f, frac);
  if (s === 4) return shares(t, f, frac);
  return proportion(t, f, frac);
}
