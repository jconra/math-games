// THE SHERIFF'S OFFICE AND JAIL: a small timber office with a stepped false front, faded ochre lap siding peeling to
// grey wood, "SHERIFF · JAIL" painted straight onto the boards (an older sign's ghost letters under it), a lean-to porch
// roof of planks on posts with knee braces over a boardwalk with steps, a six-pane window, a plank door with a small
// window, a lantern on a bracket, a notice board crowded with wanted posters (one torn half off), a sheriff's star on
// the wall, a few old bullet holes by the door and a patched board; built onto its right side later, a squat fieldstone
// jail block (the Stone Lab's wall maker): a flat slab roof, one tiny high barred window at the front, a strap-iron
// door on a stone step, a tin stovepipe with a rain cap. After the concept picture.
//
// Laid out to be walked into: the office (a desk and chair, a gun rack, a pot-belly stove, a safe with lock boxes on
// it, a map and a calendar on the walls, a rug, a hanging lantern and a lamp on the desk), a back room behind a plank
// partition (a cot, a wash stand, a trunk, a back door), and through a heavy door in the office's right wall the jail:
// a corridor with its own little stove, and two cells behind a wall of woven strap-iron bars, each with a plank bunk on
// chains and a bucket.
//
//   buildSheriff(recipe, env) -> {
//     geos      { wood, iron, stone, glow, glass, rope, decal }   one mesh each (decal: everything painted, pasted or
//               pinned on: the sign, posters, bullet holes, the map, the rug; see art.js SHERIFF_ART)
//     doors     the office's front door and the jail's: { geo, glass, hinge, open, closed, group } (their own meshes,
//               so they can swing; group 'office' or 'jail')
//     props     [{ type, x, y, z, rot, ... }]: barrels, crates, the trough, the bench, the woodpile, the hitching rail,
//               a leaning plank, the cells' buckets, as separate pieces (props.js builds them; the Town Lab can move them)
//     lamps     [{ p, reach, strength }]   anchors (doorways, the sign, the footprint)   light (the baked light)
//   }
// The footprint is centred on x = z = 0 (as the game's model is), the ground at y = 0, the front (the boardwalk, the
// sign) faces +z, the jail is on the right (+x). Metres. Its footprint matches the game's sheriff's office
// (townAssets.js: 11.7 m along its longest side, about 10 m wide): 10.1 x 11.7 m, 6.2 m to the top of the false front.
//
// A RECIPE is what makes one sheriff's office its own: paint (a colour or none), wear (how much of it is gone), wood
// (the trim sheet's look), stone and mortar (the jail's palette and joints), seed (every random choice).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, buildGeometry, Occlusion } from '../materials/cabin.js';
import { rng, WOOD, WOOD_LOOKS } from '../materials/textures.js';
import { buildStoneWall, SHAPES, PALETTES, MORTARS } from '../stone/stonewall.js';
import { T, RX, RY, RZ, mul, vary, smooth01, ngon, wallOf, wallM, boardAndBatten, lapSiding, plankField, plankRoof, stovepipe, casing, roofSlope, lantern, glowGeometry, Light, GLOW, ropeGeometry } from './parts.js';
import { SHERIFF_ART, regionUV } from './art.js';

// ── the recipe ───────────────────────────────────────────────────────────────────────────────────────────────────────
// (one more of the Stone Lab's palettes, for the jail: the warm tan and grey fieldstone of the concept picture, its
// odd stone rust-brown; added to its list here, so the panel's picker offers it for any building)
// (grey-tan: its warm stones only a little warm, so none reads as a peach patch from the street)
if (!PALETTES.fieldstone) PALETTES.fieldstone = { label: 'Tan fieldstone', base: [0.53, 0.48, 0.41], second: [0.47, 0.46, 0.43], dark: [0.34, 0.33, 0.31], rust: [0.54, 0.46, 0.37] };
// paint colours are the paint itself (linear), before the weathering fades and wears it
export const PAINTS = {
  none: { label: 'None (bare wood)', c: null },
  ochre: { label: 'Faded ochre', c: [0.5, 0.29, 0.06] },
  red: { label: 'Faded barn red', c: [0.36, 0.085, 0.058] },
  green: { label: 'Faded green', c: [0.12, 0.2, 0.11] },
  blue: { label: 'Faded blue-grey', c: [0.17, 0.22, 0.27] },
  white: { label: 'Whitewash', c: [0.6, 0.58, 0.53] },
};
export const RECIPE_DEFAULTS = { kind: 'sheriff', paint: 'ochre', wear: 0.62, wood: 'straight', stone: 'fieldstone', mortar: 'grey', seed: 5 };
export function sheriffRecipe(r = {}) {
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
const XL = -4.75, XR = 1.25, OXC = (XL + XR) / 2;          // the office's side walls (outside faces), its middle
const ZF = 2.63, ZB = -5.5;                                // its front and back walls (outside faces)
const FL = 0.45;                                           // the office floor, and the boardwalk
const FT = 0.3, Y0 = FT - 0.05;                            // the stone footing's top; the siding's foot (lapped over it)
const EAVE = 4.0, WTOP = 4.16;                             // the side walls' plates; the siding's top (up into the roof boards)
const PITCH = 24 * Math.PI / 180, TP = Math.tan(PITCH);
const RIDGE = EAVE + (XR - XL) / 2 * TP;                   // 5.34
const ROOF0 = RIDGE + 0.17;                                // the roof boards' top at the ridge
const EO = 0.28, GO = 0.32;                                // the roof past the side walls; past the back wall
const CEIL = 3.55;                                         // the office's plank ceiling
// the false front: above the porch roof it runs out past the side walls (WING on the left, WINGR over the jail),
// hiding the main roof's front corners; its wings' feet: just over the porch roof (WINGY), just under the right eave
// (WINGRY); three steps: a0, a1, top
const WING = 0.38, WINGY = 3.52, WINGR = 0.4, WINGRY = 3.76;
const STEPS = [[XL - WING, -3.45, 5.05], [-3.45, -0.6, 6.15], [-0.6, XR + WINGR, 5.6]];
const PT = 3.45, PP = 12 * Math.PI / 180;                  // the porch roof: its top against the false front, pitch
const PD = 2.55, PZ = ZF + PD;                             // the boardwalk: how deep; its front edge
const POSTS = [XL + 0.12, -2.25, XR - 0.12];               // the porch posts (x)
const PART = -1.9;                                         // the partition between the office and the back room (z)
const INS = 0.12;                                          // the inside lining: how far in from the outside faces
// the jail: a stone block built onto the office's right side, set back half a metre from its front
const XJ = 5.0, JT = 0.45, ZJF = ZF - 0.5, ZJB = ZJF - 5.0, JH = 3.38, JCAP = 0.2, JX0 = XR - 0.05;
const JFL = 0.2, JCEIL = 3.0;                              // its plank floor; its ceiling (beams and planks under the slabs)
const JIN = { x0: XR, x1: XJ - JT, z0: ZJB + JT, z1: ZJF - JT };   // its inside
const BARS = JIN.z1 - 1.3;                                 // the cells' strap-iron front (z): a corridor in front of them
const CELLX = (JIN.x0 + JIN.x1) / 2;                       // the bars between the two cells (x)
const JDOOR = { u: 1.3, w: 0.95, h: 2.25 };                // the jail's door: along the front face from its start (JX0)
const JDX = JX0 + JDOOR.u;                                 // its middle (x)
const JWIN = { u: 2.85, w: 0.5, v0: 2.2, v1: 2.62 };       // the tiny barred window high in the front
const JBACK = [2.1, 3.75];                                 // a slot of a window high in the back wall of each cell (x)
export const SHERIFF = { XL, XR, ZF, ZB, FL, EAVE, RIDGE, CEIL, PZ, XJ, ZJF, ZJB, JH };

// the roof boards' underside over a point (x), and the shakes' top
const roofUnder = (x) => ROOF0 - Math.abs(x - OXC) * TP - 0.03;
const roofTop = (x) => ROOF0 + 0.05 - Math.abs(x - OXC) * TP;
const stepTop = (x) => { for (const [a, b, y] of STEPS) if (x >= a - 1e-6 && x <= b + 1e-6) return y; return STEPS[0][2]; };
// the porch roof's planks' underside over a point (z), and its rafters'
const porchUnder = (z) => PT - (z - (ZF + 0.045)) * Math.tan(PP);

// ── colours: tints on the trim sheet's strips (1 = the strip as drawn) ──────────────────────────────────────────────
const BARE = [1.1, 1.1, 1.12];            // the siding under the paint: weathered grey
const INNER = [1.12, 1.06, 0.97];         // the lining inside: pine gone grey-brown with age, kept from the sun
const TRIM = [0.95, 0.93, 0.92];          // casings, corner boards, the caps: bare weathered wood
const FRAME = [1.06, 0.96, 0.84];         // posts, beams, rafters, studs
const SHAKE = [0.74, 0.7, 0.66];
const ROOFB = [0.66, 0.6, 0.54];
const PORCHR = [0.9, 0.88, 0.86];         // the porch roof's planks: sun-greyed
const DECK = [1.0, 0.95, 0.9];            // the boardwalk
const FLOOR = [0.82, 0.71, 0.58];         // the floors: darker than the walls, worn
const DOORW = [1.0, 0.92, 0.84];
const DARKW = [0.62, 0.56, 0.5];          // the notice board, the jail's lining: old dark boards
const FURN = [0.82, 0.62, 0.46];          // furniture: oiled, darker, browner
const IRON = [0.85, 0.8, 0.76];
const TIN = [5.4, 6.8, 8.4];              // a stovepipe's tin and the flashing: grey (the dark iron is a warm brown-black)
const STRAPI = [0.8, 0.9, 1.08];          // the cells' iron: dark, a cool grey
const LIME = [1.6, 1.66, 1.72];           // whitewash, on the (warm) rubble picture: a cool white
const STRAP = [0.035, 0.032, 0.03];       // iron straps painted on the doors (one mesh with the planks)

// ── where water drips from (the grime streaks start there) and each corner's tint ──────────────────────────────────
const SILLS = [];
function topAt(x, z, y) {
  if (y !== undefined) for (const s of SILLS) if (Math.abs(x - s.x) < s.hw && Math.abs(z - s.z) < s.hd && y < s.y) return s.y;
  // the front wall: under the porch roof, or (the false front) under its caps
  if (z > ZF - 0.08 && z < ZF + 0.4 && x > XL - 0.2 && x < XR + 0.2) return y !== undefined && y < PT ? PT - 0.06 : stepTop(x) - 0.05;
  if (z > ZF + 0.4 && z < PZ + 0.5 && x > XL - 0.3 && x < XR + 0.1) return porchUnder(z) - 0.02;     // the porch
  if (x > XR + 0.05 && z > ZJB - 0.2 && z < ZJF + 0.2 && (y === undefined || y < JH + 0.1)) return JH - JCAP - 0.05;   // by the jail
  if (z < ZB + 0.08 && y !== undefined && y > EAVE - 0.1) return roofUnder(x) - 0.04;                  // the back gable
  return Math.max(EAVE + 0.1, roofUnder(x) - 0.04);
}
function tintAt(x, y, z, t, o) {
  if (o.fresh || o.roof) return t;
  if (o.inside) { const f = 0.82 + 0.22 * smooth01(y, 0, 3.2); return [t[0] * f, t[1] * f * 0.98, t[2] * f * 0.95]; }
  if (o.paint) { const f = smooth01(y, 0.4, 6); return [t[0] * (0.92 + 0.2 * f), t[1] * (0.92 + 0.26 * f), t[2] * (0.92 + 0.3 * f)]; }
  const f = smooth01(y, 0.3, 6), lum = t[0] * 0.3 + t[1] * 0.59 + t[2] * 0.11, g = 0.55;
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
// the decal pictures: planes over the boards, each a region of the sheriff's picture
const decals = [];
function pic(region, w, h, m) {
  const g = new THREE.PlaneGeometry(w, h, 2, 1), [u0, v0, u1, v1] = regionUV(region), U = g.attributes.uv;
  for (let i = 0; i < U.count; i++) U.setXY(i, u0 + (u1 - u0) * U.getX(i), v0 + (v1 - v0) * U.getY(i));
  g.applyMatrix4(m); decals.push(g); return g;
}

// ── walls ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// (each wall in its own frame: a runs to the right seen from outside: x on the front, -x on the back, -z on the right
// side, z on the left side)
const FRONT = wallOf(0, ZF), BACK = wallOf(Math.PI, -ZB), EAST = wallOf(Math.PI / 2, XR), WEST = wallOf(-Math.PI / 2, -XL);
const DOOR = { a0: -0.5, a1: 0.5, y0: FL - 0.1, y1: FL + 2.2, door: true };        // the office's front door
const WIN_F = { a0: -3.95, a1: -2.95, y0: 1.35, y1: 2.75 };                          // the front window
const NOTICE = { a0: -1.97, a1: -0.98, y0: 1.38, y1: 2.58 };                          // the notice board
const WIN_L1 = { a0: 0.0, a1: 1.0, y0: 1.35, y1: 2.6 }, WIN_L2 = { a0: -4.4, a1: -3.4, y0: 1.35, y1: 2.6 };   // left side (a = z)
const WIN_B = { a0: 2.2, a1: 3.1, y0: 1.4, y1: 2.6 };                                 // back (a = -x): x -3.1 .. -2.2
const DOOR_B = { a0: -0.95, a1: -0.05, y0: FL - 0.1, y1: FL + 2.1, door: true };     // the back door: x 0.05 .. 0.95
const DOOR_J = { a0: -1.45, a1: -0.55, y0: FL, y1: FL + 2.1, door: true };           // into the jail (right side, a = -z)

function walls(k, paint) {
  const sid = (o) => ({ paint, tint: BARE, inTint: INNER, bare: 0.04, ...o });
  // the front, from the boardwalk up to the false front's steps (the patched board low beside the door); its back
  // is drawn where it stands over the roof
  const wings = [{ a0: XL - WING - 0.01, a1: XL, y0: -1, y1: WINGY }, { a0: XR, a1: XR + WINGR + 0.01, y0: -1, y1: WINGRY }];
  lapSiding(k, FRONT, sid({ a0: XL - WING, a1: XR + WINGR, y0: FL - 0.06, tops: STEPS, opens: [DOOR, WIN_F, ...wings], origin: XL - WING, patch: [{ a: 0.85, y: 1.02 }], keepPaint: (a, y) => y > 3.7 && y < 4.9 && a > -4.4 && a < 1.0, backFrom: (a) => (a < XL + 0.02 || a > XR - 0.02 ? 3.4 : roofUnder(a) - 0.16) }));
  lapSiding(k, WEST, sid({ a0: ZB, a1: ZF, y0: Y0, tops: [[ZB, ZF, WTOP]], opens: [WIN_L1, WIN_L2], origin: ZB }));
  lapSiding(k, BACK, sid({ a0: -XR, a1: -XL, y0: Y0, tops: [[-XR, -XL, EAVE + 0.02]], opens: [WIN_B, DOOR_B], origin: -XR }));
  // the right side: full height in front of the jail and behind it; where the jail stands, only over its roof
  lapSiding(k, EAST, sid({ a0: -ZF, a1: -ZB, y0: Y0, tops: [[-ZF, -ZB, WTOP]], opens: [{ a0: -ZJF - 0.06, a1: -ZJB + 0.06, y0: -1, y1: JH - 0.04 }], origin: -ZF }));
  // the back gable over the plate line: boards and battens up to the roof, a belt board under them
  boardAndBatten(k, BACK, { a0: -XR, a1: -XL, y0: EAVE - 0.01, top: (a) => roofUnder(-a) + 0.012, apex: -OXC, paint, tint: BARE, inTint: null, rows: [4.7] });
  k.board([XR - XL + 0.04, 0.12, 0.03], null, null, { m: wallM(BACK, -OXC, EAVE + 0.02, 0.03), long: 0, tint: vary(k, TRIM, 0.85, 1.0), skip: '-z', outside: true });
  // the corner boards: on the front and back faces wide enough to cover the side walls' ends
  const cb = (w, a, y0, y1, wd = 0.15) => k.board([wd, y1 - y0, 0.03], null, null, { m: wallM(w, a, (y0 + y1) / 2, 0.035), long: 1, tint: vary(k, TRIM, 0.88, 1.05), skip: '-z-y', cuts: [-1.2, 0, 1.2].filter((c) => Math.abs(c) < (y1 - y0) / 2 - 0.3), segFaces: '+z', outside: true });
  // (each pair meets: the front or back one runs 5 cm past the side wall's face, the side one's end runs in under it)
  // (the pilasters: at the building's corners up to the wings, and up the wings' outer edges to the caps)
  cb(FRONT, XL + 0.03, FL - 0.06, PT - 0.06, 0.16); cb(FRONT, XR - 0.03, FL - 0.06, WINGRY + 0.06, 0.16);
  cb(FRONT, XL - WING + 0.08, WINGY, STEPS[0][2], 0.16); cb(FRONT, XR + WINGR - 0.08, WINGRY, STEPS[2][2], 0.16);
  cb(BACK, -XR + 0.03, Y0, EAVE + 0.12, 0.16); cb(BACK, -XL - 0.03, Y0, EAVE + 0.12, 0.16);
  // (the side walls' front corner boards stop under the false front's wings, which cover the corners above)
  cb(WEST, ZF - 0.045, Y0, WINGY - 0.02, 0.13); cb(WEST, ZB + 0.045, Y0, WTOP, 0.13);
  cb(EAST, -ZF + 0.045, 0.05, WINGRY - 0.02, 0.13); cb(EAST, -ZB - 0.045, Y0, WTOP, 0.13);
  // where the jail meets the office: a board over each joint, and the office's foot in front of the jail
  // (clear of the stones' bulges, over the siding's cut ends)
  cb(EAST, -ZJF - 0.1, 0.05, WTOP, 0.13); cb(EAST, -ZJB + 0.1, Y0, WTOP, 0.13);
  k.board([ZF - ZJF - 0.08, 0.22, 0.025], null, null, { m: wallM(EAST, -(ZF + ZJF) / 2, 0.15, 0.03), long: 0, tint: vary(k, TRIM, 0.8, 0.9), skip: '-z', outside: true });
  // the false front's side edges over the side walls: an end board over the boards' ends and the studs behind them
  // (and under each wing a soffit board, so it isn't hollow seen from below or behind)
  k.board([0.05, STEPS[0][2] - WINGY, 0.22], [XL - WING - 0.025, (STEPS[0][2] + WINGY) / 2, ZF - 0.07], null, { long: 1, tint: vary(k, TRIM, 0.85, 1.0), outside: true });
  k.board([WING + 0.04, 0.025, 0.2], [XL - WING / 2 + 0.02, WINGY + 0.0125, ZF - 0.08], null, { long: 0, tint: vary(k, TRIM, 0.75, 0.9), outside: true });
  k.board([0.05, STEPS[2][2] - WINGRY, 0.22], [XR + WINGR + 0.025, (STEPS[2][2] + WINGRY) / 2, ZF - 0.07], null, { long: 1, tint: vary(k, TRIM, 0.85, 1.0), outside: true });
  k.board([WINGR + 0.04, 0.025, 0.2], [XR + WINGR / 2 - 0.02, WINGRY + 0.0125, ZF - 0.08], null, { long: 0, tint: vary(k, TRIM, 0.75, 0.9), outside: true });
  // a plank step outside the back door
  k.board([1.1, 0.05, 0.42], [0.5, 0.22, ZB - 0.25], null, { long: 0, tint: vary(k, DECK, 0.85, 1.0) });
  for (const x of [0.05, 0.95]) k.board([0.1, 0.2, 0.38], [x, 0.1, ZB - 0.25], null, { long: 2, tint: vary(k, FRAME, 0.7, 0.85), skip: '-y' });
  // the openings' trim, and the windows
  casing(k, FRONT, { ...DOOR, y0: FL }, { tint: TRIM, depth: 0.19, width: 0.12 }); backing(k, FRONT, DOOR);
  casing(k, BACK, { ...DOOR_B, y0: FL - 0.1 }, { tint: TRIM, depth: 0.19, width: 0.1 }); backing(k, BACK, DOOR_B);
  windowIn(k, FRONT, WIN_F, 3); windowIn(k, WEST, WIN_L1, 3); windowIn(k, WEST, WIN_L2, 3); windowIn(k, BACK, WIN_B, 3);
}
// a six-pane window: casing, sill, the sash (two columns of three panes: glazing bars), the pane's glow; and inside: the
// sash seen from the room too, a casing round the opening on the lining, a stool and an apron under it, faintly tinted
// glass facing in
function windowIn(k, w, op, rows) {
  casing(k, w, op, { tint: TRIM, depth: 0.19 });
  backing(k, w, op);
  const wd = op.a1 - op.a0, h = op.y1 - op.y0, ac = (op.a0 + op.a1) / 2, yc = (op.y0 + op.y1) / 2;
  k.parts.glow.push({ size: [wd, h, 0], m: wallM(w, ac, yc, -0.05), pane: true, kind: GLOW.window, col: [1.8, 0.7, 0.18] });
  // the sash: a frame round the glass, a bar up the middle, bars across (both faces drawn)
  for (const s of [-1, 1]) k.board([0.055, h, 0.045], null, null, { m: wallM(w, ac + s * (wd / 2 - 0.0275), yc, -0.035), long: 1, tint: TRIM });
  for (const y of [op.y0 + 0.03, op.y1 - 0.03]) k.board([wd - 0.11, 0.06, 0.045], null, null, { m: wallM(w, ac, y, -0.035), long: 0, tint: TRIM });
  k.board([0.035, h - 0.1, 0.035], null, null, { m: wallM(w, ac, yc, -0.035), long: 1, tint: TRIM });
  for (let i = 1; i < rows; i++) k.board([wd - 0.11, 0.035, 0.035], null, null, { m: wallM(w, ac, op.y0 + 0.06 + (h - 0.12) * i / rows, -0.035), long: 0, tint: TRIM });
  panes.push(pane(wd - 0.04, h - 0.04, mul(wallM(w, ac, yc, -0.06), RY(Math.PI))));
  // inside: the casing on the lining's face (14 cm in), the stool, the apron
  const o = -INS - 0.03, cw = 0.09;
  for (const s of [-1, 1]) k.board([cw, h + cw, 0.02], null, null, { m: wallM(w, ac + s * (wd / 2 + cw / 2), yc + cw / 2, o), long: 1, tint: vary(k, INNER, 0.8, 0.9), skip: '+z', inside: true });
  k.board([wd + 2 * cw + 0.04, 0.1, 0.022], null, null, { m: wallM(w, ac, op.y1 + cw + 0.05, o), long: 0, tint: vary(k, INNER, 0.8, 0.9), skip: '+z', inside: true });
  k.board([wd + 2 * cw + 0.1, 0.032, 0.13], null, null, { m: wallM(w, ac, op.y0 - 0.016, o - 0.03), long: 0, tint: vary(k, INNER, 0.85, 0.95), inside: true });
  k.board([wd + 2 * cw, 0.08, 0.02], null, null, { m: wallM(w, ac, op.y0 - 0.08, o), long: 0, tint: vary(k, INNER, 0.8, 0.9), skip: '+z', inside: true });
  const c = new THREE.Vector3(ac, 0, w.d).applyMatrix4(RY(w.th));
  SILLS.push({ x: c.x + w.ox, z: c.z + w.oz, hw: Math.abs(Math.cos(w.th)) * (wd / 2 + 0.2) + 0.15, hd: Math.abs(Math.sin(w.th)) * (wd / 2 + 0.2) + 0.15, y: op.y0 - 0.06 });
}
// SHEATHING behind the siding round an opening: a lap siding row that crosses an opening's top or foot is cut away
// over the whole opening, leaving a strip between the opening and its trim; this board fills it (only seen there)
function backing(k, w, op) {
  // (both faces: the inside lining's rows are cut the same way, and from the room it shows through there too)
  const wd = op.a1 - op.a0 + 0.24, ac = (op.a0 + op.a1) / 2;
  k.board([wd, 0.27, 0.015], null, null, { m: wallM(w, ac, op.y1 + 0.135, -0.012), long: 0, tint: vary(k, BARE, 0.7, 0.8), outside: true });
  if (!op.door) k.board([wd, 0.27, 0.015], null, null, { m: wallM(w, ac, op.y0 - 0.135, -0.012), long: 0, tint: vary(k, BARE, 0.7, 0.8), outside: true });
}
// glass seen from inside: a plain plane (drawn faintly tinted, see-through, no light baked)
const panes = [];
function pane(w, h, m) { const g = new THREE.PlaneGeometry(w, h); g.applyMatrix4(m); return g; }
// the inside lining: plain boards, flat, across the inside of a wall from the floor to the ceiling, cut round its
// openings (the reveal boards of the casings line the openings through the wall)
function lining(k, w, a0, a1, y0, y1, opens, o = {}) {
  const bh = 0.24, tint = o.tint || INNER;
  for (let yb = y0; yb < y1 - 0.02; yb += bh) {
    const h = Math.min(bh, y1 - yb);
    let spans = [[a0, a1]];
    for (const op of opens) if (yb < op.y1 - 0.01 && yb + h > op.y0 + 0.01) spans = spans.flatMap(([s, e]) => (op.a1 <= s || op.a0 >= e ? [[s, e]] : [[s, op.a0], [op.a1, e]].filter(([p, q]) => q - p > 0.03)));
    for (const [s, e] of spans) {
      const cuts = []; for (let x = s + k.r(0.8, 3.0); x < e - 0.5; x += k.r(1.8, 3.4)) cuts.push(x);
      let cs = s;
      for (const ce of [...cuts, e]) {
        const len = ce - cs, ac = (cs + ce) / 2, cl = []; for (let c = -len / 2 + 1.4; c < len / 2 - 0.4; c += 1.4) cl.push(c);
        k.board([len + 0.003, h + 0.004, 0.02], null, null, { m: mul(wallM(w, ac, yb + h / 2, -INS - 0.01), RY(Math.PI)), long: 0, tint: vary(k, tint, 0.84, 1.12), strip: Math.floor(k.R() * 12), uShift: k.r(0, 1.2), skip: '-z+x-x+y-y', cuts: cl, segFaces: '+z', inside: true, hz: [-(ac - (o.origin ?? a0)), 2] });
        cs = ce;
      }
    }
  }
}

// ── the false front: its caps and cornices, the trim where it steps, the frame behind it ─────────────────────────────
function falseFront(k) {
  for (const [i, [a0, a1, y]] of STEPS.entries()) {
    // (the outer ends run past the wall; where a step meets a taller one the cap stops at its end board)
    const left = i === 0 ? 0.08 : STEPS[i - 1][2] > y ? -0.02 : 0.08, right = i === STEPS.length - 1 ? 0.08 : STEPS[i + 1][2] > y ? -0.02 : 0.08;
    const x0 = a0 - left, x1 = a1 + right, xc = (x0 + x1) / 2, L = x1 - x0;
    k.board([L, 0.05, 0.36], [xc, y + 0.025, ZF - 0.07], null, { long: 0, tint: vary(k, TRIM, 0.8, 0.95), cuts: [-L / 4, 0, L / 4], segFaces: '+y', outside: true });
    k.board([L - 0.02, 0.06, 0.07], [xc, y - 0.03, ZF + 0.05], null, { long: 0, tint: vary(k, TRIM, 0.75, 0.9), outside: true });              // the bed moulding
    k.board([a1 - a0 - (i === 0 ? 0.16 : 0.02) - (i === STEPS.length - 1 ? 0.16 : 0.02), 0.17, 0.028], [(a0 + (i === 0 ? 0.16 : 0) + a1 - (i === STEPS.length - 1 ? 0.16 : 0)) / 2, y - 0.145, ZF + 0.034], null, { long: 0, tint: vary(k, TRIM, 0.85, 1.0), skip: '-z', outside: true });   // the frieze
    // brackets under the cap's front, one every metre or so
    const nb = Math.max(1, Math.round((a1 - a0) / 1.1));
    for (let j = 0; j < nb; j++) {
      const bx = a0 + (a1 - a0) * (j + 0.5) / nb;
      k.board([0.07, 0.22, 0.1], [bx, y - 0.13, ZF + 0.068], null, { long: 1, tint: vary(k, TRIM, 0.7, 0.85), outside: true });
      k.board([0.07, 0.06, 0.06], [bx, y - 0.27, ZF + 0.048], null, { long: 1, tint: vary(k, TRIM, 0.7, 0.85), outside: true });
    }
    k.solid([a1 - a0, 0.08, 0.3], [(a0 + a1) / 2, y + 0.03, ZF - 0.07]);
  }
  // where a step stands over the next: a trim board up the front of its edge, an end board over the boards' ends
  for (let i = 0; i < STEPS.length - 1; i++) {
    const a = STEPS[i][1], lo = Math.min(STEPS[i][2], STEPS[i + 1][2]), hi = Math.max(STEPS[i][2], STEPS[i + 1][2]), s = STEPS[i][2] > STEPS[i + 1][2] ? -1 : 1;
    k.board([0.12, hi - lo + 0.03, 0.03], [a + s * 0.06, (hi + lo) / 2 + 0.015, ZF + 0.035], null, { long: 1, tint: vary(k, TRIM, 0.85, 1.0), skip: '-z', outside: true });
    k.board([0.035, hi - lo + 0.02, 0.22], [a - s * 0.0175, (hi + lo) / 2 + 0.01, ZF - 0.07], null, { long: 1, tint: vary(k, TRIM, 0.85, 1.0), outside: true });
  }
  // behind it, over the roof: studs every 0.6 m (where the nails are), a plate under each cap, two braces down to
  // the roof
  for (const a of [XL - WING + 0.04, ...Array.from({ length: 20 }, (_, i) => XL - WING + 0.6 * (i + 1)).filter((x) => x < XR + WINGR - 0.1), XR + WINGR - 0.04]) {
    const y0 = a < XL ? WINGY + 0.03 : a > XR ? Math.max(WINGRY + 0.03, roofTop(a) - 0.04) : roofTop(a) - 0.04, y1 = stepTop(a) - 0.05;
    if (y1 - y0 > 0.1) k.board([0.05, y1 - y0, 0.1], [a, (y0 + y1) / 2, ZF - 0.095], null, { long: 1, tint: vary(k, FRAME, 0.85, 1.05), skip: '-y+z', outside: true });
  }
  for (const [a0, a1, y] of STEPS) k.board([a1 - a0 - 0.02, 0.05, 0.1], [(a0 + a1) / 2, y - 0.075, ZF - 0.095], null, { long: 0, tint: vary(k, FRAME, 0.85, 1.0), skip: '+z+y', outside: true });
  for (const a of [-2.75, -0.95]) {
    const yA = stepTop(a) - 0.5, zA = ZF - 0.15, zB = ZF - 1.5, yB = roofTop(a) + (Math.abs(a - OXC) > 0 ? 0 : 0) + 0.02, L = Math.hypot(yA - yB, zA - zB), ang = Math.atan2(yA - yB, zA - zB);
    k.board([0.05, 0.1, L], [a, (yA + yB) / 2, (zA + zB) / 2], [-ang, 0, 0], { long: 2, tint: vary(k, FRAME, 0.8, 1.0) });
  }
}

// ── the stone footing under the office's left, back and right walls (the Stone Lab's wall maker, a U round them) ────
function footing(r, env) {
  const t = 0.3, G = -0.12;
  const loop = [[XR, ZJB], [XR, ZB], [XL, ZB], [XL, ZF], [XL + t, ZF], [XL + t, ZB + t], [XR - t, ZB + t], [XR - t, ZJB]];
  SHAPES.sheriffFoot = { label: 'Office footing', make: () => ({ H: FT, sections: [{ loop0: loop, loop1: loop, y0: G, y1: FT }], openings: [], top: { y: FT, t: 0, over: 0, rects: [] }, building: {} }) };
  const sw = buildStoneWall({ style: 'mortared', palette: r.stone, mortar: r.mortar, size: 0.42, irregularity: 0.5, colourMix: 0.5, bulge: 0.6, joint: 0.012, shape: 'sheriffFoot', seed: r.seed * 3 + 1 }, env);
  return [sw.stone, sw.mortar];
}

// ── the jail block: fieldstone outside only (the Stone Lab's wall maker) ──────────────────────────────────────────
// Its outline is the block's outside, run with the outside on the right, walked from above, the front face first:
// front, right side, back, and the side against the office (buried 5 cm in the office's wall, out of sight). It is laid
// as an outer skin of stone: inside, its walls are whitewashed (jailInside), so no stone is laid on the inside faces.
// Its openings go right through the skin (op.open) with nothing behind them.
function jailStone(r, env) {
  const loop = [[JX0, ZJF], [XJ, ZJF], [XJ, ZJB], [JX0, ZJB]];
  const G = -0.12, dz = (-DOOR_J.a1 - DOOR_J.a0) / 2;
  // (its stones laid long and flat, as fieldstone is: not the Stone Lab jail's round cobbles, which stood on end)
  SHAPES.sheriffJail = { label: 'Sheriff\'s jail', stones: { size: 0.75, round: false }, make: () => ({ H: JH,
    sections: [{ loop0: loop, loop1: loop, y0: G, y1: JH - JCAP }],
    steps: [{ face: 0, u: JDOOR.u, w: 1.45, depth: 0.42, h: 0.17 }],
    openings: [
      { face: 0, u: JDOOR.u, w: JDOOR.w, v0: G, v1: JDOOR.h, kind: 'door', open: true, depth: JT },
      { face: 0, u: JWIN.u, w: JWIN.w, v0: JWIN.v0, v1: JWIN.v1, kind: 'window', open: true, depth: JT },
      ...JBACK.map((x) => ({ face: 2, u: XJ - x, w: 0.4, v0: 2.25, v1: 2.6, kind: 'window', open: true, depth: JT })),
      // (the doorway from the office, through the skin's hidden side: wider and taller than the door, so its lining
      // stays behind the office's own casing and the jail's planks)
      { face: 3, u: dz - ZJB, w: (DOOR_J.a1 - DOOR_J.a0) + 0.24, v0: FL - 0.1, v1: DOOR_J.y1 + 0.12, kind: 'door', open: true, depth: 0.1 },
    ],
    top: { y: JH, t: JCAP, over: 0.11, rects: [{ x0: JX0, x1: XJ + 0.11, z0: ZJB - 0.11, z1: ZJF + 0.11, open: { x0: 0, x1: 1, z0: 1, z1: 1 }, ov: { x0: 0, x1: 0.11, z0: 0.11, z1: 0.11 } }] } }) };
  const sw = buildStoneWall({ style: 'mortared', palette: r.stone, mortar: r.mortar, size: 0.44, irregularity: 0.55, colourMix: 0.45, bulge: 0.75, joint: 0.013, mortarDepth: 0.02, shape: 'sheriffJail', seed: r.seed * 7 + 3 }, env);
  return { geos: [sw.stone, sw.mortar], stones: sw.stones, tris: sw.tris };
}
// a whitewashed wall inside the jail: plaster boxes (the rubble picture under the lime wash, as stone-style patches)
// round its holes. ax 'x': the wall runs along x at z = at, facing nz; ax 'z': along z at x = at, facing nx
function plasterWall(k, ax, at, face, a0, a1, y0, y1, holes) {
  const xs = [...new Set([a0, a1, ...holes.flatMap((h) => [h[0], h[1]])])].sort((p, q) => p - q);
  const ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h[2], h[3]])])].sort((p, q) => p - q);
  for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++) {
    const ac = (xs[i] + xs[i + 1]) / 2, yc = (ys[j] + ys[j + 1]) / 2;
    if (holes.some((h) => ac > h[0] && ac < h[1] && yc > h[2] && yc < h[3])) continue;
    const L = xs[i + 1] - xs[i] + 0.002, H = ys[j + 1] - ys[j] + 0.002, tint = vary(k, LIME, 0.93, 1.04).map((c, n) => c * (n === 2 ? 0.98 : 1) * (0.88 + 0.12 * smooth01(yc, 0.2, 1.4)));
    k.box('plaster', ax === 'x' ? [L, H, 0.03] : [0.03, H, L], ax === 'x' ? [ac, yc, at - face * 0.015] : [at - face * 0.015, yc, ac], null, { tint, skip: ax === 'x' ? (face > 0 ? '-z' : '+z') : (face > 0 ? '-x' : '+x') });
  }
  // (and the holes' reveals: plaster lining each one back to the stone's own lining)
  for (const [h0, h1, hy0, hy1] of holes) {
    const d = 0.12;
    for (const s of [h0, h1]) k.box('plaster', ax === 'x' ? [0.02, hy1 - hy0, d] : [d, hy1 - hy0, 0.02], ax === 'x' ? [s, (hy0 + hy1) / 2, at - face * d / 2] : [at - face * d / 2, (hy0 + hy1) / 2, s], null, { tint: LIME.map((c) => c * 0.9) });
    if (hy1 < y1 - 0.01) k.box('plaster', ax === 'x' ? [h1 - h0, 0.02, d] : [d, 0.02, h1 - h0], ax === 'x' ? [(h0 + h1) / 2, hy1, at - face * d / 2] : [at - face * d / 2, hy1, (h0 + h1) / 2], null, { tint: LIME.map((c) => c * 0.85) });
    if (hy0 > y0 + 0.01) k.box('plaster', ax === 'x' ? [h1 - h0, 0.02, d] : [d, 0.02, h1 - h0], ax === 'x' ? [(h0 + h1) / 2, hy0, at - face * d / 2] : [at - face * d / 2, hy0, (h0 + h1) / 2], null, { tint: LIME.map((c) => c * 0.95) });
  }
}
// the jail's solids for the bake (its walls less the openings, its roof), and what is fixed to it: the door frame and
// sill, the bars in its windows, the flashing where its roof meets the office
function jailParts(k) {
  const D0 = JDX - JDOOR.w / 2, D1 = JDX + JDOOR.w / 2, W0 = JX0 + JWIN.u - JWIN.w / 2, W1 = JX0 + JWIN.u + JWIN.w / 2, zc = ZJF - JT / 2;
  for (const [a, b] of [[JX0, D0], [D1, W0], [W1, XJ]]) k.solid([b - a, JH, JT], [(a + b) / 2, JH / 2, zc]);
  k.solid([D1 - D0, JH - JDOOR.h, JT], [JDX, (JH + JDOOR.h) / 2, zc]);
  k.solid([W1 - W0, JWIN.v0, JT], [(W0 + W1) / 2, JWIN.v0 / 2, zc]); k.solid([W1 - W0, JH - JWIN.v1, JT], [(W0 + W1) / 2, (JH + JWIN.v1) / 2, zc]);
  k.solid([JT, JH, ZJF - ZJB], [XJ - JT / 2, JH / 2, (ZJF + ZJB) / 2]);
  k.solid([XJ - JX0, 2.25, JT], [(XJ + JX0) / 2, 1.125, ZJB + JT / 2]); k.solid([XJ - JX0, JH - 2.6, JT], [(XJ + JX0) / 2, (JH + 2.6) / 2, ZJB + JT / 2]);
  k.solid([XJ - JX0 + 0.2, JCAP + 0.02, ZJF - ZJB + 0.2], [(XJ + JX0) / 2, JH - JCAP / 2, (ZJF + ZJB) / 2]);
  // the door's frame: oak jambs and head set in the opening, a sill block under the door
  for (const s of [-1, 1]) k.board([0.075, JDOOR.h - 0.02, 0.16], [JDX + s * (JDOOR.w / 2 - 0.0375), (JDOOR.h - 0.02) / 2, ZJF - 0.1], null, { long: 1, tint: vary(k, DARKW, 0.8, 0.95), skip: '-y' });
  k.board([JDOOR.w, 0.1, 0.16], [JDX, JDOOR.h - 0.05, ZJF - 0.1], null, { long: 0, tint: vary(k, DARKW, 0.8, 0.95) });
  k.board([JDOOR.w - 0.01, JFL + 0.12, JT - 0.02], [JDX, (JFL - 0.12) / 2, ZJF - JT / 2], null, { long: 0, tint: vary(k, DARKW, 0.75, 0.9), skip: '-y' });
  // iron bars in the windows (in the middle of the wall), a bar across each near its top and bottom
  const bars = (x0, x1, y0, y1, z, n) => {
    for (let i = 1; i <= n; i++) k.prism('iron', ngon(6, 0.012), y1 - y0 + 0.06, [x0 + (x1 - x0) * i / (n + 1), (y0 + y1) / 2, z], null, { tint: IRON, smooth: true });
    for (const y of [y0 + 0.06, y1 - 0.06]) k.box('iron', [x1 - x0 + 0.04, 0.03, 0.012], [(x0 + x1) / 2, y, z + 0.016], null, { tint: IRON });
  };
  bars(W0, W1, JWIN.v0, JWIN.v1, ZJF - JT / 2, 5);
  for (const x of JBACK) bars(x - 0.2, x + 0.2, 2.25, 2.6, ZJB + JT / 2, 4);
  // the flashing: a strip of tin up the office's wall and over the slabs, where the roof meets it
  k.box('iron', [0.012, 0.16, ZJF - ZJB + 0.12], [XR + 0.016, JH + 0.07, (ZJF + ZJB) / 2], null, { tint: TIN, skip: '-x' });
  k.box('iron', [0.18, 0.012, ZJF - ZJB + 0.12], [XR + 0.09, JH + 0.025, (ZJF + ZJB) / 2], null, { tint: TIN, skip: '-y' });
}

// ── the roofs ────────────────────────────────────────────────────────────────────────────────────────────────────────
function roofs(k) {
  const len = ((XR - XL) / 2 + EO) / Math.cos(PITCH);
  // (along the ridge: from past the back wall to just behind the false front's boards)
  const common = { x0: 0, x1: 0, topY: ROOF0, len, pitch: PITCH, shakeT: SHAKE, boardT: ROOFB, rafterT: FRAME, barge: true, every: 0.8, rows: 2.2, cap: true };
  // (a rake board up the back gable, seated on the roof's edge; none at the front, behind the false front)
  roofSlope(k, mul(T(OXC, 0, 0), RY(Math.PI / 2)), { ...common, x0: -(ZF - 0.05), x1: -(ZB - GO), rake: 'x1' });
  roofSlope(k, mul(T(OXC, 0, 0), RY(-Math.PI / 2)), { ...common, x0: ZB - GO, x1: ZF - 0.05, rake: 'x0' });
}

// ── the boardwalk and the porch roof ─────────────────────────────────────────────────────────────────────────────────
function porch(k) {
  const X0 = XL - 0.12, X1 = XR;
  // the deck: planks along the front, nailed to joists every 0.6 m; a rim along its front edge and ends; short
  // posts under the rim
  plankField(k, mul(T(0, FL, 0), RX(-Math.PI / 2)), { u0: X0, u1: X1, v0: -PZ, v1: -ZF, w: 0.16, t: 0.045, tint: DECK, nails: true, maxL: 3.4, step: 1.0 });
  k.board([X1 - X0 + 0.1, 0.24, 0.06], [(X0 + X1) / 2, FL - 0.13, PZ + 0.03], null, { long: 0, tint: vary(k, FRAME, 0.85, 1.0), strip: 10, cuts: [-2, 0, 2], segFaces: '+z', outside: true });
  for (const [x, s] of [[X0 - 0.03, -1], [X1 + 0.03, 1]]) k.board([0.06, 0.24, PD + 0.06], [x, FL - 0.13, ZF + PD / 2 + 0.03], null, { long: 2, tint: vary(k, FRAME, 0.85, 1.0), strip: 10, cuts: [-0.8, 0.8], segFaces: s > 0 ? '+x' : '-x', outside: true });
  for (const x of [X0 + 0.15, -3.3, -1.5, 0.9, X1 - 0.15]) k.board([0.14, FL - 0.22, 0.14], [x, (FL - 0.22) / 2, PZ - 0.1], null, { long: 1, tint: vary(k, FRAME, 0.7, 0.85), skip: '-y+y' });
  k.solid([X1 - X0, FL, PD], [(X0 + X1) / 2, FL / 2, ZF + PD / 2]);
  // the steps up to it, in front of the door: two treads, their risers, a stringer each side
  for (const [j, ty] of [[0, FL - 0.15], [1, FL - 0.3]].map(([a, b]) => [a, b])) {
    const z0 = PZ + 0.04 + j * 0.3;
    for (const dz of [0.08, 0.235]) k.board([1.7, 0.05, 0.15], [0, ty - 0.025, z0 + dz], [0, k.r(-0.01, 0.01), 0], { long: 0, tint: vary(k, DECK, 0.95, 1.1), cuts: [-0.4, 0.4], segFaces: '+y', hz: [dz, 2] });
    k.board([1.62, ty - 0.05, 0.025], [0, (ty - 0.05) / 2, z0 + 0.3 - 0.02], null, { long: 0, tint: vary(k, FRAME, 0.8, 0.95), skip: '-y+y' });
  }
  for (const s of [-1, 1]) { const ang = Math.atan2(FL - 0.05, 0.62); k.board([0.05, 0.2, Math.hypot(FL, 0.62) + 0.02], [s * 0.82, (FL - 0.05) / 2 - 0.04, PZ + 0.31], [ang, 0, 0], { long: 2, tint: vary(k, FRAME, 0.8, 0.95) }); }
  k.solid([1.7, 0.3, 0.6], [0, 0.15, PZ + 0.32]);
  // the porch roof: planks down the slope on rafters, from a ledger on the false front out past a beam on three posts
  const len = (PD + 0.37) / Math.cos(PP);
  // (on the left the roof runs out under the false front's wing, the beam carrying it out past the corner post; on the
  // right it stops at the office's corner, so the jail's door beside it stays in view)
  const R0 = XL - WING - 0.03, R1 = XR + 0.06;
  plankRoof(k, T(0, 0, ZF + 0.045), { x0: R0, x1: R1, topY: PT, len, pitch: PP, tint: PORCHR, rafterT: FRAME, every: 0.72 });
  k.board([R1 - R0, 0.16, 0.05], [(R0 + R1) / 2, PT - 0.205, ZF + 0.025], null, { long: 0, tint: vary(k, FRAME, 0.85, 1.0), strip: 10, cuts: [-2, 0, 2] });   // the ledger
  const zb = PZ - 0.1, beamTop = porchUnder(zb) - 0.12 / Math.cos(PP), beamBot = beamTop - 0.2;
  k.board([R1 - R0 - 0.06, 0.2, 0.15], [(R0 + R1) / 2, beamTop - 0.1, zb], null, { long: 0, tint: vary(k, FRAME, 0.95, 1.05), strip: 10, cuts: [-2.5, -1, 1, 2.5], segFaces: '+z-z-y', ends: 'log', outside: true });
  for (const [i, x] of POSTS.entries()) {
    const h = beamBot - FL;
    k.board([0.15, h, 0.15], [x, FL + h / 2, zb], [0, k.r(-0.04, 0.04), 0], { long: 1, tint: vary(k, FRAME, 0.9, 1.08), strip: 10 + (i % 2), cuts: [-0.6, 0.4], segFaces: '+x-x+z-z', skip: '-y', ends: 'log', outside: true });
    k.solid([0.15, h, 0.15], [x, FL + h / 2, zb]);
    // knee braces along the beam
    for (const s of [-1, 1]) {
      if ((i === 0 && s < 0) || (i === POSTS.length - 1 && s > 0)) continue;
      k.board([0.74, 0.08, 0.08], [x + s * 0.3, beamBot - 0.29, zb], [0, 0, s * Math.PI / 4], { long: 0, tint: vary(k, FRAME, 0.85, 1.0), strip: 11 });
    }
  }
}

// ── the front: the notice board and its posters, the lantern, the star, the bullet holes, the sign ──────────────────
function frontThings(k, lamps) {
  const A = SHERIFF_ART, z = ZF + 0.024;
  // the sign, painted straight onto the false front's boards
  // the notice board: dark planks in a frame, the posters on it
  const nb = NOTICE, nw = nb.a1 - nb.a0, nh = nb.y1 - nb.y0, nx = (nb.a0 + nb.a1) / 2, ny = (nb.y0 + nb.y1) / 2;
  for (let i = 0; i < 4; i++) k.board([nw / 4 - 0.004, nh - 0.08, 0.025], [nb.a0 + nw * (i + 0.5) / 4, ny, ZF + 0.035], null, { long: 1, tint: vary(k, DARKW, 0.75, 0.95), skip: '-z', outside: true });
  for (const s of [-1, 1]) {
    k.board([nw + 0.06, 0.06, 0.035], [nx, ny + s * (nh / 2 - 0.01), ZF + 0.045], null, { long: 0, tint: vary(k, TRIM, 0.8, 0.95), skip: '-z', outside: true });
    k.board([0.06, nh - 0.08, 0.035], [nx + s * (nw / 2), ny, ZF + 0.045], null, { long: 1, tint: vary(k, TRIM, 0.8, 0.95), skip: '-z', outside: true });
  }
  const pz = ZF + 0.05, R = rng(77);
  const paste = (reg, w, x, y, rot) => pic(reg, w, w * reg[3] / reg[2], mul(T(x, y, pz + R() * 0.002), RZ(rot)));
  // (crowded: older notices underneath, the two big posters over them, overlapping at all angles, some running off the
  // board's edges, a torn one and scraps of others; each a hair in front of the one before)
  let lay = 0;
  const paste2 = (reg, w, x, y, rot) => pic(reg, w, w * reg[3] / reg[2], mul(T(x, y, pz + (lay++) * 0.0012), RZ(rot)));
  paste2(A.notices[3], 0.24, nx - 0.3, ny + 0.48, -0.12); paste2(A.notices[1], 0.22, nx + 0.38, ny + 0.02, 0.09);
  paste2(A.posters[2], 0.33, nx - 0.06, ny - 0.12, 0.05); paste2(A.notices[2], 0.2, nx - 0.4, ny - 0.02, -0.07);
  paste2(A.posters[0], 0.37, nx - 0.22, ny + 0.24, 0.03); paste2(A.posters[1], 0.37, nx + 0.2, ny + 0.29, -0.05);
  paste2(A.notices[0], 0.23, nx - 0.31, ny - 0.33, 0.06); paste2(A.notices[1], 0.24, nx + 0.02, ny - 0.36, -0.03); paste2(A.notices[2], 0.22, nx + 0.33, ny - 0.27, 0.08);
  paste2(A.notices[3], 0.2, nx + 0.12, ny - 0.02, 0.2); paste2(A.notices[3], 0.17, nx + 0.46, ny + 0.45, -0.3);
  // (the torn one on the wall itself, between the window and the board; an older notice's scrap by the door)
  pic(A.posters[2], 0.38, 0.38 * A.posters[2][3] / A.posters[2][2], mul(T(-2.5, 1.95, ZF + 0.026), RZ(-0.04)));
  pic(A.notices[3], 0.22, 0.22 * A.notices[3][3] / A.notices[3][2], mul(T(-0.82, 1.55, ZF + 0.026), RZ(0.06)));
  // the bullet holes: by the door, one in its casing, one high in the false front
  for (const [x, y, zz, s] of [[0.78, 1.55, ZF + 0.026, 0.12], [1.0, 1.8, ZF + 0.026, 0.11], [0.7, 2.36, ZF + 0.026, 0.11], [0.62, 1.25, ZF + 0.056, 0.1], [-0.28, 5.28, ZF + 0.026, 0.13], [-2.9, 4.95, ZF + 0.026, 0.12]]) {
    pic(A.holes[Math.abs(x * 10 | 0) % 2], s, s, mul(T(x, y, zz), RZ(R() * 6)));
  }
  // the sheriff's star: five iron points round a boss, on the wall right of the door
  const sx = 0.9, sy = 2.06, sr = 0.17;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + i * Math.PI * 2 / 5, n1 = a - Math.PI / 5, n2 = a + Math.PI / 5, ri = sr * 0.42;
    const poly = [[0, 0], [Math.cos(n1) * ri, -Math.sin(n1) * ri], [Math.cos(a) * sr, -Math.sin(a) * sr], [Math.cos(n2) * ri, -Math.sin(n2) * ri]];
    k.prism('iron', poly, 0.018, [sx, sy, ZF + 0.03], [Math.PI / 2, 0, 0], { tint: [1.05, 0.95, 0.85] });
  }
  k.prism('iron', ngon(8, 0.035), 0.03, [sx, sy, ZF + 0.035], [Math.PI / 2, 0, 0], { tint: [1.2, 1.05, 0.85], smooth: true });
  // the lantern on an iron bracket over the gap between the board and the door
  lamps.push(lantern(k, -0.74, 2.95, ZF + 0.31, { bracket: [0, -0.28], strength: 1.5, outdoor: true }));
}

// ── the doors ────────────────────────────────────────────────────────────────────────────────────────────────────────
// the office's front door, in its own frame round its hinge (the leaf runs from x = 0 to side * w): stiles and rails,
// planks in its lower panel, a window of six panes in its upper one, strap hinges, a knob and its plate
function officeDoor(k, { w, h, side }) {
  const t = 0.05, st = 0.11, X = (x) => side * x;
  for (const x of [st / 2, w - st / 2]) k.board([st, h, t], [X(x), h / 2, 0], null, { long: 1, tint: vary(k, DOORW, 0.9, 1.05), cuts: [0], segFaces: '+z-z' });
  for (const [y, rh] of [[0.11, 0.22], [1.08, 0.16], [h - 0.07, 0.14]]) k.board([w - 2 * st, rh, t], [X(w / 2), y, 0], null, { long: 0, tint: vary(k, DOORW, 0.9, 1.05), skip: '+x-x' });
  const pw = (w - 2 * st) / 4;
  for (let i = 0; i < 4; i++) k.board([pw - 0.004, 1.0 - 0.22 + 0.02, t * 0.6], [X(st + pw * (i + 0.5)), (0.22 + 1.0) / 2, 0], null, { long: 1, tint: vary(k, DOORW, 0.85, 1.1), skip: '+y-y' });
  // the window: from the middle rail to the top rail, a bar up the middle and two across, the glass
  const wy0 = 1.16, wy1 = h - 0.14, ww = w - 2 * st;
  k.board([0.025, wy1 - wy0, 0.03], [X(w / 2), (wy0 + wy1) / 2, 0], null, { long: 1, tint: DOORW });
  for (const f of [1 / 3, 2 / 3]) k.board([ww, 0.025, 0.03], [X(w / 2), wy0 + (wy1 - wy0) * f, 0], null, { long: 0, tint: DOORW });
  k.parts.glow.push({ size: [ww, wy1 - wy0, 0], m: T(X(w / 2), (wy0 + wy1) / 2, 0.006), pane: true, kind: GLOW.window, col: [1.8, 0.7, 0.18] });
  k.parts.glow.push({ size: [ww, wy1 - wy0, 0], m: mul(T(X(w / 2), (wy0 + wy1) / 2, -0.006), RY(Math.PI)), pane: true, kind: GLOW.window, col: [1.8, 0.7, 0.18] });
  // strap hinges on the outside, the knob, its plate and keyhole
  for (const y of [0.32, h - 0.4]) k.board([w * 0.45, 0.045, 0.008], [X(w * 0.225), y, t / 2 + 0.004], null, { long: 0, paint: STRAP, tint: [0.4, 0.38, 0.36] });
  for (const s of [1, -1]) {
    k.board([0.05, 0.16, 0.008], [X(w - 0.07), 1.0, s * (t / 2 + 0.004)], null, { long: 1, paint: STRAP, tint: [0.4, 0.38, 0.36] });
    k.prism('wood', ngon(8, 0.026), 0.05, null, null, { m: mul(T(X(w - 0.07), 1.02, s * (t / 2 + 0.03)), RX(Math.PI / 2)), paint: [0.08, 0.06, 0.04], tint: [0.4, 0.38, 0.36], smooth: true });
  }
}
// the jail's door: heavy planks, three iron straps right across it riveted to them, long strap hinges, a little barred
// window, a ring to pull it by
function jailDoor(k, { w, h, side }) {
  const t = 0.06, X = (x) => side * x, np = 4;
  for (let i = 0; i < np; i++) k.board([w / np - 0.004, h, t], [X(w * (i + 0.5) / np), h / 2, 0], [0, 0, k.r(-0.003, 0.003)], { long: 1, tint: vary(k, DARKW, 0.75, 1.0), cuts: [-0.6, 0.6], segFaces: '+z-z', skip: '+x-x' });
  for (const s of [-1, 1]) k.board([0.012, h, t], [X(s > 0 ? w - 0.006 : 0.006), h / 2, 0], null, { long: 1, tint: DARKW, skip: '+z-z' });
  // (the window's hole: dark behind its bars)
  const wy = 1.48, wh = 0.2, wwd = 0.26;
  k.board([wwd, wh, 0.004], [X(w / 2), wy, t / 2 + 0.002], null, { long: 0, paint: [0.012, 0.011, 0.01], tint: [0.3, 0.3, 0.3] });
  for (let i = 1; i <= 3; i++) k.board([0.016, wh + 0.03, 0.016], [X(w / 2 - wwd / 2 + wwd * i / 4), wy, t / 2 + 0.012], null, { long: 1, paint: [0.05, 0.045, 0.04], tint: [0.4, 0.38, 0.36] });
  k.board([wwd + 0.06, 0.03, 0.01], [X(w / 2), wy + wh / 2 + 0.02, t / 2 + 0.006], null, { long: 0, paint: STRAP, tint: [0.4, 0.38, 0.36] });
  k.board([wwd + 0.06, 0.03, 0.01], [X(w / 2), wy - wh / 2 - 0.02, t / 2 + 0.006], null, { long: 0, paint: STRAP, tint: [0.4, 0.38, 0.36] });
  for (const [y, wd] of [[0.3, 0.075], [1.08, 0.075], [h - 0.32, 0.075]]) {
    k.board([w + 0.01, wd, 0.01], [X(w / 2), y, t / 2 + 0.005], null, { long: 0, paint: STRAP, tint: [0.4, 0.38, 0.36] });
    for (let i = 0; i < 5; i++) k.board([0.022, 0.022, 0.012], [X(0.06 + (w - 0.12) * i / 4), y, t / 2 + 0.012], null, { long: 0, paint: [0.06, 0.05, 0.045], tint: [0.4, 0.38, 0.36], skip: '-z' });
    // the strap hinge: a wider tongue at the hinge side, wrapping round the edge
    k.board([0.2, wd + 0.04, 0.012], [X(0.1), y, t / 2 + 0.008], null, { long: 0, paint: STRAP, tint: [0.4, 0.38, 0.36] });
  }
  // the ring pull and the keyhole plate, at the free side
  k.board([0.08, 0.14, 0.01], [X(w - 0.1), 1.0, t / 2 + 0.006], null, { long: 1, paint: STRAP, tint: [0.4, 0.38, 0.36] });
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; k.board([0.012, 0.034, 0.012], [X(w - 0.1) + Math.cos(a) * 0.045, 0.95 + Math.sin(a) * 0.045, t / 2 + 0.022], [0, 0, a], { long: 1, paint: [0.07, 0.06, 0.05], tint: [0.4, 0.38, 0.36] }); }
  k.board([0.015, 0.03, 0.004], [X(w - 0.1), 1.04, t / 2 + 0.012], null, { long: 1, paint: [0.005, 0.005, 0.005], tint: [0.3, 0.3, 0.3] });
}

// ── inside the office ────────────────────────────────────────────────────────────────────────────────────────────────
function officeInside(k, lamps) {
  const A = SHERIFF_ART, ix0 = XL + INS, ix1 = XR - INS, iz0 = ZB + INS, iz1 = ZF - INS;
  // the floor: planks front to back, nailed to the joists; the ceiling: planks across, a beam the lantern hangs from
  plankField(k, mul(T(0, FL, 0), RY(-Math.PI / 2), RX(-Math.PI / 2)), { u0: iz0 - 0.02, u1: iz1 + 0.02, v0: ix0 - 0.02, v1: ix1 + 0.02, w: 0.17, t: 0.03, tint: FLOOR, nails: true, maxL: 4.0, step: 1.6, extra: { inside: true } });
  plankField(k, mul(T(0, CEIL, 0), RY(-Math.PI / 2), RX(Math.PI / 2)), { u0: iz0, u1: iz1, v0: -ix1, v1: -ix0, w: 0.22, tint: INNER, maxL: 4.4, step: 2.0, extra: { inside: true } });
  k.solid([ix1 - ix0, 0.1, iz1 - iz0], [(ix0 + ix1) / 2, CEIL + 0.05, (iz0 + iz1) / 2]);
  k.solid([ix1 - ix0, 0.1, iz1 - iz0], [(ix0 + ix1) / 2, FL - 0.05, (iz0 + iz1) / 2]);
  for (const z of [0.55, -3.7]) k.board([ix1 - ix0, 0.16, 0.12], [(ix0 + ix1) / 2, CEIL - 0.08, z], null, { long: 0, tint: vary(k, FRAME, 0.85, 1.0), cuts: [-2, 0, 2], segFaces: '-y+z-z', ends: 'log', inside: true });
  // the lining, cut round every opening
  lining(k, FRONT, ix0, ix1, FL, CEIL, [{ ...DOOR, y0: FL }, WIN_F], { origin: XL });
  lining(k, WEST, iz0, iz1, FL, CEIL, [WIN_L1, WIN_L2], { origin: ZB });
  lining(k, BACK, -ix1, -ix0, FL, CEIL, [WIN_B, DOOR_B], { origin: -XR });
  lining(k, EAST, -iz1, -iz0, FL, CEIL, [DOOR_J], { origin: -ZF });
  // the partition to the back room: tongue-and-groove boards up to the ceiling, a doorway, a casing round it
  const pd = { x0: -0.65, x1: 0.25, y1: FL + 2.1 };
  for (const [a, b, y0] of [[ix0, pd.x0, FL], [pd.x0, pd.x1, pd.y1], [pd.x1, ix1, FL]]) for (let x = a; x < b - 0.02;) {
    let bw = Math.min(k.r(0.14, 0.17), b - x); if (b - x - bw < 0.06) bw = b - x;
    const xc = x + bw / 2;
    k.board([bw + 0.003, CEIL - y0, 0.025], [xc, (CEIL + y0) / 2, PART], null, { long: 1, tint: vary(k, INNER, 0.85, 1.1), skip: '+x-x+y' + (y0 > FL ? '' : '-y'), cuts: y0 > FL ? [] : [-0.8, 0.4], segFaces: '+z-z', inside: true });
    x += bw;
  }
  for (const s of [1, -1]) {
    const z = PART + s * 0.025;
    for (const x of [pd.x0 - 0.05, pd.x1 + 0.05]) k.board([0.1, pd.y1 - FL + 0.05, 0.02], [x, (pd.y1 + FL + 0.05) / 2, z], null, { long: 1, tint: vary(k, TRIM, 0.85, 1.0), inside: true, skip: '-y' });
    k.board([pd.x1 - pd.x0 + 0.2, 0.1, 0.02], [(pd.x0 + pd.x1) / 2, pd.y1 + 0.05, z], null, { long: 0, tint: vary(k, TRIM, 0.85, 1.0), inside: true });
  }
  for (const [x0, x1] of [[ix0, pd.x0], [pd.x1, ix1]]) k.solid([x1 - x0, CEIL - FL, 0.06], [(x0 + x1) / 2, (CEIL + FL) / 2, PART]);
  k.solid([pd.x1 - pd.x0, CEIL - pd.y1, 0.06], [(pd.x0 + pd.x1) / 2, (CEIL + pd.y1) / 2, PART]);
  // the inner door's reveal through the right wall, and its casing on the office side
  // (a wall frame facing into the office at the lining, a along +z: the door from z 0.55 to 1.45)
  casing(k, wallOf(-Math.PI / 2, -(XR - INS - 0.02)), { a0: -DOOR_J.a1, a1: -DOOR_J.a0, y0: FL, y1: DOOR_J.y1, door: true }, { tint: TRIM, depth: 0.25, width: 0.1 });
  k.board([0.2, 0.03, DOOR_J.a1 - DOOR_J.a0], [XR - 0.03, FL - 0.015, -(DOOR_J.a0 + DOOR_J.a1) / 2], null, { long: 2, tint: vary(k, FLOOR, 0.8, 0.9), inside: true });   // the threshold

  // THE DESK: a top with a moulded edge on two pedestals; the side toward the door closed, a panel with a raised frame;
  // on the sheriff's side three drawers in each pedestal, a shallow drawer over the knee-hole; papers, an inkwell, a lamp
  const dx = -2.4, dz = 0.15, dw = 1.5, dd = 0.75, dh = 0.76, y = FL;
  k.board([dw + 0.04, 0.035, dd + 0.04], [dx, y + dh - 0.0175, dz], null, { long: 0, tint: vary(k, FURN, 0.9, 1.0), inside: true });
  k.board([dw, 0.025, dd], [dx, y + dh - 0.047, dz], null, { long: 0, tint: vary(k, FURN, 0.7, 0.8), inside: true, skip: '+y' });
  for (const s of [-1, 1]) {
    const px = dx + s * (dw / 2 - 0.22);
    k.board([0.42, dh - 0.07, dd - 0.06], [px, y + (dh - 0.07) / 2, dz], null, { long: 1, tint: vary(k, FURN, 0.8, 0.9), inside: true, skip: '-y+y' });
    for (let j = 0; j < 3; j++) {
      k.board([0.36, 0.19, 0.02], [px, y + 0.13 + j * 0.21, dz - (dd / 2 - 0.02)], null, { long: 0, tint: vary(k, FURN, 0.95, 1.12), inside: true, skip: '+z' });
      k.box('iron', [0.07, 0.016, 0.02], [px, y + 0.15 + j * 0.21, dz - dd / 2], null, { tint: [1.4, 1.1, 0.65] });
    }
  }
  k.board([dw - 0.88, 0.1, 0.02], [dx, y + dh - 0.12, dz - (dd / 2 - 0.02)], null, { long: 0, tint: vary(k, FURN, 0.95, 1.1), inside: true, skip: '+z' });
  k.box('iron', [0.06, 0.016, 0.02], [dx, y + dh - 0.12, dz - dd / 2], null, { tint: [1.4, 1.1, 0.65] });
  // (the front: a panel right across, a raised frame on it, a plinth)
  const dfz = dz + dd / 2 - 0.01;
  k.board([dw - 0.02, dh - 0.07, 0.02], [dx, y + (dh - 0.07) / 2, dfz], null, { long: 0, tint: vary(k, FURN, 0.82, 0.9), inside: true, skip: '-z' });
  for (const [sx, sy, bw, bh] of [[0, dh - 0.12, dw - 0.16, 0.05], [0, 0.12, dw - 0.16, 0.05], [-(dw / 2 - 0.1), dh / 2, 0.05, dh - 0.24], [dw / 2 - 0.1, dh / 2, 0.05, dh - 0.24], [-0.27, dh / 2, 0.05, dh - 0.24], [0.27, dh / 2, 0.05, dh - 0.24]]) k.board([bw, bh, 0.015], [dx + sx, y + sy, dfz + 0.017], null, { long: bw > bh ? 0 : 1, tint: vary(k, FURN, 0.95, 1.08), inside: true, skip: '-z' });
  k.board([dw + 0.02, 0.07, 0.03], [dx, y + 0.035, dfz + 0.012], null, { long: 0, tint: vary(k, FURN, 0.7, 0.8), inside: true, skip: '-y' });
  k.solid([dw, dh, dd], [dx, y + dh / 2, dz]);
  pic(A.notices[0], 0.21, 0.27, mul(T(dx + 0.15, y + dh + 0.002, dz - 0.05), RX(-Math.PI / 2), RZ(0.3)));
  pic(A.notices[2], 0.21, 0.27, mul(T(dx + 0.38, y + dh + 0.003, dz + 0.05), RX(-Math.PI / 2), RZ(-0.2)));
  k.prism('iron', ngon(8, 0.03), 0.05, [dx - 0.25, y + dh + 0.025, dz + 0.15], null, { tint: [0.25, 0.25, 0.3], smooth: true });
  lamps.push(deskLamp(k, dx - 0.55, y + dh, dz + 0.05));
  // the sheriff's chair behind it
  chair(k, dx, dz - 0.62, 0.0);
  // a rug under it
  pic(A.rug, 1.35, 1.83, mul(T(dx, y + 0.004, dz - 0.25), RX(-Math.PI / 2), RZ(Math.PI / 2)));
  // THE GUN RACK on the partition: a back board, a notched rail low and a rail high, three rifles stood in it
  const gx = -3.55, gz = PART + 0.04;
  k.board([0.95, 1.25, 0.025], [gx, FL + 1.1, gz], null, { long: 0, tint: vary(k, FURN, 0.8, 0.9), inside: true });
  for (const [yy, d] of [[FL + 0.62, 0.12], [FL + 1.55, 0.09]]) k.board([0.95, 0.06, d], [gx, yy, gz + d / 2], null, { long: 0, tint: vary(k, FURN, 0.9, 1.0), inside: true });
  for (let i = 0; i < 3; i++) rifle(k, gx - 0.3 + i * 0.3, FL + 0.6, gz + 0.07, 0.06 * (i - 1));
  // THE STOVE: a pot-belly on four legs, its pipe up through the ceiling and the roof
  // (to the left of the door's line, behind the front wall, so it isn't the first thing seen from the street)
  const sx = -0.95, sz = -1.15;
  potBelly(k, sx, FL, sz);
  stovepipe(k, sx, sz, FL + 1.12, roofTop(sx) + 0.85, { r: 0.075, collarY: roofTop(sx) - 0.02, tint: TIN });
  k.prism('iron', ngon(8, 0.12), 0.02, [sx, CEIL - 0.01, sz], null, { tint: [0.6, 0.55, 0.5], smooth: true });
  k.box('iron', [0.7, 0.012, 0.7], [sx, FL + 0.006, sz], null, { tint: [0.7, 0.66, 0.6], skip: '-y' });
  // THE SAFE in the corner, the lock boxes on it
  const fx = ix0 + 0.36, fz = PART + 0.38;
  k.box('iron', [0.62, 0.78, 0.58], [fx, FL + 0.39, fz], null, { tint: [0.35, 0.42, 0.36], skip: '-y' });
  k.box('iron', [0.5, 0.62, 0.02], [fx, FL + 0.4, fz + 0.29], null, { tint: [0.3, 0.36, 0.31] });
  k.prism('iron', ngon(10, 0.05), 0.03, [fx + 0.1, FL + 0.48, fz + 0.31], [Math.PI / 2, 0, 0], { tint: [1.5, 1.2, 0.7], smooth: true });
  k.box('iron', [0.12, 0.025, 0.03], [fx - 0.12, FL + 0.4, fz + 0.31], null, { tint: [1.5, 1.2, 0.7] });
  k.solid([0.62, 0.78, 0.58], [fx, FL + 0.39, fz]);
  for (const [j, [w, d, h, rot]] of [[0.38, 0.26, 0.22, 0.1], [0.32, 0.22, 0.2, -0.15], [0.26, 0.18, 0.16, 0.25]].entries()) lockBox(k, fx + (j - 1) * 0.04, FL + 0.78 + [0, 0.22, 0.42][j], fz + 0.02, w, d, h, rot);
  // on the walls: the valley's map and a calendar on the left, the jail's rules by its door, pegs with a hat by the
  // front door
  // (the lining's face is 14 cm in from the outside faces: the pictures 5 mm proud of it)
  const lf = INS + 0.025;
  pic(A.map, 1.05, 0.75, mul(T(XL + lf, 2.05, 1.8), RY(Math.PI / 2)));
  pic(A.calendar, 0.34, 0.46, mul(T(XL + lf, 1.85, -0.65), RY(Math.PI / 2)));
  pic(A.rules, 0.36, 0.46, mul(T(XR - lf, 1.7, -0.15), RY(-Math.PI / 2)));
  k.board([0.6, 0.08, 0.02], [-1.25, 1.95, ZF - INS - 0.03], null, { long: 0, tint: vary(k, FURN, 0.9, 1.0), inside: true });
  for (const x of [-1.45, -1.25, -1.05]) k.board([0.025, 0.025, 0.09], [x, 1.94, ZF - INS - 0.08], [-0.3, 0, 0], { long: 2, tint: FURN, inside: true });
  hat(k, -1.45, 1.86, ZF - INS - 0.15);
  // THE BACK ROOM: a cot under the window, a wash stand, a trunk, a lantern on the wall
  cot(k, ix0 + 0.42, FL, -4.3);
  washStand(k, -2.65, FL, iz0 + 0.27);
  trunk(k, -1.0, FL, iz0 + 0.3);
  lamps.push(lantern(k, ix0 + 0.2, 2.2, -2.6, { bracket: [-0.18, 0], strength: 1.6 }));
  // the back door, shut: Z-braced planks
  const bd = DOOR_B;
  // (a little bigger than its opening, flush with the wall's face: it fills its frame)
  doorPlanks(k, mul(T(-bd.a0 + 0.02, FL - 0.1, ZB + 0.028), RY(Math.PI)), bd.a1 - bd.a0 + 0.04, bd.y1 - FL + 0.12);
  // and the hanging lantern over the desk
  lamps.push(lantern(k, -1.6, CEIL - 0.62, 0.55, { chain: 0.23, strength: 1.9 }));
}
// a kerosene lamp on a desk: a brass foot, a glass font, the chimney glowing, the flame in it
function deskLamp(k, x, y, z) {
  k.prism('iron', ngon(10, 0.07), 0.03, [x, y + 0.015, z], null, { tint: [1.5, 1.15, 0.6], smooth: true });
  k.prism('iron', ngon(10, 0.06), 0.1, [x, y + 0.08, z], null, { tint: [1.4, 1.1, 0.6], smooth: true, taper: -0.3 });
  k.prism('iron', ngon(10, 0.035), 0.03, [x, y + 0.145, z], null, { tint: [1.5, 1.15, 0.6], smooth: true });
  k.parts.glow.push({ size: [0.06, 0.16, 0.06], m: T(x, y + 0.24, z), kind: GLOW.glass, col: [0.9, 0.42, 0.1] });
  k.parts.glow.push({ size: [0.015, 0.04, 0.015], m: T(x, y + 0.19, z), kind: GLOW.flame, col: [9, 5.4, 1.6] });
  return { p: [x, y + 0.24, z], reach: 6.5, strength: 1.3 };
}
function chair(k, x, z, rot) {
  const M = mul(T(x, FL, z), RY(rot)), b = (s, p, r, o) => k.board(s, null, null, { ...o, m: mul(M, T(...p), r ? RX(r) : new THREE.Matrix4()), tint: vary(k, FURN, 0.85, 1.05), inside: true });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b([0.04, 0.45, 0.04], [sx * 0.2, 0.225, sz * 0.19], null, { long: 1, skip: '-y' });
  b([0.46, 0.04, 0.44], [0, 0.46, 0], null, { long: 0 });
  for (const sx of [-1, 1]) b([0.04, 0.5, 0.04], [sx * 0.2, 0.73, -0.2], -0.08, { long: 1 });
  for (const yy of [0.62, 0.8, 0.95]) b([0.4, 0.06, 0.02], [0, yy, -0.21 - (yy - 0.48) * 0.08], -0.08, { long: 0 });
  k.solid([0.46, 0.5, 0.44], null, null, mul(M, T(0, 0.25, 0)));
}
function rifle(k, x, y, z, lean) {
  const M = mul(T(x, y, z), RZ(lean), RX(-0.06)), b = (s, p, o) => k.board(s, null, null, { ...o, m: mul(M, T(...p)), inside: true });
  b([0.045, 0.32, 0.1], [0, 0.16, 0], { long: 1, tint: [0.75, 0.48, 0.3] });                     // the stock
  b([0.04, 0.16, 0.05], [0, 0.4, 0.01], { long: 1, tint: [0.75, 0.48, 0.3] });                     // the wrist
  k.box('iron', [0.05, 0.12, 0.05], null, null, { m: mul(M, T(0, 0.53, 0.01)), tint: [0.55, 0.5, 0.48] });   // the receiver
  k.box('iron', [0.02, 0.62, 0.022], null, null, { m: mul(M, T(0, 0.9, 0.0)), tint: [0.4, 0.4, 0.42] });     // the barrel
  b([0.035, 0.3, 0.04], [0, 0.75, 0.025], { long: 1, tint: [0.75, 0.48, 0.3] });                   // the fore-end
  k.box('iron', [0.012, 0.012, 0.09], null, null, { m: mul(M, T(0, 0.46, 0.06)), tint: [0.5, 0.48, 0.46] });  // the lever
}
function potBelly(k, x, y, z) {
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.box('iron', [0.04, 0.16, 0.04], [x + sx * 0.17, y + 0.08, z + sz * 0.17], [0, 0, sx * 0.12], { tint: [1.3, 1.3, 1.4] });
  const C = [1.55, 1.6, 1.75];                 // (cast iron: a dark grey, its round sides catching the light)
  k.prism('iron', ngon(10, 0.24), 0.04, [x, y + 0.18, z], null, { tint: C, smooth: true });
  k.prism('iron', ngon(10, 0.2), 0.22, [x, y + 0.31, z], null, { tint: C, smooth: true, taper: -0.4, skip: '-y' });
  k.prism('iron', ngon(10, 0.28), 0.26, [x, y + 0.55, z], null, { tint: C, smooth: true, taper: 0.3, skip: '-y' });
  k.prism('iron', ngon(10, 0.2), 0.18, [x, y + 0.77, z], null, { tint: C, smooth: true, taper: 0.25, skip: '-y' });
  k.prism('iron', ngon(10, 0.17), 0.04, [x, y + 0.88, z], null, { tint: [1.9, 1.9, 2.0], smooth: true });
  k.prism('iron', ngon(10, 0.12), 0.24, [x, y + 1.0, z], null, { tint: C, smooth: true, taper: 0.35 });
  // the fire door at the front, a glow through its grate
  k.box('iron', [0.18, 0.14, 0.03], [x, y + 0.42, z + 0.235], [-0.2, 0, 0], { tint: [1.9, 1.9, 2.0] });
  for (let i = 0; i < 3; i++) k.parts.glow.push({ size: [0.12, 0.012, 0.01], m: mul(T(x, y + 0.38 + i * 0.025, z + 0.255), RX(-0.2)), kind: GLOW.flame, col: [2.2, 0.75, 0.18] });
  k.solid([0.5, 1.0, 0.5], [x, y + 0.5, z]);
}
// a lock box: a little wooden chest bound in iron, a hasp and padlock (the game's lock boxes come here to be opened)
function lockBox(k, x, y, z, w, d, h, rot) {
  const M = mul(T(x, y, z), RY(rot));
  k.board([w, h * 0.7, d], null, null, { m: mul(M, T(0, h * 0.35, 0)), long: 0, tint: vary(k, FURN, 0.9, 1.15), inside: true });
  k.board([w, h * 0.3, d], null, null, { m: mul(M, T(0, h * 0.85, 0)), long: 0, tint: vary(k, FURN, 0.85, 1.05), inside: true });
  for (const s of [-1, 1]) k.box('iron', [0.025, h + 0.006, d + 0.006], null, null, { m: mul(M, T(s * (w / 2 - 0.05), h / 2, 0)), tint: [0.55, 0.5, 0.46] });
  k.box('iron', [0.05, 0.07, 0.015], null, null, { m: mul(M, T(0, h * 0.7, d / 2 + 0.006)), tint: [1.4, 1.1, 0.6] });
}
function hat(k, x, y, z) {
  const C = [0.42, 0.3, 0.2];
  k.prism('wood', ngon(12, 0.2), 0.012, [x, y, z], [0.25, 0, 0], { paint: C, tint: [0.5, 0.45, 0.4], smooth: true, inside: true });
  k.prism('wood', ngon(10, 0.1), 0.12, [x, y + 0.065, z - 0.015], [0.25, 0, 0], { paint: C.map((c) => c * 0.85), tint: [0.5, 0.45, 0.4], smooth: true, taper: 0.12, inside: true });
}
function cot(k, x, y, z) {
  const L = 1.9, W = 0.75, H = 0.42;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.board([0.05, H, 0.05], [x + sx * (W / 2 - 0.03), y + H / 2, z + sz * (L / 2 - 0.03)], null, { long: 1, tint: vary(k, FURN, 0.85, 1.0), inside: true, skip: '-y' });
  for (const s of [-1, 1]) k.board([0.04, 0.1, L], [x + s * (W / 2 - 0.02), y + H - 0.05, z], null, { long: 2, tint: vary(k, FURN, 0.85, 1.0), inside: true });
  k.board([W - 0.08, 0.04, L - 0.06], [x, y + H - 0.04, z], null, { long: 2, tint: [0.9, 0.85, 0.75], paint: [0.42, 0.38, 0.3], inside: true });
  pic(SHERIFF_ART.blanket, 1.3, W - 0.02, mul(T(x, y + H + 0.025, z + 0.25), RX(-Math.PI / 2), RZ(Math.PI / 2)));
  k.board([0.5, 0.1, 0.3], [x, y + H + 0.05, z - L / 2 + 0.25], null, { long: 0, tint: [0.9, 0.9, 0.9], paint: [0.62, 0.6, 0.55], inside: true });
  k.solid([W, H, L], [x, y + H / 2, z]);
}
function washStand(k, x, y, z) {
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.board([0.04, 0.78, 0.04], [x + sx * 0.3, y + 0.39, z + sz * 0.19], null, { long: 1, tint: vary(k, FURN, 0.85, 1.0), inside: true, skip: '-y' });
  k.board([0.7, 0.03, 0.46], [x, y + 0.79, z], null, { long: 0, tint: vary(k, FURN, 0.9, 1.05), inside: true });
  k.board([0.66, 0.02, 0.42], [x, y + 0.2, z], null, { long: 0, tint: vary(k, FURN, 0.85, 1.0), inside: true });
  k.prism('iron', ngon(12, 0.17), 0.08, [x, y + 0.845, z], null, { tint: [1.6, 1.55, 1.45], smooth: true, taper: -0.25 });
  k.prism('iron', ngon(10, 0.06), 0.24, [x + 0.22, y + 0.92, z + 0.08], null, { tint: [1.6, 1.55, 1.45], smooth: true, taper: 0.3 });
}
function trunk(k, x, y, z) {
  k.board([0.85, 0.42, 0.48], [x, y + 0.21, z], null, { long: 0, tint: vary(k, FURN, 0.8, 0.95), inside: true, skip: '-y' });
  k.board([0.87, 0.1, 0.5], [x, y + 0.47, z], null, { long: 0, tint: vary(k, FURN, 0.85, 1.0), inside: true });
  for (const s of [-1, 1]) k.box('iron', [0.04, 0.53, 0.51], [x + s * 0.3, y + 0.265, z], null, { tint: [0.5, 0.45, 0.42], skip: '-y' });
  k.solid([0.85, 0.5, 0.48], [x, y + 0.25, z]);
}
// a plank door, shut, in the frame M (its outside toward +z, its hinge side at x = 0, running +x): Z-braced
function doorPlanks(k, M, w, h) {
  into(k, M, (t) => {
    const np = Math.max(3, Math.round(w / 0.2)), pw = w / np;
    for (let i = 0; i < np; i++) t.board([pw - 0.004, h, 0.045], [pw * (i + 0.5), h / 2, 0], null, { long: 1, tint: vary(t, DOORW, 0.85, 1.1), skip: '+x-x', cuts: [0], segFaces: '+z-z' });
    for (const sgn of [1, -1]) for (const y of [0.3, h - 0.3]) t.board([w - 0.06, 0.14, 0.03], [w / 2, y, sgn * 0.0375], null, { long: 0, tint: vary(t, DOORW, 0.85, 1.0), skip: sgn > 0 ? '-z' : '+z' });
    for (const sgn of [1, -1]) { const ang = Math.atan2(h - 0.74, w - 0.2); t.board([Math.hypot(h - 0.74, w - 0.2) - 0.1, 0.13, 0.03], [w / 2, h / 2, sgn * 0.0375], [0, 0, ang], { long: 0, tint: vary(t, DOORW, 0.85, 1.0), skip: sgn > 0 ? '-z' : '+z' }); }
    for (const y of [0.3, h - 0.3]) t.board([w * 0.55, 0.045, 0.008], [w * 0.275, y, 0.06], null, { long: 0, paint: STRAP, tint: [0.4, 0.38, 0.36] });
  }, 9137);
  k.solid([w, h, 0.08], null, null, mul(M, T(w / 2, h / 2, 0)));
}

// ── inside the jail ──────────────────────────────────────────────────────────────────────────────────────────────────
function jailInside(k, lamps, props) {
  const A = SHERIFF_ART, { x0, x1, z0, z1 } = JIN;
  // the floor: planks across; the ceiling: heavy beams across, planks over them
  plankField(k, mul(T(0, JFL, 0), RX(-Math.PI / 2)), { u0: x0, u1: x1, v0: -z1, v1: -z0, w: 0.2, t: 0.04, tint: vary(k, FLOOR, 0.75, 0.85), nails: true, maxL: 3.4, step: 1.1, extra: { inside: true } });
  k.solid([x1 - x0, 0.1, z1 - z0], [(x0 + x1) / 2, JFL - 0.05, (z0 + z1) / 2]);
  plankField(k, mul(T(0, JCEIL + 0.12, 0), RX(Math.PI / 2)), { u0: x0, u1: x1, v0: z0, v1: z1, w: 0.24, t: 0.04, tint: vary(k, DARKW, 0.9, 1.0), maxL: 3.4, step: 1.1, extra: { inside: true } });
  for (let z = z0 + 0.35; z < z1 - 0.1; z += 0.72) k.board([x1 - x0, 0.2, 0.16], [(x0 + x1) / 2, JCEIL + 0.02, z], null, { long: 0, tint: vary(k, DARKW, 0.85, 1.05), cuts: [-1, 0, 1], segFaces: '-y+z-z', ends: 'log', inside: true });
  k.solid([x1 - x0, 0.12, z1 - z0], [(x0 + x1) / 2, JCEIL + 0.2, (z0 + z1) / 2]);
  // the office's wall, seen from the jail: lined with heavy dark planks, bound with strap iron; the door through it
  // (a step down into the jail, the heavy door standing open into the corridor)
  const dz0 = -DOOR_J.a1, dz1 = -DOOR_J.a0, dTop = DOOR_J.y1;
  for (const [a, b, ya] of [[z0, dz0, JFL], [dz0, dz1, dTop], [dz1, z1, JFL]]) for (let z = a; z < b - 0.02;) {
    let bw = Math.min(k.r(0.26, 0.32), b - z); if (b - z - bw < 0.08) bw = b - z;
    const zc = z + bw / 2, yb = JCEIL;
    k.board([0.05, yb - ya, bw - 0.004], [XR + 0.03, (ya + yb) / 2, zc], null, { long: 1, tint: vary(k, DARKW, 0.75, 1.0), skip: '-x+y-y', cuts: [-0.8, 0.5].filter((c) => Math.abs(c) < (yb - ya) / 2 - 0.2), segFaces: '+x', inside: true });
    z += bw;
  }
  k.board([0.04, FL - JFL, dz1 - dz0], [XR + 0.035, (FL + JFL) / 2, (dz0 + dz1) / 2], null, { long: 2, tint: vary(k, DARKW, 0.7, 0.85), skip: '-x', inside: true });   // under the doorway
  for (const yy of [0.55, 1.6, 2.65]) for (const [a, b] of (yy < dTop ? [[z0, dz0 - 0.02], [dz1 + 0.02, z1]] : [[z0, z1]])) if (b - a > 0.1) {
    k.box('iron', [0.01, 0.07, b - a], [XR + 0.06, yy, (a + b) / 2], null, { tint: [0.5, 0.46, 0.43], skip: '-x' });
  }
  k.board([0.4, 0.1, dz1 - dz0], [XR + 0.25, FL - 0.15, (dz0 + dz1) / 2], null, { long: 2, tint: vary(k, DARKW, 0.85, 1.0), inside: true });   // the step down
  // (the heavy door, hinged at the doorway's front side, stood open along the corridor)
  into(k, mul(T(XR + 0.08, FL - 0.02, dz1 - 0.02), RY(0.3)), (t) => jailDoor(t, { w: dz1 - dz0 - 0.04, h: dTop - FL - 0.02, side: 1 }), 4111);
  // the stone walls inside: lime-washed (the stone skin's openings come through them)
  const W0 = JX0 + JWIN.u - JWIN.w / 2, W1 = JX0 + JWIN.u + JWIN.w / 2;
  plasterWall(k, 'x', z1, -1, x0, x1, JFL, JCEIL + 0.13, [[JDX - JDOOR.w / 2, JDX + JDOOR.w / 2, JFL - 0.01, JDOOR.h], [W0, W1, JWIN.v0, JWIN.v1]]);
  plasterWall(k, 'z', x1, -1, z0, z1, JFL, JCEIL + 0.13, []);
  plasterWall(k, 'x', z0, 1, x0, x1, JFL, JCEIL + 0.13, JBACK.map((x) => [x - 0.2, x + 0.2, 2.25, 2.6]));
  // THE CELLS: a wall of iron bars across the jail behind the corridor, another between the two cells: round rods
  // 2.5 cm thick every 14 cm, flat straps across them on the corridor side; a door in each cell's front (the left one
  // standing open), a plank bunk on chains in each, a bucket. (The bars don't stop the light: no solid for the bake)
  const rod = (h, pos) => k.prism('iron', ngon(6, 0.0125), h, pos, null, { tint: STRAPI, smooth: true, skip: '+y-y' });
  // (the flat bars: 4 cm by 6 mm, a round rivet head where each crosses an upright)
  const FLAT = STRAPI.map((c) => c * 0.7);
  const strapB = (size, pos) => k.box('iron', size, pos, null, { tint: FLAT });
  // (a rivet head: a small square boss, only its face and top drawn: at 2 cm that is all anyone sees)
  const rivet = (pos, ax) => k.box('iron', ax === 'x' ? [0.017, 0.017, 0.008] : [0.008, 0.017, 0.017], pos, null, { tint: STRAPI.map((c) => c * 1.3), skip: ax === 'x' ? '-z+x-x-y' : '-x+z-z-y' });
  const bars = (ax, a0, a1, at, gaps) => {
    const inGap = (a) => gaps.some(([p, q]) => a > p - 0.04 && a < q + 0.04), ups = [];
    for (let a = a0 + 0.07; a < a1 - 0.04; a += 0.14) if (!inGap(a)) { ups.push(a); rod(JCEIL - JFL + 0.1, ax === 'x' ? [a, (JFL + JCEIL) / 2, at] : [at, (JFL + JCEIL) / 2, a]); }
    for (const y of [JFL + 0.12, 1.25, 2.25, JCEIL - 0.1]) {
      let spans = [[a0, a1]];
      for (const [p, q] of gaps) if (y < 2.2) spans = spans.flatMap(([s, e]) => (q <= s || p >= e ? [[s, e]] : [[s, p - 0.03], [q + 0.03, e]].filter(([u, v]) => v - u > 0.05)));
      for (const [s, e] of spans) {
        strapB(ax === 'x' ? [e - s, 0.04, 0.006] : [0.006, 0.04, e - s], ax === 'x' ? [(s + e) / 2, y, at + 0.0155] : [at + 0.0155, y, (s + e) / 2]);
        for (const a of ups) if (a > s && a < e) rivet(ax === 'x' ? [a, y, at + 0.0215] : [at + 0.0215, y, a], ax);
      }
    }
  };
  const doors = [[1.55, 2.3], [3.2, 3.95]];
  bars('x', x0 + 0.04, x1 - 0.02, BARS, doors);
  bars('z', z0 + 0.02, BARS - 0.02, CELLX, []);
  for (const [p, q] of doors) {
    // the door's frame: flat bars up each side and across the top
    for (const xx of [p - 0.03, q + 0.03]) k.box('iron', [0.05, 2.2 - JFL, 0.02], [xx, (2.2 + JFL) / 2, BARS + 0.005], null, { tint: STRAPI.map((c) => c * 0.85), skip: '-y' });
    k.box('iron', [q - p + 0.11, 0.05, 0.02], [(p + q) / 2, 2.2, BARS + 0.005], null, { tint: STRAPI.map((c) => c * 0.85) });
  }
  // the doors themselves: rods in a frame of flat bar; the left one open into the corridor, the right one shut, a
  // padlock on it
  const cellDoor = (M, w) => {
    const h = 2.17 - JFL - 0.04;
    for (let a = 0.08; a < w - 0.04; a += 0.14) k.prism('iron', ngon(6, 0.0115), h - 0.04, null, null, { m: mul(M, T(a, h / 2, 0)), tint: STRAPI, smooth: true, skip: '+y-y' });
    for (const y of [0.06, h / 2, h - 0.06]) k.box('iron', [w, 0.04, 0.006], null, null, { m: mul(M, T(w / 2, y, 0.0155)), tint: FLAT });
    for (const a of [0.015, w - 0.015]) k.box('iron', [0.03, h, 0.02], null, null, { m: mul(M, T(a, h / 2, 0.006)), tint: FLAT, skip: '-y' });
  };
  cellDoor(mul(T(doors[0][0], JFL + 0.03, BARS + 0.02), RY(-1.25)), doors[0][1] - doors[0][0]);
  cellDoor(T(doors[1][0], JFL + 0.03, BARS + 0.02), doors[1][1] - doors[1][0]);
  k.box('iron', [0.07, 0.09, 0.03], [doors[1][1] - 0.06, 1.15, BARS + 0.05], null, { tint: [0.9, 0.85, 0.8] });
  // the bunks: a plank shelf against the side wall, hung on two chains from the wall, a blanket on it
  for (const [bx, s] of [[x0 + 0.08, 1], [x1 - 0.02, -1]]) {
    const w = 0.7, L = 1.9, by = 0.62, bz = z0 + 0.15 + L / 2, cx = bx + s * w / 2;
    for (let j = 0; j < 3; j++) k.board([w / 3 - 0.005, 0.045, L], [bx + s * (w / 3) * (j + 0.5), by, bz], null, { long: 2, tint: vary(k, DARKW, 0.85, 1.1), cuts: [-0.5, 0.5], segFaces: '+y', inside: true });
    k.board([0.06, 0.08, L], [bx + s * 0.03, by - 0.06, bz], null, { long: 2, tint: vary(k, DARKW, 0.8, 0.95), inside: true });
    for (const dz of [-L / 2 + 0.12, L / 2 - 0.12]) {
      const p0 = [bx + s * (w - 0.04), by + 0.02, bz + dz], p1 = [bx + s * 0.02, by + 1.0, bz + dz];
      // (a chain: links 5 cm long, each turned a quarter round from the last, a little apart; an eye bolt in the wall)
      const d = [p1[0] - p0[0], p1[1] - p0[1]], len = Math.hypot(...d), ang = -Math.atan2(d[0], d[1]), n = Math.round(len / 0.052);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, M = mul(T(p0[0] + d[0] * t, p0[1] + d[1] * t, bz + dz), RZ(ang), RY(i % 2 ? Math.PI / 2 : 0));
        k.box('iron', [0.02, 0.048, 0.006], null, null, { m: M, tint: STRAPI.map((c) => c * 1.1), skip: '+y-y' });
      }
      k.prism('iron', ngon(6, 0.014), 0.03, [p1[0] - s * 0.005, p1[1] + 0.01, bz + dz], [0, 0, Math.PI / 2], { tint: STRAPI, smooth: true });
    }
    pic(A.blanket, 1.25, w - 0.08, mul(T(cx, by + 0.025, bz + 0.25), RX(-Math.PI / 2), RZ(Math.PI / 2)));
    k.solid([w, 0.1, L], [cx, by, bz]);
    props.push({ type: 'bucket', x: cx + s * 0.1, z: BARS - 0.45, y: JFL, inside: true });
  }
  // the corridor's little box stove, its pipe up through the slabs; a lantern hung from a beam by the office door
  const sx = 3.35, sz = (BARS + z1) / 2 + 0.05;
  for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.box('iron', [0.04, 0.18, 0.04], [sx + ax * 0.24, JFL + 0.09, sz + az * 0.16], null, { tint: [0.4, 0.38, 0.36] });
  k.box('iron', [0.58, 0.4, 0.42], [sx, JFL + 0.38, sz], null, { tint: [0.3, 0.29, 0.28] });
  k.box('iron', [0.62, 0.03, 0.46], [sx, JFL + 0.595, sz], null, { tint: [0.4, 0.38, 0.36] });
  k.box('iron', [0.16, 0.12, 0.02], [sx - 0.29, JFL + 0.38, sz], [0, Math.PI / 2, 0], { tint: [0.45, 0.42, 0.4] });
  k.parts.glow.push({ size: [0.01, 0.03, 0.12], m: T(sx - 0.305, JFL + 0.34, sz), kind: GLOW.flame, col: [3, 1.0, 0.25] });
  stovepipe(k, sx, sz, JFL + 0.61, JH + 0.9, { r: 0.07, collarY: JH + 0.02, tint: TIN });
  k.solid([0.6, 0.6, 0.45], [sx, JFL + 0.3, sz]);
  lamps.push(lantern(k, 1.9, 2.35, 0.81, { chain: JCEIL - 0.08 - 2.35 - 0.23, strength: 1.6 }));
  lamps.push(lantern(k, CELLX, 2.2, BARS + 0.35, { chain: JCEIL - 0.08 - 2.2 - 0.23 + 0.0, strength: 2.0 }));
}

// ── the props that go with it: each { type, x, y, z, rot, ... } ─────────────────────────────────────────────────────
function propList(extra) {
  return [
    { type: 'bench', x: -3.45, y: FL, z: ZF + 0.32, len: 1.8 },
    { type: 'barrel', x: -4.3, y: FL, z: ZF + 0.42 }, { type: 'crate', x: 0.82, y: FL, z: ZF + 0.38, rot: 0.15, size: 0.5 },
    { type: 'hitchrail', x: -3.25, z: PZ + 0.85, len: 2.8 }, { type: 'trough', x: -3.3, z: PZ + 1.65, len: 1.9 },
    { type: 'woodpile', x: 4.35, z: ZJF + 0.36, len: 1.05, rows: 4 }, { type: 'barrel', x: 3.35, z: ZJF + 0.42, h: 0.8 },
    { type: 'crate', x: 4.62, z: ZJF + 0.95, rot: -0.2 }, { type: 'plank', x: 3.85, z: ZJF + 0.01, len: 2.0, lean: 0.38 },
    { type: 'bucket', x: XJ + 0.4, z: -1.2 }, { type: 'barrel', x: XL - 0.55, z: -3.6 },
    ...extra,
  ];
}

// each board's own numbers for the shader (parts.js boardWear), per corner: x its nails (2, 3: lap siding, as built
// or turned over; 4: a plank, two across), y where along the wall its middle is (the nails line up on the studs), z how
// much more of its paint has gone: by the corners and the doors (handled and knocked), low down, by the street, and a
// little board by board
function boardAttr(geo, parts, seed) {
  const R = rng(seed * 97 + 5), of = geo.userData.partOf, P = geo.attributes.position, n = P.count, A = new Float32Array(n * 3);
  const per = parts.map(() => (R() < 0.3 ? 0.15 + 0.2 * R() : 0.08 * R()));
  const near = (d, r) => 1 - smooth01(d, 0, r);
  for (let i = 0; i < n; i++) {
    const Q = parts[of[i]], o = Q.o; if (!o.hz && !o.nail) continue;
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (o.hz) { A[i * 3] = 2 + o.hz[1]; A[i * 3 + 1] = o.hz[0]; } else { A[i * 3] = o.nail; A[i * 3 + 1] = Q.m.elements[13]; }
    if (!o.paint) continue;
    const corner = Math.min(Math.hypot(x - XL, z - ZF), Math.hypot(x - XR, z - ZF), Math.hypot(x - XL, z - ZB), Math.hypot(x - XR, z - ZB), 9);
    const door = Math.abs(z - ZF) < 0.2 ? Math.hypot(Math.max(0, Math.abs(x) - 0.5), Math.max(0, y - FL - 2.2)) : 9;
    A[i * 3 + 2] = per[of[i]] + 0.4 * near(corner, 1.2) + 0.35 * near(door, 0.9) + 0.2 * near(y - (Math.abs(z - ZF) < 0.2 ? FL : 0), 1.0);
  }
  geo.setAttribute('aBoard', new THREE.BufferAttribute(A, 3));
}

// ── build it all ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function buildSheriff(recipeIn = {}, env = {}) {
  const t0 = performance.now(), r = sheriffRecipe(recipeIn), paint = PAINTS[r.paint].c;
  const k = new Kit(r.seed); k.parts.glow = []; k.parts.rope = []; k.parts.plaster = [];
  SILLS.length = 0; decals.length = 0; panes.length = 0;
  const lamps = [], extraProps = [];
  const marks = [], mark = (name) => marks.push([name, k.parts.wood.length, k.parts.iron.length]);
  walls(k, paint); mark('walls'); falseFront(k); mark('falseFront'); roofs(k); mark('roofs'); porch(k); mark('porch');
  frontThings(k, lamps); mark('front'); officeInside(k, lamps); mark('office'); jailParts(k); mark('jailParts'); jailInside(k, lamps, extraProps); mark('jail');

  // the two doors that swing: the office's (hinged on its right, opening in) and the jail's (hinged on its left,
  // opening out); each its own kit and meshes
  const leaves = [];
  const leafOf = (group, hinge, side, w, h, open, build, seed) => {
    const lk = new Kit(seed); lk.parts.glow = [];
    build(lk, { w, h, side });
    const g = buildGeometry(lk.parts.wood, 'wood', rng(seed + 1), { topAt: () => 9, tintAt: (x, y, z, t, o) => tintAt(x, y, z, t, { ...o, outside: true }) });
    leaves.push({ group, geo: g, glass: glowGeometry(lk.parts.glow), hinge, open, closed: 0, parts: lk.parts.wood.length });
    k.solid([w, h, 0.08], null, null, mul(T(...hinge), RY(open), T(side * w / 2, h / 2, 0)));
  };
  leafOf('office', [DOOR.a1 - 0.01, FL + 0.005, ZF - 0.05], -1, DOOR.a1 - DOOR.a0 - 0.02, 2.19, -58 * Math.PI / 180, officeDoor, r.seed * 19 + 1);
  const jw = JDOOR.w - 0.15;
  leafOf('jail', [JDX - jw / 2, JFL + 0.005, ZJF - 0.09], 1, jw, JDOOR.h - 0.1 - JFL - 0.01, -100 * Math.PI / 180, jailDoor, r.seed * 19 + 2);

  // the kit's parts into meshes, one per material
  const R = rng(r.seed + 1), geos = {};
  for (const g of ['wood', 'iron']) geos[g] = buildGeometry(k.parts[g], g, R, { topAt, tintAt });
  boardAttr(geos.wood, k.parts.wood, r.seed);
  geos.glow = glowGeometry(k.parts.glow, (P) => P.kind !== GLOW.glass);
  geos.glass = glowGeometry(k.parts.glow, (P) => P.kind === GLOW.glass);
  geos.rope = ropeGeometry(k.parts.rope);
  const jail = jailStone(r, env), foot = footing(r, env);
  geos.stone = mergeGeometries([...jail.geos, ...foot]); geos.stone.userData.ownAO = true;
  for (const g of [...jail.geos, ...foot]) g.dispose();
  geos.decal = mergeGeometries(decals); for (const g of decals) g.dispose(); decals.length = 0;
  geos.pane = panes.length ? mergeGeometries(panes) : null; for (const g of panes) g.dispose(); panes.length = 0;
  // (the jail's whitewashed walls: the rubble picture, stone-style patches)
  geos.plaster = buildGeometry(k.parts.plaster, 'stone', rng(r.seed + 9), {});
  for (const g in geos) if (!geos[g]) delete geos[g];
  const msBuild = performance.now() - t0;

  // the bake: the voxel grid of the solids, then each mesh's corners
  const t1 = performance.now();
  const occ = new Occlusion(k.occ, 1.6, 0.08, { reach: 2.4, rays: 20, groundReach: 0.7 });
  const opening = (c, u, v, n, o = {}) => ({ c, u, v, n, ...o });
  const openings = [
    opening([0, FL + 1.1, ZF], [0.5, 0, 0], [0, 1.1, 0], [0, 0, 1], { front: true }),
    opening([-3.45, 2.05, ZF], [0.5, 0, 0], [0, 0.7, 0], [0, 0, 1]),
    opening([XL, 1.98, 0.5], [0, 0, 0.5], [0, 0.62, 0], [-1, 0, 0]), opening([XL, 1.98, -3.9], [0, 0, 0.5], [0, 0.62, 0], [-1, 0, 0]),
    opening([-2.65, 2.0, ZB], [0.45, 0, 0], [0, 0.6, 0], [0, 0, -1]),
    opening([JDX, 1.1, ZJF], [JDOOR.w / 2 - 0.08, 0, 0], [0, 0.95, 0], [0, 0, 1], { door2: true }),
    opening([JX0 + JWIN.u, (JWIN.v0 + JWIN.v1) / 2, ZJF], [JWIN.w / 2, 0, 0], [0, (JWIN.v1 - JWIN.v0) / 2, 0], [0, 0, 1]),
    ...JBACK.map((x) => opening([x, 2.42, ZJB], [0.2, 0, 0], [0, 0.17, 0], [0, 0, -1])),
  ];
  const inOffice = (x, y, z) => x > XL + 0.02 && x < XR - 0.02 && z > ZB + 0.02 && z < ZF - 0.02 && y > -0.5 && y < CEIL + 0.02;
  const inJail = (x, y, z) => x > JIN.x0 - 0.02 && x < JIN.x1 + 0.02 && z > JIN.z0 - 0.02 && z < JIN.z1 + 0.02 && y > -0.5 && y < JCEIL + 0.2;
  // THE SMALL ROOMS' FILL: lantern light bounced about in them (no direction, no shadow), so a cell or the back room is
  // a dim warm room and not a black box
  const fill = (x, y, z, nx, ny, nz) => {
    const px = x + nx * 0.08, py = y + ny * 0.08, pz = z + nz * 0.08;
    if (inJail(px, py, pz)) return (pz < BARS ? 0.1 : 0.06) * (1 - 0.3 * smooth01(py, 1.6, 3.0));
    if (inOffice(px, py, pz)) return (pz < PART ? 0.14 : 0.05) * (1 - 0.3 * smooth01(py, 1.8, 3.5));
    return 0;
  };
  // (a small office lit by a door and four windows: each counts for more than the stable's big doorways did)
  // (and the light bounced about in a small room off its floor and walls: a higher floor under the dark)
  const light = new Light(occ, { inside: (x, y, z) => inOffice(x, y, z) || inJail(x, y, z), fill, openings, lamps, base: 0.34, gain: 7.5 });
  const BAKED = ['wood', 'iron', 'stone', 'rope', 'decal', 'plaster'];
  for (const g of BAKED) if (geos[g]) light.bake(geos[g]);
  for (const L of leaves) {
    light.bake(L.geo, mul(T(...L.hinge), RY(L.open)), 'open');
    light.bake(L.geo, T(...L.hinge), 'closed');
  }
  // the doors: open (office), open2 (the jail's)
  light.setDoors = (open, open2) => {
    for (const g of BAKED) if (geos[g]) light.apply(geos[g], open, 'main', open2);
    for (const L of leaves) { const o = L.group === 'office' ? open : open2; light.apply(L.geo, open, o ? 'open' : 'closed', open2); }
  };
  light.setDoors(true, false);
  const msBake = performance.now() - t1;

  // centre the footprint (the left eave to the jail's slabs, the back eave to the steps): everything moves by OX, OZ
  const fx0 = XL - WING - 0.08, fx1 = XJ + 0.11, fz0 = ZB - GO, fz1 = PZ + 0.62, OX = -(fx0 + fx1) / 2, OZ = -(fz0 + fz1) / 2;
  for (const g in geos) geos[g].translate(OX, 0, OZ);
  for (const L of leaves) L.hinge = [L.hinge[0] + OX, L.hinge[1], L.hinge[2] + OZ];
  for (const L of lamps) { L.p = [L.p[0] + OX, L.p[1], L.p[2] + OZ]; if (L.glow) L.glow = [L.glow[0] + OX, L.glow[1], L.glow[2] + OZ]; }
  light.offset = [OX, OZ];
  const props = propList(extraProps); for (const p of props) { p.x += OX; p.z += OZ; }

  const counts = {}; let parts = 0;
  for (const g in k.parts) { counts[g] = k.parts[g].length; parts += counts[g]; }
  return {
    recipe: r, geos, doors: leaves, lamps, light, occ, props, offset: OX, offsetZ: OZ,
    anchors: {
      doorways: [{ name: 'office', centre: [OX, FL + 1.1, ZF + OZ], w: 1.0, h: 2.2, out: [0, 0, 1] }, { name: 'jail', centre: [JDX + OX, 1.1, ZJF + OZ], w: JDOOR.w, h: JDOOR.h, out: [0, 0, 1] },
        { name: 'back', centre: [0.5 + OX, FL + 1.0, ZB + OZ], w: 0.9, h: 2.1, out: [0, 0, -1] }],
      sign: { centre: [OXC + 0.05 + OX, 4.27, ZF + OZ], w: 5.2, h: 1.14 }, lanterns: lamps.map((L) => L.p),
      // (the painted sign's picture covers this much of the false front: the board shader lays it on, art.js paintedSign)
      signPaint: { x0: OXC + 0.05 - 2.8 + OX, y0: 3.6, w: 5.6, h: 1.4, z: ZF + OZ },
      footprint: { w: fx1 - fx0, d: fz1 - fz0, h: STEPS[1][2] + 0.05, x0: fx0 + OX, x1: fx1 + OX, z0: fz0 + OZ, z1: fz1 + OZ },
      street: [fx0 + OX - 1, fx1 + OX + 1, PZ + OZ, PZ + OZ + 8],
    },
    jail: { stones: jail.stones, tris: jail.tris },
    counts, parts, msBuild, msBake, ms: performance.now() - t0,
    marks, kit: k,
  };
}
