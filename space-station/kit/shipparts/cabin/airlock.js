// THE AIRLOCK, in the bevel helper's language (kit/bevel.js), plainly, a first pass from the plan and the concept sheet's
// airlock (refs/ships/explorer_concept2_chatgpt_2026-11-03.png: suits hanging by the door, lit lockers, a panel by the
// door, the way out edged in light): suit lockers, each a tall door with an 8-sided window and a suit inside (a helmet
// with its visor, the shoulders and arms), lit from above; the pressure panel by the hull's door (a screen of the air's
// bars, a big CYCLE button and a stop button, hazard hatching under it); a fold-down bench with a navy cushion.
// Frames (kit/shipparts/cabin/ship.js): a WALL fitting stands on a wall line, x along the wall, centred; z = 0 on the line,
// its back at the wall's face (FACE), facing +z; y = 0 the deck.
//   suitLockers(p, o)   o.len (1: a unit each half metre), o.depth (0.25), o.h (2), o.poster (a POSTERS index: a single
//                       unit carries it on its door instead of a window), o.handle, o.trim
//   pressurePanel(p, o) o.w (0.34), o.h (0.5), o.y (1.25, its middle)
//   wallBench(p, o)     o.len (0.45), o.depth (0.34), o.seat (0.45), o.leather (the cushion's colour), o.trim
import { shape, solid, loft, plate, relief, prism, octagon, add } from '../../bevel.js';
import { FACE } from './ship.js';
import { POSTERS } from './print.js';
import { FLAT, printed, glowStrip, screen, hazard, leatherOf, decalQuad } from './bits.js';
import { PANEL } from './bunks.js';

const PI = Math.PI, K = 2 - Math.SQRT2;
const SUIT = { c: '#d6d4cc', r: 0.62, m: 0.0, w: 0.35 }, SUIT2 = { c: '#8d9096', r: 0.5, m: 0.2, w: 0.3 }, VISOR = { c: '#14202c', r: 0.08, m: 0.6, w: 0.05 };

// ── the suit lockers ────────────────────────────────────────────────────────────────────────────────────────────
export function suitLockers(p, o = {}) {
  const len = o.len ?? 1, depth = o.depth ?? 0.25, h = o.h ?? 2, d = depth - 0.01 - FACE, fz = FACE + d, n = Math.max(1, Math.round(len / 0.5)), uw = len / n;
  const posterOn = o.poster != null && n === 1;
  // (each unit's window: an 8-sided hole through its door into the hollow behind; its frame stepping down into it)
  const win = (x) => shape(uw - 0.16, Math.min(0.72, h - 1.2), 0.08, x, h - 0.2 - Math.min(0.72, h - 1.2) / 2), fm = 0.05;
  const frame = (x) => { const s = win(x); return { ...s, w: s.w + 2 * fm, h: s.h + 2 * fm, c: s.c.map((v) => v + fm * K) }; };
  const xs = Array.from({ length: n }, (_, i) => -len / 2 + uw * (i + 0.5)), L2 = (len - 0.008) / 2;
  add(p, 'white', prism([[-L2, 0], [L2, 0], [L2, h - 0.03], [L2 - 0.03, h], [-L2 + 0.03, h], [-L2, h - 0.03]], FACE, fz, { holes: posterOn ? [] : xs.map((x) => octagon(frame(x))), back: false }));
  add(p, 'dark', solid(shape(len - 0.02, 0.07, 0, 0, 0.035), 0.006, { edge: 0.002, back: false }), [0, 0, fz]);
  xs.forEach((x, i) => {
    // the door below the window: a raised border-bevel panel, its handle slot, SUITS stencilled on it
    const py1 = posterOn ? h - 0.06 : frame(x).y - frame(x).h / 2 - 0.03;
    add(p, 'white2', relief(shape(uw - 0.05, py1 - 0.1, 0.04, x, (0.1 + py1) / 2), PANEL), [0, 0, fz]);
    add(p, o.handle || 'black', solid(shape(0.03, 0.18, 0.01, x + (i % 2 ? -1 : 1) * (uw / 2 - 0.07), 1.0), 0.006, { edge: 0.002, back: false }), [0, 0, fz + 0.0035]);
    add(p, 'amber', plate(shape(0.008, 0.05, 0.003, x + (i % 2 ? -1 : 1) * (uw / 2 - 0.07), 1.04)), [0, 0, fz + 0.0098], null, 'glow');
    printed(p, 'label:suits', 0.13, 0.065, [x - (i % 2 ? -1 : 1) * 0.04, posterOn ? 0.5 : py1 - 0.12, fz + 0.004], null, '#2c2e32');
    if (posterOn) {
      const P = POSTERS[o.poster], s = Math.min((uw - 0.17) / P.w, 0.5 / P.h), pw = P.w * s, ph = P.h * s, py = 1.45, px = -0.02;
      add(p, 'white2', solid(shape(pw + 0.03, ph + 0.03, 0.016, x + px, py), 0.005, { edge: 0.0015, back: false, front: [{ inset: 0.008, depth: -0.0015, bevel: 0.0015 }] }), [0, 0, fz + 0.0035]);
      add(p, '#33363b', decalQuad(pw, ph, 'cabin:poster:' + o.poster), [x + px, py, fz + 0.0073], null, 'decal');
      return;
    }
    // the window: its frame, the hollow behind, the glass, the suit inside, a light over it
    add(p, o.trim || 'black', relief(frame(x), [{ inset: 0, depth: 0.012, bevel: 0.01 }, { inset: 0.016, depth: 0.004, bevel: 0.006 }, { inset: 0.012, depth: -0.006, bevel: 0.006 }], { hole: true, jamb: -0.025 }), [0, 0, fz]);
    const w = win(x), hollow = shape(uw - 0.04, h - 0.18, 0.04, x, (h - 0.18) / 2 + 0.06);
    add(p, 'grey2', relief(hollow, [{ inset: 0, depth: -(d - 0.03), bevel: 0 }]), [0, 0, fz - 0.025]);
    add(p, null, plate(shape(w.w, w.h, w.c)), [x, w.y, fz - 0.012], null, 'glass');
    suit(p, x, w.y, FACE + 0.07);
    glowStrip(p, uw - 0.12, [x, h - 0.135, FACE + 0.06], [PI / 2, 0, 0], { i: 0.1, dir: [0, -0.2, 1], reach: 0.9, pool: 0.25, poolAt: [x, w.y, fz + 0.4] });
  });
  return p;
}
// a suit on its hook: the helmet (a faceted dome, its visor dark), the shoulders and chest, the arms hanging; its middle at
// (x, y), in the plane z
function suit(p, x, y, z) {
  const S = (a, b, zz) => ({ s: shape(a, b, Math.min(a, b) * 0.32, x, y + 0.22), z: zz });
  add(p, SUIT, loft([S(0.15, 0.14, 0), S(0.22, 0.24, 0.04), S(0.22, 0.24, 0.1), S(0.15, 0.14, 0.14)]), [0, 0, z - 0.02]);
  add(p, VISOR, plate(shape(0.15, 0.11, 0.035, x, y + 0.2)), [0, 0, z + 0.121]);
  add(p, 'black', solid(shape(0.12, 0.03, 0.01, x, y + 0.09), 0.1, { edge: 0.006 }), [0, 0, z]);
  add(p, SUIT, solid(shape(0.3, 0.42, [0.07, 0.07, 0.1, 0.1], x, y - 0.14), 0.12, { edge: 0.02, front: [{ inset: 0.07, depth: 0.006, bevel: 0.008 }] }), [0, 0, z - 0.03]);
  add(p, SUIT2, solid(shape(0.12, 0.08, 0.02, x, y - 0.05), 0.012, { edge: 0.004, back: false }), [0, 0, z + 0.096]);
  add(p, 'blue', plate(shape(0.06, 0.012, 0.004, x, y - 0.05)), [0, 0, z + 0.1085], null, 'glow');
  for (const s of [-1, 1]) add(p, SUIT, solid(shape(0.075, 0.42, 0.03, x + s * 0.19, y - 0.17), 0.09, { edge: 0.02 }), [0, 0, z - 0.015]);
}

// ── the pressure panel ──────────────────────────────────────────────────────────────────────────────────────────
export function pressurePanel(p, o = {}) {
  const w = o.w ?? 0.34, h = o.h ?? 0.5, y = o.y ?? 1.25;
  add(p, 'black', solid(shape(w, h, 0.05, 0, y), 0.03, { edge: 0.006, back: false, front: [{ inset: 0.012, depth: -0.004, bevel: 0.004 }] }), [0, 0, FACE]);
  screen(p, { w: w - 0.08, h: h * 0.36, rect: 'status', sub: [0.02, 0.05, 0.98, 0.85], gain: 1.3, depth: 0.012, bezel: 0.014 }, [0, y + h * 0.2, FACE + 0.026]);
  // the big CYCLE button (green), the stop (red), each in a chamfered bezel
  for (const [bx, c, s] of [[-w * 0.2, 'green', 0.09], [w * 0.25, 'red', 0.06]]) {
    add(p, 'dark', relief(shape(s + 0.03, s + 0.03, (s + 0.03) * 0.3, bx, y - h * 0.17), [{ inset: 0, depth: 0.008, bevel: 0.006 }]), [0, 0, FACE + 0.026]);
    add(p, c, plate(shape(s, s, s * 0.3, bx, y - h * 0.17)), [0, 0, FACE + 0.035], null, 'glow');
  }
  hazard(p, w - 0.04, 0.04, [0, y - h / 2 - 0.035, FACE + 0.002]);
  return p;
}

// ── a fold-down bench ───────────────────────────────────────────────────────────────────────────────────────────
export function wallBench(p, o = {}) {
  const len = o.len ?? 0.45, depth = o.depth ?? 0.34, seat = o.seat ?? 0.45, trim = o.trim || 'black';
  // the brackets (each a triangle of steel under the seat), the seat, its cushion, a back pad on the wall
  for (const s of [-1, 1]) add(p, trim, prism([[FACE, seat - 0.05], [depth - 0.04, seat - 0.05], [FACE, seat - 0.3]], -0.012, 0.012), [s * (len / 2 - 0.05), 0, 0], [0, -PI / 2, 0]);
  add(p, 'white', solid(shape(len, depth - FACE, 0.02, 0, -(FACE + (depth - FACE) / 2)), 0.04, { edge: 0.008 }), [0, seat - 0.09, 0], FLAT);
  add(p, leatherOf(o.leather), solid(shape(len - 0.03, depth - FACE - 0.04, 0.04, 0, -(FACE + 0.02 + (depth - FACE - 0.04) / 2)), 0.05, { edge: 0.02, back: false }), [0, seat - 0.05, 0], FLAT);
  add(p, leatherOf(o.leather), solid(shape(len - 0.04, 0.3, 0.05, 0, seat + 0.27), 0.05, { edge: 0.02, back: false }), [0, 0, FACE]);
  return p;
}
