// PERCENT at the store counter: the Percent strand's maker (map `pct` in src/math/strands.js, points 58 62 66 72 76).
// Sales, tax, a price that went up, money in the bank. The kid taps one of 4 answers. src/math/counter.js turns what
// this makes into an order slip; src/ui/counterpics.js draws its pictures (a bar cut into equal parts).
//
// The steps (STEPS below):
//   1 (58) 50%, 25% and 10% of a number (10% off a $40 blanket: $4 comes off; 25% of 20 sacks)
//   2 (62) any percent of a number (30% of 60 pounds: 10% is 6, so 30% is 18)
//   3 (66) discounts and tax: the new price (a $60 coat at 20% off: $48; $50 and 8% tax: $54)
//   4 (72) how much it went up or down, in percent (flour from $4 to $5: up 25%)
//   5 (76) simple interest ($200 in the bank at 5% a year for 3 years: $30 interest)
// The wrong answers are the slips kids really make with percent: the percent read as so many dollars (10% of $40 is
// $10), the part that comes off given as the new price (or the new price for the part), "off" added on, 10% taken for
// every percent, the change divided by the new price instead of the old one, one year's interest for several, the
// interest and the money in the bank mixed up. Numbers are picked so every answer is a whole number of dollars (or
// sacks, or pounds).
//
//   make(t, step, f, { frac }) -> core (see src/math/counter.js); STEPS: [{ label }]
import { u } from './counterkit.js';

export const STEPS = [
  { label: '50%, 25% and 10% of a number' },
  { label: 'Any percent of a number (30% of 60)' },
  { label: 'Discounts and tax: the new price' },
  { label: 'How much it went up or down, in percent' },
  { label: 'Simple interest' },
];

// coin faces: dollars, a count with its unit, a percent
const $ = (n) => ({ v: n, big: `$${n}`, small: n === 1 ? 'dollar' : 'dollars', label: `$${n}` });
const C = (n, unit) => ({ v: n, big: String(n), small: n === 1 ? unit[0] : unit[1], label: u(n, unit) });
const P = (n) => ({ v: `p${n}`, big: `${n}%`, small: '', label: `${n}%` });
const ITEMS = ['saddle blanket', 'pair of boots', 'wool coat', 'rocking chair', 'cast-iron stove', 'set of harness', 'brass lamp', 'leather satchel'];
const she = (f) => (f.she ? 'she' : 'he');

// 1: 50%, 25% and 10% of a number
function simple(t, f, frac) {
  const pct = t.pick(frac < 0.4 ? [50, 10, 25] : [10, 25, 50, 10, 25]), n = 100 / pct;
  if (t.chance(0.5)) {
    const whole = (pct === 10 ? 10 : 4) * t.int(2, pct === 50 ? 12 : 10), part = whole * pct / 100, item = t.pick(ITEMS);
    return {
      key: `pct:off:${pct}`, story: `The ${item} is $${whole}, and this week the store takes ${pct}% off.`, ask: 'How many dollars come off?',
      right: $(part),
      slips: [
        { ...$(pct), slip: 'percentDollars', why: `${pct}% isn't $${pct}. ${pct}% means ${pct} out of every 100: ${pct === 50 ? 'half' : pct === 25 ? 'a quarter' : 'a tenth'} of the price.` },
        { ...$(whole - part), slip: 'newPrice', why: `$${whole - part} is what's left to pay. The question is how much comes off.` },
        ...(pct !== 50 ? [{ ...$(whole / 2), slip: 'half', why: `$${whole / 2} is half: that's 50% off. ${pct}% is ${pct === 25 ? 'half of a half' : 'one part in ten'}.` }] : [{ ...$(whole / 4), slip: 'quarter', why: `$${whole / 4} is a quarter, 25%. 50% is half.` }]),
        { ...$(part * 2), slip: 'twice', why: `That's twice as much. Cut $${whole} into ${n} equal parts: ${pct}% is one of them.` },
      ].filter((s) => s.v > 0 && Number.isInteger(s.v)),
      pic: { kind: 'pctbar', whole, n, take: 1, unit: 'money', mode: 'part' },
      rightWhy: `${pct}% is 1 part in ${n}: $${whole} ÷ ${n} = $${part}`,
      credit: [{ strand: 'frac', at: 40, weight: 0.5 }], facts: { whole, pct, part },
    };
  }
  const unit = t.pick([['sack', 'sacks'], ['steer', 'steers'], ['egg', 'eggs'], ['pound', 'pounds']]);
  const whole = n * t.int(3, pct === 10 ? 9 : 12), part = whole / n;
  const ctx = {
    sack: `The store had ${whole} sacks of oats, and ${pct}% of them are sold already.`,
    steer: `${f.name}'s herd has ${whole} steers, and ${pct}% of them are going to market.`,
    egg: `${f.name} brought in ${whole} eggs, and ${pct}% of them are brown.`,
    pound: `The barrel holds ${whole} pounds of pickles, and ${pct}% of them are sold.`,
  }[unit[0]];
  return {
    key: `pct:of:${unit[0]}:${pct}`, story: ctx, ask: `How many ${unit[1]} is that?`,
    right: C(part, unit),
    slips: [
      { ...C(pct, unit), slip: 'percentCount', why: `${pct}% isn't ${pct} ${unit[1]}. It means ${pct} out of every 100: here ${pct === 50 ? 'half' : pct === 25 ? 'a quarter' : 'a tenth'} of ${whole}.` },
      { ...C(whole - part, unit), slip: 'rest', why: `${whole - part} is the rest, the ${100 - pct}%.` },
      { ...C(pct === 50 ? whole / 4 : whole / 2, unit), slip: 'wrongPart', why: `That's ${pct === 50 ? 'a quarter (25%)' : 'half (50%)'}. ${pct}% is ${pct === 50 ? 'half' : pct === 25 ? 'half of a half' : 'one part in ten'}.` },
      { ...C(part + 1, unit), slip: 'off', why: `Cut ${whole} into ${n} equal parts again: ${pct}% is one of them.` },
    ].filter((s) => s.v > 0 && Number.isInteger(s.v)),
    pic: { kind: 'pctbar', whole, n, take: 1, unit, mode: 'part' },
    rightWhy: `${pct}% is 1 part in ${n}: ${whole} ÷ ${n} = ${part}`,
    credit: [{ strand: 'frac', at: 40, weight: 0.5 }], facts: { whole, pct, part },
  };
}

// 2: any percent of a number: 10% first, then so many 10%s (or 5%s)
function anyPct(t, f, frac) {
  for (let tries = 0; tries < 60; tries++) {
    const pct = t.pick(frac < 0.5 ? [20, 30, 40, 60, 70, 80, 90] : [15, 30, 35, 45, 60, 75, 5, 40]);
    const tenth = t.int(2, 12), whole = (pct % 10 ? 20 : 10) * tenth, part = whole * pct / 100;
    if (!Number.isInteger(part) || whole === 100) continue;   // (of 100, the percent IS the count: no slip to make)
    const unit = t.pick([['pound', 'pounds'], ['steer', 'steers'], ['mile', 'miles']]);
    const story = unit[0] === 'pound' ? `${f.name} brought ${whole} pounds of wool to the store, and ${pct}% of it is the best grade.`
      : unit[0] === 'steer' ? `The Bar T has ${whole} steers, and ${pct}% of them are going on the drive north.`
        : `The stage road to Tucson is ${whole} miles, and ${pct}% of it runs along the river.`;
    const ten = whole / 10;
    return {
      key: `pct:any:${unit[0]}`, story, ask: `How many ${unit[1]} is that?`, right: C(part, unit),
      slips: [
        { ...C(pct, unit), slip: 'percentCount', why: `${pct}% isn't ${pct} ${unit[1]}: it's ${pct} out of every 100. 10% of ${whole} is ${ten}.` },
        { ...C(whole - part, unit), slip: 'rest', why: `${whole - part} is the other ${100 - pct}%.` },
        { ...C(ten, unit), slip: 'tenOnly', why: `${ten} is 10%. ${pct}% is ${pct / 10} lots of that.` },
        { ...C(part + ten, unit), slip: 'tenOff', why: `That's 10% too much: ${pct + 10}%. Count the 10%s again.` },
        { ...C(whole / pct, unit), slip: 'divided', why: `Dividing by ${pct} doesn't give ${pct}%. Find 10% (÷ 10) first, then build ${pct}% from it.` },
      ].filter((s) => s.v > 0 && Number.isInteger(s.v)),
      pic: { kind: 'pctbar', whole, n: pct % 10 ? 20 : 10, take: pct % 10 ? pct / 5 : pct / 10, unit, mode: 'part' },
      rightWhy: pct === 5 ? `10% of ${whole} is ${ten}, and 5% is half of that: ${part}`
        : pct % 10 ? `10% of ${whole} is ${ten} and 5% is ${ten / 2}: ${pct}% is ${Math.floor(pct / 10)} × ${ten} + ${ten / 2} = ${part}`
          : `10% of ${whole} is ${ten}, so ${pct}% is ${pct / 10} × ${ten} = ${part}`,
      credit: [], facts: { whole, pct, part },
    };
  }
  return null;
}

// 3: discounts and tax: the new price
function newPrice(t, f, frac) {
  if (t.chance(0.55)) {
    const pct = t.pick([10, 20, 25, 30, 40, 15]), base = pct === 25 ? 4 : pct === 15 ? 20 : 10;
    const price = base * t.int(pct === 15 ? 2 : 3, pct === 15 ? 6 : 12), off = price * pct / 100, pay = price - off, item = t.pick(ITEMS);
    return {
      key: `pct:sale:${pct}`, story: `The ${item} is $${price}, and it's on sale at ${pct}% off.`, ask: `What does ${f.name} pay for it?`,
      right: $(pay),
      slips: [
        { ...$(off), slip: 'discountOnly', why: `$${off} is the ${pct}% that comes off. Take it away from the $${price}.` },
        { ...$(price - pct), slip: 'percentDollars', why: `${pct}% off isn't $${pct} off. ${pct}% of $${price} is $${off}.` },
        { ...$(price + off), slip: 'added', why: `"Off" makes the price smaller: take the $${off} away.` },
        { ...$(price - price / 10), slip: 'tenOnly', why: `That's only 10% off. ${pct}% is more.` },
      ].filter((s) => s.v > 0 && Number.isInteger(s.v)),
      pic: { kind: 'pctbar', whole: price, n: pct % 10 ? (pct === 25 ? 4 : 20) : 10, take: pct % 10 ? (pct === 25 ? 1 : 3) : pct / 10, unit: 'money', mode: 'off' },
      rightWhy: `${pct}% of $${price} is $${off}, and $${price} − $${off} = $${pay}`,
      credit: [{ strand: 'words', at: 66, weight: 0.5 }], size: 2, facts: { price, pct, pay },
    };
  }
  const pct = t.pick([5, 8, 10, 6, 4]), price = (pct === 8 || pct === 6 || pct === 4 ? 50 : 20) * t.int(1, 6), tax = price * pct / 100, pay = price + tax;
  const item = t.pick(['new plow', 'wagon wheel', 'sewing machine', 'barrel of flour', 'saddle']);
  return {
    key: `pct:tax:${pct}`, story: `A ${item} costs $${price}, and the territory adds ${pct}% tax.`, ask: `What does ${f.name} pay with the tax?`,
    right: $(pay),
    slips: [
      { ...$(tax), slip: 'taxOnly', why: `$${tax} is just the tax. ${she(f) === 'she' ? 'She' : 'He'} pays the price and the tax.` },
      { ...$(price + pct), slip: 'percentDollars', why: `${pct}% isn't $${pct}: it's ${pct} dollars for every $100. Here that's $${tax}.` },
      { ...$(price - tax), slip: 'off', why: 'Tax is added on: it costs more, not less.' },
      { ...$(price + price / 10), slip: 'tenOnly', why: `$${price / 10} is 10%. ${pct}% is ${pct < 10 ? 'less' : 'that'}.` },
    ].filter((s) => s.v > 0 && Number.isInteger(s.v)),
    pic: { kind: 'pctbar', whole: price, n: 100 / (pct === 8 || pct === 6 || pct === 4 ? 2 : 5), take: pct / (pct === 8 || pct === 6 || pct === 4 ? 2 : 5), unit: 'money', mode: 'tax' },
    rightWhy: `${pct}% of $${price} is $${tax}, and $${price} + $${tax} = $${pay}`,
    credit: [{ strand: 'words', at: 66, weight: 0.5 }, { strand: 'money', at: 70, weight: 0.5 }], size: 2, facts: { price, pct, pay },
  };
}

// 4: how much it went up or down, in percent of where it started
// (every pair a whole percent; the easier half of the step has every rise and the plainest falls)
const UPS = [[4, 5], [20, 25], [40, 50], [8, 10], [80, 100], [10, 15], [20, 30], [50, 60], [10, 12], [25, 30],
  [5, 6], [12, 15], [16, 20], [30, 36], [50, 75], [60, 75], [40, 44], [25, 35], [10, 13], [20, 22], [60, 90], [40, 60]];
const DOWNS = [[50, 40], [25, 20], [10, 8], [80, 60], [20, 16], [40, 36], [100, 75], [40, 30], [20, 15], [60, 45],
  [200, 150], [30, 27], [75, 60], [16, 12], [12, 9], [90, 72], [50, 35], [60, 48]];
export const CHANGES = [...UPS, ...DOWNS];
function change(t, f, frac) {
  const [old, now] = t.pick(frac < 0.5 ? UPS.concat(DOWNS.slice(0, 6)) : CHANGES);
  const up = now > old, diff = Math.abs(now - old), pct = Math.round(diff / old * 100);
  const money = old <= 25 && t.chance(0.7);
  const story = money
    ? `A sack of flour cost $${old} last year. Now it costs $${now}.`
    : `${f.name}'s herd ${up ? 'grew' : 'shrank'} from ${old} head to ${now} head this year.`;
  const byNew = diff / now * 100;
  const slips = [
    { ...P(diff), slip: 'difference', why: `${money ? `$${diff}` : `${diff} head`} is how much it changed. As a percent, compare it with where it started: ${diff} out of ${old}.` },
    ...(Number.isInteger(byNew) && byNew !== pct ? [{ ...P(byNew), slip: 'byNew', why: `That compares the change with the new ${money ? 'price' : 'number'}. Percent up or down is out of where it started: ${old}.` }] : []),
    { ...P(Math.round(now / old * 100)), slip: 'ratio', why: `${Math.round(now / old * 100)}% is the new ${money ? 'price' : 'herd'} as a percent of the old one. The question is how much it ${up ? 'went up' : 'went down'}.` },
    { ...P(100 - pct), slip: 'rest', why: `${100 - pct}% is the rest. ${diff} out of ${old} is the change.` },
  ].filter((s) => s.v !== `p${pct}` && Number(s.big.replace('%', '')) > 0);
  return {
    key: `pct:change:${old}:${now}`, story, ask: `By what percent did it go ${up ? 'up' : 'down'}?`,
    right: P(pct), slips,
    pic: { kind: 'change', old, now, money },
    rightWhy: `It went ${up ? 'up' : 'down'} by ${money ? `$${diff}` : `${diff} head`}, and ${diff} out of ${old} is ${pct}%`,
    credit: [{ strand: 'frac', at: 50, weight: 0.5 }], size: 2, facts: { old, now, pct },
  };
}

// 5: simple interest
function interest(t, f, frac) {
  for (let tries = 0; tries < 40; tries++) {
    const P0 = t.pick([100, 200, 300, 400, 500, 1000]), r = t.pick([2, 3, 4, 5, 10]), yrs = t.int(2, 5);
    const one = P0 * r / 100, I = one * yrs, askTotal = t.chance(0.25 + 0.5 * frac);
    if (!Number.isInteger(one)) continue;
    return {
      key: `pct:interest:${askTotal ? 'total' : 'interest'}`, story: `${f.name} puts $${P0} in the bank at ${r}% interest a year, and leaves it there for ${yrs} years.`,
      ask: askTotal ? `How much is in the bank after ${yrs} years?` : 'How much interest does it earn?',
      right: $(askTotal ? P0 + I : I),
      slips: [
        { ...$(askTotal ? P0 + one : one), slip: 'oneYear', why: `$${one} is the interest for one year. It stays in for ${yrs} years.` },
        { ...$(askTotal ? I : P0 + I), slip: askTotal ? 'interestOnly' : 'total', why: askTotal ? `$${I} is just the interest. The $${P0} is still in the bank too.` : `$${P0 + I} is everything in the bank. The interest is only what was added.` },
        { ...$(askTotal ? P0 + r * yrs : r * yrs), slip: 'percentDollars', why: `${r}% a year isn't $${r} a year: it's $${r} for every $100. Here that's $${one} a year.` },
        { ...$(askTotal ? P0 * yrs : one * (yrs + 1)), slip: askTotal ? 'timesYears' : 'extraYear', why: askTotal ? 'The money itself isn\'t multiplied by the years: only the interest is added each year.' : `That's ${yrs + 1} years of interest. It's in for ${yrs}.` },
      ].filter((s) => s.v > 0),
      pic: { kind: 'interest', P: P0, r, years: yrs, total: askTotal },
      rightWhy: `${r}% of $${P0} is $${one} a year; ${yrs} years is $${I}${askTotal ? `, so $${P0} + $${I} = $${P0 + I}` : ''}`,
      credit: [{ strand: 'money', at: 70, weight: 0.5 }], size: 2, facts: { P: P0, r, yrs, I, askTotal },
    };
  }
  return null;
}

const MAKE = [simple, anyPct, newPrice, change, interest];
export function make(t, step, f, { frac = 0 } = {}) {
  return MAKE[Math.max(1, Math.min(MAKE.length, step)) - 1](t, f, frac);
}
