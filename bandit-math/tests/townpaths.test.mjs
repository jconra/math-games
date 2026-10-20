// The townsfolk's ways about the town (src/townpaths.js): the walking grid, routes round walls, keeping to the paths
// unless the grass is much shorter, straight where nothing is in the way, and nothing found where nothing can be reached.
// Run with:  node --test bandit-math/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { gridSteps, route, along, cellAt, openAt, nearestOpen, shut, reopen, reopenSome, reversedRoute, COST } from '../src/townpaths.js';

const build = (o) => { const it = gridSteps(o); let r; do { r = it.next(); } while (!r.done); return r.value; };
// a 60 x 40 m field with a wall (a building) in the middle: x 20..40, z 10..30
const wallBox = (x, z) => x > 20 && x < 40 && z > 10 && z < 30;
const field = (extra = () => false, road = () => false) => build({ x0: 0, z0: 0, x1: 60, z1: 40, cell: 1, ground: (x, z) => (wallBox(x, z) || extra(x, z) ? 0 : road(x, z) ? COST.ROAD : COST.GRASS) });
// does a route cross a box (sampled every 10 cm)?
const crosses = (r, inside) => { const p = { x: 0, z: 0 }; for (let s = 0; s <= r.total; s += 0.1) { along(r, s, p); if (inside(p.x, p.z)) return true; } return false; };

test('a straight walk where nothing is in the way', () => {
  const G = field();
  const r = route(G, { x: 2, z: 5 }, { x: 55, z: 5 });
  assert.ok(r, 'a route');
  assert.ok(Math.abs(r.total - 53) < 0.6, `about the straight line: ${r.total.toFixed(2)} m`);
});

test('round a building, never through it, and not much longer than the way round', () => {
  const G = field();
  const r = route(G, { x: 10, z: 20 }, { x: 50, z: 20 });
  assert.ok(r);
  assert.ok(!crosses(r, wallBox), 'never through the wall');
  assert.ok(r.total > 40 && r.total < 62, `the way round: ${r.total.toFixed(1)} m`);
  // keeps a little off the wall (the squares beside it cost more): nowhere closer than 0.4 m
  const p = {}; let near = Infinity;
  for (let s = 0; s <= r.total; s += 0.1) { along(r, s, p); const dx = Math.max(20 - p.x, 0, p.x - 40), dz = Math.max(10 - p.z, 0, p.z - 30); near = Math.min(near, Math.hypot(dx, dz)); }
  assert.ok(near > 0.4, `${near.toFixed(2)} m off the wall at the closest`);
});

test('keeps to a dirt path rather than cutting a little way across the grass', () => {
  // a path along z = 2 then up x = 58: from (2, 2) to (58, 8) the path is barely longer than the diagonal
  const road = (x, z) => (z < 4 || x > 56);
  const G = field(() => false, road);
  const r = route(G, { x: 2, z: 2 }, { x: 58, z: 8 });
  const p = {}; let off = 0;
  for (let s = 0; s <= r.total; s += 0.5) { along(r, s, p); if (!road(p.x, p.z)) off += 0.5; }
  assert.ok(off < 3, `${off} m of it on the grass`);
});

test('nothing found when the far side is shut off; a start inside a wall walks out from the nearest open ground', () => {
  const ring = (x, z) => Math.abs(Math.hypot(x - 50, z - 20) - 6) < 1;   // (a closed ring of fence round (50, 20))
  const G = field(ring);
  assert.equal(route(G, { x: 5, z: 5 }, { x: 50, z: 20 }), null);
  const r = route(G, { x: 21, z: 20 }, { x: 5, z: 5 });   // (just inside the building's wall)
  assert.ok(r && r.xz[0] === 21, 'from where they stand');
  assert.ok(nearestOpen(G, 21, 20, 4) >= 0 && !openAt(G, 25, 20) && openAt(G, 15, 20));
});

test('a standing wagon shuts the squares under it for a while, and reopen puts them back', () => {
  const G = field();
  const k = cellAt(G, 10, 35), before = G.cost[k];
  assert.ok(shut(G, { x: 10, z: 35, w: 3, d: 6, rot: 0.3 }) > 10);
  assert.equal(G.cost[k], 0);
  const r = route(G, { x: 2, z: 35 }, { x: 18, z: 35 });
  assert.ok(r && !crosses(r, (x, z) => Math.abs(x - 10) < 0.8 && Math.abs(z - 35) < 1.5), 'round the wagon');
  reopen(G);
  assert.equal(G.cost[k], before);
});

test('each wagon\'s squares open again once it has gone; a square two wagons stood over opens only after both', () => {
  const G = field();
  const a = new Set(), b = new Set();
  const ka = cellAt(G, 10, 33), kb = cellAt(G, 10, 39), both = cellAt(G, 10, 36), cost = [ka, kb, both].map((k) => G.cost[k]);
  shut(G, { x: 10, z: 34, w: 3, d: 5 }, a);
  shut(G, { x: 10, z: 38, w: 3, d: 5 }, b);
  assert.ok(a.has(both) && b.has(both), 'the middle square is under both');
  reopenSome(G, a);
  assert.equal(G.cost[ka], cost[0], 'the first wagon\'s own square is open again');
  assert.equal(G.cost[both], 0, 'still shut: the second wagon stands over it');
  assert.equal(G.cost[kb], 0);
  assert.equal(a.size, 0);
  reopenSome(G, b);
  assert.deepEqual([ka, kb, both].map((k) => G.cost[k]), cost, 'all open again');
  assert.equal(G.base.size, 0);
});

test('a route run backwards ends where it began', () => {
  const G = field();
  const r = route(G, { x: 10, z: 20 }, { x: 50, z: 20 }), b = reversedRoute(r);
  assert.equal(b.total.toFixed(3), r.total.toFixed(3));
  assert.deepEqual([b.xz[0], b.xz[1]], [r.xz[r.xz.length - 2], r.xz[r.xz.length - 1]]);
  const p = along(b, b.total); assert.ok(Math.hypot(p.x - 10, p.z - 20) < 1e-3);
});
