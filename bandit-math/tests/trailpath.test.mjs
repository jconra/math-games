// Old Hob's hoofprint trail: the way finder (src/trailpath.js). Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { findPath, makePathSearch, smoothPath, nearestAlong } from '../src/trailpath.js';

const length = (p) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
const crosses = (p, bad) => { for (let i = 1; i < p.length; i++) for (let t = 0; t <= 1; t += 0.05) if (bad(p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t)) return true; return false; };

test('open ground: a straight way from end to end', () => {
  const p = findPath({ from: { x: 0, z: 0 }, to: { x: 100, z: 30 }, cost: () => 1 });
  assert.ok(p, 'a way is found');
  assert.deepEqual(p[0], [0, 0]); assert.deepEqual(p[p.length - 1], [100, 30]);
  assert.ok(length(p) < Math.hypot(100, 30) * 1.03, `nearly straight (${length(p).toFixed(1)} m)`);
});

test('a wall in the way: the way goes round its end, never through it', () => {
  const wall = (x, z) => Math.abs(x - 50) < 2 && z < 40;
  const p = findPath({ from: { x: 0, z: 0 }, to: { x: 100, z: 0 }, cost: (x, z) => (wall(x, z) ? Infinity : 1), pad: 60 });
  assert.ok(p);
  assert.ok(!crosses(p, wall), 'it never crosses the wall');
  assert.ok(p.some(([, z]) => z >= 40), 'it goes round the wall\'s end');
});

test('a road is followed where it is cheaper than the open grass', () => {
  // a road along z = 20 from x = 0 to 100; the ends are on z = 0
  const road = (x, z) => Math.abs(z - 20) < 2.5;
  const p = findPath({ from: { x: 0, z: 0 }, to: { x: 200, z: 0 }, cost: (x, z) => (road(x, z) ? 0.3 : 1) });
  assert.ok(p);
  const onRoad = p.filter(([x, z]) => road(x, z)).length / p.length;
  assert.ok(onRoad > 0.3, `most of the way is on the road (${(onRoad * 100).toFixed(0)}%)`);
});

test('no way through: the search fails rather than walking through water', () => {
  const river = (x) => Math.abs(x - 50) < 5;
  assert.equal(findPath({ from: { x: 0, z: 0 }, to: { x: 100, z: 0 }, cost: (x) => (river(x) ? Infinity : 1), pad: 20 }), null);
});

test('worked through in small slices, it finds the same way as all at once', () => {
  const cost = (x, z) => (Math.abs(x - 30) < 2 && z > -20 ? Infinity : 1);
  const all = findPath({ from: { x: 0, z: 0 }, to: { x: 60, z: 10 }, cost });
  const S = makePathSearch({ from: { x: 0, z: 0 }, to: { x: 60, z: 10 }, cost });
  let slices = 0; while (S.step(50) === 'running') slices++;
  assert.ok(slices > 3, 'it took several slices');
  assert.deepEqual(S.path, all);
});

test('an end on closed ground (a doorstep) starts from the nearest open square', () => {
  const hut = (x, z) => Math.hypot(x - 80, z) < 3;
  const p = findPath({ from: { x: 0, z: 0 }, to: { x: 80, z: 0 }, cost: (x, z) => (hut(x, z) ? Infinity : 1) });
  assert.ok(p);
  const [ex, ez] = p[p.length - 1];
  assert.ok(Math.hypot(ex - 80, ez) < 8, 'it ends beside the hut');
});

test('smoothing keeps a sharp corner rather than cut over closed ground', () => {
  const block = (x, z) => x > 1 && z < 9 && x < 20;
  const pts = [[0, 0], [0, 10], [20, 10]];
  const s = smoothPath(pts, (x, z) => (block(x, z) ? Infinity : 1));
  assert.ok(!crosses(s, block));
});

test('nearestAlong: how far along and how far off', () => {
  const r = nearestAlong([[0, 0], [10, 0], [10, 10]], 10.5, 5);
  assert.ok(Math.abs(r.along - 15) < 1e-6); assert.ok(Math.abs(r.off - 0.5) < 1e-6); assert.equal(r.length, 20);
});
