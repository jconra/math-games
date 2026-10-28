// THE WIND PUMP: a farm windmill of the 1880s, all wood, as the Halladay and Eclipse pumps of the day were: a tall tower
// of four legs leaning in, girts and X braces between them (none on the ladder's side: its rungs run up between the
// legs), a little platform at the top; on it the head (a wooden box over the crank, on an iron turntable), the wheel of
// slats on two rings facing the wind, and a tail vane of boards behind to keep it there; the pump rod down the middle of
// the tower to an iron pump at its foot, its pipe out past the legs to the stock tank (the town's own trough, put down
// beside it). Built from the Building Lab's parts like the town's buildings; the wheel turns (B.spins:
// objects/codebuild.js turns it about its axle, the Building Lab too).
//
//   buildWindpump(recipe, env) -> the same shape as the other buildings: { geos (wood, iron), spins [{ geos: { wood },
//     at: [x, y, z] (the axle's middle), axis: [0, 0, 1], speed (radians a second) }], doors [] (none), lamps [],
//     light (the baked light: outdoors only), props [], anchors (footprint, doorways: none), views, offset, kit }
//
// Frame: the tower centred on x = z = 0, the ground at y = 0, the wheel faces +z, the pump's pipe runs out along +x. Metres.
// A RECIPE: wood (the trim sheet's look), wear (how weathered), seed.

import * as THREE from 'three';
import { Kit, buildGeometry, Occlusion } from '../materials/cabin.js';
import { rng, WOOD_LOOKS } from '../materials/textures.js';
import { T, RX, RY, RZ, mul, vary, ngon, Light } from './parts.js';
import { tintAt } from './cabins.js';

export const WINDPUMP_DEFAULTS = { kind: 'windpump', paint: 'none', wear: 0.5, wood: 'straight', seed: 11 };
export function windpumpRecipe(r = {}) {
  const o = { ...WINDPUMP_DEFAULTS, ...r };
  o.paint = 'none';
  o.wear = Math.min(1, Math.max(0, Number.isFinite(+o.wear) ? +o.wear : WINDPUMP_DEFAULTS.wear));
  if (!WOOD_LOOKS[o.wood]) o.wood = WINDPUMP_DEFAULTS.wood;
  o.seed = Math.max(1, Math.round(+o.seed) || 1);
  return o;
}

// ── the sizes ────────────────────────────────────────────────────────────────────────────────────────────────────────
const TALL = 9.5;                 // the platform at the tower's top
const BASE = 1.3, TOP = 0.38;     // half the legs' spread at the foot, and at the top
const SUNK = 0.3;                 // the legs' feet go this far into the ground (it is never quite level)
const WHEEL = 2.3;                // the wheel's radius
const AXLE = [0, TALL + 0.38, 0.62];
const TURN = 0.55;                // the wheel's turn in a fair breeze (radians a second)
const GIRTS = [0.06, 0.3, 0.55, 0.8];   // shares of the height
export const WINDPUMP = { TALL, BASE, TOP, WHEEL, AXLE };

const LEG = [0.98, 0.9, 0.82], BRACE = [1.04, 0.96, 0.86], BLADE = [1.08, 1.02, 0.94], IRON = [0.85, 0.8, 0.76];
const half = (y) => BASE + (TOP - BASE) * Math.max(0, y) / TALL;   // the legs' half spread at a height

// a board from a to b (its long axis along y), t across and d deep, its deep side facing n
function stick(k, a, b, t, d, n, o = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), Y = B.clone().sub(A), L = Y.length(); Y.normalize();
  const Z = new THREE.Vector3(...n); Z.addScaledVector(Y, -Z.dot(Y)).normalize(); const X = new THREE.Vector3().crossVectors(Y, Z);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(A.add(B).multiplyScalar(0.5));
  k.board([t, L, d], null, null, { long: 1, ...o, m });
  return { m, L };
}

export function buildWindpump(recipeIn = {}, env = {}) {
  const t0 = performance.now(), r = windpumpRecipe(recipeIn);
  const k = new Kit(r.seed);
  // THE TOWER: the legs (their feet a little into the ground), each a solid a walker goes round
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of corners) {
    const a = [sx * half(-SUNK), -SUNK, sz * half(-SUNK)], b = [sx * TOP, TALL, sz * TOP];
    const { m, L } = stick(k, a, b, 0.15, 0.15, [sx, 0, sz], { tint: vary(k, LEG, 0.9, 1.05), strip: 10, ends: 'log', cuts: [-3, 0, 3], segFaces: '+x-x+z-z' });
    k.solid([0.16, L, 0.16], null, null, m);
  }
  // the girts round all four faces, X braces between them (not on the ladder's side, -x), the ladder's rungs there
  const faces = [[0, 1], [0, -1], [1, 0], [-1, 0]];   // (outward: +z, -z, +x, -x)
  for (const [fx, fz] of faces) {
    const at = (u, y, out) => { const h = half(y) + out; return fz ? [u * h, y, fz * h] : [fx * h, y, u * h]; };
    for (const f of GIRTS) { const y = f * TALL; stick(k, at(-1.06, y, 0.1), at(1.06, y, 0.1), 0.12, 0.05, [fx, 0, fz], { tint: vary(k, BRACE, 0.88, 1.05) }); }
    if (fx < 0) {
      for (let y = 0.45; y < TALL - 0.25; y += 0.42) stick(k, at(-0.96, y, 0.13), at(0.96, y, 0.13), 0.04, 0.04, [fx, 0, fz], { tint: vary(k, BRACE, 0.85, 1.0) });
      continue;
    }
    for (let i = 0; i < GIRTS.length - 1; i++) {
      const ya = GIRTS[i] * TALL + 0.1, yb = GIRTS[i + 1] * TALL - 0.1;
      for (const s of [-1, 1]) stick(k, at(-0.92 * s, ya, 0.06), at(0.92 * s, yb, 0.06), 0.1, 0.035, [fx, 0, fz], { tint: vary(k, BRACE, 0.85, 1.02) });
    }
  }
  // the platform at the top: boards across on two bearers, a rim
  for (const s of [-1, 1]) k.board([1.7, 0.1, 0.1], [0, TALL - 0.08, s * 0.45], null, { long: 0, tint: vary(k, BRACE, 0.85, 1.0), strip: 10 });
  for (let x = -0.8; x < 0.8; x += 0.2) k.board([0.19, 0.04, 1.6], [x + 0.1, TALL - 0.01, 0], null, { long: 2, tint: vary(k, BRACE, 0.85, 1.1) });
  // THE HEAD: an iron turntable, the wooden box over the crank, the main shaft forward to the wheel's hub, the tail
  k.prism('iron', ngon(12, 0.3), 0.08, [0, TALL + 0.06, 0], null, { tint: IRON.map((c) => c * 0.8), smooth: true });
  k.board([0.46, 0.42, 1.0], [0, TALL + 0.32, -0.05], null, { long: 2, tint: vary(k, LEG, 0.85, 0.95), strip: 10 });
  k.board([0.56, 0.05, 1.12], [0, TALL + 0.555, -0.05], null, { long: 2, tint: vary(k, BRACE, 0.75, 0.85) });   // its lid
  k.prism('iron', ngon(8, 0.05), 0.5, null, null, { m: mul(T(AXLE[0], AXLE[1], 0.32), RX(Math.PI / 2)), tint: IRON, smooth: true });
  // the tail: an arm back from the head, a brace, the vane of boards
  k.board([0.08, 0.1, 1.8], [0, TALL + 0.38, -1.4], null, { long: 2, tint: vary(k, LEG, 0.9, 1.0), strip: 10 });
  k.board([0.05, 0.06, 1.25], [0, TALL + 0.2, -1.05], [-0.28, 0, 0], { long: 2, tint: vary(k, BRACE, 0.85, 1.0) });
  for (let i = 0; i < 4; i++) k.board([0.025, 0.95, 0.24], [0, TALL + 0.45, -1.9 - i * 0.245], null, { long: 1, tint: vary(k, BLADE, 0.88, 1.06) });
  for (const y of [TALL + 0.1, TALL + 0.8]) k.board([0.045, 0.06, 1.05], [0.03, y, -2.27], null, { long: 2, tint: vary(k, BRACE, 0.8, 0.95) });
  // THE PUMP: the rod down the middle of the tower, the pump at its foot on a plank well cover, its pipe out toward +x
  k.prism('iron', ngon(6, 0.018), TALL - 0.4, [0, (TALL + 0.6) / 2, 0], null, { tint: IRON.map((c) => c * 0.7) });
  for (const f of GIRTS.slice(1)) k.board([0.6, 0.06, 0.08], [0, f * TALL, 0], null, { long: 0, tint: vary(k, BRACE, 0.8, 0.95) });   // the rod's guides
  for (let x = -0.6; x < 0.6; x += 0.24) k.board([0.23, 0.06, 1.2], [x + 0.12, 0.03, 0], null, { long: 2, tint: vary(k, BRACE, 0.75, 0.95) });
  k.prism('iron', ngon(10, 0.085), 0.85, [0, 0.48, 0], null, { tint: IRON.map((c) => c * 0.75), smooth: true });
  k.prism('iron', ngon(10, 0.11), 0.1, [0, 0.93, 0], null, { tint: IRON.map((c) => c * 0.7), smooth: true });
  k.box('iron', [1.85, 0.06, 0.06], [1.02, 0.66, 0], [0, 0, -0.05], { tint: IRON.map((c) => c * 0.75) });   // (the pipe out to the stock tank, just past the legs)
  k.box('iron', [0.05, 0.6, 0.05], [-0.12, 1.1, 0], [0, 0, 0.5], { tint: IRON.map((c) => c * 0.75) });   // the handle, for a still day
  k.solid([1.2, 0.06, 1.2], [0, 0.03, 0]); k.solid([0.24, 1.0, 0.24], [0, 0.5, 0]);

  // THE WHEEL, in its own frame (the axle along z, its face toward +z): a hub, six arms, an inner and an outer ring of
  // short boards, eighteen slats between them each turned to the wind
  const w = new Kit(r.seed * 7 + 3), n = 18, r0 = WHEEL * 0.42, r1 = WHEEL * 0.97;
  w.prism('wood', ngon(10, 0.17), 0.3, null, null, { m: RX(Math.PI / 2), tint: vary(w, LEG, 0.8, 0.9), smooth: true, ends: 'log' });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; w.board([0.07, r1 - 0.12, 0.05], null, null, { m: mul(RZ(a), T(0, (r1 + 0.12) / 2, -0.06)), long: 1, tint: vary(w, LEG, 0.85, 1.0), strip: 10 }); }
  for (const [rr, th] of [[r0, 0.06], [WHEEL, 0.07]]) for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n * Math.PI * 2, Lr = 2 * rr * Math.sin(Math.PI / n) + 0.02;
    w.board([Lr, th, 0.05], null, null, { m: mul(RZ(a), T(0, rr, 0)), long: 0, tint: vary(w, BRACE, 0.85, 1.0), skip: '+x-x' });
  }
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    w.board([0.2, r1 - r0 + 0.04, 0.018], null, null, { m: mul(RZ(a), T(0, (r0 + r1) / 2, 0.035), RY(0.55)), long: 1, tint: vary(w, BLADE, 0.85, 1.1), strip: Math.floor(w.R() * 10) });
  }

  // the parts into meshes
  const R = rng(r.seed + 1), geos = {}, topAt = () => TALL + 1;
  geos.wood = buildGeometry(k.parts.wood, 'wood', R, { topAt, tintAt });
  geos.iron = buildGeometry(k.parts.iron, 'iron', R, { topAt });
  const wheel = buildGeometry(w.parts.wood, 'wood', rng(r.seed + 5), { topAt, tintAt });
  const msBuild = performance.now() - t0;
  // THE BAKE: outdoors only (no inside, no openings): the near shading, the legs shading one another a little
  const t1 = performance.now();
  const occ = new Occlusion(k.occ, 1.6, 0.08, { reach: 2.4, rays: 14, groundReach: 0.7 });
  const light = new Light(occ, { inside: () => false, openings: [], lamps: [], base: 0.3, out: [0.5, 0.5] });
  for (const g of Object.values(geos)) light.bake(g);
  light.bake(wheel, T(...AXLE));
  light.setDoors = () => { for (const g of Object.values(geos)) light.apply(g, true); light.apply(wheel, true); };
  light.setDoors();
  light.offset = 0;
  const msBake = performance.now() - t1;
  const box = new THREE.Box3(); for (const g of Object.values(geos)) { g.computeBoundingBox(); box.union(g.boundingBox); }
  const f2 = (x) => +x.toFixed(2), sp = f2(2 * BASE + 0.4);
  // (the footprint as the town lays it out: the legs' spread at the foot; the wheel and the tail are high overhead)
  const anchors = { footprint: { w: sp, d: sp, h: f2(AXLE[1] + WHEEL), x0: -sp / 2, x1: sp / 2, z0: -sp / 2, z1: sp / 2 }, floor: 0, doorways: [], rooms: [], pipe: [1.95, 0.61, 0] };   // (pipe: where the pump's pipe ends, over the stock tank)
  const counts = { wood: k.parts.wood.length, iron: k.parts.iron.length, wheel: w.parts.wood.length };
  const B = { recipe: r, geos, spins: [{ geos: { wood: wheel }, at: AXLE.slice(), axis: [0, 0, 1], speed: TURN }], doors: [], lamps: [], light, occ, props: [], offset: 0, offsetZ: 0,
    anchors, counts, parts: counts.wood + counts.iron + counts.wheel, msBuild, msBake, ms: performance.now() - t0, marks: [], kit: k };
  B.views = {
    front: [[-6, 5, 16], [0, 6, 0]], front34: [[-11, 4, 11], [0, 6, 0]], head: [[-2.6, TALL + 1.4, 4.2], [0, TALL + 0.3, 0]],
    foot: [[3.2, 1.6, 3.4], [0, 0.8, 0]], side: [[14, 5, 0], [0, 6, 0]], back34: [[9, 5, -11], [0, 6, 0]], far: [[-40, 9, 58], [0, 6, 0]],
  };
  return B;
}
