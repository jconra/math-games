// Tests for the rider's horses (src/mounts.js), the stable's ladder (src/catalog.js LADDER, HORSES) and old saves
// (tests/fixtures/old-riders-horses.json): every horse a rider owned is still owned, listed and rideable at its size and
// speed, the one ridden stays ridden, a newer build's horse survives, and the checklist stays where it was.
//   node --test mathwood-valley/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }; } });
const S = await import('../src/save.js');
const M = await import('../src/mounts.js');
const { LADDER, HORSES, PRICES, mphOf } = await import('../src/catalog.js');
const { completion } = await import('../src/completion.js');
const FIX = JSON.parse(fs.readFileSync(new URL('./fixtures/old-riders-horses.json', import.meta.url), 'utf8'));
const load = () => { store.clear(); S.useSaveKey('bandit-math.riders.mountstest'); store.set('bandit-math.riders.mountstest', JSON.stringify({ version: FIX.version, riders: FIX.riders })); return S.loadRiders(); };

test('the ladder: every horse the stable sells, cheapest and slowest to dearest and fastest; the bigger the faster', () => {
  assert.deepEqual(Object.keys(LADDER).sort(), HORSES.map((h) => h.id).sort());
  // no horse is free (every rider starts on foot), and the price always goes up with the speed (Dad, 2026-10-27)
  for (const h of HORSES) assert.ok(PRICES.horse[h.id] > 0, h.id + ' has a price');
  const byPrice = HORSES.map((h) => h.id).sort((a, b) => PRICES.horse[a] - PRICES.horse[b]);
  assert.deepEqual(byPrice, HORSES.map((h) => h.id), 'the stable lists them cheapest first');
  for (let i = 1; i < byPrice.length; i++) {
    const a = LADDER[byPrice[i - 1]], b = LADDER[byPrice[i]];
    assert.ok(PRICES.horse[byPrice[i]] > PRICES.horse[byPrice[i - 1]] && b.gallop > a.gallop && b.mph > a.mph, `${byPrice[i]} dearer and faster than ${byPrice[i - 1]}`);
    if (a.kind === 'steed') assert.ok(b.size > a.size, `${byPrice[i]} bigger than ${byPrice[i - 1]}`);
  }
  // Dad's numbers: the top speed in miles an hour, a whole number, from the gallop
  assert.deepEqual(Object.fromEntries(Object.entries(LADDER).map(([id, L]) => [id, L.mph])), { donkey: 18, chestnut: 27, bay: 29, palomino: 31, white: 34, midnight: 37 });
  for (const L of Object.values(LADDER)) {
    assert.equal(L.mph, mphOf(L.gallop));
    if (L.kind === 'steed') { assert.equal(L.walk, +(2 * L.size).toFixed(2)); assert.equal(L.trot, +(6 * L.size).toFixed(2)); assert.ok(L.coat); }
  }
  // the lines say nothing the numbers don't bear out: no horse is free or "your" anything; "faster than <Name>" is true;
  // the fastest is the fastest, the smallest the smallest
  for (const h of HORSES) assert.ok(!/gallops fast|\bfree\b|trusty|your bay/i.test(h.line), h.id + ': ' + h.line);
  const byName = Object.fromEntries(HORSES.map((h) => [h.name.split(' ')[0], h.id]));
  for (const h of HORSES) {
    const m = /faster than (\w+)/i.exec(h.line); if (m && byName[m[1]]) assert.ok(LADDER[h.id].gallop > LADDER[byName[m[1]]].gallop, h.id + ' faster than ' + m[1]);
    if (/the fastest/i.test(h.line)) assert.equal(Math.max(...Object.values(LADDER).map((L) => L.gallop)), LADDER[h.id].gallop, h.id + ' the fastest');
    if (/the smallest/i.test(h.line)) assert.equal(Math.min(...Object.values(LADDER).filter((L) => L.kind === 'steed').map((L) => L.size)), LADDER[h.id].size, h.id + ' the smallest');
  }
});

test('an old save opens with every horse it owned, the same one ridden, each at its new size and speed', () => {
  const r = load().find((x) => x.id === 'rhorse1');
  const list = M.ownedHorses(r);
  assert.deepEqual(list.map((h) => h.id), ['donkey', 'chestnut', 'bay', 'palomino', 'white', 'midnight']);
  assert.equal(M.ridden(r), 'white');
  assert.deepEqual(list.filter((h) => h.ridden).map((h) => h.id), ['white']);
  for (const h of list) {
    const L = LADDER[h.id];
    assert.equal(h.look.kind, L.kind); assert.equal(h.look.size, L.size); assert.equal(h.look.gallop, L.gallop); assert.equal(h.look.mph, L.mph);
  }
  assert.equal(M.horseLook(r, 'palomino').coat, 'palomino'); assert.equal(M.horseLook(r, 'white').coat, 'white');
  assert.equal(M.horseLook(r, 'chestnut').kind, 'steed', 'Copper is the new horse now (it was the farm horse)');
  // switching is free and saved (as the stable's "Ride this one", or later a pasture's E)
  assert.ok(M.rideHorse(r, 'donkey')); assert.equal(r.owned.horse, 'donkey');
  assert.ok(M.rideHorse(r, 'bay'), 'the old free bay is still theirs'); assert.equal(r.owned.horse, 'bay');
  assert.ok(!M.rideHorse(r, 'nosuch')); assert.equal(r.owned.horse, 'bay', 'an unknown id changes nothing');
});

test('the checklist is where it was: every horse bought is checked off; the rider\'s own horses add nothing to it', () => {
  const raw = FIX.riders.find((x) => x.id === 'rhorse1'), r = load().find((x) => x.id === 'rhorse1');
  const items = completion(r).items.filter((i) => i.id.startsWith('buy:horse:'));
  assert.deepEqual(items.map((i) => [i.id, i.done]), HORSES.map((h) => [`buy:horse:${h.id}`, true]), 'every horse, the old free bay too');
  assert.equal(completion(r).pct, completion(S.fixRider(raw)).pct);
  const n = load().find((x) => x.id === 'rhorse2'), before = completion(n);
  const bare = S.fixRider({ ...n, owned: { ...n.owned, mounts: undefined } });
  assert.equal(before.total, completion(bare).total, 'a horse of the rider\'s own is not on the checklist');
});

test('a newer build\'s horse survives: kept, cleaned, listed, ridden; unknown ids and fields stay', () => {
  const r = load().find((x) => x.id === 'rhorse2');
  const m = r.owned.mounts['pen-1'];
  assert.equal(m.name, 'Sandy the dun'); assert.equal(m.size, 1.1); assert.equal(m.gallop, 15); assert.equal(m.spots, 3, 'an entry\'s own fields stay');
  assert.equal(m.coat.sheen, 3, 'a coat number kept to its range'); assert.equal(m.coat.newField, 'kept'); assert.equal(m.coat.legs.HL, 'sock'); assert.equal(m.coat.legs.FL, 'none');
  assert.equal(r.owned.penNext, 2); assert.equal(r.owned.pastureNote, 'a field a newer build keeps');
  assert.ok(r.owned.horses.includes('cabinpasture-7'), 'an id this build doesn\'t know stays in the list');
  assert.equal(M.ridden(r), 'pen-1');
  const look = M.horseLook(r, 'pen-1');
  assert.equal(look.kind, 'steed'); assert.equal(look.size, 1.1); assert.equal(look.mph, 34); assert.equal(look.walk, 2.2); assert.equal(look.coat.dorsal, 0.9);
  assert.deepEqual(M.ownedHorses(r).map((h) => h.id), ['bay', 'palomino', 'pen-1']);
  // saved and loaded again: the same
  S.saveRider(r);
  const again = S.loadRiders().find((x) => x.id === 'rhorse2');
  assert.deepEqual(again.owned.mounts, r.owned.mounts); assert.equal(again.owned.horse, 'pen-1');
});

test('a horse of the rider\'s own is made safe: a size off the ladder snaps to it, no coat no horse, a long name cut', () => {
  const c = M.cleanMounts({ a: { coat: { base: 'nope', face: 'unicorn', grey: -3 }, size: 1.13, name: 'A very long horse name indeed!!', gallop: 99 }, b: { size: 1 }, c: 'junk' });
  assert.deepEqual(Object.keys(c), ['a']);
  assert.equal(c.a.size, 1.15); assert.equal(c.a.gallop, 16.5); assert.equal(c.a.name.length <= M.NAME_MOST, true);
  assert.match(c.a.coat.base, /^#[0-9a-f]{6}$/i); assert.equal(c.a.coat.face, 'none'); assert.equal(c.a.coat.grey, 0);
  // a ridden id with nothing behind it: another horse the rider has, or none (on foot)
  assert.equal(M.ridden({ owned: { horse: 'pen-9' } }), null);
  assert.equal(M.ridden({ owned: { horse: 'pen-9', horses: ['chestnut'] } }), 'chestnut');
  assert.equal(M.ridden({ owned: { horse: 'midnight' } }), 'midnight', 'an old save with only owned.horse owns that horse');
  // a fresh rider: on foot, no horse at all; buying the donkey makes him the one ridden
  const fresh = S.newRider('Kid', {});
  assert.deepEqual(M.ownedHorses(fresh), []); assert.equal(M.ridden(fresh), null); assert.equal(fresh.owned.horse, null);
  assert.ok(!M.rideHorse(fresh, 'donkey'), 'not before it is bought');
  fresh.owned.horses = ['donkey']; assert.ok(M.rideHorse(fresh, 'donkey')); assert.equal(M.ridden(fresh), 'donkey');
  // and saved and loaded on foot: still on foot (not the old free bay)
  assert.equal(S.fixRider(JSON.parse(JSON.stringify(S.newRider('Lu', {})))).owned.horse, null);
  assert.deepEqual(S.fixRider(JSON.parse(JSON.stringify(S.newRider('Lu', {})))).owned.horses, undefined);
});
