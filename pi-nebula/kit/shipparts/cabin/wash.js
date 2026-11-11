// THE WASHROOM: a toilet, a small basin with a mirror, and a shower stall, in the station's look (pale panels and
// pale ceramic, charcoal frames, a strip light over the mirror).
//   toilet(p, o)   a boxed cistern on the wall with a flush plate, the bowl on a pedestal in front, its lid shut
//     o.depth 0.65 (from the wall line to the bowl's front), o.w 0.4
//   basin(p, o)    a vanity hung on the wall with a basin in its top, a tap, a mirror and a light over it
//     o.w 0.5, o.depth 0.45, o.top 0.85 (the basin's rim)
//   shower(p, o)   a stall: a tray, a panelled back, a solid side on -x, glass on +x and in front (a sliding glass
//                  door), a charcoal frame, a head on an arm and a mixer
//     o.w 0.85, o.depth 0.85, o.h 2.1 (the frame's top)
// Frame: a wall fitting's (kit/shipparts/cabin/ship.js): z = 0 on the wall line, nothing behind z = FACE, its middle on
// x = 0, standing on the deck (y = 0), facing +z.
import { lathe, put } from '../../geo.js';
import { FACE, STEEL } from './ship.js';
import { sinkTop, lean } from './galley.js';

const PI = Math.PI;
// a lathe squashed into an oval (sx across, sz front to back), at `at`
function oval(p, surf, pts, sx, sz, at, seg = 20) { const g = lathe(pts, seg); put(g, at, [0, 0, 0], [sx, 1, sz]); return p.add('solid', g, surf); }
// a pane of glass both ways round (seen from in front and from behind): w x h, its middle at `at`, turned by ry
function pane(p, w, h, at, ry = 0) { p.glass(w, h, at, [0, ry, 0]); p.glass(w, h, at, [0, ry + PI, 0]); }

export function toilet(p, o = {}) {
  p = lean(p);
  const depth = o.depth ?? 0.65, w = o.w ?? 0.4, hw = w / 2, cz = FACE + 0.14;
  // the cistern, boxed in pale panels to 0.95 m, a chrome flush plate with two buttons
  p.slab('white2', -hw, hw, 0, 0.95, FACE, cz, { r: 0.014, cell: 0.6 });
  p.slab('black', -hw - 0.005, hw + 0.005, 0.95, 0.98, FACE, cz + 0.01, { r: 0.008 });
  p.slab('chrome', -0.09, 0.09, 0.78, 0.89, cz, cz + 0.006, { r: 0.004, seg: 1 });
  for (const x of [-0.045, 0.045]) p.slab('grey', x - 0.035, x + 0.035, 0.795, 0.875, cz + 0.006, cz + 0.011, { r: 0.004, seg: 1 });
  // the bowl: a pedestal flaring to a rim, an oval seen from above; the seat and the lid shut on it
  const bz = (cz + depth) / 2, sz = (depth - cz) / 2 / 0.2 * 0.97, sx = (hw - 0.02) / 0.2;
  oval(p, 'white2', [[0.001, 0], [0.11, 0], [0.12, 0.04], [0.125, 0.2], [0.16, 0.32], [0.195, 0.38], [0.2, 0.395], [0.001, 0.395]], sx, sz, [0, 0, bz]);
  oval(p, 'white2', [[0.001, 0.395], [0.197, 0.395], [0.2, 0.41], [0.192, 0.425], [0.001, 0.425]], sx, sz, [0, 0, bz]);
  oval(p, 'grey', [[0.001, 0.425], [0.188, 0.425], [0.19, 0.44], [0.17, 0.452], [0.001, 0.455]], sx * 0.98, sz * 0.97, [0, 0, bz]);
  p.slab('black', -0.06, 0.06, 0.4, 0.46, cz, cz + 0.05, { r: 0.012 });   // the hinge block
}

export function basin(p, o = {}) {
  p = lean(p);
  const w = o.w ?? 0.5, depth = o.depth ?? 0.45, top = o.top ?? 0.85, hw = w / 2, front = depth - 0.02;
  // the vanity, hung clear of the floor: its door, a pale top with the basin and tap in it
  p.slab('white', -hw, hw, 0.42, top - 0.03, FACE, front, { r: 0.012, cell: 0.6 });
  p.slab('white2', -hw + 0.01, hw - 0.01, 0.45, top - 0.06, front, front + 0.018, { r: 0.008 });
  p.slab('black', -0.1, 0.1, top - 0.11, top - 0.09, front + 0.018, front + 0.03, { r: 0.006 });
  p.slab('black', -hw, hw, 0.4, 0.43, FACE, front - 0.02, { r: 0.006 });
  p.slab('white2', -hw, hw, top - 0.03, top, FACE, depth, { r: 0.012 });
  sinkTop(p, 0, top, (FACE + depth) / 2 + 0.04, Math.min(0.34, w - 0.1), Math.min(0.26, depth - 0.16));
  // the mirror in a charcoal frame, at a 1.75 m person's face (1.30 to 1.92 m), a strip light over it
  const mw = Math.min(0.44, w - 0.04) / 2, m0 = 1.3, m1 = 1.92;
  p.slab('black', -mw - 0.02, mw + 0.02, m0 - 0.02, m1 + 0.02, FACE, FACE + 0.02, { r: 0.008 });
  p.slab(STEEL, -mw, mw, m0, m1, FACE + 0.02, FACE + 0.026, { r: 0.002, seg: 1, cell: 9 });
  p.slab('chrome', -mw + 0.01, mw - 0.01, m0 + 0.01, m1 - 0.01, FACE + 0.026, FACE + 0.029, { r: 0.001, seg: 1, cell: 9 });
  p.slab('black', -mw - 0.02, mw + 0.02, m1 + 0.05, m1 + 0.1, FACE, FACE + 0.07, { r: 0.01 }); p.glowSlab('soft', -mw, mw, m1 + 0.044, m1 + 0.05, FACE + 0.02, FACE + 0.055);
  p.light([0, m1 - 0.1, FACE + 0.3], 0.35, [1, 0.96, 0.9], [0, -0.5, 0.86], 2);
}

export function shower(p, o = {}) {
  p = lean(p);
  const w = o.w ?? 0.85, depth = o.depth ?? 0.85, h = o.h ?? 2.1, hw = w / 2, T = 0.06, f = 0.03;
  // the tray, its drain
  p.slab('white2', -hw, hw, 0, T, FACE, depth, { r: 0.012, cell: 0.6 });
  p.slab('dark', -0.06, 0.06, T, T + 0.003, (FACE + depth) / 2 - 0.06, (FACE + depth) / 2 + 0.06, { r: 0.002, seg: 1 });
  // the back: panels with a dark seam; the solid side on -x
  p.slab('dark', -hw, hw, T, h, FACE, FACE + 0.006, { r: 0, skip: ['-z'], cell: 0.6 });
  for (const [y0, y1] of [[T, 1.5], [1.5, h]]) p.slab('white2', -hw + 0.01, hw - 0.01, y0 + 0.006, y1 - 0.006, FACE + 0.006, FACE + 0.022, { r: 0.006, skip: ['-z'], cell: 0.6 });
  p.slab('white', -hw, -hw + f, T, h, FACE + 0.022, depth, { r: 0.008, cell: 0.6 });
  // the charcoal frame: two front posts, a post at the back of the glass side, a rail along the top
  for (const [x, z] of [[-hw + f / 2, depth - f / 2], [hw - f / 2, depth - f / 2], [hw - f / 2, FACE + 0.022 + f / 2]]) p.slab('black', x - f / 2, x + f / 2, T, h, z - f / 2, z + f / 2, { r: 0.008 });
  p.slab('black', -hw, hw, h - f, h, depth - f, depth, { r: 0.008 }); p.slab('black', hw - f, hw, h - f, h, FACE + 0.022, depth, { r: 0.008 });
  p.slab('black', -hw + f, hw - f, T, T + 0.025, depth - f, depth, { r: 0.006 }); p.slab('black', hw - f, hw, T, T + 0.025, FACE + 0.022, depth, { r: 0.006 });
  // glass: the side, a fixed half in front and the sliding door over it, with its handle
  const gh = h - f - T - 0.025, gy = T + 0.025 + gh / 2, inner = w - 2 * f;
  pane(p, depth - FACE - 0.022 - 2 * f, gh, [hw - f / 2, gy, (FACE + 0.022 + depth) / 2], PI / 2);
  pane(p, inner / 2 + 0.03, gh, [-hw + f + inner / 4, gy, depth - f / 2 - 0.006]);
  pane(p, inner / 2 + 0.03, gh, [hw - f - inner / 4, gy, depth - f / 2 + 0.006]);
  p.slab('black', f + 0.03, f + 0.05, 0.9, 1.3, depth - f / 2 + 0.008, depth + 0.02, { r: 0.006 });   // (the sliding door's pull, near its leading edge)
  // a rain head on an arm from the back, the mixer with its lever, a little shelf
  p.box('chrome', [0.025, 0.025, 0.3], [0, 1.98, FACE + 0.022 + 0.15], null, { r: 0.008 });
  p.lathe('chrome', [[0.001, -0.02], [0.1, -0.02], [0.11, -0.01], [0.1, 0], [0.001, 0]], 20, [0, 1.98, FACE + 0.022 + 0.3]);
  const mx = -hw + 0.2;
  p.slab('chrome', mx - 0.06, mx + 0.06, 1.05, 1.21, FACE + 0.022, FACE + 0.03, { r: 0.006 });
  p.cyl('chrome', 0.022, 0.05, [mx, 1.16, FACE + 0.055], [PI / 2, 0, 0], 12); p.box('chrome', [0.016, 0.07, 0.016], [mx, 1.11, FACE + 0.075], [0, 0, 0.5], { r: 0 });
  p.slab('black', hw - 0.3, hw - 0.06, 1.4, 1.42, FACE + 0.022, FACE + 0.14, { r: 0.006 });
  p.light([0, h - 0.15, (FACE + depth) / 2], 0.3, [1, 0.97, 0.92], [0, -1, 0], 2);
}
