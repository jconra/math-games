// BIG ROOMS: the pieces for two-storey rooms (the terminal, the hangar), in the corridor's look. Their walls are the
// ordinary 3 m panels stacked (deck 0 and deck 1) with the 1 m filler band between (windows.js); these are the rest.
//   column      'round' (free-standing, 7 m), 'square' (free-standing, a strip on each face), 'post' (4 m, under a
//               catwalk's edge). POINT pieces.
//   ceilbig     a CELL piece, the ceiling of a big room at 7 m: 'coffer', 'light' (a big glowing panel), 'truss' (a
//               charcoal truss across the cell, so a row of them makes one across the room, with a light bar under
//               it), 'deck' (dark ribbed decking, for a hangar), 'hangar' (the same with a truss)
//   catwalk     a CELL piece at the upper deck's level (4 m): a grated deck, the railing on its open sides, a bracket to
//               the wall: 'run' (rail on +z), 'corner' (+z and +x), 'end' (+x), 'bridge' (+z and -z), 'landing' (none)
//   rail        an EDGE railing on the floor (a raised floor's edge): 'run', 'end' (with its last post)
//   plinth      an EDGE piece: the face of a floor raised 0.72 m (four steps), with a lit nosing
//   stairs      'flight' (4 m up over three cells, 22 steps of 0.18 m) and 'step4' (0.72 m up in one cell, 4 steps)
//   ramp        'ramp3': 0.72 m up over three cells (1 in 8)
//   opening     a POINT piece in a big room's wall: where a 4 m corridor opens into it (the storey's full 3 m height),
//               framed; the filler band and the upper storey's panels go over it
// Big flat faces here take bigger steps between vertices than the corridor's (the bake still gets enough vertices to
// darken corners): see `BIG`.
import * as THREE from 'three';
import { WALL_FACE as WF, RIB_FACE as RF, ROOM_H as H, DECK_H } from './grid.js';
import { rrect, circle, line, plane, put, MeshData, fixWinding } from './geo.js';
import { slabRow, band, backing, slant, floorQuad, floorSkirt, G, Z0, BAND, TOP } from './shell.js';
import { BIG_H } from './windows.js';
import { FLOOR_RECT } from './tex.js';
import { kitTextures } from './materials.js';

const PI = Math.PI;
const BIG = { cell: 1.0, loops: [0.06] };         // the coarser step across big panels (the corner darkening still gets a row near each edge)
const PLAZA = { c: '#5f6368', r: 0.34, m: 0.35, w: 0.45 };   // the terminal's floor plates: dark polished metal
const PLAZA2 = { c: '#4c5055', r: 0.36, m: 0.4, w: 0.5 };
export const STEP = 0.18;                          // a step's rise, everywhere
export const RAISE = 4 * STEP;                     // a raised floor: four steps up (0.72 m)

// ── columns ───────────────────────────────────────────────────────────────────────────────────────────────────────
function strip(p, x, y0, y1, z, w = 0.011, surf = 'dark') {
  p.slab(surf, x - 0.03, x + 0.03, y0 - 0.06, y1 + 0.06, z - 0.01, z + 0.012, { r: 0.006 });
  p.glowSlab('white', x - w, x + w, y0, y1, z + 0.012, z + 0.017);
  for (let y = y0 + 0.3; y < y1; y += 0.7) p.light([x, y, z + 0.08], 1.1, [1, 0.98, 0.95], [0, 0, 1], 6);
}
export function column(p, v) {
  if (v === 'round') {
    // a smooth off-white drum on a charcoal base, a lit ring at head height and one near the top
    p.lathe('black', [[0, 0], [0.42, 0], [0.42, 0.22], [0.36, 0.3], [0.001, 0.3]], 28);
    p.lathe('white2', [[0.3, 0.29], [0.3, BIG_H - 0.5], [0.001, BIG_H - 0.5]], 28);
    p.lathe('black', [[0.001, BIG_H - 0.52], [0.36, BIG_H - 0.52], [0.42, BIG_H - 0.42], [0.42, BIG_H], [0.001, BIG_H]], 28);
    for (const y of [2.5, 5.6]) {
      p.lathe('black', [[0.001, y - 0.09], [0.315, y - 0.09], [0.315, y + 0.09], [0.001, y + 0.09]], 28);
      const g = new THREE.CylinderGeometry(0.318, 0.318, 0.03, 28, 1, true); put(g, [0, y, 0]); p.add('glow', g, 'white');
      for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2; p.light([Math.cos(a) * 0.45, y, Math.sin(a) * 0.45], 0.9, [1, 0.98, 0.95], [Math.cos(a), 0, Math.sin(a)], 6); }
    }
    return;
  }
  const top = v === 'post' ? DECK_H - 0.28 : BIG_H, hw = v === 'post' ? 0.15 : 0.25;
  p.slab('black', -hw, hw, 0, top, -hw, hw, { r: 0.03, ...BIG });
  p.slab('black', -hw - 0.04, hw + 0.04, 0, 0.14, -hw - 0.04, hw + 0.04, { r: 0.014 });
  if (v === 'post') { p.slab('black', -hw - 0.05, hw + 0.05, top - 0.12, top, -hw - 0.05, hw + 0.05, { r: 0.014 }); strip(p, 0, 0.7, 2.6, hw, 0.009); return; }
  for (let k = 0; k < 4; k++) { const q = new (p.constructor)(); strip(q, 0, 0.8, 6.2, hw); turnParts(p, q, k * PI / 2); }
}

// ── the big ceiling ───────────────────────────────────────────────────────────────────────────────────────────────
const CF = 0.06;
function coffer(p, inner, surf = 'grey2', back = 'grey') {
  // a frame of panels round a recess (the recess holds a panel, a light or nothing). Seven metres up, so its edges are
  // sharp and its faces take big steps: a ceiling of them stays cheap
  const a = 0.62, Y = BIG_H, o = { r: 0, skip: ['+y'], cell: 1.0, loops: [] }, e = { r: 0, cell: 2, loops: [] };
  p.slab('dark', -1, 1, Y + 0.3, Y + 0.32, -1, 1, { r: 0, skip: ['+y'], cell: 9, loops: [] });
  p.slab(surf, -1 + G, 1 - G, Y, Y + CF, -1 + G, -a, o); p.slab(surf, -1 + G, 1 - G, Y, Y + CF, a, 1 - G, o);
  p.slab(surf, -1 + G, -a, Y, Y + CF, -a + G, a - G, o); p.slab(surf, a, 1 - G, Y, Y + CF, -a + G, a - G, o);
  for (const [x0, x1, z0, z1] of [[-a, a, -a, -a + 0.03], [-a, a, a - 0.03, a], [-a, -a + 0.03, -a, a], [a - 0.03, a, -a, a]]) p.slab('black', x0, x1, Y + 0.01, Y + 0.26, z0, z1, e);
  if (inner === 'panel') p.slab(back, -a + 0.03, a - 0.03, Y + 0.22, Y + 0.26, -a + 0.03, a - 0.03, { ...o, cell: 0.7 });
  if (inner === 'light') {
    p.slab('dark', -a + 0.03, a - 0.03, Y + 0.24, Y + 0.27, -a + 0.03, a - 0.03, { ...e, skip: ['+y'] });
    p.glowSlab('soft', -a + 0.08, a - 0.08, Y + 0.2, Y + 0.22, -a + 0.08, a - 0.08);
    p.light([0, Y - 0.1, 0], 20, [1, 0.98, 0.95], [0, -1, 0], 10);   // (a pool of light on the floor under it)
  }
}
function truss(p, dark) {
  // a charcoal truss along x through the cell's middle: chords top and bottom, posts at each end, a diagonal between,
  // and a light bar under the bottom chord
  const yb = BIG_H - 0.95, yt = BIG_H - 0.08, o = { r: 0.014, cell: 3, loops: [] };
  for (const z of [-0.12, 0.12]) {
    p.slab('black', -1, 1, yt - 0.1, yt, z - 0.04, z + 0.04, o); p.slab('black', -1, 1, yb, yb + 0.1, z - 0.04, z + 0.04, o);
    p.slab('black', -1, -0.92, yb, yt, z - 0.035, z + 0.035, o);
    const len = Math.hypot(1.84, yt - yb - 0.2), ang = Math.atan2(yt - yb - 0.2, 1.84);
    p.box('black', [len, 0.06, 0.06], [0.04, (yb + yt) / 2, z], [0, 0, (z > 0 ? 1 : -1) * ang], o);
  }
  for (const x of [-0.96, 0]) p.slab('black', x - 0.03, x + 0.03, yb + 0.02, yb + 0.08, -0.12, 0.12, { r: 0.008 });
  p.slab('black', -1, 1, yt, BIG_H + 0.3, -0.05, 0.05, { r: 0.01, cell: 3, loops: [] });               // (hung from the deck above)
  p.slab(dark ? 'black' : 'dark', -0.98, 0.98, yb - 0.08, yb, -0.09, 0.09, { r: 0.012, cell: 3, loops: [] });
  p.glowSlab('white', -0.96, 0.96, yb - 0.085, yb - 0.08, -0.05, 0.05);
  for (const x of [-0.5, 0.5]) p.light([x, yb - 0.2, 0], 5, [1, 0.98, 0.95], [0, -1, 0], 10);
}
export function ceilBig(p, v) {
  if (v === 'light') { coffer(p, 'light'); return; }
  if (v === 'truss') { coffer(p, 'panel'); truss(p, false); return; }
  if (v === 'hangar' || v === 'deck') {
    // dark ribbed decking: a plate with ribs across it ('hangar': and a truss)
    p.slab('grey', -1, 1, BIG_H + 0.18, BIG_H + 0.22, -1, 1, { r: 0, skip: ['+y'], cell: 0.7, loops: [] });
    for (const x of [-0.75, -0.25, 0.25, 0.75]) p.slab('black', x - 0.06, x + 0.06, BIG_H, BIG_H + 0.18, -1, 1, { r: 0, skip: ['+y'], cell: 2, loops: [] });
    if (v === 'hangar') truss(p, true); return;
  }
  coffer(p, 'panel');
}

// ── railings ──────────────────────────────────────────────────────────────────────────────────────────────────────
// a railing along x from x0 to x1 on the line z (its posts at each metre from x0, and one at x1 if `last`), standing
// on height y
const RH = 1.05;
function railing(p, x0, x1, z, y, last = false) {
  const o = { r: 0.012, cell: 0.8 };
  for (let x = x0; x < x1 - 0.01; x += 1) postAt(p, x, z, y);
  if (last) postAt(p, x1, z, y);
  p.slab('white2', x0, x1, y + RH - 0.06, y + RH, z - 0.035, z + 0.035, { r: 0.025, seg: 2, cell: 0.8 });
  p.slab('rail', x0, x1, y + 0.52, y + 0.56, z - 0.016, z + 0.016, o);
  p.slab('black', x0, x1, y, y + 0.12, z - 0.012, z + 0.012, o);
}
function postAt(p, x, z, y) { p.slab('rail', x - 0.025, x + 0.025, y, y + RH - 0.03, z - 0.025, z + 0.025, { r: 0.01, cell: 0.8 }); }
function turnParts(p, q, rot) { for (const part of q.parts) { put(part.geo, [0, 0, 0], [0, rot, 0]); p.parts.push(part); } for (const L of q.lights) { const c = Math.cos(rot), s = Math.sin(rot); p.lights.push({ ...L, at: [L.at[0] * c + L.at[2] * s, L.at[1], -L.at[0] * s + L.at[2] * c], dir: L.dir && [L.dir[0] * c + L.dir[2] * s, L.dir[1], -L.dir[0] * s + L.dir[2] * c] }); } }
export function rail(p, v) { railing(p, -1, 1, 0.08, 0, v === 'end'); }
export function plinth(p) {
  // the face of a raised floor: an off-white panel, a charcoal foot, a lit nosing along the top
  p.slab('white', -1 + G, 1 - G, 0.36, RAISE - 0.05, -0.1, 0.03, { r: 0.008, skip: ['-z'], cell: 0.7 });
  p.slab('band', -1 + G, 1 - G, 0.12, 0.36, -0.1, 0.02, { r: 0.006, skip: ['-z'], cell: 0.7 });
  for (let k = 0; k < 6; k++) { const x = -0.75 + k * 0.3; p.slab('dark', x - 0.1, x + 0.1, 0.19, 0.29, 0.02, 0.026, { r: 0.004 }); }
  p.slab('black', -1, 1, 0, 0.12, -0.1, 0.05, { r: 0.01, skip: ['-z'], cell: 0.7 });
  p.slab('black', -1, 1, RAISE - 0.05, RAISE, -0.1, 0.05, { r: 0.01, cell: 0.7 });
  p.glowSlab('white', -0.98, 0.98, RAISE - 0.035, RAISE - 0.02, 0.05, 0.054);
  for (const x of [-0.5, 0.5]) p.light([x, RAISE - 0.1, 0.25], 0.35, [0.92, 0.96, 1], [0, -0.6, 0.8], 2.5);
}

// ── the catwalk ───────────────────────────────────────────────────────────────────────────────────────────────────
const DY = DECK_H;   // its deck at the upper deck's level
export function catwalk(p, v) {
  floorQuad(p, 'grating', -1, 1, -1, 1, DY - 0.008, { v0: 0, v1: 1 });
  p.slab('dark', -1, 1, DY - 0.2, DY - 0.17, -1, 1, { r: 0, cell: 9 });
  const o = { r: 0.014, cell: 0.8 }, rails = { run: ['+z'], corner: ['+z', '+x'], end: ['+x'], bridge: ['+z', '-z'], landing: [] }[v] || ['+z'];
  // edge beams: a fascia with a glow line on each open side, a plain beam on the others
  for (const side of ['+z', '-z', '+x', '-x']) {
    const q = new (p.constructor)(), open = rails.includes(side);
    q.slab('black', -1, 1, DY - 0.32, DY - 0.008, 0.92, 1, o);
    if (open) railing(q, -1, 1, 0.94, DY, side === '+x' || v === 'end');
    turnParts(p, q, { '+z': 0, '-x': -PI / 2, '-z': PI, '+x': PI / 2 }[side]);
  }
  // cross beams under the deck, and a bracket from the wall (on the -z side) up under the middle one (the cell's
  // middle, clear of the wall's ribs on the cell lines)
  p.slab('black', -1, -0.9, DY - 0.3, DY - 0.01, -1, 1, o); p.slab('black', -0.05, 0.05, DY - 0.24, DY - 0.01, -1, 1, o);
  if (!rails.includes('-z')) {
    const len = Math.hypot(1.7, 1.0), ang = Math.atan2(1.0, 1.7);
    p.box('black', [0.1, 0.12, len], [0, DY - 0.82, -1 + WF + 0.85], [-ang, 0, 0], o);
    p.slab('black', -0.13, 0.13, DY - 1.42, DY - 1.18, -1 + WF - 0.05, -1 + WF + 0.06, { r: 0.012 });
  }
}

// ── stairs and ramps ──────────────────────────────────────────────────────────────────────────────────────────────
// a flight from z = z0 (at y = 0) to z = z1 (at y = rise), n steps, width 2*hw; open: rails both sides
function flight(p, n, rise, z0, z1, hw, { rails = true, nosing = true } = {}) {
  const r = rise / n, g = (z0 - z1) / n;
  for (let k = 0; k < n; k++) {
    const zf = z0 - k * g, zb = zf - g, y = (k + 1) * r;
    p.slab('white2', -hw + 0.02, hw - 0.02, y - 0.05, y, zb - 0.002, zf + 0.025, { r: 0.008, cell: 0.8, loops: [0.05] });     // the tread
    p.slab('dark', -hw + 0.03, hw - 0.03, y - r, y - 0.05, zf - 0.02, zf, { r: 0.004, cell: 0.8, loops: [] });               // the riser
    if (nosing) p.glowSlab('white', -hw + 0.08, hw - 0.08, y - 0.012, y - 0.004, zf + 0.025, zf + 0.029);
    if (k % 4 === 1) p.light([0, y + 0.15, zf + 0.15], 0.25, [0.92, 0.96, 1], [0, 0.3, 0.95], 2);
  }
  // the stringers each side, and the underside: sloped plates
  const len = Math.hypot(z0 - z1, rise), ang = Math.atan2(rise, z0 - z1), mz = (z0 + z1) / 2, my = rise / 2;
  for (const s of [-1, 1]) p.box('black', [0.07, 0.34, len + 0.12], [s * (hw + 0.035), my - 0.04, mz], [ang, 0, 0], { r: 0.014, cell: 0.8 });
  p.box('white', [2 * hw, 0.04, len], [0, my - 0.2 * Math.cos(ang) - 0.05, mz - 0.2 * Math.sin(ang)], [ang, 0, 0], { r: 0.008, ...BIG });
  if (rails) for (const s of [-1, 1]) {
    // posts every metre or so along the slope, a sloped top rail, a mid rail
    const np = Math.max(2, Math.round((z0 - z1) / 1.1));
    for (let i = 0; i <= np; i++) { const z = z0 - (z0 - z1) * i / np, y = rise * i / np; p.slab('black', s * hw - 0.03 + s * 0.035, s * hw + 0.03 + s * 0.035, y + 0.1, y + 0.1 + RH - 0.03, z - 0.03, z + 0.03, { r: 0.01, cell: 0.8 }); }
    for (const [h, surf, w] of [[RH + 0.07, 'black', 0.07], [0.62, 'rail', 0.035]]) p.box(surf, [w, w, len + 0.06], [s * (hw + 0.035), my + h, mz], [ang, 0, 0], { r: w * 0.35, cell: 0.8 });
    { const g = new THREE.BoxGeometry(0.02, 0.008, len - 0.1); put(g, [s * (hw + 0.035), my + RH + 0.03, mz], [ang, 0, 0]); p.add('glow', g, 'soft'); }
  }
}
export function stairs(p, v) {
  if (v === 'step4') {
    // four broad steps up a raised floor's edge, in one cell: from z = +1 (the floor) to the raised floor at z = -0.4
    const n = 4, g = 0.4;
    for (let k = 0; k < n; k++) {
      const zf = 0.8 - k * g, y = (k + 1) * STEP;
      p.slab('gun', -1 + G, 1 - G, 0, y, k === n - 1 ? -1 : zf - g, zf, { r: 0.01, cell: 0.7 });
      p.slab('black', -1 + 0.01, 1 - 0.01, y - 0.03, y, zf - 0.04, zf + 0.004, { r: 0.008, cell: 0.8 });
      p.glowSlab('white', -0.92, 0.92, y - 0.02, y - 0.008, zf + 0.004, zf + 0.008);
    }
    for (const x of [-0.5, 0.5]) p.light([x, 0.5, 1.1], 0.3, [0.92, 0.96, 1], [0, 0.2, 1], 2.5);
    // handrails each side: two posts and a rail sloping with the steps, a pale cap like the other rails
    for (const s of [-1, 1]) {
      const x = s * 0.9, len = Math.hypot(1.25, RAISE), ang = Math.atan2(RAISE, 1.25);
      for (const [z, y] of [[0.85, 0], [-0.4, RAISE]]) p.slab('rail', x - 0.025, x + 0.025, y + 0.02, y + RH - 0.03 + 0.02, z - 0.025, z + 0.025, { r: 0.01 });
      p.box('white2', [0.06, 0.06, len + 0.12], [x, RAISE / 2 + RH - 0.01, 0.225], [ang, 0, 0], { r: 0.022, cell: 0.8 });
    }
    return;
  }
  // a flight up to the upper deck: 22 steps of 0.182 m over 6 m (three cells), 1.6 m wide, from z = +3 to z = -3
  flight(p, 22, DECK_H, 3, -3, 0.8);
}
export function ramp(p) {
  // 0.72 m up over 6 m (three cells), from z = +3 (the floor) to z = -3, tread plate, cheeks and rails both sides
  const rise = RAISE, z0 = 3, z1 = -3, m = new MeshData(), nx = 4, nz = 4, len6 = Math.hypot(z0 - z1, rise);
  const ny = (z0 - z1) / len6, nzn = rise / len6, [ua, va, ub, vb] = FLOOR_RECT.tread, e = 1.5 / 1024;
  // (three 2 m strips, each its own run of the tread plate's square in the floor atlas: the atlas does not repeat)
  for (let seg = 0; seg < 3; seg++) {
    const base = m.count;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const fx = i / nx, fz = (seg + j / nz) / 3, x = -0.94 + 1.88 * fx, z = z0 - (z0 - z1) * fz, y = rise * fz + 0.003;
      m.v(x, y, z, 0, ny, nzn, ua + e + (ub - ua - 2 * e) * (j / nz), va + e + (vb - va - 2 * e) * fx);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const q = base + j * (nx + 1) + i; m.quad(q, q + 1, q + nx + 2, q + nx + 1); }
  }
  p.add('floor', fixWinding(m.geometry()));
  for (const s of [-1, 1]) {
    // the cheek: a wedge of off-white panel from the floor up to the ramp's edge, a charcoal kerb along its top
    const pts = [[z0 + 0.02, 0], [z1, 0], [z1, rise + 0.06], [z0 + 0.02, 0.06]];
    p.extrude('white', pts.map(([z, y]) => [z, y]), 0.08, 0.01).rotateY(-PI / 2).translate(s * 0.98 + 0.04, 0, 0);
    const len = Math.hypot(z0 - z1, rise), ang = Math.atan2(rise, z0 - z1);
    p.box('black', [0.1, 0.06, len + 0.04], [s * 0.98, rise / 2 + 0.06, (z0 + z1) / 2], [ang, 0, 0], { r: 0.012, cell: 0.8 });
    const np = 5;
    for (let i = 0; i <= np; i++) { const z = z0 - (z0 - z1) * i / np, y = rise * i / np + 0.06; p.slab('black', s * 0.98 - 0.03, s * 0.98 + 0.03, y, y + RH - 0.03, z - 0.03, z + 0.03, { r: 0.01, cell: 0.8 }); }
    p.box('black', [0.07, 0.07, len + 0.06], [s * 0.98, rise / 2 + 0.06 + RH, (z0 + z1) / 2], [ang, 0, 0], { r: 0.025, cell: 0.8 });
    p.box('rail', [0.035, 0.035, len], [s * 0.98, rise / 2 + 0.06 + 0.55, (z0 + z1) / 2], [ang, 0, 0], { r: 0.01, cell: 0.8 });
    p.glowSlab('white', s * 0.98 - 0.006, s * 0.98 + 0.006, 0.02, 0.035, z1, z0);   // (a glow line along the foot of each cheek)
    for (let z = z1 + 0.5; z < z0; z += 1.5) p.light([s * 0.8, 0.3, z], 0.3, [0.92, 0.96, 1], [-s, 0.6, 0], 2.5);
  }
}

// ── the opening from a corridor into a big room ───────────────────────────────────────────────────────────────────
// the hole a corridor's end makes in a big room's wall: its outline (x, y), up the left, along the top with the
// corridor's 45-degree corners, down the right
const OW = 1.7, OT = H, OC = 0.42;
export function opening(p) {
  // the room's side (+z): a narrow pier of wall either side of the hole, and the wall face in the corridor's two top
  // corners (the hole runs the storey's full 3 m; the filler band and the upper storey's panels go over it)
  backing(p, -2, -OW, 0, OT); backing(p, OW, 2, 0, OT);
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -2 + G : OW + 0.12, x1 = s < 0 ? -OW - 0.12 : 2 - G;
    p.slab('white', x0, x1, 0.15, TOP, Z0, WF + 0.03, { r: 0.007, skip: ['-z'] });
    p.slab('band', x0, x1, BAND[0] + G, BAND[1] - G, WF + 0.03, WF + 0.045, { r: 0.006 });
    p.slab('white2', x0, x1, TOP, OT, Z0, WF, { r: 0.007, skip: ['-z'] });
    p.slab('black', s < 0 ? -2 : x0, s < 0 ? x1 : 2, 0, 0.15, 0.04, WF + 0.03, { r: 0.012, skip: ['-z'] });
    p.extrude('white2', s < 0 ? [[-OW - 0.01, OT - OC - 0.01], [-OW + OC + 0.01, OT + 0.001], [-OW - 0.01, OT + 0.001]] : [[OW + 0.01, OT - OC - 0.01], [OW + 0.01, OT + 0.001], [OW - OC - 0.01, OT + 0.001]], WF - Z0, 0.004).translate(0, 0, Z0);
  }
  // the frame round the hole: a charcoal lining through the wall's depth (it covers the corridor's last panels), a
  // stepped portal on the room's side with a light strip round its inner edge
  const outline = [[-OW, 0], [-OW, OT - OC], [-OW + OC, OT], [OW - OC, OT], [OW, OT - OC], [OW, 0]];
  const path = (inset, zz) => {
    const out = [];
    for (let i = 0; i < outline.length - 1; i++) {
      const [ax, ay] = outline[i], [bx, by] = outline[i + 1], tx = bx - ax, ty = by - ay, l = Math.hypot(tx, ty), nx = ty / l, ny = -tx / l;   // (n: into the hole)
      // (the profile's x points into the hole, so a profile from 0 to w lines the hole and one from -w to 0 frames it)
      for (const [x, y] of [[ax, ay], [bx, by]]) out.push({ p: new THREE.Vector3(x - nx * inset, y - ny * inset, zz), x: new THREE.Vector3(nx, ny, 0), y: new THREE.Vector3(0, 0, 1) });
    }
    return out;
  };
  p.sweep('black', rrect(0.14, 0.66, 0.014, 2, 0.07, -0.02), path(0, 0));
  p.sweep('black', rrect(0.32, 0.12, 0.02, 2, -0.16, 0), path(0, WF + 0.06));
  p.sweep('dark', rrect(0.05, 0.03, 0.006, 2, 0.025, 0), path(-0.005, WF + 0.13));
  // (the light strip round the inside of the portal: three straight runs and the two corner slants)
  for (let i = 0; i < outline.length - 1; i++) {
    const [ax, ay] = outline[i], [bx, by] = outline[i + 1], len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax);
    const nx = (by - ay) / len, ny = -(bx - ax) / len, cx = (ax + bx) / 2 + nx * 0.025, cy = (ay + by) / 2 + ny * 0.025;
    const g = new THREE.BoxGeometry(len - 0.04, 0.016, 0.01); put(g, [cx, cy, WF + 0.15], [0, 0, ang]); p.add('glow', g, 'white');
    for (let t = 0.25; t < 1; t += 0.5) p.light([ax + (bx - ax) * t + nx * 0.2, ay + (by - ay) * t + ny * 0.2, WF + 0.3], 0.6, [1, 0.98, 0.95], [0, 0, 1], 5);
  }
  // the threshold: a plate through the wall's depth
  p.slab('gun', -OW, OW, -0.02, 0.012, -0.36, 0.3, { r: 0.006 });
}

// ── the terminal's floor ──────────────────────────────────────────────────────────────────────────────────────────
// four polished plates a metre square, darker seams between them (a CELL piece, a 'floor' variant)
export function plazaTile(p, v) {
  for (const [x0, z0] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
    const dark = v === 'plaza2' && (x0 + z0) % 2 === 0;   // ('plaza2': a checker of two greys, for a walkway's edge)
    const m = new MeshData();
    for (let j = 0; j <= 2; j++) for (let i = 0; i <= 2; i++) m.v(x0 + i * 0.5, 0, z0 + j * 0.5, 0, 1, 0);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const q = j * 3 + i; m.quad(q, q + 3, q + 4, q + 1); }
    p.add('solid', fixWinding(m.geometry()), dark ? PLAZA2 : PLAZA);
  }
  // the seams: thin dark lines between the plates, and along two of the tile's edges (its neighbours draw the others)
  const rect = kitTextures().decal.rect.solid;
  for (const [w, d, x, z] of [[2, 0.014, 0, 0], [0.014, 2, 0, 0], [2, 0.014, 0, -1 + 0.007], [0.014, 2, -1 + 0.007, 0]]) {
    const g = plane(w, d, { uv: rect, cell: 9 }); put(g, [0, 0, 0], [-PI / 2, 0, 0]); put(g, [x, 0.002, z]); p.add('decal', g, '#3c3f44');
  }
  floorSkirt(p);
}
