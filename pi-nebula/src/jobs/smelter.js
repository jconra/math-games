// THE SMELTER CONTROLS, in the smelter's hall at the forge's own console (its FURNACE screens), the glowing pours just
// past it: what a load of metal sells for (the game's maker, 2026-11-05: "they could go over to the controls and start
// calculating on the smelter to figure out how many credits they will get paid").
//
// A LOAD IS ALL METAL. The slips this job had before told of ore of which only a part poured as metal, in canisters of
// 3/4 of a tonne, and the game's maker (2026-11-18) found them confusing: "I am wondering why the weight of the
// canisters is only 3/4 of a tonne each, and what is the other 50% and why am I not getting paid for it?" So:
//   - A load is told by the SHARES of each metal in it. The shares add up to the whole load, and every bit of it is
//     sold. His two examples: "The 8 canisters contain a total of 50% iron, 25% nickel, and 25% titanium ... What is
//     the total sale price?" and "You collected 30 tonnes of ore. 80% is iron, 10% is nickel, 5% is tin, and 5% is
//     titanium. How many tons of each metal did you collect?" Nothing of a load is left unpaid, and no slip speaks of
//     a part of it that is not metal.
//   - A question is told in CANISTERS or in TONNES, never both ("I wouldn't try to mix tonnes and canisters, or I think
//     it gets too confusing"). ONE CANISTER HOLDS ONE TONNE (CAN_TONNES): the Miner's eight canisters are eight
//     tonnes, and the one price list, a tonne of each metal, is also what a canister of it sells for.
//   - Amounts are picked to come out clean ("it is free to round up or down the amount of ore to make the questions
//     work"): whole canisters; tonnes whole or in halves, and in tenths on the top rung.
//   - THE PAY IN TWO STEPS, as he set it out: first how many tonnes (or canisters) of each metal, a choice between
//     whole sets of numbers; then the total sale price, with the chart of what each metal sells for beside the
//     question (the chart the mining run shows: src/pricechart.js). The top rung is the whole of it in one go.
//
// The ladder, easiest first: counting the canisters on the ship, how many are still on it and which are full, racks
// of the same; tonnes by the trip and loads shared out; a part of the load (1/4 of the 12 tonnes is iron, the rest
// nickel), several parts (5/8 iron, 1/4 copper, 1/8 nickel); lots of a fraction (8 trips with 3/4 of a tonne on each,
// then 5 of them: 3 3/4 tonnes); weights in tenths (1.2 tonnes and 0.9 tonnes); shares in percent (25% of the load is
// iron); pour after pour (8 pours of 1.2 tonnes); any percent (35%); how much of each metal (30 tonnes: 80% iron, 10%
// nickel, 5% copper, 5% titanium); what a metal sells for (2.8 tonnes of cobalt); the total sale price in its two
// steps; and at the top the whole pay slip in one go. Decimals stay decimals; fractions stay fractions (3 3/4, never
// 3.75).
// Mathwood Valley's question makers tell the whole-number stories through SETTING (engine.js); the counting, the
// parts, the lots of a fraction, the weights, the percents, the shares and the pay are this job's own makers (MAKERS
// below). The fractions are Mathwood's own (labs/fishing/frac.js), and the lots of a fraction are its fishing dock's
// "fish times a fraction" (the level 'timesW', labs/fishing/pies.js) told as a drone's trips: a whole number of
// trips, a fraction of a tonne on each, tonnes only.
//
// THE HAUL (haulOf below): one for each landing of the Miner (src/crane.js's round: the hangar is set out afresh and the
// Miner lands again when the player leaves the area and comes back). The smelter's equipment reads the WHOLE haul, all
// its canisters, wherever they are. A haul is its STORE: so many tonnes of each metal in the Miner's eight canisters, a
// canister holding a tonne of ONE metal (the game's maker, 2026-11-18: "the canisters don't mix ore ... each canister
// holds a tonne, so we could use them interchangeably"; src/drill.js). A haul is a pure function of its number, so
// every slip about the same haul tells the same haul.
//   - A haul nobody the player knows flew (the Miner's own rounds while the player is about the station) is one of
//     HAULS: eight full canisters, so many of each metal, in quarters of the load, so that its shares are as easily
//     said as fractions (1/2, 1/4) as percents (50%, 25%).
//   - A HAUL THE PLAYER WENT OUT FOR (src/missions.js: they signed a captain's contract and went on the run, at the
//     drill or in the pilot's seat) is what they came home with (flownHaul's `store`): whole tonnes of each metal when
//     all eight canisters came home full ({ iron: 4, nickel: 3, copper: 1 }), and eighths of a tonne when they headed
//     home early ("round the level to the nearest 1/8th to make the math easier": { iron: 2.625, copper: 0.75 }).
//     "It's as simple as add up what they came back with and multiply each type of metal with what it is worth and
//     that's what you get paid." Its payout slip (src/missions.js) is that plain sum. A slip here about it tells the
//     same amounts, exactly (nothing is told round any more: the amounts are round as they come), in tonnes, an
//     eighth as a fraction (2 5/8 tonnes, never 2.625).
// haulOf gives a haul as its lots (`lots`: each metal, its tonnes, what a tonne of it sells for, what that comes to)
// and its pay as their plain sum. Who is paid what share of it is the contract's (src/missions.js), and the share is
// collected at this job's controls (its payout card, src/missions.js payoutOrder).
//
// THE HANGAR, RIGHT NOW. Where a question counts canisters, it counts the ones really there when the slip is made:
// the game hands each maker `live` (src/crane.js load(): the haul's number, how many canisters are on the ship, how
// many of them full, how many are plugged in at the wall, how many on the rack, and for how long each of those stays
// as it is). A count is used only if it suits the level and the crane's timetable says it will still be true for
// STEADY seconds, so the answer is not out of date before it is picked, and only once (the next slip about the
// hangar waits until the crane has changed that count); otherwise, and in node, the numbers are the job's own (a slip
// "from the log"). What the displays read is NOT taken live: a draining canister's display changes every second, so a
// question about it would be wrong before it was read. A slip about the whole haul (its shares, what it sells for) is
// asked once a haul too: the same slip with the same answer twice running teaches nothing.
//
// THE PRICES: ONE LIST (CHART), the game's maker's own chart of what a tonne of each metal is worth (iron 20, nickel
// 30, copper 40, cobalt 50, titanium 60, gold 80), every one multiplied by the same number (PRICE_TIMES). "If they make
// too much money then reduce the sell price. If they don't make enough money then increase the sell price": that is
// PRICE_TIMES, and nothing else. The same list is the chart at the asteroid field (src/drillview.js), the payout
// (src/missions.js) and every slip here. Each metal's colour and symbol are with it (ORE), so the list of metals is
// one list too.
import { dec } from '../../../mathwood-valley/src/math/counterkit.js';
import { fr, gcd, simplest, fracText, partsWord } from '../../../mathwood-valley/labs/fishing/frac.js';
import { ownOrder } from './engine.js';

const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
const TONNE = ['tonne', 'tonnes'], CAN = ['canister', 'canisters'], CREDIT = ['credit', 'credits'];
export const STEADY = 40;      // seconds a live count must stay as it is to be asked about
export const CARRIES = 8;      // canisters a Miner carries (the parked one's mounts: kit/ships/miner-built.js)
export const CAN_TONNES = 1;   // ONE CANISTER HOLDS ONE TONNE of metal (so a canister of a metal sells for a tonne's price)
export const HOLD = CARRIES * CAN_TONNES;   // tonnes of metal the Miner's eight canisters hold together
// a pour, a drone's trip, a pallet: its weight in tenths of a tonne (the 'weigh' maker's own numbers)
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
// each metal's glow (the game's maker's picture: gold amber, copper teal) and its symbol: the colour of its ore in the
// rocks (src/drill.js hands it on), of its dot on the price chart and on these slips
export const ORE = {
  iron: { sym: 'Fe', glow: '#ff4a36' }, nickel: { sym: 'Ni', glow: '#a4f36a' }, copper: { sym: 'Cu', glow: '#2fe3cf' },
  cobalt: { sym: 'Co', glow: '#5a8cff' }, titanium: { sym: 'Ti', glow: '#d6ccff' }, gold: { sym: 'Au', glow: '#ffc233' },
};
const glowOf = (name) => (ORE[name] || ORE.copper).glow;
// what a tonne of a metal sells for, by its name (0: not a metal the smelter pours)
export const priceOf = (name) => { const M = METALS.find((m) => m.name === name); return M ? M.price : 0; };
// THE CHART beside a question: what a tonne (or, a canister holding a tonne, a canister) of each metal sells for.
// The one price list, all of it, as the mining run shows it (src/pricechart.js draws both).
export const chartOf = (unit = TONNE) => ({ title: `A ${unit[0]} sells for`, rows: METALS.map((m) => [m.name, m.price]) });
const credits = (n) => Number(n).toLocaleString('en-US');   // a price or a pay in words: 15,000
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const list = (w) => (w.length <= 1 ? w.join('') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`);

// ── THE HAUL: what the smelter's equipment reads of one landing's canisters ─────────────────────────────────────────
//   haulOf(n) -> { n, canisters, flown, store, lots, tonnes, pay }
//     canisters  all the haul's canisters (CARRIES), wherever they are now: on the ship, at the wall, on the rack
//     flown      the player went out for this haul (flownHaul); else one of the Miner's own (HAULS)
//     store      { iron: 4, nickel: 2, titanium: 2 }: the tonnes of each metal in it (a haul the player went out for
//                and headed home early with: in eighths of a tonne)
//     lots       [{ metal, tonnes, price, pay }], the most tonnes first: the plain sum, metal by metal
//     tonnes     all of it; pay: what it sells for, in credits (the lots' pay added up)
// THE MINER'S OWN HAULS: the tonnes of each metal in its eight canisters. A canister holds a tonne of one metal, so
// each is a load that came from canisters by metal: so many full canisters of each, eight in all, every one in
// quarters of the load. The first is the game's maker's own example.
const HAULS = [
  { iron: 4, nickel: 2, titanium: 2 }, { iron: 4, nickel: 4 }, { iron: 6, copper: 2 }, { iron: 2, nickel: 2, copper: 2, cobalt: 2 },
  { nickel: 4, iron: 2, copper: 2 }, { iron: 6, nickel: 2 }, { iron: 4, copper: 4 }, { iron: 4, nickel: 2, cobalt: 2 },
  { nickel: 6, iron: 2 }, { iron: 4, nickel: 2, copper: 2 }, { iron: 4, copper: 2, cobalt: 2 }, { iron: 6, cobalt: 2 },
];

// a store tidied: only metals the smelter pours, each to the thousandth of a tonne (so the hundredths a run counts in
// and the eighths a load headed home early is rounded to are both kept exactly), none empty
const thousandths = (t) => Math.round(Number(t) * 1000);
export function tidyStore(store) {
  const out = {};
  for (const M of METALS) { const k = thousandths((store || {})[M.name] || 0); if (k > 0) out[M.name] = k / 1000; }
  return out;
}
// THE PLAIN SUM: what a store sells for. Each metal's tonnes times what a tonne of it sells for, added up.
// -> { lots: [{ metal: { name, price }, tonnes, price, pay }] (the most tonnes first), tonnes, pay }
export function sellsFor(store) {
  const S = tidyStore(store);
  const lots = METALS.filter((M) => S[M.name]).map((M) => ({ metal: M, tonnes: S[M.name], price: M.price, pay: thousandths(S[M.name]) * M.price / 1000 }))
    .sort((p, q) => q.tonnes - p.tonnes || q.price - p.price);
  return { lots, tonnes: lots.reduce((sum, L) => sum + thousandths(L.tonnes), 0) / 1000, pay: lots.reduce((sum, L) => sum + L.pay, 0) };
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
  const k = haulNo(n), F = FLOWN.get(k) || null, store = F ? { ...F.store } : { ...HAULS[k % HAULS.length] }, S = sellsFor(store);
  return { n: k, canisters: CARRIES, flown: !!F, store, lots: S.lots, tonnes: S.tonnes, pay: S.pay };
}
// EIGHTHS ARE SAID AS FRACTIONS (2 5/8 tonnes, never 2.625): a load that came home in whole tonnes and eighths of a
// tonne, as every load does now (all eight canisters full, or headed home early and rounded). Amounts in hundredths
// (the scan of a rock that has been drilled; a payout kept from before the canisters) stay decimals.
export const inEighths = (lots) => lots.every((L) => thousandths(L.tonnes) % 125 === 0);
export const eighthsOf = (t) => simplest(fr(Math.round(thousandths(t) / 125), 8));   // 2.625 -> 21/8; 0.75 -> 3/4
export const eighthsText = (t) => fracText(eighthsOf(t));   // "2 5/8", "3/4", "3"
// tonnes as they are said: "3 tonnes", "1 tonne", "1.5 tonnes", "0.75 of a tonne"; eighths: "2 5/8 tonnes", "3/4 of
// a tonne"
export const tonnesWords = (t, eighths = false) => { if (eighths) return ofT(eighthsOf(t)); const h = Math.round(Number(t) * 100), w = dec(h, 2, { trim: true }); return h === 100 ? '1 tonne' : h < 100 ? `${w} of a tonne` : `${w} tonnes`; };
// "3 tonnes of iron, 2 5/8 tonnes of nickel and 3/4 of a tonne of titanium" (a store's lots, or [{ metal, tonnes }] by name)
export const lotsWords = (lots) => { const e = inEighths(lots); return list(lots.map((L) => `${tonnesWords(L.tonnes, e)} of ${L.metal.name || L.metal}`)); };

// ── fractions of a tonne (Mathwood's own fractions: labs/fishing/frac.js) ───────────────────────────────────────
// in a sentence: "3/4 of a tonne", "1 tonne", "3 3/4 tonnes"; on an answer button: "3 3/4" big, "tonnes" small
// ("3/4" and "of a tonne"), its value the simplest fraction's text, so two answers of the same amount are one
const ofT = (f) => { const s = simplest(f); return s.n < s.d ? `${fracText(s)} of a tonne` : `${fracText(s)} ${s.n === s.d ? 'tonne' : 'tonnes'}`; };
const FT = (f) => { const s = simplest(f), big = fracText(s), small = s.n < s.d ? 'of a tonne' : s.n === s.d ? 'tonne' : 'tonnes'; return { v: `${s.n}/${s.d}`, big, small, label: `${big} ${small}` }; };
const ONE_PART = { 2: 'half', 3: 'third', 4: 'quarter', 5: 'fifth', 6: 'sixth', 8: 'eighth', 10: 'tenth' };
const parts = (d, k = 2) => (k === 1 ? ONE_PART[d] || `${d}th` : partsWord(d));

export const SETTING = {
  folk: FOLK,
  // the youngest: canisters to count (Mathwood's picture-story shape for a can)
  things: [{ key: 'canisters', unit: CAN, shape: 'can' }],
  kmoreHow: [({ b }) => `The crane brings ${b} more.`, ({ b }) => `A supply drone drops off ${b} more.`, ({ b, p }) => `${p.They} finds ${b} more on the rack.`],
  kleftHow: [({ b }) => `The crane took ${b} of them to the wall.`, ({ b, p }) => `${p.They} sent ${b} of them back to the ship.`, ({ b }) => `${b} of them went to the furnace.`],
  // (every story is told in tonnes or in canisters, never both: a trip brings so many tonnes, a drone so many canisters)
  groups: [
    { key: 'trips', item: ['trip', 'trips'], unit: TONNE, story: ({ a, b, f }) => `${f.name} made ${a} trips to the rocks and brought home ${b} tonnes of iron on each trip.`, ask: () => 'How many tonnes of iron is that?' },
    { key: 'bars', item: ['pallet', 'pallets'], unit: ['bar', 'bars'], story: ({ a, b }) => `The smelter stacked ${a} pallets, with ${b} bars of iron on each pallet.`, ask: () => 'How many bars is that?' },
    { key: 'drones', item: ['cargo drone', 'cargo drones'], unit: CAN, story: ({ a, b }) => `${a} cargo drones are due in today, each carrying ${b} canisters.`, ask: () => 'How many canisters will the crane have to move?' },
    { key: 'docking', item: CAN, unit: ['minute', 'minutes'], story: ({ a, b }) => `The crane takes ${b} minutes to dock each canister. There are ${a} canisters to dock.`, ask: () => 'How many minutes will that take?' },
  ],
  share: [
    { key: 'trips', thing: TONNE, box: ['trip', 'trips'], story: ({ total, groups, f }) => `${f.name} brought home ${total} tonnes of nickel in ${groups} trips, the same on every trip.`, ask: 'How many tonnes did each trip bring?' },
    { key: 'bars', thing: ['bar', 'bars'], box: ['pallet', 'pallets'], story: ({ total, groups }) => `The smelter poured ${total} bars of iron, stacked evenly on ${groups} pallets.`, ask: 'How many bars go on each pallet?' },
    { key: 'pay', thing: CREDIT, box: ['pay packet', 'pay packets'], story: ({ total, groups, f }) => `${f.name}'s load sold for ${total} credits. It goes evenly into ${groups} pay packets, one for each of the crew.`, ask: 'How many credits go in each pay packet?' },
  ],
  crates: [
    { key: 'trips', box: ['trip', 'trips'], story: ({ total, per, f }) => `${f.name} has ${total} canisters to bring in from the rocks. A cargo drone carries ${per} canisters on a trip.`, ask: 'How many trips does the drone need to bring them all?' },
    { key: 'pallets', box: ['pallet', 'pallets'], story: ({ total, per }) => `The smelter poured ${total} bars of iron today. A pallet holds ${per} bars.`, ask: 'How many pallets are needed for every bar?' },
  ],
  partsLeft: [
    { key: 'hopper', unit: TONNE, story: ({ a, b }) => `The furnace's hopper held ${a} tonnes of iron. The furnace has melted ${b} tonnes of it.`, ask: 'How many tonnes are left in the hopper?' },
    { key: 'barsLeft', unit: ['bar', 'bars'], story: ({ a, b }) => `The smelter poured ${a} bars of iron this week. A freighter took ${b} of them away.`, ask: 'How many bars are left?' },
    { key: 'toDock', unit: CAN, story: ({ a, b }) => `There were ${a} canisters to dock this shift. The crane has docked ${b} of them.`, ask: 'How many are still to dock?' },
  ],
  partsTogether: [
    { key: 'runs', unit: TONNE, story: ({ a, b }) => `The morning run brought home ${a} tonnes of iron and the evening run ${b} tonnes.`, ask: 'How many tonnes came in today?' },
    { key: 'metals', unit: ['bar', 'bars'], story: ({ a, b }) => `The smelter poured ${a} bars of iron and ${b} bars of nickel.`, ask: 'How many bars is that in all?' },
    { key: 'docked', unit: CAN, story: ({ a, b }) => `The crane docked ${a} canisters before lunch and ${b} after lunch.`, ask: 'How many canisters did it dock today?' },
  ],
  recipe: [
    { key: 'flux', make: CAN, unit: ['bag of flux', 'bags of flux'], small: ['bag', 'bags'],
      story: ({ base, per, want }) => `The furnace's recipe: ${u(per, ['bag of flux', 'bags of flux'])} for ${base} canisters. Today's load is ${want} canisters.`, ask: () => 'How many bags of flux does the furnace need?' },
  ],
  tables: [
    { key: 'bars', top: ['tonne of iron', 'tonnes of iron'], bot: ['bar of iron', 'bars of iron'], botShort: ['bar', 'bars'], s: (a, b) => `The furnace pours ${a} bars from every ${b} tonnes of iron.` },
    { key: 'flux', top: CAN, bot: ['bag of flux', 'bags of flux'], botShort: ['bag', 'bags'], s: (a, b) => `The furnace needs ${a} bags of flux for every ${b} canisters it melts.` },
    { key: 'cells', top: ['hour', 'hours'], bot: ['fuel cell', 'fuel cells'], botShort: ['cell', 'cells'], s: (a, b) => `The furnace uses ${a} fuel cells every ${b} hours.` },
  ],
  shares: {
    names: [['iron', 'nickel'], ['nickel', 'copper'], ['iron', 'titanium']],
    what: [['tonne', 'tonnes', 'tonne', 'tonnes']],
    story: ({ x, y, total, a, b }) => `The furnace is fed ${a} ${a === 1 ? 'part' : 'parts'} ${x} to ${b} ${b === 1 ? 'part' : 'parts'} ${y}, ${total} tonnes in all.`,
    ask: ({ who }) => `How many tonnes of ${who} go in?`,
  },
  proportions: [
    ({ n, d, D }) => ({ key: 'iron', s: `${n} of every ${d} tonnes of this load ${n === 1 ? 'is' : 'are'} iron, and the rest is nickel. The load is ${D} tonnes.`, ask: 'How many tonnes are iron?', unit: TONNE, what: 'iron' }),
    ({ n, d, D }) => ({ key: 'nickel', s: `${n} of every ${d} loads from the far belt ${n === 1 ? 'is' : 'are'} nickel, and the others are iron. This month ${D} loads came in from there.`, ask: 'How many of them are nickel?', unit: ['load', 'loads'], what: 'nickel' }),
    ({ n, d, D }) => ({ key: 'copper', s: `${n} of every ${d} bars poured today ${n === 1 ? 'is' : 'are'} copper. The smelter poured ${D} bars.`, ask: 'How many are copper?', unit: ['bar', 'bars'], what: 'copper' }),
  ],
};

// ── the faces on the answer buttons ──────────────────────────────────────────────────────────────────────────────
// a whole count with its unit; a decimal kept as a whole number of hundredths (no rounding slips), printed without
// zeros it does not need: 960 -> "9.6 tonnes", 1200 -> "12 tonnes", 816 -> "8.16 tonnes"
const C = (n, unit) => ({ v: n, big: n.toLocaleString('en-US'), small: n === 1 ? unit[0] : unit[1], label: u(n, unit) });
const D = (h, unit = TONNE) => { const n = Math.round(h), big = dec(n, 2, { trim: true }), small = n === 100 ? unit[0] : unit[1]; return { v: n, big, small, label: `${big} ${small}` }; };
// credits: whole ones with their commas
const P = (cr) => { const n = Math.round(cr * 100), whole = n % 100 === 0; return { v: n, big: whole ? (n / 100).toLocaleString('en-US') : dec(n, 2, { trim: true }), small: n === 100 ? CREDIT[0] : CREDIT[1], label: `${whole ? n / 100 : dec(n, 2, { trim: true })} ${n === 100 ? CREDIT[0] : CREDIT[1]}` }; };
const t1 = (tenths) => dec(tenths, 1, { trim: true });           // tenths as text: 12 -> "1.2", 20 -> "2"
const nf = (x) => dec(Math.round(x * 100), 2, { trim: true });    // an amount as text: 24 -> "24", 1.5 -> "1.5"
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
// THE TWO STEPS of the pay are two slips about ONE load: the load whose amounts were just worked out, waiting for the
// slip that asks what it all sells for ({ L, who })
let pending = null;
export const forget = () => { asked.clear(); pending = null; };   // (the tests start each case afresh)
// what a slip about the whole haul says it is about, on its top
const fromOf = (H) => (H.flown ? 'Your crew\'s haul' : 'This haul');
// (which of the Miner's canisters are still full at the top of a round: all the ones on it while it is being unloaded,
// where it came in with all eight full: a haul headed home early has part-full and empty ones among them)
const unloading = (live) => !!live && live.phase === 'unload' && haulOf(live.round).tonnes >= HOLD;
// the Miner's own haul in the hangar, where a slip may be about its shares (not one the player went out for: its
// shares need not come out as quarters of the load, 3 canisters of 8 are 37.5%; it has a slip of its own, the pay's),
// once a haul for each kind of slip
const ownHaul = (live, what, n = 0) => { if (!live) return null; const H = haulOf(live.round); if (H.flown || !isNew(live, what, n)) return null; used(live, what, n); return H; };

// a part of x as a sum the worked sheet can do: x ÷ b; or, where whole numbers would not share out evenly (12 ÷ 10
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

// ── A LOAD TOLD BY ITS SHARES ────────────────────────────────────────────────────────────────────────────────────
// { unit: CAN | TONNE, total, parts: [{ m: { name, price }, pct, amt }] (the most first; the dearer the metal, the
// less of it), haul: the haul's number where the load is the haul in the hangar }. The shares add up to 100%, and the
// amounts to the whole load.
const SPLITS = {
  2: [[50, 50], [75, 25], [60, 40], [70, 30], [80, 20], [90, 10]],
  3: [[50, 25, 25], [50, 30, 20], [60, 30, 10], [60, 20, 20], [70, 20, 10], [40, 40, 20], [40, 30, 30], [80, 10, 10], [70, 25, 5], [60, 25, 15]],
  4: [[80, 10, 5, 5], [40, 30, 20, 10], [50, 20, 20, 10], [25, 25, 25, 25], [40, 20, 20, 20], [60, 20, 10, 10], [50, 25, 15, 10], [70, 10, 10, 10]],
};
// the dearer the metal, the less of a load it is: nobody's load is half gold (the most each may be, in percent)
const RARE = { cobalt: 40, titanium: 25, gold: 10 };
const quarters = (s) => s.every((p) => p % 25 === 0), tens = (s) => s.every((p) => p % 10 === 0);
const OFTEN = [6, 5, 4, 3, 3, 2];   // how often each metal of the chart is in a slip's load: iron most, gold least
// k metals of the chart, no two alike, in the chart's order (the cheapest first)
function metalsFor(t, k) {
  const left = METALS.map((m, i) => ({ m, w: OFTEN[i] })), out = [];
  while (out.length < k) { let x = t.int(1, left.reduce((s, e) => s + e.w, 0)), i = 0; while ((x -= left[i].w) > 0) i++; out.push(left.splice(i, 1)[0].m); }
  return out.sort((a, b) => a.price - b.price);
}
// the kinds of load:
//   'cans8'   a Miner's 8 canisters (or two Miners' 16), in quarters: whole canisters
//   'cans'    a week's 20 or 40 canisters, shares in fives and tens: whole canisters
//   'tonnes'  10 to 80 tonnes, shares in fives and tens: tonnes whole or in halves (30 tonnes: 24, 3, 1.5 and 1.5)
//   'tenths'  8 to 24 tonnes, shares in tens or quarters: tonnes in tenths (12 tonnes: 6, 3.6 and 2.4), the top rung's
function loadOf(t, { ks = [2, 3], kinds = ['cans8', 'cans', 'tonnes'] } = {}) {
  for (let tries = 0; tries < 200; tries++) {
    const kind = t.pick(kinds), k = t.pick(ks), pool = SPLITS[k].filter(kind === 'cans8' ? quarters : kind === 'tenths' ? (s) => tens(s) || quarters(s) : () => true);
    if (!pool.length) continue;
    const split = t.pick(pool), unit = kind === 'cans8' || kind === 'cans' ? CAN : TONNE;
    const total = kind === 'cans8' ? t.pick([CARRIES, CARRIES, CARRIES, 2 * CARRIES]) : kind === 'cans' ? t.pick([20, 40]) : kind === 'tenths' ? t.pick([8, 12, 16, 24]) : 10 * t.pick([1, 2, 3, 4, 5, 6, 8]);
    const ms = metalsFor(t, k), ps = split.map((pct, i) => ({ m: ms[i], pct, amt: r2(total * pct / 100) }));
    // (whole canisters; tonnes whole or in halves; on the top rung, in tenths)
    const clean = (x) => (unit === CAN ? Number.isInteger(x) : kind === 'tenths' ? Number.isInteger(r2(x * 10)) : Number.isInteger(x * 2));
    if (ps.some((p) => p.pct > (RARE[p.m.name] || 100))) continue;
    if (ps.every((p) => clean(p.amt))) return { unit, total, parts: ps, haul: null };
  }
  // (the game's maker's own example)
  return { unit: CAN, total: CARRIES, parts: [{ m: METALS[0], pct: 50, amt: 4 }, { m: METALS[1], pct: 25, amt: 2 }, { m: METALS[4], pct: 25, amt: 2 }], haul: null };
}
// the Miner's own haul in the hangar as a load: its eight canisters, the most first, of two alike the cheaper first
const haulLoad = (H) => ({ unit: CAN, total: H.canisters, haul: H.n,
  parts: H.lots.map((L) => ({ m: L.metal, pct: Math.round(L.tonnes / H.tonnes * 100), amt: Math.round(L.tonnes / CAN_TONNES) })).sort((a, b) => b.amt - a.amt || a.m.price - b.m.price) });
// an amount as it is said: "4 canisters", "1.5 tonnes", "0.5 of a tonne"; of a load in eighths: "2 5/8 tonnes"
const amtWords = (x, unit, eighths = false) => (unit === CAN ? u(x, CAN) : tonnesWords(x, eighths));
// A LOAD IN WORDS, by its shares (the game's maker's own sentence: "The 8 canisters contain a total of 50% iron, 25%
// nickel and 25% titanium."; "... collected 30 tonnes of ore. 80% is iron, 10% is nickel ...") or by its amounts ("Of
// the 8 canisters of this load, 4 hold iron, 2 hold nickel and 2 hold titanium."). W: whose crew it was, if anyone's.
// Kept short: on the slips that have the chart, the words stand beside it.
function toldLoad(L, W, how) {
  const T = L.total, ps = L.parts;
  if (L.unit === CAN) {
    const one = L.haul != null ? 'this haul' : T === CARRIES ? 'this load' : null, lead = T === 2 * CARRIES ? `Two Miners came in with ${T} canisters` : `This week the Miners brought in ${T} canisters`;
    const hold = list(ps.map((p) => `${p.amt} hold ${p.m.name}`)), shares = list(ps.map((p) => `${p.pct}% ${p.m.name}`));
    if (how === 'shares') return one ? `The ${T} canisters of ${one} contain a total of ${shares}.` : `${lead}. The ${T} canisters contain a total of ${shares}.`;
    return one ? `Of the ${T} canisters of ${one}, ${hold}.` : `${lead}: ${hold}.`;
  }
  const crew = W ? `${W}'s crew` : 'A mining crew';
  return how === 'shares' ? `${crew} collected ${T} tonnes of ore. ${cap(list(ps.map((p) => `${p.pct}% is ${p.m.name}`)))}.` : `${crew} collected ${T} tonnes of ore: ${list(ps.map((p) => `${tonnesWords(p.amt)} of ${p.m.name}`))}.`;
}
// HOW MUCH OF EACH METAL, as sums the worked sheet can do. A share in quarters is cut straight from the load: a
// half, a quarter, three quarters. Any other: 10% of the load first, then the share as so many 10%s (and half of 10%
// for a 5). A sum two metals share (two shares of 25%) is worked once, for both. A step that works on from an earlier
// one names it (`uses`).
// -> { steps, by: the step that finds each share's amount, by its percent }
const QUARTER = { 50: '50% is half', 25: '25% is a quarter', 75: '75% is three quarters' };
function amountSteps(L) {
  const T = L.total, units = L.unit[1], steps = [], seen = new Map(), by = new Map(), ten = r2(T / 10);
  // (a sum already there is not written twice: the step it was is handed back)
  const push = (s, uses = null) => { const k = `${s.op}:${s.a}:${s.b}`; if (!seen.has(k)) { if (uses) s.uses = uses; seen.set(k, s); steps.push(s); } return seen.get(k); };
  // (the metals of one share, named together)
  const names = new Map(); for (const p of L.parts) names.set(p.pct, [...(names.get(p.pct) || []), p.m.name]);
  const the = (pct) => `The ${list(names.get(pct))}`;
  const first = [...names.keys()].some((pct) => pct !== 100 && !QUARTER[pct]) ? push(cutBy(T, 10, `First 10%: a tenth of the ${T} ${units}`)) : null;
  for (const pct of names.keys()) {
    if (pct === 100) by.set(pct, push({ op: 'mul', a: T, b: 1, say: `${the(pct)}: all of the ${T} ${units}` }));
    else if (pct === 50) by.set(pct, push(cutBy(T, 2, `${the(pct)}: 50% is half of the ${T} ${units}`)));
    else if (pct === 25) by.set(pct, push(cutBy(T, 4, `${the(pct)}: 25% is a quarter of the ${T} ${units}`)));
    else if (pct === 75) { const q = push(cutBy(T, 4, `First 25%: a quarter of the ${T} ${units}`)); by.set(pct, push({ op: 'mul', a: r2(T / 4), b: 3, say: `${the(pct)}: 75% is 3 lots of 25%` }, { a: q })); }
    else {
      const k = Math.floor(pct / 10), five = pct % 10 === 5;
      let found = first;
      if (k > 1) found = push({ op: 'mul', a: ten, b: k, say: `${five ? `For the ${list(names.get(pct))}, ${k * 10}%` : `${the(pct)}: ${pct}%`} is ${k} lots of 10%` }, { a: first });
      if (five) {
        const half = push(cutBy(ten, 2, k ? '5% is half of 10%' : `${the(pct)}: 5% is half of 10%`), { a: first });
        found = k >= 1 ? push({ op: 'add', a: r2(ten * k), b: r2(ten / 2), say: `${the(pct)}: ${k * 10}% and 5% make ${pct}%` }, { a: found, b: half }) : half;
      }
      by.set(pct, found);
    }
  }
  return { steps, by };
}
// ... and Help's one line on how to go about it: the shares in quarters by name, the others from 10%
function amountsLine(L) {
  const T = L.total, units = L.unit[1], pcts = [...new Set(L.parts.map((p) => p.pct))], cut = pcts.filter((x) => QUARTER[x]).map((x) => QUARTER[x]), rest = pcts.filter((x) => !QUARTER[x]);
  const five = rest.some((x) => x % 10) ? ', and 5% is half of 10%' : '', whole = 'Together the shares make the whole load.';
  if (!rest.length) return `Every share is a part of the ${T} ${units}: ${list(cut)}. ${whole}`;
  if (!cut.length) return `Find 10% of the ${T} ${units} first: ${T} ÷ 10. Every share is so many 10%s${five}. ${whole}`;
  return `${cap(list(cut))} of the ${T} ${units}. For the other shares find 10% first: ${T} ÷ 10. Each is so many 10%s${five}. ${whole}`;
}
// each metal's amount at its price, then all of them added up. by: the steps that found the amounts (amountSteps),
// where the slip had them worked out first. A load in eighths (L.eighths): a metal with a part of a tonne is worked
// in two whole-number sums, what one part of a tonne sells for and then so many of them (2 5/8 tonnes of iron: 2,000
// ÷ 8, then 21 of those)
function saleSteps(L, pays, by = null) {
  const ps = L.parts, steps = [], found = [];      // (found: the step that gives each metal's own sale)
  ps.forEach((p, i) => {
    const f = L.eighths ? eighthsOf(p.amt) : null;
    if (f && f.d > 1) {
      const one = { op: 'div', a: p.m.price, b: f.d, say: `The ${p.m.name}: first what 1/${f.d} of a tonne sells for` };
      steps.push(one, { op: 'mul', a: f.n, b: p.m.price / f.d, say: `Then ${tonnesWords(p.amt, true)} ${f.n === 1 ? 'is one of those' : `${p.amt > 1 ? 'are' : 'is'} ${f.n} of those`}`, uses: { b: one } });
    } else steps.push({ op: 'mul', a: p.amt, b: p.m.price, say: by ? `The ${p.m.name}: its ${L.unit[1]} at ${credits(p.m.price)} credits each` : `The ${p.m.name}: ${amtWords(p.amt, L.unit, !!L.eighths)} at ${credits(p.m.price)} credits`, ...(by && by.get(p.pct) ? { uses: { a: by.get(p.pct) } } : {}) });
    found[i] = steps[steps.length - 1];
  });
  let sum = pays[0], last = found[0];
  for (let i = 1; i < ps.length; i++) { const add = { op: 'add', a: sum, b: pays[i], say: i === 1 ? 'Then the first two together' : `And the ${ps[i].m.name}`, uses: { a: last, b: found[i] } }; steps.push(add); sum += pays[i]; last = add; }
  return steps;
}
// A SLIP'S SUMS MARKED AS ITS STEPS SAY: which of a step's numbers is an earlier step's answer, carried in (the worked
// sheet shows it so, and Help's steps write it as a "?"). Left to find them by their numbers alone, engine.js's sumOf
// would take "2 x 6,000" for 2 times a 6,000 just worked out, wherever two numbers of a slip happen to be alike.
function carriedBy(o, steps) {
  const chain = o.sum ? o.sum.chain || [o.sum] : [];
  if (chain.length !== steps.length) return o;
  chain.forEach((x, i) => {
    const c = {};
    for (const side of ['a', 'b']) { const k = steps[i].uses && steps[i].uses[side] ? steps.indexOf(steps[i].uses[side]) : -1; if (k >= 0 && k < i) c[side] = k; }
    if (Object.keys(c).length) x.carried = c; else delete x.carried;
  });
  return o;
}
// the boxes of a slip's help picture: one for each metal, a dot of its colour
const boxesOf = (L, mid, bot) => L.parts.map((p) => ({ top: p.m.name, mid: mid(p), bot: bot(p), glow: glowOf(p.m.name) }));
const madeBy = (o, who) => { if (who) o.who = who; return o; };
// so many tonnes come in, as a slip's first words: one load while the number is a load's size, a month of loads past that
const cameIn = (whole) => (whole <= 30 ? `A load of ${whole} tonnes came in.` : `This month the Miners brought in ${whole} tonnes of metal.`);

// STEP ONE: HOW MUCH OF EACH METAL. The load by its shares; the answers are whole sets of numbers, one for each metal
// ("24 tonnes of iron, 3 tonnes of nickel, 1.5 tonnes of copper and 1.5 tonnes of titanium"). The wrong sets are the
// usual slips: the percents taken for the amounts; a set that adds up but gives a metal the wrong share; two metals'
// shares changed over; the load shared out evenly; a set that adds up to more, or to less, than the load.
function eachCard(L, { t, rand, who = null, W, key = 'each', H = null }) {
  const T = L.total, unit = L.unit, units = unit[1], ps = L.parts, k = ps.length, right = ps.map((p) => p.amt), last = k - 1;
  const face = (amts) => ({ v: amts.map(nf).join('|'), big: amts.map(nf).join(' · '), small: units, rows: amts.map((a, i) => [ps[i].m.name, nf(a)]),
    label: list(amts.map((a, i) => `${nf(a)} ${a === 1 ? unit[0] : units} of ${ps[i].m.name}`)) });
  const step = right.every(Number.isInteger) ? 1 : 0.5, j = right.findIndex((a) => a !== right[0]);
  const wrong = t.shuffle([
    ...(right[0] - step > 0 ? [{ amts: right.map((a, i) => (i === 0 ? r2(a - step) : i === last ? r2(a + step) : a)), slip: 'shifted', why: `Those add up to ${T}, but ${ps[last].pct}% of the ${T} ${units} is ${nf(right[last])}, not ${nf(right[last] + step)}.` }] : []),
    ...(j > 0 ? [{ amts: right.map((a, i) => (i === 0 ? right[j] : i === j ? right[0] : a)), slip: 'swapped', why: `That gives the ${ps[j].m.name} the ${ps[0].m.name}'s share. ${ps[0].pct}% is ${ps[0].m.name}: ${nf(right[0])} of the ${T} ${units}.` }] : []),
    ...(j > 0 && Number.isInteger(T / k * 2) ? [{ amts: right.map(() => T / k), slip: 'even', why: `That shares the ${T} ${units} out evenly. The shares are not equal: ${ps[0].pct}% is ${ps[0].m.name}.` }] : []),
    { amts: right.map((a, i) => (i === last ? r2(a + step) : a)), slip: 'over', why: `Those add up to ${nf(T + step)} ${units}, more than the ${T} there are. Every share is a part of the ${T}.` },
    ...(right[0] - step > 0 ? [{ amts: right.map((a, i) => (i === 0 ? r2(a - step) : a)), slip: 'short', why: `Those add up to only ${nf(T - step)} ${units}. Every bit of the load is one metal or another: ${T} ${units} in all.` }] : []),
  ]);
  const slips = [{ amts: ps.map((p) => p.pct), slip: 'percentCount', why: `Those are the percents, not the ${units}. ${ps[0].pct}% means ${ps[0].pct} out of every 100: of the ${T} ${units}, that is ${nf(right[0])}.` }, ...wrong];
  const sums = amountSteps(L).steps;
  return madeBy(carriedBy(ownOrder({
    key: `${key}:${unit === CAN ? 'cans' : 'tonnes'}:${k}`, story: toldLoad(L, W, 'shares'), ask: unit === CAN ? 'How many canisters of each metal is that?' : 'How many tonnes of each metal did they collect?',
    right: face(right), slips: slips.map((s) => ({ ...face(s.amts), slip: s.slip, why: s.why })),
    rightWhy: `${ps.map((p) => `${p.pct}% of ${T} is ${nf(p.amt)}`).join(', ')}: ${right.map(nf).join(' + ')} = ${T} ${units}, the whole load.`,
    sum: sums,
    help: { title: 'Share by share', pic: { kind: 'boxes', boxes: boxesOf(L, (p) => `${p.pct}%`, () => `of ${T} = ?`), op: '', ask: `how many ${units} of each?` }, line: amountsLine(L) },
    own: { strand: 'pct', at: 64 }, credit: [{ strand: 'frac', at: 40, weight: 0.5 }],
    facts: { load: { unit: units, total: T, parts: ps.map((p) => ({ metal: p.m.name, pct: p.pct, amt: p.amt })) }, ans: right, step: 'each', live: !!H, ...(H ? { haul: H.n, from: fromOf(H) } : {}) }, size: 2,
  }, rand), sums), who);
}
// STEP TWO: THE TOTAL SALE PRICE. The load by its amounts, as a slip's rows, and the chart of what each metal sells
// for beside it: each metal's amount times its price, added up. mine: a haul the player went out for, told as their
// crew's, its amounts exactly as they came home (L.eighths: whole tonnes and eighths of a tonne, said as fractions).
function totalCard(L, { t, rand, who = null, W, key = 'pay:total', H = null, mine = false, at = 70 }) {
  const T = L.total, unit = L.unit, units = unit[1], ps = L.parts, k = ps.length, last = k - 1, E = !!L.eighths, am = (x) => (E ? eighthsText(x) : nf(x));
  const pays = ps.map((p) => Math.round(p.amt * p.m.price)), sold = pays.reduce((a, b) => a + b, 0), parted = ps.some((p) => !Number.isInteger(p.amt));
  const worked = k === 1 ? `${am(ps[0].amt)} × ${credits(ps[0].m.price)} = ${credits(sold)} credits` : `${ps.map((p, i) => `${am(p.amt)} × ${credits(p.m.price)} = ${credits(pays[i])}`).join('; ')}; together ${credits(sold)} credits`;
  const slips = t.shuffle([
    ...(k > 1 ? [{ ...P(T * ps[0].m.price), slip: 'onePrice', why: `That sells all ${am(T)} ${units} at ${ps[0].m.name}'s price. Each metal has its own price on the chart.` },
      { ...P(ps.reduce((s, p) => s + p.m.price, 0)), slip: 'pricesOnly', why: `That adds up the prices of one ${unit[0]} of each metal. Multiply each metal's ${units} by its price first.` },
      { ...P(sold - pays[last]), slip: 'part', why: `That leaves out the ${ps[last].m.name}. Every metal in the load is sold: add them all.` }] : [{ ...P(ps[0].m.price), slip: 'oneTonne', why: `${credits(ps[0].m.price)} credits is what one ${unit[0]} sells for. ${E ? `There ${T <= 1 ? 'is' : 'are'} ${amtWords(T, unit, true)}` : `There are ${nf(T)}`}.` }]),
    ...(parted ? [{ ...P(ps.reduce((s, p) => s + Math.floor(p.amt) * p.m.price, 0)), slip: 'wholeOnly', why: 'That sells only the whole tonnes. A part of a tonne sells for its part of the price: half a tonne for half the price.' }] : []),
    { ...P(sold + ps[0].m.price), slip: 'groupOff', why: `That is a ${unit[0]} of ${ps[0].m.name} too many.` },
    { ...P(sold * 10), slip: 'pointLost', why: 'That is ten times too much. Count the zeros again.' },
  ]);
  const sums = saleSteps(L, pays);
  const story = mine ? `Your crew came home with ${list(ps.map((p) => `${tonnesWords(p.amt, E)} of ${p.m.name}`))}.` : toldLoad(L, W, 'amounts');
  return madeBy(carriedBy(ownOrder({
    key: `${key}:${unit === CAN ? 'cans' : 'tonnes'}:${k}`, story, ask: 'What is the total sale price?',
    right: P(sold), slips,
    rightWhy: worked,
    sum: sums, chart: chartOf(unit),
    // (its rows, as the payout slip's: a metal and its amount)
    lines: [...ps.map((p) => [cap(p.m.name), amtWords(p.amt, unit, E)]), ['Sold for', '?']],
    help: { title: 'Each metal at its own price', pic: { kind: 'boxes', boxes: boxesOf(L, (p) => `${am(p.amt)} × ${credits(p.m.price)}`, () => '= ?'), op: k > 1 ? '+' : '', ask: 'the load = ? credits' },
      line: `A ${unit[0]} of each metal sells for that metal's price on the chart.${E && parted ? ' A part of a tonne sells for that part of the price.' : ''}${k > 1 ? ' Work each metal out, then add them up.' : ''}` },
    own: { strand: 'money', at }, credit: [{ strand: 'mul', at: 43, weight: 0.5 }],
    facts: { load: { unit: units, total: T, parts: ps.map((p) => ({ metal: p.m.name, pct: p.pct ?? null, amt: p.amt })) }, ans: sold, step: 'total', live: !!H, ...(H ? { haul: H.n, from: fromOf(H) } : {}), ...(mine ? { mine: true } : {}) }, size: Math.min(3, k + (k > 1 ? 1 : 0)),
  }, rand), sums), who);
}
// THE WHOLE PAY SLIP IN ONE GO (the top rung, for older kids, with Work it out): the load by its shares and the chart;
// how much of each metal, each at its price, added up.
function slipCard(L, { t, rand, who = null, W, H = null }) {
  const T = L.total, unit = L.unit, units = unit[1], ps = L.parts, k = ps.length, last = k - 1;
  const pays = ps.map((p) => Math.round(p.amt * p.m.price)), sold = pays.reduce((a, b) => a + b, 0), j = ps.findIndex((p) => p.amt !== ps[0].amt);
  const slips = t.shuffle([
    { ...P(T * ps[0].m.price), slip: 'onePrice', why: `That sells all ${T} ${units} at ${ps[0].m.name}'s price. Only ${ps[0].pct}% of the load is ${ps[0].m.name}: each metal has its own price.` },
    { ...P(ps.reduce((s, p) => s + p.pct * p.m.price, 0)), slip: 'percentCount', why: `That takes the percents for ${units}. ${ps[0].pct}% of the ${T} ${units} is ${nf(ps[0].amt)}, not ${ps[0].pct}.` },
    { ...P(ps.reduce((s, p) => s + p.m.price, 0)), slip: 'pricesOnly', why: `That adds up the prices of one ${unit[0]} of each metal. First find how many ${units} of each there are.` },
    { ...P(sold - pays[last]), slip: 'part', why: `That leaves out the ${ps[last].m.name}. Every bit of the load is sold: add every metal.` },
    ...(j > 0 ? [{ ...P(sold - pays[0] - pays[j] + ps[j].amt * ps[0].m.price + ps[0].amt * ps[j].m.price), slip: 'swapped', why: `That gives the ${ps[j].m.name} the ${ps[0].m.name}'s share. ${ps[0].pct}% is ${ps[0].m.name}.` }] : []),
    ...(j > 0 && Number.isInteger(T / k * 2) ? [{ ...P(T / k * ps.reduce((s, p) => s + p.m.price, 0)), slip: 'even', why: `That shares the ${T} ${units} out evenly. The shares are not equal: ${ps[0].pct}% is ${ps[0].m.name}.` }] : []),
    { ...P(sold + ps[0].m.price), slip: 'groupOff', why: `That is a ${unit[0]} of ${ps[0].m.name} too many. Work out each metal's ${units}, then each at its price.` },
  ]).filter((s) => Number.isInteger(s.v / 100));
  const A = amountSteps(L), sums = [...A.steps, ...saleSteps(L, pays, A.by)];
  return madeBy(carriedBy(ownOrder({
    key: `pay:slip:${unit === CAN ? 'cans' : 'tonnes'}:${k}`, story: toldLoad(L, W, 'shares'), ask: 'What is the total sale price?',
    right: P(sold), slips,
    rightWhy: `${ps.map((p) => `${p.pct}% of ${T} is ${nf(p.amt)}`).join(', ')}; ${ps.map((p) => `${nf(p.amt)} × ${credits(p.m.price)}`).join(' + ')} = ${credits(sold)} credits`,
    sum: sums, chart: chartOf(unit),
    help: { title: 'Two steps for each metal', pic: { kind: 'boxes', boxes: boxesOf(L, (p) => `${p.pct}% of ${T}`, (p) => `× ${credits(p.m.price)} = ?`), op: '+', ask: 'the load = ? credits' },
      line: `First how many ${units} of each metal: its share of the ${T}. Then each amount times its price on the chart. Then add them up.` },
    own: { strand: 'pct', at: 76 }, credit: [{ strand: 'money', at: 66, weight: 0.5 }],
    facts: { load: { unit: units, total: T, parts: ps.map((p) => ({ metal: p.m.name, pct: p.pct, amt: p.amt })) }, ans: sold, step: 'slip', live: !!H, ...(H ? { haul: H.n, from: fromOf(H) } : {}) }, size: 3,
  }, rand), sums), who);
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
        // full ones, and the empties once those are off, or both of a haul that came home early)
        const slots = got && k.key === 'wall' ? live.docked.map((d) => (d.percent > 0 ? 'full' : 'empty'))
          : got && k.key === 'ship' ? [...Array(Math.min(n, live.fullOnShip)).fill('full'), ...Array(Math.max(0, n - live.fullOnShip)).fill('empty')] : Array(n).fill(k.look);
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

  // ── a part of the load: its shares as fractions, which add up to the whole of it ────────────────────────────────
  // step 1  one part: 1/4 of the 12 tonnes is iron and the rest is nickel
  // step 2  several parts: 5/8 of the 16 tonnes is iron, 1/4 is copper and 1/8 is nickel
  // In tonnes or in canisters. Once a haul, a share of the Miner's own haul in the hangar: 1/4 of its 8 canisters.
  part: {
    strand: 'frac', at: (step) => (step <= 1 ? 28 : 40),
    make(step, { rand = Math.random, frac = 0, live = null } = {}) {
      const t = kit(rand), one = step <= 1, F = (n, d) => fracText(simplest(fr(n, d)));
      let n, d, k, unit = TONNE, metal = null, story, ask, restIs, kind = 'own', H = null;
      // THIS HAUL: one of its shares that suits the step (1/4 or 1/2 of the 8 canisters; 3/4 of them), once a haul
      const HH = live ? haulOf(live.round) : null;
      const mine = HH && !HH.flown && isNew(live, 'part:haul', step) ? HH.lots.map((L) => ({ L, f: simplest(fr(Math.round(L.tonnes / CAN_TONNES), HH.canisters)) })).find((x) => x.f.d > 1 && (one ? x.f.n === 1 : x.f.n > 1)) : null;
      if (mine) {
        H = HH; used(live, 'part:haul', step); kind = 'haul'; n = mine.f.n; d = mine.f.d; k = H.canisters / d; unit = CAN; metal = mine.L.metal.name;
        const rest = H.lots.filter((L) => L !== mine.L).sort((a, b) => b.tonnes - a.tonnes || a.price - b.price);
        story = `Of the ${H.canisters} canisters of this haul, ${n}/${d} hold ${metal}${rest.length === 1 ? ` and the rest hold ${rest[0].metal.name}` : `, ${list(rest.map((L) => `${F(L.tonnes, H.canisters)} hold ${L.metal.name}`))}`}.`;
        ask = `How many canisters of ${metal} is that?`; restIs = `the ${list(rest.map((L) => L.metal.name))}`;
      } else {
        if (one) { n = 1; d = t.pick(frac < 0.5 ? [2, 3, 4, 5] : [3, 4, 5, 6, 8, 10]); } else [n, d] = t.pick(frac < 0.5 ? [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5]] : [[3, 4], [3, 5], [4, 5], [5, 6], [3, 8], [5, 8], [3, 10], [7, 10]]);
        k = t.int(2, 9);
        const whole = d * k, way = t.pick(['tonnes', 'tonnes', 'tonnes', 'cans', 'cans', 'melted']), ms = t.shuffle(METALS.slice(0, 5).map((m) => m.name));
        unit = way === 'cans' ? CAN : TONNE; metal = way === 'melted' ? null : ms[0];
        const lead = unit === CAN ? `The Miners brought in ${whole} canisters this week.` : cameIn(whole), of = unit === CAN ? 'of them hold' : 'of it is', is = unit === CAN ? 'hold' : 'is';
        // (the other shares: the rest as one metal, or, of several parts, as two metals with a fraction each)
        const left = d - n, two = !one && left >= 2 && t.chance(0.5), a = two ? t.int(1, left - 1) : left;
        if (way === 'melted') { story = `${lead} The furnace has melted ${n}/${d} of it so far.`; ask = 'How many tonnes has it melted?'; restIs = 'what is not melted yet'; }
        else if (two) { story = `${lead} ${n}/${d} ${of} ${metal}, ${F(Math.max(a, left - a), d)} ${is} ${ms[1]} and ${F(Math.min(a, left - a), d)} ${is} ${ms[2]}.`; ask = `How many ${unit[1]} of ${metal} is that?`; restIs = `the ${ms[1]} and the ${ms[2]}`; }
        else { story = `${lead} ${n}/${d} ${of} ${metal} and the rest ${is} ${ms[1]}.`; ask = `How many ${unit[1]} of ${metal} is that?`; restIs = `the ${ms[1]}`; }
      }
      const whole = d * k, ans = n * k, units = unit[1], what = metal || 'melted';
      const facts = { whole, n, d, ans, unit: units, kind, live: kind === 'haul', ...(H ? { haul: H.n, from: fromOf(H) } : {}) };
      if (one) {
        return ownOrder({
          key: `part:one:${kind === 'haul' ? 'haul' : what === 'melted' ? 'melted' : 'metal'}`, story, ask, right: C(k, unit),
          slips: [
            { ...C(whole - k, unit), slip: 'rest', why: `${u(whole - k, unit)} is the rest of it: ${restIs}.` },
            { ...C(d, unit), slip: 'bottom', why: `${d} is how many equal parts the ${whole} ${units} are cut into. One part is ${whole} ÷ ${d}.` },
            { ...C(whole - d, unit), slip: 'subtracted', why: `${whole} − ${d} takes ${d} away. Cut the ${whole} ${units} into ${d} equal parts instead.` },
            { ...C(k + 1, unit), slip: 'off', why: `${d} parts of ${k + 1} would make ${d * (k + 1)} ${units}, more than the ${whole} there are.` },
            { ...C(k - 1, unit), slip: 'off', why: `${d} parts of ${k - 1} make only ${d * (k - 1)} ${units}. There are ${whole}.` },
          ],
          rightWhy: `1/${d} of ${whole} is ${whole} ÷ ${d} = ${u(k, unit)}`, sum: { op: 'div', a: whole, b: d },
          help: { title: 'Cut into equal parts', pic: { kind: 'fracbar', whole, n: 1, d, unit: units, it: null }, line: `1/${d} means the ${whole} ${units} cut into ${d} equal parts, and one of them taken: ${whole} ÷ ${d}.`, steps: [`One of the ${d} equal parts: ${whole} ÷ ${d}`] },
          own: { strand: 'frac', at: 28 }, credit: [{ strand: 'div', at: 29, weight: 0.5 }], facts,
        }, rand);
      }
      return ownOrder({
        key: `part:some:${kind === 'haul' ? 'haul' : what === 'melted' ? 'melted' : 'metal'}`, story, ask, right: C(ans, unit),
        slips: [
          { ...C(k, unit), slip: 'onePart', why: `${u(k, unit)} is one part, 1/${d}. ${n}/${d} is ${n} of those parts.` },
          { ...C(whole - ans, unit), slip: 'rest', why: `${u(whole - ans, unit)} is the rest of it: ${restIs}.` },
          { ...C(ans + k, unit), slip: 'partOff', why: `That's ${n + 1} parts. ${n}/${d} is ${n} of the ${d} parts.` },
          { ...C(whole - n, unit), slip: 'subtracted', why: `${whole} − ${n} takes ${n} away. Cut the ${whole} ${units} into ${d} equal parts, then take ${n} of them.` },
          { ...C(ans + 1, unit), slip: 'off', why: `Cut the ${whole} ${units} into ${d} equal parts, then take ${n} of them.` },
        ],
        rightWhy: `One part is ${whole} ÷ ${d} = ${k}; ${n} parts are ${n} × ${k} = ${u(ans, unit)}`,
        sum: [{ op: 'div', a: whole, b: d, say: `First one of the ${d} equal parts` }, { op: 'mul', a: k, b: n, say: `Then ${n} of those parts` }],
        help: { title: 'Cut into equal parts', pic: { kind: 'fracbar', whole, n, d, unit: units, it: null }, line: `${n}/${d} means the ${whole} ${units} cut into ${d} equal parts, and ${n} of them taken. Work out one part first.`,
          steps: [`First one of the ${d} equal parts: ${whole} ÷ ${d}`, `Then ${n} of those parts: that × ${n}`] },
        own: { strand: 'frac', at: 40 }, credit: [{ strand: 'div', at: 29, weight: 0.5 }], facts, size: 2,
      }, rand);
    },
  },

  // ── lots of a fraction: a whole number of trips, a fraction of a tonne on each ─────────────────────────────────
  // Mathwood's fishing dock asks the same of fish (labs/fishing/pies.js timesW: 4 perch of 3/4 of a pound each), and
  // these are its slips: the bottom number multiplied too (one trip's metal), the bottom number only (smaller parts),
  // the trips added on, the trips added to the top number; with this job's own: the parts counted and not made into
  // tonnes (15 quarters taken for 15 tonnes), the whole tonnes kept and the parts left over lost, a trip too many or
  // too few. Told in tonnes only: a drone's trips, a ladle's pours, pallets of bars. (Before, these were canisters of
  // 3/4 of a tonne: a canister holds one tonne now, and no slip tells tonnes and canisters together.)
  // step 1  the answer is whole tonnes: 8 trips with 3/4 of a tonne of copper on each (6 tonnes)
  // step 2  the answer is a mixed number: 5 trips with 3/4 of a tonne on each (3 3/4 tonnes)
  lots: {
    strand: 'frac', at: (step) => (step <= 1 ? 44 : 47),
    make(step, { rand = Math.random, who = null, frac = 0 } = {}) {
      const t = kit(rand), whole = step <= 1;
      let n, a, d;
      // halves and quarters first, then thirds, fifths and eighths
      const good = () => gcd(a, d) === 1 && n >= 2 && (whole ? (n * a) % d === 0 && n * a >= 2 * d : (n * a) % d !== 0 && n * a > d);
      for (let tries = 0; tries < 60; tries++) {
        d = t.pick(frac < 0.5 ? [2, 4, 4, 3] : [3, 4, 5, 8, 6]); a = t.int(1, d - 1);
        n = whole ? d * t.int(1, Math.max(1, Math.floor(12 / d))) : t.int(2, 9);
        if (good()) break;
      }
      if (!good()) [n, a, d] = whole ? [4, 3, 4] : [5, 3, 4];
      const metal = t.pick(METALS.slice(0, 5)).name;
      const q = fr(a, d), ans = fr(n * a, d), each = ofT(q), P1 = parts(d, 1), PS = parts(d);
      const W = (who && who.name) || 'The crew', they = who ? (who.she ? 'she' : 'he') : 'they';
      const ctx = t.pick([
        { thing: ['trip', 'trips'], on: 'on each trip', story: `A cargo drone brings ${each} of ${metal} from the far rocks on each trip. It made ${n} trips.`, ask: `How many tonnes of ${metal} did it bring?` },
        { thing: ['pour', 'pours'], on: 'in each pour', story: `The furnace's small ladle pours ${each} of ${metal} at a time. It poured ${n} times.`, ask: `How many tonnes of ${metal} is that?` },
        { thing: ['pallet', 'pallets'], on: 'on each pallet', story: `${W} sent ${n} pallets of ${metal} bars to the dock, with ${each} on each pallet.`, ask: `How many tonnes of ${metal} did ${they} send?` },
      ]), [thing, things] = ctx.thing;
      const top = n * a, wholeT = Math.floor(top / d);
      const S = (f, slip, why) => ({ ...FT(f), slip, why });
      const slips = [
        S(fr(top, 1), 'partsOnly', `${top} is how many ${PS} of a tonne there are: ${n} lots of ${a}. ${d} ${PS} make one tonne.`),
        ...(whole ? [] : [S(fr(wholeT, 1), 'leftOver', `That is only the whole tonnes. The ${PS} left over count too, as a fraction of a tonne beside them.`)]),
        S(fr(n * d + a, d), 'added', `That adds the ${n} ${things} on, as if each were a tonne. Each one is ${each}: ${n} lots of it.`),
        S(q, 'oneLot', `${cap(each)} is one ${thing}. There are ${n} ${things}: ${n} lots of ${a}/${d}.`),
        S(fr(a + n, d), 'topAdded', `That adds ${n} to the top number. ${n} lots of ${a}/${d} multiply it: ${n} × ${a} on top, ${d} still underneath.`),
        S(fr(a, d * n), 'bottomTimes', `That multiplies the bottom number, which makes the parts smaller. ${n} ${things} are more than one ${thing}.`),
        S(fr((n + 1) * a, d), 'groupOff', `That is ${n + 1} ${things}. There are ${n}.`),
        S(fr((n - 1) * a, d), 'groupOff', `That is ${n - 1} ${n - 1 === 1 ? thing : things}. There are ${n}.`),
      ];
      return ownOrder({
        key: `lots:${whole ? 'whole' : 'mixed'}:${thing}`, story: ctx.story, ask: ctx.ask, right: FT(ans), slips,
        rightWhy: `${n} × ${a}/${d} = ${top}/${d} = ${ofT(ans)}`,
        // (Work it out: the parts in all, then whole tonnes, the remainder the parts left over: 15 ÷ 4 = 3 r 3, 3 3/4)
        sum: [...(a > 1 ? [{ op: 'mul', a: n, b: a, say: `First the ${PS} of a tonne in all: ${n} lots of ${a}` }] : []),
          { op: 'div', a: top, b: d, say: `${a > 1 ? 'Then' : 'First'} whole tonnes: ${d} ${PS} make one tonne${whole ? '' : ', and what is left over is still ' + PS}` }],
        help: { title: 'Lots of a fraction', pic: { kind: 'fraclots', n, a, d, what: metal, on: ctx.on },
          line: `${n} × ${a}/${d} is ${n} lots of ${a}/${d}: count the ${PS} of a tonne in all the ${things}, then make them into whole tonnes, ${d} ${PS} to a tonne.`,
          steps: [a > 1 ? `First the ${PS} in all: ${n} × ${a}` : `First the ${PS} in all: one ${P1} for each of the ${n} ${things}`,
            `Then whole tonnes: ${d} ${PS} make one tonne, so that many ${PS} ÷ ${d}`,
            ...(whole ? [] : [`What is left over is still ${PS}: it goes over the ${d}`])] },
        own: { strand: 'frac', at: whole ? 44 : 47 }, credit: whole ? [{ strand: 'mul', at: 20, weight: 0.5 }] : [{ strand: 'div', at: 45, weight: 0.5 }],
        facts: { n, a, d, ans: [top, d], metal, thing, live: false },
        size: whole ? 1 : 2,
      }, rand);
    },
  },

  // ── weights in tenths of a tonne (tonnes only: what the furnace pours, a pallet weighs, the hopper holds) ───────
  // step 1  adding and taking away: 1.2 tonnes and 0.9 tonnes together; 2.3 tonnes with 0.8 melted
  // step 2  pour after pour: 8 pours of 1.2 tonnes
  weigh: {
    strand: 'dec', at: (step) => (step <= 1 ? 50 : 60),
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand), metal = t.pick(METALS.slice(0, 5)).name;
      if (step <= 1) {
        for (let tries = 0; tries < 80; tries++) {
          const a = t.int(6, 29), b = t.int(4, 19);   // tenths
          if (a % 10 === 0 || b % 10 === 0 || a === b) continue;
          if (t.chance(0.55)) {
            const s = a + b, tenths = (a % 10) + (b % 10), wholes = Math.floor(a / 10) + Math.floor(b / 10);
            const ctx = t.pick([
              `The furnace poured ${t1(a)} tonnes of ${metal} this morning and ${t1(b)} tonnes this afternoon.`,
              `The scale reads ${t1(a)} tonnes of ${metal} on one pallet and ${t1(b)} tonnes on the next.`,
            ]);
            return ownOrder({
              key: 'weigh:add', story: ctx, ask: 'How many tonnes is that together?', right: D(s * 10),
              slips: [
                ...(tenths >= 10 ? [{ ...D(wholes * 100 + tenths), slip: 'wholeParts', why: `${a % 10} tenths and ${b % 10} tenths make ${tenths} tenths, and 10 tenths are another whole tonne: carry it.` }] : []),
                { ...D(Math.abs(a - b) * 10), slip: 'subtracted', why: 'That takes one from the other. Both count: add them.' },
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
          const d = a - b, borrow = a % 10 < b % 10, digitwise = Math.abs(Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs((a % 10) - (b % 10));
          return ownOrder({
            key: 'weigh:left', story: `The furnace's hopper held ${t1(a)} tonnes of ${metal}. The furnace has melted ${t1(b)} tonnes of it so far.`, ask: 'How many tonnes are still in the hopper?', right: D(d * 10),
            slips: [
              ...(borrow && digitwise !== d ? [{ ...D(digitwise * 10), slip: 'smallerFromBigger', why: `In the tenths the smaller digit was taken from the bigger. ${a % 10} tenths is less than ${b % 10} tenths: borrow a whole tonne.` }] : []),
              { ...D((a + b) * 10), slip: 'added', why: 'Melting leaves less in the hopper: take away.' },
              { ...D((d + 1) * 10), slip: 'off', why: 'One tenth too many. Line the points up and take away each column.' },
              { ...D((d > 1 ? d - 1 : d + 2) * 10), slip: 'off', why: 'Line the points up and take away each column again.' },
              { ...D(b * 10), slip: 'part', why: `${t1(b)} tonnes is what has been melted. The question is what is still in the hopper.` },
            ],
            pic: { kind: 'columns', rows: [dec(a, 1), dec(b, 1)], op: '−' },
            rightWhy: `${dec(a, 1)} − ${dec(b, 1)} = ${t1(d)} tonnes`, sum: { op: 'sub', a: a / 10, b: b / 10 },
            own: { strand: 'dec', at: 50 }, credit: [], facts: { a, b, op: '−', ans: d },
          }, rand);
        }
        throw new Error('smelter weigh: nothing made');
      }
      // n lots of w tonnes: pours, a drone's trips, pallets (before, canisters of 1.2 tonnes: a canister holds one tonne now)
      const n = t.pick([3, 4, 5, 6, 7, 8, 8]), w = t.pick(WEIGHTS), p = n * w;   // tenths
      const ctx = t.pick([
        { thing: ['pour', 'pours'], story: `The furnace poured ${n} times today, ${t1(w)} tonnes of ${metal} each time.`, ask: `How many tonnes of ${metal} did it pour?` },
        { thing: ['trip', 'trips'], story: `A cargo drone made ${n} trips to the far rocks and brought back ${t1(w)} tonnes of ${metal} on each trip.`, ask: `How many tonnes of ${metal} did it bring?` },
        { thing: ['pallet', 'pallets'], story: `${n} pallets of ${metal} bars are going to the dock. Each pallet weighs ${t1(w)} tonnes.`, ask: 'How many tonnes is that in all?' },
      ]), [thing, things] = ctx.thing;
      return ownOrder({
        key: `weigh:lots:${thing}`, story: ctx.story, ask: ctx.ask, right: D(p * 10),
        slips: [
          ...(w > 10 && (w % 10) * n >= 10 ? [{ ...D(Math.floor(w / 10) * n * 100 + (w % 10) * n), slip: 'partsApart', why: `${n} × ${w % 10} tenths is ${n * (w % 10)} tenths, and every 10 tenths make another whole tonne.` }] : []),
          { ...D(p * 100), slip: 'pointLost', why: `${n} × ${w} = ${p}, but those are tenths of a tonne: ${p} tenths.` },
          { ...D(p), slip: 'pointFar', why: `Only one place after the point in ${dec(w, 1)}, so only one in the answer.` },
          { ...D((w + n * 10) * 10), slip: 'added', why: `That adds the count on. Every ${thing} is its whole weight: multiply.` },
          { ...D((p + w) * 10), slip: 'groupOff', why: `That's ${n + 1} ${things}. There are ${n}.` },
        ],
        pic: { kind: 'bars', n, label: dec(w, 1), line: `${n} ${things} of ${dec(w, 1)} tonnes: ${n} lots of ${w} tenths.` },
        rightWhy: `${n} × ${w} tenths = ${p} tenths = ${t1(p)} tonnes`, sum: { op: 'mul', a: w / 10, b: n },
        own: { strand: 'dec', at: 60 }, credit: [{ strand: 'mul', at: 43, weight: 0.5 }], facts: { n, w, ans: p, live: false, thing },
      }, rand);
    },
  },

  // ── shares in percent: a part of the load, the rest of it named ────────────────────────────────────────────────
  // step 1  50%, 25% and 10% of a load (25% of the 12 tonnes is iron and the rest is nickel)
  // step 2  any percent, from 10% (35% of the 20 tonnes is iron: 10% is 2, 30% is 6, 5% is 1)
  percent: {
    strand: 'pct', at: (step) => (step <= 1 ? 58 : 62),
    make(step, { rand = Math.random, frac = 0 } = {}) {
      const t = kit(rand), [metal, other] = t.shuffle(METALS.slice(0, 5).map((m) => m.name));
      // (the load in tonnes or, where the answer is whole, in canisters; or tonnes the furnace has melted so far)
      const told = (whole, pct, wholeAns) => {
        const way = t.pick(wholeAns ? ['tonnes', 'tonnes', 'cans', 'melted'] : ['tonnes', 'tonnes', 'melted']), unit = way === 'cans' ? CAN : TONNE;
        if (way === 'melted') return { unit, key: 'melted', story: `${cameIn(whole)} The furnace has melted ${pct}% of it so far.`, ask: 'How many tonnes has it melted?', rest: 'what is not melted yet' };
        return unit === CAN ? { unit, key: 'metal', story: `This week the Miners brought in ${whole} canisters. ${pct}% of them hold ${metal} and the rest hold ${other}.`, ask: `How many canisters of ${metal} is that?`, rest: `the ${other}` }
          : { unit, key: 'metal', story: `${cameIn(whole)} ${pct}% of it is ${metal} and the rest is ${other}.`, ask: `How many tonnes of ${metal} is that?`, rest: `the ${other}` };
      };
      if (step <= 1) {
        const pct = t.pick([50, 25, 10, 25, 10]), n = 100 / pct, whole = n * t.int(2, pct === 10 ? 9 : 12), part = whole / n;
        const said = pct === 50 ? 'half' : pct === 25 ? 'a quarter' : 'a tenth', ctx = told(whole, pct, true), unit = ctx.unit, units = unit[1];
        return ownOrder({
          key: `percent:simple:${ctx.key}:${pct}`, story: ctx.story, ask: ctx.ask, right: C(part, unit),
          slips: [
            { ...C(pct, unit), slip: 'percentCount', why: `${pct}% isn't ${pct} ${units}. It means ${pct} out of every 100: here ${said} of the ${whole} ${units}.` },
            { ...C(whole - part, unit), slip: 'rest', why: `${u(whole - part, unit)} is the other ${100 - pct}%: ${ctx.rest}.` },
            { ...C(pct === 50 ? whole / 4 : whole / 2, unit), slip: 'wrongPart', why: `That's ${pct === 50 ? 'a quarter (25%)' : 'half (50%)'}. ${pct}% is ${pct === 50 ? 'half' : pct === 25 ? 'half of a half' : 'one part in ten'}.` },
            { ...C(part + 1, unit), slip: 'off', why: `Cut the ${whole} ${units} into ${n} equal parts again: ${pct}% is one of them.` },
            { ...C(part * 2, unit), slip: 'twice', why: `That's twice as much. ${pct}% is one part in ${n}.` },
          ].filter((s) => Number.isInteger(s.v) && s.v !== whole),
          pic: { kind: 'pctbar', whole, n, take: 1, unit, mode: 'part' },
          rightWhy: `${pct}% is 1 part in ${n}: ${whole} ÷ ${n} = ${u(part, unit)}`, sum: { op: 'div', a: whole, b: n },
          own: { strand: 'pct', at: 58 }, credit: [{ strand: 'frac', at: 40, weight: 0.5 }], facts: { whole, pct, ans: part, unit: units },
        }, rand);
      }
      for (let tries = 0; tries < 80; tries++) {
        const pct = t.pick(frac < 0.5 ? [20, 30, 40, 60, 70, 35] : [15, 30, 35, 45, 60, 75, 5, 40, 35]);
        // (the load in whole tonnes; later on, loads whose answer has tenths in it: 35% of 8 tonnes is 2.8)
        const small = frac >= 0.5 && t.chance(0.4), whole = small ? t.int(2, 9) * (pct % 10 ? 2 : 1) : (pct % 10 ? 20 : 10) * t.int(2, 12);
        const part10 = whole * pct / 10;   // the answer in tenths
        if (!Number.isInteger(part10) || whole === 100 || (!small && part10 % 10)) continue;
        const ctx = told(whole, pct, part10 % 10 === 0), unit = ctx.unit, units = unit[1];
        const ten10 = whole, T = (x10) => D(x10 * 10, unit);   // (10% of the load, in tenths, is the load's own number)
        return ownOrder({
          key: `percent:any:${pct}`, story: ctx.story, ask: ctx.ask, right: T(part10),
          slips: [
            { ...T(pct * 10), slip: 'percentCount', why: `${pct}% isn't ${pct} ${units}: it's ${pct} out of every 100. 10% of ${whole} ${units} is ${t1(ten10)}.` },
            { ...T(whole * 10 - part10), slip: 'rest', why: `${t1(whole * 10 - part10)} ${units} is the other ${100 - pct}%: ${ctx.rest}.` },
            { ...T(ten10), slip: 'tenOnly', why: `${t1(ten10)} ${units} is 10%. ${pct}% is ${t1(pct)} lots of that.` },
            { ...T(part10 + ten10), slip: 'tenOff', why: `That's 10% too much: ${pct + 10}%. Count the 10%s again.` },
            ...(part10 > whole ? [{ ...T(part10 * 10), slip: 'pointLost', why: `That's more than all of it. ${pct}% is only a part of the ${whole} ${units}.` }] : []),
            { ...T(part10 + 5), slip: 'off', why: `Find 10% of the ${whole} ${units} first, then build ${pct}% from it.` },
          ].filter((s) => unit !== CAN || s.v % 100 === 0),   // (no half canisters)
          pic: { kind: 'pctbar', whole, n: pct % 10 ? 20 : 10, take: pct % 10 ? pct / 5 : pct / 10, unit, mode: 'part' },
          sum: tenthSteps(whole, pct, `${whole} ${units}`),
          rightWhy: pct === 5 ? `10% of ${whole} is ${t1(ten10)}, and 5% is half of that: ${t1(part10)} ${units}`
            : pct % 10 ? `10% of ${whole} is ${t1(ten10)} and 5% is ${dec(ten10 * 5, 2, { trim: true })}: ${pct}% is ${Math.floor(pct / 10)} × ${t1(ten10)} + ${dec(ten10 * 5, 2, { trim: true })} = ${t1(part10)} ${units}`
              : `10% of ${whole} is ${t1(ten10)}, so ${pct}% is ${pct / 10} × ${t1(ten10)} = ${t1(part10)} ${units}`,
          own: { strand: 'pct', at: 62 }, credit: small ? [{ strand: 'dec', at: 55, weight: 0.5 }] : [], facts: { whole, pct, ans: part10 / 10, unit: units }, size: 2,
        }, rand);
      }
      throw new Error('smelter percent: nothing made');
    },
  },

  // ── how much of each metal (the first of the pay's two steps, by itself): a load by its shares in percent ───────
  // "You collected 30 tonnes of ore. 80% is iron, 10% is nickel, 5% is copper and 5% is titanium. How many tonnes of
  // each metal did you collect?" The answers are whole sets of numbers. Once a haul: the Miner's own haul in the hangar.
  each: {
    strand: 'pct', at: () => 64,
    make(step, { rand = Math.random, live = null, frac = 0, who = null } = {}) {
      const t = kit(rand), W = (who && who.name) || null, H = ownHaul(live, 'each:haul');
      const L = H ? haulLoad(H) : loadOf(t, { ks: frac < 0.34 ? [2, 3] : [2, 3, 4] });
      return eachCard(L, { t, rand, who, W, H });
    },
  },

  // ── what it sells for ──────────────────────────────────────────────────────────────────────────────────────
  // step 1  one metal: its tonnes times what a tonne of it sells for (2.8 tonnes of cobalt at 5,000 credits a tonne)
  // step 2  THE TWO STEPS, two slips about one load: how much of each metal (eachCard), then the total sale price by
  //         the chart (totalCard). Once a haul the first load is the Miner's own haul in the hangar; a haul the player
  //         went out for is told by its amounts as they came home, on one slip (they are known: there is no first step)
  // step 3  the whole pay slip in one go: the shares and the chart (slipCard)
  pay: {
    strand: 'dec', at: (step) => (step <= 1 ? 66 : step === 2 ? 70 : 76),
    make(step, { rand = Math.random, live = null, frac = 0, who = null } = {}) {
      const t = kit(rand), W = (who && who.name) || null;
      if (step <= 1) {
        for (let tries = 0; tries < 60; tries++) {
          const w = t.int(6, frac < 0.5 ? 49 : 95);   // tenths of a tonne
          const m = t.pick(frac < 0.5 ? METALS.slice(0, 4) : METALS);
          if (w % 10 === 0) continue;
          const pay = w * m.price / 10, whole = Math.floor(w / 10);
          return ownOrder({
            key: `pay:metal:${m.name}`, story: `This load is ${t1(w)} tonnes of ${m.name}. A tonne of ${m.name} sells for ${credits(m.price)} credits.`, ask: 'How many credits does the load sell for?', right: P(pay),
            slips: [
              { ...P(w * m.price), slip: 'pointLost', why: `${w} × ${credits(m.price)} = ${(w * m.price).toLocaleString('en-US')}, but ${t1(w)} is ${w} tenths of a tonne: a tenth of that.` },
              ...(whole >= 1 ? [{ ...P(whole * m.price), slip: 'wholeOnly', why: `That sells the ${u(whole, ['whole tonne', 'whole tonnes'])} and leaves out the other ${dec(w % 10, 1)} of a tonne.` }] : []),
              { ...P((whole + 1) * m.price), slip: 'roundedUp', why: `That sells ${whole + 1} whole tonnes. There are only ${t1(w)}.` },
              { ...P(m.price), slip: 'oneTonne', why: `${credits(m.price)} credits is what one tonne sells for. There are ${t1(w)} tonnes.` },
              { ...P(pay + m.price), slip: 'groupOff', why: `That's a tonne too many. ${t1(w)} tonnes at ${credits(m.price)} credits each.` },
            ],
            rightWhy: `${t1(w)} × ${credits(m.price)} = ${pay.toLocaleString('en-US')} credits`, sum: { op: 'mul', a: w / 10, b: m.price },
            help: { title: 'Tonne by tonne', pic: { kind: 'paybars', w, price: m.price, metal: m.name }, line: `Every whole tonne sells for ${credits(m.price)} credits. The part of a tonne sells for its part of ${credits(m.price)}: ${dec(w % 10, 1)} × ${credits(m.price)}.`,
              steps: [...(whole >= 1 ? [`The whole ${whole === 1 ? 'tonne' : 'tonnes'}: ${whole} × ${credits(m.price)}`] : []), `The part of a tonne: ${dec(w % 10, 1)} × ${credits(m.price)}`, ...(whole >= 1 ? ['Then add the two'] : [])] },
            own: { strand: 'dec', at: 66 }, credit: [{ strand: 'money', at: 60, weight: 0.5 }], facts: { w, price: m.price, ans: pay }, size: 2,
          }, rand);
        }
        throw new Error('smelter pay: nothing made');
      }
      const H = live ? haulOf(live.round) : null;
      // A HAUL THE PLAYER WENT OUT FOR, once at each of these rungs, by the payout slip's own pattern: each metal's
      // tonnes at its price, added up. Its amounts are told as they came home: whole tonnes when all eight canisters
      // were full, eighths of a tonne (as fractions) when the crew headed home early
      if (H && H.flown && isNew(live, 'pay:mine', step)) {
        used(live, 'pay:mine', step);
        const L = { unit: TONNE, total: H.tonnes, haul: H.n, eighths: inEighths(H.lots), parts: H.lots.map((x) => ({ m: x.metal, amt: x.tonnes })).sort((p, q) => q.amt - p.amt || p.m.price - q.m.price) };
        return totalCard(L, { t, rand, W, key: 'pay:mine', H, mine: true, at: step === 2 ? 70 : 76 });
      }
      if (step === 2) {
        // (a load left waiting from another haul's slip is put away: its slip would say "this haul" of the wrong one)
        if (pending && pending.L.haul != null && (!live || haulNo(live.round) !== pending.L.haul)) pending = null;
        if (pending) { const { L, who: w0 } = pending; pending = null; return totalCard(L, { t, rand, who: w0, W: (w0 && w0.name) || null, H: L.haul != null ? haulOf(L.haul) : null }); }
        const HO = ownHaul(live, 'pay:haul', 2), L = HO ? haulLoad(HO) : loadOf(t, { ks: frac < 0.34 ? [2, 3] : [2, 3, 4] });
        pending = { L, who };
        return eachCard(L, { t, rand, who, W, key: 'pay:each', H: HO });
      }
      const HO = ownHaul(live, 'pay:haul', 3);
      const L = HO ? haulLoad(HO) : loadOf(t, { ks: [2, 3], kinds: frac < 0.5 ? ['cans8', 'cans', 'tonnes'] : ['cans8', 'cans', 'tonnes', 'tenths', 'tenths'] });
      return slipCard(L, { t, rand, who, W, H: HO });
    },
  },
};

// ── the ladder: easiest first, every step small ──────────────────────────────────────────────────────────────────
// (the levels' ids are kept from the first ladder, so a crew member's place on it is kept: 'oreWhole', 'oreTimes' and
// 'tonnes' are older names than their cards)
const K = (step, w = 1) => ({ maker: 'wordsK', step, w });
const W = (step, types, w = 1) => ({ maker: 'words', step, types, w });
const M = (maker, step, w = 1) => ({ maker, step, w });

export const PLACE = {
  id: 'smelter', name: 'The smelter\'s hall', short: 'Smelter', math: 'What a load of metal sells for: fractions, percents, weights, credits', pic: 'smelter', job: null,
  line: 'Pay slips at the furnace console: canisters to count, a load shared between its metals, how much of each, and what it all sells for.',
  levels: [
    { id: 'kCount', title: 'Counting canisters', line: 'Up to 5: the canisters on the Miner', gen: { mix: [M('count', 1, 2), K(1)] } },
    { id: 'kFull', title: 'Still on the ship, full and empty', line: 'Up to 8: 8 came in, 5 are still on the Miner', gen: { mix: [M('count', 2, 2), K(2)] } },
    { id: 'kRacks', title: 'Racks of the same', line: '3 racks with 2 canisters on each; 8 canisters and 5 more', strand: 'words', gen: { mix: [M('count', 3, 2), K(3)] } },
    { id: 'loads', title: 'Tonnes by the trip', line: '4 trips with 3 tonnes on each; 15 tonnes and 18 together', gen: { mix: [W(1, ['groups', 'parts'])] } },
    { id: 'share', title: 'Sharing a load out', line: '24 tonnes in 4 trips, the same on each', gen: { mix: [W(2, ['share'], 2), W(1, ['groups'])] } },
    { id: 'part', title: 'A part of the load', line: '1/4 of the 12 tonnes is iron, the rest nickel', gen: { mix: [M('part', 1, 2), W(3, ['groups', 'share', 'parts'])] } },
    { id: 'parts', title: 'Several parts', line: '5/8 of the 16 tonnes is iron, 1/4 copper, 1/8 nickel', gen: { mix: [M('part', 2, 2), W(3, ['groups', 'share'])] } },
    // (a whole number times a fraction: first the answers that are whole tonnes; then the mixed numbers, as Mathwood's
    // fishing dock has them at the same point of the school guide, 47)
    { id: 'oreWhole', title: 'Lots of a fraction', line: '8 trips with 3/4 of a tonne on each: 6 tonnes', gen: { mix: [M('lots', 1, 2), M('part', 2)] } },
    { id: 'oreTimes', title: 'Lots that leave a fraction', line: '5 trips with 3/4 of a tonne on each: 3 3/4 tonnes', gen: { mix: [M('lots', 2, 2), M('lots', 1)] } },
    { id: 'tenths', title: 'Weights in tenths', line: '1.2 tonnes and 0.9 tonnes together; 2.3 tonnes with 0.8 melted', gen: { mix: [M('weigh', 1, 2), M('part', 2)] } },
    { id: 'percent', title: 'Shares in percent', line: '25% of the 12 tonnes is iron, the rest nickel', gen: { mix: [M('percent', 1, 2), M('weigh', 1)] } },
    { id: 'tonnes', title: 'Pour after pour', line: '8 pours of 1.2 tonnes; 2 bars from every 5 tonnes', gen: { mix: [M('weigh', 2, 2), M('ratio', 3)] } },
    { id: 'anyPercent', title: 'Any percent', line: '35% of the 20 tonnes is iron', gen: { mix: [M('percent', 2, 2), M('weigh', 2)] } },
    // THE PAY, as the game's maker set it out: how much of each metal; what a metal sells for; then the two steps
    // together on one load (how much of each, then the total sale price by the chart); and the whole of it in one go
    { id: 'eachMetal', title: 'How much of each metal', line: '30 tonnes: 80% iron, 10% nickel, 5% copper, 5% titanium', gen: { mix: [M('each', 1, 2), M('percent', 2)] } },
    { id: 'credits', title: 'What a metal sells for', line: '2.8 tonnes of cobalt at 5,000 credits a tonne', gen: { mix: [M('pay', 1, 2), M('each', 1)] } },
    { id: 'sale', title: 'The total sale price', line: 'How much of each metal, then what it all sells for by the chart', strand: 'money', gen: { mix: [M('pay', 2)] } },
    { id: 'payslip', title: 'The whole pay slip', line: '8 canisters: 50% iron, 25% nickel, 25% titanium. The total sale price in one go', strand: 'pct', gen: { mix: [M('pay', 3, 2), M('ratio', 5)] } },
  ],
};

export const JOB = {
  dark: true,      // its pictures are drawn dark, with light lines (src/jobs/pics.js NIGHT; the game's maker: "the dark mode looks better")
  // (named in the game's maker's own words: "I thought that there were controls in the smelter room for the smelter pay
  // desk?")
  id: 'smelter', name: 'The smelter controls', short: 'Smelter', open: true,
  // WHERE THE JOB IS: in the smelter's hall, at the forge's own thermal console (its FURNACE 1 and FURNACE 2 screens),
  // the glowing pours just past it. The game's maker (2026-11-16): "I think it would be a good idea to have one job per
  // room. I want people to have a reason to go into the smelter room and look at the pretty glowing metal." (Before, it
  // was a desk in the smelter's control room, and before that the crane's chair, which now has the crane's own two
  // options: src/jobs/crane.js.)
  // (the station file's places: where one stands at the console, on its operator's side, and the middle of its two
  // screens. The smelter, one of the station's people, stands by the console's south end now and then, under the
  // catwalk: life.js forgeConsole, well clear of this job's ring)
  spot: { place: 'smelterControls' }, face: 'smelterControlsScreen',
  // the camera while it's up: the station file's view from behind the console's south end, over it to the nearer pour
  // and its ladle (the crew member stands at the console, in view)
  view: 'smelter-controls',
  sign: 'Smelter controls', hint: 'Work out what the haul sells for',
  place: PLACE, setting: SETTING, makers: MAKERS,
  card: 'payslip',
};
