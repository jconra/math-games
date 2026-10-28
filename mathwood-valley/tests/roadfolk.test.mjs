// The riders and walkers on the road through the valley, in plain numbers (src/roadfolkplan.js): who they are, how
// fast, where on the road they keep, where a new one sets off and where those already out are when the player rides
// out. How they walk, stop for the player, say hello and fade at the road's ends is checked in the game by
// ~/pw/bandit-math/rigs/town/roads/ (folk_smoke.cjs, roads_play.cjs).
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROADFOLK, TRAVELLER_LOOKS, pickKind, paceFor, edgeOf, startFor, seedSpots } from '../src/roadfolkplan.js';

test('a few travel the road, fewer drawn than travelling, and the slowest machines fewer still', () => {
  for (const t of ['gaming', 'normal', 'potato']) {
    assert.ok(ROADFOLK.made[t] <= ROADFOLK.most[t], t);
    assert.ok(ROADFOLK.show[t] >= 100, t);
  }
  assert.ok(ROADFOLK.most.potato < ROADFOLK.most.gaming && ROADFOLK.made.potato < ROADFOLK.made.gaming);
});

test('riders and walkers: about the share asked for by day, fewer walkers at night', () => {
  const count = (night) => { let r = 0; for (let i = 0; i < 1000; i++) if (pickKind(() => (i + 0.5) / 1000, night) === 'rider') r++; return r / 1000; };
  assert.ok(Math.abs(count(0) - ROADFOLK.riders) < 0.01, `${count(0)}`);
  assert.ok(count(1) > count(0) + 0.15, `night ${count(1)}`);
  assert.equal(pickKind(() => 0, 0), 'rider');
  assert.equal(pickKind(() => 0.999, 0), 'walker');
});

test('a walker walks and a rider rides a little faster, never at a gallop', () => {
  for (const r of [0, 0.5, 0.999]) {
    const w = paceFor('walker', () => r), h = paceFor('rider', () => r);
    assert.ok(w >= 1 && w <= 1.6, `walker ${w}`);
    assert.ok(h >= 1.8 && h <= 4, `rider ${h}`);
  }
});

test('they keep to the road\'s edge, outside the wagons\' lane', () => {
  for (const lane of [0.6, 1.3, 2]) {
    assert.ok(edgeOf('walker', lane) - lane > ROADFOLK.inLane, 'walker');
    assert.ok(edgeOf('rider', lane) - lane > ROADFOLK.inLane, 'rider');
    assert.ok(edgeOf('walker', lane) > edgeOf('rider', lane), 'a walker further out than a rider');
  }
});

test('a new one sets off out of the player\'s sight, from the road\'s end or out of sight of the town', () => {
  const L = 1300, square = 650, at = (x) => (u) => Math.abs(u - x);
  // the player in town: from the road's own end
  assert.equal(startFor(1, { L, square, dist: at(square), far: 200 }), 0);
  assert.equal(startFor(-1, { L, square, dist: at(square), far: 200 }), L);
  // the player out at the west end: going east, from out of sight of the town instead (360 m west of the square)
  assert.equal(startFor(1, { L, square, dist: at(20), far: 200 }), square - ROADFOLK.reach);
  // somebody just set off there: nowhere just now, rather than on top of them
  assert.equal(startFor(1, { L, square, dist: at(square), far: 200, others: [{ dir: 1, u: 10 }, { dir: 1, u: square - ROADFOLK.reach + 5 }] }), null);
  // (going the other way doesn't count)
  assert.equal(startFor(1, { L, square, dist: at(square), far: 200, others: [{ dir: -1, u: 5 }] }), 0);
  // a short road with the player in the middle of it: nowhere far enough
  assert.equal(startFor(1, { L: 300, square: 150, dist: at(150), far: 400 }), null);
});

test('riding out, a few are already out on the road, well away from the player and apart', () => {
  const L = 1300, player = 650, dist = (u) => Math.abs(u - player);
  let a = 12345; const rand = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };   // (mulberry32)
  const spots = seedSpots(4, { L, dist, rand });
  assert.equal(spots.length, 4);
  for (const s of spots) {
    assert.ok(dist(s.u) >= ROADFOLK.seedAway, `${s.u}`);
    assert.ok(s.u > 0 && s.u < L && (s.dir === 1 || s.dir === -1));
  }
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) assert.ok(Math.abs(spots[i].u - spots[j].u) >= ROADFOLK.apart * 2);
  // no room at all: none rather than one on top of the player
  assert.equal(seedSpots(3, { L: 300, dist: () => 10, rand }).length, 0);
});

test('they look like working folk, never like the gang', () => {
  assert.ok(!TRAVELLER_LOOKS.palettes.includes('outlaw'));
  assert.ok(TRAVELLER_LOOKS.outfits.length && TRAVELLER_LOOKS.palettes.length);
});

test('the module says hello through the howdy bubbles and fades with the wagons\' dissolve', () => {
  const src = fs.readFileSync(new URL('../src/roadfolk.js', import.meta.url), 'utf8');
  for (const name of ["from './ui/howdy.js'", 'makeHowdyWatch()', 'fadeAll(', 'unfade(', 'AMBUSH.hold', 'tipHat()', "play('Wave'"]) assert.ok(src.includes(name), name);
});

// ── THE PARTIES (Dad: "more pairs of mounted riders and hikers") ──────────────────────────────────────────────────
import { pickParty, slotFor, hikerKit, spacing } from '../src/roadfolkplan.js';

test('riders often ride in pairs; hikers go in ones, twos and threes', () => {
  const shares = { rider1: 0, rider2: 0, walker1: 0, walker2: 0, walker3: 0 };
  let a = 7; const rand = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  for (let i = 0; i < 6000; i++) { const p = pickParty(rand, 0); shares[p.kind + p.size]++; }
  const riders = shares.rider1 + shares.rider2, walkers = shares.walker1 + shares.walker2 + shares.walker3;
  assert.ok(Math.abs(shares.rider2 / riders - ROADFOLK.riderPair) < 0.04, `pairs ${shares.rider2 / riders}`);
  assert.ok(shares.walker2 > shares.walker1 && shares.walker3 > 0, JSON.stringify(shares));
  assert.ok(Math.abs(walkers / 6000 - (1 - ROADFOLK.riders)) < 0.04);
});

test('a party side by side, further out than its leader (clear of the wagons\' lane), or in single file where tight', () => {
  for (const kind of ['rider', 'walker']) {
    assert.deepEqual(slotFor(kind, 0), { du: 0, dk: 0 });
    const two = slotFor(kind, 1); assert.equal(two.du, 0); assert.ok(two.dk > 0.5, 'alongside, outward');
    const tight = slotFor(kind, 1, 0.2); assert.equal(tight.dk, 0); assert.ok(tight.du > 1, 'behind');
    const three = slotFor(kind, 2); assert.ok(three.du > 1 && three.dk > 0 && three.dk < two.dk);
    assert.ok(slotFor(kind, 2, 0).du > tight.du, 'the third behind the second, single file');
  }
});

test('most hikers carry a pack (the adventurer outfits) and some a bedroll on it', () => {
  let a = 11; const rand = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  let pack = 0, roll = 0; for (let i = 0; i < 4000; i++) { const k = hikerKit(rand); if (k.outfit) { pack++; assert.ok(/^adventurer_/.test(k.outfit)); } if (k.bedroll) { roll++; assert.ok(k.outfit); } }
  assert.ok(Math.abs(pack / 4000 - ROADFOLK.packs) < 0.04 && roll > 0 && roll < pack);
});

test('a busier road sets parties off closer together and more often; nobody sets off where the player could see', () => {
  const few = spacing(8, 1500), many = spacing(120, 1500);
  assert.ok(many.apart < few.apart && many.every[1] < few.every[1]);
  assert.ok(many.apart >= 10);
  const L = 1300, square = 650, at = (x) => (u) => Math.abs(u - x);
  assert.equal(startFor(1, { L, square, dist: at(square), far: 200, ok: (u) => u !== 0 }), square - ROADFOLK.reach, 'the road\'s end in view: the other spot');
  assert.equal(startFor(1, { L, square, dist: at(square), far: 200, ok: () => false }), null, 'all in view: nobody just now');
});
