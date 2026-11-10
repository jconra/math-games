// THE BUNK ROOM, in the bevel helper's language (kit/bevel.js), from the game's maker's bunk picture
// (refs/ships/explorer_bunks_ref_2026-11-09.png): berths two high set into a pale casing, each behind an 8-sided opening
// with a stepped frame, a mattress with navy bedding and a navy pillow, a light strip along its top and a reading light, an
// 8-sided star screen on its back wall (his picture's porthole: no real windows, 2026-11-09) and a small screen by the
// pillow; its number on the band under it with a little lit tag; a drawer under the lower berth, a light strip along the
// floor, a ladder at the foot end; and tall lockers, numbered, two doors each with vents and a lit handle.
// Frames (kit/shipparts/cabin/ship.js): a WALL fitting stands on a wall line, x along the wall, centred; z = 0 on the line,
// its back at the wall's face (FACE), facing +z; y = 0 the deck.
//   bunkStack(p, o)   o.len (2), o.depth (1), o.h (1.9: two berths; under 1.5 one), o.open [x0, x1] (the stretch of the
//                     front the openings take: where nothing stands in front of it; the berths run the whole length
//                     behind), o.head (+1: the pillows at +x; -1), o.nums [upper, lower] (1 to 8: the print's numbers),
//                     o.bedding (the blankets' and pillows' surface: navy), o.handle (the drawer's handle slot), o.trim
//                     (the frames' inner step and the number tags: black), o.ladder (true: at the foot end of the openings)
//   crewLocker(p, o)  o.w (0.5), o.depth (0.5), o.h (2), o.num (its number), o.poster (a POSTERS index on its upper door),
//                     o.handle, o.trim, o.label (a print label key instead of a number, 'label:tools')
import { shape, solid, loft, plate, relief, prism, octagon, add } from '../../bevel.js';
import { FACE, SHEET } from './ship.js';
import { POSTERS } from './print.js';
import { FLAT, printed, glowStrip, screen, starScreen, pool, strip, decalQuad, localAt } from './bits.js';
import { part, placeInto } from '../place.js';

const PI = Math.PI, K = 2 - Math.SQRT2;
const NAVY = { c: '#22355e', r: 0.85, m: 0, w: 0.25 };
// a border-bevel panel (a door, a drawer): raised, a fine second outline in it
export const PANEL = [{ inset: 0, depth: 0.007, bevel: 0.006 }, { inset: 0.03, depth: 0.0035, bevel: 0.004 }];

// ── the berths, two high ────────────────────────────────────────────────────────────────────────────────────────
export function bunkStack(p, o = {}) {
  const L = o.len ?? 2, D = o.depth ?? 1, H = o.h ?? 1.9, head = o.head ?? 1, bedding = o.bedding || NAVY, trim = o.trim || 'black';
  const [ox0, ox1] = o.open || [-L / 2 + 0.08, L / 2 - 0.08];
  const front = D - 0.02, pz = front - 0.04, back = FACE + 0.006, base = 0.08;
  // (each berth: its hollow from y0 to y1, its opening from oy0 to oy1; lower first)
  const berths = H >= 1.5 ? [{ y0: 0.3, y1: 0.98, num: o.nums?.[1] }, { y0: 1.08, y1: Math.min(1.8, H - 0.1), num: o.nums?.[0] }] : [{ y0: 0.3, y1: Math.min(0.98, H - 0.1), num: o.nums?.[0] }];
  const fm = 0.07, c0 = 0.1;
  const openingOf = (B) => shape(ox1 - ox0, B.y1 - B.y0 - 0.12, c0, (ox0 + ox1) / 2, (B.y0 + B.y1) / 2 + 0.004);
  const frameOf = (B) => { const s = openingOf(B); return { ...s, w: s.w + 2 * fm, h: s.h + 2 * fm, c: s.c.map((v) => v + fm * K) }; };
  // the front: a pale panel with the frames' outlines cut from it; the frames, stepping down into each opening; the
  // ends and the top
  add(p, 'white', prism([[-L / 2, base], [L / 2, base], [L / 2, H], [-L / 2, H]], pz, front, { holes: berths.map((B) => octagon(frameOf(B))), back: false }));
  for (const B of berths) {
    add(p, 'white2', relief(frameOf(B), [{ inset: 0, depth: 0.016, bevel: 0.014 }, { inset: 0.02, depth: 0.006, bevel: 0.008 }, { inset: 0.016, depth: -0.008, bevel: 0.012 }], { hole: true, jamb: -(front - pz) }), [0, 0, front]);
  }
  const endW = pz - FACE;
  // (each end turned a quarter so its face looks out along x: its own x runs along the fitting's z)
  for (const s of [-1, 1]) add(p, 'white', solid(shape(endW, H, [0, 0, 0.02, 0.02], -s * (FACE + endW / 2), H / 2), 0.03, { edge: 0.006, front: [{ inset: 0.05, depth: -0.004, bevel: 0.005 }] }), [s * (L / 2 - 0.03), 0, 0], [0, s * PI / 2, 0]);
  add(p, 'white', plate(shape(L, pz - FACE, 0, 0, -(FACE + (pz - FACE) / 2))), [0, H, 0], FLAT);
  // the toe: dark, set back, a light strip under the front's foot lighting the floor
  add(p, 'dark', solid(shape(L - 0.01, base, 0, 0, base / 2), front - 0.07 - FACE, { edge: 0.004, back: false }), [0, 0, FACE]);
  glowStrip(p, (ox1 - ox0) + 0.1, [(ox0 + ox1) / 2, base - 0.002, front - 0.012], [PI / 2, 0, 0], { i: 0.3, dir: [0, 0.5, 0.85], reach: 1.4, pool: 0.24, poolAt: [(ox0 + ox1) / 2, 0.05, front + 0.25] });
  // (and a lit line in the floor along the foot, as his picture's)
  add(p, 'white', plate(shape(ox1 - ox0 + 0.08, 0.022, 0.008, (ox0 + ox1) / 2, -(front + 0.03))), [0, 0.0025, 0], FLAT, 'glow');
  // the drawer under the lower berth (a raised border-bevel front, a handle slot), short of the head end, where the lower
  // berth's number goes
  const fb = openingOf(berths[0]).y - openingOf(berths[0]).h / 2 - fm, dy = (base + fb) / 2, dh = fb - base - 0.026, dx0 = head > 0 ? ox0 + 0.02 : ox0 + 0.3, dx1 = head > 0 ? ox1 - 0.3 : ox1 - 0.02;
  add(p, 'white2', relief(shape(dx1 - dx0, dh, 0.03, (dx0 + dx1) / 2, dy), PANEL), [0, 0, front]);
  add(p, o.handle || 'black', plate(shape(0.24, 0.022, 0.009, (dx0 + dx1) / 2, dy + dh * 0.2)), [0, 0, front + 0.0075]);
  for (const B of berths) berth(p, B);
  // the ladder at the foot end of the openings: two rails, rungs with a lit edge
  if (o.ladder !== false && berths.length > 1) {
    const lx = head > 0 ? ox0 + 0.2 : ox1 - 0.2, z = front + 0.055, S = (a, zz) => ({ s: shape(a, a, a * 0.29), z: zz });
    for (const s of [-1, 1]) add(p, trim, loft([S(0.032, 0), S(0.032, H - 0.02)], { start: false }), [lx + s * 0.16, 0, z], FLAT);
    for (const y of [0.38, 0.76, 1.14, 1.52]) {
      add(p, trim, solid(shape(0.31, 0.075, 0.016, lx, -z), 0.045, { edge: 0.008 }), [0, y - 0.045, 0], FLAT);
      add(p, 'white', plate(shape(0.24, 0.009, 0.003)), [lx, y - 0.02, z + 0.0378], null, 'glow');
    }
  }
  return p;

  function berth(p, B) {
    const cw = L - 0.08, ch = B.y1 - B.y0, zc = (back + pz) / 2, cd = pz - back, op = openingOf(B);
    // the hollow: its walls from the front panel's back to the wall, its back field (the walls face in)
    add(p, 'white2', relief(shape(cw, ch, 0.05, 0, (B.y0 + B.y1) / 2), [{ inset: 0, depth: -cd, bevel: 0 }]), [0, 0, pz]);
    // the mattress (pale), the blanket from the foot end with its folded edge, the pillow at the head
    const mw = cw - 0.03, md = cd - 0.05, mt = 0.1, top = B.y0 + mt;
    add(p, SHEET, solid(shape(mw, md, 0.03, 0, -zc), mt, { edge: 0.025 }), [0, B.y0, 0], FLAT);
    const bl = mw * 0.62, bx = -head * (mw / 2 - bl / 2);
    // (soft: its edges well rounded, a stitched line sunk round its top)
    add(p, bedding, solid(shape(bl + 0.01, md + 0.02, 0.05, bx, -zc), 0.045, { edge: 0.022, back: false, front: [{ inset: 0.035, depth: -0.005, bevel: 0.006 }, { inset: 0.004, depth: 0, bevel: 0.006 }] }), [0, top - 0.014, 0], FLAT);
    add(p, bedding, solid(shape(0.1, md + 0.03, 0.04, bx + head * (bl / 2 - 0.02), -zc), 0.055, { edge: 0.024, back: false }), [0, top - 0.01, 0], FLAT);
    add(p, bedding, solid(shape(0.26, md * 0.74, 0.07, head * (mw / 2 - 0.17), -zc), 0.12, { edge: 0.05, back: false }), [0, top - 0.01, 0], FLAT);
    // the light strip along the top of the opening, inside; the reading light over the pillow
    glowStrip(p, op.w * 0.82, [op.x, B.y1 - 0.002, pz - 0.035], [PI / 2, 0, 0], { i: 0.16, dir: [0, -0.4, 0.92], reach: 1.1 });
    add(p, 'white', plate(shape(0.07, 0.07, 0.02)), [head * (cw / 2 - 0.22), B.y1 - 0.002, zc], [PI / 2, 0, 0], 'glow');
    strip(p, [head * (cw / 2 - 0.22), B.y1 - 0.08, zc], 0.14, [0, -1, 0], 0.9);
    pool(p, [op.x * 0.6, (B.y0 + B.y1) / 2 + 0.05, zc + 0.15], 0.3, 1.3);
    // on its back wall: the 8-sided star screen, and the small screen by the pillow
    const sh = Math.min(0.32, ch - 0.26), sw = Math.min(0.66, op.w * 0.5);
    placeInto(p, part(starScreen, { w: +sw.toFixed(3), h: +sh.toFixed(3), seed: 3 }), { at: [-head * 0.05, top + 0.06 + sh / 2 + 0.05, back], rot: [0, 0, 0] });
    screen(p, { w: 0.13, h: 0.08, rect: 'status', sub: [0.03, 0.08, 0.6, 0.62], gain: 1.1, depth: 0.012, bezel: 0.016 }, [head * (cw / 2 - 0.2), top + 0.26, back]);
    // its number on the band under its opening, by the end away from the ladder: the print, a small dark tag with a light
    if (B.num) {
      const nx = head > 0 ? op.x + op.w / 2 - 0.12 : op.x - op.w / 2 + 0.12, ny = op.y - op.h / 2 - fm - 0.042;
      printed(p, 'num:' + B.num, 0.064, 0.064, [nx - head * 0.11, ny, front + 0.0015], null, '#3a3d42');
      add(p, trim, solid(shape(0.11, 0.04, 0.012, nx + head * 0.02, ny), 0.008, { edge: 0.003, back: false }), [0, 0, front]);
      add(p, 'blue', plate(shape(0.05, 0.008, 0.003)), [nx + head * 0.02, ny, front + 0.0085], null, 'glow');
    }
  }
}

// ── a crew locker: two doors, vents, a lit handle, its number ─────────────────────────────────────────────────────
export function crewLocker(p, o = {}) {
  const w = o.w ?? 0.5, depth = o.depth ?? 0.5, h = o.h ?? 2.0, d = depth - 0.01 - FACE, fz = FACE + d;
  add(p, 'white', solid(shape(w - 0.008, h - 0.004, [0, 0.02], 0, h / 2), d, { edge: 0.008, back: false }), [0, 0, FACE]);
  add(p, 'dark', solid(shape(w - 0.02, 0.07, 0, 0, 0.035), 0.006, { edge: 0.002, back: false }), [0, 0, fz]);
  const split = Math.min(h - 0.5, Math.max(0.9, h * 0.5)), doors = [[0.09, split - 0.01], [split + 0.01, h - 0.05]];
  for (const [y0, y1] of doors) {
    add(p, 'white2', relief(shape(w - 0.045, y1 - y0, 0.04, 0, (y0 + y1) / 2), [{ inset: 0, depth: 0.007, bevel: 0.006 }, { inset: 0.03, depth: 0.0035, bevel: 0.004 }]), [0, 0, fz]);
    // vents: three dark slots in a sunk chamfered surround near the door's top
    const vy = y1 - 0.11;
    add(p, 'white2', relief(shape(0.17, 0.085, 0.02, -0.02, vy), [{ inset: 0, depth: -0.004, bevel: 0.004 }]), [0, 0, fz + 0.0035]);
    for (let k = 0; k < 3; k++) add(p, 'dark', plate(shape(0.13, 0.011, 0.004, -0.02, vy - 0.022 + k * 0.022)), [0, 0, fz - 0.0003]);
    // the handle: a dark slot up the free edge, a small light in it
    const hx = w / 2 - 0.075, hy = y0 < 0.5 ? y1 - 0.2 : y0 + 0.24;
    add(p, o.handle || 'black', solid(shape(0.032, 0.17, 0.01, hx, hy), 0.006, { edge: 0.002, back: false }), [0, 0, fz + 0.0035]);
    add(p, 'blue', plate(shape(0.008, 0.05, 0.003, hx, hy + 0.035)), [0, 0, fz + 0.0098], null, 'glow');
  }
  // its number at the upper door's top left (or its label)
  const [uy0, uy1] = doors[1];
  if (o.num) printed(p, 'num:' + o.num, 0.075, 0.075, [-w / 2 + 0.085, uy1 - 0.08, fz + 0.004], null, '#3a3d42');
  if (o.label) printed(p, o.label, 0.2, 0.05, [-0.02, uy1 - 0.21, fz + 0.004], null, '#3a3d42');
  // a poster on the upper door's field, framed
  if (o.poster != null) {
    // (clear of the handle up the door's free edge)
    const P = POSTERS[o.poster], s = Math.min((w - 0.2) / P.w, (uy1 - uy0 - 0.34) / P.h), pw = P.w * s + 0.03, ph = P.h * s + 0.03, px = -0.035, py = uy0 + (uy1 - uy0) * 0.42, z = fz + 0.0035;
    add(p, 'white2', solid(shape(pw, ph, 0.016, px, py), 0.005, { edge: 0.0015, back: false, front: [{ inset: 0.008, depth: -0.0015, bevel: 0.0015 }] }), [0, 0, z]);
    add(p, '#33363b', decalQuad(P.w * s, P.h * s, 'cabin:poster:' + o.poster), [px, py, z + 0.0038], null, 'decal');
  }
  return p;
}
