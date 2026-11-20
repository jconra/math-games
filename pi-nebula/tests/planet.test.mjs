// A planet's ground (src/planet/land.js, kinds.js): the same seed always makes the same ground, every kind builds,
// and every planet has a level place to land near its middle. No browser: the ground is plain numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeLand, finishLand, WIDTH, LANDING, TREE_STRIDE, TREE_CLEAR, TREE_STEEP } from '../src/planet/land.js';
import { KINDS, KIND_IDS, kindOf, newSeed, kindById, PLANTS, TREES, FAMILIAR, familiarOf } from '../src/planet/kinds.js';
import { rng } from '../src/planet/noise.js';

// a short fingerprint of a land's numbers
function print(L) {
  let h = 2166136261;
  for (const A of [new Uint8Array(L.H.buffer), L.NM, L.EX]) for (let k = 0; k < A.length; k += 7) { h ^= A[k]; h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const SEEDS = { moon: [7, 90210], meadow: [7, 90210], canyon: [7, 90210] };
const LANDS = {};
for (const id of KIND_IDS) LANDS[id] = SEEDS[id].map((s) => makeLand(s, { kind: id }));

test('the same seed makes the same ground, a different seed a different one', () => {
  for (const id of KIND_IDS) {
    const again = makeLand(SEEDS[id][0], { kind: id });
    assert.equal(print(again), print(LANDS[id][0]), `${id}: seed ${SEEDS[id][0]} made two different grounds`);
    assert.deepEqual(again.landing, LANDS[id][0].landing);
    assert.deepEqual(again.palette, LANDS[id][0].palette, `${id}: the colours changed`);
    assert.notEqual(print(LANDS[id][0]), print(LANDS[id][1]), `${id}: two seeds made the same ground`);
  }
});

test('a seed alone says which kind it is, and every kind comes up', () => {
  const seen = new Set();
  for (let s = 1; s <= 300; s++) { const k = kindOf(s); assert.equal(kindOf(s), k); seen.add(k.id); }
  assert.deepEqual([...seen].sort(), [...KIND_IDS].sort());
  for (const id of KIND_IDS) { const R = rng(5), s = newSeed(id, R); assert.equal(kindOf(s).id, id, `newSeed(${id}) gave a ${kindOf(s).id}`); }
  // made without saying the kind, a seed makes its own kind
  assert.equal(makeLand(4242).kindId, kindOf(4242).id);
});

test('every kind builds: real heights, its pictures, its colours, its plants', () => {
  for (const id of KIND_IDS) for (const L of LANDS[id]) {
    const K = kindById(id);
    assert.ok(K.name && K.about, `${id} has a name and a line about it`);
    assert.equal(L.H.length, L.N * L.N); assert.equal(L.NM.length, L.N * L.N * 4); assert.equal(L.EX.length, L.N * L.N * 4);
    for (let k = 0; k < L.H.length; k += 101) assert.ok(Number.isFinite(L.H[k]), `${id}: a height that is not a number`);
    const span = L.maxH - L.minH;
    assert.ok(span > 15 && span < 600, `${id} seed ${L.seed}: the land rises ${span.toFixed(0)} m, top to bottom`);
    const P = L.palette;
    for (const c of ['dust', 'rock', 'bright', 'dark', 'sunColor']) assert.ok(P[c].length === 3 && P[c].every((v) => v >= 0 && v <= 1), `${id}: colour ${c}`);
    assert.equal(!!P.air, !!K.air, `${id}: air in its colours as its kind says`);
    if (K.air) { assert.equal(P.sun.length, 3); assert.ok(P.sun[1] > 0.2, `${id}: the sun is up`); }
    for (const p of K.cover.plants) { assert.ok(PLANTS[p.k], `${id}: plant ${p.k} is one of the sixteen`); assert.ok(P.leaves[p.leaf], `${id}: plant ${p.k}'s colour`); }
    // the worlds with plants have somewhere for them to grow; the moon has none
    let grows = 0; for (let k = 0; k < L.N * L.N; k += 13) grows += L.EX[k * 4] > 40 ? 1 : 0;
    if (K.cover.plants.length) assert.ok(grows > 200, `${id} seed ${L.seed}: hardly anywhere to grow (${grows})`); else assert.equal(grows, 0);
  }
  assert.ok(LANDS.moon[0].counts.craters > 3000, 'the moon has craters of many sizes');
});

test('the landing place is level, near the middle, and kept clear', () => {
  for (const id of KIND_IDS) for (const L of LANDS[id]) {
    const { x, z, y, flat } = L.landing;
    assert.ok(Math.hypot(x, z) <= LANDING.within + 1, `${id} seed ${L.seed}: the landing place is ${Math.hypot(x, z).toFixed(0)} m from the middle`);
    assert.ok(flat >= 30, 'room for a ship and its people');
    let steepest = 0, lo = Infinity, hi = -Infinity;
    for (let r = 0; r <= flat; r += 2) for (let a = 0; a < 6.283; a += 0.2) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      steepest = Math.max(steepest, L.slopeAt(px, pz));
      if (r <= 12) { const h = L.heightAt(px, pz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      // (marked as the landing place, so nothing is stood on it: src/planet/cover.js leaves out anything over 0.92)
      assert.ok(L.landingAt(px, pz) > 0.95, `${id}: the landing place is not marked at ${r} m from its middle`);
    }
    assert.ok(steepest < 3, `${id} seed ${L.seed}: the landing place slopes ${steepest.toFixed(1)} degrees`);
    assert.ok(hi - lo < 0.5, `${id} seed ${L.seed}: under a ship the ground rises ${(hi - lo).toFixed(2)} m`);
    assert.ok(Math.abs(L.heightAt(x, z) - y) < 0.5, 'the landing height is the ground\'s');
  }
});

test('the ground repeats past its edges, with no seam', () => {
  const L = LANDS.meadow[0];
  for (const [x, z] of [[0, 0], [1023.3, -17], [-1024, 512.7], [333.3, 1023.9]]) {
    assert.ok(Math.abs(L.heightAt(x, z) - L.heightAt(x + WIDTH, z)) < 1e-3);
    assert.ok(Math.abs(L.heightAt(x, z) - L.heightAt(x, z - WIDTH)) < 1e-3);
  }
  // across the edge the ground runs on as smoothly as anywhere else
  let edge = 0, mid = 0;
  for (let z = -1000; z < 1000; z += 7) { edge = Math.max(edge, Math.abs(L.heightAt(1023.9, z) - L.heightAt(1024.1, z))); mid = Math.max(mid, Math.abs(L.heightAt(99.9, z) - L.heightAt(100.1, z))); }
  assert.ok(edge < mid * 3 + 0.05, `a step at the edge: ${edge.toFixed(2)} m`);
});

test('a land handed over as numbers (from the worker) reads the same', () => {
  const L = LANDS.canyon[0], M = finishLand(L.data());
  for (const [x, z] of [[0, 0], [17.3, -400], [L.landing.x, L.landing.z]]) assert.equal(M.heightAt(x, z), L.heightAt(x, z));
  assert.deepEqual(M.palette, L.palette); assert.equal(M.kind, L.kind);
  assert.deepEqual(M.trees, L.trees); assert.equal(M.familiar, L.familiar);
});

// ── THE TREES (src/planet/land.js layTrees, drawn by src/planet/trees.js) ────────────────────────────────────────
test('the same seed lays the same trees, a different seed different ones', () => {
  for (const id of KIND_IDS) {
    const again = makeLand(SEEDS[id][0], { kind: id }), L = LANDS[id][0];
    assert.deepEqual(again.trees, L.trees, `${id}: seed ${L.seed} laid its trees differently`);
    if (L.trees.length) assert.notDeepEqual(LANDS[id][1].trees, L.trees, `${id}: two seeds laid the same trees`);
  }
});

test('the worlds with plants have trees, where they can stand; the moon none', () => {
  for (const id of KIND_IDS) for (const L of LANDS[id]) {
    const K = kindById(id), n = L.trees.length / TREE_STRIDE;
    if (!K.cover.trees) { assert.equal(n, 0, `${id} has no trees`); continue; }
    assert.ok(K.cover.plants.length, `${id}: trees only where there are plants`);
    // the meadows' woods are thousands of trees, the canyons' a few hundred
    assert.ok(id === 'meadow' ? n > 1500 && n < 20000 : n > 100 && n < 3000, `${id} seed ${L.seed}: ${n} trees`);
    const { x: lx, z: lz, flat } = L.landing;
    for (let k = 0; k < n; k++) {
      const [x, y, z, h, yaw, which] = L.trees.slice(k * TREE_STRIDE, k * TREE_STRIDE + TREE_STRIDE);
      const kind = K.cover.trees.kinds[which];
      assert.ok(kind && TREES[kind.tree], `${id}: tree ${k} is one of its kind's`);
      assert.ok(Math.abs(x) <= WIDTH / 2 && Math.abs(z) <= WIDTH / 2, `${id}: tree ${k} is on the ground (${x}, ${z})`);
      const full = TREES[kind.tree].height * kind.size;
      assert.ok(h >= full * 0.74 && h <= full * 1.26, `${id}: tree ${k} is ${h.toFixed(1)} m tall`);
      assert.ok(yaw >= 0 && yaw < 6.3);
      // off the landing place, with room for its crown
      const d = Math.hypot(x - lx - WIDTH * Math.round((x - lx) / WIDTH), z - lz - WIDTH * Math.round((z - lz) / WIDTH));
      assert.ok(d >= flat + TREE_CLEAR - 0.01, `${id} seed ${L.seed}: a tree ${(d - flat).toFixed(1)} m from the landing place's level ground`);
      // standing on the ground: its foot at the lowest of the ground round its trunk, never in the air
      const g = L.heightAt(x, z);
      assert.ok(y <= g + 1e-3 && y > g - 1.5, `${id}: tree ${k}'s foot is ${(y - g).toFixed(2)} m from the ground`);
      if (k % 7 === 0) assert.ok(L.slopeAt(x, z) < TREE_STEEP + 6, `${id}: tree ${k} stands on ground ${L.slopeAt(x, z).toFixed(0)} degrees steep`);
    }
    // the meadows' woods have both kinds of tree in them
    if (K.cover.trees.kinds.length > 1) { const kinds = new Set(); for (let k = 0; k < n; k++) kinds.add(L.trees[k * TREE_STRIDE + 5]); assert.equal(kinds.size, K.cover.trees.kinds.length, `${id} seed ${L.seed}: only ${kinds.size} kind of tree`); }
  }
});

test('one or two kinds of tree, each the Terrain Lab\'s, recoloured with the world\'s leaf colours', () => {
  for (const K of KINDS) {
    if (!K.cover.trees) continue;
    assert.ok(K.cover.trees.kinds.length >= 1 && K.cover.trees.kinds.length <= 2, `${K.id}: one or two kinds`);
    for (const L of LANDS[K.id]) for (const t of K.cover.trees.kinds) assert.ok(L.palette.leaves[t.leaf], `${K.id}: the ${t.tree}'s colour`);
  }
  for (const t of Object.values(TREES)) { assert.ok(fs.existsSync(new URL(`../assets/planet/${t.file}.glb`, import.meta.url)), `${t.file}.glb is in assets/planet`); assert.equal(t.leaf.length, 3); }
});

// ── THE COLOURS: mostly strange, now and then familiar (the game's maker, PLAN1-4 B) ────────────────────────────
test('about one world with air in five has Earth\'s colours, the same each time for a seed', () => {
  let air = 0, fam = 0;
  for (let s = 1; s <= 4000; s++) {
    const k = kindOf(s), f = familiarOf(s);
    assert.equal(familiarOf(s), f, 'the same seed, the same answer');
    if (!k.air) { assert.equal(f, false, 'a moon (no air) is never familiar'); continue; }
    air++; if (f) fam++;
  }
  const share = fam / air;
  assert.ok(share > FAMILIAR - 0.04 && share < FAMILIAR + 0.04, `familiar worlds: ${(100 * share).toFixed(1)}% of those with air`);
  assert.ok(FAMILIAR > 0.1 && FAMILIAR < 0.34, 'mostly strange, now and then familiar');
  // the seeds shown to the game's maker before there were familiar worlds keep the strange colours he saw
  for (const s of [1, 2, 3, 7]) assert.equal(familiarOf(s), false, `seed ${s} kept its colours`);
});

// a colour's hue (degrees) and saturation
function hueOf([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 1e-6) return { h: 0, s: 0 };
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(mx + mn - 1)) };
}
test('a familiar world has green plants and a blue sky; a strange one keeps its own colours', () => {
  const found = { meadow: 0, canyon: 0 };
  for (let s = 1; s <= 400; s++) {
    const k = kindOf(s); if (!k.air || !familiarOf(s) || found[k.id] >= 2) continue;
    found[k.id]++;
    const L = makeLand(s, { n: 256 }), P = L.palette;
    assert.equal(L.familiar, true); assert.equal(P.familiar, true);
    for (const lf of P.leaves) assert.ok(lf.hue > 75 && lf.hue < 130 && lf.sat <= 1.1, `seed ${s}: a leaf colour ${lf.hue.toFixed(0)} degrees, ${lf.sat} vivid`);
    const sky = hueOf(P.air.zenith); assert.ok(sky.h > 195 && sky.h < 230 && sky.s > 0.3, `seed ${s}: the sky overhead is ${sky.h.toFixed(0)} degrees`);
    // (a meadow's grass tints its ground green; a canyon's ground stays sand where its plants grow)
    if (k.id === 'meadow') { const grass = hueOf(P.grass); assert.ok(grass.h > 70 && grass.h < 135, `seed ${s}: the grass is ${grass.h.toFixed(0)} degrees`); }
  }
  assert.deepEqual(found, { meadow: 2, canyon: 2 }, 'familiar worlds of both kinds with air');
  // a strange one keeps the colours it had before there were familiar worlds: seed 7, the red meadow under a green sky
  // the game's maker saw (its colours drawn the same way, in the same order)
  const S = makeLand(7, { n: 256 }), red = S.palette.leaves[0].hue % 360, green = hueOf(S.palette.air.zenith).h;
  assert.equal(S.kindId, 'meadow'); assert.equal(S.familiar, false);
  assert.ok(red > 320 || red < 25, `seed 7's leaves are ${red.toFixed(0)} degrees`); assert.ok(green > 130 && green < 190, `seed 7's sky is ${green.toFixed(0)} degrees`);
});

test('the kinds are a list to add to', () => {
  assert.ok(KINDS.length >= 3);
  assert.equal(new Set(KIND_IDS).size, KIND_IDS.length, 'each kind its own id');
  for (const K of KINDS) for (const f of ['shape', 'paint', 'palette']) assert.equal(typeof K[f], 'function', `${K.id}.${f}`);
});
