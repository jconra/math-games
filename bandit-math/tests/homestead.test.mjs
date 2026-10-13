// Tests for the homestead's animals and goods (src/math/goods.js): buying, the thank-yous, laying up goods over play
// time, collecting them, the sale slips at the store counter, and how it all saves (src/save.js).
// Run with:  node --test bandit-math/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }; } });
const S = await import('../src/save.js');
const G = await import('../src/math/goods.js');
const { seeded } = await import('../src/math/wordproblems.js');
S.useSaveKey('bandit-math.riders.homesteadtest');

const rich = (gold = 1000) => { const r = S.newRider('Ada'); r.gold = gold; r.bounty = gold; return r; };

test('the prices make a ladder: a hen cheap, a milk cow dear; each kind has a cap', () => {
  const p = G.KINDS.map((k) => G.ANIMALS[k].price);
  assert.deepEqual([...p].sort((a, b) => a - b), p, 'cheapest first');
  assert.equal(G.KINDS[0], 'hen'); assert.equal(G.KINDS.at(-1), 'cow');
  for (const k of G.KINDS) { assert.ok(G.ANIMALS[k].most >= 1 && G.ANIMALS[k].most <= 6, k); assert.ok(G.NAMES[k].length >= G.ANIMALS[k].most, k + ' has enough names'); }
  assert.equal(G.ANIMALS.pig.goods, null, 'pigs give nothing');
});

test('buying: paid, named, capped, and short of gold changes nothing', () => {
  const r = rich(100);
  assert.equal(G.buyAnimal(r, 'hen', 'Pip', S.spend), 'bought');
  assert.equal(r.gold, 100 - G.ANIMALS.hen.price);
  assert.deepEqual(G.animalsOf(r), [{ kind: 'hen', name: 'Pip' }]);
  assert.equal(G.buyAnimal(r, 'hen', '  <b>Dot!</b> ', S.spend), 'bought');
  assert.equal(G.animalsOf(r)[1].name, 'bDotb', 'only letters, digits, spaces');
  assert.equal(G.buyAnimal(r, 'hen', '', S.spend), 'bought');
  assert.ok(G.NAMES.hen.includes(G.animalsOf(r)[2].name), 'no name typed: one is picked');
  const before = r.gold;
  assert.equal(G.buyAnimal(r, 'cow', 'Bessie', S.spend), 'short');
  assert.equal(r.gold, before); assert.equal(G.countOf(r, 'cow'), 0);
  const r2 = rich(1000);
  for (let i = 0; i < G.ANIMALS.hen.most; i++) assert.equal(G.buyAnimal(r2, 'hen', '', S.spend), 'bought');
  const g = r2.gold;
  assert.equal(G.buyAnimal(r2, 'hen', 'One too many', S.spend), 'full');
  assert.equal(r2.gold, g, 'a full coop takes no gold');
  assert.equal(G.buyAnimal(r2, 'dragon', 'x', S.spend), 'unknown');
});

test('thank-yous: now and then, only for a whole job, only with room; a young one grows up', () => {
  const r = rich();
  assert.equal(G.thankYou(r, 'flockDone', () => 0.99), null, 'not every time');
  assert.equal(G.thankYou(r, 'waveDone', () => 0), null, 'only the farm jobs');
  const lamb = G.thankYou(r, 'flockDone', () => 0);
  assert.equal(lamb.kind, 'sheep'); assert.equal(lamb.young, true);
  const piglet = G.thankYou(r, 'pigsDone', () => 0);
  assert.equal(piglet.kind, 'pig');
  for (let i = 0; i < 10; i++) G.thankYou(r, 'flockDone', () => 0);
  assert.equal(G.countOf(r, 'sheep'), G.ANIMALS.sheep.most, 'never past the cap');
  // a lamb lays up no wool until grown
  const r2 = rich(); G.thankYou(r2, 'flockDone', () => 0);
  assert.deepEqual(G.lay(r2, G.GROW / 2), []);
  assert.equal(G.waiting(r2).wool, 0);
  assert.deepEqual(G.lay(r2, G.GROW / 2 + 1), [G.animalsOf(r2)[0].name], 'grown up');
  assert.equal(G.animalsOf(r2)[0].young, undefined);
  G.lay(r2, G.ANIMALS.sheep.every * 2 + 1);
  assert.equal(G.waiting(r2).wool, 2);
  // over the chance, about GIFT.chance of finished jobs bring one (when there's room)
  const rand = seeded(5); let n = 0;
  for (let i = 0; i < 2000; i++) { const rr = rich(); if (G.thankYou(rr, 'pigsDone', rand)) n++; }
  assert.ok(Math.abs(n / 2000 - G.GIFT.chance) < 0.04, `about ${G.GIFT.chance}: ${n / 2000}`);
});

test('goods: laid up over play time, held at the yard up to its cap, collected into the saddlebags', () => {
  const r = rich();
  G.buyAnimal(r, 'hen', 'A', S.spend); G.buyAnimal(r, 'hen', 'B', S.spend); G.buyAnimal(r, 'cow', 'C', S.spend); G.buyAnimal(r, 'pig', 'D', S.spend);
  G.lay(r, G.ANIMALS.hen.every * 3 + 0.5);
  assert.equal(G.waiting(r).eggs, 6, 'two hens, three eggs each');
  assert.ok(G.waiting(r).milk >= 3);
  assert.equal(G.collect(r, ['wool']), null, 'nothing of that kind');
  const got = G.collect(r, ['eggs']);
  assert.deepEqual(got, { eggs: 6 });
  assert.equal(G.homestead(r).goods.eggs, 6);
  assert.equal(G.waiting(r).eggs, 0);
  assert.equal(G.gotLine(got), '+6 eggs');
  assert.match(G.goodsLine(r), /^6 eggs to sell$/);
  // a long time away from the yard: it holds only so much
  G.lay(r, 1e6);
  assert.equal(G.waiting(r).eggs, G.GOODS.eggs.yard);
  // the saddlebags carry only so much: the rest waits
  G.homestead(r).goods.eggs = G.GOODS.eggs.bag - 4;
  assert.deepEqual(G.collect(r, ['eggs']), { eggs: 4 });
  assert.equal(G.waiting(r).eggs, G.GOODS.eggs.yard - 4);
});

test('a sale slip: the right coin is the gold it comes to, levelled by the store step, the picture never shows it', () => {
  const rand = seeded(11);
  const forms = {};
  for (let step = 1; step <= 9; step++) {
    for (let i = 0; i < 300; i++) {
      const carried = { eggs: Math.floor(rand() * 90), wool: Math.floor(rand() * 20), milk: Math.floor(rand() * 40) };
      const o = G.makeSale(carried, { step, who: { name: 'Rosa Vega', she: true }, rand });
      if (!o) continue;
      const s = o.sale;
      (forms[step] = forms[step] || new Set()).add(s.form);
      assert.equal(o.coins.filter((c) => c.good).length, 1);
      const right = o.coins.find((c) => c.good);
      assert.equal(right.v, s.gold); assert.equal(right.label, `${s.gold} gold`);
      assert.ok(s.gold > 0 && s.sold > 0 && s.sold <= carried[s.goods], `${o.key}: sells what is carried`);
      assert.equal(new Set(o.coins.map((c) => c.v)).size, o.coins.length, 'no coin twice');
      assert.ok(o.coins.length >= 3 && o.coins.length <= 4);
      for (const c of o.coins.filter((x) => !x.good)) assert.ok(c.why && c.why.length < 170, `${o.key}: a short why (${c.slip})`);
      const pic = o.picture(o.pic);
      assert.ok(pic.svg.startsWith('<svg') && pic.title && pic.line, `${o.key}: a picture`);
      assert.ok(!new RegExp(`>${s.gold}<`).test(pic.svg) && !new RegExp(`>${s.gold} gold<`).test(pic.svg), `${o.key}: the picture hides ${s.gold}`);
      assert.ok(!pic.line.includes(`= ${s.gold}`), `${o.key}: the line hides it too`);
      // the numbers in the story are the gold's own working
      if (s.form === 'lots' || s.form === 'count' || s.form === 'leftover' || s.form === 'half') {
        const per = o.pic.per, price = o.pic.price;
        assert.equal(s.gold, Math.floor(o.pic.n / per) * price, `${o.key}: ${o.story}`);
        assert.equal(s.sold, Math.floor(o.pic.n / per) * per);
      }
    }
  }
  assert.deepEqual([...forms[1]], ['lots']);
  assert.deepEqual([...forms[3]], ['count']);
  assert.ok(forms[5].has('leftover') && forms[5].has('half'));
  assert.ok(forms[8].has('unit'));
});

test('the slips kids really make are among the wrong coins', () => {
  // 30 eggs at 2 gold a dozen, whole dozens only: 4 gold; slips: 6 (a dozen too many), 10 (the 6 eggs as gold), 60 (every egg)
  const slips = new Map();
  const rand = seeded(3);
  for (let i = 0; i < 400; i++) {
    const o = G.makeSale({ eggs: 30 }, { step: 5, rand });
    if (!o || o.sale.form !== 'leftover' || o.pic.price !== 2) continue;
    for (const c of o.coins) if (!c.good) slips.set(c.slip, c.v);
    assert.equal(o.sale.gold, 4); assert.equal(o.sale.sold, 24); assert.equal(o.sale.left, 6);
  }
  assert.ok(slips.size >= 3);
  for (const [slip, v] of slips) assert.equal(v, { roundedUp: 6, leftoverAdded: 10, wrongSize: 6, perItem: 60, lotsOnly: 2 }[slip], slip);
  // nothing to sell, or too little for a whole lot at this step: no sale
  assert.equal(G.makeSale({ eggs: 0, wool: 0, milk: 0 }, { step: 4 }), null);
  assert.equal(G.makeSale({ eggs: 11 }, { step: 1 }), null);
});

test('selling takes the goods out of the saddlebags; the leftover stays', () => {
  const r = rich();
  G.homestead(r).goods.eggs = 30;
  const o = G.makeSale(G.homestead(r).goods, { step: 5, rand: seeded(9) });
  G.sold(r, o);
  assert.equal(G.homestead(r).goods[o.sale.goods], 30 - o.sale.sold);
  assert.ok(G.homestead(r).goods.eggs >= 0);
});

test('saves: animals, goods and the yard come back; old saves load fine; damaged ones are tidied', () => {
  const r = rich();
  G.buyAnimal(r, 'cow', 'Bessie', S.spend); G.thankYou(r, 'flockDone', () => 0);
  G.lay(r, 300); G.collect(r);
  G.homestead(r).goods.eggs = 12;
  S.saveRider(r);
  const back = S.loadRiders().find((x) => x.id === r.id);
  assert.deepEqual(back.owned.animals.map((a) => [a.kind, a.name, !!a.young]), G.animalsOf(r).map((a) => [a.kind, a.name, !!a.young]));
  assert.equal(back.owned.goods.eggs, 12); assert.equal(back.owned.goods.milk, G.homestead(r).goods.milk);
  assert.ok(Math.abs(back.owned.yard.milk - G.homestead(r).yard.milk) < 1e-9, 'the part of a quart kept too');
  // an old save without any of it loads, and gets the homestead only when asked
  const old = S.fixRider({ id: 'old1', name: 'Old', owned: { saddle: 'plain', horse: 'bay', dog: null } });
  assert.equal(old.owned.animals, undefined);
  assert.deepEqual(G.animalsOf(old), []); assert.deepEqual(G.homestead(old).goods, { eggs: 0, wool: 0, milk: 0 });
  // a hand-edited one: unknown kinds, too many, bad numbers
  const bad = S.fixRider({ id: 'bad1', name: 'Bad', owned: { animals: [{ kind: 'dragon', name: 'x' }, ...Array(9).fill(0).map(() => ({ kind: 'cow', name: 'Moo' })), 'junk', { kind: 'pig' }],
    goods: { eggs: -4, wool: 'lots', milk: 1e9 }, yard: { eggs: 2.5 } } });
  assert.equal(bad.owned.animals.filter((a) => a.kind === 'cow').length, G.ANIMALS.cow.most);
  assert.ok(!bad.owned.animals.some((a) => a.kind === 'dragon'));
  assert.ok(bad.owned.animals.find((a) => a.kind === 'pig').name.length > 0, 'a pig with no name gets one');
  assert.deepEqual(bad.owned.goods, { eggs: 0, wool: 0, milk: G.GOODS.milk.bag });
  assert.equal(bad.owned.yard.eggs, 2.5);
});

test('a price-for-a-bigger-lot egg sale always has two dozen or more to work out (one dozen would give it away)', () => {
  const rand = seeded(91);
  let units = 0;
  for (let i = 0; i < 4000; i++) {
    const eggs = 12 + Math.floor(rand() * 40);
    const o = G.makeSale({ eggs, wool: 0, milk: 0 }, { step: 7 + Math.floor(rand() * 3), rand });
    if (!o || o.key !== 'sale:eggs:unit') continue;
    units++;
    assert.ok(o.sale.sold >= 24, `sold ${o.sale.sold} of ${eggs}`);
  }
  assert.ok(units > 50, 'egg sales by the bigger lot still happen: ' + units);
});
