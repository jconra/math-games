// Tests for the world's own files (the parts that don't need a browser): the western town's layout and planting
// (models/town/layout.json, planting.json), its buildings' data and the ground pads they stand on
// (world/objects/townAssets.js), the ground plants' sizes, wild stands and grass tufts (world/objects/growth.js), the
// land's bake list (models/town/land/land.json), and the copied valley code (world/): every model and picture found from
// the game's folder, every import there to be found.
// Run with:  node --test mathwood-valley/tests/*.test.mjs
// (The world itself, drawn, is checked by tests/world.html and the rigs that open it on the graphics card.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { TOWN_ASSETS, modelFootprint, levelPads } from '../world/objects/townAssets.js';
import { KIND_INFO, GROW_DEFAULTS, COVER_DEFAULTS, defaultKinds, wildAt, lawnSpots } from '../world/objects/growth.js';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(join(GAME, p), 'utf8'));
const layout = json('models/town/layout.json'), planting = json('models/town/planting.json');
const G = layout.game || {};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lengthOf = (pts) => pts.slice(1).reduce((s, p, i) => s + dist(p, pts[i]), 0);

const SIX = ['cabin', 'generalStore', 'saloon', 'sheriff', 'stable', 'stage'];
const B = layout.items.filter((i) => i.type === 'model');
// a building's frame: its footprint's corners and a spot n metres out in front of its middle (rot: degrees, the way its
// front faces; facing (sin, cos))
const frame = (b) => { const { w, d } = modelFootprint(b), a = b.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const at = (lx, lz) => [b.x + c * lx + s * lz, b.z - s * lx + c * lz], local = ([x, z]) => [c * (x - b.x) - s * (z - b.z), s * (x - b.x) + c * (z - b.z)];
  return { w, d, at, local, face: [s, c], inside: (p, pad = 0) => { const [lx, lz] = local(p); return Math.abs(lx) < w / 2 + pad && Math.abs(lz) < d / 2 + pad; } }; };

test('the town is the western one: the six buildings, once each, the townsfolk\'s homes, and nothing of the old town', () => {
  const models = B.filter((i) => i.kind !== 'home').map((i) => i.kind).sort();
  assert.deepEqual(models, SIX);
  assert.deepEqual(Object.keys(TOWN_ASSETS).filter((k) => !TOWN_ASSETS[k].code).sort(), [...SIX, 'home'].sort(), 'TOWN_ASSETS lists only the western buildings and the homes (and those built in code only)');
  for (const k of new Set(B.map((i) => i.kind))) { const f = TOWN_ASSETS[k].file || k; assert.ok(existsSync(join(GAME, `models/town/${f}.glb`)) && existsSync(join(GAME, `models/town/lo/${f}.glb`)), k + ': both sizes of model'); }
  const props = layout.items.filter((i) => i.type === 'prop').map((i) => i.kind);
  for (const no of ['lamp', 'valehexGlobe', 'stateMap', 'obelisk', 'easel']) assert.ok(!props.includes(no), 'no ' + no);
  assert.equal((layout.roads || []).length, 0, 'no paved roads');
  for (const it of B) assert.equal(it.level, true, it.kind + ' stands on a levelled pad');
});

// a .glb's own bounds (its meshes' points, through each node's place; the Tripo models are one mesh each)
function glbBounds(file) {
  const buf = readFileSync(join(GAME, file)), len = buf.readUInt32LE(12), J = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const n of J.nodes) { if (n.mesh === undefined) continue; const tr = n.translation || [0, 0, 0], sc = n.scale || [1, 1, 1];
    assert.ok(!n.rotation && !n.matrix, file + ': a node turned (not measured here)');
    for (const pr of J.meshes[n.mesh].primitives) { const A = J.accessors[pr.attributes.POSITION]; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], A.min[k] * sc[k] + tr[k]); mx[k] = Math.max(mx[k], A.max[k] * sc[k] + tr[k]); } } }
  return mx.map((v, k) => v - mn[k]);
}

test("each building's box is its model's own size (the store's measured once stood upright)", () => {
  for (const [k, A] of Object.entries(TOWN_ASSETS)) if (!A.code) for (const f of [`models/town/${A.file || k}.glb`, `models/town/lo/${A.file || k}.glb`]) {
    const s = glbBounds(f);
    if (!A.tilt) { for (let i = 0; i < 3; i++) assert.ok(Math.abs(s[i] - A.box[i]) < 0.004, `${f}: box ${A.box} against its own ${s.map((v) => v.toFixed(3))}`); continue; }
    // turned upright about x: the width is the same; leaning, it was taller and deeper than it stands
    assert.ok(Math.abs(s[0] - A.box[0]) < 0.004, f + ' width');
    assert.ok(A.box[1] < s[1] && A.box[1] > s[1] * 0.95, `${f}: upright height ${A.box[1]} under its leaning ${s[1].toFixed(3)}`);
    assert.ok(A.box[2] <= s[2] + 0.001 && A.box[2] > s[2] * 0.95, f + ' depth');
  }
});

test('the general store stands on its posts: turned upright a few degrees and let down a little; the cabin and stable let down a hair; the rest as they come', () => {
  const S = TOWN_ASSETS.generalStore;
  assert.ok(S.tilt > 0 && S.tilt <= 5, 'a few degrees, front down: ' + S.tilt);
  assert.ok(S.sink > 0 && S.sink < 0.03, 'its posts reach the ground (a few centimetres in): ' + S.sink);
  for (const k of ['cabin', 'stable']) assert.ok(!TOWN_ASSETS[k].tilt && TOWN_ASSETS[k].sink > 0 && TOWN_ASSETS[k].sink < 0.01, k + ' let down a few centimetres, no more');
  for (const [k, A] of Object.entries(TOWN_ASSETS)) if (!['generalStore', 'cabin', 'stable', 'home'].includes(k)) assert.ok(!A.tilt && !A.sink, k + ' stands as it came');
  assert.deepEqual([TOWN_ASSETS.home.file, TOWN_ASSETS.home.box, TOWN_ASSETS.home.front, TOWN_ASSETS.home.sink], ['cabin', TOWN_ASSETS.cabin.box, TOWN_ASSETS.cabin.front, TOWN_ASSETS.cabin.sink], 'a home is the town cabin, standing as it does');
});

test('the buildings face the square and stand round it, not on each other', () => {
  const sq = [G.square.x, G.square.z], B = layout.items.filter((i) => i.type === 'model'), SQ = B.filter((i) => i.kind !== 'home');   // (the homes stand behind the row: their own test)
  for (const b of SQ) {
    const r = b.rot * Math.PI / 180, face = [Math.sin(r), Math.cos(r)], to = [sq[0] - b.x, sq[1] - b.z], L = Math.hypot(...to);
    assert.ok(L > G.square.r * 0.8 && L < 45, `${b.kind} ${L.toFixed(1)} m from the square's middle`);
    assert.ok((face[0] * to[0] + face[1] * to[1]) / L > 0.5, `${b.kind} faces the square`);
  }
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const d = dist([B[i].x, B[i].z], [B[j].x, B[j].z]); assert.ok(d > (B[i].size + B[j].size) / 2 * 0.95, `${B[i].kind} and ${B[j].kind} ${d.toFixed(1)} m apart`);
  }
  assert.ok(dist([G.spawn.x, G.spawn.z], sq) < G.square.r, 'the spawn is in the square');
});

test('the saloon stands in the row with the sheriff and the store; the stage beside it faces its crowd', () => {
  const by = Object.fromEntries(B.map((b) => [b.kind, b])), F = frame(by.sheriff);
  // the row: the saloon faces the way the sheriff's office and the store do, its front in line with theirs
  assert.equal(by.saloon.rot, by.sheriff.rot); assert.equal(by.generalStore.rot, by.sheriff.rot);
  const frontOf = (b) => { const f = frame(b), [x, z] = f.at(0, f.d / 2); return (x - by.sheriff.x) * F.face[0] + (z - by.sheriff.z) * F.face[1]; };
  assert.ok(Math.abs(frontOf(by.saloon) - frontOf(by.sheriff)) < 1, `the saloon's front ${(frontOf(by.saloon) - frontOf(by.sheriff)).toFixed(2)} m from the sheriff's line`);
  assert.ok(dist([by.saloon.x, by.saloon.z], [by.sheriff.x, by.sheriff.z]) < 20, 'next to the sheriff');
  // the saloon is the town's biggest after the stable: two storeys
  assert.ok(modelFootprint(by.saloon).h > modelFootprint(by.sheriff).h * 1.15, 'taller than the one-storey fronts');
  // the stage: near the saloon, its crowd's patch in front of it, trodden dirt, in no building
  const C = G.crowd, S = frame(by.stage); assert.ok(C, 'the layout names the crowd patch');
  assert.ok(dist([by.stage.x, by.stage.z], [by.saloon.x, by.saloon.z]) < 22, 'the stage is near the saloon');
  const out = (C.x - by.stage.x) * S.face[0] + (C.z - by.stage.z) * S.face[1];
  assert.ok(out > S.d / 2 && out < S.d / 2 + 10, `the crowd stands in front of the stage (${out.toFixed(1)} m out)`);
  for (const b of B) assert.ok(!frame(b).inside([C.x, C.z], C.r * 0.5), 'the crowd patch is clear of the ' + b.kind);
  const dirt = planting.strokes.find((s) => s.id === 'crowd');
  assert.ok(dirt && dirt.kind === 25 && dist(dirt.pts[0], [C.x, C.z]) < 0.01 && Math.abs(dirt.r * 0.55 - C.r) < 0.05, 'a patch of footpath dirt C.r round');
});

test("the townsfolk's homes: a few, behind the main row toward the lake, clear of the player's cabin, facing a lane", () => {
  const H = B.filter((i) => i.kind === 'home'), by = Object.fromEntries(B.map((b) => [b.id, b])), F = frame(by.sheriff);
  assert.ok(H.length >= 3 && H.length <= 6, H.length + ' homes');
  const sq = [G.square.x, G.square.z], ahead = (p) => (p[0] - by.sheriff.x) * F.face[0] + (p[1] - by.sheriff.z) * F.face[1];
  for (const h of H) {
    assert.ok(ahead([h.x, h.z]) < ahead(sq) - 15, `${h.id} stands behind the row (the square is in front of it)`);
    assert.ok(h.z > by.saloon.z + 8, `${h.id} is past the saloon toward the lake`);
    assert.ok(dist([h.x, h.z], [by.cabin.x, by.cabin.z]) > 40, `${h.id} is well clear of the player's cabin`);
    assert.ok(h.size >= 7.5 && h.size <= 9.5, `${h.id} a cabin's size`);
    assert.equal(h.level, true);
  }
  // the lane: every home's door faces the line between them (west ones east, east ones west), a few metres of lane between
  const mid = H.reduce((s, h) => s + h.x, 0) / H.length;
  for (const h of H) { const f = frame(h), door = f.at(0, f.d / 2 + 1.5); assert.ok(Math.abs(door[0] - mid) < Math.abs(h.x - mid), `${h.id}'s door faces the lane`); }
});

test('every door is clear: out of every other building, off the fences, and the trail runs clear of them all', () => {
  const rails = planting.strokes.filter((s) => s.kind === 27).flatMap((s) => s.pts.slice(1).map((p, i) => [s.pts[i], p]));
  const segD = ([x, z], [[ax, az], [bx, bz]]) => { const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1))); return Math.hypot(ax + vx * t - x, az + vz * t - z); };
  for (const b of B) {
    const f = frame(b), door = f.at(0, f.d / 2 + 1.5);
    for (const o of B) if (o !== b) assert.ok(!frame(o).inside(door, 1), `${b.kind}'s door is clear of the ${o.kind}`);
    for (const r of rails) assert.ok(segD(door, r) > 1, `${b.kind}'s door is clear of a fence`);
    // and the way out from it: 4 m on, nothing built
    for (const o of B) if (o !== b) assert.ok(!frame(o).inside(f.at(0, f.d / 2 + 5), 0.5), `${b.kind}'s way out is clear of the ${o.kind}`);
  }
  // no two buildings closer than 3 m (an alley a horse goes down): points round each, 1.5 m out, in no other 1.5 m out
  for (const b of B) { const f = frame(b);
    for (let u = -1; u <= 1; u += 0.1) for (const [lx, lz] of [[u * (f.w / 2 + 1.5), f.d / 2 + 1.5], [u * (f.w / 2 + 1.5), -f.d / 2 - 1.5], [f.w / 2 + 1.5, u * (f.d / 2 + 1.5)], [-f.w / 2 - 1.5, u * (f.d / 2 + 1.5)]])
      for (const o of B) if (o !== b) assert.ok(!frame(o).inside(f.at(lx, lz), 1.5), `${b.kind} and ${o.kind} at least 3 m apart`); }
  const trail = planting.strokes.find((s) => s.id === 'trail'), west = planting.strokes.find((s) => s.id === 'westtrail');
  for (const s of [trail, west]) for (const p of s.pts) for (const b of B) assert.ok(!frame(b).inside(p, 2.5), `the ${s.id} passes clear of the ${b.kind}`);
});

// THE GROUND PADS on a made-up sloping, bumpy land (the valley's grid: 512 cells over 1600 m): the ground under every wall
// and corner, measured as the valley does (between the four nearest cell middles), on the building's own floor
const N = 512, SIZE = 1600, TEX = SIZE / N;
const heightAt = (H, x, z) => { const fx = Math.min(N - 1.001, Math.max(0, (x + SIZE / 2) / TEX - 0.5)), fz = Math.min(N - 1.001, Math.max(0, (z + SIZE / 2) / TEX - 0.5)), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * N + i;
  return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + N] * (1 - u) + H[k + N + 1] * u) * v; };
function padsOn(lay) {
  const Hpre = new Float32Array(N * N), H = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i + 0.5) * TEX - SIZE / 2, z = (j + 0.5) * TEX - SIZE / 2; Hpre[j * N + i] = 0.04 * x - 0.03 * z + 0.6 * Math.sin(x / 7) * Math.cos(z / 9); }
  levelPads(H, Hpre, lay, N, SIZE, TEX); return { H, Hpre };
}

test('the ground pads: every wall and corner of every building on its floor, on a sloping, bumpy land', () => {
  const { H } = padsOn(layout);
  for (const b of B) { const f = frame(b), floor = heightAt(H, b.x, b.z);
    for (let u = -1; u <= 1; u += 0.25) for (const [lx, lz] of [[u * f.w / 2, f.d / 2], [u * f.w / 2, -f.d / 2], [f.w / 2, u * f.d / 2], [-f.w / 2, u * f.d / 2]]) {
      const [x, z] = f.at(lx, lz), off = heightAt(H, x, z) - floor; assert.ok(Math.abs(off) < 0.005, `${b.kind}: ground ${off.toFixed(3)} m off its floor at (${lx.toFixed(1)}, ${lz.toFixed(1)})`); }
    // and the steps' landing, a metre and a half out in front of the door
    const [dx, dz] = f.at(0, f.d / 2 + 1.5); assert.ok(Math.abs(heightAt(H, dx, dz) - floor) < 0.005, b.kind + ': flat at its door');
  }
});

test('the ground pads: close neighbours share one height, a building on its own keeps its own, and away from the town the land is as it was', () => {
  const one = (x, z, rot = 0) => ({ type: 'model', kind: 'sheriff', x, z, rot, size: 11.7, level: true });
  // two buildings with a 4 m alley between (their flat zones meet) and a third far off
  const lay = { items: [one(0, 0), one(14, 0), one(120, 60)] }, { H, Hpre } = padsOn(lay);
  assert.ok(Math.abs(heightAt(H, 0, 0) - heightAt(H, 14, 0)) < 1e-4, 'the alley pair on one height');
  for (let x = 6; x <= 8; x += 0.5) assert.ok(Math.abs(heightAt(H, x, 0) - heightAt(H, 0, 0)) < 0.005, 'the alley flat at ' + x);
  const avg = (b) => { let s = 0, n = 0; const f = frame(b); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i + 0.5) * TEX - SIZE / 2, z = (j + 0.5) * TEX - SIZE / 2, [lx, lz] = f.local([x, z]);
    if (Math.abs(lx) <= f.w / 2 + 1 && Math.abs(lz) <= f.d / 2 + 1) { s += Hpre[j * N + i]; n++; } } return { s, n }; };
  const lone = avg(lay.items[2]); assert.ok(Math.abs(heightAt(H, 120, 60) - lone.s / lone.n) < 1e-4, 'the lone one at the average of its own ground');
  const a = avg(lay.items[0]), b = avg(lay.items[1]); assert.ok(Math.abs(heightAt(H, 0, 0) - (a.s + b.s) / (a.n + b.n)) < 1e-4, "the pair at the average of both their grounds");
  for (const [x, z] of [[60, 0], [-40, -40], [120, 100]]) assert.equal(heightAt(H, x, z), heightAt(Hpre, x, z), `the land untouched at (${x}, ${z})`);
});

// THE GROUND PLANTS: each kind's height as it stands (its height x the plants' size x its own size, less its root clump
// under the ground), the middle of its spread (each plant 0.7-1.3 of it, a little more on damp ground, less on dry)
const PLANT_H = Object.fromEntries(KIND_INFO.map((K, k) => [K.name, K.height * COVER_DEFAULTS.size * defaultKinds()[k].size * (1 - K.sink)]));

test('the ground plants stand at life size beside a 1.8 m person: knee-high grass, cattails over a head, the paintbrush as it was', () => {
  for (const n of ['tall seed grass', 'feather grass', 'broad-blade grass', 'bunchgrass']) assert.ok(PLANT_H[n] >= 0.45 && PLANT_H[n] <= 0.8, `${n}: ${PLANT_H[n].toFixed(2)} m`);
  assert.ok(PLANT_H.cattails >= 1.1 && PLANT_H.cattails * 1.3 <= 1.85, `cattails ${PLANT_H.cattails.toFixed(2)} m (more by the water, where they grow)`);
  assert.ok(Math.abs(PLANT_H.paintbrush - 0.5 * 2.6 * 1.15 * 0.97) < 1e-9, 'the paintbrush as it was set');
  for (const n of ['dandelion', 'wild strawberry', 'violets', 'snowdrops', 'marsh marigold', 'columbine']) assert.ok(PLANT_H[n] < 1, `${n}: ${PLANT_H[n].toFixed(2)} m, under a metre`);
  for (const n of ['yucca', 'sprig shrub', 'spruce sapling']) assert.ok(PLANT_H[n] > 1.2 && PLANT_H[n] < 2.5, `${n}: ${PLANT_H[n].toFixed(2)} m`);
  for (const [n, h] of Object.entries(PLANT_H)) assert.ok(h < 2.5, n + ' no taller than a rider');
});

test('wild stands: here and there the tall grasses grow person-tall, most by the water and at the trees, few out in the open', () => {
  for (const n of ['tall seed grass', 'feather grass', 'broad-blade grass']) { const K = KIND_INFO.find((k) => k.name === n);
    assert.ok(PLANT_H[n] * K.wild >= 1.4 && PLANT_H[n] * K.wild <= 2.2, `${n} in a stand: ${(PLANT_H[n] * K.wild).toFixed(2)} m`); }
  for (const K of KIND_INFO) if (!/grass|cattails/.test(K.name)) assert.equal(K.wild, 1, K.name + ' never grows wild-tall');
  const share = (g) => { let n = 0, in_ = 0; for (let x = -300; x < 300; x += 3) for (let z = -500; z < 100; z += 3) { n++; if (wildAt(GROW_DEFAULTS, g, x, z) > 0.5) in_++; } return in_ / n; };
  const open = share({ wet: 0, shade: 0 }), damp = share({ wet: 0.5, shade: 0 }), edge = share({ wet: 0, shade: 0.15 });
  assert.ok(open > 0.01 && open < 0.08, `out in the open meadow: ${(open * 100).toFixed(1)}% in stands`);
  assert.ok(damp > open * 3 && damp < 0.5, `on damp ground: ${(damp * 100).toFixed(1)}%`);
  assert.ok(edge > open * 3 && edge < 0.5, `at the trees' edge: ${(edge * 100).toFixed(1)}%`);
  assert.equal(wildAt({ ...GROW_DEFAULTS, wild: 0 }, { wet: 1, shade: 0.1 }, 10, 10), 0, 'wild 0: none');
});

test('grass tufts: a fringe along the dirt\'s edge, a carpet over the meadow near you, none in the trees\' shade or on the dirt', () => {
  const G0 = { ...GROW_DEFAULTS, bare: 0, wild: 0 };
  const run = (ground, grow) => lawnSpots({ ground, at: { x: 0, z: 0 }, radius: 30, density: 1, grow });
  const base = { hard: 0, yard: 0, fringe: 0, shade: 0, wet: 0.2, dry: 0.3 };
  // a strip of dirt (x < 0, hard) with its rim (0 <= x < 3): with the meadow's carpet off, tufts only on the rim
  const rim = (x) => (x < 0 ? { ...base, hard: 1.2 } : x < 3 ? { ...base, hard: 0.2, fringe: 1 } : { ...base, hard: 0.6 });
  const tufts = run((x) => rim(x), { ...G0, meadowLawn: 0 });
  assert.ok(tufts.length > 120, `the rim fringed: ${tufts.length} tufts`); assert.ok(tufts.every((t) => t.x >= -0.5 && t.x < 3), 'only on the rim');
  assert.equal(run((x) => rim(x), { ...G0, meadowLawn: 0, fringe: 0 }).length, 0, 'fringe 0: none');
  // the meadow: about a tuft a square metre over open meadow, taller than the mown ground's; none in deep shade
  const meadow = run(() => base, G0), area = Math.PI * 30 * 30;
  assert.ok(meadow.length > area * 0.6, `the meadow carpeted: ${meadow.length} tufts over ${area.toFixed(0)} m2`);
  const mown = run(() => ({ ...base, yard: 1 }), G0), mean = (a) => a.reduce((s, t) => s + t.size, 0) / a.length;
  assert.ok(mean(meadow) > mean(mown) * 1.3, `meadow tufts taller than a yard's (${mean(meadow).toFixed(2)} against ${mean(mown).toFixed(2)})`);
  assert.equal(run(() => ({ ...base, shade: 0.9 }), G0).length, 0, 'none under the trees');
});

test('the lawn following the camera: remembered tiles lay the same tufts, and it thins out gradually far off', () => {
  const G0 = { ...GROW_DEFAULTS, bare: 0, wild: 0 }, base = { hard: 0, yard: 0, fringe: 0, shade: 0, wet: 0.2, dry: 0.3 };
  const key = (t) => `${t.x.toFixed(3)},${t.z.toFixed(3)}`;
  const plain = lawnSpots({ ground: () => base, at: { x: 0, z: 0 }, radius: 40, density: 1, grow: G0, spread: 0.6 });
  const cache = {};
  const first = lawnSpots({ ground: () => base, at: { x: 0, z: 0 }, radius: 40, density: 1, grow: G0, spread: 0.6, cache });
  assert.deepEqual(first.map(key), plain.map(key), 'the same tufts with the tiles remembered');
  let calls = 0; const counted = () => { calls++; return base; };
  const moved = lawnSpots({ ground: counted, at: { x: 6, z: 0 }, radius: 40, density: 1, grow: G0, spread: 0.6, cache });
  const fresh = lawnSpots({ ground: () => base, at: { x: 6, z: 0 }, radius: 40, density: 1, grow: G0, spread: 0.6 });
  assert.deepEqual(moved.map(key), fresh.map(key), 'moved: as if laid afresh');
  assert.ok(calls < plain.length * 0.3, `moved 6 m: only the new tiles worked out (${calls} ground looks for ${plain.length} tufts)`);
  // thinned: all of them near, fewer and fewer out toward the rim, and a tuft kept at one thinning is kept at any thicker
  const thin = (x, z) => Math.max(0.3, 1 - Math.max(0, Math.hypot(x, z) - 15) / 25);
  const thinned = lawnSpots({ ground: () => base, at: { x: 0, z: 0 }, radius: 40, density: 1, grow: G0, spread: 0.6, cache, thin });
  const ring = (a, lo, hi) => a.filter((t) => { const d = Math.hypot(t.x, t.z); return d >= lo && d < hi; }).length;
  assert.equal(ring(thinned, 0, 14), ring(plain, 0, 14), 'near: every tuft');
  const far = ring(thinned, 30, 40) / ring(plain, 30, 40);
  assert.ok(far > 0.25 && far < 0.6, `out toward the rim about a third to a half kept (${far.toFixed(2)})`);
  const all = new Set(plain.map(key)); assert.ok(thinned.every((t) => all.has(key(t))), 'only tufts the lawn has anyway');
});

test('a dirt trail runs from the square to the pasture, 120-200 m out on open meadow', () => {
  const trail = planting.strokes.find((s) => s.id === 'trail');
  assert.ok(trail, 'a stroke called trail'); assert.equal(trail.kind, 25, 'a footpath'); assert.ok(trail.pts.length >= 2);
  const sq = [G.square.x, G.square.z], pa = [G.pasture.x, G.pasture.z];
  assert.ok(dist(trail.pts[0], sq) < G.square.r, 'it starts in the square');
  assert.ok(dist(trail.pts[trail.pts.length - 1], pa) < G.pasture.r, 'it ends in the pasture');
  const far = dist(sq, pa); assert.ok(far >= 120 && far <= 200, `the pasture is ${far.toFixed(0)} m from the square`);
  assert.ok(lengthOf(trail.pts) < far * 1.4, 'the trail wanders, but not far');
  // the meadow there cleared for grazing (Clear strokes over it), the forest left as it is (procedural)
  assert.ok(planting.strokes.some((s) => s.mode === 'clear' && dist(s.pts[0], pa) < G.pasture.r), 'the pasture is cleared');
  assert.equal(planting.procedural, true, 'the procedural forest and plants are kept');
});

test('the corral is fenced all round but for its gate, beside the pasture', () => {
  const C = G.corral, hw = C.w / 2, hd = C.d / 2, a = C.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const local = ([x, z]) => [c * (x - C.x) - s * (z - C.z), s * (x - C.x) + c * (z - C.z)];
  const fences = planting.strokes.filter((st) => /^corral\d/.test(st.id));
  assert.ok(fences.length >= 4); for (const f of fences) assert.equal(f.kind, 27, f.id + ' is a fence');
  let around = 0;
  for (const f of fences) {
    for (const p of f.pts) { const [lx, lz] = local(p); assert.ok(Math.abs(Math.abs(lx) - hw) < 0.01 || Math.abs(Math.abs(lz) - hd) < 0.01, `${f.id} runs along the corral's edge`); }
    around += lengthOf(f.pts);
  }
  const gap = 2 * (C.w + C.d) - around; assert.ok(Math.abs(gap - C.gate.width) < 0.01, `one gap the gate's width (${gap.toFixed(2)} m)`);
  const toPasture = dist([C.x, C.z], [G.pasture.x, G.pasture.z]) - G.pasture.r - Math.hypot(hw, hd);
  assert.ok(toPasture < 15, `the corral is beside the pasture (${toPasture.toFixed(1)} m between)`);
  assert.ok(dist([C.x, C.z], [G.pasture.x, G.pasture.z]) > G.pasture.r + Math.min(hw, hd), 'but not inside it');
});

test("the land's bake list names files that are there", () => {
  const m = json('models/town/land/land.json');
  assert.equal(m.v, 1); assert.equal(m.SIZE, 1600);
  for (const k of ['heights', 'cells', 'water', 'paths']) assert.ok(existsSync(join(GAME, 'models/town/land', m.files[k])), k + ': ' + m.files[k]);
  const pngs = readdirSync(join(GAME, 'models/town/land')).filter((f) => f.endsWith('.png'));
  assert.equal(pngs.length, 4, 'no old bakes left behind');
});

// every .js file under a folder
const jsFiles = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? jsFiles(p) : f.endsWith('.js') ? [p] : []; });

test('the copied valley finds everything from the game folder, and its imports are all there', () => {
  const files = [...jsFiles(join(GAME, 'world')), join(GAME, 'src/world.js')];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const abs = src.match(/['"`]\/(models|textures)\/[^'"`]*/g);
    assert.equal(abs, null, `${f}: an asset path from the site's root: ${abs}`);
    for (const m of src.matchAll(/^\s*import\s[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm)) assert.ok(existsSync(resolve(dirname(f), m[1])), `${f} imports ${m[1]}, which is missing`);
  }
  const head = readFileSync(join(GAME, 'world/valley.js'), 'utf8').slice(0, 600);
  assert.match(head, /jconra-site commit [0-9a-f]{7}/, 'the header names the commit it was copied from');
  assert.match(readFileSync(join(GAME, 'world/base.js'), 'utf8'), /new URL\('\.\.\/', import\.meta\.url\)/);
});

test('the valley\'s assets are in the game folder', () => {
  for (const sp of ['oak', 'ash', 'aspen', 'pine']) for (const d of ['sparse', 'coarse']) assert.ok(existsSync(join(GAME, `models/trees/${sp}_${d}.glb`)), `${sp}_${d}.glb`);
  for (const f of ['models/props/groundPlants.glb', 'textures/stamps/atlas.png', 'textures/rock/diorite.jpg', 'textures/rock/granite.jpg',
    ...['grassDry', 'grassMed', 'forest', 'dirt', 'concrete', 'rocks'].map((n) => `textures/ground/${n}.jpg`)]) assert.ok(existsSync(join(GAME, f)), f);
});
