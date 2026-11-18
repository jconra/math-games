// THE DRILL OPERATOR'S QUESTION: asked when a rock is in the claw, for a crew member who signs on as a captain's drill
// operator (src/missions.js; the game is src/drill.js and src/drillview.js). The game's maker (2026-11-17): "It asks a
// math question about the ore fraction or estimated weight as it scans it", and "We can do the math question when it
// comes time to harvest"; all of it about the work in hand ("it will be fun to see how math can be actually applied").
// And (2026-11-18): "You answer questions, if you get it wrong it just teaches you."
//
// EVERY CARD IS ABOUT THIS ROCK'S OWN NUMBERS (src/drill.js makeRock): the veins the scan shows in it and the lumps in
// each, the holes it stands, the box that just holds it, what a cubic metre of it weighs, its weight, the part of it
// that is ore, the tonnes of each metal in it, and what those sell for on the one price list. They are the numbers
// the full scan reads out at the field and the store counts as the holes are drilled, so nothing on a card is untrue.
// The answer changes nothing in the game: a wrong one teaches (the line why, Help one click away), and that is all.
// One ladder like every job's, kids to grown-ups, easiest first:
//   the veins the scan shows, counted; veins of one metal and of another, the holes left; the canisters still to
//   fill; veins of the same number of lumps; the ore and the plain rock, in tonnes; one tonne of ore in every few of
//   rock; the part of the rock that is ore (1/4 of 12 tonnes), the plain rock's several parts; the box round the rock
//   (cubic metres); two veins' tonnes in tenths; what part of the rock is ore; the rock's weight from its box; a
//   percent of the rock; what percent is ore; the plain rock's percent; the weight from the rock's own size; what the
//   ore is worth; and at the top the drill operator's own share of the rock.
// Tonnes, cubic metres and credits; decimals stay decimals and fractions stay fractions.
//
// THE ROCK IN THE CLAW (`live`, from src/drillview.js: { rock (src/drill.js's own), cans: { full, of } }). From the
// levels page, and in node, there is no rock in the claw: the maker makes one by the game's own rules, so its numbers
// are a real rock's all the same.
import { ownOrder } from './engine.js';
import { CARRIES, priceOf } from './smelter.js';
import { ORE, makeRock } from '../drill.js';

const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
const say = (n) => Number(n).toLocaleString('en-US');
const TONNE = ['tonne', 'tonnes'], CAN = ['canister', 'canisters'], VEIN = ['vein', 'veins'], LUMP = ['lump', 'lumps'], HOLE = ['hole', 'holes'], M3 = ['cubic metre', 'cubic metres'], CREDIT = ['credit', 'credits'];
const C = (n, unit) => ({ v: n, big: say(n), small: n === 1 ? unit[0] : unit[1], label: `${say(n)} ${n === 1 ? unit[0] : unit[1]}` });
// tenths of a tonne on a button: 12 -> "1.2 tonnes", 20 -> "2 tonnes"
const t1 = (tenths) => (tenths % 10 ? (tenths / 10).toFixed(1) : String(tenths / 10));
const D = (tenths) => ({ v: tenths, big: t1(tenths), small: tenths === 10 ? 'tonne' : 'tonnes', label: `${t1(tenths)} ${tenths === 10 ? 'tonne' : 'tonnes'}` });
const F = (n, d) => ({ v: `${n}/${d}`, big: `${n}/${d}`, small: 'of the rock', label: `${n}/${d} of the rock` });
const PC = (p) => ({ v: p, big: `${p}%`, small: 'of the rock', label: `${p} percent of the rock` });
const kit = (rand) => ({ int: (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)), pick: (a) => a[Math.floor(rand() * a.length)], chance: (p) => rand() < p });
const cap = (w) => w[0].toUpperCase() + w.slice(1);
const list = (w) => (w.length <= 1 ? w.join('') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`);
export const SHARE = 20;   // the drill operator's share of what the haul sells for, percent (src/missions.js ROLES.drill)

// who is aboard (Mathwood's FOLK shape): the Miner's crew
const FOLK = [{ name: 'Miner Kestrel', she: true }, { name: 'Captain Ruiz', she: false }, { name: 'Pilot Juno', she: true }, { name: 'Engineer Okafor', she: false }];
export const SETTING = { folk: FOLK };

// the rock a card is about: the one in the claw, or (the levels page, node) one made by the game's own rules
const rockOf = (live, rand) => (live && live.rock && live.rock.veins ? live.rock : makeRock(rand));
const glowOf = (m) => (ORE[m] || ORE.copper).glow;
const metalsOf = (rock) => Object.entries(rock.metals).map(([m, t]) => ({ m, t, price: priceOf(m) }));
// "iron", "iron and gold"
const oreWords = (rock) => list(Object.keys(rock.metals));
// the scan's picture of the rock's veins, each in its metal's colour: [[glow, how many], ...]
const veinKinds = (rock) => { const out = []; for (const V of rock.veins) { const g = glowOf(V.metal), last = out[out.length - 1]; if (last && last[0] === g) last[1]++; else out.push([g, 1]); } return out; };
const PART_WORD = { 2: 'half', 4: 'a quarter', 5: 'a fifth', 10: 'a tenth' };
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export const MAKERS = {
  // ── counting what the scan shows (the youngest): the things are drawn on the card, and counting them is the skill ──
  // step 1  up to 5: the veins of ore the scan shows in this rock
  // step 2  up to 10: its veins of one metal and of another, in all; the holes it has left
  // step 3  the canisters still to fill, of the Miner's 8
  veins: {
    strand: 'number', at: (step) => [0, 6, 10][Math.max(1, Math.min(3, step)) - 1],
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), rock = rockOf(live, rand), kinds = veinKinds(rock), n = rock.veins.length;
      if (step <= 1) {
        return ownOrder({
          key: 'veins:count', story: `The scan shows the ore inside this rock: ${oreWords(rock)}.`, ask: 'How many veins of ore does the scan show?', right: C(n, VEIN),
          slips: [
            { ...C(n + 1, VEIN), slip: 'off', why: 'One too many. Count again, touching each one once.' },
            { ...C(n - 1, VEIN), slip: 'off', why: 'One short. Count again, touching each one once.' },
            { ...C(n + 2, VEIN), slip: 'off', why: 'Too many. Count again, touching each one once.' },
          ],
          rightWhy: `${u(n, VEIN)} of ore`,
          picFirst: true, help: { title: 'Count them', pic: { kind: 'scan', kinds }, line: 'Touch each glowing vein once as you count: 1, 2, 3 ...' },
          own: { strand: 'number', at: 0 }, facts: { kind: 'veins', n },
        }, rand, 3);
      }
      if (step === 2) {
        const names = Object.keys(rock.metals);
        if (names.length >= 2 && t.chance(0.6)) {
          const first = names[0], a = rock.veins.filter((V) => V.metal === first).length, b = n - a, other = names.length === 2 ? names[1] : 'other metals';
          return ownOrder({
            key: 'veins:both', story: `The scan shows ${u(a, VEIN)} of ${first} in this rock and ${u(b, VEIN)} of ${other}.`, ask: 'How many veins is that in all?', right: C(n, VEIN),
            slips: [
              { ...C(a, VEIN), slip: 'part', why: `${a} is only the ${first}. Count the ${names.length === 2 ? other : 'others'} too.` },
              ...(b !== a ? [{ ...C(b, VEIN), slip: 'part', why: `${b} is only the ${names.length === 2 ? other : 'others'}. Count the ${first} too.` }] : []),
              { ...C(n + 1, VEIN), slip: 'off', why: 'One too many. Count them all again, touching each one once.' },
              { ...C(n - 1, VEIN), slip: 'off', why: 'One short. Count them all again, touching each one once.' },
            ],
            rightWhy: `${a} and ${b} more make ${u(n, VEIN)}`, sum: { op: 'add', a, b },
            picFirst: true, help: { title: 'Count them all', pic: { kind: 'scan', kinds }, line: 'Count the veins of one colour, then keep counting the others.' },
            own: { strand: 'number', at: 6 }, credit: [{ strand: 'add', at: 5, weight: 0.5 }], facts: { kind: 'both', a, b, n },
          }, rand, 3);
        }
        const all = rock.holes, used = t.int(1, all - 1), left = all - used;
        return ownOrder({
          // (a rock just taken in the claw has no holes yet: asked as what will be)
          key: 'veins:holes', story: `This rock stands ${all} holes before it crumbles.`, ask: `After ${u(used, HOLE)}, how many will be left?`, right: C(left, HOLE),
          slips: [
            ...(used !== left ? [{ ...C(used, HOLE), slip: 'gone', why: `${used} is how many are drilled. Count the rings still open.` }] : []),
            { ...C(all, HOLE), slip: 'all', why: `${all} is all the holes the rock stands. ${used} of them will be drilled.` },
            { ...C(left + 1, HOLE), slip: 'off', why: 'One too many. Count the open rings again.' },
            { ...C(left - 1, HOLE), slip: 'off', why: 'One short. Count the open rings again.' },
          ],
          rightWhy: `${all} take away ${used} leaves ${u(left, HOLE)}`, sum: { op: 'sub', a: all, b: used },
          picFirst: true, help: { title: 'Count the open rings', pic: { kind: 'holes', all, used, glow: glowOf(names[0]) }, line: 'A crossed ring is a hole drilled. Count the rings still open.' },
          own: { strand: 'number', at: 6 }, credit: [{ strand: 'sub', at: 5, weight: 0.5 }], facts: { kind: 'holes', all, used, n: left },
        }, rand, 3);
      }
      const now = live && live.cans && Number.isInteger(live.cans.full) && live.cans.full >= 1 && live.cans.full < CARRIES ? live.cans.full : null;
      const full = now != null ? now : t.int(1, CARRIES - 1), left = CARRIES - full;
      return ownOrder({
        // (the canisters as they are, where some are full and some are not; else asked as what will be)
        key: 'veins:cans', story: now != null ? `The Miner carries ${CARRIES} canisters. ${full} of them ${full === 1 ? 'is' : 'are'} full.` : `The Miner carries ${CARRIES} canisters.`,
        ask: now != null ? 'How many canisters are still to fill?' : `When ${full} of them ${full === 1 ? 'is' : 'are'} full, how many will still be to fill?`, right: C(left, CAN),
        slips: [
          ...(full !== left ? [{ ...C(full, CAN), slip: 'gone', why: `${full} is how many are full. Count the dark ones: they are still empty.` }] : []),
          { ...C(CARRIES, CAN), slip: 'all', why: `${CARRIES} is all of them. Take away the ${full} full ${full === 1 ? 'one' : 'ones'}.` },
          { ...C(left + 1, CAN), slip: 'off', why: 'One too many. Count the dark ones again.' },
          { ...C(left - 1, CAN), slip: 'off', why: 'One short. Count the dark ones again.' },
        ],
        rightWhy: `${CARRIES} take away ${full} leaves ${u(left, CAN)}`, sum: { op: 'sub', a: CARRIES, b: full },
        picFirst: true, help: { title: 'Count the empty ones', pic: { kind: 'cans', place: 'row', slots: [...Array(full).fill('full'), ...Array(left).fill('empty')] }, line: 'A full canister has its window lit. Count the dark ones: they are still to fill.' },
        own: { strand: 'number', at: 10 }, credit: [{ strand: 'sub', at: 5, weight: 0.5 }], facts: { kind: 'cans', full, n: left, live: now != null },
      }, rand, 3);
    },
  },

  // ── veins of the same: this rock's veins, each with the same number of lumps ──
  lumps: {
    strand: 'words', at: () => 16,
    make(step, { rand = Math.random, live = null } = {}) {
      const rock = rockOf(live, rand), g = rock.veins.length, e = rock.each, ans = g * e;
      return ownOrder({
        key: 'lumps:veins', story: `The scan shows ${g} veins in this rock, with ${e} lumps of ore in each vein.`, ask: 'How many lumps of ore is that in all?', right: C(ans, LUMP),
        slips: [
          { ...C(g + e, LUMP), slip: 'added', why: 'That adds the veins and the lumps. Count every lump in every vein.' },
          { ...C(e, LUMP), slip: 'one', why: `${e} is one vein. There are ${g} veins.` },
          { ...C(ans + e, LUMP), slip: 'groupOff', why: `That's ${g + 1} veins. Count the veins again: ${g}.` },
          { ...C(ans - 1, LUMP), slip: 'off', why: 'One short. Count every lump in every vein.' },
        ],
        rightWhy: `${g} veins of ${e}: ${Array(g).fill(e).join(' + ')} = ${u(ans, LUMP)}`,
        picFirst: true, help: { title: 'Count them', pic: { kind: 'scan', rows: rock.veins.map((V) => glowOf(V.metal)), each: e }, line: `Count every lump in every vein: ${g} veins, ${e} in each.` },
        own: { strand: 'words', at: 16 }, credit: [{ strand: 'mul', at: 14, weight: 0.5 }], facts: { g, e, ans },
      }, rand, 3);
    },
  },

  // ── the ore and the plain rock, in whole tonnes ──
  plain: {
    strand: 'words', at: () => 20,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), rock = rockOf(live, rand), W = rock.weight, T = rock.ore0, P = W - T, ms = metalsOf(rock);
      const form = t.pick(ms.length >= 2 ? ['plain', 'whole', 'metals'] : ['plain', 'whole']);
      if (form === 'metals') {
        const words = ms.map((x) => `${u(x.t, TONNE)} of ${x.m}`);
        return ownOrder({
          key: 'plain:metals', story: `The scan finds ${list(words)} in this rock.`, ask: 'How many tonnes of ore is that in all?', right: C(T, TONNE),
          slips: [
            { ...C(ms[0].t, TONNE), slip: 'part', why: `${u(ms[0].t, TONNE)} is only the ${ms[0].m}. Add the ${ms.length === 2 ? ms[1].m : 'others'} too.` },
            { ...C(T + 1, TONNE), slip: 'off', why: 'One too many. Add them again.' },
            { ...C(T - 1, TONNE), slip: 'off', why: 'One short. Add them again.' },
            { ...C(T + 2, TONNE), slip: 'off', why: 'Too many. Add them again.' },
          ],
          rightWhy: `${ms.map((x) => x.t).join(' + ')} = ${u(T, TONNE)}`, sum: ms.length === 2 ? { op: 'add', a: ms[0].t, b: ms[1].t } : [{ op: 'add', a: ms[0].t, b: ms[1].t, say: 'First two of them' }, { op: 'add', a: ms[0].t + ms[1].t, b: ms[2].t, say: 'Then the third' }],
          help: { title: 'All the ore together', pic: { kind: 'boxes', boxes: ms.map((x) => ({ top: x.m, mid: u(x.t, TONNE), glow: glowOf(x.m) })), op: '+', ask: 'all the ore = ? tonnes' }, line: 'Every metal in the rock is ore. Add their tonnes.', steps: [ms.map((x) => x.t).join(' + ')] },
          own: { strand: 'words', at: 20 }, credit: [{ strand: 'add', at: 12, weight: 0.5 }], facts: { form, T },
        }, rand);
      }
      if (form === 'whole') {
        return ownOrder({
          key: 'plain:whole', story: `The scan finds ${u(T, TONNE)} of ore in this rock and ${u(P, TONNE)} of plain rock.`, ask: 'How many tonnes does the rock weigh?', right: C(W, TONNE),
          slips: [
            ...(P - T > 0 && P - T !== W ? [{ ...C(P - T, TONNE), slip: 'subtracted', why: 'That takes the ore from the plain rock. The rock is both of them together: add.' }] : []),
            { ...C(P, TONNE), slip: 'part', why: `${u(P, TONNE)} is only the plain rock. The ore weighs something too.` },
            { ...C(W + 1, TONNE), slip: 'off', why: `${T} and ${P} more do not make ${W + 1}.` },
            { ...C(W - 1, TONNE), slip: 'off', why: `${T} and ${P} more do not make ${W - 1}.` },
            { ...C(W + 10, TONNE), slip: 'off', why: `${T} and ${P} more do not make ${W + 10}.` },
          ],
          rightWhy: `${T} + ${P} = ${u(W, TONNE)}`, sum: { op: 'add', a: P, b: T },
          help: { title: 'The ore and the rest', pic: { kind: 'boxes', boxes: [{ top: 'ore', mid: u(T, TONNE) }, { top: 'plain rock', mid: u(P, TONNE) }], op: '+', ask: 'the whole rock = ? tonnes' }, line: 'The rock is its ore and its plain rock together.', steps: [`${T} + ${P}`] },
          own: { strand: 'words', at: 20 }, credit: [{ strand: 'add', at: 14, weight: 0.5 }], facts: { form, W, T, P },
        }, rand);
      }
      return ownOrder({
        key: 'plain:rest', story: `The scan says this rock weighs ${u(W, TONNE)}. ${cap(u(T, TONNE))} of it is ore.`, ask: 'How many tonnes of it is plain rock?', right: C(P, TONNE),
        slips: [
          { ...C(W + T, TONNE), slip: 'added', why: 'That adds the ore on. The ore is a part of the rock: take it away to find the rest.' },
          ...(T !== P ? [{ ...C(T, TONNE), slip: 'part', why: `${u(T, TONNE)} is the ore. The question is the rest of the rock.` }] : []),
          { ...C(P + 1, TONNE), slip: 'off', why: `${W} take away ${T} is not ${P + 1}.` },
          { ...C(P - 1, TONNE), slip: 'off', why: `${W} take away ${T} is not ${P - 1}.` },
        ],
        rightWhy: `${W} − ${T} = ${u(P, TONNE)}`, sum: { op: 'sub', a: W, b: T },
        help: { title: 'The rock without its ore', pic: { kind: 'boxes', boxes: [{ top: 'the whole rock', mid: u(W, TONNE) }, { top: 'ore', mid: u(T, TONNE) }], op: '−', ask: 'plain rock = ? tonnes' }, line: 'Take the ore away from the whole rock. What is left is plain rock.', steps: [`${W} − ${T}`] },
        own: { strand: 'words', at: 20 }, credit: [{ strand: 'sub', at: 14, weight: 0.5 }], facts: { form, W, T, P },
      }, rand);
    },
  },

  // ── one tonne of ore in every few tonnes of rock: the rock's weight shared out ──
  per: {
    strand: 'div', at: () => 26,
    make(step, { rand = Math.random, live = null } = {}) {
      const rock = rockOf(live, rand), W = rock.weight, d = rock.part, T = rock.ore0;
      return ownOrder({
        key: 'per:every', story: `The scan says this rock weighs ${u(W, TONNE)}. One tonne in every ${d} tonnes of it is ore.`, ask: 'How many tonnes of ore are in the rock?', right: C(T, TONNE),
        slips: [
          { ...C(W - d, TONNE), slip: 'subtracted', why: `${W} − ${d} takes ${d} away once. Count how many lots of ${d} tonnes are in the ${W}: each has one tonne of ore.` },
          ...(d !== T ? [{ ...C(d, TONNE), slip: 'bottom', why: `${d} is how many tonnes of rock hold one tonne of ore. How many lots of ${d} are in ${W}?` }] : []),
          { ...C(W - T, TONNE), slip: 'rest', why: `${u(W - T, TONNE)} is the plain rock, the rest of it.` },
          { ...C(T + 1, TONNE), slip: 'off', why: `${T + 1} lots of ${d} tonnes would make ${(T + 1) * d} tonnes, more than the rock weighs.` },
          ...(T > 1 ? [{ ...C(T - 1, TONNE), slip: 'off', why: `${T - 1} ${T - 1 === 1 ? 'lot' : 'lots'} of ${d} tonnes ${T - 1 === 1 ? 'makes' : 'make'} only ${(T - 1) * d} tonnes. The rock weighs ${W}.` }] : []),
        ],
        rightWhy: `${W} ÷ ${d} = ${u(T, TONNE)} of ore`, sum: { op: 'div', a: W, b: d },
        help: { title: 'Lots of the same', pic: { kind: 'partbar', top: `the rock: ${W} tonnes`, d, n: 1, each: `${d} t`, line: `every ${d} tonnes of rock hold 1 tonne of ore`, ask: `${W} ÷ ${d} = ? tonnes of ore` }, line: `Cut the rock's ${W} tonnes into lots of ${d} tonnes. Each lot holds one tonne of ore.`, steps: [`How many lots of ${d} in ${W}: ${W} ÷ ${d}`] },
        own: { strand: 'div', at: 26 }, credit: [{ strand: 'words', at: 26, weight: 0.5 }], facts: { W, d, T },
      }, rand);
    },
  },

  // ── the part of the rock that is ore ──
  // step 1  one part: 1/4 of the 12 tonnes is ore
  // step 2  several parts: 3/4 of the 12 tonnes is plain rock; or 2/3 of its ore is iron
  // step 3  which part: 3 tonnes of the 12 are ore: what part of the rock is that
  part: {
    strand: 'frac', at: (step) => [28, 40, 52][Math.max(1, Math.min(3, step)) - 1],
    make(step, { rand = Math.random, live = null } = {}) {
      const rock = rockOf(live, rand), W = rock.weight, d = rock.part, T = rock.ore0, P = W - T;
      if (step >= 3) {
        const cand = [[1, d + 1, 'off', `1/${d + 1} of ${W} tonnes would be less than the ${u(T, TONNE)} of ore there ${T === 1 ? 'is' : 'are'}.`],
          ...(d > 2 ? [[1, d - 1, 'overRest', `That sets the ore against the plain rock (${T} against ${P}). Set it against the whole rock: ${T} of the ${W} tonnes.`], [d - 1, d, 'rest', `${d - 1}/${d} is the plain rock's part. The ore is the other part.`]] : []),
          ...(W !== d && W !== d + 1 ? [[1, W, 'oneTonne', `1/${W} would be one tonne of the ${W}. There ${T === 1 ? 'is' : 'are'} ${u(T, TONNE)} of ore.`]] : []),
          [1, d + 2, 'off', `1/${d + 2} of ${W} tonnes is not ${u(T, TONNE)}.`], [1, d * 2, 'half', `1/${d * 2} would be half as much ore as there is.`]];
        return ownOrder({
          key: 'part:which', story: `The scan says this rock weighs ${u(W, TONNE)}, and ${u(T, TONNE)} of it ${T === 1 ? 'is' : 'are'} ore.`, ask: 'What part of the rock is ore?', right: F(1, d),
          slips: cand.map(([n, k, slip, why]) => ({ ...F(n, k), slip, why })),
          rightWhy: T === 1 ? `1 tonne of ${W} is 1/${W} of the rock` : `${T} of ${W}: ${W} ÷ ${T} = ${d}, so the ore is 1/${d} of the rock`, sum: { op: 'div', a: W, b: T },
          help: { title: 'How many times it fits', pic: { kind: 'partbar', top: `the rock: ${W} tonnes`, d, n: 1, each: `${T} t`, line: `the ore is ${u(T, TONNE)}: how many lots of ${T} make ${W}?`, ask: 'the ore is 1/? of the rock' }, line: `See how many lots of ${u(T, TONNE)} make the whole ${W} tonnes. The ore is one of that many equal parts.`, steps: [`${W} ÷ ${T}`, 'The ore is 1 of that many parts'] },
          own: { strand: 'frac', at: 52 }, credit: [{ strand: 'div', at: 29, weight: 0.5 }], facts: { W, T, d, form: 'which' },
        }, rand);
      }
      if (step === 2) {
        // (several parts: the plain rock's, where it is more than one part; else a metal's share of the ore; else, a
        // rock that is half ore, its one part)
        const ms = metalsOf(rock), mine = ms.map((x) => ({ ...x, g: gcd(x.t, T) })).find((x) => x.t / x.g > 1 && x.t < T);
        if (d > 2) {
          const n = d - 1;
          return ownOrder({
            key: 'part:plain', story: `The scan says this rock weighs ${u(W, TONNE)}, and ${n}/${d} of it is plain rock with no ore in it.`, ask: 'How many tonnes of plain rock is that?', right: C(P, TONNE),
            slips: [
              { ...C(T, TONNE), slip: 'onePart', why: `${u(T, TONNE)} is one part, 1/${d}. ${n}/${d} is ${n} of those parts.` },
              { ...C(W - n, TONNE), slip: 'subtracted', why: `${W} − ${n} takes ${n} away. Cut the ${W} tonnes into ${d} equal parts, then take ${n} of them.` },
              { ...C(P + T, TONNE), slip: 'partOff', why: `That is all ${d} parts: the whole rock.` },
              ...(P - T > 0 && P - T !== T ? [{ ...C(P - T, TONNE), slip: 'partOff', why: `That is ${n - 1} ${n - 1 === 1 ? 'part' : 'parts'}. ${n}/${d} is ${n} of the ${d} parts.` }] : []),
              { ...C(P + 1, TONNE), slip: 'off', why: `Cut the ${W} tonnes into ${d} equal parts, then take ${n} of them.` },
            ],
            rightWhy: `One part is ${W} ÷ ${d} = ${T}; ${n} parts are ${n} × ${T} = ${u(P, TONNE)}`,
            sum: [{ op: 'div', a: W, b: d, say: `First one of the ${d} equal parts` }, { op: 'mul', a: T, b: n, say: `Then ${n} of those parts` }],
            help: { title: 'Cut into equal parts', pic: { kind: 'partbar', top: `the rock: ${W} tonnes`, d, n, each: '?', line: `${d} equal parts: each is ${W} ÷ ${d}`, ask: `${n}/${d} = the ${n} marked parts: ? tonnes` }, line: `${n}/${d} means the rock cut into ${d} equal parts, and ${n} of them taken. Work out one part first.`, steps: [`First one of the ${d} equal parts: ${W} ÷ ${d}`, `Then ${n} of those parts: that × ${n}`] },
            own: { strand: 'frac', at: 40 }, credit: [{ strand: 'div', at: 29, weight: 0.5 }], facts: { W, n, d, ans: P, form: 'plain' }, size: 2,
          }, rand);
        }
        if (mine) {
          const n = mine.t / mine.g, k = T / mine.g, one = mine.g;
          return ownOrder({
            key: 'part:metal', story: `The scan finds ${u(T, TONNE)} of ore in this rock, and ${n}/${k} of the ore is ${mine.m}.`, ask: `How many tonnes of ${mine.m} is that?`, right: C(mine.t, TONNE),
            slips: [
              ...(one !== mine.t ? [{ ...C(one, TONNE), slip: 'onePart', why: `${u(one, TONNE)} is one part, 1/${k}. ${n}/${k} is ${n} of those parts.` }] : []),
              { ...C(T - mine.t, TONNE), slip: 'rest', why: `${u(T - mine.t, TONNE)} is the rest of the ore, the other ${k - n}/${k}.` },
              { ...C(T, TONNE), slip: 'whole', why: `${u(T, TONNE)} is all the ore. Only ${n}/${k} of it is ${mine.m}.` },
              { ...C(mine.t + 1, TONNE), slip: 'off', why: `Cut the ${T} tonnes into ${k} equal parts, then take ${n} of them.` },
              { ...C(T + n, TONNE), slip: 'added', why: `That adds ${n} on. Cut the ${T} tonnes into ${k} equal parts, then take ${n} of them.` },
            ],
            rightWhy: `One part is ${T} ÷ ${k} = ${one}; ${n} parts are ${n} × ${one} = ${u(mine.t, TONNE)}`,
            sum: [{ op: 'div', a: T, b: k, say: `First one of the ${k} equal parts` }, { op: 'mul', a: one, b: n, say: `Then ${n} of those parts` }],
            help: { title: 'Cut into equal parts', pic: { kind: 'partbar', top: `the ore: ${T} tonnes`, d: k, n, each: '?', line: `${k} equal parts: each is ${T} ÷ ${k}`, ask: `${n}/${k} = the ${n} marked parts: ? tonnes` }, line: `${n}/${k} means the ore cut into ${k} equal parts, and ${n} of them taken. Work out one part first.`, steps: [`First one of the ${k} equal parts: ${T} ÷ ${k}`, `Then ${n} of those parts: that × ${n}`] },
            own: { strand: 'frac', at: 40 }, credit: [{ strand: 'div', at: 29, weight: 0.5 }], facts: { T, n, d: k, ans: mine.t, form: 'metal' }, size: 2,
          }, rand);
        }
      }
      return ownOrder({
        key: 'part:one', story: `The scan says this rock weighs ${u(W, TONNE)}, and 1/${d} of it is ore.`, ask: 'How many tonnes of ore is that?', right: C(T, TONNE),
        slips: [
          ...(P !== T ? [{ ...C(P, TONNE), slip: 'rest', why: `${u(P, TONNE)} is the rest of the rock: the other ${d - 1} ${d - 1 === 1 ? 'part' : 'parts'}.` }] : []),
          ...(d !== T ? [{ ...C(d, TONNE), slip: 'bottom', why: `${d} is how many equal parts the rock is cut into. One part is ${W} ÷ ${d}.` }] : []),
          ...(W - d > 0 && W - d !== T ? [{ ...C(W - d, TONNE), slip: 'subtracted', why: `${W} − ${d} takes ${d} away. Cut the ${W} tonnes into ${d} equal parts instead.` }] : []),
          { ...C(T + 1, TONNE), slip: 'off', why: `${d} parts of ${T + 1} would make ${d * (T + 1)} tonnes, more than the ${W} there are.` },
          ...(T > 1 ? [{ ...C(T - 1, TONNE), slip: 'off', why: `${d} parts of ${T - 1} make only ${d * (T - 1)} tonnes. There are ${W}.` }] : [{ ...C(T + 2, TONNE), slip: 'off', why: `${d} parts of ${T + 2} would make ${d * (T + 2)} tonnes, more than the ${W} there are.` }]),
        ],
        rightWhy: `1/${d} of ${W} is ${W} ÷ ${d} = ${u(T, TONNE)}`, sum: { op: 'div', a: W, b: d },
        help: { title: 'Cut into equal parts', pic: { kind: 'partbar', top: `the rock: ${W} tonnes`, d, n: 1, each: '?', line: `${d} equal parts: each is ${W} ÷ ${d}`, ask: `1/${d} = the marked part: ? tonnes` }, line: `1/${d} means the rock cut into ${d} equal parts, and one of them taken: ${W} ÷ ${d}.`, steps: [`One of the ${d} equal parts: ${W} ÷ ${d}`] },
        own: { strand: 'frac', at: 28 }, credit: [{ strand: 'div', at: 29, weight: 0.5 }], facts: { W, n: 1, d, ans: T, form: 'one' },
      }, rand);
    },
  },

  // ── the rock's estimated weight, from the box that just holds it ──
  // step 1  the box: 3 m long, 2 m wide, 2 m high: how many cubic metres
  // step 2  its weight from the box's cubic metres: the rock fills about half its box, so many tonnes to the cubic metre
  // step 3  its weight from its own size: the box, half of it, then the weight
  box: {
    strand: 'geo', at: (step) => [46, 54, 64][Math.max(1, Math.min(3, step)) - 1],
    make(step, { rand = Math.random, live = null } = {}) {
      const rock = rockOf(live, rand), [l, w, h] = rock.box, V = rock.vol, per = rock.per, half = V / 2, W = rock.weight, floor = l * w;
      const size = `about ${u(l, ['metre', 'metres'])} long, ${u(w, ['metre', 'metres'])} wide and ${u(h, ['metre', 'metres'])} high`;
      if (step <= 1) {
        return ownOrder({
          key: 'box:volume', story: `The scan measures this rock by the box that just holds it: ${size}.`, ask: 'How many cubic metres is the box?', right: C(V, M3),
          slips: [
            { ...C(l + w + h, M3), slip: 'added', why: 'That adds the three sides. The space in a box is long × wide × high.' },
            { ...C(floor, M3), slip: 'twoOnly', why: `${l} × ${w} is only the bottom layer of the box. It is ${u(h, ['layer', 'layers'])} high.` },
            { ...C(V + floor, M3), slip: 'layerOff', why: `That is ${u(h + 1, ['layer', 'layers'])}. The box is ${u(h, ['metre', 'metres'])} high.` },
            { ...C(V * 2, M3), slip: 'doubled', why: `That is twice the box. ${l} × ${w} × ${h} is ${V}.` },
            { ...C(V + 1, M3), slip: 'off', why: `${l} × ${w} = ${floor} in each layer, and ${u(h, ['layer', 'layers'])}.` },
          ],
          rightWhy: `${l} × ${w} = ${floor} in each layer; ${u(h, ['layer', 'layers'])}: ${floor} × ${h} = ${u(V, M3)}`,
          sum: [{ op: 'mul', a: l, b: w, say: 'First the bottom layer of the box' }, { op: 'mul', a: floor, b: h, say: `Then ${u(h, ['layer', 'layers'])} high` }],
          help: { title: 'Layer by layer', pic: { kind: 'rockbox', l, w, h, shape: rock.shape }, line: `The bottom layer is ${l} long and ${w} wide. The box is ${h === 1 ? 'one of those layers' : `${h} of those layers`} high.`, steps: [`First the bottom layer: ${l} × ${w}`, `Then ${u(h, ['layer', 'layers'])}: that × ${h}`] },
          own: { strand: 'geo', at: 46 }, credit: [{ strand: 'mul', at: 30, weight: 0.5 }], facts: { l, w, h, ans: V }, size: 2,
        }, rand);
      }
      if (step === 2) {
        return ownOrder({
          key: 'box:weight', story: `The box that just holds this rock is ${u(V, M3)}. A lumpy rock fills about half of its box, and a cubic metre of this rock weighs ${u(per, TONNE)}.`, ask: 'About how many tonnes does the rock weigh?', right: C(W, TONNE),
          slips: [
            { ...C(V * per, TONNE), slip: 'wholeBox', why: `That weighs the whole box, ${u(V, M3)}. The rock fills about half of it.` },
            ...(half !== W ? [{ ...C(half, TONNE), slip: 'noWeight', why: `${half} is the rock's cubic metres. Each one weighs ${u(per, TONNE)}.` }] : []),
            { ...C(half + per, TONNE), slip: 'added', why: `That adds the ${per}. Every cubic metre weighs ${u(per, TONNE)}: ${half} lots of ${per}.` },
            { ...C(W + per, TONNE), slip: 'off', why: `That is a cubic metre too many. Half the box is ${half}.` },
            ...(W - per > 0 ? [{ ...C(W - per, TONNE), slip: 'off', why: `That is a cubic metre short. Half the box is ${half}.` }] : []),
          ],
          rightWhy: `Half of ${V} is ${half} cubic metres; × ${per} = ${u(W, TONNE)}`,
          sum: [{ op: 'div', a: V, b: 2, say: 'First the rock: about half its box' }, { op: 'mul', a: half, b: per, say: `Then its weight: ${u(per, TONNE)} for each cubic metre` }],
          help: { title: 'Half the box, then its weight', pic: { kind: 'rockbox', l, w, h, vol: V, per, shape: rock.shape }, line: `The rock fills about half of its box. Each cubic metre of it weighs ${u(per, TONNE)}.`, steps: [`First half the box: ${V} ÷ 2`, `Then the weight: that × ${per}`] },
          own: { strand: 'geo', at: 54 }, credit: [{ strand: 'mul', at: 43, weight: 0.5 }], facts: { V, per, ans: W }, size: 2,
        }, rand);
      }
      return ownOrder({
        key: 'box:size', story: `The scan measures this rock by the box that just holds it: ${size}. A lumpy rock fills about half of its box, and a cubic metre of this rock weighs ${u(per, TONNE)}.`, ask: 'About how many tonnes does the rock weigh?', right: C(W, TONNE),
        slips: [
          { ...C(V * per, TONNE), slip: 'wholeBox', why: `That weighs the whole box, ${u(V, M3)}. The rock fills about half of it.` },
          ...(half !== W ? [{ ...C(half, TONNE), slip: 'noWeight', why: `${half} is the rock's cubic metres. Each one weighs ${u(per, TONNE)}.` }] : []),
          { ...C((l + w + h) * per, TONNE), slip: 'added', why: 'That adds the three sides. The space in a box is long × wide × high.' },
          { ...C(floor * per, TONNE), slip: 'twoOnly', why: `${l} × ${w} is only the bottom layer of the box. Work out the whole box, then half of it.` },
          { ...C(W + per, TONNE), slip: 'off', why: 'Work out the box first, then half of it, then the weight.' },
        ],
        rightWhy: `The box is ${l} × ${w} × ${h} = ${V} cubic metres; half of it is ${half}; × ${per} = ${u(W, TONNE)}`,
        sum: [{ op: 'mul', a: l, b: w, say: 'First the bottom layer of the box' }, { op: 'mul', a: floor, b: h, say: 'Then the whole box, in cubic metres' }, { op: 'div', a: V, b: 2, say: 'Then the rock: about half its box' }, { op: 'mul', a: half, b: per, say: `Then its weight: ${u(per, TONNE)} for each cubic metre` }],
        help: { title: 'The box, half of it, its weight', pic: { kind: 'rockbox', l, w, h, per, shape: rock.shape }, line: 'Work out the box that just holds the rock, take half of it, then weigh it: so many tonnes for each cubic metre.', steps: [`First the box: ${l} × ${w} × ${h}`, 'Then the rock: half of that', `Then the weight: that × ${per}`] },
        own: { strand: 'geo', at: 64 }, credit: [{ strand: 'mul', at: 43, weight: 0.5 }], facts: { l, w, h, per, V, ans: W }, size: 3,
      }, rand);
    },
  },

  // ── two veins of the same metal, their tonnes in tenths: together, and how much more in one ──
  tenths: {
    strand: 'dec', at: () => 50,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), rock = rockOf(live, rand), m = Object.keys(rock.metals)[0], two = rock.veins.filter((V) => V.metal === m);
      const a = Math.round(two[0].tonnes * 10), b = Math.round(two[1].tonnes * 10), s = a + b, diff = a - b;
      if (t.chance(0.5)) {
        const parts = (a % 10) + (b % 10), wholes = Math.floor(a / 10) + Math.floor(b / 10);
        return ownOrder({
          key: 'tenths:add', story: `The scan reads ${t1(a)} tonnes of ${m} in one vein of this rock and ${t1(b)} ${b === 10 ? 'tonne' : 'tonnes'} in another.`, ask: `How many tonnes of ${m} is that together?`, right: D(s),
          slips: [
            ...(parts >= 10 ? [{ v: `w${wholes}.${parts}`, big: `${wholes}.${parts}`, small: 'tonnes', label: `${wholes}.${parts} tonnes`, slip: 'wholeParts', why: `${a % 10} tenths and ${b % 10} tenths make ${parts} tenths, and 10 tenths are another whole tonne: carry it.` }] : []),
            { ...D(diff), slip: 'subtracted', why: 'That takes one from the other. Both veins count: add them.' },
            { ...D(s + 1), slip: 'off', why: 'One tenth too many. Line the points up and add each column.' },
            { ...D(s - 1), slip: 'off', why: 'One tenth short. Line the points up and add each column.' },
            { ...D(s + 10), slip: 'off', why: 'A whole tonne too many. Line the points up and add each column.' },
          ],
          rightWhy: `${t1(a)} + ${t1(b)} = ${t1(s)} tonnes`, sum: { op: 'add', a: a / 10, b: b / 10 },
          help: { title: 'Tenths and tenths', pic: { kind: 'boxes', boxes: [{ top: 'one vein', mid: `${t1(a)} t`, glow: glowOf(m) }, { top: 'another', mid: `${t1(b)} t`, glow: glowOf(m) }], op: '+', ask: `the ${m} in all = ? tonnes` }, line: 'Line the points up. Add the tenths first: ten tenths make one more whole tonne.', steps: [`${t1(a)} + ${t1(b)}`] },
          own: { strand: 'dec', at: 50 }, facts: { a, b, op: '+', ans: s },
        }, rand);
      }
      const borrow = a % 10 < b % 10, digitwise = Math.abs(Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs((a % 10) - (b % 10));
      return ownOrder({
        key: 'tenths:more', story: `The scan reads ${t1(a)} tonnes of ${m} in one vein of this rock and ${t1(b)} ${b === 10 ? 'tonne' : 'tonnes'} in another.`, ask: 'How many tonnes more is in the bigger vein?', right: D(diff),
        slips: [
          ...(borrow && digitwise !== diff ? [{ ...D(digitwise), slip: 'smallerFromBigger', why: `In the tenths the smaller digit was taken from the bigger. ${a % 10} tenths is less than ${b % 10} tenths: borrow a whole tonne.` }] : []),
          { ...D(s), slip: 'added', why: 'That is the two veins together. How much MORE is in the bigger one: take the smaller away.' },
          { ...D(diff + 1), slip: 'off', why: 'One tenth too many. Line the points up and take away each column.' },
          ...(diff > 1 ? [{ ...D(diff - 1), slip: 'off', why: 'One tenth short. Line the points up and take away each column.' }] : []),
          { ...D(b), slip: 'part', why: `${t1(b)} is the smaller vein. The question is how much more the bigger one holds.` },
          { ...D(diff + 10), slip: 'off', why: 'A whole tonne too many. Line the points up and take away each column.' },
        ],
        rightWhy: `${t1(a)} − ${t1(b)} = ${t1(diff)} ${diff === 10 ? 'tonne' : 'tonnes'}`, sum: { op: 'sub', a: a / 10, b: b / 10 },
        help: { title: 'How much more', pic: { kind: 'boxes', boxes: [{ top: 'the bigger vein', mid: `${t1(a)} t`, glow: glowOf(m) }, { top: 'the smaller', mid: `${t1(b)} t`, glow: glowOf(m) }], op: '−', ask: 'the bigger holds ? tonnes more' }, line: 'Line the points up and take the smaller from the bigger, the tenths first.', steps: [`${t1(a)} − ${t1(b)}`] },
        own: { strand: 'dec', at: 50 }, facts: { a, b, op: '−', ans: diff },
      }, rand);
    },
  },

  // ── the percent of the rock that is ore ──
  // step 1  a percent of it: 25% of the 12 tonnes is ore
  // step 2  which percent: 3 tonnes of the 12 are ore: what percent is that
  // step 3  the plain rock's percent: 75% of the 12 tonnes is plain rock
  percent: {
    strand: 'pct', at: (step) => [58, 60, 62][Math.max(1, Math.min(3, step)) - 1],
    make(step, { rand = Math.random, live = null } = {}) {
      const rock = rockOf(live, rand), W = rock.weight, d = rock.part, T = rock.ore0, P = W - T, p = 100 / d, q = 100 - p, said = PART_WORD[d];
      const bar = (n, ask) => ({ kind: 'partbar', top: `the rock: ${W} tonnes`, d, n, each: `${p}%`, line: `${p}% is one part in ${d}: ${W} ÷ ${d}`, ask });
      if (step <= 1) {
        return ownOrder({
          key: `percent:of:${p}`, story: `The scan says this rock weighs ${u(W, TONNE)}, and ${p}% of it is ore.`, ask: 'How many tonnes of ore is that?', right: C(T, TONNE),
          slips: [
            ...(p !== T && p !== W ? [{ ...C(p, TONNE), slip: 'percentCount', why: `${p}% isn't ${p} tonnes. It means ${p} out of every 100: here ${said} of the ${W} tonnes.` }] : []),
            ...(P !== T ? [{ ...C(P, TONNE), slip: 'rest', why: `${u(P, TONNE)} is the other ${q}%: the plain rock.` }] : []),
            { ...C(T * 2, TONNE), slip: 'twice', why: `That's twice as much. ${p}% is one part in ${d}.` },
            { ...C(T + 1, TONNE), slip: 'off', why: `Cut the ${W} tonnes into ${d} equal parts again: ${p}% is one of them.` },
            ...(T > 1 ? [{ ...C(T - 1, TONNE), slip: 'off', why: `Cut the ${W} tonnes into ${d} equal parts again: ${p}% is one of them.` }] : []),
          ].filter((s) => s.v !== W),
          rightWhy: `${p}% is 1 part in ${d}: ${W} ÷ ${d} = ${u(T, TONNE)}`, sum: { op: 'div', a: W, b: d, say: `${p}% is ${said} of it` },
          help: { title: 'A percent is a part', pic: bar(1, `${p}% = the marked part: ? tonnes`), line: `${p}% is ${said}: one part in ${d}. Cut the rock's ${W} tonnes into ${d} equal parts.`, steps: [`One part in ${d}: ${W} ÷ ${d}`] },
          own: { strand: 'pct', at: 58 }, credit: [{ strand: 'frac', at: 40, weight: 0.5 }], facts: { W, pct: p, ans: T, form: 'of' },
        }, rand);
      }
      if (step === 2) {
        const cand = [[T, 'tonnes', `${T} is the tonnes of ore. A percent says how many in every 100.`], [q, 'rest', `${q}% is the plain rock. The ore is the other part.`], [d, 'parts', `${d} is how many lots of ${u(T, TONNE)} make the rock. One part in ${d} is ${p}%.`],
          [p === 50 ? 25 : p * 2, 'off', `${p === 50 ? 25 : p * 2}% of ${W} tonnes is not ${u(T, TONNE)}.`], [p === 10 ? 1 : p === 20 ? 5 : p === 25 ? 5 : 20, 'off', `That percent of ${W} tonnes is not ${u(T, TONNE)}.`], [W, 'whole', `${W} is the rock's tonnes, not a percent.`]];
        return ownOrder({
          key: `percent:which:${p}`, story: `The scan says this rock weighs ${u(W, TONNE)}, and ${u(T, TONNE)} of it ${T === 1 ? 'is' : 'are'} ore.`, ask: 'What percent of the rock is ore?', right: PC(p),
          slips: cand.filter(([v]) => v > 0 && v < 100 && v !== p).map(([v, slip, why]) => ({ ...PC(v), slip, why })),
          rightWhy: `${T} of ${W} is 1 part in ${d}, and 100 ÷ ${d} = ${p}%`,
          sum: [{ op: 'div', a: W, b: T, say: 'First how many lots of the ore make the rock' }, { op: 'div', a: 100, b: d, say: 'Then that many equal parts of 100%' }],
          help: { title: 'One part in so many', pic: { kind: 'partbar', top: `the rock: ${W} tonnes = 100%`, d, n: 1, each: `${T} t`, line: `the ore is 1 part in ${d}`, ask: `100% ÷ ${d} = ?%` }, line: `The ore is one of ${d} equal parts of the rock. The whole rock is 100%: share it into ${d}.`, steps: [`The parts: ${W} ÷ ${T}`, `Then 100 ÷ ${d}`] },
          own: { strand: 'pct', at: 60 }, credit: [{ strand: 'div', at: 40, weight: 0.5 }], facts: { W, T, ans: p, form: 'which' }, size: 2,
        }, rand);
      }
      return ownOrder({
        key: `percent:plain:${q}`, story: `The scan says this rock weighs ${u(W, TONNE)}, and ${q}% of it is plain rock with no ore in it.`, ask: 'How many tonnes of plain rock is that?', right: C(P, TONNE),
        slips: [
          ...(T !== P ? [{ ...C(T, TONNE), slip: 'rest', why: `${u(T, TONNE)} is the other ${p}%: the ore.` }] : []),
          ...(q !== P && q < 100 ? [{ ...C(q, TONNE), slip: 'percentCount', why: `${q}% isn't ${q} tonnes. It means ${q} out of every 100 of the ${W} tonnes.` }] : []),
          { ...C(P + 1, TONNE), slip: 'off', why: `${p}% of the ${W} tonnes is ${u(T, TONNE)}, the ore. Take that from the whole.` },
          ...(P > 1 ? [{ ...C(P - 1, TONNE), slip: 'off', why: `${p}% of the ${W} tonnes is ${u(T, TONNE)}, the ore. Take that from the whole.` }] : []),
          { ...C(W + T, TONNE), slip: 'added', why: 'That is more than the whole rock weighs. The plain rock is a part of it.' },
        ],
        rightWhy: q === 50 ? `50% is half: ${W} ÷ 2 = ${u(P, TONNE)}` : `The other ${p}% is ${W} ÷ ${d} = ${T} tonnes of ore; ${W} − ${T} = ${u(P, TONNE)} of plain rock`,
        sum: q === 50 ? { op: 'div', a: W, b: 2, say: '50% is half of it' } : [{ op: 'sub', a: 100, b: q, say: 'First the percent that is ore' }, { op: 'div', a: W, b: d, say: `Then the ore: ${p}% is ${said} of the rock` }, { op: 'sub', a: W, b: T, say: 'Then the rock without its ore' }],
        help: { title: 'The easy part first', pic: bar(d - 1, `${q}% = the marked ${d - 1 === 1 ? 'part' : 'parts'}: ? tonnes`), line: q === 50 ? `50% is half of the rock: ${W} ÷ 2.` : `${q}% is all but ${p}%. Find the ${p}% (${said} of the rock), then take it from the whole.`, steps: q === 50 ? [`${W} ÷ 2`] : [`The ore's percent: 100 − ${q}`, `The ore: ${W} ÷ ${d}`, `The plain rock: ${W} − that`] },
        own: { strand: 'pct', at: 62 }, credit: [{ strand: 'sub', at: 30, weight: 0.5 }], facts: { W, pct: q, ans: P, form: 'plain' }, size: q === 50 ? 1 : 3,
      }, rand);
    },
  },

  // ── what this rock's ore is worth, on the one price list; and the drill operator's own share of it ──
  // step 1  each metal's tonnes times what a tonne of it sells for, added up
  // step 2  the drill operator's 20% of that, if all of it comes home
  worth: {
    strand: 'money', at: (step) => (step <= 1 ? 66 : 76),
    make(step, { rand = Math.random, live = null } = {}) {
      const rock = rockOf(live, rand), ms = metalsOf(rock), T = rock.ore0, lots = ms.map((x) => x.t * x.price), sold = lots.reduce((a, b) => a + b, 0), pay = sold * SHARE / 100;
      const found = list(ms.map((x) => `${u(x.t, TONNE)} of ${x.m}`)), prices = ms.length === 1 ? `${cap(ms[0].m)} sells for ${say(ms[0].price)} credits a tonne` : `${cap(list(ms.map((x, i) => `${x.m} ${i ? 'for' : 'sells for'} ${say(x.price)}`)))} credits a tonne`;
      const boxes = ms.map((x) => ({ top: x.m, mid: `${x.t} × ${say(x.price)}`, bot: '= ?', glow: glowOf(x.m) }));
      const chain = [...ms.map((x) => ({ op: 'mul', a: x.t, b: x.price, say: `The ${x.m}: ${u(x.t, TONNE)} at ${say(x.price)} credits` })),
        ...(ms.length >= 2 ? [{ op: 'add', a: lots[0], b: lots[1], say: 'Then the metals together' }] : []), ...(ms.length >= 3 ? [{ op: 'add', a: lots[0] + lots[1], b: lots[2], say: 'And the third' }] : [])];
      const worked = ms.length === 1 ? `${ms[0].t} × ${say(ms[0].price)} = ${say(sold)} credits` : `${ms.map((x, i) => `${x.t} × ${say(x.price)} = ${say(lots[i])}`).join('; ')}; together ${say(sold)} credits`;
      if (step <= 1) {
        return ownOrder({
          key: `worth:rock:${ms.length}`, story: `The scan finds ${found} in this rock. ${prices}.`, ask: 'How many credits is the ore in this rock worth?', right: C(sold, CREDIT),
          slips: [
            ...(ms.length > 1 ? [{ ...C(T * ms[0].price, CREDIT), slip: 'onePrice', why: `That sells every tonne at ${ms[0].m}'s price. Each metal has its own price.` }, { ...C(ms.reduce((s, x) => s + x.price, 0), CREDIT), slip: 'pricesOnly', why: 'That adds the prices of one tonne of each. Multiply each metal\'s tonnes by its price first.' }, { ...C(lots[0], CREDIT), slip: 'part', why: `That is only the ${ms[0].m}. Add what the ${ms.length === 2 ? ms[1].m : 'others'} sell for.` }] : []),
            ...(ms.length === 1 && T > 1 ? [{ ...C(ms[0].price, CREDIT), slip: 'oneTonne', why: `${say(ms[0].price)} credits is what one tonne sells for. There are ${u(T, TONNE)}.` }] : []),
            { ...C(sold + ms[0].price, CREDIT), slip: 'groupOff', why: `That is a tonne of ${ms[0].m} too many.` },
            ...(sold - ms[0].price > 0 ? [{ ...C(sold - ms[0].price, CREDIT), slip: 'groupOff', why: `That is a tonne of ${ms[0].m} short.` }] : []),
            { ...C(T + ms[0].price, CREDIT), slip: 'added', why: 'That adds the tonnes to the price. Every tonne sells for the price: multiply.' },
            { ...C(sold * 10, CREDIT), slip: 'pointLost', why: 'That is ten times too much. Count the zeros again.' },
          ],
          rightWhy: worked, sum: chain.length === 1 ? chain[0] : chain,
          help: { title: 'Tonnes times the price', pic: { kind: 'boxes', boxes, op: '+', ask: 'the ore in this rock = ? credits' }, line: `Each tonne of a metal sells for that metal's price on the chart.${ms.length > 1 ? ' Work each metal out, then add them.' : ''}`, steps: [...ms.map((x) => `The ${x.m}: ${x.t} × ${say(x.price)}`), ...(ms.length > 1 ? ['Then add them'] : [])] },
          own: { strand: 'money', at: 66 }, credit: [{ strand: 'mul', at: 43, weight: 0.5 }], facts: { sold, lots, T }, size: Math.min(3, ms.length + (ms.length > 1 ? 1 : 0)),
        }, rand);
      }
      return ownOrder({
        key: `worth:share:${ms.length}`, story: `The scan finds ${found} in this rock. ${prices}, and the drill operator's share is ${SHARE}%.`, ask: 'If all of it comes home, how many credits is the drill operator\'s share of this rock?', right: C(pay, CREDIT),
        slips: [
          { ...C(sold, CREDIT), slip: 'noShare', why: `${say(sold)} credits is what the ore sells for. The share is ${SHARE}% of that.` },
          { ...C(sold - pay, CREDIT), slip: 'rest', why: `That is the other ${100 - SHARE}%: the captain's and the rest of the crew's.` },
          { ...C(sold / 10, CREDIT), slip: 'tenOnly', why: `That is 10% of what the ore sells for. ${SHARE}% is twice that.` },
          ...(ms.length > 1 ? [{ ...C(lots[0] * SHARE / 100, CREDIT), slip: 'part', why: `That is the share of the ${ms[0].m} only. The other ${ms.length === 2 ? 'metal sells' : 'metals sell'} too.` }] : []),
          { ...C(pay + ms[0].price * SHARE / 100, CREDIT), slip: 'off', why: 'First what the ore sells for, then a fifth of it.' },
        ],
        rightWhy: `${worked}; ${SHARE}% of that is ${say(sold)} ÷ 5 = ${say(pay)} credits`,
        sum: [...chain, { op: 'div', a: sold, b: 5, say: `Then the share: ${SHARE}% is a fifth of it` }],
        lines: [...ms.map((x) => [cap(x.m), `${u(x.t, TONNE)} at ${say(x.price)} credits a tonne`]), ['The drill operator\'s share', `${SHARE}%`], ['The share of this rock', '?']],
        help: { title: 'What it sells for, then a fifth', pic: { kind: 'boxes', boxes: [...boxes, { top: `the share: ${SHARE}%`, mid: '÷ 5', bot: '= ? credits', ask: true }], op: ms.length > 1 ? '+' : '', last: '→', ask: '' }, line: `First what the ore sells for (each metal's tonnes times its price), then ${SHARE}% of that: a fifth.`,
          steps: [...ms.map((x) => `The ${x.m}: ${x.t} × ${say(x.price)}`), ...(ms.length > 1 ? ['Add them'] : []), 'Then the share: that ÷ 5'] },
        own: { strand: 'pct', at: 76 }, credit: [{ strand: 'mul', at: 43, weight: 0.5 }], facts: { sold, pay, T }, size: 3,
      }, rand);
    },
  },
};

// ── the ladder: easiest first, every step small ──────────────────────────────────────────────────────────────────
// (the levels' ids are kept from the first ladder, so a crew member's place on it is kept: 'share', 'fill', 'fillParts'
// and 'ball' are older names than their cards)
const M = (maker, step, w = 1) => ({ maker, step, w });

export const PLACE = {
  id: 'drill', name: 'The Miner\'s drill', short: 'Drill', math: 'A rock\'s ore and its weight: counting, parts, cubic metres, percents, credits', pic: 'smelter', job: null,
  line: 'The rock in the claw, by its own numbers: the veins of ore in it, the part of it that is ore, its weight from its size, and what its ore is worth.',
  levels: [
    { id: 'kVeins', title: 'Veins to count', line: 'Up to 5: the veins of ore the scan shows', gen: { mix: [M('veins', 1)] } },
    { id: 'kHoles', title: 'Veins in all, holes left', line: 'Up to 10: 2 veins of iron and 1 of gold; 5 holes, 2 drilled', gen: { mix: [M('veins', 2, 2), M('veins', 1)] } },
    { id: 'kCans', title: 'Canisters still to fill', line: '8 canisters, 5 full: how many to fill', gen: { mix: [M('veins', 3, 2), M('veins', 2)] } },
    { id: 'kLumps', title: 'Veins of the same', line: '3 veins with 4 lumps of ore in each', strand: 'words', gen: { mix: [M('lumps', 1, 2), M('veins', 3)] } },
    { id: 'tonnes', title: 'The ore and the plain rock', line: '12 tonnes of rock, 3 of it ore: how much is plain rock', gen: { mix: [M('plain', 1, 2), M('lumps', 1)] } },
    { id: 'share', title: 'One tonne in every few', line: '12 tonnes, one tonne of ore in every 4', gen: { mix: [M('per', 1, 2), M('plain', 1)] } },
    { id: 'part', title: 'A part of the rock', line: '1/4 of the 12 tonnes is ore', gen: { mix: [M('part', 1, 2), M('per', 1)] } },
    { id: 'parts', title: 'Several parts', line: '3/4 of the 12 tonnes is plain rock', gen: { mix: [M('part', 2, 2), M('part', 1)] } },
    { id: 'box', title: 'The box round the rock', line: '3 m long, 2 m wide, 2 m high: how many cubic metres', gen: { mix: [M('box', 1, 2), M('part', 2)] } },
    { id: 'tenths', title: 'Veins in tenths', line: '1.2 tonnes in one vein and 0.8 in another', gen: { mix: [M('tenths', 1, 2), M('box', 1)] } },
    { id: 'fill', title: 'What part is ore', line: '3 tonnes of the 12 are ore: what part of the rock', gen: { mix: [M('part', 3, 2), M('tenths', 1)] } },
    { id: 'weight', title: 'The rock\'s weight from its box', line: 'A box of 8 cubic metres, half full of rock, 3 tonnes to the cubic metre', gen: { mix: [M('box', 2, 2), M('part', 3)] } },
    { id: 'percent', title: 'A percent of the rock', line: '25% of the 12 tonnes is ore', gen: { mix: [M('percent', 1, 2), M('box', 2)] } },
    { id: 'fillParts', title: 'What percent is ore', line: '3 tonnes of the 12 are ore: what percent', gen: { mix: [M('percent', 2, 2), M('percent', 1)] } },
    { id: 'anyPercent', title: 'The plain rock\'s percent', line: '75% of the 12 tonnes is plain rock', gen: { mix: [M('percent', 3, 2), M('percent', 2)] } },
    { id: 'ball', title: 'The rock\'s weight from its size', line: '3 by 2 by 2 metres, half its box, 4 tonnes to the cubic metre', gen: { mix: [M('box', 3, 2), M('percent', 3)] } },
    { id: 'credits', title: 'What the ore is worth', line: '2 tonnes of iron at 2,000 and 1 of gold at 8,000', gen: { mix: [M('worth', 1, 2), M('box', 3)] } },
    { id: 'myShare', title: 'Your share of the rock', line: 'What its ore sells for, and 20% of that', gen: { mix: [M('worth', 2, 2), M('worth', 1)] } },
  ],
};

export const JOB = {
  // (not one of the station's job spots, src/jobs/index.js JOBS: its place is the Miner's drill on a captain's run,
  // src/drillview.js. Its levels are on the crew screen's list with the others': src/ui/title.js)
  id: 'drill', name: 'Rock scan', short: 'Drill', open: true, seated: true,
  spot: null, sign: 'The Miner\'s drill', hint: 'Work out the scan',
  place: PLACE, setting: SETTING, makers: MAKERS,
  card: 'payslip',
  dark: true,      // its pictures are drawn dark, with light lines (src/jobs/pics.js NIGHT)
};
