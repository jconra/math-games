// Word problems for the general store counter: townsfolk bring an order slip with a little story on it, and the kid
// picks the coin with the right answer. The arithmetic is kept easy on purpose (small, friendly numbers): the skill
// being practised is READING the story and seeing what kind of problem it is.
//
// The kinds of problem (TYPES below), each with its own picture for a wrong pick:
//   groups    equal groups: 4 pies, 3 pounds of berries each -> 12 pounds          (picture: groups of dots)
//   share     sharing out: 24 nails into 4 kegs -> 6 nails a keg; later "whole crates": 50 cans, crates of 12 -> 5
//             crates (the leftover cans need a crate too)                          (picture: a sharing split)
//   parts     a total and its parts: had 30 sacks, sold 12 -> 18 left; or 15 and 18 together -> 33   (picture: a bar)
//   compare   how many more: 23 pounds against 9 pounds -> 14 more                (picture: two bars side by side)
//   rate      distance = speed x time: 45 miles in 9 hours -> 5 miles an hour     (picture: a road with mile markers)
//   money     change from a payment: costs 13 cents, pays 25 -> 12 cents change   (picture: a bar, paid = cost + change)
//   twostep   two steps: 4 pies x 3 pounds, already has 5 pounds -> 7 more to buy  (picture: the groups, then the bar)
//   recipe    scaling a recipe: 2 pies take 3 cups, so 8 pies take 12 cups         (picture: a ratio table)
//   percent   discounts and tax: a $40 blanket at 10% off -> $36                   (picture: a bar in ten parts)
//   equation  a story told backwards that builds an equation: 3 sacks and a 5-cent tin came to 29 cents -> 3x + 5 = 29;
//             the kid picks the equation, and the lock-box panel solves it        (picture: x boxes and a number bar)
//
// Every answer coin carries its units ("12 pounds", "$36", "5 miles an hour"). The wrong coins are the slips kids
// really make, each with a one-line reason: added instead of multiplied (4 + 3 = 7), multiplied instead of divided
// (45 x 9 = 405), took the bigger number for "how many more", dropped the leftover when packing whole crates, stopped
// after the first of two steps, added on to a recipe instead of scaling it, gave the discount instead of the new price.
// No keyword tricks: "each", "left", "in all" and "more" turn up in stories of different kinds, so a kid can't pick the
// operation from one word; they have to picture what is happening.
//
// The ladder (LADDER below): steps of problem MIXES, from one-step groups and totals up to stories told backwards. It
// moves one order at a time, on the first pick of each order:
//   - 3 orders right first time in a row move up a step; a wrong first pick moves down a step. (A 3-up, 1-down ladder
//     settles where about 4 in 5 first picks are right: 0.794 cubed is a half.)
//   - On a kid's first visit the step climbs after every order right first time; the second miss ends the climb (one
//     slip is forgiven) and the kid settles PLACE_BELOW steps below the step of that miss.
//   - A right pick after the kid opened the picture to help (before picking) is paid the same but doesn't count toward
//     the climb, and isn't a miss either: peeking never costs anything.
//   - A kind of problem that was missed comes back 2 to 4 orders later, with new numbers.
//   - Never the same story twice in a row, and the same kind at most twice in a row (unless it is due back).
//
// Everything it remembers lives in the plain object it is given (rider.topics.store), so it saves as JSON with the
// rider. Nothing is kept anywhere else.
//
//   const Q = makeWordProblems(rider.topics.store ||= {}, { rand })
//   Q.next({ who })         -> an order (see makeOrder for its shape); who: a FOLK entry bringing it (optional)
//   Q.answer(order, coin, { helped })   coin = the coin picked (or its index) -> { right, first, moved, step, placed }
//   Q.level()               -> { step, of, label, placing, line }
//   Q.state
//   lockboxProblem(order.equation) -> the lock-box panel's problem for the top step's equation (openLockbox's
//                           `problem`), or null if it doesn't fit the lock box's own rules
// Pure: no page, no three.js. tests/wordproblems.test.mjs checks it.

import { line, num, xt, lineText, solve, moveLabel } from '../lockbox/engine.js';
import { RUNG, checkProblem } from '../lockbox/generate.js';

// ---- the dials (defaults; change them here) --------------------------------------------------------------------

export const CLEAN_TO_CLIMB = 3;     // orders right first time in a row to move up a step
export const MISS_DOWN = 1;          // steps down for a wrong first pick
export const PLACEMENT_MISSES = 2;   // the first-visit climb ends at this many misses (one slip is forgiven)
export const PLACE_BELOW = 1;        // ...and the kid settles this many steps below the step of that miss (a default of
                                     // this job, not a ruling: the times tables and negatives use 2, see their notes)
export const COMEBACK_MIN = 2;       // a missed kind of problem comes back this many orders later...
export const COMEBACK_MAX = 4;       // ...up to this many
export const SAME_KIND_RUN = 2;      // the same kind of problem at most this many times in a row (a comeback aside)
const RECENT_KEEP = 8;               // stories remembered so they don't come straight back

// ---- the ladder ----------------------------------------------------------------------------------------------------
// mix: how often each kind comes up on the step (the newest kind most). size: how big the numbers get (1 small .. 3).
// coins: how many coins on an order (one right). rate: which ways round the rate problems go (distance = speed x time;
// speed = distance / time; time = distance / speed). crates: the chance a sharing problem is a whole-crates one.
export const LADDER = [
  { mix: { groups: 1.2, parts: 1 }, size: 1, coins: 3, label: 'Equal groups and totals (4 pies, 3 pounds each)' },
  { mix: { share: 1.4, groups: 0.8, parts: 0.7 }, size: 1, coins: 3, label: 'Sharing out (24 nails into 4 kegs)' },
  { mix: { compare: 1.4, share: 0.9, groups: 0.8, parts: 0.7 }, size: 2, coins: 4, label: 'How many more (23 pounds against 9)' },
  { mix: { rate: 1.6, groups: 0.6, share: 0.7, compare: 0.6, parts: 0.4 }, size: 2, coins: 4, rate: ['distance', 'speed'], label: 'Miles, hours and speed (45 miles in 9 hours)' },
  { mix: { money: 1.5, rate: 1, share: 0.6, groups: 0.5, compare: 0.5 }, size: 2, coins: 4, rate: ['distance', 'speed', 'time'], label: 'Money and change' },
  { mix: { twostep: 1.6, money: 1, rate: 0.8, share: 0.5, compare: 0.4 }, size: 2, coins: 4, rate: ['distance', 'speed', 'time'], label: 'Two steps (bake 4 pies, already have 5 pounds)' },
  { mix: { recipe: 1.4, twostep: 1, share: 1, money: 0.6, rate: 0.6 }, size: 3, coins: 4, rate: ['distance', 'speed', 'time'], crates: 0.6, label: 'Recipes and whole crates' },
  { mix: { percent: 1.5, recipe: 0.8, twostep: 0.8, money: 0.6, rate: 0.6, share: 0.5 }, size: 3, coins: 4, rate: ['distance', 'speed', 'time'], crates: 0.5, label: 'Discounts and tax (10% off, 5% tax)' },
  { mix: { equation: 1.6, percent: 0.6, recipe: 0.6, twostep: 0.6, rate: 0.5, money: 0.4 }, size: 3, coins: 4, rate: ['distance', 'speed', 'time'], crates: 0.5, label: 'Stories told backwards (3x + 5 = 29)' },
];
export const TYPES = ['groups', 'share', 'parts', 'compare', 'rate', 'money', 'twostep', 'recipe', 'percent', 'equation'];
// what each kind is called, for the parents' line and the pictures
export const TYPE_NAMES = {
  groups: 'equal groups', share: 'sharing out', parts: 'totals and parts', compare: 'how many more', rate: 'speed, time and distance',
  money: 'money and change', twostep: 'two steps', recipe: 'recipe scaling', percent: 'discounts and tax', equation: 'stories told backwards',
};

// ---- a small seeded random-number maker (the same seed gives the same orders, for tests and rigs) ------------------
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function tools(rand) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const chance = (p) => rand() < p;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return { rand, int, pick, chance, shuffle };
}

// ---- the townsfolk who bring the orders ------------------------------------------------------------------------------
// she / he, and a look for the person who walks up (folk.js outfits and palettes; the game may ignore it)
export const FOLK = [
  { name: 'Mrs. Abernathy', she: true, look: { outfit: 'formal_f', palette: 'prairie' } },
  { name: 'Mr. Pike', she: false, look: { outfit: 'suit_m', palette: 'townsman' } },
  { name: 'Widow Collins', she: true, look: { outfit: 'casual_f', palette: 'homestead' } },
  { name: 'Sam Ortega', she: false, look: { outfit: 'adventurer_m', palette: 'drifter' } },
  { name: 'Doc Harlan', she: false, look: { outfit: 'suit_m', palette: 'sage' } },
  { name: 'Miss Lottie', she: true, look: { outfit: 'suit_f', palette: 'mustard' } },
  { name: 'Jed Turner', she: false, look: { outfit: 'casual_m', palette: 'rancher' } },
  { name: 'Rosa Vega', she: true, look: { outfit: 'adventurer_f', palette: 'drifter' } },
  // (the matron of the orphans' home: Loot the gang's leftovers go to her, src/math/shares.js)
  { name: 'Matron Hale', she: true, look: { outfit: 'formal_f', palette: 'townsman' } },
  { name: 'Hattie Bell', she: true, look: { outfit: 'casual_f', palette: 'mustard' } },
  { name: 'Cookie', she: false, look: { outfit: 'worker_m', palette: 'homestead' } },
  { name: 'Ike Malone', she: false, look: { outfit: 'casual_m', palette: 'sage' } },
  { name: 'Mrs. Lindqvist', she: true, look: { outfit: 'formal_f', palette: 'homestead' } },
  { name: 'Old Silas', she: false, look: { outfit: 'adventurer_m', palette: 'sage' } },
  { name: 'Clara Dunn', she: true, look: { outfit: 'adventurer_f', palette: 'rancher' } },
  { name: 'Mr. Okafor', she: false, look: { outfit: 'suit_m', palette: 'mustard' } },
];
const pro = (f) => (f.she ? { they: 'she', them: 'her', their: 'her', They: 'She', does: 'does she', has: 'she has' } : { they: 'he', them: 'him', their: 'his', They: 'He', does: 'does he', has: 'he has' });

// ---- numbers with their units ----------------------------------------------------------------------------------------
// a unit is [one, many]: u(1, POUND) -> '1 pound', u(12, POUND) -> '12 pounds'
const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
// "a" or "an" before a number as it is read out: an 8, an 11, an 18, an 80-something
const aN = (n) => (/^8/.test(String(n)) || n === 11 || n === 18 ? 'an' : 'a');
const POUND = ['pound', 'pounds'];
const MILE = ['mile', 'miles'];
const HOUR = ['hour', 'hours'];
const DAY = ['day', 'days'];
const MPH = ['mile an hour', 'miles an hour'];
const MPD = ['mile a day', 'miles a day'];
const CENT = ['cent', 'cents'];
const DOLLAR = ['dollar', 'dollars'];
// money as printed: $12, 35¢
export const money = (n, cents) => (cents ? `${n}¢` : `$${n}`);
// a coin's face: the big number and the small units under it, and the whole thing as one line
function face(v, unit, cents) {
  if (unit === 'money') return { v, big: money(v, cents), small: cents ? (v === 1 ? 'cent' : 'cents') : (v === 1 ? 'dollar' : 'dollars'), label: money(v, cents) };
  return { v, big: String(v), small: v === 1 ? unit[0] : unit[1], label: u(v, unit) };
}

// ---- the kinds of problem -------------------------------------------------------------------------------------------
// Each maker(t, size, f, opts) -> { key, story, ask, answer, unit, cents, slips: [{ v, slip, why }], pic, rightWhy, ... }
//   t: the random tools; size 1..3; f: the townsperson (name, she); opts: the step's settings.
//   story: the slip's words; ask: the question line; unit: [one, many] or 'money' (cents: money in cents)
//   slips: the wrong answers kids really give, the likeliest first; why: one plain line for that slip
//   pic: what the picture for this kind draws (src/ui/storepics.js); it never shows the answer, only '?'
//   rightWhy: one line said as the coins fly ("4 pies x 3 pounds = 12 pounds")
const S3 = (size, a, b, c) => [a, b, c][Math.max(1, Math.min(3, size)) - 1];
const MAKERS = {};

// 4 pies, 3 pounds each -> 12 pounds
MAKERS.groups = (t, size, f) => {
  const p = pro(f);
  const a = t.int(2, S3(size, 5, 8, 9)), b = t.int(2, S3(size, 5, 9, 12));
  const ctx = t.pick([
    { key: 'pies', item: ['pie', 'pies'], unit: POUND, stuff: 'berries',
      story: () => `${f.name} is baking ${a} pies for the town social. Each pie needs ${b} pounds of berries.`, ask: () => `How many pounds of berries ${p.does} need?` },
    { key: 'shoes', item: ['horse', 'horses'], unit: ['nail', 'nails'], stuff: 'nails',
      story: () => `${f.name} is shoeing ${a} horses at the livery. Every horse takes ${b} horseshoe nails.`, ask: () => `How many nails should ${p.they} buy?` },
    { key: 'coffee', item: ['sack', 'sacks'], unit: POUND, stuff: 'coffee',
      story: () => `The trail crew wants ${a} sacks of coffee, and each sack holds ${b} pounds.`, ask: () => `How many pounds of coffee is that?` },
    { key: 'lamps', item: ['lamp', 'lamps'], unit: ['pint', 'pints'], stuff: 'lamp oil',
      story: () => `${f.name} has ${a} lamps to fill. A lamp holds ${b} pints of lamp oil.`, ask: () => `How many pints of oil ${p.does} need for all of them?` },
    { key: 'shells', item: ['box', 'boxes'], unit: ['shell', 'shells'], stuff: 'shells',
      story: () => `${f.name} is heading out to hunt and buys ${a} boxes of rifle shells. A box holds ${b} shells.`, ask: () => `How many shells is that in all?` },
  ]);
  const ans = a * b;
  return {
    key: `groups:${ctx.key}`, story: ctx.story(), ask: ctx.ask(), answer: ans, unit: ctx.unit,
    slips: [
      { v: a + b, slip: 'added', why: `${a} + ${b} adds ${ctx.item[1]} to ${ctx.unit[1]}. It's ${a} ${ctx.item[1]} with ${b} ${ctx.unit[1]} each: ${a} groups of ${b}.` },
      { v: b, slip: 'one', why: `${u(b, ctx.unit)} is enough for just 1 ${ctx.item[0]}. There are ${a} of them.` },
      { v: (a + 1) * b, slip: 'groupOff', why: `That's ${a + 1} groups of ${b}. Count the ${ctx.item[1]} again: there are ${a}.` },
      { v: (a - 1) * b, slip: 'groupOff', why: `That's only ${a - 1} groups of ${b}. Count the ${ctx.item[1]} again: there are ${a}.` },
    ],
    pic: { kind: 'groups', groups: a, each: b, item: ctx.item, unit: ctx.unit },
    rightWhy: `${a} ${ctx.item[1]} × ${b} ${ctx.unit[1]} = ${u(ans, ctx.unit)}`,
  };
};

// 24 nails into 4 kegs -> 6 a keg; whole crates: 50 cans, 12 to a crate -> 5 crates
MAKERS.share = (t, size, f, opts = {}) => {
  const p = pro(f);
  if (t.chance(opts.crates || 0)) {
    // whole crates: the leftover needs a crate (or a wagon, or a trip) of its own
    const per = t.pick([6, 8, 10, 12]), full = t.int(2, 7), left = t.int(1, per - 1), total = per * full + left, ans = full + 1;
    const ctx = t.pick([
      { key: 'beans', box: ['crate', 'crates'], story: `${f.name} needs ${total} cans of beans for the camp. Beans come in crates of ${per} cans.`, ask: `How many crates should ${p.they} buy so there's enough?` },
      { key: 'riders', box: ['wagon', 'wagons'], story: `${total} folks are riding out to the barn dance, and a wagon seats ${per}.`, ask: 'How many wagons are needed so everyone gets a seat?' },
      { key: 'jars', box: ['box', 'boxes'], story: `${f.name} is packing ${total} jars of jam to ship. A box holds ${per} jars.`, ask: `How many boxes does ${p.they} need for every jar?` },
    ]);
    return {
      key: `share:${ctx.key}`, story: ctx.story, ask: ctx.ask, answer: ans, unit: ctx.box,
      slips: [
        { v: full, slip: 'leftover', why: `${u(full, ctx.box)} hold ${full * per}. That leaves ${left} with nowhere to go: they need one more.` },
        { v: total * per > 999 ? total + per : total * per, slip: total * per > 999 ? 'added' : 'multiplied', why: total * per > 999 ? `${total} + ${per} adds them up. Split the ${total} into ${ctx.box[1]} of ${per}.` : `${total} × ${per} multiplies. Split the ${total} into ${ctx.box[1]} of ${per} instead.` },
        { v: full + 2, slip: 'extra', why: `${u(full + 1, ctx.box)} already hold all ${total} (${(full + 1) * per} spots). One more is extra.` },
      ],
      pic: { kind: 'share', total, per, groups: null, box: ctx.box, crates: true },
      rightWhy: `${full} full ${ctx.box[1]} hold ${full * per}, and 1 more for the last ${left}: ${u(ans, ctx.box)}`,
    };
  }
  const groups = t.int(2, S3(size, 5, 8, 9)), each = t.int(2, S3(size, 6, 9, 12)), total = groups * each;
  const ctx = t.pick([
    { key: 'nails', thing: ['nail', 'nails'], box: ['keg', 'kegs'], story: `${f.name} has ${total} nails and ${groups} empty kegs, and wants the same number of nails in each keg.`, ask: 'How many nails go in each keg?' },
    { key: 'candy', thing: ['candy stick', 'candy sticks'], box: ['child', 'children'], story: `${f.name} buys ${total} candy sticks to share evenly among ${groups} children.`, ask: 'How many candy sticks does each child get?' },
    { key: 'flour', thing: ['pound', 'pounds'], box: ['sack', 'sacks'], story: `There are ${total} pounds of flour in the bin. ${f.name} wants it split into ${groups} sacks, all the same.`, ask: 'How many pounds go in each sack?' },
    { key: 'shells', thing: ['shell', 'shells'], box: ['box', 'boxes'], story: `${f.name} is packing ${total} rifle shells into ${groups} boxes, the same in every box.`, ask: 'How many shells go in each box?' },
    { key: 'eggs', thing: ['egg', 'eggs'], box: ['basket', 'baskets'], story: `${f.name} brought in ${total} eggs and wants them laid out evenly in ${groups} baskets.`, ask: 'How many eggs go in each basket?' },
  ]);
  return {
    key: `share:${ctx.key}`, story: ctx.story, ask: ctx.ask, answer: each, unit: ctx.thing,
    slips: [
      { v: total * groups, slip: 'multiplied', why: `${total} × ${groups} multiplies. The ${total} ${ctx.thing[1]} are being split up, so each ${ctx.box[0]} gets fewer, not more.` },
      { v: total - groups, slip: 'subtracted', why: `${total} − ${groups} takes away ${groups}. Deal the ${total} out into ${groups} equal piles instead.` },
      { v: each + 1, slip: 'off', why: `${groups} piles of ${each + 1} would be ${groups * (each + 1)}, more than ${total}.` },
      { v: each - 1, slip: 'off', why: `${groups} piles of ${each - 1} make only ${groups * (each - 1)}. There are ${total} to share.` },
    ],
    pic: { kind: 'share', total, groups, per: null, box: ctx.box, thing: ctx.thing },
    rightWhy: `${total} ÷ ${groups} = ${each}: ${u(each, ctx.thing)} in each ${ctx.box[0]}`,
  };
};

// had 30, sold 12 -> 18 left; 15 and 18 together -> 33
MAKERS.parts = (t, size, f) => {
  const p = pro(f);
  const a = t.int(S3(size, 6, 12, 20), S3(size, 20, 40, 80)), b = t.int(3, Math.max(4, a - 3));
  if (t.chance(0.5)) {   // the whole is known, a part taken away
    const ctx = t.pick([
      { key: 'flourLeft', unit: ['sack', 'sacks'], story: `The store had ${a} sacks of flour this morning. ${f.name} bought ${b} of them for the hotel kitchen.`, ask: 'How many sacks are left on the shelf?' },
      { key: 'oilLeft', unit: ['pint', 'pints'], story: `${f.name}'s barrel held ${a} pints of lamp oil. ${p.They} poured out ${b} pints for the lamps.`, ask: 'How many pints are still in the barrel?' },
      { key: 'fenceLeft', unit: ['post', 'posts'], story: `${f.name} needs ${a} fence posts in all, and ${p.has} set ${b} of them already.`, ask: 'How many posts are still to set?' },
    ]);
    const ans = a - b;
    return {
      key: `parts:${ctx.key}`, story: ctx.story, ask: ctx.ask, answer: ans, unit: ctx.unit,
      slips: [
        { v: a + b, slip: 'added', why: `${a} + ${b} puts more in. Some were taken out of the ${a}, so fewer are left.` },
        { v: b, slip: 'part', why: `${b} is how many were taken. The question is what's left of the ${a}.` },
        { v: ans + 1, slip: 'off', why: `${ans + 1} + ${b} makes ${ans + 1 + b}, not ${a}.` },
        { v: ans - 1, slip: 'off', why: `${ans - 1} + ${b} makes ${ans - 1 + b}, not ${a}.` },
      ],
      pic: { kind: 'parts', whole: a, parts: [null, b], unit: ctx.unit },
      rightWhy: `${a} − ${b} = ${u(ans, ctx.unit)} left`,
    };
  }
  const ctx = t.pick([
    { key: 'wagons', unit: ['sack', 'sacks'], story: `Two freight wagons pulled in. One carried ${a} sacks of oats and the other ${b} sacks.`, ask: 'How many sacks of oats came in?' },
    { key: 'eggsTwo', unit: ['egg', 'eggs'], story: `${f.name} sold the store ${a} eggs on Monday and ${b} more on Friday.`, ask: `How many eggs did ${p.they} sell in all?` },
    { key: 'miles', unit: MILE, story: `${f.name} rode ${a} miles to the fort, then ${b} miles on to the mission.`, ask: `How far did ${p.they} ride?` },
  ]);
  const ans = a + b;
  return {
    key: `parts:${ctx.key}`, story: ctx.story, ask: ctx.ask, answer: ans, unit: ctx.unit,
    slips: [
      { v: a - b, slip: 'subtracted', why: `${a} − ${b} takes one away from the other. Both lots are put together here.` },
      { v: a, slip: 'part', why: `${a} is just the first part. Put the ${b} with it.` },
      { v: ans + 10, slip: 'off', why: `${a} + ${b} isn't ${ans + 10}. Add the tens, then the ones.` },
      { v: ans - 1, slip: 'off', why: `${a} and ${b} make one more than ${ans - 1}.` },
    ],
    pic: { kind: 'parts', whole: null, parts: [a, b], unit: ctx.unit },
    rightWhy: `${a} + ${b} = ${u(ans, ctx.unit)}`,
  };
};

// 23 pounds against 9 pounds -> 14 more
MAKERS.compare = (t, size, f) => {
  const big = t.int(S3(size, 9, 14, 25), S3(size, 20, 40, 90)), small = t.int(2, big - 3), ans = big - small;
  const other = t.pick(['Ma Dunn', 'the hotel', 'the Bar T ranch', 'the schoolteacher', 'the blacksmith']), pal = t.pick(['Eli', 'Nell', 'Tomás', 'Mae']);
  const ctx = t.pick([
    { key: 'potatoes', unit: POUND, story: `${f.name} bought ${big} pounds of potatoes. ${other[0].toUpperCase() + other.slice(1)} bought ${small} pounds.`, ask: `How many more pounds did ${f.name} buy?` },
    { key: 'fish', unit: ['fish', 'fish'], story: `At the creek ${f.name} caught ${small} fish and young ${pal} caught ${big}.`, ask: `How many more fish did ${pal} catch than ${f.name}?` },
    { key: 'cattle', unit: ['steer', 'steers'], story: `The Bar T runs ${big} steers. ${f.name}'s place runs ${small}.`, ask: `How many fewer steers are on ${f.name}'s place?` },
    { key: 'pies', unit: ['pie', 'pies'], story: `At the fair, the bakery sold ${big} pies and ${f.name} sold ${small}.`, ask: `How many more pies did the bakery sell?` },
  ]);
  return {
    key: `compare:${ctx.key}`, story: ctx.story, ask: ctx.ask, answer: ans, unit: ctx.unit,
    slips: [
      { v: big + small, slip: 'added', why: `${big} + ${small} puts them together. The question is the gap between them.` },
      { v: big, slip: 'bigger', why: `${big} is how many one of them has. Line the two up: how far past ${small} is ${big}?` },
      { v: ans + 1, slip: 'off', why: `${small} + ${ans + 1} makes ${small + ans + 1}, one past ${big}.` },
      { v: ans - 1, slip: 'off', why: `${small} + ${ans - 1} makes ${small + ans - 1}, one short of ${big}.` },
    ],
    pic: { kind: 'compare', big, small, unit: ctx.unit },
    rightWhy: `${big} − ${small} = ${ans}: the gap is ${u(ans, ctx.unit)}`,
  };
};

// distance = speed x time, and the two ways back: 45 miles in 9 hours -> 5 miles an hour
MAKERS.rate = (t, size, f, opts = {}) => {
  const p = pro(f);
  const form = t.pick(opts.rate || ['distance', 'speed']);
  const days = t.chance(0.35);
  const sp = days ? t.int(8, S3(size, 12, 15, 20)) : t.int(2, S3(size, 6, 9, 9)), tm = t.int(2, S3(size, 6, 9, 9)), d = sp * tm;
  const SPD = days ? MPD : MPH, TM = days ? DAY : HOUR;
  // (the trade wagon always comes from Yuma to this town, as in the store's first story; the others go all over)
  let town = t.pick(['Yuma', 'Tucson', 'Fort Bowie', 'Silver City', 'Prescott', 'Tombstone']);
  const what = t.pick([
    { key: 'wagon', who: 'The trade wagon', go: 'rolls' },
    { key: 'stage', who: 'The stagecoach', go: 'runs' },
    { key: 'herd', who: 'The cattle drive', go: 'moves' },
    { key: 'rider', who: `${f.name}`, go: 'rides' },
  ]);
  const wagon = what.key === 'wagon';
  if (wagon) town = 'Yuma';
  const per = days ? 'a day' : 'an hour';
  const rider = what.key === 'rider', it = rider ? p.they : 'it';
  if (form === 'speed') {
    const story = what.key === 'wagon' && !days
      ? `A trade wagon is bringing our next shipment from ${town}, which is ${d} miles away. It needs to get here in ${tm} hours.`
      : `${what.who} has ${d} miles to cover ${wagon ? 'from Yuma to town' : `to ${town}`} and ${tm} ${TM[1]} to do it.`;
    return {
      key: `rate:speed:${what.key}`, story, ask: `How fast must ${it} go, in miles ${per}?`, answer: sp, unit: SPD,
      slips: [
        { v: d * tm, slip: 'multiplied', why: `${d} × ${tm} = ${d * tm} would be ${d * tm} miles ${per}. Share the ${d} miles out over the ${tm} ${TM[1]}.` },
        { v: d - tm, slip: 'subtracted', why: `${d} − ${tm} takes ${TM[1]} from miles. Split the ${d} miles into ${tm} equal ${TM[0]} stretches.` },
        { v: sp + 1, slip: 'off', why: `At ${sp + 1} miles ${per}, ${tm} ${TM[1]} cover ${(sp + 1) * tm} miles, not ${d}.` },
        { v: d + tm, slip: 'added', why: `${d} + ${tm} adds miles and ${TM[1]}. Each ${TM[0]} covers an equal part of the ${d} miles.` },
      ],
      pic: { kind: 'road', miles: d, steps: tm, step: TM, speed: null, total: d },
      rightWhy: `${d} miles ÷ ${tm} ${TM[1]} = ${u(sp, SPD)}`,
    };
  }
  if (form === 'time') {
    return {
      key: `rate:time:${what.key}`,
      story: wagon ? `The trade wagon ${what.go} ${u(sp, SPD)} toward town, and it has just left Yuma, ${d} miles off.` : `${what.who} ${what.go} ${u(sp, SPD)}, and ${town} is ${d} miles off.`,
      ask: `How many ${TM[1]} until ${it} gets ${wagon ? 'here' : 'there'}?`, answer: tm, unit: TM,
      slips: [
        { v: d * sp, slip: 'multiplied', why: `${d} × ${sp} multiplies. Count how many ${sp}-mile ${TM[0]}s fit into ${d} miles.` },
        { v: d - sp, slip: 'subtracted', why: `${d} − ${sp} is the miles left after one ${TM[0]}. Keep going ${sp} at a time until all ${d} are done.` },
        { v: tm + 1, slip: 'off', why: `${tm + 1} ${TM[1]} at ${sp} would be ${(tm + 1) * sp} miles, past ${wagon ? 'town' : town}.` },
        { v: d + sp, slip: 'added', why: `${d} + ${sp} adds miles and speed. Count the ${TM[1]} it takes, ${sp} miles each.` },
      ],
      pic: { kind: 'road', miles: d, steps: null, step: TM, speed: sp, total: d },
      rightWhy: `${d} miles ÷ ${sp} ${SPD[1]} = ${u(tm, TM)}`,
    };
  }
  return {
    key: `rate:distance:${what.key}`, story: `${what.who} ${what.go} ${u(sp, SPD)} ${wagon ? 'on its way from Yuma' : `toward ${town}`}, for ${tm} ${TM[1]}.`,
    ask: `How many miles does ${it} cover?`, answer: d, unit: MILE,
    slips: [
      { v: sp + tm, slip: 'added', why: `${sp} + ${tm} adds speed and ${TM[1]}. Every ${TM[0]} covers ${sp} miles, ${tm} times over.` },
      { v: sp, slip: 'one', why: `${sp} miles is just the first ${TM[0]}. It keeps going for ${tm} ${TM[1]}.` },
      { v: sp * (tm + 1), slip: 'groupOff', why: `That's ${tm + 1} ${TM[1]} of ${sp} miles. It travels for ${tm}.` },
      { v: sp * (tm - 1), slip: 'groupOff', why: `That's only ${tm - 1} ${TM[1]} of ${sp} miles. It travels for ${tm}.` },
    ],
    pic: { kind: 'road', miles: null, steps: tm, step: TM, speed: sp, total: null },
    rightWhy: `${u(sp, SPD)} × ${tm} ${TM[1]} = ${u(d, MILE)}`,
  };
};

// change from a payment: costs 13 cents, pays with a quarter -> 12 cents
MAKERS.money = (t, size, f) => {
  const p = pro(f);
  const cents = t.chance(0.5);
  if (t.chance(0.5) && size >= 2) {
    // several at one price
    const n = t.int(2, S3(size, 4, 6, 8)), each = cents ? t.int(2, 9) : t.int(2, 9), ans = n * each;
    const ctx = t.pick([
      { key: 'tins', item: ['tin of peaches', 'tins of peaches'] }, { key: 'candles', item: ['candle', 'candles'] },
      { key: 'spools', item: ['spool of thread', 'spools of thread'] }, { key: 'traps', item: ['rabbit trap', 'rabbit traps'] },
    ]);
    const price = money(each, cents);
    return {
      key: `money:several:${ctx.key}`, story: `${f.name} wants ${n} ${ctx.item[1]}. They're ${price} each.`, ask: `How much does ${p.they} owe?`, answer: ans, unit: 'money', cents,
      slips: [
        { v: n + each, slip: 'added', why: `${n} + ${each} adds the count to the price. It's ${price} for each of ${n}: ${n} groups of ${each}.` },
        { v: each, slip: 'one', why: `${price} pays for just one. ${p.They} wants ${n}.` },
        { v: (n + 1) * each, slip: 'groupOff', why: `That pays for ${n + 1} of them. ${p.They} wants ${n}.` },
      ],
      pic: { kind: 'groups', groups: n, each, item: ctx.item, unit: 'money', cents },
      rightWhy: `${n} × ${price} = ${money(ans, cents)}`,
    };
  }
  const paid = cents ? t.pick([25, 50, 50, 75, 100]) : t.pick([5, 10, 10, 20, 20, 50]);
  const cost = t.int(Math.max(1, Math.round(paid * 0.2)), paid - 1), ans = paid - cost;
  const ctx = t.pick([
    { key: 'soap', item: 'a bar of lye soap' }, { key: 'hat', item: 'a felt hat' }, { key: 'rope', item: 'a coil of rope' },
    { key: 'lantern', item: 'a tin lantern' }, { key: 'sugar', item: 'a sack of sugar' },
  ]);
  const coin = cents ? { 25: 'a quarter', 50: 'a half dollar', 75: 'three quarters', 100: 'a silver dollar' }[paid] : `${aN(paid)} $${paid} note`;
  return {
    key: `money:change:${ctx.key}`, story: `${f.name} buys ${ctx.item} for ${money(cost, cents)} and pays with ${coin}${cents ? ` (${paid}¢)` : ''}.`,
    ask: `How much change does ${p.they} get back?`, answer: ans, unit: 'money', cents,
    slips: [
      { v: paid + cost, slip: 'added', why: `${money(paid, cents)} + ${money(cost, cents)} adds the price on. The change is what's left of ${money(paid, cents)} after paying ${money(cost, cents)}.` },
      { v: cost, slip: 'price', why: `${money(cost, cents)} is the price. The change is the rest of the ${money(paid, cents)}.` },
      { v: ans + 1, slip: 'off', why: `${money(cost, cents)} + ${money(ans + 1, cents)} makes ${money(paid + 1, cents)}, not ${money(paid, cents)}.` },
      { v: ans + 10, slip: 'off', why: `${money(cost, cents)} + ${money(ans + 10, cents)} makes ${money(paid + 10, cents)}. Count up from ${money(cost, cents)} to ${money(paid, cents)}.` },
    ],
    pic: { kind: 'parts', whole: paid, parts: [cost, null], unit: 'money', cents, labels: ['price', 'change'] },
    rightWhy: `${money(paid, cents)} − ${money(cost, cents)} = ${money(ans, cents)} change`,
  };
};

// two steps: 4 pies x 3 pounds = 12, already has 5 -> 7 more to buy
MAKERS.twostep = (t, size, f) => {
  const p = pro(f);
  const a = t.int(2, S3(size, 5, 6, 8)), b = t.int(2, S3(size, 5, 6, 9)), first = a * b;
  if (t.chance(0.5)) {
    const have = t.int(1, first - 2), ans = first - have;
    const ctx = t.pick([
      { key: 'pies', item: ['pie', 'pies'], unit: POUND, story: `${f.name} is baking ${a} pies, and each pie takes ${b} pounds of apples. ${p.They} already has ${have} pounds at home.`, ask: `How many more pounds of apples ${p.does} need to buy?` },
      { key: 'fence', item: ['side', 'sides'], unit: ['rail', 'rails'], story: `${f.name}'s new pen has ${a} sides, and each side takes ${b} rails. ${p.They} has ${have} rails stacked already.`, ask: `How many more rails should ${p.they} buy?` },
    ]);
    return {
      key: `twostep:${ctx.key}`, story: ctx.story, ask: ctx.ask, answer: ans, unit: ctx.unit,
      slips: [
        { v: first, slip: 'stopped', why: `${a} × ${b} = ${first} is how many in all. ${p.They} has ${have} already, so take those off.` },
        { v: first + have, slip: 'wrongSecond', why: `Adding the ${have} buys even more. The ${have} at home count toward the ${first}.` },
        { v: a + b + have, slip: 'added', why: `${a} + ${b} + ${have} adds every number. First: ${a} ${ctx.item[1]} with ${b} each.` },
        { v: ans + 1, slip: 'off', why: `${ans + 1} + ${have} makes ${ans + 1 + have}, not ${first}.` },
      ],
      pic: { kind: 'twostep', groups: a, each: b, item: ctx.item, unit: ctx.unit, then: 'minus', other: have },
      rightWhy: `${a} × ${b} = ${first}, then ${first} − ${have} = ${u(ans, ctx.unit)}`,
    };
  }
  const paid = t.pick([20, 50, 50, 100].filter((v) => v > first)) || first + 10, ans = paid - first;
  const ctx = t.pick([
    { key: 'blankets', item: ['blanket', 'blankets'] }, { key: 'shovels', item: ['shovel', 'shovels'] }, { key: 'sacks', item: ['sack of feed', 'sacks of feed'] },
  ]);
  return {
    key: `twostep:change:${ctx.key}`, story: `${f.name} buys ${a} ${ctx.item[1]} at $${b} each and pays with ${aN(paid)} $${paid} note.`,
    ask: `How much change ${p.does} get?`, answer: ans, unit: 'money', cents: false,
    slips: [
      { v: first, slip: 'stopped', why: `$${first} is the bill for the ${ctx.item[1]}. The change is what's left of the $${paid}.` },
      { v: paid - b, slip: 'once', why: `$${paid} − $${b} pays for one ${ctx.item[0]}. ${p.They} buys ${a}.` },
      { v: paid + first, slip: 'wrongSecond', why: `Adding the bill on makes more money, but paying takes money away.` },
      { v: ans + 1, slip: 'off', why: `$${first} + $${ans + 1} makes $${first + ans + 1}, not $${paid}.` },
    ],
    pic: { kind: 'twostep', groups: a, each: b, item: ctx.item, unit: 'money', cents: false, then: 'change', other: paid },
    rightWhy: `${a} × $${b} = $${first}, then $${paid} − $${first} = $${ans}`,
  };
};

// recipe scaling: 2 pies take 3 cups, so 8 pies take 12 cups
MAKERS.recipe = (t, size, f) => {
  const p = pro(f);
  const base = t.int(2, 4), k = t.int(2, S3(size, 3, 4, 5));
  // (the answer, per x k, must not be a number the story already prints: per = base would make it the number of pies
  // wanted, and per x k = base the recipe's own size)
  let per = t.int(2, S3(size, 4, 5, 6));
  for (let i = 0; i < 20 && (per === base || per * k === base); i++) per = t.int(2, S3(size, 4, 5, 6));
  if (per === base || per * k === base) per = base + 1;
  const want = base * k, ans = per * k;
  const ctx = t.pick([
    { key: 'pies', make: ['pie', 'pies'], unit: ['cup of sugar', 'cups of sugar'], small: ['cup', 'cups'] },
    { key: 'biscuits', make: ['pan of biscuits', 'pans of biscuits'], unit: ['cup of flour', 'cups of flour'], small: ['cup', 'cups'] },
    { key: 'beans', make: ['bowl of chili', 'bowls of chili'], unit: ['handful of beans', 'handfuls of beans'], small: ['handful', 'handfuls'] },
    { key: 'cornbread', make: ['loaf of cornbread', 'loaves of cornbread'], unit: ['egg', 'eggs'], small: ['egg', 'eggs'] },
  ]);
  const story = `${f.name}'s recipe makes ${u(base, ctx.make)} with ${u(per, ctx.unit)}. ${p.They} needs ${u(want, ctx.make)} for the harvest supper.`;
  return {
    key: `recipe:${ctx.key}`, story, ask: `How many ${ctx.small[1]} ${p.does} need?`, answer: ans, unit: ctx.small,
    slips: [
      { v: per + (want - base), slip: 'addedOn', why: `That adds ${want - base}, one for each extra ${ctx.make[0]}. A recipe grows by times, not by adding: ${want} is ${k} times ${base}, so it takes ${k} times the ${ctx.small[1]}.` },
      { v: per * want, slip: 'multipliedAll', why: `${per} × ${want} would be ${per} ${ctx.small[1]} for every one ${ctx.make[0]}. The ${per} ${ctx.small[1]} make ${base}.` },
      { v: k, slip: 'times', why: `${k} is how many times bigger the batch is (${base} × ${k} = ${want}). Now make the ${ctx.small[1]} ${k} times bigger too.` },
      { v: ans + per, slip: 'groupOff', why: `That's ${k + 1} batches. ${want} ${ctx.make[1]} is ${k} batches of ${base}.` },
    ],
    pic: { kind: 'ratio', base, per, want, k, make: ctx.make, unit: ctx.small },
    rightWhy: `${want} is ${k} × ${base}, so ${k} × ${per} = ${u(ans, ctx.small)}`,
  };
};

// discounts and tax on round numbers: a $40 blanket at 10% off -> $36
MAKERS.percent = (t, size, f) => {
  const p = pro(f);
  const pct = t.pick([10, 10, 20, 25, 50]);
  const step = { 10: 10, 20: 5, 25: 4, 50: 2 }[pct];
  // (the price is a whole number of the parts the percent cuts it into, so the discount is whole dollars)
  const price = (pct === 10 ? 10 : step) * t.int(2, S3(size, 6, 8, 10)), part = price * pct / 100;
  const item = t.pick(['saddle blanket', 'pair of boots', 'lantern', 'cast-iron skillet', 'wool coat', 'rocking chair']);
  if (t.chance(0.6)) {
    const ans = price - part;
    return {
      key: `percent:off:${item}`, story: `The ${item} is $${price}, but this week everything is ${pct}% off.`, ask: `What does ${f.name} pay for it?`, answer: ans, unit: 'money', cents: false,
      slips: [
        { v: part, slip: 'discountOnly', why: `$${part} is the ${pct}% that comes off. Take it away from the $${price}.` },
        { v: price - pct, slip: 'percentAsDollars', why: `${pct}% isn't $${pct}. ${pct}% of $${price} is $${part}.` },
        { v: price + part, slip: 'added', why: `$${price} + $${part} adds it on. "Off" makes the price smaller.` },
        // (at 50% off the part that comes off IS the new price, so that slip can't be a wrong coin; these stand in)
        ...(pct === 50 ? [
          { v: price * 2, slip: 'doubled', why: `$${price * 2} is double the price. Half off takes half of the $${price} away.` },
          { v: price / 4, slip: 'halvedTwice', why: `$${price / 4} is half of a half. 50% off takes half away once.` },
        ] : []),
      ].filter((s) => s.v > 0),
      pic: { kind: 'percent', whole: price, pct, parts: 100 / pct, mode: 'off' },
      rightWhy: `${pct}% of $${price} is $${part}, and $${price} − $${part} = $${ans}`,
    };
  }
  const tax = t.pick([10, 10, 5]);
  const base = tax === 5 ? 20 * t.int(1, 5) : 10 * t.int(2, 9), add = base * tax / 100, ans = base + add;
  return {
    key: `percent:tax:${item}`, story: `${f.name} is buying a ${item} for $${base}. The territory adds a ${tax}% tax.`, ask: `How much ${p.does} pay with the tax?`, answer: ans, unit: 'money', cents: false,
    slips: [
      { v: add, slip: 'discountOnly', why: `$${add} is just the tax. ${p.They} pays the $${base} as well.` },
      { v: base + tax, slip: 'percentAsDollars', why: `${tax}% isn't $${tax}. ${tax}% of $${base} is $${add}.` },
      { v: base - add, slip: 'subtracted', why: `Tax is added on top; it never makes the price smaller.` },
    ],
    pic: { kind: 'percent', whole: base, pct: tax, parts: tax === 5 ? 20 : 10, mode: 'tax' },
    rightWhy: `${tax}% of $${base} is $${add}, and $${base} + $${add} = $${ans}`,
  };
};

// a story told backwards: 3 sacks and a 5-cent tin came to 29 cents -> 3x + 5 = 29 (the lock box solves it)
const eqText = (a, b, c, x = 'x') => `${a}${x} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${c}`;
MAKERS.equation = (t, size, f) => {
  const p = pro(f);
  for (let tries = 0; tries < 50; tries++) {
    const a = t.int(2, 6), x = t.int(2, 9), b = t.int(2, 12) * (t.chance(0.3) ? -1 : 1), c = a * x + b;
    // the lock box's own rules: no number printed twice with x (x must not be printed), all within 99, nothing zero
    if (c <= 0 || c > 99 || [a, Math.abs(b), c].includes(x) || a === Math.abs(b)) continue;
    // (a coupon or the pickles eaten stay smaller than what is left: a 11-cent coupon on a 12-cent bill reads oddly)
    if (b < 0 && -b >= c) continue;
    if (!lockboxProblem({ a, b, c, x })) continue;
    const ctx = b > 0
      ? t.pick([
        { key: 'sacks', thing: ['sack of beans', 'sacks of beans'], story: `${f.name} bought ${a} sacks of beans and ${aN(b)} ${b}¢ tin of salt. It all came to ${c}¢.`, ask: 'What did one sack of beans cost?', unit: CENT },
        { key: 'boxes', thing: ['box of shells', 'boxes of shells'], story: `${f.name} paid ${c}¢ for ${a} boxes of shells and ${aN(b)} ${b}¢ cleaning rag.`, ask: 'How much was each box of shells?', unit: CENT },
        { key: 'posts', thing: ['day', 'days'], story: `${f.name} set the same number of fence posts each day for ${a} days. With the ${b} that were already up, ${c} posts stand now.`, ask: 'How many posts went in each day?', unit: ['post', 'posts'] },
        { key: 'drive', thing: ['day', 'days'], story: `The herd walked the same distance each day for ${a} days, then ${b} more miles on the last morning. ${c} miles in all.`, ask: 'How many miles did it walk each day?', unit: MILE },
      ])
      : t.pick([
        { key: 'coupon', thing: ['lamp', 'lamps'], story: `${f.name} bought ${a} lamps, all the same price, and used ${aN(-b)} ${-b}¢ coupon. ${p.They} paid ${c}¢.`, ask: 'What did one lamp cost?', unit: CENT },
        { key: 'eaten', thing: ['jar', 'jars'], story: `${f.name} filled ${a} jars with the same number of pickles, then the children ate ${-b} of them. Now there are ${c} pickles left.`, ask: 'How many pickles went in each jar?', unit: ['pickle', 'pickles'] },
      ]);
    const right = eqText(a, b, c);
    const opts = [
      { label: right, good: true },
      { label: eqText(Math.abs(b), b < 0 ? -a : a, c), slip: 'swapped', why: `That puts ${Math.abs(b)} with x. There are ${a} of the unknown, so it's ${a}x, and the ${Math.abs(b)} is on its own.` },
      { label: `${a}x = ${c} ${b < 0 ? '−' : '+'} ${Math.abs(b)}`, slip: 'wrongSide', why: `The ${a}x and the ${Math.abs(b)} together make the ${c}, so they go on the same side: ${right}.` },
      { label: `x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${c}`, slip: 'oneOnly', why: `That's only one of them. There are ${a}, so ${a} lots of x.` },
    ];
    return {
      key: `equation:${ctx.key}`, story: ctx.story, ask: `${ctx.ask} Pick the equation that tells the story.`, answer: right, unit: null, isEquation: true,
      equation: { a, b, c, x, text: right, unit: ctx.unit },
      eqCoins: opts,
      pic: { kind: 'equation', a, b, c, thing: ctx.thing },
      rightWhy: `${a} lots of x, ${b < 0 ? 'take away' : 'and'} ${Math.abs(b)}, make ${c}: ${right}`,
      afterWhy: `x = ${u(x, ctx.unit)}`,
    };
  }
  return null;
};

// ---- an order: a problem with its townsperson and its coins ------------------------------------------------------------
// -> { id, type, step, key, who: { name, she, look }, story, ask, coins: [{ v, big, small, label, good, slip, why }],
//      answer: the right coin's label, unit, pic, rightWhy, equation? (the top step: { a, b, c, x, text }), review, back }
// The coins are shuffled; exactly one is good; the wrong ones are never equal to the answer and never repeat.
export function makeOrder(type, { rand = Math.random, step = 1, who = null, coins: count = null } = {}) {
  const t = tools(rand);
  const S = LADDER[Math.max(1, Math.min(LADDER.length, step)) - 1];
  const f = who || t.pick(FOLK);
  const n = count || S.coins || 4;
  for (let tries = 0; tries < 40; tries++) {
    const core = MAKERS[type](t, S.size, f, S);
    if (!core) continue;
    let coins;
    if (core.isEquation) {
      const seen = new Set();
      coins = core.eqCoins.filter((c) => !seen.has(c.label) && seen.add(c.label)).slice(0, n)
        .map((c) => ({ v: c.label, big: c.label, small: '', label: c.label, good: !!c.good, slip: c.slip || null, why: c.why || '' }));
      if (coins.length < 3 || !coins.some((c) => c.good)) continue;
    } else {
      const right = face(core.answer, core.unit, core.cents);
      const used = new Set([core.answer]);
      const wrong = [];
      for (const s of core.slips) {
        if (wrong.length >= n - 1) break;
        if (!Number.isInteger(s.v) || s.v <= 0 || used.has(s.v)) continue;
        used.add(s.v);
        wrong.push({ ...face(s.v, core.unit, core.cents), good: false, slip: s.slip, why: s.why });
      }
      if (wrong.length < Math.min(n - 1, 2)) continue;
      coins = [{ ...right, good: true, slip: null, why: '' }, ...wrong];
    }
    t.shuffle(coins);
    return {
      id: Math.floor(rand() * 1e9).toString(36), type, step, key: core.key, who: f,
      story: core.story, ask: core.ask, coins, answer: coins.find((c) => c.good).label,
      unit: core.unit, cents: !!core.cents, pic: core.pic, rightWhy: core.rightWhy, afterWhy: core.afterWhy || '',
      equation: core.equation || null,
    };
  }
  throw new Error(`no ${type} order could be made`);
}

// ---- the trainer: which order comes next, and how the ladder moves --------------------------------------------------------
function fill(s) {
  const d = { v: 1, step: 1, placing: true, misses: 0, streak: 0, n: 0, firsts: 0, recent: [], kinds: [], due: [], byType: {}, lastWho: [] };
  for (const [k, v] of Object.entries(d)) if (s[k] === undefined || s[k] === null || typeof s[k] !== typeof v) s[k] = Array.isArray(v) ? [...v] : (v && typeof v === 'object' ? {} : v);
  for (const k of ['recent', 'kinds', 'due', 'lastWho']) if (!Array.isArray(s[k])) s[k] = [];
  s.step = Math.max(1, Math.min(LADDER.length, Math.round(Number(s.step) || 1)));
  s.due = s.due.filter((d) => d && TYPES.includes(d.type) && Number.isFinite(d.at));
  return s;
}

export function makeWordProblems(state = {}, { rand = Math.random } = {}) {
  const s = fill(state);
  const t = tools(rand);

  // the kind of problem for the next order: a missed kind that is due back, else one from the step's mix (a kind
  // already dealt twice in a row is left out)
  function pickType() {
    const di = s.due.findIndex((d) => d.at <= s.n);
    if (di >= 0) {
      const d = s.due.splice(di, 1)[0];
      return { type: d.type, back: true };
    }
    const mix = LADDER[s.step - 1].mix;
    const run = s.kinds.slice(-SAME_KIND_RUN);
    const blocked = run.length === SAME_KIND_RUN && run.every((k) => k === run[0]) ? run[0] : null;
    const entries = Object.entries(mix).filter(([k]) => k !== blocked);
    let sum = entries.reduce((a, [, w]) => a + w, 0), r = t.rand() * sum;
    for (const [k, w] of entries) { if ((r -= w) <= 0) return { type: k, back: false }; }
    return { type: entries[entries.length - 1][0], back: false };
  }

  // who: the townsperson bringing it (the store picks them as they walk up); else one not seen in the last few orders
  function next({ who: from = null } = {}) {
    const { type, back } = pickType();
    let o = null;
    const lastKey = s.recent[s.recent.length - 1];
    for (let tries = 0; tries < 30; tries++) {
      const who = from || t.pick(FOLK.filter((f) => !s.lastWho.includes(f.name)));
      const c = makeOrder(type, { rand: t.rand, step: s.step, who });
      o = c;
      // never the same story twice in a row; and not one of the last few, while there are others to tell
      if (c.key !== lastKey && (tries > 15 || !s.recent.includes(c.key))) break;
    }
    o.back = back;
    s.recent.push(o.key); if (s.recent.length > RECENT_KEEP) s.recent.splice(0, s.recent.length - RECENT_KEEP);
    s.kinds.push(type); if (s.kinds.length > 6) s.kinds.splice(0, s.kinds.length - 6);
    s.lastWho.push(o.who.name); if (s.lastWho.length > 5) s.lastWho.splice(0, s.lastWho.length - 5);
    s.n++;
    return o;
  }

  // a pick on an order. Only the first pick of an order moves the ladder. helped: the kid opened the picture before
  // this pick (peeking is free: a right pick then is paid the same, but doesn't count toward the climb)
  const done = new Set();
  function answer(order, coin, { helped = false } = {}) {
    const c = typeof coin === 'number' ? order.coins[coin] : coin;
    const right = !!(c && c.good);
    const first = !done.has(order.id);
    done.add(order.id);
    if (done.size > 50) done.delete(done.values().next().value);
    const out = { right, first, moved: 0, step: s.step, placed: false };
    if (!first) return out;
    const bt = (s.byType[order.type] = s.byType[order.type] || { n: 0, right: 0 });
    bt.n++; if (right) bt.right++;
    if (right) s.firsts++;
    if (order.step !== s.step) return out;   // (an order dealt before the step moved: it no longer moves it)
    if (!right) {
      if (!s.due.some((d) => d.type === order.type)) s.due.push({ type: order.type, at: s.n + t.int(COMEBACK_MIN, COMEBACK_MAX) - 1 });
      s.streak = 0;
      if (s.placing) {
        s.misses++;
        if (s.misses >= PLACEMENT_MISSES) {
          s.placing = false; out.placed = true;
          const to = Math.max(1, s.step - PLACE_BELOW);
          out.moved = to - s.step; s.step = to;
        }
      } else {
        const to = Math.max(1, s.step - MISS_DOWN);
        out.moved = to - s.step; s.step = to;
      }
    } else if (!helped) {
      if (s.placing) {
        if (s.step < LADDER.length) { s.step++; out.moved = 1; } else { s.placing = false; out.placed = true; }
      } else if (++s.streak >= CLEAN_TO_CLIMB) {
        s.streak = 0;
        if (s.step < LADDER.length) { s.step++; out.moved = 1; }
      }
    }
    out.step = s.step;
    return out;
  }

  function level() {
    const L = LADDER[s.step - 1];
    return { step: s.step, of: LADDER.length, label: L.label, placing: s.placing,
      line: `Step ${s.step} of ${LADDER.length}: ${L.label}${s.placing ? ' (still finding the right step)' : ''}` };
  }
  return { next, answer, level, state: s };
}

// ---- the hand-off to the lock box ----------------------------------------------------------------------------------------
// The equation the kid picked, as a lock-box problem on the two-steps rung (2x + 5 = 17), with 3 buttons to choose from.
export const EQ_RUNG = 'R6';
export function lockboxProblem(eq, { level = 3, tier = 'iron' } = {}) {
  if (!eq) return null;
  const L = [xt(eq.a), num(eq.b)], R = [num(eq.c)];
  if (checkProblem(EQ_RUNG, L, R, eq.x)) return null;
  const rung = RUNG[EQ_RUNG], start = line(L, R);
  const s = solve(start, rung.stage, { maxDepth: rung.maxPar });
  if (!Number.isFinite(s.d) || s.d > rung.maxPar || s.approx) return null;
  return { rung: EQ_RUNG, mode: 'moves', key: `${EQ_RUNG}:${lineText(start)}`, start, x: eq.x, kind: 'one', par: s.d,
    route: s.path.map(moveLabel), level, size: 2, review: false, tier };
}

// a count with its units ('1 pound', '12 pounds'), and an equation as printed ('3x + 5 = 29')
export { u as withUnit, eqText };
