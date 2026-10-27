// MONEY at the store counter: the Money strand's maker (map `money` in src/math/strands.js, points 10 20 30 40 50 60
// 70). A customer pays, buys, or asks for change; the kid taps one of 4 answers. src/math/counter.js turns what this
// makes into an order slip; src/ui/counterpics.js draws its pictures.
//
// The steps (STEPS below), one school year at a time:
//   1 (10) counting coins: the coins drawn on the slip (2 dimes, a nickel, 3 pennies: 28¢). Their names are under them;
//          their values are what's being learnt, so the helper picture after a miss puts the values on them.
//   2 (20) adding two prices up to a dollar (35¢ + 28¢), carrying a ten later in the step
//   3 (30) change from a quarter, a half dollar or a silver dollar; the helper counts up from the price the way a
//          storekeeper makes change (35¢ -> 40¢ -> 50¢ -> $1.00) and never says the total
//   4 (40) dollars and cents ($3.45 + $2.80), the cents carried into the dollars later in the step
//   5 (50) several at one price and the change from a $10 or $20 note (two steps)
//   6 (60) the price of one (12 candles for $3.00), and which of two deals is the better buy
//   7 (70) tax and tips (a 15% tip on $12.00)
// Every wrong answer is a slip kids really make, with one line about it: every coin counted as 1 cent, a nickel taken
// for 10 because it's bigger than a dime, the ten borrowed for the ones but not taken off the tens (100 − 35 = 75),
// the cents past 100 not carried into the dollars, the bill given instead of the change, the percent read as dollars.
// All money is kept in whole cents, so no rounding slips can creep in.
//
//   make(t, step, f, { frac }) -> core (see src/math/counter.js for its shape); STEPS: [{ label }]
import { pro, u, cents, usd, cashFace } from './counterkit.js';
import { addAt, subAt } from './longwork.js';

export const STEPS = [
  { label: 'Counting coins (2 dimes, a nickel and 3 pennies)' },
  { label: 'Adding prices up to a dollar (35¢ + 28¢)' },
  { label: 'Change from a dollar (a 35¢ bar of soap)' },
  { label: 'Dollars and cents ($3.45 + $2.80)' },
  { label: 'Several at one price, and the change from $10 or $20' },
  { label: 'The price of one, and the better buy' },
  { label: 'Tax and tips (a 15% tip on $12.00)' },
];

export const COINS = { quarter: 25, dime: 10, nickel: 5, penny: 1 };
const NAME = { quarter: ['quarter', 'quarters'], dime: ['dime', 'dimes'], nickel: ['nickel', 'nickels'], penny: ['penny', 'pennies'] };
const cf = (c) => cashFace(c);
const df = (c) => cashFace(c, { dollars: true });
const SMALL = ['a candy stick', 'a spool of thread', 'a pencil', 'a bar of soap', 'a box of matches', 'a tin whistle', 'a hair ribbon',
  'a packet of seeds', 'a bag of salt', 'a pocket comb', 'a sheet of writing paper', 'a jar of buttons'];
const BIG = ['a tin lantern', 'a coil of rope', 'a felt hat', 'a sack of coffee', 'a canteen', 'a cast-iron pan', 'a wool blanket',
  'a pair of work gloves', 'a box of rifle shells', 'a sack of flour', 'a hand saw', 'a tin of lamp oil'];
const listOf = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

// 1: the coins drawn on the slip; how much is it?
function counting(t, f, frac) {
  const kinds = frac < 0.5 ? ['dime', 'nickel', 'penny'] : ['quarter', 'dime', 'nickel', 'penny'];
  // (first-grade counting starts small: totals up to 30¢ at the step's start, growing to 99¢ across it)
  const most = Math.round(30 + 69 * Math.max(0, Math.min(1, frac)));
  for (let tries = 0; tries < 80; tries++) {
    const use = t.shuffle([...kinds]).slice(0, t.int(2, Math.min(3, kinds.length)));
    const coins = Object.keys(COINS).filter((k) => use.includes(k)).map((k) => ({ k, v: COINS[k], n: t.int(1, k === 'quarter' ? 2 : 3) }));
    const total = coins.reduce((a, c) => a + c.v * c.n, 0), count = coins.reduce((a, c) => a + c.n, 0);
    if (count < 2 || count > 7 || total > most) continue;
    const has = (k) => coins.find((c) => c.k === k);
    const slips = [{ ...cf(count), slip: 'allOnes', why: 'That counts every coin as 1 cent. A dime is 10 cents, a nickel 5, a penny 1.' }];
    if (has('nickel') && has('dime')) slips.push({ ...cf(total + 5 * has('nickel').n), slip: 'nickelTen', why: 'A nickel is 5 cents, even though it is bigger than a dime. A dime is 10.' });
    if (has('penny') && coins.length > 1) slips.push({ ...cf(total - has('penny').n), slip: 'noPennies', why: 'Count the pennies too: 1 cent each.' });
    if (has('quarter')) slips.push({ ...cf(total - 5 * has('quarter').n), slip: 'quarterTwenty', why: 'A quarter is 25 cents: a quarter of a dollar.' });
    slips.push({ ...cf(total + 1), slip: 'off', why: 'One cent too many. Count on again from the biggest coin.' }, { ...cf(total - 1), slip: 'off', why: 'One cent short. Count on again from the biggest coin.' });
    const words = coins.map((c) => (c.n === 1 ? `${c.k === 'penny' ? 'a penny' : `a ${c.k}`}` : `${c.n} ${NAME[c.k][1]}`));
    let run = 0; const steps = [];
    for (const c of coins) for (let i = 0; i < c.n; i++) { run += c.v; steps.push(run); }
    return {
      key: `money:coins:${coins.map((c) => c.k[0] + c.n).join('')}`, story: `${f.name} pays with these coins.`, ask: 'How much money is that?',
      right: cf(total), slips,
      lead: { kind: 'coins', coins, values: false }, pic: { kind: 'coins', coins, values: true },
      rightWhy: `${listOf(words)}: ${steps.join(', ')}. That's ${total}¢`,
      credit: [], facts: { coins, total },
    };
  }
  return null;
}

// 2: two prices added, up to a dollar (a ten carried later in the step)
function adding(t, f, frac) {
  const p = pro(f), carry = t.chance(0.25 + 0.6 * frac);
  for (let tries = 0; tries < 80; tries++) {
    const a = t.int(5, 60), b = t.int(5, 99 - a);
    if (a + b > 99 || ((a % 10) + (b % 10) >= 10) !== carry || a === b) continue;
    const [x, y] = t.shuffle([...SMALL]).slice(0, 2), ans = a + b;
    const slips = [];
    if (carry) slips.push({ ...cf(ans - 10), slip: 'carryLost', why: `The ones made ${(a % 10) + (b % 10)}: that's another ten to carry into the tens.` });
    slips.push({ ...cf(Math.abs(a - b)), slip: 'subtracted', why: `That takes one price from the other. ${p.They} buys both: add them.` },
      { ...cf(ans + 10), slip: 'tensOff', why: 'One ten too many. Add the tens again.' },
      { ...cf(ans + 1), slip: 'off', why: 'One cent too many. Add the ones again.' }, { ...cf(ans - 1), slip: 'off', why: 'One cent short. Add the ones again.' });
    return {
      key: `money:add:${x}`, story: `${f.name} buys ${x} for ${a}¢ and ${y} for ${b}¢.`, ask: 'How much is that in all?',
      right: cf(ans), slips,
      pic: { kind: 'parts', whole: null, parts: [a, b], unit: 'money', cents: true },
      rightWhy: `${a}¢ + ${b}¢ = ${ans}¢`,
      credit: [{ strand: 'add', at: addAt(a, b), weight: 0.5 }], facts: { a, b, total: ans },
    };
  }
  return null;
}

// 3: change from a quarter, a half dollar or a silver dollar
function change(t, f, frac) {
  const p = pro(f);
  const paid = frac < 0.35 ? t.pick([25, 50, 100]) : 100;
  const round = frac < 0.5;
  for (let tries = 0; tries < 60; tries++) {
    const price = round ? 5 * t.int(1, paid / 5 - 1) : t.int(6, paid - 3);
    if ((!round && price % 5 === 0) || price * 2 === paid) continue;   // (change equal to the price: the price slip would be the answer)
    const ans = paid - price, item = t.pick(SMALL);
    const coin = { 25: 'a quarter', 50: 'a half dollar', 100: 'a silver dollar' }[paid];
    const slips = [];
    if (price % 10) slips.push({ ...cf(ans + 10), slip: 'borrowKept', why: 'A ten was borrowed for the ones but not taken off the tens. Count up from the price instead.' });
    slips.push({ ...cf(price), slip: 'price', why: `${price}¢ is the price. The change is the rest of the ${paid}¢.` },
      { ...cf(paid + price), slip: 'added', why: `Adding puts the price on top. The change is what's left of ${cents(paid)} after paying ${price}¢.` },
      { ...cf(ans - 10), slip: 'tensOff', why: `${price}¢ + ${ans - 10}¢ makes only ${price + ans - 10}¢. Count up to ${cents(paid)}.` },
      { ...cf(ans + 5), slip: 'off', why: `${price}¢ + ${ans + 5}¢ makes ${cents(price + ans + 5)}, more than was paid.` });
    return {
      key: `money:change:${item}`, story: `${f.name} buys ${item} for ${price}¢ and pays with ${coin}${paid === 100 ? ' (100¢)' : ` (${paid}¢)`}.`,
      ask: `How much change does ${p.they} get?`, right: cf(ans), slips,
      pic: { kind: 'countup', from: price, to: paid },
      rightWhy: `${price}¢ and ${ans}¢ change make ${cents(paid)}: ${cents(paid)} − ${price}¢ = ${ans}¢`,
      credit: [{ strand: 'sub', at: subAt(paid, price), weight: 0.5 }, { strand: 'words', at: 42, weight: 0.5 }], facts: { paid, price, change: ans },
    };
  }
  return null;
}

// 4: dollars and cents, added (the cents carried into the dollars later in the step)
function dollars(t, f, frac) {
  const carry = t.chance(0.3 + 0.6 * frac);
  for (let tries = 0; tries < 80; tries++) {
    const a = t.int(1, 7) * 100 + 5 * t.int(1, 19), b = t.int(1, 7) * 100 + 5 * t.int(1, 19);
    if (((a % 100) + (b % 100) >= 100) !== carry || a === b) continue;
    const [x, y] = t.shuffle([...BIG]).slice(0, 2), ans = a + b;
    const slips = [];
    if (carry) slips.push({ ...df(ans - 100), slip: 'centsKept', why: `The cents came to ${(a % 100) + (b % 100)}¢: 100 of those cents make another dollar.` });
    slips.push({ ...df(Math.abs(a - b)), slip: 'subtracted', why: 'That takes one price from the other. Both are bought: add them.' },
      { ...df(ans + 100), slip: 'dollarOff', why: 'One dollar too many. Add the dollars again.' },
      { ...df(ans + 10), slip: 'dimeOff', why: 'Ten cents too many. Line the points up and add the dimes again.' },
      { ...df(ans - 10), slip: 'dimeOff', why: 'Ten cents short. Line the points up and add the dimes again.' });
    return {
      key: `money:dollars:${x}`, story: `${f.name} buys ${x} for ${usd(a)} and ${y} for ${usd(b)}.`, ask: 'How much is that in all?',
      right: df(ans), slips,
      pic: { kind: 'columns', rows: [usd(a), usd(b)], op: '+', money: true },
      rightWhy: `${usd(a)} + ${usd(b)} = ${usd(ans)}`,
      credit: [{ strand: 'dec', at: 50, weight: 0.5 }], facts: { a, b, total: ans },
    };
  }
  return null;
}

// 5: several at one price, paid with a note: the bill, then the change (two steps)
function several(t, f, frac) {
  const p = pro(f);
  for (let tries = 0; tries < 80; tries++) {
    const n = t.int(2, frac < 0.5 ? 3 : 4), price = 25 * t.int(5, frac < 0.5 ? 12 : 19), bill = n * price;
    const paid = bill < 1000 ? (t.chance(0.6) ? 1000 : 2000) : 2000;
    if (bill >= paid || bill > 1900 || paid - bill === price) continue;   // (change equal to the price reads like the answer)
    const ans = paid - bill;
    const item = t.pick([['tin of peaches', 'tins of peaches'], ['sack of oats', 'sacks of oats'], ['box of shells', 'boxes of shells'],
      ['canteen', 'canteens'], ['pound of coffee', 'pounds of coffee'], ['loaf of bread', 'loaves of bread'], ['lantern wick', 'lantern wicks']]);
    return {
      key: `money:several:${item[0]}`, story: `${f.name} buys ${n} ${item[1]} at ${usd(price)} each and pays with a $${paid / 100} note.`,
      ask: `How much change ${p.does} get?`, right: df(ans),
      slips: [
        { ...df(bill), slip: 'stopped', why: `${usd(bill)} is the bill for the ${item[1]}. The change is what's left of the $${paid / 100}.` },
        { ...df(paid - price), slip: 'once', why: `That pays for just one ${item[0]}. ${p.They} buys ${n}.` },
        { ...df(ans - 100), slip: 'dollarOff', why: `${usd(bill)} + ${usd(ans - 100)} makes only ${usd(bill + ans - 100)}. Count up to $${paid / 100}.` },
        { ...df(ans + 100), slip: 'dollarOff', why: `${usd(bill)} + ${usd(ans + 100)} makes ${usd(bill + ans + 100)}, more than was paid.` },
        { ...df(paid + bill), slip: 'added', why: 'Paying takes money away, so the change is less than the note.' },
      ],
      pic: { kind: 'bill', n, price, paid, item },
      rightWhy: `${n} × ${usd(price)} = ${usd(bill)}, then $${paid / 100} − ${usd(bill)} = ${usd(ans)}`,
      sum: [{ op: 'mul', a: n, b: price / 100, money: true, cash: 'b', say: `First the cost of ${n} ${item[1]}` },
        { op: 'sub', a: paid / 100, b: bill / 100, money: true, cash: 'ab', say: `Then the change from $${paid / 100}` }],
      credit: [{ strand: 'words', at: 48, weight: 0.5 }], size: 2, facts: { n, price, paid, change: ans },
    };
  }
  return null;
}

// 6: the price of one, or the better buy of two deals
const PACKS = [
  { pack: 'box', many: 'candles', one: 'candle' }, { pack: 'sack', many: 'apples', one: 'apple' }, { pack: 'box', many: 'pencils', one: 'pencil' },
  { pack: 'bundle', many: 'fence stakes', one: 'fence stake' }, { pack: 'crate', many: 'cans of beans', one: 'can of beans' },
  { pack: 'basket', many: 'eggs', one: 'egg' }, { pack: 'box', many: 'bars of soap', one: 'bar of soap' },
];
function unitPrice(t, f, frac) {
  const g = t.pick(PACKS);
  if (t.chance(0.3 + 0.4 * frac)) {
    // the better buy: two deals whose prices for one differ by a few cents
    for (let tries = 0; tries < 80; tries++) {
      const n1 = t.pick([2, 3, 4, 5]), n2 = t.pick([4, 5, 6, 10]), u1 = t.int(4, 15), u2 = u1 + t.pick([-3, -2, -1, 1, 2, 3]);
      if (n1 >= n2 || u2 < 3) continue;
      const p1 = n1 * u1, p2 = n2 * u2, better = u1 < u2 ? 1 : 2;
      const d1 = `${n1} for ${cents(p1)}`, d2 = `${n2} for ${cents(p2)}`;
      const why1 = `${d1} is ${u1}¢ each, and ${d2} is ${u2}¢ each.`;
      const good = better === 1 ? d1 : d2, bad = better === 1 ? d2 : d1;
      return {
        key: `money:better:${g.many}`, story: `The store sells ${g.many} two ways: ${d1}, or ${d2}.`, ask: `Which is the better buy for ${f.name}?`,
        right: { v: good, big: good, small: '', label: good },
        slips: [
          { v: bad, big: bad, small: '', label: bad, slip: better === 1 ? 'bigPack' : 'smallPack', why: `${better === 1 ? 'The bigger pack isn\'t always cheaper.' : 'Fewer cents in all, but fewer in the pack too.'} Find the price of one: ${why1}` },
          { v: 'same', big: 'The same', small: '', label: 'They cost the same', slip: 'same', why: `Find the price of one in each: ${why1}` },
        ],
        wide: true, pic: { kind: 'deals', deals: [[n1, p1], [n2, p2]], one: g.one },
        rightWhy: `${why1} ${good} is cheaper for each ${g.one}`,
        sum: [{ op: 'div', a: p1, b: n1, say: `First one ${g.one} at ${d1}, in cents` }, { op: 'div', a: p2, b: n2, say: `Then one ${g.one} at ${d2}` }],
        credit: [{ strand: 'ratio', at: 60, weight: 0.5 }], size: 2, facts: { n1, p1, n2, p2, better },
      };
    }
  }
  for (let tries = 0; tries < 80; tries++) {
    const n = t.pick([2, 3, 4, 5, 6, 10, 12]), each = 5 * t.int(1, frac < 0.5 ? 10 : 19);
    if (!([2, 3, 4, 5, 10].includes(n) || [5, 10, 20, 25, 50].includes(each))) continue;
    const total = n * each;
    if (total > 1200) continue;
    return {
      key: `money:one:${g.many}`, story: `A ${g.pack} of ${n} ${g.many} costs ${cents(total)}.`, ask: `What does one ${g.one} cost?`,
      right: cf(each),
      slips: [
        { ...cf(each * 10), slip: 'point', why: `${n} of them at ${cents(each * 10)} would cost ${cents(n * each * 10)}. Check by multiplying back.` },
        { ...cf(total - n), slip: 'subtracted', why: `That takes ${n} cents off. Share the ${cents(total)} out over the ${n} ${g.many}.` },
        { ...cf(each + 5), slip: 'off', why: `${n} at ${cents(each + 5)} would be ${cents(n * (each + 5))}, more than ${cents(total)}.` },
        { ...cf(each - 5), slip: 'off', why: `${n} at ${cents(each - 5)} would be only ${cents(n * (each - 5))}.` },
        { ...cf(total * n), slip: 'multiplied', why: `Times makes it more. One ${g.one} costs less than the ${g.pack}: divide.` },
      ].filter((s) => s.v > 0),
      pic: { kind: 'share', total, groups: n, per: null, box: [g.one, g.many], thing: ['cent', 'cents'] },
      rightWhy: `${cents(total)} ÷ ${n} = ${cents(each)}: ${n} × ${cents(each)} = ${cents(total)}`,
      credit: [], facts: { n, total, each },
    };
  }
  return null;
}

// 7: a tip on a hotel supper, or tax on a purchase
// (Work it out's steps, in dollars: 10% is a tenth of the bill, 5% half of that, 20% two tenths; tax by the 1%, a
// hundredth of the price, so many times over; then the bill and the tip, or the price and the tax, added)
const $ = (x) => Math.round(x * 100) / 100;
function tipSteps(bill, pct, total) {
  const ten = $(bill / 10), tip = $(bill * pct / 100);
  const steps = [{ op: 'div', a: bill, b: 10, money: true, cash: 'a', say: 'First 10% of the supper: a tenth of it' }];
  if (pct === 20) steps.push({ op: 'mul', a: ten, b: 2, money: true, cash: 'a', say: 'Then 20% is two lots of 10%' });
  if (pct === 15) steps.push({ op: 'div', a: ten, b: 2, money: true, cash: 'a', say: 'Then 5% is half of 10%' }, { op: 'add', a: ten, b: $(ten / 2), money: true, say: 'Then 10% and 5% make 15%' });
  if (total) steps.push({ op: 'add', a: bill, b: tip, money: true, say: 'Then the supper and the tip together' });
  return steps;
}
function taxSteps(price, pct) {
  const one = $(price / 100), tax = $(price * pct / 100);
  return [
    ...(pct === 10 ? [{ op: 'div', a: price, b: 10, money: true, cash: 'a', say: 'First the 10% tax: a tenth of the price' }]
      : [{ op: 'div', a: price, b: 100, money: true, cash: 'a', say: 'First 1% of the price: a hundredth of it' }, { op: 'mul', a: one, b: pct, money: true, cash: 'a', say: `Then ${pct}% is ${pct} lots of 1%` }]),
    { op: 'add', a: price, b: tax, money: true, say: 'Then the price and the tax together' },
  ];
}
function taxTip(t, f, frac) {
  const p = pro(f);
  if (t.chance(0.5)) {
    const bill = 100 * t.pick([8, 10, 12, 14, 16, 20, 24, 30, 40]), pct = t.pick([10, 15, 20, 15]);
    const tip = bill * pct / 100, total = bill + tip, askTotal = t.chance(0.25 + 0.5 * frac);
    const slips = [
      { ...df(askTotal ? bill + pct * 100 : pct * 100), slip: 'percentDollars', why: `${pct}% isn't $${pct}. ${pct}% is ${pct} cents of every dollar.` },
      { ...df(askTotal ? tip : total), slip: askTotal ? 'tipOnly' : 'total', why: askTotal ? `${usd(tip)} is the tip. The whole thing is the supper and the tip.` : `${usd(total)} is the supper with the tip. The question is the tip alone.` },
      ...(pct !== 10 ? [{ ...df(askTotal ? bill + bill / 10 : bill / 10), slip: 'tenOnly', why: `${usd(bill / 10)} is 10%. ${pct}% is ${pct === 15 ? '10% and half as much again' : 'twice that'}.` }] : []),
      { ...df(askTotal ? bill + tip / 10 : tip / 10), slip: 'point', why: `Check the point: 10% of ${usd(bill)} is ${usd(bill / 10)}.` },
    ].filter((s) => s.v > 0 && Number.isInteger(s.v));
    return {
      key: `money:tip:${pct}`, story: `Supper at the hotel comes to ${usd(bill)}, and ${f.name} leaves a ${pct}% tip.`,
      ask: askTotal ? `How much ${p.does} pay in all?` : 'How much is the tip?', right: df(askTotal ? total : tip), slips,
      pic: { kind: 'pctbar', whole: bill, n: 20, take: pct / 5, money: true, mode: 'tip' },
      rightWhy: `${pct}% of ${usd(bill)} is ${usd(tip)}${askTotal ? `, so ${usd(bill)} + ${usd(tip)} = ${usd(total)}` : ''}`,
      sum: tipSteps(bill / 100, pct, askTotal),
      credit: [{ strand: 'pct', at: 66, weight: 0.5 }], size: askTotal ? 2 : 1, facts: { bill, pct, tip, total, askTotal },
    };
  }
  const price = 100 * t.int(4, 60), pct = t.pick([5, 6, 8, 10]), tax = price * pct / 100, total = price + tax;
  if (!Number.isInteger(tax)) return null;
  const item = t.pick(BIG);
  return {
    key: `money:tax:${item}`, story: `${item[0].toUpperCase() + item.slice(1)} is ${usd(price)}, and the territory adds ${pct}% tax.`,
    ask: `What does ${f.name} pay with the tax?`, right: df(total),
    slips: [
      { ...df(tax), slip: 'taxOnly', why: `${usd(tax)} is just the tax. ${p.They} pays the price and the tax.` },
      { ...df(price + pct * 100), slip: 'percentDollars', why: `${pct}% isn't $${pct}. It's ${pct} cents of every dollar.` },
      { ...df(price - tax), slip: 'off', why: 'Tax is added on: it costs more, not less.' },
      { ...df(price + tax * 10), slip: 'point', why: `Check the point: 1% of ${usd(price)} is ${usd(price / 100)}.` },
    ].filter((s) => s.v > 0 && Number.isInteger(s.v)),
    pic: { kind: 'pctbar', whole: price, n: 20, take: pct / 5, money: true, mode: 'tax' },
    rightWhy: `${pct}% of ${usd(price)} is ${usd(tax)}, so ${usd(price)} + ${usd(tax)} = ${usd(total)}`,
    sum: taxSteps(price / 100, pct),
    credit: [{ strand: 'pct', at: 66, weight: 0.5 }], size: 2, facts: { price, pct, tax, total },
  };
}

const MAKE = [counting, adding, change, dollars, several, unitPrice, taxTip];
export function make(t, step, f, { frac = 0 } = {}) {
  const fn = MAKE[Math.max(1, Math.min(MAKE.length, step)) - 1];
  return fn(t, f, frac);
}
export { u as withUnit };
