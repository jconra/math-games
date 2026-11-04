// Tests for the valley's ends (world/objects/ends.js): the band of woods at each end, the east's a copy of the west's,
// the way round from one to the other, where riders may go there, the mountains eased down, and the ground fog.
// Run with:  node --test mathwood-valley/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { ENDS, alias, canon, walkable, wrapOf, fogShare, fogSeen, fogHides, shapeEnd, floorCells } = await import('../world/objects/ends.js');
const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const N = 512, TEX = ENDS.SIZE / N;

test('the move lands on the land grid and its pictures exactly (a cell for a cell, a pixel for a pixel)', () => {
  for (const v of [ENDS.P, ENDS.Q]) { assert.equal(v / TEX, Math.round(v / TEX), v + ' in cells'); assert.equal(v / (ENDS.SIZE / 2048), Math.round(v / (ENDS.SIZE / 2048)), v + ' in pixels'); }
  assert.equal(ENDS.P + ENDS.band, ENDS.SIZE, 'the two bands meet the land edges');
  const c = floorCells(N, TEX); assert.equal(c.band + c.di, N); assert.equal(c.dj, ENDS.Q / TEX);
});

test('the wrap lines run down the middle of the bands, and going round lands on the other line', () => {
  assert.equal(ENDS.wrap, ENDS.SIZE / 2 - ENDS.band / 2);
  const e = wrapOf(ENDS.wrap + 0.3), w = wrapOf(-ENDS.wrap - 0.3);
  assert.ok(Math.abs(ENDS.wrap + 0.3 + e.dx - (-ENDS.wrap + 0.3)) < 1e-9, 'east past its line comes out just inside the west line');
  assert.ok(Math.abs(-ENDS.wrap - 0.3 + w.dx - (ENDS.wrap - 0.3)) < 1e-9, 'west past its line comes out just inside the east line');
  assert.equal(e.dx, -w.dx); assert.equal(e.dy, -w.dy); assert.equal(e.dz, -w.dz);
  assert.equal(wrapOf(0), null); assert.equal(wrapOf(ENDS.wrap - 0.01), null); assert.equal(wrapOf(-ENDS.wrap + 0.01), null);
});

test('the east band shows the west band, moved; nothing else is aliased', () => {
  assert.deepEqual(alias(700, 100), [700 - ENDS.P, 100 - ENDS.Q]);
  assert.equal(alias(640, 100), null, 'the east land inward of the band is its own');
  assert.equal(alias(700, ENDS.copyZ0 - 1), null, 'the east band north of what the west band can give is its own');
  assert.equal(alias(-700, 0), null, 'the west band is the land as made');
  assert.deepEqual(canon(10, 20), [10, 20]);
  // every spot in the west band lands in the east band's copy
  for (let x = -799; x < -650; x += 7) for (let z = -799; z < ENDS.SIZE / 2 - ENDS.Q; z += 13) assert.deepEqual(alias(x + ENDS.P, z + ENDS.Q), [x, z]);
});

test('where a rider may go is the same at both ends of the band, and wide open away from it', () => {
  for (let x = -799; x <= -651; x += 5) for (let z = -799; z <= 240; z += 5) assert.equal(walkable(x, z), walkable(x + ENDS.P, z + ENDS.Q), `${x}, ${z}`);
  for (let x = -ENDS.wall + 1; x < ENDS.wall; x += 37) for (let z = -ENDS.edgeZ; z <= ENDS.edgeZ; z += 23) assert.ok(walkable(x, z));
  for (let x = -ENDS.shape.from + 1; x < ENDS.shape.from; x += 37) for (let z = -790; z <= 790; z += 23) assert.ok(walkable(x, z), 'the middle of the valley as it was');
  assert.ok(!walkable(600, -770) && !walkable(-500, 775), 'the corners near the ends kept off the land\'s north and south edges');
  // the way round only happens where a rider can be: along the wrap line, open only on the band's floor
  let open = 0; for (let z = -800; z <= 800; z += 1) if (walkable(-ENDS.wrap, z)) open++;
  assert.ok(open >= 800 && open <= 900, 'the band is open across ' + open + ' m');
  assert.ok(!walkable(-ENDS.wrap, ENDS.SIZE / 2 - ENDS.Q + 1), 'nothing the east has no land for');
});

test('the mountains are eased down toward the band, never raised, the valley floor kept', () => {
  for (const x of [-800, -700, -600, -500, -400, 300, 400, 500, 600, 700, 800]) for (const h of [-60, -31, -10, 20, 60, 120, 300, 540]) {
    const s = shapeEnd(h, x); assert.ok(s <= h + 1e-9, `raised ${h} at ${x}`);
    const base = ENDS.shape.floor + (x > 0 ? ENDS.DY : 0);
    if (h <= base) assert.equal(s, h, 'below the floor: as it was');
    if (Math.abs(x) >= ENDS.shape.to) assert.ok(s <= base + ENDS.shape.cap + 1e-9, `${h} at ${x} still a mountain: ${s}`);
    if (Math.abs(x) <= ENDS.shape.from) assert.equal(s, h, 'the middle of the valley as it was');
  }
  // the camps' and loot spots' ground, on the floor near the band, barely moves
  for (const [x, h] of [[-545, -29.3], [535, 15.4], [505, 9.9]]) assert.ok(Math.abs(shapeEnd(h, x) - h) < 0.5);
});

test('the ground fog: none out in the valley, the same at the two ends of the band, low', () => {
  assert.equal(fogShare(0), 0); assert.equal(fogShare(500), 0); assert.equal(fogShare(700), 1); assert.equal(fogShare(-700), 1);
  assert.equal(fogSeen(400), 0, 'from the open valley it does not show'); assert.equal(fogSeen(ENDS.wrap), 1);
  const at = (x, y, z) => ({ x, y, z });
  // seen from the town toward the end, nothing
  assert.equal(fogHides(at(0, 2, -200), at(700, 1, 300), 2, 1), 0);
  // in the band: a thing on the ground 60 m off mostly hidden, the same both ends
  const w = fogHides(at(-700, 2, -200), at(-760, 1, -200), 2, 1), e = fogHides(at(-700 + ENDS.P, 2 + ENDS.DY, -200 + ENDS.Q), at(-760 + ENDS.P, 1 + ENDS.DY, -200 + ENDS.Q), 2, 1);
  assert.ok(w > 0.75, 'on the ground 60 m off: ' + w); assert.ok(Math.abs(w - e) < 1e-9);
  // low: a tree's crown 20 m up barely hidden; a few metres up it thins away
  const crown = fogHides(at(-700, 2, -200), at(-760, 20, -200), 2, 20);
  assert.ok(crown < w * 0.5, 'a crown 20 m up: ' + crown);
  // past the land's edge it goes on, as if the woods did: the sky low beyond the edge is lost in it as the woods would be
  const edge = fogHides(at(-725, 2, -200), at(-800, 0, -200), 2, 0), beyond = fogHides(at(-725, 2, -200), at(-2700, 2, -200), 2, 2);
  assert.ok(edge > 0.85 && beyond > 0.99, `the land's edge from the wrap line ${edge}, beyond it ${beyond}`);
});

test('the shader and the game add the fog up the same way', () => {
  const glsl = read('world/objects/ends.js');
  for (const k of ['fogEndHalf', 'fogEndSpan', 'fogEndDepth', 'fogEnd0.w * fogEnd1.w']) assert.ok(glsl.includes(k), k);
  const valley = read('world/valley.js');
  assert.ok(valley.includes('fogEndDepth(cameraPosition, fogW, cameraPosition.y - fogEnd1.y, fogW.y - vFogFoot)'), 'the valley reads the fog over each thing\'s foot');
  assert.ok(!/fogBank/.test(valley), 'the old bank of mist is gone');
});
