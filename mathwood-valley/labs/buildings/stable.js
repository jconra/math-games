// THE STABLE ("LIVERY & FEED"): a board-and-batten barn built from parts in code, after the concept picture (a faded
// barn-red livery barn: shake roof, a cupola with louvres, a hayloft door with a hoist beam, pulley and rope, the sign over
// big Z-braced doors swung open, a lean-to on the left over a wagon bay, a window, a fieldstone footing) and laid out to
// be walked into: a centre aisle of dirt and straw, posts and beams, a hayloft over the stalls on both sides, six stalls
// (plank lower walls and doors, iron bars above), lanterns on iron brackets, tack hung up, the far doors open too.
//
//   buildStable(recipe, env) -> {
//     geos      { wood, iron, glow, stone, floor, spill, boards }   one mesh each (the wood and iron are the Material Lab's
//               parts kit; the stone is the Stone Lab's footing; the boards are the sign and the stall boards)
//     doors     the two front leaves: { geo, hinge: [x, y, z], open, closed } (their own meshes, so they can swing; the
//               leaf's corners are in its own frame round the hinge, y up)
//     stalls    [{ id, side, x, z, face, frontX, doorTop, horse, board: { slot, ... } }]: where each horse stands and
//               which way it faces (the aisle), its board over the stall door
//     props     [{ type, x, y, z, rot, ... }]: the barrels, trough, crates, hay bales, buckets and the wagon that go
//               with it, as separate pieces (props.js builds them; the Town Lab can move them)
//     lamps     [{ p, reach, strength }]: the lanterns' light (also for anything that moves: animalLamps in parts.js)
//     anchors   the doorways, the sign, the lanterns, the footprint
//     light     the baked light (parts.js Light): setDoors(open) re-shades for the front doors open or shut
//   }
// The building's middle is at x = z = 0 (its footprint centred, as the game's Tripo stable is), the ground at y = 0, the
// front (doors, sign) faces +z, its lean-to is on the left (-x). Metres. Its footprint matches the Tripo stable's
// (townAssets.js: 14 m along its longest side): 13.8 x 11.3 m, 9.6 m to the top of the cupola.
//
// A RECIPE is what makes one stable its own: paint (a colour or none), wear (how much of it is gone), wood (the trim
// sheet's look), stone (the footing's palette), seed (every random choice), horses (which horse in which stall).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, buildGeometry, Occlusion } from '../materials/cabin.js';
import { rng, WOOD, WOOD_LOOKS } from '../materials/textures.js';
import { buildStoneWall, SHAPES, PALETTES } from '../stone/stonewall.js';
import { T, RX, RY, RZ, mul, vary, smooth01, ngon, wallOf, wallM, boardAndBatten, casing, roofSlope, doorLeaf, harness, lantern, glowGeometry, Light, GLOW, ropeCoil, ropeGeometry } from './parts.js';
import { BOARDS, boardUV } from './art.js';

// ── the recipe ───────────────────────────────────────────────────────────────────────────────────────────────────────
// paint colours are the paint itself (linear), before the weathering fades and wears it
export const PAINTS = {
  none: { label: 'None (bare wood)', c: null },
  red: { label: 'Faded barn red', c: [0.36, 0.085, 0.058] },
  ochre: { label: 'Ochre', c: [0.52, 0.25, 0.035] },
  green: { label: 'Faded green', c: [0.12, 0.2, 0.11] },
  white: { label: 'Whitewash', c: [0.6, 0.58, 0.53] },
};
// the horses for sale and the bay, in stall order: right front, right middle, right back, left front, left middle, left back
export const STALL_IDS = ['R1', 'R2', 'R3', 'L1', 'L2', 'L3'];
export const RECIPE_DEFAULTS = { kind: 'stable', paint: 'red', wear: 0.42, wood: 'straight', stone: 'grey', seed: 7, horses: ['chestnut', 'white', 'donkey', 'palomino', 'midnight', 'bay'],
  poses: ['door', 'rack', 'look', 'look', 'side', 'eat'] };
// each stall's pose (in stall order): look (out over the gate), door (out over the gate, turned toward the doorway), rack
// (head down at a hay rack inside the gate), side (standing back in its stall, turned side-on to the aisle), eat (head
// down at a heap of hay on the floor)
export const POSES = ['look', 'door', 'rack', 'side', 'eat'];
export function stableRecipe(r = {}) {
  const o = { ...RECIPE_DEFAULTS, horses: [...RECIPE_DEFAULTS.horses], poses: [...RECIPE_DEFAULTS.poses] };
  if (PAINTS[r.paint]) o.paint = r.paint;
  if (Number.isFinite(+r.wear)) o.wear = Math.min(1, Math.max(0, +r.wear));
  if (WOOD_LOOKS[r.wood]) o.wood = r.wood;
  if (PALETTES[r.stone]) o.stone = r.stone;
  if (Number.isFinite(+r.seed)) o.seed = Math.max(1, Math.round(+r.seed));
  if (Array.isArray(r.horses) && r.horses.length === 6) o.horses = r.horses.map(String);
  if (Array.isArray(r.poses) && r.poses.length === 6) o.poses = r.poses.map((p) => (POSES.includes(p) ? p : 'look'));
  return o;
}

// ── the sizes ────────────────────────────────────────────────────────────────────────────────────────────────────────
const W = 9.6, D = 10.6;                  // the barn's walls: across (x), front to back (z)
const FT = 0.5;                           // the top of the stone footing
const Y0 = FT - 0.05;                     // the boards' foot (they lap 5 cm down over the stones)
const EAVE = 4.4;                         // the top of the side walls (where the rafters sit)
const PITCH = 37 * Math.PI / 180, TP = Math.tan(PITCH);
const RIDGE = EAVE + (W / 2) * TP;        // 8.02
const ROOF0 = RIDGE + 0.2;                // the roof boards' top at the ridge (the rafters sit on the wall plates under them)
const GO = 0.35, EO = 0.45;               // the roof past the gables, and past the side walls
const DW = 3.0, DH = 3.1;                 // the big doorways
const AX = 1.7;                           // the aisle's posts (their middles, each side)
const SF = 1.62;                          // the stall fronts' aisle face
const LOFT = 3.2;                         // the hayloft floor
const STALLZ = [2.6, 0.0, -2.6, -5.2];    // the stalls' partitions, front to back (the last: the back wall)
const LT = 3.4, LTP = 15 * Math.PI / 180, LT_TOP = 3.55;   // the lean-to: how far out, its pitch, where it meets the wall
const LXP = -W / 2 - LT + 0.12;           // its posts
const CUP = { z: -1.3, half: 0.6 };       // the cupola on the ridge
const ROWS = [1.3, 2.8, 4.6, 6.6];   // rows of corners up the walls (for the baked light)
export const STABLE = { W, D, EAVE, RIDGE, FT, DW, DH, AX, SF, LOFT, LT };

// the roof's underside over a point, inside (the boards; the rafters hang 15 cm under them)
const roofUnder = (x) => ROOF0 - Math.abs(x) * TP - 0.03;
const ltUnder = (x) => LT_TOP - (-W / 2 - x) * Math.tan(LTP) - 0.03;     // (x < -W/2)

// ── colours: tints on the trim sheet's strips (1 = the strip as drawn) ──────────────────────────────────────────────
const BARE = [1.12, 1.12, 1.14];         // outside boards, unpainted: weathered toward silver-grey
const INNER = [1.0, 0.9, 0.78];           // the boards' inside faces: honey-brown, kept from the sun
const TRIM = [0.95, 0.94, 0.94];           // casings, corner boards: bare weathered wood
const FRAME = [1.08, 0.97, 0.85];         // posts, beams, joists (rough-sawn strips)
const SHAKE = [0.74, 0.7, 0.66];
const ROOFB = [0.66, 0.6, 0.54];          // the roof boards' undersides
const DOORW = [1.06, 1.0, 0.94];          // door planks: sun-dried
const STALLW = [1.15, 1.02, 0.86];        // stall planks: rubbed smooth and warmer
const LOFTW = [1.08, 0.98, 0.86];
const ROPE = [1.3, 1.08, 0.76];           // (on the split-wood strips: straight fibres)
const IRON = [0.85, 0.8, 0.76];
const STRAP = [0.035, 0.032, 0.03];       // iron straps on the doors (painted, so they stay one mesh with the planks)

// the drip edge over a point (where the grime streaks start): the roof's edge, the lean-to's, the sign's bottom, a sill
function topAt(x, z, y) {
  if (y !== undefined) {
    if (z > D / 2 - 0.06 && Math.abs(x) < 2.4 && y < 3.47) return 3.45;                                      // under the sign
    for (const s of SILLS) if (Math.abs(x - s.x) < s.hw && Math.abs(z - s.z) < s.hd && y < s.y) return s.y;  // under a window
  }
  if (x < -W / 2 - 0.05) return ltUnder(x) - 0.04;                                                            // under the lean-to
  if (x < -W / 2 + 0.05 && y !== undefined && y < LT_TOP) return LT_TOP - 0.05;                             // the wall under it
  return Math.max(EAVE + 0.1, roofUnder(x) - 0.04);
}
const SILLS = [];
// every corner's own tint: outside, bleached greyer up high and darker, dirtier low down; paint a little paler up high
// (sun-faded); inside, browner and darker low down
function tintAt(x, y, z, t, o) {
  if (o.fresh || o.roof) return t;
  if (o.inside) { const f = 0.8 + 0.25 * smooth01(y, 0, 3.5); return [t[0] * f, t[1] * f * 0.98, t[2] * f * 0.95]; }
  if (o.paint) { const f = smooth01(y, 0.4, 7); return [t[0] * (0.92 + 0.2 * f), t[1] * (0.92 + 0.28 * f), t[2] * (0.92 + 0.32 * f)]; }
  const f = smooth01(y, 0.3, 6.5), lum = t[0] * 0.3 + t[1] * 0.59 + t[2] * 0.11, g = 0.55;
  const lo = [t[0] * 0.8, t[1] * 0.77, t[2] * 0.74];
  const hi = [(t[0] + (lum * 0.92 - t[0]) * g) * 1.08, (t[1] + (lum * 1.01 - t[1]) * g) * 1.08, (t[2] + (lum * 1.12 - t[2]) * g) * 1.08];
  return [lo[0] + (hi[0] - lo[0]) * f, lo[1] + (hi[1] - lo[1]) * f, lo[2] + (hi[2] - lo[2]) * f];
}

// build a part (a door leaf) in a kit of its own, then move its parts into k through the matrix M
function into(k, M, build, seed) {
  const t = new Kit(seed); t.parts.glow = []; build(t);
  for (const g in t.parts) for (const P of t.parts[g]) {
    if (g === 'glow') { k.parts.glow.push({ ...P, m: mul(M, P.m) }); continue; }
    (k.parts[g] || (k.parts[g] = [])).push({ size: P.size, m: mul(M, P.m), o: P.o });
  }
  for (const O of t.occ) k.occ.push({ size: O.size, m: mul(M, O.m) });
}

// ── walls ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const FRONT = wallOf(0, D / 2), BACK = wallOf(Math.PI, D / 2), EAST = wallOf(Math.PI / 2, W / 2), WEST = wallOf(-Math.PI / 2, W / 2);
// (the boards run a centimetre or two up into the roof boards: a level top under a sloping roof would leave a sliver of sky)
const gTop = (a) => roofUnder(a) + 0.012;
const eTop = () => EAVE + 0.205;
const DOOR = { a0: -DW / 2, a1: DW / 2, y0: -1, y1: DH, door: true };
const WIN_F = { a0: -3.72, a1: -2.78, y0: 1.4, y1: 2.5 };            // the window left of the doors
const HAY = { a0: -0.72, a1: 0.72, y0: 4.95, y1: 6.6 };              // the hayloft door
const VENT = { a0: -0.4, a1: 0.4, y0: 6.05, y1: 6.75 };              // a louvred vent in the back gable
const STALL_WIN = [1.3, -1.3, -3.9];                                  // the stalls' small windows (z), in both side walls
const SIDE_WIN = { z0: 3.4, z1: 4.4, y0: 1.4, y1: 2.5 };              // a window into the front of the barn, each side

function walls(k, paint) {
  const opts = (o) => ({ y0: Y0, paint, tint: BARE, inTint: INNER, rows: ROWS, ...o });
  boardAndBatten(k, FRONT, opts({ a0: -W / 2, a1: W / 2, top: gTop, apex: 0, opens: [DOOR, WIN_F, HAY] }));
  boardAndBatten(k, BACK, opts({ a0: -W / 2, a1: W / 2, top: gTop, apex: 0, opens: [DOOR, VENT] }));
  // the side walls: a runs -z on the east wall, +z on the west
  const sideOpens = (s) => [...STALL_WIN.map((z) => { const a = s * z; return { a0: a - 0.35, a1: a + 0.35, y0: 1.65, y1: 2.25 }; }),
    { a0: Math.min(s * SIDE_WIN.z0, s * SIDE_WIN.z1), a1: Math.max(s * SIDE_WIN.z0, s * SIDE_WIN.z1), y0: SIDE_WIN.y0, y1: SIDE_WIN.y1 }];
  boardAndBatten(k, EAST, opts({ a0: -D / 2, a1: D / 2, top: eTop, opens: sideOpens(-1) }));
  boardAndBatten(k, WEST, opts({ a0: -D / 2, a1: D / 2, top: eTop, opens: sideOpens(1) }));
  // the corner boards: the one on the gable wall wide enough to cover the side wall's edge
  for (const sx of [-1, 1]) for (const [w, sz] of [[FRONT, 1], [BACK, -1]]) {
    const h = eTop() + 0.05 - Y0, yc = Y0 + h / 2, cl = ROWS.filter((y) => y < Y0 + h - 0.2).map((y) => y - yc);
    k.board([0.16, h, 0.03], null, null, { m: wallM(w, sx * sz * (W / 2 - 0.03), yc, 0.035), long: 1, tint: vary(k, TRIM, 0.9, 1.05), skip: '-z-y', cuts: cl, segFaces: '+z', outside: true });
    const sw = sx > 0 ? EAST : WEST, a = (sx > 0 ? -1 : 1) * sz * (D / 2 - 0.05);
    k.board([0.14, h, 0.03], null, null, { m: wallM(sw, a, yc, 0.035), long: 1, tint: vary(k, TRIM, 0.9, 1.05), skip: '-z-y', cuts: cl, segFaces: '+z', outside: true });
  }
  // the openings' trim. The big doorways: casings only (the jamb posts fill the reveal)
  for (const w of [FRONT, BACK]) casing(k, w, { ...DOOR, y0: 0 }, { tint: TRIM, depth: 0.04, width: 0.14 });
  casing(k, FRONT, HAY, { tint: TRIM, depth: 0.12 });
  casing(k, BACK, VENT, { tint: TRIM, depth: 0.12 });
  windowIn(k, FRONT, WIN_F, true);
  for (const s of [1, -1]) {
    const w = s > 0 ? EAST : WEST, sg = s > 0 ? -1 : 1;
    windowIn(k, w, { a0: Math.min(sg * SIDE_WIN.z0, sg * SIDE_WIN.z1), a1: Math.max(sg * SIDE_WIN.z0, sg * SIDE_WIN.z1), y0: SIDE_WIN.y0, y1: SIDE_WIN.y1 }, true);
    for (const z of STALL_WIN) stallWindow(k, w, sg * z, s);
  }
  // the back gable's vent: slats tilted to shed the rain, the dark loft behind
  for (let i = 0; i < 4; i++) k.board([0.8, 0.025, 0.16], null, null, { m: wallM(BACK, 0, VENT.y0 + 0.1 + i * 0.17, -0.02, [0.7, 0, 0]), long: 0, tint: vary(k, TRIM, 0.85, 1.0), outside: true });
  k.board([0.8, 0.7, 0.01], null, null, { m: wallM(BACK, 0, (VENT.y0 + VENT.y1) / 2, -0.14), long: 0, tint: [0.12, 0.1, 0.09], skip: '-z' });
}
// a glazed window: casing, sill, six panes (glow parts), glazing bars, and its pane's light inside
function windowIn(k, w, op, glazed) {
  casing(k, w, op, { tint: TRIM, depth: 0.12 });
  const wd = op.a1 - op.a0, h = op.y1 - op.y0, ac = (op.a0 + op.a1) / 2, yc = (op.y0 + op.y1) / 2;
  const P = wallM(w, ac, yc, -0.03);
  // (one pane facing out: from inside it isn't drawn, so the day outside shows through the window)
  k.parts.glow.push({ size: [wd, h, 0], m: P, pane: true, kind: GLOW.window, col: [1.8, 0.7, 0.18] });
  for (const f of [-1 / 6, 1 / 6]) k.board([0.035, h, 0.03], null, null, { m: wallM(w, ac + f * wd * 2, yc, -0.015), long: 1, tint: TRIM, skip: '-z' });
  k.board([wd, 0.035, 0.03], null, null, { m: wallM(w, ac, yc, -0.015), long: 0, tint: TRIM, skip: '-z' });
  SILLS.push({ ...(() => { const c = new THREE.Vector3(ac, 0, w.d).applyMatrix4(RY(w.th)); return { x: c.x, z: c.z }; })(), hw: Math.abs(Math.cos(w.th)) * (wd / 2 + 0.2) + 0.15, hd: Math.abs(Math.sin(w.th)) * (wd / 2 + 0.2) + 0.15, y: op.y0 - 0.06 });
}
// a stall's small window: an opening with iron bars, a board shutter hinged open flat against the wall
function stallWindow(k, w, a, s) {
  const op = { a0: a - 0.35, a1: a + 0.35, y0: 1.65, y1: 2.25 };
  casing(k, w, op, { tint: TRIM, depth: 0.12, width: 0.09 });
  for (let i = 1; i < 4; i++) k.box('iron', [0.02, 0.62, 0.02], null, null, { m: wallM(w, op.a0 + i * 0.175, 1.95, -0.05), tint: IRON, skip: '+y-y' });
  const sa = op.a1 + 0.12;
  for (let q = 0; q < 2; q++) k.board([0.36, 0.6, 0.03], null, null, { m: wallM(w, sa + 0.18 + q * 0.36, 1.95, 0.06), long: 1, tint: vary(k, DOORW, 0.85, 1.05), skip: '-z' });
  for (const y of [1.75, 2.15]) k.board([0.68, 0.08, 0.02], null, null, { m: wallM(w, sa + 0.36, y, 0.085), long: 0, tint: vary(k, DOORW, 0.85, 1.0), skip: '-z' });
}

// ── the stone footing (the Stone Lab's wall maker): a U under each half, from the front doorway round to the back one,
// so its corners are folded corner stones; three stone piers under the lean-to's posts ──────────────────────────────
function footing(r, env) {
  const t = 0.36, inset = 0.03, x0 = W / 2 - inset, z0 = D / 2 - inset, xd = DW / 2 + 0.02, G = -0.12;
  // (each outline runs with its outside on the right, walked from above, the front face first)
  const left = [[-x0, z0], [-xd, z0], [-xd, z0 - t], [-x0 + t, z0 - t], [-x0 + t, -z0 + t], [-xd, -z0 + t], [-xd, -z0], [-x0, -z0]];
  const right = [[xd, z0], [x0, z0], [x0, -z0], [xd, -z0], [xd, -z0 + t], [x0 - t, -z0 + t], [x0 - t, z0 - t], [xd, z0 - t]];
  const pier = [[-0.24, 0.24], [0.24, 0.24], [0.24, -0.24], [-0.24, -0.24]];
  SHAPES.stableFootL = { label: 'Stable footing', make: () => ({ H: FT, sections: [{ loop0: left, loop1: left, y0: G, y1: FT }], openings: [], top: { y: FT, t: 0, over: 0, rects: [] }, building: {} }) };
  SHAPES.stableFootR = { label: 'Stable footing', make: () => ({ H: FT, sections: [{ loop0: right, loop1: right, y0: G, y1: FT }], openings: [], top: { y: FT, t: 0, over: 0, rects: [] }, building: {} }) };
  SHAPES.stablePier = { label: 'Stable pier', make: () => ({ H: 0.3, sections: [{ loop0: pier, loop1: pier, y0: G, y1: 0.3 }], openings: [], top: { y: 0.3, t: 0, over: 0, rects: [] }, building: {} }) };
  const rec = { style: 'mortared', palette: r.stone, mortar: 'grey', size: 0.42, irregularity: 0.5, colourMix: 0.5, bulge: 0.6, joint: 0.012 };
  const out = [];
  const add = (shape, seed, m) => { const sw = buildStoneWall({ ...rec, shape, seed }, env); for (const g of [sw.stone, sw.mortar]) { if (m) g.applyMatrix4(m); out.push(g); } return sw; };
  add('stableFootL', r.seed * 3 + 1); add('stableFootR', r.seed * 3 + 2);
  for (const [i, z] of [D / 2 - 0.15, 0, -D / 2 + 0.15].entries()) add('stablePier', r.seed * 5 + i, T(LXP, 0, z));
  const geo = mergeGeometries(out); geo.userData.ownAO = true;
  for (const g of out) g.dispose();
  return geo;
}

// ── the frame inside: posts, beams, girts, the hayloft, the rafters' ties ───────────────────────────────────────────
function frame(k) {
  const beam = (size, pos, o = {}) => k.board(size, pos, o.rot || null, { tint: vary(k, FRAME, 0.88, 1.1), strip: 10 + (k.R() < 0.5 ? 1 : 0), inside: true, ends: 'log', ...o });
  const zc = (L, step = 1.3) => { const c = []; for (let z = -L / 2 + step; z < L / 2 - 0.3; z += step) c.push(z); return c; };
  // the aisle's posts, and the jamb posts of the two doorways running up into the gables
  for (const sx of [-1, 1]) {
    for (const z of [2.6, 0, -2.6]) { beam([0.2, 2.96, 0.2], [sx * AX, 1.48, z], { long: 1, skip: '-y', cuts: [-0.5, 0.6], segFaces: '+x-x+z-z' }); k.solid([0.2, 2.96, 0.2], [sx * AX, 1.48, z]); }
    for (const sz of [1, -1]) {
      const top = gTop(1.6) - 0.05;
      beam([0.2, top, 0.2], [sx * 1.6, top / 2, sz * (D / 2 - 0.125)], { long: 1, skip: '-y', cuts: [-2, 0, 2], segFaces: '+x-x+z-z' });
      const t3 = gTop(3.2) - 0.05;
      beam([0.18, t3 - FT, 0.18], [sx * 3.2, (t3 + FT) / 2, sz * (D / 2 - 0.115)], { long: 1, skip: '-y' + (sz > 0 ? '+z' : '-z'), cuts: [0] });
    }
  }
  for (const sz of [1, -1]) beam([3.6, 0.22, 0.2], [0, DH + 0.11, sz * (D / 2 - 0.125)], { long: 0 });     // the door headers
  // the side walls' posts, plates and girts (2x6 boards across the posts, inside the boards)
  const wx = W / 2 - 0.125;
  for (const sx of [-1, 1]) {
    for (const z of [D / 2 - 0.125, 2.6, 0, -2.6, -D / 2 + 0.125]) beam([0.2, EAVE - 0.15 - FT, 0.2], [sx * wx, (EAVE - 0.15 + FT) / 2, z], { long: 1, skip: '-y' + (sx > 0 ? '+x' : '-x'), cuts: [0] });
    beam([0.2, 0.15, D - 0.05], [sx * wx, EAVE - 0.075, 0], { long: 2, cuts: zc(D - 0.05), segFaces: '-y+x-x' });
    const gx = sx * (W / 2 - 0.025 - 0.025), sk = sx > 0 ? '+x+z-z' : '-x+z-z';
    const bays = [[D / 2 - 0.225, 2.7], [2.5, 0.1], [-0.1, -2.5], [-2.7, -D / 2 + 0.225]];
    for (const y of [1.3, 2.35, 3.75]) for (const [za, zb] of bays) {
      // (round the stall windows and the front windows)
      const pieces = y === 2.35 ? cutAround([zb, za], [[SIDE_WIN.z0 - 0.1, SIDE_WIN.z1 + 0.1]]) : [[zb, za]];
      for (const [a, b] of pieces) if (b - a > 0.15) beam([0.05, 0.15, b - a], [gx, y, (a + b) / 2], { long: 2, skip: sk });
    }
  }
  // the gable walls' girts, left and right of the doorways (and round the front window)
  for (const sz of [1, -1]) for (const sx of [-1, 1]) for (const y of [1.25, 2.35, 3.75]) {
    const z = sz * (D / 2 - 0.05), sk = sz > 0 ? '+z+x-x' : '-z+x-x';
    let pieces = [[1.7, W / 2 - 0.225]];
    if (sz > 0 && sx < 0 && y === 2.35) pieces = [[1.7, 2.68], [3.82, W / 2 - 0.225]];
    for (const [a, b] of pieces) beam([b - a, 0.15, 0.05], [sx * (a + b) / 2, y, z], { long: 0, skip: sk });
  }
  // ties across: at the loft over the aisle, at the plates right across, and collar ties up under the ridge
  for (const z of [2.6, 0, -2.6]) beam([2 * AX - 0.2, 0.22, 0.18], [0, 3.09, z], { long: 0 });
  for (const z of [2.6, -2.6]) beam([W - 0.45, 0.2, 0.18], [0, EAVE - 0.25, z], { long: 0, cuts: [-2.5, -0.8, 0.8, 2.5] });
  const cy = 6.4, cw = (ROOF0 - 0.215 - cy) / TP;
  for (const z of [3.9, 1.3, -1.3, -3.9]) beam([2 * cw, 0.16, 0.05], [0, cy, z], { long: 0, tint: vary(k, FRAME, 0.85, 1.0) });
  beam([0.05, 0.26, D - 0.1], [0, ROOF0 - 0.2, 0], { long: 2, cuts: zc(D - 0.1, 1.6) });     // the ridge board
  // the hayloft over the stalls, each side: an edge beam on the aisle posts, joists to the wall, floor boards, a kick
  // board along its edge
  for (const sx of [-1, 1]) {
    beam([0.2, 0.25, D - 0.2], [sx * AX, 3.075, 0], { long: 2, cuts: zc(D - 0.2), segFaces: '+x-x-y' });
    const jx0 = AX + 0.1, jx1 = W / 2 - 0.2, jL = jx1 - jx0;
    for (let z = -D / 2 + 0.55; z < D / 2 - 0.4; z += 0.65) beam([jL, 0.17, 0.06], [sx * (jx0 + jx1) / 2, 3.085, z], { long: 0, skip: '+y+x-x', tint: vary(k, FRAME, 0.9, 1.05) });
    for (let x = AX - 0.1; x < W / 2 - 0.08;) {
      const bw = Math.min(k.r(0.3, 0.38), W / 2 - 0.06 - x); if (bw < 0.08) break;
      const j = k.r(-1.6, 1.6), xc = sx * (x + bw / 2), tint = vary(k, LOFTW, 0.85, 1.12);
      for (const [a, b] of [[-D / 2 + 0.1, j], [j, D / 2 - 0.1]]) k.board([bw - 0.005, 0.03, b - a - 0.004], [xc, LOFT - 0.015, (a + b) / 2], null, { long: 2, tint, skip: '+x-x+z-z', cuts: zc(b - a, 2.4), segFaces: '+y-y', inside: true });
      x += bw;
    }
    beam([0.04, 0.22, D - 0.2], [sx * (AX - 0.08), LOFT + 0.11, 0], { long: 2, skip: '-y', tint: vary(k, LOFTW, 0.9, 1.0) });
    k.solid([W / 2 - AX, 0.3, D - 0.1], [sx * (W / 2 + AX) / 2, 3.08, 0]);
  }
}
// a span [a, b] less the gaps in `holes` (each [lo, hi]); `only`: just these holes
function cutAround([a, b], holes) {
  let out = [[a, b]];
  for (const [lo, hi] of holes) out = out.flatMap(([p, q]) => (hi <= p || lo >= q ? [[p, q]] : [[p, lo], [hi, q]].filter(([s, e]) => e - s > 0.05)));
  return out;
}

// ── the stalls: partitions, fronts (plank lower walls, iron bars above), half doors, mangers ─────────────────────────
function stalls(k, r) {
  const list = [];
  for (const sx of [1, -1]) for (let i = 0; i < 3; i++) {
    const zf = STALLZ[i], zb = STALLZ[i + 1], zc = (zf + zb) / 2, id = (sx > 0 ? 'R' : 'L') + (i + 1), horse = r.horses[STALL_IDS.indexOf(id)];
    // (a donkey carries its head low: its gate and the wall either side of it are a plank lower, so it looks over them)
    const low = horse === 'donkey', np = low ? 3 : 4, rail = 0.05 + np * 0.3 + 0.04, gateH = rail - 0.11;
    // the partition at the stall's front edge: planks from the aisle post to the wall post, capped
    const px0 = AX + 0.1, px1 = W / 2 - 0.225, L = px1 - px0, pxc = sx * (px0 + px1) / 2;
    for (let j = 0; j < 7; j++) k.board([L + 0.04, 0.292, 0.045], [pxc, 0.19 + j * 0.286, zf], [k.r(-0.003, 0.003), 0, 0], { long: 0, tint: vary(k, STALLW, 0.85, 1.1), skip: '+x-x-y' + (j < 6 ? '+y' : ''), cuts: [0], segFaces: '+z-z', inside: true });
    k.board([L, 0.05, 0.09], [pxc, 2.075, zf], null, { long: 0, tint: vary(k, STALLW, 0.9, 1.05), inside: true });
    k.solid([L, 2.1, 0.08], [pxc, 1.05, zf]);
    // the front: from post to post along the aisle
    const z0 = zb + 0.1 + (i === 2 ? 0.025 : 0), z1 = zf - 0.1, fx = sx * (SF + 0.025), dz0 = zc - 0.55, dz1 = zc + 0.55;
    for (const [a, b] of [[z0, dz0], [dz1, z1]]) {
      const pl = b - a, pc = (a + b) / 2;
      for (let j = 0; j < np; j++) k.board([0.05, 0.306, pl + 0.01], [fx, 0.2 + j * 0.3, pc], null, { long: 2, tint: vary(k, STALLW, 0.85, 1.1), skip: '+z-z-y' + (j < np - 1 ? '+y' : ''), inside: true });
      k.solid([0.06, rail - 0.05, pl], [fx, rail / 2, pc]);
      const nb = Math.max(3, Math.round(pl / 0.15)), bh = 2.22 - rail - 0.04;
      for (let j = 1; j < nb; j++) k.box('iron', [0.022, bh, 0.022], [fx, rail + 0.04 + bh / 2, a + pl * j / nb], null, { tint: IRON, skip: '+y-y' });
    }
    k.board([0.07, 0.08, z1 - z0], [fx, rail, (z0 + z1) / 2], null, { long: 2, tint: vary(k, STALLW, 0.9, 1.05), inside: true });
    k.board([0.08, 0.1, z1 - z0], [fx, 2.27, (z0 + z1) / 2], null, { long: 2, tint: vary(k, STALLW, 0.9, 1.05), inside: true });
    // the half door (closed), hinged at one side, a latch at the other
    const hz = zc - sx * 0.55;
    into(k, mul(T(sx * (SF + 0.02), 0.06, hz), RY(-sx * Math.PI / 2)), (t) => doorLeaf(t, { w: 1.1, h: gateH, side: 1, tint: STALLW, rails: [0.2, gateH - 0.2], strap: STRAP }), r.seed * 31 + i + (sx > 0 ? 0 : 7));
    k.box('iron', [0.03, 0.03, 0.16], [sx * (SF - 0.06), gateH - 0.28, zc + sx * 0.5], null, { tint: IRON });
    // the horse eating: a heap of hay on the floor just inside its gate
    const pose = r.poses[STALL_IDS.indexOf(id)];
    if (pose === 'eat') for (const [dx, dz, w, hh, d, a] of [[0.42, 0.05, 0.75, 0.13, 0.55, 0.2], [0.62, -0.25, 0.45, 0.09, 0.4, -0.5]]) k.parts.hay.push({ size: [w, hh, d], m: mul(T(sx * (SF + dx), hh / 2 - 0.01, zc + dz), RY(a)), o: { tint: [1.05, 1.0, 0.88], inside: true } });
    // a manger in the back corner by the wall: a plank box on a ledge, hay in it
    const mx = sx * (W / 2 - 0.5), mz = zf - 0.3;
    for (const [sz, pos] of [[[0.6, 0.32, 0.03], [mx, 1.06, mz - 0.25]], [[0.03, 0.32, 0.5], [mx - sx * 0.3, 1.06, mz]]]) k.board(sz, pos, null, { long: sz[0] > 0.1 ? 0 : 2, tint: vary(k, STALLW, 0.8, 0.95), inside: true });
    k.board([0.6, 0.03, 0.5], [mx, 0.91, mz], null, { long: 0, tint: vary(k, STALLW, 0.8, 0.95), inside: true });
    k.parts.hay.push({ size: [0.56, 0.18, 0.46], m: T(mx, 1.02, mz), o: { tint: [1, 0.95, 0.85], inside: true } });
    // the horse at its rack: a slatted V-rack of hay on the inside of the gate, low down, its head in it
    if (pose === 'rack') {
      // (hung at the height of the gate's top, so its hay shows over the gate where the horse has its head in it)
      const rx = sx * (SF + 0.2), ry = 1.05;
      k.board([0.04, 0.42, 1.0], [sx * (SF + 0.1), ry, zc], null, { long: 2, tint: vary(k, STALLW, 0.8, 0.95), inside: true });
      for (let q = 0; q < 6; q++) k.board([0.025, 0.46, 0.03], [rx + sx * 0.05, ry + 0.02, zc - 0.45 + q * 0.18], [0, 0, sx * 0.45], { long: 1, tint: vary(k, STALLW, 0.85, 1.0), inside: true });
      k.board([0.05, 0.05, 1.04], [rx + sx * 0.14, ry + 0.22, zc], null, { long: 2, tint: vary(k, STALLW, 0.85, 1.0), inside: true });
      k.parts.hay.push({ size: [0.22, 0.38, 0.92], m: mul(T(rx, ry + 0.11, zc), RZ(sx * 0.25)), o: { tint: [1.05, 1.0, 0.88], inside: true } });
    }
    list.push({ id, side: sx, z: zc, zb, zf, frontX: sx * SF, face: -sx * Math.PI / 2, doorTop: rail + 0.04, stallBack: sx * (W / 2 - 0.15), pose });
  }
  return list;
}

// ── the roofs ────────────────────────────────────────────────────────────────────────────────────────────────────────
function roofs(k) {
  const hole = (x, z) => Math.abs(x) < CUP.half - 0.05 && Math.abs(z - CUP.z) < CUP.half - 0.05;
  const len = (W / 2 + EO) / Math.cos(PITCH), x0 = -D / 2 - GO, x1 = D / 2 + GO;
  // each slope in its own frame: its top edge along x (here, along the ridge: z), running down toward its eave
  const common = { x0, x1, topY: ROOF0, len, pitch: PITCH, shakeT: SHAKE, boardT: ROOFB, rafterT: FRAME, hole, barge: true, interior: true, every: 0.8, rows: 2.2 };
  roofSlope(k, RY(Math.PI / 2), { ...common, cap: true });
  roofSlope(k, RY(-Math.PI / 2), { ...common, cap: true });
  // the lean-to: from the wall under the main eave out past its posts
  const llen = (LT + 0.35) / Math.cos(LTP);
  roofSlope(k, mul(T(-W / 2 - 0.03, 0, 0), RY(-Math.PI / 2)), { x0: -D / 2 - 0.05, x1: D / 2 + 0.3, topY: LT_TOP, len: llen, pitch: LTP, shakeT: SHAKE, boardT: ROOFB, rafterT: FRAME, barge: true, every: 0.9, rows: 2.6 });
}

// ── the lean-to on the left: posts on stone piers, a beam, braces, a ledger on the wall, its back closed in ─────────
function leanTo(k, paint) {
  const beamTop = ltUnder(LXP) + 0.03 - 0.18;
  for (const z of [D / 2 - 0.15, 0, -D / 2 + 0.15]) {
    k.board([0.18, beamTop - 0.24 - 0.3, 0.18], [LXP, 0.3 + (beamTop - 0.24 - 0.3) / 2, z], null, { long: 1, tint: vary(k, FRAME, 0.95, 1.1), strip: 10, cuts: [-0.6, 0.3], outside: true });
    // knee braces along the beam
    for (const s of [-1, 1]) {
      if ((z > 0 && s > 0) || (z < 0 && s < 0)) continue;
      k.board([0.1, 0.1, 0.85], [LXP, beamTop - 0.24 - 0.3, z + s * 0.3], [-s * Math.PI / 4, 0, 0], { long: 2, tint: vary(k, FRAME, 0.9, 1.05), strip: 11 });
    }
  }
  k.board([0.2, 0.24, D + 0.3], [LXP, beamTop - 0.12, 0.15], null, { long: 2, tint: vary(k, FRAME, 0.95, 1.05), strip: 10, cuts: [-3, -1.5, 0, 1.5, 3], outside: true });
  k.board([0.08, 0.2, D], [-W / 2 - 0.07, LT_TOP - 0.27, 0], null, { long: 2, tint: vary(k, FRAME, 0.9, 1.0), strip: 11 });
  // its back, closed in: boards from the ground to its roof, in line with the barn's back wall
  const bw = wallOf(Math.PI, D / 2);
  // (the wall runs on to the outside of the corner post, and the corner board over its end is drawn on both faces: seen
  // from inside the lean-to, its edge would otherwise stand alone like a stick)
  const end = -LXP + 0.16;
  boardAndBatten(k, bw, { a0: W / 2 + 0.03, a1: end, y0: 0.03, top: (a) => ltUnder(-a), paint, tint: BARE, inTint: INNER, rows: [1.0, 2.0] });
  k.board([0.14, ltUnder(LXP) - 0.03, 0.03], null, null, { m: wallM(bw, end - 0.06, (ltUnder(LXP) + 0.03) / 2, 0.035), long: 1, tint: TRIM, skip: '-y' });
}

// ── the cupola: a board-and-batten box on the ridge, louvred all round, a hipped cap, a horse weathervane ───────────
function cupola(k, paint) {
  const h = CUP.half, cz = CUP.z, yb = ROOF0 - h * TP - 0.08, y1 = RIDGE + 0.6, y2 = y1 + 0.55;
  for (const th of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
    const w = wallOf(th, h, 0, cz);
    const across = Math.abs(Math.sin(th)) < 0.5;   // (a face across the ridge: its boards stand on the slopes, each its own height)
    boardAndBatten(k, w, { a0: -h, a1: h, y0: yb, bottom: (b0, b1) => ROOF0 - (across ? Math.max(Math.abs(b0), Math.abs(b1)) : h) * TP - 0.05, top: () => y1, paint, tint: BARE, inTint: null, rows: [], solid: false });
    // the louvres: a sill, a head, five slats tilted to shed the rain, dark behind
    k.board([2 * h + 0.04, 0.05, 0.1], null, null, { m: wallM(w, 0, y1 + 0.025, 0.03), long: 0, tint: TRIM });
    k.board([2 * h + 0.04, 0.08, 0.06], null, null, { m: wallM(w, 0, y2 - 0.04, 0.01), long: 0, tint: TRIM });
    for (let i = 0; i < 5; i++) k.board([2 * h - 0.16, 0.02, 0.13], null, null, { m: wallM(w, 0, y1 + 0.1 + i * 0.09, -0.03, [0.75, 0, 0]), long: 0, tint: vary(k, TRIM, 0.85, 1.0) });
    k.board([2 * h - 0.1, y2 - y1, 0.01], null, null, { m: wallM(w, 0, (y1 + y2) / 2, -0.16), long: 0, tint: [0.1, 0.09, 0.08], skip: '-z' });
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.board([0.1, y2 - y1, 0.1], [sx * (h - 0.03), (y1 + y2) / 2, cz + sz * (h - 0.03)], null, { long: 1, tint: TRIM, skip: '-y+y' });
  k.solid([2 * h, y2 - yb, 2 * h], [0, (y2 + yb) / 2, cz]);
  // the cap: four hipped faces of shakes, three courses each, a soffit board under each overhang, hip boards
  const ov = 0.16, he = h + ov, ya = y2 + 0.55, cp = Math.atan2(ya - y2, he), sl = Math.hypot(ya - y2, he);
  // (under the courses, the cap itself: a pyramid out to the corners, its sides grained like the shakes, so the hips are
  // closed and no sky shows between the courses)
  k.prism('wood', ngon(4, he * Math.SQRT2), ya - y2 - 0.005, [0, y2 + (ya - y2 - 0.005) / 2, cz], [0, 0, 0], { tint: SHAKE.map((c) => c * 0.82), strip: WOOD.shake, taper: 0.99, skip: '-y', roof: true });
  for (let f = 0; f < 4; f++) {
    const M = mul(T(0, 0, cz), RY(f * Math.PI / 2));
    k.board([2 * he, 0.02, ov + 0.02], null, null, { m: mul(M, T(0, y2 - 0.01, h + ov / 2 - 0.01)), long: 0, tint: ROOFB, skip: '+y' });
    for (let c = 0; c < 3; c++) {
      const s0 = c * 0.21, L = Math.min(0.42, sl - s0 + 0.02), sm = s0 + L / 2, half = he * (1 - sm / sl) * 0.8;
      for (let x = -half; x < half - 0.03;) {
        const w = Math.min(k.r(0.2, 0.34), half - x);
        const m = mul(M, T(x + w / 2, y2 + Math.sin(cp) * sm + 0.02, he - Math.cos(cp) * sm), RX(cp), RY(k.r(-0.03, 0.03)));
        k.board([w - 0.008, 0.022, L], null, null, { m, long: 2, strip: WOOD.shake + Math.floor(k.R() * 2), tint: vary(k, SHAKE, 0.85, 1.1), shakeE: 0.21, skip: '-y-z+x-x', roof: true });
        x += w;
      }
    }
    const hl = Math.hypot(sl, he), ha = Math.atan2(ya - y2, Math.SQRT2 * he);
    k.board([0.07, 0.035, hl - 0.34], null, null, { m: mul(M, T(he * 0.42, ya - (ya - y2) * 0.58 + 0.03, he * 0.42), RY(Math.PI / 4), RX(ha)), long: 2, tint: vary(k, SHAKE, 0.7, 0.8), strip: 11, roof: true });
  }
  // the weathervane: a rod, a little iron horse at a gallop, an arrow under it, the four points of the compass
  const vy = ya + 0.02;
  k.box('iron', [0.03, 0.62, 0.03], [0, vy + 0.31, cz], null, { tint: IRON });
  for (const [sz, pos, rot] of [[[0.6, 0.025, 0.012], [0, vy + 0.36, cz], null], [[0.09, 0.09, 0.012], [0.3, vy + 0.36, cz], [0, 0, Math.PI / 4]],
    [[0.3, 0.1, 0.014], [0, vy + 0.52, cz], null], [[0.13, 0.05, 0.014], [0.17, vy + 0.6, cz], [0, 0, 0.8]], [[0.1, 0.045, 0.014], [0.23, vy + 0.63, cz], [0, 0, -0.3]],
    [[0.03, 0.12, 0.014], [-0.1, vy + 0.42, cz], [0, 0, 0.5]], [[0.03, 0.12, 0.014], [0.11, vy + 0.42, cz], [0, 0, -0.6]], [[0.12, 0.03, 0.014], [-0.19, vy + 0.53, cz], [0, 0, -0.5]],
    [[0.34, 0.015, 0.015], [0, vy + 0.18, cz], null], [[0.015, 0.015, 0.34], [0, vy + 0.18, cz], null]]) k.box('iron', sz, pos, rot, { tint: IRON });
}

// ── the front: the sign, the hayloft door, the hoist beam with its pulley and rope ──────────────────────────────────
function front(k, r) {
  const z = D / 2;
  // the sign's backing board (its painted face is a plane of the boards picture, just in front), a frame of boards round
  // it standing proud of the face
  k.board([4.86, 1.06, 0.05], [0, 3.93, z + 0.047], null, { long: 0, tint: vary(k, TRIM, 0.7, 0.8), skip: '-z', outside: true });
  for (const s of [-1, 1]) {
    k.board([4.86, 0.1, 0.05], [0, 3.93 + s * 0.475, z + 0.095], null, { long: 0, tint: vary(k, FRAME, 0.75, 0.9), strip: 10, outside: true });
    k.board([0.1, 0.86, 0.05], [s * 2.38, 3.93, z + 0.095], null, { long: 1, tint: vary(k, FRAME, 0.75, 0.9), strip: 11, outside: true });
  }
  // the hayloft door, X-braced, shut
  into(k, wallM(FRONT, HAY.a0, HAY.y0, 0.085), (t) => doorLeaf(t, { w: HAY.a1 - HAY.a0, h: HAY.y1 - HAY.y0, side: 1, tint: DOORW, xBrace: true, rails: [0.18, 1.47], strap: STRAP }), r.seed * 13 + 3);
  // the hoist beam out of the gable's peak, a brace under it, the pulley block on its end
  const by = 7.84, bz1 = z + 1.4;
  k.board([0.18, 0.22, 1.9], [0, by, z + 0.45], null, { long: 2, tint: vary(k, FRAME, 0.95, 1.05), strip: 10, ends: 'log', outside: true });
  const ba = Math.atan2(by - 0.11 - 6.9, 0.85), bl = Math.hypot(by - 0.11 - 6.9, 0.85);
  k.board([0.12, 0.12, bl], [0, (by - 0.11 + 6.9) / 2, z + 0.06 + 0.425], [-ba, 0, 0], { long: 2, tint: vary(k, FRAME, 0.9, 1.0), strip: 11 });
  k.box('iron', [0.02, 0.14, 0.02], [0, by - 0.17, bz1 - 0.15], null, { tint: IRON });
  k.board([0.09, 0.24, 0.15], [0, by - 0.36, bz1 - 0.15], null, { long: 1, tint: vary(k, FRAME, 0.8, 0.9) });
  k.prism('iron', ngon(8, 0.08), 0.1, null, null, { m: mul(T(0, by - 0.38, bz1 - 0.15), RZ(Math.PI / 2)), tint: IRON, smooth: true });
  // the rope: one fall straight down to a hook, the other across to a cleat by the door, its slack coiled on it
  const rope = (a, b, o = {}) => { const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(); const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.3)); m.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); k.board([0.026, 0.026, L], null, null, { m, long: 2, tint: ROPE, strip: WOOD.shake, ...o }); };
  rope([0, by - 0.4, bz1 - 0.08], [0, 5.55, bz1 - 0.08]);
  k.box('iron', [0.02, 0.12, 0.05], [0, 5.5, bz1 - 0.08], null, { tint: IRON });
  rope([0, by - 0.4, bz1 - 0.22], [0.95, 5.95, z + 0.1]);
  k.board([0.24, 0.04, 0.05], [0.95, 5.92, z + 0.06], null, { long: 0, tint: FRAME });     // the cleat
  ropeCoil(k.parts.rope, [0.95, 5.9, z + 0.06], [0, 0, 1], { r: 0.16, loops: 3 });
}

// a gooseneck lamp over the sign: an iron arm out of the wall, bent down, a shade with the lamp under it; its light
// falls on the sign. Returns the light (its glow sprite at the lamp)
function gooseneck(k, x, z) {
  const y0 = 4.56, rod = (a, b) => { const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(); const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(1, 0, 0)); m.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); k.box('iron', [0.022, 0.022, L + 0.01], null, null, { m, tint: IRON }); };
  k.box('iron', [0.08, 0.12, 0.02], [x, y0, z + 0.03], null, { tint: IRON });
  const pts = [[x, y0, z + 0.04], [x, y0 + 0.12, z + 0.22], [x, y0 + 0.13, z + 0.42], [x, y0 + 0.06, z + 0.56]];
  for (let i = 0; i < pts.length - 1; i++) rod(pts[i], pts[i + 1]);
  k.prism('iron', ngon(10, 0.13), 0.1, [x, y0 + 0.0, z + 0.58], null, { tint: IRON, taper: 0.7, smooth: true });
  k.parts.glow.push({ size: [0.07, 0.04, 0.07], m: T(x, y0 - 0.05, z + 0.58), kind: GLOW.flame, col: [6, 3.4, 1.2] });
  const p = [x, y0 - 0.07, z + 0.58], aim = new THREE.Vector3(0, -0.82, -0.57).normalize();
  return { p, reach: 6.5, strength: 2.2, dir: aim.toArray(), glow: [x, y0 - 0.06, z + 0.58] };
}

// ── odds and ends inside: the ladder to the loft, a feed bin, tack hung on the posts ─────────────────────────────────
function inside(k) {
  // the ladder, leaning on the left loft's edge in the front of the barn
  const lz = 4.25, bx = -1.12, tx = -1.5, ty = 3.95, L = Math.hypot(tx - bx, ty), ang = Math.atan2(tx - bx, ty);
  for (const dz of [-0.21, 0.21]) k.board([0.06, L, 0.045], [(bx + tx) / 2, ty / 2, lz + dz], [0, 0, -ang], { long: 1, tint: vary(k, LOFTW, 0.9, 1.05), cuts: [-1, 0, 1], inside: true });
  for (let y = 0.35; y < ty - 0.1; y += 0.35) k.board([0.035, 0.035, 0.46], [bx + (tx - bx) * y / ty, y, lz], null, { long: 2, tint: vary(k, LOFTW, 0.85, 1.0), inside: true });
  // a feed bin against the right front wall: a plank box with a lid, a scoop hung on it
  const fx = 3.55, fz = D / 2 - 0.62, fw = 1.3, fd = 0.75, fh = 0.85;
  for (let j = 0; j < 4; j++) k.board([fw, 0.2, 0.035], [fx, 0.1 + j * 0.205 + 0.0, fz - fd / 2], null, { long: 0, tint: vary(k, STALLW, 0.8, 1.0), inside: true, skip: '+y-y' });
  for (const s of [-1, 1]) k.board([0.035, fh, fd], [fx + s * fw / 2, fh / 2, fz], null, { long: 2, tint: vary(k, STALLW, 0.8, 0.95), inside: true });
  for (const q of [-1, 1]) k.board([fw + 0.06, 0.035, fd / 2 + 0.03], [fx, fh + 0.03 + (q > 0 ? 0.0 : 0.0), fz + q * fd / 4], [q * 0.02, 0, 0], { long: 0, tint: vary(k, STALLW, 0.85, 1.0), inside: true });
  k.solid([fw, fh, fd], [fx, fh / 2, fz]);
  // tack on the aisle faces of the posts (under the lanterns): coiled ropes and bridles; a saddle blanket over the right
  // front stall's partition
  coil(k, [AX - 0.1, 1.45, 2.6], [-1, 0, 0]); coil(k, [-AX + 0.1, 1.5, 0], [1, 0, 0]);
  bridle(k, [-AX + 0.1, 1.75, 2.6], [1, 0, 0]); bridle(k, [AX - 0.1, 1.75, 0], [-1, 0, 0]); bridle(k, [-AX + 0.1, 1.7, -2.6], [1, 0, 0]);
  for (const s of [-1, 1]) k.board([0.9, 0.5, 0.025], [3.1, 1.85, 2.6 + s * 0.05], null, { long: 0, paint: [0.3, 0.055, 0.04], tint: [0.6, 0.5, 0.4], inside: true });
  k.board([0.9, 0.025, 0.125], [3.1, 2.11, 2.6], null, { long: 0, paint: [0.28, 0.05, 0.035], tint: [0.6, 0.5, 0.4], inside: true });
}
// a frame on a post's face: c the point on the face, n which way it faces (along x or z); u runs across it, up is y
const onFace = (c, n) => { const u = [n[2], 0, -n[0]]; return (du, dy, dn) => [c[0] + u[0] * du + n[0] * dn, c[1] + dy, c[2] + u[2] * du + n[2] * dn]; };
const faceRot = (n, rz = 0) => [0, Math.atan2(n[0], n[2]), rz];
// a coil of rope hung on a peg
function coil(k, c, n) {
  const P = onFace(c, n), rot = faceRot(n);
  k.board([0.04, 0.04, 0.1], P(0, 0.2, 0.05), rot, { long: 2, tint: FRAME });
  ropeCoil(k.parts.rope, P(0, 0.2, 0), n, { r: 0.15, loops: 2 });
}
// a bridle: a strap loop down from a peg, a browband, the iron bit, the reins hanging below
function bridle(k, c, n) {
  const P = onFace(c, n), lth = [0.2, 0.11, 0.06], o = { paint: lth, tint: [0.5, 0.4, 0.3], inside: true };
  k.board([0.04, 0.04, 0.1], P(0, 0.08, 0.05), faceRot(n), { long: 2, tint: FRAME });
  for (const s of [-1, 1]) k.board([0.035, 0.5, 0.012], P(s * 0.07, -0.2, 0.03), faceRot(n, -s * 0.12), { long: 1, ...o });
  k.board([0.18, 0.035, 0.012], P(0, -0.05, 0.035), faceRot(n), { long: 0, ...o });
  k.box('iron', [0.16, 0.02, 0.02], P(0, -0.46, 0.035), faceRot(n), { tint: IRON });
  for (const s of [-1, 1]) k.board([0.03, 0.55, 0.01], P(s * 0.05, -0.74, 0.03), faceRot(n, s * 0.05), { long: 1, ...o });
}

// ── the floor and the boards' faces (not from the kit: plain meshes with their own pictures) ────────────────────────
function plane(w, d, nx, nz, uvScale) {
  const g = new THREE.PlaneGeometry(w, d, nx, nz); g.rotateX(-Math.PI / 2);
  if (uvScale) { const P = g.attributes.position, U = g.attributes.uv; for (let i = 0; i < P.count; i++) U.setXY(i, P.getX(i) / uvScale, P.getZ(i) / uvScale); }
  return g;
}
function floors() {
  const fl = plane(W - 0.06, D - 0.06, 16, 18, 1.7); fl.translate(0, 0.012, 0);
  const sp = [[0, D / 2 + 1.0, 3.6, 2.4], [0, -D / 2 - 0.9, 3.4, 2.0], [0.1, 2.9, 2.6, 2.6], [-0.3, -0.6, 2.4, 2.4], [0.2, -3.7, 2.6, 2.4], [-6.4, 3.6, 2.6, 2.4],
    ...[1, -1].flatMap((sx) => [1.3, -1.3, -3.9].map((z, i) => [sx * (SF + 1.55 + 0.1 * i), z + 0.1 * sx, 2.9, 2.4]))].map(([x, z, w, d], i) => { const g = plane(w, d, 6, 6); g.translate(x, 0.02 + i * 0.002, z); return g; });
  return { floor: fl, spill: mergeGeometries(sp) };
}
// a picture plane facing `n` (+z or along x), from the boards picture's region
function face(w, h, region, m) {
  const g = new THREE.PlaneGeometry(w, h, 2, 1), [u0, v0, u1, v1] = boardUV(region), U = g.attributes.uv;
  for (let i = 0; i < U.count; i++) U.setXY(i, u0 + (u1 - u0) * U.getX(i), v0 + (v1 - v0) * U.getY(i));
  g.applyMatrix4(m); return g;
}

// each wall board's own numbers for the shader (parts.js boardWear), per corner: x its nails (1 a board: two across it, 0.5
// a batten: one), y the board's height, a centimetre or two off (so a wall's nails don't line up dead level), z how much
// more of its paint has gone: by the corners and the doorways (handled and knocked), low down, and a little board by
// board (some boards hold their paint, some have lost most of it)
function boardAttr(geo, parts, seed) {
  const R = rng(seed * 97 + 5), of = geo.userData.partOf, P = geo.attributes.position, n = P.count, A = new Float32Array(n * 3);
  const per = parts.map((Q) => [(R() - 0.5) * 0.03, R() < 0.3 ? 0.15 + 0.2 * R() : 0.08 * R()]);
  const near = (d, r) => 1 - smooth01(d, 0, r);
  for (let i = 0; i < n; i++) {
    const Q = parts[of[i]], o = Q.o; if (!o.nail && !o.paint) continue;
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), [jit, own] = per[of[i]];
    const corner = Math.min(Math.hypot(Math.abs(x) - W / 2, Math.abs(z) - D / 2), 9);
    const door = Math.abs(Math.abs(z) - D / 2) < 0.2 ? Math.abs(Math.abs(x) - DW / 2) + Math.max(0, y - DH) : 9;
    A[i * 3] = o.nail || 0; A[i * 3 + 1] = Q.m.elements[13] + jit;
    A[i * 3 + 2] = own + 0.45 * near(corner, 1.3) + 0.4 * near(door, 1.1) + 0.2 * near(y, 1.3);
  }
  geo.setAttribute('aBoard', new THREE.BufferAttribute(A, 3));
}

// ── build it all ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function buildStable(recipeIn = {}, env = {}) {
  const t0 = performance.now(), r = stableRecipe(recipeIn), paint = PAINTS[r.paint].c;
  const k = new Kit(r.seed); k.parts.glow = []; k.parts.hay = []; k.parts.rope = [];
  SILLS.length = 0;
  const lamps = [];
  const marks = [], mark = (name) => marks.push([name, k.parts.wood.length, k.parts.iron.length]);
  walls(k, paint); mark('walls'); frame(k); mark('frame'); const stallList = stalls(k, r); mark('stalls'); roofs(k); mark('roofs'); leanTo(k, paint); mark('leanTo');
  cupola(k, paint); mark('cupola'); front(k, r); mark('front'); inside(k); mark('inside');
  // the back doors, swung open and left so (into the static mesh); the front ones are their own meshes
  const LEAF = { w: DW / 2, h: DH - 0.05, tint: DOORW, strap: STRAP, rails: [0.3, 1.5, 2.75] };
  const hingeL = [-DW / 2, 0.02, D / 2 + 0.11], hingeR = [DW / 2, 0.02, D / 2 + 0.11], OPEN = 100 * Math.PI / 180;
  for (const [hg, side, ang] of [[hingeL, 1, -80], [hingeR, -1, 80]]) into(k, mul(RY(Math.PI), T(...hg), RY(ang * Math.PI / 180)), (t) => doorLeaf(t, { ...LEAF, side }), r.seed * 17 + side + 5);
  // the iron pintles the front leaves hang on, on the casing
  for (const [hg] of [[hingeL], [hingeR]]) for (const y of [0.3, 2.75]) k.box('iron', [0.05, 0.1, 0.09], [hg[0] - Math.sign(hg[0]) * 0.03, y, D / 2 + 0.07], null, { tint: IRON });
  // the lanterns: on iron brackets on the aisle posts, one hung in the middle, one by the doors outside, one in the lean-to
  // (low on the posts between the stalls, close in: under the line from the doorway to the boards over the gates, and
  // their light falls on the floor and the gates beside them)
  for (const z of [2.6, -2.6]) for (const sx of [-1, 1]) lamps.push(lantern(k, sx * (AX - 0.1 - 0.17), 1.95, z, { bracket: [sx * 0.17, 0], strength: 1.6 }));
  lamps.push(lantern(k, 0, 2.5, 0, { chain: 0.25, strength: 1.4 }));
  lamps.push(lantern(k, 2.32, 2.6, D / 2 + 0.36, { bracket: [0, -0.31], strength: 1.3 }));
  lamps.push(lantern(k, -6.4, 2.35, 1.6, { chain: ltUnder(-6.4) - 0.17 - 2.58, strength: 1.1 }));
  for (const x of [-1.25, 1.25]) lamps.push(gooseneck(k, x, D / 2));
  // the front doors' leaves, each its own kit (the open ones block light: solids for the bake)
  const leaves = [];
  for (const [hg, side, ang, harnessed] of [[hingeL, 1, -OPEN, false], [hingeR, -1, OPEN, true]]) {
    const lk = new Kit(r.seed * 19 + side); lk.parts.glow = []; lk.parts.rope = [];
    doorLeaf(lk, { ...LEAF, side, harness: harnessed ? {} : null, handle: true });
    const g = buildGeometry(lk.parts.wood, 'wood', rng(r.seed * 23 + side), { topAt: () => DH + 0.3, tintAt: (x, y, z, t, o) => tintAt(x, y, z, t, { ...o, outside: true }) });
    leaves.push({ geo: g, hinge: hg, open: ang, closed: 0, parts: lk.parts.wood.length, rope: ropeGeometry(lk.parts.rope) });
    k.solid([DW / 2, DH, 0.1], null, null, mul(T(...hg), RY(ang), T(side * DW / 4, DH / 2, 0)));
  }

  // the boards' faces: the sign, and one board on each stall's front over its gate, facing the aisle (big enough to read
  // from the doorway)
  const boardList = [], bf = [face(4.6, 0.86, BOARDS.sign, T(0, 3.93, D / 2 + 0.074))];
  const order = ['R1', 'R2', 'R3', 'L1', 'L2', 'L3'];
  for (const S of stallList) {
    const slot = order.indexOf(S.id), x = S.side * (SF - 0.04);
    k.board([0.03, 0.5, 0.96], [S.side * (SF - 0.02), 2.565, S.z], null, { long: 2, tint: vary(k, TRIM, 0.6, 0.7), inside: true });
    bf.push(face(0.9, 0.45, BOARDS.slot(slot), mul(T(x, 2.565, S.z), RY(-S.side * Math.PI / 2))));
    S.horse = r.horses[slot]; S.board = { slot, at: [x, 2.565, S.z] };
    boardList.push(S.board);
  }
  // the kit's parts into meshes, one per material
  const R = rng(r.seed + 1), geos = {};
  for (const g of ['wood', 'iron']) geos[g] = buildGeometry(k.parts[g], g, R, { topAt, tintAt });
  // (the mangers' hay: the props' hay picture, with stone-style UVs: each face its own window on the straw)
  boardAttr(geos.wood, k.parts.wood, r.seed);
  geos.hay = buildGeometry(k.parts.hay, 'stone', R, {});
  geos.glow = glowGeometry(k.parts.glow);
  geos.rope = ropeGeometry(k.parts.rope);
  geos.stone = footing(r, env);
  Object.assign(geos, floors());
  geos.boards = mergeGeometries(bf); for (const g of bf) g.dispose();
  const msBuild = performance.now() - t0;

  // the bake: the voxel grid of the solids, then each mesh's corners
  const t1 = performance.now();
  const occ = new Occlusion(k.occ, 1.6, 0.08, { reach: 2.4, rays: 20, groundReach: 0.7 });
  const opening = (c, u, v, n, front = false, kk = 1) => ({ c, u: u.map((x) => x * kk), v, n, front });
  const openings = [
    opening([0, DH / 2, D / 2], [DW / 2, 0, 0], [0, DH / 2, 0], [0, 0, 1], true),
    opening([0, DH / 2, -D / 2], [DW / 2, 0, 0], [0, DH / 2, 0], [0, 0, -1]),
    opening([(WIN_F.a0 + WIN_F.a1) / 2, 1.95, D / 2], [0.47, 0, 0], [0, 0.55, 0], [0, 0, 1]),
    ...[1, -1].flatMap((sx) => [...STALL_WIN.map((z) => opening([sx * W / 2, 1.95, z], [0, 0, 0.35], [0, 0.3, 0], [sx, 0, 0], false, sx < 0 ? 0.6 : 1)),
      opening([sx * W / 2, 1.95, (SIDE_WIN.z0 + SIDE_WIN.z1) / 2], [0, 0, 0.5], [0, 0.55, 0], [sx, 0, 0], false, sx < 0 ? 0.6 : 1)]),
  ];
  const insideP = (x, y, z) => Math.abs(x) < W / 2 - 0.01 && Math.abs(z) < D / 2 - 0.01 && y > -0.5 && y < roofUnder(x) - 0.01;
  // THE STALLS' FILL: lantern light that has found its way into a stall and bounced about in it (no direction, no
  // shadow), so a stall is a dim warm room and not a black box: on what is in a stall or faces into one (the point a
  // few cm in front of a face is inside a stall), most on what faces the stall's middle, a little less high up
  const stallOf = (x, y, z) => { if (Math.abs(x) < SF + 0.03 || Math.abs(x) > W / 2 - 0.03 || y > 3.0) return null; for (let i = 0; i < 3; i++) if (z < STALLZ[i] && z > STALLZ[i + 1]) return [Math.sign(x), (STALLZ[i] + STALLZ[i + 1]) / 2]; return null; };
  const fill = (x, y, z, nx, ny, nz) => {
    const s = stallOf(x + nx * 0.08, y + ny * 0.08, z + nz * 0.08); if (!s) return 0;
    const cx = s[0] * 3.1, cy = 1.4, cz = s[1], dx = cx - x, dy = cy - y, dz = cz - z, d = Math.hypot(dx, dy, dz) || 1;
    return 0.16 * (0.55 + 0.45 * Math.max(0, (dx * nx + dy * ny + dz * nz) / d)) * (1 - 0.35 * smooth01(y, 1.5, 3.0));
  };
  const light = new Light(occ, { inside: insideP, fill, openings, lamps, base: 0.2, gain: 3.2 });
  for (const g of ['wood', 'iron', 'hay', 'stone', 'floor', 'spill', 'boards', 'rope']) light.bake(geos[g]);
  for (const L of leaves) {
    light.bake(L.geo, mul(T(...L.hinge), RY(L.open)), 'open');
    light.bake(L.geo, T(...L.hinge), 'closed');
  }
  light.setDoors = (open) => {
    for (const g of ['wood', 'iron', 'hay', 'stone', 'floor', 'spill', 'boards', 'rope']) light.apply(geos[g], open);
    for (const L of leaves) light.apply(L.geo, open, open ? 'open' : 'closed');
  };
  light.setDoors(true);
  const msBake = performance.now() - t1;

  // centre the footprint (the lean-to's eave to the right eave, front gable to back): everything moves by OX
  const OX = -((-W / 2 - LT - 0.35) + (W / 2 + EO)) / 2;
  for (const g in geos) geos[g].translate(OX, 0, 0);
  for (const L of leaves) L.hinge = [L.hinge[0] + OX, L.hinge[1], L.hinge[2]];
  for (const S of stallList) { S.z = S.z; S.frontX += OX; S.stallBack += OX; S.x = S.side * 2.6 + OX; S.board.at[0] += OX; }
  for (const L of lamps) { L.p = [L.p[0] + OX, L.p[1], L.p[2]]; if (L.glow) L.glow = [L.glow[0] + OX, L.glow[1], L.glow[2]]; }
  // the sky light inside at a point (for an animal standing there: parts.js animalLamps' shade)
  light.fillAt = (x, y, z) => fill(x - OX, y, z, 0, 0, 0) || (stallOf(x - OX, y, z) ? 0.16 : 0);
  light.skyAt = (x, y, z) => { const b = light.at(x - OX, y, z, 0, 1, 0); return b[1] ? light.base + (1 - light.base) * Math.min(1, light.gain * (b[2] + b[3])) : 1; };
  light.offset = OX;

  const counts = {}; let parts = 0;
  for (const g in k.parts) { counts[g] = k.parts[g].length; parts += counts[g]; }
  return {
    recipe: r, geos, doors: leaves, stalls: stallList, lamps, light, occ, props: propList(OX),
    anchors: {
      doorways: [{ name: 'front', centre: [OX, DH / 2, D / 2], w: DW, h: DH, out: [0, 0, 1] }, { name: 'back', centre: [OX, DH / 2, -D / 2], w: DW, h: DH, out: [0, 0, -1] }],
      sign: { centre: [OX, 3.93, D / 2 + 0.074], w: 4.6, h: 0.86 }, boards: boardList, lanterns: lamps.map((L) => L.p),
      footprint: { w: W + LT + 0.35 + EO, d: D + 2 * GO, h: ROOF0 + 1.6, ridge: RIDGE, eave: EAVE, loft: LOFT },
    },
    counts, parts, msBuild, msBake, ms: performance.now() - t0, offset: OX,
    marks, kit: k,   // (for the rigs: the parts kit, and where each stage's parts start, to count what each costs)
  };
}

// ── the props that go with it (barn frame, moved by OX): each { type, x, y, z, rot, ... } ───────────────────────────
function propList(OX) {
  const P = [
    { type: 'trough', x: -3.35, z: D / 2 + 0.75, rot: 0 },
    { type: 'barrel', x: -2.15, z: D / 2 + 0.55 }, { type: 'barrel', x: 2.4, z: D / 2 + 0.6 }, { type: 'barrel', x: 2.95, z: D / 2 + 0.95, h: 0.78 },
    { type: 'barrel', x: -4.15, z: D / 2 - 0.55 },
    { type: 'bucket', x: -2.45, z: D / 2 + 1.05 }, { type: 'bucket', x: -1.3, z: -1.9 },
    ...[1, -1].flatMap((sx) => [0, 1, 2].map((i) => ({ type: 'bucket', x: sx * (W / 2 - 0.38), z: STALLZ[i + 1] + 0.38, inStall: true }))),
    { type: 'crate', x: -5.45, z: D / 2 - 0.45, rot: 0.2 }, { type: 'crate', x: -5.4, z: D / 2 - 0.5, y: 0.6, rot: -0.15, size: 0.5 }, { type: 'crate', x: 4.05, z: 3.4, rot: 0.1 },
    { type: 'bale', x: -2.2, z: D / 2 + 1.35, rot: 0.35 }, { type: 'bale', x: -2.35, z: 4.55, rot: 0.08 }, { type: 'bale', x: -2.55, z: 3.35, rot: 0.1 }, { type: 'bale', x: -2.5, z: 3.4, y: 0.4, rot: -0.05 },
    { type: 'bale', x: -5.5, z: -3.6, rot: 0.05 }, { type: 'bale', x: -5.5, z: -2.6, rot: -0.05 }, { type: 'bale', x: -5.45, z: -3.1, y: 0.4, rot: 0.1 },
    { type: 'wagon', x: -6.45, z: -0.6, rot: 0 },
  ];
  // bales stacked along both lofts' edges (two high here and there)
  for (const sx of [-1, 1]) for (const [z, n] of [[-4.2, 2], [-1.6, 2], [1.4, 1], [3.6, 1]]) for (let j = 0; j < n; j++) P.push({ type: 'bale', x: sx * 2.35, z: z + (sx > 0 ? 0.3 : 0), y: LOFT + j * 0.4, rot: Math.PI / 2 + (j ? 0.06 : -0.04) * sx });
  for (const p of P) p.x += OX;
  return P;
}
