// THE REACTOR of a ship's engineering room: a round machine standing on an eight-sided plinth, in the reference's manner
// (refs/ships/explorer_concept2_chatgpt_2026-11-03.png, its engineering: ribbed rings, stepped housings, bolted flanges,
// pipes that bend): a lower housing (a band, a recess with a lit seam, a bolted flange), THE CORE in a cage of six slim
// ribs and two hoops, an upper housing with three cooling fins and a capped neck, a nameplate box on its front, a small
// junction box at its foot with a conduit into the flange, and its pipes: one up from the cap, bending over to the wall
// across (meeting the pipes along that wall, a valve on the way), one straight into that wall, a thin yellow line out of
// the lower housing that climbs the wall with a valve.
//
// THE CORE IS ITS OWN PIECE. It is drawn with the kit material 'core' (kit/materials.js), not 'glow', so in a built cabin
// it is its own mesh: cabin.group.getObjectByName('core') (material mats.core), one draw. It MOVES: the column and its
// material are kit/shipparts/cabin/livecore.js (coreColumn, coreMaterial), driven by the shared clock; o.core picks its
// look (CORE_LOOK, the flow and bolts, unless told otherwise), and corePulse(t, look) is its brightness for the pool.
// THE LIGHT IT THROWS is one number, CORE_LIGHT: it scales the core's baked light and its real-time pool. The pool is
// tagged (cabin.parts.pools' entry with tag CORE_TAG), so the game can find it and pulse it.
//
// A wall fitting (kit/shipparts/cabin/ship.js): x along the wall, centred; z = 0 on the wall line, its back at FACE; y = 0
// the deck.
//   reactorCore(p, o)  o.len (1.5), o.depth (1.25), o.h (1.8), o.back (+1: the end of it against a wall across, where its
//                      pipes go: +x; -1; 0 none), o.ceiling (2.5: its pipe up goes to it), o.pipeY (the height of pipes
//                      along the wall it backs onto: its pipe up turns there to that wall, meeting them), o.trim
import { shape, solid, loft, plate, prism, add } from '../../bevel.js';
import { FACE } from './ship.js';
import { FLAT, printed, strip, hazard, COPPER, decalQuad } from './bits.js';
import { GUN, STEEL } from './mess.js';
import { spun, tube, aim, bolts, flange, valve } from './round.js';
import { coreColumn, CORE_LOOK } from './livecore.js';

const PI = Math.PI;
export const CORE = [0.55, 1.4, 2.7], CORE_END = [0.08, 0.3, 0.95], SEAM = [0.6, 1.9, 4.2];
export const CORE_LIGHT = 1, CORE_TAG = 'reactor-core';
// an 8-sided section of width a (and b) at z, centred on (x, y) in the loft's own plane
export const O = (a, z, x = 0, y = 0, b = a) => ({ s: shape(a, b, Math.min(a, b) * 0.293, x, y), z });

// where a pipe from overhead lands on it: the top of a boss on its upper housing's shoulder, toward the room, in its
// own frame (kit/ships/cabin-furnish.js runs the pipe from here over to the drive's valve chest)
export function reactorPort(o = {}) {
  const len = o.len ?? 1.5, depth = o.depth ?? 1.25, h = Math.min(o.h ?? 1.8, 1.9), d = Math.min(depth - FACE - 0.2, len - 0.3, 1.0), cy1 = +(h * 0.72).toFixed(3);
  return [0, +(cy1 + (h - cy1) * 0.86).toFixed(4), +(FACE + (depth - FACE) / 2 + 0.37 * d).toFixed(4)];
}

export function reactorCore(p, o = {}) {
  const len = o.len ?? 1.5, depth = o.depth ?? 1.25, h = Math.min(o.h ?? 1.8, 1.9), back = o.back ?? 1, zc = FACE + (depth - FACE) / 2, d = Math.min(depth - FACE - 0.2, len - 0.3, 1.0);
  const C = [0, 0, zc], trim = o.trim || 'black';
  // (a round part: its profile's radii in parts of the machine's width)
  const sp = (look, prof, o2 = {}, mat = 'solid') => add(p, look, spun(prof.map(([r, y, v]) => [r * d, y, v]), { seg: 28, ...o2 }), C, null, mat);
  const cy0 = 0.5, cy1 = +(h * 0.72).toFixed(3), S = h - cy1, U = (t) => +(cy1 + S * t).toFixed(4);
  // the plinth; the lower housing: a band, a recess with its lit seam, a bolted flange, a neck
  add(p, 'dark', loft([O(d * 1.08, 0, 0, -zc), O(d * 1.08, 0.06, 0, -zc), O(d * 0.98, 0.12, 0, -zc)]), [0, 0, 0], FLAT);
  sp(GUN, [[0.47, 0.12], [0.47, 0.3], [0.44, 0.33], [0.44, 0.37], [0.485, 0.39], [0.485, 0.43], [0.41, 0.43], [0.41, cy0 - 0.03], [0.31, cy0]], { caps: [false, true] });
  sp(SEAM, [[0.446, 0.342], [0.446, 0.358]], { caps: [false, false] }, 'glow');
  bolts(p, STEEL, [0, 0.43, zc], [0, 1, 0], d * 0.4475, 16);
  // THE CORE (its own material: see the head of this file)
  // (moving: kit/shipparts/cabin/livecore.js. o.core: its look, a name or number from CORE_LOOKS; o.seed)
  coreColumn(p, { r: 0.25 * d, h: cy1 - cy0, sides: 32, look: o.core ?? CORE_LOOK, seed: o.seed ?? 0.3 }, [0, cy0, zc]);
  // its cage: six slim ribs with a gusset at each foot (none dead ahead: the core shows wide between the two front ones),
  // a hoop near each end
  const y0 = cy0 - 0.03, y1 = U(0.07), rib = [[0.33, y0], [0.41, y0], [0.41, y0 + 0.03], [0.372, y0 + 0.09], [0.372, y1 - 0.09], [0.41, y1 - 0.03], [0.41, y1], [0.33, y1]].map(([r, y]) => [r * d, y]);
  for (let i = 0; i < 6; i++) add(p, trim, prism(rib, -0.016, 0.016), C, [0, -i / 6 * 2 * PI, 0]);
  for (const a of [cy0 + 0.085, cy1 - 0.115]) sp(STEEL, [[0.365, a], [0.418, a], [0.418, a + 0.03], [0.365, a + 0.03], [0.365, a]], { caps: [false, false] });
  // the upper housing: a bolted flange, a recess with its seam, a body with three cooling fins, a shoulder, a capped neck
  sp(GUN, [[0.31, cy1], [0.41, U(0.07)], [0.41, U(0.13)], [0.485, U(0.16)], [0.485, U(0.23)], [0.44, U(0.25)], [0.44, U(0.7)], [0.3, U(0.88)], [0.3, U(0.92)], [0.21, U(0.92)], [0.21, h]]);
  sp(SEAM, [[0.446, U(0.27)], [0.446, U(0.3)]], { caps: [false, false] }, 'glow');
  // (a boss on its shoulder: the port a pipe from overhead lands on, reactorPort)
  add(p, GUN, aim(spun([[0.074, -S * 0.22], [0.074, 0]], { seg: 12 }), reactorPort(o)));
  for (const t of [0.36, 0.47, 0.58]) sp(STEEL, [[0.435, U(t)], [0.478, U(t + 0.012)], [0.478, U(t + 0.048)], [0.435, U(t + 0.06)]], { caps: [false, false] });
  if (d >= 0.8) bolts(p, STEEL, [0, h, zc], [0, 1, 0], d * 0.16, 8, { size: 0.011 });
  // the nameplate box on the lower housing's front: the label and the caution plate
  const pw = Math.min(0.34, d * 0.42), fz = zc + d * 0.47 + 0.022, lw = Math.min(0.26, pw - 0.05), cw = Math.min(0.2, pw - 0.08);
  add(p, 'dark', solid(shape(pw, 0.17, 0.025, 0, 0.21), 0.07, { edge: 0.006, back: false }), [0, 0, fz - 0.07]);
  printed(p, 'label:reactor', lw, lw / 8, [0, 0.245, fz + 0.002]);
  add(p, '#c9a032', decalQuad(cw, cw / 4, 'cp:caution'), [0, 0.17, fz + 0.002], null, 'decal');
  // a junction box at its foot, in the corner of its floor away from its pipes, a conduit from it into the flange
  const sx = back ? -back : 1, bx = sx * (len / 2 - 0.15), bz = depth - 0.15, far = Math.hypot(bx, bz - zc);
  if (far > d * 0.54 + 0.13) {
    const B = (a, y) => ({ s: shape(a, a, a * 0.2, bx, -bz), z: y });
    add(p, GUN, loft([B(0.2, 0), B(0.2, 0.25), B(0.13, 0.31)]), [0, 0, 0], FLAT);
    add(p, 'green', plate(shape(0.05, 0.022, 0.006, bx, 0.19)), [0, 0, bz + 0.102], null, 'glow');
    add(p, 'cable', tube([[bx, 0.29, bz], [bx, 0.41, bz], [bx * d * 0.47 / far, 0.41, zc + (bz - zc) * d * 0.47 / far]], 0.02, { seg: 8, bend: 0.06 }));
  }
  // its pipes. To the wall across (the end it backs onto): copper, straight in from the upper housing; a thin yellow line
  // out of the lower housing, up that wall and into it, a valve on its way up
  const xw = back * (len / 2 - FACE);
  if (back) {
    const yc = U(0.42), zb = zc - d * 0.14, xs = back * Math.sqrt((0.44 * d) ** 2 - (0.14 * d) ** 2);
    add(p, COPPER, tube([[xs - back * 0.02, yc, zb], [xw, yc, zb]], 0.045));
    flange(p, 'black', [xw - back * 0.014, yc, zb], [-back, 0, 0], 0.045, { bolts: 6 });
    const zy = zc + d * 0.16, xy = back * Math.sqrt((0.47 * d) ** 2 - (0.16 * d) ** 2), xr = xw - back * 0.11, yt = +(h * 0.6).toFixed(3);
    if (Math.abs(xr) - Math.abs(xy) > 0.09) {
      add(p, 'yellow', tube([[xy - back * 0.02, 0.22, zy], [xr, 0.22, zy], [xr, yt, zy], [xw, yt, zy]], 0.032, { bend: 0.07 }));
      valve(p, [xr, (0.22 + yt) / 2 + 0.06, zy], [0, 1, 0], 0.032, { stem: [0, 0, 1] });
      flange(p, 'black', [xw - back * 0.012, yt, zy], [-back, 0, 0], 0.032, { w: 0.024 });
      flange(p, 'black', [xy + back * 0.03, 0.22, zy], [back, 0, 0], 0.032, { w: 0.024 });
    }
  }
  // up from the cap: over to the wall across at the height of the pipes along it, meeting the lower one in a sleeve, a
  // valve on the way; or, with no such pipes, straight up into the ceiling
  flange(p, STEEL, [0, h + 0.014, zc], [0, 1, 0], 0.05, { R: 0.085, bolts: 6 });
  if (o.pipeY && back) {
    const xT = xw - back * 0.07;
    add(p, COPPER, tube([[0, h - 0.01, zc], [0, o.pipeY, zc], [xT, o.pipeY, zc]], 0.05, { bend: 0.13 }));
    add(p, GUN, aim(spun([[0.046, -0.08], [0.062, -0.08], [0.062, 0.08], [0.046, 0.08]], { seg: 12, caps: [false, false] }), [xT, o.pipeY, zc], [0, 0, 1]));
    flange(p, GUN, [xT - back * 0.08, o.pipeY, zc], [back, 0, 0], 0.05);
    if (Math.abs(xT) > 0.5) valve(p, [xT * 0.56, o.pipeY, zc], [1, 0, 0], 0.05, { stem: [0, 0, 1] });
  } else {
    const top = (o.ceiling ?? 2.5) - 0.004;
    add(p, COPPER, tube([[0, h - 0.01, zc], [0, top, zc]], 0.055));
    flange(p, 'black', [0, top - 0.014, zc], [0, -1, 0], 0.055, { bolts: 6 });
  }
  // the core's light (CORE_LIGHT of it), and its pool (tagged, so it can be found and pulsed); a hazard band on the floor
  // in front of it
  strip(p, [0, h * 0.5, zc + d * 0.5], 0.5 * CORE_LIGHT, null, 2.4, [0.55, 0.8, 1.0]);
  strip(p, [0, h * 0.5, zc - d * 0.5], 0.2 * CORE_LIGHT, null, 1.6, [0.55, 0.8, 1.0]);
  p.lights.push({ at: [0, h * 0.5, zc + d * 0.6], i: 0, color: [0.5, 0.75, 1.0], dir: null, reach: 2.3, pool: { i: 0.8 * CORE_LIGHT, reach: 2.3, tag: CORE_TAG } });
  hazard(p, Math.min(len - 0.1, d * 1.2), 0.08, [0, 0.003, zc + d * 0.62], [-PI / 2, 0, 0]);
  return p;
}
