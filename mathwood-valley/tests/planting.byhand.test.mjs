// What is planted by hand goes where it was put: a placed plant's cleared circle keeps out what grows by itself, not paint.
import test from 'node:test';
import assert from 'node:assert/strict';
import { paintedPlants, keepProcedural } from '../world/objects/planting.js';

const stroke = { id: 's1', mode: 'paint', kind: 16, r: 4, density: 6, size: 1, seed: 7, pts: [[-5, 0], [5, 0]] };
const item = { id: 'i1', kind: 3, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1, clear: 3 };
const near = (list) => list.filter((p) => Math.hypot(p.x, p.z) < 3).length;

test('a placed plant does not clear the paint around it', () => {
  const alone = paintedPlants({ procedural: true, strokes: [stroke], items: [] }), withIt = paintedPlants({ procedural: true, strokes: [stroke], items: [item] });
  assert.ok(near(alone) > 20, 'the stroke grows there');
  assert.equal(near(withIt), near(alone));
});
test('a later clear stroke still takes the paint away', () => {
  const list = paintedPlants({ procedural: true, strokes: [stroke, { ...stroke, id: 's2', mode: 'clear', pts: [[0, 0]], r: 3 }], items: [] });
  assert.equal(near(list), 0);
});
test("a placed plant still keeps out what grows by itself", () => {
  assert.equal(keepProcedural({ procedural: true, strokes: [], items: [item] }, null, 1, 0), false);
  assert.equal(keepProcedural({ procedural: true, strokes: [], items: [item] }, null, 10, 10), true);
});
