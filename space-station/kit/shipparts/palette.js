// THE SHIP PALETTE: the outsides of the ships, from the game's maker's pictures. Surfaces in piece.js's form
// ({ c: colour (sRGB), r: roughness, m: metalness, w: wear }), so they ride in the one painted material like the
// station's own (kit/materials.js SURF); glows as linear colours well over 1, for the bloom.
//   hull     the off-white panels (a little warmer than the station's: his ships are cream-white, scuffed)
//   hull2    a second, greyer off-white for panels beside it
//   trim     the dark charcoal grey round the edges, the creases, the frames and the engines
//   grey     a mid grey (bellies, mechanisms)
//   yellow   the safety yellow of his stripes, fins and clamps
//   red      the medic's red stripe (a stripe only: no cross, which is a protected symbol)
//   teal     the medical mark's colour (sheet 2's pulse line)
//   canister the miner's ore canisters (a dusty tan) and canBand, their orange bands
//   inner    the hull's inside face, where no cabin wall covers it (the station's own off-white)
//   frame    window and canopy frames
// Glows (GLOW_SHIP): engine (the blue-white ring and nozzle), engineDim (a parked engine's low glow), strip (the blue
// light strips along his hulls), jet (a thruster's plume), warm (the yellow-white floodlights), cutter (the laser
// heads' orange).
import { SURF } from '../materials.js';

const s = (c, r, m, w) => ({ c, r, m, w });
export const SHIP = {
  hull: s('#cdc8b9', 0.55, 0.04, 0.55),
  hull2: s('#bdbab0', 0.56, 0.05, 0.8),
  trim: s('#34373c', 0.45, 0.25, 0.7),
  grey: s('#6f7379', 0.5, 0.25, 0.6),
  yellow: s('#e6b81f', 0.45, 0.02, 0.4),
  red: s('#b3352b', 0.42, 0.03, 0.4),
  teal: s('#1f9c86', 0.42, 0.03, 0.3),
  canister: s('#a8a088', 0.45, 0.35, 0.9),
  canBand: s('#d8951c', 0.45, 0.05, 0.6),
  inner: s(SURF.white[0], SURF.white[1], SURF.white[2], 0.35),   // (less grime than the station's own walls)
  frame: s('#2c2f34', 0.35, 0.5, 0.4),
  gun: s(SURF.gun[0], SURF.gun[1], SURF.gun[2], SURF.gun[3]),
  chrome: s(SURF.chrome[0], SURF.chrome[1], SURF.chrome[2], SURF.chrome[3]),
};
export const GLOW_SHIP = {
  engine: [0.3, 2.7, 6.0], engineDim: [0.05, 0.3, 1.0], strip: [0.3, 2.4, 5.6], jet: [0.1, 0.7, 2.6], halo: [0.08, 0.8, 2.4], hot: [3.2, 5.0, 7.0],
  warm: [3.6, 2.2, 0.6], cutter: [6.0, 2.2, 0.4],
};
// the paint names a hull piece's variant may carry (kit/shipparts/outside/hull.js), and the surface each stands for
export const PAINTS = { white: SHIP.hull, white2: SHIP.hull2, grey: SHIP.grey, dark: SHIP.trim, yellow: SHIP.yellow, red: SHIP.red, teal: SHIP.teal };
export const STRIPES = { ystripe: SHIP.yellow, rstripe: SHIP.red, tstripe: SHIP.teal, dstripe: SHIP.trim };
export const SLASHES = { yslash: SHIP.yellow, rslash: SHIP.red };
