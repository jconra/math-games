// TREATS FOR THE HORSES: apples picked off the wild apple trees (by the homestead and along the creek), and apples and
// carrots bought by the bag at the general store, carried in the saddlebags (up to TREATS.most, the two together) and fed
// to any horse: the rider's own, the pen's, the stable's stall horses, the donkey. A horse fed lowers its head and
// munches, and a heart floats up from it (two from the donkey for a carrot: he likes those best).
//
// THE BOND, a reward only: each horse the rider owns fills up to BOND.hearts hearts over time, a heart every
// BOND.perHeart feeds, and only BOND.perDay feeds a day count toward it (a kid who empties the saddlebags into one horse
// still sees the hearts float up; the bond grows again tomorrow). The hearts show in the stable's "Your horses" list.
// At full hearts the horse nickers when the rider walks up, and comes faster to the whistle. There is no hunger and no
// penalty, ever: hearts never go down.
//
// THE STORE'S BAGS are a small money question, like the store's other buying (src/shop.js asks it): how much gold for
// so many bags, or (once the rider's Money level is past making change, or for one bag) the change from a coin. A wrong
// pick only shows a line that helps; the bags are bought when the right coin is picked.
//
// In the save (rider.treats, src/save.js fixRider runs cleanTreats; an old save starts with none):
//   { apple, carrot,                      treats in the saddlebags
//     trees: { treeId: { day, left } },   apples left on a tree on that game day (a later day: the tree is full again)
//     bond: { horseId: { n, day, today } } }   feeds counted toward the hearts, and how many counted on that game day
// The game day is src/shifts.js today(rider): it goes up at each sunrise in the game.
//
// Plain data and plain functions: no page, no three.js (tests/treats.test.mjs).
//   TREATS, BOND, TREAT_KINDS, TREAT_NAMES, treatWord(kind, n)
//   cleanTreats(v), treatsOf(rider), countOf(rider), roomOf(rider), haveOf(rider, kind)
//   addTreats(rider, kind, n) -> how many went in;  takeTreat(rider, kind) -> true if one was taken out
//   whichTreat(rider, { donkey }) -> 'apple' | 'carrot' | null   the treat a feed gives (the donkey's carrot first)
//   applesLeft(rider, treeId, day), pickApples(rider, treeId, day) -> { picked, left, full }
//   bondOf(rider, horseId) -> { n, hearts, half, full }, heartsLine(hearts, half)
//   feedHorse(rider, { horseId, owned, donkey, kind, day }) -> { hearts (to float up), counted, before, after, full, plenty }
//   treatQuestion({ kind, bags, level, rand }) -> { kind, bags, cost, paid, form, ask, answer, choices, help }
//   answerLine(q, pick) -> the line for a wrong pick

export const TREATS = {
  most: 10,                          // treats the saddlebags hold, apples and carrots together
  bag: { apple: 3, carrot: 3 },      // treats in one of the store's bags
  price: { apple: 2, carrot: 3 },    // gold for a bag
  bagsMost: 3,                       // bags bought at one go
  perTree: 4,                        // apples a tree gives a day (they grow back the next morning in the game)
};
export const BOND = {
  hearts: 5,                         // the most hearts a horse fills
  perHeart: 2,                       // feeds that count toward one heart
  perDay: 3,                         // feeds a day that count, each horse
};
export const TREAT_KINDS = ['apple', 'carrot'];
export const TREAT_NAMES = { apple: ['apple', 'apples'], carrot: ['carrot', 'carrots'] };
export const treatWord = (kind, n) => `${n} ${(TREAT_NAMES[kind] || ['treat', 'treats'])[n === 1 ? 0 : 1]}`;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const whole = (v, most = Infinity) => { const n = Math.floor(+v); return Number.isFinite(n) && n > 0 ? Math.min(n, most) : 0; };

// a rider's treats made safe: counts whole and within the saddlebags, trees and bonds well formed (an old save: none)
export function cleanTreats(v) {
  const o = isObj(v) ? v : {};
  const apple = whole(o.apple, TREATS.most), carrot = whole(o.carrot, TREATS.most - apple);
  const trees = {}, bond = {};
  for (const [id, t] of Object.entries(isObj(o.trees) ? o.trees : {})) if (id && isObj(t)) trees[id] = { day: whole(t.day), left: whole(t.left, TREATS.perTree) };
  for (const [id, b] of Object.entries(isObj(o.bond) ? o.bond : {})) if (id && isObj(b)) bond[id] = { n: whole(b.n, BOND.hearts * BOND.perHeart), day: whole(b.day), today: whole(b.today, BOND.perDay) };
  return { ...o, apple, carrot, trees, bond };
}
export function treatsOf(rider) {
  if (!rider) return cleanTreats(null);
  const t = rider.treats;
  if (!isObj(t) || !isObj(t.trees) || !isObj(t.bond) || !Number.isFinite(t.apple) || !Number.isFinite(t.carrot)) rider.treats = cleanTreats(t);
  return rider.treats;
}
export const countOf = (rider) => { const t = treatsOf(rider); return t.apple + t.carrot; };
export const roomOf = (rider) => Math.max(0, TREATS.most - countOf(rider));
export const haveOf = (rider, kind) => (TREAT_KINDS.includes(kind) ? treatsOf(rider)[kind] : 0);

export function addTreats(rider, kind, n) {
  if (!TREAT_KINDS.includes(kind)) return 0;
  const k = Math.min(whole(n), roomOf(rider));
  treatsOf(rider)[kind] += k;
  return k;
}
export function takeTreat(rider, kind) {
  const t = treatsOf(rider);
  if (!TREAT_KINDS.includes(kind) || t[kind] < 1) return false;
  t[kind]--;
  return true;
}
// the treat a feed gives: the donkey gets a carrot when there is one (his favourite), every other horse an apple first
export function whichTreat(rider, { donkey = false } = {}) {
  const t = treatsOf(rider), order = donkey ? ['carrot', 'apple'] : ['apple', 'carrot'];
  return order.find((k) => t[k] > 0) || null;
}

// ── THE APPLE TREES ─────────────────────────────────────────────────────────────────────────────────────────────────
// apples left on a tree today: a tree not picked today is full
export function applesLeft(rider, treeId, day) {
  const r = treatsOf(rider).trees[treeId];
  return r && r.day >= day ? r.left : TREATS.perTree;
}
// pick what the saddlebags have room for; the rest stays on the tree till it is picked again (or the next morning)
export function pickApples(rider, treeId, day) {
  const left = applesLeft(rider, treeId, day), picked = Math.min(left, roomOf(rider));
  if (picked > 0) { treatsOf(rider).apple += picked; treatsOf(rider).trees[treeId] = { day, left: left - picked }; }
  return { picked, left: left - picked, full: picked < left && roomOf(rider) === 0, none: left === 0 };
}

// ── THE BOND ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function bondOf(rider, horseId) {
  const b = horseId ? treatsOf(rider).bond[horseId] : null, n = b ? b.n : 0;
  const hearts = Math.min(BOND.hearts, Math.floor(n / BOND.perHeart));
  return { n, hearts, half: hearts < BOND.hearts && n % BOND.perHeart > 0, full: hearts >= BOND.hearts };
}
// a horse fed. owned: one of the rider's own (only those fill hearts); donkey: the donkey (two hearts float up for a
// carrot); day: the game day (src/shifts.js today). Returns how many hearts float up, whether the feed counted toward
// the bond, the hearts before and after, full (all hearts filled) and plenty (fed past today's count: the hearts grow
// again tomorrow)
export function feedHorse(rider, { horseId = null, owned = false, donkey = false, kind = 'apple', day = 0 } = {}) {
  const float = donkey && kind === 'carrot' ? 2 : 1;
  if (!owned || !horseId) return { hearts: float, counted: false, before: 0, after: 0, full: false, plenty: false };
  const bonds = treatsOf(rider).bond, before = bondOf(rider, horseId);
  const b = bonds[horseId] || (bonds[horseId] = { n: 0, day, today: 0 });
  if (b.day !== day) { b.day = day; b.today = 0; }
  const room = b.n < BOND.hearts * BOND.perHeart, counted = room && b.today < BOND.perDay;
  if (counted) { b.n++; b.today++; }
  const after = bondOf(rider, horseId);
  return { hearts: float, counted, before: before.hearts, after: after.hearts, full: after.full, plenty: room && !counted };
}
// the hearts as text ('♥♥♥♡♡'): for the rigs and a screen reader
export const heartsLine = (hearts, half = false) => Array.from({ length: BOND.hearts }, (x, i) => (i < hearts ? '♥' : i === hearts && half ? '❥' : '♡')).join('');

// ── THE STORE'S MONEY QUESTION ─────────────────────────────────────────────────────────────────────────────────────
// level: the rider's Money level (src/math/skill.js levelOf(rider, 'money'), 0..100: 10 counting coins, 20 adding
// prices, 30 change from a dollar). Below MAKE_CHANGE, and for two or three bags, "how much gold for them all" (a
// sum of the same price, or a times fact); from there, or for one bag, the change from a coin a little over the cost.
export const MAKE_CHANGE = 30;
const PAY_WITH = [5, 10, 20];
export function treatQuestion({ kind = 'apple', bags = 1, level = 0, rand = Math.random } = {}) {
  const price = TREATS.price[kind] || 2, n = Math.max(1, Math.min(TREATS.bagsMost, Math.round(bags) || 1)), cost = price * n;
  const word = (TREAT_NAMES[kind] || TREAT_NAMES.apple)[1], bagsW = n === 1 ? 'a bag' : `${n} bags`;
  const change = n === 1 || level >= MAKE_CHANGE;
  let q;
  if (!change) {
    const answer = cost;
    q = { form: 'cost', paid: null, answer, ask: `${n} bags of ${word} at ${price} gold a bag. How much gold?`,
      help: `Add a bag's price for each bag: ${Array(n).fill(price).join(' + ')}`,
      wrong: [price, n + price, cost + price, cost - 1, cost + 1] };
  } else {
    const coins = PAY_WITH.filter((c) => c > cost), far = level >= 50 && coins.length > 1;
    const paid = far ? coins[Math.min(coins.length - 1, Math.floor(rand() * coins.length))] : coins[0];
    const answer = paid - cost;
    q = { form: 'change', paid, answer, ask: `${n === 1 ? `A bag of ${word} is ${price} gold` : `${n} bags of ${word} at ${price} gold a bag`}. You pay with ${paid} gold. How much change?`,
      help: n === 1 ? `Count up from ${cost} to ${paid}` : `The bags come to ${Array(n).fill(price).join(' + ')}; then count up from that to ${paid}`,
      wrong: [cost, paid, paid - price, answer + 1, answer - 1, answer + price] };
  }
  // four coins: the answer and three of the real slips (one bag only, the numbers added, the cost for the change...),
  // never a repeat, never below nothing
  const choices = [q.answer];
  for (const w of q.wrong) if (choices.length < 4 && w >= 0 && !choices.includes(w)) choices.push(w);
  for (let k = 1; choices.length < 4; k++) if (!choices.includes(q.answer + k)) choices.push(q.answer + k);
  choices.sort((a, b) => a - b);
  return { kind, bags: n, price, cost, paid: q.paid, form: q.form, ask: q.ask, answer: q.answer, choices, help: q.help };
}
// the line for a wrong pick: what that number is, kindly, and the helper's way to it
export function answerLine(q, pick) {
  if (pick === q.answer) return '';
  if (q.form === 'cost') {
    if (pick === q.price) return `That's one bag. There are ${q.bags} bags. ${q.help}.`;
    if (pick === q.bags + q.price) return `That adds the bags to the price. ${q.help}.`;
    return `Not quite. ${q.help}.`;
  }
  if (pick === q.cost) return `That's what the bags cost. The change is what comes back from ${q.paid}. ${q.help}.`;
  if (pick === q.paid) return `That's the coin you paid with. ${q.help}.`;
  return `Not quite. ${q.help}.`;
}
