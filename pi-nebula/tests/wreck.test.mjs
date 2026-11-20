// The crashed ship for the rescue runs (src/planet/wreck.js): one of our four ships broken into pieces with jagged
// breaks, lying apart on the ground beside the landing place, sunk a little and tilted, in another crew's colours.
// The game's maker (2026-11-20): "can we take one of our ships and break it into parts for a rescue situation? Like
// the people in need broke their ship in half. Maybe we could color it differently."
// No browser: each ship's own hull (its data module, as the kit builds it: kit/ships/<ship>-built.hull.js) broken and
// laid on real planets' ground. (The whole ship, every part the kit builds, is the Planet Lab's: wreckship.js.)
//   node --test pi-nebula/tests/wreck.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLand } from '../src/planet/land.js';
import { wreckPlan, breakApart, wreckSite, settle, clearUnder, recolour, paintClass, hslOf, PAINTS, PAINT_IDS, WRECK, WRECK_SHIPS, shipFor, wreckFor, pieceAt, pastBreak, apply, fingerprint, CUT_AT } from '../src/planet/wreck.js';
import * as EXPLORER from '../kit/ships/explorer-built.hull.js';
import * as MINER from '../kit/ships/miner-built.hull.js';
import * as MEDIC from '../kit/ships/medic-built.hull.js';
import * as HAULER from '../kit/ships/hauler-built.hull.js';

// ── each ship's hull as triangles (every corner its own, as the kit's meshes are flattened for breaking) ──────────
const buf = (s) => { const b = Buffer.from(s, 'base64'), u = new Uint8Array(b.length); u.set(b); return u.buffer; };
function hullSoup({ HULL, Q }) {
  const p = new Int16Array(buf(HULL.pos)), t = new Uint16Array(buf(HULL.tris)), pos = new Float32Array(t.length * 3), nrm = new Float32Array(t.length * 3), col = new Float32Array(t.length * 3);
  for (let i = 0; i < t.length; i++) for (let c = 0; c < 3; c++) pos[i * 3 + c] = p[t[i] * 3 + c] / Q;
  for (let f = 0; f < t.length; f += 3) {
    const a = [0, 1, 2].map((c) => pos[(f + 1) * 3 + c] - pos[f * 3 + c]), b = [0, 1, 2].map((c) => pos[(f + 2) * 3 + c] - pos[f * 3 + c]);
    const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], l = Math.hypot(...n) || 1;
    for (let v = 0; v < 3; v++) for (let c = 0; c < 3; c++) { nrm[(f + v) * 3 + c] = n[c] / l; col[(f + v) * 3 + c] = 0.7; }
  }
  return { skin: { position: { size: 3, array: pos }, normal: { size: 3, array: nrm }, color: { size: 3, array: col } } };
}
const HULLS = { explorer: hullSoup(EXPLORER), miner: hullSoup(MINER), medic: hullSoup(MEDIC), hauler: hullSoup(HAULER) };
const boxOf = (soups) => { const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (const S of Object.values(soups)) { const P = S.position.array; for (let i = 0; i < P.length; i += 3) for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], P[i + c]); max[c] = Math.max(max[c], P[i + c]); } } return { min, max }; };
const areaOf = (P) => { let s = 0; for (let i = 0; i < P.length; i += 9) { const a = [P[i + 3] - P[i], P[i + 4] - P[i + 1], P[i + 5] - P[i + 2]], b = [P[i + 6] - P[i], P[i + 7] - P[i + 1], P[i + 8] - P[i + 2]]; s += Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) / 2; } return s; };
// a ship broken and laid on a land, as the Planet Lab does it (wreckship.js makeWreck)
function wreckOn(land, ship, pieces = 2, seed = land.seed) {
  const soups = HULLS[ship], box = boxOf(soups), plan = wreckPlan(seed, box, { ship, pieces }), broken = breakApart(soups, plan);
  const parts = broken.pieces.map((pc) => { const pts = pc.skin.position.array, b = boxOf(pc); return { pts, pivot: [0, 1, 2].map((c) => (b.min[c] + b.max[c]) / 2) }; });
  const site = wreckSite(land, seed), placed = settle(parts, land, site, plan);
  return { soups, box, plan, broken, parts, site, placed };
}
// three planets of the kinds he saw: the moon (seed 11), a meadow (7), a canyon (3); coarser ground than the game's,
// for the time the tests take (the same land, read the same way)
const LANDS = { moon: makeLand(11, { kind: 'moon', n: 512 }), meadow: makeLand(7, { kind: 'meadow', n: 512 }), canyon: makeLand(3, { kind: 'canyon', n: 512 }) };

test('the same seed breaks the same ship the same way and lays it in the same place; another seed another way', () => {
  const L = LANDS.meadow;
  for (const ship of WRECK_SHIPS) {
    const a = wreckOn(L, ship), b = wreckOn(L, ship), c = wreckOn(L, ship, 2, 8);
    assert.deepEqual(a.plan, b.plan, `${ship}: the plan`);
    assert.deepEqual(a.placed.mats, b.placed.mats, `${ship}: where the pieces lie`);
    assert.deepEqual(a.site, b.site);
    for (let k = 0; k < 2; k++) assert.equal(fingerprint([a.broken.pieces[k].skin.position.array]), fingerprint([b.broken.pieces[k].skin.position.array]), `${ship}: piece ${k}'s triangles`);
    assert.notDeepEqual(a.plan.cuts, c.plan.cuts, `${ship}: seed 8 broke it the same way`);
    assert.notDeepEqual(a.placed.mats, c.placed.mats, `${ship}: seed 8 laid it the same way`);
  }
  // which ship a seed gives: the same each time, and all four come up
  const seen = new Set(); for (let s = 1; s <= 60; s++) { assert.equal(shipFor(s), shipFor(s)); seen.add(shipFor(s)); }
  assert.deepEqual([...seen].sort(), [...WRECK_SHIPS].sort());
});

// The game's maker (WRECK1-1 C, WRECK1-2 D, WRECK1-3 C): a different ship each rescue from all four, a different one of
// the three colour schemes, in two or in three pieces a different way each rescue: "Randomness is good"
test('each rescue: the planet\'s seed picks the ship, its colours and its pieces, the same each time, all of them coming up', () => {
  const n = 600, count = {}, add = (k) => { count[k] = (count[k] || 0) + 1; };
  for (let s = 1; s <= n; s++) {
    const w = wreckFor(s);
    assert.deepEqual(w, wreckFor(s), `seed ${s}: the same seed, the same wreck`);
    assert.ok(WRECK_SHIPS.includes(w.ship) && PAINTS[w.paint] && (w.pieces === 2 || w.pieces === 3), `seed ${s}: ${JSON.stringify(w)}`);
    assert.equal(w.ship, shipFor(s));
    add(w.ship); add(w.paint); add(`in ${w.pieces}`); add(`${w.ship} ${w.paint} ${w.pieces}`);
  }
  // all four ships, all three colours and both piece counts, none lopsided (each within a quarter of an even share),
  // and every one of the 24 together (the three are drawn apart, so none goes with another)
  const even = (k, of) => assert.ok(count[k] > (n / of) * 0.75 && count[k] < (n / of) * 1.25, `${k}: ${count[k] || 0} of ${n} seeds`);
  for (const s of WRECK_SHIPS) even(s, WRECK_SHIPS.length);
  for (const p of PAINT_IDS) even(p, PAINT_IDS.length);
  even('in 2', 2); even('in 3', 2);
  for (const s of WRECK_SHIPS) for (const p of PAINT_IDS) for (const k of [2, 3]) assert.ok(count[`${s} ${p} ${k}`] > 0, `never a ${p} ${s} in ${k}`);
  // and the wreck it makes is the same each time (the meadow, seed 7)
  const L = LANDS.meadow, w = wreckFor(L.seed), a = wreckOn(L, w.ship, w.pieces), b = wreckOn(L, w.ship, w.pieces);
  assert.deepEqual(a.placed.mats, b.placed.mats);
  assert.deepEqual(a.plan, b.plan);
});

test('broken in two or three: every bit of the hull in one piece, nothing lost, each piece a real part of the ship', () => {
  for (const ship of WRECK_SHIPS) for (const pieces of [2, 3]) {
    const soups = HULLS[ship], box = boxOf(soups), plan = wreckPlan(5, box, { ship, pieces }), { pieces: out, stats } = breakApart(soups, plan);
    assert.equal(out.length, pieces, `${ship}: ${pieces} pieces`);
    const whole = areaOf(soups.skin.position.array), parts = out.map((pc) => areaOf(pc.skin.position.array)), sum = parts.reduce((s, v) => s + v, 0);
    assert.ok(Math.abs(sum - whole) / whole < 1e-4, `${ship}: ${whole.toFixed(2)} m² of hull became ${sum.toFixed(2)}`);
    for (const a of parts) assert.ok(a > whole * (pieces === 2 ? 0.2 : 0.06), `${ship}: a piece of ${(100 * a / whole).toFixed(0)}% of the hull`);
    // each triangle on its own piece's side of the breaks (by its middle), or a sliver along a break (cut along it,
    // its middle a hair over); the normals still a unit long
    out.forEach((pc, k) => {
      const P = pc.skin.position.array, N = pc.skin.normal.array;
      for (let i = 0; i < P.length; i += 9) {
        const m = [0, 1, 2].map((c) => (P[i + c] + P[i + 3 + c] + P[i + 6 + c]) / 3);
        if (pieceAt(plan, ...m) === k) continue;
        const near = Math.min(...plan.cuts.map((C) => Math.abs(pastBreak(C, ...m))));
        assert.ok(near < 0.3, `${ship}: a triangle of piece ${k} ${near.toFixed(2)} m over a break`);
      }
      for (let i = 0; i < N.length; i += 30) assert.ok(Math.abs(Math.hypot(N[i], N[i + 1], N[i + 2]) - 1) < 1e-3);
      assert.equal(pc.skin.aBreak.array.length, P.length / 3, 'every corner has its distance from the break');
      assert.equal(pc.skin.color.array.length, P.length, 'every corner keeps its colour');
    });
    // light for a phone: each break costs at most 2,500 triangles more on the bare hull (its triangles are big; the
    // whole ship in the Planet Lab, in two pieces: 9 to 16% more than the ship, measured, WRECK_1.md)
    const tris = stats.tris.reduce((s, v) => s + v, 0);
    assert.ok(tris - stats.trisIn < 2500 * (pieces - 1), `${ship}: ${stats.trisIn} triangles became ${tris}`);
  }
});

test('the breaks are jagged, not a clean cut', () => {
  for (const ship of WRECK_SHIPS) for (const n of [2, 3]) {
    const soups = HULLS[ship], plan = wreckPlan(5, boxOf(soups), { ship, pieces: n }), { pieces } = breakApart(soups, plan);
    plan.cuts.forEach((C, c) => {
      // the corners made along this break (no distance from it): how far along the ship they wander, against the
      // break's own plane (a straight cut would keep them on it). (The Hauler's middle is built in code, not in its
      // hull's data: a break there has no hull to cut here.)
      const P = pieces[c + 1].skin.position.array, G = pieces[c + 1].skin.aBreak.array, off = [];
      for (let v = 0; v < G.length; v++) {
        const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
        if (G[v] < 0.02 && plan.cuts.every((D) => Math.abs(pastBreak(C, x, y, z)) <= Math.abs(pastBreak(D, x, y, z)))) off.push(z - (C.z + C.sx * x + C.sy * (y - C.yc)));
      }
      if (ship === 'hauler' && c === n - 2) { assert.equal(off.length, 0); return; }
      off.sort((a, b) => a - b);
      assert.ok(off.length > 40, `${ship} in ${n}: ${off.length} corners along break ${c}`);
      const spread = off[Math.floor(off.length * 0.95)] - off[Math.floor(off.length * 0.05)];
      assert.ok(spread > 0.35 && spread < 2, `${ship} in ${n}: break ${c}'s teeth wander ${spread.toFixed(2)} m along the ship`);
    });
  }
});

test('the pieces lie on the ground beside the landing ring: sunk a little, tilted, apart, none on the landing place', () => {
  for (const [kind, L] of Object.entries(LANDS)) for (const ship of WRECK_SHIPS) for (const pieces of [2, 3]) {
    const W = wreckOn(L, ship, pieces), { flat } = L.landing, why = `${kind} ${ship} in ${pieces}`;
    const world = W.placed.mats.map((M, k) => { const P = W.parts[k].pts, out = []; for (let i = 0; i < P.length; i += 3) out.push(apply(M, P[i], P[i + 1], P[i + 2])); return out; });
    world.forEach((pts, k) => {
      const d = pts.map((p) => p[1] - L.heightAt(p[0], p[2])), low = Math.min(...d), sink = W.plan.poses[k].sink;
      // sunk a little: its lowest point the plan's sink under the ground, and no more
      assert.ok(Math.abs(low + sink) < 0.02 && sink >= 0.25 && sink <= 0.8, `${why}: piece ${k}'s lowest point ${low.toFixed(2)} m from the ground`);
      // lying on it, not balanced on a point: the part of it touching the ground (within 35 cm) runs a good way along it
      const M = W.placed.mats[k], ax = [M[8], M[9], M[10]], touch = pts.filter((p, i) => d[i] < 0.35).map((p) => p[0] * ax[0] + p[1] * ax[1] + p[2] * ax[2]);
      const all = pts.map((p) => p[0] * ax[0] + p[1] * ax[1] + p[2] * ax[2]), len = Math.max(...all) - Math.min(...all), run = Math.max(...touch) - Math.min(...touch);
      assert.ok(run > len * 0.3, `${why}: piece ${k} touches the ground along ${run.toFixed(1)} of its ${len.toFixed(1)} m`);
      // tilted, but the right way up (its own up within 50 degrees of the sky)
      const up = Math.acos(Math.min(1, M[5] / Math.hypot(M[4], M[5], M[6]))) * 180 / Math.PI;
      assert.ok(up < 50, `${why}: piece ${k} leans ${up.toFixed(0)} degrees`);
      // beside the ring, not on the landing place's level ground
      const inner = Math.min(...pts.map((p) => Math.hypot(p[0] - L.landing.x, p[2] - L.landing.z)));
      assert.ok(inner > flat + 1, `${why}: piece ${k} comes ${(inner - flat).toFixed(1)} m from the landing place's edge`);
      assert.ok(inner < flat + 40, `${why}: piece ${k} is ${(inner - flat).toFixed(0)} m from the ring, not beside it`);
    });
    // apart: no two pieces nearer than WRECK.apart (every 7th corner)
    for (let a = 0; a < world.length; a++) for (let b = a + 1; b < world.length; b++) {
      let near = Infinity; for (let i = 0; i < world[a].length; i += 7) for (let j = 0; j < world[b].length; j += 7) { const p = world[a][i], q = world[b][j]; near = Math.min(near, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2); }
      assert.ok(Math.sqrt(near) > WRECK.apart * 0.8, `${why}: pieces ${a} and ${b} are ${Math.sqrt(near).toFixed(2)} m apart`);
    }
    // turned and rolled: the pieces do not lie as the whole ship did
    const yaws = W.plan.poses.map((p) => p.yaw); assert.ok(Math.max(...yaws) - Math.min(...yaws) > 0.25, `${why}: the pieces lie in a line`);
  }
});

test('nothing grows through it: the ground under the pieces is kept clear of trees, rocks and plants', () => {
  const L = makeLand(2, { kind: 'meadow', n: 512 }), before = L.trees.length / 6, W = wreckOn(L, 'explorer');
  const world = W.placed.mats.map((M, k) => { const P = W.parts[k].pts, out = new Float32Array(P.length); for (let i = 0; i < P.length; i += 3) { const q = apply(M, P[i], P[i + 1], P[i + 2]); out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2]; } return { tris: out }; });
  const r = clearUnder(L, world);
  assert.ok(r.cells > 40, `${r.cells} samples of ground cleared`);
  assert.equal(L.trees.length / 6, before - r.trees);
  for (const { tris } of world) for (let i = 0; i < tris.length; i += 99) {
    // (marked as the landing place is, which the rocks and plants keep off: src/planet/cover.js CLEAR 0.92)
    assert.ok(L.landingAt(tris[i], tris[i + 2]) > 0.92, 'the ground under it is marked clear');
    for (let k = 0; k < L.trees.length; k += 6) assert.ok(Math.hypot(L.trees[k] - tris[i], L.trees[k + 2] - tris[i + 2]) > 1.5, 'a tree stands in the wreck');
  }
});

test('another crew\'s colours: our light skin and yellow turned to theirs, three to choose from', () => {
  const lin = (h) => [1, 3, 5].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  // our ships' paints (each ship's PAL): the skins, the yellows, the greys and blacks
  const skins = ['#dedcd5', '#cfc5ac', '#d8d0bf', '#d9d5ca', '#d6cbb2', '#d9d2c0'], yellows = ['#e8b923', '#e2ae1c', '#e3b11c', '#e0a81a'], rest = ['#1c1e22', '#474c53', '#43484f', '#3d4249', '#80858c', '#555a61', '#6d7177', '#202225'];
  const scr = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  for (const h of skins) assert.equal(paintClass(scr(h)), 'skin', h);
  for (const h of yellows) assert.equal(paintClass(scr(h)), 'accent', h);
  for (const h of rest) assert.equal(paintClass(scr(h)), null, h);
  assert.ok(PAINT_IDS.length >= 2 && PAINT_IDS.length <= 3, 'two or three to choose from');
  const all = new Float32Array([...skins, ...yellows, ...rest].flatMap(lin));
  const toScr = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  const turned = {};
  for (const id of PAINT_IDS) {
    const out = recolour(all, id); turned[id] = out;
    assert.equal(out.length, all.length);
    for (let i = 0; i < skins.length; i++) {
      const c = [0, 1, 2].map((j) => toScr(out[i * 3 + j])), ours = scr(skins[i]);
      assert.ok(Math.hypot(c[0] - ours[0], c[1] - ours[1], c[2] - ours[2]) > 0.3, `${id}: the skin ${skins[i]} still looks like ours`);
      assert.ok(hslOf(c)[2] < 0.5, `${id}: their skin is dark (his taste)`);
    }
    for (let i = skins.length; i < skins.length + yellows.length; i++) { const c = [0, 1, 2].map((j) => toScr(out[i * 3 + j])); assert.notEqual(paintClass(c), 'accent', `${id}: our yellow stayed`); }
    // the greys and blacks stay greys and blacks
    for (let i = skins.length + yellows.length; i < all.length / 3; i++) for (let j = 0; j < 3; j++) assert.ok(Math.abs(out[i * 3 + j] - all[i * 3 + j]) < all[i * 3 + j] * 0.25 + 0.003);
  }
  // the three are three different crews
  for (const a of PAINT_IDS) for (const b of PAINT_IDS) if (a < b) assert.ok(Math.abs(turned[a][0] - turned[b][0]) + Math.abs(turned[a][1] - turned[b][1]) + Math.abs(turned[a][2] - turned[b][2]) > 0.05, `${a} and ${b}`);
  for (const P of Object.values(PAINTS)) assert.ok(P.name && P.about);
});

test('each ship breaks where its own parts allow, and the Planet Lab offers all four', () => {
  for (const ship of WRECK_SHIPS) {
    assert.ok(CUT_AT[ship] && CUT_AT[ship][2].length === 1 && CUT_AT[ship][3].length === 2, ship);
    const box = boxOf(HULLS[ship]);
    for (const n of [2, 3]) for (const [z, w] of CUT_AT[ship][n]) assert.ok(z - w > box.min[2] + 0.8 && z + w + 1.6 < box.max[2] - 1, `${ship}: a break at ${z} m inside its ${box.min[2].toFixed(1)}..${box.max[2].toFixed(1)}`);
  }
});
