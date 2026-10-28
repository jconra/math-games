// THE GENERAL STORE: a two-storey timber store behind a tall stepped false front, its lap siding whitewashed and peeling
// to grey wood, "GENERAL STORE" painted big straight onto the boards with "DRY GOODS · GROCERIES · HARDWARE" under it
// and the faded red ghost letters of an older sign above and below; two six-pane windows upstairs; a porch roof of
// corrugated tin on turned posts with knee braces over a raised plank boardwalk on short posts, wide steps right of
// the middle; two big many-paned display windows full of shelves of tins and jars either side of a double door with
// glass in its upper half; a lantern on a bracket by the door. On its left, set back, a tall lean-to storeroom of boards
// and battens with a big Z-braced door that slides along a track, crates stacked inside, its own loading dock carrying
// the boardwalk on, and a freestanding hoist (a post, an arm, a brace, a pulley and a chain) at the dock's end. A tin
// stovepipe with a rain cap out of the main roof behind the false front. After the concept pictures.
//
// Laid out to be walked into: the store room (unpainted plank walls, an exposed beam ceiling, a worn plank floor); a
// long counter down its right side (a brass balance scale, glass candy jars, a coffee grinder, a brass till at the near
// end) with floor-to-ceiling shelves of tins, jars and boxes behind it over a bank of drawers, a rolling ladder, framed
// pictures and a flag up high; on the left, hats on pegs, boots, bolts of cloth and books on shelves; a tall pot-belly
// stove; a plank partition at the back with a door standing open into a narrow back room, and through that into the
// lean-to storeroom. Lanterns hang over the counter, rope and tin pails from the beams. The floor in front of the counter
// is kept open (the store's job could happen in here: anchors.counter says where the clerk and the customer stand).
//
//   buildStore(recipe, env) -> {
//     geos      { wood, iron, stone, glow, glass, pane, decal, rope, goods, jar }   one mesh each (goods: everything drawn
//               from the store's picture, art.js STORE_ART, through goods.js; jar: glass jars)
//     doors     the front door's two leaves (group 'front', swinging in) and the storeroom's sliding door (group
//               'loading', slide [dx, 0, 0]): { geo, glass, hinge, open | slide, group }
//     props     [{ type, x, y, z, rot, ... }]: barrels (of apples, of crackers), kegs, crates (of apples, of pails, the
//               stencilled ones), flour sacks, the bench, pails, shovels, the washtub, the coal bucket, a broom, as
//               separate pieces (props.js builds them; the Town Lab can move them)
//     lamps     [{ p, reach, strength, outdoor }]   anchors (doorways, the sign, the counter, the footprint)   light
//   }
// The footprint is centred on x = z = 0, the ground at y = 0, the front faces +z, the lean-to on the left (-x). Metres.
// It matches the game's general store (townAssets.js: 11 m along its longest side, 0.837 of that deep): 11.0 x 9.2 m,
// 9.05 m to the top of the false front.
//
// A RECIPE is what makes one store its own: paint (a colour or none), wear (how much of it is gone), wood (the trim
// sheet's look), stone and mortar (the footing's), seed (every random choice).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, buildGeometry, Occlusion } from '../materials/cabin.js';
import { rng, WOOD_LOOKS } from '../materials/textures.js';
import { makeBarrel } from '../materials/barrel.js';
import { buildStoneWall, SHAPES, PALETTES, MORTARS } from '../stone/stonewall.js';
import { T, RX, RY, RZ, mul, vary, smooth01, ngon, wallOf, wallM, boardAndBatten, lapSiding, plankField, roofSlope, stovepipe, casing, lantern, glowGeometry, Light, GLOW, ropeCoil, ropeGeometry, doorLeaf } from './parts.js';
import { STORE_ART, regionUV } from './art.js';
import { galvPail } from './props.js';
import { Goods } from './goods.js';

// ── the recipe ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const PAINTS = {
  none: { label: 'None (bare wood)', c: null },
  white: { label: 'Whitewash', c: [0.62, 0.6, 0.55] },
  cream: { label: 'Faded cream', c: [0.56, 0.48, 0.33] },
  ochre: { label: 'Faded ochre', c: [0.5, 0.29, 0.06] },
  red: { label: 'Faded barn red', c: [0.36, 0.085, 0.058] },
  green: { label: 'Faded green', c: [0.12, 0.2, 0.11] },
  blue: { label: 'Faded blue-grey', c: [0.17, 0.22, 0.27] },
};
export const RECIPE_DEFAULTS = { kind: 'store', paint: 'white', wear: 0.74, wood: 'straight', stone: 'fieldstone', mortar: 'grey', seed: 7 };
export function storeRecipe(r = {}) {
  const o = { ...RECIPE_DEFAULTS };
  if (PAINTS[r.paint]) o.paint = r.paint;
  if (Number.isFinite(+r.wear)) o.wear = Math.min(1, Math.max(0, +r.wear));
  if (WOOD_LOOKS[r.wood]) o.wood = r.wood;
  if (PALETTES[r.stone]) o.stone = r.stone;
  if (MORTARS[r.mortar]) o.mortar = r.mortar;
  if (Number.isFinite(+r.seed)) o.seed = Math.max(1, Math.round(+r.seed));
  return o;
}

// ── the sizes ────────────────────────────────────────────────────────────────────────────────────────────────────────
const XL = -1.6, XR = 5.2, OXC = (XL + XR) / 2;           // the store's side walls (outside faces), its middle
const ZF = 1.7, ZB = -4.3;                                 // its front and back walls
const FL = 0.6;                                            // the store's floor, the boardwalk and the dock
const FT = 0.34, Y0 = FT - 0.05;                           // the stone footing's top; the siding's foot
const CEIL = 3.9;                                          // the store room's ceiling (planks over exposed beams)
const EAVE = 6.6, WTOP = 6.76;                             // the side walls' plates; the siding's top
const PITCH = 22 * Math.PI / 180, TP = Math.tan(PITCH);
const RIDGE = EAVE + (XR - XL) / 2 * TP, ROOF0 = RIDGE + 0.17;
const EO = 0.28, GO = 0.3;                                 // the roof past the side walls; past the back wall
// the false front: three steps, the middle one tallest; wings past the side walls hide the roof's eaves (from WINGY up)
const WING = 0.3, WINGY = 6.35;
const STEPS = [[XL - WING, 0.15, 8.4], [0.15, 3.45, 9.0], [3.45, XR + WING, 8.4]];
// the porch: its roof's top against the front wall and its pitch; the boardwalk's depth and front edge; the posts; the
// steps up to it (x from, to; three treads)
const PT = 4.15, PP = 14 * Math.PI / 180, PD = 2.0, PZ = ZF + PD;
const POSTS = [XL + 0.15, 0.75, 2.65, 4.4, XR - 0.15];
const STAIR = [2.0, 4.25];
const PART = -2.9;                                         // the plank partition between the store and the back room
const INS = 0.12;                                          // the lining: how far in from the outside faces
// the lean-to: its outer wall, its front (set back), its roof (its underside at the store's wall, its pitch), the dock
const XLT = -4.4, ZLF = -0.5, LT_HI = 5.25, LPITCH = 28 * Math.PI / 180, DOCKZ = 1.9;
const ltUnder = (x) => LT_HI + 0.14 - (XL - x) * Math.tan(LPITCH);   // (its roof boards' underside over x)
const LDOOR = { a0: -4.2, a1: -2.95, y1: 3.2 };            // its doorway (x), its top; the sliding door runs on a track over it
// the counter (down the right side, its customer face toward -x) and the shelves behind it
const CX = 3.3, CD = 0.66, CZ0 = 0.8, CZ1 = -2.2, CH = 0.98;
const SHX = XR - INS - 0.46;                               // the front edge of the shelves on the right wall
export const STORE = { XL, XR, ZF, ZB, FL, EAVE, RIDGE, CEIL, PZ, XLT, ZLF, PART };

const roofUnder = (x) => ROOF0 - Math.abs(x - OXC) * TP - 0.03;
const roofTop = (x) => ROOF0 + 0.05 - Math.abs(x - OXC) * TP;
const stepTop = (x) => { for (const [a, b, y] of STEPS) if (x >= a - 1e-6 && x <= b + 1e-6) return y; return STEPS[0][2]; };
const porchUnder = (z) => PT - (z - (ZF + 0.045)) * Math.tan(PP);

// ── colours: tints on the trim sheet's strips (1 = the strip as drawn) ──────────────────────────────────────────────
const BARE = [1.12, 1.1, 1.08];           // the siding under the whitewash: weathered grey
const INNER = [1.22, 1.04, 0.84];         // the store's plank walls inside: warm unpainted pine
const TRIM = [1.0, 0.97, 0.94];
const FRAME = [1.06, 0.96, 0.86];
const SHAKE = [0.74, 0.7, 0.66];
const ROOFB = [0.66, 0.6, 0.54];
const DECK = [1.0, 0.95, 0.9];
const FLOOR = [1.08, 0.9, 0.7];           // the store's floor: warm, worn pale where people walk (tintAt)
const DOORW = [1.0, 0.9, 0.78];
const FURN = [1.0, 0.74, 0.5];            // the counter, the shelves: oiled pine gone honey-brown
const DARKW = [0.7, 0.6, 0.5];
const IRON = [0.85, 0.8, 0.76];
const TIN = [5.4, 6.8, 8.4];              // the stovepipe's tin
const FLASH = [2.9, 3.1, 3.4];            // the flashing: galvanized, gone dull
const CORR = [4.2, 4.5, 4.9];             // the porch roof's galvanized tin, gone dull
const BRASS = [1.5, 1.15, 0.6];
const STRAP = [0.035, 0.032, 0.03];
const A = STORE_ART;

// ── where water drips from (the grime streaks start there) and each corner's tint ──────────────────────────────────
const SILLS = [];
function topAt(x, z, y) {
  if (y !== undefined) for (const s of SILLS) if (Math.abs(x - s.x) < s.hw && Math.abs(z - s.z) < s.hd && y < s.y) return s.y;
  if (z > ZF - 0.08 && z < ZF + 0.4 && x > XL - 0.4 && x < XR + 0.4) return y !== undefined && y < PT ? PT - 0.06 : stepTop(x) - 0.05;
  if (z > ZF + 0.4 && z < PZ + 0.5 && x > XL - 0.3 && x < XR + 0.3) return porchUnder(z) - 0.02;
  if (x < XL + 0.02 && z < ZLF + 0.3) return ltUnder(Math.max(XLT, Math.min(XL, x))) - 0.04;   // the lean-to's walls
  if (x < XL + 0.08 && x > XL - 0.3 && y !== undefined && y > LT_HI) return EAVE + 0.1;
  if (z < ZB + 0.08 && y !== undefined && y > EAVE - 0.1) return roofUnder(x) - 0.04;
  return Math.max(EAVE + 0.1, roofUnder(x) - 0.04);
}
// the floor worn pale where people walk: in from the door, to the counter, round the stove, to the back door
const PATHS = [[[1.7, ZF], [1.8, -0.4]], [[1.8, -0.4], [2.9, -0.8]], [[1.8, -0.4], [1.2, -2.6]], [[1.7, 1.0], [0.4, 0.4]], [[4.3, 0.9], [4.3, -2.6]]];
function worn(x, z) {
  let w = 0;
  for (const [[ax, az], [bx, bz]] of PATHS) {
    const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    w = Math.max(w, 1 - smooth01(d, 0.25, 1.1));
  }
  return w;
}
function tintAt(x, y, z, t, o) {
  if (o.fresh || o.roof) return t;
  if (o.floor) { const w = worn(x, z), f = 1 + 0.32 * w; return [t[0] * f, t[1] * f * 1.02, t[2] * f * 1.06]; }
  if (o.inside) { const f = 0.88 + 0.16 * smooth01(y, 0, 3.2); return [t[0] * f, t[1] * f * 0.99, t[2] * f * 0.97]; }
  if (o.paint) { const f = smooth01(y, 0.4, 6); return [t[0] * (0.94 + 0.12 * f), t[1] * (0.94 + 0.14 * f), t[2] * (0.94 + 0.16 * f)]; }
  const f = smooth01(y, 0.3, 6), lum = t[0] * 0.3 + t[1] * 0.59 + t[2] * 0.11, g = 0.55;
  const lo = [t[0] * 0.8, t[1] * 0.77, t[2] * 0.74];
  const hi = [(t[0] + (lum * 0.92 - t[0]) * g) * 1.08, (t[1] + (lum * 1.01 - t[1]) * g) * 1.08, (t[2] + (lum * 1.12 - t[2]) * g) * 1.08];
  return [lo[0] + (hi[0] - lo[0]) * f, lo[1] + (hi[1] - lo[1]) * f, lo[2] + (hi[2] - lo[2]) * f];
}

// build a part (a door leaf) in a kit of its own, then move its parts into k through the matrix M
function into(k, M, build, seed) {
  const t = new Kit(seed); t.parts.glow = []; t.parts.rope = []; build(t);
  for (const g in t.parts) for (const P of t.parts[g]) {
    if (g === 'glow') { k.parts.glow.push({ ...P, m: mul(M, P.m) }); continue; }
    if (g === 'rope') { k.parts.rope.push({ ...P, pts: P.pts.map((p) => p.clone().applyMatrix4(M)) }); continue; }
    (k.parts[g] || (k.parts[g] = [])).push({ size: P.size, m: mul(M, P.m), o: P.o });
  }
  for (const O of t.occ) k.occ.push({ size: O.size, m: mul(M, O.m) });
}
// the decal pictures (planes over the boards, each a region of the store's picture), the inside glass, the goods
const decals = [], panes = [];
let G = null, J = null;
function pic(region, w, h, m) {
  const g = new THREE.PlaneGeometry(w, h), [u0, v0, u1, v1] = regionUV(region), U = g.attributes.uv;
  for (let i = 0; i < U.count; i++) U.setXY(i, u0 + (u1 - u0) * U.getX(i), v0 + (v1 - v0) * U.getY(i));
  g.applyMatrix4(m); decals.push(g); return g;
}
function pane(w, h, m) { const g = new THREE.PlaneGeometry(w, h); g.applyMatrix4(m); panes.push(g); }

// ── walls ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const FRONT = wallOf(0, ZF), BACK = wallOf(Math.PI, -ZB), EAST = wallOf(Math.PI / 2, XR), WEST = wallOf(-Math.PI / 2, -XL);
const LFRONT = wallOf(0, ZLF), LWEST = wallOf(-Math.PI / 2, -XLT);
const DOOR = { a0: 0.95, a1: 2.45, y0: FL - 0.1, y1: 3.5, door: true };          // the double door and its transom
const DOOR_H = 3.0;                                                               // the doors' top (the transom over them)
const WIN_DL = { a0: -1.05, a1: 0.55, y0: 1.15, y1: 3.5 }, WIN_DR = { a0: 2.85, a1: 4.45, y0: 1.15, y1: 3.5 };
const WIN_UL = { a0: -0.08, a1: 0.78, y0: 4.5, y1: 5.65 }, WIN_UR = { a0: 2.82, a1: 3.68, y0: 4.5, y1: 5.65 };
const WIN_L = { a0: 0.15, a1: 1.05, y0: 1.3, y1: 3.0 };                          // the store's left wall (a = z)
const PASS = { a0: -4.02, a1: -3.12, y0: FL - 0.05, y1: FL + 2.1, door: true };  // from the back room into the lean-to (a = z)
const WIN_E1 = { a0: -1.05, a1: -0.2, y0: 4.5, y1: 5.65 }, WIN_E2 = { a0: 2.1, a1: 2.95, y0: 4.5, y1: 5.65 };   // right side, upstairs (a = -z)
const WIN_BU = { a0: -2.25, a1: -1.35, y0: 4.5, y1: 5.65 }, WIN_BB = { a0: -3.35, a1: -2.6, y0: 1.7, y1: 2.65 };  // back (a = -x)

function walls(k, paint) {
  const sid = (o) => ({ paint, tint: BARE, inTint: INNER, bare: 0.02, cutEvery: 3.6, bh: 0.24, joints: [1.2, 3.6, 3.2, 4.6], paintVar: [0.97, 1.03], tintVar: [0.92, 1.06], ...o });
  // the front, from the boardwalk up to the false front's steps; its back drawn where it stands over the roof
  const wings = [{ a0: XL - WING - 0.01, a1: XL, y0: -1, y1: WINGY }, { a0: XR, a1: XR + WING + 0.01, y0: -1, y1: WINGY }];
  lapSiding(k, FRONT, sid({ a0: XL - WING, a1: XR + WING, y0: FL - 0.06, tops: STEPS, opens: [DOOR, WIN_DL, WIN_DR, WIN_UL, WIN_UR, ...wings], origin: XL - WING,
    keepPaint: (a, y) => y > 4.4 && y < 8.5 && a > XL - 0.1 && a < XR + 0.1, backSpan: true, backFrom: (a) => (a < XL + 0.02 || a > XR - 0.02 ? WINGY - 0.1 : roofUnder(a) - 0.16) }));
  // the sides and the back (the left side runs on behind the lean-to: inside it, the old whitewash shows)
  lapSiding(k, WEST, sid({ a0: ZB, a1: ZF, y0: Y0, tops: [[ZB, ZF, WTOP]], opens: [WIN_L, PASS], origin: ZB }));
  lapSiding(k, EAST, sid({ a0: -ZF, a1: -ZB, y0: Y0, tops: [[-ZF, -ZB, WTOP]], opens: [WIN_E1, WIN_E2], origin: -ZF }));
  lapSiding(k, BACK, sid({ a0: -XR, a1: -XL, y0: Y0, tops: [[-XR, -XL, EAVE + 0.02]], opens: [WIN_BU, WIN_BB], origin: -XR }));
  boardAndBatten(k, BACK, { a0: -XR, a1: -XL, y0: EAVE - 0.01, top: (a) => roofUnder(-a) + 0.012, apex: -OXC, paint, tint: BARE, inTint: null, rows: [7.2] });
  k.board([XR - XL + 0.04, 0.12, 0.03], null, null, { m: wallM(BACK, -OXC, EAVE + 0.02, 0.03), long: 0, tint: vary(k, TRIM, 0.85, 1.0), skip: '-z', outside: true });
  // the corner boards (each pair meets: the front or back one runs past the side wall's face)
  const cb = (w, a, y0, y1, wd = 0.15) => k.board([wd, y1 - y0, 0.03], null, null, { m: wallM(w, a, (y0 + y1) / 2, 0.035), long: 1, tint: vary(k, TRIM, 0.88, 1.05), skip: '-z-y', cuts: [-2.4, -1.2, 0, 1.2, 2.4].filter((c) => Math.abs(c) < (y1 - y0) / 2 - 0.3), segFaces: '+z', outside: true });
  cb(FRONT, XL + 0.03, FL - 0.06, WINGY + 0.06, 0.16); cb(FRONT, XR - 0.03, FL - 0.06, WINGY + 0.06, 0.16);
  cb(FRONT, XL - WING + 0.08, WINGY, STEPS[0][2], 0.16); cb(FRONT, XR + WING - 0.08, WINGY, STEPS[2][2], 0.16);
  cb(BACK, -XR + 0.03, Y0, EAVE + 0.12, 0.16); cb(BACK, -XL - 0.03, ltUnder(XL) + 0.2, EAVE + 0.12, 0.16);
  cb(WEST, ZF - 0.045, Y0, WINGY - 0.02, 0.13); cb(EAST, -ZF + 0.045, Y0, WINGY - 0.02, 0.13); cb(EAST, -ZB - 0.045, Y0, WTOP, 0.13);
  cb(WEST, ZB + 0.045, ltUnder(XL) + 0.2, WTOP, 0.13);
  // the false front's edges over the side walls: an end board, a soffit under each wing
  for (const s of [-1, 1]) {
    const xe = s < 0 ? XL - WING - 0.025 : XR + WING + 0.025, top = STEPS[s < 0 ? 0 : 2][2];
    k.board([0.05, top - WINGY, 0.22], [xe, (top + WINGY) / 2, ZF - 0.07], null, { long: 1, tint: vary(k, TRIM, 0.85, 1.0), outside: true });
    k.board([WING + 0.04, 0.025, 0.2], [s < 0 ? XL - WING / 2 + 0.02 : XR + WING / 2 - 0.02, WINGY + 0.0125, ZF - 0.08], null, { long: 0, tint: vary(k, TRIM, 0.75, 0.9), outside: true });
  }
  // the openings' trim and the windows
  casing(k, FRONT, { ...DOOR, y0: FL }, { tint: TRIM, depth: 0.19, width: 0.12 }); backing(k, FRONT, DOOR);
  displayWindow(k, WIN_DL); displayWindow(k, WIN_DR);
  windowIn(k, FRONT, WIN_UL, 3, { upstairs: true }); windowIn(k, FRONT, WIN_UR, 3, { upstairs: true });
  windowIn(k, WEST, WIN_L, 3, {});
  windowIn(k, EAST, WIN_E1, 3, { upstairs: true }); windowIn(k, EAST, WIN_E2, 3, { upstairs: true });
  windowIn(k, BACK, WIN_BU, 3, { upstairs: true }); windowIn(k, BACK, WIN_BB, 2, { back: true });
  // the transom over the doors: a frame, three panes
  const tz = ZF - 0.035, ty0 = DOOR_H + 0.05, ty1 = DOOR.y1;
  k.board([DOOR.a1 - DOOR.a0, 0.09, 0.12], [OXC, DOOR_H + 0.02, ZF - 0.04], null, { long: 0, tint: vary(k, TRIM, 0.85, 0.95) });
  for (let i = 0; i <= 3; i++) k.board([0.04, ty1 - ty0, 0.045], [DOOR.a0 + 0.02 + (DOOR.a1 - DOOR.a0 - 0.04) * i / 3, (ty0 + ty1) / 2, tz], null, { long: 1, tint: TRIM });
  k.board([DOOR.a1 - DOOR.a0, 0.04, 0.045], [OXC, ty1 - 0.02, tz], null, { long: 0, tint: TRIM });
  k.parts.glow.push({ size: [DOOR.a1 - DOOR.a0 - 0.06, ty1 - ty0, 0], m: T(OXC, (ty0 + ty1) / 2, tz - 0.01), pane: true, kind: GLOW.window, col: [1.8, 0.7, 0.18], see: true });
  pane(DOOR.a1 - DOOR.a0 - 0.06, ty1 - ty0, mul(T(OXC, (ty0 + ty1) / 2, tz - 0.02), RY(Math.PI)));
  // the door's threshold
  k.board([DOOR.a1 - DOOR.a0 + 0.04, 0.035, 0.24], [OXC, FL + 0.01, ZF - 0.06], null, { long: 0, tint: vary(k, FLOOR, 0.8, 0.9) });
}
// SHEATHING behind the siding round an opening (a lap siding row that crosses an opening's top or foot is cut away over
// the whole opening; this fills the strip between the opening and its trim)
function backing(k, w, op) {
  const wd = op.a1 - op.a0 + 0.24, ac = (op.a0 + op.a1) / 2;
  k.board([wd, 0.27, 0.015], null, null, { m: wallM(w, ac, op.y1 + 0.135, -0.012), long: 0, tint: vary(k, BARE, 0.7, 0.8), outside: true, skip: '+x-x+y-y' });
  if (!op.door) k.board([wd, 0.27, 0.015], null, null, { m: wallM(w, ac, op.y0 - 0.135, -0.012), long: 0, tint: vary(k, BARE, 0.7, 0.8), outside: true, skip: '+x-x+y-y' });
}
// a window of `rows` x 2 panes (casing, sill, sash, the pane's glow); o.upstairs: a blind pulled part way down behind
// it and the dark of the unlit room upstairs (nobody goes up there); else the inside's casing, stool and apron on the
// lining, faintly tinted glass facing in
function windowIn(k, w, op, rows, o = {}) {
  casing(k, w, op, { tint: TRIM, depth: 0.19 });
  backing(k, w, op);
  const wd = op.a1 - op.a0, h = op.y1 - op.y0, ac = (op.a0 + op.a1) / 2, yc = (op.y0 + op.y1) / 2;
  k.parts.glow.push({ size: [wd, h, 0], m: wallM(w, ac, yc, -0.05), pane: true, kind: GLOW.window, col: [1.6, 0.66, 0.2], see: true });
  // (the sash: its ends hidden in each other; upstairs, its back too: nobody sees it from inside)
  const bk = o.upstairs ? '-z' : '';
  for (const s of [-1, 1]) k.board([0.055, h, 0.045], null, null, { m: wallM(w, ac + s * (wd / 2 - 0.0275), yc, -0.035), long: 1, tint: TRIM, skip: '+y-y' + bk });
  for (const y of [op.y0 + 0.03, op.y1 - 0.03]) k.board([wd - 0.11, 0.06, 0.045], null, null, { m: wallM(w, ac, y, -0.035), long: 0, tint: TRIM, skip: '+x-x' + bk });
  k.board([0.035, h - 0.1, 0.035], null, null, { m: wallM(w, ac, yc, -0.035), long: 1, tint: TRIM, skip: '+y-y' + bk });
  for (let i = 1; i < rows; i++) k.board([wd - 0.11, 0.035, 0.035], null, null, { m: wallM(w, ac, op.y0 + 0.06 + (h - 0.12) * i / rows, -0.035), long: 0, tint: TRIM, skip: '+x-x' + bk });
  const c = new THREE.Vector3(ac, 0, w.d).applyMatrix4(RY(w.th));
  SILLS.push({ x: c.x + w.ox, z: c.z + w.oz, hw: Math.abs(Math.cos(w.th)) * (wd / 2 + 0.2) + 0.15, hd: Math.abs(Math.sin(w.th)) * (wd / 2 + 0.2) + 0.15, y: op.y0 - 0.06 });
  if (o.upstairs) {
    // the blind: cream linen, pulled a third of the way down (or more), a wooden slat at its foot; behind it the dark
    const down = 0.35 + 0.3 * k.R(), bh = (h - 0.08) * down;
    k.board([wd - 0.06, bh, 0.006], null, null, { m: wallM(w, ac, op.y1 - 0.04 - bh / 2, -0.09), long: 1, paint: vary(k, [0.2, 0.16, 0.11], 0.9, 1.05), tint: [0.9, 0.9, 0.9], skip: '-z' });
    k.board([wd - 0.04, 0.025, 0.02], null, null, { m: wallM(w, ac, op.y1 - 0.04 - bh, -0.09), long: 0, tint: DARKW });
    k.board([wd + 0.1, h + 0.1, 0.01], null, null, { m: wallM(w, ac, yc, -0.42), long: 0, paint: [0.018, 0.016, 0.015], tint: [0.3, 0.3, 0.3], skip: '-z+x-x+y-y' });
    for (const s of [-1, 1]) k.board([0.01, h + 0.1, 0.4], null, null, { m: wallM(w, ac + s * (wd / 2 + 0.05), yc, -0.22), long: 1, paint: [0.02, 0.018, 0.016], tint: [0.3, 0.3, 0.3], skip: (s > 0 ? '+x' : '-x') + '+y-y+z-z' });
    k.board([wd + 0.1, 0.01, 0.4], null, null, { m: wallM(w, ac, op.y0 - 0.04, -0.22), long: 0, paint: [0.03, 0.026, 0.022], tint: [0.3, 0.3, 0.3], skip: '-y+x-x+z-z' });
    k.board([wd + 0.1, 0.01, 0.4], null, null, { m: wallM(w, ac, op.y1 + 0.04, -0.22), long: 0, paint: [0.02, 0.018, 0.016], tint: [0.3, 0.3, 0.3], skip: '+y+x-x+z-z' });
    return;
  }
  pane(wd - 0.04, h - 0.04, mul(wallM(w, ac, yc, -0.06), RY(Math.PI)));
  const oi = -INS - 0.03, cw = 0.09;
  for (const s of [-1, 1]) k.board([cw, h + cw, 0.02], null, null, { m: wallM(w, ac + s * (wd / 2 + cw / 2), yc + cw / 2, oi), long: 1, tint: vary(k, INNER, 0.8, 0.9), skip: '+z', inside: true });
  k.board([wd + 2 * cw + 0.04, 0.1, 0.022], null, null, { m: wallM(w, ac, op.y1 + cw + 0.05, oi), long: 0, tint: vary(k, INNER, 0.8, 0.9), skip: '+z', inside: true });
  k.board([wd + 2 * cw + 0.1, 0.032, 0.13], null, null, { m: wallM(w, ac, op.y0 - 0.016, oi - 0.03), long: 0, tint: vary(k, INNER, 0.85, 0.95), inside: true });
  k.board([wd + 2 * cw, 0.08, 0.02], null, null, { m: wallM(w, ac, op.y0 - 0.08, oi), long: 0, tint: vary(k, INNER, 0.8, 0.9), skip: '+z', inside: true });
}
// A DISPLAY WINDOW: wide, tall, many-paned (four across, three high, a row of four small panes over a transom bar), in a
// heavy frame with a deep sill; behind it, inside, a stand of three shelves full of tins and jars facing the street
function displayWindow(k, op) {
  const w = FRONT, wd = op.a1 - op.a0, h = op.y1 - op.y0, ac = (op.a0 + op.a1) / 2, yc = (op.y0 + op.y1) / 2, TB = 3.08;
  casing(k, w, op, { tint: TRIM, depth: 0.19, width: 0.13 });
  backing(k, w, op);
  k.parts.glow.push({ size: [wd, h, 0], m: wallM(w, ac, yc, -0.05), pane: true, kind: GLOW.window, col: [1.8, 0.7, 0.18], see: true });
  for (const s of [-1, 1]) k.board([0.07, h, 0.05], null, null, { m: wallM(w, ac + s * (wd / 2 - 0.035), yc, -0.035), long: 1, tint: TRIM, skip: '+y-y' });
  for (const [y, t] of [[op.y0 + 0.035, 0.07], [op.y1 - 0.03, 0.06], [TB, 0.07]]) k.board([wd - 0.14, t, 0.05], null, null, { m: wallM(w, ac, y, -0.035), long: 0, tint: TRIM, skip: '+x-x' });
  for (let i = 1; i < 4; i++) { const a = op.a0 + 0.07 + (wd - 0.14) * i / 4; k.board([0.035, h - 0.1, 0.035], null, null, { m: wallM(w, a, yc, -0.035), long: 1, tint: TRIM, skip: '+y-y' }); }
  for (let i = 1; i < 3; i++) k.board([wd - 0.14, 0.03, 0.035], null, null, { m: wallM(w, ac, op.y0 + 0.07 + (TB - 0.035 - op.y0 - 0.07) * i / 3, -0.035), long: 0, tint: TRIM, skip: '+x-x' });
  SILLS.push({ x: ac, z: ZF, hw: wd / 2 + 0.3, hd: 0.3, y: op.y0 - 0.06 });
  pane(wd - 0.04, h - 0.04, mul(wallM(w, ac, yc, -0.06), RY(Math.PI)));
  // inside: the casing on the lining, a deep stool
  const oi = -INS - 0.03, cw = 0.1;
  for (const s of [-1, 1]) k.board([cw, h + cw, 0.02], null, null, { m: wallM(w, ac + s * (wd / 2 + cw / 2), yc + cw / 2, oi), long: 1, tint: vary(k, INNER, 0.8, 0.9), skip: '+z', inside: true });
  k.board([wd + 2 * cw + 0.04, 0.1, 0.022], null, null, { m: wallM(w, ac, op.y1 + cw + 0.05, oi), long: 0, tint: vary(k, INNER, 0.8, 0.9), skip: '+z', inside: true });
  // the stand: two uprights, three shelves (the lowest the window's stool, deep), goods on each facing out
  const zb = ZF - 0.48, zf = ZF - 0.08, xs = op.a0 + 0.02, xe = op.a1 - 0.02;
  for (const [i, [y, d]] of [[op.y0 - 0.03, zf - zb + 0.06], [1.72, 0.28], [2.3, 0.26]].entries()) {
    k.board([xe - xs, 0.03, d], [ac, y, zf - d / 2 + 0.03], null, { long: 0, tint: vary(k, FURN, 0.85, 1.0), inside: true });
    // (the sill: bolts of cloth stacked at one end; the top shelf: a lamp at the other)
    const a0 = i === 0 ? 0.36 : 0, a1 = i === 2 ? 0.2 : 0;
    stock(mul(T(xs + 0.02 + a0, y + 0.015, zf + 0.02)), xe - xs - 0.04 - a0 - a1, d - 0.04, k, { mix: 'window', tall: 0.5, spread: 1.05 });
  }
  const sy = op.y0 - 0.015;
  for (let j = 0; j < 4; j++) { const cl = A.cloth[(j + Math.floor(xs * 3)) & 3]; G.box([0.3, 0.075, 0.24], mul(T(xs + 0.2 + (j % 2) * 0.012, sy + 0.04 + j * 0.077, zf - 0.13), RY((j % 2 - 0.5) * 0.08)), { '+z': cl, '+y': cl, '+x': cl, '-x': cl, '-z': cl }, vary(k, LABEL_TINTS[(j * 3 + 1) % 8], 0.9, 1.05)); }
  lampOn(mul(T(xe - 0.12, 2.315, zf - 0.12)));
  for (const x of [xs + 0.015, xe - 0.015]) k.board([0.03, 2.5 - op.y0, 0.28], [x, (2.5 + op.y0) / 2, zf - 0.12], null, { long: 1, tint: vary(k, FURN, 0.8, 0.9), inside: true });
  k.board([xe - xs, op.y0 - FL, 0.02], [ac, (op.y0 + FL) / 2, zb], null, { long: 0, tint: vary(k, FURN, 0.75, 0.85), inside: true });
  k.solid([xe - xs, op.y0 - FL, 0.4], [ac, (op.y0 + FL) / 2, zf - 0.2]);
}
// the inside lining: upright planks, cut round the openings (each opening's edges split the planks there), from y0 to y1
function lining(k, w, a0, a1, y0, y1, opens, o = {}) {
  const tint = o.tint || INNER, cuts = [a0, a1];
  for (const op of opens) cuts.push(Math.max(a0, Math.min(a1, op.a0)), Math.max(a0, Math.min(a1, op.a1)));
  const bp = [...new Set(cuts.map((x) => Math.round(x * 1e4) / 1e4))].sort((p, q) => p - q);
  for (let s = 0; s < bp.length - 1; s++) {
    const A0 = bp[s], B0 = bp[s + 1]; if (B0 - A0 < 0.02) continue;
    const edges = [A0]; let x = A0;
    while (B0 - x > 0.34) { x += k.r(0.18, 0.27); edges.push(x); }
    edges.push(B0); if (edges.length > 2 && B0 - edges[edges.length - 2] < 0.09) edges.splice(edges.length - 2, 1);
    for (let i = 0; i < edges.length - 1; i++) {
      const b0 = edges[i], b1 = edges[i + 1], ac = (b0 + b1) / 2;
      let spans = [[y0, y1]];
      for (const op of opens) if (op.a0 <= b0 + 1e-4 && op.a1 >= b1 - 1e-4) spans = spans.flatMap(([p, q]) => (op.y1 <= p || op.y0 >= q ? [[p, q]] : [[p, op.y0], [op.y1, q]].filter(([u, v]) => v - u > 0.04)));
      for (const [p, q] of spans) {
        const hh = q - p, cl = []; for (let c = -hh / 2 + 2.4; c < hh / 2 - 0.3; c += 2.4) cl.push(c);
        k.board([b1 - b0 + 0.003, hh, 0.02], null, null, { m: mul(wallM(w, ac, (p + q) / 2, -INS - 0.01), RY(Math.PI)), long: 1, tint: vary(k, tint, 0.8, 1.14), strip: Math.floor(k.R() * 12), uShift: k.r(0, 1.2), skip: '-z+x-x+y-y', cuts: cl, segFaces: '+z', inside: true });
      }
    }
  }
}

// ── the false front: its stepped cornice, the trim where it steps, the frame behind it ───────────────────────────────
function falseFront(k) {
  for (const [i, [a0, a1, y]] of STEPS.entries()) {
    const left = i === 0 ? 0.1 : STEPS[i - 1][2] > y ? -0.02 : 0.1, right = i === STEPS.length - 1 ? 0.1 : STEPS[i + 1][2] > y ? -0.02 : 0.1;
    const x0 = a0 - left, x1 = a1 + right, xc = (x0 + x1) / 2, L = x1 - x0;
    // the cap, a crown moulding under its nose, a bed moulding, a frieze board, brackets in pairs, dentils between them
    k.board([L, 0.06, 0.42], [xc, y + 0.03, ZF - 0.06], null, { long: 0, tint: vary(k, TRIM, 0.8, 0.95), cuts: [-L / 4, 0, L / 4], segFaces: '+y', outside: true });
    k.board([L - 0.02, 0.09, 0.06], [xc, y - 0.045, ZF + 0.11], [0.5, 0, 0], { long: 0, tint: vary(k, TRIM, 0.78, 0.92), outside: true });
    k.board([L - 0.04, 0.07, 0.08], [xc, y - 0.11, ZF + 0.06], null, { long: 0, tint: vary(k, TRIM, 0.75, 0.9), outside: true });
    const fl = a1 - a0 - (i === 0 ? 0.16 : 0.02) - (i === STEPS.length - 1 ? 0.16 : 0.02);
    k.board([fl, 0.24, 0.028], [(a0 + (i === 0 ? 0.16 : 0) + a1 - (i === STEPS.length - 1 ? 0.16 : 0)) / 2, y - 0.27, ZF + 0.034], null, { long: 0, tint: vary(k, TRIM, 0.85, 1.0), skip: '-z', outside: true });
    for (let x = a0 + 0.2; x < a1 - 0.12; x += 0.16) k.board([0.05, 0.05, 0.05], [x, y - 0.17, ZF + 0.07], null, { long: 0, tint: vary(k, TRIM, 0.7, 0.85), skip: '-z+y' });
    const nb = Math.max(2, Math.round((a1 - a0) / 0.9));
    for (let j = 0; j <= nb; j++) {
      const bx = a0 + 0.08 + (a1 - a0 - 0.16) * j / nb;
      k.board([0.08, 0.34, 0.13], [bx, y - 0.25, ZF + 0.08], null, { long: 1, tint: vary(k, TRIM, 0.7, 0.85), outside: true, skip: '-z+y' });
      k.board([0.08, 0.08, 0.08], [bx, y - 0.45, ZF + 0.055], null, { long: 1, tint: vary(k, TRIM, 0.7, 0.85), outside: true, skip: '-z+y' });
    }
    k.solid([a1 - a0, 0.1, 0.34], [(a0 + a1) / 2, y + 0.03, ZF - 0.06]);
  }
  // where a step stands over the next: a trim board up the front of its edge, an end board over the boards' ends
  for (let i = 0; i < STEPS.length - 1; i++) {
    const a = STEPS[i][1], lo = Math.min(STEPS[i][2], STEPS[i + 1][2]), hi = Math.max(STEPS[i][2], STEPS[i + 1][2]), s = STEPS[i][2] > STEPS[i + 1][2] ? -1 : 1;
    k.board([0.13, hi - lo + 0.1, 0.03], [a + s * 0.065, (hi + lo) / 2 - 0.02, ZF + 0.035], null, { long: 1, tint: vary(k, TRIM, 0.85, 1.0), skip: '-z', outside: true });
    k.board([0.035, hi - lo + 0.02, 0.22], [a - s * 0.0175, (hi + lo) / 2 + 0.01, ZF - 0.07], null, { long: 1, tint: vary(k, TRIM, 0.85, 1.0), outside: true });
  }
  // behind it, over the roof: studs every 0.6 m, a plate under each cap, braces down to the roof
  for (const a of [XL - WING + 0.04, ...Array.from({ length: 20 }, (_, i) => XL - WING + 0.6 * (i + 1)).filter((x) => x < XR + WING - 0.1), XR + WING - 0.04]) {
    const y0 = a < XL || a > XR ? WINGY + 0.03 : roofTop(a) - 0.04, y1 = stepTop(a) - 0.05;
    if (y1 - y0 > 0.1) k.board([0.05, y1 - y0, 0.1], [a, (y0 + y1) / 2, ZF - 0.095], null, { long: 1, tint: vary(k, FRAME, 0.85, 1.05), skip: '-y+z', outside: true });
  }
  for (const [a0, a1, y] of STEPS) k.board([a1 - a0 - 0.02, 0.05, 0.1], [(a0 + a1) / 2, y - 0.075, ZF - 0.095], null, { long: 0, tint: vary(k, FRAME, 0.85, 1.0), skip: '+z+y', outside: true });
  for (const a of [0.0, 1.8, 3.6]) {
    const yA = stepTop(a) - 0.6, zA = ZF - 0.15, zB = ZF - 1.9, yB = roofTop(a) + 0.02, L = Math.hypot(yA - yB, zA - zB), ang = Math.atan2(yA - yB, zA - zB);
    k.board([0.05, 0.1, L], [a, (yA + yB) / 2, (zA + zB) / 2], [-ang, 0, 0], { long: 2, tint: vary(k, FRAME, 0.8, 1.0) });
  }
}

// ── the stone footing round the store's and the lean-to's walls (the Stone Lab's wall maker, a U open at the front,
// where the boardwalk and the dock stand) ─────────────────────────────────────────────────────────────────────────────
function footing(r, env) {
  const t = 0.3, G = -0.12;
  const loop = [[XR, ZF], [XR, ZB], [XLT, ZB], [XLT, ZLF], [XLT + t, ZLF], [XLT + t, ZB + t], [XR - t, ZB + t], [XR - t, ZF]];
  SHAPES.storeFoot = { label: 'Store footing', make: () => ({ H: FT, sections: [{ loop0: loop, loop1: loop, y0: G, y1: FT }], openings: [], top: { y: FT, t: 0, over: 0, rects: [] }, building: {} }) };
  const sw = buildStoneWall({ style: 'mortared', palette: r.stone, mortar: r.mortar, size: 0.42, irregularity: 0.5, colourMix: 0.5, bulge: 0.6, joint: 0.012, shape: 'storeFoot', seed: r.seed * 3 + 1 }, env);
  return [sw.stone, sw.mortar];
}

// ── the roofs ────────────────────────────────────────────────────────────────────────────────────────────────────────
function roofs(k) {
  const len = ((XR - XL) / 2 + EO) / Math.cos(PITCH);
  const common = { x0: 0, x1: 0, topY: ROOF0, len, pitch: PITCH, shakeT: SHAKE, boardT: ROOFB, rafterT: FRAME, barge: true, every: 0.8, rows: 2.2, cap: true, starterOut: 0.16, course: [0.3, 0.34], shakeW: 0.92 };
  roofSlope(k, mul(T(OXC, 0, 0), RY(Math.PI / 2)), { ...common, x0: -(ZF - 0.05), x1: -(ZB - GO), rake: 'x1' });
  roofSlope(k, mul(T(OXC, 0, 0), RY(-Math.PI / 2)), { ...common, x0: ZB - GO, x1: ZF - 0.05, rake: 'x0', hole: (x, z) => Math.hypot(x - STOVE.x, z - STOVE.z) < 0.16 });
  // fascia boards along the eaves, over the rafters' ends (from below, the shakes' first course showed slivers of sky)
  const yE = ROOF0 - ((XR - XL) / 2 + EO) * TP;
  for (const s of [-1, 1]) k.board([0.03, 0.2, ZF - ZB + GO - 0.06], [OXC + s * ((XR - XL) / 2 + EO - 0.015), yE - 0.1, (ZF - 0.05 + ZB - GO) / 2], null, { long: 2, tint: vary(k, FRAME, 0.85, 1.0), strip: 10, cuts: [-2, 0, 2], segFaces: s > 0 ? '+x' : '-x', outside: true });
  const yL = LT_HI + 0.17 - (XL - XLT + 0.32) * Math.tan(LPITCH);
  k.board([0.03, 0.18, ZLF - ZB + GO + 0.3], [XLT - 0.32 + 0.015, yL - 0.09, (ZLF + 0.3 + ZB - GO) / 2], null, { long: 2, tint: vary(k, FRAME, 0.85, 1.0), strip: 10, cuts: [-1.5, 0, 1.5], segFaces: '-x', outside: true });
  // the lean-to: one slope from the store's wall down to its outer wall, past its front and back
  const ll = (XL - XLT + 0.32) / Math.cos(LPITCH);
  roofSlope(k, mul(T(XL, 0, 0), RY(-Math.PI / 2)), { x0: ZB - GO, x1: ZLF + 0.3, topY: LT_HI + 0.17, len: ll, pitch: LPITCH, shakeT: SHAKE.map((c) => c * 1.04), boardT: ROOFB, rafterT: FRAME, barge: true, every: 0.7, rows: 1.6, interior: true, starterOut: 0.16, course: [0.3, 0.34], shakeW: 0.92 });
  // the flashing where it meets the store's wall: a strip of tin up the wall and over the shakes
  k.box('iron', [0.012, 0.2, ZLF - ZB + 0.3], [XL - 0.016, LT_HI + 0.3, (ZLF + 0.3 + ZB) / 2], null, { tint: FLASH, skip: '+x' });
  k.box('iron', [0.012, 0.12, ZLF - ZB + GO + 0.3], [XL - 0.012, LT_HI + 0.225, (ZLF + 0.3 + ZB - GO) / 2], null, { tint: FLASH.map((c) => c * 0.8), skip: '+x-y' });
  k.box('iron', [0.26, 0.01, ZLF - ZB + GO + 0.3], [XL - 0.12, LT_HI + 0.17 + 0.062 - 0.12 * Math.tan(LPITCH), (ZLF + 0.3 + ZB - GO) / 2], [0, 0, LPITCH], { tint: FLASH, skip: '-y' });
}

// ── the boardwalk, the dock and the porch roof ───────────────────────────────────────────────────────────────────────
// a turned post: a square foot and head, between them a lathe-turned shaft (a collar, a vase, a long taper, beads)
function turnedPost(k, x, z, y0, y1) {
  const H = y1 - y0, tint = vary(k, TRIM, 0.95, 1.08), sq = 0.15;
  k.board([sq, 0.5, sq], [x, y0 + 0.25, z], null, { long: 1, tint, skip: '-y', outside: true, strip: 10 });
  k.board([sq, 0.42, sq], [x, y1 - 0.21, z], null, { long: 1, tint, outside: true, strip: 10 });
  const segs = [[0.075, 0.05, 0], [0.068, 0.3, 0.3], [0.074, 0.05, 0], [0.052, H - 0.5 - 0.42 - 0.6, -0.12], [0.074, 0.05, 0], [0.058, 0.2, -0.2]];
  let y = y0 + 0.5;
  for (const [r, h, taper] of segs) {
    k.prism('wood', ngon(8, r), h, [x, y + h / 2, z], null, { tint, smooth: true, taper, strip: 10, skip: '+y-y', outside: true });
    y += h;
  }
  k.solid([sq, H, sq], [x, y0 + H / 2, z]);
}
// a corrugated tin roof in a slope's frame (as plankRoof: its top edge along x at height topY, z = 0, running down
// toward +z, moved into place by M): sheets 0.8 m across lapped one over the next, each a run of narrow facets tilted
// either way (a zig-zag 10 cm to a wave), on purlins across rafters; rust in some sheets more than others
function tinRoof(k, M, o) {
  const { x0, x1, topY, len, pitch } = o, sp = Math.sin(pitch), cp = Math.cos(pitch);
  const up = new THREE.Vector3(0, sp, -cp), nrm = new THREE.Vector3(0, cp, sp), eave = new THREE.Vector3(0, topY - len * sp, len * cp);
  const at = (x, s, n) => eave.clone().addScaledVector(up, s).addScaledVector(nrm, n).setX(x);
  const frame = (x, s, n, extra) => { const m = mul(M, T(...at(x, s, n).toArray()), RX(pitch)); if (extra) m.multiply(extra); return m; };
  const wave = 0.1, amp = 0.018, fa = Math.atan2(amp * 2, wave / 2), fw = Math.hypot(wave / 2, amp * 2) + 0.008;
  let sheet = 0, tint = CORR;
  for (let x = x0, i = 0; x < x1 - 0.01; x += wave / 2, i++) {
    if (x >= x0 + sheet * 0.8) { sheet++; const rust = k.R(); tint = CORR.map((c, j) => c * k.r(0.85, 1.05) * (rust < 0.35 ? [0.95, 0.72, 0.55][j] : 1)); }
    const up1 = i % 2 === 0, xc = x + wave / 4, L = len + 0.04;
    k.box('iron', [fw, 0.004, L], null, null, { m: frame(xc, len / 2 - 0.02, 0.045 + amp, RZ(up1 ? -fa : fa)), tint, skip: '-x+x-z', roof: true });
  }
  if (!o.noSolid) for (let q = 0; q < 3; q++) { const a = x0 + (x1 - x0) * q / 3, b = a + (x1 - x0) / 3; k.solid([b - a, 0.06, len], null, null, frame((a + b) / 2, len / 2, 0.04)); }
  // purlins across the rafters, the rafters
  for (let s = 0.15; s < len - 0.1; s += 0.6) k.board([x1 - x0, 0.045, 0.07], null, null, { m: frame((x0 + x1) / 2, s, 0.0, RX(0)), long: 0, tint: vary(k, FRAME, 0.85, 1.0), cuts: [-2, 0, 2], segFaces: '-y' });
  const n = Math.max(2, Math.round((x1 - x0 - 0.12) / (o.every ?? 0.9)));
  for (let i = 0; i <= n; i++) {
    const x = x0 + 0.06 + (x1 - x0 - 0.12) * i / n;
    k.board([0.06, 0.12, len - 0.04], null, null, { m: frame(x, len / 2 + 0.02, -0.08), long: 2, tint: vary(k, FRAME, 0.9, 1.1), strip: 10 + (i % 2), skip: '+y-z', cuts: [0], segFaces: '-y+x-x', ends: 'log' });
  }
  k.board([x1 - x0 + 0.04, 0.13, 0.025], null, null, { m: frame((x0 + x1) / 2, 0.012, -0.05, RX(-pitch)), long: 0, tint: vary(k, FRAME, 0.85, 1.0), strip: 10, outside: true });
}
function porch(k) {
  // the deck: planks along the front, a rim along its front edge and ends, short posts on wooden pads under the rim
  const X0 = XL, X1 = XR + 0.12;
  plankField(k, mul(T(0, FL, 0), RX(-Math.PI / 2)), { u0: X0, u1: X1, v0: -PZ, v1: -ZF, w: 0.16, t: 0.045, tint: DECK, nails: true, maxL: 3.6, step: 1.8 });
  k.board([X1 - X0 + 0.08, 0.26, 0.06], [(X0 + X1) / 2, FL - 0.14, PZ + 0.03], null, { long: 0, tint: vary(k, FRAME, 0.85, 1.0), strip: 10, cuts: [-2.5, 0, 2.5], segFaces: '+z', outside: true });
  k.board([0.06, 0.26, PD + 0.06], [X1 + 0.03, FL - 0.14, ZF + PD / 2 + 0.03], null, { long: 2, tint: vary(k, FRAME, 0.85, 1.0), strip: 10, outside: true });
  k.board([0.06, 0.26, PZ - DOCKZ], [X0 - 0.03, FL - 0.14, (PZ + DOCKZ) / 2 + 0.02], null, { long: 2, tint: vary(k, FRAME, 0.85, 1.0), strip: 10, outside: true });
  for (const x of [X0 + 0.15, -0.3, 1.0, 5.0, X1 - 0.15].filter((x) => x < STAIR[0] - 0.2 || x > STAIR[1] + 0.2)) blockPost(k, x, PZ - 0.1);
  for (const x of [X0 + 0.15, 1.8, X1 - 0.15]) blockPost(k, x, ZF + 0.9);
  k.solid([X1 - X0, FL, PD], [(X0 + X1) / 2, FL / 2, ZF + PD / 2]);
  // the dock before the lean-to, a step lower than nothing: the boardwalk carried on, its own rim and posts
  const D0 = XLT - 0.45;
  plankField(k, mul(T(0, FL, 0), RX(-Math.PI / 2)), { u0: D0, u1: XL, v0: -DOCKZ, v1: -ZLF, w: 0.17, t: 0.05, tint: vary(k, DECK, 0.85, 0.95), nails: true, maxL: 3.2, step: 1.6 });
  k.board([XL - D0 + 0.02, 0.26, 0.06], [(D0 + XL) / 2, FL - 0.14, DOCKZ + 0.03], null, { long: 0, tint: vary(k, FRAME, 0.8, 0.95), strip: 10, cuts: [-1.2, 0, 1.2], segFaces: '+z', outside: true });
  k.board([0.06, 0.26, DOCKZ - ZLF + 0.06], [D0 - 0.03, FL - 0.14, (DOCKZ + ZLF) / 2], null, { long: 2, tint: vary(k, FRAME, 0.8, 0.95), strip: 10, outside: true });
  for (const x of [D0 + 0.15, -3.0, XL - 0.2]) { blockPost(k, x, DOCKZ - 0.1); blockPost(k, x, ZLF + 0.9); }
  k.solid([XL - D0, FL, DOCKZ - ZLF], [(D0 + XL) / 2, FL / 2, (DOCKZ + ZLF) / 2]);
  // the steps: three treads on three stringers, their risers
  const sw = STAIR[1] - STAIR[0], sx = (STAIR[0] + STAIR[1]) / 2;
  for (let j = 0; j < 3; j++) {
    const ty = FL - 0.15 * (j + 1), z0 = PZ + 0.04 + j * 0.3;
    for (const dz of [0.08, 0.23]) k.board([sw, 0.05, 0.15], [sx, ty - 0.025, z0 + dz], [0, k.r(-0.008, 0.008), 0], { long: 0, tint: vary(k, DECK, 0.95, 1.1), cuts: [-sw / 4, 0, sw / 4], segFaces: '+y', hz: [dz, 2] });
    k.board([sw - 0.08, ty - 0.05, 0.025], [sx, (ty - 0.05) / 2, z0 + 0.3 - 0.02], null, { long: 0, tint: vary(k, FRAME, 0.8, 0.95), skip: '-y+y' });
  }
  for (const x of [STAIR[0] + 0.12, sx, STAIR[1] - 0.12]) { const ang = Math.atan2(FL - 0.05, 0.9); k.board([0.05, 0.18, Math.hypot(FL, 0.9) - 0.2], [x, (FL - 0.05) / 2 - 0.15, PZ + 0.42], [ang, 0, 0], { long: 2, tint: vary(k, FRAME, 0.8, 0.95) }); }
  k.solid([sw, 0.4, 0.9], [sx, 0.2, PZ + 0.45]);
  // the porch roof: corrugated tin from a ledger on the front wall out over a beam on the five posts
  const len = (PD + 0.32) / Math.cos(PP), R0 = XL - 0.08, R1 = XR + 0.1;
  tinRoof(k, T(0, 0, ZF + 0.012), { x0: R0, x1: R1, topY: PT, len: len + 0.03, pitch: PP, every: 0.9 });
  // (a closure board along the wall, from the ledger up under the tin: from below no daylight shows between them)
  k.board([R1 - R0, 0.22, 0.025], [(R0 + R1) / 2, PT - 0.03, ZF + 0.014], null, { long: 0, tint: vary(k, FRAME, 0.7, 0.8), strip: 10, cuts: [-2, 0, 2], segFaces: '+z' });
  k.box('iron', [R1 - R0, 0.008, 0.15], [(R0 + R1) / 2, PT + 0.1, ZF + 0.07], [0.35, 0, 0], { tint: FLASH, skip: '-y' });   // its flashing, over the tin's open ends at the wall
  k.board([R1 - R0, 0.16, 0.05], [(R0 + R1) / 2, PT - 0.205, ZF + 0.025], null, { long: 0, tint: vary(k, FRAME, 0.85, 1.0), strip: 10, cuts: [-2, 0, 2] });
  const zb = PZ - 0.12, beamTop = porchUnder(zb) - 0.13 / Math.cos(PP), beamBot = beamTop - 0.22;
  k.board([R1 - R0 - 0.04, 0.22, 0.16], [(R0 + R1) / 2, beamTop - 0.11, zb], null, { long: 0, tint: vary(k, TRIM, 0.85, 0.95), strip: 10, cuts: [-2.5, -1, 1, 2.5], segFaces: '+z-z-y', ends: 'log', outside: true });
  for (const [i, x] of POSTS.entries()) {
    turnedPost(k, x, zb, FL, beamBot);
    // knee braces along the beam (a curved bracket would be finer: two short straight pieces)
    for (const s of [-1, 1]) {
      if ((i === 0 && s < 0) || (i === POSTS.length - 1 && s > 0) || (i === 3 && s > 0) || (i === 4 && s < 0)) continue;
      k.board([0.6, 0.08, 0.08], [x + s * 0.24, beamBot - 0.23, zb], [0, 0, s * Math.PI / 4], { long: 0, tint: vary(k, TRIM, 0.85, 1.0), strip: 11 });
    }
  }
}
// a short post under the boardwalk's rim, on a sawn pad on the ground
function blockPost(k, x, z) {
  k.board([0.12, FL - 0.32, 0.12], [x, 0.1 + (FL - 0.32) / 2, z], [0, k.r(-0.1, 0.1), 0], { long: 1, tint: vary(k, FRAME, 0.7, 0.85), skip: '-y+y' });
  k.board([0.28, 0.12, 0.26], [x, 0.04, z], [0, k.r(-0.3, 0.3), 0], { long: 0, tint: vary(k, DARKW, 0.7, 0.85), strip: 10, ends: 'log', skip: '-y' });
}

// ── the lean-to: boards and battens, its big sliding door on its track, inside its own bare frame ────────────────────
function leanTo(k, paint) {
  const sid = { paint, tint: BARE, inTint: [1.0, 0.92, 0.8], bare: 0.06 };
  boardAndBatten(k, LFRONT, { ...sid, a0: XLT - 0.03, a1: XL, y0: Y0, top: (a) => ltUnder(a) + 0.01, opens: [{ a0: LDOOR.a0, a1: LDOOR.a1, y0: FL - 0.1, y1: LDOOR.y1 }], rows: [2.4] });
  boardAndBatten(k, LWEST, { ...sid, a0: ZB, a1: ZLF + 0.03, y0: Y0, top: () => ltUnder(XLT) + 0.01, rows: [2.0], opens: [{ a0: -2.6, a1: -1.9, y0: 1.7, y1: 2.5 }] });
  boardAndBatten(k, wallOf(Math.PI, -ZB), { ...sid, a0: -XL, a1: -XLT + 0.03, y0: Y0, top: (a) => ltUnder(-a) + 0.01, rows: [2.4] });
  // its little window (left side), its corner boards
  const wl = { a0: -2.6, a1: -1.9, y0: 1.7, y1: 2.5 };
  casing(k, LWEST, wl, { tint: TRIM, depth: 0.12 });
  k.parts.glow.push({ size: [0.7, 0.8, 0], m: wallM(LWEST, -2.25, 2.1, -0.03), pane: true, kind: GLOW.window, col: [1.6, 0.66, 0.2], see: true });
  k.board([0.035, 0.76, 0.03], null, null, { m: wallM(LWEST, -2.25, 2.1, -0.02), long: 1, tint: TRIM }); k.board([0.66, 0.035, 0.03], null, null, { m: wallM(LWEST, -2.25, 2.1, -0.02), long: 0, tint: TRIM });
  for (const [w, a, y1] of [[LFRONT, XLT + 0.04, ltUnder(XLT)], [LWEST, ZLF - 0.04, ltUnder(XLT)], [LWEST, ZB + 0.04, ltUnder(XLT)]]) k.board([0.13, y1 - Y0, 0.03], null, null, { m: wallM(w, a, (y1 + Y0) / 2, 0.04), long: 1, tint: vary(k, TRIM, 0.85, 1.0), skip: '-z', outside: true });
  // the doorway's frame: posts each side, a header; the track over it (an iron bar on a timber), stops at its ends
  for (const x of [LDOOR.a0 - 0.06, LDOOR.a1 + 0.06]) k.board([0.12, LDOOR.y1 - FL + 0.1, 0.14], [x, (LDOOR.y1 + FL) / 2, ZLF - 0.04], null, { long: 1, tint: vary(k, FRAME, 0.85, 1.0), outside: true });
  k.board([LDOOR.a1 - LDOOR.a0 + 0.24, 0.14, 0.14], [(LDOOR.a0 + LDOOR.a1) / 2, LDOOR.y1 + 0.07, ZLF - 0.04], null, { long: 0, tint: vary(k, FRAME, 0.85, 1.0), outside: true });
  const tr0 = LDOOR.a0 - 0.15, tr1 = XL - 0.05, ty = LDOOR.y1 + 0.24;
  k.board([tr1 - tr0, 0.12, 0.07], [(tr0 + tr1) / 2, ty, ZLF + 0.06], null, { long: 0, tint: vary(k, FRAME, 0.85, 1.0), outside: true, cuts: [-0.8, 0.8], segFaces: '+z' });
  k.box('iron', [tr1 - tr0, 0.025, 0.035], [(tr0 + tr1) / 2, ty + 0.07, ZLF + 0.11], null, { tint: IRON });
  for (const x of [tr0 + 0.04, tr1 - 0.04]) k.box('iron', [0.04, 0.06, 0.05], [x, ty + 0.11, ZLF + 0.08], null, { tint: IRON });
  k.board([LDOOR.a1 - LDOOR.a0 + 0.1, 0.04, 0.3], [(LDOOR.a0 + LDOOR.a1) / 2, FL + 0.02, ZLF - 0.05], null, { long: 0, tint: vary(k, DECK, 0.8, 0.9) });   // the sill
  // inside: a plank floor, a few posts and a beam carrying the rafters, a shelf of kegs along the back
  plankField(k, mul(T(0, FL, 0), RY(-Math.PI / 2), RX(-Math.PI / 2)), { u0: ZB + 0.05, u1: ZLF - 0.05, v0: XLT + 0.05, v1: XL - 0.05, w: 0.2, t: 0.035, tint: vary(k, FLOOR, 0.75, 0.85), maxL: 3.4, step: 1.4, extra: { inside: true } });
  k.solid([XL - XLT, 0.1, ZLF - ZB], [(XL + XLT) / 2, FL - 0.05, (ZLF + ZB) / 2]);
  for (const z of [ZB + 0.1, -2.4]) k.board([0.12, ltUnder(-3.0) - 0.2 - FL, 0.12], [-3.0, (ltUnder(-3.0) - 0.2 + FL) / 2, z], null, { long: 1, tint: vary(k, FRAME, 0.85, 1.0), inside: true, cuts: [0] });
  k.board([0.12, 0.18, ZLF - ZB], [-3.0, ltUnder(-3.0) - 0.15, (ZLF + ZB) / 2], null, { long: 2, tint: vary(k, FRAME, 0.85, 1.0), inside: true, cuts: [-1, 1] });
  k.board([2.3, 0.04, 0.4], [-3.15, FL + 1.25, ZB + 0.3], null, { long: 0, tint: vary(k, FURN, 0.7, 0.8), inside: true });
  for (const x of [-4.1, -2.2]) k.board([0.05, 1.25, 0.4], [x, FL + 0.625, ZB + 0.3], null, { long: 1, tint: vary(k, FURN, 0.7, 0.8), inside: true });
  for (let i = 0; i < 3; i++) keg(T(-3.8 + i * 0.6, FL + 1.27, ZB + 0.32), 0.17, 0.42, k);
}
// the lean-to's sliding door: Z-braced planks, two iron hangers with wheels on the track, a handle (built round its
// left edge at x = 0, running +x, its middle at z = 0)
function slidingDoor(k, { w, h }) {
  doorLeaf(k, { w, h, side: 1, tint: DOORW, rails: [0.3, h / 2, h - 0.3], strap: false, handle: true, braceFit: true });
  for (const x of [0.22, w - 0.22]) {
    k.box('iron', [0.05, 0.36, 0.012], [x, h + 0.06, 0.035], null, { tint: IRON });
    k.prism('iron', ngon(8, 0.06), 0.03, null, null, { m: mul(T(x, h + 0.22, 0.045), RX(Math.PI / 2)), tint: IRON, smooth: true });
  }
}

// ── the hoist at the dock's end: a post, an arm out over the yard, a brace, a pulley block and a chain to a hook ─────
function hoist(k) {
  const x = XLT - 0.2, z = ZLF + 0.75, top = 5.2, arm0 = x + 0.35, arm1 = x - 0.9;
  k.board([0.2, top, 0.2], [x, top / 2, z], null, { long: 1, tint: vary(k, FRAME, 0.9, 1.05), strip: 10, cuts: [-1.8, -0.6, 0.6, 1.8], segFaces: '+x-x+z-z', ends: 'log', outside: true });
  k.solid([0.2, top, 0.2], [x, top / 2, z]);
  k.board([arm0 - arm1, 0.2, 0.16], [(arm0 + arm1) / 2, top - 0.22, z], null, { long: 0, tint: vary(k, FRAME, 0.9, 1.05), strip: 10, ends: 'log', outside: true });
  const bL = Math.hypot(0.8, 0.95), ba = Math.atan2(0.95, 0.8);
  k.board([bL, 0.12, 0.1], [x - 0.4, top - 0.32 - 0.475, z], [0, 0, -ba], { long: 0, tint: vary(k, FRAME, 0.85, 1.0), strip: 11 });
  k.box('iron', [0.24, 0.02, 0.18], [x, top - 0.11, z], null, { tint: IRON });
  // the block: two cheeks, the sheave between, a hook under it; the chain down to a hook, and its slack up to a cleat
  const px = arm1 + 0.15, py = top - 0.55;
  k.box('iron', [0.03, 0.1, 0.03], [px, py + 0.17, z], null, { tint: IRON });
  for (const s of [-1, 1]) k.board([0.05, 0.28, 0.2], [px, py, z + s * 0.045], null, { long: 1, tint: vary(k, DARKW, 0.8, 0.9) });
  k.prism('iron', ngon(10, 0.1), 0.05, null, null, { m: mul(T(px, py, z), RX(Math.PI / 2)), tint: IRON, smooth: true });
  const links = (x0, y0, x1, y1, zz) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.round(L / 0.075), ang = Math.atan2(x1 - x0, y1 - y0); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; k.box('iron', [0.026, 0.075, 0.008], null, null, { m: mul(T(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, zz), RZ(-ang), RY(i % 2 ? Math.PI / 2 : 0.3)), tint: [0.55, 0.5, 0.46], skip: '+y-y+x-x' }); } };
  // (the rope: one fall straight down to the hook, the other sagging across to the cleat on the post; each one tube)
  void links;
  k.parts.rope.push({ pts: [new THREE.Vector3(px - 0.1, py, z), new THREE.Vector3(px - 0.1, (py + 2.1) / 2, z), new THREE.Vector3(px - 0.1, 2.08, z)], closed: false, rad: 0.013, sides: 5, tint: [0.9, 0.82, 0.68] });
  k.parts.rope.push({ pts: [new THREE.Vector3(px + 0.1, py, z), new THREE.Vector3(px + 0.12, py - 1.1, z + 0.01), new THREE.Vector3((px + x) / 2 + 0.05, 1.75, z + 0.02), new THREE.Vector3(x - 0.12, 1.62, z + 0.03)], closed: false, rad: 0.013, sides: 5, tint: [0.9, 0.82, 0.68] });
  k.box('iron', [0.02, 0.12, 0.02], [px - 0.1, 2.02, z], null, { tint: IRON });
  k.box('iron', [0.08, 0.02, 0.02], [px - 0.07, 1.96, z], null, { tint: IRON });
  k.board([0.05, 0.2, 0.05], [x - 0.12, 1.58, z + 0.02], null, { long: 1, tint: FRAME });   // the cleat on the post
}

// ── the front: the lantern on its bracket by the door ────────────────────────────────────────────────────────────────
function frontThings(k, lamps) {
  lamps.push(lantern(k, 2.65, 2.62, ZF + 0.36, { bracket: [0, -0.33], strength: 2.6, outdoor: true }));
  // (at night the lit display windows throw their warmth out over the boardwalk: lights at the glass, no lanterns, out by day)
  for (const op of [WIN_DL, WIN_DR]) lamps.push({ p: [(op.a0 + op.a1) / 2, 2.0, ZF + 0.25], reach: 6.5, strength: 1.4, outdoor: true, noGlow: true });
  // a price card in the left window, the OPEN card on a string in the door's glass is on the leaf
}

// ── the goods: what fills a shelf ────────────────────────────────────────────────────────────────────────────────────
// a shelf in the frame M (its front edge from x = 0 to len along local x, its back at z = -depth, the shelf's top at
// y = 0), stocked with products: a row of the same tin, a few jars, some packets; o.mix: what kind of shelf, o.tall:
// how much headroom (m)
// (each line of stock its own muted colour of label or packet: cream, brick, faded indigo, mustard, sage, faded green,
// tan, black-on-tan; a tint on the picture, per corner, so no extra draws)
const LABEL_TINTS = [[1, 1, 1], [0.92, 0.5, 0.4], [0.46, 0.54, 0.88], [1.04, 0.8, 0.36], [0.68, 0.82, 0.58], [0.5, 0.68, 0.5], [0.86, 0.68, 0.5], [0.42, 0.39, 0.36]];
const MIXES = {
  window: [['tin', 5], ['jar', 2], ['box', 2], ['tall', 1], ['crock', 1], ['enamel', 1]], grocery: [['tin', 6], ['jar', 2], ['box', 3], ['tall', 1], ['crock', 1], ['enamel', 1]],
  jars: [['jar', 3], ['tin', 2], ['crock', 2]], boxes: [['box', 5], ['tin', 2]], tins: [['tin', 1]], crocks: [['crock', 3], ['box', 1]],
};
function stock(M, len, depth, k, o = {}) {
  const g0 = G.tris + J.tris; try { stockInner(M, len, depth, k, o); } finally { STOCK.tris += G.tris + J.tris - g0; }
}
export const STOCK = { tris: 0 };
// (the stock has its own random numbers, so a change elsewhere in the building doesn't restock every shelf)
let SR = Math.random;
function stockInner(M, len, depth, k, o = {}) {
  const R = SR, mix = MIXES[o.mix || 'grocery'], tot = mix.reduce((s, m) => s + m[1], 0), tall = o.tall ?? 0.36;
  const pick = () => { let r = R() * tot; for (const [t, w] of mix) { if ((r -= w) < 0) return t; } return mix[0][0]; };
  // (a shelf over a grown-up's eyes: nobody sees the tops of what is on it, so they are left out)
  const high = M.elements[13] > 1.85;
  let x = 0.02 + R() * 0.06;
  const spread = o.spread ?? 1;
  while (x < len - 0.08) {
    // (now and then a gap where a line has sold out; o.spread: wider gaps, fewer of each)
    if (R() < 0.08 * spread) { x += 0.12 + R() * 0.2; continue; }
    const kind = pick(), n = 2 + Math.floor(R() * (spread > 2 ? 2 : 3)), gap = (0.05 + R() * 0.12) * spread, line = LABEL_TINTS[Math.floor(R() * LABEL_TINTS.length)];
    if (kind === 'tin' || kind === 'tall') {
      const lab = A.tins[Math.floor(R() * A.tins.length)], r = kind === 'tall' ? 0.038 : 0.04 + R() * 0.014, h = kind === 'tall' ? 0.15 + R() * 0.04 : 0.09 + R() * 0.04;
      const rows = o.rows2 && depth > 0.24 && R() < 0.5 ? 2 : 1, stack = h * 2 + 0.02 < tall && R() < 0.25;
      for (let i = 0; i < n && x + 2 * r < len; i++) {
        for (let rw = 0; rw < rows; rw++) for (let s = 0; s < (stack && rw === rows - 1 ? 2 : 1); s++) {
          const tint = vary(k, line, 0.9, 1.05), zz = -r - 0.015 - rw * (2 * r + 0.01) + (rw ? 0 : R() * 0.02), TM = mul(M, T(x + r, h / 2 + s * (h + 0.002), zz), RY(Math.PI + (R() - 0.5) * 0.5));
          G.cyl(r, h, TM, 6, lab, null, tint);
          if (!high) G.disc(r, mul(TM, T(0, h / 2, 0)), 6, A.tile.tin, [0.95, 0.95, 0.95]);
        }
        x += 2 * r + 0.004;
      }
    } else if (kind === 'enamel') {
      // (blue enamelware: a speckled coffee pot or two, a spout and a handle)
      for (let i = 0; i < Math.min(n, 2) && x + 0.16 < len; i++) {
        const C = mul(M, T(x + 0.08, 0, -Math.min(depth / 2, 0.09))), et = vary(k, [0.42, 0.55, 0.85], 0.85, 1.05);
        G.lathe([[0.065, 0], [0.07, 0.012], [0.06, 0.13], [0.04, 0.16], [0.045, 0.172], [0, 0.18]], C, 8, A.tile.enamel, et);
        G.box([0.018, 0.018, 0.08], mul(C, T(0, 0.1, 0.07), RX(-0.6)), { '+x': A.tile.enamel, '-x': A.tile.enamel, '+y': A.tile.enamel }, et);
        G.box([0.012, 0.09, 0.02], mul(C, T(0, 0.08, -0.075)), { '+x': A.tile.enamel, '-x': A.tile.enamel, '-z': A.tile.enamel }, et);
        x += 0.17;
      }
      x += gap; continue;
    } else if (kind === 'crock') {
      // (stoneware crocks: a salt-glazed grey body, a cobalt band, a lid; butter, pickles, molasses)
      const r = 0.07 + R() * 0.03, h = Math.min(tall - 0.04, 0.16 + R() * 0.08);
      for (let i = 0; i < Math.min(n, 2) && x + 2 * r < len; i++) {
        const C = mul(M, T(x + r, 0, -Math.min(depth / 2, r + 0.02)), RY(R() * 6));
        G.lathe([[r * 0.85, 0], [r * 1.02, h * 0.5], [r * 0.84, h * 0.9], [r * 0.8, h]], C, 7, A.tile.glass, vary(k, [1, 1, 1], 0.85, 1.05), { vSpan: 1 });
        if (!high) G.disc(r * 0.8, mul(C, T(0, h, 0)), 7, A.tile.glass, [0.8, 0.78, 0.74]);
        x += 2 * r + 0.012;
      }
      x += gap; continue;
    } else if (kind === 'jar') {
      const heapR = [A.heaps.beans, A.heaps.drops, A.heaps.mints, A.heaps.pickles, A.heaps.nails, A.heaps.crackers][Math.floor(R() * 6)], r = 0.05 + R() * 0.02, h = Math.min(tall - 0.05, 0.14 + R() * 0.1), fill = 0.55 + R() * 0.35;
      for (let i = 0; i < Math.min(n, 3) && x + 2 * r < len; i++) jar(mul(M, T(x + r, 0, -Math.min(depth / 2, r + 0.03))), r, h, heapR, fill, k, high);
      x += Math.min(n, 3) * (2 * r + 0.012);
      continue;
    } else {
      const lab = A.boxes[Math.floor(R() * A.boxes.length)], w = 0.1 + R() * 0.06, h = Math.min(tall - 0.04, 0.13 + R() * 0.1), d = Math.min(depth - 0.03, 0.08 + R() * 0.07);
      for (let i = 0; i < Math.min(n, 3) && x + w < len; i++) {
        G.box([w, h, d], mul(M, T(x + w / 2, h / 2, -d / 2 - 0.015), RY((R() - 0.5) * 0.1)), { '+z': lab, '+y': high ? null : A.tile.kraft, [i === 0 ? '-x' : '+x']: A.tile.kraft }, vary(k, line, 0.9, 1.05));
        x += w + 0.006;
      }
    }
    x += gap;
  }
}
// a glass jar: its contents (a heap's picture round its sides and over its top), the glass, a tin lid
function jar(M, r, h, heap, fill, k, high = false) {
  const ch = h * fill;
  G.cyl(r * 0.9, ch, mul(M, T(0, ch / 2 + 0.006, 0)), 7, heap, high ? null : heap, [1, 1, 1]);
  J.cyl(r, h, mul(M, T(0, h / 2, 0)), 6, A.tile.glass, null, [1, 1, 1]);
  if (!high) G.disc(r * 0.92, mul(M, T(0, h + 0.004, 0)), 6, A.tile.tin, [0.9, 0.9, 0.9]);
}
// a kerosene lamp: a brass foot and stem, a glass font, the brass burner, a tall glass chimney (unlit by day)
function lampOn(M) {
  G.lathe([[0.06, 0], [0.062, 0.012], [0.025, 0.03], [0.02, 0.08], [0.03, 0.09]], M, 8, A.tile.brass, [0.8, 0.72, 0.55]);
  J.lathe([[0.03, 0.09], [0.06, 0.12], [0.055, 0.16], [0.02, 0.18]], M, 8, A.tile.glass, [1, 1, 1]);
  G.lathe([[0.02, 0.18], [0.028, 0.2], [0.022, 0.215]], M, 8, A.tile.brass, [0.8, 0.72, 0.55]);
  J.lathe([[0.024, 0.215], [0.034, 0.25], [0.022, 0.3], [0.02, 0.36]], M, 8, A.tile.glass, [1, 1, 1]);
}
// a small keg: one round of the keg picture (staves and hoops), bulging a little, its head on top
function keg(M, r, h, k) {
  G.cyl(r, h, mul(M, T(0, h / 2, 0), RY(k.R() * 6)), 8, A.keg, A.tile.crate, vary(k, [1, 1, 1], 0.85, 1.05), { rows: 2, bulge: 0.08 });
  k.solid([2 * r, h, 2 * r], null, null, mul(M, T(0, h / 2, 0)));
}

// ── inside: the room, the counter, the shelves, the stove ────────────────────────────────────────────────────────────
const STOVE = { x: -0.85, z: -0.1 };
function storeInside(k, lamps, props) {
  const ix0 = XL + INS, ix1 = XR - INS, iz0 = ZB + INS, iz1 = ZF - INS;
  // the floor: planks front to back, worn pale along the paths; the ceiling: planks on beams across
  plankField(k, mul(T(0, FL, 0), RY(-Math.PI / 2), RX(-Math.PI / 2)), { u0: iz0 - 0.02, u1: iz1 + 0.02, v0: ix0 - 0.02, v1: ix1 + 0.02, w: 0.17, t: 0.03, tint: FLOOR, nails: true, maxL: 4.4, step: 1.2, extra: { inside: true, floor: true } });
  plankField(k, mul(T(0, CEIL, 0), RY(-Math.PI / 2), RX(Math.PI / 2)), { u0: iz0, u1: iz1, v0: -ix1, v1: -ix0, w: 0.24, tint: vary(k, INNER, 0.85, 0.95), maxL: 4.4, step: 1.6, extra: { inside: true } });
  k.solid([ix1 - ix0, 0.1, iz1 - iz0], [(ix0 + ix1) / 2, CEIL + 0.05, (iz0 + iz1) / 2]);
  k.solid([ix1 - ix0, 0.1, iz1 - iz0], [(ix0 + ix1) / 2, FL - 0.05, (iz0 + iz1) / 2]);
  const BEAMS = [1.05, -0.05, -1.15, -2.25];
  for (const z of BEAMS) k.board([ix1 - ix0, 0.22, 0.15], [(ix0 + ix1) / 2, CEIL - 0.11, z], null, { long: 0, tint: vary(k, FRAME, 0.9, 1.05), cuts: [-2.4, -0.8, 0.8, 2.4], segFaces: '-y+z-z', ends: 'log', inside: true });
  for (let x = ix0 + 0.4; x < ix1 - 0.2; x += 0.6) k.board([0.06, 0.12, iz1 - iz0], [x, CEIL - 0.06, (iz0 + iz1) / 2], null, { long: 2, tint: vary(k, FRAME, 0.85, 1.0), cuts: [-2, 0, 2], segFaces: '-y', skip: '+y', inside: true });
  // the lining: upright planks, cut round every opening (behind the shelves on the right, too: seen between them)
  lining(k, FRONT, ix0, ix1, FL, CEIL, [{ ...DOOR, y0: FL }, WIN_DL, WIN_DR], {});
  lining(k, WEST, iz0, iz1, FL, CEIL, [WIN_L, PASS], {});
  lining(k, EAST, -iz1, -iz0, FL, CEIL, [], {});
  lining(k, BACK, -ix1, -ix0, FL, CEIL, [WIN_BB], {});
  // the passage into the lean-to: its reveal through the wall, a casing
  casing(k, wallOf(Math.PI / 2, XL + INS + 0.02), { a0: -PASS.a1, a1: -PASS.a0, y0: FL, y1: PASS.y1, door: true }, { tint: TRIM, depth: 0.25, width: 0.1 });
  partition(k, props);
  counter(k, lamps);
  shelvesRight(k);
  leftWall(k, props);
  // THE STOVE: a tall pot-belly on four legs, its pipe up through the ceiling (and out of the roof), a kettle on it
  potBelly(k, STOVE.x, FL, STOVE.z, Math.PI * 0.3);
  stovepipe(k, STOVE.x, STOVE.z, FL + STOVE_TOP - 0.02, 9.9, { r: 0.075, collarY: roofTop(STOVE.x) - 0.02, tint: TIN, pipe: { cuts: [] } });
  k.prism('iron', ngon(8, 0.13), 0.02, [STOVE.x, CEIL - 0.01, STOVE.z], null, { tint: [0.6, 0.55, 0.5], smooth: true });
  k.box('iron', [0.8, 0.012, 0.8], [STOVE.x, FL + 0.006, STOVE.z], null, { tint: [0.7, 0.66, 0.6], skip: '-y' });
  kettle(k, STOVE.x + 0.13, FL + 1.075, STOVE.z + 0.13);
  // the cracker barrel by the stove with a checkerboard on it, two spindle chairs drawn up
  const cbx = 0.3, cbz = 0.75;
  // (the cracker barrel, its lid on, a checkerboard laid over it and a game going)
  props.push({ type: 'barrel', x: cbx, y: FL, z: cbz, inside: true });
  pic(A.checker, 0.36, 0.36, mul(T(cbx + 0.02, FL + 0.876, cbz), RX(-Math.PI / 2), RZ(0.3)));
  k.board([0.4, 0.012, 0.4], [cbx + 0.02, FL + 0.869, cbz], [0, 0.3, 0], { long: 0, tint: vary(k, DARKW, 0.8, 0.9), inside: true });
  for (const [dx, dz] of [[0.04, 0.06], [-0.08, -0.05], [0.1, -0.08], [-0.02, 0.1], [0.12, 0.04]]) k.prism('wood', ngon(8, 0.016), 0.008, [cbx + 0.02 + dx, FL + 0.88, cbz + dz], null, { paint: dx > 0 ? [0.4, 0.05, 0.04] : [0.03, 0.03, 0.03], tint: [0.5, 0.5, 0.5], smooth: true, skip: '-y' });
  chair(k, cbx - 0.62, cbz + 0.08, Math.PI / 2 + 0.25); chair(k, cbx + 0.05, cbz - 0.62, 0.2);
  props.push({ type: 'coalBucket', x: STOVE.x + 0.42, y: FL, z: STOVE.z - 0.45, inside: true });
  // hanging from the beams: coils of rope, tin pails, a lantern over the stove; three over the counter
  for (const [x, z] of [[0.3, -2.25]]) { const n0 = k.parts.rope.length; ropeCoil(k.parts.rope, [x, CEIL - 0.25, z], [0, 0, 1], { r: 0.17, loops: 2, rad: 0.016, tint: [1.05, 0.95, 0.8] }); for (const Rp of k.parts.rope.slice(n0)) Rp.sides = 4; k.board([0.04, 0.04, 0.12], [x, CEIL - 0.24, z - 0.04], null, { long: 2, tint: FRAME, inside: true }); }
  for (const [x, z] of [[1.15, -1.15], [-0.3, -2.25]]) { hungPail(k, x, CEIL - 0.6, z); }
  for (const z of [-0.05, -1.15, -2.25]) lamps.push(lantern(k, CX + 0.3, 2.78, z, { chain: CEIL - 0.22 - 2.78 - 0.23, strength: 1.5 }));
  lamps.push(lantern(k, 0.25, 2.85, -1.15, { chain: CEIL - 0.22 - 2.85 - 0.23, strength: 1.3 }));
  // the price board on the partition, posters on the left wall
  pic(A.board, 1.05, 0.62, T(2.9, 2.65, PART + 0.04));
  pic(A.posters[1], 0.38, 0.53, mul(T(XL + INS + 0.025, 2.75, -0.9), RY(Math.PI / 2)));
}
// the partition across the back: planks up to the ceiling, a door in it standing open into the back room, shelves of
// tins and kegs either side on the store's side; in the back room, shelves along its back wall
function partition(k, props) {
  const ix0 = XL + INS, ix1 = XR - INS, pd = { x0: 0.45, x1: 1.3, y1: FL + 2.15 };
  for (const [a, b, y0] of [[ix0, pd.x0, FL], [pd.x0, pd.x1, pd.y1], [pd.x1, ix1, FL]]) for (let x = a; x < b - 0.02;) {
    let bw = Math.min(k.r(0.18, 0.26), b - x); if (b - x - bw < 0.07) bw = b - x;
    k.board([bw + 0.003, CEIL - y0, 0.025], [x + bw / 2, (CEIL + y0) / 2, PART], null, { long: 1, tint: vary(k, INNER, 0.82, 1.1), skip: '+x-x+y' + (y0 > FL ? '' : '-y'), cuts: y0 > FL ? [] : [0.0], segFaces: '+z-z', inside: true });
    x += bw;
  }
  for (const s of [1, -1]) {
    const z = PART + s * 0.025;
    for (const x of [pd.x0 - 0.05, pd.x1 + 0.05]) k.board([0.1, pd.y1 - FL + 0.05, 0.02], [x, (pd.y1 + FL + 0.05) / 2, z], null, { long: 1, tint: vary(k, TRIM, 0.85, 1.0), inside: true, skip: '-y' });
    k.board([pd.x1 - pd.x0 + 0.2, 0.1, 0.02], [(pd.x0 + pd.x1) / 2, pd.y1 + 0.05, z], null, { long: 0, tint: vary(k, TRIM, 0.85, 1.0), inside: true });
  }
  for (const [x0, x1] of [[ix0, pd.x0], [pd.x1, ix1]]) k.solid([x1 - x0, CEIL - FL, 0.06], [(x0 + x1) / 2, (CEIL + FL) / 2, PART]);
  k.solid([pd.x1 - pd.x0, CEIL - pd.y1, 0.06], [(pd.x0 + pd.x1) / 2, (CEIL + pd.y1) / 2, PART]);
  // the door, planks on battens, standing open into the back room
  into(k, mul(T(pd.x0 + 0.02, FL + 0.01, PART - 0.03), RY(1.75)), (t) => doorLeaf(t, { w: pd.x1 - pd.x0 - 0.04, h: pd.y1 - FL - 0.03, side: 1, tint: DOORW, rails: [0.3, pd.y1 - FL - 0.33], strap: STRAP, handle: true, braceFit: true }), 5113);
  props.push({ type: 'broom', x: pd.x1 + 0.28, y: FL, z: PART + 0.06, rot: 0, inside: true });
  // shelves either side of the door on the store's side: tins, kegs on the bottom
  const shelf = (x0, x1, ys, depth, mix) => {
    for (const x of [x0 + 0.02, x1 - 0.02]) k.board([0.03, ys[ys.length - 1] - FL + 0.02, depth], [x, (ys[ys.length - 1] + FL) / 2, PART + 0.03 + depth / 2], null, { long: 1, tint: vary(k, FURN, 0.8, 0.95), inside: true });
    for (const y of ys) { k.board([x1 - x0, 0.03, depth], [(x0 + x1) / 2, y, PART + 0.03 + depth / 2], null, { long: 0, tint: vary(k, FURN, 0.85, 1.0), inside: true }); if (y < ys[ys.length - 1] - 0.01) stock(T(x0 + 0.04, y + 0.015, PART + 0.03 + depth), x1 - x0 - 0.08, depth - 0.02, k, { mix, tall: 0.34, spread: 3.2 }); }
  };
  shelf(ix0 + 0.05, pd.x0 - 0.15, [FL + 0.5, FL + 0.9, FL + 1.3, FL + 1.7, FL + 2.1, FL + 2.5], 0.32, 'grocery');
  for (let i = 0; i < 3; i++) keg(T(ix0 + 0.4 + i * 0.5, FL, PART + 0.24), 0.19, 0.48, k);
  shelf(pd.x1 + 0.45, 2.3, [FL + 0.5, FL + 0.9, FL + 1.3, FL + 1.7], 0.3, 'jars');
  for (let i = 0; i < 2; i++) keg(T(pd.x1 + 0.7 + i * 0.5, FL, PART + 0.24), 0.18, 0.46, k);
  // the back room: shelves of stock along its back wall, sacks on the floor
  const bz = ZB + INS;
  for (const x of [-1.3, 0.5, 2.3]) k.board([0.03, 2.3, 0.36], [x, FL + 1.15, bz + 0.18], null, { long: 1, tint: vary(k, FURN, 0.75, 0.9), inside: true });
  for (const y of [FL + 0.45, FL + 0.95, FL + 1.45, FL + 1.95]) { k.board([3.6, 0.03, 0.36], [0.5, y, bz + 0.18], null, { long: 0, tint: vary(k, FURN, 0.8, 0.95), inside: true, cuts: [-1, 1], skip: '-z' }); if (y > FL + 0.6 && y < FL + 1.0) stock(T(-0.4, y + 0.015, bz + 0.36), 2.0, 0.33, k, { mix: 'boxes', tall: 0.45, spread: 1.8 }); }
}
// THE COUNTER down the right side: a thick top on a frame, its customer face panelled in planks between stiles, a kick
// board; on the clerk's side two shelves of stock; on top the till at the near end, the coffee grinder, candy jars, the
// scale, a ledger
function counter(k, lamps) {
  const x0 = CX, x1 = CX + CD, y = FL, top = y + CH, zc = (CZ0 + CZ1) / 2, L = CZ0 - CZ1;
  k.board([CD + 0.08, 0.05, L + 0.08], [(x0 + x1) / 2 - 0.02, top - 0.025, zc], null, { long: 2, tint: vary(k, FURN, 0.9, 1.0), cuts: [-1, 0, 1], segFaces: '+y', inside: true });
  k.board([0.04, 0.07, L + 0.06], [x0 - 0.04, top - 0.08, zc], null, { long: 2, tint: vary(k, FURN, 0.8, 0.9), inside: true });
  // the face: stiles every 0.7 m, planks upright between them, a rail along the top, a kick board
  const nS = Math.round(L / 0.72);
  for (let i = 0; i <= nS; i++) k.board([0.04, CH - 0.1, 0.1], [x0 + 0.0, y + (CH - 0.1) / 2, CZ1 + 0.05 + (L - 0.1) * i / nS], null, { long: 1, tint: vary(k, FURN, 0.85, 0.95), inside: true });
  for (let z = CZ1; z < CZ0 - 0.02;) { const bw = Math.min(k.r(0.15, 0.22), CZ0 - z); k.board([0.025, CH - 0.16, bw - 0.004], [x0 + 0.02, y + 0.06 + (CH - 0.16) / 2, z + bw / 2], null, { long: 1, tint: vary(k, FURN, 0.85, 1.12), strip: Math.floor(k.R() * 12), skip: '+x+y-y', inside: true }); z += bw; }
  k.board([0.045, 0.1, L], [x0 - 0.005, top - 0.13, zc], null, { long: 2, tint: vary(k, FURN, 0.85, 0.95), inside: true, cuts: [-1, 1] });
  k.board([0.05, 0.1, L], [x0 + 0.005, y + 0.05, zc], null, { long: 2, tint: vary(k, DARKW, 0.8, 0.9), inside: true, cuts: [-1, 1] });
  // its ends: panelled boards across; the clerk's side open, two shelves of stock
  for (const z of [CZ0, CZ1]) k.board([CD, CH - 0.05, 0.03], [(x0 + x1) / 2, y + (CH - 0.05) / 2, z], null, { long: 0, tint: vary(k, FURN, 0.8, 0.95), inside: true });
  for (const sy of [y + 0.08, y + 0.48]) { k.board([CD - 0.06, 0.025, L - 0.06], [(x0 + x1) / 2 + 0.02, sy, zc], null, { long: 2, tint: vary(k, FURN, 0.75, 0.85), inside: true, skip: '-y-x' }); if (sy > y + 0.2) stock(mul(T(x1 - 0.04, sy + 0.012, CZ0 - 0.06), RY(Math.PI / 2)), L - 0.14, CD - 0.12, k, { mix: 'boxes', tall: 0.36, spread: 5 }); }
  k.solid([CD, CH, L], [(x0 + x1) / 2, y + CH / 2, zc]);
  // on top, from the near end: the till, the grinder, the candy jars, the scale, a ledger
  till(k, CX + 0.36, top, CZ0 - 0.28);
  grinder(k, CX + 0.3, top, CZ0 - 0.82);
  for (let i = 0; i < 5; i++) candyJar(T(CX + 0.2, top, -0.42 - i * 0.2), 0.25 + (i % 2) * 0.03, [A.candy, A.heaps.mints, A.tile.candy, A.candy, A.heaps.beans][i], [[1, 1, 1], [1, 1, 1], [0.8, 0.75, 0.7], [0.9, 1.05, 0.85], [1, 1, 1]][i], 0.62 + 0.25 * k.R());
  scale(k, CX + 0.3, top, -1.6);
  G.box([0.3, 0.05, 0.4], mul(T(CX + 0.36, top + 0.025, -2.0), RY(0.2)), { '+y': A.tile.leatherBlack, '+x': A.tile.kraft, '-x': A.tile.kraft, '+z': A.tile.kraft, '-z': A.tile.kraft }, [0.9, 0.9, 0.9]);
}
// a candy jar turned in glass (a round body, a shoulder, a short neck), a glass lid with a knob, small hard candy in it
// filled to `fill` of its height
function candyJar(M, h, candy, ct, fill) {
  const s = h / 0.265;
  const ch = h * fill * 0.8;
  G.cyl(0.066, ch, mul(M, T(0, ch / 2 + 0.006, 0)), 9, candy, null, ct);
  // (its top heaped and lumpy: a low dome, a few loose pieces on it)
  G.dome(0.066, 0.03, mul(M, T(0, ch + 0.006, 0)), 9, candy, ct, 2);
  for (let i = 0; i < 4; i++) { const a = i * 2.4 + h * 40, rr = 0.025 + (i % 2) * 0.018; G.lathe([[0, -0.008], [0.009, -0.004], [0.009, 0.004], [0, 0.008]], mul(M, T(Math.cos(a) * rr, ch + 0.03 - rr * 0.5, Math.sin(a) * rr)), 5, candy, ct); }
  J.lathe([[0, 0.002], [0.07, 0.002], [0.075, 0.014], [0.075, 0.2 * s], [0.062, 0.232 * s], [0.05, 0.244 * s], [0.05, h]], M, 9, A.tile.glass, [1, 1, 1]);
  J.lathe([[0.056, h], [0.025, h + 0.026], [0.02, h + 0.05], [0, h + 0.056]], M, 7, A.tile.glass, [1, 1, 1]);
}
// THE REGISTER, an ornate brass one of the 1880s, dull with handling: a cash drawer at its foot, a tall body, a bank of
// round keys sloping toward the clerk, an arched marquee on top with the amount tabs showing, a crank at its side
function till(k, x, y, z) {
  const F = mul(T(x, y, z), RY(Math.PI / 2));   // (its keys toward +x, the clerk's side)
  const br = A.ornate, t = [0.98, 0.9, 0.74], all = { all: br };
  G.box([0.42, 0.11, 0.36], mul(F, T(0, 0.055, 0)), all, t.map((c) => c * 0.9));                       // the cash drawer
  G.box([0.03, 0.03, 0.01], mul(F, T(0, 0.06, 0.183)), { '+z': A.tile.brass, '+y': A.tile.brass }, t);    // its pull
  G.box([0.38, 0.3, 0.2], mul(F, T(0, 0.26, -0.06)), { ...all, '-y': null }, t);                         // the body
  G.box([0.38, 0.03, 0.2], mul(F, T(0, 0.2, 0.1), RX(0.55)), { '+y': A.keys, '+z': br, '-x': br, '+x': br }, [0.95, 0.95, 0.95]);   // the keys
  G.box([0.4, 0.025, 0.24], mul(F, T(0, 0.42, -0.06)), all, t.map((c) => c * 1.05));                    // the top's moulding
  G.extrude([[-0.17, 0], [0.17, 0], [0.17, 0.09], [0.12, 0.15], [0, 0.175], [-0.12, 0.15], [-0.17, 0.09]], 0.05, mul(F, T(0, 0.432, -0.1)), br, br, t);   // the marquee
  for (const s of [-1, 1]) G.box([0.12, 0.045, 0.006], mul(F, T(s * 0.065, 0.49, -0.072)), { '+z': A.tile.enamel, '-z': A.tile.enamel }, [0.9, 0.88, 0.8]);   // the amount tabs
  G.cyl(0.05, 0.03, mul(F, T(0.205, 0.28, -0.02), RZ(Math.PI / 2)), 8, A.tile.brass, A.tile.brass, t);    // the crank: its boss,
  G.box([0.02, 0.14, 0.02], mul(F, T(0.225, 0.22, 0.02)), all, t);                                        // its arm
  G.cyl(0.015, 0.05, mul(F, T(0.245, 0.16, 0.03), RZ(Math.PI / 2)), 6, A.tile.darkwood, A.tile.darkwood, [1, 1, 1]);   // its handle
  k.solid([0.42, 0.6, 0.36], [x, y + 0.3, z]);
}
// a cast-iron coffee mill of the Enterprise kind, its paint a faded oxblood: a narrow turned body on a small foot, a
// bowl of a hopper on top, two spoked flywheels either side of it, a little drawer
function grinder(k, x, y, z) {
  const M = T(x, y, z), red = [1.9, 0.78, 0.62], ci = A.tile.castIron;
  G.box([0.18, 0.05, 0.16], mul(M, T(0, 0.025, 0)), { all: ci, '-y': null }, red.map((c) => c * 0.7));
  G.box([0.07, 0.04, 0.005], mul(M, T(-0.091, 0.07, 0)), { '-x': A.tile.brass }, [0.8, 0.75, 0.6]);
  G.lathe([[0.07, 0.05], [0.07, 0.1], [0.045, 0.14], [0.04, 0.3], [0.055, 0.33]], M, 8, ci, red);
  G.lathe([[0.05, 0.33], [0.09, 0.36], [0.12, 0.4], [0.112, 0.412], [0.085, 0.385], [0, 0.375]], M, 8, ci, red.map((c) => c * 0.95));
  G.lathe([[0.02, 0.41], [0.012, 0.44], [0.02, 0.45], [0, 0.46]], M, 6, A.tile.brass, [0.8, 0.72, 0.5]);
  // (the flywheels: a rim turned round the axle, five spokes, a hub)
  for (const s of [-1, 1]) {
    const W = mul(M, T(0, 0.22, s * 0.075), RX(Math.PI / 2));
    G.lathe([[0.105, -0.008], [0.122, -0.008], [0.122, 0.008], [0.105, 0.008], [0.105, -0.008]], W, 10, ci, red, { flat: true });
    G.cyl(0.02, 0.03, W, 8, ci, ci, red);
    for (let i = 0; i < 5; i++) G.box([0.1, 0.009, 0.009], mul(W, RY(i / 5 * Math.PI * 2), T(0.06, 0, 0)), { '+y': ci, '-y': ci, '+z': ci, '-z': ci }, red);
  }
  k.solid([0.18, 0.46, 0.3], [x, y + 0.23, z]);
}
// a brass balance scale: a foot, a pillar, a beam across with a pan hung from each end
function scale(k, x, y, z) {
  const br = A.tile.brass, t = [0.82, 0.74, 0.58];
  G.cyl(0.09, 0.03, T(x, y + 0.015, z), 10, br, br, t);
  G.cyl(0.018, 0.34, T(x, y + 0.2, z), 8, br, br, t);
  G.box([0.03, 0.03, 0.46], T(x, y + 0.38, z), { all: br }, t);
  for (const s of [-1, 1]) {
    for (const d of [-1, 1]) k.box('iron', [0.004, 0.2, 0.004], [x + d * 0.05, y + 0.28, z + s * 0.22 + d * 0.0], [d * 0.25, 0, 0], { tint: [1.4, 1.1, 0.6] });
    G.cyl(0.1, 0.025, T(x, y + 0.18, z + s * 0.22), 10, br, br, t, { taper: 1.15, bottom: br });
  }
  G.cyl(0.03, 0.04, T(x, y + 0.215, z + 0.22), 6, A.tile.wax, A.tile.wax, [1, 1, 1]);
  k.solid([0.2, 0.4, 0.6], [x, y + 0.2, z]);
}
// THE SHELVES behind the counter: floor to ceiling down the right wall, a bank of drawers along their foot (brass card
// labels, knobs), six shelves of tins, jars and packets, a rolling ladder on a rail, framed pictures and a flag on top
function shelvesRight(k) {
  const xw = XR - INS, z0 = PART + 0.04, z1 = ZF - INS - 0.35, L = z1 - z0, xf = SHX, d = xw - xf;
  // uprights
  const nU = Math.round(L / 1.1);
  for (let i = 0; i <= nU; i++) { const z = z0 + 0.02 + (L - 0.04) * i / nU; k.board([d, CEIL - FL - 0.02, 0.035], [xf + d / 2, (CEIL + FL) / 2, z], null, { long: 1, tint: vary(k, FURN, 0.8, 0.95), inside: true, cuts: [0], segFaces: '-x', skip: '+x+y-y' }); }
  // the drawers: a carcass, rows of drawer fronts with a label and a knob each
  const dy1 = FL + 0.95;
  k.board([d + 0.04, 0.04, L], [xf + d / 2 - 0.02, dy1, (z0 + z1) / 2], null, { long: 2, tint: vary(k, FURN, 0.85, 0.95), inside: true, cuts: [-1.5, 0, 1.5] });
  k.solid([d, dy1 - FL, L], [xf + d / 2, (dy1 + FL) / 2, (z0 + z1) / 2]);
  const rowsY = [FL + 0.08, FL + 0.38, FL + 0.66];
  let li = 0;
  for (const [ri, ry] of rowsY.entries()) {
    const h = ri === 0 ? 0.28 : 0.26, n = Math.round(L / 0.42);
    for (let i = 0; i < n; i++) {
      const zc = z0 + (L) * (i + 0.5) / n, w = L / n - 0.02;
      k.board([0.025, h - 0.02, w], [xf, ry + h / 2, zc], null, { long: 2, tint: vary(k, FURN, 0.8, 1.05), inside: true, skip: '+x+y-y+z-z' });
      G.disc(0.017, mul(T(xf - 0.016, ry + h * 0.42, zc), RZ(Math.PI / 2)), 6, A.tile.brass, [0.9, 0.85, 0.75]);
      pic(A.labels[(li++) % 16], 0.1, 0.075, mul(T(xf - 0.016, ry + h * 0.72, zc), RY(-Math.PI / 2)));
    }
  }
  // the shelves and their stock
  const ys = [dy1 + 0.4, dy1 + 0.78, dy1 + 1.16, dy1 + 1.54, dy1 + 1.92, dy1 + 2.3, CEIL - 0.42];
  for (const [i, y] of ys.entries()) {
    k.board([d, 0.03, L], [xf + d / 2, y, (z0 + z1) / 2], null, { long: 2, tint: vary(k, FURN, 0.85, 1.0), inside: true, cuts: [0], segFaces: '+y-y', skip: '+x+z-z' });
    if (i < ys.length - 3) stock(mul(T(xf, y + 0.015, z0 + 0.04), RY(-Math.PI / 2)), L - 0.08, d - 0.04, k, { mix: i === 2 ? 'jars' : i === 4 ? 'boxes' : 'grocery', tall: 0.34, spread: 2.9 });
  }
  stock(mul(T(xf, dy1 + 0.02, z0 + 0.04), RY(-Math.PI / 2)), L - 0.08, d - 0.04, k, { mix: 'crocks', tall: 0.36, spread: 2.4 });
  // pictures and the flag up on the top
  const yt = ys[ys.length - 1] + 0.015;
  pic(A.pictures[0], 0.46, 0.32, mul(T(xw - 0.1, yt + 0.16, -1.9), RY(-Math.PI / 2), RX(-0.12)));
  pic(A.pictures[1], 0.46, 0.32, mul(T(xw - 0.1, yt + 0.16, 0.3), RY(-Math.PI / 2), RX(-0.12)));
  pic(A.flag, 0.5, 0.34, mul(T(xw - 0.03, yt + 0.0 + 0.2, -0.8), RY(-Math.PI / 2)));
  // the rolling ladder: two rails, rungs, its top hooked over a rod along the shelves, its feet out on the floor
  k.prism('iron', ngon(6, 0.013), L, null, null, { m: mul(T(xf - 0.05, CEIL - 0.32, (z0 + z1) / 2), RX(Math.PI / 2)), tint: BRASS, smooth: true });
  const lz = -0.95, lh = CEIL - 0.32 - FL, foot = 0.85, ang = Math.atan2(foot, lh), LL = Math.hypot(foot, lh);
  for (const s of [-1, 1]) k.board([0.045, LL, 0.07], [xf - 0.06 - foot / 2, FL + lh / 2, lz + s * 0.2], [0, 0, -ang], { long: 1, tint: vary(k, FURN, 0.9, 1.05), inside: true });
  for (let i = 1; i < 10; i++) { const t = i / 10; k.board([0.05, 0.03, 0.4], [xf - 0.06 - foot * (1 - t), FL + lh * t, lz], null, { long: 2, tint: vary(k, FURN, 0.85, 1.0), inside: true }); }
}
// THE LEFT WALL: hats on a row of pegs, shelves of boots below them, then shelves of folded bolts of cloth and books,
// flour sacks along the foot of the wall
function leftWall(k, props) {
  const xw = XL + INS, d = 0.4, xf = xw + d;
  // hats on pegs along a rail (by the window), boots on two low shelves under them
  const hz0 = -0.62, hz1 = -1.78;
  k.board([0.03, 0.1, hz0 - hz1 + 0.3], [xw + 0.015, 2.55, (hz0 + hz1) / 2], null, { long: 2, tint: vary(k, FURN, 0.8, 0.9), inside: true });
  for (let i = 0; i < 4; i++) {
    const z = hz0 - 0.08 - i * 0.34;
    hat(k, xw + 0.2, 2.42 - (i % 2) * 0.04, z, i);
  }
  for (const y of [FL + 0.32, FL + 0.82]) {
    k.board([0.36, 0.03, hz0 - hz1 + 0.3], [xw + 0.18, y, (hz0 + hz1) / 2], null, { long: 2, tint: vary(k, FURN, 0.8, 0.95), inside: true });
    for (let i = 0; i < 3; i++) boots(k, xw + 0.2, y + 0.015, hz0 - 0.16 - i * 0.4, i + (y > 1 ? 5 : 0));
  }
  for (const z of [hz0 + 0.14, hz1 - 0.14]) k.board([0.36, 0.86, 0.03], [xw + 0.18, FL + 0.6, z], null, { long: 1, tint: vary(k, FURN, 0.75, 0.9), inside: true });
  // the cloth and book shelves further back
  const cz0 = -1.98, cz1 = -2.84;
  for (const z of [cz0, cz1]) k.board([d, 2.6, 0.03], [xw + d / 2, FL + 1.3, z], null, { long: 1, tint: vary(k, FURN, 0.8, 0.95), inside: true });
  const ys = [FL + 0.1, FL + 0.55, FL + 1.0, FL + 1.45, FL + 1.9, FL + 2.35, FL + 2.6];
  for (const [i, y] of ys.entries()) {
    k.board([d, 0.03, cz0 - cz1 - 0.03], [xw + d / 2, y, (cz0 + cz1) / 2], null, { long: 2, tint: vary(k, FURN, 0.85, 1.0), inside: true });
    if (i >= ys.length - 1) continue;
    if (i === 4 || i === 5) G.box([cz0 - cz1 - 0.08, 0.26, 0.3], mul(T(xw + 0.22, y + 0.145, (cz0 + cz1) / 2), RY(Math.PI / 2)), { '+z': A.books, '+y': A.tile.kraft }, vary(k, [1, 1, 1], 0.9, 1.05));
    else {
      // bolts of cloth: folded flat, stacked three or four high, their folded edges out
      let z = cz0 - 0.03;
      while (z > cz1 + 0.2) {
        const w = 0.2 + k.R() * 0.06, cl = A.cloth[Math.floor(k.R() * 4)], n = 2 + Math.floor(k.R() * 2), tint = vary(k, [1, 1, 1], 0.8, 1.1);
        for (let j = 0; j < n; j++) G.box([0.34, 0.085, w - 0.01], T(xw + 0.21 + k.r(-0.02, 0.02), y + 0.015 + 0.043 + j * 0.087, z - w / 2), { '+x': cl, '+y': j === n - 1 ? cl : null }, tint.map((c) => c * (0.92 + 0.08 * (j % 2))));
        z -= w + 0.02;
      }
    }
  }
  k.solid([d, 2.6, cz0 - cz1], [xw + d / 2, FL + 1.3, (cz0 + cz1) / 2]);
  // flour sacks against the wall by the window and an apple barrel and crates under it
  props.push({ type: 'sack', x: xw + 0.3, y: FL, z: -2.35 + 0.05, rot: Math.PI / 2 + 0.2, print: 'flour', inside: true, h: 0.6 });
  props.push({ type: 'sack', x: xw + 0.75, y: FL, z: -2.5, rot: Math.PI / 2 - 0.3, print: 'flour', inside: true, h: 0.58 });

  props.push({ type: 'barrel', x: xw + 0.38, y: FL, z: 1.15, fill: 'apples', inside: true });
  props.push({ type: 'crate', x: xw + 0.4, y: FL, z: 0.45, rot: 0.1, size: 0.5, fill: 'apples', inside: true });
  props.push({ type: 'crate', x: xw + 0.95, y: FL, z: 1.2, rot: -0.2, size: 0.45, fill: 'potatoes', inside: true });
}
// a pair of boots: each its side outline (a heel, the sole, a rounded toe, the instep, the leg) drawn out to its width,
// the toes toward the room
const BOOT = [[-0.12, 0], [0.13, 0], [0.155, 0.022], [0.14, 0.05], [0.06, 0.075], [-0.005, 0.1], [-0.02, 0.3], [-0.112, 0.305], [-0.12, 0.17], [-0.135, 0.04]];
function boots(k, x, y, z, i) {
  const reg = i % 3 === 1 ? A.tile.leatherBlack : A.tile.leather, t = vary(k, [0.8, 0.74, 0.7], 0.85, 1.1);
  for (const s of [-1, 1]) G.extrude(BOOT, 0.085, mul(T(x + 0.02, y, z + s * 0.055), RY(s * 0.06)), reg, reg, t);
}
// a hat turned on a lathe: the brim's underside out from the crown's opening, its rolled edge, its top back in, the crown
// up and over with a crease in its top; the dark inside of the crown, seen from below. Hung tilted on its peg
// felt: dove grey, a sun-faded black, tan, a warm brown (as the stores sold them)
const FELT = [[A.tile.castIron, [2.4, 2.3, 2.2]], [A.tile.castIron, [1.05, 1.0, 0.98]], [A.tile.kraft, [0.92, 0.84, 0.72]], [A.tile.kraft, [0.62, 0.5, 0.4]]];
function hat(k, x, y, z, i) {
  // (hung crown out on its peg, the brim round it: from the room you see the crown and the brim's top, rolled up at its
  // sides; the crown pinched in a crease along its top)
  const M = mul(T(x, y, z), RZ(-Math.PI / 2 + 0.45)), [reg, t] = FELT[i % FELT.length];
  const lift = (a, yy) => (yy < 0.03 ? 0.035 * Math.pow(Math.abs(Math.sin(a)), 3) : 0), crease = (a, yy) => (yy > 0.13 ? -0.18 * Math.pow(Math.abs(Math.cos(a)), 2) : 0);
  G.lathe([[0.096, 0], [0.19, -0.004], [0.208, 0.008], [0.196, 0.018], [0.11, 0.014], [0.104, 0.07], [0.098, 0.12], [0.082, 0.148], [0.03, 0.155], [0, 0.138]], M, 10, reg, t, { lift, bump: crease, oval: [1, 1.12] });
  G.disc(0.095, mul(M, T(0, 0.004, 0), RX(Math.PI)), 10, A.tile.coal, [0.5, 0.45, 0.4]);
  k.board([0.12, 0.022, 0.022], [x - 0.08, y, z], null, { long: 0, tint: FURN, inside: true });   // its peg
}
// a galvanized pail hung from a beam by its bail (props.js galvPail), the wire up to a hook in the beam
function hungPail(k, x, y, z) {
  galvPail(k, G, T(x, y - 0.12, z), 0.24, 0.85, true);
  const top = y - 0.12 + 0.215 + 0.13;
  k.box('iron', [0.008, CEIL - 0.22 - top, 0.008], [x, (CEIL - 0.22 + top) / 2, z], null, { tint: [0.5, 0.48, 0.46], skip: '+y-y' });
}
function kettle(k, x, y, z) {
  k.prism('iron', ngon(10, 0.11), 0.14, [x, y + 0.07, z], null, { tint: [1.2, 1.2, 1.25], smooth: true, taper: 0.3 });
  k.prism('iron', ngon(8, 0.03), 0.03, [x, y + 0.155, z], null, { tint: [1.0, 1.0, 1.0], smooth: true });
  k.box('iron', [0.03, 0.03, 0.14], [x, y + 0.08, z + 0.13], [-0.7, 0, 0], { tint: [1.2, 1.2, 1.25] });
  for (const s of [-1, 1]) k.box('iron', [0.012, 0.08, 0.012], [x + s * 0.075, y + 0.17, z], [0, 0, -s * 0.15], { tint: [0.6, 0.6, 0.6] });
  k.box('iron', [0.15, 0.012, 0.012], [x, y + 0.21, z], null, { tint: [0.6, 0.6, 0.6] });
}
function chair(k, x, z, rot) {
  const M = mul(T(x, FL, z), RY(rot)), C = vary(k, FURN, 0.75, 0.9);
  const b = (s, p, r, o) => k.board(s, null, null, { ...o, m: mul(M, T(...p), r ? RX(r) : new THREE.Matrix4()), tint: C, inside: true });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.prism('wood', ngon(6, 0.018), 0.45, null, null, { m: mul(M, T(sx * 0.18, 0.225, sz * 0.17), RX(sz * 0.06), RZ(-sx * 0.06)), tint: C, smooth: true, inside: true, skip: '+y-y' });
  b([0.44, 0.04, 0.42], [0, 0.465, 0], null, { long: 0 });
  for (const sx of [-1, 1]) b([0.035, 0.52, 0.035], [sx * 0.18, 0.74, -0.2], -0.1, { long: 1 });
  for (let i = 0; i < 3; i++) k.prism('wood', ngon(4, 0.01), 0.4, null, null, { m: mul(M, T(-0.08 + i * 0.08, 0.72, -0.2), RX(-0.1)), tint: C, smooth: true, inside: true, skip: '+y-y' });
  b([0.42, 0.06, 0.04], [0, 0.98, -0.23], -0.1, { long: 0 });
  k.solid([0.44, 0.48, 0.42], null, null, mul(M, T(0, 0.24, 0)));
}
// A POT-BELLY STOVE, cast iron, turned on its profile: four splayed cabriole legs under a round plinth, the ash box with
// its door and a damper wheel, a nickel ring, the fat belly with the fire door and its nickel rim (the fire's glow through
// the mica), a nickel band, the neck, the top plate with its nickel rim, a domed crown, the collar the pipe rises from.
// Its doors face `face` (radians from +z)
const STOVE_TOP = 1.24;
function potBelly(k, x, y, z, face = 0) {
  // (its bands and rims: dark nickel, only a little lighter than the iron, not pale)
  const M = mul(T(x, y, z), RY(face)), CI = A.tile.castIron, NI = A.tile.castIron, ci = [1.2, 1.18, 1.16], ni = [1.9, 1.9, 1.95];
  // (the legs: an S-curved outline each, drawn out to 5 cm, splayed out at the corners)
  for (let i = 0; i < 4; i++) G.extrude([[0, 0.205], [0.06, 0.205], [0.095, 0.13], [0.13, 0.04], [0.17, 0.0], [0.115, 0.0], [0.085, 0.06], [0.04, 0.14], [0, 0.16]], 0.05, mul(M, RY(Math.PI / 4 + i * Math.PI / 2), T(0.16, 0, 0)), CI, CI, ci);
  G.lathe([[0, 0.2], [0.27, 0.2], [0.29, 0.218], [0.29, 0.248], [0.25, 0.268], [0.212, 0.27], [0.212, 0.4]], M, 10, CI, ci, { flat: true });
  G.lathe([[0.212, 0.4], [0.252, 0.408], [0.258, 0.422], [0.252, 0.436], [0.236, 0.44]], M, 10, NI, ni, { flat: true });
  G.lathe([[0.236, 0.44], [0.29, 0.52], [0.322, 0.62], [0.322, 0.72], [0.29, 0.82], [0.245, 0.88]], M, 11, CI, ci);
  G.lathe([[0.245, 0.88], [0.262, 0.888], [0.266, 0.902], [0.256, 0.915], [0.205, 0.918]], M, 10, NI, ni, { flat: true });
  G.lathe([[0.205, 0.918], [0.182, 0.97], [0.182, 1.02], [0.272, 1.022]], M, 10, CI, ci, { flat: true });
  G.lathe([[0.272, 1.022], [0.29, 1.034], [0.29, 1.054], [0.272, 1.066], [0.222, 1.07]], M, 10, NI, ni, { flat: true });
  G.lathe([[0.222, 1.07], [0.16, 1.1], [0.1, 1.118], [0.086, 1.13], [0.09, 1.2], [0.08, STOVE_TOP]], M, 10, CI, ci);
  // (the fire door on the belly: a curved plate, a nickel rim round it, the mica's glow; the ash door, its damper wheel)
  G.box([0.2, 0.17, 0.02], mul(M, T(0, 0.67, 0.333)), { '+z': CI, '+x': NI, '-x': NI, '+y': NI, '-y': NI }, ci);
  for (const [dx, dy, w, h] of [[0, 0.09, 0.22, 0.02], [0, -0.09, 0.22, 0.02], [0.1, 0, 0.02, 0.18], [-0.1, 0, 0.02, 0.18]]) G.box([w, h, 0.012], mul(M, T(dx, 0.67 + dy, 0.346)), { '+z': NI, '+y': NI, '-y': NI, '+x': NI, '-x': NI }, ni);
  // (the fire seen through the door's grate: a dim orange behind four iron bars)
  k.parts.glow.push({ size: [0.15, 0.1, 0], m: mul(M, T(0, 0.675, 0.344)), pane: true, kind: GLOW.flame, col: [0.55, 0.16, 0.03] });
  for (let i = 0; i < 4; i++) G.box([0.012, 0.11, 0.012], mul(M, T(-0.054 + i * 0.036, 0.675, 0.349)), { '+z': CI, '+x': CI, '-x': CI }, ci);
  G.box([0.16, 0.08, 0.02], mul(M, T(0, 0.335, 0.215)), { '+z': CI, '+y': CI, '+x': CI, '-x': CI }, ci.map((c) => c * 0.9));
  G.cyl(0.03, 0.012, mul(M, T(0, 0.335, 0.228), RX(Math.PI / 2)), 10, NI, NI, ni);
  k.solid([0.62, 1.24, 0.62], [x, y + 0.62, z]);
}

// ── the props that go with it: each { type, x, y, z, rot, ... } ─────────────────────────────────────────────────────
function propList(extra) {
  const y = FL;
  return [
    // the boardwalk, left of the door: an apple barrel and a keg by the post, a crate of pails and the stencilled crates
    // under the window, flour sacks piled at the boardwalk's end
    { type: 'barrel', x: 0.25, y, z: ZF + 0.85, fill: 'apples' }, { type: 'keg', x: 0.72, y, z: ZF + 0.42 },
    { type: 'crate', x: -0.55, y, z: ZF + 0.42, size: 0.55, rot: 0.05, pails: 2 }, { type: 'crate', x: 0.0, y, z: ZF + 0.95, size: 0.5, rot: -0.1, stencil: 'APPLES', fill: 'apples' },
    { type: 'crate', x: 0.3, y, z: ZF + 0.33, size: 0.42, rot: 0.15, stencil: 'CRACKERS' },
    { type: 'barrel', x: -1.2, y, z: ZF + 0.45, fill: 'crackers' },
    { type: 'sack', x: -1.3, y, z: ZF + 1.2, rot: 0.3, print: 'flour', lie: 0.2 }, { type: 'sack', x: -1.25, y, z: ZF + 1.62, rot: -0.1, print: 'flour', lie: 2.9 },
    { type: 'sack', x: -1.3, y: y + 0.3, z: ZF + 1.4, rot: 0.1, print: 'flour', lie: 1.6 }, { type: 'sack', x: -0.85, y, z: ZF + 1.55, rot: 0.4, print: 'flour', h: 0.6 },
    // right of the door: the bench under the window, a keg, the shovels against the wall and the washtub over them
    { type: 'bench', x: 3.65, y, z: ZF + 0.32, len: 1.6, back: true }, { type: 'crate', x: 4.85, y, z: ZF + 1.2, size: 0.42, rot: 0.3 },
    { type: 'shovel', x: 4.6, y, z: ZF + 0.03, kind: 'shovel', lean: 0.28 }, { type: 'shovel', x: 4.78, y, z: ZF + 0.03, kind: 'spade', lean: 0.25, rot: 0.05 },
    { type: 'shovel', x: 4.96, y, z: ZF + 0.03, kind: 'fork', lean: 0.3, rot: -0.05 }, { type: 'washtub', x: 4.84, y: 2.62, z: ZF + 0.05, hung: true },
    // the dock: barrels, sacks, a crate stack inside the open storeroom door
    { type: 'barrel', x: -4.2, y, z: 1.35 }, { type: 'barrel', x: -3.65, y, z: 1.5, h: 0.8 },
    { type: 'sack', x: -2.55, y, z: 1.35, rot: 0.2, print: 'burlap', lie: 0.5 }, { type: 'sack', x: -2.2, y, z: 1.45, rot: -0.3, print: 'coffee', h: 0.6 },
    { type: 'crate', x: -3.75, y, z: -1.0, size: 0.6, rot: 0.04 }, { type: 'crate', x: -3.75, y: y + 0.6, z: -1.02, size: 0.56, rot: -0.06 },
    { type: 'crate', x: -3.75, y: y + 1.16, z: -1.0, size: 0.5, rot: 0.1 }, { type: 'crate', x: -3.2, y, z: -1.1, size: 0.55, rot: -0.12 },
    { type: 'crate', x: -3.2, y: y + 0.55, z: -1.12, size: 0.5, rot: 0.05, stencil: 'CRACKERS' }, { type: 'sack', x: -2.4, y, z: -1.5, print: 'flour', h: 0.6, rot: 0.3 },
    { type: 'barrel', x: -2.3, y, z: -3.4 }, { type: 'barrel', x: -2.95, y, z: -3.55, fill: 'pickles' },
    { type: 'sack', x: -4.0, y, z: -3.2, print: 'flour', lie: 0.1, rot: 1.4 }, { type: 'sack', x: -4.0, y: y + 0.28, z: -3.0, print: 'burlap', lie: 1.2, rot: 1.6 },
    ...extra,
  ];
}

// each board's own numbers for the shader (parts.js boardWear): its nails, where along the wall it is, how much more of
// its paint has gone (by the corners, the door, low down, and a little board by board)
function boardAttr(geo, parts, seed) {
  const R = rng(seed * 97 + 5), of = geo.userData.partOf, P = geo.attributes.position, n = P.count, Ab = new Float32Array(n * 3);
  const per = parts.map(() => (R() < 0.15 ? 0.05 + 0.08 * R() : 0.04 * R()));
  const near = (d, r) => 1 - smooth01(d, 0, r);
  for (let i = 0; i < n; i++) {
    const Q = parts[of[i]], o = Q.o; if (!o.hz && !o.nail) continue;
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (o.hz) { Ab[i * 3] = 2 + o.hz[1]; Ab[i * 3 + 1] = o.hz[0]; } else { Ab[i * 3] = o.nail; Ab[i * 3 + 1] = Q.m.elements[13]; }
    if (!o.paint) continue;
    const corner = Math.min(Math.hypot(x - XL, z - ZF), Math.hypot(x - XR, z - ZF), Math.hypot(x - XL, z - ZB), Math.hypot(x - XR, z - ZB), Math.hypot(x - XLT, z - ZLF), Math.hypot(x - XLT, z - ZB), 9);
    const door = Math.abs(z - ZF) < 0.2 ? Math.hypot(Math.max(0, Math.abs(x - OXC) - 0.75), Math.max(0, y - FL - 2.4)) : Math.abs(z - ZLF) < 0.2 ? Math.hypot(Math.max(0, Math.abs(x - (LDOOR.a0 + LDOOR.a1) / 2) - 0.7), Math.max(0, y - 3.2)) : 9;
    // (under the sign's letters the old paint holds better: they were painted over it, and stay readable)
    const sign = Math.abs(z - ZF) < 0.3 && y > 5.9 && y < 7.9 && x > XL - 0.1 && x < XR + 0.1 ? 0.35 : 1;
    Ab[i * 3 + 2] = sign * (per[of[i]] + 0.25 * near(corner, 1.0)) + 0.35 * near(door, 0.9) + 0.2 * near(y - (Math.abs(z - ZF) < 0.2 ? FL : 0), 1.0) - (1 - sign) * 0.12;
  }
  geo.setAttribute('aBoard', new THREE.BufferAttribute(Ab, 3));
}

// ── build it all ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function buildStore(recipeIn = {}, env = {}) {
  const t0 = performance.now(), r = storeRecipe(recipeIn), paint = PAINTS[r.paint].c;
  const k = new Kit(r.seed); k.parts.glow = []; k.parts.rope = [];
  SILLS.length = 0; decals.length = 0; panes.length = 0;
  G = new Goods(A.w, A.h); J = new Goods(A.w, A.h); STOCK.tris = 0; SR = rng(r.seed * 31 + 7);
  const lamps = [], extraProps = [];
  const marks = [], mark = (name) => marks.push([name, k.parts.wood.length, k.parts.iron.length, G.tris]);
  walls(k, paint); mark('walls'); falseFront(k); mark('falseFront'); roofs(k); mark('roofs'); porch(k); mark('porch'); leanTo(k, paint); mark('leanTo'); hoist(k); mark('hoist'); frontThings(k, lamps); mark('front'); storeInside(k, lamps, extraProps); mark('inside');
  lamps.push(lantern(k, -3.0, ltUnder(-3.0) - 0.75, -2.0, { chain: 0.3, strength: 1.6 }));

  // the doors: the two front leaves (hinged at the doorway's sides, swinging in) and the lean-to's sliding door; each
  // its own kit and mesh
  const leaves = [];
  const leafOf = (group, hinge, side, w, h, open, build, seed, slide) => {
    const lk = new Kit(seed); lk.parts.glow = []; lk.parts.rope = [];
    build(lk, { w, h, side });
    const g = buildGeometry(lk.parts.wood, 'wood', rng(seed + 1), { topAt: () => 9, tintAt: (x, y, z, t, o) => tintAt(x, y, z, t, { ...o, outside: true }) });
    const glass = glowGeometry(lk.parts.glow), iron = lk.parts.iron.length ? buildGeometry(lk.parts.iron, 'iron', rng(seed + 2), { topAt: () => 9 }) : null;
    leaves.push({ group, geo: g, glass, iron, hinge, open, slide, closed: 0, parts: lk.parts.wood.length });
    const M = slide ? T(hinge[0] + slide[0], hinge[1], hinge[2]) : mul(T(...hinge), RY(open));
    k.solid([w, h, 0.08], null, null, mul(M, T(side * w / 2, h / 2, 0)));
  };
  const lw = (DOOR.a1 - DOOR.a0) / 2 - 0.01, lh = DOOR_H - FL - 0.02;
  leafOf('front', [DOOR.a0 + 0.01, FL + 0.005, ZF - 0.06], 1, lw, lh, 100 * Math.PI / 180, storeDoor, r.seed * 19 + 1);
  leafOf('front', [DOOR.a1 - 0.01, FL + 0.005, ZF - 0.06], -1, lw, lh, -100 * Math.PI / 180, storeDoor, r.seed * 19 + 2);
  const sdw = LDOOR.a1 - LDOOR.a0 + 0.12;
  leafOf('loading', [LDOOR.a0 - 0.06, FL + 0.02, ZLF + 0.09], 1, sdw, LDOOR.y1 + 0.05 - FL, 0, (t, o) => slidingDoor(t, o), r.seed * 19 + 3, [1.28, 0, 0]);

  // the kit's parts into meshes, one per material
  const R = rng(r.seed + 1), geos = {};
  for (const g of ['wood', 'iron']) geos[g] = buildGeometry(k.parts[g], g, R, { topAt, tintAt });
  boardAttr(geos.wood, k.parts.wood, r.seed);
  // (lantern glass, and the panes of the windows into the store, which are see-through: their goods show behind them;
  // the upstairs windows stay dark glass, the blinds behind them)
  const see = (P) => P.kind === GLOW.glass || P.kind === GLOW.glass + 10 || P.see;
  // (the see-through windows, for a far look that leaves the rooms out: where a dark card goes behind each; moved with
  // the rest below)
  const seeThrough = k.parts.glow.filter((P) => P.see).map((P) => { const c = new THREE.Vector3().setFromMatrixPosition(P.m), n = new THREE.Vector3(0, 0, 1).transformDirection(P.m); return { c: c.toArray(), n: n.toArray(), w: P.size[0], h: P.size[1] }; });
  geos.glow = glowGeometry(k.parts.glow, (P) => !see(P));
  geos.glass = glowGeometry(k.parts.glow, see);
  geos.rope = ropeGeometry(k.parts.rope);
  const foot = footing(r, env);
  geos.stone = mergeGeometries(foot); geos.stone.userData.ownAO = true; for (const g of foot) g.dispose();
  geos.decal = decals.length ? mergeGeometries(decals) : null; for (const g of decals) g.dispose(); decals.length = 0;
  geos.pane = panes.length ? mergeGeometries(panes) : null; for (const g of panes) g.dispose(); panes.length = 0;
  geos.goods = G.build(); geos.jar = J.build();
  const goodsTris = G.tris + J.tris; G = J = null;
  for (const g in geos) if (!geos[g]) delete geos[g];
  const msBuild = performance.now() - t0;

  // the bake: the voxel grid of the solids, then each mesh's corners
  const t1 = performance.now();
  const occ = new Occlusion(k.occ, 1.6, 0.08, { reach: 2.4, rays: 20, groundReach: 0.7 });
  const opening = (c, u, v, n, o = {}) => ({ c, u, v, n, ...o });
  const win = (op, w = 'front') => opening([(op.a0 + op.a1) / 2, (op.y0 + op.y1) / 2, ZF], [(op.a1 - op.a0) / 2, 0, 0], [0, (op.y1 - op.y0) / 2, 0], [0, 0, 1]);
  const openings = [
    opening([OXC, FL + 1.2, ZF], [0.72, 0, 0], [0, 1.2, 0], [0, 0, 1], { front: true }),
    opening([OXC, 3.28, ZF], [0.7, 0, 0], [0, 0.2, 0], [0, 0, 1]),
    win(WIN_DL), win(WIN_DR),
    opening([XL, (WIN_L.y0 + WIN_L.y1) / 2, (WIN_L.a0 + WIN_L.a1) / 2], [0, 0, 0.45], [0, 0.85, 0], [-1, 0, 0]),
    opening([2.975, (WIN_BB.y0 + WIN_BB.y1) / 2, ZB], [0.38, 0, 0], [0, 0.47, 0], [0, 0, -1]),
    opening([(LDOOR.a0 + LDOOR.a1) / 2, FL + 1.3, ZLF], [0.62, 0, 0], [0, 1.3, 0], [0, 0, 1], { door2: true }),
    opening([XLT, 2.1, -2.25], [0, 0, 0.35], [0, 0.4, 0], [-1, 0, 0]),
  ];
  const inStore = (x, y, z) => x > XL + 0.02 && x < XR - 0.02 && z > ZB + 0.02 && z < ZF - 0.02 && y > -0.5 && y < CEIL + 0.02;
  const inLean = (x, y, z) => x > XLT + 0.02 && x < XL - 0.02 && z > ZB + 0.02 && z < ZLF - 0.02 && y > -0.5 && y < ltUnder(x) + 0.1;
  // THE ROOMS' FILL: lantern and window light bounced about (no direction, no shadow), so the store is a warm lit room,
  // the back room and the storeroom dim ones, not black boxes
  const fill = (x, y, z, nx, ny, nz) => {
    const px = x + nx * 0.08, py = y + ny * 0.08, pz = z + nz * 0.08;
    if (inStore(px, py, pz)) return (pz < PART ? 0.14 : 0.13) * (1 - 0.25 * smooth01(py, 2.0, 3.8));
    if (inLean(px, py, pz)) return 0.1 * (1 - 0.3 * smooth01(py, 1.8, 4.0));
    return 0;
  };
  const light = new Light(occ, { inside: (x, y, z) => inStore(x, y, z) || inLean(x, y, z), fill, openings, lamps, base: 0.42, gain: 8.0 });
  const BAKED = ['wood', 'iron', 'stone', 'rope', 'decal', 'goods', 'jar'];
  for (const g of BAKED) if (geos[g]) light.bake(geos[g]);
  for (const L of leaves) {
    const Mo = L.slide ? T(L.hinge[0] + L.slide[0], L.hinge[1], L.hinge[2]) : mul(T(...L.hinge), RY(L.open));
    for (const geo of [L.geo, L.iron]) if (geo) { light.bake(geo, Mo, 'open'); light.bake(geo, T(...L.hinge), 'closed'); }
  }
  // the doors: open (the front's), open2 (the storeroom's)
  light.setDoors = (open, open2) => {
    for (const g of BAKED) if (geos[g]) light.apply(geos[g], open, 'main', open2);
    for (const L of leaves) { const o = L.group === 'front' ? open : open2; for (const geo of [L.geo, L.iron]) if (geo) light.apply(geo, open, o ? 'open' : 'closed', open2); }
  };
  light.setDoors(true, true);
  const msBake = performance.now() - t1;

  // centre the footprint (the hoist's arm to the right eave, the back eave to the steps): everything moves by OX, OZ
  const fx0 = XLT - 1.1, fx1 = XR + EO, fz0 = ZB - GO, fz1 = PZ + 0.9, OX = -(fx0 + fx1) / 2, OZ = -(fz0 + fz1) / 2;
  for (const g in geos) geos[g].translate(OX, 0, OZ);
  for (const L of leaves) L.hinge = [L.hinge[0] + OX, L.hinge[1], L.hinge[2] + OZ];
  for (const L of lamps) { L.p = [L.p[0] + OX, L.p[1], L.p[2] + OZ]; if (L.glow) L.glow = [L.glow[0] + OX, L.glow[1], L.glow[2] + OZ]; }
  light.offset = [OX, OZ];
  const props = propList(extraProps); for (const p of props) { p.x += OX; p.z += OZ; }

  const counts = {}; let parts = 0;
  for (const g in k.parts) { counts[g] = k.parts[g].length; parts += counts[g]; }
  counts.goodsTris = goodsTris; counts.stockTris = STOCK.tris;
  const P3 = (x, y, z) => [x + OX, y, z + OZ];
  return {
    recipe: r, geos, doors: leaves, lamps, light, occ, props, offset: OX, offsetZ: OZ,
    anchors: {
      doorways: [{ name: 'front', centre: P3(OXC, FL + 1.2, ZF), w: 1.5, h: 2.4, out: [0, 0, 1] }, { name: 'storeroom', centre: P3((LDOOR.a0 + LDOOR.a1) / 2, FL + 1.3, ZLF), w: 1.25, h: 2.6, out: [0, 0, 1] }],
      sign: { centre: P3(OXC, 7.05, ZF), w: 6.8, h: 1.2 }, lanterns: lamps.map((L) => L.p),
      // (the store's job: the clerk stands behind the counter facing -x, the customer in front of it facing +x)
      counter: { top: FL + CH, from: P3(CX, FL + CH, CZ0), to: P3(CX, FL + CH, CZ1), clerk: P3(CX + CD + 0.35, FL, -0.8), customer: P3(CX - 0.5, FL, -0.8), faces: [-1, 0, 0] },
      // (the painted sign's picture covers this much of the false front: the board shader lays it on, art.js storeSign)
      signPaint: { x0: XL - WING + OX, y0: 4.3, w: 7.4, h: 4.6, z: ZF + OZ },
      footprint: { w: fx1 - fx0, d: fz1 - fz0, h: STEPS[1][2] + 0.06, x0: fx0 + OX, x1: fx1 + OX, z0: fz0 + OZ, z1: fz1 + OZ },
      street: [fx0 + OX - 1, fx1 + OX + 1, PZ + OZ, PZ + OZ + 8],
      seeThrough: seeThrough.map((W) => ({ ...W, c: [W.c[0] + OX, W.c[1], W.c[2] + OZ] })),
    },
    counts, parts, msBuild, msBake, ms: performance.now() - t0, kit: k, marks,
  };
}
// the sign's layout (the store's picture paints it: art.js storeSign; metres from the sign's left end and foot)
export const SIGN_LAYOUT = {
  big: { text: 'GENERAL STORE', x: 3.7, y: 2.92, w: 5.55, size: 1.42 },
  small: { text: 'DRY\u2002GOODS\u2002·\u2002GROCERIES\u2002·\u2002HARDWARE', x: 3.7, y: 1.98, w: 4.85, size: 0.36 },
  ghosts: [{ text: 'MERCANTILE CO.', x: 3.7, y: 3.93, w: 3.0, size: 0.56 }, { text: 'FEED & SEED', x: 3.7, y: 0.85, w: 1.7, size: 0.42 }, { text: 'EST. 1879', x: 3.7, y: 0.42, w: 1.2, size: 0.26 }],
};
// the store's front door leaf, built round its hinge (the leaf runs from x = 0 to side * w): stiles and rails, a raised
// panel low, glass in six panes above, a brass knob and plate, a kick plate
function storeDoor(k, { w, h, side }) {
  const t = 0.05, st = 0.1, X = (x) => side * x;
  for (const x of [st / 2, w - st / 2]) k.board([st, h, t], [X(x), h / 2, 0], null, { long: 1, tint: vary(k, DOORW, 0.9, 1.05), cuts: [0], segFaces: '+z-z' });
  for (const [y, rh] of [[0.13, 0.26], [1.02, 0.16], [h - 0.07, 0.14]]) k.board([w - 2 * st, rh, t], [X(w / 2), y, 0], null, { long: 0, tint: vary(k, DOORW, 0.9, 1.05), skip: '+x-x' });
  // the panel: a flat board set back, a raised field on it both sides
  k.board([w - 2 * st, 0.7, t * 0.5], [X(w / 2), 0.61, 0], null, { long: 1, tint: vary(k, DOORW, 0.85, 1.0), skip: '+y-y' });
  for (const s of [1, -1]) k.board([w - 2 * st - 0.1, 0.58, 0.012], [X(w / 2), 0.61, s * (t * 0.25 + 0.006)], null, { long: 1, tint: vary(k, DOORW, 0.95, 1.1), skip: s > 0 ? '-z' : '+z' });
  const wy0 = 1.1, wy1 = h - 0.14, ww = w - 2 * st;
  k.board([0.025, wy1 - wy0, 0.03], [X(w / 2), (wy0 + wy1) / 2, 0], null, { long: 1, tint: DOORW });
  for (const f of [1 / 3, 2 / 3]) k.board([ww, 0.025, 0.03], [X(w / 2), wy0 + (wy1 - wy0) * f, 0], null, { long: 0, tint: DOORW });
  k.parts.glow.push({ size: [ww, wy1 - wy0, 0], m: T(X(w / 2), (wy0 + wy1) / 2, 0.006), pane: true, kind: GLOW.window, col: [1.8, 0.7, 0.18] });
  k.parts.glow.push({ size: [ww, wy1 - wy0, 0], m: mul(T(X(w / 2), (wy0 + wy1) / 2, -0.006), RY(Math.PI)), pane: true, kind: GLOW.window, col: [1.8, 0.7, 0.18] });
  for (const s of [1, -1]) {
    k.box('iron', [0.05, 0.18, 0.006], [X(w - 0.06), 1.0, s * (t / 2 + 0.003)], null, { tint: BRASS });
    k.prism('iron', ngon(8, 0.025), 0.05, null, null, { m: mul(T(X(w - 0.06), 0.98, s * (t / 2 + 0.03)), RX(Math.PI / 2)), tint: BRASS, smooth: true });
  }
  k.box('iron', [w - 0.04, 0.18, 0.004], [X(w / 2), 0.11, t / 2 + 0.002], null, { tint: [1.1, 0.9, 0.6] });
}
