// THE SALOON: a two-storey timber saloon on a street corner, both street faces finished. Oxblood-red lap siding peeling
// to grey wood, cream trim and pilasters; a tall false front on each street face with a bracketed cornice and "SALOON"
// painted big across it in cream (the main front, facing +z, the taller; the side front, facing -x, stepping down, a
// stone chimney behind it); six-pane windows upstairs with lace curtains and lamplight. A raised plank boardwalk on
// blocks wraps the corner under one continuous balcony, which sits on the porch roof: turned posts with curved knee
// brackets below, a railing of turned balusters and ball-topped newel posts above. On each street face a wide doorway
// with a pair of louvred batwing doors and a lantern hung over it, and big display windows with SALOON in gold leaf on
// the glass. After Dad's concept pictures (outside and inside).
//
// Laid out to be walked into: a double-height hall. A long dark bar down the left (the side street's wall) with a brass
// foot rail, stools, brass tap towers and glass lamps on its top; behind it a tall back-bar with an arched mirror,
// shelves of bottles (sarsaparilla, root beer, cream soda: it is a soda saloon) and sconces. The upper floor is a real
// floor: a U of galleries round the hall's double-height well (across the back, up the side over the bar, across the
// front; turned balusters, turned newels), reached by a wide staircase up the right wall, and seven rooms behind the
// galleries' walls, each with its own hinged door (shut for now) and the street windows that look into it, a bed, a
// washstand, a chair and a rag rug (ROOMS; anchors.upstairs). Under the gallery, centred at the back, a raised stage for the town's band: red velvet
// drapes, a fringed valance, footlights along its front, the upright piano at its right. Round tables with spindle-back
// chairs and little lamps, a wagon-wheel chandelier, red damask wallpaper over a dark wainscot, framed pictures. At the
// front right, by the foot of the stairs, a chalkboard on an easel: the graph teacher's spot.
//
//   buildSaloon(recipe, env) -> {
//     geos      { wood, iron, stone, glow, glass, pane, decal, goods }   one mesh each (decal: everything painted, pasted
//               or hung flat (the signs, posters, lace, the bottles on their shelves); goods: what wears the saloon's
//               picture round it (wallpaper, velvet, the mirror, the chalkboard): saloonprops.js SALOON_ART)
//     doors     the four batwing leaves: { geo, iron, hinge, open, group: 'batwing', side, w, d0 } (their own meshes, each
//               turned about its hinge)
//     props     [{ type, x, y, z, rot, ... }]: tables, chairs, stools, the piano and its stool, barrels, the bench, the
//               hitching rail and the trough, as separate pieces (props.js + saloonprops.js build them)
//     lamps     [{ p, reach, strength, outdoor?, dir? }]   light (the baked light)
//     anchors   doorways (both, with which way is out), the signs, the stage's spots (in the same form as the game's
//               src/stage.js STAGE: the piano stool's middle on the stage floor and the way the keys face from it, the
//               harmonica player's spot), the chalkboard's teacher and player spots, the bar, the footprint, the streets
//     batwings  THE DOORS' HOOK: batwings.update(dt, bodies) swings the leaves: bodies [{ x, z, r }] (the saloon's frame,
//               metres: anyone near a door: the player, townsfolk, horses) push the leaves they overlap out of their way
//               (each leaf double-acting, either way), and once clear a leaf swings back on its spring, past shut and
//               back, slower each time. batwings.angles[i] is leaf i's turn (radians about its hinge, three's
//               rotation.y). The game would call it every frame for a saloon in view and set each leaf mesh's
//               rotation.y; batwings.held = true keeps them hooked open
//     walker    the lab's walker: a plain wooden figure who walks in at one door and out at the other and round the
//               corner, so the doors are seen swinging (walker.on)
//     tick(dt)  what the lab calls every frame: the walker, then batwings.update with it
//   }
// The footprint is centred on x = z = 0, the ground at y = 0, the main front faces +z and the side street's front faces
// -x (the corner where they meet is the front left one). Metres. Today's town saloon is 11.9 x 13.5 m; this one, with its
// wrapped boardwalk and steps, is 13.1 x 15.4 m (the building itself 9.6 x 12 m), 10.6 m to the top of the main false
// front.
//
// A RECIPE is what makes one saloon its own: paint (the walls' colour), trim (the trim's), wear (how much paint has
// gone), wood (the trim sheet's look), stone and mortar (the footing and chimney), seed (every random choice).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, buildGeometry, Occlusion } from '../materials/cabin.js';
import { rng, WOOD_LOOKS } from '../materials/textures.js';
import { buildStoneWall, SHAPES, PALETTES, MORTARS } from '../stone/stonewall.js';
import { T, RX, RY, RZ, mul, vary, smooth01, ngon, wallOf, wallM, boardAndBatten, lapSiding, plankField, roofSlope, lantern, glowGeometry, Light, GLOW, animalLamps } from './parts.js';
import { regionUV } from './art.js';
import { Goods } from './goods.js';
import { SALOON_ART as A, makeSaloonArt } from './saloonprops.js';
export { makeSaloonArt };

// ── the recipe ───────────────────────────────────────────────────────────────────────────────────────────────────────
if (!PALETTES.fieldstone) PALETTES.fieldstone = { label: 'Tan fieldstone', base: [0.53, 0.48, 0.41], second: [0.47, 0.46, 0.43], dark: [0.34, 0.33, 0.31], rust: [0.54, 0.46, 0.37] };
// (paint colours are the paint itself, linear, before the weathering fades and wears it)
export const PAINTS = {
  oxblood: { label: 'Weathered oxblood', c: [0.25, 0.048, 0.034] },
  red: { label: 'Faded barn red', c: [0.36, 0.085, 0.058] },
  ochre: { label: 'Faded ochre', c: [0.5, 0.29, 0.06] },
  green: { label: 'Faded green', c: [0.12, 0.2, 0.11] },
  blue: { label: 'Faded blue-grey', c: [0.17, 0.22, 0.27] },
  white: { label: 'Whitewash', c: [0.6, 0.58, 0.53] },
  none: { label: 'None (bare wood)', c: null },
};
export const TRIMS = {
  cream: { label: 'Cream', c: [0.6, 0.52, 0.35] },
  white: { label: 'White', c: [0.64, 0.63, 0.58] },
  green: { label: 'Bottle green', c: [0.05, 0.11, 0.06] },
  brown: { label: 'Chocolate', c: [0.11, 0.055, 0.032] },
  none: { label: 'None (bare wood)', c: null },
};
// (its wood the calm straight grain: the rustic look's big knot on every board read as spots on every plank)
export const RECIPE_DEFAULTS = { kind: 'saloon', paint: 'oxblood', trim: 'cream', wear: 0.6, wood: 'straight', stone: 'fieldstone', mortar: 'grey', seed: 9 };
export function saloonRecipe(r = {}) {
  const o = { ...RECIPE_DEFAULTS };
  if (PAINTS[r.paint]) o.paint = r.paint;
  if (TRIMS[r.trim]) o.trim = r.trim;
  if (Number.isFinite(+r.wear)) o.wear = Math.min(1, Math.max(0, +r.wear));
  if (WOOD_LOOKS[r.wood]) o.wood = r.wood;
  if (PALETTES[r.stone]) o.stone = r.stone;
  if (MORTARS[r.mortar]) o.mortar = r.mortar;
  if (Number.isFinite(+r.seed)) o.seed = Math.max(1, Math.round(+r.seed));
  return o;
}

// ── the sizes (built in its own frame; everything moves by the footprint's centring at the end) ─────────────────────
const XL = -4.8, XR = 4.8, ZF = 6.0, ZB = -6.0;            // the walls' outside faces: the side street's (XL), the main front (ZF)
const FL = 0.55;                                           // the floor, the boardwalk
const FT = 0.34, Y0 = FT - 0.05;                           // the stone footing's top (east and back); the siding's foot there
const U1 = 4.3, UJ = 4.05;                                 // the upper floor's top (the gallery, the balcony); its joists' foot
const EAVE = 7.5, WTOP = 7.66, CEIL = 7.25;                // the side walls' plates; the siding's top; the hall's ceiling
const PITCH = 18 * Math.PI / 180, TP = Math.tan(PITCH);
const RIDGE = EAVE + XR * TP, ROOF0 = RIDGE + 0.17;        // the roof's ridge runs front to back down the middle (x = 0)
const EO = 0.28, GO = 0.3;                                 // the roof past the east wall; past the back
// the false fronts: the main one level at TOPA, running out past the east wall (a wing over the east eave); the side
// one in two steps (the corner end taller), running out past the back (a wing over the back gable's overhang)
const TOPA = 10.5, TOPB1 = 9.75, TOPB2 = 9.3, BSTEP = 2.2;
const WINGA = 0.32, WINGAY = 7.3, WINGB = 0.32, WINGBY = 7.3;
// the boardwalk and the balcony over it: PD deep along both street faces, wrapping the corner
const PD = 2.2, PZ = ZF + PD, PX = XL - PD;
const DECK = U1, JOIST = 0.16, BEAMT = U1 - 0.045 - JOIST, BEAMB = BEAMT - 0.2;
const PA = [PX + 0.12, -4.65, -1.55, 1.55, XR + 0.06];      // the posts along the main front (x), at z = PZ - 0.12
const PB = [5.3, 2.6, -0.05, -2.75, ZB + 0.12];            // along the side (z), at x = PX + 0.12 (the corner post is PA[0])
// inside: the gallery's edge and the partition with its doors; the stage under it; the stairs up the east wall
const INS = 0.12, IX0 = XL + INS, IX1 = XR - INS, IZ0 = ZB + INS, IZ1 = ZF - INS;
const ZG = -2.4, ZP = -3.7, GPX = 2.55;
const STG = FL + 0.6, SX0 = -2.4, SX1 = 2.4, SZ0 = IZ0, SZ1 = -2.75;
const SR = 18, STX0 = IX1 - 1.25, STX1 = IX1, STZ0 = 1.9, RISE = (U1 - FL) / SR, RUN = (STZ0 - ZG) / (SR - 1);
// the bar: its front face (x), its depth and height, its run (z); the back-bar against the wall
const BXF = -2.45, BD = 0.7, BH = 1.12, BZ0 = -0.6, BZ1 = 4.1, BBD = 0.56, BBZ0 = -0.35, BBZ1 = 3.85;
// the chalkboard on its easel, facing the main door
const CB = { x: 2.75, z: 3.05, face: Math.atan2(-0.6, 0.8) };
export const SALOON = { XL, XR, ZF, ZB, FL, U1, EAVE, RIDGE, CEIL, TOPA, TOPB1, TOPB2, PD, PZ, PX, ZG, ZP, STG };

// the roof's underside over a point, and its top; a false front's top at a spot along the side
const roofUnder = (x) => ROOF0 - Math.abs(x) * TP - 0.03;
const roofTop = (x) => ROOF0 + 0.05 - Math.abs(x) * TP;
const topB = (a) => (a > BSTEP ? TOPB1 : TOPB2);

// ── colours: tints on the trim sheet's strips (1 = the strip as drawn) ──────────────────────────────────────────────
const BARE = [1.12, 1.1, 1.08];           // the siding under the paint: weathered grey
const BACKS = [1.0, 0.94, 0.86];          // the false fronts' backs: bare boards
const TRIMW = [1.0, 0.97, 0.94];          // the trim's wood under its paint
const FRAME = [1.06, 0.96, 0.86];         // posts, beams, joists, studs
const SHAKE = [0.74, 0.7, 0.66];
const ROOFB = [0.66, 0.6, 0.54];
const DECKC = [1.0, 0.95, 0.9];           // the boardwalk and the balcony's deck
const FLOOR = [1.0, 0.74, 0.5];         // the hall's floor: warm, darker, worn pale where people walk (tintAt)
const WAIN = [0.78, 0.52, 0.34];          // the wainscot and the woodwork inside: dark stained pine
const DARKW = [0.6, 0.38, 0.24];           // the bar, the back bar: dark wood (and a varnish on the tops)
const VARN = [0.085, 0.035, 0.018];       // that varnish (paint: satin)
const CEILC = [0.82, 0.62, 0.44];         // the ceiling boards
const DOORW = [1.0, 0.9, 0.78];
const IRON = [0.85, 0.8, 0.76], BRASS = [1.5, 1.15, 0.6], TIN = [5.4, 6.8, 8.4];

// ── where water drips from (the grime streaks start there) and each corner's tint ──────────────────────────────────
const SILLS = [];
const inPorch = (x, z) => (z > ZF - 0.12 && z < PZ + 0.3 && x > PX - 0.3 && x < XR + 0.45) || (x < XL + 0.12 && x > PX - 0.3 && z > ZB - 0.3 && z < PZ + 0.3);
function topAt(x, z, y) {
  if (y !== undefined) for (const s of SILLS) if (Math.abs(x - s.x) < s.hw && Math.abs(z - s.z) < s.hd && y < s.y) return s.y;
  if (inPorch(x, z) && (y === undefined || y < DECK)) return BEAMB - 0.02;                 // under the balcony
  if (z > ZF - 0.1 && z < PZ + 0.3 && x > XL - 0.4 && x < XR + 0.45) return TOPA - 0.05;    // the main false front
  if (x < XL + 0.1 && x > PX - 0.3) return topB(z) - 0.05;                                 // the side one
  if (z < ZB + 0.08 && y !== undefined && y > EAVE - 0.1) return roofUnder(x) - 0.04;      // the back gable
  return Math.max(EAVE + 0.1, roofUnder(x) - 0.04);
}
// the floor worn pale where people walk: in at both doors, along the bar, to the stage, the stairs, the chalkboard
const PATHS = [[[0, ZF], [-0.9, 3.4]], [[-0.9, 3.4], [-0.9, -1.4]], [[-0.9, -1.4], [XL, -1.4]], [[-1.9, 3.9], [-1.9, -0.4]],
  [[-1.25, -1.4], [-1.8, -2.6]], [[0, ZF], [1.9, 3.9]], [[0.4, 1.0], [3.6, 2.2]], [[-1.25, 0.8], [0.6, -1.6]]];
function worn(x, z) {
  let w = 0;
  for (const [[ax, az], [bx, bz]] of PATHS) {
    const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    w = Math.max(w, 1 - smooth01(d, 0.2, 1.0));
  }
  return w;
}
function tintAt(x, y, z, t, o) {
  if (o.fresh || o.roof) return t;
  if (o.floor) { const w = worn(x, z), f = 1 + 0.38 * w; return [t[0] * f, t[1] * f * 1.03, t[2] * f * 1.08]; }
  if (o.inside) { const f = 0.9 + 0.14 * smooth01(y, 0, 3.2); return [t[0] * f, t[1] * f, t[2] * f * 0.98]; }
  if (o.paint) { const f = smooth01(y, 0.4, 8); return [t[0] * (0.95 + 0.1 * f), t[1] * (0.95 + 0.12 * f), t[2] * (0.95 + 0.14 * f)]; }
  const f = smooth01(y, 0.3, 8), lum = t[0] * 0.3 + t[1] * 0.59 + t[2] * 0.11, g = 0.55;
  const lo = [t[0] * 0.8, t[1] * 0.77, t[2] * 0.74];
  const hi = [(t[0] + (lum * 0.92 - t[0]) * g) * 1.08, (t[1] + (lum * 1.01 - t[1]) * g) * 1.08, (t[2] + (lum * 1.12 - t[2]) * g) * 1.08];
  return [lo[0] + (hi[0] - lo[0]) * f, lo[1] + (hi[1] - lo[1]) * f, lo[2] + (hi[2] - lo[2]) * f];
}

// build a part in a kit of its own, then move its parts into k through the matrix M
function into(k, M, build, seed) {
  const t = new Kit(seed); t.parts.glow = []; build(t);
  for (const g in t.parts) for (const P of t.parts[g]) {
    if (g === 'glow') { k.parts.glow.push({ ...P, m: mul(M, P.m) }); continue; }
    (k.parts[g] || (k.parts[g] = [])).push({ size: P.size, m: mul(M, P.m), o: P.o });
  }
  for (const O of t.occ) k.occ.push({ size: O.size, m: mul(M, O.m) });
}
// the decals (planes over the boards, each a region of the saloon's picture), the inside glass, the goods
const decals = [], panes = [];
let G = null;
function pic(region, w, h, m) {
  const g = new THREE.PlaneGeometry(w, h), [u0, v0, u1, v1] = regionUV(region), U = g.attributes.uv;
  for (let i = 0; i < U.count; i++) U.setXY(i, u0 + (u1 - u0) * U.getX(i), v0 + (v1 - v0) * U.getY(i));
  g.applyMatrix4(m); decals.push(g); return g;
}
// a decal seen from both sides (lace hung in a window)
function pic2(region, w, h, m) { pic(region, w, h, m); pic(region, w, h, mul(m, RY(Math.PI))); }
function pane(w, h, m) { const g = new THREE.PlaneGeometry(w, h); g.applyMatrix4(m); panes.push(g); }
// a flat rectangle of a picture that tiles (wallpaper, velvet): in the frame M (its face toward +z), from (x0, y0) to
// (x1, y1), one repeat every `rep` metres, cut into tiles so each tile's corners carry its own part of the repeat
function tiled(region, M, x0, x1, y0, y1, rep, tint = [1, 1, 1]) {
  const [rx, ry, rw, rh] = region;
  for (let x = x0; x < x1 - 1e-3;) {
    const xe = Math.min(x1, (Math.floor(x / rep + 1e-6) + 1) * rep), fu0 = x / rep - Math.floor(x / rep + 1e-6), fu1 = fu0 + (xe - x) / rep;
    for (let y = y0; y < y1 - 1e-3;) {
      const ye = Math.min(y1, (Math.floor(y / rep + 1e-6) + 1) * rep), fv0 = y / rep - Math.floor(y / rep + 1e-6), fv1 = fv0 + (ye - y) / rep;
      const sub = [rx + fu0 * rw, ry + (1 - fv1) * rh, (fu1 - fu0) * rw, (fv1 - fv0) * rh];
      G.fan([[x, y, 0], [xe, y, 0], [xe, ye, 0], [x, ye, 0]], [0, 0, 1], (p) => [(p[0] - x) / (xe - x), (p[1] - y) / (ye - y)], sub, tint, M);
      y = ye;
    }
    x = xe;
  }
}
const trimP = (k, TR) => (TR ? vary(k, TR, 0.93, 1.06) : null);

// ── the openings ─────────────────────────────────────────────────────────────────────────────────────────────────────
// (each wall in its own frame: a runs to the right seen from outside: x on the front, -x on the back, -z on the east
// side, z on the side street's)
const FRONT = wallOf(0, ZF), BACK = wallOf(Math.PI, -ZB), EAST = wallOf(Math.PI / 2, XR), WEST = wallOf(-Math.PI / 2, -XL);
const DH = 3.25;                                                                   // the doorways' head
const DOOR_A = { a0: -0.9, a1: 0.9, y0: FL - 0.1, y1: DH, door: true };            // the main door (a = x)
const DOOR_B = { a0: -2.3, a1: -0.5, y0: FL - 0.1, y1: DH, door: true };           // the side door (a = z)
const DISP = [1.2, 3.3];                                                           // the display windows' sill and head
const WA1 = { a0: -4.05, a1: -2.25, y0: DISP[0], y1: DISP[1], disp: true }, WA2 = { a0: 2.25, a1: 4.05, y0: DISP[0], y1: DISP[1], disp: true };
const WB1 = { a0: 4.25, a1: 5.5, y0: DISP[0], y1: DISP[1], disp: true };          // the side's corner window (a = z)
const WB3 = { a0: -5.25, a1: -4.25, y0: 1.4, y1: 3.1 };                            // under the gallery, by the stage
const UP = [5.0, 6.65], uw = (c) => ({ a0: c - 0.475, a1: c + 0.475, y0: UP[0], y1: UP[1] });
const UA = [-3.2, 0, 3.2].map(uw), UB = [4.6, 1.6, -1.4, -4.4].map(uw);
const WE1 = { a0: -4.6, a1: -3.6, y0: 1.4, y1: 3.1 }, WE2 = { a0: 4.0, a1: 5.0, y0: 1.4, y1: 3.1 };   // east (a = -z)
const UE = [-3.0, 0.5, 4.5].map(uw);
const WK1 = { a0: 3.25, a1: 4.15, y0: 1.4, y1: 2.9 }, UK = [-2.6, 2.6].map(uw);  // back (a = -x)
// the signs: where "SALOON" goes on each false front (a along the wall, y up)
const SIGN_A = { a0: -3.95, a1: 3.95, y0: 7.22, y1: 8.82 }, SIGN_B = { a0: -4.85, a1: 0.75, y0: 7.08, y1: 8.48 };
const inRect = (S, a, y, m = 0) => a > S.a0 - m && a < S.a1 + m && y > S.y0 - m && y < S.y1 + m;

// ── walls ────────────────────────────────────────────────────────────────────────────────────────────────────────────
function walls(k, paint, TR) {
  const sid = (o) => ({ paint, tint: BARE, bare: 0.05, cutEvery: 4.0, bh: 0.24, ...o });
  // the main front, from the boardwalk to the false front's top (the wing over the east eave only above it); its back
  // drawn where it stands over the roof
  lapSiding(k, FRONT, sid({ a0: XL - 0.03, a1: XR + WINGA, y0: FL - 0.06, tops: [[XL - 0.03, XR + WINGA, TOPA]], opens: [DOOR_A, WA1, WA2, ...UA, { a0: XR, a1: XR + WINGA + 0.01, y0: -1, y1: WINGAY }],
    origin: XL, keepPaint: (a, y) => inRect(SIGN_A, a, y, 0.2), backFrom: (a) => (a > XR - 0.02 ? WINGAY - 0.1 : roofUnder(a) - 1.8), inTint: BACKS }));
  // the side street's front: the same, in two steps, its wing over the back gable's overhang
  lapSiding(k, WEST, sid({ a0: ZB - WINGB, a1: ZF, y0: FL - 0.06, tops: [[ZB - WINGB, BSTEP, TOPB2], [BSTEP, ZF, TOPB1]], opens: [DOOR_B, WB1, WB3, ...UB, { a0: ZB - WINGB - 0.01, a1: ZB, y0: -1, y1: WINGBY }],
    origin: ZB, keepPaint: (a, y) => inRect(SIGN_B, a, y, 0.2), backFrom: (a) => (a < ZB + 0.02 ? WINGBY - 0.1 : EAVE - 0.05), inTint: BACKS }));
  lapSiding(k, EAST, sid({ a0: -ZF, a1: -ZB, y0: Y0, tops: [[-ZF, -ZB, WTOP]], opens: [WE1, WE2, ...UE], origin: -ZF, bh: 0.28 }));
  lapSiding(k, BACK, sid({ a0: -XR, a1: -XL, y0: Y0, tops: [[-XR, -XL, EAVE + 0.02]], opens: [WK1, ...UK], origin: -XR, bh: 0.28 }));
  // the back gable over the plate line: boards and battens up to the roof, a belt board under them
  boardAndBatten(k, BACK, { a0: -XR, a1: -XL, y0: EAVE - 0.01, top: (a) => roofUnder(-a) + 0.012, apex: 0, paint, tint: BARE, inTint: null, rows: [8.3] });
  k.board([XR - XL + 0.04, 0.12, 0.03], null, null, { m: wallM(BACK, 0, EAVE + 0.02, 0.03), long: 0, tint: vary(k, TRIMW, 0.85, 1.0), paint: trimP(k, TR), trim: true, skip: '-z', outside: true });
  // THE PILASTERS: cream boards up the corners and where the side front steps, a cap under the cornice
  const pil = (w, a, y0, y1, wd = 0.2, cap = true) => {
    k.board([wd, y1 - y0, 0.035], null, null, { m: wallM(w, a, (y0 + y1) / 2, 0.04), long: 1, tint: vary(k, TRIMW, 0.9, 1.05), paint: trimP(k, TR), trim: true, skip: '-z-y', cuts: [-3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6].filter((c) => Math.abs(c) < (y1 - y0) / 2 - 0.3), segFaces: '+z', outside: true });
    if (cap) { k.board([wd + 0.08, 0.1, 0.07], null, null, { m: wallM(w, a, y1 - 0.05, 0.065), long: 0, tint: TRIMW, paint: trimP(k, TR), trim: true, outside: true }); k.board([wd + 0.04, 0.05, 0.05], null, null, { m: wallM(w, a, y1 - 0.12, 0.06), long: 0, tint: TRIMW, paint: trimP(k, TR), trim: true, outside: true }); }
  };
  pil(FRONT, XL + 0.08, FL - 0.06, TOPA - 0.48, 0.22); pil(FRONT, XR - 0.06, FL - 0.06, WINGAY + 0.06, 0.18, false); pil(FRONT, XR + WINGA - 0.1, WINGAY, TOPA - 0.48, 0.2);
  pil(WEST, ZF - 0.1, FL - 0.06, TOPB1 - 0.48, 0.2); pil(WEST, BSTEP - 0.11, FL - 0.06, TOPB1 - 0.48, 0.22);
  pil(WEST, ZB + 0.1, FL - 0.06, WINGBY + 0.06, 0.2, false); pil(WEST, ZB - WINGB + 0.1, WINGBY, TOPB2 - 0.48, 0.2);
  pil(EAST, -ZF + 0.08, Y0, WINGAY - 0.02, 0.16, false); pil(EAST, -ZB - 0.08, Y0, WTOP, 0.16, false);
  pil(BACK, -XR + 0.08, Y0, EAVE + 0.12, 0.16, false); pil(BACK, -XL - 0.08, Y0, EAVE + 0.12, 0.16, false);
  // the false fronts' edges: an end board over the boards' ends where a front stands clear (the main front's left end
  // over the side front, its wing's end, the side front's wing), a soffit under each wing
  const endB = (x, z, y0, y1, ax) => k.board(ax === 'x' ? [0.05, y1 - y0, 0.24] : [0.24, y1 - y0, 0.05], [x, (y0 + y1) / 2, z], null, { long: 1, tint: vary(k, TRIMW, 0.85, 1.0), paint: trimP(k, TR), trim: true, outside: true });
  endB(XL - 0.055, ZF - 0.08, TOPB1 - 0.1, TOPA, 'x'); endB(XR + WINGA + 0.025, ZF - 0.08, WINGAY, TOPA, 'x');
  endB(XL + 0.08, ZB - WINGB - 0.025, WINGBY, TOPB2, 'z');
  k.board([WINGA + 0.04, 0.025, 0.2], [XR + WINGA / 2 - 0.02, WINGAY + 0.0125, ZF - 0.08], null, { long: 0, tint: vary(k, TRIMW, 0.75, 0.9), outside: true });
  k.board([0.2, 0.025, WINGB + 0.04], [XL + 0.08, WINGBY + 0.0125, ZB - WINGB / 2 + 0.02], null, { long: 2, tint: vary(k, TRIMW, 0.75, 0.9), outside: true });
}
// the openings: the doorways, the display windows, the windows up and down
function openingTrims(k, TR) {
  for (const [w, op] of [[FRONT, DOOR_A], [WEST, DOOR_B]]) doorway(k, w, op, TR);
  for (const [w, op] of [[FRONT, WA1], [FRONT, WA2], [WEST, WB1]]) displayWindow(k, w, op, TR);
  for (const op of UA) windowIn(k, FRONT, op, TR, {});
  UB.forEach((op, i) => windowIn(k, WEST, op, TR, { room: i === 3 }));
  UE.forEach((op, i) => windowIn(k, EAST, op, TR, { room: i === 2 }));
  for (const op of UK) windowIn(k, BACK, op, TR, { room: true });
  windowIn(k, WEST, WB3, TR, { low: true }); windowIn(k, EAST, WE1, TR, { low: true }); windowIn(k, EAST, WE2, TR, { low: true }); windowIn(k, BACK, WK1, TR, { low: true });
}
// THE TRIM round an opening (in the wall's frame), painted: a board up each side, a head with a frieze and a little
// cornice over it, for a window a sill and an apron; the reveal lining the opening back through the wall
function trimCase(k, w, op, TR, o = {}) {
  const cw = o.width ?? 0.12, h = op.y1 - op.y0, ac = (op.a0 + op.a1) / 2, wd = op.a1 - op.a0, P = () => ({ tint: vary(k, TRIMW, 0.9, 1.06), paint: trimP(k, TR), trim: true, outside: true });
  const y0 = op.door ? op.y0 : op.y0 - 0.02;
  for (const [a, s] of [[op.a0, -1], [op.a1, 1]]) k.board([cw, op.y1 - y0 + cw, 0.03], null, null, { m: wallM(w, a + s * cw / 2, (y0 + op.y1 + cw) / 2, 0.035), long: 1, ...P(), skip: '-z' + (op.door ? '-y' : '') });
  // the head: a frieze board, a bed moulding, a cap that stands out over it
  k.board([wd + 2 * cw + 0.04, 0.16, 0.03], null, null, { m: wallM(w, ac, op.y1 + cw + 0.08, 0.036), long: 0, ...P(), skip: '-z' });
  k.board([wd + 2 * cw + 0.18, 0.04, 0.11], null, null, { m: wallM(w, ac, op.y1 + cw + 0.225, 0.07, [0.06, 0, 0]), long: 0, ...P() });
  if (!op.door) {
    k.board([wd + 2 * cw + 0.12, 0.045, 0.13], null, null, { m: wallM(w, ac, op.y0 - 0.04, 0.06, [0.08, 0, 0]), long: 0, ...P() });
    k.board([wd + 2 * cw - 0.02, 0.1, 0.025], null, null, { m: wallM(w, ac, op.y0 - 0.12, 0.03), long: 0, ...P(), skip: '-z' });
  }
  const dep = o.depth ?? 0.2;
  for (const [a, s] of [[op.a0, 1], [op.a1, -1]]) k.board([0.025, h, dep], null, null, { m: wallM(w, a - s * 0.0125, (op.y0 + op.y1) / 2, 0.05 - dep / 2), long: 1, tint: vary(k, TRIMW, 0.8, 0.95), paint: trimP(k, TR), skip: '-y+y-z' + (s > 0 ? '-x' : '+x') });
  k.board([wd, 0.025, dep], null, null, { m: wallM(w, ac, op.y1 + 0.0125, 0.05 - dep / 2), long: 0, tint: vary(k, TRIMW, 0.8, 0.95), paint: trimP(k, TR), skip: '+y-z+x-x' });
  // (the sheathing behind the siding round it: the rows cut away over its top and foot leave a strip; this fills it)
  const bw = wd + 0.26;
  k.board([bw, 0.27, 0.015], null, null, { m: wallM(w, ac, op.y1 + 0.135, -0.012), long: 0, tint: vary(k, BARE, 0.7, 0.8), outside: true, skip: '+x-x+y-y-z' });
  if (!op.door) k.board([bw, 0.27, 0.015], null, null, { m: wallM(w, ac, op.y0 - 0.135, -0.012), long: 0, tint: vary(k, BARE, 0.7, 0.8), outside: true, skip: '+x-x+y-y-z' });
  const c = new THREE.Vector3(ac, 0, w.d).applyMatrix4(RY(w.th));
  if (!op.door) SILLS.push({ x: c.x + w.ox, z: c.z + w.oz, hw: Math.abs(Math.cos(w.th)) * (wd / 2 + 0.2) + 0.15, hd: Math.abs(Math.sin(w.th)) * (wd / 2 + 0.2) + 0.15, y: op.y0 - 0.06 });
}
// A SIX-PANE WINDOW (two across, three high): the trim, the sash, the pane's glow, lace curtains behind it (seen from both
// sides); o.room: it lights one of the upstairs rooms (not built: a dark room behind the lace); o.low: a downstairs one
function windowIn(k, w, op, TR, o = {}) {
  trimCase(k, w, op, TR);
  const wd = op.a1 - op.a0, h = op.y1 - op.y0, ac = (op.a0 + op.a1) / 2, yc = (op.y0 + op.y1) / 2;
  k.parts.glow.push({ size: [wd, h, 0], m: wallM(w, ac, yc, -0.05), pane: true, kind: GLOW.window, col: [1.7, 0.72, 0.22] });
  const S = { tint: TRIMW, paint: trimP(k, TR) };
  for (const s of [-1, 1]) k.board([0.055, h, 0.045], null, null, { m: wallM(w, ac + s * (wd / 2 - 0.0275), yc, -0.035), long: 1, ...S, skip: '+y-y' });
  for (const y of [op.y0 + 0.03, op.y1 - 0.03]) k.board([wd - 0.11, 0.06, 0.045], null, null, { m: wallM(w, ac, y, -0.035), long: 0, ...S, skip: '+x-x' });
  k.board([0.035, h - 0.1, 0.035], null, null, { m: wallM(w, ac, yc, -0.035), long: 1, ...S, skip: '+y-y' });
  for (let i = 1; i < 3; i++) k.board([wd - 0.11, 0.035, 0.035], null, null, { m: wallM(w, ac, op.y0 + 0.06 + (h - 0.12) * i / 3, -0.035), long: 0, ...S, skip: '+x-x' });
  pic(A.sky, wd - 0.1, h * 0.5, wallM(w, ac, op.y1 - h * 0.25 - 0.03, -0.044));
  // the lace: two panels parted a little in the middle, from the top of the window most of the way down
  const lh = h * 0.92, lw = wd * 0.5 + 0.03;
  for (const s of [-1, 1]) pic2(A.lace, lw, lh, mul(wallM(w, ac + s * (lw / 2 - 0.02 + 0.03), op.y1 - lh / 2 - 0.02, -0.085), RZ(s * 0.015)));
  if (o.room) {
    // a dark room behind it: a back and sides, as far as anyone can see in
    k.board([wd + 0.1, h + 0.1, 0.01], null, null, { m: wallM(w, ac, yc, -0.5), long: 0, paint: [0.03, 0.022, 0.018], tint: [0.3, 0.3, 0.3], skip: '-z+x-x+y-y' });
    for (const s of [-1, 1]) k.board([0.01, h + 0.1, 0.45], null, null, { m: wallM(w, ac + s * (wd / 2 + 0.05), yc, -0.27), long: 1, paint: [0.035, 0.026, 0.02], tint: [0.3, 0.3, 0.3], skip: (s > 0 ? '+x' : '-x') + '+y-y+z-z' });
    k.board([wd + 0.1, 0.01, 0.45], null, null, { m: wallM(w, ac, op.y0 - 0.04, -0.27), long: 0, paint: [0.05, 0.035, 0.025], tint: [0.3, 0.3, 0.3], skip: '-y+x-x+z-z' });
    k.board([wd + 0.1, 0.01, 0.45], null, null, { m: wallM(w, ac, op.y1 + 0.04, -0.27), long: 0, paint: [0.03, 0.022, 0.018], tint: [0.3, 0.3, 0.3], skip: '+y+x-x+z-z' });
    return;
  }
  pane(wd - 0.04, h - 0.04, mul(wallM(w, ac, yc, -0.06), RY(Math.PI)));
  // inside: the casing on the lining, a stool and an apron
  const oi = -INS - 0.03, cw = 0.09;
  for (const s of [-1, 1]) k.board([cw, h + cw, 0.02], null, null, { m: wallM(w, ac + s * (wd / 2 + cw / 2), yc + cw / 2, oi), long: 1, tint: vary(k, WAIN, 0.85, 1.0), skip: '+z', inside: true });
  k.board([wd + 2 * cw + 0.04, 0.1, 0.022], null, null, { m: wallM(w, ac, op.y1 + cw + 0.05, oi), long: 0, tint: vary(k, WAIN, 0.85, 1.0), skip: '+z', inside: true });
  k.board([wd + 2 * cw + 0.1, 0.032, 0.13], null, null, { m: wallM(w, ac, op.y0 - 0.016, oi - 0.03), long: 0, tint: vary(k, WAIN, 0.9, 1.05), inside: true });
  k.board([wd + 2 * cw, 0.08, 0.02], null, null, { m: wallM(w, ac, op.y0 - 0.08, oi), long: 0, tint: vary(k, WAIN, 0.85, 1.0), skip: '+z', inside: true });
}
// A DISPLAY WINDOW: wide and tall, a transom of small panes over a bar, two big panes under it, "SALOON" in gold leaf on
// the glass, a lace cafe curtain behind its lower half; a deep stool inside
function displayWindow(k, w, op, TR) {
  trimCase(k, w, op, TR, { width: 0.14 });
  const wd = op.a1 - op.a0, h = op.y1 - op.y0, ac = (op.a0 + op.a1) / 2, yc = (op.y0 + op.y1) / 2, TB = op.y1 - 0.48;
  k.parts.glow.push({ size: [wd, h, 0], m: wallM(w, ac, yc, -0.05), pane: true, kind: GLOW.window, col: [1.8, 0.74, 0.2] });
  const S = { tint: TRIMW, paint: trimP(k, TR) };
  for (const s of [-1, 1]) k.board([0.07, h, 0.05], null, null, { m: wallM(w, ac + s * (wd / 2 - 0.035), yc, -0.035), long: 1, ...S, skip: '+y-y' });
  for (const [y, t] of [[op.y0 + 0.04, 0.08], [op.y1 - 0.03, 0.06], [TB, 0.08]]) k.board([wd - 0.14, t, 0.05], null, null, { m: wallM(w, ac, y, -0.035), long: 0, ...S, skip: '+x-x' });
  k.board([0.05, TB - op.y0 - 0.08, 0.045], null, null, { m: wallM(w, ac, (TB + op.y0) / 2, -0.035), long: 1, ...S, skip: '+y-y' });
  for (let i = 1; i < 4; i++) k.board([0.03, op.y1 - TB - 0.06, 0.035], null, null, { m: wallM(w, op.a0 + 0.07 + (wd - 0.14) * i / 4, (op.y1 + TB) / 2, -0.035), long: 1, ...S, skip: '+y-y' });
  // the gold lettering, on the outside of the glass, across both big panes
  const gw = Math.min(wd - 0.24, 1.45), gh = gw * A.gold[3] / A.gold[2];
  pic(A.gold, gw, gh, wallM(w, ac, TB - 0.12 - gh / 2 - 0.12, -0.044));
  // the sky's reflection across the top of the glass, fading down; lace curtains drawn back to the sides
  pic(A.sky, wd - 0.12, h * 0.5, wallM(w, ac, op.y1 - h * 0.25 - 0.03, -0.042));
  for (const sd of [-1, 1]) pic2(A.lace, 0.34, TB - op.y0 - 0.12, mul(wallM(w, ac + sd * (wd / 2 - 0.2), (TB + op.y0) / 2 + 0.04, -0.1), RZ(sd * 0.06)));
  // the cafe curtain: lace over the lower part, on a brass rod
  const cy0 = op.y0 + 0.1, cy1 = op.y0 + (TB - op.y0) * 0.42;
  pic2(A.lace, wd - 0.12, cy1 - cy0, wallM(w, ac, (cy0 + cy1) / 2, -0.09));
  k.box('iron', [wd - 0.1, 0.012, 0.012], null, null, { m: wallM(w, ac, cy1 + 0.01, -0.09), tint: BRASS });
  pane(wd - 0.04, h - 0.04, mul(wallM(w, ac, yc, -0.06), RY(Math.PI)));
  const oi = -INS - 0.03, cw = 0.1;
  for (const s of [-1, 1]) k.board([cw, h + cw, 0.02], null, null, { m: wallM(w, ac + s * (wd / 2 + cw / 2), yc + cw / 2, oi), long: 1, tint: vary(k, WAIN, 0.85, 1.0), skip: '+z', inside: true });
  k.board([wd + 2 * cw + 0.04, 0.1, 0.022], null, null, { m: wallM(w, ac, op.y1 + cw + 0.05, oi), long: 0, tint: vary(k, WAIN, 0.85, 1.0), skip: '+z', inside: true });
  k.board([wd + 2 * cw + 0.1, 0.035, 0.3], null, null, { m: wallM(w, ac, op.y0 - 0.017, oi - 0.1), long: 0, tint: vary(k, WAIN, 0.9, 1.05), inside: true });
}
// A DOORWAY for the batwings: the trim, a threshold, a transom of three panes over the doors' head
function doorway(k, w, op, TR) {
  trimCase(k, w, { ...op, y0: FL }, TR, { width: 0.14 });
  const ac = (op.a0 + op.a1) / 2, wd = op.a1 - op.a0, tb = DH - 0.5;
  k.board([wd, 0.09, 0.16], null, null, { m: wallM(w, ac, tb, -0.05), long: 0, tint: vary(k, TRIMW, 0.85, 0.95), paint: trimP(k, TR) });
  for (let i = 0; i <= 3; i++) k.board([0.04, DH - tb - 0.05, 0.045], null, null, { m: wallM(w, op.a0 + 0.02 + (wd - 0.04) * i / 3, (tb + DH) / 2, -0.035), long: 1, tint: TRIMW, paint: trimP(k, TR) });
  k.parts.glow.push({ size: [wd - 0.06, DH - tb - 0.05, 0], m: wallM(w, ac, (tb + DH) / 2 + 0.02, -0.045), pane: true, kind: GLOW.window, col: [1.8, 0.74, 0.2] });
  pane(wd - 0.06, DH - tb - 0.05, mul(wallM(w, ac, (tb + DH) / 2 + 0.02, -0.055), RY(Math.PI)));
  k.board([wd + 0.04, 0.035, 0.26], null, null, { m: wallM(w, ac, FL + 0.005, -0.07), long: 0, tint: vary(k, FLOOR, 0.8, 0.9) });
  // the inside casing
  const oi = -INS - 0.03, cw = 0.1, h = DH - FL;
  for (const s of [-1, 1]) k.board([cw, h + cw, 0.02], null, null, { m: wallM(w, ac + s * (wd / 2 + cw / 2), FL + (h + cw) / 2, oi), long: 1, tint: vary(k, WAIN, 0.85, 1.0), skip: '+z', inside: true });
  k.board([wd + 2 * cw + 0.04, 0.12, 0.022], null, null, { m: wallM(w, ac, DH + cw + 0.06, oi), long: 0, tint: vary(k, WAIN, 0.85, 1.0), skip: '+z', inside: true });
}

// THE SIGN, PAINTED ON THE BOARDS: "SALOON" laid over each lap board's own face (the exposed part of it, tilted as the
// board is), so the letters follow the laps and their shadow lines. The rows are the lap siding's own (parts.js
// lapSiding: boards bh high, lapped 2.5 cm, 2 cm thick, tilted by their lap), worked out here the same way
function signStrips(w, o, S) {
  const bh = o.bh, lap = 0.025, expo = bh - lap, bt = 0.02, [u0, v0, u1, v1] = regionUV(A.sign);
  const top = o.tops.find(([s0, s1]) => S.a0 >= s0 - 1e-6 && S.a1 <= s1 + 1e-6)[2], ac = (S.a0 + S.a1) / 2, W = S.a1 - S.a0;
  for (let yb = o.y0; yb < top - 0.04; yb += expo) {
    const h = Math.min(bh, top - yb + 0.004); if (h < 0.05) continue;
    const vis0 = yb, vis1 = Math.min(yb + h, yb + expo + 0.012);
    const lo = Math.max(vis0, S.y0), hi = Math.min(vis1, S.y1); if (hi - lo < 0.003) continue;
    const ht = Math.atan2(bt, h), yc = yb + h / 2, M = mul(wallM(w, ac, yc, 0, [-ht, 0, 0]), T(0, 0, bt / 2 + 0.0015));
    const g = new THREE.PlaneGeometry(W, hi - lo); g.translate(0, (lo + hi) / 2 - yc, 0);
    const U = g.attributes.uv, P = g.attributes.position;
    for (let i = 0; i < U.count; i++) { const fu = (P.getX(i) + W / 2) / W, fv = (P.getY(i) + yc - S.y0) / (S.y1 - S.y0); U.setXY(i, u0 + (u1 - u0) * fu, v0 + (v1 - v0) * fv); }
    g.applyMatrix4(M); decals.push(g);
  }
}

// ── the false fronts: their cornices, the trim where the side one steps, the frame behind them ───────────────────────
// a bracketed cornice along a wall (frame w) from a0 to a1 at the top y: a cap, a crown moulding, a bed moulding, a
// frieze, dentils, big scroll brackets in pairs; endL / endR: how far the cap runs past each end
function cornice(k, w, a0, a1, y, endL, endR, TR) {
  const x0 = a0 - endL, x1 = a1 + endR, xc = (x0 + x1) / 2, L = x1 - x0, P = () => ({ tint: vary(k, TRIMW, 0.82, 0.98), paint: trimP(k, TR), trim: true, outside: true, noWear: true });
  k.board([L, 0.07, 0.46], null, null, { m: wallM(w, xc, y + 0.035, -0.07), long: 0, cuts: [-L / 3, 0, L / 3].filter((c) => Math.abs(c) < L / 2 - 0.2), segFaces: '+y', ...P() });
  k.board([L - 0.02, 0.1, 0.07], null, null, { m: wallM(w, xc, y - 0.05, 0.12, [0.5, 0, 0]), long: 0, ...P() });
  k.board([L - 0.04, 0.08, 0.09], null, null, { m: wallM(w, xc, y - 0.12, 0.065), long: 0, ...P() });
  const f0 = a0 + 0.12, f1 = a1 - 0.12;
  k.board([f1 - f0, 0.3, 0.03], null, null, { m: wallM(w, (f0 + f1) / 2, y - 0.31, 0.036), long: 0, ...P(), skip: '-z' });
  const nb = Math.max(2, Math.round((a1 - a0) / 1.15));
  for (let j = 0; j <= nb; j++) {
    const bx = a0 + 0.1 + (a1 - a0 - 0.2) * j / nb;
    k.board([0.09, 0.42, 0.15], null, null, { m: wallM(w, bx, y - 0.29, 0.09), long: 1, ...P(), skip: '-z+y' });
    k.board([0.09, 0.1, 0.1], null, null, { m: wallM(w, bx, y - 0.54, 0.065), long: 1, ...P(), skip: '-z+y' });
    k.board([0.07, 0.06, 0.06], null, null, { m: wallM(w, bx, y - 0.62, 0.05), long: 1, ...P(), skip: '-z+y' });
  }
  const c = new THREE.Vector3((a0 + a1) / 2, 0, w.d - 0.07).applyMatrix4(RY(w.th));
  k.solid(Math.abs(Math.cos(w.th)) > 0.5 ? [a1 - a0, 0.1, 0.36] : [0.36, 0.1, a1 - a0], [c.x + w.ox, y + 0.03, c.z + w.oz]);
}
function falseFronts(k, TR) {
  cornice(k, FRONT, XL - 0.03, XR + WINGA, TOPA, 0.1, 0.1, TR);
  cornice(k, WEST, BSTEP, ZF, TOPB1, 0.12, -0.02, TR);
  cornice(k, WEST, ZB - WINGB, BSTEP, TOPB2, 0.1, -0.02, TR);
  // where the side front steps: a trim board up the front of the taller step's edge, an end board over the boards' ends
  k.board([0.035, TOPB1 - TOPB2 + 0.02, 0.24], null, null, { m: wallM(WEST, BSTEP - 0.0175, (TOPB1 + TOPB2) / 2 + 0.01, -0.08), long: 1, tint: vary(k, TRIMW, 0.85, 1.0), paint: trimP(k, TR), trim: true, outside: true });
  // the finials: a block and a ball on the tall corners
  for (const [x, y, z] of [[XL - 0.0, TOPA + 0.07, ZF + 0.0], [XR + WINGA - 0.05, TOPA + 0.07, ZF + 0.0], [XL, TOPB1 + 0.07, BSTEP], [XL, TOPB2 + 0.07, ZB - WINGB + 0.05]]) {
    k.board([0.22, 0.22, 0.22], [x, y + 0.11, z], null, { long: 1, tint: TRIMW, paint: trimP(k, TR), trim: true, outside: true, skip: '-y' });
    k.prism('wood', ngon(8, 0.09), 0.1, [x, y + 0.27, z], null, { tint: TRIMW, paint: trimP(k, TR), smooth: true, taper: -0.3, skip: '-y' });
    k.prism('wood', ngon(8, 0.11), 0.12, [x, y + 0.38, z], null, { tint: TRIMW, paint: trimP(k, TR), smooth: true, taper: 0.7 });
  }
  // behind them, over the roof: studs every 0.6 m, a plate under each cap, braces down to the roof
  for (let a = XL + 0.25; a < XR + WINGA - 0.05; a += 0.6) {
    const y0 = a > XR ? WINGAY + 0.03 : roofTop(a) - 0.04, y1 = TOPA - 0.05;
    k.board([0.05, y1 - y0, 0.1], [a, (y0 + y1) / 2, ZF - 0.095], null, { long: 1, tint: vary(k, FRAME, 0.85, 1.05), skip: '-y+z', outside: true });
  }
  k.board([XR + WINGA - XL - 0.1, 0.05, 0.1], [(XL + XR + WINGA) / 2, TOPA - 0.075, ZF - 0.095], null, { long: 0, tint: vary(k, FRAME, 0.85, 1.0), skip: '+z+y', outside: true });
  for (const a of [-2.6, 0.6, 3.4]) {
    const yA = TOPA - 0.7, zA = ZF - 0.15, zB = ZF - 2.3, yB = roofTop(a) + 0.02, L = Math.hypot(yA - yB, zA - zB), ang = Math.atan2(yA - yB, zA - zB);
    k.board([0.05, 0.1, L], [a, (yA + yB) / 2, (zA + zB) / 2], [-ang, 0, 0], { long: 2, tint: vary(k, FRAME, 0.8, 1.0) });
  }
  for (let a = ZB - WINGB + 0.06; a < ZF - 0.15; a += 0.6) {
    const y0 = a < ZB ? WINGBY + 0.03 : roofTop(XL + 0.1) - 0.04, y1 = topB(a) - 0.05;
    k.board([0.1, y1 - y0, 0.05], [XL + 0.095, (y0 + y1) / 2, a], null, { long: 1, tint: vary(k, FRAME, 0.85, 1.05), skip: '-y-x', outside: true });
  }
  for (const [z0, z1, y] of [[ZB - WINGB, BSTEP, TOPB2], [BSTEP, ZF - 0.1, TOPB1]]) k.board([0.1, 0.05, z1 - z0 - 0.04], [XL + 0.095, y - 0.075, (z0 + z1) / 2], null, { long: 2, tint: vary(k, FRAME, 0.85, 1.0), skip: '-x+y', outside: true });
  for (const z of [-4.2, -1.1, 3.6]) {
    const top = topB(z), xA = XL + 0.15, xB = XL + 2.0, yA = top - 0.65, yB = roofTop(xB) + 0.02, L = Math.hypot(yA - yB, xB - xA), ang = Math.atan2(yA - yB, xB - xA);
    k.board([L, 0.1, 0.05], [(xA + xB) / 2, (yA + yB) / 2, z], [0, 0, -ang], { long: 0, tint: vary(k, FRAME, 0.8, 1.0) });
  }
}

// ── the roofs, the footing, the chimney ──────────────────────────────────────────────────────────────────────────────
const CH = { x: XL + 0.85, z: -1.6, w: 0.72, d: 0.62, top: TOPB2 + 0.8 };
// A BOARD AND BATTEN ROOF (cheaper than shakes, and the false fronts hide most of it): wide boards running down the
// slope side by side, a batten over each joint, a fascia along the eave, the rafters' tails showing under the overhang,
// a ridge board. In the slope's own frame as parts.js roofSlope (its top edge along x at height topY, z = 0, running
// down toward +z), moved into place by M; o.tailFrom: how far down the slope the overhang starts (rafter tails from
// there), o.endBoards: draw the outermost boards' ends (a gable's edge shows them)
function boardRoof(k, M, o) {
  const { x0, x1, topY, len, pitch } = o, sp = Math.sin(pitch), cp = Math.cos(pitch);
  const up = new THREE.Vector3(0, sp, -cp), nrm = new THREE.Vector3(0, cp, sp), eave = new THREE.Vector3(0, topY - len * sp, len * cp);
  const at = (x, sAlong, n) => eave.clone().addScaledVector(up, sAlong).addScaledVector(nrm, n).setX(x);
  const frame = (x, sAlong, n) => mul(M, T(...at(x, sAlong, n).toArray()), RX(pitch));
  const cuts = [-len / 4, len / 4];
  for (let x = x0; x < x1 - 0.02;) {
    const bw = Math.min(k.r(0.24, 0.32), x1 - x), first = x === x0, last = x + bw >= x1 - 0.02;
    k.board([bw + 0.006, 0.025, len], null, null, { m: frame(x + bw / 2, len / 2, 0.0125), long: 2, tint: vary(k, o.tint, 0.82, 1.12), strip: Math.floor(k.R() * 10), uShift: k.r(0, 1.2), cuts, segFaces: '+y-y', skip: '-z' + (first ? '' : '-x') + (last ? '' : '+x'), roof: true });
    x += bw;
    if (x < x1 - 0.05) k.board([0.07, 0.022, len - 0.04], null, null, { m: frame(x, len / 2 + 0.02, 0.036), long: 2, tint: vary(k, o.tint, 0.7, 0.86), strip: 10 + (k.R() < 0.5 ? 1 : 0), cuts, segFaces: '+y', skip: '-z-y', roof: true });
  }
  if (!o.noSolid) for (let q = 0; q < 3; q++) { const a = x0 + (x1 - x0) * q / 3, b = a + (x1 - x0) / 3; k.solid([b - a, 0.08, len], null, null, frame((a + b) / 2, len / 2, 0.0)); }
  // the rafters' tails under the overhang, the fascia over their ends
  const n = Math.max(2, Math.round((x1 - x0 - 0.12) / 0.75)), tl = o.tail ?? 0.4;
  for (let i = 0; i <= n; i++) k.board([0.06, 0.12, tl], null, null, { m: frame(x0 + 0.06 + (x1 - x0 - 0.12) * i / n, tl / 2 + 0.02, -0.06), long: 2, tint: vary(k, o.rafterT, 0.9, 1.1), strip: 10 + (i % 2), skip: '+y-z', ends: 'log' });
  k.board([x1 - x0 + 0.04, 0.12, 0.025], null, null, { m: mul(frame((x0 + x1) / 2, 0.012, -0.03), RX(-pitch)), long: 0, tint: vary(k, o.rafterT, 0.85, 1.0), strip: 10, outside: true, cuts: [-3, 0, 3], segFaces: '+z' });
  // the rake boards up the gable's edges (o.rake: which end), the ridge board along the top
  for (const [x, on] of [[x0 - 0.03, o.rake === 'x0'], [x1 + 0.03, o.rake === 'x1']]) if (on) k.board([0.045, 0.22, len + 0.08], null, null, { m: frame(x, len / 2 - 0.02, -0.03), long: 2, tint: vary(k, o.rafterT, 0.9, 1.05), strip: 10, outside: true });
  if (o.cap) k.board([x1 - x0, 0.04, 0.16], null, null, { m: frame((x0 + x1) / 2, len - 0.07, 0.05), long: 0, tint: vary(k, o.tint, 0.7, 0.8), strip: 11, roof: true, cuts: [-3, 0, 3], segFaces: '+y' });
}
function roofs(k) {
  const common = { topY: ROOF0, pitch: PITCH, tint: [0.92, 0.88, 0.84], rafterT: FRAME, cap: true };
  // (the east slope runs past the east wall; the west one stops behind the side front, its eave hidden)
  boardRoof(k, RY(Math.PI / 2), { ...common, x0: -(ZF - 0.05), x1: -(ZB - GO), len: (XR + EO) / Math.cos(PITCH), rake: 'x1', tail: EO / Math.cos(PITCH) + 0.25 });
  boardRoof(k, RY(-Math.PI / 2), { ...common, x0: ZB - GO, x1: ZF - 0.05, len: (XR - 0.12) / Math.cos(PITCH), rake: 'x0', tail: 0.2 });
  // the flashing where the west slope meets the side front: a strip of tin up its back and over the boards; round the
  // chimney a collar of tin
  k.box('iron', [0.012, 0.2, ZF - ZB + GO - 0.1], [XL + 0.135, roofTop(XL + 0.12) + 0.08, (ZF + ZB - GO) / 2 - 0.02], null, { tint: TIN, skip: '-x' });
  k.box('iron', [0.25, 0.012, ZF - ZB + GO - 0.1], [XL + 0.25, roofTop(XL + 0.25) + 0.01, (ZF + ZB - GO) / 2 - 0.02], [0, 0, -PITCH], { tint: TIN, skip: '-y' });
  k.box('iron', [CH.w + 0.12, 0.06, CH.d + 0.12], [CH.x, roofTop(CH.x) + 0.0, CH.z], [0, 0, -PITCH], { tint: TIN });
}
const rect = (W, D, cx = 0, cz = 0) => [[cx - W / 2, cz + D / 2], [cx + W / 2, cz + D / 2], [cx + W / 2, cz - D / 2], [cx - W / 2, cz - D / 2]];
const topRect = (x0, x1, z0, z1, over, open = { x0: 1, x1: 1, z0: 1, z1: 1 }) => ({ x0: x0 - (open.x0 ? over : 0), x1: x1 + (open.x1 ? over : 0), z0: z0 - (open.z0 ? over : 0), z1: z1 + (open.z1 ? over : 0), open,
  ov: { x0: open.x0 ? over : 0, x1: open.x1 ? over : 0, z0: open.z0 ? over : 0, z1: open.z1 ? over : 0 } });
function stonework(r, env) {
  // the footing under the east and back walls (the street faces stand behind the boardwalk)
  const t = 0.3, G0 = -0.12, loop = [[XR, ZF], [XR, ZB], [XL, ZB], [XL, ZB + t], [XR - t, ZB + t], [XR - t, ZF]];
  SHAPES.saloonFoot = { label: 'Saloon footing', make: () => ({ H: FT, sections: [{ loop0: loop, loop1: loop, y0: G0, y1: FT }], openings: [], top: { y: FT, t: 0, over: 0, rects: [] }, building: {} }) };
  const foot = buildStoneWall({ style: 'mortared', palette: r.stone, mortar: r.mortar, size: 0.62, irregularity: 0.5, colourMix: 0.5, bulge: 0.6, joint: 0.012, shape: 'saloonFoot', seed: r.seed * 3 + 1 }, env);
  // the chimney: up through the west slope behind the side front, a cap stone, a dark flue
  const cl = rect(CH.w, CH.d, CH.x, CH.z), ct = 0.12, y0 = roofTop(CH.x + CH.w / 2) - 0.12;
  SHAPES.saloonChimney = { label: 'Saloon chimney', stones: { size: 1.15, round: false }, make: () => ({ H: CH.top, sections: [{ loop0: cl, loop1: cl, y0, y1: CH.top - ct }], openings: [],
    top: { y: CH.top, t: ct, over: 0.06, rects: [topRect(CH.x - CH.w / 2, CH.x + CH.w / 2, CH.z - CH.d / 2, CH.z + CH.d / 2, 0.06)], holes: [[CH.x - 0.15, CH.x + 0.15, CH.z - 0.12, CH.z + 0.12]] } }) };
  const ch = buildStoneWall({ style: 'mortared', palette: r.stone, mortar: r.mortar, size: 0.34, irregularity: 0.45, colourMix: 0.5, bulge: 0.5, joint: 0.012, shape: 'saloonChimney', seed: r.seed * 5 + 2 }, env);
  return [foot.stone, foot.mortar, ch.stone, ch.mortar];
}

// ── the boardwalk, the posts, the balcony ────────────────────────────────────────────────────────────────────────────
// a turned post: a square foot and head, between them a lathe-turned shaft (a collar, a vase, a long taper, beads)
function turnedPost(k, x, z, y0, y1, TR) {
  const H = y1 - y0, tint = vary(k, TRIMW, 0.95, 1.08), paint = trimP(k, TR), sq = 0.16;
  k.board([sq, 0.55, sq], [x, y0 + 0.275, z], null, { long: 1, tint, paint, trim: true, skip: '-y', outside: true, strip: 10 });
  k.board([sq, 0.42, sq], [x, y1 - 0.21, z], null, { long: 1, tint, paint, trim: true, outside: true, strip: 10 });
  const segs = [[0.08, 0.05, 0], [0.07, 0.32, 0.32], [0.078, 0.05, 0], [0.055, H - 0.55 - 0.42 - 0.62, -0.14], [0.078, 0.05, 0], [0.06, 0.2, -0.2]];
  let y = y0 + 0.55;
  for (const [r, h, taper] of segs) { k.prism('wood', ngon(6, r), h, [x, y + h / 2, z], null, { tint, paint, trim: true, smooth: true, taper, strip: 10, skip: '+y-y', outside: true }); y += h; }
  k.solid([sq, H, sq], [x, y0 + H / 2, z]);
}
// a rod or board between two points (a chain, a brace): a box of the given section along the line from P to Q
function between(k, group, P, Q, wd, th, o = {}) {
  const X = new THREE.Vector3(...Q).sub(new THREE.Vector3(...P)), L = X.length(); X.normalize();
  const up = Math.abs(X.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3().crossVectors(X, up).normalize(), Y = new THREE.Vector3().crossVectors(Z, X);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition((P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2, (P[2] + Q[2]) / 2);
  return group === 'wood' ? k.board([L + (o.over ?? 0), wd, th], null, null, { long: 0, ...o, m }) : k.box(group, [L + (o.over ?? 0), wd, th], null, null, { ...o, m });
}
// a curved bracket in the corner between a post and the beam over it: three short pieces round a quarter circle (its
// centre R out along the beam and R under it), from the post up to the beam. At (x, z), the beam's underside yTop, the
// beam running along e = [ex, ez] (a unit step, the way the bracket reaches)
function arcBracket(k, x, z, yTop, e, R, sec, o) {
  const pt = (a) => [x + e[0] * (R - R * Math.cos(a)), yTop - R + R * Math.sin(a), z + e[1] * (R - R * Math.cos(a))];
  for (let i = 0; i < 2; i++) between(k, 'wood', pt(Math.PI / 2 * i / 2), pt(Math.PI / 2 * (i + 1) / 2), sec[0], sec[1], { over: 0.06, ...o() });
  k.board([sec[1] + 0.02, 0.1, sec[1] + 0.02], [x + e[0] * 0.02, yTop - R - 0.03, z + e[1] * 0.02], null, { long: 1, ...o() });
}
function kneeBracket(k, x, z, yTop, ax, dir, TR, R = 0.48) {
  arcBracket(k, x, z, yTop, ax === 'x' ? [dir, 0] : [0, dir], R, [0.08, 0.065], () => ({ tint: vary(k, TRIMW, 0.85, 1.0), paint: trimP(k, TR), trim: true, outside: true }));
}
// a short post under the boardwalk's rim, on a sawn block on the ground
function blockPost(k, x, z) {
  k.board([0.12, FL - 0.3, 0.12], [x, 0.11 + (FL - 0.3) / 2, z], [0, k.r(-0.1, 0.1), 0], { long: 1, tint: vary(k, FRAME, 0.7, 0.85), skip: '-y+y' });
  k.board([0.3, 0.13, 0.28], [x, 0.045, z], [0, k.r(-0.3, 0.3), 0], { long: 0, tint: vary(k, DARKW, 1.1, 1.3), strip: 10, ends: 'log', skip: '-y' });
}
function steps(k, x0, x1, z0, along) {
  // three treads down from the boardwalk: along 'z' (the main front's: the steps run out toward +z) or 'x' (toward -x)
  const sw = x1 - x0, sx = (x0 + x1) / 2;
  for (let j = 0; j < 3; j++) {
    const ty = FL - 0.15 * (j + 1) - 0.02, d0 = 0.04 + j * 0.3;
    for (const dd of [0.08, 0.23]) {
      if (along === 'z') k.board([sw, 0.05, 0.15], [sx, ty - 0.025, z0 + d0 + dd], [0, k.r(-0.008, 0.008), 0], { long: 0, tint: vary(k, DECKC, 0.95, 1.1), cuts: [-sw / 4, 0, sw / 4], segFaces: '+y', hz: [dd, 2] });
      else k.board([0.15, 0.05, sw], [z0 - d0 - dd, ty - 0.025, sx], [0, k.r(-0.008, 0.008), 0], { long: 2, tint: vary(k, DECKC, 0.95, 1.1), cuts: [-sw / 4, 0, sw / 4], segFaces: '+y', hz: [dd, 2] });
    }
    if (along === 'z') k.board([sw - 0.08, ty - 0.05, 0.025], [sx, (ty - 0.05) / 2, z0 + d0 + 0.28], null, { long: 0, tint: vary(k, FRAME, 0.8, 0.95), skip: '-y+y' });
    else k.board([0.025, ty - 0.05, sw - 0.08], [z0 - d0 - 0.28, (ty - 0.05) / 2, sx], null, { long: 2, tint: vary(k, FRAME, 0.8, 0.95), skip: '-y+y' });
  }
  // (the stringers under the treads, along the line under their noses: half a metre down for every metre out)
  for (const s of [x0 + 0.05, sx, x1 - 0.05]) {
    const ang = Math.atan(0.5), L = 1.05, yc = FL - 0.05 - 0.5 * 0.49 - 0.05 - 0.112;
    if (along === 'z') k.board([0.05, 0.2, L], [s, yc, z0 + 0.49], [ang, 0, 0], { long: 2, tint: vary(k, FRAME, 0.8, 0.95) });
    else k.board([L, 0.2, 0.05], [z0 - 0.49, yc, s], [0, 0, ang], { long: 0, tint: vary(k, FRAME, 0.8, 0.95) });
  }
  if (along === 'z') k.solid([sw, 0.4, 0.9], [sx, 0.2, z0 + 0.45]); else k.solid([0.9, 0.4, sw], [z0 - 0.45, 0.2, sx]);
}
function boardwalk(k, TR) {
  const X1 = XR + 0.12;
  // the decks: planks along each street, nailed to joists; a rim round their edges; short posts on blocks under them
  plankField(k, mul(T(0, FL, 0), RX(-Math.PI / 2)), { u0: PX, u1: X1, v0: -PZ, v1: -ZF, w: 0.16, t: 0.045, tint: DECKC, nails: true, maxL: 3.6, step: 1.0 });
  plankField(k, mul(T(0, FL, 0), RY(-Math.PI / 2), RX(-Math.PI / 2)), { u0: ZB, u1: ZF, v0: PX, v1: XL, w: 0.16, t: 0.045, tint: DECKC, nails: true, maxL: 3.6, step: 1.0 });
  const rim = (size, pos, long) => k.board(size, pos, null, { long, tint: vary(k, FRAME, 0.85, 1.0), strip: 10, cuts: [-3, -1.5, 0, 1.5, 3].filter((c) => Math.abs(c) < Math.max(...size) / 2 - 0.3), segFaces: long === 0 ? '+z' : '-x', outside: true });
  rim([X1 - PX + 0.06, 0.26, 0.06], [(PX + X1) / 2, FL - 0.14, PZ + 0.03], 0);
  rim([0.06, 0.26, PZ - ZB + 0.06], [PX - 0.03, FL - 0.14, (PZ + ZB) / 2], 2);
  k.board([0.06, 0.26, PD + 0.06], [X1 + 0.03, FL - 0.14, ZF + PD / 2 + 0.03], null, { long: 2, tint: vary(k, FRAME, 0.85, 1.0), strip: 10, outside: true });
  k.board([PD + 0.06, 0.26, 0.06], [XL - PD / 2, FL - 0.14, ZB - 0.03], null, { long: 0, tint: vary(k, FRAME, 0.85, 1.0), strip: 10, outside: true });
  for (const x of [PX + 0.15, -5.2, -3.1, -1.5, 1.5, 3.2, X1 - 0.15]) if (Math.abs(x) > 1.2) { blockPost(k, x, PZ - 0.1); blockPost(k, x, ZF + 0.9); }
  for (const z of [PZ - 0.15, 6.6, 4.6, 2.6, 0.2, -2.8, -4.6, ZB + 0.15]) if (z > 0.0 || z < -2.6) { blockPost(k, PX + 0.1, z); blockPost(k, XL - 0.9, z); }
  k.solid([X1 - PX, FL, PD], [(PX + X1) / 2, FL / 2, ZF + PD / 2]);
  k.solid([PD, FL, ZF - ZB], [XL - PD / 2, FL / 2, (ZF + ZB) / 2]);
  // the steps up to each door
  steps(k, -1.1, 1.1, PZ, 'z');
  steps(k, -2.55, -0.25, PX, 'x');
  // THE POSTS: turned, on the boardwalk's edge; a beam over them along both streets; curved knee brackets
  const zb = PZ - 0.12, xb = PX + 0.12;
  for (const x of PA) turnedPost(k, x, zb, FL, BEAMB, TR);
  for (const z of PB) turnedPost(k, xb, z, FL, BEAMB, TR);
  const beam = (size, pos, long) => k.board(size, pos, null, { long, tint: vary(k, FRAME, 0.95, 1.05), strip: 10, cuts: [-4, -2, 0, 2, 4].filter((c) => Math.abs(c) < Math.max(...size) / 2 - 0.3), segFaces: long === 0 ? '+z-z-y' : '+x-x-y', ends: 'log', outside: true });
  beam([XR + 0.12 - xb + 0.08, 0.2, 0.16], [(xb + XR + 0.12) / 2, (BEAMB + BEAMT) / 2, zb], 0);
  beam([0.16, 0.2, zb - ZB + 0.08], [xb, (BEAMB + BEAMT) / 2, (zb + ZB) / 2], 2);
  PA.forEach((x, i) => { for (const s of [-1, 1]) { if ((i === 0 && s < 0) || (i === PA.length - 1 && s > 0)) continue; kneeBracket(k, x, zb, BEAMB, 'x', s, TR); } });
  kneeBracket(k, xb, zb, BEAMB, 'z', -1, TR);
  PB.forEach((z, i) => { for (const s of [-1, 1]) { if (i === PB.length - 1 && s < 0) continue; kneeBracket(k, xb, z, BEAMB, 'z', s, TR); } });
}
// the balcony on the porch roof: its deck (the porch's ceiling seen from under it), joists, a fascia round its edge, a
// ledger on the wall; the railing of turned balusters between ball-topped newels over the posts
function baluster(k, x, z, y0, y1, TR, inside = false) {
  const h = y1 - y0, tint = vary(k, inside ? WAIN : TRIMW, 0.92, 1.08), paint = inside ? null : trimP(k, TR), o = { tint, paint, trim: !inside, smooth: true, skip: '+y-y', strip: 10, inside, wk: x * 13.7 + z * 7.3 };
  k.prism('wood', ngon(5, 0.025), h * 0.5, [x, y0 + h * 0.25, z], null, { ...o, taper: -0.5 });
  k.prism('wood', ngon(5, 0.037), h * 0.5, [x, y0 + h * 0.75, z], null, { ...o, taper: 0.35 });
}
function newel(k, x, z, y0, y1, TR, inside = false, sq = 0.13) {
  const tint = vary(k, inside ? WAIN : TRIMW, 0.92, 1.05), paint = inside ? (inside === 'varnish' ? VARN : null) : trimP(k, TR), tr = !inside, ins = !!inside, wk = x * 13.7 + z * 7.3;
  k.board([sq, y1 - y0, sq], [x, (y0 + y1) / 2, z], null, { long: 1, tint, paint, trim: tr, skip: '-y', strip: 10, inside: ins, wk });
  k.board([sq + 0.04, 0.05, sq + 0.04], [x, y1 + 0.025, z], null, { long: 0, tint, paint, trim: tr, inside: ins, skip: '-y', wk });
  k.prism('wood', ngon(6, 0.08), 0.08, [x, y1 + 0.09, z], null, { tint, paint, trim: tr, smooth: true, taper: -0.5, inside: ins, skip: '-y+y', wk });
  k.prism('wood', ngon(6, 0.08), 0.08, [x, y1 + 0.17, z], null, { tint, paint, trim: tr, smooth: true, taper: 0.75, inside: ins, skip: '-y', wk });
}
// a railing between two newels, along x or z at the other coordinate c: top rail, bottom rail, balusters
function railing(k, ax, a0, a1, c, y0, TR, o = {}) {
  const top = y0 + (o.h ?? 0.95), L = a1 - a0, am = (a0 + a1) / 2, inside = !!o.inside, P = { tint: vary(k, inside ? WAIN : TRIMW, 0.9, 1.05), paint: inside ? VARN : trimP(k, TR), trim: !inside, inside, wk: am * 5.1 + c * 3.3 };
  const pos = (a, y) => (ax === 'x' ? [a, y, c] : [c, y, a]);
  k.board(ax === 'x' ? [L, 0.06, 0.1] : [0.1, 0.06, L], pos(am, top), null, { long: ax === 'x' ? 0 : 2, ...P, cuts: [-2, 0, 2].filter((q) => Math.abs(q) < L / 2 - 0.3), segFaces: '+y' });
  k.board(ax === 'x' ? [L, 0.05, 0.07] : [0.07, 0.05, L], pos(am, y0 + 0.1), null, { long: ax === 'x' ? 0 : 2, ...P, skip: '-y' });
  const n = Math.max(1, Math.round(L / (o.every ?? 0.27)));
  for (let i = 0; i < n; i++) { const a = a0 + L * (i + 0.5) / n, [x, , z] = pos(a, 0); baluster(k, x, z, y0 + 0.125, top - 0.03, TR, inside); }
  k.solid(ax === 'x' ? [L, top - y0, 0.06] : [0.06, top - y0, L], pos(am, (y0 + top) / 2));
}
function balcony(k, TR) {
  const X1 = XR + 0.12, dy = DECK - 0.0225;
  // the deck: planks along each street, both faces drawn (the top walked on, the bottom the porch's ceiling)
  plankField(k, mul(T(0, DECK, 0), RX(-Math.PI / 2)), { u0: PX, u1: X1, v0: -PZ, v1: -ZF, w: 0.21, t: 0.045, tint: vary(k, DECKC, 0.9, 1.0), maxL: 4.2, step: 2.4, skip: '+x-x+y-y' });
  plankField(k, mul(T(0, DECK, 0), RY(-Math.PI / 2), RX(-Math.PI / 2)), { u0: ZB, u1: ZF, v0: PX, v1: XL, w: 0.21, t: 0.045, tint: vary(k, DECKC, 0.9, 1.0), maxL: 4.2, step: 2.4, skip: '+x-x+y-y' });
  k.solid([X1 - PX, 0.2, PD], [(PX + X1) / 2, DECK - 0.1, ZF + PD / 2]);
  k.solid([PD, 0.2, ZF - ZB], [XL - PD / 2, DECK - 0.1, (ZF + ZB) / 2]);
  // the joists under it, wall to beam, every 0.6 m; a ledger along each wall
  const jy = DECK - 0.045 - JOIST / 2;
  for (let x = PX + 0.35; x < X1 - 0.1; x += 1.0) k.board([0.05, JOIST, PD - 0.04], [x, jy, ZF + PD / 2], null, { long: 2, tint: vary(k, FRAME, 0.85, 1.05), strip: 10 + (Math.round(x * 3) % 2), skip: '+y-z+z', cuts: [0], segFaces: '-y+x-x' });
  for (let z = ZB + 0.3; z < ZF; z += 1.0) k.board([PD - 0.04, JOIST, 0.05], [XL - PD / 2, jy, z], null, { long: 0, tint: vary(k, FRAME, 0.85, 1.05), strip: 10 + (Math.round(z * 3) % 2), skip: '+y-x+x', cuts: [0], segFaces: '-y+z-z' });
  k.board([X1 - XL, 0.18, 0.05], [(XL + X1) / 2, jy, ZF + 0.025], null, { long: 0, tint: vary(k, FRAME, 0.8, 0.95), strip: 10, cuts: [-3, 0, 3] });
  k.board([0.05, 0.18, ZF - ZB], [XL - 0.025, jy, (ZF + ZB) / 2], null, { long: 2, tint: vary(k, FRAME, 0.8, 0.95), strip: 10, cuts: [-4, -1.5, 1.5, 4] });
  // the fascia: a cream board round the deck's edge over the joists' ends, a drip moulding over it
  const fas = (size, pos, long) => { k.board(size, pos, null, { long, tint: vary(k, TRIMW, 0.88, 1.02), paint: trimP(k, TR), trim: true, strip: 10, outside: true, cuts: [-4, -2, 0, 2, 4].filter((c) => Math.abs(c) < Math.max(...size) / 2 - 0.3), segFaces: long === 0 ? '+z-z' : '+x-x' }); };
  fas([X1 - PX + 0.06, 0.24, 0.03], [(PX + X1) / 2, dy - 0.1, PZ + 0.015], 0);
  fas([0.03, 0.24, PZ - ZB + 0.03], [PX - 0.015, dy - 0.1, (PZ + ZB) / 2], 2);
  fas([0.03, 0.24, PD], [X1 + 0.015, dy - 0.1, ZF + PD / 2], 2);
  fas([PD, 0.24, 0.03], [XL - PD / 2, dy - 0.1, ZB - 0.015], 0);
  // THE RAILING: newels over the posts and where it meets the walls, turned balusters between, a top and a bottom rail
  const zr = PZ - 0.12, xr = PX + 0.12, nH = 1.02, nl = [];
  for (const x of PA) nl.push([x, zr]);
  for (const z of PB) nl.push([xr, z]);
  nl.push([XR + 0.06, ZF + 0.08], [XL - 0.08, ZB + 0.12]);
  for (const [x, z] of nl) newel(k, x, z, DECK, DECK + nH, TR);
  const xs = PA;
  for (let i = 0; i < xs.length - 1; i++) railing(k, 'x', xs[i] + 0.07, xs[i + 1] - 0.07, zr, DECK, TR);
  railing(k, 'z', ZF + 0.15, zr - 0.07, XR + 0.06, DECK, TR);
  const zs = [zr, ...PB];
  for (let i = 0; i < zs.length - 1; i++) railing(k, 'z', zs[i + 1] + 0.07, zs[i] - 0.07, xr, DECK, TR);
  railing(k, 'x', xr + 0.07, XL - 0.15, ZB + 0.12, DECK, TR);
}

// ── the front things: lanterns over the doors, posters by the side door ─────────────────────────────────────────────
function frontThings(k, lamps) {
  // (the kit's lantern made 1.6 times its size, hung on a chain from the balcony's joists in front of each door's transom)
  for (const [x, z, seed] of [[0, ZF + 0.55, 31], [XL - 0.55, (DOOR_B.a0 + DOOR_B.a1) / 2, 37]]) {
    const y = 3.0, sc = 1.6, ch = (DECK - 0.045 - JOIST - y) / sc - 0.23;
    into(k, mul(T(x, y, z), new THREE.Matrix4().makeScale(sc, sc, sc)), (t) => lantern(t, 0, 0, 0, { chain: ch, outdoor: true }), seed);
    lamps.push({ p: [x, y, z], reach: 6.5, strength: 1.8, outdoor: true });
  }
  // the band's poster and a notice on the side street's wall, between the corner window and the door
  pic(A.poster, 0.62, 0.62 * A.poster[3] / A.poster[2], mul(T(XL - 0.026, 2.05, 2.4), RY(-Math.PI / 2), RZ(0.02)));
  pic(A.notice, 0.38, 0.38 * A.notice[3] / A.notice[2], mul(T(XL - 0.026, 1.85, 1.2), RY(-Math.PI / 2), RZ(-0.04)));
  pic(A.poster, 0.5, 0.5 * A.poster[3] / A.poster[2], mul(T(-1.55 + 0.0, 2.0, ZF + 0.026), RZ(-0.03)));
}

// ── inside ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE WALLS INSIDE: a dark plank wainscot (a cap rail along its top, a base board), damask wallpaper over it; cut round
// the openings and left out where something hides them (the back bar, the stage's curtain). o.paper/o.rep: the paper
// and its repeat (the hall's faded damask, or the rooms' lighter paper); o.wain: the wainscot's height (false: none,
// only a base board); o.skip: rectangles left bare. A window's sill stays panelled down to the floor; a door's opening
// cuts everything
function wallInside(k, w, a0, a1, y0, y1, opens, o = {}) {
  const M = mul(wallM(w, 0, 0, -INS - 0.012), RY(Math.PI)), wain = o.wain !== false, wy = wain ? (o.wy ?? FL + 1.15) : y0, flip = (a) => -a, PK = o.kit || k, GG = o.goods || G;
  // (the wall frame turned to face into the room: its a runs the other way)
  const holes = [...opens.map((op) => [op.a0 - (op.disp ? 0.1 : 0.09), op.a1 + (op.disp ? 0.1 : 0.09), op.y0 - (op.door ? 0.2 : 0.1), op.y1 + 0.14, !!op.door]), ...(o.skip || []).map((h) => [...h, false])];
  // the wallpaper, in rectangles round the holes
  const xs = [...new Set([a0, a1, ...holes.flatMap((h) => [h[0], h[1]]).filter((x) => x > a0 && x < a1)])].sort((p, q) => p - q);
  const ys = [...new Set([Math.max(y0, wy), y1, ...holes.flatMap((h) => [h[2], h[3]]).filter((y) => y > wy && y < y1)])].sort((p, q) => p - q);
  const save = G; G = GG;
  if (y1 > wy) for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++) {
    const ac = (xs[i] + xs[i + 1]) / 2, yc = (ys[j] + ys[j + 1]) / 2;
    if (holes.some((h) => ac > h[0] && ac < h[1] && yc > h[2] && yc < h[3])) continue;
    tiled(o.paper || A.paper, M, flip(xs[i + 1]), flip(xs[i]), ys[j], ys[j + 1], o.rep ?? 1.2, o.paperTint || [1, 1, 1]);
  }
  G = save;
  // the wainscot: upright boards from the floor to its cap (to a window's sill under a window), none in a doorway
  if (wain) for (let a = a0; a < a1 - 0.01;) {
    const bw = Math.min(PK.r(0.26, 0.36), a1 - a), ac = a + bw / 2, over = holes.filter((h) => ac > h[0] && ac < h[1] && h[2] < wy);
    if (!over.some((h) => h[4] || h[2] < y0 + 0.2)) {
      const top = Math.min(wy, ...over.map((h) => h[2] + 0.1));
      PK.board([bw + 0.002, top - y0, 0.02], null, null, { m: mul(wallM(w, ac, (y0 + top) / 2, -INS - 0.01), RY(Math.PI)), long: 1, tint: vary(PK, WAIN, 0.85, 1.12), strip: Math.floor(PK.R() * 10), skip: '-z+x-x+y-y', inside: true });
    }
    a += bw;
  }
  // the cap rail (over the wainscot) and the base board, cut at the doors and the windows' sills
  let spans = [[a0, a1]];
  for (const h of holes) if (h[2] < wy + 0.05) spans = spans.flatMap(([s, e]) => (h[1] <= s || h[0] >= e ? [[s, e]] : [[s, h[0]], [h[1], e]].filter(([p, q]) => q - p > 0.05)));
  let bases = [[a0, a1]];
  for (const h of holes) if (h[4] || h[2] < y0 + 0.2) bases = bases.flatMap(([s, e]) => (h[1] <= s || h[0] >= e ? [[s, e]] : [[s, h[0]], [h[1], e]].filter(([p, q]) => q - p > 0.05)));
  if (wain) for (const [s, e] of spans) PK.board([e - s, 0.06, 0.05], null, null, { m: wallM(w, (s + e) / 2, wy, -INS - 0.035), long: 0, tint: vary(PK, WAIN, 0.9, 1.05), inside: true, skip: '+z+x-x' });
  for (const [s, e] of bases) PK.board([e - s, 0.14, 0.025], null, null, { m: wallM(w, (s + e) / 2, y0 + 0.07, -INS - 0.03), long: 0, tint: vary(PK, WAIN, 0.7, 0.85), inside: true, skip: '+z+x-x-y' });
}
// A WALL FACE INSIDE THE BUILDING (a partition, a wall between rooms): the frame wallInside wants for a face through the
// point p (x, z) looking toward n (a unit [nx, nz]); a(q): where a point lies along it
function faceFrame(n, p) {
  const th = Math.atan2(-n[0], -n[1]), d = -(p[0] * n[0] + p[1] * n[1]) + INS + 0.012;
  return { w: wallOf(th, d), a: (x, z) => x * Math.cos(th) - z * Math.sin(th) };
}
// draw a face from (x0, z0) to (x1, z1), looking toward n; holes [{ c (x or z of its middle), w, y0, y1, door }]
function face(k, x0, z0, x1, z1, n, y0, y1, holes, o) {
  const F = faceFrame(n, [x0, z0]), A0 = F.a(x0, z0), A1 = F.a(x1, z1), along = Math.abs(z1 - z0) > Math.abs(x1 - x0) ? 'z' : 'x';
  const ops = holes.map((h) => { const a = along === 'x' ? F.a(h.c, z0) : F.a(x0, h.c); return { a0: a - h.w / 2, a1: a + h.w / 2, y0: h.y0, y1: h.y1, door: h.door, disp: h.disp }; });
  wallInside(k, F.w, Math.min(A0, A1), Math.max(A0, A1), y0, y1, ops, o);
}

// THE UPPER FLOOR'S PLAN (a U of galleries round the hall's well, rooms behind them):
//   the well        x GXW..IX1, z ZG..GZF: open from the floor to the ceiling (the chandelier, the stairs)
//   the galleries   across the back (z ZP..ZG, over the stage), up the side street's side (x RX1..GXW, over the bar),
//                   across the front (z GZF..RZ0, over the doors)
//   the rooms       seven, behind the galleries' walls, each with a door off a gallery and a window or two on the street
const RX1 = -2.4, GXW = -1.35, GZF = 2.1, RZ0 = 3.25;
export const ROOMS = [
  { id: 'front1', x0: IX0, x1: -1.2, z0: RZ0, z1: IZ1, door: { ax: 'z', at: RZ0, c: -1.8, into: 1 } },
  { id: 'front2', x0: -1.2, x1: 1.7, z0: RZ0, z1: IZ1, door: { ax: 'z', at: RZ0, c: 0.25, into: 1 } },
  { id: 'front3', x0: 1.7, x1: IX1, z0: RZ0, z1: IZ1, door: { ax: 'z', at: RZ0, c: 3.2, into: 1 } },
  { id: 'side1', x0: IX0, x1: RX1, z0: -0.2, z1: RZ0, door: { ax: 'x', at: RX1, c: 1.4, into: -1 } },
  { id: 'side2', x0: IX0, x1: RX1, z0: ZP, z1: -0.2, door: { ax: 'x', at: RX1, c: -1.4, into: -1 } },
  { id: 'back1', x0: IX0, x1: 0.1, z0: IZ0, z1: ZP, door: { ax: 'z', at: ZP, c: -1.3, into: -1 } },
  { id: 'back2', x0: 0.1, x1: IX1, z0: IZ0, z1: ZP, door: { ax: 'z', at: ZP, c: 1.6, into: -1 } },
];
const RD = { w: 0.85, h: 2.1 };
const inWell = (x, z) => x > GXW && x < IX1 && z > ZG && z < GZF;
const roomAt = (x, z) => ROOMS.find((R) => x > R.x0 - 0.01 && x < R.x1 + 0.01 && z > R.z0 - 0.01 && z < R.z1 + 0.01);
// A ROOM'S DOOR LEAF, round its hinge (the hinge line is the y axis, the leaf runs from x = 0 to side * w): four raised
// panels on both faces between stiles and rails, a knob each side. Exported so a door can be hung to swing later
export function roomDoorLeaf(k, { w, h, side }) {
  const t = 0.045, X = (x) => side * x, D = vary(k, WAIN, 0.95, 1.1), K = { tint: [0.6, 0.5, 0.36], paint: [0.36, 0.25, 0.08] };
  k.board([w - 0.004, h - 0.004, t], [X(w / 2), h / 2, 0], null, { long: 1, tint: vary(k, WAIN, 1.0, 1.15), inside: true });
  for (const sz of [-1, 1]) {
    const z = sz * (t / 2 + 0.008);
    for (const x of [0.055, w - 0.055]) k.board([0.11, h, 0.016], [X(x), h / 2, z], null, { long: 1, tint: D, inside: true, skip: sz > 0 ? '-z-y' : '+z-y' });
    for (const [y, rh] of [[0.12, 0.24], [1.0, 0.16], [h - 0.08, 0.16]]) k.board([w - 0.22, rh, 0.016], [X(w / 2), y, z], null, { long: 0, tint: D, inside: true, skip: (sz > 0 ? '-z' : '+z') + '+x-x' });
    k.board([0.05, h - 0.4, 0.016], [X(w / 2), h / 2, z], null, { long: 1, tint: D, inside: true, skip: sz > 0 ? '-z' : '+z' });
    k.prism('wood', ngon(6, 0.026), 0.05, null, null, { m: mul(T(X(w - 0.08), 1.0, z + sz * 0.025), RX(Math.PI / 2)), ...K, smooth: true });
  }
}
// a room's door: its casing on both faces, its leaf (shut) on its hinge; returns where the hinge is for B.roomDoors
function roomDoor(k, R, i) {
  const d = R.door, W = RD.w, H = RD.h, x0 = d.c - W / 2, cas = (M) => {
    for (const s of [-1, 1]) k.board([0.1, H + 0.1, 0.025], null, null, { m: mul(M, T(s * (W / 2 + 0.05), (H + 0.1) / 2, 0)), long: 1, tint: vary(k, WAIN, 0.8, 0.95), inside: true, skip: '-z-y' });
    k.board([W + 0.3, 0.14, 0.03], null, null, { m: mul(M, T(0, H + 0.12, 0)), long: 0, tint: vary(k, WAIN, 0.8, 0.95), inside: true, skip: '-z' });
  };
  // (the wall's frame: x along the wall, +z toward the room's side for d.into; the leaf hangs in the wall's middle)
  const base = d.ax === 'z' ? T(d.c, U1, d.at) : mul(T(d.at, U1, d.c), RY(-Math.PI / 2));
  for (const sz of [-1, 1]) cas(mul(base, T(0, 0, sz * 0.075), sz < 0 ? RY(Math.PI) : new THREE.Matrix4()));
  const hinge = d.ax === 'z' ? [x0, U1, d.at] : [d.at, U1, x0], hingeM = d.ax === 'z' ? T(...hinge) : mul(T(...hinge), RY(-Math.PI / 2));
  into(k, hingeM, (t) => { roomDoorLeaf(t, { w: W, h: H, side: 1 }); for (const g in t.parts) for (const P of t.parts[g]) P.o = { ...P.o, roomDoor: i }; }, 7001 + i * 13);
  // (the threshold)
  k.board(d.ax === 'z' ? [W, 0.02, 0.16] : [0.16, 0.02, W], d.ax === 'z' ? [d.c, U1 + 0.01, d.at] : [d.at, U1 + 0.01, d.c], null, { long: d.ax === 'z' ? 0 : 2, tint: vary(k, FLOOR, 0.75, 0.85), inside: true });
  // (+θ about the hinge swings the leaf toward -z of its own frame: into the room where that is the room's side)
  const swing = (d.ax === 'z' ? -d.into : d.into) * 1.45;
  return { room: R.id, hinge, side: 1, w: W, h: H, frame: d.ax === 'z' ? 0 : -Math.PI / 2, swing, plate: i };
}

function insideRoom(k, ku, kr, GU, lamps) {
  // THE FLOORS: the hall's planks front to back, worn pale along the paths; the upper floor's over the three bands round
  // the well (its boards' tops, and their undersides with the joists: the ceiling under the galleries and the rooms)
  plankField(k, mul(T(0, FL, 0), RY(-Math.PI / 2), RX(-Math.PI / 2)), { u0: IZ0 - 0.02, u1: IZ1 + 0.02, v0: IX0 - 0.02, v1: IX1 + 0.02, w: 0.17, t: 0.03, tint: FLOOR, nails: true, maxL: 4.4, step: 2.4, extra: { inside: true, floor: true } });
  k.solid([IX1 - IX0, 0.1, IZ1 - IZ0], [0, FL - 0.05, 0]);
  const bands = [{ x0: IX0, x1: IX1, z0: GZF, z1: IZ1, along: 'x' }, { x0: IX0, x1: GXW, z0: ZG, z1: GZF, along: 'z' }, { x0: IX0, x1: IX1, z0: IZ0, z1: ZG, along: 'x' }];
  for (const b of bands) {
    if (b.along === 'x') {
      plankField(ku, mul(T(0, U1, 0), RX(-Math.PI / 2)), { u0: b.x0, u1: b.x1, v0: -b.z1, v1: -b.z0, w: 0.16, t: 0.03, tint: vary(ku, FLOOR, 0.9, 1.0), maxL: 4.8, step: 2.4, extra: { inside: true, floor: true } });
      plankField(k, mul(T(0, UJ, 0), RX(Math.PI / 2)), { u0: b.x0, u1: b.x1, v0: b.z0, v1: b.z1, w: 0.22, t: 0.02, tint: CEILC, maxL: 4.8, step: 2.4, extra: { inside: true } });
      for (let x = b.x0 + 0.4; x < b.x1 - 0.2; x += 0.7) k.board([0.06, 0.18, b.z1 - b.z0 - 0.02], [x, UJ - 0.09, (b.z0 + b.z1) / 2], null, { long: 2, tint: vary(k, WAIN, 0.85, 1.05), skip: '+y', cuts: [0], segFaces: '-y+x-x', inside: true });
    } else {
      plankField(ku, mul(T(0, U1, 0), RY(-Math.PI / 2), RX(-Math.PI / 2)), { u0: b.z0, u1: b.z1, v0: b.x0, v1: b.x1, w: 0.16, t: 0.03, tint: vary(ku, FLOOR, 0.9, 1.0), maxL: 4.8, step: 2.4, extra: { inside: true, floor: true } });
      plankField(k, mul(T(0, UJ, 0), RY(-Math.PI / 2), RX(Math.PI / 2)), { u0: b.z0, u1: b.z1, v0: -b.x1, v1: -b.x0, w: 0.22, t: 0.02, tint: CEILC, maxL: 4.8, step: 2.4, extra: { inside: true } });
      for (let z = b.z0 + 0.4; z < b.z1 - 0.2; z += 0.7) k.board([b.x1 - b.x0 - 0.02, 0.18, 0.06], [(b.x0 + b.x1) / 2, UJ - 0.09, z], null, { long: 0, tint: vary(k, WAIN, 0.85, 1.05), skip: '+y', cuts: [0], segFaces: '-y+z-z', inside: true });
    }
    k.solid([b.x1 - b.x0, U1 - UJ, b.z1 - b.z0], [(b.x0 + b.x1) / 2, (U1 + UJ) / 2, (b.z0 + b.z1) / 2]);
  }
  // THE CEILING over everything (in the roof's own mesh, so a plan view can take both away): planks, beams across
  plankField(kr, mul(T(0, CEIL, 0), RY(-Math.PI / 2), RX(Math.PI / 2)), { u0: IZ0, u1: IZ1, v0: -IX1, v1: -IX0, w: 0.24, tint: CEILC, maxL: 4.8, step: 2.4, extra: { inside: true } });
  k.solid([IX1 - IX0, 0.1, IZ1 - IZ0], [0, CEIL + 0.05, 0]);
  for (const z of [ZG + 1.1, GZF - 1.1]) kr.board([IX1 - GXW, 0.2, 0.16], [(GXW + IX1) / 2, CEIL - 0.1, z], null, { long: 0, tint: vary(kr, WAIN, 0.85, 1.0), cuts: [-2, 0, 2], segFaces: '-y+z-z', ends: 'log', inside: true });
  // THE WELL'S EDGES: a beam under each (the back one on the two posts that frame the stage, the side and front ones meeting
  // on a post at the well's front left corner), a fascia over the joists' ends; curved brackets up from the posts
  const beam = (size, pos, long) => k.board(size, pos, null, { long, tint: vary(k, WAIN, 0.9, 1.05), cuts: [-3, -1.5, 0, 1.5, 3].filter((c) => Math.abs(c) < Math.max(...size) / 2 - 0.3), segFaces: long === 0 ? '+z-z-y' : '+x-x-y', ends: 'log', inside: true });
  beam([IX1 - IX0, 0.24, 0.18], [0, UJ - 0.12, ZG - 0.07], 0);
  beam([0.18, 0.24, GZF - ZG + 0.1], [GXW - 0.09, UJ - 0.12, (ZG + GZF) / 2], 2);
  beam([IX1 - GXW + 0.1, 0.24, 0.18], [(GXW + IX1) / 2, UJ - 0.12, GZF + 0.09], 0);
  k.board([IX1 - GXW, 0.12, 0.03], [(GXW + IX1) / 2, U1 - 0.04, ZG + 0.015], null, { long: 0, tint: vary(k, WAIN, 0.8, 0.95), inside: true, skip: '-z' });
  k.board([0.03, 0.12, GZF - ZG], [GXW + 0.015, U1 - 0.04, (ZG + GZF) / 2], null, { long: 2, tint: vary(k, WAIN, 0.8, 0.95), inside: true, skip: '-x' });
  k.board([IX1 - GXW, 0.12, 0.03], [(GXW + IX1) / 2, U1 - 0.04, GZF - 0.015], null, { long: 0, tint: vary(k, WAIN, 0.8, 0.95), inside: true, skip: '+z' });
  const post = (x, z, dirs) => {
    k.board([0.2, UJ - 0.24 - FL, 0.2], [x, (FL + UJ - 0.24) / 2, z], null, { long: 1, tint: vary(k, WAIN, 0.92, 1.05), strip: 10, cuts: [-1, 0.5], segFaces: '+x-x+z-z', skip: '-y', ends: 'log', inside: true });
    k.board([0.26, 0.25, 0.26], [x, FL + 0.125, z], null, { long: 1, tint: vary(k, WAIN, 0.8, 0.9), inside: true, skip: '-y' });
    k.board([0.24, 0.12, 0.24], [x, UJ - 0.3, z], null, { long: 1, tint: vary(k, WAIN, 0.85, 0.95), inside: true });
    k.solid([0.2, UJ - FL, 0.2], [x, (FL + UJ) / 2, z]);
    for (const e of dirs) arcBracket(k, x + e[0] * 0.1, z + e[1] * 0.1, UJ - 0.24, e, 0.55, [0.1, 0.1], () => ({ tint: vary(k, WAIN, 0.85, 1.0), inside: true }));
  };
  post(-GPX, ZG - 0.07, [[1, 0], [-1, 0]]); post(GPX, ZG - 0.07, [[1, 0], [-1, 0]]); post(GXW - 0.09, GZF + 0.09, [[1, 0], [0, -1]]);
  // THE GALLERY RAILINGS round the well: turned balusters under a heavy rail, turned newels at the corners and the stairs'
  // top (the side gallery's railing and the front's meet over the corner post)
  const RL = { inside: true, every: 0.25, h: 0.98 }, nb = U1, ns = (x, z) => turnedNewel(k, x, z, nb, 1.12, 'varnish');
  const zb = ZG - 0.06, xw = GXW - 0.06, zf = GZF + 0.06;
  ns(xw, zb); ns(xw, zf); ns(GPX, zb); ns(1.3, zf);
  railing(k, 'x', xw + 0.07, GPX - 0.07, zb, nb, null, RL); railing(k, 'x', GPX + 0.07, STX0 - 0.04, zb, nb, null, RL);
  railing(k, 'z', zb + 0.07, zf - 0.07, xw, nb, null, RL);
  railing(k, 'x', xw + 0.07, 1.3 - 0.07, zf, nb, null, RL); railing(k, 'x', 1.3 + 0.07, IX1 - 0.02, zf, nb, null, RL);
  // THE GALLERIES' WALLS (the rooms behind them): faded damask over a wainscot on the gallery side, the rooms' own paper on
  // theirs; between the rooms, walls papered both sides. Every room's door: a casing each side, the leaf shut on its hinge
  const HP = { kit: ku, goods: GU, wy: U1 + 1.0 }, RP = { kit: ku, goods: GU, paper: A.roomPaper, rep: 0.9, wain: false };
  const doorsOn = (ax, at) => ROOMS.filter((R) => R.door.ax === ax && Math.abs(R.door.at - at) < 1e-6).map((R) => ({ c: R.door.c, w: RD.w, y0: U1, y1: U1 + RD.h, door: true }));
  const t2 = 0.06;
  // the back wall of the galleries (z = ZP): toward the gallery for x > RX1, toward the side room behind it for x < RX1;
  // its other face toward the back rooms
  face(ku, RX1, ZP + t2, IX1, ZP + t2, [0, 1], U1, CEIL, doorsOn('z', ZP), HP);
  face(ku, IX0, ZP + t2, RX1, ZP + t2, [0, 1], U1, CEIL, [], RP);
  face(ku, IX0, ZP - t2, IX1, ZP - t2, [0, -1], U1, CEIL, doorsOn('z', ZP), RP);
  // the side gallery's wall (x = RX1)
  face(ku, RX1 + t2, ZP + t2, RX1 + t2, RZ0 - t2, [1, 0], U1, CEIL, doorsOn('x', RX1), HP);
  face(ku, RX1 - t2, ZP + t2, RX1 - t2, RZ0 - t2, [-1, 0], U1, CEIL, doorsOn('x', RX1), RP);
  // the front gallery's wall (z = RZ0)
  face(ku, RX1, RZ0 - t2, IX1, RZ0 - t2, [0, -1], U1, CEIL, doorsOn('z', RZ0), HP);
  face(ku, IX0, RZ0 - t2, RX1, RZ0 - t2, [0, -1], U1, CEIL, [], RP);
  face(ku, IX0, RZ0 + t2, IX1, RZ0 + t2, [0, 1], U1, CEIL, doorsOn('z', RZ0), RP);
  // between the rooms
  for (const [x, za, zz] of [[-1.2, RZ0, IZ1], [1.7, RZ0, IZ1], [0.1, IZ0, ZP]]) { face(ku, x + t2, za + t2, x + t2, zz, [1, 0], U1, CEIL, [], RP); face(ku, x - t2, za + t2, x - t2, zz, [-1, 0], U1, CEIL, [], RP); }
  face(ku, IX0, -0.2 + t2, RX1 - t2, -0.2 + t2, [0, 1], U1, CEIL, [], RP); face(ku, IX0, -0.2 - t2, RX1 - t2, -0.2 - t2, [0, -1], U1, CEIL, [], RP);
  for (const [x0, z0, x1, z1] of [[IX0, ZP, IX1, ZP], [RX1, ZP, RX1, RZ0], [IX0, RZ0, IX1, RZ0], [-1.2, RZ0, -1.2, IZ1], [1.7, RZ0, 1.7, IZ1], [0.1, IZ0, 0.1, ZP], [IX0, -0.2, RX1, -0.2]]) k.solid([Math.max(0.12, Math.abs(x1 - x0)), CEIL - U1, Math.max(0.12, Math.abs(z1 - z0))], [(x0 + x1) / 2, (U1 + CEIL) / 2, (z0 + z1) / 2]);
  const roomDoors = ROOMS.map((R, i) => roomDoor(ku, R, i));
  // the rooms' numbers on the gallery side of their doors, a little brass oval each
  ROOMS.forEach((R, i) => {
    const d = R.door, g = -d.into;   // (the gallery is on the far side from the room)
    const m = d.ax === 'z' ? mul(T(d.c, U1 + 1.72, d.at + g * 0.05), g < 0 ? RY(Math.PI) : new THREE.Matrix4()) : mul(T(d.at + g * 0.05, U1 + 1.72, d.c), RY(g > 0 ? Math.PI / 2 : -Math.PI / 2));
    pic(A.plates[i], 0.14, 0.088, m);
  });
  // sconces and a picture on the galleries' walls (one of them a lamp)
  lamps.push(sconce(ku, 0.7, U1 + 1.75, ZP + t2 + 0.012, 1, 2.0)); sconce(ku, -2.05, U1 + 1.75, ZP + t2 + 0.012, 1, 0);
  sconce(ku, 2.4, U1 + 1.75, RZ0 - t2 - 0.012, -1, 0); sconce(ku, RX1 + t2 + 0.012, U1 + 1.75, 0.6, 1, 0, 'x');
  pic(A.pictures[1], 0.62, 0.48, T(0.0, U1 + 1.3, ZP + t2 + 0.02)); frame(ku, 0.0, U1 + 1.3, ZP + t2 + 0.015, 0.62, 0.48, 'z');
  pic(A.pictures[0], 0.6, 0.46, mul(T(1.45, U1 + 1.35, RZ0 - t2 - 0.02), RY(Math.PI)));
  // THE WALLS: wainscot and wallpaper on the four outer walls downstairs; the well's part of the east wall up to the
  // ceiling; upstairs, the rooms' paper and the galleries' ends
  wallInside(k, FRONT, IX0, IX1, FL, UJ, [DOOR_A, WA1, WA2]);
  wallInside(k, WEST, IZ0, IZ1, FL, UJ, [DOOR_B, WB1, WB3], { skip: [[BBZ0 - 0.05, BBZ1 + 0.05, FL - 1, UJ + 1]] });
  wallInside(k, EAST, -IZ1, -GZF, FL, UJ, [WE1]); wallInside(k, EAST, -ZG, -IZ0, FL, UJ, [WE2]);
  wallInside(k, EAST, -GZF, -ZG, FL, CEIL, [UE[1]]);
  wallInside(k, BACK, -IX1, -IX0, FL, UJ, [WK1], { skip: [[-SX1 - 0.05, -SX0 + 0.05, FL - 1, UJ + 1]] });
  wallInside(ku, FRONT, IX0, IX1, U1, CEIL, UA, RP);
  wallInside(ku, WEST, IZ0, IZ1, U1, CEIL, UB, RP);
  wallInside(ku, EAST, -IZ1, -RZ0, U1, CEIL, [UE[0]], RP); wallInside(ku, EAST, -RZ0, -GZF, U1, CEIL, [], HP); wallInside(ku, EAST, -ZG, -ZP, U1, CEIL, [], HP);
  wallInside(ku, EAST, -ZP, -IZ0, U1, CEIL, [UE[2]], RP);
  wallInside(ku, BACK, -IX1, -IX0, U1, CEIL, UK, RP);
  return roomDoors;
}
// A TURNED NEWEL: a square foot, a turned shaft (a vase and a neck between collars), a square block, a cap and a small
// ball on it; h tall from y0
function turnedNewel(k, x, z, y0, h, finish) {
  const tint = vary(k, WAIN, 0.92, 1.05), paint = finish === 'varnish' ? VARN : null, o = { tint, paint, inside: true, smooth: true };
  k.board([0.15, 0.32, 0.15], [x, y0 + 0.16, z], null, { long: 1, tint, paint, inside: true, skip: '-y' });
  k.prism('wood', ngon(6, 0.07), 0.05, [x, y0 + 0.345, z], null, { ...o, skip: '-y' });
  k.prism('wood', ngon(6, 0.05), h - 0.72, [x, y0 + 0.37 + (h - 0.72) / 2, z], null, { ...o, taper: -0.35, skip: '+y-y' });
  k.board([0.14, 0.2, 0.14], [x, y0 + h - 0.24, z], null, { long: 1, tint, paint, inside: true });
  k.board([0.18, 0.04, 0.18], [x, y0 + h - 0.12, z], null, { long: 0, tint, paint, inside: true });
  k.prism('wood', ngon(6, 0.025), 0.03, [x, y0 + h - 0.085, z], null, { ...o, skip: '-y+y' });
  k.prism('wood', ngon(6, 0.045), 0.045, [x, y0 + h - 0.05, z], null, { ...o, taper: -0.5, skip: '-y+y' });
  k.prism('wood', ngon(6, 0.045), 0.045, [x, y0 + h - 0.005, z], null, { ...o, taper: 0.8, skip: '-y' });
  k.solid([0.15, h, 0.15], [x, y0 + h / 2, z]);
}
// a sconce: a brass plate and arm on a wall, an oil lamp with a glass chimney (face: which way it points, along z)
function sconce(k, x, y, z, face, strength, ax = 'z') {
  const P = (d) => (ax === 'z' ? [x, y, z + face * d] : [x + face * d, y, z]);
  k.box('iron', ax === 'z' ? [0.08, 0.18, 0.015] : [0.015, 0.18, 0.08], P(0.008), null, { tint: BRASS });
  k.box('iron', ax === 'z' ? [0.015, 0.015, 0.18] : [0.18, 0.015, 0.015], P(0.09).map((v, i) => (i === 1 ? v - 0.05 : v)), null, { tint: BRASS });
  const c = P(0.18);
  k.prism('iron', ngon(6, 0.045), 0.06, [c[0], c[1] - 0.06, c[2]], null, { tint: BRASS, smooth: true, taper: -0.4 });
  chimney(k, c[0], c[1] - 0.03, c[2]);
  return { p: [c[0], c[1] + 0.05, c[2]], reach: 6.5, strength };
}
// a lamp's glass chimney: a round bulb low, a narrow neck over it (two glowing glass pieces), the flame in the bulb
function chimney(k, x, y, z, s = 1) {
  k.parts.glow.push({ size: [0.075 * s, 0.075 * s, 0.075 * s], m: mul(T(x, y + 0.045 * s, z), RY(Math.PI / 4)), kind: GLOW.glass, col: [0.9, 0.42, 0.1] });
  k.parts.glow.push({ size: [0.04 * s, 0.11 * s, 0.04 * s], m: mul(T(x, y + 0.13 * s, z), RY(Math.PI / 4)), kind: GLOW.glass, col: [0.75, 0.34, 0.08] });
  k.parts.glow.push({ size: [0.014 * s, 0.04 * s, 0.014 * s], m: T(x, y + 0.04 * s, z), kind: GLOW.flame, col: [9, 5.4, 1.6] });
}
// a picture frame (dark wood mouldings) round a picture at (x, y, z), its face along ax ('z': facing +z; 'x': facing ±x)
function frame(k, x, y, z, w, h, ax, face = 1) {
  const b = (size, p) => k.board(ax === 'z' ? size : [size[2], size[1], size[0]], ax === 'z' ? [x + p[0], y + p[1], z + p[2]] : [x + face * p[2], y + p[1], z - face * p[0]], null, { long: size[0] > size[1] ? (ax === 'z' ? 0 : 2) : 1, tint: [0.42, 0.3, 0.2], paint: [0.2, 0.13, 0.05], inside: true });
  for (const s of [-1, 1]) { b([w + 0.1, 0.05, 0.03], [0, s * (h / 2 + 0.025), 0]); b([0.05, h, 0.03], [s * (w / 2 + 0.025), 0, 0]); }
}

// THE STAGE: a platform (a skirt of boards round its front, planks on it), footlights along its front edge (candles in
// tin hoods), steps up at its left; red velvet: a back curtain, drapes swagged to the gallery's posts, a valance with a
// gold fringe under the gallery's beam
function stage(k, lamps) {
  const zf = SZ1;
  plankField(k, mul(T(0, STG, 0), RX(-Math.PI / 2)), { u0: SX0, u1: SX1, v0: -zf, v1: -SZ0, w: 0.15, t: 0.03, tint: vary(k, FLOOR, 0.8, 0.9), maxL: 2.6, step: 1.0, nails: true, extra: { inside: true } });
  k.solid([SX1 - SX0, STG - FL, zf - SZ0], [0, (STG + FL) / 2, (zf + SZ0) / 2]);
  for (let x = SX0; x < SX1 - 0.01;) {
    const bw = Math.min(k.r(0.14, 0.2), SX1 - x);
    k.board([bw + 0.002, STG - FL, 0.025], [x + bw / 2, (STG + FL) / 2, zf + 0.012], null, { long: 1, tint: vary(k, WAIN, 0.8, 1.05), skip: '-z+x-x', inside: true });
    x += bw;
  }
  for (const s of [-1, 1]) k.board([0.025, STG - FL, zf - SZ0], [s * SX1 + s * 0.012, (STG + FL) / 2, (zf + SZ0) / 2], null, { long: 2, tint: vary(k, WAIN, 0.75, 0.9), inside: true });
  k.board([SX1 - SX0 + 0.06, 0.05, 0.08], [0, STG - 0.02, zf + 0.03], null, { long: 0, tint: vary(k, WAIN, 0.9, 1.0), inside: true });
  // the footlights: tin hoods turned toward the stage, a candle in each
  for (let x = SX0 + 0.35; x < SX1 - 0.2; x += 0.55) {
    k.box('iron', [0.16, 0.12, 0.012], [x, STG + 0.06, zf + 0.07], [-0.2, 0, 0], { tint: [2.2, 2.2, 2.3] });
    k.box('iron', [0.16, 0.012, 0.09], [x, STG + 0.005, zf + 0.03], null, { tint: [2.2, 2.2, 2.3] });
    k.prism('wood', ngon(6, 0.012), 0.07, [x, STG + 0.04, zf + 0.025], null, { paint: [0.8, 0.76, 0.66], tint: [1, 1, 1], smooth: true });
    k.parts.glow.push({ size: [0.014, 0.035, 0.014], m: T(x, STG + 0.095, zf + 0.025), kind: GLOW.flame, col: [9, 5.4, 1.6] });
  }
  lamps.push({ p: [0, STG + 0.12, zf + 0.05], reach: 6.5, strength: 3.6, dir: [0, 0.42, -0.91], glow: [0, STG + 0.12, zf + 0.1] });
  // the steps up, at its left front
  for (let j = 0; j < 3; j++) {
    const y = FL + (j + 1) * 0.2, z = zf + 0.84 - j * 0.28;
    k.board([0.95, 0.04, 0.3], [SX0 + 0.55, y - 0.02, z - 0.13], null, { long: 0, tint: vary(k, FLOOR, 0.85, 1.0), inside: true, floor: true });
    k.board([0.95, 0.2, 0.02], [SX0 + 0.55, y - 0.1, z + 0.02], null, { long: 0, tint: vary(k, WAIN, 0.8, 0.95), inside: true, skip: '-z' });
  }
  for (const s of [-1, 1]) k.board([0.03, 0.6, 0.86], [SX0 + 0.55 + s * 0.475, FL + 0.3, zf + 0.43], null, { long: 2, tint: vary(k, WAIN, 0.8, 0.95), inside: true, shape: undefined });
  k.solid([0.95, 0.4, 0.84], [SX0 + 0.55, FL + 0.2, zf + 0.42]);
  // THE VELVET. The back curtain: closed, in folds, from the gallery's underside to the stage floor
  const fold = (nu, amp, wl) => (i, x) => Math.sin(i / nu * Math.PI * 2 * wl + x) * amp;
  // (a curtain's texture: the velvet picture once across every 1.2 m; its own folds bend the corners as well)
  const vcurt = (M, W, H, nu, amp, wl, gather, tint) => {
    const f = fold(nu, amp, wl);
    for (let s = 0; s < nu; s += 6) {
      const n = Math.min(6, nu - s);
      G.grid(n, 3, (i, j) => { let x = -W / 2 + W * (s + i) / nu; const y = -H / 2 + H * j / 3; let z = f(s + i, 0); if (gather) [x, z] = gather(x, y, z); return [x, y, z]; },
        (i, j) => [i / n, j / 3], [A.velvet[0], A.velvet[1], A.velvet[2] * n / 6, A.velvet[3]], tint, M);
    }
  };
  vcurt(T(0, (STG + UJ) / 2, SZ0 + 0.18), SX1 - SX0 + 0.3, UJ - STG + 0.04, 30, 0.06, 7, null, [0.85, 0.85, 0.85]);
  // the drapes at the front: hung from the gallery's beam, swept back to the posts and tied there
  for (const s of [-1, 1]) {
    const W = 1.15, H = UJ - 0.24 - STG, x0 = s * (GPX - 0.15);
    vcurt(T(x0 - s * W / 2, STG + H / 2, ZG - 0.24), W, H, 12, 0.05, 2, (x, y, z) => {
      // (gathered toward the post: to a third of its width at the tie, a metre up; flaring a little below it)
      const t = (y + H / 2) / H, tie = 0.33, g = t > tie ? 0.34 + 0.66 * Math.pow((t - tie) / (1 - tie), 1.3) : 0.34 + 0.22 * (tie - t) / tie;
      return [s > 0 ? W / 2 - (W / 2 - x) * g : -W / 2 + (x + W / 2) * g, z * (0.45 + 0.55 * g) + 0.04 * (1 - g)];
    }, [0.95, 0.95, 0.95]);
    // the tie-back: a gold cord round it
    k.box('iron', [0.32, 0.03, 0.12], [x0 - s * 0.16, STG + 0.95, ZG - 0.24], [0, 0, s * 0.1], { tint: [1.6, 1.2, 0.5] });
  }
  // the valance: swags across under the beam, a gold fringe along its foot
  const VW = 2 * GPX - 0.1, VH = 0.5, vy = UJ - 0.24 - VH / 2;
  for (let i = 0; i < 4; i++) {
    const sw = VW / 4, cx = -VW / 2 + sw * (i + 0.5);
    vcurt(mul(T(cx, vy, ZG - 0.18)), sw, VH, 6, 0.03, 1.5, (x, y, z) => [x, z + 0.06 * Math.cos(x / sw * Math.PI)], [1.05, 1.05, 1.05]);
    const fr = A.fringe;
    // (the fringe hangs along the swag's bottom edge, which curves down in the middle)
    for (let q = 0; q < 4; q++) {
      const xa = cx - sw / 2 + sw * q / 4, xb = xa + sw / 4, dip = (x) => 0.1 * Math.cos((x - cx) / sw * Math.PI);
      const g = new THREE.PlaneGeometry(sw / 4 + 0.005, 0.12), [u0, v0, u1, v1] = regionUV(fr), U = g.attributes.uv;
      for (let n = 0; n < U.count; n++) U.setXY(n, u0 + (u1 - u0) * (q / 4 + U.getX(n) / 4), v0 + (v1 - v0) * U.getY(n));
      const ya = vy - VH / 2 - dip(xa) + 0.03, yb = vy - VH / 2 - dip(xb) + 0.03, ang = Math.atan2(yb - ya, xb - xa);
      g.applyMatrix4(mul(T((xa + xb) / 2, (ya + yb) / 2 - 0.05, ZG - 0.14), RZ(ang))); decals.push(g);
    }
  }
  // the stage's own lamp, hung under the gallery over its middle
  lamps.push(lantern(k, 0.3, 3.45, -4.1, { chain: UJ - 3.45 - 0.23 - 0.02, strength: 2.2 }));
}

// THE STAIRS: up the east wall from the front to the back gallery: treads with a nosing, risers, a stringer on the wall
// and a heavy one on the open side, both along the treads' own slope (the line through every tread's nose); a handrail
// 0.85 m over that line on turned balusters, two to a tread, that stop under it; a turned newel at the foot (a lamp on it)
// and one at the top on the gallery
function stairs(k, lamps) {
  const W = STX1 - STX0, xc = (STX0 + STX1) / 2;
  for (let i = 1; i <= SR; i++) {
    const y = FL + i * RISE, zr = STZ0 - (i - 1) * RUN;   // (the riser's face; the tread runs back from it toward -z)
    k.board([W, RISE, 0.025], [xc, y - RISE / 2, zr - 0.0125], null, { long: 0, tint: vary(k, WAIN, 0.75, 0.9), inside: true });
    if (i < SR) k.board([W + 0.03, 0.04, RUN + 0.03], [xc + 0.015, y - 0.02, zr - RUN / 2 + 0.015], null, { long: 0, tint: vary(k, FLOOR, 0.85, 1.05), inside: true, floor: true });
  }
  // the nosing line: y over a point z (rising toward -z); a board along it is turned so its +z end goes DOWN
  const sl = RISE / RUN, ang = Math.atan(sl), yN = (z) => FL + RISE + (STZ0 - z) * sl, along = (len, z, dy, size, o) => k.board([size[0], size[1], len], [o.x, yN(z) + dy, z], [ang, 0, 0], { long: 2, ...o.p });
  const zA = STZ0 + 0.1, zZ = ZG + 0.05, mz = (zA + zZ) / 2, len = (zA - zZ) / Math.cos(ang);
  along(len, mz, -0.2, [0.07, 0.32], { x: STX0 - 0.035, p: { tint: vary(k, WAIN, 0.85, 1.0), paint: VARN, inside: true } });
  along(len - 0.2, mz, -0.16, [0.04, 0.3], { x: STX1 - 0.02, p: { tint: vary(k, WAIN, 0.8, 0.95), inside: true } });
  for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4; k.solid([W, 0.3, (STZ0 - ZG) / 4], [xc, FL + (U1 - FL) * t - 0.15, STZ0 - (STZ0 - ZG) * t]); }
  // the handrail between the newels, the balusters under it
  const nx = STX0 + 0.03, railH = 0.85, rz0 = STZ0 + 0.0, rz1 = ZG + 0.02, rl = (rz0 - rz1) / Math.cos(ang);
  along(rl, (rz0 + rz1) / 2, railH + 0.035, [0.1, 0.07], { x: nx, p: { tint: vary(k, WAIN, 0.9, 1.0), paint: VARN, inside: true } });
  for (let i = 1; i < SR; i++) for (const f of [0.25, 0.75]) {
    const zr = STZ0 - (i - 1) * RUN - RUN * f, yb = FL + i * RISE, yt = yN(zr) + railH;
    if (zr < ZG + 0.1 || zr > STZ0 - 0.12) continue;
    baluster(k, nx, zr, yb, yt, null, true);
  }
  turnedNewel(k, nx, STZ0 + 0.08, FL, 1.12, 'varnish');
  turnedNewel(k, nx, ZG - 0.06, U1, 1.12, 'varnish');
  // a lamp on the newel at the foot: a brass font, its glass chimney
  const ly = FL + 1.12 + 0.02;
  k.prism('iron', ngon(6, 0.06), 0.1, [nx, ly + 0.05, STZ0 + 0.08], null, { tint: BRASS, smooth: true, taper: 0.4 });
  chimney(k, nx, ly + 0.1, STZ0 + 0.08, 1.3);
  lamps.push({ p: [nx, ly + 0.25, STZ0 + 0.08], reach: 6.5, strength: 1.8 });
  // (the wall beside the stairs: a rail on the wall, the same slope)
  along(len - 0.6, mz, railH, [0.05, 0.06], { x: STX1 - 0.04, p: { tint: vary(k, WAIN, 0.9, 1.0), inside: true } });
}

// THE BAR down the left: the counter (a moulded top in dark varnish, carved panels between pilasters, a kick board, a
// brass foot rail on brackets), brass tap towers and glass lamps on its top; the back-bar against the wall (a cabinet
// under a counter, an arched mirror between shelves of bottles under a cornice, sconces, antlers over it)
function bar(k, lamps) {
  const x0 = BXF - BD, xm = BXF - BD / 2, top = FL + BH, L = BZ1 - BZ0, zc = (BZ0 + BZ1) / 2;
  const P = { inside: true };
  // the top: a thick slab with a rounded nose; the counter's body; the panels on its front
  k.board([BD + 0.1, 0.05, L + 0.1], [xm + 0.02, top - 0.025, zc], null, { long: 2, tint: DARKW, paint: VARN, ...P, cuts: [-1.5, 0, 1.5], segFaces: '+y' });
  k.prism('wood', ngon(8, 0.035), L + 0.1, null, null, { m: mul(T(BXF + 0.075, top - 0.03, zc), RX(Math.PI / 2)), tint: DARKW, paint: VARN, smooth: true, ...P });
  k.board([BD - 0.08, BH - 0.1, L], [xm - 0.02, FL + (BH - 0.1) / 2, zc], null, { long: 2, tint: vary(k, DARKW, 0.85, 1.0), ...P, skip: '-y+y' });
  k.solid([BD, BH, L], [xm, FL + BH / 2, zc]);
  const np = Math.round(L / 0.62);
  for (let i = 0; i <= np; i++) {
    const z = BZ0 + L * i / np;
    k.board([0.05, BH - 0.2, 0.1], [BXF + 0.025, FL + 0.12 + (BH - 0.2) / 2, z], null, { long: 1, tint: vary(k, DARKW, 0.9, 1.05), paint: VARN, ...P });   // the pilasters
    k.board([0.07, 0.08, 0.13], [BXF + 0.04, top - 0.12, z], null, { long: 1, tint: DARKW, paint: VARN, ...P });
    if (i < np) {
      const pz = z + L / np / 2, pw = L / np - 0.16;
      k.board([0.02, 0.62, pw], [BXF + 0.01, FL + 0.55, pz], null, { long: 1, tint: vary(k, DARKW, 1.0, 1.15), ...P, skip: '-x' });   // a raised panel
      k.board([0.02, 0.12, pw], [BXF + 0.01, FL + 0.98, pz], null, { long: 2, tint: vary(k, DARKW, 1.0, 1.15), ...P, skip: '-x' });
    }
  }
  k.board([0.04, 0.12, L], [BXF + 0.02, FL + 0.06, zc], null, { long: 2, tint: vary(k, DARKW, 0.7, 0.8), ...P, skip: '-x' });
  // the front end: a panel across it, a pilaster at each corner
  k.board([BD, BH - 0.15, 0.03], [xm, FL + (BH - 0.15) / 2 + 0.05, BZ1 + 0.015], null, { long: 0, tint: vary(k, DARKW, 0.95, 1.1), ...P });
  k.board([BD - 0.2, 0.6, 0.02], [xm, FL + 0.6, BZ1 + 0.03], null, { long: 1, tint: vary(k, DARKW, 1.0, 1.15), ...P, skip: '-z' });
  // the foot rail: brass on brackets, a few cm off the floor
  k.prism('iron', ngon(8, 0.025), L + 0.2, null, null, { m: mul(T(BXF + 0.22, FL + 0.18, zc + 0.05), RX(Math.PI / 2)), tint: BRASS, smooth: true });
  for (let i = 0; i <= 5; i++) k.box('iron', [0.22, 0.04, 0.03], [BXF + 0.11, FL + 0.18, BZ0 + 0.2 + (L - 0.2) * i / 5], null, { tint: BRASS });
  // the tap towers: a brass column, a cross arm, taps with black handles
  for (const z of [0.6, 3.0]) {
    const x = xm - 0.12;
    k.prism('iron', ngon(8, 0.05), 0.04, [x, top + 0.02, z], null, { tint: BRASS, smooth: true });
    k.prism('iron', ngon(8, 0.032), 0.36, [x, top + 0.2, z], null, { tint: BRASS, smooth: true, taper: 0.15 });
    k.prism('iron', ngon(8, 0.05), 0.06, [x, top + 0.41, z], null, { tint: BRASS, smooth: true, taper: 0.4 });
    for (const s of [-1, 1]) {
      k.box('iron', [0.12, 0.025, 0.025], [x + 0.05, top + 0.3, z + s * 0.07], null, { tint: BRASS });
      k.box('iron', [0.02, 0.07, 0.02], [x + 0.11, top + 0.26, z + s * 0.07], null, { tint: BRASS });
      k.box('iron', [0.022, 0.1, 0.022], [x + 0.05, top + 0.37, z + s * 0.07], null, { tint: [0.3, 0.3, 0.32] });
    }
  }
  // the glass lamps on the bar's top: a brass foot, a glass font, the chimney glowing
  for (const z of [1.8, 3.75, -0.2]) { const L = barLamp(k, xm + 0.1, top, z, 1.6); if (z !== -0.2) lamps.push(L); }
  // THE BACK-BAR: a cabinet with doors under a counter; above it a mirror under an arch, shelves of bottles either side,
  // pilasters and a cornice; sconces; a pair of antlers over it and the drinks board
  const bx0 = IX0, bx1 = IX0 + BBD, bxc = (bx0 + bx1) / 2, BL = BBZ1 - BBZ0, bzc = (BBZ0 + BBZ1) / 2, ct = FL + 1.0;
  k.board([BBD, 1.0 - 0.04, BL], [bxc, FL + 0.48, bzc], null, { long: 2, tint: vary(k, DARKW, 0.85, 1.0), ...P, skip: '-y-x' });
  k.board([BBD + 0.06, 0.05, BL + 0.04], [bxc + 0.03, ct - 0.02, bzc], null, { long: 2, tint: DARKW, paint: VARN, ...P });
  k.solid([BBD, 1.0, BL], [bxc, FL + 0.5, bzc]);
  for (let i = 0; i < 6; i++) { const z = BBZ0 + BL * (i + 0.5) / 6; k.board([0.02, 0.7, BL / 6 - 0.06], [bx1 + 0.005, FL + 0.48, z], null, { long: 1, tint: vary(k, DARKW, 1.0, 1.15), ...P, skip: '-x' }); k.box('iron', [0.02, 0.03, 0.05], [bx1 + 0.02, FL + 0.7, z], null, { tint: BRASS }); }
  // the upper part: a back panel to the cornice, pilasters, the mirror's arched frame, shelves
  const ut = FL + 2.92, MZ0 = 0.85, MZ1 = 2.55, MY0 = ct + 0.12, MY1 = ut - 0.42;
  k.board([0.03, ut - ct, BL], [bx0 + 0.015, (ct + ut) / 2, bzc], null, { long: 1, tint: vary(k, DARKW, 0.8, 0.9), ...P, skip: '-x' });
  for (const z of [BBZ0 + 0.06, MZ0 - 0.07, MZ1 + 0.07, BBZ1 - 0.06]) {
    k.board([0.14, ut - ct - 0.2, 0.12], [bx0 + 0.09, (ct + ut - 0.2) / 2, z], null, { long: 1, tint: vary(k, DARKW, 0.9, 1.05), paint: VARN, ...P });
    k.board([0.18, 0.1, 0.16], [bx0 + 0.1, ut - 0.25, z], null, { long: 1, tint: DARKW, paint: VARN, ...P });
  }
  k.board([0.3, 0.12, BL + 0.16], [bx0 + 0.15, ut - 0.1, bzc], null, { long: 2, tint: DARKW, paint: VARN, ...P });
  k.board([0.36, 0.06, BL + 0.24], [bx0 + 0.18, ut + 0.0, bzc], null, { long: 2, tint: DARKW, paint: VARN, ...P });
  k.board([0.06, 0.3, BL - 0.1], [bx0 + 0.06, ut + 0.18, bzc], null, { long: 2, tint: vary(k, DARKW, 0.9, 1.0), paint: VARN, ...P });   // the crest board
  // the mirror (the saloon's picture): straight sides, an arched top (a half ellipse); its frame: a sill, the sides and
  // the arch in short pieces round it
  const ar = (MZ1 - MZ0) / 2, acz = (MZ0 + MZ1) / 2, ah = ar * 0.55, ay = MY1 - ah, mx = bx0 + 0.04, mreg = A.mirror;
  const mv = (y) => (y - MY0) / (MY1 - MY0);
  G.fan([[mx, MY0, MZ1], [mx, MY0, MZ0], [mx, ay, MZ0], [mx, ay, MZ1]], [1, 0, 0], (p) => [(MZ1 - p[2]) / (MZ1 - MZ0), mv(p[1])], mreg, [1.05, 1.0, 0.95], new THREE.Matrix4());
  const arc = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; arc.push([mx, ay + Math.sin(a) * ah, acz + Math.cos(a) * ar]); }
  G.fan([[mx, ay, acz], ...arc], [1, 0, 0], (p) => [(MZ1 - p[2]) / (MZ1 - MZ0), mv(p[1])], mreg, [1.05, 1.0, 0.95], new THREE.Matrix4());
  k.board([0.07, 0.06, MZ1 - MZ0 + 0.1], [bx0 + 0.06, MY0 - 0.03, acz], null, { long: 2, tint: DARKW, paint: VARN, ...P });
  for (const z of [MZ0 - 0.03, MZ1 + 0.03]) k.board([0.07, ay - MY0 + 0.04, 0.06], [bx0 + 0.06, (MY0 + ay) / 2, z], null, { long: 1, tint: DARKW, paint: VARN, ...P });
  for (let i = 0; i < 7; i++) {
    const a0 = Math.PI * i / 7, a1 = Math.PI * (i + 1) / 7, q = (a) => [bx0 + 0.06, ay + Math.sin(a) * (ah + 0.03), acz + Math.cos(a) * (ar + 0.03)];
    between(k, 'wood', q(a0), q(a1), 0.07, 0.06, { over: 0.03, tint: DARKW, paint: VARN, ...P });
  }
  // (the corners over the arch: a panel either side, back from the frame)
  for (const s of [-1, 1]) k.board([0.02, ah + 0.1, ar * 0.55], [bx0 + 0.035, ay + (ah + 0.1) / 2, acz + s * (ar - ar * 0.275 + 0.03)], null, { long: 1, tint: vary(k, DARKW, 0.85, 0.95), ...P, skip: '-x' });
  // the shelves either side of the mirror, bottles on each (one quad of the bottle picture per shelf)
  for (const [z0, z1] of [[BBZ0 + 0.13, MZ0 - 0.14], [MZ1 + 0.14, BBZ1 - 0.13]]) {
    for (const [j, y] of [ct + 0.02, ct + 0.62, ct + 1.18, ct + 1.72].entries()) {
      if (j > 0) k.board([0.26, 0.03, z1 - z0], [bx0 + 0.15, y, (z0 + z1) / 2], null, { long: 2, tint: vary(k, DARKW, 0.9, 1.05), paint: VARN, ...P });
      {
        const reg = A.bottles[(j + Math.round(z0)) % 3], bh = j === 0 ? 0.36 : 0.3, wz = z1 - z0 - 0.02;
        const g = new THREE.PlaneGeometry(wz, bh), [u0, v0, u1, v1] = regionUV(reg), U = g.attributes.uv, fr = Math.min(1, wz / 1.6);
        for (let n = 0; n < U.count; n++) U.setXY(n, u0 + (u1 - u0) * U.getX(n) * fr, v0 + (v1 - v0) * U.getY(n));
        g.applyMatrix4(mul(T(bx0 + 0.16, y + 0.015 + bh / 2, (z0 + z1) / 2), RY(Math.PI / 2))); decals.push(g);
        const g2 = g.clone(); g2.translate(-0.06, 0.0, 0.0); decals.push(g2);   // (a second row behind the first)
      }
    }
  }
  // bottles along the back counter's top, under the mirror (a row each side of the till)
  for (const [z0, z1] of [[MZ0 + 0.04, 1.45], [1.95, MZ1 - 0.04]]) {
    const g = new THREE.PlaneGeometry(z1 - z0, 0.32), [u0, v0, u1, v1] = regionUV(A.bottles[1]), U = g.attributes.uv;
    for (let n = 0; n < U.count; n++) U.setXY(n, u0 + (u1 - u0) * U.getX(n) * Math.min(1, (z1 - z0) / 1.6), v0 + (v1 - v0) * U.getY(n));
    g.applyMatrix4(mul(T(bx0 + 0.32, ct + 0.18, (z0 + z1) / 2), RY(Math.PI / 2))); decals.push(g);
  }
  // a brass till between them
  k.box('iron', [0.3, 0.2, 0.4], [bx0 + 0.3, ct + 0.12, 1.7], null, { tint: BRASS });
  k.box('iron', [0.24, 0.12, 0.34], [bx0 + 0.27, ct + 0.28, 1.7], [0, 0, 0.35], { tint: BRASS.map((c) => c * 0.9) });
  // the drinks board on the crest, the antlers over it, the sconces on the pilasters
  pic(A.menu, 0.62, 0.23, mul(T(bx0 + 0.1, ut + 0.18, (MZ0 + MZ1) / 2), RY(Math.PI / 2)));
  frame(k, bx0 + 0.09, ut + 0.18, (MZ0 + MZ1) / 2, 0.62, 0.23, 'x', 1);
  // (the antlers on the well's wall over the stairs, where the heads in the concept hang high)
  into(k, mul(T(IX1, 5.95, -2.0), RY(Math.PI)), (t) => antlers(t, 0, 0, 0, 1.2), 811); into(k, mul(T(IX1, 5.8, 1.6), RY(Math.PI)), (t) => antlers(t, 0, 0, 0, 1.0), 813);
  lamps.push(sconce(k, bx0 + 0.1, ct + 1.55, MZ0 - 0.07, 1, 1.8, 'x'));
  sconce(k, bx0 + 0.1, ct + 1.55, MZ1 + 0.07, 1, 0, 'x');
  // the bottles on the bar's top and glasses: a few short quads standing on it
  for (const z of [2.3, 0.15]) {
    const g = new THREE.PlaneGeometry(0.4, 0.3), [u0, v0, u1, v1] = regionUV(A.bottles[2]), U = g.attributes.uv;
    for (let n = 0; n < U.count; n++) U.setXY(n, u0 + (u1 - u0) * U.getX(n) * 0.25, v0 + (v1 - v0) * U.getY(n));
    g.applyMatrix4(mul(T(xm - 0.18, top + 0.15, z), RY(Math.PI / 2))); decals.push(g);
  }
}
// a lamp on a counter or table: a brass foot, a glass font, the glowing chimney, the flame
function barLamp(k, x, y, z, strength) {
  k.prism('iron', ngon(6, 0.06), 0.03, [x, y + 0.015, z], null, { tint: BRASS, smooth: true, skip: '-y' });
  k.prism('iron', ngon(6, 0.055), 0.09, [x, y + 0.075, z], null, { tint: [1.25, 1.15, 0.9], smooth: true, taper: 0.45, skip: '-y' });
  chimney(k, x, y + 0.11, z);
  return { p: [x, y + 0.2, z], reach: 6.5, strength };
}
// a pair of antlers on a shield-shaped plaque on the wall (x = the wall, facing +x)
function antlers(k, x, y, z, s) {
  k.board([0.04, 0.32 * s, 0.24 * s], [x + 0.02, y, z], null, { long: 1, tint: [0.45, 0.3, 0.2], paint: [0.14, 0.08, 0.04], inside: true });
  k.prism('wood', ngon(6, 0.05 * s), 0.12 * s, null, null, { m: mul(T(x + 0.09 * s, y + 0.02, z), RZ(-Math.PI / 2)), tint: [0.7, 0.6, 0.5], paint: [0.4, 0.32, 0.24], smooth: true, inside: true });
  const ANT = [0.85, 0.78, 0.66];
  for (const sd of [-1, 1]) {
    // the beam: three pieces curving up and out, tines off it
    let px = x + 0.12 * s, py = y + 0.05, pz = z, ang = 0.6;
    for (let i = 0; i < 4; i++) {
      const L = 0.2 * s, dx = Math.cos(ang) * L * 0.25, dy = Math.sin(ang) * L, dz = sd * Math.cos(ang) * L * 0.85;
      k.prism('wood', ngon(5, 0.018 * s * (1 - i * 0.15)), Math.hypot(dx, dy, dz), null, null, { m: mul(T(px + dx / 2, py + dy / 2, pz + dz / 2), RX(sd * -Math.atan2(dz, dy)), RZ(-Math.atan2(dx, Math.hypot(dy, dz)))), tint: ANT, paint: [0.55, 0.48, 0.38], smooth: true, inside: true });
      if (i > 0) k.prism('wood', ngon(4, 0.012 * s), 0.13 * s, null, null, { m: mul(T(px + 0.02, py + 0.07 * s, pz), RX(-sd * 0.2)), tint: ANT, paint: [0.6, 0.53, 0.42], smooth: true, inside: true });
      px += dx; py += dy; pz += dz; ang += 0.22;
    }
  }
}
// THE CHALKBOARD on its easel: three legs (two in front, one behind), a ledge the board stands on, a chalk tray; the
// board in a wooden frame (the saloon's picture: a bar graph and a line graph); a stub of chalk and a cloth
function chalkboard(k) {
  // (built leaning back: in Mt, y runs up the lean and z out of it. The two front legs at z = 0, the ledge on pegs through
  // them in front, the board standing on the ledge in front of the legs, so nothing crosses its face)
  const tl = -0.08, M = mul(T(CB.x, FL, CB.z), RY(CB.face)), Mt = mul(M, RX(tl)), W = 1.5, H = 1.05, by = 0.9;
  const b = (size, p, o = {}) => k.board(size, null, null, { ...o, m: mul(Mt, T(...p)), inside: true });
  for (const s of [-1, 1]) b([0.05, 2.15, 0.04], [s * 0.55, 1.075, 0], { long: 1, tint: vary(k, FRAME, 0.75, 0.9) });
  const at = (x, y, z, m = M) => new THREE.Vector3(x, y, z).applyMatrix4(m).toArray();
  between(k, 'wood', at(0, 2.05, -0.03, Mt), at(0, 0.0, -0.78), 0.05, 0.04, { tint: vary(k, FRAME, 0.75, 0.9), inside: true });
  b([0.16, 0.06, 0.05], [0, 2.1, -0.02], { long: 0, tint: vary(k, FRAME, 0.7, 0.85) });   // the hinge block
  for (const s of [-1, 1]) b([0.03, 0.03, 0.13], [s * 0.55, by - 0.065, 0.045], { long: 2, tint: vary(k, FRAME, 0.8, 0.95) });   // the pegs
  b([1.3, 0.04, 0.1], [0, by - 0.03, 0.085], { long: 0, tint: vary(k, FRAME, 0.85, 1.0) });   // the ledge
  b([1.28, 0.035, 0.02], [0, by + 0.0, 0.13], { long: 0, tint: vary(k, FRAME, 0.85, 1.0) });   // its lip
  // the board on the ledge: its frame, a back, the slate (the saloon's picture)
  const cy = by + 0.0 + H / 2 + 0.05, zb = 0.07;
  for (const s of [-1, 1]) { b([W + 0.08, 0.05, 0.035], [0, cy + s * (H / 2 + 0.02), zb], { long: 0, tint: vary(k, FURNC, 0.9, 1.05) }); b([0.05, H, 0.035], [s * (W / 2 + 0.02), cy, zb], { long: 1, tint: vary(k, FURNC, 0.9, 1.05) }); }
  b([W, H, 0.012], [0, cy, zb - 0.01], { long: 0, tint: vary(k, FRAME, 0.6, 0.7) });
  G.box([W, H, 0.004], mul(Mt, T(0, cy, zb + 0.0)), { '+z': A.chalk }, [1, 1, 1]);
  // a stick of chalk and a felt eraser on the ledge
  k.box('iron', [0.06, 0.012, 0.012], null, null, { m: mul(Mt, T(0.3, by + 0.0, 0.1)), tint: [3.4, 3.4, 3.3] });
  k.board([0.14, 0.03, 0.06], null, null, { m: mul(Mt, T(-0.35, by + 0.005, 0.1), RY(0.3)), long: 0, tint: [0.9, 0.9, 0.9], paint: [0.35, 0.33, 0.3], inside: true });
  k.solid([1.5, 2.0, 0.5], null, null, mul(M, T(0, 1.0, -0.15)));
}
const FURNC = [0.62, 0.42, 0.3];
// THE CHANDELIER: a wagon wheel (rim pieces, spokes, a hub) hung flat on three chains from the ceiling, six oil lamps
// round its rim, their chimneys glowing
function chandelier(k, x, y, z) {
  const R = 0.72, n = 12, tint = vary(k, [0.55, 0.38, 0.26], 0.95, 1.05);
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n * Math.PI * 2, L = 2 * R * Math.sin(Math.PI / n) + 0.02;
    k.board([L, 0.07, 0.08], null, null, { m: mul(T(x, y, z), RY(-a), T(0, 0, R)), long: 0, tint, strip: 10, inside: true });
    k.box('iron', [L, 0.08, 0.012], null, null, { m: mul(T(x, y, z), RY(-a), T(0, 0, R + 0.045)), tint: [0.5, 0.48, 0.46], skip: '+x-x' });
  }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.board([0.035, 0.045, R - 0.12], null, null, { m: mul(T(x, y, z), RY(-a), T(0, 0, (R + 0.1) / 2)), long: 2, tint, inside: true }); }
  k.prism('wood', ngon(8, 0.1), 0.18, [x, y, z], null, { tint, smooth: true, ends: 'log', inside: true });
  // three chains from the rim up to a ring, one chain from the ring to the ceiling
  const ring = [x, y + 1.0, z];
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.3; between(k, 'iron', [x + Math.sin(a) * R * 0.9, y + 0.04, z + Math.cos(a) * R * 0.9], ring, 0.014, 0.014, { tint: [0.3, 0.28, 0.27] }); }
  between(k, 'iron', ring, [x, CEIL - 0.01, z], 0.018, 0.018, { tint: [0.3, 0.28, 0.27] });
  k.prism('iron', ngon(8, 0.05), 0.02, [x, y + 1.0, z], null, { tint: [0.4, 0.38, 0.36], smooth: true });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, lx = x + Math.sin(a) * R, lz = z + Math.cos(a) * R;
    k.prism('iron', ngon(6, 0.05), 0.09, [lx, y + 0.085, lz], null, { tint: BRASS, smooth: true, taper: -0.3 });
    k.parts.glow.push({ size: [0.065, 0.17, 0.065], m: T(lx, y + 0.22, lz), kind: GLOW.glass, col: [0.9, 0.42, 0.1] });
    k.parts.glow.push({ size: [0.016, 0.045, 0.016], m: T(lx, y + 0.16, lz), kind: GLOW.flame, col: [9, 5.4, 1.6] });
  }
  return { p: [x, y + 0.2, z], reach: 6.5, strength: 6.0, glow: [x, y + 0.25, z] };
}

// ── the batwing doors ────────────────────────────────────────────────────────────────────────────────────────────────
// a louvred batwing leaf, round its hinge (the hinge line is the y axis, the leaf runs from x = 0 to side * w, its outside
// toward +z): stiles, a bottom rail, a top rail that sweeps down toward the leaf's free edge (as batwings do), slats
// between them at a slant, a spring hinge in brass
const BW = { h: 1.4, y: FL + 0.42 };
function batwingLeaf(k, { w, h, side }) {
  const t = 0.04, X = (x) => side * x, D = vary(k, DOORW, 0.9, 1.05), st = 0.07;
  k.board([st, h, t], [X(st / 2), h / 2, 0], null, { long: 1, tint: D, cuts: [0], segFaces: '+z-z' });
  // (the free stile is shorter: the top sweeps down to it)
  const hf = h - 0.22;
  k.board([st, hf, t], [X(w - st / 2), hf / 2, 0], null, { long: 1, tint: D, cuts: [0], segFaces: '+z-z' });
  k.board([w - 2 * st, 0.12, t], [X(w / 2), 0.06, 0], null, { long: 0, tint: D, skip: '+x-x' });
  // the top rail: four pieces stepping down along a curve from the hinge stile to the free one
  for (let i = 0; i < 4; i++) {
    const f0 = i / 4, f1 = (i + 1) / 4, fm = (f0 + f1) / 2, ya = h - 0.22 * (1 - Math.cos(f0 * Math.PI / 2)), yb = h - 0.22 * (1 - Math.cos(f1 * Math.PI / 2));
    const xa = st + (w - 2 * st) * f0, xb = st + (w - 2 * st) * f1, L = Math.hypot(xb - xa, yb - ya) + 0.01, ang = Math.atan2(yb - ya, xb - xa);
    k.board([L, 0.11, t], [X((xa + xb) / 2), (ya + yb) / 2 - 0.055, 0], [0, 0, side * ang], { long: 0, tint: D, skip: '+x-x' });
    void fm;
  }
  // the slats, from the bottom rail up to under the top rail, tilted (light comes through, eyes don't)
  const s0 = 0.14, s1 = hf - 0.14, n = Math.round((s1 - s0) / 0.055);
  for (let i = 0; i < n; i++) k.board([w - 2 * st + 0.01, 0.05, 0.01], [X(w / 2), s0 + (s1 - s0) * (i + 0.5) / n, 0], [-0.7, 0, 0], { long: 0, tint: vary(k, DOORW, 0.85, 1.0), skip: '+x-x' });
  // the spring hinges
  // (painted brass, part of the leaf's own mesh: a leaf is one draw)
  for (const y of [0.2, h - 0.3]) k.board([0.05, 0.12, t + 0.03], [X(0.0), y, 0], null, { long: 1, tint: [0.6, 0.52, 0.36], paint: [0.36, 0.25, 0.08] });
}
// THE DOORS' HOOK: the leaves' swing (see the header). leaves: [{ hinge, side, w, d0: [dx, dz] its closed direction,
// open: the angle it is held open at }]
export function makeBatwings(leaves) {
  const S = { held: false, heldAt: 1.45, angles: leaves.map(() => 0), vel: leaves.map(() => 0), K: 26, C: 1.5, kick: 1.5, max: 1.75 };
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  S.update = (dt, bodies = []) => {
    dt = Math.min(dt, 0.05);
    leaves.forEach((L, i) => {
      let th = S.angles[i], v = S.vel[i];
      const rest = S.held ? L.side * S.heldAt : 0;
      // free: a spring back toward rest, damped
      v += (-S.K * (th - rest) - S.C * v) * dt; th += v * dt;
      if (th > S.max) { th = S.max; v = -Math.abs(v) * 0.3; } else if (th < -S.max) { th = -S.max; v = Math.abs(v) * 0.3; }
      // pushed: each body the leaf would pass through moves it to the edge of the body (on the side it is already on)
      const a0 = Math.atan2(L.d0[1], L.d0[0]);
      for (const b of bodies) {
        const rx = b.x - L.hinge[0], rz = b.z - L.hinge[2], rho = Math.hypot(rx, rz), r = (b.r ?? 0.3) + 0.03;
        if (rho > L.w + r || rho < 1e-3) continue;
        const tb = wrap(a0 - Math.atan2(rz, rx)), half = Math.asin(Math.min(1, r / rho));
        const d = wrap(th - tb);
        if (Math.abs(d) < half) {
          const s = Math.abs(d) > 1e-3 ? Math.sign(d) : (v >= 0 ? 1 : -1), want = tb + s * half;
          const nv = wrap(want - th) / dt;
          th = want; v = S.kick * nv;
        }
      }
      S.angles[i] = Math.max(-S.max, Math.min(S.max, th)); S.vel[i] = v;
    });
    return S.angles;
  };
  return S;
}

// ── the walker: a plain wooden figure who walks in at one door, out at the other and round the corner ───────────────
function makeWalker(off) {
  const parts = [], C = { skin: [0.75, 0.55, 0.42], shirt: [0.42, 0.5, 0.62], vest: [0.3, 0.18, 0.1], legs: [0.18, 0.17, 0.2], boot: [0.12, 0.08, 0.05], hat: [0.55, 0.42, 0.28] };
  const box = (size, pos, col) => { const g = new THREE.BoxGeometry(...size); g.translate(...pos); const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set(col, i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  const mat = animalLamps(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), 0.8, 0.12);
  const root = new THREE.Group(); root.name = 'walker';
  const body = new THREE.Mesh(mergeGeometries([box([0.36, 0.56, 0.22], [0, 1.22, 0], C.shirt), box([0.37, 0.4, 0.23], [0, 1.27, 0.0], C.vest), box([0.2, 0.22, 0.2], [0, 1.66, 0], C.skin), box([0.42, 0.03, 0.4], [0, 1.8, 0], C.hat), box([0.22, 0.12, 0.22], [0, 1.86, 0], C.hat), box([0.34, 0.1, 0.2], [0, 0.94, 0], C.legs)]), mat);
  body.castShadow = true; root.add(body); parts.push(body);
  const limb = (x, y, len, w, col, foot) => { const g = new THREE.Group(); g.position.set(x, y, 0); const geos = [box([w, len, w], [0, -len / 2, 0], col)]; if (foot) geos.push(box([w + 0.02, 0.08, 0.24], [0, -len + 0.04, 0.05], C.boot)); const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = true; g.add(m); root.add(g); return g; };
  const legs = [limb(-0.09, 0.92, 0.9, 0.13, C.legs, true), limb(0.09, 0.92, 0.9, 0.13, C.legs, true)];
  const arms = [limb(-0.23, 1.47, 0.6, 0.09, C.shirt), limb(0.23, 1.47, 0.6, 0.09, C.shirt)];
  // the path: up the steps and in at the main door, down the bar's aisle, out at the side door, down its steps and back
  // round the corner on the street
  const P = [[0, PZ + 2.2], [0, PZ + 0.95], [0, PZ - 0.25], [0, ZF + 0.6], [0, ZF - 1.0], [-0.9, 3.4], [-0.9, -1.4], [XL + 0.9, -1.4], [XL - 0.7, -1.4], [PX + 0.2, -1.4], [PX - 1.25, -1.4], [PX - 1.6, 0.6], [PX - 1.6, PZ + 1.8], [-2.0, PZ + 2.3]].map(([x, z]) => [x + off[0], z + off[1]]);
  const seg = []; let tot = 0;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push({ a, b, L, s: tot }); tot += L; }
  const deckY = (x, z) => {
    const lx = x - off[0], lz = z - off[1];
    if (lx > PX - 0.01 && lx < XR + 0.15 && lz > ZB - 0.01 && lz < PZ + 0.01) return FL;
    if (Math.abs(lx) < 1.1 && lz > PZ && lz < PZ + 0.9) return FL * (1 - (lz - PZ) / 0.9);
    if (lz > -2.55 && lz < -0.25 && lx < PX && lx > PX - 0.9) return FL * (1 - (PX - lx) / 0.9);
    return 0;
  };
  const W = { group: root, on: false, d: 4.0, speed: 1.25, heading: 0, at: [0, 0], body: { x: 0, z: 0, r: 0.3 } };
  W.update = (dt) => {
    root.visible = W.on; if (!W.on) return null;
    W.d = (W.d + W.speed * dt) % tot;
    const S = seg.find((q) => W.d >= q.s && W.d < q.s + q.L) || seg[0], f = (W.d - S.s) / S.L;
    const x = S.a[0] + (S.b[0] - S.a[0]) * f, z = S.a[1] + (S.b[1] - S.a[1]) * f, want = Math.atan2(S.b[0] - S.a[0], S.b[1] - S.a[1]);
    let dh = want - W.heading; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    W.heading += dh * Math.min(1, dt * 7);
    root.position.set(x, deckY(x, z), z); root.rotation.y = W.heading;
    const ph = W.d / 1.4 * Math.PI * 2, sw = Math.sin(ph) * 0.5;
    legs[0].rotation.x = sw; legs[1].rotation.x = -sw; arms[0].rotation.x = -sw * 0.7; arms[1].rotation.x = sw * 0.7;
    W.body.x = x; W.body.z = z;
    return W.body;
  };
  root.visible = false;
  return W;
}

// ── the props that go with it: each { type, x, y, z, rot, ... } ─────────────────────────────────────────────────────
// the round tables and the chairs round each (chairs facing the table's middle)
const TABLES = [[0.35, 1.25, 4], [2.25, -0.15, 3], [0.15, -1.55, 4], [-3.55, -4.5, 3], [3.55, -4.3, 3]];
function propList(piano) {
  const y = FL, L = [];
  for (const [x, z, n] of TABLES) {
    L.push({ type: 'roundTable', x, y, z, r: 0.46 });
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + x * 1.3 + z, d = 0.72; L.push({ type: 'spindleChair', x: x + Math.sin(a) * d, y, z: z + Math.cos(a) * d, rot: a + Math.PI + (((i * 7 + x * 3) % 3) - 1) * 0.15 }); }
  }
  for (let i = 0; i < 6; i++) L.push({ type: 'barStool', x: BXF + 0.42, y, z: BZ1 - 0.45 - i * 0.78, rot: i * 0.4 });
  L.push({ type: 'piano', x: piano.x, y: STG, z: piano.z, rot: piano.rot }, { type: 'pianoStool', x: piano.stool[0], y: STG, z: piano.stool[1] });
  L.push({ type: 'spindleChair', x: -0.95, y: STG, z: -4.85, rot: 0.25 }, { type: 'spindleChair', x: -1.65, y: STG, z: -4.6, rot: 0.6 });
  // barrels by the gallery's posts and under the stairs' high end; a keg on the back counter's end
  L.push({ type: 'barrel', x: -GPX - 0.45, y, z: ZG + 0.35 }, { type: 'barrel', x: GPX + 0.42, y, z: ZG + 0.4 }, { type: 'barrel', x: STX1 - 0.4, y, z: -1.6 }, { type: 'barrel', x: STX1 - 0.95, y, z: -1.95, h: 0.8 });
  // outside: barrels between the posts, chairs and a bench on the boardwalk, the hitching rail and the trough on the side
  // street at the far end
  L.push({ type: 'barrel', x: -4.15, y, z: PZ - 0.45 }, { type: 'barrel', x: 2.1, y, z: PZ - 0.45 }, { type: 'barrel', x: PX + 0.45, y, z: 3.25 }, { type: 'barrel', x: PX + 0.5, y, z: -3.3 });
  L.push({ type: 'bench', x: 3.15, y, z: ZF + 0.32, len: 1.6, back: true }, { type: 'spindleChair', x: -2.75, y, z: ZF + 0.55, rot: 2.6 }, { type: 'spindleChair', x: -3.55, y, z: ZF + 0.62, rot: 3.6 });
  L.push({ type: 'bench', x: XL - 0.32, y, z: 0.8, len: 1.5, rot: -Math.PI / 2 });
  L.push({ type: 'hitchrail', x: PX - 1.15, z: -4.2, len: 2.8, rot: Math.PI / 2 }, { type: 'trough', x: PX - 1.75, z: -4.3, len: 1.8, rot: Math.PI / 2 });
  // the rooms upstairs: in each a bed, a washstand with its basin and pitcher, a chair, a rag rug (marked upstairs, so the
  // game can leave them out from far off)
  const H = Math.PI / 2, U = { y: U1, upstairs: true };
  for (const [room, bed, wash, chair, rug] of [
    ['front1', [-2.2, 5.25, -H], [-4.47, 3.75, H], [-3.85, 4.75, 2.4], [-3.0, 4.3, 0]], ['front2', [0.7, 5.25, -H], [-0.99, 4.0, H], [-0.55, 5.45, 3.4], [0.05, 4.35, 0]],
    ['front3', [2.7, 5.25, H], [4.47, 4.95, -H], [4.05, 3.85, -0.9], [3.2, 4.5, 0]], ['side1', [-3.95, 0.8, 0], [-3.9, 3.04, Math.PI], [-2.95, 2.55, -1.3], [-3.45, 2.15, H]],
    ['side2', [-3.95, -2.7, 0], [-3.9, -0.41, Math.PI], [-2.95, -0.55, -1.6], [-3.45, -1.25, H]], ['back1', [-3.69, -5.36, H], [-0.11, -5.0, -H], [-0.45, -4.25, -2.2], [-2.3, -4.5, 0]],
    ['back2', [3.69, -5.36, -H], [0.31, -5.0, H], [0.65, -4.25, 2.2], [2.5, -4.55, 0]]]) {
    L.push({ type: 'bed', x: bed[0], z: bed[1], rot: bed[2], room, ...U }, { type: 'washstand', x: wash[0], z: wash[1], rot: wash[2], room, ...U },
      { type: 'spindleChair', x: chair[0], z: chair[1], rot: chair[2], room, ...U }, { type: 'ragRug', x: rug[0], z: rug[1], rot: rug[2], room, ...U });
  }
  return L;
}

// each board's own numbers for the shader (parts.js boardWear): its nails, where along the wall it is, how much more of
// its paint has gone: by the corners and the doors (handled and knocked), low down, and a little board by board; the
// trim's paint wears in patches too (no nails)
function boardAttr(geo, parts, seed) {
  const R = rng(seed * 97 + 5), of = geo.userData.partOf, P = geo.attributes.position, n = P.count, Ab = new Float32Array(n * 3);
  const per = parts.map(() => (R() < 0.3 ? 0.15 + 0.2 * R() : 0.08 * R()));
  const near = (d, r) => 1 - smooth01(d, 0, r), h01 = (v) => { const x = Math.sin(v * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < n; i++) {
    const Q = parts[of[i]], o = Q.o; if (!o.hz && !o.nail && !o.trim) continue;
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (o.hz) { Ab[i * 3] = 2 + o.hz[1]; Ab[i * 3 + 1] = o.hz[0]; } else if (o.nail) { Ab[i * 3] = o.nail; Ab[i * 3 + 1] = Q.m.elements[13]; } else Ab[i * 3] = 0.1;
    if (!o.paint) continue;
    // (a part made of pieces, a baluster or a newel, wears as one: its pieces share its number)
    const pp = o.wk !== undefined ? (h01(o.wk) < 0.3 ? 0.15 + 0.2 * h01(o.wk + 1) : 0.08 * h01(o.wk + 2)) : per[of[i]];
    if (o.noWear) { Ab[i * 3 + 2] = -0.6; continue; }
    const corner = Math.min(Math.hypot(x - XL, z - ZF), Math.hypot(x - XR, z - ZF), Math.hypot(x - XL, z - ZB), Math.hypot(x - XR, z - ZB), 9);
    const door = Math.abs(z - ZF) < 0.25 ? Math.hypot(Math.max(0, Math.abs(x) - 0.9), Math.max(0, y - DH)) : Math.abs(x - XL) < 0.25 ? Math.hypot(Math.max(0, Math.abs(z + 1.4) - 0.9), Math.max(0, y - DH)) : 9;
    const sign = (Math.abs(z - ZF) < 0.3 && inRect(SIGN_A, x, y, 0.1)) || (Math.abs(x - XL) < 0.3 && inRect(SIGN_B, z, y, 0.1)) ? 0.3 : 1;
    // (low down: the shader's own extra wear up to 2.4 m taken back out (it made a hard grey band a third of the wall
    // high); instead a soft, ragged band of wear 0.2 to 0.6 m over whatever the wall stands on)
    const base = Math.abs(z - ZF) < 0.3 || Math.abs(x - XL) < 0.3 ? FL : 0, rag = 0.12 * Math.sin(x * 2.3 + z * 1.7) + 0.08 * (pp - 0.15);
    const low = -0.4 * (1 - smooth01(y, 0.4, 2.4)) + 0.32 * (1 - smooth01(y - base, 0.2, 0.55 + rag));
    Ab[i * 3 + 2] = o.trim ? 0.5 * pp - 0.12 + 0.15 * near(door, 0.9) + 0.5 * low : sign * (pp + 0.3 * near(corner, 1.2)) + 0.35 * near(door, 0.9) + low - (1 - sign) * 0.15;
  }
  geo.setAttribute('aBoard', new THREE.BufferAttribute(Ab, 3));
}

// ── build it all ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function buildSaloon(recipeIn = {}, env = {}) {
  const t0 = performance.now(), r = saloonRecipe(recipeIn), paint = PAINTS[r.paint].c, TR = TRIMS[r.trim].c;
  const k = new Kit(r.seed); k.parts.glow = [];
  // (the upper floor's rooms and the galleries' walls in a kit and meshes of their own, so the game can leave them out
  // from far off; the roof and the ceiling in theirs, so a plan view can lift them away)
  const ku = new Kit(r.seed + 17); ku.parts.glow = []; const kr = new Kit(r.seed + 23); kr.parts.glow = []; const GU = new Goods(A.w, A.h);
  SILLS.length = 0; decals.length = 0; panes.length = 0; G = new Goods(A.w, A.h);
  const lamps = [], marks = [], mark = (name) => marks.push([name, k.parts.wood.length, k.parts.iron.length, G.tris]);
  walls(k, paint, TR); mark('walls'); openingTrims(k, TR); mark("openings");
  const sa = { bh: 0.24, y0: FL - 0.06, tops: [[XL - 0.03, XR + WINGA, TOPA]] }, sb = { bh: 0.24, y0: FL - 0.06, tops: [[ZB - WINGB, BSTEP, TOPB2], [BSTEP, ZF, TOPB1]] };
  signStrips(FRONT, sa, SIGN_A); signStrips(WEST, sb, SIGN_B);
  falseFronts(k, TR); mark('falseFronts'); roofs(kr); mark('roofs'); boardwalk(k, TR); mark('boardwalk'); balcony(k, TR); mark('balcony');
  frontThings(k, lamps); mark('front');
  // inside: the chandelier first (it is the hall's main light), then the room, the stage, the stairs, the bar
  lamps.push(chandelier(k, 0.5, FL + 3.25, 1.0)); mark('chandelier');
  const roomDoors = insideRoom(k, ku, kr, GU, lamps); mark('room'); stage(k, lamps); mark('stage'); stairs(k, lamps); mark('stairs'); bar(k, lamps); mark('bar'); chalkboard(k); mark('chalkboard');
  // the chalkboard's lamp (a bracket on the east wall beside it) and the lamp under the gallery's west end
  lamps.push(sconce(k, IX1, FL + 2.0, 2.95, -1, 1.8, 'x'));
  lamps.push(sconce(k, IX0, FL + 2.0, -3.2, 1, 1.6, 'x'));
  // little lamps on the tables (their glow only: the chandelier and the fill light the room)
  for (const [x, z] of TABLES) barLamp(k, x + 0.12, FL + 0.76, z - 0.08, 0);
  // the pictures on the walls: the side wall over the stairs and under the gallery, the back wall by the stage
  for (const [reg, x, y, z, w, h, ax, face] of [[A.pictures[0], IX1 - 0.04, 5.6, -1.4, 0.7, 0.55, 'x', -1], [A.pictures[2], IX1 - 0.04, 5.6, 0.75, 0.45, 0.6, 'x', -1], [A.pictures[1], IX0 + 0.04, 2.5, -4.5, 0.6, 0.45, 'x', 1]]) {
    pic(reg, w, h, mul(T(x, y, z), RY(face > 0 ? Math.PI / 2 : -Math.PI / 2))); frame(k, x - face * 0.005, y, z, w, h, 'x', face);
  }
  mark('pictures');

  // THE STAGE'S SPOTS (the piano, keys toward the stage's middle and the audience, as the town's stage has it)
  const keysRot = -1.091, pianoP = { x: 1.55, z: -4.25 }, kd = [Math.sin(keysRot), Math.cos(keysRot)];
  const stool = [pianoP.x + kd[0] * 0.88, pianoP.z + kd[1] * 0.88];
  const piano = { x: pianoP.x, z: pianoP.z, rot: keysRot, stool };

  // the batwing leaves: two per doorway, hung at the middle of the wall's thickness; each its own kit and mesh
  const leaves = [], lw = (DOOR_A.a1 - DOOR_A.a0 - 0.05) / 2;
  const leafOf = (wall, a, side, seed) => {
    const lk = new Kit(seed); lk.parts.glow = [];
    batwingLeaf(lk, { w: lw, h: BW.h, side });
    // (the side street's leaves are built turned to its wall)
    const pre = wall === 'b' ? RY(-Math.PI / 2) : new THREE.Matrix4();
    for (const g of ['wood', 'iron']) for (const P of lk.parts[g]) P.m = mul(pre, P.m);
    const g = buildGeometry(lk.parts.wood, 'wood', rng(seed + 1), { topAt: () => 9, tintAt: (x, y, z, t, o) => tintAt(x, y, z, t, { ...o, outside: true }) });
    const iron = lk.parts.iron.length ? buildGeometry(lk.parts.iron, 'iron', rng(seed + 2), { topAt: () => 9 }) : null;
    const hinge = wall === 'a' ? [a, BW.y, ZF - 0.075] : [XL + 0.075, BW.y, a];
    const d0 = wall === 'a' ? [side, 0] : [0, side];
    leaves.push({ group: 'batwing', geo: g, iron, hinge, open: side * 1.45, closed: 0, side, w: lw, d0, wall, parts: lk.parts.wood.length });
  };
  leafOf('a', DOOR_A.a0 + 0.02, 1, r.seed * 19 + 1); leafOf('a', DOOR_A.a1 - 0.02, -1, r.seed * 19 + 2);
  leafOf('b', DOOR_B.a0 + 0.02, 1, r.seed * 19 + 3); leafOf('b', DOOR_B.a1 - 0.02, -1, r.seed * 19 + 4);

  // the kits' parts into meshes, one per material (the upstairs' and the roof's iron and glow go in with the rest)
  for (const kk of [ku, kr]) { k.parts.iron.push(...kk.parts.iron); k.parts.glow.push(...kk.parts.glow); k.occ.push(...kk.occ); }
  const R = rng(r.seed + 1), geos = {};
  for (const g of ['wood', 'iron']) geos[g] = buildGeometry(k.parts[g], g, R, { topAt, tintAt });
  boardAttr(geos.wood, k.parts.wood, r.seed);
  geos['up:wood'] = buildGeometry(ku.parts.wood, 'wood', rng(r.seed + 2), { topAt, tintAt }); boardAttr(geos['up:wood'], ku.parts.wood, r.seed + 1);
  geos['up:goods'] = GU.build();
  geos['roof:wood'] = buildGeometry(kr.parts.wood, 'wood', rng(r.seed + 3), { topAt, tintAt }); boardAttr(geos['roof:wood'], kr.parts.wood, r.seed + 2);
  geos.glow = glowGeometry(k.parts.glow, (P) => P.kind !== GLOW.glass && P.kind !== GLOW.glass + 10);
  geos.glass = glowGeometry(k.parts.glow, (P) => P.kind === GLOW.glass || P.kind === GLOW.glass + 10);
  const stones = stonework(r, env);
  geos.stone = mergeGeometries(stones); geos.stone.userData.ownAO = true; for (const g of stones) g.dispose();
  geos.decal = decals.length ? mergeGeometries(decals) : null; for (const g of decals) g.dispose(); decals.length = 0;
  geos.pane = panes.length ? mergeGeometries(panes) : null; for (const g of panes) g.dispose(); panes.length = 0;
  geos.goods = G.build(); const goodsTris = G.tris; G = null;
  for (const g in geos) if (!geos[g]) delete geos[g];
  const msBuild = performance.now() - t0;

  // the bake: the voxel grid of the solids, then each mesh's corners
  const t1 = performance.now();
  const occ = new Occlusion(k.occ, 1.6, 0.08, { reach: 2.4, rays: 20, groundReach: 0.7 });
  const opening = (c, u, v, n, o = {}) => ({ c, u, v, n, ...o });
  const onA = (op) => opening([(op.a0 + op.a1) / 2, (op.y0 + op.y1) / 2, ZF], [(op.a1 - op.a0) / 2, 0, 0], [0, (op.y1 - op.y0) / 2, 0], [0, 0, 1]);
  const onB = (op) => opening([XL, (op.y0 + op.y1) / 2, (op.a0 + op.a1) / 2], [0, 0, (op.a1 - op.a0) / 2], [0, (op.y1 - op.y0) / 2, 0], [-1, 0, 0]);
  const onE = (op) => opening([XR, (op.y0 + op.y1) / 2, -(op.a0 + op.a1) / 2], [0, 0, (op.a1 - op.a0) / 2], [0, (op.y1 - op.y0) / 2, 0], [1, 0, 0]);
  const openings = [
    onA({ ...DOOR_A, y0: FL }), onB({ ...DOOR_B, y0: FL }), onA(WA1), onA(WA2), onB(WB1), onB(WB3), onE(WE1), onE(WE2),
    opening([-(WK1.a0 + WK1.a1) / 2, (WK1.y0 + WK1.y1) / 2, ZB], [0.45, 0, 0], [0, 0.75, 0], [0, 0, -1]),
    // (the one high window into the hall's well, over the stairs)
    onE(UE[1]),
  ];
  const inHall = (x, y, z) => x > XL + 0.02 && x < XR - 0.02 && z > ZB + 0.02 && z < ZF - 0.02 && y > -0.5 && y < CEIL + 0.02;
  // THE FILL: lamplight bounced about (no direction, no shadow), warm, so the hall is an amber lit room and not a black
  // box: a little everywhere, more near each lamp (the chandelier most), a gradient from the lamps out to the corners. Each
  // room upstairs as if its own lamp were lit. And outdoors the porch's ceiling (the balcony's underside), lit warm by the
  // light thrown up off the boardwalk and the street
  const indoor = lamps.filter((L) => !L.outdoor);
  const fill = (x, y, z, nx, ny, nz) => {
    const px = x + nx * 0.08, py = y + ny * 0.08, pz = z + nz * 0.08;
    if (!inHall(px, py, pz)) return inPorch(px, pz) && py > BEAMB - 0.35 && py < DECK && ny < -0.3 ? 0.22 : 0;
    if (py > U1 - 0.02 && roomAt(px, pz)) return 0.3;
    let f = 0.11;
    for (const L of indoor) { const d2 = (L.p[0] - px) ** 2 + (L.p[1] - py) ** 2 + (L.p[2] - pz) ** 2; f += 0.1 * L.strength * Math.exp(-d2 / 7); }
    return Math.min(0.55, f);
  };
  const light = new Light(occ, { inside: inHall, fill, openings, lamps, base: 0.34, gain: 5.0 });
  // (indoors no rain falls: the hall is taller than the rain test reaches, and its floor came out wet and mossy)
  const bake0 = light.bake.bind(light);
  light.bake = (geo, m, key) => { const r = bake0(geo, m, key); for (let i = 0; i < r.ins.length; i++) if (r.ins[i]) r.rain[i] = 0; return r; };
  const BAKED = ['wood', 'iron', 'stone', 'decal', 'goods', 'up:wood', 'up:goods', 'roof:wood'];
  for (const g of BAKED) if (geos[g]) light.bake(geos[g]);
  for (const L of leaves) for (const geo of [L.geo, L.iron]) if (geo) { light.bake(geo, T(...L.hinge), 'closed'); light.bake(geo, mul(T(...L.hinge), RY(L.open)), 'open'); }
  // (batwings never shut the light out: the doors' switch holds them open or lets them hang)
  const S = { held: false };
  light.setDoors = (open, open2) => {
    S.held = !!open;
    for (const g of BAKED) if (geos[g]) light.apply(geos[g], true, 'main', open2);
    for (const L of leaves) for (const geo of [L.geo, L.iron]) if (geo) light.apply(geo, true, open ? 'open' : 'closed', open2);
  };
  light.setDoors(false, false);
  const msBake = performance.now() - t1;

  // centre the footprint (the side street's steps to the east eave, the back eave to the main front's steps)
  const fx0 = PX - 0.95, fx1 = XR + EO + 0.05, fz0 = ZB - GO, fz1 = PZ + 0.95, OX = -(fx0 + fx1) / 2, OZ = -(fz0 + fz1) / 2;
  for (const g in geos) geos[g].translate(OX, 0, OZ);
  for (const L of leaves) L.hinge = [L.hinge[0] + OX, L.hinge[1], L.hinge[2] + OZ];
  for (const L of lamps) { L.p = [L.p[0] + OX, L.p[1], L.p[2] + OZ]; if (L.glow) L.glow = [L.glow[0] + OX, L.glow[1], L.glow[2] + OZ]; }
  light.offset = [OX, OZ];
  const props = propList(piano); for (const p of props) { p.x += OX; p.z += OZ; }
  const P3 = (x, y, z) => [+(x + OX).toFixed(3), +y.toFixed(3), +(z + OZ).toFixed(3)];

  // the batwings' swing and the walker (in the centred frame)
  const batwings = makeBatwings(leaves);
  const walker = makeWalker([OX, OZ]);
  const counts = {}; let parts = 0;
  for (const g in k.parts) { counts[g] = k.parts[g].length; parts += counts[g]; }
  counts.goodsTris = goodsTris;
  const kdir = [Math.sin(keysRot), Math.cos(keysRot)];
  const B = {
    recipe: r, geos, doors: leaves, lamps, light, occ, props, offset: OX, offsetZ: OZ, batwings, walker, extra: walker.group, roomDoorLeaf,
    anchors: {
      doorways: [{ name: 'a', centre: P3(0, FL + 1.35, ZF), w: DOOR_A.a1 - DOOR_A.a0, h: DH - FL, out: [0, 0, 1] }, { name: 'b', centre: P3(XL, FL + 1.35, (DOOR_B.a0 + DOOR_B.a1) / 2), w: DOOR_B.a1 - DOOR_B.a0, h: DH - FL, out: [-1, 0, 0] }],
      signs: [{ face: 'a', centre: P3((SIGN_A.a0 + SIGN_A.a1) / 2, (SIGN_A.y0 + SIGN_A.y1) / 2, ZF), w: SIGN_A.a1 - SIGN_A.a0, h: SIGN_A.y1 - SIGN_A.y0 }, { face: 'b', centre: P3(XL, (SIGN_B.y0 + SIGN_B.y1) / 2, (SIGN_B.a0 + SIGN_B.a1) / 2), w: SIGN_B.a1 - SIGN_B.a0, h: SIGN_B.y1 - SIGN_B.y0 }],
      lanterns: lamps.map((L) => L.p),
      // THE STAGE, in the form of src/stage.js STAGE (the stool's middle on the stage floor and the way the keys face from
      // it, as three's rotation.y; the harmonica player's spot and facing), in the saloon's own centred frame
      stage: {
        piano: { x: +(stool[0] + OX).toFixed(3), y: STG, z: +(stool[1] + OZ).toFixed(3), rot: +Math.atan2(-kdir[0], -kdir[1]).toFixed(4) },
        harmonica: { x: +(-0.35 + OX).toFixed(3), y: STG, z: +(-3.35 + OZ).toFixed(3), rot: 0.12 },
        floor: STG, front: P3(0, STG, SZ1), rect: { x0: SX0 + OX, x1: SX1 + OX, z0: SZ0 + OZ, z1: SZ1 + OZ }, pianoAt: P3(pianoP.x, STG, pianoP.z), pianoRot: keysRot,
      },
      // THE CHALKBOARD: the board's middle and the way it faces; where the teacher stands (beside it, turned half to the
      // player) and where the player stands (in front of it, facing it)
      chalkboard: (() => {
        const f = [Math.sin(CB.face), Math.cos(CB.face)], right = [f[1], -f[0]], c = [CB.x, CB.z];
        // (the teacher on the board's right as the player sees it: by the east window, out of the way to the door)
        const teacher = [c[0] + right[0] * 1.0 + f[0] * 0.45, c[1] + right[1] * 1.0 + f[1] * 0.45], player = [c[0] + f[0] * 1.55, c[1] + f[1] * 1.55];
        return { centre: P3(CB.x, FL + 1.5, CB.z), faces: CB.face, teacher: { x: +(teacher[0] + OX).toFixed(3), y: FL, z: +(teacher[1] + OZ).toFixed(3), rot: +Math.atan2(player[0] - teacher[0], player[1] - teacher[1]).toFixed(3) }, player: { x: +(player[0] + OX).toFixed(3), y: FL, z: +(player[1] + OZ).toFixed(3), rot: +(CB.face + Math.PI).toFixed(3) } };
      })(),
      bar: { top: FL + BH, from: P3(BXF, FL + BH, BZ0), to: P3(BXF, FL + BH, BZ1), keeper: P3(BXF - BD - 0.45, FL, 1.8), customer: P3(BXF + 0.45, FL, 1.8) },
      // THE UPPER FLOOR: the galleries (a U round the hall's well) and the rooms behind them (floor rectangles, metres),
      // each room's door: its hinge, the leaf's width and height, the turn its frame starts at and the turn that swings it
      // open into the room (parts.js's doors turn about the hinge by rotation.y); its parts carry roomDoor: i
      upstairs: {
        floor: U1, ceiling: CEIL, well: { x0: GXW + OX, x1: IX1 + OX, z0: ZG + OZ, z1: GZF + OZ },
        galleries: [{ name: 'back', x0: RX1 + OX, x1: IX1 + OX, z0: ZP + OZ, z1: ZG + OZ }, { name: 'side', x0: RX1 + OX, x1: GXW + OX, z0: ZG + OZ, z1: GZF + OZ }, { name: 'front', x0: RX1 + OX, x1: IX1 + OX, z0: GZF + OZ, z1: RZ0 + OZ }],
        rooms: ROOMS.map((R) => ({ id: R.id, x0: +(R.x0 + OX).toFixed(3), x1: +(R.x1 + OX).toFixed(3), z0: +(R.z0 + OZ).toFixed(3), z1: +(R.z1 + OZ).toFixed(3), w: +(R.x1 - R.x0).toFixed(2), d: +(R.z1 - R.z0).toFixed(2) })),
        doors: roomDoors.map((D) => ({ ...D, hinge: P3(...D.hinge) })),
        meshes: ['up:wood', 'up:goods'], tris: (geos['up:wood'] ? geos['up:wood'].index.count / 3 : 0) + (geos['up:goods'] ? geos['up:goods'].index.count / 3 : 0),
      },
      footprint: { w: fx1 - fx0, d: fz1 - fz0, h: TOPA + 0.5, x0: fx0 + OX, x1: fx1 + OX, z0: fz0 + OZ, z1: fz1 + OZ, building: { x0: XL + OX, x1: XR + OX, z0: ZB + OZ, z1: ZF + OZ } },
      street: [fx0 + OX - 1, fx1 + OX + 1, PZ + OZ, PZ + OZ + 8],
      streets: [[fx0 + OX - 1, fx1 + OX + 1, PZ + OZ, PZ + OZ + 8], [PX + OX - 9, PX + OX, fz0 + OZ - 1, fz1 + OZ + 8]],
    },
    counts, parts, msBuild, msBake, ms: performance.now() - t0, kit: k, marks,
  };
  // what the lab calls every frame: the walker, then the doors (pushed by the walker and anyone else in B.bodies)
  B.bodies = [];
  B.tick = (dt) => {
    batwings.held = S.held;
    const w = walker.update(dt), bodies = w ? [w, ...B.bodies] : B.bodies;
    const ang = batwings.update(dt, bodies);
    if (B.doorMeshes) B.doorMeshes.forEach((m, i) => { if (leaves[i]) m.rotation.y = ang[i]; });
  };
  return B;
}
