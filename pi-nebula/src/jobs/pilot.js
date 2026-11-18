// THE PILOT'S SEAT: the jump computer's math, for a crew member who signs on as a captain's pilot (src/missions.js; the
// game's maker, 2026-11-17: "if you are the pilot then you take the ship out of the hanger, then calculate a jump
// (with maybe 3 questions)"). One ladder like every job's, kids to grown-ups, on JUMP DISTANCES AND TIMES:
// counting the hops to the rocks; hops in all and hops left; past ten along the numbered beacons; equal jumps; jumps
// and totals; a distance shared out into equal jumps; speed and time (how far); how fast and how long; bigger trips by
// the minute; distances in tenths; whole fuel cells for a jump; fuel by the jump (ratio tables); speeds with tenths;
// proportions; two legs and the speed over a whole trip; and at the top seconds into minutes. Kilometres, seconds and
// minutes throughout; decimals stay decimals.
// Mathwood Valley's question makers tell the stories of fuel cells, equal jumps, totals, shared distances, whole cells
// and the ratio tables through SETTING (engine.js). The hops on the jump computer's picture of the way, the speeds and
// times, and the distances in tenths are this job's own makers (MAKERS below): Mathwood's speed stories are told with
// wagons and stagecoaches in miles and have no hook for another world yet.
//
// THE JUMP'S THREE LAMPS (distance, charge, go: src/trip.js): a jump is three cards. Where a level has a card that
// suits the lamp being lit (an Ask's `lamp`), that one is dealt: how far for DISTANCE, fuel cells for CHARGE, how
// long or how fast for GO; where it has none, any card of the level (pickAsk).
// WHERE TO: on a trip the cards say where the jump is going (`live.to`: 'field' on the way out, 'home' on the way
// back); from the levels page, either.
import { dec } from '../../../mathwood-valley/src/math/counterkit.js';
import { ownOrder } from './engine.js';

const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
const say = (n) => Number(n).toLocaleString('en-US');
const KM = ['kilometre', 'kilometres'], SEC = ['second', 'seconds'], MIN = ['minute', 'minutes'], HOP = ['hop', 'hops'], CELL = ['fuel cell', 'fuel cells'];
const KPS = ['kilometre a second', 'kilometres a second'], KPM = ['kilometre a minute', 'kilometres a minute'];

// who is aboard (Mathwood's FOLK shape): the Miner's crew
const FOLK = [{ name: 'Pilot Juno', she: true }, { name: 'Captain Ruiz', she: false }, { name: 'Miner Kestrel', she: true }, { name: 'Engineer Okafor', she: false }];

export const SETTING = {
  folk: FOLK,
  // the youngest: fuel cells to count (Mathwood's picture-story shape for a can)
  things: [{ key: 'cells', unit: CELL, shape: 'can', short: ['cell', 'cells'] }],
  kmoreHow: [({ b }) => `The engineer brings ${b} more.`, ({ b }) => `A supply drone drops off ${b} more.`, ({ b, p }) => `${p.They} finds ${b} more in the locker.`],
  kleftHow: [({ b }) => `The jump drive used ${b} of them.`, ({ b, p }) => `${p.They} put ${b} of them in the jump drive.`, ({ b }) => `${b} of them went to the Explorer's crew.`],
  groups: [
    { key: 'jumps', item: ['jump', 'jumps'], unit: KM, story: ({ a, b }) => `The way ahead is ${a} jumps, and each jump is ${b} kilometres long.`, ask: () => 'How many kilometres is the way ahead?' },
    { key: 'cells', item: ['jump', 'jumps'], unit: CELL, story: ({ a, b }) => `The trip is ${a} jumps. The jump drive burns ${b} fuel cells on every jump.`, ask: () => 'How many fuel cells does the trip need?' },
    { key: 'charge', item: ['power bank', 'power banks'], unit: MIN, story: ({ a, b }) => `The jump drive has ${a} power banks. Each one takes ${b} minutes to charge.`, ask: () => 'How many minutes does it take to charge them all, one after another?' },
    { key: 'beacons', item: ['jump', 'jumps'], unit: ['beacon', 'beacons'], story: ({ a, b, f }) => `${f.name} plots ${a} jumps, with ${b} beacons to pass on each jump.`, ask: () => 'How many beacons is that in all?' },
  ],
  share: [
    { key: 'legs', thing: KM, box: ['jump', 'jumps'], story: ({ total, groups }) => `The way ahead is ${total} kilometres. The jump drive covers it in ${groups} jumps, all the same length.`, ask: 'How many kilometres is each jump?' },
    { key: 'cells', thing: CELL, box: ['jump', 'jumps'], story: ({ total, groups }) => `The Miner carries ${total} fuel cells for ${groups} jumps, the same number for each jump.`, ask: 'How many fuel cells are there for each jump?' },
    { key: 'minutes', thing: MIN, box: ['jump', 'jumps'], story: ({ total, groups }) => `The whole trip takes ${total} minutes, in ${groups} jumps that each take the same time.`, ask: 'How many minutes does each jump take?' },
  ],
  crates: [
    { key: 'cells', box: CELL, story: ({ total, per }) => `The jump home needs ${total} units of charge. One fuel cell holds ${per} units.`, ask: 'How many fuel cells are needed so there is enough charge?' },
    { key: 'banks', box: ['power bank', 'power banks'], story: ({ total, per, f }) => `${f.name} has ${total} units of charge to store. A power bank holds ${per} units.`, ask: 'How many power banks are needed to hold it all?' },
  ],
  partsLeft: [
    { key: 'toGo', unit: KM, story: ({ a, b }) => `The way ahead was ${a} kilometres. The Miner has flown ${b} kilometres of it.`, ask: 'How many kilometres are still to go?' },
    { key: 'cellsLeft', unit: CELL, story: ({ a, b }) => `The Miner set out with ${a} fuel cells. Its jumps so far have used ${b} of them.`, ask: 'How many fuel cells are left?' },
    { key: 'charge', unit: ['unit', 'units'], story: ({ a, b }) => `The jump drive needs ${a} units of charge. It has ${b} units so far.`, ask: 'How many more units does it need?' },
  ],
  partsTogether: [
    { key: 'legs', unit: KM, story: ({ a, b }) => `The first jump is ${a} kilometres and the second jump is ${b} kilometres.`, ask: 'How many kilometres is that in all?' },
    { key: 'time', unit: MIN, story: ({ a, b }) => `The trip out takes ${a} minutes and the trip home takes ${b} minutes.`, ask: 'How many minutes is that in all?' },
    { key: 'cells', unit: CELL, story: ({ a, b }) => `The jump out burns ${a} fuel cells and the jump home burns ${b}.`, ask: 'How many fuel cells is that in all?' },
  ],
  tables: [
    { key: 'cells', top: ['jump', 'jumps'], bot: CELL, botShort: ['cell', 'cells'], s: (a, b) => `The jump drive burns ${a} fuel cells for every ${b} jumps.` },
    { key: 'charge', top: MIN, bot: ['unit of charge', 'units of charge'], botShort: ['unit', 'units'], s: (a, b) => `The reactor makes ${a} units of charge every ${b} minutes.` },
    { key: 'km', top: SEC, bot: KM, botShort: ['km', 'km'], s: (a, b) => `On its thrusters the Miner covers ${a} kilometres every ${b} seconds.` },
  ],
  proportions: [
    // (their units short: the ratio table's rows are named by them, "cells in all")
    ({ n, d, D }) => ({ key: 'burn', s: `${n} of every ${d} fuel cells aboard ${n === 1 ? 'is' : 'are'} for the jump drive. The Miner carries ${D} fuel cells.`, ask: 'How many of them are for the jump drive?', unit: ['cell', 'cells'], what: 'jump drive' }),
    ({ n, d, D }) => ({ key: 'drive', s: `${n} of every ${d} kilometres of this trip ${n === 1 ? 'is' : 'are'} flown on the jump drive, and the rest on thrusters. The trip is ${D} kilometres.`, ask: 'How many kilometres are flown on the jump drive?', unit: ['km', 'km'], what: 'jump drive' }),
    ({ n, d, D }) => ({ key: 'beacons', s: `${n} of every ${d} beacons on this route ${n === 1 ? 'is' : 'are'} lit. There are ${D} beacons on the route.`, ask: 'How many of them are lit?', unit: ['beacon', 'beacons'], what: 'lit' }),
  ],
};

// ── the faces on the answer buttons ──────────────────────────────────────────────────────────────────────────────
// a whole count with its unit; a decimal kept as a whole number of hundredths (no rounding slips), printed without
// zeros it does not need: 250 -> "2.5 kilometres"
const C = (n, unit) => ({ v: n, big: say(n), small: n === 1 ? unit[0] : unit[1], label: `${say(n)} ${n === 1 ? unit[0] : unit[1]}` });
const D = (h, unit = KM) => { const n = Math.round(h), big = dec(n, 2, { trim: true }), small = n === 100 ? unit[0] : unit[1]; return { v: n, big, small, label: `${big} ${small}` }; };
const t1 = (tenths) => dec(tenths, 1, { trim: true });           // tenths as text: 25 -> "2.5", 20 -> "2"
const kit = (rand) => ({ int: (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)), pick: (a) => a[Math.floor(rand() * a.length)], chance: (p) => rand() < p,
  shuffle: (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; } });

// where the jump is going: said in the stories, and drawn at the far end of the pictures
const DEST = {
  field: { key: 'field', name: 'the rocks', is: 'The rocks are', to: 'to the rocks', from: 'the station' },
  home: { key: 'home', name: 'the station', is: 'The station is', to: 'home to the station', from: 'the rocks' },
};
const destOf = (live, t) => DEST[live && DEST[live.to] ? live.to : t.pick(['field', 'home'])];
// near misses of a whole answer, one or two off either way, in a random order (so the right one is not always the
// middle button): [{ ...face, slip: 'off', why }]
const nearOf = (t, v, face, why, lo = 1) => t.shuffle([v + 1, v - 1, v + 2, v - 2]).filter((x) => x >= lo).map((x) => ({ ...face(x), slip: 'off', why: why(x) }));

export const MAKERS = {
  // ── the hops on the jump computer's picture of the way (the youngest): the hops are drawn on the card, and
  // counting them is the skill ──────────────────────────────────────────────────────────────────────────────────
  // step 1  up to 5: how many hops to the rocks
  // step 2  up to 10: hops in all (3 to the beacon and 2 more), hops left (7 hops, 3 made)
  // step 3  past 10, along the numbered beacons: at beacon 8, 5 more hops; from beacon 8 to beacon 13
  // step 4  equal jumps: 3 jumps of 5 kilometres
  hops: {
    strand: 'number', at: (step) => [0, 6, 12, 16][Math.max(1, Math.min(4, step)) - 1],
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), W = destOf(live, t);
      if (step <= 1) {
        const n = t.int(1, 5);
        return ownOrder({
          key: 'hops:count', story: `The jump computer shows the way ${W.to}, hop by hop.`, ask: `How many hops is it to ${W.name}?`,
          right: C(n, HOP),
          slips: [
            { ...C(n + 1, HOP), slip: 'off', why: 'One too many. Count again, touching each hop once.' },
            { ...C(n - 1, HOP), slip: 'off', why: 'One short. Count again, touching each hop once.' },
            { ...C(n + 2, HOP), slip: 'off', why: 'Too many. Count again, touching each hop once.' },
            { ...C(n + 3, HOP), slip: 'off', why: 'Too many. Count again, touching each hop once.' },
          ],
          rightWhy: `${u(n, HOP)} to ${W.name}`,
          picFirst: true, help: { title: 'Count the hops', pic: { kind: 'hops', mode: 'count', n, to: W.key }, line: 'Touch each hop once as you count: 1, 2, 3 ...' },
          own: { strand: 'number', at: 0 }, facts: { kind: 'count', n, to: W.key },
        }, rand, 3);
      }
      if (step === 2) {
        if (t.chance(0.55)) {
          const a = t.int(1, 6), b = t.int(1, Math.min(4, 10 - a)), n = a + b;
          return ownOrder({
            key: 'hops:more', story: `The way to ${W.name} is ${u(a, HOP)} to the beacon, then ${b} more.`, ask: 'How many hops is that in all?',
            right: C(n, HOP),
            slips: [
              { ...C(a, HOP), slip: 'first', why: `${a} is only as far as the beacon. Count the ${b} after it too.` },
              { ...C(n + 1, HOP), slip: 'off', why: 'One too many. Count again, touching each hop once.' },
              { ...C(n - 1, HOP), slip: 'off', why: 'One short. Count again, touching each hop once.' },
              { ...C(b, HOP), slip: 'new', why: `${b} is only the ${b === 1 ? 'hop' : 'hops'} after the beacon. Count them all together.` },
            ],
            rightWhy: `${a} and ${b} more make ${u(n, HOP)}`, sum: { op: 'add', a, b },
            picFirst: true, help: { title: 'Count the hops', pic: { kind: 'hops', mode: 'more', a, b, to: W.key }, line: `Count the hops to the beacon, then keep counting the ones after it.` },
            own: { strand: 'number', at: 6 }, credit: [{ strand: 'add', at: 5, weight: 0.5 }], facts: { kind: 'more', a, b, n, to: W.key },
          }, rand, 3);
        }
        const n = t.int(3, 10), b = t.int(1, n - 1), left = n - b;
        return ownOrder({
          key: 'hops:left', story: `The way to ${W.name} is ${u(n, HOP)}. The Miner has made ${b} of them.`, ask: 'How many hops are left?',
          right: C(left, HOP),
          slips: [
            { ...C(b, HOP), slip: 'taken', why: `${b} is how many it has made. Count the ones still to go.` },
            { ...C(n, HOP), slip: 'all', why: `${n} is the whole way. ${b} are made already, so fewer are left.` },
            { ...C(left + 1, HOP), slip: 'off', why: 'One too many. Count the hops still to go again.' },
            { ...C(left - 1, HOP), slip: 'off', why: 'One short. Count the hops still to go again.' },
          ],
          rightWhy: `${n} take away ${b} leaves ${u(left, HOP)}`, sum: { op: 'sub', a: n, b },
          picFirst: true, help: { title: 'Count the hops', pic: { kind: 'hops', mode: 'left', n, b, to: W.key }, line: 'The ticked hops are made. Count the hops still to go.' },
          own: { strand: 'number', at: 6 }, credit: [{ strand: 'sub', at: 5, weight: 0.5 }], facts: { kind: 'left', n, b, left, to: W.key },
        }, rand, 3);
      }
      if (step === 3) {
        const B = (n) => ({ v: n, big: say(n), small: 'beacon', label: `beacon ${n}` });
        if (t.chance(0.5)) {
          // on from a numbered beacon: where does it land
          const a = t.int(6, 12), b = t.int(Math.max(3, 11 - a), Math.min(8, 20 - a)), end = a + b;
          return ownOrder({
            key: 'hops:land', story: `The beacons on the way are numbered. The Miner is at beacon ${a}. It hops on ${b} beacons.`, ask: 'Which beacon is it at now?',
            right: B(end),
            slips: [
              { ...B(end + 1), slip: 'off', why: `One too far. Start at ${a} and count on ${b}.` },
              { ...B(end - 1), slip: 'off', why: `One short. The first hop lands on ${a + 1}, not on ${a}.` },
              { ...B(b), slip: 'new', why: `${b} is how many hops it makes. It started at beacon ${a}.` },
              { ...B(a), slip: 'first', why: `${a} is where it started. It hops on ${b} beacons from there.` },
            ],
            rightWhy: `${a} and ${b} more make ${end}: beacon ${end}`, sum: { op: 'add', a, b },
            picFirst: true, help: { title: 'Count on', pic: { kind: 'hops', mode: 'line', a, b, ask: 'end' }, line: `Start at ${a} and count on, one for each hop: ${a + 1}, ${a + 2} ...` },
            own: { strand: 'number', at: 12 }, credit: [{ strand: 'add', at: 12, weight: 0.5 }], facts: { kind: 'land', a, b, end },
          }, rand, 3);
        }
        const a = t.int(4, 10), b = t.int(Math.max(3, 11 - a), Math.min(8, 20 - a)), end = a + b;
        return ownOrder({
          key: 'hops:gap', story: `The beacons on the way are numbered. The Miner is at beacon ${a}. ${W.is} at beacon ${end}.`, ask: `How many hops is it to ${W.name}?`,
          right: C(b, HOP),
          slips: [
            { ...C(end, HOP), slip: 'bigger', why: `${end} is the beacon's number. Count the hops from ${a} to ${end}.` },
            { ...C(b + 1, HOP), slip: 'off', why: `One too many. From ${a}, the first hop lands on ${a + 1}.` },
            { ...C(b - 1, HOP), slip: 'off', why: `One short. Count every hop from ${a} to ${end}.` },
            { ...C(a, HOP), slip: 'first', why: `${a} is the beacon it starts at. Count the hops from there to ${end}.` },
          ],
          rightWhy: `From ${a} to ${end} is ${u(b, HOP)}: ${end} take away ${a}`, sum: { op: 'sub', a: end, b: a },
          picFirst: true, help: { title: 'Count the hops', pic: { kind: 'hops', mode: 'line', a, b, ask: 'hops' }, line: `Count the hops from beacon ${a} to beacon ${end}.` },
          own: { strand: 'number', at: 12 }, credit: [{ strand: 'sub', at: 12, weight: 0.5 }], facts: { kind: 'gap', a, b, end, to: W.key },
        }, rand, 3);
      }
      // equal jumps
      let g = 2, e = 2;
      for (let tries = 0; tries < 20; tries++) { g = t.int(2, 5); e = t.pick([2, 2, 5, 5, 10, 3, 4]); if (g * e <= 50) break; }
      const ans = g * e;
      return ownOrder({
        key: 'hops:equal', story: `The Miner makes ${g} jumps. Each jump is ${e} kilometres long.`, ask: 'How many kilometres is that in all?',
        right: C(ans, KM),
        slips: [
          { ...C(g + e, KM), slip: 'added', why: `That adds the jumps to the kilometres. It is ${g} jumps of ${e} kilometres: count on ${e} for every jump.` },
          { ...C(e, KM), slip: 'one', why: `${e} kilometres is one jump. There are ${g} jumps.` },
          { ...C(ans + e, KM), slip: 'groupOff', why: `That is ${g + 1} jumps. Count the jumps again: ${g}.` },
          { ...C(ans - e, KM), slip: 'groupOff', why: `That is only ${g - 1} ${g - 1 === 1 ? 'jump' : 'jumps'}. Count the jumps again: ${g}.` },
        ],
        rightWhy: `${g} jumps of ${e}: ${Array(g).fill(e).join(' + ')} = ${u(ans, KM)}`, sum: { op: 'mul', a: g, b: e },
        picFirst: true, help: { title: 'Jump by jump', pic: { kind: 'hops', mode: 'equal', g, e }, line: `Count on ${e} for every jump: ${Array.from({ length: Math.min(g, 3) }, (_, i) => e * (i + 1)).join(', ')} ...` },
        own: { strand: 'words', at: 16 }, credit: [{ strand: 'mul', at: 14, weight: 0.5 }], facts: { kind: 'equal', g, e, ans },
      }, rand, 3);
    },
  },

  // ── speed, time and distance ─────────────────────────────────────────────────────────────────────────────────
  // (Mathwood's own speed stories, src/math/wordproblems.js MAKERS.rate, told in space with this job's numbers: the same
  // three ways round, and the slips children really make: the two numbers added or taken away, the time taken for the
  // speed, one stretch too many or too few)
  // step 1  how far: 6 kilometres a second for 5 seconds
  // step 2  how fast, how long: 45 kilometres in 9 seconds; 40 kilometres at 8 kilometres a second
  // step 3  bigger trips, by the minute: 360 kilometres at 40 kilometres a minute
  // step 4  speeds with tenths: 7.5 kilometres a second for 4 seconds; 30 kilometres at 7.5 kilometres a second
  // step 5  two legs: 120 kilometres at 40 a minute, then 90 at 30; the speed over the whole trip
  // step 6  seconds into minutes: 2,400 kilometres at 8 kilometres a second, in minutes
  rate: {
    strand: 'ratio', at: (step) => [38, 42, 48, 62, 74, 78][Math.max(1, Math.min(6, step)) - 1],
    make(step, { rand = Math.random, live = null, frac = 0 } = {}) {
      const t = kit(rand), W = destOf(live, t);
      if (step <= 3) {
        const big = step === 3, U = big ? MIN : SEC, SP = big ? KPM : KPS, per = big ? 'a minute' : 'a second';
        const form = step <= 1 ? 'distance' : step === 2 ? t.pick(['speed', 'time']) : t.pick(['distance', 'speed', 'time']);
        let sp = 2, tm = 2;
        for (let tries = 0; tries < 30; tries++) { sp = big ? t.pick([20, 30, 40, 50, 60, 80, 90, 120]) : t.int(2, 9); tm = t.int(2, 9); if (big || sp !== tm) break; }
        const d = sp * tm, k = big ? 10 : 1;   // (k: the speeds go in tens by the minute)
        const own = { strand: 'ratio', at: [38, 42, 48][step - 1] };
        if (form === 'distance') {
          const ctx = t.pick([
            { story: `The Miner flies ${sp} kilometres ${per}. The jump lasts ${u(tm, U)}.`, ask: 'How many kilometres is the jump?' },
            { story: `The jump drive carries the Miner ${sp} kilometres every ${U[0]}, for ${u(tm, U)}.`, ask: 'How far does it go?' },
          ]);
          return ownOrder({
            key: `rate:distance:${big ? 'min' : 'sec'}`, story: ctx.story, ask: ctx.ask, right: C(d, KM),
            slips: [
              // (by the minute the speeds go in tens: the zero left off comes first)
              ...(big ? [{ ...C(d / 10, KM), slip: 'zeroLost', why: `${sp / 10} × ${tm} = ${d / 10}, but the speed is ${sp}: ten times that.` }] : []),
              { ...C(sp + tm, KM), slip: 'added', why: `${sp} + ${tm} adds the speed to the ${U[1]}. Every ${U[0]} covers ${sp} kilometres, ${tm} times over.` },
              { ...C(sp, KM), slip: 'one', why: `${sp} kilometres is the first ${U[0]} only. The jump lasts ${tm}.` },
              { ...C(sp * (tm + 1), KM), slip: 'groupOff', why: `That is ${tm + 1} ${U[1]} of ${sp} kilometres. The jump lasts ${tm}.` },
              { ...C(sp * (tm - 1), KM), slip: 'groupOff', why: `That is only ${u(tm - 1, U)} of ${sp} kilometres. The jump lasts ${tm}.` },
            ],
            rightWhy: `${u(sp, SP)} × ${u(tm, U)} = ${say(d)} kilometres`, sum: { op: 'mul', a: sp, b: tm },
            help: { title: 'Stretch by stretch', pic: { kind: 'trip', form: 'distance', speed: sp, steps: tm, step: U, to: W.key }, line: `${u(tm, U)}, ${sp} kilometres in every ${U[0]}: ${tm} lots of ${sp}.`, steps: [`${tm} lots of ${sp}: ${sp} × ${tm}`] },
            own, credit: [{ strand: 'mul', at: big ? 32 : 20, weight: 0.5 }], facts: { form, sp, tm, d, unit: U[0] },
          }, rand);
        }
        if (form === 'speed') {
          const F = (v) => C(v, SP);
          const slips = [
            ...(tm !== sp && !big ? [{ ...F(tm), slip: 'swapped', why: `${tm} is how many ${U[1]} the jump takes. The speed is the kilometres covered in each ${U[0]}: share the ${d} kilometres over ${tm} ${U[1]}.` }] : []),
            ...(!big && d - tm > 0 && d - tm <= 20 ? [{ ...F(d - tm), slip: 'subtracted', why: `${say(d)} − ${tm} takes the ${U[1]} away from the kilometres. Share the ${say(d)} kilometres out over the ${tm} ${U[1]}.` }] : []),
            ...(big ? [{ ...F(sp / 10), slip: 'zeroLost', why: `${sp / 10} kilometres ${per} would cover only ${sp / 10 * tm} kilometres in ${tm} ${U[1]}. ${W.is} ${say(d)} away.` }] : []),
            ...nearOf(t, sp / k, (x) => F(x * k), (x) => (x * k > sp ? `At ${x * k} kilometres ${per}, ${tm} ${U[1]} cover ${say(x * k * tm)} kilometres, more than ${say(d)}.` : `At ${x * k} kilometres ${per}, ${tm} ${U[1]} cover only ${say(x * k * tm)} kilometres, not ${say(d)}.`)),
          ];
          return ownOrder({
            key: `rate:speed:${big ? 'min' : 'sec'}`, story: `${W.is} ${say(d)} kilometres away. The jump has to take ${u(tm, U)}.`, ask: `How many kilometres ${per} must the Miner fly?`, right: F(sp), slips,
            rightWhy: `${say(d)} kilometres ÷ ${u(tm, U)} = ${u(sp, SP)}`, sum: { op: 'div', a: d, b: tm },
            help: { title: 'Share it out', pic: { kind: 'trip', form: 'speed', steps: tm, total: d, step: U, to: W.key }, line: `${say(d)} kilometres cut into ${tm} equal stretches, one for each ${U[0]}. How long is each stretch?`, steps: [`${say(d)} shared over ${tm} ${U[1]}: ${say(d)} ÷ ${tm}`] },
            own, credit: [{ strand: 'div', at: big ? 34 : 29, weight: 0.5 }], facts: { form, sp, tm, d, unit: U[0], to: W.key },
          }, rand);
        }
        const F = (v) => C(v, U);
        const slips = [
          ...(sp !== tm && !big ? [{ ...F(sp), slip: 'swapped', why: `${sp} is its speed, kilometres ${per}. How many ${sp}-kilometre ${U[1]} fit into ${d} kilometres?` }] : []),
          ...(big ? [{ ...F(tm * 10), slip: 'zeroKept', why: `${tm * 10} ${U[1]} at ${sp} kilometres ${per} would be ${say(tm * 10 * sp)} kilometres. ${W.is} only ${say(d)} away.` }] : []),
          ...nearOf(t, tm, F, (x) => (x > tm ? `${u(x, U)} at ${sp} would be ${say(x * sp)} kilometres, past ${W.name}.` : `${u(x, U)} at ${sp} is only ${say(x * sp)} kilometres, short of ${W.name}.`)),
        ];
        return ownOrder({
          key: `rate:time:${big ? 'min' : 'sec'}`, story: `The Miner flies ${sp} kilometres ${per}. ${W.is} ${say(d)} kilometres away.`, ask: `How many ${U[1]} is the jump?`, right: F(tm), slips,
          rightWhy: `${say(d)} kilometres ÷ ${u(sp, SP)} = ${u(tm, U)}`, sum: { op: 'div', a: d, b: sp },
          help: { title: 'How many fit', pic: { kind: 'trip', form: 'time', speed: sp, total: d, step: U, to: W.key }, line: `Each ${U[0]} covers ${sp} kilometres. Count the ${U[1]} it takes to cover ${say(d)}.`, steps: [`How many ${sp}s fit in ${say(d)}: ${say(d)} ÷ ${sp}`] },
          own, credit: [{ strand: 'div', at: big ? 34 : 29, weight: 0.5 }], facts: { form, sp, tm, d, unit: U[0], to: W.key },
        }, rand);
      }
      if (step === 4) {
        // speeds with tenths, by the second
        const own = { strand: 'ratio', at: 62 };
        for (let tries = 0; tries < 80; tries++) {
          const sp = t.pick(frac < 0.5 ? [15, 25, 35, 45, 12, 24] : [15, 25, 35, 45, 75, 12, 24, 36, 48, 18, 65]), tm = t.int(2, 8), d10 = sp * tm;   // tenths
          const form = t.chance(0.55) ? 'distance' : 'time';
          if (form === 'distance') {
            const whole = Math.floor(sp / 10);
            return ownOrder({
              key: 'rate:distance:dec', story: `The Miner flies ${t1(sp)} kilometres a second. The jump lasts ${tm} seconds.`, ask: 'How many kilometres is the jump?', right: D(d10 * 10),
              slips: [
                { ...D(d10 * 100), slip: 'pointLost', why: `${sp} × ${tm} = ${d10}, but ${t1(sp)} is ${sp} tenths: the answer is ${d10} tenths.` },
                { ...D(whole * tm * 100), slip: 'wholeOnly', why: `That is ${whole} × ${tm}. It leaves out the other ${dec(sp % 10, 1)} of a kilometre in every second.` },
                { ...D((sp + tm * 10) * 10), slip: 'added', why: `That adds the speed to the seconds. Every second covers ${t1(sp)} kilometres, ${tm} times over.` },
                { ...D(sp * (tm + 1) * 10), slip: 'groupOff', why: `That is ${tm + 1} seconds of ${t1(sp)} kilometres. The jump lasts ${tm}.` },
              ],
              rightWhy: `${t1(sp)} × ${tm} = ${t1(d10)} kilometres`, sum: { op: 'mul', a: sp / 10, b: tm },
              help: { title: 'Stretch by stretch', pic: { kind: 'trip', form: 'distance', speed: t1(sp), steps: tm, step: SEC, to: W.key }, line: `${tm} seconds, ${t1(sp)} kilometres in every second: ${tm} lots of ${sp} tenths.`, steps: [`${tm} lots of ${t1(sp)}: ${t1(sp)} × ${tm}`] },
              own, credit: [{ strand: 'dec', at: 60, weight: 0.5 }], facts: { form, sp, tm, d10, unit: 'second' },
            }, rand);
          }
          if (d10 % 10) continue;
          const d = d10 / 10, F = (v) => C(v, SEC);
          return ownOrder({
            key: 'rate:time:dec', story: `The Miner flies ${t1(sp)} kilometres a second. ${W.is} ${d} kilometres away.`, ask: 'How many seconds is the jump?', right: F(tm),
            slips: nearOf(t, tm, F, (x) => (x > tm ? `${x} seconds at ${t1(sp)} would be ${t1(x * sp)} kilometres, past ${W.name}.` : `${x} seconds at ${t1(sp)} is only ${t1(x * sp)} kilometres, short of ${W.name}.`)),
            rightWhy: `${d} ÷ ${t1(sp)} = ${tm}: ${tm} lots of ${t1(sp)} make ${d}`,
            // (the worked sheet shares whole numbers: both made ten times bigger, the answer the same)
            sum: { op: 'div', a: d10, b: sp, say: `Both ten times bigger, the answer the same: ${d10} ÷ ${sp}` },
            help: { title: 'How many fit', pic: { kind: 'trip', form: 'time', speed: t1(sp), total: d, step: SEC, to: W.key }, line: `Each second covers ${t1(sp)} kilometres. Count the seconds it takes to cover ${d}: ${t1(sp)}, ${t1(sp * 2)}, ${t1(sp * 3)} ...`, steps: [`How many ${t1(sp)}s fit in ${d}: the same as ${d10} ÷ ${sp}`] },
            own, credit: [{ strand: 'dec', at: 65, weight: 0.5 }], facts: { form, sp, tm, d10, unit: 'second', to: W.key },
          }, rand);
        }
        throw new Error('pilot rate: nothing made');
      }
      if (step === 5) {
        const own = { strand: 'ratio', at: 74 }, S = [20, 30, 40, 50, 60];
        for (let tries = 0; tries < 200; tries++) {
          const s1 = t.pick(S), s2 = t.pick(S), t1m = t.int(2, 6), t2m = t.int(2, 6), d1 = s1 * t1m, d2 = s2 * t2m;
          if (s1 === s2) continue;
          if (t.chance(0.5)) {
            // the time of two legs flown at two speeds
            const ans = t1m + t2m, mixed = (d1 + d2) / (s1 + s2);
            return ownOrder({
              key: 'rate:legs', story: `The Miner flies the first ${d1} kilometres at ${s1} kilometres a minute, then the last ${d2} kilometres at ${s2} kilometres a minute.`, ask: 'How many minutes is the whole trip?', right: C(ans, MIN),
              slips: [
                ...(Number.isInteger(mixed) && mixed !== ans ? [{ ...C(mixed, MIN), slip: 'mixed', why: `That shares all ${d1 + d2} kilometres over the two speeds added together. Each leg has its own speed: work out each leg's minutes.` }] : []),
                { ...C(t1m, MIN), slip: 'firstOnly', why: `${u(t1m, MIN)} is the first leg only. Add the second leg's.` },
                ...(t2m !== t1m ? [{ ...C(t2m, MIN), slip: 'secondOnly', why: `${u(t2m, MIN)} is the second leg only. Add the first leg's.` }] : []),
                { ...C(ans + 1, MIN), slip: 'off', why: `The legs take ${t1m} and ${t2m} minutes. Add them again.` },
                { ...C(ans - 1, MIN), slip: 'off', why: `The legs take ${t1m} and ${t2m} minutes. Add them again.` },
              ],
              rightWhy: `${d1} ÷ ${s1} = ${t1m} minutes and ${d2} ÷ ${s2} = ${t2m} minutes: ${t1m} + ${t2m} = ${u(ans, MIN)}`,
              sum: [{ op: 'div', a: d1, b: s1, say: 'First the first leg\'s minutes' }, { op: 'div', a: d2, b: s2, say: 'Then the second leg\'s minutes' }, { op: 'add', a: t1m, b: t2m, say: 'Then the two together' }],
              help: { title: 'Leg by leg', pic: { kind: 'legs', mode: 'time', d: [d1, d2], s: [s1, s2] }, line: 'Each leg has its own speed. Work out the minutes of each leg, then add them.', steps: [`First leg: ${d1} ÷ ${s1}`, `Second leg: ${d2} ÷ ${s2}`, 'Then add the two'] },
              own, credit: [{ strand: 'div', at: 34, weight: 0.5 }], facts: { form: 'legs', d: [d1, d2], s: [s1, s2], t: [t1m, t2m], ans }, size: 3,
            }, rand);
          }
          // the speed over the whole trip
          const dist = d1 + d2, time = t1m + t2m, avg = dist / time, mid = (s1 + s2) / 2;
          if (!Number.isInteger(avg) || avg === mid) continue;
          return ownOrder({
            key: 'rate:whole', story: `The Miner flew ${d1} kilometres in ${t1m} minutes, then ${d2} kilometres in ${t2m} minutes.`, ask: 'What was its speed over the whole trip, in kilometres a minute?', right: C(avg, KPM),
            slips: [
              ...(Number.isInteger(mid) ? [{ ...C(mid, KPM), slip: 'averaged', why: `That is half way between the two legs' speeds. The legs took different times: share all ${dist} kilometres over all ${time} minutes.` }] : []),
              { ...C(s1, KPM), slip: 'firstOnly', why: `${s1} kilometres a minute is the first leg's speed. The question is the whole trip's.` },
              { ...C(s2, KPM), slip: 'secondOnly', why: `${s2} kilometres a minute is the second leg's speed. The question is the whole trip's.` },
              { ...C(avg + 10, KPM), slip: 'off', why: `At ${avg + 10} kilometres a minute, ${time} minutes would cover ${(avg + 10) * time} kilometres, more than ${dist}.` },
            ],
            rightWhy: `${d1} + ${d2} = ${dist} kilometres in ${t1m} + ${t2m} = ${time} minutes: ${dist} ÷ ${time} = ${u(avg, KPM)}`,
            sum: [{ op: 'add', a: d1, b: d2, say: 'First all the kilometres' }, { op: 'add', a: t1m, b: t2m, say: 'Then all the minutes' }, { op: 'div', a: dist, b: time, say: 'Then the kilometres shared over the minutes' }],
            help: { title: 'The whole trip', pic: { kind: 'legs', mode: 'speed', d: [d1, d2], t: [t1m, t2m] }, line: 'The speed over the whole trip is all the kilometres shared over all the minutes.', steps: [`All the kilometres: ${d1} + ${d2}`, `All the minutes: ${t1m} + ${t2m}`, 'Then the kilometres ÷ the minutes'] },
            own, credit: [{ strand: 'div', at: 45, weight: 0.5 }], facts: { form: 'whole', d: [d1, d2], t: [t1m, t2m], s: [s1, s2], ans: avg }, size: 3,
          }, rand);
        }
        throw new Error('pilot rate: no two legs made');
      }
      // seconds into minutes
      const own = { strand: 'ratio', at: 78 }, sp = t.pick([2, 4, 5, 6, 8, 10]), m = t.int(2, 9), secs = m * 60, d = sp * secs;
      if (t.chance(0.55)) {
        return ownOrder({
          key: 'rate:minutes', story: `${W.is} ${say(d)} kilometres away. The Miner flies ${sp} kilometres a second.`, ask: 'How many minutes is the trip?', right: C(m, MIN),
          slips: [
            { ...C(secs, MIN), slip: 'unitLeft', why: `${say(secs)} is the seconds. 60 seconds make one minute: ${say(secs)} ÷ 60.` },
            { ...C(sp * m, MIN), slip: 'speedLeft', why: `That shares the kilometres into 60s and leaves the speed out. First the seconds: ${say(d)} ÷ ${sp}.` },
            { ...C(m + 1, MIN), slip: 'off', why: `${m + 1} minutes is ${(m + 1) * 60} seconds: at ${sp} kilometres a second that is ${say((m + 1) * 60 * sp)} kilometres, past ${W.name}.` },
            { ...C(m - 1, MIN), slip: 'off', why: `${m - 1} ${m - 1 === 1 ? 'minute is' : 'minutes are'} ${(m - 1) * 60} seconds: at ${sp} kilometres a second that is only ${say((m - 1) * 60 * sp)} kilometres.` },
          ],
          rightWhy: `${say(d)} ÷ ${sp} = ${say(secs)} seconds, and ${say(secs)} ÷ 60 = ${u(m, MIN)}`,
          sum: [{ op: 'div', a: d, b: sp, say: 'First the seconds' }, { op: 'div', a: secs, b: 60, say: 'Then the minutes: 60 seconds make one' }],
          help: { title: 'Seconds, then minutes', pic: { kind: 'convert', mode: 'minutes', d, sp }, line: `Two sums: the seconds the trip takes (${say(d)} ÷ ${sp}), then those seconds made into minutes, 60 to a minute.`, steps: [`First the seconds: ${say(d)} ÷ ${sp}`, 'Then the minutes: that ÷ 60'] },
          own, credit: [{ strand: 'time', at: 50, weight: 0.5 }], facts: { form: 'minutes', sp, m, secs, d, to: W.key }, size: 2,
        }, rand);
      }
      return ownOrder({
        key: 'rate:far', story: `The Miner flies ${sp} kilometres a second. The trip ${W.to} takes ${u(m, MIN)}.`, ask: 'How many kilometres is the trip?', right: C(d, KM),
        slips: [
          { ...C(sp * m, KM), slip: 'unitLeft', why: `That takes the ${m} minutes for seconds. ${u(m, MIN)} are ${say(secs)} seconds.` },
          { ...C(secs, KM), slip: 'speedLeft', why: `${say(secs)} is the seconds in ${u(m, MIN)}. Every second covers ${sp} kilometres.` },
          { ...C(sp * 60, KM), slip: 'one', why: `${say(sp * 60)} kilometres is one minute's flying. The trip takes ${m} minutes.` },
          { ...C(sp * 60 * (m + 1), KM), slip: 'groupOff', why: `That is ${m + 1} minutes' flying. The trip takes ${m}.` },
        ],
        rightWhy: `${m} × 60 = ${say(secs)} seconds, and ${say(secs)} × ${sp} = ${say(d)} kilometres`,
        sum: [{ op: 'mul', a: m, b: 60, say: 'First the seconds: 60 in each minute' }, { op: 'mul', a: secs, b: sp, say: `Then the kilometres: ${sp} in every second` }],
        help: { title: 'Minutes, then seconds', pic: { kind: 'convert', mode: 'far', m, sp }, line: `Two sums: the seconds in ${u(m, MIN)} (60 in each), then ${sp} kilometres for every second.`, steps: [`First the seconds: ${m} × 60`, `Then the kilometres: that × ${sp}`] },
        own, credit: [{ strand: 'time', at: 50, weight: 0.5 }], facts: { form: 'far', sp, m, secs, d, to: W.key }, size: 2,
      }, rand);
    },
  },

  // ── distances in tenths of a kilometre ───────────────────────────────────────────────────────────────────────
  // step 1  adding and taking away: 2.5 kilometres and 1.8 more; 6.2 kilometres with 3.7 flown
  tenths: {
    strand: 'dec', at: () => 50,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), W = destOf(live, t);
      for (let tries = 0; tries < 80; tries++) {
        const a = t.int(12, 79), b = t.int(6, 49);   // tenths
        if (a % 10 === 0 || b % 10 === 0 || a === b) continue;
        if (t.chance(0.55)) {
          const s = a + b, parts = (a % 10) + (b % 10), wholes = Math.floor(a / 10) + Math.floor(b / 10);
          return ownOrder({
            key: 'tenths:add', story: `The first jump is ${t1(a)} kilometres and the second jump is ${t1(b)} kilometres.`, ask: 'How many kilometres is that in all?', right: D(s * 10),
            slips: [
              ...(parts >= 10 ? [{ ...D(wholes * 100 + parts), slip: 'wholeParts', why: `${a % 10} tenths and ${b % 10} tenths make ${parts} tenths, and 10 tenths are another whole kilometre: carry it.` }] : []),
              { ...D(Math.abs(a - b) * 10), slip: 'subtracted', why: 'That takes one from the other. Both jumps count: add them.' },
              { ...D((s + 1) * 10), slip: 'off', why: 'One tenth too many. Line the points up and add each column.' },
              { ...D((s - 1) * 10), slip: 'off', why: 'One tenth short. Line the points up and add each column.' },
              { ...D(s * 100), slip: 'pointLost', why: `${a} + ${b} = ${s}, but those are tenths of a kilometre: ${s} tenths.` },
            ],
            pic: { kind: 'columns', rows: [dec(a, 1), dec(b, 1)], op: '+' },
            rightWhy: `${dec(a, 1)} + ${dec(b, 1)} = ${t1(s)} kilometres`, sum: { op: 'add', a: a / 10, b: b / 10 },
            own: { strand: 'dec', at: 50 }, credit: [], facts: { a, b, op: '+', ans: s },
          }, rand);
        }
        if (a <= b + 1) continue;
        const d = a - b, borrow = a % 10 < b % 10, digitwise = Math.abs(Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs((a % 10) - (b % 10));
        return ownOrder({
          key: 'tenths:left', story: `${W.is} ${t1(a)} kilometres away. The Miner has flown ${t1(b)} kilometres of the way.`, ask: 'How many kilometres are still to go?', right: D(d * 10),
          slips: [
            ...(borrow && digitwise !== d ? [{ ...D(digitwise * 10), slip: 'smallerFromBigger', why: `In the tenths the smaller digit was taken from the bigger. ${a % 10} tenths is less than ${b % 10} tenths: borrow a whole kilometre.` }] : []),
            { ...D((a + b) * 10), slip: 'added', why: 'Flying part of the way leaves less to go: take away.' },
            { ...D((d + 1) * 10), slip: 'off', why: 'One tenth too many. Line the points up and take away each column.' },
            { ...D((d > 1 ? d - 1 : d + 2) * 10), slip: 'off', why: 'Line the points up and take away each column again.' },
            { ...D(b * 10), slip: 'part', why: `${t1(b)} kilometres is what it has flown. The question is what is still to go.` },
          ],
          pic: { kind: 'columns', rows: [dec(a, 1), dec(b, 1)], op: '−' },
          rightWhy: `${dec(a, 1)} − ${dec(b, 1)} = ${t1(d)} kilometres`, sum: { op: 'sub', a: a / 10, b: b / 10 },
          own: { strand: 'dec', at: 50 }, credit: [], facts: { a, b, op: '−', ans: d, to: W.key },
        }, rand);
      }
      throw new Error('pilot tenths: nothing made');
    },
  },
};

// ── the ladder: easiest first, every step small ──────────────────────────────────────────────────────────────────
// (lamp: the jump's lamp an Ask suits, for pickAsk: 'distance' how far, 'charge' the fuel cells, 'go' how long or fast)
const K = (step, w = 1, lamp = 'charge') => ({ maker: 'wordsK', step, w, lamp });
const W = (step, types, w = 1) => ({ maker: 'words', step, types, w });
const M = (maker, step, w = 1, lamp = null) => ({ maker, step, w, ...(lamp ? { lamp } : {}) });

export const PLACE = {
  id: 'pilot', name: 'The pilot\'s seat', short: 'Pilot', math: 'Jump distances and times: hops, equal jumps, speeds, minutes', pic: 'pilot', job: null,
  line: 'The jump computer on a captain\'s run: hops to count, jumps of the same length, a distance shared out, and how far, how fast and how long.',
  levels: [
    { id: 'kHops', title: 'Counting the hops', line: 'Up to 5: the hops to the rocks; fuel cells and 1 more', gen: { mix: [M('hops', 1, 2, 'distance'), K(1)] } },
    { id: 'kMore', title: 'Hops in all, hops left', line: 'Up to 10: 3 hops to the beacon and 2 more; 7 hops, 3 made', gen: { mix: [M('hops', 2, 2, 'distance'), K(2)] } },
    { id: 'kPast', title: 'Past ten, beacon by beacon', line: 'At beacon 8, 5 more hops; 8 fuel cells and 5 more', gen: { mix: [M('hops', 3, 2, 'distance'), K(3)] } },
    { id: 'kEqual', title: 'Equal jumps', line: '3 jumps of 5 kilometres', strand: 'words', gen: { mix: [M('hops', 4, 2, 'distance'), K(3)] } },
    { id: 'jumps', title: 'Jumps and totals', line: '4 jumps of 6 kilometres; 15 kilometres and 18 more', gen: { mix: [W(1, ['groups', 'parts'])] } },
    { id: 'share', title: 'Sharing a distance out', line: '24 kilometres in 4 equal jumps', gen: { mix: [W(2, ['share'], 2), W(1, ['groups'])] } },
    { id: 'speed', title: 'Speed and time: how far', line: '6 kilometres a second for 5 seconds', gen: { mix: [M('rate', 1, 2, 'distance'), W(2, ['share'])] } },
    { id: 'fast', title: 'How fast, how long', line: '45 kilometres in 9 seconds; 40 kilometres at 8 kilometres a second', gen: { mix: [M('rate', 2, 2, 'go'), M('rate', 1, 1, 'distance')] } },
    { id: 'minutes', title: 'Bigger trips, by the minute', line: '360 kilometres at 40 kilometres a minute', gen: { mix: [M('rate', 3, 2), M('rate', 2, 1, 'go')] } },
    { id: 'tenths', title: 'Distances in tenths', line: '2.5 kilometres and 1.8 more; 6.2 kilometres with 3.7 flown', gen: { mix: [M('tenths', 1, 2, 'distance'), M('rate', 3)] } },
    { id: 'cells', title: 'Whole fuel cells', line: '50 units of charge, 12 to a fuel cell: 5 cells', gen: { mix: [W(7, ['share'], 2), M('rate', 3)] } },
    { id: 'table', title: 'Fuel by the jump', line: '3 fuel cells for every 2 jumps; for 10 jumps?', gen: { mix: [M('ratio', 3, 2, 'charge'), M('rate', 3)] } },
    { id: 'decSpeed', title: 'Speeds with tenths', line: '7.5 kilometres a second for 4 seconds; 30 kilometres at 7.5 a second', gen: { mix: [M('rate', 4, 2), M('ratio', 3, 1, 'charge')] } },
    { id: 'prop', title: 'Proportions', line: '3 of every 4 kilometres on the jump drive; of 20 kilometres?', gen: { mix: [M('ratio', 5, 2), M('rate', 4)] } },
    { id: 'legs', title: 'Two legs, one trip', line: '120 kilometres at 40 a minute, then 90 at 30; the speed over the whole trip', gen: { mix: [M('rate', 5, 2, 'go'), M('ratio', 5)] } },
    { id: 'minsec', title: 'Seconds into minutes', line: '2,400 kilometres at 8 kilometres a second: how many minutes?', gen: { mix: [M('rate', 6, 2, 'go'), M('rate', 5)] } },
  ],
};

// the card for the lamp being lit: one of the level's that suits it, by weight (not the one asked last when there is
// another); none suits: null, and the level's own pick is used (engine.js make)
export function pickAsk(mix, { rand = Math.random, last = null, live = null } = {}) {
  const lamp = live && live.lamp;
  if (!lamp) return null;
  const suits = mix.filter((a) => a.lamp === lamp);
  if (!suits.length) return null;
  const same = (a, b) => !!(a && b && a.maker === b.maker && a.step === b.step);
  const use = suits.length > 1 && last && suits.some((a) => !same(a, last)) ? suits.filter((a) => !same(a, last)) : suits;
  let r = rand() * use.reduce((s, a) => s + (a.w ?? 1), 0);
  for (const a of use) { if ((r -= a.w ?? 1) <= 0) return a; }
  return use[use.length - 1];
}

export const JOB = {
  // (not one of the station's job spots, src/jobs/index.js JOBS: its seat is aboard a captain's ship, and its cards
  // come up on the run, src/trip.js. Its levels are on the crew screen's list with the others': src/ui/title.js)
  id: 'pilot', name: 'Jump computer', short: 'Pilot', open: true, pickAsk, seated: true,
  spot: null, sign: 'Pilot\'s seat', hint: 'Work out the jump',
  place: PLACE, setting: SETTING, makers: MAKERS,
  card: 'jump',
};
