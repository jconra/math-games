// Tests for the six-shooter for bandits (src/gun.js): the grown-ups' switch and its save, the general store's rules,
// the checklist, and which shot does what.
// Run with:  node --test mathwood-valley/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const fake = {
  data: new Map(),
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; },
  setItem(k, v) { this.data.set(k, String(v)); },
  removeItem(k) { this.data.delete(k); },
};
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { return fake; } });

const S = await import('../src/save.js');
const G = await import('../src/gun.js');
const { PRICES, REVOLVER } = await import('../src/catalog.js');
const { completion } = await import('../src/completion.js');

function fresh() { fake.data.clear(); S.useSaveKey('bandit-math.riders.guntest'); }

test('the switch: lasso only for a new rider, two plain settings, and it is saved', () => {
  fresh();
  const r = S.newRider('Kit');
  assert.equal(r.mode, 'lasso');
  assert.equal(G.gunOn(r), false); assert.equal(G.ownsGun(r), false); assert.equal(G.canShoot(r), false);
  assert.deepEqual(G.BANDIT_MODES.map((m) => [m.id, m.words]), [['lasso', 'Lasso only'], ['shoot', 'Lasso or guns']]);
  G.setBandits(r, 'shoot');
  assert.equal(r.mode, 'shoot'); assert.equal(G.gunOn(r), true);
  S.saveRider(r);
  const back = S.loadRiders().find((x) => x.id === r.id);
  assert.equal(back.mode, 'shoot', 'kept after a reload');
  G.setBandits(back, 'anything else');
  assert.equal(back.mode, 'lasso', 'anything but shoot is lasso only');
  // an old save's 'shoot' (the days of the old title's choice) reads as the switch on; junk reads as lasso only
  assert.equal(S.fixRider({ mode: 'shoot' }).mode, 'shoot');
  assert.equal(S.fixRider({ mode: 'gun' }).mode, 'lasso');
  assert.equal(S.fixRider({}).mode, 'lasso');
});

test('the store: greyed while off, a price while on, kept once bought', () => {
  fresh();
  assert.equal(PRICES.revolver, 150);
  assert.ok(REVOLVER.name && REVOLVER.line);
  const r = S.newRider('Lou'); r.gold = 400;
  assert.deepEqual(G.gunShop(r), { state: 'off', price: 150, need: 0 }, 'shown to every rider, greyed with the switch off');
  let b = G.buyGun(r);
  assert.equal(b.ok, false); assert.match(b.note, /grown-up/);
  assert.equal(r.gold, 400, 'nothing spent'); assert.equal(G.ownsGun(r), false);
  G.setBandits(r, 'shoot'); r.gold = 100;
  assert.deepEqual(G.gunShop(r), { state: 'short', price: 150, need: 50 });
  b = G.buyGun(r);
  assert.equal(b.ok, false); assert.equal(r.gold, 100);
  r.gold = 160;
  assert.equal(G.gunShop(r).state, 'buy');
  b = G.buyGun(r);
  assert.equal(b.ok, true); assert.equal(r.gold, 10); assert.equal(r.owned.revolver, true);
  assert.equal(G.canShoot(r), false, 'bought, but nothing changes in the hand by itself');
  assert.equal(G.weaponOf(r), 'lasso');
  assert.deepEqual(G.weapons(r), ['lasso', 'revolver']);
  assert.equal(G.setWeapon(r, 'lever'), false, 'not one not bought');
  assert.equal(G.setWeapon(r, 'revolver'), true);
  assert.equal(G.canShoot(r), true); assert.equal(G.gunInHand(r).id, 'revolver');
  assert.equal(G.gunShop(r).state, 'owned');
  assert.equal(G.buyGun(r).ok, false, 'never bought twice'); assert.equal(r.gold, 10);
  // saved, and it survives a reload with the rest of what is owned
  const back = S.loadRiders().find((x) => x.id === r.id);
  assert.equal(back.owned.revolver, true); assert.equal(back.gold, 10);
  // the switch back to lasso only puts it away (kept, not lost): no shooting, the store says it is owned
  G.setBandits(back, 'lasso');
  assert.equal(G.ownsGun(back), true); assert.equal(G.canShoot(back), false);
  assert.equal(G.gunShop(back).state, 'owned');
  // only a real true counts as owned
  assert.equal(G.ownsGun({ mode: 'shoot', owned: { revolver: 'yes' } }), false);
});

test('the checklist counts it only for a rider with the switch on (or who has it)', () => {
  fresh();
  const has = (r) => completion(r).items.some((i) => i.id === 'buy:gun:revolver');
  const r = S.newRider('Sam');
  assert.equal(has(r), false, 'lasso only: not on the list');
  const all = completion(r, { all: true }).items.find((i) => i.id === 'buy:gun:revolver');
  assert.ok(all && all.off, 'kept aside as off');
  const before = completion(r).total;
  G.setBandits(r, 'shoot'); r.gold = 60;
  const item = completion(r).items.find((i) => i.id === 'buy:gun:revolver');
  assert.ok(item, 'on: on the list'); assert.equal(completion(r).total, before + 4, 'with it: the two rifles and the rack that holds them');
  assert.equal(item.done, false); assert.equal(item.have, 60); assert.equal(item.need, 150); assert.equal(item.group, 'buy');
  r.gold = 150; G.buyGun(r);
  assert.equal(completion(r).items.find((i) => i.id === 'buy:gun:revolver').done, true);
  G.setBandits(r, 'lasso');
  assert.equal(completion(r).items.find((i) => i.id === 'buy:gun:revolver').done, true, 'bought stays done, even switched back');
});

test('the rifles: only with guns allowed, farther and steadier, on the list, chosen by hand', () => {
  fresh();
  const r = S.newRider('Ida'); r.gold = 5000;
  assert.equal(G.buyGun(r, 'lever').ok, false, 'off: not sold');
  assert.ok(!completion(r).items.some((i) => i.id === 'buy:gun:lever'), 'off: not on the list');
  assert.ok(!completion(r).items.some((i) => i.id === 'buy:furniture:rifles'), 'off: the rack is not on the list');
  G.setBandits(r, 'shoot');
  assert.ok(completion(r).items.some((i) => i.id === 'buy:gun:lever'), 'on: on the list');
  assert.ok(G.GUNS.lever.reach > G.GUNS.revolver.reach && G.GUNS.single.reach > G.GUNS.lever.reach);
  assert.ok(G.GUNS.lever.sway < G.GUNS.revolver.sway && G.GUNS.single.sway < G.GUNS.lever.sway);
  assert.equal(G.nextGun(r), 'revolver');
  assert.equal(G.buyGun(r, 'lever').ok, true); assert.equal(G.ownsGun(r, 'lever'), true);
  assert.equal(G.weaponOf(r), 'lasso', 'no auto-switch');
  assert.equal(G.setWeapon(r, 'lever'), true); assert.equal(G.gunInHand(r).reach, G.GUNS.lever.reach);
  const back = S.loadRiders().find((x) => x.id === r.id);
  back.owned.weapon = 'lever';
  G.setBandits(back, 'lasso');
  assert.equal(G.weaponOf(back), 'lasso', 'the switch off: the guns put away');
  assert.equal(G.ownsGun(back, 'lever'), true, 'kept');
});

test('a shot picks as the rope does: the right one is hit, a wrong one ducks, out of reach rides closer first', () => {
  const R = G.GUNPLAY.reach;
  assert.ok(R >= 30 && R <= 40, 'about 30 to 40 m');
  assert.ok(R > 15, 'farther than the rope');
  assert.equal(G.shotAt({ dist: 12, good: true }), 'hit');
  assert.equal(G.shotAt({ dist: 12, good: false }), 'duck');
  assert.equal(G.shotAt({ dist: R, good: true }), 'hit');
  assert.equal(G.shotAt({ dist: R + 0.5, good: true }), 'far');
  assert.equal(G.shotAt({ dist: R + 0.5, good: false }), 'far');
  assert.equal(G.shotAt({ dist: NaN, good: true }), 'far');
  assert.ok(G.GUNPLAY.from < R, 'rides up to inside the reach');
});
