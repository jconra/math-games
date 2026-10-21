// The store counter's and the deliveries' ladders (src/levels/place/store.js, deliveries.js): every level's every kind
// makes real orders with the counter's own makers, each kind climbs at most one of its own steps from one level to the
// next (no big jumps), the clock starts at the hour, big orders stay the deliveries', and the example makers are the
// job's makers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACE as STORE, storeOrder, pickAsk, askAt, storeExample } from '../src/levels/place/store.js';
import { PLACE as DELIV, deliveriesOrder } from '../src/levels/place/deliveries.js';
import { makeWordProblems } from '../src/math/wordproblems.js';
import { LADDER as SUPPLIES } from '../src/math/supplies.js';
import { seeded } from '../src/levels/kit.js';
import { STRAND } from '../src/math/strands.js';

const BAD = /NaN|undefined|Infinity|null|\[object/;

test('every store level: every kind in its mix makes good orders (one right coin, 3 or 4 coins, no NaN), recorded at its own step', () => {
  for (const L of STORE.levels) {
    assert.ok(L.gen.mix.length >= 1 && L.gen.mix.length <= 4, `${L.id}: 1 to 4 kinds`);
    for (const a of L.gen.mix) {
      for (let sd = 1; sd <= 25; sd++) {
        const o = storeOrder(a, { rand: seeded(sd * 31 + L.grade), longMost: L.grade });
        assert.ok(!BAD.test(`${o.story} ${o.ask} ${o.answer}`), `${L.id} ${a.maker}${a.step}: ${o.story} ${o.ask}`);
        assert.equal(o.coins.filter((c) => c.good).length, 1, `${L.id}: one right coin`);
        assert.ok(o.coins.length >= 3 && o.coins.length <= 4, `${L.id}: ${o.coins.length} coins`);
        assert.equal(new Set(o.coins.map((c) => c.label)).size, o.coins.length, `${L.id}: no coin twice (${o.coins.map((c) => c.label)})`);
        assert.ok(o.coins.every((c) => !/^[−-]/.test(c.label)), `${L.id}: no coin below nothing (${o.coins.map((c) => c.label)})`);
        assert.ok(STRAND[o.own.strand], `${L.id}: ${o.own.strand} is a strand`);
        assert.equal(o.own.at, askAt(a));
        if (a.types) assert.ok(a.types.includes(o.type), `${L.id}: a ${o.type} order for ${a.types}`);
        assert.notEqual(o.type, 'bulk', 'big orders are the deliveries\'');
      }
    }
  }
});

test('no big jumps: from one level to the next, each kind moves at most one of its own steps, and a level brings at most two new things', () => {
  const most = {};   // the hardest step of each kind met so far
  STORE.levels.forEach((L, i) => {
    let fresh = 0;
    for (const a of L.gen.mix) {
      const was = most[a.maker] ?? 0;
      assert.ok(a.step <= was + 1, `${L.id}: ${a.maker} step ${a.step} after ${was}`);
      if (a.step > was) fresh++;
    }
    for (const a of L.gen.mix) most[a.maker] = Math.max(most[a.maker] ?? 0, a.step);
    // (the ratios' first two steps ARE the word problems' speed and recipe stories, src/math/ratios.js: met there)
    most.ratio = Math.max(most.ratio ?? 0, (most.words ?? 0) >= 7 ? 2 : (most.words ?? 0) >= 4 ? 1 : 0);
    assert.ok(fresh <= 2, `${L.id}: ${fresh} new things at once`);
    if (i) assert.ok(L.grade >= STORE.levels[i - 1].grade, `${L.id}: the grades go up`);
    // the newest kind comes up most
    const top = Math.max(...L.gen.mix.map((a) => a.w ?? 1));
    assert.ok(L.gen.mix.filter((a) => (a.w ?? 1) === top).length === 1 || L.gen.mix.length === 1, `${L.id}: one kind leads`);
  });
  // every step of every kind is met somewhere on the ladder (nothing skipped): the hour first on the clock
  const steps = {};
  for (const L of STORE.levels) for (const a of L.gen.mix) (steps[a.maker] ||= new Set()).add(a.step);
  for (const [k, n] of Object.entries({ wordsK: 4, money: 7, time: 9, dec: 6, pct: 5 })) for (let s = 1; s <= n; s++) assert.ok(steps[k].has(s), `${k} step ${s} is met`);
  const firstClock = STORE.levels.find((L) => L.gen.mix.some((a) => a.maker === 'time'));
  assert.deepEqual(firstClock.gen.mix.filter((a) => a.maker === 'time').map((a) => a.step), [1], 'the clock starts at the hour');
  assert.ok(STORE.levels.some((L) => L.id === STORE.fastFrom), 'fast answers count double from a real level');
});

test('the counter deals by weight and not the same kind twice running when there is another', () => {
  const L = STORE.levels.find((x) => x.id === 'cents'), rand = seeded(4), seen = {};
  let last = null;
  for (let k = 0; k < 600; k++) {
    const a = pickAsk(L.gen.mix, rand, last);
    assert.ok(!(last && a.maker === last.maker && a.step === last.step), 'not twice running');
    seen[a.maker + a.step] = (seen[a.maker + a.step] || 0) + 1;
    last = a;
  }
  assert.ok(seen.money4 > seen.time7 && seen.money4 > seen.words4, JSON.stringify(seen));
});

test('the store\'s trainer keeps the word problems to the level\'s kinds, and a missed kind of those comes back', () => {
  const Q = makeWordProblems({}, { rand: seeded(3) });
  const a = { maker: 'words', step: 6, types: ['twostep'] };
  for (let k = 0; k < 30; k++) assert.equal(storeOrder(a, { trainer: Q, rand: seeded(k) }).type, 'twostep');
});

test('the examples are the counter\'s own orders (one source)', () => {
  for (const L of STORE.levels) {
    const e = storeExample(L.gen, seeded(7));
    assert.ok(e.q && e.a && !BAD.test(e.q + e.a), `${L.id}: ${e.q} -> ${e.a}`);
    assert.deepEqual(STORE.example(L, seeded(9)), storeExample(L.gen, seeded(9)));
  }
});

test('deliveries: small orders, then one new thing a level; the week before the fortnight; the example is the slip\'s maker', () => {
  assert.equal(DELIV.levels[0].gen.small, true);
  const steps = DELIV.levels.slice(1).map((L) => L.gen.step);
  assert.deepEqual(steps, SUPPLIES.map((_, i) => i + 1), 'every row of the supplies ladder, in order');
  for (let i = 1; i < DELIV.levels.length; i++) assert.ok(DELIV.levels[i].grade > DELIV.levels[i - 1].grade);
  const week = DELIV.levels.find((L) => L.id === 'week'), fort = DELIV.levels.find((L) => L.id === 'fortnight');
  for (let sd = 1; sd <= 40; sd++) {
    assert.equal(deliveriesOrder(week.gen, { rand: seeded(sd) }).period.word, 'week');
    assert.equal(deliveriesOrder(fort.gen, { rand: seeded(sd) }).period.word, 'fortnight');
  }
  for (const L of DELIV.levels) for (let sd = 1; sd <= 30; sd++) {
    const o = deliveriesOrder(L.gen, { rand: seeded(sd * 7), vocab: { week: true, fortnight: true } });
    for (const p of o.parts) assert.ok(!/(\w+) of \1\b/.test(p.ask), `${L.id}: ${p.ask}`);   // (no "matches of matches")
    assert.ok(!BAD.test(o.story + o.parts.map((p) => p.ask).join(' ')));
  }
});
