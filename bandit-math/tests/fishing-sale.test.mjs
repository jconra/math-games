// Selling fish at the store counter (src/math/fishsale.js): every form's answer re-worked from the fish's own weights and
// the story's numbers, whole gold, the wrong coins never the answer, the picture never showing the answer, and the
// fish sold real ones from the saddlebags.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFishSale, fishPicture, shownNumbers, formsBelow, mapOfForm, cleanFish, SALE_FORMS, STRAND_OF } from '../src/math/fishsale.js';
import { ladderQuestion } from '../labs/fishing/questions.js';
import { value, plus, fr } from '../labs/fishing/frac.js';
import { MAPS } from '../src/math/strands.js';

const seeded = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
// a saddlebag of real fish (the dock's questions make them), n of them
function creelOf(n, rnd) {
  const out = [];
  for (let i = 0; out.length < n && i < 200; i++) { const q = ladderQuestion(1 + Math.floor(rnd() * 7), rnd); out.push(JSON.parse(JSON.stringify(q.fish))); }
  return out;
}
const who = { name: 'Rosa Vega', she: true };
const num = (re, s) => { const m = s.match(re); return m ? m.slice(1) : null; };

test('fish sale: the maps and forms line up with strands.js', () => {
  for (const [m, forms] of Object.entries(SALE_FORMS)) {
    assert.ok(MAPS[m], `map ${m} is in strands.js`);
    assert.equal(MAPS[m].strand, STRAND_OF[m]);
    assert.deepEqual(MAPS[m].ids, forms);
    for (const f of forms) assert.equal(mapOfForm(f), m);
  }
  assert.deepEqual(formsBelow('three'), ['three', 'pair', 'pound', 'count']);
  assert.deepEqual(formsBelow('count'), ['count']);
  assert.equal(formsBelow('rate')[0], 'rate');
});

test('fish sale: every form works out from its own numbers, 3 seed sets', () => {
  for (const seed of [11, 202, 3003]) {
    const rnd = seeded(seed);
    let made = { count: 0, pound: 0, pair: 0, three: 0, rate: 0 };
    for (let t = 0; t < 300; t++) {
      const creel = creelOf(1 + Math.floor(rnd() * 8), rnd);
      for (const form of Object.keys(made)) {
        const o = makeFishSale(creel, { form, who, rand: rnd });
        if (!o) continue;
        made[form]++;
        const s = o.sale, gold = s.gold;
        assert.ok(Number.isInteger(gold) && gold > 0, `${form}: whole gold ${gold}`);
        assert.equal(o.coins.filter((c) => c.good).length, 1);
        assert.equal(o.coins.find((c) => c.good).v, gold);
        for (const c of o.coins) if (!c.good) { assert.notEqual(c.v, gold); assert.ok(c.v > 0 && Number.isInteger(c.v)); assert.ok(c.why); }
        assert.ok(o.coins.length >= 3, `${form}: at least 3 coins`);
        assert.equal(new Set(o.coins.map((c) => c.v)).size, o.coins.length, 'no coin twice');
        // the fish sold are real ones, none twice
        assert.equal(new Set(s.fish).size, s.fish.length);
        for (const i of s.fish) assert.ok(i >= 0 && i < creel.length);
        assert.equal(s.sold, s.fish.length);
        const ws = s.fish.map((i) => fr(creel[i].lb.n, creel[i].lb.d));
        // re-worked from the story
        if (form === 'count') { const [p, n] = num(/pays (\d+) gold for each fish\. You bring (\d+) fish/, o.story).map(Number); assert.equal(n, s.sold); assert.equal(gold, n * p); }
        if (form === 'rate') { const [G, F, n] = num(/pays (\d+) gold for every (\d+) fish\. You bring (\d+) fish/, o.story).map(Number); assert.equal(n, s.sold); assert.equal(n % F, 0); assert.equal(gold, n / F * G); }
        if (['pound', 'pair', 'three'].includes(form)) {
          const [p] = num(/pays (\d+) gold a pound/, o.story).map(Number);
          const sum = ws.reduce((a, b) => plus(a, b), fr(0));
          assert.equal(gold, Math.round(value(sum) * p)); assert.ok(Math.abs(value(sum) * p - gold) < 1e-9, 'whole without rounding');
          assert.equal(s.sold, { pound: 1, pair: 2, three: 3 }[form]);
          // the weights in the story are the fish's own
          for (const w of ws) assert.ok(o.story.includes(w.n % w.d === 0 ? `${w.n / w.d} pound` : `/${w.d}`), `${o.story} names ${w.n}/${w.d}`);
        }
        // the picture: drawn, and never the answer (but by the fish, one fish: its price is the answer)
        const pic = fishPicture(o.pic);
        assert.ok(pic.svg.startsWith('<svg') && pic.line, `${form}: a picture`);
        // (an answer the story itself says, the price of exactly one pound, is no give-away)
        const told = (o.story.match(/\d+/g) || []).map(Number).includes(gold);
        if (!told) assert.ok(!shownNumbers(o.pic).includes(gold), `${form}: the picture shows the answer ${gold}: ${pic.line}`);
        assert.equal(s.strand, STRAND_OF[s.map]);
      }
    }
    for (const [form, n] of Object.entries(made)) assert.ok(n > 30, `seed ${seed}: ${form} made ${n} times`);
  }
});

test('fish sale: too few fish for a form gives null, and nothing to sell gives null', () => {
  const rnd = seeded(5), one = creelOf(1, rnd);
  assert.equal(makeFishSale([], { form: 'count', rand: rnd }), null);
  assert.equal(makeFishSale(one, { form: 'pair', rand: rnd }), null);
  assert.equal(makeFishSale(one, { form: 'three', rand: rnd }), null);
  assert.equal(makeFishSale(one, { form: 'rate', rand: rnd }), null);
  assert.ok(makeFishSale(one, { form: 'count', rand: rnd }));
  assert.equal(cleanFish({ kind: 'shark', len: { n: 1, d: 1, unit: 'ft' }, lb: { n: 1, d: 1, unit: 'lb' } }), null);
  assert.equal(cleanFish({ kind: 'trout', len: { n: 1, d: 0, unit: 'ft' }, lb: { n: 1, d: 1, unit: 'lb' } }), null);
  assert.ok(cleanFish({ kind: 'trout', len: { n: 3, d: 4, unit: 'ft' }, lb: { n: 1, d: 4, unit: 'lb' } }));
});

test('fish sale: the gold fits the economy (a few gold a fish)', () => {
  const rnd = seeded(77); let fish = 0, gold = 0;
  for (let t = 0; t < 400; t++) {
    const creel = creelOf(6, rnd);
    for (const form of ['count', 'pound', 'pair', 'three', 'rate']) { const o = makeFishSale(creel, { form, who, rand: rnd }); if (o) { fish += o.sale.sold; gold += o.sale.gold; } }
  }
  const each = gold / fish;
  assert.ok(each >= 1.5 && each <= 8, `about ${each.toFixed(2)} gold a fish`);
});

// a fish weighed in twelfths (or thirds, sixths) has no price a pound that makes the gold whole: no pound sale for
// it (the slip once read "She pays undefined gold a pound"); with another fish that fits, that one is sold
test('fish sale: a weight no price splits into is never sold by the pound', () => {
  const odd = { kind: 'catfish', len: { n: 1, d: 1, unit: 'ft', form: 'mixed' }, lb: { n: 7, d: 12, unit: 'lb', form: 'mixed' } };
  const ok = { kind: 'perch', len: { n: 3, d: 4, unit: 'ft', form: 'frac' }, lb: { n: 3, d: 8, unit: 'lb', form: 'mixed' } };
  for (const seed of [1, 2, 3]) {
    const rnd = seeded(seed);
    for (let i = 0; i < 20; i++) {
      assert.equal(makeFishSale([odd], { form: 'pound', rand: rnd }), null);
      const o = makeFishSale([odd, ok], { form: 'pound', rand: rnd });
      assert.ok(o && Number.isInteger(o.sale.gold) && !/undefined|NaN/.test(o.story), o && o.story);
      assert.deepEqual(o.sale.fish, [1]);
    }
  }
});
