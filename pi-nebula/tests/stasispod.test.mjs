// THE STASIS PODS for the rescue runs: the game's maker's own model (kit/stasispod-plan.js, kit/stasispod.js), its lid on
// its hinge, and 3 to 6 of them on a planet's ground beside the crashed ship (src/planet/pods.js). His answers MED-1,
// MED-2: you walk down the Medic's ramp to 3 to 6 pods on the ground, beside a crashed ship; nobody is hurt, they are
// asleep in the pods, safe until opened.
// No browser: his file read as it is, and the wreck from each ship's own hull (as tests/wreck.test.mjs builds it) laid
// on real planets' ground. (Whoever sleeps in a pod is the crew kit's, a browser's: measured by the rigs,
// ~/pw/space-math/STASIS_1.md.)
//   node --test pi-nebula/tests/stasispod.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { POD, podPieces, lidAngle, turnLid, readGlb, podScale, levelY, BED } from '../kit/stasispod-plan.js';
import { makeLand } from '../src/planet/land.js';
import { wreckPlan, breakApart, wreckSite, settle, wreckFor, apply, WRECK } from '../src/planet/wreck.js';
import { podsPlan, podCount, sleeperOrder, footprintTris, PODS } from '../src/planet/pods.js';
import * as EXPLORER from '../kit/ships/explorer-built.hull.js';
import * as MINER from '../kit/ships/miner-built.hull.js';
import * as MEDIC from '../kit/ships/medic-built.hull.js';
import * as HAULER from '../kit/ships/hauler-built.hull.js';

const FILE = new URL('../assets/rescue/stasispod.glb', import.meta.url);
const bytes = fs.readFileSync(FILE), G = readGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
const { P, I } = G, parts = podPieces(P, I);
const pt = (v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
const cornersOf = (tris) => { const s = new Set(); for (const t of tris) for (let c = 0; c < 3; c++) s.add(I[t * 3 + c]); return [...s]; };

test('his file as he made it: one mesh, his 6,146 triangles, byte for byte his', () => {
  assert.equal(crypto.createHash('md5').update(bytes).digest('hex'), POD.md5);
  assert.equal(G.json.meshes.length, 1); assert.equal(G.json.materials.length, 1); assert.equal(G.json.images.length, 1);
  assert.equal(I.length / 3, POD.his.tris);
});

test('his lid is a piece of its own: every triangle on the lid or the base, nothing cut; the window all on the lid', () => {
  assert.equal(parts.lid.length + parts.base.length, POD.his.tris);
  assert.equal(new Set([...parts.lid, ...parts.base]).size, POD.his.tris, 'no triangle in both');
  // (the lid's own piece is the second biggest of his 26, the base the biggest; whatever rides on the lid stands over
  // POD.lidAbove, the base's all under it, with room either side)
  assert.equal(parts.pieces.length, 26);
  assert.ok(parts.pieces[0].mid[1] < POD.lidAbove && parts.pieces[1].mid[1] > POD.lidAbove);
  for (const p of parts.pieces) assert.ok(Math.abs(p.mid[1] - POD.lidAbove) > 0.01, `a piece's middle ${p.mid[1].toFixed(3)} too near the line`);
  const lid = new Set(parts.lid);
  for (const t of POD.window) assert.ok(lid.has(t), `window triangle ${t} is not on the lid`);
  assert.equal(new Set(POD.window).size, POD.window.length);
});

test('the lid\'s hinge: turned shut and open again it is back exactly where he made it; and back exactly to shut', () => {
  const pts = cornersOf(parts.lid).map(pt);
  const shut = lidAngle(0), open = lidAngle(1);
  assert.equal(open, 0, 'open is as he made it');
  assert.ok(Math.abs(shut - POD.shut * Math.PI / 180) < 1e-12);
  // shut, then back open: his own points
  for (const p of pts) { const q = turnLid(turnLid(p, shut), -shut); for (let c = 0; c < 3; c++) assert.ok(Math.abs(q[c] - p[c]) < 1e-12); }
  // shut, opened part way (any way there), then shut again: the shut place exactly
  for (const k of [0.13, 0.5, 0.97, 1]) for (const p of pts.slice(0, 400)) {
    const s = turnLid(p, shut), part = turnLid(p, lidAngle(k)), back = turnLid(part, shut - lidAngle(k));
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(back[c] - s[c]) < 1e-12);
  }
  // the turn is about the hinge line itself: its points stay put
  const h = [0.123, POD.hinge[0], POD.hinge[1]], hs = turnLid(h, shut); for (let c = 0; c < 3; c++) assert.ok(Math.abs(hs[c] - h[c]) < 1e-12);
  // the lid's length along the hinge never changes; nothing of it goes round further than shut (k is kept 0..1)
  assert.equal(lidAngle(-1), shut); assert.equal(lidAngle(2), open);
});

test('shut, the lid lies on the base: its front edge down on the front rim, its back on the back rim', () => {
  // the base's top under a point (a vertical line through its triangles)
  const base = parts.base.map((t) => [0, 1, 2].map((c) => pt(I[t * 3 + c])));
  const topAt = (x, z) => { let h = -Infinity; for (const [p, q, r] of base) { const d0 = (q[0] - p[0]) * (r[2] - p[2]) - (r[0] - p[0]) * (q[2] - p[2]); if (Math.abs(d0) < 1e-12) continue; const u = ((x - p[0]) * (r[2] - p[2]) - (r[0] - p[0]) * (z - p[2])) / d0, v = ((q[0] - p[0]) * (z - p[2]) - (x - p[0]) * (q[2] - p[2])) / d0; if (u < 0 || v < 0 || u + v > 1) continue; h = Math.max(h, p[1] + u * (q[1] - p[1]) + v * (r[1] - p[1])); } return h; };
  const lidPiece = parts.pieces[1].tris.map((t) => [0, 1, 2].map((c) => turnLid(pt(I[t * 3 + c]), lidAngle(0))));
  const lowAt = (x, z) => { let h = Infinity; for (const [p, q, r] of lidPiece) { const d0 = (q[0] - p[0]) * (r[2] - p[2]) - (r[0] - p[0]) * (q[2] - p[2]); if (Math.abs(d0) < 1e-12) continue; const u = ((x - p[0]) * (r[2] - p[2]) - (r[0] - p[0]) * (z - p[2])) / d0, v = ((q[0] - p[0]) * (z - p[2]) - (x - p[0]) * (q[2] - p[2])) / d0; if (u < 0 || v < 0 || u + v > 1) continue; h = Math.min(h, p[1] + u * (q[1] - p[1]) + v * (r[1] - p[1])); } return h; };
  // along the front edge (his z 0.157) and the back (z -0.083), across the middle of its length: the gap to the rim
  // under it, in his units (at its size, 1 is 3.2 m): within 0.015 (5 cm), never into the base there. (His lid sits a
  // little askew: its back edge reaches over the back rim from the middle to the head end only)
  for (const [z, xs] of [[0.157, [-0.2, -0.1, 0, 0.1, 0.2]], [-0.083, [0, 0.1, 0.2]]]) for (const x of xs) {
    const g = lowAt(x, z) - topAt(x, z);
    assert.ok(g > -0.002 && g < 0.015, `x ${x}, z ${z}: the lid ${g.toFixed(3)} over the rim`);
  }
});

test('its size: one of our crew fits on the bed (measured lying, 1.80 to 1.93 m, in the rigs), turned level on the floor', () => {
  const s = podScale(), bed = (BED.head - BED.foot) * s;
  assert.ok(Math.abs(POD.long - POD.his.long * s) < 1e-9);
  // (the longest of the eight lying, crown to toes, as the Kit Lab measured them: 1.926 m; 2 cm kept at each end)
  assert.ok(bed >= 1.926 + 0.04, `the bed is ${bed.toFixed(3)} m wall to wall`);
  // turned level: his underside's lowest points at either end within 2 cm of each other
  let head = Infinity, foot = Infinity;
  for (let v = 0; v < P.length / 3; v++) { const [x, y] = pt(v); const ly = levelY(x, y); if (x > 0.35) head = Math.min(head, ly); if (x < -0.35) foot = Math.min(foot, ly); }
  assert.ok(Math.abs(head - foot) * s < 0.02, `head end ${(head * s).toFixed(3)} m, foot end ${(foot * s).toFixed(3)} m`);
});

// ── the pods on the ground ───────────────────────────────────────────────────────────────────────────────────────
const buf = (s) => { const b = Buffer.from(s, 'base64'), u = new Uint8Array(b.length); u.set(b); return u.buffer; };
function hullSoup({ HULL, Q }) {
  const p = new Int16Array(buf(HULL.pos)), t = new Uint16Array(buf(HULL.tris)), pos = new Float32Array(t.length * 3);
  for (let i = 0; i < t.length; i++) for (let c = 0; c < 3; c++) pos[i * 3 + c] = p[t[i] * 3 + c] / Q;
  return { skin: { position: { size: 3, array: pos } } };
}
const HULLS = { explorer: hullSoup(EXPLORER), miner: hullSoup(MINER), medic: hullSoup(MEDIC), hauler: hullSoup(HAULER) };
const boxOf = (soups) => { const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (const S of Object.values(soups)) { const A = S.position.array; for (let i = 0; i < A.length; i += 3) for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], A[i + c]); max[c] = Math.max(max[c], A[i + c]); } } return { min, max }; };
// the seed's wreck laid on a land, and its triangles where they lie (as the Planet Lab hands them to the pods)
function wreckOn(land, seed = land.seed) {
  const w = wreckFor(seed), soups = HULLS[w.ship], plan = wreckPlan(seed, boxOf(soups), { ship: w.ship, pieces: w.pieces }), broken = breakApart(soups, plan);
  const ps = broken.pieces.map((pc) => { const pts = pc.skin.position.array, b = boxOf(pc); return { pts, pivot: [0, 1, 2].map((c) => (b.min[c] + b.max[c]) / 2) }; });
  const placed = settle(ps, land, wreckSite(land, seed), plan);
  const tris = []; placed.mats.forEach((m, k) => { const A = ps[k].pts; for (let i = 0; i < A.length; i += 3) tris.push(...apply(m, A[i], A[i + 1], A[i + 2])); });
  return { site: placed.site, tris: Float32Array.from(tris) };
}
// three planets of the kinds: the moon (11), a meadow (7), a canyon (3), and a few more; coarser ground than the game's
const LANDS = [['moon', 11], ['meadow', 7], ['canyon', 3], ['moon', 17], ['meadow', 50], ['canyon', 26]].map(([kind, seed]) => makeLand(seed, { kind, n: 512 }));
const WRECKS = new Map(LANDS.map((L) => [L, wreckOn(L)]));
// the least distance across the ground from a point to a triangle
function toTri(x, z, t, T) {
  const a = [T[t], T[t + 2]], b = [T[t + 3], T[t + 5]], c = [T[t + 6], T[t + 8]];
  const s = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]), P0 = [x, z];
  const d1 = s(a, b, P0), d2 = s(b, c, P0), d3 = s(c, a, P0);
  if ((d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0)) return 0;
  const seg = (p, q) => { const vx = q[0] - p[0], vz = q[1] - p[1], L = vx * vx + vz * vz || 1e-12, u = Math.max(0, Math.min(1, ((x - p[0]) * vx + (z - p[1]) * vz) / L)); return Math.hypot(p[0] + u * vx - x, p[1] + u * vz - z); };
  return Math.min(seg(a, b), seg(b, c), seg(c, a));
}

test('how many: 3 to 6 by the planet\'s seed, each count coming up; who sleeps in them, no two the same', () => {
  const seen = new Map();
  for (let s = 1; s <= 400; s++) { const n = podCount(s); assert.equal(n, podCount(s)); assert.ok(n >= 3 && n <= 6, `seed ${s}: ${n}`); seen.set(n, (seen.get(n) || 0) + 1); }
  for (const n of [3, 4, 5, 6]) assert.ok(seen.get(n) > 60, `${n} pods came up ${seen.get(n) || 0} times in 400 seeds`);
  for (let s = 1; s <= 50; s++) { const o = sleeperOrder(s); assert.deepEqual([...o].sort(), [0, 1, 2, 3, 4, 5, 6, 7]); assert.deepEqual(o, sleeperOrder(s)); }
});

test('the pods lie beside the wreck: never on the landing place, clear of the wreck, apart enough to walk between, near it', () => {
  for (const land of LANDS) {
    const W = WRECKS.get(land), plan = podsPlan(land, land.seed, W), L = land.landing, T = W.tris, tag = `${land.kind.id} ${land.seed}`;
    assert.equal(plan.pods.length, podCount(land.seed), `${tag}: ${plan.pods.length} of ${podCount(land.seed)} pods`);
    plan.pods.forEach((p, i) => {
      // its footprint's points, across the ground
      const near = Math.min(...p.foot.map(([x, , z]) => Math.hypot(x - L.x, z - L.z)));
      assert.ok(near >= L.flat + PODS.ring - 1e-6, `${tag} pod ${i}: ${(near - L.flat).toFixed(2)} m past the landing place`);
      let dw = Infinity; for (const [x, , z] of p.foot) for (let t = 0; t < T.length; t += 9) dw = Math.min(dw, toTri(x, z, t, T));
      assert.ok(dw >= PODS.wreck[0] - 0.05, `${tag} pod ${i}: ${dw.toFixed(2)} m from the wreck`);
      assert.ok(dw < 8, `${tag} pod ${i}: ${dw.toFixed(2)} m from the wreck: not beside it`);
      plan.pods.forEach((q, j) => {
        if (j <= i) return;
        let g = Infinity; for (const [ax, , az] of p.foot) for (const [bx, , bz] of q.foot) g = Math.min(g, Math.hypot(ax - bx, az - bz));
        assert.ok(g >= PODS.apart[0] - 0.05, `${tag} pods ${i} and ${j}: ${g.toFixed(2)} m apart`);
      });
    });
  }
});

test('each pod sits on the ground: leant with it, sunk a little, none of it above the ground under it', () => {
  for (const land of LANDS) {
    const plan = podsPlan(land, land.seed, WRECKS.get(land)), tag = `${land.kind.id} ${land.seed}`;
    for (const p of plan.pods) {
      // every point of its footprint under the ground: at least PODS.sink[0], no deeper than PODS.sink[1]
      for (const [x, y, z] of p.foot) { const d = land.heightAt(x, z) - y; assert.ok(d >= PODS.sink[0] - 1e-6 && d <= PODS.sink[1], `${tag}: a foot point ${d.toFixed(3)} m under the ground`); }
      assert.ok(p.tilt <= PODS.tilt + 1e-9);
      // its frame upright with the ground's lean: y up within the tilt, its axes square
      const m = p.mat, X = [m[0], m[1], m[2]], Y = [m[4], m[5], m[6]], Z = [m[8], m[9], m[10]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      assert.ok(Math.acos(Math.min(1, Y[1])) <= PODS.tilt + 1e-6);
      for (const [a, b] of [[X, Y], [Y, Z], [X, Z]]) assert.ok(Math.abs(dot(a, b)) < 1e-9);
    }
    // the ground under them marked clear for the cover and the trees (the footprints as triangles)
    const F = footprintTris(plan); assert.equal(F.length, plan.pods.length); for (const f of F) assert.equal(f.tris.length, 18);
  }
});

test('the same seed and the same wreck, the same pods in the same places; another seed, other places', () => {
  const land = LANDS[1], W = WRECKS.get(land), a = podsPlan(land, land.seed, W), b = podsPlan(land, land.seed, W);
  assert.deepEqual(a.pods.map((p) => p.mat), b.pods.map((p) => p.mat));
  assert.deepEqual(a.pods.map((p) => p.look), b.pods.map((p) => p.look));
  const c = podsPlan(land, land.seed + 1, W);
  assert.notDeepEqual(a.pods.map((p) => p.mat), c.pods.map((p) => p.mat));
});
