// Tests for the cabin's furnishings (src/cabin/slots.js) and how they save (src/save.js).
// Run with:  node --test bandit-math/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }; } });
const S = await import('../src/save.js');
const C = await import('../src/cabin/slots.js');
S.useSaveKey('bandit-math.riders.cabintest');

test('the slots make a price ladder from a cheap rug to a costly stove', () => {
  const prices = C.SLOTS.map((s) => s.price);
  assert.deepEqual([...prices].sort((a, b) => a - b), prices, 'cheapest first');
  assert.equal(C.SLOTS[0].id, 'rug'); assert.equal(C.SLOTS.at(-1).id, 'stove');
  assert.equal(new Set(C.SLOTS.map((s) => s.id)).size, C.SLOTS.length, 'ids are unique');
  for (const s of C.SLOTS) {
    assert.ok(s.file || s.made, s.id + ': a file or made in code');
    assert.ok(s.looks.length > 0, s.id + ': somewhere to look to pick it');
    for (const ex of s.extra || []) assert.ok(ex.file, s.id + ': its extra pieces are files');
  }
  // every gap between neighbours is a fair save, so there is always a next thing in reach
  for (let i = 1; i < prices.length; i++) assert.ok(prices[i] - prices[i - 1] <= 100, `${C.SLOTS[i].id} is not too far past the one before`);
});

test('an old save (no cabin) loads with nothing bought, and a new rider has no cabin field yet', () => {
  const old = S.fixRider({ name: 'Old', owned: { saddle: 'plain', dog: { kind: 'shiba', name: 'Rex' } } });
  assert.deepEqual(C.ownedPieces(old), []);
  assert.equal('cabin' in old.owned, false);
  assert.equal(C.nextPiece(old).id, 'rug');
  assert.equal('cabin' in S.newRider('New').owned, false);
});

test('buying: gold is taken, the piece is kept in the slot order, it saves and loads again', () => {
  const r = S.newRider('Buyer'); r.gold = 100; S.saveRider(r);
  assert.equal(C.buyPiece(r, 'picture', S.spend, S.saveRider), 'bought');
  assert.equal(C.buyPiece(r, 'rug', S.spend, S.saveRider), 'bought');
  assert.equal(r.gold, 100 - 40 - 15);
  assert.deepEqual(r.owned.cabin, ['rug', 'picture']);
  assert.equal(C.buyPiece(r, 'rug', S.spend, S.saveRider), 'owned', 'never twice');
  assert.equal(C.buyPiece(r, 'stove', S.spend, S.saveRider), 'short', 'not enough gold: nothing taken');
  assert.equal(r.gold, 45);
  assert.equal(C.buyPiece(r, 'piano', S.spend, S.saveRider), 'unknown');
  const back = S.loadRiders().find((x) => x.id === r.id);
  assert.deepEqual(C.ownedPieces(back), ['rug', 'picture']);
  assert.equal(back.gold, 45);
});

test('a damaged cabin list is cleaned on load (no junk, no repeats, unknown pieces ignored)', () => {
  const r = S.fixRider({ name: 'Mess', owned: { cabin: ['rug', 'rug', 7, null, 'spaceship', 'bed'] } });
  assert.deepEqual(r.owned.cabin, ['rug', 'spaceship', 'bed'], 'strings kept once (a newer build may know more pieces)');
  assert.deepEqual(C.ownedPieces(r), ['rug', 'bed']);
  assert.deepEqual(S.fixRider({ owned: { cabin: 'rug' } }).owned.cabin, []);
});

test('the dogs at home: the one following you is marked, the rest wait; an old one-dog save works', () => {
  assert.deepEqual(C.homeDogs(S.fixRider({ owned: { dog: { kind: 'pug', name: 'Tater' } } })), [{ kind: 'pug', name: 'Tater', following: true }]);
  const r = S.fixRider({ owned: { dog: { kind: 'husky', name: 'Ghost' }, dogs: [{ kind: 'shiba', name: 'Biscuit' }, { kind: 'husky', name: 'Old name' }, { kind: 'wolf', name: 'No' }] } });
  assert.deepEqual(C.homeDogs(r), [{ kind: 'shiba', name: 'Biscuit', following: false }, { kind: 'husky', name: 'Ghost', following: true }]);
  assert.deepEqual(C.homeDogs(S.newRider('Nobody')), []);
});

test('every keepsake has a spot in the cabin', () => {
  for (const job of Object.keys(S.KEEPSAKES)) assert.ok(C.KEEPSAKE_SPOTS[job], job);
});
