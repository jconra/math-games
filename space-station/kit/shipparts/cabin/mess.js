// THE MESS, in the bevel helper's language (kit/bevel.js), from the game's maker's mess picture
// (refs/ships/explorer_mess_ref_2026-11-09.png): a corner bench in leather (navy, his pick; rust in his picture) on a dark base with a warm light strip
// under it, a steel table with chamfered corners on a faceted pedestal, faceted stools with 8-sided tops, cabinets in the
// wall's top corners with slanted fronts and a light strip under them, a tall cold store, the galley counter with a
// coffee machine, mugs and a bowl of fruit, and framed posters (their words in kit/shipparts/cabin/print.js POSTERS).
// Frames (as the cabin's other fittings, kit/shipparts/cabin/ship.js):
//   a WALL fitting stands on a wall line: x along the wall, centred; z = 0 on the line, its back at the wall's face (FACE),
//   facing +z; y = 0 the deck
//   a FREE one (table, stool, the things on a counter) is centred on its origin, standing on y = 0
//   cornerBench(p, o)   one run of the L: o.len (its stretch of wall), o.depth (0.5 from the line), o.seat (0.45),
//                       o.seatAt [x0, x1] and o.backAt [x0, x1] (where along it the seat and the back cushion run: at the
//                       L's corner one bench's seat runs on into it and the other's back), o.leather (the cushions'
//                       colour), o.glow (true: the warm strip under the seat's front), o.trim (its base panel's surface:
//                       black)
//   messTable(p, o)     o.w (x), o.d (z), o.h (0.75), o.trim (the top's rim: black)
//   stool(p, o)         o.h (0.45), o.pad (the top pad's leather colour: a grey pad)
//   topCabinets(p, o)   a row of cabinets in a wall's top corner: o.len, o.y (their bottom), o.depth (from the line, at
//                       the bottom), o.ceiling (2.5), o.slope { y0, run } (the hull's slope over them: their tops follow
//                       it; none: up to the ceiling), o.lean (0.35: how far the front leans back toward the wall, per metre
//                       up), o.units (about 0.5 m each), o.poster (a POSTERS index for the middle one's front), o.strip,
//                       o.handle (the handle slots' surface: black), o.trim (the rail under them: black)
//   coldStore(p, o)     a tall cold store: o.w (0.5), o.depth, o.h (2.0), o.poster, o.handle; o.top (left out: its top is
//                       at o.h): its face runs on up to o.top (to meet the hull's slope over it), a short third door over
//                       the second
//   drinkUnit(p, o)     the drink unit built into the wall beside the cold store, its face flush with the cold store's:
//                       a coffee maker in a lit cup bay, a second drink machine stacked over it (its own cup bay, a live
//                       screen with the water tanks), a cupboard over them up to the hull's slope. o.w (along the wall,
//                       0.5), o.depth (0.35: its face, as the cold store's), o.top (2.5: the face's top), o.base (0.9: the
//                       worktop the coffee maker's cup bay stands on), o.wall (-1 / +1: that end runs FACE into a wall
//                       across), o.clear ([x0, x1]: the stretch of its face, in its own x, that what hangs beside it
//                       (the cabinets over the counter) leaves clear: the stack's bays, buttons and screen are kept in
//                       it, so all of the second machine's front shows), o.cup (a mug's surface), o.handle
//   backsplash(p, o)    the wall over the galley counter: one raised panel from the worktop to the cabinets over it, with
//                       an eight-sided opening for each grow pod: o.len, o.y0 (0.9), o.y1 (1.55), o.holes ([[x, y], ...]:
//                       each opening's middle), o.hole (0.44: an opening across its flats), o.blanks (false: no blanking
//                       plates in the openings; a pod's frame stands in each)
//   galleyRun(p, o)     the counter: o.len, o.depth, o.top (0.9), o.end ([left, right] chamfer of the worktop's front
//                       corners in plan: an open end 0.08), o.handle, o.trim (the worktop's edge: black)
//   coffeeMachine(p), mug(p, o), fruitBowl(p), bottle(p, o)   (free, standing on y = 0; a mug's and the bottle's o.look:
//                       their body's surface)
//   poster(p, o)        a framed poster on a wall's face: o.i (a POSTERS index), o.dark (a dark print with light words)
//   wallField(p, o)     a raised chamfered field on a wall's face: o.w, o.h (centred on x 0, y o.y)
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { shape, solid, loft, prism, plate, relief, RINGS, add, octagon } from '../../bevel.js';
import { kitTextures } from '../../materials.js';
import { plane, put } from '../../geo.js';
import { FACE } from './ship.js';
import { POSTERS } from './print.js';
import { liveFace, liveLamp } from './live.js';
import { part, placeInto } from '../place.js';

const PI = Math.PI, FLAT = [-PI / 2, 0, 0];   // (FLAT: a shape drawn in x, y lies down, its y running to -z, its depth up)
export const STEEL = { c: '#b0b4ba', r: 0.34, m: 0.45, w: 0.3 }, PAD = { c: '#6c7078', r: 0.6, m: 0.05, w: 0.3 }, GUN = { c: '#6f747c', r: 0.4, m: 0.3, w: 0.4 }, TOP = { c: '#b4b5b2', r: 0.36, m: 0.25, w: 0.4 };
// the leather (a cabin's look gives its colour: marked as that look's accent `key`, for a live recolour); none given:
// the default navy, unmarked
export const leatherOf = (c, key = 'leather') => ({ c: c || '#22355e', r: 0.66, m: 0.0, w: 0.25, ...(c ? { accent: key } : {}) });
export const decalQuad = (w, h, rect) => { const r = kitTextures().decal.rect[rect]; if (!r) throw new Error('kit: no decal ' + rect); return plane(w, h, { uv: r, cell: 9 }); };
// a light for the bake, warm white (the room's tone takes it over: kit/ships/cabin-built.js)
export const LIGHT = [1, 0.97, 0.92];
// a pool of light from a strip, for a cabin's real-time lights (kit/ships/cabin-built.js POOLS): not in the bake, which
// has the strip's own lights
export const pool = (p, at, i, reach, color = LIGHT) => p.lights.push({ at, i: 0, color, dir: null, reach, pool: { i, reach } });
// a strip's own light for the bake (marked, so a cabin keeps its strips brighter than its fill: cabin-built.js LIGHT)
export const strip = (p, at, i, dir, reach, color = LIGHT) => p.lights.push({ at, i, color, dir, reach, strip: true });
// A PICTURE LIGHT: a poster's light with the fitting it comes from (the game's maker, 2026-11-09: "Right now it just looks
// like light just magically appears"): a small dark hood over the poster's top edge, a glowing strip under it, and the
// light it throws down the poster (marked `poster`: cabin-built.js LIGHT.posters turns these up where the rooms are
// kept dim, so a poster stays easy to read). `at`: the middle of the poster's top edge, on the
// surface it hangs on; `rot`: that surface's turn (it faces +z before it is turned); `w`: the poster's width.
const _pe = new THREE.Euler(), _pv = new THREE.Vector3();
const turned = (rot, v) => _pv.set(...v).applyEuler(_pe.set(...(rot || [0, 0, 0]))).toArray();
export function pictureLight(p, at, rot, w, o = {}) {
  const hw = Math.max(0.1, Math.min(w * 0.72, 0.34)), out = o.out ?? 0.042, R = rot || [0, 0, 0];
  add(p, o.look || 'black', solid(shape(hw, 0.024, 0.007, 0, 0.02), out, { edge: 0.005, back: false }), at, R);
  // (the strip under the hood, facing down: turned in the hood's own frame first, then with it)
  const g = plate(shape(hw - 0.03, 0.013, 0.004)); put(g, [0, 0.0075, out - 0.017], [PI / 2, 0, 0]);
  add(p, 'white', g, at, R, 'glow');
  const q = turned(R, [0, o.drop ?? -0.03, o.off ?? 0.2]);
  p.lights.push({ at: [at[0] + q[0], at[1] + q[1], at[2] + q[2]], i: o.i ?? 0.3, color: LIGHT, dir: turned(R, [0, -0.45, -0.89]), reach: o.reach ?? 0.95, poster: true });
  return p;
}

// ── the corner bench ─────────────────────────────────────────────────────────────────────────────────────────────
export function cornerBench(p, o = {}) {
  const len = o.len ?? 1.5, depth = o.depth ?? 0.5, seat = o.seat ?? 0.45, leather = leatherOf(o.leather), [s0, s1] = o.seatAt || [-len / 2, len / 2], [b0, b1] = o.backAt || [-len / 2, len / 2];
  const kick = 0.08, baseTop = seat - 0.1, front = depth - 0.03, backT = 0.09;
  // the dark base, a sunk panel along its front; the toe space under it, set back, its warm strip lighting the floor
  add(p, o.trim || 'black', solid(shape(len - 0.004, baseTop - kick, [0, 0.012], 0, (kick + baseTop) / 2), front - FACE, { edge: 0.008, back: false, front: [{ inset: 0.035, depth: -0.004, bevel: 0.005 }] }), [0, 0, FACE]);
  add(p, 'dark', solid(shape(len - 0.004, kick, 0, 0, kick / 2), front - 0.07 - FACE, { edge: 0.004, back: false }), [0, 0, FACE]);
  if (o.glow !== false) {
    add(p, 'white', plate(shape(len - 0.06, 0.012, 0.004)), [0, kick - 0.002, front - 0.03], [PI / 2, 0, 0], 'glow');
    for (let x = -len / 2 + 0.3; x < len / 2; x += 0.5) strip(p, [x, kick - 0.03, front + 0.02], 0.32, [0, -0.85, 0.5], 1.3);
    pool(p, [0, 0.03, front + 0.2], 0.32 * len, 1.1);
  }
  // the seat cushions (about half a metre each), standing on the base, in front of the back cushions
  const n = Math.max(1, Math.round((s1 - s0) / 0.5)), sw = (s1 - s0) / n, sz0 = FACE + backT, sd = depth - sz0;
  for (let i = 0; i < n; i++) add(p, leather, solid(shape(sw - 0.012, sd, 0.035, s0 + sw * (i + 0.5), -(sz0 + sd / 2)), seat - baseTop, { edge: 0.03 }), [0, baseTop, 0], FLAT);
  // the back cushions against the wall, from just over the seat
  const m = Math.max(1, Math.round((b1 - b0) / 0.5)), bw = (b1 - b0) / m;
  for (let i = 0; i < m; i++) add(p, leather, solid(shape(bw - 0.012, 0.44, 0.045, b0 + bw * (i + 0.5), seat + 0.035 + 0.22), backT, { edge: 0.032, back: false }), [0, 0, FACE]);
  return p;
}

// ── the table on its pedestal ───────────────────────────────────────────────────────────────────────────────────
export function messTable(p, o = {}) {
  const w = o.w ?? 0.75, d = o.d ?? 1.0, h = o.h ?? 0.75, c = Math.min(w, d) * 0.12;
  // the top: a charcoal rim, the steel top on it with a fine sunk line round its edge
  add(p, o.trim || 'black', solid(shape(w, d, c), 0.034, { edge: 0.008 }), [0, h - 0.046, 0], FLAT);
  add(p, STEEL, solid(shape(w - 0.026, d - 0.026, c - 0.008), 0.012, { edge: 0.004, back: false, front: [{ inset: 0.045, depth: -0.0015, bevel: 0.002 }, { inset: 0.004, depth: 0, bevel: 0.002 }] }), [0, h - 0.012, 0], FLAT);
  // the pedestal: a wide faceted foot, a column narrowing a little toward it, a head under the top
  const S = (a, b, z) => ({ s: shape(a, b, Math.min(a, b) * 0.3), z }), k = Math.min(w, d);
  add(p, GUN, loft([S(k * 0.62, d * 0.55, 0), S(k * 0.62, d * 0.55, 0.025), S(k * 0.36, d * 0.33, 0.1), S(k * 0.22, d * 0.22, 0.12), S(k * 0.26, d * 0.26, h - 0.13), S(k * 0.34, d * 0.34, h - 0.05)], { start: false }), [0, 0, 0], FLAT);
  return p;
}

// ── a stool: an 8-sided top on a faceted waist ──────────────────────────────────────────────────────────────────
export function stool(p, o = {}) {
  const h = o.h ?? 0.45, S = (a, z) => ({ s: shape(a, a, a * 0.27), z });
  add(p, GUN, loft([S(0.3, 0), S(0.3, 0.022), S(0.22, 0.06), S(0.11, h * 0.47), S(0.24, h - 0.075), S(0.27, h - 0.06)], { start: false }), [0, 0, 0], FLAT);
  add(p, STEEL, solid(shape(0.35, 0.35, 0.095), 0.028, { edge: 0.007 }), [0, h - 0.065, 0], FLAT);
  add(p, o.pad ? leatherOf(o.pad, 'stools') : PAD, solid(shape(0.32, 0.32, 0.085), 0.04, { edge: 0.012, back: false }), [0, h - 0.04, 0], FLAT);
  return p;
}

// ── the cabinets in a wall's top corner ─────────────────────────────────────────────────────────────────────────
// (each unit's side: its bottom out from the wall, a lip straight up at the front, then the front leaning back to meet
// the hull's slope (or the ceiling); its top follows the slope back to the wall. Drawn as a prism across the section,
// turned so the section stands in the y-z plane and the unit runs along x.)
export function topCabinets(p, o = {}) {
  const y = o.y ?? 1.75, depth = o.depth ?? 0.5, ceil = o.ceiling ?? 2.5, lip = o.lip ?? 0.13, sl = o.slope, len = o.len ?? 1.5;
  // (up to a ceiling, a shallow cabinet leans less: its front's top stays 0.1 m out from the wall)
  const lean = sl ? o.lean ?? 0.55 : Math.min(o.lean ?? 0.35, (depth - FACE - 0.1) / Math.max(0.1, ceil - y - lip));
  const n = o.units ?? Math.max(1, Math.round(len / 0.5)), uw = len / n, gap = 0.016;
  // where the front leaning back from (depth, y + lip) meets the slope (its face at z = 0.02 + (y' - y0) run / (ceil - y0),
  // less a 14 mm margin) or the ceiling
  let yT = ceil - 0.004, zT = depth - (yT - y - lip) * lean;
  if (sl) { const a = sl.run / (ceil - sl.y0); yT = (depth + lean * (y + lip) - 0.02 + sl.y0 * a + 0.014) / (a + lean); zT = depth - (yT - y - lip) * lean; }
  const backTop = sl ? Math.max(y + 0.05, sl.y0 - 0.005) : yT;
  const sect = [[FACE, y], [depth, y], [depth, y + lip], [zT, yT], ...(sl ? [[FACE, backTop]] : [[FACE, yT]])];
  // (the section in prism's own x, y as (z, y); run along its z, turned a quarter about y so that runs along -x)
  const unit = (x0, x1, look, s = sect) => add(p, look, prism(s, x0, x1), [0, 0, 0], [0, -PI / 2, 0]);
  unit(-len / 2 + 0.004, len / 2 - 0.004, 'dark', sect.map(([zz, yy], i) => [i === 0 || i === 4 ? zz : zz - 0.008, i < 2 ? yy + 0.006 : yy]));   // (dark behind the gaps)
  const fl = Math.hypot(zT - depth, yT - y - lip), a = Math.atan2(depth - zT, yT - y - lip);
  for (let i = 0; i < n; i++) {
    const xc = -len / 2 + uw * (i + 0.5);
    unit(-(xc + uw / 2 - gap / 2), -(xc - uw / 2 + gap / 2), 'white2');
    // its front: a raised border bevel; a dark handle slot along its lip
    const fy = y + lip + (yT - y - lip) / 2, fz = depth - (fy - y - lip) * lean;
    add(p, 'white2', relief(shape(uw - gap - 0.05, fl - 0.05, 0.045), [{ inset: 0, depth: 0.005, bevel: 0.005 }, { inset: 0.03, depth: 0.0025, bevel: 0.004 }]), [xc, fy, fz + 0.0005], [-a, 0, 0]);
    add(p, o.handle || 'black', plate(shape(Math.min(0.22, uw * 0.45), 0.022, 0.009)), [xc, y + lip * 0.5, depth + 0.0008]);
    if (o.poster != null && i === Math.floor(n / 2)) {
      const P = POSTERS[o.poster], s = Math.min((uw - 0.12) / P.w, (fl - 0.12) / P.h);
      // (on the field, 2.5 mm up off the front: a little more, along the front's own outward normal)
      add(p, '#3a3d42', decalQuad(P.w * s, P.h * s, 'cabin:poster:' + o.poster), [xc, fy + 0.0036 * Math.sin(a), fz + 0.0005 + 0.0036 * Math.cos(a)], [-a, 0, 0], 'decal');
      // (its light: a hood on the front over its top edge, turned with the front)
      const u = P.h * s / 2 + 0.008; pictureLight(p, [xc, fy + u * Math.cos(a), fz + 0.0005 - u * Math.sin(a)], [-a, 0, 0], P.w * s);
    }
  }
  // under them, a charcoal rail with a warm strip along its front, lighting the wall and what stands below
  add(p, o.trim || 'black', solid(shape(len, depth - 0.02 - FACE, 0, 0, -(FACE + (depth - 0.02 - FACE) / 2)), 0.026, { edge: 0.004 }), [0, y - 0.026, 0], FLAT);
  if (o.strip !== false) {
    add(p, 'white', plate(shape(len - 0.05, 0.014, 0.004)), [0, y - 0.027, depth - 0.05], [PI / 2, 0, 0], 'glow');
    for (let x = -len / 2 + 0.25; x < len / 2; x += 0.5) strip(p, [x, y - 0.06, depth - 0.02], 0.55, [0, -0.92, 0.38], 2.2);
    // (its pool close enough to wash the wall and what stands under it, not so close as to make a spot on the wall)
    pool(p, [0, y - 0.22, Math.max(depth - 0.05, 0.44)], 0.62 * len, 1.8);
  }
  return p;
}

// ── the cold store ──────────────────────────────────────────────────────────────────────────────────────────────
export function coldStore(p, o = {}) {
  const w = o.w ?? 0.5, depth = o.depth ?? 0.47, h = o.h ?? 2.0, d = depth - FACE, H = o.top > h + 0.1 ? o.top : h;
  add(p, 'white', solid(shape(w - 0.008, H - 0.004, [0, H > h ? 0 : 0.025], 0, H / 2), d, { edge: 0.008, back: false }), [0, 0, FACE]);
  // two doors, each a raised border-bevel panel, a dark handle slot by its edge; a small status screen (o.top: a short
  // third door over them, up to where the hull's slope meets the face)
  const doors = [[0.08, 1.2], [1.24, h - 0.06]];
  if (H > h) { add(p, 'white2', relief(shape(w - 0.05, H - h - 0.03, 0.03, 0, (h + H) / 2 - 0.01), [{ inset: 0, depth: 0.007, bevel: 0.006 }, { inset: 0.025, depth: 0.0035, bevel: 0.004 }]), [0, 0, FACE + d]); add(p, o.handle || 'black', plate(shape(Math.min(0.2, w * 0.45), 0.022, 0.009, 0, h + 0.05)), [0, 0, FACE + d + 0.0075]); }
  for (const [y0, y1] of doors) {
    add(p, 'white2', relief(shape(w - 0.05, y1 - y0, 0.04, 0, (y0 + y1) / 2), [{ inset: 0, depth: 0.007, bevel: 0.006 }, { inset: 0.032, depth: 0.0035, bevel: 0.004 }]), [0, 0, FACE + d]);
    add(p, o.handle || 'black', plate(shape(0.024, Math.min(0.32, (y1 - y0) * 0.4), 0.009, w / 2 - 0.06, y0 < 1 ? y1 - 0.25 : y0 + 0.22)), [0, 0, FACE + d + 0.0075]);
  }
  // (the screen on the lower door's field, 3.5 mm out)
  add(p, { c: '#101418', r: 0.2, m: 0.3, w: 0.1 }, plate(shape(0.13, 0.05, 0.01, -0.05, 1.08)), [0, 0, FACE + d + 0.0041]);
  add(p, 'blue', plate(shape(0.1, 0.012, 0.004, -0.05, 1.08)), [0, 0, FACE + d + 0.0045], null, 'glow');
  // (its poster framed on the upper door's field: a pale plate with a sunk border, the print on it)
  if (o.poster != null) { const P = POSTERS[o.poster], s = Math.min((w - 0.14) / P.w, 0.5 / P.h), pw = P.w * s + 0.04, ph = P.h * s + 0.04, z = FACE + d + 0.0035; add(p, 'white2', solid(shape(pw, ph, 0.02, -0.02, 1.62), 0.006, { edge: 0.002, back: false, front: [{ inset: 0.01, depth: -0.002, bevel: 0.002 }] }), [0, 0, z]); add(p, '#33363b', decalQuad(P.w * s, P.h * s, 'cabin:poster:' + o.poster), [-0.02, 1.62, z + 0.0045], null, 'decal'); pictureLight(p, [-0.02, 1.62 + ph / 2 + 0.004, z + 0.002], null, pw); }
  return p;
}

// ── the galley counter ──────────────────────────────────────────────────────────────────────────────────────────
export function galleyRun(p, o = {}) {
  const len = o.len ?? 1.25, depth = o.depth ?? 0.5, top = o.top ?? 0.9, [eL, eR] = o.end || [0, 0], kick = 0.1, d = depth - 0.03 - FACE;
  add(p, 'dark', solid(shape(len - 0.01, kick, 0, 0, kick / 2), d - 0.06, { edge: 0.004, back: false }), [0, 0, FACE]);
  add(p, 'white', solid(shape(len - 0.01, top - 0.04 - kick, 0.01, 0, (kick + top - 0.04) / 2), d, { edge: 0.008, back: false }), [0, 0, FACE]);
  // its doors: raised panels with dark handle slots, about half a metre each
  const n = Math.max(1, Math.round(len / 0.5)), dw = (len - 0.01) / n;
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.005 + dw * (i + 0.5);
    add(p, 'white2', relief(shape(dw - 0.03, top - 0.04 - kick - 0.05, 0.035, x, (kick + top - 0.04) / 2), [{ inset: 0, depth: 0.007, bevel: 0.006 }, { inset: 0.03, depth: 0.0035, bevel: 0.004 }]), [0, 0, FACE + d]);
    add(p, o.handle || 'black', plate(shape(Math.min(0.2, dw * 0.5), 0.022, 0.009, x, top - 0.04 - 0.09)), [0, 0, FACE + d + 0.0075]);
  }
  // the worktop: its front corners chamfered where its ends are open; a charcoal edge under it
  add(p, o.trim || 'black', solid(shape(len, depth - FACE + 0.02, [eL, eR, 0, 0], 0, -(FACE + (depth - FACE + 0.02) / 2)), 0.025, { edge: 0.005 }), [0, top - 0.04, 0], FLAT);
  add(p, TOP, solid(shape(len - 0.01, depth - FACE + 0.01, [Math.max(0, eL - 0.004), Math.max(0, eR - 0.004), 0, 0], 0, -(FACE + (depth - FACE + 0.01) / 2)), 0.016, { edge: 0.004, back: false }), [0, top - 0.016, 0], FLAT);
  return p;
}

// ── the drink unit: the coffee maker built into the wall, a second drink machine over it ──────────────────────────
// The game's maker (2026-11-10): "rotate the coffee maker so it faces the ships center (rather than aft) and build the
// wall more flush around it. You could even stack the coffee maker so it looks like another drink machine above it and
// make it all part of the wall tat is flush. Right now it is a dark crevice there". So it stands in the corner beside the
// cold store, its face in the cold store's plane: from the worktop up, a coffee maker's cup bay (lit, a mug on its drip
// tray, the brew head over it, a lamp that breathes while it brews), the second machine's cup bay over it (a tap, its
// live screen with the water tanks), a cupboard to where the hull's slope meets the face. A dark reveal between the three
// panels, as the lockers' doors have. Its other end runs into the wall across; the counter's end meets its face.
const OCT_CUT = 1 - Math.SQRT1_2;   // (a regular octagon's corner cut, as a share of its width)
// a panel standing `t` out of its face at z, its outline `outer`, with a cup bay cut into it (`bay`: a shape, `deep` into
// the panel's face: its walls brushed steel, its back a softly lit panel, so the bay reads as a lit niche and what stands
// in it shows against the light; a fine bevelled rim round the panel)
const BAY_BACK = [0.5, 0.44, 0.35];   // (the lit back of a cup bay: a dim warm white, linear; not the strips' full glow)
function bayPanel(p, outer, bay, z, deep, t = 0.007) {
  add(p, 'white2', prism(octagon(outer), z, z + t, { holes: bay ? [octagon(bay)] : [], back: false }));
  add(p, 'white2', relief(outer, [{ inset: 0, depth: 0.003, bevel: 0.003 }, { inset: 0.008, depth: 0, bevel: 0.003 }], { hole: true }), [0, 0, z + t]);
  if (!bay) return;
  add(p, STEEL, relief(bay, [{ inset: 0, depth: -deep, bevel: 0.006 }], { hole: true }), [0, 0, z + t]);
  add(p, BAY_BACK, plate(shape(bay.w - 0.014, bay.h - 0.014, bay.c.map((c) => Math.max(0, c - 0.004)), bay.x, bay.y)), [0, 0, z + t - deep + 0.0005], null, 'glow');
}
export function drinkUnit(p, o = {}) {
  const w = o.w ?? 0.5, depth = o.depth ?? 0.35, top = o.top ?? 2.5, base = o.base ?? 0.9, wall = o.wall ?? 0, t = 0.007;
  // (the stretch of its face that shows: an end in a wall across runs FACE into it)
  const x0 = -w / 2 + (wall < 0 ? FACE : 0), x1 = w / 2 - (wall > 0 ? FACE : 0), xc = (x0 + x1) / 2, pw = x1 - x0 - 0.016;
  const y1 = Math.min(base + 0.5, top - 0.3), y2 = Math.min(y1 + 0.58, top - 0.1);
  // (o.clear: the two machines one over the other on one line through the clear stretch, a little toward its far side to
  // leave the second machine's buttons room; its screen in the clear stretch's middle)
  const C = o.clear ? [Math.max(x0 + 0.01, o.clear[0]), Math.min(x1, o.clear[1])] : null, cw = C ? C[1] - C[0] : pw;
  const ax = C ? (C[0] + C[1]) / 2 - 0.03 : xc, qx = C ? ax : xc - 0.05, scx = C ? (C[0] + C[1]) / 2 : xc;
  // (its two cup bays: the coffee maker's from just over the worktop, the drink machine's over it)
  const bw = Math.min(0.26, pw - 0.12, 2 * (Math.min(ax - x0, x1 - ax) - 0.035)), by0 = base + 0.03, by1 = base + 0.33, bay = shape(bw, by1 - by0, [0, 0, 0.05, 0.05], ax, (by0 + by1) / 2);
  const qw = Math.min(0.2, C ? cw - 0.1 : pw - 0.16), qy0 = y1 + 0.06, qy1 = qy0 + 0.2, bay2 = shape(qw, qy1 - qy0, [0, 0, 0.04, 0.04], qx, (qy0 + qy1) / 2), holes = [octagon(bay), octagon(bay2)];
  // the body, the wall's face out to its face, the deck to its top (the counter's end hides it under the worktop; over the
  // hull's slope the slope does), open where the bays go in; the dark reveal over its face, the panels on it
  add(p, 'white', prism(octagon(shape(w - 0.004, top, 0, 0, top / 2)), FACE, depth, { holes, back: false }));
  add(p, 'dark', prism(octagon(shape(x1 - x0 - 0.004, top - base - 0.002, 0, xc, (base + top) / 2)), depth, depth + 0.0006, { holes, back: false, sides: false }));
  // THE COFFEE MAKER: its cup bay, the brew head in its top, a drip tray, a mug
  bayPanel(p, shape(pw, y1 - base - 0.012, 0.03, xc, (base + 0.006 + y1 - 0.006) / 2), bay, depth, 0.17, t);
  const zb = depth + t, zm = zb - 0.085;   // (the bay's face; the middle of its depth)
  add(p, 'black', solid(shape(bw - 0.03, 0.13, 0.012, ax, -zm), 0.014, { edge: 0.003 }), [0, by0, 0], FLAT);
  for (let k = -2; k <= 2; k++) add(p, GUN, plate(shape(bw - 0.07, 0.008, 0.003, ax, -zm + k * 0.022)), [0, by0 + 0.0145, 0], FLAT);
  add(p, STEEL, solid(shape(0.11, 0.1, 0.02, ax, -zm), 0.05, { edge: 0.006 }), [0, by1 - 0.05, 0], FLAT);
  // (the nozzle: drawn along +z, turned to hang down; turned so, a shape's y is the bay's z)
  add(p, 'black', loft([{ s: shape(0.03, 0.03, 0.009, ax, zm), z: 0 }, { s: shape(0.022, 0.022, 0.006, ax, zm), z: 0.03 }]), [0, by1 - 0.05, 0], [PI / 2, 0, 0]);
  // (the bay's light: a strip under its front top edge, facing down on the cup, and its lit back)
  add(p, 'white', plate(shape(bw - 0.06, 0.01, 0.004)), [ax, by1 - 0.004, zb - 0.012], [PI / 2, 0, 0], 'glow');
  strip(p, [ax, by1 - 0.03, zb - 0.03], 0.5, [0, -0.8, 0.6], 0.7);
  placeInto(p, part(mug, { look: o.cup }), { at: [ax + 0.02, by0 + 0.0145, zm - 0.005], rot: [0, PI / 2 + 0.5, 0] });
  // its controls over the bay: a dark strip, three buttons, the brewing lamp (it breathes, slowly)
  const cy = (by1 + y1) / 2 + 0.005;
  add(p, 'black', solid(shape(pw - 0.07, 0.05, 0.012, xc, cy), 0.004, { edge: 0.0015, back: false }), [0, 0, zb]);
  for (const [k, look] of [[-1, 'amber'], [0, 'white'], [1, 'white']]) add(p, look, plate(shape(0.026, 0.016, 0.005, xc - 0.05 + k * 0.045, cy)), [0, 0, zb + 0.0045], null, 'glow');
  liveLamp(p, { w: 0.05, h: 0.012, mode: 'breathe', every: 6, glow: 'amber', phase: 0.3 }, [xc + 0.09, cy, zb + 0.0045]);
  // THE DRINK MACHINE over it: a smaller cup bay with a tap, its grille, its live screen (the water tanks), two buttons
  bayPanel(p, shape(pw, y2 - y1 - 0.012, 0.03, xc, (y1 + y2) / 2), bay2, depth, 0.13, t);
  add(p, GUN, solid(shape(qw - 0.03, 0.09, 0.01, qx, -(zb - 0.065)), 0.01, { edge: 0.003 }), [0, qy0, 0], FLAT);
  add(p, STEEL, loft([{ s: shape(0.03, 0.03, 0.009, qx, zb - 0.07), z: 0 }, { s: shape(0.024, 0.024, 0.007, qx, zb - 0.07), z: 0.045 }]), [0, qy1, 0], [PI / 2, 0, 0]);
  add(p, 'white', plate(shape(qw - 0.05, 0.008, 0.003)), [qx, qy1 - 0.004, zb - 0.01], [PI / 2, 0, 0], 'glow');
  strip(p, [qx, qy1 - 0.03, zb - 0.03], 0.35, [0, -0.8, 0.6], 0.6);
  for (const [k, look] of [[0, 'blue'], [1, 'white']]) add(p, look, plate(shape(0.024, 0.024, 0.006, qx + qw / 2 + 0.02, qy0 + 0.05 + k * 0.06)), [0, 0, zb + 0.0005], null, 'glow');
  const sw = Math.min(0.2, cw - 0.06), sh = Math.min(0.12, y2 - qy1 - 0.06), sy = (qy1 + y2) / 2 + 0.005;
  if (sh > 0.06) {
    add(p, 'black', solid(shape(sw + 0.02, sh + 0.02, 0.012, scx, sy), 0.008, { edge: 0.002, back: false, front: [{ inset: 0.006, depth: -0.004, bevel: 0.003 }] }), [0, 0, zb]);
    liveFace(p, { show: 'water', seed: 0.37, w: sw, h: sh, c: 0.008 }, [scx, sy, zb + 0.0052]);
  }
  // THE CUPBOARD over them, to the top: a door, its handle slot along its foot
  if (top - y2 > 0.12) {
    add(p, 'white2', relief(shape(pw, top - y2 - 0.012, 0.03, xc, (y2 + top) / 2), [{ inset: 0, depth: t, bevel: 0.006 }, { inset: 0.025, depth: 0.0035, bevel: 0.004 }]), [0, 0, depth]);
    add(p, o.handle || 'black', plate(shape(Math.min(0.2, pw * 0.45), 0.022, 0.009, xc, y2 + 0.05)), [0, 0, depth + t + 0.0005]);
  }
  return p;
}

// ── the wall over the galley counter ────────────────────────────────────────────────────────────────────────────
// One raised panel from the worktop to the cabinets (no panel seams across it), and an eight-sided opening in it for each
// grow pod (kit/shipparts/cabin/growpod.js, another helper's: its chamber goes on behind the wall's face), each with a
// bevelled lip down to the wall's face; until a pod stands in one, a blanking plate.
export function backsplash(p, o = {}) {
  // (12 mm thick: the wall's own raised panels stand up to 1 cm out of its face, and must not show through it)
  const len = o.len ?? 1, y0 = o.y0 ?? 0.9, y1 = o.y1 ?? 1.55, hs = o.hole ?? 0.44, t = 0.012, z = FACE;
  const oct = (x, y, s) => shape(s, s, s * OCT_CUT, x, y), holes = o.holes || [];
  add(p, 'white2', prism(octagon(shape(len, y1 - y0, [0, 0, 0.03, 0.03], 0, (y0 + y1) / 2)), z, z + t, { holes: holes.map(([x, y]) => octagon(oct(x, y, hs))), back: false }));
  add(p, 'white2', relief(shape(len, y1 - y0, [0, 0, 0.03, 0.03], 0, (y0 + y1) / 2), [{ inset: 0, depth: 0.003, bevel: 0.003 }, { inset: 0.01, depth: 0, bevel: 0.003 }], { hole: true }), [0, 0, z + t]);
  for (const [x, y] of holes) {
    add(p, 'white2', relief(oct(x, y, hs + 0.02), [{ inset: 0, depth: 0.003, bevel: 0.003 }, { inset: 0.004, depth: -t - 0.003 + 0.0005, bevel: 0.003 }], { hole: true }), [0, 0, z + t]);
    if (o.blanks === false) continue;
    // (the blanking plate, level with the panel's face, sunk a little in its middle; four screws)
    add(p, 'grey2', relief(oct(x, y, hs - 0.004), [{ inset: 0, depth: 0.002, bevel: 0.002 }, { inset: 0.035, depth: -0.001, bevel: 0.003 }]), [0, 0, z + t + 0.0005]);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) add(p, GUN, solid(shape(0.016, 0.016, 0.005, x + a * hs * 0.3, y + b * hs * 0.3), 0.003, { edge: 0.0012, back: false }), [0, 0, z + t + 0.002]);
  }
  return p;
}

// ── the small things on the counter and the table ──────────────────────────────────────────────────────────────
export function coffeeMachine(p) {
  // a gunmetal base and back column, a steel water tank on top, a black front with a glowing button, the carafe
  add(p, 'gun', solid(shape(0.22, 0.24, 0.03, 0, 0), 0.03, { edge: 0.006 }), [0, 0, 0], FLAT);
  add(p, STEEL, solid(shape(0.2, 0.32, [0.01, 0.03], 0, 0.19), 0.1, { edge: 0.008 }), [0, 0, -0.12]);
  add(p, 'black', solid(shape(0.19, 0.08, 0.015, 0, 0.3), 0.12, { edge: 0.008 }), [0, 0, -0.04]);
  add(p, STEEL, loft([{ s: shape(0.17, 0.08, 0.025), z: 0 }, { s: shape(0.18, 0.09, 0.028), z: 0.08 }]), [0, 0.34, -0.07], FLAT);
  add(p, 'amber', plate(shape(0.018, 0.018, 0.006, 0.06, 0.3)), [0, 0, 0.0805], null, 'glow');
  add(p, { c: '#20242a', r: 0.15, m: 0.2, w: 0.1 }, loft([{ s: shape(0.1, 0.1, 0.03), z: 0 }, { s: shape(0.12, 0.12, 0.036), z: 0.06 }, { s: shape(0.1, 0.1, 0.03), z: 0.12 }, { s: shape(0.07, 0.07, 0.02), z: 0.15 }]), [0, 0.03, 0.02], FLAT);
  return p;
}
export function mug(p, o = {}) {
  const S = (a, z) => ({ s: shape(a, a, a * 0.29), z });
  add(p, o.look || 'black', loft([S(0.07, 0), S(0.076, 0.095)]), [0, 0, 0], FLAT);
  add(p, { c: '#2a1a10', r: 0.2, m: 0, w: 0 }, plate(shape(0.066, 0.066, 0.019)), [0, 0.088, 0], FLAT);
  add(p, o.look || 'black', prism([[0, 0], [0.03, 0], [0.04, 0.012], [0.04, 0.058], [0.03, 0.07], [0, 0.07], [0, 0.058], [0.026, 0.058], [0.028, 0.012], [0, 0.012]], -0.007, 0.007), [0.036, 0.012, 0]);
  add(p, '#d9d6cf', decalQuad(0.035, 0.035, 'cabin:delta'), [0, 0.05, 0.0385], null, 'decal');
  return p;
}
export function bottle(p, o = {}) {
  const S = (a, z) => ({ s: shape(a, a, a * 0.29), z });
  add(p, o.look || 'gun', loft([S(0.07, 0), S(0.07, 0.2), S(0.05, 0.23), S(0.045, 0.27)]), [0, 0, 0], FLAT);
  add(p, 'black', loft([S(0.05, 0), S(0.05, 0.03)]), [0, 0.27, 0], FLAT);
  return p;
}
export function fruitBowl(p) {
  const S = (a, z) => ({ s: shape(a, a, a * 0.29), z });
  add(p, 'black', loft([S(0.11, 0), S(0.12, 0.012), S(0.26, 0.07), S(0.27, 0.075)], { end: false }), [0, 0, 0], FLAT);
  add(p, { c: '#1d1f22', r: 0.4, m: 0.2, w: 0.2 }, loft([S(0.25, 0.072), S(0.13, 0.02)], { start: false }), [0, 0, 0], FLAT);
  // oranges (an icosahedron each: faceted, as the rest)
  const orange = { c: '#d9741c', r: 0.55, m: 0, w: 0.2 };
  for (const [x, y, z] of [[-0.05, 0.05, -0.03], [0.05, 0.05, -0.02], [0, 0.05, 0.05], [0.005, 0.098, -0.002]]) {
    const g = mergeVertices(new THREE.IcosahedronGeometry(0.038, 1), 1e-5); g.computeVertexNormals(); add(p, orange, g, [x, y, z]);
  }
  return p;
}

// ── on the walls ────────────────────────────────────────────────────────────────────────────────────────────────
export function poster(p, o = {}) {
  const P = POSTERS[o.i ?? 0], w = o.w ?? P.w, h = o.h ?? P.h, y = o.y ?? 1.3, dark = o.dark ?? false;
  const look = dark ? { c: '#22252a', r: 0.5, m: 0.1, w: 0.3 } : 'white2';
  add(p, look, solid(shape(w, h, 0.03, 0, y), 0.012, { edge: 0.003, back: false, front: [{ inset: 0.016, depth: -0.003, bevel: 0.003 }] }), [0, 0, FACE]);
  add(p, dark ? '#dcd9d2' : '#2c2e32', decalQuad(w - 0.06, h - 0.06, 'cabin:poster:' + (o.i ?? 0)), [0, y, FACE + 0.0095], null, 'decal');
  pictureLight(p, [0, y + h / 2 + 0.006, FACE], null, w);
  return p;
}
export function wallField(p, o = {}) {
  add(p, 'white2', relief(shape(o.w ?? 0.6, o.h ?? 0.8, o.c ?? 0.05, 0, o.y ?? 1.2), [{ inset: 0, depth: 0.007, bevel: 0.007 }, { inset: 0.035, depth: 0.003, bevel: 0.006 }]), [0, 0, FACE]);
  return p;
}
