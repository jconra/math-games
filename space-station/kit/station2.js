// THE STATION'S BUILD-OUT: the pieces the three big hangars and the rooms off them need, beyond the first kit.
//   baydoor2   the big hangars' door, a POINT piece on an 11 m wall: a 22 x 9 m opening to space in charcoal jambs and
//              a lintel (24 m wide in all), the shield across it, emitters down the jambs and along the sill, the apron
//   wall3      a third storey's wall panel (8 m to 11 m up, where nobody stands): two plain plates, or a vent
//   hatchshut  a wide hatch in a room's wall that is sealed: shut for good, a red light over it (only the room's side
//              of it is built; whatever is fitted behind it later swaps it for the open hatch)
//   pad        a big landing pad's paint: a circle 18 m across, ticks, a cross ('ring 1': and its name, PAD 1)
//   board      whose hangar this is: the crew's card in a lit frame ('medic', 'mining', 'explore'; '... big' for a
//              hangar's wall, 2.4 m wide)
//   truss2     a big hangar's roof truss, one piece for the whole 28 m span: its light bar, and four high-bay lamps
//              beside its bottom chord (dark shades, a pool of light on the floor far below)
//   standin    a STAND-IN for a prop that is still to be designed: a plain mid-grey block or drum of its size, so a
//              room's walking room and sight lines can be judged ('box WxHxD', 'cyl RxH' standing, 'cylx RxL' lying)
import { WALL_FACE as WF, ROOM_H as H } from './grid.js';
import { MeshData, plane, put, fixWinding, cylinder } from './geo.js';
import { floorQuad, backing, slabRow, hatch, G, Z0 } from './shell.js';
import { kitTextures } from './materials.js';
import { SCREEN_RECT, CREWS } from './tex.js';

const PI = Math.PI;
// a decal lying on the floor (facing up), w along x by d along z, centred at (x, z), turned by a about the up axis
function floorDecal(p, rect, w, d, x, z, a = 0, tint = '#d9b23a', y = 0.004) {
  const r = kitTextures().decal.rect[rect], g = plane(w, d, { uv: r, cell: 9 });
  put(g, [0, 0, 0], [-PI / 2, 0, 0]); put(g, [x, y, z], [0, a, 0]); return p.add('decal', g, tint);
}
// a ring of paint on the floor, radius r0 to r1
function floorRing(p, r0, r1, tint, n = 96, y = 0.004) {
  const rect = kitTextures().decal.rect.solid, u = (rect[0] + rect[2]) / 2, v = (rect[1] + rect[3]) / 2, m = new MeshData();
  for (let i = 0; i <= n; i++) { const a = PI * 2 * i / n, c = Math.cos(a), s = Math.sin(a); m.v(c * r0, y, s * r0, 0, 1, 0, u, v); m.v(c * r1, y, s * r1, 0, 1, 0, u, v); }
  for (let i = 0; i < n; i++) m.quad(i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  return p.add('decal', fixWinding(m.geometry()), tint);
}

// ── the big hangars' door ─────────────────────────────────────────────────────────────────────────────────────────
// (the first hangar's door, kit/hangar.js, at the size the ships need: they are up to 16.3 m across and 7.3 m tall)
export const DOOR2 = { w: 22, h: 9, wall: 11, jamb: 1 };
const DW = DOOR2.w / 2, DH = DOOR2.h, HH = DOOR2.wall, DZ0 = -0.7, DZ1 = 0.5;
export function bayDoor2(p) {
  const o = { r: 0.03, cell: 1.5, loops: [0.08] }, c = { r: 0.02, cell: 1.5 };
  const hazard = (w, h, x, y) => { const g = plane(w, h, { uv: kitTextures().decal.rect.hazard, cell: 9 }); put(g, [x, y, DZ1 + 0.122]); p.add('decal', g, '#d9b23a'); };
  // the jambs and the lintel: massive charcoal blocks, a gunmetal plate on each one's room face
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -DW - 1 : DW, x1 = s < 0 ? -DW : DW + 1;
    p.slab('black', x0, x1, 0, HH, DZ0, DZ1, o);
    p.slab('gun', s < 0 ? x0 + 0.15 : x0 + 0.3, s < 0 ? x1 - 0.3 : x1 - 0.15, 0.2, DH - 0.2, DZ1, DZ1 + 0.12, c);
    // the shield's emitter down the jamb's inner face, a glowing blue channel
    const [d0, d1] = s < 0 ? [-DW - 0.08, -DW + 0.01] : [DW - 0.01, DW + 0.08], [e0, e1] = s < 0 ? [-DW - 0.005, -DW + 0.012] : [DW - 0.012, DW + 0.005];
    p.slab('dark', d0, d1, 0.05, DH - 0.05, -0.12, 0.12, { r: 0.01, cell: 1.5 });
    p.glowSlab('blue', e0, e1, 0.1, DH - 0.1, -0.05, 0.05);
    for (let y = 0.8; y < DH; y += 1.6) p.light([s * (DW - 0.4), y, 0.4], 1.2, [0.35, 0.7, 1.4], [-s, 0, 0.5], 7);
    // hazard stripes up the jamb's room face, to head height
    for (let k = 0; k < 3; k++) hazard(1.4, 0.36, (x0 + x1) / 2, 0.45 + k * 0.6);
  }
  p.slab('black', -DW - 1, DW + 1, DH, HH, DZ0, DZ1, o);
  p.slab('gun', -DW, DW, DH + 0.3, HH - 0.25, DZ1, DZ1 + 0.12, c);
  // the big door itself, slid up into the lintel: its heavy bottom edge shows in the slot
  p.slab('grey', -DW + 0.02, DW - 0.02, DH - 0.14, DH + 0.01, -0.32, 0.1, c);
  for (let x = -DW + 0.6; x < DW; x += 1.2) p.slab('black', x - 0.04, x + 0.04, DH - 0.12, DH - 0.01, 0.09, 0.125, { r: 0.006 });
  // stripes along the lintel's room face, and the shield emitter along its underside
  for (let x = -DW + 0.7; x < DW; x += 1.4) hazard(1.4, 0.32, x, DH + 0.52);
  p.glowSlab('blue', -DW + 0.05, DW - 0.05, DH - 0.025, DH - 0.02, 0.22, 0.3);
  // the sill: a heavy plate with the third emitter, a glowing slot across the floor
  p.slab('gun', -DW, DW, -0.03, 0.02, DZ0, DZ1, { r: 0.008, cell: 1.5 });
  p.slab('dark', -DW + 0.05, DW - 0.05, 0.015, 0.025, -0.08, 0.08, { r: 0.004, cell: 1.5 });
  p.glowSlab('blue', -DW + 0.1, DW - 0.1, 0.02, 0.026, -0.03, 0.03);
  for (let x = -DW + 1; x < DW; x += 2.5) p.light([x, 0.4, 0.5], 0.8, [0.35, 0.7, 1.4], [0, 0.4, 0.9], 5);
  // the shield: one sheet across the whole opening, in nine parts so its glowing rim is as broad as the first door's
  // (the shield's rim is worked out from the sheet's own 0..1 across and up: the middle parts hold it at a half)
  const m = new MeshData(), xs = [-DW, -DW + 7, DW - 7, DW], us = [0, 0.5, 0.5, 1], ys = [0, 2.8, DH - 2.8, DH], vs = [0, 0.5, 0.5, 1];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) m.v(xs[i], ys[j], 0, 0, 0, 1, us[i], vs[j]);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const q = j * 4 + i; m.quad(q, q + 1, q + 5, q + 4); }
  p.add('shield', fixWinding(m.geometry()));
  for (let i = 0; i < 6; i++) for (const y of [1.4, 4.2, 7.0]) p.light([-DW + (i + 0.5) * DW / 3, y, 0.6], 2.2, [0.3, 0.65, 1.3], [0, 0, 1], 10);
  // the apron outside: a deck 4 m deep, a charcoal edge, lights along it (amber at the corners)
  for (let x = -DW + 1; x < DW; x += 2) floorQuad(p, 'tread', x - 1, x + 1, DZ0 - 4, DZ0, 0);
  p.slab('black', -DW - 1, DW + 1, -0.35, 0.0, DZ0 - 4.2, DZ0 - 4, c);
  for (const s of [-1, 1]) p.slab('black', s < 0 ? -DW - 1 : DW, s < 0 ? -DW : DW + 1, -0.35, 0.12, DZ0 - 4.2, DZ0, c);
  p.slab('dark', -DW - 1, DW + 1, -0.4, -0.35, DZ0 - 4.2, DZ0, { r: 0, cell: 9 });
  for (let x = -DW + 0.5; x <= DW - 0.5; x += 1) { const amber = Math.abs(x) > DW - 1; p.slab('black', x - 0.07, x + 0.07, 0, 0.03, DZ0 - 4.1, DZ0 - 3.96, { r: 0.008 }); p.glowSlab(amber ? 'amber' : 'white', x - 0.05, x + 0.05, 0.03, 0.036, DZ0 - 4.08, DZ0 - 3.98); }
}

// ── a third storey's wall panel ───────────────────────────────────────────────────────────────────────────────────
// drawn from 0 to 3 m like any wall panel; the layout stands it on deck 2 (8 m up)
export function wall3(p, v) {
  backing(p, -1, 1, 0, H);
  const o = { cell: 1.5, loops: [] };
  if (v === 'vent') {
    slabRow(p, -1 + G, 1 - G, 0, 0.7, [], 'white2', [], o);
    slabRow(p, -1 + G, -0.6, 0.7, 1.9, [], 'white2', [], o); slabRow(p, 0.6, 1 - G, 0.7, 1.9, [], 'white2', [], o);
    slabRow(p, -1 + G, 1 - G, 1.9, H, [], 'white2', [], o);
    p.slab('dark', -0.6, 0.6, 0.7, 1.9, Z0, WF - 0.06, { r: 0, skip: ['-z'], cell: 9, loops: [] });
    for (let k = 0; k < 6; k++) p.box('black', [1.16, 0.03, 0.12], [0, 0.82 + k * 0.2, WF - 0.05], [0.6, 0, 0], { r: 0.004, cell: 9, loops: [] });
  } else slabRow(p, -1 + G, 1 - G, 0, H, [0], 'white2', [0.015, 0], o);
}

// ── a sealed hatch ────────────────────────────────────────────────────────────────────────────────────────────────
// the wide hatch as it shows from the room it is in (which is on +z): its far face is left out, and its leaves have
// no door to open them
export function hatchShut(p) {
  const q = new (p.constructor)(); hatch(q, 'wide');
  for (const part of q.parts) { part.geo.computeBoundingBox(); if (part.geo.boundingBox.max.z < -0.02) continue; p.parts.push(part); }
  for (const L of q.lights) if (L.at[2] > 0) p.lights.push(L);
  for (const mv of q.movers) p.movers.push(mv);
  // sealed: a red light on the lintel, stripes on the floor across the way in
  p.slab('black', -0.3, 0.3, 2.83, 2.93, 0.34, 0.372, { r: 0.008 }); p.glowSlab('red', -0.26, 0.26, 2.855, 2.905, 0.372, 0.376);
  p.light([0, 2.88, 0.5], 0.5, [1, 0.2, 0.15], [0, 0, 1], 3.5);
  floorDecal(p, 'hazard', 2.0, 0.36, 0, 0.68);
}

// ── a big landing pad's paint ─────────────────────────────────────────────────────────────────────────────────────
export const PAD_R = 9;
export function pad(p, v) {
  const Y = '#d9b23a', Wt = '#d9d7cf';
  floorRing(p, PAD_R - 0.25, PAD_R, Y); floorRing(p, PAD_R - 0.7, PAD_R - 0.62, Y);
  for (let k = 0; k < 4; k++) { const a = k * PI / 2; floorDecal(p, 'solid', 0.14, 1.2, Math.cos(a) * (PAD_R + 0.6), Math.sin(a) * (PAD_R + 0.6), -a + PI / 2, Wt); }
  for (let k = 0; k < 32; k++) { const a = (k + 0.5) * PI / 16, r = PAD_R - 0.45; floorDecal(p, 'solid', 0.06, 0.26, Math.cos(a) * r, Math.sin(a) * r, -a + PI / 2, Y); }
  floorDecal(p, 'solid', 2.4, 0.14, 0, 0, 0, Wt); floorDecal(p, 'solid', 0.14, 2.4, 0, 0, 0, Wt);
  floorRing(p, 0.7, 0.8, Wt, 48);
  if (v === 'ring 1') { floorDecal(p, 'label:PAD 1', 3.2, 0.8, 0, PAD_R - 1.6, 0, Wt); floorDecal(p, 'label:PAD 1', 3.2, 0.8, 0, -(PAD_R - 1.6), PI, Wt); }
}

// ── whose hangar this is ──────────────────────────────────────────────────────────────────────────────────────────
// a wall-kit item (its middle at y = 0, its back on z = 0): the crew's card from the screens' sheet in a charcoal frame,
// a strip of the crew's colour under it
const CREW_GLOW = { medic: 'red', mining: 'orange', explore: 'green', security: 'blue' };
const CREW_LIGHT = { medic: [1, 0.42, 0.35], mining: [1, 0.65, 0.23], explore: [0.37, 0.88, 0.54], security: [0.4, 0.6, 1] };
export function board(p, v) {
  const big = v.endsWith(' big'), crew = CREWS[v.replace(/ big$/, '')] ? v.replace(/ big$/, '') : 'medic';
  const w = big ? 2.4 : 0.84, h = w / 1.5, f = big ? 0.08 : 0.04, d = big ? 0.1 : 0.06;
  p.slab('black', -w / 2 - f, w / 2 + f, -h / 2 - f * 1.6, h / 2 + f, 0, d, { r: 0.02, cell: 1.5 });
  p.screen(SCREEN_RECT['crew:' + crew], w, h, [0, 0, d + 0.002], null, 1.25);
  p.glowSlab(CREW_GLOW[crew], -w / 2, w / 2, -h / 2 - f * 1.2, -h / 2 - f * 0.5, d - 0.01, d + 0.004);
  p.light([0, 0, 0.6], big ? 1.6 : 0.5, CREW_LIGHT[crew], [0, 0, 1], big ? 5 : 3);
}

// ── a big hangar's roof truss ─────────────────────────────────────────────────────────────────────────────────────
// ONE truss for the whole 28 m span (a POINT piece: it runs along x, its middle on the point), drawn at an 11 m roof's
// height: two flat frames side by side (chords top and bottom, a post every 2 m, a diagonal in every bay, leaning to
// the middle), a light bar under it, and four high-bay lamps tucked beside its bottom chord (nothing hangs lower than
// the light bar, so a crane's track can run under the trusses). The lamps are what light the floor far below.
export const TRUSS2 = { span: 28, top: DOOR2.wall - 0.05, bottom: 9.5, lamps: [-10.5, -3.5, 3.5, 10.5] };
function lamp(p, x, z) {
  const yb = TRUSS2.bottom, s = Math.sign(z);
  p.slab('black', x - 0.03, x + 0.03, yb + 0.03, yb + 0.09, Math.min(0, z), Math.max(0, z), { r: 0, cell: 9, loops: [] });   // (its arm off the chord)
  p.lathe('black', [[0.05, yb + 0.44], [0.12, yb + 0.42], [0.2, yb + 0.32], [0.42, yb + 0.0], [0.44, yb - 0.02], [0.4, yb - 0.015], [0.18, yb + 0.3], [0.05, yb + 0.38]], 14, [x, 0, z]);
  p.add('glow', cylinder(0.19, 0.02, [x, yb + 0.26, z], 14), 'white');
  p.light([x, yb - 0.25, z + s * 0.02], 50, [1, 0.97, 0.9], [0, -1, 0], 16);
}
export function truss2(p) {
  const L = TRUSS2.span / 2, yt = TRUSS2.top, yb = TRUSS2.bottom, o = { r: 0, cell: 40, loops: [] };
  for (const z of [-0.15, 0.15]) {
    p.slab('black', -L, L, yt - 0.12, yt, z - 0.05, z + 0.05, o); p.slab('black', -L, L, yb, yb + 0.12, z - 0.05, z + 0.05, o);
    for (let x = -L; x <= L + 0.01; x += 2) p.slab('black', x - 0.04, x + 0.04, yb + 0.12, yt - 0.12, z - 0.04, z + 0.04, o);
    const rise = yt - yb - 0.24, len = Math.hypot(1.92, rise), ang = Math.atan2(rise, 1.92);
    for (let x = -L + 1; x < L; x += 2) p.box('black', [len, 0.07, 0.07], [x, (yb + yt) / 2, z], [0, 0, x < 0 ? ang : -ang], o);
  }
  for (let x = -L; x <= L + 0.01; x += 2) for (const y of [yb + 0.03, yt - 0.09]) p.slab('black', x - 0.03, x + 0.03, y, y + 0.06, -0.15, 0.15, o);   // (ties between the two frames)
  p.slab('black', -L, L, yt, DOOR2.wall + 0.2, -0.05, 0.05, o);                                              // (hung from the decking)
  p.slab('black', -L + 0.3, L - 0.3, yb - 0.08, yb, -0.1, 0.1, o);                                           // (the light bar)
  p.glowSlab('white', -L + 0.35, L - 0.35, yb - 0.085, yb - 0.08, -0.05, 0.05);
  for (let x = -L + 1; x < L; x += 2) p.light([x, yb - 0.3, 0], 5, [1, 0.98, 0.95], [0, -1, 0], 9);
  TRUSS2.lamps.forEach((x, i) => lamp(p, x, i % 2 ? -0.62 : 0.62));
}

// ── stand-ins ─────────────────────────────────────────────────────────────────────────────────────────────────────
// one flat mid-grey, nothing on it: plainly not the finished thing. Sizes in metres, written into the variant.
export const STAND = { c: '#7d7f82', r: 0.7, m: 0, w: 0 };
const STAND_RE = /^(box|cyl|cylx) (\d+(\.\d+)?)(x\d+(\.\d+)?){1,2}$/;
export function standIn(p, v) {
  const [kind, dims] = v.split(' '), n = dims.split('x').map(Number);
  if (kind === 'cyl') p.cyl(STAND, n[0], n[1], [0, n[1] / 2, 0], null, 24);                     // radius x height, standing
  else if (kind === 'cylx') p.cyl(STAND, n[0], n[1], [0, n[0], 0], [0, 0, PI / 2], 24);        // radius x length, lying along x
  else p.slab(STAND, -n[0] / 2, n[0] / 2, 0, n[1], -n[2] / 2, n[2] / 2, { r: 0.02, cell: 1.5, loops: [] });   // wide x high x deep
}

export const STATION2 = {
  baydoor2: { name: 'Big hangar door', group: 'Hangar', at: 'point', variants: ['open'], foot: [24, 11, 5.5], build: bayDoor2 },
  pad: { name: 'Big landing pad', group: 'Hangar', at: 'free', variants: ['ring', 'ring 1'], foot: [19, 0.1, 19], build: pad },
  truss2: { name: 'Big hangar roof truss', group: 'Hangar', at: 'point', variants: ['span'], foot: [28, 1.7, 1.5], build: truss2, y: 10 },
  standin: { name: 'Stand-in (to be designed)', group: 'Hangar', at: 'free', variants: ['box 2x2x2', 'cyl 1x2', 'cylx 1x3'], accepts: (v) => STAND_RE.test(v), foot: [3, 2, 2], build: standIn },
  wall3: { name: 'Third storey panel', group: 'Big rooms', at: 'edge', variants: ['plain', 'vent'], foot: [2, 3, 0.3], build: wall3 },
  hatchshut: { name: 'Sealed hatch', group: 'Shell', at: 'point', variants: ['wide'], foot: [4, 3, 0.6], build: hatchShut },
  board: { name: 'Crew board', group: 'Wall kit', at: 'wall', variants: ['medic', 'mining', 'explore', 'medic big', 'mining big', 'explore big'], foot: [2.6, 1.8, 0.1], build: board },
};
