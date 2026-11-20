// A planet's ground (src/planet/land.js, kinds.js): the same seed always makes the same ground, every kind builds,
// and every planet has a level place to land near its middle. No browser: the ground is plain numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLand, finishLand, WIDTH, LANDING } from '../src/planet/land.js';
import { KINDS, KIND_IDS, kindOf, newSeed, kindById, PLANTS } from '../src/planet/kinds.js';
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
});

test('the kinds are a list to add to', () => {
  assert.ok(KINDS.length >= 3);
  assert.equal(new Set(KIND_IDS).size, KIND_IDS.length, 'each kind its own id');
  for (const K of KINDS) for (const f of ['shape', 'paint', 'palette']) assert.equal(typeof K[f], 'function', `${K.id}.${f}`);
});
