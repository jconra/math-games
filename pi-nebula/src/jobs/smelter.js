// THE SMELTER'S CONTROL ROOM, at the operator's chair: what a load of ore pays (the game's maker, 2026-11-05: "they
// could go over to the controls and start calculating on the smelter to figure out how many credits they will get
// paid"). Out of the window the Miner hangar's crane swaps the parked Miner's canisters by itself (src/crane.js).
// The ladder, easiest first: counting the canisters on the ship, how many are still on it and which are full, racks
// of the same; tonnes by the canister and loads shared out; a part of the load (1/4 of the ore is iron), several
// parts; weights in tenths (1.2 tonnes and 0.9 tonnes); yields in percent (25% of the ore is iron); a load of
// canisters (8 canisters of 1.2 tonnes); any percent (35%); what the metal pays (tonnes times the price), and at the
// top the whole pay slip: the load, its yield, its pay. Decimals stay decimals.
// Mathwood Valley's question makers tell the whole-number stories through SETTING (engine.js); the counting, the
// parts, the weights, the percents and the pay are this job's own makers (MAKERS below), as Mathwood's are told at a
// store counter and have no hook for another world yet.
//
// THE LOAD IN THE HANGAR. Where a question counts canisters, it counts the ones really there when the slip is made:
// the game hands each maker `live` (src/crane.js load(): how many canisters are on the ship, how many of them full,
// how many are plugged in at the wall, how many on the rack, and for how long each of those stays as it is). A count
// is used only if it suits the level and the crane's timetable says it will still be true for STEADY seconds, so the
// answer is not out of date before it is picked, and only once (the next slip about the hangar waits until the crane
// has changed that count); otherwise, and in node, the numbers are the job's own (a slip "from the log"). The weight of a canister of the load in the hangar is one number for the crane's whole round (LOADS), so
// two slips about the same load agree. What the displays read is NOT taken live: a draining canister's display
// changes every second, so a question about it would be wrong before it was read. And the whole pay slip at the top
// is always a load from the log (of a Miner's 8 canisters where the hangar has one): a slip for "the load in the
// hangar" would have to be the same slip, with the same answer, for the half hour that load is there.
import { dec } from '../../../mathwood-valley/src/math/counterkit.js';
import { ownOrder } from './engine.js';

const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
const TONNE = ['tonne', 'tonnes'], CAN = ['canister', 'canisters'], CREDIT = ['credit', 'credits'];
export const STEADY = 40;      // seconds a live count must stay as it is to be asked about
export const CARRIES = 8;      // canisters a Miner carries (the parked one's mounts: kit/ships/miner-built.js)
// what a full canister of the load in the hangar holds, in tenths of a tonne: one weight for a whole round of the
// crane (the next load's is the next in the list), so two slips about the same load never disagree
export const LOADS = [12, 15, 8, 21, 14, 9, 25, 16, 11, 18, 7, 22, 13, 24, 6];
const WEIGHTS = [6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 18, 21, 22, 24, 25];

// who brought the load in (Mathwood's FOLK shape): the station's people
const FOLK = [
  { name: 'Miner Kestrel', she: true }, { name: 'Miner Dov', she: false }, { name: 'Pilot Juno', she: true }, { name: 'Engineer Okafor', she: false },
  { name: 'Dock Chief Ibarra', she: false }, { name: 'Crane Hand Pia', she: true }, { name: 'Furnace Hand Wren', she: true }, { name: 'Smelter Chief Anwar', she: false },
];
// what the smelter pours, and what a tonne of each pays (the same on every slip)
export const METALS = [
  { name: 'iron', price: 20 }, { name: 'nickel', price: 30 }, { name: 'copper', price: 40 },
  { name: 'cobalt', price: 50 }, { name: 'titanium', price: 60 }, { name: 'gold', price: 80 },
];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
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
          key: `count:${k.key}`, story: got ? 'Look at the hangar as it is right now.' : 'Look at this pay slip from the log.', ask: k.ask,
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
            { ...C(other, CAN), slip: 'other', why: `${other} is the ${askFull ? 'empty' : 'full'} ${one(other)}. Count the ones with the window ${askFull ? 'lit' : 'dark'}.` },
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
    make(step, { rand = Math.random, frac = 0 } = {}) {
      const t = kit(rand), metal = t.pick(METALS.slice(0, 4)).name;
      if (step <= 1) {
        const d = t.pick(frac < 0.5 ? [2, 3, 4, 5] : [3, 4, 5, 6, 8, 10]), k = t.int(2, 9), whole = d * k;
        const O = oreOf(whole), ctx = t.pick([
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
      const O = oreOf(whole), ctx = t.pick([
        { key: 'rock', story: `${n}/${d} of ${O.of} is plain rock, and the rest is metal. ${O.is}`, ask: 'How many tonnes of rock is that?', what: 'rock' },
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

  // ── weights in tenths of a tonne ─────────────────────────────────────────────────────────────────────────────
  // step 1  adding and taking away: 1.2 tonnes and 0.9 tonnes together; 2.3 tonnes with 0.8 drained
  // step 2  a load of canisters: 8 canisters of 1.2 tonnes (the canisters counted in the hangar where they can be)
  weigh: {
    strand: 'dec', at: (step) => (step <= 1 ? 50 : 60),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand);
      if (step <= 1) {
        for (let tries = 0; tries < 80; tries++) {
          const a = t.int(6, 29), b = t.int(4, 19);   // tenths
          if (a % 10 === 0 || b % 10 === 0 || a === b) continue;
          if (t.chance(0.55)) {
            const s = a + b, parts = (a % 10) + (b % 10), wholes = Math.floor(a / 10) + Math.floor(b / 10);
            const ctx = t.pick([
              `The first canister came in holding ${t1(a)} tonnes of ore and the second holding ${t1(b)} tonnes.`,
              `The scale under the crane reads ${t1(a)} tonnes for one canister and ${t1(b)} tonnes for the next.`,
            ]);
            return ownOrder({
              key: 'weigh:add', story: ctx, ask: 'How many tonnes is that together?', right: D(s * 10),
              slips: [
                ...(parts >= 10 ? [{ ...D(wholes * 100 + parts), slip: 'wholeParts', why: `${a % 10} tenths and ${b % 10} tenths make ${parts} tenths, and 10 tenths are another whole tonne: carry it.` }] : []),
                { ...D(Math.abs(a - b) * 10), slip: 'subtracted', why: 'That takes one from the other. Both canisters count: add them.' },
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
            key: 'weigh:left', story: `A canister came in holding ${t1(a)} tonnes of ore. ${t1(b)} tonnes have drained into the crusher so far.`, ask: 'How many tonnes are still in the canister?', right: D(d * 10),
            slips: [
              ...(borrow && digitwise !== d ? [{ ...D(digitwise * 10), slip: 'smallerFromBigger', why: `In the tenths the smaller digit was taken from the bigger. ${a % 10} tenths is less than ${b % 10} tenths: borrow a whole tonne.` }] : []),
              { ...D((a + b) * 10), slip: 'added', why: 'Draining leaves less in the canister: take away.' },
              { ...D((d + 1) * 10), slip: 'off', why: 'One tenth too many. Line the points up and take away each column.' },
              { ...D((d > 1 ? d - 1 : d + 2) * 10), slip: 'off', why: 'Line the points up and take away each column again.' },
              { ...D(b * 10), slip: 'part', why: `${t1(b)} tonnes is what has drained. The question is what is still inside.` },
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
      const w = got ? LOADS[(live.round || 0) % LOADS.length] : t.pick(WEIGHTS), p = n * w;   // tenths
      const ctx = !got ? { story: `A Miner came in with ${n} canisters, each holding ${t1(w)} tonnes of ore.`, ask: 'How many tonnes of ore is the load?' }
        : got.key === 'ship' ? { story: `The Miner in the hangar has ${n} full canisters on it right now. Each one holds ${t1(w)} tonnes of ore.`, ask: 'How many tonnes of ore are still on the ship?' }
          : got.key === 'wall' ? { story: `${n} canisters are plugged in at the wall right now. Each one came in holding ${t1(w)} tonnes of ore.`, ask: 'How many tonnes of ore did they bring?' }
            : { story: `The Miner in the hangar carries ${n} canisters. Each one holds ${t1(w)} tonnes of ore when it is full.`, ask: 'How many tonnes of ore is a full load?' };
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
        own: { strand: 'dec', at: 60 }, credit: [{ strand: 'mul', at: 43, weight: 0.5 }], facts: { n, w, ans: p, live: !!got, kind: got ? got.key : 'own' },
      }, rand);
    },
  },

  // ── yields in percent ──────────────────────────────────────────────────────────────────────────────────────
  // step 1  50%, 25% and 10% of a load (25% of the 12 tonnes is iron)
  // step 2  any percent, from 10% (35% of the 20 tonnes is iron: 10% is 2, 30% is 6, 5% is 1)
  percent: {
    strand: 'pct', at: (step) => (step <= 1 ? 58 : 62),
    make(step, { rand = Math.random, frac = 0 } = {}) {
      const t = kit(rand), metal = t.pick(METALS.slice(0, 4)).name;   // (the common ones: nobody's ore is 70% gold)
      if (step <= 1) {
        const pct = t.pick([50, 25, 10, 25, 10]), n = 100 / pct, whole = n * t.int(2, pct === 10 ? 9 : 12), part = whole / n;
        const said = pct === 50 ? 'half' : pct === 25 ? 'a quarter' : 'a tenth';
        const O = oreOf(whole), ctx = t.pick([
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
        return ownOrder({
          key: `percent:any:${pct}`, story: `${pct}% of ${oreOf(whole).of} is ${metal}. ${oreOf(whole).is}`, ask: `How many tonnes of ${metal} is that?`, right: T(part10),
          slips: [
            { ...T(pct * 10), slip: 'percentCount', why: `${pct}% isn't ${pct} tonnes: it's ${pct} out of every 100. 10% of ${whole} tonnes is ${t1(ten10)}.` },
            { ...T(whole * 10 - part10), slip: 'rest', why: `${t1(whole * 10 - part10)} tonnes is the other ${100 - pct}%: the rest of the ore.` },
            { ...T(ten10), slip: 'tenOnly', why: `${t1(ten10)} tonnes is 10%. ${pct}% is ${t1(pct)} lots of that.` },
            { ...T(part10 + ten10), slip: 'tenOff', why: `That's 10% too much: ${pct + 10}%. Count the 10%s again.` },
            ...(part10 > whole ? [{ ...T(part10 * 10), slip: 'pointLost', why: `That's more than all the ore there is. ${pct}% is only a part of the ${whole} tonnes.` }] : []),
            { ...T(part10 + 5), slip: 'off', why: `Find 10% of the ${whole} tonnes first, then build ${pct}% from it.` },
          ],
          pic: { kind: 'pctbar', whole, n: pct % 10 ? 20 : 10, take: pct % 10 ? pct / 5 : pct / 10, unit: TONNE, mode: 'part' },
          sum: tenthSteps(whole, pct, oreOf(whole).it),
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
  // step 1  tonnes times the price: 2.8 tonnes of cobalt at 50 credits a tonne
  // step 2  the whole pay slip: 8 canisters of 1.5 tonnes; 25% of the ore is titanium; 60 credits a tonne
  pay: {
    strand: 'dec', at: (step) => (step <= 1 ? 66 : 76),
    make(step, { rand = Math.random, live = null, frac = 0 } = {}) {
      const t = kit(rand), P = (credits) => { const n = Math.round(credits * 100), whole = n % 100 === 0; return { v: n, big: whole ? (n / 100).toLocaleString('en-US') : dec(n, 2, { trim: true }), small: n === 100 ? CREDIT[0] : CREDIT[1], label: `${whole ? n / 100 : dec(n, 2, { trim: true })} ${n === 100 ? CREDIT[0] : CREDIT[1]}` }; };
      if (step <= 1) {
        for (let tries = 0; tries < 60; tries++) {
          const m = t.pick(frac < 0.5 ? METALS.slice(0, 4) : METALS), w = t.int(6, frac < 0.5 ? 49 : 95);   // tenths of a tonne
          if (w % 10 === 0) continue;
          const pay = w * m.price / 10, whole = Math.floor(w / 10);
          return ownOrder({
            key: `pay:metal:${m.name}`, story: `The smelter poured ${t1(w)} tonnes of ${m.name} from this load. ${cap(m.name)} pays ${m.price} credits a tonne.`, ask: 'How many credits does the load pay?', right: P(pay),
            slips: [
              { ...P(w * m.price), slip: 'pointLost', why: `${w} × ${m.price} = ${(w * m.price).toLocaleString('en-US')}, but ${t1(w)} is ${w} tenths of a tonne: a tenth of that.` },
              ...(whole >= 1 ? [{ ...P(whole * m.price), slip: 'wholeOnly', why: `That pays for the ${u(whole, ['whole tonne', 'whole tonnes'])} and leaves out the other ${dec(w % 10, 1)} of a tonne.` }] : []),
              { ...P((whole + 1) * m.price), slip: 'roundedUp', why: `That pays for ${whole + 1} whole tonnes. There are only ${t1(w)}.` },
              { ...P(m.price), slip: 'oneTonne', why: `${m.price} credits is what one tonne pays. There are ${t1(w)} tonnes.` },
              { ...P(pay + m.price), slip: 'groupOff', why: `That's a tonne too many. ${t1(w)} tonnes at ${m.price} credits each.` },
            ],
            rightWhy: `${t1(w)} × ${m.price} = ${pay.toLocaleString('en-US')} credits`, sum: { op: 'mul', a: w / 10, b: m.price },
            help: { title: 'Tonne by tonne', pic: { kind: 'paybars', w, price: m.price, metal: m.name }, line: `Every whole tonne pays ${m.price} credits. The part of a tonne pays its part of ${m.price}: ${dec(w % 10, 1)} × ${m.price}.`,
              steps: [...(whole >= 1 ? [`The whole ${whole === 1 ? 'tonne' : 'tonnes'}: ${whole} × ${m.price}`] : []), `The part of a tonne: ${dec(w % 10, 1)} × ${m.price}`, ...(whole >= 1 ? ['Then add the two'] : [])] },
            own: { strand: 'dec', at: 66 }, credit: [{ strand: 'money', at: 60, weight: 0.5 }], facts: { w, price: m.price, ans: pay }, size: 2,
          }, rand);
        }
        throw new Error('smelter pay: nothing made');
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
          key: `pay:slip:${m.name}`, story: `This load is ${n} canisters, each holding ${t1(w)} tonnes of ore. ${pct}% of the ore is ${m.name}, and ${m.name} pays ${m.price} credits a tonne.`, ask: 'How many credits does the load pay?', right: P(pay),
          slips: [
            { ...P(ore * m.price / 10), slip: 'allOre', why: `That pays for all ${t1(ore)} tonnes as if every tonne were ${m.name}. Only ${pct}% of the ore is ${m.name}.` },
            { ...P(oneCan), slip: 'oneCanister', why: `That's the pay for one canister. There are ${n} of them.` },
            { ...P((ore - metal10) * m.price / 10), slip: 'rest', why: `That pays for the other ${100 - pct}%: the rock. Only the ${m.name} is paid for.` },
            { ...P(metal10 / 10), slip: 'noPrice', why: `${t1(metal10)} is the tonnes of ${m.name}. Each tonne pays ${m.price} credits.` },
            { ...P(pay + m.price), slip: 'off', why: `That's a tonne of ${m.name} too many. Work out the tonnes of ore, then the ${m.name}, then the pay.` },
          ].filter((s) => s.v > 0),
          rightWhy: `${n} × ${t1(w)} = ${t1(ore)} tonnes of ore; ${pct}% of it is ${t1(metal10)} tonnes of ${m.name}; × ${m.price} = ${pay.toLocaleString('en-US')} credits`,
          sum: [{ op: 'mul', a: w / 10, b: n, say: 'First the tonnes of ore in the load' }, ...yieldSteps, { op: 'mul', a: metal10 / 10, b: m.price, say: `Then the pay: the tonnes of ${m.name} times ${m.price} credits` }],
          lines: [['Ore', `${n} canisters × ${t1(w)} tonnes`], [cap(m.name), `${pct}% of the ore`], ['Price', `${m.price} credits a tonne`], ['Pay', '?']],
          help: { title: 'Down the pay slip', pic: { kind: 'payslip', n, w, pct, metal: m.name, price: m.price }, line: `Three sums, one after the other: the tonnes of ore, then the ${pct}% of it that is ${m.name}, then that many tonnes at ${m.price} credits each.`,
            steps: [`First the ore: ${n} × ${t1(w)} tonnes`, `Then the ${m.name}: ${pct}% of that`, `Then the pay: the tonnes of ${m.name} × ${m.price}`] },
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
  id: 'smelter', name: 'The smelter\'s control room', short: 'Smelter', math: 'What a load of ore pays: weights, yields, credits', pic: 'smelter', job: null,
  line: 'Pay slips at the operator\'s chair: canisters to count, tonnes of ore, the part that is metal, and what it pays.',
  levels: [
    { id: 'kCount', title: 'Counting canisters', line: 'Up to 5: the canisters on the Miner', gen: { mix: [M('count', 1, 2), K(1)] } },
    { id: 'kFull', title: 'Still on the ship, full and empty', line: 'Up to 8: 8 came in, 5 are still on the Miner', gen: { mix: [M('count', 2, 2), K(2)] } },
    { id: 'kRacks', title: 'Racks of the same', line: '3 racks with 2 canisters on each; 8 canisters and 5 more', strand: 'words', gen: { mix: [M('count', 3, 2), K(3)] } },
    { id: 'loads', title: 'Tonnes by the canister', line: '4 canisters with 3 tonnes in each; 15 tonnes and 18 together', gen: { mix: [W(1, ['groups', 'parts'])] } },
    { id: 'share', title: 'Sharing a load out', line: '24 tonnes into 4 canisters', gen: { mix: [W(2, ['share'], 2), W(1, ['groups'])] } },
    { id: 'part', title: 'A part of the load', line: '1/4 of the 12 tonnes is iron', gen: { mix: [M('part', 1, 2), W(3, ['groups', 'share', 'parts'])] } },
    { id: 'parts', title: 'Several parts', line: '3/4 of the 12 tonnes is rock', gen: { mix: [M('part', 2, 2), W(3, ['groups', 'share'])] } },
    { id: 'tenths', title: 'Weights in tenths', line: '1.2 tonnes and 0.9 tonnes together; 2.3 tonnes with 0.8 drained', gen: { mix: [M('weigh', 1, 2), M('part', 2)] } },
    { id: 'percent', title: 'Yields in percent', line: '25% of the 12 tonnes is iron', gen: { mix: [M('percent', 1, 2), M('weigh', 1)] } },
    { id: 'tonnes', title: 'A load of canisters', line: '8 canisters of 1.2 tonnes; 2 bars from every 5 tonnes', gen: { mix: [M('weigh', 2, 2), M('ratio', 3)] } },
    { id: 'anyPercent', title: 'Any percent', line: '35% of the 20 tonnes is iron', gen: { mix: [M('percent', 2, 2), M('weigh', 2)] } },
    { id: 'credits', title: 'What the metal pays', line: '2.8 tonnes of cobalt at 50 credits a tonne', gen: { mix: [M('pay', 1, 2), M('percent', 2)] } },
    { id: 'payslip', title: 'The whole pay slip', line: '8 canisters of 1.5 tonnes, 25% titanium, 60 credits a tonne', strand: 'pct', gen: { mix: [M('pay', 2, 2), M('ratio', 5)] } },
  ],
};

export const JOB = {
  // (named in the game's maker's own word for it: "they could go over to the controls and start calculating")
  id: 'smelter', name: 'The smelter controls', short: 'Smelter', open: true,
  // where the job is: beside the operator's chair, on the door's side of it (the chair's own frame: it faces +z, the
  // window and the hangar)
  spot: { piece: 'opChair', local: [-0.78, 0, -0.05], face: [0, 1] },
  // the camera while it's up: from the chair's seat, out of the window at the Miner and the crane (the station file's
  // view). The crew member is in the chair, so their body is put away as it is where a job is seen through their eyes
  view: 'smelter-console', seated: true,
  sign: 'Smelter controls', hint: 'Work out what the load pays',
  place: PLACE, setting: SETTING, makers: MAKERS,
  card: 'payslip',
};
