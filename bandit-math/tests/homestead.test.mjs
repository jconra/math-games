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
// a rider who has earned every kind (the store sells them all)
const farmer = (gold = 1000) => { const r = rich(gold); G.homestead(r).farm.unlocked = ['pig', 'sheep', 'cow']; return r; };
// every number an svg's words and a line show
const numbersIn = (svg, line = '') => (((svg.match(/>([^<]*)</g) || []).join(' ') + ' ' + line).match(/\d+/g) || []).map(Number);

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
  assert.equal(G.buyAnimal(r, 'cow', 'Bessie', S.spend), 'locked', 'a milk cow has to be earned first');
  G.homestead(r).farm.unlocked.push('cow');
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
  assert.equal(G.thankYou(r, 'boxWon', () => 0), null, 'only the jobs that have a young one to give');
  const lamb = G.thankYou(r, 'flockDone', () => 0);
  assert.equal(lamb.kind, 'sheep'); assert.equal(lamb.young, true);
  const piglet = G.thankYou(r, 'pigsDone', () => 0);
  assert.equal(piglet.kind, 'pig');
  const calf = G.thankYou(r, 'waveDone', () => 0);
  assert.equal(calf.kind, 'cow'); assert.equal(calf.young, true, 'a calf from a whole round-up wave');
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
  // over the chance, about GIFT.chance of finished jobs bring one (when there's room; once the kind is earned, or on a
  // first job that isn't yet the sure one)
  const rand = seeded(5); let n = 0;
  for (let i = 0; i < 2000; i++) { const rr = rich(); if (G.thankYou(rr, 'pigsDone', rand)) n++; }
  assert.ok(Math.abs(n / 2000 - G.GIFT.chance) < 0.04, `about ${G.GIFT.chance}: ${n / 2000}`);
  n = 0;
  for (let i = 0; i < 2000; i++) { const rr = farmer(); if (G.thankYou(rr, 'waveDone', rand)) n++; }
  assert.ok(Math.abs(n / 2000 - G.GIFT.chanceOf.cow) < 0.03, `calves rarer, about ${G.GIFT.chanceOf.cow}: ${n / 2000}`);
});

test('goods: laid up over play time, held at the yard up to its cap, collected into the saddlebags', () => {
  const r = farmer();
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
      (forms[step] = forms[step] || new Set()).add(s.goods + ':' + s.form);
      assert.equal(o.coins.filter((c) => c.good).length, 1);
      const right = o.coins.find((c) => c.good);
      if (o.unit[0] === 'gold') { assert.equal(right.v, s.gold); assert.equal(right.label, `${s.gold} gold`); }
      else { assert.equal(s.goods, 'wool'); assert.equal(right.label, `${right.v} lb`, 'a wool share asked in pounds'); }
      assert.ok(s.gold > 0 && s.sold > 0 && s.sold <= carried[s.goods], `${o.key}: sells what is carried`);
      assert.equal(new Set(o.coins.map((c) => c.v)).size, o.coins.length, 'no coin twice');
      assert.ok(o.coins.length >= 3 && o.coins.length <= 4);
      for (const c of o.coins.filter((x) => !x.good)) assert.ok(c.why && c.why.length < 170, `${o.key}: a short why (${c.slip})`);
      const pic = o.picture(o.pic);
      assert.ok(pic.svg.startsWith('<svg') && pic.title && pic.line, `${o.key}: a picture`);
      assert.ok(!new RegExp(`>${right.v}<`).test(pic.svg) && !new RegExp(`>${right.v} gold<`).test(pic.svg), `${o.key}: the picture hides ${right.v}`);
      assert.ok(!pic.line.includes(`= ${right.v}`), `${o.key}: the line hides it too`);
      // the numbers in the story are the gold's own working
      if (s.form === 'lots' || s.form === 'count' || s.form === 'leftover' || s.form === 'half') {
        const per = o.pic.per, price = o.pic.price;
        assert.equal(s.gold, Math.floor(o.pic.n / per) * price, `${o.key}: ${o.story}`);
        assert.equal(s.sold, Math.floor(o.pic.n / per) * per);
      }
    }
  }
  const of = (step, g) => [...forms[step]].filter((f) => f.startsWith(g + ':')).map((f) => f.split(':')[1]).sort();
  assert.deepEqual(of(1, 'eggs'), ['lots']); assert.deepEqual(of(1, 'wool'), ['unit']);
  assert.deepEqual(of(3, 'milk'), ['count']); assert.deepEqual(of(3, 'wool'), ['part']);
  assert.ok(forms[5].has('eggs:leftover') && forms[5].has('eggs:half')); assert.deepEqual(of(5, 'wool'), ['priced']);
  assert.ok(forms[8].has('eggs:unit')); assert.deepEqual(of(8, 'wool'), ['priced', 'two']);
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
  const r = farmer();
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
  // the kinds unlocked and the jobs counted come back too
  const u = rich(); G.thankYou(u, 'pigsDone', () => 0.99); G.thankYou(u, 'flockDone', () => 0); S.saveRider(u);
  const ub = S.loadRiders().find((x) => x.id === u.id);
  assert.ok(G.unlocked(ub, 'sheep') && !G.unlocked(ub, 'pig'));
  assert.equal(G.homestead(ub).farm.jobs.pig, 1, 'one batch of pigs counted toward the first piglet');
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

test('wool sells as fractions, levelled by the store step; whole-number answers that are the share worked out', () => {
  const rand = seeded(29);
  const seen = {};
  for (let step = 1; step <= 9; step++) {
    for (let i = 0; i < 500; i++) {
      const carried = 4 + Math.floor(rand() * 37);
      const o = G.makeSale({ eggs: 0, wool: carried, milk: 0 }, { step, who: { name: 'Hattie Bell', she: true }, rand });
      if (!o) continue;
      const s = o.sale, p = o.pic, right = o.coins.find((c) => c.good);
      assert.equal(s.goods, 'wool'); assert.equal(p.kind, 'fraction');
      (seen[step] = seen[step] || new Set()).add(s.form);
      assert.ok(Number.isInteger(right.v) && right.v > 0, `${o.story} -> ${right.v}`);
      for (const c of o.coins) assert.ok(Number.isInteger(c.v) && c.v > 0, `every coin a whole number: ${c.label}`);
      assert.ok(p.n <= carried && s.sold <= p.n && s.left === carried - s.sold, `${o.story}: sells part of what is carried`);
      // the story says the fraction(s), and the answer is the share worked out from them
      const fr = [...o.story.matchAll(/(\d+)\/(\d+)/g)].map((m) => [+m[1], +m[2]]);
      const share = ([a, b]) => { assert.equal((p.n * a) % b, 0, `${o.story}: a whole number of pounds`); return (p.n * a) / b; };
      if (s.form === 'unit' || s.form === 'part') {
        assert.equal(fr.length, 1); if (s.form === 'unit') assert.equal(fr[0][0], 1, 'one part at the bottom steps');
        else assert.ok(fr[0][0] > 1, 'more than one part');
        assert.equal(right.v, share(fr[0])); assert.equal(s.sold, right.v);
        assert.equal(s.gold, right.v * G.WOOL.price, 'paid by the pound');
        assert.match(o.ask, /How many pounds/);
      } else if (s.form === 'priced') {
        const price = +o.story.match(/pays (\d+) gold a pound/)[1];
        assert.equal(s.sold, share(fr[0])); assert.equal(right.v, s.sold * price); assert.equal(s.gold, right.v);
        assert.equal(right.label, `${right.v} gold`);
      } else {
        assert.equal(fr.length, 2, 'two buyers');
        const [s1, s2] = fr.map(share);
        assert.equal(s.sold, s1 + s2);
        assert.ok(s1 + s2 < p.n, 'never all of it between them');
        const want = /in all/.test(o.ask) ? s1 + s2 : /more/.test(o.ask) ? Math.abs(s1 - s2) : p.n - s1 - s2;
        assert.equal(right.v, want, `${o.story} ${o.ask}`);
      }
      // the picture: a bale cut into the parts, the bought ones shaded, and never the answer
      const pic = o.picture(p);
      assert.ok(!numbersIn(pic.svg, pic.line).includes(right.v), `${o.story} ${o.ask}: the picture hides ${right.v}`);
      const shaded = (pic.svg.match(/fill="#d6a85c"/g) || []).length + (pic.svg.match(/fill="#9fbf9a"/g) || []).length;
      assert.equal(shaded, p.shares.reduce((t, x) => t + x.parts, 0), 'the parts bought are shaded');
      assert.equal((pic.svg.match(/<rect /g) || []).length, p.parts, 'the bale cut into equal parts');
      assert.ok(pic.title && pic.line);
      for (const c of o.coins.filter((x) => !x.good)) assert.ok(c.why && c.why.length < 170, `${c.slip}: a short why (${c.why})`);
    }
  }
  assert.deepEqual([...seen[1]], ['unit']); assert.deepEqual([...seen[2]], ['unit']);
  assert.deepEqual([...seen[3]], ['part']); assert.deepEqual([...seen[6]], ['priced']);
  assert.ok(seen[7].has('two') && seen[9].has('two') && seen[9].has('priced'));
});

test('the wrong wool coins are the real fraction slips, each with its why', () => {
  // 3/4 of 12 pounds: 9; divided by the top 4, one part 3, the part she leaves 3, the whole 12
  const rand = seeded(41), slips = new Map();
  for (let i = 0; i < 3000; i++) {
    const o = G.makeSale({ wool: 12 }, { step: 3, rand, coins: 4 });
    if (!o || !/ 3\/4 /.test(o.story) || o.pic.n !== 12) continue;
    for (const c of o.coins) if (!c.good) slips.set(c.slip, c.v);
    assert.equal(o.coins.find((c) => c.good).v, 9);
  }
  assert.ok(slips.size >= 3, [...slips.keys()].join());
  for (const [slip, v] of slips) assert.equal(v, { divTop: 4, onePart: 3, leftover: 3, whole: 12, timesTop: 36, minusBottom: 8, half: 6 }[slip], slip);
  // priced: forgot the price is among them
  let forgot = 0;
  for (let i = 0; i < 400; i++) {
    const o = G.makeSale({ wool: 20 }, { step: 5, rand });
    if (!o) continue;
    const c = o.coins.find((x) => x.slip === 'noPrice'); if (c) { forgot++; assert.equal(c.v, o.sale.sold); assert.match(c.why, /gold for every one/); }
  }
  assert.ok(forgot > 200, 'forgot-the-price is a usual wrong coin: ' + forgot);
  // two buyers: adding the tops and the bottoms (1/4 + 1/2 is not 2/6) when it comes out whole
  let tb = 0;
  for (let i = 0; i < 3000; i++) {
    const o = G.makeSale({ wool: 24 }, { step: 8, rand });
    const c = o && o.coins.find((x) => x.slip === 'topsBottoms'); if (c) { tb++; assert.match(c.why, /isn't/); }
  }
  assert.ok(tb > 20, 'the tops-and-bottoms slip is dealt: ' + tb);
  // eggs and milk keep their dozens and gallons
  for (let i = 0; i < 200; i++) { const o = G.makeSale({ eggs: 40, milk: 20 }, { step: 1 + (i % 9), rand }); if (o) { assert.notEqual(o.sale.goods, 'wool'); assert.equal(o.unit[0], 'gold'); assert.notEqual(o.pic.kind, 'fraction'); } }
});

test('unlocks: hens from the start; pigs, sheep and cows once their young one is earned, for sure by a few whole jobs', () => {
  const r = rich();
  assert.deepEqual(G.KINDS.filter((k) => G.unlocked(r, k)), ['hen'], 'a fresh rider: hens only');
  assert.equal(G.earnLine(r, 'hen'), '');
  assert.equal(G.earnLine(r, 'pig'), `Pen ${G.GIFT.sure.pig} whole batches of pigs at the farm to earn your first piglet. Then the store sells pigs.`);
  assert.match(G.earnLine(r, 'sheep'), /flocks of sick sheep .* first lamb\. Then the store sells sheep\.$/);
  assert.match(G.earnLine(r, 'cow'), /^Rope 3 whole waves at the round-up to earn your first calf\. Then the store sells milk cows\.$/);
  for (const k of ['pig', 'sheep', 'cow']) assert.equal(G.buyAnimal(r, k, '', S.spend), 'locked');
  assert.equal(r.gold, 1000, 'nothing paid for a locked kind');
  // unlucky every time: the job count still brings the first one for sure
  for (const [ev, kind] of [['pigsDone', 'pig'], ['flockDone', 'sheep'], ['waveDone', 'cow']]) {
    const k = G.GIFT.sure[kind];
    assert.ok(k >= 2 && k <= 3, 'guaranteed by the 2nd or 3rd whole job');
    for (let i = 1; i < k; i++) {
      assert.equal(G.thankYou(r, ev, () => 0.999), null);
      assert.match(G.earnLine(r, kind), new RegExp(`\\(${i} done\\)`), 'the line counts the jobs done');
      assert.ok(!G.unlocked(r, kind));
    }
    const a = G.thankYou(r, ev, () => 0.999);
    assert.equal(a.kind, kind); assert.equal(a.young, true); assert.equal(a.unlocked, true, 'this one unlocked the kind');
    assert.ok(G.unlocked(r, kind)); assert.equal(G.earnLine(r, kind), '');
    // after that it is the plain chance again, and never says "unlocked" twice
    assert.equal(G.thankYou(r, ev, () => 0.999), null);
    const again = G.thankYou(r, ev, () => 0);
    if (again) assert.equal(again.unlocked, false);
  }
  assert.equal(G.buyAnimal(r, 'pig', 'Hamlet', S.spend), 'bought', 'earned: the store sells pigs');
  // a lucky first job unlocks at once
  const l = rich(); const a = G.thankYou(l, 'flockDone', () => 0);
  assert.equal(a.unlocked, true); assert.ok(G.unlocked(l, 'sheep'));
  // no room (a full pen from an older save): no young one, but the kind is open anyway
  const full = S.fixRider({ id: 'old2', name: 'Old', owned: { animals: [{ kind: 'pig', name: 'A' }, { kind: 'pig', name: 'B' }, { kind: 'pig', name: 'C' }] } });
  assert.ok(G.unlocked(full, 'pig'), 'an older save that owns pigs can buy pigs');
  assert.ok(!G.unlocked(full, 'cow'));
  assert.equal(G.thankYou(full, 'pigsDone', () => 0), null);
  // a damaged record is tidied
  const bad = S.fixRider({ id: 'bad2', name: 'Bad', owned: { farm: { unlocked: ['dragon', 'cow', 'hen', 7], jobs: { pig: -3, cow: 'x', sheep: 2.7 } } } });
  assert.deepEqual(G.homestead(bad).farm, { unlocked: ['cow'], jobs: { pig: 0, sheep: 2, cow: 0 } });
});
