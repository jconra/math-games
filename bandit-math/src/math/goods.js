// The homestead's animals and their goods, as numbers: what each animal costs, how many of each fit in the yard by the
// cabin, what they lay up over play time (eggs from the hens, wool from the sheep, milk from the cow; the pigs give
// nothing, they are just good company), collecting it into the saddlebags, the thank-you lamb or piglet from the farm
// jobs, and SELLING the goods at the general store counter as word problems. The yard itself (the coop, the pen, the
// corral and the animals walking about in them) is src/homestead.js.
//
// The goods only turn into gold through the math: they are laid up while the kid plays (never while the game is shut),
// a little at a time, collected by walking past the yard, and sold to the townsfolk at the store's counter, where each
// sale is an order slip like the others (src/missions/store.js): "You bring 30 eggs. Mrs. Abernathy pays 2 gold a
// dozen, whole dozens only..." and the kid picks the coin with the gold it comes to. The wrong coins are the real slips:
// paid for every egg instead of every dozen, stopped at the number of dozens, counted the leftover eggs as gold or as a
// dozen of their own, used 10 for a dozen (or 2 quarts for a gallon). Each has a one-line why and a picture: the eggs
// packed into cartons of a dozen with the leftover ones beside them, the quarts in gallon jugs, the wool in bundles.
//
// The sales are levelled to the kid by the store's own word-problem ladder (rider.topics.store's step, SALE_FORMS):
//   steps 1-2  lots      the amount is told in dozens / gallons / pounds: 3 dozen at 2 gold a dozen (equal groups)
//   steps 3-4  count     the amount is told in eggs / quarts, and it comes out even: 36 eggs, 2 gold a dozen
//   steps 5-6  leftover  whole dozens only, the rest stay in the saddlebags (dividing with a remainder); half-dozens
//   steps 7-9  unit      a price for a bigger lot: 12 gold for a 4-pound bale, the same for every pound (unit price);
//                        and gallons without being told a gallon is 4 quarts
//
// Everything is kept on the rider (saved with it, save.js keeps it tidy):
//   rider.owned.animals  [{ kind: 'hen'|'pig'|'sheep'|'cow', name, young?, age? }]   young: a lamb or a piglet given as a
//                        thank-you (smaller; it grows up after GROW seconds of play, counted in age)
//   rider.owned.goods    { eggs, wool, milk }   whole numbers in the saddlebags (eggs; pounds of wool; quarts of milk)
//   rider.owned.yard     { eggs, wool, milk }   laid up at the yard, waiting to be collected (parts of one included)
//
// Pure: no page, no three.js. tests/homestead.test.mjs checks it.

// ---- the animals ---------------------------------------------------------------------------------------------------
// price: gold (a ladder: a hen is cheap, a milk cow dear); most: how many fit in their home (the yard stays tidy);
// home: which pen they live in; goods: what they lay up, one unit every `every` seconds of play (grown ones only)
export const ANIMALS = {
  hen: { id: 'hen', name: 'Hen', many: 'hens', price: 15, most: 6, home: 'coop', goods: 'eggs', every: 100,
    line: 'Lays an egg every so often. Lives in a coop behind your cabin.' },
  pig: { id: 'pig', name: 'Pig', many: 'pigs', price: 35, most: 3, home: 'pen', goods: null,
    line: 'Lays nothing at all, but grunts happily in the mud. Pure company.' },
  sheep: { id: 'sheep', name: 'Sheep', many: 'sheep', price: 50, most: 3, home: 'corral', goods: 'wool', every: 260,
    line: 'Grows wool to sell by the pound. Lives in a little corral.' },
  cow: { id: 'cow', name: 'Milk cow', many: 'milk cows', price: 120, most: 2, home: 'corral', goods: 'milk', every: 80,
    line: 'Gives milk by the quart. Shares the corral with the sheep.' },
};
export const KINDS = ['hen', 'pig', 'sheep', 'cow'];
// names for an animal given as a thank-you (or bought without a name typed)
export const NAMES = {
  hen: ['Henrietta', 'Pip', 'Dottie', 'Nugget', 'Clucky', 'Ginger', 'Peaches', 'Biddy'],
  pig: ['Hamlet', 'Truffles', 'Wilbur', 'Penny', 'Porkchop', 'Rosie'],
  sheep: ['Clover', 'Woolly', 'Daisy', 'Fluff', 'Lamb Chop', 'Snowy'],
  cow: ['Bessie', 'Buttercup', 'Molly', 'Clementine', 'Rosebud'],
};

// ---- the goods ---------------------------------------------------------------------------------------------------
// unit: [one, many]; yard: the most that waits at the yard (it stops there till collected); bag: the most the saddlebags
// carry; short: how the HUD writes it
export const GOODS = {
  eggs: { id: 'eggs', unit: ['egg', 'eggs'], yard: 30, bag: 144, short: (n) => `${n} egg${n === 1 ? '' : 's'}` },
  wool: { id: 'wool', unit: ['pound of wool', 'pounds of wool'], yard: 10, bag: 40, short: (n) => `${n} lb wool` },
  milk: { id: 'milk', unit: ['quart of milk', 'quarts of milk'], yard: 16, bag: 48, short: (n) => `${n} qt milk` },
};
export const GOODS_IDS = ['eggs', 'wool', 'milk'];
export const GROW = 900;       // seconds of play a thank-you lamb or piglet takes to grow up (about a quarter of an hour)

// the thank-yous: finishing a whole job now and then (not every time) brings a young one, if there's room for it
export const GIFT = {
  chance: 0.35,
  from: { flockDone: 'sheep', pigsDone: 'pig' },   // a lamb after healing the flock, a piglet after penning the pigs
};

const whole = (v) => { v = Number(v); return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0; };
const amount = (v) => { v = Number(v); return Number.isFinite(v) && v > 0 ? v : 0; };
export const cleanName = (s) => String(s == null ? '' : s).replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, 12);

// ---- keeping the rider's records tidy ------------------------------------------------------------------------------
// a saved list of animals as the game can use it: known kinds, a name each, no more of a kind than fit
export function cleanAnimals(list) {
  const out = [], n = {};
  for (const a of Array.isArray(list) ? list : []) {
    if (!a || typeof a !== 'object' || !ANIMALS[a.kind]) continue;
    if ((n[a.kind] = (n[a.kind] || 0) + 1) > ANIMALS[a.kind].most) continue;
    // (the same record is kept, tidied, so the yard's animals stay matched to their records)
    a.name = cleanName(a.name) || NAMES[a.kind][(n[a.kind] - 1) % NAMES[a.kind].length];
    if (a.young) { a.young = true; a.age = Math.min(GROW, amount(a.age)); } else { delete a.young; delete a.age; }
    for (const k of Object.keys(a)) if (!['kind', 'name', 'young', 'age'].includes(k)) delete a[k];
    out.push(a);
  }
  return out;
}
// { eggs, wool, milk } from a saved one: whole numbers (bags) or amounts with parts (the yard), never below 0
export function cleanGoods(g, { parts = false } = {}) {
  const o = g && typeof g === 'object' ? g : {}, out = {};
  for (const k of GOODS_IDS) out[k] = parts ? Math.min(GOODS[k].yard, amount(o[k])) : Math.min(GOODS[k].bag, whole(o[k]));
  return out;
}
// the rider's homestead records, made tidy in place (and made when missing): -> rider.owned
// (tidied once, then only again when one of the three is replaced: this is asked every frame)
const tidied = new WeakMap();
export function homestead(rider) {
  const o = rider.owned && typeof rider.owned === 'object' ? rider.owned : (rider.owned = {});
  const t = tidied.get(o);
  if (t && t.animals === o.animals && t.goods === o.goods && t.yard === o.yard) return o;
  o.animals = cleanAnimals(o.animals);
  o.goods = cleanGoods(o.goods);
  o.yard = cleanGoods(o.yard, { parts: true });
  tidied.set(o, { animals: o.animals, goods: o.goods, yard: o.yard });
  return o;
}

export const animalsOf = (rider) => homestead(rider).animals;
export const countOf = (rider, kind) => animalsOf(rider).filter((a) => a.kind === kind).length;
export const hasRoom = (rider, kind) => !!ANIMALS[kind] && countOf(rider, kind) < ANIMALS[kind].most;
// a name not yet used by one of the rider's animals of that kind
export function freeName(rider, kind, rand = Math.random) {
  const used = new Set(animalsOf(rider).map((a) => a.name));
  const list = NAMES[kind] || ['Buddy'];
  const free = list.filter((n) => !used.has(n));
  return (free.length ? free : list)[Math.floor(rand() * (free.length || list.length))];
}

// buys one: spend(rider, gold) -> true when paid (save.js spend, which saves). -> 'bought' | 'short' | 'full' | 'unknown'
export function buyAnimal(rider, kind, name, spend) {
  const A = ANIMALS[kind]; if (!A) return 'unknown';
  if (!hasRoom(rider, kind)) return 'full';
  if (!spend(rider, A.price)) return 'short';
  animalsOf(rider).push({ kind, name: cleanName(name) || freeName(rider, kind) });
  return 'bought';
}
// a thank-you after a whole job (event: 'flockDone' | 'pigsDone'): now and then a lamb or a piglet, when there's room.
// -> the young animal added ({ kind, name, young }) or null. (Not saved here: the caller saves.)
export function thankYou(rider, event, rand = Math.random) {
  const kind = GIFT.from[event];
  if (!kind || !hasRoom(rider, kind) || rand() >= GIFT.chance) return null;
  const a = { kind, name: freeName(rider, kind, rand), young: true, age: 0 };
  animalsOf(rider).push(a);
  return a;
}

// time passes at the yard (dt seconds of play): the grown animals lay up their goods (up to what the yard holds) and the
// young ones grow. -> the names of any that grew up just now
export function lay(rider, dt) {
  const o = homestead(rider), grew = [];
  for (const a of o.animals) {
    if (a.young) { a.age = (a.age || 0) + dt; if (a.age >= GROW) { delete a.young; delete a.age; grew.push(a.name); } continue; }
    const A = ANIMALS[a.kind]; if (!A.goods) continue;
    o.yard[A.goods] = Math.min(GOODS[A.goods].yard, o.yard[A.goods] + dt / A.every);
  }
  return grew;
}
// what is waiting at the yard to be picked up: { eggs, wool, milk } whole units
export function waiting(rider) {
  const y = homestead(rider).yard, out = {};
  for (const k of GOODS_IDS) out[k] = Math.floor(y[k] + 1e-9);
  return out;
}
// walking past the yard: what is waiting goes into the saddlebags (as much as they carry). which: the goods to take
// (default all). -> { eggs, wool, milk } taken (null when nothing was)
export function collect(rider, which = GOODS_IDS) {
  const o = homestead(rider); let any = false; const got = {};
  for (const k of which) {
    const n = Math.min(Math.floor(o.yard[k] + 1e-9), GOODS[k].bag - o.goods[k]);
    if (n > 0) { o.yard[k] = Math.max(0, o.yard[k] - n); o.goods[k] += n; got[k] = n; any = true; }
  }
  return any ? got : null;
}
// a short list in words: '+6 eggs · +1 lb wool'
export const gotLine = (got) => GOODS_IDS.filter((k) => got && got[k]).map((k) => '+' + GOODS[k].short(got[k])).join(' · ');
// the saddlebags' goods for the HUD: '30 eggs · 4 lb wool · 6 qt milk to sell' ('' when there are none)
export function goodsLine(rider) {
  const g = homestead(rider).goods, parts = GOODS_IDS.filter((k) => g[k] > 0).map((k) => GOODS[k].short(g[k]));
  return parts.length ? `${parts.join(' · ')} to sell` : '';
}

// ---- selling at the store counter --------------------------------------------------------------------------------------
// which forms of sale each store step deals (the store's word-problem ladder, 1..9)
export const SALE_FORMS = [
  { upTo: 2, forms: ['lots'] },
  { upTo: 4, forms: ['count'] },
  { upTo: 6, forms: ['leftover', 'leftover', 'half'] },
  { upTo: 99, forms: ['unit', 'leftover'] },
];
export const SELL = {
  every: 3,         // a customer buys goods once in this many orders (the first sale of a ride: any of the first this many)
};
const formsFor = (step) => (SALE_FORMS.find((s) => step <= s.upTo) || SALE_FORMS[SALE_FORMS.length - 1]).forms;
const GOLD = ['gold', 'gold'];
const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
// a count of lots: '3 dozen' (never '3 dozens'), '2 gallons', '1 pound'
const lotN = (k, lot) => (lot[0] === 'dozen' ? `${k} dozen` : u(k, lot));
// how each of the goods is counted and sold: item (one unit), lot (what the store prices: a dozen, a gallon, a pound),
// per (items in a lot), half (the half-lot, where there is one), wrong (the slip for the lot's size: 10 for a dozen),
// shape (what the picture draws), price (gold a lot, to pick from), most (the most brought to one sale)
const SALE_GOODS = {
  eggs: { item: ['egg', 'eggs'], lot: ['dozen', 'dozens'], per: 12, price: [1, 2, 2, 3], most: 60, shape: 'egg', what: 'eggs',
    half: { lot: ['half-dozen', 'half-dozens'], per: 6, price: [1, 1, 2], wrong: { per: 12, why: 'That counts whole dozens. A half-dozen is 6 eggs, half of 12.' } },
    wrong: { per: 10, why: 'A dozen is 12 eggs, not 10.' }, tell: 'A dozen is 12.' },
  milk: { item: ['quart', 'quarts'], lot: ['gallon', 'gallons'], per: 4, price: [2, 3, 4], most: 30, shape: 'jar', what: 'milk',
    half: { lot: ['half-gallon', 'half-gallons'], per: 2, price: [1, 2], wrong: { per: 4, why: 'Four quarts make a whole gallon. A half-gallon is 2 quarts.' } },
    wrong: { per: 2, why: 'Two quarts is only half a gallon. A gallon is 4 quarts.' }, tell: '4 quarts make a gallon.' },
  wool: { item: ['pound', 'pounds'], lot: ['pound', 'pounds'], per: 1, price: [2, 3], most: 20, shape: 'fleece', what: 'wool',
    bundle: { per: [2, 3], price: [3, 4, 5] } },
};
// a wool bundle's size and price: never as many gold as pounds (3 gold for every 3 pounds is just a gold a pound: the
// gold would be the pounds again, with nothing to work out)
function woolBundle(G, pick) {
  const per = pick(G.bundle.per);
  return { per, lot: ['bundle', 'bundles'], price: pick(G.bundle.price.filter((p) => p > per)) };
}

// a sale order for the store counter, from what the rider carries, or null when there's nothing to sell at this step.
// carried: { eggs, wool, milk }; step: the store's ladder step; who: the townsperson buying ({ name, she })
// -> an order shaped as the store's (makeOrder in wordproblems.js), with .sale = { goods, sold, gold, left } and
//    .picture (its own pictures, below)
export function makeSale(carried, { step = 1, who = null, rand = Math.random, coins: count = null } = {}) {
  const forms = formsFor(step), n = count || (step <= 2 ? 3 : 4);
  const f = who || { name: 'A customer', she: false };
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const order = [...GOODS_IDS].sort(() => rand() - 0.5);
  for (let tries = 0; tries < 12; tries++) {
    const form = pick(forms);
    for (const g of order) {
      const core = saleCore(g, form, whole(carried && carried[g]), { rand, pick, step, f });
      if (!core) continue;
      const coins = coinsFor(core, n, rand);
      if (!coins) continue;
      return {
        id: Math.floor(rand() * 1e9).toString(36), type: 'sale', step, key: `sale:${g}:${form}`, who: f,
        story: core.story, ask: core.ask, coins, answer: coins.find((c) => c.good).label, unit: GOLD, cents: false,
        pic: core.pic, rightWhy: core.rightWhy, afterWhy: '', equation: null, picture,
        sale: { goods: g, sold: core.sold, gold: core.answer, left: whole(carried[g]) - core.sold, form },
      };
    }
  }
  return null;
}
// after a right answer: the goods sold come out of the saddlebags
export function sold(rider, order) {
  const s = order && order.sale; if (!s) return;
  const g = homestead(rider).goods;
  g[s.goods] = Math.max(0, g[s.goods] - s.sold);
}

function coinsFor(core, n, rand) {
  const face = (v) => ({ v, big: String(v), small: 'gold', label: `${v} gold` });
  const used = new Set([core.answer]), wrong = [];
  for (const s of core.slips) {
    if (wrong.length >= n - 1) break;
    if (!Number.isInteger(s.v) || s.v <= 0 || s.v > 999 || used.has(s.v)) continue;
    used.add(s.v); wrong.push({ ...face(s.v), good: false, slip: s.slip, why: s.why });
  }
  if (wrong.length < Math.min(n - 1, 2)) return null;
  const coins = [{ ...face(core.answer), good: true, slip: null, why: '' }, ...wrong];
  for (let i = coins.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [coins[i], coins[j]] = [coins[j], coins[i]]; }
  return coins;
}

// the numbers, words and slips of one sale: g the goods, form, c how many the rider carries
function saleCore(g, form, c, { rand, pick, step, f }) {
  const G = SALE_GOODS[g], They = f.she ? 'She' : 'He';
  const buys = `${f.name} wants to buy your ${G.what}.`;
  const ask = 'How much gold do you get?';
  if (form === 'half' && !G.half) return null;
  if (form === 'unit') return g === 'wool' ? unitWool(c, { rand, pick, f, G }) : g === 'eggs' ? unitEggs(c, { rand, pick, f, G }) : leftoverCore(g, c, { pick, f, G, tell: false });
  if (form === 'leftover' || form === 'half') return leftoverCore(g, c, { pick, f, G, half: form === 'half', tell: step < 7 });

  // lots and count: whole lots only (wool: by the pound in lots; in 2- or 3-pound bundles when counted)
  let per = G.per, lot = G.lot, price = pick(G.price);
  if (g === 'wool' && form === 'count') ({ per, lot, price } = woolBundle(G, pick));
  const kMax = per === 1 ? 9 : 6, k = Math.min(Math.floor(c / per), kMax);
  if (k < 2) return null;   // (one lot is just the price: nothing to work out)
  const nItems = k * per, ans = k * price;
  if (form === 'lots') {
    const amt = g === 'eggs' ? `${k} dozen eggs` : `${lotN(k, lot)} of ${G.what}`;
    return {
      story: `${buys} You bring ${amt}. ${They} pays ${price} gold a ${lot[0]}.`, ask,
      answer: ans, sold: nItems,
      slips: [
        { v: k + price, slip: 'added', why: `${k} + ${price} adds the ${lot[1]} to the gold. It's ${lotN(k, lot)} at ${price} gold each: ${k} groups of ${price}.` },
        { v: price, slip: 'one', why: `${price} gold is for just 1 ${lot[0]}. You bring ${k}.` },
        ...(per > 1 ? [{ v: nItems * price, slip: 'perItem', why: `That pays ${price} gold for every one of the ${nItems} ${G.item[1]}. The store pays ${price} gold a ${lot[0]}.` }] : []),
        { v: (k + 1) * price, slip: 'off', why: `That's ${k + 1} lots of ${price}. Count again: you bring ${k}.` },
        { v: (k - 1) * price, slip: 'off', why: `That's only ${k - 1} lots of ${price}. You bring ${k}.` },
      ],
      pic: { kind: 'lots', n: nItems, per, price, item: G.item, lot, shape: G.shape, given: 'lots' },
      rightWhy: `${lotN(k, lot)} × ${price} gold = ${ans} gold`,
    };
  }
  // count: told in items, it comes out even
  const tell = g === 'wool' ? '' : ` ${G.tell}`;
  const wp = g === 'wool' ? null : G.wrong;
  return {
    story: `${buys} You bring ${u(nItems, G.item)}${g === 'milk' ? ' of milk' : g === 'wool' ? ' of wool' : ''}.${tell} ${They} pays ${price} gold ${per > 1 && g === 'wool' ? `for every ${per} pounds` : `a ${lot[0]}`}.`, ask,
    answer: ans, sold: nItems,
    slips: [
      { v: nItems * price, slip: 'perItem', why: `${nItems} × ${price} pays ${price} gold for every ${G.item[0]}. First see how many ${lot[1]} ${nItems} ${G.item[1]} make.` },
      { v: k, slip: 'lotsOnly', why: `${k} is how many ${lot[1]} that makes. Each one pays ${price} gold.` },
      ...(wp ? [{ v: Math.floor(nItems / wp.per) * price, slip: 'wrongSize', why: wp.why }] : []),
      ...(nItems % price === 0 && price > 1 ? [{ v: nItems / price, slip: 'divided', why: `${nItems} ÷ ${price} splits the ${G.item[1]} by the price. Split them into ${lot[1]}, then pay ${price} gold for each.` }] : []),
      { v: k + price, slip: 'added', why: `${k} + ${price} adds them. It's ${k} ${lot[1]} at ${price} gold each.` },
    ],
    pic: { kind: 'lots', n: nItems, per, price, item: G.item, lot, shape: G.shape, given: 'items' },
    rightWhy: `${nItems} ${G.item[1]} ÷ ${per} = ${lotN(k, lot)}, and ${k} × ${price} gold = ${ans} gold`,
  };
}

// whole lots only, the rest stay in the saddlebags: 30 eggs at 2 gold a dozen -> 2 dozen, 4 gold, 6 eggs left
function leftoverCore(g, c, { pick, f, G, half = false, tell = true }) {
  const They = f.she ? 'She' : 'He';
  let per = G.per, lot = G.lot, price = pick(G.price), wp = G.wrong;
  if (half) { per = G.half.per; lot = G.half.lot; price = pick(G.half.price); wp = G.half.wrong; }
  if (g === 'wool') { ({ per, lot, price } = woolBundle(G, pick)); wp = null; }
  const n = Math.min(c, G.most), k = Math.floor(n / per), left = n - k * per;
  if (k < 2) return null;
  const ans = k * price;
  const leftWords = g === 'eggs' ? 'any eggs left over stay' : g === 'milk' ? 'what\'s left over stays' : 'any wool left over stays';
  const priced = g === 'wool' ? `for every ${per} pounds, whole bundles only` : `a ${lot[0]}${g === 'milk' && tell && !half ? ' (4 quarts)' : ''}, whole ${lot[1]} only`;
  const slips = [];
  if (left > 0) {
    slips.push({ v: (k + 1) * price, slip: 'roundedUp', why: `That pays for ${lotN(k + 1, lot)}, but ${u(n, G.item)} only fill ${k}. ${left === 1 ? 'The last one stays' : `The last ${left} stay`} in your saddlebags.` });
    slips.push({ v: ans + left, slip: 'leftoverAdded', why: `${ans} + ${left} counts the ${left} left over as gold. ${left === 1 ? 'It isn\'t sold: it stays' : 'They aren\'t sold: they stay'} in your saddlebags for next time.` });
  }
  if (wp) slips.push({ v: Math.floor(n / wp.per) * price, slip: 'wrongSize', why: wp.why });
  slips.push({ v: n * price, slip: 'perItem', why: `${n} × ${price} pays for every ${G.item[0]}. The store pays ${price} gold a ${lot[0]}: first see how many whole ${lot[1]} there are.` });
  slips.push({ v: k, slip: 'lotsOnly', why: `${k} is how many ${lot[1]} there are. Each one pays ${price} gold.` });
  return {
    story: `${f.name} wants to buy your ${G.what}. You bring ${u(n, G.item)}${g === 'milk' ? ' of milk' : g === 'wool' ? ' of wool' : ''}. ${They} pays ${price} gold ${priced}; ${leftWords} in your saddlebags.`,
    ask: 'How much gold do you get?', answer: ans, sold: k * per, slips,
    pic: { kind: 'lots', n, per, price, item: G.item, lot, shape: G.shape, given: 'items', leftover: true },
    rightWhy: left > 0
      ? `${u(n, G.item)} make ${lotN(k, lot)} with ${left} left over: ${k} × ${price} = ${ans} gold. The ${u(left, G.item)} left over ${left === 1 ? 'stays' : 'stay'} in your saddlebags.`
      : `${u(n, G.item)} make ${lotN(k, lot)} exactly: ${k} × ${price} = ${ans} gold`,
  };
}

// a price for a bigger lot: 12 gold for a 4-pound bale, the same for every pound; you bring 5 pounds -> 15 gold
function unitWool(c, { pick, f, G }) {
  const They = f.she ? 'She' : 'He';
  const m = pick([2, 3, 4, 5]), q = pick([2, 3]), P = m * q, n = Math.min(c, 12);
  if (n < 2 || n === m) return null;
  const ans = n * q;
  return {
    story: `${f.name} wants to buy your wool. ${They} pays ${P} gold for a ${m}-pound bale, and the same for every pound of it. You bring ${n} pounds of wool.`,
    ask: 'How much gold do you get?', answer: ans, sold: n,
    slips: [
      { v: n * P, slip: 'bigLot', why: `${P} gold is for a whole ${m}-pound bale, not for each pound. One pound fetches ${P} ÷ ${m}.` },
      { v: P, slip: 'oneBale', why: `${P} gold is what ${m} pounds fetch. You bring ${n} pounds.` },
      { v: q, slip: 'one', why: `${q} gold is one pound's worth. You bring ${n} pounds.` },
      { v: P + n, slip: 'added', why: `${P} + ${n} adds the gold to the pounds. Find a pound's price first.` },
    ],
    pic: { kind: 'unit', big: m, bigGold: P, n, item: ['pound', 'pounds'] },
    rightWhy: `${P} gold ÷ ${m} pounds = ${q} gold a pound, and ${n} × ${q} = ${ans} gold`,
  };
}
// eggs priced by the 2 or 3 dozen: 6 gold for 2 dozen, the same for every dozen; you bring 40 eggs -> 3 dozen, 9 gold
function unitEggs(c, { pick, f, G }) {
  const They = f.she ? 'She' : 'He';
  const m = pick([2, 3]), q = pick([1, 2, 3]), P = m * q, n = Math.min(c, G.most), k = Math.floor(n / 12), left = n - k * 12;
  // (two dozen at least: with one, the sale is just "one dozen's price" and the picture would all but say it)
  if (k < 2 || k === m) return null;
  const ans = k * q;
  return {
    story: `${f.name} wants to buy your eggs. ${They} pays ${P} gold for ${m} dozen, the same for every dozen, whole dozens only. You bring ${n} eggs; any left over stay in your saddlebags.`,
    ask: 'How much gold do you get?', answer: ans, sold: k * 12,
    slips: [
      { v: k * P, slip: 'bigLot', why: `${P} gold is for ${m} dozen, not for each one. One dozen fetches ${P} ÷ ${m}.` },
      { v: P, slip: 'oneLot', why: `${P} gold is what ${m} dozen fetch. Count your dozens: ${n} eggs.` },
      ...(left > 0 ? [{ v: (k + 1) * q, slip: 'roundedUp', why: `That pays for ${k + 1} dozen, but ${n} eggs fill only ${k}. ${left === 1 ? 'The last one stays' : `The last ${left} stay`} in your saddlebags.` }] : []),
      { v: Math.floor(n / 10) * q, slip: 'wrongSize', why: 'A dozen is 12 eggs, not 10.' },
      { v: k, slip: 'lotsOnly', why: `${k} is how many dozens there are. Each one fetches ${P} ÷ ${m} gold.` },
    ],
    pic: { kind: 'lots', n, per: 12, price: null, priceText: `${P} ÷ ${m}`, item: G.item, lot: G.lot, shape: 'egg', given: 'items', leftover: true },
    rightWhy: `${P} gold ÷ ${m} = ${q} gold a dozen; ${n} eggs make ${k} dozen${left ? ` (${left} left over)` : ''}, and ${k} × ${q} = ${ans} gold`,
  };
}

// ---- the pictures (a wrong coin, or "Draw it for me") -------------------------------------------------------------------
// The same look as the store's (src/ui/storepics.js): ink on the parchment, a "?" where the answer goes, never the answer.
//   lots   the goods packed into their lots (cartons of a dozen eggs, gallon jugs of quarts, bundles of wool), each lot
//          labelled with what it pays, the ones left over beside them ("stay in your bags")
//   unit   a little table: the big lot and its gold, one pound (?), what you bring (?)
const INK = '#2b2219', SOFT = '#8a7558', FILL = '#ead9b2', FILL2 = '#d9bf8a', ASK = '#b5523a', EGG = '#f4ead4', MILK = '#f7f4ec', WOOL = '#efe8da';
const PW = 360;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const text = (x, y, s, { size = 13, fill = INK, anchor = 'middle', weight = 600 } = {}) =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="Bitter, Georgia, serif">${esc(s)}</text>`;
const svgOf = (h, body) => `<svg viewBox="0 0 ${PW} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${body}</svg>`;
// one of the goods, drawn small at (x, y)
function thing(shape, x, y, s = 1) {
  if (shape === 'egg') return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(3.6 * s).toFixed(1)}" ry="${(4.6 * s).toFixed(1)}" fill="${EGG}" stroke="${INK}" stroke-width="0.9"/>`;
  if (shape === 'jar') return `<rect x="${(x - 4 * s).toFixed(1)}" y="${(y - 6 * s).toFixed(1)}" width="${(8 * s).toFixed(1)}" height="${(12 * s).toFixed(1)}" rx="2" fill="${MILK}" stroke="${INK}" stroke-width="0.9"/><rect x="${(x - 2.4 * s).toFixed(1)}" y="${(y - 8 * s).toFixed(1)}" width="${(4.8 * s).toFixed(1)}" height="${(2.4 * s).toFixed(1)}" fill="${SOFT}"/>`;
  return `<circle cx="${(x - 3 * s).toFixed(1)}" cy="${y.toFixed(1)}" r="${(4 * s).toFixed(1)}" fill="${WOOL}" stroke="${INK}" stroke-width="0.8"/><circle cx="${(x + 3 * s).toFixed(1)}" cy="${y.toFixed(1)}" r="${(4 * s).toFixed(1)}" fill="${WOOL}" stroke="${INK}" stroke-width="0.8"/><circle cx="${x.toFixed(1)}" cy="${(y - 3 * s).toFixed(1)}" r="${(4 * s).toFixed(1)}" fill="${WOOL}" stroke="${INK}" stroke-width="0.8"/>`;
}
const PICS = {
  lots(p) {
    const k = Math.floor(p.n / p.per), left = p.n - k * p.per, lotOne = p.lot[0];
    const pays = p.price != null ? `${p.price} gold` : `${p.priceText} gold`;
    const line = p.given === 'lots'
      ? `${lotN(k, p.lot)}, ${pays} for each: ${Array(Math.min(k, 6)).fill(p.price != null ? p.price : '…').join(' + ')}${k > 6 ? ' + …' : ''} = ? gold`
      : `${u(p.n, p.item)} packed ${p.per === 1 ? 'one by one' : `${p.per} to a ${lotOne}`}: every full ${lotOne} pays ${pays}${left ? `; the ${left} left over ${left === 1 ? 'stays' : 'stay'} in your saddlebags` : ''}. How much gold?`;
    // the lots as boxes of goods, drawn one by one while they fit (shrunk a little if need be), else a bar cut into lots
    const cols = p.per <= 4 ? p.per : p.per <= 6 ? 3 : 6, rows = Math.ceil(p.per / cols);
    const boxW = Math.max(40, cols * 11 + 8), boxH = rows * 13 + 8, gap = 8;
    const leftW = left ? Math.min(left, 6) * 11 + 12 : 0, total = k * (boxW + gap) - gap + (left ? leftW + 16 : 0);
    let s = '', h;
    if (p.per <= 12 && total <= 500) {
      const scale = Math.min(1.25, (PW - 20) / Math.max(1, total)), x0 = (PW - total * scale) / 2, top = 12;
      const X = (bx) => x0 + bx * scale;   // (a point in the boxes' own drawing, across the picture)
      let inner = '';
      for (let i = 0; i < k; i++) {
        const bx = i * (boxW + gap), pad = (boxW - (cols * 11 + 8)) / 2;
        inner += `<rect x="${bx}" y="0" width="${boxW}" height="${boxH}" rx="4" fill="${FILL}" stroke="${INK}" stroke-width="1.2"/>`;
        for (let j = 0; j < p.per; j++) inner += thing(p.shape, bx + pad + 9.5 + (j % cols) * 11, 10.5 + Math.floor(j / cols) * 13);
      }
      let lx = 0;
      if (left) {
        lx = k * (boxW + gap) - gap + 16;
        inner += `<rect x="${lx}" y="0" width="${leftW}" height="${Math.ceil(left / 6) * 13 + 8}" rx="4" fill="none" stroke="${ASK}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
        for (let j = 0; j < left; j++) inner += thing(p.shape, lx + 11.5 + (j % 6) * 11, 10.5 + Math.floor(j / 6) * 13);
      }
      s = `<g transform="translate(${x0.toFixed(1)} ${top}) scale(${scale.toFixed(3)})">${inner}</g>`;
      // (the words are drawn at their own size, under each box)
      const by = top + Math.max(boxH, left ? Math.ceil(left / 6) * 13 + 8 : 0) * scale;
      const fit = boxW * scale + gap * scale > 46;   // (room for "2 gold" under every box; else it is said once)
      if (fit) for (let i = 0; i < k; i++) s += text(X(i * (boxW + gap) + boxW / 2), by + 15, pays, { size: 11, fill: SOFT });
      else s += text(10, by + 15, `each ${lotOne}: ${pays}`, { size: 11, anchor: 'start', fill: SOFT });
      if (left) s += text(Math.min(PW - 4, X(lx + leftW)), by + 31, `the ${u(left, p.item)} left over ${left === 1 ? 'stays' : 'stay'} in your bags`, { size: 11, anchor: 'end', fill: ASK, weight: 700 });
      h = by + (left ? 58 : 42);
    } else {
      const x0 = 10, x1 = PW - 10, sc = (x1 - x0) / p.n;
      s += `<rect x="${x0}" y="20" width="${x1 - x0}" height="24" rx="3" fill="${FILL2}" stroke="${INK}" stroke-width="1.2"/>` + text((x0 + x1) / 2, 37, `${u(p.n, p.item)}`, { size: 13 });
      const shown = Math.min(k, 3);
      for (let i = 0; i < shown; i++) s += `<rect x="${(x0 + i * p.per * sc).toFixed(1)}" y="54" width="${(p.per * sc - 2).toFixed(1)}" height="26" rx="3" fill="${FILL}" stroke="${INK}" stroke-width="1.2"/>` + text(x0 + (i + 0.5) * p.per * sc, 71, `1 ${lotOne}`, { size: 12 });
      const lastX = x1 - left * sc, mid0 = x0 + shown * p.per * sc;
      if (k > shown) s += `<rect x="${mid0.toFixed(1)}" y="54" width="${Math.max(2, lastX - mid0 - 2).toFixed(1)}" height="26" rx="3" fill="none" stroke="${INK}" stroke-width="1.2" stroke-dasharray="4 3"/>` + text((mid0 + lastX) / 2, 71, `more ${p.lot[1]}…`, { size: 11, fill: SOFT });
      if (left) s += `<rect x="${lastX.toFixed(1)}" y="54" width="${Math.max(2, left * sc).toFixed(1)}" height="26" rx="3" fill="#f3c9b4" stroke="${ASK}" stroke-width="1.2"/>` + text(x1, 98, `the ${left} left over ${left === 1 ? 'stays' : 'stay'} in your bags`, { size: 11, anchor: 'end', fill: ASK, weight: 700 });
      s += text(x0, left ? 118 : 98, `each ${lotOne}: ${pays}`, { size: 11, anchor: 'start', fill: SOFT });
      h = 128;
    }
    s += text(PW - 12, h - 6, 'in all: ? gold', { size: 14, anchor: 'end', fill: ASK, weight: 800 });
    return { svg: svgOf(h, s), line };
  },
  unit(p) {
    const rows = [[`${p.big} pounds`, `${p.bigGold} gold`, false], ['1 pound', '?', true], [`${p.n} pounds`, '?', true]];
    let s = '';
    rows.forEach(([a, b, ask], i) => {
      const y = 14 + i * 34;
      s += `<rect x="60" y="${y}" width="110" height="26" rx="3" fill="${FILL}" stroke="${INK}" stroke-width="1.2"/>` + text(115, y + 18, a);
      s += `<rect x="200" y="${y}" width="100" height="26" rx="3" fill="${ask ? 'none' : FILL2}" stroke="${ask ? ASK : INK}" stroke-width="1.2"${ask ? ' stroke-dasharray="4 3"' : ''}/>` + text(250, y + 18, b, ask ? { fill: ASK, weight: 800, size: 16 } : {});
    });
    s += text(28, 48 + 6, `÷ ${p.big}`, { size: 12, fill: SOFT }) + text(28, 82 + 6, `× ${p.n}`, { size: 12, fill: SOFT });
    s += `<path d="M44 30 Q36 44 44 58 M44 64 Q36 78 44 92" fill="none" stroke="${SOFT}" stroke-width="1.2"/>`;
    return { svg: svgOf(116, s), line: `${p.big} pounds fetch ${p.bigGold} gold. Find what 1 pound fetches, then ${p.n} pounds.` };
  },
};
const PIC_TITLES = { lots: 'Packed into lots', unit: 'One pound first' };
export function picture(pic) {
  const d = PICS[pic && pic.kind];
  if (!d) return { svg: '', title: '', line: '' };
  const { svg, line } = d(pic);
  return { svg, title: PIC_TITLES[pic.kind], line };
}
