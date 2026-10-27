// DECIMALS at the store counter: the Decimals strand's maker (map `dec` in src/math/strands.js, points 40 45 50 55 60
// 66), with dollars and cents and pounds of coffee: the store is where decimals are everyday things. The kid taps one
// of 4 answers. src/math/counter.js turns what this makes into an order slip; src/ui/counterpics.js draws its pictures.
//
// The steps (STEPS below):
//   1 (40) tenths: a pan of cornbread in 10 pieces, 3 eaten: 0.3 of the pan (the pan drawn on the slip)
//   2 (45) hundredths (45¢ is 0.45 of a dollar), and which decimal is bigger (0.5 or 0.45)
//   3 (50) adding and taking away (2.5 pounds and 1.75 pounds; 3.2 − 1.45)
//   4 (55) times and divided by 10 and 100 (10 candles for $4.50: one is $0.45)
//   5 (60) multiplying (6 pounds at $0.40; boards 2.5 feet long end to end; 0.3 × 0.2)
//   6 (66) dividing ($2.40 shared by 4; how many 0.5-pound bags in 3 pounds; 1.2 ÷ 0.3)
// The wrong answers are the slips kids really make with decimals: 3 tenths written 3.10 or 0.03, a longer decimal
// taken to be bigger (0.45 > 0.5), the parts after the point added as whole numbers (2.5 + 1.75 = 3.80), the smaller
// digit taken from the bigger (3.20 − 1.45 = 2.25), a zero put on the end to times by 10 (2.5 × 10 = 2.50), the point
// moved the wrong way or too far, the point forgotten (6 × $0.40 = $24.00), the places not counted (0.3 × 0.2 = 0.6),
// the whole numbers and the parts after the point multiplied apart (2.5 × 4 = 8.20), multiplied instead of divided.
// Numbers are kept as whole numbers of tenths or hundredths and printed by counterkit's dec(), so no rounding slips
// creep in. Every coin's value (v) is in millionths, so 0.5 and 0.50 can never both be coins.
//
// Each core with a sum in it names it (core.sum) in the question's own numbers, for the tools' Work it out: 2.6 × 6 for
// the fence boards (the working says 6 × 26 tenths), $0.80 × 6 for coffee by the pound, $2.20 ÷ 4 shared.
//
//   make(t, step, f, { frac }) -> core (see src/math/counter.js); STEPS: [{ label }]
import { dec, usd } from './counterkit.js';
import { mulAt } from './longwork.js';

export const STEPS = [
  { label: 'Tenths (0.3 is three tenths)' },
  { label: 'Hundredths, and which decimal is bigger (0.5 or 0.45)' },
  { label: 'Adding and taking away decimals (2.5 + 1.75)' },
  { label: 'Times and divided by 10 and 100' },
  { label: 'Multiplying decimals (6 × 0.4, 0.3 × 0.2)' },
  { label: 'Dividing decimals ($2.40 ÷ 4, 3 ÷ 0.5)' },
];

// a value in millionths (the coins' v): V(0.45) -> 450000
const V = (x) => Math.round(x * 1e6);
// a coin from a whole number of tenths (places 1) or hundredths (places 2): N(45, 2) -> '0.45'. trim: '25.0' -> '25'.
// money: n is cents, printed as dollars and cents. unit: the small word under the number.
const N = (n, places, { unit = '', money = false, trim = false } = {}) => {
  const x = n / 10 ** places, label = money ? usd(n) : dec(n, places, { trim });
  return { v: V(x), big: label, small: unit, label: unit ? `${label} ${unit}` : label };
};
// a coin with a given label and value (a slip that looks a certain way: '3.10', '2.50')
const L = (label, x, unit = '') => ({ v: V(x), big: label, small: unit, label: unit ? `${label} ${unit}` : label });
const she = (f) => (f.she ? 'she' : 'he');

// 1: tenths
function tenths(t, f, frac) {
  const k = t.int(1, 9);
  if (frac > 0.6 && t.chance(0.5)) {
    // the other way round: a decimal read as tenths
    const C = (n) => ({ v: V(n), big: String(n), small: n === 1 ? 'tenth' : 'tenths', label: `${n} ${n === 1 ? 'tenth' : 'tenths'}` });
    return {
      key: 'dec:tenths:say', story: `The scale at the counter says ${dec(k, 1)} pound.`, ask: 'How many tenths of a pound is that?',
      right: C(k),
      slips: [
        { ...C(k * 10), slip: 'hundredths', why: `${k * 10} tenths would be ${k} whole pounds. The first place after the point is tenths.` },
        { ...C(10 - k), slip: 'rest', why: `${10 - k} tenths is what's missing to make a whole pound.` },
        { ...C(1), slip: 'one', why: `0.1 is 1 tenth. ${dec(k, 1)} has a ${k} in the tenths place.` },
        { ...C(k + 1), slip: 'off', why: 'Read the digit just after the point: that many tenths.' },
      ],
      pic: { kind: 'tenths', n: 10, shaded: k, help: true, what: 'bar' },
      rightWhy: `${dec(k, 1)} has ${k} in the tenths place: ${k} tenths of a pound`,
      credit: [], facts: { k, form: 'say' },
    };
  }
  const ctx = t.pick([
    { key: 'pan', story: `Cookie cut a pan of cornbread into 10 equal pieces, and the trail hands ate ${k} of them.`, ask: 'What part of the pan did they eat, as a decimal?', what: 'pan', done: 'eaten' },
    { key: 'fence', story: `${f.name}'s new fence is 1 mile long, built in 10 equal stretches. ${k} ${k === 1 ? 'stretch is' : 'stretches are'} done.`, ask: 'How much of the mile is done, as a decimal?', what: 'mile', done: 'done' },
    { key: 'cheese', story: `A wheel of cheese is cut into 10 equal wedges. ${f.name} buys ${k} ${k === 1 ? 'wedge' : 'wedges'}.`, ask: 'What part of the wheel is that, as a decimal?', what: 'wheel', done: 'bought' },
  ]);
  return {
    key: `dec:tenths:${ctx.key}`, story: ctx.story, ask: ctx.ask, right: N(k, 1),
    slips: [
      { ...L(`${k}.10`, k + 0.1), slip: 'tenAsDecimal', why: `${k}.10 is more than ${k} whole ${ctx.what}s. ${k} out of 10 is written 0.${k}: ${k} tenths.` },
      { ...N(k, 2), slip: 'hundredths', why: `0.0${k} is ${k} hundredths: ${k} pieces of 100. These are pieces of 10: tenths.` },
      { ...L(`${k}.0`, k), slip: 'whole', why: `${k}.0 is ${k} whole ${ctx.what}s. Only part of one is meant.` },
      { ...N(10 - k, 1), slip: 'rest', why: `0.${10 - k} is the part that's left, not the part ${ctx.done}.` },
    ],
    lead: { kind: 'tenths', n: 10, shaded: k, what: ctx.what }, pic: { kind: 'tenths', n: 10, shaded: k, help: true, what: ctx.what },
    rightWhy: `${k} of the 10 pieces is ${k} ${k === 1 ? 'tenth' : 'tenths'}: 0.${k}`,
    credit: [{ strand: 'frac', at: 28, weight: 0.5 }], facts: { k },
  };
}

// 2: hundredths, and which is bigger
const PAIRS = [[50, 45], [30, 25], [70, 65], [80, 75], [60, 58], [20, 19], [90, 89], [40, 35]];   // [a tenth as hundredths, a longer decimal just under it]
function hundredthsStep(t, f, frac) {
  if (t.chance(0.35 + 0.4 * frac)) {
    // which is heavier: the longer decimal is the bigger one only some of the time (no shortcut by length)
    const [x, y] = t.pick(PAIRS), longerWins = t.chance(0.4);
    const a = longerWins ? x + t.int(1, 4) : x, b = longerWins ? x : y;   // hundredths, a > b
    const A = dec(a, 2, { trim: true }), B = dec(b, 2, { trim: true });
    const thing = t.pick([['sack of salt', 'sacks of salt'], ['block of butter', 'blocks of butter'], ['bag of nails', 'bags of nails'], ['tin of tea', 'tins of tea']]);
    const [first, second] = t.chance(0.5) ? [A, B] : [B, A];
    const W = (s, x2) => ({ v: x2, big: `${s} pound`, small: '', label: `${s} pound` });
    const line = `Line them up by the point: ${dec(a, 2)} and ${dec(b, 2)}. ${a} hundredths is more than ${b} hundredths.`;
    return {
      key: `dec:compare:${thing[0]}`, story: `${f.name} has two ${thing[1]}: one weighs ${first} pound, the other ${second} pound.`, ask: 'Which one is heavier?',
      right: W(A, V(a / 100)),
      slips: [
        { ...W(B, V(b / 100)), slip: longerWins ? 'shorterBigger' : 'longerBigger', why: line },
        { v: 'same', big: 'The same', small: '', label: 'They weigh the same', slip: 'same', why: `They aren't the same. ${line}` },
      ],
      wide: true, pic: { kind: 'grid', values: [a, b], labels: [A, B] },
      rightWhy: `${dec(a, 2)} is ${a} hundredths, more than ${b} hundredths: the ${A} pound one is heavier`,
      credit: [], facts: { a, b },
    };
  }
  // so many cents as part of a dollar
  let c = t.int(11, 95);
  if (c % 10 === 0) c += 3;
  return {
    key: 'dec:cents', story: `${f.name} pays ${c}¢ for a spool of thread.`, ask: 'What part of a dollar is that, as a decimal?',
    right: N(c, 2),
    slips: [
      { ...N(c, 1), slip: 'tenths', why: `${dec(c, 1)} is more than ${Math.floor(c / 10)} whole dollars. ${c}¢ is ${c} hundredths of a dollar.` },
      { ...L(dec(c, 3), c / 1000), slip: 'thousandths', why: `${dec(c, 3)} is ${c} thousandths. A cent is one hundredth of a dollar: 2 places after the point.` },
      { ...L(`${c}.00`, c), slip: 'whole', why: `${c}.00 would be ${c} dollars, not ${c} cents.` },
      { ...N(100 - c, 2), slip: 'rest', why: `${dec(100 - c, 2)} is the rest of the dollar, the part not spent.` },
    ],
    pic: { kind: 'grid', values: [c], labels: [`${c}¢`] },
    rightWhy: `A cent is one hundredth of a dollar: ${c}¢ is ${c} hundredths, ${dec(c, 2)}`,
    credit: [{ strand: 'money', at: 40, weight: 0.5 }], facts: { c },
  };
}

// 3: adding and taking away (the points lined up)
function addSub(t, f, frac) {
  for (let tries = 0; tries < 80; tries++) {
    const a = t.int(11, 59) * 10, b = t.int(105, 295);   // hundredths: a has one place (2.5), b two (1.75)
    if (b % 10 === 0 || a % 100 === 0) continue;
    const P = (n) => N(n, 2, { unit: 'pounds' });
    if (t.chance(0.5 - 0.2 * frac) || a <= b) {
      // adding: 2.5 + 1.75
      const s = a + b, tenthsDigit = (a % 100) / 10, bPart = b % 100;
      const slips = [];
      if (tenthsDigit + bPart < 100) slips.push({ ...P((Math.floor(a / 100) + Math.floor(b / 100)) * 100 + tenthsDigit + bPart), slip: 'wholeParts', why: `The ${tenthsDigit} after the point is ${tenthsDigit} tenths, not ${tenthsDigit} hundredths: line the points up and write it ${dec(a, 2)}.` });
      slips.push({ ...P(Math.abs(a - b)), slip: 'subtracted', why: 'That takes one from the other. Both go in: add them.' },
        { ...P(s + 10), slip: 'off', why: 'One tenth too many. Line the points up and add each column.' },
        { ...P(s - 10), slip: 'off', why: 'One tenth short. Line the points up and add each column.' });
      const what = t.pick([['coffee', 'sugar'], ['nails', 'staples'], ['cheese', 'butter']]);
      return {
        key: 'dec:add', story: `${f.name} buys ${dec(a, 2, { trim: true })} pounds of ${what[0]} and ${dec(b, 2)} pounds of ${what[1]}.`, ask: 'How many pounds is that in all?',
        right: P(s), slips,
        pic: { kind: 'columns', rows: [dec(a, 2, { trim: true }), dec(b, 2)], op: '+' },
        rightWhy: `${dec(a, 2)} + ${dec(b, 2)} = ${dec(s, 2)} pounds`, sum: { op: 'add', a: a / 100, b: b / 100 },
        credit: [], facts: { a, b, op: '+', ans: s },
      };
    }
    // taking away: 3.2 − 1.45 (the bigger one has fewer places)
    const d = a - b, A = String(a).padStart(3, '0'), B = String(b).padStart(3, '0');
    const digitwise = Number([0, 1, 2].map((i) => Math.abs(Number(A[i]) - Number(B[i]))).join(''));
    const slips = [];
    if (digitwise !== d) slips.push({ ...P(digitwise), slip: 'smallerFromBigger', why: `In each column the smaller digit was taken from the bigger. Write ${dec(a, 1)} as ${dec(a, 2)}, then borrow where you need to.` });
    slips.push({ ...P(a + b), slip: 'added', why: 'Cutting some off leaves less: take away.' },
      { ...P(d + 10), slip: 'off', why: 'One tenth too many. Line the points up and take away each column.' },
      { ...P(d > 10 ? d - 10 : d + 20), slip: 'off', why: 'Line the points up and take away each column again.' });
    return {
      key: 'dec:sub', story: `A wheel of cheese weighs ${dec(a, 2, { trim: true })} pounds. ${f.name} cuts off ${dec(b, 2)} pounds for the hotel.`, ask: 'How much is left?',
      right: P(d), slips,
      pic: { kind: 'columns', rows: [dec(a, 2, { trim: true }), dec(b, 2)], op: '−' },
      rightWhy: `${dec(a, 2)} − ${dec(b, 2)} = ${dec(d, 2)} pounds`, sum: { op: 'sub', a: a / 100, b: b / 100 },
      credit: [], facts: { a, b, op: '−', ans: d },
    };
  }
  return null;
}

// 4: times and divided by 10 and 100 (the digits move a place for each 10; the point stays put)
function tens(t, f, frac) {
  const form = t.pick(frac > 0.5 ? ['one', 'many', 'hundred'] : ['one', 'many']);
  if (form === 'one') {
    // 10 candles for $4.50: one is $0.45 (in cents, so the money stays in whole cents)
    const each = 5 * t.int(3, 19), total = 10 * each;
    const g = t.pick([['box', 'candles', 'candle'], ['bundle', 'pencils', 'pencil'], ['sack', 'apples', 'apple'], ['crate', 'jars', 'jar']]);
    const M = (c) => N(c, 2, { money: true });
    return {
      key: `dec:one:${g[1]}`, story: `A ${g[0]} of 10 ${g[1]} costs ${usd(total)}.`, ask: `What does one ${g[2]} cost?`,
      right: M(each),
      slips: [
        { ...M(total * 10), slip: 'wrongWay', why: 'Times 10 makes it bigger. One costs less than 10 of them: divide by 10.' },
        { ...M(total - 10), slip: 'subtracted', why: 'That takes 10 cents off. Share it out over 10: divide by 10.' },
        { ...M(each + 5), slip: 'off', why: `10 at ${usd(each + 5)} would cost ${usd(10 * (each + 5))}. Each digit moves one place right.` },
        { ...M(each - 5), slip: 'off', why: `10 at ${usd(each - 5)} would cost only ${usd(10 * (each - 5))}. Each digit moves one place right.` },
      ],
      pic: { kind: 'shift', from: total, places: 2, by: 10, op: '÷', money: true },
      rightWhy: `${usd(total)} ÷ 10 = ${usd(each)}: every digit moves one place to the right`, sum: { op: 'div', a: total / 100, b: 10, money: true, cash: 'a' },
      credit: [], facts: { total, each, n: 10 },
    };
  }
  // one sack weighs 2.5 pounds: 10 sacks; one nail 0.03 pounds: 100 nails
  const by = form === 'hundred' ? 100 : 10, places = by === 100 ? 2 : 1;
  let one = by === 100 ? t.pick([3, 5, 2, 4, 6, 8, 12, 15, 25]) : t.int(11, 49);   // hundredths (0.03) or tenths (2.5)
  if (by === 10 && one % 10 === 0) one += t.int(1, 9);   // (never "3.0 pounds": a tenth that is there)
  const x = one / 10 ** places, ans = x * by;
  const thing = by === 100 ? t.pick([['nail', 'nails'], ['button', 'buttons'], ['horseshoe nail', 'horseshoe nails']])
    : t.pick([['side of bacon', 'sides of bacon'], ['wheel of cheese', 'wheels of cheese'], ['bolt of cloth', 'bolts of cloth']]);
  const P = (n, pl) => N(n, pl, { trim: true, unit: 'pounds' });
  const moved = by === 100 ? 'two places' : 'one place';
  return {
    key: `dec:many:${by}`, story: `One ${thing[0]} weighs ${dec(one, places)} pound${one === 10 ** places ? '' : 's'}.`, ask: `How much do ${by} ${thing[1]} weigh?`,
    right: P(one * by, places),
    slips: [
      { ...P(by === 100 ? one * 10 : one * 100, places), slip: by === 100 ? 'onePlace' : 'twoPlaces', why: `Times ${by} moves each digit ${moved} to the left, no more and no less.` },
      { ...L(dec(one, places + (by === 100 ? 2 : 1)), x / by, 'pounds'), slip: 'wrongWay', why: `That divides by ${by}. ${by} of them weigh more than one: multiply.` },
      { ...L(dec(one, places) + '0'.repeat(by === 100 ? 2 : 1), x, 'pounds'), slip: 'zeroOnEnd', why: `A zero on the end after the point doesn't change ${dec(one, places)}. Move each digit ${moved} to the left instead.` },
      { ...L(dec(one + by * 10 ** places, places), x + by, 'pounds'), slip: 'added', why: `That adds ${by}. ${by} of them is ${by} times as much.` },
    ],
    pic: { kind: 'shift', from: one, places, by, op: '×' },
    rightWhy: `${dec(one, places)} × ${by} = ${dec(one * by, places, { trim: true })} pounds: each digit moves ${moved} to the left`,
    sum: { op: 'mul', a: one / 10 ** places, b: by }, credit: [], facts: { one, places, by, ans },
  };
}

// 5: multiplying (money and lengths by a whole number, then a decimal by a decimal)
function times(t, f, frac) {
  if (frac > 0.5 && t.chance(0.45)) {
    const a = t.int(2, 9), b = t.int(2, 9), p = a * b;   // tenths: 0.3 × 0.2 = 0.06
    return {
      key: 'dec:decdec', story: `${f.name} is checking ${f.she ? 'her' : 'his'} sums at the counter.`, ask: `What is ${dec(a, 1)} × ${dec(b, 1)}?`,
      right: N(p, 2),
      slips: [
        { ...N(p, 1), slip: 'placesLost', why: `Count the places: one after the point in ${dec(a, 1)}, one in ${dec(b, 1)}, so two in the answer.` },
        { ...L(String(p), p), slip: 'whole', why: `${a} × ${b} = ${p}, but these are tenths: a tenth of a tenth is a hundredth, so it's far smaller than ${p}.` },
        { ...N(a + b, 1), slip: 'added', why: 'That adds them. Times is the area of the box: one side times the other.' },
        { ...L(dec(p, 3), p / 1000), slip: 'tooMany', why: 'Three places is too many: one place in each number makes two.' },
      ],
      pic: { kind: 'area', a, b },
      rightWhy: `${a} × ${b} = ${p}, and tenths times tenths are hundredths: ${dec(p, 2)}`, sum: { op: 'mul', a: a / 10, b: b / 10 },
      credit: [{ strand: 'mul', at: mulAt(a, b), weight: 0.5 }], facts: { a, b, p },
    };
  }
  if (t.chance(0.5)) {
    // money: $0.40 a pound, 6 pounds
    const n = t.int(2, 9), each = 10 * t.int(1, 9) + (frac > 0.4 && t.chance(0.4) ? 5 : 0), total = n * each;
    const what = t.pick(['coffee', 'sugar', 'rice', 'nails', 'beans']);
    const M = (c) => N(c, 2, { money: true });
    return {
      key: `dec:price:${what}`, story: `${f.name} wants ${n} pounds of ${what} at ${usd(each)} a pound.`, ask: `How much does ${she(f)} pay?`,
      right: M(total),
      slips: [
        { ...M(total * 10), slip: 'pointLost', why: `${n} × ${each} = ${total}, but those are cents: ${total} cents.` },
        { ...M(Math.round(total / 10)), slip: 'pointFar', why: `${usd(each)} is ${each} cents; ${n} lots of ${each} cents is ${total} cents.` },
        { ...M(each + n * 100), slip: 'added', why: 'That adds the pounds on. Every pound costs the price: multiply.' },
        { ...M(total + each), slip: 'groupOff', why: `That's ${n + 1} pounds. ${f.she ? 'She' : 'He'} wants ${n}.` },
      ],
      pic: { kind: 'bars', n, label: usd(each), line: `${n} pounds at ${usd(each)} each: ${n} lots of ${each} cents.` },
      rightWhy: `${n} × ${each}¢ = ${total}¢ = ${usd(total)}`, sum: { op: 'mul', a: each / 100, b: n, money: true, cash: 'a' },
      credit: each % 10 === 0 ? [{ strand: 'mul', at: mulAt(n, each / 10), weight: 0.5 }] : [], facts: { n, each, total },
    };
  }
  // lengths: boards 2.5 feet long, laid end to end
  const n = t.int(2, 9), one = t.pick([11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 32, 35]), p = n * one;   // tenths
  const F = (n2, pl) => N(n2, pl, { trim: pl === 1, unit: 'feet' });
  return {
    key: 'dec:boards', story: `Each fence board is ${dec(one, 1)} feet long. ${f.name} lays ${n} of them end to end.`, ask: 'How long is the row?',
    right: F(p, 1),
    slips: [
      { ...F(Math.floor(one / 10) * n * 100 + (one % 10) * n, 2), slip: 'partsApart', why: `${n} × ${one % 10} tenths is ${n * (one % 10)} tenths, and every 10 tenths make another whole foot.` },
      { ...F(p, 2), slip: 'pointFar', why: `Only one place after the point in ${dec(one, 1)}, so only one in the answer.` },
      { ...F(p * 10, 1), slip: 'pointLost', why: `${n} × ${one} = ${p}, but those are tenths of a foot: ${p} tenths.` },
      { ...F(one + n * 10, 1), slip: 'added', why: 'That adds the count on. End to end, every board adds its whole length: multiply.' },
    ],
    pic: { kind: 'bars', n, label: dec(one, 1), line: `${n} boards of ${dec(one, 1)} feet: ${n} lots of ${one} tenths.` },
    rightWhy: `${n} × ${one} tenths = ${p} tenths = ${dec(p, 1, { trim: true })} feet`, sum: { op: 'mul', a: one / 10, b: n },
    credit: [], facts: { n, one, p },
  };
}

// 6: dividing
function divide(t, f, frac) {
  const form = t.pick(frac < 0.4 ? ['share', 'bags'] : ['share', 'bags', 'rope']);
  if (form === 'share') {
    const n = t.int(2, 6), each = 5 * t.int(4, 30), total = n * each;   // cents
    const M = (c) => N(c, 2, { money: true });
    return {
      key: 'dec:share', story: `${f.name} shares ${usd(total)} evenly among ${n} children for the fair.`, ask: 'How much does each child get?',
      right: M(each),
      slips: [
        { ...M(each * 10), slip: 'pointLost', why: `${n} children with ${usd(each * 10)} each would need ${usd(n * each * 10)}. Check by multiplying back.` },
        { ...M(Math.max(1, Math.round(each / 10))), slip: 'pointFar', why: `${usd(total)} is ${total} cents; ${total} cents shared by ${n} is more than that each.` },
        { ...M(total - n), slip: 'subtracted', why: `That takes ${n} cents off. Share it out: divide.` },
        { ...M(total * n), slip: 'multiplied', why: 'Sharing gives each child less than the whole: divide.' },
      ],
      pic: { kind: 'share', total, groups: n, per: null, box: ['child', 'children'], thing: ['cent', 'cents'] },
      rightWhy: `${usd(total)} is ${total} cents; ${total} ÷ ${n} = ${each} cents: ${usd(each)} each`, sum: { op: 'div', a: total / 100, b: n, money: true, cash: 'a' },
      credit: [], facts: { n, total, each },
    };
  }
  const C = (x, word) => ({ v: V(x), big: Number.isInteger(x) ? String(x) : dec(Math.round(x * 100), 2, { trim: true }), small: word, label: `${Number.isInteger(x) ? x : dec(Math.round(x * 100), 2, { trim: true })} ${word}` });
  if (form === 'bags') {
    const [part, wholes] = t.pick([[0.5, [2, 3, 4, 5, 6, 7]], [0.25, [1, 2, 3]], [0.2, [1, 2]], [0.5, [2, 3, 4]]]);
    const whole = t.pick(wholes), n = Math.round(whole / part), P = String(part), digit = Number(P.replace(/^0\.0*/, ''));
    const slips = [
      { ...C(Math.round(whole * part * 100) / 100, 'bags'), slip: 'multiplied', why: `${whole} × ${P} is less than ${whole}. How many ${P}s fit into ${whole}? Divide.` },
      { ...C(Math.round((whole - part) * 100) / 100, 'bags'), slip: 'subtracted', why: `That takes one bag away. Count how many ${P}s make ${whole}.` },
      { ...C(n * 10, 'bags'), slip: 'pointFar', why: `${n * 10} bags of ${P} would be ${Math.round(n * 10 * part * 100) / 100} pounds.` },
    ];
    if (whole / digit < 1 && Number.isFinite(whole / digit)) slips.push({ ...C(Math.round(whole / digit * 100) / 100, 'bags'), slip: 'pointIgnored', why: `That's ${whole} ÷ ${digit}, the point left out. Each bag is ${P} of a pound, much less than ${digit} pounds.` });
    return {
      key: `dec:bags:${P}`, story: `${f.name} has ${whole} pound${whole === 1 ? '' : 's'} of tea to put into little bags of ${P} pound each.`, ask: 'How many bags can be filled?',
      right: C(n, 'bags'), slips,
      pic: { kind: 'fit', whole, part, label: P },
      rightWhy: `${whole} ÷ ${P} = ${n}: ${n} bags of ${P} make ${whole} pound${whole === 1 ? '' : 's'}`, sum: { op: 'div', a: whole, b: part },
      credit: [], facts: { whole, part, n },
    };
  }
  // a 1.2-foot rope cut into 0.3-foot pieces: 4
  const b = t.int(2, 9), q = t.int(2, 9), a = b * q;   // tenths
  return {
    key: 'dec:rope', story: `${f.name} cuts a ${dec(a, 1)}-foot rope into pieces ${dec(b, 1)} foot long.`, ask: 'How many pieces does that make?',
    right: C(q, 'pieces'),
    slips: [
      { ...C(q / 10, 'pieces'), slip: 'pointKept', why: `Not even one piece? Count how many ${dec(b, 1)}s fit into ${dec(a, 1)}: ${dec(b, 1)}, ${dec(2 * b, 1)}, ...` },
      { ...C(q * 10, 'pieces'), slip: 'pointFar', why: `${q * 10} pieces of ${dec(b, 1)} would make ${dec(q * 10 * b, 1, { trim: true })} feet.` },
      { ...C(a * b / 100, 'pieces'), slip: 'multiplied', why: 'That multiplies. Cutting into pieces: divide.' },
      { ...C(q + 1, 'pieces'), slip: 'off', why: `${q + 1} pieces of ${dec(b, 1)} would need ${dec((q + 1) * b, 1)} feet.` },
    ],
    pic: { kind: 'fit', whole: a / 10, part: b / 10, label: dec(b, 1) },
    rightWhy: `${dec(a, 1)} ÷ ${dec(b, 1)} is the same as ${a} ÷ ${b} (both in tenths) = ${q}`, sum: { op: 'div', a: a / 10, b: b / 10 },
    credit: [{ strand: 'div', at: 37, weight: 0.5 }], facts: { a, b, q },
  };
}

const MAKE = [tenths, hundredthsStep, addSub, tens, times, divide];
export function make(t, step, f, { frac = 0 } = {}) {
  return MAKE[Math.max(1, Math.min(MAKE.length, step)) - 1](t, f, frac);
}
