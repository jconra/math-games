// The town's people's plan (src/townpeopleplan.js): the townsfolk are the store's customers and the loot's families,
// each with a home; they go where people gather, nearer and livelier places likelier, home at night; a job borrows
// whoever is best placed.
// Run with:  node --test mathwood-valley/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOWN, HOME_OF, residents, outCap, pick, nextFor, lendCost, hash, LIKES } from '../src/townpeopleplan.js';
import { FOLK } from '../src/math/wordproblems.js';
import { FAMILIES, MATRON } from '../src/math/shares.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test('every townsperson is one of the store\'s faces, with a home; every family\'s one lives in town', () => {
  const R = residents();
  assert.deepEqual(R.map((r) => r.name).sort(), FOLK.map((f) => f.name).sort());
  for (const r of R) {
    assert.ok(['home1', 'home2', 'home3', 'home4', 'saloon', 'store', 'west', 'east'].includes(r.home), r.name + ' lives somewhere');
    assert.equal(r.look.outfit, FOLK.find((f) => f.name === r.name).look.outfit, 'dressed as at the store');
    assert.ok(Number.isInteger(r.look.skin) && Number.isInteger(r.look.hair), 'a skin and hair of their own');
  }
  for (const f of [...FAMILIES, MATRON]) assert.ok(HOME_OF[f.rep], f.rep + ' (' + f.name + ') is a townsperson');
  const homes = new Set(Object.values(HOME_OF));
  for (const h of ['home1', 'home2', 'home3', 'home4']) assert.ok(homes.has(h), h + ' has somebody living in it');
  assert.equal(JSON.stringify(residents()), JSON.stringify(R), 'the same looks every time (from their names)');
  assert.ok(hash('Mr. Pike') >= 0 && hash('Mr. Pike') < 1);
});

test('how many are out at once: by the tier, and far fewer at night', () => {
  assert.ok(outCap('gaming') > outCap('normal') && outCap('normal') > outCap('potato'));
  assert.equal(outCap('gaming', 0), TOUT('gaming'));
  assert.ok(outCap('gaming', 1) <= Math.ceil(TOWN.out.gaming * TOWN.nightOut) && outCap('gaming', 1) >= 1);
  assert.ok(outCap('potato', 1) >= 1, 'somebody about even on a small machine at night');
  function TOUT(t) { return TOWN.out[t]; }
});

test('pick: in proportion, never a zero', () => {
  assert.equal(pick([0, 0, 0]), -1);
  assert.equal(pick([0, 5, 0], seq(0.99)), 1);
  const n = [0, 0, 0]; let r = 0; const rand = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 3000; i++) n[pick([1, 2, 0], rand)]++;
  assert.equal(n[2], 0); assert.ok(n[1] > n[0] * 1.6 && n[1] < n[0] * 2.5, JSON.stringify(n));
});

// a little town of spots: a porch near, a square a way off, the lake far, a home yard
const spots = () => [
  { id: 'porch', kind: 'porch', x: 5, z: 0, cap: 2, used: 0, crowd: 0 },
  { id: 'square', kind: 'square', x: 30, z: 0, cap: 2, used: 0, crowd: 0 },
  { id: 'lake', kind: 'lake', x: 120, z: 0, cap: 2, used: 0, crowd: 0 },
  { id: 'yard', kind: 'home', home: 'home1', x: 0, z: 10, cap: 2, used: 0, crowd: 0 },
  { id: 'stage', kind: 'stage', x: 10, z: 10, cap: 4, used: 0, crowd: 0 },
];
const tally = (person, S, o, n = 4000) => { const c = {}; let r = 7; const rand = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) { const x = nextFor(person, S, { rand, ...o }); const k = x.go === 'spot' ? x.spot.id : x.go; c[k] = (c[k] || 0) + 1; } return c; };

test('by day: the places near and liked most, the far lake now and then, never a full spot, home sometimes', () => {
  const S = spots(), me = { name: 'A', home: 'home1', x: 0, z: 0 };
  const c = tally(me, S, { night: 0 });
  assert.ok(c.porch > c.square && c.square > (c.lake || 0), JSON.stringify(c));
  assert.ok(c.home > 0 && c.home < 0.3 * 4000, 'home now and then: ' + c.home);
  S[0].used = 2;   // (the porch full)
  assert.equal(tally(me, S, { night: 0 }).porch, undefined, 'never a full spot');
  assert.equal(tally(me, spots(), { night: 0, playing: false }).stage, undefined, 'the stage only while the band plays');
  const S2 = spots(); S2[1].crowd = 1;   // (someone at the square)
  assert.ok(tally(me, S2, { night: 0 }).square > c.square * 1.5, 'company draws people');
});

test('at night: most go home; those who live up the road go off by the road', () => {
  const me = { name: 'A', home: 'home1', x: 0, z: 0 };
  const c = tally(me, spots(), { night: 1 });
  assert.ok(c.home > 0.7 * 4000, JSON.stringify(c));
  assert.ok((c.porch || 0) > (c.square || 0), 'the saloon porch still has a few');
  const out = tally({ name: 'B', home: 'west', x: 0, z: 0 }, spots(), { night: 1 });
  assert.ok(out.road > 0.7 * 4000 && !out.home, JSON.stringify(out));
});

test('just out of a door: never straight back in through one', () => {
  const c = tally({ name: 'A', home: 'home1', x: 0, z: 0 }, spots(), { night: 0.9, fresh: true });
  assert.ok(!c.home && !c.door, JSON.stringify(c));
});

test('a job borrows whoever is closest; somebody out beats somebody indoors a little nearer', () => {
  assert.ok(lendCost({ out: true, d: 10 }) < lendCost({ out: false, d: 10 }));
  assert.ok(lendCost({ out: true, d: 12 }) < lendCost({ out: false, d: 8 }));
  assert.ok(lendCost({ out: false, d: 5 }) < lendCost({ out: true, d: 30 }));
});

test('the dials stay sensible', () => {
  assert.ok(TOWN.door >= 0.4 && TOWN.door <= 1, 'a door\'s dissolve takes about half a second');
  assert.ok(TOWN.walk[0] >= 1 && TOWN.walk[1] <= 1.6 && TOWN.hurry > TOWN.walk[1]);
  assert.ok(TOWN.seenFar >= 200, 'out of sight only when really far');
  for (const k of ['porch', 'square', 'stage', 'yard', 'lake', 'lane', 'home']) assert.ok(LIKES[k] > 0, k);
});
