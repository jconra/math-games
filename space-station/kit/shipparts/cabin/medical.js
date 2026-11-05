// THE MED BAY: a patient bed with a monitor on an arm, the triage scanner over the aisle, the pharmacy wall and a
// stretcher, in the station's look. The medical mark is a teal pulse line (never a red cross, a protected symbol).
//   pulseLine(p, x0, x1, y, z, h, ry)  the mark: a glowing teal heartbeat line from x0 to x1 at height y, its peaks h
//                  tall, on a face at z (turned by ry about the up axis)
//   medBed(p, o)   the bed, its head toward a wall: a column lift on a castored base, side rails, a mattress (its back
//                  section raised), a navy blanket; on the wall a head panel with outlets and the mark, and a monitor
//                  (the station's wall screen) on a jointed arm
//     o.len 2.1, o.w 0.9 (the bed's deck), o.gap 0.15 (from the wall line to the head end), o.top 0.68 (the mattress's
//     top), o.back 0.35 (the raised back section's angle, radians; 0 flat), o.arm 1 (the monitor arm's side, +1 on +x,
//     -1 on -x, 0 none)
//   scanner(p, o)  the triage scanner: a hood hung from the ceiling on four rods over the aisle, a scan band and
//                  emitters glowing on its underside; a stretcher passes under it
//     o.len 1.9 (along z, the way the stretcher runs), o.w 1.2, o.clear 1.98 (the hood's underside), o.ceil 2.5
//   pharmacy(p, o) shelves of medicine behind glass doors over a run of drawers with a worktop
//     o.len 2.0, o.depth 0.6 (the drawers), o.shelves 4, o.upper [1.0, 2.15] (the glass cabinet's bottom and top),
//     o.updepth 0.38
//   stretcher(p, o) a stretcher on a trolley: castors, crossed legs, a padded deck, straps, push bars at both ends
//     o.len 2.0, o.w 0.6, o.top 0.8 (the pad's top)
// Frames: medBed and pharmacy are wall fittings (kit/shipparts/cabin/ship.js: z = 0 on the wall line, nothing behind
// z = FACE, centred on x = 0, the bed running out along +z); scanner hangs from the ceiling (y = o.ceil) centred on the
// origin; stretcher stands free, centred, its length along z. All stand on the deck (y = 0).
import * as THREE from 'three';
import { bevelBox, put } from '../../geo.js';
import { wallScreen } from '../../wallkit.js';
import { part, placeInto } from '../place.js';
import { FACE, NAVY, SHEET, WORKTOP, TEAL } from './ship.js';
import { lean } from './galley.js';

const PI = Math.PI;
// a thin glowing bar from (ax, ay) to (bx, by) on a face at z, in the colour `col`
function glowBar(p, ax, ay, bx, by, z, t, col) {
  const len = Math.hypot(bx - ax, by - ay); const g = bevelBox([len + t, t, 0.004], [0, 0, 0], { r: 0, cell: 9 });
  put(g, [(ax + bx) / 2, (ay + by) / 2, z], [0, 0, Math.atan2(by - ay, bx - ax)]); return p.add('glow', g, col);
}
export function pulseLine(p, x0, x1, y, z, h = 0.06, ry = 0, col = TEAL) {
  // a flat line, one beat (a small bump, the spike down and up, a small bump), a flat line
  const L = x1 - x0, k = (t) => x0 + L * t, pts = [[k(0), 0], [k(0.34), 0], [k(0.4), h * 0.25], [k(0.44), 0], [k(0.48), -h * 0.35], [k(0.53), h], [k(0.58), -h * 0.55], [k(0.62), 0], [k(0.72), h * 0.3], [k(0.78), 0], [k(1), 0]];
  const q = new (p.constructor)();
  for (let i = 0; i < pts.length - 1; i++) glowBar(q, pts[i][0], y + pts[i][1], pts[i + 1][0], y + pts[i + 1][1], z, 0.007, col);
  for (const pt of q.parts) { if (ry) put(pt.geo, [0, 0, 0], [0, ry, 0]); p.parts.push(pt); }
}

// ── the patient bed ───────────────────────────────────────────────────────────────────────────────────────────────
export function medBed(p, o = {}) {
  p = lean(p);
  const len = o.len ?? 2.1, w = o.w ?? 0.9, gap = o.gap ?? 0.15, top = o.top ?? 0.68, back = o.back ?? 0.35, arm = o.arm ?? 1;
  const hw = w / 2, z0 = gap, z1 = gap + len, zm = (z0 + z1) / 2, deck = top - 0.12;
  // on the wall: the head panel, its outlets, a light, the mark
  p.slab('white2', -hw - 0.05, hw + 0.05, 0.85, 1.45, FACE, FACE + 0.04, { r: 0.012, cell: 0.6 });
  p.slab('dark', -hw + 0.02, hw - 0.02, 0.92, 1.12, FACE + 0.04, FACE + 0.046, { r: 0.004 });
  for (let i = 0; i < 3; i++) { const x = -hw + 0.12 + i * 0.12; p.cyl(['grey', 'grey', 'white'][i], 0.022, 0.03, [x, 1.02, FACE + 0.06], [PI / 2, 0, 0], 12); p.cyl('black', 0.01, 0.012, [x, 1.02, FACE + 0.076], [PI / 2, 0, 0], 8); }
  pulseLine(p, -hw + 0.02, hw - 0.02, 1.3, FACE + 0.043, 0.07);
  p.slab('black', -hw, hw, 1.45, 1.5, FACE, FACE + 0.1, { r: 0.012 }); p.glowSlab('soft', -hw + 0.03, hw - 0.03, 1.444, 1.45, FACE + 0.03, FACE + 0.08);
  p.light([0, 1.3, z0 + 0.5], 0.4, [0.9, 1, 0.98], [0, -0.8, 0.6], 2.5);
  // the base: a charcoal chassis on four castors, a pale column lift
  p.slab('black', -hw + 0.1, hw - 0.1, 0.1, 0.18, z0 + 0.15, z1 - 0.15, { r: 0.02, cell: 0.8 });
  for (const sx of [-1, 1]) for (const z of [z0 + 0.2, z1 - 0.2]) { const x = sx * (hw - 0.12); p.cyl('rubber', 0.05, 0.04, [x, 0.05, z], [0, 0, PI / 2], 12); p.slab('black', x - 0.025, x + 0.025, 0.05, 0.12, z - 0.025, z + 0.025, { r: 0.006 }); }
  p.slab('white2', -0.16, 0.16, 0.18, deck - 0.06, zm - 0.3, zm + 0.3, { r: 0.02, cell: 0.6 });
  p.slab('band', -0.165, 0.165, 0.3, 0.38, zm - 0.305, zm + 0.305, { r: 0.006 });
  // the deck's frame, a head board and a foot board (the mark on its outer face)
  p.slab('white', -hw, hw, deck - 0.06, deck, z0, z1, { r: 0.015, cell: 0.6 });
  p.slab('white2', -hw + 0.02, hw - 0.02, deck - 0.06, deck + 0.42, z0, z0 + 0.04, { r: 0.012, cell: 0.6 });
  p.slab('white2', -hw + 0.02, hw - 0.02, deck - 0.06, deck + 0.3, z1 - 0.04, z1, { r: 0.012, cell: 0.6 });
  p.slab('black', -hw + 0.02, hw - 0.02, deck + 0.3, deck + 0.33, z1 - 0.045, z1 + 0.005, { r: 0.008 });
  pulseLine(p, -hw + 0.08, hw - 0.08, deck + 0.17, z1 + 0.003, 0.06);
  // the side rails, raised, on two posts each
  for (const sx of [-1, 1]) {
    const x = sx * (hw - 0.015);
    for (const y of [deck + 0.2, deck + 0.3]) p.slab('rail', x - 0.012, x + 0.012, y - 0.012, y + 0.012, z0 + 0.45, z0 + 1.35, { r: 0.01, cell: 0.8 });
    for (const z of [z0 + 0.5, z0 + 1.3]) p.slab('rail', x - 0.012, x + 0.012, deck, deck + 0.3, z - 0.012, z + 0.012, { r: 0.008 });
  }
  // the mattress: a flat part, the back section raised at its hinge, a pillow, a navy blanket over the legs
  const hinge = z0 + 0.65, mt = 0.12;
  p.slab(SHEET, -hw + 0.03, hw - 0.03, deck, deck + mt, hinge, z1 - 0.04, { r: 0.04, seg: 2, cell: 0.8, loops: [] });
  const bl = hinge - z0 - 0.04;
  p.box(SHEET, [w - 0.06, mt, bl], [0, deck + mt / 2 + Math.sin(back) * bl / 2, hinge - Math.cos(back) * bl / 2], [back, 0, 0], { r: 0.04, seg: 2, cell: 0.8, loops: [] });
  p.box(SHEET, [0.5, 0.1, 0.32], [0, deck + mt + 0.04 + Math.sin(back) * 0.32, z0 + 0.25], [back, 0, 0], { r: 0.045, seg: 2 });
  p.slab(NAVY, -hw + 0.02, hw - 0.02, deck + mt - 0.02, deck + mt + 0.02, hinge + 0.25, z1 - 0.03, { r: 0.02, seg: 1, cell: 0.8, loops: [] });
  p.slab(SHEET, -hw + 0.015, hw - 0.015, deck + mt - 0.015, deck + mt + 0.028, hinge + 0.22, hinge + 0.32, { r: 0.02, seg: 2 });   // (the sheet folded over it)
  // the monitor on a jointed arm from the wall, turned to the bed
  if (arm) {
    const sx = arm > 0 ? 1 : -1, ax = sx * (hw + 0.12);
    p.slab('black', ax - 0.06, ax + 0.06, 1.55, 1.75, FACE, FACE + 0.03, { r: 0.01 });
    p.cyl('black', 0.035, 0.12, [ax, 1.65, FACE + 0.06], null, 12);
    p.box('black', [0.05, 0.05, 0.42], [ax - sx * 0.04, 1.68, FACE + 0.27], [0, sx * 0.2, 0], { r: 0.015 });
    p.cyl('black', 0.033, 0.1, [ax - sx * 0.09, 1.68, FACE + 0.48], null, 12);
    p.box('black', [0.05, 0.05, 0.22], [ax - sx * 0.15, 1.68, FACE + 0.57], [0, -sx * 0.6, 0], { r: 0.015 });
    const mx = ax - sx * 0.22, mz = FACE + 0.66, ry = -sx * 0.35;
    placeInto(p, part(wallScreen, 'status'), { at: [mx, 1.5, mz], rot: [0, ry, 0], scale: 0.72 });
    const q = new (p.constructor)(); pulseLine(q, -0.15, 0.15, 0.08, 0.0565, 0.04);
    for (const pt of q.parts) { put(pt.geo, [mx, 1.5, mz], [0, ry, 0]); p.parts.push(pt); }
  }
}

// ── the triage scanner ────────────────────────────────────────────────────────────────────────────────────────────
export function scanner(p, o = {}) {
  p = lean(p);
  const len = o.len ?? 1.9, w = o.w ?? 1.2, clear = o.clear ?? 1.98, ceil = o.ceil ?? 2.5, hl = len / 2, hw = w / 2, H = 0.26;
  // the hood: a pale body with a charcoal skirt, a dark underside
  p.slab('white2', -hw + 0.04, hw - 0.04, clear + 0.08, clear + H, -hl + 0.04, hl - 0.04, { r: 0.05, seg: 2, cell: 0.6 });
  p.slab('black', -hw, hw, clear, clear + 0.09, -hl, hl, { r: 0.03, cell: 0.8 });
  p.slab('dark', -hw + 0.06, hw - 0.06, clear - 0.006, clear + 0.01, -hl + 0.06, hl - 0.06, { r: 0.006, cell: 0.6 });
  p.slab('band', -hw + 0.035, hw - 0.035, clear + 0.12, clear + 0.17, -hl + 0.035, hl - 0.035, { r: 0.01, cell: 0.8 });
  // the scan band across the aisle, two thinner ones beside it, emitters down both long edges
  p.add('glow', bevelBox([w - 0.2, 0.006, 0.06], [0, clear - 0.008, 0], { r: 0.002, seg: 1, cell: 9 }), TEAL);
  for (const z of [-0.2, 0.2]) p.add('glow', bevelBox([w - 0.3, 0.005, 0.015], [0, clear - 0.008, z], { r: 0, cell: 9 }), [0.25, 2.6, 2.3]);
  for (const sx of [-1, 1]) for (let k = 0; k < 7; k++) { const z = -hl + 0.2 + k * (len - 0.4) / 6; p.cyl('black', 0.03, 0.012, [sx * (hw - 0.14), clear - 0.006, z], null, 12); p.add('glow', bevelBox([0.035, 0.004, 0.035], [sx * (hw - 0.14), clear - 0.013, z], { r: 0, cell: 9 }), [0.9, 3.0, 5.5]); }
  // its rods up to the ceiling, each on a plate
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (hw - 0.18), z = sz * (hl - 0.25);
    p.cyl('black', 0.022, ceil - clear - H, [x, (ceil + clear + H) / 2, z], null, 10);
    p.slab('black', x - 0.07, x + 0.07, ceil - 0.02, ceil, z - 0.07, z + 0.07, { r: 0.006, skip: ['+y'] });
  }
  p.slab('dark', -0.25, 0.25, clear + H, clear + H + 0.01, -0.06, 0.06, { r: 0.003 }); pulseLine(p, -0.3, 0.3, clear + 0.205, hl - 0.032, 0.04);
  p.light([0, clear - 0.15, 0], 0.9, [0.6, 1, 0.95], [0, -1, 0], 3);
}

// ── the pharmacy wall ─────────────────────────────────────────────────────────────────────────────────────────────
const BOX = [{ c: '#d9dcd8', r: 0.7 }, { c: '#7fb8b0', r: 0.6 }, { c: '#e8a050', r: 0.6 }, { c: '#9cb4d0', r: 0.6 }, { c: '#e6e2d2', r: 0.75 }, { c: '#c86a5a', r: 0.6 }];
export function pharmacy(p, o = {}) {
  p = lean(p);
  const len = o.len ?? 2.0, depth = o.depth ?? 0.6, n = o.shelves ?? 4, [u0, u1] = o.upper ?? [1.0, 2.15], ud = FACE + (o.updepth ?? 0.38);
  const hw = len / 2, nm = Math.max(1, Math.round(len / 0.5)), mw = len / nm, front = depth - 0.03, top = 0.9;
  // the drawers and worktop
  p.slab('white', -hw, hw, 0.1, top - 0.04, FACE, front, { r: 0.012, cell: 0.6 });
  p.slab('black', -hw + 0.01, hw - 0.01, 0, 0.1, FACE + 0.02, front - 0.05, { r: 0.01, cell: 0.8 });
  p.slab(WORKTOP, -hw, hw, top - 0.04, top, FACE, depth + 0.01, { r: 0.012, cell: 0.6 });
  for (let k = 0; k < nm; k++) {
    const x0 = -hw + k * mw + 0.006, x1 = -hw + (k + 1) * mw - 0.006, xc = (x0 + x1) / 2;
    for (let d = 0; d < 3; d++) { const y0 = 0.13 + d * 0.24, y1 = y0 + 0.225; p.slab('white2', x0, x1, y0, y1, front, front + 0.018, { r: 0.008 }); p.slab('black', xc - 0.08, xc + 0.08, y1 - 0.05, y1 - 0.035, front + 0.018, front + 0.03, { r: 0.005 }); }
  }
  p.slab('dark', -hw, hw, top, u0, FACE, FACE + 0.012, { r: 0.004, skip: ['-z'], cell: 0.6 });
  // the glass cabinet: a dark inside, pale shelves stocked with boxes, a light along its top, glass doors in charcoal frames
  const t = 0.025;
  p.slab('dark', -hw, hw, u0, u1, FACE, FACE + 0.02, { r: 0, skip: ['-z'], cell: 0.6 });
  p.slab('white', -hw, hw, u1 - t, u1, FACE, ud, { r: 0.008, cell: 0.6 }); p.slab('white', -hw, hw, u0, u0 + t, FACE, ud, { r: 0.008, cell: 0.6 });
  for (let k = 0; k <= nm; k++) { const x = -hw + k * mw; p.slab('white', Math.max(-hw, x - t / 2), Math.min(hw, x + t / 2), u0, u1, FACE, ud, { r: 0.006, cell: 0.6 }); }
  const sh = (u1 - u0 - 2 * t) / n;
  let seed = 3; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let s = 0; s < n; s++) {
    const y = u0 + t + s * sh;
    if (s) p.slab('white2', -hw, hw, y - 0.008, y + 0.008, FACE + 0.02, ud - 0.02, { r: 0.004, cell: 0.8 });
    // boxes, packed along the shelf (sharp-edged: cheap), a gap now and then
    for (let x = -hw + 0.04; x < hw - 0.08;) {
      const bw = Math.min(0.05 + R() * 0.09, hw - 0.03 - x), bh = Math.min(sh - 0.05, 0.08 + R() * 0.14), bd = 0.12 + R() * 0.12;
      if (Math.abs(((x + hw) % mw) - 0) < t || Math.abs(((x + bw + hw) % mw)) < t) { x += 0.03; continue; }
      if (R() > 0.12) p.slab(BOX[Math.floor(R() * BOX.length)], x, x + bw, y + 0.008, y + 0.008 + bh, FACE + 0.03, FACE + 0.03 + bd, { r: 0, loops: [], cell: 9 });
      x += bw + 0.008;
    }
  }
  p.glowSlab('soft', -hw + 0.03, hw - 0.03, u1 - t - 0.008, u1 - t, ud - 0.06, ud - 0.04);
  for (let k = 0; k < nm; k++) p.light([-hw + (k + 0.5) * mw, u1 - 0.15, ud - 0.12], 0.25, [0.95, 1, 1], [0, -0.6, 0.8], 1.6);
  for (let k = 0; k < nm; k++) {
    const x0 = -hw + k * mw + t / 2, x1 = -hw + (k + 1) * mw - t / 2, xc = (x0 + x1) / 2, fz = ud + 0.002, fr = 0.022;
    p.slab('black', x0, x1, u0 + t, u0 + t + fr, ud, fz + 0.016, { r: 0.004 }); p.slab('black', x0, x1, u1 - t - fr, u1 - t, ud, fz + 0.016, { r: 0.004 });
    p.slab('black', x0, x0 + fr, u0 + t, u1 - t, ud, fz + 0.016, { r: 0.004 }); p.slab('black', x1 - fr, x1, u0 + t, u1 - t, ud, fz + 0.016, { r: 0.004 });
    p.glass(x1 - x0 - 2 * fr, u1 - u0 - 2 * t - 2 * fr, [xc, (u0 + u1) / 2, fz + 0.008]);
    p.slab('black', (k % 2 ? x0 + 0.04 : x1 - 0.055), (k % 2 ? x0 + 0.055 : x1 - 0.04), 1.45, 1.65, fz + 0.016, fz + 0.035, { r: 0.006 });
  }
  p.slab('black', -hw, hw, u1, u1 + 0.05, FACE, ud + 0.01, { r: 0.008, cell: 0.8 });
  pulseLine(p, -0.35, 0.35, u1 + 0.025, ud + 0.012, 0.018);
}

// ── the stretcher ─────────────────────────────────────────────────────────────────────────────────────────────────
export function stretcher(p, o = {}) {
  p = lean(p);
  const len = o.len ?? 2.0, w = o.w ?? 0.6, top = o.top ?? 0.8, hl = len / 2, hw = w / 2, deck = top - 0.08;
  // the base: two charcoal side bars and cross bars on four castors
  for (const sx of [-1, 1]) p.slab('black', sx * (hw - 0.06) - 0.025, sx * (hw - 0.06) + 0.025, 0.12, 0.17, -hl + 0.15, hl - 0.15, { r: 0.012, cell: 0.8 });
  for (const sz of [-1, 1]) p.slab('black', -hw + 0.04, hw - 0.04, 0.12, 0.17, sz * (hl - 0.2) - 0.025, sz * (hl - 0.2) + 0.025, { r: 0.012 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = sx * (hw - 0.06), z = sz * (hl - 0.2); p.cyl('rubber', 0.055, 0.035, [x, 0.055, z], [0, 0, PI / 2], 12); p.slab('black', x - 0.022, x + 0.022, 0.055, 0.13, z - 0.022, z + 0.022, { r: 0.006 }); }
  // crossed legs each side, up to the deck frame
  const lz = hl - 0.35, ly = (0.17 + deck - 0.05) / 2, dy = deck - 0.05 - 0.17, l = Math.hypot(2 * lz, dy), a = Math.atan2(dy, 2 * lz);
  for (const sx of [-1, 1]) for (const s of [-1, 1]) p.box('rail', [0.03, 0.03, l], [sx * (hw - 0.06), ly, 0], [s * a, 0, 0], { r: 0.008 });
  // the deck frame, the pad, a pillow, two navy straps, the mark on each side
  p.slab('white', -hw, hw, deck - 0.05, deck, -hl + 0.1, hl - 0.1, { r: 0.015, cell: 0.6 });
  p.slab(SHEET, -hw + 0.02, hw - 0.02, deck, top, -hl + 0.12, hl - 0.12, { r: 0.035, seg: 2, cell: 0.8, loops: [] });
  p.slab(SHEET, -0.2, 0.2, top - 0.01, top + 0.06, -hl + 0.16, -hl + 0.42, { r: 0.03, seg: 2 });
  for (const z of [-0.1, 0.45]) p.slab(NAVY, -hw + 0.005, hw - 0.005, top - 0.012, top + 0.008, z - 0.04, z + 0.04, { r: 0.006 });
  for (const sx of [-1, 1]) pulseLine(p, -0.35, 0.35, deck - 0.025, hw + 0.002, 0.018, sx > 0 ? PI / 2 : -PI / 2);
  // low side rails, push bars round both ends
  for (const sx of [-1, 1]) p.slab('rail', sx * (hw + 0.01) - 0.01, sx * (hw + 0.01) + 0.01, deck + 0.08, deck + 0.1, -hl + 0.35, hl - 0.35, { r: 0.008, cell: 0.8 });
  for (const sz of [-1, 1]) {
    const path = [[-hw + 0.04, deck - 0.02, sz * (hl - 0.12)], [-hw + 0.04, deck + 0.12, sz * (hl - 0.02)], [hw - 0.04, deck + 0.12, sz * (hl - 0.02)], [hw - 0.04, deck - 0.02, sz * (hl - 0.12)]];
    for (let i = 0; i < 3; i++) { const [a0, a1] = [path[i], path[i + 1]], d = new THREE.Vector3(...a1).sub(new THREE.Vector3(...a0)), L = d.length(); const g = new THREE.Vector3(...a0).add(new THREE.Vector3(...a1)).multiplyScalar(0.5); p.box('rail', i === 1 ? [L + 0.02, 0.024, 0.024] : [0.024, 0.024, L + 0.01], g.toArray(), i === 1 ? null : [Math.atan2(-d.y, d.z), 0, 0], { r: 0.01 }); }
  }
}
