// ENGINEERING, in the bevel helper's language (kit/bevel.js), plainly, a first pass from the plan and the concept sheet's
// engineering (refs/ships/explorer_concept2_chatgpt_2026-11-03.png: a big drum with heavy rings, copper pipes, a console
// with screens, gear on shelves): the reactor standing in its corner, its glowing core seen between the ribs of its cage
// (cheap: a glow column, eight ribs, two collars), lit seams, pipes into the wall; the drive, a drum lying along the hull
// on two cradles with heavy rings, a blue glow at its end, two pumps beside it piped to it in copper; the engineering
// station, a desk with a sloped control top (a screen, rows of lit buttons) and two screens over it; gear shelves with
// crates; the tool lockers are the bunk room's lockers, labelled TOOLS.
// Frames (kit/shipparts/cabin/ship.js): a WALL fitting stands on a wall line, x along the wall, centred; z = 0 on the line,
// its back at the wall's face (FACE), facing +z; y = 0 the deck.
//   reactorCore(p, o)  o.len (1.5), o.depth (1.25), o.h (1.8), o.back (+1: the end of it against a wall across, where its
//                      pipes go: +x; -1; 0 none), o.ceiling (2.5: its pipe up goes to it), o.pipeY (the height of pipes
//                      along the wall it backs onto: its pipe up turns there into that wall, meeting them), o.trim
//   drivePumps(p, o)   o.len (1.5), o.depth (1.25), o.h (1.8), o.back (the drum's end at a wall: -1, its own -x; +1),
//                      o.pipeY (as the reactor's: a pipe up from the drum to them), o.trim
//   engStation(p, o)   o.len (1), o.depth (0.5), o.h (1.2: its desk's back; the screens rise over it), o.handle, o.trim
//   gearShelves(p, o)  o.len (1), o.depth (0.5), o.h (1.8), o.trim
import { shape, solid, loft, plate, relief, prism, add } from '../../bevel.js';
import { FACE } from './ship.js';
import { FLAT, printed, glowStrip, screen, pool, strip, hazard, pipe, COPPER, localAt, decalQuad } from './bits.js';
import { PANEL } from './bunks.js';
import { GUN, STEEL } from './mess.js';

const PI = Math.PI;
const CORE = [0.55, 1.4, 2.7], CORE_END = [0.08, 0.3, 0.95], SEAM = [0.6, 1.9, 4.2], DRUM = { c: '#8f949b', r: 0.5, m: 0.4, w: 0.4 };
// an 8-sided section of width a (and b) at z, centred on (x, y) in the loft's own plane
const O = (a, z, x = 0, y = 0, b = a) => ({ s: shape(a, b, Math.min(a, b) * 0.293, x, y), z });

// ── the reactor ─────────────────────────────────────────────────────────────────────────────────────────────────
export function reactorCore(p, o = {}) {
  const len = o.len ?? 1.5, depth = o.depth ?? 1.25, h = Math.min(o.h ?? 1.8, 1.9), back = o.back ?? 1, zc = FACE + (depth - FACE) / 2, d = Math.min(depth - FACE - 0.2, len - 0.3, 1.0);
  const at = [0, 0, 0], col = (a, y0, y1, look, mat = 'solid', o2 = {}) => add(p, look, loft([O(a, y0, 0, -zc), O(a, y1, 0, -zc)], o2), at, FLAT, mat);
  // the plinth, the lower housing with its lit seam and its label, the core in its cage, the upper housing, the cap
  add(p, 'dark', loft([O(d * 1.08, 0, 0, -zc), O(d * 1.08, 0.06, 0, -zc), O(d * 0.98, 0.12, 0, -zc)]), at, FLAT);
  add(p, GUN, loft([O(d * 0.9, 0.12, 0, -zc), O(d * 0.9, 0.4, 0, -zc), O(d * 0.84, 0.45, 0, -zc)], { start: false }), at, FLAT);
  col(d * 0.92, 0.36, 0.38, SEAM, 'glow', { start: false, end: false });
  // (the core brightest in its middle, deeper blue toward its ends: one colour a section, the glow's vertices take them)
  const cy0 = 0.45, cy1 = h * 0.73, core = add(p, [1, 1, 1], loft([O(d * 0.42, cy0, 0, -zc), O(d * 0.42, (cy0 + cy1) / 2, 0, -zc), O(d * 0.42, cy1, 0, -zc)], { start: false, end: false }), at, FLAT, 'glow');
  { const P = core.attributes.position.array, C = core.attributes.color.array; for (let i = 0; i < P.length / 3; i++) { const t = Math.sin(PI * Math.max(0, Math.min(1, (P[i * 3 + 1] - cy0) / (cy1 - cy0)))); for (let k = 0; k < 3; k++) C[i * 3 + k] = CORE_END[k] + (CORE[k] - CORE_END[k]) * t; } }
  const r = d * 0.36, ribs = 8;
  for (let i = 0; i < ribs; i++) { const a = (i + 0.5) / ribs * PI * 2, x = Math.cos(a) * r, z = zc + Math.sin(a) * r; add(p, o.trim || 'black', loft([O(0.05, 0, x, -z), O(0.05, h * 0.73 - 0.45, x, -z)], { start: false, end: false }), [0, 0.45, 0], FLAT); }
  for (const y of [0.62, h * 0.55]) add(p, STEEL, loft([O(d * 0.79, y, 0, -zc), O(d * 0.79, y + 0.045, 0, -zc)], { start: false, end: false }), at, FLAT);
  add(p, GUN, loft([O(d * 0.84, h * 0.73, 0, -zc), O(d * 0.9, h * 0.73 + 0.05, 0, -zc), O(d * 0.9, h * 0.88, 0, -zc), O(d * 0.6, h * 0.95, 0, -zc), O(d * 0.36, h, 0, -zc)], { start: false }), at, FLAT);
  col(d * 0.92, h * 0.78, h * 0.79, SEAM, 'glow', { start: false, end: false });
  // the label and the caution plate on the lower housing's front facet
  const fz = zc + d * 0.45 + 0.002;
  printed(p, 'label:reactor', 0.26, 0.0325, [0, 0.26, fz]);
  add(p, '#c9a032', decalQuad(0.2, 0.05, 'cp:caution'), [0, 0.18, fz], null, 'decal');
  // pipes: two from the upper housing into the wall across (the end it backs onto), one up from the cap to the ceiling
  if (back) for (const [y, look] of [[h * 0.83, COPPER], [h * 0.64, 'yellow']]) pipe(p, look, [back * d * 0.4, y, zc - 0.12 * (look === COPPER ? 1 : -1)], [back * (len / 2 - FACE + 0.01), y, zc - 0.12 * (look === COPPER ? 1 : -1)], 0.045);
  if (o.pipeY && back) {
    pipe(p, COPPER, [0, h - 0.01, zc], [0, o.pipeY + 0.06, zc], 0.055, { flange1: 0.1 });
    pipe(p, COPPER, [0, o.pipeY, zc], [back * (len / 2 - FACE + 0.01), o.pipeY, zc], 0.042, { flange0: 0.08 });
    add(p, GUN, loft([O(0.15, o.pipeY - 0.075, 0, -zc), O(0.15, o.pipeY + 0.075, 0, -zc)]), at, FLAT);
  } else pipe(p, COPPER, [0, h - 0.01, zc], [0, (o.ceiling ?? 2.5) - 0.01, zc], 0.06);
  // the core's light, and its pool; a hazard band on the floor in front of it
  strip(p, [0, h * 0.5, zc + d * 0.5], 0.5, null, 2.4, [0.55, 0.8, 1.0]);
  strip(p, [0, h * 0.5, zc - d * 0.5], 0.2, null, 1.6, [0.55, 0.8, 1.0]);
  pool(p, [0, h * 0.5, zc + d * 0.6], 0.8, 2.3, [0.5, 0.75, 1.0]);
  hazard(p, Math.min(len - 0.1, d * 1.2), 0.08, [0, 0.003, zc + d * 0.62], [-PI / 2, 0, 0]);
  return p;
}

// ── the drive and its pumps ─────────────────────────────────────────────────────────────────────────────────────
export function drivePumps(p, o = {}) {
  const len = o.len ?? 1.5, depth = o.depth ?? 1.25, h = Math.min(o.h ?? 1.8, 1.9), back = o.back ?? -1, R = Math.min(0.42, (depth - FACE) * 0.34), zd = FACE + R + 0.1, yd = Math.min(h - R - 0.15, 0.82);
  const x0 = back < 0 ? -len / 2 + FACE : -len / 2 + 0.12, x1 = back > 0 ? len / 2 - FACE : len / 2 - 0.12, rot = [0, PI / 2, 0];
  // (the drum along x: a loft along +z turned a quarter, so its sections' x is the ship's -z: centred on -zd... its own
  // (x, y) = (-z, y))
  const D = (a, xx) => ({ s: shape(a, a, a * 0.293, -zd, yd), z: xx });
  add(p, DRUM, loft([D(2 * R * 0.8, x0), D(2 * R, x0 + 0.06), D(2 * R, x1 - 0.12)], { end: false }), [0, 0, 0], rot);
  add(p, GUN, loft([D(2 * R, x1 - 0.12), D(2 * R * 0.72, x1 - 0.02), D(2 * R * 0.5, x1)], { start: false }), [0, 0, 0], rot);
  for (const xx of [x0 + 0.18, (x0 + x1) / 2, x1 - 0.24]) add(p, GUN, loft([D(2 * R * 1.12, xx - 0.035), D(2 * R * 1.12, xx + 0.035)], { start: false, end: false }), [0, 0, 0], rot);
  add(p, SEAM, loft([D(2 * R * 1.02, (x0 + x1) / 2 + 0.05), D(2 * R * 1.02, (x0 + x1) / 2 + 0.065)], { start: false, end: false }), [0, 0, 0], rot, 'glow');
  // (its end: a blue ring of light round the cap, as the concept's engines)
  add(p, [0.3, 0.85, 2.1], loft([D(2 * R * 0.79, x1 - 0.075), D(2 * R * 0.79, x1 - 0.05)], { start: false, end: false }), [0, 0, 0], rot, 'glow');
  // the cradles under it
  for (const xx of [x0 + 0.32, x1 - 0.38]) add(p, 'dark', prism([[-zd - R * 0.9, 0], [-zd + R * 0.9, 0], [-zd + R * 0.55, yd - R * 0.7], [-zd - R * 0.55, yd - R * 0.7]], xx - 0.05, xx + 0.05), [0, 0, 0], rot);
  // the pumps: on a skid in front of the drum, each a faceted column with a motor on top, piped to the drum in copper
  const zp = Math.min(depth - 0.16, zd + R + 0.2);
  add(p, 'dark', solid(shape(len * 0.62, 0.3, 0.03, 0, -zp), 0.06, { edge: 0.01 }), [0, 0, 0], FLAT);
  for (const xp of [-len * 0.16, len * 0.14]) {
    add(p, 'yellow', loft([O(0.2, 0.06, xp, -zp), O(0.2, 0.42, xp, -zp), O(0.15, 0.46, xp, -zp)]), [0, 0, 0], FLAT);
    add(p, GUN, solid(shape(0.17, 0.17, 0.03, xp, -zp), 0.14, { edge: 0.012 }), [0, 0.46, 0], FLAT);
    pipe(p, COPPER, [xp, 0.6, zp], [xp, yd + 0.04, zp], 0.035, { flange1: 0 });
    pipe(p, COPPER, [xp, yd, zp + 0.035], [xp, yd, zd + R * 0.85], 0.035, { flange0: 0 });
  }
  // (a pipe up from the drum by the wall it backs onto, to the pipes along that wall, if there are)
  if (o.pipeY) { const xr = back < 0 ? -len / 2 + FACE + 0.07 : len / 2 - FACE - 0.07; pipe(p, COPPER, [xr, yd + R * 0.9, zd], [xr, o.pipeY + 0.04, zd], 0.042, { flange0: 0.04 }); }
  // its light: the blue glow at the drum's end, a lit seam
  strip(p, [x1 + 0.12, yd, zd], 0.35, [Math.sign(x1) || 1, 0, 0], 1.6, [0.55, 0.8, 1.0]);
  pool(p, [x1 * 0.3, yd - 0.2, zd + R + 0.45], 0.35, 2.0, [0.55, 0.8, 1.0]);
  return p;
}

// ── the engineering station ─────────────────────────────────────────────────────────────────────────────────────
export function engStation(p, o = {}) {
  const len = o.len ?? 1, depth = o.depth ?? 0.5, h = o.h ?? 1.2, desk = 0.84, d = depth - 0.03 - FACE, fz = FACE + d;
  add(p, 'dark', solid(shape(len - 0.01, 0.1, 0, 0, 0.05), d - 0.06, { edge: 0.004, back: false }), [0, 0, FACE]);
  add(p, 'white', solid(shape(len - 0.01, desk - 0.1, 0.01, 0, (desk + 0.1) / 2), d, { edge: 0.008, back: false }), [0, 0, FACE]);
  const n = Math.max(1, Math.round(len / 0.5)), dw = (len - 0.01) / n;
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.005 + dw * (i + 0.5);
    add(p, 'white2', relief(shape(dw - 0.03, desk - 0.18, 0.035, x, (desk + 0.1) / 2), PANEL), [0, 0, fz]);
    add(p, o.handle || 'black', plate(shape(Math.min(0.2, dw * 0.5), 0.022, 0.009, x, desk - 0.12)), [0, 0, fz + 0.0075]);
  }
  // the control top, sloping up toward the wall: a charcoal slab, a screen and rows of lit buttons in it
  const z0 = depth - 0.01, z1 = FACE + 0.14, y0 = desk, y1 = desk + 0.13;
  add(p, o.trim || 'black', prism([[z1, y0], [z0, y0], [z0, y0 + 0.03], [z1, y1]], -len / 2, len / 2), [0, 0, 0], [0, -PI / 2, 0]);
  const tilt = Math.atan2(y1 - y0 - 0.03, z0 - z1), mid = [0, (y0 + 0.03 + y1) / 2 + 0.003, (z0 + z1) / 2];
  screen(p, { w: 0.34, h: 0.17, rect: 'terminal', sub: [0.02, 0.04, 0.98, 0.98], gain: 1.3, depth: 0.008, bezel: 0.012 }, [-len * 0.18, mid[1], mid[2]], [-PI / 2 + tilt, 0, 0]);
  const BT = ['green', 'amber', 'blue', 'amber', 'green', 'blue'];
  for (let k = 0; k < 6; k++) { const bx = len * 0.12 + (k % 3) * 0.07, bz = (k < 3 ? -0.04 : 0.03); add(p, BT[k], plate(shape(0.04, 0.026, 0.008)), localAt([0, mid[1] + 0.004, mid[2]], [-PI / 2 + tilt, 0, 0], [bx, bz, 0.002]), [-PI / 2 + tilt, 0, 0], 'glow'); }
  // the two screens over it, in bezels, a light strip under them lighting the desk
  const sy = desk + 0.13 + 0.26;
  screen(p, { w: len * 0.4, h: 0.26, rect: 'status', gain: 1.3, light: 0.14 }, [-len * 0.22, sy, FACE]);
  screen(p, { w: len * 0.4, h: 0.26, rect: 'radar', gain: 1.3, light: 0.14 }, [len * 0.22, sy, FACE]);
  glowStrip(p, len * 0.86, [0, sy - 0.16, FACE + 0.02], [PI / 3, 0, 0], { i: 0.2, dir: [0, -0.2, 1], reach: 1.2, pool: 0.4, poolAt: [0, desk + 0.3, depth + 0.25] });
  // its name on the control top's front lip (the station's ENG-1 stencil)
  p.decal('label:ENG-1', 0.1, 0.025, [0, y0 + 0.015, z0 + 0.0015], null, '#c9c7bf');
  return p;
}

// ── the gear shelves ────────────────────────────────────────────────────────────────────────────────────────────
export function gearShelves(p, o = {}) {
  const len = o.len ?? 1, depth = o.depth ?? 0.5, h = o.h ?? 1.8, d = depth - 0.02 - FACE, zc = FACE + d / 2, trim = o.trim || 'black';
  for (const s of [-1, 1]) add(p, 'white', solid(shape(d, h, [0, 0, 0.02, 0.02], -s * zc, h / 2), 0.03, { edge: 0.006 }), [s * (len / 2 - 0.03), 0, 0], [0, s * PI / 2, 0]);
  const ys = [0.08, 0.5, 0.92, 1.34, h - 0.03];
  ys.forEach((y, i) => {
    add(p, 'white2', solid(shape(len - 0.06, d, 0, 0, -zc), 0.025, { edge: 0.005 }), [0, y - 0.025, 0], FLAT);
    add(p, trim, solid(shape(len - 0.06, 0.035, 0.008, 0, y + 0.005), 0.012, { edge: 0.003, back: false }), [0, 0, FACE + d - 0.012]);
    if (i === ys.length - 1) return;
    // crates on it: a few, of a few sizes, their lids border-bevelled; one striped
    const room = (ys[i + 1] - y) - 0.07, row = [[0.34, 0.26, 'grey2'], [0.24, 0.3, 'yellow'], [0.26, 0.2, 'dark']].map((c, k) => [...c, k]);
    let x = -len / 2 + 0.06;
    for (const [w, hh, look, k] of row) {
      const cw = Math.min(w, len / 2 - 0.05 - x), ch = Math.min(hh + ((i * 3 + k) % 3) * 0.03, room); if (cw < 0.12) break;
      add(p, look, solid(shape(cw, d - 0.06, 0.02, x + cw / 2, -zc), ch, { edge: 0.01, front: [{ inset: 0.02, depth: 0.005, bevel: 0.005 }] }), [0, y, 0], FLAT);
      add(p, look, relief(shape(cw - 0.04, ch - 0.04, 0.015, x + cw / 2, y + ch / 2), PANEL), [0, 0, FACE + d - 0.03]);
      if ((i + k) % 4 === 1) hazard(p, cw - 0.06, 0.035, [x + cw / 2, y + ch * 0.55, FACE + d - 0.03 + 0.0075]);
      x += cw + 0.04;
    }
  });
  glowStrip(p, len - 0.14, [0, ys[ys.length - 1] - 0.03, FACE + d - 0.05], [PI / 2, 0, 0], { i: 0.14, dir: [0, 0.3, 0.95], reach: 1.2, pool: 0.25, poolAt: [0, 1.1, depth + 0.25] });
  return p;
}
