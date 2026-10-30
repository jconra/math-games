// Tests for the prices (src/catalog.js), the cabin for sale, and who owns it (src/save.js fixRider).
// Run with:  node --test mathwood-valley/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }; } });
const S = await import('../src/save.js');
const { PRICES } = await import('../src/catalog.js');
const { SLOTS } = await import('../src/cabin/slots.js');
const { ANIMALS, KINDS } = await import('../src/math/goods.js');
const { completion } = await import('../src/completion.js');
S.useSaveKey('bandit-math.riders.pricetest');

test('the prices as decided on 2026-10-19: every one doubled, the cabin 600 (the horses: 2026-10-27, no free horse)', () => {
  assert.deepEqual(PRICES.saddle, { plain: 30, tooled: 120, silver: 300 });
  // (Dad, 2026-10-27: every rider starts on foot; the price goes up with the speed, the donkey 30 to Midnight 400)
  assert.deepEqual(PRICES.horse, { donkey: 30, chestnut: 45, bay: 60, palomino: 200, white: 300, midnight: 400 });
  assert.deepEqual(PRICES.hat, { white: 40, straw: 60, bowler: 100, ranger: 160, cattleman: 240, sombrero: 400 });
  assert.deepEqual(PRICES.dog, { shiba: 120, husky: 120, pug: 50, boston: 120, borderCollie: 140, cattleDog: 140, labYellow: 130, labBlack: 130, labChocolate: 130, beagle: 100, dalmatian: 160 });
  assert.deepEqual(PRICES.animal, { hen: 30, pig: 70, sheep: 100, cow: 240 });
  assert.deepEqual(PRICES.furniture, { rug: 30, lanterns: 60, picture: 80, dogbeds: 90, table: 120, porch: 160, bed: 200, rifles: 240, stove: 440 });
  assert.equal(PRICES.cabin, 600);
});

test('one table: the furniture and the farm animals sell at the catalog\'s prices, and everything on the checklist too', () => {
  for (const s of SLOTS) assert.equal(s.price, PRICES.furniture[s.id], s.id);
  assert.deepEqual(Object.keys(PRICES.furniture), SLOTS.map((s) => s.id), 'a price for every slot, no more');
  for (const k of KINDS) assert.equal(ANIMALS[k].price, PRICES.animal[k], k);
  const buy = completion(S.newRider('Sam')).items.filter((i) => i.group === 'buy');
  const all = buy.reduce((a, i) => a + i.need, 0);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  assert.equal(all, PRICES.cabin + sum(PRICES.saddle) + sum(PRICES.horse) + sum(PRICES.hat) + Math.min(...Object.values(PRICES.dog)) + sum(PRICES.animal) + sum(PRICES.furniture));
  assert.equal(all, 4995, 'everything to buy at base prices, one dog the cheapest (6,285 with every breed; 5,235 before the dog breeds were sold on 2026-10-29; 5,260 before the horses changed on 2026-10-27)');
  assert.ok(buy.every((i) => i.live), 'the cabin is for sale (COMING.cabin on)');
});

test('the cabin: a new rider has not bought it; a rider with cabin furniture from before has it as bought', () => {
  const fresh = S.newRider('New');
  assert.equal(fresh.owned.home, undefined);
  assert.equal(completion(fresh).items.find((i) => i.id === 'buy:cabin:home').done, false);
  // an old save with furniture: the cabin is theirs
  const old = S.fixRider({ name: 'Old', owned: { saddle: 'plain', cabin: ['rug', 'lanterns'] } });
  assert.equal(old.owned.home, 'cabin');
  assert.deepEqual(old.owned.cabin, ['rug', 'lanterns'], 'the furniture stays theirs');
  assert.equal(completion(old).items.find((i) => i.id === 'buy:cabin:home').done, true);
  // an old save with no furniture (or only junk in the list): not bought yet
  assert.equal(S.fixRider({ name: 'Bare', owned: { saddle: 'plain' } }).owned.home, undefined);
  assert.equal(S.fixRider({ name: 'Junk', owned: { cabin: ['spaceship', 7, null] } }).owned.home, undefined);
  assert.equal(S.fixRider({ name: 'Odd', owned: { home: 7 } }).owned.home, undefined, 'a damaged value is dropped');
  assert.equal(S.fixRider({ name: 'Newer', owned: { home: 'house2' } }).owned.home, 'house2', 'a newer build\'s home is kept');
  assert.equal(S.fixRider(JSON.parse(JSON.stringify(S.fixRider({ name: 'Newer', owned: { home: 'house2', cabin: ['rug'] } })))).owned.home, 'house2', '... through a round trip');
  // bought: kept through a save and a load
  const r = S.newRider('Buyer'); r.owned.home = 'cabin'; S.saveRider(r);
  const back = S.loadRiders().find((x) => x.id === r.id);
  assert.equal(back.owned.home, 'cabin');
  assert.equal(S.fixRider(JSON.parse(JSON.stringify(back))).owned.home, 'cabin');
});

test('the buckle counts came down; a rider who earned a buckle under the old counts keeps it', () => {
  const at = (id) => S.JOBS.find((j) => j.id === id).at;
  // (the old gold counts: cattle 500, boxes 250, sheep 200, orders 400, pigs 500, bandits 150, deliveries 100, loot 150,
  // targets 600; tin and copper are as they were)
  const OLD = { cattle: [10, 50, 200, 500], boxes: [5, 25, 100, 250], sheep: [5, 20, 75, 200], orders: [10, 40, 150, 400], pigs: [10, 50, 200, 500],
    bandits: [3, 15, 50, 150], deliveries: [3, 10, 30, 100], loot: [5, 20, 60, 150], targets: [15, 60, 250, 600] };
  for (const [id, old] of Object.entries(OLD)) {
    assert.deepEqual(at(id).slice(0, 2), old.slice(0, 2), `${id}: tin and copper as before`);
    for (let k = 2; k < 4; k++) assert.ok(at(id)[k] <= old[k], `${id}: ${S.BUCKLES[k]} no further off than before`);
    // any count that had a buckle under the old table has the same one or a better one now
    for (const n of old) {
      const was = old.filter((x) => n >= x).length - 1, now = S.buckleOf({ stats: { jobs: { [id]: n } } }, id).tier;
      assert.ok(S.BUCKLES.indexOf(now) >= was, `${id} at ${n}`);
    }
  }
});

test('a dog costs more for each dog the rider has (the game maker, 2026-10-29): half as much again each, to 5 gold', async () => {
  const { dogPrice, DOGS } = await import('../src/catalog.js');
  assert.deepEqual([0, 1, 2, 3].map((n) => dogPrice('shiba', n)), [120, 180, 240, 300]);
  assert.deepEqual([0, 1, 2].map((n) => dogPrice('pug', n)), [50, 75, 100]);
  assert.equal(dogPrice('labBlack', 1), 195);
  assert.equal(dogPrice('nope', 0), null);
  for (const d of DOGS) assert.ok(PRICES.dog[d.id] > 0, d.id);
  for (const id of ['bostonPug', 'bostonBrindle', 'bostonFamily']) assert.ok(!DOGS.some((d) => d.id === id), id + ' is not sold');
});
