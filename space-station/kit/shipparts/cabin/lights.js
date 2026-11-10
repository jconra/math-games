// LIGHT FITTINGS: the things a cabin's light comes from, so that no light is without a source you can see (the game's
// maker, 2026-11-09: "Right now it just looks like light just magically appears. If it could be concentrated by strip
// lights that would be good. Or if there are point/spotlights Id hope there is a physical glowing disc nearby").
//   downlight(p, o)                 a glowing disc in a rim, set in a ceiling (or under a locker), shining straight down:
//                                   o.at (where on the surface, [0, 0, 0]), o.r (the disc's radius, 0.09), o.i (its light
//                                   in the bake, 0.5), o.reach (3), o.pool (its pool for a cabin's real-time lights,
//                                   0.5), o.color, o.drop (how far down its beam goes: 2.3, to the deck), o.spread
//                                   (the beam's half angle in radians, 0.16), o.beam (its strength, 1; 0: none), o.look
//                                   Its light carries `beam`: kit/beams.js draws a cone with dust from each of those.
//   stripLight(p, len, at, rot, o)  a glowing strip in a small dark channel (at, rot and o as bits.js's glowStrip: the
//                                   strip faces +z of `rot`, x along it): for where a strip has nothing to sit in
//   washLight(p, o)                 a wall fitting: a housing along a wall, its underside cut at 45 degrees, a strip on
//                                   the cut washing the wall and what hangs under it: o.len, o.y, o.i, o.pool
//   pictureLight (mess.js)          a poster's own light, under a small hood
import { shape, solid, prism, add } from '../../bevel.js';
import { FACE } from './ship.js';
import { glowStrip, localAt } from './bits.js';
import { GUN, LIGHT } from './mess.js';
import { spun, aim } from './round.js';

const PI = Math.PI;

export function downlight(p, o = {}) {
  const R = o.r ?? 0.09, at = o.at || [0, 0, 0], col = o.color || LIGHT, drop = o.drop ?? 2.3;
  // the rim: a ring under the surface, cut at 45 degrees inside and out; the disc a little up inside it
  add(p, o.look || GUN, aim(spun([[R, -0.012], [R + 0.008, -0.022], [R + 0.022, -0.022], [R + 0.04, 0]], { seg: 16, caps: [false, false] }), at));
  add(p, col.map((v) => v * 1.5), aim(spun([[R, -0.013], [R, -0.012]], { seg: 16, caps: [true, false] }), at), null, null, 'glow');
  p.lights.push({ at: [at[0], at[1] - 0.05, at[2]], i: o.i ?? 0.5, color: col, dir: [0, -1, 0], reach: o.reach ?? 3, disc: true,
    ...(o.beam === 0 ? {} : { beam: { r: R, spread: o.spread ?? 0.16, length: +drop.toFixed(3), strength: o.beam ?? 1 } }) });
  // (its pool for a cabin's real-time lights: a point of light well under the disc, so it falls on what is below and
  // not back on the ceiling; `disc`: a cabin scales it as a downlight's, kit/ships/cabin-built.js POOLS.discs)
  if (o.pool !== 0) p.lights.push({ at: [at[0], at[1] - (o.poolDrop ?? 0.9), at[2]], i: 0, color: col, dir: null, reach: o.poolReach ?? 2.6, pool: { i: o.pool ?? 0.5, reach: o.poolReach ?? 2.6, disc: true } });
  return p;
}

export function stripLight(p, len, at, rot, o = {}) {
  const w = (o.wid ?? 0.014) + 0.02, d = o.d ?? 0.014;
  add(p, o.look || 'black', solid(shape(len + 0.024, w, 0.007), d, { edge: 0.005, back: false }), localAt(at, rot, [0, 0, -d - 0.001]), rot);
  return glowStrip(p, len, at, rot, o);
}

export function washLight(p, o = {}) {
  const len = o.len ?? 2, y = o.y ?? 2.3, d = o.out ?? 0.07, zf = FACE + d;
  add(p, o.look || 'black', prism([[FACE, y + 0.05], [zf, y + 0.05], [zf, y + 0.02], [zf - 0.045, y - 0.025], [FACE, y - 0.025]], -len / 2, len / 2), [0, 0, 0], [0, -PI / 2, 0]);
  glowStrip(p, len - 0.08, [0, y - 0.0025 - 0.0012, zf - 0.0225 + 0.0012], [PI / 4, 0, 0], { wid: o.wid ?? 0.016, glow: o.glow || [0.7, 0.72, 0.75], i: o.i ?? 0.2, dir: [0, -0.5, 0.86], reach: o.reach ?? 1.8, pool: o.pool ?? 0.3, poolAt: [0, y - 0.55, FACE + 0.5] });
  return p;
}
