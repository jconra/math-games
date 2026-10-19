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
  // (found among the step-3 orders: a fortnight, exact crates)
  let found = null;
  const r = seeded(7);
  for (let i = 0; i < 5000 && !found; i++) {
    const o = makeSupplyOrder({ rand: r, step: 3, vocab: {} });
    if (o.goods === 'beans' && o.hands === 6 && o.rate === 3 && o.days === 14 && o.per === 12) found = o;
  }
  assert.ok(found, 'the example comes up');
  assert.equal(found.total, 252); assert.equal(found.crates, 21);
  assert.equal(Math.ceil(250 / 12), 21);
});

test('every order: the numbers add up, one right coin a step, wrong coins never equal the answer or repeat', () => {
  for (const o of everyOrder()) {
    assert.equal(o.total, o.hands * o.rate * o.days);
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

test('the ladder: two numbers, then three, then a week and a fortnight, then rounding up, then the cost', () => {
  const kinds = (step) => { const r = seeded(100 + step); const o = makeSupplyOrder({ rand: r, step, vocab: ALL_NEW }); return o; };
  assert.equal(kinds(1).rate, 1);
  assert.ok(kinds(2).rate >= 2);
  const r3 = seeded(33); for (let i = 0; i < 50; i++) { const o = makeSupplyOrder({ rand: r3, step: 3, vocab: ALL_NEW }); assert.ok(o.exact); assert.ok(o.period.word !== 'days'); assert.equal(o.parts[0].key, 'vocab'); }
  const r4 = seeded(44); for (let i = 0; i < 50; i++) { const o = makeSupplyOrder({ rand: r4, step: 4, vocab: {} }); assert.ok(!o.exact, 'step 4 rounds up'); assert.ok(o.parts.every((p) => p.key !== 'cost')); }
  const r5 = seeded(55); for (let i = 0; i < 50; i++) { const o = makeSupplyOrder({ rand: r5, step: 5, vocab: {} }); assert.equal(o.parts[o.parts.length - 1].key, 'cost'); }
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
  for (let i = 0; i < 100; i++) { const o = makeSupplyOrder({ rand: r, step: 4, vocab: {} }); const p = o.parts.find((q) => q.key === 'crates'); assert.ok(p.coins.some((c) => c.slip === 'roundDown')); }
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
