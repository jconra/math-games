// THE TOWN LAB'S SAVE MERGE (labs/town/merge.js): overlapping strokes of one sort made one, each line kept simple, and the
// ground coming out close: what differs small and at the edges, nothing new on a guarded spot, no footpath opened or closed,
// the fences exactly as they stood. Made-up layouts, then the shipped decor's whole planting.
//   node --test tests/merge.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mergeStrokes, makeGuard, groundOf, differ, gridOver, simplifyLine, edgeFor, MERGE, DIRT } from '../labs/town/merge.js';
import { tidyStrokes, fencesStanding } from '../labs/town/tidy.js';
import { applyDecor } from '../world/objects/decor.js';
import { normalisePlanting } from '../world/objects/planting.js';
import { KIND_INFO } from '../world/objects/growth.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), json = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
const n = KIND_INFO.length, PLANT = { LAWN_KIND: n, TREE0: n + 1, ROCK0: n + 5, APPLE: 100, PATH: n + 9, NOPATH: n + 10, FENCE: n + 11, STONE: n + 12, NOSTONE: n + 13, GATE: 98, ROCKS: 99 };
let id = 0;
const st = (mode, kind, r, pts, more = {}) => ({ id: 's' + (++id), mode, kind, r, density: 3, size: 1, seed: 1000 + id, pts, ...more });
const P = (strokes) => ({ v: 1, procedural: true, strokes, items: [] });
// the ground both ways over a box, and what differs (far looked for well past any allowance)
const compare = (a, b, box, guard = null) => { const G = gridOver(box, 0.2); return { G, d: differ(groundOf(a, G, { PLANT }), groundOf(b, G, { PLANT }), G, guard, 30) }; };
const changed = (p) => p.added + p.removed + p.thick;
// every part within the allowance for the brush (R: how far the widest brush works on the ground), a share of `base` m2
function close(d, R, base) {
  assert.ok(d.paths, 'no footpath opened or closed');
  for (const p of d.parts) {
    assert.ok(p.far <= edgeFor(R) + 0.2, `${p.name}: what differs reaches ${p.far.toFixed(2)} m from the edge`);
    assert.ok(changed(p) <= MERGE.share * base + 1e-9, `${p.name}: ${changed(p).toFixed(1)} m2 differs, more than ${(MERGE.share * base).toFixed(1)}`);
  }
}

test('a street painted as five overlapping footpath strokes comes out one stroke, the dirt close', () => {
  // (a hand painting a street a pass at a time, each pass wobbling a little: the game's maker's own example)
  const street = [0, 1.6, 3.2, 4.8, 6.4].map((z, k) => st('paint', PLANT.PATH, 3, [[0, z], [15, z + 0.3 * (k % 2)], [30, z + 0.2], [45, z]]));
  const M = mergeStrokes(P(street), { PLANT });
  assert.equal(M.strokes.length, 1);
  const { d } = compare(street, M.strokes, { x0: -10, z0: -10, x1: 55, z1: 20 });
  const dirt = d.parts.find((p) => p.name === 'dirt'), area = 45 * (6.4 + 2 * 3 * DIRT);
  close(d, 3 * DIRT, area);
  assert.ok(changed(dirt) < 0.02 * area, `the street's dirt barely changes (${changed(dirt).toFixed(1)} m2)`);
  // (and a second save finds nothing more to do)
  assert.equal(mergeStrokes(P(M.strokes), { PLANT }).merged.length, 0);
});

test('clicks in a row with Clear become one line; what grows by itself is kept back a little more between them, no further', () => {
  const dabs = [0, 4, 8, 12, 16, 20].map((x) => st('clear', 3, 3.5, [[x, 0.3 * (x % 3)]]));
  const M = mergeStrokes(P(dabs), { PLANT });
  assert.equal(M.strokes.length, 1);
  assert.ok(M.strokes[0].pts.length < 6 && M.strokes[0].mode === 'clear');
  const { d } = compare(dabs, M.strokes, { x0: -10, z0: -10, x1: 30, z1: 10 });
  for (const p of d.parts) assert.equal(p.removed, 0, `${p.name}: nothing comes back`);
  close(d, 3.5, 5 * Math.PI * 3.5 * 3.5 * 0.5);
});

test('a footpath stroke wholly under a wider one goes; the dirt is just as it was', () => {
  const wide = st('paint', PLANT.PATH, 2, [[0, 0], [0, -8]]), narrow = st('paint', PLANT.PATH, 1, [[0, -1], [0.2, -6]]);
  const M = mergeStrokes(P([wide, narrow]), { PLANT });
  assert.deepEqual(M.strokes.map((s) => s.id), [wide.id]);
  const { d } = compare([wide, narrow], M.strokes, { x0: -5, z0: -12, x1: 5, z1: 4 });
  assert.equal(d.area, 0);
});

test('a big stroke never swallows a small one of another width; strokes apart stay apart', () => {
  const big = st('paint', PLANT.PATH, 3.5, [[0, 0], [60, 0]]), spur = st('paint', PLANT.PATH, 2, [[20, 1.5], [20, 7]]), apart = st('paint', PLANT.PATH, 3.5, [[0, 30], [60, 30]]);
  const M = mergeStrokes(P([big, spur, apart]), { PLANT });
  assert.equal(M.strokes.length, 3);
  assert.deepEqual(M.strokes.map((s) => s.r), [3.5, 2, 3.5]);
});

test('lawn painted twice over the same ground stays two strokes: one would thin it where they cross', () => {
  const a = st('paint', PLANT.LAWN_KIND, 2, [[0, 0], [10, 0]]), b = st('paint', PLANT.LAWN_KIND, 2, [[7, 0], [17, 0]]);
  assert.equal(mergeStrokes(P([a, b]), { PLANT }).strokes.length, 2);
});

test('nothing new comes onto a guarded spot (a building, a prop, a placed plant, a door\'s front)', () => {
  // two footpath strokes end to end; joined, the dirt would fill the waist between them, where a prop stands
  const a = st('paint', PLANT.PATH, 2, [[0, 0], [10, 0]]), b = st('paint', PLANT.PATH, 2, [[12, 0], [22, 0]]);
  const free = mergeStrokes(P([a, b]), { PLANT });
  assert.equal(free.strokes.length, 1, 'with nothing in the way they join');
  const prop = { x: 11, z: 1.15, rot: 0, w: 1, d: 0.3 }, guard = makeGuard({ rects: [prop] });
  const M = mergeStrokes(P([a, b]), { PLANT, guard });
  const { d } = compare([a, b], M.strokes, { x0: -5, z0: -5, x1: 27, z1: 5 }, guard);
  for (const p of d.parts) assert.equal(p.taken, 0, `${p.name}: nothing new on the prop`);
  // a door: whatever the brush rubbed out in front of it stays rubbed out (a Clear there may not shrink)
  const er = [st('clear', 3, 2, [[0, 0]]), st('clear', 3, 2, [[3, 0]]), st('clear', 3, 2, [[6, 0]])];
  const door = makeGuard({ doors: [{ x: 3, z: -3, ox: 0, oz: 1, half: 0.6 }] }), D = mergeStrokes(P(er), { PLANT, guard: door });
  const c = compare(er, D.strokes, { x0: -5, z0: -5, x1: 11, z1: 5 }, door).d;
  for (const p of c.parts) assert.equal(p.door, 0, `${p.name}: nothing taken from in front of the door`);
});

test('no footpath is opened or closed: a short narrow link between two paths stays, though leaving it out changes little ground', () => {
  // two paths 2.6 m apart end to end (their dirt doesn't meet) and a narrow stroke across the gap joining them
  const a = st('paint', PLANT.PATH, 2, [[0, 0], [10, 0]]), b = st('paint', PLANT.PATH, 2, [[12.6, 0], [22, 0]]), link = st('paint', PLANT.PATH, 1, [[9, 0], [13.6, 0]]);
  const box = { x0: -5, z0: -5, x1: 27, z1: 5 }, gap = compare([a, b], [a, b, link], box).d;
  assert.ok(!gap.paths && gap.area < 2, 'without the link: two paths, from under 2 m2 of dirt');
  const M = mergeStrokes(P([a, b, link]), { PLANT }), { d } = compare([a, b, link], M.strokes, box);
  assert.ok(d.paths, 'still one path');
  const G = gridOver(box, 0.2), dirt = groundOf(M.strokes, G, { PLANT }).dirt, mid = (z) => dirt[Math.floor((z - G.z0) / G.s) * G.nx + Math.floor((11.3 - G.x0) / G.s)];
  assert.equal(mid(0), 1, 'the gap still has its dirt');
});

test('the fences\' Clears join only with every fence and gate standing exactly as before; fences and gates drawn are never touched', () => {
  const f = st('paint', PLANT.FENCE, 1.5, [[0, 0], [30, 0]], { style: 'picket' }), g = st('paint', PLANT.GATE, 0.6, [[25, 0]]);
  const c1 = st('clear', PLANT.FENCE, 1.5, [[4, -2], [4, -0.2], [4.1, 0.1], [4, 2]]), c2 = st('clear', PLANT.FENCE, 1.5, [[5.5, -2], [5.5, 2]]);
  const all = [f, g, c1, c2], M = mergeStrokes(P(all), { PLANT });
  assert.equal(fencesStanding(M.strokes, PLANT), fencesStanding(all, PLANT));
  assert.ok(M.strokes.includes(f) && M.strokes.includes(g), 'the fence and its gate are the very same strokes');
});

test('the shipped strokes are never touched; lines keep only the points they need', () => {
  const ship = st('paint', PLANT.PATH, 2, [[0, 0], [5, 0], [10, 0]]), over = st('paint', PLANT.PATH, 2, [[0, 0.2], [10, 0.2]]);
  const M = mergeStrokes(P([ship, over]), { PLANT, keep: new Set([ship.id]) });
  assert.ok(M.strokes.includes(ship));
  const wobbly = Array.from({ length: 41 }, (_, k) => [k * 0.5, Math.round(Math.sin(k) * 2) / 100]);
  assert.equal(simplifyLine(wobbly, 0.05).length, 2);
  assert.deepEqual(simplifyLine(simplifyLine(wobbly, 0.02), 0.02), simplifyLine(wobbly, 0.02), 'simplifying again changes nothing');
});

test('the shipped decor: fewer strokes, everything within the allowance, the fences the same, and a second save finds nothing more', () => {
  const ship = normalisePlanting(json('models/town/planting.json')), D = applyDecor(json('models/town/layout.json'), ship, json('models/town/decor.json')), Q = normalisePlanting(D.planting);
  const keep = new Set(ship.strokes.map((s) => s.id)), T = tidyStrokes(Q, { PLANT, keep }), M = mergeStrokes({ ...Q, strokes: T.strokes }, { PLANT, keep });
  assert.ok(M.strokes.length <= T.strokes.length);
  assert.equal(fencesStanding(M.strokes, PLANT), fencesStanding(Q.strokes, PLANT));
  assert.deepEqual(M.strokes.filter((s) => keep.has(s.id)), T.strokes.filter((s) => keep.has(s.id)), 'the shipped strokes, the very same, in order');
  for (const m of M.merged) {
    assert.ok(m.d.paths, 'no footpath opened or closed');
    for (const p of m.d.parts) assert.ok(p.far <= edgeFor(26) + 0.2, `${m.what}: ${p.name} reaches ${p.far} m from its edge`);
  }
  // (the whole town, before and after: the paths' patches the same)
  const { d } = compare(Q.strokes, M.strokes, { x0: -120, z0: -300, x1: 60, z1: -80 });
  assert.ok(d.paths);
  assert.equal(mergeStrokes({ ...Q, strokes: M.strokes }, { PLANT, keep }).merged.length, 0);
});
