// THE WASHROOM, in the bevel helper's language (kit/bevel.js), plainly, a first pass from the plan: a shower stall in its
// corner (a tray with a sunk floor and a drain, glass on its open sides in a charcoal frame, a shower head and a mixer
// screen on the wall, a light inside); a toilet hung on the wall (its cistern a raised panel with a lit flush button, an
// 8-sided bowl, seat and lid) with a small basin beside it and a mirror-screen over the basin, a light strip over that.
// Frames (kit/shipparts/cabin/ship.js): a WALL fitting stands on a wall line, x along the wall, centred; z = 0 on the line,
// its back at the wall's face (FACE), facing +z; y = 0 the deck.
//   showerStall(p, o)  o.len (0.75), o.depth (0.75), o.h (2), o.ends ([left, right]: true where the stall's end is open
//                      to the room (glass), false where a wall closes it), o.trim
//   toiletBasin(p, o)  o.len (0.75: the toilet at one end, the basin at the other if it is 0.65 or more), o.depth (0.5),
//                      o.side (+1: the toilet at the +x end), o.handle, o.trim
import { shape, solid, loft, plate, relief, add } from '../../bevel.js';
import { FACE } from './ship.js';
import { FLAT, glowStrip, screen, GLASSY } from './bits.js';
import { STEEL } from './mess.js';

const PI = Math.PI;
const CERAMIC = { c: '#d8d8d2', r: 0.25, m: 0.0, w: 0.15 };
const glass = (p, w, h, at, rot) => add(p, null, plate(shape(w, h, 0)), at, rot, 'glass');

// ── the shower stall ────────────────────────────────────────────────────────────────────────────────────────────
export function showerStall(p, o = {}) {
  const len = o.len ?? 0.75, depth = o.depth ?? 0.75, h = o.h ?? 2, [openL, openR] = o.ends || [false, true], trim = o.trim || 'black', zc = (FACE + depth) / 2, dz = depth - FACE;
  // the tray: a low pale block, its floor sunk, a drain in it
  add(p, 'white2', solid(shape(len - 0.01, dz - 0.01, 0.02, 0, -zc), 0.08, { edge: 0.01, back: false, front: [{ inset: 0.04, depth: -0.02, bevel: 0.015 }] }), [0, 0, 0], FLAT);
  add(p, { c: '#55595f', r: 0.6, m: 0.3, w: 0.2 }, plate(shape(0.09, 0.09, 0.026, 0, -zc)), [0, 0.062, 0], FLAT);
  // the frame: posts at the open corners, a rail round the top of the open sides; glass in it, the door's handle
  const S = (a) => ({ s: shape(a, a, a * 0.3), z: 0 }), post = (x, z) => add(p, trim, loft([S(0.04), { ...S(0.04), z: h - 0.08 }], { start: false }), [x, 0.08, z], FLAT);
  const fx = len / 2 - 0.02, fz = depth - 0.02;
  post(-fx, fz); post(fx, fz);
  add(p, trim, solid(shape(len, 0.04, 0.01, 0, h - 0.02), 0.04, { edge: 0.006 }), [0, 0, fz - 0.02]);
  glass(p, len - 0.08, h - 0.2, [0, 0.08 + (h - 0.2) / 2, fz]);
  add(p, trim, solid(shape(0.025, 0.4, 0.008, -fx + 0.12, 1.1), 0.03, { edge: 0.006 }), [0, 0, fz + 0.005]);
  for (const [open, s] of [[openL, -1], [openR, 1]]) {
    if (!open) continue;
    add(p, trim, solid(shape(dz - 0.02, 0.04, 0.01, -s * zc, h - 0.02), 0.04, { edge: 0.006 }), [s * fx + (s > 0 ? -0.02 : 0.02), 0, 0], [0, s * PI / 2, 0]);
    post(s * fx, FACE + 0.03);
    glass(p, dz - 0.08, h - 0.2, [s * fx, 0.08 + (h - 0.2) / 2, zc], [0, s * PI / 2, 0]);
  }
  // on the wall: the shower head (an 8-sided rose on an arm), the mixer screen; a light strip over it all
  add(p, STEEL, loft([{ s: shape(0.03, 0.03, 0.009), z: 0 }, { s: shape(0.03, 0.03, 0.009), z: 0.22 }]), [0, h - 0.17, FACE], null);
  add(p, STEEL, loft([{ s: shape(0.16, 0.16, 0.047), z: 0 }, { s: shape(0.18, 0.18, 0.053), z: 0.03 }]), [0, h - 0.2, FACE + 0.22], [PI / 2, 0, 0]);
  add(p, 'dark', plate(shape(0.15, 0.15, 0.044)), [0, h - 0.231, FACE + 0.22], [PI / 2, 0, 0]);
  screen(p, { w: 0.1, h: 0.07, rect: 'status', sub: [0.03, 0.08, 0.6, 0.5], gain: 1.1, depth: 0.014, bezel: 0.016 }, [len * 0.25, 1.2, FACE]);
  glowStrip(p, len - 0.12, [0, h - 0.06, FACE + 0.02], [PI / 4, 0, 0], { i: 0.3, dir: [0, 0, 1], reach: 1.6, color: [0.85, 0.93, 1.0], pool: 0.35, poolAt: [0, 1.1, zc] });
  return p;
}

// ── the toilet and the basin ────────────────────────────────────────────────────────────────────────────────────
export function toiletBasin(p, o = {}) {
  const len = o.len ?? 0.75, depth = o.depth ?? 0.5, side = o.side ?? 1, basin = len >= 0.65, tx = basin ? side * (len / 2 - 0.22) : 0, bx = -side * (len / 2 - 0.16);
  // the toilet: its cistern a raised panel on the wall with the flush button; the bowl hung on the wall; seat and lid
  add(p, 'white2', solid(shape(0.4, 0.5, 0.05, tx, 0.72), 0.06, { edge: 0.01, back: false, front: [{ inset: 0.03, depth: 0.004, bevel: 0.005 }] }), [0, 0, FACE]);
  add(p, 'dark', relief(shape(0.09, 0.09, 0.026, tx, 0.86), [{ inset: 0, depth: 0.006, bevel: 0.005 }]), [0, 0, FACE + 0.064]);
  add(p, 'blue', plate(shape(0.06, 0.06, 0.018, tx, 0.86)), [0, 0, FACE + 0.0705], null, 'glow');
  // (the bowl a solid narrowing to its foot, its top sunk deep into a basin; the seat a raised ring on it; the lid up)
  const bz = FACE + 0.06 + 0.24;
  add(p, CERAMIC, solid(shape(0.36, 0.48, 0.11, tx, -bz), 0.2, { edge: 0.012, taper: shape(0.2, 0.26, 0.06, tx, -(bz - 0.08)), front: [{ inset: 0.035, depth: -0.09, bevel: 0.05 }] }), [0, 0.2, 0], FLAT);
  add(p, { c: '#9fb2c0', r: 0.08, m: 0.1, w: 0.05 }, plate(shape(0.17, 0.23, 0.05, tx, -bz)), [0, 0.313, 0], FLAT);
  add(p, 'white', relief(shape(0.37, 0.49, 0.11, tx, -bz), [{ inset: 0, depth: 0.022, bevel: 0.01 }, { inset: 0.035, depth: 0.0, bevel: 0.015 }], { hole: true, jamb: -0.01 }), [0, 0.4, 0], FLAT);
  add(p, 'white', solid(shape(0.34, 0.4, 0.1, tx, 0.62), 0.03, { edge: 0.01 }), [0, 0, FACE + 0.065]);
  // the basin: a small block hung on the wall, its bowl sunk; a tap; the mirror-screen over it and a light over that
  if (basin) {
    add(p, 'white2', solid(shape(0.28, 0.24, 0.05, bx, -(FACE + 0.12)), 0.12, { edge: 0.012, back: false, front: [{ inset: 0.025, depth: -0.07, bevel: 0.03 }] }), [0, 0.7, 0], FLAT);
    add(p, STEEL, solid(shape(0.03, 0.12, 0.008, bx, -(FACE + 0.05)), 0.03, { edge: 0.006 }), [0, 0.82, 0], FLAT);
    add(p, STEEL, solid(shape(0.025, 0.025, 0.007, bx, 0.86), 0.09, { edge: 0.005 }), [0, 0, FACE + 0.02]);
    add(p, o.trim || 'black', solid(shape(0.3, 0.46, 0.07, bx, 1.36), 0.02, { edge: 0.005, back: false, front: [{ inset: 0.01, depth: 0.003, bevel: 0.003 }, { inset: 0.008, depth: -0.004, bevel: 0.004 }] }), [0, 0, FACE]);
    add(p, GLASSY, plate(shape(0.26, 0.42, 0.06, bx, 1.36)), [0, 0, FACE + 0.0175]);
    screen(p, { w: 0.13, h: 0.06, rect: 'status', sub: [0.03, 0.62, 0.6, 0.98], gain: 1.0, depth: 0.006, bezel: 0.01 }, [bx, 1.2, FACE + 0.016]);
    glowStrip(p, 0.26, [bx, 1.62, FACE + 0.03], [PI / 4, 0, 0], { i: 0.32, dir: [0, -0.3, 1], reach: 1.6, pool: 0.6, poolAt: [bx, 0.9, FACE + 0.55] });
  }
  return p;
}
