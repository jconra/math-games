// Tests for the landforms (world/objects/landforms.js): the mill hill, the bridge crossing's level shelf and ravine, the
// ford beside the road and the engineer's camp's room, on a made-up land shaped like the real one there; and the paths
// that go with them in the planting (the dock path behind the saloon, the ford's lane, the road up to the banks' edges).
// Run with:  node --test mathwood-valley/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { makeLandforms, HILL, CROSSING, FORD, CAMP } from '../world/objects/landforms.js';
import { modelFootprint } from '../world/objects/townAssets.js';
import { BACKWOODS } from '../src/missions/backwoods.js';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(join(GAME, p), 'utf8'));
const layout = json('models/town/layout.json'), planting = json('models/town/planting.json');
const stroke = (id) => planting.strokes.find((s) => s.id === id);

// a land like the real one round the spots: a gentle fall eastward at the hill; at the crossing a broad V valley along
// the river (about 0.24 up each side), the river falling westward, with small bumps
const zRiver = (x) => { const R = CROSSING.river; for (let i = 1; i < R.length; i++) if (x <= R[i][0]) { const t = (x - R[i - 1][0]) / (R[i][0] - R[i - 1][0]); return R[i - 1][1] + (R[i][1] - R[i - 1][1]) * t; } return R[R.length - 1][1]; };
const base = (x, z) => (x < -200 ? -26.9 + 0.07 * (x + 339) + 0.24 * Math.abs(z - zRiver(x)) : -7.4 - 0.08 * (x + 93) + 0.01 * (z + 172)) + 0.15 * Math.sin(x * 0.37) * Math.cos(z * 0.29);
const L = makeLandforms(base);
const at = (x, z) => L.at(x, z, base(x, z));
const slope = (x, z, e = 0.5) => Math.hypot(at(x + e, z) - at(x - e, z), at(x, z + e) - at(x, z - e)) / (2 * e);

test('away from the marked spots the land is exactly as it was', () => {
  let n = 0;
  for (let x = -790; x <= 790; x += 37) for (let z = -790; z <= 790; z += 41) {
    if (L.boxes.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1)) continue;
    assert.equal(at(x, z), base(x, z), `changed at ${x}, ${z}`); n++;
  }
  assert.ok(n > 1500);
  // and the boxes are only round the spots
  for (const b of L.boxes) assert.ok(b.x1 - b.x0 < 140 && b.z1 - b.z0 < 140, 'a small box');
});

test('the mill hill: a few metres high, flat-ish on top and wide enough for the tower and the mill, gentle all round', () => {
  const top = at(HILL.x, HILL.z), round = [];
  for (let a = 0; a < 16; a++) round.push(base(HILL.x + Math.cos(a * 0.39) * 40, HILL.z + Math.sin(a * 0.39) * 40));
  const around = round.reduce((s, v) => s + v, 0) / round.length;
  assert.ok(top - around > 2.8 && top - around < 5.5, `about ${(top - around).toFixed(1)} m over the land round it`);
  // the top: a windmill tower (16 ft square) and a mill (16 x 12 ft) with room between: a circle 8 m across within 0.4 m
  for (let a = 0; a < 24; a++) for (const r of [2, 4, 6, 8]) {
    const h = at(HILL.x + Math.cos(a * 0.26) * r, HILL.z + Math.sin(a * 0.26) * r);
    assert.ok(Math.abs(h - top) < 0.45, `top uneven by ${(h - top).toFixed(2)} at ${r} m`);
  }
  // gentle: rideable all round (a cart track can wind up it), nothing over 0.4 (22 degrees)
  let most = 0; for (let x = HILL.x - 40; x <= HILL.x + 40; x += 1) for (let z = HILL.z - 40; z <= HILL.z + 40; z += 1) most = Math.max(most, slope(x, z));
  assert.ok(most < 0.4, "steepest " + most.toFixed(2));
});

test('the road beside the mill hill is left as it was', () => {
  for (const id of ['westtrail', 'landpath4']) for (const [x, z] of stroke(id).pts) {
    if (Math.hypot(x - HILL.x, z - HILL.z) > 60) continue;
    assert.ok(Math.abs(at(x, z) - base(x, z)) < 0.05, `${id} raised ${(at(x, z) - base(x, z)).toFixed(2)} m at ${x}, ${z}`);
  }
});

test('the bridge crossing: the road level across, the river in a ravine 16 ft wide at the road and well below it', () => {
  const C = CROSSING, z0 = zRiver(C.x);
  // the banks' brinks (steeper than 45 degrees) along the road's line, about 16 ft apart
  const steep = []; for (let z = z0 - 8; z <= z0 + 8; z += 0.05) if (Math.abs(at(C.x, z + 0.05) - at(C.x, z)) / 0.05 > 1) steep.push(z);
  const gap = steep[steep.length - 1] - steep[0];
  assert.ok(Math.abs(gap - 4.9) < 0.35, `the gap ${gap.toFixed(2)} m`);
  const deck = at(C.x, z0 - 6), deck2 = at(C.x, z0 + 6), bed = at(C.x, z0);
  assert.ok(Math.abs(deck - deck2) < 0.3, 'both banks at one height');
  assert.ok(deck - bed > 4.5 && deck - bed < 6.5, `the water ${(deck - bed).toFixed(1)} m below the road`);
  // the road's line, both banks: level near the banks, no dip down to the water anywhere, and only easing up the
  // valley's sides beyond (no steeper than they were)
  for (const side of [-1, 1]) {
    let prev = at(C.x, z0 + side * 4);
    for (let d = 4; d <= 40; d += 1) {
      const h = at(C.x, z0 + side * d);
      if (d <= 14) assert.ok(Math.abs(h - deck) < 0.3, `the road ${(h - deck).toFixed(2)} off level at ${d} m`);
      assert.ok(h > deck - 0.3, `the road dips ${(deck - h).toFixed(2)} m at ${d} m`);
      assert.ok(Math.abs(h - prev) < 0.35, `the road steps ${(h - prev).toFixed(2)} at ${d} m`); prev = h;
    }
  }
  // the ravine's banks are steep along it too, wider away from the road
  const brink = (x) => L.crossing.halfTop(x - C.x);
  assert.ok(brink(C.x - 25) > brink(C.x) + 1.5 && brink(C.x + 25) > brink(C.x) + 1.5, 'wider up and down stream');
});

test('the ford beside the road: down to the river and up the far bank, gentle enough for a horse and a wagon', () => {
  const F = L.crossing.ford, pts = F.pts, C = CROSSING;
  let prev = null, low = Infinity, lowAt = null;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i], h = at(x, z); if (h < low) { low = h; lowAt = [x, z]; }
    if (prev) assert.ok(Math.abs(h - prev[2]) / Math.hypot(x - prev[0], z - prev[1]) < 0.33, `a ramp too steep at ${x.toFixed(1)}, ${z.toFixed(1)}`);
    prev = [x, z, h];
    // its floor wide enough for a wagon: level across ±2 m
    if (i > 2 && i < pts.length - 3 && Math.abs(z - zRiver(x)) > 4) {   // (in the river itself the ford is a sill across its bed)
      const [nx, nz] = pts[i + 1], dx = nx - x, dz = nz - z, l = Math.hypot(dx, dz) || 1;
      for (const k of [-2, 2]) { const hs = at(x - dz / l * k, z + dx / l * k); assert.ok(Math.abs(hs - h) < 0.35, `the lane's floor tilts ${(hs - h).toFixed(2)} across at ${x.toFixed(1)}, ${z.toFixed(1)}`); } }
  }
  assert.ok(Math.abs(lowAt[1] - zRiver(lowAt[0])) < 3.5, 'lowest where it crosses the river');
  assert.ok(low < L.crossing.bed + 0.6, 'down at the water');
  // it starts and ends on the ground round it (no step up or down onto it), on the road's side of the river each way
  for (const [x, z] of [pts[0], pts[pts.length - 1]]) assert.ok(Math.abs(at(x, z) - at(x + 6, z)) < 1.2, `its end meets the land at ${x}, ${z}`);
  assert.ok(pts[0][1] < zRiver(pts[0][0]) - 10 && pts[pts.length - 1][1] > zRiver(pts[pts.length - 1][0]) + 10, 'from one bank to the other');
  // beside the road: its crossing within 25 m of the road's, and clear of the bridge's banks (6 m+)
  const dx = Math.abs(lowAt[0] - C.x); assert.ok(dx > 8 && dx < 25, `the ford ${dx.toFixed(1)} m from the road`);
});

test("the engineer's camp's room: flat, beside the road on the town's bank, clear of the ford", () => {
  const h0 = at(CAMP.x, CAMP.z);
  for (let a = 0; a < 16; a++) for (const r of [2, 4, 6]) assert.ok(Math.abs(at(CAMP.x + Math.cos(a * 0.39) * r, CAMP.z + Math.sin(a * 0.39) * r) - h0) < 0.3, 'flat');
  assert.ok(CAMP.z < zRiver(CAMP.x) - 15, "on the town's (north) bank");
  assert.ok(Math.abs(CAMP.x - CROSSING.x) < 20, 'beside the road');
  for (const [x, z] of L.crossing.ford.pts) assert.ok(Math.hypot(x - CAMP.x, z - CAMP.z) > CAMP.r + 2, 'the ford keeps out of it');
});

test('the planting: the dock path behind the saloon down to the shore; the ford lane; the road up to the banks, the gap left bare', () => {
  const dock = stroke('dockpath'); assert.ok(dock && dock.kind === 25 && dock.mode === 'paint', 'a dirt path');
  const end = dock.pts[dock.pts.length - 1]; assert.ok(Math.hypot(end[0] + 4.4, end[1] + 93.3) < 5, 'ends at the dock spot on the shore');
  const saloon = layout.items.find((i) => i.kind === 'saloon'), sheriff = layout.items.find((i) => i.kind === 'sheriff');
  // it passes between the saloon and the sheriff's and behind them (the saloon's back faces the lake), clear of every building
  const back = (b, [x, z]) => { const a = b.rot * Math.PI / 180; return (x - b.x) * Math.sin(a) + (z - b.z) * Math.cos(a); };
  assert.ok(dock.pts.some((p) => back(saloon, p) < -modelFootprint(saloon).d / 2), 'behind the saloon');
  for (const b of layout.items.filter((i) => i.type === 'model')) {
    const { w, d } = modelFootprint(b), a = b.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    for (const [x, z] of dock.pts) { const lx = c * (x - b.x) - s * (z - b.z), lz = s * (x - b.x) + c * (z - b.z); assert.ok(!(Math.abs(lx) < w / 2 + 1 && Math.abs(lz) < d / 2 + 1), `the path runs into ${b.id}`); }
  }
  void sheriff;
  assert.ok(stroke('fordlane') && stroke('fordlane').kind === 25, 'the ford lane is dirt');
  const ids = planting.strokes.map((s) => s.id), gap = stroke('bridgegap');
  assert.equal(gap.kind, 26, 'the gap a no-path stroke');
  for (const id of ['landpath7', 'landpath8', 'landpath9', 'landpath10', 'bridgeroad']) assert.ok(ids.indexOf(id) < ids.indexOf('bridgegap'), id + ' drawn before the gap is rubbed out');
  const stub = stroke('bridgeroad'), tip = stub.pts[stub.pts.length - 1]; assert.ok(Math.abs(tip[1] - zRiver(tip[0])) < 3.5, 'the road runs up to the bank');
});

test('nothing built on the mill hill, at the bridge crossing or on the dock spot', () => {
  for (const it of layout.items.filter((i) => i.type === 'model')) {
    assert.ok(Math.hypot(it.x - HILL.x, it.z - HILL.z) > HILL.foot, it.id + ' on the mill hill');
    assert.ok(Math.hypot(it.x - CROSSING.x, it.z - CROSSING.z) > 60, it.id + ' at the crossing');
    assert.ok(Math.hypot(it.x + 4.4, it.z + 93.3) > 12, it.id + ' on the dock spot');
  }
  for (const b of BACKWOODS) {
    assert.ok(Math.hypot(b.x - CAMP.x, b.z - CAMP.z) > 40 && Math.hypot(b.x - CROSSING.x, b.z - CROSSING.z) > 40, 'a gang camp spot by the crossing');
    assert.ok(Math.hypot(b.x - HILL.x, b.z - HILL.z) > 60, 'a gang camp spot on the hill');
  }
  void FORD;
});
