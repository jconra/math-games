// Tests for the horses' treats (src/treats.js): the saddlebags' ten, the apple trees picked and grown back the next
// morning, the store's bags and their money question, the hearts (a reward only: never down, a few feeds a day), the
// donkey's carrot, and the save (an old rider starts with none; a rider's treats and hearts come back as they were).
//   node --test mathwood-valley/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }; } });
const T = await import('../src/treats.js');
const S = await import('../src/save.js');
const { TREATS, BOND } = T;
const FIX = JSON.parse(fs.readFileSync(new URL('./fixtures/old-riders.json', import.meta.url), 'utf8'));
const fresh = () => S.fixRider({ name: 'Tess' });
// a fixed random: 0.5 every time
const half = () => 0.5;

test('an old save starts with no treats, no trees picked and no hearts', () => {
  for (const r0 of FIX.riders) {
    const r = S.fixRider(r0);
    assert.deepEqual({ apple: r.treats.apple, carrot: r.treats.carrot, trees: r.treats.trees, bond: r.treats.bond }, { apple: 0, carrot: 0, trees: {}, bond: {} });
    assert.equal(T.countOf(r), 0);
    assert.equal(T.roomOf(r), TREATS.most);
  }
  const n = S.newRider('Ivy');
  assert.equal(n.treats.apple, 0); assert.equal(n.treats.carrot, 0);
});

test('a bad save is made safe: counts whole, never past the saddlebags, trees and hearts kept to their ranges', () => {
  const c = T.cleanTreats({ apple: 8.7, carrot: 9, trees: { a: { day: 3, left: 99 }, b: 'x' }, bond: { bay: { n: 999, day: 2, today: 50 }, '': {} }, extra: 1 });
  assert.equal(c.apple, 8); assert.equal(c.carrot, 2);   // (ten in all)
  assert.deepEqual(c.trees, { a: { day: 3, left: TREATS.perTree } });
  assert.deepEqual(c.bond, { bay: { n: BOND.hearts * BOND.perHeart, day: 2, today: BOND.perDay } });
  assert.equal(c.extra, 1);   // (a newer build's field kept)
  assert.deepEqual(T.cleanTreats({ apple: -3, carrot: 'lots' }).apple, 0);
  assert.deepEqual(T.cleanTreats('nonsense'), { apple: 0, carrot: 0, trees: {}, bond: {} });
});

test('the saddlebags hold ten treats, apples and carrots together', () => {
  const r = fresh();
  assert.equal(T.addTreats(r, 'apple', 6), 6);
  assert.equal(T.addTreats(r, 'carrot', 6), 4);   // (only room for four)
  assert.equal(T.countOf(r), 10); assert.equal(T.roomOf(r), 0);
  assert.equal(T.addTreats(r, 'apple', 1), 0);
  assert.equal(T.addTreats(r, 'pie', 1), 0);
  assert.ok(T.takeTreat(r, 'carrot')); assert.equal(r.treats.carrot, 3);
  r.treats.apple = 0;
  assert.equal(T.takeTreat(r, 'apple'), false);
});

test('which treat a horse gets: an apple first, the donkey a carrot first', () => {
  const r = fresh();
  assert.equal(T.whichTreat(r), null);
  T.addTreats(r, 'carrot', 2);
  assert.equal(T.whichTreat(r), 'carrot');
  T.addTreats(r, 'apple', 2);
  assert.equal(T.whichTreat(r), 'apple');
  assert.equal(T.whichTreat(r, { donkey: true }), 'carrot');
  r.treats.carrot = 0;
  assert.equal(T.whichTreat(r, { donkey: true }), 'apple');
});

test('an apple tree: picked for what fits, bare till the next morning, then full again', () => {
  const r = fresh(), tree = '39.5,-217.0';
  assert.equal(T.applesLeft(r, tree, 1), TREATS.perTree);
  T.addTreats(r, 'carrot', TREATS.most - 2);   // (room for two)
  let p = T.pickApples(r, tree, 1);
  assert.deepEqual({ picked: p.picked, left: p.left, full: p.full }, { picked: 2, left: TREATS.perTree - 2, full: true });
  r.treats.carrot = 0;
  p = T.pickApples(r, tree, 1);
  assert.equal(p.picked, TREATS.perTree - 2); assert.equal(p.left, 0);
  p = T.pickApples(r, tree, 1);
  assert.equal(p.picked, 0); assert.ok(p.none);
  assert.equal(T.applesLeft(r, tree, 1), 0);
  // the next game day: grown back
  assert.equal(T.applesLeft(r, tree, 2), TREATS.perTree);
  p = T.pickApples(r, tree, 2);
  assert.equal(p.picked, TREATS.perTree);
  // another tree is its own
  assert.equal(T.applesLeft(r, '-79.9,-217.9', 2), TREATS.perTree);
});

test('the hearts: an owned horse fills one every few feeds, only a few feeds a day count, never past five, never down', () => {
  const r = fresh();
  let day = 1, last = null;
  const feed = (o = {}) => (last = T.feedHorse(r, { horseId: 'bay', owned: true, kind: 'apple', day, ...o }));
  for (let i = 0; i < BOND.perDay; i++) { feed(); assert.ok(last.counted); }
  assert.equal(T.bondOf(r, 'bay').n, BOND.perDay);
  feed();
  assert.equal(last.counted, false); assert.ok(last.plenty);   // (plenty for today: no penalty, the hearts stay)
  assert.equal(last.hearts, 1);   // (a heart still floats up)
  assert.equal(T.bondOf(r, 'bay').n, BOND.perDay);
  const total = BOND.hearts * BOND.perHeart;
  let days = 1;
  while (T.bondOf(r, 'bay').n < total) { day++; days++; for (let i = 0; i < BOND.perDay; i++) feed(); }
  assert.ok(days >= Math.ceil(total / BOND.perDay), 'full hearts take a few days');
  const b = T.bondOf(r, 'bay');
  assert.equal(b.hearts, BOND.hearts); assert.ok(b.full); assert.equal(b.half, false);
  day++; feed();
  assert.equal(T.bondOf(r, 'bay').hearts, BOND.hearts);   // (never past five)
  assert.equal(last.plenty, false);   // (full: nothing to say about tomorrow)
  // a half heart
  T.feedHorse(r, { horseId: 'pen-1', owned: true, kind: 'apple', day: 1 });
  assert.deepEqual(T.bondOf(r, 'pen-1'), { n: 1, hearts: 0, half: BOND.perHeart > 1, full: false });
  assert.equal(T.heartsLine(2, true), '♥♥❥♡♡');
});

test('a horse not the rider\'s: fed, a heart floats up, nothing kept; the donkey floats two for a carrot', () => {
  const r = fresh();
  let f = T.feedHorse(r, { horseId: null, owned: false, kind: 'apple', day: 1 });
  assert.deepEqual({ hearts: f.hearts, counted: f.counted }, { hearts: 1, counted: false });
  f = T.feedHorse(r, { horseId: 'donkey', owned: false, donkey: true, kind: 'carrot', day: 1 });
  assert.equal(f.hearts, 2);
  f = T.feedHorse(r, { horseId: 'donkey', owned: true, donkey: true, kind: 'apple', day: 1 });
  assert.equal(f.hearts, 1); assert.ok(f.counted);
  assert.deepEqual(r.treats.bond, { donkey: { n: 1, day: 1, today: 1 } });
});

test('the store\'s money question: the right answer among four coins, the real slips beside it', () => {
  // young riders, two or three bags: how much for them all
  for (const kind of ['apple', 'carrot']) for (const bags of [2, 3]) {
    const q = T.treatQuestion({ kind, bags, level: 10, rand: half });
    assert.equal(q.form, 'cost');
    assert.equal(q.answer, TREATS.price[kind] * bags);
    assert.equal(q.cost, q.answer);
    assert.equal(q.choices.length, 4); assert.equal(new Set(q.choices).size, 4);
    assert.ok(q.choices.includes(q.answer)); assert.ok(q.choices.includes(TREATS.price[kind]));   // (one bag's price: a real slip)
    assert.deepEqual(q.choices, [...q.choices].sort((a, b) => a - b));
    assert.match(q.ask, new RegExp(`${bags} bags`));
    assert.match(T.answerLine(q, TREATS.price[kind]), /one bag/);
    assert.equal(T.answerLine(q, q.answer), '');
  }
  // one bag, or a rider past making change: the change from a coin
  for (const [bags, level] of [[1, 0], [2, 40], [3, 60]]) {
    const q = T.treatQuestion({ kind: 'carrot', bags, level, rand: half });
    assert.equal(q.form, 'change');
    assert.ok(q.paid > q.cost);
    assert.equal(q.answer, q.paid - q.cost);
    assert.ok(q.choices.every((c) => c >= 0)); assert.equal(new Set(q.choices).size, 4);
    assert.ok(q.choices.includes(q.answer));
    assert.match(T.answerLine(q, q.cost), /what the bags cost/);
  }
  // never more bags than the store sells at once
  assert.equal(T.treatQuestion({ bags: 9 }).bags, TREATS.bagsMost);
});

test('the save: treats, trees picked and hearts come back as they were', () => {
  store.clear(); S.useSaveKey('bandit-math.riders.treatstest');
  const r = S.newRider('Wren');
  T.addTreats(r, 'apple', 3); T.addTreats(r, 'carrot', 4);
  T.pickApples(r, 't1', 5);
  T.feedHorse(r, { horseId: 'bay', owned: true, kind: 'apple', day: 5 });
  assert.ok(S.saveRider(r));
  const back = S.loadRiders().find((x) => x.id === r.id);
  assert.equal(back.treats.apple, 3 + 3); assert.equal(back.treats.carrot, 4);   // (three picked: room for three)
  assert.deepEqual(back.treats.trees, { t1: { day: 5, left: TREATS.perTree - 3 } });
  assert.deepEqual(back.treats.bond, { bay: { n: 1, day: 5, today: 1 } });
});
