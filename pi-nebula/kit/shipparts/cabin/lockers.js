// SHALLOW BUILT-IN LOCKERS, in the bevel helper's language (kit/bevel.js). The game's maker (2026-11-09): "the shallow
// lockers should be an example for the whole ship. We can be given the idea they extend into the wall, especially for
// lockers and cabinets against the hull, they should be made shallow." And: "Anywhere were we can have beveled corners I
// think we should ... Please use all the angles and bevels as much as possible."
// So a built-in is a shallow front, about 0.22 m off its wall: framed doors standing a little proud of a dark reveal (the
// shadow gap round each door says there is depth behind), a dark plinth set back under it with a light strip in the
// overhang, and its plan corners cut at 45 degrees: a free end's front corner chamfered, an end that meets a neighbour
// standing further out (a bed's front) run out to it on a 45 degree fillet.
// Frames (kit/shipparts/cabin/ship.js): a WALL fitting stands on a wall line, x along the wall, centred; z = 0 on the line,
// its back at the wall's face (FACE), facing +z; y = 0 the deck.
//   shallowLocker(p, o)  THE REUSABLE ONE (a wall fitting): o.w (0.5), o.depth (0.22), o.h (2.5: to the ceiling), o.ends
//                        [left, right] (a free end's front corner cut at 45 degrees, this much along each side), o.join
//                        [left, right] (a fillet out to a neighbour standing proud at that end, this big), o.ext [left,
//                        right] (how far that end runs past o.w / 2, to reach the neighbour's face), o.rows ([[y0, y1]...]:
//                        the doors' heights, bottom first; three to the ceiling, two under 2.2 m), o.cols (doors side by
//                        side: about 0.45 m each), o.nums [upper, lower] (print numbers on the two tall doors), o.label (a
//                        print label key on the upper tall door, 'label:tools'), o.poster (a POSTERS index on the upper
//                        tall door of its first column, with its picture light), o.handle, o.trim, o.toe (false: no light
//                        strip under it)
//   endLocker(p, o)      a thin locker's diagonal face (the berths' end lockers, across a corner): the doors alone, centred
//                        on x = 0, on z = 0, facing +z: o.w (0.44), o.h (2.5), o.rows, o.poster, o.handle, o.trim, o.toe
//   lockerBody(p, o)     the body behind such a face, from its plan: o.pts, o.base, o.h
//   berthLockers(p, o)   the row of lockers right above a berth stack, their faces flush with the bed fronts (the stack's
//                        frame: kit/shipparts/cabin/bunks.js bunkStack): o.len, o.depth (the stack's), o.y (1.9: the
//                        stack's top), o.top (2.5), o.clip [x0, x1] (the stretch its doors take), o.lid (how far back
//                        from the front its top face runs: for a look from above), o.handle, o.trim
import { shape, solid, plate, relief, prism, add } from '../../bevel.js';
import { FACE } from './ship.js';
import { POSTERS } from './print.js';
import { FLAT, printed, glowStrip, pictureLight, decalQuad } from './bits.js';

const PI = Math.PI;
// a door: raised, a fine second outline in it (as the crew lockers' and the drawers')
const DOOR = [{ inset: 0, depth: 0.007, bevel: 0.006 }, { inset: 0.03, depth: 0.0035, bevel: 0.004 }];
const GAP = 0.016;
// the doors' heights: to the ceiling, three (the line at 1.9 m is the bunk room's: the berths' top, the groove under the
// lockers over them); lower, two
export const rowsFor = (h, base = 0.08) => (h > 2.2 ? [[base + 0.02, 1.0], [1.02, 1.9], [1.985, h - 0.03]] : [[base + 0.02, Math.min(h - 0.5, Math.max(0.9, h * 0.5)) - 0.01], [Math.min(h - 0.5, Math.max(0.9, h * 0.5)) + 0.01, h - 0.04]]);

// the doors on a flat front from x0 to x1 at level z: a dark reveal behind them, each door raised out of it; a tall
// door with vents and an upright handle slot with a small light, a short one with a handle slot along its foot
function doorsOn(p, o, x0, x1, z, rows, base) {
  const w = x1 - x0, cols = o.cols ?? Math.max(1, Math.round(w / 0.45)), dw = (w - GAP) / cols, top = rows[rows.length - 1][1];
  add(p, 'dark', plate(shape(w - 0.012, top - base - 0.004, 0, (x0 + x1) / 2, (base + 0.004 + top) / 2)), [0, 0, z + 0.0006]);
  const tall = rows.map(([a, b], i) => (b - a > 0.6 ? i : -1)).filter((i) => i >= 0);
  let posterAt = null;
  for (let c = 0; c < cols; c++) {
    const x = x0 + GAP / 2 + dw * (c + 0.5), di = dw - GAP;
    rows.forEach(([y0, y1], r) => {
      add(p, 'white2', relief(shape(di, y1 - y0, Math.min(0.03, di * 0.14), x, (y0 + y1) / 2), DOOR), [0, 0, z + 0.001]);
      const fz = z + 0.001 + 0.0035;
      if (y1 - y0 <= 0.6) {
        add(p, o.handle || 'black', solid(shape(Math.min(0.16, di * 0.5), 0.026, 0.009, x, y0 + 0.065), 0.006, { edge: 0.002, back: false }), [0, 0, fz]);
        return;
      }
      // (a tall door: the upper one of the two first for the print)
      const k = tall.indexOf(r), upper = k === tall.length - 1, num = o.nums ? (upper ? o.nums[0] : o.nums[1]) : null;
      const poster = upper && c === 0 && o.poster != null, label = upper && !poster && o.label ? o.label : null;
      if (num) printed(p, 'num:' + num, 0.085, 0.085, [x - di / 2 + 0.07, y1 - 0.075, fz + 0.0005], null, '#3a3d42');
      const vw = Math.min(0.17, di - 0.07), vy = y1 - (num ? 0.185 : 0.11), vx = x - (di - vw) / 2 + 0.035;
      // (a door with a poster carries no vents: the poster takes its width)
      if (!poster) {
        add(p, 'white2', relief(shape(vw, 0.085, 0.02, vx, vy), [{ inset: 0, depth: -0.004, bevel: 0.004 }]), [0, 0, fz]);
        for (let v = 0; v < 3; v++) add(p, 'dark', plate(shape(vw - 0.04, 0.011, 0.004, vx, vy - 0.022 + v * 0.022)), [0, 0, fz - 0.0038]);
      }
      if (label) printed(p, label, Math.min(0.2, di - 0.06), Math.min(0.2, di - 0.06) / 4, [x, vy - 0.1, fz + 0.0005], null, '#3a3d42');
      const hx = x + di / 2 - 0.045, hy = y0 < 0.5 ? y1 - 0.2 : y0 + 0.2;
      add(p, o.handle || 'black', solid(shape(0.03, 0.16, 0.01, hx, hy), 0.006, { edge: 0.002, back: false }), [0, 0, fz]);
      add(p, 'blue', plate(shape(0.008, 0.05, 0.003, hx, hy + 0.03)), [0, 0, fz + 0.0063], null, 'glow');
      if (poster) posterAt = { x, y0: hy + 0.13, y1: y1 - (num ? 0.14 : 0.05), di };
    });
  }
  // a poster on the upper tall door, framed, under its picture light
  if (posterAt) {
    const P = POSTERS[o.poster], { x, y0, y1, di } = posterAt, s = Math.min((di - 0.075) / P.w, (y1 - y0 - 0.075) / P.h), pw = P.w * s + 0.03, ph = P.h * s + 0.03, py = (y0 + y1) / 2 - 0.025, fz = z + 0.0045;
    add(p, 'white2', solid(shape(pw, ph, 0.016, x, py), 0.005, { edge: 0.0015, back: false, front: [{ inset: 0.008, depth: -0.0015, bevel: 0.0015 }] }), [0, 0, fz]);
    add(p, '#33363b', decalQuad(P.w * s, P.h * s, 'cabin:poster:' + o.poster), [x, py, fz + 0.0038], null, 'decal');
    pictureLight(p, [x, py + ph / 2 + 0.006, fz], null, pw);
  }
}
// the light strip on a plinth's face, low under the overhang where a standing eye still finds it, shining out over
// the floor
const toeStrip = (p, len, x, base, z, o) => glowStrip(p, len, [x, base * 0.4, z - 0.0342], [0, 0, 0], { wid: 0.012, i: o.toeLight ?? 0.26, dir: [0, -0.6, 0.8], reach: 1.2 });

// ── the reusable shallow locker ─────────────────────────────────────────────────────────────────────────────────
export function shallowLocker(p, o = {}) {
  const w = o.w ?? 0.5, d = o.depth ?? 0.22, h = o.h ?? 2.5, base = o.base ?? 0.08;
  const [eL, eR] = o.ends || [0, 0], [jL, jR] = o.join || [0, 0], xL = -w / 2 - (o.ext?.[0] || 0), xR = w / 2 + (o.ext?.[1] || 0);
  // its plan, going round from the back on the wall: a free end's front corner cut off, a joined end's fillet running out
  // (`set`: the front set back this far, for the plinth)
  const plan = (set = 0) => {
    const z = d - set, P = [[xL, FACE], [xR, FACE]];
    if (jR) P.push([xR, z + jR], [xR - jR, z]); else if (eR) P.push([xR, z - eR], [xR - eR, z]); else P.push([xR, z]);
    if (jL) P.push([xL + jL, z], [xL, z + jL]); else if (eL) P.push([xL + eL, z], [xL, z - eL]); else P.push([xL, z]);
    return P.map(([x, z1]) => [x, -z1]);
  };
  add(p, 'white', prism(plan(), base, h, { back: false }), [0, 0, 0], FLAT);
  add(p, 'dark', prism(plan(0.035), 0, base, { front: false, back: false }), [0, 0, 0], FLAT);
  const x0 = xL + (jL || eL), x1 = xR - (jR || eR), rows = o.rows || rowsFor(h, base);
  doorsOn(p, o, x0, x1, d, rows, base);
  if (o.toe !== false) toeStrip(p, Math.max(0.1, x1 - x0 - 0.04), (x0 + x1) / 2, base, d, o);
  return p;
}

// ── a thin locker's diagonal face ───────────────────────────────────────────────────────────────────────────────
export function endLocker(p, o = {}) {
  const w = o.w ?? 0.44, h = o.h ?? 2.5, base = o.base ?? 0.08, rows = o.rows || rowsFor(h, base);
  add(p, 'dark', plate(shape(w + 0.08, base, 0, 0, base / 2)), [0, 0, -0.035]);
  doorsOn(p, { ...o, cols: 1 }, -w / 2 + 0.012, w / 2 - 0.012, 0, rows, base);
  if (o.toe !== false) toeStrip(p, w - 0.08, 0, base, 0, o);
  return p;
}

// a built-in's body from its plan: o.pts ([[x, z]...]: its outline, in its own frame: x and z as the deck's), from o.base
// (0.08: over its plinth) to o.h. For a built-in whose plan is no rectangle (an end locker's, across a corner): the
// body here, its face (endLocker) set on the diagonal.
export function lockerBody(p, o = {}) {
  add(p, o.look || 'white', prism(o.pts.map(([x, z]) => [x, -z]), o.base ?? 0.08, o.h ?? 2.5, { back: false }), [0, 0, 0], FLAT);
  return p;
}

// ── the lockers right above the berths ──────────────────────────────────────────────────────────────────────────
export function berthLockers(p, o = {}) {
  const L = o.len ?? 2, D = o.depth ?? 1, y = o.y ?? 1.9, top = o.top ?? 2.5, front = D - 0.02, g = 0.07, rec = 0.05;
  const [c0, c1] = o.clip || [-L / 2 + 0.08, L / 2 - 0.08], cx = (c0 + c1) / 2, cw = c1 - c0;
  // the groove between the berths' top and the lockers: dark at its back, the lockers' foot over it, a light strip in it
  // shining down the bed fronts
  add(p, 'dark', plate(shape(L, g, 0, 0, y + g / 2)), [0, 0, front - rec]);
  add(p, 'white', plate(shape(L, rec)), [0, y + g, front - rec / 2], [PI / 2, 0, 0]);
  // the face, flush with the bed fronts; along its foot a light rail in the accent colour, its underside cut at 45
  // degrees and the strip set on that cut (seen from the aisle, shining down the bed fronts); the doors
  const yb = y + g, rail = [[-0.002, 0], [0.006, 0], [0.022, 0.016], [0.022, 0.026], [0.014, 0.034], [-0.002, 0.034]];
  add(p, 'white', plate(shape(L, top - yb, 0, 0, (yb + top) / 2)), [0, 0, front]);
  add(p, o.trim || 'black', prism(rail.map(([z, v]) => [-(front + z), yb + v]), c0 + 0.02, c1 - 0.02), [0, 0, 0], [0, PI / 2, 0]);
  glowStrip(p, cw - 0.08, [cx, yb + 0.0074, front + 0.0146], [PI / 4, 0, 0], { i: 0.3, dir: [0, -0.31, 0.95], reach: 1.5, pool: 0.1, poolAt: [cx, y - 0.15, front + 0.3], poolReach: 1.5 });
  doorsOn(p, { handle: o.handle, cols: o.cols ?? Math.max(1, Math.round(cw / 0.47)) }, c0, c1, front, [[yb + 0.046, top - 0.03]], yb + 0.038);
  if (o.lid) add(p, 'white', plate(shape(L, o.lid, 0, 0, -(front - o.lid / 2))), [0, top - 0.004, 0], FLAT);
  return p;
}
