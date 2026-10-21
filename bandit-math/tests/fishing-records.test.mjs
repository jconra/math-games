// The fishing job's records per rider (src/fishrecords.js): an old rider with none, a damaged save, the saddlebags
// culling the smallest fish when full, the lines read out loud.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fishingOf, keepFish, sayable, saleMap, CREEL } from '../src/fishrecords.js';
import { setLevel, stepFor, record } from '../src/math/skill.js';
import { BOOK_TOTAL, bookCount } from '../labs/fishing/questions.js';

const fish = (kind, n, d, ln = 3, ld = 4) => ({ kind, len: { n: ln, d: ld, unit: 'ft', form: 'mixed' }, lb: { n, d, unit: 'lb', form: 'mixed' } });

test('fishing records: an old rider gets empty ones, a damaged save is tidied', () => {
  const r = { name: 'Old' };
  const f = fishingOf(r);
  assert.deepEqual(f.creel, []); assert.equal(f.record, null); assert.equal(f.landed, 0); assert.equal(f.kept, 0); assert.equal(f.sold, 0);
  assert.equal(bookCount(f.book), 0); assert.ok(BOOK_TOTAL === 12);
  assert.equal(r.fishing, f, 'kept on the rider');
  const bad = { fishing: { creel: [fish('trout', 1, 2), { kind: 'shark' }, null, fish('bass', 0, 2), fish('perch', 1, 4)], record: { kind: 'eel' }, book: 'nope', landed: -3, kept: 'x', sold: 2.7 } };
  const g = fishingOf(bad);
  assert.equal(g.creel.length, 2, 'only real fish kept'); assert.equal(g.record, null); assert.equal(bookCount(g.book), 0);
  assert.equal(g.landed, 0); assert.equal(g.kept, 0); assert.equal(g.sold, 2);
  assert.ok(fishingOf({ fishing: [] }).creel.length === 0, 'an array is no record');
  // (a saved one comes back the same)
  const s = { fishing: JSON.parse(JSON.stringify(g)) };
  assert.deepEqual(fishingOf(s).creel, g.creel);
});

test('fishing records: the saddlebags hold CREEL.most fish; a fish kept when full sends the smallest back', () => {
  const f = fishingOf({});
  for (let i = 0; i < CREEL.most; i++) assert.equal(keepFish(f, fish('trout', 3 + (i % 4), 8)), null);
  assert.equal(f.creel.length, CREEL.most); assert.ok(f.fresh);
  const small = fish('perch', 1, 4);
  const t = keepFish(f, small);
  assert.equal(f.creel.length, CREEL.most); assert.ok(!f.creel.includes(small), 'the new one was the smallest');
  assert.match(t[1], /smallest/);
  const big = fish('catfish', 3, 1, 2, 1);
  const t2 = keepFish(f, big);
  assert.ok(f.creel.includes(big)); assert.match(t2[1], /trout/, 'a small trout went back');
  assert.equal(f.kept, CREEL.most + 2);
});

test('fishing records: lines read out loud say the fractions in words', () => {
  assert.equal(sayable('The keeper limit for perch is 3/4 of a foot: keep one at least that long.'), 'The keeper limit for perch is 3 quarters of a foot: keep one at least that long.');
  assert.equal(sayable('Yours is 1 1/2 feet long, 5/8 lb.'), 'Yours is 1 and 1 half feet long, 5 eighths pounds.');
  assert.equal(sayable('1/3 and 7 1/2 in.'), '1 third and 7 and 1 half inches');
  assert.equal(sayable('<b>Right!</b> 2/3'), 'Right! 2 thirds');
});

// the store's fish sale: a by-the-pound sale only once Fractions is placed; the youngest are paid by the fish meanwhile
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
test('a 6-year-old still finding Fractions is paid by the fish, however high the baseline is trying', () => {
  for (const seed of [1, 7, 99]) {
    const r = { age: 6 };
    setLevel(r, 'frac', 35, { placed: false });
    for (let i = 0; i < 2; i++) { const q = stepFor(r, 'fishing'); record(r, 'frac', { right: true, at: q.at }); }
    const rand = seeded(seed);
    for (let i = 0; i < 30; i++) assert.deepEqual(saleMap(r, { rand }), { map: 'fishSaleK', most: null });
  }
});
test('an older rider still finding Fractions gets the by-the-pound sale held at the level, not the point tried', () => {
  const r = { age: 14 };
  setLevel(r, 'frac', 40, { placed: false });
  for (let i = 0; i < 2; i++) { const q = stepFor(r, 'fishing'); record(r, 'frac', { right: true, at: q.at }); }
  const { map, most } = saleMap(r, { rand: seeded(3) });
  assert.equal(map, 'fishSale');
  assert.equal(stepFor(r, map, { most }).id, 'pound');
});
test('once Fractions is placed the sale follows the level', () => {
  const r = { age: 12 };
  setLevel(r, 'frac', 50); setLevel(r, 'words', 60); setLevel(r, 'ratio', 20);
  const { map, most } = saleMap(r, { rand: seeded(5) });
  assert.equal(map, 'fishSale'); assert.equal(most, null);
  assert.equal(stepFor(r, map).id, 'pair');
});
