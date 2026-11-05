// THE SHELL: floor and ceiling tiles, wall panels, ribs and beams, the arched-hatch bulkhead, corners, trim.
// Each piece is drawn in its own frame, facing +z (see grid.js for how a layout places it):
//   a CELL piece (floor, ceiling) is centred on its cell: x and z from -1 to 1
//   an EDGE piece (wall, trim, beam) stands on its cell edge: x from -1 to 1 along the edge, z = 0 on the edge line,
//     the room it faces in +z
//   a POINT piece (rib, corner, hatch) stands on a grid point (where cell edges cross)
//
// SIZES. Every piece also takes an optional last argument, its sizes. Left out, the piece is the station's, exactly
// (every number it draws is the station's own). The ships give their own (kit/shipparts/cabin.js), so a ship's rooms
// get the same panels, bands, trim, ribs and doorways at a ship's size:
//   w, d    a wall's (or trim's) width along x; a floor or ceiling tile's width (x) and depth (z). The station's 2 x 2.
//   h       floor to ceiling (the station's 3)
//   top     where the cornice's slant starts, up the wall (2.52)
//   depth   how deep a wall's layers sit: { pocket, back, face, relief }. The station's wall has a pocket for the door
//           leaves out to 0.03 from its line, the dark backing to 0.07 (where the slabs' backs are), the panel faces
//           at 0.22, and its ribs, pilasters and cabinets stand out from the face by their own amounts. A ship's wall is
//           far thinner: every z a wall piece draws goes through zOf(depth), which squeezes each of those layers into
//           the ship's (pocket, back, face) and scales what stands out from the face by `relief`.
//   door    a doorway's clear { w, h }, and `leaves`: 2 (two leaves parting, the station's) or 1 / -1 (one leaf
//           sliding toward +x / -x); `near`: how close someone comes before it opens
//   pilaster  whether a plain wall has its charcoal pilaster in the middle (true)
//   lean    a ship's lighter build (false): what a ship never shows is left out (the top row of panels behind the
//           cornice, the dark channel behind a pilaster, the sides of panels where they meet in a seam, the ceiling
//           lights' rims) and the doorway's frame is swept in fewer steps
//   tex     floor only: how many metres of floor one plate of the floor texture covers (the station's 2)
//   walk    floor only: the walkway grating's width on a 'walk' tile (0.75)
//   hatch only: hw, spring, half, skin, core (as HATCH), and k, the scale of everything round the arch (its rings,
//           bolts, ticks, latches and the portal posts)
import * as THREE from 'three';
import { WALL_FACE as WF, RIB_FACE as RF, ROOM_H as H } from './grid.js';
import { rrect, arch, doorPath, rectLoop, line, plane, put, MeshData, bevelBox, circle, fixWinding } from './geo.js';
import { FLOOR_RECT } from './tex.js';

export const G = 0.007;          // half the seam between two panels
export const Z0 = 0.07;          // the back of a wall slab (the dark backing sits behind it, the door pocket behind that)
export const BAND = [1.22, 1.52];// the dark band across a wall
export const TOP = 2.52;         // where the cornice starts (a big slant from here up to the ceiling)
const PI = Math.PI;
const ID = (z) => z;
// a wall's depths squeezed into a ship's (see SIZES above); the station's are left as they are
export function zOf(D) {
  if (!D) return ID;
  const { pocket, back, face, relief } = D;
  return (z) => {
    const a = Math.abs(z), sg = z < 0 ? -1 : 1;
    const r = a <= 0.03 ? a * pocket / 0.03 : a <= Z0 ? pocket + (a - 0.03) * (back - pocket) / (Z0 - 0.03) : a <= WF ? back + (a - Z0) * (face - back) / (WF - Z0) : face + (a - WF) * relief;
    return sg * r;
  };
}

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
export function floorSkirt(p, hw = 1, hd = 1) { // the tile's edge, down into the floor void (seen only at openings)
  for (const [w, at, ry] of [[2 * hw, [0, -0.04, hd], 0], [2 * hw, [0, -0.04, -hd], PI], [2 * hd, [hw, -0.04, 0], PI / 2], [2 * hd, [-hw, -0.04, 0], -PI / 2]]) {
    const g = plane(w, 0.08, { uv: [0.75, 0.25, 0.76, 0.26], cell: 9 }); put(g, at, [0, ry, 0]); p.add('floor', g);
  }
  // a dark plate under the whole tile, so a hairline where two of its parts meet shows dark, never the space below
  const u = plane(2 * hw, 2 * hd, { uv: [0.75, 0.25, 0.76, 0.26], cell: 9 }); put(u, [0, -0.06, 0], [-PI / 2, 0, 0]); p.add('floor', u);
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
// variants: walk (a walkway's half: grating along the -z edge, its rail and light strip, tread beyond), walkL (a
// walkway corner), tread, grating, vent, deck. Sizes: w, d, tex, walk.
export function floorTile(p, v, s) {
  const { w = 2, d = 2, tex = 2, walk = WALK } = s || {}, hw = w / 2, hd = d / 2, u1 = w / tex;
  const E = -hd + walk, T0 = E + 0.09, VT = 1 - (hd - T0) / tex;   // where the grating stops; where the tread starts; its v there
  if (v === 'walk') {
    floorQuad(p, 'grating', -hw, hw, -hd, E, -0.008, { v0: walk / tex, v1: 0, u1 });   // the frame side is the strip's outer edge
    floorQuad(p, 'tread', -hw, hw, T0, hd, 0, { v0: VT, v1: 1, u1 });
    walkEdge(p, 'x', -hw, hw, E);
  } else if (v === 'walkL') { // a walkway corner: grating along the -z and -x edges
    const EX = -hw + walk, TX = EX + 0.09, UX = 1 - (hw - TX) / tex;
    floorQuad(p, 'grating', -hw, hw, -hd, E, -0.008, { v0: walk / tex, v1: 0, u1 });
    floorQuad(p, 'grating', -hw, EX, E, hd, -0.008, { along: 'z', v0: walk / tex, v1: 0, u0: walk / tex, u1: (walk + hd - E) / tex });
    floorQuad(p, 'tread', TX, hw, T0, hd, 0, { u0: UX, v0: VT });
    walkEdge(p, 'x', TX, hw, E); walkEdge(p, 'z', T0, hd, EX);
    p.slab('rail', EX, TX, -0.012, 0.012, E, T0, { r: 0.006 });
  } else {
    floorQuad(p, { tread: 'tread', grating: 'grating', vent: 'vent', deck: 'deck' }[v] || 'deck', -hw, hw, -hd, hd, v === 'grating' ? -0.008 : 0, { u1, v1: d / tex });
  }
  floorSkirt(p, hw, hd);
}

// ── ceiling tiles ─────────────────────────────────────────────────────────────────────────────────────────────────
const CT = 0.06; // a ceiling panel's thickness (its face is at the room's height)
// variants: panel, light (a recessed light panel in a frame of panels), tray (half of a central cable tray). Sizes:
// w, d, h (the light panel, its frame and its lamps keep their place across the tile; the lamps' strength goes with
// the tile's area)
export function ceilingTile(p, v, s) {
  const { w = 2, d = 2, h = H, lean = false } = s || {}, kx = w / 2, kz = d / 2, X = (x) => x * kx, Z = (z) => z * kz;
  const opt = { r: 0.01, skip: ['+y'] };
  // a dark backing over the whole cell, so no seam between tiles shows the sky outside
  p.slab('dark', -kx, kx, h + CT + 0.04, h + CT + 0.06, -kz, kz, { r: 0, skip: ['+y'], cell: 9 });
  if (v === 'light') {
    // a recessed light panel in the middle, a frame of panels round it
    p.slab('white', -kx + G, kx - G, h, h + CT, -kz + G, Z(-0.32), opt); p.slab('white', -kx + G, kx - G, h, h + CT, Z(0.32), kz - G, opt);
    p.slab('white', -kx + G, X(-0.57), h, h + CT, Z(-0.32) + G, Z(0.32) - G, opt); p.slab('white', X(0.57), kx - G, h, h + CT, Z(-0.32) + G, Z(0.32) - G, opt);
    p.slab('dark', X(-0.57), X(0.57), h + 0.03, h + CT + 0.02, Z(-0.32), Z(0.32), { r: 0.004, skip: ['+y'] });
    if (!lean) {   // (its charcoal rim; a ship's lighter build goes without)
      const ring = p.sweep('black', rrect(0.06, 0.05, 0.01, 2, 0.03, -0.012), rectLoop(X(1.06), Z(0.56), 0.05, { z: 0 }), { closed: true });
      put(ring, [0, h + 0.005, 0], [PI / 2, 0, 0]);
    }
    p.glowSlab('soft', X(-0.52), X(0.52), h + 0.012, h + 0.03, Z(-0.26), Z(0.26));
    for (const x of [-0.3, 0.3]) for (const z of [-0.12, 0.12]) p.light([X(x), h - 0.06, Z(z)], 1.6 * (kx * kz), [1, 0.98, 0.95], [0, -1, 0], 8);
    return;
  }
  if (v === 'tray') {
    // the half of a central cable tray that lies along this cell's -z edge (two tiles turned to face make the tray)
    const TW = 0.22, ty = h - 0.2, z0 = -kz;
    p.slab('white', -kx + G, kx - G, h, h + CT, z0 + TW + 0.02, kz - G, opt);
    p.slab('dark', -kx, kx, h + 0.04, h + 0.1, z0, z0 + TW + 0.03, { r: 0.004, skip: ['+y'] });       // the dark recess over the tray
    // a ladder tray (rungs, no floor, so the cables show from below): its side rail with a lip, rungs every 25 cm
    p.slab('gun', -kx, kx, ty, ty + 0.13, z0 + TW - 0.018, z0 + TW, { r: 0.005, cell: 0.6 });
    p.slab('gun', -kx, kx, ty, ty + 0.012, z0 + TW - 0.05, z0 + TW, { r: 0, cell: 0.6 });
    for (let x = -kx + 0.125; x < kx; x += 0.25) p.slab('black', x - 0.014, x + 0.014, ty + 0.002, ty + 0.03, z0, z0 + TW - 0.018, { r: 0, cell: 9 });
    for (const x of [-0.5, 0.5]) p.cyl('black', 0.009, h + 0.05 - (ty + 0.13), [X(x), (ty + 0.13 + h + 0.05) / 2, z0 + TW - 0.009], null, 8);
    const cables = [[-0.975, 0.023, 'cable'], [-0.93, 0.021, 'gun'], [-0.888, 0.017, 'cable'], [-0.856, 0.011, 'grey'], [-0.825, 0.02, 'cable']];
    const ZE = (z) => (kz === 1 ? z : z0 + (z + 1));   // (a z given from the station tile's -z edge, at -1)
    for (const [zz, r, sf] of cables) { const z = ZE(zz); p.sweep(sf, circle(r, 10), line([-kx, ty + 0.03 + r, z], [kx, ty + 0.03 + r, z], [0, 1, 0], 0.5)); }
    p.slab('orange', X(0.47), X(0.53), ty + 0.012, ty + 0.075, ZE(-0.99), ZE(-0.8), { r: 0.006 });                        // a cable clamp, painted orange
    // two loose cables sagging below the tray between its ends
    for (const [zz, r, sag] of [[-0.95, 0.017, 0.09], [-0.88, 0.013, 0.06]]) {
      const z = ZE(zz), pts = []; for (let k = 0; k <= 10; k++) { const x = -kx + k * 0.2 * kx, xx = x / kx; pts.push([x, ty - 0.005 - sag * (1 - xx * xx), z]); }
      p.sweep('cable', circle(r, 8), pts.map((q, k) => ({ p: new THREE.Vector3(...q), x: new THREE.Vector3(0, 0, 1), y: new THREE.Vector3(0, 1, 0) })).map((f, k, a) => { const t = a[Math.min(k + 1, a.length - 1)].p.clone().sub(a[Math.max(k - 1, 0)].p).normalize(); f.y = new THREE.Vector3(0, 0, 1); f.x = new THREE.Vector3().crossVectors(f.y, t); return f; }));
    }
    // a cove light along the top of the rail, washing the ceiling (its strip faces up, out of sight from below)
    p.glowSlab('soft', -kx, kx, ty + 0.13, ty + 0.135, z0 + TW - 0.016, z0 + TW - 0.004);
    for (let x = -kx + 0.25; x < kx; x += 0.5) p.light([x, ty + 0.17, z0 + TW + 0.02], 0.3, [1, 0.98, 0.95], [0, 0.6, 0.8], 3);
    return;
  }
  p.slab('white', -kx + G, -G, h, h + CT, -kz + G, kz - G, opt); p.slab('white', G, kx - G, h, h + CT, -kz + G, kz - G, opt);
}

// ── wall panels ───────────────────────────────────────────────────────────────────────────────────────────────────
// a row of off-white slabs between y0 and y1 (from x0 to x1), split at `cuts`: a cut is an x (a hairline seam) or
// [x, width] (a recessed dark channel). `depth` sets each slab proud of the wall face by so much, so a wall steps in
// and out the way plated machinery does. Z: the wall's depths (zOf), for a ship's thin walls
export function slabRow(p, x0, x1, y0, y1, cuts = [], surf = 'white', depth = [], opts = {}, Z = ID) {
  const C = cuts.map((c) => (Array.isArray(c) ? c : [c, 2 * G])), xs = [[x0, 0], ...C, [x1, 0]];
  // (opts.cell: a coarser step across big slabs, for the two-storey walls)
  for (let i = 0; i < xs.length - 1; i++) p.slab(surf, xs[i][0] + xs[i][1] / 2, xs[i + 1][0] - xs[i + 1][1] / 2, y0 + G, y1 - G, Z(Z0), Z(WF + (depth[i] || 0)), { r: 0.007, skip: ['-z'], ...opts });
  for (const [x, w] of C) if (w > 0.03) p.slab('dark', x - w / 2, x + w / 2, y0, y1, Z(Z0), Z(WF - 0.045), { r: 0.004, skip: ['-z'], ...opts });
}
export function band(p, x0, x1, Z = ID) { p.slab('band', x0, x1, BAND[0] + G, BAND[1] - G, Z(Z0), Z(WF - 0.03), { r: 0.008, skip: ['-z'] }); }
export function backing(p, x0, x1, y0, y1, z0 = 0.03, z1 = Z0) { p.slab('dark', x0, x1, y0, y1, z0, z1, { r: 0, skip: ['-z'], cell: 0.5 }); }
// a wall's sizes: the station's numbers as they are, or a ship's (k: the width over the station's 2 m; the rest are
// heights and the doorway's sizes, worked out from the room's height and the doorway's)
const STATION_WALL = { w: 2, k: 1, h: H, top: TOP, Z: ID, T: ID, R: ID, pilaster: true, inset: [0.95, 2.36], sized: false, lean: false, ro: {},
  door: { hw: 0.55, top: 2.25, side: 0.62, back: 0.6, backY: 2.3, lintel: 2.32, plate: [2.4, 2.47], glow: [2.42, 2.45], ly: 2.43, win: [1.7, 2.05], winL: [1.725, 2.025], wy: 1.875, leaves: 2, near: 2.4, sense: 1.2, key: '' } };
function wallSizes(s) {
  if (!s) return STATION_WALL;
  const w = s.w ?? 2, h = s.h ?? H, top = s.top ?? TOP, D = s.depth, d = s.door || {}, hw = (d.w ?? 1.1) / 2, dt = d.h ?? 2.25, rel = D ? D.relief : 1;
  return { w, k: w / 2, h, top, Z: zOf(D), T: (t) => t * rel * 0.4, R: (x) => x * rel, pilaster: s.pilaster ?? true, inset: [0.95, top - 0.16], sized: true, lean: !!s.lean, ro: s.lean ? { skip: ['-z', '-x', '+x'] } : {},
    door: { hw, top: dt, side: hw + 0.07, back: hw + 0.05, backY: dt + 0.05, lintel: dt + 0.07, plate: [dt + 0.15, dt + 0.22], glow: [dt + 0.17, dt + 0.2], ly: dt + 0.18,
      win: [dt - 0.55, dt - 0.2], winL: [dt - 0.525, dt - 0.225], wy: dt - 0.375, leaves: d.leaves ?? 2, near: d.near ?? 2.4, sense: Math.min(1.2, dt / 2), key: `:${w}x${h}:${hw * 2}x${dt}:${d.leaves ?? 2}:${D ? D.face : ''}` } };
}
// one side of a wall, x from -1 to 1 (G in from each end): which panels it has
function wallSide(p, v, S) {
  const { k, h, top: TOP, Z, ro } = S, X0 = -k + G, X1 = k - G, K = (x) => x * k, topRow = () => { if (!S.lean) slabRow(p, X0, X1, TOP, h, [], 'white2', [], {}, Z); };
  if (v === 'plain') {
    backing(p, -k, k, 0, h, Z(0.03), Z(Z0));
    // two bays either side of a charcoal pilaster, so a dark upright comes every metre along a corridor
    const mid = S.pilaster ? [[0, S.lean ? 0.03 : 0.1]] : [0];
    slabRow(p, X0, X1, 0.15, BAND[0], mid, 'white', [0.025, 0], ro, Z); band(p, X0, X1, Z);
    slabRow(p, X0, X1, BAND[1], TOP, [...mid, [K(0.62), 0.05]], 'white', [0, 0.02, 0], ro, Z); topRow();
    if (S.pilaster) { p.slab('black', -0.055, 0.055, 0.1, TOP, Z(Z0), Z(WF + 0.09), { r: 0.016 }); p.slab('black', -0.075, 0.075, 0, 0.12, Z(Z0), Z(WF + 0.11), { r: 0.01 }); }
  } else if (v === 'dark') {
    // a big dark inset through the middle, framed in white (a sector name goes on it)
    const [i0, i1] = S.inset;
    backing(p, -k, k, 0, h, Z(0.03), Z(Z0));
    slabRow(p, X0, X1, 0.15, i0, [[K(0.2), 0.05]], 'white', [0.02, 0], {}, Z);
    slabRow(p, X0, K(-0.64), i0, BAND[0], [], 'white', [0.02], {}, Z); slabRow(p, K(0.64), X1, i0, BAND[0], [], 'white', [0.02], {}, Z);
    band(p, X0, K(-0.64), Z); band(p, K(0.64), X1, Z);
    slabRow(p, X0, K(-0.64), BAND[1], TOP, [], 'white', [0.02], {}, Z); slabRow(p, K(0.64), X1, BAND[1], TOP, [], 'white', [0.02], {}, Z); slabRow(p, K(-0.64), K(0.64), i1, TOP, [], 'white', [], {}, Z);
    p.slab('dark', K(-0.64) + G, K(0.64) - G, i0 + G, i1 - G, Z(Z0), Z(WF - 0.05), { r: 0.01, skip: ['-z'] });
    p.slab('black', K(-0.58), K(0.58), 0.99, 1.03, Z(WF - 0.05), Z(WF - 0.045), { r: 0.002, seg: 1, cell: 9 });
    topRow();
  } else if (v === 'locker') {
    // a service door with a handle, and a little panel of buttons beside it
    backing(p, -k, k, 0, h, Z(0.03), Z(Z0));
    slabRow(p, X0, -0.45, 0.15, BAND[0], [], 'white', [0.02], {}, Z); band(p, X0, -0.45, Z); slabRow(p, X0, -0.45, BAND[1], TOP, [], 'white', [0.02], {}, Z);
    slabRow(p, 0.45, X1, 0.15, BAND[0], [], 'white', [0.02], {}, Z); band(p, 0.45, X1, Z); slabRow(p, 0.45, X1, BAND[1], TOP, [], 'white', [0.02], {}, Z);
    // a cabinet standing out from the wall: its cheeks and cap, a dark plinth, the service door set in its front
    const CZ = Z(WF + 0.18), d = (z) => Z(WF + 0.18 + z);   // (depths measured from the cabinet's front)
    slabRow(p, -0.45, 0.45, 2.2, TOP, [], 'white', [], {}, Z);
    for (const sx of [-1, 1]) p.slab('white', sx > 0 ? 0.43 : -0.5, sx > 0 ? 0.5 : -0.43, 0.13, 2.2, Z(Z0), CZ, { r: 0.008 });
    p.slab('white', -0.5, 0.5, 2.14, 2.2, Z(Z0), CZ, { r: 0.008 }); p.slab('dark', -0.48, 0.48, 0, 0.13, Z(Z0), d(-0.03), { r: 0.008 });
    p.slab('dark', -0.43, 0.43, 0.13, 2.14, Z(Z0), Z(WF), { r: 0, skip: ['-z'] });
    p.slab('white2', -0.425, 0.425, 0.15, 2.12, d(-0.05), d(-0.008), { r: 0.008 });
    p.slab('band', -0.425, 0.425, BAND[0] + G, BAND[1] - G, d(-0.008), d(-0.002), { r: 0.004 });
    p.slab('black', 0.27, 0.32, 0.9, 1.16, d(-0.008), d(0.016), { r: 0.008 });                     // the handle
    for (let i = 0; i < 4; i++) p.slab('dark', -0.3, 0.1, 1.72 + i * 0.05, 1.735 + i * 0.05, d(-0.009), d(-0.004), { r: 0 }); // a vent
    if (X1 > 0.86) {
      p.slab('black', 0.6, 0.84, 1.62, 1.92, Z(WF + 0.02), Z(WF + 0.038), { r: 0.008 });                          // the button plate
      for (const [y, c] of [[1.85, 'orange'], [1.77, 'green'], [1.69, 'white']]) { p.cyl('grey', 0.018, S.R(0.012), [0.72, y, Z(WF + 0.042)], [PI / 2, 0, 0], 12); p.glowSlab(c, 0.705, 0.735, y - 0.012, y + 0.012, Z(WF + 0.048), Z(WF + 0.051)); }
    }
    topRow();
  } else if (v === 'window') {
    // a window to space in the upper half: a black frame through the wall, the glass, and nothing behind but stars
    if (S.sized && (TOP < 2.45 || k !== 1 || S.Z !== ID)) throw new Error('kit: the window wall comes only at the station\'s width and depth, under a cornice at 2.45 m or higher');
    const cy = 1.98, ww = 1.12, wh = 0.68;
    backing(p, -1, -0.62, 0, h, Z(0.03), Z(Z0)); backing(p, 0.62, 1, 0, h, Z(0.03), Z(Z0)); backing(p, -0.62, 0.62, 0, 1.56, Z(0.03), Z(Z0)); backing(p, -0.62, 0.62, 2.4, h, Z(0.03), Z(Z0));
    // (the hole's square corners, hidden behind the frame's rounded ones, so no sky shows round the frame)
    for (const sx of [-1, 1]) for (const [y0, y1] of [[1.56, 1.66], [2.3, 2.4]]) backing(p, sx > 0 ? 0.5 : -0.62, sx > 0 ? 0.62 : -0.5, y0, y1, Z(0.03), Z(Z0));
    slabRow(p, X0, X1, 0.15, BAND[0], [[-0.35, 0.06]], 'white', [0, 0.025], {}, Z); band(p, X0, X1, Z);
    slabRow(p, X0, -0.62, BAND[1], TOP, [], 'white', [0.02], {}, Z); slabRow(p, 0.62, X1, BAND[1], TOP, [], 'white', [0.02], {}, Z);
    slabRow(p, -0.62, 0.62, 2.4, TOP, [], 'white', [], {}, Z);
    p.sweep('black', rrect(0.1, 0.26, 0.014, 2, 0.05, 0.13), rectLoop(ww, wh, 0.14, { cy }), { closed: true });
    p.glass(ww + 0.02, wh + 0.02, [0, cy, 0.1]);
    // (the frame's corners are round and the hole in the wall is square: a dark fillet behind each corner)
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const x = sx * 0.59, y = cy + sy * 0.38; p.slab('dark', x - 0.035, x + 0.035, y - 0.045, y + 0.045, 0.03, Z0, { r: 0, cell: 9 }); }
    slabRow(p, X0, X1, TOP, h, [], 'white2', [], {}, Z);
  }
}
// variants: plain, dark, locker, window (one face each: the room is in +z), door, locked (a doorway, two faces).
// Sizes: w, h, top, depth, door, pilaster (see SIZES at the top).
export function wallPanel(p, v, s) {
  const S = wallSizes(s);
  if (v !== 'door' && v !== 'locked') return wallSide(p, v, S);
  // a doorway into a room: a wall with a face on both sides, a black frame through it, and two leaves that slide
  // apart into the wall (between the two faces) as someone comes near. 'locked': the same doorway shut for good (a
  // red light over it, and leaves with a dark panel where the open door's little windows are, so nobody sees past it).
  // (A ship's doorway may have one leaf, sliding to one side.) The leaves slide on past the panel's ends, into the
  // walls either side (their pocket).
  const { k, h, top: TOP, Z, door: D, ro } = S, X0 = -k + G, X1 = k - G, { hw, top } = D, locked = v === 'locked';
  for (const s of [0, 1]) {
    const q = new (p.constructor)();
    backing(q, -k, -D.back, 0, h, Z(0.03), Z(Z0)); backing(q, D.back, k, 0, h, Z(0.03), Z(Z0)); backing(q, -D.back, D.back, D.backY, h, Z(0.03), Z(Z0));
    if (X0 < -D.side - 0.03) { slabRow(q, X0, -D.side, 0.15, BAND[0], [], 'white', [0.02], {}, Z); band(q, X0, -D.side, Z); slabRow(q, X0, -D.side, BAND[1], TOP, [], 'white', [0.02], {}, Z); }
    if (X1 > D.side + 0.03) { slabRow(q, D.side, X1, 0.15, BAND[0], [], 'white', [0.02], {}, Z); band(q, D.side, X1, Z); slabRow(q, D.side, X1, BAND[1], TOP, [], 'white', [0.02], {}, Z); }
    slabRow(q, -D.side, D.side, D.lintel, TOP, [], 'white', [], ro, Z); if (!S.lean) slabRow(q, X0, X1, TOP, h, [], 'white2', [], {}, Z);
    q.slab('black', -0.3, 0.3, D.plate[0], D.plate[1], Z(WF), Z(WF + 0.02), { r: 0.008 }); q.glowSlab(locked ? 'red' : 'green', -0.26, 0.26, D.glow[0], D.glow[1], Z(WF + 0.02), Z(WF + 0.024));
    q.light([0, D.ly, Z(WF + 0.12)], 0.35, locked ? [1, 0.2, 0.15] : [0.3, 1, 0.5], [0, 0, 1], 3);
    for (const part of q.parts) { if (s) put(part.geo, [0, 0, 0], [0, PI, 0]); p.parts.push(part); }
    for (const L of q.lights) p.lights.push(s ? { ...L, at: [-L.at[0], L.at[1], -L.at[2]], dir: L.dir && [-L.dir[0], L.dir[1], -L.dir[2]] } : L);
  }
  p.sweep('black', rrect(0.1, Z(0.25) * 2, 0.015, S.lean ? 1 : 2, 0.05, 0), S.lean ? doorPath(hw, top, 0.12, { seg: 3, step: 3 }) : doorPath(hw, top, 0.12), {});
  p.slab('gun', -hw, hw, -0.02, 0.012, Z(-0.25), Z(0.25), { r: 0.006 });
  const one = D.leaves !== 2, lw = one ? 2 * hw + 0.04 : hw + 0.04;
  const leaf = (q) => {
    const w = lw, lh = top + 0.02;
    q.slab('white2', -w, -0.012, 0.01, lh, Z(-0.024), Z(0.024), { r: 0.012 });
    q.slab('black', -0.014, 0, 0.01, lh, Z(-0.027), Z(0.027), { r: 0.004 });
    q.slab('band', -w + 0.05, -0.06, BAND[0], BAND[1], Z(-0.028), Z(0.028), { r: 0.006 });
    q.slab('black', -w + 0.1, -0.11, D.win[0], D.win[1], Z(-0.026), Z(0.026), { r: 0.01 });
    if (locked) q.slab('dark', -w + 0.12, -0.13, D.winL[0], D.winL[1], Z(-0.0275), Z(0.0275), { r: 0.006 });
    else for (const z of [0.0262, -0.0262]) q.glass(w - 0.24, 0.3, [(-w + 0.1 - 0.11) / 2, D.wy, Z(z)], z < 0 ? [0, PI, 0] : null);
  };
  const key = (locked ? 'door-leaf-locked' : 'door-leaf') + D.key;
  if (!one) {
    p.leaf(key, leaf, { slide: [-(hw + 0.06), 0, 0], door: 0 });
    p.leaf(key, leaf, { rot: [0, PI, 0], slide: [hw + 0.06, 0, 0], door: 0 });
  } else if (D.leaves < 0) p.leaf(key, leaf, { at: [hw, 0, 0], slide: [-(2 * hw + 0.06), 0, 0], door: 0 });   // (one leaf, sliding off toward -x)
  else p.leaf(key, leaf, { at: [-hw, 0, 0], rot: [0, PI, 0], slide: [2 * hw + 0.06, 0, 0], door: 0 });
  if (!locked) p.door(0, [0, D.sense, 0], D.near);
}

// ── ribs and beams ────────────────────────────────────────────────────────────────────────────────────────────────
// the slant from the top of the wall up to the ceiling, as a box of thickness t sitting on the line from (y0, z0) at
// 45 degrees up and out to the ceiling (at h)
export function slant(p, surf, x0, x1, y0, z0, t, opts = {}, h = H) {
  const len = (h - y0) * Math.SQRT2, ny = -Math.SQRT1_2, nz = Math.SQRT1_2;
  const my = (y0 + h) / 2 - ny * t / 2, mz = z0 + (h - y0) / 2 - nz * t / 2;
  return p.box(surf, [x1 - x0, t, len + 0.04], [(x0 + x1) / 2, my, mz], [3 * PI / 4, 0, 0], { r: 0.01, ...opts });
}
// variants: strip (with its light strip), plain. Sizes: h, top, depth.
export function rib(p, v, s) {
  const { h, top: TOP, Z, T, sized } = wallSizes(s);
  // a stepped profile: a wide back plate on the wall, a narrower fin standing out from it, both running up into a
  // knee along the ceiling's slant; a foot at the floor
  p.slab('black', -0.13, 0.13, 0, TOP, Z(0.03), Z(0.21), { r: 0.018 });
  p.slab('black', -0.075, 0.075, 0.12, TOP - 0.05, Z(0.19), Z(RF), { r: 0.022 });
  p.slab('black', -0.15, 0.15, 0, 0.13, Z(0.03), Z(RF + 0.02), { r: 0.014 });
  slant(p, 'black', -0.13, 0.13, TOP - 0.03, Z(0.21), T(0.12), {}, h);
  slant(p, 'black', -0.075, 0.075, TOP - 0.09, Z(RF), T(0.2), {}, h);
  if (v === 'strip') {
    const y1 = sized ? TOP - 0.16 : 2.36;
    p.slab('dark', -0.03, 0.03, 0.72, y1, Z(RF - 0.01), Z(RF + 0.012), { r: 0.006 });
    p.glowSlab('white', -0.011, 0.011, 0.78, sized ? y1 - 0.06 : 2.3, Z(RF + 0.012), Z(RF + 0.017));
    for (const y of sized ? [1.0, 1.6, TOP - 0.3] : [1.0, 1.6, 2.2]) p.light([0, y, Z(RF + 0.08)], 1.25, [1, 0.98, 0.95], [0, 0, 1], 7);
  }
}
export function beam(p) { p.slab('black', -1, 1, H - 0.14, H + 0.02, -0.11, 0.11, { r: 0.02, skip: ['+y'] }); }

// ── trim ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// variants: base (a dark skirting), glow (a light strip along the floor's edge), cornice and cornice-grey (the slant
// from the top of the wall up to the ceiling). Sizes: w, h, top, depth.
export function trim(p, v, s) {
  const { k, h, top: TOP, Z, T } = wallSizes(s);
  if (v === 'base') p.slab('black', -k, k, 0, 0.15, Z(0.04), Z(WF + 0.03), { r: 0.012, skip: ['-z'] });
  else if (v === 'glow') { p.slab('black', -k, k, -0.012, 0.006, Z(WF + 0.03), Z(WF + 0.09), { r: 0.004, seg: 1 }); p.glowSlab('white', k === 1 ? -0.99 : -k + 0.01, k === 1 ? 0.99 : k - 0.01, 0.004, 0.009, Z(WF + 0.05), Z(WF + 0.07)); for (const x of [-0.66, 0, 0.66]) p.light([x * k, 0.05, Z(WF + 0.06)], 0.3 * k, [0.92, 0.96, 1], [0, 1, 0], 3.5); }
  else if (v === 'cornice' || v === 'cornice-grey') { slant(p, v === 'cornice' ? 'white' : 'grey2', -k + G, k - G, TOP, Z(WF), T(0.05), { skip: [] }, h); p.slab('black', -k, k, TOP - 0.035, TOP, Z(Z0), Z(WF + 0.008), { r: 0.006, skip: ['-z'] }); }
}

// ── corners: inside (two walls meeting round a room) and outside (a wall's end, round a corner) ────────────────────
// Sizes: h, top, depth (the post's depths go through the wall's, both ways)
export function corner(p, v, s) {
  const { h, top: TOP, Z, sized } = wallSizes(s);
  if (v === 'inside') {
    // the room is in +x, +z: a black post fills the corner, its 45-degree face lit
    // (drawn in x, -z and stood up: the outline's y becomes -z, the push becomes the height)
    p.extrude('black', [[0, 0], [Z(0.36), 0], [Z(0.36), -Z(0.17)], [Z(0.17), -Z(0.36)], [0, -Z(0.36)]], TOP, 0.012).rotateX(-PI / 2);
    slant2(p, h, TOP, Z);
    const sh = sized ? TOP - 0.07 - 0.75 : 1.7, sy = sized ? 0.75 + sh / 2 : 1.6;
    const g = bevelBox([0.05, sh, 0.012], [0, 0, 0], { r: 0.004, seg: 1, cell: 9 }); put(g, [Z(0.265), sy, Z(0.265)], [0, PI / 4, 0]); p.add('glow', g, 'white');
    for (const y of sized ? [1.0, 1.6, TOP - 0.3] : [1.0, 1.6, 2.2]) p.light([Z(0.32), y, Z(0.32)], 0.9, [0.93, 0.96, 1], [Math.SQRT1_2, 0, Math.SQRT1_2], 6);
    p.slab('black', 0, Z(0.38), 0, 0.13, 0, Z(0.38), { r: 0.012, skip: ['-y'] });
  } else {
    // outside: the walls run off in -x and -z; a rounded black post caps both their ends
    p.slab('black', Z(-0.06), Z(RF), 0, sized ? TOP + (h - TOP) * 0.75 : TOP + 0.36, Z(-0.06), Z(RF), { r: sized ? 0.03 : 0.07, seg: 4 });
    const sh = sized ? TOP - 0.07 - 0.75 : 1.7, sy = sized ? 0.75 + sh / 2 : 1.6;
    const g = bevelBox([0.04, sh, 0.012], [0, 0, 0], { r: 0.004, seg: 1, cell: 9 }); put(g, [Z(RF) - 0.012, sy, Z(RF) - 0.012], [0, PI / 4, 0]); p.add('glow', g, 'white');
    for (const y of sized ? [1.0, 1.6, TOP - 0.3] : [1.0, 1.6, 2.2]) p.light([Z(RF) + 0.06, y, Z(RF) + 0.06], 0.9, [0.93, 0.96, 1], [Math.SQRT1_2, 0, Math.SQRT1_2], 6);
  }
}
function slant2(p, h, TOP, Z) { // the corner post's top: up to the ceiling, out along both cornices
  p.slab('black', 0, Z(0.36), TOP, h, 0, Z(0.36), { r: 0.01 });
}

// ── the bulkhead with an arched hatch ─────────────────────────────────────────────────────────────────────────────
// It stands across a corridor on a grid point (the corridor's middle), 4 m wide: an off-white surround, a black rim
// with bolt flanges and tick marks round the arch, a yellow stripe inside the rim, dark latch blocks either side, and
// two leaves that slide apart into the bulkhead. variant 'arch' (a hatch), 'wide' (a broader arch, 1.6 m: two people
// pass each other in it, for the main ways through a station) or 'blind' (no opening: a corridor's end).
// Sizes: hw, spring, half, skin, core (as HATCH), h, k (everything round the arch, scaled), near, lean (the arch's
// rings swept in fewer steps, fewer bolts), portal (false: no
// posts and lintel round it).
export const HATCH = { hw: 0.56, spring: 1.66, half: 2, skin: 0.25, core: 0.06 };
export const HATCH_WIDE = { ...HATCH, hw: 0.8, spring: 1.5 };
function skinFace(p, z, holeR, D = HATCH) {
  // the surround's face at depth z: rings of quads from the arch hole out to the 4 x 3 m edge (denser near the hole).
  // Each point round the hole is joined to the point straight out from the arch's centre on the edge, and the two top
  // corners get a ray of their own so the rings reach right into them.
  const { spring, half } = D, Hh = D.h ?? H, m = new MeshData(), T = [0, 0.04, 0.12, 0.26, 0.48, 0.74, 1], inner = [], outer = [];
  const nUp = Math.ceil(spring / 0.25), ac = Math.atan2(Hh - spring, half), angles = [];
  for (let i = 0; i <= 20; i++) angles.push(Math.PI - Math.PI * i / 20);
  angles.push(Math.PI - ac, ac); angles.sort((a, b) => b - a);
  for (let i = 0; i < nUp; i++) { const y = spring * i / nUp; inner.push([-holeR, y]); outer.push([-half, y]); }
  for (const a of angles) {
    const c = Math.cos(a), s = Math.sin(a), t = Math.min(Math.abs(c) > 1e-9 ? half / Math.abs(c) : Infinity, s > 1e-9 ? (Hh - spring) / s : Infinity);
    inner.push([c * holeR, spring + s * holeR]); outer.push([c * t, spring + s * t]);
  }
  for (let i = nUp - 1; i >= 0; i--) { const y = spring * i / nUp; inner.push([holeR, y]); outer.push([half, y]); }
  for (let i = 0; i < inner.length; i++) for (const t of T) { const [ax, ay] = inner[i], [bx, by] = outer[i]; m.v(ax + (bx - ax) * t, ay + (by - ay) * t, z, 0, 0, Math.sign(z), ax + (bx - ax) * t, ay + (by - ay) * t); }
  const n = T.length;
  for (let i = 0; i < inner.length - 1; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j; m.quad(a, a + n, a + n + 1, a + 1); }
  return fixWinding(m.geometry());
}
export function hatch(p, v, s) {
  const D = s ? { ...(v === 'wide' ? HATCH_WIDE : HATCH), ...s } : v === 'wide' ? HATCH_WIDE : HATCH, { hw, spring, half, skin, core } = D, Hh = D.h ?? H;
  // (k scales everything round the arch: a number times k, or a height c + (y - c) k, are the station's own at k = 1)
  const k = D.k ?? 1, K = (x) => (k === 1 ? x : x * k), KY = (y, c) => (k === 1 ? y : c + (y - c) * k);
  if (v === 'blind') {
    for (const sg of [1, -1]) { p.slab('white', -half, half, 0, Hh, sg > 0 ? core : -skin, sg > 0 ? skin : -core, { r: 0.01, skip: [sg > 0 ? '-z' : '+z'], cell: 0.45 }); }
    p.slab('black', K(-1.0), K(1.0), KY(1.0, 1.8), KY(2.6, 1.8), -skin - K(0.04), skin + K(0.04), { r: 0.04 });
    for (const sg of [1, -1]) p.slab('white2', K(-0.84), K(0.84), KY(1.16, 1.8), KY(2.44, 1.8), sg > 0 ? skin + K(0.03) : -skin - K(0.05), sg > 0 ? skin + K(0.05) : -skin - K(0.03), { r: 0.012 });
    if (D.portal !== false) portal(p, D, K, Hh);
    return;
  }
  // round the opening, from the inside out (as the reference has it): the dark jamb, its face a broad dark ring; the
  // yellow stripe; a cream band with the bolts; the charcoal outer ring; tick marks on the wall beyond
  const J = K(0.13), Y = [K(0.125), K(0.153)], B = [K(0.15), K(0.28)], O = [K(0.275), K(0.39)], holeR = hw + K(0.14);
  for (const z of [skin, -skin]) p.add('solid', skinFace(p, z, holeR, D), 'white');
  // the bulkhead's own edges, closing the pocket between the two faces (hidden in a corridor, seen on its own)
  for (const sg of [-1, 1]) p.slab('white', sg > 0 ? half - 0.02 : -half, sg > 0 ? half : -half + 0.02, 0, Hh, -skin, skin, { r: 0.004, cell: 0.6 });
  p.slab('white', -half, half, Hh - 0.02, Hh, -skin, skin, { r: 0.004, cell: 0.6 });
  const R = (r0, r1, z0, z1, rr = 0.012) => rrect(r1 - r0, z1 - z0, rr, D.lean ? 1 : 2, (r0 + r1) / 2, (z0 + z1) / 2);
  const path = () => arch(hw, spring, D.lean ? { seg: 14, step: 1 } : { seg: 22, step: 0.4 });
  p.sweep('black', R(K(-0.002), J, -skin - K(0.03), skin + K(0.03), 0.016), path());
  for (const sg of [1, -1]) {
    const q = new (p.constructor)();
    q.sweep('yellow', R(Y[0], Y[1], skin - K(0.01), skin + K(0.026), 0.005), path());
    q.sweep('grey2', R(B[0], B[1], core, skin + K(0.02), 0.008), path());
    q.sweep('black', R(O[0], O[1], skin - K(0.01), skin + K(0.045), 0.016), path());
    for (const f of arch(hw + (B[0] + B[1]) / 2, spring, D.lean ? { seg: 8, step: 0.8 } : { seg: 12, step: 0.42 })) q.cyl('grey', K(0.013), K(0.012), [f.p.x, f.p.y, skin + K(0.024)], [PI / 2, 0, 0], D.lean ? 6 : 10);
    for (let i = 0; i <= 8; i++) { const a = PI * i / 8, c = Math.cos(a), sn = Math.sin(a), r0 = hw + O[1] + K(0.03), r1 = r0 + K(0.08); q.box('black', [K(0.016), r1 - r0, K(0.012)], [c * (r0 + r1) / 2, spring + sn * (r0 + r1) / 2, skin + K(0.006)], [0, 0, a - PI / 2]); }
    // the latches: two blocks on one side, one bigger with a round lock face on the other, each on a bracket plate,
    // a level rod running out of each across the wall
    const ox = hw + O[1] - K(0.02);
    for (const y of [KY(0.9, 1.29), KY(1.68, 1.29)]) {
      q.slab('dark', -(ox + K(0.24)), -(ox - K(0.01)), y - K(0.16), y + K(0.16), skin, skin + K(0.035), { r: 0.01 });
      q.slab('black', -(ox + K(0.19)), -(ox + K(0.01)), y - K(0.12), y + K(0.12), skin + K(0.025), skin + K(0.12), { r: 0.022 });
      q.slab('black', -(ox + K(0.17)), -(ox + K(0.03)), y - K(0.08), y + K(0.08), skin + K(0.11), skin + K(0.15), { r: 0.016 });
      q.box('black', [K(0.16), K(0.05), K(0.05)], [-(ox + K(0.19) + K(0.07)), y, skin + K(0.06)], null, { r: 0.012 });
    }
    q.slab('dark', ox - K(0.01), ox + K(0.28), KY(1.04, 1.29), KY(1.54, 1.29), skin, skin + K(0.035), { r: 0.01 });
    q.slab('black', ox + K(0.01), ox + K(0.24), KY(1.09, 1.29), KY(1.49, 1.29), skin + K(0.025), skin + K(0.12), { r: 0.022 });
    q.cyl('gun', K(0.065), K(0.03), [ox + K(0.125), 1.29, skin + K(0.135)], [PI / 2, 0, 0], 20); q.cyl('dark', K(0.035), K(0.04), [ox + K(0.125), 1.29, skin + K(0.155)], [PI / 2, 0, 0], 16);
    q.slab('black', ox + K(0.17), ox + K(0.21), KY(1.42, 1.29), KY(1.46, 1.29), skin + K(0.12), skin + K(0.125), { r: 0.002 }); q.glowSlab('amber', ox + K(0.175), ox + K(0.205), KY(1.425, 1.29), KY(1.455, 1.29), skin + K(0.125), skin + K(0.128));
    q.box('black', [K(0.16), K(0.05), K(0.05)], [ox + K(0.24) + K(0.07), 1.29, skin + K(0.06)], null, { r: 0.012 });
    // thin level rods standing out from the outer ring, each with a little end cap
    for (const [sx, y] of [[-1, KY(0.45, 1.29)], [-1, 1.29], [1, KY(0.45, 1.29)], [1, KY(0.9, 1.29)], [1, KY(1.68, 1.29)]]) { const x0 = hw + O[1] - 0.01, x1 = Math.min(sx > 0 ? x0 + K(0.2) : x0 + K(0.42), half - K(0.56)); if (x1 <= x0) continue; q.box('black', [x1 - x0, K(0.024), K(0.024)], [sx * (x0 + x1) / 2, y, skin + K(0.035)], null, { r: 0 }); q.box('dark', [K(0.03), K(0.04), K(0.04)], [sx * x1, y, skin + K(0.035)], null, { r: 0 }); }
    q.light([ox + K(0.17), KY(1.42, 1.29), skin + K(0.18)], 0.12, [1, 0.75, 0.35], [0, 0, 1], 2);
    for (const part of q.parts) { if (sg < 0) put(part.geo, [0, 0, 0], [0, PI, 0]); p.parts.push(part); }
    for (const L of q.lights) p.lights.push(sg < 0 ? { ...L, at: [-L.at[0], L.at[1], -L.at[2]], dir: L.dir && [-L.dir[0], L.dir[1], -L.dir[2]] } : L);
  }
  if (D.portal !== false) portal(p, D, K, Hh);
  // the threshold: a raised plate through the opening
  p.slab('gun', -hw, hw, -0.02, 0.012, -skin - K(0.03), skin + K(0.03), { r: 0.006 });
  floorQuad(p, 'grating', -hw + 0.03, hw - 0.03, -skin + 0.01, skin - 0.01, 0.0125, { v0: 0.05, v1: 0.2, u0: 0.2, u1: 0.5 });
  // the leaves: half an arch each, sliding apart into the bulkhead's pocket
  // (a leaf's half thickness, and its trims' a little more: the station's, or thinner in a thin bulkhead)
  const lz = s ? Math.min(0.026, core * 0.43) : 0.026, L2 = s ? 2 * lz : 0.052, La = s ? lz + 0.004 : 0.03, Lb = s ? lz + 0.003 : 0.029;
  const leaf = (q) => {
    const w = hw + 0.05, top = spring + w, pts = [[0, 0.004], [-w, 0.004], [-w, spring]];
    for (let i = 1; i <= 12; i++) { const a = PI - PI / 2 * i / 12; pts.push([i === 12 ? 0 : Math.cos(a) * w, i === 12 ? top : spring + Math.sin(a) * w]); }
    q.extrude('white2', pts, L2, 0.012, { crease: 0.6 }).translate(0, 0, -lz);
    q.slab('black', -0.016, 0, 0.004, top - 0.001, -La, La, { r: 0.005 });
    q.slab('band', -w + 0.04, -0.05, 1.02, 1.3, -La, La, { r: 0.006 });
    q.slab('dark', -w + 0.06, -0.07, 1.7, 1.74, -Lb, Lb, { r: 0.004 });
  };
  const key = (v === 'wide' ? 'hatch-leaf-wide' : 'hatch-leaf') + (s ? `:${hw}x${spring}x${lz}` : '');
  p.leaf(key, leaf, { slide: [-(hw + 0.1), 0, 0], door: 0 });
  p.leaf(key, leaf, { rot: [0, PI, 0], slide: [hw + 0.1, 0, 0], door: 0 });
  p.door(0, [0, 1.2, 0], D.near ?? 2.8);
}
// charcoal posts and a lintel framing the bulkhead's faces, so the corridor closes in round the hatch
function portal(p, D = HATCH, K = ID, Hh = H) {
  const { half, skin } = D;
  for (const sg of [1, -1]) {
    const Z = (a, b) => (sg > 0 ? [skin + a, skin + b] : [-skin - b, -skin - a]);
    for (const sx of [-1, 1]) {
      p.slab('black', sx > 0 ? half - K(0.52) : -half + K(0.26), sx > 0 ? half - K(0.26) : -half + K(0.52), 0, Hh, ...Z(K(-0.01), K(0.1)), { r: 0.02 });
      p.slab('black', sx > 0 ? half - K(0.52) : -half + K(0.4), sx > 0 ? half - K(0.4) : -half + K(0.52), 0, Hh - K(0.27), ...Z(K(0.09), K(0.18)), { r: 0.022 });
    }
    p.slab('black', -half + K(0.26), half - K(0.26), Hh - K(0.27), Hh, ...Z(K(-0.01), K(0.1)), { r: 0.02, skip: ['+y'] });
    p.slab('black', -half + K(0.4), half - K(0.4), Hh - K(0.27), Hh - K(0.19), ...Z(K(0.09), K(0.18)), { r: 0.02 });
  }
}
