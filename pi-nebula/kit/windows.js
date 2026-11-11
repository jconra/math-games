// WINDOW WALLS and the band between storeys.
//   pane    an EDGE piece, a 3 m wall panel like the others, with a window band across it at eye level (1.05 m to
//           2.2 m). Panels side by side make one long window with a rounded end at each end (a stadium):
//             middle      the glass runs edge to edge, a slim upright at each joint
//             end-left    the band starts in from the panel's left edge with a half-round end and runs to its right edge
//             end-right   the same, the other way round (wall panels face one way only, so the mirror is its own variant)
//           so any run is end-left + middles + end-right. The glass is the kit's one glass material (piece.glass /
//           'glass'): nothing solid stands behind it, so whatever the scene shows outside (the sky) shows through.
//   filler  an EDGE piece, the 1 m between two storeys (decks are 4 m apart, rooms 3 m): two-storey rooms stack the
//           ordinary 3 m panels, deck 0 and deck 1, with this between them. Drawn from 3 m to 4 m.
//             band    a dark band with a channel along it (the corridor's dark band, a storey up)
//             ledge   the same with a charcoal ledge along its foot, sitting on the knees of the ribs below, and a light
//                     washing down the wall under it
import * as THREE from 'three';
import { WALL_FACE as WF, ROOM_H as H } from './grid.js';
import { rrect, put, flat, fixWinding } from './geo.js';
import { slabRow, backing, band, G, Z0, BAND, TOP } from './shell.js';

const PI = Math.PI;
export const BIG_H = 7;                       // a two-storey room, floor to ceiling (a deck of 4 m and a room of 3 m)
export const GZ = 0.1;                        // the glass line, in from the wall line (inside the wall's depth)
export const WIN = { y0: 1.05, y1: 2.2 };     // the window band, at eye level
const R = (WIN.y1 - WIN.y0) / 2, YC = (WIN.y0 + WIN.y1) / 2, MW = 0.02;   // the round end's radius; the band's middle; half a joint
const XC = -0.05;                             // the round end's centre, in an end panel (its left-most point 0.38 m in from the edge)
const RIM = 0.09, RD = [0.02, WF + 0.05];     // the charcoal rim round the opening: its width, and depth (z from, to)

// the opening's edge as a path (profile x pointing out of the opening, profile y along +z): from x = xr along the
// bottom to the round end, round it, and back along the top to x = xr
function rimPath(xr) {
  const pts = [], Y = new THREE.Vector3(0, 0, 1), add = (x, y, nx, ny) => pts.push({ p: new THREE.Vector3(x, y, 0), x: new THREE.Vector3(nx, ny, 0), y: Y.clone() });
  for (let i = 0; i <= 3; i++) add(xr + (XC - xr) * i / 3, WIN.y0, 0, -1);
  for (let i = 1; i < 24; i++) { const a = -PI / 2 - PI * i / 24, c = Math.cos(a), s = Math.sin(a); add(XC + c * R, YC + s * R, c, s); }
  for (let i = 0; i <= 3; i++) add(XC + (xr - XC) * i / 3, WIN.y1, 0, 1);
  return pts;
}
function sill(p, x0, x1, roundLeft) {
  // the sill: a charcoal ledge under the band, a soft glow along its front lip lighting the wall below
  p.slab('black', x0, x1, WIN.y0 - 0.1, WIN.y0 + 0.006, RD[0], WF + 0.15, { r: 0.016, cell: 0.6 });
  if (roundLeft) p.cyl('black', 0.053, WF + 0.13 - RD[0], [x0, WIN.y0 - 0.047, (RD[0] + WF + 0.15) / 2], [PI / 2, 0, 0], 16);
  p.glowSlab('soft', x0 + 0.03, x1 - 0.03, WIN.y0 - 0.106, WIN.y0 - 0.1, WF + 0.1, WF + 0.14);
  for (let x = x0 + 0.5; x < x1; x += 1) p.light([x, WIN.y0 - 0.3, WF + 0.3], 0.35, [0.92, 0.96, 1], [0, -0.6, 0.8], 3);
}
function endPanel(p) {
  // a band that starts with a half-round end and runs to the panel's right edge
  const X0 = -1 + G, X1 = 1 - G, xL = XC - R - 0.1;
  backing(p, -1, 1, 0, WIN.y0); backing(p, -1, 1, WIN.y1, H); backing(p, -1, xL + 0.02, WIN.y0, WIN.y1);
  // the wall left of the window (with the dark band through it, like its neighbours), and above and below the band
  slabRow(p, X0, xL, 0.15, BAND[0]); band(p, X0, xL); slabRow(p, X0, xL, BAND[1], TOP);
  slabRow(p, xL, X1, 0.15, WIN.y0 - 0.03, [], 'white', [0.02]);
  slabRow(p, xL, X1, WIN.y1 + 0.03, H, [], 'white'); slabRow(p, X0, xL, TOP, H, [], 'white2');
  // the two curved corners between the round end and the straight wall beside it: one outline from the bottom left,
  // along under the band to the round end, round it (just outside the glass, under the rim), back to the top left
  const out = [[xL - 0.002, WIN.y0 - 0.03], [XC, WIN.y0 - 0.03]];
  for (let i = 1; i < 24; i++) { const a = -PI / 2 - PI * i / 24, rr = R + 0.03; out.push([XC + Math.cos(a) * rr, YC + Math.sin(a) * rr]); }
  out.push([XC, WIN.y1 + 0.03], [xL - 0.002, WIN.y1 + 0.03]);
  p.extrude('white', out, WF - Z0, 0.006).translate(0, 0, Z0);
  // the rim round the opening, the sill, the glass (half a stadium), the half joint at the right edge
  p.sweep('black', rrect(RIM, RD[1] - RD[0], 0.012, 2, RIM / 2 - 0.01, (RD[0] + RD[1]) / 2), rimPath(1));
  sill(p, XC, 1, true);
  const gl = [[1 - MW + 0.002, WIN.y0], [XC, WIN.y0]];
  for (let i = 1; i < 24; i++) { const a = -PI / 2 - PI * i / 24; gl.push([XC + Math.cos(a) * R, YC + Math.sin(a) * R]); }
  gl.push([XC, WIN.y1], [1 - MW + 0.002, WIN.y1]);
  p.add('glass', flat(gl, GZ));
  p.slab('black', 1 - MW, 1, WIN.y0, WIN.y1, RD[0], 0.17, { r: 0.006, cell: 0.6 });
}
export function pane(p, v) {
  if (v === 'end-left') return endPanel(p);
  if (v === 'end-right') {
    // the left end, mirrored
    const q = new (p.constructor)(); endPanel(q);
    for (const part of q.parts) { put(part.geo, [0, 0, 0], [0, 0, 0], [-1, 1, 1]); fixWinding(part.geo); p.parts.push(part); }
    for (const L of q.lights) p.lights.push({ ...L, at: [-L.at[0], L.at[1], L.at[2]], dir: L.dir && [-L.dir[0], L.dir[1], L.dir[2]] });
    return;
  }
  // middle: the band from edge to edge
  const X0 = -1 + G, X1 = 1 - G;
  backing(p, -1, 1, 0, WIN.y0); backing(p, -1, 1, WIN.y1, H);
  slabRow(p, X0, X1, 0.15, WIN.y0 - 0.03, [], 'white', [0.02]);
  slabRow(p, X0, X1, WIN.y1 + 0.03, H, [], 'white');
  p.slab('black', -1, 1, WIN.y1 - 0.006, WIN.y1 + RIM, RD[0], RD[1], { r: 0.012, cell: 0.6 });
  sill(p, -1, 1, false);
  p.glass(2 - 2 * MW + 0.004, WIN.y1 - WIN.y0, [0, YC, GZ]);
  for (const s of [-1, 1]) p.slab('black', s > 0 ? 1 - MW : -1, s > 0 ? 1 : -1 + MW, WIN.y0, WIN.y1, RD[0], 0.17, { r: 0.006, cell: 0.6 });
}

// ── the band between storeys ──────────────────────────────────────────────────────────────────────────────────────
const F0 = H, F1 = H + 1;      // it fills 3 m to 4 m
export function filler(p, v) {
  backing(p, -1, 1, F0, F1);
  p.slab('black', -1, 1, F0, F0 + 0.08, Z0, WF + 0.04, { r: 0.012, skip: ['-z'], cell: 0.7 });
  p.slab('black', -1, 1, F1 - 0.08, F1, Z0, WF + 0.04, { r: 0.012, skip: ['-z'], cell: 0.7 });
  p.slab('band', -1 + G, 1 - G, F0 + 0.08 + G, F1 - 0.08 - G, Z0, WF - 0.01, { r: 0.008, skip: ['-z'], cell: 0.7 });
  // a dark channel along the middle
  p.slab('dark', -1, 1, F0 + 0.46, F0 + 0.54, WF - 0.012, WF + 0.004, { r: 0.004, cell: 0.7 });
  if (v === 'ledge') {
    // a ledge on the ribs' knees, a light under its lip washing down the wall
    p.slab('black', -1, 1, F0 - 0.02, F0 + 0.1, Z0, 0.76, { r: 0.02, cell: 0.7 });
    p.slab('dark', -1, 1, F0 - 0.04, F0 - 0.02, 0.6, 0.74, { r: 0.004, cell: 0.7 });
    p.glowSlab('soft', -0.98, 0.98, F0 - 0.046, F0 - 0.04, 0.63, 0.71);
    for (const x of [-0.5, 0.5]) p.light([x, F0 - 0.2, 0.68], 0.9, [1, 0.98, 0.95], [0, -1, 0], 6);
  }
}
