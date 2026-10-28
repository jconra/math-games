// Tests for the pen behind the stable (src/horsepenplan.js; drawn by src/horsepen.js): how often each coat turns up
// (Dad's rarity), the sizes, the names, the lines, the prices, that a pen horse's coat is saved whole, and that the pen
// stands where it was put (models/town/planting.json: a corral fence with a corral gate, behind the stable).
//   node --test mathwood-valley/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }; } });
const { rollPenHorse, POOL, SIZES, PENPLAN, penPrice } = await import('../src/horsepenplan.js');
const { PEN, LADDER, HORSES, PRICES, mphOf } = await import('../src/catalog.js');
const { cleanMounts } = await import('../src/mounts.js');
const S = await import('../src/save.js');
const GROUP = { common: 60, less: 21, uncommon: 13, rare: 6 };

test('Dad\'s rarity: over 10,000 horses, each kind of coat within 2 points of its share, the sizes too', () => {
  const n = 10000, by = {}, rar = {}, size = {};
  for (let i = 1; i <= n; i++) { const h = rollPenHorse(i); by[h.coatId] = (by[h.coatId] || 0) + 1; rar[h.rarity] = (rar[h.rarity] || 0) + 1; size[h.size] = (size[h.size] || 0) + 1; }
  assert.equal(POOL.reduce((a, c) => a + c.w, 0), 100, 'the weights are out of 100');
  for (const c of POOL) assert.ok(Math.abs(100 * (by[c.id] || 0) / n - c.w) < 2, `${c.id}: ${(100 * (by[c.id] || 0) / n).toFixed(1)}% against ${c.w}`);
  for (const [r, w] of Object.entries(GROUP)) assert.ok(Math.abs(100 * rar[r] / n - w) < 2, `${r}: ${(100 * rar[r] / n).toFixed(1)}% against ${w}`);
  for (const [s, w] of SIZES) assert.ok(Math.abs(100 * size[s] / n - w) < 2, `size ${s}: ${(100 * size[s] / n).toFixed(1)}% against ${w}`);
  // bay and chestnut common; palomino, buckskin, dun less so; grey and black uncommon; the paints rare
  const of = (id) => POOL.find((c) => c.id === id).rarity;
  assert.deepEqual(['bay', 'chestnut', 'palomino', 'buckskin', 'dun', 'grey', 'black', 'tobiano', 'overo', 'sabino'].map(of), ['common', 'common', 'less', 'less', 'less', 'uncommon', 'uncommon', 'rare', 'rare', 'rare']);
});

test('a pen horse: its speed and price from its size (the stalls\' ladder), a little more for a rarer coat; an honest line', () => {
  for (let i = 1; i <= 400; i++) {
    const h = rollPenHorse(i);
    const L = Object.values(LADDER).find((x) => x.kind === 'steed' && x.size === h.size);
    assert.equal(h.gallop, L.gallop); assert.equal(h.mph, mphOf(h.gallop)); assert.equal(h.mph, L.mph);
    assert.equal(h.price, PEN.bySize[h.size] + PEN.extra[h.rarity]); assert.equal(h.price, penPrice(h.size, h.rarity));
    assert.ok(h.price >= 45 && h.price <= 420, h.price);
    assert.match(h.line, /\.$/); assert.equal(/^Rare!/.test(h.line), h.rarity === 'rare', h.line);
    assert.ok(!/\bfree\b|trusty/i.test(h.line), h.line);
  }
  // like the stalls: the 0.95, 1, 1.05, 1.10 and 1.15 sizes cost what Copper, Chester, Goldie, Willow and Midnight do
  const stall = (size) => { const id = Object.keys(LADDER).find((k) => LADDER[k].kind === 'steed' && LADDER[k].size === size); return id; };
  for (const s of [0.95, 1, 1.05, 1.1, 1.15]) assert.equal(PEN.bySize[s], PRICES.horse[stall(s)], `size ${s}`);
  assert.ok(PEN.extra.rare > PEN.extra.uncommon && PEN.extra.uncommon > PEN.extra.less && PEN.extra.less > PEN.extra.common && PEN.extra.common === 0);
});

test('names: never one the rider already has, never one of the stable\'s own', () => {
  const ladder = HORSES.map((h) => h.name.split(' ')[0].toLowerCase());
  for (let i = 1; i <= 2000; i++) {
    const taken = ['Ranger', 'Rusty', 'Sunny', 'Shadow', 'Patch', 'Smoke', 'Sandy', 'Buck'];
    const h = rollPenHorse(i, { taken });
    assert.ok(!taken.map((t) => t.toLowerCase()).includes(h.name.toLowerCase()), `${h.name} is taken`);
    assert.ok(!ladder.includes(h.name.toLowerCase()), `${h.name} is the stable's`);
    assert.ok(h.name.length <= 16);
  }
});

test('bought, a pen horse is kept whole: its rolled coat comes through the save\'s cleaning unchanged', () => {
  for (let i = 1; i <= 300; i++) {
    const h = rollPenHorse(i);
    const m = cleanMounts({ 'pen-1': { name: h.name, line: h.line, coat: h.recipe, size: h.size, gallop: h.gallop, price: h.price, from: 'pen', at: 1 } })['pen-1'];
    assert.deepEqual(m.coat, h.recipe, `seed ${i}`); assert.equal(m.size, h.size); assert.equal(m.gallop, h.gallop); assert.equal(m.name, h.name); assert.equal(m.price, h.price);
  }
  // and through a whole save and load
  store.clear(); S.useSaveKey('bandit-math.riders.pentest');
  const r = S.newRider('Pen', {}), h = rollPenHorse(4242);
  r.owned.mounts = { 'pen-1': { name: h.name, line: h.line, coat: h.recipe, size: h.size, gallop: h.gallop, price: h.price, from: 'pen', at: 5 } }; r.owned.horse = 'pen-1'; r.owned.penNext = 2;
  S.saveRider(r);
  const back = S.loadRiders().find((x) => x.id === r.id);
  assert.deepEqual(back.owned.mounts['pen-1'].coat, h.recipe); assert.equal(back.owned.horse, 'pen-1'); assert.equal(back.owned.penNext, 2);
});

test('the pen stands behind the stable: a corral fence with a corral gate; its horses are put away only past every job in town', async () => {
  const plant = JSON.parse(fs.readFileSync(new URL('../models/town/planting.json', import.meta.url), 'utf8'));
  const fence = plant.strokes.find((s) => s.id === 'horsepen'), gate = plant.strokes.find((s) => s.id === 'horsepen-gate');
  assert.ok(fence && fence.kind === 27 && fence.style === 'corral' && fence.mode === 'paint', 'a corral-style fence stroke');
  assert.ok(gate && gate.kind === 98 && gate.pts.length === 1, 'a gate stroke');
  assert.ok(plant.strokes.indexOf(gate) > plant.strokes.indexOf(fence), 'the gate after its fence (a gate goes on a fence drawn before it)');
  // the paddock behind the stable: a run round three sides (at least four corners), left open on the fourth, where the
  // stable's back wall closes it (its two ends a step apart along that wall)
  const P = fence.pts, ends = Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]);
  assert.ok(P.length >= 5 && ends > 5 && ends < 20, `a run round the paddock, open along the stable's back (${P.length} points, ends ${ends.toFixed(1)} m apart)`);
  let area = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; area += a[0] * b[1] - b[0] * a[1]; }
  assert.ok(Math.abs(area) / 2 > 600, `a big paddock for the horses to roam (${(Math.abs(area) / 2).toFixed(0)} m²)`);
  const cx = P.reduce((q, p) => q + p[0], 0) / P.length, cz = P.reduce((q, p) => q + p[1], 0) / P.length;
  // behind the stable: on the far side of it from the road (the stable faces the road), the stable where the game shows
  // it (the shipped layout with the Town Lab's decor over it: models/town/decor.json moved it onto the main street)
  const layout = JSON.parse(fs.readFileSync(new URL('../models/town/layout.json', import.meta.url), 'utf8'));
  const decor = JSON.parse(fs.readFileSync(new URL('../models/town/decor.json', import.meta.url), 'utf8'));
  const { applyDecor } = await import('../world/objects/decor.js');
  const shown = applyDecor(layout, plant, decor).layout;
  const st = shown.items.find((i) => i.id === 'stable'), rot = st.rot * Math.PI / 180, front = [Math.sin(rot), Math.cos(rot)];
  assert.ok((cx - st.x) * front[0] + (cz - st.z) * front[1] < -8, 'behind the stable, away from its front');
  // the gate is on the fence (within the fence plan's reach)
  const [gx, gz] = gate.pts[0];
  const dist = Math.min(...P.slice(0, -1).map((a, i) => { const b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((gx - a[0]) * dx + (gz - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(gx - a[0] - dx * t, gz - a[1] - dz * t); }));
  assert.ok(dist < 0.5, `the gate is ${dist.toFixed(2)} m off the fence`);
  // every job in town nearer than the put-away distance: the doors (the lock boxes at the sheriff's and the cabin), the
  // store, the square and the jobs board, the range at the town's east end, the yard behind the cabin (the doors and the
  // yard where the decor puts the buildings: the main street's row)
  const TOWN = { sheriff: [-13.6, -202.82], cabin: [-65.2, -216.01], store: [2.86, -203.33], square: [-12, -205], board: [-13.5, -218.8], range: [60.6, -195.4], yard: [-70.25, -240.39], saloon: [-30.85, -202.89] };
  for (const [k, [x, z]] of Object.entries(TOWN)) assert.ok(Math.hypot(x - cx, z - cz) < PENPLAN.away - 20, `${k} is ${Math.hypot(x - cx, z - cz).toFixed(0)} m from the pen: inside ${PENPLAN.away - 20} (the put-away line less its margin)`);
});
