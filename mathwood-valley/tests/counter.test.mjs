// The store counter's other questions (src/math/counter.js and its makers: money, time, decimals, percent, ratios):
// every step of every maker makes good slips (3 or 4 coins, one right, no two alike, a reason on every wrong one), the
// right coin is really right (worked out again here from the numbers the maker used), the pictures draw and the help
// never prints the answer, the maps match the makers, and the counter asks these about 2 customers in 5 once one fits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { counterOrder, counterChoice, COUNTER, COUNTER_MAPS, COUNTER_SHARE } from '../src/math/counter.js';
import { seeded, usd, cents, clock, ampm, dur, dec, DAYS } from '../src/math/counterkit.js';
import { counterPicture } from '../src/ui/counterpics.js';
import { clockSvg, handAngles } from '../src/ui/clockface.js';
import { sayable } from '../src/ui/storeslip.js';
import { MAPS, STRAND, setLevel, stepFor, fits } from '../src/math/skill.js';
import { FOLK } from '../src/math/wordproblems.js';

const BAD = /NaN|undefined|Infinity|\[object/;
// every step of every maker, at the start and the end of the step, with three seeds
function* everyOrder(per = 60) {
  for (const seed of [1, 2, 3]) {
    const rand = seeded(seed * 101);
    for (const map of COUNTER_MAPS) for (let step = 1; step <= COUNTER[map].STEPS.length; step++) for (const frac of [0, 0.5, 1]) {
      for (let i = 0; i < per; i++) yield { map, step, frac, o: counterOrder(map, { step, frac, rand }) };
    }
  }
}

test('each maker has a map in the registry: its strand, one point per step, climbing', () => {
  for (const map of COUNTER_MAPS) {
    const m = MAPS[map];
    assert.ok(m, `map ${map}`);
    assert.equal(m.strand, map, `${map} is on its own strand`);
    assert.ok(STRAND[m.strand]);
    assert.equal(m.anchors.length, COUNTER[map].STEPS.length, `${map}: a point per step`);
    for (const s of COUNTER[map].STEPS) assert.ok(s.label && s.label.length > 5);
  }
  assert.deepEqual(MAPS.money.anchors, [10, 20, 30, 40, 50, 60, 70]);
  assert.deepEqual(MAPS.time.anchors, [10, 15, 20, 24, 30, 32, 40, 48, 56]);
  assert.deepEqual(MAPS.dec.anchors, [40, 45, 50, 55, 60, 66]);
  assert.deepEqual(MAPS.pct.anchors, [58, 62, 66, 72, 76]);
  assert.deepEqual(MAPS.ratio.anchors, [38, 55, 60, 65, 72]);
});

test('every step of every maker makes a good slip: 3 or 4 coins, one right, none alike, a reason on each wrong one', () => {
  let n = 0;
  const steps = {};
  for (const { map, step, o } of everyOrder()) {
    n++;
    const where = `${map} ${step}: ${o.story} ${o.ask}`;
    assert.ok(o.coins.length >= 3 && o.coins.length <= 4, `${where}: ${o.coins.length} coins`);
    assert.equal(o.coins.filter((c) => c.good).length, 1, where);
    assert.equal(new Set(o.coins.map((c) => c.label)).size, o.coins.length, `${where}: labels alike`);
    assert.equal(new Set(o.coins.map((c) => (typeof c.v === 'number' ? `n${Math.round(c.v * 1e6)}` : `s${c.v}`))).size, o.coins.length, `${where}: values alike`);
    for (const c of o.coins) {
      assert.ok(c.big && !BAD.test(`${c.big} ${c.small} ${c.label}`), `${where}: coin ${c.label}`);
      if (!c.good) assert.ok(c.why && c.why.length > 12 && !BAD.test(c.why), `${where}: the reason for ${c.label}: ${c.why}`);
    }
    // (coins in one slip look alike: all with a word under them or none, so the odd one out isn't the answer)
    if (!o.wide) assert.ok(o.coins.every((c) => !!c.small) || o.coins.every((c) => !c.small) || o.coins.filter((c) => !c.small).every((c) => !c.good), `${where}: ${o.coins.map((c) => `${c.big}/${c.small}`).join(' ')}`);
    for (const k of ['story', 'ask', 'rightWhy', 'read']) assert.ok(o[k] && !BAD.test(o[k]), `${where}: ${k} = ${o[k]}`);
    assert.equal(o.answer, o.coins.find((c) => c.good).label);
    assert.equal(o.counter, map); assert.equal(o.strand, map); assert.equal(o.step, step);
    assert.ok(o.size >= 1 && o.size <= 2);
    for (const c of o.credit) {
      assert.ok(STRAND[c.strand] && c.strand !== map, `${where}: credit ${c.strand}`);
      assert.ok(c.at >= 0 && c.at <= 100 && c.weight > 0 && c.weight <= 1, `${where}: credit ${JSON.stringify(c)}`);
    }
    (steps[`${map}${step}`] = steps[`${map}${step}`] || new Set()).add(o.key);
  }
  assert.ok(n > 5000);
  // every step deals more than one story
  for (const [k, keys] of Object.entries(steps)) assert.ok(keys.size >= 1, k);
});

// the right answer worked out again from the maker's own numbers (o.facts), a different way where it can be
function expected(o) {
  const F = o.facts, k = o.key;
  if (k.startsWith('money:coins')) return cents(F.coins.reduce((a, c) => a + c.v * c.n, 0));
  if (k.startsWith('money:add')) return cents(F.a + F.b);
  if (k.startsWith('money:change')) return cents(F.paid - F.price);
  if (k.startsWith('money:dollars')) return usd(F.a + F.b);
  if (k.startsWith('money:several')) return usd(F.paid - F.n * F.price);
  if (k.startsWith('money:one')) return cents(F.total / F.n);
  if (k.startsWith('money:better')) { const g = F.p1 / F.n1 < F.p2 / F.n2 ? 1 : 2; return g === 1 ? `${F.n1} for ${cents(F.p1)}` : `${F.n2} for ${cents(F.p2)}`; }
  if (k.startsWith('money:tip')) return usd(F.askTotal ? F.bill * (100 + F.pct) / 100 : F.bill * F.pct / 100);
  if (k.startsWith('money:tax')) return usd(F.price * (100 + F.pct) / 100);
  if (k.startsWith('time:read')) return clock(F.h, F.m);
  if (k.startsWith('time:hours')) return `${F.len} ${F.len === 1 ? 'hour' : 'hours'}`;
  if (k.startsWith('time:sleep')) return dur(F.up - F.bed);
  if (k.startsWith('time:later')) return ampm(F.start + F.add);
  if (k.startsWith('time:minutes')) return dur(F.total);
  if (k.startsWith('time:between')) return dur(F.b - F.a);
  if (k.startsWith('time:bake')) return ampm(F.start + F.len);
  if (k.startsWith('time:table')) return dur(F.to - F.from);
  if (k.startsWith('time:days')) return `${DAYS[Math.floor((F.start + F.len * 60) / 1440) % 7]} ${ampm(F.start + F.len * 60)}`;
  if (k.startsWith('dec:tenths:say')) return `${F.k} ${F.k === 1 ? 'tenth' : 'tenths'}`;
  if (k.startsWith('dec:tenths')) return `0.${F.k}`;
  if (k.startsWith('dec:compare')) return `${dec(Math.max(F.a, F.b), 2, { trim: true })} pound`;
  if (k.startsWith('dec:cents')) return dec(F.c, 2);
  if (k === 'dec:add' || k === 'dec:sub') return `${dec(F.op === '+' ? F.a + F.b : F.a - F.b, 2)} pounds`;
  if (k.startsWith('dec:one')) return usd(F.total / 10);
  if (k.startsWith('dec:many')) return `${dec(F.one * F.by, F.places, { trim: true })} pounds`;
  if (k === 'dec:decdec') return dec(F.a * F.b, 2);
  if (k.startsWith('dec:price')) return usd(F.n * F.each);
  if (k === 'dec:boards') return `${dec(F.n * F.one, 1, { trim: true })} feet`;
  if (k === 'dec:share') return usd(F.total / F.n);
  if (k.startsWith('dec:bags')) return `${Math.round(F.whole / F.part)} bags`;
  if (k === 'dec:rope') return `${F.a / F.b} pieces`;
  if (k.startsWith('pct:off') || k.startsWith('pct:of')) return o.coins.find((c) => c.good).small === 'dollars' || o.coins.find((c) => c.good).small === 'dollar' ? `$${F.whole * F.pct / 100}` : null;
  if (k.startsWith('pct:sale') || k.startsWith('pct:tax')) return `$${F.pay}`;
  if (k.startsWith('pct:change')) return `${Math.round(Math.abs(F.now - F.old) * 100 / F.old)}%`;
  if (k.startsWith('pct:interest')) return `$${F.askTotal ? F.P + F.P * F.r * F.yrs / 100 : F.P * F.r * F.yrs / 100}`;
  if (k.startsWith('ratio:table')) return null;
  return undefined;
}
test('the right coin is really right (worked out again from the numbers in the story)', () => {
  let checked = 0;
  for (const { map, step, o } of everyOrder(25)) {
    const want = expected(o), got = o.coins.find((c) => c.good);
    if (want === undefined || want === null) continue;
    assert.equal(got.label, want, `${map} ${step}: ${o.story} ${o.ask}`);
    checked++;
  }
  assert.ok(checked > 2500, `checked ${checked}`);
  // the facts agree with the story's own words, for a few kinds
  const rand = seeded(9);
  for (let i = 0; i < 200; i++) {
    const o = counterOrder('money', { step: 3, rand });
    assert.match(o.story, new RegExp(`for ${o.facts.price}¢ and pays`));
    const t = counterOrder('time', { step: 7, rand });
    if (t.key.startsWith('time:sleep')) assert.match(t.story, new RegExp(`${clock(Math.floor(t.facts.bed / 60) - 12, t.facts.bed % 60)} pm`));
  }
});

test('percent and ratio answers worked out by hand', () => {
  const rand = seeded(5);
  for (let i = 0; i < 300; i++) {
    const a = counterOrder('pct', { step: 1 + (i % 2), frac: (i % 3) / 2, rand });
    const n = Number(a.answer.replace(/[^0-9]/g, '')), F = a.facts;
    assert.equal(n, F.whole * F.pct / 100, `${a.story} ${a.answer}`);
    const r = counterOrder('ratio', { step: 3 + (i % 3), frac: (i % 4) / 3, rand });
    const v = Number(r.answer.match(/\d+/)[0]), G = r.facts;
    if (r.key.startsWith('ratio:table')) assert.equal(v, G.a * G.k);
    if (r.key.startsWith('ratio:share')) assert.equal(v, (G.ask === 0 ? G.a : G.b) * G.total / (G.a + G.b));
    if (r.key.startsWith('ratio:prop')) assert.equal(v * G.d, G.n * G.D, `${r.story}`);
  }
});

test('every kind is there: making change, a 15% tip, the grandfather clock, the sleep story, discounts', () => {
  const rand = seeded(11), keys = new Set();
  for (const map of COUNTER_MAPS) for (let s = 1; s <= COUNTER[map].STEPS.length; s++) for (let i = 0; i < 40; i++) keys.add(counterOrder(map, { step: s, frac: i % 2, rand }).key.split(':').slice(0, 2).join(':'));
  for (const k of ['money:coins', 'money:change', 'money:dollars', 'money:several', 'money:one', 'money:better', 'money:tip', 'money:tax', 'time:read', 'time:hours', 'time:sleep', 'time:later',
    'time:minutes', 'time:between', 'time:bake', 'time:table', 'time:days', 'dec:tenths', 'dec:compare', 'dec:cents', 'dec:add', 'dec:sub', 'dec:one', 'dec:many', 'dec:decdec', 'dec:price',
    'dec:boards', 'dec:share', 'dec:bags', 'dec:rope', 'pct:off', 'pct:of', 'pct:any', 'pct:sale', 'pct:tax', 'pct:change', 'pct:interest', 'ratio:rate', 'ratio:recipe', 'ratio:table',
    'ratio:share', 'ratio:prop']) assert.ok(keys.has(k), `missing ${k}`);
  // the sleep story: to bed at night, up early to milk the cows, how much sleep (am and pm, past midnight)
  let sleep = null;
  for (let i = 0; i < 200 && !sleep; i++) { const o = counterOrder('time', { step: 7, rand }); if (o.key.startsWith('time:sleep')) sleep = o; }
  assert.match(sleep.story, /went to bed at \d+:\d\d pm and had to get up at \d+:\d\d am to milk the cows/);
  assert.equal(sleep.ask.startsWith('How much sleep'), true);
  assert.ok(sleep.coins.some((c) => c.slip === 'wrongWay'), 'the other way round the clock is one of the slips');
});

test('the clock: the hour hand sits between the numbers the way a real one does', () => {
  assert.deepEqual(handAngles(4, 30), { hour: 135, minute: 180 });
  assert.deepEqual(handAngles(12, 0), { hour: 0, minute: 0 });
  assert.deepEqual(handAngles(7, 45), { hour: 232.5, minute: 270 });
  const s = clockSvg(4, 30), h = clockSvg(4, 30, { help: true });
  assert.match(s, /^<svg/); assert.match(h, /^<svg/);
  for (const n of [1, 6, 12]) assert.ok(s.includes(`>${n}</text>`));
  assert.ok(!s.includes('>30</text>'), 'the question\'s clock has no minute numbers');
  assert.ok(h.includes('>30</text>') && h.includes('>55</text>'), 'the helper writes the minutes round the edge');
  assert.ok(!h.includes('4:30') && !h.includes('half past'), 'the helper never says the time');
  // reading a clock: a slip for the hour hand nearly at the next number, and for the number read as minutes
  const rand = seeded(2), slips = new Set();
  for (let i = 0; i < 300; i++) for (const c of counterOrder('time', { step: 3 + (i % 3), rand }).coins) if (c.slip) slips.add(c.slip);
  for (const k of ['nextHour', 'numberAsMinutes', 'swapped', 'fiveOff', 'tickOff']) assert.ok(slips.has(k), k);
});

test('every picture draws (the lead and the help), and the help never prints the answer', () => {
  const kinds = new Set();
  for (const { map, step, o } of everyOrder(12)) {
    const where = `${map} ${step} ${o.key}`;
    for (const which of ['lead', 'pic']) {
      const p = o[which];
      if (!p) { assert.ok(which === 'lead', `${where}: a help picture`); continue; }
      const d = counterPicture(p);
      kinds.add(p.kind);
      assert.match(d.svg, /^<svg/, `${where}: ${which} ${p.kind}`);
      assert.ok(!BAD.test(d.svg) && !BAD.test(d.line), `${where}: ${which} ${p.kind}: ${d.line}`);
      if (which === 'pic') assert.ok(d.line.length > 15, `${where}: the help says something`);
      // (the deals picture shows both deals: they're the choices, not the answer)
      if (which === 'pic' && ['countup', 'columns', 'bill', 'pctbar', 'interest', 'change', 'hourbars', 'shift', 'timeline'].includes(p.kind)) {
        const words = [...d.svg.matchAll(/>([^<]+)<\/text>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
        const right = o.coins.find((c) => c.good);
        assert.ok(!words.includes(right.label) && !words.includes(right.big) || /^\d$/.test(right.big), `${where}: the help prints the answer ${right.label}: ${words.join(' | ')}`);
      }
    }
  }
  for (const k of ['coins', 'countup', 'columns', 'bill', 'deals', 'pctbar', 'clock', 'timeline', 'timetable', 'hourbars', 'days', 'tenths', 'grid', 'shift', 'bars', 'area', 'fit', 'change', 'interest', 'ratiotable', 'ratiobar', 'road', 'ratio', 'parts', 'share'])
    assert.ok(kinds.has(k), `no ${k} picture drawn`);
});

test('the questions that are about a picture carry it as the lead: the clock, the coins, the timetable, the cornbread', () => {
  const rand = seeded(4);
  for (let s = 1; s <= 5; s++) { const o = counterOrder('time', { step: s, rand }); assert.equal(o.lead.kind, 'clock'); assert.equal(o.pic.kind, 'clock'); assert.ok(o.pic.help); }
  assert.equal(counterOrder('money', { step: 1, rand }).lead.kind, 'coins');
  let table = null;
  for (let i = 0; i < 60 && !table; i++) { const o = counterOrder('time', { step: 9, rand }); if (o.lead) table = o; }
  assert.equal(table.lead.kind, 'timetable');
  assert.equal(counterOrder('dec', { step: 1, frac: 0, rand }).lead.kind, 'tenths');
  // the question's coins have their names, not their values; the help has the values
  const c = counterOrder('money', { step: 1, rand });
  assert.ok(!counterPicture(c.lead).svg.includes('¢'));
  assert.ok(counterPicture(c.pic).svg.includes('¢'));
});

test('read out loud the right way: money, minutes, signs', () => {
  assert.equal(sayable('A lantern is $3.45.'), 'A lantern is 3 dollars and 45 cents.');
  assert.equal(sayable('$0.45 each'), '45 cents each');
  assert.equal(sayable('$12.00'), '12 dollars');
  assert.equal(sayable('$1.00 and 1¢'), '1 dollar and 1 cent');
  assert.equal(sayable('2 h 30 min'), '2 hours 30 minutes');
  assert.equal(sayable('1 h 5 min'), '1 hour 5 minutes');
  assert.equal(sayable('$40'), '40 dollars');
  for (const { o } of everyOrder(3)) assert.ok(!/\$|¢/.test(sayable(o.read)), `said: ${sayable(o.read)}`);
});

test('the right question for the rider: a step at the rider\'s level, and about 2 customers in 5 once one fits', () => {
  // a step at the level: money 35 -> step 3 (change from a dollar), time 44 -> step 7 (am and pm)
  const r = { skill: {} };
  setLevel(r, 'money', 35); setLevel(r, 'time', 44); setLevel(r, 'dec', 52);
  assert.equal(stepFor(r, 'money').step, 3);
  assert.equal(stepFor(r, 'time').step, 7);
  assert.equal(stepFor(r, 'dec').step, 3);
  // nothing fits a rider at the very start (kindergarten work): every customer brings a picture story
  const young = { skill: {} };
  for (const s of ['words', 'add', 'sub', 'number']) setLevel(young, s, 0);
  const rand = seeded(8);
  for (let i = 0; i < 200; i++) assert.equal(counterChoice(young, { rand }), null);
  // a fifth grader: money, time, ratio fit (decimals and percent wait: their first steps are higher)
  const mid = { skill: {} };
  for (const s of ['words', 'add', 'sub', 'mul', 'div', 'number', 'frac']) setLevel(mid, s, 40);
  const got = {};
  let asked = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) { const m = counterChoice(mid, { rand }); if (m) { asked++; got[m] = (got[m] || 0) + 1; assert.ok(fits(mid, m, [m]), m); } }
  assert.ok(Math.abs(asked / N - COUNTER_SHARE) < 0.03, `asked ${asked / N}`);
  assert.ok(got.money && got.time, JSON.stringify(got));
  assert.ok(!got.pct, 'no percent for a fifth grader');
  // a teen far past money and time gets decimals, percent and ratios
  const teen = { skill: {} };
  for (const s of ['words', 'add', 'sub', 'mul', 'div', 'number', 'frac', 'dec', 'pct', 'ratio']) setLevel(teen, s, 70);
  setLevel(teen, 'money', 90); setLevel(teen, 'time', 90);   // (held at the top of what their makers have)
  const seen = {};
  for (let i = 0; i < 4000; i++) { const m = counterChoice(teen, { rand }); if (m) seen[m] = (seen[m] || 0) + 1; }
  assert.ok(seen.pct && seen.dec && seen.ratio, JSON.stringify(seen));
  // (time and money are at the top of what their makers have: asked now and then, as a review)
  assert.ok(seen.time < seen.pct / 2 && seen.money < seen.pct / 2, JSON.stringify(seen));
});

test('a customer who brings it is the one who asks it, and the same seed makes the same question', () => {
  const who = FOLK[3];
  const o = counterOrder('money', { step: 5, rand: seeded(1), who });
  assert.equal(o.who, who);
  assert.ok(o.story.includes(who.name));
  const a = counterOrder('pct', { step: 3, rand: seeded(77) }), b = counterOrder('pct', { step: 3, rand: seeded(77) });
  assert.equal(a.story, b.story); assert.deepEqual(a.coins.map((c) => c.label), b.coins.map((c) => c.label));
});

test('money step 1 (counting coins) starts small: totals up to 30¢ at the step\'s start, growing across it', () => {
  const rand = seeded(9);
  for (let i = 0; i < 200; i++) assert.ok(counterOrder('money', { step: 1, frac: 0, rand }).facts.total <= 30);
  let big = 0;
  for (let i = 0; i < 200; i++) if (counterOrder('money', { step: 1, frac: 1, rand }).facts.total > 30) big++;
  assert.ok(big > 50, `${big} of 200 over 30¢ at the step's end`);
});
