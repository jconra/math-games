// THE SHIPPING COMPUTER IN CARGO: how much of the supplies to pack for the supply run to the other station. The game's
// maker, 2026-11-22 (STA2-5): "What makes the most sense to me is you go to the computer, do the questions to calculate
// out how much of the supplies you need to pack. Maybe 5 questions. Then you go get in the forklift and load some
// pallets onto the containers." The computer is the shipping desk's own (kit/store.js shipDesk: its right-hand screen,
// beside Gus's chair). A run's FIVE QUESTIONS work it out one step at a time, each from the last, as Mathwood Valley's
// supply orders do (mathwood-valley/src/math/supplies.js: "enough beans to last a fortnight for 6 hands, 3 meals a day;
// beans come in crates of 12"), told about the old station's people, its days and its needs:
//   1  the food: so many people, so many meal packs a day each, so many days
//   2  the crates it packs into (whole crates: the last few packs need a crate too, higher up)
//   3  the water: so many drums for each person (higher up: so many litres a day each, so many to a drum)
//   4  the pallets: the crates and drums, so many to a pallet
//   5  the containers: two pallets to a container (they stand side by side just inside its doors)
// and every level's five cards come out at the run's own number of pallets (src/supplyrun.js: 3 or 4, picked as the
// run starts), so the forklift then loads that many. The youngest count the people, crates, drums, pallets and
// containers drawn on the card; then add; then equal groups; then Mathwood's supply ladder (a pack a day, three
// numbers, a week, a fortnight worked on paper, whole crates); at the top the water by the litre.
// Done, the doors of the containers open (src/supplyrun.js) and the end card says what to load where.
// This file is the math (pure: node tests it, pi-nebula/tests/cargo.test.mjs); the run and the card's top are
// src/jobs/cargolink.js (the panel's `live`); the pictures src/jobs/cargopics.js.
import { ownOrder } from './engine.js';
import { pointOf } from '../../../mathwood-valley/src/math/longwork.js';
import { seeded } from '../../../mathwood-valley/src/math/supplies.js';
import { cargoPic } from './cargopics.js';

export const CARDS = 5;                       // the questions a run asks ("Maybe 5 questions")
export const PER_BOX = 2;                     // pallets to a container (kit/places-plan.js LOAD.each)
export const STATION = 'the old station';    // (its name is not picked yet: the plan's piece 1)
const u = (n, unit) => `${n.toLocaleString('en-US')} ${n === 1 ? unit[0] : unit[1]}`;
const face = (n, unit) => ({ v: n, big: n.toLocaleString('en-US'), small: n === 1 ? unit[0] : unit[1], label: u(n, unit) });
const U = { people: ['person', 'people'], packs: ['meal pack', 'meal packs'], crates: ['crate', 'crates'], drums: ['drum', 'drums'], pallets: ['pallet', 'pallets'], containers: ['container', 'containers'], litres: ['litre', 'litres'] };
const tools = (rand) => ({ int: (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)), pick: (a) => a[Math.floor(rand() * a.length)] });
const ceilDiv = (a, b) => Math.ceil(a / b);

// ── THE LADDER: each level's five cards (Mathwood's school guide in brackets: 0 starting kindergarten ... 80 eighth
// grade). `grade`: the level's place on the guide; the rest say how big its numbers get ────────────────────────────
export const STEPS = [
  { id: 'count', title: 'Counting the load', line: 'People, crates, drums, pallets: count them', grade: 0 },
  { id: 'add10', title: 'In all, up to 10', line: '4 crates of fruit and 3 of bread', grade: 6 },
  { id: 'add20', title: 'Past 10', line: 'A crew of 9 and 6 children; 14 drums, 5 stay', grade: 14 },
  { id: 'groups', title: 'Equal groups', line: '4 people, 3 meal packs each; 12 packs, 4 to a crate', grade: 20 },
  { id: 'days', title: 'A pack a day', line: '6 people, one a day, for 8 days', grade: 26 },
  { id: 'three', title: 'Three numbers', line: '5 people, 3 a day, for 4 days', grade: 35 },
  { id: 'week', title: 'A week (7 days)', line: '6 people, 3 a day, for a week', grade: 40 },
  { id: 'fortnight', title: 'A fortnight, worked on paper', line: '12 people, 3 a day, for 14 days', grade: 49 },
  { id: 'round', title: 'Whole crates and pallets', line: '250 packs, 12 to a crate: 21 crates', grade: 55 },
  { id: 'litres', title: 'Water by the litre', line: '8 people, 3 litres a day, 10 days, 25 to a drum', grade: 62 },
];

// ── one card's makings: a sum and the slips kids really make with it ─────────────────────────────────────────────
// each card: { key, story, ask, n (the answer), unit, slips: [{ v, slip, why }], why (the right answer's working), sum,
// help: { title, line, steps, pic }, own: { strand, at }, lead (a picture on the card, for the youngest) }
const countSlips = (n, thing) => [n + 1, n - 1, n + 2, n - 2].filter((v) => v > 0).map((v) => ({ v, slip: 'count', why: `Count them again, touching each ${thing} once: ${v} is ${v > n ? 'one too many' : 'one short'}${Math.abs(v - n) > 1 ? ' or more' : ''}.` }));
function countCard({ key, thing, n, unit, story, ask, group = 0, two = null, at = 0 }) {
  const pic = { kind: 'count', thing, n, group, two };
  return { key, story, ask, n, unit, slips: two ? addSlips(two.n[0], two.n[1], unit) : countSlips(n, unit[0]), why: two ? `${two.n[0]} and ${two.n[1]} more make ${u(n, unit)}` : `${u(n, unit)}`,
    sum: two ? { op: 'add', a: two.n[0], b: two.n[1] } : null, lead: cargoPic(pic), help: { title: 'Count them', line: group ? `Count the boxes: each holds ${group}.` : 'Touch each one once as you count.', steps: [], pic }, own: { strand: 'words', at } };
}
function addSlips(a, b, unit) {
  return [
    { v: a + b + 1, slip: 'off', why: `That is one too many. ${a} and ${b} more: count on ${b} from ${a}.` },
    { v: a + b - 1, slip: 'off', why: `That is one short. ${a} and ${b} more: count on ${b} from ${a}.` },
    { v: Math.abs(a - b), slip: 'subtracted', why: `That takes one away from the other. Both lots are ${unit[1]}: put them together.` },
    { v: Math.max(a, b), slip: 'one', why: `That is only one of the two lots. Put both together: ${a} + ${b}.` },
  ];
}
function subSlips(a, b, unit) {
  return [
    { v: a + b, slip: 'added', why: `That adds them. ${b} of the ${a} stay here: take them away.` },
    { v: a - b + 1, slip: 'off', why: `One too many: count back ${b} from ${a}.` },
    { v: a - b - 1, slip: 'off', why: `One short: count back ${b} from ${a}.` },
    { v: b, slip: 'which', why: `${b} is how many stay. The ones that go are the rest of the ${a}.` },
  ];
}
// a product of two numbers (or three: the first two first)
function mulSlips(nums, names) {
  const [a, b, c] = nums, all = nums.reduce((x, y) => x * y, 1);
  if (nums.length === 2) return [
    { v: a + b, slip: 'added', why: `${a} + ${b} adds them. It is ${b} for each of the ${a} ${names[0]}: ${a} × ${b}.` },
    { v: a * (b + 1), slip: 'oneMore', why: `That is ${b + 1} each. It is ${b}.` },
    { v: a * (b - 1), slip: 'oneLess', why: `That is ${b - 1} each. It is ${b}.` },
    { v: (a + 1) * b, slip: 'oneMore', why: `That is for ${a + 1} ${names[0]}. There are ${a}.` },
  ];
  return [
    { v: a * b, slip: 'oneDay', why: `${a} × ${b} is one day's worth. Now times the ${c} days: ${a} × ${b} × ${c}.` },
    { v: b * c, slip: 'onePerson', why: `${b} × ${c} is enough for one person. There are ${a}: times ${a}.` },
    { v: a * c, slip: 'noRate', why: `${a} × ${c} leaves out the ${b} a day. Each person needs ${b} every day: times ${b}.` },
    { v: a + b + c, slip: 'added', why: `${a} + ${b} + ${c} adds them. It is ${a} people, ${b} each a day, for ${c} days: multiply all three.` },
    { v: a * b * (c - 1), slip: 'dayOff', why: `That is ${c - 1} days' worth. They need ${c}.` },
  ].filter((s) => s.v !== all);
}
// so many shared into lots of `per` (whole lots: rounded up when it does not come out even)
function divSlips(total, per, box, unit) {
  const n = ceilDiv(total, per), full = Math.floor(total / per), left = total - full * per;
  const out = left
    ? [{ v: full, slip: 'roundDown', why: `${u(full, box)} hold ${full * per}. ${left === 1 ? `That leaves 1 ${unit[0]} with nowhere to go: it needs one more ${box[0]}.` : `That leaves ${left} ${unit[1]} with nowhere to go: they need one more ${box[0]}.`}` },
      { v: n + 1, slip: 'extra', why: `${u(n, box)} already hold all ${total} (room for ${n * per}). One more is extra.` }]
    : [{ v: n + 1, slip: 'extra', why: `${u(n, box)} already hold all ${total}. One more is extra.` },
      { v: n - 1, slip: 'short', why: `${u(n - 1, box)} hold only ${(n - 1) * per}. There are ${total}.` }];
  out.push(total * per <= 9999 ? { v: total * per, slip: 'multiplied', why: `${total} × ${per} multiplies. Share the ${total} into ${box[1]} of ${per} instead: ${total} ÷ ${per}.` }
    : { v: total + per, slip: 'added', why: `${total} + ${per} adds them. Share the ${total} into ${box[1]} of ${per}: ${total} ÷ ${per}.` });
  out.push({ v: total - per, slip: 'subtracted', why: `${total} − ${per} takes one ${box[0]} away. Count how many ${box[1]} of ${per} make ${total}.` });
  return out;
}
const divWhy = (total, per, box) => { const n = ceilDiv(total, per), full = Math.floor(total / per), left = total - full * per; return left ? `${full} full ${box[1]} hold ${full * per}, and 1 more for the last ${left}: ${u(n, box)}` : `${total} ÷ ${per} = ${u(n, box)}`; };
const at = (op, a, b) => pointOf(op, a, b) || { strand: 'words', at: 20 };

// THE CONTAINERS: two pallets to a container (the last card at every level)
function boxCard(N, step) {
  const K = ceilDiv(N, PER_BOX), young = step <= 2;
  const story = `${u(N, U.pallets)} to load. Each container takes ${PER_BOX} pallets, side by side just inside its doors.`;
  const slips = [
    { v: N, slip: 'oneEach', why: `That is a container for every pallet. Each one takes ${PER_BOX}.` },
    { v: K + 1, slip: 'extra', why: `${u(K, U.containers)} already take all ${N} (room for ${K * PER_BOX}). One more is extra.` },
    { v: N * PER_BOX, slip: 'multiplied', why: `${N} × ${PER_BOX} multiplies. Share the ${N} pallets out, ${PER_BOX} to a container: ${N} ÷ ${PER_BOX}.` },
    ...(N % PER_BOX ? [{ v: Math.floor(N / PER_BOX), slip: 'roundDown', why: `${u(Math.floor(N / PER_BOX), U.containers)} take only ${Math.floor(N / PER_BOX) * PER_BOX}. The last pallet needs a container too.` }] : [{ v: 1, slip: 'one', why: `One container takes only ${PER_BOX}. There are ${N}.` }]),
  ];
  const pic = { kind: 'containers', pallets: N, per: PER_BOX };
  return { key: 'containers', story, ask: 'How many containers do they need?', n: K, unit: U.containers, slips, why: N % PER_BOX ? `${Math.floor(N / PER_BOX)} full container, and 1 more for the last pallet: ${u(K, U.containers)}` : `${N} ÷ ${PER_BOX} = ${u(K, U.containers)}`,
    sum: young ? null : { op: 'div', a: N, b: PER_BOX }, lead: young ? cargoPic({ kind: 'count', thing: 'pallet', n: N, group: PER_BOX }) : null,
    help: { title: 'Pallets into containers', line: `Put the pallets in twos: each two is a container, and a pallet left over needs one too.`, steps: young ? [] : [`The pallets, ${PER_BOX} to a container: ${N} ÷ ${PER_BOX}, and one more for any left over`], pic: young ? { kind: 'count', thing: 'pallet', n: N, group: PER_BOX } : pic },
    own: young ? { strand: 'words', at: STEPS[step - 1].grade } : { strand: 'div', at: N % PER_BOX ? 30 : 22 } };
}

// ── A CHAIN: the five cards of a run at a step, worked out backward from its pallets (N) ─────────────────────────
// -> { step, N, K, food (meal packs), crates, drums, cards: [5] } or null (numbers that do not fit: tried again)
const MAKE = {
  // 1. COUNTING: the things drawn, five lots to count; the last two the pallets and their containers
  count(N, t, step) {
    const P = t.int(2, 5), C = t.int(2, 5), D = t.int(2, 5), g = STEPS[step - 1].grade;
    return { food: null, crates: C, drums: D, people: P, cards: [
      countCard({ key: 'people', thing: 'person', n: P, unit: U.people, story: `These people are waiting at ${STATION} for the Hauler to bring them supplies.`, ask: 'How many people are waiting?', at: g }),
      countCard({ key: 'crates', thing: 'crate', n: C, unit: U.crates, story: 'Crates of food have been packed for them.', ask: 'How many crates of food?', at: g }),
      countCard({ key: 'drums', thing: 'drum', n: D, unit: U.drums, story: 'And drums of water to drink.', ask: 'How many drums of water?', at: g }),
      countCard({ key: 'pallets', thing: 'pallet', n: N, unit: U.pallets, story: 'The crates and drums are packed onto pallets for the forklift.', ask: 'How many pallets?', at: g }),
      boxCard(N, step)] };
  },
  // 2. IN ALL, UP TO 10 (the drums: so many, some stay): pictures on the card
  add10(N, t, step) {
    const a = t.int(2, 6), b = t.int(1, 10 - a), x = t.int(2, 6), y = t.int(1, 10 - x), c = t.int(5, 10), d = t.int(1, c - 2), f = t.int(1, N - 1), g = STEPS[step - 1].grade;
    return { people: a + b, crates: x + y, drums: c - d, cards: [
      countCard({ key: 'people', thing: 'person', n: a + b, unit: U.people, story: `${STATION[0].toUpperCase() + STATION.slice(1)} has a crew of ${a}, and ${b} ${b === 1 ? 'child lives' : 'children live'} there too.`, ask: 'How many people need supplies?', two: { n: [a, b] }, at: g }),
      countCard({ key: 'crates', thing: 'crate', n: x + y, unit: U.crates, story: `Pack ${u(x, U.crates)} of fruit and ${u(y, U.crates)} of bread.`, ask: 'How many crates of food?', two: { n: [x, y] }, at: g }),
      { key: 'drums', story: `Cargo has ${u(c, U.drums)} of water. ${d} ${d === 1 ? 'stays' : 'stay'} here on our station.`, ask: 'How many drums can go?', n: c - d, unit: U.drums, slips: subSlips(c, d, U.drums), why: `${c} − ${d} = ${u(c - d, U.drums)}`,
        sum: { op: 'sub', a: c, b: d }, lead: cargoPic({ kind: 'count', thing: 'drum', n: c }), help: { title: 'Take away the ones that stay', line: `Count back ${d} from ${c}.`, steps: [], pic: { kind: 'count', thing: 'drum', n: c } }, own: at('sub', c, d) },
      countCard({ key: 'pallets', thing: 'pallet', n: N, unit: U.pallets, story: `The food fills ${u(f, U.pallets)}, and the water ${u(N - f, U.pallets)}.`, ask: 'How many pallets to load?', two: { n: [f, N - f] }, at: g }),
      boxCard(N, step)] };
  },
  // 3. PAST 10: the same, the numbers past 10; the help picture, not on the card
  add20(N, t) {
    const a = t.int(5, 12), b = t.int(Math.max(2, 11 - a), 20 - a), x = t.int(6, 12), y = t.int(Math.max(2, 11 - x), 20 - x), c = t.int(11, 20), d = t.int(2, c - 5), f = t.int(1, N - 1);
    const help = (title, line, pic) => ({ title, line, steps: [], pic });
    return { people: a + b, crates: x + y, drums: c - d, cards: [
      { key: 'people', story: `${STATION[0].toUpperCase() + STATION.slice(1)} has a crew of ${a}, and ${b} children live there too.`, ask: 'How many people need supplies?', n: a + b, unit: U.people, slips: addSlips(a, b, U.people), why: `${a} + ${b} = ${u(a + b, U.people)}`, sum: { op: 'add', a, b }, help: help('Put them together', `Count on ${b} from ${a}: make 10 first, then the rest.`, { kind: 'boxes', items: [{ top: 'crew', mid: a }, { top: 'children', mid: b }, { top: 'in all', mid: '?', ask: true }], op: '+' }), own: at('add', a, b) },
      { key: 'crates', story: `Pack ${u(x, U.crates)} of beans and ${u(y, U.crates)} of rice.`, ask: 'How many crates of food?', n: x + y, unit: U.crates, slips: addSlips(x, y, U.crates), why: `${x} + ${y} = ${u(x + y, U.crates)}`, sum: { op: 'add', a: x, b: y }, help: help('Put them together', `Count on ${y} from ${x}: make 10 first, then the rest.`, { kind: 'boxes', items: [{ top: 'beans', mid: x }, { top: 'rice', mid: y }, { top: 'crates', mid: '?', ask: true }], op: '+' }), own: at('add', x, y) },
      { key: 'drums', story: `Cargo has ${u(c, U.drums)} of water. ${d} stay here on our station.`, ask: 'How many drums can go?', n: c - d, unit: U.drums, slips: subSlips(c, d, U.drums), why: `${c} − ${d} = ${u(c - d, U.drums)}`, sum: { op: 'sub', a: c, b: d }, help: help('Take away the ones that stay', `Count back ${d} from ${c}: back to 10 first, then the rest.`, { kind: 'boxes', items: [{ top: 'in Cargo', mid: c }, { top: 'stay', mid: d }, { top: 'go', mid: '?', ask: true }], op: '−' }), own: at('sub', c, d) },
      { key: 'pallets', story: `The food fills ${u(f, U.pallets)}, and the water ${u(N - f, U.pallets)}.`, ask: 'How many pallets to load?', n: N, unit: U.pallets, slips: addSlips(f, N - f, U.pallets), why: `${f} + ${N - f} = ${u(N, U.pallets)}`, sum: { op: 'add', a: f, b: N - f }, help: help('Put them together', 'Both lots go: add them.', { kind: 'boxes', items: [{ top: 'food', mid: f }, { top: 'water', mid: N - f }, { top: 'pallets', mid: '?', ask: true }], op: '+' }), own: at('add', f, N - f) },
      boxCard(N, 3)] };
  },
};
// FROM THE PEOPLE UP (equal groups, and Mathwood's supply ladder): food, crates, water, pallets, containers. `o`: the
// level's numbers: people [lo, hi], a day each [lo, hi] (1: one a day), days (a list; 0: no days, so many each),
// word (how the days are told), crate sizes, drums each, to a pallet, round (whole crates may come out uneven),
// litres (the water by the litre: a day each, drum sizes)
function fromPeople(o) {
  return (N, t, step) => {
    const P = t.int(...o.people), r = t.int(...o.each), D = o.days ? t.pick(o.days) : 1, c = t.pick(o.crate);
    const food = P * r * D;
    if (food <= c) return null;
    const crates = ceilDiv(food, c);
    if (!o.round && food % c) return null;
    if (o.round && !(food % c)) return null;
    if (crates > (o.most || 30) || crates < 2) return null;
    let drums, w = 0, L = 0, H = 0, water = 0;
    if (o.litres) { L = t.pick(o.litres.day); H = t.pick(o.litres.drum); water = P * L * D; drums = ceilDiv(water, H); if (!(water % H) || drums < 2 || drums > 30) return null; }
    else { w = t.int(...o.drums); drums = P * w; }
    const k = t.pick(o.pallet), things = crates + drums, pallets = ceilDiv(things, k);
    if (pallets !== N) return null;
    if (!o.round && things % k) return null;
    if (o.round && !(things % k)) return null;
    const time = !o.days ? '' : o.word === 'week' ? 'a week' : o.word === 'fortnight' ? 'a fortnight' : `${D} days`;
    const two = r === 1;
    // 1. the food
    const fNums = !o.days ? [P, r] : two ? [P, D] : [P, r, D];
    const fStory = !o.days ? `Each of the ${P} people at ${STATION} needs ${u(r, U.packs)}.`
      : two ? `The ${P} people at ${STATION} each need one meal pack a day. The supplies have to last ${time}.`
        : `The ${P} people at ${STATION} each eat ${u(r, U.packs)} a day. The supplies have to last ${time}.`;
    const fSum = fNums.length === 3 ? [{ op: 'mul', a: P, b: r, say: `First one day for all ${P} people` }, { op: 'mul', a: P * r, b: D, say: `Then all ${D} days of it` }] : { op: 'mul', a: fNums[0], b: fNums[1] };
    const fPic = { kind: 'meals', people: P, each: r, days: D, word: o.word === 'week' || o.word === 'fortnight' ? o.word : '' };
    const c1 = { key: 'food', story: fStory, ask: `How many meal packs ${o.days ? `for ${time === `${D} days` ? `all ${D} days` : `the ${o.word}`}` : 'is that'}?`, n: food, unit: U.packs,
      slips: [...(o.word === 'fortnight' ? [{ v: P * r * 7, slip: 'week7', why: `That is 7 days' worth. A fortnight is 14 days, two weeks: ${P} × ${r} × 14.` }] : []), ...(o.word === 'week' ? [{ v: P * r * 5, slip: 'week5', why: `5 days is the working week. A week is every day of it: 7 days.` }] : []), ...mulSlips(fNums, ['people'])],
      why: fNums.length === 3 ? `${P} people × ${r} a day × ${D} days = ${u(food, U.packs)}` : `${fNums[0]} × ${fNums[1]} = ${u(food, U.packs)}`, sum: fSum,
      help: { title: 'A day at a time', line: fNums.length === 3 ? `Work out one day first (people × packs each a day), then that many again for every one of the ${D} days.${o.word === 'week' ? ' A week is 7 days.' : o.word === 'fortnight' ? ' A fortnight is two weeks: 14 days.' : ''}` : two ? `Every day each of the ${P} people needs one, for ${D} days.` : `${P} people, ${r} each.`, steps: [], pic: o.word === 'fortnight' && o.calendar ? { kind: 'calendar', days: 14 } : fPic },
      own: fNums.length === 3 ? at('mul', P * r, D) : at('mul', fNums[0], fNums[1]), credit: o.word ? [{ strand: 'time', at: 35, weight: 0.3 }] : [] };
    // 2. the crates
    const c2 = { key: 'crates', story: `Meal packs come ${c} to a crate.`, ask: `How many crates for ${food.toLocaleString('en-US')} meal packs?`, n: crates, unit: U.crates, slips: divSlips(food, c, U.crates, U.packs), why: divWhy(food, c, U.crates),
      sum: { op: 'div', a: food, b: c }, help: { title: 'Packing the crates', line: food % c ? `Every crate holds ${c}. Fill them up, and the few left over still need a crate: a supply run is never short.` : `Every crate holds ${c}. How many crates of ${c} make ${food}?`, steps: [`The ${food} meal packs shared into crates of ${c}: ${food} ÷ ${c}`], pic: { kind: 'pack', total: food, per: c, unit: 'meal packs', box: U.crates } },
      own: food % c ? { strand: 'div', at: 55 } : at('div', food, c) };
    // 3. the water
    const c3 = o.litres
      ? { key: 'drums', story: `Each person needs ${u(L, U.litres)} of water a day, for ${time}. A drum holds ${H} litres.`, ask: 'How many drums of water?', n: drums, unit: U.drums,
        slips: [{ v: Math.floor(water / H), slip: 'roundDown', why: `${u(Math.floor(water / H), U.drums)} hold ${Math.floor(water / H) * H} litres. The last ${water % H} litres need a drum too.` }, { v: ceilDiv(P * L, H) || 1, slip: 'oneDay', why: `That is one day's water. It has to last ${D} days.` }, { v: ceilDiv(L * D, H), slip: 'onePerson', why: `That is enough for one person. There are ${P}.` }, { v: drums + 1, slip: 'extra', why: `${u(drums, U.drums)} already hold all ${water} litres. One more is extra.` }],
        why: `${P} × ${L} × ${D} = ${water} litres; ${divWhy(water, H, U.drums)}`, sum: [{ op: 'mul', a: P * L, b: D, say: `First the water: ${P} people × ${L} litres = ${P * L} a day, for ${D} days` }, { op: 'div', a: water, b: H, say: `Then the drums of ${H} litres (one more for any left over)` }],
        help: { title: 'The water, then the drums', line: `All the water first (people × litres a day × days), then share it into drums of ${H}; a few litres left over still need a drum.`, steps: [], pic: { kind: 'pack', total: water, per: H, unit: 'litres', box: U.drums } },
        own: { strand: 'long', at: 56 }, credit: [{ strand: 'div', at: 55, weight: 0.5 }] }
      : { key: 'drums', story: `Each of the ${P} people needs ${u(w, U.drums)} of water for the trip.`, ask: 'How many drums of water?', n: drums, unit: U.drums, slips: mulSlips([P, w], ['people']), why: `${P} × ${w} = ${u(drums, U.drums)}`,
        sum: { op: 'mul', a: P, b: w }, help: { title: 'Drums for everyone', line: `${u(w, U.drums)} for each of the ${P} people.`, steps: [], pic: { kind: 'boxes', items: [{ top: 'people', mid: P }, { top: 'drums each', mid: w }, { top: 'drums', mid: '?', ask: true }], op: '×' } }, own: at('mul', P, w) };
    // 4. the pallets: the crates and drums, so many to a pallet (the youngest of these levels are given the two together)
    const given = step <= 4, ps = [];
    if (!given) ps.push({ op: 'add', a: crates, b: drums, say: 'First the crates and the drums together' });
    ps.push({ op: 'div', a: things, b: k, say: given ? `The ${things}, ${k} to a pallet` : `Then ${k} to a pallet${things % k ? ' (one more for any left over)' : ''}` });
    const c4 = { key: 'pallets', story: given ? `The ${u(crates, U.crates)} and ${u(drums, U.drums)} make ${things} in all. ${k} fit on each pallet.` : `${u(crates, U.crates)} of food and ${u(drums, U.drums)} of water: ${k} of them fit on each pallet.`, ask: 'How many pallets?', n: pallets, unit: U.pallets,
      slips: [...(given ? [] : [{ v: ceilDiv(crates, k), slip: 'foodOnly', why: `That is only the crates. The drums go on pallets too: ${crates} + ${drums} first.` }, { v: crates + drums, slip: 'notShared', why: `${crates + drums} is the crates and drums together. Now ${k} to a pallet.` }]), ...divSlips(things, k, U.pallets, ['crate or drum', 'crates and drums'])],
      why: given ? divWhy(things, k, U.pallets) : `${crates} + ${drums} = ${things}; ${divWhy(things, k, U.pallets)}`, sum: ps.length > 1 ? ps : { op: 'div', a: things, b: k },
      help: { title: 'Loading the pallets', line: given ? `Share the ${things} into pallets of ${k}.` : `The crates and drums together first, then ${k} to a pallet${things % k ? '; a few left over still need a pallet' : ''}.`, steps: [], pic: { kind: 'pack', total: things, per: k, unit: 'crates and drums', box: U.pallets } },
      own: things % k ? { strand: 'div', at: 55 } : at('div', things, k), credit: given ? [] : [{ strand: 'add', at: 12, weight: 0.3 }] };
    return { people: P, food, crates, drums, things, k, cards: [c1, c2, c3, c4, boxCard(N, step)] };
  };
}
Object.assign(MAKE, {
  groups: fromPeople({ people: [2, 5], each: [2, 5], days: 0, crate: [2, 3, 4, 5], drums: [1, 3], pallet: [2, 3, 4, 5, 6], most: 10 }),
  days: fromPeople({ people: [2, 10], each: [1, 1], days: [2, 3, 4, 5, 6, 7, 8, 9, 10], crate: [2, 3, 4, 5, 6, 8, 10], drums: [1, 3], pallet: [3, 4, 5, 6, 8], most: 20 }),
  three: fromPeople({ people: [2, 8], each: [2, 3], days: [2, 3, 4, 5, 6], crate: [4, 5, 6, 8, 10, 12], drums: [1, 3], pallet: [4, 5, 6, 8, 10, 12] }),
  week: fromPeople({ people: [2, 8], each: [2, 3], days: [7], word: 'week', crate: [6, 7, 8, 10, 12, 14, 21], drums: [1, 3], pallet: [4, 5, 6, 8, 10, 12] }),
  fortnight: fromPeople({ people: [3, 12], each: [2, 3], days: [14], word: 'fortnight', crate: [12, 14, 20, 21, 24, 28, 42], drums: [1, 3], pallet: [6, 8, 10, 12], calendar: false }),
  round: fromPeople({ people: [3, 12], each: [2, 4], days: [3, 4, 5, 6, 7, 8, 9, 10, 14], crate: [10, 12, 20, 24, 25], drums: [1, 3], pallet: [6, 8, 10, 12], round: true }),
  litres: fromPeople({ people: [3, 12], each: [2, 3], days: [5, 6, 7, 8, 10, 14], crate: [10, 12, 20, 24, 25], pallet: [6, 8, 10, 12], round: true, litres: { day: [2, 3, 4], drum: [20, 25, 50] } }),
});
// (a level's word for its days: 'a week' read as such)
for (const s of STEPS) if (!MAKE[s.id]) throw new Error('cargo: no maker for ' + s.id);

export function chainAt(step, N, rand = Math.random) {
  const S = STEPS[Math.max(1, Math.min(STEPS.length, step)) - 1], t = tools(rand);
  for (let tries = 0; tries < 20000; tries++) {
    const c = MAKE[S.id](N, t, step);
    if (c && c.cards.every((x) => x.n > 0)) return { step, N, K: ceilDiv(N, PER_BOX), ...c };
  }
  throw new Error(`cargo: no run could be worked out at step ${step} for ${N} pallets`);
}
// a card of a chain as the panel's order (engine.js ownOrder: its answers, the slips kids make, Help)
export function orderOf(card, step, k, rand = Math.random) {
  const pic = card.help && card.help.pic;
  return ownOrder({
    key: `cargo:${card.key}`, story: card.story, ask: card.ask, right: face(card.n, card.unit),
    slips: card.slips.filter((s) => Number.isInteger(s.v) && s.v > 0 && s.v !== card.n).map((s) => ({ ...face(s.v, card.unit), slip: s.slip, why: s.why })),
    rightWhy: card.why, sum: card.sum || undefined, picFirst: !!card.lead, lead: card.lead || undefined,
    help: { title: card.help.title, line: card.help.line, steps: card.help.steps && card.help.steps.length ? card.help.steps : undefined, svg: pic ? cargoPic(pic) : undefined },
    own: card.own, credit: card.credit || [], facts: { step, k, key: card.key, n: card.n }, size: Array.isArray(card.sum) ? card.sum.length : 1,
  }, rand);
}

// ── the job's own maker: the run's next card at the level's step (live: the run, src/jobs/cargolink.js; none: a card
// from a run made up, for the levels page and the tests) ───────────────────────────────────────────────────────────
export const MAKERS = {
  load: {
    strand: 'words', at: (step) => STEPS[Math.max(1, Math.min(STEPS.length, step)) - 1].grade,
    make(step, { rand = Math.random, live = null } = {}) {
      if (live && live.chain) { const C = live.chain(step), k = Math.max(0, Math.min(CARDS - 1, live.k || 0)); return orderOf(C.cards[k], step, k, rand); }
      const C = chainAt(step, rand() < 0.5 ? 3 : 4, rand), k = Math.floor(rand() * CARDS);
      return orderOf(C.cards[k], step, k, rand);
    },
  },
};
export { seeded };

export const PLACE = {
  id: 'cargo', name: 'The shipping computer', short: 'Cargo', math: 'Packing the supply run: people, days, crates, pallets', pic: 'cargo', job: null,
  line: 'Work out the supplies to pack for the old station: meal packs and water for its people, then crates, pallets and containers.',
  levels: STEPS.map((s, i) => ({ id: s.id, title: s.title, line: s.line, grade: s.grade, strand: 'words', gen: { mix: [{ maker: 'load', step: i + 1, w: 1 }] } })),
};

export const JOB = {
  dark: true,      // its pictures drawn dark, with light lines (as the pilot's and the drill's)
  id: 'cargo', name: 'The shipping computer', short: 'Cargo', open: true,
  // where the job is: at the shipping desk in Cargo, in front of its right-hand screen (Gus sits at the desk's middle;
  // its printer is at the other end), facing it
  spot: { piece: 'shipDesk', room: 'store', local: [0.65, 0, 0.72], face: [0, -1] },
  near: 1.2,
  sign: 'Shipping computer', hint: 'Work out the supplies to pack',
  place: PLACE, makers: MAKERS,
  card: 'manifest', link: 'cargo',
};
