// THE SHELL: floor and ceiling tiles, wall panels, ribs and beams, the arched-hatch bulkhead, corners, trim.
// Each piece is drawn in its own frame, facing +z (see grid.js for how a layout places it):
//   a CELL piece (floor, ceiling) is centred on its cell: x and z from -1 to 1
//   an EDGE piece (wall, trim, beam) stands on its cell edge: x from -1 to 1 along the edge, z = 0 on the edge line,
//     the room it faces in +z
//   a POINT piece (rib, corner, hatch) stands on a grid point (where cell edges cross)
import * as THREE from 'three';
import { WALL_FACE as WF, RIB_FACE as RF, ROOM_H as H } from './grid.js';
import { rrect, arch, doorPath, rectLoop, line, plane, put, MeshData, bevelBox, circle, fixWinding } from './geo.js';
import { FLOOR_RECT } from './tex.js';

export const G = 0.007;          // half the seam between two panels
export const Z0 = 0.07;          // the back of a wall slab (the dark backing sits behind it, the door pocket behind that)
export const BAND = [1.22, 1.52];// the dark band across a wall
export const TOP = 2.52;         // where the cornice starts (a big slant from here up to the ceiling)
const PI = Math.PI;

// ── floor tiles ───────────────────────────────────────────────────────────────────────────────────────────────────
// a floor quad, x0..x1 by z0..z1 at height y, mapped onto a region of the floor atlas. `along` = 'x' (default) or 'z'
// says which way the texture's long bars run; `flipV` mirrors it across
export function floorQuad(p, region, x0, x1, z0, z1, y = 0, { along = 'x', v0 = 0, v1 = 1, u0 = 0, u1 = 1 } = {}) {
  const [a, b, c, d] = FLOOR_RECT[region], inset = 1.5 / 1024, m = new MeshData();
  const U = (t) => a + inset + (c - a - 2 * inset) * t, V = (t) => b + inset + (d - b - 2 * inset) * t;
  const nx = Math.max(1, Math.ceil((x1 - x0) / 0.34)), nz = Math.max(1, Math.ceil((z1 - z0) / 0.34));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const fx = i / nx, fz = j / nz;
    // (texture u runs along `along`; v across it)
    const tu = along === 'x' ? u0 + (u1 - u0) * fx : u0 + (u1 - u0) * fz, tv = along === 'x' ? v0 + (v1 - v0) * fz : v0 + (v1 - v0) * fx;
    m.v(x0 + (x1 - x0) * fx, y, z0 + (z1 - z0) * fz, 0, 1, 0, U(tu), V(tv));
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const q = j * (nx + 1) + i; m.quad(q, q + nx + 1, q + nx + 2, q + 1); }
  return p.add('floor', m.geometry());
}
export function floorSkirt(p) { // the tile's edge, down into the floor void (seen only at openings)
  for (const [w, at, ry] of [[2, [0, -0.04, 1], 0], [2, [0, -0.04, -1], PI], [2, [1, -0.04, 0], PI / 2], [2, [-1, -0.04, 0], -PI / 2]]) {
    const g = plane(w, 0.08, { uv: [0.75, 0.25, 0.76, 0.26], cell: 9 }); put(g, at, [0, ry, 0]); p.add('floor', g);
  }
  // a dark plate under the whole tile, so a hairline where two of its parts meet shows dark, never the space below
  const u = plane(2, 2, { uv: [0.75, 0.25, 0.76, 0.26], cell: 9 }); put(u, [0, -0.06, 0], [-PI / 2, 0, 0]); p.add('floor', u);
}
// the edge of a walkway: where the grating stops at `e`, a bare-metal rail, then a black channel with the light strip
// in it. The strip runs in segments that stop short of each tile's ends, a brighter fleck at each end. `along` is
// 'x' or 'z' (which way the edge runs), u0..u1 how far.
export function walkEdge(p, along, u0, u1, e) {
  const S = (surf, a0, a1, y0, y1, w0, w1, o) => (along === 'x' ? p.slab(surf, a0, a1, y0, y1, w0, w1, o) : p.slab(surf, w0, w1, y0, y1, a0, a1, o));
  const L = (name, a0, a1, y0, y1, w0, w1) => (along === 'x' ? p.glowSlab(name, a0, a1, y0, y1, w0, w1) : p.glowSlab(name, w0, w1, y0, y1, a0, a1));
  S('rail', u0, u1, -0.012, 0.012, e, e + 0.04, { r: 0.006, cell: 0.5 });
  S('black', u0, u1, -0.014, 0.004, e + 0.04, e + 0.09, { r: 0.004, cell: 0.5 });
  const c = e + 0.065, g0 = u0 + 0.07, g1 = u1 - 0.07;
  L('strip', g0, g1, 0.001, 0.006, c - 0.006, c + 0.006);
  for (const t of [g0, g1]) L('flare', t - 0.014, t + 0.014, 0.001, 0.008, c - 0.009, c + 0.009);
  for (let t = u0 + 0.25; t < u1; t += 0.5) p.light(along === 'x' ? [t, 0.05, c] : [c, 0.05, t], 0.7, [1, 0.96, 0.9], [0, 1, 0], 3.5);
}
const WALK = 0.75;  // the grating a walkway tile has along its -z edge (two tiles turned to face make a 1.5 m walkway)
const E = -1 + WALK, T0 = E + 0.09, VT = 1 - (1 - T0) / 2;   // where the grating stops; where the tread starts; its v there
export function floorTile(p, v) {
  if (v === 'walk') {
    floorQuad(p, 'grating', -1, 1, -1, E, -0.008, { v0: WALK / 2, v1: 0 });   // the frame side is the strip's outer edge
    floorQuad(p, 'tread', -1, 1, T0, 1, 0, { v0: VT, v1: 1 });
    walkEdge(p, 'x', -1, 1, E);
  } else if (v === 'walkL') { // a walkway corner: grating along the -z and -x edges
    floorQuad(p, 'grating', -1, 1, -1, E, -0.008, { v0: WALK / 2, v1: 0 });
    floorQuad(p, 'grating', -1, E, E, 1, -0.008, { along: 'z', v0: WALK / 2, v1: 0, u0: WALK / 2, u1: 1 });
    floorQuad(p, 'tread', T0, 1, T0, 1, 0, { u0: VT, v0: VT });
    walkEdge(p, 'x', T0, 1, E); walkEdge(p, 'z', T0, 1, E);
    p.slab('rail', E, T0, -0.012, 0.012, E, T0, { r: 0.006 });
  } else {
    floorQuad(p, { tread: 'tread', grating: 'grating', vent: 'vent', deck: 'deck' }[v] || 'deck', -1, 1, -1, 1, v === 'grating' ? -0.008 : 0);
  }
  floorSkirt(p);
}

// ── ceiling tiles ─────────────────────────────────────────────────────────────────────────────────────────────────
const CT = 0.06; // a ceiling panel's thickness (its face is at the room's height)
export function ceilingTile(p, v) {
  const opt = { r: 0.01, skip: ['+y'] };
  // a dark backing over the whole cell, so no seam between tiles shows the sky outside
  p.slab('dark', -1, 1, H + CT + 0.04, H + CT + 0.06, -1, 1, { r: 0, skip: ['+y'], cell: 9 });
  if (v === 'light') {
    // a recessed light panel in the middle, a frame of panels round it
    p.slab('white', -1 + G, 1 - G, H, H + CT, -1 + G, -0.32, opt); p.slab('white', -1 + G, 1 - G, H, H + CT, 0.32, 1 - G, opt);
    p.slab('white', -1 + G, -0.57, H, H + CT, -0.32 + G, 0.32 - G, opt); p.slab('white', 0.57, 1 - G, H, H + CT, -0.32 + G, 0.32 - G, opt);
    p.slab('dark', -0.57, 0.57, H + 0.03, H + CT + 0.02, -0.32, 0.32, { r: 0.004, skip: ['+y'] });
    const ring = p.sweep('black', rrect(0.06, 0.05, 0.01, 2, 0.03, -0.012), rectLoop(1.06, 0.56, 0.05, { z: 0 }), { closed: true });
    put(ring, [0, H + 0.005, 0], [PI / 2, 0, 0]);
    p.glowSlab('soft', -0.52, 0.52, H + 0.012, H + 0.03, -0.26, 0.26);
    for (const x of [-0.3, 0.3]) for (const z of [-0.12, 0.12]) p.light([x, H - 0.06, z], 1.6, [1, 0.98, 0.95], [0, -1, 0], 8);
    return;
  }
  if (v === 'tray') {
    // the half of a central cable tray that lies along this cell's -z edge (two tiles turned to face make the tray)
    const TW = 0.22, ty = H - 0.2;
    p.slab('white', -1 + G, 1 - G, H, H + CT, -1 + TW + 0.02, 1 - G, opt);
    p.slab('dark', -1, 1, H + 0.04, H + 0.1, -1, -1 + TW + 0.03, { r: 0.004, skip: ['+y'] });       // the dark recess over the tray
    // a ladder tray (rungs, no floor, so the cables show from below): its side rail with a lip, rungs every 25 cm
    p.slab('gun', -1, 1, ty, ty + 0.13, -1 + TW - 0.018, -1 + TW, { r: 0.005, cell: 0.6 });
    p.slab('gun', -1, 1, ty, ty + 0.012, -1 + TW - 0.05, -1 + TW, { r: 0, cell: 0.6 });
    for (let x = -0.875; x < 1; x += 0.25) p.slab('black', x - 0.014, x + 0.014, ty + 0.002, ty + 0.03, -1, -1 + TW - 0.018, { r: 0, cell: 9 });
    for (const x of [-0.5, 0.5]) p.cyl('black', 0.009, H + 0.05 - (ty + 0.13), [x, (ty + 0.13 + H + 0.05) / 2, -1 + TW - 0.009], null, 8);
    const cables = [[-0.975, 0.023, 'cable'], [-0.93, 0.021, 'gun'], [-0.888, 0.017, 'cable'], [-0.856, 0.011, 'grey'], [-0.825, 0.02, 'cable']];
    for (const [z, r, s] of cables) p.sweep(s, circle(r, 10), line([-1, ty + 0.03 + r, z], [1, ty + 0.03 + r, z], [0, 1, 0], 0.5));
    p.slab('orange', 0.47, 0.53, ty + 0.012, ty + 0.075, -0.99, -0.8, { r: 0.006 });                        // a cable clamp, painted orange
    // two loose cables sagging below the tray between its ends
    for (const [z, r, sag] of [[-0.95, 0.017, 0.09], [-0.88, 0.013, 0.06]]) {
      const pts = []; for (let k = 0; k <= 10; k++) { const x = -1 + k * 0.2; pts.push([x, ty - 0.005 - sag * (1 - x * x), z]); }
      p.sweep('cable', circle(r, 8), pts.map((q, k) => ({ p: new THREE.Vector3(...q), x: new THREE.Vector3(0, 0, 1), y: new THREE.Vector3(0, 1, 0) })).map((f, k, a) => { const t = a[Math.min(k + 1, a.length - 1)].p.clone().sub(a[Math.max(k - 1, 0)].p).normalize(); f.y = new THREE.Vector3(0, 0, 1); f.x = new THREE.Vector3().crossVectors(f.y, t); return f; }));
    }
    // a cove light along the top of the rail, washing the ceiling (its strip faces up, out of sight from below)
    p.glowSlab('soft', -1, 1, ty + 0.13, ty + 0.135, -1 + TW - 0.016, -1 + TW - 0.004);
    for (let x = -0.75; x < 1; x += 0.5) p.light([x, ty + 0.17, -1 + TW + 0.02], 0.3, [1, 0.98, 0.95], [0, 0.6, 0.8], 3);
    return;
  }
  p.slab('white', -1 + G, -G, H, H + CT, -1 + G, 1 - G, opt); p.slab('white', G, 1 - G, H, H + CT, -1 + G, 1 - G, opt);
}

// ── wall panels ───────────────────────────────────────────────────────────────────────────────────────────────────
// a row of off-white slabs between y0 and y1 (from x0 to x1), split at `cuts`: a cut is an x (a hairline seam) or
// [x, width] (a recessed dark channel). `depth` sets each slab proud of the wall face by so much, so a wall steps in
// and out the way plated machinery does
export function slabRow(p, x0, x1, y0, y1, cuts = [], surf = 'white', depth = [], opts = {}) {
  const C = cuts.map((c) => (Array.isArray(c) ? c : [c, 2 * G])), xs = [[x0, 0], ...C, [x1, 0]];
  // (opts.cell: a coarser step across big slabs, for the two-storey walls)
  for (let i = 0; i < xs.length - 1; i++) p.slab(surf, xs[i][0] + xs[i][1] / 2, xs[i + 1][0] - xs[i + 1][1] / 2, y0 + G, y1 - G, Z0, WF + (depth[i] || 0), { r: 0.007, skip: ['-z'], ...opts });
  for (const [x, w] of C) if (w > 0.03) p.slab('dark', x - w / 2, x + w / 2, y0, y1, Z0, WF - 0.045, { r: 0.004, skip: ['-z'], ...opts });
}
export function band(p, x0, x1) { p.slab('band', x0, x1, BAND[0] + G, BAND[1] - G, Z0, WF - 0.03, { r: 0.008, skip: ['-z'] }); }
export function backing(p, x0, x1, y0, y1, z0 = 0.03, z1 = Z0) { p.slab('dark', x0, x1, y0, y1, z0, z1, { r: 0, skip: ['-z'], cell: 0.5 }); }
// one side of a wall, x from -1 to 1 (G in from each end): which panels it has
function wallSide(p, v) {
  const X0 = -1 + G, X1 = 1 - G;
  if (v === 'plain') {
    backing(p, -1, 1, 0, H);
    // two bays either side of a charcoal pilaster, so a dark upright comes every metre along a corridor
    slabRow(p, X0, X1, 0.15, BAND[0], [[0, 0.1]], 'white', [0.025, 0]); band(p, X0, X1);
    slabRow(p, X0, X1, BAND[1], TOP, [[0, 0.1], [0.62, 0.05]], 'white', [0, 0.02, 0]); slabRow(p, X0, X1, TOP, H, [], 'white2');
    p.slab('black', -0.055, 0.055, 0.1, TOP, Z0, WF + 0.09, { r: 0.016 }); p.slab('black', -0.075, 0.075, 0, 0.12, Z0, WF + 0.11, { r: 0.01 });
  } else if (v === 'dark') {
    // a big dark inset through the middle, framed in white (a sector name goes on it)
    backing(p, -1, 1, 0, H);
    slabRow(p, X0, X1, 0.15, 0.95, [[0.2, 0.05]], 'white', [0.02, 0]);
    slabRow(p, X0, -0.64, 0.95, BAND[0], [], 'white', [0.02]); slabRow(p, 0.64, X1, 0.95, BAND[0], [], 'white', [0.02]);
    band(p, X0, -0.64); band(p, 0.64, X1);
    slabRow(p, X0, -0.64, BAND[1], TOP, [], 'white', [0.02]); slabRow(p, 0.64, X1, BAND[1], TOP, [], 'white', [0.02]); slabRow(p, -0.64, 0.64, 2.36, TOP);
    p.slab('dark', -0.64 + G, 0.64 - G, 0.95 + G, 2.36 - G, Z0, WF - 0.05, { r: 0.01, skip: ['-z'] });
    p.slab('black', -0.58, 0.58, 0.99, 1.03, WF - 0.05, WF - 0.045, { r: 0.002, seg: 1, cell: 9 });
    slabRow(p, X0, X1, TOP, H, [], 'white2');
  } else if (v === 'locker') {
    // a service door with a handle, and a little panel of buttons beside it
    backing(p, -1, 1, 0, H);
    slabRow(p, X0, -0.45, 0.15, BAND[0], [], 'white', [0.02]); band(p, X0, -0.45); slabRow(p, X0, -0.45, BAND[1], TOP, [], 'white', [0.02]);
    slabRow(p, 0.45, X1, 0.15, BAND[0], [], 'white', [0.02]); band(p, 0.45, X1); slabRow(p, 0.45, X1, BAND[1], TOP, [], 'white', [0.02]);
    // a cabinet standing out from the wall: its cheeks and cap, a dark plinth, the service door set in its front
    const CZ = WF + 0.18;
    slabRow(p, -0.45, 0.45, 2.2, TOP);
    for (const sx of [-1, 1]) p.slab('white', sx > 0 ? 0.43 : -0.5, sx > 0 ? 0.5 : -0.43, 0.13, 2.2, Z0, CZ, { r: 0.008 });
    p.slab('white', -0.5, 0.5, 2.14, 2.2, Z0, CZ, { r: 0.008 }); p.slab('dark', -0.48, 0.48, 0, 0.13, Z0, CZ - 0.03, { r: 0.008 });
    p.slab('dark', -0.43, 0.43, 0.13, 2.14, Z0, WF, { r: 0, skip: ['-z'] });
    p.slab('white2', -0.425, 0.425, 0.15, 2.12, CZ - 0.05, CZ - 0.008, { r: 0.008 });
    p.slab('band', -0.425, 0.425, BAND[0] + G, BAND[1] - G, CZ - 0.008, CZ - 0.002, { r: 0.004 });
    p.slab('black', 0.27, 0.32, 0.9, 1.16, CZ - 0.008, CZ + 0.016, { r: 0.008 });                     // the handle
    for (let k = 0; k < 4; k++) p.slab('dark', -0.3, 0.1, 1.72 + k * 0.05, 1.735 + k * 0.05, CZ - 0.009, CZ - 0.004, { r: 0 }); // a vent
    p.slab('black', 0.6, 0.84, 1.62, 1.92, WF + 0.02, WF + 0.038, { r: 0.008 });                          // the button plate
    for (const [y, c] of [[1.85, 'orange'], [1.77, 'green'], [1.69, 'white']]) { p.cyl('grey', 0.018, 0.012, [0.72, y, WF + 0.042], [PI / 2, 0, 0], 12); p.glowSlab(c, 0.705, 0.735, y - 0.012, y + 0.012, WF + 0.048, WF + 0.051); }
    slabRow(p, X0, X1, TOP, H, [], 'white2');
  } else if (v === 'window') {
    // a window to space in the upper half: a black frame through the wall, the glass, and nothing behind but stars
    const cy = 1.98, ww = 1.12, wh = 0.68;
    backing(p, -1, -0.62, 0, H); backing(p, 0.62, 1, 0, H); backing(p, -0.62, 0.62, 0, 1.56); backing(p, -0.62, 0.62, 2.4, H);
    // (the hole's square corners, hidden behind the frame's rounded ones, so no sky shows round the frame)
    for (const sx of [-1, 1]) for (const [y0, y1] of [[1.56, 1.66], [2.3, 2.4]]) backing(p, sx > 0 ? 0.5 : -0.62, sx > 0 ? 0.62 : -0.5, y0, y1);
    slabRow(p, X0, X1, 0.15, BAND[0], [[-0.35, 0.06]], 'white', [0, 0.025]); band(p, X0, X1);
    slabRow(p, X0, -0.62, BAND[1], TOP, [], 'white', [0.02]); slabRow(p, 0.62, X1, BAND[1], TOP, [], 'white', [0.02]);
    slabRow(p, -0.62, 0.62, 2.4, TOP);
    p.sweep('black', rrect(0.1, 0.26, 0.014, 2, 0.05, 0.13), rectLoop(ww, wh, 0.14, { cy }), { closed: true });
    p.glass(ww + 0.02, wh + 0.02, [0, cy, 0.1]);
    // (the frame's corners are round and the hole in the wall is square: a dark fillet behind each corner)
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const x = sx * 0.59, y = cy + sy * 0.38; p.slab('dark', x - 0.035, x + 0.035, y - 0.045, y + 0.045, 0.03, Z0, { r: 0, cell: 9 }); }
    slabRow(p, X0, X1, TOP, H, [], 'white2');
  }
}
export function wallPanel(p, v) {
  if (v !== 'door' && v !== 'locked') return wallSide(p, v);
  // a doorway into a room: a wall with a face on both sides, a black frame through it, and two leaves that slide
  // apart into the wall (between the two faces) as someone comes near. 'locked': the same doorway shut for good (a
  // red light over it, and leaves with a dark panel where the open door's little windows are, so nobody sees past it)
  const X0 = -1 + G, X1 = 1 - G, hw = 0.55, top = 2.25, locked = v === 'locked';
  for (const s of [0, 1]) {
    const q = new (p.constructor)();
    backing(q, -1, -0.6, 0, H); backing(q, 0.6, 1, 0, H); backing(q, -0.6, 0.6, 2.3, H);
    slabRow(q, X0, -0.62, 0.15, BAND[0], [], 'white', [0.02]); band(q, X0, -0.62); slabRow(q, X0, -0.62, BAND[1], TOP, [], 'white', [0.02]);
    slabRow(q, 0.62, X1, 0.15, BAND[0], [], 'white', [0.02]); band(q, 0.62, X1); slabRow(q, 0.62, X1, BAND[1], TOP, [], 'white', [0.02]);
    slabRow(q, -0.62, 0.62, 2.32, TOP); slabRow(q, X0, X1, TOP, H, [], 'white2');
    q.slab('black', -0.3, 0.3, 2.4, 2.47, WF, WF + 0.02, { r: 0.008 }); q.glowSlab(locked ? 'red' : 'green', -0.26, 0.26, 2.42, 2.45, WF + 0.02, WF + 0.024);
    q.light([0, 2.43, WF + 0.12], 0.35, locked ? [1, 0.2, 0.15] : [0.3, 1, 0.5], [0, 0, 1], 3);
    for (const part of q.parts) { if (s) put(part.geo, [0, 0, 0], [0, PI, 0]); p.parts.push(part); }
    for (const L of q.lights) p.lights.push(s ? { ...L, at: [-L.at[0], L.at[1], -L.at[2]], dir: L.dir && [-L.dir[0], L.dir[1], -L.dir[2]] } : L);
  }
  p.sweep('black', rrect(0.1, 0.5, 0.015, 2, 0.05, 0), doorPath(hw, top, 0.12), {});
  p.slab('gun', -hw, hw, -0.02, 0.012, -0.25, 0.25, { r: 0.006 });
  const leaf = (q) => {
    const w = hw + 0.04, h = top + 0.02;
    q.slab('white2', -w, -0.012, 0.01, h, -0.024, 0.024, { r: 0.012 });
    q.slab('black', -0.014, 0, 0.01, h, -0.027, 0.027, { r: 0.004 });
    q.slab('band', -w + 0.05, -0.06, BAND[0], BAND[1], -0.028, 0.028, { r: 0.006 });
    q.slab('black', -w + 0.1, -0.11, 1.7, 2.05, -0.026, 0.026, { r: 0.01 });
    if (locked) q.slab('dark', -w + 0.12, -0.13, 1.725, 2.025, -0.0275, 0.0275, { r: 0.006 });
    else for (const z of [0.0262, -0.0262]) q.glass(w - 0.24, 0.3, [(-w + 0.1 - 0.11) / 2, 1.875, z], z < 0 ? [0, PI, 0] : null);
  };
  const key = locked ? 'door-leaf-locked' : 'door-leaf';
  p.leaf(key, leaf, { slide: [-(hw + 0.06), 0, 0], door: 0 });
  p.leaf(key, leaf, { rot: [0, PI, 0], slide: [hw + 0.06, 0, 0], door: 0 });
  if (!locked) p.door(0, [0, 1.2, 0], 2.4);
}

// ── ribs and beams ────────────────────────────────────────────────────────────────────────────────────────────────
// the slant from the top of the wall up to the ceiling, as a box of thickness t sitting on the line from (y0, z0) at
// 45 degrees up and out to the ceiling
export function slant(p, surf, x0, x1, y0, z0, t, opts = {}) {
  const len = (H - y0) * Math.SQRT2, ny = -Math.SQRT1_2, nz = Math.SQRT1_2;
  const my = (y0 + H) / 2 - ny * t / 2, mz = z0 + (H - y0) / 2 - nz * t / 2;
  return p.box(surf, [x1 - x0, t, len + 0.04], [(x0 + x1) / 2, my, mz], [3 * PI / 4, 0, 0], { r: 0.01, ...opts });
}
export function rib(p, v) {
  // a stepped profile: a wide back plate on the wall, a narrower fin standing out from it, both running up into a
  // knee along the ceiling's slant; a foot at the floor
  p.slab('black', -0.13, 0.13, 0, TOP, 0.03, 0.21, { r: 0.018 });
  p.slab('black', -0.075, 0.075, 0.12, TOP - 0.05, 0.19, RF, { r: 0.022 });
  p.slab('black', -0.15, 0.15, 0, 0.13, 0.03, RF + 0.02, { r: 0.014 });
  slant(p, 'black', -0.13, 0.13, TOP - 0.03, 0.21, 0.12);
  slant(p, 'black', -0.075, 0.075, TOP - 0.09, RF, 0.2);
  if (v === 'strip') {
    p.slab('dark', -0.03, 0.03, 0.72, 2.36, RF - 0.01, RF + 0.012, { r: 0.006 });
    p.glowSlab('white', -0.011, 0.011, 0.78, 2.3, RF + 0.012, RF + 0.017);
    for (const y of [1.0, 1.6, 2.2]) p.light([0, y, RF + 0.08], 1.25, [1, 0.98, 0.95], [0, 0, 1], 7);
  }
}
export function beam(p) { p.slab('black', -1, 1, H - 0.14, H + 0.02, -0.11, 0.11, { r: 0.02, skip: ['+y'] }); }

// ── trim ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export function trim(p, v) {
  if (v === 'base') p.slab('black', -1, 1, 0, 0.15, 0.04, WF + 0.03, { r: 0.012, skip: ['-z'] });
  else if (v === 'glow') { p.slab('black', -1, 1, -0.012, 0.006, WF + 0.03, WF + 0.09, { r: 0.004, seg: 1 }); p.glowSlab('white', -0.99, 0.99, 0.004, 0.009, WF + 0.05, WF + 0.07); for (const x of [-0.66, 0, 0.66]) p.light([x, 0.05, WF + 0.06], 0.3, [0.92, 0.96, 1], [0, 1, 0], 3.5); }
  else if (v === 'cornice' || v === 'cornice-grey') { slant(p, v === 'cornice' ? 'white' : 'grey2', -1 + G, 1 - G, TOP, WF, 0.05, { skip: [] }); p.slab('black', -1, 1, TOP - 0.035, TOP, Z0, WF + 0.008, { r: 0.006, skip: ['-z'] }); }
}

// ── corners: inside (two walls meeting round a room) and outside (a wall's end, round a corner) ────────────────────
export function corner(p, v) {
  if (v === 'inside') {
    // the room is in +x, +z: a black post fills the corner, its 45-degree face lit
    // (drawn in x, -z and stood up: the outline's y becomes -z, the push becomes the height)
    p.extrude('black', [[0, 0], [0.36, 0], [0.36, -0.17], [0.17, -0.36], [0, -0.36]], TOP, 0.012).rotateX(-PI / 2);
    slant2(p);
    const g = bevelBox([0.05, 1.7, 0.012], [0, 0, 0], { r: 0.004, seg: 1, cell: 9 }); put(g, [0.265, 1.6, 0.265], [0, PI / 4, 0]); p.add('glow', g, 'white');
    for (const y of [1.0, 1.6, 2.2]) p.light([0.32, y, 0.32], 0.9, [0.93, 0.96, 1], [Math.SQRT1_2, 0, Math.SQRT1_2], 6);
    p.slab('black', 0, 0.38, 0, 0.13, 0, 0.38, { r: 0.012, skip: ['-y'] });
  } else {
    // outside: the walls run off in -x and -z; a rounded black post caps both their ends
    p.slab('black', -0.06, RF, 0, TOP + 0.36, -0.06, RF, { r: 0.07, seg: 4 });
    const g = bevelBox([0.04, 1.7, 0.012], [0, 0, 0], { r: 0.004, seg: 1, cell: 9 }); put(g, [RF - 0.012, 1.6, RF - 0.012], [0, PI / 4, 0]); p.add('glow', g, 'white');
    for (const y of [1.0, 1.6, 2.2]) p.light([RF + 0.06, y, RF + 0.06], 0.9, [0.93, 0.96, 1], [Math.SQRT1_2, 0, Math.SQRT1_2], 6);
  }
}
function slant2(p) { // the corner post's top: up to the ceiling, out along both cornices
  p.slab('black', 0, 0.36, TOP, H, 0, 0.36, { r: 0.01 });
}

// ── the bulkhead with an arched hatch ─────────────────────────────────────────────────────────────────────────────
// It stands across a corridor on a grid point (the corridor's middle), 4 m wide: an off-white surround, a black rim
// with bolt flanges and tick marks round the arch, a yellow stripe inside the rim, dark latch blocks either side, and
// two leaves that slide apart into the bulkhead. variant 'arch' (a hatch), 'wide' (a broader arch, 1.6 m: two people
// pass each other in it, for the main ways through a station) or 'blind' (no opening: a corridor's end)
export const HATCH = { hw: 0.56, spring: 1.66, half: 2, skin: 0.25, core: 0.06 };
export const HATCH_WIDE = { ...HATCH, hw: 0.8, spring: 1.5 };
function skinFace(p, z, holeR, D = HATCH) {
  // the surround's face at depth z: rings of quads from the arch hole out to the 4 x 3 m edge (denser near the hole).
  // Each point round the hole is joined to the point straight out from the arch's centre on the edge, and the two top
  // corners get a ray of their own so the rings reach right into them.
  const { spring, half } = D, m = new MeshData(), T = [0, 0.04, 0.12, 0.26, 0.48, 0.74, 1], inner = [], outer = [];
  const nUp = Math.ceil(spring / 0.25), ac = Math.atan2(H - spring, half), angles = [];
  for (let i = 0; i <= 20; i++) angles.push(Math.PI - Math.PI * i / 20);
  angles.push(Math.PI - ac, ac); angles.sort((a, b) => b - a);
  for (let i = 0; i < nUp; i++) { const y = spring * i / nUp; inner.push([-holeR, y]); outer.push([-half, y]); }
  for (const a of angles) {
    const c = Math.cos(a), s = Math.sin(a), t = Math.min(Math.abs(c) > 1e-9 ? half / Math.abs(c) : Infinity, s > 1e-9 ? (H - spring) / s : Infinity);
    inner.push([c * holeR, spring + s * holeR]); outer.push([c * t, spring + s * t]);
  }
  for (let i = nUp - 1; i >= 0; i--) { const y = spring * i / nUp; inner.push([holeR, y]); outer.push([half, y]); }
  for (let i = 0; i < inner.length; i++) for (const t of T) { const [ax, ay] = inner[i], [bx, by] = outer[i]; m.v(ax + (bx - ax) * t, ay + (by - ay) * t, z, 0, 0, Math.sign(z), ax + (bx - ax) * t, ay + (by - ay) * t); }
  const n = T.length;
  for (let i = 0; i < inner.length - 1; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j; m.quad(a, a + n, a + n + 1, a + 1); }
  return fixWinding(m.geometry());
}
export function hatch(p, v) {
  const D = v === 'wide' ? HATCH_WIDE : HATCH, { hw, spring, half, skin, core } = D;
  if (v === 'blind') {
    for (const s of [1, -1]) { p.slab('white', -half, half, 0, H, s > 0 ? core : -skin, s > 0 ? skin : -core, { r: 0.01, skip: [s > 0 ? '-z' : '+z'], cell: 0.45 }); }
    p.slab('black', -1.0, 1.0, 1.0, 2.6, -skin - 0.04, skin + 0.04, { r: 0.04 });
    for (const s of [1, -1]) p.slab('white2', -0.84, 0.84, 1.16, 2.44, s > 0 ? skin + 0.03 : -skin - 0.05, s > 0 ? skin + 0.05 : -skin - 0.03, { r: 0.012 });
    portal(p);
    return;
  }
  // round the opening, from the inside out (as the reference has it): the dark jamb, its face a broad dark ring; the
  // yellow stripe; a cream band with the bolts; the charcoal outer ring; tick marks on the wall beyond
  const J = 0.13, Y = [0.125, 0.153], B = [0.15, 0.28], O = [0.275, 0.39], holeR = hw + 0.14;
  for (const z of [skin, -skin]) p.add('solid', skinFace(p, z, holeR, D), 'white');
  // the bulkhead's own edges, closing the pocket between the two faces (hidden in a corridor, seen on its own)
  for (const s of [-1, 1]) p.slab('white', s > 0 ? half - 0.02 : -half, s > 0 ? half : -half + 0.02, 0, H, -skin, skin, { r: 0.004, cell: 0.6 });
  p.slab('white', -half, half, H - 0.02, H, -skin, skin, { r: 0.004, cell: 0.6 });
  const R = (r0, r1, z0, z1, rr = 0.012) => rrect(r1 - r0, z1 - z0, rr, 2, (r0 + r1) / 2, (z0 + z1) / 2);
  const path = () => arch(hw, spring, { seg: 22, step: 0.4 });
  p.sweep('black', R(-0.002, J, -skin - 0.03, skin + 0.03, 0.016), path());
  for (const s of [1, -1]) {
    const q = new (p.constructor)();
    q.sweep('yellow', R(Y[0], Y[1], skin - 0.01, skin + 0.026, 0.005), path());
    q.sweep('grey2', R(B[0], B[1], core, skin + 0.02, 0.008), path());
    q.sweep('black', R(O[0], O[1], skin - 0.01, skin + 0.045, 0.016), path());
    for (const f of arch(hw + (B[0] + B[1]) / 2, spring, { seg: 12, step: 0.42 })) q.cyl('grey', 0.013, 0.012, [f.p.x, f.p.y, skin + 0.024], [PI / 2, 0, 0], 10);
    for (let k = 0; k <= 8; k++) { const a = PI * k / 8, c = Math.cos(a), sn = Math.sin(a), r0 = hw + O[1] + 0.03, r1 = r0 + 0.08; q.box('black', [0.016, r1 - r0, 0.012], [c * (r0 + r1) / 2, spring + sn * (r0 + r1) / 2, skin + 0.006], [0, 0, a - PI / 2]); }
    // the latches: two blocks on one side, one bigger with a round lock face on the other, each on a bracket plate,
    // a level rod running out of each across the wall
    const ox = hw + O[1] - 0.02;
    for (const y of [0.9, 1.68]) {
      q.slab('dark', -(ox + 0.24), -(ox - 0.01), y - 0.16, y + 0.16, skin, skin + 0.035, { r: 0.01 });
      q.slab('black', -(ox + 0.19), -(ox + 0.01), y - 0.12, y + 0.12, skin + 0.025, skin + 0.12, { r: 0.022 });
      q.slab('black', -(ox + 0.17), -(ox + 0.03), y - 0.08, y + 0.08, skin + 0.11, skin + 0.15, { r: 0.016 });
      q.box('black', [0.16, 0.05, 0.05], [-(ox + 0.19 + 0.07), y, skin + 0.06], null, { r: 0.012 });
    }
    q.slab('dark', ox - 0.01, ox + 0.28, 1.04, 1.54, skin, skin + 0.035, { r: 0.01 });
    q.slab('black', ox + 0.01, ox + 0.24, 1.09, 1.49, skin + 0.025, skin + 0.12, { r: 0.022 });
    q.cyl('gun', 0.065, 0.03, [ox + 0.125, 1.29, skin + 0.135], [PI / 2, 0, 0], 20); q.cyl('dark', 0.035, 0.04, [ox + 0.125, 1.29, skin + 0.155], [PI / 2, 0, 0], 16);
    q.slab('black', ox + 0.17, ox + 0.21, 1.42, 1.46, skin + 0.12, skin + 0.125, { r: 0.002 }); q.glowSlab('amber', ox + 0.175, ox + 0.205, 1.425, 1.455, skin + 0.125, skin + 0.128);
    q.box('black', [0.16, 0.05, 0.05], [ox + 0.24 + 0.07, 1.29, skin + 0.06], null, { r: 0.012 });
    // thin level rods standing out from the outer ring, each with a little end cap
    for (const [sx, y] of [[-1, 0.45], [-1, 1.29], [1, 0.45], [1, 0.9], [1, 1.68]]) { const x0 = hw + O[1] - 0.01, x1 = Math.min(sx > 0 ? x0 + 0.2 : x0 + 0.42, half - 0.56); q.box('black', [x1 - x0, 0.024, 0.024], [sx * (x0 + x1) / 2, y, skin + 0.035], null, { r: 0 }); q.box('dark', [0.03, 0.04, 0.04], [sx * x1, y, skin + 0.035], null, { r: 0 }); }
    q.light([ox + 0.17, 1.42, skin + 0.18], 0.12, [1, 0.75, 0.35], [0, 0, 1], 2);
    for (const part of q.parts) { if (s < 0) put(part.geo, [0, 0, 0], [0, PI, 0]); p.parts.push(part); }
    for (const L of q.lights) p.lights.push(s < 0 ? { ...L, at: [-L.at[0], L.at[1], -L.at[2]], dir: L.dir && [-L.dir[0], L.dir[1], -L.dir[2]] } : L);
  }
  portal(p);
  // the threshold: a raised plate through the opening
  p.slab('gun', -hw, hw, -0.02, 0.012, -skin - 0.03, skin + 0.03, { r: 0.006 });
  floorQuad(p, 'grating', -hw + 0.03, hw - 0.03, -skin + 0.01, skin - 0.01, 0.0125, { v0: 0.05, v1: 0.2, u0: 0.2, u1: 0.5 });
  // the leaves: half an arch each, sliding apart into the bulkhead's pocket
  const leaf = (q) => {
    const w = hw + 0.05, top = spring + w, pts = [[0, 0.004], [-w, 0.004], [-w, spring]];
    for (let k = 1; k <= 12; k++) { const a = PI - PI / 2 * k / 12; pts.push([k === 12 ? 0 : Math.cos(a) * w, k === 12 ? top : spring + Math.sin(a) * w]); }
    q.extrude('white2', pts, 0.052, 0.012, { crease: 0.6 }).translate(0, 0, -0.026);
    q.slab('black', -0.016, 0, 0.004, top - 0.001, -0.03, 0.03, { r: 0.005 });
    q.slab('band', -w + 0.04, -0.05, 1.02, 1.3, -0.03, 0.03, { r: 0.006 });
    q.slab('dark', -w + 0.06, -0.07, 1.7, 1.74, -0.029, 0.029, { r: 0.004 });
  };
  const key = v === 'wide' ? 'hatch-leaf-wide' : 'hatch-leaf';
  p.leaf(key, leaf, { slide: [-(hw + 0.1), 0, 0], door: 0 });
  p.leaf(key, leaf, { rot: [0, PI, 0], slide: [hw + 0.1, 0, 0], door: 0 });
  p.door(0, [0, 1.2, 0], 2.8);
}
// charcoal posts and a lintel framing the bulkhead's faces, so the corridor closes in round the hatch
function portal(p) {
  const { half, skin } = HATCH;
  for (const s of [1, -1]) {
    const Z = (a, b) => (s > 0 ? [skin + a, skin + b] : [-skin - b, -skin - a]);
    for (const sx of [-1, 1]) {
      p.slab('black', sx > 0 ? half - 0.52 : -half + 0.26, sx > 0 ? half - 0.26 : -half + 0.52, 0, H, ...Z(-0.01, 0.1), { r: 0.02 });
      p.slab('black', sx > 0 ? half - 0.52 : -half + 0.4, sx > 0 ? half - 0.4 : -half + 0.52, 0, H - 0.27, ...Z(0.09, 0.18), { r: 0.022 });
    }
    p.slab('black', -half + 0.26, half - 0.26, H - 0.27, H, ...Z(-0.01, 0.1), { r: 0.02, skip: ['+y'] });
    p.slab('black', -half + 0.4, half - 0.4, H - 0.27, H - 0.19, ...Z(0.09, 0.18), { r: 0.02 });
  }
}
