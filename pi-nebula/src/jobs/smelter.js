// THE SMELTER CONTROLS, in the smelter's hall at the forge's own console (its FURNACE screens), the glowing pours just
// past it: what a haul of ore pays (the game's maker, 2026-11-05: "they could go over to the controls and start
// calculating on the smelter to figure out how many credits they will get paid"; 2026-11-16: "It makes sense to me
// that the smelter equipment is what would have an accurate read on the amount of ore verses slag from the haul").
// The ladder, easiest first: counting the canisters on the ship, how many are still on it and which are full, racks
// of the same; tonnes by the canister and loads shared out; a part of the load (1/4 of the ore is iron), several
// parts; canisters of ore, a whole number of canisters times a fraction of a tonne (8 canisters of 3/4 of a tonne,
// then 5 of them: 3 3/4 tonnes); weights in tenths (1.2 tonnes and 0.9 tonnes); yields in percent (25% of the ore is
// iron); a load of canisters (8 canisters of 1.2 tonnes); any percent (35%); what the metal pays (tonnes times the
// price), and at the top the whole pay slip: the ore, its yield, its pay. Decimals stay decimals; fractions stay
// fractions (3 3/4, never 3.75).
// Mathwood Valley's question makers tell the whole-number stories through SETTING (engine.js); the counting, the
// parts, the canisters of ore, the weights, the percents and the pay are this job's own makers (MAKERS below), as
// Mathwood's are told at a store counter or a fishing dock and have no hook for another world yet. The fractions are
// Mathwood's own (labs/fishing/frac.js), and the canisters of ore are its fishing dock's "fish times a fraction" (the
// level 'timesW', labs/fishing/pies.js) told through the haul.
//
// THE HAUL (haulOf below): one for each landing of the Miner (src/crane.js's round: the hangar is set out afresh and the
// Miner lands again when the player leaves the area and comes back). The smelter's equipment reads the WHOLE haul, all
// its canisters, wherever they are: how much in each is ore and how much slag. A haul is a pure function of its number,
// so every slip about the same haul tells the same haul.
//
// THE HANGAR, RIGHT NOW. Where a question counts canisters, it counts the ones really there when the slip is made:
// the game hands each maker `live` (src/crane.js load(): the haul's number, how many canisters are on the ship, how
// many of them full, how many are plugged in at the wall, how many on the rack, and for how long each of those stays
// as it is). A count is used only if it suits the level and the crane's timetable says it will still be true for
// STEADY seconds, so the answer is not out of date before it is picked, and only once (the next slip about the
// hangar waits until the crane has changed that count); otherwise, and in node, the numbers are the job's own (a slip
// "from the log"). What the displays read is NOT taken live: a draining canister's display changes every second, so a
// question about it would be wrong before it was read. A slip about the whole haul (its ore, its pay) is asked once a
// haul too: the same slip with the same answer twice running teaches nothing.
//
// A HAUL THE PLAYER WENT OUT FOR (src/missions.js: they signed a captain's contract and went on the run, at the drill or
// in the pilot's seat). The game's maker (2026-11-18): "the canisters all fill as a collective ... Just treat the
// storage as one", "every bit should count", "It's as simple as add up what they came back with and multiply each type
// of metal with what it is worth and that's what you get paid." So such a haul's facts are its STORE: how many tonnes of
// each metal came home, to the hundredth of a tonne (flownHaul's `store`: { iron: 3, nickel: 1.5, titanium: 1.5 }).
// haulOf gives it as its lots (`lots`: each metal, its tonnes, what a tonne of it sells for, what that comes to) and
// its pay as their plain sum. Nothing else enters it. The eight canisters are one store: each holds 3/4 of a tonne of
// metal when the store is full (CAN_HOLDS), and no canister has a metal of its own, so a slip about canisters counted
// in the hangar speaks of the metal in them without naming one. Who is paid what share of it is the contract's
// (src/missions.js), and the share is collected at this job's controls (its payout card, src/missions.js payoutOrder).
//
// A HAUL NOBODY THE PLAYER KNOWS FLEW (the Miner's own rounds while the player is about the station) is as it always
// was on these slips: canisters of one metal's ore, the part of the ore the furnace pours as metal (its yield), and
// the metal sold by the tonne at the chart's price.
//
// THE PRICES: ONE LIST (CHART), the game's maker's own chart of what a tonne of each metal is worth (iron 20, nickel
// 30, copper 40, cobalt 50, titanium 60, gold 80), every one multiplied by the same number (PRICE_TIMES) so that an
// ordinary mixed load of the Miner's six tonnes sells for about 17,000 to 20,000 credits (his sums, 2026-11-17: a ten
// minute run with all three jobs on it, half the haul, should pay about 8,300 credits; the pilot's tenth about 2,000).
// "If they make too much money then reduce the sell price. If they don't make enough money then increase the sell
// price": that is PRICE_TIMES, and nothing else. The same list is the chart at the asteroid field (src/drillview.js),
// the payout (src/missions.js) and every slip here.
import { dec } from '../../../mathwood-valley/src/math/counterkit.js';
import { fr, gcd, simplest, fracText, partsWord } from '../../../mathwood-valley/labs/fishing/frac.js';
import { ownOrder } from './engine.js';

const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
const TONNE = ['tonne', 'tonnes'], CAN = ['canister', 'canisters'], CREDIT = ['credit', 'credits'];
export const STEADY = 40;      // seconds a live count must stay as it is to be asked about
export const CARRIES = 8;      // canisters a Miner carries (the parked one's mounts: kit/ships/miner-built.js)
// what a full canister of the haul holds, in tenths of a tonne (ore and slag together: the crane lifts it, src/crane.js
// reads it from here): LOADS[haul % LOADS.length], one weight for the whole haul (the next haul's is the next in the
// list), so two slips about the same haul never disagree
export const LOADS = [12, 15, 8, 21, 14, 9, 25, 16, 11, 18, 7, 22, 13, 24, 6];
const WEIGHTS = [6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 18, 21, 22, 24, 25];

// who brought the load in (Mathwood's FOLK shape): the station's people
const FOLK = [
  { name: 'Miner Kestrel', she: true }, { name: 'Miner Dov', she: false }, { name: 'Pilot Juno', she: true }, { name: 'Engineer Okafor', she: false },
  { name: 'Dock Chief Ibarra', she: false }, { name: 'Crane Hand Pia', she: true }, { name: 'Furnace Hand Wren', she: true }, { name: 'Smelter Chief Anwar', she: false },
];
// what the smelter pours, and what a tonne of each sells for (the same everywhere: THE PRICES above)
export const CHART = { iron: 20, nickel: 30, copper: 40, cobalt: 50, titanium: 60, gold: 80 };
export const PRICE_TIMES = 100;
export const METALS = Object.entries(CHART).map(([name, n]) => ({ name, price: n * PRICE_TIMES }));
// what a tonne of a metal sells for, by its name (0: not a metal the smelter pours)
export const priceOf = (name) => { const M = METALS.find((m) => m.name === name); return M ? M.price : 0; };
const credits = (n) => Number(n).toLocaleString('en-US');   // a price or a pay in words: 15,000
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ── THE HAUL: what the smelter's equipment reads of one landing's canisters ─────────────────────────────────────────
//   haulOf(n) -> { n, canisters, fill, metal, ore, oreTonnes, pay, flown } and
//     a haul nobody the player knows flew: yield, metal10
//     a haul the player went out for:      store, lots, tonnes (its yield and metal10 are null)
//     canisters  all the haul's canisters (CARRIES), wherever they are now: on the ship, at the wall, on the rack
//     fill       tenths of a tonne in each full canister (LOADS): what it brought and its slag together
//     metal      the metal its ore carries ({ name, price }: METALS); a store's: the metal there is most of
//     ore        { n, d }: the tonnes in each canister that are not slag, a fraction of a tonne in halves, quarters or
//                eighths (so all the canisters come to whole tonnes), under one tonne and at least a tenth of a tonne
//                under the fill. A store's: CAN_HOLDS of metal in each, the store being one.
//     yield      the percent of the ore the furnace pours as metal (the rest of the ore goes to slag too): the dearer
//                the metal, the less of the ore it is
//     oreTonnes  the whole haul's ore, in tonnes (a store's: its metal); metal10: the metal it pours, in tenths of a
//                tonne; pay: in credits (the metal's tonnes times what a tonne of it sells for)
//     store      { iron: 3, nickel: 1.5, ... }: the tonnes of each metal that came home, to the hundredth of a tonne
//     lots       [{ metal, tonnes, price, pay }], the most tonnes first: the plain sum, metal by metal; tonnes: all
//     flown      the player went out for this haul (flownHaul)
const HAUL_ORE = [[3, 4], [5, 8], [7, 8], [1, 2], [3, 8]];
const HAUL_YIELD = { iron: 50, nickel: 40, copper: 30, cobalt: 20 };
export const CAN_HOLDS = [3, 4];                       // of a tonne of metal: what one of the Miner's canisters holds
export const HOLD = CARRIES * CAN_HOLDS[0] / CAN_HOLDS[1];   // tonnes of metal the Miner's eight canisters hold together

// a store tidied: only metals the smelter pours, each to the hundredth of a tonne, none empty
const hundredths = (t) => Math.round(Number(t) * 100);
export function tidyStore(store) {
  const out = {};
  for (const M of METALS) { const h = hundredths((store || {})[M.name] || 0); if (h > 0) out[M.name] = h / 100; }
  return out;
}
// THE PLAIN SUM: what a store sells for. Each metal's tonnes times what a tonne of it sells for, added up.
// -> { lots: [{ metal: { name, price }, tonnes, price, pay }] (the most tonnes first), tonnes, pay }
export function sellsFor(store) {
  const S = tidyStore(store);
  const lots = METALS.filter((M) => S[M.name]).map((M) => ({ metal: M, tonnes: S[M.name], price: M.price, pay: hundredths(S[M.name]) * M.price / 100 }))
    .sort((p, q) => q.tonnes - p.tonnes || q.price - p.price);
  return { lots, tonnes: lots.reduce((sum, L) => sum + hundredths(L.tonnes), 0) / 100, pay: lots.reduce((sum, L) => sum + L.pay, 0) };
}

// THE HAULS THE PLAYER WENT OUT FOR, by their number: { store }
const FLOWN = new Map();
const haulNo = (n) => Math.max(0, Math.floor(Number(n) || 0));
//   flownHaul(n, { store })   the facts of haul n (set as it lands): the tonnes of each metal aboard
//   flownHaul(n)              its facts, or null: nobody the player knows flew it
//   flownHaul(n, null)        forgotten (the tests; a haul's number comes round again only after a reload)
export function flownHaul(n, facts) {
  const k = haulNo(n);
  if (facts === null) FLOWN.delete(k);
  else if (facts) {
    const store = tidyStore(facts.store);
    if (!Object.keys(store).length) throw new Error(`smelter: a haul the player went out for needs its store, the tonnes of each metal, not ${JSON.stringify(facts.store)}`);
    FLOWN.set(k, { store });
  }
  return FLOWN.get(k) || null;
}
export function haulOf(n = 0) {
  const k = haulNo(n), F = FLOWN.get(k) || null, own = LOADS.slice(k % LOADS.length).concat(LOADS.slice(0, k % LOADS.length));
  let fill = own[0], a, d;
  if (F) {
    // (its canisters weigh the haul's own weight, or the next in the list heavy enough to hold their metal and a tenth
    // of a tonne of slag or more)
    [a, d] = CAN_HOLDS;
    fill = own.find((f) => a / d <= f / 10 - 0.1 + 1e-9) || Math.max(...LOADS);
    const S = sellsFor(F.store);
    return { n: k, canisters: CARRIES, fill, metal: S.lots[0].metal, ore: { n: a, d }, yield: null, oreTonnes: S.tonnes, metal10: null, pay: S.pay, flown: true, store: { ...F.store }, lots: S.lots, tonnes: S.tonnes };
  }
  // (the haul's own pick from the list, or the next one on that leaves a tenth of a tonne of slag or more)
  const turn = [...HAUL_ORE.slice(k % HAUL_ORE.length), ...HAUL_ORE.slice(0, k % HAUL_ORE.length)];
  [a, d] = turn.find(([x, y]) => x / y <= fill / 10 - 0.1 + 1e-9) || [3, 8];
  const oreTonnes = CARRIES * a / d, metal = METALS[k % 4], y = HAUL_YIELD[metal.name], metal10 = oreTonnes * y / 10;
  return { n: k, canisters: CARRIES, fill, metal, ore: { n: a, d }, yield: y, oreTonnes, metal10, pay: metal10 * metal.price / 10, flown: false };
}
// tonnes as they are said: "3 tonnes", "1 tonne", "1.5 tonnes", "0.75 of a tonne"
export const tonnesWords = (t) => { const h = hundredths(t), w = dec(h, 2, { trim: true }); return h === 100 ? '1 tonne' : h < 100 ? `${w} of a tonne` : `${w} tonnes`; };
// "3 tonnes of iron, 1.5 tonnes of nickel and 1.5 tonnes of titanium" (a store's lots, or [{ metal, tonnes }] by name)
export function lotsWords(lots) {
  const w = lots.map((L) => `${tonnesWords(L.tonnes)} of ${L.metal.name || L.metal}`);
  return w.length <= 1 ? w.join('') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`;
}

// ── fractions of a tonne (Mathwood's own fractions: labs/fishing/frac.js) ───────────────────────────────────────
// in a sentence: "3/4 of a tonne", "1 tonne", "3 3/4 tonnes"; on an answer button: "3 3/4" big, "tonnes" small
// ("3/4" and "of a tonne"), its value the simplest fraction's text, so two answers of the same amount are one
const ofT = (f) => { const s = simplest(f); return s.n < s.d ? `${fracText(s)} of a tonne` : `${fracText(s)} ${s.n === s.d ? 'tonne' : 'tonnes'}`; };
const FT = (f) => { const s = simplest(f), big = fracText(s), small = s.n < s.d ? 'of a tonne' : s.n === s.d ? 'tonne' : 'tonnes'; return { v: `${s.n}/${s.d}`, big, small, label: `${big} ${small}` }; };
const ONE_PART = { 2: 'half', 3: 'third', 4: 'quarter', 5: 'fifth', 6: 'sixth', 8: 'eighth', 10: 'tenth' };
const parts = (d, k = 2) => (k === 1 ? ONE_PART[d] || `${d}th` : partsWord(d));

// ANOTHER TELLING (a maker's `tell`): the drill operator's job (src/jobs/drill.js) asks the same sums of a rock in the
// claw as these slips ask of a load: a part of it, its weights in tenths, a percent of it, what its ore is worth. It
// hands the maker the words (tell.metal; tell.ore(whole) -> { of, is, it }; tell.part / tell.percent -> the stories to
// pick from; tell.weigh -> { add, both, left }; tell.pay -> { m, story, ask }); the numbers, the slips, the pictures
// and the sums are the maker's own, unchanged. Without it nothing changes.
const toldOre = (tell, whole) => (tell && tell.ore ? tell.ore(whole) : oreOf(whole));
// the ore a question is about: one load while the number is a load's size, a month of loads past that
const oreOf = (whole) => (whole <= 30 ? { of: 'the ore in this load', is: `The load is ${whole} tonnes.`, it: 'load' } : { of: 'this month\'s ore', is: `The Miners brought in ${whole} tonnes this month.`, it: 'ore' });

export const SETTING = {
  folk: FOLK,
  // the youngest: canisters to count (Mathwood's picture-story shape for a can)
  things: [{ key: 'canisters', unit: CAN, shape: 'can' }],
  kmoreHow: [({ b }) => `The crane brings ${b} more.`, ({ b }) => `A supply drone drops off ${b} more.`, ({ b, p }) => `${p.They} finds ${b} more on the rack.`],
  kleftHow: [({ b }) => `The crane took ${b} of them to the wall.`, ({ b, p }) => `${p.They} sent ${b} of them back to the ship.`, ({ b }) => `${b} of them went to the crusher.`],
  groups: [
    { key: 'ore', item: CAN, unit: TONNE, story: ({ a, b, f }) => `${f.name} brought in ${a} canisters, with ${b} tonnes of ore in each one.`, ask: () => 'How many tonnes of ore is that?' },
    { key: 'bars', item: ['pallet', 'pallets'], unit: ['bar', 'bars'], story: ({ a, b }) => `The smelter stacked ${a} pallets, with ${b} bars of iron on each pallet.`, ask: () => 'How many bars is that?' },
    { key: 'drones', item: ['ore drone', 'ore drones'], unit: CAN, story: ({ a, b }) => `${a} ore drones are due in today, each carrying ${b} canisters.`, ask: () => 'How many canisters will the crane have to move?' },
    { key: 'docking', item: CAN, unit: ['minute', 'minutes'], story: ({ a, b }) => `The crane takes ${b} minutes to dock each canister. There are ${a} canisters to dock.`, ask: () => 'How many minutes will that take?' },
  ],
  share: [
    { key: 'ore', thing: TONNE, box: CAN, story: ({ total, groups, f }) => `${f.name} dug ${total} tonnes of ore and packed it evenly into ${groups} canisters.`, ask: 'How many tonnes are in each canister?' },
    { key: 'bars', thing: ['bar', 'bars'], box: ['pallet', 'pallets'], story: ({ total, groups }) => `The smelter poured ${total} bars of iron, stacked evenly on ${groups} pallets.`, ask: 'How many bars go on each pallet?' },
    { key: 'pay', thing: CREDIT, box: ['pay packet', 'pay packets'], story: ({ total, groups, f }) => `${f.name}'s load paid ${total} credits. It goes evenly into ${groups} pay packets, one for each of the crew.`, ask: 'How many credits go in each pay packet?' },
  ],
  crates: [
    { key: 'canisters', box: CAN, story: ({ total, per, f }) => `${f.name} has dug ${total} tonnes of ore. A canister holds ${per} tonnes.`, ask: 'How many canisters are needed so all the ore fits?' },
    { key: 'pallets', box: ['pallet', 'pallets'], story: ({ total, per }) => `The smelter poured ${total} bars of iron today. A pallet holds ${per} bars.`, ask: 'How many pallets are needed for every bar?' },
  ],
  partsLeft: [
    { key: 'hopper', unit: TONNE, story: ({ a, b }) => `The crusher's hopper held ${a} tonnes of ore. The furnace has taken ${b} tonnes of it.`, ask: 'How many tonnes are left in the hopper?' },
    { key: 'barsLeft', unit: ['bar', 'bars'], story: ({ a, b }) => `The smelter poured ${a} bars of iron this week. A freighter took ${b} of them away.`, ask: 'How many bars are left?' },
    { key: 'toDock', unit: CAN, story: ({ a, b }) => `There were ${a} canisters to dock this shift. The crane has docked ${b} of them.`, ask: 'How many are still to dock?' },
  ],
  partsTogether: [
    { key: 'runs', unit: TONNE, story: ({ a, b }) => `The morning run brought in ${a} tonnes of ore and the evening run ${b} tonnes.`, ask: 'How many tonnes came in today?' },
    { key: 'metals', unit: ['bar', 'bars'], story: ({ a, b }) => `The smelter poured ${a} bars of iron and ${b} bars of nickel.`, ask: 'How many bars is that in all?' },
    { key: 'docked', unit: CAN, story: ({ a, b }) => `The crane docked ${a} canisters before lunch and ${b} after lunch.`, ask: 'How many canisters did it dock today?' },
  ],
  recipe: [
    { key: 'flux', make: ['canister of ore', 'canisters of ore'], unit: ['bag of flux', 'bags of flux'], small: ['bag', 'bags'],
      story: ({ base, per, want }) => `The furnace's recipe: ${u(per, ['bag of flux', 'bags of flux'])} for ${base} canisters of ore. Today's load is ${want} canisters.`, ask: () => 'How many bags of flux does the furnace need?' },
  ],
  tables: [
    { key: 'bars', top: ['tonne of ore', 'tonnes of ore'], bot: ['bar of iron', 'bars of iron'], botShort: ['bar', 'bars'], s: (a, b) => `The furnace pours ${a} bars of iron from every ${b} tonnes of ore.` },
    { key: 'flux', top: CAN, bot: ['bag of flux', 'bags of flux'], botShort: ['bag', 'bags'], s: (a, b) => `The furnace needs ${a} bags of flux for every ${b} canisters of ore.` },
    { key: 'cells', top: ['hour', 'hours'], bot: ['fuel cell', 'fuel cells'], botShort: ['cell', 'cells'], s: (a, b) => `The crusher uses ${a} fuel cells every ${b} hours.` },
  ],
  shares: {
    names: [['iron ore', 'nickel ore'], ['ore', 'flux'], ['copper', 'tin']],
    what: [['tonne', 'tonnes', 'tonne', 'tonnes']],
    story: ({ x, y, total, a, b }) => `The furnace is fed ${a} ${a === 1 ? 'part' : 'parts'} ${x} to ${b} ${b === 1 ? 'part' : 'parts'} ${y}, ${total} tonnes in all.`,
    ask: ({ who }) => `How many tonnes of ${who} go in?`,
  },
  proportions: [
    ({ n, d, D }) => ({ key: 'iron', s: `${n} of every ${d} tonnes of this ore ${n === 1 ? 'is' : 'are'} iron. The load is ${D} tonnes.`, ask: 'How many tonnes are iron?', unit: TONNE, what: 'iron' }),
    ({ n, d, D }) => ({ key: 'nickel', s: `${n} of every ${d} loads from the far belt ${n === 1 ? 'is' : 'are'} nickel ore. This month ${D} loads came in from there.`, ask: 'How many of them are nickel ore?', unit: ['load', 'loads'], what: 'nickel ore' }),
    ({ n, d, D }) => ({ key: 'copper', s: `${n} of every ${d} bars poured today ${n === 1 ? 'is' : 'are'} copper. The smelter poured ${D} bars.`, ask: 'How many are copper?', unit: ['bar', 'bars'], what: 'copper' }),
  ],
};

// ── the faces on the answer buttons ──────────────────────────────────────────────────────────────────────────────
// a whole count with its unit; a decimal kept as a whole number of hundredths (no rounding slips), printed without
// zeros it does not need: 960 -> "9.6 tonnes", 1200 -> "12 tonnes", 816 -> "8.16 tonnes"
const C = (n, unit) => ({ v: n, big: n.toLocaleString('en-US'), small: n === 1 ? unit[0] : unit[1], label: u(n, unit) });
const D = (h, unit = TONNE) => { const n = Math.round(h), big = dec(n, 2, { trim: true }), small = n === 100 ? unit[0] : unit[1]; return { v: n, big, small, label: `${big} ${small}` }; };
const t1 = (tenths) => dec(tenths, 1, { trim: true });           // tenths as text: 12 -> "1.2", 20 -> "2"
const kit = (rand) => ({ int: (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)), pick: (a) => a[Math.floor(rand() * a.length)], chance: (p) => rand() < p,
  shuffle: (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; } });

// a count of the load in the hangar, if it suits (lo..hi) and will stay as it is for a while; else null
const liveCount = (live, key, lo, hi) => {
  if (!live || !live.steady) return null;
  const n = key === 'docked' ? (live.docked || []).length : live[key];
  return Number.isInteger(n) && n >= lo && n <= hi && live.steady[key] >= STEADY ? n : null;
};
// A count of the hangar is asked about ONCE: the same slip twice running teaches nothing (and at this level a slip
// takes seconds, a canister a minute). Until the crane has changed that count, or a new round has begun, the next
// slips are from the log.
const asked = new Set();
const tag = (live, what, n) => `${live.round || 0}:${what}:${n}`;
const isNew = (live, what, n) => !asked.has(tag(live, what, n));
const used = (live, what, n) => { if (asked.size > 300) asked.clear(); asked.add(tag(live, what, n)); };
export const forget = () => asked.clear();   // (the tests start each case afresh)
// what a slip about the whole haul says it is about, on its top
const fromOf = () => 'This haul';
// (which of the Miner's canisters are still full at the top of a round: all the ones on it while it is being unloaded)
const unloading = (live) => !!live && live.phase === 'unload';

// a part of x as a sum the worked sheet can do: x ÷ b; or, where whole tonnes would not share out evenly (12 ÷ 10
// leaves a remainder there), x times the part as a decimal (12 × 0.1), so the answer keeps its tenths
const PART = { 2: 0.5, 4: 0.25, 5: 0.2, 10: 0.1 }, r2 = (x) => Math.round(x * 100) / 100;
const cutBy = (x, b, say) => (Number.isInteger(x) && x % b ? { op: 'mul', a: x, b: PART[b], say } : { op: 'div', a: x, b, say });
// 10% first, then so many 10%s, and half of one for a 5 (Mathwood's way with any percent: src/math/percent.js)
function tenthSteps(whole, pct, what) {
  const ten = whole / 10, k = Math.floor(pct / 10), five = pct % 10 === 5, r = r2;
  const steps = [cutBy(whole, 10, `First 10%: a tenth of the ${what}`)];
  if (k > 1) steps.push({ op: 'mul', a: r(ten), b: k, say: `Then ${k * 10}% is ${k} lots of 10%` });
  if (five) {
    steps.push(cutBy(r(ten), 2, 'Then 5% is half of 10%'));
    if (k >= 1) steps.push({ op: 'add', a: r(ten * k), b: r(ten / 2), say: `Then ${k * 10}% and 5% make ${pct}%` });
  }
  return steps;
}

export const MAKERS = {
  // ── counting canisters (the youngest): the canisters are drawn on the slip, and counting them is the skill ──────
  // step 1  up to 5: how many are on the Miner, plugged in at the wall, on the rack
  // step 2  up to 8: 8 came in, how many are still on the Miner; how many of these are full (a lit window), or empty
  // step 3  racks of the same: 3 racks with 2 canisters on each
  count: {
    strand: 'number', at: (step) => [0, 6, 16][Math.max(1, Math.min(3, step)) - 1],
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand);
      const one = (n) => (n === 1 ? 'one' : 'ones');
      if (step <= 1) {
        const KINDS = [
          { key: 'ship', src: 'onShip', look: 'full', ask: 'How many canisters are on the Miner?', where: 'on the Miner' },
          { key: 'wall', src: 'docked', look: 'full', ask: 'How many canisters are plugged in at the wall?', where: 'at the wall' },
          { key: 'rack', src: 'onRack', look: 'empty', ask: 'How many canisters are on the rack?', where: 'on the rack' },
        ];
        const now = KINDS.map((k) => ({ k, n: liveCount(live, k.src, 1, 5) })).filter((x) => x.n != null && isNew(live, 'count:' + x.k.key, x.n));
        const got = now.length ? t.pick(now) : null, k = got ? got.k : t.pick(KINDS), n = got ? got.n : t.int(1, 5);
        if (got) used(live, 'count:' + k.key, n);
        // (drawn as they are: at the wall a drained canister's lights have gone blue; the ones on the ship are the
        // empties once the full ones are off)
        const slots = got && k.key === 'wall' ? live.docked.map((d) => (d.percent > 0 ? 'full' : 'empty'))
          : got && k.key === 'ship' ? Array(n).fill(live.fullOnShip > 0 ? 'full' : 'empty') : Array(n).fill(k.look);
        return ownOrder({
          key: `count:${k.key}`, story: got ? 'The smelter\'s screen shows the hangar as it is right now.' : 'Look at this pay slip from the log.', ask: k.ask,
          right: C(n, CAN),
          slips: [
            { ...C(n + 1, CAN), slip: 'off', why: 'One too many. Count again, touching each one once.' },
            { ...C(n - 1, CAN), slip: 'off', why: 'One short. Count again, touching each one once.' },
            { ...C(n + 2, CAN), slip: 'off', why: 'Too many. Count again, touching each one once.' },
          ],
          rightWhy: `${u(n, CAN)} ${k.where}`,
          picFirst: true, help: { title: 'Count them', pic: { kind: 'cans', place: k.key, slots }, line: 'Touch each canister once as you count: 1, 2, 3 ...' },
          own: { strand: 'number', at: 0 }, facts: { kind: k.key, n, live: !!got },
        }, rand, 3);
      }
      if (step === 2) {
        let still = unloading(live) ? liveCount(live, 'onShip', 1, CARRIES - 1) : null;
        if (still != null && !isNew(live, 'still', still)) still = null;
        if (still != null) used(live, 'still', still);
        if (still != null || t.chance(0.45)) {
          // 8 came in: how many are still on the Miner (the others' places drawn empty)
          const n = still != null ? still : t.int(2, CARRIES - 1), gone = CARRIES - n;
          return ownOrder({
            key: 'count:still', story: `${still != null ? 'The Miner in the hangar' : 'A Miner'} came in with ${CARRIES} full canisters. The crane has taken some of them to the wall.`, ask: 'How many canisters are still on the Miner?',
            right: C(n, CAN),
            slips: [
              { ...C(gone, CAN), slip: 'gone', why: `${gone} is how many are gone. Count the ${one(n)} still on the ship.` },
              { ...C(CARRIES, CAN), slip: 'all', why: `${CARRIES} is how many came in. Some have gone to the wall.` },
              { ...C(n + 1, CAN), slip: 'off', why: 'One too many. Count the ones still there again.' },
              { ...C(n - 1, CAN), slip: 'off', why: 'One short. Count the ones still there again.' },
            ],
            rightWhy: `${CARRIES} take away ${gone} leaves ${u(n, CAN)}`, sum: { op: 'sub', a: CARRIES, b: gone },
            picFirst: true, help: { title: 'Count them', pic: { kind: 'cans', place: 'ship', slots: [...Array(n).fill('full'), ...Array(gone).fill('none')] }, line: 'Count the canisters still on the ship. The dotted shapes are the ones the crane took.' },
            own: { strand: 'number', at: 6 }, credit: [{ strand: 'sub', at: 5, weight: 0.5 }], facts: { kind: 'still', n, gone, live: still != null },
          }, rand, 3);
        }
        // full ones and empty ones: a full canister's window is lit all the way along, an empty one's is dark
        const all = t.int(4, CARRIES), full = t.int(1, all - 1), askFull = t.chance(0.6), n = askFull ? full : all - full, other = all - n;
        const slots = t.shuffle([...Array(full).fill('full'), ...Array(all - full).fill('empty')]);
        return ownOrder({
          key: `count:${askFull ? 'full' : 'empty'}`, story: 'A full canister has its window lit all the way along. An empty one is dark.', ask: `How many of these canisters are ${askFull ? 'full' : 'empty'}?`,
          right: C(n, CAN),
          slips: [
            { ...C(other, CAN), slip: 'other', why: `${other} ${other === 1 ? 'is' : 'are'} the ${askFull ? 'empty' : 'full'} ${one(other)}. Count the ones with the window ${askFull ? 'lit' : 'dark'}.` },
            { ...C(all, CAN), slip: 'all', why: `${all} is all of them, full and empty together.` },
            { ...C(n + 1, CAN), slip: 'off', why: 'One too many. Count again, touching each one once.' },
            { ...C(n - 1, CAN), slip: 'off', why: 'One short. Count again, touching each one once.' },
          ],
          rightWhy: `${u(n, CAN)} ${n === 1 ? 'is' : 'are'} ${askFull ? 'full' : 'empty'}`,
          picFirst: true, help: { title: 'Count them', pic: { kind: 'cans', place: 'row', slots }, line: `Point at each canister with its window ${askFull ? 'lit' : 'dark'} and count.` },
          own: { strand: 'number', at: 6 }, facts: { kind: askFull ? 'full' : 'empty', n, all, live: false },
        }, rand, 3);
      }
      // racks of the same
      const g = t.int(2, 3), e = t.int(2, 4), ans = g * e;
      return ownOrder({
        key: 'count:racks', story: `The crane sets out ${g} racks with ${e} canisters on each rack.`, ask: 'How many canisters is that in all?',
        right: C(ans, CAN),
        slips: [
          { ...C(g + e, CAN), slip: 'added', why: 'That adds the racks and the canisters. Count every canister on every rack.' },
          { ...C(e, CAN), slip: 'one', why: `${e} is one rack. There are ${g} racks.` },
          { ...C(ans + e, CAN), slip: 'groupOff', why: `That's ${g + 1} racks. Count the racks again: ${g}.` },
          { ...C(ans - 1, CAN), slip: 'off', why: 'One short. Count every canister on every rack.' },
        ],
        rightWhy: `${g} racks of ${e}: ${Array(g).fill(e).join(' + ')} = ${u(ans, CAN)}`,
        picFirst: true, help: { title: 'Count them', pic: { kind: 'cans', place: 'racks', g, e }, line: `Count every canister on every rack: ${g} racks, ${e} on each.` },
        own: { strand: 'words', at: 16 }, credit: [{ strand: 'mul', at: 14, weight: 0.5 }], facts: { kind: 'racks', g, e, ans, live: false },
      }, rand, 3);
    },
  },

  // ── a part of the load: yields as fractions ───────────────────────────────────────────────────────────────────
  // step 1  one part: 1/4 of the 12 tonnes is iron
  // step 2  several parts: 3/4 of the 12 tonnes is rock
  part: {
    strand: 'frac', at: (step) => (step <= 1 ? 28 : 40),
    make(step, { rand = Math.random, frac = 0, tell = null } = {}) {
      const t = kit(rand), metal = (tell && tell.metal) || t.pick(METALS.slice(0, 4)).name;
      if (step <= 1) {
        const d = t.pick(frac < 0.5 ? [2, 3, 4, 5] : [3, 4, 5, 6, 8, 10]), k = t.int(2, 9), whole = d * k;
        const O = toldOre(tell, whole), ctx = t.pick((tell && tell.part && tell.part({ step: 1, n: 1, d, whole, metal, O })) || [
          { key: 'metal', story: `1/${d} of ${O.of} is ${metal}. ${O.is}`, ask: `How many tonnes of ${metal} is that?`, what: metal },
          { key: 'drained', story: `${O.is} 1/${d} of it has gone through the crusher so far.`, ask: 'How many tonnes have gone through?', what: 'crushed' },
        ]);
        return ownOrder({
          key: `part:one:${ctx.key}`, story: ctx.story, ask: ctx.ask, right: C(k, TONNE),
          slips: [
            { ...C(whole - k, TONNE), slip: 'rest', why: `${whole - k} tonnes is the rest of the ${O.it}: the other ${d - 1} ${d - 1 === 1 ? 'part' : 'parts'}.` },
            { ...C(d, TONNE), slip: 'bottom', why: `${d} is how many equal parts the ${O.it} is cut into. One part is ${whole} ÷ ${d}.` },
            { ...C(whole - d, TONNE), slip: 'subtracted', why: `${whole} − ${d} takes ${d} away. Cut the ${whole} tonnes into ${d} equal parts instead.` },
            { ...C(k + 1, TONNE), slip: 'off', why: `${d} parts of ${k + 1} would make ${d * (k + 1)} tonnes, more than the ${whole} there are.` },
            { ...C(k - 1, TONNE), slip: 'off', why: `${d} parts of ${k - 1} make only ${d * (k - 1)} tonnes. There are ${whole}.` },
          ],
          rightWhy: `1/${d} of ${whole} is ${whole} ÷ ${d} = ${u(k, TONNE)}`, sum: { op: 'div', a: whole, b: d },
          help: { title: 'Cut into equal parts', pic: { kind: 'fracbar', whole, n: 1, d, what: ctx.what, it: O.it }, line: `1/${d} means the ${O.it} cut into ${d} equal parts, and one of them taken: ${whole} ÷ ${d}.`, steps: [`One of the ${d} equal parts: ${whole} ÷ ${d}`] },
          own: { strand: 'frac', at: 28 }, credit: [{ strand: 'div', at: 29, weight: 0.5 }], facts: { whole, n: 1, d, ans: k },
        }, rand);
      }
      const [n, d] = t.pick(frac < 0.5 ? [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5]] : [[3, 4], [3, 5], [4, 5], [5, 6], [3, 8], [5, 8], [3, 10], [7, 10]]), k = t.int(2, 9), whole = d * k, ans = n * k;
      const O = toldOre(tell, whole), ctx = t.pick((tell && tell.part && tell.part({ step: 2, n, d, whole, metal, O })) || [
        { key: 'slag', story: `${n}/${d} of ${O.of} is slag, and the rest is metal. ${O.is}`, ask: 'How many tonnes of slag is that?', what: 'slag' },
        { key: 'metal', story: `${n}/${d} of ${O.of} is ${metal}. ${O.is}`, ask: `How many tonnes of ${metal} is that?`, what: metal },
        { key: 'melted', story: `${O.is} The furnace has melted ${n}/${d} of it so far.`, ask: 'How many tonnes has it melted?', what: 'melted' },
      ]);
      return ownOrder({
        key: `part:some:${ctx.key}`, story: ctx.story, ask: ctx.ask, right: C(ans, TONNE),
        slips: [
          { ...C(k, TONNE), slip: 'onePart', why: `${k} tonnes is one part, 1/${d}. ${n}/${d} is ${n} of those parts.` },
          { ...C(whole - ans, TONNE), slip: 'rest', why: `${whole - ans} tonnes is the rest: the other ${d - n}/${d}.` },
          { ...C(ans + k, TONNE), slip: 'partOff', why: `That's ${n + 1} parts. ${n}/${d} is ${n} of the ${d} parts.` },
          { ...C(whole - n, TONNE), slip: 'subtracted', why: `${whole} − ${n} takes ${n} away. Cut the ${whole} tonnes into ${d} equal parts, then take ${n} of them.` },
          { ...C(ans + 1, TONNE), slip: 'off', why: `Cut the ${whole} tonnes into ${d} equal parts, then take ${n} of them.` },
        ],
        rightWhy: `One part is ${whole} ÷ ${d} = ${k}; ${n} parts are ${n} × ${k} = ${u(ans, TONNE)}`,
        sum: [{ op: 'div', a: whole, b: d, say: `First one of the ${d} equal parts` }, { op: 'mul', a: k, b: n, say: `Then ${n} of those parts` }],
        help: { title: 'Cut into equal parts', pic: { kind: 'fracbar', whole, n, d, what: ctx.what, it: O.it }, line: `${n}/${d} means the ${O.it} cut into ${d} equal parts, and ${n} of them taken. Work out one part first.`,
          steps: [`First one of the ${d} equal parts: ${whole} ÷ ${d}`, `Then ${n} of those parts: that × ${n}`] },
        own: { strand: 'frac', at: 40 }, credit: [{ strand: 'div', at: 29, weight: 0.5 }], facts: { whole, n, d, ans }, size: 2,
      }, rand);
    },
  },

  // ── canisters of ore: a whole number of canisters times a fraction of a tonne ─────────────────────────────────
  // (the game's maker, 2026-11-16: "5 of our containers are 3/4 ton of copper ore. How many tons did we collect?").
  // Mathwood's fishing dock asks the same of fish (labs/fishing/pies.js timesW: 4 perch of 3/4 of a pound each), and
  // these are its slips: the bottom number multiplied too (one canister's ore), the bottom number only (smaller
  // parts), the canisters added on, the canisters added to the top number; with this job's own: the parts counted and
  // not made into tonnes (15 quarters taken for 15 tonnes), the whole tonnes kept and the parts left over lost, a
  // canister too many or too few.
  // step 1  the answer is whole tonnes: the whole haul, 8 canisters of 3/4 of a tonne of copper ore (6 tonnes); or
  //         from the log, 4 canisters of 3/4 of a tonne (3 tonnes)
  // step 2  the answer is a mixed number: 5 canisters of 3/4 of a tonne (3 3/4 tonnes): the haul's canisters plugged
  //         in at the wall, or still full on the Miner, counted in the hangar where they can be; or from the log
  ore: {
    strand: 'frac', at: (step) => (step <= 1 ? 44 : 47),
    make(step, { rand = Math.random, who = null, live = null, frac = 0 } = {}) {
      const t = kit(rand), H = live ? haulOf(live.round) : null, whole = step <= 1;
      let n, a, d, metal, kind = 'own';
      // the haul: the whole of it (once a haul), or the canisters of it counted in the hangar right now (each count once)
      if (H) {
        const q = H.ore, fits = (c) => c != null && (c * q.n) % q.d !== 0 && c * q.n > q.d;
        // (a haul the player went out for is one store of metal: its canisters, the whole of them or the ones counted
        // in the hangar, hold metal, with no one metal named)
        if (whole && isNew(live, 'ore:haul', 0)) { used(live, 'ore:haul', 0); kind = 'haul'; n = H.canisters; }
        if (!whole) {
          const wall = liveCount(live, 'docked', 2, CARRIES), ship = unloading(live) ? liveCount(live, 'fullOnShip', 2, CARRIES - 1) : null;
          const now = [fits(wall) && { key: 'wall', n: wall }, fits(ship) && { key: 'ship', n: ship }].filter((x) => x && isNew(live, 'ore:' + x.key, x.n));
          const got = now.length ? t.pick(now) : null;
          if (got) { used(live, 'ore:' + got.key, got.n); kind = got.key; n = got.n; }
        }
        if (kind !== 'own') { a = q.n; d = q.d; metal = H.store ? null : H.metal.name; }
      }
      if (kind === 'own') {
        // from the log: halves and quarters first, then thirds, fifths and eighths
        const good = () => gcd(a, d) === 1 && n >= 2 && (whole ? (n * a) % d === 0 && n * a >= 2 * d : (n * a) % d !== 0 && n * a > d);
        for (let tries = 0; tries < 60; tries++) {
          d = t.pick(frac < 0.5 ? [2, 4, 4, 3] : [3, 4, 5, 8, 6]); a = t.int(1, d - 1);
          n = whole ? d * t.int(1, Math.max(1, Math.floor(12 / d))) : t.int(2, 9);
          if (good()) break;
        }
        if (!good()) [n, a, d] = whole ? [4, 3, 4] : [5, 3, 4];
        metal = t.pick(METALS.slice(0, 5)).name;
      }
      const q = fr(a, d), ans = fr(n * a, d), each = ofT(q), P1 = parts(d, 1), PS = parts(d);
      const W = (who && who.name) || 'the crew', they = who ? (who.she ? 'she' : 'he') : 'they';
      const mOre = metal ? `${metal} ore` : 'metal';      // (a store's canisters: metal, no one metal named)
      const ctx = kind === 'haul' ? { story: `This haul came in on the Miner: ${n} canisters, with ${each} of ${mOre} in each. The rest is slag.`, ask: `How many tonnes of ${mOre} did we collect?` }
        : kind === 'wall' ? { story: `${n} of this haul's canisters are plugged in at the smelter's wall right now. The smelter reads ${each} of ${mOre} in each.`, ask: `How many tonnes of ${mOre} have they brought?` }
          : kind === 'ship' ? { story: `${n} of this haul's canisters are still full on the Miner. The smelter read ${each} of ${mOre} in each.`, ask: `How many tonnes of ${mOre} are still on the ship?` }
            : t.pick([
              { story: `${n} of our canisters each hold ${each} of ${metal} ore.`, ask: `How many tonnes of ${metal} ore did we collect?` },
              { story: `An ore drone dropped off ${n} small canisters, with ${each} of ${metal} ore in each.`, ask: `How many tonnes of ${metal} ore is that?` },
              { story: `The smelter read ${W}'s haul: ${n} canisters, each with ${each} of ${metal} ore and the rest slag.`, ask: `How many tonnes of ${metal} ore did ${they} bring in?` },
            ]);
      const top = n * a, wholeT = Math.floor(top / d);
      const S = (f, slip, why) => ({ ...FT(f), slip, why });
      const slips = [
        S(fr(top, 1), 'partsOnly', `${top} is how many ${PS} of a tonne there are: ${n} lots of ${a}. ${d} ${PS} make one tonne.`),
        ...(whole ? [] : [S(fr(wholeT, 1), 'leftOver', `That is only the whole tonnes. The ${PS} left over count too, as a fraction of a tonne beside them.`)]),
        S(fr(n * d + a, d), 'added', `That adds the ${n} canisters on, as if each were a tonne. Each one brings ${each}: ${n} lots of it.`),
        S(q, 'oneCanister', `${cap(each)} is one canister's ore. There are ${n} canisters: ${n} lots of ${a}/${d}.`),
        S(fr(a + n, d), 'topAdded', `That adds ${n} to the top number. ${n} lots of ${a}/${d} multiply it: ${n} × ${a} on top, ${d} still underneath.`),
        S(fr(a, d * n), 'bottomTimes', `That multiplies the bottom number, which makes the parts smaller. ${n} canisters bring more than one canister's ore.`),
        S(fr((n + 1) * a, d), 'groupOff', `That is the ore of ${n + 1} canisters. There are ${n}.`),
        S(fr((n - 1) * a, d), 'groupOff', `That is the ore of ${n - 1} canisters. There are ${n}.`),
      ];
      return ownOrder({
        key: `ore:${whole ? 'whole' : 'mixed'}:${kind}`, story: ctx.story, ask: ctx.ask, right: FT(ans), slips,
        rightWhy: `${n} × ${a}/${d} = ${top}/${d} = ${ofT(ans)}`,
        // (Work it out: the parts in all, then whole tonnes, the remainder the parts left over: 15 ÷ 4 = 3 r 3, 3 3/4)
        sum: [...(a > 1 ? [{ op: 'mul', a: n, b: a, say: `First the ${PS} of a tonne in all: ${n} lots of ${a}` }] : []),
          { op: 'div', a: top, b: d, say: `${a > 1 ? 'Then' : 'First'} whole tonnes: ${d} ${PS} make one tonne${whole ? '' : ', and what is left over is still ' + PS}` }],
        help: { title: 'Lots of a fraction', pic: { kind: 'orecans', n, a, d, what: mOre },
          line: `${n} × ${a}/${d} is ${n} lots of ${a}/${d}: count the ${PS} of a tonne in all the canisters, then make them into whole tonnes, ${d} ${PS} to a tonne.`,
          steps: [a > 1 ? `First the ${PS} in all: ${n} × ${a}` : `First the ${PS} in all: one ${P1} in each of ${n} canisters`,
            `Then whole tonnes: ${d} ${PS} make one tonne, so that many ${PS} ÷ ${d}`,
            ...(whole ? [] : [`What is left over is still ${PS}: it goes over the ${d}`])] },
        own: { strand: 'frac', at: whole ? 44 : 47 }, credit: whole ? [{ strand: 'mul', at: 20, weight: 0.5 }] : [{ strand: 'div', at: 45, weight: 0.5 }],
        facts: { n, a, d, ans: [top, d], metal, kind, live: kind !== 'own', ...(kind !== 'own' ? { haul: H.n } : {}), ...(kind === 'haul' ? { from: fromOf(H) } : {}) },
        size: whole ? 1 : 2,
      }, rand);
    },
  },

  // ── weights in tenths of a tonne ─────────────────────────────────────────────────────────────────────────────
  // step 1  adding and taking away: 1.2 tonnes and 0.9 tonnes together; 2.3 tonnes with 0.8 drained
  // step 2  a load of canisters: 8 canisters of 1.2 tonnes (the canisters counted in the hangar where they can be)
  weigh: {
    strand: 'dec', at: (step) => (step <= 1 ? 50 : 60),
    make(step, { rand = Math.random, live = null, tell = null } = {}) {
      const t = kit(rand), told = (tell && tell.weigh) || null;
      if (step <= 1) {
        for (let tries = 0; tries < 80; tries++) {
          const a = t.int(6, 29), b = t.int(4, 19);   // tenths
          if (a % 10 === 0 || b % 10 === 0 || a === b) continue;
          if (t.chance(0.55)) {
            const s = a + b, parts = (a % 10) + (b % 10), wholes = Math.floor(a / 10) + Math.floor(b / 10);
            const ctx = t.pick(told ? told.add({ a: t1(a), b: t1(b) }) : [
              `The first canister came in holding ${t1(a)} tonnes of ore and the second holding ${t1(b)} tonnes.`,
              `The scale under the crane reads ${t1(a)} tonnes for one canister and ${t1(b)} tonnes for the next.`,
            ]);
            return ownOrder({
              key: 'weigh:add', story: ctx, ask: 'How many tonnes is that together?', right: D(s * 10),
              slips: [
                ...(parts >= 10 ? [{ ...D(wholes * 100 + parts), slip: 'wholeParts', why: `${a % 10} tenths and ${b % 10} tenths make ${parts} tenths, and 10 tenths are another whole tonne: carry it.` }] : []),
                { ...D(Math.abs(a - b) * 10), slip: 'subtracted', why: told ? told.both : 'That takes one from the other. Both canisters count: add them.' },
                { ...D((s + 1) * 10), slip: 'off', why: 'One tenth too many. Line the points up and add each column.' },
                { ...D((s - 1) * 10), slip: 'off', why: 'One tenth short. Line the points up and add each column.' },
                { ...D(s * 100), slip: 'pointLost', why: `${a} + ${b} = ${s}, but those are tenths of a tonne: ${s} tenths.` },
              ],
              pic: { kind: 'columns', rows: [dec(a, 1), dec(b, 1)], op: '+' },
              rightWhy: `${dec(a, 1)} + ${dec(b, 1)} = ${t1(s)} tonnes`, sum: { op: 'add', a: a / 10, b: b / 10 },
              own: { strand: 'dec', at: 50 }, credit: [], facts: { a, b, op: '+', ans: s },
            }, rand);
          }
          if (a <= b + 1) continue;
          const L = told ? told.left({ a: t1(a), b: t1(b) }) : { story: `A canister came in holding ${t1(a)} tonnes of ore. ${t1(b)} tonnes have drained into the crusher so far.`, ask: 'How many tonnes are still in the canister?', added: 'Draining leaves less in the canister: take away.', part: `${t1(b)} tonnes is what has drained. The question is what is still inside.` };
          const d = a - b, borrow = a % 10 < b % 10, digitwise = Math.abs(Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs((a % 10) - (b % 10));
          return ownOrder({
            key: 'weigh:left', story: L.story, ask: L.ask, right: D(d * 10),
            slips: [
              ...(borrow && digitwise !== d ? [{ ...D(digitwise * 10), slip: 'smallerFromBigger', why: `In the tenths the smaller digit was taken from the bigger. ${a % 10} tenths is less than ${b % 10} tenths: borrow a whole tonne.` }] : []),
              { ...D((a + b) * 10), slip: 'added', why: L.added },
              { ...D((d + 1) * 10), slip: 'off', why: 'One tenth too many. Line the points up and take away each column.' },
              { ...D((d > 1 ? d - 1 : d + 2) * 10), slip: 'off', why: 'Line the points up and take away each column again.' },
              { ...D(b * 10), slip: 'part', why: L.part },
            ],
            pic: { kind: 'columns', rows: [dec(a, 1), dec(b, 1)], op: '−' },
            rightWhy: `${dec(a, 1)} − ${dec(b, 1)} = ${t1(d)} tonnes`, sum: { op: 'sub', a: a / 10, b: b / 10 },
            own: { strand: 'dec', at: 50 }, credit: [], facts: { a, b, op: '−', ans: d },
          }, rand);
        }
        throw new Error('smelter weigh: nothing made');
      }
      // n canisters of w tonnes: the count from the hangar when it suits
      const onShip = unloading(live) ? liveCount(live, 'fullOnShip', 2, CARRIES) : null, atWall = liveCount(live, 'docked', 2, CARRIES);
      // (what the whole load holds is one sum for the round: asked once, like each count)
      const now = [onShip != null && { key: 'ship', n: onShip }, atWall != null && { key: 'wall', n: atWall }, live && { key: 'load', n: live.canisters || CARRIES }].filter((x) => x && isNew(live, 'weigh:' + x.key, x.n));
      const got = now.length ? t.pick(now) : null, n = got ? got.n : t.pick([3, 4, 5, 6, 7, 8, 8]);
      if (got) used(live, 'weigh:' + got.key, n);
      const w = got ? haulOf(live.round || 0).fill : t.pick(WEIGHTS), p = n * w;   // tenths (the haul's own weight: haulOf)
      // (the haul's canisters hold its ore and its slag together: the smelter reads which is which, the 'ore' maker)
      const ctx = !got ? { story: `A Miner came in with ${n} canisters, each holding ${t1(w)} tonnes of ore.`, ask: 'How many tonnes of ore is the load?' }
        : got.key === 'ship' ? { story: `The Miner in the hangar has ${n} full canisters on it right now. Each one holds ${t1(w)} tonnes, ore and slag together.`, ask: 'How many tonnes are still on the ship?' }
          : got.key === 'wall' ? { story: `${n} canisters are plugged in at the smelter's wall right now. Each one came in holding ${t1(w)} tonnes, ore and slag together.`, ask: 'How many tonnes did they bring?' }
            : { story: `This haul came in on the Miner: ${n} canisters, each holding ${t1(w)} tonnes when full, ore and slag together.`, ask: 'How many tonnes is the whole haul?' };
      return ownOrder({
        key: `weigh:load:${got ? got.key : 'own'}`, story: ctx.story, ask: ctx.ask, right: D(p * 10),
        slips: [
          ...(w > 10 && (w % 10) * n >= 10 ? [{ ...D(Math.floor(w / 10) * n * 100 + (w % 10) * n), slip: 'partsApart', why: `${n} × ${w % 10} tenths is ${n * (w % 10)} tenths, and every 10 tenths make another whole tonne.` }] : []),
          { ...D(p * 100), slip: 'pointLost', why: `${n} × ${w} = ${p}, but those are tenths of a tonne: ${p} tenths.` },
          { ...D(p), slip: 'pointFar', why: `Only one place after the point in ${dec(w, 1)}, so only one in the answer.` },
          { ...D((w + n * 10) * 10), slip: 'added', why: 'That adds the count on. Every canister brings its whole weight: multiply.' },
          { ...D((p + w) * 10), slip: 'groupOff', why: `That's ${n + 1} canisters. There are ${n}.` },
        ],
        pic: { kind: 'bars', n, label: dec(w, 1), line: `${n} canisters of ${dec(w, 1)} tonnes: ${n} lots of ${w} tenths.` },
        rightWhy: `${n} × ${w} tenths = ${p} tenths = ${t1(p)} tonnes`, sum: { op: 'mul', a: w / 10, b: n },
        own: { strand: 'dec', at: 60 }, credit: [{ strand: 'mul', at: 43, weight: 0.5 }], facts: { n, w, ans: p, live: !!got, kind: got ? got.key : 'own', ...(got && got.key === 'load' ? { haul: live.round || 0, from: fromOf(haulOf(live.round || 0)) } : {}) },
      }, rand);
    },
  },

  // ── yields in percent ──────────────────────────────────────────────────────────────────────────────────────
  // step 1  50%, 25% and 10% of a load (25% of the 12 tonnes is iron)
  // step 2  any percent, from 10% (35% of the 20 tonnes is iron: 10% is 2, 30% is 6, 5% is 1)
  percent: {
    strand: 'pct', at: (step) => (step <= 1 ? 58 : 62),
    make(step, { rand = Math.random, frac = 0, tell = null } = {}) {
      const t = kit(rand), metal = (tell && tell.metal) || t.pick(METALS.slice(0, 4)).name;   // (the common ones: nobody's ore is 70% gold)
      if (step <= 1) {
        const pct = t.pick([50, 25, 10, 25, 10]), n = 100 / pct, whole = n * t.int(2, pct === 10 ? 9 : 12), part = whole / n;
        const said = pct === 50 ? 'half' : pct === 25 ? 'a quarter' : 'a tenth';
        const O = toldOre(tell, whole), ctx = t.pick((tell && tell.percent && tell.percent({ pct, whole, metal, O })) || [
          { key: 'metal', story: `${pct}% of ${O.of} is ${metal}. ${O.is}`, ask: `How many tonnes of ${metal} is that?`, rest: `the other ${100 - pct}%: the rest of the ore` },
          ...(whole <= 30 ? [{ key: 'left', story: `The displays at the wall say ${pct}% of this load is still in its canisters. The load was ${whole} tonnes.`, ask: 'How many tonnes are still in the canisters?', rest: `the ${100 - pct}% that has drained` }] : []),
        ]);
        return ownOrder({
          key: `percent:simple:${ctx.key}:${pct}`, story: ctx.story, ask: ctx.ask, right: C(part, TONNE),
          slips: [
            { ...C(pct, TONNE), slip: 'percentCount', why: `${pct}% isn't ${pct} tonnes. It means ${pct} out of every 100: here ${said} of the ${whole} tonnes.` },
            { ...C(whole - part, TONNE), slip: 'rest', why: `${whole - part} tonnes is ${ctx.rest}.` },
            { ...C(pct === 50 ? whole / 4 : whole / 2, TONNE), slip: 'wrongPart', why: `That's ${pct === 50 ? 'a quarter (25%)' : 'half (50%)'}. ${pct}% is ${pct === 50 ? 'half' : pct === 25 ? 'half of a half' : 'one part in ten'}.` },
            { ...C(part + 1, TONNE), slip: 'off', why: `Cut the ${whole} tonnes into ${n} equal parts again: ${pct}% is one of them.` },
            { ...C(part * 2, TONNE), slip: 'twice', why: `That's twice as much. ${pct}% is one part in ${n}.` },
          ].filter((s) => Number.isInteger(s.v) && s.v !== whole),
          pic: { kind: 'pctbar', whole, n, take: 1, unit: TONNE, mode: 'part' },
          rightWhy: `${pct}% is 1 part in ${n}: ${whole} ÷ ${n} = ${u(part, TONNE)}`, sum: { op: 'div', a: whole, b: n },
          own: { strand: 'pct', at: 58 }, credit: [{ strand: 'frac', at: 40, weight: 0.5 }], facts: { whole, pct, ans: part },
        }, rand);
      }
      for (let tries = 0; tries < 80; tries++) {
        const pct = t.pick(frac < 0.5 ? [20, 30, 40, 60, 70, 35] : [15, 30, 35, 45, 60, 75, 5, 40, 35]);
        // (the load in whole tonnes; later on, loads whose answer has tenths in it: 35% of 8 tonnes is 2.8)
        const small = frac >= 0.5 && t.chance(0.4), whole = small ? t.int(2, 9) * (pct % 10 ? 2 : 1) : (pct % 10 ? 20 : 10) * t.int(2, 12);
        const part10 = whole * pct / 10;   // the answer in tenths
        if (!Number.isInteger(part10) || whole === 100 || (!small && part10 % 10)) continue;
        const ten10 = whole, T = (x10) => D(x10 * 10);   // (10% of the load, in tenths, is the load's own number)
        const O = toldOre(tell, whole), any = (tell && tell.percent && tell.percent({ pct, whole, metal, O })[0]) || { story: `${pct}% of ${O.of} is ${metal}. ${O.is}`, ask: `How many tonnes of ${metal} is that?`, rest: 'the rest of the ore' };
        return ownOrder({
          key: `percent:any:${pct}`, story: any.story, ask: any.ask, right: T(part10),
          slips: [
            { ...T(pct * 10), slip: 'percentCount', why: `${pct}% isn't ${pct} tonnes: it's ${pct} out of every 100. 10% of ${whole} tonnes is ${t1(ten10)}.` },
            { ...T(whole * 10 - part10), slip: 'rest', why: `${t1(whole * 10 - part10)} tonnes is the other ${100 - pct}%: ${any.rest.replace(/^the other \d+%: /, '')}.` },
            { ...T(ten10), slip: 'tenOnly', why: `${t1(ten10)} tonnes is 10%. ${pct}% is ${t1(pct)} lots of that.` },
            { ...T(part10 + ten10), slip: 'tenOff', why: `That's 10% too much: ${pct + 10}%. Count the 10%s again.` },
            ...(part10 > whole ? [{ ...T(part10 * 10), slip: 'pointLost', why: `That's more than all the ${tell ? O.it : 'ore'} there is. ${pct}% is only a part of the ${whole} tonnes.` }] : []),
            { ...T(part10 + 5), slip: 'off', why: `Find 10% of the ${whole} tonnes first, then build ${pct}% from it.` },
          ],
          pic: { kind: 'pctbar', whole, n: pct % 10 ? 20 : 10, take: pct % 10 ? pct / 5 : pct / 10, unit: TONNE, mode: 'part' },
          sum: tenthSteps(whole, pct, O.it),
          rightWhy: pct === 5 ? `10% of ${whole} is ${t1(ten10)}, and 5% is half of that: ${t1(part10)} tonnes`
            : pct % 10 ? `10% of ${whole} is ${t1(ten10)} and 5% is ${dec(ten10 * 5, 2, { trim: true })}: ${pct}% is ${Math.floor(pct / 10)} × ${t1(ten10)} + ${dec(ten10 * 5, 2, { trim: true })} = ${t1(part10)} tonnes`
              : `10% of ${whole} is ${t1(ten10)}, so ${pct}% is ${pct / 10} × ${t1(ten10)} = ${t1(part10)} tonnes`,
          own: { strand: 'pct', at: 62 }, credit: small ? [{ strand: 'dec', at: 55, weight: 0.5 }] : [], facts: { whole, pct, ans: part10 / 10 }, size: 2,
        }, rand);
      }
      throw new Error('smelter percent: nothing made');
    },
  },

  // ── what it pays ───────────────────────────────────────────────────────────────────────────────────────────
  // step 1  tonnes times the price: 2.8 tonnes of cobalt at 5,000 credits a tonne
  // step 2  the whole pay slip: the haul's own once a haul (8 canisters with 3/4 of a tonne of copper ore in each; 30%
  //         of the ore is copper; 4,000 credits a tonne; or, a haul the player went out for, one metal of its store),
  //         then from the log (8 canisters of 1.5 tonnes; 25% of the ore is titanium; 6,000 credits a tonne)
  pay: {
    strand: 'dec', at: (step) => (step <= 1 ? 66 : 76),
    make(step, { rand = Math.random, live = null, frac = 0, tell = null } = {}) {
      const t = kit(rand), P = (credits) => { const n = Math.round(credits * 100), whole = n % 100 === 0; return { v: n, big: whole ? (n / 100).toLocaleString('en-US') : dec(n, 2, { trim: true }), small: n === 100 ? CREDIT[0] : CREDIT[1], label: `${whole ? n / 100 : dec(n, 2, { trim: true })} ${n === 100 ? CREDIT[0] : CREDIT[1]}` }; };
      if (step <= 1) {
        for (let tries = 0; tries < 60; tries++) {
          const w = t.int(6, frac < 0.5 ? 49 : 95);   // tenths of a tonne
          const told = tell && tell.pay ? tell.pay({ w: t1(w) }) : null, m = told ? told.m : t.pick(frac < 0.5 ? METALS.slice(0, 4) : METALS);
          if (w % 10 === 0) continue;
          const pay = w * m.price / 10, whole = Math.floor(w / 10);
          return ownOrder({
            key: `pay:metal:${m.name}`, story: told ? told.story : `The smelter poured ${t1(w)} tonnes of ${m.name} from this load. ${cap(m.name)} pays ${credits(m.price)} credits a tonne.`, ask: told ? told.ask : 'How many credits does the load pay?', right: P(pay),
            slips: [
              { ...P(w * m.price), slip: 'pointLost', why: `${w} × ${credits(m.price)} = ${(w * m.price).toLocaleString('en-US')}, but ${t1(w)} is ${w} tenths of a tonne: a tenth of that.` },
              ...(whole >= 1 ? [{ ...P(whole * m.price), slip: 'wholeOnly', why: `That pays for the ${u(whole, ['whole tonne', 'whole tonnes'])} and leaves out the other ${dec(w % 10, 1)} of a tonne.` }] : []),
              { ...P((whole + 1) * m.price), slip: 'roundedUp', why: `That pays for ${whole + 1} whole tonnes. There are only ${t1(w)}.` },
              { ...P(m.price), slip: 'oneTonne', why: `${credits(m.price)} credits is what one tonne pays. There are ${t1(w)} tonnes.` },
              { ...P(pay + m.price), slip: 'groupOff', why: `That's a tonne too many. ${t1(w)} tonnes at ${credits(m.price)} credits each.` },
            ],
            rightWhy: `${t1(w)} × ${credits(m.price)} = ${pay.toLocaleString('en-US')} credits`, sum: { op: 'mul', a: w / 10, b: m.price },
            help: { title: 'Tonne by tonne', pic: { kind: 'paybars', w, price: m.price, metal: m.name }, line: `Every whole tonne pays ${credits(m.price)} credits. The part of a tonne pays its part of ${credits(m.price)}: ${dec(w % 10, 1)} × ${credits(m.price)}.`,
              steps: [...(whole >= 1 ? [`The whole ${whole === 1 ? 'tonne' : 'tonnes'}: ${whole} × ${credits(m.price)}`] : []), `The part of a tonne: ${dec(w % 10, 1)} × ${credits(m.price)}`, ...(whole >= 1 ? ['Then add the two'] : [])] },
            own: { strand: 'dec', at: 66 }, credit: [{ strand: 'money', at: 60, weight: 0.5 }], facts: { w, price: m.price, ans: pay }, size: 2,
          }, rand);
        }
        throw new Error('smelter pay: nothing made');
      }
      // THE WHOLE HAUL'S PAY (once a haul; then slips from the log): the smelter's equipment has the whole haul, all its
      // canisters wherever they are (the game's maker, 2026-11-16: "if the player goes to the smelter room to calculate
      // the payout then it should be able to access the entire haul"): its ore, then the part of the ore that is metal,
      // then what that pays. (Who is paid what share of it is the contract's, src/missions.js; a haul a crew flew, and
      // a rich rock's double pay, are that haul's own facts: haulOf.)
      const H = live ? haulOf(live.round) : null;
      // A HAUL THE PLAYER WENT OUT FOR: what ONE METAL of its store pays, each metal once: its tonnes times what a tonne
      // of it sells for (the payout's own sum, metal by metal). The line under the right answer says what the whole
      // haul pays.
      const lot = H && H.lots ? H.lots.find((L) => isNew(live, 'pay:lot:' + L.metal.name, 0)) : null;
      if (lot) {
        used(live, 'pay:lot:' + lot.metal.name, 0);
        const m = lot.metal.name, price = lot.price, pay = lot.pay, h = Math.round(lot.tonnes * 100), tw = dec(h, 2, { trim: true }), whole = Math.floor(h / 100), part = h % 100, tons = tonnesWords(lot.tonnes);
        return ownOrder({
          key: `pay:lot:${m}`, story: `This haul came home with ${tons} of ${m} in its canisters. ${cap(m)} sells for ${credits(price)} credits a tonne.`, ask: `How many credits does the ${m} pay?`, right: P(pay),
          slips: [
            ...(part ? [{ ...P(h * price / 10), slip: 'pointLost', why: `That moves the point one place. ${tw} tonnes is ${whole ? `${whole} whole ${whole === 1 ? 'tonne' : 'tonnes'} and a part of one` : 'less than one whole tonne'}.` }] : []),
            ...(part && whole >= 1 ? [{ ...P(whole * price), slip: 'wholeOnly', why: `That pays for the ${u(whole, ['whole tonne', 'whole tonnes'])} and leaves out the other ${dec(part, 2, { trim: true })} of a tonne.` }] : []),
            ...(part ? [{ ...P((whole + 1) * price), slip: 'roundedUp', why: `That pays for ${whole + 1} whole ${whole + 1 === 1 ? 'tonne' : 'tonnes'}. There ${h === 100 ? 'is' : 'are'} only ${tw}.` }] : []),
            ...(h !== 100 ? [{ ...P(price), slip: 'oneTonne', why: `${credits(price)} credits is what one tonne sells for. There ${h < 100 ? 'is' : 'are'} ${tons}.` }] : []),
            ...(H.pay !== pay ? [{ ...P(H.pay), slip: 'wholeHaul', why: `That is the whole haul, every metal in it. The question is the ${m}: ${tons}.` }] : []),
            { ...P(pay + price), slip: 'groupOff', why: `That is a tonne too many. ${cap(tons)} at ${credits(price)} credits a tonne.` },
            { ...P(h / 100 + price), slip: 'added', why: `That adds the tonnes to the price. Every tonne sells for ${credits(price)} credits: multiply.` },
          ].filter((x) => x.v > 0),
          rightWhy: `${tw} × ${credits(price)} = ${credits(pay)} credits. The whole haul, every metal in it, pays ${credits(H.pay)} credits.`,
          sum: { op: 'mul', a: h / 100, b: price },
          lines: [[cap(m), tons], ['It sells for', `${credits(price)} credits a tonne`], ['Pay', '?']],
          help: { title: 'Tonne by tonne', line: `Every tonne of ${m} sells for ${credits(price)} credits${part ? `, and the part of a tonne for its part of ${credits(price)}` : ''}.`,
            steps: [...(whole >= 1 ? [`The whole ${whole === 1 ? 'tonne' : 'tonnes'}: ${whole} × ${credits(price)}`] : []), ...(part ? [`The part of a tonne: ${dec(part, 2, { trim: true })} × ${credits(price)}`] : []), ...(whole >= 1 && part ? ['Then add the two'] : [])] },
          own: { strand: 'dec', at: 66 }, credit: [{ strand: 'money', at: 60, weight: 0.5 }],
          facts: { tonnes: lot.tonnes, price, metal: m, ans: pay, whole: H.pay, live: true, lot: true, haul: H.n, from: fromOf(H) }, size: 2,
        }, rand);
      }
      if (H && !H.lots && isNew(live, 'pay:haul', 0)) {
        used(live, 'pay:haul', 0);
        const N = H.canisters, { n: a, d } = H.ore, O = H.oreTonnes, m = H.metal, pct = H.yield, metal10 = H.metal10, pay = H.pay, PS = parts(d);
        const cut = pct === 50 ? [2, 'half'] : pct === 25 ? [4, 'a quarter'] : pct === 20 ? [5, 'a fifth'] : pct === 10 ? [10, 'a tenth'] : null;
        const yieldSteps = cut ? [cutBy(O, cut[0], `Then the ${m.name}: ${pct}% is ${cut[1]} of the ore`)]
          : [cutBy(O, 10, 'Then 10% of the ore: a tenth of it'), { op: 'mul', a: r2(O / 10), b: pct / 10, say: `Then the ${m.name}: ${pct}% is ${pct / 10} lots of 10%` }];
        return ownOrder({
          key: `pay:haul:${m.name}`, story: `This haul came in on the Miner: ${N} canisters, with ${ofT(fr(a, d))} of ${m.name} ore in each. ${pct}% of the ore is ${m.name}, and ${m.name} pays ${credits(m.price)} credits a tonne.`, ask: 'How many credits does the haul pay?', right: P(pay),
          slips: [
            { ...P(O * m.price), slip: 'allOre', why: `That pays for all ${u(O, TONNE)} of ore as if every tonne were ${m.name}. Only ${pct}% of the ore is ${m.name}.` },
            ...(a > 1 ? [{ ...P(N * a * pct / 100 * m.price), slip: 'partsOnly', why: `${N * a} is how many ${PS} of a tonne of ore there are, not tonnes: ${d} ${PS} make one tonne.` }] : []),
            { ...P(pay / N), slip: 'oneCanister', why: `That's the pay for one canister. There are ${N} of them.` },
            { ...P((O * 10 - metal10) * m.price / 10), slip: 'rest', why: `That pays for the other ${100 - pct}%: the slag. Only the ${m.name} is paid for.` },
            { ...P(metal10 / 10), slip: 'noPrice', why: `${t1(metal10)} is the tonnes of ${m.name}. Each tonne pays ${credits(m.price)} credits.` },
            { ...P(pay + m.price), slip: 'off', why: `That's a tonne of ${m.name} too many. Work out the tonnes of ore, then the ${m.name}, then the pay.` },
          ].filter((s) => s.v > 0),
          rightWhy: `${N} × ${a}/${d} = ${u(O, TONNE)} of ore; ${pct}% of it is ${t1(metal10)} tonnes of ${m.name}; × ${credits(m.price)} = ${pay.toLocaleString('en-US')} credits`,
          sum: [...(a > 1 ? [{ op: 'mul', a: N, b: a, say: `First the ore, in ${PS} of a tonne: ${N} lots of ${a}` }] : []),
            { op: 'div', a: N * a, b: d, say: `${a > 1 ? 'Then' : 'First'} the ore in tonnes: ${d} ${PS} make one tonne` }, ...yieldSteps,
            { op: 'mul', a: metal10 / 10, b: m.price, say: `Then the pay: the tonnes of ${m.name} times ${credits(m.price)} credits` }],
          lines: [['Ore', `${N} canisters × ${a}/${d} of a tonne`], [cap(m.name), `${pct}% of the ore`], ['Price', `${credits(m.price)} credits a tonne`], ['Pay', '?']],
          help: { title: 'Down the pay slip', pic: { kind: 'payslip', n: N, each: `${a}/${d}`, pct, metal: m.name, price: m.price },
            line: `Three sums, one after the other: the tonnes of ore (${N} lots of ${a}/${d} of a tonne), then the ${pct}% of it that is ${m.name}, then that many tonnes at ${credits(m.price)} credits each.`,
            steps: [`First the ore: ${N} × ${a}/${d} of a tonne`, `Then the ${m.name}: ${pct}% of that`, `Then the pay: the tonnes of ${m.name} × ${credits(m.price)}`] },
          own: { strand: 'pct', at: 76 }, credit: [{ strand: 'frac', at: 47, weight: 0.5 }],
          facts: { n: N, each: [a, d], pct, price: m.price, ore: O, metal: metal10 / 10, ans: pay, live: true, haul: H.n, from: fromOf(H) }, size: 3,
        }, rand);
      }
      for (let tries = 0; tries < 200; tries++) {
        const n = live ? live.canisters || CARRIES : t.pick([4, 5, 6, 8, 8, 10]), w = t.pick([5, 12, 15, 20, 25]), ore = n * w;   // tenths
        // (the dearer the metal, the less of the ore it is: nobody's ore is half gold)
        const pct = t.pick([10, 20, 25, 50, 30, 40]), metal10 = ore * pct / 100, m = t.pick(pct <= 10 ? METALS : pct <= 25 ? METALS.slice(0, 5) : METALS.slice(0, 4));
        if (!Number.isInteger(metal10) || metal10 < 5) continue;
        const pay = metal10 * m.price / 10, oneCan = w * pct * m.price / 1000;
        if (!Number.isInteger(pay)) continue;
        const cut = pct === 50 ? [2, 'half'] : pct === 25 ? [4, 'a quarter'] : pct === 20 ? [5, 'a fifth'] : pct === 10 ? [10, 'a tenth'] : null;
        const yieldSteps = cut ? [cutBy(r2(ore / 10), cut[0], `Then the ${m.name}: ${pct}% is ${cut[1]} of the ore`)]
          : [cutBy(r2(ore / 10), 10, 'Then 10% of the ore: a tenth of it'), { op: 'mul', a: r2(ore / 100), b: pct / 10, say: `Then the ${m.name}: ${pct}% is ${pct / 10} lots of 10%` }];
        return ownOrder({
          key: `pay:slip:${m.name}`, story: `This load is ${n} canisters, each holding ${t1(w)} tonnes of ore. ${pct}% of the ore is ${m.name}, and ${m.name} pays ${credits(m.price)} credits a tonne.`, ask: 'How many credits does the load pay?', right: P(pay),
          slips: [
            { ...P(ore * m.price / 10), slip: 'allOre', why: `That pays for all ${t1(ore)} tonnes as if every tonne were ${m.name}. Only ${pct}% of the ore is ${m.name}.` },
            { ...P(oneCan), slip: 'oneCanister', why: `That's the pay for one canister. There are ${n} of them.` },
            { ...P((ore - metal10) * m.price / 10), slip: 'rest', why: `That pays for the other ${100 - pct}%: the slag. Only the ${m.name} is paid for.` },
            { ...P(metal10 / 10), slip: 'noPrice', why: `${t1(metal10)} is the tonnes of ${m.name}. Each tonne pays ${credits(m.price)} credits.` },
            { ...P(pay + m.price), slip: 'off', why: `That's a tonne of ${m.name} too many. Work out the tonnes of ore, then the ${m.name}, then the pay.` },
          ].filter((s) => s.v > 0),
          rightWhy: `${n} × ${t1(w)} = ${t1(ore)} tonnes of ore; ${pct}% of it is ${t1(metal10)} tonnes of ${m.name}; × ${credits(m.price)} = ${pay.toLocaleString('en-US')} credits`,
          sum: [{ op: 'mul', a: w / 10, b: n, say: 'First the tonnes of ore in the load' }, ...yieldSteps, { op: 'mul', a: metal10 / 10, b: m.price, say: `Then the pay: the tonnes of ${m.name} times ${credits(m.price)} credits` }],
          lines: [['Ore', `${n} canisters × ${t1(w)} tonnes`], [cap(m.name), `${pct}% of the ore`], ['Price', `${credits(m.price)} credits a tonne`], ['Pay', '?']],
          help: { title: 'Down the pay slip', pic: { kind: 'payslip', n, w, pct, metal: m.name, price: m.price }, line: `Three sums, one after the other: the tonnes of ore, then the ${pct}% of it that is ${m.name}, then that many tonnes at ${credits(m.price)} credits each.`,
            steps: [`First the ore: ${n} × ${t1(w)} tonnes`, `Then the ${m.name}: ${pct}% of that`, `Then the pay: the tonnes of ${m.name} × ${credits(m.price)}`] },
          own: { strand: 'pct', at: 76 }, credit: [{ strand: 'dec', at: 60, weight: 0.5 }], facts: { n, w, pct, price: m.price, ore: ore / 10, metal: metal10 / 10, ans: pay, live: false }, size: 3,
        }, rand);
      }
      throw new Error('smelter pay slip: nothing made');
    },
  },
};

// ── the ladder: easiest first, every step small ──────────────────────────────────────────────────────────────────
const K = (step, w = 1) => ({ maker: 'wordsK', step, w });
const W = (step, types, w = 1) => ({ maker: 'words', step, types, w });
const M = (maker, step, w = 1) => ({ maker, step, w });

export const PLACE = {
  id: 'smelter', name: 'The smelter\'s hall', short: 'Smelter', math: 'What a haul of ore pays: fractions, weights, yields, credits', pic: 'smelter', job: null,
  line: 'Pay slips at the furnace console: canisters to count, the ore against the slag, tonnes of ore, the part that is metal, and what it pays.',
  levels: [
    { id: 'kCount', title: 'Counting canisters', line: 'Up to 5: the canisters on the Miner', gen: { mix: [M('count', 1, 2), K(1)] } },
    { id: 'kFull', title: 'Still on the ship, full and empty', line: 'Up to 8: 8 came in, 5 are still on the Miner', gen: { mix: [M('count', 2, 2), K(2)] } },
    { id: 'kRacks', title: 'Racks of the same', line: '3 racks with 2 canisters on each; 8 canisters and 5 more', strand: 'words', gen: { mix: [M('count', 3, 2), K(3)] } },
    { id: 'loads', title: 'Tonnes by the canister', line: '4 canisters with 3 tonnes in each; 15 tonnes and 18 together', gen: { mix: [W(1, ['groups', 'parts'])] } },
    { id: 'share', title: 'Sharing a load out', line: '24 tonnes into 4 canisters', gen: { mix: [W(2, ['share'], 2), W(1, ['groups'])] } },
    { id: 'part', title: 'A part of the load', line: '1/4 of the 12 tonnes is iron', gen: { mix: [M('part', 1, 2), W(3, ['groups', 'share', 'parts'])] } },
    { id: 'parts', title: 'Several parts', line: '3/4 of the 12 tonnes is slag', gen: { mix: [M('part', 2, 2), W(3, ['groups', 'share'])] } },
    // (canisters times a fraction of a tonne: the whole haul's ore first, a whole number of tonnes; then the answers
    // that are mixed numbers, as Mathwood's fishing dock has them at the same point of the school guide, 47)
    { id: 'oreWhole', title: 'Canisters of ore', line: '8 canisters with 3/4 of a tonne in each: 6 tonnes', gen: { mix: [M('ore', 1, 2), M('part', 2)] } },
    { id: 'oreTimes', title: 'Canisters times a fraction', line: '5 canisters with 3/4 of a tonne in each: 3 3/4 tonnes', gen: { mix: [M('ore', 2, 2), M('ore', 1)] } },
    { id: 'tenths', title: 'Weights in tenths', line: '1.2 tonnes and 0.9 tonnes together; 2.3 tonnes with 0.8 drained', gen: { mix: [M('weigh', 1, 2), M('part', 2)] } },
    { id: 'percent', title: 'Yields in percent', line: '25% of the 12 tonnes is iron', gen: { mix: [M('percent', 1, 2), M('weigh', 1)] } },
    { id: 'tonnes', title: 'A load of canisters', line: '8 canisters of 1.2 tonnes; 2 bars from every 5 tonnes', gen: { mix: [M('weigh', 2, 2), M('ratio', 3)] } },
    { id: 'anyPercent', title: 'Any percent', line: '35% of the 20 tonnes is iron', gen: { mix: [M('percent', 2, 2), M('weigh', 2)] } },
    { id: 'credits', title: 'What the metal pays', line: '2.8 tonnes of cobalt at 5,000 credits a tonne', gen: { mix: [M('pay', 1, 2), M('percent', 2)] } },
    { id: 'payslip', title: 'The whole pay slip', line: '8 canisters of 1.5 tonnes, 25% titanium, 6,000 credits a tonne', strand: 'pct', gen: { mix: [M('pay', 2, 2), M('ratio', 5)] } },
  ],
};

export const JOB = {
  // (named in the game's maker's own words: "I thought that there were controls in the smelter room for the smelter pay
  // desk?")
  id: 'smelter', name: 'The smelter controls', short: 'Smelter', open: true,
  // WHERE THE JOB IS: in the smelter's hall, at the forge's own thermal console (its FURNACE 1 and FURNACE 2 screens),
  // the glowing pours just past it. The game's maker (2026-11-16): "I think it would be a good idea to have one job per
  // room. I want people to have a reason to go into the smelter room and look at the pretty glowing metal. It makes
  // sense to me that the smelter equipment is what would have an accurate read on the amount of ore verses slag from
  // the haul." (Before, it was a desk in the smelter's control room, and before that the crane's chair, which now has
  // the crane's own two options: src/jobs/crane.js.)
  // (the station file's places: where one stands at the console, on its operator's side, and the middle of its two
  // screens. The smelter, one of the station's people, stands by the console's south end now and then, under the
  // catwalk: life.js forgeConsole, well clear of this job's ring)
  spot: { place: 'smelterControls' }, face: 'smelterControlsScreen',
  // the camera while it's up: the station file's view from behind the console's south end, over it to the nearer pour
  // and its ladle (the crew member stands at the console, in view)
  view: 'smelter-controls',
  sign: 'Smelter controls', hint: 'Work out what the haul pays',
  place: PLACE, setting: SETTING, makers: MAKERS,
  card: 'payslip',
};
