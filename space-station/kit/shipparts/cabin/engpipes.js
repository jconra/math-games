// ENGINEERING BETWEEN ITS MACHINES (the machines themselves: reactor.js, drive.js): the pipes that join them, each one
// landing on something at both ends, the floor grating down the aisle, a low rail. Round things round (round.js): real
// swept bends, bolted flanges, couplings, clamps and hangers, handwheel valves.
//   wallPipes(p, o)  a wall fitting: two copper pipes along a wall, parallel, wall to wall, on brackets (the pair the
//                    poster about parallel lines hangs under): o.len, o.y (the lower one's middle), o.gap (0.17),
//                    o.risers ([[x, which], ...]: a pipe down the wall to the deck from the lower (0) or the upper (1)
//                    of the pair at x, with a handwheel valve; the upper one's steps out past the lower pipe), o.slopes
//                    ([left, right]: the height a slope across that end starts at, where there is one)
//   pipeRun(p, o)    a pipe through points given in the room's own frame: o.pts, o.r (0.045), o.look (copper),
//                    o.ceiling (hangers up to it from its level legs), o.valve ([leg, how far along it 0..1, the
//                    stem's way]), o.ends ([false, false]: no flange at that end)
//   grating(p, o)    a floor fitting, centred, x along it: a yellow border with its plan corners cut, a dark pan, bars
//                    across, a frame bar between panels: o.len, o.wid
//   hoopRail(p, o)   a wall fitting: a low yellow tube rail, its corners round, its feet bolted down: o.len, o.h (0.42),
//                    o.z (how far out from the wall line)
import { shape, solid, prism, add } from '../../bevel.js';
import { FACE } from './ship.js';
import { FLAT, COPPER } from './bits.js';
import { GUN, STEEL } from './mess.js';
import { tube, spun, aim, flange, valve, clamp } from './round.js';

export function wallPipes(p, o = {}) {
  const len = o.len ?? 3, y = o.y ?? 2, gap = o.gap ?? 0.17, r = o.r ?? 0.042, z = FACE + 0.07, ys = [y, y + gap];
  ys.forEach((yy, k) => {
    add(p, COPPER, tube([[-len / 2, yy, z], [len / 2, yy, z]], r, { seg: 12 }));
    // (into the walls across: a bolted flange at each end; along it, couplings, staggered between the two)
    // (where a hull side's slope comes down across an end, o.slopes, the pipe goes on into it: its flange stands clear of it)
    for (const s of [-1, 1]) { const S = o.slopes?.[s < 0 ? 0 : 1], inset = S == null ? 0.016 : Math.max(0.016, yy + r * 1.6 - S + 0.02); flange(p, STEEL, [s * (len / 2 - inset), yy, z], [-s, 0, 0], r, { R: r * 1.6, bolts: 6 }); }
    const n = Math.max(1, Math.round(len / 1.3));
    for (let i = 0; i < n; i++) flange(p, GUN, [-len / 2 + len * (i + (k ? 0.36 : 0.64)) / n, yy, z], [1, 0, 0], r, { R: r * 1.5, w: 0.04, bolts: 6, both: true, boltLook: STEEL });
  });
  // the brackets: a plate on the wall, a band round each pipe, a strut back to the plate
  for (let x = -len / 2 + 0.3; x < len / 2 - 0.1; x += 0.6) {
    if ((o.risers || []).some(([xr]) => Math.abs(xr - x) < 0.12)) continue;
    add(p, 'black', solid(shape(0.05, gap + 0.14, 0.014, x, y + gap / 2), 0.012, { edge: 0.005, back: false }), [0, 0, FACE]);
    for (const yy of ys) clamp(p, [x, yy, z], [1, 0, 0], r, [x, yy, FACE + 0.01]);
  }
  // the risers: a sleeve on the pipe, the pipe down to a bolted flange on the deck, a valve at a hand's height
  for (const [x, which] of o.risers || []) {
    const yy = ys[which ? 1 : 0], zr = which ? z + 0.15 : z, rr = r * 0.86;
    add(p, GUN, aim(spun([[r * 1.3, -0.07], [r * 1.3, 0.07]], { seg: 12 }), [x, yy, z], [1, 0, 0]));
    add(p, which ? 'yellow' : COPPER, tube(which ? [[x, yy, z], [x, yy, zr], [x, 0.01, zr]] : [[x, yy, z], [x, 0.01, z]], rr, { seg: 10, bend: 0.07 }));
    flange(p, STEEL, [x, 0.02, zr], [0, 1, 0], rr, { R: rr * 1.7, bolts: 6 });
    valve(p, [x, which ? 1.02 : 1.3, zr], [0, 1, 0], rr, { stem: [0, 0, 1], look: which ? 'red' : 'yellow' });
    clamp(p, [x, 0.55, zr], [0, 1, 0], rr, [x, 0.55, FACE + 0.01]);
    if (which) clamp(p, [x, 1.62, zr], [0, 1, 0], rr, [x, 1.62, FACE + 0.01]);
  }
  return p;
}

export function pipeRun(p, o = {}) {
  const pts = o.pts, r = o.r ?? 0.045, n = pts.length;
  // (a leg: its way, its length, and the point a share t of the way along it)
  const leg = (i) => { const a = pts[i], b = pts[i + 1], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1; return { d: d.map((v) => v / L), L, at: (t) => a.map((v, k) => v + d[k] * t) }; };
  add(p, o.look || COPPER, tube(pts, r, { seg: 12, bend: o.bend ?? r * 2.6 }));
  // (a bolted flange where each end lands)
  const A = leg(0), B = leg(n - 2);
  if (o.ends?.[0] !== false) flange(p, STEEL, A.at(0.02 / A.L), A.d, r, { R: r * 1.7, bolts: 8 });
  if (o.ends?.[1] !== false) flange(p, STEEL, B.at(1 - 0.02 / B.L), B.d.map((v) => -v), r, { R: r * 1.7, bolts: 8 });
  for (let i = 0; i + 1 < n; i++) {
    const G = leg(i); if (G.L < 0.9 || Math.abs(G.d[1]) > 0.01) continue;
    // (a level leg: a coupling in its middle, hangers up to the ceiling)
    flange(p, GUN, G.at(0.5), G.d, r, { R: r * 1.5, w: 0.04, bolts: 6, both: true, boltLook: STEEL });
    if (o.ceiling == null) continue;
    const m = Math.max(1, Math.round(G.L)); for (let j = 0; j < m; j++) { const q = G.at(m === 1 ? 0.7 : (j + 0.5) / m); clamp(p, q, G.d, r, [q[0], o.ceiling, q[2]]); }
  }
  if (o.valve) { const G = leg(o.valve[0]); valve(p, G.at(o.valve[1]), G.d, r, { stem: o.valve[2] }); }
  return p;
}

export function grating(p, o = {}) {
  const len = o.len ?? 2, wid = o.wid ?? 1, top = 0.012, e = 0.05, c = Math.min(0.09, wid * 0.18), x = len / 2, z = wid / 2, n = Math.max(1, Math.round(len / 0.5));
  const rect = (x0, x1, z0, z1) => [[x0, -z1], [x1, -z1], [x1, -z0], [x0, -z0]];
  // the yellow border, its four corners cut; the pan inside it
  const outer = [[-x + c, -z], [x - c, -z], [x, -z + c], [x, z - c], [x - c, z], [-x + c, z], [-x, z - c], [-x, -z + c]].map(([a, b]) => [a, -b]).reverse();
  add(p, 'yellow', prism(outer, 0, top, { holes: [rect(-x + e, x - e, -z + e, z - e)], back: false }), [0, 0, 0], FLAT);
  add(p, 'black', prism(rect(-x + e, x - e, -z + e, z - e), 0, 0.003, { back: false, sides: false }), [0, 0, 0], FLAT);
  // the bars across, and a frame bar between panels
  const L = len - 2 * e, pl = L / n, m = Math.max(2, Math.round(pl / 0.07));
  for (let i = 0; i < n; i++) {
    const x0 = -x + e + pl * i;
    if (i) add(p, STEEL, prism(rect(x0 - 0.014, x0 + 0.014, -z + e, z - e), 0.003, top, { back: false }), [0, 0, 0], FLAT);
    for (let j = 0; j < m; j++) { const xb = x0 + pl * (j + 0.5) / m; add(p, GUN, prism(rect(xb - 0.009, xb + 0.009, -z + e, z - e), 0.003, top - 0.002, { back: false }), [0, 0, 0], FLAT); }
  }
  return p;
}

export function hoopRail(p, o = {}) {
  const len = o.len ?? 1.2, h = o.h ?? 0.42, z = o.z ?? 1, x = len / 2;
  add(p, 'yellow', tube([[-x, 0, z], [-x, h, z], [x, h, z], [x, 0, z]], 0.022, { seg: 8, bend: 0.1 }));
  for (const s of [-1, 1]) flange(p, GUN, [s * x, 0.012, z], [0, 1, 0], 0.022, { R: 0.05, w: 0.02, bolts: 4, boltLook: STEEL });
  return p;
}
