// THE CONTROL ROOM at the top of the tower (kit/places-plan.js TOWER, DESKS has the game's maker's words and the
// numbers): layout 1 of the agreed drawing, the lift in the middle and a desk at each side, big windows all round.
//   controlRoom  a CELL piece, the whole room but its desks and the lift: the floor, the eight walls (four long ones
//                and four across the cut corners) with their windows, a post at each corner, a cove of light from the
//                walls' top up to a flat ceiling with its lights. Its frame is the room's middle, on its floor.
//   console      a FREE piece, one of the four desks: 'radio' (the radio desk: the antenna and the other station's
//                signal), 'traffic' (ships in and out), 'readouts' (the station's air and power), 'announce' (where
//                the pages come from). A long low desk, its front (where people sit) facing +z, its back to the
//                windows, low screens so the view is over them, lit buttons, its name along its front.
// Nothing here is a game: the desks are where games may come later.
import * as THREE from 'three';
import { MeshData, bevelBox, put, lathe } from './geo.js';
import { FLOOR_RECT, SCREEN_RECT } from './tex.js';
import { segText, textWidth } from './shipparts/cabin/segtext.js';
import { subInto } from './lift.js';
import { TOWER, towerCorners, DESK } from './places-plan.js';

const PI = Math.PI;
const FLOORY = 0, TOPY = TOWER.top - TOWER.floor, CEILY = TOWER.ceiling - TOWER.floor;

// ── flat grids over a convex outline (a floor of the floor's plates, a ceiling of panels) ────────────────────────────
// the outline [[x, z], ...] (either way round); every `step` metres a small square, cut to the outline
function clipPoly(pts, poly) {
  // Sutherland-Hodgman against each edge of a convex outline (made counter-clockwise seen from above, +y)
  let area = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const P = area < 0 ? poly : poly.slice().reverse();
  let out = pts;
  for (let i = 0; i < P.length && out.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], inside = (q) => (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) <= 1e-9, list = out; out = [];
    for (let k = 0; k < list.length; k++) {
      const c = list[k], d = list[(k + 1) % list.length], ci = inside(c), di = inside(d);
      if (ci) out.push(c);
      if (ci !== di) { const ex = b[0] - a[0], ez = b[1] - a[1], fx = d[0] - c[0], fz = d[1] - c[1], den = ex * fz - ez * fx; if (Math.abs(den) > 1e-12) { const t = -(ex * (c[1] - a[1]) - ez * (c[0] - a[0])) / den; out.push([c[0] + fx * t, c[1] + fz * t]); } }
    }
  }
  return out;
}
// the cells of a grid (cells `cell` m, their edges on odd metres, as the station's floor tiles) the outline covers,
// each cut in `n` x `n` small squares and those cut to the outline: fn(square's points, the cell's corner x, z)
function eachSquare(poly, cell, n, fn, skip) {
  const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
  const i0 = Math.floor((Math.min(...xs) + 1) / cell), i1 = Math.ceil((Math.max(...xs) + 1) / cell), k0 = Math.floor((Math.min(...zs) + 1) / cell), k1 = Math.ceil((Math.max(...zs) + 1) / cell), s = cell / n;
  for (let i = i0; i < i1; i++) for (let k = k0; k < k1; k++) {
    const cx = i * cell - 1, cz = k * cell - 1;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const x0 = cx + a * s, z0 = cz + b * s;
      if (skip && skip(x0 + s / 2, z0 + s / 2)) continue;
      const q = clipPoly([[x0, z0], [x0 + s, z0], [x0 + s, z0 + s], [x0, z0 + s]], poly);
      if (q.length >= 3) fn(q, cx, cz);
    }
  }
}
// A FLOOR of the station's floor plates over an outline: each 2 m cell its own plate of the floor's picture (`region`
// of kit/tex.js FLOOR_RECT), cut to the outline, at height y. Squares where skip(x, z) is true are left out.
export function floorOver(p, poly, region = 'deck', { y = 0, n = 3, skip = null } = {}) {
  const [a, b, c, d] = FLOOR_RECT[region], inset = 1.5 / 1024, m = new MeshData();
  eachSquare(poly, 2, n, (q, cx, cz) => {
    const base = m.count;
    for (const [x, z] of q) m.v(x, y, z, 0, 1, 0, a + inset + (c - a - 2 * inset) * (x - cx) / 2, b + inset + (d - b - 2 * inset) * (z - cz) / 2);
    for (let i = 1; i < q.length - 1; i++) m.ix.push(base, base + i + 1, base + i);
  }, skip);
  return p.add('floor', m.geometry());
}
// A FLAT FACE of a surface over an outline (a ceiling: facing down), in squares `step` m across (for its light)
export function flatOver(p, poly, look, { y = 0, down = false, step = 1, skip = null, mat = 'solid' } = {}) {
  const m = new MeshData();
  eachSquare(poly, step, 1, (q) => {
    const base = m.count;
    for (const [x, z] of q) m.v(x, y, z, 0, down ? -1 : 1, 0, x, z);
    for (let i = 1; i < q.length - 1; i++) m.ix.push(base, base + i + 1, base + i);
  }, skip);
  return p.add(mat, m.geometry(), look);
}
// a four-cornered face from its corners (in order round it), facing n
function quad(p, look, pts, n, mat = 'solid') {
  const m = new MeshData(); for (const q of pts) m.v(q[0], q[1], q[2], n[0], n[1], n[2], q[0] + q[2], q[1]); m.quad(0, 1, 2, 3);
  return p.add(mat, m.geometry(), look);
}

// ── one wall of the control room, in its own frame: x along it (-L/2 .. L/2), its face on z = 0, the room in +z ────
const T = TOWER.thick, SILL = TOWER.sill, HEAD = TOWER.head, MUL = TOWER.mullion, END = 0.35;
export function windowsOf(L) {
  const n = L > 7 ? 3 : 2, w = (L - 2 * END - (n - 1) * MUL) / n, out = [];
  for (let i = 0; i < n; i++) { const x0 = -L / 2 + END + i * (w + MUL); out.push([x0, x0 + w]); }
  return out;
}
function towerWall(q, L) {
  const wins = windowsOf(L), x0 = -L / 2, x1 = L / 2;
  // the foot, up to the low sill (the windows come down near the floor: the station's roof is seen below them), a line
  // of light along it
  q.slab('black', x0, x1, 0, SILL, -T, 0.03, { r: 0.012, skip: ['-z'] });
  q.slab('black', x0, x1, SILL, SILL + 0.05, -T, 0.07, { r: 0.012 });
  q.glowSlab('soft', x0 + 0.1, x1 - 0.1, 0.06, 0.075, 0.03, 0.036);
  for (let x = x0 + 0.6; x < x1 - 0.3; x += 1.2) q.light([x, 0.08, 0.2], 0.2, [0.85, 0.92, 1], [0, 0.4, 1], 2.2);
  // the uprights between the windows and at the ends, and the head over them
  const posts = [[x0, wins[0][0]], ...wins.slice(0, -1).map(([, b], i) => [b, wins[i + 1][0]]), [wins[wins.length - 1][1], x1]];
  for (const [a, b] of posts) q.slab('black', a, b, SILL + 0.06, HEAD, -T, 0.03, { r: 0.012 });
  q.slab('black', x0, x1, HEAD, HEAD + 0.08, -T, 0.04, { r: 0.012 });
  q.slab('white2', x0 + 0.006, x1 - 0.006, HEAD + 0.08, TOPY, -T, 0, { r: 0.008, skip: ['-z'] });
  // the glass, set back in the wall
  for (const [a, b] of wins) q.glass(b - a, HEAD - SILL - 0.06, [(a + b) / 2, (SILL + 0.06 + HEAD) / 2, -T * 0.55]);
}

export function controlRoom(p) {
  const C = towerCorners(), n = C.length, ROOM = towerCorners(TOWER.half + T, TOWER.leg + T * (2 - Math.SQRT2));
  // the floor, out under the walls, but not under the lift (its own floor stands over it)
  // (the terminal's own floor: dark polished plates, a metre square, a fine dark seam between them)
  const under = (x, z) => Math.abs(x) < 1.18 && Math.abs(z) < 1.18;
  flatOver(p, ROOM, PLATES, { y: FLOORY, step: 1, skip: under });
  for (let t = -8; t <= 8; t += 2) { p.slab('dark', t - 0.008, t + 0.008, FLOORY, FLOORY + 0.002, -TOWER.half + 0.1, TOWER.half - 0.1, { r: 0, cell: 9 }); p.slab('dark', -TOWER.half + 0.1, TOWER.half - 0.1, FLOORY, FLOORY + 0.002, t - 0.008, t + 0.008, { r: 0, cell: 9 }); }
  // the walls, each with its windows; a post at each corner
  for (let i = 0; i < n; i++) {
    const a = C[i], b = C[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L, inward = nx * mx + nz * mz < 0 ? 1 : -1;     // (the side toward the middle)
    subInto(p, (q) => towerWall(q, L), [mx, 0, mz], Math.atan2(nx * inward, nz * inward));
  }
  for (const [x, z] of C) { const g = bevelBox([0.42, TOPY, 0.42], [0, 0, 0], { r: 0.03, seg: 2, cell: 1.5 }); put(g, [x * (1 + 0.06 / TOWER.half), TOPY / 2, z * (1 + 0.06 / TOWER.half)], [0, Math.atan2(x, z), 0]); p.add('solid', g, 'black'); }
  // the cove: from the walls' top in and up to the ceiling's edge, a strip of light along its foot washing it
  const IN = CEILY - TOPY, CC = towerCorners(TOWER.half - IN, TOWER.leg - IN * (2 - Math.SQRT2));
  for (let i = 0; i < n; i++) {
    const a = C[i], b = C[(i + 1) % n], c = CC[(i + 1) % n], d = CC[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L; if (nx * (a[0] + b[0]) + nz * (a[1] + b[1]) > 0) { nx = -nx; nz = -nz; }
    quad(p, 'white2', [[a[0], TOPY, a[1]], [b[0], TOPY, b[1]], [c[0], CEILY, c[1]], [d[0], CEILY, d[1]]], [nx * Math.SQRT1_2, -Math.SQRT1_2, nz * Math.SQRT1_2]);
    // the strip: a dark channel along the wall's top, a line of light in it
    const ax = a[0] + nx * 0.12, az = a[1] + nz * 0.12, bx = b[0] + nx * 0.12, bz = b[1] + nz * 0.12;
    const g = bevelBox([L - 0.5, 0.012, 0.03], [0, 0, 0], { r: 0.002, seg: 1, cell: 9 }); put(g, [(ax + bx) / 2, TOPY + 0.03, (az + bz) / 2], [0, Math.atan2(bx - ax, bz - az) - PI / 2, 0]); p.add('glow', g, 'strip');
    for (let t = 0.12; t < 1; t += 0.25) p.light([ax + (bx - ax) * t, TOPY + 0.12, az + (bz - az) * t], 0.9, [1, 0.97, 0.92], [nx * 0.5, 0.86, nz * 0.5], 5);
  }
  // the ceiling: flat white panels, and its lamps: a ring of eight round the lift, one over each desk
  flatOver(p, CC, 'white', { y: CEILY, down: true, step: 1 });
  const lamp = (x, z, w, d) => {
    p.slab('dark', x - w / 2 - 0.05, x + w / 2 + 0.05, CEILY - 0.03, CEILY - 0.005, z - d / 2 - 0.05, z + d / 2 + 0.05, { r: 0.004, skip: ['+y'], cell: 1.5 });
    p.glowSlab('soft', x - w / 2, x + w / 2, CEILY - 0.045, CEILY - 0.03, z - d / 2, z + d / 2);
    p.light([x, CEILY - 0.15, z], 6 * w * d, [1, 0.97, 0.93], [0, -1, 0], 10);
  };
  for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8, r = 3.6; lamp(Math.cos(a) * r, Math.sin(a) * r, 0.9, 0.9); }
  for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4, r = 6.2; lamp(Math.cos(a) * r, Math.sin(a) * r, 0.8, 0.8); }
  lamp(-5.4, 0, 0.5, 2.4); lamp(5.4, 0, 0.5, 2.4); lamp(0, -5.4, 2.4, 0.5); lamp(0, 5.4, 2.4, 0.5);
}

// ── the desks ──────────────────────────────────────────────────────────────────────────────────────────────────────
const NAMES = { radio: 'RADIO', traffic: 'TRAFFIC CONTROL', readouts: 'STATION READOUTS', announce: 'ANNOUNCEMENTS' };
const TOPC = { c: '#2a2e35', r: 0.35, m: 0.4, w: 0.3 }, PLATES = { c: '#5f6368', r: 0.34, m: 0.35, w: 0.45 };      // the desk's top: dark, a little shiny
const BTN = ['green', 'amber', 'blue', 'red', 'soft'];
export function deskConsole(p, v) {
  const L = 6.4, hl = L / 2, D = DESK.deep, h = DESK.h, zb = -D / 2, zf = D / 2;
  // the body: a cabinet at the back half (knee room in front), white sides, a dark plinth
  p.slab('white', -hl, hl, 0.1, h - 0.04, zb, zb + 0.5, { r: 0.012, cell: 1.5 });
  p.slab('black', -hl + 0.02, hl - 0.02, 0, 0.1, zb + 0.02, zb + 0.48, { r: 0.01, cell: 1.5 });
  for (const x of [-hl, hl]) p.slab('white2', x - 0.04, x + 0.04, 0, h - 0.04, zb, zf - 0.04, { r: 0.012 });
  p.slab(TOPC, -hl - 0.04, hl + 0.04, h - 0.04, h, zb - 0.02, zf, { r: 0.015, cell: 1.5 });
  // its name along its front lip, in lit letters
  const name = NAMES[v] || v.toUpperCase();
  segText(p, name, { h: 0.045, t: 0.007, at: [0, h - 0.02, zf + 0.002], look: 'soft', mat: 'glow' });
  // the screens: a low sloped bank along the back, so the windows are seen over it
  const tilt = -0.42, bh = 0.42, by = h + Math.cos(tilt) * bh / 2, bz = zb + 0.16;
  const bank = bevelBox([L - 0.1, bh, 0.08], [0, 0, 0], { r: 0.012, cell: 1.5 }); put(bank, [0, by, bz], [tilt, 0, 0]); p.add('solid', bank, 'black');
  const face = (x, w, rect, gain = 1.15) => { const k = 0.044; p.screen(rect, w, bh - 0.08, [x, by - k * Math.sin(tilt), bz + k * Math.cos(tilt)], [tilt, 0, 0], gain); };
  const screens = { radio: [[-1.9, 'terminal'], [1.9, 'status']], traffic: [[-1.5, 'radar'], [1.5, 'radar']], readouts: [[-1.9, 'status'], [0, 'status'], [1.9, 'terminal']], announce: [[-1.6, 'terminal'], [1.6, 'status']] }[v] || [];
  for (const [x, r] of screens) face(x, 0.66, SCREEN_RECT[r]);
  // rows of lit buttons on the top, each desk its own pattern
  const seed = { radio: 3, traffic: 7, readouts: 11, announce: 5 }[v] || 1; let s = seed;
  const R = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let row = 0; row < 2; row++) for (let i = 0; i < 14; i++) {
    if (R() < 0.3) continue;
    const x = -hl + 0.5 + i * 0.42 + (row ? 0.2 : 0), z = zb + 0.42 + row * 0.1;
    if (Math.abs(x) < 0.55 && v === 'announce') continue;
    p.slab('black', x - 0.05, x + 0.05, h, h + 0.012, z - 0.03, z + 0.03, { r: 0.004, cell: 9 });
    p.add('glow', put(bevelBox([0.06, 0.006, 0.03], [0, 0, 0], { r: 0.002, seg: 1, cell: 9 }), [x, h + 0.015, z]), BTN[Math.floor(R() * BTN.length)]);
  }
  if (v === 'radio') {
    // the radio: a big dial and two sliders between its screens, and the signal drawn as a wave in a little window
    p.lathe('grey', [[0.001, 0], [0.11, 0], [0.11, 0.035], [0.09, 0.05], [0.001, 0.05]], 24, [0, h, zb + 0.4]);
    p.slab('black', -0.5, 0.5, h + 0.001, h + 0.008, zb + 0.18, zb + 0.3, { r: 0.003, cell: 9 });
    const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24, x = -0.45 + t * 0.9; pts.push([x, h + 0.01, zb + 0.24 + Math.sin(t * PI * 6) * 0.03 * Math.sin(t * PI)]); }
    for (let i = 0; i < pts.length - 1; i++) { const [ax, ay, az] = pts[i], [bx, , bz] = pts[i + 1], g = bevelBox([Math.hypot(bx - ax, bz - az) + 0.004, 0.003, 0.006], [0, 0, 0], { r: 0, cell: 9 }); put(g, [(ax + bx) / 2, ay, (az + bz) / 2], [0, -Math.atan2(bz - az, bx - ax), 0]); p.add('glow', g, 'green'); }
    for (const x of [0.75, 0.95]) { p.slab('dark', x - 0.02, x + 0.02, h, h + 0.01, zb + 0.3, zb + 0.5, { r: 0.004 }); p.slab('grey', x - 0.03, x + 0.03, h, h + 0.04, zb + 0.36, zb + 0.4, { r: 0.008 }); }
    p.light([0, h + 0.3, zb + 0.4], 0.25, [0.4, 1, 0.5], [0, 0.4, 1], 2);
  }
  if (v === 'announce') {
    // the station's microphone on its stalk, and a big round button to speak
    p.cyl('black', 0.07, 0.03, [0, h + 0.015, zb + 0.4], null, 18);
    p.cyl('rail', 0.009, 0.32, [0, h + 0.18, zb + 0.4], null, 10);
    p.lathe('black', [[0.001, -0.06], [0.03, -0.055], [0.032, 0.03], [0.02, 0.06], [0.001, 0.062]], 16, [0, h + 0.36, zb + 0.45], [0.5, 0, 0]);
    p.cyl('red', 0.05, 0.02, [0.32, h + 0.01, zb + 0.42], null, 18);
    p.add('glow', put(bevelBox([0.07, 0.006, 0.07], [0, 0, 0], { r: 0.02, seg: 2, cell: 9 }), [0.32, h + 0.022, zb + 0.42]), 'red');
  }
  for (const [x] of screens) p.light([x, h + 0.35, zb + 0.5], 0.35, [0.45, 0.75, 1], [0, 0, 1], 2.5);
}

export const TOWER_PIECES = {
  controlRoom: { name: 'Control room', group: 'Tower', at: 'cell', variants: ['layout 1'], foot: [16, 4.2, 16], build: controlRoom },
  console: { name: 'Control room desk', group: 'Tower', at: 'free', variants: ['radio', 'traffic', 'readouts', 'announce'], foot: [6.5, 1.3, 1.1], build: deskConsole },
};
export { textWidth, lathe };
