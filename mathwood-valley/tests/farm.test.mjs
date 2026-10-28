// Tests for the farm's layout (src/farmplan.js; made by src/farm.js): the spots the farm jobs depend on stay where they
// are, and the farm's buildings and props (the code-built barn and wind pump, the town's troughs and hay, put into the
// town's layout by the world) stand where the farm says, turn with it, and keep out of the pens, the lane, the gates and
// one another.
//   node --test mathwood-valley/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FARM, farmLayout, farmItems } from '../src/farmplan.js';
import { TOWN_ASSETS, modelFootprint } from '../world/objects/townAssets.js';

const PLACE = { x: -6, z: -278, rot: 0, w: 56, d: 48 };   // (src/world.js: the farm's spot when the layout gives none)
// (about how far round its middle each kind reaches, for keeping clear: its footprint's half diagonal)
const REACH = { trough: Math.hypot(1.9, 0.7) / 2, hayBales: Math.hypot(1.9, 1.0) / 2, haystack: Math.hypot(3.6, 2.8) / 2 };
const reach = (it) => (it.type === 'model' ? Math.hypot(modelFootprint({ ...it, size: TOWN_ASSETS[it.kind].size }).w, modelFootprint({ ...it, size: TOWN_ASSETS[it.kind].size }).d) / 2 : REACH[it.kind]);

test('the spots the farm jobs depend on are where they were (the pens, the gates, the lane, the barn)', () => {
  assert.deepEqual([FARM.sheep, FARM.paddock, FARM.yard, FARM.pens].map((s) => JSON.stringify(s)), [
    '{"x0":-27,"x1":-5,"z0":-6,"z1":22,"gate":{"side":"+z","at":-11,"width":4.5}}',
    '{"x0":8,"x1":27,"z0":1,"z1":22,"gate":{"side":"-x","at":11.5,"width":4.5}}',
    '{"x0":8,"x1":27,"z0":-22,"z1":-4,"gate":{"side":"+z","at":11.5,"width":3.5}}',
    '{"n":2,"depth":6,"gate":2.2}']);
  assert.deepEqual([FARM.barn.x, FARM.barn.z, FARM.barn.w, FARM.barn.d, FARM.barn.rot], [0, -15, 12, 9, 0], 'the barn\'s spot and size');
  const L = farmLayout(PLACE);
  assert.deepEqual([L.entry.x, L.entry.z], [-5, -254], 'the lane\'s open end');
  assert.deepEqual([L.barn.door.x, L.barn.door.z], [-6, -287], 'the barn\'s door spot, on the lane');
});

test('the farm\'s things: the barn and the wind pump where the layout has them, the troughs and the hay, all kinds the town has', () => {
  const L = farmLayout(PLACE), items = farmItems(PLACE), by = Object.fromEntries(items.map((it) => [it.id, it]));
  assert.deepEqual(items.map((it) => it.kind), ['barn', 'windpump', 'trough', 'trough', 'trough', 'haystack', 'hayBales', 'hayBales']);
  assert.deepEqual([by['farm-barn'].x, by['farm-barn'].z, by['farm-barn'].rot], [L.barn.x, L.barn.z, 0]);
  assert.equal(by['farm-barn'].level, true, 'the barn levels its ground, as the town\'s buildings do');
  assert.deepEqual([by['farm-windpump'].x, by['farm-windpump'].z], [L.windmill.x, L.windmill.z]);
  for (const it of items) if (it.type === 'model') assert.ok(TOWN_ASSETS[it.kind] && TOWN_ASSETS[it.kind].code, it.kind + ': a code-built kind the town has');
  assert.equal(new Set(items.map((it) => it.id)).size, items.length, 'each its own id');
  // (the barn's footprint as the town lays it out: its 12 x 9 m walls and the roof's overhangs)
  const f = modelFootprint({ ...by['farm-barn'], size: TOWN_ASSETS.barn.size });
  assert.ok(Math.abs(f.w - 12.9) < 0.05 && Math.abs(f.d - 9.8) < 0.05, `the barn's footprint ${f.w.toFixed(2)} x ${f.d.toFixed(2)}`);
});

test('they turn with the farm', () => {
  const P = { ...PLACE, rot: Math.PI / 6 }, L = farmLayout(P), items = farmItems(P), barn = items.find((it) => it.kind === 'barn');
  assert.ok(Math.abs(barn.x - L.barn.x) < 0.01 && Math.abs(barn.z - L.barn.z) < 0.01);
  assert.ok(Math.abs(barn.rot - 30) < 0.05, 'turned 30 degrees: ' + barn.rot);
  const t3 = items.find((it) => it.id === 'farm-trough3');
  assert.ok(Math.abs(t3.rot - 120) < 0.05, 'the stock tank turned with it: ' + t3.rot);
});

test('they keep clear of the pens, the lane, the barn\'s doors, the gates and one another', () => {
  const L = farmLayout(PLACE), items = farmItems(PLACE), loc = (it) => L.local(it.x, it.z);
  const yard = FARM.yard, inYard = (p, r) => p.x + r > yard.x0 && p.x - r < yard.x1 && p.z + r > yard.z0 && p.z - r < yard.z1;
  // (the barn's footprint, its eaves and all, against the yard's fence: a box, not a circle round it)
  const fb = modelFootprint({ kind: 'barn', size: TOWN_ASSETS.barn.size });
  assert.ok(FARM.barn.x + fb.w / 2 < yard.x0 - 1, 'the barn\'s eave a metre and more clear of the pig yard\'s fence');
  for (const it of items) {
    const p = loc(it), r = reach(it);
    if (it.kind !== 'barn') assert.ok(!inYard(p, r), it.id + ': clear of the pig yard and its pens');
    if (it.kind !== 'barn') {
      assert.ok(!(Math.abs(p.x - 0.5) < 3 + r && p.z > -10.5 - r && p.z < 24), it.id + ': clear of the lane (3 m either side of it, the barn\'s doors to the farm\'s front)');
      assert.ok(Math.hypot(p.x - FARM.barn.x, p.z - FARM.barn.z) > Math.hypot(6.45, 4.9) + r - 1.5, it.id + ': not in the barn');
    }
    for (const k of ['sheep', 'paddock', 'yard']) for (const g of [L[k].gate.in, L[k].gate.out]) assert.ok(Math.hypot(it.x - g.x, it.z - g.z) > r + 1, `${it.id}: clear of the ${k} gate`);
    for (const q of L.pens) assert.ok(Math.hypot(it.x - q.gate.out.x, it.z - q.gate.out.z) > r + 1, it.id + ': clear of a pen\'s gate');
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j], d = Math.hypot(a.x - b.x, a.z - b.z);
    // (the stock tank stands at the end of the wind pump's pipe, just past its legs: the one pair meant to stand close)
    if ([a.id, b.id].sort().join() === 'farm-trough3,farm-windpump') { assert.ok(d > 1.8 && d < 2.3, 'the stock tank at the end of the pump\'s pipe: ' + d.toFixed(2)); continue; }
    assert.ok(d > reach(a) + reach(b) - 0.6, `${a.id} and ${b.id} ${d.toFixed(2)} m apart`);
  }
});
