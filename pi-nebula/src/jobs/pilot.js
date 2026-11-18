// THE PILOT'S SEAT: the jump computer's math, for a crew member who signs on as a captain's pilot (src/missions.js; the
// game's maker, 2026-11-17: "if you are the pilot then you take the ship out of the hanger, then calculate a jump
// (with maybe 3 questions)"). One ladder like every job's, kids to grown-ups, and EVERY CARD IS ABOUT NAVIGATING (the
// game's maker: "it would be awesome if we can make all the math relative to the navigation in some way ... I think
// it will be fun to see how math can be actually applied"). The asteroid field is in the planet's rings; the map shows
// the planet in the middle with its rings round it. Easiest first:
//   the hops to the field, counted on the jump computer's picture of the way; fuel against the way (3 units away,
//   fuel for 5; there and back; "can we get there and back?"); past ten along the numbered beacons; equal jumps;
//   jumps, fuel and totals; a distance shared out into equal jumps; points on the map, one quarter of it; headings
//   and turns; speed and time (how far, how fast, how long); the sensor's angle; bigger trips by the minute; the whole
//   map, with negatives; round the compass; fuel by the jump; a course round the rings; two legs; seconds into
//   minutes; and at the top "which is the right way to work it out": four diagrams, each with its equation, for the
//   right triangle and for a rock's length from its angle and distance, the ship's computer doing the arithmetic.
// Kilometres, seconds, minutes, degrees and plain units throughout; decimals stay decimals.
// Mathwood Valley's question makers tell the stories of jumps of the same length, totals, what is left, a distance
// shared out and the ratio tables through SETTING (engine.js). The hops, the fuel against the way, the map, the
// headings, the speeds and times and the "which sum fits" cards are this job's own makers (MAKERS below): Mathwood's
// speed stories are told with wagons in miles and have no hook for another world, and it has no maps or headings.
// A POINT ON THE MAP is answered by picking, of four small maps, the one with the field marked in the right place (or
// by reading the point off the map on the card). A tap on one big map is the better answer and is not built yet:
// ~/pw/space-math/MINING_1.md says what it would take.
//
// THE JUMP'S THREE LAMPS (distance, charge, go: src/trip.js): a jump is three cards. Where a level has a card that
// suits the lamp being lit (an Ask's `lamp`), that one is dealt: where and how far for DISTANCE, the fuel for CHARGE,
// the heading and the time for GO; where it has none, any card of the level (pickAsk).
// WHERE TO: on a trip the cards that name a place say where the jump is going (`live.to`: 'field' on the way out,
// 'home' on the way back); from the levels page, either.
import { dec } from '../../../mathwood-valley/src/math/counterkit.js';
import { ownOrder } from './engine.js';
import { navMap, methodPic } from './pics.js';

const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
const say = (n) => Number(n).toLocaleString('en-US');
const KM = ['kilometre', 'kilometres'], SEC = ['second', 'seconds'], MIN = ['minute', 'minutes'], HOP = ['hop', 'hops'], CELL = ['fuel cell', 'fuel cells'];
const KPS = ['kilometre a second', 'kilometres a second'], KPM = ['kilometre a minute', 'kilometres a minute'];

// who is aboard (Mathwood's FOLK shape): the Miner's crew
const FOLK = [{ name: 'Pilot Juno', she: true }, { name: 'Captain Ruiz', she: false }, { name: 'Miner Kestrel', she: true }, { name: 'Engineer Okafor', she: false }];

export const SETTING = {
  folk: FOLK,
  groups: [
    { key: 'jumps', item: ['jump', 'jumps'], unit: KM, story: ({ a, b }) => `The way ahead is ${a} jumps, and each jump is ${b} kilometres long.`, ask: () => 'How many kilometres is the way ahead?' },
    { key: 'cells', item: ['jump', 'jumps'], unit: CELL, story: ({ a, b }) => `The trip is ${a} jumps. The jump drive burns ${b} fuel cells on every jump.`, ask: () => 'How many fuel cells does the trip need?' },
  ],
  share: [
    { key: 'legs', thing: KM, box: ['jump', 'jumps'], story: ({ total, groups }) => `The way ahead is ${total} kilometres. The jump drive covers it in ${groups} jumps, all the same length.`, ask: 'How many kilometres is each jump?' },
    { key: 'cells', thing: CELL, box: ['jump', 'jumps'], story: ({ total, groups }) => `The Miner carries ${total} fuel cells for ${groups} jumps, the same number for each jump.`, ask: 'How many fuel cells are there for each jump?' },
    { key: 'minutes', thing: MIN, box: ['jump', 'jumps'], story: ({ total, groups }) => `The whole trip takes ${total} minutes, in ${groups} jumps that each take the same time.`, ask: 'How many minutes does each jump take?' },
  ],
  partsLeft: [
    { key: 'toGo', unit: KM, story: ({ a, b }) => `The way ahead was ${a} kilometres. The Miner has flown ${b} kilometres of it.`, ask: 'How many kilometres are still to go?' },
    { key: 'cellsLeft', unit: CELL, story: ({ a, b }) => `The Miner set out with ${a} fuel cells. Its jumps so far have used ${b} of them.`, ask: 'How many fuel cells are left?' },
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

  // ── THE FUEL AGAINST THE WAY (the youngest: the game's maker's "The asteroid field is 3 units away and we have enough
  // fuel for 8 units. Can we get there and back?"). The fuel and the way are drawn on the card, a box a unit. ──────
  // step 1  fuel left when we get there: 3 units away, fuel for 5
  // step 2  there and back: 3 units away, how many units for the round trip
  // step 3  can we get there and back: 3 units away, fuel for 8 (yes, 2 to spare; yes, none to spare; no, 2 short)
  fuel: {
    strand: 'number', at: (step) => [4, 10, 14][Math.max(1, Math.min(3, step)) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand), UNIT = ['unit', 'units'];
      if (step <= 1) {
        const out = t.int(1, 4), fuel = out + t.int(1, 5 - Math.min(out, 4) + 2), left = fuel - out;
        return ownOrder({
          key: 'fuel:left', story: `The asteroid field is ${u(out, UNIT)} away. We have fuel for ${u(fuel, UNIT)}.`, ask: 'How many units of fuel are left when we get there?',
          right: C(left, UNIT),
          slips: [
            { ...C(out, UNIT), slip: 'taken', why: `${out} is what the way there burns. Count the fuel that is left over.` },
            { ...C(fuel, UNIT), slip: 'all', why: `${fuel} is all our fuel. The way there burns ${out} of it.` },
            { ...C(left + 1, UNIT), slip: 'off', why: 'One too many. Match each box of the way to a box of fuel, and count the fuel left over.' },
            { ...C(fuel + out, UNIT), slip: 'added', why: 'Flying burns fuel: there is less left, not more.' },
          ],
          rightWhy: `${fuel} take away ${out} leaves ${u(left, UNIT)}`, sum: { op: 'sub', a: fuel, b: out },
          picFirst: true, help: { title: 'Fuel against the way', pic: { kind: 'fuel', fuel, out, ask: 'how many boxes of fuel are left over?' }, line: 'Every unit of the way burns one unit of fuel. Match them up and count the fuel left over.' },
          own: { strand: 'number', at: 4 }, credit: [{ strand: 'sub', at: 5, weight: 0.5 }], facts: { kind: 'left', out, fuel, ans: left },
        }, rand, 3);
      }
      if (step === 2) {
        const out = t.int(2, 6), ans = out * 2;
        return ownOrder({
          key: 'fuel:back', story: `The asteroid field is ${u(out, UNIT)} away. We fly there, and then we fly home again.`, ask: 'How many units is the trip there and back?',
          right: C(ans, UNIT),
          slips: [
            { ...C(out, UNIT), slip: 'one', why: `${out} units is only the way there. We have to come home too.` },
            { ...C(ans + 1, UNIT), slip: 'off', why: `One too many. The way there is ${out}, and the way back is ${out} more.` },
            { ...C(ans - 1, UNIT), slip: 'off', why: `One short. The way there is ${out}, and the way back is ${out} more.` },
            { ...C(out + 2, UNIT), slip: 'added', why: `That adds 2 for the two ways. Each way is ${out} units: ${out} and ${out} more.` },
          ],
          rightWhy: `${out} there and ${out} back make ${u(ans, UNIT)}`, sum: { op: 'add', a: out, b: out },
          picFirst: true, help: { title: 'There and back', pic: { kind: 'fuel', out, back: true, ask: 'how many boxes, there and back?' }, line: `The way back is as long as the way there: ${out} and ${out} more.` },
          own: { strand: 'number', at: 10 }, credit: [{ strand: 'add', at: 8, weight: 0.5 }], facts: { kind: 'back', out, ans },
        }, rand, 3);
      }
      // can we get there and back? (the answer says by how much)
      const out = t.int(2, 6), need = out * 2, spare = t.pick([-3, -2, -1, 0, 1, 2, 3, 4]), fuel = Math.max(out + 1, need + spare), d = fuel - need;
      const F = (v) => ({ v: v + 100, big: v >= 0 ? 'Yes' : 'No', small: v > 0 ? `${u(v, UNIT)} to spare` : v === 0 ? 'with none to spare' : `${u(-v, UNIT)} short`, label: v > 0 ? `Yes, with ${u(v, UNIT)} to spare` : v === 0 ? 'Yes, with none to spare' : `No, we are ${u(-v, UNIT)} short` });
      const oneWay = fuel - out;      // (the slip: only the way there counted)
      return ownOrder({
        key: 'fuel:can', story: `The asteroid field is ${u(out, UNIT)} away, and we have fuel for ${u(fuel, UNIT)}.`, ask: 'Can we get there and back?',
        right: F(d),
        slips: [
          ...(oneWay !== d ? [{ ...F(oneWay), slip: 'one', why: `That counts only the way there. There and back is ${out} and ${out} more: ${need} units.` }] : []),
          { ...F(-d || 2), slip: 'swapped', why: `There and back is ${need} units, and we have fuel for ${fuel}. ${fuel >= need ? 'That is enough.' : 'That is not enough.'}` },
          { ...F(d + 1), slip: 'off', why: `There and back is ${need} units. Set that against our ${fuel} units of fuel again.` },
          { ...F(d - 1), slip: 'off', why: `There and back is ${need} units. Set that against our ${fuel} units of fuel again.` },
        ],
        rightWhy: `There and back is ${out} + ${out} = ${need} units. We have ${fuel}: ${d > 0 ? `${u(d, UNIT)} to spare` : d === 0 ? 'just enough' : `${u(-d, UNIT)} short`}`,
        sum: [{ op: 'add', a: out, b: out, say: 'First the way there and back' }, d >= 0 ? { op: 'sub', a: fuel, b: need, say: 'Then the fuel left over' } : { op: 'sub', a: need, b: fuel, say: 'Then how much fuel is missing' }],
        picFirst: true, help: { title: 'Fuel against the way', pic: { kind: 'fuel', fuel, out, back: true, ask: 'is there a box of fuel for every box of the way?' }, line: `There and back is ${out} and ${out} more. Match every unit of the way to a unit of fuel.`, steps: [`First there and back: ${out} + ${out}`, 'Then set it against the fuel'] },
        own: { strand: 'words', at: 14 }, credit: [{ strand: 'add', at: 10, weight: 0.5 }], facts: { kind: 'can', out, fuel, need, ans: d }, size: 2,
      }, rand, 3);
    },
  },

  // ── POINTS ON THE MAP (the game's maker: "We have authorization to mine at -8, 3, can you plot that on our map? And it
  // can show the planet in the middle with the rings around it. Or if it is on the far side of the planet it could be
  // a 2 step problem to plot a course around the rings"). A point is found by picking the map that has it marked (four
  // small maps), or read off the map on the card. ─────────────────────────────────────────────────────────────────
  // step 1  one quarter of the map: (4, 3)
  // step 2  the whole map, with negatives: (-8, 3)
  // step 3  a course round the rings to a field on the planet's far side: how long is it
  plot: {
    strand: 'geo', at: (step) => [30, 50, 62][Math.max(1, Math.min(3, step)) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand);
      if (step >= 3) {
        const a = t.int(5, 8), b = t.int(5, 8), h = t.int(4, 6), across = a + b, ans = across + 2 * h, UNIT = ['unit', 'units'];
        const course = [[-a, 0], [-a, h], [b, h], [b, 0]], pts = [{ x: -a, y: 0, kind: 'ship', label: 'us' }, { x: b, y: 0, kind: 'field', label: 'field' }];
        const signSlip = Math.abs(b - a) + 2 * h;
        return ownOrder({
          key: 'plot:course', story: `We are at (${-a}, 0). The field is on the far side of the planet, at (${b}, 0), and nobody flies through the rings. Our course goes round them: up to (${-a}, ${h}), across to (${b}, ${h}), and down to the field.`, ask: 'How many units long is the course?',
          right: C(ans, UNIT),
          slips: [
            { ...C(across, UNIT), slip: 'straight', why: `${across} units is the straight line through the rings. The course goes up ${h}, across, and down ${h}.` },
            ...(signSlip !== ans && signSlip > 0 ? [{ ...C(signSlip, UNIT), slip: 'sign', why: `From ${-a} to ${b} is not ${Math.abs(b - a)}: it is ${a} units to 0 and ${b} more beyond it, ${across} in all.` }] : []),
            { ...C(across + h, UNIT), slip: 'oneLeg', why: `That counts the way up but not the way down. Up ${h}, across ${across}, down ${h}.` },
            { ...C(ans + 1, UNIT), slip: 'off', why: `Up ${h}, across from ${-a} to ${b}, down ${h}. Add the three legs again.` },
          ],
          rightWhy: `Up ${h}, across ${a} + ${b} = ${across}, down ${h}: ${h} + ${across} + ${h} = ${u(ans, UNIT)}`,
          sum: [{ op: 'add', a, b, say: `First across: from ${-a} to 0, and on to ${b}` }, { op: 'add', a: across, b: h, say: 'Then the way up' }, { op: 'add', a: across + h, b: h, say: 'Then the way down' }],
          lead: navMap({ hi: 9, quad: 4, points: pts, course, size: 190, ask: 'the course: ? units' }),
          help: { title: 'Leg by leg', pic: { kind: 'map', hi: 9, quad: 4, points: pts, course, ask: `up ${h}, across ?, down ${h}` }, line: `Three legs. The one across goes from ${-a} to ${b}: count the units to 0, then the units beyond it.`, steps: [`Across: ${a} + ${b}`, `Up and down: ${h} and ${h} more`, 'Then add the legs'] },
          own: { strand: 'geo', at: 62 }, credit: [{ strand: 'add', at: 30, weight: 0.5 }], facts: { form: 'course', a, b, h, ans }, size: 3,
        }, rand);
      }
      const whole = step === 2, hi = whole ? 9 : 7, quad = whole ? 4 : 1;
      let x = 1, y = 2;
      for (let tries = 0; tries < 60; tries++) {
        x = whole ? t.int(-8, 8) : t.int(1, 6); y = whole ? t.int(-8, 8) : t.int(1, 6);
        if (Math.abs(x) !== Math.abs(y) && x !== 0 && y !== 0 && (!whole || (Math.max(Math.abs(x), Math.abs(y)) >= 4 && (x < 0 || y < 0)))) break;
      }
      const said = (p) => `(${p[0]}, ${p[1]})`, here = [x, y];
      // the slips children make: across and up swapped; a sign lost; one off along a line
      const wrongs = whole
        ? [[[y, x], 'swapped', 'the first number is how far across (left is minus), the second how far up (down is minus)'], [[-x, y], 'sign', `the first number is ${x}: ${x < 0 ? 'minus means left of the planet' : 'no minus means right of the planet'}`], [[x, -y], 'sign', `the second number is ${y}: ${y < 0 ? 'minus means below the planet' : 'no minus means above the planet'}`], [[-x, -y], 'sign', 'both signs are turned round there']]
        : [[[y, x], 'swapped', 'the first number is how far across, the second how far up'], [[x + 1 > 6 ? x - 1 : x + 1, y], 'off', `count ${x} lines across from the planet`], [[x, y + 1 > 6 ? y - 1 : y + 1], 'off', `count ${y} lines up from the planet`]];
      const pt = (p) => [{ x: p[0], y: p[1], kind: 'field' }];
      if (t.chance(0.5)) {
        // which map has it marked
        const M = (p) => ({ v: said(p), big: said(p), small: '', label: `the map with the field at ${said(p)}`, svg: navMap({ hi, quad, points: pt(p), size: 132, numbers: true }) });
        return ownOrder({
          key: `plot:mark:${whole ? 'whole' : 'quarter'}`, story: `We have authorization to mine at ${said(here)}. The planet is at (0, 0).`, ask: 'Which map has the field marked in the right place?',
          right: M(here), slips: wrongs.map(([p, slip, why]) => ({ ...M(p), slip, why: `That map has it at ${said(p)}: ${why}.` })),
          rightWhy: `${said(here)}: ${Math.abs(x)} ${x < 0 ? 'to the left' : 'across'}, then ${Math.abs(y)} ${y < 0 ? 'down' : 'up'}`,
          help: { title: 'Across, then up', pic: { kind: 'map', hi, quad, points: [], ask: `${said(here)}: ${Math.abs(x)} ${x < 0 ? 'left' : 'across'}, ${Math.abs(y)} ${y < 0 ? 'down' : 'up'}. Where?` }, line: `Start at the planet, (0, 0). The first number is how far across${whole ? ' (minus: to the left)' : ''}; the second is how far up${whole ? ' (minus: down)' : ''}.`, steps: [`Across: ${x}`, `Then up: ${y}`] },
          own: { strand: 'geo', at: whole ? 50 : 30 }, facts: { form: 'mark', x, y, whole }, size: 1,
        }, rand);
      }
      // read it off the map
      const T2 = (p) => ({ v: said(p), big: said(p), small: '', label: said(p) });
      return ownOrder({
        key: `plot:read:${whole ? 'whole' : 'quarter'}`, story: 'The scan has found an asteroid field. It is marked on our map. The planet is at (0, 0).', ask: 'Where is the field?',
        right: T2(here), slips: wrongs.map(([p, slip, why]) => ({ ...T2(p), slip, why: `Not ${said(p)}: ${why}.` })),
        rightWhy: `${Math.abs(x)} ${x < 0 ? 'to the left' : 'across'} and ${Math.abs(y)} ${y < 0 ? 'down' : 'up'}: ${said(here)}`,
        lead: navMap({ hi, quad, points: pt(here), size: 190, ask: 'the field is at (?, ?)' }),
        help: { title: 'Across, then up', pic: { kind: 'map', hi, quad, points: pt(here), ask: 'across first, then up: (?, ?)' }, line: `Count the lines from the planet across to the field${whole ? ' (to the left is minus)' : ''}: that is the first number. Then count up${whole ? ' (down is minus)' : ''}: the second.`, steps: ['First how far across', 'Then how far up'] },
        own: { strand: 'geo', at: whole ? 50 : 30 }, facts: { form: 'read', x, y, whole }, size: 1,
      }, rand);
    },
  },

  // ── HEADINGS AND TURNS (the game's maker: "Our sensor array picked up a signal for a dense field 30 degrees to its
  // right. The sensor is pointed 45 degrees to the left of our nose. How many degrees must we change our heading?") ──
  // step 1  a turn between two headings: nose at 40°, the field at 70°; a new heading after a turn
  // step 2  the sensor's angle and the signal's: 30° right of a sensor pointed 45° left of the nose
  // step 3  round the compass: past 360°, and the heading for home (the other way round)
  heading: {
    strand: 'geo', at: (step) => [34, 46, 56][Math.max(1, Math.min(3, step)) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand), DEG = (v, small = 'degrees') => ({ v, big: `${v}°`, small, label: `${v} degrees${small === 'degrees' ? '' : ' ' + small}` });
      if (step <= 1) {
        const now = t.int(1, 12) * 10, turn = t.int(2, 12) * 5, to = now + turn;
        if (t.chance(0.5)) {
          return ownOrder({
            key: 'heading:turn', story: `Our nose points at ${now}° on the compass. The asteroid field is at ${to}°.`, ask: 'How many degrees must we turn to point at it?',
            right: DEG(turn),
            slips: [
              { ...DEG(to + now), slip: 'added', why: `That adds the two headings. The turn is the gap between them: from ${now}° round to ${to}°.` },
              { ...DEG(to), slip: 'bigger', why: `${to}° is where the field is. We are at ${now}° already: the turn is only the gap.` },
              { ...DEG(turn + 10), slip: 'off', why: `From ${now}° a turn of ${turn + 10}° would end at ${to + 10}°, past the field.` },
              { ...DEG(turn > 10 ? turn - 10 : turn + 5), slip: 'off', why: `From ${now}° that turn would not end at ${to}°.` },
            ],
            rightWhy: `${to}° − ${now}° = a turn of ${turn}°`, sum: { op: 'sub', a: to, b: now },
            help: { title: 'The gap between two headings', pic: { kind: 'compass', rose: true, lines: [{ deg: now, label: `our nose: ${now}°`, colour: 'ship' }, { deg: to, label: `the field: ${to}°`, colour: 'ask', dash: true }], ask: `from ${now}° round to ${to}°: ? degrees` }, line: `The turn is the gap between where the nose points and where the field is: ${to} − ${now}.`, steps: [`The gap: ${to} − ${now}`] },
            own: { strand: 'geo', at: 34 }, credit: [{ strand: 'sub', at: 22, weight: 0.5 }], facts: { form: 'turn', now, to, ans: turn },
          }, rand);
        }
        return ownOrder({
          key: 'heading:new', story: `Our nose points at ${now}° on the compass. The captain calls a turn of ${turn}° to the right.`, ask: 'What is our heading after the turn?',
          right: DEG(to),
          slips: [
            ...(now - turn > 0 ? [{ ...DEG(now - turn), slip: 'subtracted', why: 'On the compass a turn to the right makes the heading bigger. That is a turn to the left.' }] : []),
            { ...DEG(turn), slip: 'new', why: `${turn}° is the turn. We started at ${now}°, not at 0°.` },
            { ...DEG(to + 10), slip: 'off', why: `${now} and ${turn} more do not make ${to + 10}.` },
            { ...DEG(to - 10), slip: 'off', why: `${now} and ${turn} more do not make ${to - 10}.` },
          ],
          rightWhy: `${now}° + ${turn}° = ${to}°`, sum: { op: 'add', a: now, b: turn },
          help: { title: 'A turn to the right', pic: { kind: 'compass', rose: true, lines: [{ deg: now, label: `our nose: ${now}°`, colour: 'ship' }, { deg: to, label: `after ${turn}° right: ?`, colour: 'ask', dash: true }], ask: `${now}° and ${turn}° more: ?` }, line: `The compass counts up to the right. A turn of ${turn}° to the right adds ${turn} to the heading.`, steps: [`${now} + ${turn}`] },
          own: { strand: 'geo', at: 34 }, credit: [{ strand: 'add', at: 22, weight: 0.5 }], facts: { form: 'new', now, turn, ans: to },
        }, rand);
      }
      if (step === 2) {
        // the sensor is pointed s off the nose, and the signal is g off the sensor (each left or right): the turn is the two together
        let s = 45, g = 30, ss = -1, gs = 1;
        for (let tries = 0; tries < 40; tries++) { s = t.int(4, 16) * 5; g = t.int(2, 12) * 5; ss = t.chance(0.5) ? -1 : 1; gs = t.chance(0.6) ? -ss : ss; if (s !== g && ss * s + gs * g !== 0 && Math.abs(ss * s + gs * g) <= 120) break; }
        const net = ss * s + gs * g, side = (v) => (v < 0 ? 'left' : 'right'), same = ss === gs;
        const T = (v) => DEG(Math.abs(v), `to the ${side(v)}`), other = same ? ss * Math.abs(s - g) || ss * 5 : ss * (s + g);
        const cand = [[-net, 'swapped', `The signal is to the ${side(net)} of our nose, not the ${side(-net)}. Follow the sensor's ${s}° to the ${side(ss)}, then the signal's ${g}° to the ${side(gs)}.`],
          [other, same ? 'subtracted' : 'added', same ? `Both angles are to the ${side(ss)}: they add up.` : `The sensor points ${side(ss)} and the signal is back to its ${side(gs)}: one takes away from the other.`],
          [-other, same ? 'subtracted' : 'added', same ? `Both angles are to the ${side(ss)}: they add up, and the turn is to the ${side(ss)}.` : `One angle is to the left and one to the right: one takes away from the other.`],
          [ss * s, 'one', `${s}° to the ${side(ss)} is where the sensor points. The signal is ${g}° to the ${side(gs)} of that.`]];
        return ownOrder({
          key: `heading:sensor:${same ? 'same' : 'across'}`, story: `Our sensor array picked up a signal from a dense field, ${g} degrees to its ${side(gs)}. The sensor is pointed ${s} degrees to the ${side(ss)} of our nose.`, ask: 'How must we change our heading to point at the field?',
          right: T(net), slips: cand.filter(([v]) => v !== 0 && v !== net).map(([v, slip, why]) => ({ ...T(v), v: v + 1000, slip, why })),
          rightWhy: same ? `${s}° ${side(ss)} and ${g}° more ${side(gs)}: ${s} + ${g} = ${Math.abs(net)}° to the ${side(net)}` : `${s}° ${side(ss)}, then ${g}° back to the ${side(gs)}: ${Math.max(s, g)} − ${Math.min(s, g)} = ${Math.abs(net)}° to the ${side(net)}`,
          sum: same ? { op: 'add', a: s, b: g } : { op: 'sub', a: Math.max(s, g), b: Math.min(s, g) },
          help: { title: 'Two angles, one turn', pic: { kind: 'compass', lines: [{ deg: 0, label: 'our nose', colour: 'ship' }, { deg: ss * s, label: `the sensor: ${s}° ${side(ss)}`, dash: true }, { deg: net, label: `the signal: ${g}° ${side(gs)} of it`, colour: 'ask' }], ask: 'our nose to the signal: ? degrees, and which way?' }, line: same ? `The sensor is ${s}° to the ${side(ss)}, and the signal is ${g}° further the same way: add them.` : `The sensor is ${s}° to the ${side(ss)}, and the signal comes ${g}° back toward the ${side(gs)}: take the smaller from the bigger, and see which side is left.`, steps: [same ? `${s} + ${g}` : `${Math.max(s, g)} − ${Math.min(s, g)}`, 'Then which side of the nose it is on'] },
          own: { strand: 'geo', at: 46 }, credit: [{ strand: same ? 'add' : 'sub', at: 22, weight: 0.5 }], facts: { form: 'sensor', s: ss * s, g: gs * g, ans: net }, size: 2,
        }, rand);
      }
      // round the compass
      if (t.chance(0.5)) {
        const now = t.int(28, 35) * 10, turn = t.int(2, 9) * 10 + (360 - now), to = now + turn - 360;
        return ownOrder({
          key: 'heading:round', story: `Our nose points at ${now}° on the compass. The captain calls a turn of ${turn}° to the right. The compass starts again at 0° after 360°.`, ask: 'What is our heading after the turn?',
          right: DEG(to),
          slips: [
            { ...DEG(now + turn), slip: 'past', why: `${now + turn}° is past the top of the compass. After 360° it starts again at 0°: take 360 away.` },
            { ...DEG(turn), slip: 'new', why: `${turn}° is the turn. We started at ${now}°.` },
            { ...DEG(to + 10), slip: 'off', why: `${now} + ${turn} = ${now + turn}, and ${now + turn} − 360 is not ${to + 10}.` },
            { ...DEG(now - turn > 0 ? now - turn : to + 20), slip: 'subtracted', why: 'A turn to the right makes the heading bigger, round past 360° to 0° and on.' },
          ],
          rightWhy: `${now}° + ${turn}° = ${now + turn}°, and ${now + turn} − 360 = ${to}°`, sum: [{ op: 'add', a: now, b: turn, say: 'First the turn added on' }, { op: 'sub', a: now + turn, b: 360, say: 'Then once round the compass taken off' }],
          help: { title: 'Round the compass', pic: { kind: 'compass', rose: true, lines: [{ deg: now, label: `our nose: ${now}°`, colour: 'ship' }, { deg: to, label: `after ${turn}° right: ?`, colour: 'ask', dash: true }], ask: `${now}° and ${turn}° more, past 360°: ?` }, line: 'Add the turn. If that goes past 360°, the compass has started again: take 360 away.', steps: [`${now} + ${turn}`, 'Then take away 360'] },
          own: { strand: 'geo', at: 56 }, credit: [{ strand: 'add', at: 30, weight: 0.5 }], facts: { form: 'round', now, turn, ans: to }, size: 2,
        }, rand);
      }
      const out = t.int(1, 17) * 10, home = out + 180;
      return ownOrder({
        key: 'heading:home', story: `We flew out to the asteroid field on a heading of ${out}°. To fly home we turn right round: half a turn is 180°.`, ask: 'What heading takes us home?',
        right: DEG(home),
        slips: [
          { ...DEG(out + 90), slip: 'quarter', why: 'That is a quarter turn, 90°: it points off to the side. Home is half a turn, 180°.' },
          { ...DEG(360 - out), slip: 'mirror', why: `That takes ${out} from 360. The way home is the way out turned half round: add 180.` },
          { ...DEG(180 - out > 0 ? 180 - out : home + 10), slip: 'subtracted', why: `Half a turn adds 180° to the heading: ${out} + 180.` },
          { ...DEG(home - 10), slip: 'off', why: `${out} + 180 is not ${home - 10}.` },
        ],
        rightWhy: `${out}° + 180° = ${home}°`, sum: { op: 'add', a: out, b: 180 },
        help: { title: 'Half a turn', pic: { kind: 'compass', rose: true, lines: [{ deg: out, label: `the way out: ${out}°`, colour: 'ship' }, { deg: home, label: 'the way home: ?', colour: 'ask', dash: true }], ask: `${out}° turned half round: ?` }, line: `The way home is straight back the way we came: half a turn, 180°, on from ${out}°.`, steps: [`${out} + 180`] },
        own: { strand: 'geo', at: 56 }, credit: [{ strand: 'add', at: 30, weight: 0.5 }], facts: { form: 'home', out, ans: home },
      }, rand);
    },
  },

  // ── WHICH IS THE RIGHT WAY TO WORK IT OUT (the game's maker: "the question is just about how to do the equation. But
  // then it can be calculated automatically ... we can just offer four different diagrams with an equation"). The
  // crew member picks the diagram and equation that fit; the ship's computer does the arithmetic and says the answer. ──
  // step 1  the right triangle: the planet straight ahead, the field off to its side at a right angle
  // step 2  a rock's length from the angle it spans and how far off it is (and the other way round)
  method: {
    strand: 'geo', at: (step) => (step <= 1 ? 80 : 84),
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand), km = (v) => `${say(Math.round(v))} kilometres`;
      const coin = (kind, eq, o, v) => ({ v, big: eq, small: '', label: eq, svg: methodPic(kind, { ...o, eq }) });
      if (step <= 1) {
        const P = t.int(10, 20) * 10000, F = t.int(2, 8) * 5000, far = t.chance(0.6);
        if (far) {
          const d = Math.hypot(P, F), o = { a: 'planet: a', b: 'field: b', c: 'distance ?', mark: 'far' };
          return ownOrder({
            key: 'method:hyp', story: `The asteroid field is in the ring to the side of the planet. The planet is ${km(P)} straight ahead. The field is ${km(F)} from the planet, at a right angle to our line to the planet.`, ask: 'Which is the right way to work out our distance to the field?',
            right: coin('tri', 'distance = √(a² + b²)', o, 'hyp'),
            slips: [
              { ...coin('tri', 'distance = a + b', o, 'sum'), slip: 'added', why: 'a + b is the way round by the planet: two sides of the triangle. Straight to the field is the long side, shorter than that.' },
              { ...coin('tri', 'distance = a − b', o, 'diff'), slip: 'subtracted', why: 'a − b is shorter than the way to the planet. The field is further off than the planet, off to its side.' },
              { ...coin('tri', 'distance = √(a² − b²)', o, 'leg'), slip: 'leg', why: 'Taking the squares away finds a short side from the long one. Here the long side is the one asked for: add the squares.' },
              { ...coin('tri', 'distance = (a × b) ÷ 2', o, 'area'), slip: 'area', why: 'Half of a × b is how much room is inside the triangle, not how long its side is.' },
            ],
            rightWhy: `The ship's computer: √(${say(P)}² + ${say(F)}²) = about ${km(d)}`,
            help: { title: 'A right triangle', pic: { kind: 'method', a: `a = ${say(P)}`, b: `b = ${say(F)}`, c: '?', mark: 'far' }, line: 'Us, the planet and the field make a triangle with a square corner at the planet. The side across from the square corner is the long one: its square is the other two squares added.', steps: ['Square the two short sides', 'Add the squares', 'Take the square root'] },
            own: { strand: 'geo', at: 80 }, credit: [{ strand: 'pow', at: 70, weight: 0.5 }], facts: { form: 'hyp', P, F, ans: d }, size: 2,
          }, rand);
        }
        const D = Math.max(P + 1000, Math.round(Math.hypot(P, F) / 1000) * 1000), side = Math.sqrt(D * D - P * P), o = { a: 'planet: a', b: 'ring ?', c: 'field: c', mark: 'side' };
        return ownOrder({
          key: 'method:leg', story: `The planet is ${km(P)} straight ahead, and the scan puts the asteroid field ${km(D)} from us. The field is in the ring, out to the side of the planet at a right angle to our line to the planet.`, ask: 'Which is the right way to work out how far the field is from the planet?',
          right: coin('tri', 'ring = √(c² − a²)', o, 'leg'),
          slips: [
            { ...coin('tri', 'ring = c − a', o, 'diff'), slip: 'subtracted', why: 'c − a would be right only if the field were straight behind the planet. It is off to the side: the triangle\'s sides go by their squares.' },
            { ...coin('tri', 'ring = √(c² + a²)', o, 'hyp'), slip: 'hyp', why: 'Adding the squares finds the long side. The long side, c, is known here: take the square of a away from it.' },
            { ...coin('tri', 'ring = c + a', o, 'sum'), slip: 'added', why: 'c + a is longer than either. The side asked for is the short one.' },
            { ...coin('tri', 'ring = c ÷ a', o, 'ratio'), slip: 'ratio', why: 'c ÷ a says how many times longer one side is than the other, not how long the third side is.' },
          ],
          rightWhy: `The ship's computer: √(${say(D)}² − ${say(P)}²) = about ${km(side)}`,
          help: { title: 'A right triangle', pic: { kind: 'method', a: `a = ${say(P)}`, b: '?', c: `c = ${say(D)}`, mark: 'side' }, line: 'Us, the planet and the field make a triangle with a square corner at the planet. The long side\'s square is the other two squares added, so a short side\'s square is the long one\'s less the other\'s.', steps: ['Square the long side and the side we know', 'Take one square from the other', 'Take the square root'] },
          own: { strand: 'geo', at: 80 }, credit: [{ strand: 'pow', at: 70, weight: 0.5 }], facts: { form: 'leg', P, D, ans: side }, size: 2,
        }, rand);
      }
      const A = t.pick([4, 6, 8, 10, 12, 16, 20]), half = A / 2, tan = Math.tan(half * Math.PI / 180), o = { ang: 'angle', dist: 'distance', len: 'length ?' };
      if (t.chance(0.6)) {
        const D = t.int(4, 40) * 250, len = 2 * D * tan;
        return ownOrder({
          key: 'method:span', story: `Our jump path passes close to a large asteroid. It is ${km(D)} away, straight ahead of our sensor, and its two far ends are ${A}° apart as we see them.`, ask: 'Which is the right way to find its length?',
          right: coin('arc', 'length = 2 × distance × tan(angle ÷ 2)', o, 'tan'),
          slips: [
            { ...coin('arc', 'length = distance × angle', o, 'times'), slip: 'times', why: 'Kilometres times degrees is not a length. The angle has to go through tan first, which turns it into a slope.' },
            { ...coin('arc', 'length = distance ÷ tan(angle ÷ 2)', o, 'div'), slip: 'inverse', why: 'Dividing by tan makes a wider angle give a shorter rock. A wider angle means a longer one: multiply.' },
            { ...coin('arc', 'length = 2 × distance × cos(angle ÷ 2)', o, 'cos'), slip: 'cos', why: 'cos of a small angle is nearly 1: that would make every rock about twice as long as it is far. tan is the side across the angle over the side along it.' },
            { ...coin('arc', 'length = distance + angle', o, 'sum'), slip: 'added', why: 'Kilometres and degrees cannot be added.' },
          ],
          rightWhy: `The ship's computer: 2 × ${say(D)} × tan(${half}°) = about ${km(len)}`,
          help: { title: 'Two right triangles', pic: { kind: 'method', ang: `${A}°`, dist: `${say(D)} km`, len: '?' }, line: 'The line straight to the rock\'s middle cuts the picture into two right triangles, each with half the angle. In each, tan of the half angle is half the length over the distance.', steps: ['Halve the angle', 'Half the length = distance × tan of that', 'Double it'] },
          own: { strand: 'geo', at: 84 }, credit: [{ strand: 'ratio', at: 72, weight: 0.5 }], facts: { form: 'span', D, A, ans: len }, size: 2,
        }, rand);
      }
      const L = t.int(2, 20) * 50, dist = (L / 2) / tan, o2 = { ang: 'angle', dist: 'distance ?', len: 'length' };
      return ownOrder({
        key: 'method:range', story: `The chart says the asteroid ahead is ${km(L)} long. From end to end it spans ${A}° on our screen, and we are facing its middle.`, ask: 'Which is the right way to find how far away it is?',
        right: coin('arc', 'distance = (length ÷ 2) ÷ tan(angle ÷ 2)', o2, 'tan'),
        slips: [
          { ...coin('arc', 'distance = length × tan(angle ÷ 2)', o2, 'times'), slip: 'inverse', why: 'tan of a small angle is a small number: that would put the rock closer than it is long. A small angle means it is far off: divide.' },
          { ...coin('arc', 'distance = length ÷ angle', o2, 'div'), slip: 'times', why: 'Kilometres over degrees is not a distance. The angle has to go through tan first.' },
          { ...coin('arc', 'distance = length × angle', o2, 'mult'), slip: 'times', why: 'That makes a wider angle mean further away. The closer a rock is, the wider it looks.' },
          { ...coin('arc', 'distance = length − angle', o2, 'diff'), slip: 'subtracted', why: 'Kilometres and degrees cannot be taken from each other.' },
        ],
        rightWhy: `The ship's computer: (${say(L)} ÷ 2) ÷ tan(${half}°) = about ${km(dist)}`,
        help: { title: 'Two right triangles', pic: { kind: 'method', ang: `${A}°`, dist: '?', len: `${say(L)} km` }, line: 'The line to the rock\'s middle makes two right triangles, each with half the angle and half the length. tan of the half angle is half the length over the distance, so the distance is half the length over that tan.', steps: ['Halve the angle, and halve the length', 'Distance = half the length ÷ tan of the half angle'] },
        own: { strand: 'geo', at: 84 }, credit: [{ strand: 'ratio', at: 72, weight: 0.5 }], facts: { form: 'range', L, A, ans: dist }, size: 2,
      }, rand);
    },
  },
};

// ── the ladder: easiest first, every step small ──────────────────────────────────────────────────────────────────
// (lamp: the jump's lamp an Ask suits, for pickAsk: 'distance' where and how far, 'charge' the fuel, 'go' the heading
// and the time)
const W = (step, types, w = 1) => ({ maker: 'words', step, types, w });
const M = (maker, step, w = 1, lamp = null) => ({ maker, step, w, ...(lamp ? { lamp } : {}) });

export const PLACE = {
  id: 'pilot', name: 'The pilot\'s seat', short: 'Pilot', math: 'Navigating: fuel and distance, the map, headings, speed and time', pic: 'pilot', job: null,
  line: 'The jump computer on a captain\'s run: fuel against the way, points on the map round the planet, headings and turns, how far and how long, and which sum fits.',
  levels: [
    { id: 'kHops', title: 'Hops and fuel', line: 'Up to 5: the hops to the field; 3 units away with fuel for 5', gen: { mix: [M('hops', 1, 2, 'distance'), M('fuel', 1, 1, 'charge')] } },
    { id: 'kMore', title: 'Hops in all, hops left', line: 'Up to 10: 3 hops to the beacon and 2 more; 7 hops, 3 made', gen: { mix: [M('hops', 2, 2, 'distance'), M('fuel', 1, 1, 'charge')] } },
    { id: 'kBack', title: 'There and back', line: '3 units away: how many units there and back', gen: { mix: [M('fuel', 2, 2, 'charge'), M('hops', 2, 1, 'distance')] } },
    { id: 'kPast', title: 'Past ten, beacon by beacon', line: 'At beacon 8, 5 more hops; from beacon 8 to beacon 13', gen: { mix: [M('hops', 3, 2, 'distance'), M('fuel', 2, 1, 'charge')] } },
    { id: 'kCan', title: 'Can we get there and back?', line: '3 units away and fuel for 8: yes, with 2 units to spare', strand: 'words', gen: { mix: [M('fuel', 3, 2, 'charge'), M('hops', 3, 1, 'distance')] } },
    { id: 'kEqual', title: 'Equal jumps', line: '3 jumps of 5 kilometres', strand: 'words', gen: { mix: [M('hops', 4, 2, 'distance'), M('fuel', 3, 1, 'charge')] } },
    { id: 'jumps', title: 'Jumps, fuel and totals', line: '4 jumps of 6 kilometres; 15 kilometres and 18 more; 30 fuel cells, 12 used', gen: { mix: [W(1, ['groups', 'parts'])] } },
    { id: 'share', title: 'Sharing a distance out', line: '24 kilometres in 4 equal jumps', gen: { mix: [W(2, ['share'], 2), W(1, ['groups'])] } },
    { id: 'plot1', title: 'Points on the map', line: 'One quarter of the map: mine at (4, 3)', gen: { mix: [M('plot', 1, 2, 'distance'), W(2, ['share'])] } },
    { id: 'turn', title: 'Headings and turns', line: 'Nose at 40°, the field at 70°: how far to turn', gen: { mix: [M('heading', 1, 2, 'go'), M('plot', 1, 1, 'distance')] } },
    { id: 'speed', title: 'Speed and time: how far', line: '6 kilometres a second for 5 seconds', gen: { mix: [M('rate', 1, 2, 'distance'), M('heading', 1, 1, 'go')] } },
    { id: 'fast', title: 'How fast, how long', line: '45 kilometres in 9 seconds; 40 kilometres at 8 kilometres a second', gen: { mix: [M('rate', 2, 2, 'go'), M('rate', 1, 1, 'distance')] } },
    { id: 'sensor', title: 'The sensor\'s angle', line: 'A signal 30° right of a sensor pointed 45° left of the nose', gen: { mix: [M('heading', 2, 2, 'go'), M('rate', 2)] } },
    { id: 'minutes', title: 'Bigger trips, by the minute', line: '360 kilometres at 40 kilometres a minute', gen: { mix: [M('rate', 3, 2), M('heading', 2, 1, 'go')] } },
    { id: 'plot4', title: 'The whole map', line: 'With negatives: mine at (-8, 3)', gen: { mix: [M('plot', 2, 2, 'distance'), M('rate', 3)] } },
    { id: 'round', title: 'Round the compass', line: 'Nose at 320°, a turn of 70° right; the heading for home', gen: { mix: [M('heading', 3, 2, 'go'), M('plot', 2, 1, 'distance')] } },
    { id: 'table', title: 'Fuel by the jump', line: '3 fuel cells for every 2 jumps; for 10 jumps?', gen: { mix: [M('ratio', 3, 2, 'charge'), M('heading', 3, 1, 'go')] } },
    { id: 'course', title: 'A course round the rings', line: 'From (-6, 0) round to (7, 0): up 5, across, down 5', gen: { mix: [M('plot', 3, 2, 'distance'), M('rate', 4)] } },
    { id: 'legs', title: 'Two legs, one trip', line: '120 kilometres at 40 a minute, then 90 at 30; the speed over the whole trip', gen: { mix: [M('rate', 5, 2, 'go'), M('plot', 3, 1, 'distance')] } },
    { id: 'minsec', title: 'Seconds into minutes', line: '2,400 kilometres at 8 kilometres a second: how many minutes?', gen: { mix: [M('rate', 6, 2, 'go'), M('rate', 5)] } },
    { id: 'triangle', title: 'Which sum fits: the right triangle', line: 'The planet ahead, the field off to its side: which equation gives the distance', gen: { mix: [M('method', 1, 2, 'distance'), M('rate', 6, 1, 'go')] } },
    { id: 'span', title: 'Which sum fits: an angle and a distance', line: 'A rock 10° wide at 2,000 kilometres: which equation gives its length', gen: { mix: [M('method', 2, 2, 'distance'), M('method', 1)] } },
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
