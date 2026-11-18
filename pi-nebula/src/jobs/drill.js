// THE DRILL OPERATOR'S SCAN: the question asked as a rock is taken in the claw and scanned, for a crew member who signs
// on as a captain's drill operator (src/missions.js; the game is src/drill.js and src/drillview.js). The game's maker
// (2026-11-17): "It asks a math question about the ore fraction or estimated weight as it scans it", and "We can do the
// math question when it comes time to harvest"; all of it about the work in hand ("it will be fun to see how math can
// be actually applied"). One ladder like every job's, kids to grown-ups, easiest first:
//   the veins the scan lights up, counted; veins near the top and near the bottom, the holes a rock has left, the
//   canisters still to fill; veins of the same number of lumps; tonnes of ore by the vein, the plain rock against the
//   ore, ore shared out; a part of the rock that is ore (1/4 of 12 tonnes), several parts; the box the scan measures
//   the rock by (cubic metres); weights in tenths, vein by vein; how many canisters the ore fills (6 tonnes into
//   canisters of 1/2 a tonne); the rock's weight from its box; the percent of the rock that is ore; canisters of 3/4
//   of a tonne; any percent; a rock that is a ball (about half its box); what the ore is worth; and at the top the
//   drill operator's own share of the rock, three sums one after the other.
// Tonnes, canisters, cubic metres and credits; decimals stay decimals and fractions stay fractions.
//
// SHARED, NOT COPIED. The parts of the rock, the weights in tenths, the percents and what the ore is worth are the
// SMELTER'S OWN MAKERS (src/jobs/smelter.js MAKERS.part, weigh, percent, pay), told of a rock in the claw through their
// `tell`: the numbers, the slips, the pictures and the sums are theirs. Mathwood Valley's makers tell the whole-number
// stories through SETTING (engine.js). The counting, the box and the canisters filled are this job's own (MAKERS).
//
// THE ROCK IN THE CLAW (`live`, from src/drillview.js: { rock: { metal, size, holes, rich }, cans: { full, of } }): the
// question names the rock's own metal, and where a level counts holes or canisters it uses the rock's holes and the
// canisters as they are. The tonnes in a story are the scan's reading for the card, sized to suit the level (the game
// counts ore in canisters; it shows no tonnes of its own that a card could contradict). From the levels page, and in
// node, there is no rock: the maker picks a metal.
import { partsWord } from '../../../mathwood-valley/labs/fishing/frac.js';
import { ownOrder } from './engine.js';
import { MAKERS as SMELTER, METALS, CARRIES, ORE_SELLS } from './smelter.js';
import { ORE } from '../drill.js';

const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
const say = (n) => Number(n).toLocaleString('en-US');
const TONNE = ['tonne', 'tonnes'], CAN = ['canister', 'canisters'], VEIN = ['vein', 'veins'], LUMP = ['lump', 'lumps'], HOLE = ['hole', 'holes'], M3 = ['cubic metre', 'cubic metres'], CREDIT = ['credit', 'credits'];
const C = (n, unit) => ({ v: n, big: say(n), small: n === 1 ? unit[0] : unit[1], label: `${say(n)} ${n === 1 ? unit[0] : unit[1]}` });
const kit = (rand) => ({ int: (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)), pick: (a) => a[Math.floor(rand() * a.length)], chance: (p) => rand() < p });
export const SHARE = 20;   // the drill operator's share of what the haul sells for, percent (src/missions.js ROLES.drill)

// who is aboard (Mathwood's FOLK shape): the Miner's crew
const FOLK = [{ name: 'Miner Kestrel', she: true }, { name: 'Captain Ruiz', she: false }, { name: 'Pilot Juno', she: true }, { name: 'Engineer Okafor', she: false }];
export const SETTING = {
  folk: FOLK,
  groups: [
    { key: 'veins', item: VEIN, unit: TONNE, story: ({ a, b }) => `The scan finds ${a} veins in this rock, with ${b} tonnes of ore in each vein.`, ask: () => 'How many tonnes of ore is that?' },
    { key: 'drilling', item: HOLE, unit: ['minute', 'minutes'], story: ({ a, b }) => `The cutter takes ${b} minutes to drill each hole. The rocks ahead need ${a} holes.`, ask: () => 'How many minutes of drilling is that?' },
    { key: 'rocks', item: ['rock', 'rocks'], unit: TONNE, story: ({ a, b }) => `The scan picks out ${a} rocks, each with ${b} tonnes of ore in it.`, ask: () => 'How many tonnes of ore is that?' },
  ],
  share: [
    { key: 'veins', thing: TONNE, box: VEIN, story: ({ total, groups }) => `The scan finds ${total} tonnes of ore in this rock, spread evenly over ${groups} veins.`, ask: 'How many tonnes are in each vein?' },
    { key: 'cans', thing: TONNE, box: CAN, story: ({ total, groups }) => `The cutter brought in ${total} tonnes of ore. It goes evenly into ${groups} canisters.`, ask: 'How many tonnes go in each canister?' },
  ],
  crates: [
    { key: 'canisters', box: CAN, story: ({ total, per }) => `The scan finds ${total} tonnes of ore in this rock. A canister holds ${per} tonnes.`, ask: 'How many canisters are needed so all the ore fits?' },
  ],
  partsLeft: [
    { key: 'plain', unit: TONNE, story: ({ a, b }) => `The scan says this rock weighs ${a} tonnes. ${b} tonnes of it is ore.`, ask: 'How many tonnes of it is plain rock?' },
    { key: 'taken', unit: TONNE, story: ({ a, b }) => `The scan found ${a} tonnes of ore in this rock. The cutter has taken ${b} tonnes of it.`, ask: 'How many tonnes of ore are still in the rock?' },
  ],
  partsTogether: [
    { key: 'veins', unit: TONNE, story: ({ a, b }) => `The scan finds ${a} tonnes of ore in one vein and ${b} tonnes in another.`, ask: 'How many tonnes of ore is that in all?' },
    { key: 'weight', unit: TONNE, story: ({ a, b }) => `The scan says this rock holds ${a} tonnes of ore and ${b} tonnes of plain rock.`, ask: 'How many tonnes does the rock weigh?' },
  ],
};

// the rock a card is about: the one in the claw, or (the levels page, node) one of the usual metals
const rockOf = (live, t) => (live && live.rock ? live.rock : { metal: t.pick(METALS.slice(0, 4)).name, size: 'medium', holes: t.int(4, 6), rich: false });
const glowOf = (rock) => (ORE[rock.metal] || ORE.copper).glow;
// the words the smelter's makers are given, to ask their sums of this rock
function tellOf(rock) {
  const ore = `${rock.metal} ore`;
  return {
    metal: ore,
    ore: (whole) => ({ of: 'this rock', is: `The scan says the rock weighs ${whole} tonnes.`, it: 'rock' }),
    part: ({ step, n, d, whole }) => (step === 1
      ? [{ key: 'ore', story: `The scan says this rock weighs ${whole} tonnes, and 1/${d} of it is ${ore}.`, ask: `How many tonnes of ${ore} is that?`, what: ore }]
      : [{ key: 'ore', story: `The scan says this rock weighs ${whole} tonnes, and ${n}/${d} of it is ${ore}.`, ask: `How many tonnes of ${ore} is that?`, what: ore },
        { key: 'plain', story: `The scan says this rock weighs ${whole} tonnes, and ${n}/${d} of it is plain rock with no ore in it.`, ask: 'How many tonnes of plain rock is that?', what: 'plain rock' }]),
    percent: ({ pct, whole }) => [{ key: 'ore', story: `The scan says this rock weighs ${whole} tonnes, and ${pct}% of it is ${ore}.`, ask: `How many tonnes of ${ore} is that?`, rest: `the other ${100 - pct}%: the plain rock` }],
    weigh: {
      add: ({ a, b }) => [`The scan reads ${a} tonnes of ${ore} in one vein of this rock and ${b} tonnes in another.`],
      both: 'That takes one from the other. Both veins count: add them.',
      left: ({ a, b }) => ({ story: `The scan found ${a} tonnes of ${ore} in this rock. The cutter has taken ${b} tonnes of it so far.`, ask: 'How many tonnes of ore are still in the rock?',
        added: 'Drilling leaves less in the rock: take away.', part: `${b} tonnes is what the cutter has taken. The question is what is still in the rock.` }),
    },
    pay: ({ w }) => { const price = ORE_SELLS * (rock.rich ? 2 : 1); return { m: { name: 'ore', price }, story: `The scan finds ${w} tonnes of ${ore} in this rock. ${rock.rich ? 'Ore from a rich rock' : 'Ore'} sells for ${say(price)} credits a tonne.`, ask: 'How many credits is the ore in this rock worth?' }; },
  };
}
// one of the smelter's own makers, asked of the rock in the claw
const shared = (name) => ({
  strand: SMELTER[name].strand, at: SMELTER[name].at,
  make(step, o = {}) { const t = kit(o.rand || Math.random); return SMELTER[name].make(step, { ...o, live: null, tell: tellOf(rockOf(o.live, t)) }); },
});

export const MAKERS = {
  // ── counting what the scan shows (the youngest): the things are drawn on the card, and counting them is the skill ──
  // step 1  up to 5: the veins of ore the scan lights up
  // step 2  up to 10: veins near the top and near the bottom, in all; the holes a rock has left
  // step 3  the canisters still to fill, of the Miner's 8
  veins: {
    strand: 'number', at: (step) => [0, 6, 10][Math.max(1, Math.min(3, step)) - 1],
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), rock = rockOf(live, t), glow = glowOf(rock), ore = `${rock.metal} ore`;
      if (step <= 1) {
        const n = t.int(1, 5);
        return ownOrder({
          key: 'veins:count', story: `The scan lights up the ${ore} inside this rock.`, ask: 'How many veins of ore does the scan show?', right: C(n, VEIN),
          slips: [
            { ...C(n + 1, VEIN), slip: 'off', why: 'One too many. Count again, touching each one once.' },
            { ...C(n - 1, VEIN), slip: 'off', why: 'One short. Count again, touching each one once.' },
            { ...C(n + 2, VEIN), slip: 'off', why: 'Too many. Count again, touching each one once.' },
          ],
          rightWhy: `${u(n, VEIN)} of ${ore}`,
          picFirst: true, help: { title: 'Count them', pic: { kind: 'scan', n, glow }, line: 'Touch each glowing vein once as you count: 1, 2, 3 ...' },
          own: { strand: 'number', at: 0 }, facts: { kind: 'veins', n },
        }, rand, 3);
      }
      if (step === 2) {
        if (t.chance(0.5)) {
          const a = t.int(1, 5), b = t.int(1, 5), n = a + b;
          return ownOrder({
            key: 'veins:both', story: `The scan shows ${u(a, VEIN)} of ${ore} near the top of this rock and ${b} near the bottom.`, ask: 'How many veins is that in all?', right: C(n, VEIN),
            slips: [
              { ...C(a, VEIN), slip: 'part', why: `${a} is only the top. Count the ones near the bottom too.` },
              ...(b !== a ? [{ ...C(b, VEIN), slip: 'part', why: `${b} is only the bottom. Count the ones near the top too.` }] : []),
              { ...C(n + 1, VEIN), slip: 'off', why: 'One too many. Count them all again, touching each one once.' },
              { ...C(n - 1, VEIN), slip: 'off', why: 'One short. Count them all again, touching each one once.' },
            ],
            rightWhy: `${a} and ${b} more make ${u(n, VEIN)}`, sum: { op: 'add', a, b },
            picFirst: true, help: { title: 'Count them all', pic: { kind: 'scan', split: [a, b], glow }, line: 'Count the veins above the dotted line, then keep counting below it.' },
            own: { strand: 'number', at: 6 }, credit: [{ strand: 'add', at: 5, weight: 0.5 }], facts: { kind: 'both', a, b, n },
          }, rand, 3);
        }
        const all = Math.max(3, Math.min(8, rock.holes || 5)), used = t.int(1, all - 1), n = all - used;
        return ownOrder({
          key: 'veins:holes', story: `This rock stands ${all} holes before it breaks up. The cutter has drilled ${used}.`, ask: 'How many holes are left?', right: C(n, HOLE),
          slips: [
            ...(used !== n ? [{ ...C(used, HOLE), slip: 'gone', why: `${used} is how many are drilled. Count the rings still open.` }] : []),
            { ...C(all, HOLE), slip: 'all', why: `${all} is all the holes the rock stands. Some are drilled already.` },
            { ...C(n + 1, HOLE), slip: 'off', why: 'One too many. Count the open rings again.' },
            { ...C(n - 1, HOLE), slip: 'off', why: 'One short. Count the open rings again.' },
          ],
          rightWhy: `${all} take away ${used} leaves ${u(n, HOLE)}`, sum: { op: 'sub', a: all, b: used },
          picFirst: true, help: { title: 'Count the open rings', pic: { kind: 'holes', all, used, glow }, line: 'A crossed ring is a hole already drilled. Count the rings still open.' },
          own: { strand: 'number', at: 6 }, credit: [{ strand: 'sub', at: 5, weight: 0.5 }], facts: { kind: 'holes', all, used, n },
        }, rand, 3);
      }
      const now = live && live.cans && Number.isInteger(live.cans.full) && live.cans.full >= 1 && live.cans.full < CARRIES ? live.cans.full : null;
      const full = now != null ? now : t.int(1, CARRIES - 1), n = CARRIES - full;
      return ownOrder({
        key: 'veins:cans', story: `The Miner carries ${CARRIES} canisters. ${full} of them ${full === 1 ? 'is' : 'are'} full of ${ore}.`, ask: 'How many canisters are still to fill?', right: C(n, CAN),
        slips: [
          ...(full !== n ? [{ ...C(full, CAN), slip: 'gone', why: `${full} is how many are full. Count the dark ones: they are still empty.` }] : []),
          { ...C(CARRIES, CAN), slip: 'all', why: `${CARRIES} is all of them. Some are full already.` },
          { ...C(n + 1, CAN), slip: 'off', why: 'One too many. Count the dark ones again.' },
          { ...C(n - 1, CAN), slip: 'off', why: 'One short. Count the dark ones again.' },
        ],
        rightWhy: `${CARRIES} take away ${full} leaves ${u(n, CAN)}`, sum: { op: 'sub', a: CARRIES, b: full },
        picFirst: true, help: { title: 'Count the empty ones', pic: { kind: 'cans', place: 'row', slots: [...Array(full).fill('full'), ...Array(n).fill('empty')] }, line: 'A full canister has its window lit. Count the dark ones: they are still to fill.' },
        own: { strand: 'number', at: 10 }, credit: [{ strand: 'sub', at: 5, weight: 0.5 }], facts: { kind: 'cans', full, n, live: now != null },
      }, rand, 3);
    },
  },

  // ── veins of the same: 3 veins with 4 lumps of ore in each ──
  lumps: {
    strand: 'words', at: () => 16,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), rock = rockOf(live, t), g = t.int(2, 4), e = t.int(2, 5), ans = g * e;
      return ownOrder({
        key: 'lumps:veins', story: `The scan shows ${g} veins in this rock, with ${e} lumps of ${rock.metal} ore in each vein.`, ask: 'How many lumps of ore is that in all?', right: C(ans, LUMP),
        slips: [
          { ...C(g + e, LUMP), slip: 'added', why: 'That adds the veins and the lumps. Count every lump in every vein.' },
          { ...C(e, LUMP), slip: 'one', why: `${e} is one vein. There are ${g} veins.` },
          { ...C(ans + e, LUMP), slip: 'groupOff', why: `That's ${g + 1} veins. Count the veins again: ${g}.` },
          { ...C(ans - 1, LUMP), slip: 'off', why: 'One short. Count every lump in every vein.' },
        ],
        rightWhy: `${g} veins of ${e}: ${Array(g).fill(e).join(' + ')} = ${u(ans, LUMP)}`,
        picFirst: true, help: { title: 'Count them', pic: { kind: 'scan', groups: g, each: e, glow: glowOf(rock) }, line: `Count every lump in every vein: ${g} veins, ${e} in each.` },
        own: { strand: 'words', at: 16 }, credit: [{ strand: 'mul', at: 14, weight: 0.5 }], facts: { g, e, ans },
      }, rand, 3);
    },
  },

  // ── the smelter's own makers, asked of the rock (their numbers, slips, pictures and sums) ──
  part: shared('part'), weigh: shared('weigh'), percent: shared('percent'), pay: shared('pay'),

  // ── the rock's estimated weight, from the box the scan measures it by ──
  // step 1  the box: 4 m long, 3 m wide, 2 m high: how many cubic metres
  // step 2  its weight: a blocky rock that fills its box, 3 tonnes to the cubic metre
  // step 3  a rock that is a ball: about half of the box it just fits in, then its weight
  box: {
    strand: 'geo', at: (step) => [46, 54, 64][Math.max(1, Math.min(3, step)) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand);
      if (step >= 3) {
        const s = t.pick([2, 4, 6, 10]), per = t.pick([2, 3]), boxV = s * s * s, ball = boxV / 2, ans = ball * per;
        return ownOrder({
          key: 'box:ball', story: `This rock is close to a ball, about ${s} metres across. A ball fills about half of the box it just fits in. A cubic metre of this rock weighs ${per} tonnes.`, ask: 'About how many tonnes does the rock weigh?', right: C(ans, TONNE),
          slips: [
            { ...C(boxV * per, TONNE), slip: 'wholeBox', why: `That is the whole box, ${say(boxV)} cubic metres. The ball fills about half of it.` },
            { ...C(ball, TONNE), slip: 'noWeight', why: `${say(ball)} is the rock's cubic metres. Each one weighs ${per} tonnes.` },
            { ...C(s * s * per, TONNE), slip: 'twoOnly', why: `${s} × ${s} is only one face of the box. The box is ${s} × ${s} × ${s}.` },
            { ...C(s * 3 * per, TONNE), slip: 'timesThree', why: `${s} × 3 is not ${s} × ${s} × ${s}. Three sides ${s} metres long: multiply them.` },
            { ...C(ans + per * s * s, TONNE), slip: 'off', why: `Work out the box first (${s} × ${s} × ${s}), then half of it, then the weight.` },
          ],
          rightWhy: `The box is ${s} × ${s} × ${s} = ${say(boxV)} cubic metres; half of it is ${say(ball)}; × ${per} = ${say(ans)} tonnes`,
          sum: [{ op: 'mul', a: s, b: s, say: 'First one face of the box' }, { op: 'mul', a: s * s, b: s, say: 'Then the whole box, in cubic metres' }, { op: 'div', a: boxV, b: 2, say: 'Then the ball: about half the box' }, { op: 'mul', a: ball, b: per, say: `Then its weight: ${per} tonnes for each cubic metre` }],
          help: { title: 'A ball in its box', pic: { kind: 'rockbox', l: s, w: s, h: s, per, ball: true }, line: 'Work out the box the ball just fits in, take half of it, then weigh it: so many tonnes for each cubic metre.',
            steps: [`First the box: ${s} × ${s} × ${s}`, 'Then the ball: half of that', `Then the weight: that × ${per}`] },
          own: { strand: 'geo', at: 64 }, credit: [{ strand: 'mul', at: 43, weight: 0.5 }], facts: { s, per, box: boxV, ball, ans }, size: 3,
        }, rand);
      }
      for (let tries = 0; tries < 60; tries++) {
        const l = t.int(3, 6), w = t.int(2, 5), h = t.int(2, 4);
        if (l < w || w < h || (l === w && w === h)) continue;
        const floor = l * w, vol = floor * h;
        if (step <= 1) {
          return ownOrder({
            key: 'box:volume', story: `The scan measures this rock by the box round it: about ${l} metres long, ${w} metres wide and ${h} metres high.`, ask: 'How many cubic metres is the box round the rock?', right: C(vol, M3),
            slips: [
              { ...C(l + w + h, M3), slip: 'added', why: 'That adds the three sides. The space in a box is long × wide × high.' },
              { ...C(floor, M3), slip: 'twoOnly', why: `${l} × ${w} is only the bottom layer of the box. It is ${h} layers high.` },
              { ...C(vol + floor, M3), slip: 'layerOff', why: `That is ${h + 1} layers. The box is ${h} metres high.` },
              { ...C(vol - floor, M3), slip: 'layerOff', why: `That is ${h - 1} ${h - 1 === 1 ? 'layer' : 'layers'}. The box is ${h} metres high.` },
            ],
            rightWhy: `${l} × ${w} = ${floor} in each layer; ${h} layers: ${floor} × ${h} = ${u(vol, M3)}`,
            sum: [{ op: 'mul', a: l, b: w, say: 'First the bottom layer of the box' }, { op: 'mul', a: floor, b: h, say: `Then ${h} layers high` }],
            help: { title: 'Layer by layer', pic: { kind: 'rockbox', l, w, h }, line: `The bottom layer is ${l} long and ${w} wide. The box is ${h} of those layers high.`, steps: [`First the bottom layer: ${l} × ${w}`, `Then ${h} layers: that × ${h}`] },
            own: { strand: 'geo', at: 46 }, credit: [{ strand: 'mul', at: 30, weight: 0.5 }], facts: { l, w, h, ans: vol }, size: 2,
          }, rand);
        }
        const per = t.pick([2, 3]), ans = vol * per;
        return ownOrder({
          key: 'box:weight', story: `The scan measures this rock by the box round it: about ${l} metres long, ${w} wide and ${h} high. It is a blocky rock that fills its box, and a cubic metre of it weighs ${per} tonnes.`, ask: 'About how many tonnes does the rock weigh?', right: C(ans, TONNE),
          slips: [
            { ...C(vol, TONNE), slip: 'noWeight', why: `${vol} is the cubic metres. Each one weighs ${per} tonnes.` },
            { ...C(floor * per, TONNE), slip: 'twoOnly', why: `That weighs only the bottom layer. The box is ${h} layers high.` },
            { ...C((l + w + h) * per, TONNE), slip: 'added', why: 'That adds the three sides. The space in a box is long × wide × high.' },
            { ...C(ans + floor * per, TONNE), slip: 'layerOff', why: `That is ${h + 1} layers. The box is ${h} metres high.` },
            { ...C(vol + per, TONNE), slip: 'addedWeight', why: `That adds the ${per}. Every cubic metre weighs ${per} tonnes: ${vol} lots of ${per}.` },
          ],
          rightWhy: `${l} × ${w} × ${h} = ${vol} cubic metres; × ${per} = ${u(ans, TONNE)}`,
          sum: [{ op: 'mul', a: l, b: w, say: 'First the bottom layer of the box' }, { op: 'mul', a: floor, b: h, say: `Then ${h} layers high: the cubic metres` }, { op: 'mul', a: vol, b: per, say: `Then the weight: ${per} tonnes for each cubic metre` }],
          help: { title: 'The box, then its weight', pic: { kind: 'rockbox', l, w, h, per }, line: `Work out the cubic metres in the box first. Each one weighs ${per} tonnes.`, steps: [`First the bottom layer: ${l} × ${w}`, `Then ${h} layers: that × ${h}`, `Then the weight: that × ${per}`] },
          own: { strand: 'geo', at: 54 }, credit: [{ strand: 'mul', at: 43, weight: 0.5 }], facts: { l, w, h, per, vol, ans }, size: 3,
        }, rand);
      }
      throw new Error('drill box: nothing made');
    },
  },

  // ── how many canisters the rock's ore fills ──
  // step 1  canisters of one part of a tonne: 6 tonnes of ore into canisters of 1/2 a tonne (12 canisters)
  // step 2  canisters of several parts: 6 tonnes into canisters of 3/4 of a tonne (8 canisters)
  fill: {
    strand: 'frac', at: (step) => (step <= 1 ? 52 : 60),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), rock = rockOf(live, t), ore = `${rock.metal} ore`;
      if (step <= 1) {
        const d = t.pick([2, 4, 2, 3]), T = t.int(2, 6), ans = T * d;
        return ownOrder({
          key: `fill:one:${d}`, story: `The scan finds ${T} tonnes of ${ore} in this rock. Each canister holds 1/${d} of a tonne of ore.`, ask: 'How many canisters would all of it fill?', right: C(ans, CAN),
          slips: [
            { ...C(T, CAN), slip: 'same', why: `That is one canister for each tonne. A canister holds only 1/${d} of a tonne, so each tonne fills ${d}.` },
            ...(T % d === 0 && T / d !== ans ? [{ ...C(T / d, CAN), slip: 'shared', why: `That cuts the ${T} tonnes into ${d}. Each tonne fills ${d} canisters: ${T} × ${d}.` }] : []),
            { ...C(T + d, CAN), slip: 'added', why: `That adds ${T} and ${d}. Each of the ${T} tonnes fills ${d} canisters.` },
            { ...C(ans + d, CAN), slip: 'groupOff', why: `That is ${T + 1} tonnes of ore. The scan finds ${T}.` },
            { ...C(ans - d, CAN), slip: 'groupOff', why: `That is ${T - 1} ${T - 1 === 1 ? 'tonne' : 'tonnes'} of ore. The scan finds ${T}.` },
          ],
          rightWhy: `Each tonne fills ${d} canisters: ${T} × ${d} = ${u(ans, CAN)}`, sum: { op: 'mul', a: T, b: d },
          help: { title: 'Tonne by tonne', pic: { kind: 'fillcans', tonnes: T, n: 1, d }, line: `1/${d} of a tonne to a canister means each tonne of ore fills ${d} canisters.`, steps: [`${T} tonnes, ${d} canisters from each: ${T} × ${d}`] },
          own: { strand: 'frac', at: 52 }, credit: [{ strand: 'mul', at: 20, weight: 0.5 }], facts: { T, n: 1, d, ans },
        }, rand);
      }
      const [n, d] = t.pick([[3, 4], [2, 3], [3, 8], [2, 5], [3, 5], [3, 4]]), k = t.int(1, 4), T = n * k, parts = T * d, ans = parts / n;
      return ownOrder({
        key: `fill:some:${n}/${d}`, story: `The scan finds ${T} tonnes of ${ore} in this rock. Each canister holds ${n}/${d} of a tonne of ore.`, ask: 'How many canisters would all of it fill?', right: C(ans, CAN),
        slips: [
          { ...C(parts, CAN), slip: 'bottomOnly', why: `${parts} is how many ${partsWord(d)} of a tonne there are. A canister takes ${n} of them.` },
          { ...C(T, CAN), slip: 'same', why: `That is one canister for each tonne. A canister holds less than a tonne, so there are more canisters than tonnes.` },
          ...(Number.isInteger(T * n / d) ? [{ ...C(T * n / d, CAN), slip: 'multiplied', why: `That is ${n}/${d} of ${T}. The question is how many lots of ${n}/${d} fit into ${T}: more than ${T}.` }] : []),
          { ...C(ans + 1, CAN), slip: 'off', why: `Cut each tonne into ${partsWord(d)}, then count ${n} of them to a canister.` },
          { ...C(ans + d, CAN), slip: 'groupOff', why: `Cut each tonne into ${partsWord(d)}, then count ${n} of them to a canister.` },
        ],
        rightWhy: `${T} tonnes is ${T} × ${d} = ${parts} ${partsWord(d)}; ${n} to a canister: ${parts} ÷ ${n} = ${u(ans, CAN)}`,
        sum: [{ op: 'mul', a: T, b: d, say: `First the ${partsWord(d)} of a tonne in ${T} tonnes` }, { op: 'div', a: parts, b: n, say: `Then ${n} of them to a canister` }],
        help: { title: 'Cut the tonnes into parts', pic: { kind: 'fillcans', tonnes: T, n, d }, line: `Cut every tonne into ${partsWord(d)}. A canister takes ${n} of them.`, steps: [`First the parts: ${T} × ${d}`, `Then ${n} to a canister: that ÷ ${n}`] },
        own: { strand: 'frac', at: 60 }, credit: [{ strand: 'div', at: 45, weight: 0.5 }], facts: { T, n, d, ans }, size: 2,
      }, rand);
    },
  },

  // ── the drill operator's own share of this rock: the ore in it, what the ore sells for, 20% of that ──
  worth: {
    strand: 'pct', at: () => 76,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), rock = rockOf(live, t), ore = `${rock.metal} ore`, price = ORE_SELLS * (rock.rich ? 2 : 1);
      const W = 10 * t.int(2, 9), pct = t.pick([10, 20, 30, 40, 50]), tonnes = W * pct / 100, sold = tonnes * price, pay = sold * SHARE / 100, ten = W / 10;
      return ownOrder({
        key: `worth:share:${pct}`, story: `The scan says this rock weighs ${W} tonnes, and ${pct}% of it is ${ore}. ${rock.rich ? 'Ore from a rich rock' : 'Ore'} sells for ${say(price)} credits a tonne, and the drill operator's share is ${SHARE}%.`, ask: 'How many credits is the drill operator\'s share of this rock?', right: C(pay, CREDIT),
        slips: [
          { ...C(sold, CREDIT), slip: 'noShare', why: `${say(sold)} credits is what the ore sells for. The share is ${SHARE}% of that.` },
          { ...C(W * price * SHARE / 100, CREDIT), slip: 'allRock', why: `That counts the whole ${W} tonnes as ore. Only ${pct}% of the rock is ore.` },
          { ...C(sold - pay, CREDIT), slip: 'rest', why: `That is the other ${100 - SHARE}%: the captain's and the rest of the crew's.` },
          { ...C(sold / 10, CREDIT), slip: 'tenOnly', why: `That is 10% of what the ore sells for. ${SHARE}% is twice that.` },
          { ...C(pay + price, CREDIT), slip: 'off', why: 'Three sums: the tonnes of ore, what they sell for, then the share.' },
        ],
        rightWhy: `${pct}% of ${W} is ${tonnes} tonnes of ore; × ${say(price)} = ${say(sold)} credits; ${SHARE}% of that is ${say(pay)} credits`,
        sum: [{ op: 'div', a: W, b: 10, say: 'First 10% of the rock: a tenth of it' }, ...(pct > 10 ? [{ op: 'mul', a: ten, b: pct / 10, say: `Then ${pct}% is ${pct / 10} lots of 10%: the tonnes of ore` }] : []),
          { op: 'mul', a: tonnes, b: price, say: `Then what the ore sells for: ${say(price)} credits a tonne` }, { op: 'div', a: sold, b: 5, say: `Then the share: ${SHARE}% is a fifth of it` }],
        lines: [['The rock', `${W} tonnes`], ['Ore', `${pct}% of the rock`], ['Ore sells for', `${say(price)} credits a tonne`], ['The drill operator\'s share', `${SHARE}%`], ['The share of this rock', '?']],
        pic: { kind: 'pctbar', whole: W, n: 10, take: pct / 10, unit: TONNE, mode: 'part' },
        help: { title: 'Three sums, one after the other', line: `First the tonnes of ore (${pct}% of the ${W} tonnes), then what they sell for at ${say(price)} credits a tonne, then ${SHARE}% of that: a fifth.`,
          steps: [`First the ore: ${pct}% of ${W} tonnes`, `Then what it sells for: that × ${say(price)}`, `Then the share: that ÷ 5`] },
        own: { strand: 'pct', at: 76 }, credit: [{ strand: 'mul', at: 43, weight: 0.5 }], facts: { W, pct, tonnes, price, sold, pay }, size: 3,
      }, rand);
    },
  },
};

// ── the ladder: easiest first, every step small ──────────────────────────────────────────────────────────────────
const W = (step, types, w = 1) => ({ maker: 'words', step, types, w });
const M = (maker, step, w = 1) => ({ maker, step, w });

export const PLACE = {
  id: 'drill', name: 'The Miner\'s drill', short: 'Drill', math: 'A rock\'s ore and its weight: counting, parts, cubic metres, percents, credits', pic: 'smelter', job: null,
  line: 'The scan of a rock in the claw: the veins of ore in it, the part of it that is ore, its weight from its size, the canisters it fills, and what it is worth.',
  levels: [
    { id: 'kVeins', title: 'Veins to count', line: 'Up to 5: the veins of ore the scan shows', gen: { mix: [M('veins', 1)] } },
    { id: 'kHoles', title: 'Veins in all, holes left', line: 'Up to 10: 3 veins near the top and 2 near the bottom; 5 holes, 2 drilled', gen: { mix: [M('veins', 2, 2), M('veins', 1)] } },
    { id: 'kCans', title: 'Canisters still to fill', line: '8 canisters, 5 full: how many to fill', gen: { mix: [M('veins', 3, 2), M('veins', 2)] } },
    { id: 'kLumps', title: 'Veins of the same', line: '3 veins with 4 lumps of ore in each', strand: 'words', gen: { mix: [M('lumps', 1, 2), M('veins', 3)] } },
    { id: 'tonnes', title: 'Tonnes by the vein', line: '4 veins with 3 tonnes in each; 20 tonnes of rock, 8 of it ore', gen: { mix: [W(1, ['groups', 'parts'])] } },
    { id: 'share', title: 'Ore shared out', line: '24 tonnes of ore over 4 veins', gen: { mix: [W(2, ['share'], 2), W(1, ['groups'])] } },
    { id: 'part', title: 'A part of the rock', line: '1/4 of the 12 tonnes is ore', gen: { mix: [M('part', 1, 2), W(3, ['groups', 'share', 'parts'])] } },
    { id: 'parts', title: 'Several parts', line: '3/4 of the 12 tonnes is plain rock', gen: { mix: [M('part', 2, 2), W(3, ['groups', 'share'])] } },
    { id: 'box', title: 'The box round the rock', line: '4 m long, 3 m wide, 2 m high: how many cubic metres', gen: { mix: [M('box', 1, 2), M('part', 2)] } },
    { id: 'tenths', title: 'Weights in tenths', line: '2.4 tonnes in one vein and 1.8 in another; 2.3 tonnes with 0.8 taken', gen: { mix: [M('weigh', 1, 2), M('box', 1)] } },
    { id: 'fill', title: 'Canisters from the ore', line: '6 tonnes of ore into canisters of 1/2 a tonne', gen: { mix: [M('fill', 1, 2), M('weigh', 1)] } },
    { id: 'weight', title: 'The rock\'s weight from its box', line: '4 by 3 by 2 metres, 3 tonnes to the cubic metre', gen: { mix: [M('box', 2, 2), M('fill', 1)] } },
    { id: 'percent', title: 'The percent that is ore', line: '25% of the 12 tonnes is ore', gen: { mix: [M('percent', 1, 2), M('box', 2)] } },
    { id: 'fillParts', title: 'Canisters of 3/4 of a tonne', line: '6 tonnes of ore into canisters of 3/4 of a tonne', gen: { mix: [M('fill', 2, 2), M('percent', 1)] } },
    { id: 'anyPercent', title: 'Any percent', line: '35% of the 20 tonnes is ore', gen: { mix: [M('percent', 2, 2), M('fill', 2)] } },
    { id: 'ball', title: 'A rock that is a ball', line: 'About 6 m across: half its box, 3 tonnes to the cubic metre', gen: { mix: [M('box', 3, 2), M('percent', 2)] } },
    { id: 'credits', title: 'What the ore is worth', line: '2.8 tonnes of ore at 3,000 credits a tonne', gen: { mix: [M('pay', 1, 2), M('box', 3)] } },
    { id: 'myShare', title: 'Your share of the rock', line: '40 tonnes, 30% ore, 3,000 credits a tonne, 20% yours', gen: { mix: [M('worth', 1, 2), M('pay', 1)] } },
  ],
};

export const JOB = {
  // (not one of the station's job spots, src/jobs/index.js JOBS: its place is the Miner's drill on a captain's run,
  // src/drillview.js. Its levels are on the crew screen's list with the others': src/ui/title.js)
  id: 'drill', name: 'Rock scan', short: 'Drill', open: true, seated: true,
  spot: null, sign: 'The Miner\'s drill', hint: 'Work out the scan',
  place: PLACE, setting: SETTING, makers: MAKERS,
  card: 'payslip',
};
