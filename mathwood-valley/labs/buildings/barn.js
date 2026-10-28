// THE BARN: the farm's barn (src/farm.js puts it at the back of the farm, its big doors on the lane), built from parts in
// code like the town's buildings: board and batten in a faded red ochre (or bare weathered wood) on a fieldstone footing,
// a gable roof of split shakes, big X-braced double doors in the front gable that swing out (E opens them: the doors'
// keeper), a hay-loft door above them under a hoist beam with its pulley and rope, small four-pane windows down the
// sides, a louvred vent in the back gable. Inside: a dirt floor, posts and beams, a hayloft over both sides with the
// middle open to the roof (the drive floor, as wide as the doors), three stalls under the right loft with a manger in
// each, a feed bin, a ladder up to the left loft, a lantern on a post. The loose hay, the bales, a pitchfork and the
// buckets are props (props.js; inside, all clutter: priority 3, loaded last).
//
//   buildBarn(recipe, env) -> the same shape as the other buildings: { geos (wood, iron, stone, hay, glow, glass,
//     floor, spill), doors (the two big leaves: their own meshes, they swing), lamps, light (the baked light), props,
//     anchors (footprint, doorways, rooms, the loft, the stalls), views, offset, kit (its solids, for the walk grid) }
//
// Frame: the walls centred on x = z = 0, the ground at y = 0, the big doors face +z. Metres. 12 x 9 m inside the walls
// (src/farm.js FARM.barn), the ridge about 7.3 m up.
//
// A RECIPE is what makes one barn its own: paint (a colour or none), wear (how much of it is gone), wood (the trim
// sheet's look), stone and mortar (the footing's), seed (every random choice).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, buildGeometry, Occlusion } from '../materials/cabin.js';
import { rng, WOOD, WOOD_LOOKS } from '../materials/textures.js';
import { buildStoneWall, SHAPES, PALETTES, MORTARS } from '../stone/stonewall.js';
import { T, RY, RZ, mul, vary, smooth01, ngon, wallOf, wallM, boardAndBatten, casing, roofSlope, doorLeaf, lantern, glowGeometry, Light, GLOW } from './parts.js';
import { tintAt } from './cabins.js';

// ── the recipe ───────────────────────────────────────────────────────────────────────────────────────────────────────
// paint colours are the paint itself (linear), before the weathering fades and wears it: red ochre, the iron-oxide
// paint farmers mixed with linseed oil, browner than the stable's barn red
export const BARN_PAINTS = {
  none: { label: 'None (bare wood)', c: null },
  ochre: { label: 'Faded red ochre', c: [0.3, 0.1, 0.05] },
  red: { label: 'Faded barn red', c: [0.34, 0.085, 0.058] },
  white: { label: 'Whitewash (faded)', c: [0.47, 0.46, 0.43] },
};
export const BARN_DEFAULTS = { kind: 'barn', paint: 'ochre', wear: 0.45, wood: 'straight', stone: 'grey', mortar: 'grey', seed: 23 };
export function barnRecipe(r = {}) {
  const o = { ...BARN_DEFAULTS, ...r };
  if (!BARN_PAINTS[o.paint]) o.paint = BARN_DEFAULTS.paint;
  o.wear = Math.min(1, Math.max(0, Number.isFinite(+o.wear) ? +o.wear : BARN_DEFAULTS.wear));
  if (!WOOD_LOOKS[o.wood]) o.wood = BARN_DEFAULTS.wood;
  if (!PALETTES[o.stone]) o.stone = BARN_DEFAULTS.stone;
  if (!MORTARS[o.mortar]) o.mortar = BARN_DEFAULTS.mortar;
  o.seed = Math.max(1, Math.round(+o.seed) || 1);
  return o;
}

// ── the sizes ────────────────────────────────────────────────────────────────────────────────────────────────────────
const W = 12, D = 9, X1 = W / 2, Z1 = D / 2;  // the walls: across (x), front to back (z)
const FT = 0.45, Y0 = FT - 0.05;              // the top of the stone footing; the boards' foot (lapping down over it)
const EAVE = 4.0;                             // the top of the side walls (the wall plates)
const PITCH = 27 * Math.PI / 180, TP = Math.tan(PITCH);
const RIDGE = EAVE + X1 * TP;                 // 7.06: the rafters' peak
const ROOF0 = RIDGE + 0.2;                    // the roof boards' top at the ridge
const GO = 0.4, EO = 0.45;                    // the roof past the gables, and past the side walls
const DW = 4.0, DH = 3.3;                     // the big doorway
const AX = DW / 2 + 0.1;                      // the posts either side of the drive floor (their middles), in line with the doors' jambs
const LOFT = 2.9;                             // the hayloft floor (its boards' top)
const STALLZ = [3.2, 0.6, -2.0, -Z1 + 0.1];   // the stalls' partitions, front to back (the last: the back wall)
const ROWS = [1.3, 2.6, 3.6, 5.0, 6.2];       // rows of corners up the walls (for the baked light)
export const BARN = { W, D, EAVE, RIDGE, FT, DW, DH, AX, LOFT };

// the roof's underside over a point, inside (the boards; the rafters hang 15 cm under them)
const roofUnder = (x) => ROOF0 - Math.abs(x) * TP - 0.03;

// ── colours: tints on the trim sheet's strips (1 = the strip as drawn) ──────────────────────────────────────────────
const BARE = [1.1, 1.1, 1.12];     // outside boards, unpainted: weathered toward silver-grey
const INNER = [1.0, 0.9, 0.78];     // the boards' inside faces: honey-brown, kept from the sun
const TRIM = [0.95, 0.93, 0.92];    // casings, corner boards: bare weathered wood
const FRAME = [1.08, 0.97, 0.85];   // posts, beams, joists (rough-sawn strips)
const SHAKE = [0.72, 0.69, 0.66];
const ROOFB = [0.66, 0.6, 0.54];    // the roof boards' undersides
const DOORW = [1.06, 1.0, 0.94];    // door planks: sun-dried
const STALLW = [1.12, 1.0, 0.86];   // stall planks: rubbed smooth and warmer
const LOFTW = [1.06, 0.97, 0.86];
const ROPE = [1.3, 1.08, 0.76];
const IRON = [0.85, 0.8, 0.76];
const STRAP = [0.035, 0.032, 0.03]; // iron straps on the doors (painted, so they stay one mesh with the planks)

// a part (a door leaf, a gate) built in a kit of its own, its parts moved into k through the matrix M
function into(k, M, build, seed) {
  const t = new Kit(seed); t.parts.glow = []; build(t);
  for (const g in t.parts) for (const P of t.parts[g]) {
    if (g === 'glow') { k.parts.glow.push({ ...P, m: mul(M, P.m) }); continue; }
    (k.parts[g] || (k.parts[g] = [])).push({ size: P.size, m: mul(M, P.m), o: P.o });
  }
  for (const O of t.occ) k.occ.push({ size: O.size, m: mul(M, O.m) });
}

// ── the walls ────────────────────────────────────────────────────────────────────────────────────────────────────────
// (a runs to the right seen from outside: +x on the front, -x on the back, -z on the east (stall) side, +z on the west)
const FRONT = wallOf(0, Z1), BACK = wallOf(Math.PI, Z1), EAST = wallOf(Math.PI / 2, X1), WEST = wallOf(-Math.PI / 2, X1);
const gTop = (a) => roofUnder(a) + 0.012;      // (the gable boards run a centimetre up into the roof boards)
const eTop = () => EAVE + 0.205;
const DOOR = { a0: -DW / 2, a1: DW / 2, y0: -1, y1: DH, door: true };
const HAYD = { a0: -0.75, a1: 0.75, y0: 4.3, y1: 5.8 };        // the hay-loft door
const VENT = { a0: -0.45, a1: 0.45, y0: 5.4, y1: 6.1 };        // a louvred vent in the back gable
// the windows: (east) one into each stall, (west) two into the open bay; z of each middle
const EAST_WIN = [(STALLZ[0] + STALLZ[1]) / 2, (STALLZ[1] + STALLZ[2]) / 2, (STALLZ[2] + STALLZ[3]) / 2], WEST_WIN = [2.2, -2.2];
const WIN = { half: 0.36, y0: 1.55, y1: 2.25 };
const winOf = (side, z) => { const a = side > 0 ? -z : z; return { a0: a - WIN.half, a1: a + WIN.half, y0: WIN.y0, y1: WIN.y1 }; };

function walls(k, paint) {
  const opts = (o) => ({ y0: Y0, paint, tint: BARE, inTint: INNER, rows: ROWS, bare: 0.06, ...o });
  boardAndBatten(k, FRONT, opts({ a0: -X1, a1: X1, top: gTop, apex: 0, opens: [DOOR, HAYD] }));
  boardAndBatten(k, BACK, opts({ a0: -X1, a1: X1, top: gTop, apex: 0, opens: [VENT] }));
  boardAndBatten(k, EAST, opts({ a0: -Z1, a1: Z1, top: eTop, opens: EAST_WIN.map((z) => winOf(1, z)) }));
  boardAndBatten(k, WEST, opts({ a0: -Z1, a1: Z1, top: eTop, opens: WEST_WIN.map((z) => winOf(-1, z)) }));
  // the corner boards: the one on the gable wall wide enough to cover the side wall's edge
  for (const sx of [-1, 1]) for (const [w, sz] of [[FRONT, 1], [BACK, -1]]) {
    const h = eTop() + 0.05 - Y0, yc = Y0 + h / 2, cl = ROWS.filter((y) => y < Y0 + h - 0.2).map((y) => y - yc);
    k.board([0.16, h, 0.03], null, null, { m: wallM(w, sx * sz * (X1 - 0.03), yc, 0.035), long: 1, tint: vary(k, TRIM, 0.9, 1.05), skip: '-z-y', cuts: cl, segFaces: '+z', outside: true });
    const sw = sx > 0 ? EAST : WEST, a = (sx > 0 ? -1 : 1) * sz * (Z1 - 0.05);
    k.board([0.14, h, 0.03], null, null, { m: wallM(sw, a, yc, 0.035), long: 1, tint: vary(k, TRIM, 0.9, 1.05), skip: '-z-y', cuts: cl, segFaces: '+z', outside: true });
  }
  // the openings' trim. The big doorway: casings only (the jamb posts fill the reveal)
  casing(k, FRONT, { ...DOOR, y0: 0 }, { tint: TRIM, depth: 0.04, width: 0.14 });
  casing(k, FRONT, HAYD, { tint: TRIM, depth: 0.12 });
  casing(k, BACK, VENT, { tint: TRIM, depth: 0.12 });
  for (const z of EAST_WIN) windowIn(k, EAST, winOf(1, z));
  for (const z of WEST_WIN) windowIn(k, WEST, winOf(-1, z));
  // the back gable's vent: slats tilted to shed the rain, the dark loft behind
  for (let i = 0; i < 4; i++) k.board([0.88, 0.025, 0.16], null, null, { m: wallM(BACK, 0, VENT.y0 + 0.1 + i * 0.17, -0.02, [0.7, 0, 0]), long: 0, tint: vary(k, TRIM, 0.85, 1.0), outside: true });
  k.board([0.88, 0.7, 0.01], null, null, { m: wallM(BACK, 0, (VENT.y0 + VENT.y1) / 2, -0.14), long: 0, tint: [0.12, 0.1, 0.09], skip: '-z' });
}
// a four-pane window: casing, sill, the glass (a glow part: dark by day, lit at night), its glazing bars
function windowIn(k, w, op) {
  casing(k, w, op, { tint: TRIM, depth: 0.12, width: 0.09 });
  const wd = op.a1 - op.a0, h = op.y1 - op.y0, ac = (op.a0 + op.a1) / 2, yc = (op.y0 + op.y1) / 2;
  // (one pane facing out: from inside it isn't drawn, so the day outside shows through the window)
  k.parts.glow.push({ size: [wd, h, 0], m: wallM(w, ac, yc, -0.03), pane: true, kind: GLOW.window, col: [1.8, 0.7, 0.18] });
  k.board([0.035, h, 0.03], null, null, { m: wallM(w, ac, yc, -0.015), long: 1, tint: TRIM, skip: '-z' });
  k.board([wd, 0.035, 0.03], null, null, { m: wallM(w, ac, yc, -0.015), long: 0, tint: TRIM, skip: '-z' });
}

// ── the stone footing (the Stone Lab's wall maker): one U under the walls, from one side of the big doorway round the
// back to the other, so its corners are folded corner stones ──────────────────────────────────────────────────────────
function footing(r, env) {
  const t = 0.36, inset = 0.03, x0 = X1 - inset, z0 = Z1 - inset, xd = DW / 2 + 0.02, G = -0.15;
  // (walked with its outside on the right seen from above, the front face first, as the stable's)
  const loop = [[-x0, z0], [-xd, z0], [-xd, z0 - t], [-x0 + t, z0 - t], [-x0 + t, -z0 + t], [x0 - t, -z0 + t], [x0 - t, z0 - t], [xd, z0 - t], [xd, z0], [x0, z0], [x0, -z0], [-x0, -z0]];
  SHAPES.barnFoot = { label: 'Barn footing', make: () => ({ H: FT, sections: [{ loop0: loop, loop1: loop, y0: G, y1: FT }], openings: [], top: { y: FT, t: 0, over: 0, rects: [] }, building: {} }) };
  const sw = buildStoneWall({ style: 'mortared', palette: r.stone, mortar: r.mortar, size: 0.42, irregularity: 0.5, colourMix: 0.5, bulge: 0.6, joint: 0.012, shape: 'barnFoot', seed: r.seed * 3 + 1 }, env);
  const geo = mergeGeometries([sw.stone, sw.mortar]); geo.userData.ownAO = true;
  sw.stone.dispose(); sw.mortar.dispose();
  return geo;
}

// ── the frame inside: posts, beams, girts, the hayloft over both sides, ties ────────────────────────────────────────
function frame(k) {
  const beam = (size, pos, o = {}) => k.board(size, pos, o.rot || null, { tint: vary(k, FRAME, 0.88, 1.1), strip: 10 + (k.R() < 0.5 ? 1 : 0), inside: true, ends: 'log', ...o });
  const zc = (L, step = 1.4) => { const c = []; for (let z = -L / 2 + step; z < L / 2 - 0.3; z += step) c.push(z); return c; };
  const postTop = LOFT - 0.25;
  for (const sx of [-1, 1]) {
    // the drive floor's posts under the loft's edge, and the jamb posts at both gables running up into them
    for (const z of STALLZ.slice(0, 3)) { beam([0.2, postTop, 0.2], [sx * AX, postTop / 2, z], { long: 1, skip: '-y', cuts: [-0.5, 0.5], segFaces: '+x-x+z-z' }); k.solid([0.2, postTop, 0.2], [sx * AX, postTop / 2, z]); }
    for (const sz of [1, -1]) { const top = gTop(AX) - 0.05; beam([0.2, top, 0.2], [sx * AX, top / 2, sz * (Z1 - 0.125)], { long: 1, skip: '-y', cuts: [-2, 0, 2], segFaces: '+x-x+z-z' }); k.solid([0.2, top, 0.2], [sx * AX, top / 2, sz * (Z1 - 0.125)]); }
    // the side walls' posts and plates, a girt low and one over the loft (under the windows' sills: clear of them)
    const wx = X1 - 0.125;
    for (const z of [Z1 - 0.125, ...STALLZ.slice(0, 3), -Z1 + 0.125]) beam([0.2, EAVE - 0.15 - FT, 0.2], [sx * wx, (EAVE - 0.15 + FT) / 2, z], { long: 1, skip: '-y' + (sx > 0 ? '+x' : '-x'), cuts: [0] });
    beam([0.2, 0.15, D - 0.05], [sx * wx, EAVE - 0.075, 0], { long: 2, cuts: zc(D - 0.05), segFaces: '-y+x-x' });
    const gx = sx * (X1 - 0.05), sk = sx > 0 ? '+x+z-z' : '-x+z-z';
    for (const y of [1.2, 3.5]) beam([0.05, 0.15, D - 0.45], [gx, y, 0], { long: 2, skip: sk, cuts: zc(D - 0.45) });
    // the hayloft: an edge beam on the posts, joists out to the wall, floor boards, a kick board along its edge
    beam([0.2, 0.25, D - 0.2], [sx * AX, LOFT - 0.125, 0], { long: 2, cuts: zc(D - 0.2), segFaces: '+x-x-y' });
    const jx0 = AX + 0.1, jx1 = X1 - 0.2, jL = jx1 - jx0;
    for (let z = -Z1 + 0.5; z < Z1 - 0.35; z += 0.7) beam([jL, 0.17, 0.06], [sx * (jx0 + jx1) / 2, LOFT - 0.115, z], { long: 0, skip: '+y+x-x', tint: vary(k, FRAME, 0.9, 1.05) });
    for (let x = AX - 0.1; x < X1 - 0.08;) {
      const bw = Math.min(k.r(0.3, 0.38), X1 - 0.06 - x); if (bw < 0.08) break;
      const j = k.r(-1.4, 1.4), xc = sx * (x + bw / 2), tint = vary(k, LOFTW, 0.85, 1.12);
      for (const [a, b] of [[-Z1 + 0.1, j], [j, Z1 - 0.1]]) k.board([bw - 0.005, 0.03, b - a - 0.004], [xc, LOFT - 0.015, (a + b) / 2], null, { long: 2, tint, skip: '+x-x+z-z', cuts: zc(b - a, 2.4), segFaces: '+y-y', inside: true });
      x += bw;
    }
    beam([0.04, 0.22, D - 0.2], [sx * (AX - 0.08), LOFT + 0.11, 0], { long: 2, skip: '-y', tint: vary(k, LOFTW, 0.9, 1.0) });
    k.solid([X1 - AX, 0.3, D - 0.1], [sx * (X1 + AX) / 2, LOFT - 0.12, 0]);
  }
  // the girts on the gables, either side of the big doorway (front) and right across (back)
  for (const sz of [1, -1]) for (const sx of [-1, 1]) for (const y of [1.2, 3.5]) {
    if (sz > 0 && y > DH) continue;   // (over the doors: the header)
    const z = sz * (Z1 - 0.05), sk = sz > 0 ? '+z+x-x' : '-z+x-x', a = AX + 0.1, b = X1 - 0.225;
    beam([b - a, 0.15, 0.05], [sx * (a + b) / 2, y, z], { long: 0, skip: sk });
    if (sz < 0 && sx > 0) beam([2 * AX - 0.2, 0.15, 0.05], [0, y, z], { long: 0, skip: sk });   // (the back's middle, between its jamb posts)
  }
  beam([DW + 0.6, 0.22, 0.2], [0, DH + 0.11, Z1 - 0.125], { long: 0 });     // the big doors' header
  // a tie right across at the plates (the drive stays open to the roof: a loaded wagon goes in), collar ties up under
  // the ridge, the ridge board
  beam([W - 0.45, 0.2, 0.18], [0, EAVE - 0.25, STALLZ[1]], { long: 0, cuts: [-3, -1, 1, 3] });
  const cy = 5.9, cw = (ROOF0 - 0.215 - cy) / TP;
  for (const z of [2.6, 0, -2.6]) beam([2 * cw, 0.16, 0.05], [0, cy, z], { long: 0, tint: vary(k, FRAME, 0.85, 1.0) });
  beam([0.05, 0.26, D - 0.1], [0, ROOF0 - 0.2, 0], { long: 2, cuts: zc(D - 0.1, 1.6) });
}

// ── the stalls under the right loft: plank partitions, plank fronts with a half door, a manger with hay ──────────────
function stalls(k, r) {
  const list = [], fx = AX - 0.03, wallX = X1 - 0.225;
  for (let i = 0; i < 3; i++) {
    const zf = STALLZ[i], zb = STALLZ[i + 1], zc = (zf + zb) / 2;
    // the partition at the stall's front edge: planks from the aisle post to the wall post, capped
    const px0 = AX + 0.1, L = wallX - px0, pxc = (px0 + wallX) / 2;
    for (let j = 0; j < 5; j++) k.board([L + 0.04, 0.292, 0.045], [pxc, 0.19 + j * 0.286, zf], [k.r(-0.003, 0.003), 0, 0], { long: 0, tint: vary(k, STALLW, 0.85, 1.1), skip: '+x-x-y' + (j < 4 ? '+y' : ''), cuts: [0], segFaces: '+z-z', inside: true });
    k.board([L, 0.05, 0.09], [pxc, 1.5, zf], null, { long: 0, tint: vary(k, STALLW, 0.9, 1.05), inside: true });
    k.solid([L, 1.55, 0.12], [pxc, 0.775, zf]);
    // the front: planks from post to post along the drive, a gap for the half door
    const z0 = zb + 0.1, z1 = zf - 0.1, dz0 = zc - 0.55, dz1 = zc + 0.55, np = 4, rail = 0.05 + np * 0.3 + 0.04;
    for (const [a, b] of [[z0, dz0], [dz1, z1]]) {
      if (b - a < 0.1) continue;
      const pl = b - a, pc = (a + b) / 2;
      for (let j = 0; j < np; j++) k.board([0.05, 0.306, pl + 0.01], [fx, 0.2 + j * 0.3, pc], null, { long: 2, tint: vary(k, STALLW, 0.85, 1.1), skip: '+z-z-y' + (j < np - 1 ? '+y' : ''), inside: true });
      k.solid([0.12, rail - 0.05, pl], [fx, rail / 2, pc]);
    }
    k.board([0.07, 0.08, z1 - z0], [fx, rail, (z0 + z1) / 2], null, { long: 2, tint: vary(k, STALLW, 0.9, 1.05), inside: true });
    // the half door (shut), hinged at one side, a latch at the other
    const gateH = rail - 0.11;
    into(k, mul(T(fx - 0.005, 0.06, zc - 0.55), RY(Math.PI / 2)), (t) => doorLeaf(t, { w: 1.1, h: gateH, side: -1, tint: STALLW, rails: [0.2, gateH - 0.2], strap: STRAP }), r.seed * 31 + i);
    k.solid([0.12, gateH, 1.1], [fx, 0.06 + gateH / 2, zc]);
    k.box('iron', [0.03, 0.03, 0.16], [fx - 0.06, gateH - 0.28, zc + 0.5], null, { tint: IRON });
    // a manger in the back corner by the wall: a plank box on a ledge, hay in it
    const mx = X1 - 0.5, mz = zf - 0.32;
    for (const [sz, pos] of [[[0.6, 0.32, 0.03], [mx, 1.06, mz - 0.25]], [[0.03, 0.32, 0.5], [mx - 0.3, 1.06, mz]]]) k.board(sz, pos, null, { long: sz[0] > 0.1 ? 0 : 2, tint: vary(k, STALLW, 0.8, 0.95), inside: true });
    k.board([0.6, 0.03, 0.5], [mx, 0.91, mz], null, { long: 0, tint: vary(k, STALLW, 0.8, 0.95), inside: true });
    k.parts.hay.push({ size: [0.56, 0.18, 0.46], m: T(mx, 1.02, mz), o: { tint: [1, 0.95, 0.85], inside: true } });
    k.solid([0.62, 1.2, 0.55], [mx, 0.6, mz]);
    list.push({ id: 'S' + (i + 1), x: (fx + X1) / 2, z: zc, zf, zb, frontX: fx, face: -Math.PI / 2 });
  }
  return list;
}

// ── odds and ends inside: the ladder to the left loft, a feed bin by the front wall ──────────────────────────────────
function inside(k) {
  // the ladder, leaning on the left loft's edge near the front
  const lz = 1.9, bx = -(AX - 0.55), tx = -(AX + 0.02), ty = LOFT + 0.75, L = Math.hypot(tx - bx, ty), ang = Math.atan2(tx - bx, ty);
  for (const dz of [-0.21, 0.21]) k.board([0.06, L, 0.045], [(bx + tx) / 2, ty / 2, lz + dz], [0, 0, -ang], { long: 1, tint: vary(k, LOFTW, 0.9, 1.05), cuts: [-1, 0, 1], inside: true });
  for (let y = 0.35; y < ty - 0.1; y += 0.35) k.board([0.035, 0.035, 0.46], [bx + (tx - bx) * y / ty, y, lz], null, { long: 2, tint: vary(k, LOFTW, 0.85, 1.0), inside: true });
  // a feed bin against the right front wall: a plank box with a lid
  const fx = X1 - 1.05, fz = Z1 - 0.6, fw = 1.3, fd = 0.72, fh = 0.85;
  for (let j = 0; j < 4; j++) k.board([fw, 0.2, 0.035], [fx, 0.1 + j * 0.205, fz - fd / 2], null, { long: 0, tint: vary(k, STALLW, 0.8, 1.0), inside: true, skip: '+y-y' });
  for (const s of [-1, 1]) k.board([0.035, fh, fd], [fx + s * fw / 2, fh / 2, fz], null, { long: 2, tint: vary(k, STALLW, 0.8, 0.95), inside: true });
  for (const q of [-1, 1]) k.board([fw + 0.06, 0.035, fd / 2 + 0.03], [fx, fh + 0.03, fz + q * fd / 4], [q * 0.02, 0, 0], { long: 0, tint: vary(k, STALLW, 0.85, 1.0), inside: true });
  k.solid([fw, fh, fd], [fx, fh / 2, fz]);
}

// ── the roof: shakes on two slopes, the ridge front to back; inside, the boards and rafters ─────────────────────────
function roofs(k) {
  const len = (X1 + EO) / Math.cos(PITCH), x0 = -Z1 - GO, x1 = Z1 + GO;
  const common = { x0, x1, topY: ROOF0, len, pitch: PITCH, shakeT: SHAKE, boardT: ROOFB, rafterT: FRAME, barge: true, interior: true, every: 0.8, rows: 2.2 };
  roofSlope(k, RY(Math.PI / 2), { ...common, cap: true });
  roofSlope(k, RY(-Math.PI / 2), { ...common, cap: true });
}

// ── the front: the hay-loft door (shut), the hoist beam over it with its pulley block and rope ──────────────────────
function front(k, r) {
  into(k, wallM(FRONT, HAYD.a0, HAYD.y0, 0.085), (t) => doorLeaf(t, { w: HAYD.a1 - HAYD.a0, h: HAYD.y1 - HAYD.y0, side: 1, tint: DOORW, xBrace: true, rails: [0.18, HAYD.y1 - HAYD.y0 - 0.2], strap: STRAP }), r.seed * 13 + 3);
  const by = 6.62, bz1 = Z1 + 1.3;
  k.board([0.18, 0.22, 1.7], [0, by, Z1 + 0.4], null, { long: 2, tint: vary(k, FRAME, 0.95, 1.05), strip: 10, ends: 'log', outside: true });
  const ba = Math.atan2(by - 0.11 - 6.0, 0.8), bl = Math.hypot(by - 0.11 - 6.0, 0.8);
  k.board([0.12, 0.12, bl], [0, (by - 0.11 + 6.0) / 2, Z1 + 0.06 + 0.4], [-ba, 0, 0], { long: 2, tint: vary(k, FRAME, 0.9, 1.0), strip: 11 });
  k.box('iron', [0.02, 0.14, 0.02], [0, by - 0.17, bz1 - 0.15], null, { tint: IRON });
  k.board([0.09, 0.24, 0.15], [0, by - 0.36, bz1 - 0.15], null, { long: 1, tint: vary(k, FRAME, 0.8, 0.9) });
  k.prism('iron', ngon(8, 0.08), 0.1, null, null, { m: mul(T(0, by - 0.38, bz1 - 0.15), RZ(Math.PI / 2)), tint: IRON, smooth: true });
  // the rope: one fall down to a hook by the loft door's head, the other across to a cleat beside it
  const rope = (a, b) => { const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(); const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.3)); m.setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); k.board([0.026, 0.026, L], null, null, { m, long: 2, tint: ROPE, strip: WOOD.shake }); };
  rope([0, by - 0.4, bz1 - 0.08], [0, 5.1, bz1 - 0.08]);
  k.box('iron', [0.02, 0.12, 0.05], [0, 5.05, bz1 - 0.08], null, { tint: IRON });
  rope([0, by - 0.4, bz1 - 0.22], [1.15, 5.2, Z1 + 0.1]);
  k.board([0.24, 0.04, 0.05], [1.15, 5.17, Z1 + 0.06], null, { long: 0, tint: FRAME });
}

// ── the floor and the straw spilled about (plain meshes with the Building Lab's own pictures) ───────────────────────
function plane(w, d, nx, nz, uvScale) {
  const g = new THREE.PlaneGeometry(w, d, nx, nz); g.rotateX(-Math.PI / 2);
  if (uvScale) { const P = g.attributes.position, U = g.attributes.uv; for (let i = 0; i < P.count; i++) U.setXY(i, P.getX(i) / uvScale, P.getZ(i) / uvScale); }
  return g;
}
function floors() {
  const fl = plane(W - 0.06, D - 0.06, 14, 10, 1.7); fl.translate(0, 0.012, 0);
  const sp = [[0, Z1 + 1.0, 3.8, 2.4], [0.1, 2.6, 2.8, 2.6], [-0.2, -1.2, 2.6, 2.6], [-3.9, 0.4, 2.6, 2.4], ...EAST_WIN.map((z) => [3.9, z, 2.4, 2.2])]
    .map(([x, z, w, d], i) => { const g = plane(w, d, 5, 5); g.translate(x, 0.02 + i * 0.002, z); return g; });
  const spill = mergeGeometries(sp); for (const g of sp) g.dispose();
  return { floor: fl, spill };
}

// each wall board's own numbers for the shader (parts.js boardWear), per corner: x its nails, y the board's height, a
// centimetre or two off, z how much more of its paint has gone (by the corners and the doorway, low down, board by board)
function boardAttr(geo, parts, seed) {
  const R = rng(seed * 97 + 5), of = geo.userData.partOf, P = geo.attributes.position, n = P.count, A = new Float32Array(n * 3);
  const per = parts.map(() => [(R() - 0.5) * 0.03, R() < 0.3 ? 0.15 + 0.2 * R() : 0.08 * R()]);
  const near = (d, r) => 1 - smooth01(d, 0, r);
  for (let i = 0; i < n; i++) {
    const Q = parts[of[i]], o = Q.o; if (!o.nail && !o.paint) continue;
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), [jit, own] = per[of[i]];
    const corner = Math.min(Math.hypot(Math.abs(x) - X1, Math.abs(z) - Z1), 9);
    const door = z > Z1 - 0.2 ? Math.abs(Math.abs(x) - DW / 2) + Math.max(0, y - DH) : 9;
    A[i * 3] = o.nail || 0; A[i * 3 + 1] = Q.m.elements[13] + jit;
    A[i * 3 + 2] = own + 0.45 * near(corner, 1.3) + 0.4 * near(door, 1.1) + 0.2 * near(y, 1.3);
  }
  geo.setAttribute('aBoard', new THREE.BufferAttribute(A, 3));
}

// ── build it all ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function buildBarn(recipeIn = {}, env = {}) {
  const t0 = performance.now(), r = barnRecipe(recipeIn), paint = BARN_PAINTS[r.paint].c;
  const k = new Kit(r.seed); k.parts.glow = []; k.parts.hay = [];
  const lamps = [];
  walls(k, paint); frame(k); const stallList = stalls(k, r); roofs(k); front(k, r); inside(k);
  // the iron pintles the big leaves hang on, on the casing
  for (const sx of [-1, 1]) for (const y of [0.3, DH - 0.35]) k.box('iron', [0.05, 0.1, 0.09], [sx * (DW / 2 + 0.03), y, Z1 + 0.07], null, { tint: IRON });
  // the lantern: on an iron bracket on the right drive post by the middle stall, lighting the drive and the stall fronts
  lamps.push(lantern(k, AX - 0.1 - 0.17, 1.95, STALLZ[1], { bracket: [0.17, 0], strength: 1.5 }));
  // THE BIG DOORS: two leaves, each its own kit; they swing out (the lane side). The planks take the paint (darker: the
  // doors have no worn boards to show the grey wood through), the rails and the X braces over them stay bare wood
  const LEAF = { w: DW / 2, h: DH - 0.05, tint: DOORW, strap: STRAP, rails: [0.3, DH / 2, DH - 0.3], xBrace: true }, OPEN = 100 * Math.PI / 180;
  const leaves = [], np = Math.max(3, Math.round(LEAF.w / 0.2));
  for (const [hg, side, ang] of [[[-DW / 2, 0.02, Z1 + 0.11], 1, -OPEN], [[DW / 2, 0.02, Z1 + 0.11], -1, OPEN]]) {
    const lk = new Kit(r.seed * 19 + side); lk.parts.glow = [];
    doorLeaf(lk, { ...LEAF, side, handle: side < 0 });
    if (paint) for (const P of lk.parts.wood.slice(0, np)) P.o.paint = vary(lk, paint, 0.62, 0.78);
    const g = buildGeometry(lk.parts.wood, 'wood', rng(r.seed * 23 + side), { topAt: () => DH + 0.3, tintAt: (x, y, z, t, o) => tintAt(x, y, z, t, { ...o, outside: true }) });
    leaves.push({ group: 'main', geo: g, glass: null, hinge: hg, open: ang, closed: 0, parts: lk.parts.wood.length, name: 'doors' });
    k.solid([DW / 2, DH, 0.1], null, null, mul(T(...hg), RY(ang), T(side * DW / 4, DH / 2, 0)));
  }

  // the parts into meshes, one per material
  const R = rng(r.seed + 1), geos = {}, topAt = (x) => Math.max(EAVE + 0.1, roofUnder(x) - 0.04);
  for (const g of ['wood', 'iron']) geos[g] = buildGeometry(k.parts[g], g, R, { topAt, tintAt });
  boardAttr(geos.wood, k.parts.wood, r.seed);
  geos.hay = buildGeometry(k.parts.hay, 'stone', R, {});   // (the mangers' hay: the hay picture, stone-style uvs)
  geos.glow = glowGeometry(k.parts.glow, (P) => P.kind !== GLOW.glass);
  geos.glass = glowGeometry(k.parts.glow, (P) => P.kind === GLOW.glass);
  geos.stone = footing(r, env);
  Object.assign(geos, floors());
  for (const g in geos) if (!geos[g]) delete geos[g];
  const msBuild = performance.now() - t0;

  // THE BAKE: the voxel grid of the solids, then each mesh's corners; the sky comes in through the big doorway (it can
  // shut) and the windows; a little warm fill everywhere inside, so the bays under the loft aren't black
  const t1 = performance.now();
  const occ = new Occlusion(k.occ, 1.6, 0.08, { reach: 2.4, rays: 20, groundReach: 0.7 });
  const op = (c, u, v, n, front = false) => ({ c, u, v, n, front });
  const openings = [
    op([0, DH / 2, Z1], [DW / 2, 0, 0], [0, DH / 2, 0], [0, 0, 1], true),
    ...EAST_WIN.map((z) => op([X1, (WIN.y0 + WIN.y1) / 2, z], [0, 0, WIN.half], [0, (WIN.y1 - WIN.y0) / 2, 0], [1, 0, 0])),
    ...WEST_WIN.map((z) => op([-X1, (WIN.y0 + WIN.y1) / 2, z], [0, 0, WIN.half], [0, (WIN.y1 - WIN.y0) / 2, 0], [-1, 0, 0])),
  ];
  const insideP = (x, y, z) => Math.abs(x) < X1 - 0.01 && Math.abs(z) < Z1 - 0.01 && y > -0.5 && y < roofUnder(x) - 0.01;
  const fill = (x, y, z, nx, ny, nz) => (insideP(x + nx * 0.08, y + ny * 0.08, z + nz * 0.08) ? 0.07 : 0);
  const light = new Light(occ, { inside: insideP, fill, openings, lamps, base: 0.24, gain: 4.0 });
  const BAKED = ['wood', 'iron', 'hay', 'stone', 'floor', 'spill'];
  for (const g of BAKED) if (geos[g]) light.bake(geos[g]);
  for (const L of leaves) { light.bake(L.geo, mul(T(...L.hinge), RY(L.open)), 'open'); light.bake(L.geo, T(...L.hinge), 'closed'); }
  light.setDoors = (open) => {
    for (const g of BAKED) if (geos[g]) light.apply(geos[g], open);
    for (const L of leaves) light.apply(L.geo, open, open ? 'open' : 'closed');
  };
  light.setDoors(true);
  light.offset = 0;
  const msBake = performance.now() - t1;
  // (for the walk grid only, after the bake: each wall a slab thicker than the grid's 10 cm cells, so no row of cells
  // slips between a wall's thin boards: objects/codebuild.js walkGrid tests each cell's middle)
  const slab = (x0, x1, z0, z1) => k.solid([x1 - x0, EAVE, z1 - z0], [(x0 + x1) / 2, EAVE / 2, (z0 + z1) / 2]);
  slab(-X1, -DW / 2, Z1 - 0.07, Z1 + 0.07); slab(DW / 2, X1, Z1 - 0.07, Z1 + 0.07);   // (the front, either side of the big doorway)
  slab(-X1, X1, -Z1 - 0.07, -Z1 + 0.07);
  for (const s of [-1, 1]) slab(s * X1 - 0.07, s * X1 + 0.07, -Z1, Z1);

  // the props it comes with: inside, all of them clutter (loaded last: priority 3): bales up on both lofts and stacked in
  // the open bay, loose hay heaped in the bay and in the lofts, a pitchfork against a post, buckets in the stalls
  const props = [{ type: 'hayHeap', x: -4.1, z: -2.4, w: 2.6, d: 2.2, h: 1.1, rot: 0.3 }, { type: 'hayHeap', x: -4.3, z: -0.3, y: LOFT, w: 2.4, d: 3.4, h: 1.0, rot: -0.1 },
    { type: 'hayHeap', x: 4.2, z: -2.6, y: LOFT, w: 2.4, d: 3.0, h: 0.9, rot: 0.15 },
    { type: 'bale', x: -4.6, z: 2.3, rot: 0.06 }, { type: 'bale', x: -4.55, z: 2.8, rot: -0.04 }, { type: 'bale', x: -4.6, z: 2.55, y: 0.4, rot: 0.1 }, { type: 'bale', x: -3.7, z: 3.8, rot: Math.PI / 2 + 0.1 },
    ...[-1, 1].flatMap((sx) => [[2.4, 2], [1.0, 1]].flatMap(([z, n]) => Array.from({ length: n }, (_, j) => ({ type: 'bale', x: sx * (AX + 0.75), z: z + (sx > 0 ? 0.3 : 0), y: LOFT + j * 0.4, rot: Math.PI / 2 + (j ? 0.06 : -0.04) * sx })))),
    { type: 'shovel', kind: 'fork', x: -(AX - 0.12), z: STALLZ[1] + 0.25, rot: Math.PI / 2, lean: 0.3 }, { type: 'bucket', x: -AX + 0.45, z: STALLZ[2] - 0.3 },
    ...[0, 1, 2].map((i) => ({ type: 'bucket', x: X1 - 0.4, z: STALLZ[i + 1] + 0.35 })),
  ].map((p) => ({ ...p, inside: true, pri: 3 }));
  const box = new THREE.Box3(); for (const g of Object.values(geos)) { g.computeBoundingBox(); box.union(g.boundingBox); }
  const f2 = (x) => +x.toFixed(2);
  // (the footprint as the town lays it out: the walls with the roof's overhangs, centred on the walls; the hoist beam
  // over the lane and the straw spilled out of the doors don't count)
  const fp = { w: f2(W + 2 * EO), d: f2(D + 2 * GO), h: f2(box.max.y), x0: f2(-X1 - EO), x1: f2(X1 + EO), z0: f2(-Z1 - GO), z1: f2(Z1 + GO) };
  const anchors = {
    footprint: fp, floor: 0,
    doorways: [{ name: 'doors', centre: [0, f2(DH / 2), Z1], w: DW, h: DH, out: [0, 0, 1], door: 'main' }],
    rooms: [{ name: 'barn', floor: [f2(-X1 + 0.1), f2(X1 - 0.1), f2(-Z1 + 0.1), f2(Z1 - 0.1)], y: 0, ceiling: f2(LOFT - 0.3) }],
    loft: { y: LOFT, x: [[f2(-X1 + 0.2), f2(-AX)], [f2(AX), f2(X1 - 0.2)]], z: [f2(-Z1 + 0.2), f2(Z1 - 0.2)] },
    stalls: stallList.map((S) => ({ id: S.id, x: f2(S.x), z: f2(S.z), face: S.face })),
    lanterns: lamps.map((L) => L.p.map(f2)),
    street: [-DW / 2 - 1, DW / 2 + 1, Z1 + 0.2, Z1 + 7],
  };
  const counts = {}; let parts = 0; for (const g in k.parts) { counts[g] = k.parts[g].length; parts += counts[g]; }
  const B = { recipe: r, geos, doors: leaves, lamps, light, occ, props, offset: 0, offsetZ: 0, anchors, counts, parts, msBuild, msBake, ms: performance.now() - t0, marks: [], kit: k };
  B.views = {
    front: [[-9.5, 4.2, 17.5], [0.3, 3.2, 0]], front34: [[-13, 4.5, 13], [0, 3.2, 0]], doors: [[0.9, 2.4, 10.5], [0.4, 2.8, 2]],
    inside: [[0.4, 1.7, Z1 - 0.7], [0.2, 1.6, -3.5]], stalls: [[0.2, 1.75, 2.6], [3.8, 1.2, -1.2]], loft: [[-1.0, 4.4, 3.6], [-4.0, 2.9, -1.5]],
    side: [[16, 3.4, -2], [0, 3, -1]], back34: [[11, 4.6, -13], [0, 3.2, 0]], roof: [[-8, 14, 10], [0, 5, 0]], far: [[-40, 9, 58], [0, 3, 0]],
  };
  return B;
}
