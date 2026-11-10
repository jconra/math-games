// THE DRIVE of a ship's engineering room, the room's big machine: a round drum on its side along the wall, in the
// reference's manner (refs/ships/explorer_concept2_chatgpt_2026-11-03.png, its engineering: one big machine of many ribbed
// rings, stepped housings, bolted flanges, a shaft into the next unit). From the wall it backs onto to its free end: a
// rear unit, a shaft with a bolted coupling, a bell, the main drum with its ribs and a belt housing with a lit seam, a
// bolted front flange, a front bell, the blue glow in a recess, a hub. On top a valve chest (a pipe from overhead comes
// down to its flange). Under it two saddles with a cut-out; in front two round pumps on a skid with cut corners, each
// piped into the drum in copper, a manifold between them; a yellow tube guard rail along its aisle edge.
//
// THE GLOW AT ITS END IS ITS OWN PIECE, as the reactor's core is (kit/shipparts/cabin/reactor.js): the kit material
// 'driveGlow', so in a built cabin its own mesh: cabin.group.getObjectByName('driveGlow') (material mats.driveGlow), one
// draw. A flat ring facing out of the drum's end; its uv: u once round, v 0 at its inner edge to 1 at its outer.
// Its light is one number, DRIVE_LIGHT (its baked light and its pool, the pool tagged DRIVE_TAG).
//
// A wall fitting: x along the wall, centred; z = 0 on the wall line; y = 0 the deck.
//   drivePumps(p, o)   o.len (1.5), o.depth (1.25), o.h (1.8), o.back (the drum's end at a wall: -1, its own -x; +1),
//                      o.pipeY (the height of pipes along the wall it backs onto: a pipe up from its rear unit to them),
//                      o.chest (where along x its valve chest stands, if somewhere particular), o.trim
//   driveDims(o)       its measures, for whoever pipes to it: { R, yd, zd (the drum's radius and its axis), X(t) (a place
//                      along it, t from the wall it backs onto), L, chest: [x, y, z] (the top of the valve chest's flange) }
import { shape, solid, loft, prism, add } from '../../bevel.js';
import { FACE } from './ship.js';
import { FLAT, strip, COPPER } from './bits.js';
import { GUN, STEEL } from './mess.js';
import { SEAM, O } from './reactor.js';
import { spun, tube, aim, bolts, flange, valve, clamp } from './round.js';

const PI = Math.PI, DRUM = { c: '#8f949b', r: 0.5, m: 0.4, w: 0.4 };
export const DRIVE_GLOW = [0.3, 0.85, 2.1], DRIVE_LIGHT = 1, DRIVE_TAG = 'drive-glow';

export function driveDims(o = {}) {
  const len = o.len ?? 1.5, depth = o.depth ?? 1.25, h = Math.min(o.h ?? 1.8, 1.9), back = o.back || -1, s = -back;
  const R = +Math.min(0.46, (depth - FACE) * 0.37).toFixed(4), zd = +(FACE + R * 1.1 + 0.04).toFixed(4), yd = +Math.min(h - R * 1.12 - 0.08, 0.86).toFixed(4);
  const X0 = back * (len / 2 - FACE), L = len - FACE - 0.12, k = Math.min(1, L / 1.35), t0 = 0.42 * k, t1 = L - 0.3 * k, X = (t) => X0 + s * t;
  const n = t1 - t0 > 0.55 ? 5 : 3, ribs = Array.from({ length: n }, (_, i) => t0 + (t1 - t0) * (i + 0.5) / n);
  const tc = o.chest != null ? Math.max(t0 + 0.12, Math.min(t1 - 0.12, (o.chest - X0) * s)) : ribs[n - 2] + (ribs[n - 1] - ribs[n - 2]) / 2;
  return { len, depth, h, back, s, R, zd, yd, X0, L, k, t0, t1, X, ribs, chest: [+X(tc).toFixed(4), +(yd + R + 0.13).toFixed(4), zd] };
}

export function drivePumps(p, o = {}) {
  const D = driveDims(o), { len, depth, s, R, zd, yd, L, k, t0, t1, X, ribs } = D, n = ribs.length, trim = o.trim || 'black';
  // (a round part of the drum: radii in parts of R, places along it from the wall it backs onto)
  const sp = (look, prof, o2 = {}, mat = 'solid') => add(p, look, aim(spun(prof.map(([r, t, v]) => [r * R, t, v]), { seg: 32, ...o2 }), [D.X0, yd, zd], [s, 0, 0]), null, null, mat);
  // from the wall: the rear unit, the shaft and its bolted coupling, the rear bell
  sp(GUN, [[0.72, 0], [0.72, 0.13 * k], [0.64, 0.17 * k]], { caps: [false, true] });
  sp(STEEL, [[0.3, 0.17 * k], [0.3, 0.33 * k]], { caps: [false, false], seg: 16 });
  flange(p, STEEL, [X(0.25 * k), yd, zd], [s, 0, 0], 0.3 * R, { R: 0.5 * R, w: 0.04 * k, bolts: 8, both: true, seg: 20 });
  sp(GUN, [[0.3, 0.33 * k], [0.86, 0.33 * k], [0.86, 0.37 * k], [1, t0]], { caps: [false, false] });
  // the main drum, its ribs, the belt housing in the middle with its lit seam
  sp(DRUM, [[1, t0], [1, t1]], { caps: [false, false] });
  ribs.forEach((t, i) => {
    if (i !== (n - 1) / 2) return sp(GUN, [[0.99, t - 0.03], [1.085, t - 0.018], [1.085, t + 0.018], [0.99, t + 0.03]], { caps: [false, false] });
    sp(trim, [[0.99, t - 0.06], [1.1, t - 0.045], [1.1, t + 0.045], [0.99, t + 0.06]], { caps: [false, false] });
    sp(SEAM, [[1.104, t - 0.008], [1.104, t + 0.008]], { caps: [false, false] }, 'glow');
  });
  // the front flange with its bolt circle, the front bell, THE GLOW in its recess (its own material: see the head of this
  // file), the hub
  sp(STEEL, [[0.97, t1], [1.12, t1], [1.12, t1 + 0.05 * k], [0.97, t1 + 0.05 * k]], { caps: [false, false] });
  bolts(p, GUN, [X(t1 + 0.05 * k), yd, zd], [s, 0, 0], 1.05 * R, 16, { size: 0.013 });
  sp(GUN, [[0.97, t1 + 0.05 * k], [0.74, L - 0.06 * k], [0.68, L - 0.06 * k], [0.68, L - 0.1 * k]], { caps: [false, false] });
  sp(DRIVE_GLOW, [[0.68, L - 0.1 * k, 1], [0.4, L - 0.1 * k, 0]], { caps: [false, false] }, 'driveGlow');
  sp(GUN, [[0.4, L - 0.1 * k], [0.4, L - 0.03 * k], [0.3, L]], { caps: [false, true] });
  // the valve chest on top, a bolted flange on it
  const [xc, yc] = D.chest;
  add(p, GUN, loft([O(0.2, yd + R * 0.86, xc, -zd), O(0.2, yc - 0.045, xc, -zd), O(0.14, yc - 0.014, xc, -zd)]), [0, 0, 0], FLAT);
  flange(p, STEEL, [xc, yc - 0.014, zd], [0, 1, 0], 0.045, { R: 0.075, bolts: 6 });
  // the saddles under it, one under each end rib: a cut-out in each
  const top = yd - R * 0.72, rot = [0, PI / 2, 0];
  for (const t of [ribs[0], ribs[n - 1]]) add(p, 'dark', prism([[-zd - R * 0.95, 0], [-zd + R * 0.95, 0], [-zd + R * 0.95, 0.06], [-zd + R * 0.62, top], [-zd - R * 0.62, top], [-zd - R * 0.95, 0.06]], X(t) - 0.04, X(t) + 0.04,
    { holes: [[[-zd - R * 0.5, 0.1], [-zd + R * 0.5, 0.1], [-zd + R * 0.32, top - 0.12], [-zd - R * 0.32, top - 0.12]]] }), [0, 0, 0], rot);
  // the pumps, on a skid in front of the drum, between its ribs: each a round body and a finned motor, a copper pipe from
  // it up and straight in toward the drum's middle (a collar where it goes in), a manifold between the two
  const zp = Math.min(depth - 0.2, zd + R + 0.2), z0 = zp - 0.16, z1 = depth - 0.07, xs = [X((ribs[0] + ribs[1]) / 2), X((ribs[n - 2] + ribs[n - 1]) / 2)], wS = Math.abs(xs[1] - xs[0]) + 0.34;
  add(p, 'dark', solid(shape(wS, z1 - z0, 0.06, (xs[0] + xs[1]) / 2, -(z0 + z1) / 2), 0.06, { edge: 0.01 }), [0, 0, 0], FLAT);
  for (const xp of xs) {
    const at = [xp, 0, zp], yb = 0.6, u = [zd - zp, yd - yb], far = Math.hypot(...u), e = far - R + 0.04;
    add(p, 'yellow', spun([[0.1, 0.06], [0.1, 0.1], [0.085, 0.12], [0.085, 0.3], [0.1, 0.32], [0.1, 0.36]], { seg: 16, caps: [false, true] }), at);
    add(p, GUN, spun([[0.068, 0.36], [0.068, 0.5]], { seg: 16, caps: [false, true] }), at);
    for (const y of [0.385, 0.42, 0.455]) add(p, STEEL, spun([[0.066, y], [0.086, y + 0.004], [0.086, y + 0.014], [0.066, y + 0.018]], { seg: 16, caps: [false, false] }), at);
    add(p, COPPER, tube([[xp, 0.5, zp], [xp, yb, zp], [xp, yb + u[1] / far * e, zp + u[0] / far * e]], 0.03, { bend: 0.06 }));
    flange(p, 'black', [xp, yb + u[1] / far * (far - R - 0.012), zp + u[0] / far * (far - R - 0.012)], [0, u[1], u[0]], 0.03, { w: 0.024 });
  }
  add(p, GUN, tube([[xs[0], 0.21, zp], [xs[1], 0.21, zp]], 0.024, { seg: 8 }));
  for (const sg of [1, -1]) flange(p, 'black', [(xs[0] + xs[1]) / 2 + sg * (Math.abs(xs[1] - xs[0]) / 2 - 0.115), 0.21, zp], [1, 0, 0], 0.024, { w: 0.02, seg: 8 });
  // the guard rail along its aisle edge: one yellow tube up, along and down, its corners rounded; a rail halfway up
  const xa = -len / 2 + 0.12, xb = len / 2 - 0.12, zr = depth - 0.035;
  add(p, 'yellow', tube([[xa, 0, zr], [xa, 0.95, zr], [xb, 0.95, zr], [xb, 0, zr]], 0.02, { seg: 8, bend: 0.1 }));
  add(p, 'yellow', tube([[xa, 0.52, zr], [xb, 0.52, zr]], 0.016, { seg: 8 }));
  for (const x of [xa, xb]) flange(p, 'black', [x, 0.012, zr], [0, 1, 0], 0.02, { R: 0.045, w: 0.024, seg: 8 });
  // a pipe up from the rear unit, by the wall it backs onto, to the pipes along that wall: a sleeve where it meets the
  // lower one, a valve on its way, a clamp to the wall
  if (o.pipeY) {
    const xr = X(0.07), ya = yd + R * 0.7;
    add(p, COPPER, tube([[xr, ya - 0.02, zd], [xr, o.pipeY, zd]], 0.042));
    flange(p, 'black', [xr, ya + 0.02, zd], [0, 1, 0], 0.042);
    add(p, GUN, aim(spun([[0.046, -0.08], [0.062, -0.08], [0.062, 0.08], [0.046, 0.08]], { seg: 12, caps: [false, false] }), [xr, o.pipeY, zd], [0, 0, 1]));
    valve(p, [xr, (ya + o.pipeY) / 2, zd], [0, 1, 0], 0.042, { stem: [0, 0, 1] });
    clamp(p, [xr, o.pipeY - 0.16, zd], [0, 1, 0], 0.042, [D.X0, o.pipeY - 0.16, zd]);
  }
  // its light (DRIVE_LIGHT of it): the blue glow at the drum's end, and a pool in front of it (tagged)
  strip(p, [X(L) + s * 0.12, yd, zd], 0.35 * DRIVE_LIGHT, [s, 0, 0], 1.6, [0.55, 0.8, 1.0]);
  p.lights.push({ at: [X(L * 0.6), yd - 0.2, zd + R + 0.45], i: 0, color: [0.55, 0.8, 1.0], dir: null, reach: 2.0, pool: { i: 0.35 * DRIVE_LIGHT, reach: 2.0, tag: DRIVE_TAG } });
  return p;
}
