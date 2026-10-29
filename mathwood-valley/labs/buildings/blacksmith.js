// THE BLACKSMITH: a board-and-batten smithy on a mortared fieldstone footing, with big double doors in its gable end up
// two stone steps, open inside to the rafters, a packed-earth floor level with its sill; a stone forge against the back wall with a sheet-iron hood and a stone chimney up through the
// roof, a pair of leather bellows on a frame beside it, a workbench with a vise under the windows, tongs and hammers on a
// rack, horseshoes on a board over the doors; on its right an open shoeing shed (a lean-to roof on posts) with a
// hitching rail. Built from the same parts as the cabins (cabins.js: the roof slopes, the window sashes, the weathering
// tints) and the Building Lab's parts.
//
//   buildBlacksmith(recipe, env) -> the same shape as the other buildings: { geos, doors (the double doors, the door
//     into the shed: their own meshes, they swing), lamps (a lantern, the forge's fire, a lantern on the shed),
//     light (the baked light), props (the anvil on its stump, the quench tub, the coal heap, a wagon wheel leaning on the
//     front, a barrel, the trough, the hitching rail, a bucket: props.js builds them, the Town Lab can move them),
//     anchors (footprint, doorways, rooms, forge), views, offset, kit (its solids: walls, the forge... for the walk grid) }
//   recipe.look 'far': no inside, the doors shut, the roof's undersides only at the eaves
//
// Frame: centred on its footprint when returned, the ground at y = 0, the doors face +z. Metres.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, buildGeometry, Occlusion } from '../materials/cabin.js';
import { rng, WOOD_LOOKS } from '../materials/textures.js';
import { buildStoneWall, SHAPES, PALETTES, MORTARS } from '../stone/stonewall.js';
import { T, RX, RY, RZ, mul, vary, smooth01, ngon, wallOf, wallM, wallP, boardAndBatten, casing, doorLeaf, lantern, glowGeometry, Light, GLOW } from './parts.js';
import { MAKERS } from './props.js';
import { makeBarrel } from '../materials/barrel.js';
import { CABIN_PAINTS, slope, sash, tintAt, cutsFor, onMean } from './cabins.js';

export const BS_PAINTS = CABIN_PAINTS;
export const BS_DEFAULTS = { kind: 'blacksmith', paint: 'none', wear: 0.6, wood: 'straight', stone: 'grey', mortar: 'grey', seed: 31, look: 'near' };
export function blacksmithRecipe(r = {}) {
  const o = { ...BS_DEFAULTS, ...r };
  if (!BS_PAINTS[o.paint]) o.paint = 'none';
  o.wear = Math.min(1, Math.max(0, Number.isFinite(+o.wear) ? +o.wear : 0.6));
  if (!WOOD_LOOKS[o.wood]) o.wood = BS_DEFAULTS.wood;
  if (!PALETTES[o.stone]) o.stone = BS_DEFAULTS.stone;
  if (!MORTARS[o.mortar]) o.mortar = BS_DEFAULTS.mortar;
  o.seed = Math.max(1, Math.round(+o.seed) || 1);
  if (o.look !== 'far') o.look = 'near';
  return o;
}

// ── the sizes ────────────────────────────────────────────────────────────────────────────────────────────────────────
const W = 7.0, D = 6.6, X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
const EAVE = 3.3, PITCH = 30 * Math.PI / 180, TP = Math.tan(PITCH), RIDGE = EAVE + W / 2 * TP;   // the ridge runs front to back
const FT = 0.16, FL = 0.15;                     // the sill's foot; the earth floor (packed level with the sill): both before the LIFT
// THE FOOTING (2026-10-28, the game's maker: "I usually like a foundation"): mortared fieldstone under all four walls, from
// DIG m into the ground up to FT + LIFT (0.3 m, the sheriff's office's height); the smithy is built as on the ground, then
// lifted LIFT m onto it (liftAll below), the shoeing shed's posts on stone piers PIER m high on the ground; broad stone
// steps up to the big doors, a step at the shed door (the Stone Lab's steps: slabs drawn down into the ground)
// ON THE LAND AS IT IS (env.ground, the game's maker: "foundations and stairs that go deep in the ground and the ground
// level is natural"): it sits as low as it can, its boards' foot (CLEAR m up) 2 cm over the highest ground under its
// walls (B.sit: how far its zero is over the ground at its middle); the footing, the piers and the steps go down to the
// ground wherever it is, SINK m into it; more steps where the ground at a door is lower
const LIFT = 0.14, DIG = 0.2, PIER = 0.15, CLEAR = FT - 0.04 + LIFT, SINK = 0.1, RISE = 0.135;
const OVE = 0.45, OVG = 0.4;                    // the roof past the side walls; past the front and back
const SHED = { x0: X1, x1: X1 + 3.1, top: 3.0, pitch: 12 * Math.PI / 180 };   // the shoeing shed on the right
const DOOR = { a0: -1.45, a1: 1.45, y1: 2.75 };                                   // the double doors (front)
const FORGE = { x0: -2.05, x1: -0.45, z0: Z0 + 0.12, z1: Z0 + 1.22, h: 0.8 };   // the forge against the back wall
const STACK = { x: -1.25, z: Z0 + 0.6, w: 0.62, d: 0.55 };                       // its chimney
const roofY = (x) => RIDGE - Math.abs(x) * TP;
const BARE = [1.1, 1.1, 1.12], INNER = [1.08, 1.02, 0.94], TRIM = [0.95, 0.93, 0.92], FRAME = [1.06, 0.96, 0.84], DARKW = [0.8, 0.77, 0.74];
const IRON = [0.85, 0.8, 0.76], STRAP = [0.035, 0.032, 0.03], TIN = [5.4, 6.8, 8.4], DOORW = [1.1, 1.05, 1.0];
const EARTH = [0.34, 0.29, 0.23];

// ── the props it brings (registered with props.js's makers; nothing else there changes) ──────────────────────────────
// anvil: on an elm stump (the anvil's foot, waist, face and horn, iron); quench: a cut-down barrel of dark water;
// coal: a heap of coal in a plank bin; wheel: a wagon wheel leaning on a wall (lean: how far its foot stands out)
const put = (k, M, group, size, pos, rot, o = {}) => {
  const m = mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4());
  return group === 'wood' ? k.board(size, null, null, { ...o, m }) : k.box(group, size, null, null, { ...o, m });
};
const BS_MAKERS = {
  anvil(k, M) {
    k.prism('wood', ngon(9, 0.26, 0.08, k.R), 0.56, null, null, { m: mul(M, T(0, 0.28, 0)), tint: vary(k, [0.95, 0.85, 0.72], 0.85, 1.05), smooth: true, ends: 'log', strip: 11 });
    const y = 0.56, ir = IRON.map((q) => q * 0.75), face = IRON.map((q) => q * 0.95);
    // (its feet: four splayed, a base between them; the waist narrowing up to the body)
    put(k, M, 'iron', [0.3, 0.05, 0.2], [-0.01, y + 0.025, 0], null, { tint: ir });
    for (const [fx, fz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) put(k, M, 'iron', [0.09, 0.045, 0.07], [fx * 0.16 - 0.01, y + 0.022, fz * 0.11], [0, fx * fz * 0.4, 0], { tint: ir });
    k.prism('iron', [[-0.1, -0.075], [0.1, -0.075], [0.1, 0.075], [-0.1, 0.075]], 0.12, null, null, { m: mul(M, T(-0.01, y + 0.11, 0)), tint: ir, taper: 0.3 });
    // (the body and its face, the heel stepping out behind, a hardy hole in the heel)
    put(k, M, 'iron', [0.34, 0.1, 0.13], [0.0, y + 0.22, 0], null, { tint: face });
    put(k, M, 'iron', [0.12, 0.07, 0.1], [-0.22, y + 0.235, 0], null, { tint: face });
    put(k, M, 'iron', [0.026, 0.004, 0.026], [-0.24, y + 0.271, 0], null, { tint: [0.1, 0.1, 0.1] });
    // (the horn: a long round cone out of the body's front, its tip dropping a little)
    k.prism('iron', ngon(8, 0.06), 0.3, null, null, { m: mul(M, T(0.31, y + 0.225, 0), RZ(-Math.PI / 2 - 0.06)), tint: face, taper: 0.9, smooth: true, skip: '-y' });
    put(k, M, 'iron', [0.08, 0.09, 0.115], [0.19, y + 0.22, 0], null, { tint: face });
    k.solid([0.5, y + 0.32, 0.5], null, null, mul(M, T(0, (y + 0.32) / 2, 0)));
  },
  quench(k, M, o) {
    const v = new THREE.Vector3().setFromMatrixPosition(M);
    makeBarrel(k, { x: v.x, y: v.y, z: v.z, h: 0.5, r: 0.36, tint: [1.0, 0.95, 0.9], staves: 14, hoops: 2, lid: false });
    put(k, M, 'iron', [0.56, 0.01, 0.56], [0, 0.43, 0], null, { tint: [0.25, 0.3, 0.32] });
    k.solid([0.72, 0.5, 0.72], null, null, mul(M, T(0, 0.25, 0)));
    void o;
  },
  coal(k, M, o) {
    const w = o.w ?? 1.1, d = o.d ?? 0.8;
    for (const s of [-1, 1]) put(k, M, 'wood', [0.04, 0.42, d], [s * w / 2, 0.21, 0], null, { long: 2, tint: vary(k, DARKW, 0.7, 0.9) });
    put(k, M, 'wood', [w, 0.42, 0.04], [0, 0.21, d / 2], null, { long: 0, tint: vary(k, DARKW, 0.7, 0.9) });
    // the coal: lumps, small and dark, heaped higher at the back
    for (let i = 0; i < 70; i++) {
      const x = k.r(-w / 2 + 0.06, w / 2 - 0.06), z = k.r(-d / 2 + 0.05, d / 2 - 0.05), hy = 0.22 + 0.2 * (0.5 - z / d) * (1 - Math.abs(x) / w) + k.r(-0.04, 0.04), s = k.r(0.05, 0.1);
      put(k, M, 'iron', [s, s * 0.8, s], [x, hy, z], [k.r(0, 3), k.r(0, 3), k.r(0, 3)], { tint: [0.16, 0.16, 0.17] });
    }
    put(k, M, 'iron', [w - 0.05, 0.2, d - 0.05], [0, 0.12, 0], null, { tint: [0.14, 0.14, 0.15], skip: '-y' });
    k.solid([w, 0.45, d], null, null, mul(M, T(0, 0.22, 0)));
  },
  wheel(k, M, o) {
    // a wagon wheel stood on its rim, leaning back against a wall (its axle along z, out of the wall)
    const rad = o.r ?? 0.6, lean = o.lean ?? 0.16, n = 12, ring = rad - 0.04, tint = vary(k, DARKW, 0.9, 1.1);
    const W0 = mul(M, T(0, rad, 0), RX(-lean));
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * Math.PI * 2, Lf = 2 * rad * Math.sin(Math.PI / n) + 0.012;
      k.board([Lf, 0.075, 0.07], null, null, { m: mul(W0, RZ(a), T(0, ring, 0)), long: 0, tint, strip: 10, skip: '+x-x' });
      k.box('iron', [Lf, 0.012, 0.06], null, null, { m: mul(W0, RZ(a), T(0, rad, 0)), tint: [0.7, 0.66, 0.62], skip: '+x-x' });
    }
    for (let i = 0; i < 12; i++) k.board([0.035, ring - 0.09, 0.045], null, null, { m: mul(W0, RZ(i / 12 * Math.PI * 2), T(0, (ring + 0.09) / 2, 0)), long: 1, tint, skip: '+y-y' });
    k.prism('wood', ngon(8, 0.1), 0.24, null, null, { m: mul(W0, RX(Math.PI / 2)), tint: DARKW, smooth: true, ends: 'log' });
    k.solid([1.2, 1.2, 0.2], null, null, W0);
  },
};
for (const [n, f] of Object.entries(BS_MAKERS)) if (!MAKERS[n]) MAKERS[n] = f;

// ── building it ──────────────────────────────────────────────────────────────────────────────────────────────────────
const FRONT = wallOf(0, Z1), BACK = wallOf(Math.PI, -Z0), LEFT = wallOf(-Math.PI / 2, -X0), RIGHT = wallOf(Math.PI / 2, X1);
const wb = (k, f, size, a, y, out, rot, o) => k.board(size, null, null, { ...o, m: wallM(f, a, y, out, rot) });
// a horseshoe: seven short iron pieces round three quarters of a circle, its open end down, nail holes and all
function horseshoe(k, M, s = 1) {
  const r = 0.065 * s;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.62 + i / 6 * Math.PI * 1.24 + Math.PI / 2, L = r * 0.62;
    k.box('iron', [L, 0.022 * s, 0.012], null, null, { m: mul(M, T(Math.cos(a) * r, Math.sin(a) * r, 0), RZ(a + Math.PI / 2)), tint: [1.2, 0.95, 0.75] });
  }
}

// everything built so far moved dy m up (the parts, the bake's solids, the window panes, the forge's stone, the lamps)
function liftAll(c, k, dy) {
  const M = T(0, dy, 0);
  for (const g in k.parts) for (const P of k.parts[g]) { if (P.m) P.m.premultiply(M); if (P.pts) for (const p of P.pts) p.y += dy; }
  for (const S of k.occ) S.m.premultiply(M);
  for (let i = 0; i < c.panes.length; i += 2) c.panes[i].premultiply(M);
  for (const g of c.stoneGeos) g.translate(0, dy, 0);
  for (const L of c.lamps) { L.p = [L.p[0], L.p[1] + dy, L.p[2]]; if (L.glow) L.glow = [L.glow[0], L.glow[1] + dy, L.glow[2]]; }
}
// THE FOOTING: mortared fieldstone (the sheriff's tan fieldstone, which sheriff.js adds to the Stone Lab's palettes; the
// recipe's own stone if it isn't there) round under all four walls, 3 cm proud of the boards, from below the ground (DIG,
// or SINK under the lowest ground along it) up to the sill; broad steps up to the big doors and one or more at the shed
// door, stone slabs drawn down into the ground, as many as the ground before the door needs (each about RISE high, the
// sill the last); a square stone pier under each of the shed's posts, down into the ground under it. Every stone in the
// building's one stone mesh with the forge's and the chimney's. Its solids (for the bake and the walk grid) stop just
// under the earth floor, so the floor's own top isn't inside them. gl(x, z): the ground's height in its own frame
function footing(c, r, env, gl) {
  const { k } = c, e = 0.03, top = FT + LIFT, loop = [[X0 - e, Z1 + e], [X1 + e, Z1 + e], [X1 + e, Z0 - e], [X0 - e, Z0 - e]];
  // (the lowest ground along its walls, a sample every 0.4 m)
  let low = 0;
  for (let i = 0; i < 4; i++) { const [ax, az] = loop[i], [bx, bz] = loop[(i + 1) % 4], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.4);
    for (let j = 0; j <= n; j++) low = Math.min(low, gl(ax + (bx - ax) * j / n, az + (bz - az) * j / n)); }
  const y0 = Math.min(-DIG, low - SINK);
  // (where it meets the ground, for the rigs: B.anchors.feet [x, z, its bottom there])
  for (const [x, z] of loop) c.feet.push([x, z, y0]);
  // the steps: up from the lowest ground before the door (across the steps' width, out to where they would end) to the
  // sill's top, slabs each RISE or so high, the lower ones reaching further out; their skirts down SINK under the ground
  const SILL = FT + 0.02 + LIFT, steps = [], solids = [];
  const flight = (face, u, w, at) => {   // at(a, d): the ground a along the face, d out from it (its own frame)
    // (how many: the lowest ground under where they reach, which depends on how many: settled in a few rounds)
    let n = 2, g = 0;
    for (let round = 0; round < 6; round++) {
      g = Infinity; const run = (n - 1) * 0.42 + 0.1;
      for (let d = 0.05; d <= run + 1e-6; d += 0.2) for (let a = -w / 2; a <= w / 2 + 1e-6; a += w / 4) g = Math.min(g, at(a, d));
      const m = Math.max(2, Math.ceil((SILL - g) / RISE)); if (m <= n) break; n = m;
    }
    const rise = (SILL - g) / n;
    for (let i = 1; i < n; i++) { const h = g + rise * i, depth = (n - i) * 0.42; steps.push({ face, u, w: w + (n - 1 - i) * 0.1, depth, h, down: h - g + SINK }); solids.push([face, w, depth, h, g - SINK]); }
    for (const a of [-w / 2, 0, w / 2]) c.feet.push(face === 0 ? [a, Z1 + e + (n - 1) * 0.42, g - SINK] : [X1 + e + (n - 1) * 0.42, 0.75 + a, g - SINK]);   // (the lowest step's front edge)
  };
  flight(0, e - X0, 2.95, (a, d) => gl(a, Z1 + e + d));
  flight(1, Z1 + e - 0.75, 1.3, (a, d) => gl(X1 + e + d, 0.75 + a));
  SHAPES.smithyFoot = { label: 'Smithy footing', make: () => ({ H: top, sections: [{ loop0: loop, loop1: loop, y0, y1: top }], steps, openings: [], top: { y: top, t: 0, over: 0, rects: [] }, building: {} }) };
  const pier = [[-0.2, 0.2], [0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]];
  const rec = { style: 'mortared', palette: PALETTES.fieldstone ? 'fieldstone' : r.stone, mortar: r.mortar, size: c.far ? 0.6 : 0.4, irregularity: 0.5, colourMix: 0.5, bulge: 0.6, joint: 0.012 };
  const sw = buildStoneWall({ ...rec, shape: 'smithyFoot', seed: r.seed * 13 + 5 }, env);
  c.stoneGeos.push(sw.stone, sw.mortar); c.footTris = sw.tris.stone + sw.tris.mortar;
  c.piers.forEach((p, i) => {
    const py0 = Math.min(-DIG, gl(p.x, p.z) - SINK); c.feet.push([p.x, p.z, py0]);
    SHAPES.smithyPier = { label: 'Smithy shed pier', make: () => ({ H: PIER, sections: [{ loop0: pier, loop1: pier, y0: py0, y1: PIER }], openings: [], top: { y: PIER, t: 0, over: 0, rects: [] }, building: {} }) };
    const q = buildStoneWall({ ...rec, size: 0.3, shape: 'smithyPier', seed: r.seed * 17 + i }, env); for (const g of [q.stone, q.mortar]) { g.translate(p.x, 0, p.z); c.stoneGeos.push(g); } c.footTris += q.tris.stone + q.tris.mortar;
    k.solid([0.4, PIER - py0, 0.4], [p.x, (PIER + py0) / 2, p.z]);
  });
  const h = FL + LIFT - 0.02 - y0, y = (FL + LIFT - 0.02 + y0) / 2, t = 0.3;
  for (const s of [-1, 1]) { k.solid([W, h, t], [0, y, s < 0 ? Z0 + t / 2 : Z1 - t / 2]); k.solid([t, h, D - 2 * t], [s < 0 ? X0 + t / 2 : X1 - t / 2, y, 0]); }
  // (the steps: their tops stood on, each down into the ground)
  for (const [face, w, depth, hTop, yb] of solids) { const hh = hTop - yb;
    if (face === 0) k.solid([w, hh, depth], [0, yb + hh / 2, Z1 + e + depth / 2]); else k.solid([depth, hh, w], [X1 + e + depth / 2, yb + hh / 2, 0.75]); }
  c.footLow = low;
}

export function buildBlacksmith(recipeIn = {}, env = {}) {
  const t0 = performance.now(), r = blacksmithRecipe(recipeIn), far = r.look === 'far', paint = BS_PAINTS[r.paint].c;
  const k = new Kit(r.seed); k.parts.glow = []; k.parts.plaster = [];
  const c = { k, far, env, r, panes: [], sills: [], lamps: [], stoneGeos: [], trimTint: TRIM, trimPaint: null, L: { log: false, r: { cover: 'shakes' } }, piers: [], flats: [], feet: [] };
  const leaves = [];
  // where it sits on the land as it is (env.ground(x, z): the ground's height in its own frame, against the ground at its
  // middle; none: flat): its boards' foot 2 cm over the highest ground under its walls; gl, the ground in its frame then
  let sit = 0;
  if (env.ground) { let hi = -Infinity; for (let x = X0; x <= X1 + 1e-6; x += 0.35) for (let z = Z0; z <= Z1 + 1e-6; z += 0.33) hi = Math.max(hi, env.ground(x, z)); sit = hi - CLEAR + 0.02; }
  const gl = env.ground ? (x, z) => env.ground(x, z) - sit : () => 0;
  // THE WALLS: board and batten on a sill, up to the roof at the gable ends; their openings
  const top = (a) => roofY(a) - 0.035, topB = (a) => roofY(-a) - 0.035;
  const opens = {
    front: [{ a0: DOOR.a0, a1: DOOR.a1, y0: -1, y1: DOOR.y1, door: true }],
    back: [{ a0: -2.3, a1: -1.4, y0: 1.25, y1: 2.3 }],
    left: [{ a0: 1.15, a1: 2.05, y0: 1.2, y1: 2.3 }, { a0: -0.75, a1: 0.15, y0: 1.2, y1: 2.3 }],
    right: [{ a0: -1.3, a1: -0.2, y0: -1, y1: 2.2, door: true }, { a0: 1.5, a1: 2.4, y0: 1.2, y1: 2.3 }],
  };
  const walls = [[FRONT, X0, X1, top, 0, opens.front], [BACK, -X1, -X0, topB, 0, opens.back], [LEFT, Z0, Z1, () => EAVE + 0.012, undefined, opens.left], [RIGHT, -Z1, -Z0, () => EAVE + 0.012, undefined, opens.right]];
  for (const [f, a0, a1, tp, apex, op] of walls) {
    boardAndBatten(k, f, { a0, a1, y0: FT - 0.04, top: tp, apex, opens: op, paint, tint: BARE, inTint: far ? null : INNER, rows: [1.3, 2.3, 3.4, 4.4], bare: 0.06 });
    for (const [a, s] of [[a0, 1], [a1, -1]]) { const h = EAVE - FT + 0.04; wb(k, f, [0.12, h, 0.03], a + s * 0.06, FT + h / 2 - 0.04, 0.035, null, { long: 1, tint: vary(k, TRIM, 0.85, 1.05), paint, skip: '-z-y', cuts: [-1.2, 0, 1.2], segFaces: '+z', outside: true }); }
    wb(k, f, [a1 - a0 + 0.02, 0.16, 0.14], (a0 + a1) / 2, FT - 0.06, -0.05, null, { long: 0, tint: vary(k, FRAME, 0.75, 0.9), strip: 10, skip: '-z' });
    for (const o of op) {
      if (o.door) {
        const dw = o.a1 - o.a0;
        // (the trim round a door: a board up each side, a header; the reveal lining it through the wall)
        casing(k, f, { ...o, y0: FL, door: true }, { tint: TRIM, depth: 0.16, width: 0.12 });
        if (dw > 2) wb(k, f, [dw + 0.5, 0.2, 0.12], (o.a0 + o.a1) / 2, o.y1 + 0.32, 0.06, null, { long: 0, tint: vary(k, FRAME, 0.8, 0.95), strip: 10 });   // (a lintel beam over the big doors)
      } else {
        casing(k, f, o, { tint: TRIM, depth: 0.16, width: 0.1 });
        sash(c, { f }, o, 2, 3, -0.05);
      }
    }
  }
  // the sign: a long board in the gable over the big doors, BLACKSMITH painted on it (its letters a picture, sign()
  // below), a horseshoe nailed either side of it for luck
  const SIGN = { y: DOOR.y1 + 0.82, w: 2.7, h: 0.56 };
  {
    wb(k, FRONT, [SIGN.w, SIGN.h, 0.04], 0, SIGN.y, 0.06, null, { long: 0, tint: vary(k, DARKW, 0.7, 0.8) });
    for (const s of [-1, 1]) wb(k, FRONT, [SIGN.w + 0.08, 0.05, 0.05], 0, SIGN.y + s * (SIGN.h / 2 + 0.02), 0.07, null, { long: 0, tint: vary(k, DARKW, 0.6, 0.7) });
    for (const s of [-1, 1]) horseshoe(k, mul(wallM(FRONT, s * (SIGN.w / 2 + 0.24), SIGN.y, 0.06), RZ(Math.PI)), 1.35);
  }
  // the solids for the bake: the walls, the attic of the gables
  // THE ROOF: shakes on two slopes, the ridge front to back; open inside to the rafters (their undersides lit inside)
  const hole = (p) => p.x > STACK.x - STACK.w / 2 + 0.05 && p.x < STACK.x + STACK.w / 2 - 0.05 && p.z > STACK.z - STACK.d / 2 + 0.05 && p.z < STACK.z + STACK.d / 2 - 0.05;
  const len = (W / 2 + OVE) / Math.cos(PITCH), roofO = { cover: 'shakes', pitch: PITCH, topY: RIDGE, len, eaveS: OVE / Math.cos(PITCH), sheath: far ? 'eave' : 'all', inside: true, keep: (p) => !hole(p), barge: [true, true], rafterT: FRAME, boardT: INNER.map((q) => q * 0.85) };
  slope(c, mul(T(0, 0.02, 0), RY(Math.PI / 2)), { ...roofO, x0: -(Z1 + OVG), x1: -(Z0 - OVG), inX0: -Z1, inX1: -Z0, comb: true });
  slope(c, mul(T(0, 0.02, 0), RY(-Math.PI / 2)), { ...roofO, x0: Z0 - OVG, x1: Z1 + OVG, inX0: Z0, inX1: Z1 });
  // tie beams across at the plates, the plates along the side walls
  if (!far) for (const z of [-2.2, 0, 2.2]) k.board([W - 0.1, 0.18, 0.12], [0, EAVE - 0.12, z], null, { long: 0, tint: vary(k, FRAME, 0.8, 0.95), strip: 10, cuts: cutsFor(W, [], 1.4), segFaces: '-y+z-z', ends: 'log', inside: true });
  for (const s of [-1, 1]) k.board([0.14, 0.14, D - 0.1], [s * (W / 2 - 0.13), EAVE - 0.07, 0], null, { long: 2, tint: vary(k, FRAME, 0.8, 0.95), strip: 10, inside: true, skip: s < 0 ? '-x' : '+x' });
  // THE SHOEING SHED: a lean-to roof on three posts and a beam, open on three sides
  {
    const sl = (SHED.x1 - SHED.x0 + 0.3) / Math.cos(SHED.pitch), postX = SHED.x1 - 0.12;
    slope(c, mul(T(X1 + 0.01, 0, 0), RY(Math.PI / 2)), { cover: 'shakes', pitch: SHED.pitch, topY: SHED.top, len: sl, eaveS: sl, sheath: 'all', x0: -(Z1 + 0.3), x1: -(Z0 - 0.3), inX0: -Z1, inX1: -Z0, barge: [true, true], rafterT: FRAME, boardT: INNER.map((q) => q * 0.9) });
    k.board([0.1, 0.16, D + 0.6], [X1 + 0.06, SHED.top - 0.13, 0], null, { long: 2, tint: FRAME, strip: 11 });
    const beamTop = SHED.top - (postX - X1) * Math.tan(SHED.pitch) - (0.024 + 0.14) / Math.cos(SHED.pitch);
    k.board([0.16, 0.2, D + 0.5], [postX, beamTop - 0.1, 0], null, { long: 2, tint: vary(k, FRAME, 0.95, 1.05), strip: 10, cuts: cutsFor(D + 0.5, [], 1.6), segFaces: '+x-x-y', ends: 'log' });
    k.solid([0.2, 0.2, D + 0.5], [postX, beamTop - 0.1, 0]);
    // (the posts stand on their stone piers on the ground (footing below): made longer and lower here by what everything
    // else is lifted onto the footing, liftAll; their braces up with the beam)
    for (const z of [Z0 + 0.15, 0, Z1 - 0.15]) {
      const h = beamTop - 0.2, hp = h + LIFT - PIER;
      k.board([0.15, hp, 0.15], [postX, PIER + hp / 2 - LIFT, z], [0, k.r(-0.04, 0.04), 0], { long: 1, tint: vary(k, FRAME, 0.9, 1.08), strip: 10, cuts: [-0.6, 0.4], segFaces: '+x-x+z-z', ends: 'log' });
      k.solid([0.15, hp, 0.15], [postX, PIER + hp / 2 - LIFT, z]);
      for (const s of [-1, 1]) if ((s < 0 && z > Z0 + 0.5) || (s > 0 && z < Z1 - 0.5)) k.board([0.07, 0.07, 0.62], [postX, h - 0.26, z + s * 0.24], [s * Math.PI / 4, 0, 0], { long: 2, tint: vary(k, FRAME, 0.85, 1.0), strip: 11 });
      c.piers.push({ x: postX, z });
    }
    // the tin flashing where it meets the wall; horseshoes hung on the middle post
    k.box('iron', [0.012, 0.14, D + 0.6], [X1 + 0.03, SHED.top + 0.08, 0], null, { tint: TIN });
    for (let i = 0; i < 3; i++) horseshoe(k, mul(T(postX - 0.08, 1.65 - i * 0.2, 0.0), RY(-Math.PI / 2), RZ(Math.PI)), 1.1);
    // a lantern on the middle post for the evening's shoeing
    c.lamps.push(lantern(k, postX - 0.3, 2.0, 0.35, { bracket: [0.28, 0], strength: 1.3, outdoor: true }));
  }
  // THE FORGE: a stone hearth against the back wall, its fire on top; a sheet-iron hood over it and a stone chimney up
  // from the hood through the roof
  {
    const G = -0.12, fl = [[FORGE.x0, FORGE.z1], [FORGE.x1, FORGE.z1], [FORGE.x1, FORGE.z0], [FORGE.x0, FORGE.z0]];
    const sx0 = STACK.x - STACK.w / 2, sx1 = STACK.x + STACK.w / 2, sz0 = STACK.z - STACK.d / 2, sz1 = STACK.z + STACK.d / 2, sTop = roofY(STACK.x) + 1.9;
    const sk = [[sx0, sz1], [sx1, sz1], [sx1, sz0], [sx0, sz0]];
    SHAPES.smithyForge = { label: 'Forge', make: () => ({ H: FORGE.h, sections: [{ loop0: fl, loop1: fl, y0: G, y1: FORGE.h - 0.1 }], openings: [{ face: 0, u: (FORGE.x1 - FORGE.x0) / 2, w: 0.5, v0: 0.2, v1: 0.55, kind: 'door', depth: 0.4 }],
      top: { y: FORGE.h - 0.1, t: 0, over: 0, rects: [] } }) };
    SHAPES.smithyStack = { label: 'Forge chimney', make: () => ({ H: sTop, sections: [{ loop0: sk, loop1: sk, y0: 2.3, y1: sTop - 0.1 }], openings: [], top: { y: sTop, t: 0.1, over: 0.05, rects: [{ x0: sx0 - 0.05, x1: sx1 + 0.05, z0: sz0 - 0.05, z1: sz1 + 0.05, open: { x0: 1, x1: 1, z0: 1, z1: 1 }, ov: { x0: 0.05, x1: 0.05, z0: 0.05, z1: 0.05 } }], holes: [[STACK.x - 0.12, STACK.x + 0.12, STACK.z - 0.1, STACK.z + 0.1]] } }) };
    for (const [shape, seed] of [['smithyForge', 3], ['smithyStack', 7]]) {
      const sw = buildStoneWall({ style: 'mortared', palette: r.stone, mortar: r.mortar, size: far ? 0.55 : 0.3, irregularity: 0.5, colourMix: 0.5, bulge: 0.5, joint: 0.012, shape, seed: r.seed * 11 + seed }, env);
      c.stoneGeos.push(sw.stone, sw.mortar);
    }
    k.solid([FORGE.x1 - FORGE.x0, FORGE.h, FORGE.z1 - FORGE.z0], [(FORGE.x0 + FORGE.x1) / 2, FORGE.h / 2, (FORGE.z0 + FORGE.z1) / 2]);
    k.solid([STACK.w, sTop - 2.3, STACK.d], [STACK.x, (sTop + 2.3) / 2, STACK.z]);
    // the hearth's top: a slab of sooty firebrick-grey (no moss on a working forge), a dark firepot sunk in it
    k.box('plaster', [FORGE.x1 - FORGE.x0 + 0.08, 0.1, FORGE.z1 - FORGE.z0 + 0.04], [(FORGE.x0 + FORGE.x1) / 2, FORGE.h - 0.05, (FORGE.z0 + FORGE.z1) / 2 + 0.02], null, { tint: onMean([0.27, 0.25, 0.23], env.texMean), skip: '-y' });
    k.box('plaster', [0.5, 0.012, 0.4], [STACK.x, FORGE.h + 0.004, Z0 + 0.65], null, { tint: onMean([0.08, 0.07, 0.065], env.texMean) });
    // the hood: four sloped sheets from a wide skirt over the hearth narrowing right into the stack
    k.prism('iron', [[-0.66, -0.59], [0.66, -0.59], [0.66, 0.59], [-0.66, 0.59]], 0.68, [STACK.x, 2.06, STACK.z], null, { tint: IRON.map((q) => q * 0.7), taper: 0.53 });
    k.box('iron', [1.38, 0.08, 1.24], [STACK.x, 1.72, STACK.z], null, { tint: IRON.map((q) => q * 0.6), skip: '+y' });
    if (!far) {
      // the fire: coals glowing in the hearth's firepot, a few dark ones round them; its light low and orange
      for (let i = 0; i < 14; i++) {
        const rr = Math.sqrt(k.R()) * 0.15, a = k.r(0, 6.28), s = k.r(0.03, 0.06), hot = 1 - rr / 0.16;
        k.parts.glow.push({ size: [s, s * 0.6, s], m: mul(T(STACK.x + Math.cos(a) * rr, FORGE.h + 0.015 + s * 0.3, Z0 + 0.65 + Math.sin(a) * rr * 0.8), RY(k.r(0, 3))), kind: GLOW.flame, col: [0.9 + 1.4 * hot, 0.22 + 0.5 * hot, 0.03 + 0.06 * hot] });
      }
      for (let i = 0; i < 26; i++) {
        const rr = k.r(0.14, 0.3), a = k.r(0, 6.28), s = k.r(0.035, 0.065);
        k.prism('iron', ngon(5, s, 0.4, k.R), s * 0.8, [STACK.x + Math.cos(a) * rr, FORGE.h + 0.02, Z0 + 0.65 + Math.sin(a) * rr * 0.75], [k.r(-0.4, 0.4), k.r(0, 6), k.r(-0.4, 0.4)], { tint: [0.15, 0.15, 0.16] });
      }
      c.lamps.push({ p: [STACK.x, 1.15, Z0 + 1.15], reach: 6.5, strength: 1.5, outdoor: false, noGlow: true, fire: true });
      // the bellows beside it: two pear-shaped boards with leather between, on a frame, a lever over them, a nozzle
      // into the side of the hearth
      const bx = FORGE.x1 + 0.72, bz = Z0 + 0.66, pear = [[-0.42, 0], [-0.25, -0.16], [0, -0.27], [0.28, -0.3], [0.42, -0.18], [0.46, 0], [0.42, 0.18], [0.28, 0.3], [0, 0.27], [-0.25, 0.16]].map(([x, z]) => [x * 1.3, z * 1.3]);
      for (const y of [0.9, 1.26]) k.prism('wood', pear, 0.045, [bx, y, bz], null, { tint: vary(k, FRAME, 0.85, 1.0), strip: 10 });
      for (const [y, f] of [[1.0, 0.92], [1.16, 0.86]]) k.prism('wood', pear.map(([x, z]) => [x * f, z * f]), 0.16, [bx + 0.02, y, bz], null, { paint: [0.2, 0.12, 0.07], tint: [0.5, 0.4, 0.3], skip: '+y-y' });
      k.prism('iron', ngon(6, 0.035), 0.42, null, null, { m: mul(T(bx - 0.6, 1.0, bz), RZ(Math.PI / 2)), tint: IRON.map((q) => q * 0.7), smooth: true });
      for (const z of [bz - 0.38, bz + 0.38]) k.board([0.08, 1.85, 0.08], [bx + 0.5, 0.925, z], null, { long: 1, tint: vary(k, FRAME, 0.8, 0.95) });
      k.board([0.08, 0.08, 0.86], [bx + 0.5, 1.85, bz], null, { long: 2, tint: vary(k, FRAME, 0.8, 0.95) });
      k.board([1.7, 0.06, 0.06], [bx + 0.3, 1.9, bz], [0, 0, 0.12], { long: 0, tint: vary(k, FRAME, 0.85, 1.0) });
      k.box('iron', [0.015, 0.62, 0.015], [bx - 0.15, 1.55, bz], null, { tint: IRON });
      k.solid([1.2, 1.3, 0.8], [bx + 0.1, 0.65, bz]);
    }
  }
  // INSIDE: the earth floor; a workbench with a vise under the left windows; a rack of tongs and hammers on the left
  // wall by the forge; a lantern hung from the middle tie beam
  k.box('plaster', [W - 0.2, 0.06, D - 0.2], [0, FL - 0.03, 0], null, { tint: onMean(EARTH, env.texMean), skip: '-y' });
  k.solid([W - 0.2, 0.1, D - 0.2], [0, FL - 0.05, 0]);
  if (!far) {
    const ix = X0 + 0.12;
    k.board([0.62, 0.07, 2.1], [ix + 0.33, 0.86, 1.6], null, { long: 2, tint: vary(k, FRAME, 0.75, 0.9), strip: 10, cuts: [-0.5, 0.5], segFaces: '+y' });
    for (const z of [0.65, 2.55]) for (const x of [ix + 0.08, ix + 0.58]) k.board([0.08, 0.83, 0.08], [x, 0.415, z], null, { long: 1, tint: vary(k, FRAME, 0.75, 0.9) });
    k.board([0.5, 0.04, 1.9], [ix + 0.33, 0.28, 1.6], null, { long: 2, tint: vary(k, FRAME, 0.7, 0.85) });
    k.box('iron', [0.14, 0.12, 0.2], [ix + 0.6, 0.97, 0.95], null, { tint: IRON.map((q) => q * 0.8) });
    k.box('iron', [0.3, 0.025, 0.025], [ix + 0.62, 0.97, 0.95], [0, 0, 0], { tint: IRON });
    k.solid([0.65, 0.9, 2.1], [ix + 0.33, 0.45, 1.6]);
    // the tool rack: a board on the wall, tongs (long, crossed) and hammers hung from it
    k.board([0.04, 0.12, 1.2], [ix + 0.03, 1.75, -1.4], null, { long: 2, tint: vary(k, DARKW, 0.85, 1.0) });
    for (let i = 0; i < 6; i++) {
      const z = -1.9 + i * 0.2, tongs = i % 2 === 0;
      k.box('iron', [0.03, 0.03, 0.03], [ix + 0.08, 1.75, z], null, { tint: IRON });
      if (tongs) for (const s of [-1, 1]) k.box('iron', [0.016, 0.62, 0.016], [ix + 0.08, 1.42, z + s * 0.02], [0, 0, 0], { tint: IRON.map((q) => q * 0.85), m: undefined });
      else { k.board([0.03, 0.36, 0.03], [ix + 0.08, 1.52, z], null, { long: 1, tint: [1.0, 0.85, 0.7] }); k.box('iron', [0.045, 0.045, 0.12], [ix + 0.08, 1.33, z], null, { tint: IRON.map((q) => q * 0.8) }); }
    }
    for (let i = 0; i < 6; i++) horseshoe(k, mul(T(ix + 0.05, 2.2, -1.8 + i * 0.18), RY(Math.PI / 2), RZ(Math.PI)), 1.0);
    c.lamps.push(lantern(k, 0.7, EAVE - 0.75, 0.15, { chain: 0.45, strength: 1.0 }));
  }
  // (the walls' solids, for the light and the walk grid: boardAndBatten adds each board's; the gables' attic none)
  // THE DOORS: the big double doors swing out (the street side), the door into the shed swings in (their hinges on the
  // lifted building)
  const leafOf = (f, ha, side, w, h, open, group, xBrace, name) => {
    const seed = r.seed * 31 + leaves.length * 7 + 3, lk = new Kit(seed); lk.parts.glow = [];
    doorLeaf(lk, { w, h, side, tint: paint ? [0.5, 0.42, 0.36] : DOORW, strap: STRAP, handle: true, xBrace, rails: xBrace ? [0.3, h / 2, h - 0.3] : [0.3, h - 0.32] });
    if (paint) for (const P of lk.parts.wood) if (!P.o.paint) P.o.paint = vary(lk, paint, 0.9, 1.06);
    for (const P of lk.parts.wood) P.m.premultiply(RY(f.th));
    const geo = buildGeometry(lk.parts.wood, 'wood', rng(seed + 1), { topAt: () => 9, tintAt });
    const hinge = wallP(f, ha, FL + 0.01 + LIFT, group === 'main' ? 0.04 : -0.08);
    leaves.push({ group, geo, glass: null, hinge, open, closed: 0, parts: lk.parts.wood.length, name });
  };
  if (!far) {
    leafOf(FRONT, DOOR.a0 + 0.02, 1, 1.42, DOOR.y1 - FL - 0.03, -105 * Math.PI / 180, 'main', true, 'doors');
    leafOf(FRONT, DOOR.a1 - 0.02, -1, 1.42, DOOR.y1 - FL - 0.03, 105 * Math.PI / 180, 'main', true, 'doors');
    leafOf(RIGHT, -1.3 + 0.03, 1, 1.04, 2.2 - FL - 0.03, 100 * Math.PI / 180, 'back', false, 'shed door');
  } else {
    wb(k, FRONT, [DOOR.a1 - DOOR.a0 - 0.04, DOOR.y1 - FL, 0.05], 0, (DOOR.y1 + FL) / 2, -0.02, null, { long: 1, tint: DOORW.map((q) => q * 0.8), paint });
    wb(k, RIGHT, [1.06, 2.2 - FL, 0.05], -0.75, (2.2 + FL) / 2, -0.04, null, { long: 1, tint: DOORW.map((q) => q * 0.8), paint });
  }
  // UP ONTO THE FOOTING: everything so far LIFT m up; then what stands on the ground: the footing itself, its steps, the
  // shed posts' piers
  liftAll(c, k, LIFT);
  footing(c, r, env, gl);

  // the meshes, one per material
  const R = rng(r.seed + 1), geos = {}, topAt = (x, z) => (x > X1 + 0.05 ? SHED.top - (x - X1) * Math.tan(SHED.pitch) : Math.max(EAVE, roofY(x))) - 0.03 + LIFT;
  geos.wood = buildGeometry(k.parts.wood, 'wood', R, { topAt, tintAt });
  const of = geos.wood.userData.partOf, Pp = geos.wood.attributes.position, A = new Float32Array(Pp.count * 3), RB = rng(r.seed * 97 + 5);
  const per = k.parts.wood.map(() => (RB() < 0.3 ? 0.15 + 0.2 * RB() : 0.08 * RB()));
  for (let i = 0; i < Pp.count; i++) {
    const Q = k.parts.wood[of[i]], o = Q.o; if (!o.nail) continue;
    A[i * 3] = o.nail; A[i * 3 + 1] = Q.m.elements[13];
    if (o.paint) { const x = Pp.getX(i), y = Pp.getY(i), z = Pp.getZ(i), cn = Math.min(Math.hypot(x - X0, z - Z0), Math.hypot(x - X1, z - Z0), Math.hypot(x - X0, z - Z1), Math.hypot(x - X1, z - Z1)); A[i * 3 + 2] = per[of[i]] + 0.4 * (1 - smooth01(cn, 0, 1.2)) + 0.2 * (1 - smooth01(y, 0, 1)); }
  }
  geos.wood.setAttribute('aBoard', new THREE.BufferAttribute(A, 3));
  geos.iron = buildGeometry(k.parts.iron, 'iron', R, { topAt });
  geos.plaster = buildGeometry(k.parts.plaster, 'stone', rng(r.seed + 9), {});
  if (!far) {
    geos.glow = glowGeometry(k.parts.glow, (P) => P.kind !== GLOW.glass && P.kind !== GLOW.glass + 10);
    geos.glass = glowGeometry(k.parts.glow, (P) => P.kind === GLOW.glass || P.kind === GLOW.glass + 10);
    const panes = []; for (let i = 0; i < c.panes.length; i += 2) { const g = new THREE.PlaneGeometry(...c.panes[i + 1]); g.applyMatrix4(c.panes[i]); panes.push(g); }
    geos.pane = panes.length ? mergeGeometries(panes) : null; for (const g of panes) g.dispose();
  }
  geos.stone = mergeGeometries(c.stoneGeos); geos.stone.userData.ownAO = true; for (const g of c.stoneGeos) g.dispose();
  for (const g in geos) if (!geos[g]) delete geos[g];
  const msBuild = performance.now() - t0;

  // THE BAKE: the shop is indoors (up to its roof); the doors, the windows and the shed door let the sky in
  const t1 = performance.now();
  const occ = new Occlusion(k.occ, 1.6, 0.08, { reach: 2.4, rays: far ? 12 : 20, groundReach: 0.7 });
  const op = (cc, u, v, n, o = {}) => ({ c: cc, u, v, n, ...o });
  const openings = [
    op([0, (FL + DOOR.y1) / 2 + LIFT, Z1 - 0.05], [1.35, 0, 0], [0, (DOOR.y1 - FL) / 2 - 0.05, 0], [0, 0, 1], { front: true }),
    op([X1 - 0.05, 1.1 + LIFT, 0.75], [0, 0, 0.48], [0, 1.0, 0], [1, 0, 0], { door2: true }),
    op([1.85, 1.75 + LIFT, Z0 + 0.05], [0.4, 0, 0], [0, 0.48, 0], [0, 0, -1]),
    op([X0 + 0.05, 1.75 + LIFT, 1.6], [0, 0, 0.4], [0, 0.48, 0], [-1, 0, 0]), op([X0 + 0.05, 1.75 + LIFT, -0.3], [0, 0, 0.4], [0, 0.48, 0], [-1, 0, 0]),
    op([X1 - 0.05, 1.75 + LIFT, -1.95], [0, 0, 0.4], [0, 0.48, 0], [1, 0, 0]),
  ];
  const inShop = (x, y, z) => x > X0 + 0.08 && x < X1 - 0.08 && z > Z0 + 0.08 && z < Z1 - 0.08 && y > -0.5 && y < roofY(x) + LIFT - 0.05;
  const fill = (x, y, z, nx, ny, nz) => (inShop(x + nx * 0.08, y + ny * 0.08, z + nz * 0.08) ? 0.06 : 0);
  const light = new Light(occ, { inside: inShop, fill, openings, lamps: c.lamps, base: 0.3, gain: 6.0 });
  const BAKED = ['wood', 'iron', 'stone', 'plaster'];
  for (const g of BAKED) if (geos[g]) light.bake(geos[g]);
  for (const Lf of leaves) { light.bake(Lf.geo, mul(T(...Lf.hinge), RY(Lf.open)), 'open'); light.bake(Lf.geo, T(...Lf.hinge), 'closed'); }
  light.setDoors = (open, open2) => {
    for (const g of BAKED) if (geos[g]) light.apply(geos[g], open, 'main', open2);
    for (const Lf of leaves) { const o = Lf.group === 'back' ? open2 : open; light.apply(Lf.geo, open, o ? 'open' : 'closed', open2); }
  };
  light.setDoors(true, true);
  const msBake = performance.now() - t1;

  // centre the footprint
  const box = new THREE.Box3(); for (const g of Object.values(geos)) { g.computeBoundingBox(); box.union(g.boundingBox); }
  const OX = -(box.min.x + box.max.x) / 2, OZ = -(box.min.z + box.max.z) / 2;
  for (const g in geos) geos[g].translate(OX, 0, OZ);
  for (const Lf of leaves) Lf.hinge = [Lf.hinge[0] + OX, Lf.hinge[1], Lf.hinge[2] + OZ];
  for (const Lp of c.lamps) Lp.p = [Lp.p[0] + OX, Lp.p[1], Lp.p[2] + OZ];
  light.offset = [OX, OZ];
  const props = far ? [] : [
    { type: 'anvil', x: -0.55, z: Z0 + 1.95, rot: 0.25, inside: true }, { type: 'quench', x: -2.55, z: Z0 + 1.75, inside: true },
    { type: 'coal', x: X0 + 0.75, z: Z0 + 0.6, w: 1.1, d: 0.8, inside: true }, { type: 'bucket', x: -2.0, z: Z0 + 2.3, inside: true },
    { type: 'barrel', x: 0.9, z: Z0 + 0.45, inside: true },
    { type: 'wheel', x: -2.75, z: Z1 + 0.22, r: 0.62 }, { type: 'anvil', x: 2.85, z: Z1 + 1.35, rot: -0.5 }, { type: 'barrel', x: X1 + 0.5, z: Z0 + 0.45 }, { type: 'trough', x: SHED.x1 - 0.65, z: Z1 - 1.3, rot: Math.PI / 2, len: 1.7 },
    { type: 'hitchrail', x: SHED.x1 + 0.9, z: 0, rot: Math.PI / 2, len: 3.0 }, { type: 'crate', x: X1 + 0.45, z: Z1 - 0.4, rot: 0.2, size: 0.5 },
  ].map((p) => ({ ...p, y: p.inside ? FL + LIFT : gl(p.x, p.z), x: p.x + OX, z: p.z + OZ }));   // (outdoors: on the ground where it stands)
  const f2 = (x) => +x.toFixed(2);
  const fp = { w: f2(box.max.x - box.min.x), d: f2(box.max.z - box.min.z), h: f2(box.max.y), x0: f2(box.min.x + OX), x1: f2(box.max.x + OX), z0: f2(box.min.z + OZ), z1: f2(box.max.z + OZ) };
  const anchors = {
    footprint: fp, floor: FL + LIFT, feet: c.feet.map(([x, z, y]) => [f2(x + OX), f2(z + OZ), f2(y)]),
    doorways: [{ name: 'doors', centre: [f2(OX), f2((FL + DOOR.y1) / 2 + LIFT), f2(Z1 + OZ)], w: 2.9, h: f2(DOOR.y1 - FL), out: [0, 0, 1], door: 'main' },
      { name: 'shed door', centre: [f2(X1 + OX), f2((FL + 2.2) / 2 + LIFT), f2(0.75 + OZ)], w: 1.1, h: f2(2.2 - FL), out: [1, 0, 0], door: 'back' }],
    rooms: [{ name: 'smithy', floor: [f2(X0 + 0.1 + OX), f2(X1 - 0.1 + OX), f2(Z0 + 0.1 + OZ), f2(Z1 - 0.1 + OZ)], y: FL + LIFT, ceiling: f2(EAVE - 0.2 + LIFT), anchors: {
      forge: { x: f2(STACK.x + OX), z: f2(FORGE.z1 + OZ), y: FORGE.h + LIFT }, anvil: { x: f2(-0.55 + OX), z: f2(Z0 + 1.95 + OZ) }, bench: { x: f2(X0 + 0.45 + OX), z: f2(1.6 + OZ), rot: Math.PI / 2, len: 2.1 }, smith: { x: f2(-0.9 + OX), z: f2(Z0 + 2.4 + OZ), rot: Math.PI } } },
    { name: 'shoeing shed', open: true, floor: [f2(X1 + OX), f2(SHED.x1 + OX), f2(Z0 + OZ), f2(Z1 + OZ)], y: 0, ceiling: f2(SHED.top - 0.6), anchors: { horse: { x: f2((X1 + SHED.x1) / 2 + OX), z: f2(OZ), rot: 0 } } }],
    lanterns: c.lamps.filter((q) => !q.fire).map((q) => q.p.map(f2)),
    street: [fp.x0 - 1, fp.x1 + 1, fp.z1 - 0.5, fp.z1 + 6],
  };
  const counts = {}; let parts = 0; for (const g in k.parts) { counts[g] = k.parts[g].length; parts += counts[g]; }
  const extra = far ? null : signAndSmoke({ ...SIGN, y: SIGN.y + LIFT }, [STACK.x + OX, roofY(STACK.x) + 1.95 + LIFT, STACK.z + OZ], [OX, OZ]);
  const B = { sit, ground: !!env.ground, extra, tick: extra ? extra.userData.tick : null, recipe: r, geos, doors: leaves, lamps: c.lamps, light, occ, props, offset: OX, offsetZ: OZ, anchors, counts, parts, msBuild, msBake, ms: performance.now() - t0, marks: [], kit: k };
  const H = fp.h, cx = OX, cz = OZ;
  B.views = {
    front34: [[-11.5, 3.6, 12.5], [0.6, 2.2, 0]], front: [[0.2 + cx, 2.0, 12.5], [cx, 2.2, 0]], back34: [[11.5, H * 0.6, -11.5], [0, 2.4, 0]],
    shed: [[13.0, 2.4, 6.0], [X1 + 1.2 + OX, 1.6, cz]],
    inside: [[1.6 + cx, 1.62, Z1 - 0.6 + cz], [-1.3 + cx, 1.1, Z0 + 0.6 + cz]], forge: [[0.9 + cx, 1.65, Z0 + 2.9 + cz], [STACK.x + cx, 1.1, Z0 + 0.5 + cz]],
    roof: [[-8, 13, 9], [0, 4, 0]], far: [[-40, 9, 58], [0, 2.4, 0]], night: [[-11.5, 3.6, 12.5], [0.6, 2.2, 0]],
  };
  return B;
}

// THE SIGN'S LETTERS AND THE SMOKE (the lab adds B.extra to its scene and calls B.tick each frame; in the town they are
// two small meshes beside the building's own): the letters painted on a canvas, faded cream, a little worn, on a plane
// over the sign board; a few soft grey puffs rising from the chimney and thinning out
function signAndSmoke(SIGN, top, off) {
  const g = new THREE.Group(); g.name = 'sign and smoke';
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 192;
  const x = cv.getContext('2d');
  x.fillStyle = 'rgba(214, 200, 168, 0.92)'; x.font = 'bold 132px Georgia, "Times New Roman", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('BLACKSMITH', 512, 104);
  // (worn: flecks of the paint gone, more along the bottom)
  const img = x.getImageData(0, 0, 1024, 192), d = img.data, R = rng(41);
  for (let i = 0; i < d.length; i += 4) { const py = (i / 4 / 1024) | 0; if (d[i + 3] && R() < 0.08 + 0.12 * (py / 192)) d[i + 3] *= R() * 0.5; }
  x.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(SIGN.w - 0.12, (SIGN.w - 0.12) * 192 / 1024), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.05, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  sign.position.set(off[0], SIGN.y, Z1 + 0.082 + off[1]); sign.name = 'sign letters'; g.add(sign);
  // the smoke: soft grey puffs, each rising and spreading as it goes, round again when it has thinned out
  const pc = document.createElement('canvas'); pc.width = pc.height = 64;
  const px = pc.getContext('2d'), gr = px.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(150,146,140,0.55)'); gr.addColorStop(0.5, 'rgba(140,136,130,0.25)'); gr.addColorStop(1, 'rgba(130,126,120,0)');
  px.fillStyle = gr; px.fillRect(0, 0, 64, 64);
  const N = 7, pos = new Float32Array(N * 3), age = Array.from({ length: N }, (_, i) => i / N);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const puffs = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(pc), size: 1.4, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0.55, color: 0xffffff }));
  puffs.name = 'smoke'; puffs.frustumCulled = false; g.add(puffs);
  const place = () => { for (let i = 0; i < N; i++) { const a = age[i]; pos.set([top[0] + a * 1.1 + Math.sin(i * 2.1 + a * 3) * 0.15, top[1] + a * 3.2, top[2] + a * 0.4], i * 3); } geo.attributes.position.needsUpdate = true; };
  place();
  g.userData.tick = (dt) => { for (let i = 0; i < N; i++) age[i] = (age[i] + dt * 0.12) % 1; place(); };
  return g;
}
