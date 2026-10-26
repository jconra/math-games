// The windmill job's books (src/mill.js): what the miller pays in flour for a tower that stood through the wind test
// (only for new height, and the sails once), how fast the mill grinds with the sails up, where the sacks stack on the
// porch; and the flour sold at the store (src/math/goods.js), the job switch, the buckle and the checklist entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testPay, grindEvery, grind, sailsUp, stackSpots, payLine, feetOf, FLOUR, SAILS_FT, DONE_FT, PORCH } from '../src/mill.js';
import { GOODS, GOODS_IDS, makeSale, homestead, collect, picture } from '../src/math/goods.js';
import { MISSIONS, JOBS, KEEPSAKES, newRider, jobOn, buckleOf } from '../src/save.js';
import { COMING, WINDMILL_FEET } from '../src/completion.js';

test('the first test pays a sack a foot (and the sails); later tests pay only for new height', () => {
  assert.deepEqual(testPay(9.7, 0), { sacks: 9, paid: 9.7, sails: false });
  assert.deepEqual(testPay(9.7, 9.7), { sacks: 0, paid: 9.7, sails: false }, 'the same tower again: nothing new');
  assert.equal(testPay(8, 9.7).sacks, 0, 'a shorter tower: nothing');
  assert.equal(testPay(8, 9.7).paid, 9.7, 'what was paid for is kept');
  assert.equal(testPay(12.2, 9.7).sacks, 3, '9 -> 12 feet: three sacks');
  assert.equal(testPay(16, 12.2).sacks, 4 + FLOUR.sailSacks, 'up to the sails: the feet and five for the sails');
  assert.equal(testPay(18.5, 16).sacks, 2, 'the sails are paid once');
  assert.equal(testPay(18, 0).sacks, 18 + FLOUR.sailSacks, 'a first tower of 18 ft: 23 sacks, as the lab pays');
  assert.equal(testPay(0, 0).sacks, 0);
  assert.equal(testPay(NaN, undefined).sacks, 0, 'never throws on a bad number');
});

test('the mill grinds only with the sails up, quicker for a taller tower, and stops when the porch is full', () => {
  assert.equal(grindEvery(15.9), null);
  assert.equal(grindEvery(SAILS_FT), FLOUR.every16);
  assert.ok(grindEvery(18) < grindEvery(16) && grindEvery(24) < grindEvery(18));
  assert.equal(grindEvery(500), FLOUR.fastest, 'never quicker than the fastest');
  const b = { stood: { height: 18 }, porch: 0 };
  assert.ok(sailsUp(b, 18) && !sailsUp(b, 14) && !sailsUp({ stood: { height: 15 } }, 18) && !sailsUp({}, 20));
  let n = 0; for (let t = 0; t < 600; t++) n += grind(b, 1, 18);
  assert.equal(n, Math.floor(600 / grindEvery(18)), 'whole sacks counted as they are ground');
  assert.ok(Math.abs(b.porch - 600 / grindEvery(18)) < 1e-6);
  assert.equal(grind({ stood: { height: 18 }, porch: 3 }, 1000, 12), 0, 'the tower built on below 16 ft: no sails, no flour');
  const full = { stood: { height: 18 }, porch: FLOUR.porch - 0.5 };
  for (let t = 0; t < 3000; t++) grind(full, 1, 18);
  assert.ok(Math.abs(full.porch - FLOUR.porch) < 1 / 45 + 1e-9, 'a full porch: the mill waits');
  const over = { stood: { height: 18 }, porch: FLOUR.porch + 9 };
  assert.equal(grind(over, 500, 18), 0); assert.equal(over.porch, FLOUR.porch + 9, 'sacks paid past what the porch holds are kept');
});

test('the sacks stand on the porch in two rows, never more than the porch holds, never two in one spot', () => {
  assert.deepEqual(stackSpots(0), []);
  const all = stackSpots(999);
  assert.equal(all.length, FLOUR.porch);
  assert.ok(all.length <= PORCH.rows.length * PORCH.perRow);
  // on the porch (the model: x -2.44 .. 2.44, the porch floor z 0.8 .. 1.85), on its floor, 0.46 m across each
  for (const s of all) assert.ok(Math.abs(s.x) < 2.2 && s.z > 0.95 && s.z < 1.75 && s.y === PORCH.floor, JSON.stringify(s));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z) >= 0.44, `${i} ${j}`);
  assert.deepEqual(stackSpots(5), all.slice(0, 5), 'a sack more never moves the others');
});

test('the card says what was paid in plain words', () => {
  assert.match(payLine(9, 9.5, 0), /every foot left standing.*porch/);
  assert.match(payLine(3, 12, 9), /higher than before/);
  assert.match(payLine(9, 16, 12), /five for the sails/);
  assert.doesNotMatch(payLine(2, 18, 16), /sails/, 'the sails paid once');
  assert.match(payLine(0, 9, 9.7), /stood 9 feet before/);
  assert.equal(feetOf(17.99), 17); assert.equal(feetOf(18), 18); assert.equal(feetOf(-3), 0);
  assert.equal(DONE_FT, WINDMILL_FEET, 'done at the checklist\'s height');
});

test('flour goes in the saddlebags and sells at the store as sacks at a price, or a price for a few sacks', () => {
  assert.ok(GOODS_IDS.includes('flour') && GOODS.flour.bag > 0);
  const r = newRider('Mo');
  homestead(r).goods.flour = 9;
  assert.equal(collect(r), null, 'walking past the farm yard never takes flour (it waits at the mill)');
  const who = { name: 'Mrs. Reed', she: true };
  for (let i = 0; i < 60; i++) {
    const o = makeSale({ eggs: 0, wool: 0, milk: 0, flour: 9 }, { step: { step: 2, sales: 'lots', salesAt: 20 }, who, rand: ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(i + 7) });
    assert.ok(o && o.sale.goods === 'flour' && o.sale.form === 'lots', 'only flour to sell');
    assert.equal(o.coins.filter((c) => c.good).length, 1);
    assert.equal(o.sale.gold, parseInt(o.answer, 10), 'the right coin is the gold paid');
    assert.ok(o.sale.sold >= 2 && o.sale.sold <= 6 && o.sale.left === 9 - o.sale.sold);
    assert.equal(o.sale.at, 20, 'asked in the form planned: counted where it was asked');
  }
  // (its picture after a wrong coin: so many sacks, so much each; nothing "packed into lots")
  const pic = picture(makeSale({ eggs: 0, wool: 0, milk: 0, flour: 9 }, { step: { step: 2, sales: 'lots', salesAt: 20 }, who }).pic);
  assert.match(pic.line, /^\d sacks, \d gold for each: \d( \+ \d)+ = \? gold$/, pic.line);
  assert.equal(pic.title, 'So much each');
  const u = makeSale({ eggs: 0, wool: 0, milk: 0, flour: 7 }, { step: { step: 8, sales: 'unit', salesAt: 52 }, who });
  assert.equal(u.sale.form, 'unit'); assert.equal(u.sale.at, 52);
  assert.match(u.story, /for [23] sacks, the same for every sack/);
  const easy = makeSale({ eggs: 0, wool: 0, milk: 0, flour: 7 }, { step: { step: 6, sales: 'leftover', salesAt: 42 }, who });
  assert.equal(easy.sale.form, 'lots'); assert.equal(easy.sale.at, null, 'an easier form than planned: not counted on the strand');
  assert.equal(makeSale({ eggs: 0, wool: 0, milk: 0, flour: 1 }, { step: { step: 2, sales: 'lots', salesAt: 20 }, who }), null, 'one sack: nothing to work out');
});

test('the windmill is a job: a switch on by default, a buckle by feet stood, a keepsake, on the checklist', () => {
  const m = MISSIONS.find((x) => x.id === 'windmill');
  assert.ok(m && m.ready);
  const r = newRider('Jo');
  assert.equal(jobOn(r, 'windmill'), true);
  r.missions.windmill = false; assert.equal(jobOn(r, 'windmill'), false);
  const j = JOBS.find((x) => x.id === 'tower');
  assert.deepEqual(j.at, [4, 10, 16, 18]);
  assert.deepEqual(j.by, ['windmill']);
  assert.equal(j.at[3], WINDMILL_FEET, 'gold at the height that counts as done');
  assert.ok(KEEPSAKES.tower);
  r.stats.jobs.tower = 16; assert.equal(buckleOf(r, 'tower').tier, 'silver');
  assert.equal(COMING.windmill, true);
});
