// The menu's "I'm stuck: move me" (src/unstick.js): which spot it picks. A trail of good spots kept as the rider goes
// about (not inside a blocker, not in water, a couple of metres apart), the newest still good and not where the rider is
// stuck; else the nearest door's spot; else the town square.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeUnstick, goodSpot, UNSTICK } from '../src/unstick.js';

// a wall: the box x 10..12, z -50..50; a pond: the disc round (0, 20), radius 4
const blocked = (x, z) => x > 10 && x < 12 && Math.abs(z) < 50;
const wet = (x, z) => Math.hypot(x, z - 20) < 4;
const walk = (U, pts) => { for (const p of pts) U.update(UNSTICK.every + 0.01, p); };

test('a good spot: open ground all round, no blocker, no water', () => {
  assert.equal(goodSpot(0, 0, { blocked, wet }), true);
  assert.equal(goodSpot(11, 0, { blocked, wet }), false);    // (in the wall)
  assert.equal(goodSpot(9.5, 0, { blocked, wet }), false);   // (its edge within reach)
  assert.equal(goodSpot(0, 20, { blocked, wet }), false);    // (in the pond)
  assert.equal(goodSpot(NaN, 0, { blocked, wet }), false);
});

test('the trail keeps good spots a couple of metres apart, the newest last, and only so many', () => {
  const U = makeUnstick({ blocked, wet });
  walk(U, [{ x: 0, z: 0 }, { x: 0.5, z: 0 }, { x: 3, z: 0 }, { x: 11, z: 0 }, { x: 0, z: 20 }, { x: 6, z: 0 }]);
  assert.deepEqual(U.trail, [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 6, z: 0 }]);
  for (let i = 0; i < 40; i++) U.update(UNSTICK.every + 0.01, { x: -i * 3, z: -10 });
  assert.equal(U.trail.length, UNSTICK.keep);
  // (not looked at while the rider is busy: a counter, the cabin)
  const V = makeUnstick({ blocked, wet });
  V.update(5, { x: 0, z: 0 }, false);
  assert.equal(V.trail.length, 0);
  // (and not more often than once a second)
  V.update(0.2, { x: 0, z: 0 });
  assert.equal(V.trail.length, 0);
});

test('stuck: back to the newest trail spot that is still good and not where the rider stands', () => {
  const U = makeUnstick({ blocked, wet });
  walk(U, [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 7, z: 0 }]);
  // stuck in the wall: the last good spot
  assert.deepEqual(U.pick({ x: 11, z: 0 }), { x: 7, z: 0, from: 'trail' });
  // stuck at the last spot itself (it looks open, the rider can't move): the one before
  assert.deepEqual(U.pick({ x: 7, z: 0.3 }), { x: 4, z: 0, from: 'trail' });
});

test('a trail spot that something now blocks is passed over', () => {
  let cart = false;
  const b = (x, z) => blocked(x, z) || (cart && Math.hypot(x - 6, z) < 2.5);
  const U = makeUnstick({ blocked: b, wet });
  walk(U, [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 7, z: 0 }]);
  cart = true;
  assert.deepEqual(U.pick({ x: 11, z: 0 }), { x: 0, z: 0, from: 'trail' });
});

test('no trail: the nearest good door spot; none good: the town square', () => {
  const U = makeUnstick({ blocked, wet });
  const doors = [{ x: 30, z: 0, rot: 1 }, { x: 11, z: 3, rot: 2 }, { x: 0, z: 21, rot: 3 }, { x: 5, z: 1, rot: 4 }];
  assert.deepEqual(U.pick({ x: 11, z: 0 }, { doors, square: { x: 0, z: -30, rot: 0 } }), { x: 5, z: 1, from: 'door', rot: 4 });
  assert.deepEqual(U.pick({ x: 11, z: 0 }, { doors: [{ x: 11, z: 3 }, { x: 0, z: 20 }], square: { x: 0, z: -30, rot: 0 } }), { x: 0, z: -30, from: 'square', rot: 0 });
  U.clear();
  assert.equal(U.pick({ x: 11, z: 0 }), null);
});
