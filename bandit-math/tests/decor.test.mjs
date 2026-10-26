// Tests for the town's decor (models/town/decor.json): how the game lays it over the shipped town
// (world/objects/decor.js applyDecor) and how the Town Lab writes it (labs/town/decorfile.js makeDecor, decorText):
// no decor leaves the town exactly as shipped, and what the lab writes the game reads back the same.
// Run with:  node --test bandit-math/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { applyDecor } from '../world/objects/decor.js';
import { normalisePlanting } from '../world/objects/planting.js';
import { makeDecor, decorText } from '../labs/town/decorfile.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
const layout = json('models/town/layout.json'), planting = json('models/town/planting.json');
const shipped = () => ({ layout: JSON.parse(JSON.stringify(layout)), planting: normalisePlanting(planting) });

test('no decor, or an empty one: the town as shipped', () => {
  const S = shipped();
  const none = applyDecor(S.layout, S.planting, null);
  assert.equal(none.layout, S.layout); assert.equal(none.planting, S.planting); assert.equal(none.merged.size, 0);
  const empty = applyDecor(S.layout, S.planting, { v: 1 });
  assert.deepEqual(empty.layout, S.layout); assert.deepEqual(empty.planting, S.planting); assert.equal(empty.merged.size, 0);
  assert.deepEqual(makeDecor(S, S), { v: 1 });
});

test('the shipped decor file reads, and names only things that exist', () => {
  const d = json('models/town/decor.json');
  assert.equal(d.v, 1);
  const ids = new Set(layout.items.map((it) => it.id));
  for (const id of Object.keys(d.moved || {})) assert.ok(ids.has(id), `moved: no ${id} in the layout`);
  for (const id of d.removed || []) assert.ok(ids.has(id), `removed: no ${id} in the layout`);
  const S = shipped(), D = applyDecor(S.layout, S.planting, d);
  assert.ok(D.layout.items.length >= S.layout.items.length - (d.removed || []).length);
});

test('applying leaves the shipped data alone', () => {
  const S = shipped(), before = JSON.stringify(S);
  applyDecor(S.layout, S.planting, { v: 1, moved: { cabin: { x: 1, z: 2 } }, removed: ['signpost1'], placed: [{ type: 'prop', kind: 'barrel', x: 0, z: 0, rot: 0 }], planting: { strokes: [{ mode: 'paint', kind: 8, r: 2, density: 4, size: 1, seed: 7, pts: [[0, 0]] }] } });
  assert.equal(JSON.stringify(S), before);
});

test('what the lab writes, the game reads back the same (and props are drawn together, lamps and buildings alone)', () => {
  const S = shipped(), fenceKind = 27;
  const decor = {
    v: 1,
    moved: { cabin: { x: 6.5, z: -220, rot: 270 }, saloon: { size: 14 }, home1: { level: false } },
    removed: ['picnicTable2'],
    placed: [
      { type: 'prop', kind: 'barrel', x: 1.5, z: -212, rot: 225 },
      { type: 'prop', kind: 'barrel', x: 2.5, z: -212.5, rot: 225, size: 1.2 },
      { type: 'prop', kind: 'lamp', x: -4, z: -200, rot: 0 },
      { type: 'model', kind: 'home', x: -40, z: -110, rot: 90, size: 8.2, level: true },
      { type: 'tree', kind: 'oak', x: 20, z: -240, rot: 0, size: 0.8 },
    ],
    roads: [{ mat: 'cobbles', w: 4, pts: [[0, -200], [10, -200]] }],
    planting: {
      strokes: [
        { mode: 'paint', kind: fenceKind, r: 6, density: 2, size: 1, seed: 11, pts: [[14, -228], [13, -215.5]] },
        { mode: 'paint', kind: 8, r: 2.5, density: 5, size: 1, seed: 12, pts: [[-4, -226], [-4, -214]] },
        { mode: 'clear', kind: 3, r: 2, density: 2, size: 1, seed: 13, pts: [[-6, -210]] },
      ],
      items: [{ kind: 10, x: -3, y: 0, z: -211, rx: 0, ry: 30, rz: 0, sx: 0.5, sy: 0.5, sz: 0.5, clear: 1 }],
      removed: [planting.strokes[3].id],
    },
  };
  const D = applyDecor(S.layout, S.planting, decor);
  const now = { layout: D.layout, planting: normalisePlanting(D.planting) };
  assert.deepEqual(makeDecor(S, now), decor);
  assert.deepEqual(JSON.parse(decorText(decor)), decor);
  const cab = D.layout.items.find((it) => it.id === 'cabin');
  assert.deepEqual([cab.x, cab.z, cab.rot, cab.size], [6.5, -220, 270, 6.6]);
  assert.ok(!D.layout.items.some((it) => it.id === 'picnicTable2'));
  assert.equal(D.layout.items.find((it) => it.id === 'home1').level, undefined);
  const kinds = (ids) => D.layout.items.filter((it) => ids.has(it.id)).map((it) => it.kind).sort();
  assert.deepEqual(kinds(D.merged), ['barrel', 'barrel']);
  assert.equal(D.planting.strokes.length, planting.strokes.length - 1 + 3);
  assert.equal(D.layout.roads.length, (layout.roads || []).length + 1);
});
