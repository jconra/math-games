// FAIR SHARES AND LEFTOVERS: the math of "Loot the gang" (src/missions/loot.js). The gang's stolen goods have been
// found; brought back to town, they go home to the folks they were taken from, and the kid works out who gets what:
//   even      shared out evenly, nothing left over: 24 silver dollars taken from 4 families -> 6 each
//   rem       shares and a leftover: 23 silver dollars, 4 families -> 5 each, 3 left over (for the church box)
//   leftover  what to do with the leftover, as the story says: how many go in the church box (the leftover itself),
//             how many trips the mule makes (round up: the last few need a trip too), how many full boxes (round down)
//   rule      unequal shares by a rule: the gang took 3 times as much from the Pikes as from the Vegas; 24 dollars ->
//             the Pikes get 18 (3 parts of 4)
//   rule3     the same among three families (1, 2 and 3 parts)
// Each is its own kind of problem: the round-up's Dividing cards are bare sums; these are stories about real folk.
//
// Pick-a-coin on the store's own slip (src/ui/storeslip.js): 3 or 4 coins, one right. The wrong coins are the slips kids
// really make, each with one plain line why: multiplied instead of sharing (24 x 4 = 96 each: more than was stolen),
// took away (24 - 4), gave each family the number of families, one round too many or too few, forgot the leftover,
// stopped dealing while the leftover could still go round, gave the leftover to one family (not fair shares), answered
// each family's share when the church box was asked, rounded the wrong way, split evenly when the rule says otherwise,
// counted the parts wrong. After a wrong coin the slip shows its line and a picture of the sharing (picture() below):
// the families in a row with the first round dealt and the rest still in the pile, the trips or boxes with the last
// part-full one marked, the bar cut into each family's parts. The picture never shows the answer.
//
// The ladder (LADDER below) moves one problem at a time, on the first pick of each, as the store's word problems do:
//   - 3 right first time in a row move up a step; a wrong first pick moves down a step.
//   - On a kid's first visit the step climbs after every problem right first time; the second miss ends the climb (one
//     slip is forgiven) and the kid settles PLACE_BELOW steps below that step.
//   - A right pick after the kid asked for the picture is paid the same but doesn't count toward the climb.
//   - A kind that was missed comes back 2 to 4 problems later with new numbers.
// Everything it remembers lives in the plain object it is given (rider.topics.loot), saved with the rider.
//
//   const Q = makeShares(rider.topics.loot ||= {}, { rand })
//   Q.next({ avoid, among }) -> a share problem: { id, kind, step, key, story, ask, coins: [{ big, small, label, good, slip,
//                           why, v }], answer, goods, total, groups, owners: [family], each, left, pic, rightWhy, hand:
//                           [{ family, gets }], church }   (avoid: family names not to use; among: the trip's own families,
//                           taken first when there are enough)
//   Q.answer(problem, coin, { helped }) -> { right, first, moved, step, placed }
//   Q.level()            -> { step, of, label, placing, line }
//   picture(pic)         -> { svg, title, line }   the slip's drawing of the sharing (never the answer)
//   FAMILIES, GOODS, LADDER, seeded(seed)
// Pure: no page, no three.js (tests/shares.test.mjs).

import { FOLK } from './wordproblems.js';

export const CLEAN_TO_CLIMB = 3;     // problems right first time in a row to move up a step
export const MISS_DOWN = 1;          // steps down for a wrong first pick
export const PLACEMENT_MISSES = 2;   // the first-visit climb ends at this many misses (one slip is forgiven)
export const PLACE_BELOW = 1;        // ...and the kid settles this many steps below the step of that miss (as the store's)
export const COMEBACK_MIN = 2;       // a missed kind comes back this many problems later...
export const COMEBACK_MAX = 4;       // ...up to this many

// mix: how often each kind comes up on the step; size: how big the numbers get (1 small .. 3); coins: coins on a slip
export const LADDER = [
  { mix: { even: 1 }, size: 1, coins: 3, label: 'Fair shares, nothing left over (24 dollars, 4 families)' },
  { mix: { even: 1 }, size: 2, coins: 4, label: 'Fair shares with bigger numbers (56 sacks, 7 homesteads)' },
  { mix: { rem: 1.5, even: 0.5 }, size: 1, coins: 4, label: 'Shares and a leftover (23 dollars, 4 families: 5 each, 3 left)' },
  { mix: { rem: 1.3, even: 0.4 }, size: 2, coins: 4, label: 'Shares and a leftover, bigger numbers' },
  { mix: { leftover: 1.6, rem: 0.7 }, size: 2, coins: 4, label: 'What to do with the leftover (the church box, one more trip)' },
  { mix: { rule: 1.6, leftover: 0.5, rem: 0.4 }, size: 2, coins: 4, label: 'Shares by a rule (3 times as much for the Pikes)' },
  { mix: { rule3: 1.4, rule: 0.7, leftover: 0.4 }, size: 3, coins: 4, label: 'Shares by a rule among three families' },
];
export const KINDS = ['even', 'rem', 'leftover', 'rule', 'rule3'];
export const KIND_NAMES = { even: 'fair shares', rem: 'shares and a leftover', leftover: 'the leftover', rule: 'shares by a rule', rule3: 'shares by a rule' };

// the families the gang robbed: a name, and the one who comes to the sheriff's for their goods (a FOLK entry of the
// store's, so the same faces walk about the town)
const REPS = [
  ['the Pikes', 'Pike', 'Mr. Pike'], ['the Abernathys', 'Abernathy', 'Mrs. Abernathy'], ['the Collinses', 'Collins', 'Widow Collins'],
  ['the Ortegas', 'Ortega', 'Sam Ortega'], ['the Turners', 'Turner', 'Jed Turner'], ['the Vegas', 'Vega', 'Rosa Vega'],
  ['the Bells', 'Bell', 'Hattie Bell'], ['the Malones', 'Malone', 'Ike Malone'], ['the Harlans', 'Harlan', 'Doc Harlan'],
  ['the Dunns', 'Dunn', 'Clara Dunn'], ['the Okafors', 'Okafor', 'Mr. Okafor'], ['the Lindqvists', 'Lindqvist', 'Mrs. Lindqvist'],
];
export const FAMILIES = REPS.map(([name, short, rep]) => { const f = FOLK.find((x) => x.name === rep) || FOLK[0]; return { name, short, rep, she: !!f.she, look: f.look }; });
export const PARSON = (() => { const f = FOLK.find((x) => x.name === 'Pastor Briggs') || FOLK[0]; return { name: 'the church box', short: 'church', rep: f.name, she: false, look: f.look }; })();

// what the gang took: [many, one, money?, the short word on a coin]
export const GOODS = [
  ['silver dollars', 'silver dollar', true, 'dollars'], ['sacks of flour', 'sack of flour', false, 'sacks'], ['sacks of coffee', 'sack of coffee', false, 'sacks'],
  ['blankets', 'blanket', false, 'blankets'], ['cans of peaches', 'can of peaches', false, 'cans'], ['jars of honey', 'jar of honey', false, 'jars'],
  ['sacks of oats', 'sack of oats', false, 'sacks'], ['horseshoes', 'horseshoe', false, 'shoes'], ['bolts of cloth', 'bolt of cloth', false, 'bolts'],
];

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
  const int = (lo, hi) => (hi < lo ? lo : lo + Math.floor(rand() * (hi - lo + 1)));
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return { rand, int, pick, shuffle };
}
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const num = (n) => (n <= 12 ? WORDS[n] : String(n));
const many = (n, g) => `${n} ${n === 1 ? g[1] : g[0]}`;
const listOf = (names) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
// the families in a story: named when there are a few, else just counted (every family name is plural, so its
// possessive is a bare apostrophe: the Harlans' part)
const familiesOf = (owners) => (owners.length <= 4 ? `${num(owners.length)} families: ${listOf(owners.map((f) => f.name))}` : `${num(owners.length)} families`);

// ---- one problem -------------------------------------------------------------------------------------------------
// a coin: v (what it says, for "no repeats"), big and small (its two lines on the slip), label (read aloud), and for a
// wrong one its slip and why
const coin = (v, big, small, label, slip = null, why = '') => ({ v: String(v), big: String(big), small, label, good: !slip, slip, why });

function sizes(size, t) {
  // (families, and how many each): small numbers first
  // (at most 6 families: each sends someone to the sheriff's office for their goods)
  if (size === 1) return { g: t.int(2, 5), q: t.int(2, 6) };
  if (size === 2) return { g: t.int(3, 6), q: t.int(3, 9) };
  return { g: t.int(4, 6), q: t.int(4, 12) };
}

const MAKE = {
  even(t, step, size, fam) {
    let { g, q } = sizes(size, t); if (q === g) q++;
    const total = g * q, goods = t.pick(GOODS), owners = fam(g);
    const story = `The gang took ${many(total, goods)} from ${familiesOf(owners)}. Each family lost the same.`;
    const ask = `How many ${goods[0]} does each family get back?`;
    const right = coin(q, q, 'each', `${q} each`);
    const wrong = [
      coin(total - g, total - g, 'each', `${total - g} each`, 'sub', `${total} − ${g} = ${total - g} just takes ${num(g)} away. Sharing deals the ${total} out among the ${g} families.`),
      coin(total * g, total * g, 'each', `${total * g} each`, 'mult', `${total} × ${g} = ${total * g}: far more than the gang took! Sharing makes each share smaller.`),
      coin(g, g, 'each', `${g} each`, 'groups', `${g} is how many families there are. How many ${goods[0]} go to each one?`),
      coin(q + 1, q + 1, 'each', `${q + 1} each`, 'over', `${q + 1} each for ${g} families is ${(q + 1) * g}: more than the ${total} there are.`),
      coin(q - 1, q - 1, 'each', `${q - 1} each`, 'under', `${q - 1} each for ${g} families is only ${(q - 1) * g}: ${total - (q - 1) * g} would still be in the sack.`),
    ];
    return { key: `even:${total}:${g}`, goods, total, groups: g, owners, each: q, left: 0, story, ask, right, wrong,
      pic: { kind: 'deal', total, groups: g, names: owners.map((f) => f.short), goods: goods[0] },
      rightWhy: `${total} ÷ ${g} = ${q}: ${q} ${goods[0]} for each family.`, hand: owners.map((f) => ({ family: f, gets: q })), church: 0 };
  },
  rem(t, step, size, fam) {
    let { g, q } = sizes(size, t); const r = t.int(1, g - 1);
    if (q === r) q++;
    const total = g * q + r, goods = t.pick(GOODS), owners = fam(g);
    const story = `${many(total, goods)[0].toUpperCase() + many(total, goods).slice(1)} were taken from ${familiesOf(owners)}. They share them out fair, and whatever's left over goes in the church box.`;
    const ask = 'How many does each family get, and how many are left over?';
    const each = (n, left) => `each, ${left ? `${left} left` : 'none left'}`;
    const right = coin(`${q}/${r}`, q, each(q, r), `${q} each, ${r} left over`);
    const wrong = [
      coin(`${q}/0`, q, each(q, 0), `${q} each, none left`, 'noRem', `${q} each for ${g} families is ${q * g}, so ${total} − ${q * g} = ${r} ${r === 1 ? 'is' : 'are'} still left over. Don't forget the leftover.`),
      coin(`${q + 1}/0`, q + 1, each(q + 1, 0), `${q + 1} each, none left`, 'over', `${q + 1} each for ${g} families is ${(q + 1) * g}: more than the ${total} there are.`),
      ...(q >= 2 ? [coin(`${q - 1}/${r + g}`, q - 1, each(q - 1, r + g), `${q - 1} each, ${r + g} left over`, 'short', `${r + g} left over is enough to go round all ${g} families again. Keep dealing until fewer than ${g} are left.`)] : []),
      coin(`${r}/${q}`, r, each(r, q), `${r} each, ${q} left over`, 'swap', `That's swapped round: ${g} families with ${r} each is only ${r * g}.`),
      coin(`${total - g}/0`, total - g, each(total - g, 0), `${total - g} each`, 'sub', `${total} − ${g} = ${total - g} just takes ${num(g)} away. Deal the ${total} out among the families instead.`),
    ];
    return { key: `rem:${total}:${g}`, goods, total, groups: g, owners, each: q, left: r, story, ask, right, wrong,
      pic: { kind: 'deal', total, groups: g, names: owners.map((f) => f.short), goods: goods[0], church: true },
      rightWhy: `${g} × ${q} = ${g * q}, and ${total} − ${g * q} = ${r}: ${q} each, and ${r} for the church box.`,
      hand: owners.map((f) => ({ family: f, gets: q })), church: r };
  },
  leftover(t, step, size, fam) {
    const way = t.pick(['church', 'trips', 'boxes']);
    if (way === 'church') {
      const g = t.int(3, 6), q = t.int(2, 7), r = t.int(1, g - 1), total = g * q + r, goods = t.pick(GOODS.filter((x) => !x[2])), owners = fam(g);
      const story = `${many(total, goods)[0].toUpperCase() + many(total, goods).slice(1)} go back to ${num(g)} homesteads, the same whole number to each. Pastor Briggs gets whatever's left over for the church.`;
      const ask = `How many ${goods[0]} go to the church?`;
      const right = coin(r, r, 'to the church', `${r} to the church`);
      const wrong = [
        coin(q, q, 'to the church', `${q} to the church`, 'each', `${q} is what each homestead gets. The church gets what's left after that: ${total} − ${g} × ${q}.`),
        coin(0, 0, 'to the church', 'none to the church', 'noRem', `${g} × ${q} = ${g * q}, so ${total - g * q} ${total - g * q === 1 ? 'is' : 'are'} left over for the church.`),
        coin(r + g, r + g, 'to the church', `${r + g} to the church`, 'short', `${r + g} is enough to give every homestead one more first. The church gets what can't go round.`),
        coin(total - g, total - g, 'to the church', `${total - g} to the church`, 'sub', `That takes just ${g} away. Each homestead gets ${q}, and the church gets the rest.`),
      ];
      return { key: `church:${total}:${g}`, goods, total, groups: g, owners, each: q, left: r, story, ask, right, wrong,
        pic: { kind: 'deal', total, groups: g, names: owners.map((f) => f.short), goods: goods[0], church: true, ask: 'church' },
        rightWhy: `${g} × ${q} = ${g * q}, and ${total} − ${g * q} = ${r} left over for the church.`, hand: owners.map((f) => ({ family: f, gets: q })), church: r };
    }
    // (the picture draws one full load, a dashed gap for the rest and the last part-full one: 3 boxes. So there are 3
    // full trips at least (4 trips or more) and 4 full boxes at least: counting the boxes drawn never gives the answer)
    const owner = fam(1)[0], per = t.int(3, 8), full = t.int(way === 'boxes' ? 4 : 3, 6), r = t.int(1, per - 1), total = per * full + r;
    if (r === full || r === full + 1 || per === full || per === full + 1) return null;   // (the picture shows the leftover and a load's size: never the answer too)
    if (way === 'trips') {
      const goods = t.pick(GOODS.filter((x) => !x[2] && /^sacks|^blankets|^bolts/.test(x[0])));
      const story = `${owner.rep} is taking home the ${many(total, goods)} the gang took from ${owner.name}. The mule carries ${per} a trip.`;
      const ask = 'How many trips will the mule make?';
      const T = full + 1;
      const right = coin(T, T, 'trips', `${T} trips`);
      const wrong = [
        coin(full, full, 'trips', `${full} trips`, 'roundDown', `${full} trips carry ${full * per}: the last ${r} would still be waiting. They need a trip too.`),
        coin(r, r, 'trips', `${r} trips`, 'left', `${r} is how many are left after the full trips. Count the trips, part-full one too.`),
        coin(total - per, total - per, 'trips', `${total - per} trips`, 'sub', `${total} − ${per} takes one load away. How many loads of ${per} does it take to carry ${total}?`),
        coin(per, per, 'trips', `${per} trips`, 'groups', `${per} is how many go on each trip, not how many trips.`),
      ];
      return { key: `trips:${total}:${per}`, goods, total, groups: per, owners: [owner], each: T, left: r, story, ask, right, wrong,
        pic: { kind: 'loads', total, per, unit: 'trip', goods: goods[0], need: true },
        rightWhy: `${full} full trips carry ${full * per}, and the last ${r} need one more: ${T} trips.`, hand: [{ family: owner, gets: total }], church: 0 };
    }
    const goods = t.pick(GOODS.filter((x) => !x[2] && /horseshoes|cans|jars/.test(x[0])));
    const story = `${owner.rep} is packing the ${many(total, goods)} the gang took into boxes of ${per} to sell back at the store. Only full boxes go.`;
    const ask = 'How many full boxes can be packed?';
    const right = coin(full, full, 'full boxes', `${full} full boxes`);
    const wrong = [
      coin(full + 1, full + 1, 'full boxes', `${full + 1} full boxes`, 'roundUp', `The last box would only have ${r} in it: it isn't full. Count the full ones.`),
      coin(r, r, 'full boxes', `${r} full boxes`, 'left', `${r} is how many are left over after packing the full boxes.`),
      coin(total - per, total - per, 'full boxes', `${total - per} full boxes`, 'sub', `${total} − ${per} takes one box away. How many boxes of ${per} fit in ${total}?`),
      coin(per, per, 'full boxes', `${per} full boxes`, 'groups', `${per} is how many go in each box, not how many boxes.`),
    ];
    return { key: `boxes:${total}:${per}`, goods, total, groups: per, owners: [owner], each: full, left: r, story, ask, right, wrong,
      pic: { kind: 'loads', total, per, unit: 'box', goods: goods[0], need: false },
      rightWhy: `${full} boxes of ${per} hold ${full * per}; the ${r} left over don't fill a box.`, hand: [{ family: owner, gets: total }], church: 0 };
  },
  rule(t, step, size, fam) {
    const [a, b] = t.pick([[3, 1], [2, 1], [4, 1], [3, 2], [5, 1]]), per = t.int(2, size >= 3 ? 9 : 6), parts = a + b, total = parts * per;
    const owners = fam(2), [A, B] = owners, goods = t.pick(GOODS);
    const times = b === 1 ? `${a === 2 ? 'twice' : `${num(a)} times`} as much from ${A.name} as from ${B.name}` : `${num(a)} from ${A.name} for every ${num(b)} from ${B.name}`;
    const story = `The strongbox holds ${many(total, goods)}. The gang took ${times}. It all goes back.`;
    const askBig = t.rand() < 0.6, who = askBig ? A : B, gets = (askBig ? a : b) * per, other = (askBig ? b : a) * per;
    const ask = `How many ${goods[0]} go back to ${who.name}?`;
    if (gets === parts || other === parts) return null;   // (the picture shows how many parts: never the answer too)
    const right = coin(gets, gets, goods[3], `${gets} to ${who.name}`);
    const half = total / 2;
    const wrong = [
      ...(Number.isInteger(half) ? [coin(half, half, 'even split', `${half}, an even split`, 'even', `An even split isn't the rule: the gang took ${times}. Cut the ${total} into ${parts} equal parts first.`)] : []),
      coin(per, per, 'one part', `${per}, one part`, 'onePart', `${per} is one part of ${parts}. ${who.name[0].toUpperCase() + who.name.slice(1)} get${who.name.endsWith('s') ? '' : 's'} ${askBig ? a : b} part${(askBig ? a : b) > 1 ? 's' : ''}.`),
      ...(total % a === 0 && total / a !== gets ? [coin(total / a, total / a, 'parts?', `${total / a}`, 'parts', `${total} ÷ ${a} leaves out ${B.name}' part. Count every part: ${a} + ${b} = ${parts}.`)] : []),
      coin(other, other, 'the other', `${other}`, 'other', `${other} is what goes back to ${(askBig ? B : A).name}.`),
      coin(total - a, total - a, 'took away', `${total - a}`, 'sub', `${total} − ${a} takes ${num(a)} away. Cut the ${total} into ${parts} equal parts instead.`),
    ];
    return { key: `rule:${total}:${a}:${b}:${askBig}`, goods, total, groups: parts, owners, each: gets, left: 0, story, ask, right, wrong,
      pic: { kind: 'parts', total, rows: [{ name: A.short, parts: a }, { name: B.short, parts: b }], goods: goods[0], ask: who.short },
      rightWhy: `${a} + ${b} = ${parts} parts, ${total} ÷ ${parts} = ${per} a part, so ${who.name} get ${askBig ? a : b} × ${per} = ${gets}.`,
      hand: [{ family: A, gets: a * per }, { family: B, gets: b * per }], church: 0 };
  },
  rule3(t, step, size, fam) {
    const shares = t.pick([[1, 2, 3], [1, 1, 2], [2, 3, 1], [1, 2, 2], [3, 1, 2]]), per = t.int(2, 7), parts = shares[0] + shares[1] + shares[2], total = parts * per;
    const owners = fam(3), goods = t.pick(GOODS);
    const k = t.int(0, 2), who = owners[k], gets = shares[k] * per;
    const story = `Three families lost ${many(total, goods)} to the gang: for every ${num(shares[0])} the gang took from ${owners[0].name}, it took ${num(shares[1])} from ${owners[1].name} and ${num(shares[2])} from ${owners[2].name}.`;
    const ask = `How many go back to ${who.name}?`;
    if (gets === parts) return null;   // (the picture shows how many parts: never the answer too)
    const right = coin(gets, gets, goods[3], `${gets} to ${who.name}`);
    const third = total / 3, wrongParts = shares[k] * Math.round(total / 3);
    const wrong = [
      ...(Number.isInteger(third) ? [coin(third, third, 'even split', `${third}, an even split`, 'even', `An even three-way split isn't the rule. Cut the ${total} into ${parts} equal parts: ${shares.join(' + ')}.`)] : []),
      coin(per, per, 'one part', `${per}, one part`, 'onePart', `${per} is one part of ${parts}. ${who.name[0].toUpperCase() + who.name.slice(1)} get ${shares[k]} part${shares[k] > 1 ? 's' : ''}.`),
      ...(wrongParts < total ? [coin(wrongParts, wrongParts, 'parts?', `${wrongParts}`, 'parts', `There are ${parts} parts, not 3: ${shares.join(' + ')} = ${parts}. Cut the ${total} into ${parts} first.`)] : []),
      coin(total - shares[k], total - shares[k], 'took away', `${total - shares[k]}`, 'sub', `That takes ${num(shares[k])} away. Cut the ${total} into ${parts} equal parts instead.`),
    ];
    return { key: `rule3:${total}:${shares.join('-')}:${k}`, goods, total, groups: parts, owners, each: gets, left: 0, story, ask, right, wrong,
      pic: { kind: 'parts', total, rows: owners.map((f, i) => ({ name: f.short, parts: shares[i] })), goods: goods[0], ask: who.short },
      rightWhy: `${shares.join(' + ')} = ${parts} parts, ${total} ÷ ${parts} = ${per} a part, so ${who.name} get ${shares[k]} × ${per} = ${gets}.`,
      hand: owners.map((f, i) => ({ family: f, gets: shares[i] * per })), church: 0 };
  },
};

// A share problem of one kind at a step. avoid: family names not to use; among: the families to take them from first
// (a trip's own: the ones waiting at the sheriff's office), when there are enough of them. -> see the top
export function makeShare(kind, { rand = Math.random, step = 1, avoid = [], among = null } = {}) {
  const t = tools(rand), row = LADDER[Math.max(1, Math.min(LADDER.length, step)) - 1];
  const fam = (n) => {
    const mine = among ? FAMILIES.filter((f) => among.includes(f.name) && !avoid.includes(f.name)) : [];
    if (mine.length >= n) return t.shuffle(mine).slice(0, n);
    const free = FAMILIES.filter((f) => !avoid.includes(f.name));
    return t.shuffle([...(free.length >= n ? free : FAMILIES)]).slice(0, n);
  };
  for (let tries = 0; tries < 30; tries++) {
    const p = MAKE[kind](t, step, row.size, fam);
    if (!p) continue;
    // every coin of a problem has the same small words under its number (but the leftover ones, which say their own
    // leftover), so the words never tell the right coin from the wrong
    if (kind !== 'rem') for (const c of [p.right, ...p.wrong]) { c.small = p.right.small; c.label = `${c.big} ${c.small}`; }
    const vals = new Set([p.right.v]);
    // the wrong coins: no repeats, never the right one's words, never a nonsense number (0 each, a negative)
    const wrong = t.shuffle(p.wrong.filter((c) => {
      const n = Number(String(c.v).split('/')[0]);
      if (vals.has(c.v) || !(n >= 0) || (n === 0 && c.slip !== 'noRem')) return false;
      vals.add(c.v); return true;
    }));
    // the slips this kind is most about come first (the leftover forgotten, a round off, multiplied)
    const MAIN = { even: ['mult', 'over', 'under'], rem: ['noRem', 'short'], leftover: ['each', 'roundDown', 'roundUp', 'noRem'], rule: ['even', 'onePart'], rule3: ['even', 'onePart', 'parts'] }[kind];
    wrong.sort((a, b) => (MAIN.includes(b.slip) ? 1 : 0) - (MAIN.includes(a.slip) ? 1 : 0));
    const coins = t.shuffle([{ ...p.right }, ...wrong.slice(0, row.coins - 1)]);
    if (coins.length < Math.min(3, row.coins) || (coins.length < row.coins && tries < 25)) continue;   // (two slips came out the same: new numbers)
    return {
      id: Math.floor(rand() * 1e9).toString(36), kind, step, key: p.key, story: p.story, ask: p.ask, coins,
      answer: p.right.label, goods: { many: p.goods[0], one: p.goods[1], money: !!p.goods[2] }, total: p.total, groups: p.groups,
      owners: p.owners, each: p.each, left: p.left, pic: p.pic, rightWhy: p.rightWhy, hand: p.hand, church: p.church,
    };
  }
  throw new Error(`no ${kind} share could be made`);
}

// ---- the trainer ---------------------------------------------------------------------------------------------------
function fill(s) {
  const d = { v: 1, step: 1, placing: true, misses: 0, streak: 0, n: 0, firsts: 0, recent: [], kinds: [], due: [], byKind: {}, trips: 0 };
  for (const [k, v] of Object.entries(d)) if (s[k] === undefined || s[k] === null || typeof s[k] !== typeof v) s[k] = Array.isArray(v) ? [...v] : (v && typeof v === 'object' ? {} : v);
  for (const k of ['recent', 'kinds', 'due']) if (!Array.isArray(s[k])) s[k] = [];
  s.step = Math.max(1, Math.min(LADDER.length, Math.round(Number(s.step) || 1)));
  s.due = s.due.filter((x) => x && KINDS.includes(x.kind) && Number.isFinite(x.at));
  return s;
}

export function makeShares(state = {}, { rand = Math.random } = {}) {
  const s = fill(state);
  const t = tools(rand);
  function pickKind() {
    const di = s.due.findIndex((x) => x.at <= s.n);
    if (di >= 0) return s.due.splice(di, 1)[0].kind;
    const mix = LADDER[s.step - 1].mix;
    const run = s.kinds.slice(-2);
    const blocked = run.length === 2 && run[0] === run[1] && Object.keys(mix).length > 1 ? run[0] : null;
    const entries = Object.entries(mix).filter(([k]) => k !== blocked);
    let r = t.rand() * entries.reduce((a, [, w]) => a + w, 0);
    for (const [k, w] of entries) if ((r -= w) <= 0) return k;
    return entries[entries.length - 1][0];
  }
  function next({ avoid = [], among = null } = {}) {
    const kind = pickKind();
    let p = null;
    for (let tries = 0; tries < 20; tries++) { p = makeShare(kind, { rand: t.rand, step: s.step, avoid, among }); if (!s.recent.includes(p.key) || tries > 12) break; }
    s.recent.push(p.key); if (s.recent.length > 10) s.recent.splice(0, s.recent.length - 10);
    s.kinds.push(kind); if (s.kinds.length > 6) s.kinds.splice(0, s.kinds.length - 6);
    s.n++;
    return p;
  }
  const done = new Set();
  function answer(p, c, { helped = false } = {}) {
    c = typeof c === 'number' ? p.coins[c] : c;
    const right = !!(c && c.good), first = !done.has(p.id);
    done.add(p.id); if (done.size > 50) done.delete(done.values().next().value);
    const out = { right, first, moved: 0, step: s.step, placed: false };
    if (!first) return out;
    const bk = (s.byKind[p.kind] ||= { n: 0, right: 0 }); bk.n++; if (right) { bk.right++; s.firsts++; }
    if (p.step !== s.step) return out;
    if (!right) {
      if (!s.due.some((x) => x.kind === p.kind)) s.due.push({ kind: p.kind, at: s.n + t.int(COMEBACK_MIN, COMEBACK_MAX) - 1 });
      s.streak = 0;
      if (s.placing) {
        if (++s.misses >= PLACEMENT_MISSES) { s.placing = false; out.placed = true; const to = Math.max(1, s.step - PLACE_BELOW); out.moved = to - s.step; s.step = to; }
      } else { const to = Math.max(1, s.step - MISS_DOWN); out.moved = to - s.step; s.step = to; }
    } else if (!helped) {
      if (s.placing) { if (s.step < LADDER.length) { s.step++; out.moved = 1; } else { s.placing = false; out.placed = true; } }
      else if (++s.streak >= CLEAN_TO_CLIMB) { s.streak = 0; if (s.step < LADDER.length) { s.step++; out.moved = 1; } }
    }
    out.step = s.step;
    return out;
  }
  function level() {
    const L = LADDER[s.step - 1];
    return { step: s.step, of: LADDER.length, label: L.label, placing: s.placing,
      line: `Step ${s.step} of ${LADDER.length}: ${L.label}${s.placing ? ' (still finding the right step)' : ''}` };
  }
  function setStep(n) { s.step = Math.max(1, Math.min(LADDER.length, Math.round(n) || 1)); s.placing = false; s.streak = 0; }
  return { next, answer, level, setStep, state: s };
}
// the store's word-problem trainer goes by makeWordProblems; this one by makeShares (and makeLoot for the title's lookup)
export { makeShares as makeLoot };

// ---- the pictures (on the slip's parchment, like the store's: src/ui/storepics.js) ------------------------------------
const INK = '#2b2219', SOFT = '#8a7558', FILL = '#ead9b2', FILL2 = '#d9bf8a', BRASS = '#b47f2c', ASK = '#b5523a';
const W = 360;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const text = (x, y, s, { size = 13, fill = INK, anchor = 'middle', weight = 600 } = {}) =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="Bitter, Georgia, serif">${esc(s)}</text>`;
const svg = (h, body) => `<svg viewBox="0 0 ${W} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${body}</svg>`;
const box = (x0, x1, y, h, { fill = FILL, stroke = INK, dash = false } = {}) =>
  `<rect x="${x0.toFixed(1)}" y="${y}" width="${Math.max(2, x1 - x0).toFixed(1)}" height="${h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="1.4"${dash ? ' stroke-dasharray="4 3"' : ''}/>`;
const dot = (x, y, r = 3.6, fill = BRASS) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}"/>`;
const PIC_TITLES = { deal: 'Dealing it out', loads: 'Load by load', parts: 'Cut into parts' };

const DRAW = {
  // the families side by side, each with the first round dealt (one each), and the rest still in the pile; a church
  // box at the end when there will be a leftover
  deal(p) {
    const g = p.groups, x0 = 10, x1 = p.church ? W - 62 : W - 10, bw = (x1 - x0) / g;
    // the pile (what's still to deal: a heap of dots, at most 60 drawn), under words that count it the same way
    const pile = p.total - g, shown = Math.min(pile, 60);
    let s = text(10, 14, `${p.total} ${p.goods}: one each dealt, ${pile} still in the pile`, { size: 12, anchor: 'start', fill: SOFT, weight: 700 });
    for (let k = 0; k < shown; k++) s += dot(16 + (k % 30) * 11, 26 + Math.floor(k / 30) * 10, 3.4, '#c9a46a');
    if (pile > shown) s += text(16 + 30 * 11, 32, '…', { size: 14, fill: SOFT });
    const y = 54;
    for (let i = 0; i < g; i++) {
      const cx = x0 + bw * (i + 0.5);
      s += box(x0 + bw * i + 3, x0 + bw * (i + 1) - 3, y, 46);
      s += dot(cx, y + 14, 4.2);
      s += text(cx, y + 36, '?', { size: 15, fill: ASK, weight: 800 });
      s += text(cx, y + 60, p.names[i] || '', { size: g > 6 ? 9 : 11, fill: SOFT });
    }
    if (p.church) {
      // a little chapel: what can't go round again goes in its box
      const cx = W - 34;
      s += `<path d="M${cx - 20} ${y + 46}V${y + 18}L${cx} ${y + 4}L${cx + 20} ${y + 18}V${y + 46}Z" fill="${FILL2}" stroke="${INK}" stroke-width="1.3"/><path d="M${cx} ${y - 6}V${y + 6}M${cx - 4} ${y - 2}H${cx + 4}" stroke="${INK}" stroke-width="1.4"/>`;
      s += text(cx, y + 36, '?', { size: 15, fill: ASK, weight: 800 }) + text(cx, y + 60, 'church', { size: 11, fill: SOFT });
    }
    const line = p.church
      ? `Deal the ${p.total} out one at a time to each family, round and round. When there aren't enough to go round again, the rest go in the church box.`
      : `Deal the ${p.total} out one at a time to each family, round and round, until the pile is gone. Each family ends up with the same.`;
    return { svg: svg(y + 68, s), line };
  },
  // loads of `per`: the first full one drawn, the rest dashed, and the last part-full one marked. (One full load only:
  // with two drawn, counting the boxes gave the answer when there were two or three full loads)
  loads(p) {
    const per = p.per, total = p.total, full = Math.floor(total / per), left = total - full * per;
    const x0 = 10, x1 = W - 10, scale = (x1 - x0) / total;
    let s = box(x0, x1, 22, 26, { fill: FILL2 }) + text(W / 2, 40, `${total} ${p.goods}`, { size: 13 });
    const shown = Math.min(1, full);
    for (let i = 0; i < shown; i++) s += box(x0 + i * per * scale, x0 + (i + 1) * per * scale - 2, 62, 30) + text(x0 + (i + 0.5) * per * scale, 82, String(per), { size: 13 });
    const mid0 = x0 + shown * per * scale, lastX = x1 - left * scale;
    if (full > shown) s += box(mid0, lastX - 2, 62, 30, { fill: 'none', dash: true }) + text((mid0 + lastX) / 2, 82, `more ${p.unit === 'trip' ? 'trips' : 'boxes'} of ${per}…`, { size: 12, fill: SOFT });
    s += box(lastX, x1, 62, 30, { fill: '#f3c9b4', stroke: ASK });
    s += text(x1 - 2, 112, p.need ? `the last ${left}: they need a trip too` : `the last ${left}: not a full box`, { size: 12, anchor: 'end', fill: ASK, weight: 700 });
    const line = p.need ? `${per} go on each trip. The last few still have to get home, even though the mule isn't full.` : `Each box holds ${per}. A box with fewer in it isn't full, so it doesn't count.`;
    return { svg: svg(122, s), line };
  },
  // the whole bar cut into equal parts, each family's parts in its own row
  parts(p) {
    const n = p.rows.reduce((a, r) => a + r.parts, 0), x0 = 70, x1 = W - 10, pw = (x1 - x0) / n;
    let s = box(x0, x1, 10, 24, { fill: FILL2 }) + text((x0 + x1) / 2, 27, `${p.total} ${p.goods}`, { size: 13 });
    let at = 0, y = 46;
    for (const r of p.rows) {
      s += text(x0 - 8, y + 17, r.name, { size: 12, anchor: 'end', fill: r.name === p.ask ? ASK : SOFT, weight: 700 });
      for (let k = 0; k < r.parts; k++) s += box(x0 + (at + k) * pw + 1, x0 + (at + k + 1) * pw - 1, y, 24) + text(x0 + (at + k + 0.5) * pw, y + 17, '?', { size: 13, fill: ASK, weight: 800 });
      at += r.parts; y += 30;
    }
    s += text(W / 2, y + 12, `${n} equal parts in all`, { size: 12, fill: SOFT, weight: 700 });
    return { svg: svg(y + 20, s), line: `Cut the ${p.total} into ${n} equal parts (${p.rows.map((r) => r.parts).join(' + ')}). Each family gets its own number of parts.` };
  },
};

export function picture(pic) {
  const d = DRAW[pic && pic.kind];
  if (!d) return { svg: '', title: '', line: '' };
  const { svg: s, line } = d(pic);
  return { svg: s, title: PIC_TITLES[pic.kind] || '', line };
}
