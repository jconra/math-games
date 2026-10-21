// Tests for src/math/supplies.js (the camps' supply orders, worked out at the general store for the delivery job).
// Run with:  node --test bandit-math/tests/supplies.test.mjs   (SEED_OFFSET=1000 for another seed set)
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSupplyOrder, makeSupplies, picture, seeded as seededAt, LADDER, WORDS, VOCAB_KNOWN, CLEAN_TO_CLIMB, PLACEMENT_MISSES, PLACE_BELOW } from '../src/math/supplies.js';

const OFFSET = Number(process.env.SEED_OFFSET) || 0;
const seeded = (seed) => seededAt(seed + OFFSET);
const ALL_NEW = { week: true, fortnight: true, dozen: true };

function* everyOrder(per = 60) {
  let seed = 1;
  for (let step = 1; step <= LADDER.length; step++) for (const vocab of [ALL_NEW, {}]) {
    const r = seeded(seed++);
    for (let i = 0; i < per; i++) yield makeSupplyOrder({ rand: r, step, vocab, who: 'Dusty', camp: { id: 'cow', short: 'the cow camp' } });
  }
}

test('the worked example works out: 6 hands x 3 meals x a fortnight = 252 cans, crates of 12 -> 21; 250 cans still need 21', () => {
  // (found among the step-4 orders: a fortnight, exact crates)
  let found = null;
  const r = seeded(7);
  for (let i = 0; i < 5000 && !found; i++) {
    const o = makeSupplyOrder({ rand: r, step: 4, vocab: {} });
    if (o.goods === 'beans' && o.hands === 6 && o.rate === 3 && o.days === 14 && o.per === 12) found = o;
  }
  assert.ok(found, 'the example comes up');
  assert.equal(found.total, 252); assert.equal(found.crates, 21);
  assert.equal(Math.ceil(250 / 12), 21);
});

test('every order: the numbers add up, one right coin a step, wrong coins never equal the answer or repeat', () => {
  for (const o of everyOrder()) {
    assert.equal(o.total, o.hands * o.rate * (o.noDays ? 1 : o.days));
    assert.equal(o.crates, Math.ceil(o.total / o.per));
    assert.ok(o.crates >= 2 && o.crates <= 30, `${o.crates} crates`);
    assert.equal(o.exact, o.total % o.per === 0);
    if (o.price) assert.equal(o.cost, o.crates * o.price);
    for (const p of o.parts) {
      assert.ok(p.coins.length >= 3 && p.coins.length <= 4, `${p.key}: ${p.coins.length} coins`);
      assert.equal(p.coins.filter((c) => c.good).length, 1);
      const vals = p.coins.map((c) => c.v);
      assert.equal(new Set(vals).size, vals.length, 'no repeats');
      for (const c of p.coins) { assert.ok(Number.isInteger(c.v) && c.v > 0); if (!c.good) assert.ok(c.why && c.why.length > 10, 'a wrong coin says why'); }
      const right = p.coins.find((c) => c.good).v;
      const want = { total: o.total, crates: o.crates, cost: o.cost, vocab: p.word ? (WORDS[p.word].days || WORDS[p.word].n) : null }[p.key];
      assert.equal(right, want, p.key);
      // the picture never shows the answer as a number of its own
      const pic = picture(p.pic);
      assert.ok(pic.svg.startsWith('<svg') && pic.title && pic.line, `${p.key} has a picture`);
      if (p.key !== 'vocab' && ![o.per, o.total, o.hands, o.rate, o.days, o.price].includes(right)) assert.ok(!new RegExp(`>${right}<`).test(pic.svg), `${p.key} picture hides ${right}`);
    }
  }
});

test('the ladder: two numbers, then three, then a week, then a fortnight, then rounding up, then the cost', () => {
  const kinds = (step) => { const r = seeded(100 + step); const o = makeSupplyOrder({ rand: r, step, vocab: ALL_NEW }); return o; };
  assert.equal(kinds(1).rate, 1);
  assert.ok(kinds(2).rate >= 2);
  // (a week on its own first, its numbers small; then a fortnight, also on its own: one new word a step)
  const r3 = seeded(33); for (let i = 0; i < 50; i++) { const o = makeSupplyOrder({ rand: r3, step: 3, vocab: ALL_NEW }); assert.ok(o.exact); assert.equal(o.period.word, 'week'); assert.equal(o.parts[0].key, 'vocab'); }
  const r3b = seeded(34); for (let i = 0; i < 50; i++) { const o = makeSupplyOrder({ rand: r3b, step: 4, vocab: ALL_NEW }); assert.ok(o.exact); assert.equal(o.period.word, 'fortnight'); assert.equal(o.parts[0].key, 'vocab'); }
  const r4 = seeded(44); for (let i = 0; i < 50; i++) { const o = makeSupplyOrder({ rand: r4, step: 5, vocab: {} }); assert.ok(!o.exact, 'step 5 rounds up'); assert.ok(o.parts.every((p) => p.key !== 'cost')); }
  const r5 = seeded(55); for (let i = 0; i < 50; i++) { const o = makeSupplyOrder({ rand: r5, step: 6, vocab: {} }); assert.equal(o.parts[o.parts.length - 1].key, 'cost'); }
});

test('the named slips are there: forgot to round up, 7 days for a fortnight, only two of the three numbers', () => {
  let roundDown = 0, week7 = 0, twoOnly = 0;
  for (const o of everyOrder(40)) for (const p of o.parts) for (const c of p.coins) {
    if (c.slip === 'roundDown' && p.key === 'crates') { roundDown++; assert.equal(c.v, Math.floor(o.total / o.per)); }
    if (c.slip === 'week7') { week7++; assert.equal(c.v, o.hands * o.rate * 7); }
    if (c.slip === 'twoOnly') twoOnly++;
  }
  assert.ok(roundDown > 50 && week7 > 20 && twoOnly > 50, `${roundDown} ${week7} ${twoOnly}`);
  // every rounding-up order offers the rounded-down coin
  const r = seeded(9);
  for (let i = 0; i < 100; i++) { const o = makeSupplyOrder({ rand: r, step: 5, vocab: {} }); const p = o.parts.find((q) => q.key === 'crates'); assert.ok(p.coins.some((c) => c.slip === 'roundDown')); }
});

test('a word is asked while it is new, and left out once known', () => {
  const st = {}, S = makeSupplies(st, { rand: seeded(3) });
  st.step = 3; st.placing = false;
  let asked = 0;
  for (let i = 0; i < 12; i++) {
    const o = S.next({ camp: { id: 'cow', short: 'the cow camp' }, who: 'Dusty' });
    o.parts.forEach((p, k) => { if (p.key === 'vocab') asked++; S.answer(o, k, p.coins.findIndex((c) => c.good)); });
  }
  assert.ok(st.vocab.fortnight >= VOCAB_KNOWN || st.vocab.week >= VOCAB_KNOWN);
  assert.ok(asked <= 2 * VOCAB_KNOWN, `asked ${asked} times`);
});

test('the climb: clean orders climb on a first visit; the second miss settles; then 3 clean up, a miss down (once an order)', () => {
  const st = {}, S = makeSupplies(st, { rand: seeded(11) });
  const play = (miss) => { const o = S.next({}); let r; o.parts.forEach((p, k) => { const i = miss && k === 0 ? p.coins.findIndex((c) => !c.good) : p.coins.findIndex((c) => c.good); r = S.answer(o, k, i); if (miss && k === 0) S.answer(o, k, p.coins.findIndex((c) => c.good)); }); return r; };
  play(false); play(false); assert.equal(st.step, 3);
  play(true); assert.equal(st.step, 3, 'one slip forgiven');
  play(true); assert.equal(st.step, 3 - PLACE_BELOW); assert.equal(st.placing, false);
  const at = st.step;
  for (let i = 0; i < CLEAN_TO_CLIMB; i++) play(false);
  assert.equal(st.step, at + 1);
  play(true); assert.equal(st.step, at, 'down one for a miss');
  assert.equal(PLACEMENT_MISSES, 2);
});

test('peeking at the picture is free: paid the same, just not counted toward the climb', () => {
  const st = { step: 2, placing: false }, S = makeSupplies(st, { rand: seeded(5) });
  for (let n = 0; n < CLEAN_TO_CLIMB + 1; n++) { const o = S.next({}); o.parts.forEach((p, k) => S.answer(o, k, p.coins.findIndex((c) => c.good), { helped: true })); }
  assert.equal(st.step, 2);
});

// ---- on the strands (the adaptive game) -------------------------------------------------------------------------------
import { GOODS } from '../src/math/supplies.js';
import { STRAND } from '../src/math/strands.js';
import { needsLong, longPoint, workMul, workDiv } from '../src/math/longwork.js';

test('each part counts in its own strand; a part too big for the head carries the worked area, which works out to the part\'s answer', () => {
  let longs = 0, leads = 0, finals = 0;
  for (const o of everyOrder(40)) {
    for (const p of o.parts) {
      if (p.credit) assert.ok(STRAND[p.credit.strand] && p.credit.at >= 0 && p.credit.at <= 100, `${p.key}: ${JSON.stringify(p.credit)}`);
      else assert.equal(p.word, 'dozen', 'only the dozen counts nowhere (it is just a word)');
      if (p.key === 'vocab' && p.word !== 'dozen') assert.equal(p.credit.strand, 'time');
      if (p.key === 'cost') assert.equal(p.credit.strand, 'money');
      if (p.key === 'total') assert.ok(['mul', 'long'].includes(p.credit.strand));
      if (p.key === 'crates') assert.ok(['div', 'long'].includes(p.credit.strand));
      if (!p.long) { if (p.credit) assert.notEqual(p.credit.strand, 'long'); continue; }
      longs++;
      const L = p.long, [x, y] = L.op === 'mul' ? [L.a, L.b] : [L.n, L.d];
      assert.ok(needsLong(L.op, x, y));
      assert.equal(L.point, longPoint(L.op, x, y)); assert.equal(p.credit.strand, 'long'); assert.equal(p.credit.at, L.point);
      assert.equal(L.setup.choices.filter((c) => c.good).length, 1, 'one right sum to work out');
      const w = L.op === 'mul' ? workMul(x, y, L.lead ? { lead: L.lead } : {}) : workDiv(x, y);
      if (L.op === 'mul') {
        assert.equal(p.key, 'total');
        assert.equal(w.answer, o.total, 'the worked sum is the total');
        if (L.lead) { leads++; assert.equal(L.lead.a * L.lead.b * L.b, o.total); assert.equal(w.steps[0].kind, 'lead'); }
      } else {
        assert.equal(p.key, 'crates'); finals++;
        assert.deepEqual(w.answer, { q: Math.floor(o.total / o.per), r: o.total % o.per });
        assert.deepEqual(L.final.choices.map((c) => c.label), p.coins.map((c) => c.label), 'the word answer is the slip\'s own coins');
      }
    }
  }
  assert.ok(longs > 100 && leads > 20 && finals > 20, `${longs} long, ${leads} with one day first, ${finals} divisions`);
});

test('the strands choose the step: the order is made there and the ladder stays; the youngest get a small order', () => {
  const S = makeSupplies({}, { rand: seeded(41) });
  const before = S.state.step;
  for (let i = 0; i < 8; i++) {
    const o = S.next({ step: 5, camp: { id: 'cow', short: 'the cow camp' }, who: 'Dusty' });
    assert.equal(o.step, 5); assert.ok(o.fixed);
    o.parts.forEach((p, k) => S.answer(o, k, p.coins.findIndex((c) => (i % 2 ? c.good : !c.good))));
  }
  assert.equal(S.state.step, before, 'answers on fixed orders never move the old ladder');
  for (let i = 0; i < 50; i++) {
    const o = makeSupplyOrder({ rand: seeded(500 + i), step: 1, small: true });
    assert.ok(o.hands <= 3 && o.total <= 12 && o.per <= 4 && o.exact, `${o.story}`);
    assert.ok(o.parts.every((p) => !p.long && p.coins.length === 3));
  }
});

test('longMost keeps the sums inside what the rider can do on paper (when the numbers allow)', () => {
  for (const most of [36, 44, 50]) {
    let over = 0;
    for (let i = 0; i < 200; i++) {
      const o = makeSupplyOrder({ rand: seeded(900 + i), step: 5, longMost: most });
      if (o.parts.some((p) => p.long && p.long.point > most)) over++;
    }
    assert.ok(over <= 4, `longMost ${most}: ${over} of 200 over`);
  }
});

test('more goods: bread, vegetables, matches for the lanterns and canteens (so many each, no days) join beans, coffee, oats and flour', () => {
  const seen = new Set();
  for (const o of everyOrder(30)) {
    seen.add(o.goods);
    if (o.goods === 'canteens') {
      assert.ok(o.noDays && o.days === null && /canteens?/.test(o.story) && !/to last/.test(o.story), o.story);
      assert.equal(o.total, o.hands * o.rate);
      assert.ok(!o.parts.some((p) => p.key === 'vocab' && p.word !== 'dozen'), 'no time words for canteens');
    }
    if (o.goods === 'matches') assert.match(o.story, /lanterns?/);
    assert.match(o.story, /(Beans|Oats|Vegetables|Matches|Canteens) come |(Coffee|Flour|Bread) comes /);
  }
  for (const g of Object.keys(GOODS)) assert.ok(seen.has(g), `${g} turns up`);
});
