// ENGINEERING, in the bevel helper's language (kit/bevel.js), from the plan and the concept sheet's engineering
// (refs/ships/explorer_concept2_chatgpt_2026-11-03.png: a big drum with heavy rings, copper pipes that bend, a console
// with screens, gear on shelves). The room's pieces are in several files, and this one hands them all on:
//   reactor.js   reactorCore: the reactor standing in its corner, its glowing core seen between the ribs of its cage
//   drive.js     drivePumps: the drive, a ribbed drum lying along the hull, a blue glow at its end, pumps at its foot
//   engpipes.js  the pipes along the walls and overhead, the floor grating, the tube rails
//   round.js     the round shapes they are made of (spun profiles, tubes through points, flanges, valves, clamps)
//   here         the engineering station and the gear shelves; the tool lockers are the ship's shallow built-in
//                (lockers.js shallowLocker), labelled TOOLS
// Frames (kit/shipparts/cabin/ship.js): a WALL fitting stands on a wall line, x along the wall, centred; z = 0 on the line,
// its back at the wall's face (FACE), facing +z; y = 0 the deck.
//   engStation(p, o)   o.len (1), o.depth (0.5), o.h (1.2: its desk's back; the screens rise over it), o.handle, o.trim.
//                      Its plan corners are cut at 45 degrees and its top slopes.
//   gearShelves(p, o)  o.len (1), o.depth (0.5; 0.32 against a hull wall: shallow, as if it went on into the wall),
//                      o.h (1.8), o.trim. Its side boards are cut at the top and the front foot; a strip under the top.
import { shape, solid, plate, relief, prism, add } from '../../bevel.js';
import { FACE } from './ship.js';
import { FLAT, glowStrip, screen, hazard, localAt } from './bits.js';
import { PANEL } from './bunks.js';
import { slab } from './round.js';

const PI = Math.PI;

// ── the reactor: its own file ──────────────────────────────────────────────────────────────────────────────────
export { reactorCore, CORE_LIGHT, CORE_TAG } from './reactor.js';

// ── the drive and its pumps: their own file ─────────────────────────────────────────────────────────────────────
export { drivePumps, driveDims, DRIVE_LIGHT, DRIVE_TAG } from './drive.js';

// ── the engineering station ─────────────────────────────────────────────────────────────────────────────────────
export function engStation(p, o = {}) {
  const len = o.len ?? 1, depth = o.depth ?? 0.5, h = o.h ?? 1.2, desk = 0.84, d = depth - 0.03 - FACE, fz = FACE + d, c = +Math.min(0.07, len * 0.1).toFixed(3), xL = -len / 2 + 0.005, xR = len / 2 - 0.005;
  // its plan, going round from the back on the wall: both front corners cut at 45 degrees (z its front, e how far it
  // stands past the body's sides)
  const plan = (z, e = 0) => [[xL - e, FACE], [xR + e, FACE], [xR + e, z - c], [xR + e - c, z], [xL - e + c, z], [xL - e, z - c]];
  add(p, 'dark', prism(plan(fz - 0.035).map(([x, z]) => [x, -z]), 0, 0.1, { front: false, back: false }), [0, 0, 0], FLAT);
  add(p, 'white', prism(plan(fz).map(([x, z]) => [x, -z]), 0.1, desk, { back: false }), [0, 0, 0], FLAT);
  const n = Math.max(1, Math.round(len / 0.5)), dw = (xR - xL - 2 * c) / n;
  for (let i = 0; i < n; i++) {
    const x = xL + c + dw * (i + 0.5);
    add(p, 'white2', relief(shape(dw - 0.03, desk - 0.18, 0.035, x, (desk + 0.1) / 2), PANEL), [0, 0, fz]);
    add(p, o.handle || 'black', plate(shape(Math.min(0.2, dw * 0.5), 0.022, 0.009, x, desk - 0.12)), [0, 0, fz + 0.0075]);
  }
  // the control top, sloping up toward the wall, over the same plan (its corners cut too): a charcoal slab, a screen and
  // rows of lit buttons in it
  const z0 = depth - 0.01, z1 = FACE + 0.14, y0 = desk, y1 = desk + 0.13;
  add(p, o.trim || 'black', slab(plan(z0, 0.005).map(([x, z]) => [x, Math.max(z, z1)]), y0, (x, z) => y0 + 0.03 + (z0 - z) / (z0 - z1) * (y1 - y0 - 0.03)));
  const tilt = Math.atan2(y1 - y0 - 0.03, z0 - z1), mid = [0, (y0 + 0.03 + y1) / 2 + 0.003, (z0 + z1) / 2];
  screen(p, { w: 0.34, h: 0.17, live: 'log', seed: 0.21, gain: 1.3, depth: 0.008, bezel: 0.012 }, [-len * 0.18, mid[1], mid[2]], [-PI / 2 + tilt, 0, 0]);
  const BT = ['green', 'amber', 'blue', 'amber', 'green', 'blue'];
  for (let k = 0; k < 6; k++) { const bx = len * 0.12 + (k % 3) * 0.07, bz = (k < 3 ? -0.04 : 0.03); add(p, BT[k], plate(shape(0.04, 0.026, 0.008)), localAt([0, mid[1] + 0.004, mid[2]], [-PI / 2 + tilt, 0, 0], [bx, bz, 0.002]), [-PI / 2 + tilt, 0, 0], 'glow'); }
  // the two screens over it, in bezels, a light strip under them lighting the desk
  const sy = desk + 0.13 + 0.26;
  screen(p, { w: len * 0.4, h: 0.26, live: 'systems', seed: 0.62, gain: 1.3, light: 0.14 }, [-len * 0.22, sy, FACE]);
  screen(p, { w: len * 0.4, h: 0.26, live: 'drive', seed: 0.44, gain: 1.3, light: 0.14 }, [len * 0.22, sy, FACE]);
  glowStrip(p, len * 0.86, [0, sy - 0.16, FACE + 0.02], [PI / 3, 0, 0], { i: 0.2, dir: [0, -0.2, 1], reach: 1.2, pool: 0.4, poolAt: [0, desk + 0.3, depth + 0.25] });
  // its name on the control top's front lip (the station's ENG-1 stencil)
  p.decal('label:ENG-1', 0.1, 0.025, [0, y0 + 0.015, z0 + 0.0015], null, '#c9c7bf');
  return p;
}

// ── the gear shelves ────────────────────────────────────────────────────────────────────────────────────────────
export function gearShelves(p, o = {}) {
  const len = o.len ?? 1, depth = o.depth ?? 0.5, h = o.h ?? 1.8, d = depth - 0.02 - FACE, zc = FACE + d / 2, trim = o.trim || 'black';
  // (a board's corners, from its own bottom-left round: its front is its left on the +x side, its right on the other)
  const cut = +Math.min(0.12, d * 0.42).toFixed(3);
  for (const s of [-1, 1]) add(p, 'white', solid(shape(d, h, s > 0 ? [0.04, 0, 0.02, cut] : [0, 0.04, cut, 0.02], -s * zc, h / 2), 0.03, { edge: 0.006 }), [s * (len / 2 - 0.03), 0, 0], [0, s * PI / 2, 0]);
  add(p, 'dark', plate(shape(len - 0.1, h - 0.14, 0, 0, h / 2 + 0.03)), [0, 0, FACE + 0.004]);
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
  // the light under the top shelf: a small rail along its front, its underside cut at 45 degrees, the strip on the cut
  const zf = FACE + d - 0.014, yt = ys[ys.length - 1] - 0.025;
  add(p, trim, prism([[zf - 0.04, yt], [zf, yt], [zf, yt - 0.012], [zf - 0.024, yt - 0.036], [zf - 0.04, yt - 0.036]], -len / 2 + 0.06, len / 2 - 0.06), [0, 0, 0], [0, -PI / 2, 0]);
  glowStrip(p, len - 0.18, [0, yt - 0.0255, zf - 0.0105], [PI / 4, 0, 0], { i: 0.14, dir: [0, -0.5, 0.85], reach: 1.2, pool: 0.25, poolAt: [0, 1.1, depth + 0.25] });
  return p;
}
