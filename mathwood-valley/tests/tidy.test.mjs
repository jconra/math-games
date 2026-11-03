// THE TOWN LAB'S SAVE TIDY-UP (labs/town/tidy.js): strokes that do nothing go, everything in use stays, and the town comes out
// the same: the shipped decor's whole planting worked out both ways, with the game's own code.
//   node --test tests/tidy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tidyStrokes, fencesStanding } from '../labs/town/tidy.js';
import { applyDecor } from '../world/objects/decor.js';
import { normalisePlanting, paintedPlants, keepProcedural } from '../world/objects/planting.js';
import { plantSorts, wildView, paintedView } from '../world/objects/plantviews.js';
import { KIND_INFO } from '../world/objects/growth.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), json = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
const n = KIND_INFO.length, PLANT = { LAWN_KIND: n, TREE0: n + 1, ROCK0: n + 5, APPLE: 100, PATH: n + 9, NOPATH: n + 10, FENCE: n + 11, STONE: n + 12, NOSTONE: n + 13, GATE: 98, ROCKS: 99 };
const SORT = plantSorts(PLANT);
let id = 0;
const st = (mode, kind, r, pts, more = {}) => ({ id: 's' + (++id), mode, kind, r, density: 3, size: 1, seed: 1000 + id, pts, ...more });
const P = (strokes) => ({ v: 1, procedural: true, strokes, items: [] });
const ids = (T) => T.dropped.map((s) => s.id).sort();

test('a fence drawn, taken down and drawn again: the first and its erase go, the last stays', () => {
  const a = st('paint', PLANT.FENCE, 1.5, [[0, 0], [20, 0]], { style: 'picket' }), er = st('clear', PLANT.FENCE, 3, [[-2, 0], [22, 0]]), b = st('paint', PLANT.FENCE, 1.5, [[0, 0], [20, 0]], { style: 'picket' });
  const T = tidyStrokes(P([a, er, b]), { PLANT });
  assert.deepEqual(ids(T), [a.id, er.id].sort());
  assert.equal(fencesStanding([a, er, b], PLANT), fencesStanding(T.strokes, PLANT));
});

test('an erase that still cuts a fence stays; one over no fence goes', () => {
  const f = st('paint', PLANT.FENCE, 1.5, [[0, 0], [30, 0]]), cut = st('clear', PLANT.FENCE, 2, [[15, -3], [15, 3]]), miss = st('clear', PLANT.FENCE, 2, [[15, 40], [15, 44]]);
  const T = tidyStrokes(P([f, cut, miss]), { PLANT });
  assert.deepEqual(ids(T), [miss.id]);
});

test('a gate on a fence stays; a gate taken away goes with its erase', () => {
  const f = st('paint', PLANT.FENCE, 1.5, [[0, 0], [30, 0]], { style: 'picket' }), g = st('paint', PLANT.GATE, 0.6, [[10, 0]]), g2 = st('paint', PLANT.GATE, 0.6, [[20, 0]]), er = st('clear', PLANT.GATE, 1, [[20, 0]]);
  const T = tidyStrokes(P([f, g, g2, er]), { PLANT });
  // (the erase takes the second gate and cuts nothing else of a gate's; a gate's clear is no fence's, so the fence stands whole)
  assert.deepEqual(ids(T), [g2.id, er.id].sort());
  assert.ok(T.strokes.includes(f) && T.strokes.includes(g));
});

test('plants: painted then rubbed out goes; the rubbing-out stays, for what grew by itself', () => {
  const k = 3, a = st('paint', k, 2, [[0, 0], [10, 0]]), er = st('clear', k, 4, [[-3, 0], [13, 0]]), keepMe = st('paint', k, 2, [[50, 0], [60, 0]]);
  const T = tidyStrokes(P([a, er, keepMe]), { PLANT });
  assert.deepEqual(ids(T), [a.id]);
  assert.ok(T.strokes.includes(er), 'the land\'s own plants stay away under it');
});

test('an erase wholly under another erase goes; one with its own ground stays', () => {
  const big = st('clear', 3, 6, [[0, 0], [20, 0]]), inside = st('clear', 3, 2, [[5, 0], [10, 0]]), own = st('clear', 3, 2, [[5, 30], [10, 30]]);
  const T = tidyStrokes(P([inside, big, own]), { PLANT });
  assert.deepEqual(ids(T), [inside.id]);
});

test('an erase that took away plants painted before it stays, even if a later paint covers part of it', () => {
  const p1 = st('paint', 1, 3, [[0, 0], [10, 0]]), er = st('clear', 1, 2, [[5, 0], [5, 1]]), p2 = st('paint', 1, 2, [[20, 0], [30, 0]]);
  const T = tidyStrokes(P([p1, er, p2]), { PLANT });
  assert.equal(T.dropped.length, 0);
});

test('the shipped strokes and the footpaths are never touched', () => {
  const ship = st('paint', 1, 2, [[0, 0], [5, 0]]), over = st('clear', 1, 4, [[-2, 0], [7, 0]]), path = st('paint', PLANT.PATH, 1, [[40, 0], [45, 0]]), path2 = st('paint', PLANT.PATH, 3, [[40, 0], [45, 0]]);
  const T = tidyStrokes(P([ship, over, path, path2]), { PLANT, keep: new Set([ship.id]) });
  assert.equal(T.dropped.length, 0);
});

// the whole planting as the game would lay it: every painted plant in each part, what grows by itself on a grid, the fences
function townOf(strokes, items, procedural) {
  const Q = { v: 1, procedural, strokes, items }, parts = [(k) => k < PLANT.LAWN_KIND, (k) => k === PLANT.LAWN_KIND, SORT.tree, SORT.rock], out = [];
  for (const w of parts) out.push(paintedPlants(paintedView(Q, w, SORT), null, {}).map((q) => `${q.sp},${q.x},${q.z},${q.scale},${q.yaw}`).sort().join(';'));
  for (const sort of ['plant', 'tree', 'rock']) { const V = wildView(Q, sort, SORT); let b = ''; for (let z = -320; z < -80; z += 0.5) for (let x = -200; x < 80; x += 0.5) b += keepProcedural(V, null, x, z) ? '1' : '0'; out.push(b); }
  out.push(fencesStanding(strokes, PLANT));
  return out;
}
test('the shipped decor: whatever tidying it would take out, the town comes out the same; and tidying twice takes nothing more', () => {
  const ship = normalisePlanting(json('models/town/planting.json')), D = applyDecor(json('models/town/layout.json'), ship, json('models/town/decor.json')), Q = normalisePlanting(D.planting);
  const keep = new Set(ship.strokes.map((s) => s.id)), T = tidyStrokes(Q, { PLANT, keep });
  const a = townOf(Q.strokes, Q.items, Q.procedural), b = townOf(T.strokes, Q.items, Q.procedural);
  a.forEach((x, i) => assert.ok(x === b[i], `part ${i} differs`));
  assert.ok(a[0].length > 1000 && a[1].length > 1000, 'plants were there to compare');
  assert.equal(tidyStrokes({ ...Q, strokes: T.strokes }, { PLANT, keep }).dropped.length, 0);
  // (every path stroke kept, in order: the land's bake is keyed by them)
  const paths = (L) => JSON.stringify(L.filter((s) => SORT.path(s.kind)).map((s) => [s.kind, s.r, s.pts]));
  assert.equal(paths(T.strokes), paths(Q.strokes));
});
