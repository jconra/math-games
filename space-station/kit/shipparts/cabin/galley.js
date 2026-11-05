// THE GALLEY: a ship's kitchen run, its fridge, and a corner table with bench seats, in the station's look (off-white
// cupboards, a pale satin worktop, charcoal plinths and handles, a strip light under the wall cupboard) with the navy
// cushions of the game's maker's pictures.
//   galleyCounter(p, o)  base cupboards along a wall under a worktop, with a small sink and a two-ring cooktop
//     o.len 1.5        metres along the wall; the cupboards come in doors about 0.5 m wide
//     o.depth 0.6      from the wall line to the worktop's front
//     o.top 0.9        the worktop's height
//     o.sink -0.5      the sink's middle along x (null: none)
//     o.hob 0.5        the cooktop's middle along x (null: none); its cupboard is two drawers
//     o.upper true     a wall cupboard above (1.45 to 2.15 m), with a strip light under it over the worktop
//     o.splash true    a dark splashback between the worktop and the wall cupboard
//   fridge(p, o)       a tall fridge column: o.w 0.6, o.depth 0.6, o.h 2.0
//   dinette(p, o)      benches round a table on a pedestal (navy cushions, a pale top)
//     o.form 'L'       'L': a back bench along the wall and a side bench up the corner wall (its wall line at
//                      x = -bench / 2); 'facing': a second bench facing the first across the table, standing free with
//                      its own back; 'single': one bench, the table in front
//     o.bench 1.5      the back bench's length along x
//     o.side 1.3       the L's side bench, along z from the wall line (the corner included)
//     o.seat 0.5       a bench's depth from its wall line, the back cushion included
//     o.gap 0.7        seat front to seat front ('facing')
//     o.table [1.0, 0.7]  the top, w along x and d along z
// Frame: a wall fitting's (kit/shipparts/cabin/ship.js): z = 0 on the wall line, nothing behind z = FACE, its middle on
// x = 0, standing on the deck (y = 0), facing +z.
import * as THREE from 'three';
import { circle, sweep } from '../../geo.js';
import { FACE, NAVY, WORKTOP, STEEL } from './ship.js';

const PI = Math.PI;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
// a flat ring path round the up axis (the profile's x points out, its y up)
const ringPath = (r, y, cx = 0, cz = 0, n = 24) => Array.from({ length: n }, (_, i) => { const a = i / n * PI * 2, c = Math.cos(a), s = Math.sin(a); return { p: v3(cx + c * r, y, cz + s * r), x: v3(c, 0, s), y: v3(0, 1, 0) }; });
// how many doors a run of `len` gets, about 0.5 m each
const modules = (len) => Math.max(1, Math.round(len / 0.5));
// a lean way to draw into a piece: the same piece, but its small or thin slabs and boxes leave out the extra rows of
// vertices near their edges (kept for big panels, where the corner darkening is baked per vertex), so a fitting stays
// cheap. Everything else (parts, lights, cylinders, sweeps) goes straight to the piece.
const thin = (size) => Math.min(...size) < 0.05 || Math.max(...size) < 0.7;
export function lean(p) {
  return Object.assign(Object.create(p), {
    slab: (s, x0, x1, y0, y1, z0, z1, o = {}) => p.slab(s, x0, x1, y0, y1, z0, z1, thin([x1 - x0, y1 - y0, z1 - z0]) ? { loops: [], cell: 0.6, ...o } : o),
    box: (s, size, at, rot, o = {}) => p.box(s, size, at, rot, thin(size) ? { loops: [], cell: 0.6, ...o } : o),
  });
}

// ── the counter ───────────────────────────────────────────────────────────────────────────────────────────────────
// a sink set in a worktop at x (its top at y, the bowl's middle at z): a brushed rim, a dark bowl, a chrome tap and lever
export function sinkTop(p, x, y, z, w = 0.38, d = 0.32) {
  p = lean(p);
  const hw = w / 2, hd = d / 2, t = 0.022;
  for (const [x0, x1, z0, z1] of [[x - hw, x + hw, z - hd, z - hd + t], [x - hw, x + hw, z + hd - t, z + hd], [x - hw, x - hw + t, z - hd + t, z + hd - t], [x + hw - t, x + hw, z - hd + t, z + hd - t]]) p.slab(STEEL, x0, x1, y, y + 0.006, z0, z1, { r: 0.003, seg: 1 });
  p.slab('dark', x - hw + t, x + hw - t, y - 0.004, y + 0.002, z - hd + t, z + hd - t, { r: 0.002, seg: 1, cell: 9 });   // (the bowl, seen from above)
  p.slab(STEEL, x - 0.03, x + 0.03, y - 0.003, y + 0.003, z - 0.03, z + 0.03, { r: 0 });                                   // its drain
  const tz = z - hd - 0.04;
  p.cyl('chrome', 0.018, 0.22, [x, y + 0.11, tz], null, 10);
  p.box('chrome', [0.03, 0.03, 0.17], [x, y + 0.21, tz + 0.07], null, { r: 0.01 });
  p.box('chrome', [0.012, 0.012, 0.08], [x + 0.04, y + 0.15, tz], [0, 0, -0.5], { r: 0 });
}
// a two-ring cooktop: black glass, two rings (the left one on: a dim orange glow), a row of touch marks
function hob(p, x, y, z) {
  p.slab('black', x - 0.21, x + 0.21, y, y + 0.008, z - 0.22, z + 0.2, { r: 0.004, seg: 1 });
  for (const [dx, on] of [[-0.095, true], [0.095, false]]) {
    p.sweep('dark', circle(0.006, 5), ringPath(0.075, y + 0.009, x + dx, z - 0.04, 20), { closed: true });
    if (on) p.add('glow', sweep(circle(0.004, 4), ringPath(0.05, y + 0.009, x + dx, z - 0.04, 16), { closed: true }), [1.6, 0.5, 0.12]);
  }
  for (let k = 0; k < 4; k++) p.glowSlab(k ? 'soft' : 'orange', x - 0.09 + k * 0.06, x - 0.07 + k * 0.06, y + 0.008, y + 0.0095, z + 0.13, z + 0.15);
}
export function galleyCounter(p, o = {}) {
  p = lean(p);
  const len = o.len ?? 1.5, depth = o.depth ?? 0.6, top = o.top ?? 0.9, sink = o.sink === undefined ? -0.5 : o.sink, hobX = o.hob === undefined ? 0.5 : o.hob;
  const upper = o.upper ?? true, splash = o.splash ?? true, hw = len / 2, n = modules(len), mw = len / n, front = depth - 0.03, mid = (FACE + depth) / 2;
  // the carcass, a recessed dark plinth, the worktop with a charcoal lip and a strip of light under it
  p.slab('white', -hw, hw, 0.1, top - 0.04, FACE, front, { r: 0.012, cell: 0.6 });
  p.slab('black', -hw + 0.01, hw - 0.01, 0, 0.1, FACE + 0.02, front - 0.05, { r: 0.01, cell: 0.8 });
  p.slab(WORKTOP, -hw, hw, top - 0.04, top, FACE, depth, { r: 0.012, cell: 0.6 });
  p.slab('black', -hw, hw, top - 0.065, top - 0.04, front - 0.02, depth - 0.005, { r: 0.006, cell: 0.8 });
  // the doors, or two drawers under the cooktop
  for (let k = 0; k < n; k++) {
    const x0 = -hw + k * mw + 0.006, x1 = -hw + (k + 1) * mw - 0.006, xc = (x0 + x1) / 2;
    const drawers = hobX !== null && Math.abs(xc - hobX) < mw / 2;
    for (const [y0, y1] of drawers ? [[0.13, 0.46], [0.48, top - 0.08]] : [[0.13, top - 0.08]]) {
      p.slab('white2', x0, x1, y0, y1, front, front + 0.018, { r: 0.008, cell: 0.6 });
      p.slab('black', xc - 0.12, xc + 0.12, y1 - 0.06, y1 - 0.04, front + 0.018, front + 0.03, { r: 0.006 });
    }
  }
  if (sink !== null) sinkTop(p, sink, top, mid + 0.03);
  if (hobX !== null) hob(p, hobX, top, mid + 0.03);
  if (splash) p.slab('dark', -hw, hw, top, upper ? 1.45 : top + 0.4, FACE, FACE + 0.012, { r: 0.004, skip: ['-z'], cell: 0.6 });
  if (upper) {
    // a wall cupboard: its doors, a charcoal underside with a strip light washing the worktop
    const U0 = 1.45, U1 = 2.15, ud = FACE + 0.33;
    p.slab('white', -hw, hw, U0, U1, FACE, ud - 0.02, { r: 0.012, cell: 0.6 });
    for (let k = 0; k < n; k++) {
      const x0 = -hw + k * mw + 0.006, x1 = -hw + (k + 1) * mw - 0.006, xc = (x0 + x1) / 2;
      p.slab('white2', x0, x1, U0 + 0.04, U1 - 0.01, ud - 0.02, ud - 0.002, { r: 0.008, cell: 0.6 });
      p.slab('black', xc - 0.1, xc + 0.1, U0 + 0.07, U0 + 0.09, ud - 0.002, ud + 0.012, { r: 0.006 });
    }
    p.slab('black', -hw, hw, U0 - 0.02, U0 + 0.02, FACE, ud, { r: 0.008, cell: 0.8 });
    p.glowSlab('soft', -hw + 0.04, hw - 0.04, U0 - 0.026, U0 - 0.02, ud - 0.06, ud - 0.04);
    for (let k = 0; k < n; k++) p.light([-hw + (k + 0.5) * mw, U0 - 0.12, ud - 0.1], 0.35, [1, 0.95, 0.88], [0, -1, 0.2], 2.2);
  } else p.light([0, top + 0.6, depth], 0.3, [1, 0.95, 0.88], [0, -1, 0], 2);
}

// ── the fridge ────────────────────────────────────────────────────────────────────────────────────────────────────
export function fridge(p, o = {}) {
  p = lean(p);
  const w = o.w ?? 0.6, depth = o.depth ?? 0.6, h = o.h ?? 2.0, hw = w / 2, front = depth - 0.03;
  p.slab('white', -hw, hw, 0.1, h, FACE, front, { r: 0.014, cell: 0.6 });
  p.slab('black', -hw + 0.02, hw - 0.02, 0, 0.1, FACE + 0.02, front - 0.05, { r: 0.01 });
  // a freezer door below, the fridge door above, each with a long handle and the station's dark band
  for (const [y0, y1] of [[0.13, 0.86], [0.89, h - 0.03]]) {
    p.slab('white2', -hw + 0.012, hw - 0.012, y0, y1, front, front + 0.012, { r: 0.006, cell: 0.6 });
    p.slab('black', hw - 0.07, hw - 0.045, y0 + 0.08, Math.min(y1 - 0.08, y0 + 0.62), front + 0.012, front + 0.03, { r: 0.008 });
  }
  p.slab('band', -hw + 0.04, hw - 0.1, 1.22, 1.5, front + 0.012, front + 0.016, { r: 0.004 });
  p.slab('black', -hw + 0.06, -hw + 0.2, 1.62, 1.7, front + 0.012, front + 0.018, { r: 0.006 }); p.glowSlab('blue', -hw + 0.07, -hw + 0.19, 1.635, 1.685, front + 0.018, front + 0.02);
}

// ── the corner table with bench seats ─────────────────────────────────────────────────────────────────────────────
// a bench from x0..x1, z0..z1 (its back against the side named by `back`: '-z', '+z' or '-x'), and its back cushion
function bench(p, x0, x1, z0, z1, back, freeBack = false) {
  p.slab('white', x0, x1, 0.1, 0.4, z0, z1, { r: 0.012, cell: 0.6 });
  p.slab('black', x0 + 0.02, x1 - 0.02, 0, 0.1, z0 + 0.03, z1 - 0.03, { r: 0.01, cell: 0.8 });
  const t = 0.09;   // the back cushion's thickness
  if (back === '-x') {
    p.slab(NAVY, x0 + t + 0.03, x1 - 0.01, 0.4, 0.47, z0 + 0.01, z1 - 0.01, { r: 0.03, seg: 2, cell: 0.6 });
    p.box(NAVY, [t, 0.46, z1 - z0 - 0.04], [x0 + t / 2 + 0.035, 0.73, (z0 + z1) / 2], [0, 0, 0.1], { r: 0.035, seg: 2, cell: 0.6 });
  } else {
    const s = back === '-z' ? 1 : -1, zb = s > 0 ? z0 : z1;
    p.slab(NAVY, x0 + 0.01, x1 - 0.01, 0.4, 0.47, s > 0 ? z0 + t + 0.03 : z0 + 0.01, s > 0 ? z1 - 0.01 : z1 - t - 0.03, { r: 0.03, seg: 2, cell: 0.6 });
    p.box(NAVY, [x1 - x0 - 0.04, 0.46, t], [(x0 + x1) / 2, 0.73, zb + s * (t / 2 + 0.035)], [-s * 0.1, 0, 0], { r: 0.035, seg: 2, cell: 0.6 });
    if (freeBack) {
      // a bench standing free: a panel behind its cushion, capped in charcoal, as the station's booths have
      const zo = s > 0 ? z0 : z1, zi = zo - s * 0.04;
      p.slab('white', x0, x1, 0.1, 1.0, Math.min(zo, zi), Math.max(zo, zi), { r: 0.012, cell: 0.6 });
      p.slab('black', x0 - 0.01, x1 + 0.01, 1.0, 1.04, Math.min(zo, zi) - 0.01, Math.max(zo, zi) + 0.01, { r: 0.01, cell: 0.8 });
    }
  }
}
function tableTop(p, x0, x1, z0, z1) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  p.slab(WORKTOP, x0, x1, 0.72, 0.76, z0, z1, { r: 0.03, seg: 2, cell: 0.6 });
  p.slab('black', x0 + 0.03, x1 - 0.03, 0.7, 0.72, z0 + 0.03, z1 - 0.03, { r: 0.012, cell: 0.8 });
  p.cyl('black', 0.05, 0.7, [cx, 0.35, cz], null, 12); p.cyl('black', 0.22, 0.03, [cx, 0.015, cz], null, 18);
}
export function dinette(p, o = {}) {
  p = lean(p);
  const form = o.form ?? 'L', B = o.bench ?? 1.5, side = o.side ?? 1.3, seat = o.seat ?? 0.5, gap = o.gap ?? 0.7;
  const [tw, td] = o.table ?? [1.0, 0.7], hb = B / 2;
  bench(p, -hb, hb, FACE, seat, '-z');
  if (form === 'L') {
    bench(p, -hb + FACE, -hb + seat, seat, side, '-x');
    const x0 = -hb + seat - 0.06, z0 = seat - 0.06; tableTop(p, x0, x0 + tw, z0, z0 + td);
  } else if (form === 'facing') {
    bench(p, -hb, hb, seat + gap, 2 * seat + gap - FACE, '+z', true);
    const zc = seat + gap / 2; tableTop(p, -tw / 2, tw / 2, zc - td / 2, zc + td / 2);
  } else tableTop(p, -tw / 2, tw / 2, seat - 0.06, seat - 0.06 + td);
  // a strip light along the wall over the back bench, lighting the table
  p.slab('black', -hb + 0.1, hb - 0.1, 1.2, 1.26, FACE, FACE + 0.06, { r: 0.012, cell: 0.8 }); p.glowSlab('soft', -hb + 0.13, hb - 0.13, 1.194, 1.2, FACE + 0.02, FACE + 0.045);
  p.light([0, 1.1, seat + 0.25], 0.5, [1, 0.94, 0.85], [0, -0.7, 0.7], 2.5);
}
// (for the catalog's framing and the rules: a dinette's footprint [x0, x1, z1])
export function dinetteFoot(o = {}) {
  const form = o.form ?? 'L', B = o.bench ?? 1.5, side = o.side ?? 1.3, seat = o.seat ?? 0.5, gap = o.gap ?? 0.7, [tw, td] = o.table ?? [1.0, 0.7];
  const hb = B / 2;
  if (form === 'L') return [-hb, Math.max(hb, -hb + seat - 0.06 + tw), Math.max(side, seat - 0.06 + td)];
  if (form === 'facing') return [-Math.max(hb, tw / 2), Math.max(hb, tw / 2), 2 * seat + gap];
  return [-Math.max(hb, tw / 2), Math.max(hb, tw / 2), seat - 0.06 + td];
}
