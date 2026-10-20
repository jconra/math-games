// The homestead's animals and their goods, as numbers: what each animal costs, how many of each fit in the yard by the
// cabin, which kinds the store will sell yet, what they lay up over play time (eggs from the hens, wool from the sheep,
// milk from the cow; the pigs give nothing, they are just good company), collecting it into the saddlebags, the
// thank-you piglet, lamb or calf from the jobs, and SELLING the goods at the general store counter as word problems. The
// yard itself (the coop, the pen, the corral and the animals walking about in them) is src/homestead.js.
//
// Hens can be bought from the start. Pigs, sheep and milk cows are a reward: the store sells a kind only once the rider
// has earned a young one of it as a thank-you from that kind's job (a piglet for penning a whole batch of pigs, a lamb
// for healing a whole flock, a calf for roping a whole wave at the round-up). The first one of each kind comes for sure
// by GIFT.sure whole jobs (sooner by luck), so earning it is a goal the kid can see coming, not a lucky draw. A rider who
// already owns one of a kind (an older save) has that kind unlocked.
//
// The goods only turn into gold through the math: they are laid up while the kid plays (never while the game is shut),
// a little at a time, collected by walking past the yard, and sold to the townsfolk at the store's counter, where each
// sale is an order slip like the others (src/missions/store.js) and the kid picks the coin with the answer. Each of the
// goods has its own kind of problem:
//   eggs and milk  by the dozen / the gallon: "You bring 30 eggs. Mrs. Abernathy pays 2 gold a dozen, whole dozens
//                  only..." The wrong coins are the real slips: paid for every egg instead of every dozen, stopped at the
//                  number of dozens, counted the leftover eggs as gold, used 10 for a dozen (or 2 quarts for a gallon).
//                  The picture: the eggs packed into cartons of a dozen with the leftover ones beside them, quarts in jugs.
//   wool           FRACTIONS: "You bring 12 pounds of wool. Mrs. Reed buys 3/4 of it. How many pounds does she take?"
//                  The wrong coins: divided by the top number instead of the bottom, took the whole lot, took the part
//                  she leaves, stopped at one part, forgot the price. The picture: the wool as a bale cut into equal
//                  parts with the bought parts shaded (never the answer).
//
// The sales are levelled to the kid by the store's own word-problem ladder (rider.topics.store's step):
//   eggs and milk (SALE_FORMS)
//     steps 1-2  lots      the amount is told in dozens / gallons: 3 dozen at 2 gold a dozen (equal groups)
//     steps 3-4  count     the amount is told in eggs / quarts, and it comes out even: 36 eggs, 2 gold a dozen
//     steps 5-6  leftover  whole dozens only, the rest stay in the saddlebags (dividing with a remainder); half-dozens
//     steps 7-9  unit      a price for a bigger lot: 6 gold for 2 dozen, the same for every dozen (unit price);
//                          and gallons without being told a gallon is 4 quarts
//   wool (WOOL.forms)
//     steps 1-2  unit      one part of an easy whole: 1/2 of 8, 1/3 of 9, 1/4 of 12 (how many pounds)
//     steps 3-4  part      more than one part: 3/4 of 12, 2/5 of 10 (how many pounds)
//     steps 5-6  priced    a share at a price a pound: 2/3 of 12 pounds at 2 gold a pound (how much gold)
//     steps 7-9  two       two buyers' shares of one bale: how many pounds in all, how many more one takes, how many are
//                          left (halves with quarters, thirds with sixths: the picture cuts the bale into the smaller parts)
//                          (and now and then a priced share again)
//   Every answer is a whole number.
//
// Everything is kept on the rider (saved with it, save.js keeps it tidy):
//   rider.owned.animals  [{ kind: 'hen'|'pig'|'sheep'|'cow', name, young?, age? }]   young: a piglet, a lamb or a calf
//                        given as a thank-you (smaller; it grows up after GROW seconds of play, counted in age)
//   rider.owned.goods    { eggs, wool, milk }   whole numbers in the saddlebags (eggs; pounds of wool; quarts of milk)
//   rider.owned.yard     { eggs, wool, milk }   laid up at the yard, waiting to be collected (parts of one included)
//   rider.owned.farm     { unlocked: ['pig', ...], jobs: { pig, sheep, cow } }   the kinds the store sells this rider
//                        (besides hens), and how many whole jobs of each kind were done while that kind was still locked
//
// Pure: no page, no three.js. tests/homestead.test.mjs checks it.

import { PRICES } from '../catalog.js';

// ---- the animals ---------------------------------------------------------------------------------------------------
// price: gold (src/catalog.js PRICES.animal: a ladder, a hen is cheap, a milk cow dear); most: how many fit in their
// home (the yard stays tidy); home: which pen they live in; goods: what they lay up, one unit every `every` seconds
// of play (grown ones only)
export const ANIMALS = {
  hen: { id: 'hen', name: 'Hen', many: 'hens', price: PRICES.animal.hen, most: 6, home: 'coop', goods: 'eggs', every: 100,
    line: 'Lays an egg every so often. Lives in a coop behind your cabin.' },
  pig: { id: 'pig', name: 'Pig', many: 'pigs', price: PRICES.animal.pig, most: 3, home: 'pen', goods: null,
    line: 'Lays nothing at all, but grunts happily in the mud. Pure company.' },
  sheep: { id: 'sheep', name: 'Sheep', many: 'sheep', price: PRICES.animal.sheep, most: 3, home: 'corral', goods: 'wool', every: 260,
    line: 'Grows wool. Townsfolk buy a share of it: a half, a third, three quarters. Lives in a little corral.' },
  cow: { id: 'cow', name: 'Milk cow', many: 'milk cows', price: PRICES.animal.cow, most: 2, home: 'corral', goods: 'milk', every: 80,
    line: 'Gives milk by the quart. Shares the corral with the sheep.' },
};
export const KINDS = ['hen', 'pig', 'sheep', 'cow'];
// the young one of each kind (the thank-yous), and the one line a locked kind shows at the store: what earns it
export const YOUNG = { hen: 'chick', pig: 'piglet', sheep: 'lamb', cow: 'calf' };
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

// the thank-yous: finishing a whole job now and then (not every time) brings a young one, if there's room for it. The
// first one of each kind (the one that unlocks the kind at the store) comes for sure by the `sure`th whole job.
export const GIFT = {
  chance: 0.35,
  // (a round-up wave is quicker than a flock or a batch of pigs, and a cow is the dearest animal: calves come rarer)
  chanceOf: { cow: 0.15 },
  // a piglet after penning the pigs, a lamb after healing the flock, a calf after roping a whole wave of cattle
  from: { flockDone: 'sheep', pigsDone: 'pig', waveDone: 'cow' },
  sure: { pig: 2, sheep: 2, cow: 3 },
};
const chanceOf = (kind) => (GIFT.chanceOf[kind] != null ? GIFT.chanceOf[kind] : GIFT.chance);
// what earns each locked kind, in words: [the job done once, the job done n times]
const EARN = {
  pig: ['Pen a whole batch of pigs at the farm', (n) => `Pen ${n} whole batches of pigs at the farm`],
  sheep: ['Heal a whole flock of sick sheep at the farm', (n) => `Heal ${n} whole flocks of sick sheep at the farm`],
  cow: ['Rope a whole wave at the round-up', (n) => `Rope ${n} whole waves at the round-up`],
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
  if (t && t.animals === o.animals && t.goods === o.goods && t.yard === o.yard && t.farm === o.farm) return o;
  o.animals = cleanAnimals(o.animals);
  o.goods = cleanGoods(o.goods);
  o.yard = cleanGoods(o.yard, { parts: true });
  o.farm = cleanFarm(o.farm, o.animals);
  tidied.set(o, { animals: o.animals, goods: o.goods, yard: o.yard, farm: o.farm });
  return o;
}
// the kinds unlocked and the whole jobs counted, from a saved one (made when missing). A kind the rider owns counts as
// unlocked (an older save that bought pigs before kinds were locked keeps them buyable).
export function cleanFarm(f, animals = []) {
  const o = f && typeof f === 'object' && !Array.isArray(f) ? f : {};
  const jobs = o.jobs && typeof o.jobs === 'object' ? o.jobs : {};
  const unlocked = new Set((Array.isArray(o.unlocked) ? o.unlocked : []).filter((k) => GIFT.sure[k]));
  for (const a of Array.isArray(animals) ? animals : []) if (a && GIFT.sure[a.kind]) unlocked.add(a.kind);
  const out = { unlocked: KINDS.filter((k) => unlocked.has(k)), jobs: {} };
  for (const k of Object.keys(GIFT.sure)) out.jobs[k] = whole(jobs[k]);
  return out;
}

export const animalsOf = (rider) => homestead(rider).animals;
export const countOf = (rider, kind) => animalsOf(rider).filter((a) => a.kind === kind).length;
export const hasRoom = (rider, kind) => !!ANIMALS[kind] && countOf(rider, kind) < ANIMALS[kind].most;
// can the store sell this kind to the rider yet? (hens always; the others once one of that kind was earned)
export const unlocked = (rider, kind) => kind === 'hen' || (!!ANIMALS[kind] && (homestead(rider).farm.unlocked.includes(kind) || countOf(rider, kind) > 0));
// the one line a locked kind shows at the store: 'Pen 2 whole batches of pigs at the farm to earn your first piglet (1 done).'
export function earnLine(rider, kind) {
  const E = EARN[kind]; if (!E || unlocked(rider, kind)) return '';
  const n = GIFT.sure[kind], done = Math.min(n - 1, homestead(rider).farm.jobs[kind] || 0);
  return `${n > 1 ? E[1](n) : E[0]} to earn your first ${YOUNG[kind]}${done ? ` (${done} done)` : ''}. Then the store sells ${ANIMALS[kind].many}.`;
}
// a name not yet used by one of the rider's animals of that kind
export function freeName(rider, kind, rand = Math.random) {
  const used = new Set(animalsOf(rider).map((a) => a.name));
  const list = NAMES[kind] || ['Buddy'];
  const free = list.filter((n) => !used.has(n));
  return (free.length ? free : list)[Math.floor(rand() * (free.length || list.length))];
}

// buys one: spend(rider, gold) -> true when paid (save.js spend, which saves).
// -> 'bought' | 'short' | 'full' | 'locked' | 'unknown'
export function buyAnimal(rider, kind, name, spend) {
  const A = ANIMALS[kind]; if (!A) return 'unknown';
  if (!unlocked(rider, kind)) return 'locked';
  if (!hasRoom(rider, kind)) return 'full';
  if (!spend(rider, A.price)) return 'short';
  animalsOf(rider).push({ kind, name: cleanName(name) || freeName(rider, kind) });
  return 'bought';
}
// a thank-you after a whole job (event: 'flockDone' | 'pigsDone' | 'waveDone'): now and then a lamb, a piglet or a calf,
// when there's room. While the kind is still locked the whole job is counted, and the GIFT.sure'th one brings it for
// sure. -> a copy of the young animal added ({ kind, name, young, age, unlocked: true when it unlocked its kind at the
// store }) or null. (Not saved here: the caller saves.)
export function thankYou(rider, event, rand = Math.random) {
  const kind = GIFT.from[event];
  if (!kind) return null;
  const farm = homestead(rider).farm, first = !unlocked(rider, kind);
  if (first) farm.jobs[kind] = (farm.jobs[kind] || 0) + 1;
  if (!hasRoom(rider, kind)) return null;
  const sure = first && farm.jobs[kind] >= GIFT.sure[kind];
  if (!sure && rand() >= chanceOf(kind)) return null;
  const a = { kind, name: freeName(rider, kind, rand), young: true, age: 0 };
  animalsOf(rider).push(a);
  if (first) farm.unlocked = KINDS.filter((k) => k === kind || farm.unlocked.includes(k));
  return { ...a, unlocked: first };
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
// which forms of egg and milk sale each store step deals (the store's word-problem ladder, 1..9)
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
// what else an egg or milk sale counts in (src/math/skill.js), by its form: lots of a dozen at a price is times; the
// rest is dividing into dozens or gallons (with a leftover from 'leftover' on)
const SALE_CREDIT = {
  lots: { strand: 'mul', at: 20, weight: 0.5 }, count: { strand: 'div', at: 37, weight: 0.5 },
  leftover: { strand: 'div', at: 45, weight: 0.5 }, half: { strand: 'div', at: 45, weight: 0.5 }, unit: { strand: 'div', at: 41, weight: 0.5 },
};
const GOLD = ['gold', 'gold'];
const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
// a count of lots: '3 dozen' (never '3 dozens'), '2 gallons', '1 pound'
const lotN = (k, lot) => (lot[0] === 'dozen' ? `${k} dozen` : u(k, lot));
// how eggs and milk are counted and sold (wool sells as fractions: WOOL below): item (one unit), lot (what the store
// prices: a dozen, a gallon),
// per (items in a lot), half (the half-lot, where there is one), wrong (the slip for the lot's size: 10 for a dozen),
// shape (what the picture draws), price (gold a lot, to pick from), most (the most brought to one sale)
const SALE_GOODS = {
  eggs: { item: ['egg', 'eggs'], lot: ['dozen', 'dozens'], per: 12, price: [1, 2, 2, 3], most: 60, shape: 'egg', what: 'eggs',
    half: { lot: ['half-dozen', 'half-dozens'], per: 6, price: [1, 1, 2], wrong: { per: 12, why: 'That counts whole dozens. A half-dozen is 6 eggs, half of 12.' } },
    wrong: { per: 10, why: 'A dozen is 12 eggs, not 10.' }, tell: 'A dozen is 12.' },
  milk: { item: ['quart', 'quarts'], lot: ['gallon', 'gallons'], per: 4, price: [2, 3, 4], most: 30, shape: 'jar', what: 'milk',
    half: { lot: ['half-gallon', 'half-gallons'], per: 2, price: [1, 2], wrong: { per: 4, why: 'Four quarts make a whole gallon. A half-gallon is 2 quarts.' } },
    wrong: { per: 2, why: 'Two quarts is only half a gallon. A gallon is 4 quarts.' }, tell: '4 quarts make a gallon.' },
};

// a sale order for the store counter, from what the rider carries, or null when there's nothing to sell at this step.
// carried: { eggs, wool, milk }; who: the townsperson buying ({ name, she }); step: the store's ladder step, or (on
// the strands) a plan: { step, sales, salesAt, wool, woolAt } with the form each kind of sale is made in (sales: an
// id of the map `sales`: lots | count | leftover | unit; wool: an id of the map `wool`: unit | part | priced | two),
// chosen by src/math/skill.js stepFor; a kind whose form is null isn't sold (the rider isn't up to it yet)
// -> an order shaped as the store's (makeOrder in wordproblems.js), with .sale = { goods, sold, gold, left, form,
//    map ('sales' | 'wool'), at (the plan's point for it, or null) }, .credit (what else it counts in) and .picture
//    (its own pictures, below)
export function makeSale(carried, { step = 1, who = null, rand = Math.random, coins: count = null } = {}) {
  const plan = step && typeof step === 'object' ? step : null;
  const st = plan ? Math.max(1, Math.round(plan.step) || 1) : step;
  const forms = plan ? (plan.sales === 'leftover' ? ['leftover', 'leftover', 'half'] : plan.sales ? [plan.sales] : null) : formsFor(st);
  const wforms = plan ? (plan.wool === 'two' ? ['two', 'two', 'priced'] : plan.wool ? [plan.wool] : null) : woolForms(st);
  const n = count || (st <= 2 ? 3 : 4);
  const f = who || { name: 'A customer', she: false };
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const order = [...GOODS_IDS].sort(() => rand() - 0.5).filter((g) => (g === 'wool' ? wforms : forms));
  if (!order.length) return null;
  for (let tries = 0; tries < 12; tries++) {
    const form = forms ? pick(forms) : null, wform = wforms ? pick(wforms) : null;
    for (const g of order) {
      const core = g === 'wool' ? woolCore(wform, whole(carried && carried[g]), { pick, f })
        : saleCore(g, form, whole(carried && carried[g]), { rand, pick, step: st, f });
      if (!core) continue;
      const coins = coinsFor(core, n, rand);
      if (!coins) continue;
      const fm = g === 'wool' ? wform : form;
      return {
        id: Math.floor(rand() * 1e9).toString(36), type: 'sale', step: st, key: `sale:${g}:${fm}`, who: f,
        story: core.story, ask: core.ask, read: `${core.story} ${core.ask}`, coins, answer: coins.find((c) => c.good).label, unit: core.unit || GOLD, cents: false,
        pic: core.pic, rightWhy: core.rightWhy, afterWhy: '', equation: null, picture,
        sale: { goods: g, sold: core.sold, gold: core.gold != null ? core.gold : core.answer, left: whole(carried[g]) - core.sold, form: fm,
          map: g === 'wool' ? 'wool' : 'sales', at: plan ? (g === 'wool' ? plan.woolAt : plan.salesAt) ?? null : null },
        // (eggs and milk: by the dozen is times, counting out dozens is dividing; wool counts in Fractions itself)
        credit: g === 'wool' ? [] : [SALE_CREDIT[fm] || SALE_CREDIT.leftover].map((c) => ({ ...c })), size: 1,
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
  // (gold, or pounds when a wool sale asks how many pounds)
  const face = core.unit ? (v) => ({ v, big: String(v), small: 'lb', label: `${v} lb` }) : (v) => ({ v, big: String(v), small: 'gold', label: `${v} gold` });
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
  if (form === 'unit') return g === 'eggs' ? unitEggs(c, { rand, pick, f, G }) : leftoverCore(g, c, { pick, f, G, tell: false });
  if (form === 'leftover' || form === 'half') return leftoverCore(g, c, { pick, f, G, half: form === 'half', tell: step < 7 });

  // lots and count: whole lots only
  const per = G.per, lot = G.lot, price = pick(G.price);
  const kMax = 6, k = Math.min(Math.floor(c / per), kMax);
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
  const tell = ` ${G.tell}`, wp = G.wrong;
  return {
    story: `${buys} You bring ${u(nItems, G.item)}${g === 'milk' ? ' of milk' : ''}.${tell} ${They} pays ${price} gold a ${lot[0]}.`, ask,
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
  const n = Math.min(c, G.most), k = Math.floor(n / per), left = n - k * per;
  if (k < 2) return null;
  const ans = k * price;
  const leftWords = g === 'eggs' ? 'any eggs left over stay' : 'what\'s left over stays';
  const priced = `a ${lot[0]}${g === 'milk' && tell && !half ? ' (4 quarts)' : ''}, whole ${lot[1]} only`;
  const slips = [];
  if (left > 0) {
    slips.push({ v: (k + 1) * price, slip: 'roundedUp', why: `That pays for ${lotN(k + 1, lot)}, but ${u(n, G.item)} only fill ${k}. ${left === 1 ? 'The last one stays' : `The last ${left} stay`} in your saddlebags.` });
    slips.push({ v: ans + left, slip: 'leftoverAdded', why: `${ans} + ${left} counts the ${left} left over as gold. ${left === 1 ? 'It isn\'t sold: it stays' : 'They aren\'t sold: they stay'} in your saddlebags for next time.` });
  }
  if (wp) slips.push({ v: Math.floor(n / wp.per) * price, slip: 'wrongSize', why: wp.why });
  slips.push({ v: n * price, slip: 'perItem', why: `${n} × ${price} pays for every ${G.item[0]}. The store pays ${price} gold a ${lot[0]}: first see how many whole ${lot[1]} there are.` });
  slips.push({ v: k, slip: 'lotsOnly', why: `${k} is how many ${lot[1]} there are. Each one pays ${price} gold.` });
  return {
    story: `${f.name} wants to buy your ${G.what}. You bring ${u(n, G.item)}${g === 'milk' ? ' of milk' : ''}. ${They} pays ${price} gold ${priced}; ${leftWords} in your saddlebags.`,
    ask: 'How much gold do you get?', answer: ans, sold: k * per, slips,
    pic: { kind: 'lots', n, per, price, item: G.item, lot, shape: G.shape, given: 'items', leftover: true },
    rightWhy: left > 0
      ? `${u(n, G.item)} make ${lotN(k, lot)} with ${left} left over: ${k} × ${price} = ${ans} gold. The ${u(left, G.item)} left over ${left === 1 ? 'stays' : 'stay'} in your saddlebags.`
      : `${u(n, G.item)} make ${lotN(k, lot)} exactly: ${k} × ${price} = ${ans} gold`,
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

// ---- wool, sold as fractions ----------------------------------------------------------------------------------------
// A townsperson buys a share of the wool you bring: "You bring 12 pounds of wool. Mrs. Reed buys 3/4 of it. How many
// pounds does she take?" The wool is paid for at a price a pound either way (said in the right answer's line when the
// question is only about pounds), so the gold always comes from the share.
export const WOOL = {
  // which kind of share each store step deals (the store's word-problem ladder, 1..9)
  forms: [
    { upTo: 2, forms: ['unit'] },             // one part of an easy whole: 1/2 of 8, 1/3 of 9, 1/4 of 12
    { upTo: 4, forms: ['part'] },             // more than one part: 3/4 of 12, 2/5 of 10
    { upTo: 6, forms: ['priced'] },           // a share at a price a pound: how much gold
    { upTo: 99, forms: ['two', 'two', 'priced'] },   // two buyers' shares of one bale (in all, how many more, how many left)
  ],
  price: 2,            // gold a pound when the question asks only for pounds
  prices: [2, 3],      // gold a pound to pick from when the price is part of the question
  most: 30,            // the most pounds brought to one sale
  unit: [2, 3, 4],     // the bottom numbers of the one-part shares
  part: [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [5, 6]],   // the shares of more than one part (top, bottom)
  // two buyers' shares [top, bottom, top, bottom]: halves with quarters or thirds, thirds with sixths, quarters with
  // eighths, fifths with fifths (the picture cuts the bale into the smaller parts); never all of it between them
  two: [[1, 2, 1, 4], [1, 4, 1, 2], [1, 2, 1, 3], [1, 3, 1, 2], [1, 3, 1, 6], [1, 6, 1, 3], [2, 3, 1, 6], [1, 6, 2, 3],
    [1, 4, 1, 8], [3, 8, 1, 4], [1, 8, 1, 2], [2, 5, 1, 5], [1, 5, 3, 5]],
};
const woolForms = (step) => (WOOL.forms.find((s) => step <= s.upTo) || WOOL.forms[WOOL.forms.length - 1]).forms;
const POUNDS = ['pound', 'pounds'];
const OTHERS = ['Widow Collins', 'Jed Turner', 'Hattie Bell', 'Ike Malone', 'Old Silas', 'Doc Harlan', 'Clara Dunn'];
const PART_WORD = { 2: 'a half', 3: 'a third', 4: 'a quarter', 5: 'a fifth', 6: 'a sixth', 8: 'an eighth' };
const lcm = (a, b) => { let x = a, y = b; while (y) [x, y] = [y, x % y]; return (a * b) / x; };
const fr = (a, b) => `${a}/${b}`;
const lb = (n) => u(n, POUNDS);
// every number the picture and its line show (the answer must not be one of them)
const shownNumbers = (pic) => { const p = picture(pic), t = (p.svg.match(/>([^<]*)</g) || []).join(' ') + ' ' + p.line; return (t.match(/\d+/g) || []).map(Number); };

// one wool sale's numbers, words and slips (or null: not enough wool for this form)
function woolCore(form, c, { pick, f }) {
  const She = f.she ? 'She' : 'He', she = f.she ? 'she' : 'he';
  const most = Math.min(c, WOOL.most);
  for (let tries = 0; tries < 24; tries++) {
    let core = null;
    if (form === 'two') core = twoBuyers(most, { pick, f });
    else {
      const [a, b] = form === 'unit' ? [1, pick(WOOL.unit)] : form === 'priced' ? pick([...WOOL.part, [1, 3], [1, 4]]) : pick(WOOL.part);
      const ks = [2, 3, 4, 5].filter((k) => b * k <= most && a * k !== b);
      if (!ks.length) continue;
      const k = pick(ks), n = b * k, s = a * k, priced = form === 'priced', p = priced ? pick(WOOL.prices) : WOOL.price;
      const name = f.name, frac = fr(a, b), leave = fr(b - a, b);
      const story = `${name} wants to buy some of your wool. You bring ${lb(n)} of wool. ${She} buys ${frac} of it${a === 1 && PART_WORD[b] ? ` (${PART_WORD[b]})` : ''}${priced ? ` and pays ${p} gold a pound` : ''}.`;
      const each = `${n} ÷ ${b} = ${k} in each part`;
      let slips;
      if (!priced) {
        slips = [
          { v: n / a, slip: 'divTop', why: `${n} ÷ ${a} divides by the top number. The bottom number, ${b}, is how many equal parts: ${n} ÷ ${b}, then take ${a}.` },
          { v: k, slip: 'onePart', why: `${k} pounds is just one part (1/${b}). ${She} buys ${a} of those parts.` },
          { v: n - s, slip: 'leftover', why: `That's the part ${she} leaves (${leave}). ${She} buys the other ${frac}.` },
          { v: n, slip: 'whole', why: `That's all ${lb(n)} you brought. ${She} buys only ${frac} of it.` },
          { v: n * a, slip: 'timesTop', why: `${n} × ${a} is more than all your wool. Cut ${n} into ${b} equal parts first.` },
          { v: n - b, slip: 'minusBottom', why: `${n} − ${b} takes away ${b} pounds. ${frac} means ${b} equal parts: ${n} ÷ ${b}.` },
          ...(b !== 2 ? [{ v: n / 2, slip: 'half', why: `That's half of it. ${frac} cuts the wool into ${b} equal parts, not 2.` }] : []),
        ];
        // (for one part, dividing by the top is just "all of it": that slip is the whole's)
        if (a === 1) slips = slips.filter((x) => x.slip !== 'divTop' && x.slip !== 'onePart');
        core = {
          story, ask: `How many pounds does ${she} take?`, answer: s, gold: s * p, sold: s, unit: POUNDS, slips,
          pic: { kind: 'fraction', n, parts: b, shares: [{ name, frac, parts: a }], ask: 'pounds', she },
          rightWhy: `${a === 1 ? `${n} ÷ ${b} = ${s}` : `${each}, and ${a} × ${k} = ${s}`}: ${frac} of ${n} is ${lb(s)}. At ${p} gold a pound, ${s * p} gold.`,
        };
      } else {
        const g = s * p;
        core = {
          story, ask: 'How much gold do you get?', answer: g, sold: s, slips: [
            { v: s, slip: 'noPrice', why: `${s} is the pounds ${she} takes. ${She} pays ${p} gold for every one of them.` },
            { v: n * p, slip: 'whole', why: `That pays for all ${lb(n)}. ${She} buys only ${frac} of it.` },
            { v: (n - s) * p, slip: 'leftover', why: `That pays for the part ${she} leaves (${leave}). ${She} buys the ${frac}.` },
            ...(a > 1 ? [{ v: k * p, slip: 'onePart', why: `That pays for one part (1/${b}) only. ${She} buys ${a} parts.` }] : []),
            ...(a > 1 ? [{ v: (n / a) * p, slip: 'divTop', why: `${n} ÷ ${a} divides by the top number. Cut it into ${b} equal parts (the bottom number).` }] : []),
            { v: s + p, slip: 'added', why: `${s} + ${p} adds the price on. Each of the ${lb(s)} pays ${p} gold: multiply.` },
          ],
          pic: { kind: 'fraction', n, parts: b, shares: [{ name, frac, parts: a }], ask: 'gold', price: p, she },
          rightWhy: `${a === 1 ? `${n} ÷ ${b} = ${s} pounds` : `${each}, ${a} × ${k} = ${lb(s)}`}, and ${s} × ${p} gold = ${g} gold.`,
        };
      }
    }
    if (!core) continue;
    // (the picture shows the numbers to work with, never the answer: a sale whose answer it would show is dealt again)
    if (shownNumbers(core.pic).includes(core.answer)) continue;
    return core;
  }
  return null;
}
// two buyers share one bale: how many pounds in all, how many more one takes than the other, how many are left
function twoBuyers(most, { pick, f }) {
  const [a1, b1, a2, b2] = pick(WOOL.two), D = lcm(b1, b2);
  // (two pounds or more in a part where the wool allows: a part of 1 pound leaves nothing to work out)
  const fit = [1, 2, 3, 4, 5].filter((k) => D * k <= most && D * k >= 6), ks = fit.some((k) => k > 1) ? fit.filter((k) => k > 1) : fit;
  if (!ks.length) return null;
  const k = pick(ks), n = D * k, s1 = (a1 * n) / b1, s2 = (a2 * n) / b2, m1 = (a1 * D) / b1, m2 = (a2 * D) / b2;
  const A = f.name, B = pick(OTHERS.filter((x) => x !== A)), p = WOOL.price;
  const ask = pick(s1 === s2 ? ['all', 'left'] : ['all', 'more', 'left']);
  const big = s1 > s2 ? A : B, small = s1 > s2 ? B : A, sBig = Math.max(s1, s2), sSmall = Math.min(s1, s2);
  const both = s1 + s2, left = n - both;
  const story = `${A} and ${B} both want your wool. You bring ${lb(n)}. ${A} buys ${fr(a1, b1)} of it and ${B} buys ${fr(a2, b2)}.`;
  const shares = `${fr(a1, b1)} of ${n} = ${s1} and ${fr(a2, b2)} of ${n} = ${s2}`;
  const tb = (a1 + a2) * n % (b1 + b2) === 0 ? (a1 + a2) * n / (b1 + b2) : null;
  const tbWhy = `${fr(a1, b1)} + ${fr(a2, b2)} isn't ${fr(a1 + a2, b1 + b2)}: work out each share in pounds, then put them together.`;
  const gold = `At ${p} gold a pound, ${both * p} gold for the two of them.`;
  const base = { n, parts: D, shares: [{ name: A, frac: fr(a1, b1), parts: m1 }, { name: B, frac: fr(a2, b2), parts: m2 }] };
  if (ask === 'all') return {
    story, ask: 'How many pounds do they take in all?', answer: both, gold: both * p, sold: both, unit: POUNDS,
    slips: [
      { v: s1, slip: 'oneShare', why: `That's only ${A}'s share. Add ${B}'s to it.` },
      { v: s2, slip: 'oneShare', why: `That's only ${B}'s share. Add ${A}'s to it.` },
      ...(tb ? [{ v: tb, slip: 'topsBottoms', why: tbWhy }] : []),
      { v: left, slip: 'leftover', why: `That's the wool nobody buys. They take the rest.` },
      { v: n, slip: 'whole', why: `That's all ${lb(n)}. Together they buy less than the whole bale.` },
    ],
    pic: { kind: 'fraction', ...base, ask: 'all' },
    rightWhy: `${shares}: ${s1} + ${s2} = ${lb(both)}. ${gold}`,
  };
  if (ask === 'more') return {
    story, ask: `How many more pounds does ${big} take than ${small}?`, answer: sBig - sSmall, gold: both * p, sold: both, unit: POUNDS,
    slips: [
      { v: both, slip: 'added', why: `That adds the two shares. The question asks how many MORE: take one from the other.` },
      { v: sBig, slip: 'oneShare', why: `That's ${big}'s whole share. Take away ${small}'s to see how many more.` },
      { v: sSmall, slip: 'oneShare', why: `That's ${small}'s share. How many more does ${big} take than that?` },
      { v: n - sBig, slip: 'leftover', why: `That's all the wool ${big} leaves. Compare the two shares instead.` },
    ],
    pic: { kind: 'fraction', ...base, ask: 'more', big, small },
    rightWhy: `${shares}: ${sBig} − ${sSmall} = ${lb(sBig - sSmall)} more. ${gold}`,
  };
  return {
    story, ask: `How many of the ${n} pounds are left?`, answer: left, gold: both * p, sold: both, unit: POUNDS,
    slips: [
      { v: both, slip: 'added', why: `That's what they take between them. Take it away from the ${n} to see what's left.` },
      { v: n - s1, slip: 'oneShare', why: `That takes away only ${A}'s share. ${B} buys some too.` },
      { v: n - s2, slip: 'oneShare', why: `That takes away only ${B}'s share. ${A} buys some too.` },
      { v: n, slip: 'whole', why: `That's all ${lb(n)}, before anyone buys. Take both shares away.` },
    ],
    pic: { kind: 'fraction', ...base, ask: 'left' },
    rightWhy: `${shares}: ${n} − ${s1} − ${s2} = ${lb(left)} left. ${gold}`,
  };
}

// ---- the pictures (a wrong coin, or "Draw it for me") -------------------------------------------------------------------
// The same look as the store's (src/ui/storepics.js): ink on the parchment, a "?" where the answer goes, never the answer.
//   lots      the goods packed into their lots (cartons of a dozen eggs, gallon jugs of quarts), each lot labelled with
//             what it pays, the ones left over beside them ("stay in your bags")
//   fraction  the wool as a bale cut into equal parts, the parts each buyer buys shaded, a "?" in every part
const INK = '#2b2219', SOFT = '#8a7558', FILL = '#ead9b2', FILL2 = '#d9bf8a', ASK = '#b5523a', EGG = '#f4ead4', MILK = '#f7f4ec', FLEECE = '#efe8da', WOOLA = '#d6a85c', WOOLB = '#9fbf9a';
const PW = 360;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const text = (x, y, s, { size = 13, fill = INK, anchor = 'middle', weight = 600 } = {}) =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="Bitter, Georgia, serif">${esc(s)}</text>`;
const svgOf = (h, body) => `<svg viewBox="0 0 ${PW} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${body}</svg>`;
// one of the goods, drawn small at (x, y)
function thing(shape, x, y, s = 1) {
  if (shape === 'egg') return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(3.6 * s).toFixed(1)}" ry="${(4.6 * s).toFixed(1)}" fill="${EGG}" stroke="${INK}" stroke-width="0.9"/>`;
  if (shape === 'jar') return `<rect x="${(x - 4 * s).toFixed(1)}" y="${(y - 6 * s).toFixed(1)}" width="${(8 * s).toFixed(1)}" height="${(12 * s).toFixed(1)}" rx="2" fill="${MILK}" stroke="${INK}" stroke-width="0.9"/><rect x="${(x - 2.4 * s).toFixed(1)}" y="${(y - 8 * s).toFixed(1)}" width="${(4.8 * s).toFixed(1)}" height="${(2.4 * s).toFixed(1)}" fill="${SOFT}"/>`;
  return `<circle cx="${(x - 3 * s).toFixed(1)}" cy="${y.toFixed(1)}" r="${(4 * s).toFixed(1)}" fill="${FLEECE}" stroke="${INK}" stroke-width="0.8"/><circle cx="${(x + 3 * s).toFixed(1)}" cy="${y.toFixed(1)}" r="${(4 * s).toFixed(1)}" fill="${FLEECE}" stroke="${INK}" stroke-width="0.8"/><circle cx="${x.toFixed(1)}" cy="${(y - 3 * s).toFixed(1)}" r="${(4 * s).toFixed(1)}" fill="${FLEECE}" stroke="${INK}" stroke-width="0.8"/>`;
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
  // the wool as a long bale cut into equal parts: each buyer's parts shaded (a colour each) with "Name buys 3/4" under
  // them, the parts nobody buys left plain; a "?" in every part (how many pounds in one part is the first thing to find)
  fraction(p) {
    const D = p.parts, x0 = 14, x1 = PW - 14, gap = 3, w = (x1 - x0 - gap * (D - 1)) / D, top = 22, hBar = 34;
    const shade = [WOOLA, WOOLB];
    let s = text(PW / 2, 15, `${lb(p.n)} of wool`, { size: 13 });
    let at = 0;
    const spans = p.shares.map((sh, i) => { const from = at; at += sh.parts; return { ...sh, from, to: at, fill: shade[i] }; });
    for (let i = 0; i < D; i++) {
      const x = x0 + i * (w + gap), sp = spans.find((q) => i >= q.from && i < q.to);
      s += `<rect x="${x.toFixed(1)}" y="${top}" width="${w.toFixed(1)}" height="${hBar}" rx="5" fill="${sp ? sp.fill : FLEECE}" stroke="${INK}" stroke-width="1.2"/>`;
      // (two bands of twine round each part, as a bale is tied: only their ends, where they wrap over the top and the
      // bottom edge, so they never look like the lines between the parts)
      for (const t of [0.3, 0.7]) { const tx = (x + w * t).toFixed(1); s += `<path d="M${tx} ${top - 2} v6 M${tx} ${top + hBar - 4} v6" stroke="${SOFT}" stroke-width="1.6" stroke-linecap="round"/>`; }
      s += text(x + w / 2, top + hBar / 2 + 5, '?', { size: 14, fill: ASK, weight: 800 });
    }
    // under the bale: a bracket under each buyer's parts (and the parts nobody buys) with its words; words that would
    // run into ones already placed go on a second row
    const by = top + hBar + 4, placed = [];
    let rows = 1;
    const under = (from, to, words, color) => {
      const a = x0 + from * (w + gap), b = x0 + to * (w + gap) - gap;
      s += `<path d="M${a.toFixed(1)} ${by} v4 H${b.toFixed(1)} v-4" fill="none" stroke="${color}" stroke-width="1.4"/>`;
      const tw = words.length * 6.6, tx = Math.max(4, Math.min((a + b) / 2 - tw / 2, PW - 4 - tw));
      let row = 0; while (placed.some((q) => q.row === row && tx < q.b + 8 && tx + tw > q.a - 8)) row++;
      placed.push({ a: tx, b: tx + tw, row }); rows = Math.max(rows, row + 1);
      s += text(tx, by + 20 + row * 17, words, { size: 13, anchor: 'start', fill: color, weight: 700 });
    };
    for (const sp of spans) under(sp.from, sp.to, `${sp.name} buys ${sp.frac}`, INK);
    if (at < D) under(at, D, p.shares.length > 1 ? 'nobody buys these' : `${p.she || 'she'} leaves these`, SOFT);
    const y = by + 20 + (rows - 1) * 17 + 4;
    const q = { pounds: `${p.she || 'she'} takes: ? lb`, gold: 'in all: ? gold', all: 'in all: ? lb', more: `${p.big} takes ? lb more`, left: 'left: ? lb' }[p.ask] || '? lb';
    if (p.ask === 'gold') s += text(x0, y + 16, `each pound: ${p.price} gold`, { size: 13, anchor: 'start', fill: SOFT, weight: 700 });
    s += text(PW - 12, y + 16, q, { size: 15, anchor: 'end', fill: ASK, weight: 800 });
    const one = `Find one part first: ${p.n} ÷ ${D}.`;
    const line = p.shares.length > 1
      ? `${lb(p.n)} cut into ${D} equal parts: ${p.shares.map((sh) => `${sh.frac} is ${sh.parts === 1 ? '1 part' : `${sh.parts} parts`}`).join(', ')}. ${one}`
      : `${lb(p.n)} cut into ${D} equal parts (the bottom number). ${p.shares[0].parts === 1 ? `One part is ${p.shares[0].frac}: ${p.n} ÷ ${D}.` : `${one} Then take ${p.shares[0].parts} parts (the top number).`}${p.ask === 'gold' ? ` Then ${p.price} gold for every pound.` : ''}`;
    return { svg: svgOf(y + 22, s), line };
  },
};
const PIC_TITLES = { lots: 'Packed into lots', fraction: 'Cut into equal parts' };
export function picture(pic) {
  const d = PICS[pic && pic.kind];
  if (!d) return { svg: '', title: '', line: '' };
  const { svg, line } = d(pic);
  return { svg, title: PIC_TITLES[pic.kind], line };
}
